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
    document.defaultDimensionAppearance = window.Appearance.dimensionDefaults();
    document.defaultTerminatorAppearance = { ...window.Appearance.DEFAULT_TERMINATOR };
    document.defaultLeaderAppearance = window.Appearance.leaderDefaults();
    document.annotations = [];
    document.hatches = [];
    document.referenceImages = [];
    document.nextHatchIndex = 1;
  }

  function normalizeAppearanceState(document, scope, { blockEditing = false } = {}) {
    const { normalizeAppearance, normalizeConstructionAppearance, normalizeDimensionAppearance } = window.Appearance;
    const { isRootSketch } = window.SketchHierarchy;
    const { normalizeAnnotations } = window.AnnotationData;
    const { normalizeHatches } = window.HatchData;
    const { normalizeReferenceImages } = window.ReferenceImageData;
    document.defaultTerminatorAppearance = window.Appearance.normalizeTerminator(document.defaultTerminatorAppearance || document.defaultDimensionAppearance, { partial: false });
    document.defaultLeaderAppearance = window.Appearance.leaderDefaults(document.defaultLeaderAppearance);
    document.defaultAppearance = normalizeAppearance(document.defaultAppearance, { partial: false });
    document.defaultConstructionAppearance = normalizeConstructionAppearance(document.defaultConstructionAppearance, { partial: false });
    document.defaultDimensionAppearance = window.Appearance.dimensionDefaults(document.defaultDimensionAppearance);
    const root = scope.sketches.find((sketch) => isRootSketch(sketch));
    if (root) {
      const legacyAppearance = normalizeAppearance(root.appearance);
      const legacyConstructionAppearance = normalizeConstructionAppearance(root.constructionAppearance);
      const legacyDimensionAppearance = normalizeDimensionAppearance(root.dimensionAppearance);
      if (blockEditing) {
        for (const sketch of scope.sketches.filter((item) => !isRootSketch(item))) {
          sketch.appearance = { ...legacyAppearance, ...normalizeAppearance(sketch.appearance) };
          sketch.constructionAppearance = { ...legacyConstructionAppearance, ...normalizeConstructionAppearance(sketch.constructionAppearance) };
          sketch.dimensionAppearance = { ...legacyDimensionAppearance, ...normalizeDimensionAppearance(sketch.dimensionAppearance) };
        }
      } else {
        document.defaultAppearance = { ...document.defaultAppearance, ...legacyAppearance };
        document.defaultConstructionAppearance = { ...document.defaultConstructionAppearance, ...legacyConstructionAppearance };
        Object.assign(document.defaultTerminatorAppearance, window.Appearance.normalizeTerminator(legacyDimensionAppearance));
        document.defaultDimensionAppearance = window.Appearance.dimensionDefaults({ ...document.defaultDimensionAppearance, ...legacyDimensionAppearance });
      }
      root.appearance = {};
      root.constructionAppearance = {};
      root.dimensionAppearance = {};
    }
    const fallbackSketchId = scope.sketches.find((sketch) => !isRootSketch(sketch))?.id || DEFAULT_SKETCH_ID;
    scope.annotations = normalizeAnnotations(scope.annotations, fallbackSketchId);
    scope.hatches = normalizeHatches(scope.hatches, fallbackSketchId);
    scope.referenceImages = normalizeReferenceImages(scope.referenceImages, fallbackSketchId);
    for (const item of [...scope.points, ...scope.lines, ...scope.circles, ...scope.arcs, ...scope.splines]) item.appearance = normalizeAppearance(item.appearance);
  }

  window.DocumentState = Object.freeze({ DEFAULT_DOCUMENT_UNITS, create, clearContent, resetDefaults, normalizeAppearanceState });
})();
