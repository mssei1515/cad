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

  function createSiblingVisibilityFixture({ resetModelState, currentScope, rootSketchId, defaultSketchId, addPoint, addLine, updateUI, draw, isVisibleSketchId, sketchRelationToActive, sketchStrokeWidth, constraintStatusColor, document }) {
    function reset() {
      resetModelState();
      currentScope().sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: rootSketchId, kind: "sketch" });
      currentScope().activeSketchId = "S2";
      const p1 = addPoint(-40, 0, false, "endpoint");
      const p2 = addPoint(40, 0, false, "endpoint");
      const line = addLine(p1, p2);
      currentScope().activeSketchId = defaultSketchId;
      updateUI();
      draw();
      return {
        visible: isVisibleSketchId("S2"),
        relation: sketchRelationToActive("S2"),
        strokeWidth: sketchStrokeWidth(line),
        color: constraintStatusColor(line),
        rowHasVisibleClass: document.querySelector('.sketch-item[data-id="S2"]')?.classList.contains("visible") || false,
      };
    }
    return Object.freeze({ reset });
  }

  function createInactiveHoverFixture({ resetModelState, activeSketchId, addPoint, addLine, addDistanceConstraintFromTarget, dimensionFromAnchor, currentScope, isDimensionConstraint, createEmptyBlockDefinition, Point, Line, appendDefinition, nextInstanceId, invalidateBlockProjectionCache, fitAllGeometryToViewport, viewport, updateUI, draw, dimensionLayout, targetFromConstraint, clientPosition, blockInstanceDisplayCenter, sketchIdentityRelationLabel }) {
    function reset() {
      resetModelState();
      const sourceSketchId = activeSketchId();
      const p1 = addPoint(-120, -55, false, "endpoint");
      const p2 = addPoint(-20, -55, false, "endpoint");
      const line = addLine(p1, p2);
      const target = { kind: "line-length", line, p1, p2, value: line.length() };
      addDistanceConstraintFromTarget(
        target,
        line.length(),
        dimensionFromAnchor(target, { x: -70, y: -95 }),
        { sketchId: sourceSketchId },
      );
      const dimensionConstraint = currentScope().constraints.find((constraint) => isDimensionConstraint(constraint));

      const definition = createEmptyBlockDefinition("Hover Block");
      const bp1 = new Point("BP1", -30, 0, false, "endpoint");
      const bp2 = new Point("BP2", 30, 0, false, "endpoint");
      bp1.sketchId = sourceSketchId;
      bp2.sketchId = sourceSketchId;
      const blockLine = new Line("BL1", bp1, bp2);
      blockLine.sketchId = sourceSketchId;
      definition.points.push(bp1, bp2);
      definition.lines.push(blockLine);
      appendDefinition(definition);
      const instance = {
        id: nextInstanceId(),
        definitionId: definition.id,
        sketchId: sourceSketchId,
        x: 95,
        y: 65,
        rotation: 0,
        fixed: false,
        rotationLocked: false,
        enabledSketchIds: [sourceSketchId],
        appearanceOverride: {},
      };
      currentScope().blockInstances.push(instance);
      invalidateBlockProjectionCache();

      const activeChildId = "S2";
      currentScope().sketches.push({ id: activeChildId, name: "Sketch-2", parentSketchId: sourceSketchId, kind: "sketch", visible: true, appearance: {} });
      currentScope().activeSketchId = activeChildId;
      fitAllGeometryToViewport(180);
      viewport.update({ x: viewport.x + (80) });
      updateUI();
      draw();
      const layout = dimensionLayout(targetFromConstraint(dimensionConstraint), dimensionConstraint.dimension);
      return {
        dimension: clientPosition(layout.text),
        line: clientPosition({ x: (line.p1.x + line.p2.x) / 2, y: (line.p1.y + line.p2.y) / 2 }),
        block: clientPosition(blockInstanceDisplayCenter(instance)),
        dimensionId: dimensionConstraint.name || "寸法",
        lineId: line.id,
        blockId: instance.id,
        sourceSketchId,
        activeSketchId: activeChildId,
        relation: sketchIdentityRelationLabel(sourceSketchId),
      };
    }
    return Object.freeze({ reset });
  }

  function createIdentityObservation({ canvasHover, sketchIdentityRelationLabel }) {
    function state() {
      return canvasHover.current.sketchIdentity ? {
        kind: canvasHover.current.sketchIdentity.kind || null,
        id: canvasHover.current.sketchIdentity.id,
        sketchId: canvasHover.current.sketchIdentity.sketchId,
        relation: sketchIdentityRelationLabel(canvasHover.current.sketchIdentity.sketchId),
        hoveredDimension: canvasHover.current.dimension ? canvasHover.current.dimension.name || "寸法" : null,
        hoveredBlock: canvasHover.current.block?.id || null,
      } : null;
    }
    return Object.freeze({ state });
  }

  window.SketchTreeTestDriver = Object.freeze({ createRootHoverFixture, createBlockHoverFixture, createSiblingVisibilityFixture, createInactiveHoverFixture, createIdentityObservation });
})();
