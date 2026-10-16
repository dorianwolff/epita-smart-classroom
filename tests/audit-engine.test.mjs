import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES, CATEGORY_BY_CLASS, EMPTY_EXPECTED, EPITA_EXAMPLE_EXPECTED } from "../src/config/categories.js";
import { AUDIT_MODE } from "../src/config/defaults.js";
import { calculateAudit } from "../src/domain/audit-engine.js";

const detection = (rawLabel) => ({
  rawLabel,
  score: 0.9,
  bbox: { x: 0, y: 0, width: 10, height: 10 }
});

function calculate(overrides = {}) {
  return calculateAudit({
    detections: [],
    categories: CATEGORIES,
    expectedConfiguration: EMPTY_EXPECTED,
    analysed: false,
    auditMode: AUDIT_MODE.FREE,
    ...overrides
  });
}

test("free detection has no fictitious reference or differences", () => {
  const audit = calculate({ detections: [detection("chair")], analysed: true });
  assert.equal(audit.metrics.globalStatus, "Détection terminée");
  assert.equal(audit.metrics.verifiableRules, 0);
  assert.equal(audit.metrics.observedDifferences, 0);
  assert.ok(audit.rows.every((row) => row.expected === null && row.difference === null));
  assert.ok(audit.rows.every((row) => row.status === "Non configuré"));
});

test("configured mode calculates exact, missing and surplus quantities", () => {
  const expectedConfiguration = { ...EPITA_EXAMPLE_EXPECTED, tables: 1, chairs: 2, laptops: 0, screens: 0 };
  const detections = [detection("dining table"), detection("chair"), detection("laptop")];
  const audit = calculate({ detections, expectedConfiguration, analysed: true, auditMode: AUDIT_MODE.CONFIGURED });
  assert.equal(audit.rows.find((row) => row.id === "tables").status, "Vérifié");
  assert.equal(audit.rows.find((row) => row.id === "chairs").status, "Écart à contrôler");
  assert.equal(audit.rows.find((row) => row.id === "laptops").status, "Surplus observé");
  assert.equal(audit.metrics.observedDifferences, 2);
});

test("configured mode leaves empty and unsupported categories non-comparable", () => {
  const audit = calculate({ analysed: true, auditMode: AUDIT_MODE.CONFIGURED });
  assert.equal(audit.rows.find((row) => row.id === "chairs").status, "Non configuré");
  assert.equal(audit.rows.find((row) => row.id === "board").status, "Non vérifiable");
  assert.equal(audit.metrics.globalStatus, "Analyse insuffisante");
});

test("changing modes recalculates without changing detections", () => {
  const detections = [detection("chair")];
  const free = calculate({ detections, analysed: true, expectedConfiguration: EPITA_EXAMPLE_EXPECTED });
  const configured = calculate({ detections, analysed: true, expectedConfiguration: EPITA_EXAMPLE_EXPECTED, auditMode: AUDIT_MODE.CONFIGURED });
  assert.equal(free.classCounts.chair, configured.classCounts.chair);
  assert.equal(free.metrics.observedDifferences, 0);
  assert.ok(configured.metrics.observedDifferences > 0);
});

test("separates recognised objects outside classroom mapping", () => {
  const audit = calculate({ detections: [detection("book")], analysed: true });
  assert.deepEqual(audit.otherObjects, [{ className: "book", label: "livre", count: 1 }]);
});

test("maps the exact COCO class names through the central category configuration", () => {
  assert.equal(CATEGORY_BY_CLASS.get("chair").id, "chairs");
  assert.equal(CATEGORY_BY_CLASS.get("dining table").id, "tables");
  assert.equal(CATEGORY_BY_CLASS.get("laptop").id, "laptops");
  assert.equal(CATEGORY_BY_CLASS.get("tv").id, "screens");
});
