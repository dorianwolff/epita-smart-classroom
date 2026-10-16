const PERSON_LABELS = new Set(["person", "human", "student", "teacher", "face", "man", "woman", "boy", "girl"]);

export function isPrivatePrediction(prediction) {
  return PERSON_LABELS.has(String(prediction.rawLabel ?? "").trim().toLowerCase());
}

export function removePrivatePredictions(predictions) {
  return predictions.filter((prediction) => !isPrivatePrediction(prediction));
}
