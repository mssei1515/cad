/* Coordinate Sketch solving and retain its transient result states. */
(() => {
  "use strict";
  const { vectorNorm } = window.GeometrySolver;
  function create({ currentScope, solver, scopeQuery, activeSketchId, elementSketchId, constraintSketchId,
    constraintGraphNodes, constraintIsOperational, geometryInstanceBundles, orderedSketches,
    synchronizeSketchProjectionMetadata, refreshReferenceConstraintValidity, normalizeArcSweeps,
    resultIsAccepted, restoreModelState, profileDependencies, acceptError }) {
    const sketchSolveStates = new Map();
    const { sketchSolveVariables, sketchSolveConstraints, sketchSolveLines, localSolveContextFromSeeds } = scopeQuery;
    function clearSketchSolveState(sketchId) {
      sketchSolveStates.delete(sketchId);
    }

    function setSketchSolveOk(sketchId, result, sourceSketchId = sketchId) {
      sketchSolveStates.set(sketchId, { status: "ok", sourceSketchId, result });
    }

    function setSketchSolveError(sketchId, result, sourceSketchId = sketchId) {
      sketchSolveStates.set(sketchId, {
        status: "error",
        sourceSketchId,
        errorNorm: Number.isFinite(result?.errorNorm) ? result.errorNorm : Infinity,
        reason: result?.reason || "solve failed",
        result,
      });
    }

    function sketchSolveState(sketchId) {
      return sketchSolveStates.get(sketchId) || null;
    }

    function solveActiveSketch(extra = []) {
      const sketchId = activeSketchId();
      synchronizeSketchProjectionMetadata(sketchId);
      return solver.solveSubset({
        variables: sketchSolveVariables(sketchId),
        constraints: sketchSolveConstraints(sketchId),
        lines: sketchSolveLines(sketchId),
        extra,
      });
    }

    function solveSketchById(sketchId, extra = [], variableAllowed = null) {
      synchronizeSketchProjectionMetadata(sketchId);
      return solver.solveSubset({
        variables: variableAllowed ? sketchSolveVariables(sketchId).filter(variableAllowed) : sketchSolveVariables(sketchId),
        constraints: sketchSolveConstraints(sketchId),
        lines: sketchSolveLines(sketchId),
        extra,
      });
    }

    function solveReferenceDependentSketches(rootSketchId) {
      return profileDependencies(() => solveReferenceDependentSketchesUnprofiled(rootSketchId));
    }

    function solveReferenceDependentSketchesUnprofiled(rootSketchId) {
      refreshReferenceConstraintValidity();
      const results = [];
      const dependentsBySource = new Map();
      const addDependency = (sourceSketchId, dependentSketchId) => {
        if (!sourceSketchId || !dependentSketchId || sourceSketchId === dependentSketchId) return;
        if (!dependentsBySource.has(sourceSketchId)) dependentsBySource.set(sourceSketchId, new Set());
        dependentsBySource.get(sourceSketchId).add(dependentSketchId);
      };
      for (const constraint of currentScope().constraints) {
        if (!constraintIsOperational(constraint) || !constraint.reference || !constraint.referenceSketchId) continue;
        const dependentSketchId = constraintSketchId(constraint);
        addDependency(constraint.referenceSketchId, dependentSketchId);
      }
      for (const bundle of geometryInstanceBundles()) {
        if (!bundle.valid) continue;
        const outputs = [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...bundle.splines];
        for (const source of new Set(outputs.map((item) => item.sourceElement).filter(Boolean))) {
          addDependency(elementSketchId(source), bundle.instance.sketchId);
        }
      }

      const affected = new Set([rootSketchId]);
      const pending = [rootSketchId];
      while (pending.length > 0) {
        const sourceSketchId = pending.shift();
        for (const dependentSketchId of dependentsBySource.get(sourceSketchId) || []) {
          if (affected.has(dependentSketchId)) continue;
          affected.add(dependentSketchId);
          pending.push(dependentSketchId);
        }
      }

      const indegree = new Map([...affected].map((sketchId) => [sketchId, 0]));
      for (const [sourceSketchId, dependents] of dependentsBySource) {
        if (!affected.has(sourceSketchId)) continue;
        for (const dependentSketchId of dependents) {
          if (affected.has(dependentSketchId)) indegree.set(dependentSketchId, (indegree.get(dependentSketchId) || 0) + 1);
        }
      }
      const orderIndex = new Map(orderedSketches().map((sketch, index) => [sketch.id, index]));
      const ready = [...affected]
        .filter((sketchId) => (indegree.get(sketchId) || 0) === 0)
        .sort((a, b) => (orderIndex.get(a) ?? Infinity) - (orderIndex.get(b) ?? Infinity));
      const processed = new Set();
      while (ready.length > 0) {
        const sketchId = ready.shift();
        if (processed.has(sketchId)) continue;
        processed.add(sketchId);
        if (sketchId !== rootSketchId) {
          clearSketchSolveState(sketchId);
          const result = solveSketchById(sketchId);
          normalizeArcSweeps();
          const status = resultIsAccepted(result) ? "ok" : "error";
          if (status === "ok") setSketchSolveOk(sketchId, result, rootSketchId);
          else setSketchSolveError(sketchId, result, rootSketchId);
          results.push({ sketchId, result, status });
        }
        for (const dependentSketchId of dependentsBySource.get(sketchId) || []) {
          if (!affected.has(dependentSketchId)) continue;
          indegree.set(dependentSketchId, (indegree.get(dependentSketchId) || 0) - 1);
          if (indegree.get(dependentSketchId) === 0) {
            ready.push(dependentSketchId);
            ready.sort((a, b) => (orderIndex.get(a) ?? Infinity) - (orderIndex.get(b) ?? Infinity));
          }
        }
      }

      for (const sketchId of affected) {
        if (sketchId === rootSketchId || processed.has(sketchId)) continue;
        const result = { success: false, errorNorm: Infinity, iterations: 0, reason: "循環参照" };
        setSketchSolveError(sketchId, result, rootSketchId);
        results.push({ sketchId, result, status: "error" });
      }
      const failed = results.find((entry) => entry.status === "error");
      return { success: !failed, sketchId: failed?.sketchId || null, result: failed?.result || null, results };
    }

    function solveSketchAndDependents(sketchId = activeSketchId(), rollbackState = null, variableAllowed = null) {
      refreshReferenceConstraintValidity();
      clearSketchSolveState(sketchId);
      const result = solveSketchById(sketchId, [], variableAllowed);
      normalizeArcSweeps();
      if (!resultIsAccepted(result)) {
        if (rollbackState) {
          restoreModelState(rollbackState);
          clearSketchSolveState(sketchId);
        } else {
          setSketchSolveError(sketchId, result, sketchId);
        }
        return { success: false, sketchId, result, dependent: { success: true, results: [] } };
      }
      setSketchSolveOk(sketchId, result, sketchId);
      const dependent = solveReferenceDependentSketches(sketchId);
      return { success: true, sketchId, result, dependent };
    }

    function solveConstraintComponentAndDependents(constraint, rollbackState = null) {
      const sketchId = constraintSketchId(constraint);
      refreshReferenceConstraintValidity();
      clearSketchSolveState(sketchId);
      const context = localSolveContextFromSeeds(constraintGraphNodes(constraint), sketchId);
      let result = solver.solveSubset(context);
      normalizeArcSweeps();
      const globalConstraints = sketchSolveConstraints(sketchId);
      const globalErrorAfterLocal = vectorNorm(solver.computeErrorVectorForConstraints(globalConstraints));
      let fullFallback = false;
      if (resultIsAccepted(result) && globalErrorAfterLocal > acceptError) {
        result = solveSketchById(sketchId);
        normalizeArcSweeps();
        result.localErrorNorm = globalErrorAfterLocal;
        result.fullFallback = true;
        fullFallback = true;
      }
      if (!resultIsAccepted(result)) {
        if (rollbackState) {
          restoreModelState(rollbackState);
          clearSketchSolveState(sketchId);
        } else {
          setSketchSolveError(sketchId, result, sketchId);
        }
        return { success: false, sketchId, result, dependent: { success: true, results: [] }, local: !fullFallback, fullFallback };
      }
      setSketchSolveOk(sketchId, result, sketchId);
      const dependent = solveReferenceDependentSketches(sketchId);
      return { success: true, sketchId, result, dependent, local: !fullFallback, fullFallback };
    }


    return Object.freeze({ clearSketchSolveState, setSketchSolveOk, setSketchSolveError, sketchSolveState, solveActiveSketch, solveSketchById, solveReferenceDependentSketches, solveSketchAndDependents, solveConstraintComponentAndDependents, clearAll: () => sketchSolveStates.clear() });
  }
  window.SketchSolving = Object.freeze({ create });
})();
