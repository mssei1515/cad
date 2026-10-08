/* Own an existing spline edit session and reversible fit-point mutations. */
(() => {
  "use strict";
  function create({ currentScope, ids, clearSelection, canvasSelection, applicationText, setHint, updateUI, draw, restoreModelState, snapshotModelState, stabilizeActiveParameterNamespace, elementSketchId, invalidateAnalysis, recordHistory, guardSketchProjectionShapeEdit, canEditStructure = () => true, addPoint, isPointUsedByLine, isPointUsedByCircle, isPointUsedByArc, constraintReferencesPoint, guardDimensionSymbolDeletion, geometryElementKey, annotationReferencesRemovedGeometry }) {
    let session = null;
    function beginSplineEditFromDoubleClick(hitS) {
      if (!canEditStructure(hitS)) return false;
      clearSelection();
      canvasSelection.set("splines", [hitS]);
      session = { spline: hitS };
      setHint(applicationText(`${hitS.id} の通過点を編集します。Escまたは空白のダブルクリックで終了します`, `Editing fit points of ${hitS.id}. Press Esc or double-click blank canvas to finish.`));
      updateUI({ refreshAnalysis: false });
      draw();
    }

    function finishSplineEditSession() {
      if (!session) return false;
      session = null;
      setHint(applicationText("スプライン編集を終了しました", "Finished editing the spline."));
      updateUI({ refreshAnalysis: false });
      draw();
      return true;
    }

    function restoreSplineFitPointMutation(snapshot) {
      currentScope().points = snapshot.points;
      currentScope().constraints = snapshot.constraints;
      currentScope().annotations = snapshot.annotations;
      snapshot.spline.fitPoints = snapshot.fitPoints;
      snapshot.spline._curveCache = null;
      ids.restore({ pointSeq: snapshot.pointSeq });
      restoreModelState(snapshot.modelState);
      clearSelection();
      canvasSelection.set("splines", [snapshot.spline]);
      session = { spline: snapshot.spline };
    }

    function splineFitPointMutationSnapshot(spline) {
      return {
        spline,
        fitPoints: spline.fitPoints.slice(),
        points: currentScope().points.slice(),
        constraints: currentScope().constraints.slice(),
        annotations: currentScope().annotations.slice(),
        pointSeq: ids.peek("point"),
        modelState: snapshotModelState(),
      };
    }

    function stabilizeSplineFitPointMutation(snapshot, historyLabel, successMessage, failureMessage) {
      const curveValid = snapshot.spline.curve().valid;
      const stabilized = curveValid ? stabilizeActiveParameterNamespace(elementSketchId(snapshot.spline)) : null;
      if (!curveValid || !stabilized.success || stabilized.dependent?.success === false) {
        restoreSplineFitPointMutation(snapshot);
        setHint(failureMessage, "error");
        updateUI();
        draw();
        return false;
      }
      invalidateAnalysis();
      recordHistory(historyLabel);
      setHint(successMessage);
      updateUI();
      draw();
      return true;
    }

    function addSplineFitPointFromContext(spline, pointer) {
      if (!canEditStructure(spline)) return false;
      if (!session || session.spline !== spline || !currentScope().splines.includes(spline)) return false;
      if (!guardSketchProjectionShapeEdit([spline], { action: applicationText("スプライン通過点追加", "Add spline fit point") })) {
        draw();
        return false;
      }
      const curve = spline.curve();
      const closest = window.SplineGeometry.closestPoint(curve, pointer, { samplesPerSpan: 28 });
      if (!closest?.point || !curve.valid) return false;
      const spanIndex = curve.spans.findIndex((span, index) => closest.t < span.t1 - 1e-9 || index === curve.spans.length - 1);
      if (spanIndex < 0) return false;
      const snapshot = splineFitPointMutationSnapshot(spline);
      const point = addPoint(closest.point.x, closest.point.y, false, "endpoint");
      point.sketchId = elementSketchId(spline);
      spline.fitPoints.splice(spanIndex + 1, 0, point);
      spline._curveCache = null;
      canvasSelection.set("points", [point]);
      canvasSelection.set("splines", []);
      return stabilizeSplineFitPointMutation(
        snapshot,
        "スプライン通過点追加",
        applicationText(`${spline.id} に通過点 ${point.id} を追加しました`, `Added fit point ${point.id} to ${spline.id}.`),
        applicationText("拘束を維持できないため通過点の追加を戻しました", "The fit point addition was restored because its constraints could not be maintained."),
      );
    }

    function deleteSplineFitPointFromContext(spline, point) {
      if (!canEditStructure(spline)) return false;
      if (!session || session.spline !== spline || !spline.fitPoints.includes(point)) return false;
      if (!guardSketchProjectionShapeEdit([spline, point], { action: applicationText("スプライン通過点削除", "Delete spline fit point") })) {
        draw();
        return false;
      }
      if (spline.fitPoints.length <= 3) {
        setHint(applicationText("スプラインには3点以上の通過点が必要です", "A spline requires at least three fit points."), "error");
        return false;
      }
      const usedOutsideSpline =
        isPointUsedByLine(point) ||
        isPointUsedByCircle(point) ||
        isPointUsedByArc(point) ||
        currentScope().splines.some((item) => item !== spline && item.fitPoints.includes(point));
      const removePoint = point.kind === "endpoint" && !usedOutsideSpline;
      const constraintsToRemove = new Set(removePoint ? currentScope().constraints.filter((constraint) => constraintReferencesPoint(constraint, point)) : []);
      if (!guardDimensionSymbolDeletion(constraintsToRemove)) return false;
      const snapshot = splineFitPointMutationSnapshot(spline);
      spline.fitPoints = spline.fitPoints.filter((item) => item !== point);
      spline._curveCache = null;
      if (removePoint) {
        currentScope().points = currentScope().points.filter((item) => item !== point);
        currentScope().constraints = currentScope().constraints.filter((constraint) => !constraintsToRemove.has(constraint));
        const removedIds = new Set([point.id]);
        const removedKeys = new Set([geometryElementKey(point)].filter(Boolean));
        currentScope().annotations = currentScope().annotations.filter((annotation) => !annotationReferencesRemovedGeometry(annotation, removedIds, removedKeys));
        canvasSelection.set("annotations", canvasSelection.annotations.filter((annotation) => currentScope().annotations.includes(annotation)));
      }
      canvasSelection.set("points", []);
      canvasSelection.set("splines", [spline]);
      return stabilizeSplineFitPointMutation(
        snapshot,
        "スプライン通過点削除",
        applicationText(`${spline.id} から通過点 ${point.id} を削除しました`, `Removed fit point ${point.id} from ${spline.id}.`),
        applicationText("拘束を維持できないため通過点の削除を戻しました", "The fit point removal was restored because its constraints could not be maintained."),
      );
    }


    function activate(spline) { if (canEditStructure(spline)) session = { spline }; }
    function reset() { session = null; }
    function forgetDeleted(splines) { if (session && splines.has(session.spline)) reset(); }
    return Object.freeze({ begin: beginSplineEditFromDoubleClick, finish: finishSplineEditSession,
      addPoint: addSplineFitPointFromContext, deletePoint: deleteSplineFitPointFromContext,
      activate, reset, forgetDeleted, get current() { return session; } });
  }
  window.SplineEditCommand = Object.freeze({ create });
})();
