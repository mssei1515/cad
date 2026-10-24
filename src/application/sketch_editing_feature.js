/* Compose Sketch commands with shared scope and readers; each command owns its operation state. */
(() => {
  "use strict";
  function create({ currentScope, sketches, ids, selection, geometryReads, projections, constraintReferences,
    clearInteractionForSketchChange, clearSelection, applicationText, setHint, updateUI, draw, recordHistory,
    promptName, effectiveAppearanceForElement, clearTreeHover, clearSnap, guardEdit, prepareLockToggle }) {
    const { ensureSketchState, activeSketch, activeSketchId, sketchById, childSketchesOf, sketchName,
      descendantSketchIds, constraintSketchId, elementSketchId, isReferenceSourceSketchId } = sketches;
    const { resolveGeometryRef } = geometryReads;
    const { constraintGraphNodes, geometryInstanceDependencyRefs } = constraintReferences;
    const command = window.SketchCommand.create({
      currentScope, ensureSketchState, activeSketch, activeSketchId, sketchById, childSketchesOf, sketchName,
      nextSketchId: () => ids.allocate("sketch"), clearInteractionForSketchChange, setHint, updateUI, draw, recordHistory,
      promptName, effectiveAppearanceForElement, clearTreeHover, clearSnap, guardEdit, applicationText, prepareLockToggle,
    });
    function createMove({ prepare, refresh, readEditingScope, hatches, rebinding, analysis, refreshReferenceConstraintValidity }) {
      function refreshGeometry() {
        const { invalidateBlockProjectionCache } = projections;
        invalidateBlockProjectionCache();
        geometryReads.clearReadCache();
        hatches.clear();
        const { blockProjectionBundles, geometryInstanceBundles } = geometryReads;
        rebinding.rebuildDocument(readEditingScope(), [...blockProjectionBundles(), ...geometryInstanceBundles()]);
        analysis.invalidate();
        refreshReferenceConstraintValidity();
      }
      const query = window.SketchMove.create({ currentScope, activeSketchId, constraintGraphNodes, constraintSketchId,
        resolveGeometryRef, geometryInstanceDependencyRefs, isReferenceSourceSketchId, applicationText });
      return window.SketchMoveCommand.create({ currentScope, activeSketchId, selection, query, prepare, refresh: refresh === undefined ? refreshGeometry : refresh,
        clearSelection, updateUI, draw, setHint, recordHistory, applicationText });
    }
    function createDeletion({ rejectReferencedGeometryDeletion, log, geometryElementKey, guardDimensionSymbolDeletion,
      annotationReferencesRemovedGeometry, clearSketchSolveState, invalidateAnalysis, solveSketchAndDependents,
      refreshConstraintAnalysis, confirmDeletion }) {
      return window.SketchDeletionCommand.create({ currentScope, ensureSketchState, sketchById, descendantSketchIds,
        constraintSketchId, geometryInstanceDependencyRefs, resolveGeometryRef, elementSketchId, rejectReferencedGeometryDeletion,
        sketchName, setHint, log, blockAllProjectionBundle: projections.blockAllProjectionBundle, geometryElementKey, constraintGraphNodes,
        guardDimensionSymbolDeletion, invalidateBlockProjectionCache: projections.invalidateBlockProjectionCache,
        annotationReferencesRemovedGeometry, clearSketchSolveState, clearInteractionForSketchChange, invalidateAnalysis,
        solveSketchAndDependents, activeSketchId, refreshConstraintAnalysis, updateUI, draw, recordHistory, confirmDeletion });
    }
    function createTree({ readServices, canvasHover, selectionHighlight, objectOptions, document, window: browserWindow,
      applicationSettings, escapeHtml, closeCanvasContextMenu, moveCommand, deletion, getScopeKey, viewScope,
      sketchHasSolveError, referenceConstraintErrorCountForSketch, constraintDuplicateCountForSketch, dimensionScope,
      toggleBlockInstanceSelection, targetFromConstraint, updateSketchUI, selectionSketchId, deleteElements,
      deleteCurrentSelection, toggleSelectedVisibility, updateSelectionUI, unfixPoint }) {
      return window.SketchTreeController.createWithDocumentObjects({
        readServices, canvasHover, selectionHighlight, objectOptions, document, window: browserWindow,
        sketchContext: sketches, applicationSettings, escapeHtml, closeCanvasContextMenu, ensureSketchState, moveCommand,
        getScopeKey, viewScope, sketchHasSolveError, referenceConstraintErrorCountForSketch, constraintDuplicateCountForSketch,
        currentScope: dimensionScope, setActiveSketch: command.activate, clearSelection, canvasSelection: selection,
        toggleBlockInstanceSelection, targetFromConstraint, updateUI, draw, updateSketchUI,
        toggleSketchVisibility: command.toggleVisibility, toggleSketchLock: command.toggleLock, guardSketchEdit: guardEdit,
        selectionSketchId, renameSketch: command.rename, deleteSketch: deletion.remove, deleteElements,
        deleteCurrentSelection, toggleSelectedVisibility, hover: { elementSketchId, ROOT_SKETCH_ID: window.SketchHierarchy.ROOT_SKETCH_ID },
        updateSelectionUI, unfixPoint,
      });
    }
    return Object.freeze({ command, createMove, createDeletion, createTree });
  }
  window.SketchEditingFeature = Object.freeze({ create });
})();
