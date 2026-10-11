/* Construct dimension constraints from explicit target and placement values without editing a model. */
(() => {
  "use strict";
  function create({ types, linesAreParallel }) {
    const { PointAxisDistanceConstraint, DistanceConstraint, PointLineDistanceConstraint, LineLineDistanceConstraint,
      LineCircleDistanceConstraint, ConcentricRadiusDifferenceConstraint, LineAngleConstraint, RadiusConstraint, DiameterConstraint } = types;
    function fromTarget(target, value, dimension) {
      if (!target || target.kind === "invalid") return { constraint: null };
      let constraint = null;
      if (target.kind === "point-point" || target.kind === "line-length") {
        const axis = target.dimensionAxis || dimension?.axis;
        constraint = target.kind === "point-point" && (axis === "x" || axis === "y")
          ? new PointAxisDistanceConstraint(target.p1, target.p2, value, axis)
          : new DistanceConstraint(target.p1, target.p2, value);
      } else if (target.kind === "point-line") {
        constraint = new PointLineDistanceConstraint(target.point, target.line, value);
      } else if (target.kind === "line-line") {
        if (!linesAreParallel(target.line1, target.line2)) {
          return { constraint: null, error: "線-線寸法は平行線のみです" };
        }
        constraint = new LineLineDistanceConstraint(target.line1, target.line2, value);
      } else if (target.kind === "line-circle") {
        constraint = new LineCircleDistanceConstraint(target.line, target.circle, value);
      } else if (target.kind === "radius-difference") {
        constraint = new ConcentricRadiusDifferenceConstraint(target.a, target.b, value);
      } else if (target.kind === "angle") {
        constraint = new LineAngleConstraint(target.line1, target.line2, (value * Math.PI) / 180, dimension?.angleStartFlip || 0, dimension?.angleEndFlip || 0);
      } else if (target.kind === "radius") {
        constraint = new RadiusConstraint(target.primitive, value);
      } else if (target.kind === "diameter") {
        constraint = new DiameterConstraint(target.primitive, value);
      }
      if (constraint) {
        constraint.dimension = dimension;
        if (dimension && ["radius", "diameter"].includes(target.kind)) {
          constraint.dimension = { ...dimension, display: { ...dimension.display, prefix: target.kind === "diameter" ? "Φ" : "R" } };
        }
      }
      return { constraint };
    }

    return Object.freeze({ fromTarget });
  }
  window.DimensionConstraintFactory = Object.freeze({ create });
})();
