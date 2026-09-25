/* Validate and commit the enabled Sketch configuration of a Block instance. */
(() => {
  "use strict";
  function create({ currentScope, blockDefinitionById, blockProjectionBundle, createBlockProjectionBundle,
    blockDefinitionDrawableSketchIds, blockDefinitionGeometrySketchIds, constraintGraphNodes,
    geometryRefKey, parseGeometryRefId, annotationReferencesRemovedGeometry, guardDimensionSymbolDeletion,
    canvasSelection, clearRemovedHover, invalidateBlockProjectionCache, setHint, updateBlockUI,
    log, updateUI, draw, recordHistory }) {
    function blockInstanceDisableImpact(instance, nextEnabledSketchIds) {
      const model = currentScope();
      const definition = blockDefinitionById(instance.definitionId);
      const allItems = blockProjectionBundle(instance);
      const nextItems = createBlockProjectionBundle(instance, definition, nextEnabledSketchIds);
      const nextIds = new Set([...nextItems.points, ...nextItems.lines, ...nextItems.circles, ...nextItems.arcs, ...(nextItems.splines || [])].map((item) => item.id));
      const removedIds = new Set([...allItems.points, ...allItems.lines, ...allItems.circles, ...allItems.arcs, ...(allItems.splines || [])].map((item) => item.id).filter((id) => !nextIds.has(id)));
      const constraints = model.constraints.filter((constraint) => constraintGraphNodes(constraint).some((node) => removedIds.has(node?.id)));
      const removedKeys = new Set([...removedIds].flatMap((id) => ["point", "line", "circle", "arc", "spline"].map((kind) => geometryRefKey(parseGeometryRefId(kind, id)))));
      const annotation = model.annotations.find((item) => annotationReferencesRemovedGeometry(item, removedIds, removedKeys));
      if (annotation) return { constraints, referenceError: `注記 ${annotation.id} から参照されています` };
      return { constraints, referenceError: null };
    }

    function setBlockInstanceEnabledSketchIds(instance, nextIds) {
      const model = currentScope();
      if (!instance) return false;
      const definition = blockDefinitionById(instance.definitionId);
      const drawableIds = blockDefinitionDrawableSketchIds(definition);
      const next = [...new Set(nextIds.filter((id) => drawableIds.includes(id)))];
      if (!next.some((id) => blockDefinitionGeometrySketchIds(definition).includes(id))) {
        setHint("オブジェクトを持つ内部スケッチを1つ以上有効にしてください", "error");
        updateBlockUI();
        return false;
      }
      const disableImpact = blockInstanceDisableImpact(instance, next);
      if (disableImpact.referenceError) {
        setHint(`スケッチを無効にできません: ${disableImpact.referenceError}`, "error");
        updateBlockUI();
        return false;
      }
      const removedConstraintSet = new Set(disableImpact.constraints);
      if (removedConstraintSet.size > 0) {
        if (!guardDimensionSymbolDeletion(removedConstraintSet)) {
          updateBlockUI();
          return false;
        }
        model.constraints = model.constraints.filter((constraint) => !removedConstraintSet.has(constraint));
        if (removedConstraintSet.has(canvasSelection.dimensionConstraint)) canvasSelection.set("dimensionConstraint", null);
        if (removedConstraintSet.has(canvasSelection.constraint)) canvasSelection.set("constraint", null);
        clearRemovedHover(removedConstraintSet);
      }
      instance.enabledSketchIds = next;
      invalidateBlockProjectionCache(instance.id);
      const instanceName = blockDefinitionById(instance.definitionId)?.name || instance.id;
      const removalNotice = removedConstraintSet.size > 0 ? ` / 関連拘束を${removedConstraintSet.size}件、自動解除しました` : "";
      setHint(`${instanceName} の表示スケッチを更新しました${removalNotice}`);
      if (removedConstraintSet.size > 0) log(`${instanceName}: スケッチ無効化に伴い関連拘束を${removedConstraintSet.size}件、自動解除しました`);
      updateUI();
      draw();
      recordHistory("ブロック構成変更");
      return true;
    }
    return Object.freeze({ setEnabledSketchIds: setBlockInstanceEnabledSketchIds });
  }
  window.BlockConfigurationCommand = Object.freeze({ create });
})();
