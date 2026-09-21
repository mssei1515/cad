(() => {
  "use strict";

  // Operates on decoded, unpublished definitions; never the active document.
  function restore(loadedBlockDefinitions, rawDefinitionForId) {
    const loadedDefinitionIds = new Set(loadedBlockDefinitions.map(definition => definition.id));
    const loadedDefinitionById = id => loadedBlockDefinitions.find(definition => definition.id === id) || null;
    const loadedContainingDefinitionIds = new Map();
    for (const definition of loadedBlockDefinitions) {
      for (const instance of definition.blockInstances) {
        if (!loadedContainingDefinitionIds.has(instance.definitionId)) loadedContainingDefinitionIds.set(instance.definitionId, new Set());
        loadedContainingDefinitionIds.get(instance.definitionId).add(definition.id);
      }
    }
    for (const definition of loadedBlockDefinitions) {
      const rawDefinition = rawDefinitionForId(definition.id);
      const inferredParents = [...(loadedContainingDefinitionIds.get(definition.id) || [])];
      if (inferredParents.length > 1) throw new Error(`子ブロック ${definition.name} が複数の親ブロックから参照されています`);
      if (Object.prototype.hasOwnProperty.call(rawDefinition, "parentDefinitionId")) {
        const explicitParentId = rawDefinition.parentDefinitionId == null ? null : String(rawDefinition.parentDefinitionId);
        if (explicitParentId && !loadedDefinitionIds.has(explicitParentId)) throw new Error(`子ブロック ${definition.name} の親ブロックが見つかりません`);
        if (explicitParentId === definition.id) throw new Error(`ブロック ${definition.name} が自身を親にしています`);
        if (inferredParents.length > 0 && inferredParents[0] !== explicitParentId) throw new Error(`子ブロック ${definition.name} は親ブロック以外から参照されています`);
        definition.parentDefinitionId = explicitParentId;
      } else {
        definition.parentDefinitionId = inferredParents[0] || null;
      }
    }
    const loadedCyclePath = (definitionId, path = [], complete = new Set()) => {
      const repeatedAt = path.indexOf(definitionId);
      if (repeatedAt >= 0) return [...path.slice(repeatedAt), definitionId];
      if (complete.has(definitionId)) return null;
      const definition = loadedDefinitionById(definitionId);
      if (!definition) return null;
      const nextPath = [...path, definitionId];
      for (const instance of definition.blockInstances) {
        const cycle = loadedCyclePath(instance.definitionId, nextPath, complete);
        if (cycle) return cycle;
      }
      complete.add(definitionId);
      return null;
    };
    for (const definition of loadedBlockDefinitions) {
      const cycle = loadedCyclePath(definition.id);
      if (cycle) throw new Error(`ブロックの循環参照があります: ${cycle.join(" → ")}`);
    }
  }
  window.BlockOwnershipPersistence = Object.freeze({ restore });
})();
