/* Expanded Geometry queries and synchronous read-cache lifetime. */
(function () {
  "use strict";
  const { resolve: resolveGeometryRefValue, parseKey: parseGeometryRefKey } = window.GeometryRef;
  function create({ currentScope, prepareBlocks, blockProjections, instanceProjections, hasBlockHatches, profileRead = read => read() }) {
    const { blockProjectionBundle } = blockProjections;
    const { geometryInstanceBundlesForScope, emptyGeometryInstanceBundle } = instanceProjections;
    let geometryReadCache = null;

    function withGeometryReadCache(callback) {
      if (geometryReadCache) return callback();
      geometryReadCache = { values: new Map(), appearances: new WeakMap() };
      try {
        return callback();
      } finally {
        geometryReadCache = null;
      }
    }

    function cachedGeometryRead(key, create) {
      if (!geometryReadCache) return profileRead(create);
      if (!geometryReadCache.values.has(key)) geometryReadCache.values.set(key, profileRead(create));
      return geometryReadCache.values.get(key);
    }

    function blockProjectionBundles() {
      return cachedGeometryRead("blockProjectionBundles", () => {
        prepareBlocks();
        return currentScope().blockInstances.map(blockProjectionBundle);
      });
    }

    function geometryInstanceBundles() {
      return cachedGeometryRead("geometryInstanceBundles", () => geometryInstanceBundlesForScope(currentScope(), blockProjectionBundles()));
    }

    function geometryInstanceBundle(instance) {
      return geometryInstanceBundles().find((bundle) => bundle.instance === instance) || emptyGeometryInstanceBundle(instance);
    }

    function allGeometryPoints() {
      return cachedGeometryRead("allGeometryPoints", () => [...currentScope().points, ...blockProjectionBundles().flatMap((bundle) => bundle.points), ...geometryInstanceBundles().flatMap((bundle) => bundle.points)]);
    }

    function allGeometryLines() {
      return cachedGeometryRead("allGeometryLines", () => [...currentScope().lines, ...blockProjectionBundles().flatMap((bundle) => bundle.lines), ...geometryInstanceBundles().flatMap((bundle) => bundle.lines)]);
    }

    function allGeometryCircles() {
      return cachedGeometryRead("allGeometryCircles", () => [...currentScope().circles, ...blockProjectionBundles().flatMap((bundle) => bundle.circles), ...geometryInstanceBundles().flatMap((bundle) => bundle.circles)]);
    }

    function allGeometryArcs() {
      return cachedGeometryRead("allGeometryArcs", () => [...currentScope().arcs, ...blockProjectionBundles().flatMap((bundle) => bundle.arcs), ...geometryInstanceBundles().flatMap((bundle) => bundle.arcs)]);
    }

    function allGeometrySplines() {
      return cachedGeometryRead("allGeometrySplines", () => [...currentScope().splines, ...blockProjectionBundles().flatMap((bundle) => bundle.splines || []), ...geometryInstanceBundles().flatMap((bundle) => bundle.splines || [])]);
    }

    function allAnnotations() {
      return cachedGeometryRead("allAnnotations", () => [...currentScope().annotations, ...blockProjectionBundles().flatMap((bundle) => bundle.annotations || [])]);
    }

    function allHatches() {
      return cachedGeometryRead("allHatches", () => {
        if (currentScope().hatches.length === 0 && !hasBlockHatches()) return [];
        return [...currentScope().hatches, ...blockProjectionBundles().flatMap((bundle) => bundle.hatches || [])];
      });
    }

    function allGeometryPrimitives() {
      return [...allGeometryCircles(), ...allGeometryArcs()];
    }

    function resolveGeometryRef(ref) {
      return resolveGeometryRefValue(ref, (kind, canonicalId) => {
        if (kind === "point") return allGeometryPoints().find((item) => item.id === canonicalId);
        if (kind === "line") return allGeometryLines().find((item) => item.id === canonicalId);
        if (kind === "circle") return allGeometryCircles().find((item) => item.id === canonicalId);
        if (kind === "arc") return allGeometryArcs().find((item) => item.id === canonicalId);
        if (kind === "spline") return allGeometrySplines().find((item) => item.id === canonicalId);
        return null;
      });
    }

    function geometryElementFromKey(key) {
      return resolveGeometryRef(parseGeometryRefKey(key));
    }

    function clearReadCache() {
      geometryReadCache = null;
    }

    function readAppearance(item) {
      return item && geometryReadCache?.appearances.get(item);
    }

    function cacheAppearance(item, appearance) {
      if (item && geometryReadCache) geometryReadCache.appearances.set(item, appearance);
    }

    return Object.freeze({ withGeometryReadCache, blockProjectionBundles, geometryInstanceBundles, geometryInstanceBundle, allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines, allAnnotations, allHatches, allGeometryPrimitives, resolveGeometryRef, geometryElementFromKey, clearReadCache, readAppearance, cacheAppearance });
  }
  window.GeometryReadModel = Object.freeze({ create });
})();
