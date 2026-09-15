/* Document ownership and explicit local editing scopes. No UI, Solver or history. */
(function () {
  "use strict";
  const arrayFields = Object.freeze([
    "points", "lines", "circles", "arcs", "splines", "constraints", "parameters",
    "annotations", "hatches", "referenceImages", "blockInstances", "geometryInstances", "sketches",
  ]);
  const scopeFields = Object.freeze([...arrayFields, "activeSketchId", "nextHatchIndex", "nextDimensionParameterIndex"]);

  function prepare(scope) {
    for (const field of arrayFields) if (!Array.isArray(scope[field])) scope[field] = [];
    const nextHatch = scope.hatches.reduce((max, hatch) => {
      const match = /^H(\d+)$/.exec(String(hatch.id));
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;
    scope.nextHatchIndex = Math.max(nextHatch, Number(scope.nextHatchIndex) || 1);
    scope.nextDimensionParameterIndex = Math.max(1, Number(scope.nextDimensionParameterIndex) || 1);
    return scope;
  }

  function create(document) {
    let current = document;
    function activate(scope) {
      if (!scope || typeof scope !== "object") throw new TypeError("An editing scope is required");
      current = prepare(scope);
      return current;
    }
    function capture() {
      return { scope: current, values: Object.fromEntries(scopeFields.map((field) => [field, current[field]])) };
    }
    function restore(checkpoint) {
      for (const field of scopeFields) checkpoint.scope[field] = checkpoint.values[field];
      return activate(checkpoint.scope);
    }
    // A serialization input only; ownership remains with document and current scope.
    function snapshotSource() {
      if (current === document) return document;
      return { ...document, ...Object.fromEntries(scopeFields.map((field) => [field, current[field]])) };
    }
    return Object.freeze({ document, current: () => current, activate, capture, restore, snapshotSource });
  }
  window.EditingWorkspace = Object.freeze({ create });
})();
