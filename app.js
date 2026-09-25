/* Application composition, editing commands, Canvas UI and event handling. */
(function () {
  "use strict";
  const { referenceImageMimeType, validReferenceImageDataUrl, normalizeReferenceImages, serializeReferenceImage, REFERENCE_IMAGE_MAX_SIDE_PX } = window.ReferenceImageData;
  const { normalizeHatches, validSerializedHatch, validSerializedHatchList, serializeHatch } = window.HatchData;
  const { normalizeAnnotations, serializeAnnotation } = window.AnnotationData;

  const {
    CSS_PX_PER_MM, DEFAULT_APPEARANCE, DEFAULT_CONSTRUCTION_APPEARANCE,
    DEFAULT_DIMENSION_APPEARANCE, DEFAULT_HATCH_APPEARANCE, DEFAULT_ANNOTATION_STYLE,
    DIMENSION_APPEARANCE_LENGTH_KEYS, DIMENSION_APPEARANCE_NUMERIC_RULES,
    normalizeAppearance, normalizeConstructionAppearance, normalizeDimensionAppearance,
    normalizeHatchAppearance, normalizeAnnotationStyle,
    resolveGeometryAppearance, resolveDimensionAppearance,
  } = window.Appearance;
  const {
    normalizedDrawingOrder, drawingOrderItemsForScope, ensureDrawingOrderState, drawingOrderOwner,
  } = window.DrawingOrder;
  const {
    DEFAULT_DOCUMENT_NAME, JOT2D_FILE_EXTENSION, JOT2D_FILE_MIME_TYPE,
    sanitizeDocumentNameValue, fileNameStem, safeDownloadBaseName,
    effectiveDocumentNameFromValue, documentContentSignature, writeJot2DFile,
  } = window.DocumentFiles;

  const {
    MIN_ORIENTATION_LENGTH,
    normalizeAnglePositive,
    normalizeAngleSigned,
    arcEndpointPoint,
    circlePointAtAngle,
    arcSweep,
    unwrapAngleNear,
    shortestAngleFrom,
    threePointArcGeometry,
    slotGeometry,
    angleOnSignedSweep,
    arcParamOnSweep,
    angleAtArcParam,
    arcSamplePoints,
    lineUnit,
    lineNormal,
    lineSupportNormal,
    lineHasDirection,
    lineAngle,
    signedPointLineDistance,
    signedPointDirectedLineDistance,
    projectPointToLine,
    projectPointToSegmentPoint,
    closestPointOnSegment,
    distancePointToSegment,
    distancePointToSegmentPoints,
    lineIntersection,
  } = window.GeometryKernel;

  const {
    create: createGeometryRef,
    parseId: parseGeometryRefId,
    parseKey: parseGeometryRefKey,
    id: geometryRefId,
    key: geometryRefKey,
    equals: geometryRefsEqual,
    resolve: resolveGeometryRefValue,
  } = window.GeometryRef;

  const {
    createRegionIndex: createHatchRegionIndex,
    findFaceInIndex: findHatchFaceInIndex,
    resolveBoundary: resolveHatchBoundaryLoops,
    containsPoint: hatchContainsPoint,
    normalizeBoundaryLoops: normalizeHatchBoundaryLoops,
    boundaryGeometryRefs: hatchBoundaryGeometryRefs,
    rewriteBoundaryRefs: rewriteHatchBoundaryRefs,
  } = window.HatchRegionEngine;

  const { build: buildOffsetChainGeometry } = window.OffsetChainEngine;

  const {
    evaluate: evaluateParameterExpression,
    evaluateDefinitions: evaluateParameterDefinitions,
    formatReference: formatParameterReference,
    validateIdentifier: validateParameterIdentifier,
    rewriteIdentifiers: rewriteParameterIdentifiers,
  } = window.ParameterEngine;

  const {
    hypot2,
    vectorNorm,
    Point,
    Line,
    Circle,
    Arc,
    Spline,
    DistanceConstraint,
    PointAxisDistanceConstraint,
    PointLineDistanceConstraint,
    LineLineDistanceConstraint,
    LineCircleDistanceConstraint,
    ConcentricRadiusDifferenceConstraint,
    OffsetConstraint,
    OffsetChainConstraint,
    LineAngleConstraint,
    CoincidentConstraint,
    ArcEndpointCoincidentConstraint,
    ArcEndpointArcEndpointCoincidentConstraint,
    PointOnLineConstraint,
    ParallelLinesCenterlineConstraint,
    PointPairCenterlineConstraint,
    ArcEndpointOnLineConstraint,
    ArcEndpointFixedConstraint,
    LineFixedConstraint,
    GeometryFixedConstraint,
    HorizontalConstraint,
    VerticalConstraint,
    PointHorizontalConstraint,
    PointVerticalConstraint,
    ArcEndpointHorizontalConstraint,
    ArcEndpointVerticalConstraint,
    SymmetryConstraint,
    LineSymmetryConstraint,
    ArcSymmetryConstraint,
    ParallelConstraint,
    PerpendicularConstraint,
    CollinearConstraint,
    EqualLengthConstraint,
    RadiusConstraint,
    DiameterConstraint,
    ConcentricConstraint,
    EqualRadiusConstraint,
    PointOnCircleConstraint,
    ArcEndpointOnCircleConstraint,
    LineCircleTangentConstraint,
    CircleCircleTangentConstraint,
    PointOnSplineConstraint,
    SplineLineTangentConstraint,
    SplineSplineTangentConstraint,
    SketchProjectionConstraint,
    DragConstraint,
    ParameterDragConstraint,
    ArcEndpointDragConstraint,
    ConstraintSolver,
  } = window.GeometrySolver;

  const constraintReferences = window.ConstraintReferences.create({ resolveGeometryRef: (ref) => resolveGeometryRef(ref) });
  const {
    constraintReferencesPoint, constraintReferencesLine, constraintReferencesPrimitive,
    constraintGraphNodes, geometryInstanceDependencyRefs,
  } = constraintReferences;

  const {
    targetFromConstraint, offsetPairSign, angleDegrees,
    angleDimensionSweep, signedAngleBetweenLines, measuredDimensionValue,
    angleDimensionAngles, angleDimensionCandidate, geometryTargetValue,
    isReadOnlyDimension, isDimensionConstraint,
  } = window.DimensionQueries;

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const dimensionValueInput = document.getElementById("dimensionValueInput");
  const dimensionValueInputShell = document.getElementById("dimensionValueInputShell");
  const canvasContextMenu = document.getElementById("canvasContextMenu");
  const sketchOverlay = document.getElementById("sketchOverlay");
  const sketchOverlayResizeHandle = document.getElementById("sketchOverlayResizeHandle");
  const applicationSettings = window.ApplicationSettings.create({
    document, storage: () => localStorage,
    refreshViews: (options) => updateUI(options),
    redrawCanvas: () => draw(), refreshVersion: () => renderRuntimeVersion(),
  });
  const { applicationText, translatedExactText, translatedHintText, localizeApplicationUI,
    setApplicationLanguage, setApplicationTheme } = applicationSettings;
  const { ROOT_SKETCH_ID, ROOT_SKETCH_NAME, DEFAULT_SKETCH_ID, DEFAULT_SKETCH_NAME } = window.SketchHierarchy;
  const { DEFAULT_DOCUMENT_UNITS } = window.DocumentState;
  const documentModel = window.DocumentState.create();
  const workspace = window.EditingWorkspace.create(documentModel);
  const currentParameterNamespace = workspace.current;
  const parameterNamespace = window.ParameterNamespace.create({ currentParameterNamespace, applicationText });
  const {
    dimensionExpressionValue, numericDimensionExpression, isDirectNumericExpressionInput,
    dimensionUsesExpression, expressionInputValue, expressionFromUserInput,
    dimensionConstraintsInNamespace, allocateDimensionParameterName,
    ensureDimensionParameter, ensureParameterNamespace, parameterErrorText,
    referenceDimensionValues, validateParameterSymbolNames, evaluateParameterNamespace,
    validateParameterNamespace, prepareLoadedParameterNamespace, parameterDependents,
  } = parameterNamespace;
  const parameterDraft = window.ParameterDialogDraft.create({ namespace: parameterNamespace });
  const parameterDialogView = window.ParameterDialogView.create({
    document, applicationText, escapeHtml, formatDisplayNumber, parameterErrorText,
    localizeApplicationUI, installExpressionInputHighlights, defaultSketchId: DEFAULT_SKETCH_ID,
  });
  const { setError: setParameterDialogError } = parameterDialogView;
  const parameterDialogController = window.ParameterDialogController.create({
    document, window, draft: parameterDraft, view: parameterDialogView,
    scopes: parameterScopeOptions, scopeLocked: () => Boolean(blockEditor.current),
    apply: applyParameterDialogDraft, applicationText, language: () => applicationSettings.language,
    refreshExpressionInputHighlights, pickDimension: pickParameterDialogDimension,
  });
  const { loadScope: loadParameterDialogScope } = parameterDialogController;
  const {
    ensureSketchState, isRootSketch, isDrawableSketch,
    firstDrawableSketchId, sketchName, sketchById,
    orderedSketches, childSketchesOf, descendantSketchIds,
    ancestorSketchIds, isReferenceSourceSketchId, referenceSourceSketchIds,
    activeSketch, activeSketchId, assignSketchId,
    elementSketchId, sameSketchElements, isEditableSketchId,
    sketchRelationToActive, constraintSketchId, isActiveSketchConstraint,
    constraintTargetsAreActive, constraintReferencesSketch, wouldCreateSketchCycle,
    sketchTreeRows, isActiveSketchElement, isEditableSketchElement,
    sketchRelationOfElement,
  } = window.SketchContext.create({ currentScope: workspace.current, constraintGraphNodes });
  const { geometryKindForItem, geometryRefForItem, addGeometryBundleToMaps } = window.GeometryObjects;
  const instanceProjections = window.InstanceProjection.create({ elementSketchId, applicationText });
  const { emptyGeometryInstanceBundle, geometryInstanceSourcePoints, createGeometryInstanceBundle, geometryInstanceBundlesForScope } = instanceProjections;
  const blockCatalog = window.BlockCatalog.create({ definitions: () => documentModel.blockDefinitions });
  const { blockDefinitionById, blockDefinitionDrawableSketchIds, blockDefinitionHasGeometry, blockDefinitionGeometrySketchIds, blockInstanceEnabledSketchSet } = blockCatalog;
  const blockProjections = window.BlockProjection.create({
    blockCatalog, geometryInstanceBundlesForScope, emptyGeometryInstanceBundle, hatchPrimitivesFromElements, hatchPrimitivesForScope,
  });
  const { blockProjectionId, blockProjectionLocalId, blockWorldPoint, createBlockProjectionBundle, blockAllProjectionBundle, blockProjectionBundle, invalidateBlockProjectionCache } = blockProjections;
  let model = workspace.current();
  const solver = new ConstraintSolver(model);

  // Temporary binding for legacy commands; new services receive explicit scopes.
  function activateEditingScope(scope) {
    model = workspace.activate(scope);
    solver.model = model;
    geometryReads.clearReadCache();
    invalidateBlockProjectionCache();
    return model;
  }

  const fileSession = window.DocumentFiles.create();

  let mode = "select";
  const canvasSelection = window.CanvasSelection.create();
  const {
    selectedGeometryItems, appearanceSelectionTarget, setGeometrySelection, currentConstraintTargets,
    hasPrimaryCanvasSelection, effectiveSelectedConstraint, selectedPrimitives,
    togglePointSelection, toggleLineSelection, toggleCircleSelection, toggleArcSelection,
    toggleSplineSelection, toggleBlockInstanceSelection, selectedConstructionTogglePrimitives,
    trimConstraintSelection, pushPrimitiveSelection, geometryItemSelectedInCanvas,
    constraintSelectedInCanvas, hasSelection,
  } = canvasSelection;
  let dragSession = null;
  let dimensionDragSession = null;
  let annotationDragSession = null;
  let hoveredPoint = null;
  let hoveredEndpointPoint = null;
  let hoveredLine = null;
  let hoveredCircle = null;
  let hoveredArc = null;
  let hoveredSpline = null;
  let hoveredBlockInstance = null;
  let hoveredGeometryInstance = null;
  let hoveredArcEndpoint = null;
  let hoveredDimensionConstraint = null;
  let canvasContextTarget = null;
  let canvasContextPointer = null;
  let canvasContextCandidates = [];
  let canvasContextBaseHoverState = null;
  let hoveredAnnotation = null;
  let hoveredHatch = null;
  let hoveredReferenceImage = null;
  let constraintAnalysisState = null;
  let constraintRedundancyState = { constraints: new Map(), sketches: new Map(), count: 0 };
  let lastAuthoringPerformance = null;
  const interactionProfiler = window.InteractionProfiler.create();
  const { work: profileInteractionWork, phase: profileInteractionPhase } = interactionProfiler;
  const geometryReads = window.GeometryReadModel.create({
    currentScope: workspace.current, prepareBlocks: ensureBlockState, blockProjections, instanceProjections,
    hasBlockHatches: blockCatalog.hasHatches,
    profileRead: read => interactionProfiler.active ? profileInteractionWork("geometryReads", read) : read(),
  });
  const { withGeometryReadCache, blockProjectionBundles, geometryInstanceBundles, geometryInstanceBundle, allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines, allAnnotations, allHatches, allGeometryPrimitives, resolveGeometryRef, geometryElementFromKey } = geometryReads;
  let interactionFrameStats = null;
  let sketchSolveStates = new Map();
  let invalidReferenceConstraints = new Map();
  let selectionRectSession = null;
  let blankDoubleClickCandidate = null;
  let suppressNextBlankDoubleClickEvent = false;
  let splineEditSession = null;
  let sketchProjectionSources = [];
  let pointerPreview = null;
  let trimPreview = null;

  let hatchPreview = null;
  let hatchRepairTarget = null;
  let pendingCommand = null;
  let pendingConstraintCommand = null;
  let constraintOperands = [];
  let lastPointerWorld = null;
  let hoveredSketchIdentity = null;
  let hoveredSketchTreeId = null;
  let constructionLineMode = false;
  const selectionHighlight = window.SelectionHighlight.create({
    canvasSelection, blockProjectionBundle, geometryRefsEqual, geometryRefForItem,
    constraintGraphNodes, constraintHighlightNodes, effectiveSelectedConstraint, targetFromConstraint,
    getHoveredDimension: () => hoveredDimensionConstraint,
    setHoveredDimension: value => { hoveredDimensionConstraint = value; }, draw,
  });
  const { sameConstraintDisplayElement, isSidebarHoveredElement, isSelectedConstraintRelatedElement, selectedConstraintReferenceElements, constraintDirectlyReferencesCanvasSelection, sidebarHoverElementsForItem, sidebarHoverElementsForConstraint, setSidebarHover, clearSidebarHover } = selectionHighlight;
  const offsetSelection = window.OffsetSelection.create({
    getModel: () => model, activeSketchId, elementSketchId, constraintSketchId,
    Line, Arc, CoincidentConstraint, ArcEndpointCoincidentConstraint,
    ArcEndpointArcEndpointCoincidentConstraint, OffsetChainConstraint,
    onSelectionChanged: syncOffsetChainSelection,
  });
  const { add: addOffsetChainGeometry, isClosed: offsetChainIsClosed } = offsetSelection;
  const geometryIds = window.GeometryIds.create();
  const { nextSeq } = window.GeometryIds;
  let sketchSeq = 2;
  let annotationSeq = 1;
  let hatchSeq = 1;
  let referenceImageSeq = 1;
  let blockDefinitionSeq = 1;
  let blockInstanceSeq = 1;
  let sketchProjectionInstanceSeq = 1;
  let mirrorInstanceSeq = 1;
  let patternInstanceSeq = 1;
  let freeInstanceSeq = 1;
  let blockElementSeq = 1;
  const blockDefinitionEditing = window.BlockDefinitionEditing.create({
    normalizedSketchCopy, cloneConstraintForBlock, blockDefinitionById, createBlockProjectionBundle,
    geometryInstanceBundlesForScope, emptyGeometryInstanceBundle, normalizeGeometryInstance,
    hatchSequence: () => hatchSeq,
  });
  const { clone: cloneBlockDefinition, cloneInstance: cloneBlockInstance,
    translate: translateBlockDefinition, apply: mergeBlockDefinitionDraft } = blockDefinitionEditing;
  const blockEditor = window.BlockEditorSession.create({
    currentScope: workspace.current, documentModel, hatchSequence: () => hatchSeq,
    normalizedSketchCopy, activeSketchId, blockProjectionBundles, geometryElementKey,
    captureHost: () => ({ ...workspace.capture(), viewport: viewport.snapshot() }),
    restoreHostState: (original) => {
      activateEditingScope(workspace.restore(original));
      viewport.update(original.viewport);
    },
    activateScope: activateEditingScope, reserveScopeSequences: reserveBlockEditorSequences,
    cloneBlockDefinition, createHistory: createBlockEditHistory, mergeBlockDefinitionDraft,
    rebuildStoredBlockDefinitionConstraints, invalidateBlockProjectionCache,
  });
  const { sync: syncBlockEditorDraft, live: liveBlockEditorDefinition, chain: blockEditorSessionChain,
    scopeId: currentBlockDefinitionScopeId } = blockEditor;
  let hatchResolutionCache = new WeakMap();
  let hatchFaceCache = new Map();

  let referenceImageDragSession = null;
  let referenceImageCalibrationSession = null;
  let dimensionExpressionMarkCapture = null;
  let historyRestoring = false;
  let geometryClipboard = null;
  const HISTORY_LIMIT = 80;
  const geometryInstanceCommand = window.GeometryInstanceCommand.create({
    cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation,
    selectedItemsForGeometryInstance, geometryRefForItem, clearSelection, normalizeGeometryInstance,
    previewFreeId: () => `FI${freeInstanceSeq}`,
    nextInstanceId: type => type === "free" ? `FI${freeInstanceSeq++}` : type === "mirror" ? `MI${mirrorInstanceSeq++}` : `PI${patternInstanceSeq++}`,
    activeSketchId, getMode: () => mode, setMode: value => { mode = value; }, updateToolbar, updateUI,
    applicationText, setHint, draw, currentScope: workspace.current, canvasSelection, recordHistory,
    Line, lineHasDirection, elementSketchId, prompt: (message, initial) => window.prompt(message, initial),
    resolveGeometryRef, createGeometryInstanceBundle,
  });
  const { start: startGeometryInstanceCommand, placeFree: placeFreeInstance, commitReference: commitGeometryInstanceReference } = geometryInstanceCommand;
  const instanceSourceCommand = window.InstanceSourceCommand.create({
    currentScope: workspace.current, activeSketchId, exitDrawMode, cancelConstraintTargetCommand, cancelPendingCommand,
    clearSelection, canvasSelection, getMode: () => mode, setMode: value => { mode = value; }, updateToolbar, updateUI, updatePropertiesUI,
    applicationText, setHint, draw, geometryRefForItem, isVisibleSketchElement, geometryRefsEqual,
    sketchProjectionEntryFromItem, sketchProjectionSourceIsCovered, elementSketchId,
    geometryInstanceBundlesForScope, blockProjectionBundles, geometryElementKey, geometryInstanceBundle,
    constraintGraphNodes, guardDimensionSymbolDeletion, annotationReferencesRemovedGeometry,
    clearSketchSolveState, recordHistory,
  });
  const { start: startInstanceSourceEdit, toggle: toggleInstanceSource, finish: finishInstanceSourceEdit } = instanceSourceCommand;
  const blockPlacementCommand = window.BlockPlacementCommand.create({
    isGeometryMode, canCreateInActiveSketch, blockDefinitionById, blockDefinitionScopeError,
    blockDefinitionDrawableSketchIds, blockDefinitionGeometrySketchIds, snappedBlockRotation,
    blockInstanceTranslationForAnchor, activeSketchId, currentScope: workspace.current,
    nextInstanceId: () => `BI${blockInstanceSeq++}`, clearSelection, canvasSelection, invalidateBlockProjectionCache,
    isPropertiesCollapsed: () => Boolean(document.querySelector(".workspace")?.classList.contains("properties-collapsed")),
    setPropertiesPanelCollapsed, getPointerPreview: () => pointerPreview,
    setPointerPreview: value => { pointerPreview = value; }, getLastPointerWorld: () => lastPointerWorld,
    setMode: value => { mode = value; }, setHint, updateUI, draw, solveAndRefresh, recordHistory,
  });
  const { start: startBlockPlacement, commit: commitBlockPlacement, click: handleBlockPlacementClick,
    restorePropertiesPanel: restoreBlockPlacementPropertiesPanel } = blockPlacementCommand;
  const documentHistory = window.EditHistory.create({
    capture: historySnapshot,
    signature: (snapshot) => snapshot,
    restore: (snapshot, label) => { restoreHistorySnapshot(snapshot, label); return true; },
    limit: HISTORY_LIMIT,
    recordLabel: "履歴に追加しました", undoLabel: "戻る", redoLabel: "進む",
  });
  const CURRENT_JSON_VERSION = 22;
  const CLIPBOARD_PASTE_OFFSET_SCREEN_PX = 24;
  const BLOCK_ORTHOGONAL_ROTATION_STEP = Math.PI / 2;


  let pendingCanvasPointerMove = null;
  let canvasPointerMoveFrame = null;
  const viewState = { constraintStatus: false, geometryIds: false };
  let constraintStatusMouseLatched = false;
  let constraintStatusSpaceHeld = false;
  const MIN_ZOOM = CSS_PX_PER_MM * 0.001;
  const MAX_ZOOM = CSS_PX_PER_MM * 10000000;

  const CONSTRUCTION_EXTENSION_SCREEN_PX = 12;
  const CENTERLINE_PARALLEL_TOLERANCE = 1e-5;
  const CONSTRUCTION_GEOMETRY_ALPHA = 0.72;
  const ANNOTATION_SCREEN_PX_PER_MM = CSS_PX_PER_MM;
  const { DIMENSION_OUTSIDE_SHAFT_LENGTH_FACTOR } = window.DimensionLayout;
  const HATCH_SCREEN_PX_PER_MM = CSS_PX_PER_MM;
  const HATCH_BOUNDARY_HIT_MARGIN_SCREEN_PX = 1;
  const DIMENSION_DISPLAY_PRECISION = 1e-6;
  const MEASURED_DIMENSION_SNAP_TOLERANCE = 1e-5;
  const CONSTRAINT_ACCEPT_ERROR = 1e-4;
  const constraintCandidates = window.ConstraintCandidates.create({
    sameSketchElements, syncLineOrientationHints: () => solver.syncLineOrientationHints?.(),
    constraintAcceptError: CONSTRAINT_ACCEPT_ERROR,
  });
  const { sameArcEndpoint, constraintTargetsFromOperands, linesAreParallel, distanceTargetFromTargets, distanceTargetFromOperands, referenceDistanceTargetForSubject, canApplyConstraintToTargets, referenceConstraintForType, symmetryConstraintFromOperands, constraintFromTargets } = constraintCandidates;
  const PARAMETER_STABILIZATION_MAX_PASSES = 20;
  const PARAMETER_STABILIZATION_RELATIVE_TOLERANCE = 1e-7;
  const DRAG_PREVIEW_ERROR_SCREEN_PX = 0.1;
  const DRAG_PREVIEW_MAX_MODEL_ERROR = 0.125;
  const SPARSE_LINE_DRAG_SUBSTEP_NORM = 4;
  const SPARSE_LINE_DRAG_MAX_SUBSTEPS = 128;
  const MIN_LINE_LENGTH = Math.max(MIN_ORIENTATION_LENGTH, solver.minLineLength || 12);
  const viewport = window.CanvasViewport.create({
    canvasRect: () => canvas.getBoundingClientRect(), initialScale: CSS_PX_PER_MM,
    minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, minLength: MIN_LINE_LENGTH,
  });
  const { currentCanvasCenterWorld, clampZoom, formatZoom, canvasScreenPoint, screenToWorld, worldToCanvasScreen, canvasPoint, fitBoundsToViewport, screenBoxForBounds, visibleWorldBounds } = viewport;
  const canvasNavigation = window.CanvasNavigation.create({
    canvas, viewport, draw, setHint, fitVisibleGeometry: fitVisibleGeometryToViewport,
  });
  const splineDraft = window.SplineDraft.create({
    currentScope: workspace.current, ids: geometryIds, endpointAt, samePosition, isPointUsedByPrimitive,
  });
  const transientAuthoring = window.TransientAuthoring.create({
    currentScope: workspace.current, ids: geometryIds, selection: canvasSelection, historySnapshot, documentHistory,
    isHistoryRestoring: () => historyRestoring, updateHistoryButtons,
    invalidateAnalysis: () => { constraintAnalysisState = null; },
  });
  const { beginTransientLineStartRollback, clearTransientLineStartRollback, beginTransientLineCompletionRollback,
    clearTransientLineCompletionRollback, rollbackTransientLineCompletion, beginTransientPointRollback,
    clearTransientPointRollback, rollbackTransientPoint, rollbackTransientLineStart } = transientAuthoring;
  const canvasSurface = window.CanvasSurface.create({
    canvas, ctx, viewport, readPixelRatio: () => window.devicePixelRatio || 1, ResizeObserverClass: window.ResizeObserver,
    onResize: () => {
      draw();
      if (pendingCommand && ["distance-value", "offset-value"].includes(pendingCommand.type)) syncDimensionValueInput();
    },
  });
  const { syncCanvasBitmapSize, resetCanvasStrokeState, withCanvasState, appearanceLineDash } = canvasSurface;
  const { DIMENSION_SCREEN_PX_PER_MM, DIMENSION_TERMINATOR_FIT_MARGIN_FACTOR, DIMENSION_ARROW_MITER_LIMIT } = window.DimensionMetrics;
  const dimensionMetrics = window.DimensionMetrics.create({ ctx, viewport });
  const dimensionInputView = window.DimensionInputView.create({
    input: dimensionValueInput, shell: dimensionValueInputShell, screenPxPerMm: DIMENSION_SCREEN_PX_PER_MM,
    syncHighlight: syncExpressionInputHighlight, scheduleFrame: callback => requestAnimationFrame(callback),
  });
  const { dimensionMillimetersToWorld, dimensionTextDrawingMetrics, dimensionTextWidth, shouldPlaceDimensionTerminatorsOutside, linearDimensionTerminatorDirections, dimensionStrokeWidth, dimensionArrowheadPoints, dimensionOpenArrowJoinProjection, dimensionOpenArrowheadRenderPoints } = dimensionMetrics;
  const dimensionPlacement = window.DimensionPlacement.create({ viewport });
  const { dimensionFromAnchor, angleDimensionLabelBasis, angleDimensionLabelOffsets, setAngleDimensionLabelOffsets, migrateAngleDimensionLabelPlacement, dimensionWithLabelAt, angleDimensionFromLabelPoint, applyDefaultCircleDimensionLabelOffset, storedDimensionAxis, dimensionAnchor, defaultDimensionForTarget } = dimensionPlacement;
  const dimensionLayouts = window.DimensionLayout.create({ viewport, placement: dimensionPlacement, metrics: dimensionMetrics, currentLines: () => workspace.current().lines, minLineLength: MIN_LINE_LENGTH });
  const { linearDimensionRenderPlan, jisDimensionTextAngle, dimensionTextOffset, arcRadiusDimensionExtensionSegment, angleDimensionLayout, angleDimensionExtensionSegments } = dimensionLayouts;
  const dimensionInputController = window.DimensionInputController.create({
    view: dimensionInputView, enabled: Boolean(dimensionValueInput), getPending: () => pendingCommand,
    dimensionLayout, worldToCanvasScreen, effectiveDimensionAppearance, constraintSketchId, activeSketchId,
    dimensionTextOffset, evaluateDimensionExpressionDraft, expressionFromUserInput,
    cancelPendingCommand, startDistanceValueInput, defaultDimensionForTarget,
    submitOffsetValue: () => submitOffsetValue(), submitDistanceValue: () => submitDistanceValue(), applicationText, setHint, draw,
  });
  const { hide: hideDimensionValueInput, sync: syncDimensionValueInput, focus: focusDimensionValueInput, handleKey: handleDistanceKey, updateBufferLabel: updateDistanceBufferLabel } = dimensionInputController;
  function dimensionLayout(target, dimension, appearance = effectiveDimensionAppearance(dimension)) {
    return dimensionLayouts.dimensionLayout(target, dimension, appearance);
  }
  const dimensionRenderer = window.DimensionRenderer.create({
    ctx, viewport, metrics: dimensionMetrics, canvasThemeColor,
    onExpressionMark: mark => dimensionExpressionMarkCapture?.(mark),
  });
  const geometryRenderer = window.GeometryRenderer.create({ ctx, viewport, paintState: geometryPaintState, appearanceLineDash, lineDisplaySegment, canvasThemeColor });
  const { traceSplinePath } = geometryRenderer;
  const { resolvedLoopBounds } = window.HatchRegionEngine;
  const { drawResolvedHatchContent } = window.HatchRenderer.create({ viewport, visibleWorldBounds, canvasThemeColor });
  const { annotationTextWorldHeight, drawAnnotationText, drawAnnotationLeader } = window.AnnotationRenderer.create({ ctx, viewport, withCanvasState, annotationDisplayColor, annotationLeaderAnchor, appearanceLineDash });
  const referenceImageRenderer = window.ReferenceImageRenderer.create({
    ctx, viewport, withCanvasState, createImage: () => new Image(), onImageLoad: draw, referenceImageCorners,
  });
  const { drawingStackEntries, drawDrawingStack } = window.DrawingStack.create({
    currentScope: workspace.current, activeSketchId, geometryReads,
    isVisibleSketchId, isVisibleSketchElement, hatchAppearanceForDisplay,
    painters: { hatch: items => drawHatches(items, { includePreview: false }), line: drawLines, circle: drawCircles, arc: drawArcs, spline: drawSplines },
  });
  const MIN_ARC_LENGTH = MIN_LINE_LENGTH;
  const geometryCreation = window.GeometryCreation.create({
    currentScope: workspace.current, ids: geometryIds, assignSketchId, currentConstruction: () => constructionLineMode,
    minLineLength: MIN_LINE_LENGTH, minArcLength: MIN_ARC_LENGTH,
  });
  const { addPoint, addPointToSketch, addLine, addCircle, addArc, addSpline, ensureLineMinimumLength, normalizeArcSweep, enforceMinimumLineLengths, normalizeArcSweeps } = geometryCreation;
  const drawingSnap = window.DrawingSnap.create({
    geometryReads, isVisibleSketchElement, isActiveSketchElement, isSplineOnlyFitPoint, isReferencePoint, isPrimitiveCenterPoint, isEndpointPoint, isPointUsedByPrimitive, isExplicitPoint, sketchName, elementSketchId, applicationText,
  });
  const { candidates: snapCandidates, clear: clearSnap } = drawingSnap;
  const { circlePointAtPointer } = window.GeometryKernel;
  function snapForDrawing(point) { return drawingSnap.resolve(point, 10 / viewport.scale); }
  const splineCommand = window.SplineCommand.create({
    draft: splineDraft, addSpline, snapForDrawing, scale: () => viewport.scale,
    clearProjectionSources: () => { sketchProjectionSources = []; },
    setPointerPreview: value => { pointerPreview = value; },
    clearSnap, clearSelection,
    selectCreatedSpline: spline => { canvasSelection.set("splines", [spline]); mode = "select"; },
    solveAndRefresh, recordHistory, applicationText, setHint, updateUI, draw,
  });
  const { finalize: finalizeSplineCreation, click: handleSplineClick, doubleClick: finalizeSplineFromDoubleClick } = splineCommand;
  const snapConstraints = window.SnapConstraints.create({ isActiveSketchElement, elementSketchId, isReferenceSourceSketchId, addPoint, addConstraintIfMissing });
  const { addPointSnapConstraints, addArcEndpointSnapConstraints, addCircularBoundarySnapConstraints, addLineBoundarySnapConstraints } = snapConstraints;
  const lineCommand = window.LineCommand.create({
    minLineLength: MIN_LINE_LENGTH, snapForDrawing: point => ({ point: snapForDrawing(point), snap: drawingSnap.active }),
    samePosition, addPoint, endpointAt, addLine, addPointSnapConstraints, pushModelConstraint, transientAuthoring,
    selection: canvasSelection, setPointerPreview: value => { pointerPreview = value; },
    clearSelection, setHint, updateUI, draw, solveAndRefresh, log,
  });
  const { click: handleLineClick } = lineCommand;
  const rectangleCommand = window.RectangleCommand.create({
    endpointAt, addPoint, addLine, addPointSnapConstraints, pushModelConstraint,
    minLineLength: MIN_LINE_LENGTH, samePosition, selection: canvasSelection,
    setPointerPreview: value => { pointerPreview = value; },
    clearSnap, clearSelection, setHint, updateUI, draw, solveAndRefresh, log,
  });
  const offsetGeometry = window.OffsetGeometry.create({
    types: window.GeometrySolver, kernel: window.GeometryKernel, buildOffsetChainGeometry,
  });
  const { offsetDistanceFromPointer, offsetChainDistanceFromPointer, offsetDraftGeometry, offsetDimensionTarget } = offsetGeometry;
  function offsetChainDraft(entries, distance, side, closed = offsetChainIsClosed(entries)) {
    return offsetGeometry.offsetChainDraft(entries, distance, side, closed);
  }
  const offsetConstruction = window.OffsetConstruction.create({
    currentScope: () => model, geometryIds, geometry: geometryCreation, plans: offsetGeometry,
    placement: dimensionPlacement, types: window.GeometrySolver, kernel: window.GeometryKernel,
    commitNewConstraint, normalizeAppearance, offsetPairSign, offsetChainErrorText,
    applicationText, setHint, updateUI, draw, invalidateAnalysis: () => { constraintAnalysisState = null; },
    minLineLength: MIN_LINE_LENGTH, minArcLength: MIN_ARC_LENGTH,
  });
  const { createOffsetGeometry, createOffsetChainGeometry } = offsetConstruction;
  const offsetCommand = window.OffsetCommand.create({
    getPending: () => pendingCommand, setPending: value => { pendingCommand = value; },
    plans: offsetGeometry, construction: offsetConstruction, placement: dimensionPlacement, offsetSelection,
    viewport, Line, Circle, minOrientationLength: MIN_ORIENTATION_LENGTH, offsetPairSign,
    offsetChainErrorText, formatDisplayNumber, formatDimensionLabel, setHint, updateToolbar,
    syncDimensionValueInput, focusDimensionValueInput, hideDimensionValueInput, draw,
    clearPointerPreview: () => { pointerPreview = null; }, clearSelection,
    setPointerPreview: value => { pointerPreview = value; }, syncOffsetChainSelection,
    applicationText, updateGeometrySelectionUI,
  });
  const { start: startOffsetDistanceInput, startChain: startOffsetChainDistanceInput, submit: submitOffsetValue } = offsetCommand;
  const offsetPreviewRenderer = window.OffsetPreviewRenderer.create({
    ctx, viewport, withCanvasState, Line, Circle, drawDimension, formatDimensionLabel,
  });
  const filletPlans = window.FilletGeometry.create({ minLineLength: MIN_LINE_LENGTH });
  const { filletGeometryBasis, filletGeometryFromPointer } = filletPlans;
  const { createFillet } = window.FilletConstruction.create({
    plans: filletPlans, geometry: geometryCreation, defaultDimensionForTarget,
    syncLineOrientationHints: () => solver.syncLineOrientationHints?.(), pushModelConstraint,
  });
  const trimQuery = window.TrimQuery.create({ currentScope: workspace.current, isActiveSketchElement, minLineLength: MIN_LINE_LENGTH, minArcLength: MIN_ARC_LENGTH });
  const { angleAtCircleParam, lineTrimBoundaries, arcTrimBoundaries, circleTrimBoundaries, trimPreviewForLine, trimPreviewForArc, trimPreviewForCircle } = trimQuery;
  function computeTrimPreview(pointer) { return trimQuery.computeTrimPreview(pointer, 7 / viewport.scale); }
  const trimEditing = window.TrimEditing.create({
    currentScope: workspace.current, geometry: geometryCreation, references: constraintReferences, query: trimQuery,
    pushModelConstraint, elementSketchId, isPointUsedByPrimitive, isReferencePoint, minArcLength: MIN_ARC_LENGTH,
  });
  const { executeLineTrim, executeArcTrim, executeCircleTrim } = trimEditing;
  const editingCheckpoint = window.EditingCheckpoint.create({
    currentScope: workspace.current, ids: geometryIds, invalidateProjection: invalidateBlockProjectionCache,
    invalidateAnalysis: () => { constraintAnalysisState = null; },
  });
  const { captureValues: snapshotModelState, restoreValues: restoreModelState, captureGeometry: snapshotGeometryMutationState, restoreGeometry: restoreGeometryMutationState } = editingCheckpoint;
  const filletCommand = window.FilletCommand.create({
    getPending: () => pendingCommand, setPending: value => { pendingCommand = value; },
    guardSketchProjectionShapeEdit, filletGeometryBasis, filletGeometryFromPointer, hideDimensionValueInput,
    snapshotGeometryMutationState, restoreGeometryMutationState, createFillet, clearSelection, selection: canvasSelection,
    stabilize: () => stabilizeActiveParameterNamespace(activeSketchId()), acceptError: CONSTRAINT_ACCEPT_ERROR,
    invalidateAnalysis: () => { constraintAnalysisState = null; }, refreshConstraintAnalysis,
    applicationText, setHint, updateUI, updateGeometrySelectionUI, draw, recordHistory,
  });
  const { start: startFilletRadiusPlacement, update: updateFilletRadiusPlacement,
    submit: submitFilletRadiusPlacement, click: handleFilletClick } = filletCommand;
  const geometryInstancePersistence = window.GeometryInstancePersistence.create({ applicationText });
  const blockDefinitionPersistence = window.BlockDefinitionPersistence.create({ applicationText, serializedGeometryInstanceListError });
  const blockConnectionsPersistence = window.BlockConnectionsPersistence.create({
    createBlockProjectionBundle, geometryInstanceBundlesForScope, elementSketchId, deserializeConstraint, constraintSketchId,
    separateSharedSketchProjectionTargetPoints, prepareLoadedParameterNamespace, applicationText,
  });
  const documentGeometryPersistence = window.DocumentGeometryPersistence.create({
    createBlockProjectionBundle, geometryInstanceBundlesForScope, elementSketchId, deserializeConstraint, constraintSketchId,
    separateSharedSketchProjectionTargetPoints, prepareLoadedParameterNamespace,
    isPointUsedByLine, isPointUsedByCircle, isPointUsedByArc, constraintReferencesPoint, applicationText,
  });
  const documentLoading = window.DocumentLoading.create({
    blockDefinitionPersistence, blockConnectionsPersistence, documentGeometryPersistence, geometryInstancePersistence,
    serializedGeometryInstanceListError, normalizeGeometryInstance, defaultUnits: DEFAULT_DOCUMENT_UNITS,
    applicationText, invalidateProjection: invalidateBlockProjectionCache, normalizeArcSweeps,
  });
  const blockConfigurationCommand = window.BlockConfigurationCommand.create({
    currentScope: workspace.current, blockDefinitionById, blockProjectionBundle, createBlockProjectionBundle,
    blockDefinitionDrawableSketchIds, blockDefinitionGeometrySketchIds, constraintGraphNodes,
    geometryRefKey, parseGeometryRefId, annotationReferencesRemovedGeometry, guardDimensionSymbolDeletion,
    canvasSelection, clearRemovedHover: removed => { if (removed.has(hoveredDimensionConstraint)) hoveredDimensionConstraint = null; },
    invalidateBlockProjectionCache, setHint, updateBlockUI, log, updateUI, draw, recordHistory,
  });
  const { setEnabledSketchIds: setBlockInstanceEnabledSketchIds } = blockConfigurationCommand;
  const instanceTransformCommand = window.InstanceTransformCommand.create({
    isPlacing: geometryInstanceCommand.isPlacing, currentScope: workspace.current,
    snapshotModelState, restoreModelState, geometryInstanceSourceObjects,
    sketchSolveVariables, sketchSolveConstraints, sketchSolveLines, solver, acceptError: CONSTRAINT_ACCEPT_ERROR,
    stabilizeActiveParameterNamespace, clearSketchSolveState, applicationText, setHint, recordHistory,
    blockDefinitionById, blockLocalGeometryBounds, blockInstanceEnabledSketchSet, blockWorldPoint,
    invalidateBlockProjectionCache, updateBlockUI, refreshConstraintAnalysis, updateUI, draw,
    snappedBlockRotation, solveSketchAndDependents, updatePropertiesUI,
  });
  const { changeFreeInstanceProperty, setBlockInstanceRotationLocked, setBlockInstanceOrthogonalRotation } = instanceTransformCommand;
  const dimensionValueCommand = window.DimensionValueCommand.create({
    renameDimension: parameterNamespace.renameDimension,
    getPending: () => pendingCommand, setPending: value => { pendingCommand = value; },
    expressionFromUserInput, evaluateDimensionExpressionDraft, applicationText, parameterErrorText,
    setHint, syncDimensionValueInput, draw, activeSketchId, sketchHasDimensionConstraint, captureSketchScreenFootprint,
    snapshotModelState, restoreModelState, withTemporarySolveStepNorm, solveStepNormForConstraint,
    stabilizeActiveParameterNamespace, constraintSketchId, acceptError: CONSTRAINT_ACCEPT_ERROR,
    hideDimensionValueInput, recordHistory, updateUI, scaleSketchForFirstDimension,
    addDistanceConstraintFromTarget, restoreSketchScreenFootprint,
  });
  const { submit: submitDistanceValue, commitProperty: commitDimensionPropertyEdit } = dimensionValueCommand;
  const constraintRebinding = window.ConstraintRebinding.create({
    catalog: blockCatalog, projections: blockProjections, geometryInstanceBundlesForScope,
    serializeConstraint, decorateSerializedConstraint, deserializeConstraint, applicationText,
  });
  const blockParameterPropagation = window.BlockParameterPropagation.create({
    catalog: blockCatalog, invalidateProjection: invalidateBlockProjectionCache, applicationText,
    definitions: { rebuild: rebuildBlockDefinitionConstraintObjects, stabilize: stabilizeStoredBlockDefinition },
    document: { rebuild: rebuildRootConstraintObjects, stabilize: () =>
      stabilizeActiveParameterNamespace(activeSketchId(), { allSketches: model.sketches.filter(sketch => !isRootSketch(sketch)).map(sketch => sketch.id) }) },
  });
  const parameterApplication = window.ParameterApplication.create({
    namespace: parameterNamespace, currentScope: workspace.current, acceptError: CONSTRAINT_ACCEPT_ERROR, applicationText,
    capture: () => ({ document: blockEditor.current ? null : historySnapshot(), local: blockEditor.current ? snapshotModelState() : null }),
    restore: checkpoint => {
      if (blockEditor.current && checkpoint.local) restoreModelState(checkpoint.local);
      else if (checkpoint.document) loadModelData(JSON.parse(checkpoint.document), { documentNameFallback: documentModel.documentName });
    },
    stabilize: namespace => namespace === model
      ? stabilizeActiveParameterNamespace(activeSketchId(), { allSketches: model.sketches.filter(sketch => !isRootSketch(sketch)).map(sketch => sketch.id) })
      : stabilizeStoredBlockDefinition(namespace),
    propagate: blockParameterPropagation.propagate,
  });
  const centerlinePlans = window.CenterlineGeometry.create({ applicationText, parallelTolerance: CENTERLINE_PARALLEL_TOLERANCE });
  const centerlineConstruction = window.CenterlineConstruction.create({ currentScope: workspace.current, geometry: geometryCreation, ids: geometryIds, addPointSnapConstraints, commitNewConstraint });
  const centerlineCommand = window.CenterlineCommand.create({
    plans: centerlinePlans, construction: centerlineConstruction, selection: canvasSelection, sameSketchElements, activeSketchId, isActiveSketchElement, applicationText, minLineLength: MIN_LINE_LENGTH,
    snapForDrawing: pointer => ({ point: snapForDrawing(pointer), snap: drawingSnap.active }), clearSnap,
    setPointerPreview: value => { pointerPreview = value; }, setMode: value => { mode = value; },
    invalidateAnalysis: () => { constraintAnalysisState = null; }, setHint, updateUI, draw,
  });
  const { reset: resetCenterlineCommandState, prepare: prepareCenterlineEndpointPlacement, click: handleCenterlineClick, projectPointToCenterlineSupport } = centerlineCommand;
  const circularConstruction = window.CircularConstruction.create({
    endpointAt, addPoint, addCircle, addArc, addPointSnapConstraints, addArcEndpointSnapConstraints, addCircularBoundarySnapConstraints,
    currentScope: workspace.current, sequences: geometryIds,
  });
  const circularCommands = window.CircularCommands.create({
    construction: circularConstruction, selection: canvasSelection, minArcLength: MIN_ARC_LENGTH,
    setPointerPreview: point => { pointerPreview = point; }, clearSnap, clearSelection, setHint, updateUI, draw, solveAndRefresh,
  });
  const { resetArcs: resetArcCommandState } = circularCommands;
  function handleCircleClick(point) { const snapped = snapForDrawing(point); circularCommands.clickCircle(snapped, drawingSnap.active); }
  function handleArcClick(point) { const snapped = snapForDrawing(point); circularCommands.clickArc(snapped, drawingSnap.active); }
  function handleThreePointArcClick(point) { const snapped = snapForDrawing(point); circularCommands.clickThreePointArc(snapped, drawingSnap.active); }
  const slotConstruction = window.SlotConstruction.create({
    addPoint, addLine, addArc, addConstraintIfMissing, addPointSnapConstraints, addLineBoundarySnapConstraints,
    snapshotGeometryMutationState, restoreGeometryMutationState, solveAndRefresh,
  });
  const slotCommand = window.SlotCommand.create({
    construction: slotConstruction, minLineLength: MIN_LINE_LENGTH, minArcLength: MIN_ARC_LENGTH,
    setPointerPreview: point => { pointerPreview = point; }, clearSnap, clearSelection, setHint, updateUI, draw,
  });
  const { reset: resetSlotCommandState } = slotCommand;
  function handleSlotClick(point) {
    const snapped = snapForDrawing(point);
    slotCommand.click(snapped, drawingSnap.active);
  }
  const CONSTRAINT_STATUS_COLORS = {
    full: "#111827",
    support: "#0f766e",
    under: "#f59e0b",
    conflict: "#dc2626",
  };
  const INACTIVE_CONSTRAINT_STATUS_COLOR = "#cbd5e1";
  const SKETCH_SOLVE_ERROR_COLOR = "#dc2626";
  let lastLoadLineRepairMessage = "";
  let lastLoadBlockConstraintRepairMessage = "";
  let runtimeVersionState = { status: "unavailable" };

  const constraintButtons = Array.from(document.querySelectorAll("[data-constraint]"));
  const constraintMenuButtons = Array.from(document.querySelectorAll("[data-menu-constraint]"));
  const fixPointBtn = document.getElementById("fixPointBtn");
  const commandCursor = window.CommandCursor.create({ document, canvas, fixPointBtn, constraintButtons });

  function renderRuntimeVersion() {
    const target = document.getElementById("runtimeCommit");
    if (!target) return;
    if (runtimeVersionState.status === "loading") {
      target.textContent = applicationText("取得中…", "Loading…");
      target.dataset.state = "loading";
      target.removeAttribute("title");
      return;
    }
    if (runtimeVersionState.status !== "available") {
      target.textContent = applicationText("取得できません", "Unavailable");
      target.dataset.state = "unavailable";
      target.removeAttribute("title");
      return;
    }
    const { branch, commit, shortCommit, dirty } = runtimeVersionState;
    target.textContent = `${branch}@${shortCommit}${dirty ? applicationText("（変更あり）", " (dirty)") : ""}`;
    target.dataset.state = "available";
    target.title = `${branch}@${commit}`;
  }

  function loadRuntimeVersion() {
    const value = window.__JOT2D_RUNTIME_VERSION__;
    if (value?.available && /^[0-9a-f]{40}$/i.test(value.commit) && /^[0-9a-f]{7,40}$/i.test(value.shortCommit)) {
      runtimeVersionState = {
        status: "available",
        branch: String(value.branch || "HEAD"),
        commit: value.commit,
        shortCommit: value.shortCommit,
        dirty: Boolean(value.dirty),
      };
    } else {
      runtimeVersionState = { status: "unavailable" };
    }
    renderRuntimeVersion();
  }

  for (const btn of document.querySelectorAll("button[aria-label]")) {
    btn.dataset.tooltip = btn.getAttribute("aria-label");
  }

  function log(msg) {
    const el = document.getElementById("log");
    if (!el) return;
    el.textContent = `${msg}\n` + el.textContent;
  }

  function activateSidebarTab(tabId) {
    for (const button of document.querySelectorAll("[data-sidebar-tab]")) {
      const active = button.dataset.sidebarTab === tabId;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    }
    for (const panel of document.querySelectorAll("[data-sidebar-panel]")) {
      const active = panel.dataset.sidebarPanel === tabId;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    }
  }

  function setSidebarCollapsed(collapsed, hintText = "") {
    const app = document.querySelector(".app");
    if (!app) return false;
    const changed = app.classList.contains("side-collapsed") !== collapsed;
    app.classList.toggle("side-collapsed", collapsed);
    const btn = document.getElementById("toggleSideBtn");
    const label = collapsed ? "サイドバーを開く" : "サイドバーをたたむ";
    btn?.setAttribute("aria-label", label);
    btn?.setAttribute("title", label);
    if (btn) btn.dataset.tooltip = label;
    if (hintText) setHint(hintText);
    return changed;
  }

  function setHint(msg, kind = "normal") {
    if (!interactionProfiler.active) return setHintUnprofiled(msg, kind);
    return profileInteractionWork("ui", () => setHintUnprofiled(msg, kind));
  }

  function setHintUnprofiled(msg, kind = "normal") {
    const el = document.getElementById("hint");
    el.dataset.hintSource = String(msg);
    el.textContent = translatedHintText(msg);
    el.classList.toggle("error", kind === "error");
  }

  function solveOperationLabel(label) {
    const labels = {
      "点追加": ["点の追加", "Point creation"],
      "線追加": ["連続線の追加", "Polyline creation"],
      "矩形追加": ["矩形の追加", "Rectangle creation"],
      "長穴追加": ["長穴の追加", "Slot creation"],
      "円追加": ["円の追加", "Circle creation"],
      "円弧追加": ["円弧の追加", "Arc creation"],
      "3点円弧追加": ["3点円弧の追加", "Three-point arc creation"],
      "スプライン追加": ["スプラインの追加", "Spline creation"],
      "ブロック配置": ["ブロック配置", "Block placement"],
      "インスタンス削除": ["インスタンス削除", "Instance deletion"],
      "貼り付け": ["貼り付け", "Paste"],
      "ファイル読み込み": ["ファイル読み込み", "File load"],
      "サンプル復元": ["サンプル復元", "Sample restore"],
    };
    const pair = labels[String(label)];
    return applicationText(pair?.[0] || String(label), pair?.[1] || String(label));
  }

  function setSolveResultHint(label, solved, analysis, dependent) {
    const hasDependentError = dependent?.success === false;
    const hasDuplicateConstraints = (constraintRedundancyState?.count || 0) > 0;
    const stable = Boolean(solved?.success && analysis?.analysis?.stable && !hasDependentError && !hasDuplicateConstraints);
    const operation = solveOperationLabel(label);
    const message = stable
      ? applicationText(`${operation}が完了しました`, `${operation} completed`)
      : solved?.success
        ? applicationText(`${operation}が完了しました。拘束状態を確認してください`, `${operation} completed. Check the constraint status`)
        : applicationText(`${operation}を完了できませんでした。拘束や形状を確認してください`, `${operation} could not be completed. Check the constraints and geometry`);
    setHint(message, stable ? "normal" : "error");
  }

  function effectiveDocumentName() {
    return effectiveDocumentNameFromValue(documentModel.documentName);
  }

  function updateDocumentNameUI() {
    const displayName = effectiveDocumentName();
    const dirty = hasUnsavedDocumentChanges();
    document.title = `${dirty ? "● " : ""}${displayName} - Jot2D`;
    const status = document.getElementById("documentSaveStatus");
    if (status) {
      const label = fileSession.savePending ? applicationText("保存中…", "Saving…")
        : blockEditor.current ? applicationText("ブロック編集中", "Editing block")
        : dirty ? applicationText("未保存の変更", "Unsaved changes")
        : fileSession.checkpointKind === "new" ? applicationText("新規ドキュメント", "New document")
        : fileSession.checkpointKind === "download" ? applicationText("ダウンロード開始済み", "Download started")
        : applicationText("保存済み", "Saved");
      const text = `${displayName} · ${label}`;
      if (status.textContent !== text) status.textContent = text;
      status.title = fileSession.handle ? `${text}\n${fileSession.handle.name}` : text;
      status.dataset.dirty = String(dirty);
    }
  }

  function hasUnsavedDocumentChanges() {
    return fileSession.hasUnsavedChanges({
      snapshot: documentHistory.currentSnapshot, documentName: effectiveDocumentName(), editingBlock: Boolean(blockEditor.current),
    });
  }

  function markDocumentFileCheckpoint(kind, data = serializeModel()) {
    fileSession.markCheckpoint(kind, data);
    updateDocumentNameUI();
  }

  async function confirmDocumentReplacement() {
    if (!blockEditor.current && fileSession.matchesCheckpoint(serializeModel())) return true;
    const choice = await choiceDialog.show({
      title: applicationText("未保存の変更があります", "Unsaved changes"),
      message: applicationText("別のファイルを開く前に、現在の図面を保存しますか？", "Save the current drawing before opening another file?"),
      choices: [
        { value: "save", label: applicationText("保存して開く", "Save and open") },
        { value: "discard", label: applicationText("保存せずに開く", "Open without saving") },
      ],
      defaultValue: "save",
      cancelLabel: applicationText("キャンセル", "Cancel"),
      closeLabel: applicationText("閉じる", "Close"),
    });
    if (choice === "save") return await saveJot2DFile({ replacingDocument: true })
      && !blockEditor.current && fileSession.matchesCheckpoint(serializeModel());
    return choice === "discard";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  }

  function hatchPatternTypeLabel(patternType) {
    if (patternType === "cross") return applicationText("クロス", "Cross");
    if (patternType === "solid") return applicationText("塗りつぶし", "Solid fill");
    return applicationText("平行線", "Parallel");
  }

  function normalizedSketchCopy(sketch) {
    return {
      ...sketch,
      appearance: normalizeAppearance(sketch?.appearance),
      constructionAppearance: normalizeConstructionAppearance(sketch?.constructionAppearance),
      dimensionAppearance: normalizeDimensionAppearance(sketch?.dimensionAppearance),
    };
  }

  function effectiveDimensionAppearance(dimension, sketchId = activeSketchId(), sketches = model.sketches) {
    const sketch = sketches.find((item) => item.id === sketchId) || sketches.find((item) => isRootSketch(item)) || null;
    return resolveDimensionAppearance(documentModel.defaultDimensionAppearance,
      sketch && !isRootSketch(sketch) ? sketch.dimensionAppearance : null, dimension?.display);
  }

  function ensureAppearanceState() {
    documentModel.defaultAppearance = normalizeAppearance(documentModel.defaultAppearance, { partial: false });
    documentModel.defaultConstructionAppearance = normalizeConstructionAppearance(documentModel.defaultConstructionAppearance, { partial: false });
    documentModel.defaultDimensionAppearance = normalizeDimensionAppearance(documentModel.defaultDimensionAppearance, { partial: false });
    const root = model.sketches.find((sketch) => isRootSketch(sketch));
    if (root) {
      const legacyAppearance = normalizeAppearance(root.appearance);
      const legacyConstructionAppearance = normalizeConstructionAppearance(root.constructionAppearance);
      const legacyDimensionAppearance = normalizeDimensionAppearance(root.dimensionAppearance);
      if (blockEditor.current) {
        for (const sketch of model.sketches.filter((item) => !isRootSketch(item))) {
          sketch.appearance = { ...legacyAppearance, ...normalizeAppearance(sketch.appearance) };
          sketch.constructionAppearance = { ...legacyConstructionAppearance, ...normalizeConstructionAppearance(sketch.constructionAppearance) };
          sketch.dimensionAppearance = { ...legacyDimensionAppearance, ...normalizeDimensionAppearance(sketch.dimensionAppearance) };
        }
      } else {
        documentModel.defaultAppearance = { ...documentModel.defaultAppearance, ...legacyAppearance };
        documentModel.defaultConstructionAppearance = { ...documentModel.defaultConstructionAppearance, ...legacyConstructionAppearance };
        documentModel.defaultDimensionAppearance = { ...documentModel.defaultDimensionAppearance, ...legacyDimensionAppearance };
      }
      root.appearance = {};
      root.constructionAppearance = {};
      root.dimensionAppearance = {};
    }
    const fallbackSketchId = model.sketches.find((sketch) => !isRootSketch(sketch))?.id || DEFAULT_SKETCH_ID;
    model.annotations = normalizeAnnotations(model.annotations, fallbackSketchId);
    model.hatches = normalizeHatches(model.hatches, fallbackSketchId);
    model.referenceImages = normalizeReferenceImages(model.referenceImages, fallbackSketchId);
    for (const item of [...model.points, ...model.lines, ...model.circles, ...model.arcs, ...model.splines]) item.appearance = normalizeAppearance(item.appearance);
  }

  function ensureBlockState() {
    if (!Array.isArray(documentModel.blockDefinitions)) documentModel.blockDefinitions = [];
    if (!Array.isArray(model.blockInstances)) model.blockInstances = [];
    if (!Array.isArray(model.geometryInstances)) model.geometryInstances = [];
    const definitionIds = new Set();
    documentModel.blockDefinitions = documentModel.blockDefinitions.filter(Boolean).map((definition, index) => {
      let id = String(definition.id || `B${index + 1}`);
      while (definitionIds.has(id)) id = `B${index + 1}-${definitionIds.size + 1}`;
      definitionIds.add(id);
      definition.id = id;
      definition.name = String(definition.name || `Block-${index + 1}`);
      definition.parentDefinitionId = definition.parentDefinitionId == null ? null : String(definition.parentDefinitionId);
      definition.origin = {
        x: Number(definition.origin?.x) || 0,
        y: Number(definition.origin?.y) || 0,
      };
      if (!Array.isArray(definition.geometryInstances)) definition.geometryInstances = [];
      if (!Array.isArray(definition.sketches) || definition.sketches.length === 0) {
        definition.sketches = [
          { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", appearance: {} },
          { id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {} },
        ];
      }
      let root = definition.sketches.find((sketch) => sketch?.kind === "root" || sketch?.id === ROOT_SKETCH_ID);
      if (!root) {
        root = { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", appearance: {} };
        definition.sketches.unshift(root);
      }
      root.id = ROOT_SKETCH_ID;
      root.name = ROOT_SKETCH_NAME;
      root.parentSketchId = null;
      root.kind = "root";
      root.appearance = normalizeAppearance(root.appearance);
      root.constructionAppearance = normalizeConstructionAppearance(root.constructionAppearance);
      root.dimensionAppearance = normalizeDimensionAppearance(root.dimensionAppearance);
      const legacyRootAppearance = root.appearance;
      const legacyRootConstructionAppearance = root.constructionAppearance;
      const legacyRootDimensionAppearance = root.dimensionAppearance;
      root.appearance = {};
      root.constructionAppearance = {};
      root.dimensionAppearance = {};
      root.visible = true;
      definition.sketches = [root, ...definition.sketches.filter((sketch) => sketch && sketch !== root && sketch.id !== ROOT_SKETCH_ID && sketch.kind !== "root")];
      if (!definition.sketches.some((sketch) => sketch.kind !== "root")) {
        definition.sketches.push({ id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {} });
      }
      const sketchIds = new Set(definition.sketches.map((sketch) => String(sketch.id)));
      for (const sketch of definition.sketches) {
        sketch.id = String(sketch.id);
        if (sketch === root) continue;
        sketch.kind = "sketch";
        sketch.name = String(sketch.name || sketch.id);
        sketch.appearance = normalizeAppearance(sketch.appearance || (sketch.visible === false ? { visible: false } : {}));
        sketch.constructionAppearance = normalizeConstructionAppearance(sketch.constructionAppearance);
        sketch.dimensionAppearance = normalizeDimensionAppearance(sketch.dimensionAppearance);
        if (Object.keys(legacyRootAppearance).length > 0) sketch.appearance = { ...legacyRootAppearance, ...sketch.appearance };
        if (Object.keys(legacyRootConstructionAppearance).length > 0) sketch.constructionAppearance = { ...legacyRootConstructionAppearance, ...sketch.constructionAppearance };
        if (Object.keys(legacyRootDimensionAppearance).length > 0) sketch.dimensionAppearance = { ...legacyRootDimensionAppearance, ...sketch.dimensionAppearance };
        sketch.visible = sketch.appearance.visible !== false;
        sketch.parentSketchId = sketch.parentSketchId == null ? ROOT_SKETCH_ID : String(sketch.parentSketchId);
        if (sketch.parentSketchId === sketch.id || !sketchIds.has(sketch.parentSketchId)) sketch.parentSketchId = ROOT_SKETCH_ID;
      }
      const fallbackSketchId = definition.sketches.find((sketch) => sketch.kind !== "root")?.id || DEFAULT_SKETCH_ID;
      definition.activeSketchId = sketchIds.has(String(definition.activeSketchId)) ? String(definition.activeSketchId) : fallbackSketchId;
      definition.points = Array.isArray(definition.points) ? definition.points : [];
      definition.lines = Array.isArray(definition.lines) ? definition.lines : [];
      definition.circles = Array.isArray(definition.circles) ? definition.circles : [];
      definition.arcs = Array.isArray(definition.arcs) ? definition.arcs : [];
      definition.splines = Array.isArray(definition.splines) ? definition.splines : [];
      definition.annotations = normalizeAnnotations(definition.annotations, fallbackSketchId);
      definition.hatches = normalizeHatches(definition.hatches, fallbackSketchId);
      definition.referenceImages = normalizeReferenceImages(definition.referenceImages, fallbackSketchId);
      definition.nextHatchIndex = Math.max(nextSeq(definition.hatches, "H"), Number(definition.nextHatchIndex) || 1);
      definition.blockInstances = Array.isArray(definition.blockInstances) ? definition.blockInstances : [];
      definition.constraints = Array.isArray(definition.constraints) ? definition.constraints : [];
      for (const item of [...definition.points, ...definition.lines, ...definition.circles, ...definition.arcs, ...definition.splines, ...definition.constraints]) {
        if (!sketchIds.has(String(item.sketchId)) || item.sketchId === ROOT_SKETCH_ID) item.sketchId = fallbackSketchId;
        else item.sketchId = String(item.sketchId);
        if (item instanceof Point || item instanceof Line || item instanceof Circle || item instanceof Arc || item instanceof Spline) item.appearance = normalizeAppearance(item.appearance);
      }
      definition.revision = Number(definition.revision) || 0;
      return definition;
    });
    const containingDefinitionIds = new Map();
    for (const definition of documentModel.blockDefinitions) {
      for (const instance of definition.blockInstances || []) {
        const childId = String(instance?.definitionId || "");
        if (!definitionIds.has(childId)) continue;
        if (!containingDefinitionIds.has(childId)) containingDefinitionIds.set(childId, new Set());
        containingDefinitionIds.get(childId).add(definition.id);
      }
    }
    for (const definition of documentModel.blockDefinitions) {
      const inferredParents = [...(containingDefinitionIds.get(definition.id) || [])];
      if (!definition.parentDefinitionId && inferredParents.length === 1) definition.parentDefinitionId = inferredParents[0];
      if (definition.parentDefinitionId === definition.id) definition.parentDefinitionId = null;
    }
    for (const definition of documentModel.blockDefinitions) {
      const drawableSketchIds = blockDefinitionDrawableSketchIds(definition);
      const fallbackSketchId = drawableSketchIds[0] || DEFAULT_SKETCH_ID;
      definition.blockInstances = definition.blockInstances
        .filter((instance) => instance && definitionIds.has(String(instance.definitionId)) && documentModel.blockDefinitions.find((item) => item.id === String(instance.definitionId))?.parentDefinitionId === definition.id)
        .map((instance, index) => {
          instance.id = String(instance.id || `BI${index + 1}`);
          instance.definitionId = String(instance.definitionId);
          instance.sketchId = drawableSketchIds.includes(String(instance.sketchId)) ? String(instance.sketchId) : fallbackSketchId;
          instance.x = Number(instance.x) || 0;
          instance.y = Number(instance.y) || 0;
          instance.rotation = Number(instance.rotation) || 0;
          instance.fixed = Boolean(instance.fixed);
          instance.rotationLocked = Boolean(instance.rotationLocked);
          instance.drawingOrder = normalizedDrawingOrder(instance.drawingOrder);
          instance.appearanceOverride = normalizeAppearance(instance.appearanceOverride);
          const nestedDefinition = documentModel.blockDefinitions.find((item) => item.id === instance.definitionId);
          const nestedDrawableIds = blockDefinitionDrawableSketchIds(nestedDefinition);
          const requested = Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.map(String) : nestedDrawableIds;
          instance.enabledSketchIds = [...new Set(requested.filter((id) => nestedDrawableIds.includes(id)))];
          if (instance.enabledSketchIds.length === 0) instance.enabledSketchIds = blockDefinitionGeometrySketchIds(nestedDefinition);
          return instance;
        });
    }
    const instanceIds = new Set();
    const activeContainerDefinitionId = blockEditor.current?.draft?.id || null;
    model.blockInstances = model.blockInstances.filter((instance) => {
      if (!instance || !definitionIds.has(String(instance.definitionId))) return false;
      const instanceDefinition = documentModel.blockDefinitions.find((definition) => definition.id === String(instance.definitionId));
      return (instanceDefinition?.parentDefinitionId || null) === activeContainerDefinitionId;
    }).map((instance, index) => {
      let id = String(instance.id || `BI${index + 1}`);
      while (instanceIds.has(id)) id = `BI${index + 1}-${instanceIds.size + 1}`;
      instanceIds.add(id);
      instance.id = id;
      instance.definitionId = String(instance.definitionId);
      instance.sketchId = isDrawableSketch(instance.sketchId) ? String(instance.sketchId) : firstDrawableSketchId();
      instance.x = Number(instance.x) || 0;
      instance.y = Number(instance.y) || 0;
      instance.rotation = Number(instance.rotation) || 0;
      instance.fixed = Boolean(instance.fixed);
      instance.rotationLocked = Boolean(instance.rotationLocked);
      instance.drawingOrder = normalizedDrawingOrder(instance.drawingOrder);
      instance.appearanceOverride = normalizeAppearance(instance.appearanceOverride);
      const definition = documentModel.blockDefinitions.find((item) => item.id === instance.definitionId);
      const drawableIds = blockDefinitionDrawableSketchIds(definition);
      const requested = Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.map(String) : drawableIds;
      instance.enabledSketchIds = [...new Set(requested.filter((id) => drawableIds.includes(id)))];
      if (instance.enabledSketchIds.length === 0) instance.enabledSketchIds = blockDefinitionGeometrySketchIds(definition);
      return instance;
    });
  }

  function ensureModelState() {
    documentModel.units = { ...DEFAULT_DOCUMENT_UNITS };
    ensureSketchState();
    ensureAppearanceState();
    ensureBlockState();
    ensureDrawingOrderState(model);
    for (const definition of documentModel.blockDefinitions) ensureDrawingOrderState(definition);
    ensureParameterNamespace(model);
  }

  function expressionReferenceNamesForInput(input) {
    if (input?.closest("#parametersDialog") && parameterDraft.current) {
      return new Set([
        ...parameterDraft.current.parameters.map((parameter) => String(parameter.name || "")),
        ...parameterDraft.current.dimensions.map((dimension) => String(dimension.name || "")),
      ]);
    }
    return new Set([
      ...(model.parameters || []).map((parameter) => String(parameter.name || "")),
      ...dimensionConstraintsInNamespace(model).map((constraint) => String(constraint.parameterName || "")),
    ]);
  }

  function expressionHighlightMarkup(input) {
    const value = String(input?.value ?? "");
    if (!value.trimStart().startsWith("=")) return escapeHtml(value);
    const names = expressionReferenceNamesForInput(input);
    const pattern = /"([A-Za-z_][A-Za-z0-9_]*)"/g;
    let result = "";
    let cursor = 0;
    for (const match of value.matchAll(pattern)) {
      result += escapeHtml(value.slice(cursor, match.index));
      const token = match[0];
      result += names.has(match[1])
        ? `<span class="expression-reference-token">${escapeHtml(token)}</span>`
        : escapeHtml(token);
      cursor = match.index + token.length;
    }
    return result + escapeHtml(value.slice(cursor));
  }

  function syncExpressionInputHighlight(input) {
    if (!(input instanceof HTMLInputElement)) return;
    const shell = input.closest(".expression-input-shell");
    const text = shell?.querySelector(".expression-input-highlight-text");
    if (!text) return;
    text.innerHTML = expressionHighlightMarkup(input) || "&#8203;";
    text.style.transform = `translateX(${-input.scrollLeft}px)`;
  }

  function installExpressionInputHighlight(input) {
    if (!(input instanceof HTMLInputElement) || input.readOnly) return;
    let shell = input.closest(".expression-input-shell");
    if (!shell) {
      shell = document.createElement("span");
      shell.className = "expression-input-shell";
      const highlight = document.createElement("span");
      highlight.className = "expression-input-highlight";
      highlight.setAttribute("aria-hidden", "true");
      const text = document.createElement("span");
      text.className = "expression-input-highlight-text";
      highlight.append(text);
      input.before(shell);
      shell.append(highlight, input);
    }
    input.classList.add("expression-input-source");
    if (input.dataset.expressionHighlightInstalled !== "true") {
      input.dataset.expressionHighlightInstalled = "true";
      input.addEventListener("input", () => syncExpressionInputHighlight(input));
      input.addEventListener("scroll", () => syncExpressionInputHighlight(input));
    }
    syncExpressionInputHighlight(input);
  }

  function installExpressionInputHighlights(root = document) {
    const selector = '#dimensionValueInput, #propertiesPanel [data-property="constraint-expression"], [data-parameter-field="expression"], [data-dimension-field="expression"]:not([readonly])';
    if (root instanceof HTMLInputElement && root.matches(selector)) installExpressionInputHighlight(root);
    for (const input of root.querySelectorAll?.(selector) || []) installExpressionInputHighlight(input);
  }

  function refreshExpressionInputHighlights(root = document) {
    for (const input of root.querySelectorAll?.(".expression-input-source") || []) syncExpressionInputHighlight(input);
  }

  function guardDimensionSymbolDeletion(constraints, namespace = currentParameterNamespace()) {
    const removedConstraints = new Set(constraints || []);
    const removedNames = [...removedConstraints].filter(isDimensionConstraint).map((constraint) => constraint.parameterName).filter(Boolean);
    if (removedNames.length === 0) return true;
    const dependents = parameterDependents(namespace, removedNames, removedConstraints);
    if (dependents.length === 0) return true;
    const message = applicationSettings.language === "en"
      ? `Cannot delete ${removedNames.join(", ")}; referenced by ${dependents.join(", ")}`
      : `${removedNames.join("、")} は ${dependents.join("、")} から参照されているため削除できません`;
    setHint(message, "error");
    log(message);
    return false;
  }

  function evaluateDimensionExpressionDraft(constraint, expression, namespace = currentParameterNamespace()) {
    ensureParameterNamespace(namespace);
    validateParameterSymbolNames(namespace.parameters, dimensionConstraintsInNamespace(namespace));
    const referenceValues = new Map();
    const definitions = namespace.parameters.map((parameter) => ({ ...parameter, kind: "parameter" }));
    for (const item of dimensionConstraintsInNamespace(namespace)) {
      if (isReadOnlyDimension(item)) {
        const target = targetFromConstraint(item);
        const value = target ? measuredDimensionValue(target, item.dimension) : NaN;
        referenceValues.set(item.parameterName, value);
      } else {
        definitions.push({
          name: item.parameterName,
          expression: item === constraint ? String(expression) : item.expression,
          kind: "dimension",
        });
      }
    }
    const evaluated = evaluateParameterDefinitions(definitions, referenceValues);
    const value = constraint
      ? evaluated.values.get(constraint.parameterName)
      : evaluateParameterExpression(String(expression), evaluated.values);
    const target = constraint ? targetFromConstraint(constraint) : null;
    const max = target?.kind === "angle" ? 180 : Infinity;
    if (!Number.isFinite(value) || value <= 0 || value >= max) throw new Error(applicationText("寸法値の範囲が正しくありません", "Dimension value is out of range"));
    return value;
  }

  function isGeometryMode() {
    return true;
  }

  function nextAnnotationId() {
    return `AN${annotationSeq++}`;
  }

  function pushAnnotation(element) {
    if (!canCreateInActiveSketch()) {
      rejectRootSketchCreation();
      return null;
    }
    const item = {
      id: nextAnnotationId(),
      sketchId: activeSketchId(),
      visible: true,
      style: {},
      ...element,
    };
    item.rotation = Number.isFinite(Number(item.rotation)) ? Number(item.rotation) : 0;
    item.style = normalizeAnnotationStyle(item.style);
    model.annotations.push(item);
    updateUI();
    draw();
    return item;
  }

  function constraintGeometryId(item) {
    return geometryRefId(geometryRefForItem(item));
  }

  function geometryElementKey(item) {
    return geometryRefKey(geometryRefForItem(item)) || "";
  }

  function sketchProjectionConstraints() {
    return model.constraints.filter((constraint) => constraint instanceof SketchProjectionConstraint);
  }

  let sketchProjectionTargetCacheConstraints = null;
  let sketchProjectionTargetCacheLength = -1;
  let sketchProjectionTargetCache = new Map();

  function sketchProjectionTargetConstraintMap() {
    if (sketchProjectionTargetCacheConstraints === model.constraints && sketchProjectionTargetCacheLength === model.constraints.length) {
      return sketchProjectionTargetCache;
    }
    const next = new Map();
    for (const constraint of model.constraints) {
      if (!(constraint instanceof SketchProjectionConstraint) || !constraint.target) continue;
      const entries = next.get(constraint.target) || [];
      entries.push(constraint);
      next.set(constraint.target, entries);
    }
    sketchProjectionTargetCacheConstraints = model.constraints;
    sketchProjectionTargetCacheLength = model.constraints.length;
    sketchProjectionTargetCache = next;
    return next;
  }

  function sketchProjectionConstraintForTarget(item, { operationalOnly = true } = {}) {
    return (sketchProjectionTargetConstraintMap().get(item) || []).find((constraint) =>
      !operationalOnly || constraintIsOperational(constraint)) || null;
  }

  function sketchProjectionConstraintsForTarget(item, { operationalOnly = true } = {}) {
    return (sketchProjectionTargetConstraintMap().get(item) || []).filter((constraint) =>
      !operationalOnly || constraintIsOperational(constraint));
  }

  function isSketchProjectedGeometry(item) {
    return Boolean(sketchProjectionConstraintForTarget(item));
  }

  function sketchProjectionPointPairs(constraint) {
    if (!(constraint instanceof SketchProjectionConstraint) || !constraint.source || !constraint.target) return [];
    if (constraint.kind === "point") return [[constraint.source, constraint.target]];
    if (constraint.kind === "line") return [[constraint.source.p1, constraint.target.p1], [constraint.source.p2, constraint.target.p2]];
    if (constraint.kind === "circle" || constraint.kind === "arc") return [[constraint.source.center, constraint.target.center]];
    if (constraint.kind === "spline") {
      return constraint.source.fitPoints.slice(0, constraint.target.fitPoints.length).map((point, index) => [point, constraint.target.fitPoints[index]]);
    }
    return [];
  }


  function separateSharedSketchProjectionTargetPoints(namespace) {
    const points = Array.isArray(namespace?.points) ? namespace.points : [];
    const constraints = Array.isArray(namespace?.constraints) ? namespace.constraints : [];
    const claimed = new Set();
    const processedTargets = new Set();
    const pointIds = new Set(points.map((point) => String(point.id)));
    let nextPointIndex = nextSeq(points, "P");
    const cloneEndpoint = (point) => {
      let id = `P${nextPointIndex++}`;
      while (pointIds.has(id)) id = `P${nextPointIndex++}`;
      pointIds.add(id);
      const clone = new Point(id, point.x, point.y, Boolean(point.fixed), point.kind || "endpoint");
      clone.sketchId = point.sketchId;
      const appearance = normalizeAppearance(point.appearance);
      if (Object.keys(appearance).length > 0) clone.appearance = appearance;
      points.push(clone);
      return clone;
    };
    let separated = 0;
    for (const constraint of constraints) {
      if (!(constraint instanceof SketchProjectionConstraint) || !constraint.target || processedTargets.has(constraint.target)) continue;
      processedTargets.add(constraint.target);
      const slots = constraint.kind === "point" && constraint.target instanceof Point
        ? [{ point: constraint.target, assign: (point) => { constraint.target = point; } }]
        : constraint.kind === "line" && constraint.target instanceof Line
          ? [
              { point: constraint.target.p1, assign: (point) => { constraint.target.p1 = point; } },
              { point: constraint.target.p2, assign: (point) => { constraint.target.p2 = point; } },
            ]
          : (constraint.kind === "circle" && constraint.target instanceof Circle) || (constraint.kind === "arc" && constraint.target instanceof Arc)
            ? [{ point: constraint.target.center, assign: (point) => { constraint.target.center = point; } }]
            : constraint.kind === "spline" && constraint.target instanceof Spline
              ? constraint.target.fitPoints.map((point, index) => ({ point, assign: (next) => { constraint.target.fitPoints[index] = next; } }))
              : [];
      for (const slot of slots) {
        let point = slot.point;
        if (claimed.has(point)) {
          point = cloneEndpoint(point);
          slot.assign(point);
          if (constraint.target instanceof Spline) constraint.target._curveCache = null;
          separated += 1;
        }
        claimed.add(point);
      }
    }
    return separated;
  }

  function pointHasNonProjectionUse(point, excludingConstraint = null) {
    if (!point) return false;
    if (model.lines.some((line) => line.p1 === point || line.p2 === point)) return true;
    if (model.circles.some((circle) => circle.center === point)) return true;
    if (model.arcs.some((arc) => arc.center === point)) return true;
    if (model.splines.some((spline) => spline.fitPoints.includes(point))) return true;
    if (model.constraints.some((constraint) => constraint !== excludingConstraint && constraintReferencesPoint(constraint, point))) return true;
    return model.annotations.some((annotation) => annotation?.type === "leader" && resolveGeometryRef(annotation.geometryRef) === point);
  }

  function synchronizeSketchProjectionConstraint(constraint) {
    if (!(constraint instanceof SketchProjectionConstraint) || !constraint.source || !constraint.target) return false;
    const reboundSource = resolveGeometryRef(geometryRefForItem(constraint.source));
    if (reboundSource) constraint.source = reboundSource;
    if (geometryKindForItem(constraint.source) !== constraint.kind || geometryKindForItem(constraint.target) !== constraint.kind) return false;
    let changed = false;
    if (["line", "circle", "arc", "spline"].includes(constraint.kind) && constraint.target.construction !== Boolean(constraint.source.construction)) {
      constraint.target.construction = Boolean(constraint.source.construction);
      changed = true;
    }
    if (constraint.kind !== "spline") return changed;

    const sourceIdsBefore = Array.isArray(constraint.sourcePointIds) ? constraint.sourcePointIds : [];
    const oldTargetPoints = constraint.target.fitPoints.slice();
    const oldBySourceId = new Map();
    sourceIdsBefore.forEach((id, index) => {
      if (!oldTargetPoints[index]) return;
      const key = String(id);
      const entries = oldBySourceId.get(key) || [];
      entries.push(oldTargetPoints[index]);
      oldBySourceId.set(key, entries);
    });
    const targetSketchId = constraintSketchId(constraint);
    const nextTargetPoints = constraint.source.fitPoints.map((sourcePoint) => {
      const existing = oldBySourceId.get(String(sourcePoint.id))?.shift();
      return existing || addPointToSketch(sourcePoint.x, sourcePoint.y, targetSketchId, "endpoint");
    });
    if (nextTargetPoints.length !== oldTargetPoints.length || nextTargetPoints.some((point, index) => point !== oldTargetPoints[index])) {
      constraint.target.fitPoints = nextTargetPoints;
      constraint.target._curveCache = null;
      changed = true;
    }
    if (constraint.target.closed !== Boolean(constraint.source.closed)) {
      constraint.target.closed = Boolean(constraint.source.closed);
      constraint.target._curveCache = null;
      changed = true;
    }
    constraint.sourcePointIds = constraint.source.fitPoints.map((point) => String(point.id));
    for (const point of oldTargetPoints) {
      if (nextTargetPoints.includes(point) || point.kind !== "endpoint" || pointHasNonProjectionUse(point, constraint)) continue;
      model.points = model.points.filter((item) => item !== point);
      changed = true;
    }
    return changed;
  }

  function synchronizeSketchProjectionMetadata(sketchId = null) {
    let changed = false;
    for (const constraint of sketchProjectionConstraints()) {
      if (!constraintIsOperational(constraint) || sketchId && constraintSketchId(constraint) !== sketchId) continue;
      changed = synchronizeSketchProjectionConstraint(constraint) || changed;
    }
    return changed;
  }

  function sketchProjectionTargetNodes(target) {
    const nodes = new Set([target]);
    if (target instanceof Line) {
      nodes.add(target.p1).add(target.p2);
    } else if (target instanceof Circle || target instanceof Arc) {
      nodes.add(target.center);
    } else if (target instanceof Spline) {
      for (const point of target.fitPoints) nodes.add(point);
    }
    return nodes;
  }

  function sketchProjectionConstraintsAffectingItems(items, { includeSharedNodes = true, operationalOnly = true } = {}) {
    const directTargets = new Set(items || []);
    const touched = new Set();
    for (const item of items || []) for (const node of sketchProjectionTargetNodes(item)) touched.add(node);
    return model.constraints.filter((constraint) =>
      constraint instanceof SketchProjectionConstraint
      && (!operationalOnly || constraintIsOperational(constraint))
      && (includeSharedNodes
        ? [...sketchProjectionTargetNodes(constraint.target)].some((node) => touched.has(node))
        : directTargets.has(constraint.target)));
  }

  function sketchProjectionShapeEditBlockedMessage(action = "") {
    const prefix = action ? `${action}: ` : "";
    return applicationText(
      `${prefix}旧形式の投影拘束を削除してから形状を編集してください`,
      `${prefix}Delete the legacy sketch projection constraint before editing the shape.`,
    );
  }

  function guardSketchProjectionShapeEdit(items, { includeSharedNodes = true, action = "" } = {}) {
    if (sketchProjectionConstraintsAffectingItems(items, { includeSharedNodes }).length === 0) return true;
    setHint(sketchProjectionShapeEditBlockedMessage(action), "error");
    return false;
  }

  function annotationBounds(element) {
    if (!element) return null;
    const style = normalizeAnnotationStyle(element.style);
    const fontSize = style.textHeight * ANNOTATION_SCREEN_PX_PER_MM;
    const textWidth = Math.max(28, String(element.text || "").length * fontSize * 0.62);
    const textHeight = fontSize + 10;
    const center = { x: Number(element.x) || 0, y: Number(element.y) || 0 };
    const rotation = Number(element.rotation) || 0;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const left = style.textAlign === "center" ? -textWidth / 2 : style.textAlign === "right" ? -textWidth : 0;
    const right = left + textWidth;
    const textCorners = [
      { x: left, y: -textHeight / 2 },
      { x: right, y: -textHeight / 2 },
      { x: right, y: textHeight / 2 },
      { x: left, y: textHeight / 2 },
    ].map((point) => ({
      x: center.x + point.x * cos - point.y * sin,
      y: center.y + point.x * sin + point.y * cos,
    }));
    let bounds = {
      x1: Math.min(...textCorners.map((point) => point.x)),
      y1: Math.min(...textCorners.map((point) => point.y)),
      x2: Math.max(...textCorners.map((point) => point.x)),
      y2: Math.max(...textCorners.map((point) => point.y)),
    };
    if (element.type === "leader") {
      for (const point of [element.start, element.elbow, element.end]) {
        if (point) bounds = mergeBounds(bounds, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
      }
    }
    return bounds;
  }

  function blockLocalGeometryBounds(definition, enabledSketchIds = blockDefinitionDrawableSketchIds(definition), visiting = new Set()) {
    if (!definition) return null;
    if (visiting.has(definition.id)) return null;
    const nextVisiting = new Set(visiting).add(definition.id);
    const enabled = new Set(enabledSketchIds);
    const points = [];
    for (const line of definition.lines || []) {
      if (!enabled.has(String(line.sketchId))) continue;
      points.push(line.p1, line.p2);
    }
    for (const circle of definition.circles || []) {
      if (!enabled.has(String(circle.sketchId))) continue;
      points.push({ x: circle.center.x - circle.radius(), y: circle.center.y - circle.radius() }, { x: circle.center.x + circle.radius(), y: circle.center.y + circle.radius() });
    }
    for (const arc of definition.arcs || []) {
      if (!enabled.has(String(arc.sketchId))) continue;
      const samples = [arc.startAngle, arc.endAngle, 0, Math.PI / 2, Math.PI, Math.PI * 1.5];
      for (const angle of samples) {
        if (angle === arc.startAngle || angle === arc.endAngle || angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) {
          points.push({ x: arc.center.x + Math.cos(angle) * arc.radius(), y: arc.center.y + Math.sin(angle) * arc.radius() });
        }
      }
    }
    for (const spline of definition.splines || []) {
      if (!enabled.has(String(spline.sketchId))) continue;
      const bounds = splineBBox(spline);
      if (bounds) points.push({ x: bounds.x1, y: bounds.y1 }, { x: bounds.x2, y: bounds.y2 });
    }
    for (const annotation of definition.annotations || []) {
      if (!enabled.has(String(annotation.sketchId)) || annotation.visible === false) continue;
      const bounds = annotationBounds(annotation);
      if (bounds) points.push({ x: bounds.x1, y: bounds.y1 }, { x: bounds.x2, y: bounds.y2 });
    }
    for (const hatch of definition.hatches || []) {
      if (!enabled.has(String(hatch.sketchId)) || hatch.appearance?.visible === false) continue;
      const resolved = resolveHatchBoundaryLoops(hatch.boundaryLoops, hatchPrimitivesForScope(definition, hatch.sketchId));
      if (resolved.ok) for (const loop of resolved.loops) points.push(...loop.points);
      else if (hatch.seed) points.push(hatch.seed);
    }
    for (const instance of definition.blockInstances || []) {
      if (!enabled.has(String(instance.sketchId))) continue;
      const nestedDefinition = blockDefinitionById(instance.definitionId);
      const nestedBounds = blockLocalGeometryBounds(nestedDefinition, [...blockInstanceEnabledSketchSet(instance, nestedDefinition)], nextVisiting);
      if (!nestedBounds) continue;
      for (const localPoint of [
        { x: nestedBounds.minX, y: nestedBounds.minY },
        { x: nestedBounds.minX, y: nestedBounds.maxY },
        { x: nestedBounds.maxX, y: nestedBounds.minY },
        { x: nestedBounds.maxX, y: nestedBounds.maxY },
      ]) points.push(blockWorldPoint(instance, localPoint));
    }
    if ((definition.geometryInstances || []).length > 0) {
      const nestedBundles = (definition.blockInstances || []).map((instance) => {
        const nestedDefinition = blockDefinitionById(instance.definitionId);
        return nestedDefinition ? createBlockProjectionBundle(instance, nestedDefinition) : emptyGeometryInstanceBundle(instance);
      });
      for (const bundle of geometryInstanceBundlesForScope(definition, nestedBundles)) {
        if (!bundle.valid || !enabled.has(String(bundle.instance.sketchId))) continue;
        points.push(...bundle.points);
        for (const circle of bundle.circles) {
          points.push({ x: circle.center.x - circle.radius(), y: circle.center.y - circle.radius() }, { x: circle.center.x + circle.radius(), y: circle.center.y + circle.radius() });
        }
        for (const arc of bundle.arcs) {
          const samples = [arc.startAngle, arc.endAngle, 0, Math.PI / 2, Math.PI, Math.PI * 1.5];
          for (const angle of samples) {
            if (angle === arc.startAngle || angle === arc.endAngle || angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) {
              points.push({ x: arc.center.x + Math.cos(angle) * arc.radius(), y: arc.center.y + Math.sin(angle) * arc.radius() });
            }
          }
        }
        for (const spline of bundle.splines || []) {
          const bounds = splineBBox(spline);
          if (bounds) points.push({ x: bounds.x1, y: bounds.y1 }, { x: bounds.x2, y: bounds.y2 });
        }
      }
    }
    if (points.length === 0) return null;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { minX, minY, maxX, maxY, center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 } };
  }

  function blockInstanceDisplayCenter(instance) {
    const definition = blockDefinitionById(instance?.definitionId);
    const bounds = blockLocalGeometryBounds(definition, [...blockInstanceEnabledSketchSet(instance, definition)]);
    const center = bounds?.center || definition?.origin || { x: 0, y: 0 };
    return blockWorldPoint(instance, center);
  }

  function blockInstanceTranslationForAnchor(definition, enabledSketchIds, anchor, rotation) {
    const localCenter = blockLocalGeometryBounds(definition, enabledSketchIds)?.center || definition?.origin || { x: 0, y: 0 };
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return {
      x: anchor.x - localCenter.x * cos + localCenter.y * sin,
      y: anchor.y - localCenter.x * sin - localCenter.y * cos,
      localCenter,
    };
  }

  function snappedBlockRotation(rotation) {
    const quarterTurns = Math.round((Number(rotation) || 0) / BLOCK_ORTHOGONAL_ROTATION_STEP);
    return ((quarterTurns % 4) + 4) % 4 * BLOCK_ORTHOGONAL_ROTATION_STEP;
  }



  function blockInstanceById(id) {
    return model.blockInstances.find((instance) => instance.id === id) || null;
  }

  function hatchPrimitiveForElement(element) {
    if (element instanceof Line) return { kind: "line", id: element.id, p1: element.p1, p2: element.p2 };
    if (element instanceof Circle) return { kind: "circle", id: element.id, center: element.center, radius: element.radius() };
    if (element instanceof Arc) return { kind: "arc", id: element.id, center: element.center, radius: element.radius(), startAngle: element.startAngle, endAngle: element.endAngle };
    if (element instanceof Spline) return { kind: "spline", id: element.id, points: element.fitPoints, closed: element.closed };
    return null;
  }

  function hatchPrimitiveFingerprint(primitive) {
    if (!primitive) return "invalid";
    if (primitive.kind === "line") return `line:${primitive.id}:${primitive.p1.x}:${primitive.p1.y}:${primitive.p2.x}:${primitive.p2.y}`;
    if (primitive.kind === "spline") return `spline:${primitive.id}:${primitive.closed ? 1 : 0}:${(primitive.points || []).map((point) => `${point.x}:${point.y}`).join("|")}`;
    return `${primitive.kind}:${primitive.id}:${primitive.center?.x}:${primitive.center?.y}:${primitive.radius}:${primitive.startAngle ?? ""}:${primitive.endAngle ?? ""}`;
  }

  function hatchPrimitivesFromElements(elements, sketchId, { visibleOnly = false } = {}) {
    return elements
      .filter((element) => String(element.sketchId) === String(sketchId) && !element.construction)
      .filter((element) => !visibleOnly || effectiveAppearanceForElement(element).visible !== false)
      .map(hatchPrimitiveForElement)
      .filter(Boolean);
  }

  function hatchPrimitivesForScope(scope, sketchId, { visibleOnly = false } = {}) {
    const elements = scope === model
      ? [...allGeometryLines(), ...allGeometryCircles(), ...allGeometryArcs(), ...allGeometrySplines()]
      : [...(scope?.lines || []), ...(scope?.circles || []), ...(scope?.arcs || []), ...(scope?.splines || [])];
    return hatchPrimitivesFromElements(elements, sketchId, { visibleOnly });
  }

  function normalizeGeometryInstanceRef(value, expectedKind = null) {
    return geometryInstancePersistence.normalizeRef(value, expectedKind);
  }

  function normalizeGeometryInstance(raw, normalizeSketch = value => String(value || activeSketchId()), index = 0) {
    return geometryInstancePersistence.normalize(raw, normalizeSketch, index);
  }

  const { serializeGeometryInstance } = window.DocumentSnapshot;

  function geometryInstanceTypeLabel(type) {
    if (type === "free") return applicationText("同期インスタンス", "Synchronized Instance");
    if (type === "mirror") return applicationText("ミラー", "Mirror");
    if (type === "pattern") return applicationText("直線パターン", "Linear Pattern");
    return applicationText("スケッチ投影", "Sketch Projection");
  }

  function hatchBoundaryFingerprint(hatch, scope = model) {
    const elements = scope === model
      ? [...allGeometryLines(), ...allGeometryCircles(), ...allGeometryArcs(), ...allGeometrySplines()]
      : [...(scope.lines || []), ...(scope.circles || []), ...(scope.arcs || []), ...(scope.splines || [])];
    const byKey = new Map([
      ...elements.map((item) => [`${geometryKindForItem(item)}:${item.id}`, item]),
    ]);
    return hatchBoundaryGeometryRefs(hatch.boundaryLoops).map((ref) => {
      const item = byKey.get(`${ref.kind}:${geometryRefId(ref)}`);
      if (!item) return `${ref.kind}:${geometryRefId(ref)}:missing`;
      if (item instanceof Line) return `line:${item.id}:${item.construction}:${item.p1.x}:${item.p1.y}:${item.p2.x}:${item.p2.y}`;
      if (item instanceof Spline) return `spline:${item.id}:${item.construction}:${item.closed}:${item.fitPoints.map((point) => `${point.x}:${point.y}`).join(":")}`;
      return `${ref.kind}:${item.id}:${item.construction}:${item.center.x}:${item.center.y}:${item.radius()}:${item instanceof Arc ? `${item.startAngle}:${item.endAngle}` : ""}`;
    }).join("|");
  }

  function resolvedHatchBoundary(hatch) {
    if (!hatch) return { ok: false, code: "missing-hatch", reason: applicationText("ハッチングが見つかりません", "Hatch not found") };
    if (hatch.blockProjection) return hatch.resolvedBoundary || { ok: false, code: "invalid-boundary", reason: applicationText("ブロック内の境界が無効です", "The block hatch boundary is invalid") };
    const fingerprint = hatchBoundaryFingerprint(hatch);
    const cached = hatchResolutionCache.get(hatch);
    if (cached?.fingerprint === fingerprint) return cached.result;
    const result = resolveHatchBoundaryLoops(hatch.boundaryLoops, hatchPrimitivesForScope(model, hatch.sketchId));
    hatchResolutionCache.set(hatch, { fingerprint, result });
    return result;
  }

  function hitHatchAt(x, y, { activeOnly = true } = {}) {
    const point = { x, y };
    const candidates = allHatches().filter((hatch) => {
      if (!isVisibleSketchId(hatch.sketchId) || hatchAppearanceForDisplay(hatch).visible === false) return false;
      if (!activeOnly) return true;
      return hatch.sketchId === activeSketchId();
    });
    candidates.sort((a, b) => (normalizedDrawingOrder(drawingOrderOwner(b).drawingOrder) ?? 0) - (normalizedDrawingOrder(drawingOrderOwner(a).drawingOrder) ?? 0));
    for (const hatch of candidates) {
      const resolved = resolvedHatchBoundary(hatch);
      if (hatchContainsSelectablePoint(hatch, resolved, point)) return hatch;
    }
    return null;
  }

  function hitReferenceImageAt(x, y, { activeOnly = true } = {}) {
    const point = { x, y };
    for (let index = model.referenceImages.length - 1; index >= 0; index -= 1) {
      const item = model.referenceImages[index];
      if (item.visible === false || !isVisibleSketchId(item.sketchId)) continue;
      if (activeOnly && item.sketchId !== activeSketchId()) continue;
      const local = referenceImageWorldToLocal(item, point);
      if (Math.abs(local.x) <= item.pixelWidth / 2 && Math.abs(local.y) <= item.pixelHeight / 2) return item;
    }
    return null;
  }

  function beginReferenceImageDrag(event, item, pointer) {
    clearSelection();
    canvasSelection.set("referenceImages", [item]);
    if (item.locked) {
      setHint(applicationText("位置がロックされた画像です", "This image position is locked"));
      updateUI({ refreshAnalysis: false });
      draw();
      return;
    }
    referenceImageDragSession = { item, pointerId: event.pointerId, startPointer: pointer, startX: item.x, startY: item.y, moved: false };
    canvas.classList.add("is-dragging");
    canvas.setPointerCapture(event.pointerId);
    setHint(applicationText("画像を移動中", "Moving image"));
    updateUI({ refreshAnalysis: false });
    draw();
  }

  function updateReferenceImageDrag(pointer) {
    const session = referenceImageDragSession;
    if (!session) return;
    const dx = pointer.x - session.startPointer.x;
    const dy = pointer.y - session.startPointer.y;
    if (!session.moved && hypot2(dx, dy) <= 3 / viewport.scale) return;
    session.moved = true;
    session.item.x = session.startX + dx;
    session.item.y = session.startY + dy;
    draw();
  }

  function startReferenceImageCalibration(item) {
    if (!item || item.locked || item.visible === false) return false;
    referenceImageCalibrationSession = { item, localPoints: [], worldPoints: [] };
    clearSnap();
    setHint(applicationText("画像上の1点目をクリックしてください", "Click the first point on the image"));
    draw();
    return true;
  }

  function cancelReferenceImageCalibration(message = applicationText("縮尺設定をキャンセルしました", "Scale calibration canceled")) {
    if (!referenceImageCalibrationSession) return false;
    referenceImageCalibrationSession = null;
    setHint(message);
    draw();
    return true;
  }

  function handleReferenceImageCalibrationClick(pointer) {
    const session = referenceImageCalibrationSession;
    if (!session) return false;
    const hit = hitReferenceImageAt(pointer.x, pointer.y);
    if (hit !== session.item) {
      setHint(applicationText("選択中の画像内をクリックしてください", "Click inside the selected image"), "error");
      return true;
    }
    session.localPoints.push(referenceImageWorldToLocal(session.item, pointer));
    session.worldPoints.push({ x: pointer.x, y: pointer.y });
    if (session.localPoints.length === 1) {
      setHint(applicationText("画像上の2点目をクリックしてください", "Click the second point on the image"));
      draw();
      return true;
    }
    const pixelDistance = hypot2(session.localPoints[1].x - session.localPoints[0].x, session.localPoints[1].y - session.localPoints[0].y);
    const currentDistance = pixelDistance * session.item.scale;
    const raw = window.prompt(applicationText("2点間の実寸を入力してください (mm)", "Enter the real distance between the points (mm)"), formatDisplayNumber(currentDistance, 6));
    if (raw == null) return cancelReferenceImageCalibration();
    const realDistance = Number(raw);
    if (!Number.isFinite(realDistance) || realDistance <= 0 || pixelDistance <= 0) {
      setHint(applicationText("0より大きい実寸を入力してください", "Enter a real distance greater than zero"), "error");
      session.localPoints = [];
      session.worldPoints = [];
      return true;
    }
    const firstWorld = session.worldPoints[0];
    const firstLocal = session.localPoints[0];
    session.item.scale = realDistance / pixelDistance;
    const projectedFirst = referenceImageLocalToWorld({ ...session.item, x: 0, y: 0 }, firstLocal);
    session.item.x = firstWorld.x - projectedFirst.x;
    session.item.y = firstWorld.y - projectedFirst.y;
    referenceImageCalibrationSession = null;
    recordHistory("画像縮尺設定");
    setHint(applicationText("画像の縮尺を設定しました", "Image scale calibrated"));
    updateUI({ refreshAnalysis: false });
    draw();
    return true;
  }

  function decorateSerializedConstraint(data, constraint) {
    if (!data || !constraint) return data;
    if (constraint.readOnlyDimension) data.readOnlyDimension = true;
    if (isDimensionConstraint(constraint)) {
      data.parameterName = constraint.parameterName || null;
      if (!constraint.readOnlyDimension) data.expression = constraint.expression || numericDimensionExpression(constraint);
    }
    return data;
  }

  function effectiveAppearanceForElement(item) {
    const cached = geometryReads.readAppearance(item);
    if (cached) return cached;
    const construction = (item instanceof Line || item instanceof Circle || item instanceof Arc || item instanceof Spline) && item.construction;
    const outerSketch = sketchById(elementSketchId(item));
    const definitionSketch = item?.blockProjection && !item?.derivedProjection
      ? item.blockDefinition?.sketches?.find((sketch) => sketch.id === item.localElement?.sketchId) : null;
    const result = resolveGeometryAppearance({
      defaults: construction ? documentModel.defaultConstructionAppearance : documentModel.defaultAppearance,
      construction,
      sketchAppearance: sketchGeometryAppearanceLayer(outerSketch, construction),
      definitionSketchAppearance: sketchGeometryAppearanceLayer(definitionSketch, construction),
      elementAppearance: item?.derivedProjection ? null : item?.blockProjection ? item.localElement?.appearance : item?.appearance,
      overrides: item?.derivedProjection ? [item.derivedInstance?.appearanceOverride]
        : item?.blockProjection ? item.blockAppearanceOverrides || [item.blockInstance?.appearanceOverride] : [],
    });
    geometryReads.cacheAppearance(item, result);
    return result;
  }

  function setAppearanceForSelection(patch) {
    const target = appearanceSelectionTarget();
    if (!target) return false;
    target.item[target.key] = normalizeAppearance({ ...target.item[target.key], ...patch });
    if (target.kind === "blockInstance") invalidateBlockProjectionCache(target.item.id);
    updatePropertiesUI();
    draw();
    recordHistory("Appearance変更");
    return true;
  }

  function createLeaderAnnotation() {
    if (rejectRootSketchCreation()) return;
    const target = annotationLeaderTargetFromSelection(lastPointerWorld);
    if (target) {
      startLeaderAnnotationPlacement(target, lastPointerWorld);
      return;
    }
    clearSelection();
    pendingCommand = { type: "annotation-leader-select" };
    setHint("引出線を付ける図形をクリックしてください");
    updateToolbar();
    draw();
  }

  function handleLeaderAnnotationTargetClick(hit, pointer) {
    if (pendingCommand?.type !== "annotation-leader-select") return false;
    const target = annotationLeaderTargetFromHit(hit, pointer);
    if (!target) {
      setHint("引出線を付ける図形をクリックしてください", "error");
      return true;
    }
    setGeometrySelection(hit, false);
    startLeaderAnnotationPlacement(target, pointer);
    return true;
  }

  function annotationLeaderTargetFromSelection(pointer = null) {
    const items = selectedGeometryItems();
    if (items.length !== 1) return null;
    return annotationLeaderTargetFromItem(items[0], pointer);
  }

  function annotationLeaderTargetFromHit(hit, pointer = null) {
    if (!hit?.item) return null;
    return annotationLeaderTargetFromItem(hit.item, pointer);
  }

  function annotationLeaderTargetFromItem(item, pointer = null) {
    if (!item || elementSketchId(item) !== activeSketchId()) return null;
    if (item instanceof Point) return { item, anchor: { x: item.x, y: item.y }, geometryRef: geometryRefForItem(item) };
    if (item instanceof Line) {
      const anchor = pointer ? projectPointToSegmentPoint(pointer, item) : { x: (item.p1.x + item.p2.x) / 2, y: (item.p1.y + item.p2.y) / 2 };
      return { item, anchor, geometryRef: geometryRefForItem(item) };
    }
    if (item instanceof Circle) {
      const base = pointer || { x: item.center.x + item.radius(), y: item.center.y };
      const angle = Math.atan2(base.y - item.center.y, base.x - item.center.x);
      return { item, anchor: { x: item.center.x + Math.cos(angle) * item.radius(), y: item.center.y + Math.sin(angle) * item.radius() }, geometryRef: geometryRefForItem(item) };
    }
    if (item instanceof Arc) {
      const base = pointer || arcEndpointPoint(item, "start");
      const angle = clampAngleToArcSweep(item, Math.atan2(base.y - item.center.y, base.x - item.center.x));
      return { item, anchor: { x: item.center.x + Math.cos(angle) * item.radius(), y: item.center.y + Math.sin(angle) * item.radius() }, geometryRef: geometryRefForItem(item) };
    }
    if (item instanceof Spline) {
      const base = pointer || window.SplineGeometry.evaluate(item.curve(), 0.5);
      const closest = base ? window.SplineGeometry.closestPoint(item.curve(), base, { samplesPerSpan: 28 }) : null;
      const anchor = closest?.point || window.SplineGeometry.evaluate(item.curve(), 0.5);
      return anchor ? { item, anchor, geometryRef: geometryRefForItem(item) } : null;
    }
    return null;
  }

  function annotationLeaderAnchor(element) {
    const item = resolveGeometryRef(element?.geometryRef);
    if (!item) return element?.start || null;
    return annotationLeaderTargetFromItem(item, element.start || null)?.anchor || element.start || null;
  }

  function clampAngleToArcSweep(arc, angle) {
    if (angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return angle;
    const start = arcEndpointPoint(arc, "start");
    const end = arcEndpointPoint(arc, "end");
    const point = {
      x: arc.center.x + Math.cos(angle) * arc.radius(),
      y: arc.center.y + Math.sin(angle) * arc.radius(),
    };
    return hypot2(point.x - start.x, point.y - start.y) <= hypot2(point.x - end.x, point.y - end.y) ? arc.startAngle : arc.endAngle;
  }

  function startLeaderAnnotationPlacement(target, pointer = null) {
    pendingCommand = {
      type: "annotation-leader-place",
      leaderTarget: target,
      pointer: pointer || {
        x: target.anchor.x + 90 / viewport.scale,
        y: target.anchor.y - 36 / viewport.scale,
      },
    };
    setHint("引出線の文字位置をクリックしてください");
    updateToolbar();
    draw();
  }

  function annotationLeaderLayout(anchor, pointer) {
    const side = pointer.x >= anchor.x ? 1 : -1;
    const minShelf = 64 / viewport.scale;
    const end = { x: pointer.x, y: pointer.y };
    if (Math.abs(end.x - anchor.x) < minShelf) end.x = anchor.x + side * minShelf;
    const elbowX = side > 0 ? Math.min(anchor.x + 42 / viewport.scale, end.x - minShelf) : Math.max(anchor.x - 42 / viewport.scale, end.x + minShelf);
    const elbow = { x: elbowX, y: end.y };
    const text = {
      x: (elbow.x + end.x) / 2,
      y: end.y - 10 / viewport.scale,
    };
    return { start: anchor, elbow, end, text };
  }

  function commitLeaderAnnotationAt(pointer) {
    if (pendingCommand?.type !== "annotation-leader-place" || !pendingCommand.leaderTarget) return;
    const target = pendingCommand.leaderTarget;
    const layout = annotationLeaderLayout(target.anchor, pointer);
    const text = window.prompt("引出線テキスト", "注記");
    if (!text) {
      setHint("引出線をキャンセルしました");
      pendingCommand = null;
      updateToolbar();
      draw();
      return;
    }
    pushAnnotation({
      type: "leader",
      text,
      start: layout.start,
      elbow: layout.elbow,
      end: layout.end,
      x: layout.text.x,
      y: layout.text.y,
      geometryRef: target.geometryRef,
      style: { ...DEFAULT_ANNOTATION_STYLE },
    });
    pendingCommand = null;
    setHint("引出線を追加しました");
    updateToolbar();
    recordHistory("引出線追加");
  }

  function drawLeaderAnnotationCommandPreview() {
    if (pendingCommand?.type !== "annotation-leader-place" || !pendingCommand.leaderTarget) return;
    const layout = annotationLeaderLayout(pendingCommand.leaderTarget.anchor, pendingCommand.pointer);
    drawAnnotationLeader({
      start: layout.start,
      elbow: layout.elbow,
      end: layout.end,
      x: layout.text.x,
      y: layout.text.y,
      text: "注記",
      style: { ...DEFAULT_ANNOTATION_STYLE, color: "#2563eb" },
    }, true);
  }

  function createTextAnnotation() {
    if (rejectRootSketchCreation()) return;
    cancelPendingCommand("");
    pendingCommand = { type: "annotation-text-place", pointer: lastPointerWorld || { x: 0, y: 0 } };
    setHint("テキストを配置する位置をクリックしてください");
    updateToolbar();
    draw();
  }

  function commitTextAnnotationAt(pointer) {
    if (pendingCommand?.type !== "annotation-text-place") return false;
    const text = window.prompt("テキスト", "注記");
    if (text) {
      pushAnnotation({ type: "text", text, x: pointer.x, y: pointer.y, style: { ...DEFAULT_ANNOTATION_STYLE } });
      recordHistory("テキスト追加");
      setHint("テキストを追加しました");
    } else {
      setHint("テキストをキャンセルしました");
    }
    pendingCommand = null;
    updateToolbar();
    draw();
    return true;
  }

  function canCreateInActiveSketch() {
    return isGeometryMode() && isDrawableSketch(activeSketchId());
  }

  function rejectRootSketchCreation() {
    if (canCreateInActiveSketch()) return false;
    setHint("Root Sketchには図形を作成できません。子スケッチを選択してください。", "error");
    clearSnap();
    pointerPreview = null;
    draw();
    return true;
  }

  function parentSketchOf(sketch) {
    ensureSketchState();
    return window.SketchHierarchy.parentSketchOf(model.sketches, sketch);
  }

  function constraintIsOperational(constraint) {
    return constraint?.enabled !== false && !invalidReferenceConstraints.has(constraint);
  }

  function referenceSketchTargets(sketchId) {
    return [...new Set(model.constraints
      .filter((constraint) => constraintIsOperational(constraint) && constraint.reference && constraintSketchId(constraint) === sketchId && constraint.referenceSketchId)
      .map((constraint) => constraint.referenceSketchId))];
  }

  function referencePathExists(fromSketchId, toSketchId) {
    const pending = [fromSketchId];
    const visited = new Set();
    while (pending.length > 0) {
      const current = pending.pop();
      if (current === toSketchId) return true;
      if (!current || visited.has(current)) continue;
      visited.add(current);
      pending.push(...referenceSketchTargets(current));
    }
    return false;
  }

  function wouldCreateReferenceCycle(subjectSketchId, referenceSketchId) {
    return subjectSketchId === referenceSketchId || referencePathExists(referenceSketchId, subjectSketchId);
  }

  function refreshReferenceConstraintValidity() {
    const invalid = new Map();
    const acceptedTargets = new Map();
    const targetsOf = (sketchId) => acceptedTargets.get(sketchId) || [];
    const pathExists = (fromSketchId, toSketchId) => {
      const pending = [fromSketchId];
      const visited = new Set();
      while (pending.length > 0) {
        const current = pending.pop();
        if (current === toSketchId) return true;
        if (!current || visited.has(current)) continue;
        visited.add(current);
        pending.push(...targetsOf(current));
      }
      return false;
    };
    for (const constraint of model.constraints) {
      if (constraint.enabled === false || !constraint.reference || !constraint.referenceSketchId) continue;
      const ownerSketchId = constraintSketchId(constraint);
      const referenceSketchId = constraint.referenceSketchId;
      if (!isReferenceSourceSketchId(referenceSketchId, ownerSketchId)) {
        invalid.set(constraint, "参照範囲外");
        continue;
      }
      if (ownerSketchId === referenceSketchId || pathExists(referenceSketchId, ownerSketchId)) {
        invalid.set(constraint, "循環参照");
        continue;
      }
      if (!acceptedTargets.has(ownerSketchId)) acceptedTargets.set(ownerSketchId, []);
      acceptedTargets.get(ownerSketchId).push(referenceSketchId);
    }
    invalidReferenceConstraints = invalid;
    return invalid;
  }

  function sketchDepth(sketch) {
    ensureSketchState();
    return window.SketchHierarchy.sketchDepth(model.sketches, sketch);
  }

  function isVisibleSketchId(sketchId) {
    const id = sketchId || activeSketchId();
    if (viewState.constraintStatus) return true;
    const sketch = sketchById(id);
    if (!sketch) return false;
    const appearance = effectiveAppearanceForSketch(sketch);
    return appearance.visible !== false;
  }

  function isVisibleSketchElement(item) {
    return viewState.constraintStatus || (isVisibleSketchId(elementSketchId(item)) && effectiveAppearanceForElement(item).visible !== false);
  }

  function assignConstraintSketchId(constraint, sketchId = activeSketchId()) {
    const targetSketchId = isDrawableSketch(sketchId) ? sketchId : firstDrawableSketchId();
    if (constraint) constraint.sketchId = targetSketchId || activeSketchId();
    return constraint;
  }

  function pushModelConstraint(constraint, sketchId = activeSketchId()) {
    assignConstraintSketchId(constraint, sketchId);
    model.constraints.push(constraint);
    ensureDimensionParameter(constraint, currentParameterNamespace());
    return constraint;
  }

  function operandElement(operand) {
    if (!operand) return null;
    if (operand.kind === "point") return operand.point;
    if (operand.kind === "line") return operand.line;
    if (operand.kind === "primitive") return operand.primitive;
    if (operand.kind === "spline") return operand.spline;
    if (operand.kind === "arc-endpoint") return operand.arc;
    return operand.element || null;
  }

  function operandRelationForSketch(sketchId) {
    if (isEditableSketchId(sketchId)) return "active";
    if (descendantSketchIds(activeSketchId()).includes(sketchId)) return "descendant";
    if (isReferenceSourceSketchId(sketchId)) return "reference";
    return null;
  }

  function makeConstraintOperand(kind, data) {
    const element = data.element || data.point || data.line || data.primitive || data.spline || data.arc || null;
    const sketchId = data.sketchId || elementSketchId(element);
    const relation = operandRelationForSketch(sketchId);
    if (!element || !sketchId || !relation) return null;
    return { kind, ...data, element, sketchId, relation };
  }

  function operandFromReferenceTarget(target) {
    if (!target) return null;
    if (target.kind === "point") return makeConstraintOperand("point", { point: target.point, sketchId: target.sketchId });
    if (target.kind === "line") return makeConstraintOperand("line", { line: target.line, sketchId: target.sketchId });
    if (target.kind === "primitive") return makeConstraintOperand("primitive", { primitive: target.primitive, sketchId: target.sketchId });
    if (target.kind === "spline") return makeConstraintOperand("spline", { spline: target.spline, parameter: target.parameter, endpoint: target.endpoint, sketchId: target.sketchId });
    return null;
  }

  function referenceTargetFromOperand(operand) {
    if (!operand) return null;
    if (operand.kind === "point") return { kind: "point", point: operand.point, sketchId: operand.sketchId };
    if (operand.kind === "line") return { kind: "line", line: operand.line, sketchId: operand.sketchId };
    if (operand.kind === "primitive") return { kind: "primitive", primitive: operand.primitive, sketchId: operand.sketchId };
    if (operand.kind === "spline") return { kind: "spline", spline: operand.spline, parameter: operand.parameter, endpoint: operand.endpoint, sketchId: operand.sketchId };
    return null;
  }

  function subjectFromOperand(operand) {
    if (!operand) return null;
    if (operand.kind === "point") return { kind: "point", point: operand.point };
    if (operand.kind === "line") return { kind: "line", line: operand.line };
    if (operand.kind === "primitive") return { kind: "primitive", primitive: operand.primitive };
    if (operand.kind === "spline") return { kind: "spline", spline: operand.spline, parameter: operand.parameter, endpoint: operand.endpoint };
    if (operand.kind === "arc-endpoint") return { kind: "arc-endpoint", arc: operand.arc, endpoint: operand.endpoint };
    return null;
  }

  function sameConstraintOperand(a, b) {
    if (!a || !b || a.kind !== b.kind) return false;
    if (a.kind === "arc-endpoint") return sameArcEndpoint(a, b);
    return operandElement(a) === operandElement(b);
  }

  function isConstraintOperandSelected(item, options = {}) {
    if (!item) return false;
    if (mode === "instance-sources" && instanceSourceCommand.includesRef(geometryRefForItem(item))) return true;
    if (mode === "sketch-projection" && sketchProjectionSources.some((entry) => entry.item === item)) return true;
    if (options.arcEndpoint) {
      return constraintOperands.some((operand) => operand.kind === "arc-endpoint" && sameArcEndpoint(operand, options.arcEndpoint));
    }
    return constraintOperands.some((operand) => operandElement(operand) === item);
  }

  function syncSelectionFromConstraintOperands() {
    const targets = constraintTargetsFromOperands(constraintOperands);
    canvasSelection.set("points", targets.points);
    canvasSelection.set("lines", targets.lines);
    canvasSelection.set("circles", targets.circles);
    canvasSelection.set("arcs", targets.arcs);
    canvasSelection.set("splines", targets.splines);
    canvasSelection.set("arcEndpointPair", targets.arcEndpointPair);
    canvasSelection.set("arcEndpoint", targets.arcEndpoint);
    canvasSelection.set("blockInstances", []);
    canvasSelection.set("geometryInstances", []);
    canvasSelection.set("instanceGeometry", null);
  }

  function constraintOperandsFromSelection() {
    const operands = [];
    for (const p of canvasSelection.points) operands.push(makeConstraintOperand("point", { point: p }));
    for (const l of canvasSelection.lines) operands.push(makeConstraintOperand("line", { line: l }));
    for (const c of canvasSelection.circles) operands.push(makeConstraintOperand("primitive", { primitive: c }));
    for (const a of canvasSelection.arcs) {
      if (canvasSelection.arcEndpoint?.arc === a) continue;
      operands.push(makeConstraintOperand("primitive", { primitive: a }));
    }
    if (canvasSelection.arcEndpoint) operands.push(makeConstraintOperand("arc-endpoint", { arc: canvasSelection.arcEndpoint.arc, endpoint: canvasSelection.arcEndpoint.endpoint }));
    for (const spline of canvasSelection.splines) {
      const closest = window.SplineGeometry.closestPoint(spline.curve(), lastPointerWorld || spline.startPoint() || { x: 0, y: 0 }, { samplesPerSpan: 28 });
      const parameter = closest?.t ?? 0;
      operands.push(makeConstraintOperand("spline", { spline, parameter, endpoint: parameter <= 0.5 ? "start" : "end" }));
    }
    return operands.filter(Boolean);
  }

  function referenceSubjectElement(subject) {
    if (!subject) return null;
    if (subject.kind === "point") return subject.point;
    if (subject.kind === "line") return subject.line;
    if (subject.kind === "primitive") return subject.primitive;
    if (subject.kind === "spline") return subject.spline;
    if (subject.kind === "arc-endpoint") return subject.arc;
    return null;
  }

  function referenceSubjectSketchId(subject) {
    return elementSketchId(referenceSubjectElement(subject));
  }

  function resultIsAccepted(result) {
    return Boolean(result) && Number.isFinite(result.errorNorm) && result.errorNorm <= CONSTRAINT_ACCEPT_ERROR;
  }

  function constraintsForRedundancy(sketchId) {
    return model.constraints.filter((constraint) => constraintIsOperational(constraint) && constraintSketchId(constraint) === sketchId);
  }

  function shouldRetainConnectedLineArcTangency(constraint, constraints) {
    // Endpoint tangency can have zero first-order rank while still preserving the nonlinear shape.
    if (!(constraint instanceof LineCircleTangentConstraint) || !(constraint.primitive instanceof Arc)) return false;
    const firstEquivalent = constraints.find((item) =>
      item instanceof LineCircleTangentConstraint &&
      item.line === constraint.line &&
      item.primitive === constraint.primitive &&
      item.sign === constraint.sign);
    if (firstEquivalent !== constraint) return false;
    return constraints.some((item) =>
      item instanceof ArcEndpointCoincidentConstraint &&
      item.arc === constraint.primitive &&
      (item.point === constraint.line.p1 || item.point === constraint.line.p2));
  }

  function redundantConstraintInfo(constraint, sketchId = constraintSketchId(constraint)) {
    if (!constraint || constraint.enabled === false) return { redundant: false };
    const constraints = constraintsForRedundancy(sketchId);
    if (!constraints.includes(constraint)) return { redundant: false };
    const redundancy = solver.constraintRedundancyState({
      variables: sketchSolveVariables(sketchId),
      constraints,
      errorTolerance: CONSTRAINT_ACCEPT_ERROR,
      rankTolerance: 1e-8,
    });
    const contribution = redundancy.byConstraint.get(constraint);
    if (!redundancy.stable || !contribution) return { redundant: false, unstable: true, redundancy };
    return {
      redundant: contribution.redundant && !shouldRetainConnectedLineArcTangency(constraint, constraints),
      rankBefore: contribution.rankBefore,
      rankAfter: contribution.rankAfter,
      redundancy,
    };
  }

  function refreshConstraintRedundancy(precomputedBySketch = null) {
    const byConstraint = new Map();
    const bySketch = new Map();
    let count = 0;
    for (const sketch of model.sketches.filter((item) => !isRootSketch(item))) {
      const sketchId = sketch.id;
      const constraints = constraintsForRedundancy(sketchId);
      const redundancy = precomputedBySketch?.get(sketchId) || solver.constraintRedundancyState({
          variables: sketchSolveVariables(sketchId),
          constraints,
          errorTolerance: CONSTRAINT_ACCEPT_ERROR,
          rankTolerance: 1e-8,
        });
      let sketchCount = 0;
      for (const constraint of constraints) {
        const contribution = redundancy.byConstraint.get(constraint);
        if (!redundancy.stable || !contribution?.redundant || shouldRetainConnectedLineArcTangency(constraint, constraints)) continue;
        const info = { redundant: true, sketchId, rankBefore: contribution.rankBefore, rankAfter: contribution.rankAfter };
        byConstraint.set(constraint, info);
        sketchCount += 1;
        count += 1;
      }
      if (sketchCount > 0) bySketch.set(sketchId, sketchCount);
    }
    constraintRedundancyState = { constraints: byConstraint, sketches: bySketch, count };
    return constraintRedundancyState;
  }

  function constraintRedundancyInfo(constraint) {
    return constraintRedundancyState?.constraints?.get(constraint) || null;
  }

  function constraintIsRedundant(constraint) {
    return Boolean(constraintRedundancyInfo(constraint)?.redundant);
  }

  function constraintDuplicateCountForSketch(sketchId) {
    return constraintRedundancyState?.sketches?.get(sketchId) || 0;
  }

  function constraintDuplicateSummary() {
    const count = constraintRedundancyState?.count || 0;
    return count > 0 ? applicationSettings.language === "en" ? ` / Duplicate constraints: ${count}` : ` / 重複拘束: ${count}` : "";
  }

  function referenceConstraintErrorInfo(constraint) {
    return invalidReferenceConstraints.get(constraint) || null;
  }

  function referenceConstraintErrorCountForSketch(sketchId) {
    let count = 0;
    for (const constraint of invalidReferenceConstraints.keys()) {
      if (constraintSketchId(constraint) === sketchId) count += 1;
    }
    return count;
  }

  function referenceConstraintErrorSummary() {
    const count = invalidReferenceConstraints.size;
    return count > 0 ? applicationSettings.language === "en" ? ` / Reference errors: ${count}` : ` / 参照エラー: ${count}` : "";
  }

  function clearSketchSolveState(sketchId) {
    sketchSolveStates.delete(sketchId);
  }

  function setSketchSolveOk(sketchId, result, sourceSketchId = sketchId) {
    sketchSolveStates.set(sketchId, { status: "ok", sourceSketchId, result });
  }

  function setSketchSolveError(sketchId, result, sourceSketchId = sketchId) {
    sketchSolveStates.set(sketchId, {
      status: "error",
      sourceSketchId,
      errorNorm: Number.isFinite(result?.errorNorm) ? result.errorNorm : Infinity,
      reason: result?.reason || "solve failed",
      result,
    });
  }

  function sketchSolveState(sketchId) {
    return sketchSolveStates.get(sketchId) || null;
  }

  function sketchHasSolveError(sketchId) {
    return sketchSolveState(sketchId)?.status === "error";
  }

  function sketchSolveErrorTitle(sketchId) {
    const state = sketchSolveState(sketchId);
    if (state?.status !== "error") return "";
    const errorText = Number.isFinite(state.errorNorm) ? state.errorNorm.toExponential(3) : "unknown";
    return `子スケッチ破綻: error=${errorText}, reason=${state.reason}`;
  }

  function dependentErrorSummary(dependent) {
    const failures = dependent?.results?.filter((entry) => entry.status === "error") || [];
    if (failures.length === 0) return "";
    const first = failures[0];
    return ` / 参照スケッチ破綻: ${sketchName(first.sketchId)} (error=${first.result.errorNorm.toExponential(3)})`;
  }

  function solveAndRefresh(label = "自動solve") {
    const solved = stabilizeActiveParameterNamespace(activeSketchId());
    const result = solved.result;
    const analysis = refreshConstraintAnalysis();
    setSolveResultHint(label, solved, analysis, solved.dependent);
    updateUI({ refreshAnalysis: false });
    draw();
    if (solved.success && !historyRestoring) recordHistory(label);
    return result;
  }

  function referenceValuesConverged(previous, next) {
    if (previous.size !== next.size) return false;
    for (const [name, value] of next) {
      const before = previous.get(name);
      if (!Number.isFinite(before)) return false;
      const tolerance = PARAMETER_STABILIZATION_RELATIVE_TOLERANCE * Math.max(1, Math.abs(value));
      if (Math.abs(value - before) > tolerance) return false;
    }

    return true;
  }

  function parameterFailureResult(reason) {
    return { success: false, errorNorm: Infinity, iterations: 0, reason };
  }

  function stabilizeActiveParameterNamespace(sketchId = activeSketchId(), options = {}) {
    if (!interactionProfiler.active) return stabilizeActiveParameterNamespaceUnprofiled(sketchId, options);
    return profileInteractionWork("parameters", () => stabilizeActiveParameterNamespaceUnprofiled(sketchId, options));
  }

  function solveParameterTargetTransition(sketchId, requestedSketchIds, variableAllowed, previousTargets) {
    const solvePass = () => {
      let solved = null;
      const dependentResults = [];
      for (const requestedSketchId of [...new Set(requestedSketchIds)]) {
        const item = solveSketchAndDependents(requestedSketchId, null, variableAllowed);
        solved ||= item;
        dependentResults.push(...(item.dependent?.results || []));
        if (!item.success || item.dependent?.success === false) return item;
      }
      solved ||= { success: true, sketchId, result: { success: true, errorNorm: 0, iterations: 0 } };
      solved.dependent = { success: true, results: dependentResults };
      return solved;
    };
    const changes = [...previousTargets]
      .filter(([constraint, value]) => constraint.enabled !== false && Number.isFinite(value) && value > 0 && constraint.target !== value)
      .map(([constraint, value]) => ({ constraint, start: value, end: constraint.target }));
    if (!changes.length) return solvePass();

    // Follow the existing solution branch before attempting a large target
    // change. All dependent targets share the same interpolation progress;
    // intermediate steps are internal to the caller's single transaction.
    let progress = 0;
    let solved;
    try {
      for (let step = 0; progress < 1 && step < 128; step++) {
        let increment = 1 - progress;
        for (const change of changes) {
          const current = change.start + (change.end - change.start) * progress;
          increment = Math.min(increment, 0.2 * current / Math.abs(change.end - change.start));
        }
        const state = snapshotModelState();
        let accepted = false;
        for (let retry = 0; retry < 12; retry++) {
          const nextProgress = Math.min(1, progress + increment);
          for (const change of changes) change.constraint.target = nextProgress === 1 ? change.end : change.start + (change.end - change.start) * nextProgress;
          solved = solvePass();
          if (solved.success && solved.dependent?.success !== false) {
            progress = nextProgress;
            accepted = true;
            break;
          }
          restoreModelState(state);
          increment *= 0.5;
        }
        if (!accepted) return solved;
      }
      if (progress === 1) return solved;
      return { success: false, sketchId, result: parameterFailureResult(applicationText("Parameter計算が収束しません", "Parameter calculation did not converge")), dependent: { success: true, results: [] } };
    } finally {
      for (const change of changes) change.constraint.target = change.end;
    }
  }

  function stabilizeActiveParameterNamespaceUnprofiled(sketchId = activeSketchId(), options = {}) {
    let previous;
    try {
      ensureParameterNamespace(currentParameterNamespace());
      previous = referenceDimensionValues(currentParameterNamespace());
    } catch (error) {
      const result = parameterFailureResult(parameterErrorText(error));
      return { success: false, sketchId, result, dependent: { success: true, results: [] }, parameterError: error };
    }
    const hasReferences = previous.size > 0;
    for (let pass = 0; pass < PARAMETER_STABILIZATION_MAX_PASSES; pass += 1) {
      const previousTargets = new Map(dimensionConstraintsInNamespace(currentParameterNamespace())
        .filter((constraint) => !isReadOnlyDimension(constraint))
        .map((constraint) => [constraint, constraint.target]));
      try {
        evaluateParameterNamespace(currentParameterNamespace(), { referenceValues: previous });
      } catch (error) {
        const result = parameterFailureResult(parameterErrorText(error));
        return { success: false, sketchId, result, dependent: { success: true, results: [] }, parameterError: error };
      }
      const requestedSketchIds = Array.isArray(options.allSketches) && options.allSketches.length > 0 ? options.allSketches : [sketchId];
      const solved = solveParameterTargetTransition(sketchId, requestedSketchIds, options.variableAllowed, previousTargets);
      if (!solved.success || solved.dependent?.success === false) return solved;
      let next;
      try {
        next = referenceDimensionValues(currentParameterNamespace());
      } catch (error) {
        const result = parameterFailureResult(parameterErrorText(error));
        return { success: false, sketchId, result, dependent: solved.dependent, parameterError: error };
      }
      if (!hasReferences || referenceValuesConverged(previous, next)) {
        evaluateParameterNamespace(currentParameterNamespace(), { referenceValues: next });
        solved.parameterPasses = pass + 1;
        return solved;
      }
      previous = next;
    }
    const result = parameterFailureResult(applicationText("Parameter計算が収束しません", "Parameter calculation did not converge"));
    return { success: false, sketchId, result, dependent: { success: true, results: [] }, parameterNonConvergent: true };
  }

  function geometryErrorNorm() {
    return vectorNorm(solver.computeErrorVector());
  }

  function pointHasConstraintFreedom(point, analysis) {
    if (point.fixed) return false;
    const freedom = analysis.variableFreedom.get(point);
    return Boolean(freedom?.x || freedom?.y);
  }

  function objectHasConstraintFreedom(object, prop, analysis) {
    return Boolean(analysis.variableFreedom.get(object)?.[prop]);
  }

  function variableDeltaInBasis(object, prop, basis, analysis) {
    const index = analysis.variableIndex?.get(object)?.[prop];
    return index >= 0 ? basis[index] || 0 : 0;
  }

  function lineSupportHasConstraintFreedom(line, analysis) {
    const normal = analysis.lineNormals?.get(line) || lineSupportNormal(line);
    for (const basis of analysis.nullspaceBasis || []) {
      const norm = Math.max(1, Math.sqrt(basis.reduce((sum, value) => sum + value * value, 0)));
      const p1Normal = normal.x * variableDeltaInBasis(line.p1, "x", basis, analysis) + normal.y * variableDeltaInBasis(line.p1, "y", basis, analysis);
      const p2Normal = normal.x * variableDeltaInBasis(line.p2, "x", basis, analysis) + normal.y * variableDeltaInBasis(line.p2, "y", basis, analysis);
      if (Math.abs(p1Normal) > 1e-7 * norm || Math.abs(p2Normal) > 1e-7 * norm) return true;
    }
    return false;
  }

  function classifyConstraintStatus(item, kind, analysis) {
    if (!analysis.stable) return "conflict";
    if (kind === "point") return pointHasConstraintFreedom(item, analysis) ? "under" : "full";
    if (kind === "line") {
      const hasEndpointFreedom = pointHasConstraintFreedom(item.p1, analysis) || pointHasConstraintFreedom(item.p2, analysis);
      if (!hasEndpointFreedom) return "full";
      return lineSupportHasConstraintFreedom(item, analysis) ? "under" : "support";
    }
    if (kind === "circle") return pointHasConstraintFreedom(item.center, analysis) || objectHasConstraintFreedom(item, "radiusValue", analysis) ? "under" : "full";
    if (kind === "arc") {
      const supportFreedom = pointHasConstraintFreedom(item.center, analysis) || objectHasConstraintFreedom(item, "radiusValue", analysis);
      const endpointFreedom = objectHasConstraintFreedom(item, "startAngle", analysis) || objectHasConstraintFreedom(item, "endAngle", analysis);
      if (!supportFreedom && !endpointFreedom) return "full";
      return !supportFreedom && endpointFreedom ? "support" : "under";
    }
    if (kind === "spline") return item.fitPoints.some((point) => pointHasConstraintFreedom(point, analysis)) ? "under" : "full";
    return "full";
  }

  function classifyBlockProjectionStatus(item, analysis) {
    if (!analysis.stable) return "conflict";
    const instance = item?.blockInstance;
    if (!instance || instance.fixed) return "full";
    const freedom = analysis.variableFreedom.get(instance) || {};
    const translationFree = Boolean(freedom.x || freedom.y);
    const rotationFree = Boolean(freedom.rotation);
    if (item instanceof Arc) {
      if (translationFree) return "under";
      return rotationFree ? "support" : "full";
    }
    if (item instanceof Circle || item instanceof Point) return translationFree ? "under" : "full";
    if (item instanceof Line) {
      if (!translationFree && !rotationFree) return "full";
      const length = Math.max(item.length(), MIN_LINE_LENGTH);
      const direction = { x: item.dx() / length, y: item.dy() / length };
      for (const basis of analysis.nullspaceBasis || []) {
        const norm = Math.max(1, Math.sqrt(basis.reduce((sum, value) => sum + value * value, 0)));
        const dx = variableDeltaInBasis(instance, "x", basis, analysis);
        const dy = variableDeltaInBasis(instance, "y", basis, analysis);
        const dr = variableDeltaInBasis(instance, "rotation", basis, analysis);
        const normalMotion = -direction.y * dx + direction.x * dy;
        if (Math.abs(normalMotion) > 1e-7 * norm || Math.abs(dr) > 1e-7 * norm) return "under";
      }
      return "support";
    }
    return translationFree || rotationFree ? "under" : "full";
  }

  function refreshConstraintAnalysis(options = {}) {
    if (!interactionProfiler.active) return refreshConstraintAnalysisUnprofiled(options);
    return profileInteractionWork("analysis", () => refreshConstraintAnalysisUnprofiled(options));
  }

  function refreshConstraintAnalysisUnprofiled(options = {}) {
    refreshReferenceConstraintValidity();
    const rootSketchId = activeSketchId();
    const sketchIdSet = new Set([rootSketchId, ...descendantSketchIds(rootSketchId)]);
    const derivedBundles = geometryInstanceBundles().filter((bundle) => bundle.valid);
    let sourceSketchAdded = true;
    while (sourceSketchAdded) {
      sourceSketchAdded = false;
      for (const bundle of derivedBundles) {
        if (!sketchIdSet.has(bundle.instance.sketchId)) continue;
        const outputs = [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...bundle.splines];
        for (const source of outputs.map((item) => item.sourceElement).filter(Boolean)) {
          const sourceSketchId = elementSketchId(source);
          if (!sourceSketchId || sketchIdSet.has(sourceSketchId)) continue;
          sketchIdSet.add(sourceSketchId);
          sourceSketchAdded = true;
        }
      }
    }
    const sketchIds = [...sketchIdSet];
    const analyses = new Map();
    const statuses = new Map();
    const items = [];
    for (const sketchId of sketchIds) {
      const analysis = solver.analyzeConstraintState({
        variables: sketchSolveVariables(sketchId),
        constraints: sketchSolveConstraints(sketchId),
        lines: sketchSolveLines(sketchId),
        errorTolerance: CONSTRAINT_ACCEPT_ERROR,
      });
      const forceConflict = sketchHasSolveError(sketchId);
      analyses.set(sketchId, analysis);
      for (const p of model.points) {
        if (elementSketchId(p) !== sketchId) continue;
        const status = forceConflict ? "conflict" : classifyConstraintStatus(p, "point", analysis);
        statuses.set(p, status);
        if (isEditableSketchElement(p) && isExplicitPoint(p)) items.push(status);
      }
      for (const l of model.lines) {
        if (elementSketchId(l) !== sketchId) continue;
        const status = forceConflict ? "conflict" : classifyConstraintStatus(l, "line", analysis);
        statuses.set(l, status);
        if (isEditableSketchElement(l)) items.push(status);
      }
      for (const c of model.circles) {
        if (elementSketchId(c) !== sketchId) continue;
        const status = forceConflict ? "conflict" : classifyConstraintStatus(c, "circle", analysis);
        statuses.set(c, status);
        if (isEditableSketchElement(c)) items.push(status);
      }
      for (const a of model.arcs) {
        if (elementSketchId(a) !== sketchId) continue;
        const status = forceConflict ? "conflict" : classifyConstraintStatus(a, "arc", analysis);
        statuses.set(a, status);
        if (isEditableSketchElement(a)) items.push(status);
      }
      for (const spline of model.splines) {
        if (elementSketchId(spline) !== sketchId) continue;
        const status = forceConflict ? "conflict" : classifyConstraintStatus(spline, "spline", analysis);
        statuses.set(spline, status);
        if (isEditableSketchElement(spline)) items.push(status);
      }
      for (const bundle of blockProjectionBundles()) {
        if (bundle.instance.sketchId !== sketchId) continue;
        for (const item of [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])]) {
          const status = forceConflict ? "conflict" : classifyBlockProjectionStatus(item, analysis);
          statuses.set(item, status);
          if (isEditableSketchElement(item) && !(item instanceof Point)) items.push(status);
        }
      }
    }
    const summary = {
      full: items.filter((status) => status === "full").length,
      support: items.filter((status) => status === "support").length,
      under: items.filter((status) => status === "under").length,
      conflict: items.filter((status) => status === "conflict").length,
      total: items.length,
    };
    constraintAnalysisState = { analysis: analyses.get(rootSketchId), analyses, statuses, summary };
    refreshConstraintRedundancy(options.redundancyBySketch || null);
    return constraintAnalysisState;
  }

  function constraintStatusOf(item) {
    if (item?.derivedInstance?.type === "sketchProjection") return "full";
    if (!constraintAnalysisState) refreshConstraintAnalysis();
    let current = item;
    const visited = new Set();
    let hasFreePlacement = false;
    while (current?.derivedProjection && current.sourceElement && !visited.has(current)) {
      visited.add(current);
      if (current.derivedInstance?.type === "free") hasFreePlacement = true;
      current = current.sourceElement;
    }
    if (hasFreePlacement) {
      if (!constraintAnalysisState.statuses.has(item)) {
        constraintAnalysisState.statuses.set(item, classifyFreeInstanceGeometry(item, constraintAnalysisState.analyses.get(elementSketchId(item))));
      }
      return constraintAnalysisState.statuses.get(item);
    }
    return constraintAnalysisState?.statuses.get(current) || "full";
  }

  function classifyFreeInstanceGeometry(item, analysis) {
    if (!analysis?.stable) return "conflict";
    const sample = () => {
      const values = geometryInstanceSourcePoints(item).flatMap((p) => [p.x, p.y]);
      if (item instanceof Circle || item instanceof Arc) values.push(item.radius());
      if (item instanceof Arc) values.push(item.startPoint().x, item.startPoint().y, item.endPoint().x, item.endPoint().y);
      return values;
    };
    const baseline = sample();
    const derivatives = analysis.variables.map((v) => {
      const old = v.object[v.prop];
      const step = 1e-6 * Math.max(1, Math.abs(old));
      try {
        v.object[v.prop] = old + step;
        return sample().map((value, index) => (value - baseline[index]) / step);
      } finally { v.object[v.prop] = old; }
    });
    let hasMotion = false;
    for (const basis of analysis.nullspaceBasis) {
      const motion = baseline.map((_, i) => derivatives.reduce((sum, column, j) => sum + column[i] * basis[j], 0));
      const tolerance = 1e-5 * Math.max(1, vectorNorm(basis));
      if (vectorNorm(motion) <= tolerance) continue;
      hasMotion = true;
      if (!(item instanceof Line)) return "under";
      const length = Math.max(item.length(), MIN_LINE_LENGTH);
      const nx = -item.dy() / length, ny = item.dx() / length;
      if (Math.abs(nx * motion[0] + ny * motion[1]) > tolerance || Math.abs(nx * motion[2] + ny * motion[3]) > tolerance) return "under";
    }
    return hasMotion ? "support" : "full";
  }

  function constraintStatusColor(item, selected = false, hovered = false) {
    if (selected) return "#1d4ed8";
    if (hovered) return "#3b82f6";
    if (sketchHasSolveError(elementSketchId(item))) return SKETCH_SOLVE_ERROR_COLOR;
    const relation = sketchRelationOfElement(item);
    if (relation !== "active") return INACTIVE_CONSTRAINT_STATUS_COLOR;
    const status = constraintStatusOf(item);
    if (status === "conflict") return CONSTRAINT_STATUS_COLORS.conflict;
    return CONSTRAINT_STATUS_COLORS[status] || CONSTRAINT_STATUS_COLORS.full;
  }

  function sketchStrokeWidth(item) {
    const relation = sketchRelationOfElement(item);
    if (relation === "active") return 2;
    if (relation === "reference" || relation === "descendant" || relation === "inactive") return 1.2;
    return 0;
  }

  function canvasColorChannels(value) {
    const match = String(value || "").trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!match) return null;
    const hex = match[1].length === 3 ? [...match[1]].map((part) => part.repeat(2)).join("") : match[1];
    return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  }

  function canvasColorLuminance(channels) {
    const linear = channels.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  }

  function canvasColorContrast(first, second) {
    const light = Math.max(canvasColorLuminance(first), canvasColorLuminance(second));
    const dark = Math.min(canvasColorLuminance(first), canvasColorLuminance(second));
    return (light + 0.05) / (dark + 0.05);
  }

  function canvasThemeColor(value) {
    if (applicationSettings.theme !== "dark") return value;
    const channels = canvasColorChannels(value);
    if (!channels) return value;
    const background = [15, 23, 42];
    if (canvasColorContrast(channels, background) >= 4.5) return value;
    for (let mix = 0.08; mix <= 1.001; mix += 0.08) {
      const adjusted = channels.map((channel) => Math.round(channel + (255 - channel) * Math.min(1, mix)));
      if (canvasColorContrast(adjusted, background) < 4.5) continue;
      return `#${adjusted.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
    }
    return "#ffffff";
  }

  function geometryDisplayColor(item, appearance, selected = false, hovered = false) {
    if (selected) return canvasThemeColor("#1d4ed8");
    if (hovered) return canvasThemeColor("#3b82f6");
    return canvasThemeColor(viewState.constraintStatus ? constraintStatusColor(item) : appearance.color);
  }

  function geometryStrokeWidth(item, { auxiliaryHighlighted = false, selected = false, hovered = false, appearance = null, construction = false } = {}) {
    if (auxiliaryHighlighted || selected) return 3;
    if (hovered) return 2.2;
    if (appearance) return appearance.lineWidth;
    if (construction) return Math.max(0.9, sketchStrokeWidth(item) * 0.55);
    return sketchStrokeWidth(item);
  }

  function isSidebarHighlightedElement(item) {
    if (!hoveredSketchTreeId || !item) return false;
    const itemSketchId = elementSketchId(item);
    return hoveredSketchTreeId === ROOT_SKETCH_ID ? itemSketchId !== ROOT_SKETCH_ID : itemSketchId === hoveredSketchTreeId;
  }




  function isReferenceHoverElement(item) {
    return Boolean(pendingConstraintCommand && item && !isActiveSketchElement(item) && isReferenceSourceSketchId(elementSketchId(item)));
  }

  function isPendingReferenceTarget(item) {
    const target = pendingConstraintCommand?.referenceTarget || pendingCommand?.referenceTarget;
    if (!target || !item) return false;
    if (target.kind === "point") return target.point === item;
    if (target.kind === "line") return target.line === item;
    if (target.kind === "primitive") return target.primitive === item;
    return false;
  }

  function drawOrderBySketch(items) {
    return items.filter(isVisibleSketchElement).sort((a, b) => Number(isEditableSketchElement(a)) - Number(isEditableSketchElement(b)));
  }

  function sketchAlpha(item) {
    const relation = sketchRelationOfElement(item);
    if (relation === "active") return 1;
    if (relation === "reference" || relation === "descendant" || relation === "inactive") return 1;
    return 0;
  }

  function constraintStatusBadge(status) {
    if (status === "conflict") return applicationText("矛盾", "Conflict");
    if (status === "support") return applicationText("支持位置拘束", "Supported position");
    if (status === "under") return applicationText("未拘束", "Under-constrained");
    return applicationText("完全拘束", "Fully constrained");
  }

  function constraintSummaryText() {
    if (!constraintAnalysisState) refreshConstraintAnalysis();
    const s = constraintAnalysisState?.summary || { full: 0, support: 0, under: 0, conflict: 0 };
    return applicationSettings.language === "en"
      ? `Fully constrained: ${s.full} / Supported position: ${s.support} / Under-constrained: ${s.under} / Conflict: ${s.conflict}${constraintDuplicateSummary()}${referenceConstraintErrorSummary()}`
      : `完全拘束: ${s.full} / 支持位置拘束: ${s.support} / 未拘束: ${s.under} / 矛盾: ${s.conflict}${constraintDuplicateSummary()}${referenceConstraintErrorSummary()}`;
  }

  function syncConstraintStatusView({ hint = true } = {}) {
    const next = constraintStatusMouseLatched || constraintStatusSpaceHeld;
    const changed = viewState.constraintStatus !== next;
    viewState.constraintStatus = next;
    const button = document.getElementById("constraintStatusViewBtn");
    button?.classList.toggle("active", next);
    button?.setAttribute("aria-pressed", String(next));
    const menuInput = document.getElementById("viewConstraintStatusInput");
    if (menuInput) menuInput.checked = next;
    if (hint && changed) setHint(next ? "拘束状態表示: Document内の全Geometryを表示しています" : "通常表示");
    if (changed) draw();
  }



  function sketchProjectionSourceKey(item) {
    return geometryElementKey(item);
  }

  function sketchProjectionSourceIsCovered(item, targetSketchId = activeSketchId()) {
    const itemRef = geometryRefForItem(item);
    if (itemRef && model.geometryInstances.some((instance) => instance.type === "sketchProjection" && instance.sketchId === targetSketchId && instance.sources.some((ref) => geometryRefsEqual(ref, itemRef)))) return true;
    if (!item) return false;
    if (item instanceof Point) {
      return sketchProjectionConstraints().some((constraint) =>
        constraintIsOperational(constraint)
        && constraint.kind === "point"
        && constraintSketchId(constraint) === targetSketchId
        && sketchProjectionPointPairs(constraint).some(([source]) => source === item || String(source?.id) === String(item.id)));
    }
    const key = sketchProjectionSourceKey(item);
    return sketchProjectionConstraints().some((constraint) =>
      constraintIsOperational(constraint)
      && constraintSketchId(constraint) === targetSketchId
      && constraint.kind === geometryKindForItem(item)
      && sketchProjectionSourceKey(constraint.source) === key);
  }

  function sketchProjectionEntryFromItem(item) {
    const kind = geometryKindForItem(item);
    const sketchId = elementSketchId(item);
    if (!item || !kind || !isReferenceSourceSketchId(sketchId) || !isVisibleSketchElement(item)) return null;
    return { item, kind, sketchId, key: sketchProjectionSourceKey(item) };
  }

  function sketchProjectionEntryFromOperand(operand) {
    return sketchProjectionEntryFromItem(operandElement(operand));
  }

  function projectedPointForCreation(sourcePoint, targetSketchId) {
    return addPointToSketch(sourcePoint.x, sourcePoint.y, targetSketchId, sourcePoint.kind || "endpoint");
  }

  function createSketchProjectionTarget(entry, targetSketchId) {
    const source = entry.item;
    if (entry.kind === "point") return projectedPointForCreation(source, targetSketchId);
    if (entry.kind === "line") {
      return addLine(
        addPointToSketch(source.p1.x, source.p1.y, targetSketchId, source.p1.kind || "endpoint"),
        addPointToSketch(source.p2.x, source.p2.y, targetSketchId, source.p2.kind || "endpoint"),
        source.construction,
      );
    }
    if (entry.kind === "circle") {
      return addCircle(projectedPointForCreation(source.center, targetSketchId), source.radius(), source.construction);
    }
    if (entry.kind === "arc") {
      return addArc(projectedPointForCreation(source.center, targetSketchId), source.radius(), source.startAngle, source.endAngle, source.construction);
    }
    if (entry.kind === "spline") {
      return addSpline(source.fitPoints.map((point) => projectedPointForCreation(point, targetSketchId)), source.closed, source.construction);
    }
    return null;
  }

  function startSketchProjectionCommand() {
    cancelConstraintTargetCommand("");
    cancelPendingCommand("");
    if (!canCreateInActiveSketch()) return void rejectRootSketchCreation();
    clearSelection();
    mode = "sketch-projection";
    sketchProjectionSources = [];
    clearSnap();
    updateToolbar();
    setHint(applicationText("投影する先祖SketchのGeometryを複数選択し、Enterまたは右クリックメニューの「実行」で確定してください。Escでキャンセルします", "Select geometry from ancestor sketches, then confirm with Enter or Execute in the context menu. Press Esc to cancel."));
    updateUI({ refreshAnalysis: false });
    draw();
  }

  function toggleSketchProjectionSource(operand) {
    const entry = sketchProjectionEntryFromOperand(operand);
    if (!entry) {
      setHint(applicationText("表示中の先祖SketchにあるGeometryを選択してください", "Select visible geometry from an ancestor sketch."), "error");
      return false;
    }
    const selectedIndex = sketchProjectionSources.findIndex((item) => item.kind === entry.kind && item.key === entry.key);
    if (selectedIndex >= 0) {
      sketchProjectionSources.splice(selectedIndex, 1);
    } else {
      if (sketchProjectionSourceIsCovered(entry.item)) {
        setHint(applicationText(`${entry.item.id} は既に投影されています`, `${entry.item.id} is already projected.`), "error");
        return false;
      }
      sketchProjectionSources.push(entry);
    }
    setHint(applicationText(`投影対象: ${sketchProjectionSources.length}件。Enterまたは右クリックメニューの「実行」で確定、Escでキャンセル`, `Projection targets: ${sketchProjectionSources.length}. Confirm with Enter or Execute in the context menu; press Esc to cancel.`));
    draw();
    return true;
  }

  function sketchProjectionEntriesByRect(rect, crossing) {
    const entries = [];
    const append = (item) => {
      const entry = sketchProjectionEntryFromItem(item);
      if (entry) entries.push(entry);
    };
    for (const point of allGeometryPoints()) {
      if (!isExplicitPoint(point) && !isReferencePoint(point)) continue;
      if (pointInRect(point, rect)) append(point);
    }
    for (const line of allGeometryLines()) {
      const selected = crossing ? lineIntersectsRect(line, rect) : bboxInRect(lineBBox(line), rect);
      if (selected) append(line);
    }
    for (const circle of allGeometryCircles()) {
      const box = primitiveBBox(circle);
      const selected = crossing ? bboxIntersectsRect(box, rect) : bboxInRect(box, rect);
      if (selected) append(circle);
    }
    for (const arc of allGeometryArcs()) {
      const samples = arcSamplePoints(arc);
      const selected = crossing ? samples.some((point) => pointInRect(point, rect)) : samples.every((point) => pointInRect(point, rect));
      if (selected) append(arc);
    }
    for (const spline of allGeometrySplines()) {
      const samples = window.SplineGeometry.flatten(spline.curve(), { tolerance: Math.max(0.1, 0.75 / viewport.scale) }).map((entry) => entry.point);
      const selected = crossing ? samples.some((point) => pointInRect(point, rect)) : samples.every((point) => pointInRect(point, rect));
      if (selected) append(spline);
    }
    return entries;
  }

  function addSketchProjectionSourcesByRect(rect, crossing) {
    const stagedKeys = new Set(sketchProjectionSources.map((entry) => `${entry.kind}:${entry.key}`));
    let added = 0;
    for (const entry of sketchProjectionEntriesByRect(rect, crossing)) {
      const key = `${entry.kind}:${entry.key}`;
      if (stagedKeys.has(key) || sketchProjectionSourceIsCovered(entry.item)) continue;
      sketchProjectionSources.push(entry);
      stagedKeys.add(key);
      added += 1;
    }
    setHint(applicationText(
      `範囲選択で${added}件追加しました。投影対象: ${sketchProjectionSources.length}件。Enterまたは右クリックメニューの「実行」で確定、Escでキャンセル`,
      `Added ${added} by area selection. Projection targets: ${sketchProjectionSources.length}. Confirm with Enter or Execute in the context menu; press Esc to cancel.`,
    ));
    draw();
    return added;
  }

  function selectCreatedSketchProjectionTargets(targets) {
    clearSelection();
    canvasSelection.set("points", targets.filter((item) => item instanceof Point));
    canvasSelection.set("lines", targets.filter((item) => item instanceof Line));
    canvasSelection.set("circles", targets.filter((item) => item instanceof Circle));
    canvasSelection.set("arcs", targets.filter((item) => item instanceof Arc));
    canvasSelection.set("splines", targets.filter((item) => item instanceof Spline));
  }

  function commitSketchProjectionCommand() {
    if (mode !== "sketch-projection") return false;
    const entries = sketchProjectionSources.filter((entry) => !sketchProjectionSourceIsCovered(entry.item));
    if (entries.length === 0) {
      setHint(applicationText("投影するGeometryを1つ以上選択してください", "Select at least one geometry to project."), "error");
      return false;
    }
    const targetSketchId = activeSketchId();
    const instance = normalizeGeometryInstance({
      id: `SPI${sketchProjectionInstanceSeq++}`,
      type: "sketchProjection",
      sketchId: targetSketchId,
      sources: entries.map((entry) => geometryRefForItem(entry.item)),
      appearanceOverride: {},
    });
    model.geometryInstances.push(instance);
    mode = "select";
    sketchProjectionSources = [];
    clearSelection();
    canvasSelection.set("geometryInstances", [instance]);
    refreshConstraintAnalysis();
    updateToolbar();
    updateUI({ refreshAnalysis: false });
    draw();
    setHint(applicationText(`${entries.length}件のGeometryを投影インスタンスにしました`, `Created a projection instance from ${entries.length} geometry item(s).`));
    recordHistory("スケッチ投影");
    return true;
  }

  function selectedItemsForGeometryInstance() {
    const items = [...selectedGeometryItems()];
    for (const instance of canvasSelection.blockInstances) {
      const bundle = blockProjectionBundle(instance);
      items.push(...bundle.lines, ...bundle.circles, ...bundle.arcs, ...bundle.splines, ...bundle.points.filter((point) => point.localElement?.kind === "explicit"));
    }
    for (const instance of canvasSelection.geometryInstances) {
      const bundle = geometryInstanceBundle(instance);
      items.push(...bundle.lines, ...bundle.circles, ...bundle.arcs, ...bundle.splines);
      for (const point of bundle.points) if (point.sourceElement instanceof Point && point.sourceElement.kind === "explicit") items.push(point);
    }
    return [...new Set(items)].filter((item) => elementSketchId(item) === activeSketchId() && geometryRefForItem(item));
  }









  function startCenterlineCommand() {
    cancelConstraintTargetCommand("");
    cancelPendingCommand("");
    if (!canCreateInActiveSketch()) return void rejectRootSketchCreation();
    const preselected = canvasSelection.lines.length === 2 && canvasSelection.points.length === 0
      ? canvasSelection.lines.slice()
      : canvasSelection.points.length === 2 && canvasSelection.lines.length === 0
        ? canvasSelection.points.slice()
        : [];
    resetCenterlineCommandState();
    mode = "centerline";
    pointerPreview = null;
    clearSnap();
    if (preselected.length === 2 && prepareCenterlineEndpointPlacement(preselected)) {
      updateToolbar();
      return;
    }
    clearSelection();
    updateToolbar();
    setHint(applicationText("平行な2線、または2点を順にクリックしてください", "Select two parallel lines or two points"));
    updateUI({ refreshAnalysis: false });
    draw();
  }

  function createCircleCenterCrosses(circles) {
    const targets = [...new Set(Array.isArray(circles) ? circles : [])];
    if (targets.length === 0 || !targets.every((circle) => circle instanceof Circle && isActiveSketchElement(circle))) {
      setHint(applicationText("アクティブスケッチ内の円を選択してください", "Select circles in the active sketch"), "error");
      return false;
    }
    const invalidCircle = targets.find((circle) => !Number.isFinite(circle.radius()) || circle.radius() < MIN_ORIENTATION_LENGTH);
    if (invalidCircle) {
      setHint(applicationText(`円 ${invalidCircle.id} が小さすぎるため十字補助線を作成できません`, `Circle ${invalidCircle.id} is too small to create centerlines`), "error");
      return false;
    }

    const sketchId = activeSketchId();
    const snapshot = snapshotGeometryMutationState();
    const createdLines = [];
    for (const circle of targets) {
      const radius = circle.radius();
      const vertical = addLine(
        addPoint(circle.center.x, circle.center.y - radius, false, "endpoint"),
        addPoint(circle.center.x, circle.center.y + radius, false, "endpoint"),
        true,
      );
      const horizontal = addLine(
        addPoint(circle.center.x - radius, circle.center.y, false, "endpoint"),
        addPoint(circle.center.x + radius, circle.center.y, false, "endpoint"),
        true,
      );
      createdLines.push(vertical, horizontal);
      for (const constraint of [
        new PointOnLineConstraint(circle.center, vertical),
        new VerticalConstraint(vertical),
        new PointOnCircleConstraint(vertical.p1, circle),
        new PointOnCircleConstraint(vertical.p2, circle),
        new PointOnLineConstraint(circle.center, horizontal),
        new HorizontalConstraint(horizontal),
        new PointOnCircleConstraint(horizontal.p1, circle),
        new PointOnCircleConstraint(horizontal.p2, circle),
      ]) pushModelConstraint(constraint, sketchId);
    }

    const solved = solveSketchAndDependents(sketchId);
    if (!solved.success || solved.dependent?.success === false || !resultIsAccepted(solved.result)) {
      const reason = solved.result?.reason || applicationText("拘束を解けません", "The constraints could not be solved");
      restoreGeometryMutationState(snapshot);
      solveSketchAndDependents(sketchId);
      constraintAnalysisState = null;
      setHint(`${applicationText("円中心十字線を作成できません", "Could not create the circle center cross")}: ${reason}`, "error");
      updateUI();
      draw();
      return false;
    }

    mode = "select";
    pointerPreview = null;
    clearSnap();
    clearSelection();
    canvasSelection.set("lines", createdLines);
    constraintAnalysisState = null;
    updateUI();
    draw();
    setHint(applicationText(`${targets.length}個の円に十字補助線を作成しました`, `Created centerlines for ${targets.length} circle(s)`));
    recordHistory("円中心十字線");
    return true;
  }

  function startCircleCenterCrossCommand() {
    cancelConstraintTargetCommand("");
    cancelPendingCommand("");
    if (!canCreateInActiveSketch()) return void rejectRootSketchCreation();
    const preselected = canvasSelection.circles.length > 0 && selectedElementCount() === canvasSelection.circles.length ? canvasSelection.circles.slice() : [];
    if (preselected.length > 0 && createCircleCenterCrosses(preselected)) return;
    clearSelection();
    mode = "circle-center-cross";
    pointerPreview = null;
    clearSnap();
    updateUI({ refreshAnalysis: false });
    draw();
    setHint(applicationText("十字補助線を入れる円をクリックしてください", "Click the circle to add centerlines"));
  }

  function handleCircleCenterCrossClick(circle) {
    if (!circle) {
      setHint(applicationText("円をクリックしてください", "Click a circle"), "error");
      return false;
    }
    return createCircleCenterCrosses([circle]);
  }

  function snapshotLineLength(snapshot, line) {
    if (!snapshot || !line) return line?.length?.() || 0;
    const pointState = new Map(snapshot.points.map((p) => [p.point, p]));
    const p1 = pointState.get(line.p1);
    const p2 = pointState.get(line.p2);
    if (!p1 || !p2) return line.length();
    return hypot2(p2.x - p1.x, p2.y - p1.y);
  }

  function constraintShouldRejectLineCollapse(constraint) {
    return (
      constraint instanceof HorizontalConstraint ||
      constraint instanceof VerticalConstraint ||
      constraint instanceof PointHorizontalConstraint ||
      constraint instanceof PointVerticalConstraint ||
      constraint instanceof SymmetryConstraint ||
      constraint instanceof LineSymmetryConstraint ||
      constraint instanceof ArcSymmetryConstraint ||
      constraint instanceof ParallelConstraint ||
      constraint instanceof PerpendicularConstraint ||
      constraint instanceof CollinearConstraint ||
      constraint instanceof PointOnLineConstraint ||
      constraint instanceof ParallelLinesCenterlineConstraint ||
      constraint instanceof PointPairCenterlineConstraint ||
      constraint instanceof ArcEndpointOnLineConstraint ||
      constraint instanceof LineCircleTangentConstraint
    );
  }

  function findLineCollapseAfterConstraint(constraint, snapshot, sketchId = activeSketchId()) {
    if (!constraintShouldRejectLineCollapse(constraint)) return null;
    const component = connectedComponentFromSeeds(constraintGraphNodes(constraint));
    const lines = localSolveLines(component, sketchId);
    for (const line of lines) {
      const before = snapshotLineLength(snapshot, line);
      const after = line.length();
      if (before <= MIN_LINE_LENGTH * 100) continue;
      const nearMinimum = after <= MIN_LINE_LENGTH * 5;
      const collapsedRelativeToBefore = after <= before * 1e-4;
      if (nearMinimum && collapsedRelativeToBefore) {
        return { line, before, after };
      }
    }
    return null;
  }




  function beginSplineCreation() {
    cancelConstraintTargetCommand("");
    cancelPendingCommand("");
    if (!canCreateInActiveSketch()) return void rejectRootSketchCreation();
    mode = "spline";
    splineDraft.begin();
    sketchProjectionSources = [];
    splineEditSession = null;
    blankDoubleClickCandidate = null;
    pointerPreview = null;
    clearSelection();
    clearSnap();
    updateToolbar();
    setHint(applicationText("通過点をクリックしてください。Enterまたは空白のダブルクリックで終了（ダブルクリック位置は追加しません）、始点クリックで閉じます", "Click fit points. Press Enter or double-click blank canvas to finish without adding that position, or click the start point to close."));
    draw();
  }

  function finishSplineEditSession() {
    if (!splineEditSession) return false;
    splineEditSession = null;
    setHint(applicationText("スプライン編集を終了しました", "Finished editing the spline."));
    updateUI({ refreshAnalysis: false });
    draw();
    return true;
  }

  function restoreSplineFitPointMutation(snapshot) {
    model.points = snapshot.points;
    model.constraints = snapshot.constraints;
    model.annotations = snapshot.annotations;
    snapshot.spline.fitPoints = snapshot.fitPoints;
    snapshot.spline._curveCache = null;
    geometryIds.restore({ pointSeq: snapshot.pointSeq });
    restoreModelState(snapshot.modelState);
    clearSelection();
    canvasSelection.set("splines", [snapshot.spline]);
    splineEditSession = { spline: snapshot.spline };
  }

  function splineFitPointMutationSnapshot(spline) {
    return {
      spline,
      fitPoints: spline.fitPoints.slice(),
      points: model.points.slice(),
      constraints: model.constraints.slice(),
      annotations: model.annotations.slice(),
      pointSeq: geometryIds.peek("point"),
      modelState: snapshotModelState(),
    };
  }

  function stabilizeSplineFitPointMutation(snapshot, historyLabel, successMessage, failureMessage) {
    const curveValid = snapshot.spline.curve().valid;
    const stabilized = curveValid ? stabilizeActiveParameterNamespace(elementSketchId(snapshot.spline)) : null;
    if (!curveValid || !stabilized.success || stabilized.dependent?.success === false) {
      restoreSplineFitPointMutation(snapshot);
      setHint(failureMessage, "error");
      updateUI();
      draw();
      return false;
    }
    constraintAnalysisState = null;
    recordHistory(historyLabel);
    setHint(successMessage);
    updateUI();
    draw();
    return true;
  }

  function addSplineFitPointFromContext(spline, pointer) {
    if (!splineEditSession || splineEditSession.spline !== spline || !model.splines.includes(spline)) return false;
    if (!guardSketchProjectionShapeEdit([spline], { action: applicationText("スプライン通過点追加", "Add spline fit point") })) {
      draw();
      return false;
    }
    const curve = spline.curve();
    const closest = window.SplineGeometry.closestPoint(curve, pointer, { samplesPerSpan: 28 });
    if (!closest?.point || !curve.valid) return false;
    const spanIndex = curve.spans.findIndex((span, index) => closest.t < span.t1 - 1e-9 || index === curve.spans.length - 1);
    if (spanIndex < 0) return false;
    const snapshot = splineFitPointMutationSnapshot(spline);
    const point = addPoint(closest.point.x, closest.point.y, false, "endpoint");
    point.sketchId = elementSketchId(spline);
    spline.fitPoints.splice(spanIndex + 1, 0, point);
    spline._curveCache = null;
    canvasSelection.set("points", [point]);
    canvasSelection.set("splines", []);
    return stabilizeSplineFitPointMutation(
      snapshot,
      "スプライン通過点追加",
      applicationText(`${spline.id} に通過点 ${point.id} を追加しました`, `Added fit point ${point.id} to ${spline.id}.`),
      applicationText("拘束を維持できないため通過点の追加を戻しました", "The fit point addition was restored because its constraints could not be maintained."),
    );
  }

  function deleteSplineFitPointFromContext(spline, point) {
    if (!splineEditSession || splineEditSession.spline !== spline || !spline.fitPoints.includes(point)) return false;
    if (!guardSketchProjectionShapeEdit([spline, point], { action: applicationText("スプライン通過点削除", "Delete spline fit point") })) {
      draw();
      return false;
    }
    if (spline.fitPoints.length <= 3) {
      setHint(applicationText("スプラインには3点以上の通過点が必要です", "A spline requires at least three fit points."), "error");
      return false;
    }
    const usedOutsideSpline =
      isPointUsedByLine(point) ||
      isPointUsedByCircle(point) ||
      isPointUsedByArc(point) ||
      model.splines.some((item) => item !== spline && item.fitPoints.includes(point));
    const removePoint = point.kind === "endpoint" && !usedOutsideSpline;
    const constraintsToRemove = new Set(removePoint ? model.constraints.filter((constraint) => constraintReferencesPoint(constraint, point)) : []);
    if (!guardDimensionSymbolDeletion(constraintsToRemove)) return false;
    const snapshot = splineFitPointMutationSnapshot(spline);
    spline.fitPoints = spline.fitPoints.filter((item) => item !== point);
    spline._curveCache = null;
    if (removePoint) {
      model.points = model.points.filter((item) => item !== point);
      model.constraints = model.constraints.filter((constraint) => !constraintsToRemove.has(constraint));
      const removedIds = new Set([point.id]);
      const removedKeys = new Set([geometryElementKey(point)].filter(Boolean));
      model.annotations = model.annotations.filter((annotation) => !annotationReferencesRemovedGeometry(annotation, removedIds, removedKeys));
      canvasSelection.set("annotations", canvasSelection.annotations.filter((annotation) => model.annotations.includes(annotation)));
    }
    canvasSelection.set("points", []);
    canvasSelection.set("splines", [spline]);
    return stabilizeSplineFitPointMutation(
      snapshot,
      "スプライン通過点削除",
      applicationText(`${spline.id} から通過点 ${point.id} を削除しました`, `Removed fit point ${point.id} from ${spline.id}.`),
      applicationText("拘束を維持できないため通過点の削除を戻しました", "The fit point removal was restored because its constraints could not be maintained."),
    );
  }

  function hatchRegionErrorText(result) {
    const messages = {
      "invalid-point": ["位置が正しくありません", "Invalid point"],
      "point-on-boundary": ["境界線から離れた領域内をクリックしてください", "Click inside the region, away from its boundary"],
      "open-region": ["クリック位置に閉領域がありません", "No closed region was found at the clicked point"],
      "overlapping-boundary": ["境界に重複する図形があるため判定できません", "The boundary contains overlapping geometry"],
      "missing-boundary": ["境界図形が見つかりません", "Boundary geometry is missing"],
      "changed-topology": ["境界の接続関係が変化しています", "The boundary topology has changed"],
      "open-boundary": ["境界が閉じていません", "The boundary is no longer closed"],
      "collapsed-boundary": ["境界領域がつぶれています", "The boundary has collapsed"],
      "invalid-boundary": ["境界データが正しくありません", "The hatch boundary data is invalid"],
    };
    const pair = messages[result?.code];
    return pair ? applicationText(pair[0], pair[1]) : applicationText("閉領域を判定できません", result?.reason || "Could not detect a closed region");
  }

  function hatchFaceAt(pointer) {
    const sketchId = activeSketchId();
    const primitives = hatchPrimitivesForScope(model, sketchId, { visibleOnly: true });
    const fingerprint = primitives.map(hatchPrimitiveFingerprint).join("|");
    let cached = hatchFaceCache.get(sketchId);
    if (!cached || cached.fingerprint !== fingerprint) {
      cached = { fingerprint, index: createHatchRegionIndex(primitives) };
      hatchFaceCache.set(sketchId, cached);
    }
    return findHatchFaceInIndex(cached.index, pointer);
  }

  function updateHatchPreview(pointer) {
    if (!pointer || !["hatch", "hatch-repair"].includes(mode)) return;
    hatchPreview = { pointer: { x: pointer.x, y: pointer.y }, result: hatchFaceAt(pointer) };
  }

  function startHatchCreation() {
    cancelConstraintTargetCommand("");
    cancelPendingCommand("");
    if (!canCreateInActiveSketch()) {
      rejectRootSketchCreation();
      return;
    }
    mode = "hatch";
    hatchRepairTarget = null;
    pointerPreview = lastPointerWorld;
    hatchPreview = null;
    if (pointerPreview) updateHatchPreview(pointerPreview);
    clearSnap();
    updateToolbar();
    updateStatusUI();
    setHint(applicationText("ハッチングする閉領域の内側をクリックしてください。終了はEscです", "Click inside a closed region to hatch it. Press Esc to finish."));
    draw();
  }

  function startHatchBoundaryRepair(hatch) {
    if (!hatch || hatch.blockProjection || !model.hatches.includes(hatch)) return false;
    if (hatch.sketchId !== activeSketchId()) setActiveSketch(hatch.sketchId);
    mode = "hatch-repair";
    hatchRepairTarget = hatch;
    hatchPreview = null;
    pointerPreview = lastPointerWorld;
    if (pointerPreview) updateHatchPreview(pointerPreview);
    updateToolbar();
    updateStatusUI();
    setHint(applicationText(`${hatch.id} の新しい閉領域をクリックしてください`, `Click a new closed region for ${hatch.id}`));
    draw();
    return true;
  }

  function commitHatchAt(pointer) {
    const result = hatchFaceAt(pointer);
    hatchPreview = { pointer: { x: pointer.x, y: pointer.y }, result };
    if (!result.ok) {
      setHint(hatchRegionErrorText(result), "error");
      draw();
      return false;
    }
    if (mode === "hatch-repair" && hatchRepairTarget) {
      const hatch = hatchRepairTarget;
      hatch.seed = { x: pointer.x, y: pointer.y };
      hatch.boundaryLoops = result.boundaryLoops;
      hatchResolutionCache.delete(hatch);
      clearSelection();
      canvasSelection.set("hatches", [hatch]);
      hatchRepairTarget = null;
      hatchPreview = null;
      pointerPreview = null;
      mode = "select";
      updateUI({ refreshAnalysis: false });
      draw();
      recordHistory("ハッチング境界再指定");
      setHint(applicationText(`${hatch.id} の境界を再指定しました`, `Reassigned the boundary of ${hatch.id}`));
      return true;
    }
    const hatch = {
      id: `H${hatchSeq++}`,
      sketchId: activeSketchId(),
      seed: { x: pointer.x, y: pointer.y },
      boundaryLoops: result.boundaryLoops,
      appearance: { ...DEFAULT_HATCH_APPEARANCE },
    };
    model.hatches.push(hatch);
    model.nextHatchIndex = hatchSeq;
    clearSelection();
    canvasSelection.set("hatches", [hatch]);
    updateUI({ refreshAnalysis: false });
    draw();
    recordHistory("ハッチング追加");
    setHint(applicationText(`${hatch.id} を作成しました。続けて閉領域をクリックできます`, `Created ${hatch.id}. Click another closed region to continue.`));
    return true;
  }

  function blockSelectionGeometry() {
    const lines = canvasSelection.lines.filter((item) => !item.blockProjection);
    const circles = canvasSelection.circles.filter((item) => !item.blockProjection);
    const arcs = canvasSelection.arcs.filter((item) => !item.blockProjection);
    const splines = canvasSelection.splines.filter((item) => !item.blockProjection);
    const points = new Set(canvasSelection.points.filter((item) => !item.blockProjection));
    const blockInstances = canvasSelection.blockInstances.filter((instance) => model.blockInstances.includes(instance));
    const annotations = canvasSelection.annotations.filter((annotation) => model.annotations.includes(annotation));
    const hatches = canvasSelection.hatches.filter((hatch) => model.hatches.includes(hatch));
    for (const line of lines) {
      points.add(line.p1);
      points.add(line.p2);
    }
    for (const primitive of [...circles, ...arcs]) points.add(primitive.center);
    for (const spline of splines) for (const point of spline.fitPoints) points.add(point);
    const projectedGeometry = blockInstances.flatMap((instance) => {
      const bundle = blockProjectionBundle(instance);
      return [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])];
    });
    const geometry = [...points, ...lines, ...circles, ...arcs, ...splines, ...blockInstances, ...projectedGeometry];
    if (lines.length + circles.length + arcs.length + splines.length + blockInstances.length + annotations.length + hatches.length === 0) return { error: applicationText("ブロック化する図形、ハッチングまたは注記を選択してください", "Select geometry, hatching, or annotations to create a block") };
    if (!geometry.every((item) => elementSketchId(item) === activeSketchId())) return { error: "アクティブスケッチ内の図形だけをブロック化できます" };
    if (!annotations.every((item) => item.sketchId === activeSketchId())) return { error: applicationText("アクティブスケッチ内の注記だけをブロック化できます", "Only annotations in the active sketch can be converted to a block") };
    if (!hatches.every((item) => item.sketchId === activeSketchId())) return { error: applicationText("アクティブスケッチ内のハッチングだけをブロック化できます", "Only hatching in the active sketch can be converted to a block") };
    const selectedSet = new Set(geometry);
    const selectedProjectionIds = new Set(projectedGeometry.map((item) => item.id));
    const isSelectedNode = (node) => selectedSet.has(node) || Boolean(node?.blockProjection && selectedProjectionIds.has(node.id));
    for (const point of points) {
      const shared = model.lines.some((line) => !selectedSet.has(line) && (line.p1 === point || line.p2 === point)) ||
        model.circles.some((circle) => !selectedSet.has(circle) && circle.center === point) ||
        model.arcs.some((arc) => !selectedSet.has(arc) && arc.center === point);
      const sharedBySpline = model.splines.some((spline) => !selectedSet.has(spline) && spline.fitPoints.includes(point));
      if (shared || sharedBySpline) return { error: `${point.id} は非選択図形と共有されています` };
    }
    const internalConstraints = [];
    const externalConstraints = [];
    for (const constraint of model.constraints) {
      const nodes = constraintGraphNodes(constraint).filter((node) => node instanceof Point || node instanceof Line || node instanceof Circle || node instanceof Arc || node instanceof Spline);
      if (!nodes.some(isSelectedNode)) continue;
      if (constraint.reference || nodes.some((node) => !isSelectedNode(node))) externalConstraints.push(constraint);
      else {
        if (!serializeConstraint(constraint)) return { error: `ブロック化で保持できない拘束があります: ${constraintLabelForList(constraint)}` };
        internalConstraints.push(constraint);
      }
    }
    for (const annotation of annotations) {
      if (annotation.type !== "leader") continue;
      const referenced = resolveGeometryRef(annotation.geometryRef);
      if (!referenced || !isSelectedNode(referenced)) return { error: applicationText(`注記 ${annotation.id} の参照先も選択してください`, `Also select the target referenced by annotation ${annotation.id}`) };
    }
    for (const annotation of model.annotations) {
      if (annotations.includes(annotation)) continue;
      const referenced = annotation.type === "leader" ? resolveGeometryRef(annotation.geometryRef) : null;
      if (referenced && isSelectedNode(referenced)) return { error: `注記 ${annotation.id} が選択図形を参照しています` };
    }
    const selectedBoundaryKeys = new Set([...lines, ...circles, ...arcs, ...splines].map((item) => `${geometryKindForItem(item)}:${item.id}`));
    for (const hatch of hatches) {
      const missing = hatchBoundaryGeometryRefs(hatch.boundaryLoops).filter((ref) => !selectedBoundaryKeys.has(`${ref.kind}:${geometryRefId(ref)}`));
      if (missing.length) return { error: applicationText(`ハッチング ${hatch.id} の境界 ${missing.map(geometryRefId).join("、")} も選択してください`, `Also select boundary ${missing.map(geometryRefId).join(", ")} for hatch ${hatch.id}`) };
    }
    for (const hatch of model.hatches) {
      if (hatches.includes(hatch)) continue;
      if (hatchBoundaryGeometryRefs(hatch.boundaryLoops).some((ref) => selectedBoundaryKeys.has(`${ref.kind}:${geometryRefId(ref)}`))) {
        return { error: applicationText(`ハッチング ${hatch.id} も選択してください`, `Also select hatch ${hatch.id}`) };
      }
    }
    return { points: [...points], lines, circles, arcs, splines, annotations, hatches, blockInstances, projectedGeometry, constraints: internalConstraints, externalConstraints };
  }

  function cloneConstraintForBlock(constraint, pointById, lineById, primitiveById, origin = { x: 0, y: 0 }, preserveReference = false) {
    const data = decorateSerializedConstraint(serializeConstraint(constraint), constraint);
    if (!data) throw new Error("未対応の内部拘束があります");
    if (data.dimension) {
      data.dimension = { ...data.dimension };
      for (const key of ["x", "labelX"]) if (Number.isFinite(Number(data.dimension[key]))) data.dimension[key] = Number(data.dimension[key]) - origin.x;
      for (const key of ["y", "labelY"]) if (Number.isFinite(Number(data.dimension[key]))) data.dimension[key] = Number(data.dimension[key]) - origin.y;
    }
    translateFixedConstraintValues(data, -origin.x, -origin.y);
    const cloned = deserializeConstraint(data, pointById, lineById, primitiveById);
    if (!cloned) throw new Error("内部拘束を複製できません");
    cloned.sketchId = constraint.sketchId || DEFAULT_SKETCH_ID;
    cloned.reference = preserveReference && Boolean(constraint.reference);
    cloned.referenceSketchId = cloned.reference ? constraint.referenceSketchId || null : null;
    return cloned;
  }

  function createBlockSketchState() {
    return {
      sketches: [
        { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", appearance: {}, constructionAppearance: {}, dimensionAppearance: {} },
        { id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {} },
      ],
      activeSketchId: DEFAULT_SKETCH_ID,
    };
  }

  function blockSelectionBoundsCenter(selection) {
    let bounds = null;
    for (const line of selection.lines || []) bounds = mergeBounds(bounds, lineBBox(line));
    for (const primitive of [...(selection.circles || []), ...(selection.arcs || [])]) bounds = mergeBounds(bounds, primitiveBBox(primitive));
    for (const spline of selection.splines || []) bounds = mergeBounds(bounds, splineBBox(spline));
    for (const annotation of selection.annotations || []) bounds = mergeBounds(bounds, annotationBounds(annotation));
    for (const instance of selection.blockInstances || []) {
      const bundle = blockProjectionBundle(instance);
      for (const line of bundle.lines) bounds = mergeBounds(bounds, lineBBox(line));
      for (const primitive of [...bundle.circles, ...bundle.arcs]) bounds = mergeBounds(bounds, primitiveBBox(primitive));
      for (const spline of bundle.splines || []) bounds = mergeBounds(bounds, splineBBox(spline));
      for (const point of bundle.points) bounds = mergeBounds(bounds, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
      for (const annotation of bundle.annotations || []) bounds = mergeBounds(bounds, annotationBounds(annotation));
    }
    return bounds ? { x: (bounds.x1 + bounds.x2) / 2, y: (bounds.y1 + bounds.y2) / 2 } : { x: 0, y: 0 };
  }

  function createBlockDefinitionFromSelection(selection, origin, name) {
    const sketchState = createBlockSketchState();
    const pointById = new Map();
    const points = selection.points.map((source) => {
      const point = new Point(source.id, source.x - origin.x, source.y - origin.y, source.fixed, source.kind || "endpoint");
      point.sketchId = DEFAULT_SKETCH_ID;
      point.appearance = normalizeAppearance(source.appearance);
      pointById.set(point.id, point);
      return point;
    });
    const lineById = new Map();
    const lines = selection.lines.map((source) => {
      const line = new Line(source.id, pointById.get(source.p1.id), pointById.get(source.p2.id), source.construction);
      line.sketchId = DEFAULT_SKETCH_ID;
      line.drawingOrder = normalizedDrawingOrder(source.drawingOrder);
      line.appearance = normalizeAppearance(source.appearance);
      lineById.set(line.id, line);
      return line;
    });
    const primitiveById = new Map();
    const circles = selection.circles.map((source) => {
      const circle = new Circle(source.id, pointById.get(source.center.id), source.radius(), source.construction);
      circle.sketchId = DEFAULT_SKETCH_ID;
      circle.drawingOrder = normalizedDrawingOrder(source.drawingOrder);
      circle.appearance = normalizeAppearance(source.appearance);
      primitiveById.set(circle.id, circle);
      return circle;
    });
    const arcs = selection.arcs.map((source) => {
      const arc = new Arc(source.id, pointById.get(source.center.id), source.radius(), source.startAngle, source.endAngle, source.construction);
      arc.sketchId = DEFAULT_SKETCH_ID;
      arc.drawingOrder = normalizedDrawingOrder(source.drawingOrder);
      arc.appearance = normalizeAppearance(source.appearance);
      primitiveById.set(arc.id, arc);
      return arc;
    });
    const splines = (selection.splines || []).map((source) => {
      const spline = new Spline(source.id, source.fitPoints.map((point) => pointById.get(point.id)), source.closed, source.construction);
      spline.sketchId = DEFAULT_SKETCH_ID;
      spline.drawingOrder = normalizedDrawingOrder(source.drawingOrder);
      spline.appearance = normalizeAppearance(source.appearance);
      primitiveById.set(spline.id, spline);
      return spline;
    });
    const blockInstances = (selection.blockInstances || []).map((source) => {
      const instance = cloneBlockInstance(source, origin);
      instance.sketchId = DEFAULT_SKETCH_ID;
      return instance;
    });
    for (const instance of blockInstances) {
      const nestedDefinition = blockDefinitionById(instance.definitionId);
      if (nestedDefinition) addGeometryBundleToMaps(createBlockProjectionBundle(instance, nestedDefinition), pointById, lineById, primitiveById);
    }
    const constraints = selection.constraints.map((constraint) => {
      const cloned = cloneConstraintForBlock(constraint, pointById, lineById, primitiveById, origin);
      cloned.sketchId = DEFAULT_SKETCH_ID;
      if (isDimensionConstraint(cloned)) {
        delete cloned.parameterName;
        if (!isReadOnlyDimension(cloned)) cloned.expression = numericDimensionExpression(cloned);
      }
      return cloned;
    });
    const annotations = (selection.annotations || []).map((source) => {
      const cloned = serializeAnnotation(source);
      cloned.id = source.id;
      cloned.sketchId = DEFAULT_SKETCH_ID;
      cloned.x -= origin.x;
      cloned.y -= origin.y;
      for (const key of ["start", "elbow", "end"]) if (cloned[key]) cloned[key] = { x: cloned[key].x - origin.x, y: cloned[key].y - origin.y };
      return cloned;
    });
    const hatches = (selection.hatches || []).map((source) => ({
      ...serializeHatch(source),
      sketchId: DEFAULT_SKETCH_ID,
      seed: { x: source.seed.x - origin.x, y: source.seed.y - origin.y },
    }));
    const definition = { id: `B${blockDefinitionSeq++}`, name, parentDefinitionId: null, origin: { x: 0, y: 0 }, ...sketchState, points, lines, circles, arcs, splines, annotations, hatches, referenceImages: [], nextHatchIndex: Math.max(1, nextSeq(hatches, "H")), blockInstances, geometryInstances: [], constraints, parameters: [], nextDimensionParameterIndex: 1, revision: 1 };
    ensureParameterNamespace(definition);
    return definition;
  }

  function createEmptyBlockDefinition(name) {
    const sketchState = createBlockSketchState();
    return { id: `B${blockDefinitionSeq++}`, name, parentDefinitionId: null, origin: { x: 0, y: 0 }, ...sketchState, points: [], lines: [], circles: [], arcs: [], splines: [], annotations: [], hatches: [], referenceImages: [], nextHatchIndex: 1, blockInstances: [], geometryInstances: [], constraints: [], parameters: [], nextDimensionParameterIndex: 1, revision: 1 };
  }

  function rebuildBlockDefinitionConstraintObjects(definition) {
    return constraintRebinding.rebuildDefinition(definition);
  }

  function rebuildStoredBlockDefinitionConstraints() {
    return documentModel.blockDefinitions.reduce((removed, definition) => removed + rebuildBlockDefinitionConstraintObjects(definition), 0);
  }

  function blockDefinitionOwnedSubtreeIds(rootDefinitionIds) {
    const ids = new Set(rootDefinitionIds);
    let changed = true;
    while (changed) {
      changed = false;
      for (const definition of documentModel.blockDefinitions) {
        if (!definition.parentDefinitionId || !ids.has(definition.parentDefinitionId) || ids.has(definition.id)) continue;
        ids.add(definition.id);
        changed = true;
      }
    }
    return ids;
  }

  function selectedBlockDefinitionMoveError(selection) {
    const selectedInstances = new Set(selection?.blockInstances || []);
    const definitionIds = [...new Set((selection?.blockInstances || []).map((instance) => instance.definitionId))];
    for (const definitionId of definitionIds) {
      const definition = blockDefinitionById(definitionId);
      if (!definition) return `ブロック定義 ${definitionId} が見つかりません`;
      const unselected = model.blockInstances.filter((instance) => instance.definitionId === definitionId && !selectedInstances.has(instance));
      if (unselected.length === 0) continue;
      return `${definition.name} を使用する未選択インスタンス（${unselected.map((instance) => instance.id).join(", ")}）があります。対象インスタンスをすべて選択してください`;
    }
    return null;
  }

  function stageSelectedBlockDefinitionsForParent(draft) {
    const rootDefinitionIds = [...new Set((draft?.blockInstances || []).map((instance) => instance.definitionId))];
    if (!draft || rootDefinitionIds.length === 0) return new Map();
    const rootIdSet = new Set(rootDefinitionIds);
    const subtreeIds = blockDefinitionOwnedSubtreeIds(rootDefinitionIds);
    const rollbackEntries = new Map();
    const stagedDefinitions = new Map();
    for (let index = 0; index < documentModel.blockDefinitions.length; index += 1) {
      const definition = documentModel.blockDefinitions[index];
      if (!subtreeIds.has(definition.id)) continue;
      rollbackEntries.set(definition.id, { definition, index });
      const staged = cloneBlockDefinition(definition);
      if (rootIdSet.has(staged.id)) staged.parentDefinitionId = draft.id;
      stagedDefinitions.set(staged.id, staged);
    }
    documentModel.blockDefinitions = documentModel.blockDefinitions.map((definition) => stagedDefinitions.get(definition.id) || definition);
    for (const definition of stagedDefinitions.values()) rebuildBlockDefinitionConstraintObjects(definition);
    rebuildBlockDefinitionConstraintObjects(draft);
    invalidateBlockProjectionCache();
    return rollbackEntries;
  }

  function blockDefinitionsInCurrentScope() {
    const parentDefinitionId = currentBlockDefinitionScopeId();
    return documentModel.blockDefinitions.filter((definition) => (definition.parentDefinitionId || null) === parentDefinitionId);
  }

  function blockDefinitionScopeError(definitionId) {
    const definition = blockDefinitionById(definitionId);
    if (!definition) return "ブロック定義が見つかりません";
    return (definition.parentDefinitionId || null) === currentBlockDefinitionScopeId()
      ? null
      : "このブロックは現在の階層では使用できません";
  }

  function blockDefinitionForDependency(definitionId) {
    const session = blockEditorSessionChain().find((item) => item.draft?.id === definitionId);
    return session?.draft || blockDefinitionById(definitionId);
  }

  function blockDefinitionDependsOn(definitionId, targetDefinitionId, visiting = new Set()) {
    if (!definitionId || !targetDefinitionId || visiting.has(definitionId)) return false;
    if (definitionId === targetDefinitionId) return true;
    const definition = blockDefinitionForDependency(definitionId);
    if (!definition) return false;
    const nextVisiting = new Set(visiting).add(definitionId);
    return (definition.blockInstances || []).some((instance) => blockDefinitionDependsOn(instance.definitionId, targetDefinitionId, nextVisiting));
  }

  function blockInstancesInEditingScope() {
    const instances = new Set(model.blockInstances);
    for (const session of blockEditorSessionChain()) {
      for (const instance of session.draft?.blockInstances || []) instances.add(instance);
      for (const instance of session.original?.values.blockInstances || []) instances.add(instance);
    }
    for (const definition of documentModel.blockDefinitions) for (const instance of definition.blockInstances || []) instances.add(instance);
    return [...instances];
  }

  function storedBlockInstancesReferencing(definitionId, hostInstances = null) {
    const instances = hostInstances
      ? [...hostInstances, ...documentModel.blockDefinitions.flatMap((definition) => definition.blockInstances || [])]
      : blockInstancesInEditingScope();
    return [...new Set(instances)].filter((instance) => instance.definitionId === definitionId);
  }

  function blockDefinitionUsageCount(definitionId) {
    return model.blockInstances.filter((instance) => instance.definitionId === definitionId).length;
  }

  function blockDefinitionEditError(definitionId) {
    const activeSession = blockEditorSessionChain().find((session) => session.draft?.id === definitionId);
    return activeSession ? `${activeSession.draft.name} は現在編集中です` : null;
  }

  function blockDefinitionCyclePath(startDefinitionId) {
    const complete = new Set();
    const visit = (definitionId, path) => {
      const repeatedAt = path.indexOf(definitionId);
      if (repeatedAt >= 0) return [...path.slice(repeatedAt), definitionId];
      if (complete.has(definitionId)) return null;
      const definition = blockDefinitionForDependency(definitionId);
      if (!definition) return null;
      const nextPath = [...path, definitionId];
      for (const instance of definition.blockInstances || []) {
        const cycle = visit(instance.definitionId, nextPath);
        if (cycle) return cycle;
      }
      complete.add(definitionId);
      return null;
    };
    return visit(startDefinitionId, []);
  }

  function nestedBlockPlacementError(definitionId) {
    if (!blockEditor.current) return null;
    for (const session of blockEditorSessionChain()) {
      if (blockDefinitionDependsOn(definitionId, session.draft.id)) {
        return `${session.draft.name} を循環参照するため、このブロックは配置できません`;
      }
    }
    return null;
  }

  function startBlockCreation() {
    if (!isGeometryMode() || !canCreateInActiveSketch()) return;
    const definitionsDialog = document.getElementById("blockDefinitionsDialog");
    if (definitionsDialog?.open) definitionsDialog.close();
    const creationHost = { ...workspace.capture(), viewport: viewport.snapshot() };
    const defaultName = `Block-${blockDefinitionSeq}`;
    const hasGeometrySelection = canvasSelection.lines.length + canvasSelection.circles.length + canvasSelection.arcs.length + canvasSelection.splines.length + canvasSelection.annotations.length + canvasSelection.hatches.length > 0;
    let selection = null;
    let origin = { x: 0, y: 0 };
    if (hasGeometrySelection || canvasSelection.blockInstances.length > 0) {
      selection = blockSelectionGeometry();
      if (selection.error) {
        setHint(selection.error, "error");
        return;
      }
      const definitionMoveError = selectedBlockDefinitionMoveError(selection);
      if (definitionMoveError) {
        setHint(definitionMoveError, "error");
        return;
      }
      if (!guardDimensionSymbolDeletion(new Set([...(selection.constraints || []), ...(selection.externalConstraints || [])]))) return;
      origin = blockSelectionBoundsCenter(selection);
    }
    const draft = selection ? createBlockDefinitionFromSelection(selection, origin, defaultName) : createEmptyBlockDefinition(defaultName);
    draft.parentDefinitionId = currentBlockDefinitionScopeId();
    const definitionRollbackEntries = selection ? stageSelectedBlockDefinitionsForParent(draft) : new Map();
    openBlockDefinitionEditor(draft, { isNew: true, creationSelection: selection, replacementCenter: origin, definitionRollbackEntries, originalHost: creationHost });
  }




  function reserveBlockEditorSequences(draft) {
    reserveGeometryElementSequences(draft);
    sketchSeq = Math.max(sketchSeq, nextSeq(draft.sketches || [], "S"));
    annotationSeq = Math.max(annotationSeq, nextSeq(draft.annotations || [], "AN"));
    hatchSeq = Math.max(hatchSeq, model.nextHatchIndex, nextSeq(draft.hatches || [], "H"));
    referenceImageSeq = Math.max(referenceImageSeq, nextSeq(draft.referenceImages || [], "IMG"));
  }

  function openBlockDefinitionEditor(draft, options = {}) {
    if (!draft) return;
    blockEditor.open(draft, options);
    resetBlockEditorHistory();
    clearSelection();
    mode = "select";
    document.body.classList.add("block-editing");
    if (draft.lines.length + draft.circles.length + draft.arcs.length + (draft.splines?.length || 0) + (draft.annotations?.length || 0) + (draft.hatches?.length || 0) + (draft.referenceImages?.length || 0) + model.blockInstances.length > 0) fitAllGeometryToViewport();
    else {
      const rect = canvas.getBoundingClientRect();
      viewport.update({ scale: CSS_PX_PER_MM });
      viewport.update({ x: rect.width / 2 });
      viewport.update({ y: rect.height / 2 });
    }
    const externalConstraintCount = blockEditor.current.creationSelection?.externalConstraints?.length || 0;
    setHint(
      externalConstraintCount > 0
        ? `ブロックエディタ: ${draft.name} / 選択外につながる拘束${externalConstraintCount}件は完了時に解除されます`
        : `ブロックエディタ: ${draft.name}`,
    );
    updateUI();
    draw();
  }

  function enterBlockDefinitionEdit(definitionId) {
    const scopeError = blockDefinitionScopeError(definitionId);
    if (scopeError) {
      setHint(scopeError, "error");
      return;
    }
    const editError = blockDefinitionEditError(definitionId);
    if (editError) {
      setHint(editError, "error");
      return;
    }
    const definition = blockDefinitionById(definitionId);
    if (!definition) return;
    openBlockDefinitionEditor(cloneBlockDefinition(definition), { sourceDefinition: definition });
  }

  function validateBlockDraft(draft) {
    if (draft.lines.length + draft.circles.length + draft.arcs.length + (draft.splines?.length || 0) + (draft.annotations?.length || 0) + (draft.hatches?.length || 0) + (draft.blockInstances?.length || 0) + (draft.geometryInstances?.length || 0) === 0) return { success: false, reason: applicationText("ブロックには図形、ハッチングまたは注記が必要です", "A block must contain geometry, hatching, or annotations") };
    const outOfScopeInstance = (draft.blockInstances || []).find((instance) => blockDefinitionById(instance.definitionId)?.parentDefinitionId !== draft.id);
    if (outOfScopeInstance) return { success: false, reason: "現在のブロックに属さない子ブロックが含まれています" };
    const cycle = blockDefinitionCyclePath(draft.id);
    if (cycle) return { success: false, reason: `ブロックの循環参照があります: ${cycle.join(" → ")}` };
    const duplicateId = duplicateBlockElementId(draft);
    if (duplicateId) return { success: false, reason: `内部図形ID ${duplicateId} が重複しています。編集をキャンセルしてデータを確認してください` };
    refreshReferenceConstraintValidity();
    if (invalidReferenceConstraints.size > 0) return { success: false, reason: "内部スケッチの参照関係に循環または無効な参照があります" };
    const drawableIds = blockDefinitionDrawableSketchIds(draft);
    for (const sketchId of drawableIds) {
      const result = solveSketchById(sketchId);
      if (!resultIsAccepted(result)) return { success: false, reason: `${sketchName(sketchId)} が成立しません (error=${result.errorNorm.toExponential(3)})` };
      const dependent = solveReferenceDependentSketches(sketchId);
      if (!dependent.success) return { success: false, reason: `${sketchName(dependent.sketchId)} が成立しません` };
    }
    return { success: true };
  }

  function restoreBlockEditorHost(session) {
    blockEditor.restoreHost(session);
    document.body.classList.toggle("block-editing", Boolean(blockEditor.current));
  }

  const choiceDialog = window.ChoiceDialog.create(document.getElementById("choiceDialog"));
  let blockCompletionChoicePending = false;

  function completeBlockDefinitionEdit(options = {}) {
    if (!blockEditor.current) return;
    if (blockCompletionChoicePending) return;
    const session = blockEditor.current;
    const { draft, sourceDefinition, originalElementIds, creationSelection } = session;
    syncBlockEditorDraft(session);
    const validation = validateBlockDraft(draft);
    if (!validation.success) {
      setHint(validation.reason, "error");
      draw();
      return;
    }
    if (session.isNew && creationSelection && typeof options.rotationLocked !== "boolean") {
      blockCompletionChoicePending = true;
      choiceDialog.show({
        title: applicationText("ブロックの回転設定", "Block Rotation"),
        message: applicationText("作成するブロックの回転方法を選択してください。\n回転ロックは向きを固定します。\n自由回転は、一致拘束した点などを支点に回転できます。", "Choose how the new block rotates.\nRotation lock holds its orientation. Free rotation allows it to rotate around a point constrained by coincidence, for example."),
        choices: [
          { value: true, label: applicationText("回転ロックして作成", "Create with Rotation Lock") },
          { value: false, label: applicationText("自由回転で作成", "Create with Free Rotation") },
        ],
        defaultValue: true,
        cancelLabel: applicationText("キャンセル", "Cancel"),
        closeLabel: applicationText("閉じる", "Close"),
      }).then((rotationLocked) => {
        blockCompletionChoicePending = false;
        if (rotationLocked !== null && blockEditor.current === session) completeBlockDefinitionEdit({ rotationLocked });
      }, () => {
        blockCompletionChoicePending = false;
        setHint(applicationText("別の確認ダイアログを閉じてから、もう一度完了してください", "Close the other confirmation dialog, then try completing the block again."), "error");
      });
      return;
    }
    if (session.isNew && !creationSelection) {
      const center = blockLocalGeometryBounds(draft, blockDefinitionDrawableSketchIds(draft))?.center || { x: 0, y: 0 };
      translateBlockDefinition(draft, -center.x, -center.y);
      draft.origin = { x: 0, y: 0 };
    }
    if (sourceDefinition) {
      for (const instance of storedBlockInstancesReferencing(sourceDefinition.id, session.original.values.blockInstances)) {
        const remaining = instance.enabledSketchIds.filter((id) => blockDefinitionGeometrySketchIds(draft).includes(id));
        if (remaining.length === 0) {
          setHint(`${instance.id} の有効スケッチが空になるため編集を完了できません`, "error");
          return;
        }
      }
    }
    restoreBlockEditorHost(session);
    let definition = draft;
    let createdInstance = null;
    let blockCreationExternalConstraints = [];
    if (sourceDefinition) {
      definition = mergeBlockDefinitionDraft(sourceDefinition, draft);
      for (const instance of storedBlockInstancesReferencing(definition.id)) {
        instance.enabledSketchIds = instance.enabledSketchIds.filter((id) => blockDefinitionGeometrySketchIds(definition).includes(id));
      }
      const removedStoredConstraints = rebuildStoredBlockDefinitionConstraints();
      if (removedStoredConstraints > 0) log(`削除された入れ子図形を参照する内部拘束を${removedStoredConstraints}件解除しました`);
    } else {
      definition.revision = 1;
      documentModel.blockDefinitions.push(definition);
      if (creationSelection) {
        const enabledSketchIds = blockDefinitionGeometrySketchIds(definition);
        createdInstance = { id: `BI${blockInstanceSeq++}`, definitionId: definition.id, sketchId: model.activeSketchId, x: session.replacementCenter.x, y: session.replacementCenter.y, rotation: 0, fixed: false, rotationLocked: options.rotationLocked, enabledSketchIds, appearanceOverride: {} };
        model.blockInstances.push(createdInstance);
        blockCreationExternalConstraints = creationSelection.externalConstraints || [];
        model.constraints = model.constraints.filter((constraint) => !creationSelection.constraints.includes(constraint) && !blockCreationExternalConstraints.includes(constraint));
        model.lines = model.lines.filter((line) => !creationSelection.lines.includes(line));
        model.circles = model.circles.filter((circle) => !creationSelection.circles.includes(circle));
        model.arcs = model.arcs.filter((arc) => !creationSelection.arcs.includes(arc));
        model.splines = model.splines.filter((spline) => !(creationSelection.splines || []).includes(spline));
        model.points = model.points.filter((point) => !creationSelection.points.includes(point));
        model.annotations = model.annotations.filter((annotation) => !(creationSelection.annotations || []).includes(annotation));
        model.hatches = model.hatches.filter((hatch) => !(creationSelection.hatches || []).includes(hatch));
        model.blockInstances = model.blockInstances.filter((instance) => !(creationSelection.blockInstances || []).includes(instance));
      }
    }
    blockEditor.adoptChildChanges(session, definition.id, Boolean(sourceDefinition));
    const currentElementIds = new Set([...definition.points, ...definition.lines, ...definition.circles, ...definition.arcs, ...(definition.splines || [])].map((item) => item.id));
    const removedLocalIds = new Set([...originalElementIds].filter((id) => !currentElementIds.has(id)));
    if (removedLocalIds.size > 0) {
      model.constraints = model.constraints.filter((constraint) => !constraintGraphNodes(constraint).some((node) =>
        node?.blockDefinition === definition && removedLocalIds.has(node.localElement?.id),
      ));
      const removedProjectionIds = new Set();
      const removedProjectionKeys = new Set();
      for (const instance of model.blockInstances.filter((item) => item.definitionId === definition.id)) {
        for (const localId of removedLocalIds) {
          for (const kind of ["point", "line", "circle", "arc", "spline"]) {
            const ref = createGeometryRef(kind, [String(instance.id), String(localId)]);
            removedProjectionIds.add(geometryRefId(ref));
            removedProjectionKeys.add(geometryRefKey(ref));
          }
        }
      }
      model.annotations = model.annotations.filter((annotation) => !annotationReferencesRemovedGeometry(annotation, removedProjectionIds, removedProjectionKeys));
    }
    invalidateBlockProjectionCache();
    const currentProjectionItems = blockProjectionBundles().flatMap((bundle) => [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])]);
    const currentProjectionIds = new Set(currentProjectionItems.map((item) => item.id));
    const currentProjectionKeys = new Set(currentProjectionItems.map(geometryElementKey));
    const removedProjectionIds = new Set([...session.originalProjectionIds].filter((id) => !currentProjectionIds.has(id)));
    const removedProjectionKeys = new Set([...session.originalProjectionKeys].filter((key) => !currentProjectionKeys.has(key)));
    if (removedProjectionIds.size > 0) {
      model.constraints = model.constraints.filter((constraint) => !constraintGraphNodes(constraint).some((node) => removedProjectionIds.has(node?.id)));
      model.annotations = model.annotations.filter((annotation) => !annotationReferencesRemovedGeometry(annotation, removedProjectionIds, removedProjectionKeys));
    }
    const affectedSketchIds = [...new Set(model.blockInstances.filter((instance) => blockDefinitionDependsOn(instance.definitionId, definition.id)).map((instance) => instance.sketchId))];
    for (const sketchId of affectedSketchIds) {
      const placementResult = solveSketchById(sketchId);
      if (placementResult.success && placementResult.errorNorm <= CONSTRAINT_ACCEPT_ERROR) setSketchSolveOk(sketchId, placementResult, definition.id);
      else setSketchSolveError(sketchId, placementResult, definition.id);
      solveReferenceDependentSketches(sketchId);
    }
    clearSelection();
    if (createdInstance) canvasSelection.set("blockInstances", [createdInstance]);
    mode = "select";
    const completionHint = sourceDefinition ? `ブロック定義を更新しました: ${definition.name}` : `ブロックを作成しました: ${definition.name}`;
    const externalConstraintHint = blockCreationExternalConstraints.length > 0 ? ` / 外部拘束${blockCreationExternalConstraints.length}件を解除しました` : "";
    setHint(`${completionHint}${externalConstraintHint}`);
    if (blockCreationExternalConstraints.length > 0) log(`ブロック外部拘束を${blockCreationExternalConstraints.length}件解除しました`);
    updateUI();
    draw();
    recordHistory(sourceDefinition ? "ブロック定義編集" : "ブロック作成");
  }

  function cancelBlockDefinitionEdit() {
    if (!blockEditor.current) return;
    const session = blockEditor.current;
    restoreBlockEditorHost(session);
    blockEditor.rollback(session);
    clearSelection();
    mode = "select";
    setHint(session.sourceDefinition ? "ブロック定義編集をキャンセルしました" : "ブロック作成をキャンセルしました");
    updateUI();
    draw();
  }

  function exitBlockDefinitionEdit() {
    completeBlockDefinitionEdit();
  }

  function renameBlockDefinition(definitionId) {
    const scopeError = blockDefinitionScopeError(definitionId);
    if (scopeError) {
      setHint(scopeError, "error");
      return;
    }
    const editError = blockDefinitionEditError(definitionId);
    if (editError) {
      setHint(`${editError}。編集中の名前欄を使用してください`, "error");
      return;
    }
    const definition = blockDefinitionById(definitionId);
    if (!definition) return;
    const name = window.prompt("ブロック名", definition.name);
    if (name == null || !name.trim()) return;
    definition.name = name.trim();
    updateBlockUI();
    recordHistory("ブロック名変更");
  }

  function deleteBlockDefinition(definitionId) {
    const scopeError = blockDefinitionScopeError(definitionId);
    if (scopeError) {
      setHint(scopeError, "error");
      return;
    }
    const editError = blockDefinitionEditError(definitionId);
    if (editError) {
      setHint(`${editError}。完了またはキャンセルしてから削除してください`, "error");
      return;
    }
    const definition = blockDefinitionById(definitionId);
    if (!definition) return;
    const instances = model.blockInstances.filter((instance) => instance.definitionId === definitionId);
    if (instances.length > 0) {
      setHint(`${definition.name} は ${instances.length}個のインスタンスで使用中のため削除できません`, "error");
      return;
    }
    const removedDefinitionIds = new Set([definitionId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of documentModel.blockDefinitions) {
        if (item.parentDefinitionId && removedDefinitionIds.has(item.parentDefinitionId) && !removedDefinitionIds.has(item.id)) {
          removedDefinitionIds.add(item.id);
          changed = true;
        }
      }
    }
    documentModel.blockDefinitions = documentModel.blockDefinitions.filter((item) => !removedDefinitionIds.has(item.id));
    blockEditor.forgetDefinitions(removedDefinitionIds);
    invalidateBlockProjectionCache();
    updateBlockUI();
    draw();
    recordHistory("ブロック定義削除");
  }

  function syncOffsetChainSelection() {
    canvasSelection.set("points", []);
    canvasSelection.set("circles", offsetSelection.source instanceof Circle ? [offsetSelection.source] : []);
    canvasSelection.set("lines", offsetSelection.entries.map((entry) => entry.geometry).filter((item) => item instanceof Line));
    canvasSelection.set("arcs", offsetSelection.entries.map((entry) => entry.geometry).filter((item) => item instanceof Arc));
    canvasSelection.set("blockInstances", []);
    canvasSelection.set("annotations", []);
    canvasSelection.set("hatches", []);
    canvasSelection.set("referenceImages", []);
    canvasSelection.set("arcEndpoint", null);
    canvasSelection.set("arcEndpointPair", null);
    canvasSelection.set("dimensionConstraint", null);
    canvasSelection.set("constraint", null);
  }

  function offsetChainErrorText(result) {
    const messages = {
      "empty-chain": ["オフセットするチェーンがありません", "There is no chain to offset"],
      "invalid-distance": ["オフセット距離が正しくありません", "The offset distance is invalid"],
      "invalid-segment": ["チェーンに無効な図形があります", "The chain contains invalid geometry"],
      "collapsed-radius": ["指定距離では円弧の半径が成立しません", "An arc radius collapses at this offset distance"],
      "missing-miter": ["角部をマイター接続できません", "A chain corner cannot be joined with a miter"],
      "collapsed-segment": ["指定距離ではチェーンの一部が退化します", "Part of the chain collapses at this offset distance"],
      "self-intersection": ["指定距離ではオフセット結果が自己交差します", "The offset result self-intersects at this distance"],
    };
    const pair = messages[result?.code];
    return pair ? applicationText(pair[0], pair[1]) : applicationText("チェーンをオフセットできません", "The chain cannot be offset");
  }

  function resetModelState() {
    activateEditingScope(documentModel);
    flushScheduledCanvasPointerMove({ discard: true });
    mode = "select";
    lastAuthoringPerformance = null;
    window.DocumentState.clearContent(documentModel);
    referenceImageRenderer.clear();
    invalidateBlockProjectionCache();
    sketchSolveStates.clear();
    invalidReferenceConstraints.clear();
    constraintAnalysisState = null;
    clearSelection();
    dragSession = null;
    dimensionDragSession = null;
    referenceImageDragSession = null;
    referenceImageCalibrationSession = null;
    canvasNavigation.reset();
    suppressNextBlankDoubleClickEvent = false;
    lineCommand.reset();
    resetCenterlineCommandState();
    clearTransientPointRollback();
    clearTransientLineCompletionRollback();
    rectangleCommand.reset();
    resetSlotCommandState();
    filletCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    splineDraft.reset();
    sketchProjectionSources = [];
    geometryInstanceCommand.clearSources();
    instanceSourceCommand.reset();
    splineEditSession = null;
    pointerPreview = null;
    offsetSelection.reset();
    pendingCommand = null;
    pendingConstraintCommand = null;
    constraintOperands = [];
    constructionLineMode = false;
    hoveredPoint = null;
    hoveredEndpointPoint = null;
    hoveredLine = null;
    hoveredCircle = null;
    hoveredArc = null;
    hoveredSpline = null;
    hoveredArcEndpoint = null;
    hoveredDimensionConstraint = null;
    selectionHighlight.reset();
    hoveredSketchIdentity = null;
    lastPointerWorld = null;
    clearSnap();
    canvasSelection.set("arcEndpoint", null);
    canvasSelection.set("arcEndpointPair", null);
    canvasSelection.set("dimensionConstraint", null);
    canvasSelection.set("constraint", null);
    canvasSelection.set("annotations", []);
    canvasSelection.set("hatches", []);
    canvasSelection.set("referenceImages", []);
    canvasSelection.set("splines", []);
    canvasSelection.set("blockInstances", []);
    canvasSelection.set("geometryInstances", []);
    hoveredBlockInstance = null;
    canvasSelection.set("instanceGeometry", null);
    hoveredGeometryInstance = null;
    hoveredHatch = null;
    hoveredReferenceImage = null;
    geometryIds.reset();
    sketchSeq = 2;
    annotationSeq = 1;
    hatchSeq = 1;
    referenceImageSeq = 1;
    blockDefinitionSeq = 1;
    blockInstanceSeq = 1;
    sketchProjectionInstanceSeq = 1;
    mirrorInstanceSeq = 1;
    patternInstanceSeq = 1;
    freeInstanceSeq = 1;
    blockElementSeq = 1;
    blockPlacementCommand.reset();
    blockEditor.reset();
    window.DocumentState.resetDefaults(documentModel);
    hatchPreview = null;
    hatchRepairTarget = null;
    hatchResolutionCache = new WeakMap();
    hatchFaceCache = new Map();
    sketchTreeView.reset();
    annotationDragSession = null;
    referenceImageDragSession = null;
    referenceImageCalibrationSession = null;
  }


  function reserveGeometryElementSequences(source) {
    geometryIds.reserve(source);
    hatchSeq = Math.max(hatchSeq, nextSeq(source?.hatches || [], "H"));
    referenceImageSeq = Math.max(referenceImageSeq, nextSeq(source?.referenceImages || [], "IMG"));
  }

  function duplicateBlockElementId(definition) {
    const seen = new Set();
    for (const item of [...(definition?.points || []), ...(definition?.lines || []), ...(definition?.circles || []), ...(definition?.arcs || []), ...(definition?.splines || []), ...(definition?.hatches || []), ...(definition?.referenceImages || []), ...(definition?.blockInstances || [])]) {
      const id = String(item?.id || "");
      if (seen.has(id)) return id;
      seen.add(id);
    }
    return null;
  }

  function serializeDimension(dimension, target = null) {
    if (!dimension) return null;
    if (target?.kind === "angle") migrateAngleDimensionLabelPlacement(target, dimension);
    const anchor = target ? dimensionAnchor(target, dimension) : dimension;
    const axis = target ? storedDimensionAxis(target, dimension) : dimension.axis || null;
    const data = {
      x: Number(anchor.x),
      y: Number(anchor.y),
      offsetU: Number.isFinite(dimension.offsetU) ? dimension.offsetU : null,
      offsetN: Number.isFinite(dimension.offsetN) ? dimension.offsetN : null,
      labelOffsetU: Number.isFinite(dimension.labelOffsetU) ? dimension.labelOffsetU : 0,
      axis,
      display: dimension.display ? normalizeDimensionAppearance(dimension.display) : null,
    };
    if (Number.isFinite(dimension.labelX) && Number.isFinite(dimension.labelY)) {
      data.labelX = Number(dimension.labelX);
      data.labelY = Number(dimension.labelY);
    }
    if (target?.kind === "angle") {
      data.angleStartFlip = Number.isInteger(dimension.angleStartFlip) ? dimension.angleStartFlip : null;
      data.angleEndFlip = Number.isInteger(dimension.angleEndFlip) ? dimension.angleEndFlip : null;
      data.angleRadius = Number.isFinite(dimension.angleRadius) ? dimension.angleRadius : null;
      if (Number.isFinite(dimension.angleLabelOffsetR) && Number.isFinite(dimension.angleLabelOffsetT)) {
        data.angleLabelOffsetR = dimension.angleLabelOffsetR;
        data.angleLabelOffsetT = dimension.angleLabelOffsetT;
        data.angleLabelPlacementVersion = 2;
      }
    }
    return data;
  }

  const constraintCodecs = window.ConstraintPersistence.create({
    geometryId: constraintGeometryId,
    dimensionData: (constraint) => serializeDimension(constraint.dimension, targetFromConstraint(constraint)),
  });

  function serializeConstraint(c) {
    return constraintCodecs.serialize(c);
  }

  const documentSnapshot = window.DocumentSnapshot.create({
    geometryMetadata: (item) => ({
      sketchId: elementSketchId(item),
      kind: item instanceof Point ? item.kind || (isPointUsedByPrimitive(item) ? "endpoint" : "explicit") : undefined,
    }),
    constraintData: (constraint, scope, isDocumentScope) => {
      const data = decorateSerializedConstraint(serializeConstraint(constraint), constraint);
      if (!data) return null;
      data.sketchId = isDocumentScope ? constraintSketchId(constraint) : constraint.sketchId;
      if (constraint.reference) {
        data.reference = true;
        data.referenceSketchId = constraint.referenceSketchId || null;
      }
      return data;
    },
  });

  function serializeModel() {
    ensureModelState();
    return documentSnapshot.serialize(workspace.snapshotSource(), {
      version: CURRENT_JSON_VERSION, savedAt: new Date().toISOString(),
      documentName: effectiveDocumentName(), nextHatchIndex: hatchSeq,
    });
  }

  function historySnapshot() {
    const data = serializeModel();
    delete data.savedAt;
    delete data.documentName;
    return JSON.stringify(data);
  }

  function blockEditorHistoryData(definition) {
    return {
      id: definition.id,
      name: definition.name,
      parentDefinitionId: definition.parentDefinitionId || null,
      origin: { x: Number(definition.origin?.x) || 0, y: Number(definition.origin?.y) || 0 },
      sketches: definition.sketches.map((sketch) => ({ ...sketch })),
      activeSketchId: definition.activeSketchId,
      parameters: (definition.parameters || []).map((parameter) => ({ name: parameter.name, expression: parameter.expression })),
      nextDimensionParameterIndex: Math.max(1, Number(definition.nextDimensionParameterIndex) || 1),
      points: definition.points.map((point) => ({ id: point.id, x: point.x, y: point.y, fixed: point.fixed, kind: point.kind, sketchId: point.sketchId })),
      lines: definition.lines.map((line) => ({ id: line.id, p1: line.p1.id, p2: line.p2.id, construction: Boolean(line.construction), sketchId: line.sketchId, drawingOrder: normalizedDrawingOrder(line.drawingOrder) ?? 0 })),
      circles: definition.circles.map((circle) => ({ id: circle.id, center: circle.center.id, radius: circle.radius(), construction: Boolean(circle.construction), sketchId: circle.sketchId, drawingOrder: normalizedDrawingOrder(circle.drawingOrder) ?? 0 })),
      arcs: definition.arcs.map((arc) => ({ id: arc.id, center: arc.center.id, radius: arc.radius(), startAngle: arc.startAngle, endAngle: arc.endAngle, construction: Boolean(arc.construction), sketchId: arc.sketchId, drawingOrder: normalizedDrawingOrder(arc.drawingOrder) ?? 0 })),
      splines: (definition.splines || []).map((spline) => ({ id: spline.id, definitionMode: "fit", degree: 3, fitPoints: spline.fitPoints.map((point) => point.id), closed: Boolean(spline.closed), endCondition: "natural", construction: Boolean(spline.construction), sketchId: spline.sketchId, drawingOrder: normalizedDrawingOrder(spline.drawingOrder) ?? 0 })),
      annotations: normalizeAnnotations(definition.annotations, definition.activeSketchId).map(serializeAnnotation),
      hatches: normalizeHatches(definition.hatches, definition.activeSketchId).map(serializeHatch),
      referenceImages: normalizeReferenceImages(definition.referenceImages, definition.activeSketchId).map(serializeReferenceImage),
      nextHatchIndex: Math.max(nextSeq(definition.hatches || [], "H"), Number(definition.nextHatchIndex) || 1),
      blockInstances: (definition.blockInstances || []).map((instance) => ({
        id: instance.id,
        definitionId: instance.definitionId,
        sketchId: instance.sketchId,
        drawingOrder: normalizedDrawingOrder(instance.drawingOrder) ?? 0,
        x: instance.x,
        y: instance.y,
        rotation: instance.rotation,
        fixed: Boolean(instance.fixed),
        rotationLocked: Boolean(instance.rotationLocked),
        enabledSketchIds: Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.slice() : [],
      })),
      geometryInstances: (definition.geometryInstances || []).map(serializeGeometryInstance),
      constraints: definition.constraints.map((constraint) => {
        const data = decorateSerializedConstraint(serializeConstraint(constraint), constraint);
        if (!data) return null;
        data.sketchId = constraint.sketchId;
        if (constraint.reference) {
          data.reference = true;
          data.referenceSketchId = constraint.referenceSketchId || null;
        }
        return data;
      }).filter(Boolean),
    };
  }

  function captureBlockEditorHistorySnapshot() {
    const definition = cloneBlockDefinition(liveBlockEditorDefinition());
    return { definition, signature: JSON.stringify(blockEditorHistoryData(definition)) };
  }

  function resetBlockEditorHistory() {
    if (!blockEditor.current) return;
    blockEditor.current.history.reset();
    updateHistoryButtons();
  }

  function createBlockEditHistory() {
    return window.EditHistory.create({
      capture: captureBlockEditorHistorySnapshot,
      signature: (snapshot) => snapshot?.signature,
      restore: restoreBlockEditorHistorySnapshot,
      limit: HISTORY_LIMIT,
      recordLabel: "ブロック編集履歴に追加しました",
      undoLabel: "ブロック編集を戻す",
      redoLabel: "ブロック編集を進む",
    });
  }

  function activeEditHistory() {
    return blockEditor.current?.history || documentHistory;
  }

  function updateHistoryButtons() {
    const undoBtn = document.getElementById("undoBtn");
    const redoBtn = document.getElementById("redoBtn");
    const history = activeEditHistory();
    if (undoBtn) undoBtn.disabled = history.undoCount <= 1;
    if (redoBtn) redoBtn.disabled = history.redoCount === 0;
    updateDocumentNameUI();
  }

  function resetHistory(label = "initial") {
    documentHistory.reset();
    updateHistoryButtons();
    log(`履歴を初期化しました: ${label}`);
  }

  function recordHistory(label = "変更") {
    if (!interactionProfiler.active) return recordHistoryUnprofiled(label);
    return profileInteractionWork("history", () => recordHistoryUnprofiled(label));
  }

  function recordHistoryUnprofiled(label = "変更") {
    if (historyRestoring) return;
    const history = activeEditHistory();
    const recorded = history.record();
    updateHistoryButtons();
    if (recorded) log(`${history.recordLabel}: ${label}`);
  }

  function restoreHistorySnapshot(snapshot, label) {
    const constructionModeBeforeRestore = constructionLineMode;
    const documentNameBeforeRestore = documentModel.documentName;
    historyRestoring = true;
    try {
      loadModelData(JSON.parse(snapshot), { documentNameFallback: documentNameBeforeRestore, preserveSketchTreeState: true });
      documentModel.documentName = documentNameBeforeRestore;
      constructionLineMode = constructionModeBeforeRestore;
      clearInteractionForSketchChange();
      solveAndRefresh(label);
      setHint(label);
    } finally {
      historyRestoring = false;
      updateHistoryButtons();
    }
  }

  function restoreBlockEditorHistorySnapshot(snapshot, label) {
    if (!blockEditor.current || !snapshot?.definition) return false;
    historyRestoring = true;
    try {
      const restored = cloneBlockDefinition(snapshot.definition);
      blockEditor.replaceDraft(restored);
      invalidateBlockProjectionCache();
      clearInteractionForSketchChange();
      solveAndRefresh(label);
      setHint(label);
      return true;
    } finally {
      historyRestoring = false;
      updateHistoryButtons();
    }
  }

  function undoHistory() {
    return activeEditHistory().undo();
  }

  function redoHistory() {
    return activeEditHistory().redo();
  }

  function deserializeConstraint(...args) {
    return constraintCodecs.deserialize(...args);
  }

  function serializedGeometryInstanceListError(instances) {
    return geometryInstancePersistence.listError(instances);
  }

  function loadModelData(data, options = {}) {
    if (!data || !Array.isArray(data.points) || !Array.isArray(data.lines) || !Array.isArray(data.constraints)) {
      throw new Error("保存データの形式が正しくありません");
    }
    lastLoadBlockConstraintRepairMessage = "";
    const preservedSketchTree = options.preserveSketchTreeState ? sketchTreeView.capture() : null;
    const candidate = documentLoading.decode(data, options);
    const { repairedBlockConstraintCount } = candidate;

    resetModelState();
    if (preservedSketchTree) sketchTreeView.restore(preservedSketchTree);
    documentLoading.install(candidate, documentModel, model);
    refreshReferenceConstraintValidity();
    const lineRepair = enforceMinimumLineLengths(model.lines);
    lastLoadLineRepairMessage =
      lineRepair.changed > 0 || lineRepair.failed > 0
        ? `短すぎる線を補正しました: ${lineRepair.changed}件${lineRepair.failed ? ` / 補正不能 ${lineRepair.failed}件` : ""}`
        : "";
    if (lastLoadLineRepairMessage) log(lastLoadLineRepairMessage);
    lastLoadBlockConstraintRepairMessage = repairedBlockConstraintCount > 0
      ? `参照先が見つからないブロック内部拘束を${repairedBlockConstraintCount}件解除しました`
      : "";
    if (lastLoadBlockConstraintRepairMessage) log(lastLoadBlockConstraintRepairMessage);
    ensureDimensionDefaults();
    const recoveredSequences = window.DocumentSequences.recover(model, documentModel.blockDefinitions);
    reserveGeometryElementSequences(recoveredSequences.geometry);
    ({ sketchSeq, annotationSeq, hatchSeq, referenceImageSeq, blockDefinitionSeq, blockInstanceSeq,
      sketchProjectionInstanceSeq, freeInstanceSeq, mirrorInstanceSeq, patternInstanceSeq, blockElementSeq } = recoveredSequences);
    ensureAppearanceState();
    ensureBlockState();
    ensureDrawingOrderState(model);
    for (const definition of documentModel.blockDefinitions) ensureDrawingOrderState(definition);
  }

  function jot2dFilePickerTypes() {
    return [{
      description: applicationText("Jot2Dドキュメント", "Jot2D document"),
      accept: { [JOT2D_FILE_MIME_TYPE]: [JOT2D_FILE_EXTENSION] },
    }];
  }

  function fileSystemAccessSupported(method) {
    return typeof window[method] === "function";
  }

  function filePickerCanceled(error) {
    return error?.name === "AbortError";
  }

  function serializedJot2DFileData() {
    return JSON.stringify(serializeModel(), null, 2);
  }

  function downloadJot2DFile(content, name) {
    const url = URL.createObjectURL(new Blob([content], { type: JOT2D_FILE_MIME_TYPE }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    try { link.click(); } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  }

  async function saveJot2DFile({ saveAs = false, replacingDocument = false } = {}) {
    if (!fileSession.canSave({ replacingDocument })) return false;
    if (blockEditor.current) {
      setHint("ブロック定義編集を終了してから保存してください", "error");
      return false;
    }
    let handle = saveAs ? null : fileSession.handle;
    fileSession.beginSave({ replacingDocument });
    updateDocumentNameUI();
    try {
      const nativeSave = handle || fileSystemAccessSupported("showSaveFilePicker");
      if (!handle && nativeSave) {
        handle = await window.showSaveFilePicker({
          suggestedName: `${safeDownloadBaseName(documentModel.documentName)}${JOT2D_FILE_EXTENSION}`,
          types: jot2dFilePickerTypes(),
          excludeAcceptAllOption: true,
        });
      }
      if (blockEditor.current) {
        setHint("ブロック定義編集を終了してから保存してください", "error");
        return false;
      }
      const content = serializedJot2DFileData();
      const name = handle?.name || `${safeDownloadBaseName(documentModel.documentName)}${JOT2D_FILE_EXTENSION}`;
      if (handle) {
        await writeJot2DFile(handle, content);
        fileSession.setHandle(handle);
      } else {
        downloadJot2DFile(content, name);
      }
      markDocumentFileCheckpoint(handle ? "saved" : "download", JSON.parse(content));
      const message = handle ? applicationText(`保存しました: ${name}`, `Saved: ${name}`)
        : applicationText(`ダウンロードを開始しました: ${name}`, `Download started: ${name}`);
      setHint(message);
      log(message);
      return true;
    } catch (error) {
      if (filePickerCanceled(error)) {
        setHint("保存をキャンセルしました");
        return false;
      }
      const message = applicationText(`ファイル保存に失敗しました: ${error.message}`, `Failed to save the file: ${error.message}`);
      setHint(message, "error");
      log(message);
      return false;
    } finally {
      fileSession.finishSave();
      updateDocumentNameUI();
    }
  }

  function saveJot2DFileAs() {
    return saveJot2DFile({ saveAs: true });
  }

  function importFileData(file, { expectedContentSignature = null } = {}) {
    if (!file) return Promise.resolve(false);
    if (blockEditor.current) {
      setHint("ブロック定義編集を終了してから読み込んでください", "error");
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        try {
          if (blockEditor.current) {
            setHint("ブロック定義編集を終了してから読み込んでください", "error");
            resolve(false);
            return;
          }
          if (expectedContentSignature !== null && documentContentSignature(serializeModel()) !== expectedContentSignature) {
            setHint(applicationText("読込待機中に図面が変更されたため、ファイルを開く操作を中止しました", "Opening was canceled because the drawing changed while the file was being read."));
            resolve(false);
            return;
          }
          loadModelData(JSON.parse(String(reader.result)), { documentNameOverride: fileNameStem(file.name) });
          solveAndRefresh("ファイル読み込み");
          resetHistory("ファイル読み込み");
          markDocumentFileCheckpoint("saved");
          updateDocumentNameUI();
          fitAllGeometryToViewport();
          draw();
          if (lastLoadBlockConstraintRepairMessage) setHint(lastLoadBlockConstraintRepairMessage);
          log(`ファイルを読み込みました: ${file.name}`);
          resolve(true);
        } catch (err) {
          setHint(`ファイル読み込みに失敗しました: ${err.message}`);
          log(`ファイル読み込みに失敗しました: ${err.message}`);
          resolve(false);
        }
      });
      reader.addEventListener("error", () => {
        setHint("ファイル読み込みに失敗しました");
        log("ファイル読み込みに失敗しました");
        resolve(false);
      });
      reader.readAsText(file);
    });
  }

  function htmlDocumentFilePickerRequested() {
    return new URLSearchParams(window.location.search).get("filePicker") === "input";
  }

  function requestDocumentFileInput() {
    const input = document.getElementById("documentFileInput");
    if (!input) {
      setHint(applicationText("互換ファイル入力を開始できません", "The compatible file input is unavailable"), "error");
      return false;
    }
    input.click();
    return true;
  }

  async function openJot2DFile() {
    if (fileSession.busy) return false;
    if (blockEditor.current) {
      setHint("ブロック定義編集を終了してから読み込んでください", "error");
      return false;
    }
    if (htmlDocumentFilePickerRequested() || !fileSystemAccessSupported("showOpenFilePicker")) return requestDocumentFileInput();
    if (!fileSession.beginOpen()) return false;
    try {
      const [handle] = await window.showOpenFilePicker({
        types: jot2dFilePickerTypes(),
        excludeAcceptAllOption: true,
        multiple: false,
      });
      if (!handle) return false;
      if (!await confirmDocumentReplacement()) return false;
      const expectedContentSignature = documentContentSignature(serializeModel());
      // Re-read after saving: the chosen file may be the current save target.
      const file = await handle.getFile();
      const opened = await importFileData(file, { expectedContentSignature });
      if (!opened) return false;
      fileSession.setHandle(handle);
      updateDocumentNameUI();
      const message = applicationText(`ファイルを開きました: ${file.name}`, `Opened: ${file.name}`);
      setHint(message);
      log(message);
      return true;
    } catch (error) {
      if (filePickerCanceled(error)) {
        setHint("ファイルを開く操作をキャンセルしました");
        return false;
      }
      const message = applicationText(`ファイル読み込みに失敗しました: ${error.message}`, `Failed to open the file: ${error.message}`);
      setHint(message, "error");
      log(message);
      return false;
    } finally {
      fileSession.finishOpen();
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result)));
      reader.addEventListener("error", () => reject(reader.error || new Error(applicationText("画像を読み込めません", "The image could not be read"))));
      reader.readAsDataURL(file);
    });
  }

  function decodeImageDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image), { once: true });
      image.addEventListener("error", () => reject(new Error(applicationText("画像をデコードできません", "The image could not be decoded"))), { once: true });
      image.src = dataUrl;
    });
  }

  async function preparedReferenceImageData(file) {
    const extension = String(file?.name || "").split(".").pop()?.toLowerCase();
    const fallbackMimeType = extension === "png" ? "image/png" : ["jpg", "jpeg"].includes(extension) ? "image/jpeg" : extension === "webp" ? "image/webp" : null;
    const mimeType = referenceImageMimeType(file?.type) || fallbackMimeType;
    if (!mimeType) throw new Error(applicationText("PNG、JPEG、WebP画像を選択してください", "Select a PNG, JPEG, or WebP image"));
    const readDataUrl = await readFileAsDataUrl(file);
    const dataSeparatorIndex = readDataUrl.indexOf(",");
    if (dataSeparatorIndex < 0) throw new Error(applicationText("画像データの形式が正しくありません", "Invalid image data"));
    const originalDataUrl = `data:${mimeType};base64,${readDataUrl.slice(dataSeparatorIndex + 1)}`;
    const decoded = await decodeImageDataUrl(originalDataUrl);
    const ratio = Math.min(1, REFERENCE_IMAGE_MAX_SIDE_PX / Math.max(decoded.naturalWidth, decoded.naturalHeight));
    if (ratio >= 1) return { dataUrl: originalDataUrl, mimeType, pixelWidth: decoded.naturalWidth, pixelHeight: decoded.naturalHeight, resized: false };
    const pixelWidth = Math.max(1, Math.round(decoded.naturalWidth * ratio));
    const pixelHeight = Math.max(1, Math.round(decoded.naturalHeight * ratio));
    const resizeCanvas = document.createElement("canvas");
    resizeCanvas.width = pixelWidth;
    resizeCanvas.height = pixelHeight;
    resizeCanvas.getContext("2d").drawImage(decoded, 0, 0, pixelWidth, pixelHeight);
    return { dataUrl: resizeCanvas.toDataURL(mimeType, 0.92), mimeType, pixelWidth, pixelHeight, resized: true };
  }

  async function importReferenceImageFile(file) {
    if (!file) return false;
    if (!canCreateInActiveSketch()) {
      setHint(applicationText("画像を所属させる子スケッチをアクティブにしてください", "Activate a child sketch for the image"), "error");
      return false;
    }
    try {
      const prepared = await preparedReferenceImageData(file);
      const rect = canvas.getBoundingClientRect();
      const screenScale = Math.min(Math.max(80, rect.width * 0.68) / prepared.pixelWidth, Math.max(80, rect.height * 0.68) / prepared.pixelHeight);
      const center = screenToWorld({ x: rect.width / 2, y: rect.height / 2 });
      const item = {
        id: `IMG${referenceImageSeq++}`,
        name: String(file.name || "Image").replace(/\.[^.]+$/, "") || "Image",
        sketchId: activeSketchId(),
        mimeType: prepared.mimeType,
        dataUrl: prepared.dataUrl,
        pixelWidth: prepared.pixelWidth,
        pixelHeight: prepared.pixelHeight,
        x: center.x,
        y: center.y,
        scale: screenScale / viewport.scale,
        rotation: 0,
        opacity: 0.5,
        visible: true,
        locked: false,
      };
      model.referenceImages.push(item);
      clearSelection();
      canvasSelection.set("referenceImages", [item]);
      updateUI({ refreshAnalysis: false });
      draw();
      recordHistory("画像読み込み");
      setHint(prepared.resized
        ? applicationText(`画像を読み込み、長辺${REFERENCE_IMAGE_MAX_SIDE_PX}px以下に縮小しました`, `Image loaded and resized to at most ${REFERENCE_IMAGE_MAX_SIDE_PX}px on the long side`)
        : applicationText("画像を読み込みました", "Image loaded"));
      return true;
    } catch (error) {
      setHint(applicationText(`画像の読み込みに失敗しました: ${error.message}`, `Failed to load image: ${error.message}`), "error");
      return false;
    }
  }

  function pointAt(x, y) {
    return hitAnyPoint(x, y) || addPoint(x, y);
  }

  function endpointAt(x, y) {
    const endpoint = hitEndpointPoint(x, y);
    if (endpoint) return endpoint;
    const explicit = hitExplicitPoint(x, y);
    if (explicit) return addPoint(explicit.x, explicit.y, false, "endpoint");
    return addPoint(x, y, false, "endpoint");
  }

  function clearSelection() {
    canvasSelection.clear();
    constraintOperands = [];
    hoveredSketchIdentity = null;
    hoveredBlockInstance = null;
    hoveredGeometryInstance = null;
    selectionHighlight.reset();
    hoveredAnnotation = null;
    hoveredHatch = null;
    hoveredReferenceImage = null;
    hoveredSpline = null;
  }

  function selectableSketchElement(item) {
    return isEditableSketchElement(item);
  }

  function exitLineMode() {
    resetCenterlineCommandState();
    lineCommand.reset();
    rectangleCommand.reset();
    resetSlotCommandState();
    filletCommand.reset();
    pointerPreview = null;
    trimPreview = null;
    offsetSelection.reset();
    clearSnap();
    mode = "select";
    updateToolbar();
    setHint("連続線を終了しました");
    updateUI();
    draw();
  }

  function exitDrawMode() {
    instanceSourceCommand.reset();
    resetCenterlineCommandState();
    lineCommand.reset();
    clearTransientPointRollback();
    clearTransientLineCompletionRollback();
    rectangleCommand.reset();
    resetSlotCommandState();
    filletCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    splineDraft.reset();
    splineEditSession = null;
    sketchProjectionSources = [];
    pointerPreview = null;
    trimPreview = null;
    offsetSelection.reset();
    hatchPreview = null;
    hatchRepairTarget = null;
    clearSnap();
    mode = "select";
    updateToolbar();
    setHint("選択・ドラッグモードに戻りました");
    updateUI();
    draw();
  }

  function hasActiveDrawOperation() {
    return Boolean(lineCommand.startPoint || centerlineCommand.targets.length || centerlineCommand.firstPoint || rectangleCommand.startPoint || slotCommand.firstCenter || slotCommand.secondCenter || filletCommand.firstLine || circularCommands.circleCenterPoint || circularCommands.arcCenterPoint || circularCommands.arcStartPoint || circularCommands.threePointArcStart || circularCommands.threePointArcEnd || splineDraft.points.length || offsetSelection.source || offsetSelection.entries.length);
  }


  function cancelActiveDrawOperation() {
    resetCenterlineCommandState();
    rollbackTransientLineStart();
    clearTransientPointRollback();
    clearTransientLineCompletionRollback();
    lineCommand.reset();
    rectangleCommand.reset();
    resetSlotCommandState();
    filletCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    splineDraft.cancel();
    splineEditSession = null;
    sketchProjectionSources = [];
    pointerPreview = null;
    trimPreview = null;
    offsetSelection.reset();
    hatchPreview = null;
    hatchRepairTarget = null;
    clearSnap();
    clearSelection();
    setHint("作図操作をキャンセルしました");
    updateUI();
    draw();
  }

  function sampleModel() {
    resetModelState();

    const A = addPoint(160, 160, true, "endpoint");
    const B = addPoint(300, 180, false, "endpoint");
    const C = addPoint(280, 290, false, "endpoint");
    const D = addPoint(140, 270, false, "endpoint");
    const AB = addLine(A, B);
    const BC = addLine(B, C);
    const CD = addLine(C, D);
    const DA = addLine(D, A);

    pushModelConstraint(new DistanceConstraint(A, B, 140));
    pushModelConstraint(new DistanceConstraint(B, C, 100));
    pushModelConstraint(new ParallelConstraint(AB, CD));
    pushModelConstraint(new ParallelConstraint(BC, DA));
    pushModelConstraint(new PerpendicularConstraint(AB, BC));
    ensureDimensionDefaults();

    solveAndRefresh("サンプル復元");
    log("サンプルを復元しました");
  }

  function resizeCanvas(options = {}) {
    const rect = canvas.getBoundingClientRect();
    syncCanvasBitmapSize(rect.width, rect.height);
    if (options.centerWorld && rect.width > 0 && rect.height > 0) {
      viewport.update({ x: rect.width / 2 - options.centerWorld.x * viewport.scale });
      viewport.update({ y: rect.height / 2 - options.centerWorld.y * viewport.scale });
    }
    applySketchTreeWidth();
    draw();
    if (pendingCommand && ["distance-value", "offset-value"].includes(pendingCommand.type)) syncDimensionValueInput();
  }


  function setPropertiesPanelCollapsed(collapsed) {
    const workspace = document.querySelector(".workspace");
    const button = document.getElementById("togglePropertiesPanelBtn");
    if (!workspace || !button) return;
    const centerWorld = currentCanvasCenterWorld();
    const label = applicationText("プロパティ", "Properties");
    workspace.classList.toggle("properties-collapsed", collapsed);
    button.setAttribute("aria-expanded", String(!collapsed));
    const actionLabel = applicationSettings.language === "en" ? `${collapsed ? "Expand" : "Collapse"} ${label}` : `${label}を${collapsed ? "展開" : "最小化"}`;
    button.setAttribute("aria-label", actionLabel);
    button.title = actionLabel;
    resizeCanvas({ centerWorld });
  }







  function formatDisplayNumber(value, maxFractionDigits = 10, snapTolerance = DIMENSION_DISPLAY_PRECISION) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    const displayDigits = Math.max(0, Math.min(10, maxFractionDigits));
    const floatingPointSlack = Number.EPSILON * Math.max(1, Math.abs(n)) * 8;
    const effectiveSnapTolerance = Math.max(0, snapTolerance) + floatingPointSlack;
    let rounded = Number(n.toFixed(displayDigits));
    let roundedDigits = displayDigits;
    for (let digits = 0; digits <= displayDigits; digits += 1) {
      const candidate = Number(n.toFixed(digits));
      if (candidate === 0 && n !== 0) continue;
      if (Math.abs(n - candidate) <= effectiveSnapTolerance) {
        rounded = candidate;
        roundedDigits = digits;
        break;
      }
    }
    if (Object.is(rounded, -0)) return "0";
    const formatted = rounded.toFixed(roundedDigits);
    if (!formatted.includes(".")) return formatted;
    return formatted.replace(/0+$/, "").replace(/\.$/, "");
  }

  function formatDimensionLabel(value, suffix = "") {
    return `${formatDisplayNumber(value)}${suffix}`;
  }

  function formatMeasuredDimensionLabel(value, suffix = "") {
    return `${formatDisplayNumber(value, 10, MEASURED_DIMENSION_SNAP_TOLERANCE)}${suffix}`;
  }









  function isPointUsedByLine(point, lines = model.lines) {
    return lines.some((line) => line.p1 === point || line.p2 === point);
  }

  function isAnyLineEndpoint(point) {
    return isPointUsedByLine(point, allGeometryLines());
  }

  function isPointUsedByCircle(point, circles = model.circles) {
    return circles.some((circle) => circle.center === point);
  }

  function isPointUsedByArc(point, arcs = model.arcs) {
    return arcs.some((arc) => arc.center === point);
  }

  function isPointUsedBySpline(point, splines = model.splines) {
    return splines.some((spline) => spline.fitPoints.includes(point));
  }

  function isSplineOnlyFitPoint(point) {
    const projected = Boolean(point?.blockProjection);
    const splines = projected ? allGeometrySplines() : model.splines;
    const lines = projected ? allGeometryLines() : model.lines;
    const circles = projected ? allGeometryCircles() : model.circles;
    const arcs = projected ? allGeometryArcs() : model.arcs;
    return isPointUsedBySpline(point, splines) && !isPointUsedByLine(point, lines) && !isPointUsedByCircle(point, circles) && !isPointUsedByArc(point, arcs) && !isExplicitPoint(point);
  }

  function isEditableSplineFitPoint(point) {
    return Boolean(splineEditSession?.spline?.fitPoints.includes(point));
  }

  function isPointUsedByPrimitive(point) {
    return isPointUsedByLine(point) || isPointUsedByCircle(point) || isPointUsedByArc(point) || isPointUsedBySpline(point);
  }

  function isEndpointPoint(point) {
    return point?.kind === "endpoint" || isPointUsedByPrimitive(point);
  }

  function isExplicitPoint(point) {
    return point?.kind !== "endpoint";
  }

  function isReferencePoint(point) {
    return Boolean(point?.kind === "endpoint" && !isPointUsedByPrimitive(point) && model.constraints.some((c) => c.enabled !== false && constraintReferencesPoint(c, point)));
  }

  function isPrimitiveCenterPoint(point) {
    return model.circles.some((circle) => circle.center === point) || model.arcs.some((arc) => arc.center === point);
  }

  function isStandalonePoint(point) {
    return isExplicitPoint(point) && !isPointUsedByPrimitive(point);
  }

  function hitPointByPredicate(x, y, predicate) {
    const radius = 10 / viewport.scale;
    for (let i = model.points.length - 1; i >= 0; i--) {
      const p = model.points[i];
      if (!isEditableSketchElement(p)) continue;
      if (!predicate(p)) continue;
      if (hypot2(p.x - x, p.y - y) <= radius) return p;
    }
    return null;
  }

  function hitEndpointPoint(x, y) {
    return hitPointByPredicate(x, y, (p) => ((isEndpointPoint(p) && isPointUsedByPrimitive(p) && (!isSplineOnlyFitPoint(p) || isEditableSplineFitPoint(p))) || isReferencePoint(p)));
  }

  function hitExplicitPoint(x, y) {
    return hitPointByPredicate(x, y, isExplicitPoint);
  }

  function hitAnyPoint(x, y) {
    return hitEndpointPoint(x, y) || hitExplicitPoint(x, y);
  }

  function hitPoint(x, y) {
    return hitAnyPoint(x, y);
  }

  function rectFromPoints(a, b) {
    return {
      x1: Math.min(a.x, b.x),
      y1: Math.min(a.y, b.y),
      x2: Math.max(a.x, b.x),
      y2: Math.max(a.y, b.y),
    };
  }

  function pointInRect(p, rect) {
    return p.x >= rect.x1 && p.x <= rect.x2 && p.y >= rect.y1 && p.y <= rect.y2;
  }

  function bboxInRect(box, rect) {
    return box.x1 >= rect.x1 && box.x2 <= rect.x2 && box.y1 >= rect.y1 && box.y2 <= rect.y2;
  }

  function bboxIntersectsRect(box, rect) {
    return box.x2 >= rect.x1 && box.x1 <= rect.x2 && box.y2 >= rect.y1 && box.y1 <= rect.y2;
  }

  function lineBBox(line) {
    return {
      x1: Math.min(line.p1.x, line.p2.x),
      y1: Math.min(line.p1.y, line.p2.y),
      x2: Math.max(line.p1.x, line.p2.x),
      y2: Math.max(line.p1.y, line.p2.y),
    };
  }

  function primitiveBBox(primitive) {
    const r = primitive.radius();
    return {
      x1: primitive.center.x - r,
      y1: primitive.center.y - r,
      x2: primitive.center.x + r,
      y2: primitive.center.y + r,
    };
  }

  function mergeBounds(bounds, box) {
    if (!box) return bounds;
    const x1 = box.x1 ?? box.left;
    const y1 = box.y1 ?? box.top;
    const x2 = box.x2 ?? box.right;
    const y2 = box.y2 ?? box.bottom;
    if (![x1, y1, x2, y2].every(Number.isFinite)) return bounds;
    if (!bounds) return { x1, y1, x2, y2 };
    return {
      x1: Math.min(bounds.x1, x1),
      y1: Math.min(bounds.y1, y1),
      x2: Math.max(bounds.x2, x2),
      y2: Math.max(bounds.y2, y2),
    };
  }

  function referenceImageLocalToWorld(image, point) {
    const cos = Math.cos(image.rotation);
    const sin = Math.sin(image.rotation);
    const x = point.x * image.scale;
    const y = point.y * image.scale;
    return { x: image.x + x * cos - y * sin, y: image.y + x * sin + y * cos };
  }

  function referenceImageWorldToLocal(image, point) {
    const cos = Math.cos(image.rotation);
    const sin = Math.sin(image.rotation);
    const dx = point.x - image.x;
    const dy = point.y - image.y;
    return { x: (dx * cos + dy * sin) / image.scale, y: (-dx * sin + dy * cos) / image.scale };
  }

  function referenceImageCorners(image) {
    const halfWidth = image.pixelWidth / 2;
    const halfHeight = image.pixelHeight / 2;
    return [
      referenceImageLocalToWorld(image, { x: -halfWidth, y: -halfHeight }),
      referenceImageLocalToWorld(image, { x: halfWidth, y: -halfHeight }),
      referenceImageLocalToWorld(image, { x: halfWidth, y: halfHeight }),
      referenceImageLocalToWorld(image, { x: -halfWidth, y: halfHeight }),
    ];
  }

  function referenceImageBounds(image) {
    const corners = referenceImageCorners(image);
    return {
      x1: Math.min(...corners.map((point) => point.x)),
      y1: Math.min(...corners.map((point) => point.y)),
      x2: Math.max(...corners.map((point) => point.x)),
      y2: Math.max(...corners.map((point) => point.y)),
    };
  }

  function sketchGeometryBounds(sketchId = activeSketchId()) {
    let bounds = null;
    for (const line of allGeometryLines()) {
      if (elementSketchId(line) === sketchId) bounds = mergeBounds(bounds, lineBBox(line));
    }
    for (const circle of allGeometryCircles()) {
      if (elementSketchId(circle) === sketchId) bounds = mergeBounds(bounds, primitiveBBox(circle));
    }
    for (const arc of allGeometryArcs()) {
      if (elementSketchId(arc) === sketchId) bounds = mergeBounds(bounds, primitiveBBox(arc));
    }
    for (const spline of allGeometrySplines()) {
      if (elementSketchId(spline) === sketchId) bounds = mergeBounds(bounds, splineBBox(spline));
    }
    for (const point of allGeometryPoints()) {
      if (elementSketchId(point) === sketchId) bounds = mergeBounds(bounds, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
    }
    for (const annotation of allAnnotations()) if (annotation.sketchId === sketchId) bounds = mergeBounds(bounds, annotationBounds(annotation));
    for (const hatch of allHatches()) if (hatch.sketchId === sketchId) bounds = mergeBounds(bounds, resolvedLoopBounds(resolvedHatchBoundary(hatch)));
    for (const image of model.referenceImages) if (image.sketchId === sketchId) bounds = mergeBounds(bounds, referenceImageBounds(image));
    return bounds;
  }

  function allGeometryBounds() {
    let bounds = null;
    for (const line of allGeometryLines()) bounds = mergeBounds(bounds, lineBBox(line));
    for (const circle of allGeometryCircles()) bounds = mergeBounds(bounds, primitiveBBox(circle));
    for (const arc of allGeometryArcs()) bounds = mergeBounds(bounds, primitiveBBox(arc));
    for (const spline of allGeometrySplines()) bounds = mergeBounds(bounds, splineBBox(spline));
    for (const point of allGeometryPoints()) bounds = mergeBounds(bounds, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
    for (const annotation of allAnnotations()) bounds = mergeBounds(bounds, annotationBounds(annotation));
    for (const hatch of allHatches()) bounds = mergeBounds(bounds, resolvedLoopBounds(resolvedHatchBoundary(hatch)));
    for (const image of model.referenceImages) bounds = mergeBounds(bounds, referenceImageBounds(image));
    return bounds;
  }

  function isVisibleOnCanvasGeometry(item) {
    return isVisibleSketchElement(item);
  }

  function visibleGeometryBounds() {
    let bounds = null;
    for (const line of allGeometryLines()) {
      if (isVisibleOnCanvasGeometry(line)) bounds = mergeBounds(bounds, lineBBox(line));
    }
    for (const circle of allGeometryCircles()) {
      if (isVisibleOnCanvasGeometry(circle)) bounds = mergeBounds(bounds, primitiveBBox(circle));
    }
    for (const arc of allGeometryArcs()) {
      if (isVisibleOnCanvasGeometry(arc)) bounds = mergeBounds(bounds, primitiveBBox(arc));
    }
    for (const spline of allGeometrySplines()) {
      if (isVisibleOnCanvasGeometry(spline)) bounds = mergeBounds(bounds, splineBBox(spline));
    }
    for (const point of allGeometryPoints()) {
      if (isVisibleOnCanvasGeometry(point)) bounds = mergeBounds(bounds, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
    }
    for (const annotation of allAnnotations()) if (annotation.visible !== false && isVisibleSketchId(annotation.sketchId)) bounds = mergeBounds(bounds, annotationBounds(annotation));
    for (const hatch of allHatches()) if (hatchAppearanceForDisplay(hatch).visible !== false && isVisibleSketchId(hatch.sketchId)) bounds = mergeBounds(bounds, resolvedLoopBounds(resolvedHatchBoundary(hatch)));
    for (const image of model.referenceImages) if (image.visible !== false && isVisibleSketchId(image.sketchId)) bounds = mergeBounds(bounds, referenceImageBounds(image));
    return bounds;
  }



  function fitSketchToViewport(sketchId = activeSketchId(), paddingPx = 96) {
    return fitBoundsToViewport(sketchGeometryBounds(sketchId), paddingPx);
  }

  function fitAllGeometryToViewport(paddingPx = 96) {
    return fitBoundsToViewport(allGeometryBounds(), paddingPx);
  }

  function fitVisibleGeometryToViewport(paddingPx = 96) {
    return fitBoundsToViewport(visibleGeometryBounds(), paddingPx);
  }



  function captureSketchScreenFootprint(sketchId = activeSketchId()) {
    const bounds = sketchGeometryBounds(sketchId);
    const screenBox = screenBoxForBounds(bounds);
    if (!bounds || !screenBox) return null;
    return {
      bounds,
      screenBox,
      center: {
        x: (screenBox.left + screenBox.right) / 2,
        y: (screenBox.top + screenBox.bottom) / 2,
      },
      width: Math.max(screenBox.right - screenBox.left, 1),
      height: Math.max(screenBox.bottom - screenBox.top, 1),
    };
  }

  function restoreSketchScreenFootprint(sketchId, footprint) {
    if (!footprint) return false;
    const bounds = sketchGeometryBounds(sketchId);
    if (!bounds) return false;
    const worldWidth = bounds.x2 - bounds.x1;
    const worldHeight = bounds.y2 - bounds.y1;
    const scaleCandidates = [];
    if (worldWidth > MIN_LINE_LENGTH) scaleCandidates.push(footprint.width / worldWidth);
    if (worldHeight > MIN_LINE_LENGTH) scaleCandidates.push(footprint.height / worldHeight);
    if (scaleCandidates.length === 0) return false;
    const nextScale = clampZoom(Math.min(...scaleCandidates));
    const centerX = (bounds.x1 + bounds.x2) / 2;
    const centerY = (bounds.y1 + bounds.y2) / 2;
    viewport.update({ scale: nextScale });
    viewport.update({ x: footprint.center.x - centerX * viewport.scale });
    viewport.update({ y: footprint.center.y - centerY * viewport.scale });
    return true;
  }

  function scalePointAbout(point, origin, scale) {
    point.x = origin.x + (point.x - origin.x) * scale;
    point.y = origin.y + (point.y - origin.y) * scale;
  }

  function scaleValueAbout(value, originValue, scale) {
    return originValue + (value - originValue) * scale;
  }

  function scaleDimensionAbout(dimension, origin, scale) {
    if (!dimension) return dimension;
    for (const key of ["x", "labelX"]) {
      if (Number.isFinite(dimension[key])) dimension[key] = scaleValueAbout(dimension[key], origin.x, scale);
    }
    for (const key of ["y", "labelY"]) {
      if (Number.isFinite(dimension[key])) dimension[key] = scaleValueAbout(dimension[key], origin.y, scale);
    }
    for (const key of ["offsetU", "offsetN", "labelOffsetU", "angleRadius", "angleLabelOffsetR", "angleLabelOffsetT"]) {
      if (Number.isFinite(dimension[key])) dimension[key] *= scale;
    }
    return dimension;
  }

  function currentTargetValue(target) {
    if (!target) return NaN;
    if (target.kind === "point-point") {
      if (target.dimensionAxis === "x") return Math.abs(target.p2.x - target.p1.x);
      if (target.dimensionAxis === "y") return Math.abs(target.p2.y - target.p1.y);
      return hypot2(target.p2.x - target.p1.x, target.p2.y - target.p1.y);
    }
    if (target.kind === "line-length") return target.line.length();
    if (target.kind === "point-line") return Math.abs(signedPointLineDistance(target.point, target.line));
    if (target.kind === "line-line") return Math.abs(signedPointLineDistance(target.line1.p1, target.line2));
    if (target.kind === "line-circle") return Math.abs(signedPointLineDistance(target.circle.center, target.line));
    if (target.kind === "radius-difference") return Math.abs(target.b.radius() - target.a.radius());
    if (target.kind === "radius") return target.primitive.radius();
    if (target.kind === "diameter") return target.primitive.radius() * 2;
    if (target.kind === "offset-distance") {
      if (target.source instanceof Line) return Math.abs(signedPointLineDistance(target.offset.p1, target.source));
      return Math.abs(target.offset.radius() - target.source.radius());
    }
    return target.value;
  }

  function sketchHasReferenceConstraint(sketchId = activeSketchId()) {
    return model.constraints.some((constraint) => constraintSketchId(constraint) === sketchId && constraint.reference);
  }

  function sketchHasFixedGeometry(sketchId = activeSketchId()) {
    if (model.points.some((point) => elementSketchId(point) === sketchId && point.fixed)) return true;
    return model.constraints.some((constraint) => constraintSketchId(constraint) === sketchId && (constraint instanceof LineFixedConstraint || constraint instanceof GeometryFixedConstraint));
  }

  function scaleSketchForFirstDimension(sketchId, target, targetValue, dimension) {
    if (!sketchId || target?.kind === "angle" || sketchHasReferenceConstraint(sketchId) || sketchHasFixedGeometry(sketchId)) return false;
    const current = currentTargetValue(target);
    if (!Number.isFinite(current) || current <= MIN_LINE_LENGTH || !Number.isFinite(targetValue) || targetValue <= 0) return false;
    const scale = targetValue / current;
    if (!Number.isFinite(scale) || scale <= 0 || Math.abs(scale - 1) < 1e-9) return false;
    const bounds = sketchGeometryBounds(sketchId);
    if (!bounds) return false;
    const origin = { x: (bounds.x1 + bounds.x2) / 2, y: (bounds.y1 + bounds.y2) / 2 };
    for (const point of model.points) {
      if (elementSketchId(point) === sketchId) scalePointAbout(point, origin, scale);
    }
    for (const circle of model.circles) {
      if (elementSketchId(circle) === sketchId) circle.radiusValue = Math.max(MIN_LINE_LENGTH, circle.radiusValue * scale);
    }
    for (const arc of model.arcs) {
      if (elementSketchId(arc) === sketchId) arc.radiusValue = Math.max(MIN_LINE_LENGTH, arc.radiusValue * scale);
    }
    scaleDimensionAbout(dimension, origin, scale);
    return true;
  }

  function arcEndpointDragValue(arc, endpoint, rawAngle) {
    const twoPi = Math.PI * 2;
    const maxSweep = twoPi - 1e-6;
    const prop = endpoint === "start" ? "startAngle" : "endAngle";
    const value = unwrapAngleNear(rawAngle, arc[prop]);
    const sweep = endpoint === "start" ? arc.endAngle - value : value - arc.startAngle;
    if (Math.abs(sweep) >= maxSweep) {
      // Stay on the same angular branch at the almost-full-circle boundary.
      // Returning the opposite endpoint collapses the sweep to zero and makes
      // a small pointer crossing jump most of the circumference.
      const direction = sweep < 0 ? -1 : 1;
      return endpoint === "start"
        ? arc.endAngle - direction * maxSweep
        : arc.startAngle + direction * maxSweep;
    }
    return value;
  }


  function findArcEndpointFixedConstraint(arc, endpoint) {
    return model.constraints.find((c) => c.enabled !== false && c instanceof ArcEndpointFixedConstraint && sameConstraintDisplayElement(c.arc, arc) && c.endpoint === endpoint);
  }

  function findLineFixedConstraint(line) {
    return model.constraints.find((c) => c.enabled !== false && c instanceof LineFixedConstraint && sameConstraintDisplayElement(c.line, line));
  }

  function pointLockedByLineFixed(point) {
    return model.constraints.some((c) => c.enabled !== false && c instanceof LineFixedConstraint && (c.line.p1 === point || c.line.p2 === point));
  }

  function hitLine(x, y) {
    const threshold = 7 / viewport.scale;
    const lines = model.lines.slice().sort((a, b) => (normalizedDrawingOrder(b.drawingOrder) ?? 0) - (normalizedDrawingOrder(a.drawingOrder) ?? 0));
    for (const l of lines) {
      if (!isEditableSketchElement(l)) continue;
      if (distancePointToSegment(x, y, l) <= threshold) return l;
    }
    return null;
  }

  function hitCircle(x, y) {
    const threshold = 7 / viewport.scale;
    const circles = model.circles.slice().sort((a, b) => (normalizedDrawingOrder(b.drawingOrder) ?? 0) - (normalizedDrawingOrder(a.drawingOrder) ?? 0));
    for (const c of circles) {
      if (!isEditableSketchElement(c)) continue;
      const d = hypot2(x - c.center.x, y - c.center.y);
      if (Math.abs(d - c.radius()) <= threshold) return c;
    }
    return null;
  }

  function hitArc(x, y) {
    const threshold = 7 / viewport.scale;
    const arcs = model.arcs.slice().sort((a, b) => (normalizedDrawingOrder(b.drawingOrder) ?? 0) - (normalizedDrawingOrder(a.drawingOrder) ?? 0));
    for (const a of arcs) {
      if (!isEditableSketchElement(a)) continue;
      const radius = a.radius();
      const d = hypot2(x - a.center.x, y - a.center.y);
      if (Math.abs(d - radius) > threshold) continue;
      const angle = Math.atan2(y - a.center.y, x - a.center.x);
      if (angleOnSignedSweep(angle, a.startAngle, a.endAngle)) return a;
    }
    return null;
  }

  function hitArcEndpoint(x, y) {
    const threshold = 10 / viewport.scale;
    for (let i = model.arcs.length - 1; i >= 0; i--) {
      const arc = model.arcs[i];
      if (!isEditableSketchElement(arc)) continue;
      for (const endpoint of ["end", "start"]) {
        const point = arcEndpointPoint(arc, endpoint);
        if (hypot2(point.x - x, point.y - y) <= threshold) return { arc, endpoint, point };
      }
    }
    return null;
  }

  function samePosition(a, b, tolerance = 1e-9) {
    return Boolean(a && b && hypot2(a.x - b.x, a.y - b.y) <= tolerance);
  }

  function addConstraintIfMissing(constraint, matches, options = {}) {
    if (!constraint) return false;
    if (model.constraints.some((c) => c.enabled !== false && matches(c))) return false;
    const sketchId = options.sketchId || activeSketchId();
    if (options.referenceSketchId) {
      if (!isReferenceSourceSketchId(options.referenceSketchId, sketchId) || wouldCreateReferenceCycle(sketchId, options.referenceSketchId)) return false;
      markReferenceConstraint(constraint, options.referenceSketchId, sketchId);
    }
    pushModelConstraint(constraint, sketchId);
    const duplicate = redundantConstraintInfo(constraint, constraintSketchId(constraint));
    if (duplicate?.redundant) {
      model.constraints = model.constraints.filter((item) => item !== constraint);
      constraintRedundancyState.constraints.delete(constraint);
      return false;
    }
    return true;
  }

  function hitDimension(x, y, { activeOnly = true } = {}) {
    const threshold = 12 / viewport.scale;
    for (let i = model.constraints.length - 1; i >= 0; i--) {
      const constraint = model.constraints[i];
      if (activeOnly && !isActiveSketchConstraint(constraint)) continue;
      if (!isVisibleSketchId(constraintSketchId(constraint))) continue;
      const target = targetFromConstraint(constraint);
      if (!target) continue;
      const dimension = constraint.dimension || defaultDimensionForTarget(target);
      if (!viewState.constraintStatus && effectiveDimensionAppearance(dimension, constraintSketchId(constraint)).visible === false) continue;
      const layout = dimensionLayout(target, dimension);
      if (!layout) continue;
      if (hypot2(x - layout.text.x, y - layout.text.y) <= threshold * 2.2) {
        return { constraint, target, dimension, part: "label" };
      }
      if (distancePointToSegmentPoints(x, y, layout.hitA, layout.hitB) <= threshold * 1.4) {
        return { constraint, target, dimension, part: "line" };
      }
    }
    return null;
  }

  function primitiveId(primitive) {
    return primitive?.id || "";
  }

  function isPrimitive(item) {
    return item instanceof Circle || item instanceof Arc;
  }


  function distanceTargetFromSelection() {
    return distanceTargetFromTargets(currentConstraintTargets());
  }

  function hitBlockInstance(x, y, editableOnly = true) {
    const threshold = 8 / viewport.scale;
    const instances = model.blockInstances.slice().sort((a, b) => (normalizedDrawingOrder(b.drawingOrder) ?? 0) - (normalizedDrawingOrder(a.drawingOrder) ?? 0));
    for (const instance of instances) {
      if (editableOnly && !isEditableSketchId(instance.sketchId)) continue;
      if (!isVisibleSketchId(instance.sketchId)) continue;
      const bundle = blockProjectionBundle(instance);
      if (bundle.points.some((point) => hypot2(point.x - x, point.y - y) <= threshold)) return instance;
      if (bundle.lines.some((line) => distancePointToSegment(x, y, line) <= threshold)) return instance;
      if (bundle.circles.some((circle) => Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold)) return instance;
      if (bundle.arcs.some((arc) => Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(Math.atan2(y - arc.center.y, x - arc.center.x), arc.startAngle, arc.endAngle))) return instance;
      if ((bundle.splines || []).some((spline) => window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 })?.distance <= threshold)) return instance;
      if ((bundle.annotations || []).some((annotation) => {
        const bounds = annotationBounds(annotation);
        return bounds && x >= bounds.x1 - threshold && x <= bounds.x2 + threshold && y >= bounds.y1 - threshold && y <= bounds.y2 + threshold;
      })) return instance;
      if ((bundle.hatches || []).some((hatch) => {
        const resolved = resolvedHatchBoundary(hatch);
        return resolved.ok && hatchAppearanceForDisplay(hatch).visible !== false && hatchContainsSelectablePoint(hatch, resolved, { x, y });
      })) return instance;
    }
    return null;
  }

  function hitBlockRotationHandle(x, y) {
    return null;
  }

  function geometryBundleHit(bundle, x, y, threshold = 8 / viewport.scale) {
    if (bundle.points.some((point) => hypot2(point.x - x, point.y - y) <= threshold)) return true;
    if (bundle.lines.some((line) => distancePointToSegment(x, y, line) <= threshold)) return true;
    if (bundle.circles.some((circle) => Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold)) return true;
    if (bundle.arcs.some((arc) => Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(Math.atan2(y - arc.center.y, x - arc.center.x), arc.startAngle, arc.endAngle))) return true;
    return bundle.splines.some((spline) => window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 })?.distance <= threshold);
  }

  function hitGeometryInstance(x, y, editableOnly = true) {
    const bundles = geometryInstanceBundles().slice().sort((a, b) => (normalizedDrawingOrder(b.instance.drawingOrder) ?? 0) - (normalizedDrawingOrder(a.instance.drawingOrder) ?? 0));
    for (const bundle of bundles) {
      if (editableOnly && !isEditableSketchId(bundle.instance.sketchId)) continue;
      if (isVisibleSketchId(bundle.instance.sketchId) && geometryBundleHit(bundle, x, y)) return bundle.instance;
    }
    return null;
  }

  function hitDerivedGeometryForDrag(x, y) {
    const threshold = 7 / viewport.scale;
    const pointThreshold = 10 / viewport.scale;
    const bundles = geometryInstanceBundles().slice().sort((a, b) => (normalizedDrawingOrder(b.instance.drawingOrder) ?? 0) - (normalizedDrawingOrder(a.instance.drawingOrder) ?? 0));
    for (const bundle of bundles) {
      if (!isEditableSketchId(bundle.instance.sketchId) || !isVisibleSketchId(bundle.instance.sketchId)) continue;
      for (const point of bundle.points.slice().reverse()) {
        if (hypot2(point.x - x, point.y - y) <= pointThreshold) return { kind: "point", item: point, instance: bundle.instance };
      }
      for (const arc of bundle.arcs.slice().reverse()) {
        for (const endpoint of ["end", "start"]) {
          const point = arcEndpointPoint(arc, endpoint);
          if (hypot2(point.x - x, point.y - y) <= pointThreshold) return { kind: "arc-endpoint", item: arc, endpoint, instance: bundle.instance };
        }
      }
      for (const line of bundle.lines.slice().reverse()) {
        if (distancePointToSegment(x, y, line) <= threshold) return { kind: "line", item: line, instance: bundle.instance };
      }
      for (const circle of bundle.circles.slice().reverse()) {
        if (Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold) return { kind: "circle", item: circle, instance: bundle.instance };
      }
      for (const arc of bundle.arcs.slice().reverse()) {
        const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
        if (Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return { kind: "arc", item: arc, instance: bundle.instance };
      }
      for (const spline of bundle.splines.slice().reverse()) {
        const closest = window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 });
        if (closest?.distance <= threshold) return { kind: "spline", item: spline, instance: bundle.instance };
      }
    }
    return null;
  }

  function hitDerivedProjectionOperand(x, y) {
    const threshold = 8 / viewport.scale;
    const pointThreshold = 10 / viewport.scale;
    for (const bundle of geometryInstanceBundles().slice().reverse()) {
      if (!isVisibleSketchId(bundle.instance.sketchId) || !operandRelationForSketch(bundle.instance.sketchId)) continue;
      for (const point of bundle.points.slice().reverse()) if (hypot2(point.x - x, point.y - y) <= pointThreshold) return makeConstraintOperand("point", { point });
      for (const line of bundle.lines.slice().reverse()) if (distancePointToSegment(x, y, line) <= threshold) return makeConstraintOperand("line", { line });
      for (const primitive of [...bundle.circles, ...bundle.arcs].reverse()) {
        const angle = Math.atan2(y - primitive.center.y, x - primitive.center.x);
        if (Math.abs(hypot2(x - primitive.center.x, y - primitive.center.y) - primitive.radius()) <= threshold && (!(primitive instanceof Arc) || angleOnSignedSweep(angle, primitive.startAngle, primitive.endAngle))) return makeConstraintOperand("primitive", { primitive, hitPoint: circlePointAtPointer({ x, y }, primitive) });
      }
      for (const spline of bundle.splines.slice().reverse()) {
        const closest = window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 });
        if (closest?.distance <= threshold) return makeConstraintOperand("spline", { spline, parameter: closest.t });
      }
    }
    return null;
  }

  function hitBlockProjectionOperand(x, y) {
    const threshold = 8 / viewport.scale;
    const pointThreshold = 10 / viewport.scale;
    for (const bundle of blockProjectionBundles().slice().reverse()) {
      if (!isVisibleSketchId(bundle.instance.sketchId)) continue;
      const relation = operandRelationForSketch(bundle.instance.sketchId);
      if (!relation) continue;
      for (const point of bundle.points.slice().reverse()) {
        if (hypot2(point.x - x, point.y - y) <= pointThreshold) return makeConstraintOperand("point", { point });
      }
      for (const line of bundle.lines.slice().reverse()) {
        if (distancePointToSegment(x, y, line) <= threshold) return makeConstraintOperand("line", { line });
      }
      for (const circle of bundle.circles.slice().reverse()) {
        if (Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold) return makeConstraintOperand("primitive", { primitive: circle, hitPoint: circlePointAtPointer({ x, y }, circle) });
      }
      for (const arc of bundle.arcs.slice().reverse()) {
        for (const endpoint of ["start", "end"]) {
          const point = arcEndpointPoint(arc, endpoint);
          if (hypot2(point.x - x, point.y - y) <= pointThreshold) return makeConstraintOperand("arc-endpoint", { arc, endpoint });
        }
        const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
        if (Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return makeConstraintOperand("primitive", { primitive: arc, hitPoint: circlePointAtPointer({ x, y }, arc) });
      }
      for (const spline of (bundle.splines || []).slice().reverse()) {
        const closest = window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 });
        if (closest?.distance <= threshold) return makeConstraintOperand("spline", { spline, parameter: closest.t });
      }
    }
    return null;
  }



















  function measuredConstraintTargetValue(constraint, target = targetFromConstraint(constraint), dimension = constraint?.dimension) {
    if (!target) return NaN;
    const measured = measuredDimensionValue(target, dimension);
    return target.kind === "angle" ? (measured * Math.PI) / 180 : measured;
  }

  function dimensionLabelForConstraint(constraint, target, dimension) {
    const readOnly = isReadOnlyDimension(constraint);
    const value = readOnly ? measuredDimensionValue(target, dimension) : target.kind === "angle" ? angleDegrees(constraint.target) : constraint.target;
    const formatLabel = readOnly ? formatMeasuredDimensionLabel : formatDimensionLabel;
    const display = dimensionDisplayState(dimension, constraintSketchId(constraint));
    const number = display.precision == null ? formatLabel(value) : Number(value).toFixed(display.precision);
    const unit = target.kind === "angle" ? "°" : "";
    const tolerance = display.toleranceUpper !== "" || display.toleranceLower !== ""
      ? ` +${display.toleranceUpper === "" ? "0" : display.toleranceUpper}/-${display.toleranceLower === "" ? "0" : Math.abs(Number(display.toleranceLower))}`
      : "";
    const label = `${display.prefix}${number}${unit}${display.suffix}${tolerance}`;
    return readOnly ? `(${label})` : label;
  }

  function constraintDefiningGeometryEntries(constraint) {
    if (!constraint) return [];
    if (constraint instanceof OffsetChainConstraint) {
      return [
        ...constraint.sources.map((item, index) => ({ key: `source${index}`, labelJa: `基準図形${index + 1} ID`, labelEn: `Source geometry ${index + 1} ID`, item })),
        ...constraint.offsets.map((item, index) => ({ key: `offset${index}`, labelJa: `オフセット図形${index + 1} ID`, labelEn: `Offset geometry ${index + 1} ID`, item })),
      ];
    }
    const roles = [
      ["p1", "1つ目の点ID", "First point ID"],
      ["p2", "2つ目の点ID", "Second point ID"],
      ["point", "点ID", "Point ID"],
      ["line", "線ID", "Line ID"],
      ["circle", "円ID", "Circle ID"],
      ["line1", "1本目の線ID", "First line ID"],
      ["line2", "2本目の線ID", "Second line ID"],
      ["centerline", "中心線ID", "Centerline ID"],
      ["arc1", "1つ目の円弧ID", "First arc ID"],
      ["arc2", "2つ目の円弧ID", "Second arc ID"],
      ["source", "基準図形ID", "Source geometry ID"],
      ["target", "投影先図形ID", "Target geometry ID"],
      ["offset", "オフセット図形ID", "Offset geometry ID"],
      ["arc", "円弧ID", "Arc ID"],
      ["primitive", "図形ID", "Geometry ID"],
      ["geometry", "図形ID", "Geometry ID"],
      ["spline", "スプラインID", "Spline ID"],
      ["a", "1つ目の図形ID", "First geometry ID"],
      ["b", "2つ目の図形ID", "Second geometry ID"],
      ["axis", "対称軸ID", "Symmetry axis ID"],
    ];
    return roles
      .map(([key, labelJa, labelEn]) => ({ key, labelJa, labelEn, item: constraint[key] }))
      .filter(({ item }) => item instanceof Point || item instanceof Line || item instanceof Circle || item instanceof Arc || item instanceof Spline);
  }

  function constraintHighlightNodes(constraint) {
    const entries = constraintDefiningGeometryEntries(constraint);
    const directPoints = new Set(entries.map(({ item }) => item).filter((item) => item instanceof Point));
    const lineEndpoints = new Set();
    for (const { item } of entries) {
      if (!(item instanceof Line)) continue;
      lineEndpoints.add(item.p1);
      lineEndpoints.add(item.p2);
    }
    return constraintGraphNodes(constraint).filter((item) => !lineEndpoints.has(item) || directPoints.has(item));
  }

  function addIntrinsicGraphEdges(adjacency, a, b) {
    if (!a || !b) return;
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a).add(b);
    adjacency.get(b).add(a);
  }

  function buildConstraintAdjacency() {
    const adjacency = new Map();
    for (const p of allGeometryPoints()) {
      if (!adjacency.has(p)) adjacency.set(p, new Set());
      if (p.blockInstance) addIntrinsicGraphEdges(adjacency, p, p.blockInstance);
      if (p.derivedInstance) addIntrinsicGraphEdges(adjacency, p, p.derivedInstance);
    }
    for (const line of allGeometryLines()) {
      addIntrinsicGraphEdges(adjacency, line, line.p1);
      addIntrinsicGraphEdges(adjacency, line, line.p2);
      if (line.blockInstance) addIntrinsicGraphEdges(adjacency, line, line.blockInstance);
      if (line.derivedInstance) addIntrinsicGraphEdges(adjacency, line, line.derivedInstance);
    }
    for (const circle of allGeometryCircles()) {
      addIntrinsicGraphEdges(adjacency, circle, circle.center);
      if (circle.blockInstance) addIntrinsicGraphEdges(adjacency, circle, circle.blockInstance);
      if (circle.derivedInstance) addIntrinsicGraphEdges(adjacency, circle, circle.derivedInstance);
    }
    for (const arc of allGeometryArcs()) {
      addIntrinsicGraphEdges(adjacency, arc, arc.center);
      if (arc.blockInstance) addIntrinsicGraphEdges(adjacency, arc, arc.blockInstance);
      if (arc.derivedInstance) addIntrinsicGraphEdges(adjacency, arc, arc.derivedInstance);
    }
    for (const spline of allGeometrySplines()) {
      for (const point of spline.fitPoints) addIntrinsicGraphEdges(adjacency, spline, point);
      if (spline.blockInstance) addIntrinsicGraphEdges(adjacency, spline, spline.blockInstance);
      if (spline.derivedInstance) addIntrinsicGraphEdges(adjacency, spline, spline.derivedInstance);
    }
    for (const instance of model.geometryInstances) {
      if (!adjacency.has(instance)) adjacency.set(instance, new Set());
      for (const ref of geometryInstanceDependencyRefs(instance)) addIntrinsicGraphEdges(adjacency, instance, resolveGeometryRef(ref));
    }

    for (const constraint of model.constraints) {
      if (!constraintIsOperational(constraint)) continue;
      const nodes = constraintGraphNodes(constraint);
      for (const node of nodes) {
        if (!adjacency.has(node)) adjacency.set(node, new Set());
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) addIntrinsicGraphEdges(adjacency, nodes[i], nodes[j]);
      }
    }
    return adjacency;
  }

  function connectedComponentFromSeeds(seeds) {
    const adjacency = buildConstraintAdjacency();
    const seen = new Set();
    const queue = [];
    for (const seed of seeds) {
      if (!seed || seen.has(seed)) continue;
      seen.add(seed);
      queue.push(seed);
    }
    while (queue.length > 0) {
      const node = queue.shift();
      // A fixed point is a kinematic boundary: it contributes a constant to
      // constraints on either side, but motion cannot propagate through it to
      // otherwise independent geometry. Stopping here keeps large anchored
      // sketches local during interactive dragging.
      if (node instanceof Point && node.fixed) continue;
      for (const next of adjacency.get(node) || []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    return seen;
  }

  function localSolveVariables(component, sketchId = activeSketchId()) {
    const vars = [];
    for (const instance of model.geometryInstances) {
      if (instance.type !== "free" || instance.sketchId !== sketchId || !component.has(instance)) continue;
      for (const prop of ["x", "y", "rotation"]) vars.push({ object: instance, prop, label: `${instance.id}.${prop}` });
    }
    for (const p of model.points) {
      if (!isVisibleSketchElement(p)) continue;
      if (component.has(p) && elementSketchId(p) === sketchId && !p.fixed) {
        vars.push({ object: p, prop: "x", label: `${p.id}.x` });
        vars.push({ object: p, prop: "y", label: `${p.id}.y` });
      }
    }
    for (const c of model.circles) {
      if (component.has(c) && elementSketchId(c) === sketchId) vars.push({ object: c, prop: "radiusValue", label: `${c.id}.r`, min: MIN_LINE_LENGTH });
    }
    for (const a of model.arcs) {
      if (component.has(a) && elementSketchId(a) === sketchId) {
        vars.push({ object: a, prop: "radiusValue", label: `${a.id}.r`, min: MIN_LINE_LENGTH });
        vars.push({ object: a, prop: "startAngle", label: `${a.id}.startAngle` });
        vars.push({ object: a, prop: "endAngle", label: `${a.id}.endAngle` });
      }
    }
    for (const instance of model.blockInstances) {
      if (!component.has(instance) || instance.sketchId !== sketchId || instance.fixed) continue;
      vars.push({ object: instance, prop: "x", label: `${instance.id}.x` });
      vars.push({ object: instance, prop: "y", label: `${instance.id}.y` });
      if (!instance.rotationLocked) vars.push({ object: instance, prop: "rotation", label: `${instance.id}.rotation` });
    }
    return vars;
  }

  function localSolveConstraints(component, sketchId = activeSketchId()) {
    return model.constraints.filter((constraint) =>
      constraintIsOperational(constraint)
      && constraintSketchId(constraint) === sketchId
      && constraintGraphNodes(constraint).some((node) => component.has(node) && !(node instanceof Point && node.fixed)),
    );
  }

  function localSolveLines(component, sketchId = activeSketchId()) {
    return model.lines.filter((line) => component.has(line) && elementSketchId(line) === sketchId);
  }

  function sketchSolveVariables(sketchId = activeSketchId()) {
    const vars = [];
    for (const instance of model.geometryInstances) {
      if (instance.type !== "free" || instance.sketchId !== sketchId) continue;
      for (const prop of ["x", "y", "rotation"]) vars.push({ object: instance, prop, label: `${instance.id}.${prop}` });
    }
    for (const p of model.points) {
      if (elementSketchId(p) === sketchId && !p.fixed) {
        vars.push({ object: p, prop: "x", label: `${p.id}.x` });
        vars.push({ object: p, prop: "y", label: `${p.id}.y` });
      }
    }
    for (const c of model.circles) {
      if (elementSketchId(c) === sketchId) vars.push({ object: c, prop: "radiusValue", label: `${c.id}.r`, min: MIN_LINE_LENGTH });
    }
    for (const a of model.arcs) {
      if (elementSketchId(a) === sketchId) {
        vars.push({ object: a, prop: "radiusValue", label: `${a.id}.r`, min: MIN_LINE_LENGTH });
        vars.push({ object: a, prop: "startAngle", label: `${a.id}.startAngle` });
        vars.push({ object: a, prop: "endAngle", label: `${a.id}.endAngle` });
      }
    }
    for (const instance of model.blockInstances) {
      if (instance.sketchId !== sketchId || instance.fixed) continue;
      vars.push({ object: instance, prop: "x", label: `${instance.id}.x` });
      vars.push({ object: instance, prop: "y", label: `${instance.id}.y` });
      if (!instance.rotationLocked) vars.push({ object: instance, prop: "rotation", label: `${instance.id}.rotation` });
    }
    return vars;
  }

  function sketchSolveConstraints(sketchId = activeSketchId()) {
    return model.constraints.filter((constraint) => constraintIsOperational(constraint) && constraintSketchId(constraint) === sketchId);
  }

  function sketchSolveLines(sketchId = activeSketchId()) {
    return model.lines.filter((line) => elementSketchId(line) === sketchId);
  }

  function solveActiveSketch(extra = []) {
    const sketchId = activeSketchId();
    synchronizeSketchProjectionMetadata(sketchId);
    return solver.solveSubset({
      variables: sketchSolveVariables(sketchId),
      constraints: sketchSolveConstraints(sketchId),
      lines: sketchSolveLines(sketchId),
      extra,
    });
  }

  function solveSketchById(sketchId, extra = [], variableAllowed = null) {
    synchronizeSketchProjectionMetadata(sketchId);
    return solver.solveSubset({
      variables: variableAllowed ? sketchSolveVariables(sketchId).filter(variableAllowed) : sketchSolveVariables(sketchId),
      constraints: sketchSolveConstraints(sketchId),
      lines: sketchSolveLines(sketchId),
      extra,
    });
  }

  function solveDragSketch(session, extra = []) {
    return solveSketchById(session?.sketchId || activeSketchId(), extra, session?.variableAllowed);
  }

  function solveFinalDragSession(session) {
    if (!interactionProfiler.active) return solveFinalDragSessionUnprofiled(session);
    return profileInteractionWork("solve", () => solveFinalDragSessionUnprofiled(session));
  }

  function solveFinalDragSessionUnprofiled(session) {
    if (session?.projectionShapeLocked) return sketchProjectionBlockedDragResult();
    const extra = session?.finalDragConstraints || [];
    if (session?.lastGuidedPreviewError > CONSTRAINT_ACCEPT_ERROR) {
      // Mouse-up is allowed a larger local iteration budget than an animation
      // frame. This removes accumulated preview error without invoking the
      // much heavier full-sketch solve for an otherwise isolated component.
      const localResult = withSolverMaxIterations(100, () => solveLocalDrag(session, []));
      if (localResult) {
        const baseErrorNorm = vectorNorm(solver.computeErrorVectorForConstraints(sketchSolveConstraints(session?.sketchId || activeSketchId())));
        localResult.baseErrorNorm = baseErrorNorm;
        localResult.localFinalCorrection = true;
        if (localResult.success || baseErrorNorm <= CONSTRAINT_ACCEPT_ERROR) {
          localResult.success = true;
          return localResult;
        }
      }
      const result = solveDragSketch(session);
      result.guidedFinalFallback = true;
      return result;
    }
    const variables = sketchSolveVariables(session?.sketchId || activeSketchId());
    const state = solver.clone(variables);
    const guidedResult = solveDragSketch(session, extra);
    if (guidedResult.success || guidedResult.errorNorm <= CONSTRAINT_ACCEPT_ERROR) {
      if (!guidedResult.success) guidedResult.acceptedAtDragTolerance = true;
      guidedResult.success = true;
      return guidedResult;
    }
    solver.restore(state);
    const fallbackResult = solveDragSketch(session);
    fallbackResult.guidedFinalFallback = true;
    if (!fallbackResult.success && fallbackResult.errorNorm <= CONSTRAINT_ACCEPT_ERROR) {
      fallbackResult.acceptedAtDragTolerance = true;
      fallbackResult.success = true;
    }
    return fallbackResult;
  }

  function solveReferenceDependentSketches(rootSketchId) {
    if (!interactionProfiler.active) return solveReferenceDependentSketchesUnprofiled(rootSketchId);
    return profileInteractionWork("dependencies", () => solveReferenceDependentSketchesUnprofiled(rootSketchId));
  }

  function solveReferenceDependentSketchesUnprofiled(rootSketchId) {
    refreshReferenceConstraintValidity();
    const results = [];
    const dependentsBySource = new Map();
    const addDependency = (sourceSketchId, dependentSketchId) => {
      if (!sourceSketchId || !dependentSketchId || sourceSketchId === dependentSketchId) return;
      if (!dependentsBySource.has(sourceSketchId)) dependentsBySource.set(sourceSketchId, new Set());
      dependentsBySource.get(sourceSketchId).add(dependentSketchId);
    };
    for (const constraint of model.constraints) {
      if (!constraintIsOperational(constraint) || !constraint.reference || !constraint.referenceSketchId) continue;
      const dependentSketchId = constraintSketchId(constraint);
      addDependency(constraint.referenceSketchId, dependentSketchId);
    }
    for (const bundle of geometryInstanceBundles()) {
      if (!bundle.valid) continue;
      const outputs = [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...bundle.splines];
      for (const source of new Set(outputs.map((item) => item.sourceElement).filter(Boolean))) {
        addDependency(elementSketchId(source), bundle.instance.sketchId);
      }
    }

    const affected = new Set([rootSketchId]);
    const pending = [rootSketchId];
    while (pending.length > 0) {
      const sourceSketchId = pending.shift();
      for (const dependentSketchId of dependentsBySource.get(sourceSketchId) || []) {
        if (affected.has(dependentSketchId)) continue;
        affected.add(dependentSketchId);
        pending.push(dependentSketchId);
      }
    }

    const indegree = new Map([...affected].map((sketchId) => [sketchId, 0]));
    for (const [sourceSketchId, dependents] of dependentsBySource) {
      if (!affected.has(sourceSketchId)) continue;
      for (const dependentSketchId of dependents) {
        if (affected.has(dependentSketchId)) indegree.set(dependentSketchId, (indegree.get(dependentSketchId) || 0) + 1);
      }
    }
    const orderIndex = new Map(orderedSketches().map((sketch, index) => [sketch.id, index]));
    const ready = [...affected]
      .filter((sketchId) => (indegree.get(sketchId) || 0) === 0)
      .sort((a, b) => (orderIndex.get(a) ?? Infinity) - (orderIndex.get(b) ?? Infinity));
    const processed = new Set();
    while (ready.length > 0) {
      const sketchId = ready.shift();
      if (processed.has(sketchId)) continue;
      processed.add(sketchId);
      if (sketchId !== rootSketchId) {
        clearSketchSolveState(sketchId);
        const result = solveSketchById(sketchId);
        normalizeArcSweeps();
        const status = resultIsAccepted(result) ? "ok" : "error";
        if (status === "ok") setSketchSolveOk(sketchId, result, rootSketchId);
        else setSketchSolveError(sketchId, result, rootSketchId);
        results.push({ sketchId, result, status });
      }
      for (const dependentSketchId of dependentsBySource.get(sketchId) || []) {
        if (!affected.has(dependentSketchId)) continue;
        indegree.set(dependentSketchId, (indegree.get(dependentSketchId) || 0) - 1);
        if (indegree.get(dependentSketchId) === 0) {
          ready.push(dependentSketchId);
          ready.sort((a, b) => (orderIndex.get(a) ?? Infinity) - (orderIndex.get(b) ?? Infinity));
        }
      }
    }

    for (const sketchId of affected) {
      if (sketchId === rootSketchId || processed.has(sketchId)) continue;
      const result = { success: false, errorNorm: Infinity, iterations: 0, reason: "循環参照" };
      setSketchSolveError(sketchId, result, rootSketchId);
      results.push({ sketchId, result, status: "error" });
    }
    const failed = results.find((entry) => entry.status === "error");
    return { success: !failed, sketchId: failed?.sketchId || null, result: failed?.result || null, results };
  }

  function solveSketchAndDependents(sketchId = activeSketchId(), rollbackState = null, variableAllowed = null) {
    refreshReferenceConstraintValidity();
    clearSketchSolveState(sketchId);
    const result = solveSketchById(sketchId, [], variableAllowed);
    normalizeArcSweeps();
    if (!resultIsAccepted(result)) {
      if (rollbackState) {
        restoreModelState(rollbackState);
        clearSketchSolveState(sketchId);
      } else {
        setSketchSolveError(sketchId, result, sketchId);
      }
      return { success: false, sketchId, result, dependent: { success: true, results: [] } };
    }
    setSketchSolveOk(sketchId, result, sketchId);
    const dependent = solveReferenceDependentSketches(sketchId);
    return { success: true, sketchId, result, dependent };
  }

  function solveConstraintComponentAndDependents(constraint, rollbackState = null) {
    const sketchId = constraintSketchId(constraint);
    refreshReferenceConstraintValidity();
    clearSketchSolveState(sketchId);
    const context = localSolveContextFromSeeds(constraintGraphNodes(constraint), sketchId);
    let result = solver.solveSubset(context);
    normalizeArcSweeps();
    const globalConstraints = sketchSolveConstraints(sketchId);
    const globalErrorAfterLocal = vectorNorm(solver.computeErrorVectorForConstraints(globalConstraints));
    let fullFallback = false;
    if (resultIsAccepted(result) && globalErrorAfterLocal > CONSTRAINT_ACCEPT_ERROR) {
      result = solveSketchById(sketchId);
      normalizeArcSweeps();
      result.localErrorNorm = globalErrorAfterLocal;
      result.fullFallback = true;
      fullFallback = true;
    }
    if (!resultIsAccepted(result)) {
      if (rollbackState) {
        restoreModelState(rollbackState);
        clearSketchSolveState(sketchId);
      } else {
        setSketchSolveError(sketchId, result, sketchId);
      }
      return { success: false, sketchId, result, dependent: { success: true, results: [] }, local: !fullFallback, fullFallback };
    }
    setSketchSolveOk(sketchId, result, sketchId);
    const dependent = solveReferenceDependentSketches(sketchId);
    return { success: true, sketchId, result, dependent, local: !fullFallback, fullFallback };
  }

  function solveElementSketchAndDescendants(element, rollbackState = null) {
    return solveSketchAndDependents(elementSketchId(element), rollbackState);
  }

  function localSolveContextFromSeeds(seeds, sketchId = activeSketchId()) {
    const component = connectedComponentFromSeeds(seeds);
    return {
      component,
      variables: localSolveVariables(component, sketchId),
      constraints: localSolveConstraints(component, sketchId),
      lines: localSolveLines(component, sketchId),
    };
  }

  function removeFromArray(array, item) {
    const i = array.indexOf(item);
    if (i >= 0) array.splice(i, 1);
  }

  function geometryInstanceUsesRemovedGeometry(instance, removedKeys = new Set(), removedOwnerIds = new Set()) {
    return geometryInstanceDependencyRefs(instance).some((ref) => removedKeys.has(geometryRefKey(ref)) || removedOwnerIds.has(ref.path?.[0]));
  }

  function rejectReferencedGeometryDeletion(instances, label) {
    if (instances.length === 0) return false;
    const ids = instances.map((instance) => instance.id).join(", ");
    const message = applicationText(`削除できません: ${label} は派生インスタンス ${ids} から参照されています。先に依存インスタンスを削除してください`, `Cannot delete ${label}; it is referenced by derived instance(s) ${ids}. Delete the dependent instance(s) first.`);
    setHint(message, "error");
    log(message);
    return true;
  }

  function deleteElements({ points = [], lines = [], circles = [], arcs = [], splines = [], constraints = [] } = {}) {
    const pointSet = new Set(points);
    const lineSet = new Set(lines);
    const circleSet = new Set(circles);
    const arcSet = new Set(arcs);
    const splineSet = new Set(splines);
    const constraintSet = new Set(constraints);

    for (const line of model.lines) {
      if (pointSet.has(line.p1) || pointSet.has(line.p2)) lineSet.add(line);
    }

    for (const circle of model.circles) {
      if (pointSet.has(circle.center)) circleSet.add(circle);
    }
    for (const arc of model.arcs) {
      if (pointSet.has(arc.center)) arcSet.add(arc);
    }
    for (const spline of model.splines) {
      if (spline.fitPoints.some((point) => pointSet.has(point))) splineSet.add(spline);
    }
    const remainingLines = model.lines.filter((line) => !lineSet.has(line));
    const remainingCircles = model.circles.filter((circle) => !circleSet.has(circle));
    const remainingArcs = model.arcs.filter((arc) => !arcSet.has(arc));
    const remainingSplines = model.splines.filter((spline) => !splineSet.has(spline));
    for (const line of lineSet) {
      if (line.p1.kind === "endpoint" && !isPointUsedByLine(line.p1, remainingLines) && !isPointUsedByCircle(line.p1, remainingCircles) && !isPointUsedByArc(line.p1, remainingArcs) && !isPointUsedBySpline(line.p1, remainingSplines)) pointSet.add(line.p1);
      if (line.p2.kind === "endpoint" && !isPointUsedByLine(line.p2, remainingLines) && !isPointUsedByCircle(line.p2, remainingCircles) && !isPointUsedByArc(line.p2, remainingArcs) && !isPointUsedBySpline(line.p2, remainingSplines)) pointSet.add(line.p2);
    }
    for (const circle of circleSet) {
      if (circle.center.kind === "endpoint" && !isPointUsedByCircle(circle.center, remainingCircles) && !isPointUsedByLine(circle.center, remainingLines) && !isPointUsedByArc(circle.center, remainingArcs) && !isPointUsedBySpline(circle.center, remainingSplines)) pointSet.add(circle.center);
    }
    for (const arc of arcSet) {
      if (arc.center.kind === "endpoint" && !isPointUsedByArc(arc.center, remainingArcs) && !isPointUsedByLine(arc.center, remainingLines) && !isPointUsedByCircle(arc.center, remainingCircles) && !isPointUsedBySpline(arc.center, remainingSplines)) pointSet.add(arc.center);
    }
    for (const spline of splineSet) {
      for (const point of spline.fitPoints) {
        if (point.kind === "endpoint" && !isPointUsedBySpline(point, remainingSplines) && !isPointUsedByLine(point, remainingLines) && !isPointUsedByCircle(point, remainingCircles) && !isPointUsedByArc(point, remainingArcs)) pointSet.add(point);
      }
    }

    for (const constraint of model.constraints) {
      for (const point of pointSet) {
        if (constraintReferencesPoint(constraint, point)) constraintSet.add(constraint);
      }
      for (const line of lineSet) {
        if (constraintReferencesLine(constraint, line)) constraintSet.add(constraint);
      }
      for (const circle of circleSet) {
        if (constraintReferencesPrimitive(constraint, circle)) constraintSet.add(constraint);
      }
      for (const arc of arcSet) {
        if (constraintReferencesPrimitive(constraint, arc)) constraintSet.add(constraint);
      }
      for (const spline of splineSet) {
        if (constraintReferencesPrimitive(constraint, spline)) constraintSet.add(constraint);
      }
    }

    const removedKeysForDependency = new Set([...pointSet, ...lineSet, ...circleSet, ...arcSet, ...splineSet].map(geometryElementKey).filter(Boolean));
    const dependentInstances = model.geometryInstances.filter((instance) => geometryInstanceUsesRemovedGeometry(instance, removedKeysForDependency));
    if (rejectReferencedGeometryDeletion(dependentInstances, applicationText("選択したGeometry", "the selected geometry"))) return false;
    if (pointSet.size === 0 && lineSet.size === 0 && circleSet.size === 0 && arcSet.size === 0 && splineSet.size === 0 && constraintSet.size === 0) return false;
    if (!guardDimensionSymbolDeletion(constraintSet)) return false;

    dragSession = null;
    dimensionDragSession = null;
    annotationDragSession = null;
    pendingCommand = null;
    pendingConstraintCommand = null;
    lineCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    pointerPreview = null;
    mode = "select";

    model.constraints = model.constraints.filter((c) => !constraintSet.has(c));
    model.lines = model.lines.filter((l) => !lineSet.has(l));
    model.circles = model.circles.filter((c) => !circleSet.has(c));
    model.arcs = model.arcs.filter((a) => !arcSet.has(a));
    model.splines = model.splines.filter((spline) => !splineSet.has(spline));
    model.points = model.points.filter((p) => !pointSet.has(p));
    const removedGeometry = [...pointSet, ...lineSet, ...circleSet, ...arcSet, ...splineSet];
    const removedIds = new Set(removedGeometry.map((item) => item.id));
    const removedKeys = new Set(removedGeometry.map(geometryElementKey).filter(Boolean));
    model.annotations = model.annotations.filter((annotation) => !annotationReferencesRemovedGeometry(annotation, removedIds, removedKeys));
    canvasSelection.set("annotations", canvasSelection.annotations.filter((annotation) => model.annotations.includes(annotation)));
    canvasSelection.set("points", canvasSelection.points.filter((p) => !pointSet.has(p)));
    canvasSelection.set("lines", canvasSelection.lines.filter((l) => !lineSet.has(l)));
    canvasSelection.set("circles", canvasSelection.circles.filter((c) => !circleSet.has(c)));
    canvasSelection.set("arcs", canvasSelection.arcs.filter((a) => !arcSet.has(a)));
    canvasSelection.set("splines", canvasSelection.splines.filter((spline) => !splineSet.has(spline)));
    if (splineEditSession && splineSet.has(splineEditSession.spline)) splineEditSession = null;
    if (constraintSet.has(canvasSelection.dimensionConstraint)) canvasSelection.set("dimensionConstraint", null);
    if (constraintSet.has(canvasSelection.constraint)) canvasSelection.set("constraint", null);
    if (constraintSet.has(hoveredDimensionConstraint)) hoveredDimensionConstraint = null;

    const result = solveActiveSketch();
    normalizeArcSweeps();
    updateToolbar();
    updateUI();
    draw();
    const msg = `削除しました: 点${pointSet.size} / 線${lineSet.size} / 円${circleSet.size} / 円弧${arcSet.size} / スプライン${splineSet.size} / 拘束${constraintSet.size}`;
    const stable = result.success && constraintAnalysisState?.analysis?.stable;
    setHint(stable ? msg : `${msg}。拘束状態を確認してください`, stable ? "normal" : "error");
    log(`${msg}\n自動solve: success=${result.success}, error=${result.errorNorm.toExponential(3)}`);
    recordHistory("削除");
    return true;
  }

  function deleteCurrentSelection() {
    const annotationsToDelete = canvasSelection.annotations.filter((annotation) => model.annotations.includes(annotation));
    const hatchesToDelete = canvasSelection.hatches.filter((hatch) => model.hatches.includes(hatch));
    const referenceImagesToDelete = canvasSelection.referenceImages.filter((image) => model.referenceImages.includes(image));
    if (annotationsToDelete.length > 0) {
      model.annotations = model.annotations.filter((item) => !annotationsToDelete.includes(item));
      canvasSelection.set("annotations", []);
    }
    if (hatchesToDelete.length > 0) {
      model.hatches = model.hatches.filter((item) => !hatchesToDelete.includes(item));
      canvasSelection.set("hatches", []);
    }
    if (referenceImagesToDelete.length > 0) {
      model.referenceImages = model.referenceImages.filter((item) => !referenceImagesToDelete.includes(item));
      if (referenceImageCalibrationSession && referenceImagesToDelete.includes(referenceImageCalibrationSession.item)) referenceImageCalibrationSession = null;
      canvasSelection.set("referenceImages", []);
    }
    let deletedInstanceCount = 0;
    if (canvasSelection.geometryInstances.length > 0) {
      const instances = [...canvasSelection.geometryInstances];
      const ownerIds = new Set(instances.map((instance) => instance.id));
      const dependent = model.geometryInstances.filter((instance) => !instances.includes(instance) && geometryInstanceUsesRemovedGeometry(instance, new Set(), ownerIds));
      if (rejectReferencedGeometryDeletion(dependent, applicationText("選択した派生インスタンス", "the selected derived instance"))) return false;
      const projectionItems = instances.flatMap((instance) => {
        const bundle = geometryInstanceBundle(instance);
        return [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...bundle.splines];
      });
      const removedIds = new Set(projectionItems.map((item) => item.id));
      const removedKeys = new Set(projectionItems.map(geometryElementKey).filter(Boolean));
      const removedConstraints = new Set(model.constraints.filter((constraint) => constraintGraphNodes(constraint).some((node) => projectionItems.includes(node) || removedKeys.has(geometryElementKey(node)))));
      if (!guardDimensionSymbolDeletion(removedConstraints)) return false;
      model.constraints = model.constraints.filter((constraint) => !removedConstraints.has(constraint));
      model.annotations = model.annotations.filter((annotation) => !annotationReferencesRemovedGeometry(annotation, removedIds, removedKeys));
      model.geometryInstances = model.geometryInstances.filter((instance) => !instances.includes(instance));
      canvasSelection.set("geometryInstances", []);
      canvasSelection.set("instanceGeometry", null);
      deletedInstanceCount = instances.length;
    }
    let deletedBlockCount = 0;
    if (canvasSelection.blockInstances.length > 0) {
      const instances = [...canvasSelection.blockInstances];
      const dependent = model.geometryInstances.filter((instance) => geometryInstanceUsesRemovedGeometry(instance, new Set(), new Set(instances.map((entry) => entry.id))));
      if (rejectReferencedGeometryDeletion(dependent, applicationText("選択したブロック", "the selected block"))) return false;
      const projectionItems = instances.flatMap((instance) => {
        const bundle = blockAllProjectionBundle(instance);
        return [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])];
      });
      const removedIds = new Set(projectionItems.map((item) => item.id));
      const removedKeys = new Set(projectionItems.map(geometryElementKey));
      const removedConstraints = new Set(model.constraints.filter((constraint) => constraintGraphNodes(constraint).some((node) =>
        instances.includes(node) || projectionItems.includes(node) || removedKeys.has(geometryElementKey(node)))));
      if (!guardDimensionSymbolDeletion(removedConstraints)) return false;
      model.constraints = model.constraints.filter((constraint) => !removedConstraints.has(constraint));
      model.annotations = model.annotations.filter((annotation) => !annotationReferencesRemovedGeometry(annotation, removedIds, removedKeys));
      model.blockInstances = model.blockInstances.filter((instance) => !instances.includes(instance));
      invalidateBlockProjectionCache();
      canvasSelection.set("blockInstances", []);
      deletedBlockCount = instances.length;
    }
    const constraints = [...new Set([canvasSelection.dimensionConstraint, effectiveSelectedConstraint()].filter(Boolean))];
    const deletedGeometry = deleteElements({ points: canvasSelection.points, lines: canvasSelection.lines, circles: canvasSelection.circles, arcs: canvasSelection.arcs, splines: canvasSelection.splines, constraints });
    if (deletedGeometry) return true;
    if (deletedBlockCount === 0 && deletedInstanceCount === 0 && annotationsToDelete.length === 0 && hatchesToDelete.length === 0 && referenceImagesToDelete.length === 0) return false;
    clearSelection();
    if (deletedBlockCount > 0 || deletedInstanceCount > 0) solveAndRefresh("インスタンス削除");
    else {
      updateUI();
      draw();
      recordHistory(referenceImagesToDelete.length ? "画像削除" : hatchesToDelete.length ? "ハッチング削除" : "注記削除");
    }
    setHint(applicationText(`削除しました: 派生インスタンス${deletedInstanceCount} / ブロック${deletedBlockCount} / 画像${referenceImagesToDelete.length} / ハッチング${hatchesToDelete.length} / 注記${annotationsToDelete.length}`, `Deleted: derived instances ${deletedInstanceCount} / blocks ${deletedBlockCount} / images ${referenceImagesToDelete.length} / hatches ${hatchesToDelete.length} / annotations ${annotationsToDelete.length}`));
    return true;
  }

  function copyableSelectionPayload() {
    const points = new Set(canvasSelection.points.filter((point) => model.points.includes(point)));
    const lines = canvasSelection.lines.filter((line) => model.lines.includes(line));
    const circles = canvasSelection.circles.filter((circle) => model.circles.includes(circle));
    const arcs = canvasSelection.arcs.filter((arc) => model.arcs.includes(arc));
    const splines = canvasSelection.splines.filter((spline) => model.splines.includes(spline));
    const blockInstances = canvasSelection.blockInstances.filter((instance) => model.blockInstances.includes(instance));
    const annotations = canvasSelection.annotations.filter((annotation) => model.annotations.includes(annotation));
    const hatches = canvasSelection.hatches.filter((hatch) => model.hatches.includes(hatch));
    const dependentPoints = new Set();
    for (const line of lines) {
      points.add(line.p1);
      points.add(line.p2);
      dependentPoints.add(line.p1);
      dependentPoints.add(line.p2);
    }
    for (const primitive of [...circles, ...arcs]) {
      points.add(primitive.center);
      dependentPoints.add(primitive.center);
    }
    for (const spline of splines) {
      for (const point of spline.fitPoints) {
        points.add(point);
        dependentPoints.add(point);
      }
    }
    if (points.size + lines.length + circles.length + arcs.length + splines.length + blockInstances.length + annotations.length + hatches.length === 0) return null;

    const selectedNodes = new Set([...points, ...lines, ...circles, ...arcs, ...splines, ...blockInstances]);
    const selectedBlockProjectionIds = new Set();
    const blockProjectionData = new Map();
    for (const instance of blockInstances) {
      const bundle = blockProjectionBundle(instance);
      const projectedItems = [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])];
      for (const item of projectedItems) {
        selectedNodes.add(item);
        selectedBlockProjectionIds.add(item.id);
      }
      blockProjectionData.set(instance, {
        points: bundle.points.map((item) => ({ id: item.id, localId: blockProjectionLocalId(item) })),
        lines: bundle.lines.map((item) => ({ id: item.id, localId: blockProjectionLocalId(item) })),
        circles: bundle.circles.map((item) => ({ id: item.id, localId: blockProjectionLocalId(item) })),
        arcs: bundle.arcs.map((item) => ({ id: item.id, localId: blockProjectionLocalId(item) })),
        splines: (bundle.splines || []).map((item) => ({ id: item.id, localId: blockProjectionLocalId(item) })),
      });
    }
    for (const annotation of annotations) {
      if (annotation.type !== "leader") continue;
      const referenced = resolveGeometryRef(annotation.geometryRef);
      if (!referenced || (!selectedNodes.has(referenced) && !selectedBlockProjectionIds.has(referenced.id))) {
        setHint(applicationText(`注記 ${annotation.id} の参照先も選択してください`, `Also select the target referenced by annotation ${annotation.id}`), "error");
        return null;
      }
    }
    const selectedBoundaryKeys = new Set([...lines, ...circles, ...arcs, ...splines].map((item) => `${geometryKindForItem(item)}:${item.id}`));
    for (const hatch of hatches) {
      const missing = hatchBoundaryGeometryRefs(hatch.boundaryLoops).filter((ref) => !selectedBoundaryKeys.has(`${ref.kind}:${geometryRefId(ref)}`));
      if (missing.length) {
        setHint(applicationText(`ハッチング ${hatch.id} の境界 ${missing.map(geometryRefId).join("、")} も選択してください`, `Also select boundary ${missing.map(geometryRefId).join(", ")} for hatch ${hatch.id}`), "error");
        return null;
      }
    }

    const constraints = model.constraints.map((constraint) => {
      if (constraint instanceof SketchProjectionConstraint) return null;
      if (constraint instanceof LineFixedConstraint || constraint instanceof ArcEndpointFixedConstraint || constraint instanceof GeometryFixedConstraint) return null;
      const nodes = constraintGraphNodes(constraint);
      if (nodes.length === 0 || !nodes.every((node) => selectedNodes.has(node) || Boolean(node?.blockProjection && selectedBlockProjectionIds.has(node.id)))) return null;
      return decorateSerializedConstraint(serializeConstraint(constraint), constraint);
    }).filter(Boolean);
    const orderedPoints = model.points.filter((point) => points.has(point));
    return {
      pasteCount: 0,
      parameterNamespaceKey: currentBlockDefinitionScopeId() ? `block:${currentBlockDefinitionScopeId()}` : "document",
      cut: false,
      points: orderedPoints.map((point) => ({
        id: point.id,
        x: point.x,
        y: point.y,
        fixed: false,
        kind: dependentPoints.has(point) ? point.kind || "endpoint" : "explicit",
        appearance: normalizeAppearance(point.appearance),
      })),
      lines: lines.map((line) => ({ id: line.id, p1: line.p1.id, p2: line.p2.id, construction: Boolean(line.construction), appearance: normalizeAppearance(line.appearance) })),
      circles: circles.map((circle) => ({ id: circle.id, center: circle.center.id, radius: circle.radius(), construction: Boolean(circle.construction), appearance: normalizeAppearance(circle.appearance) })),
      arcs: arcs.map((arc) => ({ id: arc.id, center: arc.center.id, radius: arc.radius(), startAngle: arc.startAngle, endAngle: arc.endAngle, construction: Boolean(arc.construction), appearance: normalizeAppearance(arc.appearance) })),
      splines: splines.map((spline) => ({ id: spline.id, fitPoints: spline.fitPoints.map((point) => point.id), closed: Boolean(spline.closed), construction: Boolean(spline.construction), appearance: normalizeAppearance(spline.appearance) })),
      constraints,
      blockInstances: blockInstances.map((instance) => ({
        id: instance.id,
        definitionId: instance.definitionId,
        x: instance.x,
        y: instance.y,
        rotation: instance.rotation,
        fixed: false,
        rotationLocked: Boolean(instance.rotationLocked),
        enabledSketchIds: Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.slice() : [],
        appearanceOverride: normalizeAppearance(instance.appearanceOverride),
        projection: blockProjectionData.get(instance),
      })),
      annotations: annotations.map(serializeAnnotation),
      hatches: hatches.map(serializeHatch),
      selection: {
        points: canvasSelection.points.filter((point) => points.has(point)).map((point) => point.id),
        lines: lines.map((line) => line.id),
        circles: circles.map((circle) => circle.id),
        arcs: arcs.map((arc) => arc.id),
        splines: splines.map((spline) => spline.id),
        blockInstances: blockInstances.map((instance) => instance.id),
        annotations: annotations.map((annotation) => annotation.id),
        hatches: hatches.map((hatch) => hatch.id),
      },
    };
  }

  function clipboardPayloadCount(payload = geometryClipboard) {
    if (!payload) return 0;
    return payload.points.length + payload.lines.length + payload.circles.length + payload.arcs.length + (payload.splines?.length || 0) + payload.blockInstances.length + (payload.hatches?.length || 0) + (payload.annotations?.length || 0);
  }

  function copySelectionToClipboard(options = {}) {
    if (!isGeometryMode()) return false;
    const payload = copyableSelectionPayload();
    if (!payload) {
      setHint("コピーする図形を選択してください", "error");
      updateToolbar();
      return false;
    }
    geometryClipboard = payload;
    geometryClipboard.cut = Boolean(options.cut);
    updateToolbar();
    if (options.cut) {
      const deleted = deleteCurrentSelection();
      if (deleted) setHint(`図形をカットしました（${clipboardPayloadCount(payload)}要素）`);
      return deleted;
    }
    setHint(`図形をコピーしました（${clipboardPayloadCount(payload)}要素）`);
    return true;
  }

  function remapClipboardValue(value, idMap) {
    if (typeof value === "string") return idMap.get(value) || value;
    if (Array.isArray(value)) return value.map((item) => remapClipboardValue(item, idMap));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remapClipboardValue(item, idMap)]));
    }
    return value;
  }

  function translateFixedConstraintValues(data, dx, dy) {
    if (data.type === "arcEndpointFixed" || data.type === "geometryFixed") {
      data.x += dx;
      data.y += dy;
    } else if (data.type === "lineFixed") {
      data.p1x += dx;
      data.p2x += dx;
      data.p1y += dy;
      data.p2y += dy;
    }
  }

  function translatedClipboardConstraintData(source, idMap, dx, dy) {
    const data = remapClipboardValue(source, idMap);
    if (data.dimension) {
      for (const key of ["x", "labelX"]) if (Number.isFinite(Number(data.dimension[key]))) data.dimension[key] = Number(data.dimension[key]) + dx;
      for (const key of ["y", "labelY"]) if (Number.isFinite(Number(data.dimension[key]))) data.dimension[key] = Number(data.dimension[key]) + dy;
    }
    translateFixedConstraintValues(data, dx, dy);
    delete data.reference;
    delete data.referenceSketchId;
    return data;
  }

  function serializedDimensionExpressionValue(data) {
    const value = Number(data?.target);
    return data?.type === "lineAngle" ? angleDegrees(value) : value;
  }

  function mapClipboardBlockProjection(source, instance, idMap, pointById, lineById, primitiveById) {
    const projection = source.projection || {};
    const bundle = blockProjectionBundle(instance);
    const mapKind = (records, items, destination) => {
      const byLocalId = new Map(items.map((item) => [String(blockProjectionLocalId(item)), item]));
      for (const record of records || []) {
        const item = byLocalId.get(String(record.localId));
        if (!item) continue;
        idMap.set(String(record.id), item.id);
        destination.set(item.id, item);
      }
    };
    mapKind(projection.points, bundle.points, pointById);
    mapKind(projection.lines, bundle.lines, lineById);
    mapKind(projection.circles, bundle.circles, primitiveById);
    mapKind(projection.arcs, bundle.arcs, primitiveById);
    mapKind(projection.splines, bundle.splines || [], primitiveById);
  }

  function pasteGeometryClipboard() {
    if (!isGeometryMode() || !geometryClipboard) {
      setHint("貼り付ける図形がありません", "error");
      return false;
    }
    if (!canCreateInActiveSketch()) {
      setHint("貼り付け先のスケッチをアクティブにしてください", "error");
      return false;
    }

    const payload = geometryClipboard;
    if (payload.blockInstances.length > 0) {
      const invalid = payload.blockInstances.find((instance) => blockDefinitionScopeError(instance.definitionId));
      if (invalid) {
        setHint(blockDefinitionScopeError(invalid.definitionId), "error");
        return false;
      }
    }
    const targetSketchId = activeSketchId();
    const pasteNumber = payload.pasteCount + 1;
    const offset = (CLIPBOARD_PASTE_OFFSET_SCREEN_PX * pasteNumber) / viewport.scale;
    const dx = offset;
    const dy = offset;
    const initialLengths = {
      points: model.points.length,
      lines: model.lines.length,
      circles: model.circles.length,
      arcs: model.arcs.length,
      splines: model.splines.length,
      constraints: model.constraints.length,
      blockInstances: model.blockInstances.length,
      annotations: model.annotations.length,
      hatches: model.hatches.length,
    };
    const initialSequences = { ...geometryIds.snapshot(), annotationSeq, hatchSeq, nextHatchIndex: model.nextHatchIndex, blockInstanceSeq, nextDimensionParameterIndex: model.nextDimensionParameterIndex };

    try {
      const idMap = new Map();
      const pointById = new Map();
      const lineById = new Map();
      const primitiveById = new Map();
      for (const source of payload.points) {
        const point = new Point(geometryIds.allocate("point"), source.x + dx, source.y + dy, source.fixed, source.kind === "endpoint" ? "endpoint" : "explicit");
        point.sketchId = targetSketchId;
        point.appearance = normalizeAppearance(source.appearance);
        model.points.push(point);
        idMap.set(source.id, point.id);
        pointById.set(point.id, point);
      }
      for (const source of payload.lines) {
        const line = new Line(geometryIds.allocate("line"), pointById.get(idMap.get(source.p1)), pointById.get(idMap.get(source.p2)), source.construction);
        line.sketchId = targetSketchId;
        line.appearance = normalizeAppearance(source.appearance);
        ensureLineMinimumLength(line);
        model.lines.push(line);
        idMap.set(source.id, line.id);
        lineById.set(line.id, line);
      }
      for (const source of payload.circles) {
        const circle = new Circle(geometryIds.allocate("circle"), pointById.get(idMap.get(source.center)), source.radius, source.construction);
        circle.sketchId = targetSketchId;
        circle.appearance = normalizeAppearance(source.appearance);
        model.circles.push(circle);
        idMap.set(source.id, circle.id);
        primitiveById.set(circle.id, circle);
      }
      for (const source of payload.arcs) {
        const arc = new Arc(geometryIds.allocate("arc"), pointById.get(idMap.get(source.center)), source.radius, source.startAngle, source.endAngle, source.construction);
        arc.sketchId = targetSketchId;
        arc.appearance = normalizeAppearance(source.appearance);
        normalizeArcSweep(arc);
        model.arcs.push(arc);
        idMap.set(source.id, arc.id);
        primitiveById.set(arc.id, arc);
      }
      for (const source of payload.splines || []) {
        const fitPoints = source.fitPoints.map((id) => pointById.get(idMap.get(id)));
        if (fitPoints.some((point) => !point)) throw new Error(`スプライン ${source.id} の通過点を複製できません`);
        const spline = new Spline(geometryIds.allocate("spline"), fitPoints, source.closed, source.construction);
        spline.sketchId = targetSketchId;
        spline.appearance = normalizeAppearance(source.appearance);
        model.splines.push(spline);
        idMap.set(source.id, spline.id);
        primitiveById.set(spline.id, spline);
      }
      const pastedBlockInstances = [];
      for (const source of payload.blockInstances) {
        const definition = blockDefinitionById(source.definitionId);
        if (!definition) throw new Error(`ブロック定義 ${source.definitionId} が見つかりません`);
        const instance = {
          id: `BI${blockInstanceSeq++}`,
          definitionId: source.definitionId,
          sketchId: targetSketchId,
          x: source.x + dx,
          y: source.y + dy,
          rotation: source.rotation,
          fixed: source.fixed,
          rotationLocked: Boolean(source.rotationLocked),
          enabledSketchIds: source.enabledSketchIds.slice(),
          appearanceOverride: normalizeAppearance(source.appearanceOverride),
        };
        model.blockInstances.push(instance);
        pastedBlockInstances.push(instance);
        idMap.set(source.id, instance.id);
      }
      if (pastedBlockInstances.length > 0) invalidateBlockProjectionCache();
      payload.blockInstances.forEach((source, index) => mapClipboardBlockProjection(source, pastedBlockInstances[index], idMap, pointById, lineById, primitiveById));
      const pastedAnnotations = [];
      for (const source of payload.annotations || []) {
        const annotation = serializeAnnotation(source);
        annotation.id = `AN${annotationSeq++}`;
        annotation.sketchId = targetSketchId;
        annotation.x += dx;
        annotation.y += dy;
        for (const key of ["start", "elbow", "end"]) if (annotation[key]) annotation[key] = { x: annotation[key].x + dx, y: annotation[key].y + dy };
        if (annotation.geometryRef) annotation.geometryRef = remapClipboardValue(annotation.geometryRef, idMap);
        model.annotations.push(annotation);
        pastedAnnotations.push(annotation);
        idMap.set(source.id, annotation.id);
      }
      const pastedHatches = [];
      for (const source of payload.hatches || []) {
        const boundaryLoops = rewriteHatchBoundaryRefs(source.boundaryLoops, (ref) => {
          const mappedId = idMap.get(geometryRefId(ref));
          return mappedId ? createGeometryRef(ref.kind, mappedId) : null;
        });
        if (!boundaryLoops) throw new Error(`${source.id}: ${applicationText("ハッチング境界を書き換えられません", "Could not rewrite hatch boundary")}`);
        const hatch = {
          ...serializeHatch(source),
          id: `H${hatchSeq++}`,
          sketchId: targetSketchId,
          seed: { x: Number(source.seed?.x) + dx, y: Number(source.seed?.y) + dy },
          boundaryLoops,
        };
        model.hatches.push(hatch);
        pastedHatches.push(hatch);
        idMap.set(source.id, hatch.id);
      }
      model.nextHatchIndex = Math.max(hatchSeq, Number(model.nextHatchIndex) || 1);

      const targetNamespaceKey = currentBlockDefinitionScopeId() ? `block:${currentBlockDefinitionScopeId()}` : "document";
      const sameNamespace = payload.parameterNamespaceKey === targetNamespaceKey;
      const copiedDimensionNames = new Map();
      for (const source of payload.constraints) {
        if (!source.parameterName) continue;
        const keepCutName = payload.cut && sameNamespace
          && !dimensionConstraintsInNamespace(currentParameterNamespace()).some((constraint) => constraint.parameterName === source.parameterName)
          && !(currentParameterNamespace().parameters || []).some((parameter) => parameter.name === source.parameterName);
        copiedDimensionNames.set(source.parameterName, keepCutName ? source.parameterName : allocateDimensionParameterName(currentParameterNamespace()));
      }
      for (const source of payload.constraints) {
        const data = translatedClipboardConstraintData(source, idMap, dx, dy);
        if (source.parameterName) {
          data.parameterName = copiedDimensionNames.get(source.parameterName);
          if (!data.readOnlyDimension) {
            data.expression = sameNamespace
              ? rewriteParameterIdentifiers(source.expression || String(serializedDimensionExpressionValue(source)), copiedDimensionNames)
              : String(serializedDimensionExpressionValue(source));
          }
        }
        const constraint = deserializeConstraint(data, pointById, lineById, primitiveById);
        if (!constraint) throw new Error(`拘束 ${source.type} を複製できません`);
        constraint.sketchId = targetSketchId;
        constraint.reference = false;
        constraint.referenceSketchId = null;
        model.constraints.push(constraint);
        ensureDimensionParameter(constraint, currentParameterNamespace());
      }

      clearSelection();
      const selectedIds = payload.selection;
      canvasSelection.set("points", selectedIds.points.map((id) => pointById.get(idMap.get(id))).filter(Boolean));
      canvasSelection.set("lines", selectedIds.lines.map((id) => lineById.get(idMap.get(id))).filter(Boolean));
      canvasSelection.set("circles", selectedIds.circles.map((id) => primitiveById.get(idMap.get(id))).filter((item) => item instanceof Circle));
      canvasSelection.set("arcs", selectedIds.arcs.map((id) => primitiveById.get(idMap.get(id))).filter((item) => item instanceof Arc));
      canvasSelection.set("splines", (selectedIds.splines || []).map((id) => primitiveById.get(idMap.get(id))).filter((item) => item instanceof Spline));
      canvasSelection.set("blockInstances", pastedBlockInstances);
      canvasSelection.set("annotations", (selectedIds.annotations || []).map((id) => pastedAnnotations.find((annotation) => annotation.id === idMap.get(id))).filter(Boolean));
      canvasSelection.set("hatches", (selectedIds.hatches || []).map((id) => pastedHatches.find((hatch) => hatch.id === idMap.get(id))).filter(Boolean));
      payload.pasteCount = pasteNumber;
      mode = "select";
      solveAndRefresh("貼り付け");
      setHint(`${sketchName(targetSketchId)} に図形を貼り付けました（${clipboardPayloadCount(payload)}要素）`);
      return true;
    } catch (error) {
      model.points.length = initialLengths.points;
      model.lines.length = initialLengths.lines;
      model.circles.length = initialLengths.circles;
      model.arcs.length = initialLengths.arcs;
      model.splines.length = initialLengths.splines;
      model.constraints.length = initialLengths.constraints;
      model.blockInstances.length = initialLengths.blockInstances;
      model.annotations.length = initialLengths.annotations;
      model.hatches.length = initialLengths.hatches;
      geometryIds.restore(initialSequences);
      blockInstanceSeq = initialSequences.blockInstanceSeq;
      annotationSeq = initialSequences.annotationSeq;
      hatchSeq = initialSequences.hatchSeq;
      model.nextHatchIndex = initialSequences.nextHatchIndex;
      model.nextDimensionParameterIndex = initialSequences.nextDimensionParameterIndex;
      invalidateBlockProjectionCache();
      clearSelection();
      updateUI();
      draw();
      setHint(`貼り付けに失敗しました: ${error.message}`, "error");
      return false;
    }
  }

  function ensureDimensionDefaults() {
    for (const c of model.constraints) {
      const target = targetFromConstraint(c);
      if (!target) continue;
      if (!c.dimension) {
        c.dimension = defaultDimensionForTarget(target);
      } else if (target.kind === "angle") {
        migrateAngleDimensionLabelPlacement(target, c.dimension);
        if (!Number.isFinite(c.dimension.angleRadius) || !Number.isInteger(c.dimension.angleStartFlip) || !Number.isInteger(c.dimension.angleEndFlip)) {
          const previousDimension = c.dimension;
          const previousAnchor = dimensionAnchor(target, previousDimension);
          c.dimension = dimensionFromAnchor(target, previousAnchor, { allowPointAxis: false });
          setAngleDimensionLabelOffsets(c.dimension, angleDimensionLabelOffsets(target, previousDimension));
        }
      } else if (!Number.isFinite(c.dimension.offsetU) || !Number.isFinite(c.dimension.offsetN)) {
        const previous = c.dimension;
        c.dimension = dimensionFromAnchor(target, previous, { allowPointAxis: false });
        c.dimension.labelOffsetU = Number.isFinite(previous.labelOffsetU) ? previous.labelOffsetU : 0;
        if (target.dimensionAxis) c.dimension.axis = target.dimensionAxis;
      }
      if (!Number.isFinite(c.dimension.labelOffsetU)) c.dimension.labelOffsetU = 0;
    }
  }

  function addUnique(target, item) {
    if (item && !target.includes(item)) target.push(item);
  }

  function lineIntersectsRect(line, rect) {
    if (!bboxIntersectsRect(lineBBox(line), rect)) return false;
    if (pointInRect(line.p1, rect) || pointInRect(line.p2, rect)) return true;
    const edges = [
      [{ x: rect.x1, y: rect.y1 }, { x: rect.x2, y: rect.y1 }],
      [{ x: rect.x2, y: rect.y1 }, { x: rect.x2, y: rect.y2 }],
      [{ x: rect.x2, y: rect.y2 }, { x: rect.x1, y: rect.y2 }],
      [{ x: rect.x1, y: rect.y2 }, { x: rect.x1, y: rect.y1 }],
    ];
    return edges.some(([a, b]) => segmentsIntersect(line.p1, line.p2, a, b));
  }

  function segmentsIntersect(a, b, c, d) {
    const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const onSegment = (p, q, r) =>
      Math.min(p.x, q.x) - 1e-9 <= r.x &&
      r.x <= Math.max(p.x, q.x) + 1e-9 &&
      Math.min(p.y, q.y) - 1e-9 <= r.y &&
      r.y <= Math.max(p.y, q.y) + 1e-9;
    const c1 = cross(a, b, c);
    const c2 = cross(a, b, d);
    const c3 = cross(c, d, a);
    const c4 = cross(c, d, b);
    if (Math.abs(c1) < 1e-9 && onSegment(a, b, c)) return true;
    if (Math.abs(c2) < 1e-9 && onSegment(a, b, d)) return true;
    if (Math.abs(c3) < 1e-9 && onSegment(c, d, a)) return true;
    if (Math.abs(c4) < 1e-9 && onSegment(c, d, b)) return true;
    return c1 * c2 < 0 && c3 * c4 < 0;
  }

  function selectByRect(rect, crossing, additive = false) {
    canvasSelection.set("instanceGeometry", null);
    const nextPoints = additive ? [...canvasSelection.points] : [];
    const nextLines = additive ? [...canvasSelection.lines] : [];
    const nextCircles = additive ? [...canvasSelection.circles] : [];
    const nextArcs = additive ? [...canvasSelection.arcs] : [];
    const nextSplines = additive ? [...canvasSelection.splines] : [];
    const nextBlocks = additive ? [...canvasSelection.blockInstances] : [];
    const nextAnnotations = additive ? [...canvasSelection.annotations] : [];
    const nextHatches = additive ? [...canvasSelection.hatches] : [];
    const nextReferenceImages = additive ? [...canvasSelection.referenceImages] : [];

    for (const p of model.points) {
      if (!selectableSketchElement(p)) continue;
      if (!isExplicitPoint(p) && !isReferencePoint(p)) continue;
      if (pointInRect(p, rect)) addUnique(nextPoints, p);
    }
    for (const line of model.lines) {
      if (!selectableSketchElement(line)) continue;
      const selected = crossing ? lineIntersectsRect(line, rect) : bboxInRect(lineBBox(line), rect);
      if (selected) addUnique(nextLines, line);
    }
    for (const circle of model.circles) {
      if (!isVisibleSketchElement(circle)) continue;
      if (!selectableSketchElement(circle)) continue;
      const box = primitiveBBox(circle);
      const selected = crossing ? bboxIntersectsRect(box, rect) : bboxInRect(box, rect);
      if (selected) addUnique(nextCircles, circle);
    }
    for (const arc of model.arcs) {
      if (!isVisibleSketchElement(arc)) continue;
      if (!selectableSketchElement(arc)) continue;
      const samples = arcSamplePoints(arc);
      const selected = crossing ? samples.some((p) => pointInRect(p, rect)) : samples.every((p) => pointInRect(p, rect));
      if (selected) addUnique(nextArcs, arc);
    }
    for (const spline of model.splines) {
      if (!isVisibleSketchElement(spline) || !selectableSketchElement(spline)) continue;
      const samples = window.SplineGeometry.flatten(spline.curve(), { tolerance: Math.max(0.1, 0.75 / viewport.scale) }).map((entry) => entry.point);
      const selected = crossing ? samples.some((point) => pointInRect(point, rect)) : samples.every((point) => pointInRect(point, rect));
      if (selected) addUnique(nextSplines, spline);
    }
    for (const instance of model.blockInstances) {
      if (!isEditableSketchId(instance.sketchId) || !isVisibleSketchId(instance.sketchId)) continue;
      const bundle = blockProjectionBundle(instance);
      let box = null;
      for (const line of bundle.lines) box = mergeBounds(box, lineBBox(line));
      for (const circle of bundle.circles) box = mergeBounds(box, primitiveBBox(circle));
      for (const arc of bundle.arcs) box = mergeBounds(box, primitiveBBox(arc));
      for (const spline of bundle.splines || []) box = mergeBounds(box, splineBBox(spline));
      for (const point of bundle.points) box = mergeBounds(box, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
      for (const annotation of bundle.annotations || []) box = mergeBounds(box, annotationBounds(annotation));
      for (const hatch of bundle.hatches || []) box = mergeBounds(box, resolvedLoopBounds(resolvedHatchBoundary(hatch)));
      if (!box) continue;
      const selected = crossing ? bboxIntersectsRect(box, rect) : bboxInRect(box, rect);
      if (selected) addUnique(nextBlocks, instance);
    }
    for (const annotation of model.annotations) {
      if (annotation.sketchId !== activeSketchId() || annotation.visible === false || !isVisibleSketchId(annotation.sketchId)) continue;
      const box = annotationBounds(annotation);
      if (!box) continue;
      const selected = crossing ? bboxIntersectsRect(box, rect) : bboxInRect(box, rect);
      if (selected) addUnique(nextAnnotations, annotation);
    }
    for (const hatch of model.hatches) {
      if (hatch.sketchId !== activeSketchId() || hatchAppearanceForDisplay(hatch).visible === false || !isVisibleSketchId(hatch.sketchId)) continue;
      const box = resolvedLoopBounds(resolvedHatchBoundary(hatch));
      if (!box) continue;
      const selected = crossing ? bboxIntersectsRect(box, rect) : bboxInRect(box, rect);
      if (selected) addUnique(nextHatches, hatch);
    }
    for (const image of model.referenceImages) {
      if (image.sketchId !== activeSketchId() || image.visible === false || !isVisibleSketchId(image.sketchId)) continue;
      const box = referenceImageBounds(image);
      const selected = crossing ? bboxIntersectsRect(box, rect) : bboxInRect(box, rect);
      if (selected) addUnique(nextReferenceImages, image);
    }

    canvasSelection.set("points", nextPoints);
    canvasSelection.set("lines", nextLines);
    canvasSelection.set("circles", nextCircles);
    canvasSelection.set("arcs", nextArcs);
    canvasSelection.set("splines", nextSplines);
    canvasSelection.set("blockInstances", nextBlocks);
    canvasSelection.set("annotations", nextAnnotations);
    canvasSelection.set("hatches", nextHatches);
    canvasSelection.set("referenceImages", nextReferenceImages);
    canvasSelection.set("arcEndpoint", null);
    canvasSelection.set("arcEndpointPair", null);
    canvasSelection.set("dimensionConstraint", null);
    canvasSelection.set("constraint", null);
  }

  function drawBlockInstanceHandles() {
    resetCanvasStrokeState();
  }

  function hatchAppearanceForDisplay(hatch) {
    return normalizeHatchAppearance(hatch?.appearance);
  }

  function hatchPatternOrigin(hatch) {
    return hatch?.patternOrigin || { x: 0, y: 0 };
  }


  function splineBBox(spline) {
    const bounds = window.SplineGeometry.bounds(spline.curve());
    return bounds ? { x1: bounds.minX, y1: bounds.minY, x2: bounds.maxX, y2: bounds.maxY } : null;
  }





  function hatchBoundaryGeometryItems(hatch) {
    const refIds = new Set(hatchBoundaryGeometryRefs(hatch?.boundaryLoops).map((ref) => `${ref.kind}:${geometryRefId(ref)}`));
    if (refIds.size === 0) return [];
    const geometry = [...allGeometryLines(), ...allGeometryCircles(), ...allGeometryArcs(), ...allGeometrySplines()];
    return geometry.filter((item) => {
      if (hatch?.blockProjection) {
        if (item.blockInstance !== hatch.blockInstance) return false;
        const local = item.localElement || item.sourceElement;
        return local && refIds.has(`${geometryKindForItem(local)}:${local.id}`);
      }
      return refIds.has(`${geometryKindForItem(item)}:${item.id}`);
    });
  }

  function hatchBoundaryHitExclusionScreenPx(hatch) {
    const widths = hatchBoundaryGeometryItems(hatch).map((item) => Number(effectiveAppearanceForElement(item).lineWidth)).filter(Number.isFinite);
    const boundaryLineWidth = widths.length > 0 ? Math.max(...widths) : Number(documentModel.defaultAppearance?.lineWidth) || DEFAULT_APPEARANCE.lineWidth;
    return Math.max(0.5, boundaryLineWidth / 2) + HATCH_BOUNDARY_HIT_MARGIN_SCREEN_PX;
  }

  function resolvedHatchBoundaryDistance(resolved, point) {
    let distance = Infinity;
    for (const loop of resolved?.loops || []) {
      const points = loop.points || [];
      for (let index = 0; index < points.length; index += 1) {
        const p1 = points[index];
        const p2 = points[(index + 1) % points.length];
        distance = Math.min(distance, distancePointToSegmentPoints(point.x, point.y, p1, p2));
      }
    }
    return distance;
  }

  function hatchContainsSelectablePoint(hatch, resolved, point) {
    return Boolean(resolved?.ok)
      && hatchContainsPoint(resolved, point)
      && resolvedHatchBoundaryDistance(resolved, point) > hatchBoundaryHitExclusionScreenPx(hatch) / viewport.scale;
  }


  function drawResolvedHatch(resolved, appearance, origin = { x: 0, y: 0 }, { hatch = null, selected = false, hovered = false, preview = false, alpha = 1 } = {}) {
    drawResolvedHatchContent(ctx, resolved, appearance, origin, { selected, hovered, preview, alpha });
    if (!preview && hatch) drawHatchBoundaryOverlay(hatch);
  }

  function drawHatchBoundaryOverlay(hatch) {
    const items = hatchBoundaryGeometryItems(hatch);
    drawLines(items.filter((item) => item instanceof Line));
    drawCircles(items.filter((item) => item instanceof Circle));
    drawArcs(items.filter((item) => item instanceof Arc));
    drawSplines(items.filter((item) => item instanceof Spline));
  }

  function drawHatches(items = null, { includePreview = true } = {}) {
    for (const hatch of items || allHatches()) {
      if (!isVisibleSketchId(hatch.sketchId)) continue;
      const appearance = hatchAppearanceForDisplay(hatch);
      const selected = hatch.blockProjection ? canvasSelection.blockInstances.includes(hatch.blockInstance) : hatch.sketchId === activeSketchId() && canvasSelection.hatches.includes(hatch);
      const hovered = hatch.blockProjection ? hoveredBlockInstance === hatch.blockInstance : hatch.sketchId === activeSketchId() && hoveredHatch === hatch;
      drawResolvedHatch(resolvedHatchBoundary(hatch), appearance, hatchPatternOrigin(hatch), { hatch, selected, hovered, alpha: sketchAlpha(hatch) });
    }
    if (includePreview && ["hatch", "hatch-repair"].includes(mode) && hatchPreview?.result?.ok) {
      drawResolvedHatch({ ...hatchPreview.result.resolved, ok: true }, DEFAULT_HATCH_APPEARANCE, { x: 0, y: 0 }, { preview: true });
    }
  }





  function drawReferenceImages() {
    referenceImageRenderer.drawImages(model.referenceImages.filter(item => item.visible !== false && isVisibleSketchId(item.sketchId)));
  }

  function drawReferenceImageOverlays() {
    const item = canvasSelection.referenceImages.length === 1 ? canvasSelection.referenceImages[0] : hoveredReferenceImage;
    referenceImageRenderer.drawOverlays(
      item && item.visible !== false && item.sketchId === activeSketchId() ? item : null,
      canvasSelection.referenceImages.includes(item),
      referenceImageCalibrationSession ? referenceImageCalibrationSession.worldPoints || [] : null,
    );
  }

  function drawBlockPlacementPreview() {
    if (mode !== "block-place" || !blockPlacementCommand.definitionId || !pointerPreview) return;
    const preview = blockPlacementCommand.preview(pointerPreview);
    if (!preview) return;
    const { definition, instance: previewInstance } = preview;
    const bundle = createBlockProjectionBundle(previewInstance, definition);
    withCanvasState(() => {
      for (const hatch of bundle.hatches || []) {
        drawResolvedHatch(resolvedHatchBoundary(hatch), { ...hatchAppearanceForDisplay(hatch), color: "#2563eb" }, hatchPatternOrigin(hatch), { preview: true, alpha: 0.75 });
      }
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      for (const line of bundle.lines) {
        ctx.beginPath();
        ctx.moveTo(line.p1.x, line.p1.y);
        ctx.lineTo(line.p2.x, line.p2.y);
        ctx.stroke();
      }
      for (const circle of bundle.circles) {
        ctx.beginPath();
        ctx.arc(circle.center.x, circle.center.y, circle.radius(), 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const arc of bundle.arcs) {
        ctx.beginPath();
        ctx.arc(arc.center.x, arc.center.y, arc.radius(), arc.startAngle, arc.endAngle, arc.endAngle < arc.startAngle);
        ctx.stroke();
      }
      for (const spline of bundle.splines || []) {
        traceSplinePath(spline);
        ctx.stroke();
      }
      for (const annotation of bundle.annotations || []) {
        const preview = { ...annotation, style: { ...annotation.style, color: "#2563eb" } };
        if (preview.type === "leader") drawAnnotationLeader(preview, true);
        else drawAnnotationText(preview);
      }
    });
  }

  function drawFreeInstancePreview() {
    const bundle = geometryInstanceCommand.preview(pointerPreview);
    if (!bundle) return;
    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      for (const line of bundle.lines) {
        ctx.beginPath(); ctx.moveTo(line.p1.x, line.p1.y); ctx.lineTo(line.p2.x, line.p2.y); ctx.stroke();
      }
      for (const circle of bundle.circles) {
        ctx.beginPath(); ctx.arc(circle.center.x, circle.center.y, circle.radius(), 0, Math.PI * 2); ctx.stroke();
      }
      for (const arc of bundle.arcs) {
        ctx.beginPath(); ctx.arc(arc.center.x, arc.center.y, arc.radius(), arc.startAngle, arc.endAngle, arc.endAngle < arc.startAngle); ctx.stroke();
      }
      for (const spline of bundle.splines) { traceSplinePath(spline); ctx.stroke(); }
      for (const point of bundle.points) {
        ctx.beginPath(); ctx.arc(point.x, point.y, 3 / viewport.scale, 0, Math.PI * 2); ctx.stroke();
      }
    });
  }

  function draw() {
    if (!interactionProfiler.active) return drawUnprofiled();
    return profileInteractionWork("draw", () => drawUnprofiled());
  }

  function drawUnprofiled() {
    return withGeometryReadCache(drawCanvas);
  }

  function drawCanvas() {
    if (canvasSurface.width <= 0 || canvasSurface.height <= 0) syncCanvasBitmapSize();
    const dpr = canvasSurface.dpr;
    if (interactionFrameStats) interactionFrameStats.canvasDraws += 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    resetCanvasStrokeState();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    resetCanvasStrokeState();
    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.scale, viewport.scale);
    resetCanvasStrokeState();
    drawReferenceImages();
    drawHatches([], { includePreview: true });
    drawDrawingStack();
    drawBlockInstanceHandles();
    drawDimensions();
    drawDimensionPreview();
    drawAnnotations();
    drawLeaderAnnotationCommandPreview();
    drawTemporaryLine();
    drawCenterlinePreview();
    drawRectanglePreview();
    drawSlotPreview();
    drawCirclePreview();
    drawArcPreview();
    drawThreePointArcPreview();
    drawSplinePreview();
    drawBlockPlacementPreview();
    drawFreeInstancePreview();
    drawOffsetPreview();
    drawTrimPreview();
    drawSnapMarker();
    drawArcEndpointHandles();
    drawSplineEditHandles();
    drawPoints();
    drawReferenceImageOverlays();
    drawSketchIdentityLabel();
    drawSelectionRect();
    resetCanvasStrokeState();
    ctx.restore();
    resetCanvasStrokeState();
  }

  function drawSelectionRect() {
    if (!selectionRectSession?.current) return;
    const rect = rectFromPoints(selectionRectSession.start, selectionRectSession.current);
    withCanvasState(() => {
      ctx.strokeStyle = selectionRectSession.current.x < selectionRectSession.start.x ? "#f59e0b" : "#2563eb";
      ctx.fillStyle = selectionRectSession.current.x < selectionRectSession.start.x ? "rgba(245, 158, 11, 0.08)" : "rgba(37, 99, 235, 0.08)";
      ctx.lineWidth = 1.2 / viewport.scale;
      ctx.setLineDash([5 / viewport.scale, 4 / viewport.scale]);
      ctx.fillRect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);
      ctx.strokeRect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);
    });
  }

  function extendedLineSegment(line, extension) {
    const len = line.length();
    if (len < 1e-12 || !Number.isFinite(extension) || extension <= 0) return { p1: line.p1, p2: line.p2 };
    const ux = line.dx() / len;
    const uy = line.dy() / len;
    return {
      p1: { x: line.p1.x - ux * extension, y: line.p1.y - uy * extension },
      p2: { x: line.p2.x + ux * extension, y: line.p2.y + uy * extension },
    };
  }

  function lineDisplaySegment(line, appearance = effectiveAppearanceForElement(line)) {
    return line.construction && appearance.endpointOverhang !== false
      ? extendedLineSegment(line, CONSTRUCTION_EXTENSION_SCREEN_PX / viewport.scale)
      : { p1: line.p1, p2: line.p2 };
  }

  function ownerInstanceSelected(item) {
    if (item?.derivedInstance && canvasSelection.geometryInstances.includes(item.derivedInstance)) {
      return canvasSelection.instanceGeometry?.instanceId === item.derivedInstance.id
        ? canvasSelection.instanceGeometry.id === item.id
        : !(item instanceof Point) || Boolean(item.sourceRef);
    }
    if (item instanceof Point) return false;
    return Boolean((item?.blockInstance && canvasSelection.blockInstances.includes(item.blockInstance)) || (item?.derivedInstance && canvasSelection.geometryInstances.includes(item.derivedInstance)));
  }

  function ownerInstanceHovered(item) {
    if (item?.derivedInstance && canvasSelection.instanceGeometry?.instanceId === item.derivedInstance.id) return false;
    if (item instanceof Point) return false;
    return Boolean((item?.blockInstance && hoveredBlockInstance === item.blockInstance) || (item?.derivedInstance && hoveredGeometryInstance === item.derivedInstance));
  }


  function geometryPaintState(item, kind) {
    const appearance = effectiveAppearanceForElement(item);
    const active = isEditableSketchElement(item);
    const ownSelected = active && canvasSelection[kind].includes(item);
    const geometrySelected = ownSelected || isConstraintOperandSelected(item) || (kind !== "splines" && isPendingReferenceTarget(item));
    const selected = ownerInstanceSelected(item) || geometrySelected;
    const treeHovered = isSidebarHighlightedElement(item);
    const sidebarHovered = isSidebarHoveredElement(item);
    const hoverItem = { lines: hoveredLine, circles: hoveredCircle, arcs: hoveredArc, splines: hoveredSpline }[kind];
    const canvasHovered = (active || isReferenceHoverElement(item)) && hoverItem === item;
    const hovered = treeHovered || sidebarHovered || canvasHovered || ownerInstanceHovered(item);
    const relatedHighlighted = isSelectedConstraintRelatedElement(item);
    const construction = kind === "splines" ? item.construction : kind === "lines" ? Boolean(item.construction) : Boolean(item.construction) && !selected && !hovered;
    const dimmed = kind === "splines" ? construction && !selected && !hovered : construction && !selected && !hovered && !relatedHighlighted;
    return {
      appearance, construction, sel: selected, selected, hovered, auxiliaryHighlighted: relatedHighlighted, relatedHighlighted,
      alpha: sketchAlpha(item) * (dimmed ? CONSTRUCTION_GEOMETRY_ALPHA : 1),
      color: relatedHighlighted ? "#0ea5e9" : geometryDisplayColor(item, appearance, selected, hovered),
      strokeWidth: geometryStrokeWidth(item, { auxiliaryHighlighted: relatedHighlighted, selected, hovered, appearance, construction }),
      showId: viewState.geometryIds || (kind === "splines" ? ownSelected || hovered : geometrySelected || sidebarHovered || canvasHovered || relatedHighlighted),
    };
  }

  function drawLines(items = null) {
    geometryRenderer.drawLines(items ? items.filter(isVisibleSketchElement) : drawOrderBySketch(allGeometryLines()));
  }

  function drawCircles(items = null) {
    geometryRenderer.drawCircles(items ? items.filter(isVisibleSketchElement) : drawOrderBySketch(allGeometryCircles()));
  }

  function drawArcs(items = null) {
    geometryRenderer.drawArcs(items ? items.filter(isVisibleSketchElement) : drawOrderBySketch(allGeometryArcs()));
  }

  function drawSplines(items = null) {
    geometryRenderer.drawSplines(items ? items.filter(isVisibleSketchElement) : drawOrderBySketch(allGeometrySplines()));
  }

  function drawSplinePreview() {
    if (mode !== "spline" || splineDraft.points.length === 0) return;
    const previewPoints = pointerPreview ? [...splineDraft.points, pointerPreview] : splineDraft.points.slice();
    withCanvasState(() => {
      ctx.strokeStyle = "#0ea5e9";
      ctx.lineWidth = 1.5 / viewport.scale;
      ctx.setLineDash([5 / viewport.scale, 4 / viewport.scale]);
      ctx.beginPath();
      ctx.moveTo(previewPoints[0].x, previewPoints[0].y);
      for (const point of previewPoints.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (previewPoints.length >= 3) {
        const curve = window.SplineGeometry.build(previewPoints, { closed: false });
        const previewSpline = { curve: () => curve, closed: false };
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2 / viewport.scale;
        traceSplinePath(previewSpline);
        ctx.stroke();
      }
    });
  }

  function drawSplineEditHandles() {
    const spline = splineEditSession?.spline;
    if (!spline || !model.splines.includes(spline)) return;
    withCanvasState(() => {
      ctx.strokeStyle = "rgba(37, 99, 235, 0.55)";
      ctx.lineWidth = 1 / viewport.scale;
      ctx.setLineDash([4 / viewport.scale, 4 / viewport.scale]);
      ctx.beginPath();
      spline.fitPoints.forEach((point, index) => index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
      if (spline.closed) ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      for (const point of spline.fitPoints) {
        ctx.fillStyle = canvasSelection.points.includes(point) ? "#ef4444" : "#ffffff";
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 1.5 / viewport.scale;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4.5 / viewport.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });
  }




  function drawDimension(target, dimension, label, preview = false, highlighted = false, editState = null, colorOverride = null, sketchId = activeSketchId(), expressionMark = false) {
    if (!target || !dimension) return;
    if (target.kind === "angle") return drawAngleDimension(target, dimension, label, preview, highlighted, editState, colorOverride, sketchId, expressionMark);
    const appearance = effectiveDimensionAppearance(dimension, sketchId);
    const layout = dimensionLayout(target, dimension, appearance);
    if (!layout) return;
    const renderPlan = linearDimensionRenderPlan(target, layout, label, appearance, dimension, expressionMark);
    const arcExtension = arcRadiusDimensionExtensionSegment(target, layout, appearance);
    dimensionRenderer.drawLinear({ layout, renderPlan, arcExtension, appearance, label, preview, highlighted, editState, colorOverride, expressionMark });
  }

  function drawAngleDimension(target, dimension, label, preview = false, highlighted = false, editState = null, colorOverride = null, sketchId = activeSketchId(), expressionMark = false) {
    const layout = angleDimensionLayout(target, dimension);
    if (!layout) return;
    const appearance = effectiveDimensionAppearance(dimension, sketchId);
    const extensions = angleDimensionExtensionSegments(layout, appearance);
    const outside = shouldPlaceDimensionTerminatorsOutside(Math.abs(layout.signed) * layout.radius, label, appearance, dimension, expressionMark);
    const arcExtension = outside ? dimensionMillimetersToWorld(appearance.terminatorSize * DIMENSION_OUTSIDE_SHAFT_LENGTH_FACTOR) / Math.max(layout.radius, 1e-12) : 0;
    dimensionRenderer.drawAngle({ layout, extensions, outside, arcExtension, appearance, label, preview, highlighted, editState, colorOverride, expressionMark });
  }
















  function drawDimensions() {
    for (const c of [...model.constraints].sort((a, b) => Number(isActiveSketchConstraint(a)) - Number(isActiveSketchConstraint(b)))) {
      if (!isVisibleSketchId(constraintSketchId(c))) continue;
      const target = targetFromConstraint(c);
      if (!target) continue;
      const dimension = c.dimension || defaultDimensionForTarget(target);
      const sketchId = constraintSketchId(c);
      if (!viewState.constraintStatus && effectiveDimensionAppearance(dimension, sketchId).visible === false) continue;
      const highlighted = c === hoveredDimensionConstraint || c === canvasSelection.dimensionConstraint || c === dimensionDragSession?.constraint;
      const label = dimensionLabelForConstraint(c, target, dimension);
      const editing = pendingCommand?.type === "distance-value" && pendingCommand.constraint === c;
      const colorOverride = viewState.constraintStatus && !isActiveSketchConstraint(c) ? INACTIVE_CONSTRAINT_STATUS_COLOR : null;
      ctx.save();
      drawDimension(target, dimension, label, false, highlighted || editing, editing ? { hidden: true } : null, colorOverride, sketchId, dimensionUsesExpression(c));
      ctx.restore();
    }
  }

  function drawAnnotations() {
    for (const element of allAnnotations()) {
      if (element.visible === false || !isVisibleSketchId(element.sketchId)) continue;
      if (element.type === "leader") drawAnnotationLeader(element);
      else if (element.type === "text") drawAnnotationText(element);
    }
  }

  function annotationDisplayColor(element, style = normalizeAnnotationStyle(element?.style)) {
    if (canvasSelection.annotations.includes(element)) return canvasThemeColor("#2563eb");
    if (element === hoveredAnnotation) return canvasThemeColor("#0ea5e9");
    return canvasThemeColor(style.color);
  }

  function textHitBox(text, x, y, fontSize = 13, textAlign = "left") {
    const width = Math.max(28, String(text || "").length * fontSize * 0.62);
    const height = fontSize + 10;
    const left = textAlign === "center" ? x - width / 2 : textAlign === "right" ? x - width : x;
    return {
      left,
      right: left + width,
      top: y - height / 2,
      bottom: y + height / 2,
    };
  }

  function pointInExpandedBox(x, y, box, padding) {
    return x >= box.left - padding && x <= box.right + padding && y >= box.top - padding && y <= box.bottom + padding;
  }

  function pointInAnnotationTextBox(x, y, element, padding = 0) {
    const rotation = -(Number(element?.rotation) || 0);
    const dx = x - (Number(element?.x) || 0);
    const dy = y - (Number(element?.y) || 0);
    const localX = dx * Math.cos(rotation) - dy * Math.sin(rotation) + (Number(element?.x) || 0);
    const localY = dx * Math.sin(rotation) + dy * Math.cos(rotation) + (Number(element?.y) || 0);
    const style = normalizeAnnotationStyle(element?.style);
    const fontSize = annotationTextWorldHeight(style);
    return pointInExpandedBox(localX, localY, textHitBox(element?.text, element?.x, element?.y, fontSize, style.textAlign), padding);
  }

  function boxFromPoints(points) {
    const valid = points.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
    if (valid.length === 0) return null;
    return {
      left: Math.min(...valid.map((p) => p.x)),
      right: Math.max(...valid.map((p) => p.x)),
      top: Math.min(...valid.map((p) => p.y)),
      bottom: Math.max(...valid.map((p) => p.y)),
    };
  }

  function hitAnnotationElement(x, y) {
    const threshold = 12 / viewport.scale;
    const annotations = allAnnotations();
    for (let i = annotations.length - 1; i >= 0; i--) {
      const element = annotations[i];
      if (!element || element.visible === false || !isVisibleSketchId(element.sketchId)) continue;
      if (!element.blockProjection && element.sketchId !== activeSketchId()) continue;
      if (element.type === "leader") {
        const start = annotationLeaderAnchor(element);
        if (!start || !element.end) continue;
        const elbow = element.elbow || { x: (start.x + element.end.x) / 2, y: element.end.y };
        if (distancePointToSegmentPoints(x, y, start, elbow) <= threshold * 2.2 || distancePointToSegmentPoints(x, y, elbow, element.end) <= threshold * 2.2) return { element, type: "leader", part: "line" };
        if (pointInAnnotationTextBox(x, y, element, threshold)) return { element, type: "leader", part: "label" };
        if (hypot2(x - element.x, y - element.y) <= threshold * 3) return { element, type: "leader", part: "label" };
        const leaderBox = boxFromPoints([start, elbow, element.end, { x: element.x, y: element.y }]);
        if (leaderBox && pointInExpandedBox(x, y, leaderBox, threshold * 2.2)) return { element, type: "leader", part: "line" };
      } else if (element.type === "text") {
        if (pointInAnnotationTextBox(x, y, element, threshold)) return { element, type: "text", part: "label" };
      }
    }
    return null;
  }

  function annotationById(id) {
    return id ? model.annotations.find((element) => element.id === id) || null : null;
  }

  function beginAnnotationDrag(e, hit, pointer) {
    annotationDragSession = {
      pointerId: e.pointerId,
      elementId: hit.element?.id || null,
      hit,
      startPointer: pointer,
      startEnd: hit.element?.end ? { ...hit.element.end } : null,
      startElbow: hit.element?.elbow ? { ...hit.element.elbow } : null,
      startText: hit.element ? { x: hit.element.x, y: hit.element.y } : null,
    };
    canvasSelection.set("annotations", [hit.element]);
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("is-dragging");
    setHint(hit.type === "leader" ? "引出線を移動中" : "テキストを移動中");
  }

  function updateAnnotationDrag(pointer) {
    const session = annotationDragSession;
    if (!session) return;
    const dx = pointer.x - session.startPointer.x;
    const dy = pointer.y - session.startPointer.y;
    const element = annotationById(session.elementId) || session.hit.element;
    if (!element) return;
    if (session.hit.type === "leader") {
      if (session.startEnd) element.end = { x: session.startEnd.x + dx, y: session.startEnd.y + dy };
      if (session.startElbow) element.elbow = { x: session.startElbow.x + dx, y: session.startElbow.y + dy };
      if (session.startText) {
        element.x = session.startText.x + dx;
        element.y = session.startText.y + dy;
      }
    } else if (session.hit.type === "text" && session.startText) {
      element.x = session.startText.x + dx;
      element.y = session.startText.y + dy;
    }
    draw();
  }

  function drawDimensionPreview() {
    if (pendingCommand?.type === "fillet-radius-place") {
      const geometry = pendingCommand.preview;
      if (!geometry.ok) return;
      const primitive = {
        id: "R",
        center: geometry.center,
        radius: () => geometry.radius,
      };
      const target = { kind: "radius", primitive, value: geometry.radius };
      const anchor = pendingCommand.pointer || {
        x: geometry.center.x + Math.cos((geometry.startAngle + geometry.endAngle) / 2) * geometry.radius,
        y: geometry.center.y + Math.sin((geometry.startAngle + geometry.endAngle) / 2) * geometry.radius,
      };
      drawFilletPreviewArc(geometry);
      drawDimension(target, dimensionFromAnchor(target, anchor), `R${formatDisplayNumber(geometry.radius)}`, true, false, {
        selecting: true,
        invalid: false,
        hidden: true,
      });
      return;
    }
    if (!pendingCommand?.type?.startsWith("distance")) return;
    const dimension =
      pendingCommand.type === "distance-place"
        ? pendingCommand.dimension || applyDefaultCircleDimensionLabelOffset(pendingCommand.target, pendingCommand.pointer ? dimensionFromAnchor(pendingCommand.target, pendingCommand.pointer) : defaultDimensionForTarget(pendingCommand.target))
        : pendingCommand.dimension;
    if (pendingCommand.type === "distance-value") {
      let value = NaN;
      let invalid = false;
      try {
        value = evaluateDimensionExpressionDraft(pendingCommand.constraint || null, pendingCommand.buffer);
        invalid = value <= 0 || (pendingCommand.target.kind === "angle" && value >= 180);
      } catch (_error) {
        invalid = true;
      }
      const suffix = pendingCommand.target.kind === "angle" ? "°" : "";
      drawDimension(pendingCommand.target, dimension, `${Number.isFinite(value) ? formatDisplayNumber(value) : "_"}${suffix}|`, true, false, {
        selecting: !pendingCommand.editing,
        invalid,
        hidden: true,
      });
      return;
    }
    const previewTarget =
      pendingCommand.target.kind === "point-point" && (dimension.axis === "x" || dimension.axis === "y")
        ? { ...pendingCommand.target, dimensionAxis: dimension.axis }
        : pendingCommand.target;
    const previewValue =
      previewTarget.kind === "point-point" && previewTarget.dimensionAxis === "x"
        ? Math.abs(previewTarget.p2.x - previewTarget.p1.x)
        : previewTarget.kind === "point-point" && previewTarget.dimensionAxis === "y"
          ? Math.abs(previewTarget.p2.y - previewTarget.p1.y)
          : previewTarget.kind === "angle"
            ? angleDegrees(angleDimensionAngles(previewTarget, pendingCommand.pointer || dimensionAnchor(previewTarget, dimension), dimension).signed)
          : previewTarget.value;
    const label = previewTarget.kind === "angle" ? formatDimensionLabel(previewValue, "°") : formatDimensionLabel(previewValue);
    drawDimension(previewTarget, dimensionWithLabelAt(previewTarget, dimension, pendingCommand.pointer), label, true);
  }

  function drawFilletPreviewArc(geometry) {
    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      ctx.beginPath();
      ctx.arc(geometry.center.x, geometry.center.y, geometry.radius, geometry.startAngle, geometry.endAngle, geometry.endAngle < geometry.startAngle);
      ctx.stroke();
    });
  }

  function drawTemporaryLine() {
    if (mode !== "line" || !lineCommand.startPoint) return;
    const target = pointerPreview || lineCommand.startPoint;
    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      ctx.beginPath();
      ctx.moveTo(lineCommand.startPoint.x, lineCommand.startPoint.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(lineCommand.startPoint.x, lineCommand.startPoint.y, 12 / viewport.scale, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  function drawRectanglePreview() {
    if (mode !== "rectangle" || !rectangleCommand.startPoint || !pointerPreview) return;
    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      ctx.strokeRect(rectangleCommand.startPoint.x, rectangleCommand.startPoint.y, pointerPreview.x - rectangleCommand.startPoint.x, pointerPreview.y - rectangleCommand.startPoint.y);
    });
  }

  function drawSlotPreview() {
    if (mode !== "slot" || !slotCommand.firstCenter) return;
    drawConstructionPoint(slotCommand.firstCenter);
    if (!slotCommand.secondCenter) {
      if (!pointerPreview || hypot2(pointerPreview.x - slotCommand.firstCenter.x, pointerPreview.y - slotCommand.firstCenter.y) < MIN_LINE_LENGTH) return;
      withCanvasState(() => {
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2 / viewport.scale;
        ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
        ctx.beginPath();
        ctx.moveTo(slotCommand.firstCenter.x, slotCommand.firstCenter.y);
        ctx.lineTo(pointerPreview.x, pointerPreview.y);
        ctx.stroke();
      });
      return;
    }
    drawConstructionPoint(slotCommand.secondCenter);
    if (!pointerPreview) return;
    const geometry = slotGeometry(slotCommand.firstCenter, slotCommand.secondCenter, pointerPreview, MIN_ARC_LENGTH);
    if (!geometry) return;
    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      ctx.beginPath();
      ctx.moveTo(geometry.sideStart.x, geometry.sideStart.y);
      ctx.lineTo(geometry.sideEnd.x, geometry.sideEnd.y);
      ctx.arc(geometry.secondCenter.x, geometry.secondCenter.y, geometry.radius, geometry.endArc.startAngle, geometry.endArc.endAngle, geometry.endArc.endAngle < geometry.endArc.startAngle);
      ctx.lineTo(geometry.oppositeStart.x, geometry.oppositeStart.y);
      ctx.arc(geometry.firstCenter.x, geometry.firstCenter.y, geometry.radius, geometry.startArc.startAngle, geometry.startArc.endAngle, geometry.startArc.endAngle < geometry.startArc.startAngle);
      ctx.stroke();
    });
  }

  function drawCirclePreview() {
    if (mode !== "circle" || !circularCommands.circleCenterPoint || !pointerPreview) return;
    const radius = hypot2(pointerPreview.x - circularCommands.circleCenterPoint.x, pointerPreview.y - circularCommands.circleCenterPoint.y);
    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      ctx.beginPath();
      ctx.arc(circularCommands.circleCenterPoint.x, circularCommands.circleCenterPoint.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  function drawArcPreview() {
    if (mode !== "arc" || !circularCommands.arcCenterPoint) return;
    if (!circularCommands.arcStartPoint) {
      drawConstructionPoint(circularCommands.arcCenterPoint);
      return;
    }
    if (!pointerPreview) return;
    const angles = {
      start: circularCommands.arcStartPoint.startAngle,
      end: shortestAngleFrom(circularCommands.arcStartPoint.startAngle, Math.atan2(pointerPreview.y - circularCommands.arcCenterPoint.y, pointerPreview.x - circularCommands.arcCenterPoint.x)),
    };
    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      ctx.beginPath();
      ctx.arc(circularCommands.arcCenterPoint.x, circularCommands.arcCenterPoint.y, circularCommands.arcStartPoint.radius, angles.start, angles.end, angles.end < angles.start);
      ctx.stroke();
    });
    drawConstructionPoint(circularCommands.arcCenterPoint);
  }

  function drawThreePointArcPreview() {
    if (mode !== "three-point-arc" || !circularCommands.threePointArcStart) return;
    drawConstructionPoint(circularCommands.threePointArcStart);
    if (!circularCommands.threePointArcEnd) return;
    drawConstructionPoint(circularCommands.threePointArcEnd);
    if (!pointerPreview) return;
    const geometry = threePointArcGeometry(circularCommands.threePointArcStart, circularCommands.threePointArcEnd, pointerPreview, MIN_ARC_LENGTH);
    if (!geometry) return;
    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      ctx.beginPath();
      ctx.arc(geometry.center.x, geometry.center.y, geometry.radius, geometry.startAngle, geometry.endAngle, geometry.endAngle < geometry.startAngle);
      ctx.stroke();
    });
    drawConstructionPoint(geometry.center);
  }

  function drawOffsetPreview() {
    if (mode !== "offset") return;
    offsetPreviewRenderer.draw(offsetCommand.preview(pointerPreview));
  }

  function drawTrimPreview() {
    if (mode !== "trim" || !trimPreview) return;
    withCanvasState(() => {
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 4 / viewport.scale;
      ctx.lineCap = "round";
      ctx.setLineDash([8 / viewport.scale, 5 / viewport.scale]);
      if (trimPreview.kind === "line") {
        ctx.beginPath();
        ctx.moveTo(trimPreview.interval.left.point.x, trimPreview.interval.left.point.y);
        ctx.lineTo(trimPreview.interval.right.point.x, trimPreview.interval.right.point.y);
        ctx.stroke();
      } else if (trimPreview.kind === "arc") {
        const arc = trimPreview.item;
        ctx.beginPath();
        ctx.arc(arc.center.x, arc.center.y, arc.radius(), angleAtArcParam(arc, trimPreview.interval.left.t), angleAtArcParam(arc, trimPreview.interval.right.t), arc.endAngle < arc.startAngle);
        ctx.stroke();
      } else if (trimPreview.kind === "circle") {
        const circle = trimPreview.item;
        ctx.beginPath();
        if (trimPreview.deleteWhole) ctx.arc(circle.center.x, circle.center.y, circle.radius(), 0, Math.PI * 2);
        else ctx.arc(circle.center.x, circle.center.y, circle.radius(), trimPreview.interval.left.angle, trimPreview.interval.right.angle);
        ctx.stroke();
      }
    });
  }

  function drawSnapMarker() {
    if (!drawingSnap.active) return;
    ctx.save();
    const r = 6 / viewport.scale;
    ctx.strokeStyle = "#f59e0b";
    ctx.fillStyle = "#f59e0b";
    ctx.lineWidth = 1.5 / viewport.scale;
    ctx.beginPath();
    ctx.moveTo(drawingSnap.active.x - r, drawingSnap.active.y);
    ctx.lineTo(drawingSnap.active.x + r, drawingSnap.active.y);
    ctx.moveTo(drawingSnap.active.x, drawingSnap.active.y - r);
    ctx.lineTo(drawingSnap.active.x, drawingSnap.active.y + r);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(drawingSnap.active.x, drawingSnap.active.y, 3 / viewport.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${11 / viewport.scale}px system-ui`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    const pointLike = Boolean(drawingSnap.active.data?.point) || drawingSnap.active.priority === 0;
    const labelX = drawingSnap.active.x + 8 / viewport.scale;
    const labelY = drawingSnap.active.y + (pointLike ? 20 : -8) / viewport.scale;
    const paddingX = 3 / viewport.scale;
    const paddingY = 2 / viewport.scale;
    const metrics = ctx.measureText(drawingSnap.active.label);
    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    ctx.fillRect(labelX - paddingX, labelY - 12 / viewport.scale - paddingY, metrics.width + paddingX * 2, 14 / viewport.scale + paddingY * 2);
    ctx.fillStyle = "#f59e0b";
    ctx.fillText(drawingSnap.active.label, labelX, labelY);
    ctx.restore();
  }

  function selectedSketchIdentityElement() {
    if (canvasSelection.arcEndpoint?.arc) return { id: `${canvasSelection.arcEndpoint.arc.id}端点`, sketchId: elementSketchId(canvasSelection.arcEndpoint.arc), item: canvasSelection.arcEndpoint.arc };
    const item = canvasSelection.points.at(-1) || canvasSelection.lines.at(-1) || canvasSelection.circles.at(-1) || canvasSelection.arcs.at(-1) || canvasSelection.splines.at(-1);
    return item ? { id: item.id, sketchId: elementSketchId(item), item } : null;
  }

  function sketchIdentityRelationLabel(sketchId) {
    const relation = sketchRelationToActive(sketchId);
    if (relation === "reference") return applicationText("参照可", "Reference available");
    if (relation === "descendant") return applicationText("参照不可（子孫）", "Not referenceable (descendant)");
    if (relation === "inactive") return applicationText("参照不可", "Not referenceable");
    return "";
  }

  function sketchIdentityRelationColor(sketchId) {
    const relation = sketchRelationToActive(sketchId);
    if (relation === "reference") return "#1d4ed8";
    if (relation === "descendant") return "#b91c1c";
    return "#64748b";
  }

  function sketchIdentityRelationBackground(sketchId) {
    const relation = sketchRelationToActive(sketchId);
    if (relation === "reference") return "rgba(219, 234, 254, 0.96)";
    if (relation === "descendant") return "rgba(254, 226, 226, 0.96)";
    return "rgba(241, 245, 249, 0.96)";
  }

  function drawSketchIdentityLabel() {
    const identity = hoveredSketchIdentity || selectedSketchIdentityElement();
    const pointer = lastPointerWorld;
    if (!identity || !pointer || !isVisibleSketchId(identity.sketchId) || identity.sketchId === activeSketchId()) return;
    const baseLabel = `${identity.label || identity.id} / ${sketchName(identity.sketchId)}`;
    const relationLabel = sketchIdentityRelationLabel(identity.sketchId);
    const separator = relationLabel ? " / " : "";
    ctx.save();
    ctx.font = `${11 / viewport.scale}px system-ui`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    const paddingX = 4 / viewport.scale;
    const paddingY = 2 / viewport.scale;
    const labelX = pointer.x + 14 / viewport.scale;
    const labelY = pointer.y + 26 / viewport.scale;
    const baseWidth = ctx.measureText(baseLabel).width;
    const separatorWidth = ctx.measureText(separator).width;
    const relationWidth = relationLabel ? ctx.measureText(relationLabel).width : 0;
    const width = baseWidth + separatorWidth + relationWidth;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(labelX - paddingX, labelY - 12 / viewport.scale - paddingY, width + paddingX * 2, 14 / viewport.scale + paddingY * 2);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.75)";
    ctx.lineWidth = 1 / viewport.scale;
    ctx.strokeRect(labelX - paddingX, labelY - 12 / viewport.scale - paddingY, width + paddingX * 2, 14 / viewport.scale + paddingY * 2);
    ctx.fillStyle = "#64748b";
    ctx.fillText(baseLabel, labelX, labelY);
    if (relationLabel) {
      const relationX = labelX + baseWidth + separatorWidth;
      const relationPadX = 4 / viewport.scale;
      const relationPadY = 1 / viewport.scale;
      ctx.fillText(separator, labelX + baseWidth, labelY);
      ctx.fillStyle = sketchIdentityRelationBackground(identity.sketchId);
      ctx.fillRect(relationX - relationPadX, labelY - 12 / viewport.scale - relationPadY, relationWidth + relationPadX * 2, 14 / viewport.scale + relationPadY * 2);
      ctx.fillStyle = sketchIdentityRelationColor(identity.sketchId);
      ctx.font = `700 ${11 / viewport.scale}px system-ui`;
      ctx.fillText(relationLabel, relationX, labelY);
    }
    ctx.restore();
  }

  function drawConstructionPoint(point) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5 / viewport.scale, 0, Math.PI * 2);
    ctx.fillStyle = "#eff6ff";
    ctx.fill();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2 / viewport.scale;
    ctx.stroke();
    ctx.restore();
  }

  function shouldShowPrimitiveCenter(point) {
    if (canvasSelection.circles.some((circle) => circle.center === point) || canvasSelection.arcs.some((arc) => arc.center === point)) return true;
    if (hoveredCircle?.center === point || hoveredArc?.center === point || hoveredArcEndpoint?.arc?.center === point) return true;
    if (selectionHighlight.current?.item?.center === point) return true;
    if ((dragSession?.kind === "circle" || dragSession?.kind === "arc" || dragSession?.kind === "arc-endpoint") && dragSession.item?.center === point) return true;
    return false;
  }

  function drawCenterlinePreview() {
    if (mode !== "centerline" || !centerlineCommand.support?.ok) return;
    const preview = pointerPreview ? projectPointToCenterlineSupport(pointerPreview) : null;
    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.fillStyle = "#2563eb";
      ctx.lineWidth = 1.5 / viewport.scale;
      ctx.setLineDash([7 / viewport.scale, 4 / viewport.scale, 1.5 / viewport.scale, 4 / viewport.scale]);
      ctx.beginPath();
      if (centerlineCommand.firstPoint && preview) {
        ctx.moveTo(centerlineCommand.firstPoint.x, centerlineCommand.firstPoint.y);
        ctx.lineTo(preview.x, preview.y);
      } else {
        const halfLength = Math.max(canvas.clientWidth, canvas.clientHeight) * 0.75 / viewport.scale;
        ctx.moveTo(centerlineCommand.support.anchor.x - centerlineCommand.support.ux * halfLength, centerlineCommand.support.anchor.y - centerlineCommand.support.uy * halfLength);
        ctx.lineTo(centerlineCommand.support.anchor.x + centerlineCommand.support.ux * halfLength, centerlineCommand.support.anchor.y + centerlineCommand.support.uy * halfLength);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      for (const point of [centerlineCommand.firstPoint, preview].filter(Boolean)) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3 / viewport.scale, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function shouldShowArcEndpointHandle(arc, endpoint) {
    if (sameArcEndpoint(hoveredArcEndpoint, { arc, endpoint }) || sameArcEndpoint(canvasSelection.arcEndpoint, { arc, endpoint })) return true;
    if (canvasSelection.arcEndpointPair?.some((item) => sameArcEndpoint(item, { arc, endpoint }))) return true;
    if (dragSession?.kind === "arc-endpoint" && dragSession.item === arc && dragSession.endpoint === endpoint) return true;
    return false;
  }

  function drawArcEndpointHandles() {
    ctx.save();
    for (const arc of allGeometryArcs()) {
      if (!isEditableSketchElement(arc)) continue;
      for (const endpoint of ["start", "end"]) {
        if (!shouldShowArcEndpointHandle(arc, endpoint)) continue;
        const p = arcEndpointPoint(arc, endpoint);
        const selected = sameArcEndpoint(canvasSelection.arcEndpoint, { arc, endpoint }) || canvasSelection.arcEndpointPair?.some((item) => sameArcEndpoint(item, { arc, endpoint })) || isConstraintOperandSelected(arc, { arcEndpoint: { arc, endpoint } }) || (dragSession?.kind === "arc-endpoint" && dragSession.item === arc && dragSession.endpoint === endpoint);
        const hovered = sameArcEndpoint(hoveredArcEndpoint, { arc, endpoint });
        const fixed = Boolean(findArcEndpointFixedConstraint(arc, endpoint));
        ctx.beginPath();
        ctx.arc(p.x, p.y, (selected ? 7 : 5) / viewport.scale, 0, Math.PI * 2);
        ctx.fillStyle = fixed ? "#fee2e2" : selected ? "#2563eb" : hovered ? "#eff6ff" : "#fff";
        ctx.fill();
        ctx.strokeStyle = canvasThemeColor(fixed ? "#dc2626" : selected || hovered ? "#2563eb" : "#111827");
        ctx.lineWidth = 2 / viewport.scale;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawPoints() {
    ctx.save();
    for (const p of drawOrderBySketch(allGeometryPoints())) {
      if (isSplineOnlyFitPoint(p) && !isEditableSplineFitPoint(p)) continue;
      const appearance = effectiveAppearanceForElement(p);
      if (!viewState.constraintStatus && !p.blockProjection && !p.derivedProjection && !isExplicitPoint(p) && !isPointUsedByPrimitive(p) && !isReferencePoint(p)) continue;
      const active = isEditableSketchElement(p);
      ctx.globalAlpha = sketchAlpha(p);
      const refSelected = isPendingReferenceTarget(p) || isConstraintOperandSelected(p);
      const treeHovered = isSidebarHighlightedElement(p) && !p.blockProjection && !isAnyLineEndpoint(p);
      const sidebarHovered = isSidebarHoveredElement(p);
      const relatedHighlighted = isSelectedConstraintRelatedElement(p);
      const auxiliaryHighlighted = relatedHighlighted;
      const sel = (active && canvasSelection.points.includes(p)) || refSelected || ownerInstanceSelected(p);
      const endpoint = isEndpointPoint(p);
      const canvasHovered = (active || isReferenceHoverElement(p)) && (hoveredPoint === p || hoveredEndpointPoint === p);
      if (viewState.constraintStatus && p.kind === "endpoint" && !canvasHovered && !sel) continue;
      const hovered = treeHovered || sidebarHovered || canvasHovered || ownerInstanceHovered(p);
      const dragging = dragSession?.kind === "point" && dragSession.points.some((target) => target.point === p);
      const primitiveCenter = shouldShowPrimitiveCenter(p);
      const fixedByLine = pointLockedByLineFixed(p);
      const fixedHighlighted = (!p.derivedProjection && p.fixed || fixedByLine) && (sel || hovered);
      const reference = isReferencePoint(p);
      if (!viewState.constraintStatus && (p.blockProjection || p.derivedProjection) && !sel && !hovered && !dragging && !primitiveCenter && !auxiliaryHighlighted) continue;
      if (!viewState.constraintStatus && reference && !sel && !hovered && !dragging && !auxiliaryHighlighted) continue;
      if (!viewState.constraintStatus && endpoint && !reference && !sel && !hovered && !dragging && !primitiveCenter && !auxiliaryHighlighted) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (sel || auxiliaryHighlighted ? 7 : endpoint || reference ? 5 : 5) / viewport.scale, 0, Math.PI * 2);
      ctx.fillStyle = fixedHighlighted ? "#fee2e2" : sel ? "#1d4ed8" : auxiliaryHighlighted ? "#e0f2fe" : hovered || primitiveCenter || reference ? "#eff6ff" : "#fff";
      ctx.fill();
      ctx.strokeStyle = auxiliaryHighlighted ? "#0ea5e9" : fixedHighlighted ? "#dc2626" : geometryDisplayColor(p, appearance, sel, hovered || primitiveCenter || reference);
      ctx.lineWidth = (sel || auxiliaryHighlighted ? 3 : Math.max(1.2, sketchStrokeWidth(p))) / viewport.scale;
      ctx.shadowColor = sel || auxiliaryHighlighted ? "rgba(14, 165, 233, 0.45)" : "transparent";
      ctx.shadowBlur = sel || auxiliaryHighlighted ? 8 / viewport.scale : 0;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
      if (viewState.geometryIds || sel || sidebarHovered || canvasHovered || dragging || relatedHighlighted) {
        ctx.fillStyle = canvasThemeColor(hovered || endpoint ? "#2563eb" : "#111827");
        ctx.font = `${12 / viewport.scale}px system-ui`;
        ctx.fillText(p.id, p.x + 8 / viewport.scale, p.y - 8 / viewport.scale);
      }

      if (p.fixed && !p.derivedProjection && (sel || hovered)) {
        ctx.fillStyle = "#dc2626";
        ctx.font = `${12 / viewport.scale}px system-ui`;
        ctx.fillText(applicationText("固定", "Fixed"), p.x + 8 / viewport.scale, p.y + 8 / viewport.scale);
      }
    }
    ctx.restore();
  }

  function updateToolbar() {
    const geometryMode = isGeometryMode();
    const constructionState = constructionToggleState(geometryMode);
    const states = {
      toolSelect: geometryMode && mode === "select" && !pendingConstraintCommand && !pendingCommand,
      toolPoint: geometryMode && mode === "point",
      toolLine: geometryMode && mode === "line",
      toolCenterline: geometryMode && mode === "centerline",
      toolCircleCenterCross: geometryMode && mode === "circle-center-cross",
      toolConstructionLine: constructionState.active,
      toolRectangle: geometryMode && mode === "rectangle",
      toolSlot: geometryMode && mode === "slot",
      toolCreateBlock: false,
      toolFillet: geometryMode && mode === "fillet",
      toolTrim: geometryMode && mode === "trim",
      toolOffset: geometryMode && mode === "offset",
      toolCircle: geometryMode && mode === "circle",
      toolArc: geometryMode && mode === "arc",
      toolThreePointArc: geometryMode && mode === "three-point-arc",
      toolSpline: geometryMode && mode === "spline",
      toolSketchProjection: geometryMode && mode === "sketch-projection",
      toolFreeInstance: geometryMode && mode.startsWith("free-instance-"),
      toolMirror: geometryMode && mode === "mirror-axis",
      toolPattern: geometryMode && mode === "pattern-direction",
      toolHatch: geometryMode && (mode === "hatch" || mode === "hatch-repair"),
      annotationLeaderBtn: Boolean(pendingCommand?.type?.startsWith("annotation-leader")),
      annotationTextBtn: pendingCommand?.type === "annotation-text-place",
    };
    for (const [id, active] of Object.entries(states)) {
      const button = document.getElementById(id);
      if (!button) continue;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-disabled", String(!geometryMode));
    }
    for (const id of ["toolCreateBlock"]) {
      const button = document.getElementById(id);
      if (button) button.disabled = !geometryMode;
    }
    updateHistoryButtons();
    commandCursor.update({ pendingType: pendingCommand?.type, constraintType: pendingConstraintCommand?.type,
      splineEditing: Boolean(splineEditSession), mode });
  }

  function constructionToggleState(geometryMode = isGeometryMode()) {
    if (!geometryMode) return { active: false, mixed: false };
    const primitives = selectedConstructionTogglePrimitives();
    if (primitives.length > 0) {
      const constructionCount = primitives.filter((item) => item.construction).length;
      return {
        active: constructionCount === primitives.length,
        mixed: false,
      };
    }
    return { active: constructionLineMode, mixed: false };
  }

  function canApplyConstraint(type) {
    if (!isGeometryMode()) return false;
    if (pendingConstraintCommand?.type === type && constraintOperands.length > 0) {
      const resolution = resolveConstraintIntent(type, constraintOperands);
      return Boolean(resolution && !resolution.error && (resolution.constraint || resolution.target || resolution.action));
    }
    return canApplyConstraintToSelection(type);
  }

  function canApplyConstraintToSelection(type) {
    return canApplyConstraintToTargets(type, currentConstraintTargets(), activeSketchId());
  }

  function canCompleteConstraintCommand(type) {
    if (constraintOperands.length > 0) {
      const resolution = resolveConstraintIntent(type, constraintOperands);
      if (!resolution || resolution.error) return false;
      if (type === "distance") return Boolean(resolution.target);
      return Boolean(resolution.constraint);
    }
    if (type !== "distance") return canApplyConstraint(type);
    const target = distanceTargetFromSelection();
    if (!target || target.kind === "invalid") return false;
    return target.kind !== "line-length" || !pendingConstraintCommand;
  }

  function constraintLabel(type) {
    if (type === "fixed") return applicationText("固定", "Fix");
    const btn = constraintButtons.find((b) => b.dataset.constraint === type);
    return btn?.dataset.label || btn?.title || type;
  }

  function constraintTargetHint(type) {
    if (type === "fixed") return applicationText("固定／解除する点、線、円、円弧、円弧端点を選択してください。ブロック内も図形単位で固定します。Escで終了します。", "Select a point, line, circle, arc, or arc endpoint to fix/unfix. Geometry inside blocks is fixed individually. Press Esc to finish.");
    if (type === "distance") {
      if (constraintOperands.length === 1 && constraintOperands[0]?.kind === "line") {
        return applicationText("2本目の線を選ぶと線間・角度寸法、円を選ぶと円中心距離寸法、空白をクリックすると線長寸法になります。Enterまたは同じ線のダブルクリックでも線長を確定できます。", "Select a second line for a line-to-line or angle dimension, a circle for a center-to-line dimension, or click empty space for a line-length dimension. Enter or double-clicking the same line also confirms line length.");
      }
      if (constraintOperands.length === 1 && constraintOperands[0]?.kind === "primitive") {
        return applicationText("円の場合は線を選ぶと円中心距離寸法、円または円弧では同心の円／円弧を選ぶと半径差寸法になります。空白をクリックすると単独の半径／直径寸法になります。", "After a circle, select a line for a center-to-line dimension. After a circle or arc, select a concentric circle/arc for a radius-difference dimension. Click empty space for the primitive's radius/diameter dimension.");
      }
      return applicationText("寸法対象を選択してください。", "Select dimension targets.");
    }
    if (type === "concentric") return applicationText("同心にする円/円弧を2つ、または点と円/円弧を選択してください", "Select two circles/arcs, or a point and a circle/arc, to make them concentric.");
    if (type === "equalRadius") return applicationText("同じ半径にする円または円弧を2つ選択してください", "Select two circles or arcs to give them equal radii.");
    if (type === "pointOnCircle") return applicationText("円周上に置く点と、円または円弧を選択してください", "Select a point and a circle or arc to place the point on its circumference.");
    if (type === "tangent") return applicationText("接線にする線と円/円弧/スプライン、円/円弧を2つ、またはスプラインを2つ選択してください", "Select a line and a circle/arc/spline, two circles/arcs, or two splines to make them tangent.");
    if (type === "coincident") return applicationText("一致させる点同士、点と線、点と円周、または同一線上にする線2本を選択してください", "Select two points, a point and line, a point and circumference, or two lines to make coincident.");
    if (type === "collinear") return applicationText("同一直線上にする線を2本選択してください", "Select two lines to make them collinear.");
    if (type === "equal") return applicationText("等寸にする線2本、または同じ半径にする円/円弧を2つ選択してください", "Select two lines for equal length, or two circles/arcs for equal radii.");
    if (type === "horizontal") return applicationText("水平にする線1本、または水平関係にする点2つを選択してください", "Select one line to make horizontal, or two points to align horizontally.");
    if (type === "vertical") return applicationText("垂直にする線1本、または鉛直関係にする点2つを選択してください", "Select one line to make vertical, or two points to align vertically.");
    if (type === "parallel") return applicationText("平行にする線を2本選択してください", "Select two lines to make parallel.");
    if (type === "perpendicular") return applicationText("直交させる線を2本選択してください", "Select two lines to make perpendicular.");
    if (type === "symmetry") {
      if (constraintOperands.length === 0) return applicationText("最初に対称軸にする線を選択してください", "First select the symmetry-axis line.");
      if (constraintOperands.length === 1) return applicationText("対称にする1つ目の点、線、または円弧を選択してください", "Select the first point, line, or arc to mirror.");
      const subjectKind = constraintOperands[1]?.kind === "line" ? applicationText("線", "line") : constraintOperands[1]?.kind === "primitive" ? applicationText("円弧", "arc") : applicationText("点", "point");
      return applicationSettings.language === "en" ? `Select the second ${subjectKind} to mirror.` : `対称にする2つ目の${subjectKind}を選択してください`;
    }
    return applicationSettings.language === "en" ? `Select targets for ${constraintLabel(type)}.` : `${constraintLabel(type)} の対象を選択してください`;
  }

  function invalidConstraintTargetHint(type) {
    if (applicationSettings.language === "en") {
      if (type === "symmetry") {
        if (constraintOperands.length === 0) return "Select a line as the symmetry axis for the first target.";
        if (constraintOperands.length === 1) return "Select a point, line, or arc to mirror for the second target.";
        return `Select a ${constraintOperands[1]?.kind === "line" ? "line" : constraintOperands[1]?.kind === "primitive" ? "arc" : "point"} matching the second target type.`;
      }
      const hints = {
        concentric: "Select two circles/arcs, or a point and a circle/arc, for this constraint.",
        equalRadius: "Select two circles or arcs for this constraint.",
        pointOnCircle: "Select a point and a circle or arc for this constraint.",
        tangent: "Select a line and a circle/arc/spline, two circles/arcs, or two splines for this constraint.",
        coincident: "Select points, lines, circles, arcs, or splines supported by this constraint.",
        collinear: "Select two lines for this constraint.", equal: "Select two lines or two circles/arcs for this constraint.",
        horizontal: "Select one line or two points for this constraint.", vertical: "Select one line or two points for this constraint.",
        parallel: "Select lines for this constraint.", perpendicular: "Select lines for this constraint.", distance: "Select points, lines, circles, or arcs as dimension targets.",
      };
      return hints[type] || "The current selection cannot be used for this constraint.";
    }
    if (type === "concentric") return "この拘束では円/円弧を2つ、または点と円/円弧を選択してください";
    if (type === "equalRadius") return "この拘束では円または円弧を2つ選択してください";
    if (type === "pointOnCircle") return "この拘束では点と円または円弧を選択してください";
    if (type === "tangent") return "この拘束では線と円/円弧/スプライン、円/円弧を2つ、またはスプラインを2つ選択してください";
    if (type === "coincident") return "この拘束では点、線、円、円弧またはスプラインを選択してください";
    if (type === "collinear") return "この拘束では線を2本選択してください";
    if (type === "equal") return "この拘束では線2本、または円/円弧を2つ選択してください";
    if (type === "horizontal" || type === "vertical") {
      return "この拘束では線1本、または点2つを選択してください";
    }
    if (type === "parallel" || type === "perpendicular") {
      return "この拘束では線を選択してください";
    }
    if (type === "symmetry") {
      if (constraintOperands.length === 0) return "最初の対象には対称軸にする線を選択してください";
      if (constraintOperands.length === 1) return "2番目の対象には対称にする点、線、または円弧を選択してください";
      return `3番目の対象には2番目と同じ種類の${constraintOperands[1]?.kind === "line" ? "線" : constraintOperands[1]?.kind === "primitive" ? "円弧" : "点"}を選択してください`;
    }
    if (type === "distance") return "寸法対象として点、線、円または円弧を選択してください";
    return "この拘束では選択できません";
  }

  function startConstraintTargetCommand(type) {
    cancelPendingCommand("");
    resetCenterlineCommandState();
    resetSlotCommandState();
    mode = "select";
    lineCommand.reset();
    rectangleCommand.reset();
    filletCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    pointerPreview = null;
    trimPreview = null;
    updateToolbar();
    if (pendingConstraintCommand?.type === type) {
      cancelConstraintTargetCommand(`${constraintLabel(type)}の対象選択をキャンセルしました`);
      return;
    }
    if (type === "symmetry") clearSelection();
    constraintOperands = type === "symmetry" ? [] : constraintOperandsFromSelection();
    pendingConstraintCommand = { type };
    trimConstraintSelection(type);
    if (constraintOperands.length > 0) {
      const resolution = resolveConstraintIntent(type, constraintOperands);
      if (resolution?.action === "place-dimension") {
        startDistanceResolution(resolution, null);
        return;
      }
      if (resolution?.action === "commit" && resolution.constraint) {
        commitConstraintResolution(resolution);
        return;
      }
      syncSelectionFromConstraintOperands();
    }
    updateToolbar();
    updateConstraintButtons();
    setHint(constraintTargetHint(type));
    draw();
  }

  function cancelConstraintTargetCommand(message = "拘束対象の選択をキャンセルしました") {
    if (mode === "centerline") resetCenterlineCommandState();
    if (mode === "slot") resetSlotCommandState();
    if (!pendingConstraintCommand) return;
    pendingConstraintCommand = null;
    constraintOperands = [];
    if (message) setHint(message);
    updateConstraintButtons();
    updateToolbar();
    if (document.activeElement instanceof HTMLElement && document.activeElement.matches("[data-constraint], #fixPointBtn")) {
      document.activeElement.blur();
    }
    draw();
  }

  function executeConstraintCommandIfReady() {
    if (!pendingConstraintCommand) return false;
    const type = pendingConstraintCommand.type;
    if (constraintOperands.length > 0) {
      const resolution = resolveConstraintIntent(type, constraintOperands);
      if (resolution?.error) {
        setHint(resolution.error, "error");
        return false;
      }
      if (resolution?.action === "place-dimension") {
        startDistanceResolution(resolution, null);
        return true;
      }
      if (resolution?.action === "commit" && resolution.constraint) {
        commitConstraintResolution(resolution);
        return true;
      }
      setHint(constraintTargetHint(type));
      return false;
    }
    if (!canCompleteConstraintCommand(type)) {
      const target = type === "distance" ? distanceTargetFromSelection() : null;
      if (target?.kind === "invalid") {
        setHint(target.reason, "error");
        return false;
      }
      if (target?.kind === "line-length") {
        updateConstraintButtons();
        startDistanceCommand();
        return true;
      }
      setHint(constraintTargetHint(type));
      return false;
    }
    updateConstraintButtons();
    addConstraint(type);
    return true;
  }

  function completePendingDimensionLineLength() {
    if (pendingConstraintCommand?.type !== "distance") return false;
    const target = distanceTargetFromSelection();
    if (!target || target.kind !== "line-length") return false;
    updateConstraintButtons();
    startDistanceCommand();
    return true;
  }

  function hitConstraintOperand(pointer, type, hits = {}) {
    const hitP = hits.hitP ?? hitPoint(pointer.x, pointer.y);
    const hitL = hits.hitL ?? hitLine(pointer.x, pointer.y);
    const hitC = hits.hitC ?? hitCircle(pointer.x, pointer.y);
    const hitA = hits.hitA ?? hitArc(pointer.x, pointer.y);
    const hitS = hits.hitS ?? hitSpline(pointer.x, pointer.y);
    const hitArcEnd = hits.hitArcEnd ?? hitArcEndpoint(pointer.x, pointer.y);
    if (type === "symmetry") {
      const subjectKind = constraintOperands[1]?.kind || null;
      if (constraintOperands.length === 0 && hitL) return makeConstraintOperand("line", { line: hitL });
      if (subjectKind === "point" && hitP) return makeConstraintOperand("point", { point: hitP });
      if (subjectKind === "line" && hitL) return makeConstraintOperand("line", { line: hitL });
      if (subjectKind === "primitive" && hitA) return makeConstraintOperand("primitive", { primitive: hitA });
      if (!subjectKind && hitP) return makeConstraintOperand("point", { point: hitP });
      if (!subjectKind && hitL) return makeConstraintOperand("line", { line: hitL });
      if (!subjectKind && hitA) return makeConstraintOperand("primitive", { primitive: hitA });
    }
    if (hitArcEnd && (type === "coincident" || type === "pointOnCircle" || type === "fixed" || type === "horizontal" || type === "vertical")) return makeConstraintOperand("arc-endpoint", { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint });
    if (hitP) return makeConstraintOperand("point", { point: hitP });
    if (hitL) return makeConstraintOperand("line", { line: hitL });
    if (hitC || hitA) {
      const primitive = hitC || hitA;
      return makeConstraintOperand("primitive", { primitive, hitPoint: circlePointAtPointer(pointer, primitive) });
    }
    if (hitS) {
      const closest = window.SplineGeometry.closestPoint(hitS.curve(), pointer, { samplesPerSpan: 28 });
      const parameter = closest?.t ?? 0;
      return makeConstraintOperand("spline", { spline: hitS, parameter, endpoint: parameter <= 0.5 ? "start" : "end" });
    }
    const blockOperand = hitDerivedProjectionOperand(pointer.x, pointer.y) || hitBlockProjectionOperand(pointer.x, pointer.y);
    if (blockOperand) return blockOperand;
    return operandFromReferenceTarget(hitReferenceTarget(pointer.x, pointer.y));
  }

  function constraintOperandLimit(type, operands) {
    if (type === "distance") return 2;
    if (type === "horizontal" || type === "vertical") return operands.some((operand) => operand.kind === "point" || operand.kind === "arc-endpoint") ? 2 : 1;
    if (type === "symmetry") return 3;
    return 2;
  }

  function appendConstraintOperand(type, operand) {
    if (!operand) return { ok: false, error: invalidConstraintTargetHint(type) };
    if (type === "symmetry") {
      const step = constraintOperands.length;
      if (step === 0 && operand.kind !== "line") return { ok: false, error: invalidConstraintTargetHint(type) };
      if (step > 0 && operand.kind !== "point" && operand.kind !== "line" && !(operand.kind === "primitive" && operand.primitive instanceof Arc)) return { ok: false, error: invalidConstraintTargetHint(type) };
      if (operand.kind === "line" && !lineHasDirection(operand.line)) return { ok: false, error: step === 0 ? "対称軸の線が短すぎます" : "対称対象の線が短すぎます" };
      if (constraintOperands.some((existing) => sameConstraintOperand(existing, operand))) return { ok: false, error: "対称軸と2つの対象には異なる要素を選択してください" };
      if (step >= 2 && operand.kind !== constraintOperands[1].kind) return { ok: false, error: invalidConstraintTargetHint(type) };
      if (step >= 3) return { ok: false, error: "対称拘束の対象はすでに3つ選択されています" };
      constraintOperands = [...constraintOperands, operand];
      syncSelectionFromConstraintOperands();
      return { ok: true };
    }
    if ((type === "parallel" || type === "perpendicular" || type === "collinear") && operand.kind !== "line") return { ok: false, error: invalidConstraintTargetHint(type) };
    if ((type === "parallel" || type === "perpendicular" || type === "collinear") && !lineHasDirection(operand.line)) return { ok: false, error: "向き拘束の対象線が短すぎます" };
    if ((type === "horizontal" || type === "vertical") && operand.kind !== "line" && operand.kind !== "point" && operand.kind !== "arc-endpoint") return { ok: false, error: invalidConstraintTargetHint(type) };
    if (type === "tangent" && operand.kind !== "line" && operand.kind !== "primitive" && operand.kind !== "spline") return { ok: false, error: invalidConstraintTargetHint(type) };
    if (operand.kind === "spline" && type !== "coincident" && type !== "tangent") return { ok: false, error: invalidConstraintTargetHint(type) };
    if ((type === "equal" || type === "equalRadius" || type === "concentric") && operand.kind !== "line" && operand.kind !== "primitive" && operand.kind !== "point") return { ok: false, error: invalidConstraintTargetHint(type) };
    if (type === "pointOnCircle" && operand.kind !== "point" && operand.kind !== "primitive" && operand.kind !== "arc-endpoint") return { ok: false, error: invalidConstraintTargetHint(type) };
    if (type === "distance" && operand.kind === "arc-endpoint") return { ok: false, error: invalidConstraintTargetHint(type) };

    let next = constraintOperands.filter((existing) => !sameConstraintOperand(existing, operand));
    next.push(operand);
    const limit = constraintOperandLimit(type, next);
    if (next.length > limit) next = next.slice(next.length - limit);
    constraintOperands = next;
    syncSelectionFromConstraintOperands();
    return { ok: true };
  }

  function handleConstraintOperandClick(pointer, type, hits = {}) {
    const operand = hitConstraintOperand(pointer, type, hits);
    if (type === "fixed") {
      const supported = operand && (["point", "line", "arc-endpoint"].includes(operand.kind) || (operand.kind === "primitive" && (operand.primitive instanceof Circle || operand.primitive instanceof Arc)));
      if (!supported || operand.relation !== "active" || operand.element?.derivedProjection) {
        setHint(constraintTargetHint(type), "error");
        return true;
      }
      clearSelection();
      constraintOperands = [operand];
      syncSelectionFromConstraintOperands();
      const command = pendingConstraintCommand;
      const individualGeometry = operand.element?.blockProjection || operand.kind === "primitive";
      if (individualGeometry ? toggleGeometryFixedOperand(operand) : toggleSelectedFixed()) clearSelection();
      pendingConstraintCommand = command;
      updateGeometrySelectionUI();
      updateToolbar();
      updateConstraintButtons();
      draw();
      return true;
    }
    if (!operand && type === "distance") {
      const resolution = resolveConstraintIntent(type, constraintOperands);
      if (resolution?.action === "place-dimension" && resolution.target?.kind === "line-length") {
        startDistanceResolution(resolution, pointer);
        startDistanceValueInput(pointer);
        return true;
      }
    }
    const added = appendConstraintOperand(type, operand);
    if (!added.ok) {
      setHint(added.error, "error");
      return true;
    }
    const resolution = resolveConstraintIntent(type, constraintOperands);
    if (resolution?.error) {
      setHint(resolution.error, "error");
      draw();
      return true;
    }
    if (resolution?.action === "place-dimension") {
      if (resolution.target?.kind === "line-length" && constraintOperands.length === 1) {
        startDistanceResolution(resolution, pointer);
        return true;
      }
      startDistanceResolution(resolution, null);
      return true;
    }
    if (resolution?.action === "commit" && resolution.constraint) {
      commitConstraintResolution(resolution);
      return true;
    }
    updateGeometrySelectionUI();
    setHint(constraintTargetHint(type));
    draw();
    return true;
  }

  function handleConstraintTargetClick(hitP, hitL, hitC, hitA, hitArcEnd) {
    if (!pendingConstraintCommand) return false;
    const type = pendingConstraintCommand.type;
    canvasSelection.set("dimensionConstraint", null);
    const hitPrimitive = hitC || hitA;

    if (type === "coincident") {
      if (!hitP && !hitL && !hitPrimitive && !hitArcEnd) {
        setHint(invalidConstraintTargetHint(type), "error");
        return true;
      }
      if (hitArcEnd) {
        const next = { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint };
        if (canvasSelection.arcEndpoint && !sameArcEndpoint(canvasSelection.arcEndpoint, next)) canvasSelection.set("arcEndpointPair", [canvasSelection.arcEndpoint, next]);
        canvasSelection.set("arcEndpoint", next);
      } else if (hitP) {
        canvasSelection.set("arcEndpointPair", null);
        if (!canvasSelection.points.includes(hitP)) canvasSelection.append("points", hitP);
        canvasSelection.set("points", canvasSelection.points.slice(-2));
        if (canvasSelection.points.length >= 2) canvasSelection.set("lines", []);
      } else if (hitL) {
        canvasSelection.set("arcEndpointPair", null);
        if (canvasSelection.points.length > 0) {
          canvasSelection.set("lines", [hitL]);
          canvasSelection.set("points", canvasSelection.points.slice(0, 1));
        } else {
          if (!canvasSelection.lines.includes(hitL)) canvasSelection.append("lines", hitL);
          canvasSelection.set("lines", canvasSelection.lines.slice(-2));
        }
        canvasSelection.set("circles", []);
        canvasSelection.set("arcs", []);
      } else if (hitPrimitive) {
        canvasSelection.set("arcEndpointPair", null);
        pushPrimitiveSelection(hitPrimitive);
        canvasSelection.set("points", canvasSelection.points.slice(0, 1));
        canvasSelection.set("lines", []);
      }
    } else if (type === "horizontal" || type === "vertical") {
      if (!hitL && !hitP) {
        setHint(invalidConstraintTargetHint(type), "error");
        return true;
      }
      if (hitP) {
        canvasSelection.set("lines", []);
        if (!canvasSelection.points.includes(hitP)) canvasSelection.append("points", hitP);
        canvasSelection.set("points", canvasSelection.points.slice(-2));
      } else if (!lineHasDirection(hitL)) {
        setHint("向き拘束の対象線が短すぎます", "error");
        return true;
      } else {
        canvasSelection.set("lines", [hitL]);
        canvasSelection.set("points", []);
      }
    } else if (type === "parallel" || type === "perpendicular" || type === "collinear") {
      if (!hitL) {
        setHint(invalidConstraintTargetHint(type), "error");
        return true;
      }
      if (!lineHasDirection(hitL)) {
        setHint("向き拘束の対象線が短すぎます", "error");
        return true;
      }
      canvasSelection.set("points", []);
      if (!canvasSelection.lines.includes(hitL)) canvasSelection.append("lines", hitL);
      canvasSelection.set("lines", canvasSelection.lines.slice(-2));
    } else if (type === "distance") {
      if (!hitP && !hitL && !hitPrimitive) {
        const target = distanceTargetFromSelection();
        if (target?.kind === "line-length") {
          setHint("線の長さ寸法は、配置したい位置をダブルクリックしてください");
          return true;
        }
        setHint(invalidConstraintTargetHint(type), "error");
        return true;
      }
      if (hitP) {
        if (!canvasSelection.points.includes(hitP)) canvasSelection.append("points", hitP);
        canvasSelection.set("points", canvasSelection.points.slice(-2));
        canvasSelection.set("lines", canvasSelection.lines.slice(0, 1));
      } else if (hitL) {
        if (!canvasSelection.lines.includes(hitL)) canvasSelection.append("lines", hitL);
        canvasSelection.set("lines", canvasSelection.lines.slice(-2));
        canvasSelection.set("points", canvasSelection.points.slice(0, 1));
        canvasSelection.set("circles", []);
        canvasSelection.set("arcs", []);
      } else if (hitPrimitive) {
        canvasSelection.set("points", []);
        canvasSelection.set("lines", []);
        canvasSelection.set("circles", []);
        canvasSelection.set("arcs", []);
        pushPrimitiveSelection(hitPrimitive);
      }
      trimConstraintSelection(type);
    } else if (type === "equal") {
      if (hitL) {
        canvasSelection.set("points", []);
        canvasSelection.set("circles", []);
        canvasSelection.set("arcs", []);
        if (!canvasSelection.lines.includes(hitL)) canvasSelection.append("lines", hitL);
        canvasSelection.set("lines", canvasSelection.lines.slice(-2));
      } else if (hitPrimitive) {
        canvasSelection.set("points", []);
        canvasSelection.set("lines", []);
        pushPrimitiveSelection(hitPrimitive);
      } else {
        setHint(invalidConstraintTargetHint(type), "error");
        return true;
      }
      trimConstraintSelection(type);
    } else if (type === "concentric" || type === "equalRadius" || type === "pointOnCircle" || type === "tangent") {
      if (hitP && (type === "concentric" || type === "pointOnCircle")) {
        if (!canvasSelection.points.includes(hitP)) canvasSelection.append("points", hitP);
        canvasSelection.set("points", canvasSelection.points.slice(-1));
      } else if (hitL && type === "tangent") {
        canvasSelection.set("lines", [hitL]);
      } else if (hitPrimitive) {
        pushPrimitiveSelection(hitPrimitive);
      } else {
        setHint(invalidConstraintTargetHint(type), "error");
        return true;
      }
      trimConstraintSelection(type);
    }

    updateUI();
    if (!executeConstraintCommandIfReady()) draw();
    return true;
  }

  function handleConstraintTargetDoubleClick(hitP, hitL, pointer) {
    if (pendingConstraintCommand?.type !== "distance") return false;
    if (canvasSelection.points.length !== 0 || canvasSelection.lines.length !== 1) return false;
    if (hitL && canvasSelection.lines[0] !== hitL) return false;
    updateConstraintButtons();
    startDistanceCommand();
    if (pendingCommand?.type === "distance-place") startDistanceValueInput(defaultDimensionForTarget(pendingCommand.target));
    return true;
  }

  function startDistanceCommand() {
    if (constraintOperands.length === 0) constraintOperands = constraintOperandsFromSelection();
    const resolution = constraintResolutionFromCurrentSelection("distance");
    if (!resolution) return;
    if (resolution.error) {
      setHint(resolution.error, "error");
      log(resolution.error);
      return;
    }
    mode = "select";
    lineCommand.reset();
    rectangleCommand.reset();
    filletCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    pointerPreview = null;
    trimPreview = null;
    pendingConstraintCommand = { type: "distance" };
    pendingCommand = {
      type: "distance-place",
      target: resolution.target,
      resolution,
      pointer: defaultDimensionForTarget(resolution.target),
      operands: resolution.operands || constraintOperands.slice(),
      referenceSketchId: resolution.referenceSketchId,
      sketchId: resolution.sketchId,
    };
    updateConstraintButtons();
    updateToolbar();
    setHint("寸法線の位置をクリックしてください");
    draw();
  }

  function startPrimitiveDimensionCommand(kind) {
    const primitive = selectedPrimitives()[0];
    if (!primitive) return;
    const value = kind === "diameter" ? primitive.radius() * 2 : primitive.radius();
    mode = "select";
    lineCommand.reset();
    rectangleCommand.reset();
    filletCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    pointerPreview = null;
    trimPreview = null;
    pendingConstraintCommand = { type: "distance" };
    pendingCommand = { type: "distance-place", target: { kind, primitive, value }, pointer: defaultDimensionForTarget({ kind, primitive, value }) };
    updateConstraintButtons();
    updateToolbar();
    setHint("寸法線の位置をクリックしてください");
    draw();
  }

  function cancelPendingCommand(message = "コマンドをキャンセルしました") {
    geometryInstanceCommand.clearPlacement();
    if (!pendingCommand) return;
    if (pendingCommand.type === "offset-value") {
      offsetSelection.reset();
      pointerPreview = null;
    }
    pendingCommand = null;
    hideDimensionValueInput();
    if (message) setHint(message);
    updateToolbar();
    updateConstraintButtons();
    draw();
  }

  function startDistanceValueInput(pointer) {
    if (!pendingCommand || pendingCommand.type !== "distance-place") return;
    const referenceSketchId = pendingCommand.referenceSketchId;
    const sketchId = pendingCommand.sketchId;
    const dimension = dimensionWithLabelAt(
      pendingCommand.target,
      applyDefaultCircleDimensionLabelOffset(pendingCommand.target, dimensionFromAnchor(pendingCommand.target, pointer)),
      pointer,
    );
    const target = { ...pendingCommand.target, dimensionAxis: dimension.axis };
    const value =
      pendingCommand.target.kind === "point-point" && dimension.axis === "x"
        ? Math.abs(pendingCommand.target.p2.x - pendingCommand.target.p1.x)
        : pendingCommand.target.kind === "point-point" && dimension.axis === "y"
          ? Math.abs(pendingCommand.target.p2.y - pendingCommand.target.p1.y)
          : pendingCommand.target.kind === "angle"
            ? angleDegrees(angleDimensionAngles(pendingCommand.target, pointer, dimension).signed)
          : pendingCommand.target.value;
    const readOnlyConstraint = readOnlyDimensionConstraintForPlacement(target, value, dimension, { referenceSketchId, sketchId });
    if (readOnlyConstraint) {
      pendingCommand = null;
      hideDimensionValueInput();
      addReadOnlyDimensionConstraint(readOnlyConstraint, sketchId || activeSketchId(), referenceSketchId ? "重複参照寸法" : "重複寸法");
      return;
    }
    pendingCommand = {
      type: "distance-value",
      target,
      dimension,
      buffer: String(value),
      editing: false,
      referenceSketchId,
      sketchId,
    };
    setHint(applicationText("寸法値を入力中: 数式は = から開始し、Parameter参照はダブルクオーテーションで括ります。Canvas寸法のクリックで参照を挿入できます", "Editing dimension: begin expressions with = and enclose parameter references in double quotes. Click a canvas dimension to insert a reference."));
    updateConstraintButtons();
    syncDimensionValueInput();
    draw();
    focusDimensionValueInput();
  }

  function retargetDistancePlaceWithOperand(pointer, hits = {}) {
    if (pendingCommand?.type !== "distance-place" || !["line-length", "radius", "diameter"].includes(pendingCommand.target.kind)) return false;
    let baseOperands = pendingCommand.operands?.length ? pendingCommand.operands : [];
    if (baseOperands.length === 0 && pendingCommand.target.kind === "line-length") {
      baseOperands = [makeConstraintOperand("line", { line: pendingCommand.target.line })];
    } else if (baseOperands.length === 0 && (pendingCommand.target.kind === "radius" || pendingCommand.target.kind === "diameter")) {
      baseOperands = [makeConstraintOperand("primitive", { primitive: pendingCommand.target.primitive })];
    }
    baseOperands = baseOperands.filter(Boolean);
    if (baseOperands.length !== 1) return false;
    const operand = hitConstraintOperand(pointer, "distance", hits);
    if (!operand || sameConstraintOperand(baseOperands[0], operand)) return false;
    const resolution = resolveConstraintIntent("distance", [baseOperands[0], operand]);
    if (resolution?.error) {
      setHint(resolution.error, "error");
      return true;
    }
    if (!resolution?.target) return false;
    startDistanceResolution(resolution, null);
    pendingCommand.pointer = pointer;
    pendingCommand.dimension = null;
    return true;
  }

  function applyReferenceHoverTarget(referenceTarget) {
    hoveredPoint = referenceTarget?.kind === "point" ? referenceTarget.point : null;
    hoveredEndpointPoint = hoveredPoint;
    hoveredLine = referenceTarget?.kind === "line" ? referenceTarget.line : null;
    hoveredCircle = referenceTarget?.primitive instanceof Circle ? referenceTarget.primitive : null;
    hoveredArc = referenceTarget?.primitive instanceof Arc ? referenceTarget.primitive : null;
    hoveredArcEndpoint = null;
    hoveredDimensionConstraint = null;
  }

  function updatePendingDistanceRetargetHover(pointer) {
    if (pendingCommand?.type !== "distance-place" || !["line-length", "radius", "diameter"].includes(pendingCommand.target.kind)) {
      hoveredPoint = null;
      hoveredEndpointPoint = null;
      hoveredLine = null;
      hoveredCircle = null;
      hoveredArc = null;
      return false;
    }
    const baseOperands = (pendingCommand.operands || []).filter(Boolean);
    const operand = baseOperands.length === 1 ? hitConstraintOperand(pointer, "distance") : null;
    const resolution = operand && !sameConstraintOperand(baseOperands[0], operand)
      ? resolveConstraintIntent("distance", [baseOperands[0], operand])
      : null;
    const target = resolution?.target && resolution.target.kind !== "invalid" ? referenceTargetFromOperand(operand) : null;
    const changed =
      (target?.kind === "point" ? target.point : null) !== hoveredPoint ||
      (target?.kind === "line" ? target.line : null) !== hoveredLine ||
      (target?.primitive instanceof Circle ? target.primitive : null) !== hoveredCircle ||
      (target?.primitive instanceof Arc ? target.primitive : null) !== hoveredArc ||
      hoveredArcEndpoint ||
      hoveredDimensionConstraint;
    applyReferenceHoverTarget(target);
    hoveredArcEndpoint = null;
    hoveredBlockInstance = null;
    return changed;
  }

  function startDimensionEditInput(hit) {
    if (!hit?.constraint) return false;
    const target = targetFromConstraint(hit.constraint);
    if (!target) return false;
    if (isReadOnlyDimension(hit.constraint)) {
      canvasSelection.set("dimensionConstraint", hit.constraint);
      canvasSelection.set("constraint", null);
      dimensionDragSession = null;
      setHint("読み取り専用寸法の値は編集できません");
      draw();
      return true;
    }
    pendingCommand = {
      type: "distance-value",
      target,
      dimension: hit.constraint.dimension || hit.dimension || defaultDimensionForTarget(target),
      buffer: expressionInputValue(hit.constraint.expression || numericDimensionExpression(hit.constraint)),
      editing: false,
      constraint: hit.constraint,
    };
    canvasSelection.set("dimensionConstraint", hit.constraint);
    canvasSelection.set("constraint", null);
    dimensionDragSession = null;
    setHint(applicationText("寸法値を入力中: 数式は = から開始し、Parameter参照はダブルクオーテーションで括ります。Canvas寸法のクリックで参照を挿入できます", "Editing dimension: begin expressions with = and enclose parameter references in double quotes. Click a canvas dimension to insert a reference."));
    draw();
    focusDimensionValueInput();
    return true;
  }

  function sketchHasDimensionConstraint(sketchId = activeSketchId()) {
    return model.constraints.some((constraint) => constraintSketchId(constraint) === sketchId && constraint.dimension);
  }

  function selectedFixedBatchTargets() {
    const points = canvasSelection.points.filter((item) => !item.blockProjection);
    const lines = canvasSelection.lines.filter((item) => !item.blockProjection);
    const supportedCount = points.length + lines.length;
    const selectedCount = canvasSelection.points.length + canvasSelection.lines.length + canvasSelection.circles.length + canvasSelection.arcs.length + canvasSelection.splines.length
      + canvasSelection.blockInstances.length + canvasSelection.geometryInstances.length + canvasSelection.annotations.length + canvasSelection.hatches.length + canvasSelection.referenceImages.length;
    if (canvasSelection.arcEndpoint || supportedCount === 0 || supportedCount !== selectedCount) return null;
    const sketchIds = new Set([...points, ...lines].map(elementSketchId));
    if (sketchIds.size !== 1) return null;
    const sketchId = [...sketchIds][0];
    if (!isEditableSketchId(sketchId)) return null;
    return { points, lines, sketchId };
  }

  function fixedBatchIsFullyFixed(batch) {
    return Boolean(batch) && batch.points.every((point) => point.fixed) && batch.lines.every((line) => Boolean(findLineFixedConstraint(line)));
  }

  function updateConstraintButtons() {
    if (!isGeometryMode()) {
      for (const btn of constraintButtons) {
        btn.classList.remove("active");
        btn.setAttribute("aria-disabled", "true");
        btn.setAttribute("aria-pressed", "false");
      }
      for (const btn of constraintMenuButtons) {
        btn.classList.remove("active");
        btn.setAttribute("aria-disabled", "true");
        btn.setAttribute("aria-pressed", "false");
      }
      fixPointBtn?.setAttribute("aria-disabled", "true");
      fixPointBtn?.setAttribute("aria-pressed", "false");
      fixPointBtn?.classList.remove("active");
      return;
    }
    if (pendingCommand?.type?.startsWith("distance")) {
      const target = distanceTargetFromSelection();
      if (!target || target.kind === "invalid") cancelPendingCommand("寸法入力をキャンセルしました");
    }

    for (const btn of constraintButtons) {
      btn.setAttribute("aria-disabled", "false");
      const active = pendingConstraintCommand?.type === btn.dataset.constraint;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    }
    for (const btn of constraintMenuButtons) {
      const type = btn.dataset.menuConstraint;
      const source = type === "fixed"
        ? fixPointBtn
        : constraintButtons.find((candidate) => candidate.dataset.constraint === type);
      const disabled = source?.getAttribute("aria-disabled") === "true";
      const active = source?.getAttribute("aria-pressed") === "true";
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-disabled", String(disabled));
      btn.setAttribute("aria-pressed", String(active));
    }
    const selectedProjectionItems = [...canvasSelection.points, ...canvasSelection.lines, ...canvasSelection.circles, ...canvasSelection.arcs, ...canvasSelection.splines].filter((item) => item?.blockProjection);
    const selectedProjectionInstances = [...new Set(selectedProjectionItems.map((item) => item.blockInstance))];
    const fixedBatch = selectedFixedBatchTargets();
    const canToggleFixed =
      (canvasSelection.blockInstances.length === 1 && selectedGeometryItems().length === 0 && canvasSelection.annotations.length === 0 && canvasSelection.hatches.length === 0 && canvasSelection.referenceImages.length === 0) ||
      (selectedProjectionItems.length > 0 && selectedProjectionInstances.length === 1 && selectedProjectionItems.length === canvasSelection.points.length + canvasSelection.lines.length + canvasSelection.circles.length + canvasSelection.arcs.length + canvasSelection.splines.length) ||
      Boolean(canvasSelection.arcEndpoint) ||
      Boolean(fixedBatch);
    const fixedCommandActive = pendingConstraintCommand?.type === "fixed";
    fixPointBtn.setAttribute("aria-disabled", String(!canToggleFixed && hasSelection() && !fixedCommandActive));
    fixPointBtn.classList.toggle("active", fixedCommandActive);
    fixPointBtn.setAttribute("aria-pressed", String(fixedCommandActive));

    const enabled = constraintButtons
      .filter((btn) => btn.getAttribute("aria-disabled") !== "true")
      .map((btn) => translatedExactText(btn.dataset.label || btn.title));
    const help = enabled.length > 0
      ? `${applicationText("追加可能", "Available")}: ${enabled.join(" / ")}`
      : applicationText("点または線を選択すると、追加できる拘束だけが有効になります。", "Select points or lines to enable applicable constraints.");
    document.getElementById("hint").title = help;
  }

  function clearInteractionForSketchChange() {
    clearSelection();
    dragSession = null;
    dimensionDragSession = null;
    referenceImageDragSession = null;
    referenceImageCalibrationSession = null;
    selectionRectSession = null;
    lineCommand.reset();
    rectangleCommand.reset();
    filletCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    pointerPreview = null;
    trimPreview = null;
    offsetSelection.reset();
    pendingCommand = null;
    pendingConstraintCommand = null;
    sketchProjectionSources = [];
    geometryInstanceCommand.clearSources();
    instanceSourceCommand.reset();
    hoveredSketchIdentity = null;
    lastPointerWorld = null;
    hideDimensionValueInput();
    clearSnap();
    mode = "select";
    updateToolbar();
  }

  function nextRootSketchName() {
    let max = 0;
    for (const sketch of model.sketches) {
      if (sketch.parentSketchId !== ROOT_SKETCH_ID || isRootSketch(sketch)) continue;
      const match = /^Sketch[-\s](\d+)$/.exec(sketch.name || "");
      if (match) max = Math.max(max, Number(match[1]));
    }
    return `Sketch-${max + 1}`;
  }

  function nextChildSketchName(parentSketchId) {
    const parent = sketchById(parentSketchId);
    if (isRootSketch(parent)) return nextRootSketchName();
    if (!parent) return nextRootSketchName();
    const prefix = `${parent.name}-`;
    let max = 0;
    for (const sketch of childSketchesOf(parentSketchId)) {
      if (!sketch.name?.startsWith(prefix)) continue;
      const suffix = sketch.name.slice(prefix.length);
      if (/^\d+$/.test(suffix)) max = Math.max(max, Number(suffix));
    }
    return `${prefix}${max + 1}`;
  }

  function nextSketchName(parentSketchId) {
    return parentSketchId && parentSketchId !== ROOT_SKETCH_ID ? nextChildSketchName(parentSketchId) : nextRootSketchName();
  }

  function createSketch(kind = "sibling") {
    ensureSketchState();
    const current = activeSketch();
    const parentSketchId = kind === "child" ? current.id : current.parentSketchId || ROOT_SKETCH_ID;
    const sketch = { id: `S${sketchSeq++}`, name: nextSketchName(parentSketchId), parentSketchId, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {} };
    model.sketches.push(sketch);
    model.activeSketchId = sketch.id;
    clearInteractionForSketchChange();
    setHint(parentSketchId ? `編集中: ${sketch.name} / 親: ${sketchName(parentSketchId)}` : `編集中: ${sketch.name}`);
    updateUI();
    draw();
    recordHistory("スケッチ追加");
  }

  function setActiveSketch(sketchId) {
    ensureSketchState();
    const sketch = model.sketches.find((item) => item.id === sketchId);
    if (!sketch) return;
    if (model.activeSketchId === sketchId) return;
    sketch.appearance = { ...normalizeAppearance(sketch.appearance), visible: true };
    sketch.visible = true;
    model.activeSketchId = sketchId;
    clearInteractionForSketchChange();
    setHint(`編集中: ${sketchName(sketchId)}`);
    updateUI();
    draw();
  }

  function renameSketch(sketchId) {
    const sketch = model.sketches.find((item) => item.id === sketchId);
    if (!sketch || isRootSketch(sketch)) return;
    const next = window.prompt("スケッチ名", sketch.name);
    if (!next) return;
    sketch.name = next.trim() || sketch.name;
    updateUI();
    draw();
    recordHistory("スケッチ名変更");
  }

  function toggleSketchVisibility(sketchId) {
    const sketch = sketchById(sketchId);
    if (!sketch || isRootSketch(sketch) || sketch.id === activeSketchId()) return false;
    const nextVisible = effectiveAppearanceForElement({ sketchId: sketch.id, appearance: {} }).visible === false;
    sketch.appearance = { ...normalizeAppearance(sketch.appearance), visible: nextVisible };
    sketch.visible = nextVisible;
    hoveredSketchTreeId = null;
    clearSnap();
    setHint(`${sketch.name}: ${sketch.visible ? "表示" : "非表示"}`);
    updateUI();
    draw();
    recordHistory(sketch.visible ? "スケッチ表示" : "スケッチ非表示");
    return true;
  }

  function valueReferencesRemovedGeometry(value, removedIds, removedKeys) {
    if (typeof value === "string") return removedIds.has(value) || removedKeys.has(value);
    if (Array.isArray(value)) return value.some((item) => valueReferencesRemovedGeometry(item, removedIds, removedKeys));
    if (value && typeof value === "object") return Object.values(value).some((item) => valueReferencesRemovedGeometry(item, removedIds, removedKeys));
    return false;
  }

  function annotationReferencesRemovedGeometry(annotation, removedIds, removedKeys) {
    if (annotation?.type !== "leader" || !annotation.geometryRef) return false;
    const id = geometryRefId(annotation.geometryRef);
    const key = geometryRefKey(annotation.geometryRef);
    return Boolean((id && removedIds.has(id)) || (key && removedKeys.has(key)));
  }

  function deleteSketch(sketchId, confirmFirst = true) {
    ensureSketchState();
    const sketch = sketchById(sketchId);
    if (!sketch || isRootSketch(sketch)) return false;

    const descendants = descendantSketchIds(sketch.id);
    const preserveDescendants = model.constraints.some((constraint) =>
      constraint instanceof SketchProjectionConstraint
      && constraint.referenceSketchId === sketch.id
      && descendants.includes(constraintSketchId(constraint)));
    const sketchIds = new Set(preserveDescendants ? [sketch.id] : [sketch.id, ...descendants]);
    const geometryInstancesToRemove = model.geometryInstances.filter((instance) => sketchIds.has(instance.sketchId));
    const externallyDependentInstances = model.geometryInstances.filter((instance) => !geometryInstancesToRemove.includes(instance) && geometryInstanceDependencyRefs(instance).some((ref) => {
      const referenced = resolveGeometryRef(ref);
      return referenced && sketchIds.has(elementSketchId(referenced));
    }));
    if (rejectReferencedGeometryDeletion(externallyDependentInstances, sketch.name)) return false;
    const externalReferences = model.constraints.filter((constraint) => {
      if (constraint instanceof SketchProjectionConstraint) return false;
      if (!constraint.reference || !sketchIds.has(constraint.referenceSketchId)) return false;
      return !sketchIds.has(constraintSketchId(constraint));
    });
    if (externalReferences.length > 0) {
      const owners = new Map();
      for (const constraint of externalReferences) {
        const ownerId = constraintSketchId(constraint);
        owners.set(ownerId, (owners.get(ownerId) || 0) + 1);
      }
      const ownerText = [...owners.entries()].map(([ownerId, count]) => `${sketchName(ownerId)} ${count}件`).join("、");
      const msg = `削除できません: ${sketch.name} またはその子孫が ${ownerText} から参照されています`;
      setHint(msg, "error");
      log(msg);
      return false;
    }
    const blockInstancesToRemove = model.blockInstances.filter((instance) => sketchIds.has(instance.sketchId));
    const blockProjectionItemsToRemove = blockInstancesToRemove.flatMap((instance) => {
      const bundle = blockAllProjectionBundle(instance);
      return [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])];
    });
    const geometryCount = [...model.points, ...model.lines, ...model.circles, ...model.arcs, ...model.splines].filter((item) => sketchIds.has(elementSketchId(item))).length + blockProjectionItemsToRemove.length;
    const confirmation = preserveDescendants
      ? `${sketch.name} を削除します。配下のスケッチは親へ移動します。\n図形 ${geometryCount} 件と、このスケッチの派生インスタンスも削除されます。`
      : `${sketch.name} と配下のスケッチを削除します。\n図形 ${geometryCount} 件も削除されます。`;
    if (confirmFirst && !window.confirm(confirmation)) return false;

    const pointSet = new Set(model.points.filter((point) => sketchIds.has(elementSketchId(point))));
    const lineSet = new Set(model.lines.filter((line) => sketchIds.has(elementSketchId(line)) || pointSet.has(line.p1) || pointSet.has(line.p2)));
    const circleSet = new Set(model.circles.filter((circle) => sketchIds.has(elementSketchId(circle)) || pointSet.has(circle.center)));
    const arcSet = new Set(model.arcs.filter((arc) => sketchIds.has(elementSketchId(arc)) || pointSet.has(arc.center)));
    const splineSet = new Set(model.splines.filter((spline) => sketchIds.has(elementSketchId(spline)) || spline.fitPoints.some((point) => pointSet.has(point))));
    const removedItems = [...pointSet, ...lineSet, ...circleSet, ...arcSet, ...splineSet, ...blockProjectionItemsToRemove];
    const removedIds = new Set(removedItems.map((item) => item.id));
    const removedKeys = new Set(removedItems.map(geometryElementKey).filter(Boolean));
    const removedConstraints = new Set(model.constraints.filter((constraint) =>
      sketchIds.has(constraintSketchId(constraint))
      || sketchIds.has(constraint.referenceSketchId)
      || constraintGraphNodes(constraint).some((node) => removedItems.includes(node) || removedKeys.has(geometryElementKey(node))),
    ));
    if (!guardDimensionSymbolDeletion(removedConstraints)) return false;

    model.constraints = model.constraints.filter((constraint) => !removedConstraints.has(constraint));
    model.lines = model.lines.filter((line) => !lineSet.has(line));
    model.circles = model.circles.filter((circle) => !circleSet.has(circle));
    model.arcs = model.arcs.filter((arc) => !arcSet.has(arc));
    model.splines = model.splines.filter((spline) => !splineSet.has(spline));
    model.points = model.points.filter((point) => !pointSet.has(point));
    model.blockInstances = model.blockInstances.filter((instance) => !blockInstancesToRemove.includes(instance));
    model.geometryInstances = model.geometryInstances.filter((instance) => !geometryInstancesToRemove.includes(instance));
    invalidateBlockProjectionCache();

    model.annotations = model.annotations.filter((annotation) => !sketchIds.has(annotation.sketchId) && !annotationReferencesRemovedGeometry(annotation, removedIds, removedKeys));
    model.hatches = model.hatches.filter((hatch) => !sketchIds.has(hatch.sketchId));
    model.referenceImages = model.referenceImages.filter((image) => !sketchIds.has(image.sketchId));

    const fallbackId = sketch.parentSketchId && !sketchIds.has(sketch.parentSketchId) ? sketch.parentSketchId : ROOT_SKETCH_ID;
    if (preserveDescendants) {
      for (const child of model.sketches) if (child.parentSketchId === sketch.id && !sketchIds.has(child.id)) child.parentSketchId = fallbackId;
    }
    model.sketches = model.sketches.filter((item) => !sketchIds.has(item.id));
    if (sketchIds.has(model.activeSketchId)) model.activeSketchId = sketchById(fallbackId)?.id || ROOT_SKETCH_ID;
    for (const id of sketchIds) sketchSolveStates.delete(id);

    clearInteractionForSketchChange();
    constraintAnalysisState = null;
    solveSketchAndDependents(activeSketchId());
    refreshConstraintAnalysis();
    updateUI({ refreshAnalysis: false });
    draw();
    setHint(`${sketch.name} を削除しました`);
    recordHistory("スケッチ削除");
    return true;
  }

  function toolbarSvgMarkup(selector) {
    const svg = document.querySelector(selector)?.querySelector("svg");
    return svg ? svg.outerHTML.replace("<svg", '<svg class="sketch-object-icon"') : "";
  }

  function constraintToolbarIcon(constraint, fixedPoint = false) {
    if (fixedPoint || constraint instanceof LineFixedConstraint || constraint instanceof ArcEndpointFixedConstraint || constraint instanceof GeometryFixedConstraint) return toolbarSvgMarkup("#fixPointBtn");
    if (constraint instanceof SketchProjectionConstraint) return toolbarSvgMarkup("#toolSketchProjection");
    if (constraint instanceof ParallelLinesCenterlineConstraint || constraint instanceof PointPairCenterlineConstraint) return toolbarSvgMarkup("#toolCenterline");
    if (isDimensionConstraint(constraint)) return toolbarSvgMarkup('[data-constraint="distance"]');
    const name = String(constraint?.name || "");
    const mappings = [
      [/水平/, "horizontal"], [/垂直/, "vertical"], [/平行/, "parallel"], [/直角/, "perpendicular"], [/対称/, "symmetry"],
      [/同心/, "concentric"], [/等寸/, "equal"], [/接線/, "tangent"], [/一致|円周/, "coincident"],
    ];
    const type = mappings.find(([pattern]) => pattern.test(name))?.[1] || "coincident";
    return toolbarSvgMarkup(`[data-constraint="${type}"]`);
  }

  function sketchTreeObjectSelected(category, entry) {
    if (category === "hatch") return canvasSelection.hatches.includes(entry);
    if (category === "image") return canvasSelection.referenceImages.includes(entry);
    if (category === "block") return canvasSelection.blockInstances.includes(entry);
    if (category === "instance") return canvasSelection.geometryInstances.includes(entry);
    if (category === "annotation") return canvasSelection.annotations.includes(entry);
    if (category === "constraint") return entry.kind === "fixed-point" ? canvasSelection.points.includes(entry.point) : constraintSelectedInCanvas(entry.constraint);
    return geometryItemSelectedInCanvas(entry);
  }

  function sketchTreeObjectHovered(category, entry) {
    if (category === "hatch") return hoveredHatch === entry;
    if (category === "image") return hoveredReferenceImage === entry;
    if (category === "block") return hoveredBlockInstance === entry;
    if (category === "instance") return hoveredGeometryInstance === entry;
    if (category === "annotation") return hoveredAnnotation === entry;
    const item = category === "constraint" ? (entry.kind === "fixed-point" ? entry.point : entry.constraint) : entry;
    return selectionHighlight.current?.item === item;
  }

  const sketchTreeObjects = window.SketchTreeObjects.create({
    sidebarGeometryItem,
    currentScope: () => model, getLanguage: () => applicationSettings.language,
    ensureAnalysis: () => { if (!constraintAnalysisState) refreshConstraintAnalysis(); }, types: window.GeometrySolver,
    isExplicitPoint, isPointUsedByLine, elementSketchId, constraintSketchId,
    constraintStatusOf, blockProjectionBundle, applicationText, escapeHtml, formatDisplayNumber,
    toolbarSvgMarkup, constraintToolbarIcon, sketchTreeGutter: window.SketchTreeView.gutter, isSketchProjectedGeometry,
    findLineFixedConstraint, blockDefinitionById, geometryInstanceTypeLabel, geometryInstanceBundle,
    resolvedHatchBoundary, hatchPatternTypeLabel, hatchAppearanceForDisplay,
    isDimensionConstraint, localizedConstraintName, constraintGeometryId, isReadOnlyDimension,
    constraintIsRedundant, referenceConstraintErrorInfo, sketchTreeObjectSelected, sketchTreeObjectHovered,
    constraintDirectlyReferencesCanvasSelection, selectedConstraintReferenceElements,
  });
  const sketchTreeView = window.SketchTreeView.create({
    document, sketchOverlay, sketchOverlayResizeHandle,
    getScopeKey: () => blockEditor.current?.draft?.id ? `block:${blockEditor.current.draft.id}` : "document",
    currentScope: () => model, ensureSketchState, isRootSketch, activeSketchId, applicationText, escapeHtml,
    objects: sketchTreeObjects,
    sketchHasSolveError, referenceConstraintErrorCountForSketch, constraintDuplicateCountForSketch,
    actions: { click: event => sketchTreeController.click(event), pointerOver: handleSketchTreePointerOver, pointerOut: handleSketchTreePointerOut,
      leave: () => {
        hoveredSketchTreeId = null;
        clearSidebarHover();
        hoveredBlockInstance = null;
        hoveredAnnotation = null;
        hoveredHatch = null;
        hoveredReferenceImage = null;
        draw();
      },
    },
  });
  const sketchTreeController = window.SketchTreeController.create({
    currentScope: () => model, activeSketchId, setActiveSketch, clearSelection, canvasSelection,
    sidebarGeometryItem, toggleBlockInstanceSelection, targetFromConstraint, updateUI, draw,
    sketchTreeView, updateSketchUI, toggleSketchVisibility, renameSketch, deleteSketch, deleteElements,
    unfixPoint: point => { point.fixed = false; solveAndRefresh(`固定解除 ${point.id}`); },
  });
  const { refreshSelection: updateSketchTreeSelectionState, render: updateSketchUIUnprofiled, applyWidth: applySketchTreeWidth } = sketchTreeView;

  function updateSketchUI() {
    if (!interactionProfiler.active) return updateSketchUIUnprofiled();
    return profileInteractionWork("tree", updateSketchUIUnprofiled);
  }

  function handleSketchTreePointerOver(event) {
    const objectRow = event.target.closest(".sketch-object-row");
    if (objectRow && !objectRow.contains(event.relatedTarget) && objectRow.dataset.sketchId === activeSketchId()) {
      const category = objectRow.dataset.objectKind;
      if (category === "block") hoveredBlockInstance = model.blockInstances.find((item) => item.id === objectRow.dataset.id) || null;
      else if (category === "instance") hoveredGeometryInstance = model.geometryInstances.find((item) => item.id === objectRow.dataset.id) || null;
      else if (category === "hatch") hoveredHatch = model.hatches.find((item) => item.id === objectRow.dataset.id) || null;
      else if (category === "image") hoveredReferenceImage = model.referenceImages.find((item) => item.id === objectRow.dataset.id) || null;
      else if (category === "annotation") hoveredAnnotation = model.annotations.find((item) => item.id === objectRow.dataset.id) || null;
      else if (objectRow.dataset.fixedPointId) {
        const point = model.points.find((item) => item.id === objectRow.dataset.fixedPointId);
        setSidebarHover("fixed-point", point, sidebarHoverElementsForItem(point));
      } else if (category === "constraint") {
        const constraint = model.constraints[Number(objectRow.dataset.constraintIndex)];
        setSidebarHover("constraint", constraint, sidebarHoverElementsForConstraint(constraint));
      } else {
        const item = sidebarGeometryItem(category, objectRow.dataset.id);
        setSidebarHover("geometry", item, sidebarHoverElementsForItem(item));
      }
      draw();
      return;
    }
    const sketchRow = event.target.closest(".sketch-item");
    if (sketchRow && !sketchRow.contains(event.relatedTarget)) {
      hoveredSketchTreeId = sketchRow.dataset.id;
      draw();
    }
  }

  function handleSketchTreePointerOut(event) {
    const objectRow = event.target.closest(".sketch-object-row");
    if (objectRow && !objectRow.contains(event.relatedTarget)) {
      clearSidebarHover();
      hoveredBlockInstance = null;
      hoveredGeometryInstance = null;
      hoveredAnnotation = null;
      hoveredHatch = null;
      hoveredReferenceImage = null;
      draw();
    }
    const sketchRow = event.target.closest(".sketch-item");
    if (sketchRow && !sketchRow.contains(event.relatedTarget) && hoveredSketchTreeId === sketchRow.dataset.id) {
      hoveredSketchTreeId = null;
      draw();
    }
  }






  function updateGeometrySelectionUI() {
    if (!interactionProfiler.active) return updateGeometrySelectionUIUnprofiled();
    return profileInteractionWork("ui", updateGeometrySelectionUIUnprofiled);
  }

  function updateGeometrySelectionUIUnprofiled() {
    updateToolbar();
    updateConstraintButtons();
    if (document.getElementById("blockDefinitionsDialog")?.open) updateBlockUI();
    updateSketchTreeSelectionState();
    updatePropertiesUI();
  }




  function sidebarGeometryItem(kind, id) {
    if (kind === "point") return model.points.find((item) => item.id === id) || null;
    if (kind === "line") return model.lines.find((item) => item.id === id) || null;
    if (kind === "circle") return model.circles.find((item) => item.id === id) || null;
    if (kind === "arc") return model.arcs.find((item) => item.id === id) || null;
    if (kind === "spline") return model.splines.find((item) => item.id === id) || null;
    return null;
  }






  function blockDefinitionSketchRows(definition) {
    if (!definition) return [];
    const children = new Map();
    for (const sketch of definition.sketches) {
      if (!children.has(sketch.parentSketchId)) children.set(sketch.parentSketchId, []);
      children.get(sketch.parentSketchId).push(sketch);
    }
    const rows = [];
    const visit = (parentId, depth) => {
      for (const sketch of children.get(parentId) || []) {
        if (sketch.kind === "root") continue;
        const count = [...definition.lines, ...definition.circles, ...definition.arcs, ...(definition.splines || []), ...(definition.annotations || []), ...(definition.hatches || []), ...(definition.blockInstances || []), ...(definition.geometryInstances || [])].filter((item) => item.sketchId === sketch.id).length;
        rows.push({ sketch, depth, count });
        visit(sketch.id, depth + 1);
      }
    };
    visit(ROOT_SKETCH_ID, 0);
    return rows;
  }

  const blockView = window.BlockView.create({
    document, escapeHtml,
    readEditing: () => blockEditor.current ? { name: blockEditor.current.draft.name } : null,
    blockDefinitionsInCurrentScope, blockDefinitionUsageCount,
    selectedDefinitionIds: () => canvasSelection.blockInstances.map((instance) => instance.definitionId),
    startBlockPlacement, enterBlockDefinitionEdit, renameBlockDefinition, deleteBlockDefinition,
    completeBlockDefinitionEdit, cancelBlockDefinitionEdit,
    changeName: blockEditor.rename,
    commitName: () => { if (blockEditor.current) recordHistory("ブロック名変更"); },
    refresh: updateBlockUI, localizeApplicationUI,
  });

  function updateBlockUI() {
    ensureBlockState();
    blockView.render();
  }

  function focusedExpressionInputContext() {
    const input = document.activeElement;
    if (!(input instanceof HTMLInputElement) || input.readOnly || input.disabled) return null;
    if (input === dimensionValueInput && pendingCommand?.type === "distance-value") return { input, namespace: model };
    if (input.matches('#propertiesPanel [data-property="constraint-expression"]')) return { input, namespace: model };
    const parameterExpression = input.matches('[data-parameter-field="expression"], [data-dimension-field="expression"]');
    if (parameterExpression && input.closest("#parametersDialog") && parameterDraft.current) {
      return { input, namespace: parameterDraft.current.namespace };
    }
    return null;
  }

  function hitSpline(x, y) {
    const threshold = 7 / viewport.scale;
    const splines = model.splines.slice().sort((a, b) => (normalizedDrawingOrder(b.drawingOrder) ?? 0) - (normalizedDrawingOrder(a.drawingOrder) ?? 0));
    for (const spline of splines) {
      if (!isEditableSketchElement(spline)) continue;
      const closest = window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 });
      if (closest && closest.distance <= threshold) return spline;
    }
    return null;
  }

  function insertIdentifierIntoExpressionInput(input, identifier) {
    let value = String(input.value ?? "");
    let start = Number.isInteger(input.selectionStart) ? input.selectionStart : value.length;
    let end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : start;
    if (!value.trimStart().startsWith("=")) {
      value = `=${value}`;
      start += 1;
      end += 1;
    } else if (value.startsWith("=")) {
      start = Math.max(1, start);
      end = Math.max(1, end);
    }
    const identifierCharacter = /[A-Za-z0-9_]/;
    const leftPadding = start > 0 && identifierCharacter.test(value[start - 1]) ? " " : "";
    const rightPadding = end < value.length && identifierCharacter.test(value[end]) ? " " : "";
    const insertion = `${leftPadding}${formatParameterReference(identifier)}${rightPadding}`;
    input.value = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
    const caret = start + insertion.length;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus({ preventScroll: true });
    input.setSelectionRange(caret, caret);
  }

  function insertClickedDimensionParameter(event, dimensionHit) {
    const context = focusedExpressionInputContext();
    if (!context || !dimensionHit?.constraint) return false;
    if (context.namespace !== model) {
      const message = applicationText("表示中のCanvasと異なる名前空間のため、この寸法は参照できません", "This dimension cannot be referenced because the canvas shows a different namespace.");
      setParameterDialogError(message);
      setHint(message, "error");
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
    ensureDimensionParameter(dimensionHit.constraint, model);
    if (!dimensionHit.constraint.parameterName) return false;
    event.preventDefault();
    event.stopPropagation();
    insertIdentifierIntoExpressionInput(context.input, dimensionHit.constraint.parameterName);
    setParameterDialogError("");
    setHint(applicationSettings.language === "en"
      ? `Inserted ${dimensionHit.constraint.parameterName}.`
      : `${dimensionHit.constraint.parameterName} を挿入しました`);
    return true;
  }

  function sketchGeometryAppearanceLayer(sketch, construction = false) {
    if (!sketch || isRootSketch(sketch)) return null;
    return construction ? sketch.constructionAppearance : sketch.appearance;
  }

  function effectiveConstructionAppearanceForSketch(sketch) {
    return resolveGeometryAppearance({
      defaults: documentModel.defaultConstructionAppearance, construction: true,
      sketchAppearance: sketchGeometryAppearanceLayer(sketch, true),
    });
  }

  function effectiveDimensionAppearanceForSketch(sketch) {
    return resolveDimensionAppearance(documentModel.defaultDimensionAppearance,
      sketch && !isRootSketch(sketch) ? sketch.dimensionAppearance : null);
  }

  function effectiveAppearanceForSketch(sketch) {
    return resolveGeometryAppearance({
      defaults: documentModel.defaultAppearance, sketchAppearance: sketchGeometryAppearanceLayer(sketch),
    });
  }









  const MULTIPLE_PROPERTY_MIXED = window.PropertySelection.mixedValue;
  const propertySelection = window.PropertySelection.create({
    Point, Line, canvasSelection,
    getOperation: () => ({ mode, instanceSourceEdit: instanceSourceCommand.current, freeInstancePlacement: geometryInstanceCommand.pending, blockPlacementDefinitionId: blockPlacementCommand.definitionId }),
    effectiveSelectedConstraint, selectedGeometryItems, blockDefinitionById, sketchById, activeSketchId,
    blockProjectionBundle, effectiveAppearanceForElement, documentModel, normalizeAppearance,
    hatchAppearanceForDisplay, normalizeAnnotationStyle,
  });
  const { selectedPropertiesTarget, multiplePropertyTypeKey, multiplePropertySameType, blockPropertyAppearance, multiplePropertyAppearance, multiplePropertySupports, multiplePropertyValue } = propertySelection;
  const geometryPropertyCommand = window.GeometryPropertyCommand.create({
    currentScope: workspace.current, SplineLineTangentConstraint, SplineSplineTangentConstraint,
    guardSketchProjectionShapeEdit, applicationText, synchronizeSketchProjectionMetadata,
    snapshotModelState, restoreModelState, stabilizeActiveParameterNamespace, elementSketchId, recordHistory,
  });
  const appearanceEditing = window.AppearanceEditing.create({
    normalizeAppearance, normalizeAnnotationStyle, normalizeHatchAppearance, normalizeDimensionAppearance,
    defaultDimensionAppearance: DEFAULT_DIMENSION_APPEARANCE, dimensionNumericRules: DIMENSION_APPEARANCE_NUMERIC_RULES,
  });
  const { applyAppearanceInput, applyAnnotationStyleValue, applyHatchAppearanceInput, applyDimensionAppearanceValue } = appearanceEditing;
  const appearancePropertyCommand = window.AppearancePropertyCommand.create({
    editing: appearanceEditing, normalizeHatchAppearance, normalizeAnnotationStyle,
    invalidateBlockProjectionCache, recordHistory, updateUI, updatePropertiesUI, draw,
  });
  const { owner: appearanceOwnerForPropertiesTarget } = appearancePropertyCommand;

  const { apply: applyMultipleProperty } = window.BulkPropertyCommand.create({
    guardSketchProjectionShapeEdit, applicationText, updatePropertiesUI, draw,
    multiplePropertySupports, applyAnnotationStyleValue, normalizeHatchAppearance, applyAppearanceInput,
    invalidateBlockProjectionCache, synchronizeSketchProjectionMetadata, recordHistory, updateUI,
  });
  const appearanceControls = window.AppearanceControls.create({
    applicationText, escapeHtml, formatDisplayNumber, normalizeAppearance, normalizeDimensionAppearance,
    dimensionLengthKeys: DIMENSION_APPEARANCE_LENGTH_KEYS, defaultDimensionAppearance: DEFAULT_DIMENSION_APPEARANCE,
  });
  const { defaultAppearanceLabel, colorPickerValue, appearancePropertyRows, dimensionAppearancePropertyRows, updateDimensionTerminatorAngleVisibility } = appearanceControls;
  const propertyRows = window.PropertyRows.create({
    Point, Line, Circle, Arc, Spline, applicationText, escapeHtml, formatDisplayNumber,
    multiplePropertySameType, multiplePropertySupports, multiplePropertyValue, multiplePropertyAppearance,
    mixedValue: MULTIPLE_PROPERTY_MIXED, colorPickerValue, sketchProjectionConstraintForTarget, sketchName,
    constraintGeometryId, constraintStatusBadge, constraintStatusOf, angleDegrees,
    blockInstanceEnabledSketchSet, blockDefinitionSketchRows, snappedBlockRotation,
    constraintDefiningGeometryEntries, normalizeAnnotationStyle
  });

  const appearancePalette = window.AppearancePalette.create({
    document, documentModel, currentScope: () => model, applicationText, escapeHtml,
    colorPickerValue, localizeApplicationUI, selectedPropertiesTarget, multiplePropertyValue,
    multiplePropertyAppearance, mixedValue: MULTIPLE_PROPERTY_MIXED, appearanceOwnerForPropertiesTarget,
    normalizeAnnotationStyle, applyMultipleProperty, applyDimensionAppearanceValue, normalizeHatchAppearance,
    applyAnnotationStyleValue, applyAppearanceInput, invalidateBlockProjectionCache, normalizeAppearance,
    normalizeConstructionAppearance, normalizeDimensionAppearance, recordHistory, updateUI, draw,
  });
  const { open: openAppearanceColorPalette, commit: commitColorPaletteValue } = appearancePalette;
  const elementPropertyCommand = window.ElementPropertyCommand.create({ recordHistory, updateUI, updatePropertiesUI, draw });
  const propertiesController = window.PropertiesController.create({
    HTMLTextAreaElement, HTMLInputElement, Spline, selectedPropertiesTarget,
    elementPropertyCommand, appearancePropertyCommand, geometryPropertyCommand, applyMultipleProperty,
    changeFreeInstanceProperty, commitDimensionPropertyEdit, updateUI, updatePropertiesUI, draw,
    applicationText, setHint,
    setPlacementRotationLocked: blockPlacementCommand.setRotationLocked,
    setPlacementSketchIds: blockPlacementCommand.setEnabledSketchIds,
    setBlockInstanceRotationLocked, setBlockInstanceEnabledSketchIds, setBlockInstanceOrthogonalRotation,
    startInstanceSourceEdit, startReferenceImageCalibration, startHatchBoundaryRepair,
    startSplineEdit: spline => { splineEditSession = { spline }; }, openAppearanceColorPalette,
  });
  const { input: handlePropertiesInput, change: handlePropertiesChange, click: handlePropertiesClick } = propertiesController;
  const propertyPresentation = window.PropertyPresentation.create({
    currentScope: workspace.current, documentModel, canvasSelection,
    getOperation: () => ({ mode, freeInstancePlacement: geometryInstanceCommand.pending, instanceSourceEdit: instanceSourceCommand.current, blockPlacementEnabledSketchIds: blockPlacementCommand.enabledSketchIds, blockPlacementRotationLocked: blockPlacementCommand.rotationLocked }),
    effectiveAppearanceForElement, sketchName, hatchAppearanceForDisplay, resolvedHatchBoundary,
    blockDefinitionById, blockProjectionBundle, normalizeAppearance, emptyGeometryInstanceBundle,
    geometryInstanceBundle, activeSketchId, targetFromConstraint, dimensionDisplayState,
    constraintSketchId, isReadOnlyDimension, measuredDimensionValue, angleDegrees,
    sketchById, isRootSketch, effectiveAppearanceForSketch, effectiveConstructionAppearanceForSketch,
    effectiveDimensionAppearanceForSketch, blockDefinitionSketchRows,
  });
  const propertiesContent = window.PropertiesContent.create({
    presentation: propertyPresentation, rows: propertyRows, appearanceControls, Line, SketchProjectionConstraint,
    applicationText, escapeHtml, formatDisplayNumber, hatchRegionErrorText, geometryInstanceTypeLabel,
    geometryRefId, expressionInputValue, numericDimensionExpression, sketchName, localizedConstraintName,
    collapsibleSketchAppearanceSection: (...args) => propertiesView.collapsibleSketchAppearanceSection(...args),
  });
  const propertiesView = window.PropertiesView.create({
    document, applicationText, localizeApplicationUI, installExpressionInputHighlights,
    content: propertiesContent.render,
    onInput: handlePropertiesInput, onChange: handlePropertiesChange, onClick: handlePropertiesClick,
  });
  function updatePropertiesUIUnprofiled() {
    propertiesView.render(selectedPropertiesTarget());
  }
















  function dimensionDisplayState(dimension, sketchId = activeSketchId(), sketches = model.sketches) {
    const display = effectiveDimensionAppearance(dimension, sketchId, sketches);
    return {
      visible: display.visible !== false,
      color: display.color || DEFAULT_DIMENSION_APPEARANCE.color,
      lineWidth: display.lineWidth,
      precision: Number.isInteger(display.precision) ? Math.max(0, Math.min(10, display.precision)) : null,
      prefix: String(display.prefix || ""),
      suffix: String(display.suffix || ""),
      toleranceUpper: display.toleranceUpper == null ? "" : String(display.toleranceUpper),
      toleranceLower: display.toleranceLower == null ? "" : String(display.toleranceLower),
      terminatorType: display.terminatorType,
      extensionLineOvershoot: display.extensionLineOvershoot,
      extensionLineOriginGap: display.extensionLineOriginGap,
      terminatorSize: display.terminatorSize,
      arrowheadAngle: display.arrowheadAngle,
      dimensionTextHeight: display.dimensionTextHeight,
      dimensionTextGap: display.dimensionTextGap,
    };
  }



  function localizedConstraintName(name, { typeOnly = false } = {}) {
    const value = String(name || applicationText("拘束", "Constraint"));
    const replacements = [
      [/^円弧端点-円周一致/, "Arc endpoint on circumference"], [/^円弧端点-線一致/, "Arc endpoint on line"], [/^円弧端点一致/, "Arc endpoint coincident"],
      [/^点-線寸法/, "Point-line dimension"], [/^線-線寸法/, "Line-line dimension"], [/^線-円中心寸法/, "Line-circle center dimension"], [/^同心半径差寸法/, "Concentric radius-difference dimension"], [/^チェーンオフセット寸法/, "Chain offset dimension"], [/^オフセット寸法/, "Offset dimension"],
      [/^水平寸法/, "Horizontal dimension"], [/^垂直寸法/, "Vertical dimension"], [/^点-線一致/, "Point-line coincident"], [/^点-円周一致/, "Point on circumference"],
      [/^平行2線中心線/, "Parallel-line centerline"], [/^2点中心線/, "Point-pair centerline"], [/^最小線長/, "Minimum line length"], [/^線固定/, "Fixed line"], [/^点水平/, "Point horizontal"], [/^点垂直/, "Point vertical"],
      [/^円弧対称/, "Arc symmetry"], [/^線対称/, "Line symmetry"], [/^同一直線/, "Collinear"], [/^寸法/, "Dimension"], [/^角度/, "Angle"], [/^一致/, "Coincident"],
      [/^水平/, "Horizontal"], [/^垂直/, "Vertical"], [/^平行/, "Parallel"], [/^等寸/, "Equal"], [/^半径/, "Radius"], [/^直径/, "Diameter"],
      [/^同心/, "Concentric"], [/^接線/, "Tangent"], [/^対称/, "Symmetry"], [/^ドラッグ/, "Drag"],
    ];
    if (typeOnly) {
      const matched = replacements.find(([pattern]) => pattern.test(value));
      if (matched) {
        const [pattern, replacement] = matched;
        return applicationSettings.language === "en" ? replacement : value.match(pattern)?.[0] || value;
      }
      if (/^Arc endpoint fixed\b/.test(value)) return applicationText("円弧端点固定", "Arc endpoint fixed");
    }
    if (applicationSettings.language !== "en") return value;
    for (const [pattern, replacement] of replacements) if (pattern.test(value)) return value.replace(pattern, replacement);
    return value;
  }



  function updatePropertiesUI() {
    if (!interactionProfiler.active) return updatePropertiesUIUnprofiled();
    return profileInteractionWork("properties", updatePropertiesUIUnprofiled);
  }
















  function clearCanvasHover() {
    hoveredPoint = null;
    hoveredEndpointPoint = null;
    hoveredLine = null;
    hoveredCircle = null;
    hoveredArcEndpoint = null;
    hoveredArc = null;
    hoveredSpline = null;
    hoveredDimensionConstraint = null;
    hoveredSketchIdentity = null;
    hoveredBlockInstance = null;
    hoveredGeometryInstance = null;
    hoveredAnnotation = null;
    hoveredHatch = null;
    hoveredReferenceImage = null;
  }





  function updateStatusUI() {
    const command = document.getElementById("statusCommand");
    const modeLabels = {
      "free-instance-origin": applicationText("配置基準点", "Placement anchor"),
      "free-instance-place": applicationText("インスタンス配置", "Instance placement"),
      select: applicationText("選択", "Select"), point: applicationText("点", "Point"), line: applicationText("線", "Line"), centerline: applicationText("中心線", "Centerline"), "circle-center-cross": applicationText("円中心十字線", "Circle Center Cross"), rectangle: applicationText("矩形", "Rectangle"),
      slot: applicationText("長穴", "Slot"), circle: applicationText("円", "Circle"), arc: applicationText("円弧", "Arc"), "three-point-arc": applicationText("3点円弧", "Three-point Arc"), spline: applicationText("スプライン", "Spline"), fillet: applicationText("R面取り", "Fillet"), trim: applicationText("トリム", "Trim"),
      offset: applicationText("オフセット", "Offset"), hatch: applicationText("ハッチング", "Hatching"), "hatch-repair": applicationText("境界を再指定", "Reselect boundary"), "block-place": applicationText("ブロック配置", "Block placement"),
    };
    if (command) command.textContent = pendingCommand?.type?.startsWith("annotation-") ? applicationText("注記", "Annotation") : pendingConstraintCommand ? applicationText("拘束", "Constraint") : modeLabels[mode] || mode;
    const constraint = document.getElementById("statusConstraint");
    if (constraint) constraint.textContent = viewState.constraintStatus ? "拘束状態表示中" : constraintSummaryText();
  }

  function updateUI({ refreshAnalysis = true } = {}) {
    if (!interactionProfiler.active) return updateUIUnprofiled({ refreshAnalysis });
    return profileInteractionWork("ui", () => updateUIUnprofiled({ refreshAnalysis }));
  }

  function updateUIUnprofiled({ refreshAnalysis = true } = {}) {
    ensureParameterNamespace(currentParameterNamespace());
    if (refreshAnalysis) refreshConstraintAnalysis();
    updateDocumentNameUI();
    updateToolbar();
    updateSketchUI();
    updateBlockUI();
    updatePropertiesUI();
    updateStatusUI();
    updateConstraintButtons();
    localizeApplicationUI();
    syncDimensionValueInput();
  }

  function supportLineBasis(line) {
    if (line.orientationHint === "horizontal") {
      return { anchor: { x: line.p1.x, y: (line.p1.y + line.p2.y) / 2 }, nx: 0, ny: 1 };
    }
    if (line.orientationHint === "vertical") {
      return { anchor: { x: (line.p1.x + line.p2.x) / 2, y: line.p1.y }, nx: 1, ny: 0 };
    }
    const dx = line.p2.x - line.p1.x;
    const dy = line.p2.y - line.p1.y;
    const len = Math.hypot(dx, dy);
    if (len < MIN_ORIENTATION_LENGTH) return null;
    return { anchor: line.p1, nx: -dy / len, ny: dx / len };
  }

  function preconditionArcEndpointOnLineConstraint(constraint) {
    solver.syncLineOrientationHints?.();
    const basis = supportLineBasis(constraint.line);
    if (!basis) return;
    const arc = constraint.arc;
    const prop = constraint.endpoint === "start" ? "startAngle" : "endAngle";
    const current = arc[prop];
    let radius = arc.radius();
    const offset = basis.nx * (arc.center.x - basis.anchor.x) + basis.ny * (arc.center.y - basis.anchor.y);
    let k = -offset / radius;
    if (Math.abs(k) > 1 && !hasDirectRadiusDimension(arc)) {
      arc.radiusValue = Math.max(Math.abs(offset) + MIN_LINE_LENGTH, MIN_LINE_LENGTH);
      radius = arc.radius();
      k = -offset / radius;
    }
    if (Math.abs(k) > 1) return;

    const normalAngle = Math.atan2(basis.ny, basis.nx);
    const delta = Math.acos(Math.max(-1, Math.min(1, k)));
    const candidates = [normalAngle + delta, normalAngle - delta].map((angle) => unwrapAngleNear(angle, current));
    arc[prop] = candidates.reduce((best, angle) => (Math.abs(angle - current) < Math.abs(best - current) ? angle : best), candidates[0]);
  }

  function preconditionArcEndpointToPoint(arc, endpoint, point) {
    if (!arc || !point) return;
    const dx = point.x - arc.center.x;
    const dy = point.y - arc.center.y;
    const distance = hypot2(dx, dy);
    if (distance < MIN_LINE_LENGTH) return;
    if (!hasDirectRadiusDimension(arc)) arc.radiusValue = Math.max(distance, MIN_LINE_LENGTH);
    const prop = endpoint === "start" ? "startAngle" : "endAngle";
    arc[prop] = unwrapAngleNear(Math.atan2(dy, dx), arc[prop]);
  }

  function preconditionArcEndpointCoincidentConstraint(constraint) {
    preconditionArcEndpointToPoint(constraint.arc, constraint.endpoint, constraint.point);
  }

  function preconditionArcEndpointArcEndpointCoincidentConstraint(constraint) {
    const aPoint = arcEndpointPoint(constraint.a, constraint.endpointA);
    const bPoint = arcEndpointPoint(constraint.b, constraint.endpointB);
    if (hasDirectRadiusDimension(constraint.a) && !hasDirectRadiusDimension(constraint.b)) {
      preconditionArcEndpointToPoint(constraint.b, constraint.endpointB, aPoint);
    } else {
      preconditionArcEndpointToPoint(constraint.a, constraint.endpointA, bPoint);
    }
  }

  function preconditionOffsetConstraint(constraint) {
    if (!(constraint instanceof OffsetConstraint)) return;
    const { source, offset, target, sign } = constraint;
    if (source instanceof Line && offset instanceof Line) {
      const normal = lineNormal(source);
      const dx = normal.x * sign * target;
      const dy = normal.y * sign * target;
      offset.p1.x = source.p1.x + dx;
      offset.p1.y = source.p1.y + dy;
      offset.p2.x = source.p2.x + dx;
      offset.p2.y = source.p2.y + dy;
      return;
    }
    offset.center.x = source.center.x;
    offset.center.y = source.center.y;
    offset.radiusValue = Math.max(MIN_ORIENTATION_LENGTH, source.radius() + sign * target);
    if (source instanceof Arc && offset instanceof Arc) {
      offset.startAngle = source.startAngle;
      offset.endAngle = source.endAngle;
    }
  }

  function preconditionOffsetChainConstraint(constraint) {
    if (!(constraint instanceof OffsetChainConstraint)) return;
    const plan = offsetChainDraft(
      constraint.sources.map((geometry, index) => ({ geometry, reversed: Boolean(constraint.sourceReversed[index]) })),
      constraint.target,
      constraint.side,
      constraint.closed,
    );
    if (!plan.ok || plan.geometries.length !== constraint.offsets.length) return;
    plan.geometries.forEach((planned, index) => {
      const offset = constraint.offsets[index];
      if (planned instanceof Line && offset instanceof Line) {
        offset.p1.x = planned.p1.x;
        offset.p1.y = planned.p1.y;
        offset.p2.x = planned.p2.x;
        offset.p2.y = planned.p2.y;
      } else if (planned instanceof Arc && offset instanceof Arc) {
        offset.center.x = planned.center.x;
        offset.center.y = planned.center.y;
        offset.radiusValue = planned.radiusValue;
        offset.startAngle = planned.startAngle;
        offset.endAngle = planned.endAngle;
      }
    });
  }

  function preconditionNewConstraint(constraint) {
    if (constraint instanceof ArcEndpointOnLineConstraint) {
      preconditionArcEndpointOnLineConstraint(constraint);
    } else if (constraint instanceof ArcEndpointCoincidentConstraint) {
      preconditionArcEndpointCoincidentConstraint(constraint);
    } else if (constraint instanceof ArcEndpointArcEndpointCoincidentConstraint) {
      preconditionArcEndpointArcEndpointCoincidentConstraint(constraint);
    } else if (constraint instanceof OffsetConstraint) {
      preconditionOffsetConstraint(constraint);
    } else if (constraint instanceof OffsetChainConstraint) {
      preconditionOffsetChainConstraint(constraint);
    }
  }

  function solveStepNormForConstraint(constraint) {
    if (!constraint) return solver.maxStepNorm;
    const e = constraint.error();
    const values = Array.isArray(e) ? e : [e];
    const errorNorm = vectorNorm(values);
    return Math.max(solver.maxStepNorm, errorNorm * 1.5);
  }

  function withTemporarySolveStepNorm(stepNorm, callback) {
    const previous = solver.maxStepNorm;
    solver.maxStepNorm = Math.max(previous, Number.isFinite(stepNorm) ? stepNorm : previous);
    try {
      return callback();
    } finally {
      solver.maxStepNorm = previous;
    }
  }

  function addReadOnlyDimensionConstraint(constraint, sketchId = constraintSketchId(constraint), messagePrefix = "重複寸法") {
    if (!isDimensionConstraint(constraint)) return false;
    const target = targetFromConstraint(constraint);
    if (!target) return false;
    constraint.target = measuredConstraintTargetValue(constraint, target, constraint.dimension);
    constraint.readOnlyDimension = true;
    constraint.enabled = false;
    pushModelConstraint(constraint, sketchId);
    clearSelection();
    refreshConstraintAnalysis();
    updateUI({ refreshAnalysis: false });
    draw();
    setHint(`${messagePrefix}を読み取り専用寸法として追加しました`);
    log(`${messagePrefix}を読み取り専用寸法として追加しました`);
    recordHistory(`${messagePrefix}を読み取り専用寸法として追加`);
    return true;
  }

  function commitNewConstraint(type, constraint) {
    if (!constraintTargetsAreActive(constraint)) {
      const msg = "別スケッチ同士は通常拘束できません";
      setHint(msg, "error");
      log(msg);
      return false;
    }
    const performanceTrace = { kind: "constraint", type, startedAt: performance.now() };
    const snapshot = snapshotModelState();
    performanceTrace.snapshotMs = performance.now() - performanceTrace.startedAt;
    const solveStepNorm = solveStepNormForConstraint(constraint);
    pushModelConstraint(constraint);
    preconditionNewConstraint(constraint);

    const solveStartedAt = performance.now();
    let solved = withTemporarySolveStepNorm(solveStepNorm, () => solveConstraintComponentAndDependents(constraint, snapshot));
    if (solved.success && isDimensionConstraint(constraint) && !isReadOnlyDimension(constraint)) {
      const stabilized = stabilizeActiveParameterNamespace(constraintSketchId(constraint));
      if (!stabilized.success || stabilized.dependent?.success === false) solved = stabilized;
    }
    performanceTrace.solveMs = performance.now() - solveStartedAt;
    const result = solved.result;
    performanceTrace.solveVariableCount = result.variableCount;
    performanceTrace.solveConstraintCount = result.constraintCount;
    performanceTrace.solveErrorNorm = result.errorNorm;
    performanceTrace.solveIterations = result.iterations;
    performanceTrace.fullFallback = Boolean(result.fullFallback);
    const collapse = findLineCollapseAfterConstraint(constraint, snapshot, constraintSketchId(constraint));
    const redundancyStartedAt = performance.now();
    const duplicate = solved.success && result.errorNorm <= CONSTRAINT_ACCEPT_ERROR && !collapse ? redundantConstraintInfo(constraint, constraintSketchId(constraint)) : null;
    performanceTrace.redundancyMs = performance.now() - redundancyStartedAt;
    if (!solved.success || result.errorNorm > CONSTRAINT_ACCEPT_ERROR || collapse || duplicate?.redundant) {
      if (duplicate?.redundant && isDimensionConstraint(constraint)) {
        restoreModelState(snapshot);
        return addReadOnlyDimensionConstraint(constraint, constraintSketchId(constraint));
      }
      restoreModelState(snapshot);
      const msg = `拘束を追加できません: 矛盾しています (error=${result.errorNorm.toExponential(3)}, reason=${result.reason})`;
      const collapseMsg = collapse
        ? `拘束を追加できません: 線${collapse.line.id}が退化するため矛盾しています (${collapse.before.toExponential(3)} -> ${collapse.after.toExponential(3)})`
        : msg;
      const duplicateMsg = duplicate?.redundant
        ? `拘束を追加できません: 重複しています (rank ${duplicate.rankBefore} -> ${duplicate.rankAfter})`
        : collapseMsg;
      setHint(duplicateMsg, "error");
      updateUI();
      draw();
      log(duplicateMsg);
      return;
    }

    clearSelection();
    const redundancyBySketch = duplicate?.redundancy ? new Map([[constraintSketchId(constraint), duplicate.redundancy]]) : null;
    const analysisStartedAt = performance.now();
    refreshConstraintAnalysis({ redundancyBySketch });
    performanceTrace.analysisMs = performance.now() - analysisStartedAt;
    const uiStartedAt = performance.now();
    updateUI({ refreshAnalysis: false });
    draw();
    performanceTrace.uiMs = performance.now() - uiStartedAt;
    setHint(applicationText("拘束を追加しました", "Constraint added"));
    log(`拘束を追加しました: ${type}\n自動solve: success=${solved.success}, error=${result.errorNorm.toExponential(3)}`);
    recordHistory(`拘束追加: ${type}`);
    performanceTrace.totalMs = performance.now() - performanceTrace.startedAt;
    lastAuthoringPerformance = performanceTrace;
    return true;
  }

  function markReferenceConstraint(constraint, referenceSketchId, sketchId = activeSketchId()) {
    constraint.reference = true;
    constraint.referenceSketchId = referenceSketchId;
    constraint.sketchId = sketchId;
    constraint.name = `参照 ${constraint.name}`;
    return constraint;
  }

  function commitReferenceConstraint(type, constraint, referenceSketchId, sketchId = activeSketchId()) {
    if (!constraint || !isReferenceSourceSketchId(referenceSketchId, sketchId)) {
      const msg = descendantSketchIds(sketchId).includes(referenceSketchId) ? "子孫スケッチは参照できません" : "先祖スケッチのみ参照できます";
      setHint(msg, "error");
      log(msg);
      return false;
    }
    if (wouldCreateReferenceCycle(sketchId, referenceSketchId)) {
      const msg = "スケッチ間の参照が循環するため追加できません";
      setHint(msg, "error");
      log(msg);
      return false;
    }
    const snapshot = snapshotModelState();
    markReferenceConstraint(constraint, referenceSketchId, sketchId);
    const solveStepNorm = solveStepNormForConstraint(constraint);
    pushModelConstraint(constraint, sketchId);
    preconditionNewConstraint(constraint);
    const solved = withTemporarySolveStepNorm(solveStepNorm, () => solveConstraintComponentAndDependents(constraint, snapshot));
    const result = solved.result;
    const collapse = findLineCollapseAfterConstraint(constraint, snapshot, sketchId);
    const duplicate = solved.success && result.errorNorm <= CONSTRAINT_ACCEPT_ERROR && !collapse ? redundantConstraintInfo(constraint, sketchId) : null;
    if (!solved.success || result.errorNorm > CONSTRAINT_ACCEPT_ERROR || collapse || duplicate?.redundant) {
      if (duplicate?.redundant && isDimensionConstraint(constraint)) {
        restoreModelState(snapshot);
        return addReadOnlyDimensionConstraint(constraint, sketchId, "重複参照寸法");
      }
      restoreModelState(snapshot);
      const msg = `参照拘束を追加できません: 矛盾しています (error=${result.errorNorm.toExponential(3)}, reason=${result.reason})`;
      const collapseMsg = collapse
        ? `参照拘束を追加できません: 線${collapse.line.id}が退化するため矛盾しています (${collapse.before.toExponential(3)} -> ${collapse.after.toExponential(3)})`
        : msg;
      const duplicateMsg = duplicate?.redundant
        ? `参照拘束を追加できません: 重複しています (rank ${duplicate.rankBefore} -> ${duplicate.rankAfter})`
        : collapseMsg;
      setHint(duplicateMsg, "error");
      updateUI();
      draw();
      log(duplicateMsg);
      return false;
    }
    clearSelection();
    const redundancyBySketch = duplicate?.redundancy ? new Map([[sketchId, duplicate.redundancy]]) : null;
    refreshConstraintAnalysis({ redundancyBySketch });
    updateUI({ refreshAnalysis: false });
    draw();
    setHint(applicationText(`参照拘束を追加しました: ${sketchName(referenceSketchId)} を参照`, `Reference constraint added: referencing ${sketchName(referenceSketchId)}`));
    log(`参照拘束を追加しました: ${type}\n自動solve: success=${result.success}, error=${result.errorNorm.toExponential(3)}`);
    recordHistory(`参照拘束追加: ${type}`);
    return true;
  }

  function splitConstraintOperands(operands) {
    return {
      active: operands.filter((operand) => operand.relation === "active"),
      reference: operands.filter((operand) => operand.relation === "reference"),
      descendant: operands.filter((operand) => operand.relation === "descendant"),
    };
  }

  function referenceResolutionFromOperands(type, operands) {
    const { active, reference } = splitConstraintOperands(operands);
    if (active.length !== 1 || reference.length !== 1) return { error: "参照拘束はアクティブスケッチ側1つと先祖スケッチ側1つを選択してください" };
    return constraintResolutionFromSubjectAndReference(type, subjectFromOperand(active[0]), referenceTargetFromOperand(reference[0]));
  }

  function splineConstraintResolution(type, operands) {
    if (operands.length !== 2) return null;
    const pointOperand = operands.find((operand) => operand.kind === "point");
    const splineOperands = operands.filter((operand) => operand.kind === "spline");
    if (type === "coincident" && pointOperand && splineOperands.length === 1) {
      const splineOperand = splineOperands[0];
      return { constraint: new PointOnSplineConstraint(pointOperand.point, splineOperand.spline, splineOperand.parameter) };
    }
    if (type !== "tangent" || splineOperands.length === 0) return null;
    if (splineOperands.some((operand) => operand.spline.closed)) return { error: applicationText("閉じたスプラインには端点接線拘束を設定できません", "Endpoint tangent constraints cannot be applied to closed splines.") };
    const lineOperand = operands.find((operand) => operand.kind === "line");
    if (lineOperand && splineOperands.length === 1) {
      const splineOperand = splineOperands[0];
      return { constraint: new SplineLineTangentConstraint(splineOperand.spline, splineOperand.endpoint, lineOperand.line) };
    }
    if (splineOperands.length === 2) {
      return { constraint: new SplineSplineTangentConstraint(splineOperands[0].spline, splineOperands[0].endpoint, splineOperands[1].spline, splineOperands[1].endpoint) };
    }
    return { error: invalidConstraintTargetHint(type) };
  }

  function normalConstraintFromOperands(type, operands) {
    if (type === "symmetry") return symmetryConstraintFromOperands(operands);
    return constraintFromTargets(type, constraintTargetsFromOperands(operands), activeSketchId());
  }

  function symmetryReferenceResolutionFromOperands(operands) {
    if (operands.length < 3) return null;
    const { active, reference } = splitConstraintOperands(operands);
    const constraint = symmetryConstraintFromOperands(operands);
    if (!constraint || active.length === 0 || reference.length === 0) return { error: "参照対称拘束では、対称軸、同種の対象2つの順に選択してください" };
    const referenceSketchIds = [...new Set(reference.map((operand) => operand.sketchId))];
    if (referenceSketchIds.length !== 1) return { error: "参照対称拘束の参照対象は同じ先祖スケッチから選択してください" };
    const sketchId = active[0].sketchId;
    const referenceSketchId = referenceSketchIds[0];
    if (!active.every((operand) => operand.sketchId === sketchId) || !isReferenceSourceSketchId(referenceSketchId, sketchId)) {
      return { error: "参照対称拘束ではアクティブスケッチと1つの先祖スケッチだけを選択してください" };
    }
    if (wouldCreateReferenceCycle(sketchId, referenceSketchId)) return { error: "スケッチ間の参照が循環するため追加できません" };
    return {
      type: "symmetry",
      action: "commit",
      constraint,
      operands,
      referenceSketchId,
      sketchId,
    };
  }

  function resolveConstraintIntent(type, operands) {
    const cleanOperands = operands.filter(Boolean);
    const { active, reference, descendant } = splitConstraintOperands(cleanOperands);
    if (descendant.length > 0) return { error: "子孫スケッチは参照できません" };
    if (reference.length > 0) {
      if (type === "symmetry") return symmetryReferenceResolutionFromOperands(cleanOperands);
      if (cleanOperands.length < 2 || active.length === 0) return null;
      if (cleanOperands.length !== 2) return { error: "参照拘束はアクティブスケッチ側と先祖スケッチ側を1つずつ選択してください" };
      const resolution = referenceResolutionFromOperands(type, cleanOperands);
      if (type === "distance" && resolution?.target) return { ...resolution, action: "place-dimension", operands: cleanOperands };
      return resolution?.constraint ? { ...resolution, action: "commit", operands: cleanOperands } : resolution;
    }
    if (active.length !== cleanOperands.length) return { error: "拘束対象はアクティブスケッチ、または先祖スケッチだけを選択できます" };
    const sketchIds = [...new Set(cleanOperands.map((operand) => operand.sketchId))];
    if (sketchIds.length > 1) return { error: "別スケッチ同士は通常拘束できません" };
    if (type === "distance") {
      const target = distanceTargetFromOperands(cleanOperands);
      if (!target || target.kind === "invalid") return target?.kind === "invalid" ? { error: target.reason } : null;
      return { type, action: "place-dimension", target, operands: cleanOperands, sketchId: sketchIds[0] || activeSketchId() };
    }
    const splineResolution = splineConstraintResolution(type, cleanOperands);
    if (splineResolution?.error) return splineResolution;
    const constraint = splineResolution?.constraint || normalConstraintFromOperands(type, cleanOperands);
    return constraint ? { type, action: "commit", constraint, operands: cleanOperands, sketchId: sketchIds[0] || activeSketchId() } : null;
  }

  function referenceSketchIdFromPair(subject, referenceTarget) {
    const subjectSketchId = referenceSubjectSketchId(subject);
    if (!subjectSketchId || !referenceTarget?.sketchId) return null;
    return isReferenceSourceSketchId(referenceTarget.sketchId, subjectSketchId) ? referenceTarget.sketchId : null;
  }

  function constraintResolutionFromSubjectAndReference(type, subject, referenceTarget) {
    const subjectElement = referenceSubjectElement(subject);
    const subjectSketchId = referenceSubjectSketchId(subject);
    const referenceSketchId = referenceSketchIdFromPair(subject, referenceTarget);
    if (!subject || !subjectElement || !isEditableSketchElement(subjectElement)) {
      return { error: "アクティブスケッチ側の対象を選択してください" };
    }
    if (!referenceTarget || !referenceSketchId) {
      return { error: referenceTarget?.sketchId && descendantSketchIds(subjectSketchId).includes(referenceTarget.sketchId) ? "子孫スケッチは参照できません" : "先祖スケッチのみ参照できます" };
    }
    if (wouldCreateReferenceCycle(subjectSketchId, referenceSketchId)) {
      return { error: "スケッチ間の参照が循環するため追加できません" };
    }
    if (type === "distance") {
      const target = referenceDistanceTargetForSubject(subject, referenceTarget);
      if (!target || target.kind === "invalid") return { error: target?.reason || "参照寸法の組み合わせに対応していません" };
      return { type, target, referenceSketchId, sketchId: subjectSketchId };
    }
    const constraint = referenceConstraintForType(type, subject, referenceTarget);
    if (!constraint) return { error: "この参照拘束の組み合わせには対応していません" };
    return { type, constraint, referenceSketchId, sketchId: subjectSketchId };
  }

  function constraintResolutionFromCurrentSelection(type) {
    if (constraintOperands.length > 0) return resolveConstraintIntent(type, constraintOperands);
    if (canvasSelection.splines.length > 0) return resolveConstraintIntent(type, constraintOperandsFromSelection());
    if (type === "distance") {
      const target = distanceTargetFromSelection();
      if (!target) return null;
      if (target.kind === "invalid") return { error: target.reason };
      return { type, target, sketchId: activeSketchId() };
    }
    const constraint = constraintFromSelection(type);
    if (!constraint) return null;
    return { type, constraint, sketchId: activeSketchId() };
  }

  function startDistanceResolution(resolution, pointer) {
    if (!resolution || resolution.error || !resolution.target) {
      if (resolution?.error) setHint(resolution.error, "error");
      return false;
    }
    mode = "select";
    const initialDimension = pointer ? null : defaultDimensionForTarget(resolution.target);
    const initialPointer = pointer || dimensionAnchor(resolution.target, initialDimension);
    if (resolution.operands) {
      constraintOperands = resolution.operands.slice();
      syncSelectionFromConstraintOperands();
    }
    pendingConstraintCommand = { type: "distance" };
    pendingCommand = {
      type: "distance-place",
      target: resolution.target,
      resolution,
      pointer: initialPointer,
      dimension: initialDimension,
      operands: resolution.operands || constraintOperands.slice(),
      referenceSketchId: resolution.referenceSketchId,
      sketchId: resolution.sketchId,
    };
    updateConstraintButtons();
    updateToolbar();
    const awaitingSecondOperand = (resolution.operands || []).length === 1;
    setHint(
      resolution.referenceSketchId
        ? "参照寸法線の位置をクリックしてください"
        : awaitingSecondOperand && resolution.target.kind === "line-length"
          ? "仮寸法の位置をマウスで調整し、空白をクリックして線長寸法を確定してください。2本目の線で線間・角度寸法、円で円中心距離寸法になります。"
          : awaitingSecondOperand && (resolution.target.kind === "radius" || resolution.target.kind === "diameter")
            ? "仮寸法の位置をマウスで調整し、空白をクリックして単独寸法を確定してください。線で円中心距離寸法、同心の円または円弧で半径差寸法になります。"
          : "寸法線の位置をクリックしてください",
    );
    draw();
    return true;
  }

  function commitConstraintResolution(resolution, pointer = null) {
    if (!resolution || resolution.error) {
      if (resolution?.error) setHint(resolution.error, "error");
      return false;
    }
    if (resolution.type === "distance") return startDistanceResolution(resolution, resolution.referenceSketchId ? null : pointer);
    if (!resolution.constraint) return false;
    const ok = resolution.referenceSketchId
      ? commitReferenceConstraint(resolution.type || "reference", resolution.constraint, resolution.referenceSketchId, resolution.sketchId || activeSketchId())
      : commitNewConstraint(resolution.type || "constraint", resolution.constraint);
    if (ok) recordHistory(`拘束追加: ${resolution.type || "constraint"}`);
    return ok;
  }

  function distanceConstraintFromTarget(target, value, dimension, options = {}) {
    if (!target || target.kind === "invalid") return null;
    let constraint = null;
    if (target.kind === "point-point" || target.kind === "line-length") {
      const axis = target.dimensionAxis || dimension?.axis;
      constraint = target.kind === "point-point" && (axis === "x" || axis === "y")
        ? new PointAxisDistanceConstraint(target.p1, target.p2, value, axis)
        : new DistanceConstraint(target.p1, target.p2, value);
    } else if (target.kind === "point-line") {
      constraint = new PointLineDistanceConstraint(target.point, target.line, value);
    } else if (target.kind === "line-line") {
      if (!linesAreParallel(target.line1, target.line2)) {
        if (!options.silent) {
          setHint("線-線寸法は平行線のみです", "error");
          log("線-線寸法は平行線のみです");
        }
        return null;
      }
      constraint = new LineLineDistanceConstraint(target.line1, target.line2, value);
    } else if (target.kind === "line-circle") {
      constraint = new LineCircleDistanceConstraint(target.line, target.circle, value);
    } else if (target.kind === "radius-difference") {
      constraint = new ConcentricRadiusDifferenceConstraint(target.a, target.b, value);
    } else if (target.kind === "angle") {
      constraint = new LineAngleConstraint(target.line1, target.line2, (value * Math.PI) / 180, dimension?.angleStartFlip || 0, dimension?.angleEndFlip || 0);
    } else if (target.kind === "radius") {
      constraint = new RadiusConstraint(target.primitive, value);
    } else if (target.kind === "diameter") {
      constraint = new DiameterConstraint(target.primitive, value);
    }
    if (constraint) constraint.dimension = dimension;
    return constraint;
  }

  function readOnlyDimensionConstraintForPlacement(target, value, dimension, options = {}) {
    const constraint = distanceConstraintFromTarget(target, value, dimension, { silent: true });
    if (!constraint) return null;
    const targetItems = target.kind === "point-point"
      ? [target.p1, target.p2]
      : target.kind === "point-line"
        ? [target.point, target.line]
        : target.kind === "line-circle"
          ? [target.line, target.circle]
          : target.kind === "radius-difference"
            ? [target.a, target.b]
        : target.kind === "line-line" || target.kind === "angle"
          ? [target.line1, target.line2]
          : target.kind === "line-length"
            ? [target.line]
            : target.primitive
              ? [target.primitive]
              : [];
    const blockInstances = [...new Set(targetItems.map((item) => item?.blockInstance).filter(Boolean))];
    if (targetItems.length > 0 && blockInstances.length === 1 && targetItems.every((item) => item?.blockInstance === blockInstances[0])) return constraint;
    const sketchId = options.sketchId || activeSketchId();
    assignConstraintSketchId(constraint, sketchId);
    if (options.referenceSketchId) markReferenceConstraint(constraint, options.referenceSketchId, sketchId);
    model.constraints.push(constraint);
    const duplicate = redundantConstraintInfo(constraint, sketchId);
    model.constraints = model.constraints.filter((item) => item !== constraint);
    return duplicate?.redundant ? constraint : null;
  }

  function addDistanceConstraintFromTarget(target, value, dimension, options = {}) {
    const constraint = distanceConstraintFromTarget(target, value, dimension);
    if (!constraint) return false;
    if (!options.referenceSketchId) constraint.expression = String(options.expression || value);
    return commitConstraintResolution({
      type: options.referenceSketchId ? "referenceDimension" : "dimension",
      constraint,
      referenceSketchId: options.referenceSketchId,
      sketchId: options.sketchId || activeSketchId(),
    });
  }

  function constraintFromSelection(type) {
    return constraintFromTargets(type, currentConstraintTargets(), activeSketchId());
  }

  function addConstraint(type) {
    const resolution = constraintResolutionFromCurrentSelection(type);
    if (!resolution || resolution.error) {
      if (resolution?.error) setHint(resolution.error, "error");
      return;
    }
    if (resolution.action === "place-dimension" || resolution.target) return startDistanceResolution(resolution, null);
    if (resolution?.constraint) {
      canvasSelection.set("arcEndpointPair", null);
      commitConstraintResolution(resolution);
    }
  }

  function dragSketchIdFromSelection(points = []) {
    const ids = [...new Set(points.filter(Boolean).map(elementSketchId).filter(isEditableSketchId))];
    if (ids.length === 1) return ids[0];
    if (ids.includes(activeSketchId())) return activeSketchId();
    return ids[0] || activeSketchId();
  }

  function dragSketchIdFor(kind, item) {
    if (kind === "arc-endpoint") return elementSketchId(item?.arc);
    if (kind === "selection") return dragSketchIdFromSelection(item);
    return elementSketchId(item);
  }

  function buildDragSession(kind, item, pointer) {
    const sketchId = dragSketchIdFor(kind, item);
    if (kind === "block" || kind === "block-rotation") {
      if (item.fixed || (kind === "block-rotation" && item.rotationLocked)) return null;
      const definition = blockDefinitionById(item.definitionId);
      const localCenter = blockLocalGeometryBounds(definition, [...blockInstanceEnabledSketchSet(item, definition)])?.center || definition?.origin || { x: 0, y: 0 };
      return {
        kind,
        sketchId: item.sketchId,
        mode: kind,
        item,
        startPointer: pointer,
        startX: item.x,
        startY: item.y,
        startRotation: item.rotation,
        localCenter,
        rotationPivot: blockWorldPoint(item, localCenter),
      };
    }
    if (kind === "selection") {
      const points = item
        .filter((p, index, arr) => p && elementSketchId(p) === sketchId && !p.fixed && !pointLockedByLineFixed(p) && arr.indexOf(p) === index)
        .map((p) => ({ point: p, startX: p.x, startY: p.y }));
      if (points.length === 0) return null;
      return { kind, sketchId, startPointer: pointer, points };
    }

    if (kind === "point") {
      if (item.fixed || pointLockedByLineFixed(item)) return null;
      return {
        kind,
        sketchId,
        startPointer: pointer,
        points: [{ point: item, startX: item.x, startY: item.y }],
      };
    }

    if (kind === "spline") {
      const points = item.fitPoints
        .filter((point, index, array) => !point.fixed && !pointLockedByLineFixed(point) && array.indexOf(point) === index)
        .map((point) => ({ point, startX: point.x, startY: point.y }));
      return points.length ? { kind, sketchId, item, startPointer: pointer, points } : null;
    }

    if (kind === "line" && findLineFixedConstraint(item)) return null;

    if (kind === "circle" || kind === "arc") {
      return {
        kind,
        sketchId,
        mode: "radius",
        item,
        startPointer: pointer,
        startRadius: item.radius(),
        startCenterX: item.center.x,
        startCenterY: item.center.y,
      };
    }

    if (kind === "arc-endpoint") {
      if (findArcEndpointFixedConstraint(item.arc, item.endpoint)) return null;
      return {
        kind,
        sketchId,
        mode: "arc-endpoint",
        item: item.arc,
        endpoint: item.endpoint,
        startPointer: pointer,
        startEndpoint: arcEndpointPoint(item.arc, item.endpoint),
      };
    }

    const sourcePoints = [item.p1, item.p2];
    const points = sourcePoints
      .filter((p, index, arr) => !p.fixed && !pointLockedByLineFixed(p) && arr.indexOf(p) === index)
      .map((p) => ({ point: p, startX: p.x, startY: p.y }));
    if (points.length === 0) return null;
    return { kind, sketchId, item, startPointer: pointer, points };
  }

  function resolveDerivedDragSource(hit, pointer) {
    let item = hit?.item || null;
    const inverseTransforms = [];
    const visited = new Set();
    let crossesSketchProjection = false;
    while (item?.derivedProjection) {
      if (visited.has(item) || !item.sourceElement || typeof item.derivedInversePoint !== "function") return null;
      visited.add(item);
      if (item.derivedInstance?.type === "sketchProjection") crossesSketchProjection = true;
      inverseTransforms.push(item.derivedInversePoint);
      item = item.sourceElement;
    }
    if (!item || inverseTransforms.length === 0) return null;
    const mapPointer = (value) => inverseTransforms.reduce((current, inverse) => inverse(current), { x: value.x, y: value.y });
    return { item, mapPointer, pointer: mapPointer(pointer), crossesSketchProjection };
  }

  function beginDerivedGeometryDrag(e, hit, pointer) {
    const wholeSelected = canvasSelection.geometryInstances.includes(hit.instance) && canvasSelection.instanceGeometry?.instanceId !== hit.instance.id;
    if (["free", "mirror", "pattern"].includes(hit.instance.type)
      && (!canvasSelection.geometryInstances.includes(hit.instance) || wholeSelected)) {
      const instance = hit.instance;
      const sources = geometryInstanceSourceObjects(instance);
      clearSelection();
      canvasSelection.set("geometryInstances", [instance]);
      dragSession = { kind: "free-instance", mode: "block", item: instance, sketchId: instance.sketchId,
        startPointer: pointer, startX: instance.x, startY: instance.y,
        clickGeometrySelection: wholeSelected ? { instanceId: instance.id, id: hit.item.id, kind: hit.kind, endpoint: hit.endpoint } : null,
        variableAllowed: (v) => !sources.has(v.object) && !(v.object === instance && v.prop === "rotation") };
      if (instance.type !== "free") {
        const item = hit.item;
        let anchor = item instanceof Point ? item : item.center || geometryInstanceSourcePoints(item)[0];
        if (item instanceof Line) {
          const dx = item.p2.x - item.p1.x, dy = item.p2.y - item.p1.y;
          const t = Math.max(0, Math.min(1, ((pointer.x - item.p1.x) * dx + (pointer.y - item.p1.y) * dy) / Math.max(dx * dx + dy * dy, 1e-20)));
          anchor = { get x() { return item.p1.x + t * (item.p2.x - item.p1.x); },
            get y() { return item.p1.y + t * (item.p2.y - item.p1.y); } };
        }
        if (!anchor) return;
        Object.assign(dragSession, { kind: "derived-instance", mode: "derived-placement", anchor,
          startAnchor: { x: anchor.x, y: anchor.y } });
      }
      attachLocalSolveContext(dragSession);
      canvas.classList.add("is-dragging");
      canvas.setPointerCapture(e.pointerId);
      setHint(applicationText("インスタンス全体を移動中", "Moving the whole instance"));
      updateGeometrySelectionUI();
      draw();
      return;
    }
    const resolved = resolveDerivedDragSource(hit, pointer);
    clearSelection();
    canvasSelection.set("geometryInstances", hit?.instance ? [hit.instance] : []);
    if (hit.instance.type !== "sketchProjection") {
      canvasSelection.set("instanceGeometry", { instanceId: hit.instance.id, id: hit.item.id, kind: hit.kind, endpoint: hit.endpoint });
    }
    if (!resolved) {
      setHint(applicationText("派生インスタンスの参照元を解決できません", "The derived instance source could not be resolved."), "error");
      updateGeometrySelectionUI();
      draw();
      return;
    }
    if (resolved.crossesSketchProjection) {
      setHint(applicationText("スケッチ投影は先祖スケッチの参照元を変更するためドラッグできません", "Sketch projections cannot be dragged because that would modify source geometry in an ancestor sketch."), "error");
      updateGeometrySelectionUI();
      draw();
      return;
    }

    let source = resolved.item;
    let kind = hit.kind;
    let dragItem = source;
    if (source.blockProjection) {
      source = source.blockInstance;
      kind = "block";
      dragItem = source;
    } else if (kind === "arc-endpoint") {
      dragItem = { arc: source, endpoint: hit.endpoint };
    }
    dragSession = buildDragSession(kind, dragItem, resolved.pointer);
    if (!dragSession) {
      setHint(applicationText("参照元が固定されているためドラッグできません", "The source is fixed and cannot be dragged."), "error");
      updateGeometrySelectionUI();
      draw();
      return;
    }
    dragSession.displayStartPointer = pointer;
    dragSession.pointerMap = resolved.mapPointer;
    dragSession.derivedInstance = hit.instance;
    dragSession.derivedSource = resolved.item;
    const placements = new Set();
    for (let node = hit.item; node?.derivedProjection; node = node.sourceElement) {
      if (node.derivedInstance?.type === "free") placements.add(node.derivedInstance);
    }
    if (placements.size) dragSession.variableAllowed = (v) => !placements.has(v.object);
    attachLocalSolveContext(dragSession);
    canvas.classList.add("is-dragging");
    canvas.setPointerCapture(e.pointerId);
    setHint(applicationText(`${dragLabel(dragSession)}中: 参照元へ反映しながら拘束をsolveしています`, `${dragLabel(dragSession)}: solving constraints while updating the source`));
    updateUI({ refreshAnalysis: false });
    draw();
  }

  function dragSessionSeeds(session) {
    const seeds = [];
    if (!session) return seeds;
    if (session.item) {
      seeds.push(session.item);
      if (session.item.center) seeds.push(session.item.center);
    }
    for (const p of session.points || []) seeds.push(p.point);
    return seeds;
  }

  function geometryInstanceSourceObjects(instance) {
    const seen = new Set();
    const visit = (item) => {
      if (!item || seen.has(item)) return;
      seen.add(item);
      for (const point of geometryInstanceSourcePoints(item)) if (point !== item) visit(point);
      if (item.blockInstance) seen.add(item.blockInstance);
      if (item.derivedInstance) {
        seen.add(item.derivedInstance);
        for (const ref of geometryInstanceDependencyRefs(item.derivedInstance)) visit(resolveGeometryRef(ref));
      }
    };
    for (const ref of instance.sources) visit(resolveGeometryRef(ref));
    return seen;
  }

  function pointCoordinateFreedomRank(analysis, pointEntries, tolerance = 1e-8) {
    const basis = analysis?.nullspaceBasis || [];
    if (basis.length === 0) return 0;
    const orthonormalRows = [];
    for (const entry of pointEntries || []) {
      const indices = analysis.variableIndex.get(entry.point) || {};
      for (const prop of ["x", "y"]) {
        const index = indices[prop];
        if (!Number.isInteger(index)) continue;
        const residual = basis.map((vector) => vector[index] || 0);
        for (const row of orthonormalRows) {
          const projection = residual.reduce((sum, value, rowIndex) => sum + value * row[rowIndex], 0);
          for (let rowIndex = 0; rowIndex < residual.length; rowIndex += 1) residual[rowIndex] -= projection * row[rowIndex];
        }
        const norm = vectorNorm(residual);
        if (norm <= tolerance) continue;
        orthonormalRows.push(residual.map((value) => value / norm));
      }
    }
    return orthonormalRows.length;
  }

  function attachLocalSolveContext(session) {
    if (!session) return session;
    const projectionTouched = [
      ...(session.item && !model.blockInstances.includes(session.item) ? [session.item] : []),
      ...(session.points || []).map((entry) => entry.point),
    ].filter(Boolean);
    session.projectionShapeLocked = sketchProjectionConstraintsAffectingItems(projectionTouched).length > 0;
    session.local = localSolveContextFromSeeds(dragSessionSeeds(session), session.sketchId);
    if (session.variableAllowed) session.local.variables = session.local.variables.filter(session.variableAllowed);
    if ((session.kind === "block" || session.kind === "block-rotation") && session.item && !session.item.fixed) {
      const existing = new Set(session.local.variables.filter((variable) => variable.object === session.item).map((variable) => variable.prop));
      if (!existing.has("x")) session.local.variables.push({ object: session.item, prop: "x", label: `${session.item.id}.x` });
      if (!existing.has("y")) session.local.variables.push({ object: session.item, prop: "y", label: `${session.item.id}.y` });
      if (!session.item.rotationLocked && !existing.has("rotation")) session.local.variables.push({ object: session.item, prop: "rotation", label: `${session.item.id}.rotation` });
    }
    session.local.pointStarts = model.points
      .filter((p) => session.local.component.has(p) && !p.fixed && !pointLockedByLineFixed(p))
      .map((point) => ({ point, startX: point.x, startY: point.y }));
    session.local.fixedPointCount = model.points.filter((p) => session.local.component.has(p) && (p.fixed || pointLockedByLineFixed(p))).length;
    // Count motion visible at the dragged line, rather than unrelated freedom
    // elsewhere in its component. One visible DOF needs one representative
    // point even when another attached arc has an independent free endpoint.
    if (session.kind === "line") {
      const analysis = solver.analyzeConstraintState({
        variables: session.local.variables,
        constraints: session.local.constraints,
        lines: session.local.lines,
      });
      const line = session.item;
      const visibleBasis = [];
      for (const basis of analysis.nullspaceBasis) {
        const residual = [line.p1, line.p2].flatMap((point) => ["x", "y"].map((prop) => variableDeltaInBasis(point, prop, basis, analysis)));
        for (let pass = 0; pass < 2; pass++) for (const previous of visibleBasis) {
          const factor = residual.reduce((sum, value, i) => sum + value * previous[i], 0);
          for (let i = 0; i < residual.length; i++) residual[i] -= factor * previous[i];
        }
        const norm = vectorNorm(residual);
        if (norm > 1e-8) visibleBasis.push(residual.map((value) => value / norm));
      }
      const freeTranslation = [[1, 0, 1, 0], [0, 1, 0, 1]].every((translation) => {
        const residual = [...translation];
        for (const basis of visibleBasis) {
          const factor = translation.reduce((sum, value, i) => sum + value * basis[i], 0);
          for (let i = 0; i < residual.length; i++) residual[i] -= factor * basis[i];
        }
        return vectorNorm(residual) < 1e-7;
      });
      const normal = analysis.lineNormals?.get(line) || lineSupportNormal(line);
      session.translationReference = analysis.stable && (freeTranslation || !analysis.nullspaceBasis.some((basis) => {
        const dx = variableDeltaInBasis(line.p2, "x", basis, analysis) - variableDeltaInBasis(line.p1, "x", basis, analysis);
        const dy = variableDeltaInBasis(line.p2, "y", basis, analysis) - variableDeltaInBasis(line.p1, "y", basis, analysis);
        return Math.abs(normal.x * dx + normal.y * dy) > 1e-7 * Math.max(1, Math.hypot(...basis));
      }));
      if (session.points.length > 1 && session.local.fixedPointCount > 0 && analysis.stable && pointCoordinateFreedomRank(analysis, session.points) === 1) {
        const fixedPoints = model.points.filter((point) =>
          session.local.component.has(point) && (point.fixed || pointLockedByLineFixed(point)));
        const pointActivity = (entry) => {
          const index = analysis.variableIndex.get(entry.point) || {};
          return Math.sqrt((analysis.nullspaceBasis || []).reduce((sum, basis) =>
            sum + (basis[index.x] || 0) ** 2 + (basis[index.y] || 0) ** 2, 0));
        };
        const nearestFixedDistance = (entry) => Math.min(...fixedPoints.map((fixed) =>
          hypot2(entry.point.x - fixed.x, entry.point.y - fixed.y)));
        const best = session.points.reduce((current, candidate) => {
          if (!current) return candidate;
          const activityDifference = pointActivity(candidate) - pointActivity(current);
          if (Math.abs(activityDifference) > 1e-8) return activityDifference > 0 ? candidate : current;
          return nearestFixedDistance(candidate) > nearestFixedDistance(current) ? candidate : current;
        }, null);
        if (best && pointActivity(best) > 1e-8) session.lineDragPoint = best;
      }
    }
    session.fullDragState = solver.clone(solver.getVariables());
    session.parameterDragSnapshot = snapshotModelState();
    return session;
  }

  function sketchProjectionBlockedDragResult() {
    return {
      success: false,
      blocked: true,
      reason: sketchProjectionShapeEditBlockedMessage(applicationText("ドラッグ", "Drag")),
      errorNorm: 0,
      iterations: 0,
      variableCount: 0,
      constraintCount: 0,
    };
  }

  function selectedDragPoints() {
    const points = [...canvasSelection.points];
    for (const line of canvasSelection.lines) points.push(line.p1, line.p2);
    for (const circle of canvasSelection.circles) points.push(circle.center);
    for (const arc of canvasSelection.arcs) points.push(arc.center);
    for (const spline of canvasSelection.splines) points.push(...spline.fitPoints);
    return points;
  }

  function selectedElementCount() {
    return canvasSelection.points.length + canvasSelection.lines.length + canvasSelection.circles.length + canvasSelection.arcs.length + canvasSelection.splines.length + canvasSelection.blockInstances.length + canvasSelection.geometryInstances.length + canvasSelection.annotations.length + canvasSelection.hatches.length + canvasSelection.referenceImages.length + (canvasSelection.arcEndpoint ? 1 : 0);
  }

  function hitIsSelected(hitP, hitL, hitC, hitA, hitArcEnd) {
    if (hitP && canvasSelection.points.includes(hitP)) return true;
    if (hitL && canvasSelection.lines.includes(hitL)) return true;
    if (hitC && canvasSelection.circles.includes(hitC)) return true;
    if (hitA && canvasSelection.arcs.includes(hitA)) return true;
    if (hitArcEnd && sameArcEndpoint(canvasSelection.arcEndpoint, { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint })) return true;
    return false;
  }

  function selectHitOnly(hitP, hitL, hitC, hitA, hitArcEnd) {
    canvasSelection.set("instanceGeometry", null);
    canvasSelection.set("dimensionConstraint", null);
    canvasSelection.set("constraint", null);
    canvasSelection.set("blockInstances", []);
    canvasSelection.set("annotations", []);
    canvasSelection.set("hatches", []);
    canvasSelection.set("referenceImages", []);
    canvasSelection.set("points", hitP ? [hitP] : []);
    canvasSelection.set("lines", hitL ? [hitL] : []);
    canvasSelection.set("circles", hitC ? [hitC] : []);
    canvasSelection.set("arcs", hitA ? [hitA] : hitArcEnd ? [hitArcEnd.arc] : []);
    canvasSelection.set("arcEndpoint", hitArcEnd ? { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint } : null);
    canvasSelection.set("arcEndpointPair", null);
    draw();
  }

  function dragTargets(session, pointer) {
    const dx = pointer.x - session.startPointer.x;
    const dy = pointer.y - session.startPointer.y;
    const points = session.lineDragPoint ? [session.lineDragPoint] : session.points;
    return points.map((p) => ({ point: p.point, x: p.startX + dx, y: p.startY + dy }));
  }

  function radiusDragTargets(session, pointer) {
    return [
      {
        object: session.item,
        prop: "radiusValue",
        // Keep the radius request tied to the geometry at pointer-down. The
        // constrained solve may move the center; measuring from that moving
        // center feeds the solver's own correction back into the next event
        // and can amplify a one-pixel cursor step into a large radius jump.
        value: hypot2(pointer.x - session.startCenterX, pointer.y - session.startCenterY),
        min: MIN_ORIENTATION_LENGTH,
        radialPointer: pointer,
      },
    ];
  }

  function primitiveMoveTargets(session, pointer) {
    if (session.item.center.fixed) return [];
    const dx = pointer.x - session.startPointer.x;
    const dy = pointer.y - session.startPointer.y;
    return [{ point: session.item.center, x: session.startCenterX + dx, y: session.startCenterY + dy }];
  }

  function hasDirectRadiusDimension(primitive) {
    return model.constraints.some(
      (c) => c.enabled !== false && (c instanceof RadiusConstraint || c instanceof DiameterConstraint) && c.primitive === primitive,
    );
  }

  function guidedTargetHasNoActivity(result) {
    return Boolean(
      result?.guided
      && Array.isArray(result.targetConstraints)
      && result.targetConstraints.length === 0
      && Array.isArray(result.targetActivity)
      && result.targetActivity.every((activity) => activity <= 1e-8)
    );
  }

  function arcEndpointDragTargets(session, pointer) {
    const prop = session.endpoint === "start" ? "startAngle" : "endAngle";
    const rawAngle = Math.atan2(pointer.y - session.item.center.y, pointer.x - session.item.center.x);
    const value = arcEndpointDragValue(session.item, session.endpoint, rawAngle);
    return [
      {
        object: session.item,
        prop,
        value,
        endpointPointer: { x: (session.startEndpoint || session.startPointer).x + pointer.x - session.startPointer.x,
          y: (session.startEndpoint || session.startPointer).y + pointer.y - session.startPointer.y },
      },
    ];
  }

  function dragConstraintsFromTargets(targets) {
    return targets.map((target) => new DragConstraint(target.point, target.x, target.y));
  }

  function parameterDragConstraintsFromTargets(targets) {
    return targets.map((target) => new ParameterDragConstraint(target.object, target.prop, target.value, target.min));
  }

  function solveLocalDrag(session, extra) {
    if (!session?.local) return null;
    return solver.solveSubset({
      variables: session.local.variables,
      constraints: session.local.constraints,
      lines: session.local.lines,
      extra,
    });
  }

  function guidedTargetEntries(targets = []) {
    const entries = [];
    for (const target of targets) {
      if (target.point) {
        entries.push({ object: target.point, prop: "x", value: target.x });
        entries.push({ object: target.point, prop: "y", value: target.y });
      } else if (target.object && target.prop) {
        entries.push({ object: target.object, prop: target.prop, value: target.value });
      }
    }
    return entries;
  }

  function sameGuidedTargetEntries(a = [], b = []) {
    return a.length === b.length && a.every((entry, index) =>
      entry.object === b[index].object && entry.prop === b[index].prop && entry.value === b[index].value,
    );
  }

  function guidedTargetStepForSession(session, targets) {
    const entries = guidedTargetEntries(targets);
    if (sameGuidedTargetEntries(entries, session?.pendingGuidedTargetEntries)) {
      return { entries, norm: session.pendingGuidedTargetStepNorm };
    }
    const previous = session?.lastGuidedTargetEntries || [];
    const deltas = entries.map((entry) => {
      const prior = previous.find((candidate) => candidate.object === entry.object && candidate.prop === entry.prop);
      const previousValue = prior ? prior.value : entry.object[entry.prop];
      const rawDelta = entry.value - previousValue;
      if (
        (entry.prop === "startAngle" || entry.prop === "endAngle")
        && Number.isFinite(entry.object?.radiusValue)
      ) {
        return rawDelta * Math.max(MIN_ORIENTATION_LENGTH, Math.abs(entry.object.radiusValue));
      }
      return rawDelta;
    });
    const norm = vectorNorm(deltas);
    if (session) {
      session.pendingGuidedTargetEntries = entries;
      session.pendingGuidedTargetStepNorm = norm;
    }
    return { entries, norm };
  }

  function commitGuidedTargetStep(session, targetStep) {
    if (!session || !targetStep) return;
    session.lastGuidedTargetEntries = targetStep.entries;
  }

  function solveLocalGuidedDrag(session, targets, targetStepNorm = null) {
    if (!session?.local) return null;
    const errorTolerance = Math.max(
      CONSTRAINT_ACCEPT_ERROR,
      Math.min(DRAG_PREVIEW_MAX_MODEL_ERROR, DRAG_PREVIEW_ERROR_SCREEN_PX / Math.max(viewport.scale, 1e-9)),
    );
    return withDragStepNorm(dragStepNormForTargets(targets), () =>
      solver.solveSubsetGuided({
        variables: session.local.variables,
        constraints: session.local.constraints,
        lines: session.local.lines,
        targets,
        errorTolerance,
        activeTargetVariables: session.guidedTargetVariables || [],
        referenceState: session.kind === "line" && (!session.lineDragPoint || session.translationReference) ? session.fullDragState || [] : [],
        preserveTranslation: Boolean(session.translationReference),
        targetStepNorm,
      }),
    );
  }

  function dragStepNormForTargets(targets = []) {
    let maxDelta = solver.maxStepNorm;
    for (const target of targets) {
      if (target.point) {
        maxDelta = Math.max(maxDelta, hypot2(target.x - target.point.x, target.y - target.point.y));
      } else if (target.object && target.prop) {
        maxDelta = Math.max(maxDelta, Math.abs(target.value - target.object[target.prop]));
      }
    }
    return Math.max(solver.maxStepNorm, maxDelta * 1.25);
  }

  function dragStepNormForExtra(extra = []) {
    let maxDelta = solver.maxStepNorm;
    for (const constraint of extra) {
      if (constraint instanceof DragConstraint) {
        maxDelta = Math.max(maxDelta, hypot2(constraint.targetX - constraint.point.x, constraint.targetY - constraint.point.y));
      } else if (constraint instanceof ArcEndpointDragConstraint) {
        const p = arcEndpointPoint(constraint.arc, constraint.endpoint);
        maxDelta = Math.max(maxDelta, hypot2(constraint.targetX - p.x, constraint.targetY - p.y));
      } else if (constraint instanceof ParameterDragConstraint) {
        maxDelta = Math.max(maxDelta, Math.abs(constraint.target - constraint.object[constraint.prop]));
      }
    }
    return Math.max(solver.maxStepNorm, maxDelta * 1.25);
  }

  function withDragStepNorm(stepNorm, callback) {
    const previous = solver.maxStepNorm;
    solver.maxStepNorm = Math.max(previous, Number.isFinite(stepNorm) ? stepNorm : previous);
    try {
      return callback();
    } finally {
      solver.maxStepNorm = previous;
    }
  }

  function withSolverMaxIterations(maxIterations, callback) {
    const previous = solver.maxIterations;
    solver.maxIterations = Math.max(previous, maxIterations);
    try {
      return callback();
    } finally {
      solver.maxIterations = previous;
    }
  }

  function solveDragWithFallback(session, extra, fullSolve, restoreState = null) {
    const stepNorm = dragStepNormForExtra(extra);
    const localResult = withDragStepNorm(stepNorm, () => solveLocalDrag(session, extra));
    if (localResult && localResult.success && localResult.errorNorm <= CONSTRAINT_ACCEPT_ERROR) return localResult;
    if (restoreState) solver.restore(restoreState);
    const result = withDragStepNorm(stepNorm, fullSolve);
    result.local = false;
    result.fallback = Boolean(localResult);
    result.localErrorNorm = localResult?.errorNorm;
    return result;
  }

  function solvePinnedLineTargets(session, targets, stepNorm) {
    if (
      session?.kind !== "line"
      || session.lineDragPoint
      || !session.local
      || session.local.constraints.length !== 1
      || !(session.local.constraints[0] instanceof LineCircleDistanceConstraint)
      || targets.length < 2
      || targets.some((target) => !target.point || !Number.isFinite(target.x) || !Number.isFinite(target.y))
    ) return null;
    const targetPoints = new Set(targets.map((target) => target.point));
    const remainingVariables = session.local.variables.filter((variable) => !targetPoints.has(variable.object));
    if (remainingVariables.length === session.local.variables.length) return null;
    const state = solver.clone(session.local.variables);
    for (const target of targets) {
      target.point.x = target.x;
      target.point.y = target.y;
    }
    const result = withDragStepNorm(stepNorm, () => solver.solveSubset({
      variables: remainingVariables,
      constraints: session.local.constraints,
      lines: session.local.lines,
    }));
    if (!Number.isFinite(result.errorNorm) || result.errorNorm > CONSTRAINT_ACCEPT_ERROR) {
      solver.restore(state);
      return null;
    }
    result.success = true;
    result.local = true;
    result.guided = false;
    result.pinnedLineTargets = true;
    return result;
  }

  function solveGuidedDragWithFallback(session, targets, fallbackExtra, fullSolve, restoreState = null) {
    const targetStep = guidedTargetStepForSession(session, targets);
    for (const target of targets) target.guidedStepNorm = targetStep.norm;
    const stepNorm = Math.max(dragStepNormForTargets(targets), dragStepNormForExtra(fallbackExtra));
    if (session?.local && session.local.constraints.length === 0) {
      for (const target of targets) {
        if (target.point) {
          target.point.x = target.x;
          target.point.y = target.y;
        } else if (target.object && target.prop) {
          target.object[target.prop] = target.min != null ? Math.max(target.min, target.value) : target.value;
        }
      }
      commitGuidedTargetStep(session, targetStep);
      session.lastGuidedPreviewError = 0;
      return {
        success: true,
        errorNorm: 0,
        iterations: 0,
        reason: "直接移動",
        local: true,
        guided: true,
        variableCount: session.local.variables.length,
        constraintCount: 0,
      };
    }
    const pinnedLineResult = solvePinnedLineTargets(session, targets, stepNorm);
    if (pinnedLineResult) {
      pinnedLineResult.targetStepNorm = targetStep.norm;
      pinnedLineResult.targetConstraints = fallbackExtra;
      pinnedLineResult.guidedRetryCount = 0;
      session.finalDragConstraints = fallbackExtra;
      commitGuidedTargetStep(session, targetStep);
      session.lastGuidedPreviewError = pinnedLineResult.errorNorm;
      return pinnedLineResult;
    }
    const guidedAttemptState = restoreState || solver.clone(session.local?.variables || solver.getVariables());
    let localResult = null;
    let localAcceptError = CONSTRAINT_ACCEPT_ERROR;
    const acceptablePreview = (result) => result
      && Number.isFinite(result.errorNorm)
      && result.errorNorm <= localAcceptError
      && vectorNorm(solver.computeErrorVectorForConstraints(session.local.constraints)) <= CONSTRAINT_ACCEPT_ERROR;
    let guidedRetryCount = 0;
    // A missed animation frame can collapse a long line translation into one
    // nonlinear solve. Give an exact whole-sketch solve a larger iteration
    // budget first; this is substantially cheaper than replaying dozens of
    // local steps when it converges. Keep bounded substeps as the robust
    // fallback so manifold backtracking cannot dilute the pointer movement.
    if (
      session?.kind === "line"
      && session.points.length > 1
      && !session.lineDragPoint
      && session.local.fixedPointCount === 0
      && targetStep.norm > 50
    ) {
      const guidedResult = withDragStepNorm(stepNorm, () => solveLocalGuidedDrag(session, targets, targetStep.norm));
      if (guidedResult?.success && guidedResult.errorNorm <= CONSTRAINT_ACCEPT_ERROR
        && targets.every((target) => hypot2(target.point.x - target.x, target.point.y - target.y) <= CONSTRAINT_ACCEPT_ERROR)) {
        session.finalDragConstraints = guidedResult.targetConstraints || [];
        session.guidedTargetVariables = guidedResult.activeTargetVariables || [];
        session.lastGuidedPreviewError = guidedResult.errorNorm;
        commitGuidedTargetStep(session, targetStep);
        return guidedResult;
      }
      solver.restore(guidedAttemptState);
      const fullVariables = sketchSolveVariables(session.sketchId);
      const fullAttemptState = solver.clone(fullVariables);
      const exactResult = withDragStepNorm(
        stepNorm,
        () => withSolverMaxIterations(100, fullSolve),
      );
      if (exactResult.success && exactResult.errorNorm <= CONSTRAINT_ACCEPT_ERROR) {
        exactResult.local = false;
        exactResult.guided = false;
        exactResult.exactSparseLine = true;
        exactResult.guidedRetryCount = 0;
        session.finalDragConstraints = fallbackExtra;
        commitGuidedTargetStep(session, targetStep);
        session.lastGuidedPreviewError = exactResult.errorNorm;
        return exactResult;
      }
      solver.restore(fullAttemptState);
      const substepCount = Math.min(
        SPARSE_LINE_DRAG_MAX_SUBSTEPS,
        Math.ceil(targetStep.norm / SPARSE_LINE_DRAG_SUBSTEP_NORM),
      );
      const starts = targets.map((target) => ({ x: target.point.x, y: target.point.y }));
      const previousActiveTargetVariables = session.guidedTargetVariables || [];
      let totalIterations = 0;
      let totalProjectedNorm = 0;
      let completed = true;
      for (let index = 1; index <= substepCount; index += 1) {
        const progress = index / substepCount;
        const substepTargets = targets.map((target, targetIndex) => {
          const start = starts[targetIndex];
          return {
            ...target,
            x: start.x + (target.x - start.x) * progress,
            y: start.y + (target.y - start.y) * progress,
          };
        });
        localResult = withDragStepNorm(stepNorm, () =>
          solveLocalGuidedDrag(session, substepTargets, targetStep.norm / substepCount));
        localAcceptError = Number.isFinite(localResult?.acceptError) ? localResult.acceptError : CONSTRAINT_ACCEPT_ERROR;
        const acceptable = acceptablePreview(localResult);
        if (!acceptable) {
          completed = false;
          break;
        }
        if (!localResult.success) {
          localResult.success = true;
          localResult.approximate = true;
          localResult.reason = "プレビュー許容誤差内";
        }
        totalIterations += localResult.iterations || 0;
        totalProjectedNorm += localResult.projectedNorm || 0;
        session.guidedTargetVariables = localResult.activeTargetVariables || session.guidedTargetVariables || [];
      }
      if (completed && localResult?.success) {
        localResult.iterations = totalIterations;
        localResult.projectedNorm = totalProjectedNorm;
        localResult.targetStepNorm = targetStep.norm;
        localResult.guidedSubstepCount = substepCount;
        localResult.guidedRetryCount = 0;
        session.finalDragConstraints = localResult.targetConstraints || [];
        commitGuidedTargetStep(session, targetStep);
        session.lastGuidedPreviewError = localResult.errorNorm;
        return localResult;
      }
      solver.restore(guidedAttemptState);
      session.guidedTargetVariables = previousActiveTargetVariables;
      localResult = null;
    }
    // A sparse pointer stream can deliver a very large reversal in one event.
    // Lines translate linearly and should follow that event exactly. For more
    // nonlinear point/arc drags, start with a shorter manifold step to avoid an
    // expensive, often singular full-step solve.
    const canShortenSparseStep = session?.mode !== "block" && session?.mode !== "block-rotation";
    const shouldTryExactSparseStep = session?.kind === "line" || targets.some((target) => target.point);
    const guidedScales = canShortenSparseStep && targetStep.norm > 50
      ? (shouldTryExactSparseStep ? [1, 0.25, 0.125, 0.0625] : [0.25, 0.125, 0.0625])
      : [1, 0.5, 0.25, 0.125, 0.0625];
    for (const scale of guidedScales) {
      if (scale < 1) solver.restore(guidedAttemptState);
      localResult = withDragStepNorm(stepNorm, () => solveLocalGuidedDrag(session, targets, targetStep.norm * scale));
      localAcceptError = Number.isFinite(localResult?.acceptError) ? localResult.acceptError : CONSTRAINT_ACCEPT_ERROR;
      const locallyAcceptable = acceptablePreview(localResult);
      if (locallyAcceptable) {
        // The nonlinear correction can exhaust its strict iteration budget
        // after already reaching the looser, screen-space preview tolerance.
        // Keep that visually valid local result; a full-document fallback is
        // both slower and less likely to converge during a sparse drag event.
        if (!localResult.success) {
          localResult.success = true;
          localResult.approximate = true;
          localResult.reason = "プレビュー許容誤差内";
        }
        break;
      }
      guidedRetryCount += 1;
    }
    if (localResult?.success && acceptablePreview(localResult)) {
      localResult.guidedRetryCount = guidedRetryCount;
      session.finalDragConstraints = localResult.targetConstraints || [];
      session.guidedTargetVariables = localResult.activeTargetVariables || [];
      commitGuidedTargetStep(session, targetStep);
      session.lastGuidedPreviewError = localResult.errorNorm;
      return localResult;
    }
    if (restoreState) solver.restore(restoreState);
    const result = withDragStepNorm(stepNorm, fullSolve);
    if (result.success) {
      session.finalDragConstraints = fallbackExtra;
      commitGuidedTargetStep(session, targetStep);
      session.lastGuidedPreviewError = result.errorNorm;
    }
    result.local = false;
    result.guided = false;
    result.fallback = Boolean(localResult);
    result.localErrorNorm = localResult?.errorNorm;
    result.guidedRetryCount = guidedRetryCount;
    return result;
  }

  function finalizeDragResult(result, state, session = null, extra = [], retry = null) {
    const lineRepair = enforceMinimumLineLengths(session?.local?.lines || model.lines);
    if (lineRepair.changed > 0) {
      result = retry ? retry() : session?.local ? solveDragWithFallback(session, extra, () => solveDragSketch(session, extra), state) : solveDragSketch(session, extra);
    }
    normalizeArcSweeps();
    result.lineRepair = lineRepair;
    if (lineRepair.failed) {
      solver.restore(state);
      result.blocked = true;
      result.success = false;
      result.reason = "R寸法と固定点によりこれ以上潰せません";
      result.lineRepair = lineRepair;
    } else if (!result.success) {
      solver.restore(state);
      result.blocked = true;
    }
    return result;
  }

  function dragResultForSession(session, pointer) {
    if (!interactionProfiler.active) return dragResultForSessionUnprofiled(session, pointer);
    return profileInteractionWork("solve", () => dragResultForSessionUnprofiled(session, pointer));
  }

  function dragResultForSessionUnprofiled(session, pointer) {
    if (session?.projectionShapeLocked) return sketchProjectionBlockedDragResult();
    let result;
    const dragVars = session?.local?.variables || solver.getVariables();
    const dragState = solver.clone(dragVars);
    if (session.mode === "derived-placement") {
      const targets = solver.observablePointDragTargets({ ...session.local, point: session.anchor,
        errorTolerance: DRAG_PREVIEW_MAX_MODEL_ERROR,
        x: session.startAnchor.x + pointer.x - session.startPointer.x,
        y: session.startAnchor.y + pointer.y - session.startPointer.y });
      const extra = parameterDragConstraintsFromTargets(targets);
      const retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solveDragSketch(session, extra), dragState);
      return finalizeDragResult(retry(), dragState, session, extra, retry);
    }
    if (session.mode === "block" || session.mode === "block-rotation") {
      const targets = session.mode === "block"
        ? [
            { object: session.item, prop: "x", value: session.startX + pointer.x - session.startPointer.x },
            { object: session.item, prop: "y", value: session.startY + pointer.y - session.startPointer.y },
          ]
        : (() => {
            const rotation = Math.atan2(pointer.y - session.rotationPivot.y, pointer.x - session.rotationPivot.x);
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            return [
              { object: session.item, prop: "x", value: session.rotationPivot.x - session.localCenter.x * cos + session.localCenter.y * sin },
              { object: session.item, prop: "y", value: session.rotationPivot.y - session.localCenter.x * sin - session.localCenter.y * cos },
              { object: session.item, prop: "rotation", value: rotation },
            ];
          })();
      const extra = parameterDragConstraintsFromTargets(targets);
      const retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solveDragSketch(session, extra), dragState);
      result = retry();
      invalidateBlockProjectionCache(session.item.id);
      return finalizeDragResult(result, dragState, session, extra, retry);
    }
    if (session.mode === "radius") {
      const moveTargets = primitiveMoveTargets(session, pointer);
      if (hasDirectRadiusDimension(session.item)) {
        session.activeMode = "move";
        const extra = dragConstraintsFromTargets(moveTargets);
        const targets = moveTargets;
        const retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solveDragSketch(session, extra), dragState);
        result = retry();
        return finalizeDragResult(result, dragState, session, extra, retry);
      }

      const state = solver.clone(dragVars);
      let targets = radiusDragTargets(session, pointer);
      let extra = parameterDragConstraintsFromTargets(targets);
      let retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solveDragSketch(session, extra), dragState);
      result = retry();
      if ((!result.success || guidedTargetHasNoActivity(result)) && moveTargets.length > 0) {
        solver.restore(state);
        session.activeMode = "move";
        targets = moveTargets;
        extra = dragConstraintsFromTargets(moveTargets);
        retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solveDragSketch(session, extra), dragState);
        result = retry();
        return finalizeDragResult(result, dragState, session, extra, retry);
      }
      session.activeMode = "radius";
      return finalizeDragResult(result, dragState, session, extra, retry);
    }
    let targets;
    let extra;
    if (session.mode === "arc-endpoint") {
      targets = arcEndpointDragTargets(session, pointer);
      extra = parameterDragConstraintsFromTargets(targets);
      const retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solveDragSketch(session, extra), dragState);
      result = retry();
      return finalizeDragResult(result, dragState, session, extra, retry);
    } else {
      const directTargets = dragTargets(session, pointer);
      targets = directTargets;
      extra = dragConstraintsFromTargets(directTargets);
    }
    const retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solveDragSketch(session, extra), dragState);
    result = retry();
    return finalizeDragResult(result, dragState, session, extra, retry);
  }

  function dragLabel(session) {
    if (session.kind === "free-instance" || session.kind === "derived-instance") return applicationText("インスタンス移動", "Instance move");
    if (session.mode === "block") return applicationText("ブロック移動", "Block move");
    if (session.mode === "block-rotation") return applicationText("ブロック回転", "Block rotation");
    if (session.kind === "selection") return applicationText("選択移動", "Selection move");
    if (session.mode === "radius" && session.activeMode === "move") return applicationText("ドラッグ", "Drag");
    if (session.mode === "radius") return applicationText("半径変更", "Radius change");
    if (session.mode === "arc-endpoint") return applicationText("円弧端点変更", "Arc endpoint change");
    return applicationText("ドラッグ", "Drag");
  }

  function beginDrag(e, hitP, hitL, hitC, hitA, hitArcEnd, pointer) {
    canvasSelection.set("constraint", null);
    const preserveMixedSelection = selectedElementCount() > 1 && hitIsSelected(hitP, hitL, hitC, hitA, hitArcEnd);
    if (preserveMixedSelection) {
      dragSession = buildDragSession("selection", selectedDragPoints(), pointer);
      canvasSelection.set("dimensionConstraint", null);
    } else {
      canvasSelection.set("blockInstances", []);
      canvasSelection.set("annotations", []);
      canvasSelection.set("hatches", []);
      canvasSelection.set("referenceImages", []);
      canvasSelection.set("splines", []);
    }
    if (!preserveMixedSelection && hitP) {
      canvasSelection.set("points", [hitP]);
      canvasSelection.set("lines", []);
      canvasSelection.set("circles", []);
      canvasSelection.set("arcs", []);
      canvasSelection.set("arcEndpoint", null);
      dragSession = buildDragSession("point", hitP, pointer);
    } else if (!preserveMixedSelection && hitArcEnd) {
      canvasSelection.set("arcs", [hitArcEnd.arc]);
      canvasSelection.set("arcEndpoint", { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint });
      canvasSelection.set("points", []);
      canvasSelection.set("lines", []);
      canvasSelection.set("circles", []);
      dragSession = buildDragSession("arc-endpoint", hitArcEnd, pointer);
    } else if (!preserveMixedSelection && hitL) {
      canvasSelection.set("lines", [hitL]);
      canvasSelection.set("points", []);
      canvasSelection.set("circles", []);
      canvasSelection.set("arcs", []);
      canvasSelection.set("arcEndpoint", null);
      dragSession = buildDragSession("line", hitL, pointer);
    } else if (!preserveMixedSelection && hitC) {
      canvasSelection.set("circles", [hitC]);
      canvasSelection.set("points", []);
      canvasSelection.set("lines", []);
      canvasSelection.set("arcs", []);
      canvasSelection.set("arcEndpoint", null);
      dragSession = buildDragSession("circle", hitC, pointer);
    } else if (!preserveMixedSelection && hitA) {
      canvasSelection.set("arcs", [hitA]);
      canvasSelection.set("points", []);
      canvasSelection.set("lines", []);
      canvasSelection.set("circles", []);
      canvasSelection.set("arcEndpoint", null);
      dragSession = buildDragSession("arc", hitA, pointer);
    }

    if (dragSession) {
      attachLocalSolveContext(dragSession);
      canvas.classList.add("is-dragging");
      canvas.setPointerCapture(e.pointerId);
      setHint(`${dragLabel(dragSession)}中: 拘束を保ちながら自動solveしています`);
    }
  }

  function beginDimensionDrag(e, hit, pointer, commandHits = null) {
    const anchor = dimensionAnchor(hit.target, hit.dimension);
    migrateAngleDimensionLabelPlacement(hit.target, hit.dimension);
    canvasSelection.set("dimensionConstraint", hit.constraint);
    canvasSelection.set("constraint", null);
    dimensionDragSession = {
      pointerId: e.pointerId,
      constraint: hit.constraint,
      target: hit.target,
      part: hit.part || "line",
      startPointer: pointer,
      startAnchor: anchor,
      startLabelOffsetU: Number(hit.dimension?.labelOffsetU) || 0,
      startDisplay: hit.dimension?.display ? { ...hit.dimension.display } : null,
      startAngleLabelOffsets:
        hit.target.kind === "angle"
          ? angleDimensionLabelOffsets(hit.target, hit.dimension) || { radial: 14 / viewport.scale, tangent: 0 }
          : null,
      startedDuringDimensionCommand: isDimensionConstraintCommandActive(),
      commandHits,
      moved: false,
    };
    canvas.classList.add("is-dragging");
    canvas.setPointerCapture(e.pointerId);
    setHint("寸法線を移動中");
  }

  function preserveDimensionDragDisplay(session, dimension) {
    if (session?.startDisplay) dimension.display = { ...session.startDisplay };
    return dimension;
  }

  function isDimensionConstraintCommandActive() {
    return pendingConstraintCommand?.type === "distance" && pendingCommand?.type !== "distance-value";
  }

  function syncAngleConstraintFromDimension(constraint, target, dimension) {
    if (!(constraint instanceof LineAngleConstraint) || target.kind !== "angle" || !dimension) return;
    if (isReadOnlyDimension(constraint)) return;
    const angles = angleDimensionAngles(target, null, dimension);
    constraint.startFlip = dimension.angleStartFlip ? 1 : 0;
    constraint.endFlip = dimension.angleEndFlip ? 1 : 0;
    constraint.target = Math.abs(angles.signed);
  }

  function handleRectangleClick(point) {
    const snapped = snapForDrawing(point);
    rectangleCommand.click(snapped, drawingSnap.active);
  }

  function hitSketchIdentityElement(x, y, options = {}) {
    const allowInactiveGeometry = Boolean(options.allowInactiveGeometry);
    const threshold = 7 / viewport.scale;
    const pointThreshold = 10 / viewport.scale;
    const accepts = (item) => isVisibleSketchElement(item) && (allowInactiveGeometry || isEditableSketchElement(item));
    const dimensionHit = hitDimension(x, y, { activeOnly: false });
    if (dimensionHit) {
      const sketchId = constraintSketchId(dimensionHit.constraint);
      return {
        id: dimensionHit.constraint.name || "寸法",
        label: dimensionHit.constraint.name || "寸法",
        sketchId,
        item: dimensionHit.constraint,
        kind: "dimension",
      };
    }

    for (let i = model.points.length - 1; i >= 0; i--) {
      const p = model.points[i];
      if (!accepts(p)) continue;
      if (hypot2(p.x - x, p.y - y) <= pointThreshold) return { id: p.id, sketchId: elementSketchId(p), item: p, kind: "point" };
    }
    for (let i = model.lines.length - 1; i >= 0; i--) {
      const line = model.lines[i];
      if (!accepts(line)) continue;
      if (distancePointToSegment(x, y, line) <= threshold) return { id: line.id, sketchId: elementSketchId(line), item: line, kind: "line" };
    }
    for (let i = model.circles.length - 1; i >= 0; i--) {
      const circle = model.circles[i];
      if (!accepts(circle)) continue;
      if (Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold) return { id: circle.id, sketchId: elementSketchId(circle), item: circle, kind: "circle" };
    }
    for (let i = model.arcs.length - 1; i >= 0; i--) {
      const arc = model.arcs[i];
      if (!accepts(arc)) continue;
      const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
      if (Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return { id: arc.id, sketchId: elementSketchId(arc), item: arc, kind: "arc" };
    }
    for (let i = model.splines.length - 1; i >= 0; i--) {
      const spline = model.splines[i];
      if (!accepts(spline)) continue;
      const closest = window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 });
      if (closest?.distance <= threshold) return { id: spline.id, sketchId: elementSketchId(spline), item: spline, kind: "spline" };
    }
    const block = hitBlockInstance(x, y, !allowInactiveGeometry);
    if (block) {
      const definition = blockDefinitionById(block.definitionId);
      return {
        id: block.id,
        label: `Block ${block.id}${definition?.name ? `: ${definition.name}` : ""}`,
        sketchId: block.sketchId,
        item: block,
        kind: "block",
      };
    }
    return null;
  }

  function beginBlockDrag(e, instance, pointer, rotate = false) {
    clearSelection();
    canvasSelection.set("blockInstances", [instance]);
    dragSession = buildDragSession(rotate ? "block-rotation" : "block", instance, pointer);
    if (!dragSession) {
      setHint(rotate && instance.rotationLocked ? "回転がロックされたブロックインスタンスです" : "固定されたブロックインスタンスです", "error");
      draw();
      return;
    }
    attachLocalSolveContext(dragSession);
    canvas.classList.add("is-dragging");
    canvas.setPointerCapture(e.pointerId);
    setHint(rotate ? "ブロックを回転中" : "ブロックを移動中");
    updateUI({ refreshAnalysis: false });
    draw();
  }

  function hitAnnotationTarget(x, y) {
    const threshold = 8 / viewport.scale;
    const pointThreshold = 10 / viewport.scale;
    const points = allGeometryPoints();
    const arcs = allGeometryArcs();
    const circles = allGeometryCircles();
    const lines = allGeometryLines();
    const splines = allGeometrySplines();
    for (let i = points.length - 1; i >= 0; i--) {
      const point = points[i];
      if (!isVisibleSketchElement(point)) continue;
      if (!point.blockProjection && !isExplicitPoint(point) && !isPointUsedByPrimitive(point) && !isPointUsedByLine(point) && !isReferencePoint(point)) continue;
      if (hypot2(point.x - x, point.y - y) <= pointThreshold) return { kind: "point", item: point };
    }
    for (let i = arcs.length - 1; i >= 0; i--) {
      const arc = arcs[i];
      if (!isVisibleSketchElement(arc)) continue;
      const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
      if (Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return { kind: "arc", item: arc };
    }
    for (let i = circles.length - 1; i >= 0; i--) {
      const circle = circles[i];
      if (!isVisibleSketchElement(circle)) continue;
      if (Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold) return { kind: "circle", item: circle };
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!isVisibleSketchElement(line)) continue;
      if (distancePointToSegment(x, y, line) <= threshold) return { kind: "line", item: line };
    }
    for (let i = splines.length - 1; i >= 0; i--) {
      const spline = splines[i];
      if (!isVisibleSketchElement(spline)) continue;
      const closest = window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 });
      if (closest?.distance <= threshold) return { kind: "spline", item: spline };
    }
    return null;
  }

  function hitReferenceTarget(x, y) {
    const threshold = 7 / viewport.scale;
    const pointThreshold = 10 / viewport.scale;
    const allowedSketches = new Set(referenceSourceSketchIds());
    if (allowedSketches.size === 0) return null;
    const points = allGeometryPoints();
    const lines = allGeometryLines();
    const circles = allGeometryCircles();
    const arcs = allGeometryArcs();
    const splines = allGeometrySplines();
    for (let i = points.length - 1; i >= 0; i--) {
      const point = points[i];
      const sketchId = elementSketchId(point);
      if (!allowedSketches.has(sketchId) || !isVisibleSketchElement(point)) continue;
      if (!point.blockProjection && !isExplicitPoint(point) && !isPointUsedByPrimitive(point) && !isReferencePoint(point)) continue;
      if (hypot2(point.x - x, point.y - y) <= pointThreshold) return { kind: "point", point, sketchId };
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const sketchId = elementSketchId(line);
      if (!allowedSketches.has(sketchId) || !isVisibleSketchElement(line)) continue;
      if (distancePointToSegment(x, y, line) <= threshold) return { kind: "line", line, sketchId };
    }
    for (let i = circles.length - 1; i >= 0; i--) {
      const circle = circles[i];
      const sketchId = elementSketchId(circle);
      if (!allowedSketches.has(sketchId) || !isVisibleSketchElement(circle)) continue;
      if (Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold) return { kind: "primitive", primitive: circle, sketchId };
    }
    for (let i = arcs.length - 1; i >= 0; i--) {
      const arc = arcs[i];
      const sketchId = elementSketchId(arc);
      if (!allowedSketches.has(sketchId) || !isVisibleSketchElement(arc)) continue;
      const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
      if (Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return { kind: "primitive", primitive: arc, sketchId };
    }
    for (let i = splines.length - 1; i >= 0; i--) {
      const spline = splines[i];
      const sketchId = elementSketchId(spline);
      if (!allowedSketches.has(sketchId) || !isVisibleSketchElement(spline)) continue;
      const closest = window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 });
      if (closest?.distance <= threshold) return { kind: "spline", spline, parameter: closest.t, sketchId };
    }
    return null;
  }

  function executeTrimAt(pointer) {
    const preview = computeTrimPreview(pointer);
    if (!preview) {
      setHint("トリムできる交点がありません", "error");
      draw();
      return false;
    }
    if (!guardSketchProjectionShapeEdit([preview.item], { action: applicationText("トリム", "Trim") })) {
      trimPreview = null;
      draw();
      return false;
    }
    const snapshot = snapshotGeometryMutationState();
    if (preview.kind === "line") executeLineTrim(preview);
    else if (preview.kind === "arc") executeArcTrim(preview);
    else executeCircleTrim(preview);
    trimPreview = null;
    clearSelection();
    const solved = stabilizeActiveParameterNamespace(activeSketchId());
    const result = solved.result;
    if (!solved.success || solved.dependent?.success === false || result.errorNorm > CONSTRAINT_ACCEPT_ERROR) {
      restoreGeometryMutationState(snapshot);
      setHint(applicationText("拘束を維持できないためトリムを戻しました。拘束状態を確認してください", "The trim was restored because its constraints could not be maintained. Check the constraint status."), "error");
      updateUI();
      draw();
      return false;
    }
    constraintAnalysisState = null;
    refreshConstraintAnalysis();
    setHint(applicationText("トリムしました", "Trim completed"));
    updateUI({ refreshAnalysis: false });
    draw();
    recordHistory("トリム");
    return true;
  }

  const CANVAS_CONTEXT_KIND_PRIORITY = Object.freeze({
    point: 0,
    "arc-endpoint": 1,
    line: 2,
    circle: 3,
    arc: 4,
    spline: 5,
    dimension: 6,
    annotation: 7,
    block: 8,
    "geometry-instance": 9,
    hatch: 10,
  });

  function canvasContextPointIsSelectable(point) {
    return isExplicitPoint(point) || ((isEndpointPoint(point) && isPointUsedByPrimitive(point) && (!isSplineOnlyFitPoint(point) || isEditableSplineFitPoint(point))) || isReferencePoint(point));
  }

  function canvasContextAnnotationHit(element, pointer) {
    if (!element || element.visible === false) return null;
    const threshold = 12 / viewport.scale;
    if (element.type === "leader") {
      const start = annotationLeaderAnchor(element);
      if (!start || !element.end) return null;
      const elbow = element.elbow || { x: (start.x + element.end.x) / 2, y: element.end.y };
      const firstDistance = distancePointToSegmentPoints(pointer.x, pointer.y, start, elbow);
      const secondDistance = distancePointToSegmentPoints(pointer.x, pointer.y, elbow, element.end);
      const lineDistance = Math.min(firstDistance, secondDistance);
      if (lineDistance <= threshold * 2.2) return { element, type: "leader", part: "line", distance: lineDistance };
      if (pointInAnnotationTextBox(pointer.x, pointer.y, element, threshold)) return { element, type: "leader", part: "label", distance: 0 };
      const labelDistance = hypot2(pointer.x - element.x, pointer.y - element.y);
      if (labelDistance <= threshold * 3) return { element, type: "leader", part: "label", distance: labelDistance };
      const leaderBox = boxFromPoints([start, elbow, element.end, { x: element.x, y: element.y }]);
      if (leaderBox && pointInExpandedBox(pointer.x, pointer.y, leaderBox, threshold * 2.2)) {
        return { element, type: "leader", part: "line", distance: Math.min(lineDistance, labelDistance) };
      }
      return null;
    }
    if (element.type === "text" && pointInAnnotationTextBox(pointer.x, pointer.y, element, threshold)) {
      return { element, type: "text", part: "label", distance: 0 };
    }
    return null;
  }

  function canvasContextBlockHitDistance(instance, pointer) {
    if (!instance || !isEditableSketchId(instance.sketchId) || !isVisibleSketchId(instance.sketchId)) return null;
    const threshold = 8 / viewport.scale;
    let distance = Infinity;
    const bundle = blockProjectionBundle(instance);
    for (const point of bundle.points) {
      if (!isVisibleSketchElement(point)) continue;
      const next = hypot2(point.x - pointer.x, point.y - pointer.y);
      if (next <= threshold) distance = Math.min(distance, next);
    }
    for (const line of bundle.lines) {
      if (!isVisibleSketchElement(line)) continue;
      const next = distancePointToSegment(pointer.x, pointer.y, line);
      if (next <= threshold) distance = Math.min(distance, next);
    }
    for (const circle of bundle.circles) {
      if (!isVisibleSketchElement(circle)) continue;
      const next = Math.abs(hypot2(pointer.x - circle.center.x, pointer.y - circle.center.y) - circle.radius());
      if (next <= threshold) distance = Math.min(distance, next);
    }
    for (const arc of bundle.arcs) {
      if (!isVisibleSketchElement(arc)) continue;
      const next = Math.abs(hypot2(pointer.x - arc.center.x, pointer.y - arc.center.y) - arc.radius());
      const angle = Math.atan2(pointer.y - arc.center.y, pointer.x - arc.center.x);
      if (next <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) distance = Math.min(distance, next);
    }
    for (const spline of bundle.splines || []) {
      if (!isVisibleSketchElement(spline)) continue;
      const closest = window.SplineGeometry.closestPoint(spline.curve(), pointer, { samplesPerSpan: 28 });
      if (closest?.distance <= threshold) distance = Math.min(distance, closest.distance);
    }
    for (const annotation of bundle.annotations || []) {
      const hit = canvasContextAnnotationHit(annotation, pointer);
      if (hit) distance = Math.min(distance, hit.distance);
    }
    for (const hatch of bundle.hatches || []) {
      const resolved = resolvedHatchBoundary(hatch);
      if (resolved.ok && hatchAppearanceForDisplay(hatch).visible !== false && hatchContainsSelectablePoint(hatch, resolved, pointer)) distance = 0;
    }
    return Number.isFinite(distance) ? distance : null;
  }

  function canvasContextGeometryInstanceHitDistance(instance, pointer) {
    if (!instance || !isEditableSketchId(instance.sketchId) || !isVisibleSketchId(instance.sketchId)) return null;
    const threshold = 8 / viewport.scale;
    let distance = Infinity;
    const bundle = geometryInstanceBundle(instance);
    for (const point of bundle.points) {
      const next = hypot2(point.x - pointer.x, point.y - pointer.y);
      if (next <= threshold) distance = Math.min(distance, next);
    }
    for (const line of bundle.lines) {
      const next = distancePointToSegment(pointer.x, pointer.y, line);
      if (next <= threshold) distance = Math.min(distance, next);
    }
    for (const circle of bundle.circles) {
      const next = Math.abs(hypot2(pointer.x - circle.center.x, pointer.y - circle.center.y) - circle.radius());
      if (next <= threshold) distance = Math.min(distance, next);
    }
    for (const arc of bundle.arcs) {
      const next = Math.abs(hypot2(pointer.x - arc.center.x, pointer.y - arc.center.y) - arc.radius());
      const angle = Math.atan2(pointer.y - arc.center.y, pointer.x - arc.center.x);
      if (next <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) distance = Math.min(distance, next);
    }
    for (const spline of bundle.splines || []) {
      const closest = window.SplineGeometry.closestPoint(spline.curve(), pointer, { samplesPerSpan: 28 });
      if (closest?.distance <= threshold) distance = Math.min(distance, closest.distance);
    }
    return Number.isFinite(distance) ? distance : null;
  }

  function canvasContextCandidatesAt(pointer) {
    const candidates = [];
    const push = (target, distance, drawOrder) => {
      candidates.push({
        ...target,
        contextDistance: Number(distance) || 0,
        contextPriority: CANVAS_CONTEXT_KIND_PRIORITY[target.kind] ?? 99,
        contextDrawOrder: Number(drawOrder) || 0,
      });
    };

    const pointThreshold = 10 / viewport.scale;
    model.points.forEach((point, index) => {
      if (!isEditableSketchElement(point) || !isVisibleSketchElement(point) || !canvasContextPointIsSelectable(point)) return;
      const distance = hypot2(point.x - pointer.x, point.y - pointer.y);
      if (distance <= pointThreshold) push({ kind: "point", item: point }, distance, index);
    });

    model.arcs.forEach((arc, index) => {
      if (!isEditableSketchElement(arc) || !isVisibleSketchElement(arc)) return;
      for (const endpoint of ["start", "end"]) {
        const point = arcEndpointPoint(arc, endpoint);
        const distance = hypot2(point.x - pointer.x, point.y - pointer.y);
        if (distance <= pointThreshold) push({ kind: "arc-endpoint", item: arc, endpoint, hit: { arc, endpoint, point } }, distance, index * 2 + (endpoint === "end" ? 1 : 0));
      }
    });

    const geometryThreshold = 7 / viewport.scale;
    model.lines.forEach((line, index) => {
      if (!isEditableSketchElement(line) || !isVisibleSketchElement(line)) return;
      const distance = distancePointToSegment(pointer.x, pointer.y, line);
      if (distance <= geometryThreshold) push({ kind: "line", item: line }, distance, normalizedDrawingOrder(line.drawingOrder) ?? index);
    });
    model.circles.forEach((circle, index) => {
      if (!isEditableSketchElement(circle) || !isVisibleSketchElement(circle)) return;
      const distance = Math.abs(hypot2(pointer.x - circle.center.x, pointer.y - circle.center.y) - circle.radius());
      if (distance <= geometryThreshold) push({ kind: "circle", item: circle }, distance, normalizedDrawingOrder(circle.drawingOrder) ?? index);
    });
    model.arcs.forEach((arc, index) => {
      if (!isEditableSketchElement(arc) || !isVisibleSketchElement(arc)) return;
      const distance = Math.abs(hypot2(pointer.x - arc.center.x, pointer.y - arc.center.y) - arc.radius());
      const angle = Math.atan2(pointer.y - arc.center.y, pointer.x - arc.center.x);
      if (distance <= geometryThreshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) push({ kind: "arc", item: arc }, distance, normalizedDrawingOrder(arc.drawingOrder) ?? index);
    });
    model.splines.forEach((spline, index) => {
      if (!isEditableSketchElement(spline) || !isVisibleSketchElement(spline)) return;
      const closest = window.SplineGeometry.closestPoint(spline.curve(), pointer, { samplesPerSpan: 28 });
      if (closest?.distance <= geometryThreshold) push({ kind: "spline", item: spline }, closest.distance, normalizedDrawingOrder(spline.drawingOrder) ?? index);
    });

    const dimensionThreshold = 12 / viewport.scale;
    model.constraints.forEach((constraint, index) => {
      if (!isActiveSketchConstraint(constraint) || !isVisibleSketchId(constraintSketchId(constraint))) return;
      const target = targetFromConstraint(constraint);
      if (!target) return;
      const dimension = constraint.dimension || defaultDimensionForTarget(target);
      if (!viewState.constraintStatus && effectiveDimensionAppearance(dimension, constraintSketchId(constraint)).visible === false) return;
      const layout = dimensionLayout(target, dimension);
      if (!layout) return;
      const labelDistance = hypot2(pointer.x - layout.text.x, pointer.y - layout.text.y);
      const lineDistance = distancePointToSegmentPoints(pointer.x, pointer.y, layout.hitA, layout.hitB);
      const labelHit = labelDistance <= dimensionThreshold * 2.2;
      const lineHit = lineDistance <= dimensionThreshold * 1.4;
      if (!labelHit && !lineHit) return;
      const part = labelHit ? "label" : "line";
      push({ kind: "dimension", item: constraint, hit: { constraint, target, dimension, part } }, Math.min(labelHit ? labelDistance : Infinity, lineHit ? lineDistance : Infinity), index);
    });

    model.annotations.forEach((annotation, index) => {
      if (annotation.sketchId !== activeSketchId() || !isVisibleSketchId(annotation.sketchId)) return;
      const hit = canvasContextAnnotationHit(annotation, pointer);
      if (hit) push({ kind: "annotation", item: annotation, hit }, hit.distance, index);
    });

    model.blockInstances.forEach((block, index) => {
      const distance = canvasContextBlockHitDistance(block, pointer);
      if (distance != null) push({ kind: "block", item: block }, distance, normalizedDrawingOrder(block.drawingOrder) ?? index);
    });

    model.geometryInstances.forEach((instance, index) => {
      const distance = canvasContextGeometryInstanceHitDistance(instance, pointer);
      if (distance != null) push({ kind: "geometry-instance", item: instance }, distance, normalizedDrawingOrder(instance.drawingOrder) ?? index);
    });

    model.hatches.forEach((hatch, index) => {
      if (hatch.sketchId !== activeSketchId() || !isVisibleSketchId(hatch.sketchId) || hatchAppearanceForDisplay(hatch).visible === false) return;
      const resolved = resolvedHatchBoundary(hatch);
      if (hatchContainsSelectablePoint(hatch, resolved, pointer)) push({ kind: "hatch", item: hatch }, 0, normalizedDrawingOrder(hatch.drawingOrder) ?? index);
    });

    const sorted = candidates.sort((a, b) => {
      const distanceDifference = a.contextDistance - b.contextDistance;
      if (Math.abs(distanceDifference) > 1e-9) return distanceDifference;
      if (a.contextPriority !== b.contextPriority) return a.contextPriority - b.contextPriority;
      return b.contextDrawOrder - a.contextDrawOrder;
    });
    const editedFitPoint = sorted.find((target) => target.kind === "point" && splineEditSession?.spline?.fitPoints.includes(target.item));
    return editedFitPoint ? [editedFitPoint] : sorted;
  }

  function canvasContextCandidatePresentation(target) {
    const item = target.item;
    if (target.kind === "point") return {
      icon: toolbarSvgMarkup("#toolPoint"),
      type: applicationText("点", "Point"),
      id: item.id,
      secondary: `X ${formatDisplayNumber(item.x)} / Y ${formatDisplayNumber(item.y)}`,
    };
    if (target.kind === "arc-endpoint") return {
      icon: toolbarSvgMarkup("#toolArc"),
      type: applicationText("円弧端点", "Arc Endpoint"),
      id: item.id,
      secondary: target.endpoint === "start" ? applicationText("始点", "Start") : applicationText("終点", "End"),
    };
    if (target.kind === "line") return {
      icon: toolbarSvgMarkup("#toolLine"),
      type: applicationText("線", "Line"),
      id: item.id,
      secondary: `${item.p1.id}–${item.p2.id}`,
    };
    if (target.kind === "circle" || target.kind === "arc") return {
      icon: toolbarSvgMarkup(target.kind === "circle" ? "#toolCircle" : "#toolArc"),
      type: target.kind === "circle" ? applicationText("円", "Circle") : applicationText("円弧", "Arc"),
      id: item.id,
      secondary: `${applicationText("中心", "Center")} ${item.center.id} / R ${formatDisplayNumber(item.radius())}`,
    };
    if (target.kind === "spline") return {
      icon: toolbarSvgMarkup("#toolSpline"),
      type: applicationText("スプライン", "Spline"),
      id: item.id,
      secondary: `${item.fitPoints.length} ${applicationText("通過点", "fit points")}`,
    };
    if (target.kind === "dimension") return {
      icon: constraintToolbarIcon(item),
      type: applicationText("寸法", "Dimension"),
      id: item.parameterName || "—",
      secondary: localizedConstraintName(item.name),
    };
    if (target.kind === "annotation") return {
      icon: toolbarSvgMarkup(item.type === "leader" ? "#annotationLeaderBtn" : "#annotationTextBtn"),
      type: item.type === "leader" ? applicationText("引出線", "Leader") : applicationText("自由テキスト", "Free Text"),
      id: item.id,
      secondary: String(item.text || "").slice(0, 40),
    };
    if (target.kind === "block") return {
      icon: toolbarSvgMarkup("#toolCreateBlock"),
      type: applicationText("ブロック", "Block"),
      id: item.id,
      secondary: blockDefinitionById(item.definitionId)?.name || item.definitionId,
    };
    if (target.kind === "geometry-instance") return {
      icon: toolbarSvgMarkup(target.item.type === "free" ? "#toolFreeInstance" : target.item.type === "mirror" ? "#toolMirror" : target.item.type === "pattern" ? "#toolPattern" : "#toolSketchProjection"),
      type: applicationText("派生インスタンス", "Derived Instance"),
      id: item.id,
      secondary: geometryInstanceTypeLabel(item.type),
    };
    return {
      icon: toolbarSvgMarkup("#toolHatch"),
      type: applicationText("ハッチング", "Hatch"),
      id: item.id,
      secondary: hatchPatternTypeLabel(hatchAppearanceForDisplay(item).patternType),
    };
  }

  function captureCanvasHoverState() {
    return {
      point: hoveredPoint,
      endpointPoint: hoveredEndpointPoint,
      line: hoveredLine,
      circle: hoveredCircle,
      arc: hoveredArc,
      spline: hoveredSpline,
      block: hoveredBlockInstance,
      geometryInstance: hoveredGeometryInstance,
      arcEndpoint: hoveredArcEndpoint,
      dimension: hoveredDimensionConstraint,
      sketchIdentity: hoveredSketchIdentity,
      annotation: hoveredAnnotation,
      hatch: hoveredHatch,
    };
  }

  function restoreCanvasHoverState(state) {
    if (!state) return;
    hoveredPoint = state.point;
    hoveredEndpointPoint = state.endpointPoint;
    hoveredLine = state.line;
    hoveredCircle = state.circle;
    hoveredArc = state.arc;
    hoveredSpline = state.spline;
    hoveredBlockInstance = state.block;
    hoveredGeometryInstance = state.geometryInstance;
    hoveredArcEndpoint = state.arcEndpoint;
    hoveredDimensionConstraint = state.dimension;
    hoveredSketchIdentity = state.sketchIdentity;
    hoveredAnnotation = state.annotation;
    hoveredHatch = state.hatch;
  }

  function previewCanvasContextCandidate(target = null) {
    if (!canvasContextBaseHoverState) return;
    if (!target) {
      restoreCanvasHoverState(canvasContextBaseHoverState);
      draw();
      return;
    }
    clearCanvasHover();
    if (target.kind === "point") {
      hoveredPoint = target.item;
      hoveredEndpointPoint = isEndpointPoint(target.item) ? target.item : null;
    } else if (target.kind === "line") hoveredLine = target.item;
    else if (target.kind === "circle") hoveredCircle = target.item;
    else if (target.kind === "arc") hoveredArc = target.item;
    else if (target.kind === "spline") hoveredSpline = target.item;
    else if (target.kind === "arc-endpoint") hoveredArcEndpoint = { arc: target.item, endpoint: target.endpoint };
    else if (target.kind === "dimension") hoveredDimensionConstraint = target.item;
    else if (target.kind === "block") hoveredBlockInstance = target.item;
    else if (target.kind === "geometry-instance") hoveredGeometryInstance = target.item;
    else if (target.kind === "annotation") hoveredAnnotation = target.item;
    else if (target.kind === "hatch") hoveredHatch = target.item;
    draw();
  }

  function canvasContextTargetIsSelected(target) {
    if (!target?.item) return false;
    if (target.kind === "point") return canvasSelection.points.includes(target.item);
    if (target.kind === "line") return canvasSelection.lines.includes(target.item);
    if (target.kind === "circle") return canvasSelection.circles.includes(target.item);
    if (target.kind === "arc") return canvasSelection.arcs.includes(target.item);
    if (target.kind === "spline") return canvasSelection.splines.includes(target.item);
    if (target.kind === "arc-endpoint") return sameArcEndpoint(canvasSelection.arcEndpoint, { arc: target.item, endpoint: target.endpoint });
    if (target.kind === "block") return canvasSelection.blockInstances.includes(target.item);
    if (target.kind === "geometry-instance") return canvasSelection.geometryInstances.includes(target.item);
    if (target.kind === "annotation") return canvasSelection.annotations.includes(target.item);
    if (target.kind === "hatch") return canvasSelection.hatches.includes(target.item);
    if (target.kind === "dimension") return canvasSelection.dimensionConstraint === target.item || effectiveSelectedConstraint() === target.item;
    return false;
  }

  function selectCanvasContextTarget(target, { preserveSelectedSet = true } = {}) {
    if (!target?.item || target.kind === "blank" || (preserveSelectedSet && canvasContextTargetIsSelected(target))) return;
    clearSelection();
    if (target.kind === "point") canvasSelection.set("points", [target.item]);
    else if (target.kind === "line") canvasSelection.set("lines", [target.item]);
    else if (target.kind === "circle") canvasSelection.set("circles", [target.item]);
    else if (target.kind === "arc") canvasSelection.set("arcs", [target.item]);
    else if (target.kind === "spline") canvasSelection.set("splines", [target.item]);
    else if (target.kind === "arc-endpoint") {
      canvasSelection.set("arcs", [target.item]);
      canvasSelection.set("arcEndpoint", { arc: target.item, endpoint: target.endpoint });
    } else if (target.kind === "block") canvasSelection.set("blockInstances", [target.item]);
    else if (target.kind === "geometry-instance") canvasSelection.set("geometryInstances", [target.item]);
    else if (target.kind === "annotation") canvasSelection.set("annotations", [target.item]);
    else if (target.kind === "hatch") canvasSelection.set("hatches", [target.item]);
    else if (target.kind === "dimension") canvasSelection.set("dimensionConstraint", target.item);
  }

  function constraintHitsFromCanvasContextTarget(target) {
    return {
      hitP: target?.kind === "point" ? target.item : null,
      hitL: target?.kind === "line" ? target.item : null,
      hitC: target?.kind === "circle" ? target.item : null,
      hitA: target?.kind === "arc" ? target.item : null,
      hitS: target?.kind === "spline" ? target.item : null,
      hitArcEnd: target?.kind === "arc-endpoint"
        ? target.hit || { arc: target.item, endpoint: target.endpoint, point: arcEndpointPoint(target.item, target.endpoint) }
        : null,
    };
  }

  function hasCancellableCanvasCommand() {
    return mode === "block-place" || Boolean(pendingCommand) || Boolean(pendingConstraintCommand) || hasActiveDrawOperation() || isDrawToolMode();
  }

  function cancelCanvasCommandFromContextMenu() {
    let canceled = false;
    if (mode === "block-place") {
      blockPlacementCommand.reset({ preservePanelState: true });
      pointerPreview = null;
      mode = "select";
      restoreBlockPlacementPropertiesPanel();
      setHint(applicationText("ブロック配置をキャンセルしました", "Block placement canceled."));
      canceled = true;
    }
    if (pendingCommand) {
      cancelPendingCommand("");
      canceled = true;
    }
    if (pendingConstraintCommand) {
      cancelConstraintTargetCommand("");
      canceled = true;
    }
    if (hasActiveDrawOperation()) {
      cancelActiveDrawOperation();
      canceled = true;
    }
    if (isDrawToolMode()) {
      exitDrawMode();
      canceled = true;
    }
    if (canceled) {
      setHint(applicationText("コマンドをキャンセルしました", "Command canceled."));
      updateUI();
      draw();
    }
    return canceled;
  }

  function hasCopyableCanvasSelection() {
    const hasSelectionItems = canvasSelection.points.some((item) => model.points.includes(item)) ||
      canvasSelection.lines.some((item) => model.lines.includes(item)) ||
      canvasSelection.circles.some((item) => model.circles.includes(item)) ||
      canvasSelection.arcs.some((item) => model.arcs.includes(item)) ||
      canvasSelection.splines.some((item) => model.splines.includes(item)) ||
      canvasSelection.blockInstances.some((item) => model.blockInstances.includes(item)) ||
      canvasSelection.annotations.some((item) => model.annotations.includes(item)) ||
      canvasSelection.hatches.some((item) => model.hatches.includes(item));
    if (!hasSelectionItems) return false;
    const selectedNodes = new Set([...canvasSelection.points, ...canvasSelection.lines, ...canvasSelection.circles, ...canvasSelection.arcs, ...canvasSelection.splines, ...canvasSelection.blockInstances]);
    for (const line of canvasSelection.lines) selectedNodes.add(line.p1).add(line.p2);
    for (const primitive of [...canvasSelection.circles, ...canvasSelection.arcs]) selectedNodes.add(primitive.center);
    for (const spline of canvasSelection.splines) for (const point of spline.fitPoints) selectedNodes.add(point);
    const selectedProjectionIds = new Set();
    for (const instance of canvasSelection.blockInstances) {
      const bundle = blockProjectionBundle(instance);
      for (const item of [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])]) selectedProjectionIds.add(item.id);
    }
    const selectedGeometryRefs = new Set([
      ...canvasSelection.lines.map((item) => `line:${item.id}`),
      ...canvasSelection.circles.map((item) => `circle:${item.id}`),
      ...canvasSelection.arcs.map((item) => `arc:${item.id}`),
      ...canvasSelection.splines.map((item) => `spline:${item.id}`),
    ]);
    if (!canvasSelection.hatches.every((hatch) => hatchBoundaryGeometryRefs(hatch.boundaryLoops).every((ref) => selectedGeometryRefs.has(`${ref.kind}:${geometryRefId(ref)}`)))) return false;
    return canvasSelection.annotations.every((annotation) => {
      if (annotation.type !== "leader") return true;
      const referenced = resolveGeometryRef(annotation.geometryRef);
      return Boolean(referenced && (selectedNodes.has(referenced) || selectedProjectionIds.has(referenced.id)));
    });
  }

  function selectedDrawingOrderCandidates() {
    return [
      ...canvasSelection.lines, ...canvasSelection.circles, ...canvasSelection.arcs, ...canvasSelection.splines,
      ...canvasSelection.hatches, ...canvasSelection.blockInstances, ...canvasSelection.geometryInstances,
    ];
  }

  function topmostDrawingOrderOwner(items) {
    return window.DrawingOrder.topmostOwner(model, activeSketchId(), items);
  }

  function drawingOrderCommandState() {
    return window.DrawingOrder.commandState(model, activeSketchId(), selectedDrawingOrderCandidates());
  }

  function reorderSelectedDrawingObjects(action) {
    if (!window.DrawingOrder.reorder(model, activeSketchId(), selectedDrawingOrderCandidates(), action)) return false;
    updateUI({ refreshAnalysis: false });
    draw();
    recordHistory(applicationText("重なり順変更", "Drawing order changed"));
    setHint(applicationText("同じSketch内の重なり順を変更しました", "Changed drawing order within the active sketch."));
    return true;
  }

  function canvasContextFixState(target) {
    const batch = selectedFixedBatchTargets();
    if (batch && ((target.kind === "point" && batch.points.includes(target.item)) || (target.kind === "line" && batch.lines.includes(target.item)))) {
      return { enabled: true, fixed: fixedBatchIsFullyFixed(batch) };
    }
    if (target.kind === "point") {
      const enabled = canvasSelection.points.length > 0 && canvasSelection.lines.length + canvasSelection.circles.length + canvasSelection.arcs.length + canvasSelection.splines.length + canvasSelection.blockInstances.length === 0 && canvasSelection.annotations.length + canvasSelection.hatches.length === 0 && !canvasSelection.arcEndpoint;
      return { enabled, fixed: enabled && canvasSelection.points.every((point) => point.fixed) };
    }
    if (target.kind === "line") {
      const enabled = canvasSelection.lines.length === 1 && canvasSelection.points.length + canvasSelection.circles.length + canvasSelection.arcs.length + canvasSelection.splines.length + canvasSelection.blockInstances.length === 0 && canvasSelection.annotations.length + canvasSelection.hatches.length === 0 && !canvasSelection.arcEndpoint;
      return { enabled, fixed: Boolean(findLineFixedConstraint(target.item)) };
    }
    if (target.kind === "arc-endpoint") {
      return { enabled: true, fixed: Boolean(findArcEndpointFixedConstraint(target.item, target.endpoint)) };
    }
    if (target.kind === "block") {
      return { enabled: canvasSelection.blockInstances.length === 1 && selectedGeometryItems().length === 0, fixed: Boolean(target.item.fixed) };
    }
    return null;
  }

  function canvasContextMenuItems(target, commandActive = false) {
    const groups = [];
    if (commandActive) {
      if (mode === "sketch-projection") {
        groups.push([{ action: "sketch-projection-commit", label: applicationText("実行", "Execute"), shortcut: "Enter", disabled: sketchProjectionSources.length === 0 }]);
      }
      groups.push([{ action: "cancel-command", label: applicationText("コマンドをキャンセル", "Cancel Command"), shortcut: "Esc" }]);
      groups.push([
        { action: "undo", label: applicationText("元に戻す", "Undo"), shortcut: "Ctrl+Z", disabled: Boolean(document.getElementById("undoBtn")?.disabled) },
        { action: "redo", label: applicationText("やり直す", "Redo"), shortcut: "Ctrl+Y", disabled: Boolean(document.getElementById("redoBtn")?.disabled) },
      ]);
    } else if (target.kind === "blank") {
      groups.push([{ action: "paste", label: applicationText("貼り付け", "Paste"), shortcut: "Ctrl+V", disabled: !geometryClipboard || !canCreateInActiveSketch() }]);
      groups.push([
        { action: "undo", label: applicationText("元に戻す", "Undo"), shortcut: "Ctrl+Z", disabled: Boolean(document.getElementById("undoBtn")?.disabled) },
        { action: "redo", label: applicationText("やり直す", "Redo"), shortcut: "Ctrl+Y", disabled: Boolean(document.getElementById("redoBtn")?.disabled) },
      ]);
      groups.push([{ action: "fit-visible", label: applicationText("表示中図形へフィット", "Fit Visible Geometry"), disabled: !visibleGeometryBounds() }]);
    } else {
      const specific = [];
      const editingFitPoint = target.kind === "point" && Boolean(splineEditSession?.spline?.fitPoints.includes(target.item));
      if (target.kind === "spline" && splineEditSession?.spline === target.item) {
        specific.push({ action: "spline-fit-point-add", label: applicationText("通過点を追加", "Add Fit Point") });
      }
      if (editingFitPoint) {
        specific.push({ action: "spline-fit-point-delete", label: applicationText("通過点を削除", "Delete Fit Point"), disabled: splineEditSession.spline.fitPoints.length <= 3, danger: true });
      }
      if (target.kind === "dimension") {
        specific.push({ action: "dimension-edit", label: applicationText("値 / 数式を編集", "Edit Value / Expression"), disabled: isReadOnlyDimension(target.item) });
      }
      if (target.kind === "block") {
        specific.push({ action: "block-edit", label: applicationText("ブロック定義を編集", "Edit Block Definition"), disabled: Boolean(blockDefinitionScopeError(target.item.definitionId) || blockDefinitionEditError(target.item.definitionId)) });
        specific.push({ action: "block-rotation-toggle", label: target.item.rotationLocked ? applicationText("自由回転", "Free Rotation") : applicationText("直交回転ロック", "Lock Orthogonal Rotation"), disabled: Boolean(target.item.fixed) });
      }
      if (target.kind === "hatch") specific.push({ action: "hatch-repair", label: applicationText("境界を再指定", "Reselect Boundary") });
      const fix = editingFitPoint ? null : canvasContextFixState(target);
      if (fix) specific.push({ action: "fix-toggle", label: fix.fixed ? applicationText("固定解除", "Unfix") : applicationText("固定", "Fix"), disabled: !fix.enabled });
      if (["line", "circle", "arc", "spline"].includes(target.kind)) {
        const primitives = selectedConstructionTogglePrimitives();
        const construction = primitives.length > 0 && primitives.every((item) => item.construction);
        specific.push({ action: "construction-toggle", label: construction ? applicationText("実線に変更", "Convert to Normal") : applicationText("補助線に変更", "Convert to Construction"), disabled: primitives.length === 0 });
        if (target.kind !== "spline") specific.push({ action: "offset", label: applicationText("ここからオフセット", "Offset from Here"), disabled: primitives.length !== 1 });
        if (target.kind === "line") specific.push({ action: "fillet", label: applicationText("R面取り", "Fillet"), disabled: canvasSelection.lines.length !== 2 || canvasSelection.points.length + canvasSelection.circles.length + canvasSelection.arcs.length + canvasSelection.splines.length + canvasSelection.blockInstances.length > 0 });
      }
      if (!editingFitPoint && ["point", "line", "circle", "arc", "spline"].includes(target.kind)) {
        specific.push({ action: "add-leader", label: applicationText("引出線を追加", "Add Leader"), disabled: selectedGeometryItems().length !== 1 || canvasSelection.blockInstances.length + canvasSelection.annotations.length > 0 });
      }
      if (["line", "circle", "arc", "spline", "hatch", "block", "annotation"].includes(target.kind)) {
        const canCreateBlock = canvasSelection.lines.length + canvasSelection.circles.length + canvasSelection.arcs.length + canvasSelection.splines.length + canvasSelection.hatches.length + canvasSelection.blockInstances.length + canvasSelection.annotations.length > 0;
        specific.push({ action: "create-block", label: applicationText("選択からブロック作成", "Create Block from Selection"), disabled: !canCreateBlock || !canCreateInActiveSketch() });
      }
      if (specific.length > 0) groups.push(specific);
      if (["line", "circle", "arc", "spline", "hatch", "block", "geometry-instance"].includes(target.kind)) {
        const orderState = drawingOrderCommandState();
        groups.push([
          { action: "drawing-front", label: applicationText("最前面へ", "Bring to Front"), disabled: !orderState.canForward },
          { action: "drawing-forward", label: applicationText("1つ前面へ", "Bring Forward"), disabled: !orderState.canForward },
          { action: "drawing-backward", label: applicationText("1つ背面へ", "Send Backward"), disabled: !orderState.canBackward },
          { action: "drawing-back", label: applicationText("最背面へ", "Send to Back"), disabled: !orderState.canBackward },
        ]);
      }
      if (!editingFitPoint) {
        const copyable = hasCopyableCanvasSelection();
        groups.push([
          { action: "cut", label: applicationText("切り取り", "Cut"), shortcut: "Ctrl+X", disabled: !copyable },
          { action: "copy", label: applicationText("コピー", "Copy"), shortcut: "Ctrl+C", disabled: !copyable },
          { action: "delete", label: applicationText("削除", "Delete"), shortcut: "Del", disabled: !hasSelection(), danger: true },
        ]);
      }
      groups.push([{ action: "show-properties", label: applicationText("プロパティを表示", "Show Properties") }]);
    }
    return groups.flatMap((group, groupIndex) => [
      ...(groupIndex > 0 ? [{ separator: true }] : []),
      ...group,
    ]);
  }

  function closeCanvasContextMenu({ restoreHover = true } = {}) {
    if (!canvasContextMenu || canvasContextMenu.hidden) return false;
    canvasContextMenu.hidden = true;
    canvasContextMenu.innerHTML = "";
    canvasContextMenu.classList.remove("candidate-menu");
    if (canvasContextBaseHoverState) {
      if (restoreHover) restoreCanvasHoverState(canvasContextBaseHoverState);
      else clearCanvasHover();
      draw();
    }
    canvasContextTarget = null;
    canvasContextPointer = null;
    canvasContextCandidates = [];
    canvasContextBaseHoverState = null;
    return true;
  }

  function renderCanvasContextMenu(items) {
    if (!canvasContextMenu) return;
    canvasContextMenu.classList.remove("candidate-menu");
    canvasContextMenu.innerHTML = items.map((item) => item.separator
      ? '<div class="canvas-context-menu-separator" role="separator"></div>'
      : `<button type="button" role="menuitem" data-context-action="${item.action}" class="${item.danger ? "danger" : ""}" ${item.disabled ? "disabled" : ""}><span>${escapeHtml(item.label)}</span>${item.shortcut ? `<kbd>${escapeHtml(item.shortcut)}</kbd>` : ""}</button>`).join("");
  }

  function renderCanvasContextCandidates(candidates) {
    if (!canvasContextMenu) return;
    canvasContextMenu.classList.add("candidate-menu");
    const heading = applicationText("選択候補", "Selection Candidates");
    canvasContextMenu.innerHTML = `<div class="canvas-context-candidate-heading" role="presentation">${escapeHtml(heading)}<span>${candidates.length}</span></div>${candidates.map((target, index) => {
      const presentation = canvasContextCandidatePresentation(target);
      const title = `${presentation.type} ${presentation.id}${presentation.secondary ? ` — ${presentation.secondary}` : ""}`;
      return `<button type="button" role="menuitem" class="canvas-context-candidate" data-context-candidate-index="${index}" title="${escapeHtml(title)}">${presentation.icon}<span class="canvas-context-candidate-content"><span class="canvas-context-candidate-primary"><span>${escapeHtml(presentation.type)}</span><strong>${escapeHtml(presentation.id)}</strong></span><span class="canvas-context-candidate-secondary">${escapeHtml(presentation.secondary)}</span></span></button>`;
    }).join("")}`;
  }

  function openCanvasContextMenu(event) {
    if (!canvasContextMenu || !isGeometryMode()) return;
    event.preventDefault();
    closeAppMenus();
    const pointer = canvasPoint(event);
    lastPointerWorld = pointer;
    const commandActive = hasCancellableCanvasCommand();
    const constraintCommandActive = Boolean(pendingConstraintCommand);
    const candidates = commandActive && !constraintCommandActive ? [] : canvasContextCandidatesAt(pointer);
    const multipleCandidates = candidates.length > 1;
    const showCandidates = constraintCommandActive ? candidates.length > 0 : multipleCandidates;
    const target = commandActive || multipleCandidates ? { kind: "blank", item: null } : candidates[0] || { kind: "blank", item: null };
    if (!commandActive && !multipleCandidates && target.kind !== "blank") {
      selectCanvasContextTarget(target);
      updateUI({ refreshAnalysis: false });
      draw();
    }
    canvasContextTarget = target;
    canvasContextPointer = pointer;
    canvasContextCandidates = showCandidates ? candidates : [];
    canvasContextBaseHoverState = showCandidates ? captureCanvasHoverState() : null;
    if (showCandidates) renderCanvasContextCandidates(candidates);
    else renderCanvasContextMenu(canvasContextMenuItems(target, commandActive));
    canvasContextMenu.setAttribute("aria-label", applicationText("キャンバスコンテキストメニュー", "Canvas context menu"));
    canvasContextMenu.hidden = false;
    canvasContextMenu.style.left = "0px";
    canvasContextMenu.style.top = "0px";
    const area = canvas.closest(".canvas-area")?.getBoundingClientRect();
    const bounds = canvasContextMenu.getBoundingClientRect();
    if (area) {
      const left = Math.max(4, Math.min(event.clientX - area.left, area.width - bounds.width - 4));
      const top = Math.max(4, Math.min(event.clientY - area.top, area.height - bounds.height - 4));
      canvasContextMenu.style.left = `${left}px`;
      canvasContextMenu.style.top = `${top}px`;
    }
    canvasContextMenu.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
  }

  function selectCanvasContextCandidate(index) {
    const target = canvasContextCandidates[index];
    if (!target) return;
    const pointer = canvasContextPointer;
    const commandType = pendingConstraintCommand?.type;
    closeCanvasContextMenu({ restoreHover: false });
    if (commandType) {
      handleConstraintOperandClick(pointer || { x: 0, y: 0 }, commandType, constraintHitsFromCanvasContextTarget(target));
      return;
    }
    selectCanvasContextTarget(target, { preserveSelectedSet: false });
    updateUI({ refreshAnalysis: false });
    draw();
  }

  function focusedCanvasContextCandidate() {
    const button = document.activeElement?.closest?.("[data-context-candidate-index]");
    if (!button || !canvasContextMenu?.contains(button)) return null;
    return canvasContextCandidates[Number(button.dataset.contextCandidateIndex)] || null;
  }

  function restoreFocusedCanvasContextCandidatePreview() {
    previewCanvasContextCandidate(focusedCanvasContextCandidate());
  }

  function showSelectedObjectProperties() {
    setPropertiesPanelCollapsed(false);
    updatePropertiesUI();
    const panel = document.getElementById("propertiesPanel");
    if (panel) panel.scrollTop = 0;
    setHint(applicationText("選択したオブジェクトのプロパティを表示します。", "Select an object to display its properties."));
  }

  function executeCanvasContextAction(action) {
    const target = canvasContextTarget;
    const pointer = canvasContextPointer;
    closeCanvasContextMenu();
    if (action === "sketch-projection-commit") commitSketchProjectionCommand();
    else if (action === "cancel-command") cancelCanvasCommandFromContextMenu();
    else if (action === "undo") undoHistory();
    else if (action === "redo") redoHistory();
    else if (action === "cut") copySelectionToClipboard({ cut: true });
    else if (action === "copy") copySelectionToClipboard();
    else if (action === "paste") pasteGeometryClipboard();
    else if (action === "delete") document.getElementById("deleteSelectionBtn")?.click();
    else if (action === "show-properties") showSelectedObjectProperties();
    else if (action === "construction-toggle") document.getElementById("toolConstructionLine")?.click();
    else if (action === "fix-toggle") fixPointBtn?.click();
    else if (action === "offset") document.getElementById("toolOffset")?.click();
    else if (action === "fillet") document.getElementById("toolFillet")?.click();
    else if (action === "add-leader") document.getElementById("annotationLeaderBtn")?.click();
    else if (action === "create-block") document.getElementById("toolCreateBlock")?.click();
    else if (action === "block-edit" && target?.item) enterBlockDefinitionEdit(target.item.definitionId);
    else if (action === "block-rotation-toggle" && target?.item) setBlockInstanceRotationLocked(target.item, !target.item.rotationLocked);
    else if (action === "dimension-edit" && target?.hit) startDimensionEditInput(target.hit);
    else if (action === "hatch-repair" && target?.item) startHatchBoundaryRepair(target.item);
    else if (["drawing-front", "drawing-forward", "drawing-backward", "drawing-back"].includes(action)) reorderSelectedDrawingObjects(action);
    else if (action === "spline-fit-point-add" && target?.item && pointer) addSplineFitPointFromContext(target.item, pointer);
    else if (action === "spline-fit-point-delete" && target?.item && splineEditSession?.spline) deleteSplineFitPointFromContext(splineEditSession.spline, target.item);
    else if (action === "fit-visible") {
      if (fitVisibleGeometryToViewport()) setHint(applicationText("表示中の図形全体が見えるように調整しました", "Fitted all visible geometry."));
      else setHint(applicationText("表示中の図形がありません", "There is no visible geometry."), "error");
      draw();
    }
  }

  canvasContextMenu?.addEventListener("click", (event) => {
    const candidateButton = event.target.closest("[data-context-candidate-index]");
    if (candidateButton) {
      selectCanvasContextCandidate(Number(candidateButton.dataset.contextCandidateIndex));
      return;
    }
    const button = event.target.closest("[data-context-action]");
    if (!button || button.disabled) return;
    executeCanvasContextAction(button.dataset.contextAction);
  });
  canvasContextMenu?.addEventListener("pointerover", (event) => {
    const button = event.target.closest("[data-context-candidate-index]");
    if (!button || button.contains(event.relatedTarget)) return;
    button.focus({ preventScroll: true });
    previewCanvasContextCandidate(canvasContextCandidates[Number(button.dataset.contextCandidateIndex)] || null);
  });
  canvasContextMenu?.addEventListener("pointerout", (event) => {
    const button = event.target.closest("[data-context-candidate-index]");
    if (!button || button.contains(event.relatedTarget)) return;
    restoreFocusedCanvasContextCandidatePreview();
  });
  canvasContextMenu?.addEventListener("focusin", (event) => {
    const button = event.target.closest("[data-context-candidate-index]");
    if (button) previewCanvasContextCandidate(canvasContextCandidates[Number(button.dataset.contextCandidateIndex)] || null);
  });
  canvasContextMenu?.addEventListener("focusout", (event) => {
    if (event.relatedTarget && canvasContextMenu.contains(event.relatedTarget)) return;
    previewCanvasContextCandidate();
  });
  canvasContextMenu?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeCanvasContextMenu();
      return;
    }
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      const candidateButton = document.activeElement?.closest?.("[data-context-candidate-index]");
      if (candidateButton && canvasContextMenu.contains(candidateButton)) {
        event.preventDefault();
        event.stopPropagation();
        selectCanvasContextCandidate(Number(candidateButton.dataset.contextCandidateIndex));
      }
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...canvasContextMenu.querySelectorAll("button:not(:disabled)")];
    if (buttons.length === 0) return;
    const current = buttons.indexOf(document.activeElement);
    let next = current;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    else if (event.key === "ArrowDown") next = (current + 1 + buttons.length) % buttons.length;
    else next = (current - 1 + buttons.length) % buttons.length;
    buttons[next].focus({ preventScroll: true });
  });
  canvas.addEventListener("contextmenu", openCanvasContextMenu);
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest("#canvasContextMenu")) closeCanvasContextMenu();
  });
  window.addEventListener("blur", closeCanvasContextMenu);

  canvas.addEventListener("pointerdown", (e) => {
    flushScheduledCanvasPointerMove();
    if (e.button === 2) {
      e.preventDefault();
      return;
    }
    closeCanvasContextMenu();
    if (e.button === 1) {
      canvasNavigation.beginPan(e);
      return;
    }

    const p = canvasPoint(e);
    lastPointerWorld = p;
    const hitP = hitPoint(p.x, p.y);
    const hitL = hitLine(p.x, p.y);
    const hitC = hitCircle(p.x, p.y);
    const hitArcEnd = hitArcEndpoint(p.x, p.y);
    const hitA = hitArc(p.x, p.y);
    const hitS = hitSpline(p.x, p.y);
    const hatchHit = hitHatchAt(p.x, p.y);
    const referenceImageHit = hitReferenceImageAt(p.x, p.y);
    const hitD = hitDimension(p.x, p.y);
    const hitBlockHandle = hitBlockRotationHandle(p.x, p.y);
    const hitBlock = hitBlockHandle || hitBlockInstance(p.x, p.y);
    const hitDerivedGeometry = hitDerivedGeometryForDrag(p.x, p.y);
    const hitDerivedInstance = hitDerivedGeometry?.instance || hitGeometryInstance(p.x, p.y);
    const directGeometryHit = Boolean(
      (hitP && !hitP.blockProjection) ||
      (hitArcEnd && !hitArcEnd.arc.blockProjection) ||
      (hitL && !hitL.blockProjection) ||
      (hitC && !hitC.blockProjection) ||
      (hitA && !hitA.blockProjection)
      || (hitS && !hitS.blockProjection) ||
      hitDerivedGeometry
    );
    hoveredSketchIdentity = hitSketchIdentityElement(p.x, p.y, { allowInactiveGeometry: true });
    const inactiveHit = null;
    const blankAnnotationHit = hitAnnotationElement(p.x, p.y);
    const annotationTargetHit = hitAnnotationTarget(p.x, p.y);

    if (hitD && insertClickedDimensionParameter(e, hitD)) return;

    if (mode === "hatch" || mode === "hatch-repair") {
      e.preventDefault();
      commitHatchAt(p);
      return;
    }

    if (referenceImageCalibrationSession) {
      e.preventDefault();
      handleReferenceImageCalibrationClick(p);
      return;
    }

    if (mode === "instance-sources") {
      e.preventDefault();
      const operand = instanceSourceCommand.instance.type === "sketchProjection"
        ? hitReferenceTarget(p.x, p.y)
        : hitDerivedProjectionOperand(p.x, p.y) || hitBlockProjectionOperand(p.x, p.y);
      toggleInstanceSource(operand ? operandElement(operand) : hitP || hitL || hitC || hitA || hitS);
      return;
    }
    if (mode === "sketch-projection") {
      e.preventDefault();
      const target = hitReferenceTarget(p.x, p.y);
      if (target) {
        toggleSketchProjectionSource(target);
        return;
      }
      clearSnap();
      selectionRectSession = {
        kind: "sketch-projection",
        pointerId: e.pointerId,
        start: p,
        current: p,
      };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (mode.startsWith("free-instance-")) {
      placeFreeInstance(snapForDrawing(p));
      return;
    }
    if (mode === "mirror-axis" || mode === "pattern-direction") {
      e.preventDefault();
      const operand = hitDerivedProjectionOperand(p.x, p.y) || hitBlockProjectionOperand(p.x, p.y) || (hitL ? makeConstraintOperand("line", { line: hitL }) : null);
      if (operand?.kind === "line") commitGeometryInstanceReference(operand.line);
      else setHint(applicationText("基準にする線をクリックしてください", "Click a reference line."), "error");
      return;
    }

    const blankDoubleClickHits = { hitP, hitL, hitC, hitArcEnd, hitA, hitS, hitD, hitBlock, hitDerivedInstance, hatchHit, referenceImageHit, inactiveHit, annotationHit: blankAnnotationHit };
    if (isRepeatedBlankDoubleClick(e, blankDoubleClickHits) && handleBlankCanvasDoubleClick(p, blankDoubleClickHits)) {
      suppressNextBlankDoubleClickEvent = true;
      e.preventDefault();
      return;
    }

    if (pendingCommand?.type === "annotation-text-place") {
      e.preventDefault();
      commitTextAnnotationAt(p);
      return;
    }

    if (pendingCommand?.type === "annotation-leader-select") {
      e.preventDefault();
      handleLeaderAnnotationTargetClick(annotationTargetHit, p);
      return;
    }

    if (pendingCommand?.type === "annotation-leader-place") {
      e.preventDefault();
      commitLeaderAnnotationAt(p);
      return;
    }

    if (pendingCommand?.type === "fillet-radius-place") {
      e.preventDefault();
      submitFilletRadiusPlacement(p);
      return;
    }

    if (blankAnnotationHit && !directGeometryHit && !hitD && mode === "select" && !pendingCommand && !pendingConstraintCommand) {
      e.preventDefault();
      if (blankAnnotationHit.element.blockProjection) {
        if (!e.ctrlKey && !e.shiftKey) clearSelection();
        if (e.ctrlKey || e.shiftKey) toggleBlockInstanceSelection(blankAnnotationHit.element.blockInstance);
        else canvasSelection.set("blockInstances", [blankAnnotationHit.element.blockInstance]);
        updateUI({ refreshAnalysis: false });
        draw();
        return;
      }
      if (e.ctrlKey || e.shiftKey) {
        canvasSelection.toggleById("annotations", blankAnnotationHit.element);
        updateUI({ refreshAnalysis: false });
        draw();
        return;
      }
      clearSelection();
      beginAnnotationDrag(e, blankAnnotationHit, p);
      updateUI({ refreshAnalysis: false });
      draw();
      return;
    }

    if (hitD && !directGeometryHit && !e.shiftKey && !e.ctrlKey && ((!pendingCommand && !pendingConstraintCommand) || isDimensionConstraintCommandActive())) {
      e.preventDefault();
      if (!isDimensionConstraintCommandActive()) {
        canvasSelection.set("points", []);
        canvasSelection.set("lines", []);
        canvasSelection.set("circles", []);
        canvasSelection.set("arcs", []);
        canvasSelection.set("splines", []);
        canvasSelection.set("arcEndpoint", null);
      }
      beginDimensionDrag(e, hitD, p, { hitP, hitL, hitC, hitA, hitArcEnd });
      return;
    }

    if (pendingCommand?.type === "distance-place") {
      e.preventDefault();
      if (retargetDistancePlaceWithOperand(p, { hitP, hitL, hitC, hitA, hitArcEnd })) return;
      startDistanceValueInput(p);
      return;
    }

    if (pendingCommand?.type === "distance-value" || pendingCommand?.type === "offset-value") {
      e.preventDefault();
      return;
    }

    if (
      pendingConstraintCommand &&
      (canvasSelection.dimensionConstraint || effectiveSelectedConstraint()) &&
      !hitP &&
      !hitL &&
      !hitC &&
      !hitArcEnd &&
      !hitA &&
      !hitS &&
      !hitD &&
      !inactiveHit
    ) {
      e.preventDefault();
      canvasSelection.set("dimensionConstraint", null);
      canvasSelection.set("constraint", null);
      hoveredDimensionConstraint = null;
      setHint(constraintTargetHint(pendingConstraintCommand.type));
      updateGeometrySelectionUI();
      draw();
      return;
    }

    if (pendingConstraintCommand) {
      e.preventDefault();
      handleConstraintOperandClick(p, pendingConstraintCommand.type, { hitP, hitL, hitC, hitA, hitS, hitArcEnd });
      return;
    }

    if (mode === "block-place") {
      e.preventDefault();
      handleBlockPlacementClick(p);
      return;
    }

    if (["point", "line", "centerline", "circle-center-cross", "rectangle", "slot", "circle", "arc", "three-point-arc", "spline", "fillet", "trim", "offset", "block-place", "hatch", "hatch-repair"].includes(mode) && rejectRootSketchCreation()) {
      e.preventDefault();
      return;
    }

    if (mode === "point") {
      clearTransientPointRollback();
      beginTransientPointRollback();
      const sp = snapForDrawing(p);
      const snap = drawingSnap.active;
      const np = addPoint(sp.x, sp.y, false);
      transientAuthoring.markCreatedPoint(np);
      addPointSnapConstraints(np, snap);
      clearSnap();
      canvasSelection.set("points", [np]);
      canvasSelection.set("lines", []);
      canvasSelection.set("circles", []);
      canvasSelection.set("arcs", []);
      canvasSelection.set("splines", []);
      solveAndRefresh("点追加");
      return;
    }

    if (mode === "line") {
      handleLineClick(p, e.shiftKey);
      return;
    }

    if (mode === "centerline") {
      handleCenterlineClick(p, hitP, hitL);
      return;
    }

    if (mode === "circle-center-cross") {
      handleCircleCenterCrossClick(hitC);
      return;
    }

    if (mode === "rectangle") {
      handleRectangleClick(p);
      return;
    }

    if (mode === "slot") {
      handleSlotClick(p);
      return;
    }

    if (mode === "fillet") {
      handleFilletClick(hitL, p);
      return;
    }

    if (mode === "circle") {
      handleCircleClick(p);
      return;
    }

    if (mode === "arc") {
      handleArcClick(p);
      return;
    }

    if (mode === "three-point-arc") {
      handleThreePointArcClick(p);
      return;
    }

    if (mode === "spline") {
      handleSplineClick(p);
      return;
    }

    if (mode === "sketch-projection") {
      clearSnap();
      const target = hitReferenceTarget(p.x, p.y);
      hoveredPoint = target?.kind === "point" ? target.point : null;
      hoveredEndpointPoint = null;
      hoveredLine = target?.kind === "line" ? target.line : null;
      hoveredCircle = target?.kind === "primitive" && target.primitive instanceof Circle ? target.primitive : null;
      hoveredArc = target?.kind === "primitive" && target.primitive instanceof Arc ? target.primitive : null;
      hoveredSpline = target?.kind === "spline" ? target.spline : null;
      hoveredArcEndpoint = null;
      hoveredDimensionConstraint = null;
      hoveredBlockInstance = null;
      hoveredSketchIdentity = target ? { id: operandElement(target)?.id, sketchId: target.sketchId, item: operandElement(target), kind: geometryKindForItem(operandElement(target)) } : null;
      draw();
      return;
    }

    if (mode === "trim") {
      executeTrimAt(p);
      return;
    }

    if (mode === "offset") {
      offsetCommand.click(p, { hitL, hitA, hitC });
      return;
    }

    if (inactiveHit) {
      setHint(`${inactiveHit.id} / ${sketchName(inactiveHit.sketchId)} は非アクティブスケッチの要素です`);
      draw();
      return;
    }

    const multiSelect = e.shiftKey || e.ctrlKey;
    const topDrawingOwner = topmostDrawingOrderOwner([
      hitDerivedGeometry?.instance,
      hitDerivedInstance,
      hitBlock,
      hitL,
      hitC,
      hitA,
      hitS,
      hatchHit,
    ]);
    const drawingHitIsTop = (item) => Boolean(item && drawingOrderOwner(item) === topDrawingOwner);

    if (hitDerivedGeometry && drawingHitIsTop(hitDerivedGeometry.instance)) {
      if (multiSelect) {
        canvasSelection.set("instanceGeometry", null);
        if (!canvasSelection.geometryInstances.includes(hitDerivedGeometry.instance)) canvasSelection.append("geometryInstances", hitDerivedGeometry.instance);
        else canvasSelection.set("geometryInstances", canvasSelection.geometryInstances.filter((instance) => instance !== hitDerivedGeometry.instance));
        canvasSelection.set("dimensionConstraint", null);
        canvasSelection.set("constraint", null);
        updateGeometrySelectionUI();
        draw();
      } else {
        beginDerivedGeometryDrag(e, hitDerivedGeometry, p);
      }
    } else if (hitDerivedInstance && drawingHitIsTop(hitDerivedInstance)) {
      if (!multiSelect) clearSelection();
      const index = canvasSelection.geometryInstances.indexOf(hitDerivedInstance);
      if (multiSelect && index >= 0) canvasSelection.removeAt("geometryInstances", index, 1);
      else if (!canvasSelection.geometryInstances.includes(hitDerivedInstance)) canvasSelection.append("geometryInstances", hitDerivedInstance);
      canvasSelection.set("dimensionConstraint", null);
      canvasSelection.set("constraint", null);
      setHint(applicationText(`派生インスタンス ${hitDerivedInstance.id} を選択`, `Selected derived instance ${hitDerivedInstance.id}`));
      updateGeometrySelectionUI();
      draw();
    } else if (hitBlock && !hitP && !hitArcEnd && drawingHitIsTop(hitBlock)) {
      if (multiSelect) {
        canvasSelection.set("dimensionConstraint", null);
        canvasSelection.set("constraint", null);
        toggleBlockInstanceSelection(hitBlock);
        setHint(`ブロックインスタンスを${canvasSelection.blockInstances.length}個選択`);
        updateGeometrySelectionUI();
        draw();
      } else beginBlockDrag(e, hitBlock, p, Boolean(hitBlockHandle));
    } else if (hitD && !directGeometryHit && !multiSelect) {
      canvasSelection.set("points", []);
      canvasSelection.set("lines", []);
      canvasSelection.set("circles", []);
      canvasSelection.set("arcs", []);
      canvasSelection.set("splines", []);
      canvasSelection.set("arcEndpoint", null);
      beginDimensionDrag(e, hitD, p);
    } else if (hitP) {
      canvasSelection.set("dimensionConstraint", null);
      if (multiSelect) togglePointSelection(hitP);
      else beginDrag(e, hitP, null, null, null, null, p);
    } else if (hitArcEnd) {
      canvasSelection.set("dimensionConstraint", null);
      if (multiSelect) {
        const next = { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint };
        if (canvasSelection.arcEndpoint && !sameArcEndpoint(canvasSelection.arcEndpoint, next)) canvasSelection.set("arcEndpointPair", [canvasSelection.arcEndpoint, next]);
        canvasSelection.set("arcEndpoint", next);
        if (!canvasSelection.arcs.includes(hitArcEnd.arc)) canvasSelection.append("arcs", hitArcEnd.arc);
      } else {
        beginDrag(e, null, null, null, null, hitArcEnd, p);
      }
    } else if (hitL && drawingHitIsTop(hitL)) {
      canvasSelection.set("dimensionConstraint", null);
      if (multiSelect) toggleLineSelection(hitL);
      else beginDrag(e, null, hitL, null, null, null, p);
    } else if (hitC && drawingHitIsTop(hitC)) {
      canvasSelection.set("dimensionConstraint", null);
      if (multiSelect) toggleCircleSelection(hitC);
      else beginDrag(e, null, null, hitC, null, null, p);
    } else if (hitA && drawingHitIsTop(hitA)) {
      canvasSelection.set("dimensionConstraint", null);
      if (multiSelect) toggleArcSelection(hitA);
      else beginDrag(e, null, null, null, hitA, null, p);
    } else if (hitS && drawingHitIsTop(hitS)) {
      canvasSelection.set("dimensionConstraint", null);
      if (multiSelect) toggleSplineSelection(hitS);
      else {
        const preserveMixedSelection = selectedElementCount() > 1 && canvasSelection.splines.includes(hitS);
        if (preserveMixedSelection) dragSession = buildDragSession("selection", selectedDragPoints(), p);
        else {
          clearSelection();
          canvasSelection.set("splines", [hitS]);
          dragSession = buildDragSession("spline", hitS, p);
        }
        if (dragSession) {
          attachLocalSolveContext(dragSession);
          canvas.classList.add("is-dragging");
          canvas.setPointerCapture(e.pointerId);
          setHint(`${dragLabel(dragSession)}中: 拘束を保ちながら自動solveしています`);
        }
      }
    } else if (hatchHit && drawingHitIsTop(hatchHit)) {
      if (hatchHit.blockProjection) {
        if (!multiSelect) clearSelection();
        if (multiSelect) toggleBlockInstanceSelection(hatchHit.blockInstance);
        else canvasSelection.set("blockInstances", [hatchHit.blockInstance]);
      } else {
        if (!multiSelect) clearSelection();
        if (multiSelect) canvasSelection.toggleById("hatches", hatchHit);
        else canvasSelection.set("hatches", [hatchHit]);
      }
    } else if (referenceImageHit) {
      if (multiSelect) {
        canvasSelection.toggleById("referenceImages", referenceImageHit);
      } else {
        beginReferenceImageDrag(e, referenceImageHit, p);
        return;
      }
    } else {
      selectionRectSession = {
        pointerId: e.pointerId,
        start: p,
        current: p,
        additive: multiSelect,
      };
      canvas.setPointerCapture(e.pointerId);
    }

    // Selection does not change the model, so keep the most recent constraint
    // analysis instead of repeating the expensive redundancy scan.
    updateGeometrySelectionUI();
    draw();
  });

  function processCanvasPointerMove(e) {
    const screenPoint = { x: e.offsetX, y: e.offsetY };
    const coordinatePoint = screenToWorld(screenPoint);
    const coordinateStatus = document.getElementById("statusCoordinates");
    const coordinateText = `X ${formatDisplayNumber(coordinatePoint.x, 3)} / Y ${formatDisplayNumber(coordinatePoint.y, 3)}`;
    if (coordinateStatus && coordinateStatus.textContent !== coordinateText) coordinateStatus.textContent = coordinateText;
    if (canvasNavigation.movePan(screenPoint)) return;

    const p = coordinatePoint;
    lastPointerWorld = p;
    if (mode.startsWith("free-instance-")) {
      pointerPreview = snapForDrawing(p);
      draw();
      return;
    }
    if (mode === "hatch" || mode === "hatch-repair") {
      clearSnap();
      clearCanvasHover();
      pointerPreview = p;
      updateHatchPreview(p);
      draw();
      return;
    }
    if (selectionRectSession) {
      clearSnap();
      hoveredSketchIdentity = null;
      selectionRectSession.current = p;
      draw();
      return;
    }

    if (annotationDragSession) {
      clearSnap();
      updateAnnotationDrag(p);
      return;
    }

    if (referenceImageDragSession) {
      clearSnap();
      updateReferenceImageDrag(p);
      return;
    }

    if (referenceImageCalibrationSession) {
      clearSnap();
      clearCanvasHover();
      draw();
      return;
    }

    if (pendingCommand?.type === "annotation-leader-place" || pendingCommand?.type === "annotation-text-place") {
      pendingCommand.pointer = p;
      hoveredPoint = null;
      hoveredEndpointPoint = null;
      hoveredLine = null;
      hoveredCircle = null;
      hoveredArcEndpoint = null;
      hoveredArc = null;
      hoveredDimensionConstraint = null;
      hoveredSketchIdentity = null;
      draw();
      return;
    }

    if (pendingCommand?.type === "fillet-radius-place") {
      clearSnap();
      hoveredPoint = null;
      hoveredEndpointPoint = null;
      hoveredLine = null;
      hoveredCircle = null;
      hoveredArcEndpoint = null;
      hoveredArc = null;
      hoveredDimensionConstraint = null;
      hoveredSketchIdentity = null;
      updateFilletRadiusPlacement(p);
      draw();
      return;
    }

    if (dimensionDragSession) {
      clearSnap();
      const dx = p.x - dimensionDragSession.startPointer.x;
      const dy = p.y - dimensionDragSession.startPointer.y;
      if (dimensionDragSession.startedDuringDimensionCommand && !dimensionDragSession.moved) {
        if (hypot2(dx, dy) * viewport.scale <= 3) return;
        dimensionDragSession.moved = true;
      }
      if (dimensionDragSession.part === "label") {
        if (dimensionDragSession.target.kind === "angle") {
          const nextDimension = angleDimensionFromLabelPoint(
            dimensionDragSession.target,
            p,
            dimensionDragSession.startAngleLabelOffsets,
          );
          if (!nextDimension) return;
          preserveDimensionDragDisplay(dimensionDragSession, nextDimension);
          dimensionDragSession.constraint.dimension = nextDimension;
          syncAngleConstraintFromDimension(dimensionDragSession.constraint, dimensionDragSession.target, nextDimension);
          draw();
          return;
        }
        const anchor =
          dimensionDragSession.target.kind === "radius" || dimensionDragSession.target.kind === "diameter"
            ? p
            : {
                x: dimensionDragSession.startAnchor.x + dx,
                y: dimensionDragSession.startAnchor.y + dy,
              };
        const nextDimension = dimensionWithLabelAt(
          dimensionDragSession.target,
          dimensionFromAnchor(dimensionDragSession.target, anchor, { allowPointAxis: false }),
          p,
        );
        preserveDimensionDragDisplay(dimensionDragSession, nextDimension);
        dimensionDragSession.constraint.dimension = nextDimension;
        syncAngleConstraintFromDimension(dimensionDragSession.constraint, dimensionDragSession.target, nextDimension);
        draw();
        return;
      }
      const anchor =
        dimensionDragSession.target.kind === "radius" || dimensionDragSession.target.kind === "diameter"
          ? p
          : {
              x: dimensionDragSession.startAnchor.x + dx,
              y: dimensionDragSession.startAnchor.y + dy,
            };
      const nextDimension = dimensionFromAnchor(dimensionDragSession.target, anchor, { allowPointAxis: false });
      nextDimension.labelOffsetU = dimensionDragSession.startLabelOffsetU;
      preserveDimensionDragDisplay(dimensionDragSession, nextDimension);
      if (dimensionDragSession.target.kind === "angle") {
        setAngleDimensionLabelOffsets(nextDimension, dimensionDragSession.startAngleLabelOffsets);
      }
      dimensionDragSession.constraint.dimension = nextDimension;
      syncAngleConstraintFromDimension(dimensionDragSession.constraint, dimensionDragSession.target, nextDimension);
      draw();
      return;
    }

    if (["point", "line", "centerline", "circle-center-cross", "rectangle", "slot", "circle", "arc", "three-point-arc", "spline", "fillet", "trim", "offset", "block-place"].includes(mode) && !canCreateInActiveSketch()) {
      clearSnap();
      pointerPreview = null;
      trimPreview = null;
      hoveredSketchIdentity = null;
      return;
    }

    if (mode === "line") {
      hoveredSketchIdentity = null;
      const rawPreview = lineCommand.previewPoint(p, e.shiftKey);
      pointerPreview = snapForDrawing(rawPreview);
      draw();
    }

    if (mode === "centerline") {
      clearSnap();
      hoveredSketchIdentity = null;
      pointerPreview = centerlineCommand.support?.ok ? projectPointToCenterlineSupport(snapForDrawing(p)) : p;
      if (centerlineCommand.targets.length < 2) {
        clearSnap();
        const wantsLine = centerlineCommand.targets[0] instanceof Line;
        const wantsPoint = centerlineCommand.targets[0] instanceof Point;
        hoveredPoint = wantsLine ? null : hitPoint(p.x, p.y);
        hoveredEndpointPoint = hoveredPoint;
        hoveredLine = wantsPoint || hoveredPoint ? null : hitLine(p.x, p.y);
      } else {
        hoveredPoint = null;
        hoveredEndpointPoint = null;
        hoveredLine = null;
      }
      hoveredCircle = null;
      hoveredArc = null;
      hoveredArcEndpoint = null;
      hoveredSpline = null;
      hoveredDimensionConstraint = null;
      draw();
      return;
    }

    if (mode === "circle-center-cross") {
      clearSnap();
      hoveredSketchIdentity = null;
      pointerPreview = p;
      hoveredPoint = null;
      hoveredEndpointPoint = null;
      hoveredLine = null;
      hoveredCircle = hitCircle(p.x, p.y);
      hoveredArc = null;
      hoveredArcEndpoint = null;
      hoveredSpline = null;
      hoveredDimensionConstraint = null;
      draw();
      return;
    }

    if (mode === "rectangle" || mode === "slot" || mode === "circle" || mode === "arc" || mode === "three-point-arc" || mode === "spline") {
      hoveredSketchIdentity = null;
      pointerPreview = snapForDrawing(p);
      draw();
    }

    if (mode === "block-place") {
      clearSnap();
      hoveredSketchIdentity = null;
      pointerPreview = p;
      draw();
      return;
    }

    if (pendingCommand?.type === "distance-place") {
      clearSnap();
      const hitD = hitDimension(p.x, p.y);
      hoveredSketchIdentity = hitSketchIdentityElement(p.x, p.y, { allowInactiveGeometry: true });
      pendingCommand.pointer = p;
      pendingCommand.dimension = null;
      updatePendingDistanceRetargetHover(p);
      if (hitD) {
        hoveredPoint = null;
        hoveredEndpointPoint = null;
        hoveredLine = null;
        hoveredCircle = null;
        hoveredArcEndpoint = null;
        hoveredArc = null;
        hoveredDimensionConstraint = hitD.constraint;
      }
      draw();
      return;
    }

    if (mode === "trim") {
      clearSnap();
      const hadHover = Boolean(hoveredPoint || hoveredEndpointPoint || hoveredLine || hoveredCircle || hoveredArcEndpoint || hoveredArc || hoveredDimensionConstraint);
      hoveredPoint = null;
      hoveredEndpointPoint = null;
      hoveredLine = null;
      hoveredCircle = null;
      hoveredArcEndpoint = null;
      hoveredArc = null;
      hoveredSpline = null;
      hoveredDimensionConstraint = null;
      hoveredSketchIdentity = null;
      const nextTrimPreview = computeTrimPreview(p);
      if (nextTrimPreview !== trimPreview || hadHover) {
        trimPreview = nextTrimPreview;
        draw();
      }
      return;
    }

    if (mode === "offset") {
      clearSnap();
      hoveredSketchIdentity = null;
      if (pendingCommand?.type === "offset-value") {
        draw();
        return;
      }
      pointerPreview = p;
      if (offsetSelection.source instanceof Circle || offsetSelection.committed) {
        hoveredPoint = null;
        hoveredEndpointPoint = null;
        hoveredLine = offsetSelection.source instanceof Line ? offsetSelection.source : null;
        hoveredCircle = offsetSelection.source instanceof Circle ? offsetSelection.source : null;
        hoveredArc = offsetSelection.source instanceof Arc ? offsetSelection.source : null;
      } else {
        const nextLine = hitLine(p.x, p.y);
        const nextCircle = nextLine ? null : hitCircle(p.x, p.y);
        const nextArc = nextLine || nextCircle ? null : hitArc(p.x, p.y);
        hoveredPoint = null;
        hoveredEndpointPoint = null;
        hoveredLine = nextLine;
        hoveredCircle = nextCircle;
        hoveredArc = nextArc;
      }
      hoveredArcEndpoint = null;
      hoveredDimensionConstraint = null;
      draw();
      return;
    }

    if (pendingConstraintCommand && !dragSession) {
      const hitD = pendingConstraintCommand.type === "distance" ? hitDimension(p.x, p.y) : null;
      if (hitD) {
        hoveredPoint = null;
        hoveredEndpointPoint = null;
        hoveredLine = null;
        hoveredCircle = null;
        hoveredArcEndpoint = null;
        hoveredArc = null;
        hoveredDimensionConstraint = hitD.constraint;
        hoveredBlockInstance = null;
        draw();
        return;
      }
      const blockOperand = hitDerivedProjectionOperand(p.x, p.y) || hitBlockProjectionOperand(p.x, p.y);
      if (blockOperand) {
        hoveredPoint = blockOperand.kind === "point" ? blockOperand.point : null;
        hoveredEndpointPoint = null;
        hoveredLine = blockOperand.kind === "line" ? blockOperand.line : null;
        hoveredCircle = blockOperand.kind === "primitive" && blockOperand.primitive instanceof Circle ? blockOperand.primitive : null;
        hoveredArc = blockOperand.kind === "primitive" && blockOperand.primitive instanceof Arc ? blockOperand.primitive : null;
        hoveredArcEndpoint = blockOperand.kind === "arc-endpoint" ? { arc: blockOperand.arc, endpoint: blockOperand.endpoint } : null;
        hoveredDimensionConstraint = null;
        hoveredBlockInstance = null;
        draw();
        return;
      }
      const referenceTarget = hitReferenceTarget(p.x, p.y);
      const nextSketchIdentity = hitSketchIdentityElement(p.x, p.y, { allowInactiveGeometry: true });
      const nextEndpointHover = referenceTarget ? null : hitEndpointPoint(p.x, p.y);
      const nextPointHover = referenceTarget ? (referenceTarget.kind === "point" ? referenceTarget.point : null) : nextEndpointHover || hitExplicitPoint(p.x, p.y);
      const nextLineHover = referenceTarget ? (referenceTarget.kind === "line" ? referenceTarget.line : null) : nextPointHover ? null : hitLine(p.x, p.y);
      const nextCircleHover = referenceTarget
        ? referenceTarget.primitive instanceof Circle
          ? referenceTarget.primitive
          : null
        : nextPointHover || nextLineHover
          ? null
          : hitCircle(p.x, p.y);
      const nextArcEndpointHover = referenceTarget || nextPointHover || nextLineHover || nextCircleHover ? null : hitArcEndpoint(p.x, p.y);
      const nextArcHover = referenceTarget
        ? referenceTarget.primitive instanceof Arc
          ? referenceTarget.primitive
          : null
        : nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover
          ? null
          : hitArc(p.x, p.y);
      if (
        nextPointHover !== hoveredPoint ||
        nextEndpointHover !== hoveredEndpointPoint ||
        nextLineHover !== hoveredLine ||
        nextCircleHover !== hoveredCircle ||
        !sameArcEndpoint(nextArcEndpointHover, hoveredArcEndpoint) ||
        nextArcHover !== hoveredArc ||
        hoveredDimensionConstraint ||
        nextSketchIdentity?.item !== hoveredSketchIdentity?.item ||
        Boolean(nextSketchIdentity)
      ) {
        hoveredPoint = nextPointHover;
        hoveredEndpointPoint = nextEndpointHover;
        hoveredLine = nextLineHover;
        hoveredCircle = nextCircleHover;
        hoveredArcEndpoint = nextArcEndpointHover;
        hoveredArc = nextArcHover;
        hoveredDimensionConstraint = null;
        hoveredSketchIdentity = nextSketchIdentity;
        draw();
      }
      return;
    }

    if (!dragSession) {
      const hitD = hitDimension(p.x, p.y, { activeOnly: false });
      const nextHover = hitD && isActiveSketchConstraint(hitD.constraint) ? hitD.constraint : null;
      const nextEndpointHover = nextHover ? null : hitEndpointPoint(p.x, p.y);
      const nextPointHover = nextHover ? null : nextEndpointHover || hitExplicitPoint(p.x, p.y);
      const nextLineHover = nextPointHover ? null : hitLine(p.x, p.y);
      const nextCircleHover = nextPointHover || nextLineHover ? null : hitCircle(p.x, p.y);
      const nextArcEndpointHover = nextPointHover || nextLineHover || nextCircleHover ? null : hitArcEndpoint(p.x, p.y);
      const nextArcHover = nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover ? null : hitArc(p.x, p.y);
      const nextSplineHover = nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover || nextArcHover ? null : hitSpline(p.x, p.y);
      const nextSketchIdentity = hitSketchIdentityElement(p.x, p.y, { allowInactiveGeometry: true });
      let nextBlockHover = nextHover || nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover || nextArcHover || nextSplineHover ? null : hitBlockInstance(p.x, p.y);
      const nextGeometryInstanceHover = nextHover || nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover || nextArcHover || nextSplineHover || nextBlockHover ? null : hitGeometryInstance(p.x, p.y);
      const annotationHit = nextHover || nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover || nextArcHover || nextSplineHover || nextBlockHover || nextGeometryInstanceHover
        ? null
        : hitAnnotationElement(p.x, p.y);
      const nextAnnotationHover = annotationHit?.element || null;
      const rawHatchHover = nextAnnotationHover ? null : hitHatchAt(p.x, p.y);
      if (!nextBlockHover && rawHatchHover?.blockProjection) nextBlockHover = rawHatchHover.blockInstance;
      const nextHatchHover = rawHatchHover?.blockProjection ? null : rawHatchHover;
      const nextReferenceImageHover = nextHover || nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover || nextArcHover || nextSplineHover || nextBlockHover || nextAnnotationHover || rawHatchHover
        ? null
        : hitReferenceImageAt(p.x, p.y);
      if (
        nextPointHover !== hoveredPoint ||
        nextEndpointHover !== hoveredEndpointPoint ||
        nextLineHover !== hoveredLine ||
        nextCircleHover !== hoveredCircle ||
        !sameArcEndpoint(nextArcEndpointHover, hoveredArcEndpoint) ||
        nextArcHover !== hoveredArc ||
        nextSplineHover !== hoveredSpline ||
        nextHover !== hoveredDimensionConstraint ||
        nextSketchIdentity?.item !== hoveredSketchIdentity?.item ||
        Boolean(nextSketchIdentity) || nextBlockHover !== hoveredBlockInstance || nextGeometryInstanceHover !== hoveredGeometryInstance ||
        nextAnnotationHover !== hoveredAnnotation ||
        nextHatchHover !== hoveredHatch ||
        nextReferenceImageHover !== hoveredReferenceImage
      ) {
        hoveredPoint = nextPointHover;
        hoveredEndpointPoint = nextEndpointHover;
        hoveredLine = nextLineHover;
        hoveredCircle = nextCircleHover;
        hoveredArcEndpoint = nextArcEndpointHover;
        hoveredArc = nextArcHover;
        hoveredSpline = nextSplineHover;
        hoveredDimensionConstraint = nextHover;
        hoveredSketchIdentity = nextSketchIdentity;
        hoveredBlockInstance = nextBlockHover;
        hoveredGeometryInstance = nextGeometryInstanceHover;
        hoveredAnnotation = nextAnnotationHover;
        hoveredHatch = nextHatchHover;
        hoveredReferenceImage = nextReferenceImageHover;
        draw();
      }
    }

    if (!dragSession) return;
    const displayStartPointer = dragSession.displayStartPointer || dragSession.startPointer;
    const pointerDistance = hypot2(p.x - displayStartPointer.x, p.y - displayStartPointer.y);
    if (!dragSession.previewMoved && pointerDistance <= 3 / viewport.scale) return;
    if (dragSession.projectionShapeLocked) {
      dragSession.projectionDragAttempted = true;
      setHint(sketchProjectionShapeEditBlockedMessage(applicationText("ドラッグ", "Drag")), "error");
      draw();
      return;
    }
    dragSession.previewMoved = true;
    const dragPointer = dragSession.pointerMap ? dragSession.pointerMap(p) : p;
    const result = dragResultForSession(dragSession, dragPointer);
    if (result.blocked) {
      setHint(result.reason, "error");
      updateUI({ refreshAnalysis: false });
      draw();
      return;
    }
    const dependentResult = solveReferenceDependentSketches(dragSession.sketchId || activeSketchId());
    setHint(dependentResult.success
      ? applicationText("ドラッグ中: 拘束を保ちながら調整しています", "Dragging: maintaining constraints")
      : applicationText("ドラッグ中: 参照先の拘束を確認してください", "Dragging: check the referenced constraints"), dependentResult.success ? "normal" : "error");
    if (!dependentResult.success) updateUI();
    draw();
  }

  function processScheduledCanvasPointerMove({ animationFrame = false, synchronousFlush = false } = {}) {
    if (!pendingCanvasPointerMove) return false;
    const pointer = pendingCanvasPointerMove;
    pendingCanvasPointerMove = null;
    if (interactionFrameStats) {
      interactionFrameStats.processedMoves += 1;
      if (animationFrame) interactionFrameStats.animationFrames += 1;
      if (synchronousFlush) interactionFrameStats.synchronousFlushes += 1;
    }
    profileInteractionPhase("preview", () => {
      withGeometryReadCache(() => processCanvasPointerMove(pointer));
      if (pendingCommand && ["distance-value", "offset-value"].includes(pendingCommand.type)) syncDimensionValueInput();
    });
    return true;
  }

  function scheduleCanvasPointerMove(e) {
    if (interactionFrameStats) interactionFrameStats.receivedMoves += 1;
    if (pendingCanvasPointerMove) {
      if (interactionFrameStats) interactionFrameStats.coalescedMoves += 1;
      pendingCanvasPointerMove.offsetX = e.offsetX;
      pendingCanvasPointerMove.offsetY = e.offsetY;
      pendingCanvasPointerMove.shiftKey = e.shiftKey;
    } else {
      pendingCanvasPointerMove = { offsetX: e.offsetX, offsetY: e.offsetY, shiftKey: e.shiftKey };
    }
    if (canvasPointerMoveFrame != null) return;
    canvasPointerMoveFrame = requestAnimationFrame(() => {
      canvasPointerMoveFrame = null;
      processScheduledCanvasPointerMove({ animationFrame: true });
    });
  }

  function flushScheduledCanvasPointerMove({ discard = false } = {}) {
    if (canvasPointerMoveFrame != null) {
      cancelAnimationFrame(canvasPointerMoveFrame);
      canvasPointerMoveFrame = null;
    }
    if (discard) {
      pendingCanvasPointerMove = null;
      return false;
    }
    return processScheduledCanvasPointerMove({ synchronousFlush: true });
  }

  canvas.addEventListener("pointermove", scheduleCanvasPointerMove);

  function endDrag(e) {
    flushScheduledCanvasPointerMove();
    return profileInteractionPhase("commit", () => finishPointerInteraction(e));
  }

  function finishPointerInteraction(e) {
    if (canvasNavigation.endPan(e)) return;

    if (referenceImageDragSession) {
      const session = referenceImageDragSession;
      referenceImageDragSession = null;
      canvas.classList.remove("is-dragging");
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {
        // Pointer capture may already be released by the browser.
      }
      setHint(session.moved ? applicationText("画像の位置を更新しました", "Image position updated") : applicationText("画像を選択しました", "Image selected"));
      updateUI({ refreshAnalysis: false });
      draw();
      if (session.moved) recordHistory("画像移動");
      return;
    }

    if (annotationDragSession) {
      annotationDragSession = null;
      canvas.classList.remove("is-dragging");
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {
        // Pointer capture may already be released by the browser.
      }
      setHint("注記の位置を更新しました");
      updateUI();
      draw();
      recordHistory("注記移動");
      return;
    }

    if (dimensionDragSession) {
      const session = dimensionDragSession;
      dimensionDragSession = null;
      canvas.classList.remove("is-dragging");
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {
        // Pointer capture may already be released by the browser.
      }
      if (session.startedDuringDimensionCommand && !session.moved) {
        canvasSelection.set("dimensionConstraint", null);
        hoveredDimensionConstraint = null;
        const pointer = canvasPoint(e);
        if (pendingCommand?.type === "distance-place") {
          if (!retargetDistancePlaceWithOperand(pointer, session.commandHits || {})) startDistanceValueInput(pointer);
        } else if (pendingConstraintCommand?.type === "distance") {
          handleConstraintOperandClick(pointer, "distance", session.commandHits || {});
        }
        return;
      }
      setHint("寸法線の位置を更新しました");
      // Angle placement can change the constraint target; other dimensions only change layout.
      if (session.target.kind === "angle") updateUI();
      else {
        updateGeometrySelectionUI();
        syncDimensionValueInput();
      }
      draw();
      recordHistory("寸法線移動");
      return;
    }

    if (selectionRectSession) {
      const session = selectionRectSession;
      selectionRectSession = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {
        // Pointer capture may already be released by the browser.
      }
      const current = session.current || session.start;
      const moved = hypot2(current.x - session.start.x, current.y - session.start.y);
      if (session.kind === "sketch-projection") {
        if (moved > 3 / viewport.scale) {
          addSketchProjectionSourcesByRect(rectFromPoints(session.start, current), current.x < session.start.x);
        } else {
          draw();
        }
        return;
      }
      if (moved <= 3 / viewport.scale) {
        if (!session.additive) clearSelection();
      } else {
        selectByRect(rectFromPoints(session.start, current), current.x < session.start.x, session.additive);
        setHint("矩形選択を更新しました");
      }
      updateGeometrySelectionUI();
      draw();
      return;
    }

    if (!dragSession) {
      // The first Line endpoint is provisional until a segment is completed.
      if (!transientAuthoring.hasLineStart) recordHistory("操作");
      return;
    }
    const session = dragSession;
    const completedLabel = dragLabel(session);
    dragSession = null;
    canvas.classList.remove("is-dragging");
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (_) {
      // Pointer capture may already be released by the browser.
    }
    if (session.projectionDragAttempted) {
      setHint(sketchProjectionShapeEditBlockedMessage(applicationText("ドラッグ", "Drag")), "error");
      draw();
      return;
    }
    if (!session.previewMoved) {
      if (session.clickGeometrySelection && e.type !== "pointercancel") {
        canvasSelection.set("instanceGeometry", session.clickGeometrySelection);
        updateGeometrySelectionUI();
      }
      setHint("図形を選択しました");
      draw();
      return;
    }
    const result = solveFinalDragSession(session);
    normalizeArcSweeps();
    const invalidSpline = model.splines.find((spline) => !spline.curve().valid);
    if (!result.success || result.errorNorm > CONSTRAINT_ACCEPT_ERROR || invalidSpline) {
      if (session.parameterDragSnapshot) restoreModelState(session.parameterDragSnapshot);
      else if (session.fullDragState) solver.restore(session.fullDragState);
      clearSketchSolveState(session.sketchId || activeSketchId());
      setHint(invalidSpline
        ? applicationText(`${invalidSpline.id} の通過点が重なり、スプラインが成立しないため移動を戻しました`, `${invalidSpline.id} was restored because overlapping fit points made the spline invalid.`)
        : applicationText(`${completedLabel}完了時に拘束を解決できないため移動を戻しました`, `${completedLabel} was restored because its constraints could not be resolved.`), "error");
      updateUI();
      draw();
      return;
    }

    if (session.item && model.blockInstances.includes(session.item)) invalidateBlockProjectionCache(session.item.id);
    const stabilized = stabilizeActiveParameterNamespace(session.sketchId || activeSketchId(), { variableAllowed: session.variableAllowed });
    if (!stabilized.success || stabilized.dependent?.success === false || stabilized.result.errorNorm > CONSTRAINT_ACCEPT_ERROR) {
      if (session.parameterDragSnapshot) restoreModelState(session.parameterDragSnapshot);
      clearSketchSolveState(session.sketchId || activeSketchId());
      setHint(`${completedLabel}${applicationText("後のParameter計算に失敗しました", " parameter calculation failed")}: ${stabilized.result.reason || "solve failed"}`, "error");
      updateUI();
      draw();
      return;
    }
    const dependentResult = stabilized.dependent;
    const analysis = refreshConstraintAnalysis();
    const stable = analysis.analysis.stable && dependentResult.success;
    setHint(stable
      ? applicationText(`${completedLabel}を完了しました`, `${completedLabel} completed`)
      : applicationText(`${completedLabel}を完了しました。拘束状態を確認してください`, `${completedLabel} completed. Check the constraint status`), stable ? "normal" : "error");
    updateUI({ refreshAnalysis: false });
    draw();
    recordHistory(`${completedLabel}ドラッグ`);
  }

  function isBlankCanvasHit(hits = {}) {
    return !hits.hitP &&
      !hits.hitL &&
      !hits.hitC &&
      !hits.hitArcEnd &&
      !hits.hitA &&
      !hits.hitS &&
      !hits.hitD &&
      !hits.hitBlock &&
      !hits.hitDerivedInstance &&
      !hits.hatchHit &&
      !hits.referenceImageHit &&
      !hits.annotationHit &&
      !hits.inactiveHit;
  }

  function isTransientLineStartHit(hits = {}) {
    return transientAuthoring.isLineStartHit(hits.hitP, lineCommand.startPoint);
  }

  function isTransientLineCompletionHit(hits = {}) {
    return mode === "line" && transientAuthoring.isLineCompletionHit(hits.hitP, lineCommand.startPoint);
  }

  function isTransientPointCommandHit(hits = {}) {
    return mode === "point" && transientAuthoring.isPointHit(hits.hitP);
  }

  function isBlankDoubleClickTarget(hits = {}) {
    if (isBlankCanvasHit(hits)) return true;
    if (
      isTransientPointCommandHit(hits) &&
      !hits.hitL &&
      !hits.hitC &&
      !hits.hitArcEnd &&
      !hits.hitA &&
      !hits.hitS &&
      !hits.hitD &&
      !hits.annotationHit &&
      !hits.inactiveHit
    ) {
      return true;
    }
    if (isTransientLineCompletionHit(hits)) {
      return !hits.hitC &&
        !hits.hitArcEnd &&
        !hits.hitA &&
        !hits.hitD &&
        !hits.annotationHit &&
        !hits.inactiveHit;
    }
    return isTransientLineStartHit(hits) &&
      !hits.hitC &&
      !hits.hitArcEnd &&
      !hits.hitA &&
      !hits.hitD &&
      !hits.annotationHit &&
      !hits.inactiveHit;
  }

  function isRepeatedBlankDoubleClick(e, hits = {}) {
    const screen = canvasScreenPoint(e);
    const now = performance.now();
    const repeated = Boolean(
      isBlankDoubleClickTarget(hits) &&
        blankDoubleClickCandidate &&
        now - blankDoubleClickCandidate.time <= 450 &&
        hypot2(screen.x - blankDoubleClickCandidate.x, screen.y - blankDoubleClickCandidate.y) <= 6,
    );
    blankDoubleClickCandidate = isBlankDoubleClickTarget(hits) ? { time: now, x: screen.x, y: screen.y } : null;
    return repeated;
  }

  function isDrawToolMode() {
    return mode === "instance-sources" || mode === "line" || mode === "centerline" || mode === "circle-center-cross" || mode === "point" || mode === "rectangle" || mode === "slot" || mode === "fillet" || mode === "trim" || mode === "offset" || mode === "circle" || mode === "arc" || mode === "three-point-arc" || mode === "spline" || mode === "sketch-projection" || mode === "hatch" || mode === "hatch-repair";
  }

  function handleBlankCanvasDoubleClick(pointer, hits = {}) {
    if (!isBlankDoubleClickTarget(hits)) return false;
    blankDoubleClickCandidate = null;
    if (mode === "spline") {
      finalizeSplineFromDoubleClick(pointer);
      return true;
    }
    if (splineEditSession) return finishSplineEditSession();
    if (pendingCommand?.type === "distance-value") {
      submitDistanceValue();
      return true;
    }
    if (pendingCommand?.type === "offset-value") {
      submitOffsetValue();
      return true;
    }
    if (pendingCommand) {
      cancelPendingCommand();
      if (isDrawToolMode()) exitDrawMode();
      return true;
    }
    if (pendingConstraintCommand) {
      cancelConstraintTargetCommand();
      return true;
    }
    if (mode === "line") {
      if (isTransientLineCompletionHit(hits)) {
        rollbackTransientLineCompletion();
        lineCommand.reset();
        pointerPreview = null;
        clearSnap();
        clearSelection();
        setHint("線の作図をキャンセルしました");
        updateUI();
        draw();
      } else if (isTransientLineStartHit(hits) || (transientAuthoring.hasLineStart && lineCommand.startPoint && !transientAuthoring.hasLineCompletion)) {
        cancelActiveDrawOperation();
        exitDrawMode();
      } else if (lineCommand.startPoint) {
        cancelActiveDrawOperation();
        updateUI();
        draw();
      } else {
        exitDrawMode();
      }
      return true;
    }
    if (mode === "point") {
      rollbackTransientPoint();
      exitDrawMode();
      return true;
    }
    if (hasActiveDrawOperation()) {
      cancelActiveDrawOperation();
      exitDrawMode();
      return true;
    }
    if (isDrawToolMode()) {
      exitDrawMode();
      return true;
    }
    if (hasSelection()) {
      clearSelection();
      setHint("選択を解除しました");
      updateGeometrySelectionUI();
      draw();
      return true;
    }
    return false;
  }

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", () => {
    if (dragSession || dimensionDragSession || annotationDragSession || selectionRectSession || canvasNavigation.panning) return;
    flushScheduledCanvasPointerMove({ discard: true });
    clearCanvasHover();
    draw();
  });
  canvas.addEventListener("dblclick", (e) => {
    flushScheduledCanvasPointerMove();
    if (suppressNextBlankDoubleClickEvent) {
      suppressNextBlankDoubleClickEvent = false;
      e.preventDefault();
      return;
    }
    const p = canvasPoint(e);
    if (mode === "select" && !pendingCommand && !pendingConstraintCommand
      && canvasSelection.instanceGeometry && hitDerivedGeometryForDrag(p.x, p.y)?.instance.id === canvasSelection.instanceGeometry.instanceId) {
      e.preventDefault();
      return;
    }
    const hitL = hitLine(p.x, p.y);
    const hitP = hitPoint(p.x, p.y);
    const hitC = hitCircle(p.x, p.y);
    const hitArcEnd = hitArcEndpoint(p.x, p.y);
    const hitA = hitArc(p.x, p.y);
    const hitS = hitSpline(p.x, p.y);
    const hitD = hitDimension(p.x, p.y);
    const hitBlock = hitBlockInstance(p.x, p.y);
    if (mode === "spline") {
      e.preventDefault();
      finalizeSplineFromDoubleClick(p);
      return;
    }
    if (pendingCommand?.type === "offset-value") {
      e.preventDefault();
      submitOffsetValue();
      return;
    }
    if (!pendingCommand && hitD && startDimensionEditInput(hitD)) {
      e.preventDefault();
      return;
    }
    if (pendingCommand?.type?.startsWith("distance")) {
      e.preventDefault();
      if (pendingCommand.type === "distance-place") {
        startDistanceValueInput(p);
      }
      submitDistanceValue();
      return;
    }
    if (handleConstraintTargetDoubleClick(hitP, hitL, p)) {
      e.preventDefault();
      return;
    }
    if (!pendingCommand && !pendingConstraintCommand && hitBlock) {
      e.preventDefault();
      enterBlockDefinitionEdit(hitBlock.definitionId);
      return;
    }
    if (!pendingCommand && !pendingConstraintCommand && hitS && !hitS.blockProjection) {
      e.preventDefault();
      clearSelection();
      canvasSelection.set("splines", [hitS]);
      splineEditSession = { spline: hitS };
      setHint(applicationText(`${hitS.id} の通過点を編集します。Escまたは空白のダブルクリックで終了します`, `Editing fit points of ${hitS.id}. Press Esc or double-click blank canvas to finish.`));
      updateUI({ refreshAnalysis: false });
      draw();
      return;
    }
    if (handleBlankCanvasDoubleClick(p, { hitP, hitL, hitC, hitArcEnd, hitA, hitS, hitD })) {
      e.preventDefault();
      return;
    }
  });
  canvas.addEventListener("auxclick", (e) => {
    if (e.button === 1) {
      e.preventDefault();
      canvasNavigation.doubleClickFit(e);
    }
  });
  if (dimensionValueInput) {
    dimensionValueInput.addEventListener("pointerdown", (e) => e.stopPropagation());
    dimensionValueInput.addEventListener("dblclick", (e) => e.stopPropagation());
    dimensionValueInput.addEventListener("input", () => {
      if (!pendingCommand || !["distance-value", "offset-value"].includes(pendingCommand.type)) return;
      pendingCommand.buffer = dimensionValueInput.value;
      pendingCommand.editing = true;
      updateDistanceBufferLabel();
    });
    dimensionValueInput.addEventListener("keydown", (e) => {
      if (!pendingCommand || !["distance-value", "offset-value"].includes(pendingCommand.type)) return;
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        if (pendingCommand.type === "offset-value") submitOffsetValue();
        else submitDistanceValue();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelPendingCommand("寸法入力をキャンセルしました");
      }
    });
  }
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      flushScheduledCanvasPointerMove();
      closeCanvasContextMenu();
      const screen = canvasScreenPoint(e);
      const world = screenToWorld(screen);
      const nextScale = clampZoom(viewport.scale * Math.exp(-e.deltaY * 0.001));
      viewport.update({ scale: nextScale });
      viewport.update({ x: screen.x - world.x * viewport.scale });
      viewport.update({ y: screen.y - world.y * viewport.scale });
      setHint(`表示倍率: ${formatZoom(viewport.scale)}`);
      draw();
      if (pendingCommand && ["distance-value", "offset-value"].includes(pendingCommand.type)) syncDimensionValueInput();
    },
    { passive: false },
  );

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && canvasContextMenu && !canvasContextMenu.hidden) {
      e.preventDefault();
      closeCanvasContextMenu();
      return;
    }
    const key = e.key.toLowerCase();
    const commandKey = e.ctrlKey || e.metaKey;
    const textEditingTarget = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target?.isContentEditable;
    if (e.code === "Space" && !textEditingTarget && !constraintStatusSpaceHeld) {
      e.preventDefault();
      constraintStatusSpaceHeld = true;
      syncConstraintStatusView();
      return;
    }
    if (commandKey && key === "s") {
      e.preventDefault();
      if (e.repeat) return;
      if (e.shiftKey) void saveJot2DFileAs();
      else void saveJot2DFile();
      return;
    }
    if (commandKey && isGeometryMode() && !textEditingTarget && ["c", "x", "v"].includes(key)) {
      e.preventDefault();
      if (key === "c") copySelectionToClipboard();
      else if (key === "x") copySelectionToClipboard({ cut: true });
      else pasteGeometryClipboard();
      return;
    }
    if (commandKey && key === "z" && !e.shiftKey) {
      e.preventDefault();
      undoHistory();
      return;
    }
    if (commandKey && (key === "y" || (key === "z" && e.shiftKey))) {
      e.preventDefault();
      redoHistory();
      return;
    }

    if (handleDistanceKey(e)) return;

    if (!textEditingTarget && mode === "instance-sources" && ["Enter", "Escape"].includes(e.key)) {
      e.preventDefault();
      finishInstanceSourceEdit(e.key === "Enter");
      return;
    }

    if (!textEditingTarget && mode === "spline" && e.key === "Enter") {
      e.preventDefault();
      finalizeSplineCreation(false);
      return;
    }

    if (!textEditingTarget && mode === "sketch-projection" && e.key === "Enter") {
      e.preventDefault();
      commitSketchProjectionCommand();
      return;
    }

    if (!textEditingTarget && mode === "spline" && e.key === "Backspace") {
      e.preventDefault();
      splineDraft.removeLast();
      setHint(applicationText("通過点をクリックしてください。Enterまたは空白のダブルクリックで終了（ダブルクリック位置は追加しません）、始点クリックで閉じます", "Click fit points. Press Enter or double-click blank canvas to finish without adding that position, or click the start point to close."));
      draw();
      return;
    }

    if (!textEditingTarget && e.key === "Enter" && mode === "offset" && offsetCommand.canConfirmSelection()) {
      e.preventDefault();
      offsetCommand.confirmSelection(lastPointerWorld);
      return;
    }

    if (!textEditingTarget && (e.key === "Delete" || e.key === "Backspace") && isGeometryMode() && deleteCurrentSelection()) {
      e.preventDefault();
      return;
    }

    if (e.key === "Enter" && completePendingDimensionLineLength()) {
      e.preventDefault();
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      if (mode.startsWith("free-instance-")) {
        geometryInstanceCommand.reset();
        mode = "select";
        updateUI({ refreshAnalysis: false });
        updateToolbar();
        draw();
        return;
      }
      if (mode === "mirror-axis" || mode === "pattern-direction") {
        geometryInstanceCommand.clearSources();
        mode = "select";
        updateToolbar();
        setHint(applicationText("派生インスタンス作成をキャンセルしました", "Derived instance creation canceled."));
        draw();
        return;
      }
      if (mode === "sketch-projection") {
        sketchProjectionSources = [];
        mode = "select";
        hoveredPoint = null;
        hoveredLine = null;
        hoveredCircle = null;
        hoveredArc = null;
        hoveredSpline = null;
        hoveredSketchIdentity = null;
        updateToolbar();
        setHint(applicationText("スケッチ投影をキャンセルしました", "Sketch projection was canceled."));
        updateUI({ refreshAnalysis: false });
        draw();
        return;
      }
      if (referenceImageCalibrationSession) {
        cancelReferenceImageCalibration();
        return;
      }
      if (splineEditSession) {
        finishSplineEditSession();
        return;
      }
      if (mode === "block-place") {
        if (blockPlacementCommand.anchor) commitBlockPlacement(0);
        else {
          blockPlacementCommand.reset({ preservePanelState: true });
          pointerPreview = null;
          mode = "select";
          restoreBlockPlacementPropertiesPanel();
          setHint("ブロック配置をキャンセルしました");
          updateUI();
          draw();
        }
        return;
      }
      if (pendingCommand) {
        cancelPendingCommand();
        return;
      }
      if (pendingConstraintCommand) {
        cancelConstraintTargetCommand();
        return;
      }
      if (hasActiveDrawOperation()) {
        cancelActiveDrawOperation();
        return;
      }
      if (isDrawToolMode()) {
        exitDrawMode();
        return;
      }
      if (
        canvasSelection.points.length > 0 ||
        canvasSelection.lines.length > 0 ||
        canvasSelection.circles.length > 0 ||
        canvasSelection.arcs.length > 0 ||
        canvasSelection.splines.length > 0 ||
        canvasSelection.blockInstances.length > 0 ||
        canvasSelection.geometryInstances.length > 0 ||
        canvasSelection.arcEndpoint ||
        canvasSelection.dimensionConstraint ||
        canvasSelection.annotations.length > 0 ||
        canvasSelection.hatches.length > 0 ||
        canvasSelection.referenceImages.length > 0 ||
        effectiveSelectedConstraint()
      ) {
        clearSelection();
        setHint("選択を解除しました");
        updateUI();
        draw();
      }
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code !== "Space" || !constraintStatusSpaceHeld) return;
    e.preventDefault();
    constraintStatusSpaceHeld = false;
    syncConstraintStatusView();
  });
  window.addEventListener("blur", () => {
    if (!constraintStatusSpaceHeld) return;
    constraintStatusSpaceHeld = false;
    syncConstraintStatusView({ hint: false });
  });

  document.getElementById("undoBtn")?.addEventListener("click", undoHistory);
  document.getElementById("redoBtn")?.addEventListener("click", redoHistory);
  document.getElementById("deleteSelectionBtn")?.addEventListener("click", () => {
    if (!isGeometryMode()) return;
    if (deleteCurrentSelection()) {
      updateUI();
      draw();
    }
  });
  document.getElementById("annotationLeaderBtn")?.addEventListener("click", createLeaderAnnotation);
  document.getElementById("annotationTextBtn")?.addEventListener("click", createTextAnnotation);
  document.getElementById("constraintStatusViewBtn")?.addEventListener("click", () => {
    constraintStatusMouseLatched = !constraintStatusMouseLatched;
    syncConstraintStatusView();
  });
  document.getElementById("viewConstraintStatusInput")?.addEventListener("change", (event) => {
    constraintStatusMouseLatched = event.target.checked;
    syncConstraintStatusView();
  });
  document.getElementById("viewGeometryIdsInput")?.addEventListener("change", (event) => {
    viewState.geometryIds = event.target.checked;
    draw();
  });
  function parameterScopeOptions() {
    if (blockEditor.current) return [{ key: `block:${blockEditor.current.draft.id}`, label: `${applicationText("ブロック", "Block")}: ${blockEditor.current.draft.name}`, namespace: model }];
    return [
      { key: "document", label: "Document", namespace: model },
      ...documentModel.blockDefinitions.map((definition) => ({ key: `block:${definition.id}`, label: `${applicationText("ブロック", "Block")}: ${definition.name}`, namespace: definition })),
    ];
  }

  function withStoredDefinitionAsModel(definition, callback) {
    const previousScope = model;
    activateEditingScope(definition);
    try {
      return callback();
    } finally {
      definition.nextHatchIndex = Math.max(hatchSeq, Number(definition.nextHatchIndex) || 1);
      activateEditingScope(previousScope);
    }
  }

  function stabilizeStoredBlockDefinition(definition) {
    return withStoredDefinitionAsModel(definition, () => stabilizeActiveParameterNamespace(definition.activeSketchId, { allSketches: blockDefinitionDrawableSketchIds(definition) }));
  }

  function rebuildRootConstraintObjects() {
    constraintRebinding.rebuildDocument(model, blockProjectionBundles());
    clearSelection();
  }

  function applyParameterDialogDraft() {
    const session = parameterDraft.current;
    if (!session) return false;
    const outcome = parameterApplication.apply(session, () => {
      recordHistory("Parameter変更");
      setHint(applicationText("Parameterを適用しました", "Parameters applied"));
      loadParameterDialogScope(session.key);
      updateUI();
      draw();
    });
    if (!outcome.success) {
      const { error } = outcome;
      const scopeKey = session.key;
      loadParameterDialogScope(scopeKey);
      setParameterDialogError(parameterErrorText(error));
      setHint(parameterErrorText(error), "error");
      updateUI();
      draw();
    }
    return outcome.success;
  }

  function pickParameterDialogDimension(event) {
    const rect = canvas.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    const point = canvasPoint(event);
    const hit = hitDimension(point.x, point.y);
    if (hit) insertClickedDimensionParameter(event, hit);
  }

  const applicationMenus = window.ApplicationMenus.create({ document, window, activateTool: id => document.getElementById(id)?.click() });
  const { close: closeAppMenus } = applicationMenus;
  applicationMenus.start();
  document.getElementById("togglePropertiesPanelBtn")?.addEventListener("click", () => {
    const workspace = document.querySelector(".workspace");
    setPropertiesPanelCollapsed(!workspace?.classList.contains("properties-collapsed"));
  });
  parameterDialogController.start();
  document.getElementById("documentSettingsBtn")?.addEventListener("click", () => {
    const fields = document.getElementById("documentAppearanceFields");
    if (fields) {
      const appearance = normalizeAppearance(documentModel.defaultAppearance, { partial: false });
      fields.innerHTML = appearancePropertyRows(appearance, appearance, { allowInheritance: false, idPrefix: "documentProperty" });
      localizeApplicationUI(fields);
      fields.onchange = (event) => {
        const input = event.target;
        if (!input.dataset.appearanceKey) return;
        applyAppearanceInput(documentModel.defaultAppearance, input.dataset.appearanceKey, input.value.trim());
        documentModel.defaultAppearance = normalizeAppearance(documentModel.defaultAppearance, { partial: false });
        recordHistory("Document Default Appearance変更");
        updateUI();
        draw();
      };
      fields.onclick = (event) => {
        const button = event.target.closest("[data-appearance-palette-open]");
        if (button) openAppearanceColorPalette(button, "document");
      };
    }
    const constructionFields = document.getElementById("documentConstructionAppearanceFields");
    if (constructionFields) {
      const appearance = normalizeConstructionAppearance(documentModel.defaultConstructionAppearance, { partial: false });
      const effective = { ...normalizeAppearance(documentModel.defaultAppearance, { partial: false }), ...appearance };
      constructionFields.innerHTML = appearancePropertyRows(appearance, effective, { allowInheritance: false, constructionEndpoints: true, idPrefix: "documentConstructionProperty" });
      localizeApplicationUI(constructionFields);
      constructionFields.onchange = (event) => {
        const input = event.target;
        if (!input.dataset.appearanceKey) return;
        applyAppearanceInput(documentModel.defaultConstructionAppearance, input.dataset.appearanceKey, input.value.trim());
        documentModel.defaultConstructionAppearance = normalizeConstructionAppearance(documentModel.defaultConstructionAppearance, { partial: false });
        recordHistory("Document Default Construction Appearance変更");
        updateUI();
        draw();
      };
      constructionFields.onclick = (event) => {
        const button = event.target.closest("[data-appearance-palette-open]");
        if (button) openAppearanceColorPalette(button, "document-construction");
      };
    }
    const dimensionFields = document.getElementById("documentDimensionAppearanceFields");
    if (dimensionFields) {
      const appearance = normalizeDimensionAppearance(documentModel.defaultDimensionAppearance, { partial: false });
      dimensionFields.innerHTML = dimensionAppearancePropertyRows(appearance, appearance, { allowInheritance: false, idPrefix: "documentDimension" });
      localizeApplicationUI(dimensionFields);
      updateDimensionTerminatorAngleVisibility(dimensionFields);
      const applyDimensionInput = (input, { history = true } = {}) => {
        if (!input.dataset.dimensionDisplay) return;
        const key = input.dataset.dimensionDisplay;
        const rawValue = ["prefix", "suffix"].includes(key) ? input.value : input.value.trim();
        applyDimensionAppearanceValue(documentModel.defaultDimensionAppearance, key, rawValue, { allowInheritance: false });
        documentModel.defaultDimensionAppearance = normalizeDimensionAppearance(documentModel.defaultDimensionAppearance, { partial: false });
        if (history) recordHistory("Document Default Dimension Appearance変更");
        draw();
      };
      dimensionFields.oninput = (event) => {
        if (["prefix", "suffix"].includes(event.target.dataset.dimensionDisplay)) applyDimensionInput(event.target, { history: false });
      };
      dimensionFields.onchange = (event) => {
        applyDimensionInput(event.target);
        updateDimensionTerminatorAngleVisibility(dimensionFields);
        updateUI();
      };
      dimensionFields.onclick = (event) => {
        const button = event.target.closest("[data-appearance-palette-open]");
        if (button) openAppearanceColorPalette(button, "document-dimension");
      };
    }
    document.getElementById("documentSettingsDialog")?.showModal();
  });
  appearancePalette.bind();
  applicationSettings.start();
  blockView.bind();

  document.getElementById("toolSelect").addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "select";
    lineCommand.reset();
    rectangleCommand.reset();
    filletCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("選択・ドラッグできます。Shift/Ctrlクリックで複数選択できます。");
    draw();
  });

  document.getElementById("toolPoint").addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "point";
    lineCommand.reset();
    rectangleCommand.reset();
    filletCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("キャンバスをクリックして点を追加します。");
    draw();
  });

  document.getElementById("toolLine").addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "line";
    lineCommand.reset();
    rectangleCommand.reset();
    filletCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("端点位置をクリックして連続線を作成します。終了はEscです。");
    draw();
  });

  document.getElementById("toolCenterline")?.addEventListener("click", startCenterlineCommand);
  document.getElementById("toolCircleCenterCross")?.addEventListener("click", startCircleCenterCrossCommand);
  document.getElementById("toolSketchProjection")?.addEventListener("click", startSketchProjectionCommand);
  document.getElementById("toolFreeInstance")?.addEventListener("click", () => startGeometryInstanceCommand("free"));
  document.getElementById("toolMirror")?.addEventListener("click", () => startGeometryInstanceCommand("mirror"));
  document.getElementById("toolPattern")?.addEventListener("click", () => startGeometryInstanceCommand("pattern"));

  document.getElementById("toolConstructionLine")?.addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    const primitives = selectedConstructionTogglePrimitives();
    if (primitives.length > 0) {
      if (!guardSketchProjectionShapeEdit(primitives, {
        includeSharedNodes: false,
        action: applicationText("通常／補助作図切替", "Construction toggle"),
      })) {
        draw();
        return;
      }
      const next = !primitives.every((item) => item.construction);
      for (const item of primitives) item.construction = next;
      synchronizeSketchProjectionMetadata();
      setHint(next ? "選択図形を補助作図にしました" : "選択図形を通常作図にしました");
      clearSelection();
      updateUI();
      draw();
      recordHistory("補助線切替");
      return;
    }
    mode = "line";
    constructionLineMode = !constructionLineMode;
    lineCommand.reset();
    rectangleCommand.reset();
    filletCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint(constructionLineMode ? "補助線作図: 端点位置をクリックしてください" : "通常線作図に戻しました");
    draw();
  });

  document.getElementById("toolRectangle")?.addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "rectangle";
    lineCommand.reset();
    rectangleCommand.reset();
    filletCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("矩形の1つ目の角をクリックしてください。Escで選択モードに戻ります");
    draw();
  });

  document.getElementById("toolSlot")?.addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "slot";
    lineCommand.reset();
    rectangleCommand.reset();
    resetSlotCommandState();
    filletCommand.reset();
    circularCommands.resetCircle();
    circularCommands.resetCenterArc();
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("長穴の1つ目の半円中心をクリックしてください。Escで選択モードに戻ります");
    draw();
  });

  document.getElementById("toolFillet")?.addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    if (canvasSelection.lines.length === 2) {
      if (startFilletRadiusPlacement(canvasSelection.lines[0], canvasSelection.lines[1], lastPointerWorld)) filletCommand.reset();
      return;
    }
    mode = "fillet";
    lineCommand.reset();
    rectangleCommand.reset();
    filletCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("R面取りする接続線を2本クリックしてください");
    draw();
  });

  document.getElementById("toolTrim")?.addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "trim";
    lineCommand.reset();
    rectangleCommand.reset();
    filletCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    pointerPreview = null;
    trimPreview = null;
    offsetSelection.reset();
    hoveredPoint = null;
    hoveredEndpointPoint = null;
    hoveredLine = null;
    hoveredCircle = null;
    hoveredArcEndpoint = null;
    hoveredArc = null;
    hoveredDimensionConstraint = null;
    clearSnap();
    updateToolbar();
    setHint("トリムする線、円、円弧の削除したい区間をクリックしてください。Escで選択モードに戻ります");
    draw();
  });

  document.getElementById("toolCreateBlock")?.addEventListener("click", startBlockCreation);

  document.getElementById("toolOffset")?.addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    cancelPendingCommand("");
    mode = "offset";
    lineCommand.reset();
    rectangleCommand.reset();
    filletCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    pointerPreview = null;
    trimPreview = null;
    offsetSelection.reset();
    const selected = [...canvasSelection.lines, ...canvasSelection.circles, ...canvasSelection.arcs];
    if (selected.length === 1 && selected[0] instanceof Circle) {
      offsetSelection.selectSource(selected[0]);
    } else if (selected.length === 1 && (selected[0] instanceof Line || selected[0] instanceof Arc)) {
      addOffsetChainGeometry(selected[0]);
      offsetSelection.commitSelection();
    } else {
      clearSelection();
    }
    clearSnap();
    updateToolbar();
    setHint(offsetSelection.source && (offsetSelection.source instanceof Circle || offsetSelection.committed)
      ? "オフセットする側と距離の目安をクリックしてください"
      : applicationText("オフセットする線または円弧を順番にクリックしてください。円は単独で選択します", "Select connected lines or arcs in order. Select a circle by itself."));
    updateUI();
    draw();
  });

  document.getElementById("toolCircle").addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "circle";
    lineCommand.reset();
    rectangleCommand.reset();
    filletCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("円の中心をクリックしてください。Escで選択モードに戻ります");
    draw();
  });

  document.getElementById("toolArc").addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "arc";
    lineCommand.reset();
    rectangleCommand.reset();
    filletCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("円弧の中心をクリックしてください。Escで選択モードに戻ります");
    draw();
  });

  document.getElementById("toolThreePointArc")?.addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "three-point-arc";
    lineCommand.reset();
    rectangleCommand.reset();
    filletCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("3点円弧の始点をクリックしてください。Escで選択モードに戻ります");
    draw();
  });

  document.getElementById("toolSpline")?.addEventListener("click", beginSplineCreation);

  document.getElementById("exportBtn").addEventListener("click", () => void saveJot2DFile());
  document.getElementById("saveAsBtn")?.addEventListener("click", () => void saveJot2DFileAs());
  document.getElementById("importBtn").addEventListener("click", () => void openJot2DFile());
  document.getElementById("documentFileInput")?.addEventListener("change", async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0] || null;
    input.value = "";
    if (!file || !fileSession.beginOpen()) return;
    try {
      if (!await confirmDocumentReplacement()) return;
      const opened = await importFileData(file, { expectedContentSignature: documentContentSignature(serializeModel()) });
      if (!opened) return;
      fileSession.setHandle(null);
      updateDocumentNameUI();
      const message = applicationText(`ファイルを開きました: ${file.name}`, `Opened: ${file.name}`);
      setHint(message);
      log(message);
    } catch (error) {
      setHint(applicationText(`ファイル読み込みに失敗しました: ${error.message}`, `Failed to open the file: ${error.message}`), "error");
    } finally {
      fileSession.finishOpen();
    }
  });
  document.getElementById("importReferenceImageBtn")?.addEventListener("click", () => document.getElementById("referenceImageFileInput")?.click());
  document.getElementById("referenceImageFileInput")?.addEventListener("change", (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0] || null;
    input.value = "";
    void importReferenceImageFile(file);
  });
  document.getElementById("addSketchBtn")?.addEventListener("click", () => createSketch("sibling"));
  document.getElementById("addChildSketchBtn")?.addEventListener("click", () => createSketch("child"));

  document.getElementById("toggleSideBtn")?.addEventListener("click", () => {
    const app = document.querySelector(".app");
    const isCollapsed = app?.classList.contains("side-collapsed");
    setSidebarCollapsed(!isCollapsed, isCollapsed ? "サイドバーを表示しました" : "サイドバーをたたみました");
  });

  for (const button of document.querySelectorAll("[data-sidebar-tab]")) {
    button.addEventListener("click", () => {
      const app = document.querySelector(".app");
      const isCollapsed = app?.classList.contains("side-collapsed");
      const isActive = button.classList.contains("active");
      if (isActive && !isCollapsed) {
        setSidebarCollapsed(true);
        return;
      }
      activateSidebarTab(button.dataset.sidebarTab);
      setSidebarCollapsed(false);
    });
  }

  for (const btn of constraintButtons) {
    btn.addEventListener("click", () => {
      const type = btn.dataset.constraint;
      if (pendingConstraintCommand?.type === type) {
        cancelConstraintTargetCommand(`${constraintLabel(type)}の対象選択をキャンセルしました`);
      } else if (type === "symmetry") {
        startConstraintTargetCommand(type);
      } else if (canApplyConstraint(type)) {
        cancelConstraintTargetCommand("");
        if (type === "distance") startDistanceCommand();
        else {
          cancelPendingCommand("");
          pendingConstraintCommand = { type };
          updateToolbar();
          updateConstraintButtons();
          addConstraint(type);
        }
      } else {
        startConstraintTargetCommand(type);
      }
    });
  }
  for (const btn of constraintMenuButtons) {
    btn.addEventListener("click", () => {
      const type = btn.dataset.menuConstraint;
      const target = type === "fixed"
        ? fixPointBtn
        : constraintButtons.find((candidate) => candidate.dataset.constraint === type);
      target?.click();
      btn.closest("details")?.removeAttribute("open");
    });
  }

  function toggleGeometryFixedOperand(operand) {
    const geometry = operand.element;
    if (!guardSketchProjectionShapeEdit([geometry], { action: applicationText("固定", "Fix") })) return false;
    let existing;
    let constraint;
    if (operand.kind === "line") {
      existing = findLineFixedConstraint(geometry);
      constraint = existing || new LineFixedConstraint(geometry);
    } else if (operand.kind === "arc-endpoint") {
      existing = findArcEndpointFixedConstraint(geometry, operand.endpoint);
      const position = arcEndpointPoint(geometry, operand.endpoint);
      constraint = existing || new ArcEndpointFixedConstraint(geometry, operand.endpoint, position.x, position.y);
    } else {
      existing = model.constraints.find((item) => item.enabled !== false && item instanceof GeometryFixedConstraint && sameConstraintDisplayElement(item.geometry, geometry));
      constraint = existing || new GeometryFixedConstraint(geometry);
    }
    if (existing) return deleteElements({ constraints: [existing] });
    return commitNewConstraint("fixed", constraint);
  }

  function toggleSelectedFixed() {
    const projectedSelection = [...canvasSelection.points, ...canvasSelection.lines, ...canvasSelection.circles, ...canvasSelection.arcs, ...canvasSelection.splines].filter((item) => item?.blockProjection);
    const projectedInstances = [...new Set(projectedSelection.map((item) => item.blockInstance))];
    const instance = canvasSelection.blockInstances.length === 1
      ? canvasSelection.blockInstances[0]
      : projectedSelection.length > 0 && projectedInstances.length === 1 && projectedSelection.length === canvasSelection.points.length + canvasSelection.lines.length + canvasSelection.circles.length + canvasSelection.arcs.length + canvasSelection.splines.length
        ? projectedInstances[0]
        : null;
    if (instance) {
      instance.fixed = !instance.fixed;
      setHint(`${blockDefinitionById(instance.definitionId)?.name || instance.id} を${instance.fixed ? "固定" : "固定解除"}しました`);
      clearSelection();
      updateUI();
      draw();
      recordHistory("ブロック固定切替");
      return true;
    }
    if (canvasSelection.arcEndpoint) {
      const { arc, endpoint } = canvasSelection.arcEndpoint;
      const existing = findArcEndpointFixedConstraint(arc, endpoint);
      if (existing) {
        deleteElements({ constraints: [existing] });
        log(`${arc.id}.${endpoint} の固定を解除しました`);
        return true;
      }
      const p = arcEndpointPoint(arc, endpoint);
      if (!guardSketchProjectionShapeEdit([arc], { action: applicationText("固定", "Fix") })) {
        draw();
        return false;
      }
      const snapshot = snapshotModelState();
      if (!commitNewConstraint("fixed", new ArcEndpointFixedConstraint(arc, endpoint, p.x, p.y))) {
        restoreModelState(snapshot);
        updateUI();
        draw();
        return false;
      }
      return true;
    }
    const batch = selectedFixedBatchTargets();
    if (!batch) return false;
    if (!guardSketchProjectionShapeEdit([...batch.points, ...batch.lines], { action: applicationText("固定", "Fix") })) {
      draw();
      return false;
    }
    const snapshot = snapshotModelState();
    const nextFixed = !fixedBatchIsFullyFixed(batch);
    for (const point of batch.points) point.fixed = nextFixed;
    if (nextFixed) {
      for (const line of batch.lines) if (!findLineFixedConstraint(line)) pushModelConstraint(new LineFixedConstraint(line), batch.sketchId);
    } else {
      const fixedConstraints = new Set(batch.lines.map(findLineFixedConstraint).filter(Boolean));
      for (let index = model.constraints.length - 1; index >= 0; index--) {
        if (fixedConstraints.has(model.constraints[index])) model.constraints.splice(index, 1);
      }
    }
    const solved = solveSketchAndDependents(batch.sketchId, snapshot);
    const fixedResult = solved.result;
    if (!solved.success || solved.dependent?.success === false || fixedResult.errorNorm > CONSTRAINT_ACCEPT_ERROR) {
      restoreModelState(snapshot);
      setHint(applicationText("選択対象の固定状態を変更できません。拘束や形状を確認してください", "The selected objects could not be fixed or unfixed. Check the constraints and geometry."), "error");
      updateUI();
      draw();
      return false;
    }
    refreshConstraintAnalysis();
    setHint(applicationText("固定状態を変更しました", "Fixed state updated"));
    updateUI({ refreshAnalysis: false });
    draw();
    const ids = [...batch.points, ...batch.lines].map((item) => item.id);
    log(`${ids.join(", ")} の固定状態を ${nextFixed} にしました\n自動solve: success=${fixedResult.success}`);
    recordHistory("固定状態変更");
    return true;
  }

  fixPointBtn.addEventListener("click", () => {
    if (!isGeometryMode()) return;
    if (pendingConstraintCommand?.type === "fixed") {
      cancelConstraintTargetCommand();
    } else if (!hasSelection()) {
      startConstraintTargetCommand("fixed");
    } else {
      toggleSelectedFixed();
    }
  });

  document.getElementById("toolHatch")?.addEventListener("click", startHatchCreation);

  window.addEventListener("resize", () => {
    closeCanvasContextMenu();
    resizeCanvas({ centerWorld: currentCanvasCenterWorld() });
  });

  function installTestHooks() {
    if (!new URLSearchParams(window.location.search).has("test")) return;
    window.__jot2dTest = {
      applicationThemeStateForTest() {
        return {
          theme: applicationSettings.theme,
          stored: applicationSettings.storedTheme(),
          defaultGeometryColor: DEFAULT_APPEARANCE.color,
          displayedDefaultGeometryColor: canvasThemeColor(DEFAULT_APPEARANCE.color),
          displayedDefaultGeometryContrast: applicationSettings.theme === "dark"
            ? canvasColorContrast(canvasColorChannels(canvasThemeColor(DEFAULT_APPEARANCE.color)), [15, 23, 42])
            : null,
        };
      },
      startInteractionProfileForTest() {
        flushScheduledCanvasPointerMove();
        interactionProfiler.start();
      },
      stopInteractionProfileForTest() {
        return interactionProfiler.stop();
      },
      resetInteractionFrameStatsForTest() {
        flushScheduledCanvasPointerMove();
        interactionFrameStats = {
          receivedMoves: 0,
          processedMoves: 0,
          coalescedMoves: 0,
          animationFrames: 0,
          synchronousFlushes: 0,
          canvasDraws: 0,
        };
        return { ...interactionFrameStats };
      },
      interactionFrameStatsForTest() {
        return interactionFrameStats
          ? { ...interactionFrameStats, pendingMove: Boolean(pendingCanvasPointerMove), frameScheduled: canvasPointerMoveFrame != null }
          : null;
      },
      resetForResponsiveLineDragTest() {
        sampleModel();
        fitAllGeometryToViewport(160);
        draw();
        resetHistory("responsive line drag test");
        return serializeModel();
      },
      resetForSplineTest() {
        resetModelState();
        viewport.update({ scale: 2 });
        resizeCanvas({ centerWorld: { x: 0, y: 0 } });
        resetHistory("spline test");
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        const client = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };
        return {
          clients: [
            client({ x: -90, y: 20 }),
            client({ x: -30, y: -45 }),
            client({ x: 30, y: 45 }),
            client({ x: 90, y: -20 }),
          ],
          serialized: serializeModel(),
        };
      },
      splineStateForTest() {
        const serialized = serializeModel();
        return {
          mode,
          editSplineId: splineEditSession?.spline?.id || null,
          direct: serialized.splines,
          selectedIds: canvasSelection.splines.map((spline) => spline.id),
          selectedPointIds: canvasSelection.points.map((point) => point.id),
          treeRows: document.querySelectorAll('#sketchList [data-object-kind="spline"]').length,
          propertiesText: document.getElementById("propertiesPanel")?.textContent || "",
          serialized,
        };
      },
      splineHatchPreviewCacheForTest() {
        resetModelState();
        const points = [
          addPoint(0, 0, false, "endpoint"), addPoint(100, 0, false, "endpoint"),
          addPoint(100, 80, false, "endpoint"), addPoint(0, 80, false, "endpoint"),
        ];
        const spline = addSpline(points, true, false);
        const seed = { x: 50, y: 40 };
        const before = hatchFaceAt(seed);
        points[1].x = 180;
        points[2].x = 180;
        const after = hatchFaceAt(seed);
        const maxX = (result) => result?.ok
          ? Math.max(...result.resolved.loops.flatMap((loop) => loop.points.map((point) => point.x)))
          : null;
        return { splineId: spline?.id || null, beforeOk: Boolean(before?.ok), afterOk: Boolean(after?.ok), beforeMaxX: maxX(before), afterMaxX: maxX(after) };
      },
      exerciseSplineTransferForTest() {
        const source = model.splines[0] || null;
        if (!source) return null;
        const leaderTarget = annotationLeaderTargetFromItem(source, window.SplineGeometry.evaluate(source.curve(), 0.5));
        const annotation = leaderTarget ? {
          id: `AN${annotationSeq++}`,
          type: "leader",
          visible: true,
          sketchId: activeSketchId(),
          geometryRef: leaderTarget.geometryRef,
          start: { ...leaderTarget.anchor },
          elbow: { x: leaderTarget.anchor.x + 30, y: leaderTarget.anchor.y - 20 },
          end: { x: leaderTarget.anchor.x + 80, y: leaderTarget.anchor.y - 20 },
          x: leaderTarget.anchor.x + 55,
          y: leaderTarget.anchor.y - 28,
          text: "Spline",
          style: { ...DEFAULT_ANNOTATION_STYLE },
        } : null;
        if (annotation) model.annotations.push(annotation);
        clearSelection();
        canvasSelection.set("splines", [source]);
        canvasSelection.set("annotations", annotation ? [annotation] : []);
        const payload = copyableSelectionPayload();
        geometryClipboard = payload;
        const pasted = payload && pasteGeometryClipboard() ? model.splines.find((item) => item !== source) : null;
        const sourceAnnotation = annotation ? model.annotations.find((item) => item.id === annotation.id) || null : null;
        const pastedAnnotation = annotation ? model.annotations.find((item) => item.id !== annotation.id) || null : null;

        clearSelection();
        canvasSelection.set("splines", [model.splines.find((item) => item.id === source.id) || source]);
        canvasSelection.set("annotations", sourceAnnotation ? [sourceAnnotation] : []);
        const selection = blockSelectionGeometry();
        const definition = selection.error ? null : createBlockDefinitionFromSelection(selection, blockSelectionBoundsCenter(selection), "Spline Transfer");
        if (definition) documentModel.blockDefinitions.push(definition);
        const instance = definition ? {
          id: `BI${blockInstanceSeq++}`,
          definitionId: definition.id,
          sketchId: activeSketchId(),
          x: 240,
          y: 80,
          rotation: Math.PI / 4,
          fixed: false,
          rotationLocked: false,
          enabledSketchIds: blockDefinitionDrawableSketchIds(definition),
          appearanceOverride: {},
        } : null;
        if (instance) model.blockInstances.push(instance);
        invalidateBlockProjectionCache();
        const projected = instance ? blockProjectionBundle(instance).splines?.[0] || null : null;
        updateUI();
        draw();
        return {
          copied: Boolean(payload),
          pasted: pasted ? { id: pasted.id, fitPoints: pasted.fitPoints.map((point) => point.id) } : null,
          leader: annotation ? { id: annotation.id, kind: annotation.geometryRef.kind, pastedId: pastedAnnotation?.id || null } : null,
          blockError: selection.error || null,
          definition: definition ? { id: definition.id, splineCount: definition.splines.length, pointCount: definition.points.length, annotationCount: definition.annotations.length } : null,
          projection: projected ? { id: projected.id, ownerId: projected.blockInstance?.id || null, fitPointCount: projected.fitPoints.length, annotationCount: blockProjectionBundle(instance).annotations.length } : null,
        };
      },
      exerciseSplineConstraintsForTest() {
        const spline = model.splines[0] || null;
        if (!spline || spline.closed) return null;
        const parameter = 0.4;
        const curvePoint = window.SplineGeometry.evaluate(spline.curve(), parameter);
        const point = addPoint(curvePoint.x, curvePoint.y, false, "explicit");
        const pointOnSpline = pushModelConstraint(new PointOnSplineConstraint(point, spline, parameter));
        const endpoint = spline.fitPoints[0];
        const tangent = window.SplineGeometry.derivative(spline.curve(), 0);
        const tangentLength = Math.hypot(tangent.x, tangent.y);
        const line = addLine(endpoint, addPoint(endpoint.x + tangent.x * 60 / tangentLength, endpoint.y + tangent.y * 60 / tangentLength, false, "endpoint"));
        const splineLineTangent = pushModelConstraint(new SplineLineTangentConstraint(spline, "start", line));
        const result = solveAndRefresh("spline constraint test");
        const serialized = serializeModel();
        return {
          success: result?.success !== false,
          types: serialized.constraints.filter((item) => ["pointOnSpline", "splineLineTangent"].includes(item.type)).map((item) => item.type),
          pointOnSpline: serializeConstraint(pointOnSpline),
          splineLineTangent: serializeConstraint(splineLineTangent),
          serialized,
        };
      },
      resetForHatchTest() {
        resetModelState();
        viewport.update({ scale: 1 });
        const points = [
          addPoint(0, 0, false, "endpoint"), addPoint(120, 0, false, "endpoint"),
          addPoint(120, 80, false, "endpoint"), addPoint(0, 80, false, "endpoint"),
        ];
        addLine(points[0], points[1]);
        addLine(points[1], points[2]);
        addLine(points[2], points[3]);
        addLine(points[3], points[0]);
        fitSketchToViewport(activeSketchId(), 160);
        resetHistory("hatch test");
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        const screen = worldToCanvasScreen({ x: 60, y: 40 });
        const boundaryScreen = worldToCanvasScreen({ x: 60, y: 0 });
        return {
          client: { x: rect.left + screen.x, y: rect.top + screen.y },
          boundaryClient: { x: rect.left + boundaryScreen.x, y: rect.top + boundaryScreen.y },
          serialized: serializeModel(),
        };
      },
      resetForDrawingOrderTest() {
        resetModelState();
        viewport.update({ scale: 3 });
        const corners = [
          addPoint(0, 0, false, "endpoint"), addPoint(120, 0, false, "endpoint"),
          addPoint(120, 80, false, "endpoint"), addPoint(0, 80, false, "endpoint"),
        ];
        const boundaryLines = [[0, 1], [1, 2], [2, 3], [3, 0]].map(([first, second]) => {
          const line = addLine(corners[first], corners[second]);
          line.appearance = { color: "#008000", lineWidth: 4 };
          return line;
        });
        const face = findHatchFaceInIndex(createHatchRegionIndex(hatchPrimitivesForScope(model, DEFAULT_SKETCH_ID)), { x: 60, y: 40 });
        const crossLine = addLine(addPoint(20, 40, false, "endpoint"), addPoint(100, 40, false, "endpoint"));
        crossLine.appearance = { color: "#ff0000", lineWidth: 4 };
        const hatch = {
          id: "H1",
          sketchId: DEFAULT_SKETCH_ID,
          drawingOrder: null,
          seed: { x: 60, y: 25 },
          boundaryLoops: face.boundaryLoops,
          appearance: { ...DEFAULT_HATCH_APPEARANCE, patternType: "solid", color: "#0000ff", opacity: 1 },
        };
        model.hatches.push(hatch);
        model.nextHatchIndex = 2;

        const definition = createEmptyBlockDefinition("Drawing Order Block");
        const bp1 = new Point("BP1", 20, 62, false, "endpoint");
        const bp2 = new Point("BP2", 45, 62, false, "endpoint");
        bp1.sketchId = DEFAULT_SKETCH_ID;
        bp2.sketchId = DEFAULT_SKETCH_ID;
        const blockLine = new Line("BL1", bp1, bp2);
        blockLine.sketchId = DEFAULT_SKETCH_ID;
        definition.points.push(bp1, bp2);
        definition.lines.push(blockLine);
        documentModel.blockDefinitions.push(definition);
        const block = { id: "BI1", definitionId: definition.id, sketchId: DEFAULT_SKETCH_ID, x: 0, y: 0, rotation: 0, fixed: false, rotationLocked: false, enabledSketchIds: [DEFAULT_SKETCH_ID], appearanceOverride: {} };
        model.blockInstances.push(block);
        const derived = normalizeGeometryInstance({ id: "MI1", type: "mirror", sketchId: DEFAULT_SKETCH_ID, sources: [geometryRefForItem(crossLine)], axis: geometryRefForItem(boundaryLines[3]), appearanceOverride: {} });
        model.geometryInstances.push(derived);

        model.sketches.push({ id: "S2", name: "Other Sketch", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {}, visible: true });
        model.activeSketchId = "S2";
        const otherLine = addLine(addPoint(15, 65, false, "endpoint"), addPoint(105, 65, false, "endpoint"));
        model.activeSketchId = DEFAULT_SKETCH_ID;
        ensureDrawingOrderState(model);
        invalidateBlockProjectionCache();
        fitSketchToViewport(DEFAULT_SKETCH_ID, 160);
        resetHistory("drawing order test");
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        const client = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };
        return {
          hatchClient: client({ x: 60, y: 25 }),
          centerClient: client({ x: 60, y: 40 }),
          boundaryClient: client({ x: 60, y: 0 }),
          insideBoundaryClient: client({ x: 60, y: 3 }),
          crossLineId: crossLine.id,
          otherLineId: otherLine.id,
          serialized: serializeModel(),
        };
      },
      drawingOrderStateForTest() {
        ensureDrawingOrderState(model);
        const kindFor = (item) => model.hatches.includes(item) ? "hatch"
          : model.lines.includes(item) ? "line"
          : model.circles.includes(item) ? "circle"
          : model.arcs.includes(item) ? "arc"
          : model.splines.includes(item) ? "spline"
          : model.blockInstances.includes(item) ? "block"
          : "geometry-instance";
        const bySketch = Object.fromEntries(model.sketches.filter((sketch) => !isRootSketch(sketch)).map((sketch) => [sketch.id,
          drawingOrderItemsForScope(model, sketch.id)
            .slice()
            .sort((a, b) => a.drawingOrder - b.drawingOrder)
            .map((item) => ({ kind: kindFor(item), id: item.id, drawingOrder: item.drawingOrder })),
        ]));
        const firstHatch = model.hatches[0] || null;
        const resolved = firstHatch ? resolvedHatchBoundary(firstHatch) : null;
        return {
          bySketch,
          serialized: structuredClone(serializeModel()),
          hatchBoundaryHitExclusionScreenPx: firstHatch ? hatchBoundaryHitExclusionScreenPx(firstHatch) : null,
          hatchSelectableAtBoundary: firstHatch && resolved ? hatchContainsSelectablePoint(firstHatch, resolved, { x: 60, y: 0 }) : null,
          history: this.historyState(),
        };
      },
      selectDrawingOrderObjectForTest(kind, id) {
        clearSelection();
        if (kind === "line") canvasSelection.set("lines", model.lines.filter((item) => item.id === id));
        else if (kind === "hatch") canvasSelection.set("hatches", model.hatches.filter((item) => item.id === id));
        else if (kind === "block") canvasSelection.set("blockInstances", model.blockInstances.filter((item) => item.id === id));
        else if (kind === "geometry-instance") canvasSelection.set("geometryInstances", model.geometryInstances.filter((item) => item.id === id));
        updateUI({ refreshAnalysis: false });
        draw();
        return this.drawingOrderStateForTest();
      },
      reorderDrawingOrderForTest(action) {
        reorderSelectedDrawingObjects(action);
        return this.drawingOrderStateForTest();
      },
      resetForSolidHatchHoleTest() {
        resetModelState();
        viewport.update({ scale: 1 });
        const corners = [
          addPoint(0, 0, false, "endpoint"), addPoint(120, 0, false, "endpoint"),
          addPoint(120, 80, false, "endpoint"), addPoint(0, 80, false, "endpoint"),
        ];
        addLine(corners[0], corners[1]);
        addLine(corners[1], corners[2]);
        addLine(corners[2], corners[3]);
        addLine(corners[3], corners[0]);
        addCircle(addPoint(60, 40, false, "center"), 20, false);
        const face = findHatchFaceInIndex(createHatchRegionIndex(hatchPrimitivesForScope(model, DEFAULT_SKETCH_ID)), { x: 20, y: 40 });
        model.hatches.push({ id: "H1", sketchId: DEFAULT_SKETCH_ID, seed: { x: 20, y: 40 }, boundaryLoops: face.boundaryLoops, appearance: { ...DEFAULT_HATCH_APPEARANCE, patternType: "solid", color: "#0f766e" } });
        model.nextHatchIndex = 2;
        fitSketchToViewport(activeSketchId(), 160);
        resetHistory("solid hatch hole test");
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        const clientPoint = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };
        return { fillClient: clientPoint({ x: 20, y: 40 }), holeClient: clientPoint({ x: 65, y: 40 }) };
      },
      resetForProjectedHatchTest() {
        resetModelState();
        const child = createEmptyBlockDefinition("Hatch Child");
        const childPoints = [
          new Point("P1", 0, 0, false, "endpoint"), new Point("P2", 100, 0, false, "endpoint"),
          new Point("P3", 100, 60, false, "endpoint"), new Point("P4", 0, 60, false, "endpoint"),
        ];
        childPoints.forEach((point) => { point.sketchId = DEFAULT_SKETCH_ID; });
        child.points.push(...childPoints);
        [[0, 1], [1, 2], [2, 3], [3, 0]].forEach(([a, b], index) => {
          const line = new Line(`L${index + 1}`, childPoints[a], childPoints[b]);
          line.sketchId = DEFAULT_SKETCH_ID;
          child.lines.push(line);
        });
        const face = findHatchFaceInIndex(createHatchRegionIndex(hatchPrimitivesForScope(child, DEFAULT_SKETCH_ID)), { x: 50, y: 30 });
        child.hatches = [{ id: "H1", sketchId: DEFAULT_SKETCH_ID, seed: { x: 50, y: 30 }, boundaryLoops: face.boundaryLoops, appearance: { ...DEFAULT_HATCH_APPEARANCE, patternType: "cross" } }];
        child.nextHatchIndex = 2;

        const parent = createEmptyBlockDefinition("Hatch Parent");
        child.parentDefinitionId = parent.id;
        parent.blockInstances.push({ id: "BI_INNER", definitionId: child.id, sketchId: DEFAULT_SKETCH_ID, x: 20, y: 10, rotation: Math.PI / 6, fixed: false, rotationLocked: false, enabledSketchIds: [DEFAULT_SKETCH_ID], appearanceOverride: {} });
        documentModel.blockDefinitions.push(child, parent);
        const instance = { id: "BI1", definitionId: parent.id, sketchId: DEFAULT_SKETCH_ID, x: 240, y: 180, rotation: Math.PI / 2, fixed: false, rotationLocked: false, enabledSketchIds: [DEFAULT_SKETCH_ID], appearanceOverride: { color: "#db2777", lineWidth: 3, visible: true } };
        model.blockInstances.push(instance);
        invalidateBlockProjectionCache();
        updateUI();
        fitAllGeometryToViewport(160);
        const projected = blockProjectionBundle(instance).hatches[0];
        const rect = canvas.getBoundingClientRect();
        const screen = worldToCanvasScreen(projected.seed);
        draw();
        return {
          projected: { id: projected.id, patternType: projected.appearance.patternType, angle: projected.appearance.angle, color: projected.appearance.color, lineWidth: projected.appearance.lineWidth, valid: resolvedHatchBoundary(projected).ok },
          ownerAtSeed: hitBlockInstance(projected.seed.x, projected.seed.y)?.id || null,
          client: { x: rect.left + screen.x, y: rect.top + screen.y },
          serialized: serializeModel(),
        };
      },
      projectedHatchStateForTest() {
        const projected = allHatches().find((hatch) => hatch.blockProjection) || null;
        return projected ? { id: projected.id, patternType: projected.appearance.patternType, angle: projected.appearance.angle, color: projected.appearance.color, lineWidth: projected.appearance.lineWidth, valid: resolvedHatchBoundary(projected).ok, ownerId: projected.blockInstance?.id || null } : null;
      },
      exerciseHatchTransferForTest() {
        const hatch = model.hatches[0];
        const boundaryLines = model.lines.slice();
        clearSelection();
        canvasSelection.set("hatches", hatch ? [hatch] : []);
        const missingCopyAccepted = Boolean(copyableSelectionPayload());
        canvasSelection.set("lines", boundaryLines);
        const payload = copyableSelectionPayload();
        geometryClipboard = payload;
        const pasteAccepted = Boolean(payload && pasteGeometryClipboard());
        const pasted = model.hatches.find((item) => item !== hatch);
        const pastedRefs = pasted ? hatchBoundaryGeometryRefs(pasted.boundaryLoops).map(geometryRefId) : [];

        clearSelection();
        canvasSelection.set("hatches", hatch ? [hatch] : []);
        const missingBlock = blockSelectionGeometry();
        canvasSelection.set("lines", boundaryLines);
        const selection = blockSelectionGeometry();
        const definition = selection.error ? null : createBlockDefinitionFromSelection(selection, blockSelectionBoundsCenter(selection), "Hatch Transfer");
        const blockHatch = definition?.hatches?.[0] || null;
        const blockBoundary = blockHatch ? resolveHatchBoundaryLoops(blockHatch.boundaryLoops, hatchPrimitivesForScope(definition, blockHatch.sketchId)) : null;
        return {
          missingCopyAccepted,
          pasteAccepted,
          pasted: pasted ? { id: pasted.id, refs: pastedRefs, valid: resolvedHatchBoundary(pasted).ok } : null,
          missingBlockError: missingBlock.error || null,
          block: blockHatch ? { id: blockHatch.id, valid: Boolean(blockBoundary?.ok) } : null,
        };
      },
      hatchStateForTest() {
        return {
          mode,
          direct: model.hatches.map((hatch) => {
            const resolved = resolvedHatchBoundary(hatch);
            return { ...serializeHatch(hatch), valid: resolved.ok, reason: resolved.ok ? null : hatchRegionErrorText(resolved) };
          }),
          selectedIds: canvasSelection.hatches.map((hatch) => hatch.id),
          preview: hatchPreview ? { ok: Boolean(hatchPreview.result?.ok), code: hatchPreview.result?.code || null } : null,
          serialized: serializeModel(),
          treeHatchRows: document.querySelectorAll('#sketchList [data-object-kind="hatch"]').length,
          propertiesText: document.getElementById("propertiesPanel")?.textContent || "",
          spacingWorldAtScale: model.hatches[0] ? model.hatches[0].appearance.spacing * HATCH_SCREEN_PX_PER_MM / viewport.scale : null,
        };
      },
      setViewportScaleForHatchTest(scale) {
        viewport.update({ scale: Math.max(0.01, Number(scale) || 1) });
        draw();
        return model.hatches[0] ? model.hatches[0].appearance.spacing * HATCH_SCREEN_PX_PER_MM / viewport.scale : null;
      },
      breakFirstHatchBoundaryForTest() {
        if (!model.lines.length) return false;
        model.lines.splice(0, 1);
        updateUI({ refreshAnalysis: false });
        draw();
        return true;
      },
      restoreClosedBoundaryForHatchTest() {
        const first = model.points.find((point) => Math.abs(point.x) < 1e-9 && Math.abs(point.y) < 1e-9);
        const second = model.points.find((point) => Math.abs(point.x - 120) < 1e-9 && Math.abs(point.y) < 1e-9);
        if (!first || !second) return null;
        const line = addLine(first, second);
        updateUI({ refreshAnalysis: false });
        draw();
        const rect = canvas.getBoundingClientRect();
        const screen = worldToCanvasScreen({ x: 60, y: 40 });
        return { id: line?.id || null, client: { x: rect.left + screen.x, y: rect.top + screen.y } };
      },
      commitConstraintWithForcedSolveResultForTest(forcedResult) {
        resetModelState();
        const p1 = addPoint(0, 0, true, "endpoint");
        const p2 = addPoint(10, 0, false, "endpoint");
        const constraint = new DistanceConstraint(p1, p2, 10);
        const solveSubset = solver.solveSubset;
        solver.solveSubset = () => ({
          success: Boolean(forcedResult?.success),
          errorNorm: Number(forcedResult?.errorNorm),
          iterations: Number(forcedResult?.iterations) || 0,
          reason: String(forcedResult?.reason || "test"),
          variableCount: 2,
          constraintCount: 1,
        });
        let committed = false;
        try {
          committed = commitNewConstraint("distance", constraint) === true;
        } finally {
          solver.solveSubset = solveSubset;
        }
        const hint = document.getElementById("hint");
        return {
          committed,
          constraintCount: model.constraints.length,
          hint: hint?.textContent || "",
          hintIsError: Boolean(hint?.classList.contains("error")),
        };
      },
      resetForGeometryClipboardTest() {
        resetModelState();
        geometryClipboard = null;
        viewport.update({ scale: 1 });
        model.sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
        const p1 = addPoint(-120, -30, true, "endpoint");
        const p2 = addPoint(-20, -30, false, "endpoint");
        const line = addLine(p1, p2, true);
        const circleCenter = addPoint(50, -30, false, "endpoint");
        const circle = addCircle(circleCenter, 25);
        const arcCenter = addPoint(125, -30, false, "endpoint");
        const arc = addArc(arcCenter, 30, 0, Math.PI * 1.5);
        const standalone = addPoint(205, -30, false, "explicit");
        const external = addPoint(-20, 40, false, "explicit");
        pushModelConstraint(new HorizontalConstraint(line));
        const length = pushModelConstraint(new DistanceConstraint(p1, p2, 100));
        length.dimension = dimensionFromAnchor({ kind: "line-length", line, p1, p2, value: 100 }, { x: -70, y: -58 });
        pushModelConstraint(new RadiusConstraint(circle, 25));
        pushModelConstraint(new EqualRadiusConstraint(circle, arc));
        pushModelConstraint(new PointVerticalConstraint(p2, external));
        pushModelConstraint(new LineFixedConstraint(line, p1.x, p1.y, p2.x, p2.y));
        const fixedArcEndpoint = arcEndpointPoint(arc, "start");
        pushModelConstraint(new ArcEndpointFixedConstraint(arc, "start", fixedArcEndpoint.x, fixedArcEndpoint.y));
        canvasSelection.set("points", [standalone]);
        canvasSelection.set("lines", [line]);
        canvasSelection.set("circles", [circle]);
        canvasSelection.set("arcs", [arc]);
        resetHistory("clipboard geometry test");
        updateUI();
        draw();
        return this.clipboardStateForTest();
      },
      resetForBlockClipboardTest() {
        resetModelState();
        geometryClipboard = null;
        viewport.update({ scale: 1 });
        model.sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
        const definition = createEmptyBlockDefinition("Clipboard Block");
        const bp1 = new Point("BP1", 0, 0, false, "endpoint");
        const bp2 = new Point("BP2", 80, 0, false, "endpoint");
        bp1.sketchId = DEFAULT_SKETCH_ID;
        bp2.sketchId = DEFAULT_SKETCH_ID;
        const blockLine = new Line("BL1", bp1, bp2);
        blockLine.sketchId = DEFAULT_SKETCH_ID;
        definition.points.push(bp1, bp2);
        definition.lines.push(blockLine);
        definition.constraints.push(Object.assign(new HorizontalConstraint(blockLine), { sketchId: DEFAULT_SKETCH_ID }));
        documentModel.blockDefinitions.push(definition);
        const instance = { id: `BI${blockInstanceSeq++}`, definitionId: definition.id, sketchId: DEFAULT_SKETCH_ID, x: 10, y: 20, rotation: 0, fixed: true, rotationLocked: true, enabledSketchIds: [DEFAULT_SKETCH_ID] };
        model.blockInstances.push(instance);
        invalidateBlockProjectionCache();
        const projectionLine = blockProjectionBundle(instance).lines[0];
        pushModelConstraint(new HorizontalConstraint(projectionLine));
        canvasSelection.set("blockInstances", [instance]);
        resetHistory("clipboard block test");
        updateUI();
        draw();
        return this.clipboardStateForTest();
      },
      clipboardStateForTest() {
        const serialized = serializeModel();
        const geometryBySketch = Object.fromEntries(model.sketches.filter((sketch) => !isRootSketch(sketch)).map((sketch) => [sketch.id, {
          points: model.points.filter((item) => elementSketchId(item) === sketch.id).map((item) => ({ id: item.id, x: item.x, y: item.y, kind: item.kind, fixed: Boolean(item.fixed) })),
          lines: model.lines.filter((item) => elementSketchId(item) === sketch.id).map((item) => ({ id: item.id, p1: item.p1.id, p2: item.p2.id })),
          circles: model.circles.filter((item) => elementSketchId(item) === sketch.id).map((item) => ({ id: item.id, center: item.center.id, radius: item.radius() })),
          arcs: model.arcs.filter((item) => elementSketchId(item) === sketch.id).map((item) => ({ id: item.id, center: item.center.id, radius: item.radius() })),
          splines: model.splines.filter((item) => elementSketchId(item) === sketch.id).map((item) => ({ id: item.id, fitPoints: item.fitPoints.map((point) => point.id), closed: item.closed })),
          blockInstances: model.blockInstances.filter((item) => item.sketchId === sketch.id).map((item) => ({ id: item.id, x: item.x, y: item.y, definitionId: item.definitionId, fixed: Boolean(item.fixed), rotationLocked: Boolean(item.rotationLocked) })),
        }]));
        return {
          activeSketchId: activeSketchId(),
          geometryBySketch,
          constraints: serialized.constraints.map((item) => ({ type: item.type, sketchId: item.sketchId, line: item.line || null, reference: Boolean(item.reference), dimension: item.dimension || null })),
          selected: this.selectedGeometryIdsForTest(),
          selectedBlockInstanceIds: canvasSelection.blockInstances.map((item) => item.id),
          clipboard: geometryClipboard ? {
            pasteCount: geometryClipboard.pasteCount,
            points: geometryClipboard.points.length,
            lines: geometryClipboard.lines.length,
            circles: geometryClipboard.circles.length,
            arcs: geometryClipboard.arcs.length,
            splines: geometryClipboard.splines.length,
            constraints: geometryClipboard.constraints.length,
            blockInstances: geometryClipboard.blockInstances.length,
          } : null,
          history: this.historyState(),
        };
      },
      documentNameState() {
        return {
          modelName: documentModel.documentName,
          displayName: effectiveDocumentName(),
          serializedName: serializeModel().documentName,
          title: document.title,
        };
      },
      fileSystemAccessStateForTest() {
        return {
          hasHandle: Boolean(fileSession.handle),
          handleName: fileSession.handle?.name || null,
        };
      },
      serializedModelForTest() {
        return structuredClone(serializeModel());
      },
      loadModelForDerivedInstanceTest(data) {
        loadModelData(structuredClone(data));
        updateUI();
        draw();
        return this.derivedInstanceStateForTest();
      },
      resetForDerivedInstanceTest() {
        resetModelState();
        const sourceCircle = addCircle(addPoint(-25, -20, false, "endpoint"), 8, false);
        model.sketches.push({ id: "S2", name: "Derived Target", parentSketchId: DEFAULT_SKETCH_ID, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {}, visible: true });
        model.activeSketchId = "S2";
        const sourceLine = addLine(addPoint(-40, 10, false, "endpoint"), addPoint(-10, 30, false, "endpoint"), false);
        const sourceArc = addArc(addPoint(-55, -25, false, "endpoint"), 9, 3, 3.5, false);
        const axis = addLine(addPoint(0, -50, false, "endpoint"), addPoint(0, 50, false, "endpoint"), true);
        const direction = addLine(addPoint(20, -40, false, "endpoint"), addPoint(60, -40, false, "endpoint"), true);
        const projection = normalizeGeometryInstance({ id: `SPI${sketchProjectionInstanceSeq++}`, type: "sketchProjection", sketchId: activeSketchId(), sources: [geometryRefForItem(sourceCircle)] });
        const mirror = normalizeGeometryInstance({ id: `MI${mirrorInstanceSeq++}`, type: "mirror", sketchId: activeSketchId(), sources: [geometryRefForItem(sourceLine), parseGeometryRefId("circle", `${projection.id}@${sourceCircle.id}`), geometryRefForItem(sourceArc)], axis: geometryRefForItem(axis) });
        const pattern = normalizeGeometryInstance({ id: `PI${patternInstanceSeq++}`, type: "pattern", sketchId: activeSketchId(), sources: [geometryRefForItem(sourceLine)], direction: geometryRefForItem(direction), spacing: 15, copies: 3, reversed: false });
        model.geometryInstances.push(projection, mirror, pattern);
        const projectedCircleFace = findHatchFaceInIndex(createHatchRegionIndex(hatchPrimitivesForScope(model, activeSketchId())), { x: sourceCircle.center.x, y: sourceCircle.center.y });
        if (projectedCircleFace) model.hatches.push({ id: "H1", sketchId: activeSketchId(), seed: { x: sourceCircle.center.x, y: sourceCircle.center.y }, boundaryLoops: projectedCircleFace.boundaryLoops, appearance: { ...DEFAULT_HATCH_APPEARANCE } });
        resetHistory("derived instance test");
        updateUI();
        draw();
        return this.derivedInstanceStateForTest();
      },
      resetForGeometryInstanceCommandTest() {
        resetModelState();
        const source = addLine(addPoint(-55, 15, false, "endpoint"), addPoint(-25, 35, false, "endpoint"), false);
        const axis = addLine(addPoint(0, -55, false, "endpoint"), addPoint(0, 55, false, "endpoint"), true);
        const direction = addLine(addPoint(25, -40, false, "endpoint"), addPoint(65, -40, false, "endpoint"), true);
        this.focusWorldForTest({ x: 0, y: 0 }, 2.5);
        resetHistory("geometry instance command test");
        updateUI();
        draw();
        return {
          sourceId: source.id,
          axis: this.worldClientPositionForTest({ x: (axis.p1.x + axis.p2.x) / 2, y: (axis.p1.y + axis.p2.y) / 2 }),
          direction: this.worldClientPositionForTest({ x: (direction.p1.x + direction.p2.x) / 2, y: (direction.p1.y + direction.p2.y) / 2 }),
        };
      },
      derivedInstanceStateForTest() {
        return {
          serialized: structuredClone(serializeModel()),
          instances: model.geometryInstances.map((instance) => {
            const bundle = geometryInstanceBundle(instance);
            return {
              id: instance.id,
              type: instance.type,
              valid: bundle.valid,
              reason: bundle.reason,
              points: bundle.points.map((point) => ({ id: point.id, x: point.x, y: point.y })),
              lines: bundle.lines.map((line) => ({ id: line.id, p1: { x: line.p1.x, y: line.p1.y }, p2: { x: line.p2.x, y: line.p2.y }, color: constraintStatusColor(line) })),
              circles: bundle.circles.map((circle) => ({ id: circle.id, center: { x: circle.center.x, y: circle.center.y }, radius: circle.radius(), color: constraintStatusColor(circle) })),
              arcs: bundle.arcs.map((arc) => ({ id: arc.id, startAngle: arc.startAngle, endAngle: arc.endAngle, sweep: arcSweep(arc), color: constraintStatusColor(arc) })),
            };
          }),
          selectedIds: canvasSelection.geometryInstances.map((instance) => instance.id),
          selectedGeometry: canvasSelection.instanceGeometry ? { ...canvasSelection.instanceGeometry } : null,
          hatchValidity: model.hatches.map((hatch) => resolvedHatchBoundary(hatch).ok),
          treeCount: document.querySelectorAll('#sketchList [data-object-kind="instance"]').length,
          propertiesText: document.getElementById("propertiesPanel")?.textContent || "",
        };
      },
      deleteDerivedSourceForTest() {
        const source = model.lines.find((line) => line.id === "L1");
        return { deleted: source ? deleteElements({ lines: [source] }) : false, state: this.derivedInstanceStateForTest(), hint: document.getElementById("hint")?.textContent || "" };
      },
      deleteDerivedInstanceForTest(id) {
        canvasSelection.set("geometryInstances", model.geometryInstances.filter((instance) => instance.id === id));
        return { deleted: deleteCurrentSelection(), state: this.derivedInstanceStateForTest(), hint: document.getElementById("hint")?.textContent || "" };
      },
      resetForSketchProjectionTest() {
        resetModelState();
        const sourceSketchId = DEFAULT_SKETCH_ID;
        model.activeSketchId = sourceSketchId;
        const explicitPoint = addPoint(-105, 65, false, "explicit");
        const shared = addPoint(-40, -55, false, "endpoint");
        const line1 = addLine(addPoint(-95, -55, false, "endpoint"), shared, false);
        const line2 = addLine(shared, addPoint(-40, -15, false, "endpoint"), true);
        const circle = addCircle(explicitPoint, 18, false);
        const arc = addArc(addPoint(62, 48, false, "endpoint"), 19, -0.2, 1.35, true);
        const spline = addSpline([
          addPoint(-5, -8, false, "endpoint"),
          addPoint(28, -32, false, "endpoint"),
          addPoint(65, -8, false, "endpoint"),
          addPoint(98, -30, false, "endpoint"),
        ], false, false);
        const targetSketch = { id: "S3", name: "Projection Target", parentSketchId: sourceSketchId, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {}, visible: true };
        model.sketches.push(targetSketch);
        model.activeSketchId = targetSketch.id;
        this.focusWorldForTest({ x: 0, y: 0 }, 2.2);
        resetHistory("sketch projection test");
        updateUI();
        draw();
        const client = (point) => this.worldClientPositionForTest(point);
        const splinePoint = window.SplineGeometry.evaluate(spline.curve(), 0.5);
        return {
          sourceSketchId,
          targetSketchId: targetSketch.id,
          ids: { point: explicitPoint.id, lines: [line1.id, line2.id], circle: circle.id, arc: arc.id, spline: spline.id },
          clients: {
            point: client(explicitPoint),
            line1: client({ x: (line1.p1.x + line1.p2.x) / 2, y: (line1.p1.y + line1.p2.y) / 2 }),
            line2: client({ x: (line2.p1.x + line2.p2.x) / 2, y: (line2.p1.y + line2.p2.y) / 2 }),
            circle: client({ x: circle.center.x + circle.radius(), y: circle.center.y }),
            arc: client({ x: arc.center.x + arc.radius() * Math.cos(0.6), y: arc.center.y + arc.radius() * Math.sin(0.6) }),
            spline: client(splinePoint),
          },
        };
      },
      resetForSketchProjectionRectangleTest({ reloadSharedVersion19 = false } = {}) {
        resetModelState();
        const sourceSketchId = DEFAULT_SKETCH_ID;
        const corners = [
          addPoint(-60, -40, false, "endpoint"),
          addPoint(60, -40, false, "endpoint"),
          addPoint(60, 40, false, "endpoint"),
          addPoint(-60, 40, false, "endpoint"),
        ];
        const sourceLines = corners.map((point, index) => addLine(point, corners[(index + 1) % corners.length], false));
        const targetSketchId = "S3";
        model.sketches.push({ id: targetSketchId, name: "Projection Target", parentSketchId: sourceSketchId, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {}, visible: true });
        model.activeSketchId = targetSketchId;
        for (const source of sourceLines) {
          const target = createSketchProjectionTarget({ item: source, kind: "line", sketchId: sourceSketchId }, targetSketchId);
          const constraint = new SketchProjectionConstraint("line", source, target);
          markReferenceConstraint(constraint, sourceSketchId, targetSketchId);
          pushModelConstraint(constraint, targetSketchId);
        }
        synchronizeSketchProjectionMetadata(targetSketchId);
        solveSketchAndDependents(sourceSketchId);
        if (reloadSharedVersion19) {
          const data = structuredClone(serializeModel());
          const linesById = new Map(data.lines.map((line) => [String(line.id), line]));
          const targetPointBySourcePoint = new Map();
          const orphanedTargetPointIds = new Set();
          for (const link of data.constraints.filter((constraint) => constraint.type === "sketchProjection" && constraint.kind === "line")) {
            const source = linesById.get(String(link.source));
            const target = linesById.get(String(link.target));
            if (!source || !target) continue;
            for (const key of ["p1", "p2"]) {
              const sourcePointId = String(source[key]);
              const existingTargetPointId = targetPointBySourcePoint.get(sourcePointId);
              if (existingTargetPointId) {
                orphanedTargetPointIds.add(String(target[key]));
                target[key] = existingTargetPointId;
              } else {
                targetPointBySourcePoint.set(sourcePointId, String(target[key]));
              }
            }
          }
          data.points = data.points.filter((point) => !orphanedTargetPointIds.has(String(point.id)));
          loadModelData(data);
        }
        resetHistory("sketch projection rectangle test");
        updateUI();
        draw();
        return this.sketchProjectionStateForTest();
      },
      resetForSketchProjectionSharedKindsTest({ reloadSharedVersion19 = false } = {}) {
        resetModelState();
        const sourceSketchId = DEFAULT_SKETCH_ID;
        const shared = addPoint(-45, -20, false, "explicit");
        const sourceEntries = [
          { item: shared, kind: "point", sketchId: sourceSketchId },
          { item: addLine(shared, addPoint(30, -20, false, "endpoint"), false), kind: "line", sketchId: sourceSketchId },
          { item: addCircle(shared, 18, false), kind: "circle", sketchId: sourceSketchId },
          { item: addArc(shared, 24, -0.3, 1.2, false), kind: "arc", sketchId: sourceSketchId },
          { item: addSpline([shared, addPoint(-5, 30, false, "endpoint"), addPoint(45, 10, false, "endpoint")], false, false), kind: "spline", sketchId: sourceSketchId },
        ];
        const targetSketchId = "S3";
        model.sketches.push({ id: targetSketchId, name: "Projection Target", parentSketchId: sourceSketchId, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {}, visible: true });
        model.activeSketchId = targetSketchId;
        for (const entry of sourceEntries) {
          const target = createSketchProjectionTarget(entry, targetSketchId);
          const constraint = new SketchProjectionConstraint(entry.kind, entry.item, target);
          markReferenceConstraint(constraint, sourceSketchId, targetSketchId);
          pushModelConstraint(constraint, targetSketchId);
        }
        synchronizeSketchProjectionMetadata(targetSketchId);
        solveSketchAndDependents(sourceSketchId);
        if (reloadSharedVersion19) {
          const data = structuredClone(serializeModel());
          const links = new Map(data.constraints.filter((constraint) => constraint.type === "sketchProjection").map((constraint) => [constraint.kind, constraint]));
          const linesById = new Map(data.lines.map((line) => [String(line.id), line]));
          const circlesById = new Map(data.circles.map((circle) => [String(circle.id), circle]));
          const arcsById = new Map(data.arcs.map((arc) => [String(arc.id), arc]));
          const splinesById = new Map(data.splines.map((spline) => [String(spline.id), spline]));
          const sharedTargetPointId = String(links.get("point")?.target || "");
          const orphanedTargetPointIds = new Set();
          const shareSlot = (owner, key, index = null) => {
            if (!owner || !sharedTargetPointId) return;
            const previous = index == null ? owner[key] : owner[key]?.[index];
            if (String(previous) !== sharedTargetPointId) orphanedTargetPointIds.add(String(previous));
            if (index == null) owner[key] = sharedTargetPointId;
            else owner[key][index] = sharedTargetPointId;
          };
          shareSlot(linesById.get(String(links.get("line")?.target)), "p1");
          shareSlot(circlesById.get(String(links.get("circle")?.target)), "center");
          shareSlot(arcsById.get(String(links.get("arc")?.target)), "center");
          shareSlot(splinesById.get(String(links.get("spline")?.target)), "fitPoints", 0);
          data.points = data.points.filter((point) => !orphanedTargetPointIds.has(String(point.id)));
          loadModelData(data);
        }
        resetHistory("sketch projection shared kinds test");
        updateUI();
        draw();
        return this.sketchProjectionStateForTest();
      },
      sketchProjectionEligibilityForTest() {
        resetModelState();
        const addSketch = (id, parentSketchId) => model.sketches.push({ id, name: id, parentSketchId, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {}, visible: true });
        const makeLine = (id, sketchId, y, appearance = {}) => {
          const p1 = addPointToSketch(-20, y, sketchId, "endpoint");
          const p2 = addPointToSketch(20, y, sketchId, "endpoint");
          const line = new Line(id, p1, p2, false);
          line.sketchId = sketchId;
          line.appearance = appearance;
          model.lines.push(line);
          return line;
        };
        addSketch("S3", DEFAULT_SKETCH_ID);
        addSketch("S4", DEFAULT_SKETCH_ID);
        addSketch("S5", "S3");
        const ancestor = makeLine("EL1", DEFAULT_SKETCH_ID, -30);
        const hiddenAncestor = makeLine("EL2", DEFAULT_SKETCH_ID, -20, { visible: false });
        const self = makeLine("EL3", "S3", -10);
        const sibling = makeLine("EL4", "S4", 0);
        const child = makeLine("EL5", "S5", 10);
        const root = makeLine("EL6", ROOT_SKETCH_ID, 20);
        model.activeSketchId = "S3";
        const eligible = (line) => Boolean(sketchProjectionEntryFromOperand({ kind: "line", line, sketchId: line.sketchId }));
        return {
          ancestor: eligible(ancestor),
          hiddenAncestor: eligible(hiddenAncestor),
          self: eligible(self),
          sibling: eligible(sibling),
          child: eligible(child),
          root: eligible(root),
        };
      },
      resetForSketchProjectionBlockEditorTest() {
        resetModelState();
        const draft = createEmptyBlockDefinition("Projection Block");
        openBlockDefinitionEditor(draft, { isNew: true });
        model.activeSketchId = DEFAULT_SKETCH_ID;
        const line = addLine(addPoint(-45, 0, false, "endpoint"), addPoint(45, 0, false, "endpoint"), false);
        model.sketches.push({ id: "S3", name: "Projected Detail", parentSketchId: DEFAULT_SKETCH_ID, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {}, visible: true });
        model.activeSketchId = "S3";
        this.focusWorldForTest({ x: 0, y: 0 }, 3);
        resetBlockEditorHistory();
        updateUI();
        draw();
        return { client: this.worldClientPositionForTest({ x: 0, y: 0 }), lineId: line.id };
      },
      completeSketchProjectionBlockEditorForTest() {
        completeBlockDefinitionEdit({ rotationLocked: true });
        return { completed: !blockEditor.current, serialized: structuredClone(serializeModel()) };
      },
      resetForBlockProjectionSketchProjectionTest() {
        resetModelState();
        const definition = createEmptyBlockDefinition("Source Block");
        const p1 = new Point("BP1", -30, 0, false, "endpoint");
        const p2 = new Point("BP2", 30, 0, false, "endpoint");
        p1.sketchId = DEFAULT_SKETCH_ID;
        p2.sketchId = DEFAULT_SKETCH_ID;
        const line = new Line("BL1", p1, p2, false);
        line.sketchId = DEFAULT_SKETCH_ID;
        definition.points.push(p1, p2);
        definition.lines.push(line);
        definition.revision += 1;
        documentModel.blockDefinitions.push(definition);
        const instance = { id: `BI${blockInstanceSeq++}`, definitionId: definition.id, sketchId: DEFAULT_SKETCH_ID, x: -10, y: 15, rotation: 0, fixed: false, rotationLocked: false, enabledSketchIds: [DEFAULT_SKETCH_ID], appearanceOverride: {} };
        model.blockInstances.push(instance);
        model.sketches.push({ id: "S3", name: "Block Projection Target", parentSketchId: DEFAULT_SKETCH_ID, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {}, visible: true });
        model.activeSketchId = "S3";
        invalidateBlockProjectionCache();
        const projected = blockProjectionBundle(instance).lines[0];
        this.focusWorldForTest({ x: -10, y: 15 }, 3);
        resetHistory("block projection sketch projection test");
        updateUI();
        draw();
        return { instanceId: instance.id, client: this.worldClientPositionForTest({ x: (projected.p1.x + projected.p2.x) / 2, y: (projected.p1.y + projected.p2.y) / 2 }) };
      },
      moveBlockProjectionSketchProjectionSourceForTest() {
        const instance = model.blockInstances[0];
        if (!instance) return null;
        instance.x += 38;
        instance.y -= 11;
        instance.rotation += Math.PI / 2;
        invalidateBlockProjectionCache(instance.id);
        const solved = solveSketchAndDependents(DEFAULT_SKETCH_ID);
        updateUI();
        draw();
        return { success: solved.success && solved.dependent?.success !== false, state: this.sketchProjectionStateForTest() };
      },
      deleteBlockProjectionSketchProjectionSourceForTest() {
        clearSelection();
        canvasSelection.set("blockInstances", model.blockInstances.slice(0, 1));
        const deleted = deleteCurrentSelection();
        return { deleted, state: this.sketchProjectionStateForTest() };
      },
      sketchProjectionStateForTest() {
        const constraints = sketchProjectionConstraints();
        const geometryState = (item) => {
          if (item instanceof Point) return { id: item.id, kind: "point", x: item.x, y: item.y };
          if (item instanceof Line) return { id: item.id, kind: "line", p1: item.p1.id, p2: item.p2.id, points: [{ x: item.p1.x, y: item.p1.y }, { x: item.p2.x, y: item.p2.y }], construction: Boolean(item.construction) };
          if (item instanceof Circle) return { id: item.id, kind: "circle", center: { id: item.center.id, x: item.center.x, y: item.center.y }, radius: item.radius(), construction: Boolean(item.construction) };
          if (item instanceof Arc) return { id: item.id, kind: "arc", center: { id: item.center.id, x: item.center.x, y: item.center.y }, radius: item.radius(), startAngle: item.startAngle, endAngle: item.endAngle, construction: Boolean(item.construction) };
          return { id: item.id, kind: "spline", fitPoints: item.fitPoints.map((point) => ({ id: point.id, x: point.x, y: point.y })), closed: Boolean(item.closed), construction: Boolean(item.construction) };
        };
        return {
          mode,
          stagedCount: sketchProjectionSources.length,
          constraints: constraints.map((constraint) => ({
            kind: constraint.kind,
            source: geometryState(constraint.source),
            target: geometryState(constraint.target),
            sourceId: constraintGeometryId(constraint.source),
            targetId: constraintGeometryId(constraint.target),
            sketchId: constraintSketchId(constraint),
            referenceSketchId: constraint.referenceSketchId,
            appearanceColor: effectiveAppearanceForElement(constraint.target).color,
            displayColor: geometryDisplayColor(constraint.target, effectiveAppearanceForElement(constraint.target)),
            constraintStatus: constraintStatusOf(constraint.target),
            statusColor: constraintStatusColor(constraint.target),
            redundant: constraintIsRedundant(constraint),
          })),
          serialized: structuredClone(serializeModel()),
          history: this.historyState(),
          sketches: model.sketches.map((sketch) => ({ id: sketch.id, parentSketchId: sketch.parentSketchId })),
          treeText: document.getElementById("sketchList")?.textContent || "",
          propertiesText: document.getElementById("propertiesPanel")?.textContent || "",
        };
      },
      moveSketchProjectionSourcesForTest(dx = 12, dy = 7, { changeShape = true, changeSplineStructure = false } = {}) {
        const sourceSketchId = DEFAULT_SKETCH_ID;
        for (const point of model.points.filter((item) => elementSketchId(item) === sourceSketchId)) {
          point.x += Number(dx) || 0;
          point.y += Number(dy) || 0;
        }
        if (changeShape) {
          const circle = model.circles.find((item) => elementSketchId(item) === sourceSketchId);
          const arc = model.arcs.find((item) => elementSketchId(item) === sourceSketchId);
          if (circle) circle.radiusValue += 3;
          if (arc) {
            arc.radiusValue += 2;
            arc.startAngle += 0.15;
            arc.endAngle += 0.25;
          }
        }
        if (changeSplineStructure) {
          const spline = model.splines.find((item) => elementSketchId(item) === sourceSketchId);
          if (spline) {
            const a = spline.fitPoints[1];
            const b = spline.fitPoints[2];
            const point = addPointToSketch((a.x + b.x) / 2, (a.y + b.y) / 2 + 9, sourceSketchId, "endpoint");
            spline.fitPoints.splice(2, 0, point);
            spline.closed = true;
            spline._curveCache = null;
          }
        }
        const solved = solveSketchAndDependents(sourceSketchId);
        updateUI();
        draw();
        return { success: solved.success && solved.dependent?.success !== false, state: this.sketchProjectionStateForTest() };
      },
      createSketchProjectionChainForTest() {
        const upstream = sketchProjectionConstraints().find((constraint) => constraint.kind === "line" && constraintSketchId(constraint) === "S3");
        if (!upstream) return null;
        if (!model.sketches.some((sketch) => sketch.id === "S4")) {
          model.sketches.push({ id: "S4", name: "Projection Chain", parentSketchId: "S3", kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {}, visible: true });
        }
        model.activeSketchId = "S4";
        const entry = { item: upstream.target, kind: "line", sketchId: "S3", key: sketchProjectionSourceKey(upstream.target) };
        const target = createSketchProjectionTarget(entry, "S4");
        const constraint = new SketchProjectionConstraint("line", upstream.target, target);
        markReferenceConstraint(constraint, "S3", "S4");
        pushModelConstraint(constraint, "S4");
        synchronizeSketchProjectionMetadata("S4");
        const solved = solveSketchAndDependents("S3");
        updateUI();
        draw();
        return { success: solved.success && solved.dependent?.success !== false, state: this.sketchProjectionStateForTest() };
      },
      selectSketchProjectionTargetForTest(kind = "line") {
        const constraint = sketchProjectionConstraints().find((item) => item.kind === kind) || null;
        if (!constraint) return null;
        clearSelection();
        if (constraint.target instanceof Point) canvasSelection.set("points", [constraint.target]);
        else if (constraint.target instanceof Line) canvasSelection.set("lines", [constraint.target]);
        else if (constraint.target instanceof Circle) canvasSelection.set("circles", [constraint.target]);
        else if (constraint.target instanceof Arc) canvasSelection.set("arcs", [constraint.target]);
        else if (constraint.target instanceof Spline) canvasSelection.set("splines", [constraint.target]);
        updateUI();
        draw();
        const state = this.sketchProjectionStateForTest();
        const point = constraint.target instanceof Point
          ? constraint.target
          : constraint.target instanceof Line
            ? { x: (constraint.target.p1.x + constraint.target.p2.x) / 2, y: (constraint.target.p1.y + constraint.target.p2.y) / 2 }
            : constraint.target.center || constraint.target.fitPoints[1];
        return { targetId: constraintGeometryId(constraint.target), client: this.worldClientPositionForTest(point), propertiesText: state.propertiesText };
      },
      removeFirstSketchProjectionConstraintForTest() {
        const constraint = sketchProjectionConstraints()[0];
        if (!constraint) return false;
        return deleteElements({ constraints: [constraint] });
      },
      setSketchProjectionAppearanceForTest(kind = "line") {
        const selected = this.selectSketchProjectionTargetForTest(kind);
        if (!selected) return null;
        const before = sketchProjectionConstraints().length;
        const changed = setAppearanceForSelection({ color: "#8B5CF6" });
        return { changed, before, targetId: selected.targetId, state: this.sketchProjectionStateForTest() };
      },
      deleteSketchProjectionSourceGeometryForTest(kind = "line") {
        const constraint = sketchProjectionConstraints().find((item) => item.kind === kind) || null;
        if (!constraint) return false;
        const source = constraint.source;
        if (source instanceof Point) return deleteElements({ points: [source] });
        if (source instanceof Line) return deleteElements({ lines: [source] });
        if (source instanceof Circle) return deleteElements({ circles: [source] });
        if (source instanceof Arc) return deleteElements({ arcs: [source] });
        return deleteElements({ splines: [source] });
      },
      deleteSketchProjectionTargetGeometryForTest(kind = "line") {
        const selected = this.selectSketchProjectionTargetForTest(kind);
        if (!selected) return null;
        const deleted = deleteCurrentSelection();
        return { deleted, state: this.sketchProjectionStateForTest() };
      },
      deleteSketchProjectionSourceSketchForTest() {
        const deleted = deleteSketch(DEFAULT_SKETCH_ID, false);
        return { deleted, state: this.sketchProjectionStateForTest() };
      },
      copySketchProjectionTargetForTest(kind = "circle") {
        const selected = this.selectSketchProjectionTargetForTest(kind);
        if (!selected) return null;
        const before = sketchProjectionConstraints().length;
        const copied = copySelectionToClipboard();
        const pasted = copied ? pasteGeometryClipboard() : false;
        return {
          copied,
          pasted: Boolean(pasted),
          before,
          after: sketchProjectionConstraints().length,
          clipboardProjectionCount: (geometryClipboard?.constraints || []).filter((constraint) => constraint.type === "sketchProjection").length,
          state: this.sketchProjectionStateForTest(),
        };
      },
      blockizeSketchProjectionTargetForTest(kind = "spline") {
        const selected = this.selectSketchProjectionTargetForTest(kind);
        if (!selected) return null;
        const selection = blockSelectionGeometry();
        if (selection.error) return { error: selection.error };
        const definition = createBlockDefinitionFromSelection(selection, blockSelectionBoundsCenter(selection), "Projected Geometry Block");
        return {
          error: null,
          projectionConstraintCount: definition.constraints.filter((constraint) => constraint instanceof SketchProjectionConstraint).length,
          geometryCount: definition.lines.length + definition.circles.length + definition.arcs.length + definition.splines.length,
          externalProjectionCount: selection.externalConstraints.filter((constraint) => constraint instanceof SketchProjectionConstraint).length,
        };
      },
      reloadSketchProjectionForTest(version = CURRENT_JSON_VERSION) {
        const data = structuredClone(serializeModel());
        data.version = Number(version);
        loadModelData(data);
        updateUI();
        draw();
        return this.sketchProjectionStateForTest();
      },
      referenceImageStateForTest() {
        return {
          selectedIds: canvasSelection.referenceImages.map((item) => item.id),
          images: model.referenceImages.map(serializeReferenceImage),
          liveBlockImages: blockEditor.current ? (liveBlockEditorDefinition().referenceImages || []).map(serializeReferenceImage) : [],
          calibrationPointCount: referenceImageCalibrationSession?.localPoints?.length || 0,
          dragging: Boolean(referenceImageDragSession),
          history: this.historyState(),
          viewport: viewport.snapshot(),
        };
      },
      async importReferenceImageDataForTest(dataUrl, name = "image.png", type = "image/png") {
        const blob = await (await fetch(dataUrl)).blob();
        return importReferenceImageFile(new File([blob], name, { type }));
      },
      openReferenceImageBlockEditorForTest(options = {}) {
        if (!options.preserveDocument) resetModelState();
        const draft = createEmptyBlockDefinition("Image Block");
        const p1 = new Point("P1", -20, 0, false, "endpoint");
        const p2 = new Point("P2", 20, 0, false, "endpoint");
        p1.sketchId = DEFAULT_SKETCH_ID;
        p2.sketchId = DEFAULT_SKETCH_ID;
        const line = new Line("L1", p1, p2, false);
        line.sketchId = DEFAULT_SKETCH_ID;
        draft.points.push(p1, p2);
        draft.lines.push(line);
        openBlockDefinitionEditor(draft, { isNew: true });
        return true;
      },
      completeReferenceImageBlockEditorForTest() {
        completeBlockDefinitionEdit({ rotationLocked: true });
        return structuredClone(serializeModel());
      },
      dimensionAppearanceStateForTest(index = 0) {
        const constraint = model.constraints.filter(isDimensionConstraint)[index] || null;
        const sketchId = constraint ? constraintSketchId(constraint) : activeSketchId();
        const sketch = model.sketches.find((item) => item.id === sketchId) || null;
        return {
          documentDefault: structuredClone(normalizeDimensionAppearance(documentModel.defaultDimensionAppearance, { partial: false })),
          sketchDirect: structuredClone(normalizeDimensionAppearance(sketch?.dimensionAppearance)),
          sketchEffective: structuredClone(effectiveDimensionAppearanceForSketch(sketch)),
          direct: structuredClone(normalizeDimensionAppearance(constraint?.dimension?.display)),
          effective: constraint ? structuredClone(dimensionDisplayState(constraint.dimension, sketchId)) : null,
          blockDefinitions: documentModel.blockDefinitions.map((definition) => ({
            id: definition.id,
            dimensions: (definition.constraints || []).filter(isDimensionConstraint).map((item) => ({
              sketchDirect: structuredClone(normalizeDimensionAppearance(definition.sketches.find((sketchItem) => sketchItem.id === item.sketchId)?.dimensionAppearance)),
              direct: structuredClone(normalizeDimensionAppearance(item.dimension?.display)),
              effective: structuredClone(dimensionDisplayState(item.dimension, item.sketchId, definition.sketches)),
            })),
          })),
        };
      },
      arcRadiusDimensionRenderPlanForTest(terminatorType = "arrow", options = {}) {
        const center = new Point("P_ARC_RADIUS_TEST", 0, 0, false, "explicit");
        const arc = new Arc("A_ARC_RADIUS_TEST", center, 30, 0, Math.PI / 2, false);
        const target = { kind: "radius", primitive: arc, value: arc.radius() };
        const dimensionAngle = Number.isFinite(options.dimensionAngle) ? options.dimensionAngle : Math.PI / 4;
        const dimension = dimensionFromAnchor(target, circlePointAtAngle(arc, dimensionAngle));
        dimension.labelOffsetU = Number.isFinite(options.labelOffsetU) ? options.labelOffsetU : arc.radius() / 2;
        const appearance = {
          ...normalizeDimensionAppearance(documentModel.defaultDimensionAppearance, { partial: false }),
          terminatorType,
        };
        const layout = dimensionLayout(target, dimension, appearance);
        const plan = linearDimensionRenderPlan(target, layout, options.label || "R30", appearance, dimension);
        const arcExtension = arcRadiusDimensionExtensionSegment(target, layout, appearance);
        return {
          centerTerminatorVisible: Boolean(plan.firstTerminator),
          arcTerminatorVisible: Boolean(plan.secondTerminator),
          terminatorsOutside: plan.outside,
          lineStartDistanceFromCenter: hypot2(plan.lineStart.x - center.x, plan.lineStart.y - center.y),
          lineEndDistanceFromCenter: hypot2(plan.lineEnd.x - center.x, plan.lineEnd.y - center.y),
          rawExtendedLineEndDistanceFromCenter: hypot2(layout.lineB.x - center.x, layout.lineB.y - center.y),
          labelDistanceFromCenter: hypot2(layout.text.x - center.x, layout.text.y - center.y),
          shaftLengths: plan.shafts.map((shaft) => hypot2(shaft.end.x - shaft.start.x, shaft.end.y - shaft.start.y) * viewport.scale),
          shaftEndDistancesFromCenter: plan.shafts.map((shaft) => hypot2(shaft.end.x - center.x, shaft.end.y - center.y)),
          visibleExtensionCount: layout.points.filter((point) => point.showExtension !== false).length,
          arcExtensionVisible: Boolean(arcExtension),
          arcExtensionSourceEndpoint: arcExtension?.sourceEndpoint || null,
          arcExtensionOriginGap: arcExtension
            ? Math.abs(arcExtension.startAngle - arcExtension.sourceAngle) * arcExtension.radius * viewport.scale
            : null,
          arcExtensionOvershoot: arcExtension
            ? Math.abs(arcExtension.endAngle - arcExtension.intersectionAngle) * arcExtension.radius * viewport.scale
            : null,
          arcRadius: arc.radius(),
          expectedShaftLength: appearance.terminatorSize * DIMENSION_SCREEN_PX_PER_MM * DIMENSION_OUTSIDE_SHAFT_LENGTH_FACTOR,
          expectedExtensionOriginGap: appearance.extensionLineOriginGap * DIMENSION_SCREEN_PX_PER_MM,
          expectedExtensionOvershoot: appearance.extensionLineOvershoot * DIMENSION_SCREEN_PX_PER_MM,
        };
      },
      dimensionAppearanceRenderMetricsForTest(index = 0) {
        const constraint = model.constraints.filter(isDimensionConstraint)[index] || null;
        const target = targetFromConstraint(constraint);
        const sketchId = constraint ? constraintSketchId(constraint) : activeSketchId();
        const dimension = constraint?.dimension || (target ? defaultDimensionForTarget(target) : null);
        const appearance = effectiveDimensionAppearance(dimension, sketchId);
        const layout = target && target.kind !== "angle" ? dimensionLayout(target, dimension, appearance) : null;
        const firstExtension = layout?.points?.find((point) => point.showExtension !== false) || null;
        const arrow = dimensionArrowheadPoints({ x: 0, y: 0 }, { x: 1, y: 0 }, appearance);
        const arrowLength = (arrow[1].x - arrow[0].x) * viewport.scale;
        const arrowHalfWidth = Math.abs(arrow[1].y - arrow[0].y) * viewport.scale;
        const text = dimensionTextDrawingMetrics(appearance);
        const angleRadius = 50 / viewport.scale;
        const [angleExtension] = angleDimensionExtensionSegments({ vertex: { x: 0, y: 0 }, radius: angleRadius, start: 0, end: Math.PI / 2 }, appearance);
        return {
          appearance: structuredClone(appearance),
          linearExtension: firstExtension ? {
            originGap: hypot2(firstExtension.extensionStart.x - firstExtension.source.x, firstExtension.extensionStart.y - firstExtension.source.y) * viewport.scale,
            overshoot: hypot2(firstExtension.extensionEnd.x - firstExtension.onDimension.x, firstExtension.extensionEnd.y - firstExtension.onDimension.y) * viewport.scale,
          } : null,
          angleExtension: {
            originGap: hypot2(angleExtension.start.x, angleExtension.start.y) * viewport.scale,
            overshoot: (hypot2(angleExtension.end.x, angleExtension.end.y) - angleRadius) * viewport.scale,
          },
          terminator: {
            type: appearance.terminatorType,
            size: appearance.terminatorSize * DIMENSION_SCREEN_PX_PER_MM,
            openingAngle: appearance.terminatorType === "dot" ? null : Math.atan2(arrowHalfWidth, arrowLength) * 360 / Math.PI,
          },
          lineWidth: dimensionStrokeWidth(appearance),
          text: {
            height: text.height * viewport.scale,
            gap: text.gap * viewport.scale,
          },
        };
      },
      dimensionTerminatorFitForTest(availableScreenPixels, label = "100", terminatorType = "arrow", expressionMark = false) {
        const appearance = {
          ...normalizeDimensionAppearance(documentModel.defaultDimensionAppearance, { partial: false }),
          terminatorType,
        };
        const availableLength = Math.max(0, Number(availableScreenPixels) || 0) / viewport.scale;
        const layout = {
          span: availableLength,
          d: { x: 1, y: 0 },
          a: { x: 0, y: 0 },
          b: { x: availableLength, y: 0 },
          lineA: { x: 0, y: 0 },
          lineB: { x: availableLength, y: 0 },
        };
        const plan = linearDimensionRenderPlan({ kind: "point-point" }, layout, label, appearance, null, expressionMark);
        const directions = linearDimensionTerminatorDirections({ x: 1, y: 0 }, plan.outside);
        return {
          outside: plan.outside,
          textWidth: dimensionTextWidth(label, appearance, expressionMark) * viewport.scale,
          fitMargin: appearance.terminatorSize * DIMENSION_SCREEN_PX_PER_MM * DIMENSION_TERMINATOR_FIT_MARGIN_FACTOR,
          shaftLengths: plan.shafts.map((shaft) => hypot2(shaft.end.x - shaft.start.x, shaft.end.y - shaft.start.y) * viewport.scale),
          firstDirection: directions.first,
          secondDirection: directions.second,
        };
      },
      dimensionArrowTipAlignmentForTest({ lineWidth = 1.2, arrowheadAngle = 30, highlighted = false, viewportScale = viewport.scale, outside = false } = {}) {
        const previousScale = viewport.scale;
        viewport.update({ scale: Math.max(0.05, Number(viewportScale) || 1) });
        try {
          const appearance = {
            ...normalizeDimensionAppearance(documentModel.defaultDimensionAppearance, { partial: false }),
            terminatorType: "arrow",
            lineWidth,
            arrowheadAngle,
          };
          const strokeWidth = dimensionStrokeWidth(appearance, highlighted) / viewport.scale;
          const direction = outside ? { x: -1, y: 0 } : { x: 1, y: 0 };
          const points = dimensionOpenArrowheadRenderPoints({ x: 0, y: 0 }, direction, appearance, strokeWidth);
          const alongDirectionWorld = (point) => point.x * direction.x + point.y * direction.y;
          const pathTipInsetWorld = alongDirectionWorld(points[0]);
          const wingDistanceWorld = alongDirectionWorld(points[1]);
          const wingHalfWidthWorld = Math.abs(points[1].x * -direction.y + points[1].y * direction.x);
          const renderedHalfAngle = Math.atan2(wingHalfWidthWorld, Math.max(1e-9, wingDistanceWorld - pathTipInsetWorld));
          const visualProjection = dimensionOpenArrowJoinProjection(strokeWidth, renderedHalfAngle);
          const visualMiterApex = {
            x: points[0].x - direction.x * visualProjection,
            y: points[0].y - direction.y * visualProjection,
          };
          const alongDirection = (point) => alongDirectionWorld(point) * viewport.scale;
          const shaftLength = appearance.terminatorSize * DIMENSION_SCREEN_PX_PER_MM * DIMENSION_OUTSIDE_SHAFT_LENGTH_FACTOR;
          return {
            strokeWidth: strokeWidth * viewport.scale,
            pathTipInset: alongDirection(points[0]),
            visualTipOffset: alongDirection(visualMiterApex),
            wingDistance: alongDirection(points[1]),
            nominalArrowSize: appearance.terminatorSize * DIMENSION_SCREEN_PX_PER_MM,
            rearShaftLength: shaftLength - alongDirection(points[1]),
          };
        } finally {
          viewport.update({ scale: previousScale });
        }
      },
      drawnDimensionColorsForTest() {
        const colors = [];
        const previousSelectedDimension = canvasSelection.dimensionConstraint;
        const previousSelectedConstraint = canvasSelection.constraint;
        const previousHoveredDimension = hoveredDimensionConstraint;
        const originalStroke = ctx.stroke;
        canvasSelection.set("dimensionConstraint", null);
        canvasSelection.set("constraint", null);
        hoveredDimensionConstraint = null;
        ctx.stroke = (...args) => {
          colors.push(String(ctx.strokeStyle).toLowerCase());
          return originalStroke.apply(ctx, args);
        };
        try {
          drawDimensions();
        } finally {
          ctx.stroke = originalStroke;
          canvasSelection.set("dimensionConstraint", previousSelectedDimension);
          canvasSelection.set("constraint", previousSelectedConstraint);
          hoveredDimensionConstraint = previousHoveredDimension;
        }
        return [...new Set(colors)];
      },
      resetForParameterTest() {
        resetModelState();
        const p1 = addPoint(0, 0, true, "endpoint");
        const p2 = addPoint(100, 0, false, "endpoint");
        const drivenLine = addLine(p1, p2);
        pushModelConstraint(new HorizontalConstraint(drivenLine));
        const driven = new DistanceConstraint(p1, p2, 100);
        driven.dimension = dimensionFromAnchor({ kind: "line-length", line: drivenLine, p1, p2, value: 100 }, { x: 50, y: -30 });
        pushModelConstraint(driven);
        const p3 = addPoint(0, 60, true, "endpoint");
        const p4 = addPoint(40, 60, true, "endpoint");
        const measuredLine = addLine(p3, p4);
        const measured = new DistanceConstraint(p3, p4, 40);
        measured.dimension = dimensionFromAnchor({ kind: "line-length", line: measuredLine, p1: p3, p2: p4, value: 40 }, { x: 20, y: 85 });
        measured.readOnlyDimension = true;
        measured.enabled = false;
        pushModelConstraint(measured);
        model.parameters = [
          { name: "width", expression: `${formatParameterReference(measured.parameterName)} * 2` },
          { name: "margin", expression: "10" },
        ];
        driven.expression = '"width" / 2 + "margin"';
        const definition = createEmptyBlockDefinition("Param Block");
        const bp1 = new Point("BP1", 0, 0, true, "endpoint");
        const bp2 = new Point("BP2", 25, 0, false, "endpoint");
        bp1.sketchId = DEFAULT_SKETCH_ID;
        bp2.sketchId = DEFAULT_SKETCH_ID;
        const blockLine = new Line("BL1", bp1, bp2);
        blockLine.sketchId = DEFAULT_SKETCH_ID;
        const blockHorizontal = new HorizontalConstraint(blockLine);
        blockHorizontal.sketchId = DEFAULT_SKETCH_ID;
        const blockDimension = new DistanceConstraint(bp1, bp2, 25);
        blockDimension.sketchId = DEFAULT_SKETCH_ID;
        blockDimension.dimension = { x: 12.5, y: -20 };
        definition.points.push(bp1, bp2);
        definition.lines.push(blockLine);
        definition.constraints.push(blockHorizontal, blockDimension);
        definition.parameters = [{ name: "width", expression: "25" }];
        ensureParameterNamespace(definition);
        blockDimension.expression = '"width"';
        documentModel.blockDefinitions.push(definition);
        model.blockInstances.push({ id: `BI${blockInstanceSeq++}`, definitionId: definition.id, sketchId: DEFAULT_SKETCH_ID, x: 180, y: 0, rotation: 0, fixed: false, rotationLocked: true, enabledSketchIds: [DEFAULT_SKETCH_ID], appearanceOverride: {} });
        const otherDefinition = createEmptyBlockDefinition("Other Param Block");
        const op1 = new Point("BP1", 0, 0, true, "endpoint");
        const op2 = new Point("BP2", 15, 0, false, "endpoint");
        op1.sketchId = DEFAULT_SKETCH_ID;
        op2.sketchId = DEFAULT_SKETCH_ID;
        const otherLine = new Line("BL1", op1, op2);
        otherLine.sketchId = DEFAULT_SKETCH_ID;
        const otherHorizontal = new HorizontalConstraint(otherLine);
        otherHorizontal.sketchId = DEFAULT_SKETCH_ID;
        const otherDimension = new DistanceConstraint(op1, op2, 15);
        otherDimension.sketchId = DEFAULT_SKETCH_ID;
        otherDimension.dimension = { x: 7.5, y: -20 };
        otherDefinition.points.push(op1, op2);
        otherDefinition.lines.push(otherLine);
        otherDefinition.constraints.push(otherHorizontal, otherDimension);
        otherDefinition.parameters = [{ name: "width", expression: "15" }];
        ensureParameterNamespace(otherDefinition);
        otherDimension.expression = '"width"';
        documentModel.blockDefinitions.push(otherDefinition);
        model.blockInstances.push({ id: `BI${blockInstanceSeq++}`, definitionId: otherDefinition.id, sketchId: DEFAULT_SKETCH_ID, x: 260, y: 0, rotation: 0, fixed: false, rotationLocked: true, enabledSketchIds: [DEFAULT_SKETCH_ID], appearanceOverride: {} });
        invalidateBlockProjectionCache();
        const result = stabilizeActiveParameterNamespace(activeSketchId(), { allSketches: [activeSketchId()] });
        resetHistory("parameter test");
        updateUI();
        draw();
        return { success: result.success, drivenName: driven.parameterName, measuredName: measured.parameterName, length: drivenLine.length() };
      },
      resetForParameterFeedbackTest() {
        resetModelState();
        const p1 = addPoint(0, 0, true, "endpoint");
        const p2 = addPoint(40, 0, false, "endpoint");
        const line = addLine(p1, p2);
        pushModelConstraint(new HorizontalConstraint(line));
        const driving = new DistanceConstraint(p1, p2, 40);
        driving.dimension = dimensionFromAnchor({ kind: "line-length", line, p1, p2, value: 40 }, { x: 20, y: -25 });
        pushModelConstraint(driving);
        const measured = new DistanceConstraint(p1, p2, 40);
        measured.dimension = dimensionFromAnchor({ kind: "line-length", line, p1, p2, value: 40 }, { x: 20, y: 25 });
        measured.readOnlyDimension = true;
        measured.enabled = false;
        pushModelConstraint(measured);
        driving.expression = "40";
        const result = stabilizeActiveParameterNamespace(activeSketchId(), { allSketches: [activeSketchId()] });
        resetHistory("parameter feedback test");
        updateUI();
        draw();
        return { success: result.success, drivingName: driving.parameterName, measuredName: measured.parameterName, length: line.length() };
      },
      parameterStateForTest() {
        const evaluation = validateParameterNamespace(model);
        return {
          valid: evaluation.success,
          parameters: model.parameters.map((parameter) => ({ name: parameter.name, expression: parameter.expression, value: parameter.evaluatedValue })),
          dimensions: dimensionConstraintsInNamespace(model).map((constraint) => ({
            name: constraint.parameterName,
            expression: constraint.expression || null,
            readOnly: isReadOnlyDimension(constraint),
            value: constraint.evaluatedParameterValue,
            target: dimensionExpressionValue(constraint),
          })),
          blockNamespaces: documentModel.blockDefinitions.map((definition) => ({
            id: definition.id,
            parameters: definition.parameters.map((parameter) => ({ name: parameter.name, expression: parameter.expression })),
            dimensions: dimensionConstraintsInNamespace(definition).map((constraint) => ({ name: constraint.parameterName, expression: constraint.expression, target: dimensionExpressionValue(constraint) })),
            lineLengths: definition.lines.map((line) => line.length()),
          })),
          instanceProjectionLengths: model.blockInstances.flatMap((instance) => blockProjectionBundle(instance).lines.map((line) => line.length())),
          serialized: serializeModel(),
        };
      },
      blockParameterFreezeForTest() {
        const line = model.lines[0];
        if (!line) return null;
        clearSelection();
        canvasSelection.set("lines", [line]);
        const selection = blockSelectionGeometry();
        if (selection.error) return { error: selection.error };
        const definition = createBlockDefinitionFromSelection(selection, blockSelectionBoundsCenter(selection), "Frozen Formula Block");
        const dimension = dimensionConstraintsInNamespace(definition)[0];
        return {
          parameters: definition.parameters,
          name: dimension?.parameterName || null,
          expression: dimension?.expression || null,
          sourceExpression: dimensionConstraintsInNamespace(model)[0]?.expression || null,
        };
      },
      deleteDimensionByNameForTest(name) {
        const constraint = dimensionConstraintsInNamespace(model).find((item) => item.parameterName === name);
        const deleted = constraint ? deleteElements({ constraints: [constraint] }) : false;
        return { deleted, names: dimensionConstraintsInNamespace(model).map((item) => item.parameterName), hint: document.getElementById("hint")?.textContent || "" };
      },
      appearanceStateForTest(kind, id) {
        let item = null;
        if (kind === "point") item = allGeometryPoints().find((value) => value.id === id);
        if (kind === "line") item = allGeometryLines().find((value) => value.id === id);
        if (kind === "circle") item = allGeometryCircles().find((value) => value.id === id);
        if (kind === "arc") item = allGeometryArcs().find((value) => value.id === id);
        if (kind === "spline") item = allGeometrySplines().find((value) => value.id === id);
        if (kind === "block") {
          const instance = blockInstanceById(id);
          item = instance ? [...blockProjectionBundle(instance).lines, ...blockProjectionBundle(instance).circles, ...blockProjectionBundle(instance).arcs, ...(blockProjectionBundle(instance).splines || [])][0] : null;
        }
        return item ? { direct: normalizeAppearance(item.appearance), effective: effectiveAppearanceForElement(item), visible: isVisibleSketchElement(item) } : null;
      },
      resetForMultiplePropertiesTest(mixedTypes = false) {
        resetModelState();
        clearSelection();
        const lines = [
          addLine(addPoint(-80, -20, false, "endpoint"), addPoint(-20, -20, false, "endpoint")),
          addLine(addPoint(20, 20, false, "endpoint"), addPoint(80, 20, false, "endpoint")),
        ];
        lines[0].appearance = { color: "#dc2626", lineType: "solid", lineWidth: 1 };
        lines[1].appearance = { color: "#2563eb", lineType: "dotted", lineWidth: 3 };
        canvasSelection.set("lines", mixedTypes ? [lines[0]] : lines);
        if (mixedTypes) {
          const circle = addCircle(addPoint(0, 65, false, "endpoint"), 20);
          circle.appearance = { color: "#16a34a", lineType: "dashed", lineWidth: 4 };
          canvasSelection.set("circles", [circle]);
        }
        resetHistory("multiple properties test");
        updateUI();
        draw();
        return { ids: lines.map((line) => line.id) };
      },
      multiplePropertiesStateForTest() {
        return {
          targetKind: selectedPropertiesTarget().kind,
          lines: canvasSelection.lines.map((line) => ({ id: line.id, construction: line.construction, appearance: normalizeAppearance(line.appearance), effective: effectiveAppearanceForElement(line) })),
          circles: canvasSelection.circles.map((circle) => ({ id: circle.id, construction: circle.construction, appearance: normalizeAppearance(circle.appearance), effective: effectiveAppearanceForElement(circle) })),
          propertiesText: document.getElementById("propertiesPanel")?.textContent || "",
          history: this.historyState(),
        };
      },
      resetForMultipleFixedTest() {
        resetModelState();
        model.sketches.push({ id: "S2", name: "Batch Fix", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {} });
        model.activeSketchId = "S2";
        const p1 = addPoint(-60, -20, false, "endpoint");
        const p2 = addPoint(-10, -20, false, "endpoint");
        const p3 = addPoint(10, 20, false, "endpoint");
        const p4 = addPoint(60, 20, false, "endpoint");
        const point = addPoint(0, 70, false, "explicit");
        const lines = [addLine(p1, p2), addLine(p3, p4)];
        clearSelection();
        canvasSelection.set("points", [point]);
        canvasSelection.set("lines", lines);
        resetHistory("multiple fixed test");
        updateUI();
        draw();
        return { pointId: point.id, lineIds: lines.map((line) => line.id) };
      },
      multipleFixedStateForTest() {
        const sketchPoints = model.points.filter((point) => elementSketchId(point) === "S2");
        const sketchLines = model.lines.filter((line) => elementSketchId(line) === "S2");
        return {
          fixedPointIds: sketchPoints.filter((point) => point.fixed).map((point) => point.id),
          fixedLineIds: sketchLines.filter((line) => findLineFixedConstraint(line)).map((line) => line.id),
          constraintCount: model.constraints.filter((constraint) => constraint instanceof LineFixedConstraint).length,
          buttonDisabled: fixPointBtn.getAttribute("aria-disabled"),
          history: this.historyState(),
        };
      },
      viewStateForTest() {
        return {
          ...viewState,
          mouseLatched: constraintStatusMouseLatched,
          spaceHeld: constraintStatusSpaceHeld,
        };
      },
      async importDocumentNameFixture(data, fileName) {
        const startedAt = performance.now();
        const file = new File([JSON.stringify(data)], fileName, { type: "application/json" });
        const success = await importFileData(file);
        return {
          success,
          elapsedMs: performance.now() - startedAt,
          modelName: documentModel.documentName,
          displayName: effectiveDocumentName(),
          serializedName: serializeModel().documentName,
          title: document.title,
        };
      },
      loadDocumentFixtureForDragTest(data, fileName = "drag-fixture.json", { resetLoadedHistory = false } = {}) {
        try {
          loadModelData(structuredClone(data), { documentNameOverride: fileNameStem(fileName) });
          if (resetLoadedHistory) resetHistory("fixture load");
          updateUI();
          draw();
          return { success: true, constraintCount: model.constraints.length };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      selectedGeometryIdsForTest() {
        return {
          points: canvasSelection.points.map((point) => point.id),
          lines: canvasSelection.lines.map((line) => line.id),
          circles: canvasSelection.circles.map((circle) => circle.id),
          arcs: canvasSelection.arcs.map((arc) => arc.id),
          splines: canvasSelection.splines.map((spline) => spline.id),
          blockInstances: canvasSelection.blockInstances.map((instance) => instance.id),
        };
      },
      resetForOverlappingContextSelectionTest() {
        resetModelState();
        const first = addLine(addPoint(-70, 0, false, "endpoint"), addPoint(70, 0, false, "endpoint"));
        const second = addLine(addPoint(-70, 0, false, "endpoint"), addPoint(70, 0, false, "endpoint"));
        const hidden = addLine(addPoint(-70, 0, false, "endpoint"), addPoint(70, 0, false, "endpoint"));
        hidden.appearance = { visible: false };
        model.sketches.push({ id: "S2", name: "Inactive", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {} });
        model.activeSketchId = "S2";
        const inactive = addLine(addPoint(-70, 0, false, "endpoint"), addPoint(70, 0, false, "endpoint"));
        model.activeSketchId = DEFAULT_SKETCH_ID;

        const definition = createEmptyBlockDefinition("Overlapping Block");
        for (let index = 0; index < 2; index += 1) {
          const p1 = new Point(`BP${index * 2 + 1}`, -70, 0, false, "endpoint");
          const p2 = new Point(`BP${index * 2 + 2}`, 70, 0, false, "endpoint");
          p1.sketchId = DEFAULT_SKETCH_ID;
          p2.sketchId = DEFAULT_SKETCH_ID;
          const line = new Line(`BL${index + 1}`, p1, p2);
          line.sketchId = DEFAULT_SKETCH_ID;
          definition.points.push(p1, p2);
          definition.lines.push(line);
        }
        documentModel.blockDefinitions.push(definition);
        const block = {
          id: `BI${blockInstanceSeq++}`,
          definitionId: definition.id,
          sketchId: DEFAULT_SKETCH_ID,
          x: 0,
          y: 0,
          rotation: 0,
          fixed: false,
          rotationLocked: false,
          enabledSketchIds: [DEFAULT_SKETCH_ID],
          appearanceOverride: {},
        };
        model.blockInstances.push(block);
        invalidateBlockProjectionCache();
        canvasSelection.set("lines", [first, second]);
        fitSketchToViewport(activeSketchId(), 220);
        resetHistory("overlapping context selection test");
        updateUI();
        draw();
        return {
          client: this.worldClientPositionForTest({ x: 0, y: 0 }),
          lineIds: [first.id, second.id],
          blockId: block.id,
          excludedIds: [hidden.id, inactive.id],
        };
      },
      resetForArcEndpointConstraintSelectionTest() {
        resetModelState();
        const lineStart = addPoint(0, 0, false, "endpoint");
        const lineEnd = addPoint(60, 0, false, "endpoint");
        addLine(lineStart, lineEnd);
        const first = addArc(addPoint(0, 20, false, "center"), 20, -Math.PI / 2, 0);
        const second = addArc(addPoint(60, 20, false, "center"), 20, -Math.PI / 2, 0);
        fitSketchToViewport(activeSketchId(), 180);
        resetHistory("arc endpoint constraint selection test");
        updateUI();
        draw();
        return {
          first: this.worldClientPositionForTest(arcEndpointPoint(first, "start")),
          second: this.worldClientPositionForTest(arcEndpointPoint(second, "start")),
          firstArcId: first.id,
          secondArcId: second.id,
          lineStartId: lineStart.id,
        };
      },
      canvasContextSelectionStateForTest() {
        const hover = hoveredPoint || hoveredEndpointPoint || hoveredLine || hoveredCircle || hoveredArc || hoveredSpline || hoveredDimensionConstraint || hoveredBlockInstance || hoveredAnnotation || hoveredHatch;
        return {
          menuOpen: Boolean(canvasContextMenu && !canvasContextMenu.hidden),
          candidates: canvasContextCandidates.map((target) => {
            const presentation = canvasContextCandidatePresentation(target);
            return { kind: target.kind, id: presentation.id, type: presentation.type, secondary: presentation.secondary };
          }),
          hovered: hover?.id || hover?.parameterName || null,
          hoveredArcEndpoint: hoveredArcEndpoint ? { id: hoveredArcEndpoint.arc.id, endpoint: hoveredArcEndpoint.endpoint } : null,
          selected: this.selectedGeometryIdsForTest(),
        };
      },
      addIsolatedFixedPointForContextTest(client) {
        const rect = canvas.getBoundingClientRect();
        const point = addPoint(
          (Number(client?.x) - rect.left - viewport.x) / viewport.scale,
          (Number(client?.y) - rect.top - viewport.y) / viewport.scale,
          true,
          "explicit",
        );
        updateUI();
        draw();
        return { id: point.id, client: this.worldClientPositionForTest(point) };
      },
      constraintInputStateForTest() {
        return {
          selected: this.selectedGeometryIdsForTest(),
          geometryInstances: canvasSelection.geometryInstances.map((item) => item.id),
          arcEndpoint: canvasSelection.arcEndpoint ? { arc: canvasSelection.arcEndpoint.arc.id, endpoint: canvasSelection.arcEndpoint.endpoint } : null,
          arcEndpointPair: canvasSelection.arcEndpointPair?.map((item) => ({ arc: item.arc.id, endpoint: item.endpoint })) || null,
          operands: constraintOperands.map((item) => ({ kind: item.kind, id: operandElement(item)?.id, endpoint: item.endpoint })),
          pendingType: pendingConstraintCommand?.type || null,
        };
      },
      resolveConstraintIntentForTest(type, inputs) {
        const operands = inputs.map(({ kind, id, endpoint, parameter }) => {
          const items = kind === "point" ? model.points : kind === "line" ? model.lines
            : kind === "spline" ? model.splines : kind === "arc-endpoint" ? model.arcs : [...model.circles, ...model.arcs];
          const element = items.find((item) => item.id === id);
          if (!element) throw new Error(`Missing test operand: ${id}`);
          const key = kind === "arc-endpoint" ? "arc" : kind;
          return makeConstraintOperand(kind, { [key]: element, endpoint, parameter });
        });
        const resolution = resolveConstraintIntent(type, operands);
        return resolution ? {
          action: resolution.action || null,
          error: resolution.error || null,
          constraint: resolution.constraint ? serializeConstraint(resolution.constraint) : null,
          targetKind: resolution.target?.kind || null,
        } : null;
      },
      selectGeometryIdsForTest(ids = {}) {
        clearSelection();
        const pointIds = new Set(ids.points || []);
        const lineIds = new Set(ids.lines || []);
        const circleIds = new Set(ids.circles || []);
        const arcIds = new Set(ids.arcs || []);
        const splineIds = new Set(ids.splines || []);
        const blockInstanceIds = new Set(ids.blockInstances || []);
        canvasSelection.set("points", model.points.filter((point) => pointIds.has(point.id)));
        canvasSelection.set("lines", model.lines.filter((line) => lineIds.has(line.id)));
        canvasSelection.set("circles", model.circles.filter((circle) => circleIds.has(circle.id)));
        canvasSelection.set("arcs", model.arcs.filter((arc) => arcIds.has(arc.id)));
        canvasSelection.set("splines", model.splines.filter((spline) => splineIds.has(spline.id)));
        canvasSelection.set("blockInstances", model.blockInstances.filter((instance) => blockInstanceIds.has(instance.id)));
        updateUI();
        draw();
        const selection = blockSelectionGeometry();
        return {
          selected: this.selectedGeometryIdsForTest(),
          blockError: selection.error || null,
          internalConstraintCount: selection.constraints?.length || 0,
          externalConstraintCount: selection.externalConstraints?.length || 0,
        };
      },
      focusWorldForTest(center, scale = 1) {
        viewport.update({ scale: clampZoom(Number(scale) || 1) });
        resizeCanvas({ centerWorld: { x: Number(center?.x) || 0, y: Number(center?.y) || 0 } });
        draw();
        const rect = canvas.getBoundingClientRect();
        return {
          scale: viewport.scale,
          center: currentCanvasCenterWorld(),
          canvas: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        };
      },
      displayZoomStateForTest(zoomRatio = null) {
        if (zoomRatio != null) viewport.update({ scale: clampZoom(Number(zoomRatio) * CSS_PX_PER_MM) });
        return {
          units: { ...documentModel.units },
          zoomRatio: viewport.scale / CSS_PX_PER_MM,
          formatted: formatZoom(viewport.scale),
          cssPixelsPerMillimeter: CSS_PX_PER_MM,
          viewportScale: viewport.scale,
        };
      },
      worldClientPositionForTest(point) {
        const rect = canvas.getBoundingClientRect();
        const screen = worldToCanvasScreen({ x: Number(point?.x) || 0, y: Number(point?.y) || 0 });
        return { x: rect.left + screen.x, y: rect.top + screen.y };
      },
      hitGeometryAtWorldForTest(point) {
        const x = Number(point?.x) || 0;
        const y = Number(point?.y) || 0;
        const arcEndpoint = hitArcEndpoint(x, y);
        return {
          point: hitPoint(x, y)?.id || null,
          line: hitLine(x, y)?.id || null,
          circle: hitCircle(x, y)?.id || null,
          arc: hitArc(x, y)?.id || null,
          spline: hitSpline(x, y)?.id || null,
          arcEndpoint: arcEndpoint ? { id: arcEndpoint.arc.id, endpoint: arcEndpoint.endpoint } : null,
        };
      },
      geometryClientPositionForTest(kind, id, detail = null) {
        let point = null;
        if (kind === "point") point = model.points.find((item) => item.id === id) || null;
        if (kind === "line") {
          const line = model.lines.find((item) => item.id === id);
          if (line) point = { x: (line.p1.x + line.p2.x) / 2, y: (line.p1.y + line.p2.y) / 2 };
        }
        if (kind === "circle") {
          const circle = model.circles.find((item) => item.id === id);
          if (circle) point = { x: circle.center.x + circle.radius(), y: circle.center.y };
        }
        if (kind === "arc") {
          const arc = model.arcs.find((item) => item.id === id);
          if (arc) {
            const angle = detail === "start" ? arc.startAngle : detail === "end" ? arc.endAngle : arc.startAngle + (arc.endAngle - arc.startAngle) / 2;
            point = { x: arc.center.x + arc.radius() * Math.cos(angle), y: arc.center.y + arc.radius() * Math.sin(angle) };
          }
        }
        if (kind === "spline") {
          const spline = model.splines.find((item) => item.id === id);
          if (spline) point = window.SplineGeometry.evaluate(spline.curve(), detail === "start" ? 0 : detail === "end" ? 1 : 0.5);
        }
        return point ? this.worldClientPositionForTest(point) : null;
      },
      hoverDisplayStateForTest(kind, id) {
        let item = null;
        if (kind === "point") item = allGeometryPoints().find((value) => value.id === id);
        if (kind === "line") item = allGeometryLines().find((value) => value.id === id);
        if (kind === "circle") item = allGeometryCircles().find((value) => value.id === id);
        if (kind === "arc") item = allGeometryArcs().find((value) => value.id === id);
        if (kind === "spline") item = allGeometrySplines().find((value) => value.id === id);
        if (kind === "block") {
          const instance = blockInstanceById(id);
          item = instance ? blockProjectionBundle(instance).lines[0] || blockProjectionBundle(instance).circles[0] || blockProjectionBundle(instance).arcs[0] || blockProjectionBundle(instance).splines?.[0] : null;
        }
        if (!item) return null;
        const appearance = effectiveAppearanceForElement(item);
        const treeHovered = isSidebarHighlightedElement(item) && (!(item instanceof Point) || (!item.blockProjection && !isAnyLineEndpoint(item)));
        const sidebarHovered = isSidebarHoveredElement(item);
        const canvasHovered = hoveredLine === item || hoveredCircle === item || hoveredArc === item || hoveredSpline === item || hoveredPoint === item || hoveredEndpointPoint === item;
        const blockHovered = Boolean(item.blockInstance && hoveredBlockInstance === item.blockInstance);
        const hovered = treeHovered || sidebarHovered || canvasHovered || blockHovered;
        return {
          treeHovered,
          sidebarHovered,
          canvasHovered,
          blockHovered,
          color: geometryDisplayColor(item, appearance, false, hovered),
          width: geometryStrokeWidth(item, { hovered, appearance, construction: Boolean(item.construction) }),
        };
      },
      snapLabelsAtWorldForTest(point) {
        const source = { x: Number(point?.x) || 0, y: Number(point?.y) || 0 };
        const threshold = 10 / viewport.scale;
        return snapCandidates(source).filter((candidate) => candidate.distance <= threshold).map((candidate) => candidate.label);
      },
      authoringStateForTest() {
        return {
          mode,
          pendingConstraintType: pendingConstraintCommand?.type || null,
          pendingCommandType: pendingCommand?.type || null,
          pendingPlacementPoint: pendingCommand?.type === "distance-place" && pendingCommand.pointer
            ? { x: pendingCommand.pointer.x, y: pendingCommand.pointer.y }
            : null,
          pendingCommandPreview: pendingCommand?.type === "fillet-radius-place"
            ? pendingCommand.preview
            : null,
          activeSnapLabel: drawingSnap.active?.label || null,
          centerlineTargetIds: centerlineCommand.targets.map((item) => item.id),
          centerlineFirstPoint: centerlineCommand.firstPoint ? { ...centerlineCommand.firstPoint } : null,
          pointCount: model.points.length,
          lineCount: model.lines.length,
          circleCount: model.circles.length,
          arcCount: model.arcs.length,
          splineCount: model.splines.length,
          constraintCount: model.constraints.length,
          fixedPointIds: model.points.filter((point) => point.fixed).map((point) => point.id),
          lastLine: model.lines.length > 0 ? { id: model.lines[model.lines.length - 1].id, construction: Boolean(model.lines[model.lines.length - 1].construction) } : null,
          lastConstraint: model.constraints.length > 0 ? decorateSerializedConstraint(serializeConstraint(model.constraints[model.constraints.length - 1]), model.constraints[model.constraints.length - 1]) : null,
          lastPerformance: lastAuthoringPerformance ? { ...lastAuthoringPerformance } : null,
          selected: this.selectedGeometryIdsForTest(),
        };
      },
      selectableLineClientPositionForTest() {
        const rect = canvas.getBoundingClientRect();
        for (const line of model.lines) {
          for (const t of [0.37, 0.63, 0.5]) {
            const world = {
              x: line.p1.x + (line.p2.x - line.p1.x) * t,
              y: line.p1.y + (line.p2.y - line.p1.y) * t,
            };
            if (hitPoint(world.x, world.y) || hitLine(world.x, world.y) !== line || hitDimension(world.x, world.y)) continue;
            const screen = worldToCanvasScreen(world);
            const x = rect.left + screen.x;
            const y = rect.top + screen.y;
            if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
            if (document.elementFromPoint(x, y) !== canvas) continue;
            return { id: line.id, x, y };
          }
        }
        return null;
      },
      guidedPointDragForTest(id, dx, dy) {
        const point = model.points.find((item) => item.id === id);
        if (!point) return null;
        const startPointer = { x: point.x, y: point.y };
        const session = buildDragSession("point", point, startPointer);
        if (!session) return null;
        attachLocalSolveContext(session);
        const target = { x: startPointer.x + dx, y: startPointer.y + dy };
        const previewResult = dragResultForSession(session, target);
        const previewPoint = { x: point.x, y: point.y };
        const finalResult = solveFinalDragSession(session);
        normalizeArcSweeps();
        const baseErrorNorm = vectorNorm(solver.computeErrorVectorForConstraints(sketchSolveConstraints(session.sketchId)));
        return {
          target,
          targetConstraintCount: session.finalDragConstraints?.length || 0,
          preview: {
            success: previewResult.success,
            errorNorm: previewResult.errorNorm,
            acceptError: previewResult.acceptError,
            iterations: previewResult.iterations,
            point: previewPoint,
          },
          final: {
            success: finalResult.success,
            errorNorm: finalResult.errorNorm,
            baseErrorNorm,
            iterations: finalResult.iterations,
            point: { x: point.x, y: point.y },
          },
        };
      },
      guidedPointDragPathForTest(id, deltas) {
        const point = model.points.find((item) => item.id === id);
        if (!point) return null;
        const startPointer = { x: point.x, y: point.y };
        const session = buildDragSession("point", point, startPointer);
        if (!session) return null;
        attachLocalSolveContext(session);
        const previews = [];
        for (const [dx, dy] of deltas) {
          const target = { x: startPointer.x + dx, y: startPointer.y + dy };
          const startedAt = performance.now();
          const result = dragResultForSession(session, target);
          previews.push({
            success: result.success,
            blocked: result.blocked,
            errorNorm: result.errorNorm,
            acceptError: result.acceptError,
            iterations: result.iterations,
            elapsedMs: performance.now() - startedAt,
            target,
            targetNorm: result.targetNorm,
            targetStepNorm: result.targetStepNorm,
            projectedNorm: result.projectedNorm,
            projectedErrorNorm: result.projectedErrorNorm,
            targetErrorNorm: result.targetErrorNorm,
            targetConstraintCount: result.targetConstraints?.length || 0,
            freeDof: result.freeDof,
            targetActivity: result.targetActivity,
            variableCount: result.variableCount,
            constraintCount: result.constraintCount,
            reason: result.reason,
            local: result.local,
            guided: result.guided,
            fallback: result.fallback,
            point: { x: point.x, y: point.y },
          });
        }
        const finalResult = solveFinalDragSession(session);
        normalizeArcSweeps();
        const baseErrorNorm = vectorNorm(solver.computeErrorVectorForConstraints(sketchSolveConstraints(session.sketchId)));
        return {
          startPoint: startPointer,
          previews,
          final: {
            success: finalResult.success,
            errorNorm: finalResult.errorNorm,
            baseErrorNorm,
            iterations: finalResult.iterations,
            reason: finalResult.reason,
            point: { x: point.x, y: point.y },
          },
        };
      },
      geometryDragPathForTest(descriptor, deltas) {
        const kind = descriptor?.kind;
        const id = descriptor?.id;
        const endpoint = descriptor?.endpoint === "end" ? "end" : "start";
        const fraction = Number.isFinite(descriptor?.fraction) ? Math.max(0, Math.min(1, descriptor.fraction)) : 0.5;
        let item = null;
        let sessionItem = null;
        let startPointer = null;
        if (kind === "point") {
          item = model.points.find((candidate) => candidate.id === id);
          sessionItem = item;
          if (item) startPointer = { x: item.x, y: item.y };
        } else if (kind === "line") {
          item = model.lines.find((candidate) => candidate.id === id);
          sessionItem = item;
          if (item) startPointer = { x: item.p1.x + fraction * (item.p2.x - item.p1.x), y: item.p1.y + fraction * (item.p2.y - item.p1.y) };
        } else if (kind === "circle") {
          item = model.circles.find((candidate) => candidate.id === id);
          sessionItem = item;
          if (item) startPointer = { x: item.center.x + item.radius(), y: item.center.y };
        } else if (kind === "arc") {
          item = model.arcs.find((candidate) => candidate.id === id);
          sessionItem = item;
          if (item) {
            const angle = item.startAngle + fraction * (item.endAngle - item.startAngle);
            startPointer = { x: item.center.x + item.radius() * Math.cos(angle), y: item.center.y + item.radius() * Math.sin(angle) };
          }
        } else if (kind === "arc-endpoint") {
          item = model.arcs.find((candidate) => candidate.id === id);
          sessionItem = item ? { arc: item, endpoint } : null;
          if (item) startPointer = arcEndpointPoint(item, endpoint);
        }
        if (!item || !startPointer) return null;

        const snapshot = () => {
          if (kind === "point") return { x: item.x, y: item.y };
          if (kind === "line") {
            return {
              p1: { x: item.p1.x, y: item.p1.y },
              p2: { x: item.p2.x, y: item.p2.y },
              midpoint: { x: (item.p1.x + item.p2.x) / 2, y: (item.p1.y + item.p2.y) / 2 },
              length: item.length(),
            };
          }
          if (kind === "circle") return { center: { x: item.center.x, y: item.center.y }, radius: item.radius() };
          const start = arcEndpointPoint(item, "start");
          const end = arcEndpointPoint(item, "end");
          return {
            center: { x: item.center.x, y: item.center.y },
            radius: item.radius(),
            start,
            end,
            draggedEndpoint: kind === "arc-endpoint" ? (endpoint === "start" ? start : end) : null,
          };
        };

        const session = buildDragSession(kind, sessionItem, startPointer);
        const startState = snapshot();
        if (!session) return { sessionAvailable: false, startPointer, startState, previews: [], final: null };
        attachLocalSolveContext(session);
        const previews = [];
        for (const [dx, dy] of deltas) {
          const target = { x: startPointer.x + dx, y: startPointer.y + dy };
          const startedAt = performance.now();
          const result = dragResultForSession(session, target);
          previews.push({
            success: result.success,
            blocked: result.blocked,
            errorNorm: result.errorNorm,
            acceptError: result.acceptError,
            iterations: result.iterations,
            elapsedMs: performance.now() - startedAt,
            target,
            targetNorm: result.targetNorm,
            targetStepNorm: result.targetStepNorm,
            projectedNorm: result.projectedNorm,
            projectedErrorNorm: result.projectedErrorNorm,
            targetErrorNorm: result.targetErrorNorm,
            freeDof: result.freeDof,
            variableCount: result.variableCount,
            constraintCount: result.constraintCount,
            guidedRetryCount: result.guidedRetryCount,
            pinnedLineTargets: Boolean(result.pinnedLineTargets),
            radialObjective: Boolean(result.radialObjective),
            exactSparseLine: Boolean(result.exactSparseLine),
            guidedSubstepCount: result.guidedSubstepCount || 0,
            reason: result.reason,
            local: result.local,
            guided: result.guided,
            fallback: result.fallback,
            localErrorNorm: result.localErrorNorm,
            state: snapshot(),
            constraintState: descriptor.inspectConstraints ? this.constraintStatusesForTest() : undefined,
          });
        }
        const finalResult = solveFinalDragSession(session);
        normalizeArcSweeps();
        const baseErrorNorm = vectorNorm(solver.computeErrorVectorForConstraints(sketchSolveConstraints(session.sketchId)));
        return {
          sessionAvailable: true,
          representativePointId: session.lineDragPoint?.point.id || null,
          startPointer,
          startState,
          previews,
          final: {
            success: finalResult.success,
            errorNorm: finalResult.errorNorm,
            baseErrorNorm,
            iterations: finalResult.iterations,
            reason: finalResult.reason,
            state: snapshot(),
          },
        };
      },
      constraintStatusesForTest() {
        const state = refreshConstraintAnalysis();
        return {
          stable: state.analysis.stable,
          errorNorm: state.analysis.errorNorm,
          freeDof: state.analysis.freeVariableCount,
          items: [...state.statuses].filter(([item]) => elementSketchId(item) === activeSketchId())
            .map(([item, status]) => ({ id: item.id, status })),
        };
      },
      constraintAnalysisForTest() {
        const sketchId = activeSketchId();
        const variables = sketchSolveVariables(sketchId);
        const constraints = sketchSolveConstraints(sketchId);
        const analysis = solver.analyzeConstraintState({
          variables,
          constraints,
          lines: sketchSolveLines(sketchId),
          errorTolerance: CONSTRAINT_ACCEPT_ERROR,
        });
        const largestConstraintErrors = constraints
          .map((constraint, index) => {
            const error = constraint.error();
            const values = Array.isArray(error) ? error : [error];
            return {
              index,
              name: constraint.name,
              type: constraint.constructor.name,
              errorNorm: vectorNorm(values),
            };
          })
          .filter((entry) => entry.errorNorm > 1e-8)
          .sort((a, b) => b.errorNorm - a.errorNorm)
          .slice(0, 12);
        return {
          stable: analysis.stable,
          errorNorm: analysis.errorNorm,
          rank: analysis.rank,
          variableCount: analysis.variableCount,
          freeVariableCount: analysis.freeVariableCount,
          constraintCount: constraints.length,
          pointCount: model.points.filter((point) => elementSketchId(point) === sketchId).length,
          lineCount: model.lines.filter((line) => elementSketchId(line) === sketchId).length,
          circleCount: model.circles.filter((circle) => elementSketchId(circle) === sketchId).length,
          arcCount: model.arcs.filter((arc) => elementSketchId(arc) === sketchId).length,
          splineCount: model.splines.filter((spline) => elementSketchId(spline) === sketchId).length,
          largestConstraintErrors,
        };
      },
      blockConstraintStatusForTest(instanceId = null) {
        const state = refreshConstraintAnalysis();
        const bundles = blockProjectionBundles().filter((bundle) => !instanceId || bundle.instance.id === instanceId);
        return {
          stable: state.analysis.stable,
          summary: { ...state.summary },
          projections: bundles.flatMap((bundle) => [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])].map((item) => ({
            id: item.id,
            status: state.statuses.get(item) || null,
          }))),
        };
      },
      addBlockPointOnLineConstraintForTest(pointInstanceId, pointLocalId, lineInstanceId, lineLocalId) {
        const pointInstance = blockInstanceById(pointInstanceId);
        const lineInstance = blockInstanceById(lineInstanceId);
        const point = pointInstance ? blockProjectionBundle(pointInstance).points.find((item) => item.localElement?.id === pointLocalId) : null;
        const line = lineInstance ? blockProjectionBundle(lineInstance).lines.find((item) => item.localElement?.id === lineLocalId) : null;
        if (!point || !line) return { committed: false, reason: "projection-not-found" };
        const committed = commitNewConstraint("coincident", new PointOnLineConstraint(point, line)) === true;
        return {
          committed,
          analysis: this.constraintAnalysisForTest(),
          status: this.blockConstraintStatusForTest(pointInstanceId),
          serialized: serializeModel(),
        };
      },
      resetForAnnotationDrag() {
        resetModelState();
        const p1 = addPoint(-60, -25, false, "endpoint");
        const p2 = addPoint(60, -25, false, "endpoint");
        const p3 = addPoint(60, 35, false, "endpoint");
        const p4 = addPoint(-60, 35, false, "endpoint");
        addLine(p1, p2);
        addLine(p2, p3);
        const l3 = addLine(p3, p4);
        addLine(p4, p1);
        const leaderTarget = annotationLeaderTargetFromItem(l3, { x: 0, y: 35 });
        pushAnnotation({
          type: "leader",
          text: "注記",
          start: { ...leaderTarget.anchor },
          elbow: { x: 56, y: 82 },
          end: { x: 112, y: 82 },
          geometryRef: leaderTarget.geometryRef,
          style: { ...DEFAULT_ANNOTATION_STYLE },
        });
        pushAnnotation({ type: "text", text: "自由テキスト", x: -90, y: 80, style: { ...DEFAULT_ANNOTATION_STYLE } });
        resizeCanvas({ centerWorld: { x: 20, y: 20 } });
        return this.annotationSnapshot();
      },
      resetForReadOnlyDuplicateDimension() {
        resetModelState();
        const p1 = addPoint(-50, 0, false, "endpoint");
        const p2 = addPoint(50, 0, false, "endpoint");
        const line = addLine(p1, p2);
        const target = { kind: "line-length", line, p1, p2, value: line.length() };
        const firstDimension = dimensionFromAnchor(target, { x: 0, y: -28 });
        const first = addDistanceConstraintFromTarget(target, line.length(), firstDimension, { sketchId: activeSketchId() });
        const second = addDistanceConstraintFromTarget(target, line.length(), dimensionFromAnchor(target, { x: 0, y: -54 }), { sketchId: activeSketchId() });
        const dimensionConstraints = model.constraints.filter(isDimensionConstraint);
        const layout = dimensionLayout(target, firstDimension);
        const extensionAlignmentErrors = layout.points.map((point) => {
          const vx = point.extensionEnd.x - point.extensionStart.x;
          const vy = point.extensionEnd.y - point.extensionStart.y;
          const wx = point.source.x - point.extensionStart.x;
          const wy = point.source.y - point.extensionStart.y;
          return Math.abs(vx * wy - vy * wx) / Math.max(hypot2(vx, vy), 1e-12);
        });
        return {
          first,
          second,
          count: dimensionConstraints.length,
          enabledCount: dimensionConstraints.filter((constraint) => constraint.enabled !== false).length,
          readOnlyCount: dimensionConstraints.filter(isReadOnlyDimension).length,
          labels: dimensionConstraints.map((constraint) => dimensionLabelForConstraint(constraint, targetFromConstraint(constraint), constraint.dimension || defaultDimensionForTarget(targetFromConstraint(constraint)))),
          serializedReadOnlyCount: serializeModel().constraints.filter((constraint) => constraint.readOnlyDimension).length,
          extensionAlignmentErrors,
        };
      },
      resetForReadOnlyDimensionPlacement() {
        resetModelState();
        const p1 = addPoint(-50, 0, false, "endpoint");
        const p2 = addPoint(50, 0, false, "endpoint");
        const line = addLine(p1, p2);
        const target = { kind: "line-length", line, p1, p2, value: line.length() };
        addDistanceConstraintFromTarget(target, line.length(), dimensionFromAnchor(target, { x: 0, y: -28 }), { sketchId: activeSketchId() });
        pendingConstraintCommand = { type: "distance" };
        pendingCommand = {
          type: "distance-place",
          target,
          pointer: { x: 0, y: -54 },
          sketchId: activeSketchId(),
        };
        startDistanceValueInput({ x: 0, y: -54 });
        return {
          pendingType: pendingCommand?.type || null,
          inputHidden: dimensionValueInput.hidden,
          readOnlyCount: model.constraints.filter(isReadOnlyDimension).length,
          dimensionCount: model.constraints.filter(isDimensionConstraint).length,
        };
      },
      pointPointRectangleDimensionExtensionVisibilityCases() {
        resetModelState();
        const p1 = addPoint(160, 160, true, "endpoint");
        const p2 = addPoint(297.73401510731196, 185.0866714097212, false, "endpoint");
        const p3 = addPoint(279.8149641009543, 283.468110772277, false, "endpoint");
        const p4 = addPoint(142.08094899119854, 258.38143937826186, false, "endpoint");
        addLine(p1, p2);
        const sideLine = addLine(p2, p3);
        addLine(p3, p4);
        addLine(p4, p1);
        const topTarget = { kind: "point-point", p1, p2, value: hypot2(p2.x - p1.x, p2.y - p1.y) };
        const sideTarget = { kind: "point-point", p1: p2, p2: p3, value: hypot2(p3.x - p2.x, p3.y - p2.y) };
        const sideLineTarget = { kind: "line-length", line: sideLine, p1: p2, p2: p3, value: sideLine.length() };
        const visibleFlags = (target, dimension) => {
          const layout = dimensionLayout(target, dimension);
          return layout.points.map((point) => point.showExtension !== false);
        };
        const previewFlags = (target, pointer) => {
          const dimension = dimensionWithLabelAt(target, dimensionFromAnchor(target, pointer), pointer);
          return visibleFlags(target, dimension);
        };
        const leftPointer = { x: 109.1051908103851, y: 208.70539753179494 };
        return {
          top: visibleFlags(topTarget, {
            x: 275.2991240975706,
            y: 146.73754454625083,
            offsetU: 41.05643170185708,
            offsetN: -33.70830342779351,
            labelOffsetU: 42.71350462481912,
            axis: null,
          }),
          left: visibleFlags(sideTarget, {
            x: 109.1051908103851,
            y: 208.70539753179494,
            offsetU: 7.036937956365918,
            offsetN: 181.34350081496538,
            labelOffsetU: 5.954777756734029,
            axis: null,
          }),
          pointPointPreviewLeft: previewFlags(sideTarget, leftPointer),
          lineLengthPreviewLeft: previewFlags(sideLineTarget, leftPointer),
        };
      },
      dimensionDisplayPrecisionCases() {
        return {
          integerTrailingZero: formatDimensionLabel(140),
          integerHundred: formatDimensionLabel(100),
          positiveNoise: formatDimensionLabel(15.0000000058),
          negativeNoise: formatDimensionLabel(824.9999999982),
          precisionBoundaryNoise: formatDimensionLabel(1844.999999),
          measuredAccumulatedNoise: formatMeasuredDimensionLabel(1844.9999986000548),
          minimumResolution: formatDimensionLabel(0.000001),
          measuredMinimumResolution: formatMeasuredDimensionLabel(0.000001),
          roundedFraction: formatDimensionLabel(1.2345674),
        };
      },
      dimensionTextAngleCases() {
        const resultForDrawingAngle = (degrees) => {
          const radians = (degrees * Math.PI) / 180;
          const direction = { x: Math.cos(radians), y: -Math.sin(radians) };
          const angle = jisDimensionTextAngle(direction);
          return {
            angle: (angle * 180) / Math.PI,
            offset: dimensionTextOffset(angle, 1),
          };
        };
        return {
          zero: resultForDrawingAngle(0),
          quadrant1: resultForDrawingAngle(30),
          vertical90: resultForDrawingAngle(90),
          quadrant2: resultForDrawingAngle(150),
          straight180: resultForDrawingAngle(180),
          quadrant3: resultForDrawingAngle(210),
          vertical270: resultForDrawingAngle(270),
          quadrant4: resultForDrawingAngle(330),
          quadrant4NearVertical: resultForDrawingAngle(273),
        };
      },
      angleDimensionLabelFollowCase() {
        resetModelState();
        const p1 = addPoint(-80, 0, false, "endpoint");
        const p2 = addPoint(80, 0, false, "endpoint");
        const p3 = addPoint(0, -80, false, "endpoint");
        const p4 = addPoint(0, 80, false, "endpoint");
        const line1 = addLine(p1, p2);
        const line2 = addLine(p3, p4);
        const target = { kind: "angle", line1, line2, value: 90 };
        const initial = dimensionFromAnchor(target, { x: 45, y: 45 });
        const initialBasis = angleDimensionLabelBasis(target, initial);
        initial.labelX = initialBasis.arcPoint.x + initialBasis.radial.x * 11 + initialBasis.tangent.x * 7;
        initial.labelY = initialBasis.arcPoint.y + initialBasis.radial.y * 11 + initialBasis.tangent.y * 7;

        const corruptedRelativePlacement = {
          ...dimensionFromAnchor(target, { x: 45, y: 45 }),
          angleLabelOffsetR: 27.337291652719134,
          angleLabelOffsetT: -6.399630529188789,
        };
        angleDimensionLayout(target, corruptedRelativePlacement);
        const recoveredCorruptedOffsets = angleDimensionLabelOffsets(target, corruptedRelativePlacement);

        const before = angleDimensionLayout(target, initial);
        const beforeBasis = angleDimensionLabelBasis(target, initial);
        const translation = { x: 34, y: -19 };
        for (const point of [p1, p2, p3, p4]) {
          point.x += translation.x;
          point.y += translation.y;
        }
        const afterTranslation = angleDimensionLayout(target, initial);
        const afterTranslationBasis = angleDimensionLabelBasis(target, initial);
        const labelTranslationError = hypot2(
          afterTranslation.text.x - before.text.x - translation.x,
          afterTranslation.text.y - before.text.y - translation.y,
        );
        const arcTranslationError = hypot2(
          afterTranslationBasis.arcPoint.x - beforeBasis.arcPoint.x - translation.x,
          afterTranslationBasis.arcPoint.y - beforeBasis.arcPoint.y - translation.y,
        );

        const storedOffsets = angleDimensionLabelOffsets(target, initial);
        const movedAnchor = {
          x: afterTranslationBasis.arcPoint.x + afterTranslationBasis.radial.x * 26,
          y: afterTranslationBasis.arcPoint.y + afterTranslationBasis.radial.y * 26,
        };
        const movedDimension = dimensionFromAnchor(target, movedAnchor, { allowPointAxis: false });
        setAngleDimensionLabelOffsets(movedDimension, storedOffsets);
        const afterRadiusMove = angleDimensionLayout(target, movedDimension);
        const afterRadiusMoveBasis = angleDimensionLabelBasis(target, movedDimension);
        const labelRadiusDelta = {
          x: afterRadiusMove.text.x - afterTranslation.text.x,
          y: afterRadiusMove.text.y - afterTranslation.text.y,
        };
        const arcRadiusDelta = {
          x: afterRadiusMoveBasis.arcPoint.x - afterTranslationBasis.arcPoint.x,
          y: afterRadiusMoveBasis.arcPoint.y - afterTranslationBasis.arcPoint.y,
        };
        let repeatedlyDraggedDimension = movedDimension;
        const dragOffsets = angleDimensionLabelOffsets(target, repeatedlyDraggedDimension);
        let repeatedDragOffsetError = 0;
        let repeatedDragRadialPointerError = 0;
        for (let index = 0; index < 8; index++) {
          const currentLayout = angleDimensionLayout(target, repeatedlyDraggedDimension);
          const pointer = {
            x: currentLayout.text.x + (index % 2 === 0 ? 13 : -9),
            y: currentLayout.text.y + (index % 3 === 0 ? 8 : -6),
          };
          repeatedlyDraggedDimension = angleDimensionFromLabelPoint(
            target,
            pointer,
            angleDimensionLabelOffsets(target, repeatedlyDraggedDimension),
          );
          const nextOffsets = angleDimensionLabelOffsets(target, repeatedlyDraggedDimension);
          const nextLayout = angleDimensionLayout(target, repeatedlyDraggedDimension);
          const nextBasis = angleDimensionLabelBasis(target, repeatedlyDraggedDimension);
          repeatedDragOffsetError = Math.max(
            repeatedDragOffsetError,
            hypot2(nextOffsets.radial - dragOffsets.radial, nextOffsets.tangent - dragOffsets.tangent),
          );
          repeatedDragRadialPointerError = Math.max(
            repeatedDragRadialPointerError,
            Math.abs(
              (nextLayout.text.x - pointer.x) * nextBasis.radial.x +
              (nextLayout.text.y - pointer.y) * nextBasis.radial.y,
            ),
          );
        }
        const serialized = serializeDimension(repeatedlyDraggedDimension, target);
        return {
          migratedLegacyCoordinates: !Object.hasOwn(initial, "labelX") && !Object.hasOwn(initial, "labelY"),
          recoveredCorruptedOffsets,
          storedOffsets,
          labelTranslationError,
          arcTranslationError,
          radiusFollowError: hypot2(labelRadiusDelta.x - arcRadiusDelta.x, labelRadiusDelta.y - arcRadiusDelta.y),
          repeatedDragOffsetError,
          repeatedDragRadialPointerError,
          serializedRelativeOffsets: Number.isFinite(serialized.angleLabelOffsetR) && Number.isFinite(serialized.angleLabelOffsetT),
          serializedPlacementVersion: serialized.angleLabelPlacementVersion,
          serializedLegacyCoordinates: Object.hasOwn(serialized, "labelX") || Object.hasOwn(serialized, "labelY"),
        };
      },
      resetForTrimConstraintTransfer() {
        resetModelState();
        const p1 = addPoint(0, 0, false, "endpoint");
        const p2 = addPoint(100, 0, false, "endpoint");
        const line = addLine(p1, p2);
        const leftPoint = addPoint(25, 0, false, "endpoint");
        const rightPoint = addPoint(75, 0, false, "endpoint");
        const leftConstraint = pushModelConstraint(new PointOnLineConstraint(leftPoint, line));
        const rightConstraint = pushModelConstraint(new PointOnLineConstraint(rightPoint, line));
        executeLineTrim({
          kind: "line",
          item: line,
          interval: {
            left: { t: 0.4, point: { x: 40, y: 0 }, source: {} },
            right: { t: 0.6, point: { x: 60, y: 0 }, source: {} },
          },
        });
        const rightLine = model.lines.find((candidate) => candidate !== line);
        return {
          lineCount: model.lines.length,
          leftConstraintOnLeftLine: leftConstraint.line === line,
          rightConstraintOnRightLine: rightConstraint.line === rightLine,
          leftLineEnd: { x: line.p2.x, y: line.p2.y },
          rightLineStart: rightLine ? { x: rightLine.p1.x, y: rightLine.p1.y } : null,
        };
      },
      trimConstructionBoundaryCase() {
        resetModelState();
        const point = (x, y) => addPoint(x, y, false, "endpoint");
        const line = (x1, y1, x2, y2, construction = false) => addLine(point(x1, y1), point(x2, y2), construction);

        const lineTarget = line(-100, 0, 100, 0);
        line(-60, -120, -60, 120);
        line(60, -120, 60, 120);
        line(0, -120, 0, 120, true);
        addCircle(point(0, 0), 30, true);
        addArc(point(0, 0), 45, 0, Math.PI, true);

        const arcTarget = addArc(point(0, 400), 100, 0, Math.PI);
        line(0, 350, 0, 550);
        line(50, 350, 50, 550, true);
        addCircle(point(50, 400), 100, true);
        addArc(point(-50, 400), 100, 0, Math.PI, true);

        const circleTarget = addCircle(point(0, 800), 100);
        line(0, 650, 0, 950);
        line(50, 650, 50, 950, true);
        addCircle(point(50, 800), 100, true);
        addArc(point(-50, 800), 100, 0, Math.PI, true);

        const lineBoundaries = lineTrimBoundaries(lineTarget);
        const linePreview = trimPreviewForLine(lineTarget, { x: 0, y: 0 });
        const arcBoundaries = arcTrimBoundaries(arcTarget);
        const arcPreview = trimPreviewForArc(arcTarget, circlePointAtAngle(arcTarget, Math.PI / 4));
        const circleBoundaries = circleTrimBoundaries(circleTarget);
        const circlePreview = trimPreviewForCircle(circleTarget, circlePointAtAngle(circleTarget, 0));
        return {
          lineBoundaryXs: lineBoundaries.map((boundary) => boundary.point.x),
          lineIntervalXs: [linePreview?.interval?.left?.point?.x, linePreview?.interval?.right?.point?.x],
          arcBoundaryParameters: arcBoundaries.map((boundary) => boundary.t),
          arcIntervalParameters: [arcPreview?.interval?.left?.t, arcPreview?.interval?.right?.t],
          circleBoundaryParameters: circleBoundaries.map((boundary) => boundary.t),
          circleIntervalParameters: [circlePreview?.interval?.left?.t, circlePreview?.interval?.right?.t],
        };
      },
      trimCircleDiameterDimensionCase(boundaryCount = 2) {
        resetModelState();
        const circle = addCircle(addPoint(0, 0, false, "center"), 50);
        const diameter = pushModelConstraint(new DiameterConstraint(circle, 100));
        diameter.dimension = {
          x: 70,
          y: 0,
          labelOffsetU: 8,
          display: { color: "#7c3aed", prefix: "Ø" },
        };
        const count = Math.max(2, Math.floor(Number(boundaryCount) || 2));
        const boundaries = Array.from({ length: count }, (_, index) => {
          const t = index / count;
          const angle = angleAtCircleParam(t);
          return { t, angle, point: circlePointAtAngle(circle, angle), source: {} };
        });
        executeCircleTrim({
          kind: "circle",
          item: circle,
          interval: {
            left: { ...boundaries[0], angle: angleAtCircleParam(boundaries[0].t) },
            right: { ...boundaries[1], angle: angleAtCircleParam(boundaries[1].t) },
          },
          boundaries,
        });
        const retained = model.constraints.find((constraint) => constraint instanceof DiameterConstraint);
        return {
          arcCount: model.arcs.length,
          diameterCount: model.constraints.filter((constraint) => constraint instanceof DiameterConstraint).length,
          retainedSameConstraint: retained === diameter,
          primitiveId: retained?.primitive?.id || null,
          target: retained?.target ?? null,
          parameterName: retained?.parameterName || null,
          expression: retained?.expression || null,
          dimension: retained?.dimension || null,
        };
      },
      annotationSnapshot() {
        const leaderElement = [...model.annotations].reverse().find((element) => element.type === "leader");
        const textElement = [...model.annotations].reverse().find((element) => element.type === "text");
        const canvasRect = canvas.getBoundingClientRect();
        const toViewport = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: canvasRect.left + screen.x, y: canvasRect.top + screen.y };
        };
        return {
          leader: leaderElement
            ? {
                world: { ...leaderElement.end },
                viewport: toViewport(leaderElement.end),
                end: { ...leaderElement.end },
                elbow: leaderElement.elbow ? { ...leaderElement.elbow } : null,
              }
            : null,
          text: textElement ? { world: { x: textElement.x, y: textElement.y }, viewport: toViewport(textElement) } : null,
        };
      },
      annotationAppearanceStateForTest(type = "text", scale = null) {
        const annotation = model.annotations.find((element) => element.type === type) || null;
        if (scale != null) viewport.update({ scale: clampZoom(Number(scale) || 1) });
        if (!annotation) return null;
        const style = normalizeAnnotationStyle(annotation.style);
        draw();
        return {
          style: structuredClone(style),
          rotation: Number(annotation.rotation) || 0,
          screenTextHeight: annotationTextWorldHeight(style) * viewport.scale,
          screenTerminatorSize: style.terminatorSize * ANNOTATION_SCREEN_PX_PER_MM,
          serialized: serializeAnnotation(annotation),
        };
      },
      annotationOwnershipStateForTest() {
        const rect = canvas.getBoundingClientRect();
        const clientPoint = (annotation) => {
          const screen = worldToCanvasScreen({ x: annotation.x, y: annotation.y });
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };
        return {
          direct: model.annotations.map((annotation) => ({ ...serializeAnnotation(annotation) })),
          projected: allAnnotations().filter((annotation) => annotation.blockProjection).map((annotation) => ({
            id: annotation.id,
            sketchId: annotation.sketchId,
            type: annotation.type,
            text: annotation.text,
            x: annotation.x,
            y: annotation.y,
            rotation: Number(annotation.rotation) || 0,
            visible: annotation.visible !== false,
            style: { ...(annotation.style || {}) },
            client: clientPoint(annotation),
            ownerId: annotation.blockInstance?.id || null,
          })),
          selectedIds: canvasSelection.annotations.map((annotation) => annotation.id),
          bounds: allGeometryBounds(),
        };
      },
      fitAllGeometryForTest(padding = 120) {
        const fitted = fitAllGeometryToViewport(Number(padding) || 120);
        draw();
        return fitted;
      },
      annotationHitAt(viewportPoint) {
        const canvasRect = canvas.getBoundingClientRect();
        const world = screenToWorld({ x: viewportPoint.x - canvasRect.left, y: viewportPoint.y - canvasRect.top });
        const hit = hitAnnotationElement(world.x, world.y);
        return hit ? { type: hit.type, part: hit.part } : null;
      },
      annotationDragActive() {
        const element = annotationById(annotationDragSession?.elementId);
        return annotationDragSession
          ? {
              type: annotationDragSession.hit?.type,
              hasStart: Boolean(annotationDragSession.start),
              elementId: element?.id || null,
            }
          : null;
      },
      historyState() {
        const history = activeEditHistory();
        return {
          undoCount: history.undoCount,
          redoCount: history.redoCount,
          blockEditing: Boolean(blockEditor.current),
          undoDisabled: document.getElementById("undoBtn")?.disabled,
          redoDisabled: document.getElementById("redoBtn")?.disabled,
          constructionLineMode,
          constructionButtonActive: document.getElementById("toolConstructionLine")?.classList.contains("active"),
        };
      },
      resetForActiveSketchDimensionVisibility() {
        resetModelState();
        const firstSketchId = activeSketchId();
        const p1 = addPoint(0, 0, false, "endpoint");
        const p2 = addPoint(100, 0, false, "endpoint");
        const firstLine = addLine(p1, p2);
        addDistanceConstraintFromTarget(
          { kind: "line-length", line: firstLine, p1, p2, value: firstLine.length() },
          firstLine.length(),
          dimensionFromAnchor({ kind: "line-length", line: firstLine, p1, p2, value: firstLine.length() }, { x: 50, y: -30 }),
          { sketchId: firstSketchId },
        );

        const secondSketchId = "S2";
        model.sketches.push({ id: secondSketchId, name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
        model.activeSketchId = secondSketchId;
        const p3 = addPoint(0, 80, false, "endpoint");
        const p4 = addPoint(160, 80, false, "endpoint");
        const secondLine = addLine(p3, p4);
        addDistanceConstraintFromTarget(
          { kind: "line-length", line: secondLine, p1: p3, p2: p4, value: secondLine.length() },
          secondLine.length(),
          dimensionFromAnchor({ kind: "line-length", line: secondLine, p1: p3, p2: p4, value: secondLine.length() }, { x: 80, y: 50 }),
          { sketchId: secondSketchId },
        );
        model.activeSketchId = firstSketchId;
        const captureDimensionLabels = () => {
          const labels = [];
          const originalFillText = ctx.fillText;
          ctx.fillText = (value) => labels.push(String(value));
          try {
            drawDimensions();
          } finally {
            ctx.fillText = originalFillText;
          }
          return labels;
        };
        const drawnDimensionLabels = captureDimensionLabels();
        sketchById(secondSketchId).appearance = { ...sketchById(secondSketchId).appearance, visible: false };
        const labelsAfterHidingSecondSketch = captureDimensionLabels();
        sketchById(secondSketchId).appearance = { ...sketchById(secondSketchId).appearance, visible: true };
        return {
          activeSketchId: firstSketchId,
          dimensionSketchIds: model.constraints.filter(isDimensionConstraint).map((constraint) => constraintSketchId(constraint)),
          drawnDimensionSketchIds: model.constraints
            .filter((constraint) => isDimensionConstraint(constraint) && isVisibleSketchId(constraintSketchId(constraint)))
            .map((constraint) => constraintSketchId(constraint)),
          drawnDimensionLabels,
          labelsAfterHidingSecondSketch,
        };
      },
      resetForAllGeometryFit() {
        resetModelState();
        const p1 = addPoint(-50000, -25000, false, "endpoint");
        const p2 = addPoint(-40000, -25000, false, "endpoint");
        addLine(p1, p2);
        const secondSketchId = "S2";
        model.sketches.push({ id: secondSketchId, name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
        model.activeSketchId = secondSketchId;
        const p3 = addPoint(45000, 30000, false, "endpoint");
        const p4 = addPoint(50000, 30000, false, "endpoint");
        addLine(p3, p4);
        viewport.update({ scale: 10 });
        viewport.update({ x: -100000 });
        viewport.update({ y: 50000 });
        fitAllGeometryToViewport();
        const bounds = allGeometryBounds();
        const screen = screenBoxForBounds(bounds);
        const rect = canvas.getBoundingClientRect();
        return {
          screen,
          canvas: { width: rect.width, height: rect.height },
          scale: viewport.scale,
        };
      },
      resetForMiddleButtonFit() {
        resetModelState();
        const nearLine = addLine(addPoint(0, 0, true, "endpoint"), addPoint(100, 0, true, "endpoint"));
        const hiddenSketchId = "S2";
        model.sketches.push({ id: hiddenSketchId, name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: false });
        const previousActive = model.activeSketchId;
        model.activeSketchId = hiddenSketchId;
        addLine(addPoint(10000, 0, true, "endpoint"), addPoint(10100, 0, true, "endpoint"));
        model.activeSketchId = previousActive;
        viewport.update({ scale: 0.02 });
        viewport.update({ x: 10 });
        viewport.update({ y: 10 });
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        return {
          click: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
          nearLineId: nearLine.id,
        };
      },
      middleButtonFitState() {
        const rect = canvas.getBoundingClientRect();
        return {
          scale: viewport.scale,
          visibleScreen: screenBoxForBounds(visibleGeometryBounds()),
          canvas: { width: rect.width, height: rect.height },
          hiddenVisible: isVisibleSketchId("S2"),
        };
      },
      canvasDashIsolationCases() {
        const results = {};
        const resetForCase = () => {
          resetModelState();
          viewport.update({ scale: 1 });
          viewport.update({ x: 0 });
          viewport.update({ y: 0 });
          pointerPreview = null;
          trimPreview = null;
          selectionRectSession = null;
          mode = "select";
        };
        const capture = (name, setup, drawFn) => {
          resetForCase();
          setup();
          ctx.setLineDash([13, 7]);
          drawFn();
          results[name] = ctx.getLineDash();
        };
        const makeBlockDefinition = () => {
          const definition = createEmptyBlockDefinition("Block-Dash");
          const p1 = new Point("BP1", 0, 0, false, "endpoint");
          const p2 = new Point("BP2", 40, 0, false, "endpoint");
          p1.sketchId = DEFAULT_SKETCH_ID;
          p2.sketchId = DEFAULT_SKETCH_ID;
          const line = new Line("BL1", p1, p2);
          line.sketchId = DEFAULT_SKETCH_ID;
          definition.points.push(p1, p2);
          definition.lines.push(line);
          documentModel.blockDefinitions.push(definition);
          return definition;
        };

        capture("line", () => {
          mode = "line";
          lineCommand.click({ x: 0, y: 0 });
          lineCommand.startPoint.fixed = true;
          pointerPreview = { x: 80, y: 0 };
        }, drawTemporaryLine);
        capture("rectangle", () => {
          mode = "rectangle";
          rectangleCommand.click({ x: 0, y: 0 }, null);
          pointerPreview = { x: 80, y: 45 };
        }, drawRectanglePreview);
        capture("slot", () => {
          mode = "slot";
          slotCommand.click({ x: 0, y: 0 }, null);
          slotCommand.click({ x: 80, y: 0 }, null);
          pointerPreview = { x: 40, y: 20 };
        }, drawSlotPreview);
        capture("circle", () => {
          mode = "circle";
          circularCommands.clickCircle({ x: 0, y: 0 }, null);
          Object.assign(circularCommands.circleCenterPoint, { fixed: true, kind: "center" });
          pointerPreview = { x: 35, y: 0 };
        }, drawCirclePreview);
        capture("arc", () => {
          mode = "arc";
          circularCommands.clickArc({ x: 0, y: 0 }, null);
          Object.assign(circularCommands.arcCenterPoint, { fixed: true, kind: "center" });
          circularCommands.clickArc({ x: 35, y: 0 }, null);
          pointerPreview = { x: 0, y: 35 };
        }, drawArcPreview);
        capture("offset", () => {
          mode = "offset";
          offsetSelection.selectSource(addLine(addPoint(0, 0, true, "endpoint"), addPoint(80, 0, true, "endpoint")));
          pointerPreview = { x: 40, y: 20 };
        }, drawOffsetPreview);
        capture("trim", () => {
          mode = "trim";
          trimPreview = {
            kind: "line",
            interval: {
              left: { point: { x: 0, y: 0 } },
              right: { point: { x: 80, y: 0 } },
            },
          };
        }, drawTrimPreview);
        capture("selection", () => {
          selectionRectSession = { start: { x: 0, y: 0 }, current: { x: 80, y: 45 } };
        }, drawSelectionRect);
        capture("blockPlacement", () => {
          const definition = makeBlockDefinition();
          mode = "block-place";
          blockPlacementCommand.prepare(definition.id, [DEFAULT_SKETCH_ID]);
          pointerPreview = { x: 120, y: 40 };
        }, drawBlockPlacementPreview);
        capture("blockHandles", () => {
          const definition = makeBlockDefinition();
          const instance = { id: "BI-DASH", definitionId: definition.id, sketchId: activeSketchId(), x: 20, y: 20, rotation: 0, fixed: false, enabledSketchIds: [DEFAULT_SKETCH_ID] };
          model.blockInstances.push(instance);
          canvasSelection.set("blockInstances", [instance]);
        }, drawBlockInstanceHandles);
        capture("annotationLeader", () => {}, () => drawAnnotationLeader({
          start: { x: 0, y: 0 },
          elbow: { x: 40, y: 15 },
          end: { x: 80, y: 15 },
          text: "note",
          style: {},
        }, true));
        capture("frame", () => {
          addLine(addPoint(0, 0, true, "endpoint"), addPoint(80, 0, true, "endpoint"));
        }, draw);
        return results;
      },
      resetForSidebarInspection() {
        resetModelState();
        const p1 = addPoint(-80, 0, true, "endpoint");
        const p2 = addPoint(20, 0, false, "endpoint");
        const line = addLine(p1, p2);
        const circleCenter = addPoint(80, 0, false, "endpoint");
        const circle = addCircle(circleCenter, 28);
        const arcCenter = addPoint(0, 80, false, "endpoint");
        const arc = addArc(arcCenter, 32, Math.PI, Math.PI * 1.75);
        const horizontal = pushModelConstraint(new HorizontalConstraint(line));
        horizontal.reference = true;
        const readOnly = new DistanceConstraint(p1, p2, line.length());
        readOnly.dimension = dimensionFromAnchor({ kind: "line-length", line, p1, p2, value: line.length() }, { x: -30, y: -28 });
        readOnly.readOnlyDimension = true;
        readOnly.enabled = false;
        assignConstraintSketchId(readOnly, activeSketchId());
        model.constraints.push(readOnly);
        updateUI();
        fitAllGeometryToViewport(140);
        draw();
        const rect = canvas.getBoundingClientRect();
        const lineMid = worldToCanvasScreen({ x: (line.p1.x + line.p2.x) / 2, y: (line.p1.y + line.p2.y) / 2 });
        return {
          line: line.id,
          lineEndpoints: [p1.id, p2.id],
          fixedPoint: p1.id,
          circle: circle.id,
          circleCenter: circleCenter.id,
          arc: arc.id,
          arcCenter: arcCenter.id,
          lineMid: { x: rect.left + lineMid.x, y: rect.top + lineMid.y },
          blank: { x: rect.left + rect.width - 35, y: rect.top + rect.height - 35 },
        };
      },
      resetForRootSketchTreeHoverTest() {
        resetModelState();
        const p1 = addPoint(-110, -45, false, "endpoint");
        const p2 = addPoint(-30, -45, false, "endpoint");
        const line = addLine(p1, p2);

        const secondSketchId = "S2";
        const childSketchId = "S3";
        model.sketches.push({ id: secondSketchId, name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {} });
        model.activeSketchId = secondSketchId;
        const circle = addCircle(addPoint(45, -35, false, "center"), 24);

        model.sketches.push({ id: childSketchId, name: "Sketch-2-1", parentSketchId: secondSketchId, kind: "sketch", appearance: {} });
        model.activeSketchId = childSketchId;
        const arc = addArc(addPoint(55, 55, false, "center"), 30, Math.PI, Math.PI * 1.8);

        const definition = createEmptyBlockDefinition("Root Hover Block");
        const bp1 = new Point("BP1", -25, 0, false, "endpoint");
        const bp2 = new Point("BP2", 25, 0, false, "endpoint");
        bp1.sketchId = DEFAULT_SKETCH_ID;
        bp2.sketchId = DEFAULT_SKETCH_ID;
        const blockLine = new Line("BL1", bp1, bp2);
        blockLine.sketchId = DEFAULT_SKETCH_ID;
        definition.points.push(bp1, bp2);
        definition.lines.push(blockLine);
        documentModel.blockDefinitions.push(definition);
        const instance = {
          id: `BI${blockInstanceSeq++}`,
          definitionId: definition.id,
          sketchId: secondSketchId,
          x: -35,
          y: 55,
          rotation: 0,
          fixed: false,
          rotationLocked: false,
          enabledSketchIds: [DEFAULT_SKETCH_ID],
          appearanceOverride: {},
        };
        model.blockInstances.push(instance);
        model.activeSketchId = DEFAULT_SKETCH_ID;
        invalidateBlockProjectionCache();
        updateUI();
        fitAllGeometryToViewport(150);
        draw();
        return {
          rootSketchId: ROOT_SKETCH_ID,
          secondSketchId,
          childSketchId,
          lineId: line.id,
          lineEndpointId: p1.id,
          circleId: circle.id,
          arcId: arc.id,
          blockInstanceId: instance.id,
        };
      },
      resetForFixedPointDisplayTest() {
        resetModelState();
        viewport.update({ scale: 1 });
        const point = addPoint(0, 0, true, "explicit");
        updateUI();
        fitAllGeometryToViewport(220);
        draw();
        const rect = canvas.getBoundingClientRect();
        return {
          pointId: point.id,
          point: this.worldClientPositionForTest(point),
          blank: { x: rect.left + rect.width - 30, y: rect.top + rect.height - 30 },
        };
      },
      resetForSketchTreeBlockHoverTest() {
        resetModelState();
        viewport.update({ scale: 1 });
        const definition = createEmptyBlockDefinition("Tree Hover Block");
        const lineP1 = new Point("BP1", -80, 0, false, "endpoint");
        const lineP2 = new Point("BP2", 80, 0, false, "endpoint");
        lineP1.sketchId = DEFAULT_SKETCH_ID;
        lineP2.sketchId = DEFAULT_SKETCH_ID;
        const blockLine = new Line("BL1", lineP1, lineP2);
        blockLine.sketchId = DEFAULT_SKETCH_ID;
        const explicitPoints = [
          new Point("BP3", -70, -45, false, "explicit"),
          new Point("BP4", 70, -45, false, "explicit"),
          new Point("BP5", -70, 45, false, "explicit"),
          new Point("BP6", 70, 45, false, "explicit"),
        ];
        explicitPoints.forEach((point) => {
          point.sketchId = DEFAULT_SKETCH_ID;
        });
        definition.points.push(lineP1, lineP2, ...explicitPoints);
        definition.lines.push(blockLine);
        documentModel.blockDefinitions.push(definition);
        const instance = {
          id: `BI${blockInstanceSeq++}`,
          definitionId: definition.id,
          sketchId: DEFAULT_SKETCH_ID,
          x: 0,
          y: 0,
          rotation: 0,
          fixed: false,
          rotationLocked: false,
          enabledSketchIds: [DEFAULT_SKETCH_ID],
          appearanceOverride: {},
        };
        model.blockInstances.push(instance);
        invalidateBlockProjectionCache();
        updateUI();
        fitAllGeometryToViewport(180);
        draw();
        const bundle = blockProjectionBundle(instance);
        return {
          sketchId: DEFAULT_SKETCH_ID,
          instanceId: instance.id,
          projectedExplicitPointIds: bundle.points.filter((point) => point.localElement?.kind === "explicit").map((point) => point.id),
          blockLineMid: this.worldClientPositionForTest({ x: 0, y: 0 }),
        };
      },
      resetForOffsetConstraints() {
        resetModelState();
        const lineP1 = addPoint(-120, -70, true, "endpoint");
        const lineP2 = addPoint(-20, -70, true, "endpoint");
        const sourceLine = addLine(lineP1, lineP2);
        const sourceCircle = addCircle(addPoint(80, -20, true, "center"), 30);
        const sourceArc = addArc(addPoint(0, 90, true, "center"), 40, 0, Math.PI / 2);
        pushModelConstraint(new RadiusConstraint(sourceCircle, 30));
        pushModelConstraint(new RadiusConstraint(sourceArc, 40));

        const lineCreated = createOffsetGeometry(sourceLine, 20, 1, { x: -70, y: -50 });
        const circleCreated = createOffsetGeometry(sourceCircle, 15, 1, { x: 125, y: -20 });
        const arcCreated = createOffsetGeometry(sourceArc, 10, -1, { x: 0, y: 120 });
        const offsets = model.constraints.filter((constraint) => constraint instanceof OffsetConstraint);
        offsets[0].target = 25;
        offsets[1].target = 18;
        offsets[2].target = 12;
        offsets[0].expression = "25";
        offsets[1].expression = "18";
        offsets[2].expression = "12";
        offsets.forEach(preconditionNewConstraint);
        solveSketchAndDependents(activeSketchId(), snapshotModelState());
        const measurements = offsets.map((constraint) => measuredConstraintTargetValue(constraint));
        const sourceRadii = [sourceCircle.radius(), sourceArc.radius()];
        const serialized = serializeModel();
        loadModelData(serialized);
        const restored = model.constraints.filter((constraint) => constraint instanceof OffsetConstraint);
        fitAllGeometryToViewport(140);
        draw();
        return {
          created: [lineCreated, circleCreated, arcCreated],
          measurements,
          sourceRadii,
          restoredCount: restored.length,
          restoredTypes: serializeModel().constraints.filter((constraint) => constraint.type === "offsetDimension").length,
          restoredTargets: restored.map((constraint) => constraint.target),
          geometry: { lines: model.lines.length, circles: model.circles.length, arcs: model.arcs.length },
        };
      },
      resetForOffsetUi() {
        resetModelState();
        const p1 = addPoint(-60, 0, false, "endpoint");
        const p2 = addPoint(60, 0, false, "endpoint");
        addLine(p1, p2);
        fitAllGeometryToViewport(220);
        draw();
        const rect = canvas.getBoundingClientRect();
        const source = worldToCanvasScreen({ x: 0, y: 0 });
        const side = worldToCanvasScreen({ x: 0, y: 35 });
        return {
          source: { x: rect.left + source.x, y: rect.top + source.y },
          side: { x: rect.left + side.x, y: rect.top + side.y },
        };
      },
      offsetUiState() {
        const constraints = model.constraints.filter((constraint) => constraint instanceof OffsetConstraint);
        const preview = offsetSelection.source && pointerPreview ? offsetDistanceFromPointer(offsetSelection.source, pointerPreview) : null;
        return {
          pendingType: pendingCommand?.type || null,
          lineCount: model.lines.length,
          constraintCount: constraints.length,
          targets: constraints.map((constraint) => constraint.target),
          toolActive: document.getElementById("toolOffset")?.classList.contains("active"),
          previewDistance: preview?.distance ?? null,
          previewSign: preview?.sign ?? null,
          lineOffsetDeltas: constraints
            .filter((constraint) => constraint.source instanceof Line)
            .map((constraint) => ({
              x: (constraint.offset.p1.x + constraint.offset.p2.x - constraint.source.p1.x - constraint.source.p2.x) / 2,
              y: (constraint.offset.p1.y + constraint.offset.p2.y - constraint.source.p1.y - constraint.source.p2.y) / 2,
            })),
        };
      },
      resetForOffsetDirection(directionCase = "vertical") {
        resetModelState();
        const horizontal = directionCase === "horizontal";
        const p1 = addPoint(horizontal ? 60 : 0, horizontal ? 0 : 60, false, "endpoint");
        const p2 = addPoint(horizontal ? -60 : 0, horizontal ? 0 : -60, false, "endpoint");
        const line = addLine(p1, p2);
        pushModelConstraint(horizontal ? new HorizontalConstraint(line) : new VerticalConstraint(line));
        solveAndRefresh("offset direction test");
        fitAllGeometryToViewport(220);
        draw();
        const rect = canvas.getBoundingClientRect();
        const screenPoint = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };
        return {
          source: screenPoint({ x: 0, y: 0 }),
          side: screenPoint(horizontal ? { x: 0, y: 35 } : { x: 35, y: 0 }),
          expectedAxis: horizontal ? "y" : "x",
        };
      },
      resetForOffsetChainUi() {
        resetModelState();
        const p1 = addPoint(-80, -45, false, "endpoint");
        const corner = addPoint(20, -45, false, "endpoint");
        const p3 = addPoint(20, 55, false, "endpoint");
        const line1 = addLine(p1, corner);
        const line2 = addLine(corner, p3);
        const disconnected = addLine(addPoint(75, -45, false, "endpoint"), addPoint(75, 35, false, "endpoint"));
        fitAllGeometryToViewport(220);
        resetHistory("offset chain test");
        draw();
        const rect = canvas.getBoundingClientRect();
        const screenPoint = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };
        return {
          first: screenPoint({ x: -30, y: -45 }),
          second: screenPoint({ x: 20, y: 5 }),
          disconnected: screenPoint({ x: 75, y: -5 }),
          side: screenPoint({ x: -30, y: -15 }),
          sourceIds: [line1.id, line2.id],
        };
      },
      offsetChainUiState() {
        const constraints = model.constraints.filter((constraint) => constraint instanceof OffsetChainConstraint);
        const serialized = serializeModel();
        return {
          selectedCount: offsetSelection.entries.length,
          selectionCommitted: offsetSelection.committed,
          pendingType: pendingCommand?.type || null,
          lineCount: model.lines.length,
          constraintCount: constraints.length,
          target: constraints[0]?.target ?? null,
          parameterName: constraints[0]?.parameterName || null,
          parameterNames: constraints.map((item) => item.parameterName || null),
          sourceIds: constraints[0]?.sources.map((item) => item.id) || [],
          offsetIds: constraints[0]?.offsets.map((item) => item.id) || [],
          resultJoins: constraints[0]
            ? constraints[0].offsets.slice(0, -1).map((item, index) => ({
              end: item instanceof Line ? { x: item.p2.x, y: item.p2.y } : item.endPoint(),
              start: constraints[0].offsets[index + 1] instanceof Line
                ? { x: constraints[0].offsets[index + 1].p1.x, y: constraints[0].offsets[index + 1].p1.y }
                : constraints[0].offsets[index + 1].startPoint(),
            }))
            : [],
          jsonVersion: serialized.version,
          serializedTypes: serialized.constraints.filter((item) => item.type === "offsetChainDimension").length,
          serialized,
        };
      },
      roundTripOffsetChainForTest() {
        const saved = serializeModel();
        const loaded = loadModelData(saved);
        const constraint = model.constraints.find((item) => item instanceof OffsetChainConstraint);
        return {
          loaded,
          count: model.constraints.filter((item) => item instanceof OffsetChainConstraint).length,
          target: constraint?.target ?? null,
          sourceCount: constraint?.sources.length ?? 0,
          offsetCount: constraint?.offsets.length ?? 0,
          reversed: constraint?.sourceReversed || [],
        };
      },
      updateOffsetChainTargetForTest(value) {
        const constraint = model.constraints.find((item) => item instanceof OffsetChainConstraint);
        if (!constraint) return null;
        constraint.target = Number(value);
        constraint.expression = String(value);
        preconditionNewConstraint(constraint);
        const target = targetFromConstraint(constraint);
        return {
          measured: measuredConstraintTargetValue(constraint, target, constraint.dimension),
          join: {
            first: constraint.offsets[0] instanceof Line ? { x: constraint.offsets[0].p2.x, y: constraint.offsets[0].p2.y } : constraint.offsets[0].endPoint(),
            second: constraint.offsets[1] instanceof Line ? { x: constraint.offsets[1].p1.x, y: constraint.offsets[1].p1.y } : constraint.offsets[1].startPoint(),
          },
        };
      },
      canReselectOffsetResultChainForTest() {
        const constraint = model.constraints.find((item) => item instanceof OffsetChainConstraint);
        if (!constraint) return null;
        offsetSelection.reset();
        const first = addOffsetChainGeometry(constraint.offsets[0]);
        const second = addOffsetChainGeometry(constraint.offsets[1]);
        const result = { first: first.ok, second: second.ok, selectedCount: offsetSelection.entries.length };
        offsetSelection.reset();
        clearSelection();
        return result;
      },
      resetForSketchDeletion() {
        resetModelState();
        model.sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
        model.sketches.push({ id: "S3", name: "Sketch-2-1", parentSketchId: "S2", kind: "sketch" });
        model.sketches.push({ id: "S4", name: "Sketch-3", parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
        model.activeSketchId = "S2";
        const p1 = addPoint(0, 0, false, "endpoint");
        const p2 = addPoint(80, 0, false, "endpoint");
        const line = addLine(p1, p2);
        model.activeSketchId = "S3";
        const center = addPoint(30, 30, false, "center");
        const circle = addCircle(center, 20);
        line.appearance = { color: "#ef4444" };
        circle.appearance = { color: "#22c55e" };
        model.annotations.push({ id: "AN-test", type: "leader", visible: true, sketchId: "S2", geometryRef: geometryRefForItem(line), start: { x: 0, y: 0 }, end: { x: 30, y: 20 }, style: {} });
        model.activeSketchId = "S3";
        const deleted = deleteSketch("S2", false);
        return {
          deleted,
          sketchIds: model.sketches.map((sketch) => sketch.id),
          activeSketchId: model.activeSketchId,
          geometry: { points: model.points.length, lines: model.lines.length, circles: model.circles.length, arcs: model.arcs.length },
          annotationCount: model.annotations.length,
        };
      },
      resetForSiblingVisibility() {
        resetModelState();
        model.sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
        model.activeSketchId = "S2";
        const p1 = addPoint(-40, 0, false, "endpoint");
        const p2 = addPoint(40, 0, false, "endpoint");
        const line = addLine(p1, p2);
        model.activeSketchId = DEFAULT_SKETCH_ID;
        updateUI();
        draw();
        return {
          visible: isVisibleSketchId("S2"),
          relation: sketchRelationToActive("S2"),
          strokeWidth: sketchStrokeWidth(line),
          color: constraintStatusColor(line),
          rowHasVisibleClass: document.querySelector('.sketch-item[data-id="S2"]')?.classList.contains("visible") || false,
        };
      },
      resetForInactiveDimensionAndBlockHover() {
        resetModelState();
        const sourceSketchId = activeSketchId();
        const p1 = addPoint(-120, -55, false, "endpoint");
        const p2 = addPoint(-20, -55, false, "endpoint");
        const line = addLine(p1, p2);
        const target = { kind: "line-length", line, p1, p2, value: line.length() };
        addDistanceConstraintFromTarget(
          target,
          line.length(),
          dimensionFromAnchor(target, { x: -70, y: -95 }),
          { sketchId: sourceSketchId },
        );
        const dimensionConstraint = model.constraints.find((constraint) => isDimensionConstraint(constraint));

        const definition = createEmptyBlockDefinition("Hover Block");
        const bp1 = new Point("BP1", -30, 0, false, "endpoint");
        const bp2 = new Point("BP2", 30, 0, false, "endpoint");
        bp1.sketchId = sourceSketchId;
        bp2.sketchId = sourceSketchId;
        const blockLine = new Line("BL1", bp1, bp2);
        blockLine.sketchId = sourceSketchId;
        definition.points.push(bp1, bp2);
        definition.lines.push(blockLine);
        documentModel.blockDefinitions.push(definition);
        const instance = {
          id: `BI${blockInstanceSeq++}`,
          definitionId: definition.id,
          sketchId: sourceSketchId,
          x: 95,
          y: 65,
          rotation: 0,
          fixed: false,
          rotationLocked: false,
          enabledSketchIds: [sourceSketchId],
          appearanceOverride: {},
        };
        model.blockInstances.push(instance);
        invalidateBlockProjectionCache();

        const activeChildId = "S2";
        model.sketches.push({ id: activeChildId, name: "Sketch-2", parentSketchId: sourceSketchId, kind: "sketch", visible: true, appearance: {} });
        model.activeSketchId = activeChildId;
        fitAllGeometryToViewport(180);
        viewport.update({ x: viewport.x + (80) });
        updateUI();
        draw();
        const layout = dimensionLayout(targetFromConstraint(dimensionConstraint), dimensionConstraint.dimension);
        return {
          dimension: this.worldClientPositionForTest(layout.text),
          line: this.worldClientPositionForTest({ x: (line.p1.x + line.p2.x) / 2, y: (line.p1.y + line.p2.y) / 2 }),
          block: this.worldClientPositionForTest(blockInstanceDisplayCenter(instance)),
          dimensionId: dimensionConstraint.name || "寸法",
          lineId: line.id,
          blockId: instance.id,
          sourceSketchId,
          activeSketchId: activeChildId,
          relation: sketchIdentityRelationLabel(sourceSketchId),
        };
      },
      hoverIdentityStateForTest() {
        return hoveredSketchIdentity ? {
          kind: hoveredSketchIdentity.kind || null,
          id: hoveredSketchIdentity.id,
          sketchId: hoveredSketchIdentity.sketchId,
          relation: sketchIdentityRelationLabel(hoveredSketchIdentity.sketchId),
          hoveredDimension: hoveredDimensionConstraint ? hoveredDimensionConstraint.name || "寸法" : null,
          hoveredBlock: hoveredBlockInstance?.id || null,
        } : null;
      },
      geometryStrokeStyleCasesForTest() {
        resetModelState();
        const activeNormal = addLine(addPoint(-80, -25, false, "endpoint"), addPoint(80, -25, false, "endpoint"));
        const activeConstruction = addLine(addPoint(-80, 25, false, "endpoint"), addPoint(80, 25, false, "endpoint"), true);
        model.sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
        model.activeSketchId = "S2";
        const inactiveNormal = addLine(addPoint(-80, 75, false, "endpoint"), addPoint(80, 75, false, "endpoint"));
        const inactiveConstruction = addLine(addPoint(-80, 125, false, "endpoint"), addPoint(80, 125, false, "endpoint"), true);
        model.activeSketchId = DEFAULT_SKETCH_ID;
        return {
          activeNormal: geometryStrokeWidth(activeNormal),
          activeConstruction: geometryStrokeWidth(activeConstruction, { construction: true }),
          inactiveNormal: geometryStrokeWidth(inactiveNormal),
          inactiveConstruction: geometryStrokeWidth(inactiveConstruction, { construction: true }),
          selected: geometryStrokeWidth(activeNormal, { selected: true }),
          hovered: geometryStrokeWidth(activeNormal, { hovered: true }),
          constructionAlpha: CONSTRUCTION_GEOMETRY_ALPHA,
        };
      },
      constructionLineHoverDisplayCasesForTest() {
        const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
        const captureOverhang = (line, setupHover) => {
          const segments = [];
          let start = null;
          const originalMoveTo = ctx.moveTo;
          const originalLineTo = ctx.lineTo;
          ctx.moveTo = (x, y) => {
            start = { x, y };
          };
          ctx.lineTo = (x, y) => {
            if (start) segments.push({ p1: start, p2: { x, y } });
          };
          try {
            setupHover();
            drawLines();
          } finally {
            ctx.moveTo = originalMoveTo;
            ctx.lineTo = originalLineTo;
          }
          const segment = segments[0];
          return segment ? ((distance(segment.p1, line.p1) + distance(segment.p2, line.p2)) / 2) * viewport.scale : null;
        };

        resetModelState();
        viewport.update({ scale: 2 });
        const line = addLine(addPoint(-40, 0, false, "endpoint"), addPoint(40, 0, false, "endpoint"), true);
        const direct = captureOverhang(line, () => {
          hoveredLine = line;
        });

        resetModelState();
        viewport.update({ scale: 2 });
        const definition = createEmptyBlockDefinition("Block-Construction-Hover");
        const p1 = new Point("BP1", -40, 0, false, "endpoint");
        const p2 = new Point("BP2", 40, 0, false, "endpoint");
        p1.sketchId = DEFAULT_SKETCH_ID;
        p2.sketchId = DEFAULT_SKETCH_ID;
        const localLine = new Line("BL1", p1, p2, true);
        localLine.sketchId = DEFAULT_SKETCH_ID;
        definition.points.push(p1, p2);
        definition.lines.push(localLine);
        documentModel.blockDefinitions.push(definition);
        const instance = {
          id: "BI-HOVER",
          definitionId: definition.id,
          sketchId: DEFAULT_SKETCH_ID,
          x: 0,
          y: 0,
          rotation: 0,
          fixed: false,
          rotationLocked: false,
          enabledSketchIds: [DEFAULT_SKETCH_ID],
          appearanceOverride: {},
        };
        model.blockInstances.push(instance);
        invalidateBlockProjectionCache();
        const projection = blockProjectionBundle(instance).lines[0];
        const block = captureOverhang(projection, () => {
          hoveredBlockInstance = instance;
        });
        hoveredLine = null;
        hoveredBlockInstance = null;
        return { direct, block };
      },
      constructionLineRenderingForTest(lineId) {
        const line = allGeometryLines().find((item) => item.id === lineId);
        if (!line) return null;
        const segments = [];
        let start = null;
        let endpointMarkerCount = 0;
        const originalMoveTo = ctx.moveTo;
        const originalLineTo = ctx.lineTo;
        const originalArc = ctx.arc;
        ctx.moveTo = (x, y) => {
          start = { x, y };
        };
        ctx.lineTo = (x, y) => {
          if (start) segments.push({ p1: start, p2: { x, y } });
        };
        ctx.arc = (...args) => {
          endpointMarkerCount += 1;
          return originalArc.apply(ctx, args);
        };
        try {
          drawLines();
        } finally {
          ctx.moveTo = originalMoveTo;
          ctx.lineTo = originalLineTo;
          ctx.arc = originalArc;
        }
        const segment = segments[0];
        const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
        const overhangPx = segment ? ((distance(segment.p1, line.p1) + distance(segment.p2, line.p2)) / 2) * viewport.scale : null;
        const appearance = effectiveAppearanceForElement(line);
        return {
          endpointOverhang: appearance.endpointOverhang !== false,
          endpointMarkers: appearance.endpointMarkers !== false,
          overhangPx: overhangPx == null ? null : Number(overhangPx.toFixed(6)),
          endpointMarkerCount,
        };
      },
      resetForSiblingSubtreeReference() {
        resetModelState();
        const parentSketchId = "S10";
        const siblingSketchId = "S2";
        const siblingChildId = "S3";
        const siblingGrandchildId = "S4";
        const unrelatedSketchId = "S9";
        const activeChildSketchId = "S11";
        const active = sketchById(DEFAULT_SKETCH_ID);
        active.parentSketchId = parentSketchId;
        model.sketches.push({ id: parentSketchId, name: "Sketch-P", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
        model.sketches.push({ id: siblingSketchId, name: "Sketch-S", parentSketchId, kind: "sketch", visible: true });
        model.sketches.push({ id: siblingChildId, name: "Sketch-S-1", parentSketchId: siblingSketchId, kind: "sketch", visible: true });
        model.sketches.push({ id: siblingGrandchildId, name: "Sketch-S-1-1", parentSketchId: siblingChildId, kind: "sketch", visible: true });
        model.sketches.push({ id: unrelatedSketchId, name: "Sketch-U", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
        model.sketches.push({ id: activeChildSketchId, name: "Sketch-1-1", parentSketchId: DEFAULT_SKETCH_ID, kind: "sketch", visible: true });

        model.activeSketchId = DEFAULT_SKETCH_ID;
        const activePoint = addPoint(45, 70, false, "explicit");
        model.activeSketchId = activeChildSketchId;
        const childLine = addLine(addPoint(-80, 80, true, "endpoint"), addPoint(80, 80, true, "endpoint"));
        model.activeSketchId = siblingSketchId;
        addLine(addPoint(-80, 0, true, "endpoint"), addPoint(80, 0, true, "endpoint"));
        model.activeSketchId = siblingChildId;
        addLine(addPoint(-80, 20, true, "endpoint"), addPoint(80, 20, true, "endpoint"));
        model.activeSketchId = siblingGrandchildId;
        const referenceLine = addLine(addPoint(-80, 40, true, "endpoint"), addPoint(80, 40, true, "endpoint"));
        model.activeSketchId = unrelatedSketchId;
        const unrelatedLine = addLine(addPoint(-80, -40, true, "endpoint"), addPoint(80, -40, true, "endpoint"));
        model.activeSketchId = DEFAULT_SKETCH_ID;
        refreshReferenceConstraintValidity();
        fitAllGeometryToViewport(190);
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        const screenPoint = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };
        return {
          activePoint: screenPoint(activePoint),
          referenceLine: screenPoint({ x: 45, y: 40 }),
          unrelatedLine: screenPoint({ x: 45, y: -40 }),
          childLine: screenPoint({ x: 45, y: 80 }),
          relations: Object.fromEntries([parentSketchId, siblingSketchId, siblingChildId, siblingGrandchildId, unrelatedSketchId, activeChildSketchId].map((id) => [id, sketchRelationToActive(id)])),
          relationLabels: Object.fromEntries([unrelatedSketchId, activeChildSketchId].map((id) => [id, sketchIdentityRelationLabel(id)])),
          relationColors: Object.fromEntries([unrelatedSketchId, activeChildSketchId].map((id) => [id, sketchIdentityRelationColor(id)])),
          rowBackgrounds: Object.fromEntries([siblingSketchId, siblingChildId, siblingGrandchildId, unrelatedSketchId, activeChildSketchId].map((id) => {
            const row = document.querySelector(`.sketch-item[data-id="${id}"]`);
            return [id, row ? getComputedStyle(row).backgroundColor : ""];
          })),
          visible: Object.fromEntries([parentSketchId, siblingSketchId, siblingChildId, siblingGrandchildId, unrelatedSketchId, activeChildSketchId].map((id) => [id, isVisibleSketchId(id)])),
          rowClasses: Object.fromEntries([siblingSketchId, siblingChildId, siblingGrandchildId, unrelatedSketchId, activeChildSketchId].map((id) => [id, document.querySelector(`.sketch-item[data-id="${id}"]`)?.classList.contains("visible") || false])),
          referenceLineId: referenceLine.id,
          unrelatedLineId: unrelatedLine.id,
          childLineId: childLine.id,
        };
      },
      siblingSubtreeVisibilityState() {
        return Object.fromEntries(["S2", "S3", "S4"].map((id) => [id, {
          preferenceVisible: sketchById(id)?.visible !== false,
          effectiveVisible: isVisibleSketchId(id),
        }]));
      },
      moveSiblingSubtreeReferenceLine(dy) {
        const line = model.lines.find((item) => elementSketchId(item) === "S4");
        if (!line) return null;
        line.p1.y += dy;
        line.p2.y += dy;
        const result = solveReferenceDependentSketches("S4");
        refreshConstraintAnalysis();
        updateUI();
        draw();
        const point = model.points.find((item) => elementSketchId(item) === DEFAULT_SKETCH_ID && isExplicitPoint(item));
        return {
          success: result.success,
          dependentSketchIds: result.results.map((entry) => entry.sketchId),
          point: point ? { x: point.x, y: point.y } : null,
          line: { p1: { x: line.p1.x, y: line.p1.y }, p2: { x: line.p2.x, y: line.p2.y } },
        };
      },
      deleteSketchForTest(sketchId) {
        return deleteSketch(sketchId, false);
      },
      referenceDependencyOrderCase() {
        resetModelState();
        const parentSketchId = "S10";
        const childSketchId = "S5";
        sketchById(DEFAULT_SKETCH_ID).parentSketchId = parentSketchId;
        model.sketches.push({ id: parentSketchId, name: "Sketch-P", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
        model.sketches.push({ id: childSketchId, name: "Sketch-1-1", parentSketchId: DEFAULT_SKETCH_ID, kind: "sketch", visible: true });
        model.activeSketchId = parentSketchId;
        const sourceLine = addLine(addPoint(-50, 0, true, "endpoint"), addPoint(50, 0, true, "endpoint"));
        model.activeSketchId = DEFAULT_SKETCH_ID;
        const activePoint = addPoint(0, 15, false, "explicit");
        const first = markReferenceConstraint(new PointOnLineConstraint(activePoint, sourceLine), parentSketchId, DEFAULT_SKETCH_ID);
        model.constraints.push(first);
        model.activeSketchId = childSketchId;
        const childPoint = addPoint(0, 30, false, "explicit");
        const second = markReferenceConstraint(new CoincidentConstraint(childPoint, activePoint), DEFAULT_SKETCH_ID, childSketchId);
        model.constraints.push(second);
        model.activeSketchId = DEFAULT_SKETCH_ID;
        refreshReferenceConstraintValidity();
        sourceLine.p1.y = 25;
        sourceLine.p2.y = 25;
        const result = solveReferenceDependentSketches(parentSketchId);
        return {
          order: result.results.map((entry) => entry.sketchId),
          activePointY: activePoint.y,
          childPointY: childPoint.y,
        };
      },
      cyclicReferenceLoadCase() {
        resetModelState();
        model.sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
        model.activeSketchId = DEFAULT_SKETCH_ID;
        const p1 = addPoint(0, 0, false, "explicit");
        model.activeSketchId = "S2";
        const p2 = addPoint(20, 0, false, "explicit");
        const forward = markReferenceConstraint(new CoincidentConstraint(p1, p2), "S2", DEFAULT_SKETCH_ID);
        const reverse = markReferenceConstraint(new CoincidentConstraint(p2, p1), DEFAULT_SKETCH_ID, "S2");
        model.constraints.push(forward, reverse);
        const serialized = serializeModel();
        serialized.activeSketchId = DEFAULT_SKETCH_ID;
        loadModelData(serialized);
        refreshConstraintAnalysis();
        updateUI();
        return {
          total: model.constraints.length,
          operational: model.constraints.filter(constraintIsOperational).length,
          invalid: [...invalidReferenceConstraints.values()],
          badges: document.querySelectorAll(".sketch-reference-error-badge, .constraint-reference-error-badge").length,
        };
      },
      sketchVisibilityState(sketchId) {
        const sketch = sketchById(sketchId);
        const serialized = serializeModel().sketches.find((item) => item.id === sketchId);
        return {
          preferenceVisible: sketch?.visible !== false,
          effectiveVisible: isVisibleSketchId(sketchId),
          serializedVisible: serialized?.appearance?.visible,
          buttonPressed: document.querySelector(`.sketchVisibilityBtn[data-id="${sketchId}"]`)?.getAttribute("aria-pressed") || null,
        };
      },
      resetForConstraintDimensionSelection() {
        resetModelState();
        const p1 = addPoint(-50, 0, false, "endpoint");
        const p2 = addPoint(50, 0, false, "endpoint");
        const line = addLine(p1, p2);
        const target = { kind: "line-length", line, p1, p2, value: line.length() };
        const constraint = new DistanceConstraint(p1, p2, line.length());
        constraint.dimension = dimensionFromAnchor(target, { x: 0, y: -30 });
        pushModelConstraint(constraint);
        canvasSelection.set("dimensionConstraint", constraint);
        pendingConstraintCommand = { type: "parallel" };
        updateUI();
        fitAllGeometryToViewport(180);
        draw();
        const rect = canvas.getBoundingClientRect();
        return { blank: { x: rect.left + rect.width - 35, y: rect.top + rect.height - 35 } };
      },
      constraintDimensionSelectionState() {
        return {
          selected: Boolean(canvasSelection.dimensionConstraint),
          command: pendingConstraintCommand?.type || null,
        };
      },
      resetForSupportConstraintStatus() {
        resetModelState();

        const anchor = addPoint(-60, -40, true, "explicit");
        const supportLine = addLine(addPoint(-100, -40, false, "endpoint"), addPoint(-20, -40, false, "endpoint"));
        pushModelConstraint(new HorizontalConstraint(supportLine));
        pushModelConstraint(new PointOnLineConstraint(anchor, supportLine));

        const underLine = addLine(addPoint(20, 0, false, "endpoint"), addPoint(100, 0, false, "endpoint"));
        pushModelConstraint(new HorizontalConstraint(underLine));

        const fullLine = addLine(addPoint(-100, 50, true, "endpoint"), addPoint(-20, 50, true, "endpoint"));
        const supportArc = addArc(addPoint(65, 60, true, "center"), 30, Math.PI, Math.PI * 1.5);
        pushModelConstraint(new RadiusConstraint(supportArc, 30));

        solveSketchAndDependents(activeSketchId(), snapshotModelState());
        refreshConstraintAnalysis();
        fitAllGeometryToViewport(150);
        draw();
        return {
          supportLine: { status: constraintStatusOf(supportLine), color: constraintStatusColor(supportLine) },
          underLine: { status: constraintStatusOf(underLine), color: constraintStatusColor(underLine) },
          fullLine: { status: constraintStatusOf(fullLine), color: constraintStatusColor(fullLine) },
          supportArc: { status: constraintStatusOf(supportArc), color: constraintStatusColor(supportArc) },
          summary: constraintAnalysisState.summary,
        };
      },
      resetForReferencePointLineCoincidence() {
        resetModelState();
        const parentPoint = addPoint(-45, 0, false, "explicit");
        const parentLineP1 = addPoint(20, -20, false, "endpoint");
        const parentLineP2 = addPoint(80, -20, false, "endpoint");
        const parentLine = addLine(parentLineP1, parentLineP2);
        const childSketchId = "S2";
        const parentSketchId = activeSketchId();
        model.sketches.push({ id: childSketchId, name: "Sketch-1-1", parentSketchId, kind: "sketch" });
        model.activeSketchId = childSketchId;
        const childLineP1 = addPoint(-80, 35, false, "endpoint");
        const childLineP2 = addPoint(-10, 35, false, "endpoint");
        const childLine = addLine(childLineP1, childLineP2);
        const childPoint = addPoint(50, 30, false, "explicit");
        fitAllGeometryToViewport(190);
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        const screenPoint = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };
        return {
          parentPoint: screenPoint(parentPoint),
          parentLine: screenPoint({ x: 50, y: -20 }),
          childLine: screenPoint({ x: -45, y: 35 }),
          childPoint: screenPoint(childPoint),
        };
      },
      resetForSiblingPointLineReference() {
        resetModelState();
        const activePoint = addPoint(50, 35, false, "explicit");
        const siblingSketchId = "S2";
        model.sketches.push({ id: siblingSketchId, name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
        model.activeSketchId = siblingSketchId;
        const lineP1 = addPoint(10, 0, true, "endpoint");
        const lineP2 = addPoint(90, 0, true, "endpoint");
        const siblingLine = addLine(lineP1, lineP2);
        model.activeSketchId = DEFAULT_SKETCH_ID;
        fitAllGeometryToViewport(190);
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        const screenPoint = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };
        return {
          activePoint: screenPoint(activePoint),
          siblingLine: screenPoint({ x: 50, y: 0 }),
        };
      },
      moveSiblingReferenceLine(dy) {
        const siblingLine = model.lines.find((line) => elementSketchId(line) === "S2");
        if (!siblingLine) return null;
        siblingLine.p1.y += dy;
        siblingLine.p2.y += dy;
        const result = solveReferenceDependentSketches("S2");
        refreshConstraintAnalysis();
        updateUI();
        draw();
        const activePoint = model.points.find((point) => elementSketchId(point) === DEFAULT_SKETCH_ID && isExplicitPoint(point));
        return {
          success: result.success,
          dependentSketchIds: result.results.map((entry) => entry.sketchId),
          activePoint: activePoint ? { x: activePoint.x, y: activePoint.y } : null,
          siblingLine: { p1: { x: siblingLine.p1.x, y: siblingLine.p1.y }, p2: { x: siblingLine.p2.x, y: siblingLine.p2.y } },
          reverseWouldCycle: wouldCreateReferenceCycle("S2", DEFAULT_SKETCH_ID),
        };
      },
      referencePointLineState() {
        const constraints = model.constraints.filter((constraint) => constraint instanceof PointOnLineConstraint && constraint.reference);
        return {
          count: constraints.length,
          errors: constraints.map((constraint) => Math.abs(signedPointLineDistance(constraint.point, constraint.line))),
          referenceSketchIds: constraints.map((constraint) => constraint.referenceSketchId),
          sketchIds: constraints.map((constraint) => constraintSketchId(constraint)),
        };
      },
      resetForBlockCreationUi() {
        resetModelState();
        const p1 = addPoint(-60, -30, false, "endpoint");
        const p2 = addPoint(60, -30, false, "endpoint");
        const p3 = addPoint(60, 30, false, "endpoint");
        const p4 = addPoint(-60, 30, false, "endpoint");
        const lines = [addLine(p1, p2), addLine(p2, p3), addLine(p3, p4), addLine(p4, p1)];
        pushModelConstraint(new HorizontalConstraint(lines[0]));
        pushModelConstraint(new VerticalConstraint(lines[1]));
        pushModelConstraint(new HorizontalConstraint(lines[2]));
        pushModelConstraint(new VerticalConstraint(lines[3]));
        canvasSelection.set("lines", lines.slice());
        fitAllGeometryToViewport(220);
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        const origin = worldToCanvasScreen({ x: 0, y: 0 });
        return { origin: { x: rect.left + origin.x, y: rect.top + origin.y } };
      },
      resetForEmptyBlockCreation() {
        resetModelState();
        updateUI();
        draw();
        return { definitions: documentModel.blockDefinitions.length, lines: model.lines.length };
      },
      resetForDimensionCommandLineDrag() {
        resetModelState();
        const p1 = addPoint(-70, -35, false, "endpoint");
        const p2 = addPoint(70, -35, false, "endpoint");
        const dimensionedLine = addLine(p1, p2);
        const dimensionedTarget = { kind: "line-length", line: dimensionedLine, p1, p2, value: dimensionedLine.length() };
        addDistanceConstraintFromTarget(
          dimensionedTarget,
          dimensionedLine.length(),
          dimensionFromAnchor(dimensionedTarget, { x: 0, y: -75 }),
          { sketchId: activeSketchId() },
        );
        const p3 = addPoint(-55, 55, false, "endpoint");
        const p4 = addPoint(55, 55, false, "endpoint");
        const commandLine = addLine(p3, p4);
        constraintOperands = [];
        canvasSelection.set("points", []);
        canvasSelection.set("lines", [commandLine]);
        canvasSelection.set("circles", []);
        canvasSelection.set("arcs", []);
        fitAllGeometryToViewport(190);
        startDistanceCommand();
        const constraint = model.constraints.find((item) => isDimensionConstraint(item) && constraintGraphNodes(item).includes(p1) && constraintGraphNodes(item).includes(p2));
        const target = targetFromConstraint(constraint);
        const layout = dimensionLayout(target, constraint.dimension);
        const world = {
          x: layout.a.x * 0.75 + layout.b.x * 0.25,
          y: layout.a.y * 0.75 + layout.b.y * 0.25,
        };
        const screen = worldToCanvasScreen(world);
        const rect = canvas.getBoundingClientRect();
        return {
          point: { x: rect.left + screen.x, y: rect.top + screen.y },
          scale: viewport.scale,
          anchor: dimensionAnchor(target, constraint.dimension),
        };
      },
      resetForLineLengthClickPlacement() {
        resetModelState();
        const line = addLine(addPoint(-80, 0, false, "endpoint"), addPoint(80, 0, false, "endpoint"));
        fitAllGeometryToViewport(190);
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        const clientPoint = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };
        return {
          line: clientPoint({ x: 0, y: 0 }),
          placement: clientPoint({ x: 0, y: -50 }),
          lineId: line.id,
        };
      },
      resetForLineCircleAndRadiusDifferenceDimensions() {
        resetModelState();
        const line = addLine(addPoint(-130, 150, true, "endpoint"), addPoint(130, 150, true, "endpoint"));
        const circle1 = addCircle(addPoint(0, 0, false, "center"), 30);
        const circle2 = addCircle(addPoint(0, 0, false, "center"), 55);
        const arc1 = addArc(addPoint(0, 0, false, "center"), 80, -Math.PI / 3, Math.PI / 3);
        const arc2 = addArc(addPoint(0, 0, false, "center"), 105, -Math.PI / 3, Math.PI / 3);
        fitAllGeometryToViewport(230);
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        const clientPoint = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };
        return {
          line: clientPoint({ x: 0, y: 150 }),
          circle1: clientPoint({ x: -30, y: 0 }),
          circle2: clientPoint({ x: -55, y: 0 }),
          arc1: clientPoint({ x: 80, y: 0 }),
          arc2: clientPoint({ x: 105, y: 0 }),
          lineCirclePlacement: clientPoint({ x: 60, y: 75 }),
          radiusDifferencePlacement: clientPoint({ x: 70, y: -75 }),
          ids: {
            line: line.id,
            circle1: circle1.id,
            circle2: circle2.id,
            arc1: arc1.id,
            arc2: arc2.id,
          },
        };
      },
      lineCircleAndRadiusDifferenceState() {
        const serialized = serializeModel();
        const constraints = model.constraints.filter((constraint) =>
          constraint instanceof LineCircleDistanceConstraint || constraint instanceof ConcentricRadiusDifferenceConstraint);
        return {
          pendingCommandType: pendingCommand?.type || null,
          previewTargetKind: pendingCommand?.target?.kind || null,
          operandKinds: constraintOperands.map((operand) => operand.kind),
          constraints: serialized.constraints.filter((constraint) =>
            constraint.type === "lineCircleDistance" || constraint.type === "concentricRadiusDifferenceDimension"),
          geometry: constraints.map((constraint) => {
            if (constraint instanceof LineCircleDistanceConstraint) {
              return {
                type: "lineCircleDistance",
                centerDistance: Math.abs(signedPointLineDistance(constraint.circle.center, constraint.line)),
                target: constraint.target,
                error: vectorNorm([constraint.rawError()].flat()),
              };
            }
            return {
              type: "concentricRadiusDifferenceDimension",
              centerDistance: hypot2(constraint.a.center.x - constraint.b.center.x, constraint.a.center.y - constraint.b.center.y),
              radiusDifference: Math.abs(constraint.b.radius() - constraint.a.radius()),
              target: constraint.target,
              error: vectorNorm(constraint.rawError()),
            };
          }),
          serialized,
        };
      },
      perturbRadiusDifferenceDimensionForTest() {
        const constraint = model.constraints.find((item) => item instanceof ConcentricRadiusDifferenceConstraint);
        if (!constraint) return null;
        constraint.b.center.x += 17;
        constraint.b.center.y -= 11;
        constraint.b.radiusValue += 9;
        const before = {
          centerDistance: hypot2(constraint.a.center.x - constraint.b.center.x, constraint.a.center.y - constraint.b.center.y),
          radiusDifference: Math.abs(constraint.b.radius() - constraint.a.radius()),
        };
        const result = solveSketchAndDependents(activeSketchId(), snapshotModelState());
        refreshConstraintAnalysis();
        updateUI();
        draw();
        return {
          success: result.success,
          before,
          after: {
            centerDistance: hypot2(constraint.a.center.x - constraint.b.center.x, constraint.a.center.y - constraint.b.center.y),
            radiusDifference: Math.abs(constraint.b.radius() - constraint.a.radius()),
            error: vectorNorm(constraint.rawError()),
          },
        };
      },
      lineLengthClickPlacementState() {
        const constraints = model.constraints.filter(isDimensionConstraint);
        const constraint = constraints.at(-1) || null;
        return {
          dimensionCount: constraints.length,
          target: constraint?.target ?? null,
          inputHidden: Boolean(dimensionValueInput?.hidden),
          pendingCommandType: pendingCommand?.type || null,
          previewTargetKind: pendingCommand?.target?.kind || null,
          previewPointer: pendingCommand?.pointer ? { ...pendingCommand.pointer } : null,
        };
      },
      dimensionCommandLineDragState() {
        const constraint = model.constraints.find(isDimensionConstraint);
        const target = targetFromConstraint(constraint);
        return {
          anchor: constraint && target ? dimensionAnchor(target, constraint.dimension) : null,
          pendingConstraintType: pendingConstraintCommand?.type || null,
          pendingCommandType: pendingCommand?.type || null,
          selectedLineIds: canvasSelection.lines.map((line) => line.id),
          dragging: Boolean(dimensionDragSession),
        };
      },
      blockState() {
        const bundles = blockProjectionBundles();
        return {
          definitions: documentModel.blockDefinitions.map((definition) => ({
            id: definition.id,
            name: definition.name,
            parentDefinitionId: definition.parentDefinitionId || null,
            points: definition.points.length,
            lines: definition.lines.length,
            constraints: definition.constraints.length,
            blockInstances: (definition.blockInstances || []).map((instance) => ({
              id: instance.id,
              definitionId: instance.definitionId,
              sketchId: instance.sketchId,
              x: instance.x,
              y: instance.y,
              rotation: instance.rotation,
              fixed: Boolean(instance.fixed),
              rotationLocked: Boolean(instance.rotationLocked),
              enabledSketchIds: instance.enabledSketchIds.slice(),
            })),
            sketches: definition.sketches.map((sketch) => ({ id: sketch.id, name: sketch.name, parentSketchId: sketch.parentSketchId, kind: sketch.kind })),
            activeSketchId: definition.activeSketchId,
            origin: { ...definition.origin },
          })),
          instances: model.blockInstances.map((instance) => ({
            id: instance.id,
            definitionId: instance.definitionId,
            sketchId: instance.sketchId,
            x: instance.x,
            y: instance.y,
            rotation: instance.rotation,
            fixed: instance.fixed,
            rotationLocked: Boolean(instance.rotationLocked),
            enabledSketchIds: instance.enabledSketchIds.slice(),
          })),
          projectionLineIds: bundles.flatMap((bundle) => bundle.lines.map((line) => line.id)),
          selectedInstanceIds: canvasSelection.blockInstances.map((instance) => instance.id),
          mode,
          serialized: serializeModel(),
        };
      },
      blockInteractionPoints(instanceId = null) {
        const instance = instanceId ? blockInstanceById(instanceId) : model.blockInstances[0];
        if (!instance) return null;
        const rect = canvas.getBoundingClientRect();
        const firstLine = blockProjectionBundle(instance).lines[0];
        const hitPoint = firstLine
          ? { x: (firstLine.p1.x + firstLine.p2.x) / 2, y: (firstLine.p1.y + firstLine.p2.y) / 2 }
          : { x: instance.x, y: instance.y };
        const center = worldToCanvasScreen(hitPoint);
        const pivot = worldToCanvasScreen(blockInstanceDisplayCenter(instance));
        return {
          center: { x: rect.left + center.x, y: rect.top + center.y },
          pivot: { x: rect.left + pivot.x, y: rect.top + pivot.y },
          handle: null,
          scale: viewport.scale,
        };
      },
      blockRotationLockStateForTest(instanceId = null) {
        const instance = instanceId ? blockInstanceById(instanceId) : model.blockInstances[0];
        if (!instance) return null;
        const center = blockInstanceDisplayCenter(instance);
        const variables = solver.getVariables().filter((variable) => variable.object === instance).map((variable) => variable.prop).sort();
        return {
          id: instance.id,
          x: instance.x,
          y: instance.y,
          rotation: instance.rotation,
          fixed: Boolean(instance.fixed),
          rotationLocked: Boolean(instance.rotationLocked),
          displayCenter: { x: center.x, y: center.y },
          solverVariables: variables,
          translationSessionAvailable: Boolean(buildDragSession("block", instance, center)),
          rotationSessionAvailable: Boolean(buildDragSession("block-rotation", instance, center)),
        };
      },
      blockProjectionEndpointForTest() {
        const instance = model.blockInstances[0];
        const point = instance ? blockProjectionBundle(instance).lines[0]?.p1 : null;
        if (!point) return null;
        const screen = worldToCanvasScreen(point);
        const rect = canvas.getBoundingClientRect();
        return { x: rect.left + screen.x, y: rect.top + screen.y, id: point.id };
      },
      blockProjectionHoverState() {
        return {
          command: pendingConstraintCommand?.type || null,
          blockInstanceId: hoveredBlockInstance?.id || null,
          pointId: hoveredPoint?.id || null,
          pointIsBlockProjection: Boolean(hoveredPoint?.blockProjection),
          lineId: hoveredLine?.id || null,
          arcEndpointId: hoveredArcEndpoint ? `${hoveredArcEndpoint.arc.id}.${hoveredArcEndpoint.endpoint}` : null,
        };
      },
      drawnGeometryIdLabelsForTest() {
        const geometryIds = new Set([
          ...allGeometryPoints().map((point) => point.id),
          ...allGeometryLines().map((line) => line.id),
          ...allGeometryCircles().map((circle) => circle.id),
          ...allGeometryArcs().map((arc) => arc.id),
        ]);
        const labels = [];
        const originalFillText = ctx.fillText;
        ctx.fillText = (value) => {
          if (geometryIds.has(String(value))) labels.push(String(value));
        };
        try {
          drawLines();
          drawCircles();
          drawArcs();
          drawPoints();
        } finally {
          ctx.fillText = originalFillText;
        }
        return labels;
      },
      constraintStatusEndpointMarkerCountForTest() {
        let count = 0;
        const originalArc = ctx.arc;
        ctx.arc = (...args) => {
          count += 1;
          return originalArc.apply(ctx, args);
        };
        try {
          drawLines();
          drawPoints();
        } finally {
          ctx.arc = originalArc;
        }
        return count;
      },
      drawnPointMarkerCountForTest() {
        let count = 0;
        const originalArc = ctx.arc;
        ctx.arc = (...args) => {
          count += 1;
          return originalArc.apply(ctx, args);
        };
        try {
          drawPoints();
        } finally {
          ctx.arc = originalArc;
        }
        return count;
      },
      arcEndpointHandleCountForTest() {
        let count = 0;
        const originalArc = ctx.arc;
        ctx.arc = (...args) => {
          count += 1;
          return originalArc.apply(ctx, args);
        };
        try {
          drawArcEndpointHandles();
        } finally {
          ctx.arc = originalArc;
        }
        return count;
      },
      pointDisplayStateForTest(id) {
        const point = allGeometryPoints().find((item) => item.id === id);
        if (!point) return null;
        let drawingTarget = false;
        let marker = null;
        const labels = [];
        const originalArc = ctx.arc;
        const originalFill = ctx.fill;
        const originalStroke = ctx.stroke;
        const originalFillText = ctx.fillText;
        ctx.arc = (x, y, ...args) => {
          drawingTarget = Math.abs(x - point.x) < 1e-9 && Math.abs(y - point.y) < 1e-9;
          return originalArc.call(ctx, x, y, ...args);
        };
        ctx.fill = (...args) => {
          if (drawingTarget) marker = { ...(marker || {}), fill: String(ctx.fillStyle) };
          return originalFill.apply(ctx, args);
        };
        ctx.stroke = (...args) => {
          if (drawingTarget) marker = { ...(marker || {}), stroke: String(ctx.strokeStyle), lineWidth: ctx.lineWidth };
          return originalStroke.apply(ctx, args);
        };
        ctx.fillText = (value, ...args) => {
          if (drawingTarget) labels.push(String(value));
          return originalFillText.call(ctx, value, ...args);
        };
        try {
          drawPoints();
        } finally {
          ctx.arc = originalArc;
          ctx.fill = originalFill;
          ctx.stroke = originalStroke;
          ctx.fillText = originalFillText;
        }
        return { ...(marker || {}), labels };
      },
      drawnDimensionLabelsForTest() {
        const labels = [];
        const originalFillText = ctx.fillText;
        ctx.fillText = (value) => labels.push(String(value));
        try {
          drawDimensions();
        } finally {
          ctx.fillText = originalFillText;
        }
        return labels;
      },
      drawnDimensionExpressionMarksForTest() {
        const marks = [];
        dimensionExpressionMarkCapture = (mark) => marks.push(mark);
        try {
          drawDimensions();
        } finally {
          dimensionExpressionMarkCapture = null;
        }
        return marks;
      },
      dimensionClientPositionForTest(index = 0) {
        const constraint = model.constraints.filter(isDimensionConstraint)[index] || null;
        const target = targetFromConstraint(constraint);
        const layout = constraint && target ? dimensionLayout(target, constraint.dimension) : null;
        return layout?.text ? this.worldClientPositionForTest(layout.text) : null;
      },
      startDimensionExpressionEditForTest(index = 0) {
        const constraint = model.constraints.filter(isDimensionConstraint)[index] || null;
        return constraint ? startDimensionEditInput({ constraint, dimension: constraint.dimension }) : false;
      },
      selectDimensionForPropertiesForTest(index = 0) {
        const constraint = model.constraints.filter(isDimensionConstraint)[index] || null;
        if (!constraint) return false;
        clearSelection();
        canvasSelection.set("dimensionConstraint", constraint);
        updateUI({ refreshAnalysis: false });
        draw();
        return true;
      },
      blockDefinitionUpdateCase() {
        const definition = documentModel.blockDefinitions[0];
        if (!definition || model.blockInstances.length === 0) return null;
        const before = blockProjectionBundle(model.blockInstances[0]).lines[0].length();
        enterBlockDefinitionEdit(definition.id);
        const editableLine = blockEditor.current.draft.lines[0];
        editableLine.p2.x += 40;
        completeBlockDefinitionEdit({ rotationLocked: true });
        const lengths = model.blockInstances.map((instance) => blockProjectionBundle(instance).lines[0].length());
        return { before, lengths, revision: definition.revision, editing: Boolean(blockEditor.current) };
      },
      blockReadOnlyDimensionCase() {
        const instance = model.blockInstances[0];
        if (!instance) return null;
        const line = blockProjectionBundle(instance).lines[0];
        const target = { kind: "line-length", line, p1: line.p1, p2: line.p2, value: line.length() };
        const dimension = defaultDimensionForTarget(target);
        const constraint = readOnlyDimensionConstraintForPlacement(target, target.value, dimension, { sketchId: instance.sketchId });
        if (!constraint) return { created: false };
        addReadOnlyDimensionConstraint(constraint, instance.sketchId, "ブロック固有寸法");
        return {
          created: true,
          readOnly: constraint.readOnlyDimension,
          enabled: constraint.enabled,
          target: constraint.target,
        };
      },
      blockExternalConstraintCase() {
        const instance = model.blockInstances[1] || model.blockInstances[0];
        if (!instance) return null;
        const definition = blockDefinitionById(instance.definitionId);
        const localPoint = definition?.points[0];
        const projectedPoint = blockProjectionBundle(instance).points.find((point) => point.localElement === localPoint);
        if (!localPoint || !projectedPoint) return null;
        const localBefore = { x: localPoint.x, y: localPoint.y };
        const anchor = addPoint(projectedPoint.x + 75, projectedPoint.y + 40, true, "explicit");
        const constraint = new CoincidentConstraint(projectedPoint, anchor);
        pushModelConstraint(constraint, instance.sketchId);
        const result = solveSketchById(instance.sketchId);
        invalidateBlockProjectionCache(instance.id);
        const nextProjection = blockProjectionBundle(instance).points.find((point) => point.localElement === localPoint);
        return {
          success: result.success,
          errorNorm: result.errorNorm,
          projectedError: hypot2(nextProjection.x - anchor.x, nextProjection.y - anchor.y),
          localBefore,
          localAfter: { x: localPoint.x, y: localPoint.y },
          instance: { x: instance.x, y: instance.y, rotation: instance.rotation },
        };
      },
      reloadBlockState() {
        const data = serializeModel();
        loadModelData(data);
        updateUI();
        draw();
        return {
          definitions: documentModel.blockDefinitions.length,
          instances: model.blockInstances.length,
          projectionLines: allGeometryLines().filter((line) => line.blockProjection).length,
          serializedVersion: serializeModel().version,
        };
      },
      reloadLegacyBlockState() {
        const data = JSON.parse(JSON.stringify(serializeModel()));
        data.version = 7;
        for (const definition of data.blockDefinitions || []) {
          delete definition.origin;
          delete definition.sketches;
          delete definition.activeSketchId;
          for (const item of [...(definition.points || []), ...(definition.lines || []), ...(definition.circles || []), ...(definition.arcs || []), ...(definition.splines || []), ...(definition.constraints || [])]) {
            delete item.sketchId;
          }
          for (const instance of definition.blockInstances || []) delete instance.rotationLocked;
        }
        for (const instance of data.blockInstances || []) {
          delete instance.enabledSketchIds;
          delete instance.rotationLocked;
        }
        loadModelData(data);
        updateUI();
        draw();
        const definition = documentModel.blockDefinitions[0];
        const instance = model.blockInstances[0];
        return {
          version: serializeModel().version,
          sketches: definition?.sketches.map((sketch) => ({ id: sketch.id, parentSketchId: sketch.parentSketchId, kind: sketch.kind })) || [],
          origin: definition ? { ...definition.origin } : null,
          elementSketchIds: definition ? [...definition.points, ...definition.lines, ...definition.circles, ...definition.arcs, ...(definition.splines || [])].map((item) => item.sketchId) : [],
          enabledSketchIds: instance?.enabledSketchIds.slice() || [],
          rotationLocked: Boolean(instance?.rotationLocked),
          projectionLineIds: instance ? blockProjectionBundle(instance).lines.map((line) => line.id) : [],
        };
      },
      blockEditorState() {
        return {
          editing: Boolean(blockEditor.current),
          depth: blockEditorSessionChain().length,
          isNew: Boolean(blockEditor.current?.isNew),
          name: blockEditor.current?.draft?.name || null,
          sketches: model.sketches.map((sketch) => ({ id: sketch.id, name: sketch.name, parentSketchId: sketch.parentSketchId, kind: sketch.kind })),
          activeSketchId: model.activeSketchId,
          hostLineCount: blockEditor.current?.original?.values.lines?.length || 0,
          hostBlockInstanceCount: blockEditor.current?.original?.values.blockInstances?.length || 0,
          editorLineCount: model.lines.length,
          editorBlockInstances: model.blockInstances.map((instance) => ({ id: instance.id, definitionId: instance.definitionId, x: instance.x, y: instance.y, rotation: instance.rotation, rotationLocked: Boolean(instance.rotationLocked) })),
        };
      },
      commitBlockPlacementForTest(anchor, rotation = 0) {
        if (mode !== "block-place" || !blockPlacementCommand.definitionId) return null;
        blockPlacementCommand.setAnchor({ x: Number(anchor?.x) || 0, y: Number(anchor?.y) || 0 });
        const instance = commitBlockPlacement(Number(rotation) || 0);
        return instance ? { id: instance.id, definitionId: instance.definitionId, x: instance.x, y: instance.y, rotation: instance.rotation, rotationLocked: Boolean(instance.rotationLocked) } : null;
      },
      constrainFirstNestedBlockLineForTest(type = "vertical") {
        const instance = model.blockInstances[0];
        const line = instance ? blockProjectionBundle(instance).lines[0] : null;
        if (!line) return null;
        const constraint = type === "horizontal" ? new HorizontalConstraint(line) : new VerticalConstraint(line);
        pushModelConstraint(constraint, instance.sketchId);
        const result = solveSketchById(instance.sketchId);
        invalidateBlockProjectionCache(instance.id);
        recordHistory("入れ子ブロック拘束");
        updateUI();
        draw();
        return { success: result.success, errorNorm: result.errorNorm, line: serializeConstraint(constraint).line };
      },
      addBlockEditorChildGeometry() {
        if (!blockEditor.current) return null;
        createSketch("child");
        const sketchId = activeSketchId();
        addLine(addPoint(-20, 50, false, "endpoint"), addPoint(20, 50, false, "endpoint"));
        recordHistory("ブロック内図形追加");
        updateUI();
        draw();
        return { sketchId, sketches: model.sketches.map((sketch) => ({ id: sketch.id, parentSketchId: sketch.parentSketchId })), lineCount: model.lines.length };
      },
      cancelBlockEditor() {
        cancelBlockDefinitionEdit();
        return { editing: Boolean(blockEditor.current), definitions: documentModel.blockDefinitions.length, instances: model.blockInstances.length, lines: model.lines.length };
      },
      completeBlockEditor() {
        completeBlockDefinitionEdit({ rotationLocked: true });
        return { editing: Boolean(blockEditor.current), definitions: documentModel.blockDefinitions.length, instances: model.blockInstances.length };
      },
      setFirstBlockInstanceSketches(ids) {
        const instance = model.blockInstances[0];
        if (!instance) return false;
        return setBlockInstanceEnabledSketchIds(instance, ids);
      },
      blockCreationRejectionCases() {
        resetModelState();
        const p1 = addPoint(0, 0, false, "endpoint");
        const p2 = addPoint(60, 0, false, "endpoint");
        const p3 = addPoint(100, 30, false, "endpoint");
        const selectedLine = addLine(p1, p2);
        addLine(p2, p3);
        canvasSelection.set("lines", [selectedLine]);
        const sharedPointError = blockSelectionGeometry().error || null;
        const sharedCounts = { definitions: documentModel.blockDefinitions.length, instances: model.blockInstances.length, lines: model.lines.length };

        resetModelState();
        const line = addLine(addPoint(0, 0, false, "endpoint"), addPoint(60, 0, false, "endpoint"));
        model.annotations.push({
          id: "AN-block-ref",
          type: "leader",
          visible: true,
          sketchId: activeSketchId(),
          geometryRef: geometryRefForItem(line),
          start: { x: 0, y: 0 },
          end: { x: 30, y: 20 },
          style: {},
        });
        canvasSelection.set("lines", [line]);
        const annotationError = blockSelectionGeometry().error || null;
        return {
          sharedPointError,
          sharedCounts,
          annotationError,
          annotationCounts: { definitions: documentModel.blockDefinitions.length, instances: model.blockInstances.length, lines: model.lines.length },
        };
      },
      sidebarHighlightIds() {
        const ids = new Set();
        for (const point of canvasSelection.points) ids.add(point.id);
        for (const line of canvasSelection.lines) {
          ids.add(line.id);
          ids.add(line.p1.id);
          ids.add(line.p2.id);
        }
        for (const circle of canvasSelection.circles) {
          ids.add(circle.id);
          ids.add(circle.center.id);
        }
        for (const arc of canvasSelection.arcs) {
          ids.add(arc.id);
          ids.add(arc.center.id);
        }
        for (const spline of canvasSelection.splines) ids.add(spline.id);
        const constraint = effectiveSelectedConstraint() || canvasSelection.dimensionConstraint;
        if (constraint) {
          for (const item of constraintHighlightNodes(constraint)) {
            if (item?.id) ids.add(item.id);
          }
        }
        for (const item of selectionHighlight.current?.elements || []) {
          if (item?.id) ids.add(item.id);
        }
        if (hoveredDimensionConstraint) {
          for (const item of constraintHighlightNodes(hoveredDimensionConstraint)) {
            if (item?.id) ids.add(item.id);
          }
        }
        return [...ids].sort();
      },
      currentSidebarHoveredGeometryKeys() {
        return [...allGeometryPoints(), ...allGeometryLines(), ...allGeometryCircles(), ...allGeometryArcs(), ...allGeometrySplines()]
          .filter(isSidebarHoveredElement)
          .map(geometryElementKey)
          .sort();
      },
    };
  }

  installTestHooks();
  installExpressionInputHighlights(document);
  resetModelState();
  updateUI();
  draw();
  log("空の新規Documentを作成しました");
  setApplicationLanguage(applicationSettings.language, { persist: false, refresh: false });
  setApplicationTheme(applicationSettings.theme, { persist: false, redraw: false });
  loadRuntimeVersion();
  resizeCanvas();
  canvasSurface.start();
  resetHistory("起動");
  markDocumentFileCheckpoint("new");
  window.addEventListener("beforeunload", (event) => {
    const dirty = blockEditor.current || fileSession.savePending
      || !fileSession.matchesCheckpoint(serializeModel());
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
})();
