/* Own Hatch boundary resolution and face-search caches over current geometry. */
(() => {
  "use strict";
  const { Line, Circle, Arc, Spline } = window.GeometrySolver;
  const { geometryKindForItem } = window.GeometryObjects;
  const { id: geometryRefId } = window.GeometryRef;
  const { createRegionIndex: createHatchRegionIndex, findFaceInIndex: findHatchFaceInIndex,
    resolveBoundary: resolveHatchBoundaryLoops, boundaryGeometryRefs: hatchBoundaryGeometryRefs } = window.HatchRegionEngine;
  function create({ currentScope, boundaryGeometry, activeSketchId, effectiveAppearanceForElement, applicationText }) {
    let hatchResolutionCache = new WeakMap();
    let hatchFaceCache = new Map();
    function hatchPrimitiveForElement(element) {
      if (element instanceof Line) return { kind: "line", id: element.id, p1: element.p1, p2: element.p2 };
      if (element instanceof Circle) return { kind: "circle", id: element.id, center: element.center, radius: element.radius() };
      if (element instanceof Arc) return { kind: "arc", id: element.id, center: element.center, radius: element.radius(), startAngle: element.startAngle, endAngle: element.endAngle };
      if (element instanceof Spline) return { kind: "spline", id: element.id, points: element.fitPoints, closed: element.closed };
      return null;
    }

    function hatchPrimitiveFingerprint(primitive) {
      if (!primitive) return "invalid";
      if (primitive.kind === "line") return `line:${primitive.id}:${primitive.p1.x}:${primitive.p1.y}:${primitive.p2.x}:${primitive.p2.y}`;
      if (primitive.kind === "spline") return `spline:${primitive.id}:${primitive.closed ? 1 : 0}:${(primitive.points || []).map((point) => `${point.x}:${point.y}`).join("|")}`;
      return `${primitive.kind}:${primitive.id}:${primitive.center?.x}:${primitive.center?.y}:${primitive.radius}:${primitive.startAngle ?? ""}:${primitive.endAngle ?? ""}`;
    }

    function hatchPrimitivesFromElements(elements, sketchId, { visibleOnly = false } = {}) {
      return elements
        .filter((element) => String(element.sketchId) === String(sketchId) && !element.construction)
        .filter((element) => !visibleOnly || effectiveAppearanceForElement(element).visible !== false)
        .map(hatchPrimitiveForElement)
        .filter(Boolean);
    }

    function hatchPrimitivesForScope(scope, sketchId, { visibleOnly = false } = {}) {
      const elements = scope === currentScope()
        ? boundaryGeometry()
        : [...(scope?.lines || []), ...(scope?.circles || []), ...(scope?.arcs || []), ...(scope?.splines || [])];
      return hatchPrimitivesFromElements(elements, sketchId, { visibleOnly });
    }

    function hatchBoundaryFingerprint(hatch, scope = currentScope()) {
      const elements = scope === currentScope()
        ? boundaryGeometry()
        : [...(scope.lines || []), ...(scope.circles || []), ...(scope.arcs || []), ...(scope.splines || [])];
      const byKey = new Map([
        ...elements.map((item) => [`${geometryKindForItem(item)}:${item.id}`, item]),
      ]);
      return hatchBoundaryGeometryRefs(hatch.boundaryLoops).map((ref) => {
        const item = byKey.get(`${ref.kind}:${geometryRefId(ref)}`);
        if (!item) return `${ref.kind}:${geometryRefId(ref)}:missing`;
        if (item instanceof Line) return `line:${item.id}:${item.construction}:${item.p1.x}:${item.p1.y}:${item.p2.x}:${item.p2.y}`;
        if (item instanceof Spline) return `spline:${item.id}:${item.construction}:${item.closed}:${item.fitPoints.map((point) => `${point.x}:${point.y}`).join(":")}`;
        return `${ref.kind}:${item.id}:${item.construction}:${item.center.x}:${item.center.y}:${item.radius()}:${item instanceof Arc ? `${item.startAngle}:${item.endAngle}` : ""}`;
      }).join("|");
    }

    function resolvedHatchBoundary(hatch) {
      if (!hatch) return { ok: false, code: "missing-hatch", reason: applicationText("ハッチングが見つかりません", "Hatch not found") };
      if (hatch.blockProjection) return hatch.resolvedBoundary || { ok: false, code: "invalid-boundary", reason: applicationText("ブロック内の境界が無効です", "The block hatch boundary is invalid") };
      const fingerprint = hatchBoundaryFingerprint(hatch);
      const cached = hatchResolutionCache.get(hatch);
      if (cached?.fingerprint === fingerprint) return cached.result;
      const result = resolveHatchBoundaryLoops(hatch.boundaryLoops, hatchPrimitivesForScope(currentScope(), hatch.sketchId));
      hatchResolutionCache.set(hatch, { fingerprint, result });
      return result;
    }

    function hatchFaceAt(pointer) {
      const sketchId = activeSketchId();
      const primitives = hatchPrimitivesForScope(currentScope(), sketchId, { visibleOnly: true });
      const fingerprint = primitives.map(hatchPrimitiveFingerprint).join("|");
      let cached = hatchFaceCache.get(sketchId);
      if (!cached || cached.fingerprint !== fingerprint) {
        cached = { fingerprint, index: createHatchRegionIndex(primitives) };
        hatchFaceCache.set(sketchId, cached);
      }
      return findHatchFaceInIndex(cached.index, pointer);
    }


    function forget(hatch) { hatchResolutionCache.delete(hatch); }
    function clear() { hatchResolutionCache = new WeakMap(); hatchFaceCache = new Map(); }
    return Object.freeze({ hatchPrimitivesFromElements, hatchPrimitivesForScope, resolvedHatchBoundary, hatchFaceAt, forget, clear });
  }
  window.HatchGeometryQuery = Object.freeze({ create });
})();
