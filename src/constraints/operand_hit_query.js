/* Reference-sketch and projected geometry hits for constraint operands. */
(() => {
  "use strict";
  const { Arc, hypot2 } = window.GeometrySolver;
  const { distancePointToSegment, arcEndpointPoint, angleOnSignedSweep, circlePointAtPointer } = window.GeometryKernel;
  function create({ viewportScale, geometry, sketches, points, makeConstraintOperand, operandFromReferenceTarget, hits = {} }) {
    const { hitPoint, hitLine, hitCircle, hitArc, hitSpline, hitArcEndpoint } = hits;
    const { geometryInstanceBundles, blockProjectionBundles, allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines } = geometry;
    const { isVisibleSketchId, operandRelationForSketch, referenceSourceSketchIds, elementSketchId, isVisibleSketchElement } = sketches;
    const { isExplicitPoint, isPointUsedByPrimitive, isReferencePoint } = points;
    function hitDerivedProjectionOperand(x, y) {
      const threshold = 8 / viewportScale();
      const pointThreshold = 10 / viewportScale();
      for (const bundle of geometryInstanceBundles().slice().reverse()) {
        if (!isVisibleSketchId(bundle.instance.sketchId) || !operandRelationForSketch(bundle.instance.sketchId)) continue;
        for (const point of bundle.points.slice().reverse()) if (hypot2(point.x - x, point.y - y) <= pointThreshold) return makeConstraintOperand("point", { point });
        for (const line of bundle.lines.slice().reverse()) if (distancePointToSegment(x, y, line) <= threshold) return makeConstraintOperand("line", { line });
        for (const primitive of [...bundle.circles, ...bundle.arcs].reverse()) {
          const angle = Math.atan2(y - primitive.center.y, x - primitive.center.x);
          if (Math.abs(hypot2(x - primitive.center.x, y - primitive.center.y) - primitive.radius()) <= threshold && (!(primitive instanceof Arc) || angleOnSignedSweep(angle, primitive.startAngle, primitive.endAngle))) return makeConstraintOperand("primitive", { primitive, hitPoint: circlePointAtPointer({ x, y }, primitive) });
        }
        for (const spline of bundle.splines.slice().reverse()) {
          const closest = window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 });
          if (closest?.distance <= threshold) return makeConstraintOperand("spline", { spline, parameter: closest.t });
        }
      }
      return null;
    }

    function hitBlockProjectionOperand(x, y) {
      const threshold = 8 / viewportScale();
      const pointThreshold = 10 / viewportScale();
      for (const bundle of blockProjectionBundles().slice().reverse()) {
        if (!isVisibleSketchId(bundle.instance.sketchId)) continue;
        const relation = operandRelationForSketch(bundle.instance.sketchId);
        if (!relation) continue;
        for (const point of bundle.points.slice().reverse()) {
          if (hypot2(point.x - x, point.y - y) <= pointThreshold) return makeConstraintOperand("point", { point });
        }
        for (const line of bundle.lines.slice().reverse()) {
          if (distancePointToSegment(x, y, line) <= threshold) return makeConstraintOperand("line", { line });
        }
        for (const circle of bundle.circles.slice().reverse()) {
          if (Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold) return makeConstraintOperand("primitive", { primitive: circle, hitPoint: circlePointAtPointer({ x, y }, circle) });
        }
        for (const arc of bundle.arcs.slice().reverse()) {
          for (const endpoint of ["start", "end"]) {
            const point = arcEndpointPoint(arc, endpoint);
            if (hypot2(point.x - x, point.y - y) <= pointThreshold) return makeConstraintOperand("arc-endpoint", { arc, endpoint });
          }
          const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
          if (Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return makeConstraintOperand("primitive", { primitive: arc, hitPoint: circlePointAtPointer({ x, y }, arc) });
        }
        for (const spline of (bundle.splines || []).slice().reverse()) {
          const closest = window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 });
          if (closest?.distance <= threshold) return makeConstraintOperand("spline", { spline, parameter: closest.t });
        }
      }
      return null;
    }

    function hitReferenceTarget(x, y) {
      const threshold = 7 / viewportScale();
      const pointThreshold = 10 / viewportScale();
      const allowedSketches = new Set(referenceSourceSketchIds());
      if (allowedSketches.size === 0) return null;
      const points = allGeometryPoints();
      const lines = allGeometryLines();
      const circles = allGeometryCircles();
      const arcs = allGeometryArcs();
      const splines = allGeometrySplines();
      for (let i = points.length - 1; i >= 0; i--) {
        const point = points[i];
        const sketchId = elementSketchId(point);
        if (!allowedSketches.has(sketchId) || !isVisibleSketchElement(point)) continue;
        if (!point.blockProjection && !isExplicitPoint(point) && !isPointUsedByPrimitive(point) && !isReferencePoint(point)) continue;
        if (hypot2(point.x - x, point.y - y) <= pointThreshold) return { kind: "point", point, sketchId };
      }
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        const sketchId = elementSketchId(line);
        if (!allowedSketches.has(sketchId) || !isVisibleSketchElement(line)) continue;
        if (distancePointToSegment(x, y, line) <= threshold) return { kind: "line", line, sketchId };
      }
      for (let i = circles.length - 1; i >= 0; i--) {
        const circle = circles[i];
        const sketchId = elementSketchId(circle);
        if (!allowedSketches.has(sketchId) || !isVisibleSketchElement(circle)) continue;
        if (Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold) return { kind: "primitive", primitive: circle, sketchId };
      }
      for (let i = arcs.length - 1; i >= 0; i--) {
        const arc = arcs[i];
        const sketchId = elementSketchId(arc);
        if (!allowedSketches.has(sketchId) || !isVisibleSketchElement(arc)) continue;
        const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
        if (Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return { kind: "primitive", primitive: arc, sketchId };
      }
      for (let i = splines.length - 1; i >= 0; i--) {
        const spline = splines[i];
        const sketchId = elementSketchId(spline);
        if (!allowedSketches.has(sketchId) || !isVisibleSketchElement(spline)) continue;
        const closest = window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 });
        if (closest?.distance <= threshold) return { kind: "spline", spline, parameter: closest.t, sketchId };
      }
      return null;
    }


    function hitConstraintOperand(pointer, type, operands, hits = {}) {
      const hitP = hits.hitP ?? hitPoint(pointer.x, pointer.y);
      const hitL = hits.hitL ?? hitLine(pointer.x, pointer.y);
      const hitC = hits.hitC ?? hitCircle(pointer.x, pointer.y);
      const hitA = hits.hitA ?? hitArc(pointer.x, pointer.y);
      const hitS = hits.hitS ?? hitSpline(pointer.x, pointer.y);
      const hitArcEnd = hits.hitArcEnd ?? hitArcEndpoint(pointer.x, pointer.y);
      if (type === "symmetry") {
        const subjectKind = operands[1]?.kind || null;
        if (operands.length === 0 && hitL) return makeConstraintOperand("line", { line: hitL });
        if (subjectKind === "point" && hitP) return makeConstraintOperand("point", { point: hitP });
        if (subjectKind === "line" && hitL) return makeConstraintOperand("line", { line: hitL });
        if (subjectKind === "primitive" && hitA) return makeConstraintOperand("primitive", { primitive: hitA });
        if (!subjectKind && hitP) return makeConstraintOperand("point", { point: hitP });
        if (!subjectKind && hitL) return makeConstraintOperand("line", { line: hitL });
        if (!subjectKind && hitA) return makeConstraintOperand("primitive", { primitive: hitA });
      }
      if (hitArcEnd && (type === "coincident" || type === "pointOnCircle" || type === "fixed" || type === "horizontal" || type === "vertical")) return makeConstraintOperand("arc-endpoint", { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint });
      if (hitP) return makeConstraintOperand("point", { point: hitP });
      if (hitL) return makeConstraintOperand("line", { line: hitL });
      if (hitC || hitA) {
        const primitive = hitC || hitA;
        return makeConstraintOperand("primitive", { primitive, hitPoint: circlePointAtPointer(pointer, primitive) });
      }
      if (hitS) {
        const closest = window.SplineGeometry.closestPoint(hitS.curve(), pointer, { samplesPerSpan: 28 });
        const parameter = closest?.t ?? 0;
        return makeConstraintOperand("spline", { spline: hitS, parameter, endpoint: parameter <= 0.5 ? "start" : "end" });
      }
      const blockOperand = hitDerivedProjectionOperand(pointer.x, pointer.y) || hitBlockProjectionOperand(pointer.x, pointer.y);
      if (blockOperand) return blockOperand;
      return operandFromReferenceTarget(hitReferenceTarget(pointer.x, pointer.y));
    }

    return Object.freeze({ hitConstraintOperand, hitDerivedProjectionOperand, hitBlockProjectionOperand, hitReferenceTarget });
  }
  window.OperandHitQuery = Object.freeze({ create });
})();
