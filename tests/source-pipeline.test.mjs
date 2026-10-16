import test from "node:test";
import assert from "node:assert/strict";
import { createCameraService } from "../src/services/camera-service.js";
import { fitWithinMaximum } from "../src/services/source-resolution.js";

test("source resizing preserves aspect ratio and never upscales", () => {
  assert.deepEqual(fitWithinMaximum(1920, 1080, 1600), { width: 1600, height: 900 });
  assert.deepEqual(fitWithinMaximum(800, 600, 1600), { width: 800, height: 600 });
});

test("camera capture requests HD, uses intrinsic video dimensions and disables audio", async () => {
  let requestedConstraints = null;
  let drawArguments = null;
  const track = { stop() {} };
  const stream = { getTracks: () => [track] };
  Object.defineProperty(globalThis, "window", { value: { isSecureContext: true }, configurable: true });
  Object.defineProperty(globalThis, "navigator", {
    value: { mediaDevices: { getUserMedia: async (constraints) => { requestedConstraints = constraints; return stream; } } },
    configurable: true
  });
  Object.defineProperty(globalThis, "document", {
    value: {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: (...args) => { drawArguments = args; } })
      })
    },
    configurable: true
  });

  const video = { videoWidth: 1920, videoHeight: 1080, srcObject: null, play: async () => {} };
  const service = createCameraService();
  await service.start(video);
  const capture = service.capture(video);

  assert.deepEqual(requestedConstraints, {
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    },
    audio: false
  });
  assert.equal(capture.width, 1600);
  assert.equal(capture.height, 900);
  assert.deepEqual(drawArguments, [video, 0, 0, 1600, 900]);
});

test("a paused camera stream can be reused, then every track is stopped", async () => {
  let starts = 0;
  let plays = 0;
  let pauses = 0;
  let stops = 0;
  const stream = { getTracks: () => [{ stop: () => { stops += 1; } }, { stop: () => { stops += 1; } }] };
  Object.defineProperty(globalThis, "window", { value: { isSecureContext: true }, configurable: true });
  Object.defineProperty(globalThis, "navigator", {
    value: { mediaDevices: { getUserMedia: async () => { starts += 1; return stream; } } },
    configurable: true
  });
  const video = {
    srcObject: null,
    play: async () => { plays += 1; },
    pause: () => { pauses += 1; }
  };
  const service = createCameraService();
  await service.start(video);
  service.pause(video);
  await service.resume(video);
  assert.equal(starts, 1);
  assert.equal(plays, 2);
  assert.equal(pauses, 1);
  service.stop(video);
  assert.equal(stops, 2);
  assert.equal(video.srcObject, null);
});
