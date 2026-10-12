/* Sequential Canvas-menu cancellation; command owners retain their state and rollback. */
(() => {
  "use strict";
  function create({ readMode, selectMode, blockPlacementCommand, drawingPreview, restoreBlockPlacementPropertiesPanel,
    readPending, cancelPendingCommand, readConstraintCommand, cancelConstraintTargetCommand, drawing, applicationText, setHint, updateUI, draw }) {
    function hasCancellable() {
      return readMode() === "block-place" || Boolean(readPending()) || Boolean(readConstraintCommand()) || drawing.active() || drawing.isToolMode();
    }

    function cancel() {
      let canceled = false;
      if (readMode() === "block-place") {
        blockPlacementCommand.reset({ preservePanelState: true });
        drawingPreview.setPointer(null);
        selectMode();
        restoreBlockPlacementPropertiesPanel();
        setHint(applicationText("ブロック配置をキャンセルしました", "Block placement canceled."));
        canceled = true;
      }
      if (readPending()) {
        cancelPendingCommand("");
        canceled = true;
      }
      if (readConstraintCommand()) {
        cancelConstraintTargetCommand("");
        canceled = true;
      }
      if (drawing.active()) {
        drawing.cancel();
        canceled = true;
      }
      if (drawing.isToolMode()) {
        drawing.exit();
        canceled = true;
      }
      if (canceled) {
        setHint(applicationText("コマンドをキャンセルしました", "Command canceled."));
        updateUI();
        draw();
      }
      return canceled;
    }
    return Object.freeze({ hasCancellable, cancel });
  }
  window.CanvasCommandCancellation = Object.freeze({ create });
})();
