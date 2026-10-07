/* Detect unintended line collapse after constraint solving without mutating geometry. */
(() => {
  "use strict";
  const { hypot2, HorizontalConstraint, VerticalConstraint, PointHorizontalConstraint, PointVerticalConstraint, SymmetryConstraint, LineSymmetryConstraint, ArcSymmetryConstraint, ParallelConstraint, PerpendicularConstraint, CollinearConstraint, PointOnLineConstraint, ParallelLinesCenterlineConstraint, PointPairCenterlineConstraint, ArcEndpointOnLineConstraint, LineCircleTangentConstraint } = window.GeometrySolver;
  function create({ connectedComponentFromSeeds, constraintGraphNodes, localSolveLines, minLineLength: MIN_LINE_LENGTH }) {
    function snapshotLineLength(snapshot, line) {
      if (!snapshot || !line) return line?.length?.() || 0;
      const pointState = new Map(snapshot.points.map((p) => [p.point, p]));
      const p1 = pointState.get(line.p1);
      const p2 = pointState.get(line.p2);
      if (!p1 || !p2) return line.length();
      return hypot2(p2.x - p1.x, p2.y - p1.y);
    }
  
    function constraintShouldRejectLineCollapse(constraint) {
      return (
        constraint instanceof HorizontalConstraint ||
        constraint instanceof VerticalConstraint ||
        constraint instanceof PointHorizontalConstraint ||
        constraint instanceof PointVerticalConstraint ||
        constraint instanceof SymmetryConstraint ||
        constraint instanceof LineSymmetryConstraint ||
        constraint instanceof ArcSymmetryConstraint ||
        constraint instanceof ParallelConstraint ||
        constraint instanceof PerpendicularConstraint ||
        constraint instanceof CollinearConstraint ||
        constraint instanceof PointOnLineConstraint ||
        constraint instanceof ParallelLinesCenterlineConstraint ||
        constraint instanceof PointPairCenterlineConstraint ||
        constraint instanceof ArcEndpointOnLineConstraint ||
        constraint instanceof LineCircleTangentConstraint
      );
    }
  
    function findLineCollapseAfterConstraint(constraint, snapshot, sketchId) {
      if (!constraintShouldRejectLineCollapse(constraint)) return null;
      const component = connectedComponentFromSeeds(constraintGraphNodes(constraint));
      const lines = localSolveLines(component, sketchId);
      for (const line of lines) {
        const before = snapshotLineLength(snapshot, line);
        const after = line.length();
        if (before <= MIN_LINE_LENGTH * 100) continue;
        const nearMinimum = after <= MIN_LINE_LENGTH * 5;
        const collapsedRelativeToBefore = after <= before * 1e-4;
        if (nearMinimum && collapsedRelativeToBefore) {
          return { line, before, after };
        }
      }
      return null;
    }
    return Object.freeze({ find: findLineCollapseAfterConstraint });
  }
  window.LineCollapseQuery = Object.freeze({ create });
})();
