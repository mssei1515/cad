/* Own geometry drag lifecycle; numeric preparation and solving are explicit collaborators. */
(() => {
  "use strict";
  const { hypot2 } = window.GeometrySolver;
  function create({ canEdit = () => true, prepareSession, dragResultForSession, solveFinalDragSession,
    currentScope, activeSketchId, viewScale, beginPointer, endPointer, projectionBlockedMessage,
    canvasSelection, restoreModelState, restoreSolverState, solveReferenceDependentSketches,
    normalizeArcSweeps, clearSketchSolveState, invalidateBlockProjectionCache,
    stabilizeActiveParameterNamespace, refreshConstraintAnalysis, acceptError,
    applicationText, setHint, updateUI, updateGeometrySelectionUI, draw, recordHistory }) {
    let session = null;
    function begin(event, plan) {
      if (plan && !canEdit(plan.sketchId || activeSketchId())) return false;
      session = plan ? { ...plan } : null;
      if (!session) return false;
      prepareSession(session);
      beginPointer(event.pointerId);
      return true;
    }

    function update(p) {
      if (!session) return;
      const displayStartPointer = session.displayStartPointer || session.startPointer;
      const pointerDistance = hypot2(p.x - displayStartPointer.x, p.y - displayStartPointer.y);
      if (!session.previewMoved && pointerDistance <= 3 / viewScale()) return;
      if (session.projectionShapeLocked) {
        session.projectionDragAttempted = true;
        setHint(projectionBlockedMessage(), "error");
        draw();
        return;
      }
      session.previewMoved = true;
      const dragPointer = session.pointerMap ? session.pointerMap(p) : p;
      const result = dragResultForSession(session, dragPointer);
      if (result.blocked) {
        setHint(result.reason, "error");
        updateUI({ refreshAnalysis: false });
        draw();
        return;
      }
      const dependentResult = solveReferenceDependentSketches(session.sketchId || activeSketchId());
      setHint(dependentResult.success
        ? applicationText("ドラッグ中: 拘束を保ちながら調整しています", "Dragging: maintaining constraints")
        : applicationText("ドラッグ中: 参照先の拘束を確認してください", "Dragging: check the referenced constraints"), dependentResult.success ? "normal" : "error");
      if (!dependentResult.success) updateUI();
      draw();
    }

    function finish(event) {
      if (!session) return false;
      const completed = session;
      const completedLabel = dragLabel(completed);
      session = null;
      endPointer(event.pointerId);
      complete(completed, event, completedLabel);
      return true;
    }

    function complete(session, e, completedLabel) {
      if (session.projectionDragAttempted) {
        setHint(projectionBlockedMessage(), "error");
        draw();
        return;
      }
      if (!session.previewMoved) {
        if (session.clickGeometrySelection && e.type !== "pointercancel") {
          canvasSelection.set("instanceGeometry", session.clickGeometrySelection);
          updateGeometrySelectionUI();
        }
        setHint("図形を選択しました");
        draw();
        return;
      }
      const result = solveFinalDragSession(session);
      normalizeArcSweeps();
      const invalidSpline = currentScope().splines.find((spline) => !spline.curve().valid);
      if (!result.success || result.errorNorm > acceptError || invalidSpline) {
        if (session.parameterDragSnapshot) restoreModelState(session.parameterDragSnapshot);
        else if (session.fullDragState) restoreSolverState(session.fullDragState);
        clearSketchSolveState(session.sketchId || activeSketchId());
        setHint(invalidSpline
          ? applicationText(`${invalidSpline.id} の通過点が重なり、スプラインが成立しないため移動を戻しました`, `${invalidSpline.id} was restored because overlapping fit points made the spline invalid.`)
          : applicationText(`${completedLabel}完了時に拘束を解決できないため移動を戻しました`, `${completedLabel} was restored because its constraints could not be resolved.`), "error");
        updateUI();
        draw();
        return;
      }

      if (session.item && currentScope().blockInstances.includes(session.item)) invalidateBlockProjectionCache(session.item.id);
      const stabilized = stabilizeActiveParameterNamespace(session.sketchId || activeSketchId(), { variableAllowed: session.variableAllowed });
      if (!stabilized.success || stabilized.dependent?.success === false || stabilized.result.errorNorm > acceptError) {
        if (session.parameterDragSnapshot) restoreModelState(session.parameterDragSnapshot);
        clearSketchSolveState(session.sketchId || activeSketchId());
        setHint(`${completedLabel}${applicationText("後のParameter計算に失敗しました", " parameter calculation failed")}: ${stabilized.result.reason || "solve failed"}`, "error");
        updateUI();
        draw();
        return;
      }
      const dependentResult = stabilized.dependent;
      const analysis = refreshConstraintAnalysis();
      const stable = analysis.analysis.stable && dependentResult.success;
      setHint(stable
        ? applicationText(`${completedLabel}を完了しました`, `${completedLabel} completed`)
        : applicationText(`${completedLabel}を完了しました。拘束状態を確認してください`, `${completedLabel} completed. Check the constraint status`), stable ? "normal" : "error");
      updateUI({ refreshAnalysis: false });
      draw();
      recordHistory(`${completedLabel}ドラッグ`);
    }

    function dragLabel(session) {
      if (session.kind === "free-instance" || session.kind === "derived-instance") return applicationText("インスタンス移動", "Instance move");
      if (session.mode === "block") return applicationText("ブロック移動", "Block move");
      if (session.mode === "block-rotation") return applicationText("ブロック回転", "Block rotation");
      if (session.kind === "selection") return applicationText("選択移動", "Selection move");
      if (session.mode === "radius" && session.activeMode === "move") return applicationText("ドラッグ", "Drag");
      if (session.mode === "radius") return applicationText("半径変更", "Radius change");
      if (session.mode === "arc-endpoint") return applicationText("円弧端点変更", "Arc endpoint change");
      return applicationText("ドラッグ", "Drag");
    }

    return Object.freeze({
      begin, update, finish,
      reset: () => { session = null; },
      get active() { return Boolean(session); },
      get label() { return session ? dragLabel(session) : ""; },
      isCenter: (point) => Boolean(["circle", "arc", "arc-endpoint"].includes(session?.kind) && session.item?.center === point),
      isArcEndpoint: (arc, endpoint) => Boolean(session?.kind === "arc-endpoint" && session.item === arc && session.endpoint === endpoint),
      isPoint: (point) => Boolean(session?.kind === "point" && session.points.some((target) => target.point === point)),
    });
  }
  window.GeometryDrag = Object.freeze({ create });
})();
