/* Connect selection capabilities, constraint targeting and dimension placement over shared sessions. */
(() => {
  "use strict";
  function create({ session, selection, pending, candidates, lifecycle, valueInput,
    resolveConstraintIntent, constraintOperandsFromSelection, activeSketchId, isGeometryMode,
    elementSketchId, canEditSketch, findLineFixedConstraint, selectedGeometryItems,
    guardSketchEdit, guardSelectionEdit, startAnnotationAnchorConstraint,
    constraintLabel, clearSelection, trimConstraintSelection, commitConstraintResolution, syncSelectionFromConstraintOperands,
    updateToolbar, updateConstraintButtons, setHint, constraintTargetHint, draw, blurConstraintControl,
    addConstraint, annotationAnchorConstraints, hitConstraintOperand, invalidConstraintTargetHint,
    toggleGeometryFixedOperand, toggleSelectedFixed, updateGeometrySelectionUI, types,
    isPlacingInstance, geometryInstanceBundle, targetFromConstraint, cancelPendingCommand, selectedPrimitives,
    placement, angleDegrees, angleDimensionAngles, readOnlyDimensionConstraintForPlacement, addReadOnlyDimensionConstraint,
    makeConstraintOperand, sameConstraintOperand, applicationText, log }) {
    const selectionQuery = window.ConstraintSelectionQuery.create({ session, selection, candidates,
      resolveConstraintIntent, constraintOperandsFromSelection, activeSketchId, isGeometryMode,
      elementSketchId, canEditSketch, findLineFixedConstraint, selectedGeometryItems });
    function canStart() { return guardSketchEdit(activeSketchId(), "create") && guardSelectionEdit("constraint"); }
    const targets = window.ConstraintTargetCommand.create({ session, startAnnotationAnchorConstraint, canStart,
      prepareStart: lifecycle.prepareConstraintStart, prepareCancel: lifecycle.prepareConstraintCancel,
      constraintLabel, clearSelection, constraintOperandsFromSelection, trimConstraintSelection,
      resolveConstraintIntent, startDistanceResolution: (resolution, pointer) => dimensions.startDistanceResolution(resolution, pointer),
      commitConstraintResolution, syncSelectionFromConstraintOperands, updateToolbar, updateConstraintButtons, setHint, constraintTargetHint,
      draw, blurConstraintControl, canCompleteConstraintCommand: type => selectionQuery.canComplete(type),
      distanceTargetFromSelection: () => selectionQuery.distanceTarget(), startDistanceCommand: () => dimensions.startDistanceCommand(),
      addConstraint, annotationAnchorConstraints, hitConstraintOperand, invalidConstraintTargetHint,
      toggleGeometryFixedOperand, toggleSelectedFixed, updateGeometrySelectionUI,
      startDistanceValueInput: pointer => dimensions.startDistanceValueInput(pointer), types,
    });
    const dimensions = window.DimensionPlacementCommand.create({ session, selection, getPending: pending.read, setPending: pending.replace,
      guardSketchEdit, isPlacingInstance, geometryInstanceBundle, targetFromConstraint, cancelPendingCommand,
      cancelConstraintTargetCommand: message => targets.cancel(message), canStart, prepareStart: lifecycle.prepareDimensionStart,
      selectMode: lifecycle.selectMode, constraintOperandsFromSelection, constraintResolutionFromCurrentSelection: type => selectionQuery.resolution(type),
      selectedPrimitives, placement, angleDegrees, angleDimensionAngles, readOnlyDimensionConstraintForPlacement,
      addReadOnlyDimensionConstraint, activeSketchId, syncSelectionFromConstraintOperands,
      makeConstraintOperand, hitConstraintOperand, sameConstraintOperand, resolveConstraintIntent,
      hideDimensionValueInput: valueInput.hide, syncDimensionValueInput: valueInput.sync, focusDimensionValueInput: valueInput.focus,
      applicationText, setHint, log, updateConstraintButtons, updateToolbar, draw,
    });
    function createControls({ document, constraintButtons, constraintMenuButtons, fixPointBtn, hasSelection, translatedExactText }) {
      const view = window.ConstraintControlsView.create({ document, constraintButtons, constraintMenuButtons, fixPointBtn, isGeometryMode,
        prepareGeometryControls: () => {
          if (pending.current?.type?.startsWith("distance") && !pending.current.target?.annotationAnchor && !pending.current.target?.interval) {
            const target = selectionQuery.distanceTarget();
            if (!target || target.kind === "invalid") cancelPendingCommand("寸法入力をキャンセルしました");
          }
        },
        getCommandType: () => session.command?.type, fixedToggleAllowed: selectionQuery.fixedToggleAllowed,
        hasSelection, translatedExactText, applicationText });
      function createBinding() {
        const control = window.ConstraintControlCommand.create({ constraintTargetSession: session,
          cancelConstraintTargetCommand: message => targets.cancel(message), constraintLabel, startAnnotationAnchorConstraint,
          startConstraintTargetCommand: type => targets.start(type), canApplyConstraint: type => selectionQuery.canApply(type),
          startDistanceCommand: () => dimensions.startDistanceCommand(), cancelPendingCommand, updateToolbar, updateConstraintButtons,
          addConstraint, isGeometryMode, hasSelection, toggleSelectedFixed });
        return window.ConstraintControlsView.createBinding({ constraintButtons, constraintMenuButtons, fixPointBtn,
          onConstraint: control.activate, onFixed: control.activateFixed });
      }
      return Object.freeze({ view, createBinding });
    }
    return Object.freeze({ selectionQuery, targets, dimensions, createControls });
  }
  window.ConstraintEditing = Object.freeze({ create });
})();
