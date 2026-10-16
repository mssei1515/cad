/* Assemble Document appearance commands, fields and dialog opening. */
(() => {
  "use strict";
  function create({ document, readDefault, writeDefault, editing, appearanceControls,
    rows: { geometry: appearancePropertyRows, dimension: dimensionAppearancePropertyRows },
    prepareAffixInputs, localizeApplicationUI, updateDimensionTerminatorAngleVisibility,
    effectiveLeaderAppearanceForSketch, readViewportScale, openAppearanceColorPalette, recordHistory, updateUI, draw }) {
    const { normalizeAppearance, normalizeConstructionAppearance, normalizeDimensionAppearance } = window.Appearance;
    const { applyAppearanceInput, applyDimensionAppearanceValue } = editing;
    const documentGeometryAppearanceCommand = window.DocumentDefaultAppearanceCommand.createGeometry({
      readDefault, writeDefault,
      applyAppearanceInput, normalizeAppearance, normalizeConstructionAppearance, recordHistory, updateUI, draw,
    });
    const documentGeometryAppearanceSettings = window.DocumentAppearanceSettings.createGeometry({
      document, readDefault, normalizeAppearance, normalizeConstructionAppearance,
      appearancePropertyRows, localizeApplicationUI, openAppearanceColorPalette, commands: documentGeometryAppearanceCommand,
    });
    const documentDimensionAppearanceCommand = window.DocumentDefaultAppearanceCommand.createDimension({
      readDefault, writeDefault,
      applyDimensionAppearanceValue, normalizeDimensionDefaults: value => window.Appearance.dimensionDefaults(value), recordHistory, draw,
    });
    const documentDimensionAppearanceSettings = window.DocumentAppearanceSettings.createDimension({
      document, readDefault, normalizeDimensionAppearance, dimensionAppearancePropertyRows,
      prepareAffixInputs, localizeApplicationUI, updateDimensionTerminatorAngleVisibility, updateUI, openAppearanceColorPalette, commands: documentDimensionAppearanceCommand,
    });
    const documentSharedAppearanceCommand = window.DocumentDefaultAppearanceCommand.createShared({
      readDefault, normalizeTerminator: value => window.Appearance.normalizeTerminator(value),
      applyLeaderAppearanceValue: (...args) => editing.applyLeaderAppearanceValue(...args), readViewportScale,
      effectiveLeaderAppearanceForSketch, recordHistory, updateUI, draw,
    });
    const documentSharedAppearanceSettings = window.DocumentAppearanceSettings.createShared({
      document, readDefault, appearanceControls, effectiveLeaderAppearanceForSketch, openAppearanceColorPalette, commands: documentSharedAppearanceCommand,
    });

    function open() {
      documentGeometryAppearanceSettings.prepare();
      documentDimensionAppearanceSettings.prepare();
      documentSharedAppearanceSettings.prepare();
      document.getElementById("documentSettingsDialog")?.showModal();
    }
    let button = null, started = false;
    function start() {
      if (started) return;
      started = true;
      button = document.getElementById("documentSettingsBtn");
      button?.addEventListener("click", open);
    }
    function dispose() {
      button?.removeEventListener("click", open);
      button = null;
      started = false;
    }
    return Object.freeze({ start, dispose, open });
  }
  window.DocumentAppearanceEditor = Object.freeze({ create });
})();
