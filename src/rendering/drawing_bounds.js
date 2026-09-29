/* Aggregate current drawing extents without changing the viewport or model. */
(() => {
  "use strict";
  const { mergeBounds, lineBBox, primitiveBBox, splineBBox } = window.GeometryBounds;
  const { referenceImageBounds } = window.ReferenceImageGeometry;
  function create({ currentScope, geometryReads, activeSketchId, elementSketchId, isVisibleSketchElement,
    isVisibleSketchId, annotationBounds, resolvedLoopBounds, resolvedHatchBoundary, hatchAppearanceForDisplay }) {
    const { allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines, allGeometryPoints, allAnnotations, allHatches } = geometryReads;
    function sketchGeometryBounds(sketchId = activeSketchId()) {
      let bounds = null;
      for (const line of allGeometryLines()) {
        if (elementSketchId(line) === sketchId) bounds = mergeBounds(bounds, lineBBox(line));
      }
      for (const circle of allGeometryCircles()) {
        if (elementSketchId(circle) === sketchId) bounds = mergeBounds(bounds, primitiveBBox(circle));
      }
      for (const arc of allGeometryArcs()) {
        if (elementSketchId(arc) === sketchId) bounds = mergeBounds(bounds, primitiveBBox(arc));
      }
      for (const spline of allGeometrySplines()) {
        if (elementSketchId(spline) === sketchId) bounds = mergeBounds(bounds, splineBBox(spline));
      }
      for (const point of allGeometryPoints()) {
        if (elementSketchId(point) === sketchId) bounds = mergeBounds(bounds, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
      }
      for (const annotation of allAnnotations()) if (annotation.sketchId === sketchId) bounds = mergeBounds(bounds, annotationBounds(annotation));
      for (const hatch of allHatches()) if (hatch.sketchId === sketchId) bounds = mergeBounds(bounds, resolvedLoopBounds(resolvedHatchBoundary(hatch)));
      for (const image of currentScope().referenceImages) if (image.sketchId === sketchId) bounds = mergeBounds(bounds, referenceImageBounds(image));
      return bounds;
    }

    function allGeometryBounds() {
      let bounds = null;
      for (const line of allGeometryLines()) bounds = mergeBounds(bounds, lineBBox(line));
      for (const circle of allGeometryCircles()) bounds = mergeBounds(bounds, primitiveBBox(circle));
      for (const arc of allGeometryArcs()) bounds = mergeBounds(bounds, primitiveBBox(arc));
      for (const spline of allGeometrySplines()) bounds = mergeBounds(bounds, splineBBox(spline));
      for (const point of allGeometryPoints()) bounds = mergeBounds(bounds, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
      for (const annotation of allAnnotations()) bounds = mergeBounds(bounds, annotationBounds(annotation));
      for (const hatch of allHatches()) bounds = mergeBounds(bounds, resolvedLoopBounds(resolvedHatchBoundary(hatch)));
      for (const image of currentScope().referenceImages) bounds = mergeBounds(bounds, referenceImageBounds(image));
      return bounds;
    }

    function visibleGeometryBounds() {
      let bounds = null;
      for (const line of allGeometryLines()) {
        if (isVisibleSketchElement(line)) bounds = mergeBounds(bounds, lineBBox(line));
      }
      for (const circle of allGeometryCircles()) {
        if (isVisibleSketchElement(circle)) bounds = mergeBounds(bounds, primitiveBBox(circle));
      }
      for (const arc of allGeometryArcs()) {
        if (isVisibleSketchElement(arc)) bounds = mergeBounds(bounds, primitiveBBox(arc));
      }
      for (const spline of allGeometrySplines()) {
        if (isVisibleSketchElement(spline)) bounds = mergeBounds(bounds, splineBBox(spline));
      }
      for (const point of allGeometryPoints()) {
        if (isVisibleSketchElement(point)) bounds = mergeBounds(bounds, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
      }
      for (const annotation of allAnnotations()) if (annotation.visible !== false && isVisibleSketchId(annotation.sketchId)) bounds = mergeBounds(bounds, annotationBounds(annotation));
      for (const hatch of allHatches()) if (hatchAppearanceForDisplay(hatch).visible !== false && isVisibleSketchId(hatch.sketchId)) bounds = mergeBounds(bounds, resolvedLoopBounds(resolvedHatchBoundary(hatch)));
      for (const image of currentScope().referenceImages) if (image.visible !== false && isVisibleSketchId(image.sketchId)) bounds = mergeBounds(bounds, referenceImageBounds(image));
      return bounds;
    }




    return Object.freeze({ sketchGeometryBounds, allGeometryBounds, visibleGeometryBounds });
  }
  window.DrawingBounds = Object.freeze({ create });
})();
