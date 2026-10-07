/* PNG crop geometry is transient and never becomes drawing geometry. */
(() => {
  "use strict";
  function fromPoints(a, b) {
    if (![a?.x, a?.y, b?.x, b?.y].every(Number.isFinite)) return null;
    const region = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
    return region.width > 0 && region.height > 0 ? region : null;
  }
  function fromLines(lines) {
    if (lines.length !== 4 || new Set(lines).size !== 4) return null;
    const points = lines.flatMap(line => [line.p1, line.p2]);
    if (!points.every(p => Number.isFinite(p?.x) && Number.isFinite(p?.y))) return null;
    const region = fromPoints({ x: Math.min(...points.map(p => p.x)), y: Math.min(...points.map(p => p.y)) },
      { x: Math.max(...points.map(p => p.x)), y: Math.max(...points.map(p => p.y)) });
    if (!region) return null;
    const tolerance = Math.max(1e-7, Math.max(region.width, region.height) * 1e-7);
    if (Math.min(region.width, region.height) <= tolerance * 2) return null;
    const corners = [{ x: region.x, y: region.y }, { x: region.x + region.width, y: region.y },
      { x: region.x + region.width, y: region.y + region.height }, { x: region.x, y: region.y + region.height }];
    const edges = new Set();
    for (const line of lines) {
      const a = corners.findIndex(p => Math.hypot(p.x - line.p1.x, p.y - line.p1.y) <= tolerance);
      const b = corners.findIndex(p => Math.hypot(p.x - line.p2.x, p.y - line.p2.y) <= tolerance);
      if (a < 0 || b < 0 || a === b || Math.abs(a - b) === 2) return null;
      edges.add([a, b].sort().join(":"));
    }
    return edges.size === 4 ? region : null;
  }
  function pixelSize(region, multiplier) {
    if (!region || ![1, 2, 4].includes(multiplier) || ![region.x, region.y, region.width, region.height].every(Number.isFinite)
      || region.width <= 0 || region.height <= 0) return null;
    const width = Math.max(1, Math.round(region.width * multiplier));
    const height = Math.max(1, Math.round(region.height * multiplier));
    return { width, height, supported: width <= 16384 && height <= 16384 && width * height <= 33554432 };
  }
  window.ExportRegion = Object.freeze({ fromPoints, fromLines, pixelSize });
})();
