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
  // Assemble control presentation and provisional input together; binding stays explicit.
  function createWithControls({ retargeting, controls, ...options }) {
    const editing = createWithFeedback(options);
    const input = editing.createCommandInput(retargeting);
    const controlPresentation = editing.createControls({ ...controls,
      constraintButtons: options.constraintButtons, hasSelection: options.selection.hasSelection });
    return Object.freeze({ ...editing, input, controls: controlPresentation });
  }
  function createForEditing({ document, controls, interaction, sessions, sketches, presentation, operands, viewport, annotationFeature, instances,
    valueInput, resolveConstraintIntent, isGeometryMode, findLineFixedConstraint, clearSelection, commitConstraintResolution,
    updateToolbar, updateConstraintButtons, blurConstraintControl, addConstraint, hitConstraintOperand,
    toggleGeometryFixedOperand, toggleSelectedFixed, geometryInstanceBundle, cancelPendingCommand, placement,
    readOnlyDimensionConstraintForPlacement, addReadOnlyDimensionConstraint }) {
    const { selection, access, lifecycle, hover } = interaction;
    const { activeSketchId, elementSketchId, canEditSketch } = sketches;
    const { settings, constraintFeedback: feedback, setHint, draw, updateGeometrySelectionUI, log } = presentation;
    const { applicationText, translatedExactText } = settings;
    const { candidates, operands: values, fromSelection: constraintOperandsFromSelection, syncSelection: syncSelectionFromConstraintOperands } = operands;
    const { referenceTargetFromOperand, makeConstraintOperand, sameConstraintOperand } = values;
    const { selectedGeometryItems, trimConstraintSelection, selectedPrimitives } = selection;
    const { guardSketchEdit, guardSelectionEdit } = access;
    const { Circle, Arc } = window.GeometrySolver;
    const { targetFromConstraint, angleDegrees, angleDimensionAngles } = window.DimensionQueries;
    const editing = createWithControls({
      retargeting: { canvasHover: hover, canvasPoint: viewport.canvasPoint, referenceTargetFromOperand },
      controls: { document, constraintMenuButtons: controls.constraintMenuButtons, fixPointBtn: controls.fixPointBtn, translatedExactText },
      constraintButtons: controls.constraintButtons, feedback, readLanguage: () => settings.language,
      session: sessions.targets, selection, pending: sessions.pending, candidates, lifecycle, valueInput,
      resolveConstraintIntent, constraintOperandsFromSelection, activeSketchId, isGeometryMode,
      elementSketchId, canEditSketch, findLineFixedConstraint, selectedGeometryItems, guardSketchEdit, guardSelectionEdit,
      startAnnotationAnchorConstraint: annotationFeature.startAnchorConstraint, clearSelection, trimConstraintSelection,
      commitConstraintResolution, syncSelectionFromConstraintOperands, updateToolbar, updateConstraintButtons, setHint, draw, blurConstraintControl,
      addConstraint, annotationAnchorConstraints: annotationFeature.anchors, hitConstraintOperand, toggleGeometryFixedOperand, toggleSelectedFixed,
      updateGeometrySelectionUI, types: { Circle, Arc }, isPlacingInstance: instances.isPlacing, geometryInstanceBundle, targetFromConstraint,
      cancelPendingCommand, selectedPrimitives, placement, angleDegrees, angleDimensionAngles, readOnlyDimensionConstraintForPlacement,
      addReadOnlyDimensionConstraint, makeConstraintOperand, sameConstraintOperand, applicationText, log,
    });
    function createCommitForWorkspace({ workspace, checkpoint, insertion, redundancy, solving, stabilization, referenceState,
      solvePreparation, lineCollapseQuery, acceptError, refreshConstraintAnalysis, recordHistory, now }) {
      const { constraintTargetsAreActive, constraintSketchId, isReferenceSourceSketchId, descendantSketchIds, sketchName } = sketches;
      const { isDimensionConstraint, isReadOnlyDimension, measuredConstraintTargetValue } = window.DimensionQueries;
      return editing.createCommit({
        linesAreParallel: candidates.linesAreParallel, assignSketch: insertion.assignSketch, probeRedundancy: redundancy.probeCandidate,
        currentScope: workspace.current, forgetConstraint: redundancy.forgetConstraint, constraintTargetsAreActive,
        snapshotModelState: checkpoint.captureValues, restoreModelState: checkpoint.restoreValues, solvePreparation, pushModelConstraint: insertion.push,
        solveConstraintComponentAndDependents: solving.solveConstraintComponentAndDependents,
        isDimensionConstraint, isReadOnlyDimension, stabilizeActiveParameterNamespace: stabilization.stabilize,
        constraintSketchId, lineCollapseQuery, redundantConstraintInfo: redundancy.redundantConstraintInfo, acceptError, measuredConstraintTargetValue,
        refreshConstraintAnalysis, updateUI: presentation.updateUI, recordHistory, isReferenceSourceSketchId, descendantSketchIds,
        wouldCreateReferenceCycle: referenceState.wouldCreateReferenceCycle, sketchName, now,
      });
    }
    return Object.freeze({ ...editing, createCommitForWorkspace });
  }
  function createDimensionValues({ parameters, sketches, interaction, pending, valueInput, checkpoint, presentation,
    annotationFeature, modelQueries, stabilization, viewport, bounds, placement, synchronizedInstanceEditing,
    solvePreparation, scaleSketchForFirstDimension, acceptError, recordHistory, resetDimensionDrag, addDistanceConstraintFromTarget }) {
    const { expressionFromUserInput, evaluateEditingExpressionDraft: evaluateDimensionExpressionDraft,
      renameDimension, parameterErrorText, expressionInputValue, numericDimensionExpression } = parameters;
    const { activeSketchId, constraintSketchId } = sketches;
    const { guardSketchEdit } = interaction.access;
    const { hide: hideDimensionValueInput, sync: syncDimensionValueInput, focus: focusDimensionValueInput } = valueInput;
    const { captureValues: snapshotModelState, restoreValues: restoreModelState } = checkpoint;
    const { settings: { applicationText }, setHint, draw, updateUI } = presentation;
    const { sketchGeometryBounds } = bounds;
    const { targetFromConstraint, isReadOnlyDimension } = window.DimensionQueries;
    return window.DimensionValueCommand.createWithEditingSupport({
      synchronizedInstanceEditing, annotationDimensions: annotationFeature.dimensions, annotationAnchorConstraints: annotationFeature.anchors,
      canvasSelection: interaction.selection, resetDimensionDrag, canEdit: (id, operation) => guardSketchEdit(id, operation), renameDimension,
      getPending: pending.read, setPending: pending.replace,
      expressionFromUserInput, evaluateDimensionExpressionDraft, applicationText, parameterErrorText,
      setHint, syncDimensionValueInput, draw, activeSketchId, sketchHasDimensionConstraint: modelQueries.sketchHasDimensionConstraint,
      captureSketchScreenFootprint: (sketchId = activeSketchId()) => viewport.captureBoundsFootprint(sketchGeometryBounds(sketchId)),
      snapshotModelState, restoreModelState, solvePreparation, stabilizeActiveParameterNamespace: stabilization.stabilize,
      constraintSketchId, acceptError, hideDimensionValueInput, recordHistory, updateUI, scaleSketchForFirstDimension,
      targetFromConstraint, isReadOnlyDimension, defaultDimensionForTarget: placement.defaultDimensionForTarget,
      expressionInputValue, numericDimensionExpression, focusDimensionValueInput, addDistanceConstraintFromTarget,
      restoreSketchScreenFootprint: (sketchId, footprint) => viewport.restoreBoundsFootprint(sketchGeometryBounds(sketchId), footprint),
    });
  }
  window.ConstraintEditing = Object.freeze({ create, createWithFeedback, createWithControls, createForEditing, createDimensionValues });
})();
