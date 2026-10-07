/* Edit the viewport percentage without owning view or document state. */
(() => {
  "use strict";
  function create({ button, input, readPercent, format, applyPercent }) {
    function sync() {
      const text = format();
      if (button.textContent !== text) button.textContent = text;
    }
    function close() {
      input.hidden = true;
      button.hidden = false;
      sync();
    }
    button.addEventListener("click", () => {
      input.value = String(Number(readPercent().toPrecision(15)));
      button.hidden = true;
      input.hidden = false;
      input.focus();
      input.select();
    });
    input.addEventListener("keydown", event => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        button.focus();
      } else if (event.key === "Enter") {
        event.preventDefault();
        const percent = input.valueAsNumber;
        if (!input.checkValidity() || !Number.isFinite(percent)) {
          input.reportValidity();
          return;
        }
        if (applyPercent(percent)) {
          close();
          button.focus();
        }
      }
    });
    input.addEventListener("blur", close);
    return Object.freeze({ sync });
  }
  window.CanvasZoomControl = Object.freeze({ create });
})();
