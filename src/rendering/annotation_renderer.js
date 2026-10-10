/* Annotation text, leaders and terminators; interaction and anchor resolution are ports. */
(function () {
  "use strict";
  const { CSS_PX_PER_MM: ANNOTATION_SCREEN_PX_PER_MM, normalizeAnnotationStyle } = window.Appearance;
  const { hypot2 } = window.GeometrySolver;
  function displayText(element, formatValue = String) {
    const source = element.localElement || element;
    if (source.parameterEnabled !== true) return String(element.text || "");
    const style = normalizeAnnotationStyle(element.style);
    const value = Number.isFinite(source.evaluatedParameterValue)
      ? style.precision == null ? formatValue(source.evaluatedParameterValue) : source.evaluatedParameterValue.toFixed(style.precision)
      : "—";
    return `${style.prefix}${value}${style.suffix}`;
  }

  function create({ ctx, viewport, withCanvasState, annotationDisplayColor, annotationLeaderAnchor, appearanceLineDash, formatValue, showLeaderEndHandle = () => false, effectiveAnnotationStyle = element => normalizeAnnotationStyle(element.style) }) {
    const drawTerminator = window.TerminatorRenderer.create({ ctx, viewport }).draw;
    function annotationFontFamilyStack(fontFamily) {
      if (fontFamily === "serif") return 'Georgia, "Times New Roman", serif';
      if (fontFamily === "monospace") return 'ui-monospace, SFMono-Regular, Consolas, monospace';
      return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    }

    function annotationTextScreenHeight(style) {
      return normalizeAnnotationStyle(style).textHeight * ANNOTATION_SCREEN_PX_PER_MM * window.Appearance.annotationDisplayFactor(style, viewport.scale);
    }

    function annotationTextWorldHeight(style) {
      return annotationTextScreenHeight(style) / viewport.scale;
    }

    // Coordinates remain authoritative; resolve the entire annotation around its attached arrow.
    function annotationLeaderDisplayGeometry(element, start = annotationLeaderAnchor?.(element) || element?.start) {
      if (!element?.end || !element.elbow && !start) return null;
      const storedStart = element.start || start;
      const storedElbow = element.elbow || { x: (storedStart.x + element.end.x) / 2, y: element.end.y };
      const reference = Number(element.shelfReferenceScale);
      const referenceScale = Number.isFinite(reference) && reference > 0 ? reference : ANNOTATION_SCREEN_PX_PER_MM;
      const factor = referenceScale / viewport.scale * window.Appearance.annotationDisplayFactor(effectiveAnnotationStyle(element), viewport.scale);
      const origin = start || storedStart || { x: 0, y: 0 };
      const base = storedStart || origin;
      const displayPoint = point => ({ x: origin.x + (point.x - base.x) * factor, y: origin.y + (point.y - base.y) * factor });
      const elbow = displayPoint(storedElbow), end = displayPoint(element.end);
      const text = displayPoint({ x: Number(element.x) || 0, y: Number(element.y) || 0 });
      if (element.textPlacement === "text") {
        const style = effectiveAnnotationStyle(element);
        const metrics = annotationTextMetrics({ ...element, annotationTransformRotation: 0 }, { x: 0, y: 0 });
        const gap = ((style.textGap ?? 1) * ANNOTATION_SCREEN_PX_PER_MM + style.lineWidth / 2)
          / viewport.scale * window.Appearance.annotationDisplayFactor(style, viewport.scale);
        const rotation = element.annotationTransformRotation || 0;
        const normal = { x: -Math.sin(rotation), y: Math.cos(rotation) };
        const offset = metrics.bounds.y2 + gap - ((elbow.x - text.x) * normal.x + (elbow.y - text.y) * normal.y);
        for (const point of [elbow, end]) { point.x += normal.x * offset; point.y += normal.y * offset; }
      }
      return { elbow, end, shelfScale: factor,
        x: text.x, y: text.y };
    }

    function annotationTextMetrics(element, position = element) {
      const style = effectiveAnnotationStyle(element);
      const fontSize = annotationTextWorldHeight(style);
      const lines = displayText(element, formatValue).split(/\r\n|\r|\n/);
      ctx.save();
      ctx.font = `${style.italic ? "italic " : ""}${style.bold ? "700 " : ""}${fontSize}px ${annotationFontFamilyStack(style.fontFamily)}`;
      const width = Math.max(0, ...lines.map(line => ctx.measureText(line).width));
      ctx.restore();
      const height = fontSize * (1 + (lines.length - 1) * 1.2);
      const left = style.textAlign === "center" ? -width / 2 : style.textAlign === "right" ? -width : 0;
      const rotation = element.appearanceInheritance ? (Number(style.rotation) || 0) + (element.annotationTransformRotation || 0) : Number(element.rotation) || 0;
      const { x, y } = position;
      const corners = [{ x: left, y: -height / 2 }, { x: left + width, y: -height / 2 },
        { x: left + width, y: height / 2 }, { x: left, y: height / 2 }];
      const world = corners.map(p => ({ x: x + p.x * Math.cos(rotation) - p.y * Math.sin(rotation), y: y + p.x * Math.sin(rotation) + p.y * Math.cos(rotation) }));
      return { x, y, rotation, fontSize, width, height, left,
        bounds: { x1: Math.min(...world.map(p => p.x)), y1: Math.min(...world.map(p => p.y)),
          x2: Math.max(...world.map(p => p.x)), y2: Math.max(...world.map(p => p.y)) } };
    }

    // New leaders locate text from the shelf, preserving its gap after font, zoom and rotation changes.
    // Legacy annotations retain stored x/y and follow the shelf span until the gap is individually edited.
    function annotationTextLayout(element) {
      if (element?.type === "leader" && element.textPlacement === "text") return annotationTextMetrics(element, annotationLeaderDisplayGeometry(element));
      if (element?.type !== "leader" || element.textPlacement !== "shelf" || !element.elbow || !element.end) return null;
      const style = effectiveAnnotationStyle(element);
      const shelf = annotationLeaderDisplayGeometry(element);
      const { fontSize, width, height, left } = annotationTextMetrics(element);
      const corners = [{ x: left, y: -height / 2 }, { x: left + width, y: -height / 2 },
        { x: left + width, y: height / 2 }, { x: left, y: height / 2 }];
      const localRotation = Number(style.rotation) || 0;
      const transformRotation = Number(element.annotationTransformRotation) || 0;
      const rotation = localRotation + transformRotation;
      const bottom = Math.max(...corners.map(point => point.x * Math.sin(localRotation) + point.y * Math.cos(localRotation)));
      const gapWorld = (Number(style.textGap) || 0) * ANNOTATION_SCREEN_PX_PER_MM / viewport.scale * window.Appearance.annotationDisplayFactor(style, viewport.scale);
      const strokeHalfWidth = style.lineWidth / viewport.scale * window.Appearance.annotationDisplayFactor(style, viewport.scale) / 2;
      const offset = bottom + gapWorld + strokeHalfWidth;
      const along = (shelf.end.x - shelf.elbow.x) * Math.cos(transformRotation)
        + (shelf.end.y - shelf.elbow.y) * Math.sin(transformRotation);
      const leftEnd = along < 0 ? shelf.end : shelf.elbow;
      const inset = fontSize / 2;
      const x = leftEnd.x + Math.cos(transformRotation) * inset + Math.sin(transformRotation) * offset;
      const y = leftEnd.y + Math.sin(transformRotation) * inset - Math.cos(transformRotation) * offset;
      const worldCorners = corners.map(point => ({ x: x + point.x * Math.cos(rotation) - point.y * Math.sin(rotation), y: y + point.x * Math.sin(rotation) + point.y * Math.cos(rotation) }));
      return { x, y, rotation, fontSize, width, height, gapWorld, strokeHalfWidth, left,
        bounds: { x1: Math.min(...worldCorners.map(p => p.x)), y1: Math.min(...worldCorners.map(p => p.y)),
          x2: Math.max(...worldCorners.map(p => p.x)), y2: Math.max(...worldCorners.map(p => p.y)) } };
    }

    function drawAnnotationText(element, colorOverride = null) {
      const style = effectiveAnnotationStyle(element);
      const layout = annotationTextLayout(element);
      const position = layout || (element.type === "leader" ? annotationLeaderDisplayGeometry(element) : null) || element;
      const fontSize = annotationTextWorldHeight(style);
      const fontPrefix = `${style.italic ? "italic " : ""}${style.bold ? "700 " : ""}`;
      ctx.save();
      ctx.font = `${fontPrefix}${fontSize}px ${annotationFontFamilyStack(style.fontFamily)}`;
      ctx.fillStyle = colorOverride || annotationDisplayColor(element, style);
      ctx.textAlign = style.textAlign;
      ctx.textBaseline = "middle";
      ctx.translate(position.x, position.y);
      ctx.rotate(element.appearanceInheritance ? (style.rotation || 0) + (element.annotationTransformRotation || 0) : Number(element.rotation) || 0);
      const lines = displayText(element, formatValue).split(/\r\n|\r|\n/);
      lines.forEach((line, index) => ctx.fillText(line, 0, (index - (lines.length - 1) / 2) * fontSize * 1.2));
      ctx.restore();
    }

    function drawAnnotationLeader(element, preview = false) {
      if (!element.start || !element.end) return;
      const start = preview ? element.start : annotationLeaderAnchor(element);
      if (!start) return;
      const { elbow, end } = annotationLeaderDisplayGeometry(element, start);
      withCanvasState(() => {
        const style = effectiveAnnotationStyle(element);
        const color = annotationDisplayColor(element, style);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        const factor = window.Appearance.annotationDisplayFactor(style, viewport.scale);
        ctx.lineWidth = style.lineWidth / viewport.scale * factor;
        ctx.setLineDash(preview ? [5 / viewport.scale, 4 / viewport.scale] : appearanceLineDash(style.lineType).map(value => value * factor));
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(elbow.x, elbow.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.setLineDash([]);
        const dx = elbow.x - start.x;
        const dy = elbow.y - start.y;
        const len = Math.max(1e-9, hypot2(dx, dy));
        drawTerminator(start, { x: dx / len, y: dy / len }, style);
        if (element.parameterEnabled || element.text) drawAnnotationText(element, color);
        if (!preview && showLeaderEndHandle(element)) {
          const size = 8 / viewport.scale;
          ctx.lineWidth = 1 / viewport.scale;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.rect(end.x - size / 2, end.y - size / 2, size, size);
          ctx.fill();
          ctx.stroke();
        }
      });
    }
    return Object.freeze({ annotationLeaderDisplayGeometry, annotationTextLayout, annotationTextMetrics, annotationTextWorldHeight, drawAnnotationText, drawAnnotationLeader });
  }
  window.AnnotationRenderer = Object.freeze({ create, displayText });
})();
