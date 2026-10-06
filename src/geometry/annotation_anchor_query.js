/* Resolve leader targets and anchors without owning selection or annotation edits. */
(() => {
  "use strict";
  const { Point, Line, Circle, Arc, Spline, hypot2 } = window.GeometrySolver;
  const { distancePointToSegment, projectPointToSegmentPoint, arcEndpointPoint, angleOnSignedSweep } = window.GeometryKernel;
  const { geometryRefForItem } = window.GeometryObjects;
  function create({ selectedGeometryItems, elementSketchId, activeSketchId, resolveGeometryRef,
    viewportScale, isVisibleSketchElement, isExplicitPoint, isPointUsedByPrimitive, isPointUsedByLine, isReferencePoint, geometry = {} }) {
    const { allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines } = geometry;
    function annotationLeaderTargetFromSelection(pointer = null) {
      const items = selectedGeometryItems();
      if (items.length !== 1) return null;
      return annotationLeaderTargetFromItem(items[0], pointer);
    }

    function annotationLeaderTargetFromHit(hit, pointer = null) {
      if (!hit?.item) return null;
      return annotationLeaderTargetFromItem(hit.item, pointer);
    }

    function annotationLeaderTargetFromItem(item, pointer = null) {
      if (!item || elementSketchId(item) !== activeSketchId()) return null;
      if (item instanceof Point) return { item, anchor: { x: item.x, y: item.y }, attachment: { kind: "point" }, geometryRef: geometryRefForItem(item) };
      if (item instanceof Line) {
        const anchor = pointer ? projectPointToSegmentPoint(pointer, item) : { x: (item.p1.x + item.p2.x) / 2, y: (item.p1.y + item.p2.y) / 2 };
        const dx = item.p2.x - item.p1.x, dy = item.p2.y - item.p1.y;
        const t = ((anchor.x - item.p1.x) * dx + (anchor.y - item.p1.y) * dy) / (dx * dx + dy * dy || 1);
        return { item, anchor, attachment: { kind: "line", t }, geometryRef: geometryRefForItem(item) };
      }
      if (item instanceof Circle) {
        const base = pointer || { x: item.center.x + item.radius(), y: item.center.y };
        const angle = Math.atan2(base.y - item.center.y, base.x - item.center.x);
        return { item, anchor: { x: item.center.x + Math.cos(angle) * item.radius(), y: item.center.y + Math.sin(angle) * item.radius() }, attachment: { kind: "circle", angle: angle - (item.blockProjectionRotation || 0) }, geometryRef: geometryRefForItem(item) };
      }
      if (item instanceof Arc) {
        const base = pointer || arcEndpointPoint(item, "start");
        const angle = clampAngleToArcSweep(item, Math.atan2(base.y - item.center.y, base.x - item.center.x));
        return { item, anchor: { x: item.center.x + Math.cos(angle) * item.radius(), y: item.center.y + Math.sin(angle) * item.radius() }, attachment: { kind: "arc", t: arcFraction(item, angle) }, geometryRef: geometryRefForItem(item) };
      }
      if (item instanceof Spline) {
        const base = pointer || window.SplineGeometry.evaluate(item.curve(), 0.5);
        const closest = base ? window.SplineGeometry.closestPoint(item.curve(), base, { samplesPerSpan: 28 }) : null;
        const anchor = closest?.point || window.SplineGeometry.evaluate(item.curve(), 0.5);
        return anchor ? { item, anchor, attachment: { kind: "spline", t: closest?.t ?? 0.5 }, geometryRef: geometryRefForItem(item) } : null;
      }
      return null;
    }

    function annotationLeaderAnchor(element) {
      const item = resolveGeometryRef(element?.geometryRef);
      if (!item) return element?.start || null;
      const attachment = element.attachment;
      if (attachment?.kind === "point" && item instanceof Point) return { x: item.x, y: item.y };
      if (attachment?.kind === "line" && item instanceof Line && Number.isFinite(attachment.t)) return { x: item.p1.x + (item.p2.x - item.p1.x) * attachment.t, y: item.p1.y + (item.p2.y - item.p1.y) * attachment.t };
      if (attachment?.kind === "spline" && item instanceof Spline && Number.isFinite(attachment.t)) return window.SplineGeometry.evaluate(item.curve(), attachment.t);
      if (attachment?.kind === "circle" && item instanceof Circle || attachment?.kind === "arc" && item instanceof Arc) {
        const angle = attachment.kind === "arc" ? item.startAngle + (item.endAngle - item.startAngle) * attachment.t : attachment.angle + (item.blockProjectionRotation || 0);
        if (Number.isFinite(angle)) return { x: item.center.x + item.radius() * Math.cos(angle), y: item.center.y + item.radius() * Math.sin(angle) };
      }
      return annotationLeaderTargetFromItem(item, element.start || null)?.anchor || element.start || null;
    }

    function arcFraction(arc, angle) {
      const sweep = arc.endAngle - arc.startAngle;
      if (Math.abs(sweep) < 1e-12) return 0;
      const tau = Math.PI * 2;
      const delta = sweep >= 0 ? ((angle - arc.startAngle) % tau + tau) % tau : -((arc.startAngle - angle) % tau + tau) % tau;
      return Math.max(0, Math.min(1, delta / sweep));
    }

    function clampAngleToArcSweep(arc, angle) {
      if (angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return angle;
      const start = arcEndpointPoint(arc, "start");
      const end = arcEndpointPoint(arc, "end");
      const point = {
        x: arc.center.x + Math.cos(angle) * arc.radius(),
        y: arc.center.y + Math.sin(angle) * arc.radius(),
      };
      return hypot2(point.x - start.x, point.y - start.y) <= hypot2(point.x - end.x, point.y - end.y) ? arc.startAngle : arc.endAngle;
    }


    function hitAnnotationTarget(x, y) {
      const threshold = 8 / viewportScale();
      const pointThreshold = 10 / viewportScale();
      const points = allGeometryPoints();
      const arcs = allGeometryArcs();
      const circles = allGeometryCircles();
      const lines = allGeometryLines();
      const splines = allGeometrySplines();
      for (let i = points.length - 1; i >= 0; i--) {
        const point = points[i];
        if (!isVisibleSketchElement(point)) continue;
        if (!point.blockProjection && !isExplicitPoint(point) && !isPointUsedByPrimitive(point) && !isPointUsedByLine(point) && !isReferencePoint(point)) continue;
        if (hypot2(point.x - x, point.y - y) <= pointThreshold) return { kind: "point", item: point };
      }
      for (let i = arcs.length - 1; i >= 0; i--) {
        const arc = arcs[i];
        if (!isVisibleSketchElement(arc)) continue;
        const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
        if (Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return { kind: "arc", item: arc };
      }
      for (let i = circles.length - 1; i >= 0; i--) {
        const circle = circles[i];
        if (!isVisibleSketchElement(circle)) continue;
        if (Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold) return { kind: "circle", item: circle };
      }
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!isVisibleSketchElement(line)) continue;
        if (distancePointToSegment(x, y, line) <= threshold) return { kind: "line", item: line };
      }
      for (let i = splines.length - 1; i >= 0; i--) {
        const spline = splines[i];
        if (!isVisibleSketchElement(spline)) continue;
        const closest = window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 });
        if (closest?.distance <= threshold) return { kind: "spline", item: spline };
      }
      return null;
    }

    return Object.freeze({ hitAnnotationTarget, annotationLeaderTargetFromSelection, annotationLeaderTargetFromHit, annotationLeaderTargetFromItem, annotationLeaderAnchor });
  }
  window.AnnotationAnchorQuery = Object.freeze({ create });
})();
