/* Copy/cut retention and stepped paste placement. No model, DOM or history ownership. */
(() => {
  "use strict";
  function create({ pasteOffsetScreenPx, onCopyStored, deleteSelection }) {
    let payload = null;
    function count(value = payload) {
      if (!value) return 0;
      return value.points.length + value.lines.length + value.circles.length + value.arcs.length + (value.splines?.length || 0) + value.blockInstances.length + (value.hatches?.length || 0) + (value.annotations?.length || 0) + (value.referenceImages?.length || 0) + (value.geometryInstances?.length || 0);
    }
    function copy(value, cut = false) {
      if (!value) return false;
      payload = value;
      payload.cut = Boolean(cut);
      onCopyStored();
      // A rejected deletion still leaves a pasteable cut payload, as before.
      return cut ? deleteSelection() : true;
    }
    function preparePaste(scale) {
      if (!payload) return null;
      const pasteNumber = payload.pasteCount + 1;
      const offset = (pasteOffsetScreenPx * pasteNumber) / scale;
      return Object.freeze({ payload, pasteNumber, dx: offset, dy: offset });
    }
    function recordPaste(plan) {
      // The caller records before solve/refresh. Its rollback does not undo this count.
      plan.payload.pasteCount = plan.pasteNumber;
    }
    function clear() { payload = null; }
    // Existing diagnostics supply prepared data directly, preserving its flags and count.
    function replaceForDiagnostics(value) { payload = value; }
    return Object.freeze({ get payload() { return payload; }, count, copy, preparePaste, recordPaste, clear, replaceForDiagnostics });
  }
  window.ClipboardSession = Object.freeze({ create });
})();
