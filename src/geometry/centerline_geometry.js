/* Read-only centerline support and endpoint projection. */
(function () {
  "use strict";
  const { Point, Line, hypot2 } = window.GeometrySolver;
  const { MIN_ORIENTATION_LENGTH, lineHasDirection } = window.GeometryKernel;
  function create({ applicationText, parallelTolerance: CENTERLINE_PARALLEL_TOLERANCE }) {
    function parallelLineCenterlineSupport(line1, line2) {
      if (![line1, line2].every((line) => line instanceof Line && lineHasDirection(line))) {
        return { ok: false, reason: applicationText("中心線の基準線が短すぎます", "A centerline source is too short") };
      }
      const length1 = line1.length();
      const length2 = line2.length();
      const ux = line1.dx() / length1;
      const uy = line1.dy() / length1;
      const vx = line2.dx() / length2;
      const vy = line2.dy() / length2;
      if (Math.abs(ux * vy - uy * vx) > CENTERLINE_PARALLEL_TOLERANCE) {
        return { ok: false, reason: applicationText("互いに平行な2本の線を選択してください", "Select two parallel lines") };
      }
      const nx = -uy;
      const ny = ux;
      const separation = (line2.p1.x - line1.p1.x) * nx + (line2.p1.y - line1.p1.y) * ny;
      if (Math.abs(separation) < MIN_ORIENTATION_LENGTH) {
        return { ok: false, reason: applicationText("異なる位置にある2本の平行線を選択してください", "Select two distinct parallel lines") };
      }
      return {
        ok: true,
        kind: "parallel-lines",
        anchor: { x: line1.p1.x + nx * separation / 2, y: line1.p1.y + ny * separation / 2 },
        ux,
        uy,
      };
    }

    function pointPairCenterlineSupport(p1, p2) {
      if (!(p1 instanceof Point) || !(p2 instanceof Point) || p1 === p2) {
        return { ok: false, reason: applicationText("異なる2点を選択してください", "Select two distinct points") };
      }
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = hypot2(dx, dy);
      if (length < MIN_ORIENTATION_LENGTH) {
        return { ok: false, reason: applicationText("2点が近すぎます", "The two points are too close") };
      }
      return {
        ok: true,
        kind: "point-pair",
        anchor: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
        ux: -dy / length,
        uy: dx / length,
      };
    }

    function centerlineSupportForTargets(targets) {
      if (targets.length !== 2) return null;
      if (targets.every((item) => item instanceof Line)) return parallelLineCenterlineSupport(targets[0], targets[1]);
      if (targets.every((item) => item instanceof Point)) return pointPairCenterlineSupport(targets[0], targets[1]);
      return { ok: false, reason: applicationText("平行な2線、または2点を選択してください", "Select two parallel lines or two points") };
    }

    function projectPointToCenterlineSupport(point, support) {
      if (!point || !support?.ok) return null;
      const parameter = (point.x - support.anchor.x) * support.ux + (point.y - support.anchor.y) * support.uy;
      return { x: support.anchor.x + support.ux * parameter, y: support.anchor.y + support.uy * parameter };
    }
    return Object.freeze({ centerlineSupportForTargets, projectPointToCenterlineSupport });
  }
  window.CenterlineGeometry = Object.freeze({ create });
})();
