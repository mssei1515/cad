/* Paint resolved Hatch loops; model resolution, selection and boundary overlays belong to callers. */
(function () {
  "use strict";
  const { CSS_PX_PER_MM: HATCH_SCREEN_PX_PER_MM, DEFAULT_HATCH_APPEARANCE } = window.Appearance;
  const { resolvedLoopBounds } = window.HatchRegionEngine;
  function intersectBounds(a, b) {
    if (!a || !b) return null;
    const result = { x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), x2: Math.min(a.x2, b.x2), y2: Math.min(a.y2, b.y2) };
    return result.x1 <= result.x2 && result.y1 <= result.y2 ? result : null;
  }

  function traceResolvedHatchPath(resolved, targetContext) {
    targetContext.beginPath();
    for (const loop of resolved?.loops || []) {
      if (!loop.points?.length) continue;
      targetContext.moveTo(loop.points[0].x, loop.points[0].y);
      for (let index = 1; index < loop.points.length; index++) targetContext.lineTo(loop.points[index].x, loop.points[index].y);
      targetContext.closePath();
    }
  }

  function create({ viewport, visibleWorldBounds, canvasThemeColor }) {
    function drawResolvedHatchContent(targetContext, resolved, appearance, origin, { selected = false, hovered = false, preview = false, alpha = 1 } = {}) {
      if (!resolved?.ok || !resolved.loops?.length || appearance.visible === false) return;
      const bounds = intersectBounds(resolvedLoopBounds(resolved), visibleWorldBounds());
      if (!bounds) return;
      targetContext.save();
      traceResolvedHatchPath(resolved, targetContext);
      targetContext.clip("evenodd");
      if (preview) {
        targetContext.fillStyle = "rgba(14, 165, 233, 0.10)";
        traceResolvedHatchPath(resolved, targetContext);
        targetContext.fill("evenodd");
      }
      targetContext.globalAlpha = alpha;
      const emphasisColor = canvasThemeColor(selected ? "#2563eb" : hovered || preview ? "#0ea5e9" : appearance.color);
      if (appearance.patternType === "solid") {
        targetContext.globalAlpha = alpha * Math.max(0, Math.min(1, Number(appearance.opacity)));
        targetContext.fillStyle = emphasisColor;
        traceResolvedHatchPath(resolved, targetContext);
        targetContext.fill("evenodd");
        targetContext.restore();
        return;
      }
      const spacing = Math.max(0.25, Number(appearance.spacing) || DEFAULT_HATCH_APPEARANCE.spacing) * HATCH_SCREEN_PX_PER_MM / viewport.scale;
      const corners = [
        { x: bounds.x1, y: bounds.y1 }, { x: bounds.x2, y: bounds.y1 },
        { x: bounds.x2, y: bounds.y2 }, { x: bounds.x1, y: bounds.y2 },
      ];
      const appendLineFamily = (angle) => {
        const direction = { x: Math.cos(angle), y: Math.sin(angle) };
        const normal = { x: -direction.y, y: direction.x };
        const normalProjection = corners.map((point) => (point.x - origin.x) * normal.x + (point.y - origin.y) * normal.y);
        const directionProjection = corners.map((point) => (point.x - origin.x) * direction.x + (point.y - origin.y) * direction.y);
        const first = Math.floor(Math.min(...normalProjection) / spacing) - 1;
        const last = Math.ceil(Math.max(...normalProjection) / spacing) + 1;
        const minAlong = Math.min(...directionProjection) - spacing * 2;
        const maxAlong = Math.max(...directionProjection) + spacing * 2;
        for (let index = first; index <= last; index++) {
          const offset = index * spacing;
          const base = { x: origin.x + normal.x * offset, y: origin.y + normal.y * offset };
          targetContext.moveTo(base.x + direction.x * minAlong, base.y + direction.y * minAlong);
          targetContext.lineTo(base.x + direction.x * maxAlong, base.y + direction.y * maxAlong);
        }
      };
      targetContext.strokeStyle = emphasisColor;
      targetContext.lineWidth = (selected || hovered ? Math.max(1.5, appearance.lineWidth) : appearance.lineWidth) / viewport.scale;
      targetContext.beginPath();
      const angle = Number(appearance.angle) * Math.PI / 180;
      appendLineFamily(angle);
      if (appearance.patternType === "cross") appendLineFamily(angle + Math.PI / 2);
      targetContext.stroke();
      targetContext.restore();
    }

    return Object.freeze({ drawResolvedHatchContent });
  }
  window.HatchRenderer = Object.freeze({ create });
})();
