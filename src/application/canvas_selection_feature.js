/* Assemble selection owners before connecting their later presentation/reset dependencies. */
(() => {
  "use strict";
  function create({ sketches, guardSketchEdit, clearSelection, updateGeometrySelectionUI, draw }) {
    const selection = window.CanvasSelection.create();
    const scope = window.CanvasSelection.createScopeQuery({ canvasSelection: selection, selectedGeometryItems: selection.selectedGeometryItems });
    const identity = window.CanvasSelectionInteraction.createIdentitySelection({
      canvasSelection: selection, selectionSketchId: (...args) => scope.selectionSketchId(...args),
      clearSelection, updateGeometrySelectionUI, draw, sketchById: sketches.sketchById, guardSketchEdit,
    });
    function createPresentation({ hover, constraintTargets, pointer, projections, constraintReferences, clearSnap }) {
      const { Point, Line, Circle, Arc, Spline, OffsetChainConstraint } = window.GeometrySolver;
      const { equals: geometryRefsEqual } = window.GeometryRef;
      const { geometryRefForItem } = window.GeometryObjects;
      const { targetFromConstraint } = window.DimensionQueries;
      const highlight = window.SelectionHighlight.create({
        canvasSelection: selection, blockProjectionBundle: projections.blockProjectionBundle,
        geometryRefsEqual, geometryRefForItem, constraintGraphNodes: constraintReferences.constraintGraphNodes,
        types: { Point, Line, Circle, Arc, Spline, OffsetChainConstraint }, effectiveSelectedConstraint: selection.effectiveSelectedConstraint,
        targetFromConstraint, getHoveredDimension: () => hover.current.dimension,
        setHoveredDimension: value => { hover.update({ dimension: value }); }, draw,
      });
      const clearing = window.CanvasSelectionInteraction.createClearing({
        canvasSelection: selection, constraintTargetSession: constraintTargets, canvasHover: hover, selectionHighlight: highlight,
      });
      const documentReset = window.CanvasSelectionInteraction.createDocumentReset({
        canvasSelection: selection, canvasHover: hover, selectionHighlight: highlight, clearPointer: pointer.clearLastPointer, clearSnap,
      });
      return Object.freeze({ highlight, clearing, documentReset });
    }
    return Object.freeze({ selection, scope, identity, createPresentation });
  }
  window.CanvasSelectionFeature = Object.freeze({ create });
})();
