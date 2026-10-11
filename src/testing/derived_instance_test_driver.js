/* Derived-instance browser fixtures and interaction observations with live application owners. */
(() => {
  "use strict";
  const { createRegionIndex: createHatchRegionIndex, findFaceInIndex: findHatchFaceInIndex } = window.HatchRegionEngine;
  function createFixture({ resetModelState, addCircle, addPoint, addLine, addArc, currentScope, DEFAULT_SKETCH_ID, DEFAULT_HATCH_APPEARANCE,
    normalizeGeometryInstance, activeSketchId, geometryRefForItem, parseGeometryRefId, hatchGeometryQuery,
    nextProjectionId, nextMirrorId, nextPatternId, resetHistory, updateUI, draw, readState }) {
    const { hatchPrimitivesForScope } = hatchGeometryQuery;
    function reset() {
      resetModelState();
      const sourceCircle = addCircle(addPoint(-25, -20, false, "endpoint"), 8, false);
      currentScope().sketches.push({ id: "S2", name: "Derived Target", parentSketchId: DEFAULT_SKETCH_ID, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {}, visible: true });
      currentScope().activeSketchId = "S2";
      const sourceLine = addLine(addPoint(-40, 10, false, "endpoint"), addPoint(-10, 30, false, "endpoint"), false);
      const sourceArc = addArc(addPoint(-55, -25, false, "endpoint"), 9, 3, 3.5, false);
      const axis = addLine(addPoint(0, -50, false, "endpoint"), addPoint(0, 50, false, "endpoint"), true);
      const direction = addLine(addPoint(20, -40, false, "endpoint"), addPoint(60, -40, false, "endpoint"), true);
      const projection = normalizeGeometryInstance({ id: nextProjectionId(), type: "sketchProjection", sketchId: activeSketchId(), sources: [geometryRefForItem(sourceCircle)] });
      const mirror = normalizeGeometryInstance({ id: nextMirrorId(), type: "mirror", sketchId: activeSketchId(), sources: [geometryRefForItem(sourceLine), parseGeometryRefId("circle", `${projection.id}@${sourceCircle.id}`), geometryRefForItem(sourceArc)], axis: geometryRefForItem(axis) });
      const pattern = normalizeGeometryInstance({ id: nextPatternId(), type: "pattern", sketchId: activeSketchId(), sources: [geometryRefForItem(sourceLine)], direction: geometryRefForItem(direction), spacing: 15, copies: 3, reversed: false });
      currentScope().geometryInstances.push(projection, mirror, pattern);
      const projectedCircleFace = findHatchFaceInIndex(createHatchRegionIndex(hatchPrimitivesForScope(currentScope(), activeSketchId())), { x: sourceCircle.center.x, y: sourceCircle.center.y });
      if (projectedCircleFace) currentScope().hatches.push({ id: "H1", sketchId: activeSketchId(), seed: { x: sourceCircle.center.x, y: sourceCircle.center.y }, boundaryLoops: projectedCircleFace.boundaryLoops, appearance: { ...DEFAULT_HATCH_APPEARANCE } });
      resetHistory("derived instance test");
      updateUI();
      draw();
      return readState();
    }
    return Object.freeze({ reset });
  }

  function createInteraction({ currentScope, serializeModel, geometryInstanceBundle, constraintStatusColor, arcSweep, canvasSelection,
    resolvedHatchBoundary, document, loadModelData, updateUI, draw, deleteElements, deleteCurrentSelection }) {
    function load(data) {
      loadModelData(structuredClone(data));
      updateUI();
      draw();
      return state();
    }

    function state() {
      return {
        serialized: structuredClone(serializeModel()),
        instances: currentScope().geometryInstances.map((instance) => {
          const bundle = geometryInstanceBundle(instance);
          return {
            id: instance.id,
            type: instance.type,
            valid: bundle.valid,
            reason: bundle.reason,
            points: bundle.points.map((point) => ({ id: point.id, x: point.x, y: point.y })),
            lines: bundle.lines.map((line) => ({ id: line.id, p1: { x: line.p1.x, y: line.p1.y }, p2: { x: line.p2.x, y: line.p2.y }, color: constraintStatusColor(line) })),
            circles: bundle.circles.map((circle) => ({ id: circle.id, center: { x: circle.center.x, y: circle.center.y }, radius: circle.radius(), color: constraintStatusColor(circle) })),
            arcs: bundle.arcs.map((arc) => ({ id: arc.id, startAngle: arc.startAngle, endAngle: arc.endAngle, sweep: arcSweep(arc), color: constraintStatusColor(arc) })),
          };
        }),
        selectedIds: canvasSelection.geometryInstances.map((instance) => instance.id),
        selectedGeometry: canvasSelection.instanceGeometry ? { ...canvasSelection.instanceGeometry } : null,
        hatchValidity: currentScope().hatches.map((hatch) => resolvedHatchBoundary(hatch).ok),
        treeCount: document.querySelectorAll('#sketchList [data-object-kind="instance"]').length,
        propertiesText: document.getElementById("propertiesPanel")?.textContent || "",
      };
    }

    function deleteSource() {
      const source = currentScope().lines.find((line) => line.id === "L1");
      return { deleted: source ? deleteElements({ lines: [source] }) : false, state: state(), hint: document.getElementById("hint")?.textContent || "" };
    }

    function deleteInstance(id) {
      canvasSelection.set("geometryInstances", currentScope().geometryInstances.filter((instance) => instance.id === id));
      return { deleted: deleteCurrentSelection(), state: state(), hint: document.getElementById("hint")?.textContent || "" };
    }
    return Object.freeze({ load, state, deleteSource, deleteInstance });
  }
  function createCommandFixture({ resetModelState, addPoint, addLine, focus, clientPosition, resetHistory, updateUI, draw }) {
    function reset() {
      resetModelState();
      const source = addLine(addPoint(-55, 15, false, "endpoint"), addPoint(-25, 35, false, "endpoint"), false);
      const axis = addLine(addPoint(0, -55, false, "endpoint"), addPoint(0, 55, false, "endpoint"), true);
      const direction = addLine(addPoint(25, -40, false, "endpoint"), addPoint(65, -40, false, "endpoint"), true);
      focus({ x: 0, y: 0 }, 2.5);
      resetHistory("geometry instance command test");
      updateUI();
      draw();
      return {
        sourceId: source.id,
        axis: clientPosition({ x: (axis.p1.x + axis.p2.x) / 2, y: (axis.p1.y + axis.p2.y) / 2 }),
        direction: clientPosition({ x: (direction.p1.x + direction.p2.x) / 2, y: (direction.p1.y + direction.p2.y) / 2 }),
      };
    }
    return Object.freeze({ reset });
  }
  window.DerivedInstanceTestDriver = Object.freeze({ createFixture, createInteraction, createCommandFixture });
})();
