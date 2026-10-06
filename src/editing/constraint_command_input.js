/* Resolve dimension dragging, pending value placement and constraint operand input. */
(() => {
  "use strict";
  function create({ getPending, getPendingConstraint, canvasSelection, canvasHover, isDimensionConstraintCommandActive,
    beginDimensionDrag, retargetDistancePlaceWithOperand, startDistanceValueInput, constraintTargetHint,
    handleConstraintOperandClick, setHint, updateGeometrySelectionUI, draw, canDragDimensionGroup = () => false }) {
    function click(e, p, { hitD, directGeometryHit, hitP, hitL, hitC, hitA, hitS, hitArcEnd, inactiveHit }) {
      if (hitD && !directGeometryHit && (e.shiftKey || e.ctrlKey) && !getPending() && !getPendingConstraint()) {
        e.preventDefault(); canvasSelection.toggleDimensionConstraint(hitD.constraint); updateGeometrySelectionUI(); draw(); return true;
      }
      if (hitD && !directGeometryHit && !e.shiftKey && !e.ctrlKey && ((!getPending() && !getPendingConstraint()) || isDimensionConstraintCommandActive())) {
        e.preventDefault();
        if (!isDimensionConstraintCommandActive() && !canDragDimensionGroup(hitD)) {
          canvasSelection.clear();
        }
        beginDimensionDrag(e, hitD, p, { hitP, hitL, hitC, hitA, hitArcEnd });
        return true;
      }

      if (getPending()?.type === "distance-place") {
        e.preventDefault();
        if (retargetDistancePlaceWithOperand(p, { hitP, hitL, hitC, hitA, hitArcEnd })) return true;
        startDistanceValueInput(p);
        return true;
      }

      if (getPending()?.type === "distance-value" || getPending()?.type === "offset-value") {
        e.preventDefault();
        return true;
      }

      if (
        getPendingConstraint() &&
        (canvasSelection.dimensionConstraint || canvasSelection.effectiveSelectedConstraint()) &&
        !hitP &&
        !hitL &&
        !hitC &&
        !hitArcEnd &&
        !hitA &&
        !hitS &&
        !hitD &&
        !inactiveHit
      ) {
        e.preventDefault();
        canvasSelection.set("dimensionConstraint", null);
        canvasSelection.set("constraint", null);
        canvasHover.update({ dimension: null });
        setHint(constraintTargetHint(getPendingConstraint().type));
        updateGeometrySelectionUI();
        draw();
        return true;
      }

      if (getPendingConstraint()) {
        e.preventDefault();
        handleConstraintOperandClick(p, getPendingConstraint().type, { hitP, hitL, hitC, hitA, hitS, hitArcEnd });
        return true;
      }

      return false;
    }
    return Object.freeze({ click });
  }
  window.ConstraintCommandInput = Object.freeze({ create });
})();
