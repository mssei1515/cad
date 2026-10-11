/* Prepare geometry and temporary numeric settings before solving; transaction and UI are caller-owned. */
(() => {
  "use strict";
  function create({ solver, types, hasDirectRadiusDimension, unwrapAngleNear, hypot2, arcEndpointPoint,
    lineNormal, offsetChainDraft, vectorNorm, minimumOrientationLength: MIN_ORIENTATION_LENGTH, minimumLineLength: MIN_LINE_LENGTH }) {
    const { Line, Arc, ArcEndpointOnLineConstraint, ArcEndpointCoincidentConstraint,
      ArcEndpointArcEndpointCoincidentConstraint, OffsetConstraint, OffsetChainConstraint } = types;
    function supportLineBasis(line) {
      if (line.orientationHint === "horizontal") {
        return { anchor: { x: line.p1.x, y: (line.p1.y + line.p2.y) / 2 }, nx: 0, ny: 1 };
      }
      if (line.orientationHint === "vertical") {
        return { anchor: { x: (line.p1.x + line.p2.x) / 2, y: line.p1.y }, nx: 1, ny: 0 };
      }
      const dx = line.p2.x - line.p1.x;
      const dy = line.p2.y - line.p1.y;
      const len = Math.hypot(dx, dy);
      if (len < MIN_ORIENTATION_LENGTH) return null;
      return { anchor: line.p1, nx: -dy / len, ny: dx / len };
    }

    function preconditionArcEndpointOnLineConstraint(constraint) {
      solver.syncLineOrientationHints?.();
      const basis = supportLineBasis(constraint.line);
      if (!basis) return;
      const arc = constraint.arc;
      const prop = constraint.endpoint === "start" ? "startAngle" : "endAngle";
      const current = arc[prop];
      let radius = arc.radius();
      const offset = basis.nx * (arc.center.x - basis.anchor.x) + basis.ny * (arc.center.y - basis.anchor.y);
      let k = -offset / radius;
      if (Math.abs(k) > 1 && !hasDirectRadiusDimension(arc)) {
        arc.radiusValue = Math.max(Math.abs(offset) + MIN_LINE_LENGTH, MIN_LINE_LENGTH);
        radius = arc.radius();
        k = -offset / radius;
      }
      if (Math.abs(k) > 1) return;

      const normalAngle = Math.atan2(basis.ny, basis.nx);
      const delta = Math.acos(Math.max(-1, Math.min(1, k)));
      const candidates = [normalAngle + delta, normalAngle - delta].map((angle) => unwrapAngleNear(angle, current));
      arc[prop] = candidates.reduce((best, angle) => (Math.abs(angle - current) < Math.abs(best - current) ? angle : best), candidates[0]);
    }

    function preconditionArcEndpointToPoint(arc, endpoint, point) {
      if (!arc || !point) return;
      const dx = point.x - arc.center.x;
      const dy = point.y - arc.center.y;
      const distance = hypot2(dx, dy);
      if (distance < MIN_LINE_LENGTH) return;
      if (!hasDirectRadiusDimension(arc)) arc.radiusValue = Math.max(distance, MIN_LINE_LENGTH);
      const prop = endpoint === "start" ? "startAngle" : "endAngle";
      arc[prop] = unwrapAngleNear(Math.atan2(dy, dx), arc[prop]);
    }

    function preconditionArcEndpointCoincidentConstraint(constraint) {
      preconditionArcEndpointToPoint(constraint.arc, constraint.endpoint, constraint.point);
    }

    function preconditionArcEndpointArcEndpointCoincidentConstraint(constraint) {
      const aPoint = arcEndpointPoint(constraint.a, constraint.endpointA);
      const bPoint = arcEndpointPoint(constraint.b, constraint.endpointB);
      if (hasDirectRadiusDimension(constraint.a) && !hasDirectRadiusDimension(constraint.b)) {
        preconditionArcEndpointToPoint(constraint.b, constraint.endpointB, aPoint);
      } else {
        preconditionArcEndpointToPoint(constraint.a, constraint.endpointA, bPoint);
      }
    }

    function preconditionOffsetConstraint(constraint) {
      if (!(constraint instanceof OffsetConstraint)) return;
      const { source, offset, target, sign } = constraint;
      if (source instanceof Line && offset instanceof Line) {
        const normal = lineNormal(source);
        const dx = normal.x * sign * target;
        const dy = normal.y * sign * target;
        offset.p1.x = source.p1.x + dx;
        offset.p1.y = source.p1.y + dy;
        offset.p2.x = source.p2.x + dx;
        offset.p2.y = source.p2.y + dy;
        return;
      }
      offset.center.x = source.center.x;
      offset.center.y = source.center.y;
      offset.radiusValue = Math.max(MIN_ORIENTATION_LENGTH, source.radius() + sign * target);
      if (source instanceof Arc && offset instanceof Arc) {
        offset.startAngle = source.startAngle;
        offset.endAngle = source.endAngle;
      }
    }

    function preconditionOffsetChainConstraint(constraint) {
      if (!(constraint instanceof OffsetChainConstraint)) return;
      const plan = offsetChainDraft(
        constraint.sources.map((geometry, index) => ({ geometry, reversed: Boolean(constraint.sourceReversed[index]) })),
        constraint.target,
        constraint.side,
        constraint.closed,
      );
      if (!plan.ok || plan.geometries.length !== constraint.offsets.length) return;
      plan.geometries.forEach((planned, index) => {
        const offset = constraint.offsets[index];
        if (planned instanceof Line && offset instanceof Line) {
          offset.p1.x = planned.p1.x;
          offset.p1.y = planned.p1.y;
          offset.p2.x = planned.p2.x;
          offset.p2.y = planned.p2.y;
        } else if (planned instanceof Arc && offset instanceof Arc) {
          offset.center.x = planned.center.x;
          offset.center.y = planned.center.y;
          offset.radiusValue = planned.radiusValue;
          offset.startAngle = planned.startAngle;
          offset.endAngle = planned.endAngle;
        }
      });
    }

    function preconditionNewConstraint(constraint) {
      if (constraint instanceof ArcEndpointOnLineConstraint) {
        preconditionArcEndpointOnLineConstraint(constraint);
      } else if (constraint instanceof ArcEndpointCoincidentConstraint) {
        preconditionArcEndpointCoincidentConstraint(constraint);
      } else if (constraint instanceof ArcEndpointArcEndpointCoincidentConstraint) {
        preconditionArcEndpointArcEndpointCoincidentConstraint(constraint);
      } else if (constraint instanceof OffsetConstraint) {
        preconditionOffsetConstraint(constraint);
      } else if (constraint instanceof OffsetChainConstraint) {
        preconditionOffsetChainConstraint(constraint);
      }
    }

    function solveStepNormForConstraint(constraint) {
      if (!constraint) return solver.maxStepNorm;
      const e = constraint.error();
      const values = Array.isArray(e) ? e : [e];
      const errorNorm = vectorNorm(values);
      return Math.max(solver.maxStepNorm, errorNorm * 1.5);
    }

    function withTemporarySolveStepNorm(stepNorm, callback) {
      const previous = solver.maxStepNorm;
      solver.maxStepNorm = Math.max(previous, Number.isFinite(stepNorm) ? stepNorm : previous);
      try {
        return callback();
      } finally {
        solver.maxStepNorm = previous;
      }
    }
    return Object.freeze({ precondition: preconditionNewConstraint,
      stepNorm: solveStepNormForConstraint, withStepNorm: withTemporarySolveStepNorm });
  }
  window.ConstraintSolvePreparation = Object.freeze({ create });
})();
