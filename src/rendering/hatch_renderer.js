/* Paint resolved Hatch loops and compose their read-only layer presentation. */
(function () {
  "use strict";
  const { CSS_PX_PER_MM: HATCH_SCREEN_PX_PER_MM, DEFAULT_HATCH_APPEARANCE } = window.Appearance;
  const { resolvedLoopBounds } = window.HatchRegionEngine;
  function intersectBounds(a, b) {
    if (!a || !b) return null;
    const result = { x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), x2: Math.min(a.x2, b.x2), y2: Math.min(a.y2, b.y2) };
    return result.x1 <= result.x2 && result.y1 <= result.y2 ? result : null;
  }

  function traceResolvedHatchPath(resolved, targetContext) {
    targetContext.beginPath();
    for (const loop of resolved?.loops || []) {
      if (!loop.points?.length) continue;
      targetContext.moveTo(loop.points[0].x, loop.points[0].y);
      for (let index = 1; index < loop.points.length; index++) targetContext.lineTo(loop.points[index].x, loop.points[index].y);
      targetContext.closePath();
    }
  }

  function create({ viewport, visibleWorldBounds, canvasThemeColor, isVisibleValue = visible => visible !== false }) {
    function drawResolvedHatchContent(targetContext, resolved, appearance, origin, { selected = false, hovered = false, preview = false, alpha = 1 } = {}) {
      if (!resolved?.ok || !resolved.loops?.length || !isVisibleValue(appearance.visible)) return;
      const bounds = intersectBounds(resolvedLoopBounds(resolved), visibleWorldBounds());
      if (!bounds) return;
      targetContext.save();
      traceResolvedHatchPath(resolved, targetContext);
      targetContext.clip("evenodd");
      if (preview) {
        targetContext.fillStyle = "rgba(14, 165, 233, 0.10)";
        traceResolvedHatchPath(resolved, targetContext);
        targetContext.fill("evenodd");
      }
      targetContext.globalAlpha = alpha;
      const emphasisColor = canvasThemeColor(selected ? "#2563eb" : hovered || preview ? "#0ea5e9" : appearance.color);
      if (appearance.patternType === "solid") {
        targetContext.globalAlpha = alpha * Math.max(0, Math.min(1, Number(appearance.opacity)));
        targetContext.fillStyle = emphasisColor;
        traceResolvedHatchPath(resolved, targetContext);
        targetContext.fill("evenodd");
        targetContext.restore();
        return;
      }
      const spacing = Math.max(0.25, Number(appearance.spacing) || DEFAULT_HATCH_APPEARANCE.spacing) * HATCH_SCREEN_PX_PER_MM / viewport.scale;
      const corners = [
        { x: bounds.x1, y: bounds.y1 }, { x: bounds.x2, y: bounds.y1 },
        { x: bounds.x2, y: bounds.y2 }, { x: bounds.x1, y: bounds.y2 },
      ];
      const appendLineFamily = (angle) => {
        const direction = { x: Math.cos(angle), y: Math.sin(angle) };
        const normal = { x: -direction.y, y: direction.x };
        const normalProjection = corners.map((point) => (point.x - origin.x) * normal.x + (point.y - origin.y) * normal.y);
        const directionProjection = corners.map((point) => (point.x - origin.x) * direction.x + (point.y - origin.y) * direction.y);
        const first = Math.floor(Math.min(...normalProjection) / spacing) - 1;
        const last = Math.ceil(Math.max(...normalProjection) / spacing) + 1;
        const minAlong = Math.min(...directionProjection) - spacing * 2;
        const maxAlong = Math.max(...directionProjection) + spacing * 2;
        for (let index = first; index <= last; index++) {
          const offset = index * spacing;
          const base = { x: origin.x + normal.x * offset, y: origin.y + normal.y * offset };
          targetContext.moveTo(base.x + direction.x * minAlong, base.y + direction.y * minAlong);
          targetContext.lineTo(base.x + direction.x * maxAlong, base.y + direction.y * maxAlong);
        }
      };
      targetContext.strokeStyle = emphasisColor;
      targetContext.lineWidth = (selected || hovered ? Math.max(1.5, appearance.lineWidth) : appearance.lineWidth) / viewport.scale;
      targetContext.beginPath();
      const angle = Number(appearance.angle) * Math.PI / 180;
      appendLineFamily(angle);
      if (appearance.patternType === "cross") appendLineFamily(angle + Math.PI / 2);
      targetContext.stroke();
      targetContext.restore();
    }

    return Object.freeze({ drawResolvedHatchContent });
  }
  // Compose Hatch content, boundary overlays and draft previews without editing model or interaction state.
  function createLayer({ ctx, drawResolvedHatchContent, hatchBoundaryGeometryItems, boundaryPainters, allHatches,
    isVisibleSketchId, hatchAppearanceForDisplay, isConstraintOperandSelected, canvasSelection, activeSketchId,
    readHover, resolvedHatchBoundary, hatchPatternOrigin, isExporting, sketchAlpha, readMode, readCommand }) {
    function drawResolvedHatch(resolved, appearance, origin = { x: 0, y: 0 }, { hatch = null, selected = false, hovered = false, preview = false, alpha = 1 } = {}) {
      drawResolvedHatchContent(ctx, resolved, appearance, origin, { selected, hovered, preview, alpha });
      if (!preview && hatch) drawHatchBoundaryOverlay(hatch);
    }

    function drawHatchBoundaryOverlay(hatch) {
      const items = hatchBoundaryGeometryItems(hatch);
      // Boundary strokes preserve fill visibility, but their glow belongs to the geometry pass.
      for (const { type, draw } of boundaryPainters) draw(items.filter(item => item instanceof type), { selectionGlow: false });
    }

    function drawHatches(items = null, { includePreview = true } = {}) {
      for (const hatch of items || allHatches()) {
        if (!isVisibleSketchId(hatch.sketchId)) continue;
        const appearance = hatchAppearanceForDisplay(hatch);
        const selected = isConstraintOperandSelected(hatch) || canvasSelection.inspectionContains(hatch) || canvasSelection.inspectionContains(hatch.blockInstance) || canvasSelection.inspectionContains(hatch.derivedInstance) || (hatch.derivedProjection ? canvasSelection.geometryInstances.includes(hatch.derivedInstance) : hatch.blockProjection ? canvasSelection.blockInstances.includes(hatch.blockInstance) : hatch.sketchId === activeSketchId() && canvasSelection.hatches.includes(hatch));
        const hovered = hatch.derivedProjection ? readHover().geometryInstance === hatch.derivedInstance
          : hatch.blockProjection ? readHover().block === hatch.blockInstance : hatch.sketchId === activeSketchId() && readHover().hatch === hatch;
        drawResolvedHatch(resolvedHatchBoundary(hatch), appearance, hatchPatternOrigin(hatch), { hatch, selected: !isExporting() && selected, hovered: !isExporting() && hovered, alpha: sketchAlpha(hatch) });
      }
      if (!isExporting() && includePreview && ["hatch", "hatch-repair"].includes(readMode())) {
        for (const region of readCommand().regions) {
          drawResolvedHatch(region.resolved, DEFAULT_HATCH_APPEARANCE, { x: 0, y: 0 }, { preview: true, selected: region.selected });
        }
      }
      if (!isExporting() && includePreview && ["hatch", "hatch-repair"].includes(readMode()) && readCommand().preview?.result?.ok) {
        drawResolvedHatch({ ...readCommand().preview.result.resolved, ok: true }, DEFAULT_HATCH_APPEARANCE, { x: 0, y: 0 }, { preview: true });
      }
    }

    return Object.freeze({ drawResolvedHatch, drawHatches });
  }
  window.HatchRenderer = Object.freeze({ create, createLayer });
})();
