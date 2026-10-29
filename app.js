/* Application composition, editing commands, Canvas UI and event handling. */
(function () {
  "use strict";
  const { formatDisplayNumber, formatDimensionLabel, formatMeasuredDimensionLabel } = window.NumberDisplay;
  const { escapeHtml } = window.HtmlText;
  const { serializeReferenceImage } = window.ReferenceImageData;
  const { pointInExpandedBox, lineBBox, primitiveBBox, mergeBounds, splineBBox } = window.GeometryBounds;
  const { referenceImageWorldToLocal } = window.ReferenceImageGeometry;
  const { serializeHatch, hatchAppearanceForDisplay, hatchPatternOrigin } = window.HatchData;

  const {
    CSS_PX_PER_MM, DEFAULT_APPEARANCE,
    DEFAULT_HATCH_APPEARANCE, DEFAULT_ANNOTATION_STYLE,
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
    lineHasDirection,
    signedPointLineDistance,
  } = window.GeometryKernel;

  const {
    parseId: parseGeometryRefId,
    id: geometryRefId,
    key: geometryRefKey,
    equals: geometryRefsEqual,
  } = window.GeometryRef;


  const {
    formatReference: formatParameterReference,
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
    OffsetConstraint,
    OffsetChainConstraint,
    CoincidentConstraint,
    ArcEndpointCoincidentConstraint,
    ArcEndpointArcEndpointCoincidentConstraint,
    PointOnLineConstraint,
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
    constraintReferencesPoint, constraintReferencesLine, constraintReferencesPrimitive,
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
    log, setHint, setSolveResultHint, updateUI, updateGeometrySelectionUI, updatePropertiesUI, updateSketchUI, draw } = presentation;
  const { work: profileInteractionWork, phase: profileInteractionPhase } = interactionProfiler;
  const { applicationText, translatedExactText, localizeApplicationUI,
    setApplicationLanguage, setApplicationTheme } = applicationSettings;
  const { hatchRegionErrorText, offsetChainErrorText, hatchPatternTypeLabel, geometryInstanceTypeLabel } = window.AuthoringFeedback.create({ applicationText });
  const { ROOT_SKETCH_ID, DEFAULT_SKETCH_ID, copyWithNormalizedAppearance: normalizedSketchCopy } = window.SketchHierarchy;
  const { document: documentModel, workspace, parameters: parameterNamespace, sketches: sketchContext,
    geometryIds, documentIds, reservation: idReservation, createReadContext } = window.DocumentWorkspace.create({
    applicationText, constraintGraphNodes, nextHatchIndex: () => editingScopeBinding.current.nextHatchIndex,
  });
  const currentParameterNamespace = workspace.current;
  const { guard: guardDimensionSymbolDeletion } = window.ParameterApplication.createDeletionGuard({
    currentNamespace: currentParameterNamespace, symbolDeletionDependents: parameterNamespace.symbolDeletionDependents,
    readLanguage: () => applicationSettings.language, setHint, log,
  });
  const {
    evaluateEditingExpressionDraft: evaluateDimensionExpressionDraft, dimensionExpressionValue, numericDimensionExpression,
    dimensionUsesExpression, expressionInputValue, expressionFromUserInput,
    dimensionConstraintsInNamespace, ensureDimensionParameter, ensureParameterNamespace, parameterErrorText,
    validateParameterNamespace,
  } = parameterNamespace;
  const parameterEditor = window.ParameterEditor.create({
    document, window, InputElement: HTMLInputElement, Event,
    namespace: parameterNamespace, currentScope: () => editingScopeBinding.current,
    readDefinitions: () => documentModel.blockDefinitions, readBlockEditor: () => blockEditor.current,
    applicationText, language: () => applicationSettings.language,
    formatting: { escapeHtml, formatDisplayNumber, formatParameterReference, parameterErrorText, defaultSketchId: DEFAULT_SKETCH_ID },
    localizeApplicationUI, applyDraft: (...args) => parameterApplication.apply(...args),
    recordHistory, setHint, updateUI, draw, pickDimension: event => expressionInputController.pickCanvas(event),
  });
  const { syncExpressionInputHighlight, installExpressionInputHighlights } = parameterEditor;
  const {
    isRootSketch, isDrawableSketch,
    firstDrawableSketchId, sketchName, sketchById,
    orderedSketches, descendantSketchIds,
    isReferenceSourceSketchId,
    activeSketchId, assignSketchId,
    elementSketchId, membershipQuery: readSketchMembership, isEditableSketchId, canEditSketch,
    sketchRelationToActive, constraintSketchId, isActiveSketchConstraint,
    constraintTargetsAreActive, isActiveSketchElement, isEditableSketchElement,
    sketchRelationOfElement,
  } = sketchContext;

  const { geometryKindForItem, geometryRefForItem, geometryIdForItem: constraintGeometryId, geometryKeyForItem: geometryElementKey } = window.GeometryObjects;
  const { services: geometryReadServices, createScopeBinding, createPersistence } = createReadContext({
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
  const { geometryInstanceSourcePoints, createGeometryInstanceBundle, geometryInstanceBundlesForScope } = instanceProjections;
  const { blockDefinitionById, blockDefinitionDrawableSketchIds, blockDefinitionGeometrySketchIds, blockInstanceEnabledSketchSet } = blockCatalog;
  const { blockProjectionLocalId, blockWorldPoint, createBlockProjectionBundle, blockAllProjectionBundle, blockProjectionBundle, invalidateBlockProjectionCache } = blockProjections;
  const { withGeometryReadCache, blockProjectionBundles, geometryInstanceBundles, geometryInstanceBundle, allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines, allAnnotations, allHatches, resolveGeometryRef } = geometryReads;
  function annotationBounds(...args) { return annotationFeature.spatial.annotationBounds(...args); }
  const { blockLocalGeometryBounds, blockInstanceDisplayCenter, blockInstanceTranslationForAnchor, snappedBlockRotation } = window.BlockLayout.create({
    catalog: blockCatalog, projections: blockProjections, instanceProjections, annotationBounds, hatchPrimitivesForScope,
  });
  let sketchMoveCommand = null;
  let sketchContextController = null;
  const editingScopeBinding = createScopeBinding({
    Solver: ConstraintSolver,
    closeSketchContext: () => sketchContextController?.close(), resetSketchMove: () => sketchMoveCommand?.reset(),
  });
  const { solver } = editingScopeBinding;
  const { sketchHasDimensionConstraint, hasDirectRadiusDimension } = window.DimensionQueries.createModelQueries({
    currentScope: () => editingScopeBinding.current, activeSketchId, constraintSketchId,
  });
  function activateEditingScope(...args) { return editingScopeBinding.activate(...args); }

  const { assignSketch: assignConstraintSketchId, push: pushModelConstraint } = window.ConstraintCommitCommand.createInsertion({
    currentScope: () => editingScopeBinding.current, currentParameterNamespace,
    activeSketchId, isDrawableSketch, firstDrawableSketchId, ensureDimensionParameter,
  });
  const fileSession = window.DocumentFiles.create();

  const canvasInteraction = window.CanvasInteractionFeature.create({
    sketches: sketchContext, readServices: geometryReadServices, constraintReferencesPoint, editedFitPoints: () => splineEditing.current?.spline?.fitPoints,
    isGeometryMode, setHint, applicationText, clearSnap: () => clearSnap(), clearPointerPreview: () => drawingPreview.setPointer(null),
    clearSelection, updateGeometrySelectionUI, draw,
  });
  const { lifecycle: drawOperationLifecycle, selectionFeature, selection: canvasSelection, scope: selectionScopeQuery,
    identity: identitySelection, access: sketchEditAccess, pointUsage, hover: canvasHover, createOperationSessions } = canvasInteraction;
  const { exit: exitDrawMode, active: hasActiveDrawOperation, cancel: cancelActiveDrawOperation, isToolMode: isDrawToolMode } = drawOperationLifecycle;
  const { guardSketchEdit, guardSelectionEdit, canCreateInActiveSketch, rejectRootSketchCreation } = sketchEditAccess;
  const { selectionSketchId } = selectionScopeQuery;
  const {
    selectedElementCount, selectedGeometryItems, appearanceSelectionTarget, effectiveSelectedConstraint, selectedPrimitives,
    toggleBlockInstanceSelection, selectedConstructionTogglePrimitives,
    trimConstraintSelection,
    hasSelection,
  } = canvasSelection;
  const { isPointUsedByLine, isAnyLineEndpoint, isPointUsedByCircle, isPointUsedByArc, isExplicitPoint } = pointUsage;
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
  const { resolve: resolveDerivedDragSource, sourceObjects: geometryInstanceSourceObjects } = window.InstanceProjection.createDragSourceQuery({
    geometryInstanceSourcePoints, geometryInstanceDependencyRefs, resolveGeometryRef,
  });
  const instanceSourceSelection = window.InstanceProjection.createSourceSelection({
    currentScope: () => editingScopeBinding.current, selectedGeometryItems, canvasSelection, blockProjectionBundle, geometryInstanceBundle, elementSketchId, activeSketchId, geometryRefForItem,
  });

  const { hitAnnotationTarget, annotationLeaderTargetFromHit, annotationLeaderTargetFromItem, annotationLeaderAnchor } = window.AnnotationFeature.createAnchorQuery({
    sketches: sketchContext, readServices: geometryReadServices, pointUsage, selection: canvasSelection, viewportScale: () => viewport.scale,
  });
  const referenceConstraintState = window.ReferenceConstraintState.create({
    currentScope: workspace.current, constraintSketchId, isReferenceSourceSketchId,
  });
  const { constraintIsOperational, wouldCreateReferenceCycle, refreshReferenceConstraintValidity,
    referenceConstraintErrorCountForSketch } = referenceConstraintState;
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
  const { sketchProjectionSourceKey, sketchProjectionSourceIsCovered, sketchProjectionEntryFromItem,
    sketchProjectionEntryFromOperand } = sketchProjectionSources;
  const { start: startSketchProjectionCommand, toggle: toggleSketchProjectionSource,
    commit: commitSketchProjectionCommand } = sketchProjectionCommand;
  const { preview: drawingPreview, pending: pendingCommandSession, targets: constraintTargetSession,
    pointer: pointerInteractionController, createSelectionPresentation } = createOperationSessions({
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
  const constructionCommand = window.ConstructionCommand.create({
    cancelConstraintTargetCommand, selectedConstructionTogglePrimitives, guardSketchProjectionShapeEdit, applicationText,
    synchronizeSketchProjectionMetadata: () => synchronizeSketchProjectionMetadata(), setHint, clearSelection, updateUI, draw, recordHistory,
    setLineMode: () => { drawOperationLifecycle.setMode("line"); }, resetLineInputs: () => drawOperationLifecycle.resetInputs("line"),
    clearSnap: () => clearSnap(), updateToolbar,
  });
  const { highlight: selectionHighlight, clearing: selectionClearing, documentReset: documentCanvasReset } = createSelectionPresentation({
    projections: blockProjections, constraintReferences,
  });
  const { constraintDefiningGeometryEntries, constraintHighlightNodes, sameConstraintDisplayElement, isSidebarHoveredElement } = selectionHighlight;
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
  const blockEditingFeature = window.BlockEditingFeature.create({
    workspace, documentModel, ids: documentIds, catalog: blockCatalog, projections: blockProjections,
    readEditingScope: () => editingScopeBinding.current,
    instances: instanceProjections, rebinding: constraintRebinding, normalizedSketchCopy, normalizeGeometryInstance,
    isDimensionConstraint, isReadOnlyDimension, numericDimensionExpression, ensureParameterNamespace,
    activeSketchId, blockProjectionBundles, geometryElementKey, readViewport: () => viewport,
    activateScope: activateEditingScope, reserveScopeSequences: reserveBlockEditorSequences, createHistory: createBlockEditHistory,
  });
  const { editing: blockDefinitionEditing, session: blockEditor, queries: blockEditingQueries } = blockEditingFeature;
  const { clone: cloneBlockDefinition, fromSelection: createBlockDefinitionFromSelection, empty: createEmptyBlockDefinition } = blockDefinitionEditing;
  const { live: liveBlockEditorDefinition, chain: blockEditorSessionChain,
    scopeId: currentBlockDefinitionScopeId } = blockEditor;
  const { blockDefinitionScopeError, blockInstanceById } = blockEditingQueries;

  const canvasRenderProbe = window.CanvasRenderProbe.create({
    ctx, allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs,
    drawLines, drawCircles, drawArcs, drawPoints, drawArcEndpointHandles, drawDimensions,
  });
  const HISTORY_LIMIT = 80;
  presentation.bindCanvas({
    readPngCommand: () => pngExportCommand, readPending: () => pendingCommandSession.current, readMode: drawOperationLifecycle.readMode,
    syncAnnotationInput: () => annotationInputController.sync(),
    withGeometryReadCache, drawCanvas,
  });
  const { command: geometryInstanceCommand, createSourceCommand: createInstanceSourceCommand, createEditing: createInstanceEditing } = window.DerivedInstanceFeature.create({
    cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation,
    selectedItemsForGeometryInstance, geometryRefForItem, geometryRefsEqual, isVisibleSketchElement, clearSelection, normalizeGeometryInstance,
    previewFreeId: type => type === "mirror" ? `MI${documentIds.peek("mirror")}` : `PI${documentIds.peek("pattern")}`,
    nextInstanceId: type => type === "mirror" ? documentIds.allocate("mirror") : documentIds.allocate("pattern"),
    activeSketchId, getMode: drawOperationLifecycle.readMode, setMode: drawOperationLifecycle.setMode, updateToolbar, updateUI,
    applicationText, setHint, draw, currentScope: workspace.current, canvasSelection, recordHistory,
    Line, lineHasDirection, elementSketchId,
    resolveGeometryRef, createGeometryInstanceBundle, commitDraft: (...args) => synchronizedInstanceEditing.commit(...args),
  });
  const { start: startGeometryInstanceCommand } = geometryInstanceCommand;
  const instanceSourceCommand = createInstanceSourceCommand({
    guardSketchEdit, exitDrawMode, updatePropertiesUI, sketchProjectionEntryFromItem, sketchProjectionSourceIsCovered,
    geometryInstanceBundlesForScope, blockProjectionBundles, geometryElementKey, geometryInstanceBundle,
    constraintGraphNodes, guardDimensionSymbolDeletion, annotationReferencesRemovedGeometry, clearSketchSolveState,
  });
  const { finish: finishInstanceSourceEdit } = instanceSourceCommand;
  const blockPlacementCommand = window.BlockPlacementCommand.create({
    isGeometryMode, canCreateInActiveSketch, blockDefinitionById, blockDefinitionScopeError,
    blockDefinitionDrawableSketchIds, blockDefinitionGeometrySketchIds, snappedBlockRotation,
    blockInstanceTranslationForAnchor, activeSketchId, currentScope: workspace.current,
    nextInstanceId: () => documentIds.allocate("blockInstance"), clearSelection, canvasSelection, invalidateBlockProjectionCache,
    isPropertiesCollapsed: () => Boolean(document.querySelector(".workspace")?.classList.contains("properties-collapsed")),
    setPropertiesPanelCollapsed, getPointerPreview: () => drawingPreview.pointer,
    setPointerPreview: value => { drawingPreview.setPointer(value); }, getLastPointerWorld: pointerInteractionController.readLastPointer,
    setMode: drawOperationLifecycle.setMode, setHint, updateUI, draw, solveAndRefresh, recordHistory,
  });
  const { start: startBlockPlacement, commit: commitBlockPlacement, click: handleBlockPlacementClick,
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
  const { connectedComponentFromSeeds, localSolveLines, sketchSolveVariables, sketchSolveConstraints, sketchSolveLines } = solveScopeQuery;
  const { analysis: constraintAnalysis, redundancy: constraintRedundancy } = window.ConstraintAnalysis.createWithRedundancy({
    currentScope: workspace.current, solver, scopeQuery: solveScopeQuery, sketchContext, readServices: geometryReadServices, constraintIsOperational,
    refreshReferenceConstraintValidity, sketchHasSolveError,
    isExplicitPoint, minimumLength: MIN_LINE_LENGTH, acceptError: CONSTRAINT_ACCEPT_ERROR,
    profileAnalysis: work => interactionProfiler.active ? profileInteractionWork("analysis", work) : work(),
  });
  const { redundantConstraintInfo, constraintIsRedundant, constraintDuplicateCountForSketch } = constraintRedundancy;
  const { statusOf: constraintStatusOf } = constraintAnalysis;
  const { viewport, navigation: canvasNavigation, createWorkspace: createCanvasWorkspace } = window.CanvasDisplay.create({
    canvas, document, initialScale: CSS_PX_PER_MM, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, minLength: MIN_LINE_LENGTH,
    draw, setHint, fitVisibleGeometry: fitVisibleGeometryToViewport, flushPointerMoves: pointerMoveScheduler.flush, syncDimensionValueInput: () => syncDimensionValueInput(),
  });
  const { screenToWorld, worldToCanvasScreen, canvasPoint, visibleWorldBounds } = viewport;
  const transientAuthoring = window.TransientAuthoring.create({
    currentScope: workspace.current, ids: geometryIds, selection: canvasSelection, historySnapshot, documentHistory,
    isHistoryRestoring: () => historyController.restoring, updateHistoryButtons,
    invalidateAnalysis: () => { constraintAnalysis.invalidate(); },
  });
  const { surface: canvasSurface, exportRenderer: pngRendering, layout: canvasWorkspaceLayout, createScene: createCanvasScene, createRendering: createCanvasRendering, createInputBinding: createCanvasInputBinding, createPngExport, dragPointer } = createCanvasWorkspace({
    ctx, readPixelRatio: () => window.devicePixelRatio || 1, ResizeObserverClass: window.ResizeObserver, withGeometryReadCache, drawCanvas,
    isValueInputPending: () => pendingCommandSession.current && ["distance-value", "offset-value"].includes(pendingCommandSession.current.type),
    window, updatePropertiesUI, closeContextMenu: closeCanvasContextMenu, applySketchTreeWidth: () => applySketchTreeWidth(),
    applicationText, readLanguage: () => applicationSettings.language,
  });
  const { resetCanvasStrokeState, withCanvasState } = canvasSurface;
  const { DIMENSION_SCREEN_PX_PER_MM, DIMENSION_TERMINATOR_FIT_MARGIN_FACTOR } = window.DimensionMetrics;
  const { display: dimensionDisplay, labels: { label: dimensionLabelForConstraint } } = window.DimensionDisplay.createForScene({ ctx, viewport, currentLines: () => workspace.current().lines,
    minLineLength: MIN_LINE_LENGTH, canvasThemeColor, onExpressionMark: canvasRenderProbe.captureExpressionMark,
    appearance: dimensionAppearance, sketches: sketchContext });
  const { metrics: dimensionMetrics, placement: dimensionPlacement, layouts: dimensionLayouts, painter: dimensionPainter } = dimensionDisplay;
  const { feature: dimensionInput, input: dimensionValueInput } = window.DimensionInput.createForDocument({
    document, viewport, syncHighlight: syncExpressionInputHighlight,
    scheduleFrame: callback => requestAnimationFrame(callback), pending: pendingCommandSession, display: dimensionDisplay,
    worldToCanvasScreen, effectiveDimensionAppearance, constraintSketchId, activeSketchId,
    evaluateDimensionExpressionDraft, expressionFromUserInput, cancelPendingCommand, startDistanceValueInput,
    submitOffsetValue: () => submitOffsetValue(), submitDistanceValue: () => submitDistanceValue(), applicationText, setHint, draw,
  });
  const { controller: dimensionInputController } = dimensionInput;
  const { dimensionFromAnchor, angleDimensionLabelBasis, angleDimensionLabelOffsets, setAngleDimensionLabelOffsets, dimensionWithLabelAt, angleDimensionFromLabelPoint, dimensionAnchor, defaultDimensionForTarget } = dimensionPlacement;
  const { jisDimensionTextAngle, dimensionTextOffset, angleDimensionLayout } = dimensionLayouts;
  const { hide: hideDimensionValueInput, sync: syncDimensionValueInput, focus: focusDimensionValueInput } = dimensionInputController;
  function dimensionLayout(...args) { return dimensionDisplay.layout(...args); }
  const commandTargetPresentation = window.GeometryPresentation.createCommandTargets({
    readPanelSelection: () => presentation.selectedItem, readMode: drawOperationLifecycle.readMode, instanceSourceCommand, sketchProjectionCommand,
    geometryInstanceCommand, geometryRefsEqual, geometryRefForItem, readOperands: () => constraintTargetSession.operands, sameArcEndpoint, operandElement,
    readConstraintCommand: () => constraintTargetSession.command, isActiveSketchElement, isReferenceSourceSketchId, elementSketchId, readPending: () => pendingCommandSession.current,
  });
  const sketchPresentation = window.GeometryPresentation.createSketchStyle({
    sketchHasSolveError, elementSketchId, sketchRelationOfElement, constraintStatusOf, isVisibleSketchElement, isActiveSketchElement,
  });
  const { isConstraintOperandSelected } = commandTargetPresentation;
  const { constraintStatusColor, sketchStrokeWidth, sketchAlpha } = sketchPresentation;
  const { geometry: geometryDisplay, overlay: interactionOverlay, bounds: drawingBounds, fit: drawingFit } = createCanvasScene({
    Point, currentScope: workspace.current, sketches: sketchContext, readServices: geometryReadServices, pointUsage,
    commandTargets: commandTargetPresentation, sketchStyle: sketchPresentation, canvasSelection, canvasHover, selectionHighlight, viewState,
    isSidebarHighlightedElement, canvasThemeColor, applicationText,
    constructionAlpha: CONSTRUCTION_GEOMETRY_ALPHA, constructionExtensionScreenPx: CONSTRUCTION_EXTENSION_SCREEN_PX,
    sameArcEndpoint, arcEndpointPoint, findArcEndpointFixedConstraint, pointLockedByLineFixed,
    editingQueries: { isDraggingArcEndpoint: (arc, endpoint) => geometryDrag.isArcEndpoint(arc, endpoint),
      isDraggingPoint: point => geometryDrag.isPoint(point), isDraggingCenter: point => geometryDrag.isCenter(point),
      editedSpline: () => splineEditing.current?.spline },
    annotationBounds, resolvedLoopBounds: window.HatchRegionEngine.resolvedLoopBounds, hatchAppearanceForDisplay,
  });
  const { geometryDisplayColor, geometryStrokeWidth, traceSplinePath } = geometryDisplay;
  const { sketchIdentityRelationLabel, sketchIdentityRelationColor } = interactionOverlay;
  const { sketchGeometryBounds, allGeometryBounds, visibleGeometryBounds } = drawingBounds;
  const { fitSketchToViewport, fitAllGeometryToViewport, resetEmptyViewport } = drawingFit;
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
  const annotationFeature = window.AnnotationFeature.create({
    ctx, viewport, surface: canvasSurface, effectiveAnnotationStyle, canvasSelection, readHover: () => canvasHover.current,
    readExportFrame: () => pngRendering.frame, canvasThemeColor, annotationLeaderAnchor, resolveGeometryRef, isEditableSketchElement,
    resizeEnabled: element => annotationDrag.resizeEnabled(element), activeSketchId, allAnnotations, isVisibleValue, isVisibleSketchId,
    currentScope: workspace.current, readEditingScope: () => editingScopeBinding.current, constraintTargetSession, pendingCommandSession,
    lastPointer: pointerInteractionController.readLastPointer, elementSketchId, guardSketchEdit, isReferenceSourceSketchId, geometryRefForItem,
    constraintOperandsFromSelection, recordHistory, updateUI, draw, setHint, cancelPendingCommand, cancelConstraintTargetCommand, applicationText,
    startDistanceResolution, defaultDimensionForTarget, normalizeDimension: dimensionPlacement.normalizeDimension, evaluateDimensionExpressionDraft,
    parameterNamespace, ensureDimensionParameter, parameterErrorText, exitDrawMode, nextAnnotationId: () => documentIds.allocate("annotation"),
    applyStyle: (style, key, value, effective) => appearanceEditing.applyLeaderAppearanceValue(style, key, value, { viewportScale: viewport.scale, effective }),
    canCreateInActiveSketch, rejectRootSketchCreation, annotationLeaderTargetFromHit, clearSelection, updateToolbar,
  });
  const { layer: annotationLayer, anchors: annotationAnchorConstraints, dimensions: annotationDimensions, command: annotationCommand,
    materialize: materializeAnnotationAnchor, dimensionScope: dimensionPresentationScope, startAnchorConstraint: startAnnotationAnchorConstraint } = annotationFeature;
  const { hitAnnotationElement: queryAnnotationElement, canvasContextAnnotationHit } = annotationFeature.spatial;
  const { annotationLeaderDisplayGeometry, annotationTextLayout, annotationTextMetrics, drawAnnotationText, drawAnnotationLeader } = annotationFeature.renderer;
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
  const geometryCreation = window.GeometryCreation.create({
    currentScope: workspace.current, ids: geometryIds, assignSketchId, currentConstruction: () => constructionCommand.enabled,
    minLineLength: MIN_LINE_LENGTH, minArcLength: MIN_ARC_LENGTH,
  });
  const { addPoint, addPointToSketch, addLine, addCircle, addArc, addSpline, ensureLineMinimumLength, normalizeArcSweep, enforceMinimumLineLengths, normalizeArcSweeps } = geometryCreation;
  const { endpointAt } = window.GeometryCreation.createEndpointResolver({
    addPoint, hitEndpointPoint: (x, y) => hitEndpointPoint(x, y), hitExplicitPoint: (x, y) => hitExplicitPoint(x, y),
  });
  const sketchProjectionEditing = window.SketchProjectionEditing.create({
    currentScope: workspace.current, queries: sketchProjectionQueries, resolveGeometryRef, geometryRefForItem, geometryKindForItem,
    constraintSketchId, constraintIsOperational, addPointToSketch, constraintReferencesPoint, nextSeq, normalizeAppearance,
  });
  const { separateSharedSketchProjectionTargetPoints, synchronizeSketchProjectionMetadata } = sketchProjectionEditing;
  const authoringTools = window.BasicDrawingTools.createAuthoring({
    currentScope: workspace.current, ids: geometryIds, geometry: geometryCreation, endpointAt, samePosition, sketchContext, pointUsage, geometryReads, isVisibleSketchElement,
    annotationAnchors: () => allAnnotations().filter(element => isVisibleSketchElement(element) && element.visible !== false).map(element => ({ element, ...annotationPlacementAnchor(element) })),
    scale: () => viewport.scale, transientAuthoring, pushModelConstraint, addConstraintIfMissing,
    minLineLength: MIN_LINE_LENGTH, minArcLength: MIN_ARC_LENGTH, selection: canvasSelection, preview: drawingPreview,
    checkpoint: { capture: (...args) => snapshotGeometryMutationState(...args), restore: (...args) => restoreGeometryMutationState(...args) },
    cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation,
    setMode: drawOperationLifecycle.setMode, resetEditing: () => splineEditing.reset(),
    resetBlankCandidate: () => blankCanvasGesture.resetCandidate(), updateToolbar, projection: sketchProjectionCommand, clearSelection,
    solveAndRefresh, recordHistory, applicationText, setHint, updateUI, draw, log,
  });
  const { snap: drawingSnap, spline: { command: splineCommand }, snapConstraints, tools: basicDrawingTools } = authoringTools;
  const { candidates: snapCandidates, clear: clearSnap } = drawingSnap;
  function snapForDrawing(point) { return authoringTools.snapForDrawing(point); }
  const { start: beginSplineCreation, removeLast: removeLastSplineInputPoint, finalize: finalizeSplineCreation, doubleClick: finalizeSplineFromDoubleClick } = splineCommand;
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
    preparation: documentPreparation, writer: documentWriter, loading: documentLoading, geometryInstances: geometryInstancePersistence } = createPersistence({
    placement: dimensionPlacement, pointUsage, readEditingScope: () => editingScopeBinding.current, readBlockEditor: () => blockEditor.current,
    version: CURRENT_JSON_VERSION, constraintReferencesPoint, separateSharedSketchProjectionTargetPoints, normalizeArcSweeps,
  });
  const sketchSolving = window.SketchSolving.create({
    currentScope: workspace.current, solver, scopeQuery: solveScopeQuery, activeSketchId, elementSketchId,
    constraintSketchId, constraintGraphNodes, constraintIsOperational, geometryInstanceBundles, orderedSketches,
    synchronizeSketchProjectionMetadata, refreshReferenceConstraintValidity, normalizeArcSweeps,
    resultIsAccepted, restoreModelState, acceptError: CONSTRAINT_ACCEPT_ERROR,
    profileDependencies: work => interactionProfiler.active ? profileInteractionWork("dependencies", work) : work(),
  });
  const { setSketchSolveOk, setSketchSolveError, sketchSolveState, solveSketchById,
    solveReferenceDependentSketches, solveSketchAndDependents, solveConstraintComponentAndDependents } = sketchSolving;
  const parameterStabilization = window.ParameterStabilization.create({
    namespace: parameterNamespace, currentParameterNamespace, activeSketchId,
    solveSketchAndDependents: sketchSolving.solveSketchAndDependents,
    captureValues: snapshotModelState, restoreValues: restoreModelState,
    maxPasses: PARAMETER_STABILIZATION_MAX_PASSES, relativeTolerance: PARAMETER_STABILIZATION_RELATIVE_TOLERANCE,
    nonConvergenceReason: () => applicationText("Parameter計算が収束しません", "Parameter calculation did not converge"),
    profile: work => interactionProfiler.active ? profileInteractionWork("parameters", work) : work(),
  });
  const { stabilize: stabilizeActiveParameterNamespace } = parameterStabilization;
  const storedDefinitionStabilization = window.ParameterStabilization.createStoredDefinition({
    currentScope: () => editingScopeBinding.current, activateScope: activateEditingScope, nextHatchIndex: () => documentIds.peek("hatch"),
    drawableSketchIds: blockDefinitionDrawableSketchIds, stabilizeNamespace: stabilizeActiveParameterNamespace,
  });
  const solveRefreshCommand = window.SolveRefreshCommand.create({
    activeSketchId, stabilizeActiveParameterNamespace, refreshConstraintAnalysis, setSolveResultHint, updateUI, draw, historyController, recordHistory,
  });
  const filletCommand = authoringTools.createFillet({
    defaultDimensionForTarget, syncLineOrientationHints: () => solver.syncLineOrientationHints?.(),
    pending: pendingCommandSession, readPointer: pointerInteractionController.readLastPointer,
    prepareStart: () => drawOperationLifecycle.prepare("fillet"), guardSketchProjectionShapeEdit,
    valueInput: dimensionInputController, checkpoint: editingCheckpoint,
    stabilize: () => stabilizeActiveParameterNamespace(activeSketchId()), acceptError: CONSTRAINT_ACCEPT_ERROR,
    invalidateAnalysis: () => { constraintAnalysis.invalidate(); }, refreshConstraintAnalysis,
    updateGeometrySelectionUI,
  });
  const { update: updateFilletRadiusPlacement, submit: submitFilletRadiusPlacement } = filletCommand;
  const blockConfigurationCommand = window.BlockConfigurationCommand.create({
    currentScope: workspace.current, blockDefinitionById, blockProjectionBundle, createBlockProjectionBundle,
    blockDefinitionDrawableSketchIds, blockDefinitionGeometrySketchIds, constraintGraphNodes,
    geometryRefKey, parseGeometryRefId, annotationReferencesRemovedGeometry, guardDimensionSymbolDeletion,
    canvasSelection, clearRemovedHover: removed => { if (removed.has(canvasHover.current.dimension)) canvasHover.update({ dimension: null }); },
    invalidateBlockProjectionCache, setHint, updateBlockUI, log, updateUI, draw, recordHistory,
  });
  const { setEnabledSketchIds: setBlockInstanceEnabledSketchIds } = blockConfigurationCommand;
  const { editing: synchronizedInstanceEditing, changeProperty: changeFreeInstanceProperty } = createInstanceEditing({
    snapshotModelState, restoreModelState, geometryInstanceBundle, geometryInstanceBundlesForScope,
    blockProjectionBundles, serializeModel, addPointSnapConstraints, geometryInstanceSourceObjects,
    rebind: () => constraintRebinding.rebuildDocument(editingScopeBinding.current, [...blockProjectionBundles(), ...geometryInstanceBundles()]),
    stabilize: stabilizeActiveParameterNamespace, acceptError: CONSTRAINT_ACCEPT_ERROR,
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
  const { submit: submitDistanceValue, commitProperty: commitDimensionPropertyEdit } = dimensionValueCommand;
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



  function ensureAppearanceState() {
    return documentPreparation.appearance();
  }

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

  const { serializeGeometryInstance } = window.DocumentSnapshot;

  function hitAnnotationElement(x, y, options = {}) {
    return queryAnnotationElement(x, y, { activeOnly: !ordinarySelectionMode(), ...options });
  }

  function hitReferenceImageAt(...args) { return regionHitQuery.hitReferenceImageAt(...args); }

  const { beginDrag: beginReferenceImageDrag, startCalibration: startReferenceImageCalibration, calibrationClick: handleReferenceImageCalibrationClick } = referenceImageInteraction;

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









  function resultIsAccepted(result) {
    return Boolean(result) && Number.isFinite(result.errorNorm) && result.errorNorm <= CONSTRAINT_ACCEPT_ERROR;
  }

  function clearSketchSolveState(...args) { return sketchSolving.clearSketchSolveState(...args); }

  function sketchHasSolveError(sketchId) {
    return sketchSolveState(sketchId)?.status === "error";
  }



  function solveAndRefresh(...args) { return solveRefreshCommand.run(...args); }


  function refreshConstraintAnalysis(options = {}) { return constraintAnalysis.refresh(options); }



  function canvasThemeColor(value) {
    return window.CanvasThemeColors.color(value, applicationSettings.theme);
  }



  function selectedItemsForGeometryInstance() { return instanceSourceSelection.read(); }









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
  const { begin: beginSplineEditFromDoubleClick,
    addPoint: addSplineFitPointFromContext, deletePoint: deleteSplineFitPointFromContext } = splineEditing;

  const blockSelectionQuery = window.BlockSelectionQuery.create({
    currentScope: workspace.current, canvasSelection, blockProjectionBundle, elementSketchId, activeSketchId,
    constraintGraphNodes, serializeConstraint, constraintLabelForList: (constraint) => localizedConstraintName(constraint.name), resolveGeometryRef,
    applicationText, mergeBounds, lineBBox, primitiveBBox, splineBBox, annotationBounds,
  });
  const { read: blockSelectionGeometry, center: blockSelectionBoundsCenter } = blockSelectionQuery;



  function reserveBlockEditorSequences(draft) { return idReservation.scope(draft); }

  const choiceDialog = window.ChoiceDialog.create(document.getElementById("choiceDialog"));
  const { definition: blockDefinitionCommand, completion: blockCompletionCommand, createView: createBlockView } = blockEditingFeature.createCommands({
    canStartCreation: () => isGeometryMode() && canCreateInActiveSketch() && guardSelectionEdit("structure"),
    canvasSelection, selectionQuery: blockSelectionQuery, guardDimensionSymbolDeletion, resetBlockEditorHistory, clearSelection,
    setMode: drawOperationLifecycle.setMode, closeDefinitions: () => blockView.closeDefinitions(),
    setEditorActive: active => blockView.setEditorActive(active), fitAllGeometryToViewport,
    resetEmptyViewport,
    promptName: name => window.prompt("ブロック名", name), updateBlockUI, updateUI, draw, recordHistory, setHint,
    refreshReferenceConstraintValidity,
    hasInvalidReferenceConstraints: () => referenceConstraintState.errorCount > 0,
    solveSketchById, resultIsAccepted, sketchName, solveReferenceDependentSketches,
    requestChoice: options => choiceDialog.show(options), applicationText, blockLocalGeometryBounds,
    constraintGraphNodes, annotationReferencesRemovedGeometry, acceptError: CONSTRAINT_ACCEPT_ERROR, setSketchSolveOk, setSketchSolveError, log,
  });
  const { startCreation: startBlockCreation, open: openBlockDefinitionEditor, enter: enterBlockDefinitionEdit,
    cancel: cancelBlockDefinitionEdit } = blockDefinitionCommand;
  const { complete: completeBlockDefinitionEdit } = blockCompletionCommand;

  function syncOffsetChainSelection() { return canvasSelection.applyOffsetSelection(offsetSelection); }

  function resetModelState() { return documentEditingReset.reset(); }


  function reserveGeometryElementSequences(source) { return idReservation.geometry(source); }


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


  const documentApplication = window.DocumentApplication.create({
    documentLoading, document: documentModel, model: editingScopeBinding.current, resetEditingState: resetModelState,
    sketchTreeView: { capture: () => sketchTreeView.capture(), restore: state => sketchTreeView.restore(state) },
    refreshReferenceConstraintValidity, enforceMinimumLineLengths, ensureDimensionDefaults,
    restoreSequences: sequences => {
      reserveGeometryElementSequences(sequences.geometry);
      documentIds.restore(sequences);
    },
    ensureAppearanceState, ensureBlockState, log,
  });
  function loadModelData(data, options = {}) {
    return documentApplication.load(data, options);
  }

  const canImportDxf = () => canCreateInActiveSketch() && !hasActiveDrawOperation()
    && !pendingCommandSession.current && !constraintTargetSession.command && drawOperationLifecycle.mode !== "block-place";
  const dxfImportFeature = documentFileFeature.createDxf({
    geometry: geometryCreation, ids: geometryIds, currentScope: workspace.current, activeSketchId, canImport: canImportDxf,
    minimumLength: MIN_LINE_LENGTH, clearSelection, updateUI, recordHistory,
  });

  referenceImageInput.bindClipboard();
  const { importFile: importReferenceImageFile, clipboard: imageClipboard } = referenceImageInput;



  function clearSelection() { return selectionClearing.clear(); }

  authoringTools.createLifecycle({ lifecycle: drawOperationLifecycle,
    canStart: nextMode => nextMode === "select" || guardSketchEdit(activeSketchId(), "create") && (nextMode !== "trim" || guardSelectionEdit("structure")),
    instances: geometryInstanceCommand, instanceSources: instanceSourceCommand, centerline: centerlineCommand,
    fillet: filletCommand, offset: offsetSelection, hatch: { reset: () => hatchCommand.reset() },
    clearTrimHover: () => canvasHover.update({ point: null, endpointPoint: null, line: null, circle: null, arcEndpoint: null, arc: null, dimension: null }),
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





  const deletionFeature = window.DeletionFeature.create({
    currentScope: workspace.current, pointUsage, constraintReferencesPoint, constraintReferencesLine, constraintReferencesPrimitive,
    geometryElementKey, annotationReferencesRemovedGeometry, geometryInstanceBundle, blockAllProjectionBundle, constraintGraphNodes, annotationDimensions,
    canvasSelection, splineEditing, canvasHover, guardSketchEdit, elementSketchId, geometryInstanceDependencyRefs, geometryRefKey,
    guardDimensionSymbolDeletion, applicationText,
    resetGeometryDrag: () => geometryDrag.reset(), resetDimensionDrag: () => dimensionDrag.reset(), resetAnnotationDrag: () => annotationDrag.reset(),
    pendingCommandSession, constraintTargetSession, lineCommand, circularCommands, drawingPreview, selectMode: drawOperationLifecycle.selectMode,
    solveSketchAndDependents, normalizeArcSweeps, updateToolbar, updateUI, draw, analysisStable: () => constraintAnalysis.stable, setHint, log, recordHistory,
    referenceImageInteraction, guardSelectionEdit, selectionSketchId, activeSketchId, geometryRefForItem, invalidateBlockProjectionCache,
    effectiveSelectedConstraint, clearSelection, solveAndRefresh,
  });
  function rejectReferencedGeometryDeletion(instances, label) { return deletionFeature.rejectReferences(instances, label); }
  function deleteElements(options) { return deletionFeature.remove(options); }
  function deleteCurrentSelection() { return deletionFeature.removeSelection(); }

  const clipboardFeature = window.ClipboardFeature.create({
    blockProjectionBundle, blockProjectionLocalId, resolveGeometryRef, geometryInstanceSourcePoints, geometryInstanceBundle, applicationText,
    annotationTextLayout, annotationTextMetrics, annotationLeaderDisplayGeometry, annotationLeaderAnchor, effectiveAnnotationStyle, viewport,
    serializeGeometryInstance, constraintGraphNodes, serializeConstraint, decorateSerializedConstraint,
    currentScope: () => editingScopeBinding.current, canvasSelection, blockScopeId: currentBlockDefinitionScopeId, setHint,
    pasteOffsetScreenPx: CLIPBOARD_PASTE_OFFSET_SCREEN_PX, imageClipboard, updateToolbar, deleteSelection: deleteCurrentSelection,
    geometryIds, ensureLineMinimumLength, normalizeArcSweep, blockDefinitionById, documentIds, normalizeGeometryInstance,
    parameters: parameterNamespace, deserializeConstraint, invalidateProjection: invalidateBlockProjectionCache,
    isGeometryMode, blockDefinitionScopeError, canCreateInActiveSketch, guardSketchEdit, activeSketchId, currentParameterNamespace,
    clearSelection, selectMode: drawOperationLifecycle.selectMode, solveAndRefresh, updateUI, draw, sketchName,
  });
  const { session: clipboardSession, command: clipboardCommand } = clipboardFeature;
  function copyableSelectionPayload() { return clipboardFeature.copyableSelectionPayload(); }
  function copySelectionToClipboard(options = {}) { return clipboardCommand.copy(options); }

  function pasteGeometryClipboard() { return clipboardCommand.paste(); }

  function ensureDimensionDefaults() { return window.DocumentState.normalizeDimensionState(editingScopeBinding.current, targetFromConstraint, (target, dimension) => dimensionPlacement.normalizeDimension(target, dimension)); }

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








  function drawLines(...args) { return geometryDisplay.drawLines(...args); }
  function drawCircles(...args) { return geometryDisplay.drawCircles(...args); }
  function drawArcs(...args) { return geometryDisplay.drawArcs(...args); }
  function drawSplines(...args) { return geometryDisplay.drawSplines(...args); }






  function drawDimension(...args) { return dimensionPainter.drawDimension(...args); }















  function drawDimensions() { return dimensionLayer.draw(); }








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


  function drawArcEndpointHandles() { return geometryDisplay.drawArcEndpointHandles(); }

  function drawPoints() { return geometryDisplay.drawPoints(); }

  function selectedVisibilityTargets() { return propertySelection.visibilityTargets(); }
  function selectionVisibilityIsHidden(targets) { return propertySelection.visibilityIsHidden(targets); }
  function toggleSelectedVisibility() { return selectionVisibilityCommand.toggle(); }

  const { view: toolbarView, status: commandStatusView } = toolbarPresentation.createControls({
    selectedVisibilityTargets, selectionVisibilityIsHidden,
    canEditTarget: target => canEditSketch(target.kind === "constraint" ? constraintSketchId(target.item) : elementSketchId(target.item)),
    updateCursor: commandCursor.update,
  });
  function updateToolbar() { toolbarView.update(); }

  const { selectionQuery: constraintSelectionQuery, targets: constraintTargetCommand, dimensions: dimensionPlacementCommand, createControls: createConstraintControls,
    createCommit: createConstraintCommit, createCommandInput: createConstraintCommandInput, constraintTargetHint } = window.ConstraintEditing.createWithFeedback({
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

  function handleConstraintTargetDoubleClick(hitP, hitL, pointer) { return dimensionPlacementCommand.targetDoubleClick(hitP, hitL, pointer); }

  function startInstanceAngleDimension(instance) { return dimensionPlacementCommand.startInstanceAngleDimension(instance); }
  function startDistanceCommand() { return dimensionPlacementCommand.startDistanceCommand(); }

  function cancelPendingCommand(message) { return pendingCommandSession.cancel(message); }

  function startDistanceValueInput(pointer) { return dimensionPlacementCommand.startDistanceValueInput(pointer); }


  const { updateHover: updatePendingDistanceRetargetHover, createFeature: createConstraintInputFeature } = createConstraintCommandInput({
    canvasHover, canvasPoint, referenceTargetFromOperand,
  });

  function startDimensionEditInput(hit) { return dimensionValueCommand.startEdit(hit); }

  function selectedFixedBatchTargets() { return constraintSelectionQuery.fixedBatch(); }
  function fixedBatchIsFullyFixed(batch) { return constraintSelectionQuery.fullyFixed(batch); }
  const { view: constraintControlsView, createBinding: createConstraintControlBinding } = createConstraintControls({
    document, constraintButtons, constraintMenuButtons, fixPointBtn, hasSelection, translatedExactText,
  });
  function updateConstraintButtons() { constraintControlsView.update(); }

  const sketchInteractionReset = window.SketchCommand.createInteractionReset({
    resetSketchMove: () => sketchMoveCommand?.reset(), clearSelection,
    resetGeometryDrag: () => geometryDrag.reset(), resetDimensionDrag: () => dimensionDrag.reset(),
    referenceImage: referenceImageInteraction, selectionRectangle, drawing: drawOperationLifecycle,
    pending: pendingCommandSession, constraint: constraintTargetSession, projection: sketchProjectionCommand,
    instances: geometryInstanceCommand, instanceSources: instanceSourceCommand, hover: canvasHover,
    clearPointer: pointerInteractionController.clearLastPointer, hideValueInput: hideDimensionValueInput, clearSnap,
    selectMode: drawOperationLifecycle.selectMode, updateToolbar,
  });
  function clearInteractionForSketchChange() { return sketchInteractionReset.clear(); }

  const sketchEditing = window.SketchEditingFeature.create({
    currentScope: workspace.current, sketches: sketchContext, ids: documentIds, selection: canvasSelection,
    geometryReads, projections: blockProjections, constraintReferences,
    clearInteractionForSketchChange, clearSelection, applicationText, setHint, updateUI, draw, recordHistory,
    promptName: (title, name) => window.prompt(title, name), effectiveAppearanceForElement,
    clearTreeHover: () => sketchTreeController.clearHoverSketch(), clearSnap, guardEdit: guardSketchEdit,
    prepareLockToggle: () => { cancelPendingCommand(""); cancelConstraintTargetCommand(""); exitDrawMode(); },
  });
  const { createSketch, activate: setActiveSketch, toggleVisibility: toggleSketchVisibilityCommand } = sketchEditing.command;
  function toggleSketchVisibility(id) { return toggleSketchVisibilityCommand(id); }
  const { command: createdSketchMoveCommand, input: sketchMoveInputBinding } = sketchEditing.createMoveWithInput({
    document, prepare: () => { cancelConstraintTargetCommand(""); cancelPendingCommand(""); exitDrawMode(); canvasHover.clear(); },
    readEditingScope: () => editingScopeBinding.current, hatches: hatchGeometryQuery, rebinding: constraintRebinding,
    analysis: constraintAnalysis, refreshReferenceConstraintValidity,
  });
  // Publish the command before enabling destination-only input.
  sketchMoveCommand = createdSketchMoveCommand;
  sketchMoveInputBinding.bind();
  const hatchCommand = window.HatchCommand.create({
    currentScope: workspace.current, hatchGeometryQuery, getMode: drawOperationLifecycle.readMode, setMode: drawOperationLifecycle.setMode,
    lastPointer: pointerInteractionController.readLastPointer, getPointerPreview: () => drawingPreview.pointer, setPointerPreview: value => { drawingPreview.setPointer(value); },
    activeSketchId, setActiveSketch, canCreateInActiveSketch, rejectRootSketchCreation,
    nextHatchId: () => documentIds.allocate("hatch"), hatchSequence: () => documentIds.peek("hatch"),
    cancelConstraintTargetCommand, cancelPendingCommand, clearSnap, clearSelection, canvasSelection,
    updateToolbar, updateStatusUI, updateUI, setHint, draw, recordHistory, applicationText, hatchRegionErrorText,
  });
  const { updateHatchPreview, startHatchCreation, startHatchBoundaryRepair, commitHatchAt } = hatchCommand;



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



  const fixedOperandCommand = window.FixedToggleCommand.createOperand({
    modelTypes: window.GeometrySolver, guardSketchEdit, elementSketchId, operandElement, guardSketchProjectionShapeEdit, applicationText,
    findLineFixedConstraint, findArcEndpointFixedConstraint, arcEndpointPoint,
    currentScope: workspace.current, sameConstraintDisplayElement, deleteElements, commitNewConstraint, solveAndRefresh,
  });

  const { view: sketchTreeView, controller: sketchTreeController, menu: sketchTreeContextMenu } = sketchEditing.createTree({
    readServices: geometryReadServices, canvasHover, selectionHighlight,
    objectOptions: { constraintFeedback, isHidden: selectionVisibilityIsHidden, pointUsage, analysis: constraintAnalysis,
      redundancy: constraintRedundancy, referenceState: referenceConstraintState, projectionQueries: sketchProjectionQueries,
      toolbarSvgMarkup, constraintToolbarIcon, findLineFixedConstraint, geometryInstanceTypeLabel, hatchPatternTypeLabel },
    document, window, applicationSettings, escapeHtml, closeCanvasContextMenu,
    moveCommand: sketchMoveCommand, deletion: sketchDeletionCommand,
    getScopeKey: () => blockEditor.current?.draft?.id ? `block:${blockEditor.current.draft.id}` : "document",
    viewScope: () => editingScopeBinding.current, sketchHasSolveError, referenceConstraintErrorCountForSketch, constraintDuplicateCountForSketch,
    dimensionScope: dimensionPresentationScope,
    toggleBlockInstanceSelection, targetFromConstraint,
    updateSketchUI, selectionSketchId, deleteElements, deleteCurrentSelection, toggleSelectedVisibility,
    updateSelectionUI: updateGeometrySelectionUI,
    unfixPoint: fixedOperandCommand.unfixPoint,
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
  const { context: focusedExpressionInputContext, insertDimension: insertClickedDimensionParameter, insertAnnotation: insertClickedAnnotationParameter } = expressionInputController;











  const { selection: propertySelection, createEditing: createPropertyEditing } = window.PropertiesDisplay.createFeature({
    document, documentModel, currentScope: workspace.current, canvasSelection, readServices: geometryReadServices, sketchContext, hatchAppearanceForDisplay,
    selectionOperation: () => ({ mode: drawOperationLifecycle.mode, instanceSourceEdit: instanceSourceCommand.current, freeInstancePlacement: geometryInstanceCommand.pending, blockPlacementDefinitionId: blockPlacementCommand.definitionId }),
  });
  function selectedPropertiesTarget() { return propertySelection.selectedDisplayTarget(); }
  const { editing: propertyEditing, appearanceUI, createView: createPropertiesView } = createPropertyEditing({
    appearanceScope: () => editingScopeBinding.current, viewport, checkpoint: editingCheckpoint, parameterStabilization,
    guardSketchProjectionShapeEdit, synchronizeSketchProjectionMetadata, materializeAnchor: materializeAnnotationAnchor,
    isGeometryMode, toggleSketchVisibility, guardSelectionEdit, applicationSettings, escapeHtml,
    invalidateBlockProjectionCache, recordHistory, updateUI, updatePropertiesUI, draw,
  });
  const { appearanceEditing, visibility: selectionVisibilityCommand } = propertyEditing;
  const propertiesView = createPropertiesView({
    getOperation: () => ({ mode: drawOperationLifecycle.mode, freeInstancePlacement: geometryInstanceCommand.pending, instanceSourceEdit: instanceSourceCommand.current, blockPlacementEnabledSketchIds: blockPlacementCommand.enabledSketchIds, blockPlacementRotationLocked: blockPlacementCommand.rotationLocked }),
    sketchProjectionConstraintForTarget,
    constraintGeometryId, constraintFeedback, constraintStatusOf, snappedBlockRotation, constraintDefiningGeometryEntries,
    resolvedHatchBoundary, hatchRegionErrorText,
    geometryInstanceTypeLabel, parameterNamespace, installExpressionInputHighlights,
    HTMLTextAreaElement, HTMLInputElement,
    canEditStructure: item => guardSketchEdit(elementSketchId(item), "structure"),
    changeFreeInstanceProperty, commitDimensionPropertyEdit, commitAnnotationParameterEdit, setHint,
    blockPlacement: blockPlacementCommand,
    setBlockInstanceRotationLocked, setBlockInstanceEnabledSketchIds, setBlockInstanceOrthogonalRotation,
    annotationCommand, startInstanceSourceEdit: instanceSourceCommand.startForInstance, startInstancePlacementEdit: geometryInstanceCommand.startEdit, startInstanceAngleDimension, startReferenceImageCalibration, startHatchBoundaryRepair,
    startSplineEdit: spline => splineEditing.activate(spline),
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

  const constraintInputFeature = createConstraintInputFeature();
  const dimensionDragFeature = window.DimensionDragFeature.create({
    placement: dimensionPlacement, viewport, canvasSelection, currentScope: workspace.current,
    constraintSketchId, isEditableSketchId, isVisibleSketchId, effectiveDimensionAppearance, isVisibleValue,
    guardSketchEdit, commandInput: constraintInputFeature.dimension, setHint, clearSnap, hypot2,
    beginPointer: dragPointer.markThenCapture,
    endPointer: dragPointer.release,
    draw, updateUI, updateGeometrySelectionUI, syncDimensionValueInput, recordHistory,
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

  const canvasInputFeature = window.CanvasCommandInputs.createFeature({
    readMode: drawOperationLifecycle.readMode, readPending: pendingCommandSession.read, readPendingConstraint: () => constraintTargetSession.command,
    document, canvas, canvasSelection, clearSelection, canvasHover, draw, updateUI, updateGeometrySelectionUI, setHint, applicationText,
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

  canvasInputFeature.bindPointer(pointerInteractionController, {
    canvasNavigation, drawingPreview, recordHistory, referenceImageInteraction, pointerHover,
    updateHatchPreview, updateFilletRadiusPlacement, updatePendingDistanceRetargetHover, hitDimension, hitSketchIdentityElement,
    press: { discardMove: () => flushScheduledCanvasPointerMove({ discard: true }),
      selectInactive: identitySelection.selectInactive,
      prepareSelection: identitySelection.prepareSelection,
      activation: { finalizeSpline: finalizeSplineFromDoubleClick, submitOffset: submitOffsetValue,
        startAnnotationEdit: annotationInputController.start, startDimensionEdit: startDimensionEditInput, startDistanceValue: startDistanceValueInput, submitDistance: submitDistanceValue,
        constraintDoubleClick: handleConstraintTargetDoubleClick, enterBlock: enterBlockDefinitionEdit, beginSplineEdit: beginSplineEditFromDoubleClick },
      query: canvasPressQuery,
      closeContextMenu: closeCanvasContextMenu, insertDimensionParameter: insertClickedDimensionParameter,
      referenceDimensionAt: point => focusedExpressionInputContext() ? hitDimension(point.x, point.y, { activeOnly: false }) : null,
      insertAnnotationParameter: insertClickedAnnotationParameter,
      referenceAnnotationAt: point => focusedExpressionInputContext() ? hitAnnotationElement(point.x, point.y, { activeOnly: false }) : null,
      commitHatch: commitHatchAt, calibrateImage: handleReferenceImageCalibrationClick,
      placeFilletRadius: submitFilletRadiusPlacement, placeBlock: handleBlockPlacementClick, blankGesture: blankCanvasGesture,
    },
  });


  const canvasInputBinding = createCanvasInputBinding({
    pointer: pointerInteractionController, readCommandPanel: presentation.readCommandPanel, readPngExportCommand: () => pngExportCommand,
    blankCanvasGesture, isBlankCommandPanelPoint, scheduler: pointerMoveScheduler,
    profileCommit: work => profileInteractionPhase("commit", work),
  });
  canvasInputBinding.bind();
  dimensionInput.bind();

  const keyboardInput = canvasInputFeature.createKeyboard({
    window, menus: { closeSketch: () => sketchContextController.close(),
      canvasVisible: () => canvasContextMenu && !canvasContextMenu.hidden, closeCanvas: closeCanvasContextMenu },
    sketchMove: sketchMoveCommand, constraintStatusView, dimensionInput: dimensionInputController,
    shortcuts: { save: saveJot2DFile, saveAs: saveJot2DFileAs, copy: copySelectionToClipboard,
      paste: pasteGeometryClipboard, nativePaste: true, nativeCopy: true, undo: undoHistory, redo: redoHistory },
    isGeometryMode, projection: sketchProjectionCommand,
    referenceImage: referenceImageInteraction, splineEditing, blockPlacement: blockPlacementCommand,
    pendingCommandSession, cancelPendingCommand, constraintTargetSession, cancelConstraintTargetCommand,
    drawing: { active: hasActiveDrawOperation, cancel: cancelActiveDrawOperation, isToolMode: isDrawToolMode, exit: exitDrawMode },
    finishSpline: finalizeSplineCreation, finishProjection: commitSketchProjectionCommand, finishHatch: hatchCommand.finish,
    removeSplinePoint: removeLastSplineInputPoint, offset: offsetCommand, readPointer: pointerInteractionController.readLastPointer,
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
  const dxfFileControls = dxfImportFeature.createControls({ flushScheduledCanvasPointerMove });
  dxfFileControls.bind();
  referenceImageInput.bindControls();
  sketchTreeView.bindCreation(createSketch);

  window.SidebarController.create({ document, setHint }).bind();


  function toggleGeometryFixedOperand(operand) { return fixedOperandCommand.toggle(operand); }

  const fixedSelectionCommand = window.FixedToggleCommand.createSelection({
    modelTypes: window.GeometrySolver, guardSelectionEdit, canvasSelection, blockDefinitionById, setHint, clearSelection,
    updateUI, draw, recordHistory, findArcEndpointFixedConstraint, deleteElements,
    log, arcEndpointPoint, guardSketchProjectionShapeEdit, applicationText, snapshotModelState,
    commitNewConstraint, restoreModelState, selectedFixedBatchTargets, fixedBatchIsFullyFixed,
    findLineFixedConstraint, pushModelConstraint, currentScope: workspace.current, solveSketchAndDependents,
    acceptError: CONSTRAINT_ACCEPT_ERROR, refreshConstraintAnalysis,
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
    const { readStatuses: readTestConstraintStatuses, publicAPI: constraintModelTestApi } = window.ConstraintTestDriver.createModelSupport({
      refreshConstraintAnalysis, readMembership: readSketchMembership, activeSketchId, sketchSolveVariables, sketchSolveConstraints, sketchSolveLines,
      analyzeConstraintState: options => solver.analyzeConstraintState(options), acceptError: CONSTRAINT_ACCEPT_ERROR, vectorNorm, currentScope: workspace.current, elementSketchId, blockProjectionBundles,
      blockInstanceById, blockProjectionBundle, commitNewConstraint, PointOnLineConstraint, serializeModel,
    });
    const dragExecutionSupport = window.GeometryDragTestDriver.createExecutionSupport({
      feature: geometryDragFeature, solver, currentScope: workspace.current, normalizeArcSweeps, vectorNorm, sketchSolveConstraints,
      arcEndpointPoint, now: () => performance.now(), readConstraintStatuses: readTestConstraintStatuses,
    });
    const annotationTestSupport = window.AnnotationTestDriver.createForFeature({
      feature: annotationFeature, geometry: geometryCreation, readServices: geometryReadServices, dimensionDisplay, dimensionLabelForConstraint,
      currentScope: workspace.current, viewport, canvas, selection: canvasSelection, drag: annotationDrag, annotationLeaderAnchor,
      annotationLeaderTargetFromItem, draw, allGeometryBounds, resetModelState, resizeCanvas, hitAnnotationElement,
    });
    const dimensionTestSupport = window.DimensionTestDriver.createSupport({
      resetModelState, addPoint, addLine, dimensionFromAnchor, addDistanceConstraintFromTarget, activeSketchId, currentScope: workspace.current,
      isDimensionConstraint, dimensionLayout, hypot2, targetFromConstraint, serializeModel, constraintTargetSession, pendingCommandSession,
      dimensionValueInput, ctx, drawDimensions, constraintSketchId, canvasSelection, viewport,
    });
    const dimensionFixtureSupport = dimensionTestSupport.createFixtures({
      isReadOnlyDimension, dimensionLabelForConstraint, defaultDimensionForTarget, startDistanceValueInput, dimensionWithLabelAt,
      angleDimensionLabelBasis, angleDimensionLayout, angleDimensionLabelOffsets, setAngleDimensionLabelOffsets, angleDimensionFromLabelPoint,
      serializeDimension, rootSketchId: ROOT_SKETCH_ID, sketchById, isVisibleSketchId,
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
    const strokeStyleCases = window.PropertiesTestDriver.createStrokeStyleCases({ resetModelState, addLine, addPoint, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID, defaultSketchId: DEFAULT_SKETCH_ID, geometryStrokeWidth, constructionAlpha: CONSTRUCTION_GEOMETRY_ALPHA });
    const sketchTreeTestApi = window.SketchTreeTestDriver.createBrowserApi({
      resetModelState, sketchById, defaultSketchId: DEFAULT_SKETCH_ID, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID, addPoint, addLine,
      refreshReferenceConstraintValidity, fitAllGeometryToViewport, updateUI, draw, canvas, worldToCanvasScreen, sketchRelationToActive,
      sketchIdentityRelationLabel, sketchIdentityRelationColor, document, getComputedStyle: element => getComputedStyle(element), isVisibleSketchId,
      serializeModel, sketchStrokeWidth, constraintStatusColor, activeSketchId, addDistanceConstraintFromTarget, dimensionFromAnchor, isDimensionConstraint,
      createEmptyBlockDefinition, Point, Line, appendDefinition: definition => documentModel.blockDefinitions.push(definition),
      nextInstanceId: () => documentIds.allocate("blockInstance"), invalidateBlockProjectionCache, viewport, dimensionLayout, targetFromConstraint,
      clientPosition: canvasTestDriver.clientPosition, blockInstanceDisplayCenter, canvasHover, addCircle, addArc, blockProjectionBundle,
    });
    const referenceLineMove = window.ConstraintTestDriver.createReferenceLineMove({ currentScope: workspace.current, elementSketchId, solveReferenceDependentSketches, refreshConstraintAnalysis, updateUI, draw, defaultSketchId: DEFAULT_SKETCH_ID, isExplicitPoint });
    const dependencyOrderFixture = window.ConstraintTestDriver.createDependencyOrderFixture({
      resetModelState, sketchById, defaultSketchId: DEFAULT_SKETCH_ID, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID, addLine, addPoint, markReferenceConstraint, PointOnLineConstraint, CoincidentConstraint, refreshReferenceConstraintValidity, solveReferenceDependentSketches,
    });
    const cyclicReferenceFixture = window.DocumentTestDriver.createCyclicReferenceFixture({
      resetModelState, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID, defaultSketchId: DEFAULT_SKETCH_ID, addPoint, markReferenceConstraint, CoincidentConstraint, serializeModel, loadModelData,
      refreshConstraintAnalysis, updateUI, constraintIsOperational, readReferenceErrors: () => referenceConstraintState.errorReasons(), document,
    });
    const constraintCaseTestApi = window.ConstraintTestDriver.createEditingCases({
      resetModelState, addPoint, addLine, DistanceConstraint, dimensionFromAnchor, pushModelConstraint,
      canvasSelection, constraintTargetSession, updateUI, fitAllGeometryToViewport, draw, canvas,
      HorizontalConstraint, PointOnLineConstraint, addArc, RadiusConstraint, solveSketchAndDependents, activeSketchId,
      snapshotModelState, refreshConstraintAnalysis, constraintStatusOf, constraintStatusColor, readSummary: () => constraintAnalysis.summary(), currentScope: workspace.current,
      worldToCanvasScreen, rootSketchId: ROOT_SKETCH_ID, defaultSketchId: DEFAULT_SKETCH_ID, elementSketchId, solveReferenceDependentSketches, isExplicitPoint,
      wouldCreateReferenceCycle, signedPointLineDistance, constraintSketchId,
    });
    const blockTestSupport = window.BlockTestDriver.createBrowserSupport({
      geometry: geometryCreation, modelTypes: window.GeometrySolver, documentModel, currentScope: workspace.current, sketches: sketchContext,
      projections: blockProjections, reads: geometryReads, queries: blockEditingQueries, selection: canvasSelection,
      editor: blockEditor, editorChain: blockEditorSessionChain, placement: blockPlacementCommand, readMode: drawOperationLifecycle.readMode, solver,
      canvas, viewport, worldToCanvasScreen, resetModelState, pushModelConstraint, fitAllGeometryToViewport, updateUI, draw, commitBlockPlacement,
      solveSketchById, recordHistory, serializeConstraint, createSketch, cancelBlockDefinitionEdit, completeBlockDefinitionEdit,
      setBlockInstanceEnabledSketchIds, serializeModel, loadModelData, enterBlockDefinitionEdit, blockInstanceDisplayCenter,
      buildDragSession, constraintTargetSession, canvasHover, blockSelectionGeometry, geometryRefForItem,
    });
    const sidebarHighlightObservation = window.PropertiesTestDriver.createHighlightObservation({ canvasSelection, effectiveSelectedConstraint, constraintHighlightNodes, selectionHighlight, canvasHover });
    const sidebarHoverKeyObservation = window.PropertiesTestDriver.createHoverKeyObservation({ allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines, isSidebarHoveredElement, geometryElementKey });
    const blockTestActions = blockTestSupport.createDimensionCases({
      defaultDimensionForTarget, readOnlyDimensionConstraintForPlacement, addReadOnlyDimensionConstraint, blockDefinitionById,
    });
    const dimensionInteractionSupport = dimensionTestSupport.createInteraction({
      clientPosition: canvasTestDriver.clientPosition, startDimensionEditInput, clearSelection, updateUI, draw, addCircle, addArc,
      fitAllGeometryToViewport, startDistanceCommand, constraintGraphNodes, worldToCanvasScreen, canvas, dimensionAnchor,
      modelTypes: window.GeometrySolver, signedPointLineDistance, vectorNorm, solveSketchAndDependents,
      snapshotModelState, refreshConstraintAnalysis, dimensionDrag,
    });
    const themeObservation = window.PropertiesTestDriver.createThemeObservation({ applicationSettings, readDefaultGeometryColor: () => DEFAULT_APPEARANCE.color, canvasThemeColor, CanvasThemeColors: window.CanvasThemeColors });
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
    const sidebarInspectionFixture = window.PropertiesTestDriver.createInspectionFixture({
      resetModelState, addPoint, addLine, addCircle, addArc, pushModelConstraint, HorizontalConstraint, DistanceConstraint, dimensionFromAnchor, assignConstraintSketchId, activeSketchId, currentScope: workspace.current, updateUI, fitAllGeometryToViewport, draw, canvas, worldToCanvasScreen,
    });
    const appearanceTestAction = window.PropertiesTestDriver.createAppearanceAction({
      appearanceSelectionTarget, normalizeAppearance, invalidateBlockProjectionCache, updatePropertiesUI, draw, recordHistory,
    });
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
    const constraintInputObservation = window.ConstraintTestDriver.createInputObservation({
      readSelectedGeometry: readTestSelectedGeometry, canvasSelection, constraintTargetSession, operandElement,
    });
    const constraintIntentTestDriver = window.ConstraintTestDriver.createIntentResolution({ currentScope: workspace.current, makeConstraintOperand, resolveConstraintIntent, serializeConstraint });
    const hoverDisplayObservation = window.PropertiesTestDriver.createHoverObservation({
      allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines, blockInstanceById, blockProjectionBundle, effectiveAppearanceForElement,
      isSidebarHighlightedElement, Point, isAnyLineEndpoint, isSidebarHoveredElement, canvasHover, geometryDisplayColor, geometryStrokeWidth,
    });
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
      currentScope: workspace.current, elementSketchId, findLineFixedConstraint, modelTypes: window.GeometrySolver, fixPointBtn, readHistory: readTestHistory,
    });
    const parameterFixture = window.ParameterTestDriver.createFixture({
      resetModelState, addPoint, addLine, pushModelConstraint, HorizontalConstraint, DistanceConstraint, dimensionFromAnchor, currentScope: workspace.current,
      formatParameterReference, createEmptyBlockDefinition, Point, Line, DEFAULT_SKETCH_ID, ensureParameterNamespace,
      appendDefinition: definition => documentModel.blockDefinitions.push(definition), nextInstanceId: () => documentIds.allocate("blockInstance"),
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
    const dimensionDisplaySupport = dimensionTestSupport.createDisplay({
      Point, Arc, placement: dimensionPlacement, layouts: dimensionLayouts, metrics: dimensionMetrics, circlePointAtAngle,
      screenPxPerMm: DIMENSION_SCREEN_PX_PER_MM, outsideShaftLengthFactor: DIMENSION_OUTSIDE_SHAFT_LENGTH_FACTOR,
      fitMarginFactor: DIMENSION_TERMINATOR_FIT_MARGIN_FACTOR, canvasHover, readDocument: () => documentModel, normalizeDimensionAppearance,
      effectiveDimensionAppearanceForSketch, dimensionDisplayState, effectiveDimensionAppearance,
      displayFactor: window.Appearance.annotationDisplayFactor, formatDimensionLabel, formatMeasuredDimensionLabel, jisDimensionTextAngle,
      dimensionTextOffset,
    });
    const referenceImageTestObservation = window.ReferenceImageTestDriver.createObservation({
      canvasSelection, currentScope: workspace.current, serializeReferenceImage, isEditingBlock: () => Boolean(blockEditor.current),
      liveBlockEditorDefinition, referenceImageInteraction, readHistory: readTestHistory, viewport,
    });
    const referenceImageTestImport = window.ReferenceImageTestDriver.createImport({ fetch, File, importReferenceImageFile });
    const referenceImageBlockFixture = window.ReferenceImageTestDriver.createBlockFixture({
      resetModelState, createEmptyBlockDefinition, Point, Line, DEFAULT_SKETCH_ID, openBlockDefinitionEditor, completeBlockDefinitionEdit, serializeModel,
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
    const forcedConstraintCommit = window.ConstraintTestDriver.createForcedCommit({
      resetModelState, addPoint, DistanceConstraint, solver, commitNewConstraint, currentScope: workspace.current, document,
    });
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
    window.__jot2dTest = {
      applicationThemeStateForTest: themeObservation.state,
      ...interactionProfilingTestApi,
      resetForResponsiveLineDragTest: responsiveDragFixture.reset,
      resetForSplineTest: splineTestDriver.reset,
      splineStateForTest: splineTestDriver.state,
      splineHatchPreviewCacheForTest: splineTestDriver.hatchPreviewCache,
      exerciseSplineTransferForTest: splineTransferDriver.exercise,
      exerciseSplineConstraintsForTest: splineTestDriver.exerciseConstraints,
      ...hatchTestApi,
      ...drawingOrderTestApi,
      commitConstraintWithForcedSolveResultForTest: forcedConstraintCommit.commit,
      ...clipboardTestSupport,
      ...documentTestApi.observations,
      ...derivedInstanceTestApi,
      ...sketchProjectionTestSupport,
      referenceImageStateForTest: referenceImageTestObservation.state,
      importReferenceImageDataForTest: referenceImageTestImport.importData,
      openReferenceImageBlockEditorForTest: referenceImageBlockFixture.open,
      completeReferenceImageBlockEditorForTest: referenceImageBlockFixture.complete,
      ...dimensionDisplaySupport.appearance,
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
      ...documentTestApi.fixtures,
      ...selectionTestApi,
      constraintInputStateForTest: constraintInputObservation.state,
      resolveConstraintIntentForTest: constraintIntentTestDriver.resolve,
      ...canvasTestDriver.publicAPI,
      hoverDisplayStateForTest: hoverDisplayObservation.state,
      authoringStateForTest: authoringObservation.state,
      ...dragExecutionSupport,
      ...constraintModelTestApi,
      ...annotationTestSupport.fixtures,
      ...dimensionFixtureSupport.readOnly,
      ...dimensionDisplaySupport.cases,
      angleDimensionLabelFollowCase: dimensionFixtureSupport.angleDimensionLabelFollowCase,
      resetForTrimConstraintTransfer: trimLineTransferFixture.reset,
      trimConstructionBoundaryCase: trimConstructionFixture.boundaryCase,
      trimCircleDiameterDimensionCase: trimDiameterFixture.diameterCase,
      ...annotationTestSupport.observations,
      ...annotationTestSupport.interaction,
      historyState: readTestHistory,
      resetForActiveSketchDimensionVisibility: dimensionFixtureSupport.resetForActiveSketchDimensionVisibility,
      canvasDashIsolationCases: canvasRenderingTestSupport.canvasDashIsolationCases,
      resetForSidebarInspection: sidebarInspectionFixture.reset,
      resetForRootSketchTreeHoverTest: sketchTreeTestApi.resetForRootSketchTreeHoverTest,
      resetForSketchTreeBlockHoverTest: sketchTreeTestApi.resetForSketchTreeBlockHoverTest,
      ...offsetTestSupport,
      resetForSketchDeletion: sketchDeletionFixture.reset,
      resetForSiblingVisibility: sketchTreeTestApi.resetForSiblingVisibility,
      resetForInactiveDimensionAndBlockHover: sketchTreeTestApi.resetForInactiveDimensionAndBlockHover,
      hoverIdentityStateForTest: sketchTreeTestApi.hoverIdentityStateForTest,
      geometryStrokeStyleCasesForTest: strokeStyleCases.cases,
      constructionLineHoverDisplayCasesForTest: canvasRenderingTestSupport.constructionLineHoverDisplayCasesForTest,
      constructionLineRenderingForTest: canvasRenderingTestSupport.constructionLineRenderingForTest,
      resetForSiblingSubtreeReference: sketchTreeTestApi.resetForSiblingSubtreeReference,
      siblingSubtreeVisibilityState: sketchTreeTestApi.siblingSubtreeVisibilityState,
      moveSiblingSubtreeReferenceLine: referenceLineMove.move,
      deleteSketchForTest: sketchDeletionFixture.remove,
      referenceDependencyOrderCase: dependencyOrderFixture.orderCase,
      cyclicReferenceLoadCase: cyclicReferenceFixture.loadCase,
      sketchVisibilityState: sketchTreeTestApi.sketchVisibilityState,
      ...constraintCaseTestApi,
      ...blockTestSupport.resets,
      ...dimensionInteractionSupport.placement,
      ...blockTestSupport.observations,
      drawnGeometryIdLabelsForTest: canvasRenderProbe.geometryIdLabels,
      constraintStatusEndpointMarkerCountForTest: canvasRenderProbe.constraintEndpointMarkerCount,
      drawnPointMarkerCountForTest: canvasRenderProbe.pointMarkerCount,
      arcEndpointHandleCountForTest: canvasRenderProbe.arcEndpointHandleCount,
      pointDisplayStateForTest: canvasRenderProbe.pointDisplayState,
      drawnDimensionLabelsForTest: canvasRenderProbe.dimensionLabels,
      drawnDimensionExpressionMarksForTest: canvasRenderProbe.dimensionExpressionMarks,
      ...dimensionInteractionSupport.selection,
      ...blockTestActions,
      sidebarHighlightIds: sidebarHighlightObservation.ids,
      currentSidebarHoveredGeometryKeys: sidebarHoverKeyObservation.keys,
    };
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
