/* Circle and arc input states. Model mutation is delegated to CircularConstruction. */
(function () {
  "use strict";
  const { hypot2 } = window.GeometrySolver;
  const { MIN_ORIENTATION_LENGTH, threePointArcGeometry } = window.GeometryKernel;
  function create({ construction, selection: canvasSelection, minArcLength: MIN_ARC_LENGTH, setPointerPreview, clearSnap, clearSelection, setHint, updateUI, draw, solveAndRefresh }) {
    let circleCenterPoint = null;
    let arcCenterPoint = null;
    let arcStartPoint = null;
    let threePointArcStart = null;
    let threePointArcEnd = null;
    function resetCircle() { circleCenterPoint = null; }
    function resetCenterArc() { arcCenterPoint = null; arcStartPoint = null; }
    function resetArcs() { resetCenterArc(); threePointArcStart = null; threePointArcEnd = null; }
    function clickCircle(p, snap) {
      setPointerPreview(p);
      if (!circleCenterPoint) {
        const center = construction.beginCenter(p, snap);
        circleCenterPoint = center;
        canvasSelection.set("points", [center]);
        canvasSelection.set("lines", []);
        canvasSelection.set("circles", []);
        canvasSelection.set("arcs", []);
        setHint("半径位置をクリックすると円を作成します。Escで選択モードに戻ります");
        updateUI();
        draw();
        return;
      }
      const circle = construction.createCircle(circleCenterPoint, p, snap);
      if (circle) {
        canvasSelection.set("points", []);
        canvasSelection.set("lines", []);
        canvasSelection.set("circles", [circle]);
        canvasSelection.set("arcs", []);
        circleCenterPoint = null;
        setPointerPreview(null);
        clearSnap();
        clearSelection();
        solveAndRefresh("円追加");
      }
    }

    function clickArc(p, snap) {
      setPointerPreview(p);
      if (!arcCenterPoint) {
        const center = construction.beginCenter(p, snap);
        arcCenterPoint = center;
        canvasSelection.set("points", [center]);
        canvasSelection.set("lines", []);
        canvasSelection.set("circles", []);
        canvasSelection.set("arcs", []);
        setHint("円弧の始点をクリックしてください。Escで選択モードに戻ります");
        updateUI();
        draw();
        return;
      }
      if (!arcStartPoint) {
        const radius = hypot2(p.x - arcCenterPoint.x, p.y - arcCenterPoint.y);
        if (radius < MIN_ORIENTATION_LENGTH) {
          setHint("中心から離れた位置をクリックしてください", "error");
          draw();
          return;
        }
        arcStartPoint = Object.freeze({
          radius,
          startAngle: Math.atan2(p.y - arcCenterPoint.y, p.x - arcCenterPoint.x),
          snap,
        });
        canvasSelection.set("points", [arcCenterPoint]);
        setHint("円弧の終点をクリックすると円弧を作成します。Escで選択モードに戻ります");
        updateUI();
        draw();
        return;
      }
      const arc = construction.createArc(arcCenterPoint, arcStartPoint, p, snap);
      if (arc) {
        canvasSelection.set("points", []);
        canvasSelection.set("lines", []);
        canvasSelection.set("circles", []);
        canvasSelection.set("arcs", [arc]);
        resetArcs();
        setPointerPreview(null);
        clearSnap();
        clearSelection();
        solveAndRefresh("円弧追加");
      }
    }

    function clickThreePointArc(p, snap) {
      setPointerPreview(p);
      if (!threePointArcStart) {
        threePointArcStart = Object.freeze({ x: p.x, y: p.y, snap });
        clearSelection();
        setHint("3点円弧の終点をクリックしてください。Escで作図をキャンセルします");
        updateUI();
        draw();
        return;
      }
      if (!threePointArcEnd) {
        if (hypot2(p.x - threePointArcStart.x, p.y - threePointArcStart.y) < MIN_ARC_LENGTH) {
          setHint("始点から離れた終点をクリックしてください", "error");
          draw();
          return;
        }
        threePointArcEnd = Object.freeze({ x: p.x, y: p.y, snap });
        setHint("円弧が通過する円周上の点をクリックしてください。Escで作図をキャンセルします");
        updateUI();
        draw();
        return;
      }

      const geometry = threePointArcGeometry(threePointArcStart, threePointArcEnd, p, MIN_ARC_LENGTH);
      if (!geometry) {
        setHint("3点が同一直線上にならない位置をクリックしてください", "error");
        draw();
        return;
      }
      const arc = construction.createThreePointArc(geometry, threePointArcStart.snap, threePointArcEnd.snap, snap);
      if (!arc) {
        setHint("3点が同一直線上にならない位置をクリックしてください", "error");
        draw();
        return;
      }
      resetArcs();
      setPointerPreview(null);
      clearSnap();
      clearSelection();
      solveAndRefresh("3点円弧追加");
    }

    return Object.freeze({ clickCircle, clickArc, clickThreePointArc, resetCircle, resetCenterArc, resetArcs,
      get circleCenterPoint() { return circleCenterPoint; },
      get arcCenterPoint() { return arcCenterPoint; },
      get arcStartPoint() { return arcStartPoint; },
      get threePointArcStart() { return threePointArcStart; },
      get threePointArcEnd() { return threePointArcEnd; }
    });
  }
  window.CircularCommands = Object.freeze({ create });
})();
