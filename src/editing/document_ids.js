/* Runtime IDs for document elements; decoded sequence recovery stays in persistence. */
(() => {
  "use strict";
  const { nextSeq } = window.GeometryIds;
  const definitions = Object.freeze({
    sketch: ["sketchSeq", "S"], annotation: ["annotationSeq", "AN"], hatch: ["hatchSeq", "H"],
    referenceImage: ["referenceImageSeq", "IMG"], blockDefinition: ["blockDefinitionSeq", "B"],
    blockInstance: ["blockInstanceSeq", "BI"], sketchProjection: ["sketchProjectionInstanceSeq", "SPI"],
    mirror: ["mirrorInstanceSeq", "MI"], pattern: ["patternInstanceSeq", "PI"], free: ["freeInstanceSeq", "FI"],
  });
  const initial = Object.freeze({ sketchSeq: 2, annotationSeq: 1, hatchSeq: 1, referenceImageSeq: 1,
    blockDefinitionSeq: 1, blockInstanceSeq: 1, sketchProjectionInstanceSeq: 1, mirrorInstanceSeq: 1,
    patternInstanceSeq: 1, freeInstanceSeq: 1, blockElementSeq: 1 });
  function create() {
    let values;
    function reset() { values = { ...initial }; }
    function definition(kind) { const entry = definitions[kind]; if (!entry) throw new RangeError("Unknown document ID kind: " + kind); return entry; }
    function allocate(kind) { const [field, prefix] = definition(kind); return prefix + values[field]++; }
    function peek(kind) { return values[definition(kind)[0]]; }
    function snapshot(kinds) {
      const fields = kinds ? kinds.map(kind => definition(kind)[0]) : Object.keys(initial);
      return Object.fromEntries(fields.map(field => [field, values[field]]));
    }
    function restore(snapshot) {
      for (const field of Object.keys(initial)) if (Object.hasOwn(snapshot, field)) values[field] = snapshot[field];
    }
    function reserveAttachments(source) {
      values.hatchSeq = Math.max(values.hatchSeq, nextSeq(source?.hatches || [], "H"));
      values.referenceImageSeq = Math.max(values.referenceImageSeq, nextSeq(source?.referenceImages || [], "IMG"));
    }
    function reserveScope(source, nextHatchIndex) {
      values.sketchSeq = Math.max(values.sketchSeq, nextSeq(source.sketches || [], "S"));
      values.annotationSeq = Math.max(values.annotationSeq, nextSeq(source.annotations || [], "AN"));
      values.hatchSeq = Math.max(values.hatchSeq, nextHatchIndex, nextSeq(source.hatches || [], "H"));
      values.referenceImageSeq = Math.max(values.referenceImageSeq, nextSeq(source.referenceImages || [], "IMG"));
    }
    reset();
    return Object.freeze({ allocate, peek, snapshot, restore, reserveAttachments, reserveScope, reset });
  }
  function createReservation({ geometryIds, documentIds, nextHatchIndex }) {
    function geometry(source) {
      geometryIds.reserve(source);
      documentIds.reserveAttachments(source);
    }
    function scope(source) {
      geometry(source);
      documentIds.reserveScope(source, nextHatchIndex());
    }
    return Object.freeze({ geometry, scope });
  }
  window.DocumentIds = Object.freeze({ create, createReservation });
})();
