/* Compose shared dimension measurement, placement, layout and painting services. */
(() => {
  "use strict";
  function createForScene({ ctx, viewport, currentLines, minLineLength, canvasThemeColor, onExpressionMark, appearance, sketches }) {
    const { isReadOnlyDimension, measuredDimensionValue, angleDegrees } = window.DimensionQueries;
    const { formatDimensionLabel, formatMeasuredDimensionLabel } = window.NumberDisplay;
    const labels = window.DimensionPresentation.createLabel({ isReadOnlyDimension, measuredDimensionValue, angleDegrees,
      dimensionDisplayState: appearance.dimensionDisplayState, constraintSketchId: sketches.constraintSketchId,
      formatDimensionLabel, formatMeasuredDimensionLabel });
    const display = create({ ctx, viewport, currentLines, minLineLength, canvasThemeColor, onExpressionMark,
      effectiveDimensionAppearance: appearance.effectiveDimensionAppearance, activeSketchId: sketches.activeSketchId });
    return Object.freeze({ display, labels });
  }
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
    function createTraversal({ currentScope, isActiveSketchConstraint, isVisibleSketchId, constraintSketchId, isVisibleValue,
      canvasSelection, readHoverDimension, readDraggedDimension, readPending, readExportFrame, readConstraintStatus, inactiveColor,
      dimensionLabelForConstraint, dimensionUsesExpression }) {
      const { targetFromConstraint } = window.DimensionQueries;
      const selectionBounds = window.DimensionPresentation.createSelectionBounds({ isActiveSketchConstraint, isVisibleSketchId,
        constraintSketchId, targetFromConstraint, defaultDimensionForTarget: placement.defaultDimensionForTarget,
        effectiveDimensionAppearance, isVisibleValue, dimensionLayout: layout,
        dimensionTextDrawingMetrics: metrics.dimensionTextDrawingMetrics, dimensionLabelForConstraint,
        dimensionTextWidth: metrics.dimensionTextWidth, dimensionUsesExpression });
      const layer = window.DimensionPresentation.createLayer({ ctx, currentScope, isActiveSketchConstraint, isVisibleSketchId,
        constraintSketchId, targetFromConstraint, defaultDimensionForTarget: placement.defaultDimensionForTarget,
        effectiveDimensionAppearance, isVisibleValue, canvasSelection, readHoverDimension, readDraggedDimension,
        readPending, readExportFrame, readConstraintStatus, inactiveColor,
        dimensionLabelForConstraint, drawDimension: painter.drawDimension, dimensionUsesExpression });
      return Object.freeze({ selectionBounds, layer });
    }
    function createPreview({ readPending, drawFilletPreviewArc, evaluateDimensionExpressionDraft }) {
      const { formatDisplayNumber, formatDimensionLabel } = window.NumberDisplay;
      const { angleDegrees, angleDimensionAngles } = window.DimensionQueries;
      return window.DimensionPreview.create({ readPending, drawDimension: (...args) => painter.drawDimension(...args),
        drawFilletPreviewArc, dimensionFromAnchor: placement.dimensionFromAnchor,
        applyDefaultCircleDimensionLabelOffset: placement.applyDefaultCircleDimensionLabelOffset,
        defaultDimensionForTarget: placement.defaultDimensionForTarget, evaluateDimensionExpressionDraft,
        formatDisplayNumber, angleDegrees, angleDimensionAngles, dimensionAnchor: placement.dimensionAnchor,
        formatDimensionLabel, dimensionWithLabelAt: placement.dimensionWithLabelAt });
    }
    return Object.freeze({ metrics, placement, layouts, painter, layout, createTraversal, createPreview });
  }
  window.DimensionDisplay = Object.freeze({ create, createForScene });
})();
