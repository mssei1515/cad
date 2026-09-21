(() => {
  "use strict";
  const { addGeometryBundleToMaps } = window.GeometryObjects;
  const { resolve: resolveGeometryRefValue } = window.GeometryRef;

  function create({ createBlockProjectionBundle, geometryInstanceBundlesForScope, elementSketchId,
    deserializeConstraint, constraintSketchId, separateSharedSketchProjectionTargetPoints,
    prepareLoadedParameterNamespace, applicationText }) {
    function restore(loadedBlockDefinitions, loadedBlockDefinitionMeta, { definitionById: loadedDefinitionById,
      sourceVersion, normalizeLoadedDimensionAppearance, normalizeLoadedExpression }) {
      let repairedBlockConstraintCount = 0;
      for (const definition of loadedBlockDefinitions) {
        const meta = loadedBlockDefinitionMeta.get(definition.id);
        const pointById = new Map(definition.points.map((point) => [point.id, point]));
        const lineById = new Map(definition.lines.map((line) => [line.id, line]));
        const primitiveById = new Map([...definition.circles, ...definition.arcs, ...definition.splines].map((primitive) => [primitive.id, primitive]));
        for (const instance of definition.blockInstances) {
          const nestedDefinition = loadedDefinitionById(instance.definitionId);
          addGeometryBundleToMaps(createBlockProjectionBundle(instance, nestedDefinition, null, { definitionResolver: loadedDefinitionById }), pointById, lineById, primitiveById);
        }
        const blockBundles = definition.blockInstances.map((instance) => createBlockProjectionBundle(instance, loadedDefinitionById(instance.definitionId), null, { definitionResolver: loadedDefinitionById }));
        const derivedBundles = geometryInstanceBundlesForScope(definition, blockBundles);
        const invalidDerived = derivedBundles.find((bundle) => !bundle.valid);
        if (invalidDerived) throw new Error(`${applicationText("派生インスタンス", "Derived instance")} ${invalidDerived.instance.id}: ${invalidDerived.reason}`);
        for (const bundle of derivedBundles) addGeometryBundleToMaps(bundle, pointById, lineById, primitiveById);
        if (sourceVersion >= 11) {
          for (const annotation of definition.annotations) {
            if (annotation.type !== "leader") continue;
            const referenced = resolveGeometryRefValue(annotation.geometryRef, (kind, canonicalId) => {
              if (kind === "point") return pointById.get(canonicalId) || null;
              if (kind === "line") return lineById.get(canonicalId) || null;
              if (kind === "circle" || kind === "arc" || kind === "spline") return primitiveById.get(canonicalId) || null;
              return null;
            });
            if (!referenced || elementSketchId(referenced) !== annotation.sketchId) {
              throw new Error(`${applicationText("ブロック引出線", "Block leader")} ${annotation.id}: ${applicationText("参照先は同じ所属Sketchに必要です", "target must belong to the same sketch")}`);
            }
          }
        }
        if (sourceVersion < 11) {
          for (const annotation of definition.annotations) {
            if (annotation.type !== "leader") {
              annotation.sketchId = definition.activeSketchId;
              continue;
            }
            const referenced = resolveGeometryRefValue(annotation.geometryRef, (kind, canonicalId) => {
              if (kind === "point") return pointById.get(canonicalId) || null;
              if (kind === "line") return lineById.get(canonicalId) || null;
              if (kind === "circle" || kind === "arc" || kind === "spline") return primitiveById.get(canonicalId) || null;
              return null;
            });
            annotation.sketchId = referenced?.sketchId || definition.activeSketchId;
          }
        }
        definition.constraints = (meta.rawDefinition.constraints || [])
          .filter((rawConstraint) => !(sourceVersion < 16 && rawConstraint?.type === "pointOnLineMidpoint") && !(sourceVersion < 19 && rawConstraint?.type === "sketchProjection"))
          .map((rawConstraint) => {
          if (sourceVersion >= 16 && rawConstraint?.type === "pointOnLineMidpoint") {
            throw new Error(applicationText("廃止された中点拘束が含まれています", "The document contains a removed midpoint constraint"));
          }
          let constraint = null;
          try {
            constraint = deserializeConstraint(rawConstraint, pointById, lineById, primitiveById, normalizeLoadedDimensionAppearance, normalizeLoadedExpression);
          } catch (error) {
            if (sourceVersion >= 14 && rawConstraint?.type === "offsetChainDimension") throw error;
            constraint = null;
          }
          if (!constraint) {
            repairedBlockConstraintCount += 1;
            return null;
          }
          constraint.sketchId = meta.normalizeDefinitionSketchId(rawConstraint.sketchId || constraintSketchId(constraint));
          constraint.reference = Boolean(rawConstraint.reference);
          constraint.referenceSketchId = rawConstraint.referenceSketchId == null ? null : meta.normalizeDefinitionSketchId(rawConstraint.referenceSketchId);
          return constraint;
          }).filter(Boolean);
        separateSharedSketchProjectionTargetPoints(definition);
        prepareLoadedParameterNamespace(definition, sourceVersion, `${applicationText("ブロック", "Block")} ${definition.name}`);
      }
      return repairedBlockConstraintCount;
    }
    return Object.freeze({ restore });
  }
  window.BlockConnectionsPersistence = Object.freeze({ create });
})();
