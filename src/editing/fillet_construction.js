/* Apply a fillet plan and construct its supporting constraints. */
(function () {
  "use strict";
  const { RadiusConstraint, ArcEndpointCoincidentConstraint, PointOnLineConstraint, LineCircleTangentConstraint } = window.GeometrySolver;
  function create({ plans, geometry, defaultDimensionForTarget, syncLineOrientationHints, pushModelConstraint }) {
    const { computeFilletGeometry } = plans;
    const { addPoint, addArc } = geometry;
    function setLineEndpoint(line, from, to) {
      if (line.p1 === from) line.p1 = to;
      else if (line.p2 === from) line.p2 = to;
    }

    function createFillet(line1, line2, radius) {
      const geometry = computeFilletGeometry(line1, line2, radius);
      if (!geometry.ok) return geometry;
      const { corner, t1: t1Pos, t2: t2Pos, center: centerPos, radius: finalRadius, startAngle, endAngle } = geometry;
      const t1 = addPoint(t1Pos.x, t1Pos.y, false, "endpoint");
      const t2 = addPoint(t2Pos.x, t2Pos.y, false, "endpoint");
      const center = addPoint(centerPos.x, centerPos.y, false, "endpoint");
      setLineEndpoint(line1, corner, t1);
      setLineEndpoint(line2, corner, t2);
      const arc = addArc(center, finalRadius, startAngle, endAngle, false);
      if (!arc) return { ok: false, reason: "R面取り円弧を作成できません" };
      const radiusConstraint = new RadiusConstraint(arc, finalRadius);
      radiusConstraint.dimension = defaultDimensionForTarget({ kind: "radius", primitive: arc, value: finalRadius });
      syncLineOrientationHints();
      [
        new ArcEndpointCoincidentConstraint(arc, "start", t1),
        new ArcEndpointCoincidentConstraint(arc, "end", t2),
        new PointOnLineConstraint(corner, line1),
        new PointOnLineConstraint(corner, line2),
        new LineCircleTangentConstraint(line1, arc),
        new LineCircleTangentConstraint(line2, arc),
        radiusConstraint,
      ].forEach((constraint) => pushModelConstraint(constraint));
      return { ok: true, arc };
    }
    return Object.freeze({ createFillet });
  }
  window.FilletConstruction = Object.freeze({ create });
})();
