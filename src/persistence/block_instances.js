(() => {
  "use strict";
  const { normalizeAppearance } = window.Appearance;
  const { normalizedDrawingOrder } = window.DrawingOrder;

  function create({ definitions: loadedBlockDefinitions, metadata: loadedBlockDefinitionMeta, normalizeGeometryInstance }) {
    const { blockDefinitionDrawableSketchIds } = window.BlockCatalog.create({ definitions: () => loadedBlockDefinitions });
    const loadedDefinitionIds = new Set(loadedBlockDefinitions.map((definition) => definition.id));
    const loadedDefinitionById = (definitionId) => loadedBlockDefinitions.find((definition) => definition.id === definitionId) || null;
    const loadedDefinitionHasGeometry = (definition, visiting = new Set()) => {
      if (!definition || visiting.has(definition.id)) return false;
      if (definition.lines.length + definition.circles.length + definition.arcs.length + definition.splines.length + definition.hatches.length + definition.annotations.length > 0) return true;
      const next = new Set(visiting).add(definition.id);
      return definition.blockInstances.some((instance) => loadedDefinitionHasGeometry(loadedDefinitionById(instance.definitionId), next));
    };
    const loadedDefinitionGeometrySketchIds = (definition) => {
      if (!definition) return [];
      const ids = new Set([...definition.lines, ...definition.circles, ...definition.arcs, ...definition.splines, ...definition.hatches, ...definition.annotations].map((item) => String(item.sketchId)));
      for (const instance of definition.blockInstances) if (loadedDefinitionHasGeometry(loadedDefinitionById(instance.definitionId))) ids.add(String(instance.sketchId));
      return blockDefinitionDrawableSketchIds(definition).filter((id) => ids.has(id));
    };
    function connectDefinitions() {
      for (const definition of loadedBlockDefinitions) {
        const meta = loadedBlockDefinitionMeta.get(definition.id);
        definition.blockInstances = (meta.rawDefinition.blockInstances || [])
          .filter((instance) => loadedDefinitionIds.has(String(instance.definitionId)))
          .map((instance, index) => {
            const nestedDefinition = loadedDefinitionById(String(instance.definitionId));
            const drawableIds = blockDefinitionDrawableSketchIds(nestedDefinition);
            const enabled = Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.map(String).filter((id) => drawableIds.includes(id)) : drawableIds;
            return {
              id: String(instance.id || `BI${index + 1}`),
              definitionId: String(instance.definitionId),
              sketchId: meta.normalizeDefinitionSketchId(instance.sketchId),
              drawingOrder: normalizedDrawingOrder(instance.drawingOrder),
              x: Number(instance.x) || 0,
              y: Number(instance.y) || 0,
              rotation: Number(instance.rotation) || 0,
              fixed: Boolean(instance.fixed),
              rotationLocked: Boolean(instance.rotationLocked),
              enabledSketchIds: [...new Set(enabled.length > 0 ? enabled : drawableIds)],
              appearanceOverride: normalizeAppearance(instance.appearanceOverride),
            };
          });
        definition.geometryInstances = (meta.rawDefinition.geometryInstances || []).map((instance, index) => normalizeGeometryInstance(instance, meta.normalizeDefinitionSketchId, index));
      }
    }
    function decodeDocument(rawInstances, normalizeSketchId) {
      const loadedBlockInstances = (Array.isArray(rawInstances) ? rawInstances : [])
        .filter((instance) => loadedDefinitionIds.has(String(instance.definitionId)))
        .map((instance, index) => ({
          id: String(instance.id || `BI${index + 1}`),
          definitionId: String(instance.definitionId),
          sketchId: normalizeSketchId(instance.sketchId),
          drawingOrder: normalizedDrawingOrder(instance.drawingOrder),
          x: Number(instance.x) || 0,
          y: Number(instance.y) || 0,
          rotation: Number(instance.rotation) || 0,
          fixed: Boolean(instance.fixed),
          rotationLocked: Boolean(instance.rotationLocked),
          enabledSketchIds: Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.map(String) : null,
          appearanceOverride: normalizeAppearance(instance.appearanceOverride),
        }));
      for (const instance of loadedBlockInstances) {
        const definition = loadedDefinitionById(instance.definitionId);
        if (definition?.parentDefinitionId) throw new Error(`子ブロック ${definition.name} は親ブロック内でのみ使用できます`);
      }
      for (const instance of loadedBlockInstances) {
        const definition = loadedBlockDefinitions.find((item) => item.id === instance.definitionId);
        const drawableIds = blockDefinitionDrawableSketchIds(definition);
        const enabled = Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.filter((id) => drawableIds.includes(id)) : drawableIds;
        instance.enabledSketchIds = enabled.length > 0 ? [...new Set(enabled)] : loadedDefinitionGeometrySketchIds(definition);
      }
      return loadedBlockInstances;
    }
    return Object.freeze({ connectDefinitions, decodeDocument, definitionById: loadedDefinitionById });
  }
  window.BlockInstancePersistence = Object.freeze({ create });
})();
