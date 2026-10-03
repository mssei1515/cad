/* Application composition, editing commands, Canvas UI and event handling. */
(function () {
  "use strict";
  const { referenceImageMimeType, validReferenceImageDataUrl, normalizeReferenceImages, serializeReferenceImage, REFERENCE_IMAGE_MAX_SIDE_PX } = window.ReferenceImageData;
  const { pointInExpandedBox, rectFromPoints, pointInRect, bboxInRect, bboxIntersectsRect, lineBBox, primitiveBBox, mergeBounds, splineBBox } = window.GeometryBounds;
  const { referenceImageLocalToWorld, referenceImageWorldToLocal, referenceImageCorners, referenceImageBounds } = window.ReferenceImageGeometry;
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
    evaluateDimensionExpressionDraft, dimensionExpressionValue, numericDimensionExpression, isDirectNumericExpressionInput,
    dimensionUsesExpression, expressionInputValue, expressionFromUserInput,
    dimensionConstraintsInNamespace, allocateDimensionParameterName,
    ensureDimensionParameter, ensureParameterNamespace, parameterErrorText,
    referenceDimensionValues, validateParameterSymbolNames, evaluateParameterNamespace,
    validateParameterNamespace, prepareLoadedParameterNamespace, parameterDependents,
  } = parameterNamespace;
  const parameterDraft = window.ParameterDialogDraft.create({ namespace: parameterNamespace });
  const expressionInputView = window.ExpressionInputView.create({
    document, InputElement: HTMLInputElement, referenceNamesForInput: expressionReferenceNamesForInput, escapeHtml,
  });
  const { sync: syncExpressionInputHighlight, install: installExpressionInputHighlights,
    refresh: refreshExpressionInputHighlights } = expressionInputView;
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
  const { blockDefinitionOwnedSubtreeIds, blockDefinitionSketchRows, blockDefinitionById, blockDefinitionDrawableSketchIds, blockDefinitionHasGeometry, blockDefinitionGeometrySketchIds, blockInstanceEnabledSketchSet } = blockCatalog;
  const hatchGeometryQuery = window.HatchGeometryQuery.create({
    currentScope: workspace.current, activeSketchId, effectiveAppearanceForElement, applicationText,
    boundaryGeometry: () => [...allGeometryLines(), ...allGeometryCircles(), ...allGeometryArcs(), ...allGeometrySplines()],
  });
  const { hatchPrimitivesFromElements, hatchPrimitivesForScope, resolvedHatchBoundary } = hatchGeometryQuery;
  const blockProjections = window.BlockProjection.create({
    blockCatalog, geometryInstanceBundlesForScope, emptyGeometryInstanceBundle, hatchPrimitivesFromElements, hatchPrimitivesForScope,
  });
  const { blockProjectionId, blockProjectionLocalId, blockWorldPoint, createBlockProjectionBundle, blockAllProjectionBundle, blockProjectionBundle, invalidateBlockProjectionCache } = blockProjections;
  const { annotationBounds, pointInAnnotationTextBox, hitAnnotationElement, canvasContextAnnotationHit } = window.AnnotationSpatialQuery.create({
    viewportScale: () => viewport.scale, annotationTextWorldHeight: style => annotationTextWorldHeight(style),
    formatDisplayNumber, allAnnotations: () => allAnnotations(), isVisibleSketchId, activeSketchId, isVisibleValue,
    annotationLeaderAnchor: element => annotationLeaderAnchor(element),
  });
  const { blockLocalGeometryBounds, blockInstanceDisplayCenter, blockInstanceTranslationForAnchor } = window.BlockLayout.create({
    catalog: blockCatalog, projections: blockProjections, instanceProjections, annotationBounds, hatchPrimitivesForScope,
  });
  let sketchMoveCommand = null;
  let sketchContextController = null;
  let model = workspace.current();
  const solver = new ConstraintSolver(model);

  // Temporary binding for legacy commands; new services receive explicit scopes.
  function activateEditingScope(scope) {
    sketchContextController?.close();
    sketchMoveCommand?.reset();
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
    selectedElementCount, selectedGeometryItems, appearanceSelectionTarget, setGeometrySelection, currentConstraintTargets,
    hasPrimaryCanvasSelection, effectiveSelectedConstraint, selectedPrimitives,
    togglePointSelection, toggleLineSelection, toggleCircleSelection, toggleArcSelection,
    toggleSplineSelection, toggleBlockInstanceSelection, selectedConstructionTogglePrimitives,
    trimConstraintSelection, pushPrimitiveSelection, geometryItemSelectedInCanvas,
    constraintSelectedInCanvas, hasSelection,
  } = canvasSelection;
  const { isPointUsedByLine, isAnyLineEndpoint, isPointUsedByCircle, isPointUsedByArc, isPointUsedBySpline, isSplineOnlyFitPoint, isEditableSplineFitPoint, isPointUsedByPrimitive, isEndpointPoint, isExplicitPoint, isReferencePoint, isPrimitiveCenterPoint, isStandalonePoint, isSelectableEndpointPoint } = window.PointUsage.create({
    currentScope: workspace.current, constraintReferencesPoint,
    allGeometryLines: () => allGeometryLines(), allGeometryCircles: () => allGeometryCircles(),
    allGeometryArcs: () => allGeometryArcs(), allGeometrySplines: () => allGeometrySplines(),
    editedFitPoints: () => splineEditSession?.spline?.fitPoints,
  });
  const canvasHover = window.CanvasHover.create({ isEndpointPoint });
  const { clear: clearCanvasHover, capture: captureCanvasHoverState, restore: restoreCanvasHoverState } = canvasHover;
  let lastAuthoringPerformance = null;
  const interactionProfiler = window.InteractionProfiler.create();
  const { work: profileInteractionWork, phase: profileInteractionPhase } = interactionProfiler;
  const canvasContextController = window.CanvasContextMenu.create({
    document, window, canvas, menu: canvasContextMenu, escapeHtml, applicationText,
    presentCandidate: target => canvasContextCandidatePresentation(target),
    hover: { capture: captureCanvasHoverState, restore: restoreCanvasHoverState, preview: previewCanvasContextCandidate, clear: clearCanvasHover, draw },
    onOpen: openCanvasContextMenu, onSelect: selectCanvasContextCandidate, onAction: executeCanvasContextAction,
  });
  const closeCanvasContextMenu = canvasContextController.close;
  const geometryReads = window.GeometryReadModel.create({
    currentScope: workspace.current, prepareBlocks: ensureBlockState, blockProjections, instanceProjections,
    hasBlockHatches: blockCatalog.hasHatches,
    profileRead: read => interactionProfiler.active ? profileInteractionWork("geometryReads", read) : read(),
  });
  const { scopeGeometryItem: sidebarGeometryItem, withGeometryReadCache, blockProjectionBundles, geometryInstanceBundles, geometryInstanceBundle, allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines, allAnnotations, allHatches, allGeometryPrimitives, resolveGeometryRef, geometryElementFromKey } = geometryReads;
  const { hitAnnotationTarget, annotationLeaderTargetFromSelection, annotationLeaderTargetFromHit, annotationLeaderTargetFromItem, annotationLeaderAnchor } = window.AnnotationAnchorQuery.create({
    selectedGeometryItems, elementSketchId, activeSketchId, resolveGeometryRef,
    viewportScale: () => viewport.scale, isVisibleSketchElement, isExplicitPoint, isPointUsedByPrimitive, isPointUsedByLine, isReferencePoint,
    geometry: { allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines },
  });
  const referenceConstraintState = window.ReferenceConstraintState.create({
    currentScope: workspace.current, constraintSketchId, isReferenceSourceSketchId,
  });
  const { constraintIsOperational, wouldCreateReferenceCycle, refreshReferenceConstraintValidity,
    referenceConstraintErrorInfo, referenceConstraintErrorCountForSketch } = referenceConstraintState;
  const sketchProjectionQueries = window.SketchProjectionQueries.create({
    currentScope: workspace.current, constraintIsOperational,
  });
  const { sketchProjectionConstraints, sketchProjectionConstraintForTarget, sketchProjectionConstraintsForTarget, isSketchProjectedGeometry, sketchProjectionPointPairs, sketchProjectionConstraintsAffectingItems } = sketchProjectionQueries;
  const blankCanvasGesture = window.BlankCanvasGesture.create({
    getMode: () => mode, getPending: () => pendingCommand, getPendingConstraint: () => pendingConstraintCommand,
    getSplineEditSession: () => splineEditSession, getLineCommand: () => lineCommand, getTransientAuthoring: () => transientAuthoring,
    getTime: () => performance.now(), hypot2, clearPreview: () => drawingPreview.setPointer(null),
    finalizeSplineFromDoubleClick: (...args) => finalizeSplineFromDoubleClick(...args),
    finishSplineEditSession: (...args) => finishSplineEditSession(...args),
    submitDistanceValue: (...args) => submitDistanceValue(...args),
    submitOffsetValue: (...args) => submitOffsetValue(...args),
    cancelPendingCommand: (...args) => cancelPendingCommand(...args),
    isDrawToolMode: (...args) => isDrawToolMode(...args),
    exitDrawMode: (...args) => exitDrawMode(...args),
    cancelConstraintTargetCommand: (...args) => cancelConstraintTargetCommand(...args),
    rollbackTransientLineCompletion: (...args) => rollbackTransientLineCompletion(...args),
    clearSnap: (...args) => clearSnap(...args),
    clearSelection: (...args) => clearSelection(...args),
    setHint: (...args) => setHint(...args),
    updateUI: (...args) => updateUI(...args),
    draw: (...args) => draw(...args),
    cancelActiveDrawOperation: (...args) => cancelActiveDrawOperation(...args),
    rollbackTransientPoint: (...args) => rollbackTransientPoint(...args),
    hasActiveDrawOperation: (...args) => hasActiveDrawOperation(...args),
    hasSelection: (...args) => hasSelection(...args),
    updateGeometrySelectionUI: (...args) => updateGeometrySelectionUI(...args),
  });
  let splineEditSession = null;
  let sketchProjectionSources = [];
  const drawingPreview = window.DrawingPreview.create({ types: { Point, Line, Circle, Arc }, canvasHover,
    canCreateInActiveSketch, clearSnap: () => clearSnap(), snapForDrawing, draw,
    linePreviewPoint: (point, shiftKey) => lineCommand.previewPoint(point, shiftKey),
    readCenterline: () => centerlineCommand, projectPointToCenterlineSupport: point => projectPointToCenterlineSupport(point),
    readOffsetSelection: () => offsetSelection, computeTrimPreview,
    hits: { hitPoint: (x, y) => hitPoint(x, y), hitLine: (x, y) => hitLine(x, y),
      hitCircle: (x, y) => hitCircle(x, y), hitArc: (x, y) => hitArc(x, y) },
  });

  let pendingCommand = null;
  let pendingConstraintCommand = null;
  let constraintOperands = [];
  let lastPointerWorld = null;
  let constructionLineMode = false;
  const selectionHighlight = window.SelectionHighlight.create({
    canvasSelection, blockProjectionBundle, geometryRefsEqual, geometryRefForItem,
    constraintGraphNodes, types: { Point, Line, Circle, Arc, Spline, OffsetChainConstraint }, effectiveSelectedConstraint, targetFromConstraint,
    getHoveredDimension: () => canvasHover.current.dimension,
    setHoveredDimension: value => { canvasHover.update({ dimension: value }); }, draw,
  });
  const { constraintDefiningGeometryEntries, constraintHighlightNodes, sameConstraintDisplayElement, isSidebarHoveredElement, isSelectedConstraintRelatedElement, selectedConstraintReferenceElements, constraintDirectlyReferencesCanvasSelection, sidebarHoverElementsForItem, sidebarHoverElementsForConstraint, setSidebarHover, clearSidebarHover } = selectionHighlight;
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
  const constraintRebinding = window.ConstraintRebinding.create({
    catalog: blockCatalog, projections: blockProjections, geometryInstanceBundlesForScope,
    serializeConstraint, decorateSerializedConstraint, deserializeConstraint, applicationText,
  });
  const blockDefinitionEditing = window.BlockDefinitionEditing.create({
    normalizedSketchCopy, cloneConstraintForBlock: constraintRebinding.cloneForBlock, blockDefinitionById, createBlockProjectionBundle,
    geometryInstanceBundlesForScope, emptyGeometryInstanceBundle, normalizeGeometryInstance,
    hatchSequence: () => hatchSeq, nextDefinitionId: () => `B${blockDefinitionSeq++}`,
    isDimensionConstraint, isReadOnlyDimension, numericDimensionExpression, ensureParameterNamespace,
  });
  const { clone: cloneBlockDefinition,
    apply: mergeBlockDefinitionDraft, fromSelection: createBlockDefinitionFromSelection,
    empty: createEmptyBlockDefinition } = blockDefinitionEditing;
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
    blockDefinitionOwnedSubtreeIds, rebuildBlockDefinitionConstraintObjects,
  });
  const { live: liveBlockEditorDefinition, chain: blockEditorSessionChain,
    scopeId: currentBlockDefinitionScopeId } = blockEditor;
  const blockEditingQueries = window.BlockEditingQueries.create({
    definitions: () => documentModel.blockDefinitions, currentScope: workspace.current,
    editor: blockEditor, catalog: blockCatalog,
  });
  const { blockDefinitionsInCurrentScope, blockDefinitionScopeError,
    blockDefinitionDependsOn, storedBlockInstancesReferencing, blockDefinitionUsageCount,
    blockDefinitionEditError, blockDefinitionCyclePath } = blockEditingQueries;

  let dimensionExpressionMarkCapture = null;
  let geometryClipboard = null;
  const HISTORY_LIMIT = 80;
  let commandPanel = null;
  let derivedPanel = null;
  let commandPanelSelectedItem = null;
  const geometryInstanceCommand = window.GeometryInstanceCommand.create({
    cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation,
    selectedItemsForGeometryInstance, geometryRefForItem, geometryRefsEqual, isVisibleSketchElement, clearSelection, normalizeGeometryInstance,
    previewFreeId: () => `FI${freeInstanceSeq}`,
    nextInstanceId: type => type === "free" ? `FI${freeInstanceSeq++}` : type === "mirror" ? `MI${mirrorInstanceSeq++}` : `PI${patternInstanceSeq++}`,
    activeSketchId, getMode: () => mode, setMode: value => { mode = value; }, updateToolbar, updateUI,
    applicationText, setHint, draw, currentScope: workspace.current, canvasSelection, recordHistory,
    Line, lineHasDirection, elementSketchId,
    resolveGeometryRef, createGeometryInstanceBundle,
  });
  const { start: startGeometryInstanceCommand, placeFree: placeFreeInstance } = geometryInstanceCommand;
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
    setPropertiesPanelCollapsed, getPointerPreview: () => drawingPreview.pointer,
    setPointerPreview: value => { drawingPreview.setPointer(value); }, getLastPointerWorld: () => lastPointerWorld,
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
  const historyController = window.HistoryController.create({
    documentHistory, currentBlockHistory: () => blockEditor.current?.history,
    changed: updateHistoryButtons, log,
  });
  const CURRENT_JSON_VERSION = 22;
  const CLIPBOARD_PASTE_OFFSET_SCREEN_PX = 24;
  const BLOCK_ORTHOGONAL_ROTATION_STEP = Math.PI / 2;


  const pointerMoveScheduler = window.PointerMoveScheduler.create({
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (frame) => cancelAnimationFrame(frame),
    processMove: (pointer) => profileInteractionPhase("preview", () => {
      withGeometryReadCache(() => processCanvasPointerMove(pointer));
      if (pendingCommand && ["distance-value", "offset-value"].includes(pendingCommand.type)) syncDimensionValueInput();
    }),
  });
  const { schedule: scheduleCanvasPointerMove, flush: flushScheduledCanvasPointerMove } = pointerMoveScheduler;
  let toolFlyouts = null;
  const viewState = { constraintStatus: false, geometryIds: false, showHiddenElements: false };
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
  const DRAG_PREVIEW_MAX_MODEL_ERROR = 0.125;
  const MIN_LINE_LENGTH = Math.max(MIN_ORIENTATION_LENGTH, solver.minLineLength || 12);
  const solveScopeQuery = window.SolveScopeQuery.create({
    currentScope: workspace.current, geometryReads, activeSketchId, elementSketchId, constraintSketchId,
    isVisibleSketchElement, constraintIsOperational, constraintGraphNodes, geometryInstanceDependencyRefs, minimumLength: MIN_LINE_LENGTH,
  });
  const { connectedComponentFromSeeds, localSolveVariables, localSolveConstraints, localSolveLines, sketchSolveVariables, sketchSolveConstraints, sketchSolveLines, localSolveContextFromSeeds } = solveScopeQuery;
  const constraintRedundancy = window.ConstraintRedundancy.create({
    currentScope: workspace.current, solver, sketchSolveVariables, constraintSketchId,
    constraintIsOperational, isRootSketch, acceptError: CONSTRAINT_ACCEPT_ERROR,
  });
  const { redundantConstraintInfo, refreshConstraintRedundancy, constraintRedundancyInfo,
    constraintIsRedundant, constraintDuplicateCountForSketch } = constraintRedundancy;
  const constraintAnalysis = window.ConstraintAnalysis.create({
    currentScope: workspace.current, solver, scopeQuery: solveScopeQuery, activeSketchId, descendantSketchIds, elementSketchId,
    geometryInstanceBundles, blockProjectionBundles, geometryInstanceSourcePoints,
    refreshReferenceConstraintValidity, refreshConstraintRedundancy, sketchHasSolveError,
    isEditableSketchElement, isExplicitPoint, minimumLength: MIN_LINE_LENGTH, acceptError: CONSTRAINT_ACCEPT_ERROR,
    profileAnalysis: work => interactionProfiler.active ? profileInteractionWork("analysis", work) : work(),
  });
  const { statusOf: constraintStatusOf } = constraintAnalysis;
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
    isHistoryRestoring: () => historyController.restoring, updateHistoryButtons,
    invalidateAnalysis: () => { constraintAnalysis.invalidate(); },
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
    displayFactor: appearance => window.Appearance.annotationDisplayFactor(appearance, viewport.scale),
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
  const { geometryDisplayColor, geometryStrokeWidth, geometryPaintState, pointPaintState, arcEndpointPaintState, splineHandleState } = window.GeometryPresentation.create({
    Point, canvasSelection, canvasHover, viewState,
    effectiveAppearanceForElement, isEditableSketchElement, isConstraintOperandSelected, isPendingReferenceTarget,
    isSidebarHighlightedElement, isSidebarHoveredElement, isReferenceHoverElement, isSelectedConstraintRelatedElement,
    sketchAlpha, sketchStrokeWidth, constraintStatusColor, canvasThemeColor, constructionAlpha: CONSTRUCTION_GEOMETRY_ALPHA,
    handleQueries: { sameArcEndpoint, arcEndpointPoint, findArcEndpointFixedConstraint,
      isDraggingArcEndpoint: (arc, endpoint) => geometryDrag.isArcEndpoint(arc, endpoint),
      editedSpline: () => splineEditSession?.spline, currentScope: workspace.current },
    pointQueries: { isSplineOnlyFitPoint, isEditableSplineFitPoint, isExplicitPoint, isPointUsedByPrimitive, isReferencePoint,
      isAnyLineEndpoint, isEndpointPoint, pointLockedByLineFixed, sidebarHoveredItem: () => selectionHighlight.current?.item,
      isDraggingPoint: point => geometryDrag.isPoint(point), isDraggingCenter: point => geometryDrag.isCenter(point) },
  });
  const geometryRenderer = window.GeometryRenderer.create({ ctx, viewport, paintState: geometryPaintState, pointPaintState, arcEndpointPaintState, withCanvasState, fixedPointLabel: () => applicationText("固定", "Fixed"), appearanceLineDash, lineDisplaySegment, canvasThemeColor });
  const { traceSplinePath } = geometryRenderer;
  const interactionOverlay = window.InteractionOverlayRenderer.create({ ctx, viewport,
    elementSketchId, sketchRelationToActive, applicationText, isVisibleSketchId, activeSketchId, sketchName });
  const { sketchIdentityRelationLabel, sketchIdentityRelationColor } = interactionOverlay;
  const { resolvedLoopBounds } = window.HatchRegionEngine;
  const drawingBounds = window.DrawingBounds.create({
    currentScope: workspace.current, geometryReads, activeSketchId, elementSketchId, isVisibleSketchElement,
    isVisibleSketchId, annotationBounds, resolvedLoopBounds, resolvedHatchBoundary, hatchAppearanceForDisplay, isVisibleValue,
  });
  const { sketchGeometryBounds, allGeometryBounds, visibleGeometryBounds } = drawingBounds;
  const { scaleSketchForFirstDimension } = window.FirstDimensionScaling.create({
    currentScope: workspace.current, activeSketchId, constraintSketchId, elementSketchId, sketchGeometryBounds, minLength: MIN_LINE_LENGTH,
  });

  const { drawResolvedHatchContent } = window.HatchRenderer.create({ viewport, visibleWorldBounds, canvasThemeColor, isVisibleValue });
  const { annotationTextWorldHeight, drawAnnotationText, drawAnnotationLeader } = window.AnnotationRenderer.create({ ctx, viewport, withCanvasState, annotationDisplayColor, annotationLeaderAnchor, appearanceLineDash, formatValue: formatDisplayNumber });
  const annotationCommand = window.AnnotationCommand.create({
    currentScope: workspace.current, getPending: () => pendingCommand, setPending: value => { pendingCommand = value; },
    lastPointer: () => lastPointerWorld, viewScale: () => viewport.scale, promptText: (...args) => window.prompt(...args),
    nextAnnotationId: () => `AN${annotationSeq++}`, activeSketchId, canCreateInActiveSketch, rejectRootSketchCreation,
    annotationLeaderTargetFromSelection, annotationLeaderTargetFromHit, setGeometrySelection, clearSelection, cancelPendingCommand,
    setHint, updateToolbar, updateUI, draw, recordHistory,
  });
  const { pushAnnotation, createLeaderAnnotation, handleLeaderAnnotationTargetClick,
    startLeaderAnnotationPlacement, commitLeaderAnnotationAt, createTextAnnotation, commitTextAnnotationAt } = annotationCommand;
  const referenceImageRenderer = window.ReferenceImageRenderer.create({
    ctx, viewport, withCanvasState, createImage: () => new Image(), onImageLoad: draw, referenceImageCorners,
  });
  const { drawingStackEntries, drawDrawingStack } = window.DrawingStack.create({
    currentScope: workspace.current, activeSketchId, geometryReads,
    isVisibleSketchId, isVisibleSketchElement, hatchAppearanceForDisplay, isVisibleValue,
    painters: { hatch: items => drawHatches(items, { includePreview: false }), line: drawLines, circle: drawCircles, arc: drawArcs, spline: drawSplines },
  });
  const MIN_ARC_LENGTH = MIN_LINE_LENGTH;
  const authoringPreview = window.AuthoringPreviewRenderer.create({ ctx, viewport, withCanvasState,
    hypot2, shortestAngleFrom, slotGeometry, threePointArcGeometry, minimumLineLength: MIN_LINE_LENGTH, minimumArcLength: MIN_ARC_LENGTH,
    buildSpline: window.SplineGeometry.build, traceSplinePath, angleAtArcParam });
  const { drawFilletArc: drawFilletPreviewArc } = authoringPreview;
  const placementPreview = window.PlacementPreviewRenderer.create({ ctx, viewport, withCanvasState, traceSplinePath,
    drawResolvedHatch, resolvedHatchBoundary, hatchAppearanceForDisplay, hatchPatternOrigin, drawAnnotationLeader, drawAnnotationText });
  const geometryCreation = window.GeometryCreation.create({
    currentScope: workspace.current, ids: geometryIds, assignSketchId, currentConstruction: () => constructionLineMode,
    minLineLength: MIN_LINE_LENGTH, minArcLength: MIN_ARC_LENGTH,
  });
  const { addPoint, addPointToSketch, addLine, addCircle, addArc, addSpline, ensureLineMinimumLength, normalizeArcSweep, enforceMinimumLineLengths, normalizeArcSweeps } = geometryCreation;
  const sketchProjectionEditing = window.SketchProjectionEditing.create({
    currentScope: workspace.current, queries: sketchProjectionQueries, resolveGeometryRef, geometryRefForItem, geometryKindForItem,
    constraintSketchId, constraintIsOperational, addPointToSketch, constraintReferencesPoint, nextSeq, normalizeAppearance,
  });
  const { separateSharedSketchProjectionTargetPoints, synchronizeSketchProjectionMetadata } = sketchProjectionEditing;
  const drawingSnap = window.DrawingSnap.create({
    geometryReads, isVisibleSketchElement, isActiveSketchElement, isSplineOnlyFitPoint, isReferencePoint, isPrimitiveCenterPoint, isEndpointPoint, isPointUsedByPrimitive, isExplicitPoint, sketchName, elementSketchId, applicationText,
  });
  const { candidates: snapCandidates, clear: clearSnap } = drawingSnap;
  const { circlePointAtPointer } = window.GeometryKernel;
  function snapForDrawing(point) { return drawingSnap.resolve(point, 10 / viewport.scale); }
  const splineCommand = window.SplineCommand.create({
    draft: splineDraft, addSpline, snapForDrawing, scale: () => viewport.scale,
    clearProjectionSources: () => { sketchProjectionSources = []; },
    setPointerPreview: value => { drawingPreview.setPointer(value); },
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
    selection: canvasSelection, setPointerPreview: value => { drawingPreview.setPointer(value); },
    clearSelection, setHint, updateUI, draw, solveAndRefresh, log,
  });
  const { click: handleLineClick } = lineCommand;
  const rectangleCommand = window.RectangleCommand.create({
    endpointAt, addPoint, addLine, addPointSnapConstraints, pushModelConstraint,
    minLineLength: MIN_LINE_LENGTH, samePosition, selection: canvasSelection,
    setPointerPreview: value => { drawingPreview.setPointer(value); },
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
    applicationText, setHint, updateUI, draw, invalidateAnalysis: () => { constraintAnalysis.invalidate(); },
    minLineLength: MIN_LINE_LENGTH, minArcLength: MIN_ARC_LENGTH,
  });
  const { createOffsetGeometry, createOffsetChainGeometry } = offsetConstruction;
  const offsetCommand = window.OffsetCommand.create({
    getPending: () => pendingCommand, setPending: value => { pendingCommand = value; },
    plans: offsetGeometry, construction: offsetConstruction, placement: dimensionPlacement, offsetSelection,
    viewport, Line, Circle, minOrientationLength: MIN_ORIENTATION_LENGTH, offsetPairSign,
    offsetChainErrorText, formatDisplayNumber, formatDimensionLabel, setHint, updateToolbar,
    syncDimensionValueInput, focusDimensionValueInput, hideDimensionValueInput, draw,
    clearPointerPreview: () => { drawingPreview.setPointer(null); }, clearSelection,
    setPointerPreview: value => { drawingPreview.setPointer(value); }, syncOffsetChainSelection,
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
    invalidateAnalysis: () => { constraintAnalysis.invalidate(); },
  });
  const { captureValues: snapshotModelState, restoreValues: restoreModelState, captureGeometry: snapshotGeometryMutationState, restoreGeometry: restoreGeometryMutationState } = editingCheckpoint;
  const sketchSolving = window.SketchSolving.create({
    currentScope: workspace.current, solver, scopeQuery: solveScopeQuery, activeSketchId, elementSketchId,
    constraintSketchId, constraintGraphNodes, constraintIsOperational, geometryInstanceBundles, orderedSketches,
    synchronizeSketchProjectionMetadata, refreshReferenceConstraintValidity, normalizeArcSweeps,
    resultIsAccepted, restoreModelState, acceptError: CONSTRAINT_ACCEPT_ERROR,
    profileDependencies: work => interactionProfiler.active ? profileInteractionWork("dependencies", work) : work(),
  });
  const parameterStabilization = window.ParameterStabilization.create({
    namespace: parameterNamespace, currentParameterNamespace, activeSketchId,
    solveSketchAndDependents: sketchSolving.solveSketchAndDependents,
    captureValues: snapshotModelState, restoreValues: restoreModelState,
    maxPasses: PARAMETER_STABILIZATION_MAX_PASSES, relativeTolerance: PARAMETER_STABILIZATION_RELATIVE_TOLERANCE,
    nonConvergenceReason: () => applicationText("Parameter計算が収束しません", "Parameter calculation did not converge"),
    profile: work => interactionProfiler.active ? profileInteractionWork("parameters", work) : work(),
  });
  const filletCommand = window.FilletCommand.create({
    getPending: () => pendingCommand, setPending: value => { pendingCommand = value; },
    guardSketchProjectionShapeEdit, filletGeometryBasis, filletGeometryFromPointer, hideDimensionValueInput,
    snapshotGeometryMutationState, restoreGeometryMutationState, createFillet, clearSelection, selection: canvasSelection,
    stabilize: () => stabilizeActiveParameterNamespace(activeSketchId()), acceptError: CONSTRAINT_ACCEPT_ERROR,
    invalidateAnalysis: () => { constraintAnalysis.invalidate(); }, refreshConstraintAnalysis,
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
    canvasSelection, clearRemovedHover: removed => { if (removed.has(canvasHover.current.dimension)) canvasHover.update({ dimension: null }); },
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
    setHint, syncDimensionValueInput, draw, activeSketchId, sketchHasDimensionConstraint,
    captureSketchScreenFootprint: (sketchId = activeSketchId()) => viewport.captureBoundsFootprint(sketchGeometryBounds(sketchId)),
    snapshotModelState, restoreModelState, withTemporarySolveStepNorm, solveStepNormForConstraint,
    stabilizeActiveParameterNamespace, constraintSketchId, acceptError: CONSTRAINT_ACCEPT_ERROR,
    hideDimensionValueInput, recordHistory, updateUI, scaleSketchForFirstDimension,
    addDistanceConstraintFromTarget,
    restoreSketchScreenFootprint: (sketchId, footprint) => viewport.restoreBoundsFootprint(sketchGeometryBounds(sketchId), footprint),
  });
  const { submit: submitDistanceValue, commitProperty: commitDimensionPropertyEdit } = dimensionValueCommand;
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
    setPointerPreview: value => { drawingPreview.setPointer(value); }, setMode: value => { mode = value; },
    invalidateAnalysis: () => { constraintAnalysis.invalidate(); }, setHint, updateUI, draw,
  });
  const { reset: resetCenterlineCommandState, prepare: prepareCenterlineEndpointPlacement, click: handleCenterlineClick, projectPointToCenterlineSupport } = centerlineCommand;
  const circularConstruction = window.CircularConstruction.create({
    endpointAt, addPoint, addCircle, addArc, addPointSnapConstraints, addArcEndpointSnapConstraints, addCircularBoundarySnapConstraints,
    currentScope: workspace.current, sequences: geometryIds,
  });
  const circularCommands = window.CircularCommands.create({
    construction: circularConstruction, selection: canvasSelection, minArcLength: MIN_ARC_LENGTH,
    setPointerPreview: point => { drawingPreview.setPointer(point); }, clearSnap, clearSelection, setHint, updateUI, draw, solveAndRefresh,
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
    setPointerPreview: point => { drawingPreview.setPointer(point); }, clearSnap, clearSelection, setHint, updateUI, draw,
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
    const hasDuplicateConstraints = (constraintRedundancy.count) > 0;
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
      ...parameterNamespace.symbolElementsInNamespace(model).map((constraint) => String(constraint.parameterName || "")),
    ]);
  }

  function commitAnnotationParameterEdit(item, property, value) {
    const snapshot = snapshotModelState();
    try {
      if (property === "annotation-parameter-enabled") {
        if (!value && !guardDimensionSymbolDeletion([item])) return false;
        item.parameterEnabled = Boolean(value);
        if (item.parameterEnabled) ensureDimensionParameter(item, currentParameterNamespace());
      } else if (property === "annotation-parameter-name") parameterNamespace.renameDimension(item, value);
      else if (property === "annotation-expression") item.expression = expressionFromUserInput(value);
      const solved = stabilizeActiveParameterNamespace(activeSketchId(), { allSketches: model.sketches.filter(sketch => !isRootSketch(sketch)).map(sketch => sketch.id) });
      if (!solved.success || solved.dependent?.success === false) throw new Error(solved.result.reason);
      recordHistory("注記Parameter変更");
      return true;
    } catch (error) {
      restoreModelState(snapshot);
      setHint(parameterErrorText(error), "error");
      return false;
    }
  }

  function guardDimensionSymbolDeletion(constraints, namespace = currentParameterNamespace()) {
    const removedConstraints = new Set(constraints || []);
    const removedNames = [...removedConstraints].filter(item => isDimensionConstraint(item) || item.parameterEnabled === true).map((constraint) => constraint.parameterName).filter(Boolean);
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

  function isGeometryMode() {
    return true;
  }


  function constraintGeometryId(item) {
    return geometryRefId(geometryRefForItem(item));
  }

  function geometryElementKey(item) {
    return geometryRefKey(geometryRefForItem(item)) || "";
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


  function snappedBlockRotation(rotation) {
    const quarterTurns = Math.round((Number(rotation) || 0) / BLOCK_ORTHOGONAL_ROTATION_STEP);
    return ((quarterTurns % 4) + 4) % 4 * BLOCK_ORTHOGONAL_ROTATION_STEP;
  }



  function blockInstanceById(id) {
    return model.blockInstances.find((instance) => instance.id === id) || null;
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

  function hitHatchAt(x, y, { activeOnly = true } = {}) {
    const point = { x, y };
    const candidates = allHatches().filter((hatch) => {
      if (!isVisibleSketchId(hatch.sketchId) || !isVisibleValue(hatchAppearanceForDisplay(hatch).visible)) return false;
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
      if (!isVisibleValue(item.visible) || !isVisibleSketchId(item.sketchId)) continue;
      if (activeOnly && item.sketchId !== activeSketchId()) continue;
      const local = referenceImageWorldToLocal(item, point);
      if (Math.abs(local.x) <= item.pixelWidth / 2 && Math.abs(local.y) <= item.pixelHeight / 2) return item;
    }
    return null;
  }

  const referenceImageInteraction = window.ReferenceImageInteraction.create({
    clearSelection, canvasSelection, applicationText, setHint, updateUI, draw, clearSnap,
    beginPointer: (id) => { canvas.classList.add("is-dragging"); canvas.setPointerCapture(id); },
    endPointer: (id) => { canvas.classList.remove("is-dragging"); try { canvas.releasePointerCapture(id); } catch (_) {} },
    viewScale: () => viewport.scale, hypot2, hitReferenceImageAt, referenceImageWorldToLocal, referenceImageLocalToWorld,
    promptDistance: (message, value) => window.prompt(message, value), formatDisplayNumber, recordHistory,
  });
  const { beginDrag: beginReferenceImageDrag, updateDrag: updateReferenceImageDrag,
    startCalibration: startReferenceImageCalibration, cancelCalibration: cancelReferenceImageCalibration,
    calibrationClick: handleReferenceImageCalibrationClick } = referenceImageInteraction;

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

  function canCreateInActiveSketch() {
    return isGeometryMode() && isDrawableSketch(activeSketchId());
  }

  function rejectRootSketchCreation() {
    if (canCreateInActiveSketch()) return false;
    setHint("Root Sketchには図形を作成できません。子スケッチをダブルクリックしてアクティブにしてください。", "error");
    clearSnap();
    drawingPreview.setPointer(null);
    draw();
    return true;
  }

  function parentSketchOf(sketch) {
    ensureSketchState();
    return window.SketchHierarchy.parentSketchOf(model.sketches, sketch);
  }

  function sketchDepth(sketch) {
    ensureSketchState();
    return window.SketchHierarchy.sketchDepth(model.sketches, sketch);
  }

  function isVisibleValue(visible) {
    return viewState.showHiddenElements || visible !== false;
  }

  function isVisibleSketchId(sketchId) {
    const id = sketchId || activeSketchId();
    const sketch = sketchById(id);
    if (!sketch) return false;
    const appearance = effectiveAppearanceForSketch(sketch);
    return isVisibleValue(appearance.visible);
  }

  function isVisibleSketchElement(item) {
    return isVisibleSketchId(elementSketchId(item)) && isVisibleValue(effectiveAppearanceForElement(item).visible);
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
    if (commandPanelSelectedItem) return geometryRefsEqual(geometryRefForItem(item), geometryRefForItem(commandPanelSelectedItem));
    if (mode === "instance-sources" && instanceSourceCommand.includesRef(geometryRefForItem(item))) return true;
    if (mode === "sketch-projection" && sketchProjectionSources.some((entry) => entry.item === item)) return true;
    if (["mirror-axis", "pattern-direction"].includes(mode) || mode.startsWith("free-instance-")) {
      if (item === geometryInstanceCommand.reference || geometryInstanceCommand.sources.some(ref => geometryRefsEqual(ref, geometryRefForItem(item)))) return true;
    }
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

  function constraintDuplicateSummary() {
    const count = constraintRedundancy.count;
    return count > 0 ? applicationSettings.language === "en" ? ` / Duplicate constraints: ${count}` : ` / 重複拘束: ${count}` : "";
  }

  function referenceConstraintErrorSummary() {
    const count = referenceConstraintState.errorCount;
    return count > 0 ? applicationSettings.language === "en" ? ` / Reference errors: ${count}` : ` / 参照エラー: ${count}` : "";
  }

  function clearSketchSolveState(...args) { return sketchSolving.clearSketchSolveState(...args); }
  function setSketchSolveOk(...args) { return sketchSolving.setSketchSolveOk(...args); }
  function setSketchSolveError(...args) { return sketchSolving.setSketchSolveError(...args); }
  function sketchSolveState(...args) { return sketchSolving.sketchSolveState(...args); }

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
    if (solved.success && !historyController.restoring) recordHistory(label);
    return result;
  }

  function stabilizeActiveParameterNamespace(...args) { return parameterStabilization.stabilize(...args); }

  function geometryErrorNorm() {
    return vectorNorm(solver.computeErrorVector());
  }

  function refreshConstraintAnalysis(options = {}) { return constraintAnalysis.refresh(options); }

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
    const s = constraintAnalysis.summary();
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
    if (hint && changed) setHint(next ? "拘束状態表示: 表示中のGeometryの拘束状態を表示しています" : "通常表示");
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
    const selectedSources = selectedGeometryItems().map(sketchProjectionEntryFromItem)
      .filter(entry => entry && !sketchProjectionSourceIsCovered(entry.item));
    cancelConstraintTargetCommand("");
    cancelPendingCommand("");
    if (!canCreateInActiveSketch()) return void rejectRootSketchCreation();
    clearSelection();
    mode = "sketch-projection";
    sketchProjectionSources = [...new Map(selectedSources.map(entry => [entry.key, entry])).values()];
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
    drawingPreview.setPointer(null);
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
      constraintAnalysis.invalidate();
      setHint(`${applicationText("円中心十字線を作成できません", "Could not create the circle center cross")}: ${reason}`, "error");
      updateUI();
      draw();
      return false;
    }

    mode = "select";
    drawingPreview.setPointer(null);
    clearSnap();
    clearSelection();
    canvasSelection.set("lines", createdLines);
    constraintAnalysis.invalidate();
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
    drawingPreview.setPointer(null);
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
    blankCanvasGesture.resetCandidate();
    drawingPreview.setPointer(null);
    clearSelection();
    clearSnap();
    updateToolbar();
    setHint(applicationText("通過点をクリックしてください。Enterまたは空白のダブルクリックで終了（ダブルクリック位置は追加しません）、始点クリックで閉じます", "Click fit points. Press Enter or double-click blank canvas to finish without adding that position, or click the start point to close."));
    draw();
  }

  function beginSplineEditFromDoubleClick(hitS) {
    clearSelection();
    canvasSelection.set("splines", [hitS]);
    splineEditSession = { spline: hitS };
    setHint(applicationText(`${hitS.id} の通過点を編集します。Escまたは空白のダブルクリックで終了します`, `Editing fit points of ${hitS.id}. Press Esc or double-click blank canvas to finish.`));
    updateUI({ refreshAnalysis: false });
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
    constraintAnalysis.invalidate();
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
      "invalid-boundary": ["境界データが正しくありません", "The fill boundary data is invalid"],
    };
    const pair = messages[result?.code];
    return pair ? applicationText(pair[0], pair[1]) : applicationText("閉領域を判定できません", result?.reason || "Could not detect a closed region");
  }

  const blockSelectionQuery = window.BlockSelectionQuery.create({
    currentScope: workspace.current, canvasSelection, blockProjectionBundle, elementSketchId, activeSketchId,
    constraintGraphNodes, serializeConstraint, constraintLabelForList: (constraint) => localizedConstraintName(constraint.name), resolveGeometryRef,
    applicationText, mergeBounds, lineBBox, primitiveBBox, splineBBox, annotationBounds,
  });
  const { read: blockSelectionGeometry, center: blockSelectionBoundsCenter } = blockSelectionQuery;

  function rebuildBlockDefinitionConstraintObjects(definition) {
    return constraintRebinding.rebuildDefinition(definition);
  }

  function rebuildStoredBlockDefinitionConstraints() {
    return documentModel.blockDefinitions.reduce((removed, definition) => removed + rebuildBlockDefinitionConstraintObjects(definition), 0);
  }

  const blockDefinitionCommand = window.BlockDefinitionCommand.create({
    blockEditor, blockDefinitionEditing, blockCatalog, blockEditingQueries, documentModel,
    currentScope: workspace.current, canStartCreation: () => isGeometryMode() && canCreateInActiveSketch(),
    canvasSelection, captureHost: () => ({ ...workspace.capture(), viewport: viewport.snapshot() }),
    defaultName: () => `Block-${blockDefinitionSeq}`, blockSelectionGeometry, blockSelectionBoundsCenter,
    guardDimensionSymbolDeletion, resetBlockEditorHistory, clearSelection,
    setMode: (value) => { mode = value; }, closeDefinitions: () => blockView.closeDefinitions(),
    setEditorActive: (active) => blockView.setEditorActive(active), fitAllGeometryToViewport,
    resetEmptyViewport: () => {
      const rect = canvas.getBoundingClientRect();
      viewport.update({ scale: CSS_PX_PER_MM });
      viewport.update({ x: rect.width / 2 });
      viewport.update({ y: rect.height / 2 });
    },
    promptName: (name) => window.prompt("ブロック名", name), invalidateBlockProjectionCache,
    updateBlockUI, updateUI, draw, recordHistory, setHint,
  });
  const { startCreation: startBlockCreation, open: openBlockDefinitionEditor, enter: enterBlockDefinitionEdit,
    restoreHost: restoreBlockEditorHost, cancel: cancelBlockDefinitionEdit,
    rename: renameBlockDefinition, remove: deleteBlockDefinition } = blockDefinitionCommand;




  function reserveBlockEditorSequences(draft) {
    reserveGeometryElementSequences(draft);
    sketchSeq = Math.max(sketchSeq, nextSeq(draft.sketches || [], "S"));
    annotationSeq = Math.max(annotationSeq, nextSeq(draft.annotations || [], "AN"));
    hatchSeq = Math.max(hatchSeq, model.nextHatchIndex, nextSeq(draft.hatches || [], "H"));
    referenceImageSeq = Math.max(referenceImageSeq, nextSeq(draft.referenceImages || [], "IMG"));
  }

  const choiceDialog = window.ChoiceDialog.create(document.getElementById("choiceDialog"));
  const blockCompletionCommand = window.BlockCompletionCommand.create({
    blockEditor, blockDefinitionEditing, blockCatalog, documentModel, currentScope: workspace.current,
    blockDefinitionCyclePath, duplicateBlockElementId, refreshReferenceConstraintValidity,
    hasInvalidReferenceConstraints: () => referenceConstraintState.errorCount > 0,
    solveSketchById, resultIsAccepted, sketchName, solveReferenceDependentSketches,
    requestChoice: (options) => choiceDialog.show(options), applicationText, blockLocalGeometryBounds,
    storedBlockInstancesReferencing, restoreBlockEditorHost, rebuildStoredBlockDefinitionConstraints,
    nextInstanceId: () => `BI${blockInstanceSeq++}`, constraintGraphNodes, annotationReferencesRemovedGeometry,
    invalidateBlockProjectionCache, blockProjectionBundles, geometryElementKey, blockDefinitionDependsOn,
    acceptError: CONSTRAINT_ACCEPT_ERROR, setSketchSolveOk, setSketchSolveError,
    clearSelection, canvasSelection, setMode: (value) => { mode = value; },
    setHint, log, updateUI, draw, recordHistory,
  });
  const { complete: completeBlockDefinitionEdit } = blockCompletionCommand;

  function exitBlockDefinitionEdit() {
    completeBlockDefinitionEdit();
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
    sketchMoveCommand?.reset();
    activateEditingScope(documentModel);
    flushScheduledCanvasPointerMove({ discard: true });
    mode = "select";
    lastAuthoringPerformance = null;
    window.DocumentState.clearContent(documentModel);
    referenceImageRenderer.clear();
    invalidateBlockProjectionCache();
    sketchSolving.clearAll();
    referenceConstraintState.clear();
    constraintAnalysis.invalidate();
    clearSelection();
    geometryDrag.reset();
    dimensionDrag.reset();
    referenceImageInteraction.reset();
    canvasNavigation.reset();
    blankCanvasGesture.clearSuppression();
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
    drawingPreview.setPointer(null);
    offsetSelection.reset();
    pendingCommand = null;
    pendingConstraintCommand = null;
    constraintOperands = [];
    constructionLineMode = false;
    canvasHover.update({
      point: null, endpointPoint: null, line: null,
      circle: null, arc: null, spline: null,
      arcEndpoint: null, dimension: null,
    });
    selectionHighlight.reset();
    canvasHover.update({ sketchIdentity: null });
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
    canvasHover.update({ block: null });
    canvasSelection.set("instanceGeometry", null);
    canvasHover.update({
      geometryInstance: null, hatch: null, referenceImage: null,
    });
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
    hatchCommand.reset();
    hatchGeometryQuery.clear();
    sketchTreeView.reset();
    annotationDrag.reset();
    referenceImageInteraction.reset();
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

  const blockHistorySnapshot = window.BlockHistorySnapshot.create({
    cloneDefinition: cloneBlockDefinition, serializeConstraint, decorateSerializedConstraint,
  });


  function resetBlockEditorHistory() {
    return historyController.resetBlock();
  }

  function createBlockEditHistory() {
    return window.EditHistory.create({
      capture: () => blockHistorySnapshot.capture(liveBlockEditorDefinition()),
      signature: (snapshot) => snapshot?.signature,
      restore: restoreBlockEditorHistorySnapshot,
      limit: HISTORY_LIMIT,
      recordLabel: "ブロック編集履歴に追加しました",
      undoLabel: "ブロック編集を戻す",
      redoLabel: "ブロック編集を進む",
    });
  }

  function activeEditHistory() {
    return historyController.active();
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
    return historyController.resetDocument(label);
  }

  function recordHistory(label = "変更") {
    if (!interactionProfiler.active) return recordHistoryUnprofiled(label);
    return profileInteractionWork("history", () => recordHistoryUnprofiled(label));
  }

  function recordHistoryUnprofiled(label = "変更") {
    return historyController.record(label);
  }

  function restoreHistorySnapshot(snapshot, label) {
    const constructionModeBeforeRestore = constructionLineMode;
    const documentNameBeforeRestore = documentModel.documentName;
    return historyController.restore(() => {
      loadModelData(JSON.parse(snapshot), { documentNameFallback: documentNameBeforeRestore, preserveSketchTreeState: true });
      documentModel.documentName = documentNameBeforeRestore;
      constructionLineMode = constructionModeBeforeRestore;
      clearInteractionForSketchChange();
      solveAndRefresh(label);
      setHint(label);
    });
  }

  function restoreBlockEditorHistorySnapshot(snapshot, label) {
    if (!blockEditor.current || !snapshot?.definition) return false;
    return historyController.restore(() => {
      const restored = cloneBlockDefinition(snapshot.definition);
      blockEditor.replaceDraft(restored);
      invalidateBlockProjectionCache();
      clearInteractionForSketchChange();
      solveAndRefresh(label);
      setHint(label);
      return true;
    });
  }

  function undoHistory() {
    return historyController.undo();
  }

  function redoHistory() {
    return historyController.redo();
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
    canvasHover.update({
      sketchIdentity: null, block: null, geometryInstance: null,
    });
    selectionHighlight.reset();
    canvasHover.update({
      annotation: null, hatch: null, referenceImage: null,
      spline: null,
    });
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
    drawingPreview.reset();
    offsetSelection.reset();
    clearSnap();
    mode = "select";
    updateToolbar();
    setHint("連続線を終了しました");
    updateUI();
    draw();
  }

  function exitDrawMode() {
    geometryInstanceCommand.reset();
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
    drawingPreview.reset();
    offsetSelection.reset();
    hatchCommand.reset();
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
    drawingPreview.reset();
    offsetSelection.reset();
    hatchCommand.reset();
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




























  const { hitSketchIdentityElement, hitEndpointPoint, hitExplicitPoint, hitAnyPoint, hitPoint, hitLine, hitCircle, hitArc, hitArcEndpoint, hitSpline } = window.GeometryHitQuery.create({
    currentScope: workspace.current, viewportScale: () => viewport.scale,
    isEditableSketchElement, isSelectableEndpointPoint, isExplicitPoint,
    hitDimension, constraintSketchId, elementSketchId, isVisibleSketchElement, hitBlockInstance, blockDefinitionById,
  });

  function fitSketchToViewport(sketchId = activeSketchId(), paddingPx = 96) {
    return fitBoundsToViewport(sketchGeometryBounds(sketchId), paddingPx);
  }

  function fitAllGeometryToViewport(paddingPx = 96) {
    return fitBoundsToViewport(allGeometryBounds(), paddingPx);
  }

  function fitVisibleGeometryToViewport(paddingPx = 96) {
    return fitBoundsToViewport(visibleGeometryBounds(), paddingPx);
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
      constraintRedundancy.forgetConstraint(constraint);
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
      if (!isVisibleValue(effectiveDimensionAppearance(dimension, constraintSketchId(constraint)).visible)) continue;
      const layout = dimensionLayout(target, dimension);
      if (!layout) continue;
      const appearance = effectiveDimensionAppearance(dimension, constraintSketchId(constraint));
      let scaledLabelHit = false;
      if (appearance.fixedDisplaySize === false || /[\r\n]/.test(dimensionLabelForConstraint(constraint, target, dimension))) {
        const label = dimensionLabelForConstraint(constraint, target, dimension);
        const metrics = dimensionTextDrawingMetrics(appearance);
        const width = dimensionTextWidth(label, appearance, dimensionUsesExpression(constraint));
        const angle = -(Number(layout.textAngle) || 0);
        const dx = x - layout.text.x, dy = y - layout.text.y;
        scaledLabelHit = pointInExpandedBox(dx * Math.cos(angle) - dy * Math.sin(angle), dx * Math.sin(angle) + dy * Math.cos(angle),
          { left: -width / 2, right: width / 2, top: -metrics.gap - metrics.height * (1 + (String(label).split(/\r\n|\r|\n/).length - 1) * 1.2), bottom: -metrics.gap }, threshold);
      }
      if (scaledLabelHit || hypot2(x - layout.text.x, y - layout.text.y) <= threshold * 2.2) {
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
        return resolved.ok && isVisibleValue(hatchAppearanceForDisplay(hatch).visible) && hatchContainsSelectablePoint(hatch, resolved, { x, y });
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





















  const { hitDerivedProjectionOperand, hitBlockProjectionOperand, hitReferenceTarget } = window.OperandHitQuery.create({
    viewportScale: () => viewport.scale,
    geometry: { geometryInstanceBundles, blockProjectionBundles, allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines },
    sketches: { isVisibleSketchId, operandRelationForSketch, referenceSourceSketchIds, elementSketchId, isVisibleSketchElement },
    points: { isExplicitPoint, isPointUsedByPrimitive, isReferencePoint }, makeConstraintOperand,
  });

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

  function solveActiveSketch(...args) { return sketchSolving.solveActiveSketch(...args); }
  function solveSketchById(...args) { return sketchSolving.solveSketchById(...args); }

  function solveFinalDragSession(session) {
    if (!interactionProfiler.active) return geometryDragEditing.finish(session);
    return profileInteractionWork("solve", () => geometryDragEditing.finish(session));
  }

  function solveReferenceDependentSketches(...args) { return sketchSolving.solveReferenceDependentSketches(...args); }
  function solveSketchAndDependents(...args) { return sketchSolving.solveSketchAndDependents(...args); }
  function solveConstraintComponentAndDependents(...args) { return sketchSolving.solveConstraintComponentAndDependents(...args); }

  function solveElementSketchAndDescendants(element, rollbackState = null) {
    return solveSketchAndDependents(elementSketchId(element), rollbackState);
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
    const removedAnnotationsForSymbols = model.annotations.filter(annotation => annotationReferencesRemovedGeometry(annotation, new Set([...pointSet, ...lineSet, ...circleSet, ...arcSet, ...splineSet].map(item => item.id)), removedKeysForDependency));
    if (!guardDimensionSymbolDeletion([...constraintSet, ...removedAnnotationsForSymbols])) return false;

    geometryDrag.reset();
    dimensionDrag.reset();
    annotationDrag.reset();
    pendingCommand = null;
    pendingConstraintCommand = null;
    lineCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    drawingPreview.setPointer(null);
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
    canvasSelection.set("dimensionConstraints", canvasSelection.dimensionConstraints.filter(item => !constraintSet.has(item)));
    if (constraintSet.has(canvasSelection.constraint)) canvasSelection.set("constraint", null);
    if (constraintSet.has(canvasHover.current.dimension)) canvasHover.update({ dimension: null });

    const result = solveActiveSketch();
    normalizeArcSweeps();
    updateToolbar();
    updateUI();
    draw();
    const msg = `削除しました: 点${pointSet.size} / 線${lineSet.size} / 円${circleSet.size} / 円弧${arcSet.size} / スプライン${splineSet.size} / 拘束${constraintSet.size}`;
    const stable = result.success && constraintAnalysis.stable;
    setHint(stable ? msg : `${msg}。拘束状態を確認してください`, stable ? "normal" : "error");
    log(`${msg}\n自動solve: success=${result.success}, error=${result.errorNorm.toExponential(3)}`);
    recordHistory("削除");
    return true;
  }

  function deleteCurrentSelection() {
    const annotationsToDelete = canvasSelection.annotations.filter((annotation) => model.annotations.includes(annotation));
    const hatchesToDelete = canvasSelection.hatches.filter((hatch) => model.hatches.includes(hatch));
    const referenceImagesToDelete = canvasSelection.referenceImages.filter((image) => model.referenceImages.includes(image));
    if (annotationsToDelete.length > 0 && !guardDimensionSymbolDeletion(annotationsToDelete)) return false;
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
      referenceImageInteraction.forget(referenceImagesToDelete);
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
      if (!guardDimensionSymbolDeletion([...removedConstraints, ...model.annotations.filter(annotation => annotationReferencesRemovedGeometry(annotation, removedIds, removedKeys))])) return false;
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
      if (!guardDimensionSymbolDeletion([...removedConstraints, ...model.annotations.filter(annotation => annotationReferencesRemovedGeometry(annotation, removedIds, removedKeys))])) return false;
      model.constraints = model.constraints.filter((constraint) => !removedConstraints.has(constraint));
      model.annotations = model.annotations.filter((annotation) => !annotationReferencesRemovedGeometry(annotation, removedIds, removedKeys));
      model.blockInstances = model.blockInstances.filter((instance) => !instances.includes(instance));
      invalidateBlockProjectionCache();
      canvasSelection.set("blockInstances", []);
      deletedBlockCount = instances.length;
    }
    const constraints = [...new Set([...canvasSelection.dimensionConstraints, effectiveSelectedConstraint()].filter(Boolean))];
    const deletedGeometry = deleteElements({ points: canvasSelection.points, lines: canvasSelection.lines, circles: canvasSelection.circles, arcs: canvasSelection.arcs, splines: canvasSelection.splines, constraints });
    if (deletedGeometry) return true;
    if (deletedBlockCount === 0 && deletedInstanceCount === 0 && annotationsToDelete.length === 0 && hatchesToDelete.length === 0 && referenceImagesToDelete.length === 0) return false;
    clearSelection();
    if (deletedBlockCount > 0 || deletedInstanceCount > 0) solveAndRefresh("インスタンス削除");
    else {
      updateUI();
      draw();
      recordHistory(referenceImagesToDelete.length ? "画像削除" : hatchesToDelete.length ? "塗りつぶし削除" : "注記削除");
    }
    setHint(applicationText(`削除しました: 派生インスタンス${deletedInstanceCount} / ブロック${deletedBlockCount} / 画像${referenceImagesToDelete.length} / 塗りつぶし${hatchesToDelete.length} / 注記${annotationsToDelete.length}`, `Deleted: derived instances ${deletedInstanceCount} / blocks ${deletedBlockCount} / images ${referenceImagesToDelete.length} / fills ${hatchesToDelete.length} / annotations ${annotationsToDelete.length}`));
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
        setHint(applicationText(`塗りつぶし ${hatch.id} の境界 ${missing.map(geometryRefId).join("、")} も選択してください`, `Also select boundary ${missing.map(geometryRefId).join(", ")} for fill ${hatch.id}`), "error");
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
      annotations: annotations.map(annotation => ({ ...serializeAnnotation(annotation), parameterValue: annotation.evaluatedParameterValue })),
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

  function translatedClipboardConstraintData(source, idMap, dx, dy) {
    const data = remapClipboardValue(source, idMap);
    if (data.dimension) {
      for (const key of ["x", "labelX"]) if (Number.isFinite(Number(data.dimension[key]))) data.dimension[key] = Number(data.dimension[key]) + dx;
      for (const key of ["y", "labelY"]) if (Number.isFinite(Number(data.dimension[key]))) data.dimension[key] = Number(data.dimension[key]) + dy;
    }
    window.ConstraintRebinding.translateFixedValues(data, dx, dy);
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
        if (!boundaryLoops) throw new Error(`${source.id}: ${applicationText("塗りつぶし境界を書き換えられません", "Could not rewrite fill boundary")}`);
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
          && !parameterNamespace.symbolElementsInNamespace(currentParameterNamespace()).some((constraint) => constraint.parameterName === source.parameterName)
          && !(currentParameterNamespace().parameters || []).some((parameter) => parameter.name === source.parameterName);
        copiedDimensionNames.set(source.parameterName, keepCutName ? source.parameterName : allocateDimensionParameterName(currentParameterNamespace()));
      }
      (payload.annotations || []).forEach((source, index) => {
        const annotation = pastedAnnotations[index];
        if (!annotation?.parameterEnabled) return;
        const nextName = allocateDimensionParameterName(currentParameterNamespace());
        if (source.parameterName) copiedDimensionNames.set(source.parameterName, nextName);
        annotation.parameterName = nextName;
      });
      (payload.annotations || []).forEach((source, index) => {
        const annotation = pastedAnnotations[index];
        if (!annotation?.parameterEnabled) return;
        annotation.expression = sameNamespace ? rewriteParameterIdentifiers(source.expression || "0", copiedDimensionNames) : String(Number(source.parameterValue) || 0);
      });
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

  const rectangleSelectionQuery = window.RectangleSelectionQuery.create({
    currentScope: workspace.current, selectableSketchElement, isExplicitPoint, isReferencePoint, pointInRect,
    lineIntersectsRect, bboxInRect, lineBBox, isVisibleSketchElement, primitiveBBox, bboxIntersectsRect,
    arcSamplePoints, viewScale: () => viewport.scale, isEditableSketchId, isVisibleSketchId, blockProjectionBundle, mergeBounds,
    splineBBox, annotationBounds, resolvedLoopBounds, resolvedHatchBoundary, activeSketchId,
    hatchAppearanceForDisplay, referenceImageBounds, isVisibleValue,
    dimensionSelectionBounds: constraint => {
      if (!isActiveSketchConstraint(constraint) || !isVisibleSketchId(constraintSketchId(constraint))) return null;
      const target = targetFromConstraint(constraint);
      if (!target) return null;
      const dimension = constraint.dimension || defaultDimensionForTarget(target);
      const appearance = effectiveDimensionAppearance(dimension, constraintSketchId(constraint));
      if (!isVisibleValue(appearance.visible)) return null;
      const layout = dimensionLayout(target, dimension, appearance);
      if (!layout) return null;
      const metrics = dimensionTextDrawingMetrics(appearance);
      const label = dimensionLabelForConstraint(constraint, target, dimension);
      const width = dimensionTextWidth(label, appearance, dimensionUsesExpression(constraint));
      const top = -metrics.gap - metrics.height * (1 + (String(label).split(/\r\n|\r|\n/).length - 1) * 1.2);
      const angle = Number(layout.textAngle) || 0;
      const points = [layout.hitA, layout.hitB, ...[-width / 2, width / 2].flatMap(x => [top, -metrics.gap].map(y => ({ x: layout.text.x + x * Math.cos(angle) - y * Math.sin(angle), y: layout.text.y + x * Math.sin(angle) + y * Math.cos(angle) })))].filter(Boolean);
      return { x1: Math.min(...points.map(p => p.x)), y1: Math.min(...points.map(p => p.y)), x2: Math.max(...points.map(p => p.x)), y2: Math.max(...points.map(p => p.y)) };
    },
  });
  function selectByRect(rect, crossing, additive = false) {
    canvasSelection.set("instanceGeometry", null);
    canvasSelection.applyRectangle(rectangleSelectionQuery.read(rect, crossing), additive);
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
      const hovered = hatch.blockProjection ? canvasHover.current.block === hatch.blockInstance : hatch.sketchId === activeSketchId() && canvasHover.current.hatch === hatch;
      drawResolvedHatch(resolvedHatchBoundary(hatch), appearance, hatchPatternOrigin(hatch), { hatch, selected, hovered, alpha: sketchAlpha(hatch) });
    }
    if (includePreview && ["hatch", "hatch-repair"].includes(mode) && hatchCommand.preview?.result?.ok) {
      drawResolvedHatch({ ...hatchCommand.preview.result.resolved, ok: true }, DEFAULT_HATCH_APPEARANCE, { x: 0, y: 0 }, { preview: true });
    }
  }





  function drawReferenceImages() {
    referenceImageRenderer.drawImages(model.referenceImages.filter(item => isVisibleValue(item.visible) && isVisibleSketchId(item.sketchId)));
  }

  function drawReferenceImageOverlays() {
    const item = canvasSelection.referenceImages.length === 1 ? canvasSelection.referenceImages[0] : canvasHover.current.referenceImage;
    referenceImageRenderer.drawOverlays(
      item && isVisibleValue(item.visible) && isVisibleSketchId(item.sketchId) && item.sketchId === activeSketchId() ? item : null,
      canvasSelection.referenceImages.includes(item),
      referenceImageInteraction.calibrationPoints,
    );
  }

  function drawBlockPlacementPreview() {
    if (mode !== "block-place" || !blockPlacementCommand.definitionId || !drawingPreview.pointer) return;
    const preview = blockPlacementCommand.preview(drawingPreview.pointer);
    if (!preview) return;
    placementPreview.drawBlock(createBlockProjectionBundle(preview.instance, preview.definition));
  }

  function drawFreeInstancePreview() {
    placementPreview.drawFreeInstance(geometryInstanceCommand.preview(drawingPreview.pointer));
  }

  function draw() {
    commandPanel?.update();
    commandPanelSelectedItem = derivedPanel?.selectedItem() || null;
    if (!interactionProfiler.active) return drawUnprofiled();
    return profileInteractionWork("draw", () => drawUnprofiled());
  }

  function drawUnprofiled() {
    return withGeometryReadCache(drawCanvas);
  }

  function drawCanvas() {
    const zoomStatus = document.getElementById("statusZoom");
    const zoomText = formatZoom(viewport.scale);
    if (zoomStatus && zoomStatus.textContent !== zoomText) zoomStatus.textContent = zoomText;
    if (canvasSurface.width <= 0 || canvasSurface.height <= 0) syncCanvasBitmapSize();
    const dpr = canvasSurface.dpr;
    pointerMoveScheduler.recordDraw();
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
    const leaderPreview = annotationCommand.leaderPreview();
    if (leaderPreview) drawAnnotationLeader(leaderPreview, true);
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

  const selectionRectangle = window.SelectionRectangle.create({
    rectFromPoints, hypot2, viewScale: () => viewport.scale,
    releasePointer: (id) => { try { canvas.releasePointerCapture(id); } catch (_) {} },
    clearSelection, selectByRect, addSketchProjectionSourcesByRect, setHint, updateGeometrySelectionUI, draw,
  });

  function drawSelectionRect() {
    const preview = selectionRectangle.preview();
    if (!preview) return;
    const { rect, crossing } = preview;
    withCanvasState(() => {
      ctx.strokeStyle = crossing ? "#f59e0b" : "#2563eb";
      ctx.fillStyle = crossing ? "rgba(245, 158, 11, 0.08)" : "rgba(37, 99, 235, 0.08)";
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

  function drawSplinePreview() { if (mode === "spline") authoringPreview.drawSpline(splineDraft.points, drawingPreview.pointer); }

  function drawSplineEditHandles() { geometryRenderer.drawSplineEditHandles(splineHandleState()); }




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
    const arcExtension = outside ? dimensionMillimetersToWorld(appearance.terminatorSize * DIMENSION_OUTSIDE_SHAFT_LENGTH_FACTOR, appearance) / Math.max(layout.radius, 1e-12) : 0;
    dimensionRenderer.drawAngle({ layout, extensions, outside, arcExtension, appearance, label, preview, highlighted, editState, colorOverride, expressionMark });
  }
















  function drawDimensions() {
    for (const c of [...model.constraints].sort((a, b) => Number(isActiveSketchConstraint(a)) - Number(isActiveSketchConstraint(b)))) {
      if (!isVisibleSketchId(constraintSketchId(c))) continue;
      const target = targetFromConstraint(c);
      if (!target) continue;
      const dimension = c.dimension || defaultDimensionForTarget(target);
      const sketchId = constraintSketchId(c);
      if (!isVisibleValue(effectiveDimensionAppearance(dimension, sketchId).visible)) continue;
      const highlighted = c === canvasHover.current.dimension || canvasSelection.constraintSelectedInCanvas(c) || c === dimensionDrag.constraint;
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
      if (!isVisibleValue(element.visible) || !isVisibleSketchId(element.sketchId)) continue;
      if (element.type === "leader") drawAnnotationLeader(element);
      else if (element.type === "text") drawAnnotationText(element);
    }
  }

  function annotationDisplayColor(element, style = normalizeAnnotationStyle(element?.style)) {
    if (canvasSelection.annotations.includes(element)) return canvasThemeColor("#2563eb");
    if (element === canvasHover.current.annotation) return canvasThemeColor("#0ea5e9");
    return canvasThemeColor(style.color);
  }






  function annotationById(id) {
    return id ? model.annotations.find((element) => element.id === id) || null : null;
  }

  const annotationDrag = window.AnnotationDrag.create({
    annotationById, canvasSelection, setHint, updateUI, draw, recordHistory,
    beginPointer: (id) => { canvas.setPointerCapture(id); canvas.classList.add("is-dragging"); },
    endPointer: (id) => { canvas.classList.remove("is-dragging"); try { canvas.releasePointerCapture(id); } catch (_) {} },
  });
  const { begin: beginAnnotationDrag, update: updateAnnotationDrag } = annotationDrag;

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



  function drawTemporaryLine() { if (mode === "line") authoringPreview.drawLine(lineCommand.startPoint, drawingPreview.pointer); }

  function drawRectanglePreview() { if (mode === "rectangle") authoringPreview.drawRectangle(rectangleCommand.startPoint, drawingPreview.pointer); }

  function drawSlotPreview() { if (mode === "slot") authoringPreview.drawSlot(slotCommand.firstCenter, slotCommand.secondCenter, drawingPreview.pointer); }

  function drawCirclePreview() { if (mode === "circle") authoringPreview.drawCircle(circularCommands.circleCenterPoint, drawingPreview.pointer); }

  function drawArcPreview() { if (mode === "arc") authoringPreview.drawArc(circularCommands.arcCenterPoint, circularCommands.arcStartPoint, drawingPreview.pointer); }

  function drawThreePointArcPreview() { if (mode === "three-point-arc") authoringPreview.drawThreePointArc(circularCommands.threePointArcStart, circularCommands.threePointArcEnd, drawingPreview.pointer); }

  function drawOffsetPreview() {
    if (mode !== "offset") return;
    offsetPreviewRenderer.draw(offsetCommand.preview(drawingPreview.pointer));
  }

  function drawTrimPreview() { if (mode === "trim") authoringPreview.drawTrim(drawingPreview.trim); }

  function drawSnapMarker() { interactionOverlay.drawSnapMarker(drawingSnap.active); }
  function drawSketchIdentityLabel() {
    interactionOverlay.drawSketchIdentityLabel({ hoveredIdentity: canvasHover.current.sketchIdentity, selection: canvasSelection, pointer: lastPointerWorld });
  }

  function drawCenterlinePreview() {
    if (mode !== "centerline" || !centerlineCommand.support?.ok) return;
    authoringPreview.drawCenterline(centerlineCommand.support, centerlineCommand.firstPoint,
      drawingPreview.pointer ? projectPointToCenterlineSupport(drawingPreview.pointer) : null,
      { width: canvas.clientWidth, height: canvas.clientHeight });
  }

  function drawArcEndpointHandles() { geometryRenderer.drawArcEndpointHandles(allGeometryArcs().filter(isVisibleSketchElement)); }

  function drawPoints() {
    geometryRenderer.drawPoints(drawOrderBySketch(allGeometryPoints()));
  }

  function selectedVisibilityTargets() {
    if (canvasSelection.inspection || canvasSelection.sketchId) return [];
    return [
      ...selectedGeometryItems().filter(item => !item.blockProjection).map(item => ({ kind: "geometry", item })),
      ...canvasSelection.blockInstances.map(item => ({ kind: "block", item })),
      ...canvasSelection.geometryInstances.map(item => ({ kind: "geometryInstance", item })),
      ...canvasSelection.annotations.map(item => ({ kind: "annotation", item })),
      ...canvasSelection.hatches.map(item => ({ kind: "hatch", item })),
      ...canvasSelection.referenceImages.map(item => ({ kind: "referenceImage", item })),
    ];
  }

  function selectionVisibilityIsHidden(targets) {
    return targets.length > 0 && targets.every(target => {
      if (target.kind !== "geometryInstance") return multiplePropertyAppearance(target).visible === false;
      if (typeof target.item.appearanceOverride?.visible === "boolean") return !target.item.appearanceOverride.visible;
      const bundle = geometryInstanceBundle(target.item);
      const geometry = [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...bundle.splines];
      if (geometry.length) return geometry.every(item => effectiveAppearanceForElement(item).visible === false);
      return resolveGeometryAppearance({ defaults: documentModel.defaultAppearance,
        sketchAppearance: sketchById(target.item.sketchId)?.appearance,
        overrides: [target.item.appearanceOverride] }).visible === false;
    });
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
    const visibilityButton = document.getElementById("selectionVisibilityBtn");
    const visibilityTargets = selectedVisibilityTargets();
    if (visibilityButton) {
      const hidden = selectionVisibilityIsHidden(visibilityTargets);
      visibilityButton.disabled = !geometryMode || visibilityTargets.length === 0;
      visibilityButton.classList.toggle("active", hidden);
      visibilityButton.setAttribute("aria-pressed", String(hidden));
    }
    toolFlyouts?.sync();
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
    drawingPreview.reset();
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
    drawingPreview.reset();
    pendingConstraintCommand = { type: "distance" };
    pendingCommand = {
      type: "distance-place",
      target: resolution.target,
      resolution,
      pointer: defaultDimensionForTarget(resolution.target),
      operands: resolution.operands || constraintOperands.slice(),
      referenceSketchId: resolution.referenceSketchId,
      sketchId: resolution.sketchId,
      readOnlyDimension: resolution.readOnlyDimension === true,
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
    drawingPreview.reset();
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
      drawingPreview.setPointer(null);
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
    const readOnlyDimension = pendingCommand.readOnlyDimension === true;
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
    const readOnlyConstraint = readOnlyDimensionConstraintForPlacement(target, value, dimension, { referenceSketchId, sketchId, readOnlyDimension });
    if (readOnlyConstraint) {
      pendingCommand = null;
      hideDimensionValueInput();
      addReadOnlyDimensionConstraint(readOnlyConstraint, sketchId || activeSketchId(), readOnlyDimension ? "参照元の測定寸法" : referenceSketchId ? "重複参照寸法" : "重複寸法");
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
    canvasHover.update({ point: referenceTarget?.kind === "point" ? referenceTarget.point : null });
    canvasHover.update({
      endpointPoint: canvasHover.current.point, line: referenceTarget?.kind === "line" ? referenceTarget.line : null, circle: referenceTarget?.primitive instanceof Circle ? referenceTarget.primitive : null,
      arc: referenceTarget?.primitive instanceof Arc ? referenceTarget.primitive : null, arcEndpoint: null, dimension: null,
    });
  }

  function updatePendingDistanceRetargetHover(pointer) {
    if (pendingCommand?.type !== "distance-place" || !["line-length", "radius", "diameter"].includes(pendingCommand.target.kind)) {
      canvasHover.update({
        point: null, endpointPoint: null, line: null,
        circle: null, arc: null,
      });
      return false;
    }
    const baseOperands = (pendingCommand.operands || []).filter(Boolean);
    const operand = baseOperands.length === 1 ? hitConstraintOperand(pointer, "distance") : null;
    const resolution = operand && !sameConstraintOperand(baseOperands[0], operand)
      ? resolveConstraintIntent("distance", [baseOperands[0], operand])
      : null;
    const target = resolution?.target && resolution.target.kind !== "invalid" ? referenceTargetFromOperand(operand) : null;
    const changed =
      (target?.kind === "point" ? target.point : null) !== canvasHover.current.point ||
      (target?.kind === "line" ? target.line : null) !== canvasHover.current.line ||
      (target?.primitive instanceof Circle ? target.primitive : null) !== canvasHover.current.circle ||
      (target?.primitive instanceof Arc ? target.primitive : null) !== canvasHover.current.arc ||
      canvasHover.current.arcEndpoint ||
      canvasHover.current.dimension;
    applyReferenceHoverTarget(target);
    canvasHover.update({
      arcEndpoint: null, block: null,
    });
    return changed;
  }

  function startDimensionEditInput(hit) {
    if (!hit?.constraint) return false;
    const target = targetFromConstraint(hit.constraint);
    if (!target) return false;
    if (isReadOnlyDimension(hit.constraint)) {
      canvasSelection.set("dimensionConstraint", hit.constraint);
      canvasSelection.set("constraint", null);
      dimensionDrag.reset();
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
    dimensionDrag.reset();
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
    sketchMoveCommand?.reset();
    clearSelection();
    geometryDrag.reset();
    dimensionDrag.reset();
    referenceImageInteraction.reset();
    selectionRectangle.reset();
    lineCommand.reset();
    rectangleCommand.reset();
    filletCommand.reset();
    circularCommands.resetCircle();
    resetArcCommandState();
    drawingPreview.reset();
    offsetSelection.reset();
    pendingCommand = null;
    pendingConstraintCommand = null;
    sketchProjectionSources = [];
    geometryInstanceCommand.clearSources();
    instanceSourceCommand.reset();
    canvasHover.update({ sketchIdentity: null });
    lastPointerWorld = null;
    hideDimensionValueInput();
    clearSnap();
    mode = "select";
    updateToolbar();
  }

  const sketchCommand = window.SketchCommand.create({
    currentScope: workspace.current, ensureSketchState, activeSketch, activeSketchId, sketchById, childSketchesOf,
    sketchName, nextSketchId: () => `S${sketchSeq++}`, clearInteractionForSketchChange,
    setHint, updateUI, draw, recordHistory, promptName: (title, name) => window.prompt(title, name),
    effectiveAppearanceForElement, clearTreeHover: () => sketchTreeController.clearHoverSketch(), clearSnap,
  });
  const { createSketch, activate: setActiveSketch, rename: renameSketch, toggleVisibility: toggleSketchVisibility } = sketchCommand;
  const sketchMoveQuery = window.SketchMove.create({
    currentScope: workspace.current, activeSketchId, constraintGraphNodes, constraintSketchId,
    resolveGeometryRef, geometryInstanceDependencyRefs, isReferenceSourceSketchId, applicationText,
  });
  function refreshSketchMoveGeometry() {
    invalidateBlockProjectionCache();
    geometryReads.clearReadCache();
    hatchGeometryQuery.clear();
    constraintRebinding.rebuildDocument(model, [...blockProjectionBundles(), ...geometryInstanceBundles()]);
    constraintAnalysis.invalidate();
    refreshReferenceConstraintValidity();
  }
  sketchMoveCommand = window.SketchMoveCommand.create({
    currentScope: workspace.current, activeSketchId, selection: canvasSelection, query: sketchMoveQuery,
    prepare: () => { cancelConstraintTargetCommand(""); cancelPendingCommand(""); exitDrawMode(); canvasHover.clear(); },
    refresh: refreshSketchMoveGeometry, clearSelection, updateUI, draw, setHint, recordHistory, applicationText,
  });
  // Destination mode keeps all editing input in the tree until commit or cancellation.
  for (const eventName of ["pointerdown", "click", "dblclick", "contextmenu", "input", "change"]) {
    document.addEventListener(eventName, event => {
      if (!sketchMoveCommand.active || event.target.closest("#sketchList, #sketchOverlayResizeHandle")) return;
      event.preventDefault(); event.stopImmediatePropagation();
    }, true);
  }
  const hatchCommand = window.HatchCommand.create({
    currentScope: workspace.current, hatchGeometryQuery, getMode: () => mode, setMode: value => { mode = value; },
    lastPointer: () => lastPointerWorld, getPointerPreview: () => drawingPreview.pointer, setPointerPreview: value => { drawingPreview.setPointer(value); },
    activeSketchId, setActiveSketch, canCreateInActiveSketch, rejectRootSketchCreation,
    nextHatchId: () => `H${hatchSeq++}`, hatchSequence: () => hatchSeq,
    cancelConstraintTargetCommand, cancelPendingCommand, clearSnap, clearSelection, canvasSelection,
    updateToolbar, updateStatusUI, updateUI, setHint, draw, recordHistory, applicationText, hatchRegionErrorText,
  });
  const { updateHatchPreview, startHatchCreation, startHatchBoundaryRepair, commitHatchAt } = hatchCommand;



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

  const sketchDeletionCommand = window.SketchDeletionCommand.create({
    currentScope: workspace.current, ensureSketchState, sketchById, descendantSketchIds, constraintSketchId,
    geometryInstanceDependencyRefs, resolveGeometryRef, elementSketchId, rejectReferencedGeometryDeletion,
    sketchName, setHint, log, blockAllProjectionBundle, geometryElementKey, constraintGraphNodes,
    guardDimensionSymbolDeletion, invalidateBlockProjectionCache, annotationReferencesRemovedGeometry,
    clearSketchSolveState, clearInteractionForSketchChange,
    invalidateAnalysis: () => { constraintAnalysis.invalidate(); }, solveSketchAndDependents,
    activeSketchId, refreshConstraintAnalysis, updateUI, draw, recordHistory,
    confirmDeletion: (message) => window.confirm(message),
  });
  const { remove: deleteSketch } = sketchDeletionCommand;


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
    const item = category === "constraint" ? entry.point || entry.constraint : entry;
    if (canvasSelection.inspection?.targets.some((target) => target.category === category
      && (target.item === item || item?.id && target.item.id === item.id))) return true;
    if (category === "hatch") return canvasSelection.hatches.includes(entry);
    if (category === "image") return canvasSelection.referenceImages.includes(entry);
    if (category === "block") return canvasSelection.blockInstances.includes(entry);
    if (category === "instance") return canvasSelection.geometryInstances.includes(entry);
    if (category === "annotation") return canvasSelection.annotations.includes(entry);
    if (category === "constraint") return entry.kind === "fixed-point" ? canvasSelection.points.includes(entry.point) : constraintSelectedInCanvas(entry.constraint);
    return geometryItemSelectedInCanvas(entry);
  }

  function sketchTreeObjectHovered(category, entry) {
    if (category === "hatch") return canvasHover.current.hatch === entry;
    if (category === "image") return canvasHover.current.referenceImage === entry;
    if (category === "block") return canvasHover.current.block === entry;
    if (category === "instance") return canvasHover.current.geometryInstance === entry;
    if (category === "annotation") return canvasHover.current.annotation === entry;
    const item = category === "constraint" ? (entry.kind === "fixed-point" ? entry.point : entry.constraint) : entry;
    return selectionHighlight.current?.item === item;
  }

  const sketchTreeObjects = window.SketchTreeObjects.create({
    sidebarGeometryItem, activeSketchId,
    currentScope: () => model, getLanguage: () => applicationSettings.language,
    ensureAnalysis: constraintAnalysis.ensure, types: window.GeometrySolver,
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
    objects: sketchTreeObjects, selectedSketchId: () => canvasSelection.sketchId,
    moveState: () => sketchMoveCommand.state(),
    sketchHasSolveError, referenceConstraintErrorCountForSketch, constraintDuplicateCountForSketch,
    actions: { click: event => sketchTreeController.click(event), doubleClick: event => sketchTreeController.doubleClick(event),
      keyDown: event => sketchTreeController.keyDown(event), pointerOver: event => sketchTreeController.pointerOver(event), pointerOut: event => sketchTreeController.pointerOut(event),
      leave: () => sketchTreeController.leave(),
    },
  });
  const sketchTreeController = window.SketchTreeController.create({
    currentScope: () => model, activeSketchId, setActiveSketch, clearSelection, canvasSelection,
    sidebarGeometryItem, toggleBlockInstanceSelection, targetFromConstraint, updateUI, draw,
    sketchTreeView, updateSketchUI, toggleSketchVisibility, renameSketch, deleteSketch, deleteElements,
    hover: { canvasHover, setSidebarHover, clearSidebarHover, sidebarHoverElementsForItem, sidebarHoverElementsForConstraint, elementSketchId, ROOT_SKETCH_ID },
    resolveSelectionEntry: sketchTreeObjects.resolveSelectionEntry,
    move: { active: () => sketchMoveCommand.active, choose: sketchMoveCommand.choose, commit: sketchMoveCommand.commit, cancel: sketchMoveCommand.cancel },
    updateSelectionUI: updateGeometrySelectionUI,
    openContextMenu: (event, id) => {
      closeCanvasContextMenu();
      if (isRootSketch(sketchById(id))) { sketchContextController.close(); return; }
      sketchContextController.open({ event, target: { id }, items: [{ action: "sketch-edit", label: applicationText("編集", "Edit"), disabled: id === activeSketchId() }] });
    },
    unfixPoint: point => { point.fixed = false; solveAndRefresh(`固定解除 ${point.id}`); },
  });
  const { refreshSelection: updateSketchTreeSelectionState, render: updateSketchUIUnprofiled, applyWidth: applySketchTreeWidth } = sketchTreeView;
  sketchContextController = window.CanvasContextMenu.create({
    document, window, canvas: document.getElementById("sketchList"), menu: document.getElementById("sketchContextMenu"),
    escapeHtml, applicationText, ariaLabel: () => applicationText("スケッチメニュー", "Sketch menu"),
    onOpen: event => sketchTreeController.contextMenu(event),
    onAction: (_action, target) => sketchTreeController.editSketch(target.id),
  });
  sketchContextController.start();

  function isSidebarHighlightedElement(item) { return sketchTreeController.isHighlightedElement(item); }

  function updateSketchUI() {
    if (!interactionProfiler.active) return updateSketchUIUnprofiled();
    return profileInteractionWork("tree", updateSketchUIUnprofiled);
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
    if (input.matches('#propertiesPanel [data-property="constraint-expression"], #propertiesPanel [data-property="annotation-expression"]')) return { input, namespace: model };
    const parameterExpression = input.matches('[data-parameter-field="expression"], [data-dimension-field="expression"]');
    if (parameterExpression && input.closest("#parametersDialog") && parameterDraft.current) {
      return { input, namespace: parameterDraft.current.namespace };
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
    hatchAppearanceForDisplay, normalizeAnnotationStyle, effectiveDimensionAppearance,
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
    editing: appearanceEditing, viewport, normalizeHatchAppearance, normalizeAnnotationStyle,
    invalidateBlockProjectionCache, recordHistory, updateUI, updatePropertiesUI, draw,
  });
  const { owner: appearanceOwnerForPropertiesTarget } = appearancePropertyCommand;

  const { apply: applyMultipleProperty } = window.BulkPropertyCommand.create({
    guardSketchProjectionShapeEdit, applicationText, updatePropertiesUI, draw,
    multiplePropertySupports, applyDimensionAppearanceValue, applyAnnotationStyleValue, normalizeHatchAppearance, applyAppearanceInput,
    invalidateBlockProjectionCache, synchronizeSketchProjectionMetadata, recordHistory, updateUI,
  });
  const appearanceControls = window.AppearanceControls.create({
    applicationText, escapeHtml, formatDisplayNumber, normalizeAppearance, normalizeDimensionAppearance,
    dimensionLengthKeys: DIMENSION_APPEARANCE_LENGTH_KEYS, defaultDimensionAppearance: DEFAULT_DIMENSION_APPEARANCE,
  });
  const { defaultAppearanceLabel, colorPickerValue, appearancePropertyRows, dimensionAppearancePropertyRows, updateDimensionTerminatorAngleVisibility, prepareAffixInputs } = appearanceControls;
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
    HTMLTextAreaElement, HTMLInputElement, Spline, selectedPropertiesTarget, activeSketchId,
    elementPropertyCommand, appearancePropertyCommand, geometryPropertyCommand, applyMultipleProperty,
    changeFreeInstanceProperty, commitDimensionPropertyEdit, commitAnnotationParameterEdit, updateUI, updatePropertiesUI, draw,
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
    content: propertiesContent.render, prepareAffixInputs,
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





















  function updateStatusUI() {
    const command = document.getElementById("statusCommand");
    const modeLabels = {
      "free-instance-origin": applicationText("配置基準点", "Placement anchor"),
      "free-instance-place": applicationText("インスタンス配置", "Instance placement"),
      select: applicationText("選択", "Select"), point: applicationText("点", "Point"), line: applicationText("線", "Line"), centerline: applicationText("中心線", "Centerline"), "circle-center-cross": applicationText("円中心十字線", "Circle Center Cross"), rectangle: applicationText("矩形", "Rectangle"),
      slot: applicationText("長穴", "Slot"), circle: applicationText("円", "Circle"), arc: applicationText("円弧", "Arc"), "three-point-arc": applicationText("3点円弧", "Three-point Arc"), spline: applicationText("スプライン", "Spline"), fillet: applicationText("R面取り", "Fillet"), trim: applicationText("トリム", "Trim"),
      offset: applicationText("オフセット", "Offset"), hatch: applicationText("塗りつぶし", "Fill"), "hatch-repair": applicationText("境界を再指定", "Reselect boundary"), "block-place": applicationText("ブロック配置", "Block placement"),
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
    const propertiesPanel = document.getElementById("propertiesPanel");
    if (propertiesPanel) propertiesPanel.inert = sketchMoveCommand.active;
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
      if (type === "distance" && active.length === 0 && reference.length === cleanOperands.length) {
        const target = distanceTargetFromOperands(cleanOperands);
        if (!target || target.kind === "invalid") return target?.kind === "invalid" ? { error: target.reason } : null;
        return { type, action: "place-dimension", target, operands: cleanOperands, sketchId: activeSketchId(), readOnlyDimension: true };
      }
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
      readOnlyDimension: resolution.readOnlyDimension === true,
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
    if (constraint) {
      constraint.dimension = dimension;
      if (dimension && ["radius", "diameter"].includes(target.kind)) {
        constraint.dimension = { ...dimension, display: { ...dimension.display, prefix: target.kind === "diameter" ? "Φ" : "R" } };
      }
    }
    return constraint;
  }

  function readOnlyDimensionConstraintForPlacement(target, value, dimension, options = {}) {
    const constraint = distanceConstraintFromTarget(target, value, dimension, { silent: true });
    if (!constraint) return null;
    if (options.readOnlyDimension) return assignConstraintSketchId(constraint, options.sketchId || activeSketchId());
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

  const geometryDragSolver = window.GeometryDragSolver.create({
    solver, activeSketchId, sketchSolveVariables, sketchSolveConstraints, solveSketchById,
    viewScale: () => viewport.scale, arcEndpointPoint, acceptError: CONSTRAINT_ACCEPT_ERROR,
    previewMaxModelError: DRAG_PREVIEW_MAX_MODEL_ERROR,
  });
  const geometryDragPlan = window.GeometryDragPlan.create({
    elementSketchId, isEditableSketchId, activeSketchId, blockDefinitionById, blockLocalGeometryBounds,
    blockInstanceEnabledSketchSet, blockWorldPoint, pointLockedByLineFixed, findLineFixedConstraint,
    findArcEndpointFixedConstraint, arcEndpointPoint, arcEndpointDragValue, hypot2, minimumLength: MIN_ORIENTATION_LENGTH,
  });
  const buildDragSession = geometryDragPlan.build;
  const geometryDragEditing = window.GeometryDragEditing.create({
    currentScope: workspace.current, solver, plan: geometryDragPlan, dragSolver: geometryDragSolver,
    contextFromSeeds: localSolveContextFromSeeds, projectionConstraintsForItems: sketchProjectionConstraintsAffectingItems,
    pointLockedByLineFixed, captureValues: snapshotModelState,
    enforceMinimumLineLengths, normalizeArcSweeps, invalidateProjection: invalidateBlockProjectionCache,
    projectionBlockedMessage: () => sketchProjectionShapeEditBlockedMessage(applicationText("ドラッグ", "Drag")),
    previewMaxModelError: DRAG_PREVIEW_MAX_MODEL_ERROR,
  });
  const attachLocalSolveContext = geometryDragEditing.prepare;

  const geometryDrag = window.GeometryDrag.create({
    prepareSession: attachLocalSolveContext, dragResultForSession, solveFinalDragSession,
    currentScope: workspace.current, activeSketchId, viewScale: () => viewport.scale,
    beginPointer: (id) => { canvas.classList.add("is-dragging"); canvas.setPointerCapture(id); },
    endPointer: (id) => { canvas.classList.remove("is-dragging"); try { canvas.releasePointerCapture(id); } catch (_) {} },
    projectionBlockedMessage: () => sketchProjectionShapeEditBlockedMessage(applicationText("ドラッグ", "Drag")),
    canvasSelection, restoreModelState, restoreSolverState: (state) => solver.restore(state),
    solveReferenceDependentSketches, normalizeArcSweeps, clearSketchSolveState, invalidateBlockProjectionCache,
    stabilizeActiveParameterNamespace, refreshConstraintAnalysis, acceptError: CONSTRAINT_ACCEPT_ERROR,
    applicationText, setHint, updateUI, updateGeometrySelectionUI, draw, recordHistory,
  });

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
      const plan = { kind: "free-instance", mode: "block", item: instance, sketchId: instance.sketchId,
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
        Object.assign(plan, { kind: "derived-instance", mode: "derived-placement", anchor,
          startAnchor: { x: anchor.x, y: anchor.y } });
      }
      geometryDrag.begin(e, plan);
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
    const plan = buildDragSession(kind, dragItem, resolved.pointer);
    if (!plan) {
      geometryDrag.reset();
      setHint(applicationText("参照元が固定されているためドラッグできません", "The source is fixed and cannot be dragged."), "error");
      updateGeometrySelectionUI();
      draw();
      return;
    }
    plan.displayStartPointer = pointer;
    plan.pointerMap = resolved.mapPointer;
    plan.derivedInstance = hit.instance;
    plan.derivedSource = resolved.item;
    const placements = new Set();
    for (let node = hit.item; node?.derivedProjection; node = node.sourceElement) {
      if (node.derivedInstance?.type === "free") placements.add(node.derivedInstance);
    }
    if (placements.size) plan.variableAllowed = (v) => !placements.has(v.object);
    geometryDrag.begin(e, plan);
    setHint(applicationText(`${geometryDrag.label}中: 参照元へ反映しながら拘束をsolveしています`, `${geometryDrag.label}: solving constraints while updating the source`));
    updateUI({ refreshAnalysis: false });
    draw();
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

  function dragResultForSession(session, pointer) {
    if (!interactionProfiler.active) return geometryDragEditing.preview(session, pointer);
    return profileInteractionWork("solve", () => geometryDragEditing.preview(session, pointer));
  }

  function hasDirectRadiusDimension(primitive) {
    return window.DimensionQueries.hasDirectRadiusDimension(model.constraints, primitive);
  }

  const dimensionDrag = window.DimensionDrag.create({
    dimensionAnchor, migrateAngleDimensionLabelPlacement, canvasSelection, angleDimensionLabelOffsets,
    viewScale: () => viewport.scale, isDimensionConstraintCommandActive, setHint, clearSnap, hypot2,
    beginPointer: (id) => { canvas.classList.add("is-dragging"); canvas.setPointerCapture(id); },
    endPointer: (id) => { canvas.classList.remove("is-dragging"); try { canvas.releasePointerCapture(id); } catch (_) {} },
    angleDimensionFromLabelPoint, dimensionWithLabelAt, dimensionFromAnchor, setAngleDimensionLabelOffsets,
    syncAngleConstraintFromDimension, draw, updateUI, updateGeometrySelectionUI, syncDimensionValueInput, recordHistory,
    continueCommandClick: (event, hits) => {
      canvasHover.update({ dimension: null });
      const pointer = canvasPoint(event);
      if (pendingCommand?.type === "distance-place") {
        if (!retargetDistancePlaceWithOperand(pointer, hits)) startDistanceValueInput(pointer);
      } else if (pendingConstraintCommand?.type === "distance") {
        handleConstraintOperandClick(pointer, "distance", hits);
      }
    },
  });
  const { begin: beginDimensionDrag } = dimensionDrag;

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


  function beginBlockDrag(e, instance, pointer, rotate = false) {
    clearSelection();
    canvasSelection.set("blockInstances", [instance]);
    const plan = buildDragSession(rotate ? "block-rotation" : "block", instance, pointer);
    if (!geometryDrag.begin(e, plan)) {
      setHint(rotate && instance.rotationLocked ? "回転がロックされたブロックインスタンスです" : "固定されたブロックインスタンスです", "error");
      draw();
      return;
    }
    setHint(rotate ? "ブロックを回転中" : "ブロックを移動中");
    updateUI({ refreshAnalysis: false });
    draw();
  }



  function executeTrimAt(pointer) {
    const preview = computeTrimPreview(pointer);
    if (!preview) {
      setHint("トリムできる交点がありません", "error");
      draw();
      return false;
    }
    if (!guardSketchProjectionShapeEdit([preview.item], { action: applicationText("トリム", "Trim") })) {
      drawingPreview.setTrim(null);
      draw();
      return false;
    }
    const snapshot = snapshotGeometryMutationState();
    if (preview.kind === "line") executeLineTrim(preview);
    else if (preview.kind === "arc") executeArcTrim(preview);
    else executeCircleTrim(preview);
    drawingPreview.setTrim(null);
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
    constraintAnalysis.invalidate();
    refreshConstraintAnalysis();
    setHint(applicationText("トリムしました", "Trim completed"));
    updateUI({ refreshAnalysis: false });
    draw();
    recordHistory("トリム");
    return true;
  }

  const { candidatesAt: canvasContextCandidatesAt } = window.CanvasContextQuery.create({
    hitReferenceImageAt, isVisibleValue,
    currentScope: workspace.current, viewportScale: () => viewport.scale,
    canvasContextPointIsSelectable, editedFitPoints: () => splineEditSession?.spline?.fitPoints,
    sketches: { isEditableSketchId, isVisibleSketchId, isEditableSketchElement, isVisibleSketchElement, activeSketchId, isActiveSketchConstraint, constraintSketchId },
    projections: { blockProjectionBundle, geometryInstanceBundle },
    dimensions: { targetFromConstraint, defaultDimensionForTarget, effectiveDimensionAppearance, dimensionLayout },
    annotations: { canvasContextAnnotationHit }, hatches: { resolvedHatchBoundary, hatchAppearanceForDisplay, hatchContainsSelectablePoint },
  });

  function canvasContextPointIsSelectable(point) {
    return isExplicitPoint(point) || isSelectableEndpointPoint(point);
  }

  const canvasContextCandidatePresentation = window.CanvasContextPresentation.create({
    toolbarSvgMarkup, applicationText, formatDisplayNumber, constraintToolbarIcon, localizedConstraintName,
    blockDefinitionById, geometryInstanceTypeLabel, hatchPatternTypeLabel, hatchAppearanceForDisplay,
  });




  function previewCanvasContextCandidate(target) {
    canvasHover.previewCandidate(target);
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
    if (target.kind === "image") return canvasSelection.referenceImages.includes(target.item);
    if (target.kind === "dimension") return canvasSelection.constraintSelectedInCanvas(target.item);
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
    else if (target.kind === "image") canvasSelection.set("referenceImages", [target.item]);
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
      drawingPreview.setPointer(null);
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
      if (["point", "line", "circle", "arc", "spline", "block", "hatch", "annotation", "image"].includes(target.kind)) {
        specific.push({ action: "sketch-move", label: applicationText("別スケッチへ移動…", "Move to Another Sketch…"), disabled: mode !== "select" || Boolean(pendingCommand || pendingConstraintCommand) });
      }
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





  function selectCanvasContextCandidate(target, pointer) {
    const commandType = pendingConstraintCommand?.type;
    if (commandType) {
      handleConstraintOperandClick(pointer || { x: 0, y: 0 }, commandType, constraintHitsFromCanvasContextTarget(target));
      return;
    }
    selectCanvasContextTarget(target, { preserveSelectedSet: false });
    updateUI({ refreshAnalysis: false });
    draw();
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
    canvasContextController.open({ event, pointer, target, candidates, showCandidates, items: showCandidates ? [] : canvasContextMenuItems(target, commandActive) });
  }

  function showSelectedObjectProperties() {
    setPropertiesPanelCollapsed(false);
    updatePropertiesUI();
    const panel = document.getElementById("propertiesPanel");
    if (panel) panel.scrollTop = 0;
    setHint(applicationText("選択したオブジェクトのプロパティを表示します。", "Select an object to display its properties."));
  }

  function executeCanvasContextAction(action, target, pointer) {
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
    else if (action === "sketch-move") sketchMoveCommand.start();
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

  canvasContextController.start();

  const annotationCommandInput = window.AnnotationCommandInput.create({
    getMode: () => mode, getPending: () => pendingCommand, getPendingConstraint: () => pendingConstraintCommand,
    annotationCommand, canvasSelection, clearSelection, annotationDrag, updateUI, draw,
  });
  const constraintCommandInput = window.ConstraintCommandInput.create({
    getPending: () => pendingCommand, getPendingConstraint: () => pendingConstraintCommand, canvasSelection, canvasHover, isDimensionConstraintCommandActive,
    beginDimensionDrag, retargetDistancePlaceWithOperand, startDistanceValueInput, constraintTargetHint,
    handleConstraintOperandClick, setHint, updateGeometrySelectionUI, draw,
  });

  const instanceCommandInput = window.InstanceCommandInput.create({
    getMode: () => mode, instanceSourceCommand, geometryInstanceCommand, hitReferenceTarget, hitDerivedProjectionOperand,
    hitBlockProjectionOperand, operandElement, toggleSketchProjectionSource, clearSnap, selectionRectangle,
    capturePointer: id => canvas.setPointerCapture(id), snapForDrawing, makeConstraintOperand, setHint, applicationText,
    releasePanelFocus: () => { if (document.activeElement?.closest("#commandPanel")) document.activeElement.blur(); },
  });

  const pointCommand = window.PointCommand.create({
    transientAuthoring, snapForDrawing, drawingSnap, addPoint, addPointSnapConstraints, clearSnap, canvasSelection, solveAndRefresh,
  });
  const drawingCommandInput = window.DrawingCommandInput.create({
    getMode: () => mode, rejectRootSketchCreation, pointCommand, handleLineClick, handleCenterlineClick,
    handleCircleCenterCrossClick, handleRectangleClick, handleSlotClick, handleFilletClick, handleCircleClick,
    handleArcClick, handleThreePointArcClick, handleSplineClick, executeTrimAt, offsetCommand,
  });

  const canvasSelectionInteraction = window.CanvasSelectionInteraction.create({
    canvasSelection, clearSelection, sameArcEndpoint, topmostDrawingOrderOwner, drawingOrderOwner,
    beginDerivedGeometryDrag, beginBlockDrag, beginDimensionDrag, beginReferenceImageDrag,
    buildDragSession, geometryDrag, selectionRectangle,
    capturePointer: id => canvas.setPointerCapture(id), setHint, applicationText, updateGeometrySelectionUI, draw,
  });

  const canvasPressQuery = window.CanvasPressQuery.create({
    geometry: { hitPoint, hitLine, hitCircle, hitArcEndpoint, hitArc, hitSpline },
    scene: { hitHatchAt, hitReferenceImageAt, hitDimension, hitBlockRotationHandle, hitBlockInstance,
      hitDerivedGeometryForDrag, hitGeometryInstance, hitSketchIdentityElement, hitAnnotationElement, hitAnnotationTarget },
  });
  canvas.addEventListener("pointerdown", (e) => {
    flushScheduledCanvasPointerMove();
    pointerInteractionController.down(e);
  });

  const pointerHover = window.PointerHover.create({
    canvasHover, sameArcEndpoint, isActiveSketchConstraint,
    geometry: { hitEndpointPoint, hitExplicitPoint, hitLine, hitCircle, hitArcEndpoint, hitArc, hitSpline },
    scene: { hitDimension, hitDerivedProjectionOperand, hitBlockProjectionOperand, hitReferenceTarget, hitSketchIdentityElement,
      hitBlockInstance, hitGeometryInstance, hitAnnotationElement, hitHatchAt, hitReferenceImageAt },
  });

  const pointerInteractionController = window.PointerInteractionController.create({
    canvasNavigation, drawingPreview, canvasHover, clearSnap, draw, transientAuthoring, recordHistory,
    selectionRectangle, annotationDrag, referenceImageInteraction, dimensionDrag, geometryDrag, pointerHover,
    getMode: () => mode, getPendingCommand: () => pendingCommand,
    getPendingConstraintCommand: () => pendingConstraintCommand, setLastPointer: point => { lastPointerWorld = point; },
    updateHatchPreview, updateFilletRadiusPlacement, updatePendingDistanceRetargetHover, hitDimension, hitSketchIdentityElement,
    press: { discardMove: () => flushScheduledCanvasPointerMove({ discard: true }),
      activation: { selection: canvasSelection, finalizeSpline: finalizeSplineFromDoubleClick, submitOffset: submitOffsetValue,
        startDimensionEdit: startDimensionEditInput, startDistanceValue: startDistanceValueInput, submitDistance: submitDistanceValue,
        constraintDoubleClick: handleConstraintTargetDoubleClick, enterBlock: enterBlockDefinitionEdit, beginSplineEdit: beginSplineEditFromDoubleClick },
      query: canvasPressQuery, worldPoint: canvasPoint, screenPoint: canvasScreenPoint,
      closeContextMenu: closeCanvasContextMenu, insertDimensionParameter: insertClickedDimensionParameter,
      commitHatch: commitHatchAt, calibrateImage: handleReferenceImageCalibrationClick,
      placeFilletRadius: submitFilletRadiusPlacement, placeBlock: handleBlockPlacementClick, blankGesture: blankCanvasGesture,
      inputs: { instance: instanceCommandInput, annotation: annotationCommandInput, constraint: constraintCommandInput,
        drawing: drawingCommandInput, selection: canvasSelectionInteraction } },
  });

  function processCanvasPointerMove(e) {
    const screenPoint = { x: e.offsetX, y: e.offsetY };
    const coordinatePoint = screenToWorld(screenPoint);
    const coordinateStatus = document.getElementById("statusCoordinates");
    const coordinateText = `X ${formatDisplayNumber(coordinatePoint.x, 3)} / Y ${formatDisplayNumber(coordinatePoint.y, 3)}`;
    if (coordinateStatus && coordinateStatus.textContent !== coordinateText) coordinateStatus.textContent = coordinateText;
    pointerInteractionController.move(screenPoint, coordinatePoint, e.shiftKey);
  }

  canvas.addEventListener("pointermove", scheduleCanvasPointerMove);

  function endDrag(e) {
    flushScheduledCanvasPointerMove();
    return profileInteractionPhase("commit", () => pointerInteractionController.finish(e));
  }

  function isDrawToolMode() {
    return mode === "instance-sources" || mode === "line" || mode === "centerline" || mode === "circle-center-cross" || mode === "point" || mode === "rectangle" || mode === "slot" || mode === "fillet" || mode === "trim" || mode === "offset" || mode === "circle" || mode === "arc" || mode === "three-point-arc" || mode === "spline" || mode === "sketch-projection" || mode === "hatch" || mode === "hatch-repair";
  }

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", () => pointerInteractionController.leave());
  canvas.addEventListener("dblclick", (e) => {
    flushScheduledCanvasPointerMove();
    pointerInteractionController.doubleClick(e);
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
    if (e.key === "Escape" && sketchContextController.close()) { e.preventDefault(); return; }
    if (sketchMoveCommand.active) {
      if (e.key === "Escape") sketchMoveCommand.cancel();
      else if (e.target.closest?.("#sketchList") && !e.ctrlKey && !e.metaKey && ["Tab", "Enter", " ", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault(); return;
    }
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

    if (!textEditingTarget && (["mirror-axis", "pattern-direction"].includes(mode) || mode.startsWith("free-instance-")) && e.key === "Enter") {
      e.preventDefault();
      geometryInstanceCommand.finish();
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
        canvasHover.update({
          point: null, line: null, circle: null,
          arc: null, spline: null, sketchIdentity: null,
        });
        updateToolbar();
        setHint(applicationText("スケッチ投影をキャンセルしました", "Sketch projection was canceled."));
        updateUI({ refreshAnalysis: false });
        draw();
        return;
      }
      if (referenceImageInteraction.calibrating) {
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
          drawingPreview.setPointer(null);
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
      if (hasSelection()) {
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
  document.getElementById("selectionVisibilityBtn")?.addEventListener("click", () => {
    if (!isGeometryMode()) return;
    const targets = selectedVisibilityTargets();
    if (targets.length === 0) return;
    const visible = selectionVisibilityIsHidden(targets);
    const ordinaryTargets = targets.filter(target => target.kind !== "geometryInstance");
    if (ordinaryTargets.length) applyMultipleProperty({ kind: "multiple", items: ordinaryTargets }, "visible", visible, { commit: false });
    for (const target of targets.filter(target => target.kind === "geometryInstance")) {
      appearancePropertyCommand.apply(target, { category: "appearance", key: "visible", value: String(visible) }, { commit: false });
    }
    recordHistory("選択図形の表示切替");
    updateUI();
    draw();
  });
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
  document.getElementById("viewShowHiddenElementsInput")?.addEventListener("change", (event) => {
    viewState.showHiddenElements = event.target.checked;
    draw();
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
  toolFlyouts = window.ToolFlyouts.create({ document, window, onOpen: closeAppMenus });
  toolFlyouts.start();
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
      prepareAffixInputs(dimensionFields);
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
    drawingPreview.setPointer(null);
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
    drawingPreview.setPointer(null);
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
    drawingPreview.setPointer(null);
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
    drawingPreview.setPointer(null);
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
    drawingPreview.setPointer(null);
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
    drawingPreview.setPointer(null);
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
    drawingPreview.setPointer(null);
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
    drawingPreview.reset();
    offsetSelection.reset();
    canvasHover.update({
      point: null, endpointPoint: null, line: null,
      circle: null, arcEndpoint: null, arc: null,
      dimension: null,
    });
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
    drawingPreview.reset();
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
    drawingPreview.setPointer(null);
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
    drawingPreview.setPointer(null);
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
    drawingPreview.setPointer(null);
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
        return pointerMoveScheduler.resetStats();
      },
      interactionFrameStatsForTest() {
        return pointerMoveScheduler.stats();
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
        const before = hatchGeometryQuery.hatchFaceAt(seed);
        points[1].x = 180;
        points[2].x = 180;
        const after = hatchGeometryQuery.hatchFaceAt(seed);
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
          preview: hatchCommand.preview ? { ok: Boolean(hatchCommand.preview.result?.ok), code: hatchCommand.preview.result?.code || null } : null,
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
          calibrationPointCount: referenceImageInteraction.calibrationPointCount,
          dragging: referenceImageInteraction.dragging,
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
            size: appearance.terminatorSize * DIMENSION_SCREEN_PX_PER_MM * window.Appearance.annotationDisplayFactor(appearance, viewport.scale),
            openingAngle: appearance.terminatorType === "dot" ? null : Math.atan2(arrowHalfWidth, arrowLength) * 360 / Math.PI,
          },
          lineWidth: dimensionStrokeWidth(appearance) * window.Appearance.annotationDisplayFactor(appearance, viewport.scale),
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
        const previousHoveredDimension = canvasHover.current.dimension;
        const originalStroke = ctx.stroke;
        canvasSelection.set("dimensionConstraint", null);
        canvasSelection.set("constraint", null);
        canvasHover.update({ dimension: null });
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
          canvasHover.update({ dimension: previousHoveredDimension });
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
        const hover = canvasHover.current.point || canvasHover.current.endpointPoint || canvasHover.current.line || canvasHover.current.circle || canvasHover.current.arc || canvasHover.current.spline || canvasHover.current.dimension || canvasHover.current.block || canvasHover.current.annotation || canvasHover.current.hatch;
        return {
          menuOpen: Boolean(canvasContextMenu && !canvasContextMenu.hidden),
          candidates: canvasContextController.candidates().map((target) => {
            const presentation = canvasContextCandidatePresentation(target);
            return { kind: target.kind, id: presentation.id, type: presentation.type, secondary: presentation.secondary };
          }),
          hovered: hover?.id || hover?.parameterName || null,
          hoveredArcEndpoint: canvasHover.current.arcEndpoint ? { id: canvasHover.current.arcEndpoint.arc.id, endpoint: canvasHover.current.arcEndpoint.endpoint } : null,
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
      sketchMoveStateForTest() {
        const state = sketchMoveCommand.state();
        return {
          active: Boolean(state), targetId: state?.targetId || null, activeSketchId: activeSketchId(),
          selected: Object.fromEntries(window.SketchMove.fields.map(field => [field, canvasSelection[field].map(item => item.id)])),
          ownership: Object.fromEntries(window.SketchMove.fields.map(field => [field, model[field].map(item => ({ id: item.id, sketchId: item.sketchId, drawingOrder: item.drawingOrder }))])),
          constraints: model.constraints.map(constraint => decorateSerializedConstraint(serializeConstraint(constraint), constraint)),
          serialized: serializeModel(), editingBlock: Boolean(blockEditor.current),
        };
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
        for (const field of ["hatches", "annotations", "referenceImages"]) canvasSelection.set(field, model[field].filter(item => (ids[field] || []).includes(item.id)));
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
        const canvasHovered = canvasHover.current.line === item || canvasHover.current.circle === item || canvasHover.current.arc === item || canvasHover.current.spline === item || canvasHover.current.point === item || canvasHover.current.endpointPoint === item;
        const blockHovered = Boolean(item.blockInstance && canvasHover.current.block === item.blockInstance);
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
          targetConstraintCount: geometryDragSolver.targetConstraintCount(session),
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
          screenTerminatorSize: style.terminatorSize * ANNOTATION_SCREEN_PX_PER_MM * window.Appearance.annotationDisplayFactor(style, viewport.scale),
          displayedText: window.AnnotationRenderer.displayText(annotation, formatDisplayNumber),
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
            displayedText: window.AnnotationRenderer.displayText(annotation, formatDisplayNumber),
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
        return annotationDrag.inspect();
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
          drawingPreview.reset();
          selectionRectangle.reset();
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
          drawingPreview.setPointer({ x: 80, y: 0 });
        }, drawTemporaryLine);
        capture("rectangle", () => {
          mode = "rectangle";
          rectangleCommand.click({ x: 0, y: 0 }, null);
          drawingPreview.setPointer({ x: 80, y: 45 });
        }, drawRectanglePreview);
        capture("slot", () => {
          mode = "slot";
          slotCommand.click({ x: 0, y: 0 }, null);
          slotCommand.click({ x: 80, y: 0 }, null);
          drawingPreview.setPointer({ x: 40, y: 20 });
        }, drawSlotPreview);
        capture("circle", () => {
          mode = "circle";
          circularCommands.clickCircle({ x: 0, y: 0 }, null);
          Object.assign(circularCommands.circleCenterPoint, { fixed: true, kind: "center" });
          drawingPreview.setPointer({ x: 35, y: 0 });
        }, drawCirclePreview);
        capture("arc", () => {
          mode = "arc";
          circularCommands.clickArc({ x: 0, y: 0 }, null);
          Object.assign(circularCommands.arcCenterPoint, { fixed: true, kind: "center" });
          circularCommands.clickArc({ x: 35, y: 0 }, null);
          drawingPreview.setPointer({ x: 0, y: 35 });
        }, drawArcPreview);
        capture("offset", () => {
          mode = "offset";
          offsetSelection.selectSource(addLine(addPoint(0, 0, true, "endpoint"), addPoint(80, 0, true, "endpoint")));
          drawingPreview.setPointer({ x: 40, y: 20 });
        }, drawOffsetPreview);
        capture("trim", () => {
          mode = "trim";
          drawingPreview.setTrim({
            kind: "line",
            interval: {
              left: { point: { x: 0, y: 0 } },
              right: { point: { x: 80, y: 0 } },
            },
          });
        }, drawTrimPreview);
        capture("selection", () => {
          selectionRectangle.begin({ x: 0, y: 0 }, { current: { x: 80, y: 45 } });
        }, drawSelectionRect);
        capture("blockPlacement", () => {
          const definition = makeBlockDefinition();
          mode = "block-place";
          blockPlacementCommand.prepare(definition.id, [DEFAULT_SKETCH_ID]);
          drawingPreview.setPointer({ x: 120, y: 40 });
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
        const preview = offsetSelection.source && drawingPreview.pointer ? offsetDistanceFromPointer(offsetSelection.source, drawingPreview.pointer) : null;
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
        return canvasHover.current.sketchIdentity ? {
          kind: canvasHover.current.sketchIdentity.kind || null,
          id: canvasHover.current.sketchIdentity.id,
          sketchId: canvasHover.current.sketchIdentity.sketchId,
          relation: sketchIdentityRelationLabel(canvasHover.current.sketchIdentity.sketchId),
          hoveredDimension: canvasHover.current.dimension ? canvasHover.current.dimension.name || "寸法" : null,
          hoveredBlock: canvasHover.current.block?.id || null,
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
          canvasHover.update({ line: line });
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
          canvasHover.update({ block: instance });
        });
        canvasHover.update({
          line: null, block: null,
        });
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
          invalid: referenceConstraintState.errorReasons(),
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
          summary: constraintAnalysis.summary(),
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
          dragging: dimensionDrag.active,
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
          blockInstanceId: canvasHover.current.block?.id || null,
          pointId: canvasHover.current.point?.id || null,
          pointIsBlockProjection: Boolean(canvasHover.current.point?.blockProjection),
          lineId: canvasHover.current.line?.id || null,
          arcEndpointId: canvasHover.current.arcEndpoint ? `${canvasHover.current.arcEndpoint.arc.id}.${canvasHover.current.arcEndpoint.endpoint}` : null,
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
      multipleDimensionSelectionForTest() {
        return { dimensions: canvasSelection.dimensionConstraints.map(c => model.constraints.indexOf(c)), lines: canvasSelection.lines.map(l => l.id), single: Boolean(canvasSelection.dimensionConstraint) };
      },
      fitForMultipleDimensionsForTest() {
        viewport.update({ scale: 2, x: 350, y: 250 });
        updateUI();
        draw();
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
        if (canvasHover.current.dimension) {
          for (const item of constraintHighlightNodes(canvasHover.current.dimension)) {
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

  derivedPanel = window.DerivedCommandPanel.create({
    getMode: () => mode, projectionSources: () => sketchProjectionSources,
    geometryCommand: geometryInstanceCommand, sourceCommand: instanceSourceCommand,
    resolveGeometryRef, sketchName, activeSketchId, elementSketchId, geometryRefForItem, applicationText,
    finishProjection: commitSketchProjectionCommand,
    removeProjectionSource: index => {
      if (mode !== "sketch-projection" || index < 0 || index >= sketchProjectionSources.length) return;
      sketchProjectionSources.splice(index, 1);
      draw();
    },
    cancel: () => {
      if (mode === "instance-sources") return finishInstanceSourceEdit(false);
      exitDrawMode();
      updateUI({ refreshAnalysis: false });
      setHint(applicationText("コマンドをキャンセルしました", "Command canceled."));
      draw();
    },
    changeFreeProperty: changeFreeInstanceProperty,
    refresh: () => { updatePropertiesUI(); draw(); },
  });
  commandPanel = window.CommandPanel.create({ document, host: canvas.parentElement, ...derivedPanel });

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
