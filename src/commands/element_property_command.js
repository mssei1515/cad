/* Edit element properties that do not require solving geometry constraints. */
(() => {
  "use strict";
  function create({ recordHistory, updateUI, updatePropertiesUI, draw }) {
    function applyReferenceImageProperty(item, key, rawValue) {
      if (!item || !key) return false;
      if (key === "name") item.name = String(rawValue || "").trim() || item.name;
      else if (key === "visible") item.visible = Boolean(rawValue);
      else if (key === "locked") item.locked = Boolean(rawValue);
      else if (key === "opacity") {
        const value = Number(rawValue);
        if (!Number.isFinite(value)) return false;
        item.opacity = Math.max(0, Math.min(1, value / 100));
      }
      else if (item.locked) return false;
      else if (key === "x" || key === "y") {
        const value = Number(rawValue);
        if (!Number.isFinite(value)) return false;
        item[key] = value;
      } else if (key === "width") {
        const value = Number(rawValue);
        if (!Number.isFinite(value) || value <= 0) return false;
        item.scale = value / item.pixelWidth;
      } else if (key === "rotation") {
        const value = Number(rawValue);
        if (!Number.isFinite(value)) return false;
        item.rotation = value * Math.PI / 180;
      }
      else return false;
      return true;
    }

    function referenceImage(item, key, value, { commit = true } = {}) {
      const changed = applyReferenceImageProperty(item, key, value);
      if (commit && changed) {
        recordHistory("画像プロパティ変更");
        updateUI({ refreshAnalysis: false });
      }
      if (!commit || changed) draw();
      return changed;
    }

    function annotation(item, key, value, { commit = true } = {}) {
      if (key === "annotation-visible") item.visible = value;
      if (key === "annotation-text") item.text = value;
      if (key === "annotation-rotation") item.rotation = Math.max(-3600, Math.min(3600, commit ? Number(value) || 0 : Number(value))) * Math.PI / 180;
      if (commit) {
        recordHistory("注記変更");
        updateUI();
      }
      draw();
    }

    function geometryInstance(item, key, rawValue, { commit = true } = {}) {
      if (!commit) {
        const value = Number(rawValue);
        if (Number.isFinite(value) && value > 0) item[key] = key === "copies" ? Math.min(1000, Math.trunc(value)) : value;
        draw();
        return;
      }
      if (key === "reversed") item.reversed = rawValue;
      else {
        const value = Number(rawValue);
        if (!(value > 0)) return void updatePropertiesUI();
        item[key] = key === "copies" ? Math.min(1000, Math.trunc(value)) : value;
      }
      recordHistory("派生インスタンス設定変更");
      updateUI({ refreshAnalysis: false });
      draw();
    }
    return Object.freeze({ referenceImage, annotation, geometryInstance });
  }
  window.ElementPropertyCommand = Object.freeze({ create });
})();
