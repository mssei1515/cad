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

  function createBlockEditorFixture({ resetModelState, currentScope, DEFAULT_SKETCH_ID, createEmptyBlockDefinition, openBlockDefinitionEditor, addLine, addPoint, focus, clientPosition, resetBlockEditorHistory, updateUI, draw, completeBlockDefinitionEdit, isEditingBlock, serializeModel }) {
    function reset() {
      resetModelState();
      const draft = createEmptyBlockDefinition("Projection Block");
      openBlockDefinitionEditor(draft, { isNew: true });
      currentScope().activeSketchId = DEFAULT_SKETCH_ID;
      const line = addLine(addPoint(-45, 0, false, "endpoint"), addPoint(45, 0, false, "endpoint"), false);
      currentScope().sketches.push({ id: "S3", name: "Projected Detail", parentSketchId: DEFAULT_SKETCH_ID, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {}, visible: true });
      currentScope().activeSketchId = "S3";
      focus({ x: 0, y: 0 }, 3);
      resetBlockEditorHistory();
      updateUI();
      draw();
      return { client: clientPosition({ x: 0, y: 0 }), lineId: line.id };
    }

    function complete() {
      completeBlockDefinitionEdit({ rotationLocked: true });
      return { completed: !isEditingBlock(), serialized: structuredClone(serializeModel()) };
    }
    return Object.freeze({ reset, complete });
  }

  function createBlockProjectionFixture({ resetModelState, createEmptyBlockDefinition, Point, Line, DEFAULT_SKETCH_ID, appendDefinition, nextInstanceId, currentScope, invalidateBlockProjectionCache, blockProjectionBundle, focus, clientPosition, resetHistory, updateUI, draw }) {
    function reset() {
      resetModelState();
      const definition = createEmptyBlockDefinition("Source Block");
      const p1 = new Point("BP1", -30, 0, false, "endpoint");
      const p2 = new Point("BP2", 30, 0, false, "endpoint");
      p1.sketchId = DEFAULT_SKETCH_ID;
      p2.sketchId = DEFAULT_SKETCH_ID;
      const line = new Line("BL1", p1, p2, false);
      line.sketchId = DEFAULT_SKETCH_ID;
      definition.points.push(p1, p2);
      definition.lines.push(line);
      definition.revision += 1;
      appendDefinition(definition);
      const instance = { id: nextInstanceId(), definitionId: definition.id, sketchId: DEFAULT_SKETCH_ID, x: -10, y: 15, rotation: 0, fixed: false, rotationLocked: false, enabledSketchIds: [DEFAULT_SKETCH_ID], appearanceOverride: {} };
      currentScope().blockInstances.push(instance);
      currentScope().sketches.push({ id: "S3", name: "Block Projection Target", parentSketchId: DEFAULT_SKETCH_ID, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {}, visible: true });
      currentScope().activeSketchId = "S3";
      invalidateBlockProjectionCache();
      const projected = blockProjectionBundle(instance).lines[0];
      focus({ x: -10, y: 15 }, 3);
      resetHistory("block projection sketch projection test");
      updateUI();
      draw();
      return { instanceId: instance.id, client: clientPosition({ x: (projected.p1.x + projected.p2.x) / 2, y: (projected.p1.y + projected.p2.y) / 2 }) };
    }
    return Object.freeze({ reset });
  }

  function createBlockProjectionInteraction({ currentScope, invalidateBlockProjectionCache, solveSketchAndDependents, DEFAULT_SKETCH_ID, updateUI, draw, readState, clearSelection, canvasSelection, deleteCurrentSelection }) {
    function move() {
      const instance = currentScope().blockInstances[0];
      if (!instance) return null;
      instance.x += 38;
      instance.y -= 11;
      instance.rotation += Math.PI / 2;
      invalidateBlockProjectionCache(instance.id);
      const solved = solveSketchAndDependents(DEFAULT_SKETCH_ID);
      updateUI();
      draw();
      return { success: solved.success && solved.dependent?.success !== false, state: readState() };
    }

    function deleteSource() {
      clearSelection();
      canvasSelection.set("blockInstances", currentScope().blockInstances.slice(0, 1));
      const deleted = deleteCurrentSelection();
      return { deleted, state: readState() };
    }
    return Object.freeze({ move, deleteSource });
  }

  function createGeometryInteraction({ types, readConstraints, clearSelection, canvasSelection, updateUI, draw, readState,
    clientPosition, constraintGeometryId, setAppearanceForSelection, deleteElements, deleteCurrentSelection, deleteSketch, DEFAULT_SKETCH_ID }) {
    const { Point, Line, Circle, Arc, Spline } = types;
    function select(kind = "line") {
      const constraint = readConstraints().find((item) => item.kind === kind) || null;
      if (!constraint) return null;
      clearSelection();
      if (constraint.target instanceof Point) canvasSelection.set("points", [constraint.target]);
      else if (constraint.target instanceof Line) canvasSelection.set("lines", [constraint.target]);
      else if (constraint.target instanceof Circle) canvasSelection.set("circles", [constraint.target]);
      else if (constraint.target instanceof Arc) canvasSelection.set("arcs", [constraint.target]);
      else if (constraint.target instanceof Spline) canvasSelection.set("splines", [constraint.target]);
      updateUI();
      draw();
      const state = readState();
      const point = constraint.target instanceof Point
        ? constraint.target
        : constraint.target instanceof Line
          ? { x: (constraint.target.p1.x + constraint.target.p2.x) / 2, y: (constraint.target.p1.y + constraint.target.p2.y) / 2 }
          : constraint.target.center || constraint.target.fitPoints[1];
      return { targetId: constraintGeometryId(constraint.target), client: clientPosition(point), propertiesText: state.propertiesText };
    }

    function removeConstraint() {
      const constraint = readConstraints()[0];
      if (!constraint) return false;
      return deleteElements({ constraints: [constraint] });
    }

    function setAppearance(kind = "line") {
      const selected = select(kind);
      if (!selected) return null;
      const before = readConstraints().length;
      const changed = setAppearanceForSelection({ color: "#8B5CF6" });
      return { changed, before, targetId: selected.targetId, state: readState() };
    }

    function deleteSource(kind = "line") {
      const constraint = readConstraints().find((item) => item.kind === kind) || null;
      if (!constraint) return false;
      const source = constraint.source;
      if (source instanceof Point) return deleteElements({ points: [source] });
      if (source instanceof Line) return deleteElements({ lines: [source] });
      if (source instanceof Circle) return deleteElements({ circles: [source] });
      if (source instanceof Arc) return deleteElements({ arcs: [source] });
      return deleteElements({ splines: [source] });
    }

    function deleteTarget(kind = "line") {
      const selected = select(kind);
      if (!selected) return null;
      const deleted = deleteCurrentSelection();
      return { deleted, state: readState() };
    }

    function deleteSourceSketch() {
      const deleted = deleteSketch(DEFAULT_SKETCH_ID, false);
      return { deleted, state: readState() };
    }
    return Object.freeze({ select, removeConstraint, setAppearance, deleteSource, deleteTarget, deleteSourceSketch });
  }

  function createSourceEditing({ currentScope, DEFAULT_SKETCH_ID, elementSketchId, addPointToSketch, solveSketchAndDependents,
    updateUI, draw, readState, readConstraints, constraintSketchId, sketchProjectionSourceKey, createSketchProjectionTarget,
    SketchProjectionConstraint, markReferenceConstraint, pushModelConstraint, synchronizeSketchProjectionMetadata }) {
    function move(dx = 12, dy = 7, { changeShape = true, changeSplineStructure = false } = {}) {
      const sourceSketchId = DEFAULT_SKETCH_ID;
      for (const point of currentScope().points.filter((item) => elementSketchId(item) === sourceSketchId)) {
        point.x += Number(dx) || 0;
        point.y += Number(dy) || 0;
      }
      if (changeShape) {
        const circle = currentScope().circles.find((item) => elementSketchId(item) === sourceSketchId);
        const arc = currentScope().arcs.find((item) => elementSketchId(item) === sourceSketchId);
        if (circle) circle.radiusValue += 3;
        if (arc) {
          arc.radiusValue += 2;
          arc.startAngle += 0.15;
          arc.endAngle += 0.25;
        }
      }
      if (changeSplineStructure) {
        const spline = currentScope().splines.find((item) => elementSketchId(item) === sourceSketchId);
        if (spline) {
          const a = spline.fitPoints[1];
          const b = spline.fitPoints[2];
          const point = addPointToSketch((a.x + b.x) / 2, (a.y + b.y) / 2 + 9, sourceSketchId, "endpoint");
          spline.fitPoints.splice(2, 0, point);
          spline.closed = true;
          spline._curveCache = null;
        }
      }
      const solved = solveSketchAndDependents(sourceSketchId);
      updateUI();
      draw();
      return { success: solved.success && solved.dependent?.success !== false, state: readState() };
    }

    function createChain() {
      const upstream = readConstraints().find((constraint) => constraint.kind === "line" && constraintSketchId(constraint) === "S3");
      if (!upstream) return null;
      if (!currentScope().sketches.some((sketch) => sketch.id === "S4")) {
        currentScope().sketches.push({ id: "S4", name: "Projection Chain", parentSketchId: "S3", kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {}, visible: true });
      }
      currentScope().activeSketchId = "S4";
      const entry = { item: upstream.target, kind: "line", sketchId: "S3", key: sketchProjectionSourceKey(upstream.target) };
      const target = createSketchProjectionTarget(entry, "S4");
      const constraint = new SketchProjectionConstraint("line", upstream.target, target);
      markReferenceConstraint(constraint, "S3", "S4");
      pushModelConstraint(constraint, "S4");
      synchronizeSketchProjectionMetadata("S4");
      const solved = solveSketchAndDependents("S3");
      updateUI();
      draw();
      return { success: solved.success && solved.dependent?.success !== false, state: readState() };
    }
    return Object.freeze({ move, createChain });
  }

  function createReload({ CURRENT_JSON_VERSION, serializeModel, loadModelData, updateUI, draw, readState }) {
    function reload(version = CURRENT_JSON_VERSION) {
      const data = structuredClone(serializeModel());
      data.version = Number(version);
      loadModelData(data);
      updateUI();
      draw();
      return readState();
    }
    return Object.freeze({ reload });
  }

  window.SketchProjectionTestDriver = Object.freeze({ createObservation, createGeometryFixture, createCompatibilityFixture, createBlockEditorFixture, createBlockProjectionFixture, createBlockProjectionInteraction, createGeometryInteraction, createSourceEditing, createReload });
})();
