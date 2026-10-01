/* Ordinary canvas geometry hit rules; no pointer events or selection mutation. */
(() => {
  "use strict";
  const { hypot2 } = window.GeometrySolver;
  const { distancePointToSegment, arcEndpointPoint, angleOnSignedSweep } = window.GeometryKernel;
  const { normalizedDrawingOrder } = window.DrawingOrder;
  function create({ currentScope, viewportScale, isEditableSketchElement, isSelectableEndpointPoint, isExplicitPoint }) {
    function hitPointByPredicate(x, y, predicate) {
      const model = currentScope();
      const radius = 10 / viewportScale();
      for (let i = model.points.length - 1; i >= 0; i--) {
        const p = model.points[i];
        if (!isEditableSketchElement(p)) continue;
        if (!predicate(p)) continue;
        if (hypot2(p.x - x, p.y - y) <= radius) return p;
      }
      return null;
    }

    function hitEndpointPoint(x, y) {
      return hitPointByPredicate(x, y, isSelectableEndpointPoint);
    }

    function hitExplicitPoint(x, y) {
      return hitPointByPredicate(x, y, isExplicitPoint);
    }

    function hitAnyPoint(x, y) {
      return hitEndpointPoint(x, y) || hitExplicitPoint(x, y);
    }

    function hitPoint(x, y) {
      return hitAnyPoint(x, y);
    }

    function hitLine(x, y) {
      const model = currentScope();
      const threshold = 7 / viewportScale();
      const lines = model.lines.slice().sort((a, b) => (normalizedDrawingOrder(b.drawingOrder) ?? 0) - (normalizedDrawingOrder(a.drawingOrder) ?? 0));
      for (const l of lines) {
        if (!isEditableSketchElement(l)) continue;
        if (distancePointToSegment(x, y, l) <= threshold) return l;
      }
      return null;
    }

    function hitCircle(x, y) {
      const model = currentScope();
      const threshold = 7 / viewportScale();
      const circles = model.circles.slice().sort((a, b) => (normalizedDrawingOrder(b.drawingOrder) ?? 0) - (normalizedDrawingOrder(a.drawingOrder) ?? 0));
      for (const c of circles) {
        if (!isEditableSketchElement(c)) continue;
        const d = hypot2(x - c.center.x, y - c.center.y);
        if (Math.abs(d - c.radius()) <= threshold) return c;
      }
      return null;
    }

    function hitArc(x, y) {
      const model = currentScope();
      const threshold = 7 / viewportScale();
      const arcs = model.arcs.slice().sort((a, b) => (normalizedDrawingOrder(b.drawingOrder) ?? 0) - (normalizedDrawingOrder(a.drawingOrder) ?? 0));
      for (const a of arcs) {
        if (!isEditableSketchElement(a)) continue;
        const radius = a.radius();
        const d = hypot2(x - a.center.x, y - a.center.y);
        if (Math.abs(d - radius) > threshold) continue;
        const angle = Math.atan2(y - a.center.y, x - a.center.x);
        if (angleOnSignedSweep(angle, a.startAngle, a.endAngle)) return a;
      }
      return null;
    }

    function hitArcEndpoint(x, y) {
      const model = currentScope();
      const threshold = 10 / viewportScale();
      for (let i = model.arcs.length - 1; i >= 0; i--) {
        const arc = model.arcs[i];
        if (!isEditableSketchElement(arc)) continue;
        for (const endpoint of ["end", "start"]) {
          const point = arcEndpointPoint(arc, endpoint);
          if (hypot2(point.x - x, point.y - y) <= threshold) return { arc, endpoint, point };
        }
      }
      return null;
    }

    function hitSpline(x, y) {
      const model = currentScope();
      const threshold = 7 / viewportScale();
      const splines = model.splines.slice().sort((a, b) => (normalizedDrawingOrder(b.drawingOrder) ?? 0) - (normalizedDrawingOrder(a.drawingOrder) ?? 0));
      for (const spline of splines) {
        if (!isEditableSketchElement(spline)) continue;
        const closest = window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 });
        if (closest && closest.distance <= threshold) return spline;
      }
      return null;
    }


    return Object.freeze({ hitEndpointPoint, hitExplicitPoint, hitAnyPoint, hitPoint, hitLine, hitCircle, hitArc, hitArcEndpoint, hitSpline });
  }
  window.GeometryHitQuery = Object.freeze({ create });
})();
