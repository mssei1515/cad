/* Circle/arc geometry creation and snap attachment, including three-point center allocation rollback. */
(function () {
  "use strict";
  const { hypot2 } = window.GeometrySolver;
  const { shortestAngleFrom } = window.GeometryKernel;
  function create({ endpointAt, addPoint, addCircle, addArc, addPointSnapConstraints, addArcEndpointSnapConstraints, addCircularBoundarySnapConstraints, currentScope, readPointSequence, restorePointSequence }) {
    function beginCenter(point, snap) {
      const center = endpointAt(point.x, point.y);
      addPointSnapConstraints(center, snap);
      return center;
    }
    function createCircle(center, point, snap) {
      const circle = addCircle(center, hypot2(point.x - center.x, point.y - center.y));
      if (circle) addCircularBoundarySnapConstraints(circle, snap);
      return circle;
    }
    function createArc(center, start, point, snap) {
      const arc = addArc(center, start.radius, start.startAngle, shortestAngleFrom(start.startAngle, Math.atan2(point.y - center.y, point.x - center.x)));
      if (arc) {
        addArcEndpointSnapConstraints(arc, "start", start.snap);
        addArcEndpointSnapConstraints(arc, "end", snap);
      }
      return arc;
    }
    function createThreePointArc(geometry, startSnap, endSnap, boundarySnap) {
      const centerPointSeq = readPointSequence();
      const center = addPoint(geometry.center.x, geometry.center.y, false, "center");
      const arc = addArc(center, geometry.radius, geometry.startAngle, geometry.endAngle);
      if (!arc) {
        const scope = currentScope();
        scope.points = scope.points.filter(point => point !== center);
        restorePointSequence(centerPointSeq);
        return null;
      }
      addArcEndpointSnapConstraints(arc, "start", startSnap);
      addArcEndpointSnapConstraints(arc, "end", endSnap);
      addCircularBoundarySnapConstraints(arc, boundarySnap);
      return arc;
    }
    return Object.freeze({ beginCenter, createCircle, createArc, createThreePointArc });
  }
  window.CircularConstruction = Object.freeze({ create });
})();
