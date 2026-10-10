/* Transform copied values and reconnect projection IDs; no selection, paste session or history. */
(() => {
  "use strict";
  function create({ blockProjectionBundle, blockProjectionLocalId }) {
    function remapClipboardValue(value, idMap) {
      if (typeof value === "string") return idMap.get(value) || value;
      if (Array.isArray(value)) return value.map((item) => remapClipboardValue(item, idMap));
      if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remapClipboardValue(item, idMap)]));
      }
      return value;
    }

    function translatedClipboardConstraintData(source, idMap, dx, dy) {
      const data = remapClipboardValue(source, idMap);
      if (data.dimension) {
        for (const key of ["x", "labelX"]) if (Number.isFinite(Number(data.dimension[key]))) data.dimension[key] = Number(data.dimension[key]) + dx;
        for (const key of ["y", "labelY"]) if (Number.isFinite(Number(data.dimension[key]))) data.dimension[key] = Number(data.dimension[key]) + dy;
      }
      window.ConstraintRebinding.translateFixedValues(data, dx, dy);
      delete data.reference;
      delete data.referenceSketchId;
      return data;
    }

    function remapGeometryRef(ref, idMap) {
      if (!ref) return ref;
      const mapped = idMap.get(ref.path.join("@"));
      return { kind: ref.kind, path: mapped ? mapped.split("@") : ref.path.flatMap(id => (idMap.get(id) || id).split("@")) };
    }

    function copiedGeometryInstance(source, idMap, targetSketchId, dx, dy) {
      const data = { ...source, id: idMap.get(source.id), sketchId: targetSketchId,
        sources: source.sources.map(ref => remapGeometryRef(ref, idMap)),
        appearanceOverride: { ...source.appearanceOverride } };
      delete data.projection;
      delete data.sourcePositions;
      delete data.legacyOutput;
      if (source.axis) data.axis = remapGeometryRef(source.axis, idMap);
      if (source.direction) data.direction = remapGeometryRef(source.direction, idMap);
      if (source.type === "free") {
        data.x = source.x + dx; data.y = source.y + dy;
        data.origin = { ...source.origin };
      }
      return data;
    }

    function copiedFreeOrigin(source, instance, sourcePoints) {
      const deltas = [];
      for (let index = 0; index < instance.sources.length; index++) {
        const before = source.sourcePositions?.[index] || [];
        const after = sourcePoints(instance.sources[index]);
        if (!before.length || before.length !== after.length) return { ...source.origin };
        before.forEach((point, i) => deltas.push({ x: after[i].x - point.x, y: after[i].y - point.y }));
      }
      const delta = deltas[0];
      if (!delta || !deltas.every(value => Math.abs(value.x - delta.x) < 1e-8 && Math.abs(value.y - delta.y) < 1e-8)) return { ...source.origin };
      return { x: source.origin.x + delta.x, y: source.origin.y + delta.y };
    }

    function mapClipboardBlockProjection(source, instance, idMap, pointById, lineById, primitiveById) {
      const projection = source.projection || {};
      const bundle = blockProjectionBundle(instance);
      const mapKind = (records, items, destination) => {
        const byLocalId = new Map(items.map((item) => [String(blockProjectionLocalId(item)), item]));
        for (const record of records || []) {
          const item = byLocalId.get(String(record.localId));
          if (!item) continue;
          idMap.set(String(record.id), item.id);
          destination.set(item.id, item);
        }
      };
      mapKind(projection.points, bundle.points, pointById);
      mapKind(projection.lines, bundle.lines, lineById);
      mapKind(projection.circles, bundle.circles, primitiveById);
      mapKind(projection.arcs, bundle.arcs, primitiveById);
      mapKind(projection.splines, bundle.splines || [], primitiveById);
    }
    return Object.freeze({ remapClipboardValue, remapGeometryRef, copiedGeometryInstance, copiedFreeOrigin, translatedClipboardConstraintData, mapClipboardBlockProjection });
  }
  window.ClipboardTransfer = Object.freeze({ create });
})();
