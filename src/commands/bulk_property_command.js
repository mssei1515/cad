/* Apply a property to supported selected items with one commit and refresh. */
(() => {
  "use strict";
  function create({ guardSketchProjectionShapeEdit, applicationText, updatePropertiesUI, draw,
    multiplePropertySupports, applyAnnotationStyleValue, normalizeHatchAppearance, applyAppearanceInput,
    invalidateBlockProjectionCache, synchronizeSketchProjectionMetadata, recordHistory, updateUI }) {
    function applyMultipleProperty(target, key, rawValue, { commit = true } = {}) {
      if (target?.kind !== "multiple" || !key) return false;
      const geometryItems = (target.items || []).filter((entry) => entry.kind === "geometry").map((entry) => entry.item);
      if (key === "construction" && !guardSketchProjectionShapeEdit(geometryItems, {
        includeSharedNodes: false,
        action: applicationText("通常／補助作図切替", "Construction toggle"),
      })) {
        updatePropertiesUI();
        draw();
        return false;
      }
      for (const entry of target.items || []) {
        if (!multiplePropertySupports(entry, key)) continue;
        if (key === "construction") {
          entry.item.construction = Boolean(rawValue);
          continue;
        }
        if (entry.kind === "annotation") {
          if (key === "visible") entry.item.visible = rawValue === true || rawValue === "true";
          else if (key === "rotation") entry.item.rotation = Math.max(-3600, Math.min(3600, Number(rawValue) || 0)) * Math.PI / 180;
          else applyAnnotationStyleValue(entry.item, key, rawValue);
          continue;
        }
        if (entry.kind === "hatch") {
          const next = { ...entry.item.appearance };
          if (key === "visible") next.visible = rawValue === true || rawValue === "true";
          else if (["angle", "spacing", "lineWidth"].includes(key)) next[key] = Number(rawValue);
          else if (key === "opacity") next.opacity = Number(rawValue) / 100;
          else next[key] = rawValue;
          entry.item.appearance = normalizeHatchAppearance(next);
          continue;
        }
        const owner = entry.kind === "block" ? (entry.item.appearanceOverride ||= {}) : (entry.item.appearance ||= {});
        applyAppearanceInput(owner, key, typeof rawValue === "boolean" ? String(rawValue) : String(rawValue));
        if (entry.kind === "block") invalidateBlockProjectionCache(entry.item.id);
      }
      if (key === "construction") synchronizeSketchProjectionMetadata();
      if (commit) {
        recordHistory("複数Objectプロパティ変更");
        updateUI();
      }
      draw();
      return true;
    }

    return Object.freeze({ apply: applyMultipleProperty });
  }
  window.BulkPropertyCommand = Object.freeze({ create });
})();
