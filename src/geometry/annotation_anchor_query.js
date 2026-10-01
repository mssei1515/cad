/* Resolve leader targets and anchors without owning selection or annotation edits. */
(() => {
  "use strict";
  const { Point, Line, Circle, Arc, Spline, hypot2 } = window.GeometrySolver;
  const { projectPointToSegmentPoint, arcEndpointPoint, angleOnSignedSweep } = window.GeometryKernel;
  const { geometryRefForItem } = window.GeometryObjects;
  function create({ selectedGeometryItems, elementSketchId, activeSketchId, resolveGeometryRef }) {
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
      if (item instanceof Point) return { item, anchor: { x: item.x, y: item.y }, geometryRef: geometryRefForItem(item) };
      if (item instanceof Line) {
        const anchor = pointer ? projectPointToSegmentPoint(pointer, item) : { x: (item.p1.x + item.p2.x) / 2, y: (item.p1.y + item.p2.y) / 2 };
        return { item, anchor, geometryRef: geometryRefForItem(item) };
      }
      if (item instanceof Circle) {
        const base = pointer || { x: item.center.x + item.radius(), y: item.center.y };
        const angle = Math.atan2(base.y - item.center.y, base.x - item.center.x);
        return { item, anchor: { x: item.center.x + Math.cos(angle) * item.radius(), y: item.center.y + Math.sin(angle) * item.radius() }, geometryRef: geometryRefForItem(item) };
      }
      if (item instanceof Arc) {
        const base = pointer || arcEndpointPoint(item, "start");
        const angle = clampAngleToArcSweep(item, Math.atan2(base.y - item.center.y, base.x - item.center.x));
        return { item, anchor: { x: item.center.x + Math.cos(angle) * item.radius(), y: item.center.y + Math.sin(angle) * item.radius() }, geometryRef: geometryRefForItem(item) };
      }
      if (item instanceof Spline) {
        const base = pointer || window.SplineGeometry.evaluate(item.curve(), 0.5);
        const closest = base ? window.SplineGeometry.closestPoint(item.curve(), base, { samplesPerSpan: 28 }) : null;
        const anchor = closest?.point || window.SplineGeometry.evaluate(item.curve(), 0.5);
        return anchor ? { item, anchor, geometryRef: geometryRefForItem(item) } : null;
      }
      return null;
    }

    function annotationLeaderAnchor(element) {
      const item = resolveGeometryRef(element?.geometryRef);
      if (!item) return element?.start || null;
      return annotationLeaderTargetFromItem(item, element.start || null)?.anchor || element.start || null;
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


    return Object.freeze({ annotationLeaderTargetFromSelection, annotationLeaderTargetFromHit, annotationLeaderTargetFromItem, annotationLeaderAnchor });
  }
  window.AnnotationAnchorQuery = Object.freeze({ create });
})();
