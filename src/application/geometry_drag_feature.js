/* Compose drag planning, numeric editing and lifecycle without taking over their state. */
(() => {
  "use strict";
  function create({ solver, currentScope, activeSketchId, sketchSolveVariables, sketchSolveConstraints, solveSketchById,
    viewScale, arcEndpointPoint, acceptError, previewMaxModelError,
    elementSketchId, isEditableSketchId, blockDefinitionById, blockLocalGeometryBounds, blockInstanceEnabledSketchSet,
    blockWorldPoint, pointLockedByLineFixed, findLineFixedConstraint, findArcEndpointFixedConstraint,
    arcEndpointDragValue, hypot2, minimumLength, contextFromSeeds, projectionConstraintsForItems, captureValues,
    enforceMinimumLineLengths, normalizeArcSweeps, invalidateBlockProjectionCache, projectionBlockedMessage,
    profileSolve, canEdit, beginPointer, endPointer, canvasSelection, restoreModelState,
    solveReferenceDependentSketches, clearSketchSolveState, stabilizeActiveParameterNamespace, refreshConstraintAnalysis,
    applicationText, setHint, updateUI, updateGeometrySelectionUI, draw, recordHistory,
    geometryInstanceSourceObjects, clearSelection, geometryInstanceSourcePoints, resolveDerivedDragSource }) {
    const dragSolver = window.GeometryDragSolver.create({
      solver, activeSketchId, sketchSolveVariables, sketchSolveConstraints, solveSketchById,
      viewScale, arcEndpointPoint, acceptError, previewMaxModelError,
    });
    const plan = window.GeometryDragPlan.create({
      elementSketchId, isEditableSketchId, activeSketchId, blockDefinitionById, blockLocalGeometryBounds,
      blockInstanceEnabledSketchSet, blockWorldPoint, pointLockedByLineFixed, findLineFixedConstraint,
      findArcEndpointFixedConstraint, arcEndpointPoint, arcEndpointDragValue, hypot2, minimumLength,
    });
    const editing = window.GeometryDragEditing.create({
      currentScope, solver, plan, dragSolver, contextFromSeeds, projectionConstraintsForItems,
      pointLockedByLineFixed, captureValues, enforceMinimumLineLengths, normalizeArcSweeps,
      invalidateProjection: invalidateBlockProjectionCache, projectionBlockedMessage, previewMaxModelError,
    });
    function preview(session, pointer) { return profileSolve(() => editing.preview(session, pointer)); }
    function finish(session) { return profileSolve(() => editing.finish(session)); }
    const command = window.GeometryDrag.create({
      canEdit, prepareSession: editing.prepare, dragResultForSession: preview, solveFinalDragSession: finish,
      currentScope, activeSketchId, viewScale, beginPointer, endPointer, projectionBlockedMessage,
      canvasSelection, restoreModelState, restoreSolverState: state => solver.restore(state),
      solveReferenceDependentSketches, normalizeArcSweeps, clearSketchSolveState, invalidateBlockProjectionCache,
      stabilizeActiveParameterNamespace, refreshConstraintAnalysis, acceptError,
      applicationText, setHint, updateUI, updateGeometrySelectionUI, draw, recordHistory,
    });
    const { Point, Line } = window.GeometrySolver;
    const { begin: beginDerived } = window.GeometryDrag.createDerivedEntry({
      types: { Point, Line }, canEdit, canvasSelection, geometryInstanceSourceObjects,
      clearSelection, geometryInstanceSourcePoints, resolveDerivedDragSource, buildDragSession: plan.build, geometryDrag: command,
      setHint, applicationText, updateGeometrySelectionUI, updateUI, draw,
    });
    return Object.freeze({ command, build: plan.build, prepare: editing.prepare, preview, finish, beginDerived,
      targetConstraintCount: dragSolver.targetConstraintCount });
  }
  window.GeometryDragFeature = Object.freeze({ create });
})();
