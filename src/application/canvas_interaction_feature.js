/* Assemble Canvas interaction owners in stages without copying their operation state. */
(() => {
  "use strict";
  function create({ sketches, readServices, constraintReferencesPoint, editedFitPoints, isGeometryMode,
    setHint, applicationText, clearSnap, clearPointerPreview, clearSelection, updateGeometrySelectionUI, draw }) {
    const lifecycle = window.DrawOperationLifecycle.createSession();
    const selectionFeature = window.CanvasSelectionFeature.createEditing({ sketches, isGeometryMode, setHint, applicationText,
      clearSnap, clearPointerPreview, clearSelection, updateGeometrySelectionUI, draw });
    const pointUsage = readServices.createPointUsage({ constraintReferencesPoint, editedFitPoints });
    const hover = window.CanvasHover.create({ isEndpointPoint: pointUsage.isEndpointPoint });
    function createOperationSessions({ snapForDrawing, linePreviewPoint, readCenterline, projectPointToCenterlineSupport,
      readOffsetSelection, computeTrimPreview, hits, clearPlacement, cancelAnnotation, cancelPngExport, resetOffset,
      hideInput, updateToolbar, updateConstraintButtons, acceptTarget }) {
      const { Point, Line, Circle, Arc } = window.GeometrySolver;
      const preview = window.DrawingPreview.create({ types: { Point, Line, Circle, Arc }, canvasHover: hover,
        canCreateInActiveSketch: selectionFeature.access.canCreateInActiveSketch, clearSnap, snapForDrawing, draw,
        linePreviewPoint, readCenterline, projectPointToCenterlineSupport, readOffsetSelection, computeTrimPreview, hits });
      const pending = window.PendingCommandSession.create({ clearPlacement, cancelAnnotation, cancelPngExport, resetOffset,
        clearPreviewPointer: () => preview.setPointer(null), hideInput, setHint, updateToolbar, updateConstraintButtons, draw });
      const targets = window.ConstraintTargetSession.create({ acceptTarget });
      const pointer = window.PointerInteractionController.createSession();
      function createSelectionPresentation({ projections, constraintReferences }) {
        return selectionFeature.createPresentation({ hover, constraintTargets: targets, pointer, projections, constraintReferences, clearSnap });
      }
      return Object.freeze({ preview, pending, targets, pointer, createSelectionPresentation });
    }
    return Object.freeze({ lifecycle, selectionFeature, selection: selectionFeature.selection, scope: selectionFeature.scope,
      identity: selectionFeature.identity, access: selectionFeature.access, pointUsage, hover, createOperationSessions });
  }
  window.CanvasInteractionFeature = Object.freeze({ create });
})();
