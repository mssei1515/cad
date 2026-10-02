/* Create an explicit point and register its provisional rollback boundary. */
(() => {
  "use strict";
  function create({ transientAuthoring, snapForDrawing, drawingSnap, addPoint, addPointSnapConstraints, clearSnap, canvasSelection, solveAndRefresh }) {
    function click(p) {
      transientAuthoring.clearTransientPointRollback();
      transientAuthoring.beginTransientPointRollback();
      const sp = snapForDrawing(p);
      const snap = drawingSnap.active;
      const np = addPoint(sp.x, sp.y, false);
      transientAuthoring.markCreatedPoint(np);
      addPointSnapConstraints(np, snap);
      clearSnap();
      canvasSelection.set("points", [np]);
      canvasSelection.set("lines", []);
      canvasSelection.set("circles", []);
      canvasSelection.set("arcs", []);
      canvasSelection.set("splines", []);
      solveAndRefresh("点追加");
    }
    return Object.freeze({ click });
  }
  window.PointCommand = Object.freeze({ create });
})();
