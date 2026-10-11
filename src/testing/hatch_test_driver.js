/* Hatch browser-test setup and observations; application owners retain live state. */
(() => {
  "use strict";
  const { createRegionIndex: createHatchRegionIndex, findFaceInIndex: findHatchFaceInIndex,
    resolveBoundary: resolveHatchBoundaryLoops, boundaryGeometryRefs: hatchBoundaryGeometryRefs } = window.HatchRegionEngine;
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
  function createProjection({ resetModelState, createEmptyBlockDefinition, Point, Line, DEFAULT_SKETCH_ID, DEFAULT_HATCH_APPEARANCE,
    currentScope, appendDefinitions, invalidateBlockProjectionCache, updateUI, fitAllGeometryToViewport,
    blockProjectionBundle, canvas, worldToCanvasScreen, draw, allHatches, hatchGeometryQuery, hitBlockInstance, serializeModel }) {
    const { hatchPrimitivesForScope, resolvedHatchBoundary } = hatchGeometryQuery;
    function reset() {
      resetModelState();
      const child = createEmptyBlockDefinition("Hatch Child");
      const childPoints = [
        new Point("P1", 0, 0, false, "endpoint"), new Point("P2", 100, 0, false, "endpoint"),
        new Point("P3", 100, 60, false, "endpoint"), new Point("P4", 0, 60, false, "endpoint"),
      ];
      childPoints.forEach((point) => { point.sketchId = DEFAULT_SKETCH_ID; });
      child.points.push(...childPoints);
      [[0, 1], [1, 2], [2, 3], [3, 0]].forEach(([a, b], index) => {
        const line = new Line(`L${index + 1}`, childPoints[a], childPoints[b]);
        line.sketchId = DEFAULT_SKETCH_ID;
        child.lines.push(line);
      });
      const face = findHatchFaceInIndex(createHatchRegionIndex(hatchPrimitivesForScope(child, DEFAULT_SKETCH_ID)), { x: 50, y: 30 });
      child.hatches = [{ id: "H1", sketchId: DEFAULT_SKETCH_ID, seed: { x: 50, y: 30 }, boundaryLoops: face.boundaryLoops, appearance: { ...DEFAULT_HATCH_APPEARANCE, patternType: "cross" } }];
      child.nextHatchIndex = 2;

      const parent = createEmptyBlockDefinition("Hatch Parent");
      child.parentDefinitionId = parent.id;
      parent.blockInstances.push({ id: "BI_INNER", definitionId: child.id, sketchId: DEFAULT_SKETCH_ID, x: 20, y: 10, rotation: Math.PI / 6, fixed: false, rotationLocked: false, enabledSketchIds: [DEFAULT_SKETCH_ID], appearanceOverride: {} });
      appendDefinitions(child, parent);
      const instance = { id: "BI1", definitionId: parent.id, sketchId: DEFAULT_SKETCH_ID, x: 240, y: 180, rotation: Math.PI / 2, fixed: false, rotationLocked: false, enabledSketchIds: [DEFAULT_SKETCH_ID], appearanceOverride: { color: "#db2777", lineWidth: 3, visible: true } };
      currentScope().blockInstances.push(instance);
      invalidateBlockProjectionCache();
      updateUI();
      fitAllGeometryToViewport(160);
      const projected = blockProjectionBundle(instance).hatches[0];
      const rect = canvas.getBoundingClientRect();
      const screen = worldToCanvasScreen(projected.seed);
      draw();
      return {
        projected: { id: projected.id, patternType: projected.appearance.patternType, angle: projected.appearance.angle, color: projected.appearance.color, lineWidth: projected.appearance.lineWidth, valid: resolvedHatchBoundary(projected).ok },
        ownerAtSeed: hitBlockInstance(projected.seed.x, projected.seed.y)?.id || null,
        client: { x: rect.left + screen.x, y: rect.top + screen.y },
        serialized: serializeModel(),
      };
    }
    function state() {
      const projected = allHatches().find((hatch) => hatch.blockProjection) || null;
      return projected ? { id: projected.id, patternType: projected.appearance.patternType, angle: projected.appearance.angle, color: projected.appearance.color, lineWidth: projected.appearance.lineWidth, valid: resolvedHatchBoundary(projected).ok, ownerId: projected.blockInstance?.id || null } : null;
    }
    return Object.freeze({ reset, state });
  }

  function createTransfer({ currentScope, clearSelection, canvasSelection, copyableSelectionPayload, clipboardSession, pasteGeometryClipboard,
    geometryRefId, blockSelectionGeometry, createBlockDefinitionFromSelection, blockSelectionBoundsCenter, hatchGeometryQuery }) {
    const { hatchPrimitivesForScope, resolvedHatchBoundary } = hatchGeometryQuery;
    function exercise() {
      const hatch = currentScope().hatches[0];
      const boundaryLines = currentScope().lines.slice();
      clearSelection();
      canvasSelection.set("hatches", hatch ? [hatch] : []);
      const missingCopyAccepted = Boolean(copyableSelectionPayload());
      canvasSelection.set("lines", boundaryLines);
      const payload = copyableSelectionPayload();
      clipboardSession.replaceForDiagnostics(payload);
      const pasteAccepted = Boolean(payload && pasteGeometryClipboard());
      const pasted = currentScope().hatches.find((item) => item !== hatch);
      const pastedRefs = pasted ? hatchBoundaryGeometryRefs(pasted.boundaryLoops).map(geometryRefId) : [];

      clearSelection();
      canvasSelection.set("hatches", hatch ? [hatch] : []);
      const missingBlock = blockSelectionGeometry();
      canvasSelection.set("lines", boundaryLines);
      const selection = blockSelectionGeometry();
      const definition = selection.error ? null : createBlockDefinitionFromSelection(selection, blockSelectionBoundsCenter(selection), "Hatch Transfer");
      const blockHatch = definition?.hatches?.[0] || null;
      const blockBoundary = blockHatch ? resolveHatchBoundaryLoops(blockHatch.boundaryLoops, hatchPrimitivesForScope(definition, blockHatch.sketchId)) : null;
      return {
        missingCopyAccepted,
        pasteAccepted,
        pasted: pasted ? { id: pasted.id, refs: pastedRefs, valid: resolvedHatchBoundary(pasted).ok } : null,
        missingBlockError: missingBlock.error || null,
        block: blockHatch ? { id: blockHatch.id, valid: Boolean(blockBoundary?.ok) } : null,
      };
    }
    return Object.freeze({ exercise });
  }
  window.HatchTestDriver = Object.freeze({ create, createProjection, createTransfer });
})();
