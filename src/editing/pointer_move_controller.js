/* Route pointer moves through existing interactions in their established priority order. */
(() => {
  "use strict";
  function create({ canvasNavigation, drawingPreview, canvasHover, clearSnap, draw,
    selectionRectangle, annotationDrag, referenceImageInteraction, dimensionDrag, geometryDrag, pointerHover,
    getMode, getPendingCommand, getPendingConstraintCommand, setLastPointer,
    updateHatchPreview, updateFilletRadiusPlacement, updatePendingDistanceRetargetHover,
    hitDimension, hitSketchIdentityElement }) {
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
    return Object.freeze({ move });
  }
  window.PointerMoveController = Object.freeze({ create });
})();
