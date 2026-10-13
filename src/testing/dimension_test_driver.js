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
  function createRadiusFixture({ Point, Arc, placement, layouts, circlePointAtAngle, readDefaultAppearance, viewport, hypot2, screenPxPerMm, outsideShaftLengthFactor }) {
    function radiusPlan(terminatorType = "arrow", options = {}) {
      const center = new Point("P_ARC_RADIUS_TEST", 0, 0, false, "explicit");
      const arc = new Arc("A_ARC_RADIUS_TEST", center, 30, 0, Math.PI / 2, false);
      const target = { kind: "radius", primitive: arc, value: arc.radius() };
      const dimensionAngle = Number.isFinite(options.dimensionAngle) ? options.dimensionAngle : Math.PI / 4;
      const dimension = placement.dimensionFromAnchor(target, circlePointAtAngle(arc, dimensionAngle));
      dimension.labelOffsetU = Number.isFinite(options.labelOffsetU) ? options.labelOffsetU : arc.radius() / 2;
      const appearance = {
        ...readDefaultAppearance(),
        terminatorType,
      };
      const layout = layouts.dimensionLayout(target, dimension, appearance);
      const plan = layouts.linearDimensionRenderPlan(target, layout, options.label || "R30", appearance, dimension);
      const arcExtension = layouts.arcRadiusDimensionExtensionSegment(target, layout, appearance);
      return {
        centerTerminatorVisible: Boolean(plan.firstTerminator),
        arcTerminatorVisible: Boolean(plan.secondTerminator),
        terminatorsOutside: plan.outside,
        lineStartDistanceFromCenter: hypot2(plan.lineStart.x - center.x, plan.lineStart.y - center.y),
        lineEndDistanceFromCenter: hypot2(plan.lineEnd.x - center.x, plan.lineEnd.y - center.y),
        rawExtendedLineEndDistanceFromCenter: hypot2(layout.lineB.x - center.x, layout.lineB.y - center.y),
        labelDistanceFromCenter: hypot2(layout.text.x - center.x, layout.text.y - center.y),
        shaftLengths: plan.shafts.map((shaft) => hypot2(shaft.end.x - shaft.start.x, shaft.end.y - shaft.start.y) * viewport.scale),
        shaftEndDistancesFromCenter: plan.shafts.map((shaft) => hypot2(shaft.end.x - center.x, shaft.end.y - center.y)),
        visibleExtensionCount: layout.points.filter((point) => point.showExtension !== false).length,
        arcExtensionVisible: Boolean(arcExtension),
        arcExtensionSourceEndpoint: arcExtension?.sourceEndpoint || null,
        arcExtensionOriginGap: arcExtension
          ? Math.abs(arcExtension.startAngle - arcExtension.sourceAngle) * arcExtension.radius * viewport.scale
          : null,
        arcExtensionOvershoot: arcExtension
          ? Math.abs(arcExtension.endAngle - arcExtension.intersectionAngle) * arcExtension.radius * viewport.scale
          : null,
        arcRadius: arc.radius(),
        expectedShaftLength: appearance.terminatorSize * screenPxPerMm * outsideShaftLengthFactor,
        expectedExtensionOriginGap: appearance.extensionLineOriginGap * screenPxPerMm,
        expectedExtensionOvershoot: appearance.extensionLineOvershoot * screenPxPerMm,
      };
    }
    return Object.freeze({ radiusPlan });
  }

  function createTerminatorFixture({ readDefaultAppearance, layouts, metrics, viewport, screenPxPerMm, fitMarginFactor, outsideShaftLengthFactor, hypot2 }) {
    function fit(availableScreenPixels, label = "100", terminatorType = "arrow", expressionMark = false) {
      const appearance = {
        ...readDefaultAppearance(),
        terminatorType,
      };
      const availableLength = Math.max(0, Number(availableScreenPixels) || 0) / viewport.scale;
      const layout = {
        span: availableLength,
        d: { x: 1, y: 0 },
        a: { x: 0, y: 0 },
        b: { x: availableLength, y: 0 },
        lineA: { x: 0, y: 0 },
        lineB: { x: availableLength, y: 0 },
      };
      const plan = layouts.linearDimensionRenderPlan({ kind: "point-point" }, layout, label, appearance, null, expressionMark);
      const directions = metrics.linearDimensionTerminatorDirections({ x: 1, y: 0 }, plan.outside);
      return {
        outside: plan.outside,
        textWidth: metrics.dimensionTextWidth(label, appearance, expressionMark) * viewport.scale,
        fitMargin: appearance.terminatorSize * screenPxPerMm * fitMarginFactor,
        shaftLengths: plan.shafts.map((shaft) => hypot2(shaft.end.x - shaft.start.x, shaft.end.y - shaft.start.y) * viewport.scale),
        firstDirection: directions.first,
        secondDirection: directions.second,
      };
    }

    function arrowAlignment({ lineWidth = 1.2, arrowheadAngle = 30, highlighted = false, viewportScale = viewport.scale, outside = false } = {}) {
      const previousScale = viewport.scale;
      viewport.update({ scale: Math.max(0.05, Number(viewportScale) || 1) });
      try {
        const appearance = {
          ...readDefaultAppearance(),
          terminatorType: "arrow",
          lineWidth,
          arrowheadAngle,
        };
        const strokeWidth = metrics.dimensionStrokeWidth(appearance, highlighted) / viewport.scale;
        const direction = outside ? { x: -1, y: 0 } : { x: 1, y: 0 };
        const points = metrics.dimensionOpenArrowheadRenderPoints({ x: 0, y: 0 }, direction, appearance, strokeWidth);
        const alongDirectionWorld = (point) => point.x * direction.x + point.y * direction.y;
        const pathTipInsetWorld = alongDirectionWorld(points[0]);
        const wingDistanceWorld = alongDirectionWorld(points[1]);
        const wingHalfWidthWorld = Math.abs(points[1].x * -direction.y + points[1].y * direction.x);
        const renderedHalfAngle = Math.atan2(wingHalfWidthWorld, Math.max(1e-9, wingDistanceWorld - pathTipInsetWorld));
        const visualProjection = metrics.dimensionOpenArrowJoinProjection(strokeWidth, renderedHalfAngle);
        const visualMiterApex = {
          x: points[0].x - direction.x * visualProjection,
          y: points[0].y - direction.y * visualProjection,
        };
        const alongDirection = (point) => alongDirectionWorld(point) * viewport.scale;
        const shaftLength = appearance.terminatorSize * screenPxPerMm * outsideShaftLengthFactor;
        return {
          strokeWidth: strokeWidth * viewport.scale,
          pathTipInset: alongDirection(points[0]),
          visualTipOffset: alongDirection(visualMiterApex),
          wingDistance: alongDirection(points[1]),
          nominalArrowSize: appearance.terminatorSize * screenPxPerMm,
          rearShaftLength: shaftLength - alongDirection(points[1]),
        };
      } finally {
        viewport.update({ scale: previousScale });
      }
    }
    return Object.freeze({ fit, arrowAlignment });
  }

  function createColorObservation({ canvasSelection, canvasHover, ctx, drawDimensions }) {
    function colors() {
      const colors = [];
      const previousSelectedDimension = canvasSelection.dimensionConstraint;
      const previousSelectedConstraint = canvasSelection.constraint;
      const previousHoveredDimension = canvasHover.current.dimension;
      const originalStroke = ctx.stroke;
      canvasSelection.set("dimensionConstraint", null);
      canvasSelection.set("constraint", null);
      canvasHover.update({ dimension: null });
      ctx.stroke = (...args) => {
        colors.push(String(ctx.strokeStyle).toLowerCase());
        return originalStroke.apply(ctx, args);
      };
      try {
        drawDimensions();
      } finally {
        ctx.stroke = originalStroke;
        canvasSelection.set("dimensionConstraint", previousSelectedDimension);
        canvasSelection.set("constraint", previousSelectedConstraint);
        canvasHover.update({ dimension: previousHoveredDimension });
      }
      return [...new Set(colors)];
    }
    return Object.freeze({ colors });
  }

  function createReadOnlyDuplicateFixture({ resetModelState, addPoint, addLine, dimensionFromAnchor, addDistanceConstraintFromTarget, activeSketchId, currentScope, isDimensionConstraint, dimensionLayout, hypot2, isReadOnlyDimension, dimensionLabelForConstraint, targetFromConstraint, defaultDimensionForTarget, serializeModel }) {
    function reset() {
      resetModelState();
      const p1 = addPoint(-50, 0, false, "endpoint");
      const p2 = addPoint(50, 0, false, "endpoint");
      const line = addLine(p1, p2);
      const target = { kind: "line-length", line, p1, p2, value: line.length() };
      const firstDimension = dimensionFromAnchor(target, { x: 0, y: -28 });
      const first = addDistanceConstraintFromTarget(target, line.length(), firstDimension, { sketchId: activeSketchId() });
      const second = addDistanceConstraintFromTarget(target, line.length(), dimensionFromAnchor(target, { x: 0, y: -54 }), { sketchId: activeSketchId() });
      const dimensionConstraints = currentScope().constraints.filter(isDimensionConstraint);
      const layout = dimensionLayout(target, firstDimension);
      const extensionAlignmentErrors = layout.points.map((point) => {
        const vx = point.extensionEnd.x - point.extensionStart.x;
        const vy = point.extensionEnd.y - point.extensionStart.y;
        const wx = point.source.x - point.extensionStart.x;
        const wy = point.source.y - point.extensionStart.y;
        return Math.abs(vx * wy - vy * wx) / Math.max(hypot2(vx, vy), 1e-12);
      });
      return {
        first,
        second,
        count: dimensionConstraints.length,
        enabledCount: dimensionConstraints.filter((constraint) => constraint.enabled !== false).length,
        readOnlyCount: dimensionConstraints.filter(isReadOnlyDimension).length,
        labels: dimensionConstraints.map((constraint) => dimensionLabelForConstraint(constraint, targetFromConstraint(constraint), constraint.dimension || defaultDimensionForTarget(targetFromConstraint(constraint)))),
        serializedReadOnlyCount: serializeModel().constraints.filter((constraint) => constraint.readOnlyDimension).length,
        extensionAlignmentErrors,
      };
    }
    return Object.freeze({ reset });
  }

  function createReadOnlyPlacementFixture({ resetModelState, addPoint, addLine, addDistanceConstraintFromTarget, dimensionFromAnchor, activeSketchId, constraintTargetSession, pendingCommandSession, startDistanceValueInput, dimensionValueInput, currentScope, isReadOnlyDimension, isDimensionConstraint }) {
    function reset() {
      resetModelState();
      const p1 = addPoint(-50, 0, false, "endpoint");
      const p2 = addPoint(50, 0, false, "endpoint");
      const line = addLine(p1, p2);
      const target = { kind: "line-length", line, p1, p2, value: line.length() };
      addDistanceConstraintFromTarget(target, line.length(), dimensionFromAnchor(target, { x: 0, y: -28 }), { sketchId: activeSketchId() });
      constraintTargetSession.replaceCommand({ type: "distance" });
      pendingCommandSession.replace({
        type: "distance-place",
        target,
        pointer: { x: 0, y: -54 },
        sketchId: activeSketchId(),
      });
      startDistanceValueInput({ x: 0, y: -54 });
      return {
        pendingType: pendingCommandSession.current?.type || null,
        inputHidden: dimensionValueInput.hidden,
        readOnlyCount: currentScope().constraints.filter(isReadOnlyDimension).length,
        dimensionCount: currentScope().constraints.filter(isDimensionConstraint).length,
      };
    }
    return Object.freeze({ reset });
  }

  function createExtensionVisibilityFixture({ resetModelState, addPoint, addLine, hypot2, dimensionLayout, dimensionWithLabelAt, dimensionFromAnchor }) {
    function cases() {
      resetModelState();
      const p1 = addPoint(160, 160, true, "endpoint");
      const p2 = addPoint(297.73401510731196, 185.0866714097212, false, "endpoint");
      const p3 = addPoint(279.8149641009543, 283.468110772277, false, "endpoint");
      const p4 = addPoint(142.08094899119854, 258.38143937826186, false, "endpoint");
      addLine(p1, p2);
      const sideLine = addLine(p2, p3);
      addLine(p3, p4);
      addLine(p4, p1);
      const topTarget = { kind: "point-point", p1, p2, value: hypot2(p2.x - p1.x, p2.y - p1.y) };
      const sideTarget = { kind: "point-point", p1: p2, p2: p3, value: hypot2(p3.x - p2.x, p3.y - p2.y) };
      const sideLineTarget = { kind: "line-length", line: sideLine, p1: p2, p2: p3, value: sideLine.length() };
      const visibleFlags = (target, dimension) => {
        const layout = dimensionLayout(target, dimension);
        return layout.points.map((point) => point.showExtension !== false);
      };
      const previewFlags = (target, pointer) => {
        const dimension = dimensionWithLabelAt(target, dimensionFromAnchor(target, pointer), pointer);
        return visibleFlags(target, dimension);
      };
      const leftPointer = { x: 109.1051908103851, y: 208.70539753179494 };
      return {
        top: visibleFlags(topTarget, {
          x: 275.2991240975706,
          y: 146.73754454625083,
          offsetU: 41.05643170185708,
          offsetN: -33.70830342779351,
          labelOffsetU: 42.71350462481912,
          axis: null,
        }),
        left: visibleFlags(sideTarget, {
          x: 109.1051908103851,
          y: 208.70539753179494,
          offsetU: 7.036937956365918,
          offsetN: 181.34350081496538,
          labelOffsetU: 5.954777756734029,
          axis: null,
        }),
        pointPointPreviewLeft: previewFlags(sideTarget, leftPointer),
        lineLengthPreviewLeft: previewFlags(sideLineTarget, leftPointer),
      };
    }
    return Object.freeze({ cases });
  }

  function createDisplayCases({ formatDimensionLabel, formatMeasuredDimensionLabel }) {
    function precision() {
      return {
        integerTrailingZero: formatDimensionLabel(140),
        integerHundred: formatDimensionLabel(100),
        positiveNoise: formatDimensionLabel(15.0000000058),
        negativeNoise: formatDimensionLabel(824.9999999982),
        precisionBoundaryNoise: formatDimensionLabel(1844.999999),
        measuredAccumulatedNoise: formatMeasuredDimensionLabel(1844.9999986000548),
        minimumResolution: formatDimensionLabel(0.000001),
        measuredMinimumResolution: formatMeasuredDimensionLabel(0.000001),
        roundedFraction: formatDimensionLabel(1.2345674),
      };
    }
    return Object.freeze({ precision });
  }

  function createTextAngleCases({ jisDimensionTextAngle, dimensionTextOffset }) {
    function angles() {
      const resultForDrawingAngle = (degrees) => {
        const radians = (degrees * Math.PI) / 180;
        const direction = { x: Math.cos(radians), y: -Math.sin(radians) };
        const angle = jisDimensionTextAngle(direction);
        return {
          angle: (angle * 180) / Math.PI,
          offset: dimensionTextOffset(angle, 1),
        };
      };
      return {
        zero: resultForDrawingAngle(0),
        quadrant1: resultForDrawingAngle(30),
        vertical90: resultForDrawingAngle(90),
        quadrant2: resultForDrawingAngle(150),
        straight180: resultForDrawingAngle(180),
        quadrant3: resultForDrawingAngle(210),
        vertical270: resultForDrawingAngle(270),
        quadrant4: resultForDrawingAngle(330),
        quadrant4NearVertical: resultForDrawingAngle(273),
      };
    }
    return Object.freeze({ angles });
  }

  window.DimensionTestDriver = Object.freeze({ createAppearanceObservation, createRenderObservation, createRadiusFixture, createTerminatorFixture, createColorObservation, createReadOnlyDuplicateFixture, createReadOnlyPlacementFixture, createExtensionVisibilityFixture, createDisplayCases, createTextAngleCases });
})();
