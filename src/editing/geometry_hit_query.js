/* Ordinary canvas geometry hit rules; no pointer events or selection mutation. */
(() => {
  "use strict";
  const { hypot2 } = window.GeometrySolver;
  const { distancePointToSegment, arcEndpointPoint, angleOnSignedSweep } = window.GeometryKernel;
  const { normalizedDrawingOrder } = window.DrawingOrder;
  function create({ currentScope, viewportScale, isEditableSketchElement, isSelectableEndpointPoint, isExplicitPoint,
    hitDimension, constraintSketchId, elementSketchId, isVisibleSketchElement, hitBlockInstance, blockDefinitionById,
    hitGeometryInstance = () => null, hitAnnotationElement = () => null, hitHatchAt = () => null, hitReferenceImageAt = () => null, preferredSketchId = () => null }) {
    function preferredOrder(items) {
      const id = preferredSketchId();
      return id ? items.sort((a, b) => Number((b.sketchId || elementSketchId(b)) === id) - Number((a.sketchId || elementSketchId(a)) === id)) : items;
    }
    function hitPointByPredicate(x, y, predicate) {
      const model = currentScope();
      const radius = 10 / viewportScale();
      for (const p of preferredOrder(model.points.slice().reverse())) {
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
      for (const l of preferredOrder(lines)) {
        if (!isEditableSketchElement(l)) continue;
        if (distancePointToSegment(x, y, l) <= threshold) return l;
      }
      return null;
    }

    function hitCircle(x, y) {
      const model = currentScope();
      const threshold = 7 / viewportScale();
      const circles = model.circles.slice().sort((a, b) => (normalizedDrawingOrder(b.drawingOrder) ?? 0) - (normalizedDrawingOrder(a.drawingOrder) ?? 0));
      for (const c of preferredOrder(circles)) {
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
      for (const a of preferredOrder(arcs)) {
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
      for (const arc of preferredOrder(model.arcs.slice().reverse())) {
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
      for (const spline of preferredOrder(splines)) {
        if (!isEditableSketchElement(spline)) continue;
        const closest = window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 });
        if (closest && closest.distance <= threshold) return spline;
      }
      return null;
    }


    function hitSketchIdentityElement(x, y, options = {}) {
      const model = currentScope();
      const allowInactiveGeometry = Boolean(options.allowInactiveGeometry);
      const threshold = 7 / viewportScale();
      const pointThreshold = 10 / viewportScale();
      const accepts = (item) => isVisibleSketchElement(item) && (allowInactiveGeometry || isEditableSketchElement(item));
      const dimensionHit = hitDimension(x, y, { activeOnly: false });
      if (dimensionHit) {
        const sketchId = constraintSketchId(dimensionHit.constraint);
        return {
          id: dimensionHit.constraint.name || "寸法",
          label: dimensionHit.constraint.name || "寸法",
          sketchId,
          item: dimensionHit.constraint,
          kind: "dimension",
        };
      }

      for (const p of preferredOrder(model.points.slice().reverse())) {
        if (!accepts(p)) continue;
        if (!isExplicitPoint(p) && !isSelectableEndpointPoint(p)) continue;
        if (hypot2(p.x - x, p.y - y) <= pointThreshold) return { id: p.id, sketchId: elementSketchId(p), item: p, kind: "point" };
      }
      for (let i = model.lines.length - 1; i >= 0; i--) {
        const line = model.lines[i];
        if (!accepts(line)) continue;
        if (distancePointToSegment(x, y, line) <= threshold) return { id: line.id, sketchId: elementSketchId(line), item: line, kind: "line" };
      }
      for (let i = model.circles.length - 1; i >= 0; i--) {
        const circle = model.circles[i];
        if (!accepts(circle)) continue;
        if (Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold) return { id: circle.id, sketchId: elementSketchId(circle), item: circle, kind: "circle" };
      }
      for (const arc of preferredOrder(model.arcs.slice().reverse())) {
        if (!accepts(arc)) continue;
        const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
        if (Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return { id: arc.id, sketchId: elementSketchId(arc), item: arc, kind: "arc" };
      }
      for (let i = model.splines.length - 1; i >= 0; i--) {
        const spline = model.splines[i];
        if (!accepts(spline)) continue;
        const closest = window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 });
        if (closest?.distance <= threshold) return { id: spline.id, sketchId: elementSketchId(spline), item: spline, kind: "spline" };
      }
      const block = hitBlockInstance(x, y, !allowInactiveGeometry);
      if (block) {
        const definition = blockDefinitionById(block.definitionId);
        return {
          id: block.id,
          label: `Block ${block.id}${definition?.name ? `: ${definition.name}` : ""}`,
          sketchId: block.sketchId,
          item: block,
          kind: "block",
        };
      }
      for (const [kind, item] of [
        ["instance", hitGeometryInstance(x, y, !allowInactiveGeometry)],
        ["annotation", hitAnnotationElement(x, y, { activeOnly: !allowInactiveGeometry })?.element],
        ["hatch", hitHatchAt(x, y, { activeOnly: !allowInactiveGeometry })],
        ["image", hitReferenceImageAt(x, y, { activeOnly: !allowInactiveGeometry })],
      ]) {
        if (item) return { item, id: item.id, sketchId: elementSketchId(item), kind };
      }
      return null;
    }

    return Object.freeze({ hitSketchIdentityElement, hitEndpointPoint, hitExplicitPoint, hitAnyPoint, hitPoint, hitLine, hitCircle, hitArc, hitArcEndpoint, hitSpline });
  }
  window.GeometryHitQuery = Object.freeze({ create });
})();
