(() => {
  "use strict";

  // Updates parents from the changed definition outward, then the document.
  // Recovery belongs to the enclosing parameter application.
  function create({ catalog, invalidateProjection, definitions, document, applicationText }) {
    function propagate(definition) {
      definition.revision = (Number(definition.revision) || 0) + 1;
      invalidateProjection();
      let parentId = definition.parentDefinitionId || null;
      while (parentId) {
        const parent = catalog.blockDefinitionById(parentId);
        if (!parent) throw new Error(applicationText("親Block Definitionが見つかりません", "Parent block definition was not found"));
        definitions.rebuild(parent);
        const result = definitions.stabilize(parent);
        if (!result.success || result.dependent?.success === false) throw new Error(result.result.reason || applicationText("親Blockの拘束が成立しません", "Parent block constraints could not be satisfied"));
        parent.revision = (Number(parent.revision) || 0) + 1;
        parentId = parent.parentDefinitionId || null;
        invalidateProjection();
      }
      document.rebuild();
      const rootResult = document.stabilize();
      if (!rootResult.success || rootResult.dependent?.success === false) throw new Error(rootResult.result.reason || applicationText("Document拘束が成立しません", "Document constraints could not be satisfied"));
    }

    return Object.freeze({ propagate });
  }
  window.BlockParameterPropagation = Object.freeze({ create });
})();
