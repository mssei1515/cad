/* Dimension anchors, label placement and explicit migration/update helpers; no Document or Canvas access. */
(function () {
  "use strict";
  const { Line, Circle, Arc, hypot2 } = window.GeometrySolver;
  const { lineUnit, lineNormal, circlePointAtAngle, projectPointToLine, projectPointToSegmentPoint, distancePointToSegmentPoints, lineIntersection } = window.GeometryKernel;
  const { angleDimensionAngles } = window.DimensionQueries;
  function create({ viewport }) {
    function targetDirection(target) {
      if (target.kind === "offset-distance") {
        if (target.source instanceof Line && target.offset instanceof Line) {
          const normal = lineNormal(target.source);
          return { x: normal.x * (target.sign || 1), y: normal.y * (target.sign || 1) };
        }
        const defaultAngle = target.source instanceof Arc ? (target.source.startAngle + target.source.endAngle) / 2 : 0;
        const anchor = target.dimensionAnchor || circlePointAtAngle(target.offset, defaultAngle);
        const dx = anchor.x - target.source.center.x;
        const dy = anchor.y - target.source.center.y;
        const len = hypot2(dx, dy);
        if (len > 1e-12) return { x: dx / len, y: dy / len };
        return { x: 1, y: 0 };
      }
      if (target.kind === "radius" || target.kind === "diameter") {
        const defaultAngle = target.primitive instanceof Arc ? (target.primitive.startAngle + target.primitive.endAngle) / 2 : 0;
        const anchor = target.dimensionAnchor || circlePointAtAngle(target.primitive, defaultAngle);
        const dx = anchor.x - target.primitive.center.x;
        const dy = anchor.y - target.primitive.center.y;
        const len = hypot2(dx, dy);
        if (len > 1e-12) return { x: dx / len, y: dy / len };
        return { x: 1, y: 0 };
      }
      if (target.kind === "radius-difference") {
        const defaultPrimitive = target.b instanceof Arc ? target.b : target.a instanceof Arc ? target.a : target.b;
        const defaultAngle = defaultPrimitive instanceof Arc ? (defaultPrimitive.startAngle + defaultPrimitive.endAngle) / 2 : 0;
        const anchor = target.dimensionAnchor || circlePointAtAngle(defaultPrimitive, defaultAngle);
        const center = target.a.center;
        const dx = anchor.x - center.x;
        const dy = anchor.y - center.y;
        const len = hypot2(dx, dy);
        if (len > 1e-12) return { x: dx / len, y: dy / len };
        return { x: 1, y: 0 };
      }
      if (target.kind === "point-point" || target.kind === "line-length") {
        if (target.dimensionAxis === "x") return { x: 1, y: 0 };
        if (target.dimensionAxis === "y") return { x: 0, y: 1 };
        return lineUnit({ dx: () => target.p2.x - target.p1.x, dy: () => target.p2.y - target.p1.y, length: () => hypot2(target.p2.x - target.p1.x, target.p2.y - target.p1.y) });
      }
      if (target.kind === "point-line") {
        const projection = projectPointToLine(target.point, target.line);
        const dx = target.point.x - projection.x;
        const dy = target.point.y - projection.y;
        const len = hypot2(dx, dy);
        if (len > 1e-12) return { x: dx / len, y: dy / len };
        return lineNormal(target.line);
      }
      if (target.kind === "line-circle") {
        const projection = projectPointToLine(target.circle.center, target.line);
        const dx = target.circle.center.x - projection.x;
        const dy = target.circle.center.y - projection.y;
        const len = hypot2(dx, dy);
        if (len > 1e-12) return { x: dx / len, y: dy / len };
        return lineNormal(target.line);
      }
      if (target.kind === "line-line") {
        const projection = projectPointToLine(target.line1.p1, target.line2);
        const dx = target.line1.p1.x - projection.x;
        const dy = target.line1.p1.y - projection.y;
        const len = hypot2(dx, dy);
        if (len > 1e-12) return { x: dx / len, y: dy / len };
        return lineNormal(target.line1);
      }
      return { x: 1, y: 0 };
    }

    function targetPointsForDimension(target, anchor = null) {
      if (target.kind === "offset-distance") {
        if (target.source instanceof Line && target.offset instanceof Line) {
          const guide = anchor || {
            x: (target.source.p1.x + target.source.p2.x + target.offset.p1.x + target.offset.p2.x) / 4,
            y: (target.source.p1.y + target.source.p2.y + target.offset.p1.y + target.offset.p2.y) / 4,
          };
          const sourcePoint = projectPointToLine(guide, target.source);
          const offsetPoint = projectPointToLine(guide, target.offset);
          return [sourcePoint, offsetPoint];
        }
        const dir = targetDirection({ ...target, dimensionAnchor: anchor || target.dimensionAnchor });
        return [
          {
            x: target.source.center.x + dir.x * target.source.radius(),
            y: target.source.center.y + dir.y * target.source.radius(),
          },
          {
            x: target.offset.center.x + dir.x * target.offset.radius(),
            y: target.offset.center.y + dir.y * target.offset.radius(),
          },
        ];
      }
      if (target.kind === "radius") {
        const dir = targetDirection({ ...target, dimensionAnchor: anchor || target.dimensionAnchor });
        return [target.primitive.center, { x: target.primitive.center.x + dir.x * target.primitive.radius(), y: target.primitive.center.y + dir.y * target.primitive.radius() }];
      }
      if (target.kind === "diameter") {
        const dir = targetDirection({ ...target, dimensionAnchor: anchor || target.dimensionAnchor });
        return [
          { x: target.primitive.center.x - dir.x * target.primitive.radius(), y: target.primitive.center.y - dir.y * target.primitive.radius() },
          { x: target.primitive.center.x + dir.x * target.primitive.radius(), y: target.primitive.center.y + dir.y * target.primitive.radius() },
        ];
      }
      if (target.kind === "radius-difference") {
        const dir = targetDirection({ ...target, dimensionAnchor: anchor || target.dimensionAnchor });
        return [
          { x: target.a.center.x + dir.x * target.a.radius(), y: target.a.center.y + dir.y * target.a.radius() },
          { x: target.b.center.x + dir.x * target.b.radius(), y: target.b.center.y + dir.y * target.b.radius() },
        ];
      }
      if (target.kind === "point-point" || target.kind === "line-length") return [target.p1, target.p2];
      if (target.kind === "point-line") return [target.point, projectPointToSegmentPoint(anchor || target.point, target.line)];
      if (target.kind === "line-circle") return [target.circle.center, projectPointToSegmentPoint(anchor || target.circle.center, target.line)];
      if (target.kind === "line-line") {
        return [nearestLineEndpoint(target.line1, anchor), nearestLineEndpoint(target.line2, anchor)];
      }
      return [];
    }

    function nearestLineEndpoint(line, anchor = null) {
      if (!anchor) return line.p1;
      const d1 = hypot2(line.p1.x - anchor.x, line.p1.y - anchor.y);
      const d2 = hypot2(line.p2.x - anchor.x, line.p2.y - anchor.y);
      return d1 <= d2 ? line.p1 : line.p2;
    }

    function dimensionBasis(target) {
      const d = targetDirection(target);
      return { d, n: { x: -d.y, y: d.x } };
    }

    function dimensionBasePoint(target) {
      const points = targetPointsForDimension(target);
      if (points.length < 2) return { x: 0, y: 0 };
      return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
    }

    function dominantDimensionAxis(target) {
      if (target.kind !== "point-point") return null;
      return Math.abs(target.p2.x - target.p1.x) >= Math.abs(target.p2.y - target.p1.y) ? "x" : "y";
    }

    function dimensionAxisForAnchor(target, anchor, options = {}) {
      if (target.kind !== "point-point") return target.dimensionAxis || null;
      if (target.dimensionAxis) return target.dimensionAxis;
      if (options.allowPointAxis === false) return null;
      const lineDistance = distancePointToSegmentPoints(anchor.x, anchor.y, target.p1, target.p2);
      if (lineDistance <= 10 / viewport.scale) return null;
      const base = dimensionBasePoint(target);
      const dx = anchor.x - base.x;
      const dy = anchor.y - base.y;
      return Math.abs(dy) >= Math.abs(dx) ? "x" : "y";
    }

    function dimensionFromAnchor(target, anchor, options = {}) {
      if (target.kind === "angle") {
        const vertex = lineIntersection(target.line1, target.line2);
        const angles = angleDimensionAngles(target, anchor);
        return {
          x: anchor.x,
          y: anchor.y,
          offsetU: NaN,
          offsetN: NaN,
          labelOffsetU: 0,
          axis: null,
          angleStartFlip: angles.startFlip,
          angleEndFlip: angles.endFlip,
          angleRadius: vertex ? Math.max(14 / viewport.scale, hypot2(anchor.x - vertex.x, anchor.y - vertex.y)) : NaN,
        };
      }
      const axis = dimensionAxisForAnchor(target, anchor, options);
      const basisTarget = axis ? { ...target, dimensionAxis: axis } : target;
      const base = dimensionBasePoint(target);
      const { d, n } = dimensionBasis(basisTarget);
      const dx = anchor.x - base.x;
      const dy = anchor.y - base.y;
      return {
        x: anchor.x,
        y: anchor.y,
        offsetU: dx * d.x + dy * d.y,
        offsetN: dx * n.x + dy * n.y,
        labelOffsetU: 0,
        axis,
      };
    }

    function angleDimensionLabelBasis(target, dimension) {
      if (target?.kind !== "angle" || !dimension) return null;
      const vertex = lineIntersection(target.line1, target.line2);
      if (!vertex) return null;
      const anchor = dimensionAnchor(target, dimension);
      const radius = Math.max(14 / viewport.scale, hypot2(anchor.x - vertex.x, anchor.y - vertex.y));
      const { mid } = angleDimensionAngles(target, anchor, dimension);
      const radial = { x: Math.cos(mid), y: Math.sin(mid) };
      const tangent = { x: -radial.y, y: radial.x };
      return {
        vertex,
        radius,
        radial,
        tangent,
        arcPoint: {
          x: vertex.x + radial.x * radius,
          y: vertex.y + radial.y * radius,
        },
      };
    }

    function angleDimensionLabelOffsets(target, dimension) {
      if (!dimension) return null;
      if (Number.isFinite(dimension.angleLabelOffsetR) && Number.isFinite(dimension.angleLabelOffsetT)) {
        return { radial: dimension.angleLabelOffsetR, tangent: dimension.angleLabelOffsetT };
      }
      if (!Number.isFinite(dimension.labelX) || !Number.isFinite(dimension.labelY)) return null;
      const basis = angleDimensionLabelBasis(target, dimension);
      if (!basis) return null;
      const dx = dimension.labelX - basis.arcPoint.x;
      const dy = dimension.labelY - basis.arcPoint.y;
      return {
        radial: dx * basis.radial.x + dy * basis.radial.y,
        tangent: dx * basis.tangent.x + dy * basis.tangent.y,
      };
    }

    function setAngleDimensionLabelOffsets(dimension, offsets) {
      if (!dimension || !offsets) return dimension;
      dimension.angleLabelOffsetR = offsets.radial;
      dimension.angleLabelOffsetT = offsets.tangent;
      dimension.angleLabelPlacementVersion = 2;
      delete dimension.labelX;
      delete dimension.labelY;
      return dimension;
    }

    function migrateAngleDimensionLabelPlacement(target, dimension) {
      if (target?.kind !== "angle" || !dimension) return dimension;
      if (Number.isFinite(dimension.angleLabelOffsetR) && Number.isFinite(dimension.angleLabelOffsetT)) {
        if (dimension.angleLabelPlacementVersion !== 2) {
          dimension.angleLabelOffsetR = 0;
          dimension.angleLabelOffsetT = 0;
        }
        dimension.angleLabelPlacementVersion = 2;
        delete dimension.labelX;
        delete dimension.labelY;
        return dimension;
      }
      return setAngleDimensionLabelOffsets(dimension, angleDimensionLabelOffsets(target, dimension));
    }

    function dimensionWithLabelAt(target, dimension, labelPoint) {
      if (!target || !dimension || !labelPoint) return dimension;
      if (target.kind === "angle") {
        const next = { ...dimension };
        const basis = angleDimensionLabelBasis(target, next);
        if (!basis) return next;
        const dx = labelPoint.x - basis.arcPoint.x;
        const dy = labelPoint.y - basis.arcPoint.y;
        return setAngleDimensionLabelOffsets(next, {
          radial: dx * basis.radial.x + dy * basis.radial.y,
          tangent: dx * basis.tangent.x + dy * basis.tangent.y,
        });
      }
      const anchor = dimensionAnchor(target, dimension);
      const basisTarget = { ...target, dimensionAxis: storedDimensionAxis(target, dimension) };
      const radial = target.kind === "radius" || target.kind === "diameter" || target.kind === "radius-difference" || (target.kind === "offset-distance" && !(target.source instanceof Line));
      const d = radial ? targetDirection({ ...basisTarget, dimensionAnchor: anchor }) : targetDirection(basisTarget);
      const points = targetPointsForDimension(target, anchor);
      if (points.length < 2) return dimension;
      const projections = points.map((p) => (p.x - anchor.x) * d.x + (p.y - anchor.y) * d.y);
      const midpointProjection = (Math.min(...projections) + Math.max(...projections)) / 2;
      const labelProjection = (labelPoint.x - anchor.x) * d.x + (labelPoint.y - anchor.y) * d.y;
      return { ...dimension, labelOffsetU: labelProjection - midpointProjection };
    }

    function angleDimensionFromLabelPoint(target, labelPoint, labelOffsets = null) {
      if (target?.kind !== "angle" || !labelPoint) return null;
      const offsets = labelOffsets || { radial: 14 / viewport.scale, tangent: 0 };
      const vertex = lineIntersection(target.line1, target.line2);
      if (!vertex) return null;
      const angles = angleDimensionAngles(target, labelPoint);
      const radial = { x: Math.cos(angles.mid), y: Math.sin(angles.mid) };
      const projectedLabelRadius =
        (labelPoint.x - vertex.x) * radial.x +
        (labelPoint.y - vertex.y) * radial.y;
      const radius = Math.max(14 / viewport.scale, projectedLabelRadius - offsets.radial);
      const anchor = {
        x: vertex.x + radial.x * radius,
        y: vertex.y + radial.y * radius,
      };
      const dimension = dimensionFromAnchor(target, anchor, { allowPointAxis: false });
      return setAngleDimensionLabelOffsets(dimension, offsets);
    }

    function applyDefaultCircleDimensionLabelOffset(target, dimension) {
      if (!dimension || !(target?.primitive instanceof Circle)) return dimension;
      if (target.kind !== "radius" && target.kind !== "diameter") return dimension;
      dimension.labelOffsetU = target.primitive.radius() * 0.5;
      return dimension;
    }

    function storedDimensionAxis(target, dimension = null) {
      if (target.kind === "point-point") return target.dimensionAxis || null;
      return dimension?.axis || target.dimensionAxis || null;
    }

    function dimensionAnchor(target, dimension) {
      if (!dimension) return defaultDimensionForTarget(target);
      if (target.kind === "radius" || target.kind === "diameter" || target.kind === "radius-difference" || (target.kind === "offset-distance" && !(target.source instanceof Line))) {
        if (Number.isFinite(dimension.x) && Number.isFinite(dimension.y)) return { x: dimension.x, y: dimension.y };
      }
      if (target.kind === "angle") {
        const vertex = lineIntersection(target.line1, target.line2);
        if (vertex && Number.isFinite(dimension.angleRadius)) {
          const { mid } = angleDimensionAngles(target, null, dimension);
          return {
            x: vertex.x + Math.cos(mid) * dimension.angleRadius,
            y: vertex.y + Math.sin(mid) * dimension.angleRadius,
          };
        }
        return { x: dimension.x, y: dimension.y };
      }
      const base = dimensionBasePoint(target);
      const axis = storedDimensionAxis(target, dimension);
      const { d, n } = dimensionBasis({ ...target, dimensionAxis: axis });
      if (Number.isFinite(dimension.offsetU) && Number.isFinite(dimension.offsetN)) {
        return {
          x: base.x + d.x * dimension.offsetU + n.x * dimension.offsetN,
          y: base.y + d.y * dimension.offsetU + n.y * dimension.offsetN,
        };
      }
      return { x: dimension.x, y: dimension.y };
    }

    function defaultDimensionForTarget(target) {
      if (target.kind === "angle") {
        const vertex = lineIntersection(target.line1, target.line2);
        if (!vertex) return { x: 0, y: 0, offsetU: NaN, offsetN: NaN, labelOffsetU: 0, axis: null };
        const angles = angleDimensionAngles(target);
        const radius = 45 / viewport.scale;
        return {
          x: vertex.x + Math.cos(angles.mid) * radius,
          y: vertex.y + Math.sin(angles.mid) * radius,
          offsetU: NaN,
          offsetN: NaN,
          labelOffsetU: 0,
          axis: null,
          angleStartFlip: angles.startFlip,
          angleEndFlip: angles.endFlip,
          angleRadius: radius,
        };
      }
      const points = targetPointsForDimension(target);
      if (points.length < 2) return { x: 0, y: 0 };
      if (target.kind === "radius") {
        const dimension = dimensionFromAnchor(target, points[1]);
        return applyDefaultCircleDimensionLabelOffset(target, dimension);
      }
      const mid = dimensionBasePoint(target);
      const defaultAxis = target.kind === "point-point" ? target.dimensionAxis || null : null;
      const dir = targetDirection(defaultAxis ? { ...target, dimensionAxis: defaultAxis } : target);
      const normal = { x: -dir.y, y: dir.x };
      const dimension = dimensionFromAnchor(defaultAxis ? { ...target, dimensionAxis: defaultAxis } : target, { x: mid.x + normal.x * 30, y: mid.y + normal.y * 30 }, { allowPointAxis: false });
      applyDefaultCircleDimensionLabelOffset(target, dimension);
      if (defaultAxis) dimension.axis = defaultAxis;
      return dimension;
    }

    return Object.freeze({ targetDirection, targetPointsForDimension, dimensionFromAnchor, angleDimensionLabelBasis, angleDimensionLabelOffsets, setAngleDimensionLabelOffsets, migrateAngleDimensionLabelPlacement, dimensionWithLabelAt, angleDimensionFromLabelPoint, applyDefaultCircleDimensionLabelOffset, storedDimensionAxis, dimensionAnchor, defaultDimensionForTarget });
  }
  window.DimensionPlacement = Object.freeze({ create });
})();
