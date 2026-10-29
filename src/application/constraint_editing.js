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
    function createCommandInput({ canvasHover, canvasPoint, referenceTargetFromOperand }) {
      const hover = window.ConstraintCommandInput.createRetargetHover({
        getPending: pending.read, canvasHover, hitConstraintOperand, sameConstraintOperand,
        resolveConstraintIntent, referenceTargetFromOperand, Circle: types.Circle, Arc: types.Arc,
      });
      function createFeature() {
        return window.ConstraintCommandInput.createFeature({
          canvasHover, canvasPoint, pending, targets: session, placement: dimensions, constraints: targets,
        });
      }
      function createWithDragging({ viewport, currentScope, sketches, readServices, pointer, clearSnap, updateUI, recordHistory }) {
        const input = createFeature();
        const dragging = window.DimensionDragFeature.create({ placement, viewport, canvasSelection: selection, currentScope,
          constraintSketchId: sketches.constraintSketchId, isEditableSketchId: sketches.isEditableSketchId,
          isVisibleSketchId: readServices.geometryAppearance.isVisibleSketchId, effectiveDimensionAppearance: readServices.dimensionAppearance.effectiveDimensionAppearance,
          isVisibleValue: readServices.geometryAppearance.isVisibleValue, guardSketchEdit, commandInput: input.dimension, setHint, clearSnap, hypot2: window.GeometrySolver.hypot2,
          beginPointer: pointer.markThenCapture, endPointer: pointer.release,
          draw, updateUI, updateGeometrySelectionUI, syncDimensionValueInput: valueInput.sync, recordHistory });
        return Object.freeze({ input, dragging });
      }
      return Object.freeze({ updateHover: hover.update, createFeature, createWithDragging });
    }
    function createCommit({ isReferenceSourceSketchId, descendantSketchIds, wouldCreateReferenceCycle, ...options }) {
      const { command, readOnly } = window.ConstraintCommitCommand.createWithDimensions({ ...options,
        canvasSelection: selection, guardSketchEdit, activeSketchId, targetFromConstraint, clearSelection, setHint, draw, log, applicationText,
        resolveSelection: type => selectionQuery.resolution(type),
        startDistanceResolution: (resolution, pointer) => dimensions.startDistanceResolution(resolution, pointer),
        isReferenceSourceSketchId, descendantSketchIds, wouldCreateReferenceCycle });
      function createIntentResolver({ operands, types: intentTypes, isActiveSketchElement, isEditableSketchElement }) {
        return window.ConstraintIntentResolver.create({ candidates, operands, types: intentTypes, activeSketchId,
          isReferenceSourceSketchId, wouldCreateReferenceCycle, isActiveSketchElement, isEditableSketchElement,
          descendantSketchIds, applicationText, invalidConstraintTargetHint });
      }
      return Object.freeze({ command, readOnly, createIntentResolver });
    }
    function createFixedEditing({ operandElement, guardSketchProjectionShapeEdit, findArcEndpointFixedConstraint, arcEndpointPoint,
      currentScope, sameConstraintDisplayElement, deleteElements, commitNewConstraint, solveAndRefresh }) {
      const operand = window.FixedToggleCommand.createOperand({ modelTypes: window.GeometrySolver, guardSketchEdit, elementSketchId,
        operandElement, guardSketchProjectionShapeEdit, applicationText, findLineFixedConstraint, findArcEndpointFixedConstraint,
        arcEndpointPoint, currentScope, sameConstraintDisplayElement, deleteElements, commitNewConstraint, solveAndRefresh });
      function createSelection({ blockDefinitionById, updateUI, recordHistory, snapshotModelState, restoreModelState,
        pushModelConstraint, solveSketchAndDependents, acceptError, refreshConstraintAnalysis }) {
        return window.FixedToggleCommand.createSelection({ modelTypes: window.GeometrySolver, guardSelectionEdit, canvasSelection: selection,
          blockDefinitionById, setHint, clearSelection, updateUI, draw, recordHistory, findArcEndpointFixedConstraint, deleteElements,
          log, arcEndpointPoint, guardSketchProjectionShapeEdit, applicationText, snapshotModelState, commitNewConstraint, restoreModelState,
          selectedFixedBatchTargets: () => selectionQuery.fixedBatch(), fixedBatchIsFullyFixed: batch => selectionQuery.fullyFixed(batch),
          findLineFixedConstraint, pushModelConstraint, currentScope, solveSketchAndDependents, acceptError, refreshConstraintAnalysis });
      }
      return Object.freeze({ operand, createSelection });
    }
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
    return Object.freeze({ selectionQuery, targets, dimensions, createControls, createCommit, createCommandInput, createFixedEditing });
  }
  // Construct feedback first and share its live session with editing and staged input.
  function createWithFeedback({ constraintButtons, feedback, readLanguage, session, applicationText, ...options }) {
    const presentation = window.ConstraintControlsView.createFeedback({
      constraintButtons, feedback, readLanguage, applicationText,
      readOperands: () => session.operands,
    });
    const editing = create({ ...options, session, applicationText, constraintLabel: presentation.label,
      constraintTargetHint: presentation.targetHint, invalidConstraintTargetHint: presentation.invalidTargetHint });
    return Object.freeze({ ...editing, constraintTargetHint: presentation.targetHint });
  }
  window.ConstraintEditing = Object.freeze({ create, createWithFeedback });
})();
