/* Document element values: normalization, validation and serialized fields. */
(function () {
  "use strict";

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
        parameterEnabled: item.parameterEnabled === true,
        x: Number.isFinite(Number(item.x)) ? Number(item.x) : 0,
        y: Number.isFinite(Number(item.y)) ? Number(item.y) : 0,
        rotation: Number.isFinite(Number(item.rotation)) ? Number(item.rotation) : 0,
        style: window.Appearance.annotationStoredStyle(item),
      };
      if (type === "leader") {
        normalized.geometryRef = item.geometryRef && typeof item.geometryRef === "object" ? { ...item.geometryRef } : null;
        for (const key of ["start", "elbow", "end"]) {
          const point = item[key];
          normalized[key] = point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)) ? { x: Number(point.x), y: Number(point.y) } : null;
        }
      }
      Object.assign(item, normalized);
      if (item.anchorPosition != null && !window.AnnotationAnchorConstraints?.POSITIONS.includes(item.anchorPosition)) throw new Error(`${item.id}: Invalid annotation anchor position`);
      if (item.anchorConstraints) {
        const relations = window.AnnotationAnchorConstraints.normalize(item.anchorConstraints);
        const axes = relations.flatMap(relation => window.AnnotationAnchorConstraints.axes(relation.type));
        if (!Array.isArray(item.anchorConstraints) || relations.length !== item.anchorConstraints.length || new Set(axes).size !== axes.length || !item.anchorPosition) throw new Error(`${item.id}: Invalid annotation anchor constraints`);
        item.anchorConstraints = relations;
      }
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
      parameterEnabled: element.parameterEnabled === true,
      ...(element.parameterName ? { parameterName: element.parameterName } : {}),
      ...(typeof element.expression === "string" ? { expression: element.expression } : {}),
      x: Number(element.x) || 0,
      y: Number(element.y) || 0,
      rotation: Number(element.rotation) || 0,
      style: window.Appearance.annotationStoredStyle(element),
    };
    if (element.appearanceInheritance === true) data.appearanceInheritance = true;
    if (window.AnnotationAnchorConstraints?.POSITIONS.includes(element.anchorPosition)) data.anchorPosition = element.anchorPosition;
    if (element.anchorConstraints?.length) data.anchorConstraints = window.AnnotationAnchorConstraints.normalize(element.anchorConstraints);
    if (element.type === "leader") {
      if (["shelf", "text", "anchor"].includes(element.textPlacement)) data.textPlacement = element.textPlacement;
      if (element.attachment) data.attachment = { ...element.attachment };
      if (Number.isFinite(element.shelfReferenceScale) && element.shelfReferenceScale > 0) data.shelfReferenceScale = element.shelfReferenceScale;
      data.geometryRef = element.geometryRef && typeof element.geometryRef === "object" ? { ...element.geometryRef } : null;
      data.start = element.start;
      data.elbow = element.elbow;
      data.end = element.end;
    }
    return data;
  }

  window.AnnotationData = Object.freeze({ normalizeAnnotations, serializeAnnotation });
})();
