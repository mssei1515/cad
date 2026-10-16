/* Browser-test annotation fixtures and observations delegate to existing editing/display owners. */
(() => {
  "use strict";
  function createDragFixture({ resetModelState, addPoint, addLine, annotationLeaderTargetFromItem, pushAnnotation, defaultStyle, resizeCanvas, readSnapshot }) {
    function reset() {
      resetModelState();
      const p1 = addPoint(-60, -25, false, "endpoint");
      const p2 = addPoint(60, -25, false, "endpoint");
      const p3 = addPoint(60, 35, false, "endpoint");
      const p4 = addPoint(-60, 35, false, "endpoint");
      addLine(p1, p2);
      addLine(p2, p3);
      const l3 = addLine(p3, p4);
      addLine(p4, p1);
      const leaderTarget = annotationLeaderTargetFromItem(l3, { x: 0, y: 35 });
      pushAnnotation({
        type: "leader",
        text: "注記",
        start: { ...leaderTarget.anchor },
        elbow: { x: 56, y: 82 },
        end: { x: 112, y: 82 },
        geometryRef: leaderTarget.geometryRef,
        style: { ...defaultStyle },
      });
      pushAnnotation({ type: "text", text: "自由テキスト", x: -90, y: 80, style: { ...defaultStyle } });
      resizeCanvas({ centerWorld: { x: 20, y: 20 } });
      return readSnapshot();
    }
    return Object.freeze({ reset });
  }

  function createSnapshot({ currentScope, annotationLeaderDisplayGeometry, canvas, worldToCanvasScreen }) {
    function snapshot() {
      const leaderElement = [...currentScope().annotations].reverse().find((element) => element.type === "leader");
      const textElement = [...currentScope().annotations].reverse().find((element) => element.type === "text");
      const leaderGeometry = leaderElement ? annotationLeaderDisplayGeometry(leaderElement) : null;
      const canvasRect = canvas.getBoundingClientRect();
      const toViewport = (point) => {
        const screen = worldToCanvasScreen(point);
        return { x: canvasRect.left + screen.x, y: canvasRect.top + screen.y };
      };
      return {
        leader: leaderElement
          ? {
              world: { ...leaderElement.end },
              viewport: toViewport(leaderGeometry.end),
              displayEnd: { ...leaderGeometry.end },
              bodyViewport: toViewport({ x: (leaderGeometry.elbow.x + leaderGeometry.end.x) / 2, y: leaderGeometry.end.y }),
              end: { ...leaderElement.end },
              elbow: leaderElement.elbow ? { ...leaderElement.elbow } : null,
            }
          : null,
        text: textElement ? { world: { x: textElement.x, y: textElement.y }, viewport: toViewport(textElement) } : null,
      };
    }
    return Object.freeze({ snapshot });
  }

  function createHitObservation({ canvas, screenToWorld, hitAnnotationElement }) {
    function hit(viewportPoint) {
      const canvasRect = canvas.getBoundingClientRect();
      const world = screenToWorld({ x: viewportPoint.x - canvasRect.left, y: viewportPoint.y - canvasRect.top });
      const hit = hitAnnotationElement(world.x, world.y);
      return hit ? { type: hit.type, part: hit.part } : null;
    }
    return Object.freeze({ hit });
  }

  function createDimensionObservation({ annotationDimensions, targetFromConstraint, dimensionLayout, effectiveDimensionAppearance, dimensionLabelForConstraint }) {
    function state() {
      return annotationDimensions.entries().map(constraint => {
        const target = targetFromConstraint(constraint), dimension = constraint.dimension;
        const layout = dimensionLayout(target, dimension, effectiveDimensionAppearance(dimension, constraint.sketchId));
        return { annotationId: constraint.annotationOwner.id, type: constraint.annotationRelation.type, value: constraint.target,
          dimension: JSON.parse(JSON.stringify(dimension)), label: dimensionLabelForConstraint(constraint, target, dimension),
          text: layout?.text, hit: layout && { a: layout.hitA, b: layout.hitB } };
      });
    }
    return Object.freeze({ state });
  }

  function createAppearanceObservation({ currentScope, viewport, clampZoom, effectiveAnnotationStyle, draw, annotationTextMetrics, annotationTextLayout, annotationLeaderDisplayGeometry, annotationTextWorldHeight, screenPxPerMm, annotationDisplayFactor, annotationLeaderAnchor, displayText, formatDisplayNumber, serializeAnnotation }) {
    function state(type = "text", scale = null) {
      const annotation = currentScope().annotations.find((element) => element.type === type) || null;
      if (scale != null) viewport.update({ scale: clampZoom(Number(scale) || 1) });
      if (!annotation) return null;
      const style = effectiveAnnotationStyle(annotation);
      draw();
      return {
        style: structuredClone(style),
        rotation: annotation.appearanceInheritance ? style.rotation || 0 : Number(annotation.rotation) || 0,
        textMetrics: annotationTextMetrics(annotation, annotationTextLayout(annotation) || (annotation.type === "leader" ? annotationLeaderDisplayGeometry(annotation) : annotation)),
        screenTextHeight: annotationTextWorldHeight(style) * viewport.scale,
        screenTerminatorSize: style.terminatorSize * screenPxPerMm * annotationDisplayFactor(style, viewport.scale),
        textLayout: annotationTextLayout(annotation),
        displayGeometry: annotation.type === "leader" ? annotationLeaderDisplayGeometry(annotation) : null,
        resolvedStart: annotation.type === "leader" ? annotationLeaderAnchor(annotation) : null,
        displayedText: displayText(annotation, formatDisplayNumber),
        serialized: serializeAnnotation(annotation),
      };
    }
    return Object.freeze({ state });
  }

  function createOwnershipObservation({ canvas, worldToCanvasScreen, annotationTextLayout, annotationLeaderDisplayGeometry, currentScope, serializeAnnotation, allAnnotations, displayText, formatDisplayNumber, effectiveAnnotationStyle, annotationLeaderAnchor, canvasSelection, allGeometryBounds }) {
    function state() {
      const rect = canvas.getBoundingClientRect();
      const clientPoint = (annotation) => {
        const screen = worldToCanvasScreen(annotationTextLayout(annotation) || (annotation.type === "leader" ? annotationLeaderDisplayGeometry(annotation) : null) || annotation);
        return { x: rect.left + screen.x, y: rect.top + screen.y };
      };
      return {
        direct: currentScope().annotations.map((annotation) => ({ ...serializeAnnotation(annotation) })),
        projected: allAnnotations().filter((annotation) => annotation.blockProjection).map((annotation) => ({
          id: annotation.id,
          sketchId: annotation.sketchId,
          type: annotation.type,
          text: annotation.text,
          displayedText: displayText(annotation, formatDisplayNumber),
          x: annotation.x,
          y: annotation.y,
          rotation: Number(annotation.rotation) || 0,
          visible: annotation.visible !== false,
          style: { ...(annotation.style || {}) },
          client: clientPoint(annotation),
          effectiveStyle: effectiveAnnotationStyle(annotation),
          textLayout: annotationTextLayout(annotation),
          displayGeometry: annotation.type === "leader" ? annotationLeaderDisplayGeometry(annotation) : null,
          resolvedStart: annotation.type === "leader" ? annotationLeaderAnchor(annotation) : null,
          ownerId: annotation.blockInstance?.id || null,
        })),
        selectedIds: canvasSelection.annotations.map((annotation) => annotation.id),
        bounds: allGeometryBounds(),
      };
    }
    return Object.freeze({ state });
  }

  // Compose Annotation-only fixtures and observations; publication stays with the caller.
  function createSupport({
    annotationDimensions, targetFromConstraint, dimensionLayout, effectiveDimensionAppearance, dimensionLabelForConstraint,
    currentScope, viewport, clampZoom, effectiveAnnotationStyle, draw, annotationTextMetrics, annotationTextLayout,
    annotationLeaderDisplayGeometry, annotationTextWorldHeight, screenPxPerMm, annotationDisplayFactor, annotationLeaderAnchor,
    displayText, formatDisplayNumber, serializeAnnotation, canvas, worldToCanvasScreen, allAnnotations, canvasSelection, allGeometryBounds,
    resetModelState, addPoint, addLine, annotationLeaderTargetFromItem, pushAnnotation, defaultStyle, resizeCanvas,
    screenToWorld, hitAnnotationElement, readDragState
  }) {
    const annotationDimensionObservation = createDimensionObservation({ annotationDimensions, targetFromConstraint, dimensionLayout, effectiveDimensionAppearance, dimensionLabelForConstraint });
    const annotationAppearanceObservation = createAppearanceObservation({
      currentScope, viewport, clampZoom, effectiveAnnotationStyle, draw, annotationTextMetrics, annotationTextLayout, annotationLeaderDisplayGeometry, annotationTextWorldHeight,
      screenPxPerMm, annotationDisplayFactor, annotationLeaderAnchor, displayText, formatDisplayNumber, serializeAnnotation,
    });
    const annotationOwnershipObservation = createOwnershipObservation({
      canvas, worldToCanvasScreen, annotationTextLayout, annotationLeaderDisplayGeometry, currentScope, serializeAnnotation, allAnnotations,
      displayText, formatDisplayNumber, effectiveAnnotationStyle, annotationLeaderAnchor, canvasSelection, allGeometryBounds,
    });
    const annotationSnapshotObservation = createSnapshot({ currentScope, annotationLeaderDisplayGeometry, canvas, worldToCanvasScreen });
    const annotationDragFixture = createDragFixture({
      resetModelState, addPoint, addLine, annotationLeaderTargetFromItem, pushAnnotation, defaultStyle, resizeCanvas, readSnapshot: annotationSnapshotObservation.snapshot,
    });
    const annotationHitObservation = createHitObservation({ canvas, screenToWorld, hitAnnotationElement });
    return Object.freeze({
      fixtures: Object.freeze({ resetForAnnotationDrag: annotationDragFixture.reset }),
      observations: Object.freeze({
        annotationSnapshot: annotationSnapshotObservation.snapshot,
        annotationDimensionStateForTest: annotationDimensionObservation.state,
        annotationAppearanceStateForTest: annotationAppearanceObservation.state,
        annotationOwnershipStateForTest: annotationOwnershipObservation.state,
      }),
      interaction: Object.freeze({
        annotationHitAt: annotationHitObservation.hit,
        annotationDragActive() { return readDragState(); },
      }),
    });
  }

  window.AnnotationTestDriver = Object.freeze({ createSupport, createDragFixture, createSnapshot, createHitObservation, createDimensionObservation, createAppearanceObservation, createOwnershipObservation });
})();
