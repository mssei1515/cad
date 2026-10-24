/* Assemble the five Canvas command input adapters around shared editing owners. */
(() => {
  "use strict";
  function create(options) { return createFeature(options).inputs; }
  function createFeature({ readMode, readPending, readPendingConstraint, document, canvas, canvasSelection, clearSelection, canvasHover, draw, updateUI, updateGeometrySelectionUI, setHint, applicationText,
    annotationCommand, annotationDrag, startAnnotationAnchorConstraint, selectedDimensionLineGroup, isDimensionConstraintCommandActive, beginDimensionDrag,
    retargetDistancePlaceWithOperand, startDistanceValueInput, constraintTargetHint, handleConstraintOperandClick, constraintInputFeature, dimensionDragging,
    instanceSourceCommand, geometryInstanceCommand, sceneQueries, hitReferenceTarget, hitDerivedProjectionOperand, hitBlockProjectionOperand, operandElement, toggleSketchProjectionSource,
    clearSnap, selectionRectangle, hitHatchAt, drawingSnap, viewport, geometryRefForItem, resolveGeometryRef, snapForDrawing,
    createDrawingInput, transientAuthoring, addPoint, addPointSnapConstraints, solveAndRefresh, rejectRootSketchCreation, basicDrawingInput, handleLineClick, handleCenterlineClick, handleCircleCenterCrossClick,
    handleRectangleClick, handleSlotClick, handleFilletClick, handleCircleClick, handleArcClick, handleThreePointArcClick, handleSplineClick, executeTrimAt, offsetCommand,
    sameArcEndpoint, topmostDrawingOrderOwner, drawingOrderOwner, beginDerivedGeometryDrag, beginBlockDrag, beginReferenceImageDrag, buildDragSession, geometryDrag }) {
    const releasePanelFocus = () => { if (document.activeElement?.closest("#commandPanel")) document.activeElement.blur(); };
    const capturePointer = id => canvas.setPointerCapture(id);
    const annotationCommandInput = window.AnnotationCommandInput.create({
      getMode: readMode, getPending: readPending, getPendingConstraint: readPendingConstraint,
      annotationCommand, canvasSelection, clearSelection, annotationDrag, updateUI, draw,
      startAnchorConstraint: startAnnotationAnchorConstraint,
      releasePanelFocus,
    });
    const constraintCommandInput = constraintInputFeature ? constraintInputFeature.createInput({
      dragging: dimensionDragging, canvasSelection, constraintTargetHint, setHint, updateGeometrySelectionUI, draw,
    }) : window.ConstraintCommandInput.create({
      canDragDimensionGroup: hit => Boolean(selectedDimensionLineGroup(hit.constraint)),
      getPending: readPending, getPendingConstraint: readPendingConstraint, canvasSelection, canvasHover, isDimensionConstraintCommandActive,
      beginDimensionDrag, retargetDistancePlaceWithOperand, startDistanceValueInput, constraintTargetHint,
      handleConstraintOperandClick, setHint, updateGeometrySelectionUI, draw,
    });

    const operandHits = sceneQueries ? sceneQueries.operands : { hitReferenceTarget, hitDerivedProjectionOperand, hitBlockProjectionOperand };
    const regionHits = sceneQueries?.regions;
    const hitHatch = sceneQueries
      ? p => regionHits.hitHatchAt(p.x, p.y, { activeOnly: false })
      : p => hitHatchAt(p.x, p.y, { activeOnly: false });
    const instanceCommandInput = window.InstanceCommandInput.create({
      getMode: readMode, instanceSourceCommand, geometryInstanceCommand, hitReferenceTarget: operandHits.hitReferenceTarget,
      hitDerivedProjectionOperand: operandHits.hitDerivedProjectionOperand, hitBlockProjectionOperand: operandHits.hitBlockProjectionOperand,
      operandElement, toggleSketchProjectionSource, clearSnap, selectionRectangle, hitHatch,
      capturePointer,
      snapForDrawing: point => geometryInstanceCommand.activeInput === "origin"
        ? drawingSnap.resolve(point, 10 / viewport.scale, snap => Boolean(window.PatternInstanceModel.relationFromSnap(geometryInstanceCommand.pending, snap, geometryRefForItem, resolveGeometryRef)))
        : snapForDrawing(point),
      getSnap: () => drawingSnap.active, setHint, applicationText,
      releasePanelFocus,
    });

    const basicInput = basicDrawingInput || { line: handleLineClick, rectangle: handleRectangleClick, slot: handleSlotClick,
      circle: handleCircleClick, arc: handleArcClick, threePointArc: handleThreePointArcClick };
    const drawingCommandInput = createDrawingInput ? createDrawingInput() : window.BasicDrawingTools.createCanvasInput({
      point: { transientAuthoring, snapForDrawing, drawingSnap, addPoint, addPointSnapConstraints, clearSnap, canvasSelection, solveAndRefresh },
      drawing: { getMode: readMode, rejectRootSketchCreation, handleLineClick: basicInput.line, handleCenterlineClick,
      handleCircleCenterCrossClick, handleRectangleClick: basicInput.rectangle, handleSlotClick: basicInput.slot, handleFilletClick,
      handleCircleClick: basicInput.circle, handleArcClick: basicInput.arc, handleThreePointArcClick: basicInput.threePointArc,
      handleSplineClick, executeTrimAt, offsetCommand },
    });

    const canvasSelectionInteraction = window.CanvasSelectionInteraction.create({
      canvasSelection, clearSelection, sameArcEndpoint, topmostDrawingOrderOwner, drawingOrderOwner,
      beginDerivedGeometryDrag, beginBlockDrag, beginDimensionDrag, beginReferenceImageDrag,
      buildDragSession, geometryDrag, selectionRectangle,
      capturePointer, setHint, applicationText, updateGeometrySelectionUI, draw,
    });

    const inputs = Object.freeze({ instance: instanceCommandInput, annotation: annotationCommandInput, constraint: constraintCommandInput, drawing: drawingCommandInput, selection: canvasSelectionInteraction });
    function bindPointer(pointer, { canvasNavigation, drawingPreview, recordHistory, referenceImageInteraction,
      dimensionDrag = dimensionDragging?.command, pointerHover, updateHatchPreview, updateFilletRadiusPlacement, updatePendingDistanceRetargetHover,
      hitDimension, hitSketchIdentityElement, press }) {
      return pointer.bind({ canvasNavigation, drawingPreview, canvasHover, clearSnap, draw, transientAuthoring, recordHistory,
        selectionRectangle, annotationDrag, referenceImageInteraction, dimensionDrag, geometryDrag, pointerHover,
        getMode: readMode, getPendingCommand: readPending, getPendingConstraintCommand: readPendingConstraint,
        updateHatchPreview, updateFilletRadiusPlacement, updatePendingDistanceRetargetHover, hitDimension, hitSketchIdentityElement,
        press: { ...press, activation: { ...press.activation, selection: canvasSelection },
          worldPoint: viewport.canvasPoint, screenPoint: viewport.canvasScreenPoint, inputs } });
    }
    return Object.freeze({ inputs, bindPointer });
  }
  window.CanvasCommandInputs = Object.freeze({ create, createFeature });
})();
