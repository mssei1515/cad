/* Read-only Block queries over the current scope and nested editing drafts. */
(() => {
  "use strict";
  function create({ definitions, currentScope, editor, catalog }) {
    const { blockDefinitionById } = catalog;
    function selectedBlockDefinitionMoveError(selection) {
      const selectedInstances = new Set(selection?.blockInstances || []);
      const definitionIds = [...new Set((selection?.blockInstances || []).map((instance) => instance.definitionId))];
      for (const definitionId of definitionIds) {
        const definition = blockDefinitionById(definitionId);
        if (!definition) return `ブロック定義 ${definitionId} が見つかりません`;
        const unselected = currentScope().blockInstances.filter((instance) => instance.definitionId === definitionId && !selectedInstances.has(instance));
        if (unselected.length === 0) continue;
        return `${definition.name} を使用する未選択インスタンス（${unselected.map((instance) => instance.id).join(", ")}）があります。対象インスタンスをすべて選択してください`;
      }
      return null;
    }

    function blockDefinitionsInCurrentScope() {
      const parentDefinitionId = editor.scopeId();
      return definitions().filter((definition) => (definition.parentDefinitionId || null) === parentDefinitionId);
    }

    function blockDefinitionScopeError(definitionId) {
      const definition = blockDefinitionById(definitionId);
      if (!definition) return "ブロック定義が見つかりません";
      return (definition.parentDefinitionId || null) === editor.scopeId()
        ? null
        : "このブロックは現在の階層では使用できません";
    }

    function blockDefinitionForDependency(definitionId) {
      const session = editor.chain().find((item) => item.draft?.id === definitionId);
      return session?.draft || blockDefinitionById(definitionId);
    }

    function blockDefinitionDependsOn(definitionId, targetDefinitionId, visiting = new Set()) {
      if (!definitionId || !targetDefinitionId || visiting.has(definitionId)) return false;
      if (definitionId === targetDefinitionId) return true;
      const definition = blockDefinitionForDependency(definitionId);
      if (!definition) return false;
      const nextVisiting = new Set(visiting).add(definitionId);
      return (definition.blockInstances || []).some((instance) => blockDefinitionDependsOn(instance.definitionId, targetDefinitionId, nextVisiting));
    }

    function blockInstancesInEditingScope() {
      const instances = new Set(currentScope().blockInstances);
      for (const session of editor.chain()) {
        for (const instance of session.draft?.blockInstances || []) instances.add(instance);
        for (const instance of session.original?.values.blockInstances || []) instances.add(instance);
      }
      for (const definition of definitions()) for (const instance of definition.blockInstances || []) instances.add(instance);
      return [...instances];
    }

    function storedBlockInstancesReferencing(definitionId, hostInstances = null) {
      const instances = hostInstances
        ? [...hostInstances, ...definitions().flatMap((definition) => definition.blockInstances || [])]
        : blockInstancesInEditingScope();
      return [...new Set(instances)].filter((instance) => instance.definitionId === definitionId);
    }

    function blockDefinitionUsageCount(definitionId) {
      return currentScope().blockInstances.filter((instance) => instance.definitionId === definitionId).length;
    }

    function blockDefinitionEditError(definitionId) {
      const activeSession = editor.chain().find((session) => session.draft?.id === definitionId);
      return activeSession ? `${activeSession.draft.name} は現在編集中です` : null;
    }

    function blockDefinitionCyclePath(startDefinitionId) {
      const complete = new Set();
      const visit = (definitionId, path) => {
        const repeatedAt = path.indexOf(definitionId);
        if (repeatedAt >= 0) return [...path.slice(repeatedAt), definitionId];
        if (complete.has(definitionId)) return null;
        const definition = blockDefinitionForDependency(definitionId);
        if (!definition) return null;
        const nextPath = [...path, definitionId];
        for (const instance of definition.blockInstances || []) {
          const cycle = visit(instance.definitionId, nextPath);
          if (cycle) return cycle;
        }
        complete.add(definitionId);
        return null;
      };
      return visit(startDefinitionId, []);
    }
    return Object.freeze({ selectedBlockDefinitionMoveError, blockDefinitionsInCurrentScope,
      blockDefinitionScopeError, blockDefinitionDependsOn, storedBlockInstancesReferencing,
      blockDefinitionUsageCount, blockDefinitionEditError, blockDefinitionCyclePath });
  }
  window.BlockEditingQueries = Object.freeze({ create });
})();
