/* Constraint candidates from explicit geometry targets; commit and selection are caller-owned. */
(function () {
  "use strict";
  const { Circle, Arc, hypot2, CoincidentConstraint, PointOnLineConstraint, PointOnCircleConstraint, PointOnSplineConstraint, CollinearConstraint, ConcentricConstraint, ArcEndpointCoincidentConstraint, ArcEndpointOnLineConstraint, ArcEndpointOnCircleConstraint, PointHorizontalConstraint, PointVerticalConstraint, ParallelConstraint, PerpendicularConstraint, EqualLengthConstraint, EqualRadiusConstraint, LineCircleTangentConstraint, CircleCircleTangentConstraint, SplineLineTangentConstraint, SplineSplineTangentConstraint, SymmetryConstraint, LineSymmetryConstraint, ArcSymmetryConstraint, ArcEndpointArcEndpointCoincidentConstraint, ArcEndpointHorizontalConstraint, HorizontalConstraint, ArcEndpointVerticalConstraint, VerticalConstraint } = window.GeometrySolver;
  const { lineHasDirection, lineUnit, signedPointLineDistance } = window.GeometryKernel;
  const { angleDimensionSweep, angleDegrees } = window.DimensionQueries;
  function create({ sameSketchElements, syncLineOrientationHints, constraintAcceptError }) {
    function sameArcEndpoint(a, b) {
      return a?.arc === b?.arc && a?.endpoint === b?.endpoint;
    }

    function constraintTargetsFromOperands(operands) {
      const points = [];
      const lines = [];
      const circles = [];
      const arcs = [];
      const splines = [];
      let arcEndpoint = null;
      let arcEndpointPair = null;
      const axisPointOperands = [];
      for (const operand of operands) {
        if (operand.kind === "point" && !points.includes(operand.point)) {
          points.push(operand.point);
          axisPointOperands.push(operand);
        }
        else if (operand.kind === "line" && !lines.includes(operand.line)) lines.push(operand.line);
        else if (operand.kind === "primitive") {
          if (operand.primitive instanceof Circle && !circles.includes(operand.primitive)) circles.push(operand.primitive);
          if (operand.primitive instanceof Arc && !arcs.includes(operand.primitive)) arcs.push(operand.primitive);
        } else if (operand.kind === "spline") {
          if (!splines.includes(operand.spline)) splines.push(operand.spline);
        } else if (operand.kind === "arc-endpoint") {
          if (arcEndpoint && !sameArcEndpoint(arcEndpoint, operand)) arcEndpointPair = [arcEndpoint, operand];
          arcEndpoint = { arc: operand.arc, endpoint: operand.endpoint };
          axisPointOperands.push(operand);
          if (!arcs.includes(operand.arc)) arcs.push(operand.arc);
        }
      }
      return { points, lines, circles, arcs, splines, arcEndpoint, arcEndpointPair, axisPointPair: axisPointOperands.length === 2 ? axisPointOperands : null };
    }

    function linesAreParallel(l1, l2) {
      if (!lineHasDirection(l1) || !lineHasDirection(l2)) return false;
      const a = lineUnit(l1);
      const b = lineUnit(l2);
      return Math.abs(a.x * b.y - a.y * b.x) < 1e-3;
    }

    function axisAngleBetweenLines(line1, line2) {
      if (!lineHasDirection(line1) || !lineHasDirection(line2)) return 0;
      const a = lineUnit(line1);
      const b = lineUnit(line2);
      const dot = a.x * b.x + a.y * b.y;
      return Math.acos(Math.max(-1, Math.min(1, dot)));
    }

    function primitivesAreConcentric(a, b) {
      return Boolean(a && b) && hypot2(a.center.x - b.center.x, a.center.y - b.center.y) <= constraintAcceptError;
    }

    function lineCircleDistanceTarget(line, circle) {
      if (!lineHasDirection(line)) return { kind: "invalid", reason: "線-円中心寸法の対象線が短すぎます" };
      if (!(circle instanceof Circle)) return { kind: "invalid", reason: "線との中心距離寸法は円だけを対象にできます" };
      return { kind: "line-circle", line, circle, value: Math.abs(signedPointLineDistance(circle.center, line)) };
    }

    function concentricRadiusDifferenceTarget(a, b, dimensionAnchor = null) {
      if (!primitivesAreConcentric(a, b)) return { kind: "invalid", reason: "半径差寸法は同心の円または円弧だけを対象にできます" };
      return { kind: "radius-difference", a, b, value: Math.abs(b.radius() - a.radius()), dimensionAnchor };
    }

    function distanceTargetFromTargets({ points, lines, circles, arcs }) {
      const primitives = [...circles, ...arcs];
      if (points.length === 0 && lines.length === 0 && primitives.length === 1) {
        const [primitive] = primitives;
        if (primitive instanceof Circle) return { kind: "diameter", primitive, value: primitive.radius() * 2 };
        return { kind: "radius", primitive, value: primitive.radius() };
      }
      if (points.length === 0 && lines.length === 0 && primitives.length === 2) {
        return concentricRadiusDifferenceTarget(primitives[0], primitives[1]);
      }
      if (points.length === 0 && lines.length === 1 && primitives.length === 1) {
        return lineCircleDistanceTarget(lines[0], primitives[0]);
      }
      if (points.length === 2 && lines.length === 0 && primitives.length === 0) {
        const [p1, p2] = points;
        return { kind: "point-point", p1, p2, value: hypot2(p2.x - p1.x, p2.y - p1.y) };
      }
      if (points.length === 0 && lines.length === 1 && primitives.length === 0) {
        const [line] = lines;
        return { kind: "line-length", line, p1: line.p1, p2: line.p2, value: line.length() };
      }
      if (points.length === 1 && lines.length === 1 && primitives.length === 0) {
        const [point] = points;
        const [line] = lines;
        if (!lineHasDirection(line)) return { kind: "invalid", reason: "寸法対象の線が短すぎます" };
        return { kind: "point-line", point, line, value: Math.abs(signedPointLineDistance(point, line)) };
      }
      if (points.length === 0 && lines.length === 2 && primitives.length === 0) {
        const [line1, line2] = lines;
        if (!lineHasDirection(line1) || !lineHasDirection(line2)) return { kind: "invalid", reason: "線-線寸法の対象線が短すぎます" };
        if (!linesAreParallel(line1, line2)) {
          const signedValue = angleDimensionSweep({ line1, line2 });
          return { kind: "angle", line1, line2, value: angleDegrees(axisAngleBetweenLines(line1, line2)), signedValue };
        }
        return { kind: "line-line", line1, line2, value: Math.abs(signedPointLineDistance(line2.p1, line1)) };
      }
      return null;
    }

    function distanceTargetFromOperands(operands) {
      const points = operands.filter((operand) => operand.kind === "point").map((operand) => operand.point);
      const lines = operands.filter((operand) => operand.kind === "line").map((operand) => operand.line);
      const primitiveOperands = operands.filter((operand) => operand.kind === "primitive");
      const primitives = primitiveOperands.map((operand) => operand.primitive);
      if (points.length === 0 && lines.length === 0 && primitives.length === 1) {
        const [primitive] = primitives;
        if (primitive instanceof Circle) return { kind: "diameter", primitive, value: primitive.radius() * 2 };
        return { kind: "radius", primitive, value: primitive.radius() };
      }
      if (points.length === 0 && lines.length === 0 && primitives.length === 2) {
        const dimensionAnchor = primitiveOperands.at(-1)?.hitPoint || primitiveOperands[0]?.hitPoint || null;
        return concentricRadiusDifferenceTarget(primitives[0], primitives[1], dimensionAnchor);
      }
      if (points.length === 0 && lines.length === 1 && primitives.length === 1) {
        return lineCircleDistanceTarget(lines[0], primitives[0]);
      }
      if (points.length === 2 && lines.length === 0 && primitives.length === 0) {
        const [p1, p2] = points;
        return { kind: "point-point", p1, p2, value: hypot2(p2.x - p1.x, p2.y - p1.y) };
      }
      if (points.length === 0 && lines.length === 1 && primitives.length === 0) {
        const [line] = lines;
        return { kind: "line-length", line, p1: line.p1, p2: line.p2, value: line.length() };
      }
      if (points.length === 1 && lines.length === 1 && primitives.length === 0) {
        const [point] = points;
        const [line] = lines;
        if (!lineHasDirection(line)) return { kind: "invalid", reason: "寸法対象の線が短すぎます" };
        return { kind: "point-line", point, line, value: Math.abs(signedPointLineDistance(point, line)) };
      }
      if (points.length === 0 && lines.length === 2 && primitives.length === 0) {
        const [line1, line2] = lines;
        if (!lineHasDirection(line1) || !lineHasDirection(line2)) return { kind: "invalid", reason: "線-線寸法の対象線が短すぎます" };
        if (!linesAreParallel(line1, line2)) {
          const signedValue = angleDimensionSweep({ line1, line2 });
          return { kind: "angle", line1, line2, value: angleDegrees(axisAngleBetweenLines(line1, line2)), signedValue };
        }
        return { kind: "line-line", line1, line2, value: Math.abs(signedPointLineDistance(line2.p1, line1)) };
      }
      return null;
    }

    function referenceDistanceTargetForSubject(subject, referenceTarget) {
      if (!subject || !referenceTarget) return null;
      if (subject.kind === "point" && referenceTarget.kind === "point") {
        return { kind: "point-point", p1: subject.point, p2: referenceTarget.point, value: hypot2(referenceTarget.point.x - subject.point.x, referenceTarget.point.y - subject.point.y) };
      }
      if (subject.kind === "point" && referenceTarget.kind === "line") {
        return { kind: "point-line", point: subject.point, line: referenceTarget.line, value: Math.abs(signedPointLineDistance(subject.point, referenceTarget.line)) };
      }
      if (subject.kind === "line" && referenceTarget.kind === "point") {
        return { kind: "point-line", point: referenceTarget.point, line: subject.line, value: Math.abs(signedPointLineDistance(referenceTarget.point, subject.line)) };
      }
      if (subject.kind === "line" && referenceTarget.kind === "primitive") {
        return lineCircleDistanceTarget(subject.line, referenceTarget.primitive);
      }
      if (subject.kind === "primitive" && referenceTarget.kind === "line") {
        return lineCircleDistanceTarget(referenceTarget.line, subject.primitive);
      }
      if (subject.kind === "primitive" && referenceTarget.kind === "primitive") {
        return concentricRadiusDifferenceTarget(subject.primitive, referenceTarget.primitive);
      }
      if (subject.kind === "line" && referenceTarget.kind === "line") {
        if (!lineHasDirection(subject.line) || !lineHasDirection(referenceTarget.line)) return { kind: "invalid", reason: "寸法対象の線が短すぎます" };
        if (!linesAreParallel(subject.line, referenceTarget.line)) {
          return { kind: "angle", line1: subject.line, line2: referenceTarget.line, value: angleDegrees(axisAngleBetweenLines(subject.line, referenceTarget.line)), signedValue: angleDimensionSweep({ line1: subject.line, line2: referenceTarget.line }) };
        }
        return { kind: "line-line", line1: subject.line, line2: referenceTarget.line, value: Math.abs(signedPointLineDistance(referenceTarget.line.p1, subject.line)) };
      }
      return null;
    }

    function canApplyConstraintToTargets(type, targets, sketchId) {
      const { points, lines, circles, arcs, splines, arcEndpoint, arcEndpointPair, axisPointPair } = targets;
      const primitives = [...circles, ...arcs];
      const selectedItems = [...points, ...lines, ...primitives, ...splines, arcEndpoint?.arc, ...(arcEndpointPair || []).map((item) => item.arc)].filter(Boolean);
      if (!sameSketchElements(selectedItems, sketchId)) return false;
      const coincidentPrimitives = arcEndpoint ? primitives.filter((p) => p !== arcEndpoint.arc) : primitives;
      if (type === "distance") {
        const target = distanceTargetFromTargets(targets);
        return Boolean(target && target.kind !== "invalid");
      }
      if (type === "concentric") return (points.length === 1 && lines.length === 0 && primitives.length === 1) || (points.length === 0 && lines.length === 0 && primitives.length === 2);
      if (type === "equal") return (lines.length === 2 && points.length === 0 && primitives.length === 0) || (points.length === 0 && lines.length === 0 && primitives.length === 2);
      if (type === "equalRadius") return points.length === 0 && lines.length === 0 && primitives.length === 2;
      if (type === "pointOnCircle") return points.length === 1 && lines.length === 0 && primitives.length === 1;
      if (type === "tangent") return (points.length === 0 && lines.length === 1 && (primitives.length === 1 || splines.length === 1) && primitives.length + splines.length === 1) || (points.length === 0 && lines.length === 0 && ((primitives.length === 2 && splines.length === 0) || (primitives.length === 0 && splines.length === 2)));
      if (type === "coincident") {
        if (arcEndpointPair?.length === 2) return true;
        if ((points.length === 2 && lines.length === 0) || (points.length === 0 && lines.length === 2 && lines.every(lineHasDirection)) || (points.length === 1 && lines.length === 1) || (points.length === 1 && lines.length === 0 && coincidentPrimitives.length === 1)) return true;
        if (points.length === 1 && lines.length === 0 && splines.length === 1 && primitives.length === 0) return true;
        return Boolean(arcEndpoint && ((points.length === 1 && lines.length === 0 && coincidentPrimitives.length === 0) || (points.length === 0 && lines.length === 1 && coincidentPrimitives.length === 0) || (points.length === 0 && lines.length === 0 && coincidentPrimitives.length === 1)));
      }
      if (type === "horizontal" || type === "vertical") return (lines.length === 1 && points.length === 0 && !axisPointPair && lineHasDirection(lines[0])) || (axisPointPair?.length === 2 && axisPointPair.every((operand) => operand.kind === axisPointPair[0].kind) && lines.length === 0);
      if (type === "parallel" || type === "perpendicular") return lines.length === 2 && lines.every(lineHasDirection);
      if (type === "symmetry") {
        const pointTargets = points.length === 2 && lines.length === 1;
        const lineTargets = points.length === 0 && lines.length === 3;
        const arcTargets = points.length === 0 && lines.length === 1 && circles.length === 0 && arcs.length === 2;
        return ((primitives.length === 0 && (pointTargets || lineTargets)) || arcTargets) && lines.every(lineHasDirection);
      }
      if (type === "collinear") return lines.length === 2 && lines.every(lineHasDirection);
      return false;
    }

    function referenceConstraintForSubject(subject, referenceTarget) {
      if (!subject || !referenceTarget) return null;
      if (subject.kind === "point") {
        if (referenceTarget.kind === "point") return new CoincidentConstraint(subject.point, referenceTarget.point);
        if (referenceTarget.kind === "line") return new PointOnLineConstraint(subject.point, referenceTarget.line);
        if (referenceTarget.kind === "primitive") return new PointOnCircleConstraint(subject.point, referenceTarget.primitive);
        if (referenceTarget.kind === "spline") return new PointOnSplineConstraint(subject.point, referenceTarget.spline, referenceTarget.parameter);
      }
      if (subject.kind === "line") {
        if (referenceTarget.kind === "point") return new PointOnLineConstraint(referenceTarget.point, subject.line);
        if (referenceTarget.kind === "line") return new CollinearConstraint(subject.line, referenceTarget.line);
      }
      if (subject.kind === "primitive") {
        if (referenceTarget.kind === "point") return new PointOnCircleConstraint(referenceTarget.point, subject.primitive);
        if (referenceTarget.kind === "primitive") return new ConcentricConstraint(subject.primitive, referenceTarget.primitive);
      }
      if (subject.kind === "spline" && referenceTarget.kind === "point") {
        const closest = window.SplineGeometry.closestPoint(subject.spline.curve(), referenceTarget.point, { samplesPerSpan: 28 });
        return new PointOnSplineConstraint(referenceTarget.point, subject.spline, closest?.t ?? subject.parameter ?? 0);
      }
      if (subject.kind === "arc-endpoint") {
        if (referenceTarget.kind === "point") return new ArcEndpointCoincidentConstraint(subject.arc, subject.endpoint, referenceTarget.point);
        if (referenceTarget.kind === "line") return new ArcEndpointOnLineConstraint(subject.arc, subject.endpoint, referenceTarget.line);
        if (referenceTarget.kind === "primitive") return new ArcEndpointOnCircleConstraint(subject.arc, subject.endpoint, referenceTarget.primitive);
      }
      return null;
    }

    function referenceConstraintForType(type, subject, referenceTarget) {
      if (type === "coincident") return referenceConstraintForSubject(subject, referenceTarget);
      if (!subject || !referenceTarget) return null;
      if (type === "horizontal") {
        if (subject.kind === "point" && referenceTarget.kind === "point") return new PointHorizontalConstraint(subject.point, referenceTarget.point);
        return null;
      }
      if (type === "vertical") {
        if (subject.kind === "point" && referenceTarget.kind === "point") return new PointVerticalConstraint(subject.point, referenceTarget.point);
        return null;
      }
      if (type === "parallel") {
        if (subject.kind === "line" && referenceTarget.kind === "line") return new ParallelConstraint(subject.line, referenceTarget.line);
        return null;
      }
      if (type === "perpendicular") {
        if (subject.kind === "line" && referenceTarget.kind === "line") return new PerpendicularConstraint(subject.line, referenceTarget.line);
        return null;
      }
      if (type === "collinear") {
        if (subject.kind === "line" && referenceTarget.kind === "line") return new CollinearConstraint(subject.line, referenceTarget.line);
        return null;
      }
      if (type === "equal") {
        if (subject.kind === "line" && referenceTarget.kind === "line") return new EqualLengthConstraint(subject.line, referenceTarget.line);
        if (subject.kind === "primitive" && referenceTarget.kind === "primitive") return new EqualRadiusConstraint(subject.primitive, referenceTarget.primitive);
        return null;
      }
      if (type === "equalRadius") {
        if (subject.kind === "primitive" && referenceTarget.kind === "primitive") return new EqualRadiusConstraint(subject.primitive, referenceTarget.primitive);
        return null;
      }
      if (type === "concentric") {
        if (subject.kind === "primitive" && referenceTarget.kind === "primitive") return new ConcentricConstraint(subject.primitive, referenceTarget.primitive);
        if (subject.kind === "primitive" && referenceTarget.kind === "point") return new ConcentricConstraint(subject.primitive, referenceTarget.point);
        if (subject.kind === "point" && referenceTarget.kind === "primitive") return new ConcentricConstraint(subject.point, referenceTarget.primitive);
        return null;
      }
      if (type === "pointOnCircle") {
        if (subject.kind === "point" && referenceTarget.kind === "primitive") return new PointOnCircleConstraint(subject.point, referenceTarget.primitive);
        if (subject.kind === "primitive" && referenceTarget.kind === "point") return new PointOnCircleConstraint(referenceTarget.point, subject.primitive);
        if (subject.kind === "arc-endpoint" && referenceTarget.kind === "primitive") return new ArcEndpointOnCircleConstraint(subject.arc, subject.endpoint, referenceTarget.primitive);
        return null;
      }
      if (type === "tangent") {
        if (subject.kind === "line" && referenceTarget.kind === "primitive") return new LineCircleTangentConstraint(subject.line, referenceTarget.primitive);
        if (subject.kind === "primitive" && referenceTarget.kind === "line") return new LineCircleTangentConstraint(referenceTarget.line, subject.primitive);
        if (subject.kind === "primitive" && referenceTarget.kind === "primitive") return new CircleCircleTangentConstraint(subject.primitive, referenceTarget.primitive);
        if (subject.kind === "line" && referenceTarget.kind === "spline" && !referenceTarget.spline.closed) return new SplineLineTangentConstraint(referenceTarget.spline, referenceTarget.endpoint, subject.line);
        if (subject.kind === "spline" && referenceTarget.kind === "line" && !subject.spline.closed) return new SplineLineTangentConstraint(subject.spline, subject.endpoint, referenceTarget.line);
        if (subject.kind === "spline" && referenceTarget.kind === "spline" && !subject.spline.closed && !referenceTarget.spline.closed) return new SplineSplineTangentConstraint(subject.spline, subject.endpoint, referenceTarget.spline, referenceTarget.endpoint);
        return null;
      }
      return null;
    }

    function symmetryConstraintFromOperands(operands) {
      if (operands.length !== 3) return null;
      const [axisOperand, first, second] = operands;
      if (axisOperand.kind !== "line" || !axisOperand.line || first.kind !== second.kind) return null;
      if (first.kind === "point") return new SymmetryConstraint(first.point, second.point, axisOperand.line);
      if (first.kind === "line") return new LineSymmetryConstraint(first.line, second.line, axisOperand.line);
      if (first.kind === "primitive" && first.primitive instanceof Arc && second.primitive instanceof Arc) return new ArcSymmetryConstraint(first.primitive, second.primitive, axisOperand.line);
      return null;
    }

    function constraintFromTargets(type, targets, sketchId) {
      if (!canApplyConstraintToTargets(type, targets, sketchId)) return null;
      const { points, lines, circles, arcs, arcEndpoint, arcEndpointPair, axisPointPair } = targets;
      let constraint = null;
      const allPrimitives = [...circles, ...arcs];
      const primitives = type === "coincident" && arcEndpoint ? allPrimitives.filter((p) => p !== arcEndpoint.arc) : allPrimitives;
      if (type === "coincident") {
        const endpointPair = arcEndpointPair;
        if (endpointPair?.length === 2) {
          constraint = new ArcEndpointArcEndpointCoincidentConstraint(endpointPair[0].arc, endpointPair[0].endpoint, endpointPair[1].arc, endpointPair[1].endpoint);
        } else if (arcEndpoint && points.length === 1) {
          constraint = new ArcEndpointCoincidentConstraint(arcEndpoint.arc, arcEndpoint.endpoint, points[0]);
        } else if (arcEndpoint && lines.length === 1) {
          constraint = new ArcEndpointOnLineConstraint(arcEndpoint.arc, arcEndpoint.endpoint, lines[0]);
        } else if (arcEndpoint && primitives.length === 1) {
          constraint = new ArcEndpointOnCircleConstraint(arcEndpoint.arc, arcEndpoint.endpoint, primitives[0]);
        } else if (points.length === 1 && lines.length === 1) {
          constraint = new PointOnLineConstraint(points[0], lines[0]);
        } else if (points.length === 1 && primitives.length === 1) {
          constraint = new PointOnCircleConstraint(points[0], primitives[0]);
        } else if (points.length === 0 && lines.length === 2) {
          constraint = new CollinearConstraint(lines[0], lines[1]);
        } else {
          constraint = new CoincidentConstraint(points[0], points[1]);
        }
      } else if (type === "horizontal") {
        if (axisPointPair?.length === 2) {
          const [first, second] = axisPointPair;
          constraint = first.kind === "point" && second.kind === "point"
            ? new PointHorizontalConstraint(first.point, second.point)
            : new ArcEndpointHorizontalConstraint(
              first.kind === "arc-endpoint" ? first.arc : second.arc,
              first.kind === "arc-endpoint" ? first.endpoint : second.endpoint,
              first.kind === "arc-endpoint" ? second.arc : first.arc,
              first.kind === "arc-endpoint" ? second.endpoint : first.endpoint,
            );
        } else constraint = new HorizontalConstraint(lines[0]);
      } else if (type === "vertical") {
        if (axisPointPair?.length === 2) {
          const [first, second] = axisPointPair;
          constraint = first.kind === "point" && second.kind === "point"
            ? new PointVerticalConstraint(first.point, second.point)
            : new ArcEndpointVerticalConstraint(
              first.kind === "arc-endpoint" ? first.arc : second.arc,
              first.kind === "arc-endpoint" ? first.endpoint : second.endpoint,
              first.kind === "arc-endpoint" ? second.arc : first.arc,
              first.kind === "arc-endpoint" ? second.endpoint : first.endpoint,
            );
        } else constraint = new VerticalConstraint(lines[0]);
      } else if (type === "parallel") {
        constraint = new ParallelConstraint(lines[0], lines[1]);
      } else if (type === "perpendicular") {
        constraint = new PerpendicularConstraint(lines[0], lines[1]);
      } else if (type === "symmetry") {
        if (points.length === 2 && lines.length === 1) constraint = new SymmetryConstraint(points[0], points[1], lines[0]);
        else if (points.length === 0 && lines.length === 3) constraint = new LineSymmetryConstraint(lines[1], lines[2], lines[0]);
        else if (points.length === 0 && lines.length === 1 && circles.length === 0 && arcs.length === 2) constraint = new ArcSymmetryConstraint(arcs[0], arcs[1], lines[0]);
      } else if (type === "collinear") {
        constraint = new CollinearConstraint(lines[0], lines[1]);
      } else if (type === "equal") {
        if (lines.length === 2) constraint = new EqualLengthConstraint(lines[0], lines[1]);
        else constraint = new EqualRadiusConstraint(primitives[0], primitives[1]);
      } else if (type === "concentric") {
        constraint = new ConcentricConstraint(points[0] || primitives[0], primitives[points.length === 1 ? 0 : 1]);
      } else if (type === "equalRadius") {
        constraint = new EqualRadiusConstraint(primitives[0], primitives[1]);
      } else if (type === "pointOnCircle") {
        constraint = new PointOnCircleConstraint(points[0], primitives[0]);
      } else if (type === "tangent") {
        syncLineOrientationHints();
        if (lines.length === 1) constraint = new LineCircleTangentConstraint(lines[0], primitives[0]);
        else constraint = new CircleCircleTangentConstraint(primitives[0], primitives[1]);
      }
      return constraint;
    }

    return Object.freeze({ sameArcEndpoint, constraintTargetsFromOperands, linesAreParallel, distanceTargetFromTargets, distanceTargetFromOperands, referenceDistanceTargetForSubject, canApplyConstraintToTargets, referenceConstraintForType, symmetryConstraintFromOperands, constraintFromTargets });
  }
  window.ConstraintCandidates = Object.freeze({ create });
})();
