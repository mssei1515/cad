/* Decode a document candidate and install its data; no UI, history, or selection. */
(() => {
  "use strict";
  const { validSerializedReferenceImageList } = window.ReferenceImageData;
  const { loadedDimensionAppearance, normalizeAppearance, normalizeConstructionAppearance } = window.Appearance;
  const { effectiveDocumentNameFromValue, DEFAULT_DOCUMENT_NAME } = window.DocumentFiles;
  const { ensureDrawingOrderState } = window.DrawingOrder;
  const { nextSeq } = window.GeometryIds;
  const { migrateLegacyExpression: migrateLegacyParameterExpression } = window.ParameterEngine;

  function create({ blockDefinitionPersistence, blockConnectionsPersistence, documentGeometryPersistence,
    geometryInstancePersistence, serializedGeometryInstanceListError, normalizeGeometryInstance,
    defaultUnits: DEFAULT_DOCUMENT_UNITS, applicationText, invalidateProjection, normalizeArcSweeps }) {
    function decode(data, options = {}) {
      if (!data || !Array.isArray(data.points) || !Array.isArray(data.lines) || !Array.isArray(data.constraints)) {
        throw new Error("保存データの形式が正しくありません");
      }
      const sourceVersion = Number(data.version) || 1;
      data = structuredClone(data);
      geometryInstancePersistence.migrateLegacy(data, sourceVersion);
      for (const definition of Array.isArray(data.blockDefinitions) ? data.blockDefinitions : []) geometryInstancePersistence.migrateLegacy(definition, sourceVersion);
      if (sourceVersion >= 20 && (!data.units || typeof data.units !== "object" || Array.isArray(data.units) || data.units.length !== "mm")) {
        throw new Error(applicationText("Documentの長さ単位が正しくありません", "Invalid document length unit"));
      }
      const loadedUnits = { ...DEFAULT_DOCUMENT_UNITS };
      const normalizeLoadedExpression = (value) => sourceVersion < 17
        ? migrateLegacyParameterExpression(String(value ?? ""))
        : String(value ?? "");
      if (sourceVersion >= 15 && !Array.isArray(data.splines)) throw new Error(applicationText("スプライン配列がありません", "The spline array is missing"));
      if (sourceVersion >= 18 && !validSerializedReferenceImageList(data.referenceImages)) throw new Error(applicationText("参照画像の形式が正しくありません", "Invalid reference image data"));
      if (sourceVersion >= 21 && !Array.isArray(data.geometryInstances)) throw new Error(applicationText("派生インスタンス配列がありません", "The derived instance array is missing"));
      const rootGeometryInstanceError = serializedGeometryInstanceListError(data.geometryInstances || []);
      if (rootGeometryInstanceError) throw new Error(`${applicationText("派生インスタンス", "Derived instances")}: ${rootGeometryInstanceError}`);
      const normalizeLoadedDimensionAppearance = (value, options = {}) => loadedDimensionAppearance(value, sourceVersion, options);
      const loadedDocumentName = effectiveDocumentNameFromValue(options.documentNameOverride || data.documentName || options.documentNameFallback || DEFAULT_DOCUMENT_NAME);

      const { sketches: loadedSketches, ids: loadedSketchIds, normalizeId: normalizeSketchId } = window.SketchHierarchy.decode(data.sketches, {
        dimensionAppearanceLoader: normalizeLoadedDimensionAppearance,
      });

      const { definitions: loadedBlockDefinitions, metadata: loadedBlockDefinitionMeta } = blockDefinitionPersistence.decode(data.blockDefinitions, {
        sourceVersion, normalizeLoadedExpression, normalizeLoadedDimensionAppearance,
      });
      const loadedBlockInstancesCodec = window.BlockInstancePersistence.create({
        definitions: loadedBlockDefinitions, metadata: loadedBlockDefinitionMeta, normalizeGeometryInstance,
      });
      const loadedDefinitionById = loadedBlockInstancesCodec.definitionById;
      loadedBlockInstancesCodec.connectDefinitions();
      window.BlockOwnershipPersistence.restore(loadedBlockDefinitions, id => loadedBlockDefinitionMeta.get(id).rawDefinition);
      const repairedBlockConstraintCount = blockConnectionsPersistence.restore(loadedBlockDefinitions, loadedBlockDefinitionMeta, {
        definitionById: loadedDefinitionById, sourceVersion, normalizeLoadedDimensionAppearance, normalizeLoadedExpression,
      });
      const loadedBlockInstances = loadedBlockInstancesCodec.decodeDocument(data.blockInstances, normalizeSketchId);
      const loadedGeometryInstances = (data.geometryInstances || []).map((instance, index) => normalizeGeometryInstance(instance, normalizeSketchId, index));
      const { retainedPoints, lines, circles, arcs, splines, constraints, loadedAnnotations, loadedHatches, loadedReferenceImages, loadedRootNamespace } =
        documentGeometryPersistence.decode(data, {
          sourceVersion, normalizeSketchId, sketches: loadedSketches, sketchIds: loadedSketchIds,
          definitions: loadedBlockDefinitions, definitionById: loadedDefinitionById, blockInstances: loadedBlockInstances,
          geometryInstances: loadedGeometryInstances, normalizeLoadedDimensionAppearance, normalizeLoadedExpression,
        });

      for (const definition of loadedBlockDefinitions) ensureDrawingOrderState(definition);
      ensureDrawingOrderState({
        hatches: loadedHatches,
        lines,
        circles,
        arcs,
        splines,
        blockInstances: loadedBlockInstances,
        geometryInstances: loadedGeometryInstances,
      });
      return {
        documentName: loadedDocumentName, units: loadedUnits, sketches: loadedSketches,
        activeSketchId: normalizeSketchId(data.activeSketchId),
        defaultAppearance: normalizeAppearance(data.defaultAppearance, { partial: false }),
        defaultConstructionAppearance: normalizeConstructionAppearance(data.defaultConstructionAppearance, { partial: false }),
        defaultDimensionAppearance: normalizeLoadedDimensionAppearance(data.defaultDimensionAppearance, { partial: false }),
        annotations: loadedAnnotations, hatches: loadedHatches, referenceImages: loadedReferenceImages,
        nextHatchIndex: Math.max(nextSeq(loadedHatches, "H"), Number(data.nextHatchIndex) || 1),
        blockDefinitions: loadedBlockDefinitions, blockInstances: loadedBlockInstances,
        geometryInstances: loadedGeometryInstances, points: retainedPoints, lines, circles, arcs, splines, constraints,
        parameters: loadedRootNamespace.parameters, nextDimensionParameterIndex: loadedRootNamespace.nextDimensionParameterIndex,
        repairedBlockConstraintCount,
      };
    }

    // The caller resets the editing scope before installing a validated candidate.
    function install(candidate, document, scope) {
      document.documentName = candidate.documentName;
      document.units = candidate.units;
      scope.sketches.length = 0;
      scope.sketches.push(...candidate.sketches);
      scope.activeSketchId = candidate.activeSketchId;
      for (const key of ["defaultAppearance", "defaultConstructionAppearance", "defaultDimensionAppearance"]) document[key] = candidate[key];
      for (const key of ["annotations", "hatches", "referenceImages", "nextHatchIndex"]) scope[key] = candidate[key];
      document.blockDefinitions = candidate.blockDefinitions;
      scope.blockInstances = candidate.blockInstances;
      scope.geometryInstances = candidate.geometryInstances;
      invalidateProjection();
      for (const key of ["points", "lines", "circles", "arcs", "splines", "constraints"]) scope[key].push(...candidate[key]);
      normalizeArcSweeps(scope.arcs);
      scope.parameters = candidate.parameters;
      scope.nextDimensionParameterIndex = candidate.nextDimensionParameterIndex;
    }
    return Object.freeze({ decode, install });
  }
  window.DocumentLoading = Object.freeze({ create });
})();
