const GROUPS = Object.freeze([
  { id: "speech", label: "Parole", patterns: ["speech", "conversation", "narration", "monologue", "whisper", "shout"] },
  { id: "applause", label: "Applaudissements", patterns: ["applause", "clapping", "clap"] },
  { id: "music", label: "Musique", patterns: ["music", "singing", "musical instrument"] },
  { id: "alarm", label: "Alarme ou sirène", patterns: ["alarm", "siren", "smoke detector", "fire alarm"] },
  { id: "door", label: "Porte ou coup", patterns: ["door", "knock", "slam"] },
  { id: "keyboard", label: "Clavier ou saisie", patterns: ["keyboard", "typing", "typewriter"] },
  { id: "writing", label: "Écriture", patterns: ["writing", "scribble"] },
  { id: "silence", label: "Ambiance calme", patterns: ["silence", "inside, small room", "quiet"] },
  { id: "noise", label: "Bruit ambiant", patterns: ["noise", "rustling", "shuffle"] }
]);

export function normalizeAudioEvents(categories = [], threshold = 0) {
  const events = new Map();
  categories.forEach((category) => {
    if (category.score < threshold) return;
    const raw = String(category.label).trim().toLowerCase();
    const group = GROUPS.find((candidate) => candidate.patterns.some((pattern) => raw.includes(pattern)));
    if (!group) return;
    const existing = events.get(group.id);
    if (!existing || existing.score < category.score) {
      events.set(group.id, Object.freeze({ id: group.id, label: group.label, score: category.score }));
    }
  });
  return [...events.values()].sort((a, b) => b.score - a.score);
}
