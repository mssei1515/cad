/* Compose shared dimension measurement, placement, layout and painting services. */
(() => {
  "use strict";
  function create({ ctx, viewport, currentLines, minLineLength, canvasThemeColor, onExpressionMark,
    effectiveDimensionAppearance, activeSketchId }) {
    const metrics = window.DimensionMetrics.create({ ctx, viewport });
    const placement = window.DimensionPlacement.create({ viewport });
    const layouts = window.DimensionLayout.create({ viewport, placement, metrics, currentLines, minLineLength });
    function layout(target, dimension, appearance = effectiveDimensionAppearance(dimension)) {
      return layouts.dimensionLayout(target, dimension, appearance);
    }
    const renderer = window.DimensionRenderer.create({ ctx, viewport, metrics, canvasThemeColor, onExpressionMark });
    const painter = window.DimensionPresentation.createPainter({ renderer, layouts, metrics, dimensionLayout: layout,
      effectiveDimensionAppearance, activeSketchId, outsideShaftLengthFactor: window.DimensionLayout.DIMENSION_OUTSIDE_SHAFT_LENGTH_FACTOR });
    return Object.freeze({ metrics, placement, layouts, painter, layout });
  }
  window.DimensionDisplay = Object.freeze({ create });
})();
