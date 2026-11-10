/* Compose deletion and Clipboard over the same selection; each operation keeps its own scope rules. */
(() => {
  "use strict";
  function createForEditing({ documentWorkspace, editingScope, readServices, interaction, references, geometry,
    annotationFeature, annotationLeaderAnchor, splineEditing, guardDimensionSymbolDeletion, sessions, lineCommand, circularCommands,
    solving, analysis, presentation, updateToolbar, recordHistory, referenceImageInteraction, clearSelection, solveAndRefresh,
    resetGeometryDrag, resetDimensionDrag, resetAnnotationDrag, viewport, persistence, normalizeGeometryInstance, blocks,
    pasteOffsetScreenPx, imageClipboard, isGeometryMode }) {
    const deletion = window.DeletionFeature.createForEditing({
      documentWorkspace, readServices, interaction, references, annotationDimensions: annotationFeature.dimensions,
      splineEditing, guardDimensionSymbolDeletion, geometry, sessions, lineCommand, circularCommands,
      solving, analysis, presentation, updateToolbar, recordHistory, referenceImageInteraction, clearSelection, solveAndRefresh,
      resetGeometryDrag, resetDimensionDrag, resetAnnotationDrag,
    });
    const clipboard = window.ClipboardFeature.createForEditing({
      documentWorkspace, editingScope, readServices, interaction, geometry, annotationRenderer: annotationFeature.renderer,
      references, annotationLeaderAnchor, viewport, serializeConstraint: persistence.serializeConstraint,
      decorateSerializedConstraint: persistence.decorateSerializedConstraint, normalizeGeometryInstance, deserializeConstraint: persistence.deserializeConstraint,
      blockScopeId: blocks.session.scopeId, blockDefinitionScopeError: blocks.queries.blockDefinitionScopeError, presentation,
      pasteOffsetScreenPx, imageClipboard, updateToolbar, deleteSelection: deletion.removeSelection,
      isGeometryMode, clearSelection, solveAndRefresh,
    });
    return Object.freeze({ deletion, clipboard });
  }
  window.SelectionEditingFeature = Object.freeze({ createForEditing });
})();
