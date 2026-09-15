/* Independent history stacks. Snapshot and restoration policies belong to the caller. */
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

  function create({ capture, signature, restore, limit, recordLabel, undoLabel, redoLabel }) {
    let undoSnapshots = [];
    let redoSnapshots = [];
    function protocol() {
      return {
        undo: undoSnapshots, redo: redoSnapshots, capture, signature, restore,
        clearRedo: () => { redoSnapshots = []; }, undoLabel, redoLabel,
      };
    }
    function reset() {
      undoSnapshots = [capture()];
      redoSnapshots = [];
    }
    // A canceled transient operation may remove only its own committed snapshot.
    function discardLatest(expectedSnapshot) {
      if (undoSnapshots.length <= 1 || undoSnapshots.at(-1) !== expectedSnapshot) return false;
      undoSnapshots.pop();
      redoSnapshots = [];
      return true;
    }
    return Object.freeze({
      record: () => record(protocol(), limit),
      undo: () => undo(protocol()),
      redo: () => redo(protocol()),
      reset, discardLatest, recordLabel,
      get currentSnapshot() { return undoSnapshots.at(-1); },
      get undoCount() { return undoSnapshots.length; },
      get redoCount() { return redoSnapshots.length; },
    });
  }

  window.EditHistory = Object.freeze({ create, record, undo, redo });
})();
