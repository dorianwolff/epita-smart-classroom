import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES, EMPTY_EXPECTED } from "../src/config/categories.js";
import { AUDIT_MODE, DEFAULTS } from "../src/config/defaults.js";
import { calculateAudit } from "../src/domain/audit-engine.js";
import { rectangleFromDrag, rectangleToPolygon, movePolygonHandle, denormalizePoint } from "../src/evidence/annotation-geometry.js";
import { proposeBoardCandidate } from "../src/evidence/board-candidate.js";
import { inferContextualEvidence } from "../src/evidence/contextual-rules.js";
import { createEvidence, updateEvidenceStatus } from "../src/evidence/evidence-schema.js";
import { getSegformerDecision, normalizeSemanticRegion } from "../src/segmentation/segformer-candidate.js";

test("a laptop without a table creates one explainable contextual candidate", () => {
  const first = inferContextualEvidence({ detections: [{ rawLabel: "laptop" }], evidence: [] });
  assert.equal(first.length, 1); assert.equal(first[0].label, "desk-or-table"); assert.equal(first[0].canAffectAudit, false);
  const second = inferContextualEvidence({ detections: [{ rawLabel: "laptop" }], evidence: [first[0]] });
  assert.deepEqual(second, []);
});

test("a contextual suggestion never increments audit counts before confirmation", () => {
  const candidate = createEvidence(inferContextualEvidence({ detections: [{ rawLabel: "laptop" }], evidence: [] })[0]);
  const audit = calculateAudit({ detections: [{ rawLabel: "laptop", modelId: "coco" }], evidence: [candidate], categories: CATEGORIES,
    expectedConfiguration: { ...EMPTY_EXPECTED, tables: 1 }, analysed: true, auditMode: AUDIT_MODE.CONFIGURED });
  assert.equal(audit.rows.find((row) => row.id === "tables").detected, 0);
});

test("confirmed manual whiteboard evidence becomes auditable", () => {
  const item = createEvidence({ evidenceType: "manual", status: "confirmed", label: "whiteboard", sourceModel: "manual",
    polygon: [{ x: 0.1, y: 0.1 }, { x: 0.8, y: 0.1 }, { x: 0.8, y: 0.6 }, { x: 0.1, y: 0.6 }], canAffectAudit: true });
  const audit = calculateAudit({ detections: [], evidence: [item], categories: CATEGORIES,
    expectedConfiguration: { ...EMPTY_EXPECTED, board: 1 }, analysed: true, auditMode: AUDIT_MODE.CONFIGURED });
  const row = audit.rows.find((entry) => entry.id === "board");
  assert.equal(row.detected, 1); assert.equal(row.supported, true); assert.equal(row.status, "Vérifié");
});

test("rejected evidence cannot affect the audit", () => {
  const confirmed = createEvidence({ evidenceType: "manual", status: "confirmed", label: "desk", sourceModel: "manual", canAffectAudit: true });
  const rejected = updateEvidenceStatus(confirmed, "rejected");
  const audit = calculateAudit({ detections: [], evidence: [rejected], categories: CATEGORIES,
    expectedConfiguration: EMPTY_EXPECTED, analysed: true, auditMode: AUDIT_MODE.FREE });
  assert.equal(audit.metrics.totalSafeObjects, 0);
});

test("rectangle and polygon coordinates remain normalized across orientation", () => {
  const box = rectangleFromDrag({ x: 20, y: 10 }, { x: 180, y: 90 }, 200, 100);
  assert.deepEqual(box, { x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
  const polygon = rectangleToPolygon(box);
  assert.deepEqual(denormalizePoint(polygon[2], 100, 200), { x: 90, y: 180 });
  const moved = movePolygonHandle(polygon, 0, { x: 25, y: 50 }, 100, 200);
  assert.deepEqual(moved[0], { x: 0.25, y: 0.25 });
});

test("classical board assistance proposes but never confirms a rectangle", () => {
  const width = 80; const height = 60; const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 12; y <= 45; y += 1) for (let x = 10; x <= 68; x += 1) {
    if (x === 10 || x === 68 || y === 12 || y === 45) data.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 3);
  }
  const candidate = proposeBoardCandidate(data, width, height);
  assert.equal(candidate.status, "candidate"); assert.equal(candidate.label, "board-surface-candidate"); assert.equal(candidate.canAffectAudit, false);
});

test("SegFormer candidate is pinned but rejected from production by licence gate", () => {
  const decision = getSegformerDecision();
  assert.equal(decision.revision.length, 40); assert.equal(decision.sha256.length, 64);
  assert.equal(decision.shipped, false); assert.equal(decision.decision, "rejected-license");
  assert.equal(decision, DEFAULTS.segmentation);
});

test("semantic regions have null confidence and cannot count automatically", () => {
  const board = normalizeSemanticRegion({ label: "bulletin board", score: 0.99, mask: { width: 1, height: 1 } });
  assert.equal(board.label, "board-surface-candidate"); assert.equal(board.score, null); assert.equal(board.status, "candidate");
  assert.equal(board.canAffectAudit, false);
  assert.equal(normalizeSemanticRegion({ label: "person" }), null);
});
