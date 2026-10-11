/* Decide and apply ordinary/constraint hover; commands, dragging and drawing stay outside. */
(() => {
  "use strict";
  const { Circle, Arc } = window.GeometrySolver;
  function create({ canvasHover, sameArcEndpoint, isActiveSketchConstraint, geometry, scene }) {
    const { hitEndpointPoint, hitExplicitPoint, hitLine, hitCircle, hitArcEndpoint, hitArc, hitSpline } = geometry;
    const { hitDimension, hitDerivedProjectionOperand, hitBlockProjectionOperand, hitReferenceTarget, hitSketchIdentityElement,
      hitBlockInstance, hitGeometryInstance, hitAnnotationElement, hitAnnotationInteraction, hitHatchAt, hitReferenceImageAt } = scene;
    function highlightAnnotation(hit) {
      const element = hit.element || hit;
      const handle = hit.part === "frame" ? { element, resizeX: hit.resizeX, resizeY: hit.resizeY } : null;
      const previous = canvasHover.current.annotationHandle;
      if (canvasHover.current.annotation === element && handle?.resizeX === previous?.resizeX && handle?.resizeY === previous?.resizeY && Object.entries(canvasHover.current).every(([key, value]) => key === "annotation" || key === "annotationHandle" || !value)) return false;
      canvasHover.clear(); canvasHover.update({ annotation: element, annotationHandle: handle }); return true;
    }
    function updateConstraint(p, constraintType) {
      const annotation = hitAnnotationInteraction?.(p.x, p.y, true);
      if (annotation) return highlightAnnotation(annotation);
      const hitD = constraintType === "distance" ? hitDimension(p.x, p.y) : null;
      if (hitD) {
        canvasHover.update({
          point: null, endpointPoint: null, line: null,
          circle: null, arcEndpoint: null, arc: null,
          dimension: hitD.constraint, block: null, ...(hitAnnotationInteraction ? { annotation: null, annotationHandle: null } : {}),
        });
        return true;
      }
      const blockOperand = hitDerivedProjectionOperand(p.x, p.y) || hitBlockProjectionOperand(p.x, p.y);
      if (blockOperand) {
        canvasHover.update({
          point: blockOperand.kind === "point" ? blockOperand.point : null, endpointPoint: null, line: blockOperand.kind === "line" ? blockOperand.line : null,
          circle: blockOperand.kind === "primitive" && blockOperand.primitive instanceof Circle ? blockOperand.primitive : null, arc: blockOperand.kind === "primitive" && blockOperand.primitive instanceof Arc ? blockOperand.primitive : null, arcEndpoint: blockOperand.kind === "arc-endpoint" ? { arc: blockOperand.arc, endpoint: blockOperand.endpoint } : null,
          dimension: null, block: null, ...(hitAnnotationInteraction ? { annotation: null, annotationHandle: null } : {}),
        });
        return true;
      }
      const referenceTarget = hitReferenceTarget(p.x, p.y);
      const nextSketchIdentity = hitSketchIdentityElement(p.x, p.y, { allowInactiveGeometry: true });
      const nextEndpointHover = referenceTarget ? null : hitEndpointPoint(p.x, p.y);
      const nextPointHover = referenceTarget ? (referenceTarget.kind === "point" ? referenceTarget.point : null) : nextEndpointHover || hitExplicitPoint(p.x, p.y);
      const nextLineHover = referenceTarget ? (referenceTarget.kind === "line" ? referenceTarget.line : null) : nextPointHover ? null : hitLine(p.x, p.y);
      const nextCircleHover = referenceTarget
        ? referenceTarget.primitive instanceof Circle
          ? referenceTarget.primitive
          : null
        : nextPointHover || nextLineHover
          ? null
          : hitCircle(p.x, p.y);
      const nextArcEndpointHover = referenceTarget || nextPointHover || nextLineHover || nextCircleHover ? null : hitArcEndpoint(p.x, p.y);
      const nextArcHover = referenceTarget
        ? referenceTarget.primitive instanceof Arc
          ? referenceTarget.primitive
          : null
        : nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover
          ? null
          : hitArc(p.x, p.y);
      const nextAnnotationHover = nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover || nextArcHover ? (hitAnnotationInteraction ? null : canvasHover.current.annotation) : hitAnnotationElement(p.x, p.y)?.element || null;
      if (
        nextPointHover !== canvasHover.current.point ||
        nextEndpointHover !== canvasHover.current.endpointPoint ||
        nextLineHover !== canvasHover.current.line ||
        nextCircleHover !== canvasHover.current.circle ||
        !sameArcEndpoint(nextArcEndpointHover, canvasHover.current.arcEndpoint) ||
        nextArcHover !== canvasHover.current.arc || nextAnnotationHover !== canvasHover.current.annotation || canvasHover.current.annotationHandle ||
        canvasHover.current.dimension ||
        nextSketchIdentity?.item !== canvasHover.current.sketchIdentity?.item ||
        Boolean(nextSketchIdentity)
      ) {
        canvasHover.update({
          point: nextPointHover, endpointPoint: nextEndpointHover, line: nextLineHover,
          circle: nextCircleHover, arcEndpoint: nextArcEndpointHover, arc: nextArcHover,
          dimension: null, sketchIdentity: nextSketchIdentity, annotation: nextAnnotationHover, annotationHandle: null,
        });
        return true;
      }
      return false;
    }

    function updateOrdinary(p) {
      const annotation = hitAnnotationInteraction?.(p.x, p.y, false);
      if (annotation) return highlightAnnotation(annotation);
      const hitD = hitDimension(p.x, p.y, { activeOnly: false });
      const nextHover = hitD && isActiveSketchConstraint(hitD.constraint) ? hitD.constraint : null;
      const nextEndpointHover = nextHover ? null : hitEndpointPoint(p.x, p.y);
      const nextPointHover = nextHover ? null : nextEndpointHover || hitExplicitPoint(p.x, p.y);
      const nextLineHover = nextPointHover ? null : hitLine(p.x, p.y);
      const nextCircleHover = nextPointHover || nextLineHover ? null : hitCircle(p.x, p.y);
      const nextArcEndpointHover = nextPointHover || nextLineHover || nextCircleHover ? null : hitArcEndpoint(p.x, p.y);
      const nextArcHover = nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover ? null : hitArc(p.x, p.y);
      const nextSplineHover = nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover || nextArcHover ? null : hitSpline(p.x, p.y);
      const nextSketchIdentity = hitSketchIdentityElement(p.x, p.y, { allowInactiveGeometry: true });
      let nextBlockHover = nextHover || nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover || nextArcHover || nextSplineHover ? null : hitBlockInstance(p.x, p.y);
      const nextGeometryInstanceHover = nextHover || nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover || nextArcHover || nextSplineHover || nextBlockHover ? null : hitGeometryInstance(p.x, p.y);
      const annotationHit = nextHover || nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover || nextArcHover || nextSplineHover || nextBlockHover || nextGeometryInstanceHover
        ? null
        : hitAnnotationElement(p.x, p.y);
      const nextAnnotationHover = annotationHit?.element || null;
      const rawHatchHover = nextAnnotationHover ? null : hitHatchAt(p.x, p.y);
      if (!nextBlockHover && rawHatchHover?.blockProjection) nextBlockHover = rawHatchHover.blockInstance;
      const nextHatchHover = rawHatchHover?.blockProjection ? null : rawHatchHover;
      const nextReferenceImageHover = nextHover || nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover || nextArcHover || nextSplineHover || nextBlockHover || nextAnnotationHover || rawHatchHover
        ? null
        : hitReferenceImageAt(p.x, p.y);
      if (
        nextPointHover !== canvasHover.current.point ||
        nextEndpointHover !== canvasHover.current.endpointPoint ||
        nextLineHover !== canvasHover.current.line ||
        nextCircleHover !== canvasHover.current.circle ||
        !sameArcEndpoint(nextArcEndpointHover, canvasHover.current.arcEndpoint) ||
        nextArcHover !== canvasHover.current.arc ||
        nextSplineHover !== canvasHover.current.spline ||
        nextHover !== canvasHover.current.dimension ||
        nextSketchIdentity?.item !== canvasHover.current.sketchIdentity?.item ||
        Boolean(nextSketchIdentity) || nextBlockHover !== canvasHover.current.block || nextGeometryInstanceHover !== canvasHover.current.geometryInstance ||
        nextAnnotationHover !== canvasHover.current.annotation || canvasHover.current.annotationHandle ||
        nextHatchHover !== canvasHover.current.hatch ||
        nextReferenceImageHover !== canvasHover.current.referenceImage
      ) {
        canvasHover.update({
          point: nextPointHover, endpointPoint: nextEndpointHover, line: nextLineHover,
          circle: nextCircleHover, arcEndpoint: nextArcEndpointHover, arc: nextArcHover,
          spline: nextSplineHover, dimension: nextHover, sketchIdentity: nextSketchIdentity,
          block: nextBlockHover, geometryInstance: nextGeometryInstanceHover, annotation: nextAnnotationHover, annotationHandle: null,
          hatch: nextHatchHover, referenceImage: nextReferenceImageHover,
        });
        return true;
      }
      return false;
    }

    return Object.freeze({ updateConstraint, updateOrdinary });
  }
  window.PointerHover = Object.freeze({ create });
})();
