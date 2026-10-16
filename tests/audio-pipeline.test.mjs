import test from "node:test";
import assert from "node:assert/strict";
import { extractAudioCategories } from "../src/audio/audio-classifier-adapter.js";
import { normalizeAudioEvents } from "../src/audio/audio-event-normalizer.js";
import { requestMicrophoneStream } from "../src/audio/audio-permission-service.js";
import { createAudioSmoother } from "../src/audio/audio-smoother.js";

test("MediaPipe results are flattened and sorted without retaining audio samples", () => {
  const categories = extractAudioCategories([{ classifications: [{ categories: [
    { categoryName: "Speech", score: 0.72, index: 0 },
    { categoryName: "Clapping", score: 0.91, index: 1 }
  ] }] }]);
  assert.deepEqual(categories.map(({ label }) => label), ["Clapping", "Speech"]);
  assert.ok(categories.every((item) => !("samples" in item)));
});

test("sensitive speech subclasses collapse to a generic non-identifying label", () => {
  const events = normalizeAudioEvents([
    { label: "Male speech, man speaking", score: 0.8 },
    { label: "Clapping", score: 0.7 }
  ], 0.3);
  assert.deepEqual(events.map(({ id, label }) => ({ id, label })), [
    { id: "speech", label: "Parole" },
    { id: "applause", label: "Applaudissements" }
  ]);
});

test("generic and ambulance sirens share one cautious alarm category", () => {
  const events = normalizeAudioEvents([
    { label: "Siren", score: 0.62 },
    { label: "Ambulance (siren)", score: 0.78 }
  ], 0.3);
  assert.deepEqual(events, [{ id: "alarm", label: "Alarme ou sirène", score: 0.78 }]);
});

test("an audio event requires two consecutive windows and recent events stay bounded", () => {
  let time = 0;
  const smoother = createAudioSmoother({ minimumWindows: 2, maximumRecent: 2, now: () => ++time });
  assert.equal(smoother.update([{ id: "speech", label: "Parole", score: 0.7 }]).current, null);
  assert.equal(smoother.update([{ id: "speech", label: "Parole", score: 0.8 }]).current.id, "speech");
  assert.equal(smoother.update([]).current.id, "speech");
  assert.equal(smoother.update([]).current, null);
  smoother.update([{ id: "music", label: "Musique", score: 0.9 }]);
  smoother.update([{ id: "music", label: "Musique", score: 0.9 }]);
  smoother.update([{ id: "alarm", label: "Alarme ou sirène", score: 0.9 }]);
  const state = smoother.update([{ id: "alarm", label: "Alarme ou sirène", score: 0.9 }]);
  assert.deepEqual(state.recent.map(({ id }) => id), ["alarm", "music"]);
});

test("microphone permission requests audio only and maps denial", async () => {
  const originalSecureContext = globalThis.isSecureContext;
  Object.defineProperty(globalThis, "isSecureContext", { value: true, configurable: true });
  let constraints;
  const stream = { getTracks: () => [] };
  assert.equal(await requestMicrophoneStream({ getUserMedia: async (value) => { constraints = value; return stream; } }), stream);
  assert.deepEqual(constraints, { audio: { channelCount: 1, echoCancellation: false }, video: false });
  await assert.rejects(requestMicrophoneStream({ getUserMedia: async () => { const error = new Error(); error.name = "NotAllowedError"; throw error; } }),
    (error) => error.code === "MICROPHONE_DENIED");
  Object.defineProperty(globalThis, "isSecureContext", { value: originalSecureContext, configurable: true });
});
