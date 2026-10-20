/* Coordinate new-document editing reset; each component retains its own state. */
(() => {
  "use strict";
  function create({ documentModel, sketchMoveCommand, activateEditingScope, flushPointerMoves, selectMode, clearAuthoringPerformance,
    referenceImageRenderer, invalidateBlockProjectionCache, sketchSolving, referenceConstraintState, constraintAnalysis,
    clearSelection, geometryDrag, dimensionDrag, referenceImageInteraction, canvasNavigation, blankCanvasGesture,
    drawOperationLifecycle, pendingCommandSession, constraintTargetSession, constructionCommand, documentCanvasReset,
    geometryIds, documentIds, blockPlacementCommand, blockEditor, hatchCommand, hatchGeometryQuery, sketchTreeView, annotationDrag }) {
    function reset() {
      sketchMoveCommand?.reset();
      activateEditingScope(documentModel);
      flushPointerMoves({ discard: true });
      selectMode();
      clearAuthoringPerformance();
      window.DocumentState.clearContent(documentModel);
      referenceImageRenderer.clear();
      invalidateBlockProjectionCache();
      sketchSolving.clearAll();
      referenceConstraintState.clear();
      constraintAnalysis.invalidate();
      clearSelection();
      geometryDrag.reset();
      dimensionDrag.reset();
      referenceImageInteraction.reset();
      canvasNavigation.reset();
      blankCanvasGesture.clearSuppression();
      drawOperationLifecycle.resetForDocument();
      pendingCommandSession.clear();
      constraintTargetSession.reset();
      constructionCommand.restore(false);
      documentCanvasReset.reset();
      geometryIds.reset();
      documentIds.reset();
      blockPlacementCommand.reset();
      blockEditor.reset();
      window.DocumentState.resetDefaults(documentModel);
      hatchCommand.reset();
      hatchGeometryQuery.clear();
      sketchTreeView.reset();
      annotationDrag.reset();
      referenceImageInteraction.reset();
    }
    return Object.freeze({ reset });
  }
  window.DocumentEditingReset = Object.freeze({ create });
})();
