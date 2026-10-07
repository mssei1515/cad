/* Restore document or block history while preserving their distinct state boundaries. */
(() => {
  "use strict";
  function create({ historyController, document, constructionCommand, blockEditor, cloneBlockDefinition,
    invalidateBlockProjectionCache, clearInteractionForSketchChange, solveAndRefresh, setHint }) {
    function restoreHistorySnapshot(snapshot, label) {
      const constructionModeBeforeRestore = constructionCommand.enabled;
      const documentNameBeforeRestore = document.getName();
      return historyController.restore(() => {
        document.load(JSON.parse(snapshot), { documentNameFallback: documentNameBeforeRestore, preserveSketchTreeState: true });
        document.setName(documentNameBeforeRestore);
        constructionCommand.restore(constructionModeBeforeRestore);
        clearInteractionForSketchChange();
        solveAndRefresh(label);
        setHint(label);
      });
    }
  
    function restoreBlockEditorHistorySnapshot(snapshot, label) {
      if (!blockEditor.current || !snapshot?.definition) return false;
      return historyController.restore(() => {
        const restored = cloneBlockDefinition(snapshot.definition);
        blockEditor.replaceDraft(restored);
        invalidateBlockProjectionCache();
        clearInteractionForSketchChange();
        solveAndRefresh(label);
        setHint(label);
        return true;
      });
    }
    return Object.freeze({ document: restoreHistorySnapshot, block: restoreBlockEditorHistorySnapshot });
  }
  window.HistoryRestoration = Object.freeze({ create });
})();
