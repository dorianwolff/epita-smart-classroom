import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES, DEFAULT_EXPECTED } from "../src/config/categories.js";
import { calculateAudit } from "../src/domain/audit-engine.js";

const detection = (className) => ({ className, score: 0.9, bbox: [0, 0, 10, 10] });

test("returns waiting state before an analysis", () => {
  const audit = calculateAudit({ detections: [], categories: CATEGORIES, expectedConfiguration: DEFAULT_EXPECTED, analysed: false });
  assert.equal(audit.metrics.globalStatus, "En attente");
  assert.equal(audit.metrics.verifiableRules, 0);
});

test("calculates exact, missing and surplus quantities", () => {
  const expectedConfiguration = { ...DEFAULT_EXPECTED, tables: 1, chairs: 2, laptops: 0, screens: 0 };
  const detections = [detection("dining table"), detection("chair"), detection("laptop")];
  const audit = calculateAudit({ detections, categories: CATEGORIES, expectedConfiguration, analysed: true });
  assert.equal(audit.rows.find((row) => row.id === "tables").status, "Vérifié");
  assert.equal(audit.rows.find((row) => row.id === "chairs").status, "Écart à contrôler");
  assert.equal(audit.rows.find((row) => row.id === "laptops").status, "Surplus observé");
  assert.equal(audit.metrics.observedDifferences, 2);
});

test("keeps unsupported categories non-verifiable", () => {
  const audit = calculateAudit({ detections: [], categories: CATEGORIES, expectedConfiguration: DEFAULT_EXPECTED, analysed: true });
  assert.equal(audit.rows.find((row) => row.id === "board").status, "Non vérifiable");
  assert.equal(audit.rows.find((row) => row.id === "windows").detected, null);
});

test("separates recognised objects outside classroom mapping", () => {
  const audit = calculateAudit({ detections: [detection("book")], categories: CATEGORIES, expectedConfiguration: DEFAULT_EXPECTED, analysed: true });
  assert.deepEqual(audit.otherObjects, [{ className: "book", label: "livre", count: 1 }]);
});
