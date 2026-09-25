/* Own the appearance color palette session, used colors and commit routing. */
(() => {
  "use strict";
  function create({ document, documentModel, currentScope, applicationText, escapeHtml,
    colorPickerValue, localizeApplicationUI, selectedPropertiesTarget, multiplePropertyValue,
    multiplePropertyAppearance, mixedValue: MULTIPLE_PROPERTY_MIXED, appearanceOwnerForPropertiesTarget,
    normalizeAnnotationStyle, applyMultipleProperty, applyDimensionAppearanceValue, normalizeHatchAppearance,
    applyAnnotationStyleValue, applyAppearanceInput, invalidateBlockProjectionCache, normalizeAppearance,
    normalizeConstructionAppearance, normalizeDimensionAppearance, recordHistory, updateUI, draw }) {
    let colorPaletteSession = null;
    const DEFAULT_COLOR_PALETTE = [
      "#000000", "#111827", "#374151", "#64748b", "#94a3b8", "#cbd5e1", "#ffffff",
      "#fca5a5", "#dc2626", "#991b1b",
      "#fdba74", "#f97316", "#c2410c",
      "#fde68a", "#f59e0b", "#b45309",
      "#86efac", "#16a34a", "#166534",
      "#5eead4", "#14b8a6", "#0f766e",
      "#67e8f9", "#0ea5e9", "#0e7490",
      "#93c5fd", "#2563eb", "#1e40af",
      "#c4b5fd", "#7c3aed", "#5b21b6",
      "#f9a8d4", "#db2777", "#9d174d",
    ];
    function usedFileColors() {
      const model = currentScope();
      const colors = [];
      const seen = new Set();
      const add = (value) => {
        const color = String(value || "").trim();
        if (!/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color)) return;
        const normalized = colorPickerValue(color);
        if (seen.has(normalized)) return;
        seen.add(normalized);
        colors.push(normalized);
      };
      const addAppearance = (appearance) => add(appearance?.color);
      addAppearance(documentModel.defaultAppearance);
      addAppearance(documentModel.defaultConstructionAppearance);
      addAppearance(documentModel.defaultDimensionAppearance);
      for (const sketch of model.sketches) {
        addAppearance(sketch.appearance);
        addAppearance(sketch.constructionAppearance);
        addAppearance(sketch.dimensionAppearance);
      }
      for (const item of [...model.points, ...model.lines, ...model.circles, ...model.arcs, ...model.splines]) addAppearance(item.appearance);
      for (const instance of model.blockInstances) addAppearance(instance.appearanceOverride);
      for (const instance of model.geometryInstances) addAppearance(instance.appearanceOverride);
      for (const constraint of model.constraints) addAppearance(constraint.dimension?.display);
      for (const hatch of model.hatches) addAppearance(hatch.appearance);
      for (const annotation of model.annotations) add(annotation.style?.color);
      for (const definition of documentModel.blockDefinitions) {
        for (const hatch of definition.hatches || []) addAppearance(hatch.appearance);
        for (const sketch of definition.sketches || []) {
          addAppearance(sketch.appearance);
          addAppearance(sketch.constructionAppearance);
          addAppearance(sketch.dimensionAppearance);
        }
        for (const item of [...(definition.points || []), ...(definition.lines || []), ...(definition.circles || []), ...(definition.arcs || []), ...(definition.splines || [])]) addAppearance(item.appearance);
        for (const instance of definition.blockInstances || []) addAppearance(instance.appearanceOverride);
        for (const instance of definition.geometryInstances || []) addAppearance(instance.appearanceOverride);
        for (const constraint of definition.constraints || []) addAppearance(constraint.dimension?.display);
        for (const annotation of definition.annotations || []) add(annotation.style?.color);
      }
      return colors;
    }

    function colorPaletteSwatches(colors, selectedColor, groupLabel) {
      const selected = colorPickerValue(selectedColor);
      return colors.map((color) =>
        `<button class="property-color-swatch" data-palette-color="${color}" type="button" style="--swatch-color:${color}" title="${escapeHtml(groupLabel)}: ${color}" aria-label="${escapeHtml(groupLabel)}: ${color}" aria-pressed="${selected === color}"></button>`,
      ).join("");
    }

    function renderColorPaletteDialog(selectedColor) {
      const defaultPalette = document.getElementById("defaultColorPalette");
      const usedPalette = document.getElementById("usedColorPalette");
      const customPicker = document.getElementById("customColorPicker");
      const defaultsLabel = applicationText("標準色", "Standard colors");
      const usedLabel = applicationText("このファイルで使用中の色", "Colors used in this file");
      const selected = colorPickerValue(selectedColor);
      if (defaultPalette) defaultPalette.innerHTML = colorPaletteSwatches(DEFAULT_COLOR_PALETTE, selected, defaultsLabel);
      if (usedPalette) {
        const colors = usedFileColors();
        usedPalette.innerHTML = colors.length > 0
          ? colorPaletteSwatches(colors, selected, usedLabel)
          : `<p class="color-palette-empty">${applicationText("使用中の色はありません", "No colors are used yet")}</p>`;
      }
      if (customPicker) customPicker.value = selected;
      const dialog = document.getElementById("colorPaletteDialog");
      if (dialog) localizeApplicationUI(dialog);
    }

    function openAppearanceColorPalette(button, context = "properties") {
      let target = null;
      let owner = null;
      let historyLabel = "Appearance変更";
      if (context === "document") {
        owner = documentModel.defaultAppearance;
        historyLabel = "Document Default Appearance変更";
      } else if (context === "document-construction") {
        owner = documentModel.defaultConstructionAppearance;
        historyLabel = "Document Default Construction Appearance変更";
      } else if (context === "document-dimension") {
        owner = documentModel.defaultDimensionAppearance;
        historyLabel = "Document Default Dimension Appearance変更";
      } else if (context === "sketch-construction") {
        target = selectedPropertiesTarget();
        owner = (target.item.constructionAppearance ||= {});
        historyLabel = "Sketch Default Construction Appearance変更";
      } else if (context === "sketch-dimension") {
        target = selectedPropertiesTarget();
        owner = (target.item.dimensionAppearance ||= {});
        historyLabel = "Sketch Default Dimension Appearance変更";
      } else {
        target = selectedPropertiesTarget();
        if (target.kind === "multiple") {
          const color = multiplePropertyValue(target, "color");
          owner = { color: color === MULTIPLE_PROPERTY_MIXED ? multiplePropertyAppearance(target.items[0]).color : color };
          historyLabel = "複数Objectプロパティ変更";
        } else if (target.kind === "constraint" && target.item.dimension) {
          owner = (target.item.dimension.display ||= {});
          historyLabel = "寸法外観変更";
        } else if (target.kind === "annotation") {
          owner = (target.item.style ||= normalizeAnnotationStyle());
          historyLabel = "注記外観変更";
        } else {
          owner = appearanceOwnerForPropertiesTarget(target);
          historyLabel = target.kind === "block" ? "Appearance Override変更" : "Appearance変更";
        }
      }
      if (!owner) return;
      colorPaletteSession = {
        owner,
        target,
        historyLabel,
        context,
        sourceButton: button,
        sourceInput: button.closest(".property-color-control")?.querySelector('[data-appearance-key="color"], [data-dimension-display="color"], [data-hatch-property="color"], [data-annotation-style="color"], [data-bulk-property="color"]') || null,
      };
      const selected = colorPaletteSession.sourceInput?.value.trim() || button.dataset.currentColor || owner.color;
      renderColorPaletteDialog(selected);
      const dialog = document.getElementById("colorPaletteDialog");
      if (dialog && !dialog.open) dialog.showModal();
    }

    function commitColorPaletteValue(value) {
      if (!colorPaletteSession) return;
      const color = colorPickerValue(value);
      const { owner, target, historyLabel, context, sourceButton, sourceInput } = colorPaletteSession;
      if (target?.kind === "multiple") {
        document.getElementById("colorPaletteDialog")?.close();
        colorPaletteSession = null;
        applyMultipleProperty(target, "color", color);
        return;
      }
      if (target?.kind === "constraint" || context === "sketch-dimension" || context === "document-dimension") applyDimensionAppearanceValue(owner, "color", color, { allowInheritance: context !== "document-dimension" });
      else if (target?.kind === "hatch") Object.assign(owner, normalizeHatchAppearance({ ...owner, color }));
      else if (target?.kind === "annotation") applyAnnotationStyleValue(target.item, "color", color);
      else applyAppearanceInput(owner, "color", color);
      if (target?.kind === "block") invalidateBlockProjectionCache(target.item.id);
      if (context === "document") documentModel.defaultAppearance = normalizeAppearance(documentModel.defaultAppearance, { partial: false });
      if (context === "document-construction") documentModel.defaultConstructionAppearance = normalizeConstructionAppearance(documentModel.defaultConstructionAppearance, { partial: false });
      if (context === "document-dimension") documentModel.defaultDimensionAppearance = normalizeDimensionAppearance(documentModel.defaultDimensionAppearance, { partial: false });
      if (sourceInput) sourceInput.value = color;
      if (sourceButton) {
        sourceButton.dataset.currentColor = color;
        sourceButton.querySelector(".property-color-picker-swatch")?.style.setProperty("--swatch-color", color);
      }
      recordHistory(historyLabel);
      document.getElementById("colorPaletteDialog")?.close();
      colorPaletteSession = null;
      updateUI();
      draw();
    }

    function bind() {
      document.getElementById("colorPaletteDialog")?.addEventListener("click", (event) => {
        const swatch = event.target.closest("[data-palette-color]");
        if (swatch) commitColorPaletteValue(swatch.dataset.paletteColor);
      });
      document.getElementById("applyCustomColorBtn")?.addEventListener("click", () => {
        commitColorPaletteValue(document.getElementById("customColorPicker")?.value);
      });
      document.getElementById("colorPaletteDialog")?.addEventListener("close", () => {
        colorPaletteSession = null;
      });
    }
    return Object.freeze({ open: openAppearanceColorPalette, commit: commitColorPaletteValue, bind });
  }
  window.AppearancePalette = Object.freeze({ create });
})();
