/* Apply ordinary and reference constraints with existing solve acceptance and recovery rules. */
(() => {
  "use strict";
  function create({ guardSketchEdit, activeSketchId, constraintTargetsAreActive, snapshotModelState, restoreModelState,
    solveStepNormForConstraint, pushModelConstraint, preconditionNewConstraint, withTemporarySolveStepNorm,
    solveConstraintComponentAndDependents, isDimensionConstraint, isReadOnlyDimension, stabilizeActiveParameterNamespace,
    constraintSketchId, lineCollapseQuery, redundantConstraintInfo, acceptError: CONSTRAINT_ACCEPT_ERROR,
    addReadOnlyDimensionConstraint, clearSelection, refreshConstraintAnalysis, updateUI, draw, setHint, log,
    recordHistory, applicationText, isReferenceSourceSketchId, descendantSketchIds, wouldCreateReferenceCycle,
    sketchName, now, recordPerformance }) {
    function commitNewConstraint(type, constraint) {
      if (!guardSketchEdit(activeSketchId(), "constraint")) return false;
      if (!constraintTargetsAreActive(constraint)) {
        const msg = "別スケッチ同士は通常拘束できません";
        setHint(msg, "error");
        log(msg);
        return false;
      }
      const performanceTrace = { kind: "constraint", type, startedAt: now() };
      const snapshot = snapshotModelState();
      performanceTrace.snapshotMs = now() - performanceTrace.startedAt;
      const solveStepNorm = solveStepNormForConstraint(constraint);
      pushModelConstraint(constraint);
      preconditionNewConstraint(constraint);

      const solveStartedAt = now();
      let solved = withTemporarySolveStepNorm(solveStepNorm, () => solveConstraintComponentAndDependents(constraint, snapshot));
      if (solved.success && isDimensionConstraint(constraint) && !isReadOnlyDimension(constraint)) {
        const stabilized = stabilizeActiveParameterNamespace(constraintSketchId(constraint));
        if (!stabilized.success || stabilized.dependent?.success === false) solved = stabilized;
      }
      performanceTrace.solveMs = now() - solveStartedAt;
      const result = solved.result;
      performanceTrace.solveVariableCount = result.variableCount;
      performanceTrace.solveConstraintCount = result.constraintCount;
      performanceTrace.solveErrorNorm = result.errorNorm;
      performanceTrace.solveIterations = result.iterations;
      performanceTrace.fullFallback = Boolean(result.fullFallback);
      const collapse = lineCollapseQuery.find(constraint, snapshot, constraintSketchId(constraint));
      const redundancyStartedAt = now();
      const duplicate = solved.success && result.errorNorm <= CONSTRAINT_ACCEPT_ERROR && !collapse ? redundantConstraintInfo(constraint, constraintSketchId(constraint)) : null;
      performanceTrace.redundancyMs = now() - redundancyStartedAt;
      if (!solved.success || result.errorNorm > CONSTRAINT_ACCEPT_ERROR || collapse || duplicate?.redundant) {
        if (duplicate?.redundant && isDimensionConstraint(constraint)) {
          restoreModelState(snapshot);
          return addReadOnlyDimensionConstraint(constraint, constraintSketchId(constraint));
        }
        restoreModelState(snapshot);
        const msg = `拘束を追加できません: 矛盾しています (error=${result.errorNorm.toExponential(3)}, reason=${result.reason})`;
        const collapseMsg = collapse
          ? `拘束を追加できません: 線${collapse.line.id}が退化するため矛盾しています (${collapse.before.toExponential(3)} -> ${collapse.after.toExponential(3)})`
          : msg;
        const duplicateMsg = duplicate?.redundant
          ? `拘束を追加できません: 重複しています (rank ${duplicate.rankBefore} -> ${duplicate.rankAfter})`
          : collapseMsg;
        setHint(duplicateMsg, "error");
        updateUI();
        draw();
        log(duplicateMsg);
        return;
      }

      clearSelection();
      const redundancyBySketch = duplicate?.redundancy ? new Map([[constraintSketchId(constraint), duplicate.redundancy]]) : null;
      const analysisStartedAt = now();
      refreshConstraintAnalysis({ redundancyBySketch });
      performanceTrace.analysisMs = now() - analysisStartedAt;
      const uiStartedAt = now();
      updateUI({ refreshAnalysis: false });
      draw();
      performanceTrace.uiMs = now() - uiStartedAt;
      setHint(applicationText("拘束を追加しました", "Constraint added"));
      log(`拘束を追加しました: ${type}\n自動solve: success=${solved.success}, error=${result.errorNorm.toExponential(3)}`);
      recordHistory(`拘束追加: ${type}`);
      performanceTrace.totalMs = now() - performanceTrace.startedAt;
      recordPerformance(performanceTrace);
      return true;
    }

    function markReferenceConstraint(constraint, referenceSketchId, sketchId = activeSketchId()) {
      constraint.reference = true;
      constraint.referenceSketchId = referenceSketchId;
      constraint.sketchId = sketchId;
      constraint.name = `参照 ${constraint.name}`;
      return constraint;
    }

    function commitReferenceConstraint(type, constraint, referenceSketchId, sketchId = activeSketchId()) {
      if (!constraint || !isReferenceSourceSketchId(referenceSketchId, sketchId)) {
        const msg = descendantSketchIds(sketchId).includes(referenceSketchId) ? "子孫スケッチは参照できません" : "先祖スケッチのみ参照できます";
        setHint(msg, "error");
        log(msg);
        return false;
      }
      if (wouldCreateReferenceCycle(sketchId, referenceSketchId)) {
        const msg = "スケッチ間の参照が循環するため追加できません";
        setHint(msg, "error");
        log(msg);
        return false;
      }
      const snapshot = snapshotModelState();
      markReferenceConstraint(constraint, referenceSketchId, sketchId);
      const solveStepNorm = solveStepNormForConstraint(constraint);
      pushModelConstraint(constraint, sketchId);
      preconditionNewConstraint(constraint);
      const solved = withTemporarySolveStepNorm(solveStepNorm, () => solveConstraintComponentAndDependents(constraint, snapshot));
      const result = solved.result;
      const collapse = lineCollapseQuery.find(constraint, snapshot, sketchId);
      const duplicate = solved.success && result.errorNorm <= CONSTRAINT_ACCEPT_ERROR && !collapse ? redundantConstraintInfo(constraint, sketchId) : null;
      if (!solved.success || result.errorNorm > CONSTRAINT_ACCEPT_ERROR || collapse || duplicate?.redundant) {
        if (duplicate?.redundant && isDimensionConstraint(constraint)) {
          restoreModelState(snapshot);
          return addReadOnlyDimensionConstraint(constraint, sketchId, "重複参照寸法");
        }
        restoreModelState(snapshot);
        const msg = `参照拘束を追加できません: 矛盾しています (error=${result.errorNorm.toExponential(3)}, reason=${result.reason})`;
        const collapseMsg = collapse
          ? `参照拘束を追加できません: 線${collapse.line.id}が退化するため矛盾しています (${collapse.before.toExponential(3)} -> ${collapse.after.toExponential(3)})`
          : msg;
        const duplicateMsg = duplicate?.redundant
          ? `参照拘束を追加できません: 重複しています (rank ${duplicate.rankBefore} -> ${duplicate.rankAfter})`
          : collapseMsg;
        setHint(duplicateMsg, "error");
        updateUI();
        draw();
        log(duplicateMsg);
        return false;
      }
      clearSelection();
      const redundancyBySketch = duplicate?.redundancy ? new Map([[sketchId, duplicate.redundancy]]) : null;
      refreshConstraintAnalysis({ redundancyBySketch });
      updateUI({ refreshAnalysis: false });
      draw();
      setHint(applicationText(`参照拘束を追加しました: ${sketchName(referenceSketchId)} を参照`, `Reference constraint added: referencing ${sketchName(referenceSketchId)}`));
      log(`参照拘束を追加しました: ${type}\n自動solve: success=${result.success}, error=${result.errorNorm.toExponential(3)}`);
      recordHistory(`参照拘束追加: ${type}`);
      return true;
    }

    return Object.freeze({ ordinary: commitNewConstraint, reference: commitReferenceConstraint, markReference: markReferenceConstraint });
  }
  window.ConstraintCommitCommand = Object.freeze({ create });
})();
