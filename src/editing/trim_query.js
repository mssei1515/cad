/* Read-only trim boundaries and removal plans; UI supplies the hit tolerance. */
(function () {
  "use strict";
  const { hypot2 } = window.GeometrySolver;
  const { lineIntersection, angleOnSignedSweep, normalizeAnglePositive, arcEndpointPoint, arcParamOnSweep, closestPointOnSegment, arcSweep } = window.GeometryKernel;
  function create({ currentScope, isActiveSketchElement, minLineLength: MIN_LINE_LENGTH, minArcLength: MIN_ARC_LENGTH }) {
    function pointOnLineAt(line, t) {
      return { x: line.p1.x + (line.p2.x - line.p1.x) * t, y: line.p1.y + (line.p2.y - line.p1.y) * t };
    }

    function lineParam(line, p) {
      const dx = line.p2.x - line.p1.x;
      const dy = line.p2.y - line.p1.y;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-12) return 0;
      return ((p.x - line.p1.x) * dx + (p.y - line.p1.y) * dy) / len2;
    }

    function addUniqueBoundary(list, boundary, tolerance = 1e-6) {
      if (!Number.isFinite(boundary.t)) return;
      if (boundary.t < -tolerance || boundary.t > 1 + tolerance) return;
      boundary.t = Math.max(0, Math.min(1, boundary.t));
      if (list.some((item) => Math.abs(item.t - boundary.t) <= tolerance)) return;
      list.push(boundary);
    }

    function lineLineBoundary(target, other) {
      const point = lineIntersection(target, other);
      if (!point) return null;
      const t = lineParam(target, point);
      const u = lineParam(other, point);
      if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null;
      return { t, point, source: { line: other } };
    }

    function lineCircleBoundaries(line, primitive, requireArc = false) {
      const dx = line.p2.x - line.p1.x;
      const dy = line.p2.y - line.p1.y;
      const fx = line.p1.x - primitive.center.x;
      const fy = line.p1.y - primitive.center.y;
      const qa = dx * dx + dy * dy;
      if (qa < 1e-12) return [];
      const qb = 2 * (fx * dx + fy * dy);
      const qc = fx * fx + fy * fy - primitive.radius() * primitive.radius();
      const disc = qb * qb - 4 * qa * qc;
      if (disc < -1e-9) return [];
      const roots = Math.abs(disc) < 1e-9 ? [-qb / (2 * qa)] : [(-qb - Math.sqrt(disc)) / (2 * qa), (-qb + Math.sqrt(disc)) / (2 * qa)];
      return roots.map((t) => {
        if (t < -1e-6 || t > 1 + 1e-6) return null;
        const point = pointOnLineAt(line, t);
        if (requireArc && !angleOnSignedSweep(Math.atan2(point.y - primitive.center.y, point.x - primitive.center.x), primitive.startAngle, primitive.endAngle)) return null;
        return { t, point, source: requireArc ? { arc: primitive } : { primitive } };
      }).filter(Boolean);
    }

    function circleCirclePoints(a, b) {
      const dx = b.center.x - a.center.x;
      const dy = b.center.y - a.center.y;
      const d = hypot2(dx, dy);
      const r0 = a.radius();
      const r1 = b.radius();
      if (d < 1e-12 || d > r0 + r1 + 1e-9 || d < Math.abs(r0 - r1) - 1e-9) return [];
      const x = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
      const h2 = r0 * r0 - x * x;
      if (h2 < -1e-9) return [];
      const h = Math.sqrt(Math.max(0, h2));
      const ux = dx / d;
      const uy = dy / d;
      const base = { x: a.center.x + ux * x, y: a.center.y + uy * x };
      if (h < 1e-9) return [base];
      return [{ x: base.x - uy * h, y: base.y + ux * h }, { x: base.x + uy * h, y: base.y - ux * h }];
    }

    function circleParam(circle, angle) {
      return normalizeAnglePositive(angle) / (Math.PI * 2);
    }

    function angleAtCircleParam(t) {
      return t * Math.PI * 2;
    }

    function isTrimBoundaryGeometry(item) {
      return isActiveSketchElement(item) && !item.construction;
    }

    function lineTrimBoundaries(line) {
      const boundaries = [{ t: 0, point: line.p1 }, { t: 1, point: line.p2 }];
      for (const other of currentScope().lines) {
        if (!isTrimBoundaryGeometry(other)) continue;
        if (other === line) continue;
        const b = lineLineBoundary(line, other);
        if (b) addUniqueBoundary(boundaries, b);
      }
      for (const circle of currentScope().circles) if (isTrimBoundaryGeometry(circle)) for (const b of lineCircleBoundaries(line, circle)) addUniqueBoundary(boundaries, b);
      for (const arc of currentScope().arcs) if (isTrimBoundaryGeometry(arc)) for (const b of lineCircleBoundaries(line, arc, true)) addUniqueBoundary(boundaries, b);
      return boundaries.sort((a, b) => a.t - b.t);
    }

    function arcTrimBoundaries(arc) {
      const boundaries = [{ t: 0, point: arcEndpointPoint(arc, "start") }, { t: 1, point: arcEndpointPoint(arc, "end") }];
      const addPointBoundary = (point, source) => {
        const t = arcParamOnSweep(arc, Math.atan2(point.y - arc.center.y, point.x - arc.center.x));
        if (t !== null) addUniqueBoundary(boundaries, { t, point, source });
      };
      for (const line of currentScope().lines) if (isTrimBoundaryGeometry(line)) for (const b of lineCircleBoundaries(line, arc, true)) addPointBoundary(b.point, { line });
      for (const circle of currentScope().circles) if (isTrimBoundaryGeometry(circle)) for (const point of circleCirclePoints(arc, circle)) addPointBoundary(point, { primitive: circle });
      for (const other of currentScope().arcs) {
        if (!isTrimBoundaryGeometry(other)) continue;
        if (other === arc) continue;
        for (const point of circleCirclePoints(arc, other)) {
          if (angleOnSignedSweep(Math.atan2(point.y - other.center.y, point.x - other.center.x), other.startAngle, other.endAngle)) addPointBoundary(point, { arc: other });
        }
      }
      return boundaries.sort((a, b) => a.t - b.t);
    }

    function circleTrimBoundaries(circle) {
      const boundaries = [];
      const addPointBoundary = (point, source) => {
        const angle = Math.atan2(point.y - circle.center.y, point.x - circle.center.x);
        addUniqueBoundary(boundaries, { t: circleParam(circle, angle), angle, point, source });
      };
      for (const line of currentScope().lines) if (isTrimBoundaryGeometry(line)) for (const b of lineCircleBoundaries(line, circle)) addPointBoundary(b.point, { line });
      for (const other of currentScope().circles) {
        if (!isTrimBoundaryGeometry(other)) continue;
        if (other === circle) continue;
        for (const point of circleCirclePoints(circle, other)) addPointBoundary(point, { primitive: other });
      }
      for (const arc of currentScope().arcs) {
        if (!isTrimBoundaryGeometry(arc)) continue;
        for (const point of circleCirclePoints(circle, arc)) {
          if (angleOnSignedSweep(Math.atan2(point.y - arc.center.y, point.x - arc.center.x), arc.startAngle, arc.endAngle)) addPointBoundary(point, { arc });
        }
      }
      return boundaries.sort((a, b) => a.t - b.t);
    }

    function trimInterval(boundaries, t) {
      for (let i = 0; i < boundaries.length - 1; i++) {
        if (t >= boundaries[i].t - 1e-6 && t <= boundaries[i + 1].t + 1e-6) return { left: boundaries[i], right: boundaries[i + 1] };
      }
      return null;
    }

    function cyclicTrimInterval(boundaries, t) {
      if (boundaries.length < 2) return null;
      for (let i = 0; i < boundaries.length; i++) {
        const left = boundaries[i];
        const right = boundaries[(i + 1) % boundaries.length];
        if (left.t <= right.t) {
          if (t >= left.t - 1e-6 && t <= right.t + 1e-6) return { left, right, wraps: false };
        } else if (t >= left.t - 1e-6 || t <= right.t + 1e-6) {
          return { left, right, wraps: true };
        }
      }
      return null;
    }

    function trimPreviewForLine(line, pointer) {
      const projected = closestPointOnSegment(pointer.x, pointer.y, line);
      const boundaries = lineTrimBoundaries(line);
      const interval = trimInterval(boundaries, lineParam(line, projected));
      if (boundaries.length <= 2) return { kind: "line", item: line, deleteWhole: true, interval: { left: boundaries[0], right: boundaries[1] } };
      if (!interval) return null;
      if (line.length() * Math.max(0, interval.right.t - interval.left.t) < MIN_LINE_LENGTH) return null;
      return { kind: "line", item: line, interval };
    }

    function trimPreviewForArc(arc, pointer) {
      const t = arcParamOnSweep(arc, Math.atan2(pointer.y - arc.center.y, pointer.x - arc.center.x));
      if (t === null) return null;
      const boundaries = arcTrimBoundaries(arc);
      const interval = trimInterval(boundaries, t);
      if (boundaries.length <= 2) return { kind: "arc", item: arc, deleteWhole: true, interval: { left: boundaries[0], right: boundaries[1] } };
      if (!interval) return null;
      if (arc.radius() * Math.abs(arcSweep(arc)) * Math.max(0, interval.right.t - interval.left.t) < MIN_ARC_LENGTH) return null;
      return { kind: "arc", item: arc, interval };
    }

    function trimPreviewForCircle(circle, pointer) {
      const t = circleParam(circle, Math.atan2(pointer.y - circle.center.y, pointer.x - circle.center.x));
      const boundaries = circleTrimBoundaries(circle);
      if (boundaries.length === 0) return { kind: "circle", item: circle, deleteWhole: true };
      if (boundaries.length < 2) return null;
      const interval = cyclicTrimInterval(boundaries, t);
      if (!interval) return null;
      const left = { ...interval.left, angle: angleAtCircleParam(interval.left.t) };
      const right = { ...interval.right, angle: angleAtCircleParam(interval.right.t) + (interval.wraps ? Math.PI * 2 : 0) };
      const span = Math.max(0, right.angle - left.angle);
      if (span * circle.radius() < MIN_ARC_LENGTH) return null;
      return { kind: "circle", item: circle, interval: { left, right }, boundaries };
    }

    function computeTrimPreview(pointer, threshold) {
      const candidates = [];
      for (const line of currentScope().lines) {
        if (!isActiveSketchElement(line)) continue;
        const p = closestPointOnSegment(pointer.x, pointer.y, line);
        const distance = hypot2(pointer.x - p.x, pointer.y - p.y);
        if (distance <= threshold) candidates.push({ distance, preview: () => trimPreviewForLine(line, pointer) });
      }
      for (const arc of currentScope().arcs) {
        if (!isActiveSketchElement(arc)) continue;
        const angle = Math.atan2(pointer.y - arc.center.y, pointer.x - arc.center.x);
        if (!angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) continue;
        const distance = Math.abs(hypot2(pointer.x - arc.center.x, pointer.y - arc.center.y) - arc.radius());
        if (distance <= threshold) candidates.push({ distance, preview: () => trimPreviewForArc(arc, pointer) });
      }
      for (const circle of currentScope().circles) {
        if (!isActiveSketchElement(circle)) continue;
        const distance = Math.abs(hypot2(pointer.x - circle.center.x, pointer.y - circle.center.y) - circle.radius());
        if (distance <= threshold) candidates.push({ distance, preview: () => trimPreviewForCircle(circle, pointer) });
      }
      candidates.sort((a, b) => a.distance - b.distance);
      for (const candidate of candidates) {
        const preview = candidate.preview();
        if (preview) return preview;
      }
      return null;
    }
    return Object.freeze({ lineParam, angleAtCircleParam, lineTrimBoundaries, arcTrimBoundaries, circleTrimBoundaries, trimPreviewForLine, trimPreviewForArc, trimPreviewForCircle, computeTrimPreview });
  }
  window.TrimQuery = Object.freeze({ create });
})();
