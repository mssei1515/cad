/* Canvas coordinates and viewport state, shared by rendering and input. */
(function () {
  "use strict";
  function create({ canvasRect, initialScale, minZoom, maxZoom, minLength }) {
    const state = { x: 0, y: 0, scale: initialScale };
    function snapshot() { return { ...state }; }
    function update(patch) {
      for (const key of ["x", "y", "scale"]) if (Object.prototype.hasOwnProperty.call(patch, key)) state[key] = patch[key];
    }
    function currentCanvasCenterWorld() {
      const rect = canvasRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      return screenToWorld({ x: rect.width / 2, y: rect.height / 2 });
    }

    function clampZoom(scale) {
      return Math.max(minZoom, Math.min(maxZoom, scale));
    }

    function formatZoom(scale) {
      const percent = scale / initialScale * 100;
      if (percent >= 1000000) return `${(percent / 1000000).toFixed(2)}M%`;
      if (percent >= 10000) return `${(percent / 1000).toFixed(1)}k%`;
      if (percent >= 1000) return `${percent.toFixed(0)}%`;
      if (percent >= 100) return `${percent.toFixed(0)}%`;
      if (percent >= 1) return `${percent.toFixed(1)}%`;
      return `${percent.toFixed(2)}%`;
    }

    function canvasScreenPoint(e) {
      const r = canvasRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function screenToWorld(p) {
      return {
        x: (p.x - state.x) / state.scale,
        y: (p.y - state.y) / state.scale,
      };
    }

    function worldToCanvasScreen(p) {
      return {
        x: p.x * state.scale + state.x,
        y: p.y * state.scale + state.y,
      };
    }

    function canvasPoint(e) {
      return screenToWorld(canvasScreenPoint(e));
    }

    function fitBoundsToViewport(bounds, paddingPx = 96) {
      if (!bounds) return false;
      const rect = canvasRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const width = Math.max(bounds.x2 - bounds.x1, minLength);
      const height = Math.max(bounds.y2 - bounds.y1, minLength);
      const availableWidth = Math.max(80, rect.width - paddingPx * 2);
      const availableHeight = Math.max(80, rect.height - paddingPx * 2);
      const nextScale = clampZoom(Math.min(availableWidth / width, availableHeight / height));
      const centerX = (bounds.x1 + bounds.x2) / 2;
      const centerY = (bounds.y1 + bounds.y2) / 2;
      state.scale = nextScale;
      state.x = rect.width / 2 - centerX * state.scale;
      state.y = rect.height / 2 - centerY * state.scale;
      return true;
    }

    function screenBoxForBounds(bounds) {
      if (!bounds) return null;
      const p1 = worldToCanvasScreen({ x: bounds.x1, y: bounds.y1 });
      const p2 = worldToCanvasScreen({ x: bounds.x2, y: bounds.y2 });
      return {
        left: Math.min(p1.x, p2.x),
        right: Math.max(p1.x, p2.x),
        top: Math.min(p1.y, p2.y),
        bottom: Math.max(p1.y, p2.y),
      };
    }

    function visibleWorldBounds() {
      const rect = canvasRect();
      return {
        x1: -state.x / state.scale,
        y1: -state.y / state.scale,
        x2: (rect.width - state.x) / state.scale,
        y2: (rect.height - state.y) / state.scale,
      };
    }
    return Object.freeze({
      get x() { return state.x; }, get y() { return state.y; }, get scale() { return state.scale; },
      snapshot, update, currentCanvasCenterWorld, clampZoom, formatZoom, canvasScreenPoint, screenToWorld, worldToCanvasScreen, canvasPoint, fitBoundsToViewport, screenBoxForBounds, visibleWorldBounds
    });
  }
  window.CanvasViewport = Object.freeze({ create });
})();
