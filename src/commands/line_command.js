/* Continuous line input state and completion, using explicit rollback ownership. */
(() => {
  "use strict";
  const { hypot2, HorizontalConstraint, VerticalConstraint } = window.GeometrySolver;
  function create({ minLineLength, snapForDrawing, samePosition, addPoint, endpointAt, addLine,
    addPointSnapConstraints, pushModelConstraint, transientAuthoring, selection, setPointerPreview,
    clearSelection, setHint, updateUI, draw, solveAndRefresh, log }) {
    let startPoint = null;
    function reset() { startPoint = null; }
    function previewPoint(point, lockOrthogonal) {
      return startPoint && lockOrthogonal ? orthogonalPointFrom(startPoint, point) : point;
    }
    function preferredDirectionFrom(start, p) {
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      const len = hypot2(dx, dy);
      if (len >= minLineLength) return { x: dx / len, y: dy / len };
      if (len > 1e-9) return { x: dx / len, y: dy / len };
      return { x: 1, y: 0 };
    }

    function pointAtMinimumDistance(start, p) {
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      const len = hypot2(dx, dy);
      if (len >= minLineLength) return p;
      const dir = preferredDirectionFrom(start, p);
      return { x: start.x + dir.x * minLineLength, y: start.y + dir.y * minLineLength };
    }


    function orthogonalPointFrom(start, p) {
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      return Math.abs(dx) >= Math.abs(dy) ? { x: p.x, y: start.y } : { x: start.x, y: p.y };
    }

    function addLineOrientationConstraint(line) {
      if (!line) return;
      const dx = Math.abs(line.p2.x - line.p1.x);
      const dy = Math.abs(line.p2.y - line.p1.y);
      pushModelConstraint(dx >= dy ? new HorizontalConstraint(line) : new VerticalConstraint(line));
    }

    function click(p, lockOrthogonal = false) {
      if (startPoint && lockOrthogonal) p = orthogonalPointFrom(startPoint, p);
      const snapped = snapForDrawing(p);
      p = snapped.point;
      let snap = snapped.snap;
      if (startPoint) p = pointAtMinimumDistance(startPoint, p);
      if (snap && !samePosition(p, snap)) snap = null;
      if (startPoint) transientAuthoring.beginTransientLineCompletionRollback();
      else transientAuthoring.beginTransientLineStartRollback();
      const endpoint = startPoint && hypot2(p.x - startPoint.x, p.y - startPoint.y) <= minLineLength + 1e-9 ? addPoint(p.x, p.y, false, "endpoint") : endpointAt(p.x, p.y);
      setPointerPreview(p);

      if (!startPoint) {
        addPointSnapConstraints(endpoint, snap);
        startPoint = endpoint;
        selection.set("points", [endpoint]);
        selection.set("lines", []);
        selection.set("circles", []);
        selection.set("arcs", []);
        setHint("次の端点をクリックすると線を作成します。終了はEscです。");
        updateUI();
        draw();
        return;
      }

      const l = addLine(startPoint, endpoint);
      if (l) {
        transientAuthoring.markCompletedLine(endpoint, l);
        transientAuthoring.clearTransientLineStartRollback();
        addPointSnapConstraints(endpoint, snap);
        if (lockOrthogonal) addLineOrientationConstraint(l);
        selection.set("points", []);
        selection.set("lines", [l]);
        selection.set("circles", []);
        selection.set("arcs", []);
        startPoint = endpoint;
        clearSelection();
        const result = solveAndRefresh("線追加");
        log(`線 ${l.id} を追加しました\n自動solve: success=${result.success}`);
      } else {
        selection.set("points", [endpoint]);
        selection.set("lines", []);
        selection.set("circles", []);
        selection.set("arcs", []);
        setHint("同じ端点です。別の位置をクリックしてください。終了はEscです。");
        updateUI();
        draw();
      }
    }
    return Object.freeze({ click, reset, previewPoint, get startPoint() { return startPoint; } });
  }
  window.LineCommand = Object.freeze({ create });
})();
