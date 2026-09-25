/* Paint prepared geometry; selection and visibility policy belong to the caller. */
(function () {
  "use strict";
  const { arcSweep } = window.GeometryKernel;
  function create({ ctx, viewport, paintState, appearanceLineDash, lineDisplaySegment, canvasThemeColor }) {
    function drawLines(items) {
      ctx.save();
      const lines = items;
      for (const l of lines) {
        const { appearance, construction, sel, selected, hovered, auxiliaryHighlighted, relatedHighlighted, showId, alpha, color, strokeWidth } = paintState(l, "lines");
        ctx.globalAlpha = alpha;
        const lineColor = color;
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = strokeWidth / viewport.scale;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.setLineDash(appearanceLineDash(appearance.lineType));
        ctx.shadowColor = sel || auxiliaryHighlighted ? "rgba(14, 165, 233, 0.45)" : "transparent";
        ctx.shadowBlur = sel || auxiliaryHighlighted ? 8 / viewport.scale : 0;
        const drawSegment = lineDisplaySegment(l, appearance);
        ctx.beginPath();
        ctx.moveTo(drawSegment.p1.x, drawSegment.p1.y);
        ctx.lineTo(drawSegment.p2.x, drawSegment.p2.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        if (construction && appearance.endpointMarkers !== false) {
          ctx.fillStyle = lineColor;
          const endpointRadius = 2.4 / viewport.scale;
          for (const p of [l.p1, l.p2]) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, endpointRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (showId) {
          const mx = (l.p1.x + l.p2.x) / 2;
          const my = (l.p1.y + l.p2.y) / 2;
          ctx.fillStyle = canvasThemeColor("#2563eb");
          ctx.font = `${12 / viewport.scale}px system-ui`;
          ctx.fillText(l.id, mx + 4 / viewport.scale, my - 4 / viewport.scale);
        }
      }
      ctx.restore();
    }

    function drawCircles(items) {
      ctx.save();
      ctx.lineCap = "round";
      const circles = items;
      for (const c of circles) {
        const { appearance, construction, sel, selected, hovered, auxiliaryHighlighted, relatedHighlighted, showId, alpha, color, strokeWidth } = paintState(c, "circles");
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeWidth / viewport.scale;
        ctx.setLineDash(appearanceLineDash(appearance.lineType));
        ctx.shadowColor = sel || auxiliaryHighlighted ? "rgba(14, 165, 233, 0.45)" : "transparent";
        ctx.shadowBlur = sel || auxiliaryHighlighted ? 8 / viewport.scale : 0;
        ctx.beginPath();
        ctx.arc(c.center.x, c.center.y, c.radius(), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        if (showId) {
          ctx.fillStyle = canvasThemeColor("#2563eb");
          ctx.font = `${12 / viewport.scale}px system-ui`;
          ctx.fillText(c.id, c.center.x + c.radius() + 4 / viewport.scale, c.center.y - 4 / viewport.scale);
        }
      }
      ctx.restore();
    }

    function drawArcs(items) {
      ctx.save();
      ctx.lineCap = "round";
      const arcs = items;
      for (const a of arcs) {
        const { appearance, construction, sel, selected, hovered, auxiliaryHighlighted, relatedHighlighted, showId, alpha, color, strokeWidth } = paintState(a, "arcs");
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeWidth / viewport.scale;
        ctx.setLineDash(appearanceLineDash(appearance.lineType));
        ctx.shadowColor = sel || auxiliaryHighlighted ? "rgba(14, 165, 233, 0.45)" : "transparent";
        ctx.shadowBlur = sel || auxiliaryHighlighted ? 8 / viewport.scale : 0;
        ctx.beginPath();
        ctx.arc(a.center.x, a.center.y, a.radius(), a.startAngle, a.endAngle, a.endAngle < a.startAngle);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        if (showId) {
          const mid = a.startAngle + arcSweep(a) / 2;
          ctx.fillStyle = canvasThemeColor("#2563eb");
          ctx.font = `${12 / viewport.scale}px system-ui`;
          ctx.fillText(a.id, a.center.x + Math.cos(mid) * a.radius(), a.center.y + Math.sin(mid) * a.radius());
        }
      }
      ctx.restore();
    }

    function drawSplines(items) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const splines = items;
      for (const spline of splines) {
        const { appearance, construction, sel, selected, hovered, auxiliaryHighlighted, relatedHighlighted, showId, alpha, color, strokeWidth } = paintState(spline, "splines");
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeWidth / viewport.scale;
        ctx.setLineDash(appearanceLineDash(appearance.lineType));
        traceSplinePath(spline);
        ctx.stroke();
        ctx.setLineDash([]);
        if (showId) {
          const point = window.SplineGeometry.evaluate(spline.curve(), 0.5);
          if (point) {
            ctx.fillStyle = canvasThemeColor("#2563eb");
            ctx.font = `${12 / viewport.scale}px system-ui`;
            ctx.fillText(spline.id, point.x + 4 / viewport.scale, point.y - 4 / viewport.scale);
          }
        }
      }
      ctx.restore();
    }

    function traceSplinePath(spline) {
      const samples = window.SplineGeometry.flatten(spline.curve(), { tolerance: Math.max(0.05, 0.45 / viewport.scale) });
      ctx.beginPath();
      if (!samples.length) return samples;
      ctx.moveTo(samples[0].point.x, samples[0].point.y);
      for (let index = 1; index < samples.length; index += 1) ctx.lineTo(samples[index].point.x, samples[index].point.y);
      if (spline.closed) ctx.closePath();
      return samples;
    }
    return Object.freeze({ drawLines, drawCircles, drawArcs, drawSplines, traceSplinePath });
  }
  window.GeometryRenderer = Object.freeze({ create });
})();
