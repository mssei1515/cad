/* Constraint browser-test scenarios through explicit application ports. */
(() => {
  "use strict";
  function createForcedCommit({ resetModelState, addPoint, DistanceConstraint, solver, commitNewConstraint, currentScope, document }) {
    function commit(forcedResult) {
      resetModelState();
      const p1 = addPoint(0, 0, true, "endpoint");
      const p2 = addPoint(10, 0, false, "endpoint");
      const constraint = new DistanceConstraint(p1, p2, 10);
      const solveSubset = solver.solveSubset;
      solver.solveSubset = () => ({
        success: Boolean(forcedResult?.success),
        errorNorm: Number(forcedResult?.errorNorm),
        iterations: Number(forcedResult?.iterations) || 0,
        reason: String(forcedResult?.reason || "test"),
        variableCount: 2,
        constraintCount: 1,
      });
      let committed = false;
      try {
        committed = commitNewConstraint("distance", constraint) === true;
      } finally {
        solver.solveSubset = solveSubset;
      }
      const hint = document.getElementById("hint");
      return {
        committed,
        constraintCount: currentScope().constraints.length,
        hint: hint?.textContent || "",
        hintIsError: Boolean(hint?.classList.contains("error")),
      };
    }
    return Object.freeze({ commit });
  }
  function createInputObservation({ readSelectedGeometry, canvasSelection, constraintTargetSession, operandElement }) {
    function state() {
      return {
        selected: readSelectedGeometry(),
        geometryInstances: canvasSelection.geometryInstances.map((item) => item.id),
        arcEndpoint: canvasSelection.arcEndpoint ? { arc: canvasSelection.arcEndpoint.arc.id, endpoint: canvasSelection.arcEndpoint.endpoint } : null,
        arcEndpointPair: canvasSelection.arcEndpointPair?.map((item) => ({ arc: item.arc.id, endpoint: item.endpoint })) || null,
        operands: constraintTargetSession.operands.map((item) => ({ kind: item.kind, id: operandElement(item)?.id, endpoint: item.endpoint })),
        pendingType: constraintTargetSession.command?.type || null,
      };
    }
    return Object.freeze({ state });
  }

  function createIntentResolution({ currentScope, makeConstraintOperand, resolveConstraintIntent, serializeConstraint }) {
    function resolve(type, inputs) {
      const operands = inputs.map(({ kind, id, endpoint, parameter }) => {
        const items = kind === "point" ? currentScope().points : kind === "line" ? currentScope().lines
          : kind === "spline" ? currentScope().splines : kind === "arc-endpoint" ? currentScope().arcs : [...currentScope().circles, ...currentScope().arcs];
        const element = items.find((item) => item.id === id);
        if (!element) throw new Error(`Missing test operand: ${id}`);
        const key = kind === "arc-endpoint" ? "arc" : kind;
        return makeConstraintOperand(kind, { [key]: element, endpoint, parameter });
      });
      const resolution = resolveConstraintIntent(type, operands);
      return resolution ? {
        action: resolution.action || null,
        error: resolution.error || null,
        constraint: resolution.constraint ? serializeConstraint(resolution.constraint) : null,
        targetKind: resolution.target?.kind || null,
      } : null;
    }
    return Object.freeze({ resolve });
  }

  function createAnalysisObservation({ activeSketchId, sketchSolveVariables, sketchSolveConstraints, sketchSolveLines, analyzeConstraintState, acceptError, vectorNorm, currentScope, elementSketchId }) {
    function analysis() {
      const sketchId = activeSketchId();
      const variables = sketchSolveVariables(sketchId);
      const constraints = sketchSolveConstraints(sketchId);
      const analysis = analyzeConstraintState({
        variables,
        constraints,
        lines: sketchSolveLines(sketchId),
        errorTolerance: acceptError,
      });
      const largestConstraintErrors = constraints
        .map((constraint, index) => {
          const error = constraint.error();
          const values = Array.isArray(error) ? error : [error];
          return {
            index,
            name: constraint.name,
            type: constraint.constructor.name,
            errorNorm: vectorNorm(values),
          };
        })
        .filter((entry) => entry.errorNorm > 1e-8)
        .sort((a, b) => b.errorNorm - a.errorNorm)
        .slice(0, 12);
      return {
        stable: analysis.stable,
        errorNorm: analysis.errorNorm,
        rank: analysis.rank,
        variableCount: analysis.variableCount,
        freeVariableCount: analysis.freeVariableCount,
        constraintCount: constraints.length,
        pointCount: currentScope().points.filter((point) => elementSketchId(point) === sketchId).length,
        lineCount: currentScope().lines.filter((line) => elementSketchId(line) === sketchId).length,
        circleCount: currentScope().circles.filter((circle) => elementSketchId(circle) === sketchId).length,
        arcCount: currentScope().arcs.filter((arc) => elementSketchId(arc) === sketchId).length,
        splineCount: currentScope().splines.filter((spline) => elementSketchId(spline) === sketchId).length,
        largestConstraintErrors,
      };
    }
    return Object.freeze({ analysis });
  }

  function createBlockObservation({ refreshConstraintAnalysis, blockProjectionBundles }) {
    function state(instanceId = null) {
      const state = refreshConstraintAnalysis();
      const bundles = blockProjectionBundles().filter((bundle) => !instanceId || bundle.instance.id === instanceId);
      return {
        stable: state.analysis.stable,
        summary: { ...state.summary },
        projections: bundles.flatMap((bundle) => [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])].map((item) => ({
          id: item.id,
          status: state.statuses.get(item) || null,
        }))),
      };
    }
    return Object.freeze({ state });
  }

  function createBlockConstraintInsertion({ blockInstanceById, blockProjectionBundle, commitNewConstraint, PointOnLineConstraint, readAnalysis, readBlockState, serializeModel }) {
    function add(pointInstanceId, pointLocalId, lineInstanceId, lineLocalId) {
      const pointInstance = blockInstanceById(pointInstanceId);
      const lineInstance = blockInstanceById(lineInstanceId);
      const point = pointInstance ? blockProjectionBundle(pointInstance).points.find((item) => item.localElement?.id === pointLocalId) : null;
      const line = lineInstance ? blockProjectionBundle(lineInstance).lines.find((item) => item.localElement?.id === lineLocalId) : null;
      if (!point || !line) return { committed: false, reason: "projection-not-found" };
      const committed = commitNewConstraint("coincident", new PointOnLineConstraint(point, line)) === true;
      return {
        committed,
        analysis: readAnalysis(),
        status: readBlockState(pointInstanceId),
        serialized: serializeModel(),
      };
    }
    return Object.freeze({ add });
  }

  function createStatusObservation({ refreshConstraintAnalysis, elementSketchId, activeSketchId }) {
    function state() {
      const state = refreshConstraintAnalysis();
      return {
        stable: state.analysis.stable,
        errorNorm: state.analysis.errorNorm,
        freeDof: state.analysis.freeVariableCount,
        items: [...state.statuses].filter(([item]) => elementSketchId(item) === activeSketchId())
          .map(([item, status]) => ({ id: item.id, status })),
      };
    }
    return Object.freeze({ state });
  }

  function createReferenceLineMove({ currentScope, elementSketchId, solveReferenceDependentSketches, refreshConstraintAnalysis, updateUI, draw, defaultSketchId, isExplicitPoint }) {
    function move(dy) {
      const line = currentScope().lines.find((item) => elementSketchId(item) === "S4");
      if (!line) return null;
      line.p1.y += dy;
      line.p2.y += dy;
      const result = solveReferenceDependentSketches("S4");
      refreshConstraintAnalysis();
      updateUI();
      draw();
      const point = currentScope().points.find((item) => elementSketchId(item) === defaultSketchId && isExplicitPoint(item));
      return {
        success: result.success,
        dependentSketchIds: result.results.map((entry) => entry.sketchId),
        point: point ? { x: point.x, y: point.y } : null,
        line: { p1: { x: line.p1.x, y: line.p1.y }, p2: { x: line.p2.x, y: line.p2.y } },
      };
    }
    return Object.freeze({ move });
  }

  function createDependencyOrderFixture({ resetModelState, sketchById, defaultSketchId, currentScope, rootSketchId, addLine, addPoint, markReferenceConstraint, PointOnLineConstraint, CoincidentConstraint, refreshReferenceConstraintValidity, solveReferenceDependentSketches }) {
    function orderCase() {
      resetModelState();
      const parentSketchId = "S10";
      const childSketchId = "S5";
      sketchById(defaultSketchId).parentSketchId = parentSketchId;
      currentScope().sketches.push({ id: parentSketchId, name: "Sketch-P", parentSketchId: rootSketchId, kind: "sketch", visible: true });
      currentScope().sketches.push({ id: childSketchId, name: "Sketch-1-1", parentSketchId: defaultSketchId, kind: "sketch", visible: true });
      currentScope().activeSketchId = parentSketchId;
      const sourceLine = addLine(addPoint(-50, 0, true, "endpoint"), addPoint(50, 0, true, "endpoint"));
      currentScope().activeSketchId = defaultSketchId;
      const activePoint = addPoint(0, 15, false, "explicit");
      const first = markReferenceConstraint(new PointOnLineConstraint(activePoint, sourceLine), parentSketchId, defaultSketchId);
      currentScope().constraints.push(first);
      currentScope().activeSketchId = childSketchId;
      const childPoint = addPoint(0, 30, false, "explicit");
      const second = markReferenceConstraint(new CoincidentConstraint(childPoint, activePoint), defaultSketchId, childSketchId);
      currentScope().constraints.push(second);
      currentScope().activeSketchId = defaultSketchId;
      refreshReferenceConstraintValidity();
      sourceLine.p1.y = 25;
      sourceLine.p2.y = 25;
      const result = solveReferenceDependentSketches(parentSketchId);
      return {
        order: result.results.map((entry) => entry.sketchId),
        activePointY: activePoint.y,
        childPointY: childPoint.y,
      };
    }
    return Object.freeze({ orderCase });
  }

  function createDimensionSelectionFixture({ resetModelState, addPoint, addLine, DistanceConstraint, dimensionFromAnchor, pushModelConstraint, canvasSelection, constraintTargetSession, updateUI, fitAllGeometryToViewport, draw, canvas }) {
    function reset() {
      resetModelState();
      const p1 = addPoint(-50, 0, false, "endpoint");
      const p2 = addPoint(50, 0, false, "endpoint");
      const line = addLine(p1, p2);
      const target = { kind: "line-length", line, p1, p2, value: line.length() };
      const constraint = new DistanceConstraint(p1, p2, line.length());
      constraint.dimension = dimensionFromAnchor(target, { x: 0, y: -30 });
      pushModelConstraint(constraint);
      canvasSelection.set("dimensionConstraint", constraint);
      constraintTargetSession.replaceCommand({ type: "parallel" });
      updateUI();
      fitAllGeometryToViewport(180);
      draw();
      const rect = canvas.getBoundingClientRect();
      return { blank: { x: rect.left + rect.width - 35, y: rect.top + rect.height - 35 } };
    }
    return Object.freeze({ reset });
  }

  function createDimensionSelectionObservation({ canvasSelection, constraintTargetSession }) {
    function state() {
      return {
        selected: Boolean(canvasSelection.dimensionConstraint),
        command: constraintTargetSession.command?.type || null,
      };
    }
    return Object.freeze({ state });
  }

  function createSupportStatusFixture({ resetModelState, addPoint, addLine, pushModelConstraint, HorizontalConstraint, PointOnLineConstraint, addArc, RadiusConstraint, solveSketchAndDependents, activeSketchId, snapshotModelState, refreshConstraintAnalysis, fitAllGeometryToViewport, draw, constraintStatusOf, constraintStatusColor, readSummary }) {
    function reset() {
      resetModelState();

      const anchor = addPoint(-60, -40, true, "explicit");
      const supportLine = addLine(addPoint(-100, -40, false, "endpoint"), addPoint(-20, -40, false, "endpoint"));
      pushModelConstraint(new HorizontalConstraint(supportLine));
      pushModelConstraint(new PointOnLineConstraint(anchor, supportLine));

      const underLine = addLine(addPoint(20, 0, false, "endpoint"), addPoint(100, 0, false, "endpoint"));
      pushModelConstraint(new HorizontalConstraint(underLine));

      const fullLine = addLine(addPoint(-100, 50, true, "endpoint"), addPoint(-20, 50, true, "endpoint"));
      const supportArc = addArc(addPoint(65, 60, true, "center"), 30, Math.PI, Math.PI * 1.5);
      pushModelConstraint(new RadiusConstraint(supportArc, 30));

      solveSketchAndDependents(activeSketchId(), snapshotModelState());
      refreshConstraintAnalysis();
      fitAllGeometryToViewport(150);
      draw();
      return {
        supportLine: { status: constraintStatusOf(supportLine), color: constraintStatusColor(supportLine) },
        underLine: { status: constraintStatusOf(underLine), color: constraintStatusColor(underLine) },
        fullLine: { status: constraintStatusOf(fullLine), color: constraintStatusColor(fullLine) },
        supportArc: { status: constraintStatusOf(supportArc), color: constraintStatusColor(supportArc) },
        summary: readSummary(),
      };
    }
    return Object.freeze({ reset });
  }

  function createParentPointLineFixture({ resetModelState, addPoint, addLine, activeSketchId, currentScope, fitAllGeometryToViewport, updateUI, draw, canvas, worldToCanvasScreen }) {
    function reset() {
      resetModelState();
      const parentPoint = addPoint(-45, 0, false, "explicit");
      const parentLineP1 = addPoint(20, -20, false, "endpoint");
      const parentLineP2 = addPoint(80, -20, false, "endpoint");
      const parentLine = addLine(parentLineP1, parentLineP2);
      const childSketchId = "S2";
      const parentSketchId = activeSketchId();
      currentScope().sketches.push({ id: childSketchId, name: "Sketch-1-1", parentSketchId, kind: "sketch" });
      currentScope().activeSketchId = childSketchId;
      const childLineP1 = addPoint(-80, 35, false, "endpoint");
      const childLineP2 = addPoint(-10, 35, false, "endpoint");
      const childLine = addLine(childLineP1, childLineP2);
      const childPoint = addPoint(50, 30, false, "explicit");
      fitAllGeometryToViewport(190);
      updateUI();
      draw();
      const rect = canvas.getBoundingClientRect();
      const screenPoint = (point) => {
        const screen = worldToCanvasScreen(point);
        return { x: rect.left + screen.x, y: rect.top + screen.y };
      };
      return {
        parentPoint: screenPoint(parentPoint),
        parentLine: screenPoint({ x: 50, y: -20 }),
        childLine: screenPoint({ x: -45, y: 35 }),
        childPoint: screenPoint(childPoint),
      };
    }
    return Object.freeze({ reset });
  }

  function createSiblingPointLineFixture({ resetModelState, addPoint, currentScope, rootSketchId, addLine, defaultSketchId, fitAllGeometryToViewport, updateUI, draw, canvas, worldToCanvasScreen }) {
    function reset() {
      resetModelState();
      const activePoint = addPoint(50, 35, false, "explicit");
      const siblingSketchId = "S2";
      currentScope().sketches.push({ id: siblingSketchId, name: "Sketch-2", parentSketchId: rootSketchId, kind: "sketch" });
      currentScope().activeSketchId = siblingSketchId;
      const lineP1 = addPoint(10, 0, true, "endpoint");
      const lineP2 = addPoint(90, 0, true, "endpoint");
      const siblingLine = addLine(lineP1, lineP2);
      currentScope().activeSketchId = defaultSketchId;
      fitAllGeometryToViewport(190);
      updateUI();
      draw();
      const rect = canvas.getBoundingClientRect();
      const screenPoint = (point) => {
        const screen = worldToCanvasScreen(point);
        return { x: rect.left + screen.x, y: rect.top + screen.y };
      };
      return {
        activePoint: screenPoint(activePoint),
        siblingLine: screenPoint({ x: 50, y: 0 }),
      };
    }
    return Object.freeze({ reset });
  }

  function createSiblingReferenceMove({ currentScope, elementSketchId, solveReferenceDependentSketches, refreshConstraintAnalysis, updateUI, draw, defaultSketchId, isExplicitPoint, wouldCreateReferenceCycle }) {
    function move(dy) {
      const siblingLine = currentScope().lines.find((line) => elementSketchId(line) === "S2");
      if (!siblingLine) return null;
      siblingLine.p1.y += dy;
      siblingLine.p2.y += dy;
      const result = solveReferenceDependentSketches("S2");
      refreshConstraintAnalysis();
      updateUI();
      draw();
      const activePoint = currentScope().points.find((point) => elementSketchId(point) === defaultSketchId && isExplicitPoint(point));
      return {
        success: result.success,
        dependentSketchIds: result.results.map((entry) => entry.sketchId),
        activePoint: activePoint ? { x: activePoint.x, y: activePoint.y } : null,
        siblingLine: { p1: { x: siblingLine.p1.x, y: siblingLine.p1.y }, p2: { x: siblingLine.p2.x, y: siblingLine.p2.y } },
        reverseWouldCycle: wouldCreateReferenceCycle("S2", defaultSketchId),
      };
    }
    return Object.freeze({ move });
  }

  function createPointLineObservation({ currentScope, PointOnLineConstraint, signedPointLineDistance, constraintSketchId }) {
    function state() {
      const constraints = currentScope().constraints.filter((constraint) => constraint instanceof PointOnLineConstraint && constraint.reference);
      return {
        count: constraints.length,
        errors: constraints.map((constraint) => Math.abs(signedPointLineDistance(constraint.point, constraint.line))),
        referenceSketchIds: constraints.map((constraint) => constraint.referenceSketchId),
        sketchIds: constraints.map((constraint) => constraintSketchId(constraint)),
      };
    }
    return Object.freeze({ state });
  }

  window.ConstraintTestDriver = Object.freeze({ createForcedCommit, createInputObservation, createIntentResolution, createAnalysisObservation, createBlockObservation, createBlockConstraintInsertion, createStatusObservation, createReferenceLineMove, createDependencyOrderFixture, createDimensionSelectionFixture, createDimensionSelectionObservation, createSupportStatusFixture, createParentPointLineFixture, createSiblingPointLineFixture, createSiblingReferenceMove, createPointLineObservation });
})();
