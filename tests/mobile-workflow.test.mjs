import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { lockBodyScroll } from "../src/ui/body-scroll-lock.js";

test("mobile workflow defines four distinct primary screens", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const screens = [...html.matchAll(/data-workflow-screen="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(screens, ["capture", "analysis", "results", "report"]);
  assert.match(html, /data-workflow-screen="analysis"[^>]*hidden inert/);
  assert.match(html, /data-workflow-screen="report"[^>]*hidden inert/);
});

test("report and settings are not appended to the capture screen", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const captureEnd = html.indexOf("</section>", html.indexOf('id="capture-screen"'));
  assert.ok(html.indexOf('id="report-screen"') > captureEnd);
  assert.ok(html.indexOf('id="settings-dialog"') > html.indexOf('id="report-screen"'));
});

test("full-screen camera CSS uses fixed 100dvh and safe-area controls", async () => {
  const css = await readFile(new URL("../styles/camera-workspace.css", import.meta.url), "utf8");
  assert.match(css, /position: fixed/); assert.match(css, /inset: 0/); assert.match(css, /height: 100dvh/);
  assert.match(css, /safe-area-inset-top/); assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /object-fit: contain/);
});

test("body scroll lock restores every previous inline value and scroll position", () => {
  const body = { style: { position: "relative", top: "2px", width: "90%", overflow: "auto" } };
  const calls = []; const viewport = { scrollY: 321, scrollTo: (...args) => calls.push(args) };
  const restore = lockBodyScroll(body, viewport);
  assert.deepEqual(body.style, { position: "fixed", top: "-321px", width: "100%", overflow: "hidden" });
  restore();
  assert.deepEqual(body.style, { position: "relative", top: "2px", width: "90%", overflow: "auto" });
  assert.deepEqual(calls, [[0, 321]]);
});

test("camera markup exposes close, capture, switch, live toggle and recovery upload", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  for (const id of ["camera-close", "camera-capture", "camera-switch", "camera-live-toggle", "camera-lighting-status", "camera-upload-alternative"]) {
    assert.ok(html.includes(`id="${id}"`));
  }
  assert.match(html, /playsinline autoplay muted/);
});
