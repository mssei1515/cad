/* Render an offset preview plan without owning command or document state. */
(() => {
  "use strict";
  function create({ ctx, viewport, withCanvasState, Line, Circle, drawDimension, formatDimensionLabel }) {
    function draw(plan) {
      if (!plan) return;
      withCanvasState(() => {
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2 / viewport.scale;
        ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
        for (const offset of plan.geometries) {
          ctx.beginPath();
          if (offset instanceof Line) {
            ctx.moveTo(offset.p1.x, offset.p1.y);
            ctx.lineTo(offset.p2.x, offset.p2.y);
          } else if (offset instanceof Circle) {
            ctx.arc(offset.center.x, offset.center.y, offset.radius(), 0, Math.PI * 2);
          } else {
            ctx.arc(offset.center.x, offset.center.y, offset.radius(), offset.startAngle, offset.endAngle, offset.endAngle < offset.startAngle);
          }
          ctx.stroke();
        }
      });
      drawDimension(plan.target, plan.dimension, formatDimensionLabel(plan.distance), true);
    }
    return Object.freeze({ draw });
  }
  window.OffsetPreviewRenderer = Object.freeze({ create });
})();
