import { CATEGORY_BY_CLASS } from "../config/categories.js";
import { getCocoLabel } from "../config/coco-labels.js";

function countByClass(detections) {
  return detections.reduce((counts, detection) => {
    counts[detection.className] = (counts[detection.className] ?? 0) + 1;
    return counts;
  }, {});
}

function getRowStatus({ analysed, supported, expected, detected }) {
  if (!supported) return "Non vérifiable";
  if (!analysed) return "En attente";
  if (detected === expected) return "Vérifié";
  if (detected < expected) return "Écart à contrôler";
  return "Surplus observé";
}

function buildRows(categories, expectedConfiguration, classCounts, analysed) {
  return categories.map((category) => {
    const expected = expectedConfiguration[category.id] ?? category.defaultExpected;
    const detected = category.cocoClass ? classCounts[category.cocoClass] ?? 0 : null;
    const difference = detected === null ? null : detected - expected;
    return {
      ...category,
      expected,
      detected,
      difference,
      status: getRowStatus({ analysed, supported: category.supported, expected, detected })
    };
  });
}

function buildOtherObjects(classCounts) {
  return Object.entries(classCounts)
    .filter(([className]) => !CATEGORY_BY_CLASS.has(className))
    .map(([className, count]) => ({ className, label: getCocoLabel(className), count }))
    .sort((left, right) => right.count - left.count || left.className.localeCompare(right.className));
}

function getGlobalStatus(analysed, verifiableRules, observedDifferences) {
  if (!analysed) return "En attente";
  if (verifiableRules === 0) return "Analyse insuffisante";
  if (observedDifferences === 0) return "Configuration vérifiée";
  return "Contrôle complémentaire recommandé";
}

export function calculateAudit({ detections, categories, expectedConfiguration, analysed }) {
  const classCounts = countByClass(detections);
  const rows = buildRows(categories, expectedConfiguration, classCounts, analysed);
  const verifiableRows = rows.filter((row) => row.supported);
  const differences = analysed ? verifiableRows.filter((row) => row.difference !== 0) : [];
  const verifiableRules = analysed ? verifiableRows.length : 0;

  return {
    analysed,
    rows,
    classCounts,
    otherObjects: buildOtherObjects(classCounts),
    differences,
    metrics: {
      totalSafeObjects: analysed ? detections.length : 0,
      distinctCategories: analysed ? Object.keys(classCounts).length : 0,
      verifiableRules,
      observedDifferences: differences.length,
      globalStatus: getGlobalStatus(analysed, verifiableRules, differences.length)
    }
  };
}
