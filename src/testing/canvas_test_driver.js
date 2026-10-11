/* Browser-test viewport focus and world-to-client positions through existing display owners. */
(() => {
  "use strict";
  function create({ viewport, clampZoom, resizeCanvas, draw, canvas, currentCanvasCenterWorld, worldToCanvasScreen }) {
    function focus(center, scale = 1) {
      viewport.update({ scale: clampZoom(Number(scale) || 1) });
      resizeCanvas({ centerWorld: { x: Number(center?.x) || 0, y: Number(center?.y) || 0 } });
      draw();
      const rect = canvas.getBoundingClientRect();
      return {
        scale: viewport.scale,
        center: currentCanvasCenterWorld(),
        canvas: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      };
    }

    function clientPosition(point) {
      const rect = canvas.getBoundingClientRect();
      const screen = worldToCanvasScreen({ x: Number(point?.x) || 0, y: Number(point?.y) || 0 });
      return { x: rect.left + screen.x, y: rect.top + screen.y };
    }
    return Object.freeze({ focus, clientPosition });
  }
  function createZoomObservation({ viewport, clampZoom, readUnits, formatZoom, cssPxPerMm }) {
    function state(zoomRatio = null) {
      if (zoomRatio != null) viewport.update({ scale: clampZoom(Number(zoomRatio) * cssPxPerMm) });
      return {
        units: { ...readUnits() },
        zoomRatio: viewport.scale / cssPxPerMm,
        formatted: formatZoom(viewport.scale),
        cssPixelsPerMillimeter: cssPxPerMm,
        viewportScale: viewport.scale,
      };
    }
    return Object.freeze({ state });
  }

  function createHitObservation({ hitArcEndpoint, hitPoint, hitLine, hitCircle, hitArc, hitSpline }) {
    function hit(point) {
      const x = Number(point?.x) || 0;
      const y = Number(point?.y) || 0;
      const arcEndpoint = hitArcEndpoint(x, y);
      return {
        point: hitPoint(x, y)?.id || null,
        line: hitLine(x, y)?.id || null,
        circle: hitCircle(x, y)?.id || null,
        arc: hitArc(x, y)?.id || null,
        spline: hitSpline(x, y)?.id || null,
        arcEndpoint: arcEndpoint ? { id: arcEndpoint.arc.id, endpoint: arcEndpoint.endpoint } : null,
      };
    }
    return Object.freeze({ hit });
  }

  function createGeometryPosition({ currentScope, evaluateSpline, clientPosition }) {
    function position(kind, id, detail = null) {
      let point = null;
      if (kind === "point") point = currentScope().points.find((item) => item.id === id) || null;
      if (kind === "line") {
        const line = currentScope().lines.find((item) => item.id === id);
        if (line) point = { x: (line.p1.x + line.p2.x) / 2, y: (line.p1.y + line.p2.y) / 2 };
      }
      if (kind === "circle") {
        const circle = currentScope().circles.find((item) => item.id === id);
        if (circle) point = { x: circle.center.x + circle.radius(), y: circle.center.y };
      }
      if (kind === "arc") {
        const arc = currentScope().arcs.find((item) => item.id === id);
        if (arc) {
          const angle = detail === "start" ? arc.startAngle : detail === "end" ? arc.endAngle : arc.startAngle + (arc.endAngle - arc.startAngle) / 2;
          point = { x: arc.center.x + arc.radius() * Math.cos(angle), y: arc.center.y + arc.radius() * Math.sin(angle) };
        }
      }
      if (kind === "spline") {
        const spline = currentScope().splines.find((item) => item.id === id);
        if (spline) point = evaluateSpline(spline.curve(), detail === "start" ? 0 : detail === "end" ? 1 : 0.5);
      }
      return point ? clientPosition(point) : null;
    }
    return Object.freeze({ position });
  }

  window.CanvasTestDriver = Object.freeze({ create, createZoomObservation, createHitObservation, createGeometryPosition });
})();
