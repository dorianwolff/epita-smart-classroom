import { CATEGORY_BY_CLASS } from "../config/categories.js";
import { getCocoLabel } from "../config/coco-labels.js";
import { AUDIT_MODE } from "../config/defaults.js";

function countByClass(detections) {
  return detections.reduce((counts, detection) => {
    counts[detection.rawLabel] = (counts[detection.rawLabel] ?? 0) + 1;
    return counts;
  }, {});
}

function getRowStatus({ analysed, configured, supported, expected, detected }) {
  if (!configured) return "Non configuré";
  if (!supported) return "Non vérifiable";
  if (!Number.isInteger(expected)) return "Non configuré";
  if (!analysed) return "En attente";
  if (detected === expected) return "Vérifié";
  if (detected < expected) return "Écart à contrôler";
  return "Surplus observé";
}

function buildRows(categories, expectedConfiguration, classCounts, analysed, configured) {
  return categories.map((category) => {
    const expected = configured ? expectedConfiguration[category.id] : null;
    const detected = analysed && category.cocoClass ? classCounts[category.cocoClass] ?? 0 : null;
    const difference = Number.isInteger(expected) && detected !== null ? detected - expected : null;
    return {
      ...category,
      expected,
      detected,
      difference,
      status: getRowStatus({ analysed, configured, supported: category.supported, expected, detected })
    };
  });
}

function buildOtherObjects(classCounts) {
  return Object.entries(classCounts)
    .filter(([className]) => !CATEGORY_BY_CLASS.has(className))
    .map(([className, count]) => ({ className, label: getCocoLabel(className), count }))
    .sort((left, right) => right.count - left.count || left.className.localeCompare(right.className));
}

function getGlobalStatus(analysed, configured, verifiableRules, observedDifferences) {
  if (!analysed) return "En attente";
  if (!configured) return "Détection terminée";
  if (verifiableRules === 0) return "Analyse insuffisante";
  if (observedDifferences === 0) return "Configuration vérifiée";
  return "Contrôle complémentaire recommandé";
}

export function calculateAudit({ detections, categories, expectedConfiguration, analysed, auditMode }) {
  const configured = auditMode === AUDIT_MODE.CONFIGURED;
  const classCounts = countByClass(detections);
  const rows = buildRows(categories, expectedConfiguration, classCounts, analysed, configured);
  const verifiableRows = rows.filter((row) => row.supported && Number.isInteger(row.expected));
  const differences = analysed ? verifiableRows.filter((row) => row.difference !== 0) : [];
  const verifiableRules = analysed && configured ? verifiableRows.length : 0;

  return {
    analysed,
    mode: auditMode,
    modelIds: [...new Set(detections.map(({ modelId }) => modelId).filter(Boolean))],
    rows,
    classCounts,
    otherObjects: buildOtherObjects(classCounts),
    differences,
    metrics: {
      totalSafeObjects: analysed ? detections.length : 0,
      distinctCategories: analysed ? Object.keys(classCounts).length : 0,
      verifiableRules,
      observedDifferences: differences.length,
      globalStatus: getGlobalStatus(analysed, configured, verifiableRules, differences.length)
    }
  };
}
