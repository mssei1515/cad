/* Application composition, editing commands, Canvas UI and event handling. */
(function () {
  "use strict";
  const { validReferenceImageDataUrl, serializeReferenceImage } = window.ReferenceImageData;
  const { pointInExpandedBox, rectFromPoints, pointInRect, bboxInRect, bboxIntersectsRect, lineBBox, primitiveBBox, mergeBounds, splineBBox } = window.GeometryBounds;
  const { referenceImageLocalToWorld, referenceImageWorldToLocal, referenceImageCorners, referenceImageBounds } = window.ReferenceImageGeometry;
  const { validSerializedHatch, validSerializedHatchList, serializeHatch } = window.HatchData;
  const { serializeAnnotation } = window.AnnotationData;

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
    DEFAULT_DOCUMENT_NAME,
    sanitizeDocumentNameValue, fileNameStem,
    effectiveDocumentNameFromValue, documentContentSignature,
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
  let pngRender = null;
  let pngExportCommand = null;
  let pngPreviousMode = null;
  const dimensionValueInput = document.getElementById("dimensionValueInput");
  const dimensionValueInputShell = document.getElementById("dimensionValueInputShell");
  const canvasContextMenu = document.getElementById("canvasContextMenu");
  const sketchOverlay = document.getElementById("sketchOverlay");
  const sketchOverlayResizeHandle = document.getElementById("sketchOverlayResizeHandle");
  const applicationSettings = window.ApplicationSettings.create({
    document, storage: () => localStorage,
    refreshViews: (options) => updateUI(options),
    redrawCanvas: () => draw(), refreshVersion: () => runtimeVersionView.render(),
  });
  const { applicationText, translatedExactText, translatedHintText, localizeApplicationUI,
    setApplicationLanguage, setApplicationTheme } = applicationSettings;
  const { ROOT_SKETCH_ID, DEFAULT_SKETCH_ID } = window.SketchHierarchy;
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
    elementSketchId, sameSketchElements, isEditableSketchId, canEditSketch,
    sketchRelationToActive, constraintSketchId, isActiveSketchConstraint,
    constraintTargetsAreActive, constraintReferencesSketch, wouldCreateSketchCycle,
    sketchTreeRows, isActiveSketchElement, isEditableSketchElement,
    sketchRelationOfElement,
  } = window.SketchContext.create({ currentScope: workspace.current, constraintGraphNodes });
  const { geometryKindForItem, geometryRefForItem, addGeometryBundleToMaps } = window.GeometryObjects;
  const instanceProjections = window.InstanceProjection.create({ elementSketchId, applicationText,
    resolveHatch: (hatch, elements) => resolvedHatchBoundary(hatch, elements),
  });
  const { emptyGeometryInstanceBundle, geometryInstanceSourcePoints, createGeometryInstanceBundle, geometryInstanceBundlesForScope } = instanceProjections;
  const blockCatalog = window.BlockCatalog.create({ definitions: () => documentModel.blockDefinitions });
  const { blockDefinitionOwnedSubtreeIds, blockDefinitionSketchRows, blockDefinitionById, blockDefinitionDrawableSketchIds, blockDefinitionHasGeometry, blockDefinitionGeometrySketchIds, blockInstanceEnabledSketchSet } = blockCatalog;
  const hatchGeometryQuery = window.HatchGeometryQuery.create({
    currentScope: workspace.current, activeSketchId, effectiveAppearanceForElement, applicationText,
    boundaryGeometry: () => [...allGeometryLines(), ...allGeometryCircles(), ...allGeometryArcs(), ...allGeometrySplines()],
    defaultLineWidth: () => Number(documentModel.defaultAppearance?.lineWidth) || DEFAULT_APPEARANCE.lineWidth, viewportScale: () => viewport.scale,
  });
  const { hatchPrimitivesFromElements, hatchPrimitivesForScope, resolvedHatchBoundary, hatchBoundaryGeometryItems, hatchBoundaryHitExclusionScreenPx, hatchContainsSelectablePoint } = hatchGeometryQuery;
  const blockProjections = window.BlockProjection.create({
    blockCatalog, geometryInstanceBundlesForScope, emptyGeometryInstanceBundle, hatchPrimitivesFromElements, hatchPrimitivesForScope,
  });
  const { blockProjectionId, blockProjectionLocalId, blockWorldPoint, createBlockProjectionBundle, blockAllProjectionBundle, blockProjectionBundle, invalidateBlockProjectionCache } = blockProjections;
  const { annotationBounds, pointInAnnotationTextBox, hitAnnotationElement: queryAnnotationElement, canvasContextAnnotationHit } = window.AnnotationSpatialQuery.create({
    viewportScale: () => viewport.scale, annotationTextWorldHeight: style => annotationTextWorldHeight(style),
    formatDisplayNumber, annotationTextLayout: element => annotationTextLayout(element), annotationLeaderDisplayGeometry: element => annotationLeaderDisplayGeometry(element), effectiveAnnotationStyle, allAnnotations: () => allAnnotations(), isVisibleSketchId, activeSketchId, isVisibleValue,
    annotationLeaderAnchor: element => annotationLeaderAnchor(element),
    isFrameInteractive: element => canvasSelection.annotations.includes(element) && isEditableSketchElement(element),
    resizeHandlesEnabled: element => annotationDrag.resizeEnabled(element),
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
    selectedElementCount, selectedGeometryItems, appearanceSelectionTarget, setGeometrySelection,
    hasPrimaryCanvasSelection, effectiveSelectedConstraint, selectedPrimitives,
    togglePointSelection, toggleLineSelection, toggleCircleSelection, toggleArcSelection,
    toggleSplineSelection, toggleBlockInstanceSelection, selectedConstructionTogglePrimitives,
    trimConstraintSelection, geometryItemSelectedInCanvas,
    constraintSelectedInCanvas, hasSelection,
  } = canvasSelection;
  const { isPointUsedByLine, isAnyLineEndpoint, isPointUsedByCircle, isPointUsedByArc, isPointUsedBySpline, isSplineOnlyFitPoint, isEditableSplineFitPoint, isPointUsedByPrimitive, isEndpointPoint, isExplicitPoint, isReferencePoint, isPrimitiveCenterPoint, isStandalonePoint, isSelectableEndpointPoint } = window.PointUsage.create({
    currentScope: workspace.current, constraintReferencesPoint,
    allGeometryLines: () => allGeometryLines(), allGeometryCircles: () => allGeometryCircles(),
    allGeometryArcs: () => allGeometryArcs(), allGeometrySplines: () => allGeometrySplines(),
    editedFitPoints: () => splineEditing.current?.spline?.fitPoints,
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
  const geometryAppearance = window.GeometryAppearanceQuery.create({
    document: documentModel, readAppearance: geometryReads.readAppearance, cacheAppearance: geometryReads.cacheAppearance,
    sketchById, elementSketchId, isRootSketch, activeSketchId, showHiddenElements: () => viewState.showHiddenElements,
  });
  const { hitAnnotationTarget, annotationLeaderTargetFromSelection, annotationLeaderTargetFromHit, annotationLeaderTargetFromItem, annotationLeaderAnchor } = window.AnnotationAnchorQuery.create({
    isReferenceSourceSketchId,
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
    getMode: () => mode, getPending: () => pendingCommandSession.current, getPendingConstraint: () => constraintTargetSession.command,
    getSplineEditSession: () => splineEditing.current, getLineCommand: () => lineCommand, getTransientAuthoring: () => transientAuthoring,
    getTime: () => performance.now(), hypot2, clearPreview: () => drawingPreview.setPointer(null),
    finalizeSplineFromDoubleClick: (...args) => finalizeSplineFromDoubleClick(...args),
    finishSplineEditSession: (...args) => finishSplineEditSession(...args),
    submitDistanceValue: (...args) => submitDistanceValue(...args),
    submitOffsetValue: (...args) => submitOffsetValue(...args),
    submitAnnotationValue: () => annotationInputController.finish(),
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
  const sketchProjectionCommand = window.SketchProjectionCommand.create({
    selectedGeometryItems, sketchProjectionEntryFromItem, sketchProjectionEntryFromOperand, sketchProjectionSourceIsCovered, sketchProjectionEntriesByRect,
    cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation,
    clearSelection, getMode: () => mode, setMode: value => { mode = value; }, clearSnap: () => clearSnap(),
    updateToolbar, setHint, applicationText, updateUI, draw, activeSketchId, normalizeGeometryInstance,
    nextId: () => `SPI${sketchProjectionInstanceSeq++}`, geometryRefForItem, currentScope: () => model,
    canvasSelection, refreshConstraintAnalysis, recordHistory,
    clearHover: () => canvasHover.update({ point: null, line: null, circle: null, arc: null, spline: null, sketchIdentity: null }),
  });
  const { start: startSketchProjectionCommand, toggle: toggleSketchProjectionSource,
    addByRect: addSketchProjectionSourcesByRect, commit: commitSketchProjectionCommand } = sketchProjectionCommand;
  const drawingPreview = window.DrawingPreview.create({ types: { Point, Line, Circle, Arc }, canvasHover,
    canCreateInActiveSketch, clearSnap: () => clearSnap(), snapForDrawing, draw,
    linePreviewPoint: (point, shiftKey) => lineCommand.previewPoint(point, shiftKey),
    readCenterline: () => centerlineCommand, projectPointToCenterlineSupport: point => projectPointToCenterlineSupport(point),
    readOffsetSelection: () => offsetSelection, computeTrimPreview,
    hits: { hitPoint: (x, y) => hitPoint(x, y), hitLine: (x, y) => hitLine(x, y),
      hitCircle: (x, y) => hitCircle(x, y), hitArc: (x, y) => hitArc(x, y) },
  });

  const pendingCommandSession = window.PendingCommandSession.create({
    clearPlacement: () => geometryInstanceCommand.clearPlacement(), cancelAnnotation: () => annotationCommand.cancel(),
    cancelPngExport: () => pngExportCommand.cancel(), resetOffset: () => offsetSelection.reset(),
    clearPreviewPointer: () => drawingPreview.setPointer(null), hideInput: () => hideDimensionValueInput(),
    setHint, updateToolbar, updateConstraintButtons, draw,
  });
  const constraintTargetSession = window.ConstraintTargetSession.create({
    acceptTarget: (...args) => constraintOperandValues.appendTarget(...args),
  });
  let lastPointerWorld = null;
  const constructionCommand = window.ConstructionCommand.create({
    cancelConstraintTargetCommand, selectedConstructionTogglePrimitives, guardSketchProjectionShapeEdit, applicationText,
    synchronizeSketchProjectionMetadata: () => synchronizeSketchProjectionMetadata(), setHint, clearSelection, updateUI, draw, recordHistory,
    setLineMode: () => { mode = "line"; }, resetLineInputs: () => drawOperationLifecycle.resetInputs("line"),
    clearSnap: () => clearSnap(), updateToolbar,
  });
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

  const canvasRenderProbe = window.CanvasRenderProbe.create({
    ctx, allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs,
    drawLines, drawCircles, drawArcs, drawPoints, drawArcEndpointHandles, drawDimensions,
  });
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
  const CURRENT_JSON_VERSION = 25;
  const CLIPBOARD_PASTE_OFFSET_SCREEN_PX = 24;
  const BLOCK_ORTHOGONAL_ROTATION_STEP = Math.PI / 2;


  const pointerMoveScheduler = window.PointerMoveScheduler.create({
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (frame) => cancelAnimationFrame(frame),
    processMove: (pointer) => profileInteractionPhase("preview", () => {
      withGeometryReadCache(() => canvasInputBinding.processMove(pointer));
      if (pendingCommandSession.current && ["distance-value", "offset-value"].includes(pendingCommandSession.current.type)) syncDimensionValueInput();
    }),
  });
  const { flush: flushScheduledCanvasPointerMove } = pointerMoveScheduler;
  let toolFlyouts = null;
  const viewState = { constraintStatus: false, geometryIds: false, showHiddenElements: false };
  const constraintStatusView = window.ConstraintStatusView.create({
    viewState, button: document.getElementById("constraintStatusViewBtn"),
    menuInput: document.getElementById("viewConstraintStatusInput"), setHint, draw,
  });
  const MIN_ZOOM = CSS_PX_PER_MM * 0.001;
  const MAX_ZOOM = CSS_PX_PER_MM * 10000000;

  const CONSTRUCTION_EXTENSION_SCREEN_PX = 12;
  const CENTERLINE_PARALLEL_TOLERANCE = 1e-5;
  const CONSTRUCTION_GEOMETRY_ALPHA = 0.72;
  const ANNOTATION_SCREEN_PX_PER_MM = CSS_PX_PER_MM;
  const { DIMENSION_OUTSIDE_SHAFT_LENGTH_FACTOR } = window.DimensionLayout;
  const HATCH_SCREEN_PX_PER_MM = CSS_PX_PER_MM;
  const DIMENSION_DISPLAY_PRECISION = 1e-6;
  const MEASURED_DIMENSION_SNAP_TOLERANCE = 1e-5;
  const CONSTRAINT_ACCEPT_ERROR = 1e-4;
  const constraintCandidates = window.ConstraintCandidates.create({
    sameSketchElements, syncLineOrientationHints: () => solver.syncLineOrientationHints?.(),
    constraintAcceptError: CONSTRAINT_ACCEPT_ERROR,
  });
  const { sameArcEndpoint, constraintTargetsFromOperands, linesAreParallel } = constraintCandidates;
  const constraintOperandValues = window.ConstraintOperands.create({ elementSketchId, operandRelationForSketch, sameArcEndpoint, Arc, lineHasDirection, closestSplinePoint: window.SplineGeometry.closestPoint });
  const { operandElement, makeConstraintOperand, operandFromReferenceTarget, referenceTargetFromOperand, sameConstraintOperand } = constraintOperandValues;
  const PARAMETER_STABILIZATION_MAX_PASSES = 20;
  const PARAMETER_STABILIZATION_RELATIVE_TOLERANCE = 1e-7;
  const DRAG_PREVIEW_MAX_MODEL_ERROR = 0.125;
  const MIN_LINE_LENGTH = Math.max(MIN_ORIENTATION_LENGTH, solver.minLineLength || 12);
  let annotationSolveDrag = null;
  const solveScopeQuery = window.SolveScopeQuery.create({
    currentScope: () => { const scope = workspace.current(); return annotationSolveDrag ? { ...scope, points: [...scope.points, annotationSolveDrag.point], constraints: [...scope.constraints, ...annotationSolveDrag.constraints] } : scope; },
    additionalVariables: () => annotationSolveDrag?.variables.slice(2) || [],
    geometryReads, activeSketchId, elementSketchId, constraintSketchId,
    isVisibleSketchElement, constraintIsOperational, constraintGraphNodes: constraint => constraint.annotationGeometryNodes || constraintGraphNodes(constraint), geometryInstanceDependencyRefs, minimumLength: MIN_LINE_LENGTH,
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
  const canvasZoomControl = window.CanvasZoomControl.create({
    button: document.getElementById("statusZoom"), input: document.getElementById("statusZoomInput"),
    readPercent: () => viewport.scale / CSS_PX_PER_MM * 100,
    format: () => formatZoom(viewport.scale),
    applyPercent: percent => {
      pointerMoveScheduler.flush();
      const applied = canvasNavigation.setScale(percent / 100 * CSS_PX_PER_MM);
      syncDimensionValueInput();
      return applied;
    },
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
      if (pendingCommandSession.current && ["distance-value", "offset-value"].includes(pendingCommandSession.current.type)) syncDimensionValueInput();
    },
  });
  const { syncCanvasBitmapSize, resetCanvasStrokeState, withCanvasState, appearanceLineDash } = canvasSurface;
  const canvasWorkspaceLayout = window.CanvasWorkspaceLayout.create({
    canvas, document, viewport, syncCanvasBitmapSize, applySketchTreeWidth: () => applySketchTreeWidth(), draw,
    isValueInputPending: () => pendingCommandSession.current && ["distance-value", "offset-value"].includes(pendingCommandSession.current.type),
    syncDimensionValueInput: () => syncDimensionValueInput(), currentCanvasCenterWorld, applicationText, readLanguage: () => applicationSettings.language,
  });
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
    view: dimensionInputView, enabled: Boolean(dimensionValueInput), getPending: pendingCommandSession.read,
    dimensionLayout, worldToCanvasScreen, effectiveDimensionAppearance, constraintSketchId, activeSketchId,
    dimensionTextOffset, evaluateDimensionExpressionDraft, expressionFromUserInput,
    cancelPendingCommand, startDistanceValueInput, defaultDimensionForTarget,
    submitOffsetValue: () => submitOffsetValue(), submitDistanceValue: () => submitDistanceValue(), applicationText, setHint, draw,
  });
  const { hide: hideDimensionValueInput, sync: syncDimensionValueInput, focus: focusDimensionValueInput, updateBufferLabel: updateDistanceBufferLabel } = dimensionInputController;
  function dimensionLayout(target, dimension, appearance = effectiveDimensionAppearance(dimension)) {
    return dimensionLayouts.dimensionLayout(target, dimension, appearance);
  }
  const dimensionRenderer = window.DimensionRenderer.create({
    ctx, viewport, metrics: dimensionMetrics, canvasThemeColor,
    onExpressionMark: canvasRenderProbe.captureExpressionMark,
  });
  const { geometryDisplayColor, geometryStrokeWidth, geometryPaintState, pointPaintState, arcEndpointPaintState, splineHandleState } = window.GeometryPresentation.create({
    Point, canvasSelection, canvasHover, viewState,
    isExporting: () => Boolean(pngRender),
    effectiveAppearanceForElement, isEditableSketchElement, isConstraintOperandSelected, isPendingReferenceTarget,
    isSidebarHighlightedElement, isSidebarHoveredElement, isReferenceHoverElement, isSelectedConstraintRelatedElement,
    sketchAlpha, sketchStrokeWidth, constraintStatusColor, canvasThemeColor, constructionAlpha: CONSTRUCTION_GEOMETRY_ALPHA,
    handleQueries: { sameArcEndpoint, arcEndpointPoint, findArcEndpointFixedConstraint,
      isDraggingArcEndpoint: (arc, endpoint) => geometryDrag.isArcEndpoint(arc, endpoint),
      editedSpline: () => splineEditing.current?.spline, currentScope: workspace.current },
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

  const { drawResolvedHatchContent } = window.HatchRenderer.create({ viewport, visibleWorldBounds: () => pngRender?.worldBounds || visibleWorldBounds(), canvasThemeColor, isVisibleValue });
  const hatchLayer = window.HatchRenderer.createLayer({
    ctx, drawResolvedHatchContent, hatchBoundaryGeometryItems,
    boundaryPainters: [{ type: Line, draw: drawLines }, { type: Circle, draw: drawCircles }, { type: Arc, draw: drawArcs }, { type: Spline, draw: drawSplines }],
    allHatches, isVisibleSketchId, hatchAppearanceForDisplay, isConstraintOperandSelected, canvasSelection, activeSketchId,
    readHover: () => canvasHover.current, resolvedHatchBoundary, hatchPatternOrigin, isExporting: () => Boolean(pngRender),
    sketchAlpha, readMode: () => mode, readCommand: () => hatchCommand,
  });
  const { annotationLeaderDisplayGeometry, annotationTextLayout, annotationTextWorldHeight, annotationTextMetrics, drawAnnotationText, drawAnnotationLeader } = window.AnnotationRenderer.create({ ctx, viewport, withCanvasState, annotationDisplayColor, annotationLeaderAnchor, appearanceLineDash, formatValue: formatDisplayNumber, effectiveAnnotationStyle,
    resolvePlacement: (element, base) => window.AnnotationAnchorConstraints.resolve(element, base, resolveGeometryRef),
    showFrame: element => !pngRender && (canvasSelection.annotations.includes(element) || canvasSelection.inspectionContains(element) || canvasHover.current.annotation === element || canvasSelection.inspectionContains(element.blockInstance)),
    showResizeHandles: element => !pngRender && !element.blockProjection && canvasSelection.annotations.includes(element) && isEditableSketchElement(element) && annotationDrag.resizeEnabled(element),
    isResizeHandleHovered: (element, handle) => canvasHover.current.annotationHandle?.element === element && canvasHover.current.annotationHandle.resizeX === handle.resizeX && canvasHover.current.annotationHandle.resizeY === handle.resizeY,
    showLeaderEndHandle: element => !pngRender && !element.blockProjection && !element.anchorConstraints?.length && element.sketchId === activeSketchId() && (canvasSelection.annotations.includes(element) || canvasHover.current.annotation === element) });
  function annotationPlacementAnchor(element) {
    const layout = annotationTextLayout(element) || annotationTextMetrics(element, element.type === "leader" ? annotationLeaderDisplayGeometry(element) : element);
    return { x: layout.anchorX ?? layout.x, y: layout.anchorY ?? layout.y };
  }
  function materializeAnnotationAnchor(element, { capture = false } = {}) {
    if (!element.anchorPosition || capture) {
      const anchor = annotationPlacementAnchor(element);
      const position = { ...anchor };
      if (element.type === "leader") {
        const geometry = annotationLeaderDisplayGeometry(element), start = annotationLeaderAnchor(element) || element.start;
        position.x = element.start.x + (anchor.x - start.x) / geometry.shelfScale;
        position.y = element.start.y + (anchor.y - start.y) / geometry.shelfScale;
        element.textPlacement = "anchor";
      }
      if (!element.anchorPosition) { element.x = position.x; element.y = position.y; element.anchorPosition = `${effectiveAnnotationStyle(element).textAlign}-middle`; }
      return position;
    }
    return { x: element.x, y: element.y };
  }
  const annotationAnchorConstraints = window.AnnotationAnchorConstraints.create({
    getCommand: () => constraintTargetSession.command, setCommand: value => { constraintTargetSession.replaceCommand(value); },
    selectedAnnotation: () => canvasSelection.selectedElementCount() === 1 ? canvasSelection.annotations[0] : null,
    byId: id => model.annotations.find(item => item.id === id),
    canEdit: item => !item.blockProjection && guardSketchEdit(elementSketchId(item), "structure"),
    canReference: (item, point) => elementSketchId(point) === item.sketchId || isReferenceSourceSketchId(elementSketchId(point), item.sketchId),
    anchor: annotationPlacementAnchor, materialize: materializeAnnotationAnchor, pointRef: geometryRefForItem, resolveRef: resolveGeometryRef,
    recordHistory, updateUI, draw, setHint, cancelCommands: () => { cancelPendingCommand(""); cancelConstraintTargetCommand(""); }, applicationText,
  });
  function startAnnotationAnchorConstraint(type, item = canvasSelection.annotations.length === 1 ? canvasSelection.annotations[0] : null) {
    if (!item) return false;
    const targets = constraintTargetSession.command && !constraintTargetSession.command.annotationAnchor ? [...constraintTargetSession.operands] : constraintOperandsFromSelection();
    if (targets.length > (type === "symmetry" ? 2 : 1)) { setHint(applicationText("注記基準点の参照対象を選び直してください", "Select the reference targets for the annotation anchor again."), "error"); return true; }
    return annotationAnchorConstraints.start(type, item, targets);
  }
  const annotationCommand = window.AnnotationCommand.create({
    currentScope: workspace.current, getPending: pendingCommandSession.read, setPending: pendingCommandSession.replace,
    lastPointer: () => lastPointerWorld, viewScale: () => viewport.scale,
    annotationTextLayout, annotationLeaderDisplayGeometry, annotationTextMetrics,
    nextParameterName: () => parameterNamespace.allocateDimensionParameterName({ ...model, parameters: model.parameters.map(item => ({ ...item })), annotations: [...model.annotations] }),
    validateParameter: draft => {
      const name = String(draft.parameterName || "").trim(), expression = expressionFromUserInput(draft.expression);
      const symbols = parameterNamespace.symbolElementsInNamespace(model);
      parameterNamespace.validateParameterSymbolNames(model.parameters, [...symbols, { parameterName: name }]);
      const definitions = [...model.parameters.map(item => ({ ...item, kind: "parameter" })),
        ...symbols.filter(item => !isReadOnlyDimension(item)).map(item => ({ name: item.parameterName, expression: item.expression, kind: "dimension" })),
        { name, expression, kind: "dimension" }];
      const values = new Map(symbols.filter(isReadOnlyDimension).map(item => [item.parameterName, item.evaluatedParameterValue]));
      const value = window.ParameterEngine.evaluateDefinitions(definitions, values).values.get(name);
      if (!Number.isFinite(value)) throw new Error(applicationText("値を計算できません", "Value could not be evaluated"));
      return { expression, value };
    },
    commitParameter: item => { ensureDimensionParameter(item, model); parameterNamespace.evaluateParameterNamespace(model); },
    applyStyle: (style, key, value, effective) => appearanceEditing.applyLeaderAppearanceValue(style, key, value, { viewportScale: viewport.scale, effective }),
    parameterErrorText,
    selectAnnotation: item => canvasSelection.set("annotations", [item]),
    canEdit: item => guardSketchEdit(elementSketchId(item), "structure") && !item.blockProjection,
    prepare: () => { exitDrawMode(); cancelConstraintTargetCommand(""); },
    nextAnnotationId: () => `AN${annotationSeq++}`, activeSketchId, canCreateInActiveSketch, rejectRootSketchCreation,
    annotationLeaderTargetFromHit, annotationLeaderAnchor, effectiveAnnotationStyle, clearSelection, cancelPendingCommand,
    setHint, updateToolbar, updateUI, draw, recordHistory,
  });
  const { pushAnnotation } = annotationCommand;
  const referenceImageRenderer = window.ReferenceImageRenderer.create({
    ctx, viewport, withCanvasState, createImage: () => new Image(), onImageLoad: draw, referenceImageCorners,
  });
  const { drawImages: drawReferenceImages, drawOverlays: drawReferenceImageOverlays } = window.ReferenceImageRenderer.createLayer({
    renderer: referenceImageRenderer, readImages: () => model.referenceImages, canvasSelection, readHover: () => canvasHover.current,
    isVisibleValue, isVisibleSketchId, activeSketchId, readCalibrationPoints: () => referenceImageInteraction.calibrationPoints,
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
    currentScope: workspace.current, ids: geometryIds, assignSketchId, currentConstruction: () => constructionCommand.enabled,
    minLineLength: MIN_LINE_LENGTH, minArcLength: MIN_ARC_LENGTH,
  });
  const { addPoint, addPointToSketch, addLine, addCircle, addArc, addSpline, ensureLineMinimumLength, normalizeArcSweep, enforceMinimumLineLengths, normalizeArcSweeps } = geometryCreation;
  const sketchProjectionEditing = window.SketchProjectionEditing.create({
    currentScope: workspace.current, queries: sketchProjectionQueries, resolveGeometryRef, geometryRefForItem, geometryKindForItem,
    constraintSketchId, constraintIsOperational, addPointToSketch, constraintReferencesPoint, nextSeq, normalizeAppearance,
  });
  const { separateSharedSketchProjectionTargetPoints, synchronizeSketchProjectionMetadata } = sketchProjectionEditing;
  const drawingSnap = window.DrawingSnap.create({
    annotationAnchors: () => allAnnotations().filter(element => isVisibleSketchElement(element) && element.visible !== false).map(element => ({ element, ...annotationPlacementAnchor(element) })),
    geometryReads, isVisibleSketchElement, isActiveSketchElement, isSplineOnlyFitPoint, isReferencePoint, isPrimitiveCenterPoint, isEndpointPoint, isPointUsedByPrimitive, isExplicitPoint, sketchName, elementSketchId, applicationText,
  });
  const { candidates: snapCandidates, clear: clearSnap } = drawingSnap;
  const { circlePointAtPointer } = window.GeometryKernel;
  function snapForDrawing(point) { return drawingSnap.resolve(point, 10 / viewport.scale); }
  const splineCommand = window.SplineCommand.create({
    draft: splineDraft, addSpline, snapForDrawing, scale: () => viewport.scale,
    cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation,
    setMode: value => { mode = value; }, resetEditing: () => splineEditing.reset(),
    resetBlankCandidate: () => blankCanvasGesture.resetCandidate(), updateToolbar,
    clearProjectionSources: () => { sketchProjectionCommand.reset(); },
    setPointerPreview: value => { drawingPreview.setPointer(value); },
    clearSnap, clearSelection,
    selectCreatedSpline: spline => { canvasSelection.set("splines", [spline]); mode = "select"; },
    solveAndRefresh, recordHistory, applicationText, setHint, updateUI, draw,
  });
  const { start: beginSplineCreation, removeLast: removeLastSplineInputPoint, finalize: finalizeSplineCreation, click: handleSplineClick, doubleClick: finalizeSplineFromDoubleClick } = splineCommand;
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
    cancelConstraintTargetCommand, cancelPendingCommand, clearSnap, updateUI, Arc,
    selectedGeometry: () => [...canvasSelection.lines, ...canvasSelection.circles, ...canvasSelection.arcs],
    prepareStart: () => drawOperationLifecycle.prepare("offset"), addOffsetChainGeometry,
    getPending: pendingCommandSession.read, setPending: pendingCommandSession.replace,
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
    cancelConstraintTargetCommand, selectedLines: () => canvasSelection.lines, getPointer: () => lastPointerWorld,
    prepareStart: () => drawOperationLifecycle.prepare("fillet"), clearSnap, updateToolbar,
    getPending: pendingCommandSession.read, setPending: pendingCommandSession.replace,
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
    canEdit: (id, operation) => guardSketchEdit(id, operation),
    renameDimension: parameterNamespace.renameDimension,
    getPending: pendingCommandSession.read, setPending: pendingCommandSession.replace,
    expressionFromUserInput, evaluateDimensionExpressionDraft, applicationText, parameterErrorText,
    setHint, syncDimensionValueInput, draw, activeSketchId, sketchHasDimensionConstraint,
    captureSketchScreenFootprint: (sketchId = activeSketchId()) => viewport.captureBoundsFootprint(sketchGeometryBounds(sketchId)),
    snapshotModelState, restoreModelState, withTemporarySolveStepNorm, solveStepNormForConstraint,
    stabilizeActiveParameterNamespace, constraintSketchId, acceptError: CONSTRAINT_ACCEPT_ERROR,
    hideDimensionValueInput, recordHistory, updateUI, scaleSketchForFirstDimension,
    targetFromConstraint, isReadOnlyDimension, defaultDimensionForTarget, expressionInputValue, numericDimensionExpression, focusDimensionValueInput,
    selectEditedConstraint: constraint => {
      canvasSelection.set("dimensionConstraint", constraint); canvasSelection.set("constraint", null); dimensionDrag.reset();
    },
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
    cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation, clearSelection, updateToolbar,
    plans: centerlinePlans, construction: centerlineConstruction, selection: canvasSelection, sameSketchElements, activeSketchId, isActiveSketchElement, applicationText, minLineLength: MIN_LINE_LENGTH,
    snapForDrawing: pointer => ({ point: snapForDrawing(pointer), snap: drawingSnap.active }), clearSnap,
    setPointerPreview: value => { drawingPreview.setPointer(value); }, setMode: value => { mode = value; },
    invalidateAnalysis: () => { constraintAnalysis.invalidate(); }, setHint, updateUI, draw,
  });
  const { start: startCenterlineCommand, reset: resetCenterlineCommandState, prepare: prepareCenterlineEndpointPlacement, click: handleCenterlineClick, projectPointToCenterlineSupport } = centerlineCommand;
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
  const runtimeVersionView = window.RuntimeVersionView.create({ document, applicationText });

  const constraintButtons = Array.from(document.querySelectorAll("[data-constraint]"));
  const constraintMenuButtons = Array.from(document.querySelectorAll("[data-menu-constraint]"));
  const fixPointBtn = document.getElementById("fixPointBtn");
  const commandCursor = window.CommandCursor.create({ document, canvas, fixPointBtn, constraintButtons });

  for (const btn of document.querySelectorAll("button[aria-label]")) {
    btn.dataset.tooltip = btn.getAttribute("aria-label");
  }

  function log(msg) {
    const el = document.getElementById("log");
    if (!el) return;
    el.textContent = `${msg}\n` + el.textContent;
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

  const constraintFeedback = window.ConstraintFeedback.create({ applicationText });
  const { constraintStatusBadge } = constraintFeedback;
  function setSolveResultHint(label, solved, analysis, dependent) {
    const hint = constraintFeedback.resultHint(label, solved, analysis, dependent, constraintRedundancy.count);
    setHint(hint.message, hint.kind);
  }

  function effectiveDocumentName() {
    return effectiveDocumentNameFromValue(documentModel.documentName);
  }

  const documentStatusView = window.DocumentStatusView.create({
    document, applicationText, fileSession, getDocumentName: effectiveDocumentName,
    currentSnapshot: () => documentHistory.currentSnapshot, isEditingBlock: () => Boolean(blockEditor.current),
  });
  function updateDocumentNameUI() { documentStatusView.render(); }

  function markDocumentFileCheckpoint(kind, data = serializeModel()) {
    fileSession.markCheckpoint(kind, data);
    updateDocumentNameUI();
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
      leaderAppearance: window.Appearance.normalizeLeaderAppearance(sketch?.leaderAppearance),
    };
  }

  function effectiveDimensionAppearance(dimension, sketchId = activeSketchId(), sketches = model.sketches) {
    const sketch = sketches.find((item) => item.id === sketchId) || sketches.find((item) => isRootSketch(item)) || null;
    return resolveDimensionAppearance({ ...documentModel.defaultDimensionAppearance, ...documentModel.defaultTerminatorAppearance },
      sketch && !isRootSketch(sketch) ? sketch.dimensionAppearance : null, dimension?.display);
  }

  function ensureAppearanceState() {
    window.DocumentState.normalizeAppearanceState(documentModel, model, { blockEditing: Boolean(blockEditor.current) });
  }

  const blockState = window.BlockState.create({
    blockDefinitionDrawableSketchIds, blockDefinitionGeometrySketchIds, isDrawableSketch, firstDrawableSketchId,
  });
  function ensureBlockState() {
    blockState.normalize(documentModel, model, blockEditor.current?.draft?.id || null);
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

  const annotationParameterCommand = window.AnnotationParameterCommand.create({
    capture: snapshotModelState, restore: restoreModelState, guardDimensionSymbolDeletion,
    ensureParameter: item => ensureDimensionParameter(item, currentParameterNamespace()),
    renameParameter: parameterNamespace.renameDimension, expressionFromUserInput,
    stabilize: () => stabilizeActiveParameterNamespace(activeSketchId(), { allSketches: model.sketches.filter(sketch => !isRootSketch(sketch)).map(sketch => sketch.id) }),
    recordHistory, setHint, parameterErrorText,
  });
  const commitAnnotationParameterEdit = annotationParameterCommand.commit;
  const annotationInputController = window.AnnotationInputController.create({
    document, host: canvas.parentElement, getPending: pendingCommandSession.read, setPending: pendingCommandSession.replace,
    find: id => workspace.current().annotations.find(item => item.id === id),
    canEdit: item => guardSketchEdit(elementSketchId(item)) && !item.blockProjection,
    prepare: () => { exitDrawMode(); cancelConstraintTargetCommand(""); cancelPendingCommand(""); annotationDrag.reset(); },
    select: item => { clearSelection(); canvasSelection.set("annotations", [item]); },
    layout: item => { const box = annotationTextLayout(item) || annotationTextMetrics(item, item.type === "leader" ? annotationLeaderDisplayGeometry(item) : item); return { ...box, screenFontSize: box.fontSize * viewport.scale }; },
    toScreen: worldToCanvasScreen, expressionInputValue, applicationText,
    commit: (item, value) => {
      if (item.parameterEnabled) return commitAnnotationParameterEdit(item, "annotation-expression", value);
      item.text = value; recordHistory("注記変更"); return true;
    }, draw, updateUI,
  });

  function guardDimensionSymbolDeletion(constraints, namespace = currentParameterNamespace()) {
    const { removedNames, dependents } = parameterNamespace.symbolDeletionDependents(constraints, namespace);
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
    if (!items.filter(Boolean).every(item => guardSketchEdit(elementSketchId(item)))) return false;
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

  function hitAnnotationElement(x, y, options = {}) {
    return queryAnnotationElement(x, y, { activeOnly: !ordinarySelectionMode(), ...options });
  }

  function hitHatchAt(...args) { return regionHitQuery.hitHatchAt(...args); }
  function hitReferenceImageAt(...args) { return regionHitQuery.hitReferenceImageAt(...args); }

  const referenceImageInteraction = window.ReferenceImageInteraction.create({
    canEdit: item => guardSketchEdit(item.sketchId),
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

  function effectiveAppearanceForElement(...args) { return geometryAppearance.effectiveAppearanceForElement(...args); }
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

  function selectionItems() {
    return [...selectedGeometryItems(), ...canvasSelection.blockInstances, ...canvasSelection.geometryInstances,
      ...canvasSelection.annotations, ...canvasSelection.hatches, ...canvasSelection.referenceImages,
      ...canvasSelection.dimensionConstraints, canvasSelection.constraint, canvasSelection.arcEndpoint?.arc].filter(Boolean);
  }

  function selectIdentity(identity, additive = false) {
    let item = identity.item, kind = identity.kind;
    if (item.blockInstance) { item = item.blockInstance; kind = "block"; }
    else if (item.derivedInstance) { item = item.derivedInstance; kind = "instance"; }
    if (additive && selectionSketchId() && selectionSketchId() !== identity.sketchId) return false;
    if (!additive) clearSelection();
    const field = { point: "points", line: "lines", circle: "circles", arc: "arcs", spline: "splines",
      block: "blockInstances", instance: "geometryInstances", "geometry-instance": "geometryInstances",
      dimension: "dimensionConstraints", annotation: "annotations", hatch: "hatches", image: "referenceImages" }[kind];
    if (!field) return false;
    if (additive) canvasSelection.toggleById(field, item); else canvasSelection.set(field, [item]);
    updateGeometrySelectionUI(); draw(); return true;
  }

  function selectionSketchId() { return selectionItems()[0]?.sketchId || canvasSelection.inspection?.sketchId || null; }

  function guardSketchEdit(sketchId = activeSketchId(), operation = "edit") {
    if (canEditSketch(sketchId, operation)) return true;
    setHint(sketchById(sketchId)?.locked
      ? applicationText("スケッチはロック中です。ロック解除または作図先変更が必要です", "Sketch is locked. Unlock it or change the drawing sketch.")
      : applicationText("この操作には所属スケッチを作図先に指定してください", "Set the owning sketch as the drawing sketch for this operation."), "error");
    return false;
  }

  function guardSelectionEdit(operation = "edit") {
    return [...new Set(selectionItems().map(elementSketchId))].every(id => guardSketchEdit(id, operation));
  }

  function ordinarySelectionMode() { return mode === "select" && !pendingCommandSession.current && !constraintTargetSession.command; }
  function hitSketchAllowed(id) {
    return isVisibleSketchId(id) && (ordinarySelectionMode() || id === activeSketchId() && isEditableSketchId(id));
  }
  function hitElementAllowed(item) { return isVisibleSketchElement(item) && hitSketchAllowed(elementSketchId(item)); }

  function toggleSketchLock(id) {
    const sketch = sketchById(id);
    if (!sketch || isRootSketch(sketch)) return false;
    cancelPendingCommand(""); cancelConstraintTargetCommand(""); exitDrawMode();
    sketch.locked = !sketch.locked;
    updateUI(); draw(); recordHistory(applicationText("スケッチロック切替", "Toggle sketch lock"));
    return true;
  }

  function canCreateInActiveSketch() {
    return isGeometryMode() && canEditSketch(activeSketchId(), "create");
  }

  function rejectRootSketchCreation() {
    if (canCreateInActiveSketch()) return false;
    guardSketchEdit(activeSketchId(), "create");
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

  function isVisibleValue(...args) { return geometryAppearance.isVisibleValue(...args); }
  function isVisibleSketchId(...args) { return geometryAppearance.isVisibleSketchId(...args); }
  function isVisibleSketchElement(...args) { return geometryAppearance.isVisibleSketchElement(...args); }
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

  function operandRelationForSketch(sketchId) {
    if (sketchId === activeSketchId()) return "active";
    if (descendantSketchIds(activeSketchId()).includes(sketchId)) return "descendant";
    if (isReferenceSourceSketchId(sketchId)) return "reference";
    return null;
  }

  function isConstraintOperandSelected(item, options = {}) {
    if (!item) return false;
    if (commandPanelSelectedItem) return geometryRefsEqual(geometryRefForItem(item), geometryRefForItem(commandPanelSelectedItem));
    if (mode === "instance-sources" && instanceSourceCommand.includesRef(geometryRefForItem(item))) return true;
    if (mode === "sketch-projection" && sketchProjectionCommand.includes(item)) return true;
    if (["mirror-axis", "pattern-direction"].includes(mode) || mode.startsWith("free-instance-")) {
      if (item === geometryInstanceCommand.reference || geometryInstanceCommand.sources.some(ref => geometryRefsEqual(ref, geometryRefForItem(item)))) return true;
    }
    if (options.arcEndpoint) {
      return constraintTargetSession.operands.some((operand) => operand.kind === "arc-endpoint" && sameArcEndpoint(operand, options.arcEndpoint));
    }
    return constraintTargetSession.operands.some((operand) => operandElement(operand) === item);
  }

  function syncSelectionFromConstraintOperands() { canvasSelection.applyConstraintTargets(constraintTargetsFromOperands(constraintTargetSession.operands)); }

  function constraintOperandsFromSelection() { return constraintOperandValues.fromSelection(canvasSelection, lastPointerWorld); }

  function resultIsAccepted(result) {
    return Boolean(result) && Number.isFinite(result.errorNorm) && result.errorNorm <= CONSTRAINT_ACCEPT_ERROR;
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

  function solveAndRefresh(label = "自動solve", sketchId = activeSketchId()) {
    const solved = stabilizeActiveParameterNamespace(sketchId);
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

  function canvasThemeColor(value) {
    return window.CanvasThemeColors.color(value, applicationSettings.theme);
  }

  function isReferenceHoverElement(item) {
    return Boolean(constraintTargetSession.command && item && !isActiveSketchElement(item) && isReferenceSourceSketchId(elementSketchId(item)));
  }

  function isPendingReferenceTarget(item) {
    const target = constraintTargetSession.command?.referenceTarget || pendingCommandSession.current?.referenceTarget;
    if (!target || !item) return false;
    if (target.kind === "point") return target.point === item;
    if (target.kind === "line") return target.line === item;
    if (target.kind === "primitive") return target.primitive === item;
    return false;
  }

  function drawOrderBySketch(items) {
    return items.filter(isVisibleSketchElement).sort((a, b) => Number(isActiveSketchElement(a)) - Number(isActiveSketchElement(b)));
  }

  function sketchAlpha(item) {
    const relation = sketchRelationOfElement(item);
    if (relation === "active") return 1;
    if (relation === "reference" || relation === "descendant" || relation === "inactive") return 1;
    return 0;
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

  function sketchProjectionEntriesByRect(rect, crossing) {
    return rectangleSelectionQuery.readProjection(rect, crossing, {
      points: allGeometryPoints, lines: allGeometryLines, circles: allGeometryCircles,
      arcs: allGeometryArcs, splines: allGeometrySplines, hatches: allHatches,
    }, sketchProjectionEntryFromItem);
  }

  function selectCreatedSketchProjectionTargets(targets) {
    clearSelection();
    canvasSelection.set("points", targets.filter((item) => item instanceof Point));
    canvasSelection.set("lines", targets.filter((item) => item instanceof Line));
    canvasSelection.set("circles", targets.filter((item) => item instanceof Circle));
    canvasSelection.set("arcs", targets.filter((item) => item instanceof Arc));
    canvasSelection.set("splines", targets.filter((item) => item instanceof Spline));
  }

  function selectedItemsForGeometryInstance() {
    const items = [...selectedGeometryItems(), ...canvasSelection.hatches.filter(hatch => model.hatches.includes(hatch))];
    for (const instance of canvasSelection.blockInstances) {
      const bundle = blockProjectionBundle(instance);
      items.push(...bundle.lines, ...bundle.circles, ...bundle.arcs, ...bundle.splines, ...(bundle.hatches || []), ...bundle.points.filter((point) => point.localElement?.kind === "explicit"));
    }
    for (const instance of canvasSelection.geometryInstances) {
      const bundle = geometryInstanceBundle(instance);
      items.push(...bundle.lines, ...bundle.circles, ...bundle.arcs, ...bundle.splines, ...(bundle.hatches || []));
      for (const point of bundle.points) if (point.sourceElement instanceof Point && point.sourceElement.kind === "explicit") items.push(point);
    }
    return [...new Set(items)].filter((item) => elementSketchId(item) === activeSketchId() && geometryRefForItem(item));
  }









  const circleCenterCrossCommand = window.CircleCenterCrossCommand.create({
    geometry: { addPoint, addLine, pushModelConstraint },
    checkpoint: { capture: snapshotGeometryMutationState, restore: restoreGeometryMutationState },
    solveSketchAndDependents, resultIsAccepted, minOrientationLength: MIN_ORIENTATION_LENGTH,
    activeSketchId, isActiveSketchElement, selection: canvasSelection, selectedElementCount,
    cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation,
    setMode: value => { mode = value; }, clearPreview: () => drawingPreview.setPointer(null),
    clearSnap, clearSelection, invalidateAnalysis: () => constraintAnalysis.invalidate(),
    updateUI, draw, setHint, recordHistory, applicationText,
  });
  const { start: startCircleCenterCrossCommand, click: handleCircleCenterCrossClick } = circleCenterCrossCommand;

  const lineCollapseQuery = window.LineCollapseQuery.create({
    connectedComponentFromSeeds, constraintGraphNodes, localSolveLines, minLineLength: MIN_LINE_LENGTH,
  });

  const splineEditing = window.SplineEditCommand.create({
    canEditStructure: item => guardSketchEdit(elementSketchId(item), "structure"),
    currentScope: () => model, ids: geometryIds, clearSelection, canvasSelection, applicationText, setHint, updateUI, draw,
    restoreModelState, snapshotModelState, stabilizeActiveParameterNamespace, elementSketchId,
    invalidateAnalysis: () => constraintAnalysis.invalidate(), recordHistory, guardSketchProjectionShapeEdit,
    addPoint, isPointUsedByLine, isPointUsedByCircle, isPointUsedByArc, constraintReferencesPoint,
    guardDimensionSymbolDeletion, geometryElementKey, annotationReferencesRemovedGeometry,
  });
  const { begin: beginSplineEditFromDoubleClick, finish: finishSplineEditSession,
    addPoint: addSplineFitPointFromContext, deletePoint: deleteSplineFitPointFromContext } = splineEditing;

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
    currentScope: workspace.current, canStartCreation: () => isGeometryMode() && canCreateInActiveSketch() && guardSelectionEdit("structure"),
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
    sketchProjectionCommand.reset();
    geometryInstanceCommand.clearSources();
    instanceSourceCommand.reset();
    splineEditing.reset();
    drawingPreview.setPointer(null);
    offsetSelection.reset();
    pendingCommandSession.clear();
    constraintTargetSession.reset();
    constructionCommand.restore(false);
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

  const { serialize: serializeDimension } = window.DimensionPersistence.create({
    migrateAngleDimensionLabelPlacement, dimensionAnchor, storedDimensionAxis,
  });

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

  const historyRestoration = window.HistoryRestoration.create({
    historyController, document: { getName: () => documentModel.documentName,
      setName: name => { documentModel.documentName = name; }, load: loadModelData },
    constructionCommand, blockEditor, cloneBlockDefinition, invalidateBlockProjectionCache,
    clearInteractionForSketchChange, solveAndRefresh, setHint,
  });
  function restoreHistorySnapshot(snapshot, label) { return historyRestoration.document(snapshot, label); }
  function restoreBlockEditorHistorySnapshot(snapshot, label) { return historyRestoration.block(snapshot, label); }

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

  const documentApplication = window.DocumentApplication.create({
    documentLoading, document: documentModel, model, resetEditingState: resetModelState,
    sketchTreeView: { capture: () => sketchTreeView.capture(), restore: state => sketchTreeView.restore(state) },
    refreshReferenceConstraintValidity, enforceMinimumLineLengths, ensureDimensionDefaults,
    restoreSequences: sequences => {
      reserveGeometryElementSequences(sequences.geometry);
      ({ sketchSeq, annotationSeq, hatchSeq, referenceImageSeq, blockDefinitionSeq, blockInstanceSeq,
        sketchProjectionInstanceSeq, freeInstanceSeq, mirrorInstanceSeq, patternInstanceSeq, blockElementSeq } = sequences);
    },
    ensureAppearanceState, ensureBlockState, log,
  });
  function loadModelData(data, options = {}) {
    return documentApplication.load(data, options);
  }

  const documentFileCommand = window.DocumentFileCommand.create({
    window, document, fileSession, choiceDialog, applicationText,
    bookmarks: window.DocumentBookmarks.create({ indexedDB: window.indexedDB, crypto: window.crypto }),
    isEditingBlock: () => Boolean(blockEditor.current), getDocumentName: () => documentModel.documentName,
    serializeModel, markDocumentFileCheckpoint, updateDocumentNameUI, setHint, log,
    applyLoadedDocument: (data, fileName) => {
      loadModelData(data, { documentNameOverride: fileNameStem(fileName) });
      solveAndRefresh("ファイル読み込み");
      resetHistory("ファイル読み込み");
      markDocumentFileCheckpoint("saved");
      updateDocumentNameUI();
      fitAllGeometryToViewport();
      draw();
      if (documentApplication.blockConstraintRepairMessage) setHint(documentApplication.blockConstraintRepairMessage);
    },
  });
  const { save: saveJot2DFile, saveAs: saveJot2DFileAs, open: openJot2DFile, importFileData } = documentFileCommand;

  const referenceImageImport = window.ReferenceImageImport.create({ window, document, applicationText });

  const canImportDxf = () => canCreateInActiveSketch() && !hasActiveDrawOperation()
    && !pendingCommandSession.current && !constraintTargetSession.command && mode !== "block-place";
  const dxfImportCommand = window.DxfImportCommand.create({
    parser: window.DxfImport, geometry: geometryCreation, ids: geometryIds,
    currentScope: workspace.current, activeSketchId, canImport: canImportDxf,
    signature: () => window.DocumentFiles.documentContentSignature(serializeModel()),
    fileSession, requestChoice: options => choiceDialog.show(options), applicationText,
    minimumLength: MIN_LINE_LENGTH, setHint,
    onImported: () => {
      clearSelection();
      updateUI();
      recordHistory("DXF読み込み");
      fitAllGeometryToViewport();
      draw();
    },
  });

  const referenceImageCommand = window.ReferenceImageCommand.create({
    referenceImageImport, canvas, viewport, screenToWorld, currentScope: workspace.current, activeSketchId,
    nextId: () => `IMG${referenceImageSeq++}`, canCreateInActiveSketch, clearSelection, canvasSelection,
    updateUI, draw, recordHistory, setHint, applicationText,
  });
  const imageClipboard = window.ImageClipboard.create({ window,
    importFile: referenceImageCommand.importFile, pasteGeometry: pasteGeometryClipboard, copyGeometry: copySelectionToClipboard,
    isGeometryMode, isTextEditingTarget: target => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable,
    setHint, applicationText,
  });
  document.addEventListener("paste", imageClipboard.paste);
  document.addEventListener("copy", imageClipboard.copy);
  document.addEventListener("cut", imageClipboard.copy);
  const { importFile: importReferenceImageFile } = referenceImageCommand;

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
    constraintTargetSession.clearOperands();
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
    return isActiveSketchElement(item) && isVisibleSketchElement(item);
  }

  const drawOperationLifecycle = window.DrawOperationLifecycle.create({
    canStart: nextMode => nextMode === "select" || guardSketchEdit(activeSketchId(), "create") && (nextMode !== "trim" || guardSelectionEdit("structure")),
    instances: geometryInstanceCommand, instanceSources: instanceSourceCommand, centerline: centerlineCommand,
    line: lineCommand, rectangle: rectangleCommand, slot: slotCommand, fillet: filletCommand,
    circular: circularCommands,
    spline: splineDraft, splineEditing, projection: sketchProjectionCommand, preview: drawingPreview, offset: offsetSelection, hatch: { reset: () => hatchCommand.reset() },
    transient: { clearPoint: clearTransientPointRollback, clearLineCompletion: clearTransientLineCompletionRollback, rollbackLineStart: rollbackTransientLineStart },
    clearSnap, clearSelection, selectMode: () => { mode = "select"; }, updateToolbar, setHint, updateUI, draw,
    cancelConstraintTargetCommand, setMode: value => { mode = value; },
    clearTrimHover: () => canvasHover.update({ point: null, endpointPoint: null, line: null, circle: null, arcEndpoint: null, arc: null, dimension: null }),
  });
  function exitLineMode() { return drawOperationLifecycle.exitLine(); }
  function exitDrawMode() { return drawOperationLifecycle.exit(); }
  function hasActiveDrawOperation() { return drawOperationLifecycle.active(); }
  function cancelActiveDrawOperation() { return drawOperationLifecycle.cancel(); }

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

  function resizeCanvas(...args) { return canvasWorkspaceLayout.resizeCanvas(...args); }
  function setPropertiesPanelCollapsed(...args) { return canvasWorkspaceLayout.setPropertiesPanelCollapsed(...args); }

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




























  const regionHitQuery = window.GeometryHitQuery.createRegions({
    currentScope: workspace.current, ordinarySelectionMode, allHatches, isVisibleSketchId, isVisibleValue, hatchAppearanceForDisplay,
    activeSketchId, drawingOrderOwner, resolvedHatchBoundary, hatchContainsSelectablePoint, referenceImageWorldToLocal,
  });
  const dimensionHitQuery = window.GeometryHitQuery.createDimensions({
    currentScope: workspace.current, viewportScale: () => viewport.scale, ordinarySelectionMode, isActiveSketchConstraint, isVisibleSketchId,
    constraintSketchId, targetFromConstraint, defaultDimensionForTarget, isVisibleValue, effectiveDimensionAppearance, dimensionLayout,
    dimensionLabelForConstraint, dimensionTextDrawingMetrics, dimensionTextWidth, dimensionUsesExpression, pointInExpandedBox,
  });
  const instanceHitQuery = window.GeometryHitQuery.createInstances({
    currentScope: workspace.current, viewportScale: () => viewport.scale, hitSketchAllowed, isVisibleSketchId, blockProjectionBundle,
    annotationBounds, resolvedHatchBoundary, isVisibleValue, hatchAppearanceForDisplay, hatchContainsSelectablePoint, geometryInstanceBundles,
  });
  const { hitSketchIdentityElement, hitEndpointPoint, hitExplicitPoint, hitAnyPoint, hitPoint, hitLine, hitCircle, hitArc, hitArcEndpoint, hitSpline } = window.GeometryHitQuery.create({
    currentScope: workspace.current, viewportScale: () => viewport.scale,
    isEditableSketchElement: hitElementAllowed, isSelectableEndpointPoint, isExplicitPoint, preferredSketchId: activeSketchId,
    hitDimension, constraintSketchId, elementSketchId, isVisibleSketchElement, hitBlockInstance, blockDefinitionById,
    hitGeometryInstance, hitAnnotationElement: (...args) => hitAnnotationElement(...args), hitHatchAt, hitReferenceImageAt,
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

  function hitDimension(...args) { return dimensionHitQuery.hitDimension(...args); }

  function primitiveId(primitive) {
    return primitive?.id || "";
  }

  function isPrimitive(item) {
    return item instanceof Circle || item instanceof Arc;
  }


  function distanceTargetFromSelection() { return constraintSelectionQuery.distanceTarget(); }

  function hitBlockInstance(...args) { return instanceHitQuery.hitBlockInstance(...args); }
  function hitGeometryInstance(...args) { return instanceHitQuery.hitGeometryInstance(...args); }
  function hitDerivedGeometryForDrag(...args) { return instanceHitQuery.hitDerivedGeometryForDrag(...args); }
  function hitBlockRotationHandle(x, y) { return null; }





















  const { hitConstraintOperand: queryConstraintOperand, hitDerivedProjectionOperand, hitBlockProjectionOperand, hitReferenceTarget } = window.OperandHitQuery.create({
    viewportScale: () => viewport.scale,
    geometry: { geometryInstanceBundles, blockProjectionBundles, allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines },
    sketches: { isVisibleSketchId, operandRelationForSketch, referenceSourceSketchIds, elementSketchId, isVisibleSketchElement },
    points: { isExplicitPoint, isPointUsedByPrimitive, isReferencePoint }, makeConstraintOperand, operandFromReferenceTarget,
    hits: { hitPoint, hitLine, hitCircle, hitArc, hitSpline, hitArcEndpoint },
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

  const geometryDeletion = window.GeometryDeletion.create({
    isPointUsedByLine, isPointUsedByCircle, isPointUsedByArc, isPointUsedBySpline,
    constraintReferencesPoint, constraintReferencesLine, constraintReferencesPrimitive,
    geometryElementKey, annotationReferencesRemovedGeometry,
    geometryInstanceBundle, blockAllProjectionBundle, constraintGraphNodes,
  });

  const geometryDeletionCommand = window.GeometryDeletionCommand.create({
    currentScope: workspace.current, geometryDeletion, canvasSelection, splineEditing, canvasHover,
    guardSketchEdit, elementSketchId, geometryElementKey, geometryInstanceUsesRemovedGeometry,
    rejectReferencedGeometryDeletion, annotationReferencesRemovedGeometry, guardDimensionSymbolDeletion, applicationText,
    endInteraction: () => {
      geometryDrag.reset();
      dimensionDrag.reset();
      annotationDrag.reset();
      pendingCommandSession.clear();
      constraintTargetSession.clearCommand();
      lineCommand.reset();
      circularCommands.resetCircle();
      resetArcCommandState();
      drawingPreview.setPointer(null);
      mode = "select";

    },
    solveSketchAndDependents, normalizeArcSweeps,
    refreshView: () => { updateToolbar(); updateUI(); draw(); },
    analysisStable: () => constraintAnalysis.stable, setHint, log, recordHistory,
  });
  function deleteElements(options) { return geometryDeletionCommand.remove(options); }

  const selectionDeletionCommand = window.SelectionDeletionCommand.create({
    currentScope: workspace.current, canvasSelection, geometryDeletion, referenceImageInteraction,
    guardSelectionEdit, selectionSketchId, activeSketchId, geometryRefKey, geometryRefForItem,
    geometryInstanceUsesRemovedGeometry, rejectReferencedGeometryDeletion, guardDimensionSymbolDeletion,
    annotationReferencesRemovedGeometry, invalidateBlockProjectionCache, effectiveSelectedConstraint,
    deleteElements, clearSelection, solveAndRefresh, refreshView: () => { updateUI(); draw(); },
    recordHistory, setHint, applicationText,
  });
  function deleteCurrentSelection() { return selectionDeletionCommand.remove(); }

  const clipboardPayload = window.ClipboardPayload.create({
    geometryInstanceBundle, geometryInstanceSourcePoints, serializeGeometryInstance, blockProjectionBundle, blockProjectionLocalId, resolveGeometryRef, constraintGraphNodes, applicationText,
    detachedAnnotation: annotation => {
      const data = serializeAnnotation(annotation);
      const layout = annotationTextLayout(annotation) || annotationTextMetrics(annotation, annotation.type === "leader" ? annotationLeaderDisplayGeometry(annotation) : annotation);
      data.x = layout.anchorX; data.y = layout.anchorY;
      data.anchorPosition = annotation.anchorPosition || effectiveAnnotationStyle(annotation).textAlign + "-middle";
      if (annotation.type === "leader") {
        const geometry = annotationLeaderDisplayGeometry(annotation);
        data.start = { ...annotationLeaderAnchor(annotation) }; data.elbow = { ...geometry.elbow }; data.end = { ...geometry.end };
        data.textPlacement = "anchor";
        data.shelfReferenceScale = viewport.scale / window.Appearance.annotationDisplayFactor(effectiveAnnotationStyle(annotation), viewport.scale);
      }
      return data;
    },
    serializeConstraint: constraint => decorateSerializedConstraint(serializeConstraint(constraint), constraint),
  });
  function copyableSelectionPayload() {
    const scopeId = currentBlockDefinitionScopeId();
    const result = clipboardPayload.build(model, canvasSelection, scopeId ? `block:${scopeId}` : "document");
    if (result.error) setHint(result.error, "error");
    return result.payload;
  }

  const clipboardSession = window.ClipboardSession.create({
    pasteOffsetScreenPx: CLIPBOARD_PASTE_OFFSET_SCREEN_PX,
    onCopyStored: () => { imageClipboard.markCopy(); updateToolbar(); },
    deleteSelection: deleteCurrentSelection,
  });

  function copySelectionToClipboard(options = {}) { return clipboardCommand.copy(options); }

  const clipboardTransfer =
    window.ClipboardTransfer.create({ blockProjectionBundle, blockProjectionLocalId, resolveGeometryRef, geometryInstanceSourcePoints, geometryInstanceBundle, applicationText });

  const clipboardGeometry = window.ClipboardGeometry.create({
    geometryIds, ensureLineMinimumLength, normalizeArcSweep, blockDefinitionById,
    allocateBlockInstanceId: () => `BI${blockInstanceSeq++}`,
    allocateGeometryInstanceId: type => type === "free" ? "FI" + freeInstanceSeq++ : type === "mirror" ? "MI" + mirrorInstanceSeq++ : type === "pattern" ? "PI" + patternInstanceSeq++ : "SPI" + sketchProjectionInstanceSeq++,
    normalizeGeometryInstance, copiedGeometryInstance: clipboardTransfer.copiedGeometryInstance, applicationText,
  });

  const clipboardPasteCheckpoint = window.ClipboardPasteCheckpoint.create({
    geometryIds,
    captureSequences: () => ({ annotationSeq, hatchSeq, referenceImageSeq, sketchProjectionInstanceSeq, mirrorInstanceSeq, patternInstanceSeq, freeInstanceSeq, blockInstanceSeq }),
    restoreSequences: sequences => {
      blockInstanceSeq = sequences.blockInstanceSeq;
      ({ sketchProjectionInstanceSeq, mirrorInstanceSeq, patternInstanceSeq, freeInstanceSeq } = sequences);
      annotationSeq = sequences.annotationSeq;
      hatchSeq = sequences.hatchSeq;
      referenceImageSeq = sequences.referenceImageSeq;
    },
  });

  const clipboardGraph = window.ClipboardGraph.create({
    geometry: clipboardGeometry, transfer: clipboardTransfer, parameters: parameterNamespace,
    elementIds: { hatch: () => "H" + hatchSeq++, annotation: () => "AN" + annotationSeq++,
      image: () => "IMG" + referenceImageSeq++, nextHatchIndex: () => hatchSeq },
    deserializeConstraint, invalidateProjection: invalidateBlockProjectionCache, applicationText,
  });

  const clipboardCommand = window.ClipboardCommand.create({
    session: clipboardSession, graph: clipboardGraph, checkpoint: clipboardPasteCheckpoint, selection: canvasSelection,
    isGeometryMode, buildCopyPayload: copyableSelectionPayload, blockDefinitionScopeError,
    canCreate: () => { if (canCreateInActiveSketch()) return true; guardSketchEdit(activeSketchId(), "create"); return false; },
    currentTarget: () => ({ model, sketchId: activeSketchId(), scale: viewport.scale }),
    parameterTarget: () => ({ namespace: currentParameterNamespace(),
      namespaceKey: currentBlockDefinitionScopeId() ? `block:${currentBlockDefinitionScopeId()}` : "document" }),
    clearSelection, finishPaste: () => { mode = "select"; solveAndRefresh("貼り付け"); },
    recoverView: () => { invalidateBlockProjectionCache(); clearSelection(); updateUI(); draw(); },
    sketchName, setHint, updateToolbar,
  });
  function pasteGeometryClipboard() { return clipboardCommand.paste(); }

  function ensureDimensionDefaults() {
    for (const constraint of model.constraints) {
      const target = targetFromConstraint(constraint);
      if (target) constraint.dimension = dimensionPlacement.normalizeDimension(target, constraint.dimension);
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
    arcSamplePoints, viewScale: () => viewport.scale, isEditableSketchId: id => id === activeSketchId(), isVisibleSketchId, blockProjectionBundle, geometryInstanceBundle, mergeBounds,
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
    if (additive && selectionSketchId() && selectionSketchId() !== activeSketchId()) return;
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








  function drawResolvedHatch(...args) { return hatchLayer.drawResolvedHatch(...args); }

  function drawHatches(...args) { return hatchLayer.drawHatches(...args); }

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
    if (pngExportCommand?.active && !pngExportCommand.busy && (pendingCommandSession.current?.type !== "png-export" || mode !== "png-export")) pngExportCommand.cancel();
    commandPanel?.update();
    annotationInputController.sync();
    commandPanelSelectedItem = derivedPanel?.selectedItem() || null;
    if (!interactionProfiler.active) return drawUnprofiled();
    return profileInteractionWork("draw", () => drawUnprofiled());
  }

  function drawUnprofiled() {
    return withGeometryReadCache(drawCanvas);
  }

  function drawCanvas() {
    canvasZoomControl.sync();
    if (canvasSurface.width <= 0 || canvasSurface.height <= 0) syncCanvasBitmapSize();
    const dpr = canvasSurface.dpr;
    if (!pngRender) pointerMoveScheduler.recordDraw();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    resetCanvasStrokeState();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (pngRender) ctx.setTransform(pngRender.ratio.x, 0, 0, pngRender.ratio.y, -pngRender.region.x * pngRender.ratio.x, -pngRender.region.y * pngRender.ratio.y);
    else ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    resetCanvasStrokeState();
    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.scale, viewport.scale);
    resetCanvasStrokeState();
    drawReferenceImages();
    drawHatches([], { includePreview: true });
    drawDrawingStack();
    if (pngRender) {
      drawDimensions();
      drawAnnotations();
      drawPoints();
      ctx.restore();
      resetCanvasStrokeState();
      return;
    }
    drawBlockInstanceHandles();
    drawDimensions();
    drawDimensionPreview();
    drawAnnotations();
    const annotationPreview = annotationCommand.preview();
    if (annotationPreview?.type === "leader") drawAnnotationLeader(annotationPreview, true);
    else if (annotationPreview) drawAnnotationText(annotationPreview, "#2563eb");
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
    pngExportCommand?.drawOverlay(ctx, viewport.scale);
    resetCanvasStrokeState();
    ctx.restore();
    resetCanvasStrokeState();
  }

  const selectionRectangle = window.SelectionRectangle.create({
    rectFromPoints, hypot2, viewScale: () => viewport.scale,
    releasePointer: (id) => { try { canvas.releasePointerCapture(id); } catch (_) {} },
    clearSelection, selectByRect, addSketchProjectionSourcesByRect,
    addInstanceSourcesByRect: (rect, crossing) => {
      if (mode === "instance-sources" && instanceSourceCommand.instance?.type === "sketchProjection") {
        const entries = sketchProjectionEntriesByRect(rect, crossing);
        instanceSourceCommand.addSources(entries.map(entry => entry.item));
      } else {
        const items = rectangleSelectionQuery.readProjection(rect, crossing, {
          points: allGeometryPoints, lines: allGeometryLines, circles: allGeometryCircles,
          arcs: allGeometryArcs, splines: allGeometrySplines, hatches: allHatches,
        }, item => elementSketchId(item) === activeSketchId() && isVisibleSketchElement(item) ? item : null);
        (mode === "instance-sources" ? instanceSourceCommand : geometryInstanceCommand).addSources(items);
      }
    }, setHint, updateGeometrySelectionUI, draw,
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
      const highlighted = canvasSelection.inspectionContains(c) || c === canvasHover.current.dimension || canvasSelection.constraintSelectedInCanvas(c) || c === dimensionDrag.constraint;
      const label = dimensionLabelForConstraint(c, target, dimension);
      const editing = pendingCommandSession.current?.type === "distance-value" && pendingCommandSession.current.constraint === c;
      const colorOverride = !pngRender && viewState.constraintStatus && !isActiveSketchConstraint(c) ? INACTIVE_CONSTRAINT_STATUS_COLOR : null;
      ctx.save();
      drawDimension(target, dimension, label, false, !pngRender && (highlighted || editing), !pngRender && editing ? { hidden: true } : null, colorOverride, sketchId, !pngRender && dimensionUsesExpression(c));
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

  function effectiveLeaderAppearanceForSketch(sketch) {
    return window.Appearance.resolveLeaderAppearance(documentModel.defaultLeaderAppearance, documentModel.defaultTerminatorAppearance, sketch?.leaderAppearance);
  }

  function effectiveAnnotationStyle(element) {
    if (element?.type !== "leader" && !element?.appearanceInheritance) return normalizeAnnotationStyle(element?.style);
    const source = element.localElement || element;
    const sketches = element.blockDefinition?.sketches || model.sketches;
    const sketch = sketches.find(item => item.id === source.sketchId);
    const direct = source.appearanceInheritance ? source.style : {
      ...normalizeAnnotationStyle(source.style), ...window.Appearance.annotationDisplaySettings(source.style), rotation: Number(source.rotation) || 0
    };
    const style = window.Appearance.resolveLeaderAppearance(documentModel.defaultLeaderAppearance, documentModel.defaultTerminatorAppearance, sketch?.leaderAppearance, direct);
    Object.assign(style, { precision: normalizeAnnotationStyle(source.style).precision, prefix: String(source.style?.prefix || ""), suffix: String(source.style?.suffix || "") });
    for (const override of element.blockAppearanceOverrides || []) {
      const normalized = normalizeAppearance(override);
      if (normalized.color) style.color = normalized.color;
      if (normalized.lineWidth != null) style.lineWidth = normalized.lineWidth;
    }
    return style;
  }

  function annotationDisplayColor(element, style = effectiveAnnotationStyle(element)) {
    if (pngRender) return canvasThemeColor(style.color);
    if (canvasSelection.annotations.includes(element) || canvasSelection.inspectionContains(element) || canvasSelection.inspectionContains(element.blockInstance)) return canvasThemeColor("#2563eb");
    if (element === canvasHover.current.annotation) return canvasThemeColor("#0ea5e9");
    return canvasThemeColor(style.color);
  }






  function annotationById(id) {
    return id ? model.annotations.find((element) => element.id === id) || null : null;
  }

  const annotationDrag = window.AnnotationDrag.create({
    canEdit: item => guardSketchEdit(item.sketchId),
    beginConstrainedDrag: beginConstrainedAnnotationDrag,
    annotationById, canvasSelection, setHint, updateUI, draw, recordHistory, annotationLeaderDisplayGeometry,
    annotationTextLayout, effectiveAnnotationStyle, materializeAnchor: materializeAnnotationAnchor,
    resizeText: (item, height) => appearanceEditing.applyAnnotationStyleValue(item, "textHeight", height),
    beginPointer: (id) => { canvas.setPointerCapture(id); canvas.classList.add("is-dragging"); },
    endPointer: (id) => { canvas.classList.remove("is-dragging"); try { canvas.releasePointerCapture(id); } catch (_) {} },
  });
  const { begin: beginAnnotationDrag, update: updateAnnotationDrag } = annotationDrag;

  function drawDimensionPreview() {
    if (pendingCommandSession.current?.type === "fillet-radius-place") {
      const geometry = pendingCommandSession.current.preview;
      if (!geometry.ok) return;
      const primitive = {
        id: "R",
        center: geometry.center,
        radius: () => geometry.radius,
      };
      const target = { kind: "radius", primitive, value: geometry.radius };
      const anchor = pendingCommandSession.current.pointer || {
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
    if (!pendingCommandSession.current?.type?.startsWith("distance")) return;
    const dimension =
      pendingCommandSession.current.type === "distance-place"
        ? pendingCommandSession.current.dimension || applyDefaultCircleDimensionLabelOffset(pendingCommandSession.current.target, pendingCommandSession.current.pointer ? dimensionFromAnchor(pendingCommandSession.current.target, pendingCommandSession.current.pointer) : defaultDimensionForTarget(pendingCommandSession.current.target))
        : pendingCommandSession.current.dimension;
    if (pendingCommandSession.current.type === "distance-value") {
      let value = NaN;
      let invalid = false;
      try {
        value = evaluateDimensionExpressionDraft(pendingCommandSession.current.constraint || null, pendingCommandSession.current.buffer);
        invalid = value <= 0 || (pendingCommandSession.current.target.kind === "angle" && value >= 180);
      } catch (_error) {
        invalid = true;
      }
      const suffix = pendingCommandSession.current.target.kind === "angle" ? "°" : "";
      drawDimension(pendingCommandSession.current.target, dimension, `${Number.isFinite(value) ? formatDisplayNumber(value) : "_"}${suffix}|`, true, false, {
        selecting: !pendingCommandSession.current.editing,
        invalid,
        hidden: true,
      });
      return;
    }
    const previewTarget =
      pendingCommandSession.current.target.kind === "point-point" && (dimension.axis === "x" || dimension.axis === "y")
        ? { ...pendingCommandSession.current.target, dimensionAxis: dimension.axis }
        : pendingCommandSession.current.target;
    const previewValue =
      previewTarget.kind === "point-point" && previewTarget.dimensionAxis === "x"
        ? Math.abs(previewTarget.p2.x - previewTarget.p1.x)
        : previewTarget.kind === "point-point" && previewTarget.dimensionAxis === "y"
          ? Math.abs(previewTarget.p2.y - previewTarget.p1.y)
          : previewTarget.kind === "angle"
            ? angleDegrees(angleDimensionAngles(previewTarget, pendingCommandSession.current.pointer || dimensionAnchor(previewTarget, dimension), dimension).signed)
          : previewTarget.value;
    const label = previewTarget.kind === "angle" ? formatDimensionLabel(previewValue, "°") : formatDimensionLabel(previewValue);
    drawDimension(previewTarget, dimensionWithLabelAt(previewTarget, dimension, pendingCommandSession.current.pointer), label, true);
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

  function selectedVisibilityTargets() { return propertySelection.visibilityTargets(); }
  function selectionVisibilityIsHidden(targets) { return propertySelection.visibilityIsHidden(targets); }
  function toggleSelectedVisibility() { return selectionVisibilityCommand.toggle(); }

  const toolbarView = window.ToolbarView.create({
    document, isGeometryMode, constructionToggleState,
    readInteraction: () => ({ mode, hasPending: Boolean(pendingCommandSession.current), hasConstraint: Boolean(constraintTargetSession.command),
      annotationDraft: Boolean(pendingCommandSession.current?.annotationDraft), pendingType: pendingCommandSession.current?.type,
      constraintType: constraintTargetSession.command?.type, splineEditing: Boolean(splineEditing.current) }),
    updateHistoryButtons, selectedVisibilityTargets, selectionVisibilityIsHidden,
    canEditTarget: target => canEditSketch(target.kind === "constraint" ? constraintSketchId(target.item) : elementSketchId(target.item)),
    syncFlyouts: () => toolFlyouts?.sync(), updateCursor: commandCursor.update,
  });
  function updateToolbar() { toolbarView.update(); }

  function constructionToggleState(geometryMode = isGeometryMode()) { return constructionCommand.state(geometryMode); }

  const constraintSelectionQuery = window.ConstraintSelectionQuery.create({
    session: constraintTargetSession, selection: canvasSelection, candidates: constraintCandidates,
    resolveConstraintIntent, constraintOperandsFromSelection, activeSketchId, isGeometryMode,
    elementSketchId, canEditSketch, findLineFixedConstraint, selectedGeometryItems,
  });
  function canApplyConstraint(type) { return constraintSelectionQuery.canApply(type); }

  function canCompleteConstraintCommand(type) { return constraintSelectionQuery.canComplete(type); }

  function constraintLabel(type) {
    if (type === "fixed") return applicationText("固定", "Fix");
    const btn = constraintButtons.find((b) => b.dataset.constraint === type);
    return btn?.dataset.label || btn?.title || type;
  }

  function constraintTargetHint(type) { return constraintFeedback.targetHint(type, constraintTargetSession.operands, applicationSettings.language, () => constraintLabel(type)); }
  function invalidConstraintTargetHint(type) { return constraintFeedback.invalidTargetHint(type, constraintTargetSession.operands, applicationSettings.language); }

  const constraintTargetCommand = window.ConstraintTargetCommand.create({
    session: constraintTargetSession, startAnnotationAnchorConstraint,
    canStart: () => guardSketchEdit(activeSketchId(), "create") && guardSelectionEdit("constraint"),
    prepareStart: () => {
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
    },
    prepareCancel: () => { if (mode === "centerline") resetCenterlineCommandState(); if (mode === "slot") resetSlotCommandState(); },
    constraintLabel, clearSelection, constraintOperandsFromSelection, trimConstraintSelection,
    resolveConstraintIntent, startDistanceResolution, commitConstraintResolution, syncSelectionFromConstraintOperands,
    updateToolbar, updateConstraintButtons, setHint, constraintTargetHint, draw,
    blurConstraintControl: () => { if (document.activeElement instanceof HTMLElement && document.activeElement.matches("[data-constraint], #fixPointBtn")) document.activeElement.blur(); },
    canCompleteConstraintCommand, distanceTargetFromSelection, startDistanceCommand, addConstraint,
    annotationAnchorConstraints, hitConstraintOperand, invalidConstraintTargetHint,
    toggleGeometryFixedOperand, toggleSelectedFixed, updateGeometrySelectionUI, startDistanceValueInput, types: { Circle, Arc },
  });
  function startConstraintTargetCommand(type) { return constraintTargetCommand.start(type); }
  function cancelConstraintTargetCommand(message) { return constraintTargetCommand.cancel(message); }
  function executeConstraintCommandIfReady() { return constraintTargetCommand.complete(); }
  function completePendingDimensionLineLength() { return constraintTargetCommand.completeLineLength(); }

  function hitConstraintOperand(pointer, type, hits = {}) { return queryConstraintOperand(pointer, type, constraintTargetSession.operands, hits); }

  function handleConstraintOperandClick(pointer, type, hits = {}) { return constraintTargetCommand.operandClick(pointer, type, hits); }

  function handleConstraintTargetDoubleClick(hitP, hitL, pointer) { return dimensionPlacementCommand.targetDoubleClick(hitP, hitL, pointer); }

  const dimensionPlacementCommand = window.DimensionPlacementCommand.create({
    session: constraintTargetSession, selection: canvasSelection, getPending: pendingCommandSession.read, setPending: pendingCommandSession.replace,
    canStart: () => guardSketchEdit(activeSketchId(), "create") && guardSelectionEdit("constraint"),
    prepareStart: () => {
      mode = "select";
      lineCommand.reset(); rectangleCommand.reset(); filletCommand.reset(); circularCommands.resetCircle();
      resetArcCommandState(); drawingPreview.reset();
    },
    selectMode: () => { mode = "select"; },
    constraintOperandsFromSelection, constraintResolutionFromCurrentSelection, selectedPrimitives,
    placement: dimensionPlacement, angleDegrees, angleDimensionAngles, readOnlyDimensionConstraintForPlacement,
    addReadOnlyDimensionConstraint, activeSketchId, syncSelectionFromConstraintOperands,
    makeConstraintOperand, hitConstraintOperand, sameConstraintOperand, resolveConstraintIntent,
    hideDimensionValueInput, syncDimensionValueInput, focusDimensionValueInput,
    applicationText, setHint, log, updateConstraintButtons, updateToolbar, draw,
  });
  function startDistanceCommand() { return dimensionPlacementCommand.startDistanceCommand(); }

  function startPrimitiveDimensionCommand(kind) { return dimensionPlacementCommand.startPrimitiveDimensionCommand(kind); }

  function cancelPendingCommand(message) { return pendingCommandSession.cancel(message); }

  function startDistanceValueInput(pointer) { return dimensionPlacementCommand.startDistanceValueInput(pointer); }

  function retargetDistancePlaceWithOperand(pointer, hits = {}) { return dimensionPlacementCommand.retargetDistancePlaceWithOperand(pointer, hits); }

  const pendingDimensionHover = window.ConstraintCommandInput.createRetargetHover({
    getPending: pendingCommandSession.read, canvasHover, hitConstraintOperand, sameConstraintOperand,
    resolveConstraintIntent, referenceTargetFromOperand, Circle, Arc,
  });
  function updatePendingDistanceRetargetHover(pointer) { return pendingDimensionHover.update(pointer); }

  function startDimensionEditInput(hit) { return dimensionValueCommand.startEdit(hit); }

  function sketchHasDimensionConstraint(sketchId = activeSketchId()) {
    return model.constraints.some((constraint) => constraintSketchId(constraint) === sketchId && constraint.dimension);
  }

  function selectedFixedBatchTargets() { return constraintSelectionQuery.fixedBatch(); }
  function fixedBatchIsFullyFixed(batch) { return constraintSelectionQuery.fullyFixed(batch); }
  const constraintControlsView = window.ConstraintControlsView.create({
    document, constraintButtons, constraintMenuButtons, fixPointBtn, isGeometryMode,
    prepareGeometryControls: () => {
      if (pendingCommandSession.current?.type?.startsWith("distance")) {
        const target = distanceTargetFromSelection();
        if (!target || target.kind === "invalid") cancelPendingCommand("寸法入力をキャンセルしました");
      }
    },
    getCommandType: () => constraintTargetSession.command?.type,
    fixedToggleAllowed: constraintSelectionQuery.fixedToggleAllowed, hasSelection, translatedExactText, applicationText,
  });
  function updateConstraintButtons() { constraintControlsView.update(); }

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
    pendingCommandSession.clear();
    constraintTargetSession.clearCommand();
    sketchProjectionCommand.reset();
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
  const { createSketch, activate: setActiveSketch, rename: renameSketchCommand, toggleVisibility: toggleSketchVisibilityCommand } = sketchCommand;
  function renameSketch(id) { if (guardSketchEdit(id)) return renameSketchCommand(id); }
  function toggleSketchVisibility(id) { return toggleSketchVisibilityCommand(id); }
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
    return window.AnnotationAnchorConstraints.refs(annotation).some(ref => {
      const id = geometryRefId(ref), key = geometryRefKey(ref);
      return Boolean((id && removedIds.has(id)) || (key && removedKeys.has(key)));
    });
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
    objectVisible: (category, entry) => !selectionVisibilityIsHidden([{
      kind: category === "constraint" ? "constraint" : ["point", "line", "circle", "arc", "spline"].includes(category) ? "geometry"
        : category === "instance" ? "geometryInstance" : category,
      item: category === "constraint" ? entry.constraint : entry,
    }]),
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
    sketchTreeView, updateSketchUI, toggleSketchVisibility, toggleSketchLock, guardSketchEdit, selectionSketchId, renameSketch, deleteSketch, deleteElements, deleteCurrentSelection, toggleSelectedVisibility,
    hover: { canvasHover, setSidebarHover, clearSidebarHover, sidebarHoverElementsForItem, sidebarHoverElementsForConstraint, elementSketchId, ROOT_SKETCH_ID },
    resolveSelectionEntry: sketchTreeObjects.resolveSelectionEntry,
    move: { active: () => sketchMoveCommand.active, choose: sketchMoveCommand.choose, commit: sketchMoveCommand.commit, cancel: sketchMoveCommand.cancel },
    updateSelectionUI: updateGeometrySelectionUI,
    openContextMenu: (event, id) => {
      closeCanvasContextMenu();
      if (isRootSketch(sketchById(id))) { sketchContextController.close(); return; }
      sketchContextController.open({ event, target: { id }, items: [{ action: "sketch-edit", label: applicationText("作図先", "Drawing sketch"), disabled: id === activeSketchId() },
        { action: "sketch-rename", label: applicationText("名前変更", "Rename"), disabled: Boolean(sketchById(id)?.locked) }] });
    },
    unfixPoint: point => { if (!guardSketchEdit(elementSketchId(point), "constraint")) return; point.fixed = false; solveAndRefresh(`固定解除 ${point.id}`); },
  });
  const { refreshSelection: updateSketchTreeSelectionState, render: updateSketchUIUnprofiled, applyWidth: applySketchTreeWidth } = sketchTreeView;
  sketchContextController = window.CanvasContextMenu.create({
    document, window, canvas: document.getElementById("sketchList"), menu: document.getElementById("sketchContextMenu"),
    escapeHtml, applicationText, ariaLabel: () => applicationText("スケッチメニュー", "Sketch menu"),
    onOpen: event => sketchTreeController.contextMenu(event),
    onAction: (action, target) => {
      if (action === "sketch-rename") renameSketch(target.id);
      else if (action === "sketch-edit") sketchTreeController.editSketch(target.id);
    },
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
    annotationDrag.syncResizeSelection(mode === "select" && !pendingCommandSession.current && !constraintTargetSession.command);
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
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) || input.readOnly || input.disabled) return null;
    if (input.matches('#commandPanel [data-setting="expression"]') || input.id === "annotationValueInput" && input.dataset.expression === "true") return { input, namespace: model };
    if (input === dimensionValueInput && pendingCommandSession.current?.type === "distance-value") return { input, namespace: model };
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
    // Programmatic insertion alone does not make the browser emit change on blur.
    let changed = false;
    const onChange = () => { changed = true; };
    input.addEventListener("change", onChange, { once: true });
    input.addEventListener("blur", () => {
      if (!changed && input.isConnected) input.dispatchEvent(new Event("change", { bubbles: true }));
      input.removeEventListener("change", onChange);
    }, { once: true });
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

  function insertClickedAnnotationParameter(event, annotationHit) {
    const context = focusedExpressionInputContext();
    const item = annotationHit?.element;
    if (!context || !item?.parameterEnabled || !item.parameterName || !model.annotations.includes(item)) return false;
    event.preventDefault();
    event.stopPropagation();
    if (context.namespace !== model) {
      const message = applicationText("表示中のCanvasと異なる名前空間のため、この注記は参照できません", "This annotation cannot be referenced because the canvas shows a different namespace.");
      setParameterDialogError(message);
      setHint(message, "error");
      return true;
    }
    insertIdentifierIntoExpressionInput(context.input, item.parameterName);
    setParameterDialogError("");
    setHint(applicationSettings.language === "en" ? `Inserted ${item.parameterName}.` : `${item.parameterName} を挿入しました`);
    return true;
  }

  function effectiveConstructionAppearanceForSketch(...args) { return geometryAppearance.effectiveConstructionAppearanceForSketch(...args); }
  function effectiveDimensionAppearanceForSketch(sketch) {
    return resolveDimensionAppearance({ ...documentModel.defaultDimensionAppearance, ...documentModel.defaultTerminatorAppearance },
      sketch && !isRootSketch(sketch) ? sketch.dimensionAppearance : null);
  }

  function effectiveAppearanceForSketch(...args) { return geometryAppearance.effectiveAppearanceForSketch(...args); }








  const MULTIPLE_PROPERTY_MIXED = window.PropertySelection.mixedValue;
  const propertySelection = window.PropertySelection.create({
    Point, Line, canvasSelection,
    getOperation: () => ({ mode, instanceSourceEdit: instanceSourceCommand.current, freeInstancePlacement: geometryInstanceCommand.pending, blockPlacementDefinitionId: blockPlacementCommand.definitionId }),
    effectiveSelectedConstraint, selectedGeometryItems, blockDefinitionById, sketchById, activeSketchId,
    blockProjectionBundle, effectiveAppearanceForElement, documentModel, normalizeAppearance,
    hatchAppearanceForDisplay, normalizeAnnotationStyle, effectiveAnnotationStyle, effectiveDimensionAppearance,
    isRootSketch, isDimensionConstraint, geometryInstanceBundle, resolveGeometryAppearance,
  });
  const { selectedPropertiesTarget: resolvePropertiesTarget, multiplePropertyTypeKey, multiplePropertySameType, blockPropertyAppearance, multiplePropertyAppearance, multiplePropertySupports, multiplePropertyValue } = propertySelection;
  function selectedPropertiesTarget() {
    const target = resolvePropertiesTarget();
    const items = target.kind === "multiple" ? target.items.map(entry => entry.item) : [target.item];
    const locked = items.some(item => sketchById(target.kind === "sketch" ? item?.id : item?.sketchId)?.locked);
    const ownerId = target.kind === "sketch" ? target.item?.id : items[0]?.sketchId;
    return { ...target, readOnly: target.readOnly || locked, locked,
      owningSketchLabel: ownerId ? `${sketchName(ownerId)} (${ownerId})` : null,
      drawingSketchLabel: `${sketchName(activeSketchId())} (${activeSketchId()})` };
  }
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
    materializeAnchor: materializeAnnotationAnchor,
    editing: appearanceEditing, viewport, effectiveAnnotationStyle, effectiveLeaderAppearanceForSketch, normalizeHatchAppearance, normalizeAnnotationStyle,
    invalidateBlockProjectionCache, recordHistory, updateUI, updatePropertiesUI, draw,
  });
  const { owner: appearanceOwnerForPropertiesTarget } = appearancePropertyCommand;

  const { apply: applyMultipleProperty } = window.BulkPropertyCommand.create({
    appearancePropertyCommand,
    viewport,
    guardSketchProjectionShapeEdit, applicationText, updatePropertiesUI, draw,
    multiplePropertySupports, applyDimensionAppearanceValue, applyAnnotationStyleValue, normalizeHatchAppearance, applyAppearanceInput,
    invalidateBlockProjectionCache, synchronizeSketchProjectionMetadata, recordHistory, updateUI,
  });
  const selectionVisibilityCommand = window.SelectionVisibilityCommand.create({
    isGeometryMode, selectedVisibilityTargets, selectionVisibilityIsHidden, toggleSketchVisibility, guardSelectionEdit,
    applyMultipleProperty, applyAppearance: appearancePropertyCommand.apply, recordHistory, updateUI, draw,
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
    constraintDefiningGeometryEntries, normalizeAnnotationStyle, effectiveAnnotationStyle, leaderAppearancePropertyRows: appearanceControls.leaderAppearancePropertyRows
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
  const elementPropertyCommand = window.ElementPropertyCommand.create({ recordHistory, updateUI, updatePropertiesUI, draw, materializeAnchor: materializeAnnotationAnchor });
  const propertiesController = window.PropertiesController.create({
    HTMLTextAreaElement, HTMLInputElement, Spline, selectedPropertiesTarget, activeSketchId,
    canEditStructure: item => guardSketchEdit(elementSketchId(item), "structure"),
    elementPropertyCommand, appearancePropertyCommand, geometryPropertyCommand, applyMultipleProperty,
    changeFreeInstanceProperty, commitDimensionPropertyEdit, commitAnnotationParameterEdit, updateUI, updatePropertiesUI, draw,
    applicationText, setHint,
    setPlacementRotationLocked: blockPlacementCommand.setRotationLocked,
    setPlacementSketchIds: blockPlacementCommand.setEnabledSketchIds,
    setBlockInstanceRotationLocked, setBlockInstanceEnabledSketchIds, setBlockInstanceOrthogonalRotation,
    annotationCommand, startInstanceSourceEdit, startReferenceImageCalibration, startHatchBoundaryRepair,
    startSplineEdit: spline => splineEditing.activate(spline), openAppearanceColorPalette,
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
    effectiveDimensionAppearanceForSketch, effectiveLeaderAppearanceForSketch, blockDefinitionSketchRows,
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
    if (command) command.textContent = pendingCommandSession.current?.type?.startsWith("annotation-") ? applicationText("注記", "Annotation") : constraintTargetSession.command ? applicationText("拘束", "Constraint") : modeLabels[mode] || mode;
  }

  function updateUI({ refreshAnalysis = true } = {}) {
    if (!interactionProfiler.active) return updateUIUnprofiled({ refreshAnalysis });
    return profileInteractionWork("ui", () => updateUIUnprofiled({ refreshAnalysis }));
  }

  function updateUIUnprofiled({ refreshAnalysis = true } = {}) {
    annotationDrag.syncResizeSelection(mode === "select" && !pendingCommandSession.current && !constraintTargetSession.command);
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

  const constraintSolvePreparation = window.ConstraintSolvePreparation.create({
    solver, types: { Line, Arc, ArcEndpointOnLineConstraint, ArcEndpointCoincidentConstraint,
      ArcEndpointArcEndpointCoincidentConstraint, OffsetConstraint, OffsetChainConstraint },
    hasDirectRadiusDimension, unwrapAngleNear, hypot2, arcEndpointPoint, lineNormal, offsetChainDraft, vectorNorm,
    minimumOrientationLength: MIN_ORIENTATION_LENGTH, minimumLineLength: MIN_LINE_LENGTH,
  });
  function preconditionNewConstraint(constraint) { return constraintSolvePreparation.precondition(constraint); }
  function solveStepNormForConstraint(constraint) { return constraintSolvePreparation.stepNorm(constraint); }
  function withTemporarySolveStepNorm(stepNorm, callback) { return constraintSolvePreparation.withStepNorm(stepNorm, callback); }

  function addReadOnlyDimensionConstraint(...args) { return constraintCommitCommand.readOnly(...args); }

  const constraintCommitCommand = window.ConstraintCommitCommand.create({
    guardSketchEdit, activeSketchId, constraintTargetsAreActive, snapshotModelState, restoreModelState,
    solveStepNormForConstraint, pushModelConstraint, preconditionNewConstraint, withTemporarySolveStepNorm,
    solveConstraintComponentAndDependents, isDimensionConstraint, isReadOnlyDimension, stabilizeActiveParameterNamespace,
    constraintSketchId, lineCollapseQuery, redundantConstraintInfo, acceptError: CONSTRAINT_ACCEPT_ERROR,
    targetFromConstraint, measuredConstraintTargetValue, startDistanceResolution, distanceConstraintFromTarget,
    clearSelection, refreshConstraintAnalysis, updateUI, draw, setHint, log,
    recordHistory, applicationText, isReferenceSourceSketchId, descendantSketchIds, wouldCreateReferenceCycle,
    sketchName, now: () => performance.now(), recordPerformance: trace => { lastAuthoringPerformance = trace; },
  });
  function commitNewConstraint(...args) { return constraintCommitCommand.ordinary(...args); }
  function commitReferenceConstraint(...args) { return constraintCommitCommand.reference(...args); }
  function markReferenceConstraint(...args) { return constraintCommitCommand.markReference(...args); }

  const constraintIntentResolver = window.ConstraintIntentResolver.create({
    candidates: constraintCandidates, operands: constraintOperandValues,
    types: { PointOnSplineConstraint, SplineLineTangentConstraint, SplineSplineTangentConstraint },
    activeSketchId, isReferenceSourceSketchId, wouldCreateReferenceCycle,
    isActiveSketchElement, isEditableSketchElement, descendantSketchIds, applicationText, invalidConstraintTargetHint,
  });
  function resolveConstraintIntent(type, operands) { return constraintIntentResolver.resolve(type, operands); }

  function constraintResolutionFromCurrentSelection(type) { return constraintSelectionQuery.resolution(type); }

  function startDistanceResolution(resolution, pointer) { return dimensionPlacementCommand.startDistanceResolution(resolution, pointer); }

  function commitConstraintResolution(...args) { return constraintCommitCommand.resolution(...args); }

  const dimensionConstraintFactory = window.DimensionConstraintFactory.create({
    types: { PointAxisDistanceConstraint, DistanceConstraint, PointLineDistanceConstraint, LineLineDistanceConstraint,
      LineCircleDistanceConstraint, ConcentricRadiusDifferenceConstraint, LineAngleConstraint, RadiusConstraint, DiameterConstraint },
    linesAreParallel,
  });
  function distanceConstraintFromTarget(target, value, dimension, options = {}) {
    const result = dimensionConstraintFactory.fromTarget(target, value, dimension);
    if (result.error && !options.silent) { setHint(result.error, "error"); log(result.error); }
    return result.constraint;
  }

  const dimensionReadOnlyQuery = window.DimensionReadOnlyQuery.create({
    fromTarget: dimensionConstraintFactory.fromTarget, activeSketchId, assignSketch: assignConstraintSketchId,
    markReference: markReferenceConstraint, probeRedundancy: constraintRedundancy.probeCandidate,
    targetItems: window.DimensionQueries.targetItems,
  });
  function readOnlyDimensionConstraintForPlacement(target, value, dimension, options = {}) {
    return dimensionReadOnlyQuery.forPlacement(target, value, dimension, options);
  }

  function addDistanceConstraintFromTarget(...args) { return constraintCommitCommand.dimension(...args); }

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
    canEdit: id => guardSketchEdit(id),
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

  function beginConstrainedAnnotationDrag(event, annotation, pointer) {
    if (!annotation.anchorConstraints?.length) return false;
    if (annotation.anchorConstraints.some(item => item.type === "fixed")) {
      setHint(applicationText("注記の基準点が固定されているため移動できません", "The annotation anchor is fixed and cannot be moved."), "error"); return true;
    }
    const geometry = window.AnnotationAnchorConstraints.createDragGeometry(annotation, annotationPlacementAnchor(annotation), resolveGeometryRef);
    if (!geometry.valid) { setHint(applicationText("注記の拘束先を解決できません", "The annotation constraint target could not be resolved."), "error"); return true; }
    annotationSolveDrag = geometry;
    const plan = buildDragSession("point", geometry.point, pointer);
    if (!plan) { annotationSolveDrag = null; return true; }
    plan.syncAnnotation = () => {
      if (annotation.type === "leader") {
        const display = annotationLeaderDisplayGeometry(annotation), start = annotationLeaderAnchor(annotation) || annotation.start;
        annotation.x = annotation.start.x + (geometry.point.x - start.x) / display.shelfScale;
        annotation.y = annotation.start.y + (geometry.point.y - start.y) / display.shelfScale;
      } else { annotation.x = geometry.point.x; annotation.y = geometry.point.y; }
    };
    plan.onEnd = () => { annotationSolveDrag = null; constraintAnalysis.invalidate(); updateUI(); draw(); };
    if (!geometryDrag.begin(event, plan)) { annotationSolveDrag = null; return true; }
    setHint(applicationText("注記の基準点と図形を拘束を保ちながら移動中", "Moving the annotation anchor and geometry while maintaining constraints"));
    return true;
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
    if (!guardSketchEdit(hit.instance.sketchId)) return;
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

  const dimensionLineGroup = window.DimensionLineGroup.create({ placement: dimensionPlacement, Line });
  function selectedDimensionLineGroup(reference) {
    const constraints = canvasSelection.dimensionConstraints;
    if (constraints.some(constraint => !model.constraints.includes(constraint) || !isEditableSketchId(constraintSketchId(constraint))
      || !isVisibleSketchId(constraintSketchId(constraint)))) return null;
    const entries = constraints.map(constraint => ({ constraint, target: targetFromConstraint(constraint) }));
    if (entries.some(({ constraint, target }) => !target || !isVisibleValue(effectiveDimensionAppearance(
      constraint.dimension || defaultDimensionForTarget(target), constraintSketchId(constraint)).visible))) return null;
    return dimensionLineGroup.group(entries, reference);
  }

  const dimensionDrag = window.DimensionDrag.create({
    canEdit: item => guardSketchEdit(constraintSketchId(item)),
    selectedLineGroup: selectedDimensionLineGroup, translateLineGroup: dimensionLineGroup.translate,
    dimensionAnchor, migrateAngleDimensionLabelPlacement, canvasSelection, angleDimensionLabelOffsets,
    viewScale: () => viewport.scale, isDimensionConstraintCommandActive, setHint, clearSnap, hypot2,
    beginPointer: (id) => { canvas.classList.add("is-dragging"); canvas.setPointerCapture(id); },
    endPointer: (id) => { canvas.classList.remove("is-dragging"); try { canvas.releasePointerCapture(id); } catch (_) {} },
    angleDimensionFromLabelPoint, dimensionWithLabelAt, dimensionFromAnchor, setAngleDimensionLabelOffsets,
    syncAngleConstraintFromDimension, draw, updateUI, updateGeometrySelectionUI, syncDimensionValueInput, recordHistory,
    continueCommandClick: (event, hits) => {
      canvasHover.update({ dimension: null });
      const pointer = canvasPoint(event);
      if (pendingCommandSession.current?.type === "distance-place") {
        if (!retargetDistancePlaceWithOperand(pointer, hits)) startDistanceValueInput(pointer);
      } else if (constraintTargetSession.command?.type === "distance") {
        handleConstraintOperandClick(pointer, "distance", hits);
      }
    },
  });
  const { begin: beginDimensionDrag } = dimensionDrag;

  function isDimensionConstraintCommandActive() {
    return constraintTargetSession.command?.type === "distance" && pendingCommandSession.current?.type !== "distance-value";
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
    const identity = hitSketchIdentityElement(pointer.x, pointer.y, { allowInactiveGeometry: true });
    if (!guardSketchEdit(identity?.sketchId || activeSketchId(), "structure")) return false;
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
    selectionScope: { sketch: isVisibleSketchId, element: isVisibleSketchElement },
    hitReferenceImageAt, isVisibleValue,
    currentScope: workspace.current, viewportScale: () => viewport.scale,
    canvasContextPointIsSelectable, editedFitPoints: () => splineEditing.current?.spline?.fitPoints,
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

  const canvasCommandCancellation = window.CanvasCommandCancellation.create({
    readMode: () => mode, selectMode: () => { mode = "select"; }, blockPlacementCommand, drawingPreview, restoreBlockPlacementPropertiesPanel,
    readPending: pendingCommandSession.read, cancelPendingCommand, readConstraintCommand: () => constraintTargetSession.command, cancelConstraintTargetCommand,
    drawing: { active: hasActiveDrawOperation, cancel: cancelActiveDrawOperation, isToolMode: isDrawToolMode, exit: exitDrawMode },
    applicationText, setHint, updateUI, draw,
  });
  function hasCancellableCanvasCommand() { return canvasCommandCancellation.hasCancellable(); }
  function cancelCanvasCommandFromContextMenu() { return canvasCommandCancellation.cancel(); }

  function hasCopyableCanvasSelection() {
    const hasSelectionItems = canvasSelection.points.some((item) => model.points.includes(item)) ||
      canvasSelection.lines.some((item) => model.lines.includes(item)) ||
      canvasSelection.circles.some((item) => model.circles.includes(item)) ||
      canvasSelection.arcs.some((item) => model.arcs.includes(item)) ||
      canvasSelection.splines.some((item) => model.splines.includes(item)) ||
      canvasSelection.blockInstances.some((item) => model.blockInstances.includes(item)) ||
      canvasSelection.annotations.some((item) => model.annotations.includes(item)) ||
      canvasSelection.hatches.some((item) => model.hatches.includes(item)) ||
      canvasSelection.referenceImages.some(item => model.referenceImages.includes(item));
    if (!hasSelectionItems) return false;
    const selectedGeometryRefs = new Set([
      ...canvasSelection.lines.map((item) => `line:${item.id}`),
      ...canvasSelection.circles.map((item) => `circle:${item.id}`),
      ...canvasSelection.arcs.map((item) => `arc:${item.id}`),
      ...canvasSelection.splines.map((item) => `spline:${item.id}`),
    ]);
    if (!canvasSelection.hatches.every((hatch) => hatchBoundaryGeometryRefs(hatch.boundaryLoops).every((ref) => selectedGeometryRefs.has(`${ref.kind}:${geometryRefId(ref)}`)))) return false;
    return true;
  }

  function selectedDrawingOrderCandidates() {
    return [
      ...canvasSelection.lines, ...canvasSelection.circles, ...canvasSelection.arcs, ...canvasSelection.splines,
      ...canvasSelection.hatches, ...canvasSelection.blockInstances, ...canvasSelection.geometryInstances,
    ];
  }

  function topmostDrawingOrderOwner(items) {
    const active = window.DrawingOrder.topmostOwner(model, activeSketchId(), items);
    if (active || !ordinarySelectionMode()) return active;
    for (const sketch of [...model.sketches].reverse()) {
      const owner = window.DrawingOrder.topmostOwner(model, sketch.id, items);
      if (owner) return owner;
    }
    return null;
  }

  function drawingOrderCommandState() {
    return window.DrawingOrder.commandState(model, selectionSketchId() || activeSketchId(), selectedDrawingOrderCandidates());
  }

  function reorderSelectedDrawingObjects(action) {
    if (!guardSelectionEdit()) return false;
    if (!window.DrawingOrder.reorder(model, selectionSketchId() || activeSketchId(), selectedDrawingOrderCandidates(), action)) return false;
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
        groups.push([{ action: "sketch-projection-commit", label: applicationText("実行", "Execute"), shortcut: "Enter", disabled: sketchProjectionCommand.count === 0 }]);
      }
      groups.push([{ action: "cancel-command", label: applicationText("コマンドをキャンセル", "Cancel Command"), shortcut: "Esc" }]);
      groups.push([
        { action: "undo", label: applicationText("元に戻す", "Undo"), shortcut: "Ctrl+Z", disabled: Boolean(document.getElementById("undoBtn")?.disabled) },
        { action: "redo", label: applicationText("やり直す", "Redo"), shortcut: "Ctrl+Y", disabled: Boolean(document.getElementById("redoBtn")?.disabled) },
      ]);
    } else if (target.kind === "blank") {
      groups.push([{ action: "paste", label: applicationText("貼り付け", "Paste"), shortcut: "Ctrl+V", disabled: !canCreateInActiveSketch() }]);
      groups.push([
        { action: "undo", label: applicationText("元に戻す", "Undo"), shortcut: "Ctrl+Z", disabled: Boolean(document.getElementById("undoBtn")?.disabled) },
        { action: "redo", label: applicationText("やり直す", "Redo"), shortcut: "Ctrl+Y", disabled: Boolean(document.getElementById("redoBtn")?.disabled) },
      ]);
      groups.push([{ action: "fit-visible", label: applicationText("表示中図形へフィット", "Fit Visible Geometry"), disabled: !visibleGeometryBounds() }]);
    } else {
      const specific = [];
      if (["point", "line", "circle", "arc", "spline", "block", "hatch", "annotation", "image"].includes(target.kind)) {
        specific.push({ action: "sketch-move", label: applicationText("別スケッチへ移動…", "Move to Another Sketch…"), disabled: mode !== "select" || Boolean(pendingCommandSession.current || constraintTargetSession.command) });
      }
      const editingFitPoint = target.kind === "point" && Boolean(splineEditing.current?.spline?.fitPoints.includes(target.item));
      if (target.kind === "spline" && splineEditing.current?.spline === target.item) {
        specific.push({ action: "spline-fit-point-add", label: applicationText("通過点を追加", "Add Fit Point") });
      }
      if (editingFitPoint) {
        specific.push({ action: "spline-fit-point-delete", label: applicationText("通過点を削除", "Delete Fit Point"), disabled: splineEditing.current.spline.fitPoints.length <= 3, danger: true });
      }
      if (target.kind === "dimension") {
        specific.push({ action: "dimension-edit", label: applicationText("値 / 数式を編集", "Edit Value / Expression"), disabled: isReadOnlyDimension(target.item) });
        specific.push({ action: "dimension-align", label: applicationText("寸法線を揃える", "Align Dimension Lines"), disabled: !selectedDimensionLineGroup(target.item) });
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
    const commandType = constraintTargetSession.command?.type;
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
    const constraintCommandActive = Boolean(constraintTargetSession.command);
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
    const editsTarget = ["cut", "delete", "construction-toggle", "fix-toggle", "block-rotation-toggle", "dimension-edit", "dimension-align", "sketch-move", "hatch-repair", "drawing-front", "drawing-forward", "drawing-backward", "drawing-back", "spline-fit-point-add", "spline-fit-point-delete", "create-block"];
    if (editsTarget.includes(action) && (!guardSelectionEdit() || target?.item && !guardSketchEdit(elementSketchId(target.item)))) return;
    if (["fix-toggle", "hatch-repair", "spline-fit-point-add", "spline-fit-point-delete", "create-block"].includes(action)
      && !guardSketchEdit(target?.item ? elementSketchId(target.item) : selectionSketchId() || activeSketchId(), "structure")) return;
    if (action === "sketch-projection-commit") commitSketchProjectionCommand();
    else if (action === "cancel-command") cancelCanvasCommandFromContextMenu();
    else if (action === "undo") undoHistory();
    else if (action === "redo") redoHistory();
    else if (action === "cut") copySelectionToClipboard({ cut: true });
    else if (action === "copy") copySelectionToClipboard();
    else if (action === "paste") void imageClipboard.pasteFromMenu();
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
    else if (action === "dimension-align" && target?.item) {
      const group = selectedDimensionLineGroup(target.item);
      if (group && dimensionLineGroup.align(group)) {
        updateGeometrySelectionUI();
        draw();
        recordHistory(applicationText("寸法線整列", "Align dimension lines"));
        setHint(applicationText("基準の寸法線に揃えました", "Aligned to the reference dimension line."));
      }
    }
    else if (action === "sketch-move") sketchMoveCommand.start();
    else if (action === "hatch-repair" && target?.item) startHatchBoundaryRepair(target.item);
    else if (["drawing-front", "drawing-forward", "drawing-backward", "drawing-back"].includes(action)) reorderSelectedDrawingObjects(action);
    else if (action === "spline-fit-point-add" && target?.item && pointer) addSplineFitPointFromContext(target.item, pointer);
    else if (action === "spline-fit-point-delete" && target?.item && splineEditing.current?.spline) deleteSplineFitPointFromContext(splineEditing.current.spline, target.item);
    else if (action === "fit-visible") {
      if (fitVisibleGeometryToViewport()) setHint(applicationText("表示中の図形全体が見えるように調整しました", "Fitted all visible geometry."));
      else setHint(applicationText("表示中の図形がありません", "There is no visible geometry."), "error");
      draw();
    }
  }

  canvasContextController.start();

  const annotationCommandInput = window.AnnotationCommandInput.create({
    getMode: () => mode, getPending: pendingCommandSession.read, getPendingConstraint: () => constraintTargetSession.command,
    annotationCommand, canvasSelection, clearSelection, annotationDrag, updateUI, draw,
    startAnchorConstraint: startAnnotationAnchorConstraint,
    releasePanelFocus: () => { if (document.activeElement?.closest("#commandPanel")) document.activeElement.blur(); },
  });
  const constraintCommandInput = window.ConstraintCommandInput.create({
    canDragDimensionGroup: hit => Boolean(selectedDimensionLineGroup(hit.constraint)),
    getPending: pendingCommandSession.read, getPendingConstraint: () => constraintTargetSession.command, canvasSelection, canvasHover, isDimensionConstraintCommandActive,
    beginDimensionDrag, retargetDistancePlaceWithOperand, startDistanceValueInput, constraintTargetHint,
    handleConstraintOperandClick, setHint, updateGeometrySelectionUI, draw,
  });

  const instanceCommandInput = window.InstanceCommandInput.create({
    getMode: () => mode, instanceSourceCommand, geometryInstanceCommand, hitReferenceTarget, hitDerivedProjectionOperand,
    hitBlockProjectionOperand, operandElement, toggleSketchProjectionSource, clearSnap, selectionRectangle,
    hitHatch: p => hitHatchAt(p.x, p.y, { activeOnly: false }),
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
      hitDerivedGeometryForDrag, hitGeometryInstance, hitSketchIdentityElement, hitAnnotationElement, hitAnnotationTarget, activeSketchId },
  });
  const pointerHover = window.PointerHover.create({
    canvasHover, sameArcEndpoint, isActiveSketchConstraint,
    geometry: { hitEndpointPoint, hitExplicitPoint, hitLine, hitCircle, hitArcEndpoint, hitArc, hitSpline },
    scene: { hitDimension, hitDerivedProjectionOperand, hitBlockProjectionOperand, hitReferenceTarget, hitSketchIdentityElement,
      hitBlockInstance, hitGeometryInstance, hitAnnotationElement, hitHatchAt, hitReferenceImageAt,
      hitAnnotationInteraction: (x, y, anchorsOnly) => {
        const hit = hitAnnotationElement(x, y);
        return hit && !hit.element.blockProjection && (hit.part === "anchor" || !anchorsOnly && (["frame", "frame-enable"].includes(hit.part) || hit.textBody)) ? hit : null;
      } },
  });

  const pointerInteractionController = window.PointerInteractionController.create({
    canvasNavigation, drawingPreview, canvasHover, clearSnap, draw, transientAuthoring, recordHistory,
    selectionRectangle, annotationDrag, referenceImageInteraction, dimensionDrag, geometryDrag, pointerHover,
    getMode: () => mode, getPendingCommand: pendingCommandSession.read,
    getPendingConstraintCommand: () => constraintTargetSession.command, setLastPointer: point => { lastPointerWorld = point; },
    updateHatchPreview, updateFilletRadiusPlacement, updatePendingDistanceRetargetHover, hitDimension, hitSketchIdentityElement,
    press: { discardMove: () => flushScheduledCanvasPointerMove({ discard: true }),
      selectInactive: (event, identity) => {
        selectIdentity(identity, event.ctrlKey || event.shiftKey);
        if (sketchById(identity.sketchId)?.locked) guardSketchEdit(identity.sketchId);
      },
      prepareSelection: (event, hits) => {
        const identity = hits.sketchIdentity;
        if ((event.ctrlKey || event.shiftKey) && identity && selectionSketchId() && selectionSketchId() !== identity.sketchId) return true;
        if (identity && sketchById(identity.sketchId)?.locked) {
          selectIdentity(identity, event.ctrlKey || event.shiftKey);
          guardSketchEdit(identity.sketchId); return true;
        }
        if (canvasSelection.inspection && (event.ctrlKey || event.shiftKey)) return true;
        if (canvasSelection.inspection || canvasSelection.sketchId) clearSelection();
        return false;
      },
      activation: { selection: canvasSelection, finalizeSpline: finalizeSplineFromDoubleClick, submitOffset: submitOffsetValue,
        startAnnotationEdit: annotationInputController.start, startDimensionEdit: startDimensionEditInput, startDistanceValue: startDistanceValueInput, submitDistance: submitDistanceValue,
        constraintDoubleClick: handleConstraintTargetDoubleClick, enterBlock: enterBlockDefinitionEdit, beginSplineEdit: beginSplineEditFromDoubleClick },
      query: canvasPressQuery, worldPoint: canvasPoint, screenPoint: canvasScreenPoint,
      closeContextMenu: closeCanvasContextMenu, insertDimensionParameter: insertClickedDimensionParameter,
      referenceDimensionAt: point => focusedExpressionInputContext() ? hitDimension(point.x, point.y, { activeOnly: false }) : null,
      insertAnnotationParameter: insertClickedAnnotationParameter,
      referenceAnnotationAt: point => focusedExpressionInputContext() ? hitAnnotationElement(point.x, point.y, { activeOnly: false }) : null,
      commitHatch: commitHatchAt, calibrateImage: handleReferenceImageCalibrationClick,
      placeFilletRadius: submitFilletRadiusPlacement, placeBlock: handleBlockPlacementClick, blankGesture: blankCanvasGesture,
      inputs: { instance: instanceCommandInput, annotation: annotationCommandInput, constraint: constraintCommandInput,
        drawing: drawingCommandInput, selection: canvasSelectionInteraction } },
  });

  function isDrawToolMode() {
    return mode === "instance-sources" || mode === "line" || mode === "centerline" || mode === "circle-center-cross" || mode === "point" || mode === "rectangle" || mode === "slot" || mode === "fillet" || mode === "trim" || mode === "offset" || mode === "circle" || mode === "arc" || mode === "three-point-arc" || mode === "spline" || mode === "sketch-projection" || mode === "hatch" || mode === "hatch-repair";
  }

  const canvasInputBinding = window.CanvasInputBinding.create({
    canvas, pointer: {
      ...pointerInteractionController,
      down: e => pngExportCommand?.active && e.button === 0 ? pngExportCommand.pick(screenToWorld({ x: e.offsetX, y: e.offsetY })) : pointerInteractionController.down(e),
      move: (screen, world, shift) => {
        if (pngExportCommand?.active) { if (!canvasNavigation.movePan(screen)) pngExportCommand.move(world); }
        else pointerInteractionController.move(screen, world, shift);
      },
      finish: e => { if (!pngExportCommand?.active || e.button !== 0) pointerInteractionController.finish(e); },
      doubleClick: e => { if (!pngExportCommand?.active) pointerInteractionController.doubleClick(e); },
    }, scheduler: pointerMoveScheduler, navigation: canvasNavigation,
    profileCommit: work => profileInteractionPhase("commit", work), closeContextMenu: closeCanvasContextMenu,
    afterZoom: () => { if (pendingCommandSession.current && ["distance-value", "offset-value"].includes(pendingCommandSession.current.type)) syncDimensionValueInput(); },
    screenToWorld, formatCoordinate: formatDisplayNumber, coordinateStatus: () => document.getElementById("statusCoordinates"),
  });
  canvasInputBinding.bind();
  dimensionInputController.bindInput(dimensionValueInput);

  const cancelKeyboardOperation = window.KeyboardInteractionController.createCancellation({
    getMode: () => mode, instances: geometryInstanceCommand, projection: sketchProjectionCommand,
    referenceImage: referenceImageInteraction, splineEditing, blockPlacement: blockPlacementCommand,
    annotationDrag: { active: () => annotationDrag.resizing || annotationDrag.handlesActive, cancel: () => { annotationDrag.reset(); updateUI(); draw(); } },
    pending: { active: () => Boolean(pendingCommandSession.current), cancel: cancelPendingCommand },
    constraint: { active: () => Boolean(constraintTargetSession.command), cancel: cancelConstraintTargetCommand },
    drawing: { active: hasActiveDrawOperation, cancel: cancelActiveDrawOperation, isToolMode: isDrawToolMode, exit: exitDrawMode },
    selection: { active: hasSelection, clear: () => { clearSelection(); setHint("選択を解除しました"); updateUI(); draw(); } },
  });
  const keyboardInteraction = window.KeyboardInteractionController.create({
    menus: { closeSketch: () => sketchContextController.close(),
      canvasVisible: () => canvasContextMenu && !canvasContextMenu.hidden, closeCanvas: closeCanvasContextMenu },
    sketchMove: sketchMoveCommand, constraintStatusView, dimensionInput: dimensionInputController,
    shortcuts: { save: saveJot2DFile, saveAs: saveJot2DFileAs, copy: copySelectionToClipboard,
      paste: pasteGeometryClipboard, nativePaste: true, nativeCopy: true, undo: undoHistory, redo: redoHistory },
    operations: { getMode: () => mode, isGeometryMode, finishSources: finishInstanceSourceEdit,
      annotation: annotationCommand, finishSpline: finalizeSplineCreation, finishProjection: commitSketchProjectionCommand, finishHatch: hatchCommand.finish,
      finishInstance: () => geometryInstanceCommand.finish(), removeSplinePoint: removeLastSplineInputPoint,
      offset: offsetCommand, getPointer: () => lastPointerWorld, deleteSelection: deleteCurrentSelection,
      completeLineLength: completePendingDimensionLineLength, cancel: cancelKeyboardOperation },
    isTextEditingTarget: target => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable,
  });
  window.addEventListener("keydown", keyboardInteraction.keydown);
  window.addEventListener("keyup", constraintStatusView.release);
  window.addEventListener("blur", constraintStatusView.blur);

  document.getElementById("undoBtn")?.addEventListener("click", undoHistory);
  document.getElementById("redoBtn")?.addEventListener("click", redoHistory);
  document.getElementById("selectionVisibilityBtn")?.addEventListener("click", toggleSelectedVisibility);
  document.getElementById("deleteSelectionBtn")?.addEventListener("click", () => {
    if (!isGeometryMode()) return;
    if (deleteCurrentSelection()) {
      updateUI();
      draw();
    }
  });
  document.getElementById("annotationTextBtn")?.addEventListener("click", () => annotationCommand.start());
  document.getElementById("constraintStatusViewBtn")?.addEventListener("click", () => {
    constraintStatusView.toggle();
  });
  document.getElementById("viewConstraintStatusInput")?.addEventListener("change", (event) => {
    constraintStatusView.setLatched(event.target.checked);
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

  const parameterDialogApplication = window.ParameterDialogController.createApplication({
    draft: parameterDraft, application: parameterApplication, recordHistory, applicationText, setHint,
    loadScope: loadParameterDialogScope, setError: setParameterDialogError, parameterErrorText, updateUI, draw,
  });
  function applyParameterDialogDraft() { return parameterDialogApplication.apply(); }

  function pickParameterDialogDimension(event) {
    const rect = canvas.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    const point = canvasPoint(event);
    const hit = hitDimension(point.x, point.y, { activeOnly: false });
    if (hit) insertClickedDimensionParameter(event, hit);
    else insertClickedAnnotationParameter(event, hitAnnotationElement(point.x, point.y, { activeOnly: false }));
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
      const appearance = normalizeDimensionAppearance({ ...documentModel.defaultDimensionAppearance, ...documentModel.defaultTerminatorAppearance }, { partial: false });
      dimensionFields.innerHTML = dimensionAppearancePropertyRows(appearance, appearance, { allowInheritance: false, idPrefix: "documentDimension", terminals: false });
      prepareAffixInputs(dimensionFields);
      localizeApplicationUI(dimensionFields);
      updateDimensionTerminatorAngleVisibility(dimensionFields);
      const applyDimensionInput = (input, { history = true } = {}) => {
        if (!input.dataset.dimensionDisplay) return;
        const key = input.dataset.dimensionDisplay;
        const rawValue = ["prefix", "suffix"].includes(key) ? input.value : input.value.trim();
        applyDimensionAppearanceValue(documentModel.defaultDimensionAppearance, key, rawValue, { allowInheritance: false });
        documentModel.defaultDimensionAppearance = window.Appearance.dimensionDefaults(documentModel.defaultDimensionAppearance);
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
    const terminalFields = document.getElementById("documentTerminatorAppearanceFields");
    const leaderFields = document.getElementById("documentLeaderAppearanceFields");
    const renderSharedDefaults = () => {
      const terminal = documentModel.defaultTerminatorAppearance;
      terminalFields.innerHTML = appearanceControls.terminatorPropertyRows(terminal, terminal, { allowInheritance: false, idPrefix: "documentTerminator", attribute: "data-terminal-style" });
      const leader = effectiveLeaderAppearanceForSketch(null);
      leaderFields.innerHTML = appearanceControls.leaderAppearancePropertyRows(leader, leader, { allowInheritance: false, idPrefix: "documentLeader", terminals: false });
    };
    renderSharedDefaults();
    terminalFields.onchange = event => {
      const key = event.target.dataset.terminalStyle;
      if (!key) return;
      Object.assign(documentModel.defaultTerminatorAppearance, window.Appearance.normalizeTerminator({ [key]: event.target.value }));
      renderSharedDefaults();
      recordHistory("Document端末記号変更");
      updateUI();
      draw();
    };
    leaderFields.onchange = event => {
      const key = event.target.dataset.leaderStyle;
      if (!key) return;
      appearanceEditing.applyLeaderAppearanceValue(documentModel.defaultLeaderAppearance, key, event.target.type === "checkbox" ? !event.target.checked : event.target.value,
        { viewportScale: viewport.scale, effective: effectiveLeaderAppearanceForSketch(null) });
      renderSharedDefaults();
      recordHistory("Document引出線外観変更");
      updateUI();
      draw();
    };
    leaderFields.onclick = event => {
      const button = event.target.closest("[data-appearance-palette-open]");
      if (button) openAppearanceColorPalette(button, "document-leader");
    };
    document.getElementById("documentSettingsDialog")?.showModal();
  });
  appearancePalette.bind();
  applicationSettings.start();
  blockView.bind();

  document.getElementById("toolSelect").addEventListener("click", () => drawOperationLifecycle.start("select"));
  document.getElementById("toolPoint").addEventListener("click", () => drawOperationLifecycle.start("point"));
  document.getElementById("toolLine").addEventListener("click", () => drawOperationLifecycle.start("line"));
  document.getElementById("toolCenterline")?.addEventListener("click", startCenterlineCommand);
  document.getElementById("toolCircleCenterCross")?.addEventListener("click", startCircleCenterCrossCommand);
  document.getElementById("toolSketchProjection")?.addEventListener("click", startSketchProjectionCommand);
  document.getElementById("toolFreeInstance")?.addEventListener("click", () => startGeometryInstanceCommand("free"));
  document.getElementById("toolMirror")?.addEventListener("click", () => startGeometryInstanceCommand("mirror"));
  document.getElementById("toolPattern")?.addEventListener("click", () => startGeometryInstanceCommand("pattern"));

  document.getElementById("toolConstructionLine")?.addEventListener("click", constructionCommand.toggle);

  document.getElementById("toolRectangle")?.addEventListener("click", () => drawOperationLifecycle.start("rectangle"));
  document.getElementById("toolSlot")?.addEventListener("click", () => drawOperationLifecycle.start("slot"));
  document.getElementById("toolFillet")?.addEventListener("click", filletCommand.begin);

  document.getElementById("toolTrim")?.addEventListener("click", () => drawOperationLifecycle.start("trim"));
  document.getElementById("toolCreateBlock")?.addEventListener("click", startBlockCreation);

  document.getElementById("toolOffset")?.addEventListener("click", offsetCommand.begin);

  document.getElementById("toolCircle").addEventListener("click", () => drawOperationLifecycle.start("circle"));
  document.getElementById("toolArc").addEventListener("click", () => drawOperationLifecycle.start("arc"));
  document.getElementById("toolThreePointArc")?.addEventListener("click", () => drawOperationLifecycle.start("three-point-arc"));
  document.getElementById("toolSpline")?.addEventListener("click", beginSplineCreation);

  document.getElementById("exportBtn").addEventListener("click", () => void saveJot2DFile());
  const canvasExport = window.CanvasExport.create({
    canvas, createCanvas: () => document.createElement("canvas"), text: applicationText,
    render: (region, ratio) => {
      pngRender = { region: { x: viewport.x + region.x * viewport.scale, y: viewport.y + region.y * viewport.scale },
        ratio: { x: ratio.x / viewport.scale, y: ratio.y / viewport.scale },
        worldBounds: { x1: region.x, y1: region.y, x2: region.x + region.width, y2: region.y + region.height } };
      withGeometryReadCache(drawCanvas);
    },
    restore: () => {
      pngRender = null; syncCanvasBitmapSize(); draw();
    },
  });
  const pngFile = window.PngFile.create({ window, document, capture: canvasExport.capture, documentName: effectiveDocumentName, text: applicationText,
    prepare: async () => {
      await document.fonts.ready;
      await referenceImageRenderer.ready(model.referenceImages.filter(item => isVisibleValue(item.visible) && isVisibleSketchId(item.sketchId)));
    },
  });
  pngExportCommand = window.PngExportCommand.create({
    text: applicationText, save: (region, dpi) => pngFile.save(region, dpi / 96 * viewport.scale),
    viewScale: () => viewport.scale, setHint, refresh: draw,
    begin: () => { pngPreviousMode = mode; mode = "png-export"; pendingCommandSession.replace({ type: "png-export" }); },
    end: () => { if (pendingCommandSession.current?.type === "png-export") pendingCommandSession.clear(); if (mode === "png-export") mode = pngPreviousMode; pngPreviousMode = null; },
    resolvePoint: point => withGeometryReadCache(() => {
      const snap = drawingSnap.find(point, 10 / viewport.scale);
      return { point: snap ? { x: snap.x, y: snap.y } : point, snapped: Boolean(snap) };
    }),
  });
  document.getElementById("pngExportBtn").addEventListener("click", () => {
    flushScheduledCanvasPointerMove();
    if (fileSession.busy || hasActiveDrawOperation() || pendingCommandSession.current || constraintTargetSession.command || mode === "block-place") {
      setHint(applicationText("進行中の操作を完了またはキャンセルしてからPNG出力を開始してください", "Finish or cancel the current operation before exporting PNG"));
      return;
    }
    pngExportCommand.open();
  });
  document.getElementById("saveAsBtn")?.addEventListener("click", () => void saveJot2DFileAs());
  document.getElementById("importBtn").addEventListener("click", () => void openJot2DFile());
  document.getElementById("documentFileInput")?.addEventListener("change", documentFileCommand.fileInputChanged);
  document.getElementById("copyDocumentLinkBtn")?.addEventListener("click", () => void documentFileCommand.copyDocumentLink());
  document.getElementById("openDocumentLinkBtn")?.addEventListener("click", () => void documentFileCommand.openLinkedDocument());
  document.getElementById("dxfImportBtn").addEventListener("click", () => {
    flushScheduledCanvasPointerMove();
    if (fileSession.busy || !canImportDxf()) {
      setHint(applicationText("作図可能なスケッチを選び、進行中の操作を終了してください", "Select an editable sketch and finish the current operation"), "error");
      return;
    }
    document.getElementById("dxfFileInput").click();
  });
  document.getElementById("dxfFileInput").addEventListener("change", event => {
    const input = event.currentTarget, file = input.files?.[0];
    input.value = "";
    void dxfImportCommand.importFile(file);
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

  window.SidebarController.create({ document, setHint }).bind();

  for (const btn of constraintButtons) {
    btn.addEventListener("click", () => {
      const type = btn.dataset.constraint;
      if (constraintTargetSession.command?.type === type) {
        cancelConstraintTargetCommand(`${constraintLabel(type)}の対象選択をキャンセルしました`);
      } else if (startAnnotationAnchorConstraint(type)) {
        return;
      } else if (type === "symmetry") {
        startConstraintTargetCommand(type);
      } else if (canApplyConstraint(type)) {
        cancelConstraintTargetCommand("");
        if (type === "distance") startDistanceCommand();
        else {
          cancelPendingCommand("");
          constraintTargetSession.replaceCommand({ type });
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
    if (!guardSketchEdit(elementSketchId(operandElement(operand)), "constraint")) return false;
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
    if (!guardSelectionEdit("constraint")) return false;
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
    if (startAnnotationAnchorConstraint("fixed")) return;
    if (constraintTargetSession.command?.type === "fixed") {
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
    function readTestHistory() {
      const history = activeEditHistory();
      return {
        undoCount: history.undoCount,
        redoCount: history.redoCount,
        blockEditing: Boolean(blockEditor.current),
        undoDisabled: document.getElementById("undoBtn")?.disabled,
        redoDisabled: document.getElementById("redoBtn")?.disabled,
        constructionLineMode: constructionCommand.enabled,
        constructionButtonActive: document.getElementById("toolConstructionLine")?.classList.contains("active"),
      };
    }
    function readTestSelectedGeometry() {
      return {
        points: canvasSelection.points.map((point) => point.id),
        lines: canvasSelection.lines.map((line) => line.id),
        circles: canvasSelection.circles.map((circle) => circle.id),
        arcs: canvasSelection.arcs.map((arc) => arc.id),
        splines: canvasSelection.splines.map((spline) => spline.id),
        blockInstances: canvasSelection.blockInstances.map((instance) => instance.id),
      };
    }
    const derivedInstanceInteraction = window.DerivedInstanceTestDriver.createInteraction({
      currentScope: workspace.current, serializeModel, geometryInstanceBundle, constraintStatusColor, arcSweep, canvasSelection,
      resolvedHatchBoundary, document, loadModelData, updateUI, draw, deleteElements, deleteCurrentSelection,
    });
    const derivedInstanceFixture = window.DerivedInstanceTestDriver.createFixture({
      resetModelState, addCircle, addPoint, addLine, addArc, currentScope: workspace.current, DEFAULT_SKETCH_ID, DEFAULT_HATCH_APPEARANCE,
      normalizeGeometryInstance, activeSketchId, geometryRefForItem, parseGeometryRefId, hatchGeometryQuery,
      nextProjectionId: () => `SPI${sketchProjectionInstanceSeq++}`, nextMirrorId: () => `MI${mirrorInstanceSeq++}`, nextPatternId: () => `PI${patternInstanceSeq++}`,
      resetHistory, updateUI, draw, readState: derivedInstanceInteraction.state,
    });
    const clipboardTestObservation = window.ClipboardTestDriver.createObservation({
      currentScope: workspace.current, serializeModel, isRootSketch, elementSketchId, activeSketchId,
      readSelected: readTestSelectedGeometry, canvasSelection, clipboardSession, readHistory: readTestHistory,
    });
    const geometryClipboardFixture = window.ClipboardTestDriver.createGeometryFixture({
      resetModelState, clipboardSession, viewport, currentScope: workspace.current, ROOT_SKETCH_ID, addPoint, addLine, addCircle, addArc,
      pushModelConstraint, HorizontalConstraint, DistanceConstraint, RadiusConstraint, EqualRadiusConstraint,
      PointVerticalConstraint, LineFixedConstraint, ArcEndpointFixedConstraint, dimensionFromAnchor, arcEndpointPoint,
      canvasSelection, resetHistory, updateUI, draw, readState: clipboardTestObservation.state,
    });
    const blockClipboardFixture = window.ClipboardTestDriver.createBlockFixture({
      resetModelState, clipboardSession, viewport, currentScope: workspace.current, ROOT_SKETCH_ID,
      createEmptyBlockDefinition, Point, Line, HorizontalConstraint, DEFAULT_SKETCH_ID,
      appendDefinition: definition => documentModel.blockDefinitions.push(definition), nextInstanceId: () => `BI${blockInstanceSeq++}`,
      invalidateBlockProjectionCache, blockProjectionBundle, pushModelConstraint, canvasSelection, resetHistory, updateUI, draw,
      readState: clipboardTestObservation.state,
    });
    const forcedConstraintCommit = window.ConstraintTestDriver.createForcedCommit({
      resetModelState, addPoint, DistanceConstraint, solver, commitNewConstraint, currentScope: workspace.current, document,
    });
    const drawingOrderFixture = window.DrawingOrderTestDriver.createFixture({
      drawingOrder: window.DrawingOrder,
      resetModelState, viewport, addPoint, addLine, currentScope: workspace.current, hatchGeometryQuery,
      DEFAULT_SKETCH_ID, DEFAULT_HATCH_APPEARANCE, ROOT_SKETCH_ID, createEmptyBlockDefinition, Point, Line,
      appendDefinition: definition => documentModel.blockDefinitions.push(definition), normalizeGeometryInstance, geometryRefForItem,
      invalidateBlockProjectionCache, fitSketchToViewport, resetHistory, updateUI, draw, canvas, worldToCanvasScreen, serializeModel,
    });
    const drawingOrderInteraction = window.DrawingOrderTestDriver.createInteraction({
      drawingOrder: window.DrawingOrder,
      currentScope: workspace.current, hatchGeometryQuery, isRootSketch, serializeModel, readHistory: readTestHistory,
      clearSelection, canvasSelection, updateUI, draw, reorderSelectedDrawingObjects,
    });
    const hatchTestDriver = window.HatchTestDriver.create({
      resetModelState, viewport, addPoint, addLine, addCircle, currentScope: workspace.current,
      fitSketchToViewport, activeSketchId, resetHistory, updateUI, draw, canvas, worldToCanvasScreen, serializeModel,
      readMode: () => mode, allHatches, hatchGeometryQuery, serializeHatch, hatchRegionErrorText, canvasSelection, hatchCommand, document,
      DEFAULT_SKETCH_ID, DEFAULT_HATCH_APPEARANCE, HATCH_SCREEN_PX_PER_MM,
    });
    const hatchProjectionTestDriver = window.HatchTestDriver.createProjection({
      resetModelState, createEmptyBlockDefinition, Point, Line, DEFAULT_SKETCH_ID, DEFAULT_HATCH_APPEARANCE,
      currentScope: workspace.current, appendDefinitions: (...definitions) => documentModel.blockDefinitions.push(...definitions),
      invalidateBlockProjectionCache, updateUI, fitAllGeometryToViewport, blockProjectionBundle, canvas, worldToCanvasScreen,
      draw, allHatches, hatchGeometryQuery, hitBlockInstance, serializeModel,
    });
    const hatchTransferTestDriver = window.HatchTestDriver.createTransfer({
      currentScope: workspace.current, clearSelection, canvasSelection, copyableSelectionPayload, clipboardSession, pasteGeometryClipboard,
      geometryRefId, blockSelectionGeometry, createBlockDefinitionFromSelection, blockSelectionBoundsCenter, hatchGeometryQuery,
    });
    const splineTestDriver = window.SplineTestDriver.create({
      resetModelState, viewport, resizeCanvas, resetHistory, updateUI, draw, canvas, worldToCanvasScreen, serializeModel,
      readOperation: () => ({ mode, editSplineId: splineEditing.current?.spline?.id || null }),
      canvasSelection, document, addPoint, addSpline, hatchGeometryQuery,
      readSpline: () => model.splines[0] || null, splineGeometry: window.SplineGeometry, addLine,
      PointOnSplineConstraint, SplineLineTangentConstraint, pushModelConstraint, solveAndRefresh, serializeConstraint,
    });
    const splineTransferDriver = window.SplineTestDriver.createTransfer({
      currentScope: workspace.current, splineGeometry: window.SplineGeometry, annotationLeaderTargetFromItem,
      nextAnnotationId: () => `AN${annotationSeq++}`, activeSketchId, defaultAnnotationStyle: DEFAULT_ANNOTATION_STYLE,
      clearSelection, canvasSelection, copyableSelectionPayload, clipboardSession, pasteGeometryClipboard,
      blockSelectionGeometry, createBlockDefinitionFromSelection, blockSelectionBoundsCenter,
      appendDefinition: definition => documentModel.blockDefinitions.push(definition), nextInstanceId: () => `BI${blockInstanceSeq++}`,
      blockDefinitionDrawableSketchIds, invalidateBlockProjectionCache, blockProjectionBundle, updateUI, draw,
    });
    window.__jot2dTest = {
      applicationThemeStateForTest() {
        return {
          theme: applicationSettings.theme,
          stored: applicationSettings.storedTheme(),
          defaultGeometryColor: DEFAULT_APPEARANCE.color,
          displayedDefaultGeometryColor: canvasThemeColor(DEFAULT_APPEARANCE.color),
          displayedDefaultGeometryContrast: applicationSettings.theme === "dark"
            ? window.CanvasThemeColors.contrast(window.CanvasThemeColors.channels(canvasThemeColor(DEFAULT_APPEARANCE.color)), [15, 23, 42])
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
      resetForSplineTest: splineTestDriver.reset,
      splineStateForTest: splineTestDriver.state,
      splineHatchPreviewCacheForTest: splineTestDriver.hatchPreviewCache,
      exerciseSplineTransferForTest: splineTransferDriver.exercise,
      exerciseSplineConstraintsForTest: splineTestDriver.exerciseConstraints,
      resetForHatchTest: hatchTestDriver.reset,
      resetForDrawingOrderTest: drawingOrderFixture.reset,
      drawingOrderStateForTest: drawingOrderInteraction.state,
      selectDrawingOrderObjectForTest: drawingOrderInteraction.select,
      reorderDrawingOrderForTest: drawingOrderInteraction.reorder,
      resetForSolidHatchHoleTest: hatchTestDriver.resetSolidHole,
      resetForProjectedHatchTest: hatchProjectionTestDriver.reset,
      projectedHatchStateForTest: hatchProjectionTestDriver.state,
      exerciseHatchTransferForTest: hatchTransferTestDriver.exercise,
      hatchStateForTest: hatchTestDriver.state,
      setViewportScaleForHatchTest: hatchTestDriver.setScale,
      breakFirstHatchBoundaryForTest: hatchTestDriver.breakBoundary,
      restoreClosedBoundaryForHatchTest: hatchTestDriver.restoreBoundary,
      commitConstraintWithForcedSolveResultForTest: forcedConstraintCommit.commit,
      resetForGeometryClipboardTest: geometryClipboardFixture.reset,
      resetForBlockClipboardTest: blockClipboardFixture.reset,
      clipboardStateForTest: clipboardTestObservation.state,
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
      loadModelForDerivedInstanceTest: derivedInstanceInteraction.load,
      resetForDerivedInstanceTest: derivedInstanceFixture.reset,
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
      derivedInstanceStateForTest: derivedInstanceInteraction.state,
      deleteDerivedSourceForTest: derivedInstanceInteraction.deleteSource,
      deleteDerivedInstanceForTest: derivedInstanceInteraction.deleteInstance,
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
          stagedCount: sketchProjectionCommand.count,
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
          clipboardProjectionCount: (clipboardSession.payload?.constraints || []).filter((constraint) => constraint.type === "sketchProjection").length,
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
          documentDefault: structuredClone(normalizeDimensionAppearance({ ...documentModel.defaultDimensionAppearance, ...documentModel.defaultTerminatorAppearance }, { partial: false })),
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
          ...normalizeDimensionAppearance({ ...documentModel.defaultDimensionAppearance, ...documentModel.defaultTerminatorAppearance }, { partial: false }),
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
          ...normalizeDimensionAppearance({ ...documentModel.defaultDimensionAppearance, ...documentModel.defaultTerminatorAppearance }, { partial: false }),
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
            ...normalizeDimensionAppearance({ ...documentModel.defaultDimensionAppearance, ...documentModel.defaultTerminatorAppearance }, { partial: false }),
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
          mouseLatched: constraintStatusView.mouseLatched,
          spaceHeld: constraintStatusView.spaceHeld,
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
      selectedGeometryIdsForTest: readTestSelectedGeometry,
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
          operands: constraintTargetSession.operands.map((item) => ({ kind: item.kind, id: operandElement(item)?.id, endpoint: item.endpoint })),
          pendingType: constraintTargetSession.command?.type || null,
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
          pendingConstraintType: constraintTargetSession.command?.type || null,
          pendingCommandType: pendingCommandSession.current?.type || null,
          pendingPlacementPoint: pendingCommandSession.current?.type === "distance-place" && pendingCommandSession.current.pointer
            ? { x: pendingCommandSession.current.pointer.x, y: pendingCommandSession.current.pointer.y }
            : null,
          pendingCommandPreview: pendingCommandSession.current?.type === "fillet-radius-place"
            ? pendingCommandSession.current.preview
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
        constraintTargetSession.replaceCommand({ type: "distance" });
        pendingCommandSession.replace({
          type: "distance-place",
          target,
          pointer: { x: 0, y: -54 },
          sketchId: activeSketchId(),
        });
        startDistanceValueInput({ x: 0, y: -54 });
        return {
          pendingType: pendingCommandSession.current?.type || null,
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
        const leaderGeometry = leaderElement ? annotationLeaderDisplayGeometry(leaderElement) : null;
        const canvasRect = canvas.getBoundingClientRect();
        const toViewport = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: canvasRect.left + screen.x, y: canvasRect.top + screen.y };
        };
        return {
          leader: leaderElement
            ? {
                world: { ...leaderElement.end },
                viewport: toViewport(leaderGeometry.end),
                displayEnd: { ...leaderGeometry.end },
                bodyViewport: toViewport({ x: (leaderGeometry.elbow.x + leaderGeometry.end.x) / 2, y: leaderGeometry.end.y }),
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
        const style = effectiveAnnotationStyle(annotation);
        draw();
        return {
          style: structuredClone(style),
          rotation: annotation.appearanceInheritance ? style.rotation || 0 : Number(annotation.rotation) || 0,
          textMetrics: annotationTextMetrics(annotation, annotationTextLayout(annotation) || (annotation.type === "leader" ? annotationLeaderDisplayGeometry(annotation) : annotation)),
          screenTextHeight: annotationTextWorldHeight(style) * viewport.scale,
          screenTerminatorSize: style.terminatorSize * ANNOTATION_SCREEN_PX_PER_MM * window.Appearance.annotationDisplayFactor(style, viewport.scale),
          textLayout: annotationTextLayout(annotation),
          displayGeometry: annotation.type === "leader" ? annotationLeaderDisplayGeometry(annotation) : null,
          resolvedStart: annotation.type === "leader" ? annotationLeaderAnchor(annotation) : null,
          displayedText: window.AnnotationRenderer.displayText(annotation, formatDisplayNumber),
          serialized: serializeAnnotation(annotation),
        };
      },
      annotationOwnershipStateForTest() {
        const rect = canvas.getBoundingClientRect();
        const clientPoint = (annotation) => {
          const screen = worldToCanvasScreen(annotationTextLayout(annotation) || (annotation.type === "leader" ? annotationLeaderDisplayGeometry(annotation) : null) || annotation);
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
            effectiveStyle: effectiveAnnotationStyle(annotation),
            textLayout: annotationTextLayout(annotation),
            displayGeometry: annotation.type === "leader" ? annotationLeaderDisplayGeometry(annotation) : null,
            resolvedStart: annotation.type === "leader" ? annotationLeaderAnchor(annotation) : null,
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
      historyState: readTestHistory,
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
          pendingType: pendingCommandSession.current?.type || null,
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
          pendingType: pendingCommandSession.current?.type || null,
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
        constraintTargetSession.replaceCommand({ type: "parallel" });
        updateUI();
        fitAllGeometryToViewport(180);
        draw();
        const rect = canvas.getBoundingClientRect();
        return { blank: { x: rect.left + rect.width - 35, y: rect.top + rect.height - 35 } };
      },
      constraintDimensionSelectionState() {
        return {
          selected: Boolean(canvasSelection.dimensionConstraint),
          command: constraintTargetSession.command?.type || null,
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
        constraintTargetSession.clearOperands();
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
          pendingCommandType: pendingCommandSession.current?.type || null,
          previewTargetKind: pendingCommandSession.current?.target?.kind || null,
          operandKinds: constraintTargetSession.operands.map((operand) => operand.kind),
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
          pendingCommandType: pendingCommandSession.current?.type || null,
          previewTargetKind: pendingCommandSession.current?.target?.kind || null,
          previewPointer: pendingCommandSession.current?.pointer ? { ...pendingCommandSession.current.pointer } : null,
        };
      },
      dimensionCommandLineDragState() {
        const constraint = model.constraints.find(isDimensionConstraint);
        const target = targetFromConstraint(constraint);
        return {
          anchor: constraint && target ? dimensionAnchor(target, constraint.dimension) : null,
          pendingConstraintType: constraintTargetSession.command?.type || null,
          pendingCommandType: pendingCommandSession.current?.type || null,
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
          command: constraintTargetSession.command?.type || null,
          blockInstanceId: canvasHover.current.block?.id || null,
          pointId: canvasHover.current.point?.id || null,
          pointIsBlockProjection: Boolean(canvasHover.current.point?.blockProjection),
          lineId: canvasHover.current.line?.id || null,
          arcEndpointId: canvasHover.current.arcEndpoint ? `${canvasHover.current.arcEndpoint.arc.id}.${canvasHover.current.arcEndpoint.endpoint}` : null,
        };
      },
      drawnGeometryIdLabelsForTest: canvasRenderProbe.geometryIdLabels,
      constraintStatusEndpointMarkerCountForTest: canvasRenderProbe.constraintEndpointMarkerCount,
      drawnPointMarkerCountForTest: canvasRenderProbe.pointMarkerCount,
      arcEndpointHandleCountForTest: canvasRenderProbe.arcEndpointHandleCount,
      pointDisplayStateForTest: canvasRenderProbe.pointDisplayState,
      drawnDimensionLabelsForTest: canvasRenderProbe.dimensionLabels,
      drawnDimensionExpressionMarksForTest: canvasRenderProbe.dimensionExpressionMarks,
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
    getMode: () => mode, projectionSources: () => sketchProjectionCommand.sources,
    geometryCommand: geometryInstanceCommand, sourceCommand: instanceSourceCommand,
    resolveGeometryRef, sketchName, activeSketchId, elementSketchId, geometryRefForItem, applicationText,
    finishProjection: commitSketchProjectionCommand,
    removeProjectionSource: sketchProjectionCommand.remove,
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
  const hatchPanel = window.HatchCommandPanel.create({ command: hatchCommand, getMode: () => mode, applicationText, formatDisplayNumber,
    cancel: () => { exitDrawMode(); updateUI({ refreshAnalysis: false }); draw(); },
  });
  const annotationPanel = window.AnnotationCommandPanel.create({ command: annotationCommand, applicationText, effectiveStyle: item => effectiveAnnotationStyle({ ...item, sketchId: activeSketchId() }) });
  const currentCommandPanel = () => annotationAnchorConstraints.active ? annotationAnchorConstraints : annotationCommand.active ? annotationPanel : ["hatch", "hatch-repair"].includes(mode) ? hatchPanel : derivedPanel;
  commandPanel = window.CommandPanel.create({ document, host: canvas.parentElement, ...derivedPanel,
    readState: () => pngExportCommand.active ? pngExportCommand.readState() : currentCommandPanel().readState(),
    onAction: action => pngExportCommand.active ? pngExportCommand.onAction(action) : currentCommandPanel().onAction(action),
    onSelect: (key, index) => currentCommandPanel().onSelect?.(key, index),
    onRemove: (key, index) => currentCommandPanel().onRemove?.(key, index),
    onSetting: (key, value) => pngExportCommand.active ? pngExportCommand.onSetting(key, value) : currentCommandPanel().onSetting(key, value),
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
  window.addEventListener("beforeunload", documentFileCommand.beforeUnload);
  void documentFileCommand.openStartupDocument();
})();
