/* Sketch Projection browser fixtures and observations through live application owners. */
(() => {
  "use strict";
  function createObservation({ types, currentScope, readMode, readStagedCount, readConstraints,
    constraintGeometryId, constraintSketchId, effectiveAppearanceForElement, geometryDisplayColor,
    constraintStatusOf, constraintStatusColor, constraintIsRedundant, serializeModel, readHistory, document }) {
    const { Point, Line, Circle, Arc } = types;
    function state() {
      const constraints = readConstraints();
      const geometryState = (item) => {
        if (item instanceof Point) return { id: item.id, kind: "point", x: item.x, y: item.y };
        if (item instanceof Line) return { id: item.id, kind: "line", p1: item.p1.id, p2: item.p2.id, points: [{ x: item.p1.x, y: item.p1.y }, { x: item.p2.x, y: item.p2.y }], construction: Boolean(item.construction) };
        if (item instanceof Circle) return { id: item.id, kind: "circle", center: { id: item.center.id, x: item.center.x, y: item.center.y }, radius: item.radius(), construction: Boolean(item.construction) };
        if (item instanceof Arc) return { id: item.id, kind: "arc", center: { id: item.center.id, x: item.center.x, y: item.center.y }, radius: item.radius(), startAngle: item.startAngle, endAngle: item.endAngle, construction: Boolean(item.construction) };
        return { id: item.id, kind: "spline", fitPoints: item.fitPoints.map((point) => ({ id: point.id, x: point.x, y: point.y })), closed: Boolean(item.closed), construction: Boolean(item.construction) };
      };
      return {
        mode: readMode(),
        stagedCount: readStagedCount(),
        constraints: constraints.map((constraint) => ({
          kind: constraint.kind,
          source: geometryState(constraint.source),
          target: geometryState(constraint.target),
          sourceId: constraintGeometryId(constraint.source),
          targetId: constraintGeometryId(constraint.target),
          sketchId: constraintSketchId(constraint),
          referenceSketchId: constraint.referenceSketchId,
          appearanceColor: effectiveAppearanceForElement(constraint.target).color,
          displayColor: geometryDisplayColor(constraint.target, effectiveAppearanceForElement(constraint.target)),
          constraintStatus: constraintStatusOf(constraint.target),
          statusColor: constraintStatusColor(constraint.target),
          redundant: constraintIsRedundant(constraint),
        })),
        serialized: structuredClone(serializeModel()),
        history: readHistory(),
        sketches: currentScope().sketches.map((sketch) => ({ id: sketch.id, parentSketchId: sketch.parentSketchId })),
        treeText: document.getElementById("sketchList")?.textContent || "",
        propertiesText: document.getElementById("propertiesPanel")?.textContent || "",
      };
    }
    return Object.freeze({ state });
  }

  function createGeometryFixture({ resetModelState, currentScope, DEFAULT_SKETCH_ID, addPoint, addLine, addCircle, addArc, addSpline,
    focus, clientPosition, splineGeometry, resetHistory, updateUI, draw }) {
    function reset() {
      resetModelState();
      const sourceSketchId = DEFAULT_SKETCH_ID;
      currentScope().activeSketchId = sourceSketchId;
      const explicitPoint = addPoint(-105, 65, false, "explicit");
      const shared = addPoint(-40, -55, false, "endpoint");
      const line1 = addLine(addPoint(-95, -55, false, "endpoint"), shared, false);
      const line2 = addLine(shared, addPoint(-40, -15, false, "endpoint"), true);
      const circle = addCircle(explicitPoint, 18, false);
      const arc = addArc(addPoint(62, 48, false, "endpoint"), 19, -0.2, 1.35, true);
      const spline = addSpline([
        addPoint(-5, -8, false, "endpoint"),
        addPoint(28, -32, false, "endpoint"),
        addPoint(65, -8, false, "endpoint"),
        addPoint(98, -30, false, "endpoint"),
      ], false, false);
      const targetSketch = { id: "S3", name: "Projection Target", parentSketchId: sourceSketchId, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {}, visible: true };
      currentScope().sketches.push(targetSketch);
      currentScope().activeSketchId = targetSketch.id;
      focus({ x: 0, y: 0 }, 2.2);
      resetHistory("sketch projection test");
      updateUI();
      draw();
      const client = (point) => clientPosition(point);
      const splinePoint = splineGeometry.evaluate(spline.curve(), 0.5);
      return {
        sourceSketchId,
        targetSketchId: targetSketch.id,
        ids: { point: explicitPoint.id, lines: [line1.id, line2.id], circle: circle.id, arc: arc.id, spline: spline.id },
        clients: {
          point: client(explicitPoint),
          line1: client({ x: (line1.p1.x + line1.p2.x) / 2, y: (line1.p1.y + line1.p2.y) / 2 }),
          line2: client({ x: (line2.p1.x + line2.p2.x) / 2, y: (line2.p1.y + line2.p2.y) / 2 }),
          circle: client({ x: circle.center.x + circle.radius(), y: circle.center.y }),
          arc: client({ x: arc.center.x + arc.radius() * Math.cos(0.6), y: arc.center.y + arc.radius() * Math.sin(0.6) }),
          spline: client(splinePoint),
        },
      };
    }
    return Object.freeze({ reset });
  }
  function createCompatibilityFixture({ resetModelState, currentScope, DEFAULT_SKETCH_ID, addPoint, addLine, addCircle, addArc, addSpline,
    createSketchProjectionTarget, SketchProjectionConstraint, markReferenceConstraint, pushModelConstraint,
    synchronizeSketchProjectionMetadata, solveSketchAndDependents, serializeModel, loadModelData,
    resetHistory, updateUI, draw, readState }) {
    function resetRectangle({ reloadSharedVersion19 = false } = {}) {
      resetModelState();
      const sourceSketchId = DEFAULT_SKETCH_ID;
      const corners = [
        addPoint(-60, -40, false, "endpoint"),
        addPoint(60, -40, false, "endpoint"),
        addPoint(60, 40, false, "endpoint"),
        addPoint(-60, 40, false, "endpoint"),
      ];
      const sourceLines = corners.map((point, index) => addLine(point, corners[(index + 1) % corners.length], false));
      const targetSketchId = "S3";
      currentScope().sketches.push({ id: targetSketchId, name: "Projection Target", parentSketchId: sourceSketchId, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {}, visible: true });
      currentScope().activeSketchId = targetSketchId;
      for (const source of sourceLines) {
        const target = createSketchProjectionTarget({ item: source, kind: "line", sketchId: sourceSketchId }, targetSketchId);
        const constraint = new SketchProjectionConstraint("line", source, target);
        markReferenceConstraint(constraint, sourceSketchId, targetSketchId);
        pushModelConstraint(constraint, targetSketchId);
      }
      synchronizeSketchProjectionMetadata(targetSketchId);
      solveSketchAndDependents(sourceSketchId);
      if (reloadSharedVersion19) {
        const data = structuredClone(serializeModel());
        const linesById = new Map(data.lines.map((line) => [String(line.id), line]));
        const targetPointBySourcePoint = new Map();
        const orphanedTargetPointIds = new Set();
        for (const link of data.constraints.filter((constraint) => constraint.type === "sketchProjection" && constraint.kind === "line")) {
          const source = linesById.get(String(link.source));
          const target = linesById.get(String(link.target));
          if (!source || !target) continue;
          for (const key of ["p1", "p2"]) {
            const sourcePointId = String(source[key]);
            const existingTargetPointId = targetPointBySourcePoint.get(sourcePointId);
            if (existingTargetPointId) {
              orphanedTargetPointIds.add(String(target[key]));
              target[key] = existingTargetPointId;
            } else {
              targetPointBySourcePoint.set(sourcePointId, String(target[key]));
            }
          }
        }
        data.points = data.points.filter((point) => !orphanedTargetPointIds.has(String(point.id)));
        loadModelData(data);
      }
      resetHistory("sketch projection rectangle test");
      updateUI();
      draw();
      return readState();
    }

    function resetSharedKinds({ reloadSharedVersion19 = false } = {}) {
      resetModelState();
      const sourceSketchId = DEFAULT_SKETCH_ID;
      const shared = addPoint(-45, -20, false, "explicit");
      const sourceEntries = [
        { item: shared, kind: "point", sketchId: sourceSketchId },
        { item: addLine(shared, addPoint(30, -20, false, "endpoint"), false), kind: "line", sketchId: sourceSketchId },
        { item: addCircle(shared, 18, false), kind: "circle", sketchId: sourceSketchId },
        { item: addArc(shared, 24, -0.3, 1.2, false), kind: "arc", sketchId: sourceSketchId },
        { item: addSpline([shared, addPoint(-5, 30, false, "endpoint"), addPoint(45, 10, false, "endpoint")], false, false), kind: "spline", sketchId: sourceSketchId },
      ];
      const targetSketchId = "S3";
      currentScope().sketches.push({ id: targetSketchId, name: "Projection Target", parentSketchId: sourceSketchId, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {}, visible: true });
      currentScope().activeSketchId = targetSketchId;
      for (const entry of sourceEntries) {
        const target = createSketchProjectionTarget(entry, targetSketchId);
        const constraint = new SketchProjectionConstraint(entry.kind, entry.item, target);
        markReferenceConstraint(constraint, sourceSketchId, targetSketchId);
        pushModelConstraint(constraint, targetSketchId);
      }
      synchronizeSketchProjectionMetadata(targetSketchId);
      solveSketchAndDependents(sourceSketchId);
      if (reloadSharedVersion19) {
        const data = structuredClone(serializeModel());
        const links = new Map(data.constraints.filter((constraint) => constraint.type === "sketchProjection").map((constraint) => [constraint.kind, constraint]));
        const linesById = new Map(data.lines.map((line) => [String(line.id), line]));
        const circlesById = new Map(data.circles.map((circle) => [String(circle.id), circle]));
        const arcsById = new Map(data.arcs.map((arc) => [String(arc.id), arc]));
        const splinesById = new Map(data.splines.map((spline) => [String(spline.id), spline]));
        const sharedTargetPointId = String(links.get("point")?.target || "");
        const orphanedTargetPointIds = new Set();
        const shareSlot = (owner, key, index = null) => {
          if (!owner || !sharedTargetPointId) return;
          const previous = index == null ? owner[key] : owner[key]?.[index];
          if (String(previous) !== sharedTargetPointId) orphanedTargetPointIds.add(String(previous));
          if (index == null) owner[key] = sharedTargetPointId;
          else owner[key][index] = sharedTargetPointId;
        };
        shareSlot(linesById.get(String(links.get("line")?.target)), "p1");
        shareSlot(circlesById.get(String(links.get("circle")?.target)), "center");
        shareSlot(arcsById.get(String(links.get("arc")?.target)), "center");
        shareSlot(splinesById.get(String(links.get("spline")?.target)), "fitPoints", 0);
        data.points = data.points.filter((point) => !orphanedTargetPointIds.has(String(point.id)));
        loadModelData(data);
      }
      resetHistory("sketch projection shared kinds test");
      updateUI();
      draw();
      return readState();
    }
    return Object.freeze({ resetRectangle, resetSharedKinds });
  }

  window.SketchProjectionTestDriver = Object.freeze({ createObservation, createGeometryFixture, createCompatibilityFixture });
})();
