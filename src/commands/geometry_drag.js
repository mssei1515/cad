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
      session.syncAnnotation?.();
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
      try { complete(completed, event, completedLabel); } finally { completed.onEnd?.(); }
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
      session.syncAnnotation?.();
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
      session.syncAnnotation?.();
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
      reset: () => { session?.onEnd?.(); session = null; },
      get active() { return Boolean(session); },
      get label() { return session ? dragLabel(session) : ""; },
      isCenter: (point) => Boolean(["circle", "arc", "arc-endpoint"].includes(session?.kind) && session.item?.center === point),
      isArcEndpoint: (arc, endpoint) => Boolean(session?.kind === "arc-endpoint" && session.item === arc && session.endpoint === endpoint),
      isPoint: (point) => Boolean(session?.kind === "point" && session.points.some((target) => target.point === point)),
    });
  }
  // Prepare derived-instance or source-geometry interaction; the drag lifecycle retains its session.
  function createDerivedEntry({ types: { Point, Line }, canEdit, canvasSelection, geometryInstanceSourceObjects,
    clearSelection, geometryInstanceSourcePoints, resolveDerivedDragSource, buildDragSession, geometryDrag,
    setHint, applicationText, updateGeometrySelectionUI, updateUI, draw }) {
    function beginDerivedGeometryDrag(e, hit, pointer) {
      if (hit.item?.instanceControl === "anchor") return;
      if (!canEdit(hit.instance.sketchId)) return;
      const wholeSelected = canvasSelection.geometryInstances.includes(hit.instance) && canvasSelection.instanceGeometry?.instanceId !== hit.instance.id;
      if (["pattern", "circularPattern", "mirror"].includes(hit.instance.type)
        && (!canvasSelection.geometryInstances.includes(hit.instance) || wholeSelected)) {
        const instance = hit.instance;
        const sources = geometryInstanceSourceObjects(instance);
        clearSelection();
        canvasSelection.set("geometryInstances", [instance]);
        const plan = { kind: "free-instance", mode: "block", item: instance, sketchId: instance.sketchId,
          startPointer: pointer, startX: instance.x, startY: instance.y,
          clickGeometrySelection: wholeSelected ? { instanceId: instance.id, id: hit.item.id, kind: hit.kind, endpoint: hit.endpoint } : null,
          variableAllowed: (v) => !sources.has(v.object) && !(v.object === instance && v.prop === "rotation") };
        if (!window.PatternInstanceModel.placed(instance) || instance.placement.kind === "circular") {
          const item = hit.item;
          let anchor = item instanceof Point ? item : item.center || geometryInstanceSourcePoints(item)[0];
          if (item instanceof Line) {
            const dx = item.p2.x - item.p1.x, dy = item.p2.y - item.p1.y;
            const t = Math.max(0, Math.min(1, ((pointer.x - item.p1.x) * dx + (pointer.y - item.p1.y) * dy) / Math.max(dx * dx + dy * dy, 1e-20)));
            anchor = { get x() { return item.p1.x + t * (item.p2.x - item.p1.x); },
              get y() { return item.p1.y + t * (item.p2.y - item.p1.y); } };
          }
          if (!anchor) return;
          Object.assign(plan, { kind: "derived-instance", mode: "derived-placement", anchor,
            startAnchor: { x: anchor.x, y: anchor.y } });
        }
        geometryDrag.begin(e, plan);
        setHint(applicationText("インスタンス全体を移動中", "Moving the whole instance"));
        updateGeometrySelectionUI();
        draw();
        return;
      }
      const resolved = resolveDerivedDragSource(hit, pointer);
      clearSelection();
      canvasSelection.set("geometryInstances", hit?.instance ? [hit.instance] : []);
      if (hit.instance.type !== "sketchProjection") {
        canvasSelection.set("instanceGeometry", { instanceId: hit.instance.id, id: hit.item.id, kind: hit.kind, endpoint: hit.endpoint });
      }
      if (!resolved) {
        setHint(applicationText("派生インスタンスの参照元を解決できません", "The derived instance source could not be resolved."), "error");
        updateGeometrySelectionUI();
        draw();
        return;
      }
      if (resolved.crossesSketchProjection) {
        setHint(applicationText("スケッチ投影は先祖スケッチの参照元を変更するためドラッグできません", "Sketch projections cannot be dragged because that would modify source geometry in an ancestor sketch."), "error");
        updateGeometrySelectionUI();
        draw();
        return;
      }

      let source = resolved.item;
      let kind = hit.kind;
      let dragItem = source;
      if (source.blockProjection) {
        source = source.blockInstance;
        kind = "block";
        dragItem = source;
      } else if (kind === "arc-endpoint") {
        dragItem = { arc: source, endpoint: hit.endpoint };
      }
      const plan = buildDragSession(kind, dragItem, resolved.pointer);
      if (!plan) {
        geometryDrag.reset();
        setHint(applicationText("参照元が固定されているためドラッグできません", "The source is fixed and cannot be dragged."), "error");
        updateGeometrySelectionUI();
        draw();
        return;
      }
      plan.displayStartPointer = pointer;
      plan.pointerMap = resolved.mapPointer;
      plan.derivedInstance = hit.instance;
      plan.derivedSource = resolved.item;
      const placements = new Set();
      for (let node = hit.item; node?.derivedProjection; node = node.sourceElement) {
        if (Boolean(node.derivedInstance?.placement)) placements.add(node.derivedInstance);
      }
      if (placements.size) plan.variableAllowed = (v) => !placements.has(v.object);
      geometryDrag.begin(e, plan);
      setHint(applicationText(`${geometryDrag.label}中: 参照元へ反映しながら拘束をsolveしています`, `${geometryDrag.label}: solving constraints while updating the source`));
      updateUI({ refreshAnalysis: false });
      draw();
    }
    return Object.freeze({ begin: beginDerivedGeometryDrag });
  }
  window.GeometryDrag = Object.freeze({ create, createDerivedEntry });
})();
