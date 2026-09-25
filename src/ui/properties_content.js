/* Compose Properties markup using resolved display information and reusable rows. */
(() => {
  "use strict";
  function create({ presentation, rows, appearanceControls, Line, SketchProjectionConstraint,
    applicationText, escapeHtml, formatDisplayNumber, hatchRegionErrorText, geometryInstanceTypeLabel,
    geometryRefId, expressionInputValue, numericDimensionExpression, sketchName, localizedConstraintName,
    collapsibleSketchAppearanceSection }) {
    const { multiplePropertiesRows, geometryPropertyName, geometryAppearanceSectionName, propertyReadonlyRow, geometryPropertyRows, blockPropertiesConfiguration, blockRotationPropertyRow, dimensionGeometryPropertyRows, constraintDefiningGeometryPropertyRows, annotationAppearancePropertyRows } = rows;
    const { appearancePropertyRows, dimensionAppearancePropertyRows, colorPickerValue } = appearanceControls;
    function freeInstancePropertyRows(item, info) {
      const placementRows = info.placing ? "" : propertyReadonlyRow("X座標", "X coordinate", formatDisplayNumber(item.x))
        + propertyReadonlyRow("Y座標", "Y coordinate", formatDisplayNumber(item.y))
        + propertyReadonlyRow("ドラッグ操作", "Drag action", !info.editingSharedShape ? applicationText("全体移動", "Move instance") : applicationText("共有形状の編集", "Edit shared shape"));
      return placementRows + `<div class="property-row"><label>${applicationText("角度", "Angle")} (°)</label><input data-free-instance-property="rotation" type="number" step="1" value="${formatDisplayNumber(item.rotation * 180 / Math.PI)}"></div>`
        + [ ["mirrorX", "左右反転", "Reflect left/right"], ["mirrorY", "上下反転", "Reflect up/down"] ].map(([key, ja, en]) => `<div class="property-row"><label>${applicationText(ja, en)}</label><input data-free-instance-property="${key}" type="checkbox" ${item[key] ? "checked" : ""}></div>`).join("");
    }

    function render(target) {
      const info = presentation.read(target);
      if (target.kind === "multiple") {
        return `<h2 class="property-heading">${target.count} ${applicationText("個のオブジェクト", "objects")}</h2><section class="property-section"><h3>${applicationText("基本情報", "Basic Information")}</h3>${propertyReadonlyRow("選択数", "Selected objects", String(target.count))}</section><section class="property-section"><h3>${applicationText("共通外観", "Common Appearance")}</h3>${multiplePropertiesRows(target)}</section>`;
      }
      const item = target.item;
      const basicInformationHeading = `<h3>${applicationText("基本情報", "Basic Information")}</h3>`;
      if (target.kind === "geometry") {
        const effective = info.effective;
        return `<h2 class="property-heading">${escapeHtml(geometryPropertyName(item))}</h2><section class="property-section">${basicInformationHeading}${geometryPropertyRows(item)}</section><section class="property-section"><h3>${geometryAppearanceSectionName(item)}</h3>${appearancePropertyRows(item.appearance, effective, { constructionEndpoints: item instanceof Line && item.construction })}</section>`;
      } else if (target.kind === "referenceImage") {
        const locked = item.locked ? "disabled" : "";
        const width = item.pixelWidth * item.scale;
        const height = item.pixelHeight * item.scale;
        return `<h2 class="property-heading">${applicationText("画像", "Image")}</h2><section class="property-section">${basicInformationHeading}
          ${propertyReadonlyRow("種類", "Type", applicationText("参照画像", "Reference image"))}
          ${propertyReadonlyRow("ID", "ID", item.id)}
          ${propertyReadonlyRow("所属スケッチ", "Owning sketch", `${info.owningSketchName} (${item.sketchId})`, { userContent: true })}
          <div class="property-row"><label>${applicationText("名前", "Name")}</label><input data-reference-image-property="name" value="${escapeHtml(item.name)}"></div>
          <div class="property-row"><label>${applicationText("X座標", "X coordinate")}</label><div class="property-input-with-unit"><input data-reference-image-property="x" type="number" step="0.1" value="${formatDisplayNumber(item.x, 6)}" ${locked}><span class="property-input-unit">mm</span></div></div>
          <div class="property-row"><label>${applicationText("Y座標", "Y coordinate")}</label><div class="property-input-with-unit"><input data-reference-image-property="y" type="number" step="0.1" value="${formatDisplayNumber(item.y, 6)}" ${locked}><span class="property-input-unit">mm</span></div></div>
          <div class="property-row"><label>${applicationText("幅", "Width")}</label><div class="property-input-with-unit"><input data-reference-image-property="width" type="number" min="0.000001" step="0.1" value="${formatDisplayNumber(width, 6)}" ${locked}><span class="property-input-unit">mm</span></div></div>
          <div class="property-row"><span>${applicationText("高さ", "Height")}</span><span class="property-readonly">${formatDisplayNumber(height, 6)} mm</span></div>
          <div class="property-row"><label>${applicationText("回転", "Rotation")}</label><div class="property-input-with-unit"><input data-reference-image-property="rotation" type="number" step="1" value="${formatDisplayNumber(item.rotation * 180 / Math.PI, 6)}" ${locked}><span class="property-input-unit">°</span></div></div>
          <div class="property-row"><label>${applicationText("不透明度", "Opacity")}</label><div class="property-input-with-unit"><input data-reference-image-property="opacity" type="number" min="0" max="100" step="1" value="${formatDisplayNumber(item.opacity * 100, 2)}"><span class="property-input-unit">%</span></div></div>
          <div class="property-row"><label>${applicationText("表示", "Visible")}</label><input data-reference-image-property="visible" type="checkbox" ${item.visible !== false ? "checked" : ""}></div>
          <div class="property-row"><label>${applicationText("位置ロック", "Position lock")}</label><input data-reference-image-property="locked" type="checkbox" ${item.locked ? "checked" : ""}></div>
          <button type="button" class="property-action-button" data-property-action="reference-image-calibrate" ${item.locked || item.visible === false ? "disabled" : ""}>${applicationText("2点から縮尺を設定", "Calibrate scale from two points")}</button>
        </section>`;
      } else if (target.kind === "hatch") {
        const { appearance, boundary } = info;
        const boundaryStatus = boundary.ok ? applicationText("有効", "Valid") : applicationText("無効", "Invalid");
        const color = colorPickerValue(appearance.color);
        const repair = boundary.ok ? "" : `<div class="property-row property-row-action"><span>${applicationText("理由", "Reason")}</span><span class="property-readonly">${escapeHtml(hatchRegionErrorText(boundary))}</span></div><button type="button" class="property-action-button" data-property-action="hatch-repair">${applicationText("境界を再指定", "Reselect boundary")}</button>`;
        const linePattern = appearance.patternType !== "solid";
        const appearanceRows = `
          <div class="property-row"><label>${applicationText("種類", "Type")}</label><select data-hatch-property="patternType"><option value="parallel" ${appearance.patternType === "parallel" ? "selected" : ""}>${applicationText("平行線", "Parallel")}</option><option value="cross" ${appearance.patternType === "cross" ? "selected" : ""}>${applicationText("クロス", "Cross")}</option><option value="solid" ${appearance.patternType === "solid" ? "selected" : ""}>${applicationText("塗りつぶし", "Solid fill")}</option></select></div>
          <div class="property-row"><label>${applicationText("表示", "Visible")}</label><input data-hatch-property="visible" type="checkbox" ${appearance.visible !== false ? "checked" : ""}></div>
          ${linePattern ? `<div class="property-row"><label>${applicationText("角度", "Angle")}</label><div class="property-input-with-unit"><input data-hatch-property="angle" type="number" step="1" value="${appearance.angle}"><span class="property-input-unit">°</span></div></div>
          <div class="property-row"><label>${applicationText("間隔", "Spacing")}</label><div class="property-input-with-unit"><input data-hatch-property="spacing" type="number" min="0.25" max="1000" step="0.1" value="${appearance.spacing}"><span class="property-input-unit">mm</span></div></div>` : ""}
          <div class="property-row"><label>${applicationText("色", "Color")}</label><div class="property-color-control"><input data-hatch-property="color" type="text" value="${escapeHtml(appearance.color)}"><button class="property-color-picker" data-appearance-palette-open data-current-color="${color}" type="button" title="${applicationText("カラーパレット", "Color palette")}" aria-label="${applicationText("カラーパレット", "Color palette")}"><span class="property-color-picker-swatch" style="--swatch-color:${color}" aria-hidden="true"></span></button></div></div>
          ${appearance.patternType === "solid" ? `<div class="property-row"><label>${applicationText("不透明度", "Opacity")}</label><div class="property-input-with-unit"><input data-hatch-property="opacity" type="number" min="0" max="100" step="1" value="${formatDisplayNumber(appearance.opacity * 100, 2)}"><span class="property-input-unit">%</span></div></div>` : ""}
          ${linePattern ? `<div class="property-row"><label>${applicationText("線幅", "Line width")}</label><input data-hatch-property="lineWidth" type="number" min="0.5" max="10" step="0.1" value="${appearance.lineWidth}"></div>` : ""}`;
        return `<h2 class="property-heading">${applicationText("ハッチング", "Hatching")}</h2><section class="property-section">${basicInformationHeading}${propertyReadonlyRow("種類", "Type", applicationText("ハッチング", "Hatching"))}${propertyReadonlyRow("ID", "ID", item.id)}${propertyReadonlyRow("所属スケッチ", "Owning sketch", `${info.owningSketchName} (${item.sketchId})`, { userContent: true })}${propertyReadonlyRow("境界状態", "Boundary status", boundaryStatus)}${repair}</section><section class="property-section"><h3>${applicationText("ハッチング外観", "Hatching Appearance")}</h3>${appearanceRows}</section>`;
      } else if (target.kind === "block") {
        const { definition, effective } = info;
        const definitionLabel = definition ? `${definition.name} (${definition.id})` : item.definitionId;
        const rows = propertyReadonlyRow("種類", "Type", applicationText("ブロック", "Block"))
          + propertyReadonlyRow("ID", "ID", item.id)
          + propertyReadonlyRow("ブロック定義", "Block definition", definitionLabel, { userContent: true })
          + propertyReadonlyRow("X座標", "X coordinate", formatDisplayNumber(item.x))
          + propertyReadonlyRow("Y座標", "Y coordinate", formatDisplayNumber(item.y))
          + blockRotationPropertyRow(item);
        return `<h2 class="property-heading">${applicationText("ブロック", "Block")}</h2><section class="property-section">${basicInformationHeading}${rows}${blockPropertiesConfiguration(item, definition)}</section><section class="property-section"><h3>${applicationText("ブロック外観の上書き", "Block Appearance Override")}</h3>${appearancePropertyRows(item.appearanceOverride, effective)}</section>`;
      } else if (target.kind === "geometryInstance") {
        const { bundle, effective } = info;
        const typeLabel = geometryInstanceTypeLabel(item.type);
        const refs = info.sources.map((ref) => `${ref.kind}:${geometryRefId(ref)}`).join(", ");
        const settings = item.type === "free" ? freeInstancePropertyRows(item, info) : item.type === "pattern" ? `<div class="property-row"><label>${applicationText("間隔", "Spacing")}</label><div class="property-input-with-unit"><input data-geometry-instance-property="spacing" type="number" min="0.000001" step="0.1" value="${item.spacing}"><span class="property-input-unit">mm</span></div></div><div class="property-row"><label>${applicationText("コピー数", "Copies")}</label><input data-geometry-instance-property="copies" type="number" min="1" max="1000" step="1" value="${item.copies}"></div><div class="property-row"><label>${applicationText("反転", "Reverse")}</label><input data-geometry-instance-property="reversed" type="checkbox" ${item.reversed ? "checked" : ""}></div>` : "";
        return `<h2 class="property-heading">${typeLabel}</h2><section class="property-section">${basicInformationHeading}${propertyReadonlyRow("種類", "Type", typeLabel)}${propertyReadonlyRow("ID", "ID", item.id)}${propertyReadonlyRow("複写元", "Sources", refs, { userContent: true })}${propertyReadonlyRow("状態", "Status", bundle.valid ? applicationText("有効", "Valid") : bundle.reason, { userContent: !bundle.valid })}${settings}${info.canEditSources ? `<button data-property-action="instance-sources" ${info.editingSources ? "disabled" : ""}>${applicationText("対象図形を編集", "Edit source geometry")}</button>` : ""}</section><section class="property-section"><h3>${applicationText("外観の上書き", "Appearance Override")}</h3>${appearancePropertyRows(item.appearanceOverride, effective)}</section>`;
      } else if (target.kind === "constraint") {
        const dimension = item.dimension;
        const { targetValue, display, value } = info;
        const parameterRows = dimension
          ? `<div class="property-row"><label>${applicationText("Parameter名", "Parameter name")}</label><input data-property="constraint-parameter-name" value="${escapeHtml(item.parameterName || "")}"></div>`
            + (!info.readOnly
              ? `<div class="property-row"><label>${applicationText("値 / 数式", "Value / Expression")}</label><input data-property="constraint-expression" inputmode="text" value="${escapeHtml(expressionInputValue(item.expression || numericDimensionExpression(item)))}"></div>`
              : `<div class="property-row"><span>${applicationText("値 / 数式", "Value / Expression")}</span><span class="property-readonly">${applicationText("Geometryから測定", "Measured from geometry")}</span></div>`)
            + propertyReadonlyRow("評価値", "Evaluated value", Number.isFinite(value) ? formatDisplayNumber(value) : "—")
          : "";
        const definingGeometryRows = dimension
          ? dimensionGeometryPropertyRows(targetValue)
          : constraintDefiningGeometryPropertyRows(item);
        const projectionRows = item instanceof SketchProjectionConstraint
          ? propertyReadonlyRow("参照元スケッチ", "Source sketch", `${sketchName(item.referenceSketchId)} (${item.referenceSketchId})`, { userContent: true })
          : "";
        const heading = item instanceof SketchProjectionConstraint
          ? applicationText("スケッチ投影", "Sketch Projection")
          : localizedConstraintName(item.name, { typeOnly: true });
        return `<h2 class="property-heading">${escapeHtml(heading)}</h2><section class="property-section">${basicInformationHeading}<div class="property-row"><span>Type</span><span class="property-readonly">${escapeHtml(item.constructor.name)}</span></div>${projectionRows}${definingGeometryRows}${parameterRows}</section>${dimension ? `<section class="property-section"><h3>${applicationText("寸法外観", "Dimension Appearance")}</h3>${dimensionAppearancePropertyRows(dimension.display || {}, display)}</section>` : ""}`;
      } else if (target.kind === "annotation") {
        const annotationType = item.type === "leader" ? applicationText("引出線", "Leader") : applicationText("自由テキスト", "Free Text");
        const information = propertyReadonlyRow("種類", "Type", annotationType)
          + propertyReadonlyRow("ID", "ID", item.id)
          + propertyReadonlyRow("所属スケッチ", "Owning sketch", `${info.owningSketchName} (${item.sketchId})`, { userContent: true });
        const content = `<div class="property-row"><label for="annotationText">${applicationText("本文", "Text")}</label><textarea id="annotationText" data-property="annotation-text" data-user-content>${escapeHtml(item.text || "")}</textarea></div>`;
        const appearanceHeading = item.type === "leader"
          ? applicationText("引出線の外観", "Leader Appearance")
          : applicationText("自由テキストの外観", "Free Text Appearance");
        return `<h2 class="property-heading">${annotationType}</h2><section class="property-section">${basicInformationHeading}${information}</section><section class="property-section"><h3>${applicationText("内容", "Content")}</h3>${content}</section><section class="property-section"><h3>${appearanceHeading}</h3>${annotationAppearancePropertyRows(item)}</section>`;
      } else if (target.kind === "blockPlacement") {
        const enabled = new Set(info.enabledSketchIds);
        return `<h2 class="property-heading">${applicationText("ブロック配置", "Block placement")}</h2><section class="property-section">${basicInformationHeading}${propertyReadonlyRow("ブロック定義", "Block definition", item.name, { userContent: true })}<div class="property-option-group"><div class="property-option-group-title">${applicationText("回転モード", "Rotation mode")}</div><label class="property-option"><input type="radio" name="placementRotationMode" data-placement-rotation-mode="locked" ${info.rotationLocked ? "checked" : ""}><span>${applicationText("直交回転ロック", "Orthogonal rotation lock")}</span></label><label class="property-option"><input type="radio" name="placementRotationMode" data-placement-rotation-mode="free" ${info.rotationLocked ? "" : "checked"}><span>${applicationText("自由回転", "Free rotation")}</span></label></div><div class="property-option-group"><div class="property-option-group-title">${applicationText("配置するスケッチ", "Sketches to place")}</div>${info.sketchRows.map(({ sketch, depth, count }) => `<label class="property-option property-sketch-option" style="--property-sketch-depth:${depth}"><input type="checkbox" data-placement-sketch-id="${escapeHtml(sketch.id)}" ${enabled.has(sketch.id) ? "checked" : ""}><span data-user-content>${escapeHtml(sketch.name)}</span><small>${count}</small></label>`).join("")}</div></section>`;
      } else {
        const parent = info.parent;
        const parentLabel = parent ? `${parent.name} (${parent.id})` : applicationText("なし", "None");
        const rows = propertyReadonlyRow("種類", "Type", applicationText("スケッチ", "Sketch"))
          + propertyReadonlyRow("ID", "ID", item.id)
          + propertyReadonlyRow("名前", "Name", item.name, { userContent: true })
          + propertyReadonlyRow("親スケッチ", "Parent sketch", parentLabel, { userContent: Boolean(parent) })
          + propertyReadonlyRow("アクティブ", "Active", applicationText("はい", "Yes"));
        const appearanceSections = info.root ? "" : collapsibleSketchAppearanceSection("general", "一般外観", "General Appearance", appearancePropertyRows(
          item.appearance,
          info.effective,
        )) + collapsibleSketchAppearanceSection("construction", "補助線外観", "Construction Appearance", appearancePropertyRows(
          item.constructionAppearance,
          info.constructionAppearance,
          { constructionEndpoints: true, idPrefix: "sketchConstructionProperty" },
        ), ' data-sketch-default-appearance="construction"') + collapsibleSketchAppearanceSection("dimension", "寸法外観", "Dimension Appearance", dimensionAppearancePropertyRows(
          item.dimensionAppearance,
          info.dimensionAppearance,
          { idPrefix: "sketchDimension" },
        ), ' data-sketch-default-appearance="dimension"');
        return `<h2 class="property-heading">${applicationText("スケッチ", "Sketch")}</h2><section class="property-section">${basicInformationHeading}${rows}</section>${appearanceSections}`;
      }
    }
    return Object.freeze({ render });
  }
  window.PropertiesContent = Object.freeze({ create });
})();
