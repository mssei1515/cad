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
  // Resolve the provisional operand without owning pending-command or hover state.
  function createRetargetHover({ getPending, canvasHover, hitConstraintOperand, sameConstraintOperand,
    resolveConstraintIntent, referenceTargetFromOperand, Circle, Arc }) {
    function applyReferenceHoverTarget(referenceTarget) {
      canvasHover.update({ point: referenceTarget?.kind === "point" ? referenceTarget.point : null });
      canvasHover.update({
        endpointPoint: canvasHover.current.point, line: referenceTarget?.kind === "line" ? referenceTarget.line : null, circle: referenceTarget?.primitive instanceof Circle ? referenceTarget.primitive : null,
        arc: referenceTarget?.primitive instanceof Arc ? referenceTarget.primitive : null, arcEndpoint: null, dimension: null,
      });
    }

    function update(pointer) {
      if (getPending()?.type !== "distance-place" || !["line-length", "radius", "diameter"].includes(getPending().target.kind)) {
        canvasHover.update({
          point: null, endpointPoint: null, line: null,
          circle: null, arc: null,
        });
        return false;
      }
      const baseOperands = (getPending().operands || []).filter(Boolean);
      const operand = baseOperands.length === 1 ? hitConstraintOperand(pointer, "distance") : null;
      const resolution = operand && !sameConstraintOperand(baseOperands[0], operand)
        ? resolveConstraintIntent("distance", [baseOperands[0], operand])
        : null;
      const target = resolution?.target && resolution.target.kind !== "invalid" ? referenceTargetFromOperand(operand) : null;
      const changed =
        (target?.kind === "point" ? target.point : null) !== canvasHover.current.point ||
        (target?.kind === "line" ? target.line : null) !== canvasHover.current.line ||
        (target?.primitive instanceof Circle ? target.primitive : null) !== canvasHover.current.circle ||
        (target?.primitive instanceof Arc ? target.primitive : null) !== canvasHover.current.arc ||
        canvasHover.current.arcEndpoint ||
        canvasHover.current.dimension;
      applyReferenceHoverTarget(target);
      canvasHover.update({
        arcEndpoint: null, block: null,
      });
      return changed;
    }


    return Object.freeze({ update });
  }
  window.ConstraintCommandInput = Object.freeze({ create, createRetargetHover });
})();
