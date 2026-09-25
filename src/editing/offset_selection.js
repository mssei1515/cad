/* Own the selected offset source, oriented chain and selection phase. */
(() => {
  "use strict";
  function create({ getModel, activeSketchId, elementSketchId, constraintSketchId,
    Line, Arc, CoincidentConstraint, ArcEndpointCoincidentConstraint,
    ArcEndpointArcEndpointCoincidentConstraint, OffsetChainConstraint, onSelectionChanged }) {
    let offsetSource = null;
    let offsetChainEntries = [];
    let offsetChainSelectionCommitted = false;
    function reset() {
      offsetSource = null;
      offsetChainEntries = [];
      offsetChainSelectionCommitted = false;
    }
    function selectSource(source) { offsetSource = source; }
    function commitSelection() { offsetChainSelectionCommitted = true; }
    function offsetEndpointToken(geometry, endpoint) {
      if (geometry instanceof Line) return endpoint === "start" ? geometry.p1 : geometry.p2;
      return `${geometry.id}:${endpoint}`;
    }

    function offsetChainTopology() {
      const parent = new Map();
      const ensure = (item) => {
        if (!parent.has(item)) parent.set(item, item);
        return item;
      };
      const find = (item) => {
        ensure(item);
        let root = item;
        while (parent.get(root) !== root) root = parent.get(root);
        let current = item;
        while (parent.get(current) !== current) {
          const next = parent.get(current);
          parent.set(current, root);
          current = next;
        }
        return root;
      };
      const union = (first, second) => {
        const a = find(first);
        const b = find(second);
        if (a !== b) parent.set(b, a);
      };
      for (const line of getModel().lines.filter((item) => elementSketchId(item) === activeSketchId())) {
        ensure(line.p1);
        ensure(line.p2);
      }
      for (const arc of getModel().arcs.filter((item) => elementSketchId(item) === activeSketchId())) {
        ensure(offsetEndpointToken(arc, "start"));
        ensure(offsetEndpointToken(arc, "end"));
      }
      for (const constraint of getModel().constraints) {
        if (constraint.enabled === false || constraintSketchId(constraint) !== activeSketchId()) continue;
        if (constraint instanceof CoincidentConstraint) union(constraint.p1, constraint.p2);
        else if (constraint instanceof ArcEndpointCoincidentConstraint) union(offsetEndpointToken(constraint.arc, constraint.endpoint), constraint.point);
        else if (constraint instanceof ArcEndpointArcEndpointCoincidentConstraint) {
          union(offsetEndpointToken(constraint.a, constraint.endpointA), offsetEndpointToken(constraint.b, constraint.endpointB));
        } else if (constraint instanceof OffsetChainConstraint) {
          const joinCount = constraint.closed ? constraint.offsets.length : constraint.offsets.length - 1;
          for (let index = 0; index < joinCount; index++) {
            const next = (index + 1) % constraint.offsets.length;
            union(offsetEndpointToken(constraint.offsets[index], "end"), offsetEndpointToken(constraint.offsets[next], "start"));
          }
        }
      }
      return { find };
    }

    function offsetChainEntryEndpoint(entry, endpoint, topology) {
      const nativeEndpoint = entry.reversed
        ? (endpoint === "start" ? "end" : "start")
        : endpoint;
      return topology.find(offsetEndpointToken(entry.geometry, nativeEndpoint));
    }

    function offsetChainIsClosed(entries = offsetChainEntries, topology = offsetChainTopology()) {
      return entries.length > 1
        && offsetChainEntryEndpoint(entries[0], "start", topology) === offsetChainEntryEndpoint(entries.at(-1), "end", topology);
    }

    function addOffsetChainGeometry(geometry) {
      if (!(geometry instanceof Line || geometry instanceof Arc) || geometry.blockProjection || elementSketchId(geometry) !== activeSketchId()) {
        return { ok: false, code: "unsupported" };
      }
      if (offsetChainEntries.some((entry) => entry.geometry === geometry)) return { ok: false, code: "already-selected" };
      if (offsetChainEntries.length === 0) {
        offsetChainEntries = [{ geometry, reversed: false }];
        offsetSource = geometry;
        onSelectionChanged();
        return { ok: true };
      }
      const topology = offsetChainTopology();
      if (offsetChainIsClosed(offsetChainEntries, topology)) return { ok: false, code: "closed-chain" };
      const head = offsetChainEntryEndpoint(offsetChainEntries[0], "start", topology);
      const tail = offsetChainEntryEndpoint(offsetChainEntries.at(-1), "end", topology);
      const candidateStart = topology.find(offsetEndpointToken(geometry, "start"));
      const candidateEnd = topology.find(offsetEndpointToken(geometry, "end"));
      let placement = null;
      if (candidateStart === tail && candidateEnd === head) placement = { position: "append", reversed: false };
      else if (candidateEnd === tail && candidateStart === head) placement = { position: "append", reversed: true };
      else if (candidateStart === tail) placement = { position: "append", reversed: false };
      else if (candidateEnd === tail) placement = { position: "append", reversed: true };
      else if (candidateEnd === head) placement = { position: "prepend", reversed: false };
      else if (candidateStart === head) placement = { position: "prepend", reversed: true };
      if (!placement) return { ok: false, code: "not-connected" };
      const entry = { geometry, reversed: placement.reversed };
      if (placement.position === "append") offsetChainEntries.push(entry);
      else offsetChainEntries.unshift(entry);
      offsetSource = offsetChainEntries[0].geometry;
      onSelectionChanged();
      return { ok: true, closed: offsetChainIsClosed(offsetChainEntries, topology) };
    }

    return Object.freeze({ reset, selectSource, commitSelection,
      add: addOffsetChainGeometry, isClosed: offsetChainIsClosed,
      get source() { return offsetSource; },
      get entries() { return offsetChainEntries.slice(); },
      get committed() { return offsetChainSelectionCommitted; },
    });
  }
  window.OffsetSelection = Object.freeze({ create });
})();
