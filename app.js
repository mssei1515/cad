/* Application composition, editing commands, Canvas UI and event handling. */
(function () {
  "use strict";
  const { formatDisplayNumber, formatDimensionLabel, formatMeasuredDimensionLabel } = window.NumberDisplay;
  const { validReferenceImageDataUrl, serializeReferenceImage } = window.ReferenceImageData;
  const { lineIntersectsRect, pointInExpandedBox, rectFromPoints, pointInRect, bboxInRect, bboxIntersectsRect, lineBBox, primitiveBBox, mergeBounds, splineBBox } = window.GeometryBounds;
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
  let pngExportCommand = null;
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
    evaluateDimensionExpressionDraft: evaluateNamedDimensionExpressionDraft, dimensionExpressionValue, numericDimensionExpression, isDirectNumericExpressionInput,
    dimensionUsesExpression, expressionInputValue, expressionFromUserInput,
    dimensionConstraintsInNamespace, allocateDimensionParameterName,
    ensureDimensionParameter, ensureParameterNamespace, parameterErrorText,
    referenceDimensionValues, validateParameterSymbolNames, evaluateParameterNamespace,
    validateParameterNamespace, prepareLoadedParameterNamespace, parameterDependents,
  } = parameterNamespace;
  function evaluateDimensionExpressionDraft(constraint, expression, namespace, options) {
    return evaluateNamedDimensionExpressionDraft(constraint?.annotationOwner ? null : constraint, expression, namespace, options);
  }
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
  const sketchEditAccess = window.SketchCommand.createEditAccess({
    activeSketchId, canEditSketch, sketchById, selectionItems, elementSketchId, isGeometryMode,
    setHint, applicationText, clearSnap: () => clearSnap(), clearPointerPreview: () => drawingPreview.setPointer(null), draw,
  });

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
  const selectionScopeQuery = window.CanvasSelection.createScopeQuery({ canvasSelection, selectedGeometryItems });
  const identitySelection = window.CanvasSelectionInteraction.createIdentitySelection({ canvasSelection, selectionSketchId, clearSelection, updateGeometrySelectionUI, draw });
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
  const instanceSourceSelection = window.InstanceProjection.createSourceSelection({
    currentScope: () => model, selectedGeometryItems, canvasSelection, blockProjectionBundle, geometryInstanceBundle, elementSketchId, activeSketchId, geometryRefForItem,
  });
  const geometryAppearance = window.GeometryAppearanceQuery.create({
    document: documentModel, readAppearance: geometryReads.readAppearance, cacheAppearance: geometryReads.cacheAppearance,
    sketchById, elementSketchId, isRootSketch, activeSketchId, showHiddenElements: () => viewState.showHiddenElements,
  });
  const annotationAppearance = window.GeometryAppearanceQuery.createAnnotation({ document: documentModel, currentSketches: () => model.sketches });
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
  const canvasRefresh = window.CanvasRefresh.create({
    readPngCommand: () => pngExportCommand, readPending: () => pendingCommandSession.current, readMode: () => mode,
    readCommandPanel: () => commandPanel, syncAnnotationInput: () => annotationInputController.sync(), readDerivedPanel: () => derivedPanel,
    interactionProfiler, profileInteractionWork, withGeometryReadCache, drawCanvas,
  });
  const geometryInstanceCommand = window.GeometryInstanceCommand.create({
    cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation,
    selectedItemsForGeometryInstance, geometryRefForItem, geometryRefsEqual, isVisibleSketchElement, clearSelection, normalizeGeometryInstance,
    previewFreeId: type => type === "mirror" ? `MI${mirrorInstanceSeq}` : `PI${patternInstanceSeq}`,
    nextInstanceId: type => type === "mirror" ? `MI${mirrorInstanceSeq++}` : `PI${patternInstanceSeq++}`,
    activeSketchId, getMode: () => mode, setMode: value => { mode = value; }, updateToolbar, updateUI,
    applicationText, setHint, draw, currentScope: workspace.current, canvasSelection, recordHistory,
    Line, lineHasDirection, elementSketchId,
    resolveGeometryRef, createGeometryInstanceBundle, commitDraft: (...args) => synchronizedInstanceEditing.commit(...args),
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
  const { start: startProjectionSourceEdit, toggle: toggleInstanceSource, finish: finishInstanceSourceEdit } = instanceSourceCommand;
  function startInstanceSourceEdit(instance) {
    if (!instance.placement) return startProjectionSourceEdit(instance);
    if (instance.sketchId !== activeSketchId() || !guardSketchEdit(instance.sketchId, "structure")) return false;
    return geometryInstanceCommand.startEdit(instance, "sources");
  }
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
  const CURRENT_JSON_VERSION = 26;
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
  const CONSTRAINT_ACCEPT_ERROR = 1e-4;
  const constraintCandidates = window.ConstraintCandidates.create({
    sameSketchElements, syncLineOrientationHints: () => solver.syncLineOrientationHints?.(),
    constraintAcceptError: CONSTRAINT_ACCEPT_ERROR,
  });
  const { sameArcEndpoint, constraintTargetsFromOperands, linesAreParallel } = constraintCandidates;
  const constraintOperandValues = window.ConstraintOperands.create({ elementSketchId, operandRelationForSketch, sameArcEndpoint, Arc, lineHasDirection, closestSplinePoint: window.SplineGeometry.closestPoint });
  const { operandElement, makeConstraintOperand, operandFromReferenceTarget, referenceTargetFromOperand, sameConstraintOperand } = constraintOperandValues;
  const sketchProjectionSources = window.SketchProjectionQueries.createSources({
    currentScope: () => model, activeSketchId, geometryRefForItem, geometryRefsEqual, queries: sketchProjectionQueries,
    constraintIsOperational, constraintSketchId, geometryElementKey, geometryKindForItem, elementSketchId,
    isReferenceSourceSketchId, isVisibleSketchElement, operandElement,
  });
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
  const pngRendering = window.CanvasExport.createRenderer({ viewport, withGeometryReadCache, drawCanvas, syncCanvasBitmapSize, draw });
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
  const { dimensionTextDrawingMetrics, dimensionTextWidth, linearDimensionTerminatorDirections, dimensionStrokeWidth, dimensionArrowheadPoints, dimensionOpenArrowJoinProjection, dimensionOpenArrowheadRenderPoints } = dimensionMetrics;
  const dimensionPlacement = window.DimensionPlacement.create({ viewport });
  const { dimensionFromAnchor, angleDimensionLabelBasis, angleDimensionLabelOffsets, setAngleDimensionLabelOffsets, migrateAngleDimensionLabelPlacement, dimensionWithLabelAt, angleDimensionFromLabelPoint, applyDefaultCircleDimensionLabelOffset, storedDimensionAxis, dimensionAnchor, defaultDimensionForTarget } = dimensionPlacement;
  const dimensionLayouts = window.DimensionLayout.create({ viewport, placement: dimensionPlacement, metrics: dimensionMetrics, currentLines: () => workspace.current().lines, minLineLength: MIN_LINE_LENGTH });
  const { jisDimensionTextAngle, dimensionTextOffset, angleDimensionLayout } = dimensionLayouts;
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
  const dimensionPainter = window.DimensionPresentation.createPainter({
    renderer: dimensionRenderer, layouts: dimensionLayouts, metrics: dimensionMetrics, dimensionLayout,
    effectiveDimensionAppearance, activeSketchId, outsideShaftLengthFactor: DIMENSION_OUTSIDE_SHAFT_LENGTH_FACTOR,
  });
  const commandTargetPresentation = window.GeometryPresentation.createCommandTargets({
    readPanelSelection: () => canvasRefresh.selectedItem, readMode: () => mode, instanceSourceCommand, sketchProjectionCommand,
    geometryInstanceCommand, geometryRefsEqual, geometryRefForItem, readOperands: () => constraintTargetSession.operands, sameArcEndpoint, operandElement,
    readConstraintCommand: () => constraintTargetSession.command, isActiveSketchElement, isReferenceSourceSketchId, elementSketchId, readPending: () => pendingCommandSession.current,
  });
  const sketchPresentation = window.GeometryPresentation.createSketchStyle({
    sketchHasSolveError, elementSketchId, sketchRelationOfElement, constraintStatusOf, isVisibleSketchElement, isActiveSketchElement,
  });
  const { geometryDisplayColor, geometryStrokeWidth, geometryPaintState, pointPaintState, arcEndpointPaintState, splineHandleState } = window.GeometryPresentation.create({
    Point, canvasSelection, canvasHover, viewState,
    isExporting: () => Boolean(pngRendering.frame),
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
  const lineDisplay = window.GeometryPresentation.createLineDisplay({ viewport, effectiveAppearanceForElement, constructionExtensionScreenPx: CONSTRUCTION_EXTENSION_SCREEN_PX });
  const geometryRenderer = window.GeometryRenderer.create({ ctx, viewport, readPixelRatio: () => canvasSurface.dpr, paintState: geometryPaintState, pointPaintState, arcEndpointPaintState, withCanvasState, fixedPointLabel: () => applicationText("固定", "Fixed"), appearanceLineDash, lineDisplaySegment, canvasThemeColor });
  const { traceSplinePath } = geometryRenderer;
  const geometryLayer = window.GeometryRenderer.createLayer({ renderer: geometryRenderer, isVisibleSketchElement, drawOrderBySketch, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines });
  const interactionOverlay = window.InteractionOverlayRenderer.create({ ctx, viewport, withCanvasState,
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

  const { drawResolvedHatchContent } = window.HatchRenderer.create({ viewport, visibleWorldBounds: () => pngRendering.frame?.worldBounds || visibleWorldBounds(), canvasThemeColor, isVisibleValue });
  const hatchLayer = window.HatchRenderer.createLayer({
    ctx, drawResolvedHatchContent, hatchBoundaryGeometryItems,
    boundaryPainters: [{ type: Line, draw: drawLines }, { type: Circle, draw: drawCircles }, { type: Arc, draw: drawArcs }, { type: Spline, draw: drawSplines }],
    allHatches, isVisibleSketchId, hatchAppearanceForDisplay, isConstraintOperandSelected, canvasSelection, activeSketchId,
    readHover: () => canvasHover.current, resolvedHatchBoundary, hatchPatternOrigin, isExporting: () => Boolean(pngRendering.frame),
    sketchAlpha, readMode: () => mode, readCommand: () => hatchCommand,
  });
  const annotationColor = window.AnnotationRenderer.createColor({
    effectiveAnnotationStyle, readExportFrame: () => pngRendering.frame, canvasSelection,
    readHoveredAnnotation: () => canvasHover.current.annotation, canvasThemeColor,
  });
  const { annotationLeaderDisplayGeometry, annotationTextLayout, annotationTextWorldHeight, annotationTextMetrics, drawAnnotationText, drawAnnotationLeader } = window.AnnotationRenderer.create({ ctx, viewport, withCanvasState, annotationDisplayColor, annotationLeaderAnchor, appearanceLineDash, formatValue: formatDisplayNumber, effectiveAnnotationStyle,
    resolvePlacement: (element, base) => window.AnnotationAnchorConstraints.resolve(element, base, resolveGeometryRef),
    showFrame: element => !pngRendering.frame && (canvasSelection.annotations.includes(element) || canvasSelection.inspectionContains(element) || canvasHover.current.annotation === element || canvasSelection.inspectionContains(element.blockInstance)),
    showResizeHandles: element => !pngRendering.frame && !element.blockProjection && canvasSelection.annotations.includes(element) && isEditableSketchElement(element) && annotationDrag.resizeEnabled(element),
    isResizeHandleHovered: (element, handle) => canvasHover.current.annotationHandle?.element === element && canvasHover.current.annotationHandle.resizeX === handle.resizeX && canvasHover.current.annotationHandle.resizeY === handle.resizeY,
    showLeaderEndHandle: element => !pngRendering.frame && !element.blockProjection && !element.anchorConstraints?.length && element.sketchId === activeSketchId() && (canvasSelection.annotations.includes(element) || canvasHover.current.annotation === element) });
  const annotationLayer = window.AnnotationRenderer.createLayer({ allAnnotations, isVisibleValue, isVisibleSketchId, drawAnnotationLeader, drawAnnotationText });
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
    startDistancePlacement: resolution => startDistanceResolution(resolution, null),
  });
  const annotationDimensions = window.AnnotationAnchorConstraints.createDimensions({
    annotations: () => model.annotations, anchor: annotationPlacementAnchor, resolveRef: resolveGeometryRef,
    defaultDimension: defaultDimensionForTarget, normalizeDimension: dimensionPlacement.normalizeDimension,
    capturePosition: item => materializeAnnotationAnchor(item, { capture: true }),
    evaluateValue: expression => evaluateDimensionExpressionDraft(null, expression), applicationText,
  });
  function dimensionPresentationScope() { return { ...model, constraints: [...model.constraints, ...annotationDimensions.entries()] }; }
  function startAnnotationAnchorConstraint(type, item = canvasSelection.annotations.length === 1 ? canvasSelection.annotations[0] : null) {
    if (!item) return false;
    if (annotationAnchorConstraints.active && constraintTargetSession.command?.type === type) { cancelPendingCommand(""); annotationAnchorConstraints.cancel(); return true; }
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
  const placementPreviewLayer = window.PlacementPreviewRenderer.createLayer({
    renderer: placementPreview, readMode: () => mode, readPointer: () => drawingPreview.pointer,
    blockPlacementCommand, geometryInstanceCommand, createBlockProjectionBundle,
  });
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
  const offsetPreviewLayer = window.OffsetPreviewRenderer.createLayer({ renderer: offsetPreviewRenderer, readMode: () => mode, readPointer: () => drawingPreview.pointer, command: offsetCommand });
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
  const solveRefreshCommand = window.SolveRefreshCommand.create({
    activeSketchId, stabilizeActiveParameterNamespace, refreshConstraintAnalysis, setSolveResultHint, updateUI, draw, historyController, recordHistory,
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
  const synchronizedInstanceEditing = window.DerivedInstanceEditing.create({
    currentScope: workspace.current, snapshotModelState, restoreModelState, geometryInstanceBundle, geometryInstanceBundlesForScope,
    blockProjectionBundles, serializeModel, addPointSnapConstraints, geometryInstanceSourceObjects,
    rebind: () => constraintRebinding.rebuildDocument(model, [...blockProjectionBundles(), ...geometryInstanceBundles()]),
    stabilize: stabilizeActiveParameterNamespace, acceptError: CONSTRAINT_ACCEPT_ERROR, resolveGeometryRef, setHint, recordHistory, updateUI, draw,
  });
  const instanceTransformCommand = window.InstanceTransformCommand.create({
    isPlacing: geometryInstanceCommand.isPlacing, currentScope: workspace.current,
    snapshotModelState, restoreModelState, geometryInstanceSourceObjects,
    sketchSolveVariables, sketchSolveConstraints, sketchSolveLines, solver, acceptError: CONSTRAINT_ACCEPT_ERROR,
    stabilizeActiveParameterNamespace, clearSketchSolveState, applicationText, setHint, recordHistory,
    blockDefinitionById, blockLocalGeometryBounds, blockInstanceEnabledSketchSet, blockWorldPoint,
    invalidateBlockProjectionCache, updateBlockUI, refreshConstraintAnalysis, updateUI, draw,
    snappedBlockRotation, solveSketchAndDependents, updatePropertiesUI,
  });
  const { setBlockInstanceRotationLocked, setBlockInstanceOrthogonalRotation } = instanceTransformCommand;
  function changeFreeInstanceProperty(instance, key, value) {
    return geometryInstanceCommand.isPlacing(instance) ? geometryInstanceCommand.changeSetting(key, value)
      : synchronizedInstanceEditing.change(instance, key, value);
  }
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
    submitSpecialDistance: (pending, value) => {
      if (pending.target?.interval) return synchronizedInstanceEditing.interval(pending, value, expressionFromUserInput(pending.buffer));
      if (pending.constraint?.annotationOwner) {
        if (!annotationDimensions.setValue(pending.constraint, value)) { setHint("注記の距離拘束が成立しません", "error"); return false; }
        recordHistory("注記寸法値変更"); return true;
      }
      return pending.target?.annotationAnchor ? annotationAnchorConstraints.submitDistance(value, pending.target.dimensionAxis, pending.dimension) : null;
    },
    commitSpecialProperty: (constraint, property, input) => {
      if (constraint instanceof window.GeometrySolver.InstanceAngleIntervalConstraint) {
        if (property !== "constraint-expression") return null;
        try { const expression = expressionFromUserInput(input); return synchronizedInstanceEditing.interval({ constraint, target: targetFromConstraint(constraint), dimension: constraint.dimension }, evaluateDimensionExpressionDraft(constraint, expression), expression); }
        catch (error) { setHint(parameterErrorText(error), "error"); return false; }
      }
      if (!constraint.annotationOwner) return null;
      try {
        const value = evaluateDimensionExpressionDraft(null, expressionFromUserInput(input));
        if (property !== "constraint-expression" || !annotationDimensions.setValue(constraint, value)) throw new Error("注記の距離拘束が成立しません");
        recordHistory("注記寸法値変更"); return true;
      } catch (error) { setHint(parameterErrorText(error), "error"); return false; }
    },
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
  const authoringPreviewLayer = window.AuthoringPreviewRenderer.createLayer({
    renderer: authoringPreview, readMode: () => mode, readPointer: () => drawingPreview.pointer, readTrim: () => drawingPreview.trim,
    lineCommand, rectangleCommand, slotCommand, circularCommands, splineDraft, centerlineCommand, projectPointToCenterlineSupport,
    readCanvasSize: () => ({ width: canvas.clientWidth, height: canvas.clientHeight }),
  });
  const { reset: resetSlotCommandState } = slotCommand;
  function handleSlotClick(point) {
    const snapped = snapForDrawing(point);
    slotCommand.click(snapped, drawingSnap.active);
  }
  const { INACTIVE_CONSTRAINT_STATUS_COLOR } = window.GeometryPresentation;
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
    if (type === "mirror") return applicationText("ミラー", "Mirror");
    if (type === "pattern") return applicationText("直線パターン", "Linear Pattern");
    if (type === "circularPattern") return applicationText("円形パターン", "Circular Pattern");
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

  function selectionItems(...args) { return selectionScopeQuery.selectionItems(...args); }

  function selectIdentity(...args) { return identitySelection.selectIdentity(...args); }

  function selectionSketchId(...args) { return selectionScopeQuery.selectionSketchId(...args); }

  function guardSketchEdit(...args) { return sketchEditAccess.guardSketchEdit(...args); }

  function guardSelectionEdit(...args) { return sketchEditAccess.guardSelectionEdit(...args); }

  const { ordinarySelectionMode, hitSketchAllowed, hitElementAllowed } = window.GeometryHitQuery.createScopePolicy({
    readMode: () => mode, readPendingCommand: () => pendingCommandSession.current, readConstraintCommand: () => constraintTargetSession.command,
    isVisibleSketchId, isVisibleSketchElement, elementSketchId, activeSketchId, isEditableSketchId,
  });

  function toggleSketchLock(id) {
    const sketch = sketchById(id);
    if (!sketch || isRootSketch(sketch)) return false;
    cancelPendingCommand(""); cancelConstraintTargetCommand(""); exitDrawMode();
    sketch.locked = !sketch.locked;
    updateUI(); draw(); recordHistory(applicationText("スケッチロック切替", "Toggle sketch lock"));
    return true;
  }

  function canCreateInActiveSketch(...args) { return sketchEditAccess.canCreateInActiveSketch(...args); }

  function rejectRootSketchCreation(...args) { return sketchEditAccess.rejectRootSketchCreation(...args); }

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

  function isConstraintOperandSelected(...args) { return commandTargetPresentation.isConstraintOperandSelected(...args); }

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



  function solveAndRefresh(...args) { return solveRefreshCommand.run(...args); }

  function stabilizeActiveParameterNamespace(...args) { return parameterStabilization.stabilize(...args); }

  function geometryErrorNorm() {
    return vectorNorm(solver.computeErrorVector());
  }

  function refreshConstraintAnalysis(options = {}) { return constraintAnalysis.refresh(options); }

  function constraintStatusColor(...args) { return sketchPresentation.constraintStatusColor(...args); }

  function sketchStrokeWidth(...args) { return sketchPresentation.sketchStrokeWidth(...args); }

  function canvasThemeColor(value) {
    return window.CanvasThemeColors.color(value, applicationSettings.theme);
  }

  function isReferenceHoverElement(...args) { return commandTargetPresentation.isReferenceHoverElement(...args); }

  function isPendingReferenceTarget(...args) { return commandTargetPresentation.isPendingReferenceTarget(...args); }

  function drawOrderBySketch(...args) { return sketchPresentation.drawOrderBySketch(...args); }

  function sketchAlpha(...args) { return sketchPresentation.sketchAlpha(...args); }

  function sketchProjectionSourceKey(...args) { return sketchProjectionSources.sketchProjectionSourceKey(...args); }

  function sketchProjectionSourceIsCovered(...args) { return sketchProjectionSources.sketchProjectionSourceIsCovered(...args); }

  function sketchProjectionEntryFromItem(...args) { return sketchProjectionSources.sketchProjectionEntryFromItem(...args); }

  function sketchProjectionEntryFromOperand(...args) { return sketchProjectionSources.sketchProjectionEntryFromOperand(...args); }


  function sketchProjectionEntriesByRect(rect, crossing) {
    return rectangleSelectionQuery.readProjection(rect, crossing, {
      points: allGeometryPoints, lines: allGeometryLines, circles: allGeometryCircles,
      arcs: allGeometryArcs, splines: allGeometrySplines, hatches: allHatches,
    }, sketchProjectionEntryFromItem);
  }


  function selectedItemsForGeometryInstance() { return instanceSourceSelection.read(); }









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






























  const regionHitQuery = window.GeometryHitQuery.createRegions({
    currentScope: workspace.current, ordinarySelectionMode, allHatches, isVisibleSketchId, isVisibleValue, hatchAppearanceForDisplay,
    activeSketchId, drawingOrderOwner, resolvedHatchBoundary, hatchContainsSelectablePoint, referenceImageWorldToLocal,
  });
  const dimensionHitQuery = window.GeometryHitQuery.createDimensions({
    currentScope: dimensionPresentationScope, viewportScale: () => viewport.scale, ordinarySelectionMode, isActiveSketchConstraint, isVisibleSketchId,
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
    const value = readOnly ? measuredDimensionValue(target, dimension) : target.interval ? constraint.target * 180 / Math.PI : target.kind === "angle" ? angleDegrees(constraint.target) : constraint.target;
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
    geometryInstanceBundle, blockAllProjectionBundle, constraintGraphNodes, removeAnnotationConstraint: constraint => annotationDimensions.remove(constraint),
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
    allocateGeometryInstanceId: type => type === "sketchProjection" ? "SPI" + sketchProjectionInstanceSeq++ : type === "mirror" ? "MI" + mirrorInstanceSeq++ : "PI" + patternInstanceSeq++,
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

  function ensureDimensionDefaults() { return window.DocumentState.normalizeDimensionState(model, targetFromConstraint, (target, dimension) => dimensionPlacement.normalizeDimension(target, dimension)); }

  const dimensionSelectionBounds = window.DimensionPresentation.createSelectionBounds({
    isActiveSketchConstraint, isVisibleSketchId, constraintSketchId, targetFromConstraint, defaultDimensionForTarget,
    effectiveDimensionAppearance, isVisibleValue, dimensionLayout, dimensionTextDrawingMetrics,
    dimensionLabelForConstraint, dimensionTextWidth, dimensionUsesExpression,
  });
  const dimensionLayer = window.DimensionPresentation.createLayer({
    ctx, currentScope: dimensionPresentationScope, isActiveSketchConstraint, isVisibleSketchId, constraintSketchId,
    targetFromConstraint, defaultDimensionForTarget, effectiveDimensionAppearance, isVisibleValue, canvasSelection,
    readHoverDimension: () => canvasHover.current.dimension, readDraggedDimension: () => dimensionDrag.constraint,
    readPending: () => pendingCommandSession.current, readExportFrame: () => pngRendering.frame,
    readConstraintStatus: () => viewState.constraintStatus, inactiveColor: INACTIVE_CONSTRAINT_STATUS_COLOR,
    dimensionLabelForConstraint, drawDimension, dimensionUsesExpression,
  });

  const rectangleSelectionQuery = window.RectangleSelectionQuery.create({
    currentScope: dimensionPresentationScope, selectableSketchElement, isExplicitPoint, isReferencePoint, pointInRect,
    lineIntersectsRect, bboxInRect, lineBBox, isVisibleSketchElement, primitiveBBox, bboxIntersectsRect,
    arcSamplePoints, viewScale: () => viewport.scale, isEditableSketchId: id => id === activeSketchId(), isVisibleSketchId, blockProjectionBundle, geometryInstanceBundle, mergeBounds,
    splineBBox, annotationBounds, resolvedLoopBounds, resolvedHatchBoundary, activeSketchId,
    hatchAppearanceForDisplay, referenceImageBounds, isVisibleValue,
    dimensionSelectionBounds: dimensionSelectionBounds.read,
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





  function draw() { return canvasRefresh.draw(); }

  const canvasFrameRenderer = window.CanvasSurface.createFrameRenderer({
    canvas, ctx, viewport, surface: canvasSurface,
    syncZoom: () => canvasZoomControl.sync(), readExportFrame: () => pngRendering.frame,
    recordDraw: () => pointerMoveScheduler.recordDraw(),
    drawContent: () => { drawReferenceImages(); drawHatches([], { includePreview: true }); drawDrawingStack(); },
    drawExport: () => { drawDimensions(); drawAnnotations(); drawPoints(); },
    drawInteractive: drawInteractiveCanvas,
  });

  function drawCanvas() { return canvasFrameRenderer.draw(); }

  function drawInteractiveCanvas() {
    drawBlockInstanceHandles();
    drawDimensions();
    drawDimensionPreview();
    drawAnnotations();
    const annotationPreview = annotationCommand.preview();
    if (annotationPreview?.type === "leader") drawAnnotationLeader(annotationPreview, true);
    else if (annotationPreview) drawAnnotationText(annotationPreview, "#2563eb");
    authoringPreviewLayer.draw();
    placementPreviewLayer.drawBlockPlacementPreview();
    placementPreviewLayer.drawFreeInstancePreview();
    offsetPreviewLayer.draw();
    authoringPreviewLayer.drawTrimPreview();
    drawSnapMarker();
    drawArcEndpointHandles();
    drawSplineEditHandles();
    drawPoints();
    drawReferenceImageOverlays();
    drawSketchIdentityLabel();
    drawSelectionRect();
    pngExportCommand?.drawOverlay(ctx, viewport.scale);
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

  function drawSelectionRect() { return interactionOverlay.drawSelectionRect(selectionRectangle.preview()); }

  function lineDisplaySegment(...args) { return lineDisplay.lineDisplaySegment(...args); }








  function drawLines(...args) { return geometryLayer.drawLines(...args); }
  function drawCircles(...args) { return geometryLayer.drawCircles(...args); }
  function drawArcs(...args) { return geometryLayer.drawArcs(...args); }
  function drawSplines(...args) { return geometryLayer.drawSplines(...args); }


  function drawSplineEditHandles() { geometryRenderer.drawSplineEditHandles(splineHandleState()); }




  function drawDimension(...args) { return dimensionPainter.drawDimension(...args); }
  function drawAngleDimension(...args) { return dimensionPainter.drawAngleDimension(...args); }
















  function drawDimensions() { return dimensionLayer.draw(); }

  function drawAnnotations() { return annotationLayer.draw(); }

  function effectiveLeaderAppearanceForSketch(sketch) { return annotationAppearance.effectiveLeaderAppearanceForSketch(sketch); }
  function effectiveAnnotationStyle(element) { return annotationAppearance.effectiveAnnotationStyle(element); }
  function annotationDisplayColor(...args) { return annotationColor.annotationDisplayColor(...args); }






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

  const dimensionPreview = window.DimensionPreview.create({
    readPending: () => pendingCommandSession.current, drawDimension, drawFilletPreviewArc, dimensionFromAnchor,
    applyDefaultCircleDimensionLabelOffset, defaultDimensionForTarget, evaluateDimensionExpressionDraft,
    formatDisplayNumber, angleDegrees, angleDimensionAngles, dimensionAnchor, formatDimensionLabel, dimensionWithLabelAt,
  });
  function drawDimensionPreview() { return dimensionPreview.draw(); }












  function drawSnapMarker() { interactionOverlay.drawSnapMarker(drawingSnap.active); }
  function drawSketchIdentityLabel() {
    interactionOverlay.drawSketchIdentityLabel({ hoveredIdentity: canvasHover.current.sketchIdentity, selection: canvasSelection, pointer: lastPointerWorld });
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
  function startInstanceAngleDimension(instance) {
    if (!guardSketchEdit(instance.sketchId) || geometryInstanceCommand.isPlacing(instance) || instance.placement?.kind !== "circular") return false;
    cancelPendingCommand(""); cancelConstraintTargetCommand(""); mode = "select";
    const anchor = geometryInstanceBundle(instance).controlPoints.find(point => point.instanceControl === "anchor");
    const c = new window.GeometrySolver.InstanceAngleIntervalConstraint(anchor, instance.placement.angleStep);
    const target = targetFromConstraint(c);
    pendingCommandSession.replace({ type: "distance-place", target, pointer: defaultDimensionForTarget(target), sketchId: instance.sketchId });
    setHint("角度間隔寸法の表示位置をクリックしてください"); updateToolbar(); draw(); return true;
  }
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
      if (pendingCommandSession.current?.type?.startsWith("distance") && !pendingCommandSession.current.target?.annotationAnchor && !pendingCommandSession.current.target?.interval) {
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
    currentScope: dimensionPresentationScope, getLanguage: () => applicationSettings.language,
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
    currentScope: dimensionPresentationScope, activeSketchId, setActiveSketch, clearSelection, canvasSelection,
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
    if (!context || !dimensionHit?.constraint || dimensionHit.constraint.annotationOwner) return false;
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
    annotationCommand, startInstanceSourceEdit, startInstancePlacementEdit: geometryInstanceCommand.startEdit, startInstanceAngleDimension, startReferenceImageCalibration, startHatchBoundaryRepair,
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
      "pattern-placement-origin": applicationText("配置基準点", "Placement anchor"),
      "pattern-placement-place": applicationText("直線パターン", "Linear Pattern"),
      "pattern-placement-mirror": applicationText("ミラー", "Mirror"),
      "pattern-placement-circular": applicationText("円形パターン", "Circular Pattern"),
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
    if (hit.item?.instanceControl === "anchor") return;
    if (!guardSketchEdit(hit.instance.sketchId)) return;
    const wholeSelected = canvasSelection.geometryInstances.includes(hit.instance) && canvasSelection.instanceGeometry?.instanceId !== hit.instance.id;
    if (["pattern", "circularPattern", "mirror"].includes(hit.instance.type)
      && (!canvasSelection.geometryInstances.includes(hit.instance) || wholeSelected)) {
      const instance = hit.instance;
      const sources = geometryInstanceSourceObjects(instance);
      clearSelection();
      canvasSelection.set("geometryInstances", [instance]);
      const plan = { kind: "free-instance", mode: "block", item: instance, sketchId: instance.sketchId,
        startPointer: pointer, startX: instance.x, startY: instance.y,
        clickGeometrySelection: wholeSelected ? { instanceId: instance.id, id: hit.item.id, kind: hit.kind, endpoint: hit.endpoint } : null,
        variableAllowed: (v) => !sources.has(v.object) && !(v.object === instance && v.prop === "rotation") };
      if (!window.PatternInstanceModel.placed(instance) || instance.placement.kind === "circular") {
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
      if (Boolean(node.derivedInstance?.placement)) placements.add(node.derivedInstance);
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




  const { select: selectCanvasContextTarget, constraintHits: constraintHitsFromCanvasContextTarget } = window.CanvasContextTarget.createSelection({
    canvasSelection, sameArcEndpoint, clearSelection, arcEndpointPoint,
  });
  const { state: canvasContextFixState } = window.CanvasContextTarget.createFixObservation({
    selectedFixedBatchTargets, fixedBatchIsFullyFixed, canvasSelection, findLineFixedConstraint, findArcEndpointFixedConstraint, selectedGeometryItems,
  });

  function previewCanvasContextCandidate(target) {
    canvasHover.previewCandidate(target);
    draw();
  }







  const canvasCommandCancellation = window.CanvasCommandCancellation.create({
    instances: geometryInstanceCommand,
    readMode: () => mode, selectMode: () => { mode = "select"; }, blockPlacementCommand, drawingPreview, restoreBlockPlacementPropertiesPanel,
    readPending: pendingCommandSession.read, cancelPendingCommand, readConstraintCommand: () => constraintTargetSession.command, cancelConstraintTargetCommand,
    drawing: { active: hasActiveDrawOperation, cancel: cancelActiveDrawOperation, isToolMode: isDrawToolMode, exit: exitDrawMode },
    applicationText, setHint, updateUI, draw,
  });
  function hasCancellableCanvasCommand() { return canvasCommandCancellation.hasCancellable(); }
  function cancelCanvasCommandFromContextMenu() { return canvasCommandCancellation.cancel(); }

  function hasCopyableCanvasSelection() { return clipboardPayload.canOfferCopy(model, canvasSelection); }

  const { topmostOwner: topmostDrawingOrderOwner, state: drawingOrderCommandState, reorder: reorderSelectedDrawingObjects } = window.DrawingOrderCommand.create({
    currentScope: () => model, canvasSelection, activeSketchId, selectionSketchId, ordinarySelectionMode,
    guardSelectionEdit, updateUI, draw, recordHistory, applicationText, setHint,
  });


  const { items: canvasContextMenuItems } = window.CanvasContextPresentation.createItems({
    readMode: () => mode, sketchProjectionCommand, applicationText, document, canCreateInActiveSketch, visibleGeometryBounds,
    pendingCommandSession, constraintTargetSession, splineEditing, isReadOnlyDimension, selectedDimensionLineGroup,
    blockDefinitionScopeError, blockDefinitionEditError, canvasContextFixState, selectedConstructionTogglePrimitives,
    canvasSelection, selectedGeometryItems, drawingOrderCommandState, hasCopyableCanvasSelection, hasSelection,
  });





  const canvasContextCandidateAction = window.CanvasContextTarget.createCandidateAction({
    constraintTargetSession, handleConstraintOperandClick, constraintHitsFromCanvasContextTarget, selectCanvasContextTarget, updateUI, draw,
  });
  function selectCanvasContextCandidate(target, pointer) { return canvasContextCandidateAction.select(target, pointer); }



  const canvasContextEntry = window.CanvasContextMenu.createEntry({
    canvasContextMenu, isGeometryMode, closeAppMenus: () => closeAppMenus(), canvasPoint, setLastPointer: pointer => { lastPointerWorld = pointer; },
    hasCancellableCanvasCommand, constraintTargetSession, canvasContextCandidatesAt, selectCanvasContextTarget,
    updateUI, draw, canvasContextController, canvasContextMenuItems,
  });
  function openCanvasContextMenu(event) { return canvasContextEntry.open(event); }

  function showSelectedObjectProperties() {
    setPropertiesPanelCollapsed(false);
    updatePropertiesUI();
    const panel = document.getElementById("propertiesPanel");
    if (panel) panel.scrollTop = 0;
    setHint(applicationText("選択したオブジェクトのプロパティを表示します。", "Select an object to display its properties."));
  }

  const canvasContextActions = window.CanvasContextActions.create({
    guardSelectionEdit, guardSketchEdit, elementSketchId, selectionSketchId, activeSketchId,
    commitSketchProjectionCommand, cancelCanvasCommandFromContextMenu, undoHistory, redoHistory, copySelectionToClipboard,
    imageClipboard, document, showSelectedObjectProperties, fixPointBtn, enterBlockDefinitionEdit, setBlockInstanceRotationLocked,
    startDimensionEditInput, selectedDimensionLineGroup, dimensionLineGroup, updateGeometrySelectionUI, draw, recordHistory, applicationText, setHint,
    sketchMoveCommand, startHatchBoundaryRepair, reorderSelectedDrawingObjects, addSplineFitPointFromContext, deleteSplineFitPointFromContext,
    splineEditing, fitVisibleGeometryToViewport,
  });
  function executeCanvasContextAction(action, target, pointer) { return canvasContextActions.execute(action, target, pointer); }

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
    capturePointer: id => canvas.setPointerCapture(id),
    snapForDrawing: point => geometryInstanceCommand.activeInput === "origin"
      ? drawingSnap.resolve(point, 10 / viewport.scale, snap => Boolean(window.PatternInstanceModel.relationFromSnap(geometryInstanceCommand.pending, snap, geometryRefForItem, resolveGeometryRef)))
      : snapForDrawing(point),
    getSnap: () => drawingSnap.active, makeConstraintOperand, setHint, applicationText,
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

  function isBlankCommandPanelPoint(point) {
    const hits = canvasPressQuery.read(point);
    if (!blankCanvasGesture.isBlank({ ...hits, annotationHit: hits.blankAnnotationHit })) return false;
    if ((mode === "sketch-projection" || mode === "instance-sources" && instanceSourceCommand.instance?.type === "sketchProjection")
      && hitReferenceTarget(point.x, point.y)) return false;
    if (["hatch", "hatch-repair"].includes(mode)
      && hatchGeometryQuery.hatchFaceAt(point, { includeConstruction: hatchCommand.includeConstruction }).ok) return false;
    return true;
  }
  const canvasInputBinding = window.CanvasInputBinding.create({
    canvas, pointer: {
      ...pointerInteractionController,
      down: e => {
        if (e.button === 0 && commandPanel?.active) {
          if (commandPanel.canvasPress(canvasScreenPoint(e), isBlankCommandPanelPoint(canvasPoint(e)))) {
            blankCanvasGesture.suppressNext();
            e.preventDefault();
            return;
          }
        }
        if (pngExportCommand?.active && e.button === 0) pngExportCommand.pick(screenToWorld({ x: e.offsetX, y: e.offsetY }));
        else pointerInteractionController.down(e);
      },
      move: (screen, world, shift) => {
        commandPanel?.canvasMove(screen);
        if (pngExportCommand?.active) { if (!canvasNavigation.movePan(screen)) pngExportCommand.move(world); }
        else pointerInteractionController.move(screen, world, shift);
      },
      finish: e => { if (!pngExportCommand?.active || e.button !== 0) pointerInteractionController.finish(e); },
      doubleClick: e => {
        if (blankCanvasGesture.takeSuppression()) { e.preventDefault(); return; }
        if (commandPanel?.active) {
          commandPanel.canvasDoubleClick(isBlankCommandPanelPoint(canvasPoint(e)));
          e.preventDefault();
          return;
        }
        if (!pngExportCommand?.active) pointerInteractionController.doubleClick(e);
      },
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
  const documentGeometryAppearanceCommand = window.DocumentDefaultAppearanceCommand.createGeometry({
    readDefault: key => documentModel[key], writeDefault: (key, value) => { documentModel[key] = value; },
    applyAppearanceInput, normalizeAppearance, normalizeConstructionAppearance, recordHistory, updateUI, draw,
  });
  const documentGeometryAppearanceSettings = window.DocumentAppearanceSettings.createGeometry({
    document, readDefault: key => documentModel[key], normalizeAppearance, normalizeConstructionAppearance,
    appearancePropertyRows, localizeApplicationUI, openAppearanceColorPalette, commands: documentGeometryAppearanceCommand,
  });
  const documentDimensionAppearanceCommand = window.DocumentDefaultAppearanceCommand.createDimension({
    readDefault: key => documentModel[key], writeDefault: (key, value) => { documentModel[key] = value; },
    applyDimensionAppearanceValue, normalizeDimensionDefaults: value => window.Appearance.dimensionDefaults(value), recordHistory, draw,
  });
  const documentDimensionAppearanceSettings = window.DocumentAppearanceSettings.createDimension({
    document, readDefault: key => documentModel[key], normalizeDimensionAppearance, dimensionAppearancePropertyRows,
    prepareAffixInputs, localizeApplicationUI, updateDimensionTerminatorAngleVisibility, updateUI, openAppearanceColorPalette, commands: documentDimensionAppearanceCommand,
  });
  const documentSharedAppearanceCommand = window.DocumentDefaultAppearanceCommand.createShared({
    readDefault: key => documentModel[key], normalizeTerminator: value => window.Appearance.normalizeTerminator(value),
    applyLeaderAppearanceValue: (...args) => appearanceEditing.applyLeaderAppearanceValue(...args), readViewportScale: () => viewport.scale,
    effectiveLeaderAppearanceForSketch, recordHistory, updateUI, draw,
  });
  const documentSharedAppearanceSettings = window.DocumentAppearanceSettings.createShared({
    document, readDefault: key => documentModel[key], appearanceControls, effectiveLeaderAppearanceForSketch, openAppearanceColorPalette, commands: documentSharedAppearanceCommand,
  });
  document.getElementById("documentSettingsBtn")?.addEventListener("click", () => {
    documentGeometryAppearanceSettings.prepare();
    documentDimensionAppearanceSettings.prepare();
    documentSharedAppearanceSettings.prepare();
    document.getElementById("documentSettingsDialog")?.showModal();
  });
  appearancePalette.bind();
  applicationSettings.start();
  blockView.bind();

  const drawingToolBinding = window.ToolbarView.createBinding({
    document, drawOperationLifecycle, startCenterlineCommand, startCircleCenterCrossCommand, startSketchProjectionCommand,
    startGeometryInstanceCommand, constructionCommand, filletCommand, startBlockCreation, offsetCommand, beginSplineCreation, startHatchCreation,
  });
  drawingToolBinding.bind();

  const documentFileControls = window.DocumentFileControls.createDocument({
    document, saveJot2DFile, saveJot2DFileAs, openJot2DFile, documentFileCommand,
  });
  documentFileControls.bind();
  const canvasExport = window.CanvasExport.create({
    canvas, createCanvas: () => document.createElement("canvas"), text: applicationText,
    render: pngRendering.render, restore: pngRendering.restore,
  });
  const pngFile = window.PngFile.create({ window, document, capture: canvasExport.capture, documentName: effectiveDocumentName, text: applicationText,
    prepare: async () => {
      await document.fonts.ready;
      await referenceImageRenderer.ready(model.referenceImages.filter(item => isVisibleValue(item.visible) && isVisibleSketchId(item.sketchId)));
    },
  });
  const pngModeSession = window.PngExportCommand.createModeSession({ readMode: () => mode, setMode: value => { mode = value; }, pendingCommandSession });
  pngExportCommand = window.PngExportCommand.create({
    text: applicationText, save: (region, dpi) => pngFile.save(region, dpi / 96 * viewport.scale),
    viewScale: () => viewport.scale, setHint, refresh: draw,
    begin: pngModeSession.begin,
    end: pngModeSession.end,
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
  const dxfFileControls = window.DocumentFileControls.createDxf({
    document, flushScheduledCanvasPointerMove, fileSession, canImportDxf, setHint, applicationText, dxfImportCommand,
  });
  dxfFileControls.bind();
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



  const fixedOperandCommand = window.FixedToggleCommand.createOperand({
    guardSketchEdit, elementSketchId, operandElement, guardSketchProjectionShapeEdit, applicationText,
    findLineFixedConstraint, LineFixedConstraint, findArcEndpointFixedConstraint, arcEndpointPoint, ArcEndpointFixedConstraint,
    currentScope: workspace.current, GeometryFixedConstraint, sameConstraintDisplayElement, deleteElements, commitNewConstraint,
  });
  function toggleGeometryFixedOperand(operand) { return fixedOperandCommand.toggle(operand); }

  const fixedSelectionCommand = window.FixedToggleCommand.createSelection({
    guardSelectionEdit, canvasSelection, blockDefinitionById, setHint, clearSelection,
    updateUI, draw, recordHistory, findArcEndpointFixedConstraint, deleteElements,
    log, arcEndpointPoint, guardSketchProjectionShapeEdit, applicationText, snapshotModelState,
    commitNewConstraint, ArcEndpointFixedConstraint, restoreModelState, selectedFixedBatchTargets, fixedBatchIsFullyFixed,
    findLineFixedConstraint, pushModelConstraint, LineFixedConstraint, currentScope: workspace.current, solveSketchAndDependents,
    acceptError: CONSTRAINT_ACCEPT_ERROR, refreshConstraintAnalysis,
  });
  function toggleSelectedFixed() { return fixedSelectionCommand.toggle(); }

  const constraintControlCommand = window.ConstraintControlCommand.create({
    constraintTargetSession, cancelConstraintTargetCommand, constraintLabel, startAnnotationAnchorConstraint, startConstraintTargetCommand,
    canApplyConstraint, startDistanceCommand, cancelPendingCommand, updateToolbar, updateConstraintButtons, addConstraint,
    isGeometryMode, hasSelection, toggleSelectedFixed,
  });
  const constraintControlBinding = window.ConstraintControlsView.createBinding({
    constraintButtons, constraintMenuButtons, fixPointBtn, onConstraint: constraintControlCommand.activate, onFixed: constraintControlCommand.activateFixed,
  });
  constraintControlBinding.bind();



  window.addEventListener("resize", () => {
    closeCanvasContextMenu();
    resizeCanvas({ centerWorld: currentCanvasCenterWorld() });
  });

  function installTestHooks() {
    if (!new URLSearchParams(window.location.search).has("test")) return;
    const { createSketchProjectionTarget } = window.SketchProjectionTestDriver.createLegacyTargetConstruction({ addPointToSketch, addLine, addCircle, addArc, addSpline });
    const historyObservation = window.DocumentTestDriver.createHistoryObservation({ activeEditHistory, blockEditor, document, constructionCommand });
    const readTestHistory = historyObservation.state;
    const selectedGeometryObservation = window.CanvasSelectionTestDriver.createIdObservation({ canvasSelection });
    const readTestSelectedGeometry = selectedGeometryObservation.state;
    const constraintStatusObservation = window.ConstraintTestDriver.createStatusObservation({ refreshConstraintAnalysis, elementSketchId, activeSketchId });
    const readTestConstraintStatuses = constraintStatusObservation.state;
    const constraintAnalysisObservation = window.ConstraintTestDriver.createAnalysisObservation({
      activeSketchId, sketchSolveVariables, sketchSolveConstraints, sketchSolveLines, analyzeConstraintState: options => solver.analyzeConstraintState(options),
      acceptError: CONSTRAINT_ACCEPT_ERROR, vectorNorm, currentScope: workspace.current, elementSketchId,
    });
    const blockConstraintObservation = window.ConstraintTestDriver.createBlockObservation({ refreshConstraintAnalysis, blockProjectionBundles });
    const blockConstraintInsertion = window.ConstraintTestDriver.createBlockConstraintInsertion({
      blockInstanceById, blockProjectionBundle, commitNewConstraint, PointOnLineConstraint, readAnalysis: constraintAnalysisObservation.analysis, readBlockState: blockConstraintObservation.state, serializeModel,
    });
    const geometryDragTestDriver = window.GeometryDragTestDriver.createGeometryDriver({
      currentScope: workspace.current, buildDragSession, attachLocalSolveContext, dragResultForSession, solveFinalDragSession, normalizeArcSweeps, vectorNorm, sketchSolveConstraints, arcEndpointPoint,
      computeErrorVector: constraints => solver.computeErrorVectorForConstraints(constraints), now: () => performance.now(), readConstraintStatuses: readTestConstraintStatuses,
    });
    const pointDragTestDriver = window.GeometryDragTestDriver.createPointDriver({
      currentScope: workspace.current, buildDragSession, attachLocalSolveContext, dragResultForSession, solveFinalDragSession, normalizeArcSweeps, vectorNorm, sketchSolveConstraints,
      computeErrorVector: constraints => solver.computeErrorVectorForConstraints(constraints), targetConstraintCount: geometryDragSolver.targetConstraintCount, now: () => performance.now(),
    });
    const annotationDimensionObservation = window.AnnotationTestDriver.createDimensionObservation({ annotationDimensions, targetFromConstraint, dimensionLayout, effectiveDimensionAppearance, dimensionLabelForConstraint });
    const annotationAppearanceObservation = window.AnnotationTestDriver.createAppearanceObservation({
      currentScope: workspace.current, viewport, clampZoom, effectiveAnnotationStyle, draw, annotationTextMetrics, annotationTextLayout, annotationLeaderDisplayGeometry, annotationTextWorldHeight,
      screenPxPerMm: ANNOTATION_SCREEN_PX_PER_MM, annotationDisplayFactor: window.Appearance.annotationDisplayFactor, annotationLeaderAnchor, displayText: window.AnnotationRenderer.displayText, formatDisplayNumber, serializeAnnotation,
    });
    const annotationOwnershipObservation = window.AnnotationTestDriver.createOwnershipObservation({
      canvas, worldToCanvasScreen, annotationTextLayout, annotationLeaderDisplayGeometry, currentScope: workspace.current, serializeAnnotation, allAnnotations,
      displayText: window.AnnotationRenderer.displayText, formatDisplayNumber, effectiveAnnotationStyle, annotationLeaderAnchor, canvasSelection, allGeometryBounds,
    });
    const annotationSnapshotObservation = window.AnnotationTestDriver.createSnapshot({ currentScope: workspace.current, annotationLeaderDisplayGeometry, canvas, worldToCanvasScreen });
    const annotationDragFixture = window.AnnotationTestDriver.createDragFixture({
      resetModelState, addPoint, addLine, annotationLeaderTargetFromItem, pushAnnotation, defaultStyle: DEFAULT_ANNOTATION_STYLE, resizeCanvas, readSnapshot: annotationSnapshotObservation.snapshot,
    });
    const annotationHitObservation = window.AnnotationTestDriver.createHitObservation({ canvas, screenToWorld, hitAnnotationElement });
    const readOnlyDuplicateFixture = window.DimensionTestDriver.createReadOnlyDuplicateFixture({
      resetModelState, addPoint, addLine, dimensionFromAnchor, addDistanceConstraintFromTarget, activeSketchId, currentScope: workspace.current,
      isDimensionConstraint, dimensionLayout, hypot2, isReadOnlyDimension, dimensionLabelForConstraint, targetFromConstraint, defaultDimensionForTarget, serializeModel,
    });
    const readOnlyPlacementFixture = window.DimensionTestDriver.createReadOnlyPlacementFixture({
      resetModelState, addPoint, addLine, addDistanceConstraintFromTarget, dimensionFromAnchor, activeSketchId, constraintTargetSession, pendingCommandSession,
      startDistanceValueInput, dimensionValueInput, currentScope: workspace.current, isReadOnlyDimension, isDimensionConstraint,
    });
    const extensionVisibilityFixture = window.DimensionTestDriver.createExtensionVisibilityFixture({ resetModelState, addPoint, addLine, hypot2, dimensionLayout, dimensionWithLabelAt, dimensionFromAnchor });
    const dimensionDisplayCases = window.DimensionTestDriver.createDisplayCases({ formatDimensionLabel, formatMeasuredDimensionLabel });
    const dimensionTextAngleCases = window.DimensionTestDriver.createTextAngleCases({ jisDimensionTextAngle, dimensionTextOffset });
    const angleLabelFixture = window.DimensionTestDriver.createAngleLabelFixture({
      resetModelState, addPoint, addLine, dimensionFromAnchor, angleDimensionLabelBasis, angleDimensionLayout, angleDimensionLabelOffsets,
      setAngleDimensionLabelOffsets, angleDimensionFromLabelPoint, hypot2, serializeDimension,
    });
    const trimLineTransferFixture = window.TrimTestDriver.createLineTransferFixture({ resetModelState, addPoint, addLine, pushModelConstraint, PointOnLineConstraint, executeLineTrim, currentScope: workspace.current });
    const trimConstructionFixture = window.TrimTestDriver.createConstructionBoundaryFixture({
      resetModelState, addPoint, addLine, addCircle, addArc, lineTrimBoundaries, trimPreviewForLine, arcTrimBoundaries, trimPreviewForArc, circlePointAtAngle, circleTrimBoundaries, trimPreviewForCircle,
    });
    const trimDiameterFixture = window.TrimTestDriver.createDiameterTransferFixture({ resetModelState, addCircle, addPoint, pushModelConstraint, DiameterConstraint, angleAtCircleParam, circlePointAtAngle, executeCircleTrim, currentScope: workspace.current });
    const allGeometryFitFixture = window.CanvasTestDriver.createAllGeometryFitFixture({
      resetModelState, addPoint, addLine, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID, viewport, fitAllGeometryToViewport, allGeometryBounds, screenBoxForBounds, canvas,
    });
    const middleButtonFitFixture = window.CanvasTestDriver.createMiddleButtonFitFixture({ resetModelState, addPoint, addLine, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID, viewport, updateUI, draw, canvas });
    const fitObservation = window.CanvasTestDriver.createFitObservation({ canvas, viewport, screenBoxForBounds, visibleGeometryBounds, isVisibleSketchId });
    const testFitOperation = window.CanvasTestDriver.createFitOperation({ fitAllGeometryToViewport, draw });
    const sketchVisibilityFixture = window.DimensionTestDriver.createSketchVisibilityFixture({
      resetModelState, activeSketchId, addPoint, addLine, addDistanceConstraintFromTarget, dimensionFromAnchor, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID,
      ctx, drawDimensions, sketchById, isDimensionConstraint, constraintSketchId, isVisibleSketchId,
    });
    const setTestDrawingMode = value => { mode = value; };
    const draftDashCases = window.CanvasRenderTestDriver.createDraftDashCases({
      setMode: setTestDrawingMode, lineCommand, rectangleCommand, slotCommand, circularCommands, offsetSelection, drawingPreview, addLine, addPoint,
      drawTemporaryLine: authoringPreviewLayer.drawTemporaryLine, drawRectanglePreview: authoringPreviewLayer.drawRectanglePreview, drawSlotPreview: authoringPreviewLayer.drawSlotPreview, drawCirclePreview: authoringPreviewLayer.drawCirclePreview, drawArcPreview: authoringPreviewLayer.drawArcPreview, drawOffsetPreview: offsetPreviewLayer.draw, drawTrimPreview: authoringPreviewLayer.drawTrimPreview,
    });
    const blockDashCases = window.CanvasRenderTestDriver.createBlockDashCases({
      createEmptyBlockDefinition, Point, Line, defaultSketchId: DEFAULT_SKETCH_ID, appendDefinition: definition => documentModel.blockDefinitions.push(definition),
      setMode: setTestDrawingMode, blockPlacementCommand, drawingPreview, activeSketchId, currentScope: workspace.current, canvasSelection, drawBlockPlacementPreview: placementPreviewLayer.drawBlockPlacementPreview, drawBlockInstanceHandles,
    });
    const canvasDashIsolation = window.CanvasRenderTestDriver.createDashIsolation({
      resetModelState, viewport, drawingPreview, selectionRectangle, setMode: setTestDrawingMode, ctx, drawSelectionRect, draftCases: draftDashCases, blockCases: blockDashCases, drawAnnotationLeader, addLine, addPoint, draw,
    });
    const sketchDeletionFixture = window.DocumentTestDriver.createSketchDeletionFixture({ resetModelState, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID, addPoint, addLine, addCircle, geometryRefForItem, deleteSketch });
    const strokeStyleCases = window.PropertiesTestDriver.createStrokeStyleCases({ resetModelState, addLine, addPoint, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID, defaultSketchId: DEFAULT_SKETCH_ID, geometryStrokeWidth, constructionAlpha: CONSTRUCTION_GEOMETRY_ALPHA });
    const constructionHoverFixture = window.CanvasRenderTestDriver.createConstructionHoverFixture({
      ctx, viewport, drawLines, resetModelState, addLine, addPoint, canvasHover, createEmptyBlockDefinition, Point, Line, defaultSketchId: DEFAULT_SKETCH_ID,
      appendDefinition: definition => documentModel.blockDefinitions.push(definition), currentScope: workspace.current, invalidateBlockProjectionCache, blockProjectionBundle,
    });
    const constructionLineObservation = window.CanvasRenderTestDriver.createConstructionLineObservation({ allGeometryLines, ctx, drawLines, viewport, effectiveAppearanceForElement });
    const subtreeReferenceFixture = window.SketchTreeTestDriver.createSubtreeReferenceFixture({
      resetModelState, sketchById, defaultSketchId: DEFAULT_SKETCH_ID, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID, addPoint, addLine, refreshReferenceConstraintValidity,
      fitAllGeometryToViewport, updateUI, draw, canvas, worldToCanvasScreen, sketchRelationToActive, sketchIdentityRelationLabel, sketchIdentityRelationColor, document, getComputedStyle: element => getComputedStyle(element), isVisibleSketchId,
    });
    const subtreeVisibilityObservation = window.SketchTreeTestDriver.createSubtreeVisibilityObservation({ sketchById, isVisibleSketchId });
    const referenceLineMove = window.ConstraintTestDriver.createReferenceLineMove({ currentScope: workspace.current, elementSketchId, solveReferenceDependentSketches, refreshConstraintAnalysis, updateUI, draw, defaultSketchId: DEFAULT_SKETCH_ID, isExplicitPoint });
    const dependencyOrderFixture = window.ConstraintTestDriver.createDependencyOrderFixture({
      resetModelState, sketchById, defaultSketchId: DEFAULT_SKETCH_ID, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID, addLine, addPoint, markReferenceConstraint, PointOnLineConstraint, CoincidentConstraint, refreshReferenceConstraintValidity, solveReferenceDependentSketches,
    });
    const cyclicReferenceFixture = window.DocumentTestDriver.createCyclicReferenceFixture({
      resetModelState, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID, defaultSketchId: DEFAULT_SKETCH_ID, addPoint, markReferenceConstraint, CoincidentConstraint, serializeModel, loadModelData,
      refreshConstraintAnalysis, updateUI, constraintIsOperational, readReferenceErrors: () => referenceConstraintState.errorReasons(), document,
    });
    const dimensionSelectionFixture = window.ConstraintTestDriver.createDimensionSelectionFixture({ resetModelState, addPoint, addLine, DistanceConstraint, dimensionFromAnchor, pushModelConstraint, canvasSelection, constraintTargetSession, updateUI, fitAllGeometryToViewport, draw, canvas });
    const dimensionSelectionObservation = window.ConstraintTestDriver.createDimensionSelectionObservation({ canvasSelection, constraintTargetSession });
    const supportStatusFixture = window.ConstraintTestDriver.createSupportStatusFixture({
      resetModelState, addPoint, addLine, pushModelConstraint, HorizontalConstraint, PointOnLineConstraint, addArc, RadiusConstraint, solveSketchAndDependents, activeSketchId, snapshotModelState,
      refreshConstraintAnalysis, fitAllGeometryToViewport, draw, constraintStatusOf, constraintStatusColor, readSummary: () => constraintAnalysis.summary(),
    });
    const parentPointLineFixture = window.ConstraintTestDriver.createParentPointLineFixture({ resetModelState, addPoint, addLine, activeSketchId, currentScope: workspace.current, fitAllGeometryToViewport, updateUI, draw, canvas, worldToCanvasScreen });
    const siblingPointLineFixture = window.ConstraintTestDriver.createSiblingPointLineFixture({ resetModelState, addPoint, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID, addLine, defaultSketchId: DEFAULT_SKETCH_ID, fitAllGeometryToViewport, updateUI, draw, canvas, worldToCanvasScreen });
    const siblingReferenceMove = window.ConstraintTestDriver.createSiblingReferenceMove({ currentScope: workspace.current, elementSketchId, solveReferenceDependentSketches, refreshConstraintAnalysis, updateUI, draw, defaultSketchId: DEFAULT_SKETCH_ID, isExplicitPoint, wouldCreateReferenceCycle });
    const pointLineObservation = window.ConstraintTestDriver.createPointLineObservation({ currentScope: workspace.current, PointOnLineConstraint, signedPointLineDistance, constraintSketchId });
    const blockCreationFixture = window.BlockTestDriver.createCreationFixture({ resetModelState, addPoint, addLine, pushModelConstraint, HorizontalConstraint, VerticalConstraint, canvasSelection, fitAllGeometryToViewport, updateUI, draw, canvas, worldToCanvasScreen });
    const emptyBlockFixture = window.BlockTestDriver.createEmptyFixture({ resetModelState, updateUI, draw, readDefinitionCount: () => documentModel.blockDefinitions.length, currentScope: workspace.current });
    const blockRotationObservation = window.BlockTestDriver.createRotationObservation({ blockInstanceById, currentScope: workspace.current, blockInstanceDisplayCenter, readSolverVariables: () => solver.getVariables(), buildDragSession });
    const blockEndpointObservation = window.BlockTestDriver.createEndpointObservation({ currentScope: workspace.current, blockProjectionBundle, worldToCanvasScreen, canvas });
    const blockHoverObservation = window.BlockTestDriver.createHoverObservation({ constraintTargetSession, canvasHover });
    const blockEditorObservation = window.BlockTestDriver.createEditorObservation({ blockEditor, blockEditorSessionChain, currentScope: workspace.current });
    const blockPlacementAction = window.BlockTestDriver.createPlacementAction({ readMode: () => mode, blockPlacementCommand, commitBlockPlacement });
    const nestedConstraintAction = window.BlockTestDriver.createNestedConstraintAction({ currentScope: workspace.current, blockProjectionBundle, HorizontalConstraint, VerticalConstraint, pushModelConstraint, solveSketchById, invalidateBlockProjectionCache, recordHistory, updateUI, draw, serializeConstraint });
    const blockChildGeometryAction = window.BlockTestDriver.createChildGeometryAction({ blockEditor, createSketch, activeSketchId, addLine, addPoint, recordHistory, updateUI, draw, currentScope: workspace.current });
    const blockCancelAction = window.BlockTestDriver.createCancelAction({ cancelBlockDefinitionEdit, blockEditor, readDefinitionCount: () => documentModel.blockDefinitions.length, currentScope: workspace.current });
    const blockCompleteAction = window.BlockTestDriver.createCompleteAction({ completeBlockDefinitionEdit, blockEditor, readDefinitionCount: () => documentModel.blockDefinitions.length, currentScope: workspace.current });
    const blockEnabledSketchAction = window.BlockTestDriver.createEnabledSketchAction({ currentScope: workspace.current, setBlockInstanceEnabledSketchIds });
    const blockRejectionFixture = window.BlockTestDriver.createRejectionFixture({ resetModelState, addPoint, addLine, canvasSelection, blockSelectionGeometry, readDefinitionCount: () => documentModel.blockDefinitions.length, currentScope: workspace.current, activeSketchId, geometryRefForItem });
    const blockStateObservation = window.BlockTestDriver.createStateObservation({ blockProjectionBundles, readDefinitions: () => documentModel.blockDefinitions, currentScope: workspace.current, canvasSelection, readMode: () => mode, serializeModel });
    const blockReload = window.BlockTestDriver.createReload({ serializeModel, loadModelData, updateUI, draw, readDefinitions: () => documentModel.blockDefinitions, currentScope: workspace.current, allGeometryLines });
    const legacyBlockReload = window.BlockTestDriver.createLegacyReload({ serializeModel, loadModelData, updateUI, draw, readDefinitions: () => documentModel.blockDefinitions, currentScope: workspace.current, blockProjectionBundle });
    const sidebarHighlightObservation = window.PropertiesTestDriver.createHighlightObservation({ canvasSelection, effectiveSelectedConstraint, constraintHighlightNodes, selectionHighlight, canvasHover });
    const sidebarHoverKeyObservation = window.PropertiesTestDriver.createHoverKeyObservation({ allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines, isSidebarHoveredElement, geometryElementKey });
    const definitionUpdateFixture = window.BlockTestDriver.createDefinitionUpdateFixture({ readDefinitions: () => documentModel.blockDefinitions, currentScope: workspace.current, blockProjectionBundle, enterBlockDefinitionEdit, blockEditor, completeBlockDefinitionEdit });
    const blockDimensionFixture = window.BlockTestDriver.createReadOnlyDimensionFixture({ currentScope: workspace.current, blockProjectionBundle, defaultDimensionForTarget, readOnlyDimensionConstraintForPlacement, addReadOnlyDimensionConstraint });
    const blockExternalFixture = window.BlockTestDriver.createExternalConstraintFixture({ currentScope: workspace.current, blockDefinitionById, blockProjectionBundle, addPoint, CoincidentConstraint, pushModelConstraint, solveSketchById, invalidateBlockProjectionCache, hypot2 });
    const canvasTestDriver = window.CanvasTestDriver.create({ viewport, clampZoom, resizeCanvas, draw, canvas, currentCanvasCenterWorld, worldToCanvasScreen });
    const blockInteractionObservation = window.BlockTestDriver.createInteractionObservation({ blockInstanceById, currentScope: workspace.current, canvas, blockProjectionBundle, worldToCanvasScreen, blockInstanceDisplayCenter, viewport });
    const dimensionPositionObservation = window.DimensionTestDriver.createPositionObservation({ currentScope: workspace.current, isDimensionConstraint, targetFromConstraint, dimensionLayout, clientPosition: canvasTestDriver.clientPosition });
    const dimensionExpressionAction = window.DimensionTestDriver.createExpressionAction({ currentScope: workspace.current, isDimensionConstraint, startDimensionEditInput });
    const dimensionSelectionDriver = window.DimensionTestDriver.createSelectionDriver({ currentScope: workspace.current, isDimensionConstraint, clearSelection, canvasSelection, updateUI, draw });
    const commandLineDragFixture = window.DimensionTestDriver.createCommandLineDragFixture({ resetModelState, addPoint, addLine, addDistanceConstraintFromTarget, dimensionFromAnchor, activeSketchId, constraintTargetSession, canvasSelection, fitAllGeometryToViewport, startDistanceCommand, currentScope: workspace.current, isDimensionConstraint, constraintGraphNodes, targetFromConstraint, dimensionLayout, worldToCanvasScreen, canvas, viewport, dimensionAnchor });
    const clickPlacementFixture = window.DimensionTestDriver.createClickPlacementFixture({ resetModelState, addLine, addPoint, fitAllGeometryToViewport, updateUI, draw, canvas, worldToCanvasScreen });
    const lineCircleFixture = window.DimensionTestDriver.createLineCircleFixture({ resetModelState, addLine, addPoint, addCircle, addArc, fitAllGeometryToViewport, updateUI, draw, canvas, worldToCanvasScreen });
    const lineCircleObservation = window.DimensionTestDriver.createLineCircleObservation({ serializeModel, currentScope: workspace.current, LineCircleDistanceConstraint, ConcentricRadiusDifferenceConstraint, pendingCommandSession, constraintTargetSession, signedPointLineDistance, vectorNorm, hypot2 });
    const radiusDifferenceRecovery = window.DimensionTestDriver.createRadiusDifferenceRecovery({ currentScope: workspace.current, ConcentricRadiusDifferenceConstraint, hypot2, solveSketchAndDependents, activeSketchId, snapshotModelState, refreshConstraintAnalysis, updateUI, draw, vectorNorm });
    const clickPlacementObservation = window.DimensionTestDriver.createClickPlacementObservation({ currentScope: workspace.current, isDimensionConstraint, dimensionValueInput, pendingCommandSession });
    const commandLineDragObservation = window.DimensionTestDriver.createCommandLineDragObservation({ currentScope: workspace.current, isDimensionConstraint, targetFromConstraint, dimensionAnchor, constraintTargetSession, pendingCommandSession, canvasSelection, dimensionDrag });
    const themeObservation = window.PropertiesTestDriver.createThemeObservation({ applicationSettings, readDefaultGeometryColor: () => DEFAULT_APPEARANCE.color, canvasThemeColor, CanvasThemeColors: window.CanvasThemeColors });
    const documentNameObservation = window.DocumentTestDriver.createNameObservation({ readDocumentName: () => documentModel.documentName, effectiveDocumentName, serializeModel, document });
    const fileObservation = window.DocumentTestDriver.createFileObservation({ fileSession });
    const viewObservation = window.CanvasTestDriver.createViewObservation({ viewState, constraintStatusView });
    const sketchVisibilityObservation = window.SketchTreeTestDriver.createVisibilityObservation({ sketchById, serializeModel, isVisibleSketchId, document });
    const responsiveDragFixture = window.GeometryDragTestDriver.createResponsiveFixture({ sampleModel, fitAllGeometryToViewport, draw, resetHistory, serializeModel });
    const fixedPointFixture = window.CanvasTestDriver.createFixedPointFixture({ resetModelState, viewport, addPoint, updateUI, fitAllGeometryToViewport, draw, canvas, clientPosition: canvasTestDriver.clientPosition });
    const offsetChainFixture = window.OffsetTestDriver.createChainFixture({ resetModelState, addPoint, addLine, fitAllGeometryToViewport, resetHistory, draw, canvas, worldToCanvasScreen });
    const offsetChainObservation = window.OffsetTestDriver.createChainObservation({ currentScope: workspace.current, OffsetChainConstraint, serializeModel, offsetSelection, pendingCommandSession, Line });
    const offsetChainReload = window.OffsetTestDriver.createChainReload({ serializeModel, loadModelData, currentScope: workspace.current, OffsetChainConstraint });
    const offsetChainTargetEdit = window.OffsetTestDriver.createChainTargetEdit({ currentScope: workspace.current, OffsetChainConstraint, preconditionNewConstraint, targetFromConstraint, measuredConstraintTargetValue, Line });
    const offsetChainReselection = window.OffsetTestDriver.createChainReselection({ currentScope: workspace.current, OffsetChainConstraint, offsetSelection, addOffsetChainGeometry, clearSelection });
    const offsetPrimitiveFixture = window.OffsetTestDriver.createPrimitiveFixture({
      resetModelState, addPoint, addLine, addCircle, addArc, pushModelConstraint, RadiusConstraint, createOffsetGeometry, currentScope: workspace.current, OffsetConstraint, preconditionNewConstraint,
      solveSketchAndDependents, activeSketchId, snapshotModelState, measuredConstraintTargetValue, serializeModel, loadModelData, fitAllGeometryToViewport, draw,
    });
    const offsetUiFixture = window.OffsetTestDriver.createUiFixture({ resetModelState, addPoint, addLine, fitAllGeometryToViewport, draw, canvas, worldToCanvasScreen });
    const offsetUiObservation = window.OffsetTestDriver.createUiObservation({ currentScope: workspace.current, OffsetConstraint, offsetSelection, drawingPreview, offsetDistanceFromPointer, pendingCommandSession, document, Line });
    const offsetDirectionFixture = window.OffsetTestDriver.createDirectionFixture({ resetModelState, addPoint, addLine, pushModelConstraint, HorizontalConstraint, VerticalConstraint, solveAndRefresh, fitAllGeometryToViewport, draw, canvas, worldToCanvasScreen });
    const siblingVisibilityFixture = window.SketchTreeTestDriver.createSiblingVisibilityFixture({ resetModelState, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID, defaultSketchId: DEFAULT_SKETCH_ID, addPoint, addLine, updateUI, draw, isVisibleSketchId, sketchRelationToActive, sketchStrokeWidth, constraintStatusColor, document });
    const inactiveHoverFixture = window.SketchTreeTestDriver.createInactiveHoverFixture({
      resetModelState, activeSketchId, addPoint, addLine, addDistanceConstraintFromTarget, dimensionFromAnchor, currentScope: workspace.current, isDimensionConstraint, createEmptyBlockDefinition, Point, Line,
      appendDefinition: definition => documentModel.blockDefinitions.push(definition), nextInstanceId: () => `BI${blockInstanceSeq++}`, invalidateBlockProjectionCache, fitAllGeometryToViewport, viewport, updateUI, draw,
      dimensionLayout, targetFromConstraint, clientPosition: canvasTestDriver.clientPosition, blockInstanceDisplayCenter, sketchIdentityRelationLabel,
    });
    const hoverIdentityObservation = window.SketchTreeTestDriver.createIdentityObservation({ canvasHover, sketchIdentityRelationLabel });
    const sidebarInspectionFixture = window.PropertiesTestDriver.createInspectionFixture({
      resetModelState, addPoint, addLine, addCircle, addArc, pushModelConstraint, HorizontalConstraint, DistanceConstraint, dimensionFromAnchor, assignConstraintSketchId, activeSketchId, currentScope: workspace.current, updateUI, fitAllGeometryToViewport, draw, canvas, worldToCanvasScreen,
    });
    const rootHoverFixture = window.SketchTreeTestDriver.createRootHoverFixture({
      resetModelState, addPoint, addLine, addCircle, addArc, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID, createEmptyBlockDefinition, Point, Line, defaultSketchId: DEFAULT_SKETCH_ID,
      appendDefinition: definition => documentModel.blockDefinitions.push(definition), nextInstanceId: () => `BI${blockInstanceSeq++}`, invalidateBlockProjectionCache, updateUI, fitAllGeometryToViewport, draw,
    });
    const blockHoverFixture = window.SketchTreeTestDriver.createBlockHoverFixture({
      resetModelState, viewport, createEmptyBlockDefinition, Point, Line, defaultSketchId: DEFAULT_SKETCH_ID, appendDefinition: definition => documentModel.blockDefinitions.push(definition), nextInstanceId: () => `BI${blockInstanceSeq++}`,
      currentScope: workspace.current, invalidateBlockProjectionCache, updateUI, fitAllGeometryToViewport, draw, blockProjectionBundle, clientPosition: canvasTestDriver.clientPosition,
    });
    const sketchProjectionTestObservation = window.SketchProjectionTestDriver.createObservation({
      types: { Point, Line, Circle, Arc }, currentScope: workspace.current, readMode: () => mode,
      readStagedCount: () => sketchProjectionCommand.count, readConstraints: sketchProjectionConstraints,
      constraintGeometryId, constraintSketchId, effectiveAppearanceForElement, geometryDisplayColor,
      constraintStatusOf, constraintStatusColor, constraintIsRedundant, serializeModel, readHistory: readTestHistory, document,
    });
    const sketchProjectionGeometryFixture = window.SketchProjectionTestDriver.createGeometryFixture({
      resetModelState, currentScope: workspace.current, DEFAULT_SKETCH_ID, addPoint, addLine, addCircle, addArc, addSpline,
      focus: canvasTestDriver.focus, clientPosition: canvasTestDriver.clientPosition, splineGeometry: window.SplineGeometry,
      resetHistory, updateUI, draw,
    });
    const sketchProjectionCompatibilityFixture = window.SketchProjectionTestDriver.createCompatibilityFixture({
      resetModelState, currentScope: workspace.current, DEFAULT_SKETCH_ID, addPoint, addLine, addCircle, addArc, addSpline,
      createSketchProjectionTarget, SketchProjectionConstraint, markReferenceConstraint, pushModelConstraint,
      synchronizeSketchProjectionMetadata, solveSketchAndDependents, serializeModel, loadModelData,
      resetHistory, updateUI, draw, readState: sketchProjectionTestObservation.state,
    });
    const sketchProjectionBlockEditorFixture = window.SketchProjectionTestDriver.createBlockEditorFixture({
      resetModelState, currentScope: workspace.current, DEFAULT_SKETCH_ID, createEmptyBlockDefinition, openBlockDefinitionEditor,
      addLine, addPoint, focus: canvasTestDriver.focus, clientPosition: canvasTestDriver.clientPosition,
      resetBlockEditorHistory, updateUI, draw, completeBlockDefinitionEdit, isEditingBlock: () => Boolean(blockEditor.current), serializeModel,
    });
    const sketchProjectionBlockFixture = window.SketchProjectionTestDriver.createBlockProjectionFixture({
      resetModelState, createEmptyBlockDefinition, Point, Line, DEFAULT_SKETCH_ID,
      appendDefinition: definition => documentModel.blockDefinitions.push(definition), nextInstanceId: () => `BI${blockInstanceSeq++}`,
      currentScope: workspace.current, invalidateBlockProjectionCache, blockProjectionBundle,
      focus: canvasTestDriver.focus, clientPosition: canvasTestDriver.clientPosition, resetHistory, updateUI, draw,
    });
    const sketchProjectionBlockInteraction = window.SketchProjectionTestDriver.createBlockProjectionInteraction({
      currentScope: workspace.current, invalidateBlockProjectionCache, solveSketchAndDependents, DEFAULT_SKETCH_ID,
      updateUI, draw, readState: sketchProjectionTestObservation.state, clearSelection, canvasSelection, deleteCurrentSelection,
    });
    const sketchProjectionGeometryInteraction = window.SketchProjectionTestDriver.createGeometryInteraction({
      types: { Point, Line, Circle, Arc, Spline }, readConstraints: sketchProjectionConstraints, clearSelection, canvasSelection, updateUI, draw,
      readState: sketchProjectionTestObservation.state, clientPosition: canvasTestDriver.clientPosition, constraintGeometryId,
      setAppearanceForSelection, deleteElements, deleteCurrentSelection, deleteSketch, DEFAULT_SKETCH_ID,
    });
    const sketchProjectionSourceEditing = window.SketchProjectionTestDriver.createSourceEditing({
      currentScope: workspace.current, DEFAULT_SKETCH_ID, elementSketchId, addPointToSketch, solveSketchAndDependents,
      updateUI, draw, readState: sketchProjectionTestObservation.state, readConstraints: sketchProjectionConstraints,
      constraintSketchId, sketchProjectionSourceKey, createSketchProjectionTarget, SketchProjectionConstraint,
      markReferenceConstraint, pushModelConstraint, synchronizeSketchProjectionMetadata,
    });
    const sketchProjectionReload = window.SketchProjectionTestDriver.createReload({
      CURRENT_JSON_VERSION, serializeModel, loadModelData, updateUI, draw, readState: sketchProjectionTestObservation.state,
    });
    const sketchProjectionEligibilityFixture = window.SketchProjectionTestDriver.createEligibilityFixture({
      resetModelState, currentScope: workspace.current, DEFAULT_SKETCH_ID, ROOT_SKETCH_ID, addPointToSketch, Line, sketchProjectionEntryFromOperand,
    });
    const sketchProjectionTransfer = window.SketchProjectionTestDriver.createTransfer({
      select: sketchProjectionGeometryInteraction.select, readConstraints: sketchProjectionConstraints,
      copySelectionToClipboard, pasteGeometryClipboard, clipboardSession, readState: sketchProjectionTestObservation.state,
      blockSelectionGeometry, createBlockDefinitionFromSelection, blockSelectionBoundsCenter, SketchProjectionConstraint,
    });
    const constraintInputObservation = window.ConstraintTestDriver.createInputObservation({
      readSelectedGeometry: readTestSelectedGeometry, canvasSelection, constraintTargetSession, operandElement,
    });
    const constraintIntentTestDriver = window.ConstraintTestDriver.createIntentResolution({ currentScope: workspace.current, makeConstraintOperand, resolveConstraintIntent, serializeConstraint });
    const hoverDisplayObservation = window.PropertiesTestDriver.createHoverObservation({
      allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines, blockInstanceById, blockProjectionBundle, effectiveAppearanceForElement,
      isSidebarHighlightedElement, Point, isAnyLineEndpoint, isSidebarHoveredElement, canvasHover, geometryDisplayColor, geometryStrokeWidth,
    });
    const snapObservation = window.CanvasTestDriver.createSnapObservation({ viewport, snapCandidates });
    const authoringObservation = window.CanvasTestDriver.createAuthoringObservation({
      readMode: () => mode, constraintTargetSession, pendingCommandSession, drawingSnap, centerlineCommand, currentScope: workspace.current,
      decorateSerializedConstraint, serializeConstraint, readPerformance: () => lastAuthoringPerformance, readSelectedGeometry: readTestSelectedGeometry,
    });
    const selectableLinePosition = window.CanvasTestDriver.createSelectableLinePosition({
      currentScope: workspace.current, canvas, hitPoint, hitLine, hitDimension, worldToCanvasScreen, elementFromPoint: (x, y) => document.elementFromPoint(x, y),
    });
    const geometryHitObservation = window.CanvasTestDriver.createHitObservation({ hitArcEndpoint, hitPoint, hitLine, hitCircle, hitArc, hitSpline });
    const geometryPositionObservation = window.CanvasTestDriver.createGeometryPosition({
      currentScope: workspace.current, evaluateSpline: window.SplineGeometry.evaluate, clientPosition: canvasTestDriver.clientPosition,
    });
    const sketchMoveObservation = window.CanvasSelectionTestDriver.createMoveObservation({
      sketchMoveCommand, activeSketchId, fields: window.SketchMove.fields, canvasSelection, currentScope: workspace.current,
      decorateSerializedConstraint, serializeConstraint, serializeModel, isEditingBlock: () => Boolean(blockEditor.current),
    });
    const displayZoomObservation = window.CanvasTestDriver.createZoomObservation({ viewport, clampZoom, readUnits: () => documentModel.units, formatZoom, cssPxPerMm: CSS_PX_PER_MM });
    const geometryIdSelection = window.CanvasSelectionTestDriver.createIdSelection({
      clearSelection, currentScope: workspace.current, canvasSelection, updateUI, draw, blockSelectionGeometry, readSelectedGeometry: readTestSelectedGeometry,
    });
    const overlapSelectionFixture = window.CanvasSelectionTestDriver.createOverlapFixture({
      resetModelState, addLine, addPoint, currentScope: workspace.current, ROOT_SKETCH_ID, DEFAULT_SKETCH_ID, createEmptyBlockDefinition, Point, Line,
      appendDefinition: definition => documentModel.blockDefinitions.push(definition), nextInstanceId: () => `BI${blockInstanceSeq++}`,
      invalidateBlockProjectionCache, canvasSelection, fitSketchToViewport, activeSketchId, resetHistory, updateUI, draw, clientPosition: canvasTestDriver.clientPosition,
    });
    const endpointSelectionFixture = window.CanvasSelectionTestDriver.createEndpointFixture({
      resetModelState, addPoint, addLine, addArc, fitSketchToViewport, activeSketchId, resetHistory, updateUI, draw, clientPosition: canvasTestDriver.clientPosition, arcEndpointPoint,
    });
    const contextSelectionObservation = window.CanvasSelectionTestDriver.createObservation({
      canvasHover, canvasContextMenu, canvasContextController, canvasContextCandidatePresentation, readSelectedGeometry: readTestSelectedGeometry,
    });
    const contextPointInsertion = window.CanvasSelectionTestDriver.createPointInsertion({ canvas, viewport, addPoint, updateUI, draw, clientPosition: canvasTestDriver.clientPosition });
    const documentTestImport = window.DocumentTestDriver.createImport({
      performance, File, importFileData, readDocumentName: () => documentModel.documentName, effectiveDocumentName, serializeModel, document,
    });
    const documentTestLoad = window.DocumentTestDriver.createLoad({ loadModelData, fileNameStem, resetHistory, updateUI, draw, currentScope: workspace.current });
    const propertyAppearanceObservation = window.PropertiesTestDriver.createAppearanceObservation({
      allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines, blockInstanceById, blockProjectionBundle,
      normalizeAppearance, effectiveAppearanceForElement, isVisibleSketchElement,
    });
    const propertiesFixture = window.PropertiesTestDriver.createFixture({
      resetModelState, clearSelection, addPoint, addLine, addCircle, canvasSelection, currentScope: workspace.current, ROOT_SKETCH_ID, resetHistory, updateUI, draw,
    });
    const propertiesObservation = window.PropertiesTestDriver.createPropertiesObservation({
      selectedPropertiesTarget, canvasSelection, normalizeAppearance, effectiveAppearanceForElement, document, readHistory: readTestHistory,
    });
    const fixedObservation = window.PropertiesTestDriver.createFixedObservation({
      currentScope: workspace.current, elementSketchId, findLineFixedConstraint, LineFixedConstraint, fixPointBtn, readHistory: readTestHistory,
    });
    const parameterFixture = window.ParameterTestDriver.createFixture({
      resetModelState, addPoint, addLine, pushModelConstraint, HorizontalConstraint, DistanceConstraint, dimensionFromAnchor, currentScope: workspace.current,
      formatParameterReference, createEmptyBlockDefinition, Point, Line, DEFAULT_SKETCH_ID, ensureParameterNamespace,
      appendDefinition: definition => documentModel.blockDefinitions.push(definition), nextInstanceId: () => `BI${blockInstanceSeq++}`,
      invalidateBlockProjectionCache, stabilizeActiveParameterNamespace, activeSketchId, resetHistory, updateUI, draw,
    });
    const parameterObservation = window.ParameterTestDriver.createObservation({
      currentScope: workspace.current, readDocument: () => documentModel, validateParameterNamespace, dimensionConstraintsInNamespace,
      isReadOnlyDimension, dimensionExpressionValue, blockProjectionBundle, serializeModel,
    });
    const parameterInteraction = window.ParameterTestDriver.createInteraction({
      currentScope: workspace.current, clearSelection, canvasSelection, blockSelectionGeometry, createBlockDefinitionFromSelection,
      blockSelectionBoundsCenter, dimensionConstraintsInNamespace, deleteElements, document,
    });
    const readTestDefaultDimensionAppearance = () => normalizeDimensionAppearance({ ...documentModel.defaultDimensionAppearance, ...documentModel.defaultTerminatorAppearance }, { partial: false });
    const radiusFixture = window.DimensionTestDriver.createRadiusFixture({
      Point, Arc, placement: dimensionPlacement, layouts: dimensionLayouts, circlePointAtAngle, readDefaultAppearance: readTestDefaultDimensionAppearance,
      viewport, hypot2, screenPxPerMm: DIMENSION_SCREEN_PX_PER_MM, outsideShaftLengthFactor: DIMENSION_OUTSIDE_SHAFT_LENGTH_FACTOR,
    });
    const terminatorFixture = window.DimensionTestDriver.createTerminatorFixture({
      readDefaultAppearance: readTestDefaultDimensionAppearance, layouts: dimensionLayouts, metrics: dimensionMetrics, viewport,
      screenPxPerMm: DIMENSION_SCREEN_PX_PER_MM, fitMarginFactor: DIMENSION_TERMINATOR_FIT_MARGIN_FACTOR, outsideShaftLengthFactor: DIMENSION_OUTSIDE_SHAFT_LENGTH_FACTOR, hypot2,
    });
    const dimensionColorObservation = window.DimensionTestDriver.createColorObservation({ canvasSelection, canvasHover, ctx, drawDimensions });
    const dimensionAppearanceObservation = window.DimensionTestDriver.createAppearanceObservation({
      currentScope: workspace.current, readDocument: () => documentModel, isDimensionConstraint, constraintSketchId, activeSketchId,
      normalizeDimensionAppearance, effectiveDimensionAppearanceForSketch, dimensionDisplayState,
    });
    const dimensionRenderObservation = window.DimensionTestDriver.createRenderObservation({
      currentScope: workspace.current, isDimensionConstraint, targetFromConstraint, constraintSketchId, activeSketchId, effectiveDimensionAppearance,
      placement: dimensionPlacement, layouts: dimensionLayouts, metrics: dimensionMetrics, viewport, screenPxPerMm: DIMENSION_SCREEN_PX_PER_MM,
      displayFactor: window.Appearance.annotationDisplayFactor, hypot2,
    });
    const referenceImageTestObservation = window.ReferenceImageTestDriver.createObservation({
      canvasSelection, currentScope: workspace.current, serializeReferenceImage, isEditingBlock: () => Boolean(blockEditor.current),
      liveBlockEditorDefinition, referenceImageInteraction, readHistory: readTestHistory, viewport,
    });
    const referenceImageTestImport = window.ReferenceImageTestDriver.createImport({ fetch, File, importReferenceImageFile });
    const referenceImageBlockFixture = window.ReferenceImageTestDriver.createBlockFixture({
      resetModelState, createEmptyBlockDefinition, Point, Line, DEFAULT_SKETCH_ID, openBlockDefinitionEditor, completeBlockDefinitionEdit, serializeModel,
    });
    const instanceCommandFixture = window.DerivedInstanceTestDriver.createCommandFixture({
      resetModelState, addPoint, addLine, focus: canvasTestDriver.focus, clientPosition: canvasTestDriver.clientPosition,
      resetHistory, updateUI, draw,
    });
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
      applicationThemeStateForTest: themeObservation.state,
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
      resetForResponsiveLineDragTest: responsiveDragFixture.reset,
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
      documentNameState: documentNameObservation.state,
      fileSystemAccessStateForTest: fileObservation.state,
      serializedModelForTest() {
        return structuredClone(serializeModel());
      },
      loadModelForDerivedInstanceTest: derivedInstanceInteraction.load,
      resetForDerivedInstanceTest: derivedInstanceFixture.reset,
      resetForGeometryInstanceCommandTest: instanceCommandFixture.reset,
      derivedInstanceStateForTest: derivedInstanceInteraction.state,
      deleteDerivedSourceForTest: derivedInstanceInteraction.deleteSource,
      deleteDerivedInstanceForTest: derivedInstanceInteraction.deleteInstance,
      resetForSketchProjectionTest: sketchProjectionGeometryFixture.reset,
      resetForSketchProjectionRectangleTest: sketchProjectionCompatibilityFixture.resetRectangle,
      resetForSketchProjectionSharedKindsTest: sketchProjectionCompatibilityFixture.resetSharedKinds,
      sketchProjectionEligibilityForTest: sketchProjectionEligibilityFixture.read,
      resetForSketchProjectionBlockEditorTest: sketchProjectionBlockEditorFixture.reset,
      completeSketchProjectionBlockEditorForTest: sketchProjectionBlockEditorFixture.complete,
      resetForBlockProjectionSketchProjectionTest: sketchProjectionBlockFixture.reset,
      moveBlockProjectionSketchProjectionSourceForTest: sketchProjectionBlockInteraction.move,
      deleteBlockProjectionSketchProjectionSourceForTest: sketchProjectionBlockInteraction.deleteSource,
      sketchProjectionStateForTest: sketchProjectionTestObservation.state,
      moveSketchProjectionSourcesForTest: sketchProjectionSourceEditing.move,
      createSketchProjectionChainForTest: sketchProjectionSourceEditing.createChain,
      selectSketchProjectionTargetForTest: sketchProjectionGeometryInteraction.select,
      removeFirstSketchProjectionConstraintForTest: sketchProjectionGeometryInteraction.removeConstraint,
      setSketchProjectionAppearanceForTest: sketchProjectionGeometryInteraction.setAppearance,
      deleteSketchProjectionSourceGeometryForTest: sketchProjectionGeometryInteraction.deleteSource,
      deleteSketchProjectionTargetGeometryForTest: sketchProjectionGeometryInteraction.deleteTarget,
      deleteSketchProjectionSourceSketchForTest: sketchProjectionGeometryInteraction.deleteSourceSketch,
      copySketchProjectionTargetForTest: sketchProjectionTransfer.copyAndPaste,
      blockizeSketchProjectionTargetForTest: sketchProjectionTransfer.blockize,
      reloadSketchProjectionForTest: sketchProjectionReload.reload,
      referenceImageStateForTest: referenceImageTestObservation.state,
      importReferenceImageDataForTest: referenceImageTestImport.importData,
      openReferenceImageBlockEditorForTest: referenceImageBlockFixture.open,
      completeReferenceImageBlockEditorForTest: referenceImageBlockFixture.complete,
      dimensionAppearanceStateForTest: dimensionAppearanceObservation.state,
      arcRadiusDimensionRenderPlanForTest: radiusFixture.radiusPlan,
      dimensionAppearanceRenderMetricsForTest: dimensionRenderObservation.appearanceMetrics,
      dimensionTerminatorFitForTest: terminatorFixture.fit,
      dimensionArrowTipAlignmentForTest: terminatorFixture.arrowAlignment,
      drawnDimensionColorsForTest: dimensionColorObservation.colors,
      resetForParameterTest: parameterFixture.reset,
      resetForParameterFeedbackTest: parameterFixture.resetFeedback,
      parameterStateForTest: parameterObservation.state,
      blockParameterFreezeForTest: parameterInteraction.freezeBlock,
      deleteDimensionByNameForTest: parameterInteraction.deleteDimension,
      appearanceStateForTest: propertyAppearanceObservation.appearance,
      resetForMultiplePropertiesTest: propertiesFixture.resetProperties,
      multiplePropertiesStateForTest: propertiesObservation.state,
      resetForMultipleFixedTest: propertiesFixture.resetFixed,
      multipleFixedStateForTest: fixedObservation.state,
      viewStateForTest: viewObservation.state,
      importDocumentNameFixture: documentTestImport.importName,
      loadDocumentFixtureForDragTest: documentTestLoad.load,
      selectedGeometryIdsForTest: readTestSelectedGeometry,
      resetForOverlappingContextSelectionTest: overlapSelectionFixture.reset,
      resetForArcEndpointConstraintSelectionTest: endpointSelectionFixture.reset,
      canvasContextSelectionStateForTest: contextSelectionObservation.state,
      addIsolatedFixedPointForContextTest: contextPointInsertion.addFixedPoint,
      constraintInputStateForTest: constraintInputObservation.state,
      resolveConstraintIntentForTest: constraintIntentTestDriver.resolve,
      sketchMoveStateForTest: sketchMoveObservation.state,
      selectGeometryIdsForTest: geometryIdSelection.select,
      focusWorldForTest: canvasTestDriver.focus,
      displayZoomStateForTest: displayZoomObservation.state,
      worldClientPositionForTest: canvasTestDriver.clientPosition,
      hitGeometryAtWorldForTest: geometryHitObservation.hit,
      geometryClientPositionForTest: geometryPositionObservation.position,
      hoverDisplayStateForTest: hoverDisplayObservation.state,
      snapLabelsAtWorldForTest: snapObservation.labels,
      authoringStateForTest: authoringObservation.state,
      selectableLineClientPositionForTest: selectableLinePosition.position,
      guidedPointDragForTest: pointDragTestDriver.drag,
      guidedPointDragPathForTest: pointDragTestDriver.path,
      geometryDragPathForTest: geometryDragTestDriver.path,
      constraintStatusesForTest: readTestConstraintStatuses,
      constraintAnalysisForTest: constraintAnalysisObservation.analysis,
      blockConstraintStatusForTest: blockConstraintObservation.state,
      addBlockPointOnLineConstraintForTest: blockConstraintInsertion.add,
      resetForAnnotationDrag: annotationDragFixture.reset,
      resetForReadOnlyDuplicateDimension: readOnlyDuplicateFixture.reset,
      resetForReadOnlyDimensionPlacement: readOnlyPlacementFixture.reset,
      pointPointRectangleDimensionExtensionVisibilityCases: extensionVisibilityFixture.cases,
      dimensionDisplayPrecisionCases: dimensionDisplayCases.precision,
      dimensionTextAngleCases: dimensionTextAngleCases.angles,
      angleDimensionLabelFollowCase: angleLabelFixture.followCase,
      resetForTrimConstraintTransfer: trimLineTransferFixture.reset,
      trimConstructionBoundaryCase: trimConstructionFixture.boundaryCase,
      trimCircleDiameterDimensionCase: trimDiameterFixture.diameterCase,
      annotationSnapshot: annotationSnapshotObservation.snapshot,
      annotationDimensionStateForTest: annotationDimensionObservation.state,
      annotationAppearanceStateForTest: annotationAppearanceObservation.state,
      annotationOwnershipStateForTest: annotationOwnershipObservation.state,
      fitAllGeometryForTest: testFitOperation.fit,
      annotationHitAt: annotationHitObservation.hit,
      annotationDragActive() {
        return annotationDrag.inspect();
      },
      historyState: readTestHistory,
      resetForActiveSketchDimensionVisibility: sketchVisibilityFixture.reset,
      resetForAllGeometryFit: allGeometryFitFixture.reset,
      resetForMiddleButtonFit: middleButtonFitFixture.reset,
      middleButtonFitState: fitObservation.state,
      canvasDashIsolationCases: canvasDashIsolation.cases,
      resetForSidebarInspection: sidebarInspectionFixture.reset,
      resetForRootSketchTreeHoverTest: rootHoverFixture.reset,
      resetForFixedPointDisplayTest: fixedPointFixture.reset,
      resetForSketchTreeBlockHoverTest: blockHoverFixture.reset,
      resetForOffsetConstraints: offsetPrimitiveFixture.reset,
      resetForOffsetUi: offsetUiFixture.reset,
      offsetUiState: offsetUiObservation.state,
      resetForOffsetDirection: offsetDirectionFixture.reset,
      resetForOffsetChainUi: offsetChainFixture.reset,
      offsetChainUiState: offsetChainObservation.state,
      roundTripOffsetChainForTest: offsetChainReload.reload,
      updateOffsetChainTargetForTest: offsetChainTargetEdit.update,
      canReselectOffsetResultChainForTest: offsetChainReselection.reselect,
      resetForSketchDeletion: sketchDeletionFixture.reset,
      resetForSiblingVisibility: siblingVisibilityFixture.reset,
      resetForInactiveDimensionAndBlockHover: inactiveHoverFixture.reset,
      hoverIdentityStateForTest: hoverIdentityObservation.state,
      geometryStrokeStyleCasesForTest: strokeStyleCases.cases,
      constructionLineHoverDisplayCasesForTest: constructionHoverFixture.cases,
      constructionLineRenderingForTest: constructionLineObservation.state,
      resetForSiblingSubtreeReference: subtreeReferenceFixture.reset,
      siblingSubtreeVisibilityState: subtreeVisibilityObservation.state,
      moveSiblingSubtreeReferenceLine: referenceLineMove.move,
      deleteSketchForTest: sketchDeletionFixture.remove,
      referenceDependencyOrderCase: dependencyOrderFixture.orderCase,
      cyclicReferenceLoadCase: cyclicReferenceFixture.loadCase,
      sketchVisibilityState: sketchVisibilityObservation.state,
      resetForConstraintDimensionSelection: dimensionSelectionFixture.reset,
      constraintDimensionSelectionState: dimensionSelectionObservation.state,
      resetForSupportConstraintStatus: supportStatusFixture.reset,
      resetForReferencePointLineCoincidence: parentPointLineFixture.reset,
      resetForSiblingPointLineReference: siblingPointLineFixture.reset,
      moveSiblingReferenceLine: siblingReferenceMove.move,
      referencePointLineState: pointLineObservation.state,
      resetForBlockCreationUi: blockCreationFixture.reset,
      resetForEmptyBlockCreation: emptyBlockFixture.reset,
      resetForDimensionCommandLineDrag: commandLineDragFixture.reset,
      resetForLineLengthClickPlacement: clickPlacementFixture.reset,
      resetForLineCircleAndRadiusDifferenceDimensions: lineCircleFixture.reset,
      lineCircleAndRadiusDifferenceState: lineCircleObservation.state,
      perturbRadiusDifferenceDimensionForTest: radiusDifferenceRecovery.perturb,
      lineLengthClickPlacementState: clickPlacementObservation.state,
      dimensionCommandLineDragState: commandLineDragObservation.state,
      blockState: blockStateObservation.state,
      blockInteractionPoints: blockInteractionObservation.points,
      blockRotationLockStateForTest: blockRotationObservation.state,
      blockProjectionEndpointForTest: blockEndpointObservation.position,
      blockProjectionHoverState: blockHoverObservation.state,
      drawnGeometryIdLabelsForTest: canvasRenderProbe.geometryIdLabels,
      constraintStatusEndpointMarkerCountForTest: canvasRenderProbe.constraintEndpointMarkerCount,
      drawnPointMarkerCountForTest: canvasRenderProbe.pointMarkerCount,
      arcEndpointHandleCountForTest: canvasRenderProbe.arcEndpointHandleCount,
      pointDisplayStateForTest: canvasRenderProbe.pointDisplayState,
      drawnDimensionLabelsForTest: canvasRenderProbe.dimensionLabels,
      drawnDimensionExpressionMarksForTest: canvasRenderProbe.dimensionExpressionMarks,
      dimensionClientPositionForTest: dimensionPositionObservation.position,
      startDimensionExpressionEditForTest: dimensionExpressionAction.start,
      selectDimensionForPropertiesForTest: dimensionSelectionDriver.select,
      multipleDimensionSelectionForTest: dimensionSelectionDriver.state,
      fitForMultipleDimensionsForTest() {
        viewport.update({ scale: 2, x: 350, y: 250 });
        updateUI();
        draw();
      },
      blockDefinitionUpdateCase: definitionUpdateFixture.run,
      blockReadOnlyDimensionCase: blockDimensionFixture.run,
      blockExternalConstraintCase: blockExternalFixture.run,
      reloadBlockState: blockReload.reload,
      reloadLegacyBlockState: legacyBlockReload.reload,
      blockEditorState: blockEditorObservation.state,
      commitBlockPlacementForTest: blockPlacementAction.commit,
      constrainFirstNestedBlockLineForTest: nestedConstraintAction.constrain,
      addBlockEditorChildGeometry: blockChildGeometryAction.add,
      cancelBlockEditor: blockCancelAction.cancel,
      completeBlockEditor: blockCompleteAction.complete,
      setFirstBlockInstanceSketches: blockEnabledSketchAction.set,
      blockCreationRejectionCases: blockRejectionFixture.cases,
      sidebarHighlightIds: sidebarHighlightObservation.ids,
      currentSidebarHoveredGeometryKeys: sidebarHoverKeyObservation.keys,
    };
  }

  derivedPanel = window.DerivedCommandPanel.create({
    formatDisplayNumber,
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
  const currentCommandPanel = () => annotationCommand.active ? annotationPanel : ["hatch", "hatch-repair"].includes(mode) ? hatchPanel : derivedPanel;
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
