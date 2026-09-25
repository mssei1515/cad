/* Prepare drag start geometry and target requests without solving or changing the model. */
(() => {
  "use strict";
  function create({ elementSketchId, isEditableSketchId, activeSketchId, blockDefinitionById, blockLocalGeometryBounds,
    blockInstanceEnabledSketchSet, blockWorldPoint, pointLockedByLineFixed, findLineFixedConstraint,
    findArcEndpointFixedConstraint, arcEndpointPoint, arcEndpointDragValue, hypot2, minimumLength }) {
    const { DragConstraint, ParameterDragConstraint } = window.GeometrySolver;
    function dragSketchIdFromSelection(points = []) {
      const ids = [...new Set(points.filter(Boolean).map(elementSketchId).filter(isEditableSketchId))];
      if (ids.length === 1) return ids[0];
      if (ids.includes(activeSketchId())) return activeSketchId();
      return ids[0] || activeSketchId();
    }

    function dragSketchIdFor(kind, item) {
      if (kind === "arc-endpoint") return elementSketchId(item?.arc);
      if (kind === "selection") return dragSketchIdFromSelection(item);
      return elementSketchId(item);
    }

    function buildDragSession(kind, item, pointer) {
      const sketchId = dragSketchIdFor(kind, item);
      if (kind === "block" || kind === "block-rotation") {
        if (item.fixed || (kind === "block-rotation" && item.rotationLocked)) return null;
        const definition = blockDefinitionById(item.definitionId);
        const localCenter = blockLocalGeometryBounds(definition, [...blockInstanceEnabledSketchSet(item, definition)])?.center || definition?.origin || { x: 0, y: 0 };
        return {
          kind,
          sketchId: item.sketchId,
          mode: kind,
          item,
          startPointer: pointer,
          startX: item.x,
          startY: item.y,
          startRotation: item.rotation,
          localCenter,
          rotationPivot: blockWorldPoint(item, localCenter),
        };
      }
      if (kind === "selection") {
        const points = item
          .filter((p, index, arr) => p && elementSketchId(p) === sketchId && !p.fixed && !pointLockedByLineFixed(p) && arr.indexOf(p) === index)
          .map((p) => ({ point: p, startX: p.x, startY: p.y }));
        if (points.length === 0) return null;
        return { kind, sketchId, startPointer: pointer, points };
      }

      if (kind === "point") {
        if (item.fixed || pointLockedByLineFixed(item)) return null;
        return {
          kind,
          sketchId,
          startPointer: pointer,
          points: [{ point: item, startX: item.x, startY: item.y }],
        };
      }

      if (kind === "spline") {
        const points = item.fitPoints
          .filter((point, index, array) => !point.fixed && !pointLockedByLineFixed(point) && array.indexOf(point) === index)
          .map((point) => ({ point, startX: point.x, startY: point.y }));
        return points.length ? { kind, sketchId, item, startPointer: pointer, points } : null;
      }

      if (kind === "line" && findLineFixedConstraint(item)) return null;

      if (kind === "circle" || kind === "arc") {
        return {
          kind,
          sketchId,
          mode: "radius",
          item,
          startPointer: pointer,
          startRadius: item.radius(),
          startCenterX: item.center.x,
          startCenterY: item.center.y,
        };
      }

      if (kind === "arc-endpoint") {
        if (findArcEndpointFixedConstraint(item.arc, item.endpoint)) return null;
        return {
          kind,
          sketchId,
          mode: "arc-endpoint",
          item: item.arc,
          endpoint: item.endpoint,
          startPointer: pointer,
          startEndpoint: arcEndpointPoint(item.arc, item.endpoint),
        };
      }

      const sourcePoints = [item.p1, item.p2];
      const points = sourcePoints
        .filter((p, index, arr) => !p.fixed && !pointLockedByLineFixed(p) && arr.indexOf(p) === index)
        .map((p) => ({ point: p, startX: p.x, startY: p.y }));
      if (points.length === 0) return null;
      return { kind, sketchId, item, startPointer: pointer, points };
    }

    function dragTargets(session, pointer) {
      const dx = pointer.x - session.startPointer.x;
      const dy = pointer.y - session.startPointer.y;
      const points = session.lineDragPoint ? [session.lineDragPoint] : session.points;
      return points.map((p) => ({ point: p.point, x: p.startX + dx, y: p.startY + dy }));
    }

    function radiusDragTargets(session, pointer) {
      return [
        {
          object: session.item,
          prop: "radiusValue",
          // Keep the radius request tied to the geometry at pointer-down. The
          // constrained solve may move the center; measuring from that moving
          // center feeds the solver's own correction back into the next event
          // and can amplify a one-pixel cursor step into a large radius jump.
          value: hypot2(pointer.x - session.startCenterX, pointer.y - session.startCenterY),
          min: minimumLength,
          radialPointer: pointer,
        },
      ];
    }

    function primitiveMoveTargets(session, pointer) {
      if (session.item.center.fixed) return [];
      const dx = pointer.x - session.startPointer.x;
      const dy = pointer.y - session.startPointer.y;
      return [{ point: session.item.center, x: session.startCenterX + dx, y: session.startCenterY + dy }];
    }

    function arcEndpointDragTargets(session, pointer) {
      const prop = session.endpoint === "start" ? "startAngle" : "endAngle";
      const rawAngle = Math.atan2(pointer.y - session.item.center.y, pointer.x - session.item.center.x);
      const value = arcEndpointDragValue(session.item, session.endpoint, rawAngle);
      return [
        {
          object: session.item,
          prop,
          value,
          endpointPointer: { x: (session.startEndpoint || session.startPointer).x + pointer.x - session.startPointer.x,
            y: (session.startEndpoint || session.startPointer).y + pointer.y - session.startPointer.y },
        },
      ];
    }

    function dragConstraintsFromTargets(targets) {
      return targets.map((target) => new DragConstraint(target.point, target.x, target.y));
    }

    function parameterDragConstraintsFromTargets(targets) {
      return targets.map((target) => new ParameterDragConstraint(target.object, target.prop, target.value, target.min));
    }
    return Object.freeze({ build: buildDragSession, points: dragTargets, radius: radiusDragTargets,
      primitiveMove: primitiveMoveTargets, arcEndpoint: arcEndpointDragTargets,
      pointConstraints: dragConstraintsFromTargets, parameterConstraints: parameterDragConstraintsFromTargets });
  }
  window.GeometryDragPlan = Object.freeze({ create });
})();
