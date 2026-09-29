/* Evaluate parameter feedback and follow dimensional target changes through solving. */
(() => {
  "use strict";
  const { isReadOnlyDimension } = window.DimensionQueries;
  function create({ namespace, currentParameterNamespace, activeSketchId, solveSketchAndDependents,
    captureValues, restoreValues, maxPasses, relativeTolerance, nonConvergenceReason, profile }) {
    const { ensureParameterNamespace, referenceDimensionValues, dimensionConstraintsInNamespace,
      evaluateParameterNamespace, parameterErrorText } = namespace;
    function referenceValuesConverged(previous, next) {
      if (previous.size !== next.size) return false;
      for (const [name, value] of next) {
        const before = previous.get(name);
        if (!Number.isFinite(before)) return false;
        const tolerance = relativeTolerance * Math.max(1, Math.abs(value));
        if (Math.abs(value - before) > tolerance) return false;
      }

      return true;
    }

    function parameterFailureResult(reason) {
      return { success: false, errorNorm: Infinity, iterations: 0, reason };
    }

    function stabilizeActiveParameterNamespace(sketchId = activeSketchId(), options = {}) {
      return profile(() => stabilizeActiveParameterNamespaceUnprofiled(sketchId, options));
    }

    function solveParameterTargetTransition(sketchId, requestedSketchIds, variableAllowed, previousTargets) {
      const solvePass = () => {
        let solved = null;
        const dependentResults = [];
        for (const requestedSketchId of [...new Set(requestedSketchIds)]) {
          const item = solveSketchAndDependents(requestedSketchId, null, variableAllowed);
          solved ||= item;
          dependentResults.push(...(item.dependent?.results || []));
          if (!item.success || item.dependent?.success === false) return item;
        }
        solved ||= { success: true, sketchId, result: { success: true, errorNorm: 0, iterations: 0 } };
        solved.dependent = { success: true, results: dependentResults };
        return solved;
      };
      const changes = [...previousTargets]
        .filter(([constraint, value]) => constraint.enabled !== false && Number.isFinite(value) && value > 0 && constraint.target !== value)
        .map(([constraint, value]) => ({ constraint, start: value, end: constraint.target }));
      if (!changes.length) return solvePass();

      // Follow the existing solution branch before attempting a large target
      // change. All dependent targets share the same interpolation progress;
      // intermediate steps are internal to the caller's single transaction.
      let progress = 0;
      let solved;
      try {
        for (let step = 0; progress < 1 && step < 128; step++) {
          let increment = 1 - progress;
          for (const change of changes) {
            const current = change.start + (change.end - change.start) * progress;
            increment = Math.min(increment, 0.2 * current / Math.abs(change.end - change.start));
          }
          const state = captureValues();
          let accepted = false;
          for (let retry = 0; retry < 12; retry++) {
            const nextProgress = Math.min(1, progress + increment);
            for (const change of changes) change.constraint.target = nextProgress === 1 ? change.end : change.start + (change.end - change.start) * nextProgress;
            solved = solvePass();
            if (solved.success && solved.dependent?.success !== false) {
              progress = nextProgress;
              accepted = true;
              break;
            }
            restoreValues(state);
            increment *= 0.5;
          }
          if (!accepted) return solved;
        }
        if (progress === 1) return solved;
        return { success: false, sketchId, result: parameterFailureResult(nonConvergenceReason()), dependent: { success: true, results: [] } };
      } finally {
        for (const change of changes) change.constraint.target = change.end;
      }
    }

    function stabilizeActiveParameterNamespaceUnprofiled(sketchId = activeSketchId(), options = {}) {
      let previous;
      try {
        ensureParameterNamespace(currentParameterNamespace());
        previous = referenceDimensionValues(currentParameterNamespace());
      } catch (error) {
        const result = parameterFailureResult(parameterErrorText(error));
        return { success: false, sketchId, result, dependent: { success: true, results: [] }, parameterError: error };
      }
      const hasReferences = previous.size > 0;
      for (let pass = 0; pass < maxPasses; pass += 1) {
        const previousTargets = new Map(dimensionConstraintsInNamespace(currentParameterNamespace())
          .filter((constraint) => !isReadOnlyDimension(constraint))
          .map((constraint) => [constraint, constraint.target]));
        try {
          evaluateParameterNamespace(currentParameterNamespace(), { referenceValues: previous });
        } catch (error) {
          const result = parameterFailureResult(parameterErrorText(error));
          return { success: false, sketchId, result, dependent: { success: true, results: [] }, parameterError: error };
        }
        const requestedSketchIds = Array.isArray(options.allSketches) && options.allSketches.length > 0 ? options.allSketches : [sketchId];
        const solved = solveParameterTargetTransition(sketchId, requestedSketchIds, options.variableAllowed, previousTargets);
        if (!solved.success || solved.dependent?.success === false) return solved;
        let next;
        try {
          next = referenceDimensionValues(currentParameterNamespace());
        } catch (error) {
          const result = parameterFailureResult(parameterErrorText(error));
          return { success: false, sketchId, result, dependent: solved.dependent, parameterError: error };
        }
        if (!hasReferences || referenceValuesConverged(previous, next)) {
          evaluateParameterNamespace(currentParameterNamespace(), { referenceValues: next });
          solved.parameterPasses = pass + 1;
          return solved;
        }
        previous = next;
      }
      const result = parameterFailureResult(nonConvergenceReason());
      return { success: false, sketchId, result, dependent: { success: true, results: [] }, parameterNonConvergent: true };
    }


    return Object.freeze({ stabilize: stabilizeActiveParameterNamespace });
  }
  window.ParameterStabilization = Object.freeze({ create });
})();
