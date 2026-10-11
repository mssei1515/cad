/* Compute the deletion closure without changing model, selection, or operation state. */
(() => {
  "use strict";
  function create({ isPointUsedByLine, isPointUsedByCircle, isPointUsedByArc, isPointUsedBySpline,
    constraintReferencesPoint, constraintReferencesLine, constraintReferencesPrimitive }) {
    function plan(model, { points = [], lines = [], circles = [], arcs = [], splines = [], constraints = [] } = {}) {
    const pointSet = new Set(points);
    const lineSet = new Set(lines);
    const circleSet = new Set(circles);
    const arcSet = new Set(arcs);
    const splineSet = new Set(splines);
    const constraintSet = new Set(constraints);

    for (const line of model.lines) {
      if (pointSet.has(line.p1) || pointSet.has(line.p2)) lineSet.add(line);
    }

    for (const circle of model.circles) {
      if (pointSet.has(circle.center)) circleSet.add(circle);
    }
    for (const arc of model.arcs) {
      if (pointSet.has(arc.center)) arcSet.add(arc);
    }
    for (const spline of model.splines) {
      if (spline.fitPoints.some((point) => pointSet.has(point))) splineSet.add(spline);
    }
    const remainingLines = model.lines.filter((line) => !lineSet.has(line));
    const remainingCircles = model.circles.filter((circle) => !circleSet.has(circle));
    const remainingArcs = model.arcs.filter((arc) => !arcSet.has(arc));
    const remainingSplines = model.splines.filter((spline) => !splineSet.has(spline));
    for (const line of lineSet) {
      if (line.p1.kind === "endpoint" && !isPointUsedByLine(line.p1, remainingLines) && !isPointUsedByCircle(line.p1, remainingCircles) && !isPointUsedByArc(line.p1, remainingArcs) && !isPointUsedBySpline(line.p1, remainingSplines)) pointSet.add(line.p1);
      if (line.p2.kind === "endpoint" && !isPointUsedByLine(line.p2, remainingLines) && !isPointUsedByCircle(line.p2, remainingCircles) && !isPointUsedByArc(line.p2, remainingArcs) && !isPointUsedBySpline(line.p2, remainingSplines)) pointSet.add(line.p2);
    }
    for (const circle of circleSet) {
      if (circle.center.kind === "endpoint" && !isPointUsedByCircle(circle.center, remainingCircles) && !isPointUsedByLine(circle.center, remainingLines) && !isPointUsedByArc(circle.center, remainingArcs) && !isPointUsedBySpline(circle.center, remainingSplines)) pointSet.add(circle.center);
    }
    for (const arc of arcSet) {
      if (arc.center.kind === "endpoint" && !isPointUsedByArc(arc.center, remainingArcs) && !isPointUsedByLine(arc.center, remainingLines) && !isPointUsedByCircle(arc.center, remainingCircles) && !isPointUsedBySpline(arc.center, remainingSplines)) pointSet.add(arc.center);
    }
    for (const spline of splineSet) {
      for (const point of spline.fitPoints) {
        if (point.kind === "endpoint" && !isPointUsedBySpline(point, remainingSplines) && !isPointUsedByLine(point, remainingLines) && !isPointUsedByCircle(point, remainingCircles) && !isPointUsedByArc(point, remainingArcs)) pointSet.add(point);
      }
    }

    for (const constraint of model.constraints) {
      for (const point of pointSet) {
        if (constraintReferencesPoint(constraint, point)) constraintSet.add(constraint);
      }
      for (const line of lineSet) {
        if (constraintReferencesLine(constraint, line)) constraintSet.add(constraint);
      }
      for (const circle of circleSet) {
        if (constraintReferencesPrimitive(constraint, circle)) constraintSet.add(constraint);
      }
      for (const arc of arcSet) {
        if (constraintReferencesPrimitive(constraint, arc)) constraintSet.add(constraint);
      }
      for (const spline of splineSet) {
        if (constraintReferencesPrimitive(constraint, spline)) constraintSet.add(constraint);
      }
    }

      return { pointSet, lineSet, circleSet, arcSet, splineSet, constraintSet };
    }
    return Object.freeze({ plan });
  }
  window.GeometryDeletionPlan = Object.freeze({ create });
})();
