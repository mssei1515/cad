/* Begin and apply dimension value edits, preserving selection, rollback and first-dimension framing. */
(() => {
  "use strict";
  function createEditingSupport({ synchronizedInstanceEditing, annotationDimensions, annotationAnchorConstraints,
    expressionFromUserInput, evaluateDimensionExpressionDraft, targetFromConstraint, parameterErrorText,
    setHint, recordHistory, canvasSelection, resetDimensionDrag }) {
    function selectEditedConstraint(constraint) {
      canvasSelection.set("dimensionConstraint", constraint); canvasSelection.set("constraint", null); resetDimensionDrag();
    }
    function submitSpecialDistance(pending, value) {
      if (pending.target?.interval) return synchronizedInstanceEditing.interval(pending, value, expressionFromUserInput(pending.buffer));
      if (pending.constraint?.annotationOwner) {
        if (!annotationDimensions.setValue(pending.constraint, value)) { setHint("注記の距離拘束が成立しません", "error"); return false; }
        recordHistory("注記寸法値変更"); return true;
      }
      return pending.target?.annotationAnchor ? annotationAnchorConstraints.submitDistance(value, pending.target.dimensionAxis, pending.dimension) : null;
    }
    function commitSpecialProperty(constraint, property, input) {
      if (constraint instanceof window.GeometrySolver.InstanceAngleIntervalConstraint) {
        if (property !== "constraint-expression") return null;
        try { const expression = expressionFromUserInput(input); return synchronizedInstanceEditing.interval({ constraint, target: targetFromConstraint(constraint), dimension: constraint.dimension }, evaluateDimensionExpressionDraft(constraint, expression), expression); }
        catch (error) { setHint(parameterErrorText(error), "error"); return false; }
      }
      if (!constraint.annotationOwner) return null;
      try {
        const value = evaluateDimensionExpressionDraft(null, expressionFromUserInput(input));
        if (property !== "constraint-expression" || !annotationDimensions.setValue(constraint, value)) throw new Error("注記の距離拘束が成立しません");
        recordHistory("注記寸法値変更"); return true;
      } catch (error) { setHint(parameterErrorText(error), "error"); return false; }
    }
    return Object.freeze({ selectEditedConstraint, submitSpecialDistance, commitSpecialProperty });
  }
  function create({ canEdit = () => true, renameDimension, getPending, setPending, expressionFromUserInput, evaluateDimensionExpressionDraft,
    applicationText, parameterErrorText, setHint, syncDimensionValueInput, draw, activeSketchId,
    sketchHasDimensionConstraint, captureSketchScreenFootprint, snapshotModelState, restoreModelState,
    withTemporarySolveStepNorm, solveStepNormForConstraint, stabilizeActiveParameterNamespace,
    constraintSketchId, acceptError, hideDimensionValueInput, recordHistory, updateUI,
    scaleSketchForFirstDimension, addDistanceConstraintFromTarget, restoreSketchScreenFootprint, targetFromConstraint, isReadOnlyDimension,
    selectEditedConstraint, defaultDimensionForTarget, expressionInputValue, numericDimensionExpression, focusDimensionValueInput, submitSpecialDistance = () => null, commitSpecialProperty = () => null }) {
    function startEdit(hit) {
      if (hit?.constraint && !canEdit(constraintSketchId(hit.constraint))) return true;
      if (!hit?.constraint) return false;
      const target = targetFromConstraint(hit.constraint);
      if (!target) return false;
      if (isReadOnlyDimension(hit.constraint)) {
        selectEditedConstraint(hit.constraint);
        setHint("読み取り専用寸法の値は編集できません");
        draw();
        return true;
      }
      setPending({
        type: "distance-value",
        target,
        dimension: hit.constraint.dimension || hit.dimension || defaultDimensionForTarget(target),
        buffer: expressionInputValue(hit.constraint.expression || numericDimensionExpression(hit.constraint)),
        editing: false,
        constraint: hit.constraint,
      });
      selectEditedConstraint(hit.constraint);
      setHint(applicationText("寸法値を入力中: 数式は = から開始し、Parameter参照はダブルクオーテーションで括ります。Canvas寸法のクリックで参照を挿入できます", "Editing dimension: begin expressions with = and enclose parameter references in double quotes. Click a canvas dimension to insert a reference."));
      draw();
      focusDimensionValueInput();
      return true;
    }

    function submit() {
      const pendingCommand = getPending();
      if (!pendingCommand || pendingCommand.type !== "distance-value") return;
      if (!canEdit(pendingCommand.constraint ? constraintSketchId(pendingCommand.constraint) : activeSketchId(), pendingCommand.constraint ? "edit" : "create")) return;
      let expression;
      let value;
      try {
        expression = expressionFromUserInput(pendingCommand.buffer);
        value = evaluateDimensionExpressionDraft(pendingCommand.constraint || null, expression, undefined, { signedAngle: pendingCommand.target?.interval === true });
      } catch (error) {
        setHint(`${applicationText("寸法の値 / 数式を評価できません", "Could not evaluate the dimension Value / Expression")}: ${parameterErrorText(error)}`, "error");
        syncDimensionValueInput();
        draw();
        return;
      }
      const maxAngle = pendingCommand.target?.kind === "angle" ? 180 : Infinity;
      if (!Number.isFinite(value) || (pendingCommand.target?.interval ? value === 0 || Math.abs(value) >= 360 : value <= 0 || value >= maxAngle)) {
        setHint(applicationText("寸法値の範囲が正しくありません", "Dimension value is out of range"), "error");
        draw();
        return;
      }
      const specialResult = submitSpecialDistance(pendingCommand, value);
      if (specialResult !== null) {
        if (specialResult) { setPending(null); hideDimensionValueInput(); }
        updateUI(); draw(); return;
      }
      const { target, dimension, constraint, referenceSketchId, sketchId } = pendingCommand;
      const targetSketchId = sketchId || activeSketchId();
      const shouldFitFirstDimension = !constraint && !sketchHasDimensionConstraint(targetSketchId);
      const firstDimensionFootprint = shouldFitFirstDimension ? captureSketchScreenFootprint(targetSketchId) : null;
      if (constraint) {
        const snapshot = snapshotModelState();
        constraint.expression = expression;
        const solved = withTemporarySolveStepNorm(solveStepNormForConstraint(constraint), () => stabilizeActiveParameterNamespace(sketchId || constraintSketchId(constraint)));
        const result = solved.result;
        if (!solved.success || solved.dependent?.success === false || result.errorNorm > acceptError) {
          restoreModelState(snapshot);
          setHint(`${applicationText("寸法の値 / 数式を更新できません", "Could not update the dimension Value / Expression")}: ${result.reason || applicationText("拘束や形状を確認してください", "Check the constraints and geometry")}`, "error");
          syncDimensionValueInput();
        } else {
          setPending(null);
          hideDimensionValueInput();
          setHint(applicationText("寸法値を更新しました", "Dimension value updated"));
          recordHistory("寸法値変更");
        }
        updateUI();
        draw();
        return;
      }
      if (shouldFitFirstDimension) scaleSketchForFirstDimension(targetSketchId, target, value, dimension);
      const ok = addDistanceConstraintFromTarget(target, value, dimension, { referenceSketchId, sketchId, expression });
      if (ok) {
        setPending(null);
        hideDimensionValueInput();
      }
      if (ok && firstDimensionFootprint && restoreSketchScreenFootprint(targetSketchId, firstDimensionFootprint)) {
        setHint(`最初の寸法 ${value} に合わせて、見た目の大きさを保つよう表示スケールを調整しました`);
        draw();
      }
    }
    function commitProperty(constraint, property, value) {
      if (!canEdit(constraintSketchId(constraint), "edit")) return false;
      const specialResult = commitSpecialProperty(constraint, property, value);
      if (specialResult !== null) return specialResult;
      const snapshot = snapshotModelState();
      try {
        if (property === "constraint-parameter-name") renameDimension(constraint, value);
        else if (property === "constraint-expression") constraint.expression = expressionFromUserInput(value);
        const solved = stabilizeActiveParameterNamespace(constraintSketchId(constraint));
        if (!solved.success || solved.dependent?.success === false || solved.result.errorNorm > acceptError) {
          throw new Error(solved.result.reason || applicationText("拘束が成立しません", "Constraints could not be satisfied"));
        }
        recordHistory(property === "constraint-parameter-name" ? "寸法Parameter名変更" : "寸法式変更");
        setHint(property === "constraint-parameter-name" ? applicationText("寸法Parameter名を変更しました", "Dimension parameter name changed") : applicationText("寸法の値 / 数式を変更しました", "Dimension Value / Expression changed"));
        return true;
      } catch (error) {
        restoreModelState(snapshot);
        setHint(parameterErrorText(error), "error");
        return false;
      }
    }

    return Object.freeze({ startEdit, submit, commitProperty });
  }
  function createWithEditingSupport(options) {
    const support = createEditingSupport(options);
    return create({ ...options, ...support });
  }
  window.DimensionValueCommand = Object.freeze({ create, createEditingSupport, createWithEditingSupport });
})();
