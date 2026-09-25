/* Create offset geometry and constraints, restoring allocation state on rejected commits. */
(() => {
  "use strict";
  function create({ currentScope, geometryIds, geometry, plans, placement, types, kernel,
    commitNewConstraint, normalizeAppearance, offsetPairSign, offsetChainErrorText,
    applicationText, setHint, updateUI, draw, invalidateAnalysis, minLineLength: MIN_LINE_LENGTH,
    minArcLength: MIN_ARC_LENGTH }) {
    const { Line, Circle, OffsetConstraint, OffsetChainConstraint } = types;
    const { lineNormal, MIN_ORIENTATION_LENGTH } = kernel;
    const { addPoint, addLine, addCircle, addArc } = geometry;
    const { offsetChainDraft, offsetDimensionTarget } = plans;
    const { dimensionWithLabelAt, dimensionFromAnchor } = placement;
    function createOffsetGeometry(source, distance, sign, pointer) {
      const model = currentScope();
      const state = {
        pointLength: model.points.length,
        lineLength: model.lines.length,
        circleLength: model.circles.length,
        arcLength: model.arcs.length,
        pointSeq: geometryIds.peek("point"),
        lineSeq: geometryIds.peek("line"),
        circleSeq: geometryIds.peek("circle"),
        arcSeq: geometryIds.peek("arc"),
      };
      let offset = null;
      if (source instanceof Line) {
        const normal = lineNormal(source);
        const dx = normal.x * sign * distance;
        const dy = normal.y * sign * distance;
        const p1 = addPoint(source.p1.x + dx, source.p1.y + dy, false, "endpoint");
        const p2 = addPoint(source.p2.x + dx, source.p2.y + dy, false, "endpoint");
        offset = addLine(p1, p2, source.construction);
      } else {
        const radius = source.radius() + sign * distance;
        if (radius < MIN_ORIENTATION_LENGTH) return false;
        const center = addPoint(source.center.x, source.center.y, false, "center");
        offset = source instanceof Circle
          ? addCircle(center, radius, source.construction)
          : addArc(center, radius, source.startAngle, source.endAngle, source.construction);
      }
      if (!offset) return false;
      const constraint = new OffsetConstraint(source, offset, distance, sign);
      const target = offsetDimensionTarget(source, offset, distance, sign);
      constraint.dimension = dimensionWithLabelAt(target, dimensionFromAnchor(target, pointer, { allowPointAxis: false }), pointer);
      const ok = commitNewConstraint("offset", constraint);
      if (ok) return true;

      model.points.length = state.pointLength;
      model.lines.length = state.lineLength;
      model.circles.length = state.circleLength;
      model.arcs.length = state.arcLength;
      geometryIds.restore({ pointSeq: state.pointSeq });
      geometryIds.restore({ lineSeq: state.lineSeq });
      geometryIds.restore({ circleSeq: state.circleSeq });
      geometryIds.restore({ arcSeq: state.arcSeq });
      invalidateAnalysis();
      updateUI();
      draw();
      return false;
    }

    function createOffsetChainGeometry(entries, distance, side, pointer, closed, dimensionSegmentIndex = 0) {
      const plan = offsetChainDraft(entries, distance, side, closed);
      if (!plan.ok) {
        setHint(offsetChainErrorText(plan), "error");
        return false;
      }
      if (plan.geometries.some((geometry) => geometry instanceof Line
        ? geometry.length() < MIN_LINE_LENGTH
        : Math.abs(geometry.endAngle - geometry.startAngle) * geometry.radius() < MIN_ARC_LENGTH)) {
        setHint(applicationText("指定距離ではチェーンの一部が短すぎます", "Part of the chain is too short at this distance"), "error");
        return false;
      }
      const model = currentScope();
      const state = {
        pointLength: model.points.length,
        lineLength: model.lines.length,
        circleLength: model.circles.length,
        arcLength: model.arcs.length,
        constraintLength: model.constraints.length,
        pointSeq: geometryIds.peek("point"),
        lineSeq: geometryIds.peek("line"),
        circleSeq: geometryIds.peek("circle"),
        arcSeq: geometryIds.peek("arc"),
        nextDimensionParameterIndex: model.nextDimensionParameterIndex,
      };
      const offsets = [];
      for (let index = 0; index < plan.geometries.length; index++) {
        const draft = plan.geometries[index];
        const source = entries[index].geometry;
        let offset;
        if (draft instanceof Line) {
          const p1 = addPoint(draft.p1.x, draft.p1.y, false, "endpoint");
          const p2 = addPoint(draft.p2.x, draft.p2.y, false, "endpoint");
          offset = addLine(p1, p2, source.construction);
        } else {
          const center = addPoint(draft.center.x, draft.center.y, false, "center");
          offset = addArc(center, draft.radius(), draft.startAngle, draft.endAngle, source.construction);
        }
        if (!offset) break;
        offset.appearance = normalizeAppearance(source.appearance);
        offsets.push(offset);
      }
      if (offsets.length !== entries.length) {
        model.points.length = state.pointLength;
        model.lines.length = state.lineLength;
        model.arcs.length = state.arcLength;
        geometryIds.restore({ pointSeq: state.pointSeq });
        geometryIds.restore({ lineSeq: state.lineSeq });
        geometryIds.restore({ arcSeq: state.arcSeq });
        return false;
      }
      const index = Math.max(0, Math.min(entries.length - 1, Number(dimensionSegmentIndex) || 0));
      const constraint = new OffsetChainConstraint(
        entries.map((entry) => entry.geometry),
        offsets,
        distance,
        side,
        entries.map((entry) => entry.reversed),
        closed,
        index,
      );
      const target = offsetDimensionTarget(entries[index].geometry, offsets[index], distance, offsetPairSign(entries[index].geometry, offsets[index]));
      constraint.dimension = dimensionWithLabelAt(target, dimensionFromAnchor(target, pointer, { allowPointAxis: false }), pointer);
      const ok = commitNewConstraint("offset-chain", constraint);
      if (ok) return true;

      model.points.length = state.pointLength;
      model.lines.length = state.lineLength;
      model.circles.length = state.circleLength;
      model.arcs.length = state.arcLength;
      model.constraints.length = state.constraintLength;
      geometryIds.restore({ pointSeq: state.pointSeq });
      geometryIds.restore({ lineSeq: state.lineSeq });
      geometryIds.restore({ circleSeq: state.circleSeq });
      geometryIds.restore({ arcSeq: state.arcSeq });
      model.nextDimensionParameterIndex = state.nextDimensionParameterIndex;
      invalidateAnalysis();
      updateUI();
      draw();
      return false;
    }

    return Object.freeze({ createOffsetGeometry, createOffsetChainGeometry });
  }
  window.OffsetConstruction = Object.freeze({ create });
})();
