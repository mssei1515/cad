/* Compose Document data, editing scope queries and ID owners without UI or history. */
(() => {
  "use strict";
  function create({ applicationText, constraintGraphNodes, nextHatchIndex }) {
    const document = window.DocumentState.create();
    const workspace = window.EditingWorkspace.create(document);
    const parameters = window.ParameterNamespace.create({ currentParameterNamespace: workspace.current, applicationText });
    const sketches = window.SketchContext.create({ currentScope: workspace.current, constraintGraphNodes });
    const geometryIds = window.GeometryIds.create();
    const documentIds = window.DocumentIds.create();
    const reservation = window.DocumentIds.createReservation({ geometryIds, documentIds, nextHatchIndex });
    function createGeometryReadServices({ currentSketches, prepareBlocks, showHiddenElements, viewportScale, profileRead }) {
      const { elementSketchId, sketchById, isRootSketch, activeSketchId } = sketches;
      return window.GeometryReadServices.createWithHatches({ document, currentScope: workspace.current, currentSketches,
        prepareBlocks, elementSketchId, applicationText, sketchById, isRootSketch, activeSketchId,
        showHiddenElements, viewportScale, profileRead });
    }
    function createReadContext({ currentSketches, prepareBlocks, showHiddenElements, viewportScale, profileRead }) {
      const services = createGeometryReadServices({ currentSketches, prepareBlocks, showHiddenElements, viewportScale, profileRead });
      function createScopeBinding({ Solver, closeSketchContext, resetSketchMove }) {
        return window.EditingScopeBinding.create({ workspace, Solver, closeSketchContext, resetSketchMove,
          clearGeometryReads: () => services.reads.clearReadCache(),
          invalidateProjection: services.projections.invalidateBlockProjectionCache });
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
        return Object.freeze({ dimensions, codecs, metadata, preparation, writer, loading, geometryInstances });
      }
      return Object.freeze({ services, createScopeBinding, createPersistence });
    }
    return Object.freeze({ document, workspace, parameters, sketches, geometryIds, documentIds, reservation, createGeometryReadServices, createReadContext });
  }
  window.DocumentWorkspace = Object.freeze({ create });
})();
