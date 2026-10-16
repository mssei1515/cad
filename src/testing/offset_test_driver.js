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

  function createChainFixture({ resetModelState, addPoint, addLine, fitAllGeometryToViewport, resetHistory, draw, canvas, worldToCanvasScreen }) {
    function reset() {
      resetModelState();
      const p1 = addPoint(-80, -45, false, "endpoint");
      const corner = addPoint(20, -45, false, "endpoint");
      const p3 = addPoint(20, 55, false, "endpoint");
      const line1 = addLine(p1, corner);
      const line2 = addLine(corner, p3);
      const disconnected = addLine(addPoint(75, -45, false, "endpoint"), addPoint(75, 35, false, "endpoint"));
      fitAllGeometryToViewport(220);
      resetHistory("offset chain test");
      draw();
      const rect = canvas.getBoundingClientRect();
      const screenPoint = (point) => {
        const screen = worldToCanvasScreen(point);
        return { x: rect.left + screen.x, y: rect.top + screen.y };
      };
      return {
        first: screenPoint({ x: -30, y: -45 }),
        second: screenPoint({ x: 20, y: 5 }),
        disconnected: screenPoint({ x: 75, y: -5 }),
        side: screenPoint({ x: -30, y: -15 }),
        sourceIds: [line1.id, line2.id],
      };
    }
    return Object.freeze({ reset });
  }

  function createChainObservation({ currentScope, OffsetChainConstraint, serializeModel, offsetSelection, pendingCommandSession, Line }) {
    function state() {
      const constraints = currentScope().constraints.filter((constraint) => constraint instanceof OffsetChainConstraint);
      const serialized = serializeModel();
      return {
        selectedCount: offsetSelection.entries.length,
        selectionCommitted: offsetSelection.committed,
        pendingType: pendingCommandSession.current?.type || null,
        lineCount: currentScope().lines.length,
        constraintCount: constraints.length,
        target: constraints[0]?.target ?? null,
        parameterName: constraints[0]?.parameterName || null,
        parameterNames: constraints.map((item) => item.parameterName || null),
        sourceIds: constraints[0]?.sources.map((item) => item.id) || [],
        offsetIds: constraints[0]?.offsets.map((item) => item.id) || [],
        resultJoins: constraints[0]
          ? constraints[0].offsets.slice(0, -1).map((item, index) => ({
            end: item instanceof Line ? { x: item.p2.x, y: item.p2.y } : item.endPoint(),
            start: constraints[0].offsets[index + 1] instanceof Line
              ? { x: constraints[0].offsets[index + 1].p1.x, y: constraints[0].offsets[index + 1].p1.y }
              : constraints[0].offsets[index + 1].startPoint(),
          }))
          : [],
        jsonVersion: serialized.version,
        serializedTypes: serialized.constraints.filter((item) => item.type === "offsetChainDimension").length,
        serialized,
      };
    }
    return Object.freeze({ state });
  }

  function createChainReload({ serializeModel, loadModelData, currentScope, OffsetChainConstraint }) {
    function reload() {
      const saved = serializeModel();
      const loaded = loadModelData(saved);
      const constraint = currentScope().constraints.find((item) => item instanceof OffsetChainConstraint);
      return {
        loaded,
        count: currentScope().constraints.filter((item) => item instanceof OffsetChainConstraint).length,
        target: constraint?.target ?? null,
        sourceCount: constraint?.sources.length ?? 0,
        offsetCount: constraint?.offsets.length ?? 0,
        reversed: constraint?.sourceReversed || [],
      };
    }
    return Object.freeze({ reload });
  }

  function createChainTargetEdit({ currentScope, OffsetChainConstraint, preconditionNewConstraint, targetFromConstraint, measuredConstraintTargetValue, Line }) {
    function update(value) {
      const constraint = currentScope().constraints.find((item) => item instanceof OffsetChainConstraint);
      if (!constraint) return null;
      constraint.target = Number(value);
      constraint.expression = String(value);
      preconditionNewConstraint(constraint);
      const target = targetFromConstraint(constraint);
      return {
        measured: measuredConstraintTargetValue(constraint, target, constraint.dimension),
        join: {
          first: constraint.offsets[0] instanceof Line ? { x: constraint.offsets[0].p2.x, y: constraint.offsets[0].p2.y } : constraint.offsets[0].endPoint(),
          second: constraint.offsets[1] instanceof Line ? { x: constraint.offsets[1].p1.x, y: constraint.offsets[1].p1.y } : constraint.offsets[1].startPoint(),
        },
      };
    }
    return Object.freeze({ update });
  }

  function createChainReselection({ currentScope, OffsetChainConstraint, offsetSelection, addOffsetChainGeometry, clearSelection }) {
    function reselect() {
      const constraint = currentScope().constraints.find((item) => item instanceof OffsetChainConstraint);
      if (!constraint) return null;
      offsetSelection.reset();
      const first = addOffsetChainGeometry(constraint.offsets[0]);
      const second = addOffsetChainGeometry(constraint.offsets[1]);
      const result = { first: first.ok, second: second.ok, selectedCount: offsetSelection.entries.length };
      offsetSelection.reset();
      clearSelection();
      return result;
    }
    return Object.freeze({ reselect });
  }

  // Assemble the Offset-only browser test surface without publishing or reading app state.
  function createSupport({
    resetModelState, addPoint, addLine, addCircle, addArc, pushModelConstraint, currentScope,
    RadiusConstraint, OffsetConstraint, OffsetChainConstraint, HorizontalConstraint, VerticalConstraint, Line,
    createOffsetGeometry, preconditionNewConstraint, solveSketchAndDependents, activeSketchId, snapshotModelState,
    targetFromConstraint, measuredConstraintTargetValue, serializeModel, loadModelData,
    offsetSelection, drawingPreview, offsetDistanceFromPointer, pendingCommandSession, addOffsetChainGeometry, clearSelection,
    fitAllGeometryToViewport, resetHistory, solveAndRefresh, draw, canvas, worldToCanvasScreen, document
  }) {
    const offsetChainFixture = createChainFixture({ resetModelState, addPoint, addLine, fitAllGeometryToViewport, resetHistory, draw, canvas, worldToCanvasScreen });
    const offsetChainObservation = createChainObservation({ currentScope, OffsetChainConstraint, serializeModel, offsetSelection, pendingCommandSession, Line });
    const offsetChainReload = createChainReload({ serializeModel, loadModelData, currentScope, OffsetChainConstraint });
    const offsetChainTargetEdit = createChainTargetEdit({ currentScope, OffsetChainConstraint, preconditionNewConstraint, targetFromConstraint, measuredConstraintTargetValue, Line });
    const offsetChainReselection = createChainReselection({ currentScope, OffsetChainConstraint, offsetSelection, addOffsetChainGeometry, clearSelection });
    const offsetPrimitiveFixture = createPrimitiveFixture({
      resetModelState, addPoint, addLine, addCircle, addArc, pushModelConstraint, RadiusConstraint, createOffsetGeometry, currentScope, OffsetConstraint, preconditionNewConstraint,
      solveSketchAndDependents, activeSketchId, snapshotModelState, measuredConstraintTargetValue, serializeModel, loadModelData, fitAllGeometryToViewport, draw,
    });
    const offsetUiFixture = createUiFixture({ resetModelState, addPoint, addLine, fitAllGeometryToViewport, draw, canvas, worldToCanvasScreen });
    const offsetUiObservation = createUiObservation({ currentScope, OffsetConstraint, offsetSelection, drawingPreview, offsetDistanceFromPointer, pendingCommandSession, document, Line });
    const offsetDirectionFixture = createDirectionFixture({ resetModelState, addPoint, addLine, pushModelConstraint, HorizontalConstraint, VerticalConstraint, solveAndRefresh, fitAllGeometryToViewport, draw, canvas, worldToCanvasScreen });
    return Object.freeze({
      resetForOffsetConstraints: offsetPrimitiveFixture.reset,
      resetForOffsetUi: offsetUiFixture.reset,
      offsetUiState: offsetUiObservation.state,
      resetForOffsetDirection: offsetDirectionFixture.reset,
      resetForOffsetChainUi: offsetChainFixture.reset,
      offsetChainUiState: offsetChainObservation.state,
      roundTripOffsetChainForTest: offsetChainReload.reload,
      updateOffsetChainTargetForTest: offsetChainTargetEdit.update,
      canReselectOffsetResultChainForTest: offsetChainReselection.reselect,
    });
  }

  window.OffsetTestDriver = Object.freeze({ createSupport, createPrimitiveFixture, createUiFixture, createUiObservation, createDirectionFixture, createChainFixture, createChainObservation, createChainReload, createChainTargetEdit, createChainReselection });
})();
