/* Compose application keyboard routing, cancellation adapters and listener lifetime. */
(() => {
  "use strict";
  function create({ window: browserWindow, menus, sketchMove, constraintStatusView, dimensionInput, shortcuts,
    readMode, isGeometryMode, instances, projection, referenceImage, splineEditing, blockPlacement, annotationDrag,
    pendingCommandSession, cancelPendingCommand, constraintTargetSession, cancelConstraintTargetCommand,
    drawing, hasSelection, clearSelection, annotation, finishSources, finishSpline, finishProjection, finishHatch,
    removeSplinePoint, offset, readPointer, deleteSelection, completeLineLength, isTextEditingTarget, setHint, updateUI, draw }) {
    const cancel = window.KeyboardInteractionController.createCancellation({
      getMode: readMode, instances, projection, referenceImage, splineEditing, blockPlacement,
      annotationDrag: { active: () => annotationDrag.resizing || annotationDrag.handlesActive,
        cancel: () => { annotationDrag.reset(); updateUI(); draw(); } },
      pending: { active: () => Boolean(pendingCommandSession.current), cancel: cancelPendingCommand },
      constraint: { active: () => Boolean(constraintTargetSession.command), cancel: cancelConstraintTargetCommand },
      drawing,
      selection: { active: hasSelection, clear: () => { clearSelection(); setHint("選択を解除しました"); updateUI(); draw(); } },
    });
    const controller = window.KeyboardInteractionController.create({
      menus, sketchMove, constraintStatusView, dimensionInput, shortcuts,
      operations: { getMode: readMode, isGeometryMode, finishSources, annotation, finishSpline, finishProjection, finishHatch,
        finishInstance: () => instances.finish(), removeSplinePoint, offset, getPointer: readPointer,
        deleteSelection, completeLineLength, cancel },
      isTextEditingTarget,
    });
    let started = false;
    function start() {
      if (started) return;
      started = true;
      browserWindow.addEventListener("keydown", controller.keydown);
    }
    function dispose() {
      if (!started) return;
      browserWindow.removeEventListener("keydown", controller.keydown);
      started = false;
    }
    return Object.freeze({ start, dispose });
  }
  window.KeyboardInput = Object.freeze({ create });
})();
