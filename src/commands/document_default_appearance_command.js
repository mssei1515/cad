/* Update Document Geometry defaults through existing value, normalization and notification owners. */
(() => {
  "use strict";
  function createGeometry({ readDefault, writeDefault, applyAppearanceInput, normalizeAppearance, normalizeConstructionAppearance, recordHistory, updateUI, draw }) {
    function apply(field, key, value, normalize, historyLabel) {
      applyAppearanceInput(readDefault(field), key, value);
      writeDefault(field, normalize(readDefault(field), { partial: false }));
      recordHistory(historyLabel);
      updateUI();
      draw();
    }
    function normal(key, value) { apply("defaultAppearance", key, value, normalizeAppearance, "Document Default Appearance変更"); }
    function construction(key, value) { apply("defaultConstructionAppearance", key, value, normalizeConstructionAppearance, "Document Default Construction Appearance変更"); }
    return Object.freeze({ normal, construction });
  }
  window.DocumentDefaultAppearanceCommand = Object.freeze({ createGeometry });
})();
