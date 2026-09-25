/* Drawing snap candidates, stable priority selection and current snap ownership. */
(function () {
  "use strict";
  const { hypot2 } = window.GeometrySolver;
  const { closestPointOnSegment, arcEndpointPoint, angleOnSignedSweep, circlePointAtPointer } = window.GeometryKernel;
  function create({ geometryReads, isVisibleSketchElement, isActiveSketchElement, isSplineOnlyFitPoint, isReferencePoint, isPrimitiveCenterPoint, isEndpointPoint, isPointUsedByPrimitive, isExplicitPoint, sketchName, elementSketchId, applicationText }) {
    const { allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines } = geometryReads;
    let activeSnap = null;
    function makeSnapCandidate(source, x, y, label, priority, data = {}) {
      const sketchTarget = data.point || data.line || data.primitive || data.arc || data.spline;
      if (sketchTarget && !isActiveSketchElement(sketchTarget)) label = `${label} / ${sketchName(elementSketchId(sketchTarget))}`;
      return {
        x,
        y,
        label,
        priority,
        source,
        data,
        distance: hypot2(source.x - x, source.y - y),
      };
    }

    function addSnapCandidate(candidates, source, x, y, label, priority, data = {}) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      candidates.push(makeSnapCandidate(source, x, y, label, priority, data));
    }

    function snapCandidates(source) {
      const candidates = [];
      for (const p of allGeometryPoints()) {
        if (!isVisibleSketchElement(p)) continue;
        if (isSplineOnlyFitPoint(p)) continue;
        if (p.blockProjection) addSnapCandidate(candidates, source, p.x, p.y, "ブロック点", 0, { point: p });
        else if (isReferencePoint(p)) addSnapCandidate(candidates, source, p.x, p.y, "参照点", 0, { point: p });
        else if (isPrimitiveCenterPoint(p)) addSnapCandidate(candidates, source, p.x, p.y, "中心", 0, { point: p });
        else if (isEndpointPoint(p) && isPointUsedByPrimitive(p)) addSnapCandidate(candidates, source, p.x, p.y, "端点", 0, { point: p });
        else if (isExplicitPoint(p)) addSnapCandidate(candidates, source, p.x, p.y, "点", 0, { point: p });
      }
      for (const line of allGeometryLines()) {
        if (!isVisibleSketchElement(line)) continue;
        const closest = closestPointOnSegment(source.x, source.y, line);
        addSnapCandidate(candidates, source, closest.x, closest.y, "線上", 2, { line });
      }
      for (const circle of allGeometryCircles()) {
        if (!isVisibleSketchElement(circle)) continue;
        addSnapCandidate(candidates, source, circle.center.x, circle.center.y, "中心", 0, { primitive: circle });
        const p = circlePointAtPointer(source, circle);
        if (p) addSnapCandidate(candidates, source, p.x, p.y, "円周", 2, { primitive: circle });
      }
      for (const arc of allGeometryArcs()) {
        if (!isVisibleSketchElement(arc)) continue;
        addSnapCandidate(candidates, source, arc.center.x, arc.center.y, "中心", 0, { primitive: arc });
        for (const endpoint of ["start", "end"]) {
          const p = arcEndpointPoint(arc, endpoint);
          addSnapCandidate(candidates, source, p.x, p.y, "端点", 0, { arc, endpoint });
        }
        const p = circlePointAtPointer(source, arc);
        if (p && angleOnSignedSweep(Math.atan2(p.y - arc.center.y, p.x - arc.center.x), arc.startAngle, arc.endAngle)) {
          addSnapCandidate(candidates, source, p.x, p.y, "円弧", 2, { arc });
        }
      }
      for (const spline of allGeometrySplines()) {
        if (!isVisibleSketchElement(spline)) continue;
        if (!spline.closed) {
          for (const [label, point] of [[applicationText("始点", "Start point"), spline.startPoint()], [applicationText("終点", "End point"), spline.endPoint()]]) {
            if (point) addSnapCandidate(candidates, source, point.x, point.y, label, 0, { point });
          }
        }
        const closest = window.SplineGeometry.closestPoint(spline.curve(), source, { samplesPerSpan: 24 });
        if (closest) addSnapCandidate(candidates, source, closest.point.x, closest.point.y, applicationText("スプライン上", "On spline"), 2, { spline, parameter: closest.t });
      }
      return candidates;
    }

    function snapForDrawing(p, threshold) {
      let best = null;
      for (const candidate of snapCandidates(p)) {
        if (candidate.distance > threshold) continue;
        if (
          !best ||
          candidate.priority < best.priority ||
          (candidate.priority === best.priority && candidate.distance < best.distance)
        ) {
          best = candidate;
        }
      }
      activeSnap = best;
      return best ? { x: best.x, y: best.y } : p;
    }
    function clear() { activeSnap = null; }
    return Object.freeze({ candidates: snapCandidates, resolve: snapForDrawing, clear, get active() { return activeSnap; } });
  }
  window.DrawingSnap = Object.freeze({ create });
})();
