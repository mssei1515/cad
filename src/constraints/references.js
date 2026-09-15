/* Constraint reference queries. Geometry identity is preserved; no model mutation or solving. */
(function () {
  "use strict";
  const {
    Arc, ArcEndpointArcEndpointCoincidentConstraint, ArcEndpointCoincidentConstraint, ArcEndpointFixedConstraint,
    ArcEndpointHorizontalConstraint, ArcEndpointOnCircleConstraint, ArcEndpointOnLineConstraint, ArcEndpointVerticalConstraint,
    ArcSymmetryConstraint, Circle, CircleCircleTangentConstraint, CoincidentConstraint,
    CollinearConstraint, ConcentricConstraint, ConcentricRadiusDifferenceConstraint, DiameterConstraint,
    DistanceConstraint, EqualLengthConstraint, EqualRadiusConstraint, GeometryFixedConstraint,
    HorizontalConstraint, Line, LineAngleConstraint, LineCircleDistanceConstraint,
    LineCircleTangentConstraint, LineFixedConstraint, LineLineDistanceConstraint, LineSymmetryConstraint,
    OffsetChainConstraint, OffsetConstraint, ParallelConstraint, ParallelLinesCenterlineConstraint,
    PerpendicularConstraint, PointAxisDistanceConstraint, PointHorizontalConstraint, PointLineDistanceConstraint,
    PointOnCircleConstraint, PointOnLineConstraint, PointOnSplineConstraint, PointPairCenterlineConstraint,
    PointVerticalConstraint, RadiusConstraint, SketchProjectionConstraint, Spline,
    SplineLineTangentConstraint, SplineSplineTangentConstraint, SymmetryConstraint, VerticalConstraint,
  } = window.GeometrySolver;

  function create({ resolveGeometryRef }) {
    function constraintReferencesPoint(c, point) {
      if (c instanceof GeometryFixedConstraint) return c.geometry === point || c.geometry.center === point;
      if (c instanceof SketchProjectionConstraint) return constraintGraphNodes(c).includes(point);
      if (c instanceof PointOnSplineConstraint) return c.point === point || c.spline.fitPoints.includes(point);
      if (c instanceof SplineLineTangentConstraint) return c.spline.fitPoints.includes(point) || c.line.p1 === point || c.line.p2 === point;
      if (c instanceof SplineSplineTangentConstraint) return c.a.fitPoints.includes(point) || c.b.fitPoints.includes(point);
      if (c instanceof DistanceConstraint || c instanceof PointAxisDistanceConstraint) return c.p1 === point || c.p2 === point;
      if (c instanceof PointLineDistanceConstraint) return c.point === point || c.line.p1 === point || c.line.p2 === point;
      if (c instanceof LineLineDistanceConstraint) return c.line1.p1 === point || c.line1.p2 === point || c.line2.p1 === point || c.line2.p2 === point;
      if (c instanceof LineCircleDistanceConstraint) return c.line.p1 === point || c.line.p2 === point || c.circle.center === point;
      if (c instanceof ConcentricRadiusDifferenceConstraint) return c.a.center === point || c.b.center === point;
      if (c instanceof OffsetConstraint) {
        if (c.source instanceof Line && c.offset instanceof Line) {
          return c.source.p1 === point || c.source.p2 === point || c.offset.p1 === point || c.offset.p2 === point;
        }
        return c.source.center === point || c.offset.center === point;
      }
      if (c instanceof OffsetChainConstraint) return constraintGraphNodes(c).includes(point);
      if (c instanceof CoincidentConstraint) return c.p1 === point || c.p2 === point;
      if (c instanceof ArcEndpointCoincidentConstraint) return c.arc.center === point || c.point === point;
      if (c instanceof ArcEndpointArcEndpointCoincidentConstraint) return c.a.center === point || c.b.center === point;
      if (c instanceof ArcEndpointFixedConstraint) return c.arc.center === point;
      if (c instanceof LineFixedConstraint) return c.line.p1 === point || c.line.p2 === point;
      if (c instanceof PointOnLineConstraint) return c.point === point || c.line.p1 === point || c.line.p2 === point;
      if (c instanceof ParallelLinesCenterlineConstraint) return [c.line1, c.line2, c.centerline].some((item) => item.p1 === point || item.p2 === point);
      if (c instanceof PointPairCenterlineConstraint) return c.p1 === point || c.p2 === point || c.centerline.p1 === point || c.centerline.p2 === point;
      if (c instanceof ArcEndpointOnLineConstraint) return c.arc.center === point || c.line.p1 === point || c.line.p2 === point;
      if (c instanceof ArcEndpointHorizontalConstraint || c instanceof ArcEndpointVerticalConstraint) return c.a.center === point || c.b.center === point;
      if (c instanceof HorizontalConstraint || c instanceof VerticalConstraint) return c.line.p1 === point || c.line.p2 === point;
      if (c instanceof PointHorizontalConstraint || c instanceof PointVerticalConstraint) return c.p1 === point || c.p2 === point;
      if (c instanceof SymmetryConstraint) return c.p1 === point || c.p2 === point || c.axis.p1 === point || c.axis.p2 === point;
      if (c instanceof LineSymmetryConstraint) {
        return c.line1.p1 === point || c.line1.p2 === point || c.line2.p1 === point || c.line2.p2 === point || c.axis.p1 === point || c.axis.p2 === point;
      }
      if (c instanceof ArcSymmetryConstraint) return c.arc1.center === point || c.arc2.center === point || c.axis.p1 === point || c.axis.p2 === point;
      if (c instanceof ParallelConstraint || c instanceof PerpendicularConstraint) {
        return c.line1.p1 === point || c.line1.p2 === point || c.line2.p1 === point || c.line2.p2 === point;
      }
      if (c instanceof CollinearConstraint || c instanceof EqualLengthConstraint || c instanceof LineAngleConstraint) return c.line1.p1 === point || c.line1.p2 === point || c.line2.p1 === point || c.line2.p2 === point;
      if (c instanceof ConcentricConstraint) return c.a === point || c.b === point || c.a.center === point || c.b.center === point;
      if (c instanceof PointOnCircleConstraint) return c.point === point || c.primitive.center === point;
      if (c instanceof ArcEndpointOnCircleConstraint) return c.arc.center === point || c.primitive.center === point;
      if (c instanceof RadiusConstraint || c instanceof DiameterConstraint) return c.primitive.center === point;
      if (c instanceof EqualRadiusConstraint || c instanceof CircleCircleTangentConstraint) return c.a.center === point || c.b.center === point;
      if (c instanceof LineCircleTangentConstraint) return c.line.p1 === point || c.line.p2 === point || c.primitive.center === point;
      return false;
    }

    function constraintReferencesLine(c, line) {
      if (c instanceof SketchProjectionConstraint) return c.source === line || c.target === line;
      if (c instanceof SplineLineTangentConstraint) return c.line === line;
      if (c instanceof DistanceConstraint || c instanceof PointAxisDistanceConstraint) {
        return (c.p1 === line.p1 && c.p2 === line.p2) || (c.p1 === line.p2 && c.p2 === line.p1);
      }
      if (c instanceof PointHorizontalConstraint || c instanceof PointVerticalConstraint) {
        return (c.p1 === line.p1 && c.p2 === line.p2) || (c.p1 === line.p2 && c.p2 === line.p1);
      }
      if (c instanceof SymmetryConstraint) return c.axis === line;
      if (c instanceof LineSymmetryConstraint) return c.line1 === line || c.line2 === line || c.axis === line;
      if (c instanceof ArcSymmetryConstraint) return c.axis === line;
      if (c instanceof PointLineDistanceConstraint) return c.line === line;
      if (c instanceof LineLineDistanceConstraint) return c.line1 === line || c.line2 === line;
      if (c instanceof LineCircleDistanceConstraint) return c.line === line;
      if (c instanceof OffsetConstraint) return c.source === line || c.offset === line;
      if (c instanceof OffsetChainConstraint) return c.sources.includes(line) || c.offsets.includes(line);
      if (c instanceof LineFixedConstraint) return c.line === line;
      if (c instanceof PointOnLineConstraint) return c.line === line;
      if (c instanceof ParallelLinesCenterlineConstraint) return c.line1 === line || c.line2 === line || c.centerline === line;
      if (c instanceof PointPairCenterlineConstraint) return c.centerline === line;
      if (c instanceof ArcEndpointOnLineConstraint) return c.line === line;
      if (c instanceof HorizontalConstraint || c instanceof VerticalConstraint) return c.line === line;
      if (c instanceof ParallelConstraint || c instanceof PerpendicularConstraint) return c.line1 === line || c.line2 === line;
      if (c instanceof CollinearConstraint || c instanceof EqualLengthConstraint || c instanceof LineAngleConstraint) return c.line1 === line || c.line2 === line;
      if (c instanceof LineCircleTangentConstraint) return c.line === line;
      return false;
    }

    function constraintReferencesPrimitive(c, primitive) {
      if (c instanceof GeometryFixedConstraint) return c.geometry === primitive;
      if (c instanceof SketchProjectionConstraint) return c.source === primitive || c.target === primitive;
      if (c instanceof PointOnSplineConstraint) return c.spline === primitive;
      if (c instanceof SplineLineTangentConstraint) return c.spline === primitive;
      if (c instanceof SplineSplineTangentConstraint) return c.a === primitive || c.b === primitive;
      if (c instanceof ArcSymmetryConstraint) return c.arc1 === primitive || c.arc2 === primitive;
      if (c instanceof OffsetConstraint) return c.source === primitive || c.offset === primitive;
      if (c instanceof OffsetChainConstraint) return c.sources.includes(primitive) || c.offsets.includes(primitive);
      if (c instanceof ArcEndpointCoincidentConstraint) return c.arc === primitive;
      if (c instanceof ArcEndpointArcEndpointCoincidentConstraint) return c.a === primitive || c.b === primitive;
      if (c instanceof ArcEndpointOnLineConstraint) return c.arc === primitive;
      if (c instanceof ArcEndpointHorizontalConstraint || c instanceof ArcEndpointVerticalConstraint) return c.a === primitive || c.b === primitive;
      if (c instanceof ArcEndpointFixedConstraint) return c.arc === primitive;
      if (c instanceof RadiusConstraint || c instanceof DiameterConstraint || c instanceof PointOnCircleConstraint || c instanceof LineCircleTangentConstraint) return c.primitive === primitive;
      if (c instanceof LineCircleDistanceConstraint) return c.circle === primitive;
      if (c instanceof ArcEndpointOnCircleConstraint) return c.arc === primitive || c.primitive === primitive;
      if (c instanceof ConcentricConstraint || c instanceof EqualRadiusConstraint || c instanceof CircleCircleTangentConstraint || c instanceof ConcentricRadiusDifferenceConstraint) return c.a === primitive || c.b === primitive;
      return false;
    }

    function constraintGraphNodes(c, options = {}) {
      const nodes = new Set();
      if (c instanceof GeometryFixedConstraint) {
        addNode(nodes, c.geometry);
        if (c.geometry.center) addNode(nodes, c.geometry.center);
      } else if (c instanceof SketchProjectionConstraint) {
        for (const item of [c.source, c.target]) {
          addNode(nodes, item);
          if (item instanceof Line) {
            addNode(nodes, item.p1);
            addNode(nodes, item.p2);
          } else if (item instanceof Circle || item instanceof Arc) {
            addNode(nodes, item.center);
          } else if (item instanceof Spline) {
            for (const point of item.fitPoints) addNode(nodes, point);
          }
        }
      } else if (c instanceof PointOnSplineConstraint) {
        addNode(nodes, c.point);
        addNode(nodes, c.spline);
        for (const point of c.spline.fitPoints) addNode(nodes, point);
      } else if (c instanceof SplineLineTangentConstraint) {
        addNode(nodes, c.spline);
        for (const point of c.spline.fitPoints) addNode(nodes, point);
        addNode(nodes, c.line);
        addNode(nodes, c.line.p1);
        addNode(nodes, c.line.p2);
      } else if (c instanceof SplineSplineTangentConstraint) {
        for (const spline of [c.a, c.b]) {
          addNode(nodes, spline);
          for (const point of spline.fitPoints) addNode(nodes, point);
        }
      } else if (c instanceof DistanceConstraint || c instanceof PointAxisDistanceConstraint) {
        addNode(nodes, c.p1);
        addNode(nodes, c.p2);
      } else if (c instanceof PointLineDistanceConstraint) {
        addNode(nodes, c.point);
        addNode(nodes, c.line);
        addNode(nodes, c.line.p1);
        addNode(nodes, c.line.p2);
      } else if (c instanceof LineLineDistanceConstraint) {
        for (const line of [c.line1, c.line2]) {
          addNode(nodes, line);
          addNode(nodes, line.p1);
          addNode(nodes, line.p2);
        }
      } else if (c instanceof LineCircleDistanceConstraint) {
        addNode(nodes, c.line);
        addNode(nodes, c.line.p1);
        addNode(nodes, c.line.p2);
        addNode(nodes, c.circle);
        addNode(nodes, c.circle.center);
      } else if (c instanceof ConcentricRadiusDifferenceConstraint) {
        for (const primitive of [c.a, c.b]) {
          addNode(nodes, primitive);
          addNode(nodes, primitive.center);
        }
      } else if (c instanceof OffsetConstraint) {
        for (const item of [c.source, c.offset]) {
          addNode(nodes, item);
          if (item instanceof Line) {
            addNode(nodes, item.p1);
            addNode(nodes, item.p2);
          } else {
            addNode(nodes, item.center);
          }
        }
      } else if (c instanceof OffsetChainConstraint) {
        for (const item of [...c.sources, ...c.offsets]) {
          addNode(nodes, item);
          if (item instanceof Line) {
            addNode(nodes, item.p1);
            addNode(nodes, item.p2);
          } else if (item instanceof Arc) {
            addNode(nodes, item.center);
          }
        }
      } else if (c instanceof CoincidentConstraint) {
        addNode(nodes, c.p1);
        addNode(nodes, c.p2);
      } else if (c instanceof ArcEndpointCoincidentConstraint) {
        addNode(nodes, c.arc);
        addNode(nodes, c.arc.center);
        addNode(nodes, c.point);
      } else if (c instanceof ArcEndpointArcEndpointCoincidentConstraint) {
        for (const arc of [c.a, c.b]) {
          addNode(nodes, arc);
          addNode(nodes, arc.center);
        }
      } else if (c instanceof PointOnLineConstraint) {
        addNode(nodes, c.point);
        addNode(nodes, c.line);
        addNode(nodes, c.line.p1);
        addNode(nodes, c.line.p2);
      } else if (c instanceof ParallelLinesCenterlineConstraint) {
        for (const line of [c.line1, c.line2, c.centerline]) {
          addNode(nodes, line);
          addNode(nodes, line.p1);
          addNode(nodes, line.p2);
        }
      } else if (c instanceof PointPairCenterlineConstraint) {
        addNode(nodes, c.p1);
        addNode(nodes, c.p2);
        addNode(nodes, c.centerline);
        addNode(nodes, c.centerline.p1);
        addNode(nodes, c.centerline.p2);
      } else if (c instanceof ArcEndpointOnLineConstraint) {
        addNode(nodes, c.arc);
        addNode(nodes, c.arc.center);
        addNode(nodes, c.line);
        addNode(nodes, c.line.p1);
        addNode(nodes, c.line.p2);
      } else if (c instanceof ArcEndpointHorizontalConstraint || c instanceof ArcEndpointVerticalConstraint) {
        for (const arc of [c.a, c.b]) {
          addNode(nodes, arc);
          addNode(nodes, arc.center);
        }
      } else if (c instanceof ArcEndpointFixedConstraint) {
        addNode(nodes, c.arc);
        addNode(nodes, c.arc.center);
      } else if (c instanceof LineFixedConstraint || c instanceof HorizontalConstraint || c instanceof VerticalConstraint) {
        addNode(nodes, c.line);
        addNode(nodes, c.line.p1);
        addNode(nodes, c.line.p2);
      } else if (c instanceof PointHorizontalConstraint || c instanceof PointVerticalConstraint) {
        addNode(nodes, c.p1);
        addNode(nodes, c.p2);
      } else if (c instanceof SymmetryConstraint) {
        addNode(nodes, c.p1);
        addNode(nodes, c.p2);
        addNode(nodes, c.axis);
        addNode(nodes, c.axis.p1);
        addNode(nodes, c.axis.p2);
      } else if (c instanceof LineSymmetryConstraint) {
        for (const line of [c.line1, c.line2, c.axis]) {
          addNode(nodes, line);
          addNode(nodes, line.p1);
          addNode(nodes, line.p2);
        }
      } else if (c instanceof ArcSymmetryConstraint) {
        for (const arc of [c.arc1, c.arc2]) {
          addNode(nodes, arc);
          addNode(nodes, arc.center);
        }
        addNode(nodes, c.axis);
        addNode(nodes, c.axis.p1);
        addNode(nodes, c.axis.p2);
      } else if (c instanceof ParallelConstraint || c instanceof PerpendicularConstraint || c instanceof CollinearConstraint || c instanceof EqualLengthConstraint || c instanceof LineAngleConstraint) {
        for (const line of [c.line1, c.line2]) {
          addNode(nodes, line);
          addNode(nodes, line.p1);
          addNode(nodes, line.p2);
        }
      } else if (c instanceof RadiusConstraint || c instanceof DiameterConstraint || c instanceof PointOnCircleConstraint || c instanceof ArcEndpointOnCircleConstraint || c instanceof LineCircleTangentConstraint) {
        if (c.point) addNode(nodes, c.point);
        if (c.arc) {
          addNode(nodes, c.arc);
          addNode(nodes, c.arc.center);
        }
        if (c.line) {
          addNode(nodes, c.line);
          addNode(nodes, c.line.p1);
          addNode(nodes, c.line.p2);
        }
        if (c.primitive) {
          addNode(nodes, c.primitive);
          addNode(nodes, c.primitive.center);
        }
      } else if (c instanceof ConcentricConstraint || c instanceof EqualRadiusConstraint || c instanceof CircleCircleTangentConstraint) {
        for (const item of [c.a, c.b]) {
          addNode(nodes, item);
          addNode(nodes, item.center || item);
        }
      }
      if (options.includeIntrinsicDependencies !== false) {
        for (const node of [...nodes]) {
          if (node?.blockInstance) addNode(nodes, node.blockInstance);
          if (node?.derivedInstance) {
            addNode(nodes, node.derivedInstance);
            for (const ref of geometryInstanceDependencyRefs(node.derivedInstance)) addNode(nodes, resolveGeometryRef(ref));
          }
        }
      }
      return [...nodes];
    }

    function geometryInstanceDependencyRefs(instance) {
      return [...(instance?.sources || []), instance?.axis, instance?.direction].filter(Boolean);
    }

    function addNode(nodes, value) {
      if (value) nodes.add(value);
    }

    return Object.freeze({
      constraintReferencesPoint, constraintReferencesLine, constraintReferencesPrimitive,
      constraintGraphNodes, geometryInstanceDependencyRefs,
    });
  }
  window.ConstraintReferences = Object.freeze({ create });
})();
