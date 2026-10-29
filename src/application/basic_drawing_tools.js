/* Compose drawing features around shared geometry, snap and preview owners. */
(() => {
  "use strict";
  function createCanvasInput({ point, drawing }) {
    const pointCommand = window.PointCommand.create(point);
    return window.DrawingCommandInput.create({ ...drawing, pointCommand });
  }
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

  function createGeometry({ currentScope, ids, assignSketchId, currentConstruction, minLineLength, minArcLength,
    hitEndpointPoint, hitExplicitPoint }) {
    const geometry = window.GeometryCreation.create({ currentScope, ids, assignSketchId, currentConstruction, minLineLength, minArcLength });
    const { endpointAt } = window.GeometryCreation.createEndpointResolver({ addPoint: geometry.addPoint, hitEndpointPoint, hitExplicitPoint });
    function createTools(options) {
      return createAuthoring({ ...options, currentScope, ids, geometry, endpointAt, minLineLength, minArcLength });
    }
    return Object.freeze({ geometry, createAuthoring: createTools });
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
    function createCircleCenterCross({ checkpoint: crossCheckpoint, solveSketchAndDependents, resultIsAccepted,
      minOrientationLength, selectedElementCount, invalidateAnalysis }) {
      return window.CircleCenterCrossCommand.create({ geometry: { addPoint: geometry.addPoint, addLine: geometry.addLine, pushModelConstraint },
        checkpoint: { capture: crossCheckpoint.captureGeometry, restore: crossCheckpoint.restoreGeometry },
        solveSketchAndDependents, resultIsAccepted, minOrientationLength,
        activeSketchId: sketchContext.activeSketchId, isActiveSketchElement, selection, selectedElementCount,
        cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation,
        setMode, clearPreview: () => preview.setPointer(null), clearSnap: snap.clear, clearSelection, invalidateAnalysis,
        updateUI, draw, setHint, recordHistory, applicationText });
    }
    function createPreview({ ctx, viewport, withCanvasState, traceSplinePath, readMode, centerlineCommand, readCanvasSize }) {
      const { shortestAngleFrom, slotGeometry, threePointArcGeometry, angleAtArcParam } = window.GeometryKernel;
      const renderer = window.AuthoringPreviewRenderer.create({ ctx, viewport, withCanvasState,
        hypot2: window.GeometrySolver.hypot2, shortestAngleFrom, slotGeometry, threePointArcGeometry,
        minimumLineLength: minLineLength, minimumArcLength: minArcLength, buildSpline: window.SplineGeometry.build,
        traceSplinePath, angleAtArcParam });
      const layer = window.AuthoringPreviewRenderer.createLayer({ renderer, readMode,
        readPointer: () => preview.pointer, readTrim: () => preview.trim,
        lineCommand: tools.line, rectangleCommand: tools.rectangle, slotCommand: tools.slot,
        circularCommands: tools.circular, splineDraft: spline.draft, centerlineCommand,
        projectPointToCenterlineSupport: centerlineCommand.projectPointToCenterlineSupport, readCanvasSize });
      return Object.freeze({ renderer, layer });
    }
    function createLifecycle({ lifecycle, canStart, instances, instanceSources, centerline, fillet, offset, hatch, readMode, clearTrimHover }) {
      const construct = lifecycle ? lifecycle.bind : window.DrawOperationLifecycle.create;
      return construct({ canStart, instances, instanceSources, centerline, fillet, offset, hatch, readMode, clearTrimHover,
        line: tools.line, rectangle: tools.rectangle, slot: tools.slot, circular: tools.circular, spline: spline.draft,
        splineEditing: { reset: resetEditing }, projection, preview,
        transient: { clearPoint: transientAuthoring.clearTransientPointRollback,
          clearLineCompletion: transientAuthoring.clearTransientLineCompletionRollback, rollbackLineStart: transientAuthoring.rollbackTransientLineStart },
        clearSnap: snap.clear, clearSelection, selectMode: () => { setMode("select"); }, updateToolbar, setHint, updateUI, draw,
        cancelConstraintTargetCommand, cancelPendingCommand, setMode });
    }
    function createOffset({ currentScope: offsetScope, placement, sourceSelection, pending, valueInput, viewport, ctx,
      withCanvasState, drawDimension, readMode, commitNewConstraint, offsetChainErrorText, prepareStart, updateGeometrySelectionUI, invalidateAnalysis }) {
      return window.OffsetFeature.create({ currentScope: offsetScope, geometry, ids, placement, sourceSelection, selection, pending, preview,
        valueInput, viewport, ctx, withCanvasState, drawDimension, readMode, minLineLength, minArcLength, commitNewConstraint, offsetChainErrorText,
        applicationText, cancelConstraintTargetCommand, cancelPendingCommand, clearSnap: snap.clear, clearSelection, prepareStart,
        setHint, updateUI, draw, updateToolbar, updateGeometrySelectionUI, invalidateAnalysis });
    }
    function createFillet({ defaultDimensionForTarget, syncLineOrientationHints, pending, readPointer, prepareStart,
      guardSketchProjectionShapeEdit, valueInput, checkpoint: filletCheckpoint, stabilize, acceptError, invalidateAnalysis,
      refreshConstraintAnalysis, updateGeometrySelectionUI }) {
      return window.FilletFeature.create({ geometry, minLineLength, defaultDimensionForTarget, syncLineOrientationHints, pushModelConstraint,
        pending, selection, readPointer, prepareStart, clearSnap: snap.clear, updateToolbar, guardSketchProjectionShapeEdit, valueInput,
        checkpoint: filletCheckpoint, clearSelection, stabilize, acceptError, invalidateAnalysis, refreshConstraintAnalysis,
        applicationText, setHint, updateUI, updateGeometrySelectionUI, draw, recordHistory, cancelConstraintTargetCommand });
    }
    function createTrim({ references, checkpoint: trimCheckpoint, hitSketchIdentityElement, guardSketchEdit, guardSketchProjectionShapeEdit,
      stabilizeActiveParameterNamespace, acceptError, invalidateAnalysis, refreshConstraintAnalysis }) {
      return window.TrimFeature.create({ currentScope, geometry, references, isActiveSketchElement, minLineLength, minArcLength,
        pushModelConstraint, elementSketchId, isPointUsedByPrimitive, isReferencePoint, viewportScale: scale, preview, checkpoint: trimCheckpoint,
        hitSketchIdentityElement, guardSketchEdit, activeSketchId: sketchContext.activeSketchId, setHint, draw, guardSketchProjectionShapeEdit, applicationText,
        clearSelection, stabilizeActiveParameterNamespace, acceptError, invalidateAnalysis, refreshConstraintAnalysis, updateUI, recordHistory });
    }
    function createAuthoringInput({ readMode, centerline, circleCenterCross, fillet, trim, offset }) {
      return createCanvasInput({ point: { transientAuthoring, snapForDrawing, drawingSnap: snap, addPoint: geometry.addPoint,
        addPointSnapConstraints: snapConstraints.addPointSnapConstraints, clearSnap: snap.clear, canvasSelection: selection, solveAndRefresh },
        drawing: { getMode: readMode, rejectRootSketchCreation, handleLineClick: tools.input.line,
          handleRectangleClick: tools.input.rectangle, handleSlotClick: tools.input.slot, handleCircleClick: tools.input.circle,
          handleArcClick: tools.input.arc, handleThreePointArcClick: tools.input.threePointArc,
          handleCenterlineClick: centerline.click, handleCircleCenterCrossClick: circleCenterCross.click, handleFilletClick: fillet.click,
          handleSplineClick: spline.command.click, executeTrimAt: trim.execute, offsetCommand: offset } });
    }
    function createBlankGesture({ lifecycle, pending, constraintTargets, splineEditing, dimensionValues, offset, annotationInput,
      updateGeometrySelectionUI, getTime = () => performance.now() }) {
      const { rollbackTransientLineCompletion, rollbackTransientPoint } = transientAuthoring;
      return window.BlankCanvasGesture.create({ getMode: lifecycle.readMode,
        getPending: () => pending.current, getPendingConstraint: () => constraintTargets.command,
        getSplineEditSession: () => splineEditing.current, getLineCommand: () => tools.line, getTransientAuthoring: () => transientAuthoring,
        getTime, hypot2: window.GeometrySolver.hypot2, clearPreview: () => preview.setPointer(null),
        finalizeSplineFromDoubleClick: spline.command.doubleClick, finishSplineEditSession: splineEditing.finish,
        submitDistanceValue: dimensionValues.submit, submitOffsetValue: offset.submit, submitAnnotationValue: () => annotationInput.finish(),
        cancelPendingCommand, isDrawToolMode: () => lifecycle.isToolMode(), exitDrawMode: () => lifecycle.exit(),
        cancelConstraintTargetCommand, rollbackTransientLineCompletion, clearSnap: snap.clear, clearSelection,
        setHint, updateUI, draw, cancelActiveDrawOperation: () => lifecycle.cancel(), rollbackTransientPoint,
        hasActiveDrawOperation: () => lifecycle.active(), hasSelection: selection.hasSelection, updateGeometrySelectionUI });
    }
    return Object.freeze({ snap, spline, snapConstraints, tools, snapForDrawing, createCenterline: createCenterlineTool, createCircleCenterCross, createPreview, createLifecycle, createOffset, createFillet, createTrim, createBlankGesture, createCanvasInput: createAuthoringInput });
  }
  window.BasicDrawingTools = Object.freeze({ create, createSpline, createCenterline, createGeometry, createAuthoring, createCanvasInput });
})();
