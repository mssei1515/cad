/* Collect a read-only hit snapshot for a canvas press. */
(() => {
  "use strict";
  function create({ geometry: { hitPoint, hitLine, hitCircle, hitArcEndpoint, hitArc, hitSpline },
    scene: { hitHatchAt, hitReferenceImageAt, hitDimension, hitBlockRotationHandle, hitBlockInstance,
      hitDerivedGeometryForDrag, hitGeometryInstance, hitSketchIdentityElement, hitAnnotationElement, hitAnnotationTarget } }) {
    function read(p) {
      const hitP = hitPoint(p.x, p.y);
      const hitL = hitLine(p.x, p.y);
      const hitC = hitCircle(p.x, p.y);
      const hitArcEnd = hitArcEndpoint(p.x, p.y);
      const hitA = hitArc(p.x, p.y);
      const hitS = hitSpline(p.x, p.y);
      const hatchHit = hitHatchAt(p.x, p.y);
      const referenceImageHit = hitReferenceImageAt(p.x, p.y);
      const hitD = hitDimension(p.x, p.y);
      const hitBlockHandle = hitBlockRotationHandle(p.x, p.y);
      const hitBlock = hitBlockHandle || hitBlockInstance(p.x, p.y);
      const hitDerivedGeometry = hitDerivedGeometryForDrag(p.x, p.y);
      const hitDerivedInstance = hitDerivedGeometry?.instance || hitGeometryInstance(p.x, p.y);
      const directGeometryHit = Boolean(
        (hitP && !hitP.blockProjection) ||
        (hitArcEnd && !hitArcEnd.arc.blockProjection) ||
        (hitL && !hitL.blockProjection) ||
        (hitC && !hitC.blockProjection) ||
        (hitA && !hitA.blockProjection)
        || (hitS && !hitS.blockProjection) ||
        hitDerivedGeometry
      );
      const sketchIdentity = hitSketchIdentityElement(p.x, p.y, { allowInactiveGeometry: true });
      const inactiveHit = null;
      const blankAnnotationHit = hitAnnotationElement(p.x, p.y);
      const annotationTargetHit = hitAnnotationTarget(p.x, p.y);

      return { hitP, hitL, hitC, hitArcEnd, hitA, hitS, hatchHit, referenceImageHit, hitD, hitBlockHandle, hitBlock, hitDerivedGeometry, hitDerivedInstance, directGeometryHit, sketchIdentity, inactiveHit, blankAnnotationHit, annotationTargetHit };
    }
    return Object.freeze({ read });
  }
  window.CanvasPressQuery = Object.freeze({ create });
})();
