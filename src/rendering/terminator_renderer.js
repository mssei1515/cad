/* Shared dimension/leader terminal painter. Sizes and arrow tip compensation use the same metrics. */
(() => {
  "use strict";
  const { DEFAULT_DIMENSION_APPEARANCE } = window.Appearance;
  function create({ ctx, viewport, metrics = window.DimensionMetrics.create({ ctx, viewport }) }) {
    const { dimensionMillimetersToWorld, dimensionOpenArrowheadRenderPoints, dimensionArrowheadPointsFromResolved } = metrics;
    function draw(point, direction, appearance = DEFAULT_DIMENSION_APPEARANCE) {
      // Drawing callers already pass an effective, fully resolved appearance.
      // Avoid re-normalizing twice per terminator during viewport interaction.
      const resolved = appearance || DEFAULT_DIMENSION_APPEARANCE;
      if (resolved.terminatorType === "none") return;
      if (resolved.terminatorType === "dot") {
        ctx.beginPath();
        ctx.arc(point.x, point.y, dimensionMillimetersToWorld(resolved.terminatorSize, resolved) / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      const arrowPoints = resolved.terminatorType === "arrow"
        ? dimensionOpenArrowheadRenderPoints(point, direction, resolved, ctx.lineWidth)
        : dimensionArrowheadPointsFromResolved(point, direction, resolved);
      const [tip, firstWing, secondWing] = arrowPoints;
      ctx.beginPath();
      if (resolved.terminatorType === "filledArrow") {
        ctx.moveTo(tip.x, tip.y);
        ctx.lineTo(firstWing.x, firstWing.y);
        ctx.lineTo(secondWing.x, secondWing.y);
        ctx.closePath();
        ctx.fill();
        return;
      }
      ctx.moveTo(firstWing.x, firstWing.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.lineTo(secondWing.x, secondWing.y);
      ctx.stroke();
    }

    return Object.freeze({ draw });
  }
  window.TerminatorRenderer = Object.freeze({ create });
})();
