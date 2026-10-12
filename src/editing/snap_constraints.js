/* Translate resolved snaps into editing constraints; no pointer or UI state. */
(function () {
  "use strict";
  const { CoincidentConstraint, PointOnLineConstraint, PointOnCircleConstraint, ArcEndpointCoincidentConstraint, PointOnSplineConstraint, ArcEndpointOnLineConstraint, ArcEndpointOnCircleConstraint, ArcEndpointArcEndpointCoincidentConstraint } = window.GeometrySolver;
  function create({ isActiveSketchElement, elementSketchId, isReferenceSourceSketchId, addPoint, addConstraintIfMissing }) {
    function snapTargetElement(snap) {
      if (!snap?.data) return null;
      const { point, line, primitive, arc, spline } = snap.data;
      return point || line || primitive || arc || spline || null;
    }

    function snapReferenceSketchId(snap) {
      const target = snapTargetElement(snap);
      if (!target || isActiveSketchElement(target)) return null;
      const sketchId = elementSketchId(target);
      return isReferenceSourceSketchId(sketchId) ? sketchId : null;
    }

    function snapCanCreateConstraint(snap) {
      const target = snapTargetElement(snap);
      return !target || isActiveSketchElement(target) || Boolean(snapReferenceSketchId(snap));
    }

    function addPointSnapConstraints(point, snap) {
      if (!point || !snap?.data) return 0;
      if (!snapCanCreateConstraint(snap)) return 0;
      const referenceSketchId = snapReferenceSketchId(snap);
      const options = referenceSketchId ? { referenceSketchId } : {};
      const { point: snapPoint, line, primitive, arc, spline, parameter, endpoint } = snap.data;
      let added = 0;
      if (snapPoint && snapPoint !== point) {
        added += addConstraintIfMissing(
          new CoincidentConstraint(point, snapPoint),
          (c) => c instanceof CoincidentConstraint && ((c.p1 === point && c.p2 === snapPoint) || (c.p1 === snapPoint && c.p2 === point)),
          options,
        ) ? 1 : 0;
      }
      if (line) {
        added += addConstraintIfMissing(
          new PointOnLineConstraint(point, line),
          (c) => c instanceof PointOnLineConstraint && c.point === point && c.line === line,
          options,
        ) ? 1 : 0;
      }
      if (primitive && primitive.center !== point) {
        added += addConstraintIfMissing(
          new PointOnCircleConstraint(point, primitive),
          (c) => c instanceof PointOnCircleConstraint && c.point === point && c.primitive === primitive,
          options,
        ) ? 1 : 0;
      }
      if (arc && endpoint) {
        added += addConstraintIfMissing(
          new ArcEndpointCoincidentConstraint(arc, endpoint, point),
          (c) => c instanceof ArcEndpointCoincidentConstraint && c.arc === arc && c.endpoint === endpoint && c.point === point,
          options,
        ) ? 1 : 0;
      } else if (arc) {
        added += addConstraintIfMissing(
          new PointOnCircleConstraint(point, arc),
          (c) => c instanceof PointOnCircleConstraint && c.point === point && c.primitive === arc,
          options,
        ) ? 1 : 0;
      }
      if (spline) {
        added += addConstraintIfMissing(
          new PointOnSplineConstraint(point, spline, Number(parameter)),
          (c) => c instanceof PointOnSplineConstraint && c.point === point && c.spline === spline,
          options,
        ) ? 1 : 0;
      }
      return added;
    }

    function addArcEndpointSnapConstraints(arc, endpointName, snap) {
      if (!arc || !snap?.data) return 0;
      if (!snapCanCreateConstraint(snap)) return 0;
      const referenceSketchId = snapReferenceSketchId(snap);
      const options = referenceSketchId ? { referenceSketchId } : {};
      const { point, line, primitive, arc: snapArc, endpoint } = snap.data;
      let added = 0;
      if (point) {
        added += addConstraintIfMissing(
          new ArcEndpointCoincidentConstraint(arc, endpointName, point),
          (c) => c instanceof ArcEndpointCoincidentConstraint && c.arc === arc && c.endpoint === endpointName && c.point === point,
          options,
        ) ? 1 : 0;
      }
      if (line) {
        added += addConstraintIfMissing(
          new ArcEndpointOnLineConstraint(arc, endpointName, line),
          (c) => c instanceof ArcEndpointOnLineConstraint && c.arc === arc && c.endpoint === endpointName && c.line === line,
          options,
        ) ? 1 : 0;
      }
      if (primitive && primitive !== arc) {
        added += addConstraintIfMissing(
          new ArcEndpointOnCircleConstraint(arc, endpointName, primitive),
          (c) => c instanceof ArcEndpointOnCircleConstraint && c.arc === arc && c.endpoint === endpointName && c.primitive === primitive,
          options,
        ) ? 1 : 0;
      }
      if (snapArc && endpoint) {
        added += addConstraintIfMissing(
          new ArcEndpointArcEndpointCoincidentConstraint(arc, endpointName, snapArc, endpoint),
          (c) =>
            c instanceof ArcEndpointArcEndpointCoincidentConstraint &&
            ((c.a === arc && c.endpointA === endpointName && c.b === snapArc && c.endpointB === endpoint) ||
              (c.a === snapArc && c.endpointA === endpoint && c.b === arc && c.endpointB === endpointName)),
          options,
        ) ? 1 : 0;
      } else if (snapArc && snapArc !== arc) {
        added += addConstraintIfMissing(
          new ArcEndpointOnCircleConstraint(arc, endpointName, snapArc),
          (c) => c instanceof ArcEndpointOnCircleConstraint && c.arc === arc && c.endpoint === endpointName && c.primitive === snapArc,
          options,
        ) ? 1 : 0;
      }
      return added;
    }

    function addCircularBoundarySnapConstraints(targetPrimitive, snap) {
      if (!targetPrimitive || !snap?.data) return 0;
      if (!snapCanCreateConstraint(snap)) return 0;
      const referenceSketchId = snapReferenceSketchId(snap);
      const options = referenceSketchId ? { referenceSketchId } : {};
      const { point, line, primitive, arc, endpoint } = snap.data;
      let added = 0;
      if (point) {
        added += addConstraintIfMissing(
          new PointOnCircleConstraint(point, targetPrimitive),
          (c) => c instanceof PointOnCircleConstraint && c.point === point && c.primitive === targetPrimitive,
          options,
        ) ? 1 : 0;
      } else if (arc && endpoint) {
        added += addConstraintIfMissing(
          new ArcEndpointOnCircleConstraint(arc, endpoint, targetPrimitive),
          (c) => c instanceof ArcEndpointOnCircleConstraint && c.arc === arc && c.endpoint === endpoint && c.primitive === targetPrimitive,
          options,
        ) ? 1 : 0;
      } else {
        const ref = addPoint(snap.x, snap.y, false, "endpoint");
        added += addPointSnapConstraints(ref, snap);
        added += addConstraintIfMissing(
          new PointOnCircleConstraint(ref, targetPrimitive),
          (c) => c instanceof PointOnCircleConstraint && c.point === ref && c.primitive === targetPrimitive,
        ) ? 1 : 0;
        if (primitive && primitive !== targetPrimitive) {
          added += addConstraintIfMissing(
            new PointOnCircleConstraint(ref, primitive),
            (c) => c instanceof PointOnCircleConstraint && c.point === ref && c.primitive === primitive,
            options,
          ) ? 1 : 0;
        }
      }
      return added;
    }

    function addLineBoundarySnapConstraints(targetLine, snap) {
      if (!targetLine || !snap?.data) return 0;
      if (!snapCanCreateConstraint(snap)) return 0;
      const referenceSketchId = snapReferenceSketchId(snap);
      const options = referenceSketchId ? { referenceSketchId } : {};
      const { point, arc, endpoint } = snap.data;
      if (point) {
        return addConstraintIfMissing(
          new PointOnLineConstraint(point, targetLine),
          (c) => c instanceof PointOnLineConstraint && c.point === point && c.line === targetLine,
          options,
        ) ? 1 : 0;
      }
      if (arc && endpoint) {
        return addConstraintIfMissing(
          new ArcEndpointOnLineConstraint(arc, endpoint, targetLine),
          (c) => c instanceof ArcEndpointOnLineConstraint && c.arc === arc && c.endpoint === endpoint && c.line === targetLine,
          options,
        ) ? 1 : 0;
      }
      const ref = addPoint(snap.x, snap.y, false, "endpoint");
      let added = addPointSnapConstraints(ref, snap);
      added += addConstraintIfMissing(
        new PointOnLineConstraint(ref, targetLine),
        (c) => c instanceof PointOnLineConstraint && c.point === ref && c.line === targetLine,
      ) ? 1 : 0;
      return added;
    }
    return Object.freeze({ addPointSnapConstraints, addArcEndpointSnapConstraints, addCircularBoundarySnapConstraints, addLineBoundarySnapConstraints });
  }
  window.SnapConstraints = Object.freeze({ create });
})();
