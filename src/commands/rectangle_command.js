/* Rectangle input lifecycle owns its starting point and completion sequence. */
(() => {
  "use strict";
  const { HorizontalConstraint, VerticalConstraint } = window.GeometrySolver;
  function create({ endpointAt, addPoint, addLine, addPointSnapConstraints, pushModelConstraint,
    minLineLength, samePosition, selection, setPointerPreview, clearSnap, clearSelection,
    setHint, updateUI, draw, solveAndRefresh, log }) {
    let startPoint = null;
    function reset() { startPoint = null; }
    function click(p, snap) {
      setPointerPreview(p);
      if (!startPoint) {
        startPoint = endpointAt(p.x, p.y);
        addPointSnapConstraints(startPoint, snap);
        selection.set("points", [startPoint]);
        selection.set("lines", []);
        selection.set("circles", []);
        selection.set("arcs", []);
        setHint("対角の角をクリックすると矩形を作成します。Escで選択モードに戻ります");
        updateUI();
        draw();
        return;
      }

      const rx = p.x - startPoint.x;
      const ry = p.y - startPoint.y;
      if (Math.abs(rx) < minLineLength) p = { ...p, x: startPoint.x + (rx < 0 ? -minLineLength : minLineLength) };
      if (Math.abs(ry) < minLineLength) p = { ...p, y: startPoint.y + (ry < 0 ? -minLineLength : minLineLength) };
      if (snap && !samePosition(p, snap)) snap = null;
      const p1 = startPoint;
      const p2 = addPoint(p.x, p1.y, false, "endpoint");
      const p3 = addPoint(p.x, p.y, false, "endpoint");
      const p4 = addPoint(p1.x, p.y, false, "endpoint");
      addPointSnapConstraints(p3, snap);
      const lines = [addLine(p1, p2), addLine(p2, p3), addLine(p3, p4), addLine(p4, p1)].filter(Boolean);
      if (lines[0]) pushModelConstraint(new HorizontalConstraint(lines[0]));
      if (lines[1]) pushModelConstraint(new VerticalConstraint(lines[1]));
      if (lines[2]) pushModelConstraint(new HorizontalConstraint(lines[2]));
      if (lines[3]) pushModelConstraint(new VerticalConstraint(lines[3]));
      selection.set("points", []);
      selection.set("lines", lines);
      selection.set("circles", []);
      selection.set("arcs", []);
      startPoint = null;
      setPointerPreview(null);
      clearSnap();
      clearSelection();
      const result = solveAndRefresh("矩形追加");
      log(`矩形を追加しました\n自動solve: success=${result.success}`);
    }
    return Object.freeze({ click, reset, get startPoint() { return startPoint; } });
  }
  window.RectangleCommand = Object.freeze({ create });
})();
