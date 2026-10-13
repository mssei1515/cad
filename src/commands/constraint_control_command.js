/* Route constraint control activation through existing annotation, constraint and fixed-state owners. */
(() => {
  "use strict";
  function create({ constraintTargetSession, cancelConstraintTargetCommand, constraintLabel, startAnnotationAnchorConstraint, startConstraintTargetCommand, canApplyConstraint, startDistanceCommand, cancelPendingCommand, updateToolbar, updateConstraintButtons, addConstraint, isGeometryMode, hasSelection, toggleSelectedFixed }) {
    function activate(type) {
      if (constraintTargetSession.command?.type === type) {
        cancelConstraintTargetCommand(`${constraintLabel(type)}の対象選択をキャンセルしました`);
      } else if (startAnnotationAnchorConstraint(type)) {
        return;
      } else if (type === "symmetry") {
        startConstraintTargetCommand(type);
      } else if (canApplyConstraint(type)) {
        cancelConstraintTargetCommand("");
        if (type === "distance") startDistanceCommand();
        else {
          cancelPendingCommand("");
          constraintTargetSession.replaceCommand({ type });
          updateToolbar();
          updateConstraintButtons();
          addConstraint(type);
        }
      } else {
        startConstraintTargetCommand(type);
      }
    }
    function activateFixed() {
      if (!isGeometryMode()) return;
      if (startAnnotationAnchorConstraint("fixed")) return;
      if (constraintTargetSession.command?.type === "fixed") {
        cancelConstraintTargetCommand();
      } else if (!hasSelection()) {
        startConstraintTargetCommand("fixed");
      } else {
        toggleSelectedFixed();
      }
    }
    return Object.freeze({ activate, activateFixed });
  }
  window.ConstraintControlCommand = Object.freeze({ create });
})();
