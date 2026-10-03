/* Own the construction preference and selected-geometry construction toggle. */
(() => {
  "use strict";
  function create({ cancelConstraintTargetCommand, selectedConstructionTogglePrimitives, guardSketchProjectionShapeEdit, applicationText,
    synchronizeSketchProjectionMetadata, setHint, clearSelection, updateUI, draw, recordHistory,
    setLineMode, resetLineInputs, clearSnap, updateToolbar }) {
    let enabled = false;
    function toggle() {
      cancelConstraintTargetCommand("");
      const primitives = selectedConstructionTogglePrimitives();
      if (primitives.length > 0) {
        if (!guardSketchProjectionShapeEdit(primitives, {
          includeSharedNodes: false,
          action: applicationText("通常／補助作図切替", "Construction toggle"),
        })) {
          draw();
          return;
        }
        const next = !primitives.every((item) => item.construction);
        for (const item of primitives) item.construction = next;
        synchronizeSketchProjectionMetadata();
        setHint(next ? "選択図形を補助作図にしました" : "選択図形を通常作図にしました");
        clearSelection();
        updateUI();
        draw();
        recordHistory("補助線切替");
        return;
      }
      setLineMode();
      enabled = !enabled;
      resetLineInputs();
      clearSnap();
      updateToolbar();
      setHint(enabled ? "補助線作図: 端点位置をクリックしてください" : "通常線作図に戻しました");
      draw();
    }
    function constructionToggleState(geometryMode) {
      if (!geometryMode) return { active: false, mixed: false };
      const primitives = selectedConstructionTogglePrimitives();
      if (primitives.length > 0) {
        const constructionCount = primitives.filter((item) => item.construction).length;
        return {
          active: constructionCount === primitives.length,
          mixed: false,
        };
      }
      return { active: enabled, mixed: false };
    }


    return Object.freeze({ toggle, state: constructionToggleState, restore: value => { enabled = value; }, get enabled() { return enabled; } });
  }
  window.ConstructionCommand = Object.freeze({ create });
})();
