/* Commit explicit instance transforms while preserving source geometry and constraints. */
(() => {
  "use strict";
  function create({ isPlacing, currentScope, snapshotModelState, restoreModelState, geometryInstanceSourceObjects,
    sketchSolveVariables, sketchSolveConstraints, sketchSolveLines, solver, acceptError,
    stabilizeActiveParameterNamespace, clearSketchSolveState, applicationText, setHint, recordHistory,
    blockDefinitionById, blockLocalGeometryBounds, blockInstanceEnabledSketchSet, blockWorldPoint,
    invalidateBlockProjectionCache, updateBlockUI, refreshConstraintAnalysis, updateUI, draw,
    snappedBlockRotation, solveSketchAndDependents, updatePropertiesUI }) {
    function setBlockInstanceRotationAroundDisplayCenter(instance, rotation) {
      const definition = blockDefinitionById(instance?.definitionId);
      if (!instance || !definition) return false;
      const localCenter = blockLocalGeometryBounds(definition, [...blockInstanceEnabledSketchSet(instance, definition)])?.center || definition.origin || { x: 0, y: 0 };
      const pivot = blockWorldPoint(instance, localCenter);
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      instance.x = pivot.x - localCenter.x * cos + localCenter.y * sin;
      instance.y = pivot.y - localCenter.x * sin - localCenter.y * cos;
      instance.rotation = rotation;
      invalidateBlockProjectionCache(instance.id);
      return true;
    }

    function setBlockInstanceRotationLocked(instance, nextLocked) {
      if (!instance || !currentScope().blockInstances.includes(instance)) return false;
      if (instance.fixed) {
        setHint("全固定を解除してから回転モードを変更してください", "error");
        updateBlockUI();
        return false;
      }
      const locked = Boolean(nextLocked);
      if (Boolean(instance.rotationLocked) === locked) return true;
      if (!locked) {
        instance.rotationLocked = false;
        refreshConstraintAnalysis();
        setHint(`${blockDefinitionById(instance.definitionId)?.name || instance.id} を自由回転にしました`);
        updateUI({ refreshAnalysis: false });
        draw();
        recordHistory("ブロック回転ロック解除");
        return true;
      }

      const snapshot = snapshotModelState();
      const targetRotation = snappedBlockRotation(instance.rotation);
      instance.rotationLocked = true;
      setBlockInstanceRotationAroundDisplayCenter(instance, targetRotation);
      const solved = solveSketchAndDependents(instance.sketchId);
      if (!solved.success || solved.dependent?.success === false) {
        restoreModelState(snapshot);
        solveSketchAndDependents(instance.sketchId);
        refreshConstraintAnalysis();
        setHint("既存の拘束が成立しないため、直交回転ロックを適用できません", "error");
        updateUI({ refreshAnalysis: false });
        draw();
        return false;
      }
      refreshConstraintAnalysis();
      setHint(`${blockDefinitionById(instance.definitionId)?.name || instance.id} を${Math.round(targetRotation * 180 / Math.PI)}°で直交回転ロックしました`);
      updateUI({ refreshAnalysis: false });
      draw();
      recordHistory("ブロック直交回転ロック");
      return true;
    }

    function setBlockInstanceOrthogonalRotation(instance, rotation) {
      if (!instance || !currentScope().blockInstances.includes(instance) || !instance.rotationLocked) return false;
      if (instance.fixed) {
        setHint(applicationText("全固定を解除してから回転角度を変更してください", "Release full fixation before changing the rotation angle."), "error");
        updatePropertiesUI();
        return false;
      }
      const targetRotation = snappedBlockRotation(rotation);
      const difference = Math.atan2(Math.sin(targetRotation - instance.rotation), Math.cos(targetRotation - instance.rotation));
      if (Math.abs(difference) < 1e-12) return true;

      const snapshot = snapshotModelState();
      setBlockInstanceRotationAroundDisplayCenter(instance, targetRotation);
      const solved = solveSketchAndDependents(instance.sketchId);
      if (!solved.success || solved.dependent?.success === false) {
        restoreModelState(snapshot);
        solveSketchAndDependents(instance.sketchId);
        refreshConstraintAnalysis();
        setHint(applicationText("既存の拘束が成立しないため、直交回転角度を変更できません", "The orthogonal rotation angle could not be changed because existing constraints would not be satisfied."), "error");
        updateUI({ refreshAnalysis: false });
        draw();
        return false;
      }
      refreshConstraintAnalysis();
      const angle = Math.round(targetRotation * 180 / Math.PI);
      setHint(applicationText(`${blockDefinitionById(instance.definitionId)?.name || instance.id} の回転角度を${angle}°に変更しました`, `Changed ${blockDefinitionById(instance.definitionId)?.name || instance.id} rotation angle to ${angle}°.`));
      updateUI({ refreshAnalysis: false });
      draw();
      recordHistory("ブロック直交回転角度変更");
      return true;
    }
    return Object.freeze({ setBlockInstanceRotationLocked, setBlockInstanceOrthogonalRotation });
  }
  window.InstanceTransformCommand = Object.freeze({ create });
})();
