/* Compose deletion and Clipboard over the same selection; each operation keeps its own scope rules. */
(() => {
  "use strict";
  function prepare() {
    let clipboardCommand;
    function readCommand() {
      if (clipboardCommand === undefined) throw new ReferenceError("Cannot access 'clipboardCommand' before initialization");
      return clipboardCommand;
    }
    function createPreparedFeature(options) {
      const completed = window.SelectionEditingFeature.createForEditing(options);
      clipboardCommand = completed.clipboard.command;
      return completed;
    }
    function createForDrawing({ drawing, ...options }) {
      const defaults = { resetDrawing: drawing.resetForDeletion };
      if (!("clearSelection" in options)) defaults.clearSelection = options.interaction.clearSelection;
      if (!("isGeometryMode" in options)) defaults.isGeometryMode = options.interaction.isGeometryMode;
      if (!("updateToolbar" in options)) defaults.updateToolbar = options.presentation.updateToolbar;
      if (!("normalizeGeometryInstance" in options)) defaults.normalizeGeometryInstance = options.persistence.normalizeGeometryInstance;
      return createPreparedFeature({ ...defaults, ...options });
    }
    function copySelectionToClipboard(options = {}) { return readCommand().copy(options); }
    function pasteGeometryClipboard() { return readCommand().paste(); }
    return Object.freeze({ createForEditing: createPreparedFeature, createForDrawing, copy: copySelectionToClipboard, paste: pasteGeometryClipboard });
  }
  function createForEditing({ documentWorkspace, editingScope, readServices, interaction, references, geometry,
    annotationFeature, annotationLeaderAnchor, splineEditing, guardDimensionSymbolDeletion, sessions, lineCommand, circularCommands,
    solving, analysis, presentation, updateToolbar, recordHistory, referenceImageInteraction, clearSelection, solveAndRefresh,
    resetGeometryDrag, resetDimensionDrag, resetAnnotationDrag, viewport, persistence, normalizeGeometryInstance, blocks,
    pasteOffsetScreenPx = 24, imageClipboard, isGeometryMode, resetDrawing }) {
    const deletion = window.DeletionFeature.createForEditing({
      documentWorkspace, readServices, interaction, references, annotationDimensions: annotationFeature.dimensions,
      splineEditing, guardDimensionSymbolDeletion, geometry, sessions, lineCommand, circularCommands,
      solving, analysis, presentation, updateToolbar, recordHistory, referenceImageInteraction, clearSelection, solveAndRefresh,
      resetGeometryDrag, resetDimensionDrag, resetAnnotationDrag, resetDrawing,
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
  window.SelectionEditingFeature = Object.freeze({ prepare, createForEditing });
})();
