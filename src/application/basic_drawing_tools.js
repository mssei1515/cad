/* Compose primitive drawing commands around shared geometry, snap and preview owners. */
(() => {
  "use strict";
  function create({ geometry, ids, currentScope, snap, snapConstraints, snapForDrawing, endpointAt, samePosition,
    transientAuthoring, pushModelConstraint, addConstraintIfMissing, minLineLength, minArcLength,
    selection, preview, checkpoint, clearSelection, setHint, updateUI, draw, solveAndRefresh, log }) {
    const { addPoint, addLine, addCircle, addArc } = geometry;
    const { addPointSnapConstraints, addArcEndpointSnapConstraints, addCircularBoundarySnapConstraints, addLineBoundarySnapConstraints } = snapConstraints;
    const { clear: clearSnap } = snap;
    const setPointerPreview = point => { preview.setPointer(point); };
    const line = window.LineCommand.create({
      minLineLength, snapForDrawing: point => ({ point: snapForDrawing(point), snap: snap.active }),
      samePosition, addPoint, endpointAt, addLine, addPointSnapConstraints, pushModelConstraint, transientAuthoring,
      selection, setPointerPreview, clearSelection, setHint, updateUI, draw, solveAndRefresh, log,
    });
    const rectangle = window.RectangleCommand.create({
      endpointAt, addPoint, addLine, addPointSnapConstraints, pushModelConstraint, minLineLength, samePosition,
      selection, setPointerPreview, clearSnap, clearSelection, setHint, updateUI, draw, solveAndRefresh, log,
    });
    const circularConstruction = window.CircularConstruction.create({
      endpointAt, addPoint, addCircle, addArc, addPointSnapConstraints, addArcEndpointSnapConstraints, addCircularBoundarySnapConstraints,
      currentScope, sequences: ids,
    });
    const circular = window.CircularCommands.create({
      construction: circularConstruction, selection, minArcLength, setPointerPreview,
      clearSnap, clearSelection, setHint, updateUI, draw, solveAndRefresh,
    });
    const slotConstruction = window.SlotConstruction.create({
      addPoint, addLine, addArc, addConstraintIfMissing, addPointSnapConstraints, addLineBoundarySnapConstraints,
      snapshotGeometryMutationState: checkpoint.capture, restoreGeometryMutationState: checkpoint.restore, solveAndRefresh,
    });
    const slot = window.SlotCommand.create({
      construction: slotConstruction, minLineLength, minArcLength, setPointerPreview,
      clearSnap, clearSelection, setHint, updateUI, draw,
    });
    const input = Object.freeze({
      line: line.click,
      rectangle: point => { const snapped = snapForDrawing(point); rectangle.click(snapped, snap.active); },
      circle: point => { const snapped = snapForDrawing(point); circular.clickCircle(snapped, snap.active); },
      arc: point => { const snapped = snapForDrawing(point); circular.clickArc(snapped, snap.active); },
      threePointArc: point => { const snapped = snapForDrawing(point); circular.clickThreePointArc(snapped, snap.active); },
      slot: point => { const snapped = snapForDrawing(point); slot.click(snapped, snap.active); },
    });
    return Object.freeze({ line, rectangle, circular, slot, input });
  }
  // Spline shares its draft with rendering and cancellation, independently of primitive tools.
  function createSpline({ currentScope, ids, endpointAt, samePosition, isPointUsedByPrimitive,
    addSpline, snapForDrawing, scale, cancelConstraintTargetCommand, cancelPendingCommand,
    canCreateInActiveSketch, rejectRootSketchCreation, setMode, resetEditing, resetBlankCandidate, updateToolbar,
    projection, preview, snap, clearSelection, selection, solveAndRefresh, recordHistory, applicationText, setHint, updateUI, draw }) {
    const draft = window.SplineDraft.create({ currentScope, ids, endpointAt, samePosition, isPointUsedByPrimitive });
    const command = window.SplineCommand.create({
      draft, addSpline, snapForDrawing, scale, cancelConstraintTargetCommand, cancelPendingCommand,
      canCreateInActiveSketch, rejectRootSketchCreation, setMode, resetEditing, resetBlankCandidate, updateToolbar,
      clearProjectionSources: () => { projection.reset(); }, setPointerPreview: value => { preview.setPointer(value); },
      clearSnap: snap.clear, clearSelection,
      selectCreatedSpline: spline => { selection.set("splines", [spline]); setMode("select"); },
      solveAndRefresh, recordHistory, applicationText, setHint, updateUI, draw,
    });
    return Object.freeze({ draft, command });
  }

  function createCenterline({ currentScope, geometry, ids, snapConstraints, commitNewConstraint,
    parallelTolerance, cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation,
    clearSelection, updateToolbar, selection, sameSketchElements, activeSketchId, isActiveSketchElement, applicationText,
    minLineLength, snapForDrawing, snap, preview, setMode, invalidateAnalysis, setHint, updateUI, draw }) {
    const plans = window.CenterlineGeometry.create({ applicationText, parallelTolerance });
    const construction = window.CenterlineConstruction.create({
      currentScope, geometry, ids, addPointSnapConstraints: snapConstraints.addPointSnapConstraints, commitNewConstraint,
    });
    return window.CenterlineCommand.create({
      cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation, clearSelection, updateToolbar,
      plans, construction, selection, sameSketchElements, activeSketchId, isActiveSketchElement, applicationText, minLineLength,
      snapForDrawing: pointer => ({ point: snapForDrawing(pointer), snap: snap.active }), clearSnap: snap.clear,
      setPointerPreview: value => { preview.setPointer(value); }, setMode, invalidateAnalysis, setHint, updateUI, draw,
    });
  }

  function createAuthoring({ currentScope, ids, geometry, endpointAt, samePosition, sketchContext, pointUsage, geometryReads,
    isVisibleSketchElement, annotationAnchors, scale, transientAuthoring, pushModelConstraint, addConstraintIfMissing,
    minLineLength, minArcLength, selection, preview, checkpoint, cancelConstraintTargetCommand, cancelPendingCommand,
    canCreateInActiveSketch, rejectRootSketchCreation, setMode, resetEditing, resetBlankCandidate, updateToolbar,
    projection, clearSelection, solveAndRefresh, recordHistory, applicationText, setHint, updateUI, draw, log }) {
    const { isActiveSketchElement, elementSketchId, isReferenceSourceSketchId, sketchName } = sketchContext;
    const { isSplineOnlyFitPoint, isReferencePoint, isPrimitiveCenterPoint, isEndpointPoint, isPointUsedByPrimitive, isExplicitPoint } = pointUsage;
    const snap = window.DrawingSnap.create({ annotationAnchors, geometryReads, isVisibleSketchElement, isActiveSketchElement,
      isSplineOnlyFitPoint, isReferencePoint, isPrimitiveCenterPoint, isEndpointPoint, isPointUsedByPrimitive, isExplicitPoint,
      sketchName, elementSketchId, applicationText });
    function snapForDrawing(point) { return snap.resolve(point, 10 / scale()); }
    const spline = createSpline({ currentScope, ids, endpointAt, samePosition, isPointUsedByPrimitive, addSpline: geometry.addSpline,
      snapForDrawing, scale, cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation,
      setMode, resetEditing, resetBlankCandidate, updateToolbar, projection, preview, snap, clearSelection, selection,
      solveAndRefresh, recordHistory, applicationText, setHint, updateUI, draw });
    const snapConstraints = window.SnapConstraints.create({ isActiveSketchElement, elementSketchId, isReferenceSourceSketchId,
      addPoint: geometry.addPoint, addConstraintIfMissing });
    const tools = create({ geometry, ids, currentScope, snap, snapConstraints, snapForDrawing, endpointAt, samePosition,
      transientAuthoring, pushModelConstraint, addConstraintIfMissing, minLineLength, minArcLength, selection, preview, checkpoint,
      clearSelection, setHint, updateUI, draw, solveAndRefresh, log });
    function createCenterlineTool({ commitNewConstraint, parallelTolerance, invalidateAnalysis }) {
      return createCenterline({ currentScope, geometry, ids, snapConstraints, commitNewConstraint, parallelTolerance,
        cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation, clearSelection, updateToolbar,
        selection, sameSketchElements: sketchContext.sameSketchElements, activeSketchId: sketchContext.activeSketchId, isActiveSketchElement,
        applicationText, minLineLength, snapForDrawing, snap, preview, setMode, invalidateAnalysis, setHint, updateUI, draw });
    }
    return Object.freeze({ snap, spline, snapConstraints, tools, snapForDrawing, createCenterline: createCenterlineTool });
  }
  window.BasicDrawingTools = Object.freeze({ create, createSpline, createCenterline, createAuthoring });
})();
