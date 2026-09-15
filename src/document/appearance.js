/* Appearance values and layer resolution; no Document, DOM, or solver access. */
(function () {
  "use strict";

  const CSS_PX_PER_MM = 96 / 25.4;
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
  const DEFAULT_DIMENSION_APPEARANCE = {
    visible: true,
    color: "#64748b",
    lineWidth: 1.2,
    precision: null,
    prefix: "",
    suffix: "",
    terminatorType: "arrow",
    extensionLineOvershoot: 1.5,
    extensionLineOriginGap: 1.5,
    terminatorSize: 4,
    arrowheadAngle: 30,
    dimensionTextHeight: 5,
    dimensionTextGap: 0,
  };
  const DEFAULT_HATCH_APPEARANCE = {
    visible: true,
    patternType: "parallel",
    angle: 45,
    spacing: 3,
    color: "#64748b",
    lineWidth: 1,
    opacity: 1,
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
    if (["arrow", "filledArrow", "dot"].includes(source.terminatorType)) result.terminatorType = source.terminatorType;
    for (const [key, rule] of Object.entries(DIMENSION_APPEARANCE_NUMERIC_RULES)) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
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
      color: typeof source.color === "string" && /^#[0-9a-fA-F]{6}$/.test(source.color)
        ? source.color.toLowerCase()
        : DEFAULT_ANNOTATION_STYLE.color,
      textHeight: Number.isFinite(textHeight)
        ? Math.max(0.5, Math.min(100, textHeight))
        : Number.isFinite(legacyFontSize)
          ? Math.max(0.5, Math.min(100, legacyFontSize / CSS_PX_PER_MM))
          : DEFAULT_ANNOTATION_STYLE.textHeight,
      fontFamily,
      bold: source.bold === true || source.fontWeight === "bold" || Number(source.fontWeight) >= 600,
      italic: source.italic === true || source.fontStyle === "italic",
      textAlign,
      lineWidth: Number.isFinite(lineWidth) ? Math.max(0.5, Math.min(10, lineWidth)) : DEFAULT_ANNOTATION_STYLE.lineWidth,
      lineType,
      terminatorType,
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
    CSS_PX_PER_MM, DEFAULT_APPEARANCE, DEFAULT_CONSTRUCTION_APPEARANCE,
    DEFAULT_DIMENSION_APPEARANCE, DEFAULT_HATCH_APPEARANCE, DEFAULT_ANNOTATION_STYLE,
    DIMENSION_APPEARANCE_LENGTH_KEYS, DIMENSION_APPEARANCE_NUMERIC_RULES,
    normalizeAppearance, normalizeConstructionAppearance, normalizeDimensionAppearance, loadedDimensionAppearance, normalizeHatchAppearance, normalizeAnnotationStyle,
    resolveGeometryAppearance, resolveDimensionAppearance,
  });
})();
