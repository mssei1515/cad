/* Prepare Document default-appearance fields; mutations are supplied as commands. */
(() => {
  "use strict";
  function createGeometry({ document, readDefault, normalizeAppearance, normalizeConstructionAppearance, appearancePropertyRows, localizeApplicationUI, openAppearanceColorPalette, commands }) {
    function prepare() {
      const fields = document.getElementById("documentAppearanceFields");
      if (fields) {
        const appearance = normalizeAppearance(readDefault("defaultAppearance"), { partial: false });
        fields.innerHTML = appearancePropertyRows(appearance, appearance, { allowInheritance: false, idPrefix: "documentProperty" });
        localizeApplicationUI(fields);
        fields.onchange = (event) => {
          const input = event.target;
          if (!input.dataset.appearanceKey) return;
          commands.normal(input.dataset.appearanceKey, input.value.trim());
        };
        fields.onclick = (event) => {
          const button = event.target.closest("[data-appearance-palette-open]");
          if (button) openAppearanceColorPalette(button, "document");
        };
      }
      const constructionFields = document.getElementById("documentConstructionAppearanceFields");
      if (constructionFields) {
        const appearance = normalizeConstructionAppearance(readDefault("defaultConstructionAppearance"), { partial: false });
        const effective = { ...normalizeAppearance(readDefault("defaultAppearance"), { partial: false }), ...appearance };
        constructionFields.innerHTML = appearancePropertyRows(appearance, effective, { allowInheritance: false, constructionEndpoints: true, idPrefix: "documentConstructionProperty" });
        localizeApplicationUI(constructionFields);
        constructionFields.onchange = (event) => {
          const input = event.target;
          if (!input.dataset.appearanceKey) return;
          commands.construction(input.dataset.appearanceKey, input.value.trim());
        };
        constructionFields.onclick = (event) => {
          const button = event.target.closest("[data-appearance-palette-open]");
          if (button) openAppearanceColorPalette(button, "document-construction");
        };
      }
    }
    return Object.freeze({ prepare });
  }
  function createDimension({ document, readDefault, normalizeDimensionAppearance, dimensionAppearancePropertyRows, prepareAffixInputs, localizeApplicationUI, updateDimensionTerminatorAngleVisibility, updateUI, openAppearanceColorPalette, commands }) {
    function prepare() {
      const dimensionFields = document.getElementById("documentDimensionAppearanceFields");
      if (dimensionFields) {
        const appearance = normalizeDimensionAppearance({ ...readDefault("defaultDimensionAppearance"), ...readDefault("defaultTerminatorAppearance") }, { partial: false });
        dimensionFields.innerHTML = dimensionAppearancePropertyRows(appearance, appearance, { allowInheritance: false, idPrefix: "documentDimension", terminals: false });
        prepareAffixInputs(dimensionFields);
        localizeApplicationUI(dimensionFields);
        updateDimensionTerminatorAngleVisibility(dimensionFields);
        const applyDimensionInput = (input, { history = true } = {}) => {
          if (!input.dataset.dimensionDisplay) return;
          const key = input.dataset.dimensionDisplay;
          const rawValue = ["prefix", "suffix"].includes(key) ? input.value : input.value.trim();
          commands.apply(key, rawValue, { history });
        };
        dimensionFields.oninput = (event) => {
          if (["prefix", "suffix"].includes(event.target.dataset.dimensionDisplay)) applyDimensionInput(event.target, { history: false });
        };
        dimensionFields.onchange = (event) => {
          applyDimensionInput(event.target);
          updateDimensionTerminatorAngleVisibility(dimensionFields);
          updateUI();
        };
        dimensionFields.onclick = (event) => {
          const button = event.target.closest("[data-appearance-palette-open]");
          if (button) openAppearanceColorPalette(button, "document-dimension");
        };
      }
    }
    return Object.freeze({ prepare });
  }
  function createShared({ document, readDefault, appearanceControls, effectiveLeaderAppearanceForSketch, openAppearanceColorPalette, commands }) {
    function prepare() {
      const terminalFields = document.getElementById("documentTerminatorAppearanceFields");
      const leaderFields = document.getElementById("documentLeaderAppearanceFields");
      const renderSharedDefaults = () => {
        const terminal = readDefault("defaultTerminatorAppearance");
        terminalFields.innerHTML = appearanceControls.terminatorPropertyRows(terminal, terminal, { allowInheritance: false, idPrefix: "documentTerminator", attribute: "data-terminal-style" });
        const leader = effectiveLeaderAppearanceForSketch(null);
        leaderFields.innerHTML = appearanceControls.leaderAppearancePropertyRows(leader, leader, { allowInheritance: false, idPrefix: "documentLeader", terminals: false });
      };
      renderSharedDefaults();
      terminalFields.onchange = event => {
        const key = event.target.dataset.terminalStyle;
        if (!key) return;
        commands.terminal(key, event.target.value, renderSharedDefaults);
      };
      leaderFields.onchange = event => {
        const key = event.target.dataset.leaderStyle;
        if (!key) return;
        commands.leader(key, event.target.type === "checkbox" ? !event.target.checked : event.target.value, renderSharedDefaults);
      };
      leaderFields.onclick = event => {
        const button = event.target.closest("[data-appearance-palette-open]");
        if (button) openAppearanceColorPalette(button, "document-leader");
      };
    }
    return Object.freeze({ prepare });
  }
  window.DocumentAppearanceSettings = Object.freeze({ createGeometry, createDimension, createShared });
})();
