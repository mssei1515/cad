/* Resolve explicit ordered operands into a constraint intent; execution is caller-owned. */
(() => {
  "use strict";
  function create({ candidates, operands, types, activeSketchId, isReferenceSourceSketchId, wouldCreateReferenceCycle,
    isActiveSketchElement, isEditableSketchElement, descendantSketchIds, applicationText, invalidConstraintTargetHint }) {
    const { distanceTargetFromOperands, symmetryConstraintFromOperands, constraintFromTargets,
      constraintTargetsFromOperands, referenceDistanceTargetForSubject, referenceConstraintForType } = candidates;
    const { subjectFromOperand, referenceTargetFromOperand, referenceSubjectElement, referenceSubjectSketchId } = operands;
    const { PointOnSplineConstraint, SplineLineTangentConstraint, SplineSplineTangentConstraint } = types;
    function splitConstraintOperands(operands) {
      return {
        active: operands.filter((operand) => operand.relation === "active"),
        reference: operands.filter((operand) => operand.relation === "reference"),
        descendant: operands.filter((operand) => operand.relation === "descendant"),
      };
    }

    function referenceResolutionFromOperands(type, operands) {
      const { active, reference } = splitConstraintOperands(operands);
      if (active.length !== 1 || reference.length !== 1) return { error: "参照拘束はアクティブスケッチ側1つと先祖スケッチ側1つを選択してください" };
      return constraintResolutionFromSubjectAndReference(type, subjectFromOperand(active[0]), referenceTargetFromOperand(reference[0]));
    }

    function splineConstraintResolution(type, operands) {
      if (operands.length !== 2) return null;
      const pointOperand = operands.find((operand) => operand.kind === "point");
      const splineOperands = operands.filter((operand) => operand.kind === "spline");
      if (type === "coincident" && pointOperand && splineOperands.length === 1) {
        const splineOperand = splineOperands[0];
        return { constraint: new PointOnSplineConstraint(pointOperand.point, splineOperand.spline, splineOperand.parameter) };
      }
      if (type !== "tangent" || splineOperands.length === 0) return null;
      if (splineOperands.some((operand) => operand.spline.closed)) return { error: applicationText("閉じたスプラインには端点接線拘束を設定できません", "Endpoint tangent constraints cannot be applied to closed splines.") };
      const lineOperand = operands.find((operand) => operand.kind === "line");
      if (lineOperand && splineOperands.length === 1) {
        const splineOperand = splineOperands[0];
        return { constraint: new SplineLineTangentConstraint(splineOperand.spline, splineOperand.endpoint, lineOperand.line) };
      }
      if (splineOperands.length === 2) {
        return { constraint: new SplineSplineTangentConstraint(splineOperands[0].spline, splineOperands[0].endpoint, splineOperands[1].spline, splineOperands[1].endpoint) };
      }
      return { error: invalidConstraintTargetHint(type) };
    }

    function normalConstraintFromOperands(type, operands) {
      if (type === "symmetry") return symmetryConstraintFromOperands(operands);
      return constraintFromTargets(type, constraintTargetsFromOperands(operands), activeSketchId());
    }

    function symmetryReferenceResolutionFromOperands(operands) {
      if (operands.length < 3) return null;
      const { active, reference } = splitConstraintOperands(operands);
      const constraint = symmetryConstraintFromOperands(operands);
      if (!constraint || active.length === 0 || reference.length === 0) return { error: "参照対称拘束では、対称軸、同種の対象2つの順に選択してください" };
      const referenceSketchIds = [...new Set(reference.map((operand) => operand.sketchId))];
      if (referenceSketchIds.length !== 1) return { error: "参照対称拘束の参照対象は同じ先祖スケッチから選択してください" };
      const sketchId = active[0].sketchId;
      const referenceSketchId = referenceSketchIds[0];
      if (!active.every((operand) => operand.sketchId === sketchId) || !isReferenceSourceSketchId(referenceSketchId, sketchId)) {
        return { error: "参照対称拘束ではアクティブスケッチと1つの先祖スケッチだけを選択してください" };
      }
      if (wouldCreateReferenceCycle(sketchId, referenceSketchId)) return { error: "スケッチ間の参照が循環するため追加できません" };
      return {
        type: "symmetry",
        action: "commit",
        constraint,
        operands,
        referenceSketchId,
        sketchId,
      };
    }

    function resolveConstraintIntent(type, operands) {
      const cleanOperands = operands.filter(Boolean);
      const { active, reference, descendant } = splitConstraintOperands(cleanOperands);
      if (descendant.length > 0) return { error: "子孫スケッチは参照できません" };
      if (reference.length > 0) {
        if (type === "distance" && active.length === 0 && reference.length === cleanOperands.length) {
          const target = distanceTargetFromOperands(cleanOperands);
          if (!target || target.kind === "invalid") return target?.kind === "invalid" ? { error: target.reason } : null;
          return { type, action: "place-dimension", target, operands: cleanOperands, sketchId: activeSketchId(), readOnlyDimension: true };
        }
        if (type === "symmetry") return symmetryReferenceResolutionFromOperands(cleanOperands);
        if (cleanOperands.length < 2 || active.length === 0) return null;
        if (cleanOperands.length !== 2) return { error: "参照拘束はアクティブスケッチ側と先祖スケッチ側を1つずつ選択してください" };
        const resolution = referenceResolutionFromOperands(type, cleanOperands);
        if (type === "distance" && resolution?.target) return { ...resolution, action: "place-dimension", operands: cleanOperands };
        return resolution?.constraint ? { ...resolution, action: "commit", operands: cleanOperands } : resolution;
      }
      if (active.length !== cleanOperands.length) return { error: "拘束対象はアクティブスケッチ、または先祖スケッチだけを選択できます" };
      const sketchIds = [...new Set(cleanOperands.map((operand) => operand.sketchId))];
      if (sketchIds.length > 1) return { error: "別スケッチ同士は通常拘束できません" };
      if (type === "distance") {
        const target = distanceTargetFromOperands(cleanOperands);
        if (!target || target.kind === "invalid") return target?.kind === "invalid" ? { error: target.reason } : null;
        return { type, action: "place-dimension", target, operands: cleanOperands, sketchId: sketchIds[0] || activeSketchId() };
      }
      const splineResolution = splineConstraintResolution(type, cleanOperands);
      if (splineResolution?.error) return splineResolution;
      const constraint = splineResolution?.constraint || normalConstraintFromOperands(type, cleanOperands);
      return constraint ? { type, action: "commit", constraint, operands: cleanOperands, sketchId: sketchIds[0] || activeSketchId() } : null;
    }

    function referenceSketchIdFromPair(subject, referenceTarget) {
      const subjectSketchId = referenceSubjectSketchId(subject);
      if (!subjectSketchId || !referenceTarget?.sketchId) return null;
      return isReferenceSourceSketchId(referenceTarget.sketchId, subjectSketchId) ? referenceTarget.sketchId : null;
    }

    function constraintResolutionFromSubjectAndReference(type, subject, referenceTarget) {
      const subjectElement = referenceSubjectElement(subject);
      const subjectSketchId = referenceSubjectSketchId(subject);
      const referenceSketchId = referenceSketchIdFromPair(subject, referenceTarget);
      if (!subject || !subjectElement || !isActiveSketchElement(subjectElement) || !isEditableSketchElement(subjectElement)) {
        return { error: "アクティブスケッチ側の対象を選択してください" };
      }
      if (!referenceTarget || !referenceSketchId) {
        return { error: referenceTarget?.sketchId && descendantSketchIds(subjectSketchId).includes(referenceTarget.sketchId) ? "子孫スケッチは参照できません" : "先祖スケッチのみ参照できます" };
      }
      if (wouldCreateReferenceCycle(subjectSketchId, referenceSketchId)) {
        return { error: "スケッチ間の参照が循環するため追加できません" };
      }
      if (type === "distance") {
        const target = referenceDistanceTargetForSubject(subject, referenceTarget);
        if (!target || target.kind === "invalid") return { error: target?.reason || "参照寸法の組み合わせに対応していません" };
        return { type, target, referenceSketchId, sketchId: subjectSketchId };
      }
      const constraint = referenceConstraintForType(type, subject, referenceTarget);
      if (!constraint) return { error: "この参照拘束の組み合わせには対応していません" };
      return { type, constraint, referenceSketchId, sketchId: subjectSketchId };
    }
    return Object.freeze({ resolve: resolveConstraintIntent });
  }
  window.ConstraintIntentResolver = Object.freeze({ create });
})();
