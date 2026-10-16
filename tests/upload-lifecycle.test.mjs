import test from "node:test";
import assert from "node:assert/strict";
import { createImageSource, takeSelectedFile } from "../src/services/image-service.js";

test("the same file can be selected twice because the input is reset immediately", () => {
  const file = { name: "room.jpg", type: "image/jpeg", size: 10 };
  const input = { files: [file], value: "room.jpg" };
  assert.equal(takeSelectedFile(input), file);
  assert.equal(input.value, "");
  input.files = [file];
  input.value = "room.jpg";
  assert.equal(takeSelectedFile(input), file);
  assert.equal(input.value, "");
});

test("fallback object URLs are revoked exactly once after a safe canvas copy", async () => {
  const originalBitmap = globalThis.createImageBitmap;
  const originalImage = globalThis.Image;
  const originalDocument = globalThis.document;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const revoked = [];
  let drawCount = 0;
  globalThis.createImageBitmap = undefined;
  URL.createObjectURL = () => "blob:fixture";
  URL.revokeObjectURL = (url) => revoked.push(url);
  globalThis.Image = class {
    naturalWidth = 640;
    naturalHeight = 480;
    set src(value) { queueMicrotask(() => this.onload?.({ value })); }
  };
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: () => { drawCount += 1; } })
    })
  };
  try {
    const canvas = await createImageSource({ type: "image/jpeg", size: 100 });
    assert.equal(canvas.width, 640);
    assert.equal(canvas.height, 480);
    assert.equal(drawCount, 1);
    assert.deepEqual(revoked, ["blob:fixture"]);
  } finally {
    globalThis.createImageBitmap = originalBitmap;
    globalThis.Image = originalImage;
    globalThis.document = originalDocument;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});
