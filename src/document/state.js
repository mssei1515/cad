/* Document data lifecycle; editing sessions, caches and UI belong to callers. */
(() => {
  "use strict";
  const { DEFAULT_DOCUMENT_NAME } = window.DocumentFiles;
  const { ROOT_SKETCH_ID, ROOT_SKETCH_NAME, DEFAULT_SKETCH_ID, DEFAULT_SKETCH_NAME } = window.SketchHierarchy;
  const { DEFAULT_APPEARANCE, DEFAULT_CONSTRUCTION_APPEARANCE, DEFAULT_DIMENSION_APPEARANCE } = window.Appearance;
  const DEFAULT_DOCUMENT_UNITS = Object.freeze({ length: "mm" });
  const contentArrays = ["points", "lines", "circles", "arcs", "splines", "constraints",
    "blockDefinitions", "blockInstances", "geometryInstances", "hatches", "referenceImages"];

  function initialSketches() {
    return [
      { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", appearance: {}, constructionAppearance: {}, dimensionAppearance: {} },
      { id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {} },
    ];
  }

  function create() {
    return {
      documentName: DEFAULT_DOCUMENT_NAME, units: { ...DEFAULT_DOCUMENT_UNITS },
      defaultAppearance: null, defaultConstructionAppearance: null, defaultDimensionAppearance: null,
      sketches: initialSketches(), activeSketchId: DEFAULT_SKETCH_ID,
      annotations: [], nextHatchIndex: 1, parameters: [], nextDimensionParameterIndex: 1,
      ...Object.fromEntries(contentArrays.map(key => [key, []])),
    };
  }

  // First reset phase: preserve collection references while removing geometry.
  function clearContent(document) {
    document.documentName = DEFAULT_DOCUMENT_NAME;
    document.units = { ...DEFAULT_DOCUMENT_UNITS };
    for (const key of contentArrays) document[key].length = 0;
    document.parameters = [];
    document.nextDimensionParameterIndex = 1;
  }

  // Final reset phase, after callers cancel editing sessions and reset IDs.
  function resetDefaults(document) {
    document.sketches.length = 0;
    document.sketches.push(...initialSketches());
    document.activeSketchId = DEFAULT_SKETCH_ID;
    document.defaultAppearance = { ...DEFAULT_APPEARANCE };
    document.defaultConstructionAppearance = { ...DEFAULT_CONSTRUCTION_APPEARANCE };
    document.defaultDimensionAppearance = { ...DEFAULT_DIMENSION_APPEARANCE };
    document.annotations = [];
    document.hatches = [];
    document.referenceImages = [];
    document.nextHatchIndex = 1;
  }

  window.DocumentState = Object.freeze({ DEFAULT_DOCUMENT_UNITS, create, clearContent, resetDefaults });
})();
