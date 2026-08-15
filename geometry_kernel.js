/* geometry_kernel.js: Pure geometry math shared by solver and UI adapters. */
(function () {
  "use strict";

  const MIN_ORIENTATION_LENGTH = 1e-9;
  const MIN_PROJECTION_LENGTH_SQUARED = 1e-12;
  const MIN_LINE_INTERSECTION_DETERMINANT = 1e-12;
  const MIN_REFLECTION_LENGTH_SQUARED = MIN_ORIENTATION_LENGTH * MIN_ORIENTATION_LENGTH;

  function normalizeAnglePositive(angle) {
    const twoPi = Math.PI * 2;
    return ((angle % twoPi) + twoPi) % twoPi;
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
