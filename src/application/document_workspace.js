/* Compose Document data, editing scope queries and ID owners without UI or history. */
(() => {
  "use strict";
  function create(options) {
    const { applicationText, constraintGraphNodes, nextHatchIndex: suppliedHatchIndex } = options;
    let completedBinding;
    function readEditingScope() {
      if (completedBinding === undefined) throw new ReferenceError("Cannot access 'editingScopeBinding' before initialization");
      return completedBinding.value.current;
    }
    const nextHatchIndex = () => readEditingScope().nextHatchIndex;
    const currentSketches = () => readEditingScope().sketches;
    const document = window.DocumentState.create();
    const workspace = window.EditingWorkspace.create(document);
    const parameters = window.ParameterNamespace.create({ currentParameterNamespace: workspace.current, applicationText });
    const sketches = window.SketchContext.create({ currentScope: workspace.current, constraintGraphNodes });
    const geometryIds = window.GeometryIds.create();
    const documentIds = window.DocumentIds.create();
    const reservation = window.DocumentIds.createReservation({ geometryIds, documentIds,
      nextHatchIndex: "nextHatchIndex" in options ? suppliedHatchIndex : nextHatchIndex });
    function createGeometryReadServices({ currentSketches, prepareBlocks, showHiddenElements, viewportScale, profileRead }) {
      const { elementSketchId, sketchById, isRootSketch, activeSketchId } = sketches;
      return window.GeometryReadServices.createWithHatches({ document, currentScope: workspace.current, currentSketches,
        prepareBlocks, elementSketchId, applicationText, sketchById, isRootSketch, activeSketchId,
        showHiddenElements, viewportScale, profileRead });
    }
    function createReadContext(options) {
      const { currentSketches: suppliedSketches, prepareBlocks, showHiddenElements, viewportScale, profileRead } = options;
      let currentPersistence, currentApplication;
      function requirePersistence(binding) {
        if (currentPersistence === undefined) throw new ReferenceError(`Cannot access '${binding}' before initialization`);
        return currentPersistence;
      }
      function ensureBlockState() { return requirePersistence("documentPreparation").preparation.blocks(); }
      const services = createGeometryReadServices({ currentSketches: "currentSketches" in options ? suppliedSketches : currentSketches,
        prepareBlocks: prepareBlocks === undefined ? ensureBlockState : prepareBlocks, showHiddenElements, viewportScale, profileRead });
      function serializeConstraint(c) { return requirePersistence("constraintCodecs").codecs.serialize(c); }
      function deserializeConstraint(...args) { return requirePersistence("constraintCodecs").codecs.deserialize(...args); }
      function decorateSerializedConstraint(data, constraint) { return requirePersistence("constraintMetadata").metadata.decorate(data, constraint); }
      function serializeModel() { return requirePersistence("documentWriter").writer.serialize(); }
      function normalizeGeometryInstance(raw, ...args) {
        const { normalizeGeometryInstance: normalize } = requirePersistence("normalizeEditingGeometryInstance");
        return normalize(raw, ...args);
      }
      function requireApplication() {
        if (currentApplication === undefined) throw new ReferenceError("Cannot access 'documentApplication' before initialization");
        return currentApplication;
      }
      function loadModelData(data, options = {}) { return requireApplication().load(data, options); }
      function readRepairMessage() { return requireApplication().blockConstraintRepairMessage; }
      const persistence = Object.freeze({ serializeConstraint, deserializeConstraint, decorateSerializedConstraint, serializeModel, ensureBlockState,
        normalizeGeometryInstance, loadModelData, readRepairMessage });
      function createRebinding() {
        return window.ConstraintRebinding.create({ catalog: services.catalog, projections: services.projections,
          geometryInstanceBundlesForScope: services.instances.geometryInstanceBundlesForScope,
          serializeConstraint, decorateSerializedConstraint, deserializeConstraint, applicationText });
      }
      function createScopeBinding({ Solver, closeSketchContext, resetSketchMove }) {
        return window.EditingScopeBinding.create({ workspace, Solver, closeSketchContext, resetSketchMove,
          clearGeometryReads: () => services.reads.clearReadCache(),
          invalidateProjection: services.projections.invalidateBlockProjectionCache });
      }
      // Bind model reads and insertion together while keeping Parameter writes on Workspace.current.
      function createEditingScope(options) {
        const { Solver: suppliedSolver, closeSketchContext, resetSketchMove } = options;
        const Solver = "Solver" in options ? suppliedSolver : window.GeometrySolver.ConstraintSolver;
        const binding = createScopeBinding({ Solver, closeSketchContext, resetSketchMove });
        const { solver } = binding;
        const { activeSketchId, constraintSketchId, isDrawableSketch, firstDrawableSketchId } = sketches;
        const { ensureDimensionParameter } = parameters;
        const dimensionQueries = window.DimensionQueries.createModelQueries({
          currentScope: () => binding.current, activeSketchId, constraintSketchId });
        const insertion = window.ConstraintCommitCommand.createInsertion({
          currentScope: () => binding.current, currentParameterNamespace: workspace.current,
          activeSketchId, isDrawableSketch, firstDrawableSketchId, ensureDimensionParameter });
        const editing = Object.freeze({ binding, solver, dimensionQueries, insertion });
        completedBinding = Object.freeze({ value: binding });
        return editing;
      }
      function createPersistence({ placement, pointUsage, readEditingScope, readBlockEditor, version,
        constraintReferencesPoint, separateSharedSketchProjectionTargetPoints, normalizeArcSweeps }) {
        const { dimensions, codecs } = window.ConstraintPersistence.createWithDimensions({
          geometryId: window.GeometryObjects.geometryIdForItem, placement });
        const metadata = window.ConstraintPersistence.createMetadata({ serializeConstraint: codecs.serialize,
          numericDimensionExpression: parameters.numericDimensionExpression, constraintSketchId: sketches.constraintSketchId });
        const preparation = window.DocumentApplication.createPreparation({ document, currentScope: readEditingScope,
          readBlockEditor, sketchContext: sketches, parameterNamespace: parameters, blockCatalog: services.catalog });
        const writer = window.DocumentSnapshot.createWriter({ workspace, prepare: preparation.prepare, version,
          documentName: () => window.DocumentFiles.effectiveDocumentNameFromValue(document.documentName),
          nextHatchIndex: () => documentIds.peek("hatch"),
          geometryMetadata: services.createSnapshotMetadata({ pointUsage }), constraintData: metadata.snapshotData });
        const { loading, geometryInstances } = window.DocumentLoading.createWithCodecs({
          createBlockProjectionBundle: services.projections.createBlockProjectionBundle,
          geometryInstanceBundlesForScope: services.instances.geometryInstanceBundlesForScope,
          elementSketchId: sketches.elementSketchId, deserializeConstraint: codecs.deserialize, constraintSketchId: sketches.constraintSketchId,
          separateSharedSketchProjectionTargetPoints, prepareLoadedParameterNamespace: parameters.prepareLoadedParameterNamespace,
          isPointUsedByLine: pointUsage.isPointUsedByLine, isPointUsedByCircle: pointUsage.isPointUsedByCircle,
          isPointUsedByArc: pointUsage.isPointUsedByArc, constraintReferencesPoint,
          defaultUnits: window.DocumentState.DEFAULT_DOCUMENT_UNITS, applicationText,
          invalidateProjection: services.projections.invalidateBlockProjectionCache, normalizeArcSweeps });
        const { activeSketchId } = sketches;
        function normalizeGeometryInstance(raw, normalizeSketch = value => String(value || activeSketchId()), index = 0) {
          return geometryInstances.normalize(raw, normalizeSketch, index);
        }
        const { targetFromConstraint } = window.DimensionQueries;
        function ensureDimensionDefaults() {
          return window.DocumentState.normalizeDimensionState(readEditingScope(), targetFromConstraint,
            (target, dimension) => placement.normalizeDimension(target, dimension));
        }
        function createApplication({ resetEditingState, sketchTreeView, refreshReferenceConstraintValidity, enforceMinimumLineLengths, log }) {
          const application = window.DocumentApplication.create({ documentLoading: loading, document, model: readEditingScope(), resetEditingState, sketchTreeView,
            refreshReferenceConstraintValidity, enforceMinimumLineLengths, ensureDimensionDefaults,
            restoreSequences: sequences => { reservation.geometry(sequences.geometry); documentIds.restore(sequences); },
            ensureAppearanceState: () => preparation.appearance(), ensureBlockState: () => preparation.blocks(), log });
          currentApplication = application;
          return application;
        }
        const result = Object.freeze({ dimensions, codecs, metadata, preparation, writer, loading, geometryInstances, normalizeGeometryInstance, ensureDimensionDefaults, createApplication, version });
        currentPersistence = result;
        return result;
      }
      function createPersistenceForWorkspace(options) {
        const defaults = { version: window.DocumentSnapshot.CURRENT_VERSION };
        if (!("readEditingScope" in options)) defaults.readEditingScope = readEditingScope;
        return createPersistence({ ...defaults, ...options });
      }
      return Object.freeze({ services, persistence, createRebinding, createScopeBinding, createEditingScope, createPersistence, createPersistenceForWorkspace });
    }
    return Object.freeze({ document, workspace, parameters, sketches, geometryIds, documentIds, reservation, readEditingScope, createGeometryReadServices, createReadContext });
  }
  window.DocumentWorkspace = Object.freeze({ create });
})();
