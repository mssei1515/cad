/* Clipboard browser fixtures and observations without duplicate session state. */
(() => {
  "use strict";
  function createSupport({ currentScope, serializeModel, sketchContext, readSelected, canvasSelection, clipboardSession, readHistory,
    resetModelState, viewport, geometry, types, dimensionFromAnchor, arcEndpointPoint, rootSketchId, defaultSketchId,
    createEmptyBlockDefinition, appendDefinition, nextInstanceId, invalidateBlockProjectionCache, blockProjectionBundle,
    pushModelConstraint, resetHistory, updateUI, draw }) {
    const { isRootSketch, elementSketchId, activeSketchId } = sketchContext;
    const { addPoint, addLine, addCircle, addArc } = geometry;
    const { Point, Line, HorizontalConstraint, DistanceConstraint, RadiusConstraint, EqualRadiusConstraint,
      PointVerticalConstraint, LineFixedConstraint, ArcEndpointFixedConstraint } = types;
    const observation = createObservation({ currentScope, serializeModel, isRootSketch, elementSketchId, activeSketchId,
      readSelected, canvasSelection, clipboardSession, readHistory });
    const geometryFixture = createGeometryFixture({ resetModelState, clipboardSession, viewport, currentScope, ROOT_SKETCH_ID: rootSketchId,
      addPoint, addLine, addCircle, addArc, pushModelConstraint, HorizontalConstraint, DistanceConstraint, RadiusConstraint, EqualRadiusConstraint,
      PointVerticalConstraint, LineFixedConstraint, ArcEndpointFixedConstraint, dimensionFromAnchor, arcEndpointPoint,
      canvasSelection, resetHistory, updateUI, draw, readState: observation.state });
    const blockFixture = createBlockFixture({ resetModelState, clipboardSession, viewport, currentScope, ROOT_SKETCH_ID: rootSketchId,
      createEmptyBlockDefinition, Point, Line, HorizontalConstraint, DEFAULT_SKETCH_ID: defaultSketchId, appendDefinition, nextInstanceId,
      invalidateBlockProjectionCache, blockProjectionBundle, pushModelConstraint, canvasSelection, resetHistory, updateUI, draw, readState: observation.state });
    return Object.freeze({ resetForGeometryClipboardTest: geometryFixture.reset, resetForBlockClipboardTest: blockFixture.reset,
      clipboardStateForTest: observation.state });
  }
  function createObservation({ currentScope, serializeModel, isRootSketch, elementSketchId, activeSketchId,
    readSelected, canvasSelection, clipboardSession, readHistory }) {
    function state() {
      const serialized = serializeModel();
      const geometryBySketch = Object.fromEntries(currentScope().sketches.filter((sketch) => !isRootSketch(sketch)).map((sketch) => [sketch.id, {
        points: currentScope().points.filter((item) => elementSketchId(item) === sketch.id).map((item) => ({ id: item.id, x: item.x, y: item.y, kind: item.kind, fixed: Boolean(item.fixed) })),
        lines: currentScope().lines.filter((item) => elementSketchId(item) === sketch.id).map((item) => ({ id: item.id, p1: item.p1.id, p2: item.p2.id })),
        circles: currentScope().circles.filter((item) => elementSketchId(item) === sketch.id).map((item) => ({ id: item.id, center: item.center.id, radius: item.radius() })),
        arcs: currentScope().arcs.filter((item) => elementSketchId(item) === sketch.id).map((item) => ({ id: item.id, center: item.center.id, radius: item.radius() })),
        splines: currentScope().splines.filter((item) => elementSketchId(item) === sketch.id).map((item) => ({ id: item.id, fitPoints: item.fitPoints.map((point) => point.id), closed: item.closed })),
        blockInstances: currentScope().blockInstances.filter((item) => item.sketchId === sketch.id).map((item) => ({ id: item.id, x: item.x, y: item.y, definitionId: item.definitionId, fixed: Boolean(item.fixed), rotationLocked: Boolean(item.rotationLocked) })),
      }]));
      return {
        activeSketchId: activeSketchId(),
        geometryBySketch,
        constraints: serialized.constraints.map((item) => ({ type: item.type, sketchId: item.sketchId, line: item.line || null, reference: Boolean(item.reference), dimension: item.dimension || null })),
        selected: readSelected(),
        selectedBlockInstanceIds: canvasSelection.blockInstances.map((item) => item.id),
        clipboard: clipboardSession.payload ? {
          pasteCount: clipboardSession.payload.pasteCount,
          points: clipboardSession.payload.points.length,
          lines: clipboardSession.payload.lines.length,
          circles: clipboardSession.payload.circles.length,
          arcs: clipboardSession.payload.arcs.length,
          splines: clipboardSession.payload.splines.length,
          constraints: clipboardSession.payload.constraints.length,
          blockInstances: clipboardSession.payload.blockInstances.length,
        } : null,
        history: readHistory(),
      };
    }
    return Object.freeze({ state });
  }

  function createGeometryFixture({ resetModelState, clipboardSession, viewport, currentScope, ROOT_SKETCH_ID, addPoint, addLine, addCircle, addArc,
    pushModelConstraint, HorizontalConstraint, DistanceConstraint, RadiusConstraint, EqualRadiusConstraint,
    PointVerticalConstraint, LineFixedConstraint, ArcEndpointFixedConstraint, dimensionFromAnchor, arcEndpointPoint,
    canvasSelection, resetHistory, updateUI, draw, readState }) {
    function reset() {
      resetModelState();
      clipboardSession.clear();
      viewport.update({ scale: 1 });
      currentScope().sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
      const p1 = addPoint(-120, -30, true, "endpoint");
      const p2 = addPoint(-20, -30, false, "endpoint");
      const line = addLine(p1, p2, true);
      const circleCenter = addPoint(50, -30, false, "endpoint");
      const circle = addCircle(circleCenter, 25);
      const arcCenter = addPoint(125, -30, false, "endpoint");
      const arc = addArc(arcCenter, 30, 0, Math.PI * 1.5);
      const standalone = addPoint(205, -30, false, "explicit");
      const external = addPoint(-20, 40, false, "explicit");
      pushModelConstraint(new HorizontalConstraint(line));
      const length = pushModelConstraint(new DistanceConstraint(p1, p2, 100));
      length.dimension = dimensionFromAnchor({ kind: "line-length", line, p1, p2, value: 100 }, { x: -70, y: -58 });
      pushModelConstraint(new RadiusConstraint(circle, 25));
      pushModelConstraint(new EqualRadiusConstraint(circle, arc));
      pushModelConstraint(new PointVerticalConstraint(p2, external));
      pushModelConstraint(new LineFixedConstraint(line, p1.x, p1.y, p2.x, p2.y));
      const fixedArcEndpoint = arcEndpointPoint(arc, "start");
      pushModelConstraint(new ArcEndpointFixedConstraint(arc, "start", fixedArcEndpoint.x, fixedArcEndpoint.y));
      canvasSelection.set("points", [standalone]);
      canvasSelection.set("lines", [line]);
      canvasSelection.set("circles", [circle]);
      canvasSelection.set("arcs", [arc]);
      resetHistory("clipboard geometry test");
      updateUI();
      draw();
      return readState();
    }
    return Object.freeze({ reset });
  }

  function createBlockFixture({ resetModelState, clipboardSession, viewport, currentScope, ROOT_SKETCH_ID,
    createEmptyBlockDefinition, Point, Line, HorizontalConstraint, DEFAULT_SKETCH_ID, appendDefinition, nextInstanceId,
    invalidateBlockProjectionCache, blockProjectionBundle, pushModelConstraint, canvasSelection, resetHistory, updateUI, draw, readState }) {
    function reset() {
      resetModelState();
      clipboardSession.clear();
      viewport.update({ scale: 1 });
      currentScope().sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
      const definition = createEmptyBlockDefinition("Clipboard Block");
      const bp1 = new Point("BP1", 0, 0, false, "endpoint");
      const bp2 = new Point("BP2", 80, 0, false, "endpoint");
      bp1.sketchId = DEFAULT_SKETCH_ID;
      bp2.sketchId = DEFAULT_SKETCH_ID;
      const blockLine = new Line("BL1", bp1, bp2);
      blockLine.sketchId = DEFAULT_SKETCH_ID;
      definition.points.push(bp1, bp2);
      definition.lines.push(blockLine);
      definition.constraints.push(Object.assign(new HorizontalConstraint(blockLine), { sketchId: DEFAULT_SKETCH_ID }));
      appendDefinition(definition);
      const instance = { id: nextInstanceId(), definitionId: definition.id, sketchId: DEFAULT_SKETCH_ID, x: 10, y: 20, rotation: 0, fixed: true, rotationLocked: true, enabledSketchIds: [DEFAULT_SKETCH_ID] };
      currentScope().blockInstances.push(instance);
      invalidateBlockProjectionCache();
      const projectionLine = blockProjectionBundle(instance).lines[0];
      pushModelConstraint(new HorizontalConstraint(projectionLine));
      canvasSelection.set("blockInstances", [instance]);
      resetHistory("clipboard block test");
      updateUI();
      draw();
      return readState();
    }
    return Object.freeze({ reset });
  }
  window.ClipboardTestDriver = Object.freeze({ createSupport, createObservation, createGeometryFixture, createBlockFixture });
})();
