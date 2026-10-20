/* Browser-test Canvas dash isolation separates draft, Block and observation dependencies. */
(() => {
  "use strict";
  function createDraftDashCases({ setMode, lineCommand, rectangleCommand, slotCommand, circularCommands, offsetSelection, drawingPreview, addLine, addPoint, drawTemporaryLine, drawRectanglePreview, drawSlotPreview, drawCirclePreview, drawArcPreview, drawOffsetPreview, drawTrimPreview }) {
    function run(capture) {
      capture("line", () => {
        setMode("line");
        lineCommand.click({ x: 0, y: 0 });
        lineCommand.startPoint.fixed = true;
        drawingPreview.setPointer({ x: 80, y: 0 });
      }, drawTemporaryLine);
      capture("rectangle", () => {
        setMode("rectangle");
        rectangleCommand.click({ x: 0, y: 0 }, null);
        drawingPreview.setPointer({ x: 80, y: 45 });
      }, drawRectanglePreview);
      capture("slot", () => {
        setMode("slot");
        slotCommand.click({ x: 0, y: 0 }, null);
        slotCommand.click({ x: 80, y: 0 }, null);
        drawingPreview.setPointer({ x: 40, y: 20 });
      }, drawSlotPreview);
      capture("circle", () => {
        setMode("circle");
        circularCommands.clickCircle({ x: 0, y: 0 }, null);
        Object.assign(circularCommands.circleCenterPoint, { fixed: true, kind: "center" });
        drawingPreview.setPointer({ x: 35, y: 0 });
      }, drawCirclePreview);
      capture("arc", () => {
        setMode("arc");
        circularCommands.clickArc({ x: 0, y: 0 }, null);
        Object.assign(circularCommands.arcCenterPoint, { fixed: true, kind: "center" });
        circularCommands.clickArc({ x: 35, y: 0 }, null);
        drawingPreview.setPointer({ x: 0, y: 35 });
      }, drawArcPreview);
      capture("offset", () => {
        setMode("offset");
        offsetSelection.selectSource(addLine(addPoint(0, 0, true, "endpoint"), addPoint(80, 0, true, "endpoint")));
        drawingPreview.setPointer({ x: 40, y: 20 });
      }, drawOffsetPreview);
      capture("trim", () => {
        setMode("trim");
        drawingPreview.setTrim({
          kind: "line",
          interval: {
            left: { point: { x: 0, y: 0 } },
            right: { point: { x: 80, y: 0 } },
          },
        });
      }, drawTrimPreview);
    }
    return Object.freeze({ run });
  }

  function createBlockDashCases({ createEmptyBlockDefinition, Point, Line, defaultSketchId, appendDefinition, setMode, blockPlacementCommand, drawingPreview, activeSketchId, currentScope, canvasSelection, drawBlockPlacementPreview, drawBlockInstanceHandles }) {
      const makeBlockDefinition = () => {
        const definition = createEmptyBlockDefinition("Block-Dash");
        const p1 = new Point("BP1", 0, 0, false, "endpoint");
        const p2 = new Point("BP2", 40, 0, false, "endpoint");
        p1.sketchId = defaultSketchId;
        p2.sketchId = defaultSketchId;
        const line = new Line("BL1", p1, p2);
        line.sketchId = defaultSketchId;
        definition.points.push(p1, p2);
        definition.lines.push(line);
        appendDefinition(definition);
        return definition;
      };

    function run(capture) {
      capture("blockPlacement", () => {
        const definition = makeBlockDefinition();
        setMode("block-place");
        blockPlacementCommand.prepare(definition.id, [defaultSketchId]);
        drawingPreview.setPointer({ x: 120, y: 40 });
      }, drawBlockPlacementPreview);
      capture("blockHandles", () => {
        const definition = makeBlockDefinition();
        const instance = { id: "BI-DASH", definitionId: definition.id, sketchId: activeSketchId(), x: 20, y: 20, rotation: 0, fixed: false, enabledSketchIds: [defaultSketchId] };
        currentScope().blockInstances.push(instance);
        canvasSelection.set("blockInstances", [instance]);
      }, drawBlockInstanceHandles);
    }
    return Object.freeze({ run });
  }

  function createDashIsolation({ resetModelState, viewport, drawingPreview, selectionRectangle, setMode, ctx, drawSelectionRect, draftCases, blockCases, drawAnnotationLeader, addLine, addPoint, draw }) {
    function cases() {
      const results = {};
      const resetForCase = () => {
        resetModelState();
        viewport.update({ scale: 1 });
        viewport.update({ x: 0 });
        viewport.update({ y: 0 });
        drawingPreview.reset();
        selectionRectangle.reset();
        setMode("select");
      };
      const capture = (name, setup, drawFn) => {
        resetForCase();
        setup();
        ctx.setLineDash([13, 7]);
        drawFn();
        results[name] = ctx.getLineDash();
      };
      draftCases.run(capture);
      capture("selection", () => {
        selectionRectangle.begin({ x: 0, y: 0 }, { current: { x: 80, y: 45 } });
      }, drawSelectionRect);
      blockCases.run(capture);
      capture("annotationLeader", () => {}, () => drawAnnotationLeader({
        start: { x: 0, y: 0 },
        elbow: { x: 40, y: 15 },
        end: { x: 80, y: 15 },
        text: "note",
        style: {},
      }, true));
      capture("frame", () => {
        addLine(addPoint(0, 0, true, "endpoint"), addPoint(80, 0, true, "endpoint"));
      }, draw);
      return results;
    }
    return Object.freeze({ cases });
  }
  function createConstructionHoverFixture({ ctx, viewport, drawLines, resetModelState, addLine, addPoint, canvasHover, createEmptyBlockDefinition, Point, Line, defaultSketchId, appendDefinition, currentScope, invalidateBlockProjectionCache, blockProjectionBundle }) {
    function cases() {
      const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const captureOverhang = (line, setupHover) => {
        const segments = [];
        let start = null;
        const originalMoveTo = ctx.moveTo;
        const originalLineTo = ctx.lineTo;
        ctx.moveTo = (x, y) => {
          start = { x, y };
        };
        ctx.lineTo = (x, y) => {
          if (start) segments.push({ p1: start, p2: { x, y } });
        };
        try {
          setupHover();
          drawLines();
        } finally {
          ctx.moveTo = originalMoveTo;
          ctx.lineTo = originalLineTo;
        }
        const segment = segments[0];
        return segment ? ((distance(segment.p1, line.p1) + distance(segment.p2, line.p2)) / 2) * viewport.scale : null;
      };

      resetModelState();
      viewport.update({ scale: 2 });
      const line = addLine(addPoint(-40, 0, false, "endpoint"), addPoint(40, 0, false, "endpoint"), true);
      const direct = captureOverhang(line, () => {
        canvasHover.update({ line: line });
      });

      resetModelState();
      viewport.update({ scale: 2 });
      const definition = createEmptyBlockDefinition("Block-Construction-Hover");
      const p1 = new Point("BP1", -40, 0, false, "endpoint");
      const p2 = new Point("BP2", 40, 0, false, "endpoint");
      p1.sketchId = defaultSketchId;
      p2.sketchId = defaultSketchId;
      const localLine = new Line("BL1", p1, p2, true);
      localLine.sketchId = defaultSketchId;
      definition.points.push(p1, p2);
      definition.lines.push(localLine);
      appendDefinition(definition);
      const instance = {
        id: "BI-HOVER",
        definitionId: definition.id,
        sketchId: defaultSketchId,
        x: 0,
        y: 0,
        rotation: 0,
        fixed: false,
        rotationLocked: false,
        enabledSketchIds: [defaultSketchId],
        appearanceOverride: {},
      };
      currentScope().blockInstances.push(instance);
      invalidateBlockProjectionCache();
      const projection = blockProjectionBundle(instance).lines[0];
      const block = captureOverhang(projection, () => {
        canvasHover.update({ block: instance });
      });
      canvasHover.update({
        line: null, block: null,
      });
      return { direct, block };
    }
    return Object.freeze({ cases });
  }

  function createConstructionLineObservation({ allGeometryLines, ctx, drawLines, viewport, effectiveAppearanceForElement }) {
    function state(lineId) {
      const line = allGeometryLines().find((item) => item.id === lineId);
      if (!line) return null;
      const segments = [];
      let start = null;
      let endpointMarkerCount = 0;
      const originalMoveTo = ctx.moveTo;
      const originalLineTo = ctx.lineTo;
      const originalArc = ctx.arc;
      ctx.moveTo = (x, y) => {
        start = { x, y };
      };
      ctx.lineTo = (x, y) => {
        if (start) segments.push({ p1: start, p2: { x, y } });
      };
      ctx.arc = (...args) => {
        endpointMarkerCount += 1;
        return originalArc.apply(ctx, args);
      };
      try {
        drawLines();
      } finally {
        ctx.moveTo = originalMoveTo;
        ctx.lineTo = originalLineTo;
        ctx.arc = originalArc;
      }
      const segment = segments[0];
      const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const overhangPx = segment ? ((distance(segment.p1, line.p1) + distance(segment.p2, line.p2)) / 2) * viewport.scale : null;
      const appearance = effectiveAppearanceForElement(line);
      return {
        endpointOverhang: appearance.endpointOverhang !== false,
        endpointMarkers: appearance.endpointMarkers !== false,
        overhangPx: overhangPx == null ? null : Number(overhangPx.toFixed(6)),
        endpointMarkerCount,
      };
    }
    return Object.freeze({ state });
  }

  function createRenderingSupport({ setMode, lineCommand, rectangleCommand, slotCommand, circularCommands, offsetSelection, drawingPreview, addLine, addPoint,
    authoringPreviewLayer, offsetPreviewLayer, placementPreviewLayer, createEmptyBlockDefinition, Point, Line, defaultSketchId, appendDefinition,
    blockPlacementCommand, activeSketchId, currentScope, canvasSelection, drawBlockInstanceHandles,
    resetModelState, viewport, selectionRectangle, ctx, drawSelectionRect, drawAnnotationLeader, draw,
    drawLines, canvasHover, invalidateBlockProjectionCache, blockProjectionBundle, allGeometryLines, effectiveAppearanceForElement }) {
    const draftCases = createDraftDashCases({ setMode, lineCommand, rectangleCommand, slotCommand, circularCommands, offsetSelection, drawingPreview, addLine, addPoint,
      drawTemporaryLine: authoringPreviewLayer.drawTemporaryLine, drawRectanglePreview: authoringPreviewLayer.drawRectanglePreview,
      drawSlotPreview: authoringPreviewLayer.drawSlotPreview, drawCirclePreview: authoringPreviewLayer.drawCirclePreview,
      drawArcPreview: authoringPreviewLayer.drawArcPreview, drawOffsetPreview: offsetPreviewLayer.draw, drawTrimPreview: authoringPreviewLayer.drawTrimPreview });
    const blockCases = createBlockDashCases({ createEmptyBlockDefinition, Point, Line, defaultSketchId, appendDefinition, setMode,
      blockPlacementCommand, drawingPreview, activeSketchId, currentScope, canvasSelection,
      drawBlockPlacementPreview: placementPreviewLayer.drawBlockPlacementPreview, drawBlockInstanceHandles });
    const dash = createDashIsolation({ resetModelState, viewport, drawingPreview, selectionRectangle, setMode, ctx, drawSelectionRect,
      draftCases, blockCases, drawAnnotationLeader, addLine, addPoint, draw });
    const hover = createConstructionHoverFixture({ ctx, viewport, drawLines, resetModelState, addLine, addPoint, canvasHover, createEmptyBlockDefinition,
      Point, Line, defaultSketchId, appendDefinition, currentScope, invalidateBlockProjectionCache, blockProjectionBundle });
    const observation = createConstructionLineObservation({ allGeometryLines, ctx, drawLines, viewport, effectiveAppearanceForElement });
    return Object.freeze({ canvasDashIsolationCases: dash.cases, constructionLineHoverDisplayCasesForTest: hover.cases, constructionLineRenderingForTest: observation.state });
  }
  window.CanvasRenderTestDriver = Object.freeze({ createDraftDashCases, createBlockDashCases, createDashIsolation, createConstructionHoverFixture, createConstructionLineObservation, createRenderingSupport });
})();
