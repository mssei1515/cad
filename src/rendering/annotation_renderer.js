/* Annotation text, leaders and terminators; interaction and anchor resolution are ports. */
(function () {
  "use strict";
  const { CSS_PX_PER_MM: ANNOTATION_SCREEN_PX_PER_MM, normalizeAnnotationStyle } = window.Appearance;
  const { hypot2 } = window.GeometrySolver;
  function create({ ctx, viewport, withCanvasState, annotationDisplayColor, annotationLeaderAnchor, appearanceLineDash }) {
    function annotationFontFamilyStack(fontFamily) {
      if (fontFamily === "serif") return 'Georgia, "Times New Roman", serif';
      if (fontFamily === "monospace") return 'ui-monospace, SFMono-Regular, Consolas, monospace';
      return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    }

    function annotationTextScreenHeight(style) {
      return normalizeAnnotationStyle(style).textHeight * ANNOTATION_SCREEN_PX_PER_MM;
    }

    function annotationTextWorldHeight(style) {
      return annotationTextScreenHeight(style) / viewport.scale;
    }

    function drawAnnotationText(element, colorOverride = null) {
      const style = normalizeAnnotationStyle(element.style);
      const fontSize = annotationTextWorldHeight(style);
      const fontPrefix = `${style.italic ? "italic " : ""}${style.bold ? "700 " : ""}`;
      ctx.save();
      ctx.font = `${fontPrefix}${fontSize}px ${annotationFontFamilyStack(style.fontFamily)}`;
      ctx.fillStyle = colorOverride || annotationDisplayColor(element, style);
      ctx.textAlign = style.textAlign;
      ctx.textBaseline = "middle";
      ctx.translate(element.x, element.y);
      ctx.rotate(Number(element.rotation) || 0);
      ctx.fillText(element.text || "", 0, 0);
      ctx.restore();
    }

    function drawAnnotationTerminator(point, direction, annotationStyle) {
      const style = normalizeAnnotationStyle(annotationStyle);
      if (style.terminatorType === "none") return;
      const size = style.terminatorSize * ANNOTATION_SCREEN_PX_PER_MM / viewport.scale;
      if (style.terminatorType === "dot") {
        ctx.beginPath();
        ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      const wing = size * Math.tan(27 * Math.PI / 360);
      const normal = { x: -direction.y, y: direction.x };
      const wing1 = { x: point.x + direction.x * size + normal.x * wing, y: point.y + direction.y * size + normal.y * wing };
      const wing2 = { x: point.x + direction.x * size - normal.x * wing, y: point.y + direction.y * size - normal.y * wing };
      ctx.beginPath();
      if (style.terminatorType === "arrow") {
        ctx.moveTo(wing1.x, wing1.y);
        ctx.lineTo(point.x, point.y);
        ctx.lineTo(wing2.x, wing2.y);
        ctx.stroke();
      } else {
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(wing1.x, wing1.y);
        ctx.lineTo(wing2.x, wing2.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    function drawAnnotationLeader(element, preview = false) {
      if (!element.start || !element.end) return;
      const start = preview ? element.start : annotationLeaderAnchor(element);
      if (!start) return;
      const elbow = element.elbow || {
        x: (start.x + element.end.x) / 2,
        y: element.end.y,
      };
      withCanvasState(() => {
        const style = normalizeAnnotationStyle(element.style);
        const color = annotationDisplayColor(element, style);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = style.lineWidth / viewport.scale;
        ctx.setLineDash(preview ? [5 / viewport.scale, 4 / viewport.scale] : appearanceLineDash(style.lineType));
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(elbow.x, elbow.y);
        ctx.lineTo(element.end.x, element.end.y);
        ctx.stroke();
        ctx.setLineDash([]);
        const dx = elbow.x - start.x;
        const dy = elbow.y - start.y;
        const len = Math.max(1e-9, hypot2(dx, dy));
        drawAnnotationTerminator(start, { x: dx / len, y: dy / len }, style);
        if (element.text) drawAnnotationText(element, color);
      });
    }
    return Object.freeze({ annotationTextWorldHeight, drawAnnotationText, drawAnnotationLeader });
  }
  window.AnnotationRenderer = Object.freeze({ create });
})();
