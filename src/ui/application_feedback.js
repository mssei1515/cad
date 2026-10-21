/* Render application messages; formatting, translation and measurement retain their owners. */
(() => {
  "use strict";
  function create({ document, settings, interactionProfiler, readDuplicateCount }) {
    const { applicationText, translatedHintText } = settings;
    const profileWork = interactionProfiler.work;
    const constraints = window.ConstraintFeedback.create({ applicationText, readLanguage: () => settings.language });
    function log(message) {
      const element = document.getElementById("log");
      if (!element) return;
      element.textContent = `${message}\n` + element.textContent;
    }
    function hintUnprofiled(message, kind = "normal") {
      const element = document.getElementById("hint");
      element.dataset.hintSource = String(message);
      element.textContent = translatedHintText(message);
      element.classList.toggle("error", kind === "error");
    }
    function hint(message, kind = "normal") {
      if (!interactionProfiler.active) return hintUnprofiled(message, kind);
      return profileWork("ui", () => hintUnprofiled(message, kind));
    }
    function solveResult(label, solved, analysis, dependent) {
      const result = constraints.resultHint(label, solved, analysis, dependent, readDuplicateCount());
      hint(result.message, result.kind);
    }
    return Object.freeze({ log, hint, solveResult, constraints });
  }
  window.ApplicationFeedback = Object.freeze({ create });
})();
