/* Document element values: normalization, validation and serialized fields. */
(function () {
  "use strict";
  const { normalizeHatchAppearance } = window.Appearance;
  const { normalizedDrawingOrder } = window.DrawingOrder;
  const { normalizeBoundaryLoops: normalizeHatchBoundaryLoops } = window.HatchRegionEngine;

  function normalizeHatches(items, fallbackSketchId = null) {
    if (!Array.isArray(items)) return [];
    return items.map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const boundaryLoops = normalizeHatchBoundaryLoops(item.boundaryLoops);
      if (!boundaryLoops) return null;
      const seed = item.seed && Number.isFinite(Number(item.seed.x)) && Number.isFinite(Number(item.seed.y))
        ? { x: Number(item.seed.x), y: Number(item.seed.y) }
        : { x: 0, y: 0 };
      const normalized = {
        id: String(item.id || `H${index + 1}`),
        sketchId: item.sketchId == null ? fallbackSketchId : String(item.sketchId),
        drawingOrder: normalizedDrawingOrder(item.drawingOrder),
        seed,
        boundaryLoops,
        appearance: normalizeHatchAppearance(item.appearance),
      };
      Object.assign(item, normalized);
      return item;
    }).filter(Boolean);
  }

  function validSerializedHatch(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    if (typeof value.id !== "string" || !value.id.trim() || typeof value.sketchId !== "string" || !value.sketchId.trim()) return false;
    if (!value.seed || !Number.isFinite(Number(value.seed.x)) || !Number.isFinite(Number(value.seed.y))) return false;
    if (!Array.isArray(value.boundaryLoops) || value.boundaryLoops.length === 0 || !normalizeHatchBoundaryLoops(value.boundaryLoops)) return false;
    const appearance = value.appearance;
    if (!appearance || typeof appearance !== "object" || Array.isArray(appearance)) return false;
    return (value.drawingOrder == null || normalizedDrawingOrder(value.drawingOrder) != null)
      && typeof appearance.visible === "boolean"
      && ["parallel", "cross", "solid"].includes(appearance.patternType)
      && Number.isFinite(Number(appearance.angle))
      && Number.isFinite(Number(appearance.spacing)) && Number(appearance.spacing) >= 0.25
      && typeof appearance.color === "string" && /^#[0-9a-fA-F]{6}$/.test(appearance.color)
      && Number.isFinite(Number(appearance.lineWidth)) && Number(appearance.lineWidth) >= 0.5
      && (!Object.prototype.hasOwnProperty.call(appearance, "opacity")
        || Number.isFinite(Number(appearance.opacity)) && Number(appearance.opacity) >= 0 && Number(appearance.opacity) <= 1);
  }

  function validSerializedHatchList(items) {
    return Array.isArray(items) && items.every(validSerializedHatch) && new Set(items.map((item) => item.id)).size === items.length;
  }

  function serializeHatch(hatch) {
    return {
      id: String(hatch.id),
      sketchId: String(hatch.sketchId),
      drawingOrder: normalizedDrawingOrder(hatch.drawingOrder) ?? 0,
      seed: { x: Number(hatch.seed?.x) || 0, y: Number(hatch.seed?.y) || 0 },
      boundaryLoops: normalizeHatchBoundaryLoops(hatch.boundaryLoops),
      appearance: normalizeHatchAppearance(hatch.appearance),
    };
  }

  window.HatchData = Object.freeze({ normalizeHatches, validSerializedHatch, validSerializedHatchList, serializeHatch });
})();
