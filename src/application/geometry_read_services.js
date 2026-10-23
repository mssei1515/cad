/* Compose expanded geometry and appearance reads around their existing cache owners. */
(() => {
  "use strict";
  function create({ document, currentScope, currentSketches, prepareBlocks, elementSketchId, applicationText,
    hatchGeometryQuery, sketchById, isRootSketch, activeSketchId, showHiddenElements, profileRead }) {
    const instances = window.InstanceProjection.create({ elementSketchId, applicationText,
      resolveHatch: (hatch, elements) => hatchGeometryQuery.resolvedHatchBoundary(hatch, elements) });
    const catalog = window.BlockCatalog.create({ definitions: () => document.blockDefinitions });
    const projections = window.BlockProjection.create({ blockCatalog: catalog,
      geometryInstanceBundlesForScope: instances.geometryInstanceBundlesForScope, emptyGeometryInstanceBundle: instances.emptyGeometryInstanceBundle,
      hatchPrimitivesFromElements: hatchGeometryQuery.hatchPrimitivesFromElements, hatchPrimitivesForScope: hatchGeometryQuery.hatchPrimitivesForScope });
    const reads = window.GeometryReadModel.create({ currentScope, prepareBlocks, blockProjections: projections,
      instanceProjections: instances, hasBlockHatches: catalog.hasHatches, profileRead });
    const geometryAppearance = window.GeometryAppearanceQuery.create({ document, readAppearance: reads.readAppearance,
      cacheAppearance: reads.cacheAppearance, sketchById, elementSketchId, isRootSketch, activeSketchId, showHiddenElements });
    const dimensionAppearance = window.GeometryAppearanceQuery.createDimension({ document, currentSketches, activeSketchId, isRootSketch });
    const annotationAppearance = window.GeometryAppearanceQuery.createAnnotation({ document, currentSketches });
    function createPointUsage({ constraintReferencesPoint, editedFitPoints }) {
      const { allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines } = reads;
      return window.PointUsage.create({ currentScope, constraintReferencesPoint, editedFitPoints,
        allGeometryLines: () => allGeometryLines(), allGeometryCircles: () => allGeometryCircles(),
        allGeometryArcs: () => allGeometryArcs(), allGeometrySplines: () => allGeometrySplines() });
    }
    return Object.freeze({ instances, catalog, projections, reads, geometryAppearance, dimensionAppearance, annotationAppearance, createPointUsage });
  }
  function createWithHatches({ document, currentScope, currentSketches, prepareBlocks, elementSketchId, applicationText,
    sketchById, isRootSketch, activeSketchId, showHiddenElements, profileRead, viewportScale }) {
    const { DEFAULT_APPEARANCE } = window.Appearance;
    const hatches = window.HatchGeometryQuery.create({
      currentScope, activeSketchId, applicationText, viewportScale,
      effectiveAppearanceForElement: (...args) => services.geometryAppearance.effectiveAppearanceForElement(...args),
      boundaryGeometry: () => {
        const { allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines } = services.reads;
        return [...allGeometryLines(), ...allGeometryCircles(), ...allGeometryArcs(), ...allGeometrySplines()];
      },
      defaultLineWidth: () => Number(document.defaultAppearance?.lineWidth) || DEFAULT_APPEARANCE.lineWidth,
    });
    const services = create({ document, currentScope, currentSketches, prepareBlocks, elementSketchId, applicationText,
      hatchGeometryQuery: hatches, sketchById, isRootSketch, activeSketchId, showHiddenElements, profileRead });
    return Object.freeze({ ...services, hatches });
  }
  window.GeometryReadServices = Object.freeze({ create, createWithHatches });
})();
