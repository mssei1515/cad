/* Route annotation placement and selection without owning annotation or selection state. */
(() => {
  "use strict";
  function create({ getMode, getPending, getPendingConstraint, annotationCommand, canvasSelection, clearSelection, annotationDrag, updateUI, draw }) {
    function place(e, p, annotationTargetHit) {
      if (getPending()?.type === "annotation-text-place") {
        e.preventDefault();
        annotationCommand.commitTextAnnotationAt(p);
        return true;
      }

      if (getPending()?.type === "annotation-leader-select") {
        e.preventDefault();
        annotationCommand.handleLeaderAnnotationTargetClick(annotationTargetHit, p);
        return true;
      }

      if (getPending()?.type === "annotation-leader-place") {
        e.preventDefault();
        annotationCommand.commitLeaderAnnotationAt(p);
        return true;
      }

      return false;
    }
    function select(e, p, { blankAnnotationHit, directGeometryHit, hitD }) {
      if (blankAnnotationHit && !directGeometryHit && !hitD && getMode() === "select" && !getPending() && !getPendingConstraint()) {
        e.preventDefault();
        if (blankAnnotationHit.element.blockProjection) {
          if (!e.ctrlKey && !e.shiftKey) clearSelection();
          if (e.ctrlKey || e.shiftKey) canvasSelection.toggleBlockInstanceSelection(blankAnnotationHit.element.blockInstance);
          else canvasSelection.set("blockInstances", [blankAnnotationHit.element.blockInstance]);
          updateUI({ refreshAnalysis: false });
          draw();
          return true;
        }
        if (e.ctrlKey || e.shiftKey) {
          canvasSelection.toggleById("annotations", blankAnnotationHit.element);
          updateUI({ refreshAnalysis: false });
          draw();
          return true;
        }
        clearSelection();
        annotationDrag.begin(e, blankAnnotationHit, p);
        updateUI({ refreshAnalysis: false });
        draw();
        return true;
      }

      return false;
    }
    return Object.freeze({ place, select });
  }
  window.AnnotationCommandInput = Object.freeze({ create });
})();
