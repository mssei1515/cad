/* Reflect and bind constraint/Fix controls; command decisions and selection state are caller-owned. */
(() => {
  "use strict";
  function createFeedback({ constraintButtons, applicationText, feedback, readOperands, readLanguage }) {
    function label(type) {
      if (type === "fixed") return applicationText("固定", "Fix");
      const btn = constraintButtons.find((b) => b.dataset.constraint === type);
      return btn?.dataset.label || btn?.title || type;
    }
    function targetHint(type) { return feedback.targetHint(type, readOperands(), readLanguage(), () => label(type)); }
    function invalidTargetHint(type) { return feedback.invalidTargetHint(type, readOperands(), readLanguage()); }
    return Object.freeze({ label, targetHint, invalidTargetHint });
  }
  function create({ document, constraintButtons, constraintMenuButtons, fixPointBtn, isGeometryMode,
    prepareGeometryControls, getCommandType, fixedToggleAllowed, hasSelection, translatedExactText, applicationText }) {
    function update() {
      if (!isGeometryMode()) {
        for (const btn of constraintButtons) {
          btn.classList.remove("active");
          btn.setAttribute("aria-disabled", "true");
          btn.setAttribute("aria-pressed", "false");
        }
        for (const btn of constraintMenuButtons) {
          btn.classList.remove("active");
          btn.setAttribute("aria-disabled", "true");
          btn.setAttribute("aria-pressed", "false");
        }
        fixPointBtn?.setAttribute("aria-disabled", "true");
        fixPointBtn?.setAttribute("aria-pressed", "false");
        fixPointBtn?.classList.remove("active");
        return;
      }
      prepareGeometryControls();

      for (const btn of constraintButtons) {
        btn.setAttribute("aria-disabled", "false");
        const active = getCommandType() === btn.dataset.constraint;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", String(active));
      }
      for (const btn of constraintMenuButtons) {
        const type = btn.dataset.menuConstraint;
        const source = type === "fixed"
          ? fixPointBtn
          : constraintButtons.find((candidate) => candidate.dataset.constraint === type);
        const disabled = source?.getAttribute("aria-disabled") === "true";
        const active = source?.getAttribute("aria-pressed") === "true";
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-disabled", String(disabled));
        btn.setAttribute("aria-pressed", String(active));
      }
      const canToggleFixed = fixedToggleAllowed();
      const fixedCommandActive = getCommandType() === "fixed";
      fixPointBtn.setAttribute("aria-disabled", String(!canToggleFixed && hasSelection() && !fixedCommandActive));
      fixPointBtn.classList.toggle("active", fixedCommandActive);
      fixPointBtn.setAttribute("aria-pressed", String(fixedCommandActive));

      const enabled = constraintButtons
        .filter((btn) => btn.getAttribute("aria-disabled") !== "true")
        .map((btn) => translatedExactText(btn.dataset.label || btn.title));
      const help = enabled.length > 0
        ? `${applicationText("追加可能", "Available")}: ${enabled.join(" / ")}`
        : applicationText("点または線を選択すると、追加できる拘束だけが有効になります。", "Select points or lines to enable applicable constraints.");
      document.getElementById("hint").title = help;
    }

    return Object.freeze({ update });
  }
  function createBinding({ constraintButtons, constraintMenuButtons, fixPointBtn, onConstraint, onFixed }) {
    let bound = false;
    const removers = [];
    function listen(button, handler) {
      button.addEventListener("click", handler);
      removers.push(() => button.removeEventListener("click", handler));
    }
    function bind() {
      if (bound) return;
      bound = true;
      for (const btn of constraintButtons) listen(btn, () => onConstraint(btn.dataset.constraint));
      for (const btn of constraintMenuButtons) {
        listen(btn, () => {
          const type = btn.dataset.menuConstraint;
          const target = type === "fixed"
            ? fixPointBtn
            : constraintButtons.find((candidate) => candidate.dataset.constraint === type);
          target?.click();
          btn.closest("details")?.removeAttribute("open");
        });
      }
      listen(fixPointBtn, onFixed);
    }
    function dispose() {
      for (const remove of removers.splice(0)) remove();
      bound = false;
    }
    return Object.freeze({ bind, dispose });
  }

  window.ConstraintControlsView = Object.freeze({ create, createBinding, createFeedback });
})();
