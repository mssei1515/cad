/* Assemble solving, parameter feedback and application refresh around the same owners. */
(() => {
  "use strict";
  function prepare() {
    let completedAnalysis;
    function refreshConstraintAnalysis(options = {}) {
      if (completedAnalysis === undefined) throw new ReferenceError("Cannot access 'constraintAnalysis' before initialization");
      return completedAnalysis.value.refresh(options);
    }
    function publishContext(build, options) {
      const context = build(options);
      completedAnalysis = { value: context.analysis };
      return context;
    }
    function prepareWithReferences(options) {
      const prepared = window.SketchSolvingFeature.prepareWithReferencesForWorkspace(options);
      const { createContextForWorkspace: buildContext, createContextWithAnnotationDrag: buildWithAnnotationDrag } = prepared;
      return Object.freeze({ ...prepared,
        createContextForWorkspace(options) { return publishContext(buildContext, options); },
        createContextWithAnnotationDrag(options) { return publishContext(buildWithAnnotationDrag, options); },
      });
    }
    return Object.freeze({ refreshConstraintAnalysis, prepareWithReferencesForWorkspace: prepareWithReferences });
  }
  function prepareWithReferencesForWorkspace({ documentWorkspace, readServices, references, solver, pointUsage, presentation }) {
    const referenceState = window.ReferenceConstraintState.create({
      currentScope: documentWorkspace.workspace.current,
      constraintSketchId: documentWorkspace.sketches.constraintSketchId,
      isReferenceSourceSketchId: documentWorkspace.sketches.isReferenceSourceSketchId,
    });
    const prepared = prepareForWorkspace({ documentWorkspace, readServices, references, referenceState, solver, pointUsage, presentation });
    return Object.freeze({ referenceState, ...prepared });
  }
  function prepareForWorkspace({ documentWorkspace, readServices, references, referenceState, solver, pointUsage, presentation }) {
    const solveState = window.SketchSolving.createState();
    let feature = null;
    function solveAndRefresh(...args) {
      if (!feature) throw new ReferenceError("Cannot access 'solveRefreshCommand' before initialization");
      return feature.refresh.run(...args);
    }
    function createContext({ annotationDrag, minimumLength, acceptError }) {
      const context = createContextForWorkspace({ documentWorkspace, readServices, references, referenceState, solver, pointUsage, presentation,
        solveState, annotationDrag, minimumLength, acceptError });
      const build = context.createSolving;
      function createSolving(options) {
        const completed = build(options);
        feature = completed;
        return completed;
      }
      return Object.freeze({ ...context, createSolving });
    }
    function createContextWithAnnotationDrag({ createAnnotationDrag, geometryDrag, minimumLength, acceptError }) {
      let completedAnalysis;
      function invalidateAnalysis() {
        if (completedAnalysis === undefined) throw new ReferenceError("Cannot access 'constraintAnalysis' before initialization");
        return completedAnalysis.value.invalidate();
      }
      const annotationDrag = createAnnotationDrag({ buildPlan: geometryDrag.build, beginGeometryDrag: geometryDrag.begin, invalidateAnalysis });
      const context = createContext({ annotationDrag, minimumLength, acceptError });
      const result = Object.freeze({ ...context, annotationDrag });
      completedAnalysis = { value: result.analysis };
      return result;
    }
    return Object.freeze({ solveState, solveAndRefresh, createContextForWorkspace: createContext, createContextWithAnnotationDrag });
  }
  // Query/analysis precede Canvas construction; solving waits for the editing owners.
  function createContextForWorkspace({ documentWorkspace, readServices, references, referenceState, annotationDrag,
    solver, pointUsage, presentation, solveState, minimumLength, acceptError }) {
    const { workspace, sketches } = documentWorkspace;
    const { constraintGraphNodes, geometryInstanceDependencyRefs } = references;
    const { constraintIsOperational, refreshReferenceConstraintValidity } = referenceState;
    const scopeQuery = window.SolveScopeQuery.create({
      currentScope: annotationDrag.scope, additionalVariables: annotationDrag.additionalVariables,
      geometryReads: readServices.reads, activeSketchId: sketches.activeSketchId, elementSketchId: sketches.elementSketchId, constraintSketchId: sketches.constraintSketchId,
      isVisibleSketchElement: readServices.geometryAppearance.isVisibleSketchElement, constraintIsOperational,
      constraintGraphNodes: constraint => constraint.annotationGeometryNodes || constraintGraphNodes(constraint), geometryInstanceDependencyRefs, minimumLength,
    });
    const { profiler } = presentation, { work: profileWork } = profiler;
    const { analysis, redundancy } = window.ConstraintAnalysis.createWithRedundancy({
      currentScope: workspace.current, solver, scopeQuery, sketchContext: sketches, readServices, constraintIsOperational,
      refreshReferenceConstraintValidity, sketchHasSolveError: solveState.hasError, isExplicitPoint: pointUsage.isExplicitPoint, minimumLength, acceptError,
      profileAnalysis: work => profiler.active ? profileWork("analysis", work) : work(),
    });
    function createSolving({ projectionEditing, geometry, checkpoint, editingScope, historyController, recordHistory, resultIsAccepted, maxPasses = 20, relativeTolerance = 1e-7 }) {
      return createForWorkspace({ documentWorkspace, scopeQuery, references, referenceState, readServices, analysis, presentation, solveState, acceptError,
        projectionEditing, geometry, checkpoint, editingScope, historyController, recordHistory, resultIsAccepted, maxPasses, relativeTolerance });
    }
    function createLineCollapseQuery() {
      return window.LineCollapseQuery.create({
        connectedComponentFromSeeds: scopeQuery.connectedComponentFromSeeds, constraintGraphNodes,
        localSolveLines: scopeQuery.localSolveLines, minLineLength: minimumLength,
      });
    }
    return Object.freeze({ scopeQuery, analysis, redundancy, createSolving, createLineCollapseQuery });
  }
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
  // Preserve the distinction between Workspace scope and the last activated editing scope.
  function createForWorkspace({ documentWorkspace, scopeQuery, references, referenceState, readServices, projectionEditing, geometry, checkpoint,
    editingScope, analysis, presentation, historyController, recordHistory, resultIsAccepted, acceptError, solveState, maxPasses, relativeTolerance }) {
    const { workspace, sketches, parameters: namespace, documentIds } = documentWorkspace;
    const { activeSketchId, elementSketchId, constraintSketchId, orderedSketches } = sketches;
    const { constraintGraphNodes } = references, { constraintIsOperational, refreshReferenceConstraintValidity } = referenceState;
    const { geometryInstanceBundles } = readServices.reads, { blockDefinitionDrawableSketchIds: drawableSketchIds } = readServices.catalog;
    const { synchronizeSketchProjectionMetadata } = projectionEditing, { normalizeArcSweeps } = geometry;
    const { captureValues: snapshotModelState, restoreValues: restoreModelState } = checkpoint;
    const { settings: { applicationText }, profiler, setSolveResultHint, updateUI, draw } = presentation;
    return create({ currentScope: workspace.current, solver: editingScope.solver, scopeQuery, activeSketchId, elementSketchId,
      constraintSketchId, constraintGraphNodes, constraintIsOperational, geometryInstanceBundles, orderedSketches,
      synchronizeSketchProjectionMetadata, refreshReferenceConstraintValidity, normalizeArcSweeps,
      resultIsAccepted, snapshotModelState, restoreModelState, acceptError, solveState,
      namespace, currentParameterNamespace: workspace.current, maxPasses, relativeTolerance, applicationText, profiler,
      readEditingScope: () => editingScope.current, activateEditingScope: (...args) => editingScope.activate(...args), nextHatchIndex: () => documentIds.peek("hatch"),
      drawableSketchIds, refreshConstraintAnalysis: (options = {}) => analysis.refresh(options), setSolveResultHint, updateUI, draw, historyController, recordHistory });
  }
  window.SketchSolvingFeature = Object.freeze({ prepareWithReferencesForWorkspace, prepareForWorkspace, create, createForWorkspace, createContextForWorkspace, prepare });
})();
