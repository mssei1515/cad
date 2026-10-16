/* Coordinate one trim operation; geometry transfer and checkpoint storage retain their owners. */
(() => {
  "use strict";
  function create({ hitSketchIdentityElement, guardSketchEdit, activeSketchId, computeTrimPreview,
    setHint, draw, guardSketchProjectionShapeEdit, applicationText, clearTrimPreview, editing, checkpoint,
    clearSelection, stabilizeActiveParameterNamespace, acceptError, invalidateAnalysis, refreshConstraintAnalysis, updateUI, recordHistory }) {
    const { executeLineTrim, executeArcTrim, executeCircleTrim } = editing;
    const { capture: snapshotGeometryMutationState, restore: restoreGeometryMutationState } = checkpoint;
    function executeTrimAt(pointer) {
      const identity = hitSketchIdentityElement(pointer.x, pointer.y, { allowInactiveGeometry: true });
      if (!guardSketchEdit(identity?.sketchId || activeSketchId(), "structure")) return false;
      const preview = computeTrimPreview(pointer);
      if (!preview) {
        setHint("トリムできる交点がありません", "error");
        draw();
        return false;
      }
      if (!guardSketchProjectionShapeEdit([preview.item], { action: applicationText("トリム", "Trim") })) {
        clearTrimPreview();
        draw();
        return false;
      }
      const snapshot = snapshotGeometryMutationState();
      if (preview.kind === "line") executeLineTrim(preview);
      else if (preview.kind === "arc") executeArcTrim(preview);
      else executeCircleTrim(preview);
      clearTrimPreview();
      clearSelection();
      const solved = stabilizeActiveParameterNamespace(activeSketchId());
      const result = solved.result;
      if (!solved.success || solved.dependent?.success === false || result.errorNorm > acceptError) {
        restoreGeometryMutationState(snapshot);
        setHint(applicationText("拘束を維持できないためトリムを戻しました。拘束状態を確認してください", "The trim was restored because its constraints could not be maintained. Check the constraint status."), "error");
        updateUI();
        draw();
        return false;
      }
      invalidateAnalysis();
      refreshConstraintAnalysis();
      setHint(applicationText("トリムしました", "Trim completed"));
      updateUI({ refreshAnalysis: false });
      draw();
      recordHistory("トリム");
      return true;
    }
    return Object.freeze({ execute: executeTrimAt });
  }
  window.TrimCommand = Object.freeze({ create });
})();
