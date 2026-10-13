/* Guard and dispatch canvas context actions through existing editing and command owners. */
(() => {
  "use strict";
  function create({ guardSelectionEdit, guardSketchEdit, elementSketchId, selectionSketchId, activeSketchId, commitSketchProjectionCommand, cancelCanvasCommandFromContextMenu, undoHistory, redoHistory, copySelectionToClipboard, imageClipboard, document, showSelectedObjectProperties, fixPointBtn, enterBlockDefinitionEdit, setBlockInstanceRotationLocked, startDimensionEditInput, selectedDimensionLineGroup, dimensionLineGroup, updateGeometrySelectionUI, draw, recordHistory, applicationText, setHint, sketchMoveCommand, startHatchBoundaryRepair, reorderSelectedDrawingObjects, addSplineFitPointFromContext, deleteSplineFitPointFromContext, splineEditing, fitVisibleGeometryToViewport }) {
    function execute(action, target, pointer) {
      const editsTarget = ["cut", "delete", "construction-toggle", "fix-toggle", "block-rotation-toggle", "dimension-edit", "dimension-align", "sketch-move", "hatch-repair", "drawing-front", "drawing-forward", "drawing-backward", "drawing-back", "spline-fit-point-add", "spline-fit-point-delete", "create-block"];
      if (editsTarget.includes(action) && (!guardSelectionEdit() || target?.item && !guardSketchEdit(elementSketchId(target.item)))) return;
      if (["fix-toggle", "hatch-repair", "spline-fit-point-add", "spline-fit-point-delete", "create-block"].includes(action)
        && !guardSketchEdit(target?.item ? elementSketchId(target.item) : selectionSketchId() || activeSketchId(), "structure")) return;
      if (action === "sketch-projection-commit") commitSketchProjectionCommand();
      else if (action === "cancel-command") cancelCanvasCommandFromContextMenu();
      else if (action === "undo") undoHistory();
      else if (action === "redo") redoHistory();
      else if (action === "cut") copySelectionToClipboard({ cut: true });
      else if (action === "copy") copySelectionToClipboard();
      else if (action === "paste") void imageClipboard.pasteFromMenu();
      else if (action === "delete") document.getElementById("deleteSelectionBtn")?.click();
      else if (action === "show-properties") showSelectedObjectProperties();
      else if (action === "construction-toggle") document.getElementById("toolConstructionLine")?.click();
      else if (action === "fix-toggle") fixPointBtn?.click();
      else if (action === "offset") document.getElementById("toolOffset")?.click();
      else if (action === "fillet") document.getElementById("toolFillet")?.click();
      else if (action === "add-leader") document.getElementById("annotationLeaderBtn")?.click();
      else if (action === "create-block") document.getElementById("toolCreateBlock")?.click();
      else if (action === "block-edit" && target?.item) enterBlockDefinitionEdit(target.item.definitionId);
      else if (action === "block-rotation-toggle" && target?.item) setBlockInstanceRotationLocked(target.item, !target.item.rotationLocked);
      else if (action === "dimension-edit" && target?.hit) startDimensionEditInput(target.hit);
      else if (action === "dimension-align" && target?.item) {
        const group = selectedDimensionLineGroup(target.item);
        if (group && dimensionLineGroup.align(group)) {
          updateGeometrySelectionUI();
          draw();
          recordHistory(applicationText("寸法線整列", "Align dimension lines"));
          setHint(applicationText("基準の寸法線に揃えました", "Aligned to the reference dimension line."));
        }
      }
      else if (action === "sketch-move") sketchMoveCommand.start();
      else if (action === "hatch-repair" && target?.item) startHatchBoundaryRepair(target.item);
      else if (["drawing-front", "drawing-forward", "drawing-backward", "drawing-back"].includes(action)) reorderSelectedDrawingObjects(action);
      else if (action === "spline-fit-point-add" && target?.item && pointer) addSplineFitPointFromContext(target.item, pointer);
      else if (action === "spline-fit-point-delete" && target?.item && splineEditing.current?.spline) deleteSplineFitPointFromContext(splineEditing.current.spline, target.item);
      else if (action === "fit-visible") {
        if (fitVisibleGeometryToViewport()) setHint(applicationText("表示中の図形全体が見えるように調整しました", "Fitted all visible geometry."));
        else setHint(applicationText("表示中の図形がありません", "There is no visible geometry."), "error");
        draw();
      }
    }
    return Object.freeze({ execute });
  }
  window.CanvasContextActions = Object.freeze({ create });
})();
