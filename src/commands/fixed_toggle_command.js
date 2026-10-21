/* Fixed-state toggles delegate constraints, snapshots, solving and history to their existing owners. */
(() => {
  "use strict";
  function createOperand({ guardSketchEdit, elementSketchId, operandElement, guardSketchProjectionShapeEdit, applicationText, findLineFixedConstraint, LineFixedConstraint, findArcEndpointFixedConstraint, arcEndpointPoint, ArcEndpointFixedConstraint, currentScope, GeometryFixedConstraint, sameConstraintDisplayElement, deleteElements, commitNewConstraint, solveAndRefresh }) {
    function unfixPoint(point) {
      if (!guardSketchEdit(elementSketchId(point), "constraint")) return;
      point.fixed = false;
      solveAndRefresh(`固定解除 ${point.id}`);
    }
    function toggle(operand) {
      if (!guardSketchEdit(elementSketchId(operandElement(operand)), "constraint")) return false;
      const geometry = operand.element;
      if (!guardSketchProjectionShapeEdit([geometry], { action: applicationText("固定", "Fix") })) return false;
      let existing;
      let constraint;
      if (operand.kind === "line") {
        existing = findLineFixedConstraint(geometry);
        constraint = existing || new LineFixedConstraint(geometry);
      } else if (operand.kind === "arc-endpoint") {
        existing = findArcEndpointFixedConstraint(geometry, operand.endpoint);
        const position = arcEndpointPoint(geometry, operand.endpoint);
        constraint = existing || new ArcEndpointFixedConstraint(geometry, operand.endpoint, position.x, position.y);
      } else {
        existing = currentScope().constraints.find((item) => item.enabled !== false && item instanceof GeometryFixedConstraint && sameConstraintDisplayElement(item.geometry, geometry));
        constraint = existing || new GeometryFixedConstraint(geometry);
      }
      if (existing) return deleteElements({ constraints: [existing] });
      return commitNewConstraint("fixed", constraint);
    }
    return Object.freeze({ toggle, unfixPoint });
  }

  function createSelection({ guardSelectionEdit, canvasSelection, blockDefinitionById, setHint, clearSelection, updateUI, draw, recordHistory, findArcEndpointFixedConstraint, deleteElements, log, arcEndpointPoint, guardSketchProjectionShapeEdit, applicationText, snapshotModelState, commitNewConstraint, ArcEndpointFixedConstraint, restoreModelState, selectedFixedBatchTargets, fixedBatchIsFullyFixed, findLineFixedConstraint, pushModelConstraint, LineFixedConstraint, currentScope, solveSketchAndDependents, acceptError, refreshConstraintAnalysis }) {
    function toggle() {
      if (!guardSelectionEdit("constraint")) return false;
      const projectedSelection = [...canvasSelection.points, ...canvasSelection.lines, ...canvasSelection.circles, ...canvasSelection.arcs, ...canvasSelection.splines].filter((item) => item?.blockProjection);
      const projectedInstances = [...new Set(projectedSelection.map((item) => item.blockInstance))];
      const instance = canvasSelection.blockInstances.length === 1
        ? canvasSelection.blockInstances[0]
        : projectedSelection.length > 0 && projectedInstances.length === 1 && projectedSelection.length === canvasSelection.points.length + canvasSelection.lines.length + canvasSelection.circles.length + canvasSelection.arcs.length + canvasSelection.splines.length
          ? projectedInstances[0]
          : null;
      if (instance) {
        instance.fixed = !instance.fixed;
        setHint(`${blockDefinitionById(instance.definitionId)?.name || instance.id} を${instance.fixed ? "固定" : "固定解除"}しました`);
        clearSelection();
        updateUI();
        draw();
        recordHistory("ブロック固定切替");
        return true;
      }
      if (canvasSelection.arcEndpoint) {
        const { arc, endpoint } = canvasSelection.arcEndpoint;
        const existing = findArcEndpointFixedConstraint(arc, endpoint);
        if (existing) {
          deleteElements({ constraints: [existing] });
          log(`${arc.id}.${endpoint} の固定を解除しました`);
          return true;
        }
        const p = arcEndpointPoint(arc, endpoint);
        if (!guardSketchProjectionShapeEdit([arc], { action: applicationText("固定", "Fix") })) {
          draw();
          return false;
        }
        const snapshot = snapshotModelState();
        if (!commitNewConstraint("fixed", new ArcEndpointFixedConstraint(arc, endpoint, p.x, p.y))) {
          restoreModelState(snapshot);
          updateUI();
          draw();
          return false;
        }
        return true;
      }
      const batch = selectedFixedBatchTargets();
      if (!batch) return false;
      if (!guardSketchProjectionShapeEdit([...batch.points, ...batch.lines], { action: applicationText("固定", "Fix") })) {
        draw();
        return false;
      }
      const snapshot = snapshotModelState();
      const nextFixed = !fixedBatchIsFullyFixed(batch);
      for (const point of batch.points) point.fixed = nextFixed;
      if (nextFixed) {
        for (const line of batch.lines) if (!findLineFixedConstraint(line)) pushModelConstraint(new LineFixedConstraint(line), batch.sketchId);
      } else {
        const fixedConstraints = new Set(batch.lines.map(findLineFixedConstraint).filter(Boolean));
        for (let index = currentScope().constraints.length - 1; index >= 0; index--) {
          if (fixedConstraints.has(currentScope().constraints[index])) currentScope().constraints.splice(index, 1);
        }
      }
      const solved = solveSketchAndDependents(batch.sketchId, snapshot);
      const fixedResult = solved.result;
      if (!solved.success || solved.dependent?.success === false || fixedResult.errorNorm > acceptError) {
        restoreModelState(snapshot);
        setHint(applicationText("選択対象の固定状態を変更できません。拘束や形状を確認してください", "The selected objects could not be fixed or unfixed. Check the constraints and geometry."), "error");
        updateUI();
        draw();
        return false;
      }
      refreshConstraintAnalysis();
      setHint(applicationText("固定状態を変更しました", "Fixed state updated"));
      updateUI({ refreshAnalysis: false });
      draw();
      const ids = [...batch.points, ...batch.lines].map((item) => item.id);
      log(`${ids.join(", ")} の固定状態を ${nextFixed} にしました\n自動solve: success=${fixedResult.success}`);
      recordHistory("固定状態変更");
      return true;
    }
    return Object.freeze({ toggle });
  }

  window.FixedToggleCommand = Object.freeze({ createOperand, createSelection });
})();
