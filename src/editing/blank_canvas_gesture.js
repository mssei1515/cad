/* Own blank double-click recognition and command completion priority. */
(() => {
  "use strict";
  function create({ getMode, getPending, getPendingConstraint, getSplineEditSession, getLineCommand, getTransientAuthoring,
    getTime, hypot2, clearPreview, finalizeSplineFromDoubleClick, finishSplineEditSession, submitDistanceValue, submitOffsetValue, submitAnnotationValue, cancelPendingCommand, isDrawToolMode, exitDrawMode, cancelConstraintTargetCommand, rollbackTransientLineCompletion, clearSnap, clearSelection, setHint, updateUI, draw, cancelActiveDrawOperation, rollbackTransientPoint, hasActiveDrawOperation, hasSelection, updateGeometrySelectionUI }) {
    let blankDoubleClickCandidate = null;
    let suppressNextBlankDoubleClickEvent = false;
    function isBlankCanvasHit(hits = {}) {
      return !hits.hitP &&
        !hits.hitL &&
        !hits.hitC &&
        !hits.hitArcEnd &&
        !hits.hitA &&
        !hits.hitS &&
        !hits.hitD &&
        !hits.hitBlock &&
        !hits.hitDerivedInstance &&
        !hits.hatchHit &&
        !hits.referenceImageHit &&
        !hits.annotationHit &&
        !hits.inactiveHit;
    }

    function isTransientLineStartHit(hits = {}) {
      return getTransientAuthoring().isLineStartHit(hits.hitP, getLineCommand().startPoint);
    }

    function isTransientLineCompletionHit(hits = {}) {
      return getMode() === "line" && getTransientAuthoring().isLineCompletionHit(hits.hitP, getLineCommand().startPoint);
    }

    function isTransientPointCommandHit(hits = {}) {
      return getMode() === "point" && getTransientAuthoring().isPointHit(hits.hitP);
    }

    function isBlankDoubleClickTarget(hits = {}) {
      if (isBlankCanvasHit(hits)) return true;
      if (
        isTransientPointCommandHit(hits) &&
        !hits.hitL &&
        !hits.hitC &&
        !hits.hitArcEnd &&
        !hits.hitA &&
        !hits.hitS &&
        !hits.hitD &&
        !hits.annotationHit &&
        !hits.inactiveHit
      ) {
        return true;
      }
      if (isTransientLineCompletionHit(hits)) {
        return !hits.hitC &&
          !hits.hitArcEnd &&
          !hits.hitA &&
          !hits.hitD &&
          !hits.annotationHit &&
          !hits.inactiveHit;
      }
      return isTransientLineStartHit(hits) &&
        !hits.hitC &&
        !hits.hitArcEnd &&
        !hits.hitA &&
        !hits.hitD &&
        !hits.annotationHit &&
        !hits.inactiveHit;
    }

    function isRepeatedBlankDoubleClick(screen, hits = {}) {
      const now = getTime();
      const repeated = Boolean(
        isBlankDoubleClickTarget(hits) &&
          blankDoubleClickCandidate &&
          now - blankDoubleClickCandidate.time <= 450 &&
          hypot2(screen.x - blankDoubleClickCandidate.x, screen.y - blankDoubleClickCandidate.y) <= 6,
      );
      blankDoubleClickCandidate = isBlankDoubleClickTarget(hits) ? { time: now, x: screen.x, y: screen.y } : null;
      return repeated;
    }

    function handleBlankCanvasDoubleClick(pointer, hits = {}) {
      if (!isBlankDoubleClickTarget(hits)) return false;
      blankDoubleClickCandidate = null;
      if (getMode() === "spline") {
        finalizeSplineFromDoubleClick(pointer);
        return true;
      }
      if (getSplineEditSession()) return finishSplineEditSession();
      if (getPending()?.type === "distance-value") {
        submitDistanceValue();
        return true;
      }
      if (getPending()?.type === "offset-value") {
        submitOffsetValue();
        return true;
      }
      if (getPending()?.type === "annotation-value") {
        submitAnnotationValue();
        return true;
      }
      if (getPending()) {
        cancelPendingCommand();
        if (isDrawToolMode()) exitDrawMode();
        return true;
      }
      if (getPendingConstraint()) {
        cancelConstraintTargetCommand();
        return true;
      }
      if (getMode() === "line") {
        if (isTransientLineCompletionHit(hits)) {
          rollbackTransientLineCompletion();
          getLineCommand().reset();
          clearPreview();
          clearSnap();
          clearSelection();
          setHint("線の作図をキャンセルしました");
          updateUI();
          draw();
        } else if (isTransientLineStartHit(hits) || (getTransientAuthoring().hasLineStart && getLineCommand().startPoint && !getTransientAuthoring().hasLineCompletion)) {
          cancelActiveDrawOperation();
          exitDrawMode();
        } else if (getLineCommand().startPoint) {
          cancelActiveDrawOperation();
          updateUI();
          draw();
        } else {
          exitDrawMode();
        }
        return true;
      }
      if (getMode() === "point") {
        rollbackTransientPoint();
        exitDrawMode();
        return true;
      }
      if (hasActiveDrawOperation()) {
        cancelActiveDrawOperation();
        exitDrawMode();
        return true;
      }
      if (isDrawToolMode()) {
        exitDrawMode();
        return true;
      }
      if (hasSelection()) {
        clearSelection();
        setHint("選択を解除しました");
        updateGeometrySelectionUI();
        draw();
        return true;
      }
      return false;
    }


    return Object.freeze({
      isRepeated: isRepeatedBlankDoubleClick, handle: handleBlankCanvasDoubleClick,
      resetCandidate: () => { blankDoubleClickCandidate = null; },
      suppressNext: () => { suppressNextBlankDoubleClickEvent = true; },
      clearSuppression: () => { suppressNextBlankDoubleClickEvent = false; },
      takeSuppression: () => { const suppressed = suppressNextBlankDoubleClickEvent; suppressNextBlankDoubleClickEvent = false; return suppressed; },
    });
  }
  window.BlankCanvasGesture = Object.freeze({ create });
})();
