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

  function createAngleLabelFixture({ resetModelState, addPoint, addLine, dimensionFromAnchor, angleDimensionLabelBasis, angleDimensionLayout, angleDimensionLabelOffsets, setAngleDimensionLabelOffsets, angleDimensionFromLabelPoint, hypot2, serializeDimension }) {
    function followCase() {
      resetModelState();
      const p1 = addPoint(-80, 0, false, "endpoint");
      const p2 = addPoint(80, 0, false, "endpoint");
      const p3 = addPoint(0, -80, false, "endpoint");
      const p4 = addPoint(0, 80, false, "endpoint");
      const line1 = addLine(p1, p2);
      const line2 = addLine(p3, p4);
      const target = { kind: "angle", line1, line2, value: 90 };
      const initial = dimensionFromAnchor(target, { x: 45, y: 45 });
      const initialBasis = angleDimensionLabelBasis(target, initial);
      initial.labelX = initialBasis.arcPoint.x + initialBasis.radial.x * 11 + initialBasis.tangent.x * 7;
      initial.labelY = initialBasis.arcPoint.y + initialBasis.radial.y * 11 + initialBasis.tangent.y * 7;

      const corruptedRelativePlacement = {
        ...dimensionFromAnchor(target, { x: 45, y: 45 }),
        angleLabelOffsetR: 27.337291652719134,
        angleLabelOffsetT: -6.399630529188789,
      };
      angleDimensionLayout(target, corruptedRelativePlacement);
      const recoveredCorruptedOffsets = angleDimensionLabelOffsets(target, corruptedRelativePlacement);

      const before = angleDimensionLayout(target, initial);
      const beforeBasis = angleDimensionLabelBasis(target, initial);
      const translation = { x: 34, y: -19 };
      for (const point of [p1, p2, p3, p4]) {
        point.x += translation.x;
        point.y += translation.y;
      }
      const afterTranslation = angleDimensionLayout(target, initial);
      const afterTranslationBasis = angleDimensionLabelBasis(target, initial);
      const labelTranslationError = hypot2(
        afterTranslation.text.x - before.text.x - translation.x,
        afterTranslation.text.y - before.text.y - translation.y,
      );
      const arcTranslationError = hypot2(
        afterTranslationBasis.arcPoint.x - beforeBasis.arcPoint.x - translation.x,
        afterTranslationBasis.arcPoint.y - beforeBasis.arcPoint.y - translation.y,
      );

      const storedOffsets = angleDimensionLabelOffsets(target, initial);
      const movedAnchor = {
        x: afterTranslationBasis.arcPoint.x + afterTranslationBasis.radial.x * 26,
        y: afterTranslationBasis.arcPoint.y + afterTranslationBasis.radial.y * 26,
      };
      const movedDimension = dimensionFromAnchor(target, movedAnchor, { allowPointAxis: false });
      setAngleDimensionLabelOffsets(movedDimension, storedOffsets);
      const afterRadiusMove = angleDimensionLayout(target, movedDimension);
      const afterRadiusMoveBasis = angleDimensionLabelBasis(target, movedDimension);
      const labelRadiusDelta = {
        x: afterRadiusMove.text.x - afterTranslation.text.x,
        y: afterRadiusMove.text.y - afterTranslation.text.y,
      };
      const arcRadiusDelta = {
        x: afterRadiusMoveBasis.arcPoint.x - afterTranslationBasis.arcPoint.x,
        y: afterRadiusMoveBasis.arcPoint.y - afterTranslationBasis.arcPoint.y,
      };
      let repeatedlyDraggedDimension = movedDimension;
      const dragOffsets = angleDimensionLabelOffsets(target, repeatedlyDraggedDimension);
      let repeatedDragOffsetError = 0;
      let repeatedDragRadialPointerError = 0;
      for (let index = 0; index < 8; index++) {
        const currentLayout = angleDimensionLayout(target, repeatedlyDraggedDimension);
        const pointer = {
          x: currentLayout.text.x + (index % 2 === 0 ? 13 : -9),
          y: currentLayout.text.y + (index % 3 === 0 ? 8 : -6),
        };
        repeatedlyDraggedDimension = angleDimensionFromLabelPoint(
          target,
          pointer,
          angleDimensionLabelOffsets(target, repeatedlyDraggedDimension),
        );
        const nextOffsets = angleDimensionLabelOffsets(target, repeatedlyDraggedDimension);
        const nextLayout = angleDimensionLayout(target, repeatedlyDraggedDimension);
        const nextBasis = angleDimensionLabelBasis(target, repeatedlyDraggedDimension);
        repeatedDragOffsetError = Math.max(
          repeatedDragOffsetError,
          hypot2(nextOffsets.radial - dragOffsets.radial, nextOffsets.tangent - dragOffsets.tangent),
        );
        repeatedDragRadialPointerError = Math.max(
          repeatedDragRadialPointerError,
          Math.abs(
            (nextLayout.text.x - pointer.x) * nextBasis.radial.x +
            (nextLayout.text.y - pointer.y) * nextBasis.radial.y,
          ),
        );
      }
      const serialized = serializeDimension(repeatedlyDraggedDimension, target);
      return {
        migratedLegacyCoordinates: !Object.hasOwn(initial, "labelX") && !Object.hasOwn(initial, "labelY"),
        recoveredCorruptedOffsets,
        storedOffsets,
        labelTranslationError,
        arcTranslationError,
        radiusFollowError: hypot2(labelRadiusDelta.x - arcRadiusDelta.x, labelRadiusDelta.y - arcRadiusDelta.y),
        repeatedDragOffsetError,
        repeatedDragRadialPointerError,
        serializedRelativeOffsets: Number.isFinite(serialized.angleLabelOffsetR) && Number.isFinite(serialized.angleLabelOffsetT),
        serializedPlacementVersion: serialized.angleLabelPlacementVersion,
        serializedLegacyCoordinates: Object.hasOwn(serialized, "labelX") || Object.hasOwn(serialized, "labelY"),
      };
    }
    return Object.freeze({ followCase });
  }

  function createSketchVisibilityFixture({ resetModelState, activeSketchId, addPoint, addLine, addDistanceConstraintFromTarget, dimensionFromAnchor, currentScope, rootSketchId, ctx, drawDimensions, sketchById, isDimensionConstraint, constraintSketchId, isVisibleSketchId }) {
    function reset() {
      resetModelState();
      const firstSketchId = activeSketchId();
      const p1 = addPoint(0, 0, false, "endpoint");
      const p2 = addPoint(100, 0, false, "endpoint");
      const firstLine = addLine(p1, p2);
      addDistanceConstraintFromTarget(
        { kind: "line-length", line: firstLine, p1, p2, value: firstLine.length() },
        firstLine.length(),
        dimensionFromAnchor({ kind: "line-length", line: firstLine, p1, p2, value: firstLine.length() }, { x: 50, y: -30 }),
        { sketchId: firstSketchId },
      );

      const secondSketchId = "S2";
      currentScope().sketches.push({ id: secondSketchId, name: "Sketch-2", parentSketchId: rootSketchId, kind: "sketch" });
      currentScope().activeSketchId = secondSketchId;
      const p3 = addPoint(0, 80, false, "endpoint");
      const p4 = addPoint(160, 80, false, "endpoint");
      const secondLine = addLine(p3, p4);
      addDistanceConstraintFromTarget(
        { kind: "line-length", line: secondLine, p1: p3, p2: p4, value: secondLine.length() },
        secondLine.length(),
        dimensionFromAnchor({ kind: "line-length", line: secondLine, p1: p3, p2: p4, value: secondLine.length() }, { x: 80, y: 50 }),
        { sketchId: secondSketchId },
      );
      currentScope().activeSketchId = firstSketchId;
      const captureDimensionLabels = () => {
        const labels = [];
        const originalFillText = ctx.fillText;
        ctx.fillText = (value) => labels.push(String(value));
        try {
          drawDimensions();
        } finally {
          ctx.fillText = originalFillText;
        }
        return labels;
      };
      const drawnDimensionLabels = captureDimensionLabels();
      sketchById(secondSketchId).appearance = { ...sketchById(secondSketchId).appearance, visible: false };
      const labelsAfterHidingSecondSketch = captureDimensionLabels();
      sketchById(secondSketchId).appearance = { ...sketchById(secondSketchId).appearance, visible: true };
      return {
        activeSketchId: firstSketchId,
        dimensionSketchIds: currentScope().constraints.filter(isDimensionConstraint).map((constraint) => constraintSketchId(constraint)),
        drawnDimensionSketchIds: currentScope().constraints
          .filter((constraint) => isDimensionConstraint(constraint) && isVisibleSketchId(constraintSketchId(constraint)))
          .map((constraint) => constraintSketchId(constraint)),
        drawnDimensionLabels,
        labelsAfterHidingSecondSketch,
      };
    }
    return Object.freeze({ reset });
  }

  function createPositionObservation({ currentScope, isDimensionConstraint, targetFromConstraint, dimensionLayout, clientPosition }) {
    function position(index = 0) {
      const constraint = currentScope().constraints.filter(isDimensionConstraint)[index] || null;
      const target = targetFromConstraint(constraint);
      const layout = constraint && target ? dimensionLayout(target, constraint.dimension) : null;
      return layout?.text ? clientPosition(layout.text) : null;
    }
    return Object.freeze({ position });
  }

  function createExpressionAction({ currentScope, isDimensionConstraint, startDimensionEditInput }) {
    function start(index = 0) {
      const constraint = currentScope().constraints.filter(isDimensionConstraint)[index] || null;
      return constraint ? startDimensionEditInput({ constraint, dimension: constraint.dimension }) : false;
    }
    return Object.freeze({ start });
  }

  function createSelectionDriver({ currentScope, isDimensionConstraint, clearSelection, canvasSelection, updateUI, draw }) {
    function select(index = 0) {
      const constraint = currentScope().constraints.filter(isDimensionConstraint)[index] || null;
      if (!constraint) return false;
      clearSelection();
      canvasSelection.set("dimensionConstraint", constraint);
      updateUI({ refreshAnalysis: false });
      draw();
      return true;
    }
    function state() {
      return { dimensions: canvasSelection.dimensionConstraints.map(c => currentScope().constraints.indexOf(c)), lines: canvasSelection.lines.map(l => l.id), single: Boolean(canvasSelection.dimensionConstraint) };
    }
    return Object.freeze({ select, state });
  }

  function createCommandLineDragFixture({ resetModelState, addPoint, addLine, addDistanceConstraintFromTarget, dimensionFromAnchor, activeSketchId, constraintTargetSession, canvasSelection, fitAllGeometryToViewport, startDistanceCommand, currentScope, isDimensionConstraint, constraintGraphNodes, targetFromConstraint, dimensionLayout, worldToCanvasScreen, canvas, viewport, dimensionAnchor }) {
    function reset() {
      resetModelState();
      const p1 = addPoint(-70, -35, false, "endpoint");
      const p2 = addPoint(70, -35, false, "endpoint");
      const dimensionedLine = addLine(p1, p2);
      const dimensionedTarget = { kind: "line-length", line: dimensionedLine, p1, p2, value: dimensionedLine.length() };
      addDistanceConstraintFromTarget(
        dimensionedTarget,
        dimensionedLine.length(),
        dimensionFromAnchor(dimensionedTarget, { x: 0, y: -75 }),
        { sketchId: activeSketchId() },
      );
      const p3 = addPoint(-55, 55, false, "endpoint");
      const p4 = addPoint(55, 55, false, "endpoint");
      const commandLine = addLine(p3, p4);
      constraintTargetSession.clearOperands();
      canvasSelection.set("points", []);
      canvasSelection.set("lines", [commandLine]);
      canvasSelection.set("circles", []);
      canvasSelection.set("arcs", []);
      fitAllGeometryToViewport(190);
      startDistanceCommand();
      const constraint = currentScope().constraints.find((item) => isDimensionConstraint(item) && constraintGraphNodes(item).includes(p1) && constraintGraphNodes(item).includes(p2));
      const target = targetFromConstraint(constraint);
      const layout = dimensionLayout(target, constraint.dimension);
      const world = {
        x: layout.a.x * 0.75 + layout.b.x * 0.25,
        y: layout.a.y * 0.75 + layout.b.y * 0.25,
      };
      const screen = worldToCanvasScreen(world);
      const rect = canvas.getBoundingClientRect();
      return {
        point: { x: rect.left + screen.x, y: rect.top + screen.y },
        scale: viewport.scale,
        anchor: dimensionAnchor(target, constraint.dimension),
      };
    }
    return Object.freeze({ reset });
  }

  function createClickPlacementFixture({ resetModelState, addLine, addPoint, fitAllGeometryToViewport, updateUI, draw, canvas, worldToCanvasScreen }) {
    function reset() {
      resetModelState();
      const line = addLine(addPoint(-80, 0, false, "endpoint"), addPoint(80, 0, false, "endpoint"));
      fitAllGeometryToViewport(190);
      updateUI();
      draw();
      const rect = canvas.getBoundingClientRect();
      const clientPoint = (point) => {
        const screen = worldToCanvasScreen(point);
        return { x: rect.left + screen.x, y: rect.top + screen.y };
      };
      return {
        line: clientPoint({ x: 0, y: 0 }),
        placement: clientPoint({ x: 0, y: -50 }),
        lineId: line.id,
      };
    }
    return Object.freeze({ reset });
  }

  function createLineCircleFixture({ resetModelState, addLine, addPoint, addCircle, addArc, fitAllGeometryToViewport, updateUI, draw, canvas, worldToCanvasScreen }) {
    function reset() {
      resetModelState();
      const line = addLine(addPoint(-130, 150, true, "endpoint"), addPoint(130, 150, true, "endpoint"));
      const circle1 = addCircle(addPoint(0, 0, false, "center"), 30);
      const circle2 = addCircle(addPoint(0, 0, false, "center"), 55);
      const arc1 = addArc(addPoint(0, 0, false, "center"), 80, -Math.PI / 3, Math.PI / 3);
      const arc2 = addArc(addPoint(0, 0, false, "center"), 105, -Math.PI / 3, Math.PI / 3);
      fitAllGeometryToViewport(230);
      updateUI();
      draw();
      const rect = canvas.getBoundingClientRect();
      const clientPoint = (point) => {
        const screen = worldToCanvasScreen(point);
        return { x: rect.left + screen.x, y: rect.top + screen.y };
      };
      return {
        line: clientPoint({ x: 0, y: 150 }),
        circle1: clientPoint({ x: -30, y: 0 }),
        circle2: clientPoint({ x: -55, y: 0 }),
        arc1: clientPoint({ x: 80, y: 0 }),
        arc2: clientPoint({ x: 105, y: 0 }),
        lineCirclePlacement: clientPoint({ x: 60, y: 75 }),
        radiusDifferencePlacement: clientPoint({ x: 70, y: -75 }),
        ids: {
          line: line.id,
          circle1: circle1.id,
          circle2: circle2.id,
          arc1: arc1.id,
          arc2: arc2.id,
        },
      };
    }
    return Object.freeze({ reset });
  }

  function createLineCircleObservation({ serializeModel, currentScope, LineCircleDistanceConstraint, ConcentricRadiusDifferenceConstraint, pendingCommandSession, constraintTargetSession, signedPointLineDistance, vectorNorm, hypot2 }) {
    function state() {
      const serialized = serializeModel();
      const constraints = currentScope().constraints.filter((constraint) =>
        constraint instanceof LineCircleDistanceConstraint || constraint instanceof ConcentricRadiusDifferenceConstraint);
      return {
        pendingCommandType: pendingCommandSession.current?.type || null,
        previewTargetKind: pendingCommandSession.current?.target?.kind || null,
        operandKinds: constraintTargetSession.operands.map((operand) => operand.kind),
        constraints: serialized.constraints.filter((constraint) =>
          constraint.type === "lineCircleDistance" || constraint.type === "concentricRadiusDifferenceDimension"),
        geometry: constraints.map((constraint) => {
          if (constraint instanceof LineCircleDistanceConstraint) {
            return {
              type: "lineCircleDistance",
              centerDistance: Math.abs(signedPointLineDistance(constraint.circle.center, constraint.line)),
              target: constraint.target,
              error: vectorNorm([constraint.rawError()].flat()),
            };
          }
          return {
            type: "concentricRadiusDifferenceDimension",
            centerDistance: hypot2(constraint.a.center.x - constraint.b.center.x, constraint.a.center.y - constraint.b.center.y),
            radiusDifference: Math.abs(constraint.b.radius() - constraint.a.radius()),
            target: constraint.target,
            error: vectorNorm(constraint.rawError()),
          };
        }),
        serialized,
      };
    }
    return Object.freeze({ state });
  }

  function createRadiusDifferenceRecovery({ currentScope, ConcentricRadiusDifferenceConstraint, hypot2, solveSketchAndDependents, activeSketchId, snapshotModelState, refreshConstraintAnalysis, updateUI, draw, vectorNorm }) {
    function perturb() {
      const constraint = currentScope().constraints.find((item) => item instanceof ConcentricRadiusDifferenceConstraint);
      if (!constraint) return null;
      constraint.b.center.x += 17;
      constraint.b.center.y -= 11;
      constraint.b.radiusValue += 9;
      const before = {
        centerDistance: hypot2(constraint.a.center.x - constraint.b.center.x, constraint.a.center.y - constraint.b.center.y),
        radiusDifference: Math.abs(constraint.b.radius() - constraint.a.radius()),
      };
      const result = solveSketchAndDependents(activeSketchId(), snapshotModelState());
      refreshConstraintAnalysis();
      updateUI();
      draw();
      return {
        success: result.success,
        before,
        after: {
          centerDistance: hypot2(constraint.a.center.x - constraint.b.center.x, constraint.a.center.y - constraint.b.center.y),
          radiusDifference: Math.abs(constraint.b.radius() - constraint.a.radius()),
          error: vectorNorm(constraint.rawError()),
        },
      };
    }
    return Object.freeze({ perturb });
  }

  function createClickPlacementObservation({ currentScope, isDimensionConstraint, dimensionValueInput, pendingCommandSession }) {
    function state() {
      const constraints = currentScope().constraints.filter(isDimensionConstraint);
      const constraint = constraints.at(-1) || null;
      return {
        dimensionCount: constraints.length,
        target: constraint?.target ?? null,
        inputHidden: Boolean(dimensionValueInput?.hidden),
        pendingCommandType: pendingCommandSession.current?.type || null,
        previewTargetKind: pendingCommandSession.current?.target?.kind || null,
        previewPointer: pendingCommandSession.current?.pointer ? { ...pendingCommandSession.current.pointer } : null,
      };
    }
    return Object.freeze({ state });
  }

  function createCommandLineDragObservation({ currentScope, isDimensionConstraint, targetFromConstraint, dimensionAnchor, constraintTargetSession, pendingCommandSession, canvasSelection, dimensionDrag }) {
    function state() {
      const constraint = currentScope().constraints.find(isDimensionConstraint);
      const target = targetFromConstraint(constraint);
      return {
        anchor: constraint && target ? dimensionAnchor(target, constraint.dimension) : null,
        pendingConstraintType: constraintTargetSession.command?.type || null,
        pendingCommandType: pendingCommandSession.current?.type || null,
        selectedLineIds: canvasSelection.lines.map((line) => line.id),
        dragging: dimensionDrag.active,
      };
    }
    return Object.freeze({ state });
  }

  // Assemble dimension display measurements independently of interactive editing fixtures.
  function createDisplaySupport({
    Point, Arc, placement, layouts, metrics, circlePointAtAngle, viewport, hypot2, screenPxPerMm,
    outsideShaftLengthFactor, fitMarginFactor, canvasSelection, canvasHover, ctx, drawDimensions,
    currentScope, readDocument, isDimensionConstraint, constraintSketchId, activeSketchId, normalizeDimensionAppearance,
    effectiveDimensionAppearanceForSketch, dimensionDisplayState, targetFromConstraint, effectiveDimensionAppearance, displayFactor,
    formatDimensionLabel, formatMeasuredDimensionLabel, jisDimensionTextAngle, dimensionTextOffset
  }) {
    const dimensionDisplayCases = createDisplayCases({ formatDimensionLabel, formatMeasuredDimensionLabel });
    const dimensionTextAngleCases = createTextAngleCases({ jisDimensionTextAngle, dimensionTextOffset });
    const readTestDefaultDimensionAppearance = () => normalizeDimensionAppearance({ ...readDocument().defaultDimensionAppearance, ...readDocument().defaultTerminatorAppearance }, { partial: false });
    const radiusFixture = createRadiusFixture({
      Point, Arc, placement, layouts, circlePointAtAngle, readDefaultAppearance: readTestDefaultDimensionAppearance,
      viewport, hypot2, screenPxPerMm, outsideShaftLengthFactor,
    });
    const terminatorFixture = createTerminatorFixture({
      readDefaultAppearance: readTestDefaultDimensionAppearance, layouts, metrics, viewport,
      screenPxPerMm, fitMarginFactor, outsideShaftLengthFactor, hypot2,
    });
    const dimensionColorObservation = createColorObservation({ canvasSelection, canvasHover, ctx, drawDimensions });
    const dimensionAppearanceObservation = createAppearanceObservation({
      currentScope, readDocument, isDimensionConstraint, constraintSketchId, activeSketchId,
      normalizeDimensionAppearance, effectiveDimensionAppearanceForSketch, dimensionDisplayState,
    });
    const dimensionRenderObservation = createRenderObservation({
      currentScope, isDimensionConstraint, targetFromConstraint, constraintSketchId, activeSketchId, effectiveDimensionAppearance,
      placement, layouts, metrics, viewport, screenPxPerMm,
      displayFactor, hypot2,
    });
    return Object.freeze({
      appearance: Object.freeze({
        dimensionAppearanceStateForTest: dimensionAppearanceObservation.state,
        arcRadiusDimensionRenderPlanForTest: radiusFixture.radiusPlan,
        dimensionAppearanceRenderMetricsForTest: dimensionRenderObservation.appearanceMetrics,
        dimensionTerminatorFitForTest: terminatorFixture.fit,
        dimensionArrowTipAlignmentForTest: terminatorFixture.arrowAlignment,
        drawnDimensionColorsForTest: dimensionColorObservation.colors,
      }),
      cases: Object.freeze({
        dimensionDisplayPrecisionCases: dimensionDisplayCases.precision,
        dimensionTextAngleCases: dimensionTextAngleCases.angles,
      }),
    });
  }

  // Compose dimension editing/placement test operations around existing model and session owners.
  function createInteractionSupport({
    currentScope, isDimensionConstraint, targetFromConstraint, dimensionLayout, clientPosition, startDimensionEditInput,
    clearSelection, canvasSelection, updateUI, draw, resetModelState, addPoint, addLine, addCircle, addArc,
    addDistanceConstraintFromTarget, dimensionFromAnchor, activeSketchId, constraintTargetSession, fitAllGeometryToViewport,
    startDistanceCommand, constraintGraphNodes, worldToCanvasScreen, canvas, viewport, dimensionAnchor, serializeModel,
    LineCircleDistanceConstraint, ConcentricRadiusDifferenceConstraint, pendingCommandSession, signedPointLineDistance,
    vectorNorm, hypot2, solveSketchAndDependents, snapshotModelState, refreshConstraintAnalysis, dimensionValueInput, dimensionDrag
  }) {
    const dimensionPositionObservation = createPositionObservation({ currentScope, isDimensionConstraint, targetFromConstraint, dimensionLayout, clientPosition });
    const dimensionExpressionAction = createExpressionAction({ currentScope, isDimensionConstraint, startDimensionEditInput });
    const dimensionSelectionDriver = createSelectionDriver({ currentScope, isDimensionConstraint, clearSelection, canvasSelection, updateUI, draw });
    const commandLineDragFixture = createCommandLineDragFixture({ resetModelState, addPoint, addLine, addDistanceConstraintFromTarget, dimensionFromAnchor, activeSketchId, constraintTargetSession, canvasSelection, fitAllGeometryToViewport, startDistanceCommand, currentScope, isDimensionConstraint, constraintGraphNodes, targetFromConstraint, dimensionLayout, worldToCanvasScreen, canvas, viewport, dimensionAnchor });
    const clickPlacementFixture = createClickPlacementFixture({ resetModelState, addLine, addPoint, fitAllGeometryToViewport, updateUI, draw, canvas, worldToCanvasScreen });
    const lineCircleFixture = createLineCircleFixture({ resetModelState, addLine, addPoint, addCircle, addArc, fitAllGeometryToViewport, updateUI, draw, canvas, worldToCanvasScreen });
    const lineCircleObservation = createLineCircleObservation({ serializeModel, currentScope, LineCircleDistanceConstraint, ConcentricRadiusDifferenceConstraint, pendingCommandSession, constraintTargetSession, signedPointLineDistance, vectorNorm, hypot2 });
    const radiusDifferenceRecovery = createRadiusDifferenceRecovery({ currentScope, ConcentricRadiusDifferenceConstraint, hypot2, solveSketchAndDependents, activeSketchId, snapshotModelState, refreshConstraintAnalysis, updateUI, draw, vectorNorm });
    const clickPlacementObservation = createClickPlacementObservation({ currentScope, isDimensionConstraint, dimensionValueInput, pendingCommandSession });
    const commandLineDragObservation = createCommandLineDragObservation({ currentScope, isDimensionConstraint, targetFromConstraint, dimensionAnchor, constraintTargetSession, pendingCommandSession, canvasSelection, dimensionDrag });
    return Object.freeze({
      placement: Object.freeze({
        resetForDimensionCommandLineDrag: commandLineDragFixture.reset,
        resetForLineLengthClickPlacement: clickPlacementFixture.reset,
        resetForLineCircleAndRadiusDifferenceDimensions: lineCircleFixture.reset,
        lineCircleAndRadiusDifferenceState: lineCircleObservation.state,
        perturbRadiusDifferenceDimensionForTest: radiusDifferenceRecovery.perturb,
        lineLengthClickPlacementState: clickPlacementObservation.state,
        dimensionCommandLineDragState: commandLineDragObservation.state,
      }),
      selection: Object.freeze({
        dimensionClientPositionForTest: dimensionPositionObservation.position,
        startDimensionExpressionEditForTest: dimensionExpressionAction.start,
        selectDimensionForPropertiesForTest: dimensionSelectionDriver.select,
        multipleDimensionSelectionForTest: dimensionSelectionDriver.state,
        fitForMultipleDimensionsForTest() {
          viewport.update({ scale: 2, x: 350, y: 250 });
          updateUI();
          draw();
        },
      }),
    });
  }

  // Assemble default Dimension scenarios, preserving each fixture's existing setup and observation.
  function createFixtureSupport({
    resetModelState, addPoint, addLine, dimensionFromAnchor, addDistanceConstraintFromTarget, activeSketchId, currentScope,
    isDimensionConstraint, dimensionLayout, hypot2, isReadOnlyDimension, dimensionLabelForConstraint, targetFromConstraint, defaultDimensionForTarget, serializeModel,
    constraintTargetSession, pendingCommandSession, startDistanceValueInput, dimensionValueInput, dimensionWithLabelAt,
    angleDimensionLabelBasis, angleDimensionLayout, angleDimensionLabelOffsets, setAngleDimensionLabelOffsets, angleDimensionFromLabelPoint, serializeDimension,
    rootSketchId, ctx, drawDimensions, sketchById, constraintSketchId, isVisibleSketchId
  }) {
    const readOnlyDuplicateFixture = createReadOnlyDuplicateFixture({
      resetModelState, addPoint, addLine, dimensionFromAnchor, addDistanceConstraintFromTarget, activeSketchId, currentScope,
      isDimensionConstraint, dimensionLayout, hypot2, isReadOnlyDimension, dimensionLabelForConstraint, targetFromConstraint, defaultDimensionForTarget, serializeModel,
    });
    const readOnlyPlacementFixture = createReadOnlyPlacementFixture({
      resetModelState, addPoint, addLine, addDistanceConstraintFromTarget, dimensionFromAnchor, activeSketchId, constraintTargetSession, pendingCommandSession,
      startDistanceValueInput, dimensionValueInput, currentScope, isReadOnlyDimension, isDimensionConstraint,
    });
    const extensionVisibilityFixture = createExtensionVisibilityFixture({ resetModelState, addPoint, addLine, hypot2, dimensionLayout, dimensionWithLabelAt, dimensionFromAnchor });
    const angleLabelFixture = createAngleLabelFixture({
      resetModelState, addPoint, addLine, dimensionFromAnchor, angleDimensionLabelBasis, angleDimensionLayout, angleDimensionLabelOffsets,
      setAngleDimensionLabelOffsets, angleDimensionFromLabelPoint, hypot2, serializeDimension,
    });
    const sketchVisibilityFixture = createSketchVisibilityFixture({
      resetModelState, activeSketchId, addPoint, addLine, addDistanceConstraintFromTarget, dimensionFromAnchor, currentScope, rootSketchId,
      ctx, drawDimensions, sketchById, isDimensionConstraint, constraintSketchId, isVisibleSketchId,
    });
    return Object.freeze({
      readOnly: Object.freeze({
        resetForReadOnlyDuplicateDimension: readOnlyDuplicateFixture.reset,
        resetForReadOnlyDimensionPlacement: readOnlyPlacementFixture.reset,
        pointPointRectangleDimensionExtensionVisibilityCases: extensionVisibilityFixture.cases,
      }),
      angleDimensionLabelFollowCase: angleLabelFixture.followCase,
      resetForActiveSketchDimensionVisibility: sketchVisibilityFixture.reset,
    });
  }

  window.DimensionTestDriver = Object.freeze({ createFixtureSupport, createInteractionSupport, createDisplaySupport, createAppearanceObservation, createRenderObservation, createRadiusFixture, createTerminatorFixture, createColorObservation, createReadOnlyDuplicateFixture, createReadOnlyPlacementFixture, createExtensionVisibilityFixture, createDisplayCases, createTextAngleCases, createAngleLabelFixture, createSketchVisibilityFixture, createPositionObservation, createExpressionAction, createSelectionDriver, createCommandLineDragFixture, createClickPlacementFixture, createLineCircleFixture, createLineCircleObservation, createRadiusDifferenceRecovery, createClickPlacementObservation, createCommandLineDragObservation });
})();
