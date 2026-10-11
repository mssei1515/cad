/* Classify a placement candidate without committing a dimension or changing UI state. */
(() => {
  "use strict";
  function create({ fromTarget, activeSketchId, assignSketch, markReference, probeRedundancy, targetItems }) {
    function forPlacement(target, value, dimension, options = {}) {
      const { constraint } = fromTarget(target, value, dimension);
      if (!constraint) return null;
      if (options.readOnlyDimension) return assignSketch(constraint, options.sketchId || activeSketchId());
      const items = targetItems(target);
      const blockInstances = [...new Set(items.map((item) => item?.blockInstance).filter(Boolean))];
      if (items.length > 0 && blockInstances.length === 1 && items.every((item) => item?.blockInstance === blockInstances[0])) return constraint;
      const sketchId = options.sketchId || activeSketchId();
      assignSketch(constraint, sketchId);
      if (options.referenceSketchId) markReference(constraint, options.referenceSketchId, sketchId);
      const duplicate = probeRedundancy(constraint, sketchId);
      return duplicate?.redundant ? constraint : null;
    }
    return Object.freeze({ forPlacement });
  }
  window.DimensionReadOnlyQuery = Object.freeze({ create });
})();
