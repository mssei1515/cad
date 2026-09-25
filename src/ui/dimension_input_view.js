/* DOM presentation for an inline dimension value; no command or model access. */
(() => {
  "use strict";
  function create({ input, shell, screenPxPerMm, syncHighlight, scheduleFrame }) {
    function hide() {
      if (!input) return;
      if (shell?.hidden === false) shell.hidden = true;
      if (input.hidden === false) input.hidden = true;
      if (input.classList.contains("is-invalid")) input.classList.remove("is-invalid");
    }
    function render({ screen, angle, labelOffset, textHeight, buffer }) {
      if (!input) return;
      const inputHost = shell || input;
      inputHost.hidden = false;
      input.hidden = false;
      inputHost.style.left = `${screen.x + labelOffset.x}px`;
      inputHost.style.top = `${screen.y + labelOffset.y}px`;
      inputHost.style.setProperty("--dimension-text-angle", `${angle}rad`);
      inputHost.style.fontSize = `${Math.max(8, textHeight * screenPxPerMm)}px`;
      inputHost.style.width = `${Math.max(132, Math.min(280, buffer.length * 9 + 34))}px`;
      if (input.value !== buffer) input.value = buffer;
    }
    function setInvalid(invalid) {
      if (!input) return;
      input.classList.toggle("is-invalid", invalid);
      syncHighlight(input);
    }
    function focus(synchronize) {
      scheduleFrame(() => {
        synchronize();
        if (input?.hidden === false) { input.focus(); input.select(); }
      });
    }
    return Object.freeze({ hide, render, setInvalid, focus });
  }
  window.DimensionInputView = Object.freeze({ create });
})();
