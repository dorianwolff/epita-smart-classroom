export function getElement(selector, root = document) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Élément d’interface introuvable : ${selector}`);
  return element;
}

export function createElement(tag, options = {}) {
  const element = document.createElement(tag);
  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  return element;
}

export function clearElement(element) {
  element.replaceChildren();
}
