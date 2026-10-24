/* Drawing-order browser fixtures and interaction observations with separate dependencies. */
(() => {
  "use strict";
  const { createRegionIndex: createHatchRegionIndex, findFaceInIndex: findHatchFaceInIndex } = window.HatchRegionEngine;
  function createFixture({ drawingOrder, resetModelState, viewport, addPoint, addLine, currentScope, hatchGeometryQuery,
    DEFAULT_SKETCH_ID, DEFAULT_HATCH_APPEARANCE, ROOT_SKETCH_ID, createEmptyBlockDefinition, Point, Line,
    appendDefinition, normalizeGeometryInstance, geometryRefForItem,
    invalidateBlockProjectionCache, fitSketchToViewport, resetHistory, updateUI, draw, canvas, worldToCanvasScreen, serializeModel }) {
    const { ensureDrawingOrderState } = drawingOrder;
    const { hatchPrimitivesForScope } = hatchGeometryQuery;
    function reset() {
      resetModelState();
      viewport.update({ scale: 3 });
      const corners = [
        addPoint(0, 0, false, "endpoint"), addPoint(120, 0, false, "endpoint"),
        addPoint(120, 80, false, "endpoint"), addPoint(0, 80, false, "endpoint"),
      ];
      const boundaryLines = [[0, 1], [1, 2], [2, 3], [3, 0]].map(([first, second]) => {
        const line = addLine(corners[first], corners[second]);
        line.appearance = { color: "#008000", lineWidth: 4 };
        return line;
      });
      const face = findHatchFaceInIndex(createHatchRegionIndex(hatchPrimitivesForScope(currentScope(), DEFAULT_SKETCH_ID)), { x: 60, y: 40 });
      const crossLine = addLine(addPoint(20, 40, false, "endpoint"), addPoint(100, 40, false, "endpoint"));
      crossLine.appearance = { color: "#ff0000", lineWidth: 4 };
      const hatch = {
        id: "H1",
        sketchId: DEFAULT_SKETCH_ID,
        drawingOrder: null,
        seed: { x: 60, y: 25 },
        boundaryLoops: face.boundaryLoops,
        appearance: { ...DEFAULT_HATCH_APPEARANCE, patternType: "solid", color: "#0000ff", opacity: 1 },
      };
      currentScope().hatches.push(hatch);
      currentScope().nextHatchIndex = 2;

      const definition = createEmptyBlockDefinition("Drawing Order Block");
      const bp1 = new Point("BP1", 20, 62, false, "endpoint");
      const bp2 = new Point("BP2", 45, 62, false, "endpoint");
      bp1.sketchId = DEFAULT_SKETCH_ID;
      bp2.sketchId = DEFAULT_SKETCH_ID;
      const blockLine = new Line("BL1", bp1, bp2);
      blockLine.sketchId = DEFAULT_SKETCH_ID;
      definition.points.push(bp1, bp2);
      definition.lines.push(blockLine);
      appendDefinition(definition);
      const block = { id: "BI1", definitionId: definition.id, sketchId: DEFAULT_SKETCH_ID, x: 0, y: 0, rotation: 0, fixed: false, rotationLocked: false, enabledSketchIds: [DEFAULT_SKETCH_ID], appearanceOverride: {} };
      currentScope().blockInstances.push(block);
      const derived = normalizeGeometryInstance({ id: "MI1", type: "mirror", sketchId: DEFAULT_SKETCH_ID, sources: [geometryRefForItem(crossLine)], axis: geometryRefForItem(boundaryLines[3]), appearanceOverride: {} });
      currentScope().geometryInstances.push(derived);

      currentScope().sketches.push({ id: "S2", name: "Other Sketch", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {}, visible: true });
      currentScope().activeSketchId = "S2";
      const otherLine = addLine(addPoint(15, 65, false, "endpoint"), addPoint(105, 65, false, "endpoint"));
      currentScope().activeSketchId = DEFAULT_SKETCH_ID;
      ensureDrawingOrderState(currentScope());
      invalidateBlockProjectionCache();
      fitSketchToViewport(DEFAULT_SKETCH_ID, 160);
      resetHistory("drawing order test");
      updateUI();
      draw();
      const rect = canvas.getBoundingClientRect();
      const client = (point) => {
        const screen = worldToCanvasScreen(point);
        return { x: rect.left + screen.x, y: rect.top + screen.y };
      };
      return {
        hatchClient: client({ x: 60, y: 25 }),
        centerClient: client({ x: 60, y: 40 }),
        boundaryClient: client({ x: 60, y: 0 }),
        insideBoundaryClient: client({ x: 60, y: 3 }),
        crossLineId: crossLine.id,
        otherLineId: otherLine.id,
        serialized: serializeModel(),
      };
    }
    return Object.freeze({ reset });
  }

  function createInteraction({ drawingOrder, currentScope, hatchGeometryQuery, isRootSketch, serializeModel, readHistory,
    clearSelection, canvasSelection, updateUI, draw, reorderSelectedDrawingObjects }) {
    const { ensureDrawingOrderState, drawingOrderItemsForScope } = drawingOrder;
    const { resolvedHatchBoundary, hatchBoundaryHitExclusionScreenPx, hatchContainsSelectablePoint } = hatchGeometryQuery;
    function state() {
      ensureDrawingOrderState(currentScope());
      const kindFor = (item) => currentScope().hatches.includes(item) ? "hatch"
        : currentScope().lines.includes(item) ? "line"
        : currentScope().circles.includes(item) ? "circle"
        : currentScope().arcs.includes(item) ? "arc"
        : currentScope().splines.includes(item) ? "spline"
        : currentScope().blockInstances.includes(item) ? "block"
        : "geometry-instance";
      const bySketch = Object.fromEntries(currentScope().sketches.filter((sketch) => !isRootSketch(sketch)).map((sketch) => [sketch.id,
        drawingOrderItemsForScope(currentScope(), sketch.id)
          .slice()
          .sort((a, b) => a.drawingOrder - b.drawingOrder)
          .map((item) => ({ kind: kindFor(item), id: item.id, drawingOrder: item.drawingOrder })),
      ]));
      const firstHatch = currentScope().hatches[0] || null;
      const resolved = firstHatch ? resolvedHatchBoundary(firstHatch) : null;
      return {
        bySketch,
        serialized: structuredClone(serializeModel()),
        hatchBoundaryHitExclusionScreenPx: firstHatch ? hatchBoundaryHitExclusionScreenPx(firstHatch) : null,
        hatchSelectableAtBoundary: firstHatch && resolved ? hatchContainsSelectablePoint(firstHatch, resolved, { x: 60, y: 0 }) : null,
        history: readHistory(),
      };
    }

    function select(kind, id) {
      clearSelection();
      if (kind === "line") canvasSelection.set("lines", currentScope().lines.filter((item) => item.id === id));
      else if (kind === "hatch") canvasSelection.set("hatches", currentScope().hatches.filter((item) => item.id === id));
      else if (kind === "block") canvasSelection.set("blockInstances", currentScope().blockInstances.filter((item) => item.id === id));
      else if (kind === "geometry-instance") canvasSelection.set("geometryInstances", currentScope().geometryInstances.filter((item) => item.id === id));
      updateUI({ refreshAnalysis: false });
      draw();
      return state();
    }

    function reorder(action) {
      reorderSelectedDrawingObjects(action);
      return state();
    }
    return Object.freeze({ state, select, reorder });
  }
  function createBrowserApi({
    drawingOrder, resetModelState, viewport, addPoint, addLine, currentScope,
    hatchGeometryQuery, DEFAULT_SKETCH_ID, DEFAULT_HATCH_APPEARANCE, ROOT_SKETCH_ID, createEmptyBlockDefinition, Point,
    Line, appendDefinition, normalizeGeometryInstance, geometryRefForItem, invalidateBlockProjectionCache, fitSketchToViewport,
    resetHistory, updateUI, draw, canvas, worldToCanvasScreen, serializeModel,
    isRootSketch, readHistory, clearSelection, canvasSelection, reorderSelectedDrawingObjects
  }) {
    const drawingOrderFixture = createFixture({ drawingOrder, resetModelState, viewport, addPoint, addLine, currentScope, hatchGeometryQuery, DEFAULT_SKETCH_ID, DEFAULT_HATCH_APPEARANCE, ROOT_SKETCH_ID, createEmptyBlockDefinition, Point, Line, appendDefinition, normalizeGeometryInstance, geometryRefForItem, invalidateBlockProjectionCache, fitSketchToViewport, resetHistory, updateUI, draw, canvas, worldToCanvasScreen, serializeModel });
    const drawingOrderInteraction = createInteraction({ drawingOrder, currentScope, hatchGeometryQuery, isRootSketch, serializeModel, readHistory, clearSelection, canvasSelection, updateUI, draw, reorderSelectedDrawingObjects });
    return Object.freeze({
      resetForDrawingOrderTest: drawingOrderFixture.reset,
      drawingOrderStateForTest: drawingOrderInteraction.state,
      selectDrawingOrderObjectForTest: drawingOrderInteraction.select,
      reorderDrawingOrderForTest: drawingOrderInteraction.reorder
    });
  }

  window.DrawingOrderTestDriver = Object.freeze({ createBrowserApi, createFixture, createInteraction });
})();
