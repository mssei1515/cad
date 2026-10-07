/* Create constrained circle center crosses as one recoverable editing operation. */
(() => {
  "use strict";
  const { Circle, PointOnLineConstraint, PointOnCircleConstraint, VerticalConstraint, HorizontalConstraint } = window.GeometrySolver;
  function create({ geometry: { addPoint, addLine, pushModelConstraint },
    checkpoint: { capture: snapshotGeometryMutationState, restore: restoreGeometryMutationState },
    solveSketchAndDependents, resultIsAccepted, minOrientationLength: MIN_ORIENTATION_LENGTH,
    activeSketchId, isActiveSketchElement, selection: canvasSelection, selectedElementCount,
    cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation,
    setMode, clearPreview, clearSnap, clearSelection, invalidateAnalysis, updateUI, draw, setHint, recordHistory, applicationText }) {
    function createCircleCenterCrosses(circles) {
      const targets = [...new Set(Array.isArray(circles) ? circles : [])];
      if (targets.length === 0 || !targets.every((circle) => circle instanceof Circle && isActiveSketchElement(circle))) {
        setHint(applicationText("アクティブスケッチ内の円を選択してください", "Select circles in the active sketch"), "error");
        return false;
      }
      const invalidCircle = targets.find((circle) => !Number.isFinite(circle.radius()) || circle.radius() < MIN_ORIENTATION_LENGTH);
      if (invalidCircle) {
        setHint(applicationText(`円 ${invalidCircle.id} が小さすぎるため十字補助線を作成できません`, `Circle ${invalidCircle.id} is too small to create centerlines`), "error");
        return false;
      }
  
      const sketchId = activeSketchId();
      const snapshot = snapshotGeometryMutationState();
      const createdLines = [];
      for (const circle of targets) {
        const radius = circle.radius();
        const vertical = addLine(
          addPoint(circle.center.x, circle.center.y - radius, false, "endpoint"),
          addPoint(circle.center.x, circle.center.y + radius, false, "endpoint"),
          true,
        );
        const horizontal = addLine(
          addPoint(circle.center.x - radius, circle.center.y, false, "endpoint"),
          addPoint(circle.center.x + radius, circle.center.y, false, "endpoint"),
          true,
        );
        createdLines.push(vertical, horizontal);
        for (const constraint of [
          new PointOnLineConstraint(circle.center, vertical),
          new VerticalConstraint(vertical),
          new PointOnCircleConstraint(vertical.p1, circle),
          new PointOnCircleConstraint(vertical.p2, circle),
          new PointOnLineConstraint(circle.center, horizontal),
          new HorizontalConstraint(horizontal),
          new PointOnCircleConstraint(horizontal.p1, circle),
          new PointOnCircleConstraint(horizontal.p2, circle),
        ]) pushModelConstraint(constraint, sketchId);
      }
  
      const solved = solveSketchAndDependents(sketchId);
      if (!solved.success || solved.dependent?.success === false || !resultIsAccepted(solved.result)) {
        const reason = solved.result?.reason || applicationText("拘束を解けません", "The constraints could not be solved");
        restoreGeometryMutationState(snapshot);
        solveSketchAndDependents(sketchId);
        invalidateAnalysis();
        setHint(`${applicationText("円中心十字線を作成できません", "Could not create the circle center cross")}: ${reason}`, "error");
        updateUI();
        draw();
        return false;
      }
  
      setMode("select");
      clearPreview();
      clearSnap();
      clearSelection();
      canvasSelection.set("lines", createdLines);
      invalidateAnalysis();
      updateUI();
      draw();
      setHint(applicationText(`${targets.length}個の円に十字補助線を作成しました`, `Created centerlines for ${targets.length} circle(s)`));
      recordHistory("円中心十字線");
      return true;
    }
  
    function startCircleCenterCrossCommand() {
      cancelConstraintTargetCommand("");
      cancelPendingCommand("");
      if (!canCreateInActiveSketch()) return void rejectRootSketchCreation();
      const preselected = canvasSelection.circles.length > 0 && selectedElementCount() === canvasSelection.circles.length ? canvasSelection.circles.slice() : [];
      if (preselected.length > 0 && createCircleCenterCrosses(preselected)) return;
      clearSelection();
      setMode("circle-center-cross");
      clearPreview();
      clearSnap();
      updateUI({ refreshAnalysis: false });
      draw();
      setHint(applicationText("十字補助線を入れる円をクリックしてください", "Click the circle to add centerlines"));
    }
  
    function handleCircleCenterCrossClick(circle) {
      if (!circle) {
        setHint(applicationText("円をクリックしてください", "Click a circle"), "error");
        return false;
      }
      return createCircleCenterCrosses([circle]);
    }
    return Object.freeze({ start: startCircleCenterCrossCommand, click: handleCircleCenterCrossClick, createCrosses: createCircleCenterCrosses });
  }
  window.CircleCenterCrossCommand = Object.freeze({ create });
})();
