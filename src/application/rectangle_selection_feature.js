/* Connect rectangle queries and selection paths around the existing drag session. */
(() => {
  "use strict";
  function create({ currentScope, viewport, canvasSelection, selectionScope, sketches, pointUsage, appearance,
    geometryReads, projections, hatches, dimensionBounds, annotationBounds, hatchAppearanceForDisplay,
    readMode, instanceSourceCommand, geometryInstanceCommand, sketchProjection,
    releasePointer, clearSelection, setHint, updateGeometrySelectionUI, draw }) {
    const { pointInRect, lineIntersectsRect, bboxInRect, lineBBox, primitiveBBox, bboxIntersectsRect,
      mergeBounds, splineBBox, rectFromPoints } = window.GeometryBounds;
    const { arcSamplePoints } = window.GeometryKernel;
    const { hypot2 } = window.GeometrySolver;
    const { resolvedLoopBounds } = window.HatchRegionEngine;
    const { referenceImageBounds } = window.ReferenceImageGeometry;
    const { activeSketchId, elementSketchId, isActiveSketchElement } = sketches;
    const { isExplicitPoint, isReferencePoint } = pointUsage;
    const viewScale = () => viewport.scale;
    const isVisibleSketchElement = (...args) => appearance.isVisibleSketchElement(...args);
    const isVisibleSketchId = (...args) => appearance.isVisibleSketchId(...args);
    const isVisibleValue = (...args) => appearance.isVisibleValue(...args);
    const query = window.RectangleSelectionQuery.create({
      currentScope, selectableSketchElement: item => isActiveSketchElement(item) && isVisibleSketchElement(item),
      isExplicitPoint, isReferencePoint, pointInRect, lineIntersectsRect, bboxInRect, lineBBox,
      isVisibleSketchElement, primitiveBBox, bboxIntersectsRect, arcSamplePoints, viewScale,
      isEditableSketchId: id => id === activeSketchId(), isVisibleSketchId,
      blockProjectionBundle: projections.blockProjectionBundle, geometryInstanceBundle: geometryReads.geometryInstanceBundle,
      mergeBounds, splineBBox, annotationBounds, resolvedLoopBounds, resolvedHatchBoundary: hatches.resolvedHatchBoundary,
      activeSketchId, hatchAppearanceForDisplay, referenceImageBounds, isVisibleValue, dimensionSelectionBounds: dimensionBounds.read,
    });
    const { select: selectByRect } = window.CanvasSelectionInteraction.createRectangleSelection({
      canvasSelection, selectionSketchId: (...args) => selectionScope.selectionSketchId(...args), activeSketchId, query,
    });
    const { add: addInstanceSourcesByRect } = window.InstanceCommandInput.createRectangleSources({
      getMode: readMode, instanceSourceCommand, geometryInstanceCommand, geometryReads, query,
      sketchProjectionEntriesByRect: sketchProjection.sketchProjectionEntriesByRect,
      elementSketchId, activeSketchId, isVisibleSketchElement,
    });
    const rectangle = window.SelectionRectangle.create({
      rectFromPoints, hypot2, viewScale, releasePointer, clearSelection, selectByRect,
      addSketchProjectionSourcesByRect: sketchProjection.command.addByRect, addInstanceSourcesByRect,
      setHint, updateGeometrySelectionUI, draw,
    });
    return Object.freeze({ query, rectangle });
  }
  window.RectangleSelectionFeature = Object.freeze({ create });
})();
