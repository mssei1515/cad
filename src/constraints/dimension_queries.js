/* Dimension target descriptions and geometric measurements; no Canvas or editing state. */
(function () {
  "use strict";
  const {
    Line, DistanceConstraint, PointAxisDistanceConstraint,
    PointLineDistanceConstraint, LineLineDistanceConstraint, LineCircleDistanceConstraint,
    ConcentricRadiusDifferenceConstraint, OffsetConstraint, OffsetChainConstraint,
    LineAngleConstraint, RadiusConstraint, DiameterConstraint,
    hypot2,
  } = window.GeometrySolver;
  const {
    signedPointDirectedLineDistance, normalizeAngleSigned, lineAngle,
    lineIntersection, signedPointLineDistance,
  } = window.GeometryKernel;

  function isDimensionConstraint(constraint) {
    return (
      constraint instanceof DistanceConstraint ||
      constraint instanceof PointAxisDistanceConstraint ||
      constraint instanceof PointLineDistanceConstraint ||
      constraint instanceof LineLineDistanceConstraint ||
      constraint instanceof LineCircleDistanceConstraint ||
      constraint instanceof ConcentricRadiusDifferenceConstraint ||
      constraint instanceof OffsetConstraint ||
      constraint instanceof OffsetChainConstraint ||
      constraint instanceof LineAngleConstraint ||
      constraint instanceof RadiusConstraint ||
      constraint instanceof DiameterConstraint
    );
  }

  function targetFromConstraint(c) {
    if (c instanceof DistanceConstraint) return { kind: "point-point", p1: c.p1, p2: c.p2, value: c.target };
    if (c instanceof PointAxisDistanceConstraint) return { kind: "point-point", p1: c.p1, p2: c.p2, value: c.target, dimensionAxis: c.axis };
    if (c instanceof PointLineDistanceConstraint) return { kind: "point-line", point: c.point, line: c.line, value: c.target };
    if (c instanceof LineLineDistanceConstraint) return { kind: "line-line", line1: c.line1, line2: c.line2, value: c.target };
    if (c instanceof LineCircleDistanceConstraint) return { kind: "line-circle", line: c.line, circle: c.circle, value: c.target };
    if (c instanceof ConcentricRadiusDifferenceConstraint) return { kind: "radius-difference", a: c.a, b: c.b, value: c.target };
    if (c instanceof OffsetConstraint) return { kind: "offset-distance", source: c.source, offset: c.offset, value: c.target, sign: c.sign };
    if (c instanceof OffsetChainConstraint) {
      const index = Math.max(0, Math.min(c.sources.length - 1, Number(c.dimensionSegmentIndex) || 0));
      const source = c.sources[index];
      const offset = c.offsets[index];
      return { kind: "offset-distance", source, offset, value: c.target, sign: offsetPairSign(source, offset, c.side) };
    }
    if (c instanceof LineAngleConstraint) return { kind: "angle", line1: c.line1, line2: c.line2, value: angleDegrees(c.target), signedValue: angleDimensionSweep({ line1: c.line1, line2: c.line2 }) };
    if (c instanceof RadiusConstraint) return { kind: "radius", primitive: c.primitive, value: c.target };
    if (c instanceof DiameterConstraint) return { kind: "diameter", primitive: c.primitive, value: c.target };
    return null;
  }

  function offsetPairSign(source, offset) {
    const signed = source instanceof Line
      ? signedPointDirectedLineDistance(offset.p1, source)
      : offset.radius() - source.radius();
    return signed < 0 ? -1 : 1;
  }

  function angleDegrees(radians) {
    return Math.abs((radians * 180) / Math.PI);
  }

  function angleDimensionSweep(target) {
    return signedAngleBetweenLines(target.line1, target.line2);
  }

  function signedAngleBetweenLines(line1, line2) {
    return normalizeAngleSigned(lineAngle(line2) - lineAngle(line1));
  }

  function measuredDimensionValue(target, dimension = null) {
    if (!target) return NaN;
    if (target.kind === "angle") {
      return angleDegrees(angleDimensionAngles(target, null, dimension).signed);
    }
    return geometryTargetValue(target);
  }

  function angleDimensionAngles(target, anchor = null, dimension = null) {
    if (dimension && Number.isInteger(dimension.angleStartFlip) && Number.isInteger(dimension.angleEndFlip)) {
      const stored = angleDimensionCandidate(target, dimension.angleStartFlip, dimension.angleEndFlip);
      if (stored) return stored;
    }
    const fallbackSigned = angleDimensionSweep(target);
    const baseStart = lineAngle(target.line1);
    const fallback = {
      start: baseStart,
      end: baseStart + fallbackSigned,
      signed: fallbackSigned,
      mid: baseStart + fallbackSigned / 2,
      startFlip: 0,
      endFlip: fallbackSigned === signedAngleBetweenLines(target.line1, target.line2) ? 0 : 1,
    };
    if (!anchor) return fallback;
    const vertex = lineIntersection(target.line1, target.line2);
    if (!vertex) return fallback;
    const anchorAngle = Math.atan2(anchor.y - vertex.y, anchor.x - vertex.x);
    let best = fallback;
    let bestScore = Infinity;
    for (const startFlip of [0, 1]) {
      for (const endFlip of [0, 1]) {
        const candidate = angleDimensionCandidate(target, startFlip, endFlip);
        if (!candidate) continue;
        const score = Math.abs(normalizeAngleSigned(candidate.mid - anchorAngle));
        if (score < bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
    }
    return best;
  }

  function angleDimensionCandidate(target, startFlip = 0, endFlip = 0) {
    const start = lineAngle(target.line1) + (startFlip ? Math.PI : 0);
    const endAngle = lineAngle(target.line2) + (endFlip ? Math.PI : 0);
    const signed = normalizeAngleSigned(endAngle - start);
    if (Math.abs(signed) < 1e-9 || Math.abs(Math.abs(signed) - Math.PI) < 1e-9) return null;
    return { start, end: start + signed, signed, mid: start + signed / 2, startFlip, endFlip };
  }

  function geometryTargetValue(target) {
    if (!target) return NaN;
    if (target.kind === "point-point") {
      if (target.dimensionAxis === "x") return Math.abs(target.p2.x - target.p1.x);
      if (target.dimensionAxis === "y") return Math.abs(target.p2.y - target.p1.y);
      return hypot2(target.p2.x - target.p1.x, target.p2.y - target.p1.y);
    }
    if (target.kind === "point-line") return Math.abs(signedPointLineDistance(target.point, target.line));
    if (target.kind === "line-line") return Math.abs(signedPointLineDistance(target.line1.p1, target.line2));
    if (target.kind === "line-circle") return Math.abs(signedPointLineDistance(target.circle.center, target.line));
    if (target.kind === "radius-difference") return Math.abs(target.b.radius() - target.a.radius());
    if (target.kind === "line-length") return target.line.length();
    if (target.kind === "angle") return angleDegrees(Math.abs(angleDimensionSweep(target)));
    if (target.kind === "radius") return target.primitive.radius();
    if (target.kind === "diameter") return target.primitive.radius() * 2;
    if (target.kind === "offset-distance") {
      if (target.source instanceof Line) return Math.abs(signedPointLineDistance(target.offset.p1, target.source));
      return Math.abs(target.offset.radius() - target.source.radius());
    }
    return target.value;
  }

  function isReadOnlyDimension(constraint) {
    return Boolean(constraint?.readOnlyDimension);
  }

  window.DimensionQueries = Object.freeze({
    targetFromConstraint, offsetPairSign, angleDegrees,
    angleDimensionSweep, signedAngleBetweenLines, measuredDimensionValue,
    angleDimensionAngles, angleDimensionCandidate, geometryTargetValue,
    isReadOnlyDimension, isDimensionConstraint,
  });
})();
