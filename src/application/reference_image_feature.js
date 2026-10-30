/* Assemble reference-image resources, presentation, interaction and input over shared owners. */
(() => {
  "use strict";
  function create({ canvas, ctx, viewport, document, window: browserWindow, withCanvasState, createImage,
    readImages, currentScope, canvasSelection, readHover, isVisibleValue, isVisibleSketchId, activeSketchId,
    guardSketchEdit, clearSelection, applicationText, setHint, updateUI, draw, clearSnap, hypot2,
    hitReferenceImageAt, formatDisplayNumber, recordHistory, screenToWorld, nextId, canCreateInActiveSketch,
    pasteGeometry, copyGeometry, isGeometryMode, isTextEditingTarget }) {
    const { referenceImageCorners, referenceImageWorldToLocal, referenceImageLocalToWorld } = window.ReferenceImageGeometry;
    const renderer = window.ReferenceImageRenderer.create({ ctx, viewport, withCanvasState, createImage,
      onImageLoad: draw, referenceImageCorners });
    const layer = window.ReferenceImageRenderer.createLayer({ renderer, readImages, canvasSelection, readHover,
      isVisibleValue, isVisibleSketchId, activeSketchId, readCalibrationPoints: () => interaction.calibrationPoints });
    const interaction = window.ReferenceImageInteraction.create({
      canEdit: item => guardSketchEdit(item.sketchId), clearSelection, canvasSelection, applicationText, setHint, updateUI, draw, clearSnap,
      beginPointer: id => { canvas.classList.add("is-dragging"); canvas.setPointerCapture(id); },
      endPointer: id => { canvas.classList.remove("is-dragging"); try { canvas.releasePointerCapture(id); } catch (_) {} },
      viewScale: () => viewport.scale, hypot2, hitReferenceImageAt, referenceImageWorldToLocal, referenceImageLocalToWorld,
      promptDistance: (message, value) => browserWindow.prompt(message, value), formatDisplayNumber, recordHistory,
    });
    const input = window.ReferenceImageInput.create({ document, window: browserWindow, applicationText,
      canvas, viewport, screenToWorld, currentScope, activeSketchId, nextId, canCreateInActiveSketch, clearSelection, canvasSelection,
      updateUI, draw, recordHistory, setHint, pasteGeometry, copyGeometry, isGeometryMode, isTextEditingTarget });
    function prepareImages() {
      return renderer.ready(readImages().filter(item => isVisibleValue(item.visible) && isVisibleSketchId(item.sketchId)));
    }
    return Object.freeze({ renderer, layer, interaction, input, prepareImages });
  }
  function createForWorkspace({ canvas, ctx, viewport, document, window: browserWindow, withCanvasState, createImage,
    documentWorkspace, editingScope, interaction, presentation, appearance, clearSelection, clearSnap,
    hitReferenceImageAt, recordHistory, pasteGeometry, copyGeometry, isGeometryMode, isTextEditingTarget }) {
    const { workspace, sketches, documentIds } = documentWorkspace;
    const { selection: canvasSelection, hover, access } = interaction;
    const { settings: { applicationText }, setHint, updateUI, draw } = presentation;
    return create({
      canvas, ctx, viewport, document, window: browserWindow, withCanvasState, createImage,
      readImages: () => editingScope.current.referenceImages, currentScope: workspace.current, canvasSelection, readHover: () => hover.current,
      isVisibleValue: appearance.isVisibleValue, isVisibleSketchId: appearance.isVisibleSketchId, activeSketchId: sketches.activeSketchId,
      guardSketchEdit: access.guardSketchEdit, clearSelection, applicationText, setHint, updateUI, draw, clearSnap, hypot2: window.GeometrySolver.hypot2,
      hitReferenceImageAt, formatDisplayNumber: window.NumberDisplay.formatDisplayNumber, recordHistory, screenToWorld: viewport.screenToWorld,
      nextId: () => documentIds.allocate("referenceImage"), canCreateInActiveSketch: access.canCreateInActiveSketch,
      pasteGeometry, copyGeometry, isGeometryMode, isTextEditingTarget,
    });
  }
  window.ReferenceImageFeature = Object.freeze({ create, createForWorkspace });
})();
