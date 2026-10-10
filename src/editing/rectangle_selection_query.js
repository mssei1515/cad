/* Read rectangle-selection candidates without modifying Selection or the model. */
(() => {
  "use strict";
  function create({ currentScope, selectableSketchElement, isExplicitPoint, isReferencePoint, pointInRect,
    lineIntersectsRect, bboxInRect, lineBBox, isVisibleSketchElement, primitiveBBox, bboxIntersectsRect,
    arcSamplePoints, viewScale, isEditableSketchId, isVisibleSketchId, blockProjectionBundle, mergeBounds,
    splineBBox, annotationBounds, resolvedLoopBounds, resolvedHatchBoundary, activeSketchId,
    hatchAppearanceForDisplay, referenceImageBounds, dimensionSelectionBounds = () => null, isVisibleValue = visible => visible !== false }) {
    function lineSelected(line, rect, crossing) { return crossing ? lineIntersectsRect(line, rect) : bboxInRect(lineBBox(line), rect); }
    function boxSelected(box, rect, crossing) { return crossing ? bboxIntersectsRect(box, rect) : bboxInRect(box, rect); }
    function samplesSelected(samples, rect, crossing) { return crossing ? samples.some(point => pointInRect(point, rect)) : samples.every(point => pointInRect(point, rect)); }
    function addUnique(target, item) { if (item && !target.includes(item)) target.push(item); }
    function read(rect, crossing) {
      const model = currentScope();
      const nextPoints = [];
      const nextLines = [];
      const nextCircles = [];
      const nextArcs = [];
      const nextSplines = [];
      const nextBlocks = [];
      const nextAnnotations = [];
      const nextHatches = [];
      const nextReferenceImages = [];
      for (const p of model.points) {
        if (!selectableSketchElement(p)) continue;
        if (!isExplicitPoint(p) && !isReferencePoint(p)) continue;
        if (pointInRect(p, rect)) addUnique(nextPoints, p);
      }
      for (const line of model.lines) {
        if (!selectableSketchElement(line)) continue;
        const selected = lineSelected(line, rect, crossing);
        if (selected) addUnique(nextLines, line);
      }
      for (const circle of model.circles) {
        if (!isVisibleSketchElement(circle)) continue;
        if (!selectableSketchElement(circle)) continue;
        const box = primitiveBBox(circle);
        const selected = boxSelected(box, rect, crossing);
        if (selected) addUnique(nextCircles, circle);
      }
      for (const arc of model.arcs) {
        if (!isVisibleSketchElement(arc)) continue;
        if (!selectableSketchElement(arc)) continue;
        const samples = arcSamplePoints(arc);
        const selected = samplesSelected(samples, rect, crossing);
        if (selected) addUnique(nextArcs, arc);
      }
      for (const spline of model.splines) {
        if (!isVisibleSketchElement(spline) || !selectableSketchElement(spline)) continue;
        const samples = window.SplineGeometry.flatten(spline.curve(), { tolerance: Math.max(0.1, 0.75 / viewScale()) }).map((entry) => entry.point);
        const selected = samplesSelected(samples, rect, crossing);
        if (selected) addUnique(nextSplines, spline);
      }
      for (const instance of model.blockInstances) {
        if (!isEditableSketchId(instance.sketchId) || !isVisibleSketchId(instance.sketchId)) continue;
        const bundle = blockProjectionBundle(instance);
        let box = null;
        for (const line of bundle.lines) box = mergeBounds(box, lineBBox(line));
        for (const circle of bundle.circles) box = mergeBounds(box, primitiveBBox(circle));
        for (const arc of bundle.arcs) box = mergeBounds(box, primitiveBBox(arc));
        for (const spline of bundle.splines || []) box = mergeBounds(box, splineBBox(spline));
        for (const point of bundle.points) box = mergeBounds(box, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
        for (const annotation of bundle.annotations || []) box = mergeBounds(box, annotationBounds(annotation));
        for (const hatch of bundle.hatches || []) box = mergeBounds(box, resolvedLoopBounds(resolvedHatchBoundary(hatch)));
        if (!box) continue;
        const selected = boxSelected(box, rect, crossing);
        if (selected) addUnique(nextBlocks, instance);
      }
      for (const annotation of model.annotations) {
        if (annotation.sketchId !== activeSketchId() || !isVisibleValue(annotation.visible) || !isVisibleSketchId(annotation.sketchId)) continue;
        const box = annotationBounds(annotation);
        if (!box) continue;
        const selected = boxSelected(box, rect, crossing);
        if (selected) addUnique(nextAnnotations, annotation);
      }
      for (const hatch of model.hatches) {
        if (hatch.sketchId !== activeSketchId() || !isVisibleValue(hatchAppearanceForDisplay(hatch).visible) || !isVisibleSketchId(hatch.sketchId)) continue;
        const box = resolvedLoopBounds(resolvedHatchBoundary(hatch));
        if (!box) continue;
        const selected = boxSelected(box, rect, crossing);
        if (selected) addUnique(nextHatches, hatch);
      }
      for (const image of model.referenceImages) {
        if (image.sketchId !== activeSketchId() || !isVisibleValue(image.visible) || !isVisibleSketchId(image.sketchId)) continue;
        const box = referenceImageBounds(image);
        const selected = boxSelected(box, rect, crossing);
        if (selected) addUnique(nextReferenceImages, image);
      }
  
      const dimensions = (model.constraints || []).filter(constraint => {
        const box = dimensionSelectionBounds(constraint);
        return box && (boxSelected(box, rect, crossing));
      });
      return { points: nextPoints, lines: nextLines, circles: nextCircles, arcs: nextArcs, splines: nextSplines, blockInstances: nextBlocks, annotations: nextAnnotations, hatches: nextHatches, referenceImages: nextReferenceImages, dimensionConstraints: dimensions };
    }
    function readProjection(rect, crossing, geometry, entryFromItem) {
      const entries = [];
      const append = (item) => {
        const entry = entryFromItem(item);
        if (entry) entries.push(entry);
      };
      for (const point of geometry.points()) {
        if (!isExplicitPoint(point) && !isReferencePoint(point)) continue;
        if (pointInRect(point, rect)) append(point);
      }
      for (const line of geometry.lines()) {
        const selected = lineSelected(line, rect, crossing);
        if (selected) append(line);
      }
      for (const circle of geometry.circles()) {
        const box = primitiveBBox(circle);
        const selected = boxSelected(box, rect, crossing);
        if (selected) append(circle);
      }
      for (const arc of geometry.arcs()) {
        const samples = arcSamplePoints(arc);
        const selected = samplesSelected(samples, rect, crossing);
        if (selected) append(arc);
      }
      for (const spline of geometry.splines()) {
        const samples = window.SplineGeometry.flatten(spline.curve(), { tolerance: Math.max(0.1, 0.75 / viewScale()) }).map((entry) => entry.point);
        const selected = samplesSelected(samples, rect, crossing);
        if (selected) append(spline);
      }
      for (const hatch of geometry.hatches?.() || []) {
        const box = resolvedLoopBounds(resolvedHatchBoundary(hatch));
        if (box && boxSelected(box, rect, crossing)) append(hatch);
      }
      return entries;
    }

    return Object.freeze({ read, readProjection });
  }
  window.RectangleSelectionQuery = Object.freeze({ create });
})();
