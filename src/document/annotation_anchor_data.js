/* Annotation anchor values, normalization and geometry references; no commands, DOM or solving. */
(() => {
  "use strict";
  const POSITIONS = ["left-top", "center-top", "right-top", "left-middle", "center-middle", "right-middle", "left-bottom", "center-bottom", "right-bottom"];
  const axes = type => type === "horizontal" || type === "distance-y" ? ["y"] : type === "vertical" || type === "distance-x" ? ["x"] : ["coincident", "concentric", "endpoint", "symmetry", "fixed"].includes(type) ? ["x", "y"] : [];
  const degree = type => axes(type).length || 1;
  const targetKinds = { coincident: ["point"], horizontal: ["point", "arc"], vertical: ["point", "arc"], "distance-x": ["point", "arc"], "distance-y": ["point", "arc"],
    "on-line": ["line"], "on-circle": ["circle", "arc"], "on-spline": ["spline"], concentric: ["circle", "arc"], endpoint: ["arc"], distance: ["point", "arc"], "distance-line": ["line"], symmetry: ["point", "arc"] };
  function normalize(items) {
    if (!Array.isArray(items)) return [];
    return items.filter(item => item && (item.type === "fixed" || targetKinds[item.type]?.includes(item.geometryRef?.kind))
      && (!item.type.startsWith("distance") || Number.isFinite(Number(item.value)))
      && (!item.endpoint || item.geometryRef?.kind === "arc" && ["start", "end"].includes(item.endpoint))
      && (item.geometryRef?.kind !== "arc" || ["on-circle", "concentric"].includes(item.type) || ["start", "end"].includes(item.endpoint))
      && (item.type !== "symmetry" || item.axisRef?.kind === "line" && window.GeometryRef.create("line", item.axisRef.path))).map(item => ({
      type: item.type, ...(item.type === "fixed" ? { x: Number(item.x), y: Number(item.y) } : { geometryRef: window.GeometryRef.create(item.geometryRef.kind, item.geometryRef.path), value: Number(item.value) || 0,
        ...(item.endpoint ? { endpoint: item.endpoint } : {}), ...(item.axisRef ? { axisRef: window.GeometryRef.create("line", item.axisRef.path) } : {}),
        ...(item.type === "distance-line" ? { sign: item.sign === -1 ? -1 : 1 } : {}), ...(item.type === "on-spline" ? { parameter: Math.max(0, Math.min(1, Number(item.parameter) || 0)) } : {}),
        ...(item.type.startsWith("distance") && item.dimension && typeof item.dimension === "object" ? { dimension: JSON.parse(JSON.stringify(item.dimension)) } : {}) })
    })).filter(item => item.type === "fixed" ? Number.isFinite(item.x) && Number.isFinite(item.y) : Boolean(item.geometryRef) && (!item.type.startsWith("distance") || item.type.startsWith("distance-") && item.type !== "distance-line" || item.value >= 0));
  }
  const refs = element => [...(element.type === "leader" && element.geometryRef ? [element.geometryRef] : []), ...normalize(element.anchorConstraints).flatMap(item => [item.geometryRef, item.axisRef].filter(Boolean))];
  function referencesRemovedGeometry(annotation, removedIds, removedKeys) {
    const { id: geometryRefId, key: geometryRefKey } = window.GeometryRef;
    return refs(annotation).some(ref => {
      const id = geometryRefId(ref), key = geometryRefKey(ref);
      return Boolean((id && removedIds.has(id)) || (key && removedKeys.has(key)));
    });
  }
  window.AnnotationAnchorData = Object.freeze({ POSITIONS, axes, degree, normalize, refs, referencesRemovedGeometry });
})();
