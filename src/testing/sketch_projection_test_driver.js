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
  window.SketchProjectionTestDriver = Object.freeze({ createObservation, createGeometryFixture });
})();
