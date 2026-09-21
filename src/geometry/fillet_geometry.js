/* Fillet plans shared by preview and creation; no model mutation. */
(function () {
  "use strict";
  const { hypot2 } = window.GeometrySolver;
  const { MIN_ORIENTATION_LENGTH, shortestAngleFrom } = window.GeometryKernel;
  function create({ minLineLength: MIN_LINE_LENGTH }) {
    function sharedLinePoint(a, b) {
      if (a.p1 === b.p1 || a.p1 === b.p2) return a.p1;
      if (a.p2 === b.p1 || a.p2 === b.p2) return a.p2;
      return null;
    }

    function otherLinePoint(line, point) {
      return line.p1 === point ? line.p2 : line.p2 === point ? line.p1 : null;
    }

    function filletGeometryBasis(line1, line2) {
      const corner = sharedLinePoint(line1, line2);
      if (!corner) return { ok: false, reason: "接続された2本の線を選択してください" };
      const o1 = otherLinePoint(line1, corner);
      const o2 = otherLinePoint(line2, corner);
      const l1 = hypot2(o1.x - corner.x, o1.y - corner.y);
      const l2 = hypot2(o2.x - corner.x, o2.y - corner.y);
      if (l1 < MIN_ORIENTATION_LENGTH || l2 < MIN_ORIENTATION_LENGTH) return { ok: false, reason: "面取り対象の線が短すぎます" };

      const u1 = { x: (o1.x - corner.x) / l1, y: (o1.y - corner.y) / l1 };
      const u2 = { x: (o2.x - corner.x) / l2, y: (o2.y - corner.y) / l2 };
      const dot = Math.max(-0.999, Math.min(0.999, u1.x * u2.x + u1.y * u2.y));
      const theta = Math.acos(dot);
      const tangentScale = Math.tan(theta / 2);
      const maxTangent = Math.min(l1, l2) - MIN_LINE_LENGTH;
      if (!Number.isFinite(maxTangent) || maxTangent <= 0) return { ok: false, reason: "R面取り後の線長を確保できません" };
      const maximumRadius = maxTangent * tangentScale;
      if (!Number.isFinite(maximumRadius) || maximumRadius <= MIN_ORIENTATION_LENGTH) return { ok: false, reason: "R面取り後の線長を確保できません" };
      const bis = { x: u1.x + u2.x, y: u1.y + u2.y };
      const bisLen = hypot2(bis.x, bis.y);
      if (bisLen < 1e-9) return { ok: false, reason: "180度の角にはR面取りを作成できません" };
      return { ok: true, corner, u1, u2, l1, l2, theta, tangentScale, maxTangent, maximumRadius, bis, bisLen };
    }

    function computeFilletGeometry(line1, line2, radius) {
      const basis = filletGeometryBasis(line1, line2);
      if (!basis.ok) return basis;
      if (!Number.isFinite(radius) || radius < MIN_ORIENTATION_LENGTH) return { ok: false, reason: "共有端点から離れた位置へマウスを移動してください" };
      const { corner, u1, u2, l1, l2, theta, tangentScale, maxTangent, bis, bisLen } = basis;
      const tangent = radius / tangentScale;
      if (Number.isFinite(tangent) && tangent >= maxTangent) return { ok: false, reason: "R寸法を保つための直線部を確保できません" };
      if (!Number.isFinite(tangent) || tangent <= 0 || tangent >= Math.min(l1, l2)) return { ok: false, reason: "この角度と線長ではR面取りを作成できません" };

      const centerDistance = radius / Math.sin(theta / 2);
      const t1 = { x: corner.x + u1.x * tangent, y: corner.y + u1.y * tangent };
      const t2 = { x: corner.x + u2.x * tangent, y: corner.y + u2.y * tangent };
      const center = { x: corner.x + (bis.x / bisLen) * centerDistance, y: corner.y + (bis.y / bisLen) * centerDistance };
      const startAngle = Math.atan2(t1.y - center.y, t1.x - center.x);
      const endAngle = shortestAngleFrom(startAngle, Math.atan2(t2.y - center.y, t2.x - center.x));
      return { ok: true, corner, t1, t2, center, radius, startAngle, endAngle };
    }

    function filletGeometryFromPointer(line1, line2, pointer) {
      const basis = filletGeometryBasis(line1, line2);
      if (!basis.ok) return basis;
      if (!pointer) return { ok: false, reason: "共有端点から離れた位置へマウスを移動してください" };
      const requestedRadius = hypot2(pointer.x - basis.corner.x, pointer.y - basis.corner.y);
      const maximumRadius = basis.maximumRadius;
      const radius = Math.min(requestedRadius, maximumRadius * (1 - 1e-6));
      const geometry = computeFilletGeometry(line1, line2, radius);
      return geometry.ok ? { ...geometry, requestedRadius, maximumRadius } : geometry;
    }
    return Object.freeze({ filletGeometryBasis, computeFilletGeometry, filletGeometryFromPointer });
  }
  window.FilletGeometry = Object.freeze({ create });
})();
