/* Browser-test drag execution delegates session state and solving to product owners. */
(() => {
  "use strict";
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
  window.GeometryDragTestDriver = Object.freeze({ createPointDriver });
})();
