/* Coordinate drag solve attempts and retain numerical progress per drag session. */
(() => {
  "use strict";
  const { DragConstraint, ArcEndpointDragConstraint, ParameterDragConstraint, LineCircleDistanceConstraint,
    hypot2, vectorNorm, MIN_ORIENTATION_LENGTH } = window.GeometrySolver;
  const DRAG_PREVIEW_ERROR_SCREEN_PX = 0.1;
  const SPARSE_LINE_DRAG_SUBSTEP_NORM = 4;
  const SPARSE_LINE_DRAG_MAX_SUBSTEPS = 128;

  function create({ solver, activeSketchId, sketchSolveVariables, sketchSolveConstraints, solveSketchById,
    viewScale, arcEndpointPoint, acceptError, previewMaxModelError }) {
    // Numerical history belongs here; dropping a drag session also releases its state.
    // Geometry, scope and initial rollback snapshots remain inputs owned by the drag operation.
    const progress = new WeakMap();
    function numericalState(session) {
      if (!session) return {};
      if (!progress.has(session)) progress.set(session, {});
      return progress.get(session);
    }

    function solveDragSketch(session, extra = []) {
      return solveSketchById(session?.sketchId || activeSketchId(), extra, session?.variableAllowed);
    }

    function finish(session) {
      const extra = numericalState(session).finalDragConstraints || [];
      if (numericalState(session).lastGuidedPreviewError > acceptError) {
        // Mouse-up is allowed a larger local iteration budget than an animation
        // frame. This removes accumulated preview error without invoking the
        // much heavier full-sketch solve for an otherwise isolated component.
        const localResult = withSolverMaxIterations(100, () => solveLocalDrag(session, []));
        if (localResult) {
          const baseErrorNorm = vectorNorm(solver.computeErrorVectorForConstraints(sketchSolveConstraints(session?.sketchId || activeSketchId())));
          localResult.baseErrorNorm = baseErrorNorm;
          localResult.localFinalCorrection = true;
          if (localResult.success || baseErrorNorm <= acceptError) {
            localResult.success = true;
            return localResult;
          }
        }
        const result = solveDragSketch(session);
        result.guidedFinalFallback = true;
        return result;
      }
      const variables = sketchSolveVariables(session?.sketchId || activeSketchId());
      const state = solver.clone(variables);
      const guidedResult = solveDragSketch(session, extra);
      if (guidedResult.success || guidedResult.errorNorm <= acceptError) {
        if (!guidedResult.success) guidedResult.acceptedAtDragTolerance = true;
        guidedResult.success = true;
        return guidedResult;
      }
      solver.restore(state);
      const fallbackResult = solveDragSketch(session);
      fallbackResult.guidedFinalFallback = true;
      if (!fallbackResult.success && fallbackResult.errorNorm <= acceptError) {
        fallbackResult.acceptedAtDragTolerance = true;
        fallbackResult.success = true;
      }
      return fallbackResult;
    }

    function solveLocalDrag(session, extra) {
      if (!session?.local) return null;
      return solver.solveSubset({
        variables: session.local.variables,
        constraints: session.local.constraints,
        lines: session.local.lines,
        extra,
      });
    }

    function guidedTargetEntries(targets = []) {
      const entries = [];
      for (const target of targets) {
        if (target.point) {
          entries.push({ object: target.point, prop: "x", value: target.x });
          entries.push({ object: target.point, prop: "y", value: target.y });
        } else if (target.object && target.prop) {
          entries.push({ object: target.object, prop: target.prop, value: target.value });
        }
      }
      return entries;
    }

    function sameGuidedTargetEntries(a = [], b = []) {
      return a.length === b.length && a.every((entry, index) =>
        entry.object === b[index].object && entry.prop === b[index].prop && entry.value === b[index].value,
      );
    }

    function guidedTargetStepForSession(session, targets) {
      const entries = guidedTargetEntries(targets);
      if (sameGuidedTargetEntries(entries, numericalState(session).pendingGuidedTargetEntries)) {
        return { entries, norm: numericalState(session).pendingGuidedTargetStepNorm };
      }
      const previous = numericalState(session).lastGuidedTargetEntries || [];
      const deltas = entries.map((entry) => {
        const prior = previous.find((candidate) => candidate.object === entry.object && candidate.prop === entry.prop);
        const previousValue = prior ? prior.value : entry.object[entry.prop];
        const rawDelta = entry.value - previousValue;
        if (
          (entry.prop === "startAngle" || entry.prop === "endAngle")
          && Number.isFinite(entry.object?.radiusValue)
        ) {
          return rawDelta * Math.max(MIN_ORIENTATION_LENGTH, Math.abs(entry.object.radiusValue));
        }
        return rawDelta;
      });
      const norm = vectorNorm(deltas);
      if (session) {
        numericalState(session).pendingGuidedTargetEntries = entries;
        numericalState(session).pendingGuidedTargetStepNorm = norm;
      }
      return { entries, norm };
    }

    function commitGuidedTargetStep(session, targetStep) {
      if (!session || !targetStep) return;
      numericalState(session).lastGuidedTargetEntries = targetStep.entries;
    }

    function solveLocalGuidedDrag(session, targets, targetStepNorm = null) {
      if (!session?.local) return null;
      const errorTolerance = Math.max(
        acceptError,
        Math.min(previewMaxModelError, DRAG_PREVIEW_ERROR_SCREEN_PX / Math.max(viewScale(), 1e-9)),
      );
      return withDragStepNorm(dragStepNormForTargets(targets), () =>
        solver.solveSubsetGuided({
          variables: session.local.variables,
          constraints: session.local.constraints,
          lines: session.local.lines,
          targets,
          errorTolerance,
          activeTargetVariables: numericalState(session).guidedTargetVariables || [],
          referenceState: session.kind === "line" && (!session.lineDragPoint || session.translationReference) ? session.fullDragState || [] : [],
          preserveTranslation: Boolean(session.translationReference),
          targetStepNorm,
        }),
      );
    }

    function dragStepNormForTargets(targets = []) {
      let maxDelta = solver.maxStepNorm;
      for (const target of targets) {
        if (target.point) {
          maxDelta = Math.max(maxDelta, hypot2(target.x - target.point.x, target.y - target.point.y));
        } else if (target.object && target.prop) {
          maxDelta = Math.max(maxDelta, Math.abs(target.value - target.object[target.prop]));
        }
      }
      return Math.max(solver.maxStepNorm, maxDelta * 1.25);
    }

    function dragStepNormForExtra(extra = []) {
      let maxDelta = solver.maxStepNorm;
      for (const constraint of extra) {
        if (constraint instanceof DragConstraint) {
          maxDelta = Math.max(maxDelta, hypot2(constraint.targetX - constraint.point.x, constraint.targetY - constraint.point.y));
        } else if (constraint instanceof ArcEndpointDragConstraint) {
          const p = arcEndpointPoint(constraint.arc, constraint.endpoint);
          maxDelta = Math.max(maxDelta, hypot2(constraint.targetX - p.x, constraint.targetY - p.y));
        } else if (constraint instanceof ParameterDragConstraint) {
          maxDelta = Math.max(maxDelta, Math.abs(constraint.target - constraint.object[constraint.prop]));
        }
      }
      return Math.max(solver.maxStepNorm, maxDelta * 1.25);
    }

    function withDragStepNorm(stepNorm, callback) {
      const previous = solver.maxStepNorm;
      solver.maxStepNorm = Math.max(previous, Number.isFinite(stepNorm) ? stepNorm : previous);
      try {
        return callback();
      } finally {
        solver.maxStepNorm = previous;
      }
    }

    function withSolverMaxIterations(maxIterations, callback) {
      const previous = solver.maxIterations;
      solver.maxIterations = Math.max(previous, maxIterations);
      try {
        return callback();
      } finally {
        solver.maxIterations = previous;
      }
    }

    function solveDragWithFallback(session, extra, restoreState = null) {
      const fullSolve = () => solveDragSketch(session, extra);
      const stepNorm = dragStepNormForExtra(extra);
      const localResult = withDragStepNorm(stepNorm, () => solveLocalDrag(session, extra));
      if (localResult && localResult.success && localResult.errorNorm <= acceptError) return localResult;
      if (restoreState) solver.restore(restoreState);
      const result = withDragStepNorm(stepNorm, fullSolve);
      result.local = false;
      result.fallback = Boolean(localResult);
      result.localErrorNorm = localResult?.errorNorm;
      return result;
    }

    function solvePinnedLineTargets(session, targets, stepNorm) {
      if (
        session?.kind !== "line"
        || session.lineDragPoint
        || !session.local
        || session.local.constraints.length !== 1
        || !(session.local.constraints[0] instanceof LineCircleDistanceConstraint)
        || targets.length < 2
        || targets.some((target) => !target.point || !Number.isFinite(target.x) || !Number.isFinite(target.y))
      ) return null;
      const targetPoints = new Set(targets.map((target) => target.point));
      const remainingVariables = session.local.variables.filter((variable) => !targetPoints.has(variable.object));
      if (remainingVariables.length === session.local.variables.length) return null;
      const state = solver.clone(session.local.variables);
      for (const target of targets) {
        target.point.x = target.x;
        target.point.y = target.y;
      }
      const result = withDragStepNorm(stepNorm, () => solver.solveSubset({
        variables: remainingVariables,
        constraints: session.local.constraints,
        lines: session.local.lines,
      }));
      if (!Number.isFinite(result.errorNorm) || result.errorNorm > acceptError) {
        solver.restore(state);
        return null;
      }
      result.success = true;
      result.local = true;
      result.guided = false;
      result.pinnedLineTargets = true;
      return result;
    }

    function solveGuidedDragWithFallback(session, targets, fallbackExtra, restoreState = null) {
      const fullSolve = () => solveDragSketch(session, fallbackExtra);
      const targetStep = guidedTargetStepForSession(session, targets);
      for (const target of targets) target.guidedStepNorm = targetStep.norm;
      const stepNorm = Math.max(dragStepNormForTargets(targets), dragStepNormForExtra(fallbackExtra));
      if (session?.local && session.local.constraints.length === 0) {
        for (const target of targets) {
          if (target.point) {
            target.point.x = target.x;
            target.point.y = target.y;
          } else if (target.object && target.prop) {
            target.object[target.prop] = target.min != null ? Math.max(target.min, target.value) : target.value;
          }
        }
        commitGuidedTargetStep(session, targetStep);
        numericalState(session).lastGuidedPreviewError = 0;
        return {
          success: true,
          errorNorm: 0,
          iterations: 0,
          reason: "直接移動",
          local: true,
          guided: true,
          variableCount: session.local.variables.length,
          constraintCount: 0,
        };
      }
      const pinnedLineResult = solvePinnedLineTargets(session, targets, stepNorm);
      if (pinnedLineResult) {
        pinnedLineResult.targetStepNorm = targetStep.norm;
        pinnedLineResult.targetConstraints = fallbackExtra;
        pinnedLineResult.guidedRetryCount = 0;
        numericalState(session).finalDragConstraints = fallbackExtra;
        commitGuidedTargetStep(session, targetStep);
        numericalState(session).lastGuidedPreviewError = pinnedLineResult.errorNorm;
        return pinnedLineResult;
      }
      const guidedAttemptState = restoreState || solver.clone(session.local?.variables || solver.getVariables());
      let localResult = null;
      let localAcceptError = acceptError;
      const acceptablePreview = (result) => result
        && Number.isFinite(result.errorNorm)
        && result.errorNorm <= localAcceptError
        && vectorNorm(solver.computeErrorVectorForConstraints(session.local.constraints)) <= acceptError;
      let guidedRetryCount = 0;
      // A missed animation frame can collapse a long line translation into one
      // nonlinear solve. Give an exact whole-sketch solve a larger iteration
      // budget first; this is substantially cheaper than replaying dozens of
      // local steps when it converges. Keep bounded substeps as the robust
      // fallback so manifold backtracking cannot dilute the pointer movement.
      if (
        session?.kind === "line"
        && session.points.length > 1
        && !session.lineDragPoint
        && session.local.fixedPointCount === 0
        && targetStep.norm > 50
      ) {
        const guidedResult = withDragStepNorm(stepNorm, () => solveLocalGuidedDrag(session, targets, targetStep.norm));
        if (guidedResult?.success && guidedResult.errorNorm <= acceptError
          && targets.every((target) => hypot2(target.point.x - target.x, target.point.y - target.y) <= acceptError)) {
          numericalState(session).finalDragConstraints = guidedResult.targetConstraints || [];
          numericalState(session).guidedTargetVariables = guidedResult.activeTargetVariables || [];
          numericalState(session).lastGuidedPreviewError = guidedResult.errorNorm;
          commitGuidedTargetStep(session, targetStep);
          return guidedResult;
        }
        solver.restore(guidedAttemptState);
        const fullVariables = sketchSolveVariables(session.sketchId);
        const fullAttemptState = solver.clone(fullVariables);
        const exactResult = withDragStepNorm(
          stepNorm,
          () => withSolverMaxIterations(100, fullSolve),
        );
        if (exactResult.success && exactResult.errorNorm <= acceptError) {
          exactResult.local = false;
          exactResult.guided = false;
          exactResult.exactSparseLine = true;
          exactResult.guidedRetryCount = 0;
          numericalState(session).finalDragConstraints = fallbackExtra;
          commitGuidedTargetStep(session, targetStep);
          numericalState(session).lastGuidedPreviewError = exactResult.errorNorm;
          return exactResult;
        }
        solver.restore(fullAttemptState);
        const substepCount = Math.min(
          SPARSE_LINE_DRAG_MAX_SUBSTEPS,
          Math.ceil(targetStep.norm / SPARSE_LINE_DRAG_SUBSTEP_NORM),
        );
        const starts = targets.map((target) => ({ x: target.point.x, y: target.point.y }));
        const previousActiveTargetVariables = numericalState(session).guidedTargetVariables || [];
        let totalIterations = 0;
        let totalProjectedNorm = 0;
        let completed = true;
        for (let index = 1; index <= substepCount; index += 1) {
          const progress = index / substepCount;
          const substepTargets = targets.map((target, targetIndex) => {
            const start = starts[targetIndex];
            return {
              ...target,
              x: start.x + (target.x - start.x) * progress,
              y: start.y + (target.y - start.y) * progress,
            };
          });
          localResult = withDragStepNorm(stepNorm, () =>
            solveLocalGuidedDrag(session, substepTargets, targetStep.norm / substepCount));
          localAcceptError = Number.isFinite(localResult?.acceptError) ? localResult.acceptError : acceptError;
          const acceptable = acceptablePreview(localResult);
          if (!acceptable) {
            completed = false;
            break;
          }
          if (!localResult.success) {
            localResult.success = true;
            localResult.approximate = true;
            localResult.reason = "プレビュー許容誤差内";
          }
          totalIterations += localResult.iterations || 0;
          totalProjectedNorm += localResult.projectedNorm || 0;
          numericalState(session).guidedTargetVariables = localResult.activeTargetVariables || numericalState(session).guidedTargetVariables || [];
        }
        if (completed && localResult?.success) {
          localResult.iterations = totalIterations;
          localResult.projectedNorm = totalProjectedNorm;
          localResult.targetStepNorm = targetStep.norm;
          localResult.guidedSubstepCount = substepCount;
          localResult.guidedRetryCount = 0;
          numericalState(session).finalDragConstraints = localResult.targetConstraints || [];
          commitGuidedTargetStep(session, targetStep);
          numericalState(session).lastGuidedPreviewError = localResult.errorNorm;
          return localResult;
        }
        solver.restore(guidedAttemptState);
        numericalState(session).guidedTargetVariables = previousActiveTargetVariables;
        localResult = null;
      }
      // A sparse pointer stream can deliver a very large reversal in one event.
      // Lines translate linearly and should follow that event exactly. For more
      // nonlinear point/arc drags, start with a shorter manifold step to avoid an
      // expensive, often singular full-step solve.
      const canShortenSparseStep = session?.mode !== "block" && session?.mode !== "block-rotation";
      const shouldTryExactSparseStep = session?.kind === "line" || targets.some((target) => target.point);
      const guidedScales = canShortenSparseStep && targetStep.norm > 50
        ? (shouldTryExactSparseStep ? [1, 0.25, 0.125, 0.0625] : [0.25, 0.125, 0.0625])
        : [1, 0.5, 0.25, 0.125, 0.0625];
      for (const scale of guidedScales) {
        if (scale < 1) solver.restore(guidedAttemptState);
        localResult = withDragStepNorm(stepNorm, () => solveLocalGuidedDrag(session, targets, targetStep.norm * scale));
        localAcceptError = Number.isFinite(localResult?.acceptError) ? localResult.acceptError : acceptError;
        const locallyAcceptable = acceptablePreview(localResult);
        if (locallyAcceptable) {
          // The nonlinear correction can exhaust its strict iteration budget
          // after already reaching the looser, screen-space preview tolerance.
          // Keep that visually valid local result; a full-document fallback is
          // both slower and less likely to converge during a sparse drag event.
          if (!localResult.success) {
            localResult.success = true;
            localResult.approximate = true;
            localResult.reason = "プレビュー許容誤差内";
          }
          break;
        }
        guidedRetryCount += 1;
      }
      if (localResult?.success && acceptablePreview(localResult)) {
        localResult.guidedRetryCount = guidedRetryCount;
        numericalState(session).finalDragConstraints = localResult.targetConstraints || [];
        numericalState(session).guidedTargetVariables = localResult.activeTargetVariables || [];
        commitGuidedTargetStep(session, targetStep);
        numericalState(session).lastGuidedPreviewError = localResult.errorNorm;
        return localResult;
      }
      if (restoreState) solver.restore(restoreState);
      const result = withDragStepNorm(stepNorm, fullSolve);
      if (result.success) {
        numericalState(session).finalDragConstraints = fallbackExtra;
        commitGuidedTargetStep(session, targetStep);
        numericalState(session).lastGuidedPreviewError = result.errorNorm;
      }
      result.local = false;
      result.guided = false;
      result.fallback = Boolean(localResult);
      result.localErrorNorm = localResult?.errorNorm;
      result.guidedRetryCount = guidedRetryCount;
      return result;
    }

    return {
      solve: solveDragWithFallback,
      guided: solveGuidedDragWithFallback,
      finish,
      solveSketch: solveDragSketch,
      targetConstraintCount: (session) => numericalState(session).finalDragConstraints?.length || 0,
    };
  }
  window.GeometryDragSolver = { create };
})();
