/* Compose geometry paint policy, primitive drawing and scene-layer reads. */
(() => {
  "use strict";
  function create({ Point, ctx, viewport, surface, pointUsage, commandTargets, sketchStyle,
    canvasSelection, canvasHover, viewState, isExporting, effectiveAppearanceForElement, isEditableSketchElement,
    isSidebarHighlightedElement, isSidebarHoveredElement, isSelectedConstraintRelatedElement,
    canvasThemeColor, constructionAlpha, constructionExtensionScreenPx, fixedPointLabel,
    handleQueries, pointQueries, geometryReads, isVisibleSketchElement }) {
    const { allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines } = geometryReads;
    const presentation = window.GeometryPresentation.create({
      Point, pointUsage, commandTargets, sketchStyle, canvasSelection, canvasHover, viewState, isExporting,
      effectiveAppearanceForElement, isEditableSketchElement, isSidebarHighlightedElement, isSidebarHoveredElement,
      isSelectedConstraintRelatedElement, canvasThemeColor, constructionAlpha, handleQueries, pointQueries,
    });
    const lineDisplay = window.GeometryPresentation.createLineDisplay({ viewport, effectiveAppearanceForElement, constructionExtensionScreenPx });
    const renderer = window.GeometryRenderer.create({
      ctx, viewport, readPixelRatio: () => surface.dpr, paintState: presentation.geometryPaintState,
      pointPaintState: presentation.pointPaintState, arcEndpointPaintState: presentation.arcEndpointPaintState,
      withCanvasState: surface.withCanvasState, fixedPointLabel, appearanceLineDash: surface.appearanceLineDash,
      lineDisplaySegment: lineDisplay.lineDisplaySegment, canvasThemeColor,
    });
    const layer = window.GeometryRenderer.createLayer({ renderer, isVisibleSketchElement, drawOrderBySketch: sketchStyle.drawOrderBySketch,
      allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines });
    function drawPoints() { renderer.drawPoints(sketchStyle.drawOrderBySketch(allGeometryPoints())); }
    function drawArcEndpointHandles() { renderer.drawArcEndpointHandles(allGeometryArcs().filter(isVisibleSketchElement)); }
    function drawSplineEditHandles() { renderer.drawSplineEditHandles(presentation.splineHandleState()); }
    return Object.freeze({
      geometryDisplayColor: presentation.geometryDisplayColor, geometryStrokeWidth: presentation.geometryStrokeWidth,
      traceSplinePath: renderer.traceSplinePath, drawLines: layer.drawLines, drawCircles: layer.drawCircles,
      drawArcs: layer.drawArcs, drawSplines: layer.drawSplines, drawPoints, drawArcEndpointHandles, drawSplineEditHandles,
    });
  }
  window.GeometryDisplay = Object.freeze({ create });
})();
