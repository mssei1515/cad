/* Normalize Block definitions and placements without owning an editing session. */
(() => {
  "use strict";
  const { ROOT_SKETCH_ID, ROOT_SKETCH_NAME, DEFAULT_SKETCH_ID, DEFAULT_SKETCH_NAME } = window.SketchHierarchy;
  const { normalizeAppearance, normalizeConstructionAppearance, normalizeDimensionAppearance } = window.Appearance;
  const { normalizeAnnotations } = window.AnnotationData;
  const { normalizeHatches } = window.HatchData;
  const { normalizeReferenceImages } = window.ReferenceImageData;
  const { normalizedDrawingOrder } = window.DrawingOrder;
  const { nextSeq } = window.GeometryIds;
  const { Point, Line, Circle, Arc, Spline } = window.GeometrySolver;
  function create({ blockDefinitionDrawableSketchIds, blockDefinitionGeometrySketchIds,
    isDrawableSketch, firstDrawableSketchId }) {
    function normalize(document, scope, activeContainerDefinitionId = null) {
      if (!Array.isArray(document.blockDefinitions)) document.blockDefinitions = [];
      if (!Array.isArray(scope.blockInstances)) scope.blockInstances = [];
      if (!Array.isArray(scope.geometryInstances)) scope.geometryInstances = [];
      const definitionIds = new Set();
      document.blockDefinitions = document.blockDefinitions.filter(Boolean).map((definition, index) => {
        let id = String(definition.id || `B${index + 1}`);
        while (definitionIds.has(id)) id = `B${index + 1}-${definitionIds.size + 1}`;
        definitionIds.add(id);
        definition.id = id;
        definition.name = String(definition.name || `Block-${index + 1}`);
        definition.parentDefinitionId = definition.parentDefinitionId == null ? null : String(definition.parentDefinitionId);
        definition.origin = {
          x: Number(definition.origin?.x) || 0,
          y: Number(definition.origin?.y) || 0,
        };
        if (!Array.isArray(definition.geometryInstances)) definition.geometryInstances = [];
        if (!Array.isArray(definition.sketches) || definition.sketches.length === 0) {
          definition.sketches = [
            { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", appearance: {} },
            { id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {} },
          ];
        }
        let root = definition.sketches.find((sketch) => sketch?.kind === "root" || sketch?.id === ROOT_SKETCH_ID);
        if (!root) {
          root = { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", appearance: {} };
          definition.sketches.unshift(root);
        }
        root.id = ROOT_SKETCH_ID;
        root.name = ROOT_SKETCH_NAME;
        root.parentSketchId = null;
        root.kind = "root";
        root.appearance = normalizeAppearance(root.appearance);
        root.constructionAppearance = normalizeConstructionAppearance(root.constructionAppearance);
        root.dimensionAppearance = normalizeDimensionAppearance(root.dimensionAppearance);
        const legacyRootAppearance = root.appearance;
        const legacyRootConstructionAppearance = root.constructionAppearance;
        const legacyRootDimensionAppearance = root.dimensionAppearance;
        root.appearance = {};
        root.constructionAppearance = {};
        root.dimensionAppearance = {};
        root.visible = true;
        definition.sketches = [root, ...definition.sketches.filter((sketch) => sketch && sketch !== root && sketch.id !== ROOT_SKETCH_ID && sketch.kind !== "root")];
        if (!definition.sketches.some((sketch) => sketch.kind !== "root")) {
          definition.sketches.push({ id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {} });
        }
        const sketchIds = new Set(definition.sketches.map((sketch) => String(sketch.id)));
        for (const sketch of definition.sketches) {
          sketch.id = String(sketch.id);
          if (sketch === root) continue;
          sketch.kind = "sketch";
          sketch.name = String(sketch.name || sketch.id);
          sketch.appearance = normalizeAppearance(sketch.appearance || (sketch.visible === false ? { visible: false } : {}));
          sketch.constructionAppearance = normalizeConstructionAppearance(sketch.constructionAppearance);
          sketch.dimensionAppearance = normalizeDimensionAppearance(sketch.dimensionAppearance);
          if (Object.keys(legacyRootAppearance).length > 0) sketch.appearance = { ...legacyRootAppearance, ...sketch.appearance };
          if (Object.keys(legacyRootConstructionAppearance).length > 0) sketch.constructionAppearance = { ...legacyRootConstructionAppearance, ...sketch.constructionAppearance };
          if (Object.keys(legacyRootDimensionAppearance).length > 0) sketch.dimensionAppearance = { ...legacyRootDimensionAppearance, ...sketch.dimensionAppearance };
          sketch.visible = sketch.appearance.visible !== false;
          sketch.parentSketchId = sketch.parentSketchId == null ? ROOT_SKETCH_ID : String(sketch.parentSketchId);
          if (sketch.parentSketchId === sketch.id || !sketchIds.has(sketch.parentSketchId)) sketch.parentSketchId = ROOT_SKETCH_ID;
        }
        const fallbackSketchId = definition.sketches.find((sketch) => sketch.kind !== "root")?.id || DEFAULT_SKETCH_ID;
        definition.activeSketchId = sketchIds.has(String(definition.activeSketchId)) ? String(definition.activeSketchId) : fallbackSketchId;
        definition.points = Array.isArray(definition.points) ? definition.points : [];
        definition.lines = Array.isArray(definition.lines) ? definition.lines : [];
        definition.circles = Array.isArray(definition.circles) ? definition.circles : [];
        definition.arcs = Array.isArray(definition.arcs) ? definition.arcs : [];
        definition.splines = Array.isArray(definition.splines) ? definition.splines : [];
        definition.annotations = normalizeAnnotations(definition.annotations, fallbackSketchId);
        definition.hatches = normalizeHatches(definition.hatches, fallbackSketchId);
        definition.referenceImages = normalizeReferenceImages(definition.referenceImages, fallbackSketchId);
        definition.nextHatchIndex = Math.max(nextSeq(definition.hatches, "H"), Number(definition.nextHatchIndex) || 1);
        definition.blockInstances = Array.isArray(definition.blockInstances) ? definition.blockInstances : [];
        definition.constraints = Array.isArray(definition.constraints) ? definition.constraints : [];
        for (const item of [...definition.points, ...definition.lines, ...definition.circles, ...definition.arcs, ...definition.splines, ...definition.constraints]) {
          if (!sketchIds.has(String(item.sketchId)) || item.sketchId === ROOT_SKETCH_ID) item.sketchId = fallbackSketchId;
          else item.sketchId = String(item.sketchId);
          if (item instanceof Point || item instanceof Line || item instanceof Circle || item instanceof Arc || item instanceof Spline) item.appearance = normalizeAppearance(item.appearance);
        }
        definition.revision = Number(definition.revision) || 0;
        return definition;
      });
      const containingDefinitionIds = new Map();
      for (const definition of document.blockDefinitions) {
        for (const instance of definition.blockInstances || []) {
          const childId = String(instance?.definitionId || "");
          if (!definitionIds.has(childId)) continue;
          if (!containingDefinitionIds.has(childId)) containingDefinitionIds.set(childId, new Set());
          containingDefinitionIds.get(childId).add(definition.id);
        }
      }
      for (const definition of document.blockDefinitions) {
        const inferredParents = [...(containingDefinitionIds.get(definition.id) || [])];
        if (!definition.parentDefinitionId && inferredParents.length === 1) definition.parentDefinitionId = inferredParents[0];
        if (definition.parentDefinitionId === definition.id) definition.parentDefinitionId = null;
      }
      for (const definition of document.blockDefinitions) {
        const drawableSketchIds = blockDefinitionDrawableSketchIds(definition);
        const fallbackSketchId = drawableSketchIds[0] || DEFAULT_SKETCH_ID;
        definition.blockInstances = definition.blockInstances
          .filter((instance) => instance && definitionIds.has(String(instance.definitionId)) && document.blockDefinitions.find((item) => item.id === String(instance.definitionId))?.parentDefinitionId === definition.id)
          .map((instance, index) => {
            instance.id = String(instance.id || `BI${index + 1}`);
            instance.definitionId = String(instance.definitionId);
            instance.sketchId = drawableSketchIds.includes(String(instance.sketchId)) ? String(instance.sketchId) : fallbackSketchId;
            instance.x = Number(instance.x) || 0;
            instance.y = Number(instance.y) || 0;
            instance.rotation = Number(instance.rotation) || 0;
            instance.fixed = Boolean(instance.fixed);
            instance.rotationLocked = Boolean(instance.rotationLocked);
            instance.drawingOrder = normalizedDrawingOrder(instance.drawingOrder);
            instance.appearanceOverride = normalizeAppearance(instance.appearanceOverride);
            const nestedDefinition = document.blockDefinitions.find((item) => item.id === instance.definitionId);
            const nestedDrawableIds = blockDefinitionDrawableSketchIds(nestedDefinition);
            const requested = Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.map(String) : nestedDrawableIds;
            instance.enabledSketchIds = [...new Set(requested.filter((id) => nestedDrawableIds.includes(id)))];
            if (instance.enabledSketchIds.length === 0) instance.enabledSketchIds = blockDefinitionGeometrySketchIds(nestedDefinition);
            return instance;
          });
      }
      const instanceIds = new Set();
      scope.blockInstances = scope.blockInstances.filter((instance) => {
        if (!instance || !definitionIds.has(String(instance.definitionId))) return false;
        const instanceDefinition = document.blockDefinitions.find((definition) => definition.id === String(instance.definitionId));
        return (instanceDefinition?.parentDefinitionId || null) === activeContainerDefinitionId;
      }).map((instance, index) => {
        let id = String(instance.id || `BI${index + 1}`);
        while (instanceIds.has(id)) id = `BI${index + 1}-${instanceIds.size + 1}`;
        instanceIds.add(id);
        instance.id = id;
        instance.definitionId = String(instance.definitionId);
        instance.sketchId = isDrawableSketch(instance.sketchId) ? String(instance.sketchId) : firstDrawableSketchId();
        instance.x = Number(instance.x) || 0;
        instance.y = Number(instance.y) || 0;
        instance.rotation = Number(instance.rotation) || 0;
        instance.fixed = Boolean(instance.fixed);
        instance.rotationLocked = Boolean(instance.rotationLocked);
        instance.drawingOrder = normalizedDrawingOrder(instance.drawingOrder);
        instance.appearanceOverride = normalizeAppearance(instance.appearanceOverride);
        const definition = document.blockDefinitions.find((item) => item.id === instance.definitionId);
        const drawableIds = blockDefinitionDrawableSketchIds(definition);
        const requested = Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.map(String) : drawableIds;
        instance.enabledSketchIds = [...new Set(requested.filter((id) => drawableIds.includes(id)))];
        if (instance.enabledSketchIds.length === 0) instance.enabledSketchIds = blockDefinitionGeometrySketchIds(definition);
        return instance;
      });
    }
    return Object.freeze({ normalize });
  }
  window.BlockState = Object.freeze({ create });
})();
