/* Coordinate dimension input presentation and keyboard editing; delegate model commands. */
(() => {
  "use strict";
  function create({ view, enabled = true, getPending, dimensionLayout, worldToCanvasScreen,
    effectiveDimensionAppearance, constraintSketchId, activeSketchId, dimensionTextOffset,
    evaluateDimensionExpressionDraft, expressionFromUserInput, cancelPendingCommand,
    startDistanceValueInput, defaultDimensionForTarget, submitOffsetValue, submitDistanceValue,
    applicationText, setHint, draw }) {
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
    function updateDistanceBufferLabel() {
      const pendingCommand = getPending();
      if (!pendingCommand || !["distance-value", "offset-value"].includes(pendingCommand.type)) return;
      setHint(pendingCommand.type === "offset-value" ? "オフセット距離を入力中: Enter/ダブルクリックで決定、Escでキャンセル" : applicationText("寸法値を入力中: 数式は = から開始し、Parameter参照はダブルクオーテーションで括ります。Canvas寸法のクリックで参照を挿入できます", "Editing dimension: begin expressions with = and enclose parameter references in double quotes. Click a canvas dimension to insert a reference."));
      syncDimensionValueInput();
      draw();
    }

    function handleDistanceKey(e) {
      const pendingCommand = getPending();
      if (!pendingCommand || !["distance-place", "distance-value", "offset-value"].includes(pendingCommand.type)) return false;
      if (e.key === "Escape") {
        e.preventDefault();
        cancelPendingCommand("寸法入力をキャンセルしました");
        return true;
      }
      if (pendingCommand.type === "distance-place" && e.key === "Enter") {
        e.preventDefault();
        startDistanceValueInput(pendingCommand.pointer || defaultDimensionForTarget(pendingCommand.target));
        return true;
      }
      if (!["distance-value", "offset-value"].includes(pendingCommand.type)) return false;
      if (e.key === "Enter") {
        e.preventDefault();
        if (pendingCommand.type === "offset-value") submitOffsetValue();
        else submitDistanceValue();
        return true;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        pendingCommand.buffer = pendingCommand.buffer.slice(0, -1);
        pendingCommand.editing = true;
        updateDistanceBufferLabel();
        return true;
      }
      if (e.key === "Delete") {
        e.preventDefault();
        pendingCommand.buffer = "";
        pendingCommand.editing = true;
        updateDistanceBufferLabel();
        return true;
      }
      if (/^[0-9.]$/.test(e.key)) {
        e.preventDefault();
        if (!pendingCommand.editing) {
          pendingCommand.buffer = "";
          pendingCommand.editing = true;
        }
        if (e.key === "." && pendingCommand.buffer.includes(".")) return true;
        pendingCommand.buffer += e.key;
        updateDistanceBufferLabel();
        return true;
      }
      return false;
    }

    return Object.freeze({ handleKey: handleDistanceKey, updateBufferLabel: updateDistanceBufferLabel, hide: hideDimensionValueInput, sync: syncDimensionValueInput, focus: focusDimensionValueInput });
  }
  window.DimensionInputController = Object.freeze({ create });
})();
