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
    function createMove({ prepare, refresh }) {
      const query = window.SketchMove.create({ currentScope, activeSketchId, constraintGraphNodes, constraintSketchId,
        resolveGeometryRef, geometryInstanceDependencyRefs, isReferenceSourceSketchId, applicationText });
      return window.SketchMoveCommand.create({ currentScope, activeSketchId, selection, query, prepare, refresh,
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
    return Object.freeze({ command, createMove, createDeletion });
  }
  window.SketchEditingFeature = Object.freeze({ create });
})();
