/* Canvas selection browser fixtures and observations delegate selection rules to existing owners. */
(() => {
  "use strict";
  function createOverlapFixture({ resetModelState, addLine, addPoint, currentScope, ROOT_SKETCH_ID, DEFAULT_SKETCH_ID, createEmptyBlockDefinition, Point, Line, appendDefinition, nextInstanceId, invalidateBlockProjectionCache, canvasSelection, fitSketchToViewport, activeSketchId, resetHistory, updateUI, draw, clientPosition }) {
    function reset() {
      resetModelState();
      const first = addLine(addPoint(-70, 0, false, "endpoint"), addPoint(70, 0, false, "endpoint"));
      const second = addLine(addPoint(-70, 0, false, "endpoint"), addPoint(70, 0, false, "endpoint"));
      const hidden = addLine(addPoint(-70, 0, false, "endpoint"), addPoint(70, 0, false, "endpoint"));
      hidden.appearance = { visible: false };
      currentScope().sketches.push({ id: "S2", name: "Inactive", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {} });
      currentScope().activeSketchId = "S2";
      const inactive = addLine(addPoint(-70, 0, false, "endpoint"), addPoint(70, 0, false, "endpoint"));
      currentScope().activeSketchId = DEFAULT_SKETCH_ID;

      const definition = createEmptyBlockDefinition("Overlapping Block");
      for (let index = 0; index < 2; index += 1) {
        const p1 = new Point(`BP${index * 2 + 1}`, -70, 0, false, "endpoint");
        const p2 = new Point(`BP${index * 2 + 2}`, 70, 0, false, "endpoint");
        p1.sketchId = DEFAULT_SKETCH_ID;
        p2.sketchId = DEFAULT_SKETCH_ID;
        const line = new Line(`BL${index + 1}`, p1, p2);
        line.sketchId = DEFAULT_SKETCH_ID;
        definition.points.push(p1, p2);
        definition.lines.push(line);
      }
      appendDefinition(definition);
      const block = {
        id: nextInstanceId(),
        definitionId: definition.id,
        sketchId: DEFAULT_SKETCH_ID,
        x: 0,
        y: 0,
        rotation: 0,
        fixed: false,
        rotationLocked: false,
        enabledSketchIds: [DEFAULT_SKETCH_ID],
        appearanceOverride: {},
      };
      currentScope().blockInstances.push(block);
      invalidateBlockProjectionCache();
      canvasSelection.set("lines", [first, second]);
      fitSketchToViewport(activeSketchId(), 220);
      resetHistory("overlapping context selection test");
      updateUI();
      draw();
      return {
        client: clientPosition({ x: 0, y: 0 }),
        lineIds: [first.id, second.id],
        blockId: block.id,
        excludedIds: [hidden.id, inactive.id],
      };
    }
    return Object.freeze({ reset });
  }

  function createEndpointFixture({ resetModelState, addPoint, addLine, addArc, fitSketchToViewport, activeSketchId, resetHistory, updateUI, draw, clientPosition, arcEndpointPoint }) {
    function reset() {
      resetModelState();
      const lineStart = addPoint(0, 0, false, "endpoint");
      const lineEnd = addPoint(60, 0, false, "endpoint");
      addLine(lineStart, lineEnd);
      const first = addArc(addPoint(0, 20, false, "center"), 20, -Math.PI / 2, 0);
      const second = addArc(addPoint(60, 20, false, "center"), 20, -Math.PI / 2, 0);
      fitSketchToViewport(activeSketchId(), 180);
      resetHistory("arc endpoint constraint selection test");
      updateUI();
      draw();
      return {
        first: clientPosition(arcEndpointPoint(first, "start")),
        second: clientPosition(arcEndpointPoint(second, "start")),
        firstArcId: first.id,
        secondArcId: second.id,
        lineStartId: lineStart.id,
      };
    }
    return Object.freeze({ reset });
  }

  function createObservation({ canvasHover, canvasContextMenu, canvasContextController, canvasContextCandidatePresentation, readSelectedGeometry }) {
    function state() {
      const hover = canvasHover.current.point || canvasHover.current.endpointPoint || canvasHover.current.line || canvasHover.current.circle || canvasHover.current.arc || canvasHover.current.spline || canvasHover.current.dimension || canvasHover.current.block || canvasHover.current.annotation || canvasHover.current.hatch;
      return {
        menuOpen: Boolean(canvasContextMenu && !canvasContextMenu.hidden),
        candidates: canvasContextController.candidates().map((target) => {
          const presentation = canvasContextCandidatePresentation(target);
          return { kind: target.kind, id: presentation.id, type: presentation.type, secondary: presentation.secondary };
        }),
        hovered: hover?.id || hover?.parameterName || null,
        hoveredArcEndpoint: canvasHover.current.arcEndpoint ? { id: canvasHover.current.arcEndpoint.arc.id, endpoint: canvasHover.current.arcEndpoint.endpoint } : null,
        selected: readSelectedGeometry(),
      };
    }
    return Object.freeze({ state });
  }

  function createPointInsertion({ canvas, viewport, addPoint, updateUI, draw, clientPosition }) {
    function addFixedPoint(client) {
      const rect = canvas.getBoundingClientRect();
      const point = addPoint(
        (Number(client?.x) - rect.left - viewport.x) / viewport.scale,
        (Number(client?.y) - rect.top - viewport.y) / viewport.scale,
        true,
        "explicit",
      );
      updateUI();
      draw();
      return { id: point.id, client: clientPosition(point) };
    }
    return Object.freeze({ addFixedPoint });
  }
  window.CanvasSelectionTestDriver = Object.freeze({ createOverlapFixture, createEndpointFixture, createObservation, createPointInsertion });
})();
