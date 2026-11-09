/* Assemble Canvas interaction owners in stages without copying their operation state. */
(() => {
  "use strict";
  function create({ sketches, readServices, constraintReferencesPoint, editedFitPoints, isGeometryMode,
    setHint, applicationText, clearSnap, clearPointerPreview, clearSelection, updateGeometrySelectionUI, draw }) {
    const lifecycle = window.DrawOperationLifecycle.createSession();
    const selectionFeature = window.CanvasSelectionFeature.createEditing({ sketches, isGeometryMode, setHint, applicationText,
      clearSnap, clearPointerPreview, clearSelection, updateGeometrySelectionUI, draw });
    const pointUsage = readServices.createPointUsage({ constraintReferencesPoint, editedFitPoints });
    const hover = window.CanvasHover.create({ isEndpointPoint: pointUsage.isEndpointPoint });
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
        const { referenceImage, drawingCommands: { fillet, offset } } = options;
        function bindPointer(options) {
          return bindEditingPointer(inputs, { ...options, referenceImageInteraction: referenceImage, fillet, offset });
        }
        function createKeyboard(options) {
          return createKeyboardForEditing(inputs, { ...options, referenceImage, offset });
        }
        return Object.freeze({ bindPointer, createKeyboard });
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
      return Object.freeze({ preview, pending, targets, pointer, createConstruction, createMoveScheduler, createSelectionPresentation, createInputFeature, createInputForEditing, createEditingInput, bindPointer, bindEditingPointer, createKeyboard, createKeyboardForEditing, createCommandCancellation });
    }
    return Object.freeze({ lifecycle, selectionFeature, selection: selectionFeature.selection, scope: selectionFeature.scope,
      identity: selectionFeature.identity, access: selectionFeature.access, pointUsage, hover, createOperationSessions });
  }
  window.CanvasInteractionFeature = Object.freeze({ create });
})();
