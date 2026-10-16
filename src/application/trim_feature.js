/* Compose Trim queries, geometry transfer and transactional application. */
(() => {
  "use strict";
  function create({ currentScope, geometry, references, isActiveSketchElement, minLineLength, minArcLength,
    pushModelConstraint, elementSketchId, isPointUsedByPrimitive, isReferencePoint, viewportScale, preview, checkpoint,
    hitSketchIdentityElement, guardSketchEdit, activeSketchId, setHint, draw, guardSketchProjectionShapeEdit, applicationText,
    clearSelection, stabilizeActiveParameterNamespace, acceptError, invalidateAnalysis, refreshConstraintAnalysis, updateUI, recordHistory }) {
    const query = window.TrimQuery.create({ currentScope, isActiveSketchElement, minLineLength, minArcLength });
    const editing = window.TrimEditing.create({ currentScope, geometry, references, query,
      pushModelConstraint, elementSketchId, isPointUsedByPrimitive, isReferencePoint, minArcLength });
    function computePreview(pointer) { return query.computeTrimPreview(pointer, 7 / viewportScale()); }
    const command = window.TrimCommand.create({
      hitSketchIdentityElement, guardSketchEdit, activeSketchId, computeTrimPreview: computePreview,
      setHint, draw, guardSketchProjectionShapeEdit, applicationText, clearTrimPreview: () => preview.setTrim(null), editing,
      checkpoint: { capture: checkpoint.captureGeometry, restore: checkpoint.restoreGeometry },
      clearSelection, stabilizeActiveParameterNamespace, acceptError, invalidateAnalysis, refreshConstraintAnalysis, updateUI, recordHistory,
    });
    return Object.freeze({ computePreview, execute: command.execute, query, editing });
  }
  window.TrimFeature = Object.freeze({ create });
})();
