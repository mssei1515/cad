/* Appearance values and layer resolution; no Document, DOM, or solver access. */
(function () {
  "use strict";

  const CSS_PX_PER_MM = 96 / 25.4;
  // Missing settings are legacy screen-fixed annotations. Model-relative sizing owns a scale.
  function annotationDisplaySettings(source = {}) {
    if (source.fixedDisplaySize !== false) return { fixedDisplaySize: true };
    const scale = Number(source.displayScale);
    return { fixedDisplaySize: false, displayScale: Number.isFinite(scale) && scale > 0 ? scale : 1 };
  }

  function annotationDisplayFactor(source, viewportScale) {
    const settings = annotationDisplaySettings(source);
    return settings.fixedDisplaySize ? 1 : viewportScale / CSS_PX_PER_MM / settings.displayScale;
  }

  function applyAnnotationDisplaySetting(owner, key, value, viewportScale) {
    if (key === "fixedDisplaySize") {
      const fixed = value === true || value === "true";
      if (!fixed && owner.fixedDisplaySize !== false) owner.displayScale = viewportScale / CSS_PX_PER_MM;
      owner.fixedDisplaySize = fixed;
      if (fixed) delete owner.displayScale;
      return true;
    }
    if (key === "displayScale" && owner.fixedDisplaySize === false) {
      const scale = Number(value) / 100;
      if (!Number.isFinite(scale) || scale <= 0) return false;
      owner.displayScale = scale;
      return true;
    }
    return false;
  }
  const DIMENSION_APPEARANCE_LENGTH_KEYS = ["extensionLineOvershoot", "extensionLineOriginGap", "terminatorSize", "dimensionTextHeight", "dimensionTextGap"];
  const DEFAULT_APPEARANCE = {
    visible: true,
    color: "#111827",
    lineType: "solid",
    lineWidth: 2,
  };
  const DEFAULT_CONSTRUCTION_APPEARANCE = {
    visible: true,
    color: "#64748b",
    lineType: "dashdot",
    lineWidth: 1,
    endpointOverhang: true,
    endpointMarkers: true,
  };
  const DEFAULT_TERMINATOR = Object.freeze({ terminatorType: "arrow", terminatorSize: 4, arrowheadAngle: 30 });
  const DEFAULT_DIMENSION_APPEARANCE = {
    ...DEFAULT_TERMINATOR,
    visible: true,
    color: "#64748b",
    lineWidth: 1.2,
    precision: null,
    prefix: "",
    suffix: "",
    extensionLineOvershoot: 1.5,
    extensionLineOriginGap: 1.5,
    dimensionTextHeight: 5,
    dimensionTextGap: 0,
  };
  const DEFAULT_HATCH_APPEARANCE = {
    visible: true,
    patternType: "solid",
    angle: 45,
    spacing: 3,
    color: "#64748b",
    lineWidth: 1,
    opacity: 0.5,
  };
  const DEFAULT_ANNOTATION_STYLE = {
    color: "#111827",
    textHeight: 13 / CSS_PX_PER_MM,
    fontFamily: "sans-serif",
    bold: false,
    italic: false,
    textAlign: "left",
    lineWidth: 1.4,
    lineType: "solid",
    terminatorType: "filledArrow",
    terminatorSize: 10 / CSS_PX_PER_MM,
  };
  const TERMINATOR_KEYS = Object.freeze(["terminatorType", "terminatorSize", "arrowheadAngle"]);
  const DEFAULT_LEADER_APPEARANCE = Object.freeze({ ...DEFAULT_ANNOTATION_STYLE, ...DEFAULT_TERMINATOR, fixedDisplaySize: true, rotation: 0, textGap: 1 });

  function normalizeTerminator(value, { partial = true } = {}) {
    const source = value && typeof value === "object" ? value : {};
    const result = partial ? {} : { ...DEFAULT_TERMINATOR };
    if (["arrow", "filledArrow", "dot", "none"].includes(source.terminatorType)) result.terminatorType = source.terminatorType;
    for (const [key, min, max] of [["terminatorSize", 0.1, 1000], ["arrowheadAngle", 1, 179]]) {
      if (source[key] == null || source[key] === "") continue;
      const numeric = Number(source[key]);
      if (Number.isFinite(numeric)) result[key] = Math.max(min, Math.min(max, numeric));
    }
    return result;
  }

  function normalizeLeaderAppearance(value, { partial = true } = {}) {
    const source = value && typeof value === "object" ? value : {};
    const normalized = normalizeAnnotationStyle(source);
    const result = partial ? {} : { ...DEFAULT_LEADER_APPEARANCE };
    for (const key of Object.keys(DEFAULT_LEADER_APPEARANCE)) {
      if (Object.hasOwn(source, key) && key !== "rotation" && key !== "textGap" && !TERMINATOR_KEYS.includes(key)) result[key] = normalized[key];
    }
    if (Object.hasOwn(source, "displayScale") && Number.isFinite(Number(source.displayScale)) && Number(source.displayScale) > 0) result.displayScale = Number(source.displayScale);
    if (Object.hasOwn(source, "rotation") && Number.isFinite(Number(source.rotation))) result.rotation = Number(source.rotation);
    if (Object.hasOwn(source, "textGap") && source.textGap !== "" && Number.isFinite(Number(source.textGap))) result.textGap = Math.max(0, Math.min(1000, Number(source.textGap)));
    Object.assign(result, normalizeTerminator(source));
    return result;
  }

  function dimensionDefaults(value) {
    const result = normalizeDimensionAppearance(value, { partial: false });
    for (const key of TERMINATOR_KEYS) delete result[key];
    return result;
  }

  function leaderDefaults(value) {
    const result = normalizeLeaderAppearance(value, { partial: false });
    for (const key of TERMINATOR_KEYS) delete result[key];
    return result;
  }

  function resolveLeaderAppearance(defaults, terminal, sketch, style) {
    const result = { ...DEFAULT_LEADER_APPEARANCE, ...leaderDefaults(defaults), ...normalizeTerminator(terminal, { partial: false }), ...normalizeLeaderAppearance(sketch), ...normalizeLeaderAppearance(style) };
    Object.assign(result, annotationDisplaySettings(result));
    if (result.fixedDisplaySize !== false) delete result.displayScale;
    return result;
  }

  function annotationStoredStyle(element) {
    if (element.type === "leader" && element.appearanceInheritance === true) {
      const result = normalizeLeaderAppearance(element.style);
      for (const key of ["prefix", "suffix"]) if (Object.hasOwn(element.style || {}, key)) result[key] = String(element.style[key] || "");
      return result;
    }
    return normalizeAnnotationStyle(element.style);
  }

  const DIMENSION_APPEARANCE_NUMERIC_RULES = {
    lineWidth: { min: 0.5, max: 10 },
    extensionLineOvershoot: { min: 0, max: 1000 },
    extensionLineOriginGap: { min: 0, max: 1000 },
    terminatorSize: { min: 0.1, max: 1000 },
    arrowheadAngle: { min: 1, max: 179 },
    dimensionTextHeight: { min: 0.1, max: 1000 },
    dimensionTextGap: { min: 0, max: 1000 },
  };

  function normalizeAppearance(value, { partial = true } = {}) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const result = partial ? {} : { ...DEFAULT_APPEARANCE };
    if (Object.prototype.hasOwnProperty.call(source, "visible")) result.visible = source.visible !== false;
    if (typeof source.color === "string" && /^#[0-9a-fA-F]{6}$/.test(source.color)) result.color = source.color.toLowerCase();
    if (["solid", "dashed", "dashdot", "dashdotdot", "dotted"].includes(source.lineType)) result.lineType = source.lineType;
    const lineWidth = Number(source.lineWidth ?? source.lineWidthPx);
    if (Number.isFinite(lineWidth)) result.lineWidth = Math.max(0.5, Math.min(10, lineWidth));
    if (Object.prototype.hasOwnProperty.call(source, "endpointOverhang")) result.endpointOverhang = source.endpointOverhang !== false;
    if (Object.prototype.hasOwnProperty.call(source, "endpointMarkers")) result.endpointMarkers = source.endpointMarkers !== false;
    return result;
  }

  function normalizeConstructionAppearance(value, { partial = true } = {}) {
    return { ...(partial ? {} : DEFAULT_CONSTRUCTION_APPEARANCE), ...normalizeAppearance(value) };
  }

  function normalizeDimensionAppearance(value, { partial = true } = {}) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const result = partial ? {} : { ...DEFAULT_DIMENSION_APPEARANCE };
    if (Object.hasOwn(source, "fixedDisplaySize")) Object.assign(result, annotationDisplaySettings(source));
    if (Object.prototype.hasOwnProperty.call(source, "visible")) result.visible = source.visible !== false;
    if (typeof source.color === "string" && /^#[0-9a-fA-F]{6}$/.test(source.color)) result.color = source.color.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(source, "precision")) {
      const precision = Number(source.precision);
      result.precision = source.precision == null || source.precision === "" || !Number.isFinite(precision)
        ? null
        : Math.max(0, Math.min(10, Math.round(precision)));
    }
    if (Object.prototype.hasOwnProperty.call(source, "prefix")) result.prefix = String(source.prefix || "");
    if (Object.prototype.hasOwnProperty.call(source, "suffix")) result.suffix = String(source.suffix || "");
    if (Object.prototype.hasOwnProperty.call(source, "toleranceUpper")) {
      const tolerance = Number(source.toleranceUpper);
      result.toleranceUpper = source.toleranceUpper == null || source.toleranceUpper === "" || !Number.isFinite(tolerance) ? null : tolerance;
    }
    if (Object.prototype.hasOwnProperty.call(source, "toleranceLower")) {
      const tolerance = Number(source.toleranceLower);
      result.toleranceLower = source.toleranceLower == null || source.toleranceLower === "" || !Number.isFinite(tolerance) ? null : tolerance;
    }
    Object.assign(result, normalizeTerminator(source));
    for (const [key, rule] of Object.entries(DIMENSION_APPEARANCE_NUMERIC_RULES)) {
      if (TERMINATOR_KEYS.includes(key) || !Object.prototype.hasOwnProperty.call(source, key)) continue;
      if (source[key] == null || source[key] === "") continue;
      const numeric = Number(source[key]);
      if (Number.isFinite(numeric)) result[key] = Math.max(rule.min, Math.min(rule.max, numeric));
    }
    return result;
  }

  function loadedDimensionAppearance(value, sourceVersion, options = {}) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
    if (!Object.prototype.hasOwnProperty.call(source, "terminatorSize") && Object.prototype.hasOwnProperty.call(source, "arrowheadLength")) {
      source.terminatorSize = source.arrowheadLength;
    }
    if (sourceVersion < 12) {
      for (const key of DIMENSION_APPEARANCE_LENGTH_KEYS) {
        const numeric = Number(source[key]);
        if (Number.isFinite(numeric)) source[key] = numeric / CSS_PX_PER_MM;
      }
    }
    delete source.arrows;
    delete source.extensionLines;
    delete source.arrowheadLength;
    return normalizeDimensionAppearance(source, options);
  }

  function normalizeHatchAppearance(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const spacing = Number(source.spacing);
    const angle = Number(source.angle);
    const lineWidth = Number(source.lineWidth);
    const opacity = Number(source.opacity);
    return {
      visible: source.visible !== false,
      patternType: ["parallel", "cross", "solid"].includes(source.patternType) ? source.patternType : DEFAULT_HATCH_APPEARANCE.patternType,
      angle: Number.isFinite(angle) ? Math.max(-3600, Math.min(3600, angle)) : DEFAULT_HATCH_APPEARANCE.angle,
      spacing: Number.isFinite(spacing) ? Math.max(0.25, Math.min(1000, spacing)) : DEFAULT_HATCH_APPEARANCE.spacing,
      color: typeof source.color === "string" && /^#[0-9a-fA-F]{6}$/.test(source.color) ? source.color.toLowerCase() : DEFAULT_HATCH_APPEARANCE.color,
      lineWidth: Number.isFinite(lineWidth) ? Math.max(0.5, Math.min(10, lineWidth)) : DEFAULT_HATCH_APPEARANCE.lineWidth,
      opacity: Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : DEFAULT_HATCH_APPEARANCE.opacity,
    };
  }

  function normalizeAnnotationStyle(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const legacyFontSize = Number(source.fontSize);
    const textHeight = Number(source.textHeight);
    const lineWidth = Number(source.lineWidth);
    const terminatorSize = Number(source.terminatorSize);
    const fontFamily = ["sans-serif", "serif", "monospace"].includes(source.fontFamily)
      ? source.fontFamily
      : DEFAULT_ANNOTATION_STYLE.fontFamily;
    const textAlign = ["left", "center", "right"].includes(source.textAlign)
      ? source.textAlign
      : DEFAULT_ANNOTATION_STYLE.textAlign;
    const lineType = ["solid", "dashed", "dashdot", "dashdotdot", "dotted"].includes(source.lineType)
      ? source.lineType
      : DEFAULT_ANNOTATION_STYLE.lineType;
    const terminatorType = ["arrow", "filledArrow", "dot", "none"].includes(source.terminatorType)
      ? source.terminatorType
      : DEFAULT_ANNOTATION_STYLE.terminatorType;
    return {
      ...(Object.hasOwn(source, "fixedDisplaySize") ? annotationDisplaySettings(source) : {}),
      color: typeof source.color === "string" && /^#[0-9a-fA-F]{6}$/.test(source.color)
        ? source.color.toLowerCase()
        : DEFAULT_ANNOTATION_STYLE.color,
      textHeight: Number.isFinite(textHeight)
        ? Math.max(0.5, Math.min(100, textHeight))
        : Number.isFinite(legacyFontSize)
          ? Math.max(0.5, Math.min(100, legacyFontSize / CSS_PX_PER_MM))
          : DEFAULT_ANNOTATION_STYLE.textHeight,
      prefix: String(source.prefix || ""),
      suffix: String(source.suffix || ""),
      fontFamily,
      bold: source.bold === true || source.fontWeight === "bold" || Number(source.fontWeight) >= 600,
      italic: source.italic === true || source.fontStyle === "italic",
      textAlign,
      lineWidth: Number.isFinite(lineWidth) ? Math.max(0.5, Math.min(10, lineWidth)) : DEFAULT_ANNOTATION_STYLE.lineWidth,
      lineType,
      terminatorType,
      arrowheadAngle: Number.isFinite(Number(source.arrowheadAngle)) ? Math.max(1, Math.min(179, Number(source.arrowheadAngle))) : 27,
      terminatorSize: Number.isFinite(terminatorSize) ? Math.max(0.1, Math.min(100, terminatorSize)) : DEFAULT_ANNOTATION_STYLE.terminatorSize,
    };
  }

  // The caller supplies only the owning sketch's layer (never its ancestors).
  // Block layers are passed in display order, with instance overrides inner to outer.
  function resolveGeometryAppearance({ defaults, construction = false, sketchAppearance, definitionSketchAppearance, elementAppearance, overrides = [] }) {
    const normalizeSketch = construction ? normalizeConstructionAppearance : normalizeAppearance;
    let result = {
      ...normalizeSketch(defaults, { partial: false }),
      ...normalizeSketch(sketchAppearance),
      ...normalizeSketch(definitionSketchAppearance),
      ...normalizeAppearance(elementAppearance),
    };
    for (const override of overrides) result = { ...result, ...normalizeAppearance(override) };
    return result;
  }

  function resolveDimensionAppearance(defaults, sketchAppearance, display) {
    return {
      ...normalizeDimensionAppearance(defaults, { partial: false }),
      ...normalizeDimensionAppearance(sketchAppearance),
      ...normalizeDimensionAppearance(display),
    };
  }

  // Exported defaults are shared values, never mutable document state.
  for (const rule of Object.values(DIMENSION_APPEARANCE_NUMERIC_RULES)) Object.freeze(rule);
  for (const value of [DEFAULT_APPEARANCE, DEFAULT_CONSTRUCTION_APPEARANCE, DEFAULT_DIMENSION_APPEARANCE, DEFAULT_HATCH_APPEARANCE, DEFAULT_ANNOTATION_STYLE, DIMENSION_APPEARANCE_LENGTH_KEYS, DIMENSION_APPEARANCE_NUMERIC_RULES]) Object.freeze(value);
  window.Appearance = Object.freeze({
    TERMINATOR_KEYS, DEFAULT_TERMINATOR, DEFAULT_LEADER_APPEARANCE, normalizeTerminator, normalizeLeaderAppearance, resolveLeaderAppearance, annotationStoredStyle, dimensionDefaults, leaderDefaults,
    annotationDisplaySettings, annotationDisplayFactor, applyAnnotationDisplaySetting,
    CSS_PX_PER_MM, DEFAULT_APPEARANCE, DEFAULT_CONSTRUCTION_APPEARANCE,
    DEFAULT_DIMENSION_APPEARANCE, DEFAULT_HATCH_APPEARANCE, DEFAULT_ANNOTATION_STYLE,
    DIMENSION_APPEARANCE_LENGTH_KEYS, DIMENSION_APPEARANCE_NUMERIC_RULES,
    normalizeAppearance, normalizeConstructionAppearance, normalizeDimensionAppearance, loadedDimensionAppearance, normalizeHatchAppearance, normalizeAnnotationStyle,
    resolveGeometryAppearance, resolveDimensionAppearance,
  });
})();
