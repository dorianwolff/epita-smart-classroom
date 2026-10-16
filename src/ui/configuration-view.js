import { clearElement, createElement } from "../utils/dom.js";

export function renderConfiguration(container, categories, expectedConfiguration, onChange) {
  clearElement(container);
  categories.forEach((category) => {
    const card = createElement("article", { className: "config-card" });
    const title = createElement("div", { className: "config-title" });
    const dot = createElement("span", { className: "config-dot" });
    dot.style.setProperty("--category-color", category.color);
    title.append(dot, createElement("strong", { text: category.label }));

    const label = createElement("label", { text: "Quantité attendue" });
    const input = createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.value = expectedConfiguration[category.id];
    input.id = `expected-${category.id}`;
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("aria-describedby", `limitation-${category.id}`);
    label.htmlFor = input.id;
    input.addEventListener("change", () => {
      const value = Math.max(0, Math.trunc(Number(input.value) || 0));
      input.value = value;
      onChange(category.id, value);
    });

    const limitation = createElement("p", { text: category.limitation });
    limitation.id = `limitation-${category.id}`;
    card.append(title, label, input, limitation);
    container.append(card);
  });
}
