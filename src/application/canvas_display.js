/* Compose shared viewport services, then Canvas surfaces and workspace presentation. */
(() => {
  "use strict";
  function create({ canvas, document, initialScale, minZoom, maxZoom, minLength,
    draw, setHint, fitVisibleGeometry, flushPointerMoves, syncDimensionValueInput }) {
    const viewport = window.CanvasViewport.create({ canvasRect: () => canvas.getBoundingClientRect(), initialScale, minZoom, maxZoom, minLength });
    const navigation = window.CanvasNavigation.create({ canvas, viewport, draw, setHint, fitVisibleGeometry });
    const zoomControl = window.CanvasZoomControl.create({
      button: document.getElementById("statusZoom"), input: document.getElementById("statusZoomInput"),
      readPercent: () => viewport.scale / initialScale * 100,
      format: () => viewport.formatZoom(viewport.scale),
      applyPercent: percent => {
        flushPointerMoves();
        const applied = navigation.setScale(percent / 100 * initialScale);
        syncDimensionValueInput();
        return applied;
      },
    });
    function createWorkspace({ ctx, readPixelRatio, ResizeObserverClass, withGeometryReadCache, drawCanvas,
      isValueInputPending, window: browserWindow, updatePropertiesUI, closeContextMenu, applySketchTreeWidth, applicationText, readLanguage }) {
      const surface = window.CanvasSurface.create({ canvas, ctx, viewport, readPixelRatio, ResizeObserverClass,
        onResize: () => { draw(); if (isValueInputPending()) syncDimensionValueInput(); },
      });
      const exportRenderer = window.CanvasExport.createRenderer({ viewport, withGeometryReadCache, drawCanvas, syncCanvasBitmapSize: surface.syncCanvasBitmapSize, draw });
      const layout = window.CanvasWorkspaceLayout.create({
        window: browserWindow, updatePropertiesUI, setHint, closeContextMenu, canvas, document, viewport,
        syncCanvasBitmapSize: surface.syncCanvasBitmapSize, applySketchTreeWidth, draw,
        isValueInputPending, syncDimensionValueInput, currentCanvasCenterWorld: viewport.currentCanvasCenterWorld, applicationText, readLanguage,
      });
      return Object.freeze({ surface, exportRenderer, layout });
    }
    return Object.freeze({ viewport, navigation, zoomControl, createWorkspace });
  }
  window.CanvasDisplay = Object.freeze({ create });
})();
