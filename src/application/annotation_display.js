/* Compose annotation rendering and interaction decorations without owning editing state. */
(() => {
  "use strict";
  function create({ ctx, viewport, surface, effectiveAnnotationStyle, canvasSelection, readHover, readExportFrame,
    canvasThemeColor, annotationLeaderAnchor, resolveGeometryRef, isEditableSketchElement, resizeEnabled, activeSketchId,
    allAnnotations, isVisibleValue, isVisibleSketchId, readPreview }) {
    const color = window.AnnotationRenderer.createColor({ effectiveAnnotationStyle, readExportFrame, canvasSelection,
      readHoveredAnnotation: () => readHover().annotation, canvasThemeColor });
    const renderer = window.AnnotationRenderer.create({ ctx, viewport, withCanvasState: surface.withCanvasState,
      annotationDisplayColor: color.annotationDisplayColor, annotationLeaderAnchor, appearanceLineDash: surface.appearanceLineDash,
      formatValue: window.NumberDisplay.formatDisplayNumber, effectiveAnnotationStyle,
      resolvePlacement: (element, base) => window.AnnotationAnchorConstraints.resolve(element, base, resolveGeometryRef),
      showFrame: element => !readExportFrame() && (canvasSelection.annotations.includes(element) || canvasSelection.inspectionContains(element)
        || readHover().annotation === element || canvasSelection.inspectionContains(element.blockInstance)),
      showResizeHandles: element => !readExportFrame() && !element.blockProjection && canvasSelection.annotations.includes(element)
        && isEditableSketchElement(element) && resizeEnabled(element),
      isResizeHandleHovered: (element, handle) => readHover().annotationHandle?.element === element
        && readHover().annotationHandle.resizeX === handle.resizeX && readHover().annotationHandle.resizeY === handle.resizeY,
      showLeaderEndHandle: element => !readExportFrame() && !element.blockProjection && !element.anchorConstraints?.length
        && element.sketchId === activeSketchId() && (canvasSelection.annotations.includes(element) || readHover().annotation === element) });
    const layer = window.AnnotationRenderer.createLayer({ allAnnotations, isVisibleValue, isVisibleSketchId,
      drawAnnotationLeader: renderer.drawAnnotationLeader, drawAnnotationText: renderer.drawAnnotationText, readPreview });
    function createSpatialQueries() {
      const { annotationTextWorldHeight, annotationTextLayout, annotationLeaderDisplayGeometry } = renderer;
      return window.AnnotationSpatialQuery.create({ viewportScale: () => viewport.scale,
        annotationTextWorldHeight, annotationTextLayout, annotationLeaderDisplayGeometry,
        formatDisplayNumber: window.NumberDisplay.formatDisplayNumber, effectiveAnnotationStyle,
        allAnnotations: () => allAnnotations(), isVisibleSketchId, activeSketchId, isVisibleValue,
        annotationLeaderAnchor: element => annotationLeaderAnchor(element),
        isFrameInteractive: element => canvasSelection.annotations.includes(element) && isEditableSketchElement(element),
        resizeHandlesEnabled: element => resizeEnabled(element) });
    }
    return Object.freeze({ color, renderer, layer, createSpatialQueries });
  }
  window.AnnotationDisplay = Object.freeze({ create });
})();
