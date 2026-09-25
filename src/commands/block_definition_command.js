/* Coordinates Block creation, editor lifecycle and definition management. */
(() => {
  "use strict";
  function create({ blockEditor, blockDefinitionEditing, blockCatalog, blockEditingQueries,
    documentModel, currentScope, canStartCreation, canvasSelection, captureHost, defaultName,
    blockSelectionGeometry, blockSelectionBoundsCenter, guardDimensionSymbolDeletion,
    resetBlockEditorHistory, clearSelection, setMode, closeDefinitions, setEditorActive,
    fitAllGeometryToViewport, resetEmptyViewport, promptName, invalidateBlockProjectionCache,
    updateBlockUI, updateUI, draw, recordHistory, setHint }) {
    const { blockDefinitionById, blockDefinitionOwnedSubtreeIds } = blockCatalog;
    const { selectedBlockDefinitionMoveError, blockDefinitionScopeError, blockDefinitionEditError } = blockEditingQueries;

    function startBlockCreation() {
      if (!canStartCreation()) return;
      closeDefinitions();
      const creationHost = captureHost();
      const name = defaultName();
      const hasGeometrySelection = canvasSelection.lines.length + canvasSelection.circles.length + canvasSelection.arcs.length + canvasSelection.splines.length + canvasSelection.annotations.length + canvasSelection.hatches.length > 0;
      let selection = null;
      let origin = { x: 0, y: 0 };
      if (hasGeometrySelection || canvasSelection.blockInstances.length > 0) {
        selection = blockSelectionGeometry();
        if (selection.error) {
          setHint(selection.error, "error");
          return;
        }
        const definitionMoveError = selectedBlockDefinitionMoveError(selection);
        if (definitionMoveError) {
          setHint(definitionMoveError, "error");
          return;
        }
        if (!guardDimensionSymbolDeletion(new Set([...(selection.constraints || []), ...(selection.externalConstraints || [])]))) return;
        origin = blockSelectionBoundsCenter(selection);
      }
      const draft = selection ? blockDefinitionEditing.fromSelection(selection, origin, name) : blockDefinitionEditing.empty(name);
      draft.parentDefinitionId = blockEditor.scopeId();
      const definitionRollbackEntries = selection ? blockEditor.stageChildren(draft) : new Map();
      openBlockDefinitionEditor(draft, { isNew: true, creationSelection: selection, replacementCenter: origin, definitionRollbackEntries, originalHost: creationHost });
    }

    function openBlockDefinitionEditor(draft, options = {}) {
      if (!draft) return;
      blockEditor.open(draft, options);
      resetBlockEditorHistory();
      clearSelection();
      setMode("select");
      setEditorActive(true);
      if (draft.lines.length + draft.circles.length + draft.arcs.length + (draft.splines?.length || 0) + (draft.annotations?.length || 0) + (draft.hatches?.length || 0) + (draft.referenceImages?.length || 0) + currentScope().blockInstances.length > 0) fitAllGeometryToViewport();
      else {
        resetEmptyViewport();
      }
      const externalConstraintCount = blockEditor.current.creationSelection?.externalConstraints?.length || 0;
      setHint(
        externalConstraintCount > 0
          ? `ブロックエディタ: ${draft.name} / 選択外につながる拘束${externalConstraintCount}件は完了時に解除されます`
          : `ブロックエディタ: ${draft.name}`,
      );
      updateUI();
      draw();
    }

    function enterBlockDefinitionEdit(definitionId) {
      const scopeError = blockDefinitionScopeError(definitionId);
      if (scopeError) {
        setHint(scopeError, "error");
        return;
      }
      const editError = blockDefinitionEditError(definitionId);
      if (editError) {
        setHint(editError, "error");
        return;
      }
      const definition = blockDefinitionById(definitionId);
      if (!definition) return;
      openBlockDefinitionEditor(blockDefinitionEditing.clone(definition), { sourceDefinition: definition });
    }

    function restoreBlockEditorHost(session) {
      blockEditor.restoreHost(session);
      setEditorActive(Boolean(blockEditor.current));
    }

    function cancelBlockDefinitionEdit() {
      if (!blockEditor.current) return;
      const session = blockEditor.current;
      restoreBlockEditorHost(session);
      blockEditor.rollback(session);
      clearSelection();
      setMode("select");
      setHint(session.sourceDefinition ? "ブロック定義編集をキャンセルしました" : "ブロック作成をキャンセルしました");
      updateUI();
      draw();
    }

    function renameBlockDefinition(definitionId) {
      const scopeError = blockDefinitionScopeError(definitionId);
      if (scopeError) {
        setHint(scopeError, "error");
        return;
      }
      const editError = blockDefinitionEditError(definitionId);
      if (editError) {
        setHint(`${editError}。編集中の名前欄を使用してください`, "error");
        return;
      }
      const definition = blockDefinitionById(definitionId);
      if (!definition) return;
      const name = promptName(definition.name);
      if (name == null || !name.trim()) return;
      definition.name = name.trim();
      updateBlockUI();
      recordHistory("ブロック名変更");
    }

    function deleteBlockDefinition(definitionId) {
      const scopeError = blockDefinitionScopeError(definitionId);
      if (scopeError) {
        setHint(scopeError, "error");
        return;
      }
      const editError = blockDefinitionEditError(definitionId);
      if (editError) {
        setHint(`${editError}。完了またはキャンセルしてから削除してください`, "error");
        return;
      }
      const definition = blockDefinitionById(definitionId);
      if (!definition) return;
      const instances = currentScope().blockInstances.filter((instance) => instance.definitionId === definitionId);
      if (instances.length > 0) {
        setHint(`${definition.name} は ${instances.length}個のインスタンスで使用中のため削除できません`, "error");
        return;
      }
      const removedDefinitionIds = blockDefinitionOwnedSubtreeIds([definitionId]);
      documentModel.blockDefinitions = documentModel.blockDefinitions.filter((item) => !removedDefinitionIds.has(item.id));
      blockEditor.forgetDefinitions(removedDefinitionIds);
      invalidateBlockProjectionCache();
      updateBlockUI();
      draw();
      recordHistory("ブロック定義削除");
    }

    return Object.freeze({ startCreation: startBlockCreation, open: openBlockDefinitionEditor,
      enter: enterBlockDefinitionEdit, restoreHost: restoreBlockEditorHost, cancel: cancelBlockDefinitionEdit,
      rename: renameBlockDefinition, remove: deleteBlockDefinition });
  }
  window.BlockDefinitionCommand = Object.freeze({ create });
})();
