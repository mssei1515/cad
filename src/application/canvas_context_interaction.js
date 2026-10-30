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
  // Share existing editing owners while keeping the raw capability API available.
  function createForEditing({ selection, selectionScope, sketches, access, constraintSelection, blockQueries,
    dimensions, cancellation, clipboard, history, pointer, viewport, projection, ...options }) {
    return create({ ...options, canvasSelection: selection, selectedGeometryItems: selection.selectedGeometryItems, hasSelection: selection.hasSelection,
      selectionSketchId: selectionScope.selectionSketchId, activeSketchId: sketches.activeSketchId, elementSketchId: sketches.elementSketchId,
      guardSketchEdit: access.guardSketchEdit, guardSelectionEdit: access.guardSelectionEdit, canCreateInActiveSketch: access.canCreateInActiveSketch,
      selectedFixedBatchTargets: constraintSelection.fixedBatch, fixedBatchIsFullyFixed: constraintSelection.fullyFixed,
      blockDefinitionScopeError: blockQueries.blockDefinitionScopeError, blockDefinitionEditError: blockQueries.blockDefinitionEditError,
      selectedDimensionLineGroup: dimensions.selectedLineGroup, dimensionLineGroup: dimensions.lineGroup,
      hasCancellableCanvasCommand: cancellation.hasCancellable, cancelCanvasCommandFromContextMenu: cancellation.cancel,
      hasCopyableCanvasSelection: clipboard.canOfferCopy, undoHistory: history.undo, redoHistory: history.redo,
      setLastPointer: pointer.setLastPointer, canvasPoint: viewport.canvasPoint,
      sketchProjectionCommand: projection, commitSketchProjectionCommand: projection.commit });
  }
  // Keep early DOM construction separate from late command construction and listener start.
  function createMenu({ document, window: browserWindow, canvas, escapeHtml, applicationText, canvasHover, draw, readInteraction, readPresentation }) {
    const { controller, element } = window.CanvasContextMenu.createForDocument({
      document, window: browserWindow, canvas, escapeHtml, applicationText,
      presentCandidate: target => readPresentation()(target),
      hover: { capture: canvasHover.capture, restore: canvasHover.restore, preview: target => readInteraction().preview(target), clear: canvasHover.clear, draw },
      onOpen: event => readInteraction().open(event),
      onSelect: (target, pointer) => readInteraction().selectCandidate(target, pointer),
      onAction: (action, target, pointer) => readInteraction().execute(action, target, pointer),
    });
    function createInteraction(options) {
      return create({ ...options, document, applicationText, canvasHover, draw, canvasContextMenu: element, canvasContextController: controller });
    }
    function createEditingInteraction(options) {
      return createForEditing({ ...options, document, applicationText, canvasHover, draw, canvasContextMenu: element, canvasContextController: controller });
    }
    function createSceneForEditing({ sceneQueries, splineEditing, canvasContextAnnotationHit, documentWorkspace, readServices, interaction, sessions, candidates }) {
      const { candidatesAt } = sceneQueries.createContextQuery({ editedFitPoints: () => splineEditing.current?.spline?.fitPoints, canvasContextAnnotationHit });
      const presentCandidate = window.CanvasContextPresentation.create({ ...candidates, applicationText,
        blockDefinitionById: readServices.catalog.blockDefinitionById });
      function createSceneInteraction(options) {
        return createEditingInteraction({ ...options, selection: interaction.selection, selectionScope: interaction.scope,
          sketches: documentWorkspace.sketches, access: interaction.access, pointer: sessions.pointer, readMode: interaction.lifecycle.readMode,
          pendingCommandSession: sessions.pending, constraintTargetSession: sessions.targets, splineEditing, canvasContextCandidatesAt: candidatesAt });
      }
      return Object.freeze({ presentCandidate, createInteraction: createSceneInteraction });
    }
    return Object.freeze({ controller, element, createInteraction, createEditingInteraction, createSceneForEditing });
  }
  window.CanvasContextInteraction = Object.freeze({ create, createMenu });
})();
