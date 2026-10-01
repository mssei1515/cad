/* Own canvas hover references and transient preview/restore operations. */
(() => {
  "use strict";
  const fields = Object.freeze(["point","endpointPoint","line","circle","arc","spline","block","geometryInstance","arcEndpoint","dimension","annotation","hatch","referenceImage","sketchIdentity"]);
  const contextFields = fields.filter(field => field !== "referenceImage");
  function create({ isEndpointPoint }) {
    const empty = () => Object.fromEntries(fields.map(field => [field, null]));
    let current = Object.freeze(empty());
    function update(values) {
      const next = { ...current };
      for (const field of fields) if (Object.hasOwn(values, field)) next[field] = values[field];
      current = Object.freeze(next);
    }
    function clear() { current = Object.freeze(empty()); }
    function capture() { return Object.fromEntries(contextFields.map(field => [field, current[field]])); }
    function restore(snapshot) {
      if (snapshot) update(Object.fromEntries(contextFields.map(field => [field, snapshot[field]])));
    }
    function previewCandidate(target) {
      clear();
      if (target.kind === "point") {
        update({ point: target.item });
        update({ endpointPoint: isEndpointPoint(target.item) ? target.item : null });
      } else if (target.kind === "line") update({ line: target.item });
      else if (target.kind === "circle") update({ circle: target.item });
      else if (target.kind === "arc") update({ arc: target.item });
      else if (target.kind === "spline") update({ spline: target.item });
      else if (target.kind === "arc-endpoint") update({ arcEndpoint: { arc: target.item, endpoint: target.endpoint } });
      else if (target.kind === "dimension") update({ dimension: target.item });
      else if (target.kind === "block") update({ block: target.item });
      else if (target.kind === "geometry-instance") update({ geometryInstance: target.item });
      else if (target.kind === "annotation") update({ annotation: target.item });
      else if (target.kind === "hatch") update({ hatch: target.item });
    }

    return Object.freeze({ get current() { return current; }, update, clear, capture, restore, previewCandidate });
  }
  window.CanvasHover = Object.freeze({ create });
})();
