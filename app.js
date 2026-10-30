/* Application composition, editing commands, Canvas UI and event handling. */
(function () {
  "use strict";
  const { formatDisplayNumber, formatDimensionLabel, formatMeasuredDimensionLabel } = window.NumberDisplay;
  const { escapeHtml } = window.HtmlText;
  const { pointInExpandedBox, lineBBox, primitiveBBox, mergeBounds, splineBBox } = window.GeometryBounds;
  const { referenceImageWorldToLocal } = window.ReferenceImageGeometry;
  const { serializeHatch, hatchAppearanceForDisplay, hatchPatternOrigin } = window.HatchData;

  const {
    CSS_PX_PER_MM, DEFAULT_HATCH_APPEARANCE, DEFAULT_ANNOTATION_STYLE,
    normalizeAppearance, normalizeDimensionAppearance,
  } = window.Appearance;
  const {
    drawingOrderOwner,
  } = window.DrawingOrder;
  const {
    fileNameStem,
    effectiveDocumentNameFromValue,
  } = window.DocumentFiles;

  const {
    MIN_ORIENTATION_LENGTH, samePosition,
    arcEndpointPoint,
    circlePointAtAngle,
    arcSweep,
    signedPointLineDistance,
  } = window.GeometryKernel;

  const {
    parseId: parseGeometryRefId,
    id: geometryRefId,
    key: geometryRefKey,
  } = window.GeometryRef;



  const {
    hypot2,
    vectorNorm,
    Point,
    Line,
    Circle,
    Arc,
    Spline,
    OffsetConstraint,
    OffsetChainConstraint,
    CoincidentConstraint,
    ArcEndpointCoincidentConstraint,
    ArcEndpointArcEndpointCoincidentConstraint,
    HorizontalConstraint,
    VerticalConstraint,
    RadiusConstraint,
    PointOnSplineConstraint,
    SplineLineTangentConstraint,
    SplineSplineTangentConstraint,
    SketchProjectionConstraint,
    ConstraintSolver,
  } = window.GeometrySolver;

  const { referencesRemovedGeometry: annotationReferencesRemovedGeometry } = window.AnnotationAnchorData;
  const constraintReferences = window.ConstraintReferences.create({ resolveGeometryRef: (ref) => resolveGeometryRef(ref) });
  const {
    constraintReferencesPoint,
    constraintGraphNodes, geometryInstanceDependencyRefs,
  } = constraintReferences;

  const {
    targetFromConstraint, angleDegrees,
    measuredConstraintTargetValue,
    angleDimensionAngles,
    isReadOnlyDimension, isDimensionConstraint,
  } = window.DimensionQueries;

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  let pngExportCommand = null;
  const presentation = window.PresentationFeature.create({
    document, storage: () => localStorage, refreshVersion: () => runtimeVersionView.render(), readDuplicateCount: () => constraintRedundancy.count,
  });
  const { settings: applicationSettings, profiler: interactionProfiler, constraintFeedback,
    log, setHint, updateUI, updateGeometrySelectionUI, updatePropertiesUI, draw } = presentation;
  const { work: profileInteractionWork, phase: profileInteractionPhase } = interactionProfiler;
  const { applicationText, translatedExactText, localizeApplicationUI,
    setApplicationLanguage, setApplicationTheme } = applicationSettings;
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
    evaluateEditingExpressionDraft: evaluateDimensionExpressionDraft, numericDimensionExpression,
    dimensionUsesExpression, expressionInputValue, expressionFromUserInput,
    ensureParameterNamespace, parameterErrorText,
  } = parameterNamespace;
  const parameterEditor = window.ParameterEditor.createForWorkspace({
    document, window, documentWorkspace, currentScope: () => editingScopeBinding.current, readBlockEditor: () => blockEditor.current,
    settings: applicationSettings, applyDraft: (...args) => parameterApplication.apply(...args),
    recordHistory, setHint, updateUI, draw, pickDimension: event => expressionInputController.pickCanvas(event),
  });
  const { syncExpressionInputHighlight, installExpressionInputHighlights } = parameterEditor;
  const {
    isRootSketch,
    sketchName, sketchById,
    descendantSketchIds,
    isReferenceSourceSketchId,
    activeSketchId, assignSketchId,
    elementSketchId, canEditSketch,
    sketchRelationToActive, constraintSketchId, isActiveSketchConstraint,
    constraintTargetsAreActive, isActiveSketchElement, isEditableSketchElement,
  } = sketchContext;

  const { geometryKindForItem, geometryRefForItem, geometryIdForItem: constraintGeometryId, geometryKeyForItem: geometryElementKey } = window.GeometryObjects;
  const { services: geometryReadServices, createEditingScope, createPersistence } = createReadContext({
    currentSketches: () => editingScopeBinding.current.sketches, prepareBlocks: ensureBlockState,
    showHiddenElements: () => viewState.showHiddenElements, viewportScale: () => viewport.scale,
    profileRead: read => interactionProfiler.active ? profileInteractionWork("geometryReads", read) : read(),
  });
  const { instances: instanceProjections, catalog: blockCatalog, projections: blockProjections, reads: geometryReads,
    geometryAppearance, dimensionAppearance, annotationAppearance, hatches: hatchGeometryQuery } = geometryReadServices;
  const { effectiveAppearanceForElement, isVisibleValue, isVisibleSketchId, isVisibleSketchElement } = geometryAppearance;
  const { effectiveDimensionAppearance, effectiveDimensionAppearanceForSketch, dimensionDisplayState } = dimensionAppearance;
  const { effectiveAnnotationStyle } = annotationAppearance;
  const { hatchPrimitivesForScope, resolvedHatchBoundary, hatchBoundaryGeometryItems } = hatchGeometryQuery;
  const { geometryInstanceBundlesForScope } = instanceProjections;
  const { blockDefinitionById, blockDefinitionDrawableSketchIds, blockDefinitionGeometrySketchIds } = blockCatalog;
  const { blockWorldPoint, createBlockProjectionBundle, blockProjectionBundle, invalidateBlockProjectionCache } = blockProjections;
  const { withGeometryReadCache, blockProjectionBundles, geometryInstanceBundles, geometryInstanceBundle, allGeometryLines, allAnnotations, allHatches, resolveGeometryRef } = geometryReads;
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
  const { sketchHasDimensionConstraint, hasDirectRadiusDimension } = dimensionModelQueries;
  function activateEditingScope(...args) { return editingScopeBinding.activate(...args); }

  const { assignSketch: assignConstraintSketchId, push: pushModelConstraint } = constraintInsertion;
  const fileSession = window.DocumentFiles.create();

  const canvasInteraction = window.CanvasInteractionFeature.create({
    sketches: sketchContext, readServices: geometryReadServices, constraintReferencesPoint, editedFitPoints: () => splineEditing.current?.spline?.fitPoints,
    isGeometryMode, setHint, applicationText, clearSnap: () => clearSnap(), clearPointerPreview: () => drawingPreview.setPointer(null),
    clearSelection, updateGeometrySelectionUI, draw,
  });
  const { lifecycle: drawOperationLifecycle, selectionFeature, selection: canvasSelection, scope: selectionScopeQuery,
    access: sketchEditAccess, pointUsage, hover: canvasHover, createOperationSessions } = canvasInteraction;
  const { exit: exitDrawMode, active: hasActiveDrawOperation, cancel: cancelActiveDrawOperation, isToolMode: isDrawToolMode } = drawOperationLifecycle;
  const { guardSketchEdit, guardSelectionEdit, canCreateInActiveSketch, rejectRootSketchCreation } = sketchEditAccess;
  const { selectionSketchId } = selectionScopeQuery;
  const {
    selectedElementCount, selectedGeometryItems, selectedPrimitives,
    selectedConstructionTogglePrimitives,
    trimConstraintSelection,
  } = canvasSelection;
  const { isPointUsedByLine, isPointUsedByCircle, isPointUsedByArc, isExplicitPoint } = pointUsage;
  presentation.bindUI({
    syncAnnotationResize: () => annotationDrag.syncResizeSelection(drawOperationLifecycle.mode === "select" && !pendingCommandSession.current && !constraintTargetSession.command),
    prepareParameterNamespace: () => ensureParameterNamespace(currentParameterNamespace()),
    refreshConstraintAnalysis, updateDocumentName: () => updateDocumentNameUI(), updateToolbar,
    renderSketch: () => sketchTreeView.render(), updateBlockUI,
    renderProperties: () => propertiesView.render(selectedPropertiesTarget()), readSketchMoving: () => sketchMoveCommand.active,
    updateStatusUI, updateConstraintButtons, syncDimensionInput: () => syncDimensionValueInput(),
    refreshSketchSelection: () => sketchTreeView.refreshSelection(),
  });
  const { controller: canvasContextController, element: canvasContextMenu, createEditingInteraction: createCanvasContextInteraction } = window.CanvasContextInteraction.createMenu({
    document, window, canvas, escapeHtml, applicationText, canvasHover, draw,
    readPresentation: () => canvasContextCandidatePresentation, readInteraction: () => canvasContextInteraction,
  });
  const closeCanvasContextMenu = canvasContextController.close;
  const { dragSources: derivedDragQueries, createCommands: createDerivedCommands } = window.DerivedInstanceFeature.createForEditing({
    documentWorkspace, readServices: geometryReadServices, references: constraintReferences, interaction: canvasInteraction, editingScope: editingScopeBinding, presentation,
  });
  const { resolve: resolveDerivedDragSource, sourceObjects: geometryInstanceSourceObjects } = derivedDragQueries;

  const annotationTargets = window.AnnotationFeature.createAnchorQuery({
    sketches: sketchContext, readServices: geometryReadServices, pointUsage, selection: canvasSelection, viewportScale: () => viewport.scale,
  });
  const { hitAnnotationTarget, annotationLeaderTargetFromItem, annotationLeaderAnchor } = annotationTargets;
  const referenceConstraintState = window.ReferenceConstraintState.create({
    currentScope: workspace.current, constraintSketchId, isReferenceSourceSketchId,
  });
  const { constraintIsOperational, wouldCreateReferenceCycle, refreshReferenceConstraintValidity } = referenceConstraintState;
  const sketchProjectionQueries = window.SketchProjectionQueries.create({
    currentScope: workspace.current, constraintIsOperational,
  });
  const { sketchProjectionConstraints, sketchProjectionConstraintForTarget, sketchProjectionConstraintsAffectingItems } = sketchProjectionQueries;
  const sketchProjectionFeature = window.SketchProjectionFeature.createForEditing({
    currentScope: () => editingScopeBinding.current, queries: sketchProjectionQueries, sketches: sketchContext, readServices: geometryReadServices,
    referenceState: referenceConstraintState, access: sketchEditAccess, selection: canvasSelection, lifecycle: drawOperationLifecycle, ids: documentIds, hover: canvasHover,
    operandElement: operand => operandElement(operand), readProjectionRectangle: (...args) => rectangleSelectionQuery.readProjection(...args),
    cancelConstraintTargetCommand, cancelPendingCommand, clearSelection, clearSnap: () => clearSnap(),
    updateToolbar, setHint, applicationText, updateUI, draw, normalizeGeometryInstance, refreshConstraintAnalysis, recordHistory,
  });
  const { command: sketchProjectionCommand, sources: sketchProjectionSources,
    guardSketchProjectionShapeEdit, sketchProjectionShapeEditBlockedMessage } = sketchProjectionFeature;
  const { sketchProjectionSourceKey,
    sketchProjectionEntryFromOperand } = sketchProjectionSources;
  const { start: startSketchProjectionCommand, toggle: toggleSketchProjectionSource,
    commit: commitSketchProjectionCommand } = sketchProjectionCommand;
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
    pointer: pointerInteractionController, createSelectionPresentation, createInputFeature: createCanvasInputFeature,
    bindEditingPointer: bindCanvasPointer, createKeyboard: createCanvasKeyboard } = operationSessions;
  const constructionCommand = window.ConstructionCommand.create({
    cancelConstraintTargetCommand, selectedConstructionTogglePrimitives, guardSketchProjectionShapeEdit, applicationText,
    synchronizeSketchProjectionMetadata: () => synchronizeSketchProjectionMetadata(), setHint, clearSelection, updateUI, draw, recordHistory,
    setLineMode: () => { drawOperationLifecycle.setMode("line"); }, resetLineInputs: () => drawOperationLifecycle.resetInputs("line"),
    clearSnap: () => clearSnap(), updateToolbar,
  });
  const { highlight: selectionHighlight, clearing: selectionClearing, documentReset: documentCanvasReset } = createSelectionPresentation({
    projections: blockProjections, constraintReferences,
  });
  const { constraintDefiningGeometryEntries, sameConstraintDisplayElement } = selectionHighlight;
  const { findArcEndpointFixedConstraint, findLineFixedConstraint, pointLockedByLineFixed } = window.ConstraintReferences.createFixedState({
    currentScope: () => editingScopeBinding.current, sameConstraintDisplayElement,
  });
  const offsetSelection = window.OffsetSelection.create({
    getModel: () => editingScopeBinding.current, activeSketchId, elementSketchId, constraintSketchId,
    Line, Arc, CoincidentConstraint, ArcEndpointCoincidentConstraint,
    ArcEndpointArcEndpointCoincidentConstraint, OffsetChainConstraint,
    onSelectionChanged: syncOffsetChainSelection,
  });
  const { add: addOffsetChainGeometry } = offsetSelection;
  const { nextSeq } = window.GeometryIds;
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
  const { clone: cloneBlockDefinition, fromSelection: createBlockDefinitionFromSelection, empty: createEmptyBlockDefinition } = blockDefinitionEditing;
  const { live: liveBlockEditorDefinition, chain: blockEditorSessionChain,
    scopeId: currentBlockDefinitionScopeId } = blockEditor;
  const { blockDefinitionScopeError } = blockEditingQueries;

  const sketchSolveResultState = window.SketchSolving.createState();
  const { hasError: sketchHasSolveError, clearSketchSolveState } = sketchSolveResultState;
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
  const { finish: finishInstanceSourceEdit } = instanceSourceCommand;
  const blockPlacementCommand = blockEditingFeature.createPlacement({
    layout: { snappedBlockRotation, blockInstanceTranslationForAnchor }, isGeometryMode, clearSelection,
    isPropertiesCollapsed: () => Boolean(document.querySelector(".workspace")?.classList.contains("properties-collapsed")),
    setPropertiesPanelCollapsed, solveAndRefresh, recordHistory,
  });
  const { start: startBlockPlacement, commit: commitBlockPlacement,
    restorePropertiesPanel: restoreBlockPlacementPropertiesPanel } = blockPlacementCommand;
  const historyFeature = window.HistoryController.createFeature({
    serializeDocument: serializeModel, document: { getName: () => documentModel.documentName,
      setName: name => { documentModel.documentName = name; }, load: loadModelData },
    blockEditor, liveBlockDefinition: liveBlockEditorDefinition, cloneBlockDefinition, serializeConstraint, decorateSerializedConstraint,
    constructionCommand, invalidateBlockProjectionCache, clearInteractionForSketchChange, solveAndRefresh, setHint,
    changed: updateHistoryButtons, log, limit: HISTORY_LIMIT, interactionProfiler,
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


  const pointerMoveScheduler = window.PointerMoveScheduler.create({
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (frame) => cancelAnimationFrame(frame),
    processMove: (pointer) => profileInteractionPhase("preview", () => {
      withGeometryReadCache(() => canvasInputBinding.processMove(pointer));
      if (pendingCommandSession.current && ["distance-value", "offset-value"].includes(pendingCommandSession.current.type)) syncDimensionValueInput();
    }),
  });
  const { flush: flushScheduledCanvasPointerMove } = pointerMoveScheduler;
  const canvasViewControls = window.CanvasViewControls.create({ document, window, setHint, draw });
  const { state: viewState, constraintStatus: constraintStatusView } = canvasViewControls;
  const MIN_ZOOM = CSS_PX_PER_MM * 0.001;
  const MAX_ZOOM = CSS_PX_PER_MM * 10000000;

  const CONSTRUCTION_EXTENSION_SCREEN_PX = 12;
  const CENTERLINE_PARALLEL_TOLERANCE = 1e-5;
  const CONSTRUCTION_GEOMETRY_ALPHA = 0.72;
  const { DIMENSION_OUTSIDE_SHAFT_LENGTH_FACTOR } = window.DimensionLayout;
  const HATCH_SCREEN_PX_PER_MM = CSS_PX_PER_MM;
  const CONSTRAINT_ACCEPT_ERROR = 1e-4;
  const resultIsAccepted = window.SketchSolving.createResultAcceptance(CONSTRAINT_ACCEPT_ERROR);
  const { candidates: constraintCandidates, operands: constraintOperandValues,
    fromSelection: constraintOperandsFromSelection, syncSelection: syncSelectionFromConstraintOperands } = selectionFeature.createConstraintOperands({
    targets: constraintTargetSession, pointer: pointerInteractionController, solver, acceptError: CONSTRAINT_ACCEPT_ERROR,
  });
  const { sameArcEndpoint, linesAreParallel } = constraintCandidates;
  const { operandElement, makeConstraintOperand, referenceTargetFromOperand, sameConstraintOperand } = constraintOperandValues;
  const PARAMETER_STABILIZATION_MAX_PASSES = 20;
  const PARAMETER_STABILIZATION_RELATIVE_TOLERANCE = 1e-7;
  const DRAG_PREVIEW_MAX_MODEL_ERROR = 0.125;
  const MIN_LINE_LENGTH = Math.max(MIN_ORIENTATION_LENGTH, solver.minLineLength || 12);
  const constrainedAnnotationDrag = window.AnnotationDrag.createConstrained({
    currentScope: workspace.current, placementAnchor: annotationPlacementAnchor, resolveGeometryRef,
    buildPlan: (...args) => buildDragSession(...args), beginGeometryDrag: (event, plan) => geometryDrag.begin(event, plan),
    leaderDisplay: annotation => annotationLeaderDisplayGeometry(annotation), leaderAnchor: annotationLeaderAnchor,
    invalidateAnalysis: () => constraintAnalysis.invalidate(), applicationText, setHint, updateUI, draw,
  });
  const solveScopeQuery = window.SolveScopeQuery.create({
    currentScope: constrainedAnnotationDrag.scope, additionalVariables: constrainedAnnotationDrag.additionalVariables,
    geometryReads, activeSketchId, elementSketchId, constraintSketchId,
    isVisibleSketchElement, constraintIsOperational, constraintGraphNodes: constraint => constraint.annotationGeometryNodes || constraintGraphNodes(constraint), geometryInstanceDependencyRefs, minimumLength: MIN_LINE_LENGTH,
  });
  const { connectedComponentFromSeeds, localSolveLines, sketchSolveConstraints } = solveScopeQuery;
  const { analysis: constraintAnalysis, redundancy: constraintRedundancy } = window.ConstraintAnalysis.createWithRedundancy({
    currentScope: workspace.current, solver, scopeQuery: solveScopeQuery, sketchContext, readServices: geometryReadServices, constraintIsOperational,
    refreshReferenceConstraintValidity, sketchHasSolveError,
    isExplicitPoint, minimumLength: MIN_LINE_LENGTH, acceptError: CONSTRAINT_ACCEPT_ERROR,
    profileAnalysis: work => interactionProfiler.active ? profileInteractionWork("analysis", work) : work(),
  });
  const { redundantConstraintInfo, constraintIsRedundant } = constraintRedundancy;
  const { statusOf: constraintStatusOf } = constraintAnalysis;
  const { viewport, navigation: canvasNavigation, createEditingWorkspace: createCanvasWorkspace } = window.CanvasDisplay.create({
    canvas, document, initialScale: CSS_PX_PER_MM, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, minLength: MIN_LINE_LENGTH,
    draw, setHint, fitVisibleGeometry: fitVisibleGeometryToViewport, flushPointerMoves: pointerMoveScheduler.flush, syncDimensionValueInput: () => syncDimensionValueInput(),
  });
  const { screenToWorld, worldToCanvasScreen, canvasPoint, visibleWorldBounds } = viewport;
  const transientAuthoring = window.TransientAuthoring.create({
    currentScope: workspace.current, ids: geometryIds, selection: canvasSelection, historySnapshot, documentHistory,
    isHistoryRestoring: () => historyController.restoring, updateHistoryButtons,
    invalidateAnalysis: () => { constraintAnalysis.invalidate(); },
  });
  const { surface: canvasSurface, exportRenderer: pngRendering, layout: canvasWorkspaceLayout, createSceneForEditing: createCanvasScene, createRendering: createCanvasRendering, createInputBinding: createCanvasInputBinding, createPngExport, dragPointer,
    dimensions: { display: dimensionDisplay, labels: { label: dimensionLabelForConstraint }, input: dimensionInput, element: dimensionValueInput } } = createCanvasWorkspace({
    dimensionScene: { currentLines: () => workspace.current().lines, minLineLength: MIN_LINE_LENGTH, canvasThemeColor,
      onExpressionMark: canvasRenderProbe.captureExpressionMark, appearance: dimensionAppearance, sketches: sketchContext },
    dimensionInput: { syncHighlight: syncExpressionInputHighlight, scheduleFrame: callback => requestAnimationFrame(callback), pending: pendingCommandSession,
      evaluateDimensionExpressionDraft, expressionFromUserInput, cancelPendingCommand, startDistanceValueInput,
      submitOffsetValue: () => submitOffsetValue(), submitDistanceValue: () => submitDistanceValue() },
    ctx, readPixelRatio: () => window.devicePixelRatio || 1, ResizeObserverClass: window.ResizeObserver, withGeometryReadCache, drawCanvas,
    isValueInputPending: () => pendingCommandSession.current && ["distance-value", "offset-value"].includes(pendingCommandSession.current.type),
    window, updatePropertiesUI, closeContextMenu: closeCanvasContextMenu, applySketchTreeWidth: () => applySketchTreeWidth(),
    applicationText, readLanguage: () => applicationSettings.language,
  });
  const { resetCanvasStrokeState, withCanvasState } = canvasSurface;
  const { DIMENSION_SCREEN_PX_PER_MM, DIMENSION_TERMINATOR_FIT_MARGIN_FACTOR } = window.DimensionMetrics;
  const { metrics: dimensionMetrics, placement: dimensionPlacement, layouts: dimensionLayouts, painter: dimensionPainter } = dimensionDisplay;
  const { controller: dimensionInputController } = dimensionInput;
  const { dimensionFromAnchor, dimensionAnchor, defaultDimensionForTarget } = dimensionPlacement;
  const { jisDimensionTextAngle, dimensionTextOffset } = dimensionLayouts;
  const { hide: hideDimensionValueInput, sync: syncDimensionValueInput, focus: focusDimensionValueInput } = dimensionInputController;
  function dimensionLayout(...args) { return dimensionDisplay.layout(...args); }
  const { commandTargets: commandTargetPresentation, sketchStyle: sketchPresentation, geometry: geometryDisplay,
    overlay: interactionOverlay, bounds: drawingBounds, fit: drawingFit } = createCanvasScene({
    currentScope: workspace.current, sketches: sketchContext, readServices: geometryReadServices, interaction: canvasInteraction,
    targets: constraintTargetSession, pending: pendingCommandSession, solveState: sketchSolveResultState, analysis: constraintAnalysis,
    readPanelSelection: () => presentation.selectedItem, instanceSources: instanceSourceCommand, projection: sketchProjectionCommand, instances: geometryInstanceCommand, operandElement,
    selectionHighlight, viewState, isSidebarHighlightedElement, canvasThemeColor, applicationText,
    constructionAlpha: CONSTRUCTION_GEOMETRY_ALPHA, constructionExtensionScreenPx: CONSTRUCTION_EXTENSION_SCREEN_PX,
    sameArcEndpoint, arcEndpointPoint, findArcEndpointFixedConstraint, pointLockedByLineFixed,
    editingQueries: { isDraggingArcEndpoint: (arc, endpoint) => geometryDrag.isArcEndpoint(arc, endpoint),
      isDraggingPoint: point => geometryDrag.isPoint(point), isDraggingCenter: point => geometryDrag.isCenter(point),
      editedSpline: () => splineEditing.current?.spline },
    annotationBounds,
  });
  const { isConstraintOperandSelected } = commandTargetPresentation;
  const { constraintStatusColor, sketchStrokeWidth, sketchAlpha } = sketchPresentation;
  const { geometryDisplayColor, traceSplinePath, drawLines, drawCircles, drawArcs, drawSplines } = geometryDisplay;
  const { sketchIdentityRelationLabel, sketchIdentityRelationColor } = interactionOverlay;
  const { sketchGeometryBounds, allGeometryBounds, visibleGeometryBounds } = drawingBounds;
  const { fitSketchToViewport, fitAllGeometryToViewport } = drawingFit;
  function fitVisibleGeometryToViewport(paddingPx = 96) { return drawingFit.fitVisibleGeometryToViewport(paddingPx); }
  const { scaleSketchForFirstDimension } = window.FirstDimensionScaling.create({
    currentScope: workspace.current, activeSketchId, constraintSketchId, elementSketchId, sketchGeometryBounds, minLength: MIN_LINE_LENGTH,
  });

  const { drawResolvedHatchContent } = window.HatchRenderer.create({ viewport, visibleWorldBounds: () => pngRendering.frame?.worldBounds || visibleWorldBounds(), canvasThemeColor, isVisibleValue });
  const hatchLayer = window.HatchRenderer.createLayer({
    ctx, drawResolvedHatchContent, hatchBoundaryGeometryItems,
    boundaryPainters: [{ type: Line, draw: drawLines }, { type: Circle, draw: drawCircles }, { type: Arc, draw: drawArcs }, { type: Spline, draw: drawSplines }],
    allHatches, isVisibleSketchId, hatchAppearanceForDisplay, isConstraintOperandSelected, canvasSelection, activeSketchId,
    readHover: () => canvasHover.current, resolvedHatchBoundary, hatchPatternOrigin, isExporting: () => Boolean(pngRendering.frame),
    sketchAlpha, readMode: drawOperationLifecycle.readMode, readCommand: () => hatchCommand,
  });
  const annotationFeature = window.AnnotationFeature.createForEditing({
    ctx, viewport, surface: canvasSurface, documentWorkspace, editingScope: editingScopeBinding,
    readServices: geometryReadServices, interaction: canvasInteraction, sessions: operationSessions, targets: annotationTargets,
    placement: dimensionPlacement, presentation, readAppearance: () => appearanceEditing,
    readExportFrame: () => pngRendering.frame, canvasThemeColor, resizeEnabled: element => annotationDrag.resizeEnabled(element),
    constraintOperandsFromSelection, recordHistory, cancelPendingCommand, cancelConstraintTargetCommand,
    startDistanceResolution, clearSelection, updateToolbar,
  });
  const { layer: annotationLayer, anchors: annotationAnchorConstraints, dimensions: annotationDimensions, command: annotationCommand,
    materialize: materializeAnnotationAnchor, dimensionScope: dimensionPresentationScope, startAnchorConstraint: startAnnotationAnchorConstraint } = annotationFeature;
  const { hitAnnotationElement: queryAnnotationElement, canvasContextAnnotationHit } = annotationFeature.spatial;
  const { annotationLeaderDisplayGeometry, drawAnnotationText, drawAnnotationLeader } = annotationFeature.renderer;
  function annotationPlacementAnchor(...args) { return annotationFeature.placementAnchor(...args); }
  const referenceImageFeature = window.ReferenceImageFeature.create({
    canvas, ctx, viewport, document, window, withCanvasState, createImage: () => new Image(),
    readImages: () => editingScopeBinding.current.referenceImages, currentScope: workspace.current, canvasSelection, readHover: () => canvasHover.current,
    isVisibleValue, isVisibleSketchId, activeSketchId, guardSketchEdit, clearSelection, applicationText, setHint, updateUI, draw, clearSnap: () => clearSnap(), hypot2,
    hitReferenceImageAt, formatDisplayNumber, recordHistory, screenToWorld, nextId: () => documentIds.allocate("referenceImage"),
    canCreateInActiveSketch, pasteGeometry: pasteGeometryClipboard, copyGeometry: copySelectionToClipboard, isGeometryMode,
    isTextEditingTarget: target => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable,
  });
  const { renderer: referenceImageRenderer, interaction: referenceImageInteraction, input: referenceImageInput } = referenceImageFeature;
  const { drawImages: drawReferenceImages, drawOverlays: drawReferenceImageOverlays } = referenceImageFeature.layer;
  const { drawDrawingStack } = window.DrawingStack.create({
    currentScope: workspace.current, activeSketchId, geometryReads,
    isVisibleSketchId, isVisibleSketchElement, hatchAppearanceForDisplay, isVisibleValue,
    painters: { hatch: items => drawHatches(items, { includePreview: false }), line: drawLines, circle: drawCircles, arc: drawArcs, spline: drawSplines },
  });
  const MIN_ARC_LENGTH = MIN_LINE_LENGTH;
  const placementPreview = window.PlacementPreviewRenderer.create({ ctx, viewport, withCanvasState, traceSplinePath,
    drawResolvedHatch, resolvedHatchBoundary, hatchAppearanceForDisplay, hatchPatternOrigin, drawAnnotationLeader, drawAnnotationText });
  const placementPreviewLayer = window.PlacementPreviewRenderer.createLayer({
    renderer: placementPreview, readMode: drawOperationLifecycle.readMode, readPointer: () => drawingPreview.pointer,
    blockPlacementCommand, geometryInstanceCommand, createBlockProjectionBundle,
  });
  const { geometry: geometryCreation, createAuthoring: createAuthoringTools } = window.BasicDrawingTools.createGeometry({
    currentScope: workspace.current, ids: geometryIds, assignSketchId, currentConstruction: () => constructionCommand.enabled,
    minLineLength: MIN_LINE_LENGTH, minArcLength: MIN_ARC_LENGTH,
    hitEndpointPoint: (x, y) => hitEndpointPoint(x, y), hitExplicitPoint: (x, y) => hitExplicitPoint(x, y),
  });
  const { addPoint, addPointToSketch, addLine, addCircle, addArc, addSpline, enforceMinimumLineLengths, normalizeArcSweeps } = geometryCreation;
  const sketchProjectionEditing = window.SketchProjectionEditing.create({
    currentScope: workspace.current, queries: sketchProjectionQueries, resolveGeometryRef, geometryRefForItem, geometryKindForItem,
    constraintSketchId, constraintIsOperational, addPointToSketch, constraintReferencesPoint, nextSeq, normalizeAppearance,
  });
  const { separateSharedSketchProjectionTargetPoints, synchronizeSketchProjectionMetadata } = sketchProjectionEditing;
  const authoringTools = createAuthoringTools({
    samePosition, sketchContext, pointUsage, geometryReads, isVisibleSketchElement,
    annotationAnchors: () => allAnnotations().filter(element => isVisibleSketchElement(element) && element.visible !== false).map(element => ({ element, ...annotationPlacementAnchor(element) })),
    scale: () => viewport.scale, transientAuthoring, pushModelConstraint, addConstraintIfMissing,
    selection: canvasSelection, preview: drawingPreview,
    checkpoint: { capture: (...args) => snapshotGeometryMutationState(...args), restore: (...args) => restoreGeometryMutationState(...args) },
    cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation,
    setMode: drawOperationLifecycle.setMode, resetEditing: () => splineEditing.reset(),
    resetBlankCandidate: () => blankCanvasGesture.resetCandidate(), updateToolbar, projection: sketchProjectionCommand, clearSelection,
    solveAndRefresh, recordHistory, applicationText, setHint, updateUI, draw, log,
  });
  const { snap: drawingSnap, spline: { command: splineCommand }, snapConstraints, tools: basicDrawingTools } = authoringTools;
  const { candidates: snapCandidates, clear: clearSnap } = drawingSnap;
  function snapForDrawing(point) { return authoringTools.snapForDrawing(point); }
  const { start: beginSplineCreation, removeLast: removeLastSplineInputPoint, finalize: finalizeSplineCreation } = splineCommand;
  const { addPointSnapConstraints } = snapConstraints;
  const { line: lineCommand, rectangle: rectangleCommand, circular: circularCommands, slot: slotCommand } = basicDrawingTools;
  const offsetFeature = authoringTools.createOffset({
    currentScope: () => editingScopeBinding.current, placement: dimensionPlacement, sourceSelection: offsetSelection,
    pending: pendingCommandSession, valueInput: dimensionInputController, viewport, ctx, withCanvasState, drawDimension, readMode: drawOperationLifecycle.readMode,
    commitNewConstraint, offsetChainErrorText,
    prepareStart: () => drawOperationLifecycle.prepare("offset"),
    updateGeometrySelectionUI, invalidateAnalysis: () => { constraintAnalysis.invalidate(); },
  });
  const { command: offsetCommand, previewLayer: offsetPreviewLayer, createGeometry: createOffsetGeometry, chainDraft: offsetChainDraft } = offsetFeature;
  const { offsetDistanceFromPointer } = offsetFeature.plans;
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
    refresh: solveRefreshCommand } = window.SketchSolvingFeature.createForWorkspace({
    documentWorkspace, scopeQuery: solveScopeQuery, references: constraintReferences, referenceState: referenceConstraintState, readServices: geometryReadServices,
    projectionEditing: sketchProjectionEditing, geometry: geometryCreation, checkpoint: editingCheckpoint, editingScope: editingScopeBinding,
    analysis: constraintAnalysis, presentation, historyController, recordHistory, resultIsAccepted, acceptError: CONSTRAINT_ACCEPT_ERROR, solveState: sketchSolveResultState,
    maxPasses: PARAMETER_STABILIZATION_MAX_PASSES, relativeTolerance: PARAMETER_STABILIZATION_RELATIVE_TOLERANCE,
  });
  const { solveSketchById,
    solveSketchAndDependents, solveConstraintComponentAndDependents } = sketchSolving;
  const { stabilize: stabilizeActiveParameterNamespace } = parameterStabilization;
  const filletCommand = authoringTools.createFillet({
    defaultDimensionForTarget, syncLineOrientationHints: () => solver.syncLineOrientationHints?.(),
    pending: pendingCommandSession, readPointer: pointerInteractionController.readLastPointer,
    prepareStart: () => drawOperationLifecycle.prepare("fillet"), guardSketchProjectionShapeEdit,
    valueInput: dimensionInputController, checkpoint: editingCheckpoint,
    stabilize: () => stabilizeActiveParameterNamespace(activeSketchId()), acceptError: CONSTRAINT_ACCEPT_ERROR,
    invalidateAnalysis: () => { constraintAnalysis.invalidate(); }, refreshConstraintAnalysis,
    updateGeometrySelectionUI,
  });
  const blockConfigurationCommand = window.BlockConfigurationCommand.create({
    currentScope: workspace.current, blockDefinitionById, blockProjectionBundle, createBlockProjectionBundle,
    blockDefinitionDrawableSketchIds, blockDefinitionGeometrySketchIds, constraintGraphNodes,
    geometryRefKey, parseGeometryRefId, annotationReferencesRemovedGeometry, guardDimensionSymbolDeletion,
    canvasSelection, clearRemovedHover: removed => { if (removed.has(canvasHover.current.dimension)) canvasHover.update({ dimension: null }); },
    invalidateBlockProjectionCache, setHint, updateBlockUI, log, updateUI, draw, recordHistory,
  });
  const { setEnabledSketchIds: setBlockInstanceEnabledSketchIds } = blockConfigurationCommand;
  const { editing: synchronizedInstanceEditing, changeProperty: changeFreeInstanceProperty, transform: instanceTransformCommand } = createInstanceEditing({
    checkpoint: editingCheckpoint, serializeModel, addPointSnapConstraints,
    rebind: () => constraintRebinding.rebuildDocument(editingScopeBinding.current, [...blockProjectionBundles(), ...geometryInstanceBundles()]),
    parameters: parameterStabilization, acceptError: CONSTRAINT_ACCEPT_ERROR, scopeQuery: solveScopeQuery, solver, solveState: sketchSolveResultState,
    blockLayout: { blockLocalGeometryBounds, snappedBlockRotation }, solving: sketchSolving, updateBlockUI, refreshConstraintAnalysis,
  });
  const { setBlockInstanceRotationLocked } = instanceTransformCommand;
  const constraintSolvePreparation = window.ConstraintSolvePreparation.createForSolver({
    solver, hasDirectRadiusDimension, offsetChainDraft, minimumOrientationLength: MIN_ORIENTATION_LENGTH, minimumLineLength: MIN_LINE_LENGTH,
  });
  const { precondition: preconditionNewConstraint } = constraintSolvePreparation;
  const dimensionValueCommand = window.DimensionValueCommand.createWithEditingSupport({
    synchronizedInstanceEditing, annotationDimensions, annotationAnchorConstraints, canvasSelection, resetDimensionDrag: () => dimensionDrag.reset(),
    canEdit: (id, operation) => guardSketchEdit(id, operation),
    renameDimension: parameterNamespace.renameDimension,
    getPending: pendingCommandSession.read, setPending: pendingCommandSession.replace,
    expressionFromUserInput, evaluateDimensionExpressionDraft, applicationText, parameterErrorText,
    setHint, syncDimensionValueInput, draw, activeSketchId, sketchHasDimensionConstraint,
    captureSketchScreenFootprint: (sketchId = activeSketchId()) => viewport.captureBoundsFootprint(sketchGeometryBounds(sketchId)),
    snapshotModelState, restoreModelState, solvePreparation: constraintSolvePreparation,
    stabilizeActiveParameterNamespace, constraintSketchId, acceptError: CONSTRAINT_ACCEPT_ERROR,
    hideDimensionValueInput, recordHistory, updateUI, scaleSketchForFirstDimension,
    targetFromConstraint, isReadOnlyDimension, defaultDimensionForTarget, expressionInputValue, numericDimensionExpression, focusDimensionValueInput,
    addDistanceConstraintFromTarget,
    restoreSketchScreenFootprint: (sketchId, footprint) => viewport.restoreBoundsFootprint(sketchGeometryBounds(sketchId), footprint),
  });
  const { submit: submitDistanceValue } = dimensionValueCommand;
  const { stabilizeDocument: stabilizeDocumentParameters, createApplication: createParameterApplication } = window.ParameterApplication.createEditingSupport({
    namespace: parameterNamespace, currentScope: workspace.current, acceptError: CONSTRAINT_ACCEPT_ERROR, applicationText,
    readEditingScope: () => editingScopeBinding.current, readBlockEditor: () => blockEditor.current,
    snapshotDocument: historySnapshot, snapshotValues: snapshotModelState, restoreValues: restoreModelState,
    loadDocument: loadModelData, readDocumentName: () => documentModel.documentName,
    stabilizeNamespace: stabilizeActiveParameterNamespace, stabilizeStoredNamespace: storedDefinitionStabilization.stabilize,
    activeSketchId, isRootSketch,
  });
  const blockParameterPropagation = blockEditingFeature.createPropagation({
    clearSelection, applicationText,
    stabilizeDefinition: storedDefinitionStabilization.stabilize, stabilizeDocument: stabilizeDocumentParameters,
  });
  const parameterApplication = createParameterApplication({ propagate: blockParameterPropagation.propagate });
  const centerlineCommand = authoringTools.createCenterline({
    commitNewConstraint,
    parallelTolerance: CENTERLINE_PARALLEL_TOLERANCE,
    invalidateAnalysis: () => { constraintAnalysis.invalidate(); },
  });
  const { start: startCenterlineCommand, projectPointToCenterlineSupport } = centerlineCommand;
  const { renderer: { drawFilletArc: drawFilletPreviewArc }, layer: authoringPreviewLayer } = authoringTools.createPreview({
    ctx, viewport, withCanvasState, traceSplinePath, readMode: drawOperationLifecycle.readMode, centerlineCommand,
    readCanvasSize: () => ({ width: canvas.clientWidth, height: canvas.clientHeight }),
  });
  const { INACTIVE_CONSTRAINT_STATUS_COLOR } = window.GeometryPresentation;
  const runtimeVersionView = window.RuntimeVersionView.create({ document, applicationText });

  const constraintButtons = Array.from(document.querySelectorAll("[data-constraint]"));
  const constraintMenuButtons = Array.from(document.querySelectorAll("[data-menu-constraint]"));
  const fixPointBtn = document.getElementById("fixPointBtn");
  const commandCursor = window.CommandCursor.create({ document, canvas, fixPointBtn, constraintButtons });

  applicationSettings.prepareButtonTooltips();

  const { localizedConstraintName } = constraintFeedback;

  function effectiveDocumentName() {
    return effectiveDocumentNameFromValue(documentModel.documentName);
  }

  const documentFileFeature = window.DocumentFileFeature.create({
    window, document, fileSession, applicationText,
    readDocumentName: () => documentModel.documentName, currentSnapshot: () => documentHistory.currentSnapshot,
    isEditingBlock: () => Boolean(blockEditor.current), serializeModel, requestChoice: options => choiceDialog.show(options),
    loadModelData, solveAndRefresh, resetHistory, fitAllGeometryToViewport,
    repairMessage: () => documentApplication.blockConstraintRepairMessage, setHint, log, draw,
  });
  const { refreshStatus: updateDocumentNameUI, markCheckpoint: markDocumentFileCheckpoint,
    save: saveJot2DFile, saveAs: saveJot2DFileAs, importFileData } = documentFileFeature;




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

  const { beginDrag: beginReferenceImageDrag } = referenceImageInteraction;

  function decorateSerializedConstraint(data, constraint) { return constraintMetadata.decorate(data, constraint); }








  const sceneHitInteraction = window.CanvasHitInteraction.createScene({
    currentScope: workspace.current, dimensionScope: dimensionPresentationScope, viewport, pointUsage, sketchContext, geometryAppearance,
    geometryReads, catalog: blockCatalog, projections: blockProjections, hatches: hatchGeometryQuery, dimensions: dimensionDisplay,
    effectiveDimensionAppearance, dimensionLabelForConstraint, dimensionUsesExpression, annotationBounds, hitAnnotationElement,
    hatchAppearanceForDisplay, targetFromConstraint, drawingOrderOwner, referenceImageWorldToLocal, pointInExpandedBox,
    readMode: drawOperationLifecycle.readMode, readPendingCommand: () => pendingCommandSession.current, readConstraintCommand: () => constraintTargetSession.command,
    operandValues: constraintOperandValues,
  });
  const { ordinarySelectionMode } = sceneHitInteraction.policy;














  function solveAndRefresh(...args) { return solveRefreshCommand.run(...args); }


  function refreshConstraintAnalysis(options = {}) { return constraintAnalysis.refresh(options); }



  function canvasThemeColor(value) {
    return window.CanvasThemeColors.color(value, applicationSettings.theme);
  }












  const circleCenterCrossCommand = authoringTools.createCircleCenterCross({
    checkpoint: editingCheckpoint, solveSketchAndDependents, resultIsAccepted, minOrientationLength: MIN_ORIENTATION_LENGTH,
    selectedElementCount, invalidateAnalysis: () => constraintAnalysis.invalidate(),
  });
  const { start: startCircleCenterCrossCommand } = circleCenterCrossCommand;

  const lineCollapseQuery = window.LineCollapseQuery.create({
    connectedComponentFromSeeds, constraintGraphNodes, localSolveLines, minLineLength: MIN_LINE_LENGTH,
  });

  const splineEditing = window.SplineEditCommand.create({
    canEditStructure: item => guardSketchEdit(elementSketchId(item), "structure"),
    currentScope: () => editingScopeBinding.current, ids: geometryIds, clearSelection, canvasSelection, applicationText, setHint, updateUI, draw,
    restoreModelState, snapshotModelState, stabilizeActiveParameterNamespace, elementSketchId,
    invalidateAnalysis: () => constraintAnalysis.invalidate(), recordHistory, guardSketchProjectionShapeEdit,
    addPoint, isPointUsedByLine, isPointUsedByCircle, isPointUsedByArc, constraintReferencesPoint,
    guardDimensionSymbolDeletion, geometryElementKey, annotationReferencesRemovedGeometry,
  });
  const { addPoint: addSplineFitPointFromContext, deletePoint: deleteSplineFitPointFromContext } = splineEditing;

  const blockSelectionQuery = window.BlockSelectionQuery.create({
    currentScope: workspace.current, canvasSelection, blockProjectionBundle, elementSketchId, activeSketchId,
    constraintGraphNodes, serializeConstraint, constraintLabelForList: (constraint) => localizedConstraintName(constraint.name), resolveGeometryRef,
    applicationText, mergeBounds, lineBBox, primitiveBBox, splineBBox, annotationBounds,
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
  const { startCreation: startBlockCreation, open: openBlockDefinitionEditor, enter: enterBlockDefinitionEdit,
    cancel: cancelBlockDefinitionEdit } = blockDefinitionCommand;
  const { complete: completeBlockDefinitionEdit } = blockCompletionCommand;

  function syncOffsetChainSelection() { return canvasSelection.applyOffsetSelection(offsetSelection); }

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

  const dxfImportFeature = documentFileFeature.createDxfForEditing({
    documentWorkspace, geometry: geometryCreation, interaction: canvasInteraction, sessions: operationSessions,
    minimumLength: MIN_LINE_LENGTH, clearSelection, updateUI, recordHistory,
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


  const { selectionBounds: dimensionSelectionBounds, layer: dimensionLayer } = dimensionDisplay.createTraversal({
    currentScope: dimensionPresentationScope, isActiveSketchConstraint, isVisibleSketchId, constraintSketchId, isVisibleValue, canvasSelection,
    readHoverDimension: () => canvasHover.current.dimension, readDraggedDimension: () => dimensionDrag.constraint,
    readPending: () => pendingCommandSession.current, readExportFrame: () => pngRendering.frame,
    readConstraintStatus: () => viewState.constraintStatus, inactiveColor: INACTIVE_CONSTRAINT_STATUS_COLOR,
    dimensionLabelForConstraint, dimensionUsesExpression,
  });

  const { query: rectangleSelectionQuery, rectangle: selectionRectangle } = window.RectangleSelectionFeature.create({
    currentScope: dimensionPresentationScope, viewport, canvasSelection, selectionScope: selectionScopeQuery,
    sketches: sketchContext, pointUsage, appearance: geometryAppearance, geometryReads, projections: blockProjections,
    hatches: hatchGeometryQuery, dimensionBounds: dimensionSelectionBounds, annotationBounds, hatchAppearanceForDisplay,
    readMode: drawOperationLifecycle.readMode, instanceSourceCommand, geometryInstanceCommand, sketchProjection: sketchProjectionFeature,
    releasePointer: (id) => { try { canvas.releasePointerCapture(id); } catch (_) {} },
    clearSelection, setHint, updateGeometrySelectionUI, draw,
  });

  function drawBlockInstanceHandles() {
    resetCanvasStrokeState();
  }








  function drawResolvedHatch(...args) { return hatchLayer.drawResolvedHatch(...args); }

  function drawHatches(...args) { return hatchLayer.drawHatches(...args); }






  const canvasFrameRenderer = createCanvasRendering({
    recordDraw: () => pointerMoveScheduler.recordDraw(),
    geometry: geometryDisplay, dimensions: dimensionLayer, drawDimensionPreview, annotations: annotationLayer,
    authoringPreview: authoringPreviewLayer, placements: placementPreviewLayer, offsetPreview: offsetPreviewLayer,
    drawBlockInstanceHandles, drawSnapMarker, drawReferenceImages, drawHatches, drawDrawingStack, drawReferenceImageOverlays,
    drawSketchIdentityLabel, drawSelectionRect, drawExportOverlay: () => pngExportCommand?.drawOverlay(ctx, viewport.scale),
  });

  function drawCanvas() { return canvasFrameRenderer.draw(); }


  function drawSelectionRect() { return interactionOverlay.drawSelectionRect(selectionRectangle.preview()); }














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












  function drawSnapMarker() { interactionOverlay.drawSnapMarker(drawingSnap.active); }
  function drawSketchIdentityLabel() {
    interactionOverlay.drawSketchIdentityLabel({ hoveredIdentity: canvasHover.current.sketchIdentity, selection: canvasSelection, pointer: pointerInteractionController.lastWorld });
  }




  function selectedVisibilityTargets() { return propertySelection.visibilityTargets(); }
  function selectionVisibilityIsHidden(targets) { return propertySelection.visibilityIsHidden(targets); }
  function toggleSelectedVisibility() { return selectionVisibilityCommand.toggle(); }

  const { view: toolbarView, status: commandStatusView } = toolbarPresentation.createControls({
    selectedVisibilityTargets, selectionVisibilityIsHidden,
    canEditTarget: target => canEditSketch(target.kind === "constraint" ? constraintSketchId(target.item) : elementSketchId(target.item)),
    updateCursor: commandCursor.update,
  });
  function updateToolbar() { toolbarView.update(); }

  const { selectionQuery: constraintSelectionQuery, targets: constraintTargetCommand, dimensions: dimensionPlacementCommand,
    createCommit: createConstraintCommit, createFixedEditing, constraintTargetHint,
    input: { updateHover: updatePendingDistanceRetargetHover, createWithDragging: createConstraintInputWithDragging },
    controls: { view: constraintControlsView, createBinding: createConstraintControlBinding } } = window.ConstraintEditing.createWithControls({
    retargeting: { canvasHover, canvasPoint, referenceTargetFromOperand },
    controls: { document, constraintMenuButtons, fixPointBtn, translatedExactText },
    constraintButtons, feedback: constraintFeedback, readLanguage: () => applicationSettings.language,
    session: constraintTargetSession, selection: canvasSelection, pending: pendingCommandSession, candidates: constraintCandidates,
    lifecycle: drawOperationLifecycle, valueInput: dimensionInputController,
    resolveConstraintIntent, constraintOperandsFromSelection, activeSketchId, isGeometryMode,
    elementSketchId, canEditSketch, findLineFixedConstraint, selectedGeometryItems, guardSketchEdit, guardSelectionEdit, startAnnotationAnchorConstraint,
    clearSelection, trimConstraintSelection, commitConstraintResolution, syncSelectionFromConstraintOperands,
    updateToolbar, updateConstraintButtons, setHint, draw,
    blurConstraintControl: () => { if (document.activeElement instanceof HTMLElement && document.activeElement.matches("[data-constraint], #fixPointBtn")) document.activeElement.blur(); },
    addConstraint, annotationAnchorConstraints, hitConstraintOperand,
    toggleGeometryFixedOperand, toggleSelectedFixed, updateGeometrySelectionUI, types: { Circle, Arc },
    isPlacingInstance: geometryInstanceCommand.isPlacing, geometryInstanceBundle, targetFromConstraint, cancelPendingCommand,
    selectedPrimitives, placement: dimensionPlacement, angleDegrees, angleDimensionAngles, readOnlyDimensionConstraintForPlacement,
    addReadOnlyDimensionConstraint, makeConstraintOperand, sameConstraintOperand, applicationText, log,
  });

  function cancelConstraintTargetCommand(message) { return constraintTargetCommand.cancel(message); }
  function completePendingDimensionLineLength() { return constraintTargetCommand.completeLineLength(); }

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











  const { selection: propertySelection, createEditing: createPropertyEditing } = window.PropertiesDisplay.createFeature({
    document, documentModel, currentScope: workspace.current, canvasSelection, readServices: geometryReadServices, sketchContext, hatchAppearanceForDisplay,
    operations: { lifecycle: drawOperationLifecycle, sources: instanceSourceCommand, placement: geometryInstanceCommand, blocks: blockPlacementCommand },
  });
  function selectedPropertiesTarget() { return propertySelection.selectedDisplayTarget(); }
  const { editing: propertyEditing, appearanceUI, createViewForEditing: createPropertiesView } = createPropertyEditing({
    appearanceScope: () => editingScopeBinding.current, viewport, checkpoint: editingCheckpoint, parameterStabilization,
    guardSketchProjectionShapeEdit, synchronizeSketchProjectionMetadata, materializeAnchor: materializeAnnotationAnchor,
    isGeometryMode, toggleSketchVisibility, guardSelectionEdit, applicationSettings, escapeHtml,
    invalidateBlockProjectionCache, recordHistory, updateUI, updatePropertiesUI, draw,
  });
  const { appearanceEditing, visibility: selectionVisibilityCommand } = propertyEditing;
  const propertiesView = createPropertiesView({
    sketchProjectionConstraintForTarget,
    constraintGeometryId, constraintFeedback, constraintStatusOf, snappedBlockRotation, constraintDefiningGeometryEntries,
    resolvedHatchBoundary, hatchRegionErrorText,
    geometryInstanceTypeLabel, parameterNamespace, installExpressionInputHighlights,
    HTMLTextAreaElement, HTMLInputElement,
    changeFreeInstanceProperty, commitAnnotationParameterEdit, setHint, annotationCommand,
    access: sketchEditAccess, instanceTransform: instanceTransformCommand, blockConfiguration: blockConfigurationCommand,
    dimensionValues: dimensionValueCommand, dimensions: dimensionPlacementCommand, referenceImages: referenceImageInteraction, hatch: hatchCommand, splineEditing,
  });









































  function updateStatusUI() { return commandStatusView.update(); }




  function addReadOnlyDimensionConstraint(...args) { return constraintCommitCommand.readOnly(...args); }

  const { command: constraintCommitCommand, readOnly: dimensionReadOnlyQuery, createIntentResolver: createConstraintIntentResolver } = createConstraintCommit({
    linesAreParallel, assignSketch: assignConstraintSketchId, probeRedundancy: constraintRedundancy.probeCandidate,
    currentScope: workspace.current, forgetConstraint: constraintRedundancy.forgetConstraint,
    constraintTargetsAreActive, snapshotModelState, restoreModelState,
    solvePreparation: constraintSolvePreparation, pushModelConstraint,
    solveConstraintComponentAndDependents, isDimensionConstraint, isReadOnlyDimension, stabilizeActiveParameterNamespace,
    constraintSketchId, lineCollapseQuery, redundantConstraintInfo, acceptError: CONSTRAINT_ACCEPT_ERROR,
    measuredConstraintTargetValue,
    refreshConstraintAnalysis, updateUI,
    recordHistory, isReferenceSourceSketchId, descendantSketchIds, wouldCreateReferenceCycle,
    sketchName, now: () => performance.now(),
  });
  function commitNewConstraint(...args) { return constraintCommitCommand.ordinary(...args); }
  function markReferenceConstraint(...args) { return constraintCommitCommand.markReference(...args); }

  const constraintIntentResolver = createConstraintIntentResolver({
    operands: constraintOperandValues, types: { PointOnSplineConstraint, SplineLineTangentConstraint, SplineSplineTangentConstraint },
    isActiveSketchElement, isEditableSketchElement,
  });
  function resolveConstraintIntent(type, operands) { return constraintIntentResolver.resolve(type, operands); }


  function startDistanceResolution(resolution, pointer) { return dimensionPlacementCommand.startDistanceResolution(resolution, pointer); }

  function commitConstraintResolution(...args) { return constraintCommitCommand.resolution(...args); }

  function readOnlyDimensionConstraintForPlacement(target, value, dimension, options = {}) {
    return dimensionReadOnlyQuery.forPlacement(target, value, dimension, options);
  }

  function addDistanceConstraintFromTarget(...args) { return constraintCommitCommand.dimension(...args); }

  function addConstraint(type) { return constraintCommitCommand.fromSelection(type); }

  const geometryDragFeature = window.GeometryDragFeature.createForEditing({
    solver, currentScope: workspace.current, sketches: sketchContext, scopeQuery: solveScopeQuery, solving: sketchSolving,
    checkpoint: editingCheckpoint, geometry: geometryCreation, readServices: geometryReadServices,
    viewport, pointer: dragPointer, profiler: interactionProfiler, acceptError: CONSTRAINT_ACCEPT_ERROR,
    previewMaxModelError: DRAG_PREVIEW_MAX_MODEL_ERROR, minimumLength: MIN_ORIENTATION_LENGTH,
    blockLocalGeometryBounds, blockWorldPoint, pointLockedByLineFixed, findLineFixedConstraint, findArcEndpointFixedConstraint,
    projectionConstraintsForItems: sketchProjectionConstraintsAffectingItems,
    projectionBlockedMessage: () => sketchProjectionShapeEditBlockedMessage(applicationText("ドラッグ", "Drag")),
    canEdit: guardSketchEdit, canvasSelection, stabilizeActiveParameterNamespace, refreshConstraintAnalysis,
    applicationText, setHint, updateUI, updateGeometrySelectionUI, draw, recordHistory,
    geometryInstanceSourceObjects, clearSelection, resolveDerivedDragSource,
  });
  const { command: geometryDrag, build: buildDragSession, beginDerived: beginDerivedGeometryDrag } = geometryDragFeature;

  const { input: constraintInputFeature, dragging: dimensionDragFeature } = createConstraintInputWithDragging({
    viewport, currentScope: workspace.current, sketches: sketchContext, readServices: geometryReadServices, pointer: dragPointer,
    clearSnap, updateUI, recordHistory,
  });
  const { command: dimensionDrag } = dimensionDragFeature;
  const { begin: beginDimensionDrag } = dimensionDrag;







  const { begin: beginBlockDrag } = geometryDragFeature.createBlockEntry();



  const trimFeature = authoringTools.createTrim({
    references: constraintReferences, checkpoint: editingCheckpoint, hitSketchIdentityElement, guardSketchEdit, guardSketchProjectionShapeEdit,
    stabilizeActiveParameterNamespace, acceptError: CONSTRAINT_ACCEPT_ERROR,
    invalidateAnalysis: () => constraintAnalysis.invalidate(), refreshConstraintAnalysis,
  });

  const { candidatesAt: canvasContextCandidatesAt } = sceneHitQueries.createContextQuery({
    editedFitPoints: () => splineEditing.current?.spline?.fitPoints, canvasContextAnnotationHit,
  });

  const canvasContextCandidatePresentation = window.CanvasContextPresentation.create({
    toolbarSvgMarkup, applicationText, formatDisplayNumber, constraintToolbarIcon, localizedConstraintName,
    blockDefinitionById, geometryInstanceTypeLabel, hatchPatternTypeLabel, hatchAppearanceForDisplay,
  });












  const canvasCommandCancellation = window.CanvasCommandCancellation.create({
    instances: geometryInstanceCommand,
    readMode: drawOperationLifecycle.readMode, selectMode: drawOperationLifecycle.selectMode, blockPlacementCommand, drawingPreview, restoreBlockPlacementPropertiesPanel,
    readPending: pendingCommandSession.read, cancelPendingCommand, readConstraintCommand: () => constraintTargetSession.command, cancelConstraintTargetCommand,
    drawing: { active: hasActiveDrawOperation, cancel: cancelActiveDrawOperation, isToolMode: isDrawToolMode, exit: exitDrawMode },
    applicationText, setHint, updateUI, draw,
  });


  const { topmostOwner: topmostDrawingOrderOwner, state: drawingOrderCommandState, reorder: reorderSelectedDrawingObjects } = window.DrawingOrderCommand.create({
    currentScope: () => editingScopeBinding.current, canvasSelection, activeSketchId, selectionSketchId, ordinarySelectionMode,
    guardSelectionEdit, updateUI, draw, recordHistory, applicationText, setHint,
  });














  const canvasContextInteraction = createCanvasContextInteraction({
    selection: canvasSelection, selectionScope: selectionScopeQuery, sketches: sketchContext, access: sketchEditAccess,
    constraintSelection: constraintSelectionQuery, blockQueries: blockEditingQueries, dimensions: dimensionDragFeature,
    cancellation: canvasCommandCancellation, clipboard: clipboardFeature, history: historyController,
    pointer: pointerInteractionController, viewport, projection: sketchProjectionCommand,
    sameArcEndpoint, clearSelection, arcEndpointPoint, findLineFixedConstraint, findArcEndpointFixedConstraint,
    readMode: drawOperationLifecycle.readMode, visibleGeometryBounds, pendingCommandSession, constraintTargetSession, splineEditing, isReadOnlyDimension,
    selectedConstructionTogglePrimitives, drawingOrderCommandState, handleConstraintOperandClick, updateUI, isGeometryMode,
    closeAppMenus: () => closeAppMenus(), canvasContextCandidatesAt,
    copySelectionToClipboard, imageClipboard,
    showSelectedObjectProperties: canvasWorkspaceLayout.showSelectedObjectProperties, fixPointBtn, enterBlockDefinitionEdit,
    setBlockInstanceRotationLocked, startDimensionEditInput, updateGeometrySelectionUI, recordHistory, setHint, sketchMoveCommand,
    startHatchBoundaryRepair, reorderSelectedDrawingObjects, addSplineFitPointFromContext, deleteSplineFitPointFromContext, fitVisibleGeometryToViewport,
  });
  canvasContextController.start();

  const canvasInputFeature = createCanvasInputFeature({
    document, canvas, updateUI,
    annotationCommand, annotationDrag, startAnnotationAnchorConstraint, constraintInputFeature, dimensionDragging: dimensionDragFeature, beginDimensionDrag,
    constraintTargetHint,
    instanceSourceCommand, geometryInstanceCommand, sceneQueries: sceneHitQueries, operandElement, toggleSketchProjectionSource,
    clearSnap, selectionRectangle, drawingSnap, viewport, geometryRefForItem, resolveGeometryRef, snapForDrawing, transientAuthoring,
    createDrawingInput: () => authoringTools.createCanvasInput({ readMode: drawOperationLifecycle.readMode,
      centerline: centerlineCommand, circleCenterCross: circleCenterCrossCommand, fillet: filletCommand, trim: trimFeature, offset: offsetCommand }),
    sameArcEndpoint, topmostDrawingOrderOwner, drawingOrderOwner, beginDerivedGeometryDrag, beginBlockDrag, beginReferenceImageDrag, buildDragSession, geometryDrag,
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
    pointer: pointerInteractionController, readCommandPanel: presentation.readCommandPanel, readPngExportCommand: () => pngExportCommand,
    blankCanvasGesture, isBlankCommandPanelPoint, scheduler: pointerMoveScheduler,
    profileCommit: work => profileInteractionPhase("commit", work),
  });
  canvasInputBinding.bind();
  dimensionInput.bind();

  const keyboardInput = createCanvasKeyboard(canvasInputFeature, {
    window, menus: { closeSketch: () => sketchContextController.close(),
      canvasVisible: () => canvasContextMenu && !canvasContextMenu.hidden, closeCanvas: closeCanvasContextMenu },
    sketchMove: sketchMoveCommand, constraintStatusView, dimensionInput: dimensionInputController,
    shortcuts: { save: saveJot2DFile, saveAs: saveJot2DFileAs, copy: copySelectionToClipboard,
      paste: pasteGeometryClipboard, nativePaste: true, nativeCopy: true, undo: undoHistory, redo: redoHistory },
    projection: sketchProjectionCommand,
    referenceImage: referenceImageInteraction, splineEditing, blockPlacement: blockPlacementCommand,
    cancelPendingCommand, cancelConstraintTargetCommand,
    finishSpline: finalizeSplineCreation, finishProjection: commitSketchProjectionCommand, finishHatch: hatchCommand.finish,
    removeSplinePoint: removeLastSplineInputPoint, offset: offsetCommand,
    deleteSelection: deleteCurrentSelection, completeLineLength: completePendingDimensionLineLength,
    isTextEditingTarget: target => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable,
  });
  keyboardInput.start();
  canvasViewControls.bindWindow();

  const editingToolBinding = toolbarPresentation.createEditingBinding({
    undo: undoHistory, redo: redoHistory, toggleVisibility: toggleSelectedVisibility, deleteSelection: deleteCurrentSelection, annotation: annotationCommand,
  });
  editingToolBinding.bind();
  canvasViewControls.bindControls();







  const toolNavigation = presentation.createToolNavigation({ window });
  const { close: closeAppMenus } = toolNavigation;
  toolNavigation.start();
  canvasWorkspaceLayout.bindControls();
  parameterEditor.start();
  appearanceUI.start();
  applicationSettings.start();
  blockView.bind();

  const drawingToolBinding = toolbarPresentation.createDrawingBinding({
    startCenterlineCommand, startCircleCenterCrossCommand, startSketchProjectionCommand, startGeometryInstanceCommand,
    filletCommand, startBlockCreation, offsetCommand, beginSplineCreation, startHatchCreation,
  });
  drawingToolBinding.bind();

  documentFileFeature.bindControls();
  const pngExport = createPngExport({
    documentName: effectiveDocumentName, prepareImages: referenceImageFeature.prepareImages,
    pendingCommandSession, fileSession, drawOperationLifecycle, constraintTargetSession,
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
    const historyObservation = window.DocumentTestDriver.createHistoryObservation({ activeEditHistory, blockEditor, document, constructionCommand });
    const readTestHistory = historyObservation.state;
    const { readSelectedGeometry: readTestSelectedGeometry, createApi: createSelectionTestApi } = window.CanvasSelectionTestDriver.createSupport({
      canvasSelection, currentScope: workspace.current, clearSelection, updateUI, draw,
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
    const { support: dimensionTestSupport, fixtures: dimensionFixtureSupport } = window.DimensionTestDriver.createForEditing({
      geometry: geometryCreation, display: dimensionDisplay, sketches: sketchContext, appearance: geometryAppearance,
      currentScope: workspace.current, viewport, canvasSelection, resetModelState, addDistanceConstraintFromTarget,
      dimensions: dimensionPlacementCommand, serializeModel, serializeDimension, constraintTargetSession, pendingCommandSession,
      dimensionValueInput, ctx, layer: dimensionLayer, dimensionLabelForConstraint,
    });
    const { lineTransfer: trimLineTransferFixture, constructionBoundary: trimConstructionFixture, diameterTransfer: trimDiameterFixture } = window.TrimTestDriver.createFeature({
      feature: trimFeature, resetModelState, geometry: geometryCreation, pushModelConstraint, currentScope: workspace.current,
    });
    const canvasTestDriver = window.CanvasTestDriver.createDisplaySupport({
      viewport, canvas, resizeCanvas, draw, resetModelState, geometry: geometryCreation, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID,
      fitAllGeometryToViewport, allGeometryBounds, visibleGeometryBounds, isVisibleSketchId, updateUI, readUnits: () => documentModel.units, cssPxPerMm: CSS_PX_PER_MM,
      snapCandidates, hits: { hitArcEndpoint, hitPoint, hitLine, hitCircle, hitArc, hitSpline, hitDimension },
      evaluateSpline: window.SplineGeometry.evaluate, elementFromPoint: (x, y) => document.elementFromPoint(x, y),
    });
    const canvasRenderingTestSupport = window.CanvasRenderTestDriver.createRenderingSupport({
      setMode: drawOperationLifecycle.setMode, lineCommand, rectangleCommand, slotCommand, circularCommands, offsetSelection, drawingPreview, addLine, addPoint,
      authoringPreviewLayer, offsetPreviewLayer, placementPreviewLayer, createEmptyBlockDefinition, Point, Line, defaultSketchId: DEFAULT_SKETCH_ID,
      appendDefinition: definition => documentModel.blockDefinitions.push(definition), blockPlacementCommand, activeSketchId, currentScope: workspace.current,
      canvasSelection, drawBlockInstanceHandles, resetModelState, viewport, selectionRectangle, ctx, drawSelectionRect, drawAnnotationLeader, draw,
      drawLines, canvasHover, invalidateBlockProjectionCache, blockProjectionBundle, allGeometryLines, effectiveAppearanceForElement,
    });
    const sketchDeletionFixture = window.DocumentTestDriver.createSketchDeletionFixture({ resetModelState, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID, addPoint, addLine, addCircle, geometryRefForItem, deleteSketch });
    const propertiesTestFactories = window.PropertiesTestDriver.createBrowserFactories({
      documentWorkspace, geometry: geometryCreation, readServices: geometryReadServices, interaction: canvasInteraction, blockQueries: blockEditingQueries,
      selectionHighlight, presentation, display: geometryDisplay, placement: dimensionPlacement, viewport, document, canvas, fixPointBtn,
      readHistory: readTestHistory, resetModelState, clearSelection, resetHistory, fitAllGeometryToViewport, pushModelConstraint,
      assignConstraintSketchId, recordHistory, canvasThemeColor, isSidebarHighlightedElement, selectedPropertiesTarget,
      findLineFixedConstraint, constructionAlpha: CONSTRUCTION_GEOMETRY_ALPHA,
    });
    const strokeStyleCases = propertiesTestFactories.createStrokeStyleCases();
    const sketchTreeTestApi = window.SketchTreeTestDriver.createBrowserApi({
      resetModelState, sketchById, defaultSketchId: DEFAULT_SKETCH_ID, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID, addPoint, addLine,
      refreshReferenceConstraintValidity, fitAllGeometryToViewport, updateUI, draw, canvas, worldToCanvasScreen, sketchRelationToActive,
      sketchIdentityRelationLabel, sketchIdentityRelationColor, document, getComputedStyle: element => getComputedStyle(element), isVisibleSketchId,
      serializeModel, sketchStrokeWidth, constraintStatusColor, activeSketchId, addDistanceConstraintFromTarget, dimensionFromAnchor, isDimensionConstraint,
      createEmptyBlockDefinition, Point, Line, appendDefinition: definition => documentModel.blockDefinitions.push(definition),
      nextInstanceId: () => documentIds.allocate("blockInstance"), invalidateBlockProjectionCache, viewport, dimensionLayout, targetFromConstraint,
      clientPosition: canvasTestDriver.clientPosition, blockInstanceDisplayCenter, canvasHover, addCircle, addArc, blockProjectionBundle,
    });
    const referenceLineMove = constraintTestFactories.createReferenceLineMove();
    const dependencyOrderFixture = constraintTestFactories.createDependencyOrderFixture();
    const cyclicReferenceFixture = window.DocumentTestDriver.createCyclicReferenceFixture({
      resetModelState, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID, defaultSketchId: DEFAULT_SKETCH_ID, addPoint, markReferenceConstraint, CoincidentConstraint, serializeModel, loadModelData,
      refreshConstraintAnalysis, updateUI, constraintIsOperational, readReferenceErrors: () => referenceConstraintState.errorReasons(), document,
    });
    const constraintCaseTestApi = constraintTestFactories.createEditingCases();
    const blockTestSupport = window.BlockTestDriver.createBrowserSupport({
      geometry: geometryCreation, modelTypes: window.GeometrySolver, documentModel, currentScope: workspace.current, sketches: sketchContext,
      projections: blockProjections, reads: geometryReads, queries: blockEditingQueries, selection: canvasSelection,
      editor: blockEditor, editorChain: blockEditorSessionChain, placement: blockPlacementCommand, readMode: drawOperationLifecycle.readMode, solver,
      canvas, viewport, worldToCanvasScreen, resetModelState, pushModelConstraint, fitAllGeometryToViewport, updateUI, draw, commitBlockPlacement,
      solveSketchById, recordHistory, serializeConstraint, createSketch, cancelBlockDefinitionEdit, completeBlockDefinitionEdit,
      setBlockInstanceEnabledSketchIds, serializeModel, loadModelData, enterBlockDefinitionEdit, blockInstanceDisplayCenter,
      buildDragSession, constraintTargetSession, canvasHover, blockSelectionGeometry, geometryRefForItem,
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
    const documentTestApi = window.DocumentTestDriver.createFileApi({
      performance, File, document, fileSession, readDocumentName: () => documentModel.documentName,
      effectiveDocumentName, serializeModel, importFileData, loadModelData,
      fileNameStem, resetHistory, updateUI, draw, currentScope: workspace.current,
    });
    const viewObservation = window.CanvasTestDriver.createViewObservation({ viewState, constraintStatusView });
    const responsiveDragFixture = window.GeometryDragTestDriver.createResponsiveFixture({
      resetModelState, addPoint, addLine, pushModelConstraint, modelTypes: window.GeometrySolver,
      ensureDimensionDefaults, solveAndRefresh, log, fitAllGeometryToViewport, draw, resetHistory, serializeModel,
    });
    const offsetTestSupport = window.OffsetTestDriver.createSupport({
      resetModelState, addPoint, addLine, addCircle, addArc, pushModelConstraint, currentScope: workspace.current,
      RadiusConstraint, OffsetConstraint, OffsetChainConstraint, HorizontalConstraint, VerticalConstraint, Line,
      createOffsetGeometry, preconditionNewConstraint, solveSketchAndDependents, activeSketchId, snapshotModelState,
      targetFromConstraint, measuredConstraintTargetValue, serializeModel, loadModelData,
      offsetSelection, drawingPreview, offsetDistanceFromPointer, pendingCommandSession, addOffsetChainGeometry, clearSelection,
      fitAllGeometryToViewport, resetHistory, solveAndRefresh, draw, canvas, worldToCanvasScreen, document
    });
    const sidebarInspectionFixture = propertiesTestFactories.createInspectionFixture();
    const appearanceTestAction = propertiesTestFactories.createAppearanceAction();
    const sketchProjectionTestSupport = window.SketchProjectionTestDriver.createSupport({
      types: { Point, Line, Circle, Arc, Spline }, currentScope: workspace.current, readMode: drawOperationLifecycle.readMode, readStagedCount: () => sketchProjectionCommand.count, readConstraints: sketchProjectionConstraints,
      constraintGeometryId, constraintSketchId, effectiveAppearanceForElement, geometryDisplayColor,
      constraintStatusOf, constraintStatusColor, constraintIsRedundant, serializeModel, readHistory: readTestHistory, document,
      resetModelState, DEFAULT_SKETCH_ID, ROOT_SKETCH_ID, addPoint, addLine, addCircle, addArc, addSpline, addPointToSketch,
      focus: canvasTestDriver.focus, clientPosition: canvasTestDriver.clientPosition, splineGeometry: window.SplineGeometry, resetHistory, updateUI, draw, SketchProjectionConstraint,
      markReferenceConstraint, pushModelConstraint, synchronizeSketchProjectionMetadata, solveSketchAndDependents, loadModelData,
      createEmptyBlockDefinition, openBlockDefinitionEditor, resetBlockEditorHistory, completeBlockDefinitionEdit, isEditingBlock: () => Boolean(blockEditor.current),
      appendDefinition: definition => documentModel.blockDefinitions.push(definition), nextInstanceId: () => documentIds.allocate("blockInstance"), invalidateBlockProjectionCache, blockProjectionBundle, clearSelection, canvasSelection,
      deleteCurrentSelection, setAppearanceForSelection: appearanceTestAction.set, deleteElements, deleteSketch, elementSketchId, sketchProjectionSourceKey,
      CURRENT_JSON_VERSION, sketchProjectionEntryFromOperand, copySelectionToClipboard, pasteGeometryClipboard, clipboardSession,
      blockSelectionGeometry, createBlockDefinitionFromSelection, blockSelectionBoundsCenter
    });
    const constraintInputObservation = constraintTestFactories.createInputObservation();
    const constraintIntentTestDriver = constraintTestFactories.createIntentResolution();
    const hoverDisplayObservation = propertiesTestFactories.createHoverObservation();
    const authoringObservation = window.CanvasTestDriver.createAuthoringObservation({
      readMode: drawOperationLifecycle.readMode, constraintTargetSession, pendingCommandSession, drawingSnap, centerlineCommand, currentScope: workspace.current,
      decorateSerializedConstraint, serializeConstraint, readPerformance: constraintCommitCommand.readPerformance, readSelectedGeometry: readTestSelectedGeometry,
    });
    const selectionTestApi = createSelectionTestApi({
      sketchMoveCommand, activeSketchId, fields: window.SketchMove.fields, decorateSerializedConstraint, serializeConstraint, serializeModel,
      isEditingBlock: () => Boolean(blockEditor.current), blockSelectionGeometry, resetModelState, addLine, addPoint, addArc,
      ROOT_SKETCH_ID, DEFAULT_SKETCH_ID, createEmptyBlockDefinition, Point, Line,
      appendDefinition: definition => documentModel.blockDefinitions.push(definition), nextInstanceId: () => documentIds.allocate("blockInstance"),
      invalidateBlockProjectionCache, fitSketchToViewport, resetHistory, clientPosition: canvasTestDriver.clientPosition, arcEndpointPoint,
      canvasHover, canvasContextMenu, canvasContextController, canvasContextCandidatePresentation, canvas, viewport,
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
    const dimensionDisplaySupport = dimensionTestSupport.createDisplay({
      Point, Arc, placement: dimensionPlacement, layouts: dimensionLayouts, metrics: dimensionMetrics, circlePointAtAngle,
      screenPxPerMm: DIMENSION_SCREEN_PX_PER_MM, outsideShaftLengthFactor: DIMENSION_OUTSIDE_SHAFT_LENGTH_FACTOR,
      fitMarginFactor: DIMENSION_TERMINATOR_FIT_MARGIN_FACTOR, canvasHover, readDocument: () => documentModel, normalizeDimensionAppearance,
      effectiveDimensionAppearanceForSketch, dimensionDisplayState, effectiveDimensionAppearance,
      displayFactor: window.Appearance.annotationDisplayFactor, formatDimensionLabel, formatMeasuredDimensionLabel, jisDimensionTextAngle,
      dimensionTextOffset,
    });
    const { observation: referenceImageTestObservation, dataImport: referenceImageTestImport,
      blockFixture: referenceImageBlockFixture } = window.ReferenceImageTestDriver.createBrowserSupport({
      feature: referenceImageFeature, blocks: blockEditingFeature, canvasSelection, currentScope: workspace.current, readHistory: readTestHistory, viewport,
      fetch, File, resetModelState, openBlockDefinitionEditor, completeBlockDefinitionEdit, serializeModel,
    });
    const derivedInstanceTestApi = window.DerivedInstanceTestDriver.createBrowserApi({
      resetModelState, addPoint, addLine, focus: canvasTestDriver.focus, clientPosition: canvasTestDriver.clientPosition, resetHistory,
      updateUI, draw, currentScope: workspace.current, serializeModel, geometryInstanceBundle, constraintStatusColor,
      arcSweep, canvasSelection, resolvedHatchBoundary, document, loadModelData, deleteElements,
      deleteCurrentSelection, addCircle, addArc, DEFAULT_SKETCH_ID, DEFAULT_HATCH_APPEARANCE, normalizeGeometryInstance,
      activeSketchId, geometryRefForItem, parseGeometryRefId, hatchGeometryQuery, nextProjectionId: () => documentIds.allocate("sketchProjection"), nextMirrorId: () => documentIds.allocate("mirror"),
      nextPatternId: () => documentIds.allocate("pattern"),
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

  presentation.createCommandPanels({
    host: canvas.parentElement, readMode: drawOperationLifecycle.readMode, sketchContext, projectionCommand: sketchProjectionCommand,
    geometryCommand: geometryInstanceCommand, sourceCommand: instanceSourceCommand, resolveGeometryRef, geometryRefForItem, applicationText, formatDisplayNumber,
    finishProjection: commitSketchProjectionCommand, finishSourceEdit: finishInstanceSourceEdit, exitDrawMode,
    changeFreeProperty: changeFreeInstanceProperty, hatchCommand, annotationCommand, effectiveAnnotationStyle, pngExportCommand,
    updateUI, updatePropertiesUI, setHint, draw,
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
  updateUI();
  draw();
  log("空の新規Documentを作成しました");
  setApplicationLanguage(applicationSettings.language, { persist: false, refresh: false });
  setApplicationTheme(applicationSettings.theme, { persist: false, redraw: false });
  runtimeVersionView.load(window.__JOT2D_RUNTIME_VERSION__);
  resizeCanvas();
  canvasSurface.start();
  resetHistory("起動");
  markDocumentFileCheckpoint("new");
  documentFileFeature.start();
})();
