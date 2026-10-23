/* Application composition, editing commands, Canvas UI and event handling. */
(function () {
  "use strict";
  const { formatDisplayNumber, formatDimensionLabel, formatMeasuredDimensionLabel } = window.NumberDisplay;
  const { serializeReferenceImage } = window.ReferenceImageData;
  const { pointInExpandedBox, lineBBox, primitiveBBox, mergeBounds, splineBBox } = window.GeometryBounds;
  const { referenceImageWorldToLocal } = window.ReferenceImageGeometry;
  const { serializeHatch } = window.HatchData;
  const { serializeAnnotation } = window.AnnotationData;

  const {
    CSS_PX_PER_MM, DEFAULT_APPEARANCE,
    DEFAULT_HATCH_APPEARANCE, DEFAULT_ANNOTATION_STYLE,
    normalizeAppearance, normalizeDimensionAppearance,
    normalizeHatchAppearance,
  } = window.Appearance;
  const {
    drawingOrderOwner,
  } = window.DrawingOrder;
  const {
    fileNameStem,
    effectiveDocumentNameFromValue,
  } = window.DocumentFiles;

  const {
    MIN_ORIENTATION_LENGTH,
    arcEndpointPoint, arcEndpointDragValue,
    circlePointAtAngle,
    arcSweep,
    unwrapAngleNear,
    lineNormal,
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
    ParallelConstraint,
    PerpendicularConstraint,
    RadiusConstraint,
    DiameterConstraint,
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
    measuredDimensionValue,
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
  const { hatchRegionErrorText, offsetChainErrorText } = window.AuthoringFeedback.create({ applicationText });
  const { ROOT_SKETCH_ID, DEFAULT_SKETCH_ID, copyWithNormalizedAppearance: normalizedSketchCopy } = window.SketchHierarchy;
  const { DEFAULT_DOCUMENT_UNITS } = window.DocumentState;
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
    evaluateDimensionExpressionDraft: evaluateNamedDimensionExpressionDraft, dimensionExpressionValue, numericDimensionExpression,
    dimensionUsesExpression, expressionInputValue, expressionFromUserInput,
    dimensionConstraintsInNamespace, ensureDimensionParameter, ensureParameterNamespace, parameterErrorText,
    validateParameterNamespace, prepareLoadedParameterNamespace,
  } = parameterNamespace;
  function evaluateDimensionExpressionDraft(constraint, expression, namespace, options) {
    return evaluateNamedDimensionExpressionDraft(constraint?.annotationOwner ? null : constraint, expression, namespace, options);
  }
  const parameterEditor = window.ParameterEditor.create({
    document, window, InputElement: HTMLInputElement, Event,
    namespace: parameterNamespace, currentScope: () => editingScopeBinding.current,
    readDefinitions: () => documentModel.blockDefinitions, readBlockEditor: () => blockEditor.current,
    applicationText, language: () => applicationSettings.language,
    formatting: { escapeHtml, formatDisplayNumber, formatParameterReference, parameterErrorText, defaultSketchId: DEFAULT_SKETCH_ID },
    localizeApplicationUI, applyDraft: (...args) => parameterApplication.apply(...args),
    recordHistory, setHint, updateUI, draw, pickDimension: event => expressionInputController.pickCanvas(event),
  });
  const { draft: parameterDraft, setParameterDialogError, insertIdentifierIntoExpressionInput,
    syncExpressionInputHighlight, installExpressionInputHighlights } = parameterEditor;
  const {
    ensureSketchState, isRootSketch, isDrawableSketch,
    firstDrawableSketchId, sketchName, sketchById,
    orderedSketches, childSketchesOf, descendantSketchIds,
    isReferenceSourceSketchId,
    activeSketch, activeSketchId, assignSketchId,
    elementSketchId, membershipQuery: readSketchMembership, sameSketchElements, isEditableSketchId, canEditSketch,
    sketchRelationToActive, operandRelationForSketch, constraintSketchId, isActiveSketchConstraint,
    constraintTargetsAreActive, isActiveSketchElement, isEditableSketchElement,
    sketchRelationOfElement,
  } = sketchContext;
  const constraintMetadata = window.ConstraintPersistence.createMetadata({
    serializeConstraint, numericDimensionExpression, constraintSketchId,
  });
  const sketchEditAccess = window.SketchCommand.createEditAccess({
    activeSketchId, canEditSketch, sketchById, selectionItems, elementSketchId, isGeometryMode,
    setHint, applicationText, clearSnap: () => clearSnap(), clearPointerPreview: () => drawingPreview.setPointer(null), draw,
  });

  const { geometryKindForItem, geometryRefForItem, geometryIdForItem: constraintGeometryId, geometryKeyForItem: geometryElementKey } = window.GeometryObjects;
  const { services: geometryReadServices, createScopeBinding } = createReadContext({
    currentSketches: () => editingScopeBinding.current.sketches, prepareBlocks: ensureBlockState,
    showHiddenElements: () => viewState.showHiddenElements, viewportScale: () => viewport.scale,
    profileRead: read => interactionProfiler.active ? profileInteractionWork("geometryReads", read) : read(),
  });
  const { instances: instanceProjections, catalog: blockCatalog, projections: blockProjections, reads: geometryReads,
    geometryAppearance, dimensionAppearance, annotationAppearance, hatches: hatchGeometryQuery } = geometryReadServices;
  const { hatchPrimitivesForScope, resolvedHatchBoundary, hatchBoundaryGeometryItems, hatchContainsSelectablePoint } = hatchGeometryQuery;
  const { geometryInstanceSourcePoints, createGeometryInstanceBundle, geometryInstanceBundlesForScope } = instanceProjections;
  const { blockDefinitionById, blockDefinitionDrawableSketchIds, blockDefinitionGeometrySketchIds, blockInstanceEnabledSketchSet } = blockCatalog;
  const { blockProjectionLocalId, blockWorldPoint, createBlockProjectionBundle, blockAllProjectionBundle, blockProjectionBundle, invalidateBlockProjectionCache } = blockProjections;
  const { scopeGeometryItem: sidebarGeometryItem, withGeometryReadCache, blockProjectionBundles, geometryInstanceBundles, geometryInstanceBundle, allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines, allAnnotations, allHatches, resolveGeometryRef } = geometryReads;
  function annotationBounds(...args) { return annotationFeature.spatial.annotationBounds(...args); }
  const { blockLocalGeometryBounds, blockInstanceDisplayCenter, blockInstanceTranslationForAnchor } = window.BlockLayout.create({
    catalog: blockCatalog, projections: blockProjections, instanceProjections, annotationBounds, hatchPrimitivesForScope,
  });
  let sketchMoveCommand = null;
  let sketchContextController = null;
  const editingScopeBinding = createScopeBinding({
    Solver: ConstraintSolver,
    closeSketchContext: () => sketchContextController?.close(), resetSketchMove: () => sketchMoveCommand?.reset(),
  });
  const { solver } = editingScopeBinding;
  function activateEditingScope(...args) { return editingScopeBinding.activate(...args); }

  const { assignSketch: assignConstraintSketchId, push: pushModelConstraint } = window.ConstraintCommitCommand.createInsertion({
    currentScope: () => editingScopeBinding.current, currentParameterNamespace,
    activeSketchId, isDrawableSketch, firstDrawableSketchId, ensureDimensionParameter,
  });
  const fileSession = window.DocumentFiles.create();

  const drawOperationLifecycle = window.DrawOperationLifecycle.createSession();
  const selectionFeature = window.CanvasSelectionFeature.create({
    sketches: sketchContext, guardSketchEdit, clearSelection, updateGeometrySelectionUI, draw,
  });
  const { selection: canvasSelection, scope: selectionScopeQuery, identity: identitySelection } = selectionFeature;
  const {
    selectedElementCount, selectedGeometryItems, appearanceSelectionTarget, effectiveSelectedConstraint, selectedPrimitives,
    toggleBlockInstanceSelection, selectedConstructionTogglePrimitives,
    trimConstraintSelection, sketchTreeObjectSelected,
    hasSelection,
  } = canvasSelection;
  const pointUsage = geometryReadServices.createPointUsage({
    constraintReferencesPoint, editedFitPoints: () => splineEditing.current?.spline?.fitPoints,
  });
  const { isPointUsedByLine, isAnyLineEndpoint, isPointUsedByCircle, isPointUsedByArc, isPointUsedByPrimitive, isEndpointPoint, isExplicitPoint, isReferencePoint, isSelectableEndpointPoint } = pointUsage;
  const canvasHover = window.CanvasHover.create({ isEndpointPoint });
  const { clear: clearCanvasHover, capture: captureCanvasHoverState, restore: restoreCanvasHoverState } = canvasHover;
  presentation.bindUI({
    syncAnnotationResize: () => annotationDrag.syncResizeSelection(drawOperationLifecycle.mode === "select" && !pendingCommandSession.current && !constraintTargetSession.command),
    prepareParameterNamespace: () => ensureParameterNamespace(currentParameterNamespace()),
    refreshConstraintAnalysis, updateDocumentName: () => updateDocumentNameUI(), updateToolbar,
    renderSketch: () => sketchTreeView.render(), updateBlockUI,
    renderProperties: () => propertiesView.render(selectedPropertiesTarget()), readSketchMoving: () => sketchMoveCommand.active,
    updateStatusUI, updateConstraintButtons, syncDimensionInput: () => syncDimensionValueInput(),
    refreshSketchSelection: () => sketchTreeView.refreshSelection(),
  });
  const { controller: canvasContextController, element: canvasContextMenu } = window.CanvasContextMenu.createForDocument({
    document, window, canvas, escapeHtml, applicationText,
    presentCandidate: target => canvasContextCandidatePresentation(target),
    hover: { capture: captureCanvasHoverState, restore: restoreCanvasHoverState, preview: previewCanvasContextCandidate, clear: clearCanvasHover, draw },
    onOpen: openCanvasContextMenu, onSelect: selectCanvasContextCandidate, onAction: executeCanvasContextAction,
  });
  const closeCanvasContextMenu = canvasContextController.close;
  const { resolve: resolveDerivedDragSource, sourceObjects: geometryInstanceSourceObjects } = window.InstanceProjection.createDragSourceQuery({
    geometryInstanceSourcePoints, geometryInstanceDependencyRefs, resolveGeometryRef,
  });
  const instanceSourceSelection = window.InstanceProjection.createSourceSelection({
    currentScope: () => editingScopeBinding.current, selectedGeometryItems, canvasSelection, blockProjectionBundle, geometryInstanceBundle, elementSketchId, activeSketchId, geometryRefForItem,
  });
  const dimensionLabels = window.DimensionPresentation.createLabel({
    isReadOnlyDimension, measuredDimensionValue, angleDegrees, dimensionDisplayState, constraintSketchId,
    formatDimensionLabel, formatMeasuredDimensionLabel,
  });
  const { hitAnnotationTarget, annotationLeaderTargetFromHit, annotationLeaderTargetFromItem, annotationLeaderAnchor } = window.AnnotationAnchorQuery.create({
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
  const { sketchProjectionConstraints, sketchProjectionConstraintForTarget, isSketchProjectedGeometry, sketchProjectionConstraintsAffectingItems } = sketchProjectionQueries;
  const blankCanvasGesture = window.BlankCanvasGesture.create({
    getMode: drawOperationLifecycle.readMode, getPending: () => pendingCommandSession.current, getPendingConstraint: () => constraintTargetSession.command,
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
  const sketchProjectionFeature = window.SketchProjectionFeature.create({
    currentScope: () => editingScopeBinding.current, queries: sketchProjectionQueries, activeSketchId, geometryRefForItem, geometryRefsEqual,
    constraintIsOperational, constraintSketchId, geometryElementKey, geometryKindForItem, elementSketchId,
    isReferenceSourceSketchId, isVisibleSketchElement, operandElement: operand => operandElement(operand), guardSketchEdit,
    readProjectionRectangle: (...args) => rectangleSelectionQuery.readProjection(...args),
    geometry: { points: allGeometryPoints, lines: allGeometryLines, circles: allGeometryCircles,
      arcs: allGeometryArcs, splines: allGeometrySplines, hatches: allHatches },
    selectedGeometryItems, cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation,
    clearSelection, getMode: drawOperationLifecycle.readMode, setMode: drawOperationLifecycle.setMode, clearSnap: () => clearSnap(),
    updateToolbar, setHint, applicationText, updateUI, draw, normalizeGeometryInstance,
    nextId: () => documentIds.allocate("sketchProjection"), canvasSelection, refreshConstraintAnalysis, recordHistory,
    clearHover: () => canvasHover.update({ point: null, line: null, circle: null, arc: null, spline: null, sketchIdentity: null }),
  });
  const { command: sketchProjectionCommand, sources: sketchProjectionSources,
    guardSketchProjectionShapeEdit, sketchProjectionShapeEditBlockedMessage } = sketchProjectionFeature;
  const { sketchProjectionSourceKey, sketchProjectionSourceIsCovered, sketchProjectionEntryFromItem,
    sketchProjectionEntryFromOperand } = sketchProjectionSources;
  const { start: startSketchProjectionCommand, toggle: toggleSketchProjectionSource,
    commit: commitSketchProjectionCommand } = sketchProjectionCommand;
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
  const pointerInteractionController = window.PointerInteractionController.createSession();
  const constructionCommand = window.ConstructionCommand.create({
    cancelConstraintTargetCommand, selectedConstructionTogglePrimitives, guardSketchProjectionShapeEdit, applicationText,
    synchronizeSketchProjectionMetadata: () => synchronizeSketchProjectionMetadata(), setHint, clearSelection, updateUI, draw, recordHistory,
    setLineMode: () => { drawOperationLifecycle.setMode("line"); }, resetLineInputs: () => drawOperationLifecycle.resetInputs("line"),
    clearSnap: () => clearSnap(), updateToolbar,
  });
  const { highlight: selectionHighlight, clearing: selectionClearing, documentReset: documentCanvasReset } = selectionFeature.createPresentation({
    hover: canvasHover, constraintTargets: constraintTargetSession, pointer: pointerInteractionController,
    projections: blockProjections, constraintReferences, clearSnap: () => clearSnap(),
  });
  const { constraintDefiningGeometryEntries, constraintHighlightNodes, sameConstraintDisplayElement, isSidebarHoveredElement, isSelectedConstraintRelatedElement, selectedConstraintReferenceElements, constraintDirectlyReferencesCanvasSelection, sidebarHoverElementsForItem, sidebarHoverElementsForConstraint, setSidebarHover, clearSidebarHover } = selectionHighlight;
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
    instances: instanceProjections, rebinding: constraintRebinding, normalizedSketchCopy, normalizeGeometryInstance,
    isDimensionConstraint, isReadOnlyDimension, numericDimensionExpression, ensureParameterNamespace,
    activeSketchId, blockProjectionBundles, geometryElementKey, readViewport: () => viewport,
    activateScope: activateEditingScope, reserveScopeSequences: reserveBlockEditorSequences, createHistory: createBlockEditHistory,
    rebuildStoredBlockDefinitionConstraints, rebuildBlockDefinitionConstraintObjects,
  });
  const { editing: blockDefinitionEditing, session: blockEditor, queries: blockEditingQueries } = blockEditingFeature;
  const { clone: cloneBlockDefinition, fromSelection: createBlockDefinitionFromSelection, empty: createEmptyBlockDefinition } = blockDefinitionEditing;
  const { live: liveBlockEditorDefinition, chain: blockEditorSessionChain,
    scopeId: currentBlockDefinitionScopeId } = blockEditor;
  const { blockDefinitionsInCurrentScope, blockDefinitionScopeError,
    blockDefinitionUsageCount, blockDefinitionEditError } = blockEditingQueries;

  const canvasRenderProbe = window.CanvasRenderProbe.create({
    ctx, allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs,
    drawLines, drawCircles, drawArcs, drawPoints, drawArcEndpointHandles, drawDimensions,
  });
  const HISTORY_LIMIT = 80;
  let commandPanel = null;
  let derivedPanel = null;
  presentation.bindCanvas({
    readPngCommand: () => pngExportCommand, readPending: () => pendingCommandSession.current, readMode: drawOperationLifecycle.readMode,
    readCommandPanel: () => commandPanel, syncAnnotationInput: () => annotationInputController.sync(), readDerivedPanel: () => derivedPanel,
    withGeometryReadCache, drawCanvas,
  });
  const geometryInstanceCommand = window.GeometryInstanceCommand.create({
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
  const instanceSourceCommand = window.InstanceSourceCommand.create({
    currentScope: workspace.current, activeSketchId, placementCommand: geometryInstanceCommand, guardSketchEdit, exitDrawMode, cancelConstraintTargetCommand, cancelPendingCommand,
    clearSelection, canvasSelection, getMode: drawOperationLifecycle.readMode, setMode: drawOperationLifecycle.setMode, updateToolbar, updateUI, updatePropertiesUI,
    applicationText, setHint, draw, geometryRefForItem, isVisibleSketchElement, geometryRefsEqual,
    sketchProjectionEntryFromItem, sketchProjectionSourceIsCovered, elementSketchId,
    geometryInstanceBundlesForScope, blockProjectionBundles, geometryElementKey, geometryInstanceBundle,
    constraintGraphNodes, guardDimensionSymbolDeletion, annotationReferencesRemovedGeometry,
    clearSketchSolveState, recordHistory,
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
  const { documentHistory, controller: historyController } = historyFeature;
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
  const canvasViewControls = window.CanvasViewControls.create({ document, window, setHint, draw });
  const { state: viewState, constraintStatus: constraintStatusView } = canvasViewControls;
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
  const { connectedComponentFromSeeds, localSolveLines, sketchSolveVariables, sketchSolveConstraints, sketchSolveLines, localSolveContextFromSeeds } = solveScopeQuery;
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
  const { clampZoom, canvasScreenPoint, screenToWorld, worldToCanvasScreen, canvasPoint, fitBoundsToViewport, visibleWorldBounds } = viewport;
  const transientAuthoring = window.TransientAuthoring.create({
    currentScope: workspace.current, ids: geometryIds, selection: canvasSelection, historySnapshot, documentHistory,
    isHistoryRestoring: () => historyController.restoring, updateHistoryButtons,
    invalidateAnalysis: () => { constraintAnalysis.invalidate(); },
  });
  const { rollbackTransientLineCompletion, rollbackTransientPoint } = transientAuthoring;
  const { surface: canvasSurface, exportRenderer: pngRendering, layout: canvasWorkspaceLayout, createRendering: createCanvasRendering } = createCanvasWorkspace({
    ctx, readPixelRatio: () => window.devicePixelRatio || 1, ResizeObserverClass: window.ResizeObserver, withGeometryReadCache, drawCanvas,
    isValueInputPending: () => pendingCommandSession.current && ["distance-value", "offset-value"].includes(pendingCommandSession.current.type),
    window, updatePropertiesUI, closeContextMenu: closeCanvasContextMenu, applySketchTreeWidth: () => applySketchTreeWidth(),
    applicationText, readLanguage: () => applicationSettings.language,
  });
  const { resetCanvasStrokeState, withCanvasState } = canvasSurface;
  const { DIMENSION_SCREEN_PX_PER_MM, DIMENSION_TERMINATOR_FIT_MARGIN_FACTOR } = window.DimensionMetrics;
  const dimensionDisplay = window.DimensionDisplay.create({ ctx, viewport, currentLines: () => workspace.current().lines,
    minLineLength: MIN_LINE_LENGTH, canvasThemeColor, onExpressionMark: canvasRenderProbe.captureExpressionMark,
    effectiveDimensionAppearance, activeSketchId });
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
  const geometryDisplay = window.GeometryDisplay.create({
    Point, ctx, viewport, surface: canvasSurface,
    pointUsage, commandTargets: commandTargetPresentation, sketchStyle: sketchPresentation, canvasSelection, canvasHover, viewState,
    isExporting: () => Boolean(pngRendering.frame),
    effectiveAppearanceForElement, isEditableSketchElement,
    isSidebarHighlightedElement, isSidebarHoveredElement, isSelectedConstraintRelatedElement,
    canvasThemeColor, constructionAlpha: CONSTRUCTION_GEOMETRY_ALPHA, constructionExtensionScreenPx: CONSTRUCTION_EXTENSION_SCREEN_PX,
    fixedPointLabel: () => applicationText("固定", "Fixed"), geometryReads, isVisibleSketchElement,
    handleQueries: { sameArcEndpoint, arcEndpointPoint, findArcEndpointFixedConstraint,
      isDraggingArcEndpoint: (arc, endpoint) => geometryDrag.isArcEndpoint(arc, endpoint),
      editedSpline: () => splineEditing.current?.spline, currentScope: workspace.current },
    pointQueries: { pointLockedByLineFixed, sidebarHoveredItem: () => selectionHighlight.current?.item,
      isDraggingPoint: point => geometryDrag.isPoint(point), isDraggingCenter: point => geometryDrag.isCenter(point) },
  });
  const { geometryDisplayColor, geometryStrokeWidth, traceSplinePath } = geometryDisplay;
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
  const { annotationLeaderDisplayGeometry, annotationTextLayout, annotationTextWorldHeight, annotationTextMetrics, drawAnnotationText, drawAnnotationLeader } = annotationFeature.renderer;
  function annotationPlacementAnchor(...args) { return annotationFeature.placementAnchor(...args); }
  const { pushAnnotation } = annotationCommand;
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
  const { start: beginSplineCreation, removeLast: removeLastSplineInputPoint, finalize: finalizeSplineCreation, click: handleSplineClick, doubleClick: finalizeSplineFromDoubleClick } = splineCommand;
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
  const { update: updateFilletRadiusPlacement, submit: submitFilletRadiusPlacement, click: handleFilletClick } = filletCommand;
  const { loading: documentLoading, geometryInstances: geometryInstancePersistence } = window.DocumentLoading.createWithCodecs({
    createBlockProjectionBundle, geometryInstanceBundlesForScope, elementSketchId, deserializeConstraint, constraintSketchId,
    separateSharedSketchProjectionTargetPoints, prepareLoadedParameterNamespace,
    isPointUsedByLine, isPointUsedByCircle, isPointUsedByArc, constraintReferencesPoint,
    defaultUnits: DEFAULT_DOCUMENT_UNITS, applicationText, invalidateProjection: invalidateBlockProjectionCache, normalizeArcSweeps,
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
    rebind: () => constraintRebinding.rebuildDocument(editingScopeBinding.current, [...blockProjectionBundles(), ...geometryInstanceBundles()]),
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
  const dimensionValueCommand = window.DimensionValueCommand.createWithEditingSupport({
    synchronizedInstanceEditing, annotationDimensions, annotationAnchorConstraints, canvasSelection, resetDimensionDrag: () => dimensionDrag.reset(),
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
    addDistanceConstraintFromTarget,
    restoreSketchScreenFootprint: (sketchId, footprint) => viewport.restoreBoundsFootprint(sketchGeometryBounds(sketchId), footprint),
  });
  const { submit: submitDistanceValue, commitProperty: commitDimensionPropertyEdit } = dimensionValueCommand;
  const blockParameterPropagation = window.BlockParameterPropagation.create({
    catalog: blockCatalog, invalidateProjection: invalidateBlockProjectionCache, applicationText,
    definitions: { rebuild: rebuildBlockDefinitionConstraintObjects, stabilize: storedDefinitionStabilization.stabilize },
    document: { rebuild: rebuildRootConstraintObjects, stabilize: () =>
      stabilizeActiveParameterNamespace(activeSketchId(), { allSketches: editingScopeBinding.current.sketches.filter(sketch => !isRootSketch(sketch)).map(sketch => sketch.id) }) },
  });
  const parameterApplication = window.ParameterApplication.create({
    namespace: parameterNamespace, currentScope: workspace.current, acceptError: CONSTRAINT_ACCEPT_ERROR, applicationText,
    capture: () => ({ document: blockEditor.current ? null : historySnapshot(), local: blockEditor.current ? snapshotModelState() : null }),
    restore: checkpoint => {
      if (blockEditor.current && checkpoint.local) restoreModelState(checkpoint.local);
      else if (checkpoint.document) loadModelData(JSON.parse(checkpoint.document), { documentNameFallback: documentModel.documentName });
    },
    stabilize: namespace => namespace === editingScopeBinding.current
      ? stabilizeActiveParameterNamespace(activeSketchId(), { allSketches: editingScopeBinding.current.sketches.filter(sketch => !isRootSketch(sketch)).map(sketch => sketch.id) })
      : storedDefinitionStabilization.stabilize(namespace),
    propagate: blockParameterPropagation.propagate,
  });
  const centerlineCommand = authoringTools.createCenterline({
    commitNewConstraint,
    parallelTolerance: CENTERLINE_PARALLEL_TOLERANCE,
    invalidateAnalysis: () => { constraintAnalysis.invalidate(); },
  });
  const { start: startCenterlineCommand, click: handleCenterlineClick, projectPointToCenterlineSupport } = centerlineCommand;
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

  for (const btn of document.querySelectorAll("button[aria-label]")) {
    btn.dataset.tooltip = btn.getAttribute("aria-label");
  }

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

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  }

  function hatchPatternTypeLabel(patternType) {
    if (patternType === "cross") return applicationText("クロス", "Cross");
    if (patternType === "solid") return applicationText("塗りつぶし", "Solid fill");
    return applicationText("平行線", "Parallel");
  }


  function effectiveDimensionAppearance(...args) { return dimensionAppearance.effectiveDimensionAppearance(...args); }

  function ensureAppearanceState() {
    return documentPreparation.appearance();
  }

  const documentPreparation = window.DocumentApplication.createPreparation({
    document: documentModel, currentScope: () => editingScopeBinding.current, readBlockEditor: () => blockEditor.current,
    sketchContext, parameterNamespace, blockCatalog,
  });
  function ensureBlockState() {
    return documentPreparation.blocks();
  }


  const { controller: annotationInputController, commitParameterEdit: commitAnnotationParameterEdit } = annotationFeature.createEditor({
    document, host: canvas.parentElement, capture: snapshotModelState, restore: restoreModelState, guardDimensionSymbolDeletion,
    readParameterNamespace: currentParameterNamespace, expressionFromUserInput,
    stabilize: () => stabilizeActiveParameterNamespace(activeSketchId(), { allSketches: editingScopeBinding.current.sketches.filter(sketch => !isRootSketch(sketch)).map(sketch => sketch.id) }),
    resetDrag: () => annotationDrag.reset(), toScreen: worldToCanvasScreen, expressionInputValue,
  });

  function isGeometryMode() {
    return true;
  }


  function snappedBlockRotation(rotation) {
    const quarterTurns = Math.round((Number(rotation) || 0) / BLOCK_ORTHOGONAL_ROTATION_STEP);
    return ((quarterTurns % 4) + 4) % 4 * BLOCK_ORTHOGONAL_ROTATION_STEP;
  }



  function blockInstanceById(id) {
    return editingScopeBinding.current.blockInstances.find((instance) => instance.id === id) || null;
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

  function hitReferenceImageAt(...args) { return regionHitQuery.hitReferenceImageAt(...args); }

  const { beginDrag: beginReferenceImageDrag, startCalibration: startReferenceImageCalibration, calibrationClick: handleReferenceImageCalibrationClick } = referenceImageInteraction;

  function decorateSerializedConstraint(data, constraint) { return constraintMetadata.decorate(data, constraint); }

  function effectiveAppearanceForElement(...args) { return geometryAppearance.effectiveAppearanceForElement(...args); }


  function selectionItems(...args) { return selectionScopeQuery.selectionItems(...args); }


  function selectionSketchId(...args) { return selectionScopeQuery.selectionSketchId(...args); }

  function guardSketchEdit(...args) { return sketchEditAccess.guardSketchEdit(...args); }

  function guardSelectionEdit(...args) { return sketchEditAccess.guardSelectionEdit(...args); }

  const sceneHitInteraction = window.CanvasHitInteraction.createScene({
    currentScope: workspace.current, dimensionScope: dimensionPresentationScope, viewport, pointUsage, sketchContext, geometryAppearance,
    geometryReads, catalog: blockCatalog, projections: blockProjections, hatches: hatchGeometryQuery, dimensions: dimensionDisplay,
    effectiveDimensionAppearance, dimensionLabelForConstraint, dimensionUsesExpression, annotationBounds, hitAnnotationElement,
    hatchAppearanceForDisplay, targetFromConstraint, drawingOrderOwner, referenceImageWorldToLocal, pointInExpandedBox,
    readMode: drawOperationLifecycle.readMode, readPendingCommand: () => pendingCommandSession.current, readConstraintCommand: () => constraintTargetSession.command,
    operandValues: constraintOperandValues,
  });
  const { ordinarySelectionMode } = sceneHitInteraction.policy;

  function canCreateInActiveSketch(...args) { return sketchEditAccess.canCreateInActiveSketch(...args); }

  function rejectRootSketchCreation(...args) { return sketchEditAccess.rejectRootSketchCreation(...args); }

  function isVisibleValue(...args) { return geometryAppearance.isVisibleValue(...args); }
  function isVisibleSketchId(...args) { return geometryAppearance.isVisibleSketchId(...args); }
  function isVisibleSketchElement(...args) { return geometryAppearance.isVisibleSketchElement(...args); }



  function isConstraintOperandSelected(...args) { return commandTargetPresentation.isConstraintOperandSelected(...args); }

  function syncSelectionFromConstraintOperands() { canvasSelection.applyConstraintTargets(constraintTargetsFromOperands(constraintTargetSession.operands)); }

  function constraintOperandsFromSelection() { return constraintOperandValues.fromSelection(canvasSelection, pointerInteractionController.lastWorld); }

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

  function refreshConstraintAnalysis(options = {}) { return constraintAnalysis.refresh(options); }

  function constraintStatusColor(...args) { return sketchPresentation.constraintStatusColor(...args); }

  function sketchStrokeWidth(...args) { return sketchPresentation.sketchStrokeWidth(...args); }

  function canvasThemeColor(value) {
    return window.CanvasThemeColors.color(value, applicationSettings.theme);
  }


  function sketchAlpha(...args) { return sketchPresentation.sketchAlpha(...args); }

  function selectedItemsForGeometryInstance() { return instanceSourceSelection.read(); }









  const circleCenterCrossCommand = window.CircleCenterCrossCommand.create({
    geometry: { addPoint, addLine, pushModelConstraint },
    checkpoint: { capture: snapshotGeometryMutationState, restore: restoreGeometryMutationState },
    solveSketchAndDependents, resultIsAccepted, minOrientationLength: MIN_ORIENTATION_LENGTH,
    activeSketchId, isActiveSketchElement, selection: canvasSelection, selectedElementCount,
    cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation,
    setMode: drawOperationLifecycle.setMode, clearPreview: () => drawingPreview.setPointer(null),
    clearSnap, clearSelection, invalidateAnalysis: () => constraintAnalysis.invalidate(),
    updateUI, draw, setHint, recordHistory, applicationText,
  });
  const { start: startCircleCenterCrossCommand, click: handleCircleCenterCrossClick } = circleCenterCrossCommand;

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
  const { begin: beginSplineEditFromDoubleClick, finish: finishSplineEditSession,
    addPoint: addSplineFitPointFromContext, deletePoint: deleteSplineFitPointFromContext } = splineEditing;

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

  function reserveBlockEditorSequences(draft) { return idReservation.scope(draft); }

  const choiceDialog = window.ChoiceDialog.create(document.getElementById("choiceDialog"));
  const { definition: blockDefinitionCommand, completion: blockCompletionCommand } = blockEditingFeature.createCommands({
    canStartCreation: () => isGeometryMode() && canCreateInActiveSketch() && guardSelectionEdit("structure"),
    canvasSelection, selectionQuery: blockSelectionQuery, guardDimensionSymbolDeletion, resetBlockEditorHistory, clearSelection,
    setMode: drawOperationLifecycle.setMode, closeDefinitions: () => blockView.closeDefinitions(),
    setEditorActive: active => blockView.setEditorActive(active), fitAllGeometryToViewport,
    resetEmptyViewport: () => {
      const rect = canvas.getBoundingClientRect();
      viewport.update({ scale: CSS_PX_PER_MM });
      viewport.update({ x: rect.width / 2 });
      viewport.update({ y: rect.height / 2 });
    },
    promptName: name => window.prompt("ブロック名", name), updateBlockUI, updateUI, draw, recordHistory, setHint,
    refreshReferenceConstraintValidity,
    hasInvalidReferenceConstraints: () => referenceConstraintState.errorCount > 0,
    solveSketchById, resultIsAccepted, sketchName, solveReferenceDependentSketches,
    requestChoice: options => choiceDialog.show(options), applicationText, blockLocalGeometryBounds,
    constraintGraphNodes, annotationReferencesRemovedGeometry, acceptError: CONSTRAINT_ACCEPT_ERROR, setSketchSolveOk, setSketchSolveError, log,
  });
  const { startCreation: startBlockCreation, open: openBlockDefinitionEditor, enter: enterBlockDefinitionEdit,
    cancel: cancelBlockDefinitionEdit, rename: renameBlockDefinition, remove: deleteBlockDefinition } = blockDefinitionCommand;
  const { complete: completeBlockDefinitionEdit } = blockCompletionCommand;

  function syncOffsetChainSelection() { return canvasSelection.applyOffsetSelection(offsetSelection); }

  function resetModelState() { return documentEditingReset.reset(); }


  function reserveGeometryElementSequences(source) { return idReservation.geometry(source); }

  const { dimensions: { serialize: serializeDimension }, codecs: constraintCodecs } = window.ConstraintPersistence.createWithDimensions({
    geometryId: constraintGeometryId, placement: dimensionPlacement,
  });

  function serializeConstraint(c) {
    return constraintCodecs.serialize(c);
  }

  const documentWriter = window.DocumentSnapshot.createWriter({
    workspace, prepare: documentPreparation.prepare, version: CURRENT_JSON_VERSION,
    documentName: effectiveDocumentName, nextHatchIndex: () => documentIds.peek("hatch"),
    geometryMetadata: geometryReadServices.createSnapshotMetadata({ pointUsage }),
    constraintData: constraintMetadata.snapshotData,
  });

  function serializeModel() { return documentWriter.serialize(); }

  function historySnapshot() { return historyFeature.captureDocument(); }

  function resetBlockEditorHistory() {
    return historyController.resetBlock();
  }

  function createBlockEditHistory() { return historyFeature.createBlockHistory(); }

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

  function recordHistory(label = "変更") { return historyFeature.record(label); }

  function undoHistory() {
    return historyController.undo();
  }

  function redoHistory() {
    return historyController.redo();
  }

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

  referenceImageInput.bindClipboard();
  const { importFile: importReferenceImageFile, clipboard: imageClipboard } = referenceImageInput;



  function clearSelection() { return selectionClearing.clear(); }

  authoringTools.createLifecycle({ lifecycle: drawOperationLifecycle,
    canStart: nextMode => nextMode === "select" || guardSketchEdit(activeSketchId(), "create") && (nextMode !== "trim" || guardSelectionEdit("structure")),
    instances: geometryInstanceCommand, instanceSources: instanceSourceCommand, centerline: centerlineCommand,
    fillet: filletCommand, offset: offsetSelection, hatch: { reset: () => hatchCommand.reset() },
    clearTrimHover: () => canvasHover.update({ point: null, endpointPoint: null, line: null, circle: null, arcEndpoint: null, arc: null, dimension: null }),
  });
  function exitDrawMode() { return drawOperationLifecycle.exit(); }
  function hasActiveDrawOperation() { return drawOperationLifecycle.active(); }
  function cancelActiveDrawOperation() { return drawOperationLifecycle.cancel(); }



  function resizeCanvas(...args) { return canvasWorkspaceLayout.resizeCanvas(...args); }
  function setPropertiesPanelCollapsed(...args) { return canvasWorkspaceLayout.setPropertiesPanelCollapsed(...args); }






























  const sceneHitQueries = sceneHitInteraction.createQueries();
  const { regions: regionHitQuery, dimensions: dimensionHitQuery, instances: instanceHitQuery } = sceneHitQueries;
  const { hitSketchIdentityElement, hitEndpointPoint, hitExplicitPoint, hitPoint, hitLine, hitCircle, hitArc, hitArcEndpoint, hitSpline } = sceneHitQueries.geometry;

  function fitSketchToViewport(sketchId = activeSketchId(), paddingPx = 96) {
    return fitBoundsToViewport(sketchGeometryBounds(sketchId), paddingPx);
  }

  function fitAllGeometryToViewport(paddingPx = 96) {
    return fitBoundsToViewport(allGeometryBounds(), paddingPx);
  }

  function fitVisibleGeometryToViewport(paddingPx = 96) {
    return fitBoundsToViewport(visibleGeometryBounds(), paddingPx);
  }












  function samePosition(a, b, tolerance = 1e-9) {
    return Boolean(a && b && hypot2(a.x - b.x, a.y - b.y) <= tolerance);
  }

  function addConstraintIfMissing(...args) { return constraintCommitCommand.ifMissing(...args); }

  function hitDimension(...args) { return dimensionHitQuery.hitDimension(...args); }


  function distanceTargetFromSelection() { return constraintSelectionQuery.distanceTarget(); }

  function hitBlockInstance(...args) { return instanceHitQuery.hitBlockInstance(...args); }
  function hitBlockRotationHandle(x, y) { return null; }





















  const { hitConstraintOperand: queryConstraintOperand } = sceneHitQueries.operands;

  function measuredConstraintTargetValue(constraint, target = targetFromConstraint(constraint), dimension = constraint?.dimension) {
    if (!target) return NaN;
    const measured = measuredDimensionValue(target, dimension);
    return target.kind === "angle" ? (measured * Math.PI) / 180 : measured;
  }

  function dimensionLabelForConstraint(...args) { return dimensionLabels.label(...args); }

  function solveSketchById(...args) { return sketchSolving.solveSketchById(...args); }


  function solveReferenceDependentSketches(...args) { return sketchSolving.solveReferenceDependentSketches(...args); }
  function solveSketchAndDependents(...args) { return sketchSolving.solveSketchAndDependents(...args); }
  function solveConstraintComponentAndDependents(...args) { return sketchSolving.solveConstraintComponentAndDependents(...args); }

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

  function hatchAppearanceForDisplay(hatch) {
    return normalizeHatchAppearance(hatch?.appearance);
  }

  function hatchPatternOrigin(hatch) {
    return hatch?.patternOrigin || { x: 0, y: 0 };
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


  function effectiveAnnotationStyle(element) { return annotationAppearance.effectiveAnnotationStyle(element); }






  const annotationDrag = annotationFeature.createDrag({
    beginConstrainedDrag: constrainedAnnotationDrag.begin,
    resizeText: (item, height) => appearanceEditing.applyAnnotationStyleValue(item, "textHeight", height),
    beginPointer: (id) => { canvas.setPointerCapture(id); canvas.classList.add("is-dragging"); },
    endPointer: (id) => { canvas.classList.remove("is-dragging"); try { canvas.releasePointerCapture(id); } catch (_) {} },
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

  const toolbarView = window.ToolbarView.create({
    document, isGeometryMode, constructionToggleState,
    readInteraction: () => ({ mode: drawOperationLifecycle.mode, hasPending: Boolean(pendingCommandSession.current), hasConstraint: Boolean(constraintTargetSession.command),
      annotationDraft: Boolean(pendingCommandSession.current?.annotationDraft), pendingType: pendingCommandSession.current?.type,
      constraintType: constraintTargetSession.command?.type, splineEditing: Boolean(splineEditing.current) }),
    updateHistoryButtons, selectedVisibilityTargets, selectionVisibilityIsHidden,
    canEditTarget: target => canEditSketch(target.kind === "constraint" ? constraintSketchId(target.item) : elementSketchId(target.item)),
    syncFlyouts: () => toolFlyouts?.sync(), updateCursor: commandCursor.update,
  });
  function updateToolbar() { toolbarView.update(); }
  const commandStatusView = window.ToolbarView.createCommandStatus({
    document, applicationText, readMode: drawOperationLifecycle.readMode, readPendingType: () => pendingCommandSession.current?.type,
    readConstraintCommand: () => constraintTargetSession.command,
  });

  function constructionToggleState(geometryMode = isGeometryMode()) { return constructionCommand.state(geometryMode); }

  const { label: constraintLabel, targetHint: constraintTargetHint, invalidTargetHint: invalidConstraintTargetHint } = window.ConstraintControlsView.createFeedback({
    constraintButtons, applicationText, feedback: constraintFeedback,
    readOperands: () => constraintTargetSession.operands, readLanguage: () => applicationSettings.language,
  });
  const { selectionQuery: constraintSelectionQuery, targets: constraintTargetCommand, dimensions: dimensionPlacementCommand } = window.ConstraintEditing.create({
    session: constraintTargetSession, selection: canvasSelection, pending: pendingCommandSession, candidates: constraintCandidates,
    lifecycle: drawOperationLifecycle, valueInput: dimensionInputController,
    resolveConstraintIntent, constraintOperandsFromSelection, activeSketchId, isGeometryMode,
    elementSketchId, canEditSketch, findLineFixedConstraint, selectedGeometryItems, guardSketchEdit, guardSelectionEdit, startAnnotationAnchorConstraint,
    constraintLabel, clearSelection, trimConstraintSelection, commitConstraintResolution, syncSelectionFromConstraintOperands,
    updateToolbar, updateConstraintButtons, setHint, constraintTargetHint, draw,
    blurConstraintControl: () => { if (document.activeElement instanceof HTMLElement && document.activeElement.matches("[data-constraint], #fixPointBtn")) document.activeElement.blur(); },
    addConstraint, annotationAnchorConstraints, hitConstraintOperand, invalidConstraintTargetHint,
    toggleGeometryFixedOperand, toggleSelectedFixed, updateGeometrySelectionUI, types: { Circle, Arc },
    isPlacingInstance: geometryInstanceCommand.isPlacing, geometryInstanceBundle, targetFromConstraint, cancelPendingCommand,
    selectedPrimitives, placement: dimensionPlacement, angleDegrees, angleDimensionAngles, readOnlyDimensionConstraintForPlacement,
    addReadOnlyDimensionConstraint, makeConstraintOperand, sameConstraintOperand, applicationText, log,
  });
  function canApplyConstraint(type) { return constraintSelectionQuery.canApply(type); }

  function startConstraintTargetCommand(type) { return constraintTargetCommand.start(type); }
  function cancelConstraintTargetCommand(message) { return constraintTargetCommand.cancel(message); }
  function completePendingDimensionLineLength() { return constraintTargetCommand.completeLineLength(); }

  function hitConstraintOperand(pointer, type, hits = {}) { return queryConstraintOperand(pointer, type, constraintTargetSession.operands, hits); }

  function handleConstraintOperandClick(pointer, type, hits = {}) { return constraintTargetCommand.operandClick(pointer, type, hits); }

  function handleConstraintTargetDoubleClick(hitP, hitL, pointer) { return dimensionPlacementCommand.targetDoubleClick(hitP, hitL, pointer); }

  function startInstanceAngleDimension(instance) { return dimensionPlacementCommand.startInstanceAngleDimension(instance); }
  function startDistanceCommand() { return dimensionPlacementCommand.startDistanceCommand(); }

  function cancelPendingCommand(message) { return pendingCommandSession.cancel(message); }

  function startDistanceValueInput(pointer) { return dimensionPlacementCommand.startDistanceValueInput(pointer); }


  const pendingDimensionHover = window.ConstraintCommandInput.createRetargetHover({
    getPending: pendingCommandSession.read, canvasHover, hitConstraintOperand, sameConstraintOperand,
    resolveConstraintIntent, referenceTargetFromOperand, Circle, Arc,
  });
  function updatePendingDistanceRetargetHover(pointer) { return pendingDimensionHover.update(pointer); }

  function startDimensionEditInput(hit) { return dimensionValueCommand.startEdit(hit); }

  function sketchHasDimensionConstraint(sketchId = activeSketchId()) {
    return editingScopeBinding.current.constraints.some((constraint) => constraintSketchId(constraint) === sketchId && constraint.dimension);
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

  const sketchCommand = window.SketchCommand.create({
    currentScope: workspace.current, ensureSketchState, activeSketch, activeSketchId, sketchById, childSketchesOf,
    sketchName, nextSketchId: () => documentIds.allocate("sketch"), clearInteractionForSketchChange,
    setHint, updateUI, draw, recordHistory, promptName: (title, name) => window.prompt(title, name),
    effectiveAppearanceForElement, clearTreeHover: () => sketchTreeController.clearHoverSketch(), clearSnap,
    guardEdit: guardSketchEdit, applicationText, prepareLockToggle: () => { cancelPendingCommand(""); cancelConstraintTargetCommand(""); exitDrawMode(); },
  });
  const { createSketch, activate: setActiveSketch, rename: renameSketch, toggleLock: toggleSketchLock, toggleVisibility: toggleSketchVisibilityCommand } = sketchCommand;
  function toggleSketchVisibility(id) { return toggleSketchVisibilityCommand(id); }
  const sketchMoveQuery = window.SketchMove.create({
    currentScope: workspace.current, activeSketchId, constraintGraphNodes, constraintSketchId,
    resolveGeometryRef, geometryInstanceDependencyRefs, isReferenceSourceSketchId, applicationText,
  });
  function refreshSketchMoveGeometry() {
    invalidateBlockProjectionCache();
    geometryReads.clearReadCache();
    hatchGeometryQuery.clear();
    constraintRebinding.rebuildDocument(editingScopeBinding.current, [...blockProjectionBundles(), ...geometryInstanceBundles()]);
    constraintAnalysis.invalidate();
    refreshReferenceConstraintValidity();
  }
  sketchMoveCommand = window.SketchMoveCommand.create({
    currentScope: workspace.current, activeSketchId, selection: canvasSelection, query: sketchMoveQuery,
    prepare: () => { cancelConstraintTargetCommand(""); cancelPendingCommand(""); exitDrawMode(); canvasHover.clear(); },
    refresh: refreshSketchMoveGeometry, clearSelection, updateUI, draw, setHint, recordHistory, applicationText,
  });
  // Destination mode keeps all editing input in the tree until commit or cancellation.
  const sketchMoveInputBinding = window.SketchTreeController.createMoveInputBinding({ document, isMoving: () => sketchMoveCommand.active });
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


  const { toolbarSvgMarkup, constraintToolbarIcon } = window.ToolbarView.createIcons({
    document, isDimensionConstraint, types: { LineFixedConstraint, ArcEndpointFixedConstraint, GeometryFixedConstraint,
      SketchProjectionConstraint, ParallelLinesCenterlineConstraint, PointPairCenterlineConstraint },
  });



  const fixedOperandCommand = window.FixedToggleCommand.createOperand({
    guardSketchEdit, elementSketchId, operandElement, guardSketchProjectionShapeEdit, applicationText,
    findLineFixedConstraint, LineFixedConstraint, findArcEndpointFixedConstraint, arcEndpointPoint, ArcEndpointFixedConstraint,
    currentScope: workspace.current, GeometryFixedConstraint, sameConstraintDisplayElement, deleteElements, commitNewConstraint, solveAndRefresh,
  });

  const sketchTreeObjects = window.SketchTreeObjects.create({
    readServices: geometryReadServices, sketchContext, applicationSettings, constraintFeedback,
    isHidden: selectionVisibilityIsHidden,
    currentScope: dimensionPresentationScope,
    ensureAnalysis: constraintAnalysis.ensure, types: window.GeometrySolver,
    isExplicitPoint, isPointUsedByLine,
    constraintStatusOf, escapeHtml, formatDisplayNumber,
    toolbarSvgMarkup, constraintToolbarIcon, sketchTreeGutter: window.SketchTreeView.gutter, isSketchProjectedGeometry,
    findLineFixedConstraint, geometryInstanceTypeLabel,
    resolvedHatchBoundary, hatchPatternTypeLabel, hatchAppearanceForDisplay,
    isDimensionConstraint, constraintGeometryId, isReadOnlyDimension,
    constraintIsRedundant, referenceConstraintErrorInfo, sketchTreeObjectSelected,
    readCanvasHover: () => canvasHover.current, readSidebarHover: () => selectionHighlight.current,
    constraintDirectlyReferencesCanvasSelection, selectedConstraintReferenceElements,
  });
  const { view: sketchTreeView, controller: sketchTreeController, menu: sketchTreeContextMenu } = window.SketchTreeController.createWithDocumentView({
    document, window, sketchContext, applicationSettings, escapeHtml, closeCanvasContextMenu,
    ensureSketchState, objects: sketchTreeObjects, moveCommand: sketchMoveCommand,
    getScopeKey: () => blockEditor.current?.draft?.id ? `block:${blockEditor.current.draft.id}` : "document",
    viewScope: () => editingScopeBinding.current, sketchHasSolveError, referenceConstraintErrorCountForSketch, constraintDuplicateCountForSketch,
    currentScope: dimensionPresentationScope, setActiveSketch, clearSelection, canvasSelection,
    sidebarGeometryItem, toggleBlockInstanceSelection, targetFromConstraint, updateUI, draw,
    updateSketchUI, toggleSketchVisibility, toggleSketchLock, guardSketchEdit, selectionSketchId, renameSketch, deleteSketch, deleteElements, deleteCurrentSelection, toggleSelectedVisibility,
    hover: { canvasHover, setSidebarHover, clearSidebarHover, sidebarHoverElementsForItem, sidebarHoverElementsForConstraint, elementSketchId, ROOT_SKETCH_ID },
    updateSelectionUI: updateGeometrySelectionUI,
    unfixPoint: fixedOperandCommand.unfixPoint,
  });
  const { applyWidth: applySketchTreeWidth } = sketchTreeView;
  sketchContextController = sketchTreeContextMenu;
  sketchContextController.start();

  function isSidebarHighlightedElement(item) { return sketchTreeController.isHighlightedElement(item); }





















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

  const expressionInputController = window.ExpressionInputController.create({
    document, types: { InputElement: HTMLInputElement, TextAreaElement: HTMLTextAreaElement }, currentNamespace: () => editingScopeBinding.current, dimensionValueInput,
    pendingCommandSession, parameterDraft, ensureDimensionParameter, setParameterDialogError,
    setHint, applicationText, language: () => applicationSettings.language, insertIdentifierIntoExpressionInput,
    canvas, canvasPoint, hitDimension, hitAnnotationElement,
  });
  const { context: focusedExpressionInputContext, insertDimension: insertClickedDimensionParameter, insertAnnotation: insertClickedAnnotationParameter } = expressionInputController;


  function effectiveDimensionAppearanceForSketch(...args) { return dimensionAppearance.effectiveDimensionAppearanceForSketch(...args); }









  const propertySelection = window.PropertiesDisplay.createSelection({
    canvasSelection, documentModel, readServices: geometryReadServices, sketchContext, hatchAppearanceForDisplay,
    getOperation: () => ({ mode: drawOperationLifecycle.mode, instanceSourceEdit: instanceSourceCommand.current, freeInstancePlacement: geometryInstanceCommand.pending, blockPlacementDefinitionId: blockPlacementCommand.definitionId }),
  });
  function selectedPropertiesTarget() { return propertySelection.selectedDisplayTarget(); }
  const { editing: propertyEditing, appearanceUI } = window.PropertiesDisplay.createEditing({
    document, documentModel, currentScope: workspace.current, appearanceScope: () => editingScopeBinding.current, viewport, propertySelection,
    readServices: geometryReadServices, sketchContext, checkpoint: editingCheckpoint, parameterStabilization,
    guardSketchProjectionShapeEdit, synchronizeSketchProjectionMetadata, materializeAnchor: materializeAnnotationAnchor,
    isGeometryMode, toggleSketchVisibility, guardSelectionEdit, applicationSettings, escapeHtml,
    invalidateBlockProjectionCache, recordHistory, updateUI, updatePropertiesUI, draw,
  });
  const { appearanceEditing, visibility: selectionVisibilityCommand } = propertyEditing;
  const propertiesView = window.PropertiesDisplay.createWithController({
    document, documentModel, currentScope: workspace.current, canvasSelection,
    getOperation: () => ({ mode: drawOperationLifecycle.mode, freeInstancePlacement: geometryInstanceCommand.pending, instanceSourceEdit: instanceSourceCommand.current, blockPlacementEnabledSketchIds: blockPlacementCommand.enabledSketchIds, blockPlacementRotationLocked: blockPlacementCommand.rotationLocked }),
    propertySelection, readServices: geometryReadServices, sketchContext, sketchProjectionConstraintForTarget,
    constraintGeometryId, constraintFeedback, constraintStatusOf, snappedBlockRotation, constraintDefiningGeometryEntries,
    hatchAppearanceForDisplay, resolvedHatchBoundary, applicationSettings, escapeHtml, hatchRegionErrorText,
    geometryInstanceTypeLabel, parameterNamespace, installExpressionInputHighlights,
    propertyEditing, appearanceUI, HTMLTextAreaElement, HTMLInputElement,
    canEditStructure: item => guardSketchEdit(elementSketchId(item), "structure"),
    changeFreeInstanceProperty, commitDimensionPropertyEdit, commitAnnotationParameterEdit, updateUI, updatePropertiesUI, draw, setHint,
    blockPlacement: blockPlacementCommand,
    setBlockInstanceRotationLocked, setBlockInstanceEnabledSketchIds, setBlockInstanceOrthogonalRotation,
    annotationCommand, startInstanceSourceEdit: instanceSourceCommand.startForInstance, startInstancePlacementEdit: geometryInstanceCommand.startEdit, startInstanceAngleDimension, startReferenceImageCalibration, startHatchBoundaryRepair,
    startSplineEdit: spline => splineEditing.activate(spline),
  });















  function dimensionDisplayState(...args) { return dimensionAppearance.dimensionDisplayState(...args); }


























  function updateStatusUI() { return commandStatusView.update(); }



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
    currentScope: workspace.current, forgetConstraint: constraintRedundancy.forgetConstraint,
    resolveSelection: constraintResolutionFromCurrentSelection, canvasSelection,
    guardSketchEdit, activeSketchId, constraintTargetsAreActive, snapshotModelState, restoreModelState,
    solveStepNormForConstraint, pushModelConstraint, preconditionNewConstraint, withTemporarySolveStepNorm,
    solveConstraintComponentAndDependents, isDimensionConstraint, isReadOnlyDimension, stabilizeActiveParameterNamespace,
    constraintSketchId, lineCollapseQuery, redundantConstraintInfo, acceptError: CONSTRAINT_ACCEPT_ERROR,
    targetFromConstraint, measuredConstraintTargetValue, startDistanceResolution, distanceConstraintFromTarget,
    clearSelection, refreshConstraintAnalysis, updateUI, draw, setHint, log,
    recordHistory, applicationText, isReferenceSourceSketchId, descendantSketchIds, wouldCreateReferenceCycle,
    sketchName, now: () => performance.now(),
  });
  function commitNewConstraint(...args) { return constraintCommitCommand.ordinary(...args); }
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

  function addConstraint(type) { return constraintCommitCommand.fromSelection(type); }

  const geometryDragFeature = window.GeometryDragFeature.create({
    solver, currentScope: workspace.current, activeSketchId, sketchSolveVariables, sketchSolveConstraints, solveSketchById,
    viewScale: () => viewport.scale, arcEndpointPoint, acceptError: CONSTRAINT_ACCEPT_ERROR,
    previewMaxModelError: DRAG_PREVIEW_MAX_MODEL_ERROR,
    elementSketchId, isEditableSketchId, blockDefinitionById, blockLocalGeometryBounds, blockInstanceEnabledSketchSet,
    blockWorldPoint, pointLockedByLineFixed, findLineFixedConstraint, findArcEndpointFixedConstraint,
    arcEndpointDragValue, hypot2, minimumLength: MIN_ORIENTATION_LENGTH,
    contextFromSeeds: localSolveContextFromSeeds, projectionConstraintsForItems: sketchProjectionConstraintsAffectingItems,
    captureValues: snapshotModelState, enforceMinimumLineLengths, normalizeArcSweeps, invalidateBlockProjectionCache,
    projectionBlockedMessage: () => sketchProjectionShapeEditBlockedMessage(applicationText("ドラッグ", "Drag")),
    profileSolve: work => interactionProfiler.active ? profileInteractionWork("solve", work) : work(),
    canEdit: guardSketchEdit,
    beginPointer: (id) => { canvas.classList.add("is-dragging"); canvas.setPointerCapture(id); },
    endPointer: (id) => { canvas.classList.remove("is-dragging"); try { canvas.releasePointerCapture(id); } catch (_) {} },
    canvasSelection, restoreModelState, solveReferenceDependentSketches, clearSketchSolveState,
    stabilizeActiveParameterNamespace, refreshConstraintAnalysis, applicationText, setHint, updateUI,
    updateGeometrySelectionUI, draw, recordHistory,
    geometryInstanceSourceObjects, clearSelection, geometryInstanceSourcePoints, resolveDerivedDragSource,
  });
  const { command: geometryDrag, build: buildDragSession, beginDerived: beginDerivedGeometryDrag } = geometryDragFeature;

  function hasDirectRadiusDimension(primitive) {
    return window.DimensionQueries.hasDirectRadiusDimension(editingScopeBinding.current.constraints, primitive);
  }

  const constraintInputFeature = window.ConstraintCommandInput.createFeature({
    canvasHover, canvasPoint, pending: pendingCommandSession, targets: constraintTargetSession,
    placement: dimensionPlacementCommand, constraints: constraintTargetCommand,
  });
  const dimensionDragFeature = window.DimensionDragFeature.create({
    placement: dimensionPlacement, viewport, canvasSelection, currentScope: workspace.current,
    constraintSketchId, isEditableSketchId, isVisibleSketchId, effectiveDimensionAppearance, isVisibleValue,
    guardSketchEdit, commandInput: constraintInputFeature.dimension, setHint, clearSnap, hypot2,
    beginPointer: (id) => { canvas.classList.add("is-dragging"); canvas.setPointerCapture(id); },
    endPointer: (id) => { canvas.classList.remove("is-dragging"); try { canvas.releasePointerCapture(id); } catch (_) {} },
    draw, updateUI, updateGeometrySelectionUI, syncDimensionValueInput, recordHistory,
  });
  const { command: dimensionDrag, lineGroup: dimensionLineGroup, selectedLineGroup: selectedDimensionLineGroup } = dimensionDragFeature;
  const { begin: beginDimensionDrag } = dimensionDrag;







  const { begin: beginBlockDrag } = window.GeometryDrag.createBlockEntry({
    clearSelection, canvasSelection, buildDragSession, geometryDrag, setHint, updateUI, draw,
  });



  const trimFeature = window.TrimFeature.create({
    currentScope: workspace.current, geometry: geometryCreation, references: constraintReferences,
    isActiveSketchElement, minLineLength: MIN_LINE_LENGTH, minArcLength: MIN_ARC_LENGTH,
    pushModelConstraint, elementSketchId, isPointUsedByPrimitive, isReferencePoint, viewportScale: () => viewport.scale,
    preview: drawingPreview, checkpoint: editingCheckpoint,
    hitSketchIdentityElement, guardSketchEdit, activeSketchId, setHint, draw, guardSketchProjectionShapeEdit, applicationText,
    clearSelection, stabilizeActiveParameterNamespace, acceptError: CONSTRAINT_ACCEPT_ERROR,
    invalidateAnalysis: () => constraintAnalysis.invalidate(), refreshConstraintAnalysis, updateUI, recordHistory,
  });
  const { execute: executeTrimAt } = trimFeature;

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





  function previewCanvasContextCandidate(target) { return canvasContextInteraction.preview(target); }







  const canvasCommandCancellation = window.CanvasCommandCancellation.create({
    instances: geometryInstanceCommand,
    readMode: drawOperationLifecycle.readMode, selectMode: drawOperationLifecycle.selectMode, blockPlacementCommand, drawingPreview, restoreBlockPlacementPropertiesPanel,
    readPending: pendingCommandSession.read, cancelPendingCommand, readConstraintCommand: () => constraintTargetSession.command, cancelConstraintTargetCommand,
    drawing: { active: hasActiveDrawOperation, cancel: cancelActiveDrawOperation, isToolMode: isDrawToolMode, exit: exitDrawMode },
    applicationText, setHint, updateUI, draw,
  });
  function hasCancellableCanvasCommand() { return canvasCommandCancellation.hasCancellable(); }
  function cancelCanvasCommandFromContextMenu() { return canvasCommandCancellation.cancel(); }

  function hasCopyableCanvasSelection() { return clipboardFeature.canOfferCopy(); }

  const { topmostOwner: topmostDrawingOrderOwner, state: drawingOrderCommandState, reorder: reorderSelectedDrawingObjects } = window.DrawingOrderCommand.create({
    currentScope: () => editingScopeBinding.current, canvasSelection, activeSketchId, selectionSketchId, ordinarySelectionMode,
    guardSelectionEdit, updateUI, draw, recordHistory, applicationText, setHint,
  });







  function selectCanvasContextCandidate(target, pointer) { return canvasContextInteraction.selectCandidate(target, pointer); }



  function openCanvasContextMenu(event) { return canvasContextInteraction.open(event); }



  function executeCanvasContextAction(action, target, pointer) { return canvasContextInteraction.execute(action, target, pointer); }

  const canvasContextInteraction = window.CanvasContextInteraction.create({
    canvasSelection, sameArcEndpoint, clearSelection, arcEndpointPoint, selectedFixedBatchTargets, fixedBatchIsFullyFixed, findLineFixedConstraint,
    findArcEndpointFixedConstraint, selectedGeometryItems, readMode: drawOperationLifecycle.readMode, sketchProjectionCommand, applicationText, document,
    canCreateInActiveSketch, visibleGeometryBounds, pendingCommandSession, constraintTargetSession, splineEditing, isReadOnlyDimension,
    selectedDimensionLineGroup, blockDefinitionScopeError, blockDefinitionEditError, selectedConstructionTogglePrimitives, drawingOrderCommandState,
    hasCopyableCanvasSelection, hasSelection, handleConstraintOperandClick, updateUI, draw, canvasContextMenu, isGeometryMode,
    closeAppMenus: () => closeAppMenus(), canvasPoint, setLastPointer: pointerInteractionController.setLastPointer, hasCancellableCanvasCommand,
    canvasContextCandidatesAt, canvasContextController, guardSelectionEdit, guardSketchEdit, elementSketchId, selectionSketchId, activeSketchId,
    commitSketchProjectionCommand, cancelCanvasCommandFromContextMenu, undoHistory, redoHistory, copySelectionToClipboard, imageClipboard,
    showSelectedObjectProperties: canvasWorkspaceLayout.showSelectedObjectProperties, fixPointBtn, enterBlockDefinitionEdit,
    setBlockInstanceRotationLocked, startDimensionEditInput, dimensionLineGroup, updateGeometrySelectionUI, recordHistory, setHint, sketchMoveCommand,
    startHatchBoundaryRepair, reorderSelectedDrawingObjects, addSplineFitPointFromContext, deleteSplineFitPointFromContext, fitVisibleGeometryToViewport,
    canvasHover,
  });
  canvasContextController.start();

  const canvasCommandInputs = window.CanvasCommandInputs.create({
    readMode: drawOperationLifecycle.readMode, readPending: pendingCommandSession.read, readPendingConstraint: () => constraintTargetSession.command,
    document, canvas, canvasSelection, clearSelection, canvasHover, draw, updateUI, updateGeometrySelectionUI, setHint, applicationText,
    annotationCommand, annotationDrag, startAnnotationAnchorConstraint, constraintInputFeature, dimensionDragging: dimensionDragFeature, beginDimensionDrag,
    constraintTargetHint,
    instanceSourceCommand, geometryInstanceCommand, sceneQueries: sceneHitQueries, operandElement, toggleSketchProjectionSource,
    clearSnap, selectionRectangle, drawingSnap, viewport, geometryRefForItem, resolveGeometryRef, snapForDrawing,
    transientAuthoring, addPoint, addPointSnapConstraints, solveAndRefresh, rejectRootSketchCreation, basicDrawingInput: basicDrawingTools.input, handleCenterlineClick, handleCircleCenterCrossClick,
    handleFilletClick, handleSplineClick, executeTrimAt, offsetCommand,
    sameArcEndpoint, topmostDrawingOrderOwner, drawingOrderOwner, beginDerivedGeometryDrag, beginBlockDrag, beginReferenceImageDrag, buildDragSession, geometryDrag,
  });

  const { press: canvasPressQuery, hover: pointerHover, isBlankCommandPanelPoint } = sceneHitQueries.createInteraction({
    canvasHover, sameArcEndpoint, hitBlockRotationHandle, hitAnnotationTarget, blankCanvasGesture, instanceSourceCommand, hatchCommand,
  });

  pointerInteractionController.bind({
    canvasNavigation, drawingPreview, canvasHover, clearSnap, draw, transientAuthoring, recordHistory,
    selectionRectangle, annotationDrag, referenceImageInteraction, dimensionDrag, geometryDrag, pointerHover,
    getMode: drawOperationLifecycle.readMode, getPendingCommand: pendingCommandSession.read,
    getPendingConstraintCommand: () => constraintTargetSession.command,
    updateHatchPreview, updateFilletRadiusPlacement, updatePendingDistanceRetargetHover, hitDimension, hitSketchIdentityElement,
    press: { discardMove: () => flushScheduledCanvasPointerMove({ discard: true }),
      selectInactive: identitySelection.selectInactive,
      prepareSelection: identitySelection.prepareSelection,
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
      inputs: canvasCommandInputs },
  });

  function isDrawToolMode() { return drawOperationLifecycle.isToolMode(); }

  const canvasInputBinding = window.CanvasInputBinding.create({
    canvas, pointer: window.CanvasInputBinding.createCommandRouting({
      pointer: pointerInteractionController, readCommandPanel: () => commandPanel, readPngExportCommand: () => pngExportCommand,
      blankCanvasGesture, canvasScreenPoint, canvasPoint, isBlankCommandPanelPoint, screenToWorld, navigation: canvasNavigation,
    }), scheduler: pointerMoveScheduler, navigation: canvasNavigation,
    profileCommit: work => profileInteractionPhase("commit", work), closeContextMenu: closeCanvasContextMenu,
    afterZoom: () => { if (pendingCommandSession.current && ["distance-value", "offset-value"].includes(pendingCommandSession.current.type)) syncDimensionValueInput(); },
    screenToWorld, formatCoordinate: formatDisplayNumber, coordinateStatus: () => document.getElementById("statusCoordinates"),
  });
  canvasInputBinding.bind();
  dimensionInput.bind();

  const keyboardInput = window.KeyboardInput.create({
    window, menus: { closeSketch: () => sketchContextController.close(),
      canvasVisible: () => canvasContextMenu && !canvasContextMenu.hidden, closeCanvas: closeCanvasContextMenu },
    sketchMove: sketchMoveCommand, constraintStatusView, dimensionInput: dimensionInputController,
    shortcuts: { save: saveJot2DFile, saveAs: saveJot2DFileAs, copy: copySelectionToClipboard,
      paste: pasteGeometryClipboard, nativePaste: true, nativeCopy: true, undo: undoHistory, redo: redoHistory },
    readMode: drawOperationLifecycle.readMode, isGeometryMode, instances: geometryInstanceCommand, projection: sketchProjectionCommand,
    referenceImage: referenceImageInteraction, splineEditing, blockPlacement: blockPlacementCommand, annotationDrag,
    pendingCommandSession, cancelPendingCommand, constraintTargetSession, cancelConstraintTargetCommand,
    drawing: { active: hasActiveDrawOperation, cancel: cancelActiveDrawOperation, isToolMode: isDrawToolMode, exit: exitDrawMode },
    hasSelection, clearSelection, annotation: annotationCommand, finishSources: finishInstanceSourceEdit,
    finishSpline: finalizeSplineCreation, finishProjection: commitSketchProjectionCommand, finishHatch: hatchCommand.finish,
    removeSplinePoint: removeLastSplineInputPoint, offset: offsetCommand, readPointer: pointerInteractionController.readLastPointer,
    deleteSelection: deleteCurrentSelection, completeLineLength: completePendingDimensionLineLength,
    isTextEditingTarget: target => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable,
    setHint, updateUI, draw,
  });
  keyboardInput.start();
  canvasViewControls.bindWindow();

  const editingToolBinding = window.ToolbarView.createEditingBinding({
    document, undo: undoHistory, redo: redoHistory, toggleVisibility: toggleSelectedVisibility,
    isGeometryMode, deleteSelection: deleteCurrentSelection, updateUI, draw, annotation: annotationCommand,
  });
  editingToolBinding.bind();
  canvasViewControls.bindControls();



  function rebuildRootConstraintObjects() {
    constraintRebinding.rebuildDocument(editingScopeBinding.current, blockProjectionBundles());
    clearSelection();
  }




  const applicationMenus = window.ApplicationMenus.create({ document, window, activateTool: id => document.getElementById(id)?.click() });
  const { close: closeAppMenus } = applicationMenus;
  applicationMenus.start();
  toolFlyouts = window.ToolFlyouts.create({ document, window, onOpen: closeAppMenus });
  toolFlyouts.start();
  canvasWorkspaceLayout.bindControls();
  parameterEditor.start();
  appearanceUI.start();
  applicationSettings.start();
  blockView.bind();

  const drawingToolBinding = window.ToolbarView.createBinding({
    document, drawOperationLifecycle, startCenterlineCommand, startCircleCenterCrossCommand, startSketchProjectionCommand,
    startGeometryInstanceCommand, constructionCommand, filletCommand, startBlockCreation, offsetCommand, beginSplineCreation, startHatchCreation,
  });
  drawingToolBinding.bind();

  documentFileFeature.bindControls();
  const pngExport = window.PngExport.create({
    document, window, canvas, rendering: pngRendering, text: applicationText, documentName: effectiveDocumentName,
    prepareImages: referenceImageFeature.prepareImages,
    readViewScale: () => viewport.scale, readMode: drawOperationLifecycle.readMode, setMode: drawOperationLifecycle.setMode,
    pendingCommandSession, fileSession, drawOperationLifecycle, constraintTargetSession,
    withGeometryReadCache, findSnap: (point, tolerance) => drawingSnap.find(point, tolerance),
    flushPointerMove: flushScheduledCanvasPointerMove, setHint, draw,
  });
  pngExportCommand = pngExport.command;
  pngExport.start();
  const dxfFileControls = window.DocumentFileControls.createDxf({
    document, flushScheduledCanvasPointerMove, fileSession, canImportDxf, setHint, applicationText, dxfImportCommand,
  });
  dxfFileControls.bind();
  referenceImageInput.bindControls();
  document.getElementById("addSketchBtn")?.addEventListener("click", () => createSketch("sibling"));
  document.getElementById("addChildSketchBtn")?.addEventListener("click", () => createSketch("child"));

  window.SidebarController.create({ document, setHint }).bind();


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



  canvasWorkspaceLayout.bindWindow();

  function installTestHooks() {
    if (!new URLSearchParams(window.location.search).has("test")) return;
    const historyObservation = window.DocumentTestDriver.createHistoryObservation({ activeEditHistory, blockEditor, document, constructionCommand });
    const readTestHistory = historyObservation.state;
    const selectedGeometryObservation = window.CanvasSelectionTestDriver.createIdObservation({ canvasSelection });
    const readTestSelectedGeometry = selectedGeometryObservation.state;
    const constraintStatusObservation = window.ConstraintTestDriver.createStatusObservation({ refreshConstraintAnalysis, readMembership: readSketchMembership });
    const readTestConstraintStatuses = constraintStatusObservation.state;
    const constraintAnalysisObservation = window.ConstraintTestDriver.createAnalysisObservation({
      activeSketchId, sketchSolveVariables, sketchSolveConstraints, sketchSolveLines, analyzeConstraintState: options => solver.analyzeConstraintState(options),
      acceptError: CONSTRAINT_ACCEPT_ERROR, vectorNorm, currentScope: workspace.current, elementSketchId,
    });
    const blockConstraintObservation = window.ConstraintTestDriver.createBlockObservation({ refreshConstraintAnalysis, blockProjectionBundles });
    const blockConstraintInsertion = window.ConstraintTestDriver.createBlockConstraintInsertion({
      blockInstanceById, blockProjectionBundle, commitNewConstraint, PointOnLineConstraint, readAnalysis: constraintAnalysisObservation.analysis, readBlockState: blockConstraintObservation.state, serializeModel,
    });
    const dragExecutionSupport = window.GeometryDragTestDriver.createExecutionSupport({
      feature: geometryDragFeature, solver, currentScope: workspace.current, normalizeArcSweeps, vectorNorm, sketchSolveConstraints,
      arcEndpointPoint, now: () => performance.now(), readConstraintStatuses: readTestConstraintStatuses,
    });
    const annotationTestSupport = window.AnnotationTestDriver.createSupport({
      annotationDimensions, targetFromConstraint, dimensionLayout, effectiveDimensionAppearance, dimensionLabelForConstraint,
      currentScope: workspace.current, viewport, clampZoom, effectiveAnnotationStyle, draw, annotationTextMetrics, annotationTextLayout,
      annotationLeaderDisplayGeometry, annotationTextWorldHeight, screenPxPerMm: ANNOTATION_SCREEN_PX_PER_MM, annotationDisplayFactor: window.Appearance.annotationDisplayFactor, annotationLeaderAnchor,
      displayText: window.AnnotationRenderer.displayText, formatDisplayNumber, serializeAnnotation, canvas, worldToCanvasScreen, allAnnotations, canvasSelection, allGeometryBounds,
      resetModelState, addPoint, addLine, annotationLeaderTargetFromItem, pushAnnotation, defaultStyle: DEFAULT_ANNOTATION_STYLE, resizeCanvas,
      screenToWorld, hitAnnotationElement, readDragState: () => annotationDrag.inspect()
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
    const blockEditorTestSupport = window.BlockTestDriver.createEditorSupport({
      resetModelState, updateUI, draw, readDefinitions: () => documentModel.blockDefinitions, currentScope: workspace.current, blockEditor, blockEditorSessionChain,
      readMode: drawOperationLifecycle.readMode, blockPlacementCommand, commitBlockPlacement, blockProjectionBundle, HorizontalConstraint, VerticalConstraint,
      pushModelConstraint, solveSketchById, invalidateBlockProjectionCache, recordHistory, serializeConstraint,
      createSketch, activeSketchId, addLine, addPoint, cancelBlockDefinitionEdit, completeBlockDefinitionEdit,
      setBlockInstanceEnabledSketchIds, serializeModel, loadModelData, allGeometryLines, enterBlockDefinitionEdit
    });
    const blockObservationSupport = window.BlockTestDriver.createObservationSupport({
      blockInstanceById, currentScope: workspace.current, blockInstanceDisplayCenter, readSolverVariables: () => solver.getVariables(), buildDragSession,
      blockProjectionBundle, worldToCanvasScreen, canvas, constraintTargetSession, canvasHover,
      blockProjectionBundles, readDefinitions: () => documentModel.blockDefinitions, canvasSelection, readMode: drawOperationLifecycle.readMode, serializeModel, viewport
    });
    const blockRejectionFixture = window.BlockTestDriver.createRejectionFixture({ resetModelState, addPoint, addLine, canvasSelection, blockSelectionGeometry, readDefinitionCount: () => documentModel.blockDefinitions.length, currentScope: workspace.current, activeSketchId, geometryRefForItem });
    const sidebarHighlightObservation = window.PropertiesTestDriver.createHighlightObservation({ canvasSelection, effectiveSelectedConstraint, constraintHighlightNodes, selectionHighlight, canvasHover });
    const sidebarHoverKeyObservation = window.PropertiesTestDriver.createHoverKeyObservation({ allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines, isSidebarHoveredElement, geometryElementKey });
    const blockDimensionFixture = window.BlockTestDriver.createReadOnlyDimensionFixture({ currentScope: workspace.current, blockProjectionBundle, defaultDimensionForTarget, readOnlyDimensionConstraintForPlacement, addReadOnlyDimensionConstraint });
    const blockExternalFixture = window.BlockTestDriver.createExternalConstraintFixture({ currentScope: workspace.current, blockDefinitionById, blockProjectionBundle, addPoint, CoincidentConstraint, pushModelConstraint, solveSketchById, invalidateBlockProjectionCache, hypot2 });
    const dimensionInteractionSupport = dimensionTestSupport.createInteraction({
      clientPosition: canvasTestDriver.clientPosition, startDimensionEditInput, clearSelection, updateUI, draw, addCircle, addArc,
      fitAllGeometryToViewport, startDistanceCommand, constraintGraphNodes, worldToCanvasScreen, canvas, dimensionAnchor,
      LineCircleDistanceConstraint, ConcentricRadiusDifferenceConstraint, signedPointLineDistance, vectorNorm, solveSketchAndDependents,
      snapshotModelState, refreshConstraintAnalysis, dimensionDrag,
    });
    const themeObservation = window.PropertiesTestDriver.createThemeObservation({ applicationSettings, readDefaultGeometryColor: () => DEFAULT_APPEARANCE.color, canvasThemeColor, CanvasThemeColors: window.CanvasThemeColors });
    const documentNameObservation = window.DocumentTestDriver.createNameObservation({ readDocumentName: () => documentModel.documentName, effectiveDocumentName, serializeModel, document });
    const fileObservation = window.DocumentTestDriver.createFileObservation({ fileSession });
    const viewObservation = window.CanvasTestDriver.createViewObservation({ viewState, constraintStatusView });
    const sketchVisibilityObservation = window.SketchTreeTestDriver.createVisibilityObservation({ sketchById, serializeModel, isVisibleSketchId, document });
    const responsiveDragFixture = window.GeometryDragTestDriver.createResponsiveFixture({
      resetModelState, addPoint, addLine, pushModelConstraint, DistanceConstraint, ParallelConstraint, PerpendicularConstraint,
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
    const siblingVisibilityFixture = window.SketchTreeTestDriver.createSiblingVisibilityFixture({ resetModelState, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID, defaultSketchId: DEFAULT_SKETCH_ID, addPoint, addLine, updateUI, draw, isVisibleSketchId, sketchRelationToActive, sketchStrokeWidth, constraintStatusColor, document });
    const inactiveHoverFixture = window.SketchTreeTestDriver.createInactiveHoverFixture({
      resetModelState, activeSketchId, addPoint, addLine, addDistanceConstraintFromTarget, dimensionFromAnchor, currentScope: workspace.current, isDimensionConstraint, createEmptyBlockDefinition, Point, Line,
      appendDefinition: definition => documentModel.blockDefinitions.push(definition), nextInstanceId: () => documentIds.allocate("blockInstance"), invalidateBlockProjectionCache, fitAllGeometryToViewport, viewport, updateUI, draw,
      dimensionLayout, targetFromConstraint, clientPosition: canvasTestDriver.clientPosition, blockInstanceDisplayCenter, sketchIdentityRelationLabel,
    });
    const hoverIdentityObservation = window.SketchTreeTestDriver.createIdentityObservation({ canvasHover, sketchIdentityRelationLabel });
    const sidebarInspectionFixture = window.PropertiesTestDriver.createInspectionFixture({
      resetModelState, addPoint, addLine, addCircle, addArc, pushModelConstraint, HorizontalConstraint, DistanceConstraint, dimensionFromAnchor, assignConstraintSketchId, activeSketchId, currentScope: workspace.current, updateUI, fitAllGeometryToViewport, draw, canvas, worldToCanvasScreen,
    });
    const rootHoverFixture = window.SketchTreeTestDriver.createRootHoverFixture({
      resetModelState, addPoint, addLine, addCircle, addArc, currentScope: workspace.current, rootSketchId: ROOT_SKETCH_ID, createEmptyBlockDefinition, Point, Line, defaultSketchId: DEFAULT_SKETCH_ID,
      appendDefinition: definition => documentModel.blockDefinitions.push(definition), nextInstanceId: () => documentIds.allocate("blockInstance"), invalidateBlockProjectionCache, updateUI, fitAllGeometryToViewport, draw,
    });
    const blockHoverFixture = window.SketchTreeTestDriver.createBlockHoverFixture({
      resetModelState, viewport, createEmptyBlockDefinition, Point, Line, defaultSketchId: DEFAULT_SKETCH_ID, appendDefinition: definition => documentModel.blockDefinitions.push(definition), nextInstanceId: () => documentIds.allocate("blockInstance"),
      currentScope: workspace.current, invalidateBlockProjectionCache, updateUI, fitAllGeometryToViewport, draw, blockProjectionBundle, clientPosition: canvasTestDriver.clientPosition,
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
    const sketchMoveObservation = window.CanvasSelectionTestDriver.createMoveObservation({
      sketchMoveCommand, activeSketchId, fields: window.SketchMove.fields, canvasSelection, currentScope: workspace.current,
      decorateSerializedConstraint, serializeConstraint, serializeModel, isEditingBlock: () => Boolean(blockEditor.current),
    });
    const geometryIdSelection = window.CanvasSelectionTestDriver.createIdSelection({
      clearSelection, currentScope: workspace.current, canvasSelection, updateUI, draw, blockSelectionGeometry, readSelectedGeometry: readTestSelectedGeometry,
    });
    const overlapSelectionFixture = window.CanvasSelectionTestDriver.createOverlapFixture({
      resetModelState, addLine, addPoint, currentScope: workspace.current, ROOT_SKETCH_ID, DEFAULT_SKETCH_ID, createEmptyBlockDefinition, Point, Line,
      appendDefinition: definition => documentModel.blockDefinitions.push(definition), nextInstanceId: () => documentIds.allocate("blockInstance"),
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
      nextProjectionId: () => documentIds.allocate("sketchProjection"), nextMirrorId: () => documentIds.allocate("mirror"), nextPatternId: () => documentIds.allocate("pattern"),
      resetHistory, updateUI, draw, readState: derivedInstanceInteraction.state,
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
      readMode: drawOperationLifecycle.readMode, allHatches, hatchGeometryQuery, serializeHatch, hatchRegionErrorText, canvasSelection, hatchCommand, document,
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
      ...clipboardTestSupport,
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
      ...canvasTestDriver.publicAPI,
      hoverDisplayStateForTest: hoverDisplayObservation.state,
      authoringStateForTest: authoringObservation.state,
      ...dragExecutionSupport,
      constraintStatusesForTest: readTestConstraintStatuses,
      constraintAnalysisForTest: constraintAnalysisObservation.analysis,
      blockConstraintStatusForTest: blockConstraintObservation.state,
      addBlockPointOnLineConstraintForTest: blockConstraintInsertion.add,
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
      resetForRootSketchTreeHoverTest: rootHoverFixture.reset,
      resetForSketchTreeBlockHoverTest: blockHoverFixture.reset,
      ...offsetTestSupport,
      resetForSketchDeletion: sketchDeletionFixture.reset,
      resetForSiblingVisibility: siblingVisibilityFixture.reset,
      resetForInactiveDimensionAndBlockHover: inactiveHoverFixture.reset,
      hoverIdentityStateForTest: hoverIdentityObservation.state,
      geometryStrokeStyleCasesForTest: strokeStyleCases.cases,
      constructionLineHoverDisplayCasesForTest: canvasRenderingTestSupport.constructionLineHoverDisplayCasesForTest,
      constructionLineRenderingForTest: canvasRenderingTestSupport.constructionLineRenderingForTest,
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
      resetForEmptyBlockCreation: blockEditorTestSupport.resetForEmptyBlockCreation,
      ...dimensionInteractionSupport.placement,
      ...blockObservationSupport,
      drawnGeometryIdLabelsForTest: canvasRenderProbe.geometryIdLabels,
      constraintStatusEndpointMarkerCountForTest: canvasRenderProbe.constraintEndpointMarkerCount,
      drawnPointMarkerCountForTest: canvasRenderProbe.pointMarkerCount,
      arcEndpointHandleCountForTest: canvasRenderProbe.arcEndpointHandleCount,
      pointDisplayStateForTest: canvasRenderProbe.pointDisplayState,
      drawnDimensionLabelsForTest: canvasRenderProbe.dimensionLabels,
      drawnDimensionExpressionMarksForTest: canvasRenderProbe.dimensionExpressionMarks,
      ...dimensionInteractionSupport.selection,
      blockDefinitionUpdateCase: blockEditorTestSupport.blockDefinitionUpdateCase,
      blockReadOnlyDimensionCase: blockDimensionFixture.run,
      blockExternalConstraintCase: blockExternalFixture.run,
      ...blockEditorTestSupport.lifecycle,
      blockCreationRejectionCases: blockRejectionFixture.cases,
      sidebarHighlightIds: sidebarHighlightObservation.ids,
      currentSidebarHoveredGeometryKeys: sidebarHoverKeyObservation.keys,
    };
  }

  ({ derivedPanel, commandPanel } = window.CommandPanel.createFeature({
    document, host: canvas.parentElement, readMode: drawOperationLifecycle.readMode, sketchContext, projectionCommand: sketchProjectionCommand,
    geometryCommand: geometryInstanceCommand, sourceCommand: instanceSourceCommand, resolveGeometryRef, geometryRefForItem, applicationText, formatDisplayNumber,
    finishProjection: commitSketchProjectionCommand, finishSourceEdit: finishInstanceSourceEdit, exitDrawMode,
    changeFreeProperty: changeFreeInstanceProperty, hatchCommand, annotationCommand, effectiveAnnotationStyle, pngExportCommand,
    updateUI, updatePropertiesUI, setHint, draw,
  }));

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
