/* Temporary spline fit points and rollback; no UI, history or solver. */
(() => {
  "use strict";
  function create({ currentScope, ids, endpointAt, samePosition, isPointUsedByPrimitive, now = () => performance.now() }) {
    let points = [], rollback = null, lastClick = null;
    function reset() { points = []; rollback = null; lastClick = null; }
    function begin() {
      reset();
      rollback = { pointLength: currentScope().points.length, pointSeq: ids.peek("point") };
    }
    function add(snapped, pointer) {
      const lengthBefore = currentScope().points.length;
      const point = endpointAt(snapped.x, snapped.y);
      if (points.at(-1) === point || (points.at(-1) && samePosition(points.at(-1), point))) return false;
      points.push(point);
      lastClick = { point, created: currentScope().points.length > lengthBefore, time: now(), x: pointer.x, y: pointer.y };
      return true;
    }
    function removeLast() {
      const removed = points.pop();
      lastClick = null;
      const scope = currentScope();
      if (removed && rollback && scope.points.indexOf(removed) >= rollback.pointLength && !isPointUsedByPrimitive(removed)) {
        scope.points = scope.points.filter(point => point !== removed);
      }
    }
    function discardDoubleClick(pointer, tolerance) {
      const candidate = lastClick;
      lastClick = null;
      if (!candidate || points.at(-1) !== candidate.point) return false;
      if (now() - candidate.time > 650) return false;
      const dx = pointer.x - candidate.x, dy = pointer.y - candidate.y;
      if (Math.sqrt(dx * dx + dy * dy) > tolerance) return false;
      points.pop();
      if (candidate.created && !isPointUsedByPrimitive(candidate.point)) {
        const scope = currentScope();
        scope.points = scope.points.filter(point => point !== candidate.point);
      }
      return true;
    }
    function cancel() {
      if (rollback) {
        currentScope().points.length = rollback.pointLength;
        ids.restore({ pointSeq: rollback.pointSeq });
      }
      reset();
    }
    return Object.freeze({ begin, add, removeLast, discardDoubleClick, cancel, reset, get points() { return points; } });
  }
  window.SplineDraft = Object.freeze({ create });
})();
