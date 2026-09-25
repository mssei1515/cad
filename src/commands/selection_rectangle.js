/* Own rectangle-selection state; delegate geometry selection and rendering. */
(() => {
  "use strict";
  function create({ rectFromPoints, hypot2, viewScale, releasePointer, clearSelection,
    selectByRect, addSketchProjectionSourcesByRect, setHint, updateGeometrySelectionUI, draw }) {
    let session = null;
    function begin(start, { current = start, kind, additive = false } = {}) {
      session = { start, current, kind, additive };
    }
    function update(current) { if (session) session.current = current; }
    function preview() {
      if (!session?.current) return null;
      return { rect: rectFromPoints(session.start, session.current), crossing: session.current.x < session.start.x };
    }
    function finish(event) {
      if (!session) return false;
      const completed = session;
      session = null;
      releasePointer(event.pointerId);
      const current = completed.current || completed.start;
      const moved = hypot2(current.x - completed.start.x, current.y - completed.start.y);
      if (completed.kind === "sketch-projection") {
        if (moved > 3 / viewScale()) {
          addSketchProjectionSourcesByRect(rectFromPoints(completed.start, current), current.x < completed.start.x);
        } else { draw(); }
        return true;
      }
      if (moved <= 3 / viewScale()) {
        if (!completed.additive) clearSelection();
      } else {
        selectByRect(rectFromPoints(completed.start, current), current.x < completed.start.x, completed.additive);
        setHint("矩形選択を更新しました");
      }
      updateGeometrySelectionUI();
      draw();
      return true;
    }
    return Object.freeze({ begin, update, preview, finish, reset: () => { session = null; },
      get active() { return Boolean(session); } });
  }
  window.SelectionRectangle = Object.freeze({ create });
})();
