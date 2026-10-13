/* Browser-test Offset fixtures and observations delegate creation, solving and persistence to product owners. */
(() => {
  "use strict";
  function createPrimitiveFixture({ resetModelState, addPoint, addLine, addCircle, addArc, pushModelConstraint, RadiusConstraint, createOffsetGeometry, currentScope, OffsetConstraint, preconditionNewConstraint, solveSketchAndDependents, activeSketchId, snapshotModelState, measuredConstraintTargetValue, serializeModel, loadModelData, fitAllGeometryToViewport, draw }) {
    function reset() {
      resetModelState();
      const lineP1 = addPoint(-120, -70, true, "endpoint");
      const lineP2 = addPoint(-20, -70, true, "endpoint");
      const sourceLine = addLine(lineP1, lineP2);
      const sourceCircle = addCircle(addPoint(80, -20, true, "center"), 30);
      const sourceArc = addArc(addPoint(0, 90, true, "center"), 40, 0, Math.PI / 2);
      pushModelConstraint(new RadiusConstraint(sourceCircle, 30));
      pushModelConstraint(new RadiusConstraint(sourceArc, 40));

      const lineCreated = createOffsetGeometry(sourceLine, 20, 1, { x: -70, y: -50 });
      const circleCreated = createOffsetGeometry(sourceCircle, 15, 1, { x: 125, y: -20 });
      const arcCreated = createOffsetGeometry(sourceArc, 10, -1, { x: 0, y: 120 });
      const offsets = currentScope().constraints.filter((constraint) => constraint instanceof OffsetConstraint);
      offsets[0].target = 25;
      offsets[1].target = 18;
      offsets[2].target = 12;
      offsets[0].expression = "25";
      offsets[1].expression = "18";
      offsets[2].expression = "12";
      offsets.forEach(preconditionNewConstraint);
      solveSketchAndDependents(activeSketchId(), snapshotModelState());
      const measurements = offsets.map((constraint) => measuredConstraintTargetValue(constraint));
      const sourceRadii = [sourceCircle.radius(), sourceArc.radius()];
      const serialized = serializeModel();
      loadModelData(serialized);
      const restored = currentScope().constraints.filter((constraint) => constraint instanceof OffsetConstraint);
      fitAllGeometryToViewport(140);
      draw();
      return {
        created: [lineCreated, circleCreated, arcCreated],
        measurements,
        sourceRadii,
        restoredCount: restored.length,
        restoredTypes: serializeModel().constraints.filter((constraint) => constraint.type === "offsetDimension").length,
        restoredTargets: restored.map((constraint) => constraint.target),
        geometry: { lines: currentScope().lines.length, circles: currentScope().circles.length, arcs: currentScope().arcs.length },
      };
    }
    return Object.freeze({ reset });
  }

  function createUiFixture({ resetModelState, addPoint, addLine, fitAllGeometryToViewport, draw, canvas, worldToCanvasScreen }) {
    function reset() {
      resetModelState();
      const p1 = addPoint(-60, 0, false, "endpoint");
      const p2 = addPoint(60, 0, false, "endpoint");
      addLine(p1, p2);
      fitAllGeometryToViewport(220);
      draw();
      const rect = canvas.getBoundingClientRect();
      const source = worldToCanvasScreen({ x: 0, y: 0 });
      const side = worldToCanvasScreen({ x: 0, y: 35 });
      return {
        source: { x: rect.left + source.x, y: rect.top + source.y },
        side: { x: rect.left + side.x, y: rect.top + side.y },
      };
    }
    return Object.freeze({ reset });
  }

  function createUiObservation({ currentScope, OffsetConstraint, offsetSelection, drawingPreview, offsetDistanceFromPointer, pendingCommandSession, document, Line }) {
    function state() {
      const constraints = currentScope().constraints.filter((constraint) => constraint instanceof OffsetConstraint);
      const preview = offsetSelection.source && drawingPreview.pointer ? offsetDistanceFromPointer(offsetSelection.source, drawingPreview.pointer) : null;
      return {
        pendingType: pendingCommandSession.current?.type || null,
        lineCount: currentScope().lines.length,
        constraintCount: constraints.length,
        targets: constraints.map((constraint) => constraint.target),
        toolActive: document.getElementById("toolOffset")?.classList.contains("active"),
        previewDistance: preview?.distance ?? null,
        previewSign: preview?.sign ?? null,
        lineOffsetDeltas: constraints
          .filter((constraint) => constraint.source instanceof Line)
          .map((constraint) => ({
            x: (constraint.offset.p1.x + constraint.offset.p2.x - constraint.source.p1.x - constraint.source.p2.x) / 2,
            y: (constraint.offset.p1.y + constraint.offset.p2.y - constraint.source.p1.y - constraint.source.p2.y) / 2,
          })),
      };
    }
    return Object.freeze({ state });
  }

  function createDirectionFixture({ resetModelState, addPoint, addLine, pushModelConstraint, HorizontalConstraint, VerticalConstraint, solveAndRefresh, fitAllGeometryToViewport, draw, canvas, worldToCanvasScreen }) {
    function reset(directionCase = "vertical") {
      resetModelState();
      const horizontal = directionCase === "horizontal";
      const p1 = addPoint(horizontal ? 60 : 0, horizontal ? 0 : 60, false, "endpoint");
      const p2 = addPoint(horizontal ? -60 : 0, horizontal ? 0 : -60, false, "endpoint");
      const line = addLine(p1, p2);
      pushModelConstraint(horizontal ? new HorizontalConstraint(line) : new VerticalConstraint(line));
      solveAndRefresh("offset direction test");
      fitAllGeometryToViewport(220);
      draw();
      const rect = canvas.getBoundingClientRect();
      const screenPoint = (point) => {
        const screen = worldToCanvasScreen(point);
        return { x: rect.left + screen.x, y: rect.top + screen.y };
      };
      return {
        source: screenPoint({ x: 0, y: 0 }),
        side: screenPoint(horizontal ? { x: 0, y: 35 } : { x: 35, y: 0 }),
        expectedAxis: horizontal ? "y" : "x",
      };
    }
    return Object.freeze({ reset });
  }

  window.OffsetTestDriver = Object.freeze({ createPrimitiveFixture, createUiFixture, createUiObservation, createDirectionFixture });
})();
