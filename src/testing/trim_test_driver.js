/* Browser-test Trim fixtures delegate geometry, interval queries and constraint transfer to product owners. */
(() => {
  "use strict";
  function createLineTransferFixture({ resetModelState, addPoint, addLine, pushModelConstraint, PointOnLineConstraint, executeLineTrim, currentScope }) {
    function reset() {
      resetModelState();
      const p1 = addPoint(0, 0, false, "endpoint");
      const p2 = addPoint(100, 0, false, "endpoint");
      const line = addLine(p1, p2);
      const leftPoint = addPoint(25, 0, false, "endpoint");
      const rightPoint = addPoint(75, 0, false, "endpoint");
      const leftConstraint = pushModelConstraint(new PointOnLineConstraint(leftPoint, line));
      const rightConstraint = pushModelConstraint(new PointOnLineConstraint(rightPoint, line));
      executeLineTrim({
        kind: "line",
        item: line,
        interval: {
          left: { t: 0.4, point: { x: 40, y: 0 }, source: {} },
          right: { t: 0.6, point: { x: 60, y: 0 }, source: {} },
        },
      });
      const rightLine = currentScope().lines.find((candidate) => candidate !== line);
      return {
        lineCount: currentScope().lines.length,
        leftConstraintOnLeftLine: leftConstraint.line === line,
        rightConstraintOnRightLine: rightConstraint.line === rightLine,
        leftLineEnd: { x: line.p2.x, y: line.p2.y },
        rightLineStart: rightLine ? { x: rightLine.p1.x, y: rightLine.p1.y } : null,
      };
    }
    return Object.freeze({ reset });
  }

  function createConstructionBoundaryFixture({ resetModelState, addPoint, addLine, addCircle, addArc, lineTrimBoundaries, trimPreviewForLine, arcTrimBoundaries, trimPreviewForArc, circlePointAtAngle, circleTrimBoundaries, trimPreviewForCircle }) {
    function boundaryCase() {
      resetModelState();
      const point = (x, y) => addPoint(x, y, false, "endpoint");
      const line = (x1, y1, x2, y2, construction = false) => addLine(point(x1, y1), point(x2, y2), construction);

      const lineTarget = line(-100, 0, 100, 0);
      line(-60, -120, -60, 120);
      line(60, -120, 60, 120);
      line(0, -120, 0, 120, true);
      addCircle(point(0, 0), 30, true);
      addArc(point(0, 0), 45, 0, Math.PI, true);

      const arcTarget = addArc(point(0, 400), 100, 0, Math.PI);
      line(0, 350, 0, 550);
      line(50, 350, 50, 550, true);
      addCircle(point(50, 400), 100, true);
      addArc(point(-50, 400), 100, 0, Math.PI, true);

      const circleTarget = addCircle(point(0, 800), 100);
      line(0, 650, 0, 950);
      line(50, 650, 50, 950, true);
      addCircle(point(50, 800), 100, true);
      addArc(point(-50, 800), 100, 0, Math.PI, true);

      const lineBoundaries = lineTrimBoundaries(lineTarget);
      const linePreview = trimPreviewForLine(lineTarget, { x: 0, y: 0 });
      const arcBoundaries = arcTrimBoundaries(arcTarget);
      const arcPreview = trimPreviewForArc(arcTarget, circlePointAtAngle(arcTarget, Math.PI / 4));
      const circleBoundaries = circleTrimBoundaries(circleTarget);
      const circlePreview = trimPreviewForCircle(circleTarget, circlePointAtAngle(circleTarget, 0));
      return {
        lineBoundaryXs: lineBoundaries.map((boundary) => boundary.point.x),
        lineIntervalXs: [linePreview?.interval?.left?.point?.x, linePreview?.interval?.right?.point?.x],
        arcBoundaryParameters: arcBoundaries.map((boundary) => boundary.t),
        arcIntervalParameters: [arcPreview?.interval?.left?.t, arcPreview?.interval?.right?.t],
        circleBoundaryParameters: circleBoundaries.map((boundary) => boundary.t),
        circleIntervalParameters: [circlePreview?.interval?.left?.t, circlePreview?.interval?.right?.t],
      };
    }
    return Object.freeze({ boundaryCase });
  }

  function createDiameterTransferFixture({ resetModelState, addCircle, addPoint, pushModelConstraint, DiameterConstraint, angleAtCircleParam, circlePointAtAngle, executeCircleTrim, currentScope }) {
    function diameterCase(boundaryCount = 2) {
      resetModelState();
      const circle = addCircle(addPoint(0, 0, false, "center"), 50);
      const diameter = pushModelConstraint(new DiameterConstraint(circle, 100));
      diameter.dimension = {
        x: 70,
        y: 0,
        labelOffsetU: 8,
        display: { color: "#7c3aed", prefix: "Ø" },
      };
      const count = Math.max(2, Math.floor(Number(boundaryCount) || 2));
      const boundaries = Array.from({ length: count }, (_, index) => {
        const t = index / count;
        const angle = angleAtCircleParam(t);
        return { t, angle, point: circlePointAtAngle(circle, angle), source: {} };
      });
      executeCircleTrim({
        kind: "circle",
        item: circle,
        interval: {
          left: { ...boundaries[0], angle: angleAtCircleParam(boundaries[0].t) },
          right: { ...boundaries[1], angle: angleAtCircleParam(boundaries[1].t) },
        },
        boundaries,
      });
      const retained = currentScope().constraints.find((constraint) => constraint instanceof DiameterConstraint);
      return {
        arcCount: currentScope().arcs.length,
        diameterCount: currentScope().constraints.filter((constraint) => constraint instanceof DiameterConstraint).length,
        retainedSameConstraint: retained === diameter,
        primitiveId: retained?.primitive?.id || null,
        target: retained?.target ?? null,
        parameterName: retained?.parameterName || null,
        expression: retained?.expression || null,
        dimension: retained?.dimension || null,
      };
    }
    return Object.freeze({ diameterCase });
  }

  function createFeature({ feature, resetModelState, geometry, pushModelConstraint, currentScope }) {
    const { PointOnLineConstraint, DiameterConstraint } = window.GeometrySolver;
    const { circlePointAtAngle } = window.GeometryKernel;
    const { addPoint, addLine, addCircle, addArc } = geometry;
    const { query, editing } = feature;
    const lineTransfer = createLineTransferFixture({ resetModelState, addPoint, addLine, pushModelConstraint, PointOnLineConstraint,
      executeLineTrim: editing.executeLineTrim, currentScope });
    const constructionBoundary = createConstructionBoundaryFixture({ resetModelState, addPoint, addLine, addCircle, addArc,
      lineTrimBoundaries: query.lineTrimBoundaries, trimPreviewForLine: query.trimPreviewForLine, arcTrimBoundaries: query.arcTrimBoundaries,
      trimPreviewForArc: query.trimPreviewForArc, circlePointAtAngle, circleTrimBoundaries: query.circleTrimBoundaries, trimPreviewForCircle: query.trimPreviewForCircle });
    const diameterTransfer = createDiameterTransferFixture({ resetModelState, addCircle, addPoint, pushModelConstraint, DiameterConstraint,
      angleAtCircleParam: query.angleAtCircleParam, circlePointAtAngle, executeCircleTrim: editing.executeCircleTrim, currentScope });
    return Object.freeze({ lineTransfer, constructionBoundary, diameterTransfer });
  }
  window.TrimTestDriver = Object.freeze({ createLineTransferFixture, createConstructionBoundaryFixture, createDiameterTransferFixture, createFeature });
})();
