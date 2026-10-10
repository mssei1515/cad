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
    return Object.freeze({ remapClipboardValue, translatedClipboardConstraintData, mapClipboardBlockProjection });
  }
  window.ClipboardTransfer = Object.freeze({ create });
})();
