/* geometry_kernel.js: Pure geometry math shared by solver and UI adapters. */
(function () {
  "use strict";

  const TWO_PI = Math.PI * 2;
  const MIN_ORIENTATION_LENGTH = 1e-9;
  const MIN_PROJECTION_LENGTH_SQUARED = 1e-12;
  const MIN_LINE_INTERSECTION_DETERMINANT = 1e-12;
  const MIN_REFLECTION_LENGTH_SQUARED = MIN_ORIENTATION_LENGTH * MIN_ORIENTATION_LENGTH;

  function normalizeAnglePositive(angle) {
    return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
  }

  function normalizeAngleSigned(angle) {
    let normalized = angle;
    while (normalized > Math.PI) normalized -= Math.PI * 2;
    while (normalized <= -Math.PI) normalized += Math.PI * 2;
    return normalized;
  }

  function arcEndpointPoint(arc, endpoint) {
    const angle = endpoint === "start" ? arc.startAngle : arc.endAngle;
    return {
      x: arc.center.x + Math.cos(angle) * arc.radius(),
      y: arc.center.y + Math.sin(angle) * arc.radius(),
    };
  }

  function arcSweep(arc) {
    return arc.endAngle - arc.startAngle;
  }

  function unwrapAngleNear(angle, reference) {
    return angle + Math.round((reference - angle) / TWO_PI) * TWO_PI;
  }

  function shortestAngleFrom(start, end) {
    let difference = ((end - start + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
    if (difference <= -Math.PI) difference += TWO_PI;
    return start + difference;
  }

  function threePointArcGeometry(start, end, through, epsilon = MIN_ORIENTATION_LENGTH) {
    if (!start || !end || !through) return null;
    const values = [start.x, start.y, end.x, end.y, through.x, through.y].map(Number);
    if (values.some((value) => !Number.isFinite(value))) return null;

    const [ax, ay, bx, by, cx, cy] = values;
    const abx = bx - ax;
    const aby = by - ay;
    const acx = cx - ax;
    const acy = cy - ay;
    const bcx = cx - bx;
    const bcy = cy - by;
    const minimum = Math.max(0, Number(epsilon) || 0);
    const minimumSquared = minimum * minimum;
    const abSquared = abx * abx + aby * aby;
    const acSquared = acx * acx + acy * acy;
    const bcSquared = bcx * bcx + bcy * bcy;
    if (abSquared <= minimumSquared || acSquared <= minimumSquared || bcSquared <= minimumSquared) return null;

    const cross = abx * acy - aby * acx;
    const scale = Math.sqrt(Math.max(abSquared, acSquared, bcSquared));
    if (Math.abs(cross) <= minimum * scale) return null;

    const determinant = cross * 2;
    const center = {
      x: ax + (acy * abSquared - aby * acSquared) / determinant,
      y: ay + (abx * acSquared - acx * abSquared) / determinant,
    };
    const radius = Math.hypot(center.x - ax, center.y - ay);
    if (!Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(radius) || radius <= minimum) return null;

    const startAngle = Math.atan2(ay - center.y, ax - center.x);
    const rawEndAngle = Math.atan2(by - center.y, bx - center.x);
    const throughAngle = Math.atan2(cy - center.y, cx - center.x);
    const counterclockwiseSweep = normalizeAnglePositive(rawEndAngle - startAngle);
    const throughCounterclockwise = normalizeAnglePositive(throughAngle - startAngle);
    const endAngle = throughCounterclockwise < counterclockwiseSweep
      ? startAngle + counterclockwiseSweep
      : startAngle - (TWO_PI - counterclockwiseSweep);
    return { center, radius, startAngle, endAngle };
  }

  function slotGeometry(firstCenter, secondCenter, widthPoint, epsilon = MIN_ORIENTATION_LENGTH) {
    const values = [firstCenter?.x, firstCenter?.y, secondCenter?.x, secondCenter?.y, widthPoint?.x, widthPoint?.y];
    if (!values.every(Number.isFinite)) return null;
    const dx = secondCenter.x - firstCenter.x;
    const dy = secondCenter.y - firstCenter.y;
    const centerDistance = Math.hypot(dx, dy);
    if (centerDistance < epsilon) return null;
    const ux = dx / centerDistance;
    const uy = dy / centerDistance;
    const baseNormal = { x: -uy, y: ux };
    const signedRadius = (widthPoint.x - firstCenter.x) * baseNormal.x + (widthPoint.y - firstCenter.y) * baseNormal.y;
    const radius = Math.abs(signedRadius);
    if (radius < epsilon) return null;
    const side = signedRadius < 0 ? -1 : 1;
    const normal = { x: baseNormal.x * side, y: baseNormal.y * side };
    const sideStart = { x: firstCenter.x + normal.x * radius, y: firstCenter.y + normal.y * radius };
    const sideEnd = { x: secondCenter.x + normal.x * radius, y: secondCenter.y + normal.y * radius };
    const oppositeEnd = { x: secondCenter.x - normal.x * radius, y: secondCenter.y - normal.y * radius };
    const oppositeStart = { x: firstCenter.x - normal.x * radius, y: firstCenter.y - normal.y * radius };
    const normalAngle = Math.atan2(normal.y, normal.x);
    const sweep = -side * Math.PI;
    return {
      firstCenter: { x: firstCenter.x, y: firstCenter.y },
      secondCenter: { x: secondCenter.x, y: secondCenter.y },
      centerDistance,
      radius,
      side,
      sideStart,
      sideEnd,
      oppositeEnd,
      oppositeStart,
      endArc: { startAngle: normalAngle, endAngle: normalAngle + sweep },
      startArc: { startAngle: normalAngle + Math.PI, endAngle: normalAngle + Math.PI + sweep },
    };
  }

  function angleOnSignedSweep(angle, start, end) {
    const sweep = end - start;
    if (Math.abs(sweep) >= TWO_PI) return true;
    if (sweep >= 0) return normalizeAnglePositive(angle - start) <= sweep;
    return normalizeAnglePositive(start - angle) <= -sweep;
  }

  function arcParamOnSweep(arc, angle) {
    const sweep = arcSweep(arc);
    if (Math.abs(sweep) < 1e-12) return null;
    if (!angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return null;
    return sweep >= 0
      ? normalizeAnglePositive(angle - arc.startAngle) / sweep
      : normalizeAnglePositive(arc.startAngle - angle) / -sweep;
  }

  function angleAtArcParam(arc, t) {
    return arc.startAngle + arcSweep(arc) * t;
  }

  function pointAtArcParam(arc, t) {
    const angle = angleAtArcParam(arc, t);
    return {
      x: arc.center.x + Math.cos(angle) * arc.radius(),
      y: arc.center.y + Math.sin(angle) * arc.radius(),
    };
  }

  function arcSamplePoints(arc, count = 24) {
    const points = [];
    for (let i = 0; i <= count; i++) {
      const t = count === 0 ? 0 : i / count;
      points.push(pointAtArcParam(arc, t));
    }
    return points;
  }

  function lineUnit(line) {
    const length = line.length();
    if (length < 1e-12) return { x: 1, y: 0 };
    return { x: line.dx() / length, y: line.dy() / length };
  }

  function lineNormal(line) {
    if (line.length() < 1e-12) return { x: 0, y: 1 };
    const unit = lineUnit(line);
    return { x: -unit.y, y: unit.x };
  }

  function lineSupportNormal(line) {
    if (line.orientationHint === "horizontal") return { x: 0, y: 1 };
    if (line.orientationHint === "vertical") return { x: -1, y: 0 };
    return lineNormal(line);
  }

  function lineHasDirection(line) {
    return line.length() >= MIN_ORIENTATION_LENGTH;
  }

  function lineAngle(line) {
    return Math.atan2(line.dy(), line.dx());
  }

  function signedPointLineDistance(point, line) {
    let dx = line.dx();
    let dy = line.dy();
    let anchor = line.p1;
    if (line.orientationHint === "horizontal") {
      dx = 1;
      dy = 0;
      anchor = { x: line.p1.x, y: (line.p1.y + line.p2.y) / 2 };
    } else if (line.orientationHint === "vertical") {
      dx = 0;
      dy = 1;
      anchor = { x: (line.p1.x + line.p2.x) / 2, y: line.p1.y };
    }
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 1e-12) return 0;
    return ((point.x - anchor.x) * -dy + (point.y - anchor.y) * dx) / length;
  }

  function signedPointDirectedLineDistance(point, line) {
    const dx = line.dx();
    const dy = line.dy();
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 1e-12) return 0;
    return ((point.x - line.p1.x) * -dy + (point.y - line.p1.y) * dx) / length;
  }

  function closestPointOnSegmentCoordinates(px, py, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared < MIN_PROJECTION_LENGTH_SQUARED) return { x: a.x, y: a.y, t: 0 };
    const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lengthSquared));
    return { x: a.x + t * dx, y: a.y + t * dy, t };
  }

  function projectPointToLine(point, line) {
    const dx = line.dx();
    const dy = line.dy();
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared < MIN_PROJECTION_LENGTH_SQUARED) return { x: line.p1.x, y: line.p1.y };
    const t = ((point.x - line.p1.x) * dx + (point.y - line.p1.y) * dy) / lengthSquared;
    return { x: line.p1.x + t * dx, y: line.p1.y + t * dy };
  }

  function projectPointToSegmentPoint(point, line) {
    const projected = closestPointOnSegmentCoordinates(point.x, point.y, line.p1, line.p2);
    return { x: projected.x, y: projected.y };
  }

  function closestPointOnSegment(px, py, line) {
    return closestPointOnSegmentCoordinates(px, py, line.p1, line.p2);
  }

  function distancePointToSegment(px, py, line) {
    const projected = closestPointOnSegmentCoordinates(px, py, line.p1, line.p2);
    const dx = px - projected.x;
    const dy = py - projected.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function distancePointToSegmentPoints(px, py, a, b) {
    const projected = closestPointOnSegmentCoordinates(px, py, a, b);
    const dx = px - projected.x;
    const dy = py - projected.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function lineIntersection(line1, line2) {
    const x1 = line1.p1.x;
    const y1 = line1.p1.y;
    const x2 = line1.p2.x;
    const y2 = line1.p2.y;
    const x3 = line2.p1.x;
    const y3 = line2.p1.y;
    const x4 = line2.p2.x;
    const y4 = line2.p2.y;
    const determinant = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(determinant) < MIN_LINE_INTERSECTION_DETERMINANT) return null;
    return {
      x: ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / determinant,
      y: ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / determinant,
    };
  }

  function reflectedPointAcrossLine(point, axis) {
    const dx = axis.dx();
    const dy = axis.dy();
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared < MIN_REFLECTION_LENGTH_SQUARED) return { x: point.x, y: point.y };
    const t = ((point.x - axis.p1.x) * dx + (point.y - axis.p1.y) * dy) / lengthSquared;
    const projectionX = axis.p1.x + dx * t;
    const projectionY = axis.p1.y + dy * t;
    return { x: projectionX * 2 - point.x, y: projectionY * 2 - point.y };
  }

  window.GeometryKernel = Object.freeze({
    MIN_ORIENTATION_LENGTH,
    normalizeAnglePositive,
    normalizeAngleSigned,
    arcEndpointPoint,
    arcSweep,
    unwrapAngleNear,
    shortestAngleFrom,
    threePointArcGeometry,
    slotGeometry,
    angleOnSignedSweep,
    arcParamOnSweep,
    angleAtArcParam,
    pointAtArcParam,
    arcSamplePoints,
    lineUnit,
    lineNormal,
    lineSupportNormal,
    lineHasDirection,
    lineAngle,
    signedPointLineDistance,
    signedPointDirectedLineDistance,
    projectPointToLine,
    projectPointToSegmentPoint,
    closestPointOnSegment,
    distancePointToSegment,
    distancePointToSegmentPoints,
    lineIntersection,
    reflectedPointAcrossLine,
  });
})();
