/* Own the shared pending operation and its cancellation routing; specialized drafts remain command-owned. */
(() => {
  "use strict";
  function create({ clearPlacement, cancelAnnotation, cancelPngExport, resetOffset, clearPreviewPointer,
    hideInput, setHint, updateToolbar, updateConstraintButtons, draw }) {
    let current = null;
    function cancel(message = "コマンドをキャンセルしました") {
      clearPlacement();
      if (!current) return;
      if (current.annotationDraft) { cancelAnnotation(); return; }
      if (current.type === "png-export") { cancelPngExport(); return; }
      if (current.type === "offset-value") {
        resetOffset();
        clearPreviewPointer();
      }
      current = null;
      hideInput();
      if (message) setHint(message);
      updateToolbar();
      updateConstraintButtons();
      draw();
    }

    function read() { return current; }
    function replace(command) { current = command; }
    function clear() { current = null; }
    return Object.freeze({ get current() { return current; }, read, replace, clear, cancel });
  }
  window.PendingCommandSession = Object.freeze({ create });
})();
