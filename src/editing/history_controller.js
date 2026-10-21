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
  function createFeature({ serializeDocument, document, blockEditor, liveBlockDefinition, cloneBlockDefinition,
    serializeConstraint, decorateSerializedConstraint, constructionCommand, invalidateBlockProjectionCache,
    clearInteractionForSketchChange, solveAndRefresh, setHint, changed, log, limit, interactionProfiler }) {
    function captureDocument() {
      const data = serializeDocument();
      delete data.savedAt;
      delete data.documentName;
      return JSON.stringify(data);
    }
    const documentHistory = window.EditHistory.create({
      capture: captureDocument, signature: snapshot => snapshot,
      restore: (snapshot, label) => { restoration.document(snapshot, label); return true; },
      limit, recordLabel: "履歴に追加しました", undoLabel: "戻る", redoLabel: "進む",
    });
    const controller = create({ documentHistory, currentBlockHistory: () => blockEditor.current?.history, changed, log });
    const blockSnapshot = window.BlockHistorySnapshot.create({ cloneDefinition: cloneBlockDefinition, serializeConstraint, decorateSerializedConstraint });
    const restoration = window.HistoryRestoration.create({ historyController: controller, document, constructionCommand, blockEditor,
      cloneBlockDefinition, invalidateBlockProjectionCache, clearInteractionForSketchChange, solveAndRefresh, setHint });
    function createBlockHistory() {
      return window.EditHistory.create({
        capture: () => blockSnapshot.capture(liveBlockDefinition()), signature: snapshot => snapshot?.signature, restore: restoration.block,
        limit, recordLabel: "ブロック編集履歴に追加しました", undoLabel: "ブロック編集を戻す", redoLabel: "ブロック編集を進む",
      });
    }
    const profileWork = interactionProfiler.work;
    function record(label = "変更") {
      if (!interactionProfiler.active) return controller.record(label);
      return profileWork("history", () => controller.record(label));
    }
    return Object.freeze({ documentHistory, controller, restoration, captureDocument, createBlockHistory, record });
  }
  window.HistoryController = Object.freeze({ create, createFeature });
})();
