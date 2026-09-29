/* Apply initial dimension scale without owning command acceptance or viewport state. */
(() => {
  "use strict";
  const { Line, LineFixedConstraint, GeometryFixedConstraint, hypot2 } = window.GeometrySolver;
  const { signedPointLineDistance } = window.GeometryKernel;
  function create({ currentScope, activeSketchId, constraintSketchId, elementSketchId, sketchGeometryBounds, minLength }) {
    function scalePointAbout(point, origin, scale) {
      point.x = origin.x + (point.x - origin.x) * scale;
      point.y = origin.y + (point.y - origin.y) * scale;
    }

    function scaleValueAbout(value, originValue, scale) {
      return originValue + (value - originValue) * scale;
    }

    function scaleDimensionAbout(dimension, origin, scale) {
      if (!dimension) return dimension;
      for (const key of ["x", "labelX"]) {
        if (Number.isFinite(dimension[key])) dimension[key] = scaleValueAbout(dimension[key], origin.x, scale);
      }
      for (const key of ["y", "labelY"]) {
        if (Number.isFinite(dimension[key])) dimension[key] = scaleValueAbout(dimension[key], origin.y, scale);
      }
      for (const key of ["offsetU", "offsetN", "labelOffsetU", "angleRadius", "angleLabelOffsetR", "angleLabelOffsetT"]) {
        if (Number.isFinite(dimension[key])) dimension[key] *= scale;
      }
      return dimension;
    }

    function currentTargetValue(target) {
      if (!target) return NaN;
      if (target.kind === "point-point") {
        if (target.dimensionAxis === "x") return Math.abs(target.p2.x - target.p1.x);
        if (target.dimensionAxis === "y") return Math.abs(target.p2.y - target.p1.y);
        return hypot2(target.p2.x - target.p1.x, target.p2.y - target.p1.y);
      }
      if (target.kind === "line-length") return target.line.length();
      if (target.kind === "point-line") return Math.abs(signedPointLineDistance(target.point, target.line));
      if (target.kind === "line-line") return Math.abs(signedPointLineDistance(target.line1.p1, target.line2));
      if (target.kind === "line-circle") return Math.abs(signedPointLineDistance(target.circle.center, target.line));
      if (target.kind === "radius-difference") return Math.abs(target.b.radius() - target.a.radius());
      if (target.kind === "radius") return target.primitive.radius();
      if (target.kind === "diameter") return target.primitive.radius() * 2;
      if (target.kind === "offset-distance") {
        if (target.source instanceof Line) return Math.abs(signedPointLineDistance(target.offset.p1, target.source));
        return Math.abs(target.offset.radius() - target.source.radius());
      }
      return target.value;
    }

    function sketchHasReferenceConstraint(sketchId = activeSketchId()) {
      return currentScope().constraints.some((constraint) => constraintSketchId(constraint) === sketchId && constraint.reference);
    }

    function sketchHasFixedGeometry(sketchId = activeSketchId()) {
      if (currentScope().points.some((point) => elementSketchId(point) === sketchId && point.fixed)) return true;
      return currentScope().constraints.some((constraint) => constraintSketchId(constraint) === sketchId && (constraint instanceof LineFixedConstraint || constraint instanceof GeometryFixedConstraint));
    }

    function scaleSketchForFirstDimension(sketchId, target, targetValue, dimension) {
      if (!sketchId || target?.kind === "angle" || sketchHasReferenceConstraint(sketchId) || sketchHasFixedGeometry(sketchId)) return false;
      const current = currentTargetValue(target);
      if (!Number.isFinite(current) || current <= minLength || !Number.isFinite(targetValue) || targetValue <= 0) return false;
      const scale = targetValue / current;
      if (!Number.isFinite(scale) || scale <= 0 || Math.abs(scale - 1) < 1e-9) return false;
      const bounds = sketchGeometryBounds(sketchId);
      if (!bounds) return false;
      const origin = { x: (bounds.x1 + bounds.x2) / 2, y: (bounds.y1 + bounds.y2) / 2 };
      for (const point of currentScope().points) {
        if (elementSketchId(point) === sketchId) scalePointAbout(point, origin, scale);
      }
      for (const circle of currentScope().circles) {
        if (elementSketchId(circle) === sketchId) circle.radiusValue = Math.max(minLength, circle.radiusValue * scale);
      }
      for (const arc of currentScope().arcs) {
        if (elementSketchId(arc) === sketchId) arc.radiusValue = Math.max(minLength, arc.radiusValue * scale);
      }
      scaleDimensionAbout(dimension, origin, scale);
      return true;
    }


    return Object.freeze({ scaleSketchForFirstDimension });
  }
  window.FirstDimensionScaling = Object.freeze({ create });
})();
