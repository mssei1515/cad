/* Compose geometry and mixed-selection deletion around shared guards and queries. */
(() => {
  "use strict";
  function create({ currentScope, pointUsage, constraintReferencesPoint, constraintReferencesLine, constraintReferencesPrimitive,
    geometryElementKey, annotationReferencesRemovedGeometry, geometryInstanceBundle, blockAllProjectionBundle, constraintGraphNodes,
    annotationDimensions, canvasSelection, splineEditing, canvasHover, guardSketchEdit, elementSketchId,
    geometryInstanceDependencyRefs, geometryRefKey, guardDimensionSymbolDeletion, applicationText,
    resetGeometryDrag, resetDimensionDrag, resetAnnotationDrag, pendingCommandSession, constraintTargetSession,
    lineCommand, circularCommands, drawingPreview, selectMode, solveSketchAndDependents, normalizeArcSweeps,
    updateToolbar, updateUI, draw, analysisStable, setHint, log, recordHistory,
    referenceImageInteraction, guardSelectionEdit, selectionSketchId, activeSketchId, geometryRefForItem,
    invalidateBlockProjectionCache, effectiveSelectedConstraint, clearSelection, solveAndRefresh }) {
    function usesRemovedGeometry(instance, removedKeys = new Set(), removedOwnerIds = new Set()) {
      return geometryInstanceDependencyRefs(instance).some(ref => removedKeys.has(geometryRefKey(ref)) || removedOwnerIds.has(ref.path?.[0]));
    }
    function rejectReferences(instances, label) {
      if (instances.length === 0) return false;
      const ids = instances.map(instance => instance.id).join(", ");
      const message = applicationText(`削除できません: ${label} は派生インスタンス ${ids} から参照されています。先に依存インスタンスを削除してください`, `Cannot delete ${label}; it is referenced by derived instance(s) ${ids}. Delete the dependent instance(s) first.`);
      setHint(message, "error");
      log(message);
      return true;
    }
    const { isPointUsedByLine, isPointUsedByCircle, isPointUsedByArc, isPointUsedBySpline } = pointUsage;
    const geometry = window.GeometryDeletion.create({
      isPointUsedByLine, isPointUsedByCircle, isPointUsedByArc, isPointUsedBySpline,
      constraintReferencesPoint, constraintReferencesLine, constraintReferencesPrimitive,
      geometryElementKey, annotationReferencesRemovedGeometry, geometryInstanceBundle, blockAllProjectionBundle, constraintGraphNodes,
      removeAnnotationConstraint: constraint => annotationDimensions.remove(constraint),
    });
    const geometryCommand = window.GeometryDeletionCommand.create({
      currentScope, geometryDeletion: geometry, canvasSelection, splineEditing, canvasHover,
      guardSketchEdit, elementSketchId, geometryElementKey, geometryInstanceUsesRemovedGeometry: usesRemovedGeometry,
      rejectReferencedGeometryDeletion: rejectReferences, annotationReferencesRemovedGeometry, guardDimensionSymbolDeletion, applicationText,
      resetGeometryDrag, resetDimensionDrag, resetAnnotationDrag, pendingCommandSession, constraintTargetSession,
      lineCommand, circularCommands, drawingPreview, selectMode, solveSketchAndDependents, normalizeArcSweeps,
      refreshView: () => { updateToolbar(); updateUI(); draw(); }, analysisStable, setHint, log, recordHistory,
    });
    function remove(options) { return geometryCommand.remove(options); }
    const selectionCommand = window.SelectionDeletionCommand.create({
      currentScope, canvasSelection, geometryDeletion: geometry, referenceImageInteraction,
      guardSelectionEdit, selectionSketchId, activeSketchId, geometryRefKey, geometryRefForItem,
      geometryInstanceUsesRemovedGeometry: usesRemovedGeometry, rejectReferencedGeometryDeletion: rejectReferences, guardDimensionSymbolDeletion,
      annotationReferencesRemovedGeometry, invalidateBlockProjectionCache, effectiveSelectedConstraint,
      deleteElements: remove, clearSelection, solveAndRefresh, refreshView: () => { updateUI(); draw(); },
      recordHistory, setHint, applicationText,
    });
    return Object.freeze({ remove, removeSelection: () => selectionCommand.remove(), rejectReferences });
  }
  window.DeletionFeature = Object.freeze({ create });
})();
