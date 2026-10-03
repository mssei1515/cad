/* Coordinate draw-operation exit and cancellation without owning command drafts. */
(() => {
  "use strict";
  function create({ instances, instanceSources, centerline, line, rectangle, slot, fillet, circular,
    spline, splineEditing, projection, preview, offset, hatch, transient,
    clearSnap, clearSelection, selectMode, updateToolbar, setHint, updateUI, draw }) {
    function exitLineMode() {
      centerline.reset();
      line.reset();
      rectangle.reset();
      slot.reset();
      fillet.reset();
      preview.reset();
      offset.reset();
      clearSnap();
      selectMode();
      updateToolbar();
      setHint("連続線を終了しました");
      updateUI();
      draw();
    }

    function exitDrawMode() {
      instances.reset();
      instanceSources.reset();
      centerline.reset();
      line.reset();
      transient.clearPoint();
      transient.clearLineCompletion();
      rectangle.reset();
      slot.reset();
      fillet.reset();
      circular.resetCircle();
      circular.resetArcs();
      spline.reset();
      splineEditing.reset();
      projection.reset();
      preview.reset();
      offset.reset();
      hatch.reset();
      clearSnap();
      selectMode();
      updateToolbar();
      setHint("選択・ドラッグモードに戻りました");
      updateUI();
      draw();
    }

    function hasActiveDrawOperation() {
      return Boolean(line.startPoint || centerline.targets.length || centerline.firstPoint || rectangle.startPoint || slot.firstCenter || slot.secondCenter || fillet.firstLine || circular.circleCenterPoint || circular.arcCenterPoint || circular.arcStartPoint || circular.threePointArcStart || circular.threePointArcEnd || spline.points.length || offset.source || offset.entries.length);
    }


    function cancelActiveDrawOperation() {
      centerline.reset();
      transient.rollbackLineStart();
      transient.clearPoint();
      transient.clearLineCompletion();
      line.reset();
      rectangle.reset();
      slot.reset();
      fillet.reset();
      circular.resetCircle();
      circular.resetArcs();
      spline.cancel();
      splineEditing.reset();
      projection.reset();
      preview.reset();
      offset.reset();
      hatch.reset();
      clearSnap();
      clearSelection();
      setHint("作図操作をキャンセルしました");
      updateUI();
      draw();
    }


    return Object.freeze({ exitLine: exitLineMode, exit: exitDrawMode, active: hasActiveDrawOperation, cancel: cancelActiveDrawOperation });
  }
  window.DrawOperationLifecycle = Object.freeze({ create });
})();
