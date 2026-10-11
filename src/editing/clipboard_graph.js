/* Build the pasted model graph through geometry, transfer and Parameter owners. */
(() => {
  "use strict";
  function create({ geometry, transfer, parameters, elementIds, deserializeConstraint, invalidateProjection, applicationText }) {
    const { serializeAnnotation } = window.AnnotationData;
    const { serializeReferenceImage } = window.ReferenceImageData;
    function append(model, payload, { sketchId: targetSketchId, dx, dy, namespace, namespaceKey }) {
      const { idMap, pointById, lineById, primitiveById } =
        geometry.append(model, payload, targetSketchId, dx, dy);
      const pastedBlockInstances = geometry.appendBlocks(model, payload, targetSketchId, dx, dy, idMap);
      if (pastedBlockInstances.length > 0) invalidateProjection();
      payload.blockInstances.forEach((source, index) => transfer.mapClipboardBlockProjection(source, pastedBlockInstances[index], idMap, pointById, lineById, primitiveById));
      const copiedInstances = payload.geometryInstances || [];
      for (const source of payload.hatches || []) idMap.set(source.id, elementIds.hatch());
      const pastedGeometryInstances = geometry.appendDerived(model, payload, targetSketchId, dx, dy, idMap, namespaceKey);
      invalidateProjection();
      const pastedAnnotations = [];
      for (const source of payload.annotations || []) {
        const annotation = serializeAnnotation(source);
        annotation.id = elementIds.annotation();
        annotation.sketchId = targetSketchId;
        transfer.translateAnnotation(annotation, idMap, dx, dy);
        model.annotations.push(annotation);
        pastedAnnotations.push(annotation);
        idMap.set(source.id, annotation.id);
      }
      const pastedHatches = [];
      for (const source of payload.hatches || []) {
        const hatch = transfer.copiedHatch(source, idMap, targetSketchId, dx, dy);
        if (!hatch) throw new Error(`${source.id}: ${applicationText("塗りつぶし境界を書き換えられません", "Could not rewrite fill boundary")}`);
        model.hatches.push(hatch);
        pastedHatches.push(hatch);
        idMap.set(source.id, hatch.id);
      }
      model.nextHatchIndex = Math.max(elementIds.nextHatchIndex(), Number(model.nextHatchIndex) || 1);
      const pastedImages = (payload.referenceImages || []).map(source => {
        const image = serializeReferenceImage(source);
        image.id = elementIds.image(); image.sketchId = targetSketchId;
        return transfer.translateReferenceImage(image, dx, dy);
      });
      model.referenceImages.push(...pastedImages);

      invalidateProjection();
      transfer.reconnectDerivedInstances(copiedInstances, pastedGeometryInstances, pointById, lineById, primitiveById);
      const sameNamespace = payload.parameterNamespaceKey === namespaceKey;
      const copiedDimensionNames = parameters.prepareCopiedSymbols(payload, pastedAnnotations, namespace, sameNamespace);
      for (const source of payload.constraints) {
        const data = transfer.translatedClipboardConstraintData(source, idMap, dx, dy);
        parameters.rewriteCopiedConstraintSymbol(data, source, copiedDimensionNames, sameNamespace);
        const constraint = deserializeConstraint(data, pointById, lineById, primitiveById);
        if (!constraint) throw new Error(`拘束 ${source.type} を複製できません`);
        constraint.sketchId = targetSketchId;
        constraint.reference = false;
        constraint.referenceSketchId = null;
        model.constraints.push(constraint);
        parameters.ensureDimensionParameter(constraint, namespace);
      }

      return { maps: { idMap, pointById, lineById, primitiveById },
        blockInstances: pastedBlockInstances, annotations: pastedAnnotations, hatches: pastedHatches,
        geometryInstances: pastedGeometryInstances, referenceImages: pastedImages };
    }
    return Object.freeze({ append });
  }
  window.ClipboardGraph = Object.freeze({ create });
})();
