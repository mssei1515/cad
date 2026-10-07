/* Effective geometry appearance and visibility over explicit document/sketch reads. */
(() => {
  "use strict";
  const { Line, Circle, Arc, Spline } = window.GeometrySolver;
  const { normalizeAppearance, resolveGeometryAppearance } = window.Appearance;
  function create({ document, readAppearance, cacheAppearance, sketchById, elementSketchId,
    isRootSketch, activeSketchId, showHiddenElements }) {
    function effectiveAppearanceForElement(item) {
      const cached = readAppearance(item);
      if (cached) return cached;
      if (item?.derivedProjection && item.sourceElement) {
        const result = { ...effectiveAppearanceForElement(item.sourceElement), ...normalizeAppearance(item.derivedInstance.appearanceOverride) };
        cacheAppearance(item, result);
        return result;
      }
      const construction = (item instanceof Line || item instanceof Circle || item instanceof Arc || item instanceof Spline) && item.construction;
      const outerSketch = sketchById(elementSketchId(item));
      const definitionSketch = item?.blockProjection && !item?.derivedProjection
        ? item.blockDefinition?.sketches?.find((sketch) => sketch.id === item.localElement?.sketchId) : null;
      const result = resolveGeometryAppearance({
        defaults: construction ? document.defaultConstructionAppearance : document.defaultAppearance,
        construction,
        sketchAppearance: sketchGeometryAppearanceLayer(outerSketch, construction),
        definitionSketchAppearance: sketchGeometryAppearanceLayer(definitionSketch, construction),
        elementAppearance: item?.derivedProjection ? null : item?.blockProjection ? item.localElement?.appearance : item?.appearance,
        overrides: item?.derivedProjection ? [item.derivedInstance?.appearanceOverride]
          : item?.blockProjection ? item.blockAppearanceOverrides || [item.blockInstance?.appearanceOverride] : [],
      });
      cacheAppearance(item, result);
      return result;
    }


    function sketchGeometryAppearanceLayer(sketch, construction = false) {
      if (!sketch || isRootSketch(sketch)) return null;
      return construction ? sketch.constructionAppearance : sketch.appearance;
    }


    function effectiveConstructionAppearanceForSketch(sketch) {
      return resolveGeometryAppearance({
        defaults: document.defaultConstructionAppearance, construction: true,
        sketchAppearance: sketchGeometryAppearanceLayer(sketch, true),
      });
    }


    function effectiveAppearanceForSketch(sketch) {
      return resolveGeometryAppearance({
        defaults: document.defaultAppearance, sketchAppearance: sketchGeometryAppearanceLayer(sketch),
      });
    }


    function isVisibleValue(visible) {
      return showHiddenElements() || visible !== false;
    }


    function isVisibleSketchId(sketchId) {
      const id = sketchId || activeSketchId();
      const sketch = sketchById(id);
      if (!sketch) return false;
      const appearance = effectiveAppearanceForSketch(sketch);
      return isVisibleValue(appearance.visible);
    }


    function isVisibleSketchElement(item) {
      return isVisibleSketchId(elementSketchId(item)) && isVisibleValue(effectiveAppearanceForElement(item).visible);
    }

    return Object.freeze({ effectiveAppearanceForElement, effectiveConstructionAppearanceForSketch, effectiveAppearanceForSketch, isVisibleValue, isVisibleSketchId, isVisibleSketchElement });
  }
  window.GeometryAppearanceQuery = Object.freeze({ create });
})();
