/* Application composition, editing commands, Canvas UI and event handling. */
(function () {
  "use strict";
  const { formatDisplayNumber } = window.NumberDisplay;
  const { escapeHtml } = window.HtmlText;
  const { serializeHatch, hatchAppearanceForDisplay } = window.HatchData;

  const {
    CSS_PX_PER_MM, DEFAULT_HATCH_APPEARANCE, DEFAULT_ANNOTATION_STYLE,
  } = window.Appearance;
  const {
    drawingOrderOwner,
  } = window.DrawingOrder;

  const {
    MIN_ORIENTATION_LENGTH,
    arcEndpointPoint,
    signedPointLineDistance,
  } = window.GeometryKernel;

  const { id: geometryRefId } = window.GeometryRef;



  const {
    vectorNorm,
    Point,
    Line,
    PointOnSplineConstraint,
    SplineLineTangentConstraint,
    ConstraintSolver,
  } = window.GeometrySolver;

  const { referencesRemovedGeometry: annotationReferencesRemovedGeometry } = window.AnnotationAnchorData;
  const constraintReferences = window.ConstraintReferences.create({ resolveGeometryRef: (ref) => resolveGeometryRef(ref) });
  const {
    constraintReferencesPoint,
    constraintGraphNodes,
  } = constraintReferences;

  const {
    isDimensionConstraint,
  } = window.DimensionQueries;

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  let pngExportCommand = null;
  const presentation = window.PresentationFeature.create({
    document, storage: () => localStorage, refreshVersion: () => runtimeVersionView.render(), readDuplicateCount: () => constraintRedundancy.count,
  });
  const { settings: applicationSettings, profiler: interactionProfiler, constraintFeedback,
    log, setHint, updateUI, updateGeometrySelectionUI, draw } = presentation;
  const { work: profileInteractionWork, phase: profileInteractionPhase } = interactionProfiler;
  const { applicationText, localizeApplicationUI } = applicationSettings;
  const { hatchRegionErrorText, offsetChainErrorText, hatchPatternTypeLabel, geometryInstanceTypeLabel } = window.AuthoringFeedback.create({ applicationText });
  const { ROOT_SKETCH_ID, DEFAULT_SKETCH_ID } = window.SketchHierarchy;
  const documentWorkspace = window.DocumentWorkspace.create({
    applicationText, constraintGraphNodes, nextHatchIndex: () => editingScopeBinding.current.nextHatchIndex,
  });
  const { document: documentModel, workspace, parameters: parameterNamespace, sketches: sketchContext,
    geometryIds, documentIds, reservation: idReservation, createReadContext } = documentWorkspace;
  const currentParameterNamespace = workspace.current;
  const { guard: guardDimensionSymbolDeletion } = window.ParameterApplication.createDeletionGuard({
    currentNamespace: currentParameterNamespace, symbolDeletionDependents: parameterNamespace.symbolDeletionDependents,
    readLanguage: () => applicationSettings.language, setHint, log,
  });
  const {
    evaluateEditingExpressionDraft: evaluateDimensionExpressionDraft,
    dimensionUsesExpression, expressionInputValue, expressionFromUserInput,
    ensureParameterNamespace,
  } = parameterNamespace;
  const parameterEditor = window.ParameterEditor.createForWorkspace({
    document, window, documentWorkspace, currentScope: () => editingScopeBinding.current, readBlockEditor: () => blockEditor.current,
    settings: applicationSettings, applyDraft: (...args) => parameterApplication.apply(...args),
    recordHistory, setHint, updateUI, draw, pickDimension: event => expressionInputController.pickCanvas(event),
  });
  const { syncExpressionInputHighlight, installExpressionInputHighlights } = parameterEditor;
  const {
    isRootSketch,
    isReferenceSourceSketchId,
    activeSketchId, assignSketchId,
    elementSketchId, canEditSketch,
    constraintSketchId,
  } = sketchContext;

  const { geometryRefForItem, geometryKeyForItem: geometryElementKey } = window.GeometryObjects;
  const { services: geometryReadServices, createEditingScope, createPersistence } = createReadContext({
    currentSketches: () => editingScopeBinding.current.sketches, prepareBlocks: ensureBlockState,
    showHiddenElements: () => viewState.showHiddenElements, viewportScale: () => viewport.scale,
    profileRead: read => interactionProfiler.active ? profileInteractionWork("geometryReads", read) : read(),
  });
  const { instances: instanceProjections, catalog: blockCatalog, projections: blockProjections, reads: geometryReads,
    geometryAppearance, dimensionAppearance, hatches: hatchGeometryQuery } = geometryReadServices;
  const { isVisibleSketchElement } = geometryAppearance;
  const { hatchPrimitivesForScope } = hatchGeometryQuery;
  const { geometryInstanceBundlesForScope } = instanceProjections;
  const { blockDefinitionById, blockDefinitionDrawableSketchIds } = blockCatalog;
  const { blockWorldPoint, createBlockProjectionBundle, blockProjectionBundle, invalidateBlockProjectionCache } = blockProjections;
  const { withGeometryReadCache, blockProjectionBundles, geometryInstanceBundles, geometryInstanceBundle, allAnnotations, allHatches, resolveGeometryRef } = geometryReads;
  function annotationBounds(...args) { return annotationFeature.spatial.annotationBounds(...args); }
  const { blockLocalGeometryBounds, blockInstanceDisplayCenter, blockInstanceTranslationForAnchor, snappedBlockRotation } = window.BlockLayout.create({
    catalog: blockCatalog, projections: blockProjections, instanceProjections, annotationBounds, hatchPrimitivesForScope,
  });
  let sketchMoveCommand = null;
  let sketchContextController = null;
  const { binding: editingScopeBinding, solver, dimensionQueries: dimensionModelQueries, insertion: constraintInsertion } = createEditingScope({
    Solver: ConstraintSolver,
    closeSketchContext: () => sketchContextController?.close(), resetSketchMove: () => sketchMoveCommand?.reset(),
  });
  function activateEditingScope(...args) { return editingScopeBinding.activate(...args); }

  const { assignSketch: assignConstraintSketchId, push: pushModelConstraint } = constraintInsertion;
  const { session: fileSession, createForWorkspace: createDocumentFileFeature } = window.DocumentFileFeature.prepare();

  const canvasInteraction = window.CanvasInteractionFeature.create({
    sketches: sketchContext, readServices: geometryReadServices, constraintReferencesPoint, editedFitPoints: () => splineEditing.current?.spline?.fitPoints,
    isGeometryMode, setHint, applicationText, clearSnap: () => clearSnap(), clearPointerPreview: () => drawingPreview.setPointer(null),
    clearSelection, updateGeometrySelectionUI, draw,
  });
  const { lifecycle: drawOperationLifecycle, selectionFeature, selection: canvasSelection,
    pointUsage, hover: canvasHover, createOperationSessions } = canvasInteraction;
  presentation.bindUI({
    syncAnnotationResize: () => annotationDrag.syncResizeSelection(drawOperationLifecycle.mode === "select" && !pendingCommandSession.current && !constraintTargetSession.command),
    prepareParameterNamespace: () => ensureParameterNamespace(currentParameterNamespace()),
    refreshConstraintAnalysis, updateDocumentName: () => updateDocumentNameUI(), updateToolbar,
    renderSketch: () => sketchTreeView.render(), updateBlockUI,
    renderProperties: () => propertiesView.render(selectedPropertiesTarget()), readSketchMoving: () => sketchMoveCommand.active,
    updateStatusUI, updateConstraintButtons, syncDimensionInput: () => syncDimensionValueInput(),
    refreshSketchSelection: () => sketchTreeView.refreshSelection(),
  });
  const { controller: canvasContextController, element: canvasContextMenu, createSceneForEditing: createCanvasContextScene } = window.CanvasContextInteraction.createMenu({
    document, window, canvas, escapeHtml, applicationText, canvasHover, draw,
    readPresentation: () => canvasContextCandidatePresentation, readInteraction: () => canvasContextInteraction,
  });
  const closeCanvasContextMenu = canvasContextController.close;
  const { dragSources: derivedDragQueries, createCommands: createDerivedCommands } = window.DerivedInstanceFeature.createForEditing({
    documentWorkspace, readServices: geometryReadServices, references: constraintReferences, interaction: canvasInteraction, editingScope: editingScopeBinding, presentation,
  });

  const { targets: annotationTargets, createConstrainedDrag: createConstrainedAnnotationDrag, createFeature: createAnnotationFeature } = window.AnnotationFeature.prepareForWorkspace({
    documentWorkspace, readServices: geometryReadServices, interaction: canvasInteraction, presentation, viewportScale: () => viewport.scale,
  });
  const { hitAnnotationTarget, annotationLeaderTargetFromItem, annotationLeaderAnchor } = annotationTargets;
  const referenceConstraintState = window.ReferenceConstraintState.create({
    currentScope: workspace.current, constraintSketchId, isReferenceSourceSketchId,
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
    guardSketchProjectionShapeEdit, sketchProjectionShapeEditBlockedMessage } = sketchProjectionFeature;
  const { start: startSketchProjectionCommand, toggle: toggleSketchProjectionSource } = sketchProjectionCommand;
  const operationSessions = createOperationSessions({
    snapForDrawing, linePreviewPoint: (point, shiftKey) => lineCommand.previewPoint(point, shiftKey),
    readCenterline: () => centerlineCommand, projectPointToCenterlineSupport: point => projectPointToCenterlineSupport(point),
    readOffsetSelection: () => offsetSelection, computeTrimPreview,
    hits: { hitPoint: (x, y) => hitPoint(x, y), hitLine: (x, y) => hitLine(x, y),
      hitCircle: (x, y) => hitCircle(x, y), hitArc: (x, y) => hitArc(x, y) },
    clearPlacement: () => geometryInstanceCommand.clearPlacement(), cancelAnnotation: () => annotationCommand.cancel(),
    cancelPngExport: () => pngExportCommand.cancel(), resetOffset: () => offsetSelection.reset(),
    hideInput: () => hideDimensionValueInput(), updateToolbar, updateConstraintButtons,
    acceptTarget: (...args) => constraintOperandValues.appendTarget(...args),
  });
  const { preview: drawingPreview, pending: pendingCommandSession, targets: constraintTargetSession,
    pointer: pointerInteractionController, createSelectionPresentation, createInputForEditing: createCanvasInputFeature,
    bindEditingPointer: bindCanvasPointer, createKeyboardForEditing: createCanvasKeyboard } = operationSessions;
  const constructionCommand = operationSessions.createConstruction({
    projection: sketchProjectionFeature, cancelConstraintTargetCommand, updateUI, recordHistory,
    synchronizeSketchProjectionMetadata: () => synchronizeSketchProjectionMetadata(), clearSnap: () => clearSnap(), updateToolbar,
  });
  const { highlight: selectionHighlight, clearing: selectionClearing, documentReset: documentCanvasReset } = createSelectionPresentation({
    projections: blockProjections, constraintReferences,
  });
  const { sameConstraintDisplayElement } = selectionHighlight;
  const { findArcEndpointFixedConstraint, findLineFixedConstraint, pointLockedByLineFixed } = window.ConstraintReferences.createFixedState({
    currentScope: () => editingScopeBinding.current, sameConstraintDisplayElement,
  });
  const offsetSelection = window.OffsetFeature.createSelectionForEditing({
    editingScope: editingScopeBinding, sketches: sketchContext, selection: canvasSelection,
  });
  const constraintRebinding = window.ConstraintRebinding.create({
    catalog: blockCatalog, projections: blockProjections, geometryInstanceBundlesForScope,
    serializeConstraint, decorateSerializedConstraint, deserializeConstraint, applicationText,
  });
  const blockEditingFeature = window.BlockEditingFeature.createForWorkspace({
    documentWorkspace, readServices: geometryReadServices, rebinding: constraintRebinding, editingScope: editingScopeBinding, normalizeGeometryInstance,
    readViewport: () => viewport, activateScope: activateEditingScope, reserveScopeSequences: reserveBlockEditorSequences, createHistory: createBlockEditHistory,
    interaction: canvasInteraction, sessions: operationSessions, presentation,
  });
  const { editing: blockDefinitionEditing, session: blockEditor, queries: blockEditingQueries } = blockEditingFeature;
  const { fromSelection: createBlockDefinitionFromSelection, empty: createEmptyBlockDefinition } = blockDefinitionEditing;
  const { scopeId: currentBlockDefinitionScopeId } = blockEditor;
  const { blockDefinitionScopeError } = blockEditingQueries;

  const sketchSolveResultState = window.SketchSolving.createState();
  const { clearSketchSolveState } = sketchSolveResultState;
  const canvasRenderProbe = window.CanvasRenderProbe.createForScene({
    ctx, readServices: geometryReadServices, readGeometry: () => geometryDisplay, readDimensions: () => dimensionLayer,
  });
  const HISTORY_LIMIT = 80;
  presentation.bindCanvas({
    readPngCommand: () => pngExportCommand, readPending: () => pendingCommandSession.current, readMode: drawOperationLifecycle.readMode,
    syncAnnotationInput: () => annotationInputController.sync(),
    withGeometryReadCache, drawCanvas,
  });
  const { command: geometryInstanceCommand, sources: instanceSourceCommand, createEditingWithTransforms: createInstanceEditing } = createDerivedCommands({
    cancelConstraintTargetCommand, cancelPendingCommand, clearSelection, normalizeGeometryInstance,
    commitDraft: (...args) => synchronizedInstanceEditing.commit(...args), updateToolbar, recordHistory,
    projectionSources: sketchProjectionSources, guardDimensionSymbolDeletion, solveState: sketchSolveResultState,
  });
  const { start: startGeometryInstanceCommand } = geometryInstanceCommand;
  const blockPlacementCommand = blockEditingFeature.createPlacement({
    layout: { snappedBlockRotation, blockInstanceTranslationForAnchor }, isGeometryMode, clearSelection,
    isPropertiesCollapsed: () => Boolean(document.querySelector(".workspace")?.classList.contains("properties-collapsed")),
    setPropertiesPanelCollapsed, solveAndRefresh, recordHistory,
  });
  const { start: startBlockPlacement,
    restorePropertiesPanel: restoreBlockPlacementPropertiesPanel } = blockPlacementCommand;
  const historyFeature = window.HistoryController.createForWorkspace({
    documentWorkspace, blocks: blockEditingFeature, readServices: geometryReadServices, presentation,
    serializeDocument: serializeModel, loadDocument: loadModelData, serializeConstraint, decorateSerializedConstraint,
    constructionCommand, clearInteractionForSketchChange, solveAndRefresh, changed: updateHistoryButtons, limit: HISTORY_LIMIT,
  });
  const { documentHistory, controller: historyController, captureDocument: historySnapshot } = historyFeature;
  const { active: activeEditHistory, resetBlock: resetBlockEditorHistory, resetDocument: resetHistory,
    undo: undoHistory, redo: redoHistory } = historyController;
  const toolbarPresentation = presentation.createToolbar({
    lifecycle: drawOperationLifecycle, pending: pendingCommandSession, constraints: constraintTargetSession, constructionCommand,
    readSplineEditing: () => Boolean(splineEditing.current), readHistory: activeEditHistory,
    updateDocumentStatus: () => updateDocumentNameUI(), isGeometryMode,
  });
  const CURRENT_JSON_VERSION = 26;
  const CLIPBOARD_PASTE_OFFSET_SCREEN_PX = 24;


  const pointerMoveScheduler = operationSessions.createMoveScheduler({
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (frame) => cancelAnimationFrame(frame),
    profilePhase: profileInteractionPhase, withGeometryReadCache,
    readInput: () => canvasInputBinding, syncDimensionValueInput: () => syncDimensionValueInput(),
  });
  const { flush: flushScheduledCanvasPointerMove } = pointerMoveScheduler;
  const { controls: canvasViewControls, canvasThemeColor, createForEditing: createCanvasDisplay } = window.CanvasDisplay.prepareForWorkspace({
    canvas, document, window, ctx, documentWorkspace, readServices: geometryReadServices,
    interaction: canvasInteraction, sessions: operationSessions, presentation,
  });
  const { state: viewState, constraintStatus: constraintStatusView } = canvasViewControls;

  const CONSTRUCTION_EXTENSION_SCREEN_PX = 12;
  const CENTERLINE_PARALLEL_TOLERANCE = 1e-5;
  const CONSTRUCTION_GEOMETRY_ALPHA = 0.72;
  const HATCH_SCREEN_PX_PER_MM = CSS_PX_PER_MM;
  const CONSTRAINT_ACCEPT_ERROR = 1e-4;
  const resultIsAccepted = window.SketchSolving.createResultAcceptance(CONSTRAINT_ACCEPT_ERROR);
  const constraintOperandFeature = selectionFeature.createConstraintOperands({
    targets: constraintTargetSession, pointer: pointerInteractionController, solver, acceptError: CONSTRAINT_ACCEPT_ERROR,
  });
  const { candidates: constraintCandidates, operands: constraintOperandValues,
    fromSelection: constraintOperandsFromSelection } = constraintOperandFeature;
  const { sameArcEndpoint } = constraintCandidates;
  const { operandElement } = constraintOperandValues;
  const PARAMETER_STABILIZATION_MAX_PASSES = 20;
  const PARAMETER_STABILIZATION_RELATIVE_TOLERANCE = 1e-7;
  const DRAG_PREVIEW_MAX_MODEL_ERROR = 0.125;
  const MIN_LINE_LENGTH = Math.max(MIN_ORIENTATION_LENGTH, solver.minLineLength || 12);
  const constrainedAnnotationDrag = createConstrainedAnnotationDrag({
    placementAnchor: annotationPlacementAnchor,
    buildPlan: (...args) => buildDragSession(...args), beginGeometryDrag: (event, plan) => geometryDrag.begin(event, plan),
    leaderDisplay: annotation => annotationLeaderDisplayGeometry(annotation), invalidateAnalysis: () => constraintAnalysis.invalidate(),
  });
  const { scopeQuery: solveScopeQuery, analysis: constraintAnalysis, redundancy: constraintRedundancy, createSolving } = window.SketchSolvingFeature.createContextForWorkspace({
    documentWorkspace, readServices: geometryReadServices, references: constraintReferences, referenceState: referenceConstraintState,
    annotationDrag: constrainedAnnotationDrag, solver, pointUsage, presentation, solveState: sketchSolveResultState, minimumLength: MIN_LINE_LENGTH, acceptError: CONSTRAINT_ACCEPT_ERROR,
  });
  const { connectedComponentFromSeeds, localSolveLines, sketchSolveConstraints } = solveScopeQuery;
  const { viewport, navigation: canvasNavigation, createEditingWorkspace: createCanvasWorkspace } = createCanvasDisplay({
    initialScale: CSS_PX_PER_MM, minLength: MIN_LINE_LENGTH,
    fitVisibleGeometry: fitVisibleGeometryToViewport, flushPointerMoves: pointerMoveScheduler.flush, syncDimensionValueInput: () => syncDimensionValueInput(),
  });
  const { worldToCanvasScreen, canvasPoint } = viewport;
  const transientAuthoring = window.TransientAuthoring.create({
    currentScope: workspace.current, ids: geometryIds, selection: canvasSelection, historySnapshot, documentHistory,
    isHistoryRestoring: () => historyController.restoring, updateHistoryButtons,
    invalidateAnalysis: () => { constraintAnalysis.invalidate(); },
  });
  const { surface: canvasSurface, exportRenderer: pngRendering, layout: canvasWorkspaceLayout, createSceneForEditing: createCanvasScene, createPlacementPreview, createInputBinding: createCanvasInputBinding, createPngExport, createDimensionTraversal, dragPointer,
    dimensions: { display: dimensionDisplay, labels: { label: dimensionLabelForConstraint }, input: dimensionInput, element: dimensionValueInput } } = createCanvasWorkspace({
    dimensionScene: { onExpressionMark: canvasRenderProbe.captureExpressionMark },
    dimensionInput: { syncHighlight: syncExpressionInputHighlight, scheduleFrame: callback => requestAnimationFrame(callback),
      evaluateDimensionExpressionDraft, expressionFromUserInput, cancelPendingCommand, startDistanceValueInput,
      submitOffsetValue: () => submitOffsetValue(), submitDistanceValue: () => submitDistanceValue() },
    drawCanvas, closeContextMenu: closeCanvasContextMenu, applySketchTreeWidth: () => applySketchTreeWidth(),
  });
  const { resetCanvasStrokeState, withCanvasState } = canvasSurface;
  const { placement: dimensionPlacement, painter: dimensionPainter } = dimensionDisplay;
  const { controller: dimensionInputController } = dimensionInput;
  const { dimensionFromAnchor, dimensionAnchor, defaultDimensionForTarget } = dimensionPlacement;
  const { hide: hideDimensionValueInput, sync: syncDimensionValueInput } = dimensionInputController;
  function dimensionLayout(...args) { return dimensionDisplay.layout(...args); }
  const { sketchStyle: sketchPresentation, geometry: geometryDisplay,
    overlay: interactionOverlay, bounds: drawingBounds, fit: drawingFit, createFrame: createCanvasFrame, createHatchRendering } = createCanvasScene({
    solveState: sketchSolveResultState, analysis: constraintAnalysis,
    instanceSources: instanceSourceCommand, projection: sketchProjectionCommand, instances: geometryInstanceCommand, operandElement,
    selectionHighlight, isSidebarHighlightedElement,
    constructionAlpha: CONSTRUCTION_GEOMETRY_ALPHA, constructionExtensionScreenPx: CONSTRUCTION_EXTENSION_SCREEN_PX,
    sameArcEndpoint, arcEndpointPoint, findArcEndpointFixedConstraint, pointLockedByLineFixed,
    editingQueries: { isDraggingArcEndpoint: (arc, endpoint) => geometryDrag.isArcEndpoint(arc, endpoint),
      isDraggingPoint: point => geometryDrag.isPoint(point), isDraggingCenter: point => geometryDrag.isCenter(point),
      editedSpline: () => splineEditing.current?.spline },
    annotationBounds,
  });
  const { traceSplinePath } = geometryDisplay;
  const { allGeometryBounds, visibleGeometryBounds } = drawingBounds;
  const { fitSketchToViewport, fitAllGeometryToViewport } = drawingFit;
  function fitVisibleGeometryToViewport(paddingPx = 96) { return drawingFit.fitVisibleGeometryToViewport(paddingPx); }
  const dimensionValueEditing = window.ConstraintEditing.prepareDimensionValues({
    workspace, sketches: sketchContext, bounds: drawingBounds, minimumLineLength: MIN_LINE_LENGTH,
  });

  const { layer: hatchLayer, drawHatches, createStack: createDrawingStack } = createHatchRendering({
    readCommand: () => hatchCommand,
  });
  const annotationFeature = createAnnotationFeature({
    ctx, viewport, surface: canvasSurface, editingScope: editingScopeBinding, sessions: operationSessions,
    placement: dimensionPlacement, readAppearance: () => appearanceEditing,
    readExportFrame: () => pngRendering.frame, canvasThemeColor, resizeEnabled: element => annotationDrag.resizeEnabled(element),
    constraintOperandsFromSelection, recordHistory, cancelPendingCommand, cancelConstraintTargetCommand,
    startDistanceResolution, clearSelection, updateToolbar,
  });
  const { layer: annotationLayer, dimensions: annotationDimensions, command: annotationCommand,
    dimensionScope: dimensionPresentationScope } = annotationFeature;
  const { hitAnnotationElement: queryAnnotationElement, canvasContextAnnotationHit } = annotationFeature.spatial;
  const { annotationLeaderDisplayGeometry, drawAnnotationLeader } = annotationFeature.renderer;
  function annotationPlacementAnchor(...args) { return annotationFeature.placementAnchor(...args); }
  const referenceImageFeature = window.ReferenceImageFeature.createForWorkspace({
    canvas, ctx, viewport, document, window, withCanvasState, createImage: () => new Image(),
    documentWorkspace, editingScope: editingScopeBinding, interaction: canvasInteraction, presentation, appearance: geometryAppearance,
    clearSelection, clearSnap: () => clearSnap(), hitReferenceImageAt, recordHistory,
    pasteGeometry: pasteGeometryClipboard, copyGeometry: copySelectionToClipboard, isGeometryMode,
    isTextEditingTarget: target => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable,
  });
  const { renderer: referenceImageRenderer, interaction: referenceImageInteraction, input: referenceImageInput } = referenceImageFeature;
  const { drawDrawingStack } = createDrawingStack();
  const MIN_ARC_LENGTH = MIN_LINE_LENGTH;
  const placementPreviewLayer = createPlacementPreview({
    geometry: geometryDisplay, annotations: annotationFeature.renderer, hatchLayer,
    blockPlacementCommand, geometryInstanceCommand, createBlockProjectionBundle,
  });
  const { geometry: geometryCreation, createAuthoringForEditing: createAuthoringTools } = window.BasicDrawingTools.createGeometry({
    currentScope: workspace.current, ids: geometryIds, assignSketchId, currentConstruction: () => constructionCommand.enabled,
    minLineLength: MIN_LINE_LENGTH, minArcLength: MIN_ARC_LENGTH,
    hitEndpointPoint: (x, y) => hitEndpointPoint(x, y), hitExplicitPoint: (x, y) => hitExplicitPoint(x, y),
  });
  const { addPoint, addLine, addCircle, addArc, addSpline, enforceMinimumLineLengths, normalizeArcSweeps } = geometryCreation;
  const sketchProjectionEditing = sketchProjectionFeature.createModelEditing({
    geometry: geometryCreation, references: constraintReferences,
  });
  const { separateSharedSketchProjectionTargetPoints, synchronizeSketchProjectionMetadata } = sketchProjectionEditing;
  const authoringTools = createAuthoringTools({
    documentWorkspace, readServices: geometryReadServices, interaction: canvasInteraction, sessions: operationSessions, presentation, viewport,
    annotationAnchors: () => allAnnotations().filter(element => isVisibleSketchElement(element) && element.visible !== false).map(element => ({ element, ...annotationPlacementAnchor(element) })),
    transientAuthoring, pushModelConstraint, addConstraintIfMissing,
    checkpoint: { capture: (...args) => snapshotGeometryMutationState(...args), restore: (...args) => restoreGeometryMutationState(...args) },
    cancelConstraintTargetCommand, resetEditing: () => splineEditing.reset(),
    resetBlankCandidate: () => blankCanvasGesture.resetCandidate(), updateToolbar, projection: sketchProjectionCommand, clearSelection,
    solveAndRefresh, recordHistory,
  });
  const { snap: drawingSnap, spline: { command: splineCommand }, snapConstraints, tools: basicDrawingTools } = authoringTools;
  const { clear: clearSnap } = drawingSnap;
  function snapForDrawing(point) { return authoringTools.snapForDrawing(point); }
  const { start: beginSplineCreation } = splineCommand;
  const { addPointSnapConstraints } = snapConstraints;
  const { line: lineCommand, circular: circularCommands } = basicDrawingTools;
  const offsetFeature = authoringTools.createOffset({
    currentScope: () => editingScopeBinding.current, placement: dimensionPlacement, sourceSelection: offsetSelection,
    pending: pendingCommandSession, valueInput: dimensionInputController, viewport, ctx, withCanvasState, drawDimension, readMode: drawOperationLifecycle.readMode,
    commitNewConstraint, offsetChainErrorText,
    prepareStart: () => drawOperationLifecycle.prepare("offset"),
    updateGeometrySelectionUI, invalidateAnalysis: () => { constraintAnalysis.invalidate(); },
  });
  const { command: offsetCommand, previewLayer: offsetPreviewLayer, chainDraft: offsetChainDraft } = offsetFeature;
  const { submit: submitOffsetValue } = offsetCommand;
  function computeTrimPreview(pointer) { return trimFeature.computePreview(pointer); }
  const editingCheckpoint = window.EditingCheckpoint.create({
    currentScope: workspace.current, ids: geometryIds, invalidateProjection: invalidateBlockProjectionCache,
    invalidateAnalysis: () => { constraintAnalysis.invalidate(); },
  });
  const { captureValues: snapshotModelState, restoreValues: restoreModelState, captureGeometry: snapshotGeometryMutationState, restoreGeometry: restoreGeometryMutationState } = editingCheckpoint;
  const { dimensions: { serialize: serializeDimension }, codecs: constraintCodecs, metadata: constraintMetadata,
    preparation: documentPreparation, writer: documentWriter, geometryInstances: geometryInstancePersistence, ensureDimensionDefaults, createApplication: createDocumentApplication } = createPersistence({
    placement: dimensionPlacement, pointUsage, readEditingScope: () => editingScopeBinding.current, readBlockEditor: () => blockEditor.current,
    version: CURRENT_JSON_VERSION, constraintReferencesPoint, separateSharedSketchProjectionTargetPoints, normalizeArcSweeps,
  });
  const { solving: sketchSolving, parameters: parameterStabilization, storedDefinitions: storedDefinitionStabilization,
    refresh: solveRefreshCommand } = createSolving({
    projectionEditing: sketchProjectionEditing, geometry: geometryCreation, checkpoint: editingCheckpoint, editingScope: editingScopeBinding,
    historyController, recordHistory, resultIsAccepted,
    maxPasses: PARAMETER_STABILIZATION_MAX_PASSES, relativeTolerance: PARAMETER_STABILIZATION_RELATIVE_TOLERANCE,
  });
  const { solveSketchAndDependents } = sketchSolving;
  const { stabilize: stabilizeActiveParameterNamespace } = parameterStabilization;
  const { fillet: filletCommand, createCircleCenterCross, createSplineEditing, createCenterline, createTrim } = authoringTools.createEditing({
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
    rebind: () => constraintRebinding.rebuildDocument(editingScopeBinding.current, [...blockProjectionBundles(), ...geometryInstanceBundles()]),
    parameters: parameterStabilization, acceptError: CONSTRAINT_ACCEPT_ERROR, scopeQuery: solveScopeQuery, solver, solveState: sketchSolveResultState,
    blockLayout: { blockLocalGeometryBounds, snappedBlockRotation }, solving: sketchSolving, updateBlockUI, refreshConstraintAnalysis,
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
  const { submit: submitDistanceValue } = dimensionValueCommand;
  const { stabilizeDocument: stabilizeDocumentParameters, application: parameterApplication } = window.ParameterApplication.createForWorkspace({
    documentWorkspace, editingScope: editingScopeBinding, blocks: blockEditingFeature, history: historyFeature, checkpoint: editingCheckpoint,
    parameters: parameterStabilization, storedDefinitions: storedDefinitionStabilization, presentation,
    acceptError: CONSTRAINT_ACCEPT_ERROR, loadDocument: loadModelData, clearSelection,
  });
  const centerlineCommand = createCenterline({
    commitNewConstraint,
    parallelTolerance: CENTERLINE_PARALLEL_TOLERANCE,
  });
  const { start: startCenterlineCommand, projectPointToCenterlineSupport } = centerlineCommand;
  const { renderer: { drawFilletArc: drawFilletPreviewArc }, layer: authoringPreviewLayer } = authoringTools.createPreview({
    ctx, viewport, withCanvasState, traceSplinePath, readMode: drawOperationLifecycle.readMode, centerlineCommand,
    readCanvasSize: () => ({ width: canvas.clientWidth, height: canvas.clientHeight }),
  });
  const { versionView: runtimeVersionView, initialize: initializePresentation } = presentation.createStartup({
    canvasSurface, resizeCanvas, readVersion: () => window.__JOT2D_RUNTIME_VERSION__,
  });

  const toolbarControls = toolbarPresentation.prepareControls({ canvas });
  const { fixPointBtn, createControls: createToolbarControls } = toolbarControls;

  applicationSettings.prepareButtonTooltips();

  const { localizedConstraintName } = constraintFeedback;


  const documentFileFeature = createDocumentFileFeature({
    window, document, documentWorkspace, history: historyFeature, blockEditor, presentation, fit: drawingFit,
    serializeModel, requestChoice: options => choiceDialog.show(options), loadModelData, solveAndRefresh,
    repairMessage: () => documentApplication.blockConstraintRepairMessage,
  });
  const { effectiveDocumentName, refreshStatus: updateDocumentNameUI, markCheckpoint: markDocumentFileCheckpoint,
    save: saveJot2DFile, saveAs: saveJot2DFileAs } = documentFileFeature;




  function ensureBlockState() {
    return documentPreparation.blocks();
  }


  const { controller: annotationInputController, commitParameterEdit: commitAnnotationParameterEdit } = annotationFeature.createEditor({
    document, host: canvas.parentElement, capture: snapshotModelState, restore: restoreModelState, guardDimensionSymbolDeletion,
    readParameterNamespace: currentParameterNamespace, expressionFromUserInput,
    stabilize: stabilizeDocumentParameters,
    resetDrag: () => annotationDrag.reset(), toScreen: worldToCanvasScreen, expressionInputValue,
  });

  function isGeometryMode() {
    return true;
  }




  function normalizeGeometryInstance(raw, normalizeSketch = value => String(value || activeSketchId()), index = 0) {
    return geometryInstancePersistence.normalize(raw, normalizeSketch, index);
  }


  function hitAnnotationElement(x, y, options = {}) {
    return queryAnnotationElement(x, y, { activeOnly: !ordinarySelectionMode(), ...options });
  }

  function hitReferenceImageAt(...args) { return regionHitQuery.hitReferenceImageAt(...args); }


  function decorateSerializedConstraint(data, constraint) { return constraintMetadata.decorate(data, constraint); }








  const sceneHitInteraction = window.CanvasHitInteraction.createSceneForWorkspace({
    documentWorkspace, readServices: geometryReadServices, interaction: canvasInteraction, sessions: operationSessions,
    viewport, dimensionScope: dimensionPresentationScope, dimensions: dimensionDisplay, dimensionLabelForConstraint,
    annotationBounds, hitAnnotationElement, operandValues: constraintOperandValues,
  });
  const { ordinarySelectionMode } = sceneHitInteraction.policy;














  function solveAndRefresh(...args) { return solveRefreshCommand.run(...args); }


  function refreshConstraintAnalysis(options = {}) { return constraintAnalysis.refresh(options); }















  const circleCenterCrossCommand = createCircleCenterCross({
    resultIsAccepted, minOrientationLength: MIN_ORIENTATION_LENGTH,
  });
  const { start: startCircleCenterCrossCommand } = circleCenterCrossCommand;

  const lineCollapseQuery = window.LineCollapseQuery.create({
    connectedComponentFromSeeds, constraintGraphNodes, localSolveLines, minLineLength: MIN_LINE_LENGTH,
  });

  const splineEditing = createSplineEditing({
    constraintReferences, guardDimensionSymbolDeletion,
  });

  const blockSelectionQuery = blockEditingFeature.createSelectionQuery({
    references: constraintReferences, serializeConstraint, annotationBounds,
  });
  const { read: blockSelectionGeometry, center: blockSelectionBoundsCenter } = blockSelectionQuery;



  function reserveBlockEditorSequences(draft) { return idReservation.scope(draft); }

  const choiceDialog = window.ChoiceDialog.create(document.getElementById("choiceDialog"));
  const { definition: blockDefinitionCommand, completion: blockCompletionCommand, createView: createBlockView } = blockEditingFeature.createCommandsForEditing({
    interaction: canvasInteraction, isGeometryMode, selectionQuery: blockSelectionQuery, guardDimensionSymbolDeletion,
    resetBlockEditorHistory, clearSelection, readView: () => blockView, drawingFit, updateBlockUI, presentation, recordHistory,
    referenceState: referenceConstraintState, solving: sketchSolving, resultIsAccepted, sketches: sketchContext, choiceDialog,
    blockLocalGeometryBounds, references: constraintReferences, acceptError: CONSTRAINT_ACCEPT_ERROR, solveState: sketchSolveResultState,
  });
  const { startCreation: startBlockCreation, open: openBlockDefinitionEditor, enter: enterBlockDefinitionEdit } = blockDefinitionCommand;
  const { complete: completeBlockDefinitionEdit } = blockCompletionCommand;


  function resetModelState() { return documentEditingReset.reset(); }




  function serializeConstraint(c) {
    return constraintCodecs.serialize(c);
  }


  function serializeModel() { return documentWriter.serialize(); }



  function createBlockEditHistory() { return historyFeature.createBlockHistory(); }


  function updateHistoryButtons() { return toolbarPresentation.updateHistory(); }


  function recordHistory(label = "変更") { return historyFeature.record(label); }



  function deserializeConstraint(...args) {
    return constraintCodecs.deserialize(...args);
  }


  const documentApplication = createDocumentApplication({
    resetEditingState: resetModelState,
    sketchTreeView: { capture: () => sketchTreeView.capture(), restore: state => sketchTreeView.restore(state) },
    refreshReferenceConstraintValidity, enforceMinimumLineLengths, log,
  });
  function loadModelData(data, options = {}) {
    return documentApplication.load(data, options);
  }

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



  function resizeCanvas(...args) { return canvasWorkspaceLayout.resizeCanvas(...args); }
  function setPropertiesPanelCollapsed(...args) { return canvasWorkspaceLayout.setPropertiesPanelCollapsed(...args); }






























  const sceneHitQueries = sceneHitInteraction.createQueries();
  const { regions: regionHitQuery, dimensions: dimensionHitQuery, instances: instanceHitQuery } = sceneHitQueries;
  const { hitSketchIdentityElement, hitEndpointPoint, hitExplicitPoint, hitPoint, hitLine, hitCircle, hitArc, hitArcEndpoint, hitSpline } = sceneHitQueries.geometry;















  function addConstraintIfMissing(...args) { return constraintCommitCommand.ifMissing(...args); }

  function hitDimension(...args) { return dimensionHitQuery.hitDimension(...args); }



  function hitBlockInstance(...args) { return instanceHitQuery.hitBlockInstance(...args); }
  function hitBlockRotationHandle(x, y) { return null; }





















  const { hitConstraintOperand: queryConstraintOperand } = sceneHitQueries.operands;





  const deletionFeature = window.DeletionFeature.createForEditing({
    documentWorkspace, readServices: geometryReadServices, interaction: canvasInteraction, references: constraintReferences, annotationDimensions,
    splineEditing, guardDimensionSymbolDeletion, geometry: geometryCreation, sessions: operationSessions, lineCommand, circularCommands,
    solving: sketchSolving, analysis: constraintAnalysis, presentation, updateToolbar, recordHistory,
    referenceImageInteraction, clearSelection, solveAndRefresh,
    resetGeometryDrag: () => geometryDrag.reset(), resetDimensionDrag: () => dimensionDrag.reset(), resetAnnotationDrag: () => annotationDrag.reset(),
  });
  function rejectReferencedGeometryDeletion(instances, label) { return deletionFeature.rejectReferences(instances, label); }
  function deleteElements(options) { return deletionFeature.remove(options); }
  function deleteCurrentSelection() { return deletionFeature.removeSelection(); }

  const clipboardFeature = window.ClipboardFeature.createForEditing({
    documentWorkspace, editingScope: editingScopeBinding, readServices: geometryReadServices, interaction: canvasInteraction,
    geometry: geometryCreation, annotationRenderer: annotationFeature.renderer, references: constraintReferences, annotationLeaderAnchor, viewport,
    serializeConstraint, decorateSerializedConstraint, normalizeGeometryInstance, deserializeConstraint,
    blockScopeId: currentBlockDefinitionScopeId, blockDefinitionScopeError, presentation,
    pasteOffsetScreenPx: CLIPBOARD_PASTE_OFFSET_SCREEN_PX, imageClipboard, updateToolbar, deleteSelection: deleteCurrentSelection,
    isGeometryMode, clearSelection, solveAndRefresh,
  });
  const { session: clipboardSession, command: clipboardCommand } = clipboardFeature;
  function copyableSelectionPayload() { return clipboardFeature.copyableSelectionPayload(); }
  function copySelectionToClipboard(options = {}) { return clipboardCommand.copy(options); }

  function pasteGeometryClipboard() { return clipboardCommand.paste(); }


  const { selectionBounds: dimensionSelectionBounds, layer: dimensionLayer } = createDimensionTraversal({
    currentScope: dimensionPresentationScope, readDraggedDimension: () => dimensionDrag.constraint, dimensionUsesExpression,
  });

  const { query: rectangleSelectionQuery, rectangle: selectionRectangle } = sceneHitInteraction.createRectangleSelection({
    dimensionBounds: dimensionSelectionBounds, instanceSourceCommand, geometryInstanceCommand, sketchProjection: sketchProjectionFeature,
    canvas, clearSelection, presentation,
  });

  function drawBlockInstanceHandles() {
    resetCanvasStrokeState();
  }















  const { frame: canvasFrameRenderer, overlays: { drawSelectionRect } } = createCanvasFrame({
    rectangle: selectionRectangle, snap: drawingSnap, pointer: pointerInteractionController,
    recordDraw: () => pointerMoveScheduler.recordDraw(), referenceImageLayer: referenceImageFeature.layer, readPngCommand: () => pngExportCommand,
    dimensions: dimensionLayer, drawDimensionPreview, annotations: annotationLayer,
    authoringPreview: authoringPreviewLayer, placements: placementPreviewLayer, offsetPreview: offsetPreviewLayer,
    drawBlockInstanceHandles, drawHatches, drawDrawingStack,
  });

  function drawCanvas() { return canvasFrameRenderer.draw(); }
















  function drawDimension(...args) { return dimensionPainter.drawDimension(...args); }























  const annotationDrag = annotationFeature.createDrag({
    beginConstrainedDrag: constrainedAnnotationDrag.begin,
    resizeText: (item, height) => appearanceEditing.applyAnnotationStyleValue(item, "textHeight", height),
    beginPointer: dragPointer.captureThenMark,
    endPointer: dragPointer.release,
  });

  const dimensionPreview = dimensionDisplay.createPreview({
    readPending: () => pendingCommandSession.current, drawFilletPreviewArc, evaluateDimensionExpressionDraft,
  });
  function drawDimensionPreview() { return dimensionPreview.draw(); }
















  function selectedVisibilityTargets() { return propertySelection.visibilityTargets(); }
  function selectionVisibilityIsHidden(targets) { return propertySelection.visibilityIsHidden(targets); }
  function toggleSelectedVisibility() { return selectionVisibilityCommand.toggle(); }

  const { view: toolbarView, status: commandStatusView } = createToolbarControls({
    selectedVisibilityTargets, selectionVisibilityIsHidden,
    canEditTarget: target => canEditSketch(target.kind === "constraint" ? constraintSketchId(target.item) : elementSketchId(target.item)),
  });
  function updateToolbar() { toolbarView.update(); }

  const { selectionQuery: constraintSelectionQuery, targets: constraintTargetCommand, dimensions: dimensionPlacementCommand,
    createCommitWithIntentForWorkspace: createConstraintCommit, createFixedEditing, constraintTargetHint,
    input: { updateHover: updatePendingDistanceRetargetHover, createWithDragging: createConstraintInputWithDragging },
    controls: { view: constraintControlsView, createBinding: createConstraintControlBinding } } = window.ConstraintEditing.createForEditing({
    document, controls: toolbarControls, interaction: canvasInteraction, sessions: operationSessions, sketches: sketchContext, presentation,
    operands: constraintOperandFeature, viewport, annotationFeature, instances: geometryInstanceCommand, valueInput: dimensionInputController,
    resolveConstraintIntent, isGeometryMode, findLineFixedConstraint, clearSelection, commitConstraintResolution, updateToolbar, updateConstraintButtons,
    blurConstraintControl: () => { if (document.activeElement instanceof HTMLElement && document.activeElement.matches("[data-constraint], #fixPointBtn")) document.activeElement.blur(); },
    addConstraint, hitConstraintOperand, toggleGeometryFixedOperand, toggleSelectedFixed,
    geometryInstanceBundle, cancelPendingCommand, placement: dimensionPlacement, readOnlyDimensionConstraintForPlacement, addReadOnlyDimensionConstraint,
  });

  function cancelConstraintTargetCommand(message) { return constraintTargetCommand.cancel(message); }

  function hitConstraintOperand(pointer, type, hits = {}) { return queryConstraintOperand(pointer, type, constraintTargetSession.operands, hits); }

  function handleConstraintOperandClick(pointer, type, hits = {}) { return constraintTargetCommand.operandClick(pointer, type, hits); }


  function startDistanceCommand() { return dimensionPlacementCommand.startDistanceCommand(); }

  function cancelPendingCommand(message) { return pendingCommandSession.cancel(message); }

  function startDistanceValueInput(pointer) { return dimensionPlacementCommand.startDistanceValueInput(pointer); }



  function startDimensionEditInput(hit) { return dimensionValueCommand.startEdit(hit); }

  function updateConstraintButtons() { constraintControlsView.update(); }

  const { reset: sketchInteractionReset, editing: sketchEditing } = window.SketchEditingFeature.createForInteraction({
    documentWorkspace, readServices: geometryReadServices, interaction: canvasInteraction, sessions: operationSessions,
    constraintTargets: constraintTargetCommand, valueInput: dimensionInputController, presentation, constraintReferences, recordHistory,
    clearSelection, clearSnap, updateToolbar, resetSketchMove: () => sketchMoveCommand?.reset(),
    resetGeometryDrag: () => geometryDrag.reset(), resetDimensionDrag: () => dimensionDrag.reset(),
    referenceImage: referenceImageInteraction, selectionRectangle, projection: sketchProjectionCommand, instances: geometryInstanceCommand, instanceSources: instanceSourceCommand,
    clearInteractionForSketchChange, promptName: (title, name) => window.prompt(title, name), clearTreeHover: () => sketchTreeController.clearHoverSketch(),
  });
  function clearInteractionForSketchChange() { return sketchInteractionReset.clear(); }

  const { createSketch, toggleVisibility: toggleSketchVisibilityCommand } = sketchEditing.command;
  function toggleSketchVisibility(id) { return toggleSketchVisibilityCommand(id); }
  const { command: createdSketchMoveCommand, input: sketchMoveInputBinding } = sketchEditing.createMoveWithInput({
    document,
    readEditingScope: () => editingScopeBinding.current, hatches: hatchGeometryQuery, rebinding: constraintRebinding,
    analysis: constraintAnalysis, refreshReferenceConstraintValidity,
  });
  // Publish the command before enabling destination-only input.
  sketchMoveCommand = createdSketchMoveCommand;
  sketchMoveInputBinding.bind();
  const hatchCommand = authoringTools.createHatch({
    hatchGeometryQuery, readMode: drawOperationLifecycle.readMode, lastPointer: pointerInteractionController.readLastPointer,
    documentIds, updateStatusUI, hatchRegionErrorText,
  });
  const { startHatchCreation, startHatchBoundaryRepair } = hatchCommand;



  const sketchDeletionCommand = sketchEditing.createDeletion({
    rejectReferencedGeometryDeletion, log, geometryElementKey, guardDimensionSymbolDeletion,
    annotationReferencesRemovedGeometry, clearSketchSolveState,
    invalidateAnalysis: () => { constraintAnalysis.invalidate(); }, solveSketchAndDependents,
    refreshConstraintAnalysis, confirmDeletion: message => window.confirm(message),
  });
  const { remove: deleteSketch } = sketchDeletionCommand;


  const { toolbarSvgMarkup, constraintToolbarIcon } = window.ToolbarView.createIcons({
    document, isDimensionConstraint, types: window.GeometrySolver,
  });



  const { operand: fixedOperandCommand, createSelection: createFixedSelection } = createFixedEditing({
    operandElement, guardSketchProjectionShapeEdit, findArcEndpointFixedConstraint, arcEndpointPoint,
    currentScope: workspace.current, sameConstraintDisplayElement, deleteElements, commitNewConstraint, solveAndRefresh,
  });

  const { view: sketchTreeView, controller: sketchTreeController, menu: sketchTreeContextMenu } = sketchEditing.createTreeForEditing({
    document, window, selectionHighlight,
    objectOptions: { isHidden: selectionVisibilityIsHidden, analysis: constraintAnalysis, redundancy: constraintRedundancy,
      referenceState: referenceConstraintState, projectionQueries: sketchProjectionQueries,
      toolbarSvgMarkup, constraintToolbarIcon, findLineFixedConstraint, geometryInstanceTypeLabel, hatchPatternTypeLabel },
    escapeHtml, closeCanvasContextMenu, moveCommand: sketchMoveCommand, deletion: sketchDeletionCommand,
    blockEditor, editingScope: editingScopeBinding, solveState: sketchSolveResultState, dimensionScope: dimensionPresentationScope,
    deleteElements, deleteCurrentSelection, toggleSelectedVisibility, fixedOperands: fixedOperandCommand,
  });
  const { applyWidth: applySketchTreeWidth } = sketchTreeView;
  sketchContextController = sketchTreeContextMenu;
  sketchContextController.start();

  function isSidebarHighlightedElement(item) { return sketchTreeController.isHighlightedElement(item); }





















  const blockView = createBlockView({ document, escapeHtml, startBlockPlacement, localizeApplicationUI });

  function updateBlockUI() {
    ensureBlockState();
    blockView.render();
  }

  const expressionInputController = parameterEditor.createReferenceInput({
    TextAreaElement: HTMLTextAreaElement, currentNamespace: () => editingScopeBinding.current, dimensionValueInput, pendingCommandSession,
    canvas, canvasPoint, hitDimension, hitAnnotationElement,
  });











  const { selection: propertySelection, createEditingForWorkspace: createPropertyEditing } = window.PropertiesDisplay.createForWorkspace({
    document, documentWorkspace, readServices: geometryReadServices, interaction: canvasInteraction, presentation,
    operations: { sources: instanceSourceCommand, placement: geometryInstanceCommand, blocks: blockPlacementCommand },
  });
  function selectedPropertiesTarget() { return propertySelection.selectedDisplayTarget(); }
  const { editing: propertyEditing, appearanceUI, createViewForWorkspace: createPropertiesView } = createPropertyEditing({
    editingScope: editingScopeBinding, viewport, checkpoint: editingCheckpoint, parameters: parameterStabilization,
    projection: sketchProjectionFeature, projectionEditing: sketchProjectionEditing, annotationFeature,
    isGeometryMode, toggleSketchVisibility, recordHistory, escapeHtml,
  });
  const { appearanceEditing, visibility: selectionVisibilityCommand } = propertyEditing;
  const propertiesView = createPropertiesView({
    analysis: constraintAnalysis, selectionHighlight, snappedBlockRotation, hatchRegionErrorText,
    geometryInstanceTypeLabel, installExpressionInputHighlights,
    HTMLTextAreaElement, HTMLInputElement,
    changeFreeInstanceProperty, commitAnnotationParameterEdit,
    instanceTransform: instanceTransformCommand, blockConfiguration: blockConfigurationCommand,
    dimensionValues: dimensionValueCommand, dimensions: dimensionPlacementCommand, referenceImages: referenceImageInteraction, hatch: hatchCommand, splineEditing,
  });









































  function updateStatusUI() { return commandStatusView.update(); }




  function addReadOnlyDimensionConstraint(...args) { return constraintCommitCommand.readOnly(...args); }

  const { command: constraintCommitCommand, readOnly: dimensionReadOnlyQuery, intentResolver: constraintIntentResolver } = createConstraintCommit({
    workspace, checkpoint: editingCheckpoint, insertion: constraintInsertion, redundancy: constraintRedundancy,
    solving: sketchSolving, stabilization: parameterStabilization, referenceState: referenceConstraintState,
    solvePreparation: constraintSolvePreparation, lineCollapseQuery, acceptError: CONSTRAINT_ACCEPT_ERROR,
    refreshConstraintAnalysis, recordHistory, now: () => performance.now(),
  });
  function commitNewConstraint(...args) { return constraintCommitCommand.ordinary(...args); }
  function markReferenceConstraint(...args) { return constraintCommitCommand.markReference(...args); }

  function resolveConstraintIntent(type, operands) { return constraintIntentResolver.resolve(type, operands); }


  function startDistanceResolution(resolution, pointer) { return dimensionPlacementCommand.startDistanceResolution(resolution, pointer); }

  function commitConstraintResolution(...args) { return constraintCommitCommand.resolution(...args); }

  function readOnlyDimensionConstraintForPlacement(target, value, dimension, options = {}) {
    return dimensionReadOnlyQuery.forPlacement(target, value, dimension, options);
  }

  function addDistanceConstraintFromTarget(...args) { return constraintCommitCommand.dimension(...args); }

  function addConstraint(type) { return constraintCommitCommand.fromSelection(type); }

  const geometryDragFeature = window.GeometryDragFeature.createForWorkspace({
    documentWorkspace, interaction: canvasInteraction, presentation, sourceQueries: derivedDragQueries, projectionQueries: sketchProjectionQueries,
    solver, scopeQuery: solveScopeQuery, solving: sketchSolving,
    checkpoint: editingCheckpoint, geometry: geometryCreation, readServices: geometryReadServices,
    viewport, pointer: dragPointer, acceptError: CONSTRAINT_ACCEPT_ERROR,
    previewMaxModelError: DRAG_PREVIEW_MAX_MODEL_ERROR, minimumLength: MIN_ORIENTATION_LENGTH,
    blockLocalGeometryBounds, blockWorldPoint, pointLockedByLineFixed, findLineFixedConstraint, findArcEndpointFixedConstraint,
    projectionBlockedMessage: () => sketchProjectionShapeEditBlockedMessage(applicationText("ドラッグ", "Drag")),
    stabilizeActiveParameterNamespace, refreshConstraintAnalysis, recordHistory, clearSelection,
  });
  const { command: geometryDrag, build: buildDragSession } = geometryDragFeature;

  const { input: constraintInputFeature, dragging: dimensionDragFeature } = createConstraintInputWithDragging({
    viewport, currentScope: workspace.current, sketches: sketchContext, readServices: geometryReadServices, pointer: dragPointer,
    clearSnap, updateUI, recordHistory,
  });
  const { command: dimensionDrag } = dimensionDragFeature;







  const blockDragging = geometryDragFeature.createBlockEntry();



  const trimFeature = createTrim({
    references: constraintReferences, hitSketchIdentityElement,
  });

  const { presentCandidate: canvasContextCandidatePresentation, createInteraction: createCanvasContextInteraction } = createCanvasContextScene({
    sceneQueries: sceneHitQueries, splineEditing, canvasContextAnnotationHit, documentWorkspace, readServices: geometryReadServices,
    interaction: canvasInteraction, sessions: operationSessions, presentation,
    candidates: { toolbarSvgMarkup, formatDisplayNumber, constraintToolbarIcon, localizedConstraintName,
      geometryInstanceTypeLabel, hatchPatternTypeLabel, hatchAppearanceForDisplay },
  });












  const canvasCommandCancellation = operationSessions.createCommandCancellation({
    instances: geometryInstanceCommand, constraints: constraintTargetCommand, blockPlacementCommand, restoreBlockPlacementPropertiesPanel, updateUI,
  });


  const { topmostOwner: topmostDrawingOrderOwner, state: drawingOrderCommandState, reorder: reorderSelectedDrawingObjects } = selectionFeature.createDrawingOrder({
    editingScope: editingScopeBinding, ordinarySelectionMode, updateUI, recordHistory,
  });














  const canvasContextInteraction = createCanvasContextInteraction({
    constraintSelection: constraintSelectionQuery, blockQueries: blockEditingQueries, dimensions: dimensionDragFeature,
    cancellation: canvasCommandCancellation, clipboard: clipboardFeature, history: historyController,
    viewport, projection: sketchProjectionCommand,
    sameArcEndpoint, clearSelection, findLineFixedConstraint, findArcEndpointFixedConstraint,
    visibleGeometryBounds, drawingOrderCommandState, handleConstraintOperandClick, isGeometryMode,
    closeAppMenus: () => closeAppMenus(),
    copySelectionToClipboard, imageClipboard,
    showSelectedObjectProperties: canvasWorkspaceLayout.showSelectedObjectProperties, fixPointBtn, enterBlockDefinitionEdit,
    setBlockInstanceRotationLocked, startDimensionEditInput, recordHistory, sketchMoveCommand,
    startHatchBoundaryRepair, reorderSelectedDrawingObjects, fitVisibleGeometryToViewport,
  });
  canvasContextController.start();

  const canvasInputFeature = createCanvasInputFeature({
    document, canvas, updateUI,
    annotationFeature, annotationDrag, constraintInputFeature, dimensionDragging: dimensionDragFeature,
    constraintTargetHint,
    instanceSourceCommand, geometryInstanceCommand, sceneQueries: sceneHitQueries, operandElement, toggleSketchProjectionSource,
    selectionRectangle, viewport, transientAuthoring, authoring: authoringTools,
    drawingCommands: { centerline: centerlineCommand, circleCenterCross: circleCenterCrossCommand, fillet: filletCommand, trim: trimFeature, offset: offsetCommand },
    sameArcEndpoint, topmostDrawingOrderOwner, drawingOrderOwner, geometryDragging: geometryDragFeature, blockDragging, referenceImage: referenceImageInteraction,
  });

  const blankCanvasGesture = authoringTools.createBlankGesture({
    lifecycle: drawOperationLifecycle, pending: pendingCommandSession, constraintTargets: constraintTargetSession,
    splineEditing, dimensionValues: dimensionValueCommand, offset: offsetCommand, annotationInput: annotationInputController,
    updateGeometrySelectionUI,
  });

  const { press: canvasPressQuery, hover: pointerHover, isBlankCommandPanelPoint } = sceneHitQueries.createInteraction({
    canvasHover, sameArcEndpoint, hitBlockRotationHandle, hitAnnotationTarget, blankCanvasGesture, instanceSourceCommand, hatchCommand,
  });

  bindCanvasPointer(canvasInputFeature, {
    canvasNavigation, recordHistory, referenceImageInteraction, pointerHover,
    updatePendingDistanceRetargetHover, hitDimension, hitSketchIdentityElement,
    hatch: hatchCommand, fillet: filletCommand, offset: offsetCommand, spline: splineCommand, splineEditing,
    blockPlacement: blockPlacementCommand, annotationInput: annotationInputController, dimensionValues: dimensionValueCommand, dimensions: dimensionPlacementCommand,
    expressions: expressionInputController, discardMoves: flushScheduledCanvasPointerMove, enterBlock: enterBlockDefinitionEdit,
    query: canvasPressQuery, closeContextMenu: closeCanvasContextMenu, blankGesture: blankCanvasGesture,
  });


  const canvasInputBinding = createCanvasInputBinding({
    readPngExportCommand: () => pngExportCommand,
    blankCanvasGesture, isBlankCommandPanelPoint, scheduler: pointerMoveScheduler,
  });
  canvasInputBinding.bind();
  dimensionInput.bind();

  const keyboardInput = createCanvasKeyboard(canvasInputFeature, {
    window, menus: { closeSketch: () => sketchContextController.close(),
      canvasVisible: () => canvasContextMenu && !canvasContextMenu.hidden, closeCanvas: closeCanvasContextMenu },
    sketchMove: sketchMoveCommand, constraintStatusView, dimensionInput: dimensionInputController,
    shortcuts: { save: saveJot2DFile, saveAs: saveJot2DFileAs, copy: copySelectionToClipboard,
      paste: pasteGeometryClipboard, nativePaste: true, nativeCopy: true, undo: undoHistory, redo: redoHistory },
    projection: sketchProjectionCommand, constraints: constraintTargetCommand, spline: splineCommand, hatch: hatchCommand,
    referenceImage: referenceImageInteraction, splineEditing, blockPlacement: blockPlacementCommand,
    offset: offsetCommand, deleteSelection: deleteCurrentSelection,
    isTextEditingTarget: target => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable,
  });
  keyboardInput.start();
  canvasViewControls.bindWindow();

  const editingToolBinding = toolbarPresentation.createEditingBinding({
    undo: undoHistory, redo: redoHistory, toggleVisibility: toggleSelectedVisibility, deleteSelection: deleteCurrentSelection, annotation: annotationCommand,
  });







  const workspaceControls = presentation.prepareWorkspaceControls({
    window, editingTools: editingToolBinding, canvasViewControls, layout: canvasWorkspaceLayout,
    parameters: parameterEditor, appearance: appearanceUI, blocks: blockView,
  });
  const { close: closeAppMenus } = workspaceControls;
  workspaceControls.start();

  const drawingToolBinding = toolbarPresentation.createDrawingBinding({
    startCenterlineCommand, startCircleCenterCrossCommand, startSketchProjectionCommand, startGeometryInstanceCommand,
    filletCommand, startBlockCreation, offsetCommand, beginSplineCreation, startHatchCreation,
  });
  drawingToolBinding.bind();

  documentFileFeature.bindControls();
  const pngExport = createPngExport({
    documentName: effectiveDocumentName, prepareImages: referenceImageFeature.prepareImages,
    fileSession,
    findSnap: (point, tolerance) => drawingSnap.find(point, tolerance), flushPointerMove: flushScheduledCanvasPointerMove,
  });
  pngExportCommand = pngExport.command;
  pngExport.start();
  dxfImportFeature.bindControls({ flushScheduledCanvasPointerMove });
  referenceImageInput.bindControls();
  sketchTreeView.bindCreation(createSketch);

  window.SidebarController.create({ document, setHint }).bind();


  function toggleGeometryFixedOperand(operand) { return fixedOperandCommand.toggle(operand); }

  const fixedSelectionCommand = createFixedSelection({
    blockDefinitionById, updateUI, recordHistory, snapshotModelState, restoreModelState, pushModelConstraint,
    solveSketchAndDependents, acceptError: CONSTRAINT_ACCEPT_ERROR, refreshConstraintAnalysis,
  });
  function toggleSelectedFixed() { return fixedSelectionCommand.toggle(); }

  const constraintControlBinding = createConstraintControlBinding();
  constraintControlBinding.bind();



  canvasWorkspaceLayout.bindWindow();

  function installTestHooks() {
    if (!new URLSearchParams(window.location.search).has("test")) return;
    const documentTestSupport = window.DocumentTestDriver.createForWorkspace({
      documentWorkspace, geometry: geometryCreation, presentation, document, history: historyFeature, blocks: blockEditingFeature,
      constructionCommand, files: documentFileFeature, fileSession,
    });
    const readTestHistory = documentTestSupport.history.state;
    const { readSelectedGeometry: readTestSelectedGeometry, createApiForEditing: createSelectionTestApi } = window.CanvasSelectionTestDriver.createForWorkspace({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, interaction: canvasInteraction, presentation, clearSelection,
    });
    const constraintTestFactories = window.ConstraintTestDriver.createBrowserFactories({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, scopeQuery: solveScopeQuery,
      solving: sketchSolving, analysis: constraintAnalysis, solver, referenceState: referenceConstraintState, blockQueries: blockEditingQueries,
      operandValues: constraintOperandValues, interaction: canvasInteraction, sessions: operationSessions, placement: dimensionPlacement,
      checkpoint: editingCheckpoint, presentation, viewport, sketchPresentation, canvas, document, readSelectedGeometry: readTestSelectedGeometry,
      commitNewConstraint, markReferenceConstraint, serializeModel, serializeConstraint, resolveConstraintIntent, resetModelState,
      pushModelConstraint, fitAllGeometryToViewport, acceptError: CONSTRAINT_ACCEPT_ERROR,
    });
    const { readStatuses: readTestConstraintStatuses, publicAPI: constraintModelTestApi } = constraintTestFactories.createModelSupport();
    const dragExecutionSupport = window.GeometryDragTestDriver.createExecutionSupport({
      feature: geometryDragFeature, solver, currentScope: workspace.current, normalizeArcSweeps, vectorNorm, sketchSolveConstraints,
      arcEndpointPoint, now: () => performance.now(), readConstraintStatuses: readTestConstraintStatuses,
    });
    const annotationTestSupport = window.AnnotationTestDriver.createForFeature({
      feature: annotationFeature, geometry: geometryCreation, readServices: geometryReadServices, dimensionDisplay, dimensionLabelForConstraint,
      currentScope: workspace.current, viewport, canvas, selection: canvasSelection, drag: annotationDrag, annotationLeaderAnchor,
      annotationLeaderTargetFromItem, draw, allGeometryBounds, resetModelState, resizeCanvas, hitAnnotationElement,
    });
    const { support: dimensionTestSupport, fixtures: dimensionFixtureSupport, createDisplayForEditing: createDimensionDisplayTestSupport } = window.DimensionTestDriver.createForEditing({
      geometry: geometryCreation, display: dimensionDisplay, sketches: sketchContext, appearance: geometryAppearance,
      currentScope: workspace.current, viewport, canvasSelection, resetModelState, addDistanceConstraintFromTarget,
      dimensions: dimensionPlacementCommand, serializeModel, serializeDimension, constraintTargetSession, pendingCommandSession,
      dimensionValueInput, ctx, layer: dimensionLayer, dimensionLabelForConstraint,
    });
    const { lineTransfer: trimLineTransferFixture, constructionBoundary: trimConstructionFixture, diameterTransfer: trimDiameterFixture } = window.TrimTestDriver.createFeature({
      feature: trimFeature, resetModelState, geometry: geometryCreation, pushModelConstraint, currentScope: workspace.current,
    });
    const { display: canvasTestDriver, rendering: canvasRenderingTestSupport } = window.CanvasTestDriver.createForScene({
      document, canvas, viewport, documentWorkspace, readServices: geometryReadServices, geometry: geometryCreation,
      interaction: canvasInteraction, sessions: operationSessions, presentation,
      authoring: { tools: basicDrawingTools, snap: drawingSnap, offsetSelection },
      display: { bounds: drawingBounds, fit: drawingFit, geometry: geometryDisplay }, ctx, selectionRectangle,
      layers: { authoringPreviewLayer, offsetPreviewLayer, placementPreviewLayer },
      blocks: { createEmptyBlockDefinition, blockPlacementCommand, drawBlockInstanceHandles },
      drawSelectionRect, drawAnnotationLeader, resizeCanvas, resetModelState, rootSketchId: ROOT_SKETCH_ID, defaultSketchId: DEFAULT_SKETCH_ID,
      cssPxPerMm: CSS_PX_PER_MM, types: { Point, Line }, evaluateSpline: window.SplineGeometry.evaluate,
      hits: { hitArcEndpoint, hitPoint, hitLine, hitCircle, hitArc, hitSpline, hitDimension },
    });
    const sketchDeletionFixture = documentTestSupport.createSketchDeletion({ resetModelState, deleteSketch });
    const propertiesTestFactories = window.PropertiesTestDriver.createBrowserFactories({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, interaction: canvasInteraction, blockQueries: blockEditingQueries,
      selectionHighlight, presentation, display: geometryDisplay, placement: dimensionPlacement, viewport, document, canvas, fixPointBtn,
      readHistory: readTestHistory, resetModelState, clearSelection, resetHistory, fitAllGeometryToViewport, pushModelConstraint,
      assignConstraintSketchId, recordHistory, canvasThemeColor, isSidebarHighlightedElement, selectedPropertiesTarget,
      findLineFixedConstraint, constructionAlpha: CONSTRUCTION_GEOMETRY_ALPHA,
    });
    const strokeStyleCases = propertiesTestFactories.createStrokeStyleCases();
    const sketchTreeTestApi = window.SketchTreeTestDriver.createForWorkspace({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, interaction: canvasInteraction, presentation,
      sketchPresentation, overlay: interactionOverlay, viewport, canvasDriver: canvasTestDriver, drawingFit, blocks: blockEditingFeature, dimensionDisplay,
      referenceState: referenceConstraintState, document, canvas, getComputedStyle: element => getComputedStyle(element),
      serializeModel, resetModelState, addDistanceConstraintFromTarget, dimensionLayout, blockInstanceDisplayCenter,
    });
    const referenceLineMove = constraintTestFactories.createReferenceLineMove();
    const dependencyOrderFixture = constraintTestFactories.createDependencyOrderFixture();
    const cyclicReferenceFixture = documentTestSupport.createCyclicReference({
      resetModelState, markReferenceConstraint, serializeModel, loadModelData, analysis: constraintAnalysis, referenceState: referenceConstraintState,
    });
    const constraintCaseTestApi = constraintTestFactories.createEditingCases();
    const blockTestSupport = window.BlockTestDriver.createForWorkspace({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, blocks: blockEditingFeature,
      interaction: canvasInteraction, sessions: operationSessions, presentation, placement: blockPlacementCommand, solver, canvas, viewport,
      solving: sketchSolving, definition: blockDefinitionCommand, completion: blockCompletionCommand, configuration: blockConfigurationCommand,
      sketchEditing, dragging: geometryDragFeature, selectionQuery: blockSelectionQuery,
      resetModelState, pushModelConstraint, fitAllGeometryToViewport, recordHistory, serializeConstraint, serializeModel, loadModelData, blockInstanceDisplayCenter,
    });
    const sidebarHighlightObservation = propertiesTestFactories.createHighlightObservation();
    const sidebarHoverKeyObservation = propertiesTestFactories.createHoverKeyObservation();
    const blockTestActions = blockTestSupport.createDimensionCases({
      defaultDimensionForTarget, readOnlyDimensionConstraintForPlacement, addReadOnlyDimensionConstraint, blockDefinitionById,
    });
    const dimensionInteractionSupport = dimensionTestSupport.createInteraction({
      clientPosition: canvasTestDriver.clientPosition, startDimensionEditInput, clearSelection, updateUI, draw, addCircle, addArc,
      fitAllGeometryToViewport, startDistanceCommand, constraintGraphNodes, worldToCanvasScreen, canvas, dimensionAnchor,
      modelTypes: window.GeometrySolver, signedPointLineDistance, vectorNorm, solveSketchAndDependents,
      snapshotModelState, refreshConstraintAnalysis, dimensionDrag,
    });
    const themeObservation = propertiesTestFactories.createThemeObservation();
    const documentTestApi = documentTestSupport.createFileApi({
      performance, File, serializeModel, loadModelData,
    });
    const viewObservation = window.CanvasTestDriver.createViewObservation({ viewState, constraintStatusView });
    const responsiveDragFixture = window.GeometryDragTestDriver.createResponsiveFixture({
      resetModelState, addPoint, addLine, pushModelConstraint, modelTypes: window.GeometrySolver,
      ensureDimensionDefaults, solveAndRefresh, log, fitAllGeometryToViewport, draw, resetHistory, serializeModel,
    });
    const offsetTestSupport = window.OffsetTestDriver.createForWorkspace({
      documentWorkspace, geometry: geometryCreation, insertion: constraintInsertion, offset: offsetFeature, sourceSelection: offsetSelection,
      solvePreparation: constraintSolvePreparation, solving: sketchSolving, checkpoint: editingCheckpoint, sessions: operationSessions, presentation, viewport,
      resetModelState, serializeModel, loadModelData, clearSelection, fitAllGeometryToViewport, resetHistory, solveAndRefresh, canvas, document,
    });
    const sidebarInspectionFixture = propertiesTestFactories.createInspectionFixture();
    const appearanceTestAction = propertiesTestFactories.createAppearanceAction();
    const sketchProjectionTestSupport = window.SketchProjectionTestDriver.createForWorkspace({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, interaction: canvasInteraction, projection: sketchProjectionFeature,
      display: geometryDisplay, sketchPresentation, analysis: constraintAnalysis, redundancy: constraintRedundancy, presentation, canvasDriver: canvasTestDriver,
      history: historyController, solving: sketchSolving, blocks: blockEditingFeature, blockDefinition: blockDefinitionCommand, blockCompletion: blockCompletionCommand, blockSelection: blockSelectionQuery,
      document, readHistory: readTestHistory, resetModelState, serializeModel, loadModelData, markReferenceConstraint, pushModelConstraint, synchronizeSketchProjectionMetadata,
      clearSelection, deleteCurrentSelection, deleteElements, deleteSketch, setAppearanceForSelection: appearanceTestAction.set, version: CURRENT_JSON_VERSION,
      copySelectionToClipboard, pasteGeometryClipboard, clipboardSession,
    });
    const constraintInputObservation = constraintTestFactories.createInputObservation();
    const constraintIntentTestDriver = constraintTestFactories.createIntentResolution();
    const hoverDisplayObservation = propertiesTestFactories.createHoverObservation();
    const authoringObservation = window.CanvasTestDriver.createAuthoringObservation({
      readMode: drawOperationLifecycle.readMode, constraintTargetSession, pendingCommandSession, drawingSnap, centerlineCommand, currentScope: workspace.current,
      decorateSerializedConstraint, serializeConstraint, readPerformance: constraintCommitCommand.readPerformance, readSelectedGeometry: readTestSelectedGeometry,
    });
    const selectionTestApi = createSelectionTestApi({
      sketchMoveCommand, blockEditor, blockSelection: blockSelectionQuery, blocks: blockEditingFeature, drawingFit, canvasDriver: canvasTestDriver,
      decorateSerializedConstraint, serializeConstraint, serializeModel, resetModelState, resetHistory,
      canvasContextMenu, canvasContextController, canvasContextCandidatePresentation, canvas, viewport,
    });
    const propertyAppearanceObservation = propertiesTestFactories.createAppearanceObservation();
    const propertiesFixture = propertiesTestFactories.createFixture();
    const propertiesObservation = propertiesTestFactories.createPropertiesObservation();
    const fixedObservation = propertiesTestFactories.createFixedObservation();
    const { fixture: parameterFixture, observation: parameterObservation,
      interaction: parameterInteraction } = window.ParameterTestDriver.createBrowserSupport({
      resetModelState, documentWorkspace, geometry: geometryCreation,
      pushModelConstraint, dimensionFromAnchor, createEmptyBlockDefinition, invalidateBlockProjectionCache,
      stabilizeActiveParameterNamespace, activeSketchId, resetHistory, updateUI, draw, blockProjectionBundle, serializeModel,
      clearSelection, canvasSelection, blockSelectionGeometry, createBlockDefinitionFromSelection, blockSelectionBoundsCenter, deleteElements, document,
    });
    const dimensionDisplaySupport = createDimensionDisplayTestSupport({
      canvasHover, readDocument: () => documentModel, appearance: dimensionAppearance,
    });
    const { observation: referenceImageTestObservation, dataImport: referenceImageTestImport,
      blockFixture: referenceImageBlockFixture } = window.ReferenceImageTestDriver.createBrowserSupport({
      feature: referenceImageFeature, blocks: blockEditingFeature, canvasSelection, currentScope: workspace.current, readHistory: readTestHistory, viewport,
      fetch, File, resetModelState, openBlockDefinitionEditor, completeBlockDefinitionEdit, serializeModel,
    });
    const derivedInstanceTestApi = window.DerivedInstanceTestDriver.createForWorkspace({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, interaction: canvasInteraction, presentation,
      canvasTestDriver, document, hatchGeometryQuery, sketchPresentation, resetModelState, resetHistory,
      serializeModel, loadModelData, deleteElements, deleteCurrentSelection, normalizeGeometryInstance,
    });
    const clipboardTestSupport = window.ClipboardTestDriver.createSupport({
      currentScope: workspace.current, serializeModel, sketchContext, readSelected: readTestSelectedGeometry, canvasSelection, clipboardSession, readHistory: readTestHistory,
      resetModelState, viewport, geometry: geometryCreation, types: window.GeometrySolver, dimensionFromAnchor, arcEndpointPoint,
      rootSketchId: ROOT_SKETCH_ID, defaultSketchId: DEFAULT_SKETCH_ID, createEmptyBlockDefinition,
      appendDefinition: definition => documentModel.blockDefinitions.push(definition), nextInstanceId: () => documentIds.allocate("blockInstance"),
      invalidateBlockProjectionCache, blockProjectionBundle, pushModelConstraint, resetHistory, updateUI, draw,
    });
    const forcedConstraintCommit = constraintTestFactories.createForcedCommit();
    const drawingOrderTestApi = window.DrawingOrderTestDriver.createBrowserApi({
      drawingOrder: window.DrawingOrder, resetModelState, viewport, addPoint, addLine, currentScope: workspace.current,
      hatchGeometryQuery, DEFAULT_SKETCH_ID, DEFAULT_HATCH_APPEARANCE, ROOT_SKETCH_ID, createEmptyBlockDefinition, Point,
      Line, appendDefinition: definition => documentModel.blockDefinitions.push(definition), normalizeGeometryInstance, geometryRefForItem, invalidateBlockProjectionCache, fitSketchToViewport,
      resetHistory, updateUI, draw, canvas, worldToCanvasScreen, serializeModel,
      isRootSketch, readHistory: readTestHistory, clearSelection, canvasSelection, reorderSelectedDrawingObjects,
    });
    const hatchTestApi = window.HatchTestDriver.createBrowserApi({
      resetModelState, viewport, addPoint, addLine, addCircle, currentScope: workspace.current,
      fitSketchToViewport, activeSketchId, resetHistory, updateUI, draw, canvas, worldToCanvasScreen, serializeModel,
      readMode: drawOperationLifecycle.readMode, allHatches, hatchGeometryQuery, serializeHatch, hatchRegionErrorText, canvasSelection, hatchCommand, document,
      DEFAULT_SKETCH_ID, DEFAULT_HATCH_APPEARANCE, HATCH_SCREEN_PX_PER_MM, createEmptyBlockDefinition, Point, Line,
      appendDefinitions: (...definitions) => documentModel.blockDefinitions.push(...definitions), invalidateBlockProjectionCache,
      fitAllGeometryToViewport, blockProjectionBundle, hitBlockInstance, clearSelection, copyableSelectionPayload,
      clipboardSession, pasteGeometryClipboard, geometryRefId, blockSelectionGeometry, createBlockDefinitionFromSelection, blockSelectionBoundsCenter,
    });
    const splineTestDriver = window.SplineTestDriver.create({
      resetModelState, viewport, resizeCanvas, resetHistory, updateUI, draw, canvas, worldToCanvasScreen, serializeModel,
      readOperation: () => ({ mode: drawOperationLifecycle.mode, editSplineId: splineEditing.current?.spline?.id || null }),
      canvasSelection, document, addPoint, addSpline, hatchGeometryQuery,
      readSpline: () => editingScopeBinding.current.splines[0] || null, splineGeometry: window.SplineGeometry, addLine,
      PointOnSplineConstraint, SplineLineTangentConstraint, pushModelConstraint, solveAndRefresh, serializeConstraint,
    });
    const splineTransferDriver = window.SplineTestDriver.createTransfer({
      currentScope: workspace.current, splineGeometry: window.SplineGeometry, annotationLeaderTargetFromItem,
      nextAnnotationId: () => documentIds.allocate("annotation"), activeSketchId, defaultAnnotationStyle: DEFAULT_ANNOTATION_STYLE,
      clearSelection, canvasSelection, copyableSelectionPayload, clipboardSession, pasteGeometryClipboard,
      blockSelectionGeometry, createBlockDefinitionFromSelection, blockSelectionBoundsCenter,
      appendDefinition: definition => documentModel.blockDefinitions.push(definition), nextInstanceId: () => documentIds.allocate("blockInstance"),
      blockDefinitionDrawableSketchIds, invalidateBlockProjectionCache, blockProjectionBundle, updateUI, draw,
    });
    const interactionProfilingTestApi = window.CanvasTestDriver.createInteractionProfiling({ profiler: interactionProfiler, scheduler: pointerMoveScheduler });
    window.__jot2dTest = window.BrowserTestApi.create({
      canvas: { themeObservation, interactionProfilingTestApi, responsiveDragFixture, canvasTestDriver, viewObservation,
        hoverDisplayObservation, authoringObservation, dragExecutionSupport, canvasRenderingTestSupport, canvasRenderProbe,
        strokeStyleCases },
      splines: { splineTestDriver, splineTransferDriver },
      authoring: { hatchTestApi, drawingOrderTestApi, offsetTestSupport, trimLineTransferFixture, trimConstructionFixture,
        trimDiameterFixture },
      constraints: { forcedConstraintCommit, constraintInputObservation, constraintIntentTestDriver, constraintModelTestApi,
        constraintCaseTestApi },
      clipboard: clipboardTestSupport,
      documents: { documentTestApi, readTestHistory, cyclicReferenceFixture },
      derived: derivedInstanceTestApi,
      sketches: { sketchProjectionTestSupport, sketchTreeTestApi, sketchDeletionFixture, referenceLineMove, dependencyOrderFixture },
      images: { referenceImageTestObservation, referenceImageTestImport, referenceImageBlockFixture },
      dimensions: { dimensionDisplaySupport, dimensionFixtureSupport, dimensionInteractionSupport },
      parameters: { parameterFixture, parameterObservation, parameterInteraction },
      properties: { propertyAppearanceObservation, propertiesFixture, propertiesObservation, fixedObservation, selectionTestApi,
        sidebarInspectionFixture, sidebarHighlightObservation, sidebarHoverKeyObservation },
      annotations: annotationTestSupport,
      blocks: { blockTestSupport, blockTestActions },
    });
  }

  presentation.createCommandPanelsForEditing({
    host: canvas.parentElement, documentWorkspace, readServices: geometryReadServices, lifecycle: drawOperationLifecycle,
    projectionCommand: sketchProjectionCommand, geometryCommand: geometryInstanceCommand, sourceCommand: instanceSourceCommand,
    changeFreeProperty: changeFreeInstanceProperty, hatchCommand, annotationCommand, pngExportCommand,
  });

  const documentEditingReset = window.DocumentEditingReset.create({
    documentModel, sketchMoveCommand, activateEditingScope, flushPointerMoves: flushScheduledCanvasPointerMove,
    selectMode: drawOperationLifecycle.selectMode, clearAuthoringPerformance: constraintCommitCommand.clearPerformance,
    referenceImageRenderer, invalidateBlockProjectionCache, sketchSolving, referenceConstraintState, constraintAnalysis,
    clearSelection, geometryDrag, dimensionDrag, referenceImageInteraction, canvasNavigation, blankCanvasGesture,
    drawOperationLifecycle, pendingCommandSession, constraintTargetSession, constructionCommand, documentCanvasReset,
    geometryIds, documentIds, blockPlacementCommand, blockEditor, hatchCommand, hatchGeometryQuery, sketchTreeView, annotationDrag,
  });

  installTestHooks();
  installExpressionInputHighlights(document);
  resetModelState();
  initializePresentation("空の新規Documentを作成しました");
  resetHistory("起動");
  markDocumentFileCheckpoint("new");
  documentFileFeature.start();
})();
