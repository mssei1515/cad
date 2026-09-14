/* Document element values: normalization, validation and serialized fields. */
(function () {
  "use strict";
  const { normalizeAnnotationStyle } = window.Appearance;

  function normalizeAnnotations(items, fallbackSketchId = null) {
    if (!Array.isArray(items)) return [];
    return items.map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const type = item.type === "text" ? "text" : item.type === "leader" ? "leader" : null;
      if (!type) return null;
      const normalized = {
        id: String(item.id || `AN${index + 1}`),
        type,
        sketchId: item.sketchId == null ? fallbackSketchId : String(item.sketchId),
        visible: item.visible !== false,
        text: String(item.text || ""),
        x: Number.isFinite(Number(item.x)) ? Number(item.x) : 0,
        y: Number.isFinite(Number(item.y)) ? Number(item.y) : 0,
        rotation: Number.isFinite(Number(item.rotation)) ? Number(item.rotation) : 0,
        style: normalizeAnnotationStyle(item.style),
      };
      if (type === "leader") {
        normalized.geometryRef = item.geometryRef && typeof item.geometryRef === "object" ? { ...item.geometryRef } : null;
        for (const key of ["start", "elbow", "end"]) {
          const point = item[key];
          normalized[key] = point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)) ? { x: Number(point.x), y: Number(point.y) } : null;
        }
      }
      Object.assign(item, normalized);
      if (type !== "leader") {
        delete item.geometryRef;
        delete item.start;
        delete item.elbow;
        delete item.end;
      }
      return item;
    }).filter(Boolean);
  }

  function serializeAnnotation(element) {
    const data = {
      id: element.id,
      type: element.type,
      sketchId: element.sketchId,
      visible: element.visible !== false,
      text: element.text || "",
      x: Number(element.x) || 0,
      y: Number(element.y) || 0,
      rotation: Number(element.rotation) || 0,
      style: normalizeAnnotationStyle(element.style),
    };
    if (element.type === "leader") {
      data.geometryRef = element.geometryRef && typeof element.geometryRef === "object" ? { ...element.geometryRef } : null;
      data.start = element.start;
      data.elbow = element.elbow;
      data.end = element.end;
    }
    return data;
  }

  window.AnnotationData = Object.freeze({ normalizeAnnotations, serializeAnnotation });
})();
