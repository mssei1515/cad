/* Geometry property transactions. Results describe the required UI refresh;
 * DOM controls and rendering remain with the caller. */
(() => {
  "use strict";
  function create({ currentScope, SplineLineTangentConstraint, SplineSplineTangentConstraint,
    guardSketchProjectionShapeEdit, applicationText, synchronizeSketchProjectionMetadata,
    snapshotModelState, restoreModelState, stabilizeActiveParameterNamespace, elementSketchId, recordHistory }) {
    function setConstruction(item, checked) {
      if (!guardSketchProjectionShapeEdit([item], {
        includeSharedNodes: false,
        action: applicationText("通常／補助作図切替", "Construction toggle"),
      })) return { success: false, checked: Boolean(item.construction), refresh: "properties" };
      item.construction = checked;
      synchronizeSketchProjectionMetadata();
      recordHistory("補助線変更");
      return { success: true, refresh: "all" };
    }

    function setSplineClosed(item, checked) {
      if (!guardSketchProjectionShapeEdit([item], {
        action: applicationText("スプライン開閉変更", "Change spline open/closed state"),
      })) return { success: false, checked: Boolean(item.closed), refresh: "properties" };
      if (checked && currentScope().constraints.some(constraint =>
        (constraint instanceof SplineLineTangentConstraint && constraint.spline === item)
        || (constraint instanceof SplineSplineTangentConstraint && (constraint.a === item || constraint.b === item)))) {
        return { success: false, checked: false, message: applicationText("端点接線拘束があるスプラインは閉じられません", "A spline with endpoint tangent constraints cannot be closed.") };
      }
      const snapshot = snapshotModelState();
      const previousClosed = item.closed;
      item.closed = checked;
      item._curveCache = null;
      if (!item.curve().valid) {
        item.closed = previousClosed;
        item._curveCache = null;
        return { success: false, checked: previousClosed, message: applicationText("この通過点配置では開閉状態を変更できません", "The spline cannot change its open/closed state with these fit points.") };
      }
      const stabilized = stabilizeActiveParameterNamespace(elementSketchId(item));
      if (!stabilized.success || stabilized.dependent?.success === false) {
        restoreModelState(snapshot);
        return { success: false, refresh: "all", message: applicationText("拘束を維持できないためスプラインの開閉変更を戻しました", "The spline open/closed change was restored because its constraints could not be maintained.") };
      }
      recordHistory("スプライン開閉変更");
      return { success: true, refresh: "all" };
    }
    return Object.freeze({ setConstruction, setSplineClosed });
  }
  window.GeometryPropertyCommand = Object.freeze({ create });
})();
