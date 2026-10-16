/* Compose Offset planning, creation, input and preview around existing state owners. */
(() => {
  "use strict";
  function create({ currentScope, geometry, ids, placement, sourceSelection, selection, pending, preview, valueInput,
    viewport, ctx, withCanvasState, drawDimension, readMode, minLineLength, minArcLength,
    commitNewConstraint, offsetChainErrorText, applicationText, cancelConstraintTargetCommand, cancelPendingCommand,
    clearSnap, clearSelection, prepareStart, setHint, updateUI, draw, updateToolbar, updateGeometrySelectionUI, invalidateAnalysis }) {
    const types = window.GeometrySolver, kernel = window.GeometryKernel;
    const { Line, Circle, Arc } = types;
    const { normalizeAppearance } = window.Appearance;
    const { offsetPairSign } = window.DimensionQueries;
    const { formatDisplayNumber, formatDimensionLabel } = window.NumberDisplay;
    const plans = window.OffsetGeometry.create({ types, kernel, buildOffsetChainGeometry: window.OffsetChainEngine.build });
    const construction = window.OffsetConstruction.create({
      currentScope, geometryIds: ids, geometry, plans, placement, types, kernel,
      commitNewConstraint, normalizeAppearance, offsetPairSign, offsetChainErrorText,
      applicationText, setHint, updateUI, draw, invalidateAnalysis, minLineLength, minArcLength,
    });
    const command = window.OffsetCommand.create({
      cancelConstraintTargetCommand, cancelPendingCommand, clearSnap, updateUI, Arc,
      selectedGeometry: () => [...selection.lines, ...selection.circles, ...selection.arcs],
      prepareStart, addOffsetChainGeometry: sourceSelection.add,
      getPending: pending.read, setPending: pending.replace,
      plans, construction, placement, offsetSelection: sourceSelection,
      viewport, Line, Circle, minOrientationLength: kernel.MIN_ORIENTATION_LENGTH, offsetPairSign,
      offsetChainErrorText, formatDisplayNumber, formatDimensionLabel, setHint, updateToolbar,
      syncDimensionValueInput: valueInput.sync, focusDimensionValueInput: valueInput.focus, hideDimensionValueInput: valueInput.hide, draw,
      clearPointerPreview: () => { preview.setPointer(null); }, clearSelection,
      setPointerPreview: value => { preview.setPointer(value); },
      syncOffsetChainSelection: () => { selection.applyOffsetSelection(sourceSelection); },
      applicationText, updateGeometrySelectionUI,
    });
    const renderer = window.OffsetPreviewRenderer.create({ ctx, viewport, withCanvasState, Line, Circle, drawDimension, formatDimensionLabel });
    const previewLayer = window.OffsetPreviewRenderer.createLayer({ renderer, readMode, readPointer: () => preview.pointer, command });
    function chainDraft(entries, distance, side, closed = sourceSelection.isClosed(entries)) {
      return plans.offsetChainDraft(entries, distance, side, closed);
    }
    return Object.freeze({ plans, command, previewLayer, createGeometry: construction.createOffsetGeometry, chainDraft });
  }
  window.OffsetFeature = Object.freeze({ create });
})();
