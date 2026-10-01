/* Read point roles and usage without owning geometry or spline edit sessions. */
(() => {
  "use strict";
  function create({ currentScope, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines, editedFitPoints, constraintReferencesPoint }) {
    function isPointUsedByLine(point, lines = currentScope().lines) {
      return lines.some((line) => line.p1 === point || line.p2 === point);
    }

    function isAnyLineEndpoint(point) {
      return isPointUsedByLine(point, allGeometryLines());
    }

    function isPointUsedByCircle(point, circles = currentScope().circles) {
      return circles.some((circle) => circle.center === point);
    }

    function isPointUsedByArc(point, arcs = currentScope().arcs) {
      return arcs.some((arc) => arc.center === point);
    }

    function isPointUsedBySpline(point, splines = currentScope().splines) {
      return splines.some((spline) => spline.fitPoints.includes(point));
    }

    function isSplineOnlyFitPoint(point) {
      const projected = Boolean(point?.blockProjection);
      const splines = projected ? allGeometrySplines() : currentScope().splines;
      const lines = projected ? allGeometryLines() : currentScope().lines;
      const circles = projected ? allGeometryCircles() : currentScope().circles;
      const arcs = projected ? allGeometryArcs() : currentScope().arcs;
      return isPointUsedBySpline(point, splines) && !isPointUsedByLine(point, lines) && !isPointUsedByCircle(point, circles) && !isPointUsedByArc(point, arcs) && !isExplicitPoint(point);
    }

    function isEditableSplineFitPoint(point) {
      return Boolean(editedFitPoints()?.includes(point));
    }

    function isPointUsedByPrimitive(point) {
      return isPointUsedByLine(point) || isPointUsedByCircle(point) || isPointUsedByArc(point) || isPointUsedBySpline(point);
    }

    function isEndpointPoint(point) {
      return point?.kind === "endpoint" || isPointUsedByPrimitive(point);
    }

    function isExplicitPoint(point) {
      return point?.kind !== "endpoint";
    }

    function isReferencePoint(point) {
      return Boolean(point?.kind === "endpoint" && !isPointUsedByPrimitive(point) && currentScope().constraints.some((c) => c.enabled !== false && constraintReferencesPoint(c, point)));
    }

    function isPrimitiveCenterPoint(point) {
      return currentScope().circles.some((circle) => circle.center === point) || currentScope().arcs.some((arc) => arc.center === point);
    }

    function isStandalonePoint(point) {
      return isExplicitPoint(point) && !isPointUsedByPrimitive(point);
    }

    function isSelectableEndpointPoint(p) {
      return ((isEndpointPoint(p) && isPointUsedByPrimitive(p) && (!isSplineOnlyFitPoint(p) || isEditableSplineFitPoint(p))) || isReferencePoint(p));
    }


    return Object.freeze({ isPointUsedByLine, isAnyLineEndpoint, isPointUsedByCircle, isPointUsedByArc, isPointUsedBySpline, isSplineOnlyFitPoint, isEditableSplineFitPoint, isPointUsedByPrimitive, isEndpointPoint, isExplicitPoint, isReferencePoint, isPrimitiveCenterPoint, isStandalonePoint, isSelectableEndpointPoint });
  }
  window.PointUsage = Object.freeze({ create });
})();
