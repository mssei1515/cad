/* Own transient Canvas display options and their control bindings. */
(() => {
  "use strict";
  function create({ document, window: browserWindow, setHint, draw }) {
    const values = { constraintStatus: false, geometryIds: false, showHiddenElements: false };
    const constraintStatus = window.ConstraintStatusView.create({
      viewState: values, button: document.getElementById("constraintStatusViewBtn"),
      menuInput: document.getElementById("viewConstraintStatusInput"), setHint, draw,
    });
    const state = Object.freeze({
      get constraintStatus() { return values.constraintStatus; },
      get geometryIds() { return values.geometryIds; },
      get showHiddenElements() { return values.showHiddenElements; },
    });
    let windowBound = false, controlsBound = false;
    const removers = [];
    function listen(target, type, handler) {
      if (!target) return;
      target.addEventListener(type, handler);
      removers.push(() => target.removeEventListener(type, handler));
    }
    function bindWindow() {
      if (windowBound) return;
      windowBound = true;
      listen(browserWindow, "keyup", constraintStatus.release);
      listen(browserWindow, "blur", constraintStatus.blur);
    }
    function bindControls() {
      if (controlsBound) return;
      controlsBound = true;
      listen(document.getElementById("constraintStatusViewBtn"), "click", () => { constraintStatus.toggle(); });
      listen(document.getElementById("viewConstraintStatusInput"), "change", event => { constraintStatus.setLatched(event.target.checked); });
      listen(document.getElementById("viewShowHiddenElementsInput"), "change", event => {
        values.showHiddenElements = event.target.checked;
        draw();
      });
      listen(document.getElementById("viewGeometryIdsInput"), "change", event => {
        values.geometryIds = event.target.checked;
        draw();
      });
    }
    function dispose() {
      for (const remove of removers.splice(0)) remove();
      windowBound = controlsBound = false;
    }
    return Object.freeze({ state, constraintStatus, bindWindow, bindControls, dispose });
  }
  window.CanvasViewControls = Object.freeze({ create });
})();
