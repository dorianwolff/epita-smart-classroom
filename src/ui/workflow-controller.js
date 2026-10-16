const SCREEN_ORDER = ["capture", "analysis", "results", "report"];

export class WorkflowController {
  constructor({ root = document, onNavigate = () => {} } = {}) {
    this.screens = new Map([...root.querySelectorAll("[data-workflow-screen]")]
      .map((element) => [element.dataset.workflowScreen, element]));
    this.buttons = [...root.querySelectorAll("[data-navigate]")];
    this.onNavigate = onNavigate;
    this.current = "capture";
    this.handlePopState = (event) => this.show(event.state?.sallescopeScreen ?? "capture", { history: false });
  }

  start() {
    this.buttons.forEach((button) => button.addEventListener("click", () => this.show(button.dataset.navigate)));
    window.addEventListener("popstate", this.handlePopState);
    this.show(history.state?.sallescopeScreen ?? "capture", { history: false, focus: false });
  }

  show(name, { history: useHistory = true, focus = true } = {}) {
    if (!this.screens.has(name)) return false;
    this.current = name;
    this.screens.forEach((screen, key) => {
      const active = key === name;
      screen.hidden = !active;
      screen.inert = !active;
      screen.setAttribute("aria-hidden", String(!active));
    });
    this.buttons.forEach((button) => {
      const active = button.dataset.navigate === name;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    document.body.dataset.screen = name;
    if (useHistory && history.state?.sallescopeScreen !== name) history.pushState({ sallescopeScreen: name }, "", `#${name}`);
    if (focus) this.screens.get(name).querySelector("h1, h2, [tabindex='-1']")?.focus({ preventScroll: true });
    this.onNavigate(name);
    return true;
  }

  destroy() { window.removeEventListener("popstate", this.handlePopState); }
}

export { SCREEN_ORDER };
