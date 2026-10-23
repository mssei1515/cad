/* Assemble inline dimension input without taking ownership of commands or drawing. */
(() => {
  "use strict";
  function create({ input, shell, viewport, syncHighlight, scheduleFrame, pending, display,
    worldToCanvasScreen, effectiveDimensionAppearance, constraintSketchId, activeSketchId,
    evaluateDimensionExpressionDraft, expressionFromUserInput, cancelPendingCommand, startDistanceValueInput,
    submitOffsetValue, submitDistanceValue, applicationText, setHint, draw }) {
    const view = window.DimensionInputView.create({ input, shell,
      screenPxPerMm: window.DimensionMetrics.DIMENSION_SCREEN_PX_PER_MM, syncHighlight, scheduleFrame });
    const controller = window.DimensionInputController.create({
      displayFactor: appearance => window.Appearance.annotationDisplayFactor(appearance, viewport.scale),
      view, enabled: Boolean(input), getPending: pending.read,
      dimensionLayout: (...args) => display.layout(...args), worldToCanvasScreen, effectiveDimensionAppearance,
      constraintSketchId, activeSketchId, dimensionTextOffset: display.layouts.dimensionTextOffset,
      evaluateDimensionExpressionDraft, expressionFromUserInput, cancelPendingCommand, startDistanceValueInput,
      defaultDimensionForTarget: display.placement.defaultDimensionForTarget, submitOffsetValue, submitDistanceValue,
      applicationText, setHint, draw,
    });
    function bind() { controller.bindInput(input); }
    return Object.freeze({ controller, bind });
  }
  window.DimensionInput = Object.freeze({ create });
})();
