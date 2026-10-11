/* Hatch browser-test setup and observations; application owners retain live state. */
(() => {
  "use strict";
  const { createRegionIndex: createHatchRegionIndex, findFaceInIndex: findHatchFaceInIndex } = window.HatchRegionEngine;
  function create({ resetModelState, viewport, addPoint, addLine, addCircle, currentScope,
    fitSketchToViewport, activeSketchId, resetHistory, updateUI, draw, canvas, worldToCanvasScreen, serializeModel,
    readMode, allHatches, hatchGeometryQuery, serializeHatch, hatchRegionErrorText, canvasSelection, hatchCommand, document,
    DEFAULT_SKETCH_ID, DEFAULT_HATCH_APPEARANCE, HATCH_SCREEN_PX_PER_MM }) {
    const { hatchPrimitivesForScope, resolvedHatchBoundary } = hatchGeometryQuery;
    function reset({ constructionBoundary = false } = {}) {
      resetModelState();
      viewport.update({ scale: 1 });
      const points = [
        addPoint(0, 0, false, "endpoint"), addPoint(120, 0, false, "endpoint"),
        addPoint(120, 80, false, "endpoint"), addPoint(0, 80, false, "endpoint"),
      ];
      addLine(points[0], points[1]);
      addLine(points[1], points[2]);
      addLine(points[2], points[3]);
      addLine(points[3], points[0]);
      if (constructionBoundary) currentScope().lines[0].construction = true;
      fitSketchToViewport(activeSketchId(), 160);
      resetHistory("hatch test");
      updateUI();
      draw();
      const rect = canvas.getBoundingClientRect();
      const screen = worldToCanvasScreen({ x: 60, y: 40 });
      const boundaryScreen = worldToCanvasScreen({ x: 60, y: 0 });
      return {
        client: { x: rect.left + screen.x, y: rect.top + screen.y },
        boundaryClient: { x: rect.left + boundaryScreen.x, y: rect.top + boundaryScreen.y },
        serialized: serializeModel(),
      };
    }

    function resetSolidHole() {
      resetModelState();
      viewport.update({ scale: 1 });
      const corners = [
        addPoint(0, 0, false, "endpoint"), addPoint(120, 0, false, "endpoint"),
        addPoint(120, 80, false, "endpoint"), addPoint(0, 80, false, "endpoint"),
      ];
      addLine(corners[0], corners[1]);
      addLine(corners[1], corners[2]);
      addLine(corners[2], corners[3]);
      addLine(corners[3], corners[0]);
      addCircle(addPoint(60, 40, false, "center"), 20, false);
      const face = findHatchFaceInIndex(createHatchRegionIndex(hatchPrimitivesForScope(currentScope(), DEFAULT_SKETCH_ID)), { x: 20, y: 40 });
      currentScope().hatches.push({ id: "H1", sketchId: DEFAULT_SKETCH_ID, seed: { x: 20, y: 40 }, boundaryLoops: face.boundaryLoops, appearance: { ...DEFAULT_HATCH_APPEARANCE, patternType: "solid", color: "#0f766e" } });
      currentScope().nextHatchIndex = 2;
      fitSketchToViewport(activeSketchId(), 160);
      resetHistory("solid hatch hole test");
      updateUI();
      draw();
      const rect = canvas.getBoundingClientRect();
      const clientPoint = (point) => {
        const screen = worldToCanvasScreen(point);
        return { x: rect.left + screen.x, y: rect.top + screen.y };
      };
      return { fillClient: clientPoint({ x: 20, y: 40 }), holeClient: clientPoint({ x: 65, y: 40 }) };
    }

    function state() {
      return {
        mode: readMode(),
        projected: allHatches().filter(hatch => hatch.derivedProjection).map(hatch => ({ id: hatch.id,
          valid: resolvedHatchBoundary(hatch).ok, area: resolvedHatchBoundary(hatch).area,
          seed: hatch.seed, appearance: hatch.appearance, loops: resolvedHatchBoundary(hatch).loops })),
        direct: currentScope().hatches.map((hatch) => {
          const resolved = resolvedHatchBoundary(hatch);
          return { ...serializeHatch(hatch), valid: resolved.ok, reason: resolved.ok ? null : hatchRegionErrorText(resolved) };
        }),
        selectedIds: canvasSelection.hatches.map((hatch) => hatch.id),
        preview: hatchCommand.preview ? { ok: Boolean(hatchCommand.preview.result?.ok), code: hatchCommand.preview.result?.code || null } : null,
        serialized: serializeModel(),
        treeHatchRows: document.querySelectorAll('#sketchList [data-object-kind="hatch"]').length,
        propertiesText: document.getElementById("propertiesPanel")?.textContent || "",
        spacingWorldAtScale: currentScope().hatches[0] ? currentScope().hatches[0].appearance.spacing * HATCH_SCREEN_PX_PER_MM / viewport.scale : null,
      };
    }

    function setScale(scale) {
      viewport.update({ scale: Math.max(0.01, Number(scale) || 1) });
      draw();
      return currentScope().hatches[0] ? currentScope().hatches[0].appearance.spacing * HATCH_SCREEN_PX_PER_MM / viewport.scale : null;
    }

    function breakBoundary() {
      if (!currentScope().lines.length) return false;
      currentScope().lines.splice(0, 1);
      updateUI({ refreshAnalysis: false });
      draw();
      return true;
    }

    function restoreBoundary() {
      const first = currentScope().points.find((point) => Math.abs(point.x) < 1e-9 && Math.abs(point.y) < 1e-9);
      const second = currentScope().points.find((point) => Math.abs(point.x - 120) < 1e-9 && Math.abs(point.y) < 1e-9);
      if (!first || !second) return null;
      const line = addLine(first, second);
      updateUI({ refreshAnalysis: false });
      draw();
      const rect = canvas.getBoundingClientRect();
      const screen = worldToCanvasScreen({ x: 60, y: 40 });
      return { id: line?.id || null, client: { x: rect.left + screen.x, y: rect.top + screen.y } };
    }
    return Object.freeze({ reset, resetSolidHole, state, setScale, breakBoundary, restoreBoundary });
  }
  window.HatchTestDriver = Object.freeze({ create });
})();
