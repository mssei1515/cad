/* Dimension display traversal and selection bounds; editing remains with commands. */
(() => {
  "use strict";
  function createSelectionBounds({ isActiveSketchConstraint, isVisibleSketchId, constraintSketchId,
    targetFromConstraint, defaultDimensionForTarget, effectiveDimensionAppearance, isVisibleValue, dimensionLayout,
    dimensionTextDrawingMetrics, dimensionLabelForConstraint, dimensionTextWidth, dimensionUsesExpression }) {
    function read(constraint) {
      if (!isActiveSketchConstraint(constraint) || !isVisibleSketchId(constraintSketchId(constraint))) return null;
      const target = targetFromConstraint(constraint);
      if (!target) return null;
      const dimension = constraint.dimension || defaultDimensionForTarget(target);
      const appearance = effectiveDimensionAppearance(dimension, constraintSketchId(constraint));
      if (!isVisibleValue(appearance.visible)) return null;
      const layout = dimensionLayout(target, dimension, appearance);
      if (!layout) return null;
      const metrics = dimensionTextDrawingMetrics(appearance);
      const label = dimensionLabelForConstraint(constraint, target, dimension);
      const width = dimensionTextWidth(label, appearance, dimensionUsesExpression(constraint));
      const top = -metrics.gap - metrics.height * (1 + (String(label).split(/\r\n|\r|\n/).length - 1) * 1.2);
      const angle = Number(layout.textAngle) || 0;
      const points = [layout.hitA, layout.hitB, ...[-width / 2, width / 2].flatMap(x => [top, -metrics.gap].map(y => ({ x: layout.text.x + x * Math.cos(angle) - y * Math.sin(angle), y: layout.text.y + x * Math.sin(angle) + y * Math.cos(angle) })))].filter(Boolean);
      return { x1: Math.min(...points.map(p => p.x)), y1: Math.min(...points.map(p => p.y)), x2: Math.max(...points.map(p => p.x)), y2: Math.max(...points.map(p => p.y)) };
    }
    return Object.freeze({ read });
  }
  function createLayer({ ctx, currentScope, isActiveSketchConstraint, isVisibleSketchId, constraintSketchId,
    targetFromConstraint, defaultDimensionForTarget, effectiveDimensionAppearance, isVisibleValue, canvasSelection,
    readHoverDimension, readDraggedDimension, readPending, readExportFrame, readConstraintStatus, inactiveColor,
    dimensionLabelForConstraint, drawDimension, dimensionUsesExpression }) {
    function draw() {
      for (const c of currentScope().constraints.sort((a, b) => Number(isActiveSketchConstraint(a)) - Number(isActiveSketchConstraint(b)))) {
        if (!isVisibleSketchId(constraintSketchId(c))) continue;
        const target = targetFromConstraint(c);
        if (!target) continue;
        const dimension = c.dimension || defaultDimensionForTarget(target);
        const sketchId = constraintSketchId(c);
        if (!isVisibleValue(effectiveDimensionAppearance(dimension, sketchId).visible)) continue;
        const highlighted = canvasSelection.inspectionContains(c) || c === readHoverDimension() || canvasSelection.constraintSelectedInCanvas(c) || c === readDraggedDimension();
        const label = dimensionLabelForConstraint(c, target, dimension);
        const editing = readPending()?.type === "distance-value" && readPending().constraint === c;
        const colorOverride = !readExportFrame() && readConstraintStatus() && !isActiveSketchConstraint(c) ? inactiveColor : null;
        ctx.save();
        drawDimension(target, dimension, label, false, !readExportFrame() && (highlighted || editing), !readExportFrame() && editing ? { hidden: true } : null, colorOverride, sketchId, !readExportFrame() && dimensionUsesExpression(c));
        ctx.restore();
      }
    }
    return Object.freeze({ draw });
  }
  function createPainter({ renderer, layouts, metrics, dimensionLayout, effectiveDimensionAppearance, activeSketchId, outsideShaftLengthFactor }) {
    const { linearDimensionRenderPlan, arcRadiusDimensionExtensionSegment, angleDimensionLayout, angleDimensionExtensionSegments } = layouts;
    const { shouldPlaceDimensionTerminatorsOutside, dimensionMillimetersToWorld } = metrics;
    function drawDimension(target, dimension, label, preview = false, highlighted = false, editState = null, colorOverride = null, sketchId = activeSketchId(), expressionMark = false) {
      if (!target || !dimension) return;
      if (target.kind === "angle") return drawAngleDimension(target, dimension, label, preview, highlighted, editState, colorOverride, sketchId, expressionMark);
      const appearance = effectiveDimensionAppearance(dimension, sketchId);
      const layout = dimensionLayout(target, dimension, appearance);
      if (!layout) return;
      const renderPlan = linearDimensionRenderPlan(target, layout, label, appearance, dimension, expressionMark);
      const arcExtension = arcRadiusDimensionExtensionSegment(target, layout, appearance);
      renderer.drawLinear({ layout, renderPlan, arcExtension, appearance, label, preview, highlighted, editState, colorOverride, expressionMark });
    }

    function drawAngleDimension(target, dimension, label, preview = false, highlighted = false, editState = null, colorOverride = null, sketchId = activeSketchId(), expressionMark = false) {
      const layout = angleDimensionLayout(target, dimension);
      if (!layout) return;
      const appearance = effectiveDimensionAppearance(dimension, sketchId);
      const extensions = angleDimensionExtensionSegments(layout, appearance);
      const outside = shouldPlaceDimensionTerminatorsOutside(Math.abs(layout.signed) * layout.radius, label, appearance, dimension, expressionMark);
      const arcExtension = outside ? dimensionMillimetersToWorld(appearance.terminatorSize * outsideShaftLengthFactor, appearance) / Math.max(layout.radius, 1e-12) : 0;
      renderer.drawAngle({ layout, extensions, outside, arcExtension, appearance, label, preview, highlighted, editState, colorOverride, expressionMark });
    }
    return Object.freeze({ drawDimension, drawAngleDimension });
  }
  function createLabel({ isReadOnlyDimension, measuredDimensionValue, angleDegrees, dimensionDisplayState, constraintSketchId,
    formatDimensionLabel, formatMeasuredDimensionLabel }) {
    function dimensionLabelForConstraint(constraint, target, dimension) {
      const readOnly = isReadOnlyDimension(constraint);
      const value = readOnly ? measuredDimensionValue(target, dimension) : target.interval ? constraint.target * 180 / Math.PI : target.kind === "angle" ? angleDegrees(constraint.target) : constraint.target;
      const formatLabel = readOnly ? formatMeasuredDimensionLabel : formatDimensionLabel;
      const display = dimensionDisplayState(dimension, constraintSketchId(constraint));
      const number = display.precision == null ? formatLabel(value) : Number(value).toFixed(display.precision);
      const unit = target.kind === "angle" ? "°" : "";
      const tolerance = display.toleranceUpper !== "" || display.toleranceLower !== ""
        ? ` +${display.toleranceUpper === "" ? "0" : display.toleranceUpper}/-${display.toleranceLower === "" ? "0" : Math.abs(Number(display.toleranceLower))}`
        : "";
      const label = `${display.prefix}${number}${unit}${display.suffix}${tolerance}`;
      return readOnly ? `(${label})` : label;
    }
    return Object.freeze({ label: dimensionLabelForConstraint });
  }
  window.DimensionPresentation = Object.freeze({ createSelectionBounds, createLayer, createPainter, createLabel });
})();
