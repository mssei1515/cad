/* Prepare and apply geometry drag edits without owning input events or history. */
(() => {
  "use strict";
  const { hypot2, vectorNorm } = window.GeometrySolver;
  const { lineSupportNormal } = window.GeometryKernel;
  function create({ currentScope, solver, plan, dragSolver, contextFromSeeds, projectionConstraintsForItems,
    pointLockedByLineFixed, variableDeltaInBasis, captureValues,
    enforceMinimumLineLengths, normalizeArcSweeps, invalidateProjection, projectionBlockedMessage, previewMaxModelError }) {
    const { points: dragTargets, radius: radiusDragTargets, primitiveMove: primitiveMoveTargets,
      arcEndpoint: arcEndpointDragTargets, pointConstraints: dragConstraintsFromTargets,
      parameterConstraints: parameterDragConstraintsFromTargets } = plan;

    function dragSessionSeeds(session) {
      const seeds = [];
      if (!session) return seeds;
      if (session.item) {
        seeds.push(session.item);
        if (session.item.center) seeds.push(session.item.center);
      }
      for (const p of session.points || []) seeds.push(p.point);
      return seeds;
    }

    function pointCoordinateFreedomRank(analysis, pointEntries, tolerance = 1e-8) {
      const basis = analysis?.nullspaceBasis || [];
      if (basis.length === 0) return 0;
      const orthonormalRows = [];
      for (const entry of pointEntries || []) {
        const indices = analysis.variableIndex.get(entry.point) || {};
        for (const prop of ["x", "y"]) {
          const index = indices[prop];
          if (!Number.isInteger(index)) continue;
          const residual = basis.map((vector) => vector[index] || 0);
          for (const row of orthonormalRows) {
            const projection = residual.reduce((sum, value, rowIndex) => sum + value * row[rowIndex], 0);
            for (let rowIndex = 0; rowIndex < residual.length; rowIndex += 1) residual[rowIndex] -= projection * row[rowIndex];
          }
          const norm = vectorNorm(residual);
          if (norm <= tolerance) continue;
          orthonormalRows.push(residual.map((value) => value / norm));
        }
      }
      return orthonormalRows.length;
    }

    function attachLocalSolveContext(session) {
      if (!session) return session;
      const projectionTouched = [
        ...(session.item && !currentScope().blockInstances.includes(session.item) ? [session.item] : []),
        ...(session.points || []).map((entry) => entry.point),
      ].filter(Boolean);
      session.projectionShapeLocked = projectionConstraintsForItems(projectionTouched).length > 0;
      session.local = contextFromSeeds(dragSessionSeeds(session), session.sketchId);
      if (session.variableAllowed) session.local.variables = session.local.variables.filter(session.variableAllowed);
      if ((session.kind === "block" || session.kind === "block-rotation") && session.item && !session.item.fixed) {
        const existing = new Set(session.local.variables.filter((variable) => variable.object === session.item).map((variable) => variable.prop));
        if (!existing.has("x")) session.local.variables.push({ object: session.item, prop: "x", label: `${session.item.id}.x` });
        if (!existing.has("y")) session.local.variables.push({ object: session.item, prop: "y", label: `${session.item.id}.y` });
        if (!session.item.rotationLocked && !existing.has("rotation")) session.local.variables.push({ object: session.item, prop: "rotation", label: `${session.item.id}.rotation` });
      }
      session.local.pointStarts = currentScope().points
        .filter((p) => session.local.component.has(p) && !p.fixed && !pointLockedByLineFixed(p))
        .map((point) => ({ point, startX: point.x, startY: point.y }));
      session.local.fixedPointCount = currentScope().points.filter((p) => session.local.component.has(p) && (p.fixed || pointLockedByLineFixed(p))).length;
      // Count motion visible at the dragged line, rather than unrelated freedom
      // elsewhere in its component. One visible DOF needs one representative
      // point even when another attached arc has an independent free endpoint.
      if (session.kind === "line") {
        const analysis = solver.analyzeConstraintState({
          variables: session.local.variables,
          constraints: session.local.constraints,
          lines: session.local.lines,
        });
        const line = session.item;
        const visibleBasis = [];
        for (const basis of analysis.nullspaceBasis) {
          const residual = [line.p1, line.p2].flatMap((point) => ["x", "y"].map((prop) => variableDeltaInBasis(point, prop, basis, analysis)));
          for (let pass = 0; pass < 2; pass++) for (const previous of visibleBasis) {
            const factor = residual.reduce((sum, value, i) => sum + value * previous[i], 0);
            for (let i = 0; i < residual.length; i++) residual[i] -= factor * previous[i];
          }
          const norm = vectorNorm(residual);
          if (norm > 1e-8) visibleBasis.push(residual.map((value) => value / norm));
        }
        const freeTranslation = [[1, 0, 1, 0], [0, 1, 0, 1]].every((translation) => {
          const residual = [...translation];
          for (const basis of visibleBasis) {
            const factor = translation.reduce((sum, value, i) => sum + value * basis[i], 0);
            for (let i = 0; i < residual.length; i++) residual[i] -= factor * basis[i];
          }
          return vectorNorm(residual) < 1e-7;
        });
        const normal = analysis.lineNormals?.get(line) || lineSupportNormal(line);
        session.translationReference = analysis.stable && (freeTranslation || !analysis.nullspaceBasis.some((basis) => {
          const dx = variableDeltaInBasis(line.p2, "x", basis, analysis) - variableDeltaInBasis(line.p1, "x", basis, analysis);
          const dy = variableDeltaInBasis(line.p2, "y", basis, analysis) - variableDeltaInBasis(line.p1, "y", basis, analysis);
          return Math.abs(normal.x * dx + normal.y * dy) > 1e-7 * Math.max(1, Math.hypot(...basis));
        }));
        if (session.points.length > 1 && session.local.fixedPointCount > 0 && analysis.stable && pointCoordinateFreedomRank(analysis, session.points) === 1) {
          const fixedPoints = currentScope().points.filter((point) =>
            session.local.component.has(point) && (point.fixed || pointLockedByLineFixed(point)));
          const pointActivity = (entry) => {
            const index = analysis.variableIndex.get(entry.point) || {};
            return Math.sqrt((analysis.nullspaceBasis || []).reduce((sum, basis) =>
              sum + (basis[index.x] || 0) ** 2 + (basis[index.y] || 0) ** 2, 0));
          };
          const nearestFixedDistance = (entry) => Math.min(...fixedPoints.map((fixed) =>
            hypot2(entry.point.x - fixed.x, entry.point.y - fixed.y)));
          const best = session.points.reduce((current, candidate) => {
            if (!current) return candidate;
            const activityDifference = pointActivity(candidate) - pointActivity(current);
            if (Math.abs(activityDifference) > 1e-8) return activityDifference > 0 ? candidate : current;
            return nearestFixedDistance(candidate) > nearestFixedDistance(current) ? candidate : current;
          }, null);
          if (best && pointActivity(best) > 1e-8) session.lineDragPoint = best;
        }
      }
      session.fullDragState = solver.clone(solver.getVariables());
      session.parameterDragSnapshot = captureValues();
      return session;
    }

    function sketchProjectionBlockedDragResult() {
      return {
        success: false,
        blocked: true,
        reason: projectionBlockedMessage(),
        errorNorm: 0,
        iterations: 0,
        variableCount: 0,
        constraintCount: 0,
      };
    }

    function hasDirectRadiusDimension(primitive) {
      return window.DimensionQueries.hasDirectRadiusDimension(currentScope().constraints, primitive);
    }

    function guidedTargetHasNoActivity(result) {
      return Boolean(
        result?.guided
        && Array.isArray(result.targetConstraints)
        && result.targetConstraints.length === 0
        && Array.isArray(result.targetActivity)
        && result.targetActivity.every((activity) => activity <= 1e-8)
      );
    }

    function finalizeDragResult(result, state, session = null, extra = [], retry = null) {
      const lineRepair = enforceMinimumLineLengths(session?.local?.lines || currentScope().lines);
      if (lineRepair.changed > 0) {
        result = retry ? retry() : session?.local ? dragSolver.solve(session, extra, state) : dragSolver.solveSketch(session, extra);
      }
      normalizeArcSweeps();
      result.lineRepair = lineRepair;
      if (lineRepair.failed) {
        solver.restore(state);
        result.blocked = true;
        result.success = false;
        result.reason = "R寸法と固定点によりこれ以上潰せません";
        result.lineRepair = lineRepair;
      } else if (!result.success) {
        solver.restore(state);
        result.blocked = true;
      }
      return result;
    }

    function preview(session, pointer) {
      if (session?.projectionShapeLocked) return sketchProjectionBlockedDragResult();
      let result;
      const dragVars = session?.local?.variables || solver.getVariables();
      const dragState = solver.clone(dragVars);
      if (session.mode === "derived-placement") {
        const targets = solver.observablePointDragTargets({ ...session.local, point: session.anchor,
          errorTolerance: previewMaxModelError,
          x: session.startAnchor.x + pointer.x - session.startPointer.x,
          y: session.startAnchor.y + pointer.y - session.startPointer.y });
        const extra = parameterDragConstraintsFromTargets(targets);
        const retry = () => dragSolver.guided(session, targets, extra, dragState);
        return finalizeDragResult(retry(), dragState, session, extra, retry);
      }
      if (session.mode === "block" || session.mode === "block-rotation") {
        const targets = session.mode === "block"
          ? [
              { object: session.item, prop: "x", value: session.startX + pointer.x - session.startPointer.x },
              { object: session.item, prop: "y", value: session.startY + pointer.y - session.startPointer.y },
            ]
          : (() => {
              const rotation = Math.atan2(pointer.y - session.rotationPivot.y, pointer.x - session.rotationPivot.x);
              const cos = Math.cos(rotation);
              const sin = Math.sin(rotation);
              return [
                { object: session.item, prop: "x", value: session.rotationPivot.x - session.localCenter.x * cos + session.localCenter.y * sin },
                { object: session.item, prop: "y", value: session.rotationPivot.y - session.localCenter.x * sin - session.localCenter.y * cos },
                { object: session.item, prop: "rotation", value: rotation },
              ];
            })();
        const extra = parameterDragConstraintsFromTargets(targets);
        const retry = () => dragSolver.guided(session, targets, extra, dragState);
        result = retry();
        invalidateProjection(session.item.id);
        return finalizeDragResult(result, dragState, session, extra, retry);
      }
      if (session.mode === "radius") {
        const moveTargets = primitiveMoveTargets(session, pointer);
        if (hasDirectRadiusDimension(session.item)) {
          session.activeMode = "move";
          const extra = dragConstraintsFromTargets(moveTargets);
          const targets = moveTargets;
          const retry = () => dragSolver.guided(session, targets, extra, dragState);
          result = retry();
          return finalizeDragResult(result, dragState, session, extra, retry);
        }

        const state = solver.clone(dragVars);
        let targets = radiusDragTargets(session, pointer);
        let extra = parameterDragConstraintsFromTargets(targets);
        let retry = () => dragSolver.guided(session, targets, extra, dragState);
        result = retry();
        if ((!result.success || guidedTargetHasNoActivity(result)) && moveTargets.length > 0) {
          solver.restore(state);
          session.activeMode = "move";
          targets = moveTargets;
          extra = dragConstraintsFromTargets(moveTargets);
          retry = () => dragSolver.guided(session, targets, extra, dragState);
          result = retry();
          return finalizeDragResult(result, dragState, session, extra, retry);
        }
        session.activeMode = "radius";
        return finalizeDragResult(result, dragState, session, extra, retry);
      }
      let targets;
      let extra;
      if (session.mode === "arc-endpoint") {
        targets = arcEndpointDragTargets(session, pointer);
        extra = parameterDragConstraintsFromTargets(targets);
        const retry = () => dragSolver.guided(session, targets, extra, dragState);
        result = retry();
        return finalizeDragResult(result, dragState, session, extra, retry);
      } else {
        const directTargets = dragTargets(session, pointer);
        targets = directTargets;
        extra = dragConstraintsFromTargets(directTargets);
      }
      const retry = () => dragSolver.guided(session, targets, extra, dragState);
      result = retry();
      return finalizeDragResult(result, dragState, session, extra, retry);
    }

    function finish(session) {
      if (session?.projectionShapeLocked) return sketchProjectionBlockedDragResult();
      return dragSolver.finish(session);
    }
    return Object.freeze({ prepare: attachLocalSolveContext, preview, finish });
  }
  window.GeometryDragEditing = Object.freeze({ create });
})();
