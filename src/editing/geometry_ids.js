/* Geometry ID allocation and partial checkpoints; no Document or UI state. */
(function () {
  "use strict";
  const definitions = Object.freeze({ point: ["pointSeq", "P", "points"], line: ["lineSeq", "L", "lines"], circle: ["circleSeq", "C", "circles"], arc: ["arcSeq", "A", "arcs"], spline: ["splineSeq", "SP", "splines"] });
  function nextSeq(items, prefix) {
    const max = items.reduce((n, item) => {
      const match = String(item.id).match(new RegExp(`^${prefix}(\\d+)$`));
      return match ? Math.max(n, Number(match[1])) : n;
    }, 0);
    return max + 1;
  }

  function create() {
    const values = {};
    function reset() { for (const [field] of Object.values(definitions)) values[field] = 1; }
    function definition(kind) { const entry = definitions[kind]; if (!entry) throw new RangeError("Unknown Geometry kind: " + kind); return entry; }
    function allocate(kind) { const [field, prefix] = definition(kind); return prefix + values[field]++; }
    function peek(kind) { return values[definition(kind)[0]]; }
    function snapshot(kinds = Object.keys(definitions)) { return Object.fromEntries(kinds.map(kind => { const [field] = definition(kind); return [field, values[field]]; })); }
    function restore(snapshot) { for (const [field] of Object.values(definitions)) if (Object.prototype.hasOwnProperty.call(snapshot, field)) values[field] = snapshot[field]; }
    function reserve(source) { for (const [field, prefix, collection] of Object.values(definitions)) values[field] = Math.max(values[field], nextSeq(source?.[collection] || [], prefix)); }
    reset();
    return Object.freeze({ allocate, peek, snapshot, restore, reserve, reset });
  }
  window.GeometryIds = Object.freeze({ create, nextSeq });
})();
