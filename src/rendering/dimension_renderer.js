/* Draw prepared dimension layouts; constraint queries and placement remain outside the painter. */
(function () {
  "use strict";
  const { DEFAULT_DIMENSION_APPEARANCE } = window.Appearance;
  const { DIMENSION_EXPRESSION_MARK_WIDTH_FACTOR, DIMENSION_EXPRESSION_MARK_GAP_FACTOR } = window.DimensionMetrics;
  function create({ ctx, viewport, metrics, canvasThemeColor, onExpressionMark }) {
    const { dimensionStrokeWidth, dimensionMillimetersToWorld, dimensionTextDrawingMetrics, dimensionOpenArrowheadRenderPoints, dimensionArrowheadPointsFromResolved } = metrics;
    function drawLinear({ layout, renderPlan, arcExtension, appearance, label, preview = false, highlighted = false, editState = null, colorOverride = null, expressionMark = false }) {
      const { points, text, textAngle } = layout;

      ctx.save();
      const color = canvasThemeColor(preview || highlighted ? "#2563eb" : colorOverride || appearance.color);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = dimensionStrokeWidth(appearance, highlighted) / viewport.scale;
      ctx.setLineDash(preview ? [5 / viewport.scale, 4 / viewport.scale] : []);
      ctx.beginPath();
      ctx.moveTo(renderPlan.lineStart.x, renderPlan.lineStart.y);
      ctx.lineTo(renderPlan.lineEnd.x, renderPlan.lineEnd.y);
      ctx.stroke();

      if (arcExtension) {
        ctx.beginPath();
        ctx.arc(
          arcExtension.center.x,
          arcExtension.center.y,
          arcExtension.radius,
          arcExtension.startAngle,
          arcExtension.endAngle,
          arcExtension.counterclockwise,
        );
        ctx.stroke();
      }

      for (const p of points) {
        if (p.showExtension === false) continue;
        ctx.beginPath();
        ctx.moveTo(p.extensionStart.x, p.extensionStart.y);
        ctx.lineTo(p.extensionEnd.x, p.extensionEnd.y);
        ctx.stroke();
      }

      for (const shaft of renderPlan.shafts) {
        ctx.beginPath();
        ctx.moveTo(shaft.start.x, shaft.start.y);
        ctx.lineTo(shaft.end.x, shaft.end.y);
        ctx.stroke();
      }

      ctx.setLineDash([]);
      if (renderPlan.firstTerminator) {
        drawDimensionTerminator(renderPlan.firstTerminator.point, renderPlan.firstTerminator.direction, appearance);
      }
      drawDimensionTerminator(renderPlan.secondTerminator.point, renderPlan.secondTerminator.direction, appearance);

      drawDimensionLabel(label, text, textAngle, editState, appearance, expressionMark);
      ctx.restore();
    }

    function drawAngle({ layout, extensions, outside, arcExtension, appearance, label, preview = false, highlighted = false, editState = null, colorOverride = null, expressionMark = false }) {
      const { vertex, radius, start, end, signed, text, textAngle } = layout;
      ctx.save();
      const color = canvasThemeColor(preview || highlighted ? "#2563eb" : colorOverride || appearance.color);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = dimensionStrokeWidth(appearance, highlighted) / viewport.scale;
      ctx.setLineDash(preview ? [5 / viewport.scale, 4 / viewport.scale] : []);
      const p1 = { x: vertex.x + Math.cos(start) * radius, y: vertex.y + Math.sin(start) * radius };
      const p2 = { x: vertex.x + Math.cos(end) * radius, y: vertex.y + Math.sin(end) * radius };
      const [firstExtension, secondExtension] = extensions;
      ctx.beginPath();
      ctx.moveTo(firstExtension.start.x, firstExtension.start.y);
      ctx.lineTo(firstExtension.end.x, firstExtension.end.y);
      ctx.moveTo(secondExtension.start.x, secondExtension.start.y);
      ctx.lineTo(secondExtension.end.x, secondExtension.end.y);
      ctx.stroke();
      const sweepDirection = signed < 0 ? -1 : 1;
      ctx.beginPath();
      ctx.arc(vertex.x, vertex.y, radius, start - sweepDirection * arcExtension, end + sweepDirection * arcExtension, signed < 0);
      ctx.stroke();
      ctx.setLineDash([]);
      const firstDirection = { x: Math.cos(start + (signed < 0 ? -Math.PI / 2 : Math.PI / 2)), y: Math.sin(start + (signed < 0 ? -Math.PI / 2 : Math.PI / 2)) };
      const secondDirection = { x: Math.cos(end + (signed < 0 ? Math.PI / 2 : -Math.PI / 2)), y: Math.sin(end + (signed < 0 ? Math.PI / 2 : -Math.PI / 2)) };
      drawDimensionTerminator(p1, outside ? { x: -firstDirection.x, y: -firstDirection.y } : firstDirection, appearance);
      drawDimensionTerminator(p2, outside ? { x: -secondDirection.x, y: -secondDirection.y } : secondDirection, appearance);
      drawDimensionLabel(label, text, textAngle, editState, appearance, expressionMark);
      ctx.restore();
    }

    function drawDimensionExpressionMark(centerX, baselineY, height) {
      const width = height * DIMENSION_EXPRESSION_MARK_WIDTH_FACTOR;
      const centerY = baselineY - height * 0.48;
      const points = [
        { x: centerX + width * 0.08, y: centerY - height * 0.43 },
        { x: centerX - width * 0.38, y: centerY + height * 0.03 },
        { x: centerX - width * 0.03, y: centerY + height * 0.03 },
        { x: centerX - width * 0.25, y: centerY + height * 0.43 },
        { x: centerX + width * 0.4, y: centerY - height * 0.1 },
        { x: centerX + width * 0.07, y: centerY - height * 0.1 },
      ];

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      onExpressionMark?.({ pointCount: points.length, filled: true });
    }

    function drawDimensionLabel(label, text, angle = 0, editState = null, appearance = DEFAULT_DIMENSION_APPEARANCE, expressionMark = false) {
      if (editState?.hidden) return;
      if (editState) {
        drawDimensionEditLabel(label, text, angle, editState, appearance);
      } else {
        const metrics = dimensionTextDrawingMetrics(appearance);
        ctx.save();
        ctx.translate(text.x, text.y);
        ctx.rotate(angle);
        ctx.font = `${metrics.height}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        if (expressionMark) {
          const textWidth = ctx.measureText(label).width;
          const markWidth = metrics.height * DIMENSION_EXPRESSION_MARK_WIDTH_FACTOR;
          const markGap = metrics.height * DIMENSION_EXPRESSION_MARK_GAP_FACTOR;
          ctx.fillText(label, (markWidth + markGap) / 2, -metrics.gap);
          drawDimensionExpressionMark(-(textWidth + markGap) / 2, -metrics.gap, metrics.height);
        } else {
          ctx.fillText(label, 0, -metrics.gap);
        }
        ctx.restore();
      }
    }

    function drawDimensionEditLabel(label, text, angle, state, appearance = DEFAULT_DIMENSION_APPEARANCE) {
      const metrics = dimensionTextDrawingMetrics(appearance);
      const fontSize = metrics.height;
      const padX = 6 / viewport.scale;
      const padY = 4 / viewport.scale;
      const height = fontSize + 10 / viewport.scale;
      ctx.save();
      ctx.translate(text.x, text.y);
      ctx.rotate(angle);
      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const width = Math.max(44 / viewport.scale, ctx.measureText(label).width + padX * 2);
      const x = -width / 2;
      const y = -height - metrics.gap;
      const border = state.invalid ? "#dc2626" : "#2563eb";

      ctx.fillStyle = "#fff";
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.5 / viewport.scale;
      ctx.beginPath();
      ctx.rect(x, y, width, height);
      ctx.fill();
      ctx.stroke();

      if (state.selecting && !state.invalid) {
        ctx.fillStyle = "#dbeafe";
        ctx.fillRect(x + padX / 2, y + padY / 2, width - padX, height - padY);
      }

      ctx.fillStyle = border;
      ctx.fillText(label, 0, y + height / 2);
      ctx.restore();
    }

    function drawDimensionTerminator(point, direction, appearance = DEFAULT_DIMENSION_APPEARANCE) {
      // Drawing callers already pass an effective, fully resolved appearance.
      // Avoid re-normalizing twice per terminator during viewport interaction.
      const resolved = appearance || DEFAULT_DIMENSION_APPEARANCE;
      if (resolved.terminatorType === "dot") {
        ctx.beginPath();
        ctx.arc(point.x, point.y, dimensionMillimetersToWorld(resolved.terminatorSize) / 2, 0, Math.PI * 2);
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

    return Object.freeze({ drawLinear, drawAngle });
  }
  window.DimensionRenderer = Object.freeze({ create });
})();
