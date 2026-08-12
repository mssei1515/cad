/* geometry_kernel.js: Pure geometry math shared by solver and UI adapters. */
(function () {
  "use strict";

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

  window.GeometryKernel = Object.freeze({
    normalizeAnglePositive,
    normalizeAngleSigned,
    arcEndpointPoint,
  });
})();
