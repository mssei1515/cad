/* Browser-test drag execution delegates session state and solving to product owners. */
(() => {
  "use strict";
  function createExecutionSupport({ feature, solver, currentScope, normalizeArcSweeps, vectorNorm, sketchSolveConstraints,
    arcEndpointPoint, now, readConstraintStatuses }) {
    const shared = { currentScope, buildDragSession: feature.build, attachLocalSolveContext: feature.prepare,
      dragResultForSession: feature.preview, solveFinalDragSession: feature.finish,
      normalizeArcSweeps, vectorNorm, sketchSolveConstraints,
      computeErrorVector: constraints => solver.computeErrorVectorForConstraints(constraints), now };
    const geometry = createGeometryDriver({ ...shared, arcEndpointPoint, readConstraintStatuses });
    const point = createPointDriver({ ...shared, targetConstraintCount: feature.targetConstraintCount });
    return Object.freeze({ guidedPointDragForTest: point.drag, guidedPointDragPathForTest: point.path, geometryDragPathForTest: geometry.path });
  }
  function createPointDriver({ currentScope, buildDragSession, attachLocalSolveContext, dragResultForSession, solveFinalDragSession, normalizeArcSweeps, vectorNorm, computeErrorVector, sketchSolveConstraints, targetConstraintCount, now }) {
    function drag(id, dx, dy) {
      const point = currentScope().points.find((item) => item.id === id);
      if (!point) return null;
      const startPointer = { x: point.x, y: point.y };
      const session = buildDragSession("point", point, startPointer);
      if (!session) return null;
      attachLocalSolveContext(session);
      const target = { x: startPointer.x + dx, y: startPointer.y + dy };
      const previewResult = dragResultForSession(session, target);
      const previewPoint = { x: point.x, y: point.y };
      const finalResult = solveFinalDragSession(session);
      normalizeArcSweeps();
      const baseErrorNorm = vectorNorm(computeErrorVector(sketchSolveConstraints(session.sketchId)));
      return {
        target,
        targetConstraintCount: targetConstraintCount(session),
        preview: {
          success: previewResult.success,
          errorNorm: previewResult.errorNorm,
          acceptError: previewResult.acceptError,
          iterations: previewResult.iterations,
          point: previewPoint,
        },
        final: {
          success: finalResult.success,
          errorNorm: finalResult.errorNorm,
          baseErrorNorm,
          iterations: finalResult.iterations,
          point: { x: point.x, y: point.y },
        },
      };
    }
    function path(id, deltas) {
      const point = currentScope().points.find((item) => item.id === id);
      if (!point) return null;
      const startPointer = { x: point.x, y: point.y };
      const session = buildDragSession("point", point, startPointer);
      if (!session) return null;
      attachLocalSolveContext(session);
      const previews = [];
      for (const [dx, dy] of deltas) {
        const target = { x: startPointer.x + dx, y: startPointer.y + dy };
        const startedAt = now();
        const result = dragResultForSession(session, target);
        previews.push({
          success: result.success,
          blocked: result.blocked,
          errorNorm: result.errorNorm,
          acceptError: result.acceptError,
          iterations: result.iterations,
          elapsedMs: now() - startedAt,
          target,
          targetNorm: result.targetNorm,
          targetStepNorm: result.targetStepNorm,
          projectedNorm: result.projectedNorm,
          projectedErrorNorm: result.projectedErrorNorm,
          targetErrorNorm: result.targetErrorNorm,
          targetConstraintCount: result.targetConstraints?.length || 0,
          freeDof: result.freeDof,
          targetActivity: result.targetActivity,
          variableCount: result.variableCount,
          constraintCount: result.constraintCount,
          reason: result.reason,
          local: result.local,
          guided: result.guided,
          fallback: result.fallback,
          point: { x: point.x, y: point.y },
        });
      }
      const finalResult = solveFinalDragSession(session);
      normalizeArcSweeps();
      const baseErrorNorm = vectorNorm(computeErrorVector(sketchSolveConstraints(session.sketchId)));
      return {
        startPoint: startPointer,
        previews,
        final: {
          success: finalResult.success,
          errorNorm: finalResult.errorNorm,
          baseErrorNorm,
          iterations: finalResult.iterations,
          reason: finalResult.reason,
          point: { x: point.x, y: point.y },
        },
      };
    }
    return Object.freeze({ drag, path });
  }
  function createGeometryDriver({ currentScope, buildDragSession, attachLocalSolveContext, dragResultForSession, solveFinalDragSession, normalizeArcSweeps, vectorNorm, computeErrorVector, sketchSolveConstraints, arcEndpointPoint, now, readConstraintStatuses }) {
    function path(descriptor, deltas) {
      const kind = descriptor?.kind;
      const id = descriptor?.id;
      const endpoint = descriptor?.endpoint === "end" ? "end" : "start";
      const fraction = Number.isFinite(descriptor?.fraction) ? Math.max(0, Math.min(1, descriptor.fraction)) : 0.5;
      let item = null;
      let sessionItem = null;
      let startPointer = null;
      if (kind === "point") {
        item = currentScope().points.find((candidate) => candidate.id === id);
        sessionItem = item;
        if (item) startPointer = { x: item.x, y: item.y };
      } else if (kind === "line") {
        item = currentScope().lines.find((candidate) => candidate.id === id);
        sessionItem = item;
        if (item) startPointer = { x: item.p1.x + fraction * (item.p2.x - item.p1.x), y: item.p1.y + fraction * (item.p2.y - item.p1.y) };
      } else if (kind === "circle") {
        item = currentScope().circles.find((candidate) => candidate.id === id);
        sessionItem = item;
        if (item) startPointer = { x: item.center.x + item.radius(), y: item.center.y };
      } else if (kind === "arc") {
        item = currentScope().arcs.find((candidate) => candidate.id === id);
        sessionItem = item;
        if (item) {
          const angle = item.startAngle + fraction * (item.endAngle - item.startAngle);
          startPointer = { x: item.center.x + item.radius() * Math.cos(angle), y: item.center.y + item.radius() * Math.sin(angle) };
        }
      } else if (kind === "arc-endpoint") {
        item = currentScope().arcs.find((candidate) => candidate.id === id);
        sessionItem = item ? { arc: item, endpoint } : null;
        if (item) startPointer = arcEndpointPoint(item, endpoint);
      }
      if (!item || !startPointer) return null;

      const snapshot = () => {
        if (kind === "point") return { x: item.x, y: item.y };
        if (kind === "line") {
          return {
            p1: { x: item.p1.x, y: item.p1.y },
            p2: { x: item.p2.x, y: item.p2.y },
            midpoint: { x: (item.p1.x + item.p2.x) / 2, y: (item.p1.y + item.p2.y) / 2 },
            length: item.length(),
          };
        }
        if (kind === "circle") return { center: { x: item.center.x, y: item.center.y }, radius: item.radius() };
        const start = arcEndpointPoint(item, "start");
        const end = arcEndpointPoint(item, "end");
        return {
          center: { x: item.center.x, y: item.center.y },
          radius: item.radius(),
          start,
          end,
          draggedEndpoint: kind === "arc-endpoint" ? (endpoint === "start" ? start : end) : null,
        };
      };

      const session = buildDragSession(kind, sessionItem, startPointer);
      const startState = snapshot();
      if (!session) return { sessionAvailable: false, startPointer, startState, previews: [], final: null };
      attachLocalSolveContext(session);
      const previews = [];
      for (const [dx, dy] of deltas) {
        const target = { x: startPointer.x + dx, y: startPointer.y + dy };
        const startedAt = now();
        const result = dragResultForSession(session, target);
        previews.push({
          success: result.success,
          blocked: result.blocked,
          errorNorm: result.errorNorm,
          acceptError: result.acceptError,
          iterations: result.iterations,
          elapsedMs: now() - startedAt,
          target,
          targetNorm: result.targetNorm,
          targetStepNorm: result.targetStepNorm,
          projectedNorm: result.projectedNorm,
          projectedErrorNorm: result.projectedErrorNorm,
          targetErrorNorm: result.targetErrorNorm,
          freeDof: result.freeDof,
          variableCount: result.variableCount,
          constraintCount: result.constraintCount,
          guidedRetryCount: result.guidedRetryCount,
          pinnedLineTargets: Boolean(result.pinnedLineTargets),
          radialObjective: Boolean(result.radialObjective),
          exactSparseLine: Boolean(result.exactSparseLine),
          guidedSubstepCount: result.guidedSubstepCount || 0,
          reason: result.reason,
          local: result.local,
          guided: result.guided,
          fallback: result.fallback,
          localErrorNorm: result.localErrorNorm,
          state: snapshot(),
          constraintState: descriptor.inspectConstraints ? readConstraintStatuses() : undefined,
        });
      }
      const finalResult = solveFinalDragSession(session);
      normalizeArcSweeps();
      const baseErrorNorm = vectorNorm(computeErrorVector(sketchSolveConstraints(session.sketchId)));
      return {
        sessionAvailable: true,
        representativePointId: session.lineDragPoint?.point.id || null,
        startPointer,
        startState,
        previews,
        final: {
          success: finalResult.success,
          errorNorm: finalResult.errorNorm,
          baseErrorNorm,
          iterations: finalResult.iterations,
          reason: finalResult.reason,
          state: snapshot(),
        },
      };
    }
    return Object.freeze({ path });
  }

  function createResponsiveFixture({ modelTypes = {}, resetModelState, addPoint, addLine, pushModelConstraint,
    DistanceConstraint = modelTypes.DistanceConstraint, ParallelConstraint = modelTypes.ParallelConstraint,
    PerpendicularConstraint = modelTypes.PerpendicularConstraint, ensureDimensionDefaults, solveAndRefresh, log,
    fitAllGeometryToViewport, draw, resetHistory, serializeModel }) {
    function reset() {
      resetModelState();

      const A = addPoint(160, 160, true, "endpoint");
      const B = addPoint(300, 180, false, "endpoint");
      const C = addPoint(280, 290, false, "endpoint");
      const D = addPoint(140, 270, false, "endpoint");
      const AB = addLine(A, B);
      const BC = addLine(B, C);
      const CD = addLine(C, D);
      const DA = addLine(D, A);

      pushModelConstraint(new DistanceConstraint(A, B, 140));
      pushModelConstraint(new DistanceConstraint(B, C, 100));
      pushModelConstraint(new ParallelConstraint(AB, CD));
      pushModelConstraint(new ParallelConstraint(BC, DA));
      pushModelConstraint(new PerpendicularConstraint(AB, BC));
      ensureDimensionDefaults();

      solveAndRefresh("サンプル復元");
      log("サンプルを復元しました");
      fitAllGeometryToViewport(160);
      draw();
      resetHistory("responsive line drag test");
      return serializeModel();
    }
    return Object.freeze({ reset });
  }

  window.GeometryDragTestDriver = Object.freeze({ createExecutionSupport, createPointDriver, createGeometryDriver, createResponsiveFixture });
})();
