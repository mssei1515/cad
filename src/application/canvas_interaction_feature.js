/* Assemble Canvas interaction owners in stages without copying their operation state. */
(() => {
  "use strict";
  function createInteraction({ sketches, readServices, constraintReferencesPoint, editedFitPoints, isGeometryMode,
    setHint, applicationText, clearSnap, clearPointerPreview, clearSelection: suppliedClearSelection, updateGeometrySelectionUI, draw }, ownsClearing, exposeMode = false) {
    const lifecycle = window.DrawOperationLifecycle.createSession();
    const selectionOptions = { sketches, isGeometryMode, setHint, applicationText,
      clearSnap, clearPointerPreview, clearSelection: suppliedClearSelection, updateGeometrySelectionUI, draw };
    const selectionFeature = ownsClearing ? window.CanvasSelectionFeature.createEditingWithOwnedClearing(selectionOptions)
      : window.CanvasSelectionFeature.createEditing(selectionOptions);
    const clearSelection = ownsClearing ? selectionFeature.clearSelection : suppliedClearSelection;
    const pointUsage = readServices.createPointUsage({ constraintReferencesPoint, editedFitPoints });
    const hover = window.CanvasHover.create({ isEndpointPoint: pointUsage.isEndpointPoint });
    let preparedBlankGesture = null;
    let preparedPending;
    function cancelPendingCommand(message) {
      if (preparedPending === undefined) throw new ReferenceError("Cannot access 'pendingCommandSession' before initialization");
      return preparedPending.cancel(message);
    }
    function resetBlankCandidate() {
      if (!preparedBlankGesture) throw new ReferenceError("Cannot access 'blankCanvasGesture' before initialization");
      return preparedBlankGesture.resetCandidate();
    }
    function createOperationSessionsForAuthoring({ authoringPreview, ...options }) {
      return createOperationSessions({ ...options, snapForDrawing: authoringPreview.snapForDrawing, linePreviewPoint: authoringPreview.linePreviewPoint,
        readCenterline: authoringPreview.readCenterline, projectPointToCenterlineSupport: authoringPreview.projectPointToCenterlineSupport,
        computeTrimPreview: authoringPreview.computeTrimPreview });
    }
    function createOperationSessions({ snapForDrawing, linePreviewPoint, readCenterline, projectPointToCenterlineSupport,
      readOffsetSelection, computeTrimPreview, hits, clearPlacement, cancelAnnotation, cancelPngExport, resetOffset,
      hideInput, updateToolbar, updateConstraintButtons, acceptTarget }) {
      const { Point, Line, Circle, Arc } = window.GeometrySolver;
      const preview = window.DrawingPreview.create({ types: { Point, Line, Circle, Arc }, canvasHover: hover,
        canCreateInActiveSketch: selectionFeature.access.canCreateInActiveSketch, clearSnap, snapForDrawing, draw,
        linePreviewPoint, readCenterline, projectPointToCenterlineSupport, readOffsetSelection, computeTrimPreview, hits });
      const pending = window.PendingCommandSession.create({ clearPlacement, cancelAnnotation, cancelPngExport, resetOffset,
        clearPreviewPointer: () => preview.setPointer(null), hideInput, setHint, updateToolbar, updateConstraintButtons, draw });
      const targets = window.ConstraintTargetSession.create({ acceptTarget });
      const pointer = window.PointerInteractionController.createSession();
      function createSceneWithAnnotations({ documentWorkspace, viewport, dimensionScope, dimensions, dimensionLabelForConstraint,
        annotationBounds, annotationSpatial, operandValues }) {
        return window.CanvasHitInteraction.createSceneWithAnnotationsForWorkspace({ documentWorkspace, readServices, interaction: feature, sessions,
          viewport, dimensionScope, dimensions, dimensionLabelForConstraint, annotationBounds, annotationSpatial, operandValues });
      }
      function prepareSceneWithAnnotations() {
        return window.CanvasHitInteraction.prepareSceneWithAnnotationsForWorkspace({ readServices, interaction: feature, sessions });
      }
      function createConstruction({ projection, cancelConstraintTargetCommand, synchronizeSketchProjectionMetadata, updateUI, recordHistory, clearSnap, updateToolbar }) {
        return window.ConstructionCommand.create({ cancelConstraintTargetCommand,
          selectedConstructionTogglePrimitives: selectionFeature.selection.selectedConstructionTogglePrimitives,
          guardSketchProjectionShapeEdit: projection.guardSketchProjectionShapeEdit, applicationText, synchronizeSketchProjectionMetadata,
          setHint, clearSelection, updateUI, draw, recordHistory,
          setLineMode: () => { lifecycle.setMode("line"); }, resetLineInputs: () => lifecycle.resetInputs("line"), clearSnap, updateToolbar });
      }
      function createMoveScheduler({ requestFrame, cancelFrame, profilePhase, withGeometryReadCache, readInput, syncDimensionValueInput }) {
        return window.PointerMoveScheduler.create({ requestFrame, cancelFrame,
          processMove: pointer => profilePhase("preview", () => {
            withGeometryReadCache(() => readInput().processMove(pointer));
            if (pending.current && ["distance-value", "offset-value"].includes(pending.current.type)) syncDimensionValueInput();
          }),
        });
      }
      let completedInputBinding;
      function readInputBinding() {
        if (completedInputBinding === undefined) throw new ReferenceError("Cannot access 'canvasInputBinding' before initialization");
        return completedInputBinding.value;
      }
      function createMoveSchedulerForEditing(options) {
        return createMoveScheduler({ ...options, readInput: readInputBinding });
      }
      function createSelectionPresentation({ projections, constraintReferences }) {
        return selectionFeature.createPresentation({ hover, constraintTargets: targets, pointer, projections, constraintReferences, clearSnap });
      }
      function createInputFeature({ clearSnap: inputClearSnap, ...options }) {
        return window.CanvasCommandInputs.createFeature({ ...options,
          readMode: lifecycle.readMode, readPending: pending.read, readPendingConstraint: () => targets.command,
          canvasSelection: selectionFeature.selection, clearSelection, canvasHover: hover, draw,
          updateGeometrySelectionUI, setHint, applicationText, clearSnap: inputClearSnap });
      }
      function createInputForEditing({ document, canvas, updateUI, annotationFeature, annotationDrag, constraintInputFeature, dimensionDragging,
        constraintTargetHint, instanceSourceCommand, geometryInstanceCommand, sceneQueries, operandElement, toggleSketchProjectionSource,
        selectionRectangle, viewport, transientAuthoring, authoring, drawingCommands, sameArcEndpoint, topmostDrawingOrderOwner, drawingOrderOwner,
        geometryDragging, blockDragging, referenceImage }) {
        const { centerline, circleCenterCross, fillet, trim, offset } = drawingCommands;
        const { geometryRefForItem } = window.GeometryObjects;
        return createInputFeature({ document, canvas, updateUI,
          annotationCommand: annotationFeature.command, annotationDrag, startAnnotationAnchorConstraint: annotationFeature.startAnchorConstraint,
          constraintInputFeature, dimensionDragging, beginDimensionDrag: dimensionDragging.command.begin, constraintTargetHint,
          instanceSourceCommand, geometryInstanceCommand, sceneQueries, operandElement, toggleSketchProjectionSource,
          clearSnap: authoring.snap.clear, selectionRectangle, drawingSnap: authoring.snap, viewport, geometryRefForItem,
          resolveGeometryRef: readServices.reads.resolveGeometryRef, snapForDrawing: point => authoring.snapForDrawing(point), transientAuthoring,
          createDrawingInput: () => authoring.createCanvasInput({ readMode: lifecycle.readMode, centerline, circleCenterCross, fillet, trim, offset }),
          sameArcEndpoint, topmostDrawingOrderOwner, drawingOrderOwner,
          beginDerivedGeometryDrag: geometryDragging.beginDerived, beginBlockDrag: blockDragging.begin, beginReferenceImageDrag: referenceImage.beginDrag,
          buildDragSession: geometryDragging.build, geometryDrag: geometryDragging.command });
      }
      function bindPointer(inputs, options) {
        return inputs.bindPointer(pointer, { ...options, drawingPreview: preview });
      }
      function bindEditingPointer(inputs, options) {
        return inputs.bindPointerForEditing(pointer, { ...options, drawingPreview: preview, identity: selectionFeature.identity });
      }
      function createKeyboard(inputs, options) {
        return inputs.createKeyboard({ ...options, isGeometryMode, pendingCommandSession: pending, constraintTargetSession: targets,
          drawing: { active: lifecycle.active, cancel: lifecycle.cancel, isToolMode: lifecycle.isToolMode, exit: lifecycle.exit },
          readPointer: pointer.readLastPointer });
      }
      function createKeyboardForEditing(inputs, { constraints, spline, hatch, projection, ...options }) {
        return createKeyboard(inputs, { ...options, projection,
          cancelPendingCommand: message => pending.cancel(message), cancelConstraintTargetCommand: message => constraints.cancel(message),
          completeLineLength: () => constraints.completeLineLength(), finishSpline: spline.finalize, removeSplinePoint: spline.removeLast,
          finishProjection: projection.commit, finishHatch: hatch.finish });
      }
      function createEditingInput(options) {
        const inputs = createInputForEditing(options);
        const { referenceImage, authoring, sceneQueries, sameArcEndpoint, instanceSourceCommand, drawingCommands: { fillet, offset } } = options;
        function bindPointer(options) {
          return bindEditingPointer(inputs, { ...options, referenceImageInteraction: referenceImage, fillet, offset });
        }
        function createKeyboard(options) {
          return createKeyboardForEditing(inputs, { ...options, referenceImage, offset });
        }
        function preparePointerForEditing({ splineEditing, dimensionValues, annotationInput }) {
          const blankGesture = authoring.createBlankGesture({ lifecycle, pending, constraintTargets: targets,
            splineEditing, dimensionValues, offset, annotationInput, updateGeometrySelectionUI });
          preparedBlankGesture = blankGesture;
          function createBinding({ canvasNavigation, recordHistory, updatePendingDistanceRetargetHover, hitDimension, hitSketchIdentityElement,
            hatch, spline, blockPlacement, dimensions, expressions, discardMoves, enterBlock, closeContextMenu,
            hitBlockRotationHandle, hitAnnotationTarget, createCanvasInputBinding, readPngExportCommand, scheduler }) {
            const { press: query, hover: pointerHover, isBlankCommandPanelPoint } = sceneQueries.createInteraction({
              canvasHover: hover, sameArcEndpoint, hitBlockRotationHandle, hitAnnotationTarget,
              blankCanvasGesture: blankGesture, instanceSourceCommand, hatchCommand: hatch });
            bindPointer({ canvasNavigation, recordHistory, pointerHover, updatePendingDistanceRetargetHover, hitDimension, hitSketchIdentityElement,
              hatch, spline, splineEditing, blockPlacement, annotationInput, dimensionValues, dimensions, expressions, discardMoves, enterBlock,
              query, closeContextMenu, blankGesture });
            const binding = createCanvasInputBinding({ readPngExportCommand, blankCanvasGesture: blankGesture, isBlankCommandPanelPoint, scheduler });
            completedInputBinding = { value: binding };
            return binding;
          }
          function bindForEditing(pointerOptions, readKeyboardOptions, dimensionInput) {
            const binding = createBinding(pointerOptions);
            binding.bind();
            dimensionInput.bind();
            const keyboard = createKeyboard(readKeyboardOptions());
            keyboard.start();
            return binding;
          }
          function bindForWorkspace(pointerOptions, readKeyboardOwners, dimensionInput) {
            return bindForEditing(pointerOptions, () => {
              const { deleteSelection, ...owners } = readKeyboardOwners();
              return window.KeyboardInput.createWorkspaceOptions({ ...owners,
                spline: pointerOptions.spline, hatch: pointerOptions.hatch, splineEditing, blockPlacement: pointerOptions.blockPlacement, deleteSelection });
            }, dimensionInput);
          }
          return Object.freeze({ blankGesture, createBinding, bindForEditing, bindForWorkspace });
        }
        return Object.freeze({ bindPointer, createKeyboard, preparePointerForEditing });
      }
      function prepareInputForEditing(options, readGestureOptions) {
        const input = createEditingInput(options);
        return input.preparePointerForEditing(readGestureOptions());
      }
      function createCommandCancellation({ instances, constraints, blockPlacementCommand, restoreBlockPlacementPropertiesPanel, updateUI }) {
        return window.CanvasCommandCancellation.create({
          instances, readMode: lifecycle.readMode, selectMode: lifecycle.selectMode, blockPlacementCommand, drawingPreview: preview, restoreBlockPlacementPropertiesPanel,
          readPending: pending.read, cancelPendingCommand: message => pending.cancel(message), readConstraintCommand: () => targets.command,
          cancelConstraintTargetCommand: message => constraints.cancel(message),
          drawing: { active: lifecycle.active, cancel: lifecycle.cancel, isToolMode: lifecycle.isToolMode, exit: lifecycle.exit },
          applicationText, setHint, updateUI, draw,
        });
      }
      const sessions = Object.freeze({ preview, pending, targets, pointer, createSceneWithAnnotations, prepareSceneWithAnnotations, createConstruction, createMoveScheduler, createMoveSchedulerForEditing, createSelectionPresentation, createInputFeature, createInputForEditing, createEditingInput, prepareInputForEditing, bindPointer, bindEditingPointer, createKeyboard, createKeyboardForEditing, createCommandCancellation });
      preparedPending = pending;
      return sessions;
    }
    const capabilities = { lifecycle, selectionFeature, selection: selectionFeature.selection, scope: selectionFeature.scope,
      identity: selectionFeature.identity, access: selectionFeature.access, pointUsage, hover, createOperationSessions, createOperationSessionsForAuthoring, resetBlankCandidate, cancelPendingCommand };
    if (ownsClearing) capabilities.clearSelection = clearSelection;
    if (exposeMode) capabilities.isGeometryMode = isGeometryMode;
    const feature = Object.freeze(capabilities);
    return feature;
  }
  function create(options) { return createInteraction(options, false); }
  function createWithOwnedClearing(options) { return createInteraction(options, true); }
  function createGeometryWorkspace(options) {
    function isGeometryMode() { return true; }
    return createInteraction({ isGeometryMode, ...options }, true, true);
  }
  window.CanvasInteractionFeature = Object.freeze({ create, createWithOwnedClearing, createGeometryWorkspace });
})();
