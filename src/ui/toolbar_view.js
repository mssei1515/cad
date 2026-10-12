/* Reflect interaction and selection capabilities in toolbar DOM; command execution is caller-owned. */
(() => {
  "use strict";
  function create({ document, isGeometryMode, constructionToggleState, readInteraction, updateHistoryButtons,
    selectedVisibilityTargets, selectionVisibilityIsHidden, canEditTarget, syncFlyouts, updateCursor }) {
    function update() {
      const geometryMode = isGeometryMode();
      const constructionState = constructionToggleState(geometryMode);
      const interaction = readInteraction();
      const { mode } = interaction;
      const states = {
        toolSelect: geometryMode && mode === "select" && !interaction.hasConstraint && !interaction.hasPending,
        toolPoint: geometryMode && mode === "point",
        toolLine: geometryMode && mode === "line",
        toolCenterline: geometryMode && mode === "centerline",
        toolCircleCenterCross: geometryMode && mode === "circle-center-cross",
        toolConstructionLine: constructionState.active,
        toolRectangle: geometryMode && mode === "rectangle",
        toolSlot: geometryMode && mode === "slot",
        toolCreateBlock: false,
        toolFillet: geometryMode && mode === "fillet",
        toolTrim: geometryMode && mode === "trim",
        toolOffset: geometryMode && mode === "offset",
        toolCircle: geometryMode && mode === "circle",
        toolArc: geometryMode && mode === "arc",
        toolThreePointArc: geometryMode && mode === "three-point-arc",
        toolSpline: geometryMode && mode === "spline",
        toolSketchProjection: geometryMode && mode === "sketch-projection",
        toolFreeInstance: geometryMode && mode.startsWith("free-instance-"),
        toolHatch: geometryMode && (mode === "hatch" || mode === "hatch-repair"),
        annotationTextBtn: interaction.annotationDraft,
      };
      for (const [id, active] of Object.entries(states)) {
        const button = document.getElementById(id);
        if (!button) continue;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
        button.setAttribute("aria-disabled", String(!geometryMode));
      }
      for (const id of ["toolCreateBlock"]) {
        const button = document.getElementById(id);
        if (button) button.disabled = !geometryMode;
      }
      updateHistoryButtons();
      const visibilityButton = document.getElementById("selectionVisibilityBtn");
      const visibilityTargets = selectedVisibilityTargets();
      if (visibilityButton) {
        const hidden = selectionVisibilityIsHidden(visibilityTargets);
        visibilityButton.disabled = !geometryMode || visibilityTargets.length === 0 || visibilityTargets.some(target => target.kind !== "sketch"
          && !canEditTarget(target));
        visibilityButton.classList.toggle("active", hidden);
        visibilityButton.setAttribute("aria-pressed", String(hidden));
      }
      syncFlyouts();
      const current = readInteraction();
      updateCursor({ pendingType: current.pendingType, constraintType: current.constraintType,
        splineEditing: current.splineEditing, mode: current.mode });
    }
    return Object.freeze({ update });
  }
  window.ToolbarView = Object.freeze({ create });
})();
