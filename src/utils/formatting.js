export function formatPercent(score) {
  return `${Math.round(score * 100)} %`;
}

export function formatDateTime(value) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short"
  }).format(value);
}

export function formatInputMode(mode) {
  if (mode === "camera") return "Caméra";
  if (mode === "upload") return "Image importée";
  return "Non défini";
}

export function signedNumber(value) {
  return value > 0 ? `+${value}` : String(value);
}
