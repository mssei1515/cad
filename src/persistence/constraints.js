/* Persistent constraint formats and scoped reference restoration. */
(function () {
  "use strict";
  const {
    Arc, Circle, Line, Spline,
    ArcEndpointArcEndpointCoincidentConstraint, ArcEndpointCoincidentConstraint,
    ArcEndpointFixedConstraint, ArcEndpointHorizontalConstraint, ArcEndpointOnCircleConstraint,
    ArcEndpointOnLineConstraint, ArcEndpointVerticalConstraint, ArcSymmetryConstraint,
    CircleCircleTangentConstraint, CoincidentConstraint, CollinearConstraint, ConcentricConstraint,
    ConcentricRadiusDifferenceConstraint, DiameterConstraint, DistanceConstraint,
    EqualLengthConstraint, EqualRadiusConstraint, GeometryFixedConstraint, HorizontalConstraint,
    LineAngleConstraint, LineCircleDistanceConstraint, LineCircleTangentConstraint, LineFixedConstraint,
    LineLineDistanceConstraint, LineSymmetryConstraint, OffsetChainConstraint, OffsetConstraint,
    ParallelConstraint, ParallelLinesCenterlineConstraint, PerpendicularConstraint,
    PointAxisDistanceConstraint, PointHorizontalConstraint, PointLineDistanceConstraint,
    PointOnCircleConstraint, PointOnLineConstraint, PointOnSplineConstraint,
    PointPairCenterlineConstraint, PointVerticalConstraint, RadiusConstraint, SketchProjectionConstraint,
    SplineLineTangentConstraint, SplineSplineTangentConstraint, SymmetryConstraint, VerticalConstraint,
  } = window.GeometrySolver;
  const { parseId: parseGeometryRefId, resolve: resolveGeometryRefValue } = window.GeometryRef;
  const { normalizeDimensionAppearance } = window.Appearance;

  const { isDimensionConstraint } = window.DimensionQueries;

  // Geometry IDs and dimension placement belong to the caller's display scope.
  function create({ geometryId, dimensionData }) {
    const constraintCodecs = window.ConstraintCodecRegistry.create([
      {
        type: "pointAxisDistance",
        constraintClass: PointAxisDistanceConstraint,
        serialize: (c) => ({ p1: geometryId(c.p1), p2: geometryId(c.p2), axis: c.axis, sign: c.sign, target: c.target, dimension: dimensionData(c), enabled: c.enabled }),
        deserialize: (data, refs) => new PointAxisDistanceConstraint(refs.point(data.p1), refs.point(data.p2), Number(data.target), data.axis === "y" ? "y" : "x", Number(data.sign) || null),
      },
      {
        type: "distance",
        constraintClass: DistanceConstraint,
        serialize: (c) => ({ p1: geometryId(c.p1), p2: geometryId(c.p2), target: c.target, dimension: dimensionData(c), enabled: c.enabled }),
        deserialize: (data, refs) => new DistanceConstraint(refs.point(data.p1), refs.point(data.p2), Number(data.target)),
      },
      {
        type: "pointLineDistance",
        constraintClass: PointLineDistanceConstraint,
        serialize: (c) => ({ point: geometryId(c.point), line: geometryId(c.line), target: c.target, sign: c.sign, dimension: dimensionData(c), enabled: c.enabled }),
        deserialize: (data, refs) => new PointLineDistanceConstraint(refs.point(data.point), refs.line(data.line), Number(data.target), Number(data.sign) || null),
      },
      {
        type: "lineLineDistance",
        constraintClass: LineLineDistanceConstraint,
        serialize: (c) => ({ line1: geometryId(c.line1), line2: geometryId(c.line2), target: c.target, sign: c.sign, dimension: dimensionData(c), enabled: c.enabled }),
        deserialize: (data, refs) => new LineLineDistanceConstraint(refs.line(data.line1), refs.line(data.line2), Number(data.target), Number(data.sign) || null),
      },
      {
        type: "lineCircleDistance",
        constraintClass: LineCircleDistanceConstraint,
        serialize: (c) => ({ line: geometryId(c.line), circle: geometryId(c.circle), target: c.target, sign: c.sign, dimension: dimensionData(c), enabled: c.enabled }),
        deserialize(data, refs) {
          const circle = refs.primitive(data.circle);
          if (!(circle instanceof Circle)) throw new Error(`線-円中心寸法の円 ${data.circle} が見つかりません`);
          return new LineCircleDistanceConstraint(refs.line(data.line), circle, Number(data.target), Number(data.sign) || null);
        },
      },
      {
        type: "concentricRadiusDifferenceDimension",
        constraintClass: ConcentricRadiusDifferenceConstraint,
        serialize: (c) => ({ a: geometryId(c.a), b: geometryId(c.b), target: c.target, sign: c.sign, dimension: dimensionData(c), enabled: c.enabled }),
        deserialize: (data, refs) => new ConcentricRadiusDifferenceConstraint(refs.primitive(data.a), refs.primitive(data.b), Number(data.target), Number(data.sign) || null),
      },
      {
        type: "offsetDimension",
        constraintClass: OffsetConstraint,
        serialize: (c) => ({ source: geometryId(c.source), offset: geometryId(c.offset), target: c.target, sign: c.sign, directionBasis: c.source instanceof Line ? "endpoint" : "radial", dimension: dimensionData(c), enabled: c.enabled }),
        deserialize(data, refs) {
          const source = refs.lineOrPrimitive(data.source);
          const offset = refs.lineOrPrimitive(data.offset);
          if (!source || !offset) throw new Error(`オフセット対象 ${data.source}/${data.offset} が見つかりません`);
          const savedSign = data.directionBasis === "endpoint" || data.directionBasis === "radial" ? Number(data.sign) || null : null;
          return new OffsetConstraint(source, offset, Number(data.target), savedSign);
        },
      },
      {
        type: "offsetChainDimension",
        constraintClass: OffsetChainConstraint,
        serialize: (c) => ({
          sources: c.sources.map((geometry, index) => ({ geometry: geometryId(geometry), reversed: Boolean(c.sourceReversed[index]) })),
          offsets: c.offsets.map(geometryId),
          target: c.target,
          side: c.side,
          closed: Boolean(c.closed),
          joinType: "miter",
          dimensionSegmentIndex: c.dimensionSegmentIndex,
          dimension: dimensionData(c),
          enabled: c.enabled,
        }),
        deserialize(data, refs) {
          if (!Array.isArray(data.sources) || !Array.isArray(data.offsets) || data.sources.length < 2 || data.sources.length !== data.offsets.length) {
            throw new Error("チェーンオフセットの参照数が不正です");
          }
          if (data.joinType !== "miter" || !Number.isFinite(Number(data.target)) || Number(data.target) <= 0 || ![-1, 1].includes(Number(data.side)) || typeof data.closed !== "boolean") {
            throw new Error("チェーンオフセットの設定値が不正です");
          }
          if (data.sources.some((entry) => !entry || typeof entry.geometry !== "string" || typeof entry.reversed !== "boolean")
            || data.offsets.some((id) => typeof id !== "string")
            || new Set(data.sources.map((entry) => entry.geometry)).size !== data.sources.length
            || new Set(data.offsets).size !== data.offsets.length
            || !Number.isInteger(data.dimensionSegmentIndex)
            || data.dimensionSegmentIndex < 0
            || data.dimensionSegmentIndex >= data.sources.length) {
            throw new Error("チェーンオフセットの順序情報が不正です");
          }
          const sources = data.sources.map((entry) => refs.lineOrPrimitive(entry?.geometry));
          const offsets = data.offsets.map((id) => refs.lineOrPrimitive(id));
          if (sources.some((item) => !(item instanceof Line || item instanceof Arc)) || offsets.some((item) => !(item instanceof Line || item instanceof Arc))) {
            throw new Error("チェーンオフセットの線または円弧が見つかりません");
          }
          if (sources.some((source, index) => source.constructor !== offsets[index].constructor)) {
            throw new Error("チェーンオフセットの対応する図形種別が一致しません");
          }
          return new OffsetChainConstraint(
            sources,
            offsets,
            Number(data.target),
            Number(data.side),
            data.sources.map((entry) => Boolean(entry?.reversed)),
            Boolean(data.closed),
            data.dimensionSegmentIndex,
          );
        },
      },
      {
        type: "lineAngle",
        constraintClass: LineAngleConstraint,
        serialize: (c) => ({ line1: geometryId(c.line1), line2: geometryId(c.line2), target: c.target, startFlip: c.startFlip || 0, endFlip: c.endFlip || 0, dimension: dimensionData(c), enabled: c.enabled }),
        deserialize: (data, refs) => new LineAngleConstraint(refs.line(data.line1), refs.line(data.line2), Number(data.target), Number(data.startFlip) || 0, Number(data.endFlip) || 0),
      },
      {
        type: "coincident",
        constraintClass: CoincidentConstraint,
        serialize: (c) => ({ p1: geometryId(c.p1), p2: geometryId(c.p2), enabled: c.enabled }),
        deserialize: (data, refs) => new CoincidentConstraint(refs.point(data.p1), refs.point(data.p2)),
      },
      {
        type: "arcEndpointCoincident",
        constraintClass: ArcEndpointCoincidentConstraint,
        serialize: (c) => ({ arc: geometryId(c.arc), endpoint: c.endpoint, point: geometryId(c.point), enabled: c.enabled }),
        deserialize: (data, refs) => new ArcEndpointCoincidentConstraint(refs.primitive(data.arc), data.endpoint === "end" ? "end" : "start", refs.point(data.point)),
      },
      {
        type: "arcEndpointArcEndpointCoincident",
        constraintClass: ArcEndpointArcEndpointCoincidentConstraint,
        serialize: (c) => ({ a: geometryId(c.a), endpointA: c.endpointA, b: geometryId(c.b), endpointB: c.endpointB, enabled: c.enabled }),
        deserialize: (data, refs) => new ArcEndpointArcEndpointCoincidentConstraint(refs.primitive(data.a), data.endpointA === "end" ? "end" : "start", refs.primitive(data.b), data.endpointB === "end" ? "end" : "start"),
      },
      {
        type: "pointOnLine",
        constraintClass: PointOnLineConstraint,
        serialize: (c) => ({ point: geometryId(c.point), line: geometryId(c.line), enabled: c.enabled }),
        deserialize: (data, refs) => new PointOnLineConstraint(refs.point(data.point), refs.line(data.line)),
      },
      {
        type: "parallelLinesCenterline",
        constraintClass: ParallelLinesCenterlineConstraint,
        serialize: (c) => ({ line1: geometryId(c.line1), line2: geometryId(c.line2), centerline: geometryId(c.centerline), enabled: c.enabled }),
        deserialize: (data, refs) => new ParallelLinesCenterlineConstraint(refs.line(data.line1), refs.line(data.line2), refs.line(data.centerline)),
      },
      {
        type: "pointPairCenterline",
        constraintClass: PointPairCenterlineConstraint,
        serialize: (c) => ({ p1: geometryId(c.p1), p2: geometryId(c.p2), centerline: geometryId(c.centerline), enabled: c.enabled }),
        deserialize: (data, refs) => new PointPairCenterlineConstraint(refs.point(data.p1), refs.point(data.p2), refs.line(data.centerline)),
      },
      {
        type: "sketchProjection",
        constraintClass: SketchProjectionConstraint,
        serialize: (c) => ({ kind: c.kind, source: geometryId(c.source), target: geometryId(c.target), enabled: c.enabled }),
        deserialize: (data, refs) => new SketchProjectionConstraint(data.kind, refs.geometry(data.kind, data.source), refs.geometry(data.kind, data.target)),
      },
      {
        type: "arcEndpointOnLine",
        constraintClass: ArcEndpointOnLineConstraint,
        serialize: (c) => ({ arc: geometryId(c.arc), endpoint: c.endpoint, line: geometryId(c.line), enabled: c.enabled }),
        deserialize: (data, refs) => new ArcEndpointOnLineConstraint(refs.primitive(data.arc), data.endpoint === "end" ? "end" : "start", refs.line(data.line)),
      },
      {
        type: "arcEndpointFixed",
        constraintClass: ArcEndpointFixedConstraint,
        serialize: (c) => ({ arc: geometryId(c.arc), endpoint: c.endpoint, x: c.x, y: c.y, enabled: c.enabled }),
        deserialize: (data, refs) => new ArcEndpointFixedConstraint(refs.primitive(data.arc), data.endpoint === "end" ? "end" : "start", Number(data.x), Number(data.y)),
      },
      {
        type: "lineFixed",
        constraintClass: LineFixedConstraint,
        serialize: (c) => ({ line: geometryId(c.line), p1x: c.p1x, p1y: c.p1y, p2x: c.p2x, p2y: c.p2y, enabled: c.enabled }),
        deserialize: (data, refs) => new LineFixedConstraint(refs.line(data.line), Number(data.p1x), Number(data.p1y), Number(data.p2x), Number(data.p2y)),
      },
      {
        type: "geometryFixed",
        constraintClass: GeometryFixedConstraint,
        serialize: (c) => ({ kind: c.kind, geometry: geometryId(c.geometry), x: c.x, y: c.y, ...(c.kind !== "point" ? { radius: c.radius } : {}), ...(c.kind === "arc" ? { startAngle: c.startAngle, endAngle: c.endAngle } : {}), enabled: c.enabled }),
        deserialize: (data, refs) => {
          const fields = ["x", "y", ...(data.kind !== "point" ? ["radius"] : []), ...(data.kind === "arc" ? ["startAngle", "endAngle"] : [])];
          if (!["point", "circle", "arc"].includes(data.kind) || fields.some((key) => typeof data[key] !== "number" || !Number.isFinite(data[key])) || (data.kind !== "point" && data.radius <= 0)) throw new Error("Invalid fixed geometry");
          return new GeometryFixedConstraint(refs.geometry(data.kind, data.geometry), data);
        },
      },
      {
        type: "horizontal",
        constraintClass: HorizontalConstraint,
        serialize: (c) => ({ line: geometryId(c.line), enabled: c.enabled }),
        deserialize: (data, refs) => new HorizontalConstraint(refs.line(data.line)),
      },
      {
        type: "vertical",
        constraintClass: VerticalConstraint,
        serialize: (c) => ({ line: geometryId(c.line), enabled: c.enabled }),
        deserialize: (data, refs) => new VerticalConstraint(refs.line(data.line)),
      },
      {
        type: "pointHorizontal",
        constraintClass: PointHorizontalConstraint,
        serialize: (c) => ({ p1: geometryId(c.p1), p2: geometryId(c.p2), enabled: c.enabled }),
        deserialize: (data, refs) => new PointHorizontalConstraint(refs.point(data.p1), refs.point(data.p2)),
      },
      {
        type: "pointVertical",
        constraintClass: PointVerticalConstraint,
        serialize: (c) => ({ p1: geometryId(c.p1), p2: geometryId(c.p2), enabled: c.enabled }),
        deserialize: (data, refs) => new PointVerticalConstraint(refs.point(data.p1), refs.point(data.p2)),
      },
      {
        type: "arcEndpointHorizontal",
        constraintClass: ArcEndpointHorizontalConstraint,
        serialize: (c) => ({ a: geometryId(c.a), endpointA: c.endpointA, b: geometryId(c.b), endpointB: c.endpointB, enabled: c.enabled }),
        deserialize: (data, refs) => new ArcEndpointHorizontalConstraint(refs.primitive(data.a), data.endpointA === "end" ? "end" : "start", refs.primitive(data.b), data.endpointB === "end" ? "end" : "start"),
      },
      {
        type: "arcEndpointVertical",
        constraintClass: ArcEndpointVerticalConstraint,
        serialize: (c) => ({ a: geometryId(c.a), endpointA: c.endpointA, b: geometryId(c.b), endpointB: c.endpointB, enabled: c.enabled }),
        deserialize: (data, refs) => new ArcEndpointVerticalConstraint(refs.primitive(data.a), data.endpointA === "end" ? "end" : "start", refs.primitive(data.b), data.endpointB === "end" ? "end" : "start"),
      },
      {
        type: "symmetry",
        constraintClass: SymmetryConstraint,
        serialize: (c) => ({ p1: geometryId(c.p1), p2: geometryId(c.p2), axis: geometryId(c.axis), enabled: c.enabled }),
        deserialize: (data, refs) => new SymmetryConstraint(refs.point(data.p1), refs.point(data.p2), refs.line(data.axis)),
      },
      {
        type: "lineSymmetry",
        constraintClass: LineSymmetryConstraint,
        serialize: (c) => ({ line1: geometryId(c.line1), line2: geometryId(c.line2), axis: geometryId(c.axis), reversed: c.reversed, enabled: c.enabled }),
        deserialize: (data, refs) => new LineSymmetryConstraint(refs.line(data.line1), refs.line(data.line2), refs.line(data.axis), typeof data.reversed === "boolean" ? data.reversed : null),
      },
      {
        type: "arcSymmetry",
        constraintClass: ArcSymmetryConstraint,
        serialize: (c) => ({ arc1: geometryId(c.arc1), arc2: geometryId(c.arc2), axis: geometryId(c.axis), enabled: c.enabled }),
        deserialize: (data, refs) => new ArcSymmetryConstraint(refs.primitive(data.arc1), refs.primitive(data.arc2), refs.line(data.axis)),
      },
      {
        type: "parallel",
        constraintClass: ParallelConstraint,
        serialize: (c) => ({ line1: geometryId(c.line1), line2: geometryId(c.line2), enabled: c.enabled }),
        deserialize: (data, refs) => new ParallelConstraint(refs.line(data.line1), refs.line(data.line2)),
      },
      {
        type: "perpendicular",
        constraintClass: PerpendicularConstraint,
        serialize: (c) => ({ line1: geometryId(c.line1), line2: geometryId(c.line2), enabled: c.enabled }),
        deserialize: (data, refs) => new PerpendicularConstraint(refs.line(data.line1), refs.line(data.line2)),
      },
      {
        type: "collinear",
        constraintClass: CollinearConstraint,
        serialize: (c) => ({ line1: geometryId(c.line1), line2: geometryId(c.line2), enabled: c.enabled }),
        deserialize: (data, refs) => new CollinearConstraint(refs.line(data.line1), refs.line(data.line2)),
      },
      {
        type: "equalLength",
        constraintClass: EqualLengthConstraint,
        serialize: (c) => ({ line1: geometryId(c.line1), line2: geometryId(c.line2), enabled: c.enabled }),
        deserialize: (data, refs) => new EqualLengthConstraint(refs.line(data.line1), refs.line(data.line2)),
      },
      {
        type: "radiusDimension",
        constraintClass: RadiusConstraint,
        serialize: (c) => ({ primitive: geometryId(c.primitive), target: c.target, dimension: dimensionData(c), enabled: c.enabled }),
        deserialize: (data, refs) => new RadiusConstraint(refs.primitive(data.primitive), Number(data.target)),
      },
      {
        type: "diameterDimension",
        constraintClass: DiameterConstraint,
        serialize: (c) => ({ primitive: geometryId(c.primitive), target: c.target, dimension: dimensionData(c), enabled: c.enabled }),
        deserialize: (data, refs) => new DiameterConstraint(refs.primitive(data.primitive), Number(data.target)),
      },
      {
        type: "concentric",
        constraintClass: ConcentricConstraint,
        serialize: (c) => ({ a: geometryId(c.a), b: geometryId(c.b), enabled: c.enabled }),
        deserialize: (data, refs) => new ConcentricConstraint(refs.pointOrPrimitive(data.a), refs.pointOrPrimitive(data.b)),
      },
      {
        type: "equalRadius",
        constraintClass: EqualRadiusConstraint,
        serialize: (c) => ({ a: geometryId(c.a), b: geometryId(c.b), enabled: c.enabled }),
        deserialize: (data, refs) => new EqualRadiusConstraint(refs.primitive(data.a), refs.primitive(data.b)),
      },
      {
        type: "pointOnCircle",
        constraintClass: PointOnCircleConstraint,
        serialize: (c) => ({ point: geometryId(c.point), primitive: geometryId(c.primitive), enabled: c.enabled }),
        deserialize: (data, refs) => new PointOnCircleConstraint(refs.point(data.point), refs.primitive(data.primitive)),
      },
      {
        type: "arcEndpointOnCircle",
        constraintClass: ArcEndpointOnCircleConstraint,
        serialize: (c) => ({ arc: geometryId(c.arc), endpoint: c.endpoint, primitive: geometryId(c.primitive), enabled: c.enabled }),
        deserialize: (data, refs) => new ArcEndpointOnCircleConstraint(refs.primitive(data.arc), data.endpoint === "end" ? "end" : "start", refs.primitive(data.primitive)),
      },
      {
        type: "lineCircleTangent",
        constraintClass: LineCircleTangentConstraint,
        serialize: (c) => ({ line: geometryId(c.line), primitive: geometryId(c.primitive), sign: c.sign, enabled: c.enabled }),
        deserialize: (data, refs) => new LineCircleTangentConstraint(refs.line(data.line), refs.primitive(data.primitive), Number(data.sign) || null),
      },
      {
        type: "circleCircleTangent",
        constraintClass: CircleCircleTangentConstraint,
        serialize: (c) => ({ a: geometryId(c.a), b: geometryId(c.b), mode: c.mode, enabled: c.enabled }),
        deserialize: (data, refs) => new CircleCircleTangentConstraint(refs.primitive(data.a), refs.primitive(data.b), data.mode === "internal" ? "internal" : "external"),
      },
      {
        type: "pointOnSpline",
        constraintClass: PointOnSplineConstraint,
        serialize: (c) => ({ point: geometryId(c.point), spline: geometryId(c.spline), parameter: c.parameter, enabled: c.enabled }),
        deserialize: (data, refs) => new PointOnSplineConstraint(refs.point(data.point), refs.spline(data.spline), Number(data.parameter)),
      },
      {
        type: "splineLineTangent",
        constraintClass: SplineLineTangentConstraint,
        serialize: (c) => ({ spline: geometryId(c.spline), endpoint: c.endpoint, line: geometryId(c.line), enabled: c.enabled }),
        deserialize: (data, refs) => new SplineLineTangentConstraint(refs.spline(data.spline), data.endpoint === "end" ? "end" : "start", refs.line(data.line)),
      },
      {
        type: "splineSplineTangent",
        constraintClass: SplineSplineTangentConstraint,
        serialize: (c) => ({ a: geometryId(c.a), endpointA: c.endpointA, b: geometryId(c.b), endpointB: c.endpointB, enabled: c.enabled }),
        deserialize: (data, refs) => new SplineSplineTangentConstraint(refs.spline(data.a), data.endpointA === "end" ? "end" : "start", refs.spline(data.b), data.endpointB === "end" ? "end" : "start"),
      },
    ]);

    function deserializeConstraint(data, pointById, lineById, primitiveById, dimensionAppearanceLoader = normalizeDimensionAppearance, expressionLoader = (value) => String(value)) {
      const resolveStoredGeometry = (kind, storedId) => resolveGeometryRefValue(
        parseGeometryRefId(kind, String(storedId)),
        (resolvedKind, canonicalId) => {
          if (resolvedKind === "point") return pointById.get(canonicalId);
          if (resolvedKind === "line") return lineById.get(canonicalId);
          const primitiveValue = primitiveById.get(canonicalId);
          if (resolvedKind === "circle") return primitiveValue instanceof Circle ? primitiveValue : null;
          if (resolvedKind === "arc") return primitiveValue instanceof Arc ? primitiveValue : null;
          if (resolvedKind === "spline") return primitiveValue instanceof Spline ? primitiveValue : null;
          return null;
        },
      );
      const primitiveValue = (id) => resolveStoredGeometry("circle", id) || resolveStoredGeometry("arc", id);
      const splineValue = (id) => resolveStoredGeometry("spline", id);
      const point = (id) => {
        const p = resolveStoredGeometry("point", id);
        if (!p) throw new Error(`点 ${id} が見つかりません`);
        return p;
      };
      const line = (id) => {
        const l = resolveStoredGeometry("line", id);
        if (!l) throw new Error(`線 ${id} が見つかりません`);
        return l;
      };
      const primitive = (id) => {
        const p = primitiveValue(id);
        if (!p) throw new Error(`円/円弧 ${id} が見つかりません`);
        return p;
      };
      const spline = (id) => {
        const value = splineValue(id);
        if (!value) throw new Error(`スプライン ${id} が見つかりません`);
        return value;
      };
      const geometry = (kind, id) => {
        const value = resolveStoredGeometry(String(kind || ""), id);
        if (!value) throw new Error(`Geometry ${kind}:${id} が見つかりません`);
        return value;
      };
      const pointOrPrimitive = (id) => resolveStoredGeometry("point", id) || primitive(id);
      const lineOrPrimitive = (id) => resolveStoredGeometry("line", id) || primitiveValue(id);
      const constraint = constraintCodecs.deserialize(data, { point, line, primitive, spline, geometry, pointOrPrimitive, lineOrPrimitive });

      if (constraint) {
        constraint.enabled = data.enabled !== false;
        constraint.readOnlyDimension = Boolean(data.readOnlyDimension);
        if (constraint.readOnlyDimension) constraint.enabled = false;
        if (isDimensionConstraint(constraint)) {
          constraint.parameterName = typeof data.parameterName === "string" ? data.parameterName : null;
          if (!constraint.readOnlyDimension && typeof data.expression === "string") constraint.expression = expressionLoader(data.expression);
        }
        if (data.dimension && Number.isFinite(Number(data.dimension.x)) && Number.isFinite(Number(data.dimension.y))) {
          constraint.dimension = {
            x: Number(data.dimension.x),
            y: Number(data.dimension.y),
            offsetU: data.dimension.offsetU != null && Number.isFinite(Number(data.dimension.offsetU)) ? Number(data.dimension.offsetU) : NaN,
            offsetN: data.dimension.offsetN != null && Number.isFinite(Number(data.dimension.offsetN)) ? Number(data.dimension.offsetN) : NaN,
            labelOffsetU: Number.isFinite(Number(data.dimension.labelOffsetU)) ? Number(data.dimension.labelOffsetU) : 0,
            labelX: Number.isFinite(Number(data.dimension.labelX)) ? Number(data.dimension.labelX) : NaN,
            labelY: Number.isFinite(Number(data.dimension.labelY)) ? Number(data.dimension.labelY) : NaN,
            axis: data.dimension.axis || null,
            angleStartFlip: Number.isInteger(data.dimension.angleStartFlip) ? data.dimension.angleStartFlip : null,
            angleEndFlip: Number.isInteger(data.dimension.angleEndFlip) ? data.dimension.angleEndFlip : null,
            angleRadius: Number.isFinite(Number(data.dimension.angleRadius)) ? Number(data.dimension.angleRadius) : NaN,
            angleLabelOffsetR: data.dimension.angleLabelOffsetR != null && Number.isFinite(Number(data.dimension.angleLabelOffsetR)) ? Number(data.dimension.angleLabelOffsetR) : NaN,
            angleLabelOffsetT: data.dimension.angleLabelOffsetT != null && Number.isFinite(Number(data.dimension.angleLabelOffsetT)) ? Number(data.dimension.angleLabelOffsetT) : NaN,
            angleLabelPlacementVersion: Number.isInteger(data.dimension.angleLabelPlacementVersion) ? data.dimension.angleLabelPlacementVersion : null,
          };
          if (data.dimension.display) constraint.dimension.display = dimensionAppearanceLoader(data.dimension.display);
          if (constraint instanceof LineAngleConstraint && !Number.isInteger(data.startFlip) && Number.isInteger(constraint.dimension.angleStartFlip)) {
            constraint.startFlip = constraint.dimension.angleStartFlip ? 1 : 0;
            constraint.endFlip = constraint.dimension.angleEndFlip ? 1 : 0;
          }
        }
      }
      return constraint;
    }
    return Object.freeze({ serialize: constraintCodecs.serialize, deserialize: deserializeConstraint, types: constraintCodecs.types });
  }
  window.ConstraintPersistence = Object.freeze({ create, isDimensionConstraint });
})();
