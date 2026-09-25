/* Owns nested Block editing sessions and their transactional rollback records. */
(() => {
  "use strict";
  function create({ currentScope, documentModel, hatchSequence, normalizedSketchCopy, activeSketchId,
    blockProjectionBundles, geometryElementKey, captureHost, restoreHostState, activateScope,
    reserveScopeSequences, cloneBlockDefinition, createHistory, mergeBlockDefinitionDraft,
    rebuildStoredBlockDefinitionConstraints, invalidateBlockProjectionCache }) {
    let current = null;

    function syncBlockEditorDraft(session = current) {
      if (!session) return null;
      const model = currentScope();
      session.draft.points = model.points;
      session.draft.lines = model.lines;
      session.draft.circles = model.circles;
      session.draft.arcs = model.arcs;
      session.draft.splines = model.splines;
      session.draft.annotations = model.annotations;
      session.draft.hatches = model.hatches;
      session.draft.referenceImages = model.referenceImages;
      session.draft.nextHatchIndex = Math.max(hatchSequence(), Number(model.nextHatchIndex) || 1);
      session.draft.blockInstances = model.blockInstances;
      session.draft.geometryInstances = model.geometryInstances;
      session.draft.constraints = model.constraints;
      session.draft.parameters = model.parameters;
      session.draft.nextDimensionParameterIndex = model.nextDimensionParameterIndex;
      session.draft.sketches = model.sketches.map(normalizedSketchCopy);
      session.draft.activeSketchId = activeSketchId();
      return session.draft;
    }

    function blockEditorSessionChain() {
      const sessions = [];
      for (let session = current; session; session = session.parentSession) sessions.push(session);
      return sessions;
    }

    function blockDefinitionIsTransientInEditor(definitionId) {
      return blockEditorSessionChain().some((session) =>
        session.transientDefinitionIds?.has(definitionId) || session.definitionRollbackEntries?.has(definitionId),
      );
    }

    function currentBlockDefinitionScopeId() {
      return current?.draft?.id || null;
    }

    function liveBlockEditorDefinition() {
      if (!current) return null;
      const model = currentScope();
      return {
        ...current.draft,
        points: model.points,
        lines: model.lines,
        circles: model.circles,
        arcs: model.arcs,
        splines: model.splines,
        annotations: model.annotations,
        hatches: model.hatches,
        referenceImages: model.referenceImages,
        nextHatchIndex: model.nextHatchIndex,
        blockInstances: model.blockInstances,
        geometryInstances: model.geometryInstances,
        constraints: model.constraints,
        parameters: model.parameters,
        nextDimensionParameterIndex: model.nextDimensionParameterIndex,
        sketches: model.sketches,
        activeSketchId: activeSketchId(),
      };
    }

    function propagateBlockDefinitionRollbacks(targetSession, sourceSession) {
      if (!targetSession || !sourceSession?.definitionRollbackEntries) return;
      if (!targetSession.definitionRollbackEntries) targetSession.definitionRollbackEntries = new Map();
      for (const [definitionId, entry] of sourceSession.definitionRollbackEntries) {
        if (!targetSession.definitionRollbackEntries.has(definitionId)) targetSession.definitionRollbackEntries.set(definitionId, entry);
      }
    }

    function restoreBlockDefinitionRollbacks(session) {
      const entries = [...(session?.definitionRollbackEntries?.values() || [])].sort((a, b) => a.index - b.index);
      for (const entry of entries) {
        const existingIndex = documentModel.blockDefinitions.findIndex((definition) => definition.id === entry.definition.id);
        if (existingIndex >= 0) documentModel.blockDefinitions[existingIndex] = entry.definition;
        else documentModel.blockDefinitions.splice(Math.min(entry.index, documentModel.blockDefinitions.length), 0, entry.definition);
      }
      if (entries.length > 0) {
        rebuildStoredBlockDefinitionConstraints();
        invalidateBlockProjectionCache();
      }
    }

    function open(draft, options = {}) {
      if (!draft) return;
      const parentSession = current;
      if (parentSession) syncBlockEditorDraft(parentSession);
      const originalProjectionItems = blockProjectionBundles().flatMap((bundle) => [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])]);
      const original = options.originalHost || captureHost();
      const sourceDefinition = options.sourceDefinition || null;
      const sourceDefinitionSnapshot = sourceDefinition ? cloneBlockDefinition(sourceDefinition) : null;
      const originalElementIds = new Set(sourceDefinition ? [...sourceDefinition.points, ...sourceDefinition.lines, ...sourceDefinition.circles, ...sourceDefinition.arcs, ...(sourceDefinition.splines || [])].map((item) => item.id) : []);
      current = {
        draft,
        parentSession,
        sourceDefinition,
        sourceDefinitionSnapshot,
        original,
        originalElementIds,
        isNew: Boolean(options.isNew),
        creationSelection: options.creationSelection || null,
        replacementCenter: options.replacementCenter || null,
        transientDefinitionIds: new Set(options.initialTransientDefinitionIds || []),
        definitionRollbackEntries: new Map(options.definitionRollbackEntries || []),
        originalProjectionIds: new Set(originalProjectionItems.map((item) => item.id)),
        originalProjectionKeys: new Set(originalProjectionItems.map(geometryElementKey)),
        history: createHistory(),
      };
      activateScope(draft);
      reserveScopeSequences(draft);
      return current;
    }

    function restoreHost(session) {
      restoreHostState(session.original);
      current = session.parentSession || null;
    }

    function adoptChildChanges(session, definitionId, wasExisting) {
      if (!current) return;
      propagateBlockDefinitionRollbacks(current, session);
      const definitionIdsToKeepTransactional = new Set(session.transientDefinitionIds);
      if (!wasExisting) definitionIdsToKeepTransactional.add(definitionId);
      if (!wasExisting || blockDefinitionIsTransientInEditor(definitionId)) {
        for (const id of definitionIdsToKeepTransactional) current.transientDefinitionIds.add(id);
      }
    }

    function forgetDefinitions(removedIds) {
      for (const session of blockEditorSessionChain()) {
        for (const id of removedIds) session.transientDefinitionIds?.delete(id);
      }
    }

    function rollback(session) {
      if (session.transientDefinitionIds.size > 0) {
        documentModel.blockDefinitions = documentModel.blockDefinitions.filter((definition) => !session.transientDefinitionIds.has(definition.id));
      }
      restoreBlockDefinitionRollbacks(session);
      if (session.sourceDefinition && session.sourceDefinitionSnapshot) {
        const revision = session.sourceDefinitionSnapshot.revision;
        mergeBlockDefinitionDraft(session.sourceDefinition, session.sourceDefinitionSnapshot);
        session.sourceDefinition.revision = revision;
      }
      invalidateBlockProjectionCache();
    }

    function replaceDraft(draft) {
      if (!current) return false;
      current.draft = draft;
      activateScope(draft);
      reserveScopeSequences(draft);
      return true;
    }

    function rename(value) {
      if (!current) return false;
      current.draft.name = value || current.draft.name;
      return true;
    }

    return Object.freeze({ open, restoreHost, adoptChildChanges, forgetDefinitions, rollback, replaceDraft, rename,
      sync: syncBlockEditorDraft, live: liveBlockEditorDefinition, chain: blockEditorSessionChain,
      isTransient: blockDefinitionIsTransientInEditor, scopeId: currentBlockDefinitionScopeId,
      reset() { current = null; }, get current() { return current; } });
  }
  window.BlockEditorSession = Object.freeze({ create });
})();
