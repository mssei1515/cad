/* Read current selection and constraint session capabilities; intent execution stays with commands. */
(() => {
  "use strict";
  function create({ session, selection, candidates, resolveConstraintIntent, constraintOperandsFromSelection, activeSketchId, isGeometryMode }) {
    const { distanceTargetFromTargets, canApplyConstraintToTargets, constraintFromTargets } = candidates;
    const currentConstraintTargets = selection.currentConstraintTargets;
    function distanceTargetFromSelection() {
      return distanceTargetFromTargets(currentConstraintTargets());
    }

    function canApplyConstraint(type) {
      if (!isGeometryMode()) return false;
      if (session.command?.type === type && session.operands.length > 0) {
        const resolution = resolveConstraintIntent(type, session.operands);
        return Boolean(resolution && !resolution.error && (resolution.constraint || resolution.target || resolution.action));
      }
      return canApplyConstraintToSelection(type);
    }

    function canApplyConstraintToSelection(type) {
      return canApplyConstraintToTargets(type, currentConstraintTargets(), activeSketchId());
    }

    function canCompleteConstraintCommand(type) {
      if (session.operands.length > 0) {
        const resolution = resolveConstraintIntent(type, session.operands);
        if (!resolution || resolution.error) return false;
        if (type === "distance") return Boolean(resolution.target);
        return Boolean(resolution.constraint);
      }
      if (type !== "distance") return canApplyConstraint(type);
      const target = distanceTargetFromSelection();
      if (!target || target.kind === "invalid") return false;
      return target.kind !== "line-length" || !session.command;
    }

    function constraintResolutionFromCurrentSelection(type) {
      if (session.operands.length > 0) return resolveConstraintIntent(type, session.operands);
      if (selection.splines.length > 0) return resolveConstraintIntent(type, constraintOperandsFromSelection());
      if (type === "distance") {
        const target = distanceTargetFromSelection();
        if (!target) return null;
        if (target.kind === "invalid") return { error: target.reason };
        return { type, target, sketchId: activeSketchId() };
      }
      const constraint = constraintFromSelection(type);
      if (!constraint) return null;
      return { type, constraint, sketchId: activeSketchId() };
    }

    function constraintFromSelection(type) {
      return constraintFromTargets(type, currentConstraintTargets(), activeSketchId());
    }
    return Object.freeze({ canApply: canApplyConstraint, canComplete: canCompleteConstraintCommand,
      resolution: constraintResolutionFromCurrentSelection, distanceTarget: distanceTargetFromSelection });
  }
  window.ConstraintSelectionQuery = Object.freeze({ create });
})();
