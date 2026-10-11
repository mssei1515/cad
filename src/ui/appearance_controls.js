/* Geometry and dimension appearance controls, independent of document and selection. */
(() => {
  "use strict";
  function prepareAffixInputs(container) {
    for (const input of container.querySelectorAll("textarea[data-affix-input]")) {
      const resize = () => { input.rows = Math.max(1, input.value.split(/\r\n|\r|\n/).length); };
      resize();
      input.addEventListener("input", resize);
    }
  }
  function create({ applicationText, escapeHtml, formatDisplayNumber, normalizeAppearance,
    normalizeDimensionAppearance, dimensionLengthKeys: DIMENSION_APPEARANCE_LENGTH_KEYS,
    defaultDimensionAppearance: DEFAULT_DIMENSION_APPEARANCE }) {
    function defaultAppearanceLabel() {
      return applicationText("既定", "Default");
    }

    function colorPickerValue(value) {
      const color = String(value || "").trim();
      if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
      if (/^#[0-9a-f]{3}$/i.test(color)) return `#${[...color.slice(1)].map((part) => part.repeat(2)).join("")}`.toLowerCase();
      return "#111827";
    }

    function appearancePropertyRows(owner, effective, { allowInheritance = true, constructionEndpoints = false, idPrefix = "property" } = {}) {
      const direct = normalizeAppearance(owner);
      const inherited = (key) => allowInheritance && direct[key] == null;
      const option = (value, label, selected) => `<option value="${value}" ${selected ? "selected" : ""}>${label}</option>`;
      const defaultLabel = defaultAppearanceLabel();
      const inheritedValue = (key) => {
        if (key === "visible") return applicationText(effective.visible !== false ? "表示" : "非表示", effective.visible !== false ? "Visible" : "Hidden");
        if (key === "lineType") {
          const labels = { solid: ["実線", "Solid"], dashed: ["破線", "Dashed"], dashdot: ["一点鎖線", "Dash-dot"], dashdotdot: ["二点鎖線", "Dash-dot-dot"], dotted: ["点線", "Dotted"] };
          const label = labels[effective.lineType] || [String(effective.lineType || ""), String(effective.lineType || "")];
          return applicationText(label[0], label[1]);
        }
        if (key === "endpointOverhang") return applicationText(effective.endpointOverhang !== false ? "あり" : "なし", effective.endpointOverhang !== false ? "Enabled" : "Disabled");
        if (key === "endpointMarkers") return applicationText(effective.endpointMarkers !== false ? "表示" : "非表示", effective.endpointMarkers !== false ? "Visible" : "Hidden");
        return String(effective[key] ?? "");
      };
      const inheritedLabel = (key) => `${defaultLabel} (${inheritedValue(key)})`;
      const colorValue = colorPickerValue(direct.color || effective.color);
      const endpointRows = constructionEndpoints ? `
        <div class="property-row"><label for="${idPrefix}EndpointOverhang">${applicationText("端部のはみ出し", "Endpoint overhang")}</label><select id="${idPrefix}EndpointOverhang" data-appearance-key="endpointOverhang">
          ${allowInheritance ? option("", inheritedLabel("endpointOverhang"), inherited("endpointOverhang")) : ""}
          ${option("true", applicationText("あり", "Enabled"), direct.endpointOverhang === true || !allowInheritance && effective.endpointOverhang !== false)}${option("false", applicationText("なし", "Disabled"), direct.endpointOverhang === false)}
        </select></div>
        <div class="property-row"><label for="${idPrefix}EndpointMarkers">${applicationText("端部の点", "Endpoint points")}</label><select id="${idPrefix}EndpointMarkers" data-appearance-key="endpointMarkers">
          ${allowInheritance ? option("", inheritedLabel("endpointMarkers"), inherited("endpointMarkers")) : ""}
          ${option("true", applicationText("表示", "Visible"), direct.endpointMarkers === true || !allowInheritance && effective.endpointMarkers !== false)}${option("false", applicationText("非表示", "Hidden"), direct.endpointMarkers === false)}
        </select></div>` : "";
      return `
        <div class="property-row"><label for="${idPrefix}Visible">${applicationText("表示", "Visible")}</label><select id="${idPrefix}Visible" data-appearance-key="visible">
          ${allowInheritance ? option("", inheritedLabel("visible"), inherited("visible")) : ""}
          ${option("true", applicationText("表示", "Visible"), direct.visible === true || !allowInheritance && effective.visible !== false)}${option("false", applicationText("非表示", "Hidden"), direct.visible === false)}
        </select></div>
        <div class="property-row"><label for="${idPrefix}Color">${applicationText("色", "Color")}</label><div class="property-color-control"><input id="${idPrefix}Color" data-appearance-key="color" type="text" placeholder="${escapeHtml(allowInheritance ? inheritedLabel("color") : "")}" value="${escapeHtml(direct.color || "")}" /><button class="property-color-picker" data-appearance-palette-open data-current-color="${colorValue}" type="button" title="${applicationText("カラーパレット", "Color palette")}" aria-label="${applicationText("カラーパレット", "Color palette")}"><span class="property-color-picker-swatch" style="--swatch-color:${colorValue}" aria-hidden="true"></span></button></div></div>
        <div class="property-row"><label for="${idPrefix}LineType">${applicationText("線種", "Line type")}</label><select id="${idPrefix}LineType" data-appearance-key="lineType">
          ${allowInheritance ? option("", inheritedLabel("lineType"), inherited("lineType")) : ""}
          ${option("solid", applicationText("実線", "Solid"), direct.lineType === "solid" || !allowInheritance && effective.lineType === "solid")}${option("dashed", applicationText("破線", "Dashed"), direct.lineType === "dashed")}${option("dashdot", applicationText("一点鎖線", "Dash-dot"), direct.lineType === "dashdot")}${option("dashdotdot", applicationText("二点鎖線", "Dash-dot-dot"), direct.lineType === "dashdotdot")}${option("dotted", applicationText("点線", "Dotted"), direct.lineType === "dotted")}
        </select></div>
        <div class="property-row"><label for="${idPrefix}LineWidth">${applicationText("線幅", "Line width")}</label><input id="${idPrefix}LineWidth" data-appearance-key="lineWidth" type="number" min="0.1" max="20" step="0.1" placeholder="${escapeHtml(allowInheritance ? inheritedLabel("lineWidth") : "")}" value="${direct.lineWidth ?? ""}" /></div>${endpointRows}`;
    }

    function terminatorPropertyRows(owner, effective, { allowInheritance = true, idPrefix = "terminal", attribute = "data-dimension-display" } = {}) {
      const direct = window.Appearance.normalizeTerminator(owner);
      const option = (value, label, selected) => `<option value="${value}" ${selected ? "selected" : ""}>${label}</option>`;
      const labels = { arrow: ["標準矢印", "Standard arrow"], filledArrow: ["塗りつぶし矢印", "Filled arrow"], dot: ["点", "Dot"], none: ["なし", "None"] };
      const label = type => applicationText(...(labels[type] || labels.arrow));
      const inherited = key => `${defaultAppearanceLabel()} (${key === "terminatorType" ? label(effective[key]) : formatDisplayNumber(effective[key]) + (key === "arrowheadAngle" ? "°" : " mm")})`;
      const type = direct.terminatorType || effective.terminatorType;
      const numeric = (key, suffix, ja, en, min, max, unit) => `<div class="property-row"><label for="${idPrefix}${suffix}">${applicationText(ja, en)}</label><div class="property-input-with-unit"><input id="${idPrefix}${suffix}" ${attribute}="${key}" type="number" min="${min}" max="${max}" step="0.1" placeholder="${allowInheritance ? escapeHtml(inherited(key)) : ""}" value="${direct[key] ?? (allowInheritance ? "" : effective[key])}"><span class="property-input-unit">${unit}</span></div></div>`;
      return `<div class="dimension-appearance-group" data-terminator-controls data-dimension-appearance-group="terminators"><div class="dimension-appearance-group-title">${applicationText("端末記号", "Terminators")}</div>
        <div class="property-row"><label for="${idPrefix}TerminatorType">${applicationText("種類", "Type")}</label><select id="${idPrefix}TerminatorType" ${attribute}="terminatorType" data-inherited-terminator-type="${effective.terminatorType}">
        ${allowInheritance ? option("", inherited("terminatorType"), !direct.terminatorType) : ""}
        ${Object.keys(labels).map(value => option(value, label(value), direct.terminatorType === value || !allowInheritance && type === value)).join("")}</select></div>
        ${numeric("terminatorSize", "TerminatorSize", "サイズ", "Size", 0.1, 1000, "mm")}
        <div data-terminator-angle-row ${["arrow", "filledArrow"].includes(type) ? "" : "hidden"}>${numeric("arrowheadAngle", "ArrowheadAngle", "開き角", "Opening angle", 1, 179, "°")}</div></div>`;
    }

    function leaderAppearancePropertyRows(owner, effective, { allowInheritance = true, idPrefix = "annotation", terminals = true, leader = true } = {}) {
      effective = { ...window.Appearance.DEFAULT_LEADER_APPEARANCE, ...effective };
      const direct = window.Appearance.normalizeLeaderAppearance(owner);
      const inherited = key => `${defaultAppearanceLabel()} (${effective[key]})`;
      const input = (key, suffix, ja, en, { min = 0.1, max = 100, unit = "", factor = 1 } = {}) => `<div class="property-row"><label for="${idPrefix}${suffix}">${applicationText(ja, en)}</label><div class="property-input-with-unit"><input id="${idPrefix}${suffix}" data-leader-style="${key}" type="number" min="${min}" max="${max}" step="any" placeholder="${allowInheritance ? escapeHtml(defaultAppearanceLabel() + ' (' + formatDisplayNumber(effective[key] * factor, 3) + ')') : ""}" value="${direct[key] == null ? "" : key === "displayScale" ? (direct[key] * factor).toFixed(1) : formatDisplayNumber(direct[key] * factor, 6)}"><span class="property-input-unit">${unit}</span></div></div>`;
      const select = (key, suffix, ja, en, options) => `<div class="property-row"><label for="${idPrefix}${suffix}">${applicationText(ja, en)}</label><select id="${idPrefix}${suffix}" data-leader-style="${key}">${allowInheritance ? `<option value="" ${direct[key] == null ? "selected" : ""}>${defaultAppearanceLabel()} (${applicationText(...(options.find(([value]) => String(value) === String(effective[key]))?.slice(1) || [String(effective[key]), String(effective[key])]))})</option>` : ""}${options.map(([value, ja, en]) => `<option value="${value}" ${String(direct[key]) === String(value) ? "selected" : ""}>${applicationText(ja, en)}</option>`).join("")}</select></div>`;
      const color = colorPickerValue(direct.color || effective.color);
      return `
        <div class="property-row"><label for="${idPrefix}Color">${applicationText("色", "Color")}</label><div class="property-color-control"><input id="${idPrefix}Color" data-leader-style="color" type="text" value="${direct.color || ""}" placeholder="${allowInheritance ? escapeHtml(inherited("color")) : ""}"><button class="property-color-picker" data-appearance-palette-open data-current-color="${color}" type="button" title="${applicationText("カラーパレット", "Color palette")}"><span class="property-color-picker-swatch" style="--swatch-color:${color}"></span></button></div></div>
        ${leader ? input("lineWidth", "LineWidth", "線幅", "Line width", { min: 0.5, max: 10 }) : ""}
        ${leader ? select("lineType", "LineType", "線種", "Line type", [["solid","実線","Solid"],["dashed","破線","Dashed"],["dashdot","一点鎖線","Dash-dot"],["dashdotdot","二点鎖線","Dash-dot-dot"],["dotted","点線","Dotted"]]) : ""}
        ${terminals ? terminatorPropertyRows(direct, effective, { allowInheritance, idPrefix, attribute: "data-leader-style" }) : ""}
        <div class="property-row" title="${applicationText("図形に対する注記の大きさを固定", "Keep annotation size relative to geometry")}"><label for="${idPrefix}FixedDisplaySize">${applicationText("サイズロック", "Size lock")}</label><div class="property-input-with-unit"><input id="${idPrefix}FixedDisplaySize" data-leader-style="fixedDisplaySize" type="checkbox" ${effective.fixedDisplaySize === false ? "checked" : ""}>${allowInheritance ? `<button type="button" data-property-action="leader-size-default" ${direct.fixedDisplaySize == null ? "disabled" : ""}>${applicationText("既定", "Default")}</button>` : ""}</div></div>
        ${effective.fixedDisplaySize === false ? input("displayScale", "DisplayScale", "基準倍率", "Reference zoom", { min: 0.000001, max: 1e12, unit: "%", factor: 100 }) : ""}
        ${input("textHeight", "TextHeight", "文字高さ", "Text height", { min: 0.5, max: 100, unit: "mm" })}
        ${leader ? input("textGap", "TextGap", "文字と横線の間隔", "Text gap from shelf", { min: 0, max: 1000, unit: "mm" }) : ""}
        ${select("fontFamily", "FontFamily", "フォント", "Font", [["sans-serif","ゴシック体","Sans serif"],["serif","明朝体","Serif"],["monospace","等幅","Monospace"]])}
        ${select("bold", "Bold", "太字", "Bold", [[true,"あり","Enabled"],[false,"なし","Disabled"]])}
        ${select("italic", "Italic", "斜体", "Italic", [[true,"あり","Enabled"],[false,"なし","Disabled"]])}
        ${select("textAlign", "TextAlign", "行の揃え", "Line alignment", [["left","左揃え","Left"],["center","中央揃え","Center"],["right","右揃え","Right"]])}
        ${select("frameVisible", "FrameVisible", "枠線", "Frame border", [[true,"表示","Visible"],[false,"非表示","Hidden"]])}
        ${input("framePaddingY", "FramePaddingY", "上下の余白", "Vertical padding", { min: 0, max: 1000, unit: "mm" })}
        ${input("framePaddingX", "FramePaddingX", "左右の余白", "Horizontal padding", { min: 0, max: 1000, unit: "mm" })}
        <div class="property-row"><label for="${idPrefix}FrameColor">${applicationText("枠線の色", "Frame color")}</label><input id="${idPrefix}FrameColor" data-leader-style="frameColor" type="text" placeholder="${allowInheritance ? escapeHtml(inherited("frameColor")) : ""}" value="${direct.frameColor || ""}"></div>
        ${input("frameLineWidth", "FrameLineWidth", "枠線の線幅", "Frame line width", { min: 0.5, max: 10 })}
        ${select("frameLineType", "FrameLineType", "枠線の線種", "Frame line type", [["solid","実線","Solid"],["dashed","破線","Dashed"],["dashdot","一点鎖線","Dash-dot"],["dashdotdot","二点鎖線","Dash-dot-dot"],["dotted","点線","Dotted"]])}
        ${input("rotation", "Rotation", "回転", "Rotation", { min: -3600, max: 3600, unit: "°", factor: 180 / Math.PI })}`;
    }

    function dimensionAppearancePropertyRows(owner, effective, { allowInheritance = true, idPrefix = "dimensionProperty", terminals = true } = {}) {
      const direct = normalizeDimensionAppearance(owner);
      const hasDirect = (key) => Object.prototype.hasOwnProperty.call(direct, key);
      const option = (value, label, selected) => `<option value="${value}" ${selected ? "selected" : ""}>${label}</option>`;
      const defaultLabel = defaultAppearanceLabel();
      const inheritedValue = (key) => {
        const value = effective[key];
        if (key === "visible") return applicationText(value !== false ? "表示" : "非表示", value !== false ? "Visible" : "Hidden");
        if (key === "terminatorType") {
          const labels = {
            arrow: ["標準矢印", "Standard arrow"],
            filledArrow: ["塗りつぶし矢印", "Filled arrow"],
            dot: ["点", "Dot"],
            none: ["なし", "None"],
          };
          const label = labels[value] || labels.arrow;
          return applicationText(label[0], label[1]);
        }
        if (key === "precision") return value == null ? applicationText("自動", "Auto") : String(value);
        if (key === "prefix" || key === "suffix") return String(value || "") || applicationText("空", "Empty");
        if (key === "arrowheadAngle") return `${formatDisplayNumber(value)}°`;
        if (DIMENSION_APPEARANCE_LENGTH_KEYS.includes(key)) return `${formatDisplayNumber(value)} mm`;
        return String(value ?? "");
      };
      const inheritedLabel = (key) => `${defaultLabel} (${inheritedValue(key)})`;
      const colorValue = colorPickerValue(direct.color || effective.color);
      const booleanOptions = (key, enabledLabel = applicationText("表示", "Visible"), disabledLabel = applicationText("非表示", "Hidden")) => `
        ${allowInheritance ? option("", inheritedLabel(key), !hasDirect(key)) : ""}
        ${option("true", enabledLabel, direct[key] === true || !allowInheritance && effective[key] !== false)}
        ${option("false", disabledLabel, direct[key] === false)}`;
      const precisionOptions = [
        allowInheritance ? option("", inheritedLabel("precision"), !hasDirect("precision")) : "",
        option("auto", applicationText("自動", "Auto"), hasDirect("precision") && direct.precision == null || !allowInheritance && effective.precision == null),
        ...Array.from({ length: 11 }, (_, precision) => option(String(precision), String(precision), direct.precision === precision || !allowInheritance && effective.precision === precision)),
      ].join("");
      const numericRow = (key, idSuffix, labelJa, labelEn, { min = 0, max = 1000, step = 0.1, titleJa = "", titleEn = "" } = {}) => {
        const value = hasDirect(key) ? direct[key] : "";
        const title = titleJa ? ` title="${escapeHtml(applicationText(titleJa, titleEn))}"` : "";
        const unit = key === "arrowheadAngle" ? "°" : "mm";
        return `<div class="property-row"><label for="${idPrefix}${idSuffix}"${title}>${applicationText(labelJa, labelEn)}</label><div class="property-input-with-unit"><input id="${idPrefix}${idSuffix}" data-dimension-display="${key}" type="number" min="${min}" max="${max}" step="${step}" placeholder="${escapeHtml(allowInheritance ? inheritedLabel(key) : "")}" value="${value}"${title}><span class="property-input-unit" aria-hidden="true">${unit}</span></div></div>`;
      };
      const group = (key, titleJa, titleEn, rows) => `<div class="dimension-appearance-group" data-dimension-appearance-group="${key}"><div class="dimension-appearance-group-title">${applicationText(titleJa, titleEn)}</div>${rows}</div>`;
      // The extra initial newline preserves affixes starting with a newline: HTML strips the first one in a textarea.
      return `
        <div class="property-row"><label for="${idPrefix}Visible">${applicationText("表示", "Visible")}</label><select id="${idPrefix}Visible" data-dimension-display="visible">${booleanOptions("visible")}</select></div>
        <div class="property-row"><label for="${idPrefix}Color">${applicationText("色", "Color")}</label><div class="property-color-control"><input id="${idPrefix}Color" data-dimension-display="color" type="text" placeholder="${escapeHtml(allowInheritance ? inheritedLabel("color") : "")}" value="${escapeHtml(direct.color || "")}" /><button class="property-color-picker" data-appearance-palette-open data-current-color="${colorValue}" type="button" title="${applicationText("カラーパレット", "Color palette")}" aria-label="${applicationText("カラーパレット", "Color palette")}"><span class="property-color-picker-swatch" style="--swatch-color:${colorValue}" aria-hidden="true"></span></button></div></div>
        <div class="property-row"><label for="${idPrefix}LineWidth">${applicationText("線幅", "Line width")}</label><input id="${idPrefix}LineWidth" data-dimension-display="lineWidth" type="number" min="0.5" max="10" step="0.1" placeholder="${escapeHtml(allowInheritance ? inheritedLabel("lineWidth") : "")}" value="${hasDirect("lineWidth") ? direct.lineWidth : ""}"></div>
        <div class="property-row"><label for="${idPrefix}Precision">${applicationText("小数点以下の桁数", "Decimal places")}</label><select id="${idPrefix}Precision" data-dimension-display="precision">${precisionOptions}</select></div>
        <div class="property-row"><label for="${idPrefix}Prefix">${applicationText("接頭辞", "Prefix")}</label><textarea id="${idPrefix}Prefix" data-dimension-display="prefix" data-affix-input rows="1" wrap="off" data-user-content placeholder="${escapeHtml(allowInheritance ? inheritedLabel("prefix") : "")}">
${escapeHtml(direct.prefix ?? "")}</textarea></div>
        <div class="property-row"><label for="${idPrefix}Suffix">${applicationText("接尾辞", "Suffix")}</label><textarea id="${idPrefix}Suffix" data-dimension-display="suffix" data-affix-input rows="1" wrap="off" data-user-content placeholder="${escapeHtml(allowInheritance ? inheritedLabel("suffix") : "")}">
${escapeHtml(direct.suffix ?? "")}</textarea></div>
        ${group("extension-lines", "寸法補助線", "Extension lines", `
          ${numericRow("extensionLineOvershoot", "ExtensionLineOvershoot", "突出量", "Overshoot", { titleJa: "寸法補助線が寸法線を越えて外側へ伸びる長さ", titleEn: "Length that extension lines project beyond the dimension line" })}
          ${numericRow("extensionLineOriginGap", "ExtensionLineOriginGap", "起点すき間", "Origin gap", { titleJa: "寸法対象の図形と寸法補助線の開始位置との間隔", titleEn: "Gap between measured geometry and the start of extension lines" })}`)}
        ${terminals ? terminatorPropertyRows(direct, effective, { allowInheritance, idPrefix }) : ""}
        ${group("dimension-text", "寸法文字", "Dimension text", `
          ${numericRow("dimensionTextHeight", "DimensionTextHeight", "高さ", "Height", { min: 0.1, titleJa: "寸法文字の表示高さ", titleEn: "Display height of dimension text" })}
          ${numericRow("dimensionTextGap", "DimensionTextGap", "寸法線との間隔", "Gap from dimension line", { titleJa: "寸法文字領域と寸法線との間隔", titleEn: "Gap between the dimension text region and dimension line" })}`)}`;
    }

    function updateDimensionTerminatorAngleVisibility(container) {
      for (const group of container?.querySelectorAll("[data-terminator-controls]") || []) {
        const select = group.querySelector("[data-inherited-terminator-type]");
        const row = group.querySelector("[data-terminator-angle-row]");
        if (select && row) row.hidden = !["arrow", "filledArrow"].includes(select.value || select.dataset.inheritedTerminatorType);
      }
    }

    return Object.freeze({ terminatorPropertyRows, leaderAppearancePropertyRows, defaultAppearanceLabel, colorPickerValue, appearancePropertyRows, dimensionAppearancePropertyRows, updateDimensionTerminatorAngleVisibility, prepareAffixInputs });
  }
  window.AppearanceControls = Object.freeze({ create });
})();
