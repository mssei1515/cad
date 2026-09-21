(() => {
  "use strict";
  const { create: createGeometryRef, parseId: parseGeometryRefId } = window.GeometryRef;
  const { normalizeAppearance } = window.Appearance;
  const { normalizedDrawingOrder } = window.DrawingOrder;
  function create({ applicationText }) {
    function normalizeGeometryInstanceRef(value, expectedKind = null) {
      const ref = value?.kind && Array.isArray(value.path)
        ? createGeometryRef(value.kind, value.path)
        : expectedKind && (typeof value === "string" || typeof value === "number")
        ? parseGeometryRefId(expectedKind, value)
        : null;
      return ref && (!expectedKind || ref.kind === expectedKind) ? ref : null;
    }

    function normalizeGeometryInstance(raw, normalizeSketch, index = 0) {
      const type = ["mirror", "pattern", "free"].includes(raw?.type) ? raw.type : "sketchProjection";
      const prefix = type === "free" ? "FI" : type === "mirror" ? "MI" : type === "pattern" ? "PI" : "SPI";
      const sources = (Array.isArray(raw?.sources) ? raw.sources : [])
        .map((entry) => normalizeGeometryInstanceRef(entry))
        .filter(Boolean);
      const instance = {
        id: String(raw?.id || `${prefix}${index + 1}`),
        type,
        sketchId: normalizeSketch(raw?.sketchId),
        drawingOrder: normalizedDrawingOrder(raw?.drawingOrder),
        sources,
        appearanceOverride: normalizeAppearance(raw?.appearanceOverride),
      };
      if (type === "free") Object.assign(instance, {
        x: Number(raw?.x ?? 0), y: Number(raw?.y ?? 0), rotation: Number(raw?.rotation ?? 0),
        origin: { x: Number(raw?.origin?.x ?? 0), y: Number(raw?.origin?.y ?? 0) },
        mirrorX: Boolean(raw?.mirrorX), mirrorY: Boolean(raw?.mirrorY),
      });
      if (type === "mirror") instance.axis = normalizeGeometryInstanceRef(raw?.axis, "line");
      if (type === "pattern") {
        instance.direction = normalizeGeometryInstanceRef(raw?.direction, "line");
        instance.spacing = Number(raw?.spacing);
        instance.copies = Math.trunc(Number(raw?.copies));
        instance.reversed = Boolean(raw?.reversed);
      }
      if (raw?.legacyOutput && typeof raw.legacyOutput === "object") {
        instance.legacyOutput = {
          kind: String(raw.legacyOutput.kind || ""),
          id: String(raw.legacyOutput.id || ""),
          pointIds: Array.isArray(raw.legacyOutput.pointIds) ? raw.legacyOutput.pointIds.map(String) : [],
        };
      }
      return instance;
    }

    function migrateLegacySketchProjectionNamespace(namespace, sourceVersion) {
      if (!namespace || sourceVersion < 19 || sourceVersion >= 21) return namespace;
      const constraints = Array.isArray(namespace.constraints) ? namespace.constraints : [];
      const projections = constraints.filter((constraint) => constraint?.type === "sketchProjection");
      if (projections.length === 0) {
        namespace.geometryInstances = [];
        return namespace;
      }
      const listByKind = { point: namespace.points || [], line: namespace.lines || [], circle: namespace.circles || [], arc: namespace.arcs || [], spline: namespace.splines || [] };
      const removedByKind = new Map();
      namespace.geometryInstances = projections.map((constraint, index) => {
        const kind = String(constraint.kind || "");
        const targetId = String(constraint.target || "");
        const target = (listByKind[kind] || []).find((item) => String(item.id) === targetId);
        const pointIds = kind === "point" ? [targetId]
          : kind === "line" ? [target?.p1, target?.p2]
          : kind === "circle" || kind === "arc" ? [target?.center]
          : kind === "spline" ? target?.fitPoints || [] : [];
        if (!removedByKind.has(kind)) removedByKind.set(kind, new Set());
        removedByKind.get(kind).add(targetId);
        return {
          id: `SPI${index + 1}`,
          type: "sketchProjection",
          sketchId: constraint.sketchId || target?.sketchId,
          sources: [{ kind, path: String(constraint.source || "").split("@") }],
          appearanceOverride: normalizeAppearance(target?.appearance),
          legacyOutput: { kind, id: targetId, pointIds: pointIds.filter((id) => id != null).map(String) },
        };
      });
      for (const [kind, ids] of removedByKind) {
        if (kind === "point") continue;
        const property = `${kind}s`;
        namespace[property] = (namespace[property] || []).filter((item) => !ids.has(String(item.id)));
      }
      const usedPointIds = new Set();
      for (const line of namespace.lines || []) usedPointIds.add(String(line.p1)).add(String(line.p2));
      for (const primitive of [...(namespace.circles || []), ...(namespace.arcs || [])]) usedPointIds.add(String(primitive.center));
      for (const spline of namespace.splines || []) for (const id of spline.fitPoints || []) usedPointIds.add(String(id));
      const projectedPointIds = new Set(namespace.geometryInstances.flatMap((instance) => instance.legacyOutput.pointIds));
      namespace.points = (namespace.points || []).filter((point) => !projectedPointIds.has(String(point.id)) || usedPointIds.has(String(point.id)));
      namespace.constraints = constraints.filter((constraint) => constraint?.type !== "sketchProjection");
      return namespace;
    }

    function serializedGeometryInstanceListError(instances) {
      if (!Array.isArray(instances)) return applicationText("配列ではありません", "is not an array");
      const ids = new Set();
      const supportedTypes = new Set(["sketchProjection", "mirror", "pattern", "free"]);
      for (const raw of instances) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return applicationText("要素の形式が正しくありません", "contains an invalid entry");
        const id = typeof raw.id === "string" ? raw.id.trim() : "";
        if (!id) return applicationText("IDがありません", "contains an entry without an ID");
        if (ids.has(id)) return applicationText(`ID ${id} が重複しています`, `contains duplicate ID ${id}`);
        ids.add(id);
        if (!supportedTypes.has(raw.type)) return applicationText(`種類 ${String(raw.type || "")} は未対応です`, `contains unsupported type ${String(raw.type || "")}`);
        if (raw.type === "free" && (![raw.x, raw.y, raw.rotation, raw.origin?.x, raw.origin?.y].every((v) => typeof v === "number" && Number.isFinite(v)) || typeof raw.mirrorX !== "boolean" || typeof raw.mirrorY !== "boolean")) return applicationText(`${id} の配置設定が正しくありません`, `${id} has invalid placement settings`);
        if (!Array.isArray(raw.sources) || raw.sources.length === 0 || raw.sources.some((ref) => !normalizeGeometryInstanceRef(ref))) {
          return applicationText(`${id} の複写元が正しくありません`, `${id} has invalid source geometry`);
        }
        if (raw.type === "mirror" && !normalizeGeometryInstanceRef(raw.axis, "line")) return applicationText(`${id} のミラー軸が正しくありません`, `${id} has an invalid mirror axis`);
        if (raw.type === "pattern") {
          if (!normalizeGeometryInstanceRef(raw.direction, "line")) return applicationText(`${id} のパターン方向が正しくありません`, `${id} has an invalid pattern direction`);
          if (!(Number(raw.spacing) > 0) || !Number.isInteger(Number(raw.copies)) || !(Number(raw.copies) > 0) || Number(raw.copies) > 1000) {
            return applicationText(`${id} のパターン設定が正しくありません`, `${id} has invalid pattern settings`);
          }
        }
        if (raw.legacyOutput != null) {
          const legacy = raw.legacyOutput;
          if (!legacy || typeof legacy !== "object" || Array.isArray(legacy) || typeof legacy.kind !== "string" || typeof legacy.id !== "string" || !legacy.id || !Array.isArray(legacy.pointIds)) {
            return applicationText(`${id} の旧投影出力が正しくありません`, `${id} has invalid legacy projection output`);
          }
        }
      }
      return "";
    }

    return Object.freeze({ normalizeRef: normalizeGeometryInstanceRef, normalize: normalizeGeometryInstance,
      migrateLegacy: migrateLegacySketchProjectionNamespace, listError: serializedGeometryInstanceListError });
  }
  window.GeometryInstancePersistence = Object.freeze({ create });
})();
