/* Route application keyboard input without owning document or operation state. */
(() => {
  "use strict";
  // Escape unwinds one operation only; command owners retain their own state.
  function createCancellation({ getMode, instances, projection, referenceImage, splineEditing, blockPlacement,
    pending, constraint, drawing, selection }) {
    return function cancel() {
      if (instances.cancel()) return;
      if (getMode() === "sketch-projection") { projection.cancel(); return; }
      if (referenceImage.calibrating) { referenceImage.cancelCalibration(); return; }
      if (splineEditing.current) { splineEditing.finish(); return; }
      if (getMode() === "block-place") { blockPlacement.finishOrCancel(); return; }
      if (pending.active()) { pending.cancel(); return; }
      if (constraint.active()) { constraint.cancel(); return; }
      if (drawing.active()) { drawing.cancel(); return; }
      if (drawing.isToolMode()) { drawing.exit(); return; }
      if (selection.active()) selection.clear();
    };
  }
  function create({ menus, sketchMove, constraintStatusView, shortcuts, dimensionInput, operations, isTextEditingTarget }) {
    function keydown(e) {
      if (e.key === "Escape" && menus.closeSketch()) { e.preventDefault(); return; }
      if (sketchMove.active) {
        if (e.key === "Escape") sketchMove.cancel();
        else if (e.target.closest?.("#sketchList") && !e.ctrlKey && !e.metaKey && ["Tab", "Enter", " ", "ArrowUp", "ArrowDown"].includes(e.key)) return;
        e.preventDefault(); return;
      }
      if (e.key === "Escape" && menus.canvasVisible()) {
        e.preventDefault();
        menus.closeCanvas();
        return;
      }
      const key = e.key.toLowerCase();
      const commandKey = e.ctrlKey || e.metaKey;
      const textEditingTarget = isTextEditingTarget(e.target);
      if (constraintStatusView.hold(e, textEditingTarget)) return;
      if (commandKey && key === "s") {
        e.preventDefault();
        if (e.repeat) return;
        if (e.shiftKey) void shortcuts.saveAs();
        else void shortcuts.save();
        return;
      }
      if (commandKey && operations.isGeometryMode() && !textEditingTarget && ["c", "x", "v"].includes(key)) {
        e.preventDefault();
        if (key === "c") shortcuts.copy();
        else if (key === "x") shortcuts.copy({ cut: true });
        else shortcuts.paste();
        return;
      }
      if (commandKey && key === "z" && !e.shiftKey) {
        e.preventDefault();
        shortcuts.undo();
        return;
      }
      if (commandKey && (key === "y" || (key === "z" && e.shiftKey))) {
        e.preventDefault();
        shortcuts.redo();
        return;
      }

      if (dimensionInput.handleKey(e)) return;

      if (!textEditingTarget && operations.getMode() === "instance-sources" && ["Enter", "Escape"].includes(e.key)) {
        e.preventDefault();
        operations.finishSources(e.key === "Enter");
        return;
      }

      if (!textEditingTarget && operations.getMode() === "spline" && e.key === "Enter") {
        e.preventDefault();
        operations.finishSpline(false);
        return;
      }

      if (!textEditingTarget && operations.getMode() === "sketch-projection" && e.key === "Enter") {
        e.preventDefault();
        operations.finishProjection();
        return;
      }

      if (!textEditingTarget && (["mirror-axis", "pattern-direction"].includes(operations.getMode()) || operations.getMode().startsWith("free-instance-")) && e.key === "Enter") {
        e.preventDefault();
        operations.finishInstance();
        return;
      }

      if (!textEditingTarget && operations.getMode() === "spline" && e.key === "Backspace") {
        e.preventDefault();
        operations.removeSplinePoint();
        return;
      }

      if (!textEditingTarget && e.key === "Enter" && operations.getMode() === "offset" && operations.offset.canConfirmSelection()) {
        e.preventDefault();
        operations.offset.confirmSelection(operations.getPointer());
        return;
      }

      if (!textEditingTarget && (e.key === "Delete" || e.key === "Backspace") && operations.isGeometryMode() && operations.deleteSelection()) {
        e.preventDefault();
        return;
      }

      if (e.key === "Enter" && operations.completeLineLength()) {
        e.preventDefault();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        operations.cancel();
      }
    }
    return Object.freeze({ keydown });
  }
  window.KeyboardInteractionController = Object.freeze({ create, createCancellation });
})();
