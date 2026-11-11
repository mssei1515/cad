/* Compose drawing features around shared geometry, snap and preview owners. */
(() => {
  "use strict";
  function prepare() {
    let authoring = null, editing = null, centerline = null, trim = null, splineEditing = null;
    function requireComponent(component, binding) {
      if (!component) throw new ReferenceError(`Cannot access '${binding}' before initialization`);
      return component;
    }
    function publishAuthoring(build, options) {
      const completed = build(options);
      authoring = completed;
      return completed;
    }
    function createPreparedGeometry(options) {
      const geometry = createGeometry(options);
      const build = geometry.createAuthoring, buildForEditing = geometry.createAuthoringForEditing;
      function createAuthoringWithProjectionForEditing({ projectionFeature, references, ...options }) {
        const projectionEditing = projectionFeature.createModelEditingForConstruction({ geometry: geometry.geometry, references });
        const authoring = publishAuthoring(buildForEditing, options);
        return Object.freeze({ authoring, projectionEditing });
      }
      return Object.freeze({ ...geometry,
        createAuthoring: options => publishAuthoring(build, options),
        createAuthoringForEditing: options => publishAuthoring(buildForEditing, options), createAuthoringWithProjectionForEditing });
    }
    function prepareGeometryForSolver(solver, minimumOrientationLength) {
      const lengths = window.GeometryCreation.createLengthPolicy(solver.minLineLength,
        arguments.length < 2 ? window.GeometryKernel.MIN_ORIENTATION_LENGTH : minimumOrientationLength);
      function createGeometry(options) { return createPreparedGeometry({ ...lengths, ...options }); }
      return Object.freeze({ minimumLength: lengths.minLineLength, createGeometry });
    }
    function createEditing(options) {
      const completed = requireComponent(authoring, "authoringTools").createEditing(options);
      editing = completed;
      return completed;
    }
    function createCenterline(options) {
      const { createCenterline } = requireComponent(editing, "createCenterline");
      const completed = createCenterline(options);
      centerline = completed;
      return completed;
    }
    function createTrim(options) {
      const { createTrim } = requireComponent(editing, "createTrim");
      const completed = createTrim(options);
      trim = completed;
      return completed;
    }
    function createSplineEditing(options) {
      const { createSplineEditing } = requireComponent(editing, "createSplineEditing");
      const completed = createSplineEditing(options);
      splineEditing = completed;
      return completed;
    }
    function resetSplineEditing() { return requireComponent(splineEditing, "splineEditing").reset(); }
    const preview = Object.freeze({
      snapForDrawing(point) { return requireComponent(authoring, "authoringTools").snapForDrawing(point); },
      linePreviewPoint(point, shiftKey) { return requireComponent(authoring, "lineCommand").tools.line.previewPoint(point, shiftKey); },
      readCenterline() { return requireComponent(centerline, "centerlineCommand"); },
      projectPointToCenterlineSupport(point) {
        const { projectPointToCenterlineSupport } = requireComponent(centerline, "projectPointToCenterlineSupport");
        return projectPointToCenterlineSupport(point);
      },
      computeTrimPreview(pointer) { return requireComponent(trim, "trimFeature").computePreview(pointer); },
    });
    return Object.freeze({ createGeometry: createPreparedGeometry, createEditing, createCenterline, createTrim, createSplineEditing, resetSplineEditing, preview, prepareGeometryForSolver });
  }
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
    function resetForDeletion() {
      line.reset();
      circular.resetCircle();
      circular.resetArcs();
    }
    return Object.freeze({ line, rectangle, circular, slot, input, resetForDeletion });
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
    function createToolsForEditing({ documentWorkspace, readServices, interaction, sessions, presentation, viewport, ...options }) {
      const tools = createTools({ ...options, samePosition: window.GeometryKernel.samePosition,
        sketchContext: documentWorkspace.sketches, pointUsage: interaction.pointUsage, geometryReads: readServices.reads,
        isVisibleSketchElement: readServices.geometryAppearance.isVisibleSketchElement, scale: () => viewport.scale,
        selection: interaction.selection, preview: sessions.preview, cancelPendingCommand: message => sessions.pending.cancel(message),
        canCreateInActiveSketch: interaction.access.canCreateInActiveSketch, rejectRootSketchCreation: interaction.access.rejectRootSketchCreation,
        setMode: interaction.lifecycle.setMode, applicationText: presentation.settings.applicationText,
        setHint: presentation.setHint, updateUI: presentation.updateUI, draw: presentation.draw, log: presentation.log });
      function createEditing({ checkpoint, solving, parameters, analysis, editingScope, solver, placement, valueInput,
        projection, acceptError, updateGeometrySelectionUI }) {
        const { activeSketchId } = documentWorkspace.sketches;
        const { stabilize } = parameters;
        const fillet = tools.createFillet({
          defaultDimensionForTarget: placement.defaultDimensionForTarget, syncLineOrientationHints: () => solver.syncLineOrientationHints?.(),
          pending: sessions.pending, readPointer: sessions.pointer.readLastPointer,
          prepareStart: () => interaction.lifecycle.prepare("fillet"), guardSketchProjectionShapeEdit: projection.guardSketchProjectionShapeEdit,
          valueInput, checkpoint, stabilize: () => stabilize(activeSketchId()), acceptError,
          invalidateAnalysis: () => { analysis.invalidate(); }, refreshConstraintAnalysis: (options = {}) => analysis.refresh(options),
          updateGeometrySelectionUI,
        });
        function createCircleCenterCross(options) {
          const { resultIsAccepted, minOrientationLength: suppliedLength } = options;
          const minOrientationLength = "minOrientationLength" in options ? suppliedLength : window.GeometryKernel.MIN_ORIENTATION_LENGTH;
          return tools.createCircleCenterCross({ checkpoint, solveSketchAndDependents: solving.solveSketchAndDependents,
            resultIsAccepted, minOrientationLength, selectedElementCount: interaction.selection.selectedElementCount,
            invalidateAnalysis: () => analysis.invalidate() });
        }
        function createSplineEditing({ constraintReferences, guardDimensionSymbolDeletion }) {
          return tools.createSplineEditing({ editingScope, checkpoint, parameters, analysis, access: interaction.access,
            guardSketchProjectionShapeEdit: projection.guardSketchProjectionShapeEdit, constraintReferences, guardDimensionSymbolDeletion });
        }
        function createCenterline({ commitNewConstraint, parallelTolerance = 1e-5 }) {
          return tools.createCenterline({ commitNewConstraint, parallelTolerance, invalidateAnalysis: () => { analysis.invalidate(); } });
        }
        function createTrim({ references, hitSketchIdentityElement }) {
          return tools.createTrim({ references, checkpoint, hitSketchIdentityElement, guardSketchEdit: interaction.access.guardSketchEdit,
            guardSketchProjectionShapeEdit: projection.guardSketchProjectionShapeEdit,
            stabilizeActiveParameterNamespace: stabilize, acceptError, invalidateAnalysis: () => analysis.invalidate(),
            refreshConstraintAnalysis: (options = {}) => analysis.refresh(options) });
        }
        return Object.freeze({ fillet, createCircleCenterCross, createSplineEditing, createCenterline, createTrim });
      }
      function createOffsetForEditing({ editingScope, placement, sourceSelection, valueInput, ctx, surface, drawDimension,
        commitNewConstraint, offsetChainErrorText, analysis }) {
        return tools.createOffset({ currentScope: () => editingScope.current, placement, sourceSelection,
          pending: sessions.pending, valueInput, viewport, ctx, withCanvasState: surface.withCanvasState, drawDimension,
          readMode: interaction.lifecycle.readMode, commitNewConstraint, offsetChainErrorText,
          prepareStart: () => interaction.lifecycle.prepare("offset"),
          updateGeometrySelectionUI: presentation.updateGeometrySelectionUI, invalidateAnalysis: () => { analysis.invalidate(); } });
      }
      function createHatchForEditing({ updateStatusUI, hatchRegionErrorText }) {
        return tools.createHatch({ hatchGeometryQuery: readServices.hatches, readMode: interaction.lifecycle.readMode,
          lastPointer: sessions.pointer.readLastPointer, documentIds: documentWorkspace.documentIds, updateStatusUI, hatchRegionErrorText });
      }
      function createPreviewForEditing({ ctx, surface, geometry: display, canvas, centerlineCommand }) {
        return tools.createPreview({ ctx, viewport, withCanvasState: surface.withCanvasState, traceSplinePath: display.traceSplinePath,
          readMode: interaction.lifecycle.readMode, centerlineCommand,
          readCanvasSize: () => ({ width: canvas.clientWidth, height: canvas.clientHeight }) });
      }
      return Object.freeze({ ...tools, createEditing, createOffsetForEditing, createHatchForEditing, createPreviewForEditing });
    }
    return Object.freeze({ geometry, createAuthoring: createTools, createAuthoringForEditing: createToolsForEditing });
  }

  function createAuthoring({ currentScope, ids, geometry, endpointAt, samePosition, sketchContext, pointUsage, geometryReads,
    isVisibleSketchElement, annotationAnchors, scale, transientAuthoring, pushModelConstraint, addConstraintIfMissing,
    minLineLength, minArcLength, selection, preview, checkpoint, cancelConstraintTargetCommand, cancelPendingCommand,
    canCreateInActiveSketch, rejectRootSketchCreation, setMode, resetEditing, resetBlankCandidate, updateToolbar,
    projection, clearSelection, solveAndRefresh, recordHistory, applicationText, setHint, updateUI, draw, log }) {
    const { isActiveSketchElement, elementSketchId, isReferenceSourceSketchId, sketchName, activeSketchId } = sketchContext;
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
    function createLifecycle({ interaction, lifecycle = interaction?.lifecycle, canStart, instances, instanceSources, centerline, fillet, offset, hatch, readMode, clearTrimHover }) {
      if (canStart === undefined && interaction) {
        const { guardSketchEdit, guardSelectionEdit } = interaction.access;
        canStart = nextMode => nextMode === "select" || guardSketchEdit(activeSketchId(), "create") && (nextMode !== "trim" || guardSelectionEdit("structure"));
      }
      if (clearTrimHover === undefined && interaction) {
        clearTrimHover = () => interaction.hover.update({ point: null, endpointPoint: null, line: null, circle: null, arcEndpoint: null, arc: null, dimension: null });
      }
      const construct = lifecycle ? lifecycle.bind : window.DrawOperationLifecycle.create;
      return construct({ canStart, instances, instanceSources, centerline, fillet, offset, hatch, readMode, clearTrimHover,
        line: tools.line, rectangle: tools.rectangle, slot: tools.slot, circular: tools.circular, spline: spline.draft,
        splineEditing: { reset: resetEditing }, projection, preview,
        transient: { clearPoint: transientAuthoring.clearTransientPointRollback,
          clearLineCompletion: transientAuthoring.clearTransientLineCompletionRollback, rollbackLineStart: transientAuthoring.rollbackTransientLineStart },
        clearSnap: snap.clear, clearSelection, selectMode: () => { setMode("select"); }, updateToolbar, setHint, updateUI, draw,
        cancelConstraintTargetCommand, cancelPendingCommand, setMode });
    }
    function createHatch({ hatchGeometryQuery, readMode, lastPointer, documentIds, updateStatusUI, hatchRegionErrorText }) {
      return window.HatchCommand.create({ currentScope, hatchGeometryQuery, getMode: readMode, setMode, lastPointer,
        getPointerPreview: () => preview.pointer, setPointerPreview: value => { preview.setPointer(value); },
        activeSketchId, canCreateInActiveSketch, rejectRootSketchCreation,
        nextHatchId: () => documentIds.allocate("hatch"), hatchSequence: () => documentIds.peek("hatch"),
        cancelConstraintTargetCommand, cancelPendingCommand, clearSnap: snap.clear, clearSelection, canvasSelection: selection,
        updateToolbar, updateStatusUI, updateUI, setHint, draw, recordHistory, applicationText, hatchRegionErrorText });
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
    function createSplineEditing({ editingScope, checkpoint: valueCheckpoint, parameters, analysis, access,
      guardSketchProjectionShapeEdit, constraintReferences, guardDimensionSymbolDeletion }) {
      const { guardSketchEdit } = access;
      return window.SplineEditCommand.create({
        canEditStructure: item => guardSketchEdit(elementSketchId(item), "structure"),
        currentScope: () => editingScope.current, ids, clearSelection, canvasSelection: selection, applicationText, setHint, updateUI, draw,
        restoreModelState: valueCheckpoint.restoreValues, snapshotModelState: valueCheckpoint.captureValues,
        stabilizeActiveParameterNamespace: parameters.stabilize, elementSketchId, invalidateAnalysis: () => analysis.invalidate(), recordHistory,
        guardSketchProjectionShapeEdit, addPoint: geometry.addPoint,
        isPointUsedByLine: pointUsage.isPointUsedByLine, isPointUsedByCircle: pointUsage.isPointUsedByCircle, isPointUsedByArc: pointUsage.isPointUsedByArc,
        constraintReferencesPoint: constraintReferences.constraintReferencesPoint, guardDimensionSymbolDeletion,
        geometryElementKey: window.GeometryObjects.geometryKeyForItem, annotationReferencesRemovedGeometry: window.AnnotationAnchorData.referencesRemovedGeometry,
      });
    }
    return Object.freeze({ snap, spline, snapConstraints, tools, snapForDrawing, createCenterline: createCenterlineTool, createCircleCenterCross, createPreview, createLifecycle, createOffset, createFillet, createTrim, createHatch, createBlankGesture, createCanvasInput: createAuthoringInput, createSplineEditing });
  }
  window.BasicDrawingTools = Object.freeze({ prepare, create, createSpline, createCenterline, createGeometry, createAuthoring, createCanvasInput });
})();
