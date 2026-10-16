import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateAuditPayload } from "../functions/lib/audit-schema.js";
import { checkWriteRequest, readJson } from "../functions/lib/request.js";
import { SECURITY_HEADERS } from "../src/security/security-headers.js";
import { buildCloudAudit } from "../src/cloud/audit-payload.js";

function validPayload() {
  return { roomName: "Salle A", expectedConfiguration: { chairs: 20 }, confirmedCounts: { chairs: 18 }, manualAnnotations: [],
    models: ["COCO-SSD"], threshold: 0.3, imageQuality: { meanLuminance: 0.2 }, soundEvents: [], anomalies: [],
    contextualEvidence: [], reportSchemaVersion: 1, appVersion: "1.1.0" };
}

test("cloud payload schema accepts bounded structured audit data", () => assert.equal(validateAuditPayload(validPayload()), null));

test("cloud schema rejects unknown fields and forbidden media payloads", () => {
  assert.match(validateAuditPayload({ ...validPayload(), ownerId: "spoofed" }), /premier niveau/);
  assert.match(validateAuditPayload({ ...validPayload(), roomName: "data:image/png;base64,abc" }), /interdite/);
  assert.match(validateAuditPayload({ ...validPayload(), contextualEvidence: [{ label: "person", evidenceType: "observed", status: "confirmed", explanation: "person" }] }), /interdite/);
});

test("cloud schema bounds threshold, counts and annotation geometry", () => {
  assert.match(validateAuditPayload({ ...validPayload(), threshold: 2 }), /Seuil/);
  assert.match(validateAuditPayload({ ...validPayload(), confirmedCounts: { chairs: -1 } }), /Quantité/);
  assert.match(validateAuditPayload({ ...validPayload(), manualAnnotations: [{ label: "whiteboard", evidenceType: "manual", status: "confirmed", polygon: [{ x: 2, y: 0 }] }] }), /Annotation/);
});

test("write endpoints require exact same origin and a custom header", () => {
  const url = "https://example.test/api/audits";
  assert.equal(checkWriteRequest(new Request(url, { method: "POST", headers: { Origin: "https://evil.test", "Content-Type": "application/json", "X-SalleScope-Request": "1" } })).status, 403);
  assert.equal(checkWriteRequest(new Request(url, { method: "POST", headers: { Origin: "https://example.test", "Content-Type": "application/json" } })).status, 403);
  assert.equal(checkWriteRequest(new Request(url, { method: "POST", headers: { Origin: "https://example.test", "Content-Type": "application/json", "X-SalleScope-Request": "1" } })), null);
});

test("oversized JSON bodies receive 413 before validation", async () => {
  const body = JSON.stringify({ value: "x".repeat(100) });
  const result = await readJson(new Request("https://example.test", { method: "POST", headers: { "Content-Length": String(body.length) }, body }), 20);
  assert.equal(result.error.status, 413);
});

test("client cloud payload excludes source assets, audio buffers and person detections", () => {
  const state = { audit: { rows: [{ id: "chairs", detected: 2 }] }, evidence: [], expectedConfiguration: { chairs: 2 },
    auditMetadata: { model: "COCO" }, confidenceThreshold: 0.3, imageQuality: { metrics: { meanLuminance: 0.2, histogram: [1, 2] } },
    audioRecentEvents: [{ label: "Musique", score: 0.7 }], currentSource: { asset: "SECRET_IMAGE" }, detections: [{ rawLabel: "person" }] };
  const serialized = JSON.stringify(buildCloudAudit(state));
  assert.equal(serialized.includes("SECRET_IMAGE"), false); assert.equal(serialized.includes("person"), false); assert.equal(serialized.includes("histogram"), false);
});

test("static and Function security headers align on required protections", async () => {
  const staticHeaders = await readFile(new URL("../_headers", import.meta.url), "utf8");
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    assert.match(staticHeaders, new RegExp(name.replaceAll("-", "\\-")));
    if (name !== "Content-Security-Policy") assert.ok(staticHeaders.includes(value));
  }
  assert.ok(SECURITY_HEADERS["Content-Security-Policy"].includes("frame-ancestors 'none'"));
  assert.equal(SECURITY_HEADERS["Permissions-Policy"], "camera=(self), microphone=(self), geolocation=()");
});

test("D1 migration scopes every record table by owner and enables retention", async () => {
  const migration = await readFile(new URL("../migrations/0001_initial.sql", import.meta.url), "utf8");
  for (const table of ["audits", "audit_items", "audit_measurements", "audit_confirmations"]) {
    const block = migration.slice(migration.indexOf(`CREATE TABLE ${table}`), migration.indexOf(";", migration.indexOf(`CREATE TABLE ${table}`)));
    assert.match(block, /owner_id TEXT NOT NULL/);
  }
  assert.match(migration, /expires_at TEXT NOT NULL/); assert.match(migration, /UNIQUE\(owner_id, idempotency_key\)/);
});
