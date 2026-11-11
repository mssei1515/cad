/* Application composition, editing commands, Canvas UI and event handling. */
(function () {
  "use strict";
  const { escapeHtml } = window.HtmlText;

  const {
    CSS_PX_PER_MM,
  } = window.Appearance;
  const {
    drawingOrderOwner,
  } = window.DrawingOrder;

  const {
    MIN_ORIENTATION_LENGTH,
    arcEndpointPoint,
  } = window.GeometryKernel;




  const {
    ConstraintSolver,
  } = window.GeometrySolver;

  const constraintReferences = window.ConstraintReferences.create({ resolveGeometryRef: (ref) => resolveGeometryRef(ref) });
  const { refreshConstraintAnalysis, prepareWithReferencesForWorkspace: prepareSketchSolving } = window.SketchSolvingFeature.prepare();
  const annotationPreparation = window.AnnotationFeature.prepare();
  const propertiesPreparation = window.PropertiesDisplay.prepare();
  const { createForFeature: createBlockCommandsWithView, update: updateBlockUI } = window.BlockEditingFeature.prepareCommandsWithView();
  const { createForDrawing: createSelectionEditing, copy: copySelectionToClipboard,
    paste: pasteGeometryClipboard } = window.SelectionEditingFeature.prepare();
  const { createForWorkspace: createHistoryFeature, createBlockHistory: createBlockEditHistory, record: recordHistory } = window.HistoryController.prepare();


  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const pngExportLifecycle = window.PngExport.prepare();
  const presentation = window.PresentationFeature.create({
    document, storage: () => localStorage, refreshVersion: () => runtimeVersionView.render(), readDuplicateCount: () => constraintRedundancy.count,
  });
  const { profiler: interactionProfiler,
    log, setHint, updateUI, updateGeometrySelectionUI, draw, updateToolbar, updateStatusUI, updateHistoryButtons } = presentation;
  const { work: profileInteractionWork, phase: profileInteractionPhase } = interactionProfiler;
  const { applicationText } = presentation.settings;
  const authoringFeedback = presentation.createAuthoringFeedback();
  const documentWorkspace = window.DocumentWorkspace.create({
    applicationText, constraintGraphNodes: constraintReferences.constraintGraphNodes, nextHatchIndex: () => editingScopeBinding.current.nextHatchIndex,
  });
  const { workspace, parameters: parameterNamespace, sketches: sketchContext,
    geometryIds, createReadContext } = documentWorkspace;
  const currentParameterNamespace = workspace.current;
  const { createForWorkspace: createConstraintEditing, cancelConstraintTargetCommand, startDistanceValueInput,
    startDistanceResolution, updateConstraintButtons, commitNewConstraint, addConstraintIfMissing,
    addDistanceConstraintFromTarget } = window.ConstraintEditing.prepare();
  const { guard: guardDimensionSymbolDeletion, editor: parameterEditor, prepareNamespace: prepareParameterNamespace,
    createApplication: createParameterApplication } = window.ParameterEditingFeature.prepareForWorkspace({
    document, window, documentWorkspace, presentation, currentNamespace: currentParameterNamespace,
    currentScope: () => editingScopeBinding.current, readBlockEditor: () => blockEditor.current,
    recordHistory, pickDimension: event => expressionInputController.pickCanvas(event),
  });
  const { dimensionUsesExpression } = parameterNamespace;
  const { syncExpressionInputHighlight, installExpressionInputHighlights } = parameterEditor;

  const { services: geometryReadServices, createEditingScope, createPersistenceForWorkspace, createRebinding,
    persistence: documentPersistence } = createReadContext({
    currentSketches: () => editingScopeBinding.current.sketches,
    showHiddenElements: () => viewState.showHiddenElements, viewportScale: () => viewport.scale,
    profileRead: read => interactionProfiler.active ? profileInteractionWork("geometryReads", read) : read(),
  });
  const { serializeConstraint, decorateSerializedConstraint, serializeModel, ensureBlockState,
    loadModelData, normalizeGeometryInstance, readRepairMessage: readDocumentRepairMessage } = documentPersistence;
  const { projections: blockProjections, reads: geometryReads,
    geometryAppearance, hatches: hatchGeometryQuery } = geometryReadServices;
  const { resolveGeometryRef } = geometryReads;
  const blockLayout = geometryReadServices.createBlockLayout({ annotationBounds: annotationPreparation.annotationBounds });
  const sketchNavigation = window.SketchEditingFeature.prepareNavigation();
  const { clearInteractionForSketchChange, toggleSketchVisibility, isSidebarHighlightedElement } = sketchNavigation;
  const { binding: editingScopeBinding, solver, dimensionQueries: dimensionModelQueries, insertion: constraintInsertion } = createEditingScope({
    Solver: ConstraintSolver,
    closeSketchContext: sketchNavigation.closeContext, resetSketchMove: sketchNavigation.resetMove,
  });

  const { session: fileSession, createForWorkspace: createDocumentFileFeature } = window.DocumentFileFeature.prepare();

  const canvasInteraction = window.CanvasInteractionFeature.createGeometryWorkspace({
    sketches: sketchContext, readServices: geometryReadServices, constraintReferencesPoint: constraintReferences.constraintReferencesPoint, editedFitPoints: () => splineEditing.current?.spline?.fitPoints,
    setHint, applicationText, clearSnap: () => clearSnap(), clearPointerPreview: () => drawingPreview.setPointer(null),
    updateGeometrySelectionUI, draw,
  });
  const { lifecycle: drawOperationLifecycle, selectionFeature, selection: canvasSelection, clearSelection, isGeometryMode, resetBlankCandidate,
    pointUsage, cancelPendingCommand, createOperationSessionsForAuthoring: createOperationSessions } = canvasInteraction;
  presentation.bindUI({
    syncAnnotationResize: annotationPreparation.syncResizeSelection,
    prepareParameterNamespace,
    refreshConstraintAnalysis, updateDocumentName: () => updateDocumentNameUI(), updateToolbar,
    renderSketch: () => sketchTreeView.render(), updateBlockUI,
    renderProperties: propertiesPreparation.render, readSketchMoving: sketchNavigation.readMoving,
    updateStatusUI, updateConstraintButtons, syncDimensionInput: () => syncDimensionValueInput(),
    refreshSketchSelection: () => sketchTreeView.refreshSelection(),
  });
  const { controller: canvasContextController, element: canvasContextMenu, createSceneForPresentation: createCanvasContextScene } = window.CanvasContextInteraction.createMenuForWorkspace({
    document, window, canvas, escapeHtml, documentWorkspace, readServices: geometryReadServices,
    interaction: canvasInteraction, presentation,
  });
  const closeCanvasContextMenu = canvasContextController.close;
  const { dragSources: derivedDragQueries, createCommands: createDerivedCommands } = window.DerivedInstanceFeature.createForEditing({
    documentWorkspace, readServices: geometryReadServices, references: constraintReferences, interaction: canvasInteraction, editingScope: editingScopeBinding, presentation,
  });

  const { targets: annotationTargets, createConstrainedDragForFeature: createConstrainedAnnotationDrag, createFeature: createAnnotationFeature } = annotationPreparation.prepareForWorkspace({
    documentWorkspace, readServices: geometryReadServices, interaction: canvasInteraction, presentation, viewportScale: () => viewport.scale,
  });
  const { hitAnnotationTarget, annotationLeaderTargetFromItem, annotationLeaderAnchor } = annotationTargets;
  const { referenceState: referenceConstraintState, solveState: sketchSolveResultState,
    createContextWithAnnotationDrag: createSolveContext, solveAndRefresh } = prepareSketchSolving({
    documentWorkspace, readServices: geometryReadServices, references: constraintReferences, solver, pointUsage, presentation,
  });
  const { refreshReferenceConstraintValidity } = referenceConstraintState;
  const sketchProjectionFeature = window.SketchProjectionFeature.createForWorkspace({
    documentWorkspace, editingScope: editingScopeBinding, readServices: geometryReadServices,
    referenceState: referenceConstraintState, interaction: canvasInteraction, presentation,
    operandElement: operand => operandElement(operand), readProjectionRectangle: (...args) => rectangleSelectionQuery.readProjection(...args),
    cancelConstraintTargetCommand, cancelPendingCommand, clearSelection, clearSnap: () => clearSnap(),
    updateToolbar, normalizeGeometryInstance, refreshConstraintAnalysis, recordHistory,
  });
  const { command: sketchProjectionCommand, sources: sketchProjectionSources } = sketchProjectionFeature;
  const { toggle: toggleSketchProjectionSource } = sketchProjectionCommand;
  const { prepareGeometryForSolver: prepareDrawingGeometry, createEditing: createDrawingEditing, createCenterline, createTrim, createSplineEditing,
    resetSplineEditing, preview: authoringPreview } = window.BasicDrawingTools.prepare();
  const operationSessions = createOperationSessions({
    authoringPreview, readOffsetSelection: () => offsetSelection,
    hits: { hitPoint: (x, y) => hitPoint(x, y), hitLine: (x, y) => hitLine(x, y),
      hitCircle: (x, y) => hitCircle(x, y), hitArc: (x, y) => hitArc(x, y) },
    clearPlacement: () => geometryInstanceCommand.clearPlacement(), cancelAnnotation: () => annotationCommand.cancel(),
    cancelPngExport: pngExportLifecycle.cancel, resetOffset: () => offsetSelection.reset(),
    hideInput: () => hideDimensionValueInput(), updateToolbar, updateConstraintButtons,
    acceptTarget: (...args) => constraintOperandValues.appendTarget(...args),
  });
  const { preview: drawingPreview, pending: pendingCommandSession, targets: constraintTargetSession,
    pointer: pointerInteractionController, createSelectionPresentation, prepareInputForEditing: prepareCanvasEditingInput } = operationSessions;
  const constructionCommand = operationSessions.createConstruction({
    projection: sketchProjectionFeature, cancelConstraintTargetCommand, updateUI, recordHistory,
    synchronizeSketchProjectionMetadata: () => synchronizeSketchProjectionMetadata(), clearSnap: () => clearSnap(), updateToolbar,
  });
  const { highlight: selectionHighlight, documentReset: documentCanvasReset } = createSelectionPresentation({
    projections: blockProjections, constraintReferences,
  });
  const fixedStateQueries = window.ConstraintReferences.createFixedState({
    currentScope: () => editingScopeBinding.current, sameConstraintDisplayElement: selectionHighlight.sameConstraintDisplayElement,
  });
  const { findArcEndpointFixedConstraint, findLineFixedConstraint } = fixedStateQueries;
  const offsetSelection = window.OffsetFeature.createSelectionForEditing({
    editingScope: editingScopeBinding, sketches: sketchContext, selection: canvasSelection,
  });
  const constraintRebinding = createRebinding();
  const blockEditingFeature = window.BlockEditingFeature.createForWorkspace({
    documentWorkspace, readServices: geometryReadServices, rebinding: constraintRebinding, editingScope: editingScopeBinding, normalizeGeometryInstance,
    readViewport: () => viewport, createHistory: createBlockEditHistory,
    interaction: canvasInteraction, sessions: operationSessions, presentation,
  });
  const { session: blockEditor, queries: blockEditingQueries } = blockEditingFeature;

  const canvasRenderProbe = window.CanvasRenderProbe.createForScene({
    ctx, readServices: geometryReadServices, readGeometry: () => geometryDisplay, readDimensions: () => dimensionLayer,
  });
  const { drawCanvas, prepareHatchFrame } = window.CanvasDisplay.prepareRendering();
  presentation.bindCanvas({
    readPngCommand: pngExportLifecycle.readCommand, readPending: () => pendingCommandSession.current, readMode: drawOperationLifecycle.readMode,
    syncAnnotationInput: annotationPreparation.syncInput,
    withGeometryReadCache: geometryReads.withGeometryReadCache, drawCanvas,
  });
  const { command: geometryInstanceCommand, sources: instanceSourceCommand, createEditingWithTransforms: createInstanceEditing } = createDerivedCommands({
    cancelConstraintTargetCommand, cancelPendingCommand, clearSelection, normalizeGeometryInstance,
    commitDraft: (...args) => synchronizedInstanceEditing.commit(...args), updateToolbar, recordHistory,
    projectionSources: sketchProjectionSources, guardDimensionSymbolDeletion, solveState: sketchSolveResultState,
  });
  const propertiesPanel = window.CanvasWorkspaceLayout.prepare({ document });
  const blockPlacementCommand = blockEditingFeature.createPlacementWithProperties({
    layout: blockLayout, propertiesPanel, isGeometryMode, clearSelection, solveAndRefresh, recordHistory,
  });
  const { start: startBlockPlacement } = blockPlacementCommand;
  const historyFeature = createHistoryFeature({
    documentWorkspace, blocks: blockEditingFeature, readServices: geometryReadServices, presentation,
    serializeDocument: serializeModel, loadDocument: loadModelData, serializeConstraint, decorateSerializedConstraint,
    constructionCommand, clearInteractionForSketchChange, solveAndRefresh, changed: updateHistoryButtons,
  });
  const { controller: historyController } = historyFeature;
  const { active: activeEditHistory, resetBlock: resetBlockEditorHistory, resetDocument: resetHistory,
    undo: undoHistory, redo: redoHistory } = historyController;
  const toolbarPresentation = presentation.createToolbar({
    lifecycle: drawOperationLifecycle, pending: pendingCommandSession, constraints: constraintTargetSession, constructionCommand,
    readSplineEditing: () => Boolean(splineEditing.current), readHistory: activeEditHistory,
    updateDocumentStatus: () => updateDocumentNameUI(), isGeometryMode,
  });


  const pointerMoveScheduler = operationSessions.createMoveSchedulerForEditing({
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (frame) => cancelAnimationFrame(frame),
    profilePhase: profileInteractionPhase, withGeometryReadCache: geometryReads.withGeometryReadCache,
    syncDimensionValueInput: () => syncDimensionValueInput(),
  });
  const { flush: flushScheduledCanvasPointerMove } = pointerMoveScheduler;
  const { controls: canvasViewControls, canvasThemeColor, createForEditing: createCanvasDisplay } = window.CanvasDisplay.prepareForWorkspace({
    canvas, document, window, ctx, documentWorkspace, readServices: geometryReadServices,
    interaction: canvasInteraction, sessions: operationSessions, presentation,
  });
  const { state: viewState, constraintStatus: constraintStatusView } = canvasViewControls;

  const { acceptError: CONSTRAINT_ACCEPT_ERROR, resultIsAccepted } = window.SketchSolving.createEditingPolicy();
  const constraintOperandFeature = selectionFeature.createConstraintOperands({
    targets: constraintTargetSession, pointer: pointerInteractionController, solver, acceptError: CONSTRAINT_ACCEPT_ERROR,
  });
  const { candidates: constraintCandidates, operands: constraintOperandValues,
    fromSelection: constraintOperandsFromSelection } = constraintOperandFeature;
  const { sameArcEndpoint } = constraintCandidates;
  const { operandElement } = constraintOperandValues;
  const { minimumLength: MIN_LINE_LENGTH, createGeometry: createDrawingGeometry } = prepareDrawingGeometry(solver, MIN_ORIENTATION_LENGTH);
  const geometryDragPreparation = window.GeometryDragFeature.prepare();
  const { annotationDrag: constrainedAnnotationDrag, scopeQuery: solveScopeQuery, analysis: constraintAnalysis,
    redundancy: constraintRedundancy, createSolving, createLineCollapseQuery } = createSolveContext({
    createAnnotationDrag: createConstrainedAnnotationDrag, geometryDrag: geometryDragPreparation,
    minimumLength: MIN_LINE_LENGTH, acceptError: CONSTRAINT_ACCEPT_ERROR,
  });
  const { viewport, navigation: canvasNavigation, createEditingWorkspace: createCanvasWorkspace, fitVisibleGeometryToViewport } = createCanvasDisplay({
    initialScale: CSS_PX_PER_MM, minLength: MIN_LINE_LENGTH,
    flushPointerMoves: pointerMoveScheduler.flush, syncDimensionValueInput: () => syncDimensionValueInput(),
  });
  const { transient: transientAuthoring, createCheckpoint: createEditingCheckpoint, geometryCheckpoint: authoringCheckpoint } = window.GeometryMutationFeature.prepareForWorkspace({
    documentWorkspace, readServices: geometryReadServices, interaction: canvasInteraction,
    history: historyFeature, analysis: constraintAnalysis, updateHistoryButtons,
  });
  const { surface: canvasSurface, exportRenderer: pngRendering, layout: canvasWorkspaceLayout, createSceneWithAppearance: createCanvasScene, createPlacementPreview,
    createInputBinding: createCanvasInputBinding, createPngExport, createDimensionTraversal, createDimensionPreview, drawDimensionPreview, dragPointer,
    dimensions: { display: dimensionDisplay, labels: { label: dimensionLabelForConstraint }, input: dimensionInput, element: dimensionValueInput } } = propertiesPanel.createWorkspace(createCanvasWorkspace, {
    dimensionScene: { onExpressionMark: canvasRenderProbe.captureExpressionMark },
    dimensionInput: { syncHighlight: syncExpressionInputHighlight, scheduleFrame: callback => requestAnimationFrame(callback),
      startDistanceValueInput,
      submitOffsetValue: () => submitOffsetValue(), submitDistanceValue: () => submitDistanceValue() },
    drawCanvas, closeContextMenu: closeCanvasContextMenu, applySketchTreeWidth: () => applySketchTreeWidth(),
  });
  const { placement: dimensionPlacement, painter: { drawDimension }, layout: dimensionLayout } = dimensionDisplay;
  const { controller: dimensionInputController } = dimensionInput;
  const { hide: hideDimensionValueInput, sync: syncDimensionValueInput } = dimensionInputController;
  const canvasScene = createCanvasScene({
    solveState: sketchSolveResultState, analysis: constraintAnalysis,
    instanceSources: instanceSourceCommand, projection: sketchProjectionCommand, instances: geometryInstanceCommand, operandElement,
    selectionHighlight, isSidebarHighlightedElement,
    sameArcEndpoint, arcEndpointPoint, fixedState: fixedStateQueries,
    editingQueries: { ...geometryDragPreparation.queries, editedSpline: () => splineEditing.current?.spline },
    annotationBounds: annotationPreparation.annotationBounds,
  });
  const { geometry: geometryDisplay } = canvasScene;
  const dimensionValueEditing = window.ConstraintEditing.prepareDimensionValues({
    workspace, sketches: sketchContext, bounds: canvasScene.bounds, minimumLineLength: MIN_LINE_LENGTH,
  });

  const { layer: hatchLayer, prepareFrame: prepareCanvasFrame } = prepareHatchFrame(canvasScene, {
    readCommand: () => hatchCommand,
  });
  const annotationFeature = createAnnotationFeature({
    ctx, viewport, surface: canvasSurface, editingScope: editingScopeBinding, sessions: operationSessions,
    placement: dimensionPlacement, readAppearance: propertiesPreparation.readAppearance,
    readExportFrame: () => pngRendering.frame, canvasThemeColor,
    constraintOperandsFromSelection, recordHistory, cancelPendingCommand, cancelConstraintTargetCommand,
    startDistanceResolution, clearSelection, updateToolbar,
  });
  const { layer: annotationLayer, command: annotationCommand,
    dimensionScope: dimensionPresentationScope } = annotationFeature;
  const { canvasContextAnnotationHit } = annotationFeature.spatial;
  const sceneHitPreparation = operationSessions.prepareSceneWithAnnotations();
  const referenceImageFeature = window.ReferenceImageFeature.createForWorkspace({
    canvas, ctx, viewport, document, window, withCanvasState: canvasSurface.withCanvasState, createImage: () => new Image(),
    documentWorkspace, editingScope: editingScopeBinding, interaction: canvasInteraction, presentation, appearance: geometryAppearance,
    clearSelection, clearSnap: () => clearSnap(), hitReferenceImageAt: sceneHitPreparation.hitReferenceImageAt, recordHistory,
    pasteGeometry: pasteGeometryClipboard, copyGeometry: copySelectionToClipboard, isGeometryMode,
  });
  const { renderer: referenceImageRenderer, interaction: referenceImageInteraction, input: referenceImageInput } = referenceImageFeature;
  const { createFrame: createCanvasFrame } = prepareCanvasFrame();
  const placementPreviewLayer = createPlacementPreview({
    geometry: geometryDisplay, annotations: annotationFeature.renderer, hatchLayer,
    blockPlacementCommand, geometryInstanceCommand, createBlockProjectionBundle: blockProjections.createBlockProjectionBundle,
  });
  const { geometry: geometryCreation, createAuthoringForEditing: createAuthoringTools } = createDrawingGeometry({
    currentScope: workspace.current, ids: geometryIds, assignSketchId: sketchContext.assignSketchId, currentConstruction: () => constructionCommand.enabled,
    hitEndpointPoint: (x, y) => hitEndpointPoint(x, y), hitExplicitPoint: (x, y) => hitExplicitPoint(x, y),
  });
  const sketchProjectionEditing = sketchProjectionFeature.createModelEditing({
    geometry: geometryCreation, references: constraintReferences,
  });
  const { separateSharedSketchProjectionTargetPoints, synchronizeSketchProjectionMetadata } = sketchProjectionEditing;
  const authoringTools = createAuthoringTools({
    documentWorkspace, readServices: geometryReadServices, interaction: canvasInteraction, sessions: operationSessions, presentation, viewport,
    annotationAnchors: annotationFeature.drawingAnchors,
    transientAuthoring, pushModelConstraint: constraintInsertion.push, addConstraintIfMissing,
    checkpoint: authoringCheckpoint,
    cancelConstraintTargetCommand, resetEditing: resetSplineEditing, resetBlankCandidate, updateToolbar, projection: sketchProjectionCommand, clearSelection,
    solveAndRefresh, recordHistory,
  });
  const { snap: drawingSnap, spline: { command: splineCommand }, snapConstraints, tools: basicDrawingTools } = authoringTools;
  const { clear: clearSnap } = drawingSnap;
  const { addPointSnapConstraints } = snapConstraints;
  const offsetFeature = authoringTools.createOffsetForEditing({
    editingScope: editingScopeBinding, placement: dimensionPlacement, sourceSelection: offsetSelection,
    valueInput: dimensionInputController, ctx, surface: canvasSurface, drawDimension,
    commitNewConstraint, offsetChainErrorText: authoringFeedback.offsetChainErrorText, analysis: constraintAnalysis,
  });
  const { command: offsetCommand, previewLayer: offsetPreviewLayer, chainDraft: offsetChainDraft } = offsetFeature;
  const { submit: submitOffsetValue } = offsetCommand;
  const editingCheckpoint = createEditingCheckpoint();
  const persistenceComponents = createPersistenceForWorkspace({
    placement: dimensionPlacement, pointUsage, readEditingScope: () => editingScopeBinding.current, readBlockEditor: () => blockEditor.current,
    constraintReferencesPoint: constraintReferences.constraintReferencesPoint, separateSharedSketchProjectionTargetPoints, normalizeArcSweeps: geometryCreation.normalizeArcSweeps,
  });
  const { createApplication: createDocumentApplication } = persistenceComponents;
  const { solving: sketchSolving, parameters: parameterStabilization, storedDefinitions: storedDefinitionStabilization } = createSolving({
    projectionEditing: sketchProjectionEditing, geometry: geometryCreation, checkpoint: editingCheckpoint, editingScope: editingScopeBinding,
    historyController, recordHistory, resultIsAccepted,
  });
  const { stabilize: stabilizeActiveParameterNamespace } = parameterStabilization;
  const { fillet: filletCommand, createCircleCenterCross } = createDrawingEditing({
    checkpoint: editingCheckpoint, solving: sketchSolving, parameters: parameterStabilization, analysis: constraintAnalysis,
    editingScope: editingScopeBinding, solver, placement: dimensionPlacement, valueInput: dimensionInputController,
    projection: sketchProjectionFeature, acceptError: CONSTRAINT_ACCEPT_ERROR,
    updateGeometrySelectionUI,
  });
  const blockConfigurationCommand = blockEditingFeature.createConfiguration({
    references: constraintReferences, guardDimensionSymbolDeletion, updateBlockUI, recordHistory,
  });
  const { editing: synchronizedInstanceEditing, changeProperty: changeFreeInstanceProperty, transform: instanceTransformCommand } = createInstanceEditing({
    checkpoint: editingCheckpoint, serializeModel, addPointSnapConstraints,
    rebinding: constraintRebinding,
    parameters: parameterStabilization, acceptError: CONSTRAINT_ACCEPT_ERROR, scopeQuery: solveScopeQuery, solver, solveState: sketchSolveResultState,
    blockLayout, solving: sketchSolving, updateBlockUI, refreshConstraintAnalysis,
  });
  const { setBlockInstanceRotationLocked } = instanceTransformCommand;
  const { command: dimensionValueCommand, solvePreparation: constraintSolvePreparation } = dimensionValueEditing.createForEditing({
    solver, offsetChainDraft, minimumOrientationLength: MIN_ORIENTATION_LENGTH,
    parameters: parameterNamespace, interaction: canvasInteraction, pending: pendingCommandSession,
    valueInput: dimensionInputController, checkpoint: editingCheckpoint, presentation, annotationFeature,
    modelQueries: dimensionModelQueries, stabilization: parameterStabilization, viewport, placement: dimensionPlacement,
    synchronizedInstanceEditing,
    acceptError: CONSTRAINT_ACCEPT_ERROR, recordHistory, resetDimensionDrag: () => dimensionDrag.reset(), addDistanceConstraintFromTarget,
  });
  const { submit: submitDistanceValue, startEdit: startDimensionEditInput } = dimensionValueCommand;
  const { stabilizeDocument: stabilizeDocumentParameters } = createParameterApplication({
    editingScope: editingScopeBinding, blocks: blockEditingFeature, history: historyFeature, checkpoint: editingCheckpoint,
    parameters: parameterStabilization, storedDefinitions: storedDefinitionStabilization,
    acceptError: CONSTRAINT_ACCEPT_ERROR, loadDocument: loadModelData, clearSelection,
  });
  const centerlineCommand = createCenterline({
    commitNewConstraint,
  });
  const { renderer: { drawFilletArc: drawFilletPreviewArc }, layer: authoringPreviewLayer } = authoringTools.createPreviewForEditing({
    ctx, surface: canvasSurface, geometry: geometryDisplay, canvas, centerlineCommand,
  });
  const { versionView: runtimeVersionView, initialize: initializePresentation } = presentation.createStartup({
    canvasSurface, resizeCanvas: canvasWorkspaceLayout.resizeCanvas, readVersion: () => window.__JOT2D_RUNTIME_VERSION__,
  });

  const toolbarControls = toolbarPresentation.prepareControls({ canvas });
  const { fixPointBtn, createForSelection: createToolbarControls } = toolbarControls;

  presentation.settings.prepareButtonTooltips();



  const documentFileFeature = createDocumentFileFeature({
    window, document, documentWorkspace, history: historyFeature, blockEditor, presentation, fit: canvasScene.fit,
    serializeModel, requestChoice: options => choiceDialog.show(options), loadModelData, solveAndRefresh,
    repairMessage: readDocumentRepairMessage,
  });
  const { refreshStatus: updateDocumentNameUI } = documentFileFeature;






  const { controller: annotationInputController, commitParameterEdit: commitAnnotationParameterEdit } = annotationPreparation.createEditorForCheckpoint({
    document, host: canvas.parentElement, checkpoint: editingCheckpoint, guardDimensionSymbolDeletion,
    stabilize: stabilizeDocumentParameters,
  });


















  const sceneHitInteraction = sceneHitPreparation.createScene({
    documentWorkspace, viewport, dimensionScope: dimensionPresentationScope, dimensions: dimensionDisplay, dimensionLabelForConstraint,
    annotationBounds: annotationPreparation.annotationBounds, annotationSpatial: annotationFeature.spatial, operandValues: constraintOperandValues,
  });
  const { policy: { ordinarySelectionMode }, hitAnnotationElement } = sceneHitInteraction;































  const circleCenterCrossCommand = createCircleCenterCross({
    resultIsAccepted, minOrientationLength: MIN_ORIENTATION_LENGTH,
  });

  const lineCollapseQuery = createLineCollapseQuery();

  const splineEditing = createSplineEditing({
    constraintReferences, guardDimensionSymbolDeletion,
  });

  const blockSelectionQuery = blockEditingFeature.createSelectionQuery({
    references: constraintReferences, serializeConstraint, annotationBounds: annotationPreparation.annotationBounds,
  });




  const choiceDialog = window.ChoiceDialog.create(document.getElementById("choiceDialog"));
  const { definition: blockDefinitionCommand, completion: blockCompletionCommand, createView: createBlockView } = createBlockCommandsWithView(blockEditingFeature, {
    isGeometryMode, selectionQuery: blockSelectionQuery, guardDimensionSymbolDeletion, prepareBlocks: ensureBlockState,
    resetBlockEditorHistory, clearSelection, drawingFit: canvasScene.fit, recordHistory,
    referenceState: referenceConstraintState, solving: sketchSolving, resultIsAccepted, choiceDialog,
    blockLocalGeometryBounds: blockLayout.blockLocalGeometryBounds, references: constraintReferences, acceptError: CONSTRAINT_ACCEPT_ERROR, solveState: sketchSolveResultState,
  });
  const { enter: enterBlockDefinitionEdit } = blockDefinitionCommand;


  const { createForWorkspace: createDocumentEditingReset, reset: resetModelState } = window.DocumentEditingReset.prepare();


















  createDocumentApplication({
    resetEditingState: resetModelState,
    sketchTreeView: { capture: () => sketchTreeView.capture(), restore: state => sketchTreeView.restore(state) },
    refreshReferenceConstraintValidity, enforceMinimumLineLengths: geometryCreation.enforceMinimumLineLengths, log,
  });

  const dxfImportFeature = documentFileFeature.createDxfForWorkspace({
    geometry: geometryCreation, interaction: canvasInteraction, sessions: operationSessions,
    minimumLength: MIN_LINE_LENGTH, clearSelection,
  });

  referenceImageInput.bindClipboard();
  const { clipboard: imageClipboard } = referenceImageInput;




  authoringTools.createLifecycle({ interaction: canvasInteraction,
    instances: geometryInstanceCommand, instanceSources: instanceSourceCommand, centerline: centerlineCommand,
    fillet: filletCommand, offset: offsetSelection, hatch: { reset: () => hatchCommand.reset() },
  });

































  const sceneHitQueries = sceneHitInteraction.createQueries();
  const { hitDimension, hitBlockInstance, hitConstraintOperand } = sceneHitQueries;
  const { hitSketchIdentityElement, hitEndpointPoint, hitExplicitPoint, hitPoint, hitLine, hitCircle, hitArc } = sceneHitQueries.geometry;













































  const { deletion: deletionFeature, clipboard: clipboardFeature } = createSelectionEditing({
    documentWorkspace, editingScope: editingScopeBinding, readServices: geometryReadServices, interaction: canvasInteraction,
    references: constraintReferences, annotationFeature, annotationLeaderAnchor,
    splineEditing, guardDimensionSymbolDeletion, geometry: geometryCreation, sessions: operationSessions, drawing: basicDrawingTools,
    solving: sketchSolving, analysis: constraintAnalysis, presentation, updateToolbar, recordHistory,
    referenceImageInteraction, clearSelection, solveAndRefresh,
    resetGeometryDrag: geometryDragPreparation.reset, resetDimensionDrag: () => dimensionDrag.reset(), resetAnnotationDrag: annotationPreparation.resetDrag,
    viewport, persistence: documentPersistence, normalizeGeometryInstance, blocks: blockEditingFeature,
    imageClipboard, isGeometryMode,
  });
  const { remove: deleteElements, removeSelection: deleteCurrentSelection } = deletionFeature;


  const { selectionBounds: dimensionSelectionBounds, layer: dimensionLayer } = createDimensionTraversal({
    currentScope: dimensionPresentationScope, readDraggedDimension: () => dimensionDrag.constraint, dimensionUsesExpression,
  });

  const { query: rectangleSelectionQuery, rectangle: selectionRectangle } = sceneHitInteraction.createRectangleSelection({
    dimensionBounds: dimensionSelectionBounds, instanceSourceCommand, geometryInstanceCommand, sketchProjection: sketchProjectionFeature,
    canvas, clearSelection, presentation,
  });
















  const canvasFrame = createCanvasFrame({
    rectangle: selectionRectangle, snap: drawingSnap, pointer: pointerInteractionController,
    recordDraw: () => pointerMoveScheduler.recordDraw(), referenceImageLayer: referenceImageFeature.layer, readPngCommand: pngExportLifecycle.readCommand,
    dimensions: dimensionLayer, drawDimensionPreview, annotations: annotationLayer,
    authoringPreview: authoringPreviewLayer, placements: placementPreviewLayer, offsetPreview: offsetPreviewLayer,
  });








































  const annotationDrag = annotationPreparation.createDragForEditing({
    constrained: constrainedAnnotationDrag, pointer: dragPointer,
  });

  createDimensionPreview({ drawFilletPreviewArc });
















  const { selection: propertiesSelection,
    createEditingWithViewForPresentation: createPropertiesForEditing } = propertiesPreparation.createForWorkspace({
    document, documentWorkspace, readServices: geometryReadServices, interaction: canvasInteraction, presentation,
    operations: { sources: instanceSourceCommand, placement: geometryInstanceCommand, blocks: blockPlacementCommand },
  });

  createToolbarControls({ selection: propertiesSelection, sketches: sketchContext });

  const { selectionQuery: constraintSelectionQuery, targets: constraintTargetCommand, dimensions: dimensionPlacementCommand,
    createCommitWithIntentForWorkspace: createConstraintCommit, createFixedForWorkspace, constraintTargetHint, readOnlyDimensions,
    input: { updateHover: updatePendingDistanceRetargetHover, createWithDraggingForWorkspace: createConstraintInputWithDragging },
    controls: { bindForEditing: bindConstraintControls } } = createConstraintEditing({
    document, controls: toolbarControls, interaction: canvasInteraction, sessions: operationSessions, documentWorkspace, readServices: geometryReadServices, presentation,
    operands: constraintOperandFeature, viewport, annotationFeature, instances: geometryInstanceCommand, valueInput: dimensionInputController, fixedState: fixedStateQueries,
    isGeometryMode, clearSelection, updateToolbar, updateConstraintButtons,
    hitConstraintOperand, placement: dimensionPlacement,
  });



  const { operandClick: handleConstraintOperandClick } = constraintTargetCommand;









  const { editing: sketchEditing } = sketchNavigation.createForInteraction({
    documentWorkspace, readServices: geometryReadServices, interaction: canvasInteraction, sessions: operationSessions,
    constraintTargets: constraintTargetCommand, valueInput: dimensionInputController, presentation, constraintReferences, recordHistory,
    clearSelection, clearSnap, updateToolbar,
    resetGeometryDrag: geometryDragPreparation.reset, resetDimensionDrag: () => dimensionDrag.reset(),
    referenceImage: referenceImageInteraction, selectionRectangle, projection: sketchProjectionCommand, instances: geometryInstanceCommand, instanceSources: instanceSourceCommand,
    promptName: (title, name) => window.prompt(title, name),
  });

  const { createSketch } = sketchEditing.command;
  const { command: sketchMoveCommand, input: sketchMoveInputBinding } = sketchEditing.createMoveWithInput({
    document,
    readEditingScope: () => editingScopeBinding.current, hatches: hatchGeometryQuery, rebinding: constraintRebinding,
    analysis: constraintAnalysis, refreshReferenceConstraintValidity,
  });
  // The command is published before enabling destination-only input.
  sketchMoveInputBinding.bind();
  const hatchCommand = authoringTools.createHatchForEditing({ updateStatusUI, hatchRegionErrorText: authoringFeedback.hatchRegionErrorText });
  const { startHatchBoundaryRepair } = hatchCommand;



  const sketchDeletionCommand = sketchEditing.createDeletionForEditing({
    deletion: deletionFeature, guardDimensionSymbolDeletion, solveState: sketchSolveResultState,
    solving: sketchSolving, analysis: constraintAnalysis, confirmDeletion: message => window.confirm(message),
  });
  const { remove: deleteSketch } = sketchDeletionCommand;


  const toolbarIcons = toolbarPresentation.createIcons();



  const { operand: fixedOperandCommand, createSelectionForWorkspace: createFixedSelection } = createFixedForWorkspace({
    projection: sketchProjectionFeature, selectionHighlight, deleteElements, commitNewConstraint, solveAndRefresh,
  });

  const { view: sketchTreeView } = sketchEditing.createTreeForPresentation({
    document, window, selectionHighlight,
    selection: propertiesSelection, analysis: constraintAnalysis, redundancy: constraintRedundancy, referenceState: referenceConstraintState,
    projection: sketchProjectionFeature, icons: toolbarIcons, feedback: authoringFeedback, fixedState: fixedStateQueries,
    escapeHtml, closeCanvasContextMenu, moveCommand: sketchMoveCommand, deletion: sketchDeletionCommand,
    blockEditor, editingScope: editingScopeBinding, solveState: sketchSolveResultState, dimensionScope: dimensionPresentationScope,
    deleteElements, deleteCurrentSelection, toggleSelectedVisibility: propertiesPreparation.toggleSelectedVisibility, fixedOperands: fixedOperandCommand,
  });
  const { applyWidth: applySketchTreeWidth } = sketchTreeView;
  sketchNavigation.startContext();






















  const blockView = createBlockView({ document, escapeHtml, startBlockPlacement });


  const expressionInputController = parameterEditor.createReferenceInput({
    TextAreaElement: HTMLTextAreaElement, currentNamespace: () => editingScopeBinding.current, dimensionValueInput, pendingCommandSession,
    canvas, canvasPoint: viewport.canvasPoint, hitDimension, hitAnnotationElement,
  });











  const { appearanceUI } = createPropertiesForEditing({
    editingScope: editingScopeBinding, viewport, checkpoint: editingCheckpoint, parameters: parameterStabilization,
    projection: sketchProjectionFeature, projectionEditing: sketchProjectionEditing, annotationFeature,
    isGeometryMode, toggleSketchVisibility, recordHistory, escapeHtml,
  }, () => ({
    analysis: constraintAnalysis, selectionHighlight, layout: blockLayout, feedback: authoringFeedback, parameterEditor,
    HTMLTextAreaElement, HTMLInputElement,
    changeFreeInstanceProperty, commitAnnotationParameterEdit,
    instanceTransform: instanceTransformCommand, blockConfiguration: blockConfigurationCommand,
    dimensionValues: dimensionValueCommand, dimensions: dimensionPlacementCommand, referenceImages: referenceImageInteraction, hatch: hatchCommand, splineEditing,
  }));














































  const { command: constraintCommitCommand, intentResolver: { resolve: resolveConstraintIntent } } = createConstraintCommit({
    checkpoint: editingCheckpoint, insertion: constraintInsertion, redundancy: constraintRedundancy,
    solving: sketchSolving, stabilization: parameterStabilization, referenceState: referenceConstraintState,
    solvePreparation: constraintSolvePreparation, lineCollapseQuery, acceptError: CONSTRAINT_ACCEPT_ERROR,
    refreshConstraintAnalysis, recordHistory, now: () => performance.now(),
  });
  const { markReference: markReferenceConstraint } = constraintCommitCommand;








  const geometryDragFeature = geometryDragPreparation.createForWorkspaceWithProjection({
    documentWorkspace, interaction: canvasInteraction, presentation, sourceQueries: derivedDragQueries, projection: sketchProjectionFeature,
    solver, scopeQuery: solveScopeQuery, solving: sketchSolving,
    checkpoint: editingCheckpoint, geometry: geometryCreation, readServices: geometryReadServices,
    viewport, pointer: dragPointer, acceptError: CONSTRAINT_ACCEPT_ERROR,
    minimumLength: MIN_ORIENTATION_LENGTH,
    blockLocalGeometryBounds: blockLayout.blockLocalGeometryBounds, fixedState: fixedStateQueries,
    stabilizeActiveParameterNamespace, refreshConstraintAnalysis, recordHistory, clearSelection,
  });
  const { command: geometryDrag } = geometryDragFeature;

  const { input: constraintInputFeature, dragging: dimensionDragFeature } = createConstraintInputWithDragging({
    pointer: dragPointer, clearSnap, recordHistory,
  });
  const { command: dimensionDrag } = dimensionDragFeature;







  const blockDragging = geometryDragFeature.createBlockEntry();



  const trimFeature = createTrim({
    references: constraintReferences, hitSketchIdentityElement,
  });

  const { presentCandidate: canvasContextCandidatePresentation, prepareInteraction: prepareCanvasContextInteraction } = createCanvasContextScene({
    sceneQueries: sceneHitQueries, splineEditing, canvasContextAnnotationHit, sessions: operationSessions,
    icons: toolbarIcons, feedback: authoringFeedback,
  });












  const startCanvasContextInteraction = prepareCanvasContextInteraction({
    instances: geometryInstanceCommand, constraints: constraintTargetCommand, blockPlacement: blockPlacementCommand,
  });


  const { topmostOwner: topmostDrawingOrderOwner, state: drawingOrderCommandState, reorder: reorderSelectedDrawingObjects } = selectionFeature.createDrawingOrder({
    editingScope: editingScopeBinding, ordinarySelectionMode, updateUI, recordHistory,
  });














  startCanvasContextInteraction({
    constraintSelection: constraintSelectionQuery, blockQueries: blockEditingQueries, dimensions: dimensionDragFeature,
    clipboard: clipboardFeature, history: historyController,
    viewport, projection: sketchProjectionCommand,
    sameArcEndpoint, clearSelection, findLineFixedConstraint, findArcEndpointFixedConstraint,
    visibleGeometryBounds: canvasScene.bounds.visibleGeometryBounds, drawingOrderCommandState, handleConstraintOperandClick, isGeometryMode,
    closeAppMenus: () => closeAppMenus(),
    copySelectionToClipboard, imageClipboard,
    showSelectedObjectProperties: canvasWorkspaceLayout.showSelectedObjectProperties, fixPointBtn, enterBlockDefinitionEdit,
    setBlockInstanceRotationLocked, startDimensionEditInput, recordHistory, sketchMoveCommand,
    startHatchBoundaryRepair, reorderSelectedDrawingObjects, fitVisibleGeometryToViewport,
  });

  const { blankGesture: blankCanvasGesture, bindForWorkspace: bindCanvasInput } = prepareCanvasEditingInput({
    document, canvas, updateUI,
    annotationFeature, annotationDrag, constraintInputFeature, dimensionDragging: dimensionDragFeature,
    constraintTargetHint,
    instanceSourceCommand, geometryInstanceCommand, sceneQueries: sceneHitQueries, operandElement, toggleSketchProjectionSource,
    selectionRectangle, viewport, transientAuthoring, authoring: authoringTools,
    drawingCommands: { centerline: centerlineCommand, circleCenterCross: circleCenterCrossCommand, fillet: filletCommand, trim: trimFeature, offset: offsetCommand },
    sameArcEndpoint, topmostDrawingOrderOwner, drawingOrderOwner, geometryDragging: geometryDragFeature, blockDragging, referenceImage: referenceImageInteraction,
  }, () => ({
    splineEditing, dimensionValues: dimensionValueCommand, annotationInput: annotationInputController,
  }));

  bindCanvasInput({
    canvasNavigation, recordHistory,
    updatePendingDistanceRetargetHover, hitDimension, hitSketchIdentityElement,
    hatch: hatchCommand, spline: splineCommand, blockPlacement: blockPlacementCommand, dimensions: dimensionPlacementCommand,
    expressions: expressionInputController, discardMoves: flushScheduledCanvasPointerMove, enterBlock: enterBlockDefinitionEdit,
    closeContextMenu: closeCanvasContextMenu, hitAnnotationTarget,
    createCanvasInputBinding, readPngExportCommand: pngExportLifecycle.readCommand, scheduler: pointerMoveScheduler,
  }, () => ({
    window, navigation: sketchNavigation, canvasMenu: canvasContextMenu, closeCanvas: closeCanvasContextMenu,
    sketchMove: sketchMoveCommand, constraintStatusView, dimensionInput: dimensionInputController,
    files: documentFileFeature, history: historyController, copy: copySelectionToClipboard, paste: pasteGeometryClipboard,
    projection: sketchProjectionCommand, constraints: constraintTargetCommand, deleteSelection: deleteCurrentSelection,
  }), dimensionInput);
  canvasViewControls.bindWindow();








  const workspaceControls = toolbarPresentation.prepareWorkspace({
    window, canvasViewControls, layout: canvasWorkspaceLayout,
    parameters: parameterEditor, appearance: appearanceUI, blocks: blockView,
    editing: { undo: undoHistory, redo: redoHistory, toggleVisibility: propertiesPreparation.toggleSelectedVisibility, deleteSelection: deleteCurrentSelection, annotation: annotationCommand },
    drawing: { centerline: centerlineCommand, circleCenterCross: circleCenterCrossCommand,
      projection: sketchProjectionCommand, instances: geometryInstanceCommand, fillet: filletCommand,
      blockCreation: blockDefinitionCommand, offset: offsetCommand, spline: splineCommand, hatch: hatchCommand },
  });
  const { close: closeAppMenus } = workspaceControls;
  workspaceControls.startWithDrawingTools();


  const { png: { command: pngExportCommand }, start: startFileExportControls } = documentFileFeature.prepareExportControls({
    createPngExport, referenceImage: referenceImageFeature, drawingSnap, pngExport: pngExportLifecycle,
    dxfImport: dxfImportFeature, flushPointerMove: flushScheduledCanvasPointerMove,
  });
  startFileExportControls();
  referenceImageInput.bindControls();
  sketchTreeView.bindCreation(createSketch);

  window.SidebarController.create({ document, setHint }).bind();



  createFixedSelection({
    checkpoint: editingCheckpoint, insertion: constraintInsertion, solving: sketchSolving,
    acceptError: CONSTRAINT_ACCEPT_ERROR, refreshConstraintAnalysis, recordHistory,
  });

  bindConstraintControls();



  canvasWorkspaceLayout.bindWindow();

  function installTestHooks() {
    if (!new URLSearchParams(window.location.search).has("test")) return;
    const documentTestSupport = window.DocumentTestDriver.createBrowserSupportForWorkspace({
      documentWorkspace, geometry: geometryCreation, presentation, document, history: historyFeature, blocks: blockEditingFeature,
      constructionCommand, files: documentFileFeature, fileSession,
    }, {
      resetModelState, deleteSketch, markReferenceConstraint, serializeModel, loadModelData,
      analysis: constraintAnalysis, referenceState: referenceConstraintState, performance, File,
    });
    const readTestHistory = documentTestSupport.documents.readTestHistory;
    const { readSelectedGeometry: readTestSelectedGeometry, createApiForEditing: createSelectionTestApi } = window.CanvasSelectionTestDriver.createForWorkspace({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, interaction: canvasInteraction, presentation, clearSelection,
    });
    const constraintBrowserSupport = window.ConstraintTestDriver.createBrowserSupport({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, scopeQuery: solveScopeQuery,
      solving: sketchSolving, analysis: constraintAnalysis, solver, referenceState: referenceConstraintState, blockQueries: blockEditingQueries,
      operandValues: constraintOperandValues, interaction: canvasInteraction, sessions: operationSessions, placement: dimensionPlacement,
      checkpoint: editingCheckpoint, presentation, viewport, sketchPresentation: canvasScene.sketchStyle, canvas, document, readSelectedGeometry: readTestSelectedGeometry,
      commitNewConstraint, markReferenceConstraint, serializeModel, serializeConstraint, resolveConstraintIntent, resetModelState,
      pushModelConstraint: constraintInsertion.push, fitAllGeometryToViewport: canvasScene.fit.fitAllGeometryToViewport, acceptError: CONSTRAINT_ACCEPT_ERROR,
    });
    const { readStatuses: readTestConstraintStatuses } = constraintBrowserSupport;
    const { execution: dragExecutionSupport, createResponsiveFromPersistence: createResponsiveDragFixture } = window.GeometryDragTestDriver.createForWorkspace({
      documentWorkspace, geometry: geometryCreation, scopeQuery: solveScopeQuery, feature: geometryDragFeature, solver,
      modelTypes: window.GeometrySolver, arcEndpointPoint, now: () => performance.now(), readConstraintStatuses: readTestConstraintStatuses,
    });
    const annotationTestSupport = window.AnnotationTestDriver.createForFeature({
      feature: annotationFeature, geometry: geometryCreation, readServices: geometryReadServices, dimensionDisplay, dimensionLabelForConstraint,
      currentScope: workspace.current, viewport, canvas, selection: canvasSelection, drag: annotationDrag, annotationLeaderAnchor,
      annotationLeaderTargetFromItem, draw, allGeometryBounds: canvasScene.bounds.allGeometryBounds, resetModelState, resizeCanvas: canvasWorkspaceLayout.resizeCanvas, hitAnnotationElement,
    });
    const trimTestSupport = window.TrimTestDriver.createFeature({
      feature: trimFeature, resetModelState, geometry: geometryCreation, pushModelConstraint: constraintInsertion.push, currentScope: workspace.current,
    });
    const canvasTestSupport = window.CanvasTestDriver.createBrowserSupportForWorkspace({
      document, canvas, viewport, documentWorkspace, readServices: geometryReadServices, geometry: geometryCreation,
      interaction: canvasInteraction, sessions: operationSessions, presentation,
      authoring: { tools: basicDrawingTools, snap: drawingSnap, offsetSelection },
      display: canvasScene, ctx, selectionRectangle,
      layers: { authoringPreviewLayer, offsetPreviewLayer, placementPreviewLayer },
      blocks: blockEditingFeature, blockPlacement: blockPlacementCommand, annotations: annotationFeature.renderer, frame: canvasFrame,
      resizeCanvas: canvasWorkspaceLayout.resizeCanvas, resetModelState, cssPxPerMm: CSS_PX_PER_MM, sceneQueries: sceneHitQueries,
      observations: { viewControls: canvasViewControls, centerlineCommand, commit: constraintCommitCommand,
        persistence: documentPersistence, readSelectedGeometry: readTestSelectedGeometry, scheduler: pointerMoveScheduler },
    });
    const { display: canvasTestDriver } = canvasTestSupport;
    const propertiesTestSupport = window.PropertiesTestDriver.createBrowserSupportForDisplay({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, interaction: canvasInteraction, blockQueries: blockEditingQueries,
      selectionHighlight, presentation, display: geometryDisplay, placement: dimensionPlacement, viewport, document, canvas, fixPointBtn,
      readHistory: readTestHistory, resetModelState, clearSelection, resetHistory,
      fit: canvasScene.fit, insertion: constraintInsertion, recordHistory, canvasThemeColor, isSidebarHighlightedElement,
      propertiesSelection, fixedState: fixedStateQueries,
    });
    const sketchTreeTestApi = window.SketchTreeTestDriver.createForWorkspace({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, interaction: canvasInteraction, presentation,
      sketchPresentation: canvasScene.sketchStyle, overlay: canvasScene.overlay, viewport, canvasDriver: canvasTestDriver, drawingFit: canvasScene.fit, blocks: blockEditingFeature, dimensionDisplay,
      referenceState: referenceConstraintState, document, canvas, getComputedStyle: element => getComputedStyle(element),
      serializeModel, resetModelState, addDistanceConstraintFromTarget, dimensionLayout, blockInstanceDisplayCenter: blockLayout.blockInstanceDisplayCenter,
    });
    const blockBrowserSupport = window.BlockTestDriver.createBrowserSupportForWorkspace({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, blocks: blockEditingFeature,
      interaction: canvasInteraction, sessions: operationSessions, presentation, placement: blockPlacementCommand, solver, canvas, viewport,
      solving: sketchSolving, definition: blockDefinitionCommand, completion: blockCompletionCommand, configuration: blockConfigurationCommand,
      sketchEditing, dragging: geometryDragFeature, selectionQuery: blockSelectionQuery,
      resetModelState, pushModelConstraint: constraintInsertion.push, fitAllGeometryToViewport: canvasScene.fit.fitAllGeometryToViewport, recordHistory, serializeConstraint, serializeModel, loadModelData, blockInstanceDisplayCenter: blockLayout.blockInstanceDisplayCenter,
      dimensionPlacement, readOnlyDimensions,
    });
    const dimensionTestSupport = window.DimensionTestDriver.createBrowserSupportFromOwners({
      documentWorkspace, interaction: canvasInteraction, sessions: operationSessions,
      geometry: geometryCreation, display: dimensionDisplay, readServices: geometryReadServices,
      viewport, resetModelState, addDistanceConstraintFromTarget,
      dimensions: dimensionPlacementCommand, serializeModel, persistence: persistenceComponents,
      dimensionValueInput, ctx, layer: dimensionLayer, dimensionLabelForConstraint,
    }, {
      canvasDriver: canvasTestDriver, dimensionValues: dimensionValueCommand, clearSelection, presentation, fit: canvasScene.fit, references: constraintReferences, canvas,
      solving: sketchSolving, checkpoint: editingCheckpoint, analysis: constraintAnalysis, dimensionDrag,
    });
    const responsiveDragFixture = createResponsiveDragFixture({
      insertion: constraintInsertion, presentation, fit: canvasScene.fit, modelTypes: window.GeometrySolver,
      resetModelState, persistence: persistenceComponents, solveAndRefresh, resetHistory, serializeModel,
    });
    const offsetTestSupport = window.OffsetTestDriver.createForWorkspace({
      documentWorkspace, geometry: geometryCreation, insertion: constraintInsertion, offset: offsetFeature, sourceSelection: offsetSelection,
      solvePreparation: constraintSolvePreparation, solving: sketchSolving, checkpoint: editingCheckpoint, sessions: operationSessions, presentation, viewport,
      resetModelState, serializeModel, loadModelData, clearSelection, fitAllGeometryToViewport: canvasScene.fit.fitAllGeometryToViewport, resetHistory, solveAndRefresh, canvas, document,
    });
    const sketchProjectionTestSupport = window.SketchProjectionTestDriver.createBrowserSupportForWorkspace({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, interaction: canvasInteraction, projection: sketchProjectionFeature,
      display: geometryDisplay, sketchPresentation: canvasScene.sketchStyle, analysis: constraintAnalysis, redundancy: constraintRedundancy, presentation, canvasDriver: canvasTestDriver,
      history: historyController, solving: sketchSolving, blocks: blockEditingFeature, blockDefinition: blockDefinitionCommand, blockCompletion: blockCompletionCommand, blockSelection: blockSelectionQuery,
      document, readHistory: readTestHistory, resetModelState, serializeModel, loadModelData, markReferenceConstraint, pushModelConstraint: constraintInsertion.push, synchronizeSketchProjectionMetadata,
      clearSelection, deleteCurrentSelection, deleteElements, deleteSketch, setAppearanceForSelection: propertiesTestSupport.appearanceTestAction.set, version: persistenceComponents.version,
      copySelectionToClipboard, pasteGeometryClipboard, clipboard: clipboardFeature,
    });
    const selectionTestApi = createSelectionTestApi({
      sketchMoveCommand, blockEditor, blockSelection: blockSelectionQuery, blocks: blockEditingFeature, drawingFit: canvasScene.fit, canvasDriver: canvasTestDriver,
      decorateSerializedConstraint, serializeConstraint, serializeModel, resetModelState, resetHistory,
      canvasContextMenu, canvasContextController, canvasContextCandidatePresentation, canvas, viewport,
    });
    const parameterTestSupport = window.ParameterTestDriver.createForWorkspace({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, blocks: blockEditingFeature, blockSelection: blockSelectionQuery,
      insertion: constraintInsertion, placement: dimensionPlacement, presentation, resetModelState, stabilizeActiveParameterNamespace,
      resetHistory, serializeModel, clearSelection, canvasSelection, deleteElements, document,
    });
    const referenceImageTestSupport = window.ReferenceImageTestDriver.createForWorkspace({
      feature: referenceImageFeature, blocks: blockEditingFeature, canvasSelection, documentWorkspace, readHistory: readTestHistory, viewport,
      fetch, File, resetModelState, blockDefinition: blockDefinitionCommand, blockCompletion: blockCompletionCommand, serializeModel,
    });
    const derivedInstanceTestApi = window.DerivedInstanceTestDriver.createForWorkspace({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, interaction: canvasInteraction, presentation,
      canvasTestDriver, document, hatchGeometryQuery, sketchPresentation: canvasScene.sketchStyle, resetModelState, resetHistory,
      serializeModel, loadModelData, deleteElements, deleteCurrentSelection, normalizeGeometryInstance,
    });
    const clipboardTestSupport = window.ClipboardTestDriver.createForWorkspace({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, interaction: canvasInteraction,
      clipboard: clipboardFeature, blocks: blockEditingFeature, presentation, viewport, dimensionFromAnchor: dimensionPlacement.dimensionFromAnchor,
      readSelected: readTestSelectedGeometry, readHistory: readTestHistory, resetModelState, serializeModel, pushModelConstraint: constraintInsertion.push, resetHistory,
    });
    const drawingOrderTestApi = window.DrawingOrderTestDriver.createForWorkspace({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, interaction: canvasInteraction, presentation,
      blocks: blockEditingFeature, viewport, canvas, fit: canvasScene.fit, resetModelState, resetHistory, serializeModel, normalizeGeometryInstance,
      readHistory: readTestHistory, clearSelection, reorderSelectedDrawingObjects,
    });
    const hatchTestApi = window.HatchTestDriver.createForWorkspace({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, interaction: canvasInteraction, presentation,
      viewport, canvas, document, fit: canvasScene.fit, blocks: blockEditingFeature, blockSelection: blockSelectionQuery, clipboard: clipboardFeature,
      resetModelState, resetHistory, serializeModel, hitBlockInstance, hatchCommand, hatchRegionErrorText: authoringFeedback.hatchRegionErrorText, clearSelection,
    });
    const splineTestSupport = window.SplineTestDriver.createBrowserSupportForWorkspace({
      documentWorkspace, editingScope: editingScopeBinding, geometry: geometryCreation, readServices: geometryReadServices,
      interaction: canvasInteraction, presentation, splineEditing, blockSelection: blockSelectionQuery, blocks: blockEditingFeature,
      viewport, canvas, document, resizeCanvas: canvasWorkspaceLayout.resizeCanvas, resetModelState, resetHistory, serializeModel,
      pushModelConstraint: constraintInsertion.push, solveAndRefresh, serializeConstraint, annotationLeaderTargetFromItem,
      clearSelection, clipboard: clipboardFeature, pasteGeometryClipboard,
    });
    window.__jot2dTest = window.BrowserTestApi.createFromSupportRecords({
      canvas: { support: canvasTestSupport, responsiveDragFixture, dragExecutionSupport, canvasRenderProbe },
      splines: splineTestSupport,
      authoring: { hatchTestApi, drawingOrderTestApi, offsetTestSupport, trim: trimTestSupport },
      constraints: constraintBrowserSupport,
      clipboard: clipboardTestSupport,
      documents: documentTestSupport,
      derived: derivedInstanceTestApi,
      sketches: { sketchProjectionTestSupport, sketchTreeTestApi },
      images: referenceImageTestSupport,
      dimensions: dimensionTestSupport,
      parameters: parameterTestSupport,
      properties: propertiesTestSupport, selectionTestApi,
      annotations: annotationTestSupport,
      blocks: blockBrowserSupport,
    });
  }

  presentation.createCommandPanelsForEditing({
    host: canvas.parentElement, documentWorkspace, readServices: geometryReadServices, lifecycle: drawOperationLifecycle,
    projectionCommand: sketchProjectionCommand, geometryCommand: geometryInstanceCommand, sourceCommand: instanceSourceCommand,
    changeFreeProperty: changeFreeInstanceProperty, hatchCommand, annotationCommand, pngExportCommand,
  });

  createDocumentEditingReset({
    documentWorkspace, readServices: geometryReadServices, interaction: canvasInteraction, sessions: operationSessions, blocks: blockEditingFeature, constraints: constraintCommitCommand,
    sketchMoveCommand, editingScope: editingScopeBinding, flushPointerMoves: flushScheduledCanvasPointerMove, referenceImageRenderer,
    sketchSolving, referenceConstraintState, constraintAnalysis, clearSelection, geometryDrag, dimensionDrag,
    referenceImageInteraction, canvasNavigation, blankCanvasGesture, constructionCommand, documentCanvasReset,
    blockPlacementCommand, hatchCommand, sketchTreeView, annotationDrag,
  });

  installTestHooks();
  installExpressionInputHighlights(document);
  documentFileFeature.startForEmptyDocument({ resetModelState, initializePresentation });
})();
