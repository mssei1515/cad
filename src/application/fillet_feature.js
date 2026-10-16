/* Compose Fillet planning and construction with the existing transactional command. */
(() => {
  "use strict";
  function create({ geometry, minLineLength, defaultDimensionForTarget, syncLineOrientationHints, pushModelConstraint,
    pending, selection, readPointer, prepareStart, clearSnap, updateToolbar, guardSketchProjectionShapeEdit,
    valueInput, checkpoint, clearSelection, stabilize, acceptError, invalidateAnalysis, refreshConstraintAnalysis,
    applicationText, setHint, updateUI, updateGeometrySelectionUI, draw, recordHistory, cancelConstraintTargetCommand }) {
    const plans = window.FilletGeometry.create({ minLineLength });
    const construction = window.FilletConstruction.create({ plans, geometry, defaultDimensionForTarget, syncLineOrientationHints, pushModelConstraint });
    return window.FilletCommand.create({
      cancelConstraintTargetCommand, selectedLines: () => selection.lines, getPointer: readPointer,
      prepareStart, clearSnap, updateToolbar, getPending: pending.read, setPending: pending.replace,
      guardSketchProjectionShapeEdit, filletGeometryBasis: plans.filletGeometryBasis, filletGeometryFromPointer: plans.filletGeometryFromPointer,
      hideDimensionValueInput: valueInput.hide,
      snapshotGeometryMutationState: checkpoint.captureGeometry, restoreGeometryMutationState: checkpoint.restoreGeometry,
      createFillet: construction.createFillet, clearSelection, selection, stabilize, acceptError,
      invalidateAnalysis, refreshConstraintAnalysis, applicationText, setHint, updateUI, updateGeometrySelectionUI, draw, recordHistory,
    });
  }
  window.FilletFeature = Object.freeze({ create });
})();
