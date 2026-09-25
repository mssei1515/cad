/* Connect current dimension input state to its view without owning the command. */
(() => {
  "use strict";
  function create({ view, enabled = true, getPending, dimensionLayout, worldToCanvasScreen,
    effectiveDimensionAppearance, constraintSketchId, activeSketchId, dimensionTextOffset,
    evaluateDimensionExpressionDraft, expressionFromUserInput }) {
    function hideDimensionValueInput() { view.hide(); }

    function syncDimensionValueInput() {
      if (!enabled) return;
      const pendingCommand = getPending();
      if (!pendingCommand || !["distance-value", "offset-value"].includes(pendingCommand.type)) {
        hideDimensionValueInput();
        return;
      }
      const layout = dimensionLayout(pendingCommand.target, pendingCommand.dimension);
      if (!layout?.text) {
        hideDimensionValueInput();
        return;
      }
      const screen = worldToCanvasScreen(layout.text);
      const angle = Number.isFinite(layout.textAngle) ? layout.textAngle : 0;
      const appearance = effectiveDimensionAppearance(pendingCommand.dimension, pendingCommand.constraint ? constraintSketchId(pendingCommand.constraint) : activeSketchId());
      const labelGap = appearance.dimensionTextGap;
      const labelOffset = dimensionTextOffset(angle, labelGap);
      view.render({ screen, angle, labelOffset, textHeight: appearance.dimensionTextHeight, buffer: pendingCommand.buffer });
      let invalid = pendingCommand.buffer === "";
      if (!invalid) {
        try {
          const value = pendingCommand.type === "distance-value"
            ? evaluateDimensionExpressionDraft(pendingCommand.constraint || null, expressionFromUserInput(pendingCommand.buffer))
            : Number(pendingCommand.buffer);
          invalid = !Number.isFinite(value) || value <= 0 || (pendingCommand.target?.kind === "angle" && value >= 180);
        } catch (_error) {
          invalid = true;
        }
      }
      view.setInvalid(invalid);
    }

    function focusDimensionValueInput() {
      view.focus(syncDimensionValueInput);
    }
    return Object.freeze({ hide: hideDimensionValueInput, sync: syncDimensionValueInput, focus: focusDimensionValueInput });
  }
  window.DimensionInputController = Object.freeze({ create });
})();
