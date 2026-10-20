/* Compose press queries and hover updates from the same scene hit readers. */
(() => {
  "use strict";
  // Policy is needed before scene queries; neither phase reads the scene on construction.
  function createScene({ currentScope, dimensionScope, viewport, pointUsage, sketchContext, geometryAppearance,
    geometryReads, catalog, projections, hatches, dimensions, effectiveDimensionAppearance, dimensionLabelForConstraint,
    dimensionUsesExpression, annotationBounds, hitAnnotationElement, hatchAppearanceForDisplay, targetFromConstraint,
    drawingOrderOwner, referenceImageWorldToLocal, pointInExpandedBox, readMode, readPendingCommand, readConstraintCommand, operandValues }) {
    const { activeSketchId, elementSketchId, isEditableSketchId, isActiveSketchConstraint, constraintSketchId,
      operandRelationForSketch, referenceSourceSketchIds } = sketchContext;
    const isVisibleSketchId = (...args) => geometryAppearance.isVisibleSketchId(...args);
    const isVisibleSketchElement = (...args) => geometryAppearance.isVisibleSketchElement(...args);
    const isVisibleValue = (...args) => geometryAppearance.isVisibleValue(...args);
    const policy = window.GeometryHitQuery.createScopePolicy({ readMode, readPendingCommand, readConstraintCommand,
      isVisibleSketchId, isVisibleSketchElement, elementSketchId, activeSketchId, isEditableSketchId });
    function createQueries() {
      const { ordinarySelectionMode, hitSketchAllowed, hitElementAllowed } = policy;
      const { resolvedHatchBoundary, hatchContainsSelectablePoint } = hatches;
      const { allHatches, geometryInstanceBundles, blockProjectionBundles, allGeometryPoints, allGeometryLines, allGeometryCircles,
        allGeometryArcs, allGeometrySplines } = geometryReads;
      const { isExplicitPoint, isSelectableEndpointPoint, isPointUsedByPrimitive, isReferencePoint } = pointUsage;
      const { blockProjectionBundle } = projections;
      const viewportScale = () => viewport.scale;
      const regions = window.GeometryHitQuery.createRegions({ currentScope, ordinarySelectionMode, allHatches,
        isVisibleSketchId, isVisibleValue, hatchAppearanceForDisplay, activeSketchId, drawingOrderOwner,
        resolvedHatchBoundary, hatchContainsSelectablePoint, referenceImageWorldToLocal });
      const dimensionQueries = window.GeometryHitQuery.createDimensions({ currentScope: dimensionScope, viewportScale,
        ordinarySelectionMode, isActiveSketchConstraint, isVisibleSketchId, constraintSketchId, targetFromConstraint,
        defaultDimensionForTarget: dimensions.placement.defaultDimensionForTarget, isVisibleValue, effectiveDimensionAppearance,
        dimensionLayout: (...args) => dimensions.layout(...args), dimensionLabelForConstraint,
        dimensionTextDrawingMetrics: dimensions.metrics.dimensionTextDrawingMetrics, dimensionTextWidth: dimensions.metrics.dimensionTextWidth,
        dimensionUsesExpression, pointInExpandedBox });
      const instances = window.GeometryHitQuery.createInstances({ currentScope, viewportScale, hitSketchAllowed,
        isVisibleSketchId, blockProjectionBundle, annotationBounds, resolvedHatchBoundary, isVisibleValue,
        hatchAppearanceForDisplay, hatchContainsSelectablePoint, geometryInstanceBundles });
      const geometry = window.GeometryHitQuery.create({ currentScope, viewportScale,
        isEditableSketchElement: hitElementAllowed, isSelectableEndpointPoint, isExplicitPoint, preferredSketchId: activeSketchId,
        hitDimension: (...args) => dimensionQueries.hitDimension(...args), constraintSketchId, elementSketchId, isVisibleSketchElement,
        hitBlockInstance: (...args) => instances.hitBlockInstance(...args), blockDefinitionById: catalog.blockDefinitionById,
        hitGeometryInstance: (...args) => instances.hitGeometryInstance(...args), hitAnnotationElement: (...args) => hitAnnotationElement(...args),
        hitHatchAt: (...args) => regions.hitHatchAt(...args), hitReferenceImageAt: (...args) => regions.hitReferenceImageAt(...args) });
      const operands = window.OperandHitQuery.create({ viewportScale,
        geometry: { geometryInstanceBundles, blockProjectionBundles, allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines },
        sketches: { isVisibleSketchId, operandRelationForSketch, referenceSourceSketchIds, elementSketchId, isVisibleSketchElement },
        points: { isExplicitPoint, isPointUsedByPrimitive, isReferencePoint },
        makeConstraintOperand: operandValues.makeConstraintOperand, operandFromReferenceTarget: operandValues.operandFromReferenceTarget,
        hits: geometry });
      return Object.freeze({ regions, dimensions: dimensionQueries, instances, geometry, operands });
    }
    return Object.freeze({ policy, createQueries });
  }
  function create({ canvasHover, sameArcEndpoint, isActiveSketchConstraint,
    geometry: { hitPoint, hitEndpointPoint, hitExplicitPoint, hitLine, hitCircle, hitArcEndpoint, hitArc, hitSpline },
    scene: { hitHatchAt, hitReferenceImageAt, hitDimension, hitBlockRotationHandle, hitBlockInstance,
      hitDerivedGeometryForDrag, hitGeometryInstance, hitSketchIdentityElement, hitAnnotationElement, hitAnnotationTarget, activeSketchId,
      hitDerivedProjectionOperand, hitBlockProjectionOperand, hitReferenceTarget } }) {
    const press = window.CanvasPressQuery.create({
      geometry: { hitPoint, hitLine, hitCircle, hitArcEndpoint, hitArc, hitSpline },
      scene: { hitHatchAt, hitReferenceImageAt, hitDimension, hitBlockRotationHandle, hitBlockInstance,
        hitDerivedGeometryForDrag, hitGeometryInstance, hitSketchIdentityElement, hitAnnotationElement, hitAnnotationTarget, activeSketchId },
    });
    const hover = window.PointerHover.create({
      canvasHover, sameArcEndpoint, isActiveSketchConstraint,
      geometry: { hitEndpointPoint, hitExplicitPoint, hitLine, hitCircle, hitArcEndpoint, hitArc, hitSpline },
      scene: { hitDimension, hitDerivedProjectionOperand, hitBlockProjectionOperand, hitReferenceTarget, hitSketchIdentityElement,
        hitBlockInstance, hitGeometryInstance, hitAnnotationElement, hitHatchAt, hitReferenceImageAt,
        hitAnnotationInteraction: (x, y, anchorsOnly) => {
          const hit = hitAnnotationElement(x, y);
          return hit && !hit.element.blockProjection && (hit.part === "anchor" || !anchorsOnly && (["frame", "frame-enable"].includes(hit.part) || hit.textBody)) ? hit : null;
        } },
    });

    return Object.freeze({ press, hover });
  }
  window.CanvasHitInteraction = Object.freeze({ create, createScene });
})();
