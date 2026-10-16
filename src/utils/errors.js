export class AppError extends Error {
  constructor(code, details = "") {
    super(code);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export const ERROR_MESSAGES = Object.freeze({
  MODEL_LOAD: ["Modèle indisponible", "Le modèle de détection n’a pas pu être chargé. Vérifiez votre connexion, puis réessayez."],
  DETECTION: ["Analyse impossible", "La détection a échoué. Réessayez avec l’image actuelle ou choisissez une autre image."],
  UNSUPPORTED_BROWSER: ["Navigateur non compatible", "Cette fonction nécessite un navigateur récent. Vous pouvez essayer l’import d’image."],
  INSECURE_CONTEXT: ["Connexion sécurisée requise", "La caméra fonctionne uniquement en HTTPS ou sur localhost. Utilisez l’import d’image ici."],
  CAMERA_DENIED: ["Accès à la caméra refusé", "Autorisez la caméra dans les réglages du navigateur ou importez une image."],
  CAMERA_NOT_FOUND: ["Aucune caméra trouvée", "Aucune caméra utilisable n’a été détectée. Importez une image pour continuer."],
  CAMERA_BUSY: ["Caméra indisponible", "La caméra est peut-être utilisée par une autre application. Fermez-la, puis réessayez."],
  INVALID_FILE: ["Fichier non valide", "Choisissez une image JPEG, PNG ou WebP de moins de 15 Mo."],
  IMAGE_LOAD: ["Image illisible", "Cette image n’a pas pu être chargée. Essayez un autre fichier."],
  NO_SUPPORTED_OBJECTS: ["Aucun équipement pris en charge", "Aucun équipement vérifiable n’a été reconnu. Essayez un autre cadrage ou réduisez le seuil."],
  UNEXPECTED: ["Erreur inattendue", "Une erreur est survenue. Réinitialisez l’audit puis réessayez."]
});

export function getErrorContent(error) {
  const code = error instanceof AppError && ERROR_MESSAGES[error.code] ? error.code : "UNEXPECTED";
  const [title, message] = ERROR_MESSAGES[code];
  return { code, title, message };
}

export function safeLog(context, error) {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(`[SalleScope] ${context}: ${detail}`);
}
