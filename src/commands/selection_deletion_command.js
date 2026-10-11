/* Coordinate deletion of the current mixed Canvas selection. */
(() => {
  "use strict";
  function create({ currentScope, canvasSelection, geometryDeletion, referenceImageInteraction,
    guardSelectionEdit, selectionSketchId, activeSketchId, geometryRefKey, geometryRefForItem,
    geometryInstanceUsesRemovedGeometry, rejectReferencedGeometryDeletion, guardDimensionSymbolDeletion,
    annotationReferencesRemovedGeometry, invalidateBlockProjectionCache, effectiveSelectedConstraint,
    deleteElements, clearSelection, solveAndRefresh, refreshView, recordHistory, setHint, applicationText }) {
    function remove() {
      if (!guardSelectionEdit()) return false;
      const ownerSketchId = selectionSketchId() || activeSketchId();
      const model = currentScope();
      const annotationsToDelete = canvasSelection.annotations.filter((annotation) => model.annotations.includes(annotation));
      const hatchesToDelete = canvasSelection.hatches.filter((hatch) => model.hatches.includes(hatch));
      const referenceImagesToDelete = canvasSelection.referenceImages.filter((image) => model.referenceImages.includes(image));
      const hatchKeys = new Set(hatchesToDelete.map(hatch => geometryRefKey(geometryRefForItem(hatch))));
      const hatchDependents = model.geometryInstances.filter(instance => !canvasSelection.geometryInstances.includes(instance)
        && geometryInstanceUsesRemovedGeometry(instance, hatchKeys));
      if (rejectReferencedGeometryDeletion(hatchDependents, applicationText("選択した塗りつぶし", "the selected fill"))) return false;
      if (annotationsToDelete.length > 0 && !guardDimensionSymbolDeletion(annotationsToDelete)) return false;
      if (annotationsToDelete.length > 0) {
        model.annotations = model.annotations.filter((item) => !annotationsToDelete.includes(item));
        canvasSelection.set("annotations", []);
      }
      if (hatchesToDelete.length > 0) {
        model.hatches = model.hatches.filter((item) => !hatchesToDelete.includes(item));
        canvasSelection.set("hatches", []);
      }
      if (referenceImagesToDelete.length > 0) {
        model.referenceImages = model.referenceImages.filter((item) => !referenceImagesToDelete.includes(item));
        referenceImageInteraction.forget(referenceImagesToDelete);
        canvasSelection.set("referenceImages", []);
      }
      let deletedInstanceCount = 0;
      if (canvasSelection.geometryInstances.length > 0) {
        const instances = [...canvasSelection.geometryInstances];
        const ownerIds = new Set(instances.map((instance) => instance.id));
        const dependent = model.geometryInstances.filter((instance) => !instances.includes(instance) && geometryInstanceUsesRemovedGeometry(instance, new Set(), ownerIds));
        if (rejectReferencedGeometryDeletion(dependent, applicationText("選択した派生インスタンス", "the selected derived instance"))) return false;
        const removal = geometryDeletion.planDerivedInstances(model, instances);
        if (!guardDimensionSymbolDeletion([...removal.removedConstraints, ...model.annotations.filter(annotation => annotationReferencesRemovedGeometry(annotation, removal.removedIds, removal.removedKeys))])) return false;
        geometryDeletion.applyInstances(model, removal);
        canvasSelection.set("geometryInstances", []);
        canvasSelection.set("instanceGeometry", null);
        deletedInstanceCount = instances.length;
      }
      let deletedBlockCount = 0;
      if (canvasSelection.blockInstances.length > 0) {
        const instances = [...canvasSelection.blockInstances];
        const dependent = model.geometryInstances.filter((instance) => geometryInstanceUsesRemovedGeometry(instance, new Set(), new Set(instances.map((entry) => entry.id))));
        if (rejectReferencedGeometryDeletion(dependent, applicationText("選択したブロック", "the selected block"))) return false;
        const removal = geometryDeletion.planBlockInstances(model, instances);
        if (!guardDimensionSymbolDeletion([...removal.removedConstraints, ...model.annotations.filter(annotation => annotationReferencesRemovedGeometry(annotation, removal.removedIds, removal.removedKeys))])) return false;
        geometryDeletion.applyInstances(model, removal);
        invalidateBlockProjectionCache();
        canvasSelection.set("blockInstances", []);
        deletedBlockCount = instances.length;
      }
      const constraints = [...new Set([...canvasSelection.dimensionConstraints, effectiveSelectedConstraint()].filter(Boolean))];
      const deletedGeometry = deleteElements({ points: canvasSelection.points, lines: canvasSelection.lines, circles: canvasSelection.circles, arcs: canvasSelection.arcs, splines: canvasSelection.splines, constraints });
      if (deletedGeometry) return true;
      if (deletedBlockCount === 0 && deletedInstanceCount === 0 && annotationsToDelete.length === 0 && hatchesToDelete.length === 0 && referenceImagesToDelete.length === 0) return false;
      clearSelection();
      if (deletedBlockCount > 0 || deletedInstanceCount > 0) solveAndRefresh("インスタンス削除", ownerSketchId);
      else {
        refreshView();
        recordHistory(referenceImagesToDelete.length ? "画像削除" : hatchesToDelete.length ? "塗りつぶし削除" : "注記削除");
      }
      setHint(applicationText(`削除しました: 派生インスタンス${deletedInstanceCount} / ブロック${deletedBlockCount} / 画像${referenceImagesToDelete.length} / 塗りつぶし${hatchesToDelete.length} / 注記${annotationsToDelete.length}`, `Deleted: derived instances ${deletedInstanceCount} / blocks ${deletedBlockCount} / images ${referenceImagesToDelete.length} / fills ${hatchesToDelete.length} / annotations ${annotationsToDelete.length}`));
      return true;
    }

    return Object.freeze({ remove });
  }
  window.SelectionDeletionCommand = Object.freeze({ create });
})();
