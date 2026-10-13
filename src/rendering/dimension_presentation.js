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
  window.DimensionPresentation = Object.freeze({ createSelectionBounds, createLayer });
})();
