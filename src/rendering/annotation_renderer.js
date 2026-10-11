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

  function create({ ctx, viewport, withCanvasState, annotationDisplayColor, annotationLeaderAnchor, appearanceLineDash, formatValue, showLeaderEndHandle = () => false, showFrame = () => false, resolvePlacement = (element, point) => point, effectiveAnnotationStyle = element => normalizeAnnotationStyle(element.style) }) {
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
      if (element.textPlacement === "anchor") {
        const placed = resolvePlacement(element, text);
        text.x = placed.x; text.y = placed.y;
        const metrics = annotationTextMetrics(element, text);
        const style = effectiveAnnotationStyle(element);
        const gap = ((style.textGap ?? 1) * ANNOTATION_SCREEN_PX_PER_MM + style.lineWidth / 2) / viewport.scale * window.Appearance.annotationDisplayFactor(style, viewport.scale);
        const rotation = element.annotationTransformRotation || 0, cos = Math.cos(rotation), sin = Math.sin(rotation);
        const localCorners = metrics.frameCorners.map(point => ({ x: (point.x - text.x) * cos + (point.y - text.y) * sin, y: -(point.x - text.x) * sin + (point.y - text.y) * cos }));
        const bottom = Math.max(...localCorners.map(point => point.y)) + gap;
        const left = Math.min(...localCorners.map(point => point.x)) - metrics.fontSize / 2;
        const right = Math.max(...localCorners.map(point => point.x));
        const leftPoint = { x: text.x + left * cos - bottom * sin, y: text.y + left * sin + bottom * cos };
        const rightPoint = { x: text.x + right * cos - bottom * sin, y: text.y + right * sin + bottom * cos };
        const leftNear = hypot2(origin.x - leftPoint.x, origin.y - leftPoint.y) <= hypot2(origin.x - rightPoint.x, origin.y - rightPoint.y);
        // A constrained label has an independently moving attachment at the arrow.
        if (element.anchorConstraints?.length) { Object.assign(elbow, leftNear ? leftPoint : rightPoint); Object.assign(end, leftNear ? rightPoint : leftPoint); }
        else {
          const offset = bottom - ((elbow.x - text.x) * -sin + (elbow.y - text.y) * cos);
          for (const point of [elbow, end]) { point.x -= sin * offset; point.y += cos * offset; }
        }
      }
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
      let { x, y } = position;
      if (element.anchorPosition && Number.isFinite(position.anchorX)) { x = position.anchorX; y = position.anchorY; }
      const factor = ANNOTATION_SCREEN_PX_PER_MM / viewport.scale * window.Appearance.annotationDisplayFactor(style, viewport.scale);
      const paddingX = (Number(style.framePaddingX) || 0) * factor, paddingY = (Number(style.framePaddingY) || 0) * factor;
      const frameWidth = width + paddingX * 2, frameHeight = height + paddingY * 2;
      const parts = (element.anchorPosition || `${style.textAlign}-middle`).split("-");
      const horizontal = { left: 0, center: 0.5, right: 1 }[parts[0]] ?? 0;
      const vertical = { top: 0, middle: 0.5, bottom: 1 }[parts[1]] ?? 0.5;
      let anchorX, anchorY;
      if (element.anchorPosition) {
        const anchor = element.type === "text" ? resolvePlacement(element, { x, y }) : { x, y };
        anchorX = anchor.x; anchorY = anchor.y;
        const offsetX = -horizontal * frameWidth + paddingX - left;
        const offsetY = -vertical * frameHeight + paddingY + height / 2;
        x = anchorX + offsetX * Math.cos(rotation) - offsetY * Math.sin(rotation);
        y = anchorY + offsetX * Math.sin(rotation) + offsetY * Math.cos(rotation);
      } else {
        const offsetX = left - paddingX + horizontal * frameWidth, offsetY = -frameHeight / 2 + vertical * frameHeight;
        anchorX = x + offsetX * Math.cos(rotation) - offsetY * Math.sin(rotation);
        anchorY = y + offsetX * Math.sin(rotation) + offsetY * Math.cos(rotation);
      }
      const corners = [{ x: left, y: -height / 2 }, { x: left + width, y: -height / 2 },
        { x: left + width, y: height / 2 }, { x: left, y: height / 2 }];
      const world = corners.map(p => ({ x: x + p.x * Math.cos(rotation) - p.y * Math.sin(rotation), y: y + p.x * Math.sin(rotation) + p.y * Math.cos(rotation) }));
      const frame = { left: left - paddingX, top: -height / 2 - paddingY, width: frameWidth, height: frameHeight };
      const frameCorners = [{ x: frame.left, y: frame.top }, { x: frame.left + frame.width, y: frame.top }, { x: frame.left + frame.width, y: frame.top + frame.height }, { x: frame.left, y: frame.top + frame.height }].map(p => ({ x: x + p.x * Math.cos(rotation) - p.y * Math.sin(rotation), y: y + p.x * Math.sin(rotation) + p.y * Math.cos(rotation) }));
      return { x, y, rotation, fontSize, width, height, left, anchorX, anchorY, frame, frameCorners,
        textBounds: { x1: Math.min(...world.map(p => p.x)), y1: Math.min(...world.map(p => p.y)), x2: Math.max(...world.map(p => p.x)), y2: Math.max(...world.map(p => p.y)) },
        bounds: { x1: Math.min(...frameCorners.map(p => p.x)), y1: Math.min(...frameCorners.map(p => p.y)), x2: Math.max(...frameCorners.map(p => p.x)), y2: Math.max(...frameCorners.map(p => p.y)) } };
    }

    // New leaders locate text from the shelf, preserving its gap after font, zoom and rotation changes.
    // Legacy annotations retain stored x/y and follow the shelf span until the gap is individually edited.
    function annotationTextLayout(element) {
      if (element.type === "text") return annotationTextMetrics(element);
      if (element.textPlacement === "anchor") {
        const style = effectiveAnnotationStyle(element);
        const factor = window.Appearance.annotationDisplayFactor(style, viewport.scale);
        return { ...annotationTextMetrics(element, annotationLeaderDisplayGeometry(element)),
          gapWorld: (style.textGap ?? 1) * ANNOTATION_SCREEN_PX_PER_MM / viewport.scale * factor,
          strokeHalfWidth: style.lineWidth / viewport.scale * factor / 2 };
      }
      if (element?.type === "leader" && element.textPlacement === "text") return annotationTextMetrics(element, annotationLeaderDisplayGeometry(element));
      if (element?.type !== "leader") return null;
      if (element.textPlacement !== "shelf" || !element.elbow || !element.end) return null;
      const style = effectiveAnnotationStyle(element);
      const shelf = annotationLeaderDisplayGeometry(element);
      const initial = annotationTextMetrics({ ...element, anchorPosition: undefined });
      const { fontSize, width, height, left } = initial;
      const box = element.anchorPosition ? initial.frame : { left, top: -height / 2, width, height };
      const corners = [{ x: box.left, y: box.top }, { x: box.left + box.width, y: box.top },
        { x: box.left + box.width, y: box.top + box.height }, { x: box.left, y: box.top + box.height }];
      const localRotation = Number(style.rotation) || 0;
      const transformRotation = Number(element.annotationTransformRotation) || 0;
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
      if (element.anchorPosition) {
        const layout = annotationTextMetrics({ ...element, anchorPosition: undefined }, { x, y });
        const [horizontal, vertical] = element.anchorPosition.split("-");
        const offsetX = layout.frame.left + layout.frame.width * ({ left: 0, center: 0.5, right: 1 }[horizontal] ?? 0);
        const offsetY = layout.frame.top + layout.frame.height * ({ top: 0, middle: 0.5, bottom: 1 }[vertical] ?? 0.5);
        const anchorX = x + offsetX * Math.cos(layout.rotation) - offsetY * Math.sin(layout.rotation);
        const anchorY = y + offsetX * Math.sin(layout.rotation) + offsetY * Math.cos(layout.rotation);
        return { ...annotationTextMetrics(element, { x: anchorX, y: anchorY }), gapWorld, strokeHalfWidth };
      }
      return { ...annotationTextMetrics(element, { x, y }), gapWorld, strokeHalfWidth };
    }

    function drawAnnotationText(element, colorOverride = null) {
      const style = effectiveAnnotationStyle(element);
      const framed = Boolean(element.anchorPosition || style.frameVisible || showFrame(element) || style.framePaddingX || style.framePaddingY);
      let layout = element.type === "text" && !framed ? null : annotationTextLayout(element);
      if (framed && !layout) layout = annotationTextMetrics(element, element.type === "leader" ? annotationLeaderDisplayGeometry(element) || element : element);
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
      if ((style.frameVisible || showFrame(element)) && layout?.frame) {
        ctx.save(); ctx.translate(layout.x, layout.y); ctx.rotate(layout.rotation);
        const factor = window.Appearance.annotationDisplayFactor(style, viewport.scale);
        ctx.strokeStyle = showFrame(element) ? annotationDisplayColor(element, style) : style.frameColor || style.color;
        ctx.lineWidth = (Number(style.frameLineWidth) || 1) / viewport.scale * factor;
        ctx.setLineDash(style.frameVisible ? appearanceLineDash(style.frameLineType || "solid").map(value => value * factor) : [4 / viewport.scale, 3 / viewport.scale]);
        ctx.beginPath(); ctx.rect(layout.frame.left, layout.frame.top, layout.frame.width, layout.frame.height); ctx.stroke();
        if (showFrame(element)) {
          ctx.setLineDash([]); const size = 6 / viewport.scale;
          const dx = layout.anchorX - layout.x, dy = layout.anchorY - layout.y;
          const x = dx * Math.cos(layout.rotation) + dy * Math.sin(layout.rotation), y = -dx * Math.sin(layout.rotation) + dy * Math.cos(layout.rotation);
          ctx.beginPath(); ctx.rect(x - size / 2, y - size / 2, size, size); ctx.stroke();
        }
        ctx.restore();
      }
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
