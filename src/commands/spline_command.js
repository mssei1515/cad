/* Spline authoring completion and click semantics; state is owned by SplineDraft. */
(() => {
  "use strict";
  const { hypot2 } = window.GeometrySolver;
  function create({ draft, addSpline, snapForDrawing, scale, clearProjectionSources, setPointerPreview,
    clearSnap, clearSelection, selectCreatedSpline, solveAndRefresh, recordHistory,
    applicationText, setHint, updateUI, draw }) {
    function finalizeSplineCreation(closed = false) {
      if (draft.points.length < 3) {
        setHint("スプラインには3点以上の通過点が必要です", "error");
        return false;
      }
      const spline = addSpline(draft.points.slice(), closed);
      if (!spline) {
        setHint(applicationText("通過点からスプラインを作成できません", "Could not create a spline from the fit points."), "error");
        return false;
      }
      draft.reset();
      clearProjectionSources();
      setPointerPreview(null);
      clearSnap();
      clearSelection();
      selectCreatedSpline(spline);
      solveAndRefresh("スプライン追加");
      recordHistory("スプライン追加");
      setHint(applicationText(`${spline.id} を作成しました`, `Created ${spline.id}`));
      updateUI();
      draw();
      return true;
    }

    function handleSplineClick(pointer) {
      const snapped = snapForDrawing(pointer);
      if (draft.points.length >= 3 && hypot2(snapped.x - draft.points[0].x, snapped.y - draft.points[0].y) <= 10 / scale()) {
        return finalizeSplineCreation(true);
      }
      if (!draft.add(snapped, pointer)) {
        setHint(applicationText("前の通過点と異なる位置を指定してください", "Choose a position different from the previous fit point."), "error");
        return false;
      }
      setPointerPreview(snapped);
      clearSnap();
      setHint(draft.points.length >= 3
        ? applicationText(`${draft.points.length}点。Enterまたは空白のダブルクリックで開いたスプラインを確定します（ダブルクリック位置は追加しません）`, `${draft.points.length} points. Press Enter or double-click blank canvas to finish an open spline without adding that position.`)
        : applicationText(`${draft.points.length}点。あと${3 - draft.points.length}点指定してください`, `${draft.points.length} points. Add ${3 - draft.points.length} more.`));
      draw();
      return true;
    }

    function finalizeSplineFromDoubleClick(pointer) {
      const discarded = draft.discardDoubleClick(pointer, 8 / scale());
      const finalized = finalizeSplineCreation(false);
      if (!finalized && discarded) draw();
      return finalized;
    }
    return Object.freeze({ finalize: finalizeSplineCreation, click: handleSplineClick, doubleClick: finalizeSplineFromDoubleClick });
  }
  window.SplineCommand = Object.freeze({ create });
})();
