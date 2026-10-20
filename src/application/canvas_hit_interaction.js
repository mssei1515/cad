/* Compose press queries and hover updates from the same scene hit readers. */
(() => {
  "use strict";
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
  window.CanvasHitInteraction = Object.freeze({ create });
})();
