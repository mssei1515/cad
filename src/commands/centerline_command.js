/* Own centerline target and endpoint input state; construction is delegated. */
(function () {
  "use strict";
  const { Point, Line, hypot2 } = window.GeometrySolver;
  function create({ plans, construction, selection: canvasSelection, sameSketchElements, activeSketchId, isActiveSketchElement, applicationText, minLineLength: MIN_LINE_LENGTH, snapForDrawing, clearSnap, setPointerPreview, setMode, invalidateAnalysis, setHint, updateUI, draw }) {
    let centerlineTargets = [];
    let centerlineSupport = null;
    let centerlineFirstPoint = null;
    let centerlineFirstSnap = null;
    function projectPointToCenterlineSupport(point, support = centerlineSupport) { return plans.projectPointToCenterlineSupport(point, support); }
    function resetCenterlineCommandState() {
      centerlineTargets = [];
      centerlineSupport = null;
      centerlineFirstPoint = null;
      centerlineFirstSnap = null;
    }

    function prepareCenterlineEndpointPlacement(targets) {
      if (!sameSketchElements(targets, activeSketchId())) {
        setHint(applicationText("アクティブスケッチ内の対象を選択してください", "Select targets in the active sketch"), "error");
        return false;
      }
      const support = plans.centerlineSupportForTargets(targets);
      if (!support?.ok) {
        setHint(support?.reason || applicationText("中心線を作成できません", "Cannot create the centerline"), "error");
        return false;
      }
      centerlineTargets = targets.slice();
      centerlineSupport = Object.freeze({ ...support, anchor: Object.freeze({ ...support.anchor }) });
      centerlineFirstPoint = null;
      canvasSelection.set("points", targets.filter((item) => item instanceof Point));
      canvasSelection.set("lines", targets.filter((item) => item instanceof Line));
      canvasSelection.set("circles", []);
      canvasSelection.set("arcs", []);
      canvasSelection.set("splines", []);
      setHint(applicationText("中心線の1つ目の端点をクリックしてください", "Click the first centerline endpoint"));
      updateUI({ refreshAnalysis: false });
      draw();
      return true;
    }

    function addCenterlineTarget(target) {
      if (!target || !isActiveSketchElement(target)) {
        setHint(applicationText("アクティブスケッチ内の対象を選択してください", "Select a target in the active sketch"), "error");
        return false;
      }
      if (centerlineTargets.includes(target)) {
        setHint(applicationText("別の対象を選択してください", "Select a different target"), "error");
        return false;
      }
      if (centerlineTargets.length > 0 && (centerlineTargets[0] instanceof Line) !== (target instanceof Line)) {
        setHint(applicationText("2本の線、または2つの点の同じ種類で選択してください", "Select two targets of the same type"), "error");
        return false;
      }
      centerlineTargets.push(target);
      canvasSelection.set("points", centerlineTargets.filter((item) => item instanceof Point));
      canvasSelection.set("lines", centerlineTargets.filter((item) => item instanceof Line));
      if (centerlineTargets.length === 2) {
        if (prepareCenterlineEndpointPlacement(centerlineTargets)) return true;
        centerlineTargets.pop();
        canvasSelection.set("points", centerlineTargets.filter((item) => item instanceof Point));
        canvasSelection.set("lines", centerlineTargets.filter((item) => item instanceof Line));
        updateUI({ refreshAnalysis: false });
        draw();
        return false;
      }
      setHint(target instanceof Line
        ? applicationText("2本目の平行線をクリックしてください", "Click the second parallel line")
        : applicationText("2つ目の点をクリックしてください", "Click the second point"));
      updateUI({ refreshAnalysis: false });
      draw();
      return true;
    }

    function commitCenterline(secondPoint, secondSnap = null) {
      if (!centerlineSupport?.ok || centerlineTargets.length !== 2 || !centerlineFirstPoint || !secondPoint) return false;
      if (hypot2(secondPoint.x - centerlineFirstPoint.x, secondPoint.y - centerlineFirstPoint.y) < MIN_LINE_LENGTH) {
        setHint(applicationText("中心線の端点間隔を広げてください", "Place the centerline endpoints farther apart"), "error");
        draw();
        return false;
      }
      const centerline = construction.commit(centerlineTargets, centerlineSupport, centerlineFirstPoint, centerlineFirstSnap, secondPoint, secondSnap);
      if (!centerline) {
        invalidateAnalysis();
        updateUI();
        draw();
        return false;
      }
      resetCenterlineCommandState();
      setMode("select");
      setPointerPreview(null);
      clearSnap();
      canvasSelection.set("lines", [centerline]);
      updateUI();
      setHint(applicationText(`中心線 ${centerline.id} を作成しました`, `Created centerline ${centerline.id}`));
      draw();
      return true;
    }

    function handleCenterlineClick(pointer, hitPointTarget, hitLineTarget) {
      if (centerlineTargets.length < 2) {
        const wantsLine = centerlineTargets[0] instanceof Line;
        const wantsPoint = centerlineTargets[0] instanceof Point;
        const target = wantsLine ? hitLineTarget : wantsPoint ? hitPointTarget : hitPointTarget || hitLineTarget;
        if (!target) {
          setHint(applicationText("平行な2線、または2点を選択してください", "Select two parallel lines or two points"), "error");
          return;
        }
        addCenterlineTarget(target);
        return;
      }
      const { point: snapped, snap } = snapForDrawing(pointer);
      const projected = projectPointToCenterlineSupport(snapped);
      if (!projected) return;
      if (!centerlineFirstPoint) {
        centerlineFirstPoint = Object.freeze(projected);
        centerlineFirstSnap = snap;
        clearSnap();
        setPointerPreview(projected);
        setHint(applicationText("中心線の2つ目の端点をクリックしてください", "Click the second centerline endpoint"));
        draw();
        return;
      }
      commitCenterline(projected, snap);
    }
    return Object.freeze({ reset: resetCenterlineCommandState, prepare: prepareCenterlineEndpointPlacement, click: handleCenterlineClick, projectPointToCenterlineSupport,
      get targets() { return centerlineTargets.slice(); }, get support() { return centerlineSupport; }, get firstPoint() { return centerlineFirstPoint; } });
  }
  window.CenterlineCommand = Object.freeze({ create });
})();
