/* Browser-test Sketch Tree fixtures delegate geometry, ownership and display to product owners. */
(() => {
  "use strict";
  function createRootHoverFixture({ resetModelState, addPoint, addLine, addCircle, addArc, currentScope, rootSketchId, createEmptyBlockDefinition, Point, Line, defaultSketchId, appendDefinition, nextInstanceId, invalidateBlockProjectionCache, updateUI, fitAllGeometryToViewport, draw }) {
    function reset() {
      resetModelState();
      const p1 = addPoint(-110, -45, false, "endpoint");
      const p2 = addPoint(-30, -45, false, "endpoint");
      const line = addLine(p1, p2);

      const secondSketchId = "S2";
      const childSketchId = "S3";
      currentScope().sketches.push({ id: secondSketchId, name: "Sketch-2", parentSketchId: rootSketchId, kind: "sketch", appearance: {} });
      currentScope().activeSketchId = secondSketchId;
      const circle = addCircle(addPoint(45, -35, false, "center"), 24);

      currentScope().sketches.push({ id: childSketchId, name: "Sketch-2-1", parentSketchId: secondSketchId, kind: "sketch", appearance: {} });
      currentScope().activeSketchId = childSketchId;
      const arc = addArc(addPoint(55, 55, false, "center"), 30, Math.PI, Math.PI * 1.8);

      const definition = createEmptyBlockDefinition("Root Hover Block");
      const bp1 = new Point("BP1", -25, 0, false, "endpoint");
      const bp2 = new Point("BP2", 25, 0, false, "endpoint");
      bp1.sketchId = defaultSketchId;
      bp2.sketchId = defaultSketchId;
      const blockLine = new Line("BL1", bp1, bp2);
      blockLine.sketchId = defaultSketchId;
      definition.points.push(bp1, bp2);
      definition.lines.push(blockLine);
      appendDefinition(definition);
      const instance = {
        id: nextInstanceId(),
        definitionId: definition.id,
        sketchId: secondSketchId,
        x: -35,
        y: 55,
        rotation: 0,
        fixed: false,
        rotationLocked: false,
        enabledSketchIds: [defaultSketchId],
        appearanceOverride: {},
      };
      currentScope().blockInstances.push(instance);
      currentScope().activeSketchId = defaultSketchId;
      invalidateBlockProjectionCache();
      updateUI();
      fitAllGeometryToViewport(150);
      draw();
      return {
        rootSketchId: rootSketchId,
        secondSketchId,
        childSketchId,
        lineId: line.id,
        lineEndpointId: p1.id,
        circleId: circle.id,
        arcId: arc.id,
        blockInstanceId: instance.id,
      };
    }
    return Object.freeze({ reset });
  }

  function createBlockHoverFixture({ resetModelState, viewport, createEmptyBlockDefinition, Point, Line, defaultSketchId, appendDefinition, nextInstanceId, currentScope, invalidateBlockProjectionCache, updateUI, fitAllGeometryToViewport, draw, blockProjectionBundle, clientPosition }) {
    function reset() {
      resetModelState();
      viewport.update({ scale: 1 });
      const definition = createEmptyBlockDefinition("Tree Hover Block");
      const lineP1 = new Point("BP1", -80, 0, false, "endpoint");
      const lineP2 = new Point("BP2", 80, 0, false, "endpoint");
      lineP1.sketchId = defaultSketchId;
      lineP2.sketchId = defaultSketchId;
      const blockLine = new Line("BL1", lineP1, lineP2);
      blockLine.sketchId = defaultSketchId;
      const explicitPoints = [
        new Point("BP3", -70, -45, false, "explicit"),
        new Point("BP4", 70, -45, false, "explicit"),
        new Point("BP5", -70, 45, false, "explicit"),
        new Point("BP6", 70, 45, false, "explicit"),
      ];
      explicitPoints.forEach((point) => {
        point.sketchId = defaultSketchId;
      });
      definition.points.push(lineP1, lineP2, ...explicitPoints);
      definition.lines.push(blockLine);
      appendDefinition(definition);
      const instance = {
        id: nextInstanceId(),
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
      updateUI();
      fitAllGeometryToViewport(180);
      draw();
      const bundle = blockProjectionBundle(instance);
      return {
        sketchId: defaultSketchId,
        instanceId: instance.id,
        projectedExplicitPointIds: bundle.points.filter((point) => point.localElement?.kind === "explicit").map((point) => point.id),
        blockLineMid: clientPosition({ x: 0, y: 0 }),
      };
    }
    return Object.freeze({ reset });
  }

  window.SketchTreeTestDriver = Object.freeze({ createRootHoverFixture, createBlockHoverFixture });
})();
