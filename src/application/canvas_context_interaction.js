/* Connect canvas context selection, menu entry and actions through existing owners; no menu or editing state. */
(() => {
  "use strict";
  function create({
    canvasSelection, sameArcEndpoint, clearSelection, arcEndpointPoint, selectedFixedBatchTargets, fixedBatchIsFullyFixed, findLineFixedConstraint,
    findArcEndpointFixedConstraint, selectedGeometryItems, readMode, sketchProjectionCommand, applicationText, document, canCreateInActiveSketch,
    visibleGeometryBounds, pendingCommandSession, constraintTargetSession, splineEditing, isReadOnlyDimension, selectedDimensionLineGroup,
    blockDefinitionScopeError, blockDefinitionEditError, selectedConstructionTogglePrimitives, drawingOrderCommandState, hasCopyableCanvasSelection,
    hasSelection, handleConstraintOperandClick, updateUI, draw, canvasContextMenu, isGeometryMode, closeAppMenus, canvasPoint, setLastPointer,
    hasCancellableCanvasCommand, canvasContextCandidatesAt, canvasContextController, guardSelectionEdit, guardSketchEdit, elementSketchId,
    selectionSketchId, activeSketchId, commitSketchProjectionCommand, cancelCanvasCommandFromContextMenu, undoHistory, redoHistory,
    copySelectionToClipboard, imageClipboard, showSelectedObjectProperties, fixPointBtn, enterBlockDefinitionEdit, setBlockInstanceRotationLocked,
    startDimensionEditInput, dimensionLineGroup, updateGeometrySelectionUI, recordHistory, setHint, sketchMoveCommand, startHatchBoundaryRepair,
    reorderSelectedDrawingObjects, addSplineFitPointFromContext, deleteSplineFitPointFromContext, fitVisibleGeometryToViewport, canvasHover,
  }) {
    const { select: selectCanvasContextTarget, constraintHits: constraintHitsFromCanvasContextTarget } = window.CanvasContextTarget.createSelection({
      canvasSelection, sameArcEndpoint, clearSelection, arcEndpointPoint,
    });
    const { state: canvasContextFixState } = window.CanvasContextTarget.createFixObservation({
      selectedFixedBatchTargets, fixedBatchIsFullyFixed, canvasSelection, findLineFixedConstraint, findArcEndpointFixedConstraint, selectedGeometryItems,
    });
    const { items: canvasContextMenuItems } = window.CanvasContextPresentation.createItems({
      readMode, sketchProjectionCommand, applicationText, document, canCreateInActiveSketch, visibleGeometryBounds,
      pendingCommandSession, constraintTargetSession, splineEditing, isReadOnlyDimension, selectedDimensionLineGroup,
      blockDefinitionScopeError, blockDefinitionEditError, canvasContextFixState, selectedConstructionTogglePrimitives,
      canvasSelection, selectedGeometryItems, drawingOrderCommandState, hasCopyableCanvasSelection, hasSelection,
    });
    const canvasContextCandidateAction = window.CanvasContextTarget.createCandidateAction({
      constraintTargetSession, handleConstraintOperandClick, constraintHitsFromCanvasContextTarget, selectCanvasContextTarget, updateUI, draw,
    });
    const canvasContextEntry = window.CanvasContextMenu.createEntry({
      canvasContextMenu, isGeometryMode, closeAppMenus, canvasPoint, setLastPointer,
      hasCancellableCanvasCommand, constraintTargetSession, canvasContextCandidatesAt, selectCanvasContextTarget,
      updateUI, draw, canvasContextController, canvasContextMenuItems,
    });
    const canvasContextActions = window.CanvasContextActions.create({
      guardSelectionEdit, guardSketchEdit, elementSketchId, selectionSketchId, activeSketchId,
      commitSketchProjectionCommand, cancelCanvasCommandFromContextMenu, undoHistory, redoHistory, copySelectionToClipboard,
      imageClipboard, document, showSelectedObjectProperties, fixPointBtn, enterBlockDefinitionEdit, setBlockInstanceRotationLocked,
      startDimensionEditInput, selectedDimensionLineGroup, dimensionLineGroup, updateGeometrySelectionUI, draw, recordHistory, applicationText, setHint,
      sketchMoveCommand, startHatchBoundaryRepair, reorderSelectedDrawingObjects, addSplineFitPointFromContext, deleteSplineFitPointFromContext,
      splineEditing, fitVisibleGeometryToViewport,
    });
    function preview(target) {
      canvasHover.previewCandidate(target);
      draw();
    }
    return Object.freeze({ open: canvasContextEntry.open, selectCandidate: canvasContextCandidateAction.select, execute: canvasContextActions.execute, preview });
  }
  window.CanvasContextInteraction = Object.freeze({ create });
})();
