/* Document element values: normalization, validation and serialized fields. */
(function () {
  "use strict";
  const REFERENCE_IMAGE_MAX_SIDE_PX = 3000;

  function referenceImageMimeType(value) {
    const mimeType = String(value || "").toLowerCase();
    return ["image/png", "image/jpeg", "image/webp"].includes(mimeType) ? mimeType : null;
  }

  function validReferenceImageDataUrl(value, mimeType = null) {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,[a-z0-9+/=]+$/i.exec(String(value || ""));
    return Boolean(match && (!mimeType || match[1].toLowerCase() === mimeType));
  }

  function normalizeReferenceImages(items, fallbackSketchId = null) {
    if (!Array.isArray(items)) return [];
    return items.map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const mimeType = referenceImageMimeType(item.mimeType);
      const pixelWidth = Math.round(Number(item.pixelWidth));
      const pixelHeight = Math.round(Number(item.pixelHeight));
      const scale = Number(item.scale);
      if (!mimeType || !validReferenceImageDataUrl(item.dataUrl, mimeType)
        || !Number.isInteger(pixelWidth) || pixelWidth < 1 || pixelWidth > REFERENCE_IMAGE_MAX_SIDE_PX
        || !Number.isInteger(pixelHeight) || pixelHeight < 1 || pixelHeight > REFERENCE_IMAGE_MAX_SIDE_PX
        || !Number.isFinite(scale) || scale <= 0) return null;
      const normalized = {
        id: String(item.id || `IMG${index + 1}`),
        name: String(item.name || `Image-${index + 1}`),
        sketchId: item.sketchId == null ? fallbackSketchId : String(item.sketchId),
        mimeType,
        dataUrl: String(item.dataUrl),
        pixelWidth,
        pixelHeight,
        x: Number.isFinite(Number(item.x)) ? Number(item.x) : 0,
        y: Number.isFinite(Number(item.y)) ? Number(item.y) : 0,
        scale,
        rotation: Number.isFinite(Number(item.rotation)) ? Number(item.rotation) : 0,
        opacity: Math.max(0, Math.min(1, Number.isFinite(Number(item.opacity)) ? Number(item.opacity) : 0.5)),
        visible: item.visible !== false,
        locked: Boolean(item.locked),
      };
      Object.assign(item, normalized);
      return item;
    }).filter(Boolean);
  }

  function serializeReferenceImage(item) {
    return {
      id: item.id,
      name: item.name,
      sketchId: item.sketchId,
      mimeType: item.mimeType,
      dataUrl: item.dataUrl,
      pixelWidth: item.pixelWidth,
      pixelHeight: item.pixelHeight,
      x: item.x,
      y: item.y,
      scale: item.scale,
      rotation: item.rotation,
      opacity: item.opacity,
      visible: item.visible !== false,
      locked: Boolean(item.locked),
    };
  }

  function validSerializedReferenceImageList(items) {
    return Array.isArray(items) && items.every((item) => {
      const mimeType = referenceImageMimeType(item?.mimeType);
      return item && typeof item === "object"
        && typeof item.id === "string" && item.id.length > 0
        && typeof item.name === "string"
        && typeof item.sketchId === "string"
        && Boolean(mimeType) && validReferenceImageDataUrl(item.dataUrl, mimeType)
        && Number.isInteger(item.pixelWidth) && item.pixelWidth >= 1 && item.pixelWidth <= REFERENCE_IMAGE_MAX_SIDE_PX
        && Number.isInteger(item.pixelHeight) && item.pixelHeight >= 1 && item.pixelHeight <= REFERENCE_IMAGE_MAX_SIDE_PX
        && Number.isFinite(item.x) && Number.isFinite(item.y)
        && Number.isFinite(item.scale) && item.scale > 0
        && Number.isFinite(item.rotation)
        && Number.isFinite(item.opacity) && item.opacity >= 0 && item.opacity <= 1
        && typeof item.visible === "boolean"
        && typeof item.locked === "boolean";
    });
  }

  window.ReferenceImageData = Object.freeze({ referenceImageMimeType, validReferenceImageDataUrl, normalizeReferenceImages, serializeReferenceImage, validSerializedReferenceImageList, REFERENCE_IMAGE_MAX_SIDE_PX });
})();
