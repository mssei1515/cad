/* geometry_kernel.js: Pure geometry math shared by solver and UI adapters. */
(function () {
  "use strict";

  const MIN_ORIENTATION_LENGTH = 1e-9;

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
  });
})();
