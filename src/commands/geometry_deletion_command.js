/* Coordinate guarded geometry deletion, selection cleanup, solve and history. */
(() => {
  "use strict";
  function create({ currentScope, geometryDeletion, canvasSelection, splineEditing, canvasHover,
    guardSketchEdit, elementSketchId, geometryElementKey, geometryInstanceUsesRemovedGeometry,
    rejectReferencedGeometryDeletion, annotationReferencesRemovedGeometry, guardDimensionSymbolDeletion,
    applicationText, solveSketchAndDependents, normalizeArcSweeps, refreshView,
    analysisStable, setHint, log, recordHistory, resetGeometryDrag, resetDimensionDrag, resetAnnotationDrag,
    pendingCommandSession, constraintTargetSession, lineCommand, circularCommands, drawingPreview, selectMode }) {
    function endInteraction() {
      resetGeometryDrag();
      resetDimensionDrag();
      resetAnnotationDrag();
      pendingCommandSession.clear();
      constraintTargetSession.clearCommand();
      lineCommand.reset();
      circularCommands.resetCircle();
      circularCommands.resetArcs();
      drawingPreview.setPointer(null);
      selectMode();
    }
    function remove({ points = [], lines = [], circles = [], arcs = [], splines = [], constraints = [] } = {}) {
      if (![...points, ...lines, ...circles, ...arcs, ...splines, ...constraints].every(item => guardSketchEdit(elementSketchId(item)))) return false;
      const ownerIds = [...new Set([...points, ...lines, ...circles, ...arcs, ...splines, ...constraints].map(elementSketchId))];
      const model = currentScope();
      const deletionPlan = geometryDeletion.plan(model, { points, lines, circles, arcs, splines, constraints });
      const { pointSet, lineSet, circleSet, arcSet, splineSet, constraintSet } = deletionPlan;

      const removedKeysForDependency = new Set([...pointSet, ...lineSet, ...circleSet, ...arcSet, ...splineSet].map(geometryElementKey).filter(Boolean));
      const dependentInstances = model.geometryInstances.filter((instance) => geometryInstanceUsesRemovedGeometry(instance, removedKeysForDependency));
      if (rejectReferencedGeometryDeletion(dependentInstances, applicationText("選択したGeometry", "the selected geometry"))) return false;
      if (pointSet.size === 0 && lineSet.size === 0 && circleSet.size === 0 && arcSet.size === 0 && splineSet.size === 0 && constraintSet.size === 0) return false;
      const removedAnnotationsForSymbols = model.annotations.filter(annotation => annotationReferencesRemovedGeometry(annotation, new Set([...pointSet, ...lineSet, ...circleSet, ...arcSet, ...splineSet].map(item => item.id)), removedKeysForDependency));
      if (!guardDimensionSymbolDeletion([...constraintSet, ...removedAnnotationsForSymbols])) return false;

      endInteraction();

      geometryDeletion.apply(model, deletionPlan);
      canvasSelection.discardDeletedGeometry(deletionPlan, model.annotations);
      splineEditing.forgetDeleted(splineSet);
      canvasSelection.discardDeletedConstraints(constraintSet);
      if (constraintSet.has(canvasHover.current.dimension)) canvasHover.update({ dimension: null });

      const results = ownerIds.map(id => solveSketchAndDependents(id));
      const result = { success: results.every(entry => entry.success), errorNorm: Math.max(0, ...results.map(entry => entry.result?.errorNorm || 0)) };
      normalizeArcSweeps();
      refreshView();
      const msg = `削除しました: 点${pointSet.size} / 線${lineSet.size} / 円${circleSet.size} / 円弧${arcSet.size} / スプライン${splineSet.size} / 拘束${constraintSet.size}`;
      const stable = result.success && analysisStable();
      setHint(stable ? msg : `${msg}。拘束状態を確認してください`, stable ? "normal" : "error");
      log(`${msg}\n自動solve: success=${result.success}, error=${result.errorNorm.toExponential(3)}`);
      recordHistory("削除");
      return true;
    }

    return Object.freeze({ remove });
  }
  window.GeometryDeletionCommand = Object.freeze({ create });
})();
