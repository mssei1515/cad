/* Dimension browser observations through live scope, appearance and rendering owners. */
(() => {
  "use strict";
  function createAppearanceObservation({ currentScope, readDocument, isDimensionConstraint, constraintSketchId, activeSketchId, normalizeDimensionAppearance, effectiveDimensionAppearanceForSketch, dimensionDisplayState }) {
    function state(index = 0) {
      const constraint = currentScope().constraints.filter(isDimensionConstraint)[index] || null;
      const sketchId = constraint ? constraintSketchId(constraint) : activeSketchId();
      const sketch = currentScope().sketches.find((item) => item.id === sketchId) || null;
      return {
        documentDefault: structuredClone(normalizeDimensionAppearance({ ...readDocument().defaultDimensionAppearance, ...readDocument().defaultTerminatorAppearance }, { partial: false })),
        sketchDirect: structuredClone(normalizeDimensionAppearance(sketch?.dimensionAppearance)),
        sketchEffective: structuredClone(effectiveDimensionAppearanceForSketch(sketch)),
        direct: structuredClone(normalizeDimensionAppearance(constraint?.dimension?.display)),
        effective: constraint ? structuredClone(dimensionDisplayState(constraint.dimension, sketchId)) : null,
        blockDefinitions: readDocument().blockDefinitions.map((definition) => ({
          id: definition.id,
          dimensions: (definition.constraints || []).filter(isDimensionConstraint).map((item) => ({
            sketchDirect: structuredClone(normalizeDimensionAppearance(definition.sketches.find((sketchItem) => sketchItem.id === item.sketchId)?.dimensionAppearance)),
            direct: structuredClone(normalizeDimensionAppearance(item.dimension?.display)),
            effective: structuredClone(dimensionDisplayState(item.dimension, item.sketchId, definition.sketches)),
          })),
        })),
      };
    }
    return Object.freeze({ state });
  }

  function createRenderObservation({ currentScope, isDimensionConstraint, targetFromConstraint, constraintSketchId, activeSketchId, effectiveDimensionAppearance, placement, layouts, metrics, viewport, screenPxPerMm, displayFactor, hypot2 }) {
    function appearanceMetrics(index = 0) {
      const constraint = currentScope().constraints.filter(isDimensionConstraint)[index] || null;
      const target = targetFromConstraint(constraint);
      const sketchId = constraint ? constraintSketchId(constraint) : activeSketchId();
      const dimension = constraint?.dimension || (target ? placement.defaultDimensionForTarget(target) : null);
      const appearance = effectiveDimensionAppearance(dimension, sketchId);
      const layout = target && target.kind !== "angle" ? layouts.dimensionLayout(target, dimension, appearance) : null;
      const firstExtension = layout?.points?.find((point) => point.showExtension !== false) || null;
      const arrow = metrics.dimensionArrowheadPoints({ x: 0, y: 0 }, { x: 1, y: 0 }, appearance);
      const arrowLength = (arrow[1].x - arrow[0].x) * viewport.scale;
      const arrowHalfWidth = Math.abs(arrow[1].y - arrow[0].y) * viewport.scale;
      const text = metrics.dimensionTextDrawingMetrics(appearance);
      const angleRadius = 50 / viewport.scale;
      const [angleExtension] = layouts.angleDimensionExtensionSegments({ vertex: { x: 0, y: 0 }, radius: angleRadius, start: 0, end: Math.PI / 2 }, appearance);
      return {
        appearance: structuredClone(appearance),
        linearExtension: firstExtension ? {
          originGap: hypot2(firstExtension.extensionStart.x - firstExtension.source.x, firstExtension.extensionStart.y - firstExtension.source.y) * viewport.scale,
          overshoot: hypot2(firstExtension.extensionEnd.x - firstExtension.onDimension.x, firstExtension.extensionEnd.y - firstExtension.onDimension.y) * viewport.scale,
        } : null,
        angleExtension: {
          originGap: hypot2(angleExtension.start.x, angleExtension.start.y) * viewport.scale,
          overshoot: (hypot2(angleExtension.end.x, angleExtension.end.y) - angleRadius) * viewport.scale,
        },
        terminator: {
          type: appearance.terminatorType,
          size: appearance.terminatorSize * screenPxPerMm * displayFactor(appearance, viewport.scale),
          openingAngle: appearance.terminatorType === "dot" ? null : Math.atan2(arrowHalfWidth, arrowLength) * 360 / Math.PI,
        },
        lineWidth: metrics.dimensionStrokeWidth(appearance) * displayFactor(appearance, viewport.scale),
        text: {
          height: text.height * viewport.scale,
          gap: text.gap * viewport.scale,
        },
      };
    }
    return Object.freeze({ appearanceMetrics });
  }
  window.DimensionTestDriver = Object.freeze({ createAppearanceObservation, createRenderObservation });
})();
