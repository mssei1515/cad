/* Read current selection and constraint session capabilities; intent execution stays with commands. */
(() => {
  "use strict";
  function create({ session, selection, candidates, resolveConstraintIntent, constraintOperandsFromSelection, activeSketchId, isGeometryMode,
    elementSketchId, canEditSketch, findLineFixedConstraint, selectedGeometryItems }) {
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
    function selectedFixedBatchTargets() {
      const points = selection.points.filter((item) => !item.blockProjection);
      const lines = selection.lines.filter((item) => !item.blockProjection);
      const supportedCount = points.length + lines.length;
      const selectedCount = selection.points.length + selection.lines.length + selection.circles.length + selection.arcs.length + selection.splines.length
        + selection.blockInstances.length + selection.geometryInstances.length + selection.annotations.length + selection.hatches.length + selection.referenceImages.length;
      if (selection.arcEndpoint || supportedCount === 0 || supportedCount !== selectedCount) return null;
      const sketchIds = new Set([...points, ...lines].map(elementSketchId));
      if (sketchIds.size !== 1) return null;
      const sketchId = [...sketchIds][0];
      if (!canEditSketch(sketchId, "constraint")) return null;
      return { points, lines, sketchId };
    }

    function fixedBatchIsFullyFixed(batch) {
      return Boolean(batch) && batch.points.every((point) => point.fixed) && batch.lines.every((line) => Boolean(findLineFixedConstraint(line)));
    }

    function fixedToggleAllowed() {
      const selectedProjectionItems = [...selection.points, ...selection.lines, ...selection.circles, ...selection.arcs, ...selection.splines].filter((item) => item?.blockProjection);
      const selectedProjectionInstances = [...new Set(selectedProjectionItems.map((item) => item.blockInstance))];
      const fixedBatch = selectedFixedBatchTargets();
      return (selection.annotations.length === 1 && selection.selectedElementCount() === 1) ||
        (selection.blockInstances.length === 1 && selectedGeometryItems().length === 0 && selection.annotations.length === 0 && selection.hatches.length === 0 && selection.referenceImages.length === 0) ||
        (selectedProjectionItems.length > 0 && selectedProjectionInstances.length === 1 && selectedProjectionItems.length === selection.points.length + selection.lines.length + selection.circles.length + selection.arcs.length + selection.splines.length) ||
        Boolean(selection.arcEndpoint) ||
        Boolean(fixedBatch);
    }

    return Object.freeze({ fixedBatch: selectedFixedBatchTargets, fullyFixed: fixedBatchIsFullyFixed, fixedToggleAllowed, canApply: canApplyConstraint, canComplete: canCompleteConstraintCommand,
      resolution: constraintResolutionFromCurrentSelection, distanceTarget: distanceTargetFromSelection });
  }
  window.ConstraintSelectionQuery = Object.freeze({ create });
})();
