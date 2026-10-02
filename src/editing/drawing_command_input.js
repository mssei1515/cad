/* Route ordinary authoring clicks after higher-priority input consumers. */
(() => {
  "use strict";
  function create({ getMode, rejectRootSketchCreation, pointCommand, handleLineClick, handleCenterlineClick, handleCircleCenterCrossClick, handleRectangleClick, handleSlotClick, handleFilletClick, handleCircleClick, handleArcClick, handleThreePointArcClick, handleSplineClick, executeTrimAt, offsetCommand }) {
    function click(e, p, { hitP, hitL, hitC, hitA }) {
      if (["point", "line", "centerline", "circle-center-cross", "rectangle", "slot", "circle", "arc", "three-point-arc", "spline", "fillet", "trim", "offset", "block-place", "hatch", "hatch-repair"].includes(getMode()) && rejectRootSketchCreation()) {
        e.preventDefault();
        return true;
      }

      if (getMode() === "point") {
        pointCommand.click(p);
        return true;
      }

      if (getMode() === "line") {
        handleLineClick(p, e.shiftKey);
        return true;
      }

      if (getMode() === "centerline") {
        handleCenterlineClick(p, hitP, hitL);
        return true;
      }

      if (getMode() === "circle-center-cross") {
        handleCircleCenterCrossClick(hitC);
        return true;
      }

      if (getMode() === "rectangle") {
        handleRectangleClick(p);
        return true;
      }

      if (getMode() === "slot") {
        handleSlotClick(p);
        return true;
      }

      if (getMode() === "fillet") {
        handleFilletClick(hitL, p);
        return true;
      }

      if (getMode() === "circle") {
        handleCircleClick(p);
        return true;
      }

      if (getMode() === "arc") {
        handleArcClick(p);
        return true;
      }

      if (getMode() === "three-point-arc") {
        handleThreePointArcClick(p);
        return true;
      }

      if (getMode() === "spline") {
        handleSplineClick(p);
        return true;
      }

      if (getMode() === "trim") {
        executeTrimAt(p);
        return true;
      }

      if (getMode() === "offset") {
        offsetCommand.click(p, { hitL, hitA, hitC });
        return true;
      }

      return false;
    }
    return Object.freeze({ click });
  }
  window.DrawingCommandInput = Object.freeze({ create });
})();
