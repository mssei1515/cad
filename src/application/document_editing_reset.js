/* Coordinate new-document editing reset; each component retains its own state. */
(() => {
  "use strict";
  function prepare() {
    let published;
    function createWorkspace(options) {
      const completed = window.DocumentEditingReset.createForWorkspace(...arguments);
      published = Object.freeze({ value: completed });
      return completed;
    }
    function resetModelState() {
      if (published === undefined) throw new ReferenceError("Cannot access 'documentEditingReset' before initialization");
      const documentEditingReset = published.value;
      return documentEditingReset.reset();
    }
    return Object.freeze({ createForWorkspace: createWorkspace, reset: resetModelState });
  }
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
  function createForWorkspace({ documentWorkspace, readServices, interaction, sessions, blocks, constraints, editingScope,
    activateEditingScope = (...args) => editingScope.activate(...args), ...options }) {
    return create({ ...options, documentModel: documentWorkspace.document,
      geometryIds: documentWorkspace.geometryIds, documentIds: documentWorkspace.documentIds,
      invalidateBlockProjectionCache: readServices.projections.invalidateBlockProjectionCache, hatchGeometryQuery: readServices.hatches,
      drawOperationLifecycle: interaction.lifecycle, selectMode: interaction.lifecycle.selectMode,
      pendingCommandSession: sessions.pending, constraintTargetSession: sessions.targets,
      blockEditor: blocks.session, clearAuthoringPerformance: constraints.clearPerformance, activateEditingScope });
  }
  window.DocumentEditingReset = Object.freeze({ prepare, create, createForWorkspace });
})();
