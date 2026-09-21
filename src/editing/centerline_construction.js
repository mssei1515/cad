/* Centerline insertion and its operation-specific partial rollback. */
(function () {
  "use strict";
  const { ParallelLinesCenterlineConstraint, PointPairCenterlineConstraint } = window.GeometrySolver;
  function create({ currentScope, geometry, ids: geometryIds, addPointSnapConstraints, commitNewConstraint }) {
    const { addPoint, addLine } = geometry;
    function commit(centerlineTargets, centerlineSupport, centerlineFirstPoint, centerlineFirstSnap, secondPoint, secondSnap) {
      const pointLength = currentScope().points.length;
      const lineLength = currentScope().lines.length;
      const constraintLength = currentScope().constraints.length;
      const pointSeqBefore = geometryIds.peek("point");
      const lineSeqBefore = geometryIds.peek("line");
      const p1 = addPoint(centerlineFirstPoint.x, centerlineFirstPoint.y, false, "endpoint");
      const p2 = addPoint(secondPoint.x, secondPoint.y, false, "endpoint");
      const centerline = addLine(p1, p2, true);
      addPointSnapConstraints(p1, centerlineFirstSnap);
      addPointSnapConstraints(p2, secondSnap);
      const constraint = centerlineSupport.kind === "parallel-lines"
        ? new ParallelLinesCenterlineConstraint(centerlineTargets[0], centerlineTargets[1], centerline)
        : new PointPairCenterlineConstraint(centerlineTargets[0], centerlineTargets[1], centerline);
      const committed = centerline && commitNewConstraint("centerline", constraint);
      if (!committed) {
        currentScope().points.length = pointLength;
        currentScope().lines.length = lineLength;
        currentScope().constraints.length = constraintLength;
        geometryIds.restore({ pointSeq: pointSeqBefore });
        geometryIds.restore({ lineSeq: lineSeqBefore });
        return null;
      }
      return centerline;
    }
    return Object.freeze({ commit });
  }
  window.CenterlineConstruction = Object.freeze({ create });
})();
