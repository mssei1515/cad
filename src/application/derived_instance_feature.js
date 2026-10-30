/* Compose derived placement, source editing and committed edits over shared owners. */
(() => {
  "use strict";
  function create({ currentScope, resolveGeometryRef, setHint, recordHistory, updateUI, draw, ...placementOptions }) {
    const command = window.GeometryInstanceCommand.create({ ...placementOptions,
      currentScope, resolveGeometryRef, setHint, recordHistory, updateUI, draw });
    function createSourceCommand(options) {
      return window.InstanceSourceCommand.create({ ...options, currentScope, placementCommand: command,
        activeSketchId: placementOptions.activeSketchId, cancelConstraintTargetCommand: placementOptions.cancelConstraintTargetCommand,
        cancelPendingCommand: placementOptions.cancelPendingCommand, clearSelection: placementOptions.clearSelection,
        canvasSelection: placementOptions.canvasSelection, getMode: placementOptions.getMode, setMode: placementOptions.setMode,
        updateToolbar: placementOptions.updateToolbar, applicationText: placementOptions.applicationText,
        geometryRefForItem: placementOptions.geometryRefForItem, isVisibleSketchElement: placementOptions.isVisibleSketchElement,
        geometryRefsEqual: placementOptions.geometryRefsEqual, elementSketchId: placementOptions.elementSketchId,
        setHint, recordHistory, updateUI, draw });
    }
    function createEditing(options) {
      const editing = window.DerivedInstanceEditing.create({ ...options, currentScope, resolveGeometryRef, setHint, recordHistory, updateUI, draw });
      function changeProperty(instance, key, value) {
        return command.isPlacing(instance) ? command.changeSetting(key, value) : editing.change(instance, key, value);
      }
      return Object.freeze({ editing, changeProperty });
    }
    return Object.freeze({ command, createSourceCommand, createEditing });
  }
  // Prepare source queries early; build command state only at the later editing stage.
  function createForEditing({ documentWorkspace, readServices, references, interaction, editingScope, presentation }) {
    const { workspace, sketches, documentIds } = documentWorkspace;
    const { activeSketchId, elementSketchId } = sketches, { selection, access, lifecycle } = interaction;
    const { geometryInstanceSourcePoints, createGeometryInstanceBundle, geometryInstanceBundlesForScope } = readServices.instances;
    const { resolveGeometryRef, geometryInstanceBundle, blockProjectionBundles } = readServices.reads;
    const { blockProjectionBundle } = readServices.projections, { geometryInstanceDependencyRefs, constraintGraphNodes } = references;
    const { geometryRefForItem, geometryKeyForItem: geometryElementKey } = window.GeometryObjects;
    const dragSources = window.InstanceProjection.createDragSourceQuery({ geometryInstanceSourcePoints, geometryInstanceDependencyRefs, resolveGeometryRef });
    const sourceSelection = window.InstanceProjection.createSourceSelection({ currentScope: () => editingScope.current,
      selectedGeometryItems: selection.selectedGeometryItems, canvasSelection: selection, blockProjectionBundle, geometryInstanceBundle,
      elementSketchId, activeSketchId, geometryRefForItem });
    function createCommands({ cancelConstraintTargetCommand, cancelPendingCommand, clearSelection, normalizeGeometryInstance,
      commitDraft, updateToolbar, recordHistory, projectionSources, guardDimensionSymbolDeletion, solveState }) {
      const { canCreateInActiveSketch, rejectRootSketchCreation, guardSketchEdit } = access;
      const { settings: { applicationText }, updateUI, draw, setHint, updatePropertiesUI } = presentation;
      const { Line } = window.GeometrySolver, { lineHasDirection } = window.GeometryKernel, { equals: geometryRefsEqual } = window.GeometryRef;
      const { referencesRemovedGeometry: annotationReferencesRemovedGeometry } = window.AnnotationAnchorData;
      const feature = create({ cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation,
        selectedItemsForGeometryInstance: () => sourceSelection.read(), geometryRefForItem, geometryRefsEqual,
        isVisibleSketchElement: readServices.geometryAppearance.isVisibleSketchElement, clearSelection, normalizeGeometryInstance,
        previewFreeId: type => type === "mirror" ? `MI${documentIds.peek("mirror")}` : `PI${documentIds.peek("pattern")}`,
        nextInstanceId: type => type === "mirror" ? documentIds.allocate("mirror") : documentIds.allocate("pattern"),
        activeSketchId, getMode: lifecycle.readMode, setMode: lifecycle.setMode, updateToolbar, updateUI, applicationText, setHint, draw,
        currentScope: workspace.current, canvasSelection: selection, recordHistory, Line, lineHasDirection, elementSketchId,
        resolveGeometryRef, createGeometryInstanceBundle, commitDraft });
      const sources = feature.createSourceCommand({ guardSketchEdit, exitDrawMode: lifecycle.exit, updatePropertiesUI,
        sketchProjectionEntryFromItem: projectionSources.sketchProjectionEntryFromItem, sketchProjectionSourceIsCovered: projectionSources.sketchProjectionSourceIsCovered,
        geometryInstanceBundlesForScope, blockProjectionBundles, geometryElementKey, geometryInstanceBundle, constraintGraphNodes,
        guardDimensionSymbolDeletion, annotationReferencesRemovedGeometry, clearSketchSolveState: solveState.clearSketchSolveState });
      function createEditingWithTransforms({ checkpoint, serializeModel, addPointSnapConstraints, rebind, parameters, acceptError,
        scopeQuery, solver, solveState, blockLayout, solving, updateBlockUI, refreshConstraintAnalysis }) {
        const { captureValues: snapshotModelState, restoreValues: restoreModelState } = checkpoint;
        const { stabilize: stabilizeActiveParameterNamespace } = parameters;
        const { sourceObjects: geometryInstanceSourceObjects } = dragSources;
        const editing = feature.createEditing({ snapshotModelState, restoreModelState, geometryInstanceBundle, geometryInstanceBundlesForScope,
          blockProjectionBundles, serializeModel, addPointSnapConstraints, geometryInstanceSourceObjects, rebind,
          stabilize: stabilizeActiveParameterNamespace, acceptError });
        const { sketchSolveVariables, sketchSolveConstraints, sketchSolveLines } = scopeQuery;
        const { blockDefinitionById, blockInstanceEnabledSketchSet } = readServices.catalog;
        const { blockWorldPoint, invalidateBlockProjectionCache } = readServices.projections;
        const { blockLocalGeometryBounds, snappedBlockRotation } = blockLayout;
        const transform = window.InstanceTransformCommand.create({ isPlacing: feature.command.isPlacing, currentScope: workspace.current,
          snapshotModelState, restoreModelState, geometryInstanceSourceObjects, sketchSolveVariables, sketchSolveConstraints, sketchSolveLines,
          solver, acceptError, stabilizeActiveParameterNamespace, clearSketchSolveState: solveState.clearSketchSolveState,
          applicationText, setHint, recordHistory, blockDefinitionById, blockLocalGeometryBounds, blockInstanceEnabledSketchSet, blockWorldPoint,
          invalidateBlockProjectionCache, updateBlockUI, refreshConstraintAnalysis, updateUI, draw,
          snappedBlockRotation, solveSketchAndDependents: solving.solveSketchAndDependents, updatePropertiesUI });
        return Object.freeze({ ...editing, transform });
      }
      return Object.freeze({ ...feature, sources, createEditingWithTransforms });
    }
    return Object.freeze({ dragSources, sourceSelection, createCommands });
  }
  window.DerivedInstanceFeature = Object.freeze({ create, createForEditing });
})();
