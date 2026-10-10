/* Collect a read-only hit snapshot for a canvas press. */
(() => {
  "use strict";
  function create({ geometry: { hitPoint, hitLine, hitCircle, hitArcEndpoint, hitArc, hitSpline },
    scene: { hitHatchAt, hitReferenceImageAt, hitDimension, hitBlockRotationHandle, hitBlockInstance,
      hitDerivedGeometryForDrag, hitGeometryInstance, hitSketchIdentityElement, hitAnnotationElement, hitAnnotationTarget,
      activeSketchId = () => null } }) {
    function hitItem(hit) { return hit?.constraint || hit?.arc || hit?.instance || hit?.element || hit; }
    function preferDrawingSketch(hits) {
      const id = activeSketchId();
      if (!id || !Object.values(hits).some(hit => hitItem(hit)?.sketchId === id)) return hits;
      return Object.fromEntries(Object.entries(hits).map(([key, hit]) => [key, hitItem(hit)?.sketchId === id ? hit : null]));
    }
    function read(p) {
      const blockHandle = hitBlockRotationHandle(p.x, p.y);
      const derivedGeometry = hitDerivedGeometryForDrag(p.x, p.y);
      const { hitP, hitL, hitC, hitArcEnd, hitA, hitS, hatchHit, referenceImageHit, hitD, hitBlockHandle, hitBlock, hitDerivedGeometry, hitDerivedInstance, blankAnnotationHit } = preferDrawingSketch({
        hitP: hitPoint(p.x, p.y), hitL: hitLine(p.x, p.y), hitC: hitCircle(p.x, p.y),
        hitArcEnd: hitArcEndpoint(p.x, p.y), hitA: hitArc(p.x, p.y), hitS: hitSpline(p.x, p.y),
        hatchHit: hitHatchAt(p.x, p.y), referenceImageHit: hitReferenceImageAt(p.x, p.y), hitD: hitDimension(p.x, p.y),
        hitBlockHandle: blockHandle, hitBlock: blockHandle || hitBlockInstance(p.x, p.y),
        hitDerivedGeometry: derivedGeometry, hitDerivedInstance: derivedGeometry?.instance || hitGeometryInstance(p.x, p.y),
        blankAnnotationHit: hitAnnotationElement(p.x, p.y),
      });
      const directGeometryHit = Boolean(
        (hitP && !hitP.blockProjection) ||
        (hitArcEnd && !hitArcEnd.arc.blockProjection) ||
        (hitL && !hitL.blockProjection) ||
        (hitC && !hitC.blockProjection) ||
        (hitA && !hitA.blockProjection)
        || (hitS && !hitS.blockProjection) ||
        hitDerivedGeometry
      );
      let sketchIdentity = hitSketchIdentityElement(p.x, p.y, { allowInactiveGeometry: true });
      const preferred = [["point", hitP], ["arc", hitArcEnd], ["line", hitL], ["circle", hitC], ["arc", hitA], ["spline", hitS], ["dimension", hitD], ["block", hitBlock], ["instance", hitDerivedInstance], ["hatch", hatchHit], ["annotation", blankAnnotationHit], ["image", referenceImageHit]]
        .find(([, hit]) => hitItem(hit)?.sketchId === activeSketchId());
      if (preferred && sketchIdentity?.sketchId !== activeSketchId()) {
        const item = hitItem(preferred[1]);
        sketchIdentity = { kind: preferred[0], item, sketchId: item.sketchId, id: item.id, label: item.id };
      }
      // Active Sketch content is painted in front of inactive Sketch content.
      const activeHit = hitP || hitL || hitC || hitArcEnd || hitA || hitS || hitD || hitBlock || hitDerivedInstance || hatchHit || blankAnnotationHit;
      const inactiveHit = !activeHit && activeSketchId() && sketchIdentity?.sketchId !== activeSketchId() ? sketchIdentity : null;
      const annotationTargetHit = hitAnnotationTarget(p.x, p.y);

      return { hitP, hitL, hitC, hitArcEnd, hitA, hitS, hatchHit, referenceImageHit, hitD, hitBlockHandle, hitBlock, hitDerivedGeometry, hitDerivedInstance, directGeometryHit, sketchIdentity, inactiveHit, blankAnnotationHit, annotationTargetHit };
    }
    function readDoubleClick(p) {
      const hitL = hitLine(p.x, p.y);
      const hitP = hitPoint(p.x, p.y);
      const hitC = hitCircle(p.x, p.y);
      const hitArcEnd = hitArcEndpoint(p.x, p.y);
      const hitA = hitArc(p.x, p.y);
      const hitS = hitSpline(p.x, p.y);
      const hitD = hitDimension(p.x, p.y);
      const hitBlock = hitBlockInstance(p.x, p.y);
      return preferDrawingSketch({ hitL, hitP, hitC, hitArcEnd, hitA, hitS, hitD, hitBlock, hitAnnotation: hitAnnotationElement(p.x, p.y) });
    }
    return Object.freeze({ read, readDoubleClick, derivedGeometryAt: p => hitDerivedGeometryForDrag(p.x, p.y) });
  }
  window.CanvasPressQuery = Object.freeze({ create });
})();
