/* Read-only annotation bounds and pointer queries; rendering and edits remain separate. */
(() => {
  "use strict";
  const { CSS_PX_PER_MM: ANNOTATION_SCREEN_PX_PER_MM, normalizeAnnotationStyle } = window.Appearance;
  const { hypot2 } = window.GeometrySolver;
  const { distancePointToSegmentPoints } = window.GeometryKernel;
  const { mergeBounds, pointInExpandedBox } = window.GeometryBounds;
  function create({ viewportScale, annotationTextWorldHeight, formatDisplayNumber, allAnnotations, isVisibleSketchId, activeSketchId, annotationLeaderAnchor, isVisibleValue = visible => visible !== false }) {
    function annotationBounds(element) {
      if (!element) return null;
      const style = normalizeAnnotationStyle(element.style);
      const fixed = style.fixedDisplaySize !== false;
      const fontSize = fixed ? style.textHeight * ANNOTATION_SCREEN_PX_PER_MM : annotationTextWorldHeight(style);
      const paddingScale = fixed ? 1 : 1 / viewportScale();
      const lines = window.AnnotationRenderer.displayText(element, formatDisplayNumber).split(/\r\n|\r|\n/);
      const textWidth = Math.max(28 * paddingScale, ...lines.map(line => line.length * fontSize * 0.62));
      const textHeight = fontSize * (1 + (lines.length - 1) * 1.2) + 10 * paddingScale;
      const center = { x: Number(element.x) || 0, y: Number(element.y) || 0 };
      const rotation = Number(element.rotation) || 0;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const left = style.textAlign === "center" ? -textWidth / 2 : style.textAlign === "right" ? -textWidth : 0;
      const right = left + textWidth;
      const textCorners = [
        { x: left, y: -textHeight / 2 },
        { x: right, y: -textHeight / 2 },
        { x: right, y: textHeight / 2 },
        { x: left, y: textHeight / 2 },
      ].map((point) => ({
        x: center.x + point.x * cos - point.y * sin,
        y: center.y + point.x * sin + point.y * cos,
      }));
      let bounds = {
        x1: Math.min(...textCorners.map((point) => point.x)),
        y1: Math.min(...textCorners.map((point) => point.y)),
        x2: Math.max(...textCorners.map((point) => point.x)),
        y2: Math.max(...textCorners.map((point) => point.y)),
      };
      if (element.type === "leader") {
        for (const point of [element.start, element.elbow, element.end]) {
          if (point) bounds = mergeBounds(bounds, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
        }
      }
      return bounds;
    }

    function textHitBox(text, x, y, fontSize = 13, textAlign = "left") {
      const lines = String(text || "").split(/\r\n|\r|\n/);
      const width = Math.max(28, ...lines.map(line => line.length * fontSize * 0.62));
      const height = fontSize * (1 + (lines.length - 1) * 1.2) + 10;
      const left = textAlign === "center" ? x - width / 2 : textAlign === "right" ? x - width : x;
      return {
        left,
        right: left + width,
        top: y - height / 2,
        bottom: y + height / 2,
      };
    }

    function pointInAnnotationTextBox(x, y, element, padding = 0) {
      const rotation = -(Number(element?.rotation) || 0);
      const dx = x - (Number(element?.x) || 0);
      const dy = y - (Number(element?.y) || 0);
      const localX = dx * Math.cos(rotation) - dy * Math.sin(rotation) + (Number(element?.x) || 0);
      const localY = dx * Math.sin(rotation) + dy * Math.cos(rotation) + (Number(element?.y) || 0);
      const style = normalizeAnnotationStyle(element?.style);
      const fontSize = annotationTextWorldHeight(style);
      return pointInExpandedBox(localX, localY, textHitBox(window.AnnotationRenderer.displayText(element || {}, formatDisplayNumber), element?.x, element?.y, fontSize, style.textAlign), padding);
    }

    function boxFromPoints(points) {
      const valid = points.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
      if (valid.length === 0) return null;
      return {
        left: Math.min(...valid.map((p) => p.x)),
        right: Math.max(...valid.map((p) => p.x)),
        top: Math.min(...valid.map((p) => p.y)),
        bottom: Math.max(...valid.map((p) => p.y)),
      };
    }

    function hitAnnotationElement(x, y) {
      const threshold = 12 / viewportScale();
      const annotations = allAnnotations();
      for (let i = annotations.length - 1; i >= 0; i--) {
        const element = annotations[i];
        if (!element || !isVisibleValue(element.visible) || !isVisibleSketchId(element.sketchId)) continue;
        if (!element.blockProjection && element.sketchId !== activeSketchId()) continue;
        if (element.type === "leader") {
          const start = annotationLeaderAnchor(element);
          if (!start || !element.end) continue;
          const elbow = element.elbow || { x: (start.x + element.end.x) / 2, y: element.end.y };
          if (distancePointToSegmentPoints(x, y, start, elbow) <= threshold * 2.2 || distancePointToSegmentPoints(x, y, elbow, element.end) <= threshold * 2.2) return { element, type: "leader", part: "line" };
          if (pointInAnnotationTextBox(x, y, element, threshold)) return { element, type: "leader", part: "label" };
          if (hypot2(x - element.x, y - element.y) <= threshold * 3) return { element, type: "leader", part: "label" };
          const leaderBox = boxFromPoints([start, elbow, element.end, { x: element.x, y: element.y }]);
          if (leaderBox && pointInExpandedBox(x, y, leaderBox, threshold * 2.2)) return { element, type: "leader", part: "line" };
        } else if (element.type === "text") {
          if (pointInAnnotationTextBox(x, y, element, threshold)) return { element, type: "text", part: "label" };
        }
      }
      return null;
    }

    function canvasContextAnnotationHit(element, pointer) {
      if (!element || !isVisibleValue(element.visible)) return null;
      const threshold = 12 / viewportScale();
      if (element.type === "leader") {
        const start = annotationLeaderAnchor(element);
        if (!start || !element.end) return null;
        const elbow = element.elbow || { x: (start.x + element.end.x) / 2, y: element.end.y };
        const firstDistance = distancePointToSegmentPoints(pointer.x, pointer.y, start, elbow);
        const secondDistance = distancePointToSegmentPoints(pointer.x, pointer.y, elbow, element.end);
        const lineDistance = Math.min(firstDistance, secondDistance);
        if (lineDistance <= threshold * 2.2) return { element, type: "leader", part: "line", distance: lineDistance };
        if (pointInAnnotationTextBox(pointer.x, pointer.y, element, threshold)) return { element, type: "leader", part: "label", distance: 0 };
        const labelDistance = hypot2(pointer.x - element.x, pointer.y - element.y);
        if (labelDistance <= threshold * 3) return { element, type: "leader", part: "label", distance: labelDistance };
        const leaderBox = boxFromPoints([start, elbow, element.end, { x: element.x, y: element.y }]);
        if (leaderBox && pointInExpandedBox(pointer.x, pointer.y, leaderBox, threshold * 2.2)) {
          return { element, type: "leader", part: "line", distance: Math.min(lineDistance, labelDistance) };
        }
        return null;
      }
      if (element.type === "text" && pointInAnnotationTextBox(pointer.x, pointer.y, element, threshold)) {
        return { element, type: "text", part: "label", distance: 0 };
      }
      return null;
    }

    return Object.freeze({ annotationBounds, pointInAnnotationTextBox, hitAnnotationElement, canvasContextAnnotationHit });
  }
  window.AnnotationSpatialQuery = Object.freeze({ create });
})();
