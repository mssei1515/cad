/* Three-click Slot input lifecycle; geometry construction and UI effects are explicit ports. */
(function () {
  "use strict";
  const { slotGeometry } = window.GeometryKernel;
  const { hypot2 } = window.GeometrySolver;
  function create({ construction, minLineLength, minArcLength, setPointerPreview, clearSnap, clearSelection, setHint, updateUI, draw }) {
    let firstCenter = null;
    let secondCenter = null;
    function reset() { firstCenter = null; secondCenter = null; }
    function click(point, snap) {
      setPointerPreview(point);
      if (!firstCenter) {
        firstCenter = Object.freeze({ x: point.x, y: point.y, snap });
        clearSelection();
        setHint("長穴の2つ目の半円中心をクリックしてください。Escで作図をキャンセルします");
        updateUI();
        draw();
        return;
      }
      if (!secondCenter) {
        if (hypot2(point.x - firstCenter.x, point.y - firstCenter.y) < minLineLength) {
          setHint("1つ目の中心から離れた位置をクリックしてください", "error");
          draw();
          return;
        }
        secondCenter = Object.freeze({ x: point.x, y: point.y, snap });
        setHint("長穴の幅位置をクリックしてください。Escで作図をキャンセルします");
        updateUI();
        draw();
        return;
      }
      const geometry = slotGeometry(firstCenter, secondCenter, point, minArcLength);
      if (!geometry) {
        setHint("中心線から離れた幅位置をクリックしてください", "error");
        draw();
        return;
      }
      const prepared = construction.prepare(geometry, { first: firstCenter.snap, second: secondCenter.snap, width: snap });
      if (!prepared) {
        setHint("中心線から離れた幅位置をクリックしてください", "error");
        draw();
        return;
      }
      reset();
      setPointerPreview(null);
      clearSnap();
      clearSelection();
      if (!prepared.commit().success) {
        setHint("拘束を維持できないため長穴の作成を戻しました", "error");
        updateUI();
        draw();
      }
    }
    return Object.freeze({ click, reset, get firstCenter() { return firstCenter; }, get secondCenter() { return secondCenter; } });
  }
  window.SlotCommand = Object.freeze({ create });
})();
