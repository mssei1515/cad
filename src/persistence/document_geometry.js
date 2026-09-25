(() => {
  "use strict";
  const { ROOT_SKETCH_ID } = window.SketchHierarchy;
  const { normalizeAnnotations } = window.AnnotationData;
  const { normalizeHatches, validSerializedHatchList } = window.HatchData;
  const { normalizeReferenceImages } = window.ReferenceImageData;
  const { addGeometryBundleToMaps } = window.GeometryObjects;
  const { resolve: resolveGeometryRefValue } = window.GeometryRef;

  function create({ createBlockProjectionBundle, geometryInstanceBundlesForScope, elementSketchId,
    deserializeConstraint, constraintSketchId, separateSharedSketchProjectionTargetPoints, prepareLoadedParameterNamespace,
    isPointUsedByLine, isPointUsedByCircle, isPointUsedByArc, constraintReferencesPoint, applicationText }) {
    function decode(data, { sourceVersion, normalizeSketchId, sketches: loadedSketches, sketchIds: loadedSketchIds,
      definitions: loadedBlockDefinitions, definitionById: loadedDefinitionById, blockInstances: loadedBlockInstances,
      geometryInstances: loadedGeometryInstances, normalizeLoadedDimensionAppearance, normalizeLoadedExpression }) {
      const rawLoadedAnnotations = Array.isArray(data.annotations) ? data.annotations : [];
      if (sourceVersion >= 13 && (!validSerializedHatchList(data.hatches) || !Number.isInteger(Number(data.nextHatchIndex)) || Number(data.nextHatchIndex) < 1)) throw new Error(applicationText("ハッチングの形式または採番値が正しくありません", "Invalid hatch data or sequence"));
      const rawLoadedHatches = sourceVersion >= 13 ? data.hatches : [];
      const rawLoadedReferenceImages = sourceVersion >= 18 ? data.referenceImages : [];

      const { points, lines, circles, arcs, splines, pointById, lineById, primitiveById } =
        window.GeometryPersistence.decodeDocument(data, { sourceVersion, normalizeSketchId });
      for (const instance of loadedBlockInstances) {
        const definition = loadedBlockDefinitions.find((item) => item.id === instance.definitionId);
        const bundle = createBlockProjectionBundle(instance, definition, null, { definitionResolver: loadedDefinitionById });
        for (const point of bundle.points) pointById.set(point.id, point);
        for (const line of bundle.lines) lineById.set(line.id, line);
        for (const primitive of [...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])]) primitiveById.set(primitive.id, primitive);
      }
      const loadedBlockBundles = loadedBlockInstances.map((instance) => createBlockProjectionBundle(instance, loadedBlockDefinitions.find((item) => item.id === instance.definitionId), null, { definitionResolver: loadedDefinitionById }));
      const loadedDerivedBundles = geometryInstanceBundlesForScope({ sketches: loadedSketches, points, lines, circles, arcs, splines, geometryInstances: loadedGeometryInstances }, loadedBlockBundles);
      const invalidLoadedDerived = loadedDerivedBundles.find((bundle) => !bundle.valid);
      if (invalidLoadedDerived) throw new Error(`${applicationText("派生インスタンス", "Derived instance")} ${invalidLoadedDerived.instance.id}: ${invalidLoadedDerived.reason}`);
      for (const bundle of loadedDerivedBundles) addGeometryBundleToMaps(bundle, pointById, lineById, primitiveById);

      if (sourceVersion >= 11) {
        const invalidAnnotation = rawLoadedAnnotations.find((annotation) => annotation?.sketchId === ROOT_SKETCH_ID || !loadedSketchIds.has(String(annotation?.sketchId || "")));
        if (invalidAnnotation) throw new Error(`${applicationText("注記", "Annotation")} ${invalidAnnotation?.id || "?"}: ${applicationText("所属Sketchが正しくありません", "invalid owning sketch")}`);
      }
      const loadedAnnotationFallback = normalizeSketchId(data.activeSketchId);
      const loadedAnnotations = normalizeAnnotations(rawLoadedAnnotations, loadedAnnotationFallback);
      if (sourceVersion >= 13) {
        const invalidHatchOwner = rawLoadedHatches.find((hatch) => hatch?.sketchId === ROOT_SKETCH_ID || !loadedSketchIds.has(String(hatch?.sketchId || "")));
        if (invalidHatchOwner) throw new Error(`${applicationText("ハッチング", "Hatch")} ${invalidHatchOwner?.id || "?"}: ${applicationText("所属Sketchが正しくありません", "invalid owning sketch")}`);
      }
      const loadedHatches = normalizeHatches(rawLoadedHatches, loadedAnnotationFallback);
      if (sourceVersion >= 13 && loadedHatches.length !== rawLoadedHatches.length) throw new Error(applicationText("ハッチングの形式が正しくありません", "Invalid hatch data"));
      if (sourceVersion >= 18) {
        const invalidImageOwner = rawLoadedReferenceImages.find((image) => image?.sketchId === ROOT_SKETCH_ID || !loadedSketchIds.has(String(image?.sketchId || "")));
        if (invalidImageOwner) throw new Error(`${applicationText("参照画像", "Reference image")} ${invalidImageOwner?.id || "?"}: ${applicationText("所属Sketchが正しくありません", "invalid owning sketch")}`);
      }
      const loadedReferenceImages = normalizeReferenceImages(rawLoadedReferenceImages, loadedAnnotationFallback);
      const resolveLoadedGeometryRef = (ref) => resolveGeometryRefValue(ref, (kind, canonicalId) => {
        if (kind === "point") return pointById.get(canonicalId) || null;
        if (kind === "line") return lineById.get(canonicalId) || null;
        if (kind === "circle" || kind === "arc" || kind === "spline") return primitiveById.get(canonicalId) || null;
        return null;
      });
      if (sourceVersion >= 11) {
        for (const annotation of loadedAnnotations) {
          if (annotation.type !== "leader") continue;
          const referenced = resolveLoadedGeometryRef(annotation.geometryRef);
          if (!referenced || elementSketchId(referenced) !== annotation.sketchId) {
            throw new Error(`${applicationText("引出線", "Leader")} ${annotation.id}: ${applicationText("参照先は同じ所属Sketchに必要です", "target must belong to the same sketch")}`);
          }
        }
      } else {
        for (const annotation of loadedAnnotations) {
          const referenced = annotation.type === "leader" ? resolveLoadedGeometryRef(annotation.geometryRef) : null;
          annotation.sketchId = referenced && referenced.sketchId !== ROOT_SKETCH_ID ? referenced.sketchId : loadedAnnotationFallback;
        }
      }

      const constraints = [];
      for (const c of data.constraints) {
        if (sourceVersion < 16 && c?.type === "pointOnLineMidpoint") continue;
        if (sourceVersion < 19 && c?.type === "sketchProjection") continue;
        const constraint = deserializeConstraint(c, pointById, lineById, primitiveById, normalizeLoadedDimensionAppearance, normalizeLoadedExpression);
        if (!constraint) throw new Error(`未対応の制約です: ${c.type}`);
        constraint.sketchId = normalizeSketchId(c.sketchId || constraintSketchId(constraint));
        constraint.reference = Boolean(c.reference);
        constraint.referenceSketchId = c.referenceSketchId == null ? null : normalizeSketchId(c.referenceSketchId);
        constraints.push(constraint);
      }

      const loadedRootNamespace = {
        constraints,
        parameters: Array.isArray(data.parameters) ? data.parameters.map((parameter) => ({ name: String(parameter?.name || ""), expression: normalizeLoadedExpression(parameter?.expression) })) : [],
        nextDimensionParameterIndex: Number(data.nextDimensionParameterIndex) || 1,
      };
      separateSharedSketchProjectionTargetPoints({ points, constraints });
      prepareLoadedParameterNamespace(loadedRootNamespace, sourceVersion, applicationText("Document", "Document"));

      const retainedPoints = points.filter((p) => {
        if (p.kind !== "endpoint") return true;
        if (isPointUsedByLine(p, lines) || isPointUsedByCircle(p, circles) || isPointUsedByArc(p, arcs) || splines.some((spline) => spline.fitPoints.includes(p))) return true;
        return constraints.some((constraint) => constraintReferencesPoint(constraint, p));
      });

      return { retainedPoints, lines, circles, arcs, splines, constraints, loadedAnnotations, loadedHatches, loadedReferenceImages, loadedRootNamespace };
    }
    return Object.freeze({ decode });
  }
  window.DocumentGeometryPersistence = Object.freeze({ create });
})();
