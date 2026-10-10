/* Paint projected placement bundles without creating or modifying instances. */
(() => {
  "use strict";
  function create({ ctx, viewport, withCanvasState, traceSplinePath,
    drawResolvedHatch, resolvedHatchBoundary, hatchAppearanceForDisplay, hatchPatternOrigin,
    drawAnnotationLeader, drawAnnotationText }) {
    function drawGeometry(bundle) {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      for (const line of bundle.lines) {
        ctx.beginPath(); ctx.moveTo(line.p1.x, line.p1.y); ctx.lineTo(line.p2.x, line.p2.y); ctx.stroke();
      }
      for (const circle of bundle.circles) {
        ctx.beginPath(); ctx.arc(circle.center.x, circle.center.y, circle.radius(), 0, Math.PI * 2); ctx.stroke();
      }
      for (const arc of bundle.arcs) {
        ctx.beginPath(); ctx.arc(arc.center.x, arc.center.y, arc.radius(), arc.startAngle, arc.endAngle, arc.endAngle < arc.startAngle); ctx.stroke();
      }
      for (const spline of bundle.splines || []) { traceSplinePath(spline); ctx.stroke(); }
    }
    function drawBlock(bundle) {
      if (!bundle) return;
      withCanvasState(() => {
        for (const hatch of bundle.hatches || []) {
          drawResolvedHatch(resolvedHatchBoundary(hatch), { ...hatchAppearanceForDisplay(hatch), color: "#2563eb" }, hatchPatternOrigin(hatch), { preview: true, alpha: 0.75 });
        }
        drawGeometry(bundle);
        for (const annotation of bundle.annotations || []) {
          const preview = { ...annotation, style: { ...annotation.style, color: "#2563eb" } };
          if (preview.type === "leader") drawAnnotationLeader(preview, true);
          else drawAnnotationText(preview);
        }
      });
    }
    function drawFreeInstance(bundle) {
      if (!bundle) return;
      withCanvasState(() => {
        for (const hatch of bundle.hatches || []) {
          drawResolvedHatch(resolvedHatchBoundary(hatch), { ...hatchAppearanceForDisplay(hatch), color: "#2563eb" }, hatchPatternOrigin(hatch), { preview: true, alpha: 0.75 });
        }
        drawGeometry(bundle);
        for (const point of bundle.points) {
          ctx.beginPath(); ctx.arc(point.x, point.y, 3 / viewport.scale, 0, Math.PI * 2); ctx.stroke();
        }
      });
    }
    return Object.freeze({ drawBlock, drawFreeInstance });
  }
  window.PlacementPreviewRenderer = Object.freeze({ create });
})();
