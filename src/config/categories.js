export const CATEGORIES = Object.freeze([
  {
    id: "tables",
    label: "Tables et bureaux",
    cocoClass: "dining table",
    supported: true,
    exampleExpected: 10,
    color: "#d97706",
    limitation: "La classe « dining table » est une approximation des tables et bureaux de cours."
  },
  {
    id: "chairs",
    label: "Chaises",
    cocoClass: "chair",
    supported: true,
    exampleExpected: 20,
    color: "#20c7b5",
    limitation: "La visibilité et l’occlusion peuvent réduire le nombre détecté."
  },
  {
    id: "board",
    label: "Tableau",
    cocoClass: null,
    supported: false,
    exampleExpected: 1,
    color: "#667085",
    limitation: "COCO-SSD ne prend pas en charge les tableaux."
  },
  {
    id: "laptops",
    label: "Ordinateurs portables",
    cocoClass: "laptop",
    supported: true,
    exampleExpected: 5,
    color: "#5570d6",
    limitation: "Seuls les ordinateurs portables suffisamment visibles peuvent être reconnus."
  },
  {
    id: "screens",
    label: "Écrans",
    cocoClass: "tv",
    supported: true,
    exampleExpected: 0,
    color: "#9b5de5",
    limitation: "La classe « tv » est une approximation des écrans et moniteurs."
  },
  {
    id: "windows",
    label: "Fenêtres",
    cocoClass: null,
    supported: false,
    exampleExpected: 0,
    color: "#8a96a8",
    limitation: "COCO-SSD ne prend pas en charge les fenêtres."
  }
]);

export const CATEGORY_BY_CLASS = new Map(
  CATEGORIES.filter((category) => category.cocoClass).map((category) => [category.cocoClass, category])
);

export const EPITA_EXAMPLE_EXPECTED = Object.freeze(
  Object.fromEntries(CATEGORIES.map((category) => [category.id, category.exampleExpected]))
);

export const EMPTY_EXPECTED = Object.freeze(
  Object.fromEntries(CATEGORIES.map((category) => [category.id, null]))
);
