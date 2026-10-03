/* Coordinate draw-operation exit and cancellation without owning command drafts. */
(() => {
  "use strict";
  function create({ instances, instanceSources, centerline, line, rectangle, slot, fillet, circular,
    spline, splineEditing, projection, preview, offset, hatch, transient,
    clearSnap, clearSelection, selectMode, updateToolbar, setHint, updateUI, draw, cancelConstraintTargetCommand, setMode, clearTrimHover }) {
    const startHints = {
      "select": "選択・ドラッグできます。Shift/Ctrlクリックで複数選択できます。",
      "point": "キャンバスをクリックして点を追加します。",
      "line": "端点位置をクリックして連続線を作成します。終了はEscです。",
      "rectangle": "矩形の1つ目の角をクリックしてください。Escで選択モードに戻ります",
      "slot": "長穴の1つ目の半円中心をクリックしてください。Escで選択モードに戻ります",
      "trim": "トリムする線、円、円弧の削除したい区間をクリックしてください。Escで選択モードに戻ります",
      "circle": "円の中心をクリックしてください。Escで選択モードに戻ります",
      "arc": "円弧の中心をクリックしてください。Escで選択モードに戻ります",
      "three-point-arc": "3点円弧の始点をクリックしてください。Escで選択モードに戻ります"
    };
    function start(mode) {
      if (!Object.hasOwn(startHints, mode)) return false;
      cancelConstraintTargetCommand("");
      setMode(mode);
      line.reset();
      rectangle.reset();
      if (mode === "slot") slot.reset();
      fillet.reset();
      circular.resetCircle();
      if (mode === "slot") circular.resetCenterArc();
      else circular.resetArcs();
      if (mode === "trim") {
        preview.reset();
        offset.reset();
        clearTrimHover();
      } else preview.setPointer(null);
      clearSnap();
      updateToolbar();
      setHint(startHints[mode]);
      draw();
      return true;
    }

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


    return Object.freeze({ start, exitLine: exitLineMode, exit: exitDrawMode, active: hasActiveDrawOperation, cancel: cancelActiveDrawOperation });
  }
  window.DrawOperationLifecycle = Object.freeze({ create });
})();
