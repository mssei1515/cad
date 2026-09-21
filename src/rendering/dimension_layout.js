/* Dimension display geometry and extension rules; current lines are supplied by a read port. */
(function () {
  "use strict";
  const { Point, Line, Arc, hypot2 } = window.GeometrySolver;
  const { lineUnit, lineHasDirection, lineIntersection, shortestAngleFrom, angleOnSignedSweep } = window.GeometryKernel;
  const { DEFAULT_DIMENSION_APPEARANCE, normalizeDimensionAppearance } = window.Appearance;
  const { angleDimensionAngles } = window.DimensionQueries;
  const DIMENSION_OUTSIDE_SHAFT_LENGTH_FACTOR = 1.5;
  function create({ viewport, placement, metrics, currentLines, minLineLength: MIN_LINE_LENGTH }) {
    const { dimensionAnchor, storedDimensionAxis, targetDirection, targetPointsForDimension, migrateAngleDimensionLabelPlacement, angleDimensionLabelOffsets } = placement;
    const { dimensionMillimetersToWorld, shouldPlaceDimensionTerminatorsOutside, linearDimensionTerminatorDirections } = metrics;
    function isArcRadiusDimensionTarget(target) {
      return target?.kind === "radius" && target.primitive instanceof Arc;
    }

    function linearDimensionRenderPlan(target, layout, label, appearance, dimension, expressionMark = false) {
      const arcRadius = isArcRadiusDimensionTarget(target);
      const outside = shouldPlaceDimensionTerminatorsOutside(layout.span, label, appearance, dimension, expressionMark);
      const directions = linearDimensionTerminatorDirections(layout.d, outside);
      const firstTerminator = arcRadius ? null : { point: layout.a, direction: directions.first };
      const secondTerminator = { point: layout.b, direction: directions.second };
      const shaftLength = dimensionMillimetersToWorld(appearance.terminatorSize * DIMENSION_OUTSIDE_SHAFT_LENGTH_FACTOR);
      const shafts = outside && ["arrow", "filledArrow"].includes(appearance.terminatorType)
        ? [firstTerminator, secondTerminator].filter(Boolean).map((terminator) => ({
          start: terminator.point,
          end: {
            x: terminator.point.x + terminator.direction.x * shaftLength,
            y: terminator.point.y + terminator.direction.y * shaftLength,
          },
        }))
        : [];
      const labelProjectionFromStart = arcRadius
        ? (layout.text.x - layout.a.x) * layout.d.x + (layout.text.y - layout.a.y) * layout.d.y
        : 0;
      const labelBeforeStart = arcRadius && labelProjectionFromStart < -1e-9;
      const labelAfterEnd = arcRadius && labelProjectionFromStart > layout.span + 1e-9;
      return {
        outside,
        lineStart: arcRadius && !labelBeforeStart ? layout.a : layout.lineA || layout.a,
        lineEnd: arcRadius && !labelAfterEnd ? layout.b : layout.lineB || layout.b,
        firstTerminator,
        secondTerminator,
        shafts,
      };
    }

    function jisDimensionTextAngle(direction) {
      const x = Number(direction?.x) || 0;
      const y = Number(direction?.y) || 0;
      // JIS aligned notation: horizontal text is read from the bottom edge and
      // vertical text from the right edge. Non-vertical text always progresses
      // left-to-right; an exact vertical always progresses bottom-to-top.
      if (Math.abs(x) <= 1e-12 && Math.abs(y) > 1e-12) return -Math.PI / 2;
      let angle = Math.atan2(y, x);
      if (angle >= Math.PI / 2) angle -= Math.PI;
      if (angle < -Math.PI / 2) angle += Math.PI;
      return angle;
    }

    function dimensionTextOffset(angle, distance) {
      return {
        x: Math.sin(angle) * distance,
        y: -Math.cos(angle) * distance,
      };
    }

    function dimensionLayout(target, dimension, appearance = DEFAULT_DIMENSION_APPEARANCE) {
      if (target.kind === "angle") return angleDimensionLayout(target, dimension);
      appearance = normalizeDimensionAppearance(appearance, { partial: false });
      const anchor = dimensionAnchor(target, dimension);
      const basisTarget = { ...target, dimensionAxis: storedDimensionAxis(target, dimension) };
      const radial = target.kind === "radius" || target.kind === "diameter" || target.kind === "radius-difference" || (target.kind === "offset-distance" && !(target.source instanceof Line));
      const d = radial ? targetDirection({ ...basisTarget, dimensionAnchor: anchor }) : targetDirection(basisTarget);
      const points = targetPointsForDimension(target, anchor);
      if (points.length < 2) return null;
      const tick = 9 / viewport.scale;
      const extension = dimensionMillimetersToWorld(appearance.extensionLineOvershoot);
      const gap = dimensionMillimetersToWorld(appearance.extensionLineOriginGap);
      const projectedPoints = points.map((source, index) => {
        const t = (source.x - anchor.x) * d.x + (source.y - anchor.y) * d.y;
        const onDimension = { x: anchor.x + d.x * t, y: anchor.y + d.y * t };
        const ex = onDimension.x - source.x;
        const ey = onDimension.y - source.y;
        const el = hypot2(ex, ey);
        const ux = el > 1e-12 ? ex / el : d.x;
        const uy = el > 1e-12 ? ey / el : d.y;
        const extensionDirection = { x: ux, y: uy };
        const visibleGap = Math.min(gap, Math.max(0, el - 2 / viewport.scale));
        return {
          source,
          projection: t,
          showExtension: !isArcRadiusDimensionTarget(target)
            && shouldShowDimensionExtension(target, index, { source, onDimension, extensionDirection }),
          extensionStart: {
            x: source.x + ux * visibleGap,
            y: source.y + uy * visibleGap,
          },
          onDimension,
          extensionEnd: {
            x: onDimension.x + ux * extension,
            y: onDimension.y + uy * extension,
          },
        };
      });
      const projections = projectedPoints.map((p) => p.projection);
      const min = Math.min(...projections);
      const max = Math.max(...projections);
      const a = { x: anchor.x + d.x * min, y: anchor.y + d.y * min };
      const b = { x: anchor.x + d.x * max, y: anchor.y + d.y * max };
      const labelOffset = Number(dimension?.labelOffsetU) || 0;
      const textProjection = (min + max) / 2 + labelOffset;
      const labelPad = 18 / viewport.scale;
      const lineMin = Math.min(min, textProjection - labelPad);
      const lineMax = Math.max(max, textProjection + labelPad);
      const lineA = { x: anchor.x + d.x * lineMin, y: anchor.y + d.y * lineMin };
      const lineB = { x: anchor.x + d.x * lineMax, y: anchor.y + d.y * lineMax };
      return {
        a,
        b,
        span: max - min,
        lineA,
        lineB,
        d,
        textAngle: jisDimensionTextAngle(d),
        points: projectedPoints,
        text: { x: anchor.x + d.x * textProjection, y: anchor.y + d.y * textProjection },
        hitA: { x: lineA.x - d.x * tick, y: lineA.y - d.y * tick },
        hitB: { x: lineB.x + d.x * tick, y: lineB.y + d.y * tick },
      };
    }

    function arcRadiusDimensionExtensionSegment(target, layout, appearance = DEFAULT_DIMENSION_APPEARANCE) {
      if (!isArcRadiusDimensionTarget(target) || !layout?.b) return null;
      const arc = target.primitive;
      const radius = arc.radius();
      if (!Number.isFinite(radius) || radius <= 1e-12) return null;
      const dimensionAngle = Math.atan2(layout.b.y - arc.center.y, layout.b.x - arc.center.x);
      if (angleOnSignedSweep(dimensionAngle, arc.startAngle, arc.endAngle)) return null;

      const candidates = [
        { endpoint: "start", sourceAngle: arc.startAngle },
        { endpoint: "end", sourceAngle: arc.endAngle },
      ].map((candidate) => {
        const intersectionAngle = shortestAngleFrom(candidate.sourceAngle, dimensionAngle);
        return {
          ...candidate,
          intersectionAngle,
          delta: intersectionAngle - candidate.sourceAngle,
        };
      });
      const nearest = candidates.reduce((best, candidate) => (
        !best || Math.abs(candidate.delta) < Math.abs(best.delta) ? candidate : best
      ), null);
      if (!nearest || Math.abs(nearest.delta) <= 1e-12) return null;

      const resolved = normalizeDimensionAppearance(appearance, { partial: false });
      const pathLength = Math.abs(nearest.delta) * radius;
      const gap = dimensionMillimetersToWorld(resolved.extensionLineOriginGap);
      const overshoot = dimensionMillimetersToWorld(resolved.extensionLineOvershoot);
      const visibleGap = Math.min(gap, Math.max(0, pathLength - 2 / viewport.scale));
      const direction = nearest.delta < 0 ? -1 : 1;
      return {
        center: arc.center,
        radius,
        sourceEndpoint: nearest.endpoint,
        sourceAngle: nearest.sourceAngle,
        intersectionAngle: nearest.intersectionAngle,
        startAngle: nearest.sourceAngle + direction * visibleGap / radius,
        endAngle: nearest.intersectionAngle + direction * overshoot / radius,
        counterclockwise: direction < 0,
      };
    }

    function incidentLinesAtPoint(point) {
      if (!point) return [];
      return currentLines().filter((line) => line.p1 === point || line.p2 === point);
    }

    function chooseIncidentLineForExtension(point, extensionDirection = null) {
      const candidates = incidentLinesAtPoint(point).filter(lineHasDirection);
      if (candidates.length === 0) return null;
      if (!extensionDirection) return candidates[0];
      let best = candidates[0];
      let bestScore = -Infinity;
      for (const line of candidates) {
        const u = lineUnit(line);
        const score = Math.abs(u.x * extensionDirection.x + u.y * extensionDirection.y);
        if (score > bestScore) {
          bestScore = score;
          best = line;
        }
      }
      return best;
    }

    function dimensionSourceLine(target, index, source = null, extensionDirection = null) {
      if (target.kind === "point-line" && index === 1) return target.line;
      if (target.kind === "line-circle" && index === 1) return target.line;
      if (target.kind === "line-line") return index === 0 ? target.line1 : target.line2;
      if (target.kind === "line-length") return target.line;
      if (target.kind === "offset-distance" && target.source instanceof Line) return index === 0 ? target.source : target.offset;
      if (target.kind === "point-point") return null;
      if (source instanceof Point) return chooseIncidentLineForExtension(source, extensionDirection);
      return null;
    }

    function lineOutwardDirectionAtSource(line, source) {
      const u = lineUnit(line);
      const tol = Math.max(MIN_LINE_LENGTH * 10, 1e-7);
      const d1 = hypot2(source.x - line.p1.x, source.y - line.p1.y);
      const d2 = hypot2(source.x - line.p2.x, source.y - line.p2.y);
      if (d1 <= tol && d1 <= d2) return { x: -u.x, y: -u.y, endpoint: "p1" };
      if (d2 <= tol) return { x: u.x, y: u.y, endpoint: "p2" };
      return null;
    }

    function shouldShowDimensionExtension(target, index, context = {}) {
      const line = dimensionSourceLine(target, index, context.source, context.extensionDirection);
      if (!line || !context.source || !context.onDimension) return true;
      const vx = context.onDimension.x - context.source.x;
      const vy = context.onDimension.y - context.source.y;
      const len = hypot2(vx, vy);
      if (len <= 1e-12) return false;
      const v = { x: vx / len, y: vy / len };
      const u = lineUnit(line);
      const parallel = Math.abs(v.x * u.y - v.y * u.x) <= 0.08;
      if (!parallel) return true;
      const outward = lineOutwardDirectionAtSource(line, context.source);
      if (!outward) return false;
      return v.x * outward.x + v.y * outward.y > 0.1;
    }

    function angleDimensionLayout(target, dimension) {
      migrateAngleDimensionLabelPlacement(target, dimension);
      const vertex = lineIntersection(target.line1, target.line2);
      if (!vertex) return null;
      const anchor = dimensionAnchor(target, dimension);
      const radius = Math.max(14 / viewport.scale, hypot2(anchor.x - vertex.x, anchor.y - vertex.y));
      const { start, end, signed, mid } = angleDimensionAngles(target, anchor, dimension);
      const radial = { x: Math.cos(mid), y: Math.sin(mid) };
      const tangent = { x: -radial.y, y: radial.x };
      const arcPoint = { x: vertex.x + radial.x * radius, y: vertex.y + radial.y * radius };
      const labelOffsets = angleDimensionLabelOffsets(target, dimension);
      const labelOffsetR = labelOffsets ? labelOffsets.radial : 14 / viewport.scale;
      const labelOffsetT = labelOffsets ? labelOffsets.tangent : 0;
      return {
        vertex,
        radius,
        start,
        end,
        signed,
        textAngle: jisDimensionTextAngle(tangent),
        text: {
          x: arcPoint.x + radial.x * labelOffsetR + tangent.x * labelOffsetT,
          y: arcPoint.y + radial.y * labelOffsetR + tangent.y * labelOffsetT,
        },
        hitA: { x: vertex.x + Math.cos(start) * radius, y: vertex.y + Math.sin(start) * radius },
        hitB: { x: vertex.x + Math.cos(end) * radius, y: vertex.y + Math.sin(end) * radius },
      };
    }

    function angleDimensionExtensionSegments(layout, appearance = DEFAULT_DIMENSION_APPEARANCE) {
      const resolved = normalizeDimensionAppearance(appearance, { partial: false });
      const extension = dimensionMillimetersToWorld(resolved.extensionLineOvershoot);
      const gap = dimensionMillimetersToWorld(resolved.extensionLineOriginGap);
      const visibleGap = Math.min(gap, Math.max(0, layout.radius - 2 / viewport.scale));
      return [layout.start, layout.end].map((angle) => ({
        start: {
          x: layout.vertex.x + Math.cos(angle) * visibleGap,
          y: layout.vertex.y + Math.sin(angle) * visibleGap,
        },
        end: {
          x: layout.vertex.x + Math.cos(angle) * (layout.radius + extension),
          y: layout.vertex.y + Math.sin(angle) * (layout.radius + extension),
        },
      }));
    }

    return Object.freeze({ linearDimensionRenderPlan, jisDimensionTextAngle, dimensionTextOffset, dimensionLayout, arcRadiusDimensionExtensionSegment, angleDimensionLayout, angleDimensionExtensionSegments });
  }
  window.DimensionLayout = Object.freeze({ create, DIMENSION_OUTSIDE_SHAFT_LENGTH_FACTOR });
})();
