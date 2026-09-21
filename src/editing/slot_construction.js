/* Slot geometry/constraints and their mutation checkpoint; no input or Canvas state. */
(function () {
  "use strict";
  const { ArcEndpointCoincidentConstraint, LineCircleTangentConstraint, EqualRadiusConstraint } = window.GeometrySolver;
  function create({ addPoint, addLine, addArc, addConstraintIfMissing, addPointSnapConstraints, addLineBoundarySnapConstraints, snapshotGeometryMutationState, restoreGeometryMutationState, solveAndRefresh }) {
    function addSlotShapeConstraints(sideLine, oppositeLine, endArc, startArc) {
      const endpointConstraints = [
        [endArc, "start", sideLine.p2],
        [endArc, "end", oppositeLine.p1],
        [startArc, "start", oppositeLine.p2],
        [startArc, "end", sideLine.p1],
      ];
      for (const [arc, endpoint, point] of endpointConstraints) {
        addConstraintIfMissing(
          new ArcEndpointCoincidentConstraint(arc, endpoint, point),
          (c) => c instanceof ArcEndpointCoincidentConstraint && c.arc === arc && c.endpoint === endpoint && c.point === point,
        );
      }
      for (const line of [sideLine, oppositeLine]) {
        for (const arc of [endArc, startArc]) {
          addConstraintIfMissing(
            new LineCircleTangentConstraint(line, arc),
            (c) => c instanceof LineCircleTangentConstraint && c.line === line && c.primitive === arc,
          );
        }
      }
      addConstraintIfMissing(
        new EqualRadiusConstraint(endArc, startArc),
        (c) => c instanceof EqualRadiusConstraint && ((c.a === endArc && c.b === startArc) || (c.a === startArc && c.b === endArc)),
      );
    }

    function prepare(geometry, snaps) {
      const snapshot = snapshotGeometryMutationState();
      const firstCenter = addPoint(geometry.firstCenter.x, geometry.firstCenter.y, false, "center");
      const secondCenter = addPoint(geometry.secondCenter.x, geometry.secondCenter.y, false, "center");
      const sideStart = addPoint(geometry.sideStart.x, geometry.sideStart.y, false, "endpoint");
      const sideEnd = addPoint(geometry.sideEnd.x, geometry.sideEnd.y, false, "endpoint");
      const oppositeEnd = addPoint(geometry.oppositeEnd.x, geometry.oppositeEnd.y, false, "endpoint");
      const oppositeStart = addPoint(geometry.oppositeStart.x, geometry.oppositeStart.y, false, "endpoint");
      const sideLine = addLine(sideStart, sideEnd);
      const oppositeLine = addLine(oppositeEnd, oppositeStart);
      const endArc = addArc(secondCenter, geometry.radius, geometry.endArc.startAngle, geometry.endArc.endAngle);
      const startArc = addArc(firstCenter, geometry.radius, geometry.startArc.startAngle, geometry.startArc.endAngle);
      if (!sideLine || !oppositeLine || !endArc || !startArc) {
        restoreGeometryMutationState(snapshot);
        return null;
      }

      addSlotShapeConstraints(sideLine, oppositeLine, endArc, startArc);
      addPointSnapConstraints(firstCenter, snaps.first);
      addPointSnapConstraints(secondCenter, snaps.second);
      addLineBoundarySnapConstraints(sideLine, snaps.width);

      // The command clears its input/selection before calling this completion step.
      return Object.freeze({ commit() {
        const result = solveAndRefresh("長穴追加");
        if (!result.success) restoreGeometryMutationState(snapshot);
        return result;
      } });
    }
    return Object.freeze({ prepare });
  }
  window.SlotConstruction = Object.freeze({ create });
})();
