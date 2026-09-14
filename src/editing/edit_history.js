/* Shared stack operations. Snapshot and restoration policies belong to the caller. */
(function () {
  "use strict";

  function record(history, limit) {
    const snapshot = history.capture();
    if (history.signature(history.undo.at(-1)) === history.signature(snapshot)) return false;
    history.undo.push(snapshot);
    if (history.undo.length > limit) history.undo.shift();
    history.clearRedo();
    return true;
  }

  function undo(history) {
    if (history.undo.length <= 1) return false;
    history.redo.push(history.undo.pop());
    return history.restore(history.undo.at(-1), history.undoLabel);
  }

  function redo(history) {
    if (history.redo.length === 0) return false;
    const snapshot = history.redo.pop();
    history.undo.push(snapshot);
    return history.restore(snapshot, history.redoLabel);
  }

  window.EditHistory = Object.freeze({ record, undo, redo });
})();
