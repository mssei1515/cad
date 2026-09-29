/* Query legacy SketchProjection constraints and own their target index. */
(() => {
  "use strict";
  const { Point, Line, Circle, Arc, Spline, SketchProjectionConstraint } = window.GeometrySolver;
  function create({ currentScope, constraintIsOperational }) {
    function sketchProjectionConstraints() {
      return currentScope().constraints.filter((constraint) => constraint instanceof SketchProjectionConstraint);
    }

    let sketchProjectionTargetCacheConstraints = null;
    let sketchProjectionTargetCacheLength = -1;
    let sketchProjectionTargetCache = new Map();

    function sketchProjectionTargetConstraintMap() {
      if (sketchProjectionTargetCacheConstraints === currentScope().constraints && sketchProjectionTargetCacheLength === currentScope().constraints.length) {
        return sketchProjectionTargetCache;
      }
      const next = new Map();
      for (const constraint of currentScope().constraints) {
        if (!(constraint instanceof SketchProjectionConstraint) || !constraint.target) continue;
        const entries = next.get(constraint.target) || [];
        entries.push(constraint);
        next.set(constraint.target, entries);
      }
      sketchProjectionTargetCacheConstraints = currentScope().constraints;
      sketchProjectionTargetCacheLength = currentScope().constraints.length;
      sketchProjectionTargetCache = next;
      return next;
    }

    function sketchProjectionConstraintForTarget(item, { operationalOnly = true } = {}) {
      return (sketchProjectionTargetConstraintMap().get(item) || []).find((constraint) =>
        !operationalOnly || constraintIsOperational(constraint)) || null;
    }

    function sketchProjectionConstraintsForTarget(item, { operationalOnly = true } = {}) {
      return (sketchProjectionTargetConstraintMap().get(item) || []).filter((constraint) =>
        !operationalOnly || constraintIsOperational(constraint));
    }

    function isSketchProjectedGeometry(item) {
      return Boolean(sketchProjectionConstraintForTarget(item));
    }

    function sketchProjectionPointPairs(constraint) {
      if (!(constraint instanceof SketchProjectionConstraint) || !constraint.source || !constraint.target) return [];
      if (constraint.kind === "point") return [[constraint.source, constraint.target]];
      if (constraint.kind === "line") return [[constraint.source.p1, constraint.target.p1], [constraint.source.p2, constraint.target.p2]];
      if (constraint.kind === "circle" || constraint.kind === "arc") return [[constraint.source.center, constraint.target.center]];
      if (constraint.kind === "spline") {
        return constraint.source.fitPoints.slice(0, constraint.target.fitPoints.length).map((point, index) => [point, constraint.target.fitPoints[index]]);
      }
      return [];
    }


    function sketchProjectionTargetNodes(target) {
      const nodes = new Set([target]);
      if (target instanceof Line) {
        nodes.add(target.p1).add(target.p2);
      } else if (target instanceof Circle || target instanceof Arc) {
        nodes.add(target.center);
      } else if (target instanceof Spline) {
        for (const point of target.fitPoints) nodes.add(point);
      }
      return nodes;
    }

    function sketchProjectionConstraintsAffectingItems(items, { includeSharedNodes = true, operationalOnly = true } = {}) {
      const directTargets = new Set(items || []);
      const touched = new Set();
      for (const item of items || []) for (const node of sketchProjectionTargetNodes(item)) touched.add(node);
      return currentScope().constraints.filter((constraint) =>
        constraint instanceof SketchProjectionConstraint
        && (!operationalOnly || constraintIsOperational(constraint))
        && (includeSharedNodes
          ? [...sketchProjectionTargetNodes(constraint.target)].some((node) => touched.has(node))
          : directTargets.has(constraint.target)));
    }


    return Object.freeze({ sketchProjectionConstraints, sketchProjectionConstraintForTarget, sketchProjectionConstraintsForTarget, isSketchProjectedGeometry, sketchProjectionPointPairs, sketchProjectionConstraintsAffectingItems });
  }
  window.SketchProjectionQueries = Object.freeze({ create });
})();
