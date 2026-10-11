/* Observe Canvas rendering through reversible instrumentation; no model or UI ownership. */
(() => {
  "use strict";
  function create({ ctx, allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs,
    drawLines, drawCircles, drawArcs, drawPoints, drawArcEndpointHandles, drawDimensions }) {
    let expressionMarkCapture = null;
    function geometryIdLabels() {
      const geometryIds = new Set([
        ...allGeometryPoints().map((point) => point.id),
        ...allGeometryLines().map((line) => line.id),
        ...allGeometryCircles().map((circle) => circle.id),
        ...allGeometryArcs().map((arc) => arc.id),
      ]);
      const labels = [];
      const originalFillText = ctx.fillText;
      ctx.fillText = (value) => {
        if (geometryIds.has(String(value))) labels.push(String(value));
      };
      try {
        drawLines();
        drawCircles();
        drawArcs();
        drawPoints();
      } finally {
        ctx.fillText = originalFillText;
      }
      return labels;
    }
    function constraintEndpointMarkerCount() {
      let count = 0;
      const originalArc = ctx.arc;
      ctx.arc = (...args) => {
        count += 1;
        return originalArc.apply(ctx, args);
      };
      try {
        drawLines();
        drawPoints();
      } finally {
        ctx.arc = originalArc;
      }
      return count;
    }
    function pointMarkerCount() {
      let count = 0;
      const originalArc = ctx.arc;
      ctx.arc = (...args) => {
        count += 1;
        return originalArc.apply(ctx, args);
      };
      try {
        drawPoints();
      } finally {
        ctx.arc = originalArc;
      }
      return count;
    }
    function arcEndpointHandleCount() {
      let count = 0;
      const originalArc = ctx.arc;
      ctx.arc = (...args) => {
        count += 1;
        return originalArc.apply(ctx, args);
      };
      try {
        drawArcEndpointHandles();
      } finally {
        ctx.arc = originalArc;
      }
      return count;
    }
    function pointDisplayState(id) {
      const point = allGeometryPoints().find((item) => item.id === id);
      if (!point) return null;
      let drawingTarget = false;
      let marker = null;
      const labels = [];
      const originalArc = ctx.arc;
      const originalFill = ctx.fill;
      const originalStroke = ctx.stroke;
      const originalFillText = ctx.fillText;
      ctx.arc = (x, y, ...args) => {
        drawingTarget = Math.abs(x - point.x) < 1e-9 && Math.abs(y - point.y) < 1e-9;
        return originalArc.call(ctx, x, y, ...args);
      };
      ctx.fill = (...args) => {
        if (drawingTarget) marker = { ...(marker || {}), fill: String(ctx.fillStyle) };
        return originalFill.apply(ctx, args);
      };
      ctx.stroke = (...args) => {
        if (drawingTarget) marker = { ...(marker || {}), stroke: String(ctx.strokeStyle), lineWidth: ctx.lineWidth };
        return originalStroke.apply(ctx, args);
      };
      ctx.fillText = (value, ...args) => {
        if (drawingTarget) labels.push(String(value));
        return originalFillText.call(ctx, value, ...args);
      };
      try {
        drawPoints();
      } finally {
        ctx.arc = originalArc;
        ctx.fill = originalFill;
        ctx.stroke = originalStroke;
        ctx.fillText = originalFillText;
      }
      return { ...(marker || {}), labels };
    }
    function dimensionLabels() {
      const labels = [];
      const originalFillText = ctx.fillText;
      ctx.fillText = (value) => labels.push(String(value));
      try {
        drawDimensions();
      } finally {
        ctx.fillText = originalFillText;
      }
      return labels;
    }
    function dimensionExpressionMarks() {
      const marks = [];
      expressionMarkCapture = (mark) => marks.push(mark);
      try {
        drawDimensions();
      } finally {
        expressionMarkCapture = null;
      }
      return marks;
    }
    function captureExpressionMark(mark) { return expressionMarkCapture?.(mark); }
    return Object.freeze({ geometryIdLabels, constraintEndpointMarkerCount, pointMarkerCount, arcEndpointHandleCount, pointDisplayState, dimensionLabels, dimensionExpressionMarks, captureExpressionMark });
  }
  window.CanvasRenderProbe = Object.freeze({ create });
})();
