/* Coordinates external appearance changes without owning selection or DOM inputs. */
(() => {
  "use strict";
  function create({ editing, normalizeHatchAppearance, normalizeAnnotationStyle,
    invalidateBlockProjectionCache, recordHistory, updateUI, updatePropertiesUI, draw }) {
    function owner(target) {
      if (target.kind === "block" || target.kind === "geometryInstance") return (target.item.appearanceOverride ||= {});
      if (target.kind === "hatch") return (target.item.appearance ||= normalizeHatchAppearance());
      if (target.kind === "annotation") return (target.item.style ||= normalizeAnnotationStyle());
      if (target.kind === "geometry" || target.kind === "sketch") return (target.item.appearance ||= {});
      return null;
    }

    function apply(target, { category, key, value, context = null }, { commit = true } = {}) {
      let label;
      let refresh = "all";
      if (category === "annotation" && target.kind === "annotation") {
        editing.applyAnnotationStyleValue(target.item, key, value);
        label = "注記外観変更";
      } else if (category === "hatch" && target.kind === "hatch") {
        editing.applyHatchAppearanceInput(target.item, key, value);
        label = "ハッチング外観変更";
      } else if (category === "appearance") {
        const construction = target.kind === "sketch" && context === "construction";
        editing.applyAppearanceInput(construction ? (target.item.constructionAppearance ||= {}) : owner(target), key, value);
        if (target.kind === "block") invalidateBlockProjectionCache(target.item.id);
        label = construction ? "Sketch Default Construction Appearance変更"
          : target.kind === "block" || target.kind === "geometryInstance" ? "Appearance Override変更" : "Appearance変更";
      } else if (category === "dimension") {
        let appearance;
        if (target.kind === "sketch" && context === "dimension") {
          appearance = (target.item.dimensionAppearance ||= {});
          label = "Sketch Default Dimension Appearance変更";
        } else if (target.kind === "constraint" && target.item.dimension) {
          appearance = (target.item.dimension.display ||= {});
          label = "寸法外観変更";
        } else return false;
        editing.applyDimensionAppearanceValue(appearance, key, value);
        refresh = key === "prefix" || key === "suffix" ? null : "properties";
      } else return false;
      if (commit) {
        recordHistory(label);
        if (refresh === "all") updateUI();
        else if (refresh === "properties") updatePropertiesUI();
      }
      draw();
      return true;
    }
    return Object.freeze({ owner, apply });
  }
  window.AppearancePropertyCommand = Object.freeze({ create });
})();
