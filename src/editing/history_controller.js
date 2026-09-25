/* Route history operations to the current editing scope and guard restoration. */
(() => {
  "use strict";
  function create({ documentHistory, currentBlockHistory, changed, log }) {
    let restoring = false;
    function active() { return currentBlockHistory() || documentHistory; }
    function resetDocument(label = "initial") {
      documentHistory.reset();
      changed();
      log(`履歴を初期化しました: ${label}`);
    }
    function resetBlock() {
      const history = currentBlockHistory();
      if (!history) return;
      history.reset();
      changed();
    }
    function record(label = "変更") {
      if (restoring) return;
      const history = active();
      const recorded = history.record();
      changed();
      if (recorded) log(`${history.recordLabel}: ${label}`);
    }
    function restore(action) {
      restoring = true;
      try { return action(); }
      finally { restoring = false; changed(); }
    }
    return Object.freeze({ active, resetDocument, resetBlock, record, restore,
      undo: () => active().undo(), redo: () => active().redo(),
      get restoring() { return restoring; } });
  }
  window.HistoryController = Object.freeze({ create });
})();
