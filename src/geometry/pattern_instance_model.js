/* Shared placement definitions. Legacy formats are normalized only at the boundary. */
(() => {
  "use strict";
  const clone = value => structuredClone(value);
  const sameRef = (a, b) => a?.kind === b?.kind && JSON.stringify(a?.path) === JSON.stringify(b?.path);
  const placed = instance => Boolean(instance?.placement) && ["linear", "circular"].includes(instance.placement?.kind);
  function normalize(raw) {
    if (raw.type === "free") throw new Error("同期インスタンスは未対応です");
    if (raw.type === "sketchProjection") return raw;
    if (raw.placement) {
      const result = clone(raw);
      if (result.placement.kind === "circular") { delete result.rotationLocked; delete result.placement.angleMode; }
      return result;
    }
    const result = { ...clone(raw), type: raw.type === "mirror" ? "mirror" : "pattern", count: raw.type === "pattern" ? Number(raw.copies) + 1 : 2,
      anchor: { relation: null, fallbackPosition: { x: 0, y: 0 } },
      x: 0, y: 0, rotation: 0, placementPointDefined: false,
      reflected: false, rotationLocked: false,
      placement: raw.type === "mirror" ? { kind: "axisReflection", axis: clone(raw.axis) }
        : raw.type === "pattern" ? { kind: "directionLinear", direction: clone(raw.direction), spacing: Number(raw.spacing), reversed: Boolean(raw.reversed) }
        : { kind: "linear" },
      occurrences: raw.type === "pattern" ? Array.from({ length: Number(raw.copies) }, (_, i) => String(i + 1)) : [""] };
    for (const key of ["origin", "mirrorX", "mirrorY", "axis", "direction", "spacing", "copies", "reversed"]) delete result[key];
    return result;
  }
  function createDraft(raw) {
    const draft = { ...raw, type: raw.type || "pattern", count: 2, x: 0, y: 0, placementPointDefined: false, rotation: 0, reflected: false, rotationLocked: true,
      anchor: { relation: null, fallbackPosition: { x: 0, y: 0 } }, placement: raw.type === "mirror" ? { kind: "axisReflection", axis: null } : raw.type === "circularPattern" ? { kind: "circular", angleStep: Math.PI / 6, angleSign: 1 } : { kind: "linear" }, occurrences: ["1"] };
    if (draft.placement.kind === "circular") delete draft.rotationLocked;
    return draft;
  }
  function resize(instance, count) {
    instance.count = count;
    instance.occurrences = instance.occurrences.slice(0, count - 1);
    let key = 1;
    while (instance.occurrences.length < count - 1) {
      while (instance.occurrences.includes(String(key))) key++;
      instance.occurrences.push(String(key++));
    }
  }
  function sourceContains(instance, target, resolve) {
    return instance.sources.some(ref => {
      if (sameRef(ref, target)) return true;
      const item = resolve(ref), point = resolve(target);
      return target?.kind === "point" && item && point &&
        [item.p1, item.p2].some(candidate => candidate && candidate.id === point.id);
    });
  }
  function anchorPoint(instance, resolve) {
    const relation = instance.anchor?.relation;
    if (!relation) return instance.anchor?.fallbackPosition;
    const target = resolve(relation.target);
    if (!target) return null;
    if (relation.kind === "point") return target;
    if (relation.kind === "lineMidpoint" && target.p1 && target.p2) return { x: (target.p1.x + target.p2.x) / 2, y: (target.p1.y + target.p2.y) / 2 };
    if (relation.kind === "lineEndpoint") return relation.endpoint === "start" ? target.p1 : target.p2;
    if (relation.kind === "arcEndpoint") return window.GeometryKernel.arcEndpointPoint(target, relation.endpoint);
    return null;
  }
  function relationFromSnap(instance, snap, refFor, resolve) {
    const data = snap?.data;
    if (!data) return null;
    let target, kind, endpoint;
    if (data.point) {
      target = refFor(data.point); kind = "point";
      if (data.point.kind !== "explicit" && !instance.sources.some(ref => sameRef(ref, target))) {
        const lines = instance.sources.map(ref => ({ ref, item: resolve(ref) })).filter(({ ref, item }) => ref.kind === "line" && (item?.p1?.id === data.point.id || item?.p2?.id === data.point.id));
        if (lines.length === 1) { target = lines[0].ref; kind = "lineEndpoint"; endpoint = lines[0].item.p1.id === data.point.id ? "start" : "end"; }
      }
    }
    else if (data.line && data.midpoint) { target = refFor(data.line); kind = "lineMidpoint"; }
    else if (data.arc && data.endpoint) { target = refFor(data.arc); kind = "arcEndpoint"; endpoint = data.endpoint; }
    if (!target || !sourceContains(instance, target, resolve)) return null;
    return { kind, target, ...(endpoint ? { endpoint } : {}) };
  }
  function anchorLabel(instance, t = ja => ja) {
    const relation = instance.anchor?.relation;
    if (!relation) return "";
    const labels = { point: t("点", "Point"), lineEndpoint: t("線の端点", "Line endpoint"), arcEndpoint: t("円弧の端点", "Arc endpoint"), lineMidpoint: t("線の中点", "Line midpoint") };
    return labels[relation.kind] + ": " + relation.target.path.join("@");
  }
  function dependencies(instance) {
    return [...(instance.sources || []), instance.anchor?.relation?.target, instance.placement?.axis, instance.placement?.direction].filter(Boolean);
  }
  function variables(instance) {
    if (!placed(instance)) return [];
    const props = instance.placement.kind === "linear" ? ["x", "y"] : [];
    if (instance.placement.kind === "circular" || !instance.rotationLocked) props.push("rotation");
    const result = props.map(prop => ({ object: instance, prop, label: `${instance.id}.${prop}` }));
    const p = instance.placement;
    if (p.kind === "circular") {
      const sign = p.angleSign || Math.sign(p.angleStep);
      result.push({ object: p, prop: "angleStep", label: `${instance.id}.angleStep`,
        min: sign > 0 ? 1e-9 : -Math.PI * 2 + 1e-9, max: sign > 0 ? Math.PI * 2 - 1e-9 : -1e-9 });
    }
    return result;
  }
  function error(instance, resolve = null) {
    if (instance.type === "sketchProjection") return "";
    if (instance.type !== (instance.placement?.kind === "axisReflection" ? "mirror" : instance.placement?.kind === "circular" ? "circularPattern" : "pattern")) return "種類と配置方式が一致しません";
    if (!Number.isInteger(instance.count) || instance.count < 2 || instance.count > 1001) return "個数は2〜1001です";
    if (![instance.x, instance.y, instance.rotation].every(Number.isFinite) || typeof instance.placementPointDefined !== "boolean" || typeof instance.reflected !== "boolean" || (instance.placement?.kind !== "circular" && typeof instance.rotationLocked !== "boolean")) return "配置設定が不正です";
    if (!Array.isArray(instance.occurrences) || instance.occurrences.length !== instance.count - 1 || instance.occurrences.some(key => typeof key !== "string") || new Set(instance.occurrences).size !== instance.occurrences.length) return "コピーの識別情報が不正です";
    const a = instance.anchor;
    if (!a || ![a.fallbackPosition?.x, a.fallbackPosition?.y].every(Number.isFinite)) return "基準点が不正です";
    if (a.relation && (!["point", "lineEndpoint", "arcEndpoint", "lineMidpoint"].includes(a.relation.kind) || !a.relation.target?.kind || !Array.isArray(a.relation.target.path) || !a.relation.target.path.length
      || a.relation.target.kind !== (a.relation.kind === "point" ? "point" : a.relation.kind === "arcEndpoint" ? "arc" : "line")
      || ["lineEndpoint", "arcEndpoint"].includes(a.relation.kind) && !["start", "end"].includes(a.relation.endpoint))) return "基準点の参照が不正です";
    const p = instance.placement;
    if (!["linear", "circular", "axisReflection", "directionLinear"].includes(p?.kind)) return "配置方式が不正です";
    if (p.kind === "axisReflection" && (instance.count !== 2 || p.axis?.kind !== "line")) return "対称軸が不正です";
    if (p.kind === "directionLinear" && (p.direction?.kind !== "line" || !Number.isFinite(p.spacing) || p.spacing <= 0 || typeof p.reversed !== "boolean")) return "方向線の配置設定が不正です";
    if (p.kind === "circular" && (!Number.isFinite(p.angleStep) || p.angleStep === 0 || Math.abs(p.angleStep) >= Math.PI * 2 || ![-1, 1].includes(p.angleSign) || Math.sign(p.angleStep) !== p.angleSign)) return "角度間隔が不正です";
    if (resolve && a.relation) {
      const point = anchorPoint(instance, resolve);
      if (!sourceContains(instance, a.relation.target, resolve) || !point || ![point.x, point.y].every(Number.isFinite)) return "基準点はコピー対象から指定してください";
    }
    return "";
  }
  function transform(instance, point, index, resolve, inverse = false) {
    const p = instance.placement;
    if (p.kind === "axisReflection") return window.GeometryKernel.reflectedPointAcrossLine(point, resolve(p.axis));
    if (p.kind === "directionLinear") {
      const line = resolve(p.direction), scale = (inverse ? -1 : 1) * (p.reversed ? -1 : 1) * p.spacing * index / line.length();
      return { x: point.x + line.dx() * scale, y: point.y + line.dy() * scale };
    }
    const a = anchorPoint(instance, resolve), angle = (p.kind === "linear" ? index : 1) * instance.rotation - (p.kind === "circular" ? index * p.angleStep : 0);
    const b = p.kind === "circular" ? a : { x: a.x + index * (instance.x - a.x), y: a.y + index * (instance.y - a.y) };
    const c = Math.cos(angle), s = Math.sin(angle), sign = instance.reflected ? -1 : 1;
    if (inverse) { const x = point.x - b.x, y = point.y - b.y; return { x: a.x + sign * (c * x + s * y), y: a.y - s * x + c * y }; }
    const x = sign * (point.x - a.x), y = point.y - a.y;
    return { x: b.x + c * x - s * y, y: b.y + s * x + c * y };
  }
  window.PatternInstanceModel = Object.freeze({ normalize, createDraft, resize, placed, sourceContains, anchorPoint, relationFromSnap, anchorLabel, dependencies, variables, error, transform, sameRef });
})();
