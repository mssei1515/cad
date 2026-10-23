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
      function createWorkspaceRendering(options) {
        return createRendering({ ...options, canvas, ctx, viewport, surface, zoomControl,
          readExportFrame: () => exportRenderer.frame });
      }
      return Object.freeze({ surface, exportRenderer, layout, createRendering: createWorkspaceRendering });
    }
    return Object.freeze({ viewport, navigation, zoomControl, createWorkspace });
  }
  function createRendering({ canvas, ctx, viewport, surface, zoomControl, readExportFrame, recordDraw,
    geometry, dimensions, drawDimensionPreview, annotations, authoringPreview, placements, offsetPreview,
    drawBlockInstanceHandles, drawSnapMarker, drawReferenceImages, drawHatches, drawDrawingStack,
    drawReferenceImageOverlays, drawSketchIdentityLabel, drawSelectionRect, drawExportOverlay }) {
    const interactive = window.CanvasSurface.createInteractiveRenderer({
      drawBlockInstanceHandles, dimensions, drawDimensionPreview, annotations, authoringPreview, placements, offsetPreview,
      drawSnapMarker, drawArcEndpointHandles: () => geometry.drawArcEndpointHandles(),
      drawSplineEditHandles: () => geometry.drawSplineEditHandles(), drawPoints: () => geometry.drawPoints(),
      drawReferenceImageOverlays, drawSketchIdentityLabel, drawSelectionRect, drawExportOverlay,
    });
    return window.CanvasSurface.createFrameRenderer({
      canvas, ctx, viewport, surface, syncZoom: () => zoomControl.sync(), readExportFrame, recordDraw,
      drawContent: () => { drawReferenceImages(); drawHatches([], { includePreview: true }); drawDrawingStack(); },
      drawExport: () => { dimensions.draw(); annotations.draw(); geometry.drawPoints(); },
      drawInteractive: interactive.draw,
    });
  }
  window.CanvasDisplay = Object.freeze({ create, createRendering });
})();
