(() => {
  "use strict";
  const { ROOT_SKETCH_ID } = window.SketchHierarchy;
  const { normalizeAnnotations } = window.AnnotationData;
  const { normalizeHatches, validSerializedHatchList } = window.HatchData;
  const { normalizeReferenceImages, validSerializedReferenceImageList } = window.ReferenceImageData;

  function create({ applicationText, serializedGeometryInstanceListError }) {
    function decode(rawDefinitions, { sourceVersion, normalizeLoadedExpression, normalizeLoadedDimensionAppearance }) {
      const loadedBlockDefinitions = [];
      const loadedBlockDefinitionMeta = new Map();
      for (const rawDefinition of Array.isArray(rawDefinitions) ? rawDefinitions : []) {
        if (sourceVersion >= 15 && !Array.isArray(rawDefinition.splines)) throw new Error(`ブロック ${rawDefinition.id}: ${applicationText("スプライン配列がありません", "the spline array is missing")}`);
        if (sourceVersion >= 18 && !validSerializedReferenceImageList(rawDefinition.referenceImages)) throw new Error(`ブロック ${rawDefinition.id}: ${applicationText("参照画像の形式が正しくありません", "invalid reference image data")}`);
        if (sourceVersion >= 21 && !Array.isArray(rawDefinition.geometryInstances)) throw new Error(`ブロック ${rawDefinition.id}: ${applicationText("派生インスタンス配列がありません", "the derived instance array is missing")}`);
        const definitionGeometryInstanceError = serializedGeometryInstanceListError(rawDefinition.geometryInstances || []);
        if (definitionGeometryInstanceError) throw new Error(`ブロック ${rawDefinition.id}: ${applicationText("派生インスタンス", "derived instances")} ${definitionGeometryInstanceError}`);
        const { sketches: definitionSketches, ids: definitionSketchIds, normalizeId: normalizeDefinitionSketchId } = window.SketchHierarchy.decode(rawDefinition.sketches, {
          dimensionAppearanceLoader: normalizeLoadedDimensionAppearance, definition: true,
        });
        const { points, lines, circles, arcs, splines } = window.GeometryPersistence.decodeBlock(rawDefinition, {
          sourceVersion, normalizeSketchId: normalizeDefinitionSketchId,
        });
        const definition = {
          id: String(rawDefinition.id),
          name: String(rawDefinition.name || rawDefinition.id || "Block"),
          parentDefinitionId: null,
          origin: { x: Number(rawDefinition.origin?.x) || 0, y: Number(rawDefinition.origin?.y) || 0 },
          sketches: definitionSketches,
          activeSketchId: normalizeDefinitionSketchId(rawDefinition.activeSketchId),
          parameters: Array.isArray(rawDefinition.parameters) ? rawDefinition.parameters.map((parameter) => ({ name: String(parameter?.name || ""), expression: normalizeLoadedExpression(parameter?.expression) })) : [],
          nextDimensionParameterIndex: Number(rawDefinition.nextDimensionParameterIndex) || 1,
          points,
          lines,
          circles,
          arcs,
          splines,
          annotations: (() => {
            const rawAnnotations = Array.isArray(rawDefinition.annotations) ? rawDefinition.annotations : [];
            if (sourceVersion >= 11) {
              const invalid = rawAnnotations.find((annotation) => annotation?.sketchId === ROOT_SKETCH_ID || !definitionSketchIds.has(String(annotation?.sketchId || "")));
              if (invalid) throw new Error(`${applicationText("ブロック注記", "Block annotation")} ${invalid?.id || "?"}: ${applicationText("所属Sketchが正しくありません", "invalid owning sketch")}`);
            }
            return normalizeAnnotations(rawAnnotations, normalizeDefinitionSketchId(rawDefinition.activeSketchId));
          })(),
          hatches: (() => {
            if (sourceVersion < 13) return [];
            if (!Number.isInteger(Number(rawDefinition.nextHatchIndex)) || Number(rawDefinition.nextHatchIndex) < 1) throw new Error(`${applicationText("ブロックハッチングの採番値が正しくありません", "Invalid block hatch sequence")}`);
            if (!validSerializedHatchList(rawDefinition.hatches)) throw new Error(`${applicationText("ブロックハッチングの形式が正しくありません", "Invalid block hatch data")}`);
            const rawHatches = rawDefinition.hatches;
            const invalidOwner = rawHatches.find((hatch) => hatch?.sketchId === ROOT_SKETCH_ID || !definitionSketchIds.has(String(hatch?.sketchId || "")));
            if (invalidOwner) throw new Error(`${applicationText("ブロックハッチング", "Block hatch")} ${invalidOwner?.id || "?"}: ${applicationText("所属Sketchが正しくありません", "invalid owning sketch")}`);
            const normalized = normalizeHatches(rawHatches, normalizeDefinitionSketchId(rawDefinition.activeSketchId));
            if (normalized.length !== rawHatches.length) throw new Error(`${applicationText("ブロックハッチングの形式が正しくありません", "Invalid block hatch data")}`);
            return normalized;
          })(),
          referenceImages: (() => {
            if (sourceVersion < 18) return [];
            const rawImages = rawDefinition.referenceImages;
            const invalidOwner = rawImages.find((image) => image?.sketchId === ROOT_SKETCH_ID || !definitionSketchIds.has(String(image?.sketchId || "")));
            if (invalidOwner) throw new Error(`${applicationText("ブロック参照画像", "Block reference image")} ${invalidOwner?.id || "?"}: ${applicationText("所属Sketchが正しくありません", "invalid owning sketch")}`);
            return normalizeReferenceImages(rawImages, normalizeDefinitionSketchId(rawDefinition.activeSketchId));
          })(),
          nextHatchIndex: Math.max(1, Number(rawDefinition.nextHatchIndex) || 1),
          blockInstances: [],
          geometryInstances: [],
          constraints: [],
          revision: Number(rawDefinition.revision) || 0,
        };
        loadedBlockDefinitions.push(definition);
        loadedBlockDefinitionMeta.set(definition.id, {
          rawDefinition,
          normalizeDefinitionSketchId,
        });
      }
      return { definitions: loadedBlockDefinitions, metadata: loadedBlockDefinitionMeta };
    }
    return Object.freeze({ decode });
  }
  window.BlockDefinitionPersistence = Object.freeze({ create });
})();
