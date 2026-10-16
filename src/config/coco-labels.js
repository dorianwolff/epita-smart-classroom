const LABELS = {
  bicycle: "vélo", car: "voiture", motorcycle: "moto", airplane: "avion", bus: "bus", train: "train",
  truck: "camion", boat: "bateau", "traffic light": "feu de circulation", "fire hydrant": "borne incendie",
  "stop sign": "panneau stop", "parking meter": "horodateur", bench: "banc", bird: "oiseau", cat: "chat",
  dog: "chien", horse: "cheval", sheep: "mouton", cow: "vache", elephant: "éléphant", bear: "ours",
  zebra: "zèbre", giraffe: "girafe", backpack: "sac à dos", umbrella: "parapluie", handbag: "sac à main",
  tie: "cravate", suitcase: "valise", frisbee: "frisbee", skis: "skis", snowboard: "snowboard",
  "sports ball": "ballon", kite: "cerf-volant", "baseball bat": "batte de baseball",
  "baseball glove": "gant de baseball", skateboard: "skateboard", surfboard: "planche de surf",
  "tennis racket": "raquette de tennis", bottle: "bouteille", "wine glass": "verre à pied", cup: "tasse",
  fork: "fourchette", knife: "couteau", spoon: "cuillère", bowl: "bol", banana: "banane", apple: "pomme",
  sandwich: "sandwich", orange: "orange", broccoli: "brocoli", carrot: "carotte", "hot dog": "hot-dog",
  pizza: "pizza", donut: "beignet", cake: "gâteau", couch: "canapé", "potted plant": "plante en pot",
  bed: "lit", toilet: "toilettes", mouse: "souris", remote: "télécommande", keyboard: "clavier",
  "cell phone": "téléphone", microwave: "micro-ondes", oven: "four", toaster: "grille-pain", sink: "évier",
  refrigerator: "réfrigérateur", book: "livre", clock: "horloge", vase: "vase", scissors: "ciseaux",
  "teddy bear": "ours en peluche", "hair drier": "sèche-cheveux", toothbrush: "brosse à dents"
};

export function getCocoLabel(className) {
  return LABELS[className] ?? className;
}
