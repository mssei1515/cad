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
      function createInputFeature({ clearSnap: inputClearSnap, ...options }) {
        return window.CanvasCommandInputs.createFeature({ ...options,
          readMode: lifecycle.readMode, readPending: pending.read, readPendingConstraint: () => targets.command,
          canvasSelection: selectionFeature.selection, clearSelection, canvasHover: hover, draw,
          updateGeometrySelectionUI, setHint, applicationText, clearSnap: inputClearSnap });
      }
      function bindPointer(inputs, options) {
        return inputs.bindPointer(pointer, { ...options, drawingPreview: preview });
      }
      function bindEditingPointer(inputs, options) {
        return inputs.bindPointerForEditing(pointer, { ...options, drawingPreview: preview, identity: selectionFeature.identity });
      }
      function createKeyboard(inputs, options) {
        return inputs.createKeyboard({ ...options, isGeometryMode, pendingCommandSession: pending, constraintTargetSession: targets,
          drawing: { active: lifecycle.active, cancel: lifecycle.cancel, isToolMode: lifecycle.isToolMode, exit: lifecycle.exit },
          readPointer: pointer.readLastPointer });
      }
      return Object.freeze({ preview, pending, targets, pointer, createSelectionPresentation, createInputFeature, bindPointer, bindEditingPointer, createKeyboard });
    }
    return Object.freeze({ lifecycle, selectionFeature, selection: selectionFeature.selection, scope: selectionFeature.scope,
      identity: selectionFeature.identity, access: selectionFeature.access, pointUsage, hover, createOperationSessions });
  }
  window.CanvasInteractionFeature = Object.freeze({ create });
})();
