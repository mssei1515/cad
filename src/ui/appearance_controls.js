/* Geometry and dimension appearance controls, independent of document and selection. */
(() => {
  "use strict";
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

    function dimensionAppearancePropertyRows(owner, effective, { allowInheritance = true, idPrefix = "dimensionProperty" } = {}) {
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
      const terminatorType = hasDirect("terminatorType") ? direct.terminatorType : effective.terminatorType;
      const terminatorTypeOptions = [
        allowInheritance ? option("", inheritedLabel("terminatorType"), !hasDirect("terminatorType")) : "",
        option("arrow", applicationText("標準矢印", "Standard arrow"), direct.terminatorType === "arrow" || !allowInheritance && effective.terminatorType === "arrow"),
        option("filledArrow", applicationText("塗りつぶし矢印", "Filled arrow"), direct.terminatorType === "filledArrow" || !allowInheritance && effective.terminatorType === "filledArrow"),
        option("dot", applicationText("点", "Dot"), direct.terminatorType === "dot" || !allowInheritance && effective.terminatorType === "dot"),
      ].join("");
      const numericRow = (key, idSuffix, labelJa, labelEn, { min = 0, max = 1000, step = 0.1, titleJa = "", titleEn = "" } = {}) => {
        const value = hasDirect(key) ? direct[key] : "";
        const title = titleJa ? ` title="${escapeHtml(applicationText(titleJa, titleEn))}"` : "";
        const unit = key === "arrowheadAngle" ? "°" : "mm";
        return `<div class="property-row"><label for="${idPrefix}${idSuffix}"${title}>${applicationText(labelJa, labelEn)}</label><div class="property-input-with-unit"><input id="${idPrefix}${idSuffix}" data-dimension-display="${key}" type="number" min="${min}" max="${max}" step="${step}" placeholder="${escapeHtml(allowInheritance ? inheritedLabel(key) : "")}" value="${value}"${title}><span class="property-input-unit" aria-hidden="true">${unit}</span></div></div>`;
      };
      const group = (key, titleJa, titleEn, rows) => `<div class="dimension-appearance-group" data-dimension-appearance-group="${key}"><div class="dimension-appearance-group-title">${applicationText(titleJa, titleEn)}</div>${rows}</div>`;
      return `
        <div class="property-row"><label for="${idPrefix}Visible">${applicationText("表示", "Visible")}</label><select id="${idPrefix}Visible" data-dimension-display="visible">${booleanOptions("visible")}</select></div>
        <div class="property-row"><label for="${idPrefix}Color">${applicationText("色", "Color")}</label><div class="property-color-control"><input id="${idPrefix}Color" data-dimension-display="color" type="text" placeholder="${escapeHtml(allowInheritance ? inheritedLabel("color") : "")}" value="${escapeHtml(direct.color || "")}" /><button class="property-color-picker" data-appearance-palette-open data-current-color="${colorValue}" type="button" title="${applicationText("カラーパレット", "Color palette")}" aria-label="${applicationText("カラーパレット", "Color palette")}"><span class="property-color-picker-swatch" style="--swatch-color:${colorValue}" aria-hidden="true"></span></button></div></div>
        <div class="property-row"><label for="${idPrefix}LineWidth">${applicationText("線幅", "Line width")}</label><input id="${idPrefix}LineWidth" data-dimension-display="lineWidth" type="number" min="0.5" max="10" step="0.1" placeholder="${escapeHtml(allowInheritance ? inheritedLabel("lineWidth") : "")}" value="${hasDirect("lineWidth") ? direct.lineWidth : ""}"></div>
        <div class="property-row"><label for="${idPrefix}Precision">${applicationText("精度", "Precision")}</label><select id="${idPrefix}Precision" data-dimension-display="precision">${precisionOptions}</select></div>
        <div class="property-row"><label for="${idPrefix}Prefix">${applicationText("接頭辞", "Prefix")}</label><input id="${idPrefix}Prefix" data-dimension-display="prefix" placeholder="${escapeHtml(allowInheritance ? inheritedLabel("prefix") : "")}" value="${escapeHtml(direct.prefix ?? "")}"></div>
        <div class="property-row"><label for="${idPrefix}Suffix">${applicationText("接尾辞", "Suffix")}</label><input id="${idPrefix}Suffix" data-dimension-display="suffix" placeholder="${escapeHtml(allowInheritance ? inheritedLabel("suffix") : "")}" value="${escapeHtml(direct.suffix ?? "")}"></div>
        ${group("extension-lines", "寸法補助線", "Extension lines", `
          ${numericRow("extensionLineOvershoot", "ExtensionLineOvershoot", "突出量", "Overshoot", { titleJa: "寸法補助線が寸法線を越えて外側へ伸びる長さ", titleEn: "Length that extension lines project beyond the dimension line" })}
          ${numericRow("extensionLineOriginGap", "ExtensionLineOriginGap", "起点すき間", "Origin gap", { titleJa: "寸法対象の図形と寸法補助線の開始位置との間隔", titleEn: "Gap between measured geometry and the start of extension lines" })}`)}
        ${group("terminators", "端末記号", "Terminators", `
          <div class="property-row"><label for="${idPrefix}TerminatorType">${applicationText("種類", "Type")}</label><select id="${idPrefix}TerminatorType" data-dimension-display="terminatorType" data-inherited-terminator-type="${escapeHtml(effective.terminatorType)}">${terminatorTypeOptions}</select></div>
          ${numericRow("terminatorSize", "TerminatorSize", "サイズ", "Size", { min: 0.1, titleJa: "端末記号の代表寸法。矢印は長さ、点は直径", titleEn: "Representative terminator dimension: arrow length or dot diameter" })}
          <div data-terminator-angle-row ${terminatorType === "dot" ? "hidden" : ""}>${numericRow("arrowheadAngle", "ArrowheadAngle", "開き角", "Opening angle", { min: 1, max: 179, step: 1, titleJa: "矢印を構成する2辺のなす角度（度）", titleEn: "Included angle between the two arrow sides in degrees" })}</div>`)}
        ${group("dimension-text", "寸法文字", "Dimension text", `
          ${numericRow("dimensionTextHeight", "DimensionTextHeight", "高さ", "Height", { min: 0.1, titleJa: "寸法文字の表示高さ", titleEn: "Display height of dimension text" })}
          ${numericRow("dimensionTextGap", "DimensionTextGap", "寸法線との間隔", "Gap from dimension line", { titleJa: "寸法文字領域と寸法線との間隔", titleEn: "Gap between the dimension text region and dimension line" })}`)}`;
    }

    function updateDimensionTerminatorAngleVisibility(container) {
      const select = container?.querySelector('[data-dimension-display="terminatorType"]');
      const row = container?.querySelector("[data-terminator-angle-row]");
      if (!select || !row) return;
      const type = select.value || select.dataset.inheritedTerminatorType || DEFAULT_DIMENSION_APPEARANCE.terminatorType;
      row.hidden = type === "dot";
    }

    return Object.freeze({ defaultAppearanceLabel, colorPickerValue, appearancePropertyRows, dimensionAppearancePropertyRows, updateDimensionTerminatorAngleVisibility });
  }
  window.AppearanceControls = Object.freeze({ create });
})();
