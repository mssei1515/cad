/* Route pointer press, movement and completion through existing interactions in their established priority order. */
(() => {
  "use strict";
  function create({ canvasNavigation, drawingPreview, canvasHover, clearSnap, draw, transientAuthoring, recordHistory,
    selectionRectangle, annotationDrag, referenceImageInteraction, dimensionDrag, geometryDrag, pointerHover,
    getMode, getPendingCommand, getPendingConstraintCommand, setLastPointer,
    updateHatchPreview, updateFilletRadiusPlacement, updatePendingDistanceRetargetHover,
    hitDimension, hitSketchIdentityElement, press }) {
    function down(e) {
      if (e.button === 2) {
        e.preventDefault();
        return;
      }
      press.closeContextMenu();
      if (e.button === 1) {
        canvasNavigation.beginPan(e);
        return;
      }

      const p = press.worldPoint(e);
      setLastPointer(p);
      const hits = press.query.read(p);
      const { hitP, hitL, hitC, hitArcEnd, hitA, hitS, hatchHit, referenceImageHit, hitD, hitBlockHandle, hitBlock, hitDerivedGeometry, hitDerivedInstance, directGeometryHit, sketchIdentity, inactiveHit, blankAnnotationHit, annotationTargetHit } = hits;
      canvasHover.update({ sketchIdentity });

      const referenceDimension = hitD || press.referenceDimensionAt?.(p);
      if (referenceDimension && press.insertDimensionParameter(e, referenceDimension)) return;

      if (getMode() === "hatch" || getMode() === "hatch-repair") {
        e.preventDefault();
        press.commitHatch(p);
        return;
      }

      if (referenceImageInteraction.calibrating) {
        e.preventDefault();
        press.calibrateImage(p);
        return;
      }

      if (press.inputs.instance.click(e, p, { hitP, hitL, hitC, hitA, hitS, hatchHit })) return;

      const blankDoubleClickHits = { hitP, hitL, hitC, hitArcEnd, hitA, hitS, hitD, hitBlock, hitDerivedInstance, hatchHit, referenceImageHit, inactiveHit, annotationHit: blankAnnotationHit };
      if (press.blankGesture.isRepeated(press.screenPoint(e), blankDoubleClickHits) && press.blankGesture.handle(p, blankDoubleClickHits)) {
        press.blankGesture.suppressNext();
        e.preventDefault();
        return;
      }

      if (press.inputs.annotation.place(e, p, annotationTargetHit)) return;

      if (getPendingCommand()?.type === "fillet-radius-place") {
        e.preventDefault();
        press.placeFilletRadius(p);
        return;
      }

      if (getMode() === "select" && !getPendingCommand() && !getPendingConstraintCommand()) {
        if (inactiveHit && press.selectInactive) { press.selectInactive(e, inactiveHit); return; }
        if (press.prepareSelection?.(e, hits)) return;
      }
      if (press.inputs.annotation.select(e, p, { blankAnnotationHit, directGeometryHit, hitD })) return;

      if (press.inputs.constraint.click(e, p, { hitD, directGeometryHit, hitP, hitL, hitC, hitA, hitS, hitArcEnd, inactiveHit })) return;

      if (getMode() === "block-place") {
        e.preventDefault();
        press.placeBlock(p);
        return;
      }

      if (press.inputs.drawing.click(e, p, { hitP, hitL, hitC, hitA })) return;

      press.inputs.selection.begin(e, p, { hitP, hitL, hitC, hitA, hitS, hitArcEnd, hitD, hitDerivedGeometry, hitDerivedInstance, hitBlock, hitBlockHandle, hatchHit, referenceImageHit, directGeometryHit });
    }

    function doubleClick(e) {
      const activation = press.activation;
      if (press.blankGesture.takeSuppression()) {
        e.preventDefault();
        return;
      }
      const p = press.worldPoint(e);
      if (getMode() === "select" && !getPendingCommand() && !getPendingConstraintCommand() && press.query.read?.(p).inactiveHit) {
        e.preventDefault();
        return;
      }
      if (getMode() === "select" && !getPendingCommand() && !getPendingConstraintCommand()
        && activation.selection.instanceGeometry && press.query.derivedGeometryAt(p)?.instance.id === activation.selection.instanceGeometry.instanceId) {
        e.preventDefault();
        return;
      }
      const { hitL, hitP, hitC, hitArcEnd, hitA, hitS, hitD, hitBlock } = press.query.readDoubleClick(p);
      if (getMode() === "spline") {
        e.preventDefault();
        activation.finalizeSpline(p);
        return;
      }
      if (getPendingCommand()?.type === "offset-value") {
        e.preventDefault();
        activation.submitOffset();
        return;
      }
      if (!getPendingCommand() && hitD && activation.startDimensionEdit(hitD)) {
        e.preventDefault();
        return;
      }
      if (getPendingCommand()?.type?.startsWith("distance")) {
        e.preventDefault();
        if (getPendingCommand().type === "distance-place") {
          activation.startDistanceValue(p);
        }
        activation.submitDistance();
        return;
      }
      if (activation.constraintDoubleClick(hitP, hitL, p)) {
        e.preventDefault();
        return;
      }
      if (!getPendingCommand() && !getPendingConstraintCommand() && hitBlock) {
        e.preventDefault();
        activation.enterBlock(hitBlock.definitionId);
        return;
      }
      if (!getPendingCommand() && !getPendingConstraintCommand() && hitS && !hitS.blockProjection) {
        e.preventDefault();
        activation.beginSplineEdit(hitS);
        return;
      }
      if (press.blankGesture.handle(p, { hitP, hitL, hitC, hitArcEnd, hitA, hitS, hitD })) {
        e.preventDefault();
        return;
      }
    }

    function leave() {
      if (geometryDrag.active || dimensionDrag.active || annotationDrag.active || selectionRectangle.active || canvasNavigation.panning) return;
      press.discardMove();
      canvasHover.clear();
      draw();
    }

    function move(screenPoint, p, shiftKey) {
      if (canvasNavigation.movePan(screenPoint)) return;

      setLastPointer(p);
      if (getMode().startsWith("free-instance-")) {
        drawingPreview.updateFreeInstance(p);
        return;
      }
      if (getMode() === "hatch" || getMode() === "hatch-repair") {
        clearSnap();
        canvasHover.clear();
        drawingPreview.setPointer(p);
        updateHatchPreview(p);
        draw();
        return;
      }
      if (selectionRectangle.active) {
        clearSnap();
        canvasHover.update({ sketchIdentity: null });
        selectionRectangle.update(p);
        draw();
        return;
      }

      if (annotationDrag.active) {
        clearSnap();
        annotationDrag.update(p);
        return;
      }

      if (referenceImageInteraction.dragging) {
        clearSnap();
        referenceImageInteraction.updateDrag(p);
        return;
      }

      if (referenceImageInteraction.calibrating) {
        clearSnap();
        canvasHover.clear();
        draw();
        return;
      }

      if (getPendingCommand()?.type === "annotation-leader-place" || getPendingCommand()?.type === "annotation-text-place") {
        getPendingCommand().pointer = p;
        canvasHover.update({
          point: null, endpointPoint: null, line: null,
          circle: null, arcEndpoint: null, arc: null,
          dimension: null, sketchIdentity: null,
        });
        draw();
        return;
      }

      if (getPendingCommand()?.type === "fillet-radius-place") {
        clearSnap();
        canvasHover.update({
          point: null, endpointPoint: null, line: null,
          circle: null, arcEndpoint: null, arc: null,
          dimension: null, sketchIdentity: null,
        });
        updateFilletRadiusPlacement(p);
        draw();
        return;
      }

      if (dimensionDrag.active) {
        dimensionDrag.update(p);
        return;
      }

      if (drawingPreview.updateAuthoring(getMode(), p, shiftKey)) return;

      if (getPendingCommand()?.type === "distance-place") {
        clearSnap();
        const hitD = hitDimension(p.x, p.y);
        canvasHover.update({ sketchIdentity: hitSketchIdentityElement(p.x, p.y, { allowInactiveGeometry: true }) });
        getPendingCommand().pointer = p;
        getPendingCommand().dimension = null;
        updatePendingDistanceRetargetHover(p);
        if (hitD) {
          canvasHover.update({
            point: null, endpointPoint: null, line: null,
            circle: null, arcEndpoint: null, arc: null,
            dimension: hitD.constraint,
          });
        }
        draw();
        return;
      }

      if (getMode() === "trim") { drawingPreview.updateTrim(p); return; }
      if (getMode() === "offset") { drawingPreview.updateOffset(p, getPendingCommand()?.type === "offset-value"); return; }

      if (getPendingConstraintCommand() && !geometryDrag.active) {
        if (pointerHover.updateConstraint(p, getPendingConstraintCommand().type)) draw();
        return;
      }
      if (!geometryDrag.active && pointerHover.updateOrdinary(p)) draw();

      geometryDrag.update(p);
    }
    function finish(e) {
      if (canvasNavigation.endPan(e)) return;

      if (referenceImageInteraction.finishDrag(e)) return;

      if (annotationDrag.finish(e)) return;

      if (dimensionDrag.finish(e)) return;

      if (selectionRectangle.finish(e)) return;

      if (geometryDrag.finish(e)) return;
      // The first Line endpoint is provisional until a segment is completed.
      if (!transientAuthoring.hasLineStart) recordHistory("操作");
    }
    return Object.freeze({ down, doubleClick, leave, move, finish });
  }
  window.PointerInteractionController = Object.freeze({ create });
})();
