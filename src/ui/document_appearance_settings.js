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
  window.DocumentAppearanceSettings = Object.freeze({ createGeometry });
})();
