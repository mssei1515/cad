/* Compose Block drafts, nested editing sessions and queries over the same owners. */
(() => {
  "use strict";
  function prepareCommandsWithView() {
    let published;
    function createForFeature(feature, options) {
      const commands = feature.createCommandsWithView(options);
      const updateBlockView = commands.updateView;
      published = Object.freeze({ value: updateBlockView });
      return commands;
    }
    function updateBlockUI() {
      if (published === undefined) throw new ReferenceError("Cannot access 'updateBlockView' before initialization");
      const updateBlockView = published.value;
      updateBlockView();
    }
    return Object.freeze({ createForFeature, update: updateBlockUI });
  }
  function create({ workspace, documentModel, ids, catalog, projections, instances, rebinding, readEditingScope,
    normalizedSketchCopy, normalizeGeometryInstance, isDimensionConstraint, isReadOnlyDimension,
    numericDimensionExpression, ensureParameterNamespace, activeSketchId, blockProjectionBundles, geometryElementKey,
    readViewport, activateScope, reserveScopeSequences, createHistory }) {
    function rebuildBlockDefinitionConstraintObjects(definition) { return rebinding.rebuildDefinition(definition); }
    function rebuildStoredBlockDefinitionConstraints() {
      return documentModel.blockDefinitions.reduce((removed, definition) => removed + rebuildBlockDefinitionConstraintObjects(definition), 0);
    }
    const editing = window.BlockDefinitionEditing.create({
      normalizedSketchCopy, cloneConstraintForBlock: rebinding.cloneForBlock, blockDefinitionById: catalog.blockDefinitionById,
      createBlockProjectionBundle: projections.createBlockProjectionBundle,
      geometryInstanceBundlesForScope: instances.geometryInstanceBundlesForScope, emptyGeometryInstanceBundle: instances.emptyGeometryInstanceBundle,
      normalizeGeometryInstance, hatchSequence: () => ids.peek("hatch"), nextDefinitionId: () => ids.allocate("blockDefinition"),
      isDimensionConstraint, isReadOnlyDimension, numericDimensionExpression, ensureParameterNamespace,
    });
    function captureHost() { return { ...workspace.capture(), viewport: readViewport().snapshot() }; }
    const session = window.BlockEditorSession.create({
      currentScope: workspace.current, documentModel, hatchSequence: () => ids.peek("hatch"),
      normalizedSketchCopy, activeSketchId, blockProjectionBundles, geometryElementKey,
      captureHost,
      restoreHostState: original => { activateScope(workspace.restore(original)); readViewport().update(original.viewport); },
      activateScope, reserveScopeSequences, cloneBlockDefinition: editing.clone, createHistory, mergeBlockDefinitionDraft: editing.apply,
      rebuildStoredBlockDefinitionConstraints, invalidateBlockProjectionCache: projections.invalidateBlockProjectionCache,
      blockDefinitionOwnedSubtreeIds: catalog.blockDefinitionOwnedSubtreeIds, rebuildBlockDefinitionConstraintObjects,
    });
    const queries = window.BlockEditingQueries.create({ definitions: () => documentModel.blockDefinitions,
      currentScope: workspace.current, readEditingScope, editor: session, catalog });
    function createPropagation({ readEditingScope: readPropagationScope = readEditingScope, clearSelection, stabilizeDefinition, stabilizeDocument, applicationText }) {
      return window.BlockParameterPropagation.create({ catalog, invalidateProjection: projections.invalidateBlockProjectionCache, applicationText,
        definitions: { rebuild: rebuildBlockDefinitionConstraintObjects, stabilize: stabilizeDefinition },
        document: { rebuild: () => {
          rebinding.rebuildDocument(readPropagationScope(), blockProjectionBundles());
          clearSelection();
        }, stabilize: stabilizeDocument } });
    }
    function createCommands({ canStartCreation, canvasSelection, selectionQuery, guardDimensionSymbolDeletion,
      resetBlockEditorHistory, clearSelection, setMode, closeDefinitions, setEditorActive, fitAllGeometryToViewport,
      resetEmptyViewport, promptName, updateBlockUI, updateUI, draw, recordHistory, setHint,
      duplicateBlockElementId, refreshReferenceConstraintValidity, hasInvalidReferenceConstraints,
      solveSketchById, resultIsAccepted, sketchName, solveReferenceDependentSketches, requestChoice,
      applicationText, blockLocalGeometryBounds, constraintGraphNodes, annotationReferencesRemovedGeometry,
      acceptError, setSketchSolveOk, setSketchSolveError, log }) {
      const definition = window.BlockDefinitionCommand.create({
        blockEditor: session, blockDefinitionEditing: editing, blockCatalog: catalog, blockEditingQueries: queries,
        documentModel, currentScope: workspace.current, canStartCreation, canvasSelection, captureHost,
        defaultName: () => `Block-${ids.peek("blockDefinition")}`,
        blockSelectionGeometry: selectionQuery.read, blockSelectionBoundsCenter: selectionQuery.center,
        guardDimensionSymbolDeletion, resetBlockEditorHistory, clearSelection, setMode, closeDefinitions, setEditorActive,
        fitAllGeometryToViewport, resetEmptyViewport, promptName, invalidateBlockProjectionCache: projections.invalidateBlockProjectionCache,
        updateBlockUI, updateUI, draw, recordHistory, setHint,
      });
      const completion = window.BlockCompletionCommand.create({
        blockEditor: session, blockDefinitionEditing: editing, blockCatalog: catalog, documentModel, currentScope: workspace.current,
        blockDefinitionCyclePath: queries.blockDefinitionCyclePath, duplicateBlockElementId, refreshReferenceConstraintValidity,
        hasInvalidReferenceConstraints, solveSketchById, resultIsAccepted, sketchName, solveReferenceDependentSketches,
        requestChoice, applicationText, blockLocalGeometryBounds, storedBlockInstancesReferencing: queries.storedBlockInstancesReferencing,
        restoreBlockEditorHost: definition.restoreHost, rebuildStoredBlockDefinitionConstraints,
        nextInstanceId: () => ids.allocate("blockInstance"), constraintGraphNodes, annotationReferencesRemovedGeometry,
        invalidateBlockProjectionCache: projections.invalidateBlockProjectionCache, blockProjectionBundles, geometryElementKey,
        blockDefinitionDependsOn: queries.blockDefinitionDependsOn, acceptError, setSketchSolveOk, setSketchSolveError,
        clearSelection, canvasSelection, setMode, setHint, log, updateUI, draw, recordHistory,
      });
      function createView({ document, escapeHtml, startBlockPlacement, localizeApplicationUI }) {
        return window.BlockView.create({ document, escapeHtml,
          readEditing: () => session.current ? { name: session.current.draft.name } : null,
          blockDefinitionsInCurrentScope: queries.blockDefinitionsInCurrentScope, blockDefinitionUsageCount: queries.blockDefinitionUsageCount,
          selectedDefinitionIds: () => canvasSelection.blockInstances.map(instance => instance.definitionId),
          startBlockPlacement, enterBlockDefinitionEdit: definition.enter, renameBlockDefinition: definition.rename, deleteBlockDefinition: definition.remove,
          completeBlockDefinitionEdit: completion.complete, cancelBlockDefinitionEdit: definition.cancel,
          changeName: session.rename, commitName: () => { if (session.current) recordHistory("ブロック名変更"); },
          refresh: updateBlockUI, localizeApplicationUI });
      }
      return Object.freeze({ definition, completion, createView });
    }
    // Read the later Block view only when an editor operation needs it.
    function createCommandsForEditing({ interaction, isGeometryMode, selectionQuery, guardDimensionSymbolDeletion,
      resetBlockEditorHistory, clearSelection, readView, drawingFit, updateBlockUI, presentation, recordHistory,
      referenceState, solving, resultIsAccepted, sketches, choiceDialog, blockLocalGeometryBounds, references, acceptError, solveState }) {
      const { canCreateInActiveSketch, guardSelectionEdit } = interaction.access;
      const { fitAllGeometryToViewport, resetEmptyViewport } = drawingFit;
      const { settings: { applicationText }, updateUI, draw, setHint, log } = presentation;
      const { refreshReferenceConstraintValidity } = referenceState;
      const { solveSketchById, solveReferenceDependentSketches } = solving, { sketchName } = sketches;
      const { constraintGraphNodes } = references, { setSketchSolveOk, setSketchSolveError } = solveState;
      const { referencesRemovedGeometry: annotationReferencesRemovedGeometry } = window.AnnotationAnchorData;
      return createCommands({ canStartCreation: () => isGeometryMode() && canCreateInActiveSketch() && guardSelectionEdit("structure"),
        canvasSelection: interaction.selection, selectionQuery, guardDimensionSymbolDeletion, resetBlockEditorHistory, clearSelection,
        setMode: interaction.lifecycle.setMode, closeDefinitions: () => readView().closeDefinitions(),
        setEditorActive: active => readView().setEditorActive(active), fitAllGeometryToViewport, resetEmptyViewport,
        promptName: name => window.prompt("ブロック名", name), updateBlockUI, updateUI, draw, recordHistory, setHint,
        refreshReferenceConstraintValidity, hasInvalidReferenceConstraints: () => referenceState.errorCount > 0,
        solveSketchById, resultIsAccepted, sketchName, solveReferenceDependentSketches,
        requestChoice: options => choiceDialog.show(options), applicationText, blockLocalGeometryBounds,
        constraintGraphNodes, annotationReferencesRemovedGeometry, acceptError, setSketchSolveOk, setSketchSolveError, log });
    }
    return Object.freeze({ editing, session, queries, createCommands, createCommandsForEditing, createPropagation });
  }
  function createForWorkspace({ documentWorkspace, readServices, rebinding, editingScope, normalizeGeometryInstance,
    readViewport, activateScope = (...args) => editingScope.activate(...args),
    reserveScopeSequences = draft => documentWorkspace.reservation.scope(draft), createHistory, interaction, sessions, presentation }) {
    const { workspace, document: documentModel, documentIds: ids, sketches: { activeSketchId }, parameters } = documentWorkspace;
    const { catalog, projections, instances, reads: { blockProjectionBundles } } = readServices;
    const { copyWithNormalizedAppearance: normalizedSketchCopy } = window.SketchHierarchy;
    const { isDimensionConstraint, isReadOnlyDimension } = window.DimensionQueries;
    const { numericDimensionExpression, ensureParameterNamespace } = parameters;
    const { geometryKeyForItem: geometryElementKey } = window.GeometryObjects;
    const feature = create({ workspace, documentModel, ids, catalog, projections, instances, rebinding,
      readEditingScope: () => editingScope.current, normalizedSketchCopy, normalizeGeometryInstance,
      isDimensionConstraint, isReadOnlyDimension, numericDimensionExpression, ensureParameterNamespace,
      activeSketchId, blockProjectionBundles, geometryElementKey, readViewport, activateScope, reserveScopeSequences, createHistory });
    function createCommandsWithView({ prepareBlocks, ...options }) {
      let view;
      function updateView() { prepareBlocks(); view.render(); }
      const commands = feature.createCommandsForEditing({ ...options, interaction, presentation, sketches: documentWorkspace.sketches,
        readView: () => view, updateBlockUI: updateView });
      const { createView: createBlockView } = commands;
      function createView(options) {
        const result = createBlockView({ ...options, localizeApplicationUI: presentation.settings.localizeApplicationUI });
        view = result;
        return result;
      }
      return Object.freeze({ ...commands, createView, updateView });
    }
    function createPlacement({ layout, isGeometryMode, clearSelection, isPropertiesCollapsed, setPropertiesPanelCollapsed, solveAndRefresh, recordHistory }) {
      const { canCreateInActiveSketch } = interaction.access, { selection: canvasSelection, lifecycle } = interaction;
      const { preview, pointer } = sessions, { setHint, updateUI, draw } = presentation;
      const { blockDefinitionById, blockDefinitionDrawableSketchIds, blockDefinitionGeometrySketchIds } = catalog;
      const { blockDefinitionScopeError } = feature.queries;
      const { snappedBlockRotation, blockInstanceTranslationForAnchor } = layout;
      return window.BlockPlacementCommand.create({ isGeometryMode, canCreateInActiveSketch, blockDefinitionById, blockDefinitionScopeError,
        blockDefinitionDrawableSketchIds, blockDefinitionGeometrySketchIds, snappedBlockRotation, blockInstanceTranslationForAnchor,
        activeSketchId, currentScope: workspace.current, nextInstanceId: () => ids.allocate("blockInstance"), clearSelection, canvasSelection,
        invalidateBlockProjectionCache: projections.invalidateBlockProjectionCache, isPropertiesCollapsed, setPropertiesPanelCollapsed,
        getPointerPreview: () => preview.pointer, setPointerPreview: value => { preview.setPointer(value); }, getLastPointerWorld: pointer.readLastPointer,
        setMode: lifecycle.setMode, setHint, updateUI, draw, solveAndRefresh, recordHistory });
    }
    function createSelectionQuery({ references, serializeConstraint, annotationBounds }) {
      const { mergeBounds, lineBBox, primitiveBBox, splineBBox } = window.GeometryBounds;
      const { applicationText } = presentation.settings;
      const { localizedConstraintName } = presentation.constraintFeedback;
      return window.BlockSelectionQuery.create({ currentScope: workspace.current, canvasSelection: interaction.selection,
        blockProjectionBundle: projections.blockProjectionBundle, elementSketchId: documentWorkspace.sketches.elementSketchId, activeSketchId,
        constraintGraphNodes: references.constraintGraphNodes, serializeConstraint,
        constraintLabelForList: constraint => localizedConstraintName(constraint.name), resolveGeometryRef: readServices.reads.resolveGeometryRef,
        applicationText, mergeBounds, lineBBox, primitiveBBox, splineBBox, annotationBounds });
    }
    function createConfiguration({ references, guardDimensionSymbolDeletion, updateBlockUI, recordHistory }) {
      const { key: geometryRefKey, parseId: parseGeometryRefId } = window.GeometryRef;
      const { referencesRemovedGeometry: annotationReferencesRemovedGeometry } = window.AnnotationAnchorData;
      const { setHint, log, updateUI, draw } = presentation;
      return window.BlockConfigurationCommand.create({ currentScope: workspace.current,
        blockDefinitionById: catalog.blockDefinitionById, blockProjectionBundle: projections.blockProjectionBundle,
        createBlockProjectionBundle: projections.createBlockProjectionBundle, blockDefinitionDrawableSketchIds: catalog.blockDefinitionDrawableSketchIds,
        blockDefinitionGeometrySketchIds: catalog.blockDefinitionGeometrySketchIds, constraintGraphNodes: references.constraintGraphNodes,
        geometryRefKey, parseGeometryRefId, annotationReferencesRemovedGeometry, guardDimensionSymbolDeletion, canvasSelection: interaction.selection,
        clearRemovedHover: removed => { if (removed.has(interaction.hover.current.dimension)) interaction.hover.update({ dimension: null }); },
        invalidateBlockProjectionCache: projections.invalidateBlockProjectionCache, setHint, updateBlockUI, log, updateUI, draw, recordHistory });
    }
    return Object.freeze({ ...feature, createCommandsWithView, createPlacement, createSelectionQuery, createConfiguration });
  }
  window.BlockEditingFeature = Object.freeze({ prepareCommandsWithView, create, createForWorkspace });
})();
