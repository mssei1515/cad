/* Apply trim plans and preserve the existing geometry/constraint transfer rules. */
(function () {
  "use strict";
  const { Line, Arc, Circle, DiameterConstraint, HorizontalConstraint, VerticalConstraint, ParallelConstraint, PerpendicularConstraint, CollinearConstraint, LineAngleConstraint, SymmetryConstraint, LineSymmetryConstraint, ArcSymmetryConstraint, PointOnLineConstraint, ParallelLinesCenterlineConstraint, PointPairCenterlineConstraint, ArcEndpointOnLineConstraint, PointLineDistanceConstraint, LineLineDistanceConstraint, LineCircleDistanceConstraint, LineCircleTangentConstraint, PointOnCircleConstraint, ArcEndpointOnCircleConstraint } = window.GeometrySolver;
  const { arcEndpointPoint, angleAtArcParam } = window.GeometryKernel;
  function create({ currentScope, geometry, references, query, pushModelConstraint, elementSketchId, isPointUsedByPrimitive, isReferencePoint, minArcLength: MIN_ARC_LENGTH }) {
    const { addPoint, addLine, addArc, enforceMinimumLineLengths, normalizeArcSweeps } = geometry;
    const { constraintReferencesPoint, constraintReferencesLine, constraintReferencesPrimitive } = references;
    const { lineParam, angleAtCircleParam } = query;
    function cleanupTrimConstraints(item, options = {}) {
      currentScope().constraints = currentScope().constraints.filter((c) => {
        if (item instanceof Line && constraintReferencesLine(c, item)) return options.preserveLineSupport && shouldPreserveTrimmedLineConstraint(c, item);
        if (item instanceof Arc && constraintReferencesPrimitive(c, item)) return false;
        if (item instanceof Circle && constraintReferencesPrimitive(c, item)) {
          return Boolean(options.preserveDiameterDimensions && c instanceof DiameterConstraint && c.primitive === item);
        }
        return true;
      });
    }

    function shouldPreserveTrimmedLineConstraint(c, line) {
      if (c instanceof HorizontalConstraint || c instanceof VerticalConstraint) return true;
      if (c instanceof ParallelConstraint || c instanceof PerpendicularConstraint || c instanceof CollinearConstraint || c instanceof LineAngleConstraint) return true;
      if (c instanceof SymmetryConstraint && c.axis === line) return true;
      if (c instanceof LineSymmetryConstraint && c.axis === line) return true;
      if (c instanceof ArcSymmetryConstraint && c.axis === line) return true;
      if (c instanceof PointOnLineConstraint || c instanceof ParallelLinesCenterlineConstraint || c instanceof PointPairCenterlineConstraint || c instanceof ArcEndpointOnLineConstraint) return true;
      if (c instanceof PointLineDistanceConstraint || c instanceof LineLineDistanceConstraint || c instanceof LineCircleDistanceConstraint || c instanceof LineCircleTangentConstraint) return true;
      return false;
    }

    function cloneTrimmedLineConstraint(c, sourceLine, targetLine) {
      if (c instanceof HorizontalConstraint && c.line === sourceLine) return new HorizontalConstraint(targetLine);
      if (c instanceof VerticalConstraint && c.line === sourceLine) return new VerticalConstraint(targetLine);
      if (c instanceof ParallelConstraint) {
        if (c.line1 === sourceLine) return new ParallelConstraint(targetLine, c.line2);
        if (c.line2 === sourceLine) return new ParallelConstraint(c.line1, targetLine);
      }
      if (c instanceof PerpendicularConstraint) {
        if (c.line1 === sourceLine) return new PerpendicularConstraint(targetLine, c.line2);
        if (c.line2 === sourceLine) return new PerpendicularConstraint(c.line1, targetLine);
      }
      if (c instanceof CollinearConstraint) {
        if (c.line1 === sourceLine) return new CollinearConstraint(targetLine, c.line2);
        if (c.line2 === sourceLine) return new CollinearConstraint(c.line1, targetLine);
      }
      if (c instanceof LineAngleConstraint) {
        if (c.line1 === sourceLine) return new LineAngleConstraint(targetLine, c.line2, c.target, c.startFlip, c.endFlip);
        if (c.line2 === sourceLine) return new LineAngleConstraint(c.line1, targetLine, c.target, c.startFlip, c.endFlip);
      }
      return null;
    }

    function cloneTrimmedLineConstraints(sourceLine, targetLine) {
      const clones = currentScope().constraints.map((c) => cloneTrimmedLineConstraint(c, sourceLine, targetLine)).filter(Boolean);
      for (const clone of clones) pushModelConstraint(clone, elementSketchId(sourceLine));
    }

    function trimmedLinePointConstraintAnchor(constraint, line) {
      if (constraint instanceof PointOnLineConstraint && constraint.line === line) return constraint.point;
      if (constraint instanceof ArcEndpointOnLineConstraint && constraint.line === line) return arcEndpointPoint(constraint.arc, constraint.endpoint);
      return null;
    }

    function captureRightTrimmedLinePointConstraints(line, rightBoundaryT) {
      return currentScope().constraints.filter((constraint) => {
        const anchor = trimmedLinePointConstraintAnchor(constraint, line);
        return anchor && lineParam(line, anchor) >= rightBoundaryT - 1e-6;
      });
    }

    function retargetTrimmedLinePointConstraints(constraints, sourceLine, targetLine) {
      for (const constraint of constraints) {
        if (constraint.line !== sourceLine) continue;
        constraint.line = targetLine;
        if (constraint instanceof PointOnLineConstraint) constraint.name = new PointOnLineConstraint(constraint.point, targetLine).name;
        else if (constraint instanceof ArcEndpointOnLineConstraint) constraint.name = new ArcEndpointOnLineConstraint(constraint.arc, constraint.endpoint, targetLine).name;
      }
    }

    function addBoundaryPointConstraint(point, boundary) {
      const source = boundary?.source || {};
      if (source.line) pushModelConstraint(new PointOnLineConstraint(point, source.line));
      else if (source.primitive) pushModelConstraint(new PointOnCircleConstraint(point, source.primitive));
      else if (source.arc) pushModelConstraint(new PointOnCircleConstraint(point, source.arc));
    }

    function addArcBoundaryConstraint(arc, endpoint, boundary) {
      const source = boundary?.source || {};
      if (source.line) pushModelConstraint(new ArcEndpointOnLineConstraint(arc, endpoint, source.line));
      else if (source.primitive) pushModelConstraint(new ArcEndpointOnCircleConstraint(arc, endpoint, source.primitive));
      else if (source.arc) pushModelConstraint(new ArcEndpointOnCircleConstraint(arc, endpoint, source.arc));
    }

    function removeTrimmedItem(item) {
      cleanupTrimConstraints(item);
      if (item instanceof Line) {
        const endpoints = [item.p1, item.p2];
        currentScope().lines = currentScope().lines.filter((line) => line !== item);
        removeOrphanTrimmedEndpoints(endpoints);
      } else if (item instanceof Circle) {
        const center = item.center;
        currentScope().circles = currentScope().circles.filter((circle) => circle !== item);
        currentScope().points = currentScope().points.filter((point) => point !== center || point.kind !== "endpoint" || isPointUsedByPrimitive(point) || isReferencePoint(point));
      } else if (item instanceof Arc) {
        const center = item.center;
        currentScope().arcs = currentScope().arcs.filter((arc) => arc !== item);
        currentScope().points = currentScope().points.filter((point) => point !== center || point.kind !== "endpoint" || isPointUsedByPrimitive(point) || isReferencePoint(point));
      }
    }

    function removeOrphanTrimmedEndpoints(points) {
      const removable = points.filter((point) => point?.kind === "endpoint" && !isPointUsedByPrimitive(point));
      if (removable.length === 0) return;
      currentScope().constraints = currentScope().constraints.filter((constraint) => !removable.some((point) => constraintReferencesPoint(constraint, point)));
      currentScope().points = currentScope().points.filter((point) => !removable.includes(point));
    }

    function executeLineTrim(preview) {
      const line = preview.item;
      if (preview.deleteWhole) {
        removeTrimmedItem(line);
        return;
      }
      const { left, right } = preview.interval;
      cleanupTrimConstraints(line, { preserveLineSupport: true });
      if (left.t <= 1e-6) {
        const p = addPoint(right.point.x, right.point.y, false, "endpoint");
        line.p1 = p;
        addBoundaryPointConstraint(p, right);
      } else if (right.t >= 1 - 1e-6) {
        const p = addPoint(left.point.x, left.point.y, false, "endpoint");
        line.p2 = p;
        addBoundaryPointConstraint(p, left);
      } else {
        const rightSidePointConstraints = captureRightTrimmedLinePointConstraints(line, right.t);
        const oldP2 = line.p2;
        const pLeft = addPoint(left.point.x, left.point.y, false, "endpoint");
        const pRight = addPoint(right.point.x, right.point.y, false, "endpoint");
        line.p2 = pLeft;
        const newLine = addLine(pRight, oldP2, line.construction);
        if (newLine) {
          cloneTrimmedLineConstraints(line, newLine);
          retargetTrimmedLinePointConstraints(rightSidePointConstraints, line, newLine);
        }
        addBoundaryPointConstraint(pLeft, left);
        addBoundaryPointConstraint(pRight, right);
      }
      enforceMinimumLineLengths([line]);
    }

    function executeArcTrim(preview) {
      const arc = preview.item;
      if (preview.deleteWhole) {
        removeTrimmedItem(arc);
        return;
      }
      const { left, right } = preview.interval;
      cleanupTrimConstraints(arc);
      if (left.t <= 1e-6) {
        arc.startAngle = angleAtArcParam(arc, right.t);
        addArcBoundaryConstraint(arc, "start", right);
      } else if (right.t >= 1 - 1e-6) {
        arc.endAngle = angleAtArcParam(arc, left.t);
        addArcBoundaryConstraint(arc, "end", left);
      } else {
        const oldEnd = arc.endAngle;
        arc.endAngle = angleAtArcParam(arc, left.t);
        const newArc = addArc(arc.center, arc.radius(), angleAtArcParam(arc, right.t), oldEnd, arc.construction);
        addArcBoundaryConstraint(arc, "end", left);
        if (newArc) addArcBoundaryConstraint(newArc, "start", right);
      }
      normalizeArcSweeps();
    }

    function executeCircleTrim(preview) {
      const circle = preview.item;
      if (preview.deleteWhole) {
        removeTrimmedItem(circle);
        return;
      }
      const diameterDimensions = currentScope().constraints.filter((constraint) => constraint instanceof DiameterConstraint && constraint.primitive === circle);
      cleanupTrimConstraints(circle, { preserveDiameterDimensions: true });
      const kept = [];
      const boundaries = preview.boundaries || [];
      for (let i = 0; i < boundaries.length; i++) {
        const left = boundaries[i];
        const right = boundaries[(i + 1) % boundaries.length];
        const wraps = left.t > right.t;
        const start = angleAtCircleParam(left.t);
        const end = angleAtCircleParam(right.t) + (wraps ? Math.PI * 2 : 0);
        const sameRemoved = Math.abs(left.t - preview.interval.left.t) <= 1e-6 && Math.abs(right.t - preview.interval.right.t) <= 1e-6;
        if (sameRemoved || (end - start) * circle.radius() < MIN_ARC_LENGTH) continue;
        const arc = addArc(circle.center, circle.radius(), start, end, circle.construction);
        if (arc) {
          addArcBoundaryConstraint(arc, "start", left);
          addArcBoundaryConstraint(arc, "end", right);
          kept.push(arc);
        }
      }
      currentScope().circles = currentScope().circles.filter((item) => item !== circle);
      if (kept.length === 1) {
        for (const constraint of diameterDimensions) {
          constraint.primitive = kept[0];
          constraint.name = new DiameterConstraint(kept[0], constraint.target).name;
        }
      } else if (diameterDimensions.length > 0) {
        currentScope().constraints = currentScope().constraints.filter((constraint) => !diameterDimensions.includes(constraint));
      }
      if (kept.length === 0) currentScope().points = currentScope().points.filter((p) => p !== circle.center || isPointUsedByPrimitive(p));
    }
    return Object.freeze({ executeLineTrim, executeArcTrim, executeCircleTrim });
  }
  window.TrimEditing = Object.freeze({ create });
})();
