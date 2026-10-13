/* Canvas bitmap, stroke-state isolation and resize observation. */
(function () {
  "use strict";
  function create({ canvas, ctx, viewport, readPixelRatio, ResizeObserverClass, onResize }) {
    const metrics = { width: 0, height: 0, dpr: 1 };
    let observer = null;
    function syncCanvasBitmapSize(width = null, height = null) {
      if (!Number.isFinite(width) || !Number.isFinite(height)) {
        const rect = canvas.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
      }
      const dpr = readPixelRatio();
      const bitmapWidth = Math.max(1, Math.floor(width * dpr));
      const bitmapHeight = Math.max(1, Math.floor(height * dpr));
      const changed = canvas.width !== bitmapWidth || canvas.height !== bitmapHeight || metrics.dpr !== dpr;
      metrics.width = width;
      metrics.height = height;
      metrics.dpr = dpr;
      if (canvas.width !== bitmapWidth) canvas.width = bitmapWidth;
      if (canvas.height !== bitmapHeight) canvas.height = bitmapHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return changed;
    }

    function resetCanvasStrokeState(targetContext = ctx) {
      targetContext.setLineDash([]);
      targetContext.lineDashOffset = 0;
      targetContext.shadowBlur = 0;
      targetContext.shadowColor = "transparent";
      targetContext.globalAlpha = 1;
      targetContext.globalCompositeOperation = "source-over";
      targetContext.lineCap = "butt";
      targetContext.lineJoin = "miter";
      targetContext.lineWidth = 1;
    }

    function withCanvasState(drawFn) {
      ctx.save();
      try {
        resetCanvasStrokeState();
        drawFn();
      } finally {
        ctx.restore();
        resetCanvasStrokeState();
      }
    }

    function appearanceLineDash(lineType) {
      if (lineType === "dashed") return [10 / viewport.scale, 6 / viewport.scale];
      if (lineType === "dashdot") return [12 / viewport.scale, 4 / viewport.scale, 2 / viewport.scale, 4 / viewport.scale];
      if (lineType === "dashdotdot") return [12 / viewport.scale, 4 / viewport.scale, 2 / viewport.scale, 4 / viewport.scale, 2 / viewport.scale, 4 / viewport.scale];
      if (lineType === "dotted") return [2 / viewport.scale, 5 / viewport.scale];
      return [];
    }
    function start() {
      if (observer || typeof ResizeObserverClass !== "function") return;
      observer = new ResizeObserverClass(([entry]) => {
        if (!entry || !syncCanvasBitmapSize(entry.contentRect.width, entry.contentRect.height)) return;
        onResize();
      });
      observer.observe(canvas);
    }
    function dispose() { observer?.disconnect(); observer = null; }
    return Object.freeze({
      get width() { return metrics.width; }, get height() { return metrics.height; }, get dpr() { return metrics.dpr; },
      start, dispose, syncCanvasBitmapSize, resetCanvasStrokeState, withCanvasState, appearanceLineDash
    });
  }
  function createFrameRenderer({ canvas, ctx, viewport, surface, syncZoom, readExportFrame, recordDraw, drawContent, drawExport, drawInteractive }) {
    function draw() {
      syncZoom();
      if (surface.width <= 0 || surface.height <= 0) surface.syncCanvasBitmapSize();
      const dpr = surface.dpr;
      if (!readExportFrame()) recordDraw();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      surface.resetCanvasStrokeState();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (readExportFrame()) ctx.setTransform(readExportFrame().ratio.x, 0, 0, readExportFrame().ratio.y, -readExportFrame().region.x * readExportFrame().ratio.x, -readExportFrame().region.y * readExportFrame().ratio.y);
      else ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      surface.resetCanvasStrokeState();
      ctx.save();
      ctx.translate(viewport.x, viewport.y);
      ctx.scale(viewport.scale, viewport.scale);
      surface.resetCanvasStrokeState();
      drawContent();
      if (readExportFrame()) {
        drawExport();
        ctx.restore();
        surface.resetCanvasStrokeState();
        return;
      }
      drawInteractive();
      surface.resetCanvasStrokeState();
      ctx.restore();
      surface.resetCanvasStrokeState();
    }
    return Object.freeze({ draw });
  }
  window.CanvasSurface = Object.freeze({ create, createFrameRenderer });
})();
