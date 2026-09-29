/* Repair legacy projection target ownership and synchronize projection metadata. */
(() => {
  "use strict";
  const { Point, Line, Circle, Arc, Spline, SketchProjectionConstraint } = window.GeometrySolver;
  function create({ currentScope, queries, resolveGeometryRef, geometryRefForItem, geometryKindForItem,
    constraintSketchId, constraintIsOperational, addPointToSketch, constraintReferencesPoint, nextSeq, normalizeAppearance }) {
    const { sketchProjectionConstraints } = queries;
    function separateSharedSketchProjectionTargetPoints(namespace) {
      const points = Array.isArray(namespace?.points) ? namespace.points : [];
      const constraints = Array.isArray(namespace?.constraints) ? namespace.constraints : [];
      const claimed = new Set();
      const processedTargets = new Set();
      const pointIds = new Set(points.map((point) => String(point.id)));
      let nextPointIndex = nextSeq(points, "P");
      const cloneEndpoint = (point) => {
        let id = `P${nextPointIndex++}`;
        while (pointIds.has(id)) id = `P${nextPointIndex++}`;
        pointIds.add(id);
        const clone = new Point(id, point.x, point.y, Boolean(point.fixed), point.kind || "endpoint");
        clone.sketchId = point.sketchId;
        const appearance = normalizeAppearance(point.appearance);
        if (Object.keys(appearance).length > 0) clone.appearance = appearance;
        points.push(clone);
        return clone;
      };
      let separated = 0;
      for (const constraint of constraints) {
        if (!(constraint instanceof SketchProjectionConstraint) || !constraint.target || processedTargets.has(constraint.target)) continue;
        processedTargets.add(constraint.target);
        const slots = constraint.kind === "point" && constraint.target instanceof Point
          ? [{ point: constraint.target, assign: (point) => { constraint.target = point; } }]
          : constraint.kind === "line" && constraint.target instanceof Line
            ? [
                { point: constraint.target.p1, assign: (point) => { constraint.target.p1 = point; } },
                { point: constraint.target.p2, assign: (point) => { constraint.target.p2 = point; } },
              ]
            : (constraint.kind === "circle" && constraint.target instanceof Circle) || (constraint.kind === "arc" && constraint.target instanceof Arc)
              ? [{ point: constraint.target.center, assign: (point) => { constraint.target.center = point; } }]
              : constraint.kind === "spline" && constraint.target instanceof Spline
                ? constraint.target.fitPoints.map((point, index) => ({ point, assign: (next) => { constraint.target.fitPoints[index] = next; } }))
                : [];
        for (const slot of slots) {
          let point = slot.point;
          if (claimed.has(point)) {
            point = cloneEndpoint(point);
            slot.assign(point);
            if (constraint.target instanceof Spline) constraint.target._curveCache = null;
            separated += 1;
          }
          claimed.add(point);
        }
      }
      return separated;
    }

    function pointHasNonProjectionUse(point, excludingConstraint = null) {
      if (!point) return false;
      if (currentScope().lines.some((line) => line.p1 === point || line.p2 === point)) return true;
      if (currentScope().circles.some((circle) => circle.center === point)) return true;
      if (currentScope().arcs.some((arc) => arc.center === point)) return true;
      if (currentScope().splines.some((spline) => spline.fitPoints.includes(point))) return true;
      if (currentScope().constraints.some((constraint) => constraint !== excludingConstraint && constraintReferencesPoint(constraint, point))) return true;
      return currentScope().annotations.some((annotation) => annotation?.type === "leader" && resolveGeometryRef(annotation.geometryRef) === point);
    }

    function synchronizeSketchProjectionConstraint(constraint) {
      if (!(constraint instanceof SketchProjectionConstraint) || !constraint.source || !constraint.target) return false;
      const reboundSource = resolveGeometryRef(geometryRefForItem(constraint.source));
      if (reboundSource) constraint.source = reboundSource;
      if (geometryKindForItem(constraint.source) !== constraint.kind || geometryKindForItem(constraint.target) !== constraint.kind) return false;
      let changed = false;
      if (["line", "circle", "arc", "spline"].includes(constraint.kind) && constraint.target.construction !== Boolean(constraint.source.construction)) {
        constraint.target.construction = Boolean(constraint.source.construction);
        changed = true;
      }
      if (constraint.kind !== "spline") return changed;

      const sourceIdsBefore = Array.isArray(constraint.sourcePointIds) ? constraint.sourcePointIds : [];
      const oldTargetPoints = constraint.target.fitPoints.slice();
      const oldBySourceId = new Map();
      sourceIdsBefore.forEach((id, index) => {
        if (!oldTargetPoints[index]) return;
        const key = String(id);
        const entries = oldBySourceId.get(key) || [];
        entries.push(oldTargetPoints[index]);
        oldBySourceId.set(key, entries);
      });
      const targetSketchId = constraintSketchId(constraint);
      const nextTargetPoints = constraint.source.fitPoints.map((sourcePoint) => {
        const existing = oldBySourceId.get(String(sourcePoint.id))?.shift();
        return existing || addPointToSketch(sourcePoint.x, sourcePoint.y, targetSketchId, "endpoint");
      });
      if (nextTargetPoints.length !== oldTargetPoints.length || nextTargetPoints.some((point, index) => point !== oldTargetPoints[index])) {
        constraint.target.fitPoints = nextTargetPoints;
        constraint.target._curveCache = null;
        changed = true;
      }
      if (constraint.target.closed !== Boolean(constraint.source.closed)) {
        constraint.target.closed = Boolean(constraint.source.closed);
        constraint.target._curveCache = null;
        changed = true;
      }
      constraint.sourcePointIds = constraint.source.fitPoints.map((point) => String(point.id));
      for (const point of oldTargetPoints) {
        if (nextTargetPoints.includes(point) || point.kind !== "endpoint" || pointHasNonProjectionUse(point, constraint)) continue;
        currentScope().points = currentScope().points.filter((item) => item !== point);
        changed = true;
      }
      return changed;
    }

    function synchronizeSketchProjectionMetadata(sketchId = null) {
      let changed = false;
      for (const constraint of sketchProjectionConstraints()) {
        if (!constraintIsOperational(constraint) || sketchId && constraintSketchId(constraint) !== sketchId) continue;
        changed = synchronizeSketchProjectionConstraint(constraint) || changed;
      }
      return changed;
    }


    return Object.freeze({ separateSharedSketchProjectionTargetPoints, synchronizeSketchProjectionMetadata });
  }
  window.SketchProjectionEditing = Object.freeze({ create });
})();
