/* Own Block placement settings, two-click interaction and placement commit. */
(() => {
  "use strict";
  function create({ isGeometryMode, canCreateInActiveSketch, blockDefinitionById, blockDefinitionScopeError,
    blockDefinitionDrawableSketchIds, blockDefinitionGeometrySketchIds, snappedBlockRotation,
    blockInstanceTranslationForAnchor, activeSketchId, currentScope, nextInstanceId,
    clearSelection, canvasSelection, invalidateBlockProjectionCache, isPropertiesCollapsed,
    setPropertiesPanelCollapsed, getPointerPreview, setPointerPreview, getLastPointerWorld,
    setMode, setHint, updateUI, draw, solveAndRefresh, recordHistory }) {
    let blockPlacementDefinitionId = null;
    let blockPlacementAnchor = null;
    let blockPlacementEnabledSketchIds = [];
    let blockPlacementRotationLocked = true;
    let blockPlacementPropertiesWasCollapsed = null;
    function reset({ preservePanelState = false } = {}) {
      blockPlacementDefinitionId = null;
      blockPlacementAnchor = null;
      blockPlacementEnabledSketchIds = [];
      blockPlacementRotationLocked = true;
      if (!preservePanelState) blockPlacementPropertiesWasCollapsed = null;
    }
    function prepare(definitionId, sketchIds) {
      blockPlacementDefinitionId = definitionId;
      blockPlacementAnchor = null;
      blockPlacementEnabledSketchIds = [...sketchIds];
      blockPlacementRotationLocked = true;
    }
    function setAnchor(pointer) { blockPlacementAnchor = { x: pointer.x, y: pointer.y }; }
    function setEnabledSketchIds(ids) { blockPlacementEnabledSketchIds = [...ids]; invalidateBlockProjectionCache(); }
    function setRotationLocked(value) { blockPlacementRotationLocked = value; }
    function preview(pointer) {
      const definition = blockDefinitionById(blockPlacementDefinitionId);
      if (!definition || !pointer) return null;
      const anchor = blockPlacementAnchor || pointer;
      const rotation = blockPlacementRotation(pointer);
      const translation = blockInstanceTranslationForAnchor(definition, blockPlacementEnabledSketchIds, anchor, rotation);
      return { definition, instance: { id: "BLOCK_PREVIEW", definitionId: definition.id, sketchId: activeSketchId(),
        x: translation.x, y: translation.y, rotation, fixed: false, rotationLocked: blockPlacementRotationLocked,
        enabledSketchIds: blockPlacementEnabledSketchIds.slice() } };
    }

    function blockPlacementRotation(pointer = getPointerPreview()) {
      if (!blockPlacementAnchor || !pointer) return 0;
      const rotation = Math.atan2(pointer.y - blockPlacementAnchor.y, pointer.x - blockPlacementAnchor.x);
      return blockPlacementRotationLocked ? snappedBlockRotation(rotation) : rotation;
    }

    function startBlockPlacement(definitionId) {
      if (!isGeometryMode() || !canCreateInActiveSketch()) return;
      if (!blockDefinitionById(definitionId)) return;
      const scopeError = blockDefinitionScopeError(definitionId);
      if (scopeError) {
        setHint(scopeError, "error");
        return;
      }
      clearSelection();
      setMode("block-place");
      prepare(definitionId, blockDefinitionDrawableSketchIds(blockDefinitionById(definitionId)));
      blockPlacementPropertiesWasCollapsed = isPropertiesCollapsed();
      if (blockPlacementPropertiesWasCollapsed) setPropertiesPanelCollapsed(false);
      setPointerPreview(getLastPointerWorld() || { x: 0, y: 0 });
      setHint("配置する内部スケッチを選び、表示中心をクリックしてください");
      updateUI();
      draw();
    }

    function commitBlockPlacement(rotation = 0) {
      const definition = blockDefinitionById(blockPlacementDefinitionId);
      if (!definition || !blockPlacementAnchor) return null;
      const enabledSketchIds = blockPlacementEnabledSketchIds.filter((id) => blockDefinitionDrawableSketchIds(definition).includes(id));
      if (!enabledSketchIds.some((id) => blockDefinitionGeometrySketchIds(definition).includes(id))) {
        setHint("オブジェクトを持つ内部スケッチを1つ以上有効にしてください", "error");
        return null;
      }
      const committedRotation = blockPlacementRotationLocked ? snappedBlockRotation(rotation) : rotation;
      const translation = blockInstanceTranslationForAnchor(definition, enabledSketchIds, blockPlacementAnchor, committedRotation);
      const instance = { id: nextInstanceId(), definitionId: definition.id, sketchId: activeSketchId(), x: translation.x, y: translation.y, rotation: committedRotation, fixed: false, rotationLocked: blockPlacementRotationLocked, enabledSketchIds: enabledSketchIds.slice(), appearanceOverride: {} };
      currentScope().blockInstances.push(instance);
      invalidateBlockProjectionCache(instance.id);
      clearSelection();
      canvasSelection.set("blockInstances", [instance]);
      blockPlacementAnchor = null;
      blockPlacementEnabledSketchIds = [];
      setPointerPreview(null);
      setMode("select");
      restoreBlockPlacementPropertiesPanel();
      solveAndRefresh("ブロック配置");
      setHint(`${definition.name} を配置しました`);
      updateUI();
      draw();
      recordHistory("ブロック配置");
      return instance;
    }

    function handleBlockPlacementClick(pointer) {
      if (!blockPlacementAnchor) {
        if (!blockPlacementEnabledSketchIds.some((id) => blockDefinitionGeometrySketchIds(blockDefinitionById(blockPlacementDefinitionId)).includes(id))) {
          setHint("オブジェクトを持つ内部スケッチを1つ以上有効にしてください", "error");
          return;
        }
        setAnchor(pointer);
        setPointerPreview(pointer);
        setHint("回転方向をクリックしてください。Escで角度0度として配置します");
        draw();
        return;
      }
      commitBlockPlacement(blockPlacementRotation(pointer));
    }

    function restoreBlockPlacementPropertiesPanel() {
      if (blockPlacementPropertiesWasCollapsed) setPropertiesPanelCollapsed(true);
      blockPlacementPropertiesWasCollapsed = null;
    }
    return Object.freeze({ start: startBlockPlacement, commit: commitBlockPlacement, click: handleBlockPlacementClick,
      rotation: blockPlacementRotation, restorePropertiesPanel: restoreBlockPlacementPropertiesPanel,
      reset, prepare, setAnchor, setEnabledSketchIds, setRotationLocked, preview,
      get definitionId() { return blockPlacementDefinitionId; },
      get anchor() { return blockPlacementAnchor ? { ...blockPlacementAnchor } : null; },
      get enabledSketchIds() { return blockPlacementEnabledSketchIds.slice(); },
      get rotationLocked() { return blockPlacementRotationLocked; },
    });
  }
  window.BlockPlacementCommand = Object.freeze({ create });
})();
