/* Browser-test viewport focus and world-to-client positions through existing display owners. */
(() => {
  "use strict";
  function create({ viewport, clampZoom, resizeCanvas, draw, canvas, currentCanvasCenterWorld, worldToCanvasScreen }) {
    function focus(center, scale = 1) {
      viewport.update({ scale: clampZoom(Number(scale) || 1) });
      resizeCanvas({ centerWorld: { x: Number(center?.x) || 0, y: Number(center?.y) || 0 } });
      draw();
      const rect = canvas.getBoundingClientRect();
      return {
        scale: viewport.scale,
        center: currentCanvasCenterWorld(),
        canvas: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      };
    }

    function clientPosition(point) {
      const rect = canvas.getBoundingClientRect();
      const screen = worldToCanvasScreen({ x: Number(point?.x) || 0, y: Number(point?.y) || 0 });
      return { x: rect.left + screen.x, y: rect.top + screen.y };
    }
    return Object.freeze({ focus, clientPosition });
  }
  function createZoomObservation({ viewport, clampZoom, readUnits, formatZoom, cssPxPerMm }) {
    function state(zoomRatio = null) {
      if (zoomRatio != null) viewport.update({ scale: clampZoom(Number(zoomRatio) * cssPxPerMm) });
      return {
        units: { ...readUnits() },
        zoomRatio: viewport.scale / cssPxPerMm,
        formatted: formatZoom(viewport.scale),
        cssPixelsPerMillimeter: cssPxPerMm,
        viewportScale: viewport.scale,
      };
    }
    return Object.freeze({ state });
  }

  window.CanvasTestDriver = Object.freeze({ create, createZoomObservation });
})();
