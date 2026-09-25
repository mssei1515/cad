/* Property row presentation. Read-only queries and formatting are injected;
 * selection, DOM events, model mutation and history belong to callers. */
(() => {
  "use strict";
  function create({ Point, Line, Circle, Arc, Spline, applicationText, escapeHtml, formatDisplayNumber,
    multiplePropertySameType, multiplePropertySupports, multiplePropertyValue, multiplePropertyAppearance,
    mixedValue: MULTIPLE_PROPERTY_MIXED, colorPickerValue, sketchProjectionConstraintForTarget, sketchName,
    constraintGeometryId, constraintStatusBadge, constraintStatusOf, angleDegrees,
    blockInstanceEnabledSketchSet, blockDefinitionSketchRows, snappedBlockRotation,
    constraintDefiningGeometryEntries, normalizeAnnotationStyle }) {
    function multiplePropertiesRows(target) {
      const items = target.items || [];
      const sameType = multiplePropertySameType(target);
      const allSupport = (key) => items.length > 0 && items.every((entry) => multiplePropertySupports(entry, key));
      const value = (key) => multiplePropertyValue(target, key);
      const mixedLabel = applicationText("混在", "Mixed");
      const option = (optionValue, label, current) => `<option value="${optionValue}" ${current === optionValue ? "selected" : ""}>${label}</option>`;
      const select = (key, options) => {
        const current = value(key);
        return `<select data-bulk-property="${key}">${current === MULTIPLE_PROPERTY_MIXED ? `<option value="" selected disabled>${mixedLabel}</option>` : ""}${options(current)}</select>`;
      };
      const textInput = (key, type = "text", attributes = "") => {
        const current = value(key);
        return `<input data-bulk-property="${key}" type="${type}" ${attributes} placeholder="${current === MULTIPLE_PROPERTY_MIXED ? mixedLabel : ""}" value="${current === MULTIPLE_PROPERTY_MIXED ? "" : escapeHtml(current)}">`;
      };
      const checkbox = (key) => {
        const current = value(key);
        return `<input data-bulk-property="${key}" type="checkbox" ${current === true ? "checked" : ""} ${current === MULTIPLE_PROPERTY_MIXED ? 'data-mixed="true"' : ""}>`;
      };
      const visibleRow = `<div class="property-row"><label>${applicationText("表示", "Visible")}</label>${select("visible", (current) => option("true", applicationText("表示", "Visible"), String(current)) + option("false", applicationText("非表示", "Hidden"), String(current)))}</div>`;
      const commonColor = value("color");
      const colorValue = colorPickerValue(commonColor === MULTIPLE_PROPERTY_MIXED ? multiplePropertyAppearance(items[0]).color : commonColor);
      const colorRow = `<div class="property-row"><label>${applicationText("色", "Color")}</label><div class="property-color-control">${textInput("color")}<button class="property-color-picker" data-appearance-palette-open data-current-color="${colorValue}" type="button" title="${applicationText("カラーパレット", "Color palette")}" aria-label="${applicationText("カラーパレット", "Color palette")}"><span class="property-color-picker-swatch" style="--swatch-color:${colorValue}" aria-hidden="true"></span></button></div></div>`;
      const lineTypeRow = !allSupport("lineType") ? "" : `<div class="property-row"><label>${applicationText("線種", "Line type")}</label>${select("lineType", (current) =>
        option("solid", applicationText("実線", "Solid"), current) + option("dashed", applicationText("破線", "Dashed"), current) + option("dashdot", applicationText("一点鎖線", "Dash-dot"), current) + option("dashdotdot", applicationText("二点鎖線", "Dash-dot-dot"), current) + option("dotted", applicationText("点線", "Dotted"), current))}</div>`;
      const lineWidthRow = !allSupport("lineWidth") ? "" : `<div class="property-row"><label>${applicationText("線幅", "Line width")}</label>${textInput("lineWidth", "number", 'min="0.1" max="20" step="0.1"')}</div>`;
      let specificRows = "";
      if (sameType && allSupport("construction")) {
        specificRows += `<div class="property-row"><label>${applicationText("補助線", "Construction")}</label>${checkbox("construction")}</div>`;
        if (allSupport("endpointOverhang")) specificRows += `<div class="property-row"><label>${applicationText("端部のはみ出し", "Endpoint overhang")}</label>${checkbox("endpointOverhang")}</div>`;
        if (allSupport("endpointMarkers")) specificRows += `<div class="property-row"><label>${applicationText("端部の点", "Endpoint points")}</label>${checkbox("endpointMarkers")}</div>`;
      }
      if (sameType && allSupport("patternType")) {
        const pattern = value("patternType");
        specificRows = `<div class="property-row"><label>${applicationText("種類", "Type")}</label>${select("patternType", (current) => option("parallel", applicationText("平行線", "Parallel"), current) + option("cross", applicationText("クロス", "Cross"), current) + option("solid", applicationText("塗りつぶし", "Solid fill"), current))}</div>` + specificRows;
        if (pattern !== "solid") {
          specificRows += `<div class="property-row"><label>${applicationText("角度", "Angle")}</label><div class="property-input-with-unit">${textInput("angle", "number", 'step="1"')}<span class="property-input-unit">°</span></div></div>`;
          specificRows += `<div class="property-row"><label>${applicationText("間隔", "Spacing")}</label><div class="property-input-with-unit">${textInput("spacing", "number", 'min="0.25" max="1000" step="0.1"')}<span class="property-input-unit">mm</span></div></div>`;
        }
        if (pattern === "solid") specificRows += `<div class="property-row"><label>${applicationText("不透明度", "Opacity")}</label><div class="property-input-with-unit">${textInput("opacity", "number", 'min="0" max="100" step="1"')}<span class="property-input-unit">%</span></div></div>`;
      }
      if (sameType && allSupport("textHeight")) {
        specificRows += `<div class="property-row"><label>${applicationText("文字高さ", "Text height")}</label><div class="property-input-with-unit">${textInput("textHeight", "number", 'min="0.5" max="100" step="0.1"')}<span class="property-input-unit">mm</span></div></div>`;
        specificRows += `<div class="property-row"><label>${applicationText("フォント", "Font")}</label>${select("fontFamily", (current) => option("sans-serif", applicationText("ゴシック体", "Sans serif"), current) + option("serif", applicationText("明朝体", "Serif"), current) + option("monospace", applicationText("等幅", "Monospace"), current))}</div>`;
        specificRows += `<div class="property-row"><label>${applicationText("太字", "Bold")}</label>${checkbox("bold")}</div><div class="property-row"><label>${applicationText("斜体", "Italic")}</label>${checkbox("italic")}</div>`;
        specificRows += `<div class="property-row"><label>${applicationText("横位置", "Horizontal alignment")}</label>${select("textAlign", (current) => option("left", applicationText("左揃え", "Left"), current) + option("center", applicationText("中央揃え", "Center"), current) + option("right", applicationText("右揃え", "Right"), current))}</div>`;
        specificRows += `<div class="property-row"><label>${applicationText("回転", "Rotation")}</label><div class="property-input-with-unit">${textInput("rotation", "number", 'min="-3600" max="3600" step="1"')}<span class="property-input-unit">°</span></div></div>`;
        if (allSupport("terminatorType")) specificRows += `<div class="property-row"><label>${applicationText("端末記号", "Terminator")}</label>${select("terminatorType", (current) => option("arrow", applicationText("標準矢印", "Standard arrow"), current) + option("filledArrow", applicationText("塗りつぶし矢印", "Filled arrow"), current) + option("dot", applicationText("点", "Dot"), current) + option("none", applicationText("なし", "None"), current))}</div><div class="property-row"><label>${applicationText("端末サイズ", "Terminator size")}</label><div class="property-input-with-unit">${textInput("terminatorSize", "number", 'min="0.1" max="100" step="0.1"')}<span class="property-input-unit">mm</span></div></div>`;
      }
      return `${specificRows}${visibleRow}${colorRow}${lineTypeRow}${lineWidthRow}`;
    }

    function geometryPropertyName(item) {
      if (item instanceof Point) return applicationText("点", "Point");
      if (item instanceof Line) return applicationText("線", "Line");
      if (item instanceof Circle) return applicationText("円", "Circle");
      if (item instanceof Arc) return applicationText("円弧", "Arc");
      if (item instanceof Spline) return applicationText("スプライン", "Spline");
      return applicationText("ジオメトリ", "Geometry");
    }

    function geometryAppearanceSectionName(item) {
      if (item instanceof Point) return applicationText("点の外観", "Point Appearance");
      if (item instanceof Line) return applicationText("線の外観", "Line Appearance");
      if (item instanceof Circle) return applicationText("円の外観", "Circle Appearance");
      if (item instanceof Arc) return applicationText("円弧の外観", "Arc Appearance");
      if (item instanceof Spline) return applicationText("スプラインの外観", "Spline Appearance");
      return applicationText("ジオメトリの外観", "Geometry Appearance");
    }

    function propertyReadonlyRow(labelJa, labelEn, value, { userContent = false } = {}) {
      return `<div class="property-row"><span>${escapeHtml(applicationText(labelJa, labelEn))}</span><span class="property-readonly" ${userContent ? "data-user-content" : ""}>${escapeHtml(value)}</span></div>`;
    }

    function geometryPropertyRows(item) {
      const type = item instanceof Point
        ? applicationText("点", "Point")
        : item instanceof Line
          ? applicationText("線", "Line")
          : item instanceof Circle
            ? applicationText("円", "Circle")
            : item instanceof Arc
              ? applicationText("円弧", "Arc")
              : applicationText("スプライン", "Spline");
      let rows = propertyReadonlyRow("種類", "Type", type) + propertyReadonlyRow("ID", "ID", item.id);
      const projection = sketchProjectionConstraintForTarget(item);
      if (projection) {
        rows += propertyReadonlyRow("参照元スケッチ", "Source sketch", `${sketchName(projection.referenceSketchId)} (${projection.referenceSketchId})`, { userContent: true });
        rows += propertyReadonlyRow("参照元Geometry ID", "Source geometry ID", constraintGeometryId(projection.source) || "—");
      }
      if (item instanceof Point) {
        rows += propertyReadonlyRow("X座標", "X coordinate", formatDisplayNumber(item.x));
        rows += propertyReadonlyRow("Y座標", "Y coordinate", formatDisplayNumber(item.y));
        rows += propertyReadonlyRow("固定", "Fixed", applicationText(item.fixed ? "はい" : "いいえ", item.fixed ? "Yes" : "No"));
        return rows;
      }
      if (item instanceof Line) {
        rows += propertyReadonlyRow("始点ID", "Start point ID", item.p1.id);
        rows += propertyReadonlyRow("終点ID", "End point ID", item.p2.id);
        rows += propertyReadonlyRow("長さ", "Length", formatDisplayNumber(item.length()));
        rows += propertyReadonlyRow("拘束状態", "Constraint status", constraintStatusBadge(constraintStatusOf(item)));
      } else if (item instanceof Circle || item instanceof Arc) {
        rows += propertyReadonlyRow("中心点ID", "Center point ID", item.center.id);
        rows += propertyReadonlyRow("半径", "Radius", formatDisplayNumber(item.radius()));
        if (item instanceof Arc) {
          rows += propertyReadonlyRow("始点角度", "Start angle", `${formatDisplayNumber(angleDegrees(item.startAngle))}°`);
          rows += propertyReadonlyRow("終点角度", "End angle", `${formatDisplayNumber(angleDegrees(item.endAngle))}°`);
        }
      } else if (item instanceof Spline) {
        rows += propertyReadonlyRow("定義方式", "Definition mode", applicationText("通過点", "Fit points"));
        rows += propertyReadonlyRow("次数", "Degree", "3");
        rows += propertyReadonlyRow("通過点ID", "Fit point IDs", item.fitPoints.map((point) => point.id).join(" – "));
        rows += `<div class="property-row"><label>${applicationText("閉じる", "Closed")}</label><input data-property="spline-closed" type="checkbox" ${item.closed ? "checked" : ""}></div>`;
        rows += `<button type="button" class="property-action-button" data-property-action="spline-edit">${applicationText("スプライン編集", "Edit spline")}</button>`;
      }
      rows += `<div class="property-row"><label>${applicationText("補助線", "Construction")}</label><input data-property="construction" type="checkbox" aria-label="${applicationText("補助線", "Construction")}" ${item.construction ? "checked" : ""}></div>`;
      return rows;
    }

    function blockPropertiesConfiguration(item, definition) {
      const enabled = blockInstanceEnabledSketchSet(item, definition);
      const rotationLocked = Boolean(item.rotationLocked);
      const rotationDisabled = Boolean(item.fixed);
      const rows = blockDefinitionSketchRows(definition);
      return `
        <div class="property-option-group">
          <div class="property-option-group-title">${applicationText("回転モード", "Rotation mode")}</div>
          <label class="property-option"><input type="radio" name="propertyBlockRotationMode" data-block-rotation-mode="locked" ${rotationLocked ? "checked" : ""} ${rotationDisabled ? "disabled" : ""}><span>${applicationText("直交回転ロック", "Orthogonal rotation lock")}</span></label>
          <label class="property-option"><input type="radio" name="propertyBlockRotationMode" data-block-rotation-mode="free" ${rotationLocked ? "" : "checked"} ${rotationDisabled ? "disabled" : ""}><span>${applicationText("自由回転", "Free rotation")}</span></label>
          ${rotationDisabled ? `<small>${applicationText("全固定中", "Fully fixed")}</small>` : ""}
        </div>
        <div class="property-option-group">
          <div class="property-option-group-title">${applicationText("表示するスケッチ", "Visible sketches")}</div>
          ${rows.map(({ sketch, depth, count }) => `<label class="property-option property-sketch-option" style="--property-sketch-depth:${depth}"><input type="checkbox" data-block-sketch-id="${escapeHtml(sketch.id)}" ${enabled.has(sketch.id) ? "checked" : ""}><span data-user-content>${escapeHtml(sketch.name)}</span><small>${count}</small></label>`).join("")}
        </div>`;
    }

    function blockRotationPropertyRow(item) {
      if (!item.rotationLocked) return propertyReadonlyRow("回転角度", "Rotation angle", `${formatDisplayNumber(angleDegrees(item.rotation))}°`);
      const rotation = snappedBlockRotation(item.rotation);
      const options = [0, 90, 180, 270].map((angle) => {
        const value = angle * Math.PI / 180;
        return `<option value="${angle}" ${Math.abs(value - rotation) < 1e-12 ? "selected" : ""}>${angle}°</option>`;
      }).join("");
      return `<div class="property-row"><label>${applicationText("回転角度", "Rotation angle")}</label><select data-property="block-orthogonal-rotation" aria-label="${applicationText("回転角度", "Rotation angle")}" ${item.fixed ? "disabled" : ""}>${options}</select></div>`;
    }

    function dimensionGeometryPropertyRows(target) {
      if (!target) return "";
      const geometryId = (item) => constraintGeometryId(item) || "—";
      if (target.kind === "point-point") {
        return propertyReadonlyRow("始点ID", "Start point ID", geometryId(target.p1))
          + propertyReadonlyRow("終点ID", "End point ID", geometryId(target.p2));
      }
      if (target.kind === "point-line") {
        return propertyReadonlyRow("点ID", "Point ID", geometryId(target.point))
          + propertyReadonlyRow("線ID", "Line ID", geometryId(target.line));
      }
      if (target.kind === "line-circle") {
        return propertyReadonlyRow("線ID", "Line ID", geometryId(target.line))
          + propertyReadonlyRow("円ID", "Circle ID", geometryId(target.circle));
      }
      if (target.kind === "radius-difference") {
        return propertyReadonlyRow("1つ目の図形ID", "First geometry ID", geometryId(target.a))
          + propertyReadonlyRow("2つ目の図形ID", "Second geometry ID", geometryId(target.b));
      }
      if (target.kind === "line-line" || target.kind === "angle") {
        return propertyReadonlyRow("1本目の線ID", "First line ID", geometryId(target.line1))
          + propertyReadonlyRow("2本目の線ID", "Second line ID", geometryId(target.line2));
      }
      if (target.kind === "offset-distance") {
        return propertyReadonlyRow("基準線ID", "Source line ID", geometryId(target.source))
          + propertyReadonlyRow("オフセット線ID", "Offset line ID", geometryId(target.offset));
      }
      if (target.kind === "radius" || target.kind === "diameter") {
        return propertyReadonlyRow("ジオメトリID", "Geometry ID", geometryId(target.primitive));
      }
      return "";
    }

    function constraintDefiningGeometryPropertyRows(constraint) {
      return constraintDefiningGeometryEntries(constraint)
        .map(({ labelJa, labelEn, item }) => propertyReadonlyRow(labelJa, labelEn, constraintGeometryId(item) || "—"))
        .join("");
    }

    function annotationAppearancePropertyRows(item) {
      const style = normalizeAnnotationStyle(item.style);
      const color = colorPickerValue(style.color);
      const option = (value, label, selected) => `<option value="${value}" ${selected ? "selected" : ""}>${label}</option>`;
      const fontOptions = [
        option("sans-serif", applicationText("ゴシック体", "Sans serif"), style.fontFamily === "sans-serif"),
        option("serif", applicationText("明朝体", "Serif"), style.fontFamily === "serif"),
        option("monospace", applicationText("等幅", "Monospace"), style.fontFamily === "monospace"),
      ].join("");
      const alignOptions = [
        option("left", applicationText("左揃え", "Left"), style.textAlign === "left"),
        option("center", applicationText("中央揃え", "Center"), style.textAlign === "center"),
        option("right", applicationText("右揃え", "Right"), style.textAlign === "right"),
      ].join("");
      const common = `
        <div class="property-row"><label for="annotationVisible">${applicationText("表示", "Visible")}</label><input id="annotationVisible" data-property="annotation-visible" type="checkbox" ${item.visible !== false ? "checked" : ""}></div>
        <div class="property-row"><label for="annotationColor">${applicationText("色", "Color")}</label><div class="property-color-control"><input id="annotationColor" data-annotation-style="color" type="text" value="${escapeHtml(style.color)}"><button class="property-color-picker" data-appearance-palette-open data-current-color="${color}" type="button" title="${applicationText("カラーパレット", "Color palette")}" aria-label="${applicationText("カラーパレット", "Color palette")}"><span class="property-color-picker-swatch" style="--swatch-color:${color}" aria-hidden="true"></span></button></div></div>
        <div class="property-row"><label for="annotationTextHeight">${applicationText("文字高さ", "Text height")}</label><div class="property-input-with-unit"><input id="annotationTextHeight" data-annotation-style="textHeight" type="number" min="0.5" max="100" step="0.1" value="${formatDisplayNumber(style.textHeight, 3)}"><span class="property-input-unit" aria-hidden="true">mm</span></div></div>
        <div class="property-row"><label for="annotationFontFamily">${applicationText("フォント", "Font")}</label><select id="annotationFontFamily" data-annotation-style="fontFamily">${fontOptions}</select></div>
        <div class="property-row"><label for="annotationBold">${applicationText("太字", "Bold")}</label><input id="annotationBold" data-annotation-style="bold" type="checkbox" ${style.bold ? "checked" : ""}></div>
        <div class="property-row"><label for="annotationItalic">${applicationText("斜体", "Italic")}</label><input id="annotationItalic" data-annotation-style="italic" type="checkbox" ${style.italic ? "checked" : ""}></div>
        <div class="property-row"><label for="annotationTextAlign">${applicationText("横位置", "Horizontal alignment")}</label><select id="annotationTextAlign" data-annotation-style="textAlign">${alignOptions}</select></div>
        <div class="property-row"><label for="annotationRotation">${applicationText("回転", "Rotation")}</label><div class="property-input-with-unit"><input id="annotationRotation" data-property="annotation-rotation" type="number" min="-3600" max="3600" step="1" value="${formatDisplayNumber((Number(item.rotation) || 0) * 180 / Math.PI, 3)}"><span class="property-input-unit" aria-hidden="true">°</span></div></div>`;
      if (item.type !== "leader") return common;
      const lineTypeOptions = [
        option("solid", applicationText("実線", "Solid"), style.lineType === "solid"),
        option("dashed", applicationText("破線", "Dashed"), style.lineType === "dashed"),
        option("dashdot", applicationText("一点鎖線", "Dash-dot"), style.lineType === "dashdot"),
        option("dashdotdot", applicationText("二点鎖線", "Dash-dot-dot"), style.lineType === "dashdotdot"),
        option("dotted", applicationText("点線", "Dotted"), style.lineType === "dotted"),
      ].join("");
      const terminatorOptions = [
        option("arrow", applicationText("標準矢印", "Standard arrow"), style.terminatorType === "arrow"),
        option("filledArrow", applicationText("塗りつぶし矢印", "Filled arrow"), style.terminatorType === "filledArrow"),
        option("dot", applicationText("点", "Dot"), style.terminatorType === "dot"),
        option("none", applicationText("なし", "None"), style.terminatorType === "none"),
      ].join("");
      return `${common}
        <div class="property-row"><label for="annotationLineWidth">${applicationText("線幅", "Line width")}</label><input id="annotationLineWidth" data-annotation-style="lineWidth" type="number" min="0.5" max="10" step="0.1" value="${style.lineWidth}"></div>
        <div class="property-row"><label for="annotationLineType">${applicationText("線種", "Line type")}</label><select id="annotationLineType" data-annotation-style="lineType">${lineTypeOptions}</select></div>
        <div class="property-row"><label for="annotationTerminatorType">${applicationText("端末記号", "Terminator")}</label><select id="annotationTerminatorType" data-annotation-style="terminatorType">${terminatorOptions}</select></div>
        <div class="property-row"><label for="annotationTerminatorSize">${applicationText("端末サイズ", "Terminator size")}</label><div class="property-input-with-unit"><input id="annotationTerminatorSize" data-annotation-style="terminatorSize" type="number" min="0.1" max="100" step="0.1" value="${formatDisplayNumber(style.terminatorSize, 3)}"><span class="property-input-unit" aria-hidden="true">mm</span></div></div>`;
    }

    return Object.freeze({ multiplePropertiesRows, geometryPropertyName, geometryAppearanceSectionName, propertyReadonlyRow, geometryPropertyRows, blockPropertiesConfiguration, blockRotationPropertyRow, dimensionGeometryPropertyRows, constraintDefiningGeometryPropertyRows, annotationAppearancePropertyRows });
  }
  window.PropertyRows = Object.freeze({ create });
})();
