/* Assemble the five Canvas command input adapters around shared editing owners. */
(() => {
  "use strict";
  function create({ readMode, readPending, readPendingConstraint, document, canvas, canvasSelection, clearSelection, canvasHover, draw, updateUI, updateGeometrySelectionUI, setHint, applicationText,
    annotationCommand, annotationDrag, startAnnotationAnchorConstraint, selectedDimensionLineGroup, isDimensionConstraintCommandActive, beginDimensionDrag,
    retargetDistancePlaceWithOperand, startDistanceValueInput, constraintTargetHint, handleConstraintOperandClick, constraintInputFeature, dimensionDragging,
    instanceSourceCommand, geometryInstanceCommand, sceneQueries, hitReferenceTarget, hitDerivedProjectionOperand, hitBlockProjectionOperand, operandElement, toggleSketchProjectionSource,
    clearSnap, selectionRectangle, hitHatchAt, drawingSnap, viewport, geometryRefForItem, resolveGeometryRef, snapForDrawing,
    transientAuthoring, addPoint, addPointSnapConstraints, solveAndRefresh, rejectRootSketchCreation, basicDrawingInput, handleLineClick, handleCenterlineClick, handleCircleCenterCrossClick,
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

    const pointCommand = window.PointCommand.create({
      transientAuthoring, snapForDrawing, drawingSnap, addPoint, addPointSnapConstraints, clearSnap, canvasSelection, solveAndRefresh,
    });
    const basicInput = basicDrawingInput || { line: handleLineClick, rectangle: handleRectangleClick, slot: handleSlotClick,
      circle: handleCircleClick, arc: handleArcClick, threePointArc: handleThreePointArcClick };
    const drawingCommandInput = window.DrawingCommandInput.create({
      getMode: readMode, rejectRootSketchCreation, pointCommand, handleLineClick: basicInput.line, handleCenterlineClick,
      handleCircleCenterCrossClick, handleRectangleClick: basicInput.rectangle, handleSlotClick: basicInput.slot, handleFilletClick,
      handleCircleClick: basicInput.circle, handleArcClick: basicInput.arc, handleThreePointArcClick: basicInput.threePointArc,
      handleSplineClick, executeTrimAt, offsetCommand,
    });

    const canvasSelectionInteraction = window.CanvasSelectionInteraction.create({
      canvasSelection, clearSelection, sameArcEndpoint, topmostDrawingOrderOwner, drawingOrderOwner,
      beginDerivedGeometryDrag, beginBlockDrag, beginDimensionDrag, beginReferenceImageDrag,
      buildDragSession, geometryDrag, selectionRectangle,
      capturePointer, setHint, applicationText, updateGeometrySelectionUI, draw,
    });

    return Object.freeze({ instance: instanceCommandInput, annotation: annotationCommandInput, constraint: constraintCommandInput, drawing: drawingCommandInput, selection: canvasSelectionInteraction });
  }
  window.CanvasCommandInputs = Object.freeze({ create });
})();
