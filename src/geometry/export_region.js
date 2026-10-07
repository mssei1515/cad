/* PNG crop geometry is transient and never becomes drawing geometry. */
(() => {
  "use strict";
  function fromPoints(a, b) {
    if (![a?.x, a?.y, b?.x, b?.y].every(Number.isFinite)) return null;
    const region = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
    return region.width > 0 && region.height > 0 ? region : null;
  }
  function pixelSize(region, pixelsPerMm) {
    if (!region || !Number.isFinite(pixelsPerMm) || pixelsPerMm <= 0 || ![region.x, region.y, region.width, region.height].every(Number.isFinite)
      || region.width <= 0 || region.height <= 0) return null;
    const width = Math.max(1, Math.round(region.width * pixelsPerMm));
    const height = Math.max(1, Math.round(region.height * pixelsPerMm));
    return { width, height, supported: width <= 16384 && height <= 16384 && width * height <= 33554432 };
  }
  window.ExportRegion = Object.freeze({ fromPoints, pixelSize });
})();
