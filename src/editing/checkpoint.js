/* In-memory editing checkpoints; preserve object identity, not a persistence format. */
(function () {
  "use strict";
  const { PointOnSplineConstraint } = window.GeometrySolver;
  function create({ currentScope, ids, invalidateProjection, invalidateAnalysis }) {
    function snapshotModelState() {
      return {
        points: currentScope().points.map((p) => ({ point: p, x: p.x, y: p.y, fixed: p.fixed })),
        circles: currentScope().circles.map((c) => ({ circle: c, radiusValue: c.radiusValue })),
        arcs: currentScope().arcs.map((a) => ({ arc: a, radiusValue: a.radiusValue, startAngle: a.startAngle, endAngle: a.endAngle })),
        blockInstances: currentScope().blockInstances.map((instance) => ({
          instance,
          x: instance.x,
          y: instance.y,
          rotation: instance.rotation,
          fixed: instance.fixed,
          rotationLocked: instance.rotationLocked,
        })),
        freeInstances: currentScope().geometryInstances.filter((instance) => instance.type === "free").map((instance) => ({ instance, x: instance.x, y: instance.y, rotation: instance.rotation, mirrorX: instance.mirrorX, mirrorY: instance.mirrorY })),
        constraintLength: currentScope().constraints.length,
        constraints: currentScope().constraints.map((constraint) => ({
          constraint,
          target: constraint.target,
          parameterName: constraint.parameterName,
          expression: constraint.expression,
          evaluatedParameterValue: constraint.evaluatedParameterValue,
          splineParameter: constraint instanceof PointOnSplineConstraint ? constraint.parameter : undefined,
        })),
        parameters: currentScope().parameters.map((parameter) => ({ name: parameter.name, expression: parameter.expression })),
        nextDimensionParameterIndex: currentScope().nextDimensionParameterIndex,
      };
    }

    function snapshotGeometryMutationState() {
      return {
        modelState: snapshotModelState(),
        points: currentScope().points.slice(),
        lines: currentScope().lines.slice(),
        circles: currentScope().circles.slice(),
        arcs: currentScope().arcs.slice(),
        splines: currentScope().splines.slice(),
        annotations: currentScope().annotations.slice(),
        lineState: currentScope().lines.map((line) => ({ line, p1: line.p1, p2: line.p2, construction: line.construction })),
        splineState: currentScope().splines.map((spline) => ({ spline, fitPoints: spline.fitPoints.slice(), closed: spline.closed, construction: spline.construction })),
        ...ids.snapshot(),
      };
    }

    function restoreGeometryMutationState(snapshot) {
      currentScope().points = snapshot.points;
      currentScope().lines = snapshot.lines;
      currentScope().circles = snapshot.circles;
      currentScope().arcs = snapshot.arcs;
      currentScope().splines = snapshot.splines;
      currentScope().annotations = snapshot.annotations;
      for (const entry of snapshot.lineState) {
        entry.line.p1 = entry.p1;
        entry.line.p2 = entry.p2;
        entry.line.construction = entry.construction;
      }
      for (const entry of snapshot.splineState) {
        entry.spline.fitPoints = entry.fitPoints;
        entry.spline.closed = entry.closed;
        entry.spline.construction = entry.construction;
        entry.spline._curveCache = null;
      }
      ids.restore(snapshot);
      restoreModelState(snapshot.modelState);
    }

    function restoreModelState(snapshot) {
      for (const { instance, ...values } of snapshot.freeInstances || []) Object.assign(instance, values);
      for (const p of snapshot.points) {
        p.point.x = p.x;
        p.point.y = p.y;
        p.point.fixed = p.fixed;
      }
      for (const c of snapshot.circles || []) c.circle.radiusValue = c.radiusValue;
      for (const a of snapshot.arcs || []) {
        a.arc.radiusValue = a.radiusValue;
        a.arc.startAngle = a.startAngle;
        a.arc.endAngle = a.endAngle;
      }
      for (const entry of snapshot.blockInstances || []) {
        entry.instance.x = entry.x;
        entry.instance.y = entry.y;
        entry.instance.rotation = entry.rotation;
        entry.instance.fixed = entry.fixed;
        entry.instance.rotationLocked = Boolean(entry.rotationLocked);
      }
      invalidateProjection();
      currentScope().constraints = (snapshot.constraints || []).map((entry) => entry.constraint);
      for (const entry of snapshot.constraints || []) {
        entry.constraint.target = entry.target;
        entry.constraint.parameterName = entry.parameterName;
        if (entry.expression == null) delete entry.constraint.expression;
        else entry.constraint.expression = entry.expression;
        entry.constraint.evaluatedParameterValue = entry.evaluatedParameterValue;
        if (entry.constraint instanceof PointOnSplineConstraint && Number.isFinite(entry.splineParameter)) entry.constraint.parameter = entry.splineParameter;
      }
      currentScope().parameters = (snapshot.parameters || []).map((parameter) => ({ ...parameter }));
      currentScope().nextDimensionParameterIndex = Math.max(1, Number(snapshot.nextDimensionParameterIndex) || 1);
      invalidateAnalysis();
    }
    return Object.freeze({ captureValues: snapshotModelState, restoreValues: restoreModelState, captureGeometry: snapshotGeometryMutationState, restoreGeometry: restoreGeometryMutationState });
  }
  window.EditingCheckpoint = Object.freeze({ create });
})();
