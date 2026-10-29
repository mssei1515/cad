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
    function createBlockEntry() {
      return window.GeometryDrag.createBlockEntry({ clearSelection, canvasSelection,
        buildDragSession: plan.build, geometryDrag: command, setHint, updateUI, draw });
    }
    return Object.freeze({ command, build: plan.build, prepare: editing.prepare, preview, finish, beginDerived, createBlockEntry,
      targetConstraintCount: dragSolver.targetConstraintCount });
  }
  // Connect the existing editing owners; drag state and numeric policy stay in create's components.
  function createForEditing({ currentScope, solver, sketches, scopeQuery, solving, checkpoint, geometry, readServices,
    viewport, pointer, profiler, acceptError, previewMaxModelError, minimumLength,
    blockLocalGeometryBounds, blockWorldPoint, pointLockedByLineFixed, findLineFixedConstraint, findArcEndpointFixedConstraint,
    projectionConstraintsForItems, projectionBlockedMessage, canEdit, canvasSelection,
    stabilizeActiveParameterNamespace, refreshConstraintAnalysis, applicationText, setHint, updateUI,
    updateGeometrySelectionUI, draw, recordHistory, geometryInstanceSourceObjects, clearSelection, resolveDerivedDragSource }) {
    const { activeSketchId, elementSketchId, isEditableSketchId } = sketches;
    const { sketchSolveVariables, sketchSolveConstraints, localSolveContextFromSeeds } = scopeQuery;
    const { solveSketchById, solveReferenceDependentSketches, clearSketchSolveState } = solving;
    const { captureValues, restoreValues: restoreModelState } = checkpoint;
    const { enforceMinimumLineLengths, normalizeArcSweeps } = geometry;
    const { blockDefinitionById, blockInstanceEnabledSketchSet } = readServices.catalog;
    const { invalidateBlockProjectionCache } = readServices.projections;
    const { geometryInstanceSourcePoints } = readServices.instances;
    const { arcEndpointPoint, arcEndpointDragValue } = window.GeometryKernel;
    const { hypot2 } = window.GeometrySolver;
    const { work: profileWork } = profiler;
    return create({
      solver, currentScope, activeSketchId, sketchSolveVariables, sketchSolveConstraints, solveSketchById,
      viewScale: () => viewport.scale, arcEndpointPoint, acceptError, previewMaxModelError,
      elementSketchId, isEditableSketchId, blockDefinitionById, blockLocalGeometryBounds, blockInstanceEnabledSketchSet,
      blockWorldPoint, pointLockedByLineFixed, findLineFixedConstraint, findArcEndpointFixedConstraint,
      arcEndpointDragValue, hypot2, minimumLength, contextFromSeeds: localSolveContextFromSeeds,
      projectionConstraintsForItems, captureValues, enforceMinimumLineLengths, normalizeArcSweeps,
      invalidateBlockProjectionCache, projectionBlockedMessage,
      profileSolve: work => profiler.active ? profileWork("solve", work) : work(),
      canEdit, beginPointer: pointer.markThenCapture, endPointer: pointer.release, canvasSelection, restoreModelState,
      solveReferenceDependentSketches, clearSketchSolveState, stabilizeActiveParameterNamespace, refreshConstraintAnalysis,
      applicationText, setHint, updateUI, updateGeometrySelectionUI, draw, recordHistory,
      geometryInstanceSourceObjects, clearSelection, geometryInstanceSourcePoints, resolveDerivedDragSource,
    });
  }
  window.GeometryDragFeature = Object.freeze({ create, createForEditing });
})();
