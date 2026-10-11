/* Toggle selection visibility with one history entry; selection and appearance queries are injected. */
(() => {
  "use strict";
  function create({ isGeometryMode, selectedVisibilityTargets, selectionVisibilityIsHidden,
    toggleSketchVisibility, guardSelectionEdit, applyMultipleProperty, applyAppearance, recordHistory, updateUI, draw }) {
    function toggle() {
      if (!isGeometryMode()) return;
      const targets = selectedVisibilityTargets();
      if (targets.length === 0) return;
      if (targets[0].kind === "sketch") return toggleSketchVisibility(targets[0].item.id);
      if (!guardSelectionEdit()) return;
      const visible = selectionVisibilityIsHidden(targets);
      const ordinaryTargets = targets.filter(target => target.kind !== "geometryInstance");
      if (ordinaryTargets.length) applyMultipleProperty({ kind: "multiple", items: ordinaryTargets }, "visible", visible, { commit: false });
      for (const target of targets.filter(target => target.kind === "geometryInstance")) {
        applyAppearance(target, { category: "appearance", key: "visible", value: String(visible) }, { commit: false });
      }
      recordHistory("選択図形の表示切替");
      updateUI();
      draw();
    }

    return Object.freeze({ toggle });
  }
  window.SelectionVisibilityCommand = Object.freeze({ create });
})();
