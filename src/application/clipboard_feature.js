/* Compose copy/cut/paste around the existing payload, session and append owners. */
(() => {
  "use strict";
  function create({ blockProjectionBundle, blockProjectionLocalId, resolveGeometryRef, geometryInstanceSourcePoints, geometryInstanceBundle,
    applicationText, annotationTextLayout, annotationTextMetrics, annotationLeaderDisplayGeometry, annotationLeaderAnchor, effectiveAnnotationStyle,
    viewport, serializeGeometryInstance, constraintGraphNodes, serializeConstraint, decorateSerializedConstraint,
    currentScope, canvasSelection, blockScopeId, setHint, pasteOffsetScreenPx, imageClipboard, updateToolbar, deleteSelection,
    geometryIds, ensureLineMinimumLength, normalizeArcSweep, blockDefinitionById, documentIds, normalizeGeometryInstance,
    parameters, deserializeConstraint, invalidateProjection, isGeometryMode, blockDefinitionScopeError, canCreateInActiveSketch,
    guardSketchEdit, activeSketchId, currentParameterNamespace, clearSelection, selectMode, solveAndRefresh, updateUI, draw, sketchName }) {
    const transfer = window.ClipboardTransfer.create({
      blockProjectionBundle, blockProjectionLocalId, resolveGeometryRef, geometryInstanceSourcePoints, geometryInstanceBundle, applicationText,
      annotationTextLayout, annotationTextMetrics, annotationLeaderDisplayGeometry, annotationLeaderAnchor, effectiveAnnotationStyle,
      readViewportScale: () => viewport.scale,
    });
    const payload = window.ClipboardPayload.create({
      geometryInstanceBundle, geometryInstanceSourcePoints, serializeGeometryInstance, blockProjectionBundle, blockProjectionLocalId,
      resolveGeometryRef, constraintGraphNodes, applicationText, detachedAnnotation: transfer.detachedAnnotation,
      serializeConstraint: constraint => decorateSerializedConstraint(serializeConstraint(constraint), constraint),
    });
    function copyableSelectionPayload() {
      const scopeId = blockScopeId();
      const result = payload.build(currentScope(), canvasSelection, scopeId ? `block:${scopeId}` : "document");
      if (result.error) setHint(result.error, "error");
      return result.payload;
    }
    const session = window.ClipboardSession.create({ pasteOffsetScreenPx,
      onCopyStored: () => { imageClipboard.markCopy(); updateToolbar(); }, deleteSelection });
    const geometry = window.ClipboardGeometry.create({
      geometryIds, ensureLineMinimumLength, normalizeArcSweep, blockDefinitionById,
      allocateBlockInstanceId: () => documentIds.allocate("blockInstance"),
      allocateGeometryInstanceId: type => type === "sketchProjection" ? documentIds.allocate("sketchProjection") : type === "mirror" ? documentIds.allocate("mirror") : documentIds.allocate("pattern"),
      normalizeGeometryInstance, copiedGeometryInstance: transfer.copiedGeometryInstance, applicationText,
    });
    const checkpoint = window.ClipboardPasteCheckpoint.create({ geometryIds,
      captureSequences: () => documentIds.snapshot(["annotation", "hatch", "referenceImage", "sketchProjection", "mirror", "pattern", "free", "blockInstance"]),
      restoreSequences: documentIds.restore,
    });
    const graph = window.ClipboardGraph.create({ geometry, transfer, parameters,
      elementIds: { hatch: () => documentIds.allocate("hatch"), annotation: () => documentIds.allocate("annotation"),
        image: () => documentIds.allocate("referenceImage"), nextHatchIndex: () => documentIds.peek("hatch") },
      deserializeConstraint, invalidateProjection, applicationText,
    });
    const command = window.ClipboardCommand.create({ session, graph, checkpoint, selection: canvasSelection,
      isGeometryMode, buildCopyPayload: copyableSelectionPayload, blockDefinitionScopeError,
      canCreate: () => { if (canCreateInActiveSketch()) return true; guardSketchEdit(activeSketchId(), "create"); return false; },
      currentTarget: () => ({ model: currentScope(), sketchId: activeSketchId(), scale: viewport.scale }),
      parameterTarget: () => ({ namespace: currentParameterNamespace(), namespaceKey: blockScopeId() ? `block:${blockScopeId()}` : "document" }),
      clearSelection, finishPaste: () => { selectMode(); solveAndRefresh("貼り付け"); },
      recoverView: () => { invalidateProjection(); clearSelection(); updateUI(); draw(); }, sketchName, setHint, updateToolbar,
    });
    return Object.freeze({ session, command, copyableSelectionPayload,
      canOfferCopy: () => payload.canOfferCopy(currentScope(), canvasSelection) });
  }
  // Clipboard models follow the activated editing scope; Parameters follow Workspace scope.
  function createForEditing({ documentWorkspace, editingScope, readServices, interaction, geometry, annotationRenderer,
    references, annotationLeaderAnchor, viewport, serializeConstraint, decorateSerializedConstraint, normalizeGeometryInstance,
    deserializeConstraint, blockScopeId, blockDefinitionScopeError, presentation, pasteOffsetScreenPx, imageClipboard,
    updateToolbar, deleteSelection, isGeometryMode, clearSelection, solveAndRefresh }) {
    const { workspace, sketches, geometryIds, documentIds, parameters } = documentWorkspace;
    const { blockProjectionBundle, blockProjectionLocalId, invalidateBlockProjectionCache } = readServices.projections;
    const { resolveGeometryRef, geometryInstanceBundle } = readServices.reads;
    const { geometryInstanceSourcePoints } = readServices.instances, { blockDefinitionById } = readServices.catalog;
    const { effectiveAnnotationStyle } = readServices.annotationAppearance;
    const { annotationTextLayout, annotationTextMetrics, annotationLeaderDisplayGeometry } = annotationRenderer;
    const { ensureLineMinimumLength, normalizeArcSweep } = geometry, { constraintGraphNodes } = references;
    const { activeSketchId, sketchName } = sketches, { canCreateInActiveSketch, guardSketchEdit } = interaction.access;
    const { settings: { applicationText }, setHint, updateUI, draw } = presentation;
    const { serializeGeometryInstance } = window.DocumentSnapshot;
    return create({ blockProjectionBundle, blockProjectionLocalId, resolveGeometryRef, geometryInstanceSourcePoints, geometryInstanceBundle,
      applicationText, annotationTextLayout, annotationTextMetrics, annotationLeaderDisplayGeometry, annotationLeaderAnchor, effectiveAnnotationStyle,
      viewport, serializeGeometryInstance, constraintGraphNodes, serializeConstraint, decorateSerializedConstraint,
      currentScope: () => editingScope.current, canvasSelection: interaction.selection, blockScopeId, setHint,
      pasteOffsetScreenPx, imageClipboard, updateToolbar, deleteSelection, geometryIds, ensureLineMinimumLength, normalizeArcSweep,
      blockDefinitionById, documentIds, normalizeGeometryInstance, parameters, deserializeConstraint, invalidateProjection: invalidateBlockProjectionCache,
      isGeometryMode, blockDefinitionScopeError, canCreateInActiveSketch, guardSketchEdit, activeSketchId, currentParameterNamespace: workspace.current,
      clearSelection, selectMode: interaction.lifecycle.selectMode, solveAndRefresh, updateUI, draw, sketchName });
  }
  window.ClipboardFeature = Object.freeze({ create, createForEditing });
})();
