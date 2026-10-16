import { DEFAULTS } from "../config/defaults.js";
import { getElement } from "../utils/dom.js";
import { AppError, getErrorContent, safeLog } from "../utils/errors.js";
import { requestMicrophoneStream } from "./audio-permission-service.js";
import { normalizeAudioEvents } from "./audio-event-normalizer.js";
import { createAudioSmoother } from "./audio-smoother.js";

export class AudioController {
  constructor({ store, workerFactory = () => new Worker(new URL("./audio-worker.js", import.meta.url), { type: "module" }) }) {
    this.store = store;
    this.workerFactory = workerFactory;
    this.worker = null;
    this.stream = null;
    this.audioContext = null;
    this.sourceNode = null;
    this.processorNode = null;
    this.mutedGain = null;
    this.busy = false;
    this.generation = 0;
    this.lastSourceId = null;
    this.smoother = createAudioSmoother();
    this.elements = this.getElements();
  }

  getElements() {
    const ids = ["workflow-visual", "workflow-audio", "visual-workflow", "sound-workflow", "start-audio", "stop-audio",
      "audio-status", "audio-current", "audio-recent", "audio-error", "sound-confidence", "sound-confidence-value"];
    return Object.fromEntries(ids.map((id) => [id.replaceAll("-", "_"), getElement(`#${id}`)]));
  }

  start() {
    const threshold = this.store.getState().soundConfidenceThreshold;
    this.elements.sound_confidence.value = String(threshold * 100);
    this.elements.sound_confidence_value.textContent = `${Math.round(threshold * 100)} %`;
    this.elements.workflow_visual.addEventListener("click", () => this.selectWorkflow("visual"));
    this.elements.workflow_audio.addEventListener("click", () => this.selectWorkflow("audio"));
    this.elements.start_audio.addEventListener("click", () => this.beginListening());
    this.elements.stop_audio.addEventListener("click", () => this.stop());
    this.elements.sound_confidence.addEventListener("input", (event) => {
      const value = Number(event.target.value) / 100;
      this.store.setSoundThreshold(value);
      this.elements.sound_confidence_value.textContent = `${Math.round(value * 100)} %`;
      this.smoother.reset();
    });
    this.store.subscribe((state) => {
      const sourceId = state.currentSource?.sourceId ?? null;
      if (sourceId !== this.lastSourceId && this.isActive()) this.stop();
      this.lastSourceId = sourceId;
      this.render(state);
    });
    this.render(this.store.getState());
  }

  selectWorkflow(workflow) {
    const audio = workflow === "audio";
    this.elements.visual_workflow.hidden = audio;
    this.elements.sound_workflow.hidden = !audio;
    this.elements.workflow_visual.classList.toggle("is-active", !audio);
    this.elements.workflow_audio.classList.toggle("is-active", audio);
    this.elements.workflow_visual.setAttribute("aria-selected", String(!audio));
    this.elements.workflow_audio.setAttribute("aria-selected", String(audio));
    if (!audio && this.isActive()) this.stop();
  }

  async beginListening() {
    if (this.isActive()) return;
    const generation = ++this.generation;
    this.smoother.reset();
    this.store.setAudioState({ audioStatus: "requesting", audioError: null, audioCurrentEvent: null });
    try {
      const stream = await requestMicrophoneStream();
      if (generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      this.store.setAudioState({ audioStatus: "loading" });
      this.worker = this.workerFactory();
      this.worker.addEventListener("message", (event) => this.handleWorkerMessage(event.data));
      this.worker.addEventListener("error", (event) => this.fail(new AppError("AUDIO_MODEL_LOAD", event.message)));
      this.worker.postMessage({ type: "initialize", configuration: DEFAULTS.audio, generation });
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
  }

  async activateCapture() {
    const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContextClass) throw new AppError("AUDIO_UNSUPPORTED");
    this.audioContext = new AudioContextClass({ sampleRate: 16000 });
    await this.audioContext.resume();
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
    this.processorNode = this.audioContext.createScriptProcessor(DEFAULTS.soundWindowSamples, 1, 1);
    this.mutedGain = this.audioContext.createGain();
    this.mutedGain.gain.value = 0;
    this.processorNode.onaudioprocess = (event) => this.sendWindow(event.inputBuffer);
    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.mutedGain);
    this.mutedGain.connect(this.audioContext.destination);
  }

  sendWindow(inputBuffer) {
    if (this.busy || this.store.getState().audioStatus !== "listening" || !this.worker) return;
    const samples = new Float32Array(inputBuffer.getChannelData(0));
    this.busy = true;
    this.worker.postMessage({ type: "classify", samples, sampleRate: inputBuffer.sampleRate, generation: this.generation }, [samples.buffer]);
  }

  async handleWorkerMessage(message) {
    if (message.generation !== this.generation) return;
    if (message.type === "ready") {
      try {
        await this.activateCapture();
        this.store.setAudioState({ audioStatus: "listening", audioMetadata: message.metadata });
      } catch (error) {
        this.fail(error);
      }
    } else if (message.type === "result") {
      this.busy = false;
      const events = normalizeAudioEvents(message.categories, this.store.getState().soundConfidenceThreshold);
      const smoothed = this.smoother.update(events);
      this.store.setAudioState({
        audioCurrentEvent: smoothed.current,
        audioRecentEvents: smoothed.recent,
        audioMetadata: { ...this.store.getState().audioMetadata, inferenceMilliseconds: message.inferenceMilliseconds }
      });
    } else if (message.type === "error") this.fail(new AppError("AUDIO_MODEL_LOAD", message.message));
  }

  fail(error) {
    if (!(error instanceof AppError)) safeLog("audio", error);
    this.teardown();
    this.store.setAudioState({ audioStatus: "error", audioError: getErrorContent(error) });
  }

  stop({ clear = false } = {}) {
    this.generation += 1;
    this.teardown();
    this.smoother.reset();
    if (clear) this.store.resetAudio();
    else this.store.setAudioState({ audioStatus: "idle", audioCurrentEvent: null, audioError: null });
  }

  teardown() {
    this.processorNode?.disconnect?.();
    this.sourceNode?.disconnect?.();
    this.mutedGain?.disconnect?.();
    this.stream?.getTracks?.().forEach((track) => track.stop());
    this.worker?.postMessage?.({ type: "dispose" });
    this.worker?.terminate?.();
    void this.audioContext?.close?.();
    this.worker = null; this.stream = null; this.audioContext = null;
    this.sourceNode = null; this.processorNode = null; this.mutedGain = null; this.busy = false;
  }

  render(state) {
    const active = ["requesting", "loading", "listening"].includes(state.audioStatus);
    const messages = {
      idle: "Microphone arrêté. Aucun son n’est analysé.",
      requesting: "Autorisation du microphone en attente…",
      loading: "Chargement local de YAMNet…",
      listening: "Écoute active : classification locale, sans enregistrement.",
      error: "Analyse sonore indisponible."
    };
    this.elements.audio_status.textContent = messages[state.audioStatus];
    this.elements.start_audio.disabled = active;
    this.elements.stop_audio.disabled = !active;
    this.elements.audio_current.textContent = state.audioCurrentEvent
      ? `${state.audioCurrentEvent.label} · ${Math.round(state.audioCurrentEvent.score * 100)} %`
      : "Aucun événement stable au-dessus du seuil.";
    const recentItems = state.audioRecentEvents.map((event) => {
      const item = document.createElement("li");
      item.textContent = `${event.label} · ${Math.round(event.score * 100)} %`;
      return item;
    });
    if (!recentItems.length) {
      const empty = document.createElement("li");
      empty.textContent = "Aucun événement confirmé.";
      recentItems.push(empty);
    }
    this.elements.audio_recent.replaceChildren(...recentItems);
    this.elements.audio_error.hidden = !state.audioError;
    this.elements.audio_error.textContent = state.audioError ? `${state.audioError.title} — ${state.audioError.message}` : "";
  }

  isActive() {
    return Boolean(this.worker || this.stream || this.audioContext);
  }
}
