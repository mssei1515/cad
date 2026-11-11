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
  const annotationPreparation = window.AnnotationFeature.prepare();
  const propertiesPreparation = window.PropertiesDisplay.prepare();
  const { createForEditing: createSelectionEditing, copy: copySelectionToClipboard,
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
  const { ROOT_SKETCH_ID, DEFAULT_SKETCH_ID } = window.SketchHierarchy;
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

  const { services: geometryReadServices, createEditingScope, createPersistence, createRebinding,
    persistence: documentPersistence } = createReadContext({
    currentSketches: () => editingScopeBinding.current.sketches,
    showHiddenElements: () => viewState.showHiddenElements, viewportScale: () => viewport.scale,
    profileRead: read => interactionProfiler.active ? profileInteractionWork("geometryReads", read) : read(),
  });
  const { serializeConstraint, decorateSerializedConstraint, serializeModel, ensureBlockState,
    loadModelData, normalizeGeometryInstance, readRepairMessage: readDocumentRepairMessage } = documentPersistence;
  const { catalog: blockCatalog, projections: blockProjections, reads: geometryReads,
    geometryAppearance, dimensionAppearance, hatches: hatchGeometryQuery } = geometryReadServices;
  const { resolveGeometryRef } = geometryReads;
  const blockLayout = geometryReadServices.createBlockLayout({ annotationBounds: annotationPreparation.annotationBounds });
  const sketchNavigation = window.SketchEditingFeature.prepareNavigation();
  const { clearInteractionForSketchChange, toggleSketchVisibility, isSidebarHighlightedElement } = sketchNavigation;
  const { binding: editingScopeBinding, solver, dimensionQueries: dimensionModelQueries, insertion: constraintInsertion } = createEditingScope({
    Solver: ConstraintSolver,
    closeSketchContext: sketchNavigation.closeContext, resetSketchMove: sketchNavigation.resetMove,
  });

  const { session: fileSession, createForWorkspace: createDocumentFileFeature } = window.DocumentFileFeature.prepare();

  const canvasInteraction = window.CanvasInteractionFeature.create({
    sketches: sketchContext, readServices: geometryReadServices, constraintReferencesPoint: constraintReferences.constraintReferencesPoint, editedFitPoints: () => splineEditing.current?.spline?.fitPoints,
    isGeometryMode, setHint, applicationText, clearSnap: () => clearSnap(), clearPointerPreview: () => drawingPreview.setPointer(null),
    clearSelection, updateGeometrySelectionUI, draw,
  });
  const { lifecycle: drawOperationLifecycle, selectionFeature, selection: canvasSelection, resetBlankCandidate,
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
    createContextForWorkspace: createSolveContext, solveAndRefresh } = window.SketchSolvingFeature.prepareWithReferencesForWorkspace({
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
  const { queries: sketchProjectionQueries, command: sketchProjectionCommand, sources: sketchProjectionSources,
    sketchProjectionShapeEditBlockedMessage } = sketchProjectionFeature;
  const { toggle: toggleSketchProjectionSource } = sketchProjectionCommand;
  const { createGeometry: createDrawingGeometry, createEditing: createDrawingEditing, createCenterline, createTrim, createSplineEditing,
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
    pointer: pointerInteractionController, createSelectionPresentation, createEditingInput: createCanvasEditingInput } = operationSessions;
  const constructionCommand = operationSessions.createConstruction({
    projection: sketchProjectionFeature, cancelConstraintTargetCommand, updateUI, recordHistory,
    synchronizeSketchProjectionMetadata: () => synchronizeSketchProjectionMetadata(), clearSnap: () => clearSnap(), updateToolbar,
  });
  const { highlight: selectionHighlight, clearing: selectionClearing, documentReset: documentCanvasReset } = createSelectionPresentation({
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
  const { editing: blockDefinitionEditing, session: blockEditor, queries: blockEditingQueries } = blockEditingFeature;

  const canvasRenderProbe = window.CanvasRenderProbe.createForScene({
    ctx, readServices: geometryReadServices, readGeometry: () => geometryDisplay, readDimensions: () => dimensionLayer,
  });
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
  const blockPlacementCommand = blockEditingFeature.createPlacement({
    layout: blockLayout, isGeometryMode, clearSelection,
    isPropertiesCollapsed: () => Boolean(document.querySelector(".workspace")?.classList.contains("properties-collapsed")),
    setPropertiesPanelCollapsed, solveAndRefresh, recordHistory,
  });
  const { start: startBlockPlacement,
    restorePropertiesPanel: restoreBlockPlacementPropertiesPanel } = blockPlacementCommand;
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
  const CURRENT_JSON_VERSION = 26;


  const pointerMoveScheduler = operationSessions.createMoveScheduler({
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (frame) => cancelAnimationFrame(frame),
    profilePhase: profileInteractionPhase, withGeometryReadCache: geometryReads.withGeometryReadCache,
    readInput: () => canvasInputBinding, syncDimensionValueInput: () => syncDimensionValueInput(),
  });
  const { flush: flushScheduledCanvasPointerMove } = pointerMoveScheduler;
  const { controls: canvasViewControls, canvasThemeColor, createForEditing: createCanvasDisplay } = window.CanvasDisplay.prepareForWorkspace({
    canvas, document, window, ctx, documentWorkspace, readServices: geometryReadServices,
    interaction: canvasInteraction, sessions: operationSessions, presentation,
  });
  const { state: viewState, constraintStatus: constraintStatusView } = canvasViewControls;

  const CONSTRUCTION_GEOMETRY_ALPHA = 0.72;
  const CONSTRAINT_ACCEPT_ERROR = 1e-4;
  const resultIsAccepted = window.SketchSolving.createResultAcceptance(CONSTRAINT_ACCEPT_ERROR);
  const constraintOperandFeature = selectionFeature.createConstraintOperands({
    targets: constraintTargetSession, pointer: pointerInteractionController, solver, acceptError: CONSTRAINT_ACCEPT_ERROR,
  });
  const { candidates: constraintCandidates, operands: constraintOperandValues,
    fromSelection: constraintOperandsFromSelection } = constraintOperandFeature;
  const { sameArcEndpoint } = constraintCandidates;
  const { operandElement } = constraintOperandValues;
  const MIN_LINE_LENGTH = Math.max(MIN_ORIENTATION_LENGTH, solver.minLineLength || 12);
  const geometryDragPreparation = window.GeometryDragFeature.prepare();
  const constrainedAnnotationDrag = createConstrainedAnnotationDrag({
    buildPlan: geometryDragPreparation.build, beginGeometryDrag: geometryDragPreparation.begin,
    invalidateAnalysis: () => constraintAnalysis.invalidate(),
  });
  const { scopeQuery: solveScopeQuery, analysis: constraintAnalysis, redundancy: constraintRedundancy, createSolving, createLineCollapseQuery } = createSolveContext({
    annotationDrag: constrainedAnnotationDrag, minimumLength: MIN_LINE_LENGTH, acceptError: CONSTRAINT_ACCEPT_ERROR,
  });
  const { viewport, navigation: canvasNavigation, createEditingWorkspace: createCanvasWorkspace, fitVisibleGeometryToViewport } = createCanvasDisplay({
    initialScale: CSS_PX_PER_MM, minLength: MIN_LINE_LENGTH,
    flushPointerMoves: pointerMoveScheduler.flush, syncDimensionValueInput: () => syncDimensionValueInput(),
  });
  const { transient: transientAuthoring, createCheckpoint: createEditingCheckpoint, geometryCheckpoint: authoringCheckpoint } = window.GeometryMutationFeature.prepareForWorkspace({
    documentWorkspace, readServices: geometryReadServices, interaction: canvasInteraction,
    history: historyFeature, analysis: constraintAnalysis, updateHistoryButtons,
  });
  const { surface: canvasSurface, exportRenderer: pngRendering, layout: canvasWorkspaceLayout, createSceneForEditing: createCanvasScene, createPlacementPreview,
    createInputBinding: createCanvasInputBinding, createPngExport, createDimensionTraversal, createDimensionPreview, drawDimensionPreview, dragPointer,
    dimensions: { display: dimensionDisplay, labels: { label: dimensionLabelForConstraint }, input: dimensionInput, element: dimensionValueInput } } = createCanvasWorkspace({
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
    constructionAlpha: CONSTRUCTION_GEOMETRY_ALPHA,
    sameArcEndpoint, arcEndpointPoint, fixedState: fixedStateQueries,
    editingQueries: { ...geometryDragPreparation.queries, editedSpline: () => splineEditing.current?.spline },
    annotationBounds: annotationPreparation.annotationBounds,
  });
  const { geometry: geometryDisplay, createHatchRendering } = canvasScene;
  const dimensionValueEditing = window.ConstraintEditing.prepareDimensionValues({
    workspace, sketches: sketchContext, bounds: canvasScene.bounds, minimumLineLength: MIN_LINE_LENGTH,
  });

  const { layer: hatchLayer, prepareFrame: prepareCanvasFrame } = createHatchRendering({
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
  const { drawAnnotationLeader } = annotationFeature.renderer;
  const referenceImageFeature = window.ReferenceImageFeature.createForWorkspace({
    canvas, ctx, viewport, document, window, withCanvasState: canvasSurface.withCanvasState, createImage: () => new Image(),
    documentWorkspace, editingScope: editingScopeBinding, interaction: canvasInteraction, presentation, appearance: geometryAppearance,
    clearSelection, clearSnap: () => clearSnap(), hitReferenceImageAt, recordHistory,
    pasteGeometry: pasteGeometryClipboard, copyGeometry: copySelectionToClipboard, isGeometryMode,
  });
  const { renderer: referenceImageRenderer, interaction: referenceImageInteraction, input: referenceImageInput } = referenceImageFeature;
  const { createFrame: createCanvasFrame } = prepareCanvasFrame();
  const MIN_ARC_LENGTH = MIN_LINE_LENGTH;
  const placementPreviewLayer = createPlacementPreview({
    geometry: geometryDisplay, annotations: annotationFeature.renderer, hatchLayer,
    blockPlacementCommand, geometryInstanceCommand, createBlockProjectionBundle: blockProjections.createBlockProjectionBundle,
  });
  const { geometry: geometryCreation, createAuthoringForEditing: createAuthoringTools } = createDrawingGeometry({
    currentScope: workspace.current, ids: geometryIds, assignSketchId: sketchContext.assignSketchId, currentConstruction: () => constructionCommand.enabled,
    minLineLength: MIN_LINE_LENGTH, minArcLength: MIN_ARC_LENGTH,
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
  const { line: lineCommand, circular: circularCommands } = basicDrawingTools;
  const offsetFeature = authoringTools.createOffsetForEditing({
    editingScope: editingScopeBinding, placement: dimensionPlacement, sourceSelection: offsetSelection,
    valueInput: dimensionInputController, ctx, surface: canvasSurface, drawDimension,
    commitNewConstraint, offsetChainErrorText: authoringFeedback.offsetChainErrorText, analysis: constraintAnalysis,
  });
  const { command: offsetCommand, previewLayer: offsetPreviewLayer, chainDraft: offsetChainDraft } = offsetFeature;
  const { submit: submitOffsetValue } = offsetCommand;
  const editingCheckpoint = createEditingCheckpoint();
  const { dimensions: { serialize: serializeDimension },
    ensureDimensionDefaults, createApplication: createDocumentApplication } = createPersistence({
    placement: dimensionPlacement, pointUsage, readEditingScope: () => editingScopeBinding.current, readBlockEditor: () => blockEditor.current,
    version: CURRENT_JSON_VERSION, constraintReferencesPoint: constraintReferences.constraintReferencesPoint, separateSharedSketchProjectionTargetPoints, normalizeArcSweeps: geometryCreation.normalizeArcSweeps,
  });
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
  const { effectiveDocumentName, refreshStatus: updateDocumentNameUI, markCheckpoint: markDocumentFileCheckpoint } = documentFileFeature;






  const { controller: annotationInputController, commitParameterEdit: commitAnnotationParameterEdit } = annotationPreparation.createEditorForCheckpoint({
    document, host: canvas.parentElement, checkpoint: editingCheckpoint, guardDimensionSymbolDeletion,
    stabilize: stabilizeDocumentParameters,
  });

  function isGeometryMode() {
    return true;
  }







  function hitReferenceImageAt(...args) { return regionHitQuery.hitReferenceImageAt(...args); }










  const sceneHitInteraction = operationSessions.createSceneWithAnnotations({
    documentWorkspace, viewport, dimensionScope: dimensionPresentationScope, dimensions: dimensionDisplay, dimensionLabelForConstraint,
    annotationBounds: annotationPreparation.annotationBounds, annotationSpatial: annotationFeature.spatial, operandValues: constraintOperandValues,
  });
  const { policy: { ordinarySelectionMode }, hitAnnotationElement } = sceneHitInteraction;
















  function refreshConstraintAnalysis(options = {}) { return constraintAnalysis.refresh(options); }















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
  const { definition: blockDefinitionCommand, completion: blockCompletionCommand, createView: createBlockView, updateView: updateBlockView } = blockEditingFeature.createCommandsWithView({
    isGeometryMode, selectionQuery: blockSelectionQuery, guardDimensionSymbolDeletion, prepareBlocks: ensureBlockState,
    resetBlockEditorHistory, clearSelection, drawingFit: canvasScene.fit, recordHistory,
    referenceState: referenceConstraintState, solving: sketchSolving, resultIsAccepted, choiceDialog,
    blockLocalGeometryBounds: blockLayout.blockLocalGeometryBounds, references: constraintReferences, acceptError: CONSTRAINT_ACCEPT_ERROR, solveState: sketchSolveResultState,
  });
  const { open: openBlockDefinitionEditor, enter: enterBlockDefinitionEdit } = blockDefinitionCommand;
  const { complete: completeBlockDefinitionEdit } = blockCompletionCommand;


  function resetModelState() { return documentEditingReset.reset(); }


















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



  function clearSelection() { return selectionClearing.clear(); }

  authoringTools.createLifecycle({ interaction: canvasInteraction,
    instances: geometryInstanceCommand, instanceSources: instanceSourceCommand, centerline: centerlineCommand,
    fillet: filletCommand, offset: offsetSelection, hatch: { reset: () => hatchCommand.reset() },
  });



  function setPropertiesPanelCollapsed(...args) { return canvasWorkspaceLayout.setPropertiesPanelCollapsed(...args); }






























  const sceneHitQueries = sceneHitInteraction.createQueries();
  const { regions: regionHitQuery, hitDimension, hitBlockInstance, hitConstraintOperand } = sceneHitQueries;
  const { hitSketchIdentityElement, hitEndpointPoint, hitExplicitPoint, hitPoint, hitLine, hitCircle, hitArc, hitArcEndpoint, hitSpline } = sceneHitQueries.geometry;













































  const { deletion: deletionFeature, clipboard: clipboardFeature } = createSelectionEditing({
    documentWorkspace, editingScope: editingScopeBinding, readServices: geometryReadServices, interaction: canvasInteraction,
    references: constraintReferences, annotationFeature, annotationLeaderAnchor,
    splineEditing, guardDimensionSymbolDeletion, geometry: geometryCreation, sessions: operationSessions, lineCommand, circularCommands,
    solving: sketchSolving, analysis: constraintAnalysis, presentation, updateToolbar, recordHistory,
    referenceImageInteraction, clearSelection, solveAndRefresh,
    resetGeometryDrag: geometryDragPreparation.reset, resetDimensionDrag: () => dimensionDrag.reset(), resetAnnotationDrag: annotationPreparation.resetDrag,
    viewport, persistence: documentPersistence, normalizeGeometryInstance, blocks: blockEditingFeature,
    imageClipboard, isGeometryMode,
  });
  const { remove: deleteElements, removeSelection: deleteCurrentSelection } = deletionFeature;
  const { session: clipboardSession, copyableSelectionPayload } = clipboardFeature;


  const { selectionBounds: dimensionSelectionBounds, layer: dimensionLayer } = createDimensionTraversal({
    currentScope: dimensionPresentationScope, readDraggedDimension: () => dimensionDrag.constraint, dimensionUsesExpression,
  });

  const { query: rectangleSelectionQuery, rectangle: selectionRectangle } = sceneHitInteraction.createRectangleSelection({
    dimensionBounds: dimensionSelectionBounds, instanceSourceCommand, geometryInstanceCommand, sketchProjection: sketchProjectionFeature,
    canvas, clearSelection, presentation,
  });
















  const { frame: canvasFrameRenderer, overlays: { drawSelectionRect } } = createCanvasFrame({
    rectangle: selectionRectangle, snap: drawingSnap, pointer: pointerInteractionController,
    recordDraw: () => pointerMoveScheduler.recordDraw(), referenceImageLayer: referenceImageFeature.layer, readPngCommand: pngExportLifecycle.readCommand,
    dimensions: dimensionLayer, drawDimensionPreview, annotations: annotationLayer,
    authoringPreview: authoringPreviewLayer, placements: placementPreviewLayer, offsetPreview: offsetPreviewLayer,
  });

  function drawCanvas() { return canvasFrameRenderer.draw(); }







































  const annotationDrag = annotationPreparation.createDragForEditing({
    constrained: constrainedAnnotationDrag, pointer: dragPointer,
  });

  createDimensionPreview({ drawFilletPreviewArc });
















  const { selection: propertiesSelection,
    createEditingWithViewForWorkspace: createPropertiesForEditing } = propertiesPreparation.createForWorkspace({
    document, documentWorkspace, readServices: geometryReadServices, interaction: canvasInteraction, presentation,
    operations: { sources: instanceSourceCommand, placement: geometryInstanceCommand, blocks: blockPlacementCommand },
  });
  const { visibilityIsHidden: selectionVisibilityIsHidden,
    selectedDisplayTarget: selectedPropertiesTarget } = propertiesSelection;

  createToolbarControls({ selection: propertiesSelection, sketches: sketchContext });

  const { selectionQuery: constraintSelectionQuery, targets: constraintTargetCommand, dimensions: dimensionPlacementCommand,
    createCommitWithIntentForWorkspace: createConstraintCommit, createFixedForWorkspace, constraintTargetHint, readOnlyDimensions,
    input: { updateHover: updatePendingDistanceRetargetHover, createWithDraggingForWorkspace: createConstraintInputWithDragging },
    controls: { createBinding: createConstraintControlBinding } } = createConstraintEditing({
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

  const { view: sketchTreeView } = sketchEditing.createTreeForEditing({
    document, window, selectionHighlight,
    objectOptions: { isHidden: selectionVisibilityIsHidden, analysis: constraintAnalysis, redundancy: constraintRedundancy,
      referenceState: referenceConstraintState, projectionQueries: sketchProjectionQueries,
      toolbarSvgMarkup: toolbarIcons.toolbarSvgMarkup, constraintToolbarIcon: toolbarIcons.constraintToolbarIcon, findLineFixedConstraint, geometryInstanceTypeLabel: authoringFeedback.geometryInstanceTypeLabel, hatchPatternTypeLabel: authoringFeedback.hatchPatternTypeLabel },
    escapeHtml, closeCanvasContextMenu, moveCommand: sketchMoveCommand, deletion: sketchDeletionCommand,
    blockEditor, editingScope: editingScopeBinding, solveState: sketchSolveResultState, dimensionScope: dimensionPresentationScope,
    deleteElements, deleteCurrentSelection, toggleSelectedVisibility: propertiesPreparation.toggleSelectedVisibility, fixedOperands: fixedOperandCommand,
  });
  const { applyWidth: applySketchTreeWidth } = sketchTreeView;
  sketchNavigation.startContext();






















  const blockView = createBlockView({ document, escapeHtml, startBlockPlacement });

  function updateBlockUI() { updateBlockView(); }

  const expressionInputController = parameterEditor.createReferenceInput({
    TextAreaElement: HTMLTextAreaElement, currentNamespace: () => editingScopeBinding.current, dimensionValueInput, pendingCommandSession,
    canvas, canvasPoint: viewport.canvasPoint, hitDimension, hitAnnotationElement,
  });











  const { appearanceUI } = createPropertiesForEditing({
    editingScope: editingScopeBinding, viewport, checkpoint: editingCheckpoint, parameters: parameterStabilization,
    projection: sketchProjectionFeature, projectionEditing: sketchProjectionEditing, annotationFeature,
    isGeometryMode, toggleSketchVisibility, recordHistory, escapeHtml,
  }, () => ({
    analysis: constraintAnalysis, selectionHighlight, snappedBlockRotation: blockLayout.snappedBlockRotation, hatchRegionErrorText: authoringFeedback.hatchRegionErrorText,
    geometryInstanceTypeLabel: authoringFeedback.geometryInstanceTypeLabel, installExpressionInputHighlights,
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








  const geometryDragFeature = geometryDragPreparation.createForWorkspace({
    documentWorkspace, interaction: canvasInteraction, presentation, sourceQueries: derivedDragQueries, projectionQueries: sketchProjectionQueries,
    solver, scopeQuery: solveScopeQuery, solving: sketchSolving,
    checkpoint: editingCheckpoint, geometry: geometryCreation, readServices: geometryReadServices,
    viewport, pointer: dragPointer, acceptError: CONSTRAINT_ACCEPT_ERROR,
    minimumLength: MIN_ORIENTATION_LENGTH,
    blockLocalGeometryBounds: blockLayout.blockLocalGeometryBounds, fixedState: fixedStateQueries,
    projectionBlockedMessage: () => sketchProjectionShapeEditBlockedMessage(applicationText("ドラッグ", "Drag")),
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

  const { presentCandidate: canvasContextCandidatePresentation, createInteraction: createCanvasContextInteraction } = createCanvasContextScene({
    sceneQueries: sceneHitQueries, splineEditing, canvasContextAnnotationHit, sessions: operationSessions,
    icons: toolbarIcons, feedback: authoringFeedback,
  });












  const canvasCommandCancellation = operationSessions.createCommandCancellation({
    instances: geometryInstanceCommand, constraints: constraintTargetCommand, blockPlacementCommand, restoreBlockPlacementPropertiesPanel, updateUI,
  });


  const { topmostOwner: topmostDrawingOrderOwner, state: drawingOrderCommandState, reorder: reorderSelectedDrawingObjects } = selectionFeature.createDrawingOrder({
    editingScope: editingScopeBinding, ordinarySelectionMode, updateUI, recordHistory,
  });














  createCanvasContextInteraction({
    constraintSelection: constraintSelectionQuery, blockQueries: blockEditingQueries, dimensions: dimensionDragFeature,
    cancellation: canvasCommandCancellation, clipboard: clipboardFeature, history: historyController,
    viewport, projection: sketchProjectionCommand,
    sameArcEndpoint, clearSelection, findLineFixedConstraint, findArcEndpointFixedConstraint,
    visibleGeometryBounds: canvasScene.bounds.visibleGeometryBounds, drawingOrderCommandState, handleConstraintOperandClick, isGeometryMode,
    closeAppMenus: () => closeAppMenus(),
    copySelectionToClipboard, imageClipboard,
    showSelectedObjectProperties: canvasWorkspaceLayout.showSelectedObjectProperties, fixPointBtn, enterBlockDefinitionEdit,
    setBlockInstanceRotationLocked, startDimensionEditInput, recordHistory, sketchMoveCommand,
    startHatchBoundaryRepair, reorderSelectedDrawingObjects, fitVisibleGeometryToViewport,
  });
  canvasContextController.start();

  const canvasEditingInput = createCanvasEditingInput({
    document, canvas, updateUI,
    annotationFeature, annotationDrag, constraintInputFeature, dimensionDragging: dimensionDragFeature,
    constraintTargetHint,
    instanceSourceCommand, geometryInstanceCommand, sceneQueries: sceneHitQueries, operandElement, toggleSketchProjectionSource,
    selectionRectangle, viewport, transientAuthoring, authoring: authoringTools,
    drawingCommands: { centerline: centerlineCommand, circleCenterCross: circleCenterCrossCommand, fillet: filletCommand, trim: trimFeature, offset: offsetCommand },
    sameArcEndpoint, topmostDrawingOrderOwner, drawingOrderOwner, geometryDragging: geometryDragFeature, blockDragging, referenceImage: referenceImageInteraction,
  });

  const { blankGesture: blankCanvasGesture, createBinding: createCanvasPointerBinding } = canvasEditingInput.preparePointerForEditing({
    splineEditing, dimensionValues: dimensionValueCommand, annotationInput: annotationInputController,
  });

  const canvasInputBinding = createCanvasPointerBinding({
    canvasNavigation, recordHistory,
    updatePendingDistanceRetargetHover, hitDimension, hitSketchIdentityElement,
    hatch: hatchCommand, spline: splineCommand, blockPlacement: blockPlacementCommand, dimensions: dimensionPlacementCommand,
    expressions: expressionInputController, discardMoves: flushScheduledCanvasPointerMove, enterBlock: enterBlockDefinitionEdit,
    closeContextMenu: closeCanvasContextMenu, hitAnnotationTarget,
    createCanvasInputBinding, readPngExportCommand: pngExportLifecycle.readCommand, scheduler: pointerMoveScheduler,
  });
  canvasInputBinding.bind();
  dimensionInput.bind();

  const keyboardInput = canvasEditingInput.createKeyboard({
    window, menus: { closeSketch: sketchNavigation.closeContext,
      canvasVisible: () => canvasContextMenu && !canvasContextMenu.hidden, closeCanvas: closeCanvasContextMenu },
    sketchMove: sketchMoveCommand, constraintStatusView, dimensionInput: dimensionInputController,
    shortcuts: window.KeyboardInput.createWorkspaceShortcuts({ files: documentFileFeature, history: historyController,
      copy: copySelectionToClipboard, paste: pasteGeometryClipboard }),
    projection: sketchProjectionCommand, constraints: constraintTargetCommand, spline: splineCommand, hatch: hatchCommand,
    splineEditing, blockPlacement: blockPlacementCommand, deleteSelection: deleteCurrentSelection,
  });
  keyboardInput.start();
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
  workspaceControls.start();

  const drawingToolBinding = workspaceControls.createDrawingBinding();
  drawingToolBinding.bind();

  documentFileFeature.bindControls();
  const { command: pngExportCommand } = createPngExport({
    documentName: effectiveDocumentName, prepareImages: referenceImageFeature.prepareImages,
    fileSession, pngExport: pngExportLifecycle,
    findSnap: (point, tolerance) => drawingSnap.find(point, tolerance), flushPointerMove: flushScheduledCanvasPointerMove,
  });
  pngExportLifecycle.start();
  dxfImportFeature.bindControls({ flushScheduledCanvasPointerMove });
  referenceImageInput.bindControls();
  sketchTreeView.bindCreation(createSketch);

  window.SidebarController.create({ document, setHint }).bind();



  createFixedSelection({
    checkpoint: editingCheckpoint, insertion: constraintInsertion, solving: sketchSolving,
    acceptError: CONSTRAINT_ACCEPT_ERROR, refreshConstraintAnalysis, recordHistory,
  });

  const constraintControlBinding = createConstraintControlBinding();
  constraintControlBinding.bind();



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
    const { execution: dragExecutionSupport, createResponsiveForEditing: createResponsiveDragFixture } = window.GeometryDragTestDriver.createForWorkspace({
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
    const canvasTestSupport = window.CanvasTestDriver.createBrowserSupportForScene({
      document, canvas, viewport, documentWorkspace, readServices: geometryReadServices, geometry: geometryCreation,
      interaction: canvasInteraction, sessions: operationSessions, presentation,
      authoring: { tools: basicDrawingTools, snap: drawingSnap, offsetSelection },
      display: canvasScene, ctx, selectionRectangle,
      layers: { authoringPreviewLayer, offsetPreviewLayer, placementPreviewLayer },
      blocks: { createEmptyBlockDefinition: blockDefinitionEditing.empty, blockPlacementCommand, drawBlockInstanceHandles: geometryDisplay.drawBlockInstanceHandles },
      drawSelectionRect, drawAnnotationLeader, resizeCanvas: canvasWorkspaceLayout.resizeCanvas, resetModelState, rootSketchId: ROOT_SKETCH_ID, defaultSketchId: DEFAULT_SKETCH_ID,
      cssPxPerMm: CSS_PX_PER_MM, types: window.GeometrySolver, evaluateSpline: window.SplineGeometry.evaluate,
      hits: { hitArcEndpoint, hitPoint, hitLine, hitCircle, hitArc, hitSpline, hitDimension },
      observations: { viewControls: canvasViewControls, centerlineCommand, commit: constraintCommitCommand,
        persistence: documentPersistence, readSelectedGeometry: readTestSelectedGeometry, scheduler: pointerMoveScheduler },
    });
    const { display: canvasTestDriver } = canvasTestSupport;
    const propertiesTestSupport = window.PropertiesTestDriver.createBrowserSupport({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, interaction: canvasInteraction, blockQueries: blockEditingQueries,
      selectionHighlight, presentation, display: geometryDisplay, placement: dimensionPlacement, viewport, document, canvas, fixPointBtn,
      readHistory: readTestHistory, resetModelState, clearSelection, resetHistory, fitAllGeometryToViewport: canvasScene.fit.fitAllGeometryToViewport, pushModelConstraint: constraintInsertion.push,
      assignConstraintSketchId: constraintInsertion.assignSketch, recordHistory, canvasThemeColor, isSidebarHighlightedElement, selectedPropertiesTarget,
      findLineFixedConstraint, constructionAlpha: CONSTRUCTION_GEOMETRY_ALPHA,
    });
    const sketchTreeTestApi = window.SketchTreeTestDriver.createForWorkspace({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, interaction: canvasInteraction, presentation,
      sketchPresentation: canvasScene.sketchStyle, overlay: canvasScene.overlay, viewport, canvasDriver: canvasTestDriver, drawingFit: canvasScene.fit, blocks: blockEditingFeature, dimensionDisplay,
      referenceState: referenceConstraintState, document, canvas, getComputedStyle: element => getComputedStyle(element),
      serializeModel, resetModelState, addDistanceConstraintFromTarget, dimensionLayout, blockInstanceDisplayCenter: blockLayout.blockInstanceDisplayCenter,
    });
    const blockTestSupport = window.BlockTestDriver.createForWorkspace({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, blocks: blockEditingFeature,
      interaction: canvasInteraction, sessions: operationSessions, presentation, placement: blockPlacementCommand, solver, canvas, viewport,
      solving: sketchSolving, definition: blockDefinitionCommand, completion: blockCompletionCommand, configuration: blockConfigurationCommand,
      sketchEditing, dragging: geometryDragFeature, selectionQuery: blockSelectionQuery,
      resetModelState, pushModelConstraint: constraintInsertion.push, fitAllGeometryToViewport: canvasScene.fit.fitAllGeometryToViewport, recordHistory, serializeConstraint, serializeModel, loadModelData, blockInstanceDisplayCenter: blockLayout.blockInstanceDisplayCenter,
    });
    const blockTestActions = blockTestSupport.createDimensionCases({
      defaultDimensionForTarget: dimensionPlacement.defaultDimensionForTarget, readOnlyDimensionConstraintForPlacement: readOnlyDimensions.forPlacement,
      addReadOnlyDimensionConstraint: readOnlyDimensions.add, blockDefinitionById: blockCatalog.blockDefinitionById,
    });
    const dimensionTestSupport = window.DimensionTestDriver.createBrowserSupportForWorkspace({
      documentWorkspace, interaction: canvasInteraction, sessions: operationSessions,
      geometry: geometryCreation, display: dimensionDisplay, appearance: geometryAppearance,
      viewport, resetModelState, addDistanceConstraintFromTarget,
      dimensions: dimensionPlacementCommand, serializeModel, serializeDimension,
      dimensionValueInput, ctx, layer: dimensionLayer, dimensionLabelForConstraint,
    }, {
      canvasDriver: canvasTestDriver, dimensionValues: dimensionValueCommand, clearSelection, presentation, fit: canvasScene.fit, references: constraintReferences, canvas,
      solving: sketchSolving, checkpoint: editingCheckpoint, analysis: constraintAnalysis, dimensionDrag,
    }, dimensionAppearance);
    const responsiveDragFixture = createResponsiveDragFixture({
      insertion: constraintInsertion, presentation, fit: canvasScene.fit, modelTypes: window.GeometrySolver,
      resetModelState, ensureDimensionDefaults, solveAndRefresh, resetHistory, serializeModel,
    });
    const offsetTestSupport = window.OffsetTestDriver.createForWorkspace({
      documentWorkspace, geometry: geometryCreation, insertion: constraintInsertion, offset: offsetFeature, sourceSelection: offsetSelection,
      solvePreparation: constraintSolvePreparation, solving: sketchSolving, checkpoint: editingCheckpoint, sessions: operationSessions, presentation, viewport,
      resetModelState, serializeModel, loadModelData, clearSelection, fitAllGeometryToViewport: canvasScene.fit.fitAllGeometryToViewport, resetHistory, solveAndRefresh, canvas, document,
    });
    const sketchProjectionTestSupport = window.SketchProjectionTestDriver.createForWorkspace({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, interaction: canvasInteraction, projection: sketchProjectionFeature,
      display: geometryDisplay, sketchPresentation: canvasScene.sketchStyle, analysis: constraintAnalysis, redundancy: constraintRedundancy, presentation, canvasDriver: canvasTestDriver,
      history: historyController, solving: sketchSolving, blocks: blockEditingFeature, blockDefinition: blockDefinitionCommand, blockCompletion: blockCompletionCommand, blockSelection: blockSelectionQuery,
      document, readHistory: readTestHistory, resetModelState, serializeModel, loadModelData, markReferenceConstraint, pushModelConstraint: constraintInsertion.push, synchronizeSketchProjectionMetadata,
      clearSelection, deleteCurrentSelection, deleteElements, deleteSketch, setAppearanceForSelection: propertiesTestSupport.appearanceTestAction.set, version: CURRENT_JSON_VERSION,
      copySelectionToClipboard, pasteGeometryClipboard, clipboardSession,
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
    const referenceImageTestSupport = window.ReferenceImageTestDriver.createBrowserSupport({
      feature: referenceImageFeature, blocks: blockEditingFeature, canvasSelection, currentScope: workspace.current, readHistory: readTestHistory, viewport,
      fetch, File, resetModelState, openBlockDefinitionEditor, completeBlockDefinitionEdit, serializeModel,
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
    const splineTestSupport = window.SplineTestDriver.createForWorkspace({
      documentWorkspace, editingScope: editingScopeBinding, geometry: geometryCreation, readServices: geometryReadServices,
      interaction: canvasInteraction, presentation, splineEditing, blockSelection: blockSelectionQuery, blocks: blockEditingFeature,
      viewport, canvas, document, resizeCanvas: canvasWorkspaceLayout.resizeCanvas, resetModelState, resetHistory, serializeModel,
      pushModelConstraint: constraintInsertion.push, solveAndRefresh, serializeConstraint, annotationLeaderTargetFromItem,
      clearSelection, copyableSelectionPayload, clipboardSession, pasteGeometryClipboard,
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
      blocks: { blockTestSupport, blockTestActions },
    });
  }

  presentation.createCommandPanelsForEditing({
    host: canvas.parentElement, documentWorkspace, readServices: geometryReadServices, lifecycle: drawOperationLifecycle,
    projectionCommand: sketchProjectionCommand, geometryCommand: geometryInstanceCommand, sourceCommand: instanceSourceCommand,
    changeFreeProperty: changeFreeInstanceProperty, hatchCommand, annotationCommand, pngExportCommand,
  });

  const documentEditingReset = window.DocumentEditingReset.createForWorkspace({
    documentWorkspace, readServices: geometryReadServices, interaction: canvasInteraction, sessions: operationSessions, blocks: blockEditingFeature, constraints: constraintCommitCommand,
    sketchMoveCommand, editingScope: editingScopeBinding, flushPointerMoves: flushScheduledCanvasPointerMove, referenceImageRenderer,
    sketchSolving, referenceConstraintState, constraintAnalysis, clearSelection, geometryDrag, dimensionDrag,
    referenceImageInteraction, canvasNavigation, blankCanvasGesture, constructionCommand, documentCanvasReset,
    blockPlacementCommand, hatchCommand, sketchTreeView, annotationDrag,
  });

  installTestHooks();
  installExpressionInputHighlights(document);
  resetModelState();
  initializePresentation("空の新規Documentを作成しました");
  resetHistory("起動");
  markDocumentFileCheckpoint("new");
  documentFileFeature.start();
})();
