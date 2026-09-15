/* Block Definition lookup and enabled Sketch rules over the current registry. */
(function () {
  "use strict";
  const { ROOT_SKETCH_ID, DEFAULT_SKETCH_ID } = window.SketchHierarchy;
  function create({ definitions }) {
    function blockDefinitionById(id) {
      return definitions().find((definition) => definition.id === id) || null;
    }

    function blockDefinitionDrawableSketchIds(definition) {
      return (definition?.sketches || []).filter((sketch) => sketch && sketch.kind !== "root" && sketch.id !== ROOT_SKETCH_ID).map((sketch) => String(sketch.id));
    }

    function blockDefinitionHasGeometry(definition, visiting = new Set()) {
      if (!definition || visiting.has(definition.id)) return false;
      if ((definition.lines?.length || 0) + (definition.circles?.length || 0) + (definition.arcs?.length || 0) + (definition.splines?.length || 0) + (definition.hatches?.length || 0) + (definition.annotations?.length || 0) > 0) return true;
      const nextVisiting = new Set(visiting).add(definition.id);
      return (definition.blockInstances || []).some((instance) => blockDefinitionHasGeometry(blockDefinitionById(instance.definitionId), nextVisiting));
    }

    function blockDefinitionGeometrySketchIds(definition, visiting = new Set()) {
      if (!definition || visiting.has(definition.id)) return [];
      const ids = new Set([...(definition.lines || []), ...(definition.circles || []), ...(definition.arcs || []), ...(definition.splines || []), ...(definition.hatches || []), ...(definition.annotations || [])].map((item) => String(item.sketchId || DEFAULT_SKETCH_ID)));
      const nextVisiting = new Set(visiting).add(definition.id);
      for (const instance of definition.blockInstances || []) {
        if (blockDefinitionHasGeometry(blockDefinitionById(instance.definitionId), nextVisiting)) ids.add(String(instance.sketchId || DEFAULT_SKETCH_ID));
      }
      return blockDefinitionDrawableSketchIds(definition).filter((id) => ids.has(id));
    }

    function blockInstanceEnabledSketchSet(instance, definition = blockDefinitionById(instance?.definitionId)) {
      const drawableIds = blockDefinitionDrawableSketchIds(definition);
      const requested = Array.isArray(instance?.enabledSketchIds) ? instance.enabledSketchIds.map(String) : drawableIds;
      const enabled = requested.filter((id) => drawableIds.includes(id));
      return new Set(enabled.length > 0 ? enabled : blockDefinitionGeometrySketchIds(definition));
    }

    return Object.freeze({ blockDefinitionById, blockDefinitionDrawableSketchIds, blockDefinitionHasGeometry, blockDefinitionGeometrySketchIds, blockInstanceEnabledSketchSet });
  }
  window.BlockCatalog = Object.freeze({ create });
})();
