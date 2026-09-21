/* Geometry insertion and minimum-shape policies for the current editing scope. */
(function () {
  "use strict";
  const { Point, Line, Circle, Arc, Spline, GeometryFixedConstraint, OffsetChainConstraint, hypot2 } = window.GeometrySolver;
  const { MIN_ORIENTATION_LENGTH, arcSweep } = window.GeometryKernel;
  function create({ currentScope, ids, assignSketchId, currentConstruction, minLineLength: MIN_LINE_LENGTH, minArcLength: MIN_ARC_LENGTH }) {
    function addPoint(x, y, fixed = false, kind = "explicit") {
      const p = new Point(ids.allocate("point"), x, y, fixed, kind);
      assignSketchId(p);
      currentScope().points.push(p);
      return p;
    }

    function addPointToSketch(x, y, sketchId, kind = "endpoint") {
      const point = new Point(ids.allocate("point"), x, y, false, kind);
      point.sketchId = sketchId;
      currentScope().points.push(point);
      return point;
    }

    function addLine(p1, p2, construction = currentConstruction()) {
      if (p1 === p2) return null;
      const l = new Line(ids.allocate("line"), p1, p2, construction);
      assignSketchId(l);
      ensureLineMinimumLength(l);
      currentScope().lines.push(l);
      return l;
    }

    function addCircle(center, radiusValue, construction = currentConstruction()) {
      if (!center || !Number.isFinite(radiusValue) || radiusValue < MIN_ORIENTATION_LENGTH) return null;
      const c = new Circle(ids.allocate("circle"), center, radiusValue, construction);
      assignSketchId(c);
      currentScope().circles.push(c);
      return c;
    }

    function addArc(center, radiusValue, startAngle, endAngle, construction = currentConstruction()) {
      if (!center || !Number.isFinite(radiusValue) || radiusValue < MIN_ORIENTATION_LENGTH) return null;
      if (!Number.isFinite(startAngle) || !Number.isFinite(endAngle)) return null;
      const a = new Arc(ids.allocate("arc"), center, radiusValue, startAngle, endAngle, construction);
      assignSketchId(a);
      normalizeArcSweep(a);
      currentScope().arcs.push(a);
      return a;
    }

    function addSpline(fitPoints, closed = false, construction = currentConstruction()) {
      const uniquePointCount = new Set((fitPoints || []).filter(Boolean)).size;
      if (uniquePointCount < 3) return null;
      const spline = new Spline(ids.allocate("spline"), fitPoints, closed, construction);
      assignSketchId(spline);
      if (!spline.curve().valid) return null;
      currentScope().splines.push(spline);
      return spline;
    }

    function ensureLineMinimumLength(line, preferred = null) {
      if (!line) return { changed: false, failed: false };
      const dx = line.p2.x - line.p1.x;
      const dy = line.p2.y - line.p1.y;
      const len = hypot2(dx, dy);
      if (len >= MIN_LINE_LENGTH) return { changed: false, failed: false };
      const fallback = preferred || (len > 1e-9 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 });
      const dirLen = hypot2(fallback.x, fallback.y);
      const dir = dirLen > 1e-9 ? { x: fallback.x / dirLen, y: fallback.y / dirLen } : { x: 1, y: 0 };
      if (!line.p2.fixed) {
        line.p2.x = line.p1.x + dir.x * MIN_LINE_LENGTH;
        line.p2.y = line.p1.y + dir.y * MIN_LINE_LENGTH;
        return { changed: true, failed: false };
      }
      if (!line.p1.fixed) {
        line.p1.x = line.p2.x - dir.x * MIN_LINE_LENGTH;
        line.p1.y = line.p2.y - dir.y * MIN_LINE_LENGTH;
        return { changed: true, failed: false };
      }
      return { changed: false, failed: true };
    }

    function normalizeArcSweep(arc) {
      // A display minimum must not overwrite endpoints that participate in the
      // solved constraint system (notably small fillets).
      if (currentScope().constraints.some((c) => c.enabled !== false && (
        (c.arc === arc && typeof c.endpoint === "string")
        || (c.a === arc && typeof c.endpointA === "string")
        || (c.b === arc && typeof c.endpointB === "string")
        || (c instanceof GeometryFixedConstraint && c.geometry === arc)
        || (c instanceof OffsetChainConstraint && (c.sources.includes(arc) || c.offsets.includes(arc)))
      ))) return false;
      const twoPi = Math.PI * 2;
      const sweep = arcSweep(arc);
      if (Math.abs(sweep) >= twoPi - 1e-9) {
        arc.endAngle = arc.startAngle;
        return true;
      }
      if (Math.abs(sweep) > 0 && Math.abs(sweep) * arc.radius() < MIN_ARC_LENGTH) {
        arc.endAngle = arc.startAngle;
        return true;
      }
      return false;
    }

    return Object.freeze({ addPoint, addPointToSketch, addLine, addCircle, addArc, addSpline, ensureLineMinimumLength, normalizeArcSweep });
  }
  window.GeometryCreation = Object.freeze({ create });
})();
