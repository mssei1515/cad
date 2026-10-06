/* Apply normalized appearance fields; no selection, DOM, solver or history. */
(() => {
  "use strict";
  function create({ normalizeAppearance, normalizeAnnotationStyle, normalizeHatchAppearance,
    normalizeDimensionAppearance, defaultDimensionAppearance: DEFAULT_DIMENSION_APPEARANCE,
    dimensionNumericRules: DIMENSION_APPEARANCE_NUMERIC_RULES }) {
    function applyAppearanceInput(target, key, rawValue) {
      if (!target) return;
      const next = { ...normalizeAppearance(target) };
      if (rawValue === "") delete next[key];
      else if (["visible", "endpointOverhang", "endpointMarkers"].includes(key)) next[key] = rawValue === "true";
      else if (key === "lineWidth") next[key] = Math.max(0.1, Math.min(20, Number(rawValue)));
      else next[key] = rawValue;
      Object.assign(target, normalizeAppearance(next));
      for (const existingKey of ["visible", "color", "lineType", "lineWidth", "endpointOverhang", "endpointMarkers"]) if (next[existingKey] == null) delete target[existingKey];
    }

    function prepareLeaderStyle(annotation) {
      if (!annotation.appearanceInheritance) {
        annotation.style = { ...normalizeAnnotationStyle(annotation.style), ...window.Appearance.annotationDisplaySettings(annotation.style), rotation: Number(annotation.rotation) || 0 };
        annotation.appearanceInheritance = true;
      }
      return (annotation.style ||= {});
    }

    function applyLeaderAppearanceValue(owner, key, rawValue, { viewportScale = 96 / 25.4, effective = owner } = {}) {
      if (!owner) return false;
      if (rawValue === "") {
        delete owner[key];
        if (key === "fixedDisplaySize") delete owner.displayScale;
        return true;
      }
      if (key === "fixedDisplaySize") {
        const fixed = rawValue === true || rawValue === "true";
        if (!fixed && effective.fixedDisplaySize !== false) owner.displayScale = viewportScale / (96 / 25.4);
        owner.fixedDisplaySize = fixed;
        if (fixed) delete owner.displayScale;
        return true;
      }
      const value = ["bold", "italic"].includes(key) ? rawValue === true || rawValue === "true"
        : key === "rotation" ? Number(rawValue) * Math.PI / 180
        : key === "displayScale" ? Number(rawValue) / 100 : rawValue;
      const normalized = window.Appearance.normalizeLeaderAppearance({ [key]: value });
      if (!Object.hasOwn(normalized, key)) return false;
      owner[key] = normalized[key];
      return true;
    }

    function applyAnnotationStyleValue(annotation, key, rawValue) {
      if (!annotation) return false;
      if (annotation.type === "leader" && !["prefix", "suffix"].includes(key)) return applyLeaderAppearanceValue(prepareLeaderStyle(annotation), key, rawValue);
      const next = annotation.type === "leader" ? { ...prepareLeaderStyle(annotation) } : { ...normalizeAnnotationStyle(annotation.style) };
      if (["bold", "italic"].includes(key)) next[key] = Boolean(rawValue);
      else if (["textHeight", "lineWidth", "terminatorSize"].includes(key)) next[key] = Number(rawValue);
      else next[key] = rawValue;
      annotation.style = annotation.type === "leader" ? next : normalizeAnnotationStyle(next);
      return true;
    }

    function applyHatchAppearanceInput(hatch, key, rawValue) {
      if (!hatch || !key) return false;
      const next = { ...hatch.appearance };
      if (key === "visible") next.visible = rawValue === true || rawValue === "true";
      else if (key === "patternType") next.patternType = rawValue;
      else if (["angle", "spacing", "lineWidth"].includes(key)) next[key] = Number(rawValue);
      else if (key === "opacity") next.opacity = Number(rawValue) / 100;
      else if (key === "color") next.color = rawValue;
      else return false;
      hatch.appearance = normalizeHatchAppearance(next);
      return true;
    }

    function applyDimensionAppearanceValue(owner, key, rawValue, { allowInheritance = true } = {}) {
      if (!owner) return false;
      const next = { ...normalizeDimensionAppearance(owner) };
      if (allowInheritance && rawValue === "") delete next[key];
      else if (key === "visible") next[key] = rawValue === "true";
      else if (key === "terminatorType") next[key] = ["arrow", "filledArrow", "dot", "none"].includes(rawValue) ? rawValue : DEFAULT_DIMENSION_APPEARANCE.terminatorType;
      else if (key === "precision") {
        next[key] = rawValue === "auto" || rawValue === "" ? null : Math.max(0, Math.min(10, Math.round(Number(rawValue))));
      } else if (key === "toleranceUpper" || key === "toleranceLower") next[key] = rawValue === "" ? null : Number(rawValue);
      else if (Object.prototype.hasOwnProperty.call(DIMENSION_APPEARANCE_NUMERIC_RULES, key)) next[key] = rawValue === "" ? DEFAULT_DIMENSION_APPEARANCE[key] : Number(rawValue);
      else next[key] = rawValue;
      const normalized = normalizeDimensionAppearance(next, { partial: allowInheritance });
      for (const existingKey of ["fixedDisplaySize", "displayScale", "visible", "color", "precision", "prefix", "suffix", "toleranceUpper", "toleranceLower", "terminatorType", "arrows", "extensionLines", "arrowheadLength", ...Object.keys(DIMENSION_APPEARANCE_NUMERIC_RULES)]) delete owner[existingKey];
      Object.assign(owner, normalized);
      return true;
    }

    return Object.freeze({ prepareLeaderStyle, applyLeaderAppearanceValue, applyAppearanceInput, applyAnnotationStyleValue, applyHatchAppearanceInput, applyDimensionAppearanceValue });
  }
  window.AppearanceEditing = Object.freeze({ create });
})();
