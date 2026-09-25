/* Owns Block completion validation, confirmation and commit orchestration. */
(() => {
  "use strict";
  function create({ blockEditor, blockDefinitionEditing, blockCatalog, documentModel, currentScope,
    blockDefinitionCyclePath, duplicateBlockElementId, refreshReferenceConstraintValidity,
    hasInvalidReferenceConstraints, solveSketchById, resultIsAccepted, sketchName,
    solveReferenceDependentSketches, requestChoice, applicationText, blockLocalGeometryBounds,
    storedBlockInstancesReferencing, restoreBlockEditorHost, rebuildStoredBlockDefinitionConstraints,
    nextInstanceId, constraintGraphNodes, annotationReferencesRemovedGeometry,
    invalidateBlockProjectionCache, blockProjectionBundles, geometryElementKey, blockDefinitionDependsOn,
    acceptError, setSketchSolveOk, setSketchSolveError, clearSelection, canvasSelection, setMode,
    setHint, log, updateUI, draw, recordHistory }) {
    const { blockDefinitionById, blockDefinitionDrawableSketchIds, blockDefinitionGeometrySketchIds } = blockCatalog;
    const { create: createGeometryRef, id: geometryRefId, key: geometryRefKey } = window.GeometryRef;
    let blockCompletionChoicePending = false;

    function validateBlockDraft(draft) {
      if (draft.lines.length + draft.circles.length + draft.arcs.length + (draft.splines?.length || 0) + (draft.annotations?.length || 0) + (draft.hatches?.length || 0) + (draft.blockInstances?.length || 0) + (draft.geometryInstances?.length || 0) === 0) return { success: false, reason: applicationText("ブロックには図形、ハッチングまたは注記が必要です", "A block must contain geometry, hatching, or annotations") };
      const outOfScopeInstance = (draft.blockInstances || []).find((instance) => blockDefinitionById(instance.definitionId)?.parentDefinitionId !== draft.id);
      if (outOfScopeInstance) return { success: false, reason: "現在のブロックに属さない子ブロックが含まれています" };
      const cycle = blockDefinitionCyclePath(draft.id);
      if (cycle) return { success: false, reason: `ブロックの循環参照があります: ${cycle.join(" → ")}` };
      const duplicateId = duplicateBlockElementId(draft);
      if (duplicateId) return { success: false, reason: `内部図形ID ${duplicateId} が重複しています。編集をキャンセルしてデータを確認してください` };
      refreshReferenceConstraintValidity();
      if (hasInvalidReferenceConstraints()) return { success: false, reason: "内部スケッチの参照関係に循環または無効な参照があります" };
      const drawableIds = blockDefinitionDrawableSketchIds(draft);
      for (const sketchId of drawableIds) {
        const result = solveSketchById(sketchId);
        if (!resultIsAccepted(result)) return { success: false, reason: `${sketchName(sketchId)} が成立しません (error=${result.errorNorm.toExponential(3)})` };
        const dependent = solveReferenceDependentSketches(sketchId);
        if (!dependent.success) return { success: false, reason: `${sketchName(dependent.sketchId)} が成立しません` };
      }
      return { success: true };
    }

    function complete(options = {}) {
      if (!blockEditor.current) return;
      if (blockCompletionChoicePending) return;
      const session = blockEditor.current;
      const { draft, sourceDefinition, originalElementIds, creationSelection } = session;
      blockEditor.sync(session);
      const validation = validateBlockDraft(draft);
      if (!validation.success) {
        setHint(validation.reason, "error");
        draw();
        return;
      }
      if (session.isNew && creationSelection && typeof options.rotationLocked !== "boolean") {
        blockCompletionChoicePending = true;
        requestChoice({
          title: applicationText("ブロックの回転設定", "Block Rotation"),
          message: applicationText("作成するブロックの回転方法を選択してください。\n回転ロックは向きを固定します。\n自由回転は、一致拘束した点などを支点に回転できます。", "Choose how the new block rotates.\nRotation lock holds its orientation. Free rotation allows it to rotate around a point constrained by coincidence, for example."),
          choices: [
            { value: true, label: applicationText("回転ロックして作成", "Create with Rotation Lock") },
            { value: false, label: applicationText("自由回転で作成", "Create with Free Rotation") },
          ],
          defaultValue: true,
          cancelLabel: applicationText("キャンセル", "Cancel"),
          closeLabel: applicationText("閉じる", "Close"),
        }).then((rotationLocked) => {
          blockCompletionChoicePending = false;
          if (rotationLocked !== null && blockEditor.current === session) complete({ rotationLocked });
        }, () => {
          blockCompletionChoicePending = false;
          setHint(applicationText("別の確認ダイアログを閉じてから、もう一度完了してください", "Close the other confirmation dialog, then try completing the block again."), "error");
        });
        return;
      }
      if (session.isNew && !creationSelection) {
        const center = blockLocalGeometryBounds(draft, blockDefinitionDrawableSketchIds(draft))?.center || { x: 0, y: 0 };
        blockDefinitionEditing.translate(draft, -center.x, -center.y);
        draft.origin = { x: 0, y: 0 };
      }
      if (sourceDefinition) {
        for (const instance of storedBlockInstancesReferencing(sourceDefinition.id, session.original.values.blockInstances)) {
          const remaining = instance.enabledSketchIds.filter((id) => blockDefinitionGeometrySketchIds(draft).includes(id));
          if (remaining.length === 0) {
            setHint(`${instance.id} の有効スケッチが空になるため編集を完了できません`, "error");
            return;
          }
        }
      }
      restoreBlockEditorHost(session);
      const model = currentScope();
      let definition = draft;
      let createdInstance = null;
      let blockCreationExternalConstraints = [];
      if (sourceDefinition) {
        definition = blockDefinitionEditing.apply(sourceDefinition, draft);
        for (const instance of storedBlockInstancesReferencing(definition.id)) {
          instance.enabledSketchIds = instance.enabledSketchIds.filter((id) => blockDefinitionGeometrySketchIds(definition).includes(id));
        }
        const removedStoredConstraints = rebuildStoredBlockDefinitionConstraints();
        if (removedStoredConstraints > 0) log(`削除された入れ子図形を参照する内部拘束を${removedStoredConstraints}件解除しました`);
      } else {
        definition.revision = 1;
        documentModel.blockDefinitions.push(definition);
        if (creationSelection) {
          const enabledSketchIds = blockDefinitionGeometrySketchIds(definition);
          createdInstance = { id: nextInstanceId(), definitionId: definition.id, sketchId: model.activeSketchId, x: session.replacementCenter.x, y: session.replacementCenter.y, rotation: 0, fixed: false, rotationLocked: options.rotationLocked, enabledSketchIds, appearanceOverride: {} };
          model.blockInstances.push(createdInstance);
          blockCreationExternalConstraints = creationSelection.externalConstraints || [];
          model.constraints = model.constraints.filter((constraint) => !creationSelection.constraints.includes(constraint) && !blockCreationExternalConstraints.includes(constraint));
          model.lines = model.lines.filter((line) => !creationSelection.lines.includes(line));
          model.circles = model.circles.filter((circle) => !creationSelection.circles.includes(circle));
          model.arcs = model.arcs.filter((arc) => !creationSelection.arcs.includes(arc));
          model.splines = model.splines.filter((spline) => !(creationSelection.splines || []).includes(spline));
          model.points = model.points.filter((point) => !creationSelection.points.includes(point));
          model.annotations = model.annotations.filter((annotation) => !(creationSelection.annotations || []).includes(annotation));
          model.hatches = model.hatches.filter((hatch) => !(creationSelection.hatches || []).includes(hatch));
          model.blockInstances = model.blockInstances.filter((instance) => !(creationSelection.blockInstances || []).includes(instance));
        }
      }
      blockEditor.adoptChildChanges(session, definition.id, Boolean(sourceDefinition));
      const currentElementIds = new Set([...definition.points, ...definition.lines, ...definition.circles, ...definition.arcs, ...(definition.splines || [])].map((item) => item.id));
      const removedLocalIds = new Set([...originalElementIds].filter((id) => !currentElementIds.has(id)));
      if (removedLocalIds.size > 0) {
        model.constraints = model.constraints.filter((constraint) => !constraintGraphNodes(constraint).some((node) =>
          node?.blockDefinition === definition && removedLocalIds.has(node.localElement?.id),
        ));
        const removedProjectionIds = new Set();
        const removedProjectionKeys = new Set();
        for (const instance of model.blockInstances.filter((item) => item.definitionId === definition.id)) {
          for (const localId of removedLocalIds) {
            for (const kind of ["point", "line", "circle", "arc", "spline"]) {
              const ref = createGeometryRef(kind, [String(instance.id), String(localId)]);
              removedProjectionIds.add(geometryRefId(ref));
              removedProjectionKeys.add(geometryRefKey(ref));
            }
          }
        }
        model.annotations = model.annotations.filter((annotation) => !annotationReferencesRemovedGeometry(annotation, removedProjectionIds, removedProjectionKeys));
      }
      invalidateBlockProjectionCache();
      const currentProjectionItems = blockProjectionBundles().flatMap((bundle) => [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])]);
      const currentProjectionIds = new Set(currentProjectionItems.map((item) => item.id));
      const currentProjectionKeys = new Set(currentProjectionItems.map(geometryElementKey));
      const removedProjectionIds = new Set([...session.originalProjectionIds].filter((id) => !currentProjectionIds.has(id)));
      const removedProjectionKeys = new Set([...session.originalProjectionKeys].filter((key) => !currentProjectionKeys.has(key)));
      if (removedProjectionIds.size > 0) {
        model.constraints = model.constraints.filter((constraint) => !constraintGraphNodes(constraint).some((node) => removedProjectionIds.has(node?.id)));
        model.annotations = model.annotations.filter((annotation) => !annotationReferencesRemovedGeometry(annotation, removedProjectionIds, removedProjectionKeys));
      }
      const affectedSketchIds = [...new Set(model.blockInstances.filter((instance) => blockDefinitionDependsOn(instance.definitionId, definition.id)).map((instance) => instance.sketchId))];
      for (const sketchId of affectedSketchIds) {
        const placementResult = solveSketchById(sketchId);
        if (placementResult.success && placementResult.errorNorm <= acceptError) setSketchSolveOk(sketchId, placementResult, definition.id);
        else setSketchSolveError(sketchId, placementResult, definition.id);
        solveReferenceDependentSketches(sketchId);
      }
      clearSelection();
      if (createdInstance) canvasSelection.set("blockInstances", [createdInstance]);
      setMode("select");
      const completionHint = sourceDefinition ? `ブロック定義を更新しました: ${definition.name}` : `ブロックを作成しました: ${definition.name}`;
      const externalConstraintHint = blockCreationExternalConstraints.length > 0 ? ` / 外部拘束${blockCreationExternalConstraints.length}件を解除しました` : "";
      setHint(`${completionHint}${externalConstraintHint}`);
      if (blockCreationExternalConstraints.length > 0) log(`ブロック外部拘束を${blockCreationExternalConstraints.length}件解除しました`);
      updateUI();
      draw();
      recordHistory(sourceDefinition ? "ブロック定義編集" : "ブロック作成");
    }
    return Object.freeze({ complete });
  }
  window.BlockCompletionCommand = Object.freeze({ create });
})();
