/* Collect and rank selectable canvas context targets without changing selection. */
(() => {
  "use strict";
  const { hypot2 } = window.GeometrySolver;
  const { distancePointToSegment, distancePointToSegmentPoints, arcEndpointPoint, angleOnSignedSweep } = window.GeometryKernel;
  const { normalizedDrawingOrder } = window.DrawingOrder;
  const CANVAS_CONTEXT_KIND_PRIORITY = Object.freeze({
    point: 0,
    "arc-endpoint": 1,
    line: 2,
    circle: 3,
    arc: 4,
    spline: 5,
    dimension: 6,
    annotation: 7,
    block: 8,
    "geometry-instance": 9,
    hatch: 10,
    image: 11,
  });
  function create({ currentScope, viewportScale, canvasContextPointIsSelectable, editedFitPoints, sketches, projections, dimensions, annotations, hatches, selectionScope = null, hitReferenceImageAt = () => null, isVisibleValue = visible => visible !== false }) {
    const { isEditableSketchId, isVisibleSketchId, isEditableSketchElement, isVisibleSketchElement, activeSketchId, isActiveSketchConstraint, constraintSketchId } = sketches;
    // These predicates only collect inspectable candidates; action execution checks editing separately.
    const acceptsSketch = selectionScope?.sketch || isEditableSketchId;
    const acceptsElement = selectionScope?.element || isEditableSketchElement;
    const { blockProjectionBundle, geometryInstanceBundle } = projections;
    const { targetFromConstraint, defaultDimensionForTarget, effectiveDimensionAppearance, dimensionLayout } = dimensions;
    const { canvasContextAnnotationHit } = annotations;
    const { resolvedHatchBoundary, hatchAppearanceForDisplay, hatchContainsSelectablePoint } = hatches;
    function canvasContextBlockHitDistance(instance, pointer) {
      if (!instance || !acceptsSketch(instance.sketchId) || !isVisibleSketchId(instance.sketchId)) return null;
      const threshold = 8 / viewportScale();
      let distance = Infinity;
      const bundle = blockProjectionBundle(instance);
      for (const point of bundle.points) {
        if (!isVisibleSketchElement(point)) continue;
        const next = hypot2(point.x - pointer.x, point.y - pointer.y);
        if (next <= threshold) distance = Math.min(distance, next);
      }
      for (const line of bundle.lines) {
        if (!isVisibleSketchElement(line)) continue;
        const next = distancePointToSegment(pointer.x, pointer.y, line);
        if (next <= threshold) distance = Math.min(distance, next);
      }
      for (const circle of bundle.circles) {
        if (!isVisibleSketchElement(circle)) continue;
        const next = Math.abs(hypot2(pointer.x - circle.center.x, pointer.y - circle.center.y) - circle.radius());
        if (next <= threshold) distance = Math.min(distance, next);
      }
      for (const arc of bundle.arcs) {
        if (!isVisibleSketchElement(arc)) continue;
        const next = Math.abs(hypot2(pointer.x - arc.center.x, pointer.y - arc.center.y) - arc.radius());
        const angle = Math.atan2(pointer.y - arc.center.y, pointer.x - arc.center.x);
        if (next <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) distance = Math.min(distance, next);
      }
      for (const spline of bundle.splines || []) {
        if (!isVisibleSketchElement(spline)) continue;
        const closest = window.SplineGeometry.closestPoint(spline.curve(), pointer, { samplesPerSpan: 28 });
        if (closest?.distance <= threshold) distance = Math.min(distance, closest.distance);
      }
      for (const annotation of bundle.annotations || []) {
        const hit = canvasContextAnnotationHit(annotation, pointer);
        if (hit) distance = Math.min(distance, hit.distance);
      }
      for (const hatch of bundle.hatches || []) {
        const resolved = resolvedHatchBoundary(hatch);
        if (resolved.ok && isVisibleValue(hatchAppearanceForDisplay(hatch).visible) && hatchContainsSelectablePoint(hatch, resolved, pointer)) distance = 0;
      }
      return Number.isFinite(distance) ? distance : null;
    }

    function canvasContextGeometryInstanceHitDistance(instance, pointer) {
      if (!instance || !acceptsSketch(instance.sketchId) || !isVisibleSketchId(instance.sketchId)) return null;
      const threshold = 8 / viewportScale();
      let distance = Infinity;
      const bundle = geometryInstanceBundle(instance);
      for (const point of bundle.points) {
        const next = hypot2(point.x - pointer.x, point.y - pointer.y);
        if (next <= threshold) distance = Math.min(distance, next);
      }
      for (const line of bundle.lines) {
        const next = distancePointToSegment(pointer.x, pointer.y, line);
        if (next <= threshold) distance = Math.min(distance, next);
      }
      for (const circle of bundle.circles) {
        const next = Math.abs(hypot2(pointer.x - circle.center.x, pointer.y - circle.center.y) - circle.radius());
        if (next <= threshold) distance = Math.min(distance, next);
      }
      for (const arc of bundle.arcs) {
        const next = Math.abs(hypot2(pointer.x - arc.center.x, pointer.y - arc.center.y) - arc.radius());
        const angle = Math.atan2(pointer.y - arc.center.y, pointer.x - arc.center.x);
        if (next <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) distance = Math.min(distance, next);
      }
      for (const spline of bundle.splines || []) {
        const closest = window.SplineGeometry.closestPoint(spline.curve(), pointer, { samplesPerSpan: 28 });
        if (closest?.distance <= threshold) distance = Math.min(distance, closest.distance);
      }
      for (const hatch of bundle.hatches || []) {
        const resolved = resolvedHatchBoundary(hatch);
        if (resolved.ok && isVisibleValue(hatchAppearanceForDisplay(hatch).visible) && hatchContainsSelectablePoint(hatch, resolved, pointer)) distance = 0;
      }
      return Number.isFinite(distance) ? distance : null;
    }

    function canvasContextCandidatesAt(pointer) {
      const model = currentScope();
      const candidates = [];
      const push = (target, distance, drawOrder) => {
        candidates.push({
          ...target,
          contextDistance: Number(distance) || 0,
          contextPriority: CANVAS_CONTEXT_KIND_PRIORITY[target.kind] ?? 99,
          contextDrawOrder: Number(drawOrder) || 0,
        });
      };

      const pointThreshold = 10 / viewportScale();
      model.points.forEach((point, index) => {
        if (!acceptsElement(point) || !isVisibleSketchElement(point) || !canvasContextPointIsSelectable(point)) return;
        const distance = hypot2(point.x - pointer.x, point.y - pointer.y);
        if (distance <= pointThreshold) push({ kind: "point", item: point }, distance, index);
      });

      model.arcs.forEach((arc, index) => {
        if (!acceptsElement(arc) || !isVisibleSketchElement(arc)) return;
        for (const endpoint of ["start", "end"]) {
          const point = arcEndpointPoint(arc, endpoint);
          const distance = hypot2(point.x - pointer.x, point.y - pointer.y);
          if (distance <= pointThreshold) push({ kind: "arc-endpoint", item: arc, endpoint, hit: { arc, endpoint, point } }, distance, index * 2 + (endpoint === "end" ? 1 : 0));
        }
      });

      const geometryThreshold = 7 / viewportScale();
      model.lines.forEach((line, index) => {
        if (!acceptsElement(line) || !isVisibleSketchElement(line)) return;
        const distance = distancePointToSegment(pointer.x, pointer.y, line);
        if (distance <= geometryThreshold) push({ kind: "line", item: line }, distance, normalizedDrawingOrder(line.drawingOrder) ?? index);
      });
      model.circles.forEach((circle, index) => {
        if (!acceptsElement(circle) || !isVisibleSketchElement(circle)) return;
        const distance = Math.abs(hypot2(pointer.x - circle.center.x, pointer.y - circle.center.y) - circle.radius());
        if (distance <= geometryThreshold) push({ kind: "circle", item: circle }, distance, normalizedDrawingOrder(circle.drawingOrder) ?? index);
      });
      model.arcs.forEach((arc, index) => {
        if (!acceptsElement(arc) || !isVisibleSketchElement(arc)) return;
        const distance = Math.abs(hypot2(pointer.x - arc.center.x, pointer.y - arc.center.y) - arc.radius());
        const angle = Math.atan2(pointer.y - arc.center.y, pointer.x - arc.center.x);
        if (distance <= geometryThreshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) push({ kind: "arc", item: arc }, distance, normalizedDrawingOrder(arc.drawingOrder) ?? index);
      });
      model.splines.forEach((spline, index) => {
        if (!acceptsElement(spline) || !isVisibleSketchElement(spline)) return;
        const closest = window.SplineGeometry.closestPoint(spline.curve(), pointer, { samplesPerSpan: 28 });
        if (closest?.distance <= geometryThreshold) push({ kind: "spline", item: spline }, closest.distance, normalizedDrawingOrder(spline.drawingOrder) ?? index);
      });

      const dimensionThreshold = 12 / viewportScale();
      model.constraints.forEach((constraint, index) => {
        if (!isVisibleSketchId(constraintSketchId(constraint))) return;
        const target = targetFromConstraint(constraint);
        if (!target) return;
        const dimension = constraint.dimension || defaultDimensionForTarget(target);
        if (!isVisibleValue(effectiveDimensionAppearance(dimension, constraintSketchId(constraint)).visible)) return;
        const layout = dimensionLayout(target, dimension);
        if (!layout) return;
        const labelDistance = hypot2(pointer.x - layout.text.x, pointer.y - layout.text.y);
        const lineDistance = distancePointToSegmentPoints(pointer.x, pointer.y, layout.hitA, layout.hitB);
        const labelHit = labelDistance <= dimensionThreshold * 2.2;
        const lineHit = lineDistance <= dimensionThreshold * 1.4;
        if (!labelHit && !lineHit) return;
        const part = labelHit ? "label" : "line";
        push({ kind: "dimension", item: constraint, hit: { constraint, target, dimension, part } }, Math.min(labelHit ? labelDistance : Infinity, lineHit ? lineDistance : Infinity), index);
      });

      model.annotations.forEach((annotation, index) => {
        if (!isVisibleSketchId(annotation.sketchId)) return;
        const hit = canvasContextAnnotationHit(annotation, pointer);
        if (hit) push({ kind: "annotation", item: annotation, hit }, hit.distance, index);
      });

      model.blockInstances.forEach((block, index) => {
        const distance = canvasContextBlockHitDistance(block, pointer);
        if (distance != null) push({ kind: "block", item: block }, distance, normalizedDrawingOrder(block.drawingOrder) ?? index);
      });

      model.geometryInstances.forEach((instance, index) => {
        const distance = canvasContextGeometryInstanceHitDistance(instance, pointer);
        if (distance != null) push({ kind: "geometry-instance", item: instance }, distance, normalizedDrawingOrder(instance.drawingOrder) ?? index);
      });

      model.hatches.forEach((hatch, index) => {
        if (!isVisibleSketchId(hatch.sketchId) || !isVisibleValue(hatchAppearanceForDisplay(hatch).visible)) return;
        const resolved = resolvedHatchBoundary(hatch);
        if (hatchContainsSelectablePoint(hatch, resolved, pointer)) push({ kind: "hatch", item: hatch }, 0, normalizedDrawingOrder(hatch.drawingOrder) ?? index);
      });

      const image = hitReferenceImageAt(pointer.x, pointer.y);
      if (image) push({ kind: "image", item: image }, 0, (model.referenceImages || []).indexOf(image));
      const sorted = candidates.sort((a, b) => {
        const distanceDifference = a.contextDistance - b.contextDistance;
        if (Math.abs(distanceDifference) > 1e-9) return distanceDifference;
        if (a.contextPriority !== b.contextPriority) return a.contextPriority - b.contextPriority;
        return b.contextDrawOrder - a.contextDrawOrder;
      });
      const editedFitPoint = sorted.find((target) => target.kind === "point" && editedFitPoints()?.includes(target.item));
      return editedFitPoint ? [editedFitPoint] : sorted;
    }

    return Object.freeze({ candidatesAt: canvasContextCandidatesAt });
  }
  window.CanvasContextQuery = Object.freeze({ create });
})();
