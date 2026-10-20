/* Compose dimension drag, shared group selection and angle synchronization. */
(() => {
  "use strict";
  function create({ placement, viewport, canvasSelection, currentScope, constraintSketchId, isEditableSketchId, isVisibleSketchId,
    effectiveDimensionAppearance, isVisibleValue, guardSketchEdit, isDimensionConstraintCommandActive,
    beginPointer, endPointer, setHint, clearSnap, hypot2, continueCommandClick, draw, updateUI, updateGeometrySelectionUI,
    syncDimensionValueInput, recordHistory }) {
    const { Line, LineAngleConstraint } = window.GeometrySolver;
    const { targetFromConstraint, isReadOnlyDimension, angleDimensionAngles } = window.DimensionQueries;
    const lineGroup = window.DimensionLineGroup.create({ placement, Line });
    const { selected } = window.DimensionLineGroup.createSelection({ currentScope, canvasSelection, constraintSketchId,
      isEditableSketchId, isVisibleSketchId, targetFromConstraint, effectiveDimensionAppearance,
      defaultDimensionForTarget: placement.defaultDimensionForTarget, isVisibleValue, lineGroup });
    const { sync } = window.DimensionDrag.createAngleSynchronization({ LineAngleConstraint, isReadOnlyDimension, angleDimensionAngles });
    const command = window.DimensionDrag.create({ canEdit: item => guardSketchEdit(constraintSketchId(item)),
      selectedLineGroup: selected, translateLineGroup: lineGroup.translate,
      dimensionAnchor: placement.dimensionAnchor, migrateAngleDimensionLabelPlacement: placement.migrateAngleDimensionLabelPlacement,
      angleDimensionLabelOffsets: placement.angleDimensionLabelOffsets, angleDimensionFromLabelPoint: placement.angleDimensionFromLabelPoint,
      dimensionWithLabelAt: placement.dimensionWithLabelAt, dimensionFromAnchor: placement.dimensionFromAnchor,
      setAngleDimensionLabelOffsets: placement.setAngleDimensionLabelOffsets, syncAngleConstraintFromDimension: sync,
      canvasSelection, viewScale: () => viewport.scale, isDimensionConstraintCommandActive, beginPointer, endPointer, setHint, clearSnap, hypot2,
      draw, continueCommandClick, updateUI, updateGeometrySelectionUI, syncDimensionValueInput, recordHistory });
    return Object.freeze({ command, lineGroup, selectedLineGroup: selected });
  }
  window.DimensionDragFeature = Object.freeze({ create });
})();
