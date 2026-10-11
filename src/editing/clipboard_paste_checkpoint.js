/* Restore only the append lengths and counters covered by a clipboard paste. */
(() => {
  "use strict";
  const collections = ["points", "lines", "circles", "arcs", "splines", "constraints", "blockInstances", "geometryInstances", "annotations", "hatches", "referenceImages"];
  function create({ geometryIds, captureSequences, restoreSequences }) {
    function capture(model) {
      const lengths = Object.fromEntries(collections.map(key => [key, model[key].length]));
      const sequences = { ...geometryIds.snapshot(), ...captureSequences(),
        nextHatchIndex: model.nextHatchIndex, nextDimensionParameterIndex: model.nextDimensionParameterIndex };
      function rollback() {
        for (const key of collections) model[key].length = lengths[key];
        geometryIds.restore(sequences);
        restoreSequences(sequences);
        model.nextHatchIndex = sequences.nextHatchIndex;
        model.nextDimensionParameterIndex = sequences.nextDimensionParameterIndex;
      }
      return Object.freeze({ rollback });
    }
    return Object.freeze({ capture });
  }
  window.ClipboardPasteCheckpoint = Object.freeze({ create });
})();
