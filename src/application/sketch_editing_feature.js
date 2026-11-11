/* Compose Sketch commands with shared scope and readers; each command owns its operation state. */
(() => {
  "use strict";
  function create({ currentScope, sketches, ids, selection, geometryReads, projections, constraintReferences,
    clearInteractionForSketchChange, clearSelection, applicationText, setHint, updateUI, draw, recordHistory,
    promptName, effectiveAppearanceForElement, clearTreeHover, clearSnap, guardEdit, prepareLockToggle, prepareMove }) {
    const { ensureSketchState, activeSketch, activeSketchId, sketchById, childSketchesOf, sketchName,
      descendantSketchIds, constraintSketchId, elementSketchId, isReferenceSourceSketchId } = sketches;
    const { resolveGeometryRef } = geometryReads;
    const { constraintGraphNodes, geometryInstanceDependencyRefs } = constraintReferences;
    const command = window.SketchCommand.create({
      currentScope, ensureSketchState, activeSketch, activeSketchId, sketchById, childSketchesOf, sketchName,
      nextSketchId: () => ids.allocate("sketch"), clearInteractionForSketchChange, setHint, updateUI, draw, recordHistory,
      promptName, effectiveAppearanceForElement, clearTreeHover, clearSnap, guardEdit, applicationText, prepareLockToggle,
    });
    function createMove({ prepare = prepareMove, refresh, readEditingScope, hatches, rebinding, analysis, refreshReferenceConstraintValidity }) {
      function refreshGeometry() {
        const { invalidateBlockProjectionCache } = projections;
        invalidateBlockProjectionCache();
        geometryReads.clearReadCache();
        hatches.clear();
        const { blockProjectionBundles, geometryInstanceBundles } = geometryReads;
        rebinding.rebuildDocument(readEditingScope(), [...blockProjectionBundles(), ...geometryInstanceBundles()]);
        analysis.invalidate();
        refreshReferenceConstraintValidity();
      }
      const query = window.SketchMove.create({ currentScope, activeSketchId, constraintGraphNodes, constraintSketchId,
        resolveGeometryRef, geometryInstanceDependencyRefs, isReferenceSourceSketchId, applicationText });
      return window.SketchMoveCommand.create({ currentScope, activeSketchId, selection, query, prepare, refresh: refresh === undefined ? refreshGeometry : refresh,
        clearSelection, updateUI, draw, setHint, recordHistory, applicationText });
    }
    // Keep destination-only input tied to the same command; the application chooses when to bind it.
    function createMoveWithInput({ document, prepare, refresh, readEditingScope, hatches, rebinding, analysis, refreshReferenceConstraintValidity }) {
      const command = createMove({ prepare, refresh, readEditingScope, hatches, rebinding, analysis, refreshReferenceConstraintValidity });
      const input = window.SketchTreeController.createMoveInputBinding({ document, isMoving: () => command.active });
      return Object.freeze({ command, input });
    }
    function createDeletion({ rejectReferencedGeometryDeletion, log, geometryElementKey, guardDimensionSymbolDeletion,
      annotationReferencesRemovedGeometry, clearSketchSolveState, invalidateAnalysis, solveSketchAndDependents,
      refreshConstraintAnalysis, confirmDeletion }) {
      return window.SketchDeletionCommand.create({ currentScope, ensureSketchState, sketchById, descendantSketchIds,
        constraintSketchId, geometryInstanceDependencyRefs, resolveGeometryRef, elementSketchId, rejectReferencedGeometryDeletion,
        sketchName, setHint, log, blockAllProjectionBundle: projections.blockAllProjectionBundle, geometryElementKey, constraintGraphNodes,
        guardDimensionSymbolDeletion, invalidateBlockProjectionCache: projections.invalidateBlockProjectionCache,
        annotationReferencesRemovedGeometry, clearSketchSolveState, clearInteractionForSketchChange, invalidateAnalysis,
        solveSketchAndDependents, activeSketchId, refreshConstraintAnalysis, updateUI, draw, recordHistory, confirmDeletion });
    }
    function createTree({ readServices, canvasHover, selectionHighlight, objectOptions, document, window: browserWindow,
      applicationSettings, escapeHtml, closeCanvasContextMenu, moveCommand, deletion, getScopeKey, viewScope,
      sketchHasSolveError, referenceConstraintErrorCountForSketch, constraintDuplicateCountForSketch, dimensionScope,
      toggleBlockInstanceSelection, targetFromConstraint, updateSketchUI, selectionSketchId, deleteElements,
      deleteCurrentSelection, toggleSelectedVisibility, updateSelectionUI, unfixPoint }) {
      return window.SketchTreeController.createWithDocumentObjects({
        readServices, canvasHover, selectionHighlight, objectOptions, document, window: browserWindow,
        sketchContext: sketches, applicationSettings, escapeHtml, closeCanvasContextMenu, ensureSketchState, moveCommand,
        getScopeKey, viewScope, sketchHasSolveError, referenceConstraintErrorCountForSketch, constraintDuplicateCountForSketch,
        currentScope: dimensionScope, setActiveSketch: command.activate, clearSelection, canvasSelection: selection,
        toggleBlockInstanceSelection, targetFromConstraint, updateUI, draw, updateSketchUI,
        toggleSketchVisibility: command.toggleVisibility, toggleSketchLock: command.toggleLock, guardSketchEdit: guardEdit,
        selectionSketchId, renameSketch: command.rename, deleteSketch: deletion.remove, deleteElements,
        deleteCurrentSelection, toggleSelectedVisibility, hover: { elementSketchId, ROOT_SKETCH_ID: window.SketchHierarchy.ROOT_SKETCH_ID },
        updateSelectionUI, unfixPoint,
      });
    }
    return Object.freeze({ command, createMove, createMoveWithInput, createDeletion, createTree });
  }
  function createForInteraction({ documentWorkspace, readServices, interaction, sessions, constraintTargets, valueInput, presentation, constraintReferences, recordHistory,
    clearSelection, clearSnap, updateToolbar, resetSketchMove, resetGeometryDrag, resetDimensionDrag, referenceImage, selectionRectangle,
    projection, instances, instanceSources, clearInteractionForSketchChange, promptName, clearTreeHover }) {
    const { workspace, sketches, documentIds: ids } = documentWorkspace;
    const { lifecycle: drawing, selection, hover, access } = interaction;
    const { exit: exitDrawMode, selectMode } = drawing, { guardSketchEdit: guardEdit } = access;
    const { settings: { applicationText }, setHint, updateUI, draw } = presentation;
    const reset = window.SketchCommand.createInteractionReset({ resetSketchMove, clearSelection, resetGeometryDrag, resetDimensionDrag,
      referenceImage, selectionRectangle, drawing, pending: sessions.pending, constraint: sessions.targets, projection, instances, instanceSources, hover,
      clearPointer: sessions.pointer.clearLastPointer, hideValueInput: valueInput.hide, clearSnap, selectMode, updateToolbar });
    const editing = create({ currentScope: workspace.current, sketches, ids, selection, geometryReads: readServices.reads, projections: readServices.projections, constraintReferences,
      clearInteractionForSketchChange, clearSelection, applicationText, setHint, updateUI, draw, recordHistory, promptName,
      effectiveAppearanceForElement: readServices.geometryAppearance.effectiveAppearanceForElement, clearTreeHover, clearSnap, guardEdit,
      prepareLockToggle: () => { sessions.pending.cancel(""); constraintTargets.cancel(""); exitDrawMode(); },
      prepareMove: () => { constraintTargets.cancel(""); sessions.pending.cancel(""); exitDrawMode(); hover.clear(); } });
    // Reuse the interaction/presentation owners captured before the later Tree stage.
    function createDeletionForEditing({ deletion, guardDimensionSymbolDeletion, solveState, solving, analysis, confirmDeletion }) {
      const { geometryKeyForItem: geometryElementKey } = window.GeometryObjects;
      const { referencesRemovedGeometry: annotationReferencesRemovedGeometry } = window.AnnotationAnchorData;
      return editing.createDeletion({
        rejectReferencedGeometryDeletion: (instances, label) => deletion.rejectReferences(instances, label),
        log: presentation.log, geometryElementKey, guardDimensionSymbolDeletion,
        annotationReferencesRemovedGeometry, clearSketchSolveState: solveState.clearSketchSolveState,
        invalidateAnalysis: () => { analysis.invalidate(); }, solveSketchAndDependents: solving.solveSketchAndDependents,
        refreshConstraintAnalysis: (options = {}) => analysis.refresh(options), confirmDeletion,
      });
    }
    function createTreeForEditing({ document, window: browserWindow, selectionHighlight, objectOptions, escapeHtml, closeCanvasContextMenu,
      moveCommand, deletion, blockEditor, editingScope, solveState, dimensionScope, deleteElements, deleteCurrentSelection,
      toggleSelectedVisibility, fixedOperands }) {
      const { referenceState, redundancy } = objectOptions;
      const { updateSketchUI, updateGeometrySelectionUI } = presentation;
      const { targetFromConstraint } = window.DimensionQueries;
      return editing.createTree({ readServices, canvasHover: interaction.hover, selectionHighlight,
        objectOptions: { ...objectOptions, constraintFeedback: presentation.constraintFeedback, pointUsage: interaction.pointUsage },
        document, window: browserWindow, applicationSettings: presentation.settings, escapeHtml, closeCanvasContextMenu, moveCommand, deletion,
        getScopeKey: () => blockEditor.current?.draft?.id ? `block:${blockEditor.current.draft.id}` : "document",
        viewScope: () => editingScope.current, sketchHasSolveError: solveState.hasError,
        referenceConstraintErrorCountForSketch: referenceState.referenceConstraintErrorCountForSketch,
        constraintDuplicateCountForSketch: redundancy.constraintDuplicateCountForSketch, dimensionScope,
        toggleBlockInstanceSelection: interaction.selection.toggleBlockInstanceSelection, targetFromConstraint,
        updateSketchUI, selectionSketchId: interaction.scope.selectionSketchId, deleteElements, deleteCurrentSelection, toggleSelectedVisibility,
        updateSelectionUI: updateGeometrySelectionUI, unfixPoint: fixedOperands.unfixPoint });
    }
    function createTreeForPresentation({ selection, analysis, redundancy, referenceState, projection, icons, feedback, fixedState, ...options }) {
      return createTreeForEditing({ ...options, objectOptions: {
        isHidden: selection.visibilityIsHidden, analysis, redundancy, referenceState, projectionQueries: projection.queries,
        toolbarSvgMarkup: icons.toolbarSvgMarkup, constraintToolbarIcon: icons.constraintToolbarIcon,
        findLineFixedConstraint: fixedState.findLineFixedConstraint,
        geometryInstanceTypeLabel: feedback.geometryInstanceTypeLabel, hatchPatternTypeLabel: feedback.hatchPatternTypeLabel,
      } });
    }
    return Object.freeze({ reset, editing: Object.freeze({ ...editing, createDeletionForEditing, createTreeForEditing, createTreeForPresentation }) });
  }
  // Keep navigation references with their factories; publish only successful constructions.
  function prepareNavigation() {
    let move = null, context = null, editingFeature = null;
    function resetMove() { return move?.reset(); }
    function closeContext() { return context?.menu?.close(); }
    function readMoving() { return move.active; }
    function requireEditing(binding) {
      if (editingFeature === null) throw new ReferenceError(`Cannot access '${binding}' before initialization`);
      return editingFeature;
    }
    function requireTree(binding) {
      if (context === null) throw new ReferenceError(`Cannot access '${binding}' before initialization`);
      return context;
    }
    function clearInteractionForSketchChange() { return requireEditing("sketchInteractionReset").reset.clear(); }
    function toggleSketchVisibility(id) {
      const { toggleVisibility } = requireEditing("toggleSketchVisibilityCommand").editing.command;
      return toggleVisibility(id);
    }
    function isSidebarHighlightedElement(item) { return requireTree("sketchTreeController").controller.isHighlightedElement(item); }
    function clearTreeHover() { return requireTree("sketchTreeController").controller.clearHoverSketch(); }
    function startContext() { return requireTree("sketchContextController").menu.start(); }
    function createEditing(options) {
      const feature = createForInteraction({ clearInteractionForSketchChange, clearTreeHover, ...options, resetSketchMove: resetMove });
      function createMoveWithInput(options) {
        const result = feature.editing.createMoveWithInput(options);
        move = result.command;
        return result;
      }
      function createTreeForEditing(options) {
        const result = feature.editing.createTreeForEditing(options);
        context = result;
        return result;
      }
      function createTreeForPresentation(options) {
        const result = feature.editing.createTreeForPresentation(options);
        context = result;
        return result;
      }
      function createTreeWithFixedControls({ toolbar, createFixed }, readFixed, readTree) {
        const icons = toolbar.createIcons();
        const { operand, createSelectionForWorkspace } = createFixed(readFixed());
        const tree = createTreeForPresentation(readTree(icons, operand));
        return Object.freeze({ icons, createFixedSelection: createSelectionForWorkspace, tree });
      }
      editingFeature = feature;
      return Object.freeze({ ...feature, editing: Object.freeze({ ...feature.editing, createMoveWithInput, createTreeForEditing, createTreeForPresentation, createTreeWithFixedControls }) });
    }
    function createForBrowser({ window: browserWindow, ...options }) {
      const feature = createEditing({ promptName: (title, name) => browserWindow.prompt(title, name), ...options });
      const { editing } = feature;
      function createDeletionForEditing(options) {
        return editing.createDeletionForEditing({ confirmDeletion: message => browserWindow.confirm(message), ...options });
      }
      return Object.freeze({ ...feature, editing: Object.freeze({ ...editing, createDeletionForEditing }) });
    }
    return Object.freeze({ resetMove, closeContext, readMoving, clearInteractionForSketchChange, toggleSketchVisibility,
      isSidebarHighlightedElement, startContext, createForInteraction: createEditing, createForBrowser });
  }
  window.SketchEditingFeature = Object.freeze({ create, createForInteraction, prepareNavigation });
})();
