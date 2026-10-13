/* Adapt canvas context targets to existing selection and constraint/Fix queries. */
(() => {
  "use strict";
  function createSelection({ canvasSelection, sameArcEndpoint, clearSelection, arcEndpointPoint }) {
    function canvasContextTargetIsSelected(target) {
      if (!target?.item) return false;
      if (target.kind === "point") return canvasSelection.points.includes(target.item);
      if (target.kind === "line") return canvasSelection.lines.includes(target.item);
      if (target.kind === "circle") return canvasSelection.circles.includes(target.item);
      if (target.kind === "arc") return canvasSelection.arcs.includes(target.item);
      if (target.kind === "spline") return canvasSelection.splines.includes(target.item);
      if (target.kind === "arc-endpoint") return sameArcEndpoint(canvasSelection.arcEndpoint, { arc: target.item, endpoint: target.endpoint });
      if (target.kind === "block") return canvasSelection.blockInstances.includes(target.item);
      if (target.kind === "geometry-instance") return canvasSelection.geometryInstances.includes(target.item);
      if (target.kind === "annotation") return canvasSelection.annotations.includes(target.item);
      if (target.kind === "hatch") return canvasSelection.hatches.includes(target.item);
      if (target.kind === "image") return canvasSelection.referenceImages.includes(target.item);
      if (target.kind === "dimension") return canvasSelection.constraintSelectedInCanvas(target.item);
      return false;
    }
    function selectCanvasContextTarget(target, { preserveSelectedSet = true } = {}) {
      if (!target?.item || target.kind === "blank" || (preserveSelectedSet && canvasContextTargetIsSelected(target))) return;
      clearSelection();
      if (target.kind === "point") canvasSelection.set("points", [target.item]);
      else if (target.kind === "line") canvasSelection.set("lines", [target.item]);
      else if (target.kind === "circle") canvasSelection.set("circles", [target.item]);
      else if (target.kind === "arc") canvasSelection.set("arcs", [target.item]);
      else if (target.kind === "spline") canvasSelection.set("splines", [target.item]);
      else if (target.kind === "arc-endpoint") {
        canvasSelection.set("arcs", [target.item]);
        canvasSelection.set("arcEndpoint", { arc: target.item, endpoint: target.endpoint });
      } else if (target.kind === "block") canvasSelection.set("blockInstances", [target.item]);
      else if (target.kind === "geometry-instance") canvasSelection.set("geometryInstances", [target.item]);
      else if (target.kind === "annotation") canvasSelection.set("annotations", [target.item]);
      else if (target.kind === "hatch") canvasSelection.set("hatches", [target.item]);
      else if (target.kind === "image") canvasSelection.set("referenceImages", [target.item]);
      else if (target.kind === "dimension") canvasSelection.set("dimensionConstraint", target.item);
    }
    function constraintHitsFromCanvasContextTarget(target) {
      return {
        hitP: target?.kind === "point" ? target.item : null,
        hitL: target?.kind === "line" ? target.item : null,
        hitC: target?.kind === "circle" ? target.item : null,
        hitA: target?.kind === "arc" ? target.item : null,
        hitS: target?.kind === "spline" ? target.item : null,
        hitArcEnd: target?.kind === "arc-endpoint"
          ? target.hit || { arc: target.item, endpoint: target.endpoint, point: arcEndpointPoint(target.item, target.endpoint) }
          : null,
      };
    }
    return Object.freeze({ isSelected: canvasContextTargetIsSelected, select: selectCanvasContextTarget, constraintHits: constraintHitsFromCanvasContextTarget });
  }

  function createFixObservation({ selectedFixedBatchTargets, fixedBatchIsFullyFixed, canvasSelection, findLineFixedConstraint, findArcEndpointFixedConstraint, selectedGeometryItems }) {
    function state(target) {
      const batch = selectedFixedBatchTargets();
      if (batch && ((target.kind === "point" && batch.points.includes(target.item)) || (target.kind === "line" && batch.lines.includes(target.item)))) {
        return { enabled: true, fixed: fixedBatchIsFullyFixed(batch) };
      }
      if (target.kind === "point") {
        const enabled = canvasSelection.points.length > 0 && canvasSelection.lines.length + canvasSelection.circles.length + canvasSelection.arcs.length + canvasSelection.splines.length + canvasSelection.blockInstances.length === 0 && canvasSelection.annotations.length + canvasSelection.hatches.length === 0 && !canvasSelection.arcEndpoint;
        return { enabled, fixed: enabled && canvasSelection.points.every((point) => point.fixed) };
      }
      if (target.kind === "line") {
        const enabled = canvasSelection.lines.length === 1 && canvasSelection.points.length + canvasSelection.circles.length + canvasSelection.arcs.length + canvasSelection.splines.length + canvasSelection.blockInstances.length === 0 && canvasSelection.annotations.length + canvasSelection.hatches.length === 0 && !canvasSelection.arcEndpoint;
        return { enabled, fixed: Boolean(findLineFixedConstraint(target.item)) };
      }
      if (target.kind === "arc-endpoint") {
        return { enabled: true, fixed: Boolean(findArcEndpointFixedConstraint(target.item, target.endpoint)) };
      }
      if (target.kind === "block") {
        return { enabled: canvasSelection.blockInstances.length === 1 && selectedGeometryItems().length === 0, fixed: Boolean(target.item.fixed) };
      }
      return null;
    }
    return Object.freeze({ state });
  }

  window.CanvasContextTarget = Object.freeze({ createSelection, createFixObservation });
})();
