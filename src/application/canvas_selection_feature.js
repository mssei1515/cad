/* Assemble selection owners before connecting their later presentation/reset dependencies. */
(() => {
  "use strict";
  function createOwners() {
    const selection = window.CanvasSelection.create();
    const scope = window.CanvasSelection.createScopeQuery({ canvasSelection: selection, selectedGeometryItems: selection.selectedGeometryItems });
    return { selection, scope };
  }
  function create({ sketches, guardSketchEdit, clearSelection, updateGeometrySelectionUI, draw }) {
    return assemble({ ...createOwners(), sketches, guardSketchEdit, clearSelection, updateGeometrySelectionUI, draw });
  }
  function createEditingFeature({ sketches, isGeometryMode, setHint, applicationText, clearSnap, clearPointerPreview,
    clearSelection, updateGeometrySelectionUI, draw }, ownsClearing) {
    const { selection, scope } = createOwners();
    const access = window.SketchCommand.createEditAccess({ activeSketchId: sketches.activeSketchId, canEditSketch: sketches.canEditSketch,
      sketchById: sketches.sketchById, selectionItems: scope.selectionItems, elementSketchId: sketches.elementSketchId,
      isGeometryMode, setHint, applicationText, clearSnap, clearPointerPreview, draw });
    const feature = assemble({ selection, scope, sketches, guardSketchEdit: access.guardSketchEdit, clearSelection, updateGeometrySelectionUI, draw }, ownsClearing);
    function createDrawingOrder({ editingScope, ordinarySelectionMode, updateUI, recordHistory }) {
      return window.DrawingOrderCommand.create({ currentScope: () => editingScope.current, canvasSelection: selection,
        activeSketchId: sketches.activeSketchId, selectionSketchId: scope.selectionSketchId, ordinarySelectionMode,
        guardSelectionEdit: access.guardSelectionEdit, updateUI, draw, recordHistory, applicationText, setHint });
    }
    return Object.freeze({ ...feature, access, createDrawingOrder });
  }
  function createEditing(options) { return createEditingFeature(options, false); }
  function createEditingWithOwnedClearing(options) { return createEditingFeature(options, true); }
  function assemble({ selection, scope, sketches, guardSketchEdit, clearSelection: suppliedClearSelection, updateGeometrySelectionUI, draw }, ownsClearing = false) {
    let completedClearing;
    function clearSelection() {
      if (completedClearing === undefined) throw new ReferenceError("Cannot access 'selectionClearing' before initialization");
      return completedClearing.value.clear();
    }
    const clear = ownsClearing ? clearSelection : suppliedClearSelection;
    const identity = window.CanvasSelectionInteraction.createIdentitySelection({
      canvasSelection: selection, selectionSketchId: (...args) => scope.selectionSketchId(...args),
      clearSelection: clear, updateGeometrySelectionUI, draw, sketchById: sketches.sketchById, guardSketchEdit,
    });
    function createConstraintOperands({ targets, pointer, solver, acceptError }) {
      const candidates = window.ConstraintCandidates.create({ sameSketchElements: sketches.sameSketchElements,
        syncLineOrientationHints: () => solver.syncLineOrientationHints?.(), constraintAcceptError: acceptError });
      const operands = window.ConstraintOperands.create({ elementSketchId: sketches.elementSketchId,
        operandRelationForSketch: sketches.operandRelationForSketch, sameArcEndpoint: candidates.sameArcEndpoint,
        Arc: window.GeometrySolver.Arc, lineHasDirection: window.GeometryKernel.lineHasDirection, closestSplinePoint: window.SplineGeometry.closestPoint });
      function fromSelection() { return operands.fromSelection(selection, pointer.lastWorld); }
      function syncSelection() { selection.applyConstraintTargets(candidates.constraintTargetsFromOperands(targets.operands)); }
      return Object.freeze({ candidates, operands, fromSelection, syncSelection });
    }
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
      const result = Object.freeze({ highlight, clearing, documentReset });
      if (ownsClearing) completedClearing = { value: result.clearing };
      return result;
    }
    const feature = { selection, scope, identity, createConstraintOperands, createPresentation };
    if (ownsClearing) feature.clearSelection = clearSelection;
    return Object.freeze(feature);
  }
  window.CanvasSelectionFeature = Object.freeze({ create, createEditing, createEditingWithOwnedClearing });
})();
