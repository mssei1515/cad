/* Connect annotation presentation, anchors and placement over the same operation owners. */
(() => {
  "use strict";
  function create({ ctx, viewport, surface, canvasSelection, readHover, readExportFrame, canvasThemeColor,
    effectiveAnnotationStyle, annotationLeaderAnchor, resolveGeometryRef, isEditableSketchElement, resizeEnabled,
    activeSketchId, allAnnotations, isVisibleValue, isVisibleSketchId, currentScope, readEditingScope,
    constraintTargetSession, pendingCommandSession, lastPointer, elementSketchId, guardSketchEdit, isReferenceSourceSketchId,
    geometryRefForItem, constraintOperandsFromSelection, recordHistory, updateUI, draw, setHint,
    cancelPendingCommand, cancelConstraintTargetCommand, applicationText, startDistanceResolution,
    defaultDimensionForTarget, normalizeDimension, evaluateDimensionExpressionDraft, parameterNamespace,
    ensureDimensionParameter, applyStyle, parameterErrorText, exitDrawMode, nextAnnotationId,
    canCreateInActiveSketch, rejectRootSketchCreation, clearSelection, updateToolbar, annotationLeaderTargetFromHit }) {
    const display = window.AnnotationDisplay.create({ ctx, viewport, surface, effectiveAnnotationStyle, canvasSelection,
      readHover, readExportFrame, canvasThemeColor, annotationLeaderAnchor, resolveGeometryRef, isEditableSketchElement,
      resizeEnabled, activeSketchId, allAnnotations, isVisibleValue, isVisibleSketchId, readPreview: () => command.preview() });
    const { annotationPlacementAnchor: readAnchor, annotationLeaderDisplayGeometry, annotationTextLayout, annotationTextMetrics } = display.renderer;
    function placementAnchor(...args) { return readAnchor(...args); }
    const materialization = window.AnnotationAnchorConstraints.createMaterialization({ annotationPlacementAnchor: placementAnchor,
      annotationLeaderDisplayGeometry, annotationLeaderAnchor, effectiveAnnotationStyle });
    function materialize(...args) { return materialization.materialize(...args); }
    const anchors = window.AnnotationAnchorConstraints.create({
      getCommand: () => constraintTargetSession.command, setCommand: value => { constraintTargetSession.replaceCommand(value); },
      selectedAnnotation: () => canvasSelection.selectedElementCount() === 1 ? canvasSelection.annotations[0] : null,
      byId: id => readEditingScope().annotations.find(item => item.id === id),
      canEdit: item => !item.blockProjection && guardSketchEdit(elementSketchId(item), "structure"),
      canReference: (item, point) => elementSketchId(point) === item.sketchId || isReferenceSourceSketchId(elementSketchId(point), item.sketchId),
      anchor: placementAnchor, materialize, pointRef: geometryRefForItem, resolveRef: resolveGeometryRef,
      recordHistory, updateUI, draw, setHint, cancelCommands: () => { cancelPendingCommand(""); cancelConstraintTargetCommand(""); }, applicationText,
      startDistancePlacement: resolution => startDistanceResolution(resolution, null),
      readOperands: () => constraintTargetSession.operands, selectionOperands: constraintOperandsFromSelection, cancelPending: cancelPendingCommand,
    });
    const dimensions = window.AnnotationAnchorConstraints.createDimensions({
      annotations: () => readEditingScope().annotations, anchor: placementAnchor, resolveRef: resolveGeometryRef,
      defaultDimension: defaultDimensionForTarget, normalizeDimension, capturePosition: item => materialize(item, { capture: true }),
      evaluateValue: expression => evaluateDimensionExpressionDraft(null, expression), applicationText,
    });
    function dimensionScope() { return { ...readEditingScope(), constraints: [...readEditingScope().constraints, ...dimensions.entries()] }; }
    function startAnchorConstraint(type, item = canvasSelection.annotations.length === 1 ? canvasSelection.annotations[0] : null) {
      return anchors.startFromSelection(type, item);
    }
    const command = window.AnnotationCommand.create({
      currentScope, getPending: pendingCommandSession.read, setPending: pendingCommandSession.replace, lastPointer, viewScale: () => viewport.scale,
      annotationTextLayout, annotationLeaderDisplayGeometry, annotationTextMetrics,
      nextParameterName: () => parameterNamespace.allocateDimensionParameterName({ ...readEditingScope(), parameters: readEditingScope().parameters.map(item => ({ ...item })), annotations: [...readEditingScope().annotations] }),
      validateParameter: draft => parameterNamespace.validateNewDimensionParameter(draft, readEditingScope()),
      commitParameter: item => { ensureDimensionParameter(item, readEditingScope()); parameterNamespace.evaluateParameterNamespace(readEditingScope()); },
      applyStyle,
      parameterErrorText, selectAnnotation: item => canvasSelection.set("annotations", [item]),
      canEdit: item => guardSketchEdit(elementSketchId(item), "structure") && !item.blockProjection,
      prepare: () => { exitDrawMode(); cancelConstraintTargetCommand(""); }, nextAnnotationId, activeSketchId, canCreateInActiveSketch, rejectRootSketchCreation,
      annotationLeaderTargetFromHit, annotationLeaderAnchor, effectiveAnnotationStyle, clearSelection, cancelPendingCommand,
      setHint, updateToolbar, updateUI, draw, recordHistory,
    });
    return Object.freeze({ renderer: display.renderer, layer: display.layer, anchors, dimensions, command,
      placementAnchor, materialize, dimensionScope, startAnchorConstraint });
  }
  window.AnnotationFeature = Object.freeze({ create });
})();
