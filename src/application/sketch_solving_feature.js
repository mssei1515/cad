/* Assemble solving, parameter feedback and application refresh around the same owners. */
(() => {
  "use strict";
  function create({ currentScope, solver, scopeQuery, activeSketchId, elementSketchId, constraintSketchId,
    constraintGraphNodes, constraintIsOperational, geometryInstanceBundles, orderedSketches,
    synchronizeSketchProjectionMetadata, refreshReferenceConstraintValidity, normalizeArcSweeps,
    resultIsAccepted, snapshotModelState, restoreModelState, acceptError, solveState, namespace, currentParameterNamespace,
    maxPasses, relativeTolerance, applicationText, profiler, readEditingScope, activateEditingScope, nextHatchIndex,
    drawableSketchIds, refreshConstraintAnalysis, setSolveResultHint, updateUI, draw, historyController, recordHistory }) {
    const { work: profileWork } = profiler;
    const solving = window.SketchSolving.create({ currentScope, solver, scopeQuery, activeSketchId, elementSketchId,
      constraintSketchId, constraintGraphNodes, constraintIsOperational, geometryInstanceBundles, orderedSketches,
      synchronizeSketchProjectionMetadata, refreshReferenceConstraintValidity, normalizeArcSweeps,
      resultIsAccepted, restoreModelState, acceptError, state: solveState,
      profileDependencies: work => profiler.active ? profileWork("dependencies", work) : work() });
    const parameters = window.ParameterStabilization.create({ namespace, currentParameterNamespace, activeSketchId,
      solveSketchAndDependents: solving.solveSketchAndDependents, captureValues: snapshotModelState, restoreValues: restoreModelState,
      maxPasses, relativeTolerance, nonConvergenceReason: () => applicationText("Parameter計算が収束しません", "Parameter calculation did not converge"),
      profile: work => profiler.active ? profileWork("parameters", work) : work() });
    const storedDefinitions = window.ParameterStabilization.createStoredDefinition({ currentScope: readEditingScope,
      activateScope: activateEditingScope, nextHatchIndex, drawableSketchIds, stabilizeNamespace: parameters.stabilize });
    const refresh = window.SolveRefreshCommand.create({ activeSketchId, stabilizeActiveParameterNamespace: parameters.stabilize,
      refreshConstraintAnalysis, setSolveResultHint, updateUI, draw, historyController, recordHistory });
    return Object.freeze({ solving, parameters, storedDefinitions, refresh });
  }
  window.SketchSolvingFeature = Object.freeze({ create });
})();
