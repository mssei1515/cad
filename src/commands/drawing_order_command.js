/* Selection-aware drawing order queries and completed reorder operations. */
(() => {
  "use strict";
  function create({ currentScope, canvasSelection, activeSketchId, selectionSketchId, ordinarySelectionMode,
    guardSelectionEdit, updateUI, draw, recordHistory, applicationText, setHint }) {
    function selectedDrawingOrderCandidates() {
      return [
        ...canvasSelection.lines, ...canvasSelection.circles, ...canvasSelection.arcs, ...canvasSelection.splines,
        ...canvasSelection.hatches, ...canvasSelection.blockInstances, ...canvasSelection.geometryInstances,
      ];
    }

    function topmostDrawingOrderOwner(items) {
      const active = window.DrawingOrder.topmostOwner(currentScope(), activeSketchId(), items);
      if (active || !ordinarySelectionMode()) return active;
      for (const sketch of [...currentScope().sketches].reverse()) {
        const owner = window.DrawingOrder.topmostOwner(currentScope(), sketch.id, items);
        if (owner) return owner;
      }
      return null;
    }

    function drawingOrderCommandState() {
      return window.DrawingOrder.commandState(currentScope(), selectionSketchId() || activeSketchId(), selectedDrawingOrderCandidates());
    }

    function reorderSelectedDrawingObjects(action) {
      if (!guardSelectionEdit()) return false;
      if (!window.DrawingOrder.reorder(currentScope(), selectionSketchId() || activeSketchId(), selectedDrawingOrderCandidates(), action)) return false;
      updateUI({ refreshAnalysis: false });
      draw();
      recordHistory(applicationText("重なり順変更", "Drawing order changed"));
      setHint(applicationText("同じSketch内の重なり順を変更しました", "Changed drawing order within the active sketch."));
      return true;
    }

    return Object.freeze({ topmostOwner: topmostDrawingOrderOwner, state: drawingOrderCommandState, reorder: reorderSelectedDrawingObjects });
  }
  window.DrawingOrderCommand = Object.freeze({ create });
})();
