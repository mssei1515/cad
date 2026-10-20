/* Compose shared appearance controls, palette and Document settings; editing and palette state retain their owners. */
(() => {
  "use strict";
  function create({ document, documentModel, currentScope, propertySelection, appearanceEditing, appearancePropertyCommand, applyMultipleProperty,
    applicationText, escapeHtml, localizeApplicationUI, effectiveLeaderAppearanceForSketch, readViewportScale,
    invalidateBlockProjectionCache, recordHistory, updateUI, draw }) {
    const { normalizeAppearance, normalizeAnnotationStyle, normalizeHatchAppearance, normalizeConstructionAppearance, normalizeDimensionAppearance,
      DIMENSION_APPEARANCE_LENGTH_KEYS, DEFAULT_DIMENSION_APPEARANCE } = window.Appearance;
    const { formatDisplayNumber } = window.NumberDisplay;
    const { applyAppearanceInput, applyAnnotationStyleValue, applyDimensionAppearanceValue } = appearanceEditing;
    const appearanceControls = window.AppearanceControls.create({
      applicationText, escapeHtml, formatDisplayNumber, normalizeAppearance, normalizeDimensionAppearance,
      dimensionLengthKeys: DIMENSION_APPEARANCE_LENGTH_KEYS, defaultDimensionAppearance: DEFAULT_DIMENSION_APPEARANCE,
    });
    const appearancePalette = window.AppearancePalette.create({
      document, documentModel, currentScope, applicationText, escapeHtml,
      colorPickerValue: appearanceControls.colorPickerValue, localizeApplicationUI, selectedPropertiesTarget: propertySelection.selectedDisplayTarget,
      multiplePropertyValue: propertySelection.multiplePropertyValue, multiplePropertyAppearance: propertySelection.multiplePropertyAppearance,
      mixedValue: window.PropertySelection.mixedValue, appearanceOwnerForPropertiesTarget: appearancePropertyCommand.owner,
      normalizeAnnotationStyle, applyMultipleProperty, applyDimensionAppearanceValue, normalizeHatchAppearance,
      applyAnnotationStyleValue, applyAppearanceInput, invalidateBlockProjectionCache, normalizeAppearance,
      normalizeConstructionAppearance, normalizeDimensionAppearance, recordHistory, updateUI, draw,
    });
    const { appearancePropertyRows, dimensionAppearancePropertyRows, prepareAffixInputs, updateDimensionTerminatorAngleVisibility } = appearanceControls;
    const openAppearanceColorPalette = appearancePalette.open;

    function start() {
      const documentAppearanceEditor = window.DocumentAppearanceEditor.create({
        document, readDefault: key => documentModel[key], writeDefault: (key, value) => { documentModel[key] = value; },
        editing: appearanceEditing, appearanceControls,
        rows: { geometry: appearancePropertyRows, dimension: dimensionAppearancePropertyRows },
        prepareAffixInputs, localizeApplicationUI, updateDimensionTerminatorAngleVisibility,
        effectiveLeaderAppearanceForSketch, readViewportScale,
        openAppearanceColorPalette, recordHistory, updateUI, draw,
      });
      documentAppearanceEditor.start();
      appearancePalette.bind();
    }
    return Object.freeze({ controls: appearanceControls, openPalette: openAppearanceColorPalette, start });
  }
  window.AppearanceUI = Object.freeze({ create });
})();
