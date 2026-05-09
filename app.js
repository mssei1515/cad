/* app.js: Canvas UI and event handling */
(function () {
  "use strict";

  const {
    hypot2,
    vectorNorm,
    MIN_ORIENTATION_LENGTH,
    Point,
    Line,
    Circle,
    Arc,
    DistanceConstraint,
    PointAxisDistanceConstraint,
    PointLineDistanceConstraint,
    LineLineDistanceConstraint,
    signedPointLineDistance,
    CoincidentConstraint,
    ArcEndpointCoincidentConstraint,
    ArcEndpointArcEndpointCoincidentConstraint,
    PointOnLineConstraint,
    ArcEndpointOnLineConstraint,
    ArcEndpointFixedConstraint,
    LineFixedConstraint,
    HorizontalConstraint,
    VerticalConstraint,
    ParallelConstraint,
    PerpendicularConstraint,
    CollinearConstraint,
    EqualLengthConstraint,
    RadiusConstraint,
    DiameterConstraint,
    ConcentricConstraint,
    EqualRadiusConstraint,
    PointOnCircleConstraint,
    ArcEndpointOnCircleConstraint,
    LineCircleTangentConstraint,
    CircleCircleTangentConstraint,
    DragConstraint,
    ParameterDragConstraint,
    ConstraintSolver,
  } = window.GeometrySolver;

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const dimensionValueInput = document.getElementById("dimensionValueInput");
  const model = { points: [], lines: [], circles: [], arcs: [], constraints: [] };
  const solver = new ConstraintSolver(model);

  let mode = "select";
  let selectedPoints = [];
  let selectedLines = [];
  let selectedCircles = [];
  let selectedArcs = [];
  let dragSession = null;
  let dimensionDragSession = null;
  let hoveredPoint = null;
  let hoveredEndpointPoint = null;
  let hoveredLine = null;
  let hoveredCircle = null;
  let hoveredArc = null;
  let hoveredArcEndpoint = null;
  let hoveredDimensionConstraint = null;
  let selectedArcEndpoint = null;
  let selectedArcEndpointPair = null;
  let selectedDimensionConstraint = null;
  let constraintAnalysisState = null;
  let panSession = null;
  let selectionRectSession = null;
  let lineStartPoint = null;
  let rectangleStartPoint = null;
  let filletFirstLine = null;
  let circleCenterPoint = null;
  let arcCenterPoint = null;
  let arcStartPoint = null;
  let pointerPreview = null;
  let activeSnap = null;
  let pendingCommand = null;
  let pendingConstraintCommand = null;
  let pointSeq = 1;
  let lineSeq = 1;
  let circleSeq = 1;
  let arcSeq = 1;
  const viewport = { x: 0, y: 0, scale: 1 };
  const MIN_ZOOM = 0.15;
  const MAX_ZOOM = 8;
  const CONSTRAINT_ACCEPT_ERROR = 1e-4;
  const DEFAULT_FILLET_RADIUS = 30;
  const MIN_LINE_LENGTH = Math.max(MIN_ORIENTATION_LENGTH, solver.minLineLength || 12);
  const MIN_ARC_LENGTH = MIN_LINE_LENGTH;
  const CONSTRAINT_STATUS_COLORS = {
    full: "#111827",
    under: "#f59e0b",
    conflict: "#dc2626",
  };
  let lastLoadLineRepairMessage = "";

  const constraintButtons = Array.from(document.querySelectorAll("[data-constraint]"));
  const fixPointBtn = document.getElementById("fixPointBtn");

  for (const btn of document.querySelectorAll("button[aria-label]")) {
    btn.dataset.tooltip = btn.getAttribute("aria-label");
  }

  function log(msg) {
    const el = document.getElementById("log");
    el.textContent = `${msg}\n` + el.textContent;
  }

  function setHint(msg, kind = "normal") {
    const el = document.getElementById("hint");
    el.textContent = msg;
    el.classList.toggle("error", kind === "error");
  }

  function solveAndRefresh(label = "自動solve") {
    const result = solver.solve();
    normalizeArcSweeps();
    const analysis = refreshConstraintAnalysis();
    const statusKind = result.success && analysis.analysis.stable ? "normal" : "error";
    setHint(`${label}: success=${result.success}, error=${result.errorNorm.toExponential(2)}, iter=${result.iterations} / ${constraintSummaryText()}`, statusKind);
    updateUI();
    draw();
    return result;
  }

  function geometryErrorNorm() {
    return vectorNorm(solver.computeErrorVector());
  }

  function pointHasConstraintFreedom(point, analysis) {
    if (point.fixed) return false;
    const freedom = analysis.variableFreedom.get(point);
    return Boolean(freedom?.x || freedom?.y);
  }

  function objectHasConstraintFreedom(object, prop, analysis) {
    return Boolean(analysis.variableFreedom.get(object)?.[prop]);
  }

  function classifyConstraintStatus(item, kind, analysis) {
    if (!analysis.stable) return "conflict";
    if (kind === "point") return pointHasConstraintFreedom(item, analysis) ? "under" : "full";
    if (kind === "line") return pointHasConstraintFreedom(item.p1, analysis) || pointHasConstraintFreedom(item.p2, analysis) ? "under" : "full";
    if (kind === "circle") return pointHasConstraintFreedom(item.center, analysis) || objectHasConstraintFreedom(item, "radiusValue", analysis) ? "under" : "full";
    if (kind === "arc") {
      return pointHasConstraintFreedom(item.center, analysis) ||
        objectHasConstraintFreedom(item, "radiusValue", analysis) ||
        objectHasConstraintFreedom(item, "startAngle", analysis) ||
        objectHasConstraintFreedom(item, "endAngle", analysis)
        ? "under"
        : "full";
    }
    return "full";
  }

  function refreshConstraintAnalysis() {
    const analysis = solver.analyzeConstraintState({ errorTolerance: CONSTRAINT_ACCEPT_ERROR });
    const statuses = new Map();
    const items = [];
    for (const p of model.points) {
      const status = classifyConstraintStatus(p, "point", analysis);
      statuses.set(p, status);
      if (isExplicitPoint(p)) items.push(status);
    }
    for (const l of model.lines) {
      const status = classifyConstraintStatus(l, "line", analysis);
      statuses.set(l, status);
      items.push(status);
    }
    for (const c of model.circles) {
      const status = classifyConstraintStatus(c, "circle", analysis);
      statuses.set(c, status);
      items.push(status);
    }
    for (const a of model.arcs) {
      const status = classifyConstraintStatus(a, "arc", analysis);
      statuses.set(a, status);
      items.push(status);
    }
    const summary = {
      full: items.filter((status) => status === "full").length,
      under: items.filter((status) => status === "under").length,
      conflict: items.filter((status) => status === "conflict").length,
      total: items.length,
    };
    constraintAnalysisState = { analysis, statuses, summary };
    return constraintAnalysisState;
  }

  function constraintStatusOf(item) {
    if (!constraintAnalysisState) refreshConstraintAnalysis();
    return constraintAnalysisState?.statuses.get(item) || "full";
  }

  function constraintStatusColor(item, selected = false, hovered = false) {
    const status = constraintStatusOf(item);
    if (status === "conflict") return CONSTRAINT_STATUS_COLORS.conflict;
    if (selected || hovered) return "#2563eb";
    return CONSTRAINT_STATUS_COLORS[status] || CONSTRAINT_STATUS_COLORS.full;
  }

  function constraintStatusBadge(status) {
    if (status === "conflict") return "矛盾";
    if (status === "under") return "未拘束";
    return "完全拘束";
  }

  function constraintSummaryText() {
    if (!constraintAnalysisState) refreshConstraintAnalysis();
    const s = constraintAnalysisState?.summary || { full: 0, under: 0, conflict: 0 };
    return `完全拘束: ${s.full} / 未拘束: ${s.under} / 矛盾: ${s.conflict}`;
  }

  function addPoint(x, y, fixed = false, kind = "explicit") {
    const p = new Point(`P${pointSeq++}`, x, y, fixed, kind);
    model.points.push(p);
    return p;
  }

  function addLine(p1, p2) {
    if (p1 === p2) return null;
    const l = new Line(`L${lineSeq++}`, p1, p2);
    ensureLineMinimumLength(l);
    model.lines.push(l);
    return l;
  }

  function preferredDirectionFrom(start, p) {
    const dx = p.x - start.x;
    const dy = p.y - start.y;
    const len = hypot2(dx, dy);
    if (len >= MIN_LINE_LENGTH) return { x: dx / len, y: dy / len };
    if (len > 1e-9) return { x: dx / len, y: dy / len };
    return { x: 1, y: 0 };
  }

  function pointAtMinimumDistance(start, p) {
    const dx = p.x - start.x;
    const dy = p.y - start.y;
    const len = hypot2(dx, dy);
    if (len >= MIN_LINE_LENGTH) return p;
    const dir = preferredDirectionFrom(start, p);
    return { x: start.x + dir.x * MIN_LINE_LENGTH, y: start.y + dir.y * MIN_LINE_LENGTH };
  }

  function ensureLineMinimumLength(line, preferred = null) {
    if (!line) return { changed: false, failed: false };
    const dx = line.p2.x - line.p1.x;
    const dy = line.p2.y - line.p1.y;
    const len = hypot2(dx, dy);
    if (len >= MIN_LINE_LENGTH) return { changed: false, failed: false };
    const fallback = preferred || (len > 1e-9 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 });
    const dirLen = hypot2(fallback.x, fallback.y);
    const dir = dirLen > 1e-9 ? { x: fallback.x / dirLen, y: fallback.y / dirLen } : { x: 1, y: 0 };
    if (!line.p2.fixed) {
      line.p2.x = line.p1.x + dir.x * MIN_LINE_LENGTH;
      line.p2.y = line.p1.y + dir.y * MIN_LINE_LENGTH;
      return { changed: true, failed: false };
    }
    if (!line.p1.fixed) {
      line.p1.x = line.p2.x - dir.x * MIN_LINE_LENGTH;
      line.p1.y = line.p2.y - dir.y * MIN_LINE_LENGTH;
      return { changed: true, failed: false };
    }
    return { changed: false, failed: true };
  }

  function enforceMinimumLineLengths(lines = model.lines) {
    let changed = 0;
    let failed = 0;
    for (const line of lines) {
      const result = ensureLineMinimumLength(line);
      if (result.changed) changed += 1;
      if (result.failed) failed += 1;
    }
    return { changed, failed };
  }

  function addCircle(center, radiusValue) {
    if (!center || !Number.isFinite(radiusValue) || radiusValue < MIN_ORIENTATION_LENGTH) return null;
    const c = new Circle(`C${circleSeq++}`, center, radiusValue);
    model.circles.push(c);
    return c;
  }

  function addArc(center, radiusValue, startAngle, endAngle) {
    if (!center || !Number.isFinite(radiusValue) || radiusValue < MIN_ORIENTATION_LENGTH) return null;
    if (!Number.isFinite(startAngle) || !Number.isFinite(endAngle)) return null;
    const a = new Arc(`A${arcSeq++}`, center, radiusValue, startAngle, endAngle);
    normalizeArcSweep(a);
    model.arcs.push(a);
    return a;
  }

  function snapshotModelState() {
    return {
      points: model.points.map((p) => ({ point: p, x: p.x, y: p.y, fixed: p.fixed })),
      circles: model.circles.map((c) => ({ circle: c, radiusValue: c.radiusValue })),
      arcs: model.arcs.map((a) => ({ arc: a, radiusValue: a.radiusValue, startAngle: a.startAngle, endAngle: a.endAngle })),
      constraintLength: model.constraints.length,
    };
  }

  function restoreModelState(snapshot) {
    for (const p of snapshot.points) {
      p.point.x = p.x;
      p.point.y = p.y;
      p.point.fixed = p.fixed;
    }
    for (const c of snapshot.circles || []) c.circle.radiusValue = c.radiusValue;
    for (const a of snapshot.arcs || []) {
      a.arc.radiusValue = a.radiusValue;
      a.arc.startAngle = a.startAngle;
      a.arc.endAngle = a.endAngle;
    }
    model.constraints.length = snapshot.constraintLength;
  }

  function resetModelState() {
    model.points.length = 0;
    model.lines.length = 0;
    model.circles.length = 0;
    model.arcs.length = 0;
    model.constraints.length = 0;
    clearSelection();
    dragSession = null;
    dimensionDragSession = null;
    panSession = null;
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    pendingCommand = null;
    pendingConstraintCommand = null;
    hoveredPoint = null;
    hoveredEndpointPoint = null;
    hoveredLine = null;
    hoveredCircle = null;
    hoveredArc = null;
    hoveredArcEndpoint = null;
    hoveredDimensionConstraint = null;
    clearSnap();
    selectedArcEndpoint = null;
    selectedArcEndpointPair = null;
    selectedDimensionConstraint = null;
    pointSeq = 1;
    lineSeq = 1;
    circleSeq = 1;
    arcSeq = 1;
  }

  function nextSeq(items, prefix) {
    const max = items.reduce((n, item) => {
      const match = String(item.id).match(new RegExp(`^${prefix}(\\d+)$`));
      return match ? Math.max(n, Number(match[1])) : n;
    }, 0);
    return max + 1;
  }

  function serializeDimension(dimension, target = null) {
    if (!dimension) return null;
    const anchor = target ? dimensionAnchor(target, dimension) : dimension;
    const axis = target ? storedDimensionAxis(target, dimension) : dimension.axis || null;
    return {
      x: Number(anchor.x),
      y: Number(anchor.y),
      offsetU: Number.isFinite(dimension.offsetU) ? dimension.offsetU : null,
      offsetN: Number.isFinite(dimension.offsetN) ? dimension.offsetN : null,
      labelOffsetU: Number.isFinite(dimension.labelOffsetU) ? dimension.labelOffsetU : 0,
      axis,
    };
  }

  function serializeConstraint(c) {
    if (c instanceof PointAxisDistanceConstraint) {
      return { type: "pointAxisDistance", p1: c.p1.id, p2: c.p2.id, axis: c.axis, sign: c.sign, target: c.target, dimension: serializeDimension(c.dimension, targetFromConstraint(c)), enabled: c.enabled };
    }
    if (c instanceof DistanceConstraint) {
      return { type: "distance", p1: c.p1.id, p2: c.p2.id, target: c.target, dimension: serializeDimension(c.dimension, targetFromConstraint(c)), enabled: c.enabled };
    }
    if (c instanceof PointLineDistanceConstraint) {
      return {
        type: "pointLineDistance",
        point: c.point.id,
        line: c.line.id,
        target: c.target,
        sign: c.sign,
        dimension: serializeDimension(c.dimension, targetFromConstraint(c)),
        enabled: c.enabled,
      };
    }
    if (c instanceof LineLineDistanceConstraint) {
      return {
        type: "lineLineDistance",
        line1: c.line1.id,
        line2: c.line2.id,
        target: c.target,
        sign: c.sign,
        dimension: serializeDimension(c.dimension, targetFromConstraint(c)),
        enabled: c.enabled,
      };
    }
    if (c instanceof CoincidentConstraint) {
      return { type: "coincident", p1: c.p1.id, p2: c.p2.id, enabled: c.enabled };
    }
    if (c instanceof ArcEndpointCoincidentConstraint) {
      return { type: "arcEndpointCoincident", arc: c.arc.id, endpoint: c.endpoint, point: c.point.id, enabled: c.enabled };
    }
    if (c instanceof ArcEndpointArcEndpointCoincidentConstraint) {
      return { type: "arcEndpointArcEndpointCoincident", a: c.a.id, endpointA: c.endpointA, b: c.b.id, endpointB: c.endpointB, enabled: c.enabled };
    }
    if (c instanceof PointOnLineConstraint) {
      return { type: "pointOnLine", point: c.point.id, line: c.line.id, enabled: c.enabled };
    }
    if (c instanceof ArcEndpointOnLineConstraint) {
      return { type: "arcEndpointOnLine", arc: c.arc.id, endpoint: c.endpoint, line: c.line.id, enabled: c.enabled };
    }
    if (c instanceof ArcEndpointFixedConstraint) {
      return { type: "arcEndpointFixed", arc: c.arc.id, endpoint: c.endpoint, x: c.x, y: c.y, enabled: c.enabled };
    }
    if (c instanceof LineFixedConstraint) {
      return { type: "lineFixed", line: c.line.id, p1x: c.p1x, p1y: c.p1y, p2x: c.p2x, p2y: c.p2y, enabled: c.enabled };
    }
    if (c instanceof HorizontalConstraint) {
      return { type: "horizontal", line: c.line.id, enabled: c.enabled };
    }
    if (c instanceof VerticalConstraint) {
      return { type: "vertical", line: c.line.id, enabled: c.enabled };
    }
    if (c instanceof ParallelConstraint) {
      return { type: "parallel", line1: c.line1.id, line2: c.line2.id, enabled: c.enabled };
    }
    if (c instanceof PerpendicularConstraint) {
      return { type: "perpendicular", line1: c.line1.id, line2: c.line2.id, enabled: c.enabled };
    }
    if (c instanceof CollinearConstraint) {
      return { type: "collinear", line1: c.line1.id, line2: c.line2.id, enabled: c.enabled };
    }
    if (c instanceof EqualLengthConstraint) {
      return { type: "equalLength", line1: c.line1.id, line2: c.line2.id, enabled: c.enabled };
    }
    if (c instanceof RadiusConstraint) {
      return { type: "radiusDimension", primitive: c.primitive.id, target: c.target, dimension: serializeDimension(c.dimension, targetFromConstraint(c)), enabled: c.enabled };
    }
    if (c instanceof DiameterConstraint) {
      return { type: "diameterDimension", primitive: c.primitive.id, target: c.target, dimension: serializeDimension(c.dimension, targetFromConstraint(c)), enabled: c.enabled };
    }
    if (c instanceof ConcentricConstraint) {
      return { type: "concentric", a: c.a.id, b: c.b.id, enabled: c.enabled };
    }
    if (c instanceof EqualRadiusConstraint) {
      return { type: "equalRadius", a: c.a.id, b: c.b.id, enabled: c.enabled };
    }
    if (c instanceof PointOnCircleConstraint) {
      return { type: "pointOnCircle", point: c.point.id, primitive: c.primitive.id, enabled: c.enabled };
    }
    if (c instanceof ArcEndpointOnCircleConstraint) {
      return { type: "arcEndpointOnCircle", arc: c.arc.id, endpoint: c.endpoint, primitive: c.primitive.id, enabled: c.enabled };
    }
    if (c instanceof LineCircleTangentConstraint) {
      return { type: "lineCircleTangent", line: c.line.id, primitive: c.primitive.id, sign: c.sign, enabled: c.enabled };
    }
    if (c instanceof CircleCircleTangentConstraint) {
      return { type: "circleCircleTangent", a: c.a.id, b: c.b.id, mode: c.mode, enabled: c.enabled };
    }
    return null;
  }

  function serializeModel() {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      points: model.points.map((p) => ({ id: p.id, x: p.x, y: p.y, fixed: p.fixed, kind: p.kind || (isPointUsedByPrimitive(p) ? "endpoint" : "explicit") })),
      lines: model.lines.map((l) => ({ id: l.id, p1: l.p1.id, p2: l.p2.id })),
      circles: model.circles.map((c) => ({ id: c.id, center: c.center.id, radius: c.radius() })),
      arcs: model.arcs.map((a) => ({ id: a.id, center: a.center.id, radius: a.radius(), startAngle: a.startAngle, endAngle: a.endAngle })),
      constraints: model.constraints.map(serializeConstraint).filter(Boolean),
    };
  }

  function deserializeConstraint(data, pointById, lineById, primitiveById) {
    const point = (id) => {
      const p = pointById.get(String(id));
      if (!p) throw new Error(`点 ${id} が見つかりません`);
      return p;
    };
    const line = (id) => {
      const l = lineById.get(String(id));
      if (!l) throw new Error(`線 ${id} が見つかりません`);
      return l;
    };
    const primitive = (id) => {
      const p = primitiveById.get(String(id));
      if (!p) throw new Error(`円/円弧 ${id} が見つかりません`);
      return p;
    };
    const pointOrPrimitive = (id) => pointById.get(String(id)) || primitive(id);

    let constraint = null;
    if (data.type === "distance") {
      constraint = new DistanceConstraint(point(data.p1), point(data.p2), Number(data.target));
    } else if (data.type === "pointAxisDistance") {
      constraint = new PointAxisDistanceConstraint(point(data.p1), point(data.p2), Number(data.target), data.axis === "y" ? "y" : "x", Number(data.sign) || null);
    } else if (data.type === "pointLineDistance") {
      constraint = new PointLineDistanceConstraint(point(data.point), line(data.line), Number(data.target), Number(data.sign) || null);
    } else if (data.type === "lineLineDistance") {
      constraint = new LineLineDistanceConstraint(line(data.line1), line(data.line2), Number(data.target), Number(data.sign) || null);
    } else if (data.type === "coincident") {
      constraint = new CoincidentConstraint(point(data.p1), point(data.p2));
    } else if (data.type === "arcEndpointCoincident") {
      constraint = new ArcEndpointCoincidentConstraint(primitive(data.arc), data.endpoint === "end" ? "end" : "start", point(data.point));
    } else if (data.type === "arcEndpointArcEndpointCoincident") {
      constraint = new ArcEndpointArcEndpointCoincidentConstraint(primitive(data.a), data.endpointA === "end" ? "end" : "start", primitive(data.b), data.endpointB === "end" ? "end" : "start");
    } else if (data.type === "pointOnLine") {
      constraint = new PointOnLineConstraint(point(data.point), line(data.line));
    } else if (data.type === "arcEndpointOnLine") {
      constraint = new ArcEndpointOnLineConstraint(primitive(data.arc), data.endpoint === "end" ? "end" : "start", line(data.line));
    } else if (data.type === "arcEndpointFixed") {
      constraint = new ArcEndpointFixedConstraint(primitive(data.arc), data.endpoint === "end" ? "end" : "start", Number(data.x), Number(data.y));
    } else if (data.type === "lineFixed") {
      constraint = new LineFixedConstraint(line(data.line), Number(data.p1x), Number(data.p1y), Number(data.p2x), Number(data.p2y));
    } else if (data.type === "horizontal") {
      constraint = new HorizontalConstraint(line(data.line));
    } else if (data.type === "vertical") {
      constraint = new VerticalConstraint(line(data.line));
    } else if (data.type === "parallel") {
      constraint = new ParallelConstraint(line(data.line1), line(data.line2));
    } else if (data.type === "perpendicular") {
      constraint = new PerpendicularConstraint(line(data.line1), line(data.line2));
    } else if (data.type === "collinear") {
      constraint = new CollinearConstraint(line(data.line1), line(data.line2));
    } else if (data.type === "equalLength") {
      constraint = new EqualLengthConstraint(line(data.line1), line(data.line2));
    } else if (data.type === "radiusDimension") {
      constraint = new RadiusConstraint(primitive(data.primitive), Number(data.target));
    } else if (data.type === "diameterDimension") {
      constraint = new DiameterConstraint(primitive(data.primitive), Number(data.target));
    } else if (data.type === "concentric") {
      constraint = new ConcentricConstraint(pointOrPrimitive(data.a), pointOrPrimitive(data.b));
    } else if (data.type === "equalRadius") {
      constraint = new EqualRadiusConstraint(primitive(data.a), primitive(data.b));
    } else if (data.type === "pointOnCircle") {
      constraint = new PointOnCircleConstraint(point(data.point), primitive(data.primitive));
    } else if (data.type === "arcEndpointOnCircle") {
      constraint = new ArcEndpointOnCircleConstraint(primitive(data.arc), data.endpoint === "end" ? "end" : "start", primitive(data.primitive));
    } else if (data.type === "lineCircleTangent") {
      constraint = new LineCircleTangentConstraint(line(data.line), primitive(data.primitive), Number(data.sign) || null);
    } else if (data.type === "circleCircleTangent") {
      constraint = new CircleCircleTangentConstraint(primitive(data.a), primitive(data.b), data.mode === "internal" ? "internal" : "external");
    }

    if (constraint) {
      constraint.enabled = data.enabled !== false;
      if (data.dimension && Number.isFinite(Number(data.dimension.x)) && Number.isFinite(Number(data.dimension.y))) {
        constraint.dimension = {
          x: Number(data.dimension.x),
          y: Number(data.dimension.y),
          offsetU: Number.isFinite(Number(data.dimension.offsetU)) ? Number(data.dimension.offsetU) : NaN,
          offsetN: Number.isFinite(Number(data.dimension.offsetN)) ? Number(data.dimension.offsetN) : NaN,
          labelOffsetU: Number.isFinite(Number(data.dimension.labelOffsetU)) ? Number(data.dimension.labelOffsetU) : 0,
          axis: data.dimension.axis || null,
        };
      }
    }
    return constraint;
  }

  function loadModelData(data) {
    if (!data || !Array.isArray(data.points) || !Array.isArray(data.lines) || !Array.isArray(data.constraints)) {
      throw new Error("保存データの形式が正しくありません");
    }

    const pointById = new Map();
    const points = [];
    const hasPointKind = data.points.some((p) => p.kind === "explicit" || p.kind === "endpoint");
    for (const p of data.points) {
      const point = new Point(String(p.id), Number(p.x), Number(p.y), Boolean(p.fixed), p.kind === "endpoint" ? "endpoint" : "explicit");
      points.push(point);
      pointById.set(point.id, point);
    }

    const lineById = new Map();
    const lines = [];
    for (const l of data.lines) {
      const p1 = pointById.get(String(l.p1));
      const p2 = pointById.get(String(l.p2));
      if (!p1 || !p2) throw new Error(`線 ${l.id} の端点が見つかりません`);
      const line = new Line(String(l.id), p1, p2);
      if (!hasPointKind) {
        p1.kind = "endpoint";
        p2.kind = "endpoint";
      }
      lines.push(line);
      lineById.set(line.id, line);
    }

    const circles = [];
    for (const c of data.circles || []) {
      const center = pointById.get(String(c.center));
      if (!center) throw new Error(`円 ${c.id} の中心点が見つかりません`);
      center.kind = "endpoint";
      let radius = Number(c.radius);
      if (!Number.isFinite(radius) && c.radiusPoint !== undefined) {
        const radiusPoint = pointById.get(String(c.radiusPoint));
        if (!radiusPoint) throw new Error(`円 ${c.id} の参照点が見つかりません`);
        radius = hypot2(radiusPoint.x - center.x, radiusPoint.y - center.y);
        if (!hasPointKind) radiusPoint.kind = "endpoint";
      }
      if (!Number.isFinite(radius) || radius < MIN_ORIENTATION_LENGTH) throw new Error(`円 ${c.id} の半径が正しくありません`);
      circles.push(new Circle(String(c.id), center, radius));
    }

    const arcs = [];
    for (const a of data.arcs || []) {
      const center = pointById.get(String(a.center));
      if (!center) throw new Error(`円弧 ${a.id} の中心点が見つかりません`);
      center.kind = "endpoint";
      let radius = Number(a.radius);
      let startAngle = Number(a.startAngle);
      let endAngle = Number(a.endAngle);
      if ((!Number.isFinite(radius) || !Number.isFinite(startAngle) || !Number.isFinite(endAngle)) && a.startPoint !== undefined && a.endPoint !== undefined) {
        const startPoint = pointById.get(String(a.startPoint));
        const endPoint = pointById.get(String(a.endPoint));
        if (!startPoint || !endPoint) throw new Error(`円弧 ${a.id} の参照点が見つかりません`);
        radius = hypot2(startPoint.x - center.x, startPoint.y - center.y);
        startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
        endAngle = Math.atan2(endPoint.y - center.y, endPoint.x - center.x);
        if (!hasPointKind) {
          startPoint.kind = "endpoint";
          endPoint.kind = "endpoint";
        }
      }
      if (!Number.isFinite(radius) || radius < MIN_ORIENTATION_LENGTH || !Number.isFinite(startAngle) || !Number.isFinite(endAngle)) throw new Error(`円弧 ${a.id} の形状が正しくありません`);
      arcs.push(new Arc(String(a.id), center, radius, startAngle, endAngle));
    }

    const primitiveById = new Map();
    for (const c of circles) primitiveById.set(c.id, c);
    for (const a of arcs) primitiveById.set(a.id, a);

    const constraints = [];
    for (const c of data.constraints) {
      const constraint = deserializeConstraint(c, pointById, lineById, primitiveById);
      if (!constraint) throw new Error(`未対応の制約です: ${c.type}`);
      constraints.push(constraint);
    }

    const retainedPoints = points.filter((p) => {
      if (p.kind !== "endpoint") return true;
      if (isPointUsedByLine(p, lines) || isPointUsedByCircle(p, circles) || isPointUsedByArc(p, arcs)) return true;
      return constraints.some((constraint) => constraintReferencesPoint(constraint, p));
    });

    resetModelState();
    model.points.push(...retainedPoints);
    model.lines.push(...lines);
    model.circles.push(...circles);
    model.arcs.push(...arcs);
    normalizeArcSweeps(model.arcs);
    model.constraints.push(...constraints);
    const lineRepair = enforceMinimumLineLengths(model.lines);
    lastLoadLineRepairMessage =
      lineRepair.changed > 0 || lineRepair.failed > 0
        ? `短すぎる線を補正しました: ${lineRepair.changed}件${lineRepair.failed ? ` / 補正不能 ${lineRepair.failed}件` : ""}`
        : "";
    if (lastLoadLineRepairMessage) log(lastLoadLineRepairMessage);
    ensureDimensionDefaults();
    pointSeq = nextSeq(model.points, "P");
    lineSeq = nextSeq(model.lines, "L");
    circleSeq = nextSeq(model.circles, "C");
    arcSeq = nextSeq(model.arcs, "A");
  }

  function exportFileData() {
    try {
      const data = JSON.stringify(serializeModel(), null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `cad-model-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setHint("ファイルとして保存しました");
      log("ファイルとして保存しました");
    } catch (err) {
      setHint(`ファイル保存に失敗しました: ${err.message}`);
      log(`ファイル保存に失敗しました: ${err.message}`);
    }
  }

  function importFileData(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        loadModelData(JSON.parse(String(reader.result)));
        solveAndRefresh("ファイル読み込み");
        log(`ファイルを読み込みました: ${file.name}`);
      } catch (err) {
        setHint(`ファイル読み込みに失敗しました: ${err.message}`);
        log(`ファイル読み込みに失敗しました: ${err.message}`);
      }
    });
    reader.addEventListener("error", () => {
      setHint("ファイル読み込みに失敗しました");
      log("ファイル読み込みに失敗しました");
    });
    reader.readAsText(file);
  }

  function pointAt(x, y) {
    return hitAnyPoint(x, y) || addPoint(x, y);
  }

  function endpointAt(x, y) {
    const endpoint = hitEndpointPoint(x, y);
    if (endpoint) return endpoint;
    const explicit = hitExplicitPoint(x, y);
    if (explicit) return addPoint(explicit.x, explicit.y, false, "endpoint");
    return addPoint(x, y, false, "endpoint");
  }

  function clearSnap() {
    activeSnap = null;
  }

  function clearSelection() {
    selectedPoints = [];
    selectedLines = [];
    selectedCircles = [];
    selectedArcs = [];
    selectedArcEndpoint = null;
    selectedArcEndpointPair = null;
    selectedDimensionConstraint = null;
  }

  function exitLineMode() {
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    pointerPreview = null;
    clearSnap();
    mode = "select";
    updateToolbar();
    setHint("連続線を終了しました");
    updateUI();
    draw();
  }

  function exitDrawMode() {
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    clearSnap();
    mode = "select";
    updateToolbar();
    setHint("選択・ドラッグモードに戻りました");
    updateUI();
    draw();
  }

  function hasActiveDrawOperation() {
    return Boolean(lineStartPoint || rectangleStartPoint || filletFirstLine || circleCenterPoint || arcCenterPoint || arcStartPoint);
  }

  function cancelActiveDrawOperation() {
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    clearSnap();
    clearSelection();
    setHint("作図操作をキャンセルしました");
    updateUI();
    draw();
  }

  function sampleModel() {
    resetModelState();

    const A = addPoint(160, 160, true, "endpoint");
    const B = addPoint(300, 180, false, "endpoint");
    const C = addPoint(280, 290, false, "endpoint");
    const D = addPoint(140, 270, false, "endpoint");
    const AB = addLine(A, B);
    const BC = addLine(B, C);
    const CD = addLine(C, D);
    const DA = addLine(D, A);

    model.constraints.push(new DistanceConstraint(A, B, 140));
    model.constraints.push(new DistanceConstraint(B, C, 100));
    model.constraints.push(new ParallelConstraint(AB, CD));
    model.constraints.push(new ParallelConstraint(BC, DA));
    model.constraints.push(new PerpendicularConstraint(AB, BC));
    ensureDimensionDefaults();

    solveAndRefresh("サンプル復元");
    log("サンプルを復元しました");
  }

  function resizeCanvas(options = {}) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (options.centerWorld && rect.width > 0 && rect.height > 0) {
      viewport.x = rect.width / 2 - options.centerWorld.x * viewport.scale;
      viewport.y = rect.height / 2 - options.centerWorld.y * viewport.scale;
    }
    draw();
  }

  function currentCanvasCenterWorld() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return screenToWorld({ x: rect.width / 2, y: rect.height / 2 });
  }

  function clampZoom(scale) {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
  }

  function canvasScreenPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function screenToWorld(p) {
    return {
      x: (p.x - viewport.x) / viewport.scale,
      y: (p.y - viewport.y) / viewport.scale,
    };
  }

  function worldToCanvasScreen(p) {
    return {
      x: p.x * viewport.scale + viewport.x,
      y: p.y * viewport.scale + viewport.y,
    };
  }

  function canvasPoint(e) {
    return screenToWorld(canvasScreenPoint(e));
  }

  function isPointUsedByLine(point, lines = model.lines) {
    return lines.some((line) => line.p1 === point || line.p2 === point);
  }

  function isPointUsedByCircle(point, circles = model.circles) {
    return circles.some((circle) => circle.center === point);
  }

  function isPointUsedByArc(point, arcs = model.arcs) {
    return arcs.some((arc) => arc.center === point);
  }

  function isPointUsedByPrimitive(point) {
    return isPointUsedByLine(point) || isPointUsedByCircle(point) || isPointUsedByArc(point);
  }

  function isEndpointPoint(point) {
    return point?.kind === "endpoint" || isPointUsedByPrimitive(point);
  }

  function isExplicitPoint(point) {
    return point?.kind !== "endpoint";
  }

  function isReferencePoint(point) {
    return Boolean(point?.kind === "endpoint" && !isPointUsedByPrimitive(point) && model.constraints.some((c) => c.enabled !== false && constraintReferencesPoint(c, point)));
  }

  function isPrimitiveCenterPoint(point) {
    return model.circles.some((circle) => circle.center === point) || model.arcs.some((arc) => arc.center === point);
  }

  function isStandalonePoint(point) {
    return isExplicitPoint(point) && !isPointUsedByPrimitive(point);
  }

  function hitPointByPredicate(x, y, predicate) {
    const radius = 10 / viewport.scale;
    for (let i = model.points.length - 1; i >= 0; i--) {
      const p = model.points[i];
      if (!predicate(p)) continue;
      if (hypot2(p.x - x, p.y - y) <= radius) return p;
    }
    return null;
  }

  function hitEndpointPoint(x, y) {
    return hitPointByPredicate(x, y, (p) => (isEndpointPoint(p) && isPointUsedByPrimitive(p)) || isReferencePoint(p));
  }

  function hitExplicitPoint(x, y) {
    return hitPointByPredicate(x, y, isExplicitPoint);
  }

  function hitAnyPoint(x, y) {
    return hitEndpointPoint(x, y) || hitExplicitPoint(x, y);
  }

  function hitPoint(x, y) {
    return hitAnyPoint(x, y);
  }

  function distancePointToSegment(px, py, line) {
    const x1 = line.p1.x;
    const y1 = line.p1.y;
    const x2 = line.p2.x;
    const y2 = line.p2.y;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return hypot2(px - x1, py - y1);

    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return hypot2(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function closestPointOnSegment(px, py, line) {
    const x1 = line.p1.x;
    const y1 = line.p1.y;
    const dx = line.p2.x - x1;
    const dy = line.p2.y - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return { x: x1, y: y1, t: 0 };
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    return { x: x1 + t * dx, y: y1 + t * dy, t };
  }

  function distancePointToSegmentPoints(px, py, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return hypot2(px - a.x, py - a.y);
    const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
    return hypot2(px - (a.x + t * dx), py - (a.y + t * dy));
  }

  function rectFromPoints(a, b) {
    return {
      x1: Math.min(a.x, b.x),
      y1: Math.min(a.y, b.y),
      x2: Math.max(a.x, b.x),
      y2: Math.max(a.y, b.y),
    };
  }

  function pointInRect(p, rect) {
    return p.x >= rect.x1 && p.x <= rect.x2 && p.y >= rect.y1 && p.y <= rect.y2;
  }

  function bboxInRect(box, rect) {
    return box.x1 >= rect.x1 && box.x2 <= rect.x2 && box.y1 >= rect.y1 && box.y2 <= rect.y2;
  }

  function bboxIntersectsRect(box, rect) {
    return box.x2 >= rect.x1 && box.x1 <= rect.x2 && box.y2 >= rect.y1 && box.y1 <= rect.y2;
  }

  function lineBBox(line) {
    return {
      x1: Math.min(line.p1.x, line.p2.x),
      y1: Math.min(line.p1.y, line.p2.y),
      x2: Math.max(line.p1.x, line.p2.x),
      y2: Math.max(line.p1.y, line.p2.y),
    };
  }

  function primitiveBBox(primitive) {
    const r = primitive.radius();
    return {
      x1: primitive.center.x - r,
      y1: primitive.center.y - r,
      x2: primitive.center.x + r,
      y2: primitive.center.y + r,
    };
  }

  function arcSamplePoints(arc, count = 24) {
    const angles = arcAngles(arc);
    const points = [];
    for (let i = 0; i <= count; i++) {
      const t = count === 0 ? 0 : i / count;
      const angle = angles.start + (angles.end - angles.start) * t;
      points.push({
        x: arc.center.x + Math.cos(angle) * arc.radius(),
        y: arc.center.y + Math.sin(angle) * arc.radius(),
      });
    }
    return points;
  }

  function normalizeAngle(angle) {
    const twoPi = Math.PI * 2;
    return ((angle % twoPi) + twoPi) % twoPi;
  }

  function unwrapAngleNear(angle, reference) {
    const twoPi = Math.PI * 2;
    return angle + Math.round((reference - angle) / twoPi) * twoPi;
  }

  function shortestAngleFrom(start, end) {
    const twoPi = Math.PI * 2;
    let diff = ((end - start + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
    if (diff <= -Math.PI) diff += twoPi;
    return start + diff;
  }

  function clampArcEndAngle(start, end) {
    const twoPi = Math.PI * 2;
    const maxSweep = twoPi - 1e-6;
    const sweep = end - start;
    if (sweep > maxSweep) return start + maxSweep;
    if (sweep < -maxSweep) return start - maxSweep;
    return end;
  }

  function arcEndpointDragValue(arc, endpoint, rawAngle) {
    const twoPi = Math.PI * 2;
    const prop = endpoint === "start" ? "startAngle" : "endAngle";
    const value = unwrapAngleNear(rawAngle, arc[prop]);
    const sweep = endpoint === "start" ? arc.endAngle - value : value - arc.startAngle;
    if (Math.abs(sweep) >= twoPi - 1e-6) {
      return endpoint === "start" ? arc.endAngle : arc.startAngle;
    }
    return value;
  }

  function normalizeArcSweep(arc) {
    const twoPi = Math.PI * 2;
    const sweep = arc.endAngle - arc.startAngle;
    if (Math.abs(sweep) >= twoPi - 1e-9) {
      arc.endAngle = arc.startAngle;
      return true;
    }
    if (Math.abs(sweep) > 0 && Math.abs(sweep) * arc.radius() < MIN_ARC_LENGTH) {
      arc.endAngle = arc.startAngle;
      return true;
    }
    return false;
  }

  function normalizeArcSweeps(arcs = model.arcs) {
    let changed = 0;
    for (const arc of arcs) {
      if (normalizeArcSweep(arc)) changed += 1;
    }
    return changed;
  }

  function angleOnSignedSweep(angle, start, end) {
    const twoPi = Math.PI * 2;
    const sweep = end - start;
    if (Math.abs(sweep) >= twoPi) return true;
    if (sweep >= 0) return normalizeAngle(angle - start) <= sweep;
    return normalizeAngle(start - angle) <= -sweep;
  }

  function arcAngles(arc) {
    return {
      start: arc.startAngle,
      end: arc.endAngle,
    };
  }

  function arcEndpointPoint(arc, endpoint) {
    const angle = endpoint === "start" ? arc.startAngle : arc.endAngle;
    return {
      x: arc.center.x + Math.cos(angle) * arc.radius(),
      y: arc.center.y + Math.sin(angle) * arc.radius(),
    };
  }

  function sameArcEndpoint(a, b) {
    return a?.arc === b?.arc && a?.endpoint === b?.endpoint;
  }

  function findArcEndpointFixedConstraint(arc, endpoint) {
    return model.constraints.find((c) => c.enabled !== false && c instanceof ArcEndpointFixedConstraint && c.arc === arc && c.endpoint === endpoint);
  }

  function findLineFixedConstraint(line) {
    return model.constraints.find((c) => c.enabled !== false && c instanceof LineFixedConstraint && c.line === line);
  }

  function pointLockedByLineFixed(point) {
    return model.constraints.some((c) => c.enabled !== false && c instanceof LineFixedConstraint && (c.line.p1 === point || c.line.p2 === point));
  }

  function hitLine(x, y) {
    const threshold = 7 / viewport.scale;
    for (let i = model.lines.length - 1; i >= 0; i--) {
      const l = model.lines[i];
      if (distancePointToSegment(x, y, l) <= threshold) return l;
    }
    return null;
  }

  function hitCircle(x, y) {
    const threshold = 7 / viewport.scale;
    for (let i = model.circles.length - 1; i >= 0; i--) {
      const c = model.circles[i];
      const d = hypot2(x - c.center.x, y - c.center.y);
      if (Math.abs(d - c.radius()) <= threshold) return c;
    }
    return null;
  }

  function hitArc(x, y) {
    const threshold = 7 / viewport.scale;
    for (let i = model.arcs.length - 1; i >= 0; i--) {
      const a = model.arcs[i];
      const radius = a.radius();
      const d = hypot2(x - a.center.x, y - a.center.y);
      if (Math.abs(d - radius) > threshold) continue;
      const angles = arcAngles(a);
      const angle = Math.atan2(y - a.center.y, x - a.center.x);
      if (angleOnSignedSweep(angle, angles.start, angles.end)) return a;
    }
    return null;
  }

  function hitArcEndpoint(x, y) {
    const threshold = 10 / viewport.scale;
    for (let i = model.arcs.length - 1; i >= 0; i--) {
      const arc = model.arcs[i];
      for (const endpoint of ["end", "start"]) {
        const point = arcEndpointPoint(arc, endpoint);
        if (hypot2(point.x - x, point.y - y) <= threshold) return { arc, endpoint, point };
      }
    }
    return null;
  }

  function makeSnapCandidate(source, x, y, label, priority, data = {}) {
    return {
      x,
      y,
      label,
      priority,
      source,
      data,
      distance: hypot2(source.x - x, source.y - y),
    };
  }

  function addSnapCandidate(candidates, source, x, y, label, priority, data = {}) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    candidates.push(makeSnapCandidate(source, x, y, label, priority, data));
  }

  function circlePointAtPointer(source, primitive) {
    const dx = source.x - primitive.center.x;
    const dy = source.y - primitive.center.y;
    const len = hypot2(dx, dy);
    if (len < 1e-12) return null;
    const r = primitive.radius();
    return { x: primitive.center.x + (dx / len) * r, y: primitive.center.y + (dy / len) * r };
  }

  function snapCandidates(source) {
    const candidates = [];
    for (const p of model.points) {
      if (isReferencePoint(p)) addSnapCandidate(candidates, source, p.x, p.y, "参照点", 0, { point: p });
      else if (isPrimitiveCenterPoint(p)) addSnapCandidate(candidates, source, p.x, p.y, "中心", 0, { point: p });
      else if (isEndpointPoint(p) && isPointUsedByPrimitive(p)) addSnapCandidate(candidates, source, p.x, p.y, "端点", 0, { point: p });
      else if (isExplicitPoint(p)) addSnapCandidate(candidates, source, p.x, p.y, "点", 0, { point: p });
    }
    for (const line of model.lines) {
      addSnapCandidate(candidates, source, (line.p1.x + line.p2.x) / 2, (line.p1.y + line.p2.y) / 2, "中点", 1, { line });
      const closest = closestPointOnSegment(source.x, source.y, line);
      addSnapCandidate(candidates, source, closest.x, closest.y, "線上", 2, { line });
    }
    for (const circle of model.circles) {
      addSnapCandidate(candidates, source, circle.center.x, circle.center.y, "中心", 0, { primitive: circle });
      const p = circlePointAtPointer(source, circle);
      if (p) addSnapCandidate(candidates, source, p.x, p.y, "円周", 2, { primitive: circle });
    }
    for (const arc of model.arcs) {
      addSnapCandidate(candidates, source, arc.center.x, arc.center.y, "中心", 0, { primitive: arc });
      for (const endpoint of ["start", "end"]) {
        const p = arcEndpointPoint(arc, endpoint);
        addSnapCandidate(candidates, source, p.x, p.y, "端点", 0, { arc, endpoint });
      }
      const p = circlePointAtPointer(source, arc);
      if (p && angleOnSignedSweep(Math.atan2(p.y - arc.center.y, p.x - arc.center.x), arc.startAngle, arc.endAngle)) {
        addSnapCandidate(candidates, source, p.x, p.y, "円弧", 2, { arc });
      }
    }
    return candidates;
  }

  function snapForDrawing(p) {
    const threshold = 10 / viewport.scale;
    let best = null;
    for (const candidate of snapCandidates(p)) {
      if (candidate.distance > threshold) continue;
      if (
        !best ||
        candidate.priority < best.priority ||
        (candidate.priority === best.priority && candidate.distance < best.distance)
      ) {
        best = candidate;
      }
    }
    activeSnap = best;
    return best ? { x: best.x, y: best.y } : p;
  }

  function hitDimension(x, y) {
    const threshold = 8 / viewport.scale;
    for (let i = model.constraints.length - 1; i >= 0; i--) {
      const constraint = model.constraints[i];
      const target = targetFromConstraint(constraint);
      if (!target) continue;
      const dimension = constraint.dimension || defaultDimensionForTarget(target);
      const layout = dimensionLayout(target, dimension);
      if (!layout) continue;
      if (hypot2(x - layout.text.x, y - layout.text.y) <= threshold * 1.5) {
        return { constraint, target, dimension, part: "label" };
      }
      if (distancePointToSegmentPoints(x, y, layout.hitA, layout.hitB) <= threshold) {
        return { constraint, target, dimension, part: "line" };
      }
    }
    return null;
  }

  function lineUnit(line) {
    const len = line.length();
    if (len < 1e-12) return { x: 1, y: 0 };
    return { x: line.dx() / len, y: line.dy() / len };
  }

  function lineNormal(line) {
    const u = lineUnit(line);
    return { x: -u.y, y: u.x };
  }

  function linesAreParallel(l1, l2) {
    if (!lineHasDirection(l1) || !lineHasDirection(l2)) return false;
    const a = lineUnit(l1);
    const b = lineUnit(l2);
    return Math.abs(a.x * b.y - a.y * b.x) < 1e-3;
  }

  function lineHasDirection(line) {
    return line.length() >= MIN_ORIENTATION_LENGTH;
  }

  function projectPointToLine(point, line) {
    const dx = line.dx();
    const dy = line.dy();
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return { x: line.p1.x, y: line.p1.y };
    const t = ((point.x - line.p1.x) * dx + (point.y - line.p1.y) * dy) / len2;
    return { x: line.p1.x + t * dx, y: line.p1.y + t * dy };
  }

  function projectPointToSegmentPoint(point, line) {
    const dx = line.dx();
    const dy = line.dy();
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return { x: line.p1.x, y: line.p1.y };
    const t = Math.max(0, Math.min(1, ((point.x - line.p1.x) * dx + (point.y - line.p1.y) * dy) / len2));
    return { x: line.p1.x + t * dx, y: line.p1.y + t * dy };
  }

  function selectedPrimitives() {
    return [...selectedCircles, ...selectedArcs];
  }

  function primitiveId(primitive) {
    return primitive?.id || "";
  }

  function isPrimitive(item) {
    return item instanceof Circle || item instanceof Arc;
  }

  function circlePointAtAngle(primitive, angle) {
    return {
      x: primitive.center.x + Math.cos(angle) * primitive.radius(),
      y: primitive.center.y + Math.sin(angle) * primitive.radius(),
    };
  }

  function distanceTargetFromSelection() {
    const primitives = selectedPrimitives();
    if (selectedPoints.length === 0 && selectedLines.length === 0 && primitives.length === 1) {
      const [primitive] = primitives;
      if (primitive instanceof Circle) return { kind: "diameter", primitive, value: primitive.radius() * 2 };
      return { kind: "radius", primitive, value: primitive.radius() };
    }
    if (selectedPoints.length === 2 && selectedLines.length === 0) {
      const [p1, p2] = selectedPoints;
      return { kind: "point-point", p1, p2, value: hypot2(p2.x - p1.x, p2.y - p1.y) };
    }
    if (selectedPoints.length === 0 && selectedLines.length === 1) {
      const [line] = selectedLines;
      return { kind: "line-length", line, p1: line.p1, p2: line.p2, value: line.length() };
    }
    if (selectedPoints.length === 1 && selectedLines.length === 1) {
      const [point] = selectedPoints;
      const [line] = selectedLines;
      if (!lineHasDirection(line)) return { kind: "invalid", reason: "寸法対象の線が短すぎます" };
      return { kind: "point-line", point, line, value: Math.abs(signedPointLineDistance(point, line)) };
    }
    if (selectedPoints.length === 0 && selectedLines.length === 2) {
      const [line1, line2] = selectedLines;
      if (!lineHasDirection(line1) || !lineHasDirection(line2)) return { kind: "invalid", reason: "線-線寸法の対象線が短すぎます" };
      if (!linesAreParallel(line1, line2)) return { kind: "invalid", reason: "線-線寸法は平行線のみです" };
      return { kind: "line-line", line1, line2, value: Math.abs(signedPointLineDistance(line2.p1, line1)) };
    }
    return null;
  }

  function targetDirection(target) {
    if (target.kind === "radius" || target.kind === "diameter") {
      const defaultAngle = target.primitive instanceof Arc ? (target.primitive.startAngle + target.primitive.endAngle) / 2 : 0;
      const anchor = target.dimensionAnchor || circlePointAtAngle(target.primitive, defaultAngle);
      const dx = anchor.x - target.primitive.center.x;
      const dy = anchor.y - target.primitive.center.y;
      const len = hypot2(dx, dy);
      if (len > 1e-12) return { x: dx / len, y: dy / len };
      return { x: 1, y: 0 };
    }
    if (target.kind === "point-point" || target.kind === "line-length") {
      if (target.dimensionAxis === "x") return { x: 1, y: 0 };
      if (target.dimensionAxis === "y") return { x: 0, y: 1 };
      return lineUnit({ dx: () => target.p2.x - target.p1.x, dy: () => target.p2.y - target.p1.y, length: () => hypot2(target.p2.x - target.p1.x, target.p2.y - target.p1.y) });
    }
    if (target.kind === "point-line") {
      const projection = projectPointToLine(target.point, target.line);
      const dx = target.point.x - projection.x;
      const dy = target.point.y - projection.y;
      const len = hypot2(dx, dy);
      if (len > 1e-12) return { x: dx / len, y: dy / len };
      return lineNormal(target.line);
    }
    if (target.kind === "line-line") {
      const projection = projectPointToLine(target.line1.p1, target.line2);
      const dx = target.line1.p1.x - projection.x;
      const dy = target.line1.p1.y - projection.y;
      const len = hypot2(dx, dy);
      if (len > 1e-12) return { x: dx / len, y: dy / len };
      return lineNormal(target.line1);
    }
    return { x: 1, y: 0 };
  }

  function targetPointsForDimension(target, anchor = null) {
    if (target.kind === "radius") {
      const dir = targetDirection({ ...target, dimensionAnchor: anchor || target.dimensionAnchor });
      return [target.primitive.center, { x: target.primitive.center.x + dir.x * target.primitive.radius(), y: target.primitive.center.y + dir.y * target.primitive.radius() }];
    }
    if (target.kind === "diameter") {
      const dir = targetDirection({ ...target, dimensionAnchor: anchor || target.dimensionAnchor });
      return [
        { x: target.primitive.center.x - dir.x * target.primitive.radius(), y: target.primitive.center.y - dir.y * target.primitive.radius() },
        { x: target.primitive.center.x + dir.x * target.primitive.radius(), y: target.primitive.center.y + dir.y * target.primitive.radius() },
      ];
    }
    if (target.kind === "point-point" || target.kind === "line-length") return [target.p1, target.p2];
    if (target.kind === "point-line") return [target.point, projectPointToSegmentPoint(anchor || target.point, target.line)];
    if (target.kind === "line-line") {
      return [nearestLineEndpoint(target.line1, anchor), nearestLineEndpoint(target.line2, anchor)];
    }
    return [];
  }

  function nearestLineEndpoint(line, anchor = null) {
    if (!anchor) return line.p1;
    const d1 = hypot2(line.p1.x - anchor.x, line.p1.y - anchor.y);
    const d2 = hypot2(line.p2.x - anchor.x, line.p2.y - anchor.y);
    return d1 <= d2 ? line.p1 : line.p2;
  }

  function dimensionBasis(target) {
    const d = targetDirection(target);
    return { d, n: { x: -d.y, y: d.x } };
  }

  function dimensionBasePoint(target) {
    const points = targetPointsForDimension(target);
    if (points.length < 2) return { x: 0, y: 0 };
    return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  }

  function dominantDimensionAxis(target) {
    if (target.kind !== "point-point") return null;
    return Math.abs(target.p2.x - target.p1.x) >= Math.abs(target.p2.y - target.p1.y) ? "x" : "y";
  }

  function dimensionAxisForAnchor(target, anchor, options = {}) {
    if (target.kind !== "point-point") return target.dimensionAxis || null;
    if (target.dimensionAxis) return target.dimensionAxis;
    if (options.allowPointAxis === false) return null;
    const lineDistance = distancePointToSegmentPoints(anchor.x, anchor.y, target.p1, target.p2);
    if (lineDistance <= 10 / viewport.scale) return null;
    const base = dimensionBasePoint(target);
    const dx = anchor.x - base.x;
    const dy = anchor.y - base.y;
    return Math.abs(dy) >= Math.abs(dx) ? "x" : "y";
  }

  function dimensionFromAnchor(target, anchor, options = {}) {
    const axis = dimensionAxisForAnchor(target, anchor, options);
    const basisTarget = axis ? { ...target, dimensionAxis: axis } : target;
    const base = dimensionBasePoint(target);
    const { d, n } = dimensionBasis(basisTarget);
    const dx = anchor.x - base.x;
    const dy = anchor.y - base.y;
    return {
      x: anchor.x,
      y: anchor.y,
      offsetU: dx * d.x + dy * d.y,
      offsetN: dx * n.x + dy * n.y,
      labelOffsetU: 0,
      axis,
    };
  }

  function storedDimensionAxis(target, dimension = null) {
    if (target.kind === "point-point") return target.dimensionAxis || null;
    return dimension?.axis || target.dimensionAxis || null;
  }

  function dimensionAnchor(target, dimension) {
    if (!dimension) return defaultDimensionForTarget(target);
    const base = dimensionBasePoint(target);
    const axis = storedDimensionAxis(target, dimension);
    const { d, n } = dimensionBasis({ ...target, dimensionAxis: axis });
    if (Number.isFinite(dimension.offsetU) && Number.isFinite(dimension.offsetN)) {
      return {
        x: base.x + d.x * dimension.offsetU + n.x * dimension.offsetN,
        y: base.y + d.y * dimension.offsetU + n.y * dimension.offsetN,
      };
    }
    return { x: dimension.x, y: dimension.y };
  }

  function defaultDimensionForTarget(target) {
    const points = targetPointsForDimension(target);
    if (points.length < 2) return { x: 0, y: 0 };
    if (target.kind === "radius") return dimensionFromAnchor(target, points[1]);
    const mid = dimensionBasePoint(target);
    const defaultAxis = target.kind === "point-point" ? target.dimensionAxis || null : null;
    const dir = targetDirection(defaultAxis ? { ...target, dimensionAxis: defaultAxis } : target);
    const normal = { x: -dir.y, y: dir.x };
    const dimension = dimensionFromAnchor(defaultAxis ? { ...target, dimensionAxis: defaultAxis } : target, { x: mid.x + normal.x * 30, y: mid.y + normal.y * 30 }, { allowPointAxis: false });
    if (defaultAxis) dimension.axis = defaultAxis;
    return dimension;
  }

  function targetFromConstraint(c) {
    if (c instanceof DistanceConstraint) return { kind: "point-point", p1: c.p1, p2: c.p2, value: c.target };
    if (c instanceof PointAxisDistanceConstraint) return { kind: "point-point", p1: c.p1, p2: c.p2, value: c.target, dimensionAxis: c.axis };
    if (c instanceof PointLineDistanceConstraint) return { kind: "point-line", point: c.point, line: c.line, value: c.target };
    if (c instanceof LineLineDistanceConstraint) return { kind: "line-line", line1: c.line1, line2: c.line2, value: c.target };
    if (c instanceof RadiusConstraint) return { kind: "radius", primitive: c.primitive, value: c.target };
    if (c instanceof DiameterConstraint) return { kind: "diameter", primitive: c.primitive, value: c.target };
    return null;
  }

  function constraintReferencesPoint(c, point) {
    if (c instanceof DistanceConstraint || c instanceof PointAxisDistanceConstraint) return c.p1 === point || c.p2 === point;
    if (c instanceof PointLineDistanceConstraint) return c.point === point || c.line.p1 === point || c.line.p2 === point;
    if (c instanceof LineLineDistanceConstraint) return c.line1.p1 === point || c.line1.p2 === point || c.line2.p1 === point || c.line2.p2 === point;
    if (c instanceof CoincidentConstraint) return c.p1 === point || c.p2 === point;
    if (c instanceof ArcEndpointCoincidentConstraint) return c.arc.center === point || c.point === point;
    if (c instanceof ArcEndpointArcEndpointCoincidentConstraint) return c.a.center === point || c.b.center === point;
    if (c instanceof ArcEndpointFixedConstraint) return c.arc.center === point;
    if (c instanceof LineFixedConstraint) return c.line.p1 === point || c.line.p2 === point;
    if (c instanceof PointOnLineConstraint) return c.point === point || c.line.p1 === point || c.line.p2 === point;
    if (c instanceof ArcEndpointOnLineConstraint) return c.arc.center === point || c.line.p1 === point || c.line.p2 === point;
    if (c instanceof HorizontalConstraint || c instanceof VerticalConstraint) return c.line.p1 === point || c.line.p2 === point;
    if (c instanceof ParallelConstraint || c instanceof PerpendicularConstraint) {
      return c.line1.p1 === point || c.line1.p2 === point || c.line2.p1 === point || c.line2.p2 === point;
    }
    if (c instanceof CollinearConstraint || c instanceof EqualLengthConstraint) return c.line1.p1 === point || c.line1.p2 === point || c.line2.p1 === point || c.line2.p2 === point;
    if (c instanceof ConcentricConstraint) return c.a === point || c.b === point || c.a.center === point || c.b.center === point;
    if (c instanceof PointOnCircleConstraint) return c.point === point || c.primitive.center === point;
    if (c instanceof ArcEndpointOnCircleConstraint) return c.arc.center === point || c.primitive.center === point;
    if (c instanceof RadiusConstraint || c instanceof DiameterConstraint) return c.primitive.center === point;
    if (c instanceof EqualRadiusConstraint || c instanceof CircleCircleTangentConstraint) return c.a.center === point || c.b.center === point;
    if (c instanceof LineCircleTangentConstraint) return c.line.p1 === point || c.line.p2 === point || c.primitive.center === point;
    return false;
  }

  function constraintReferencesLine(c, line) {
    if (c instanceof DistanceConstraint || c instanceof PointAxisDistanceConstraint) {
      return (c.p1 === line.p1 && c.p2 === line.p2) || (c.p1 === line.p2 && c.p2 === line.p1);
    }
    if (c instanceof PointLineDistanceConstraint) return c.line === line;
    if (c instanceof LineLineDistanceConstraint) return c.line1 === line || c.line2 === line;
    if (c instanceof LineFixedConstraint) return c.line === line;
    if (c instanceof PointOnLineConstraint) return c.line === line;
    if (c instanceof ArcEndpointOnLineConstraint) return c.line === line;
    if (c instanceof HorizontalConstraint || c instanceof VerticalConstraint) return c.line === line;
    if (c instanceof ParallelConstraint || c instanceof PerpendicularConstraint) return c.line1 === line || c.line2 === line;
    if (c instanceof CollinearConstraint || c instanceof EqualLengthConstraint) return c.line1 === line || c.line2 === line;
    if (c instanceof LineCircleTangentConstraint) return c.line === line;
    return false;
  }

  function constraintReferencesPrimitive(c, primitive) {
    if (c instanceof ArcEndpointCoincidentConstraint) return c.arc === primitive;
    if (c instanceof ArcEndpointArcEndpointCoincidentConstraint) return c.a === primitive || c.b === primitive;
    if (c instanceof ArcEndpointOnLineConstraint) return c.arc === primitive;
    if (c instanceof ArcEndpointFixedConstraint) return c.arc === primitive;
    if (c instanceof RadiusConstraint || c instanceof DiameterConstraint || c instanceof PointOnCircleConstraint || c instanceof LineCircleTangentConstraint) return c.primitive === primitive;
    if (c instanceof ArcEndpointOnCircleConstraint) return c.arc === primitive || c.primitive === primitive;
    if (c instanceof ConcentricConstraint || c instanceof EqualRadiusConstraint || c instanceof CircleCircleTangentConstraint) return c.a === primitive || c.b === primitive;
    return false;
  }

  function addNode(nodes, value) {
    if (value) nodes.add(value);
  }

  function constraintGraphNodes(c) {
    const nodes = new Set();
    if (c instanceof DistanceConstraint || c instanceof PointAxisDistanceConstraint) {
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
    } else if (c instanceof ArcEndpointOnLineConstraint) {
      addNode(nodes, c.arc);
      addNode(nodes, c.arc.center);
      addNode(nodes, c.line);
      addNode(nodes, c.line.p1);
      addNode(nodes, c.line.p2);
    } else if (c instanceof ArcEndpointFixedConstraint) {
      addNode(nodes, c.arc);
      addNode(nodes, c.arc.center);
    } else if (c instanceof LineFixedConstraint || c instanceof HorizontalConstraint || c instanceof VerticalConstraint) {
      addNode(nodes, c.line);
      addNode(nodes, c.line.p1);
      addNode(nodes, c.line.p2);
    } else if (c instanceof ParallelConstraint || c instanceof PerpendicularConstraint || c instanceof CollinearConstraint || c instanceof EqualLengthConstraint) {
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
    return [...nodes];
  }

  function addIntrinsicGraphEdges(adjacency, a, b) {
    if (!a || !b) return;
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a).add(b);
    adjacency.get(b).add(a);
  }

  function buildConstraintAdjacency() {
    const adjacency = new Map();
    for (const p of model.points) {
      if (!adjacency.has(p)) adjacency.set(p, new Set());
    }
    for (const line of model.lines) {
      addIntrinsicGraphEdges(adjacency, line, line.p1);
      addIntrinsicGraphEdges(adjacency, line, line.p2);
    }
    for (const circle of model.circles) addIntrinsicGraphEdges(adjacency, circle, circle.center);
    for (const arc of model.arcs) addIntrinsicGraphEdges(adjacency, arc, arc.center);

    for (const constraint of model.constraints) {
      if (constraint.enabled === false) continue;
      const nodes = constraintGraphNodes(constraint);
      for (const node of nodes) {
        if (!adjacency.has(node)) adjacency.set(node, new Set());
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) addIntrinsicGraphEdges(adjacency, nodes[i], nodes[j]);
      }
    }
    return adjacency;
  }

  function connectedComponentFromSeeds(seeds) {
    const adjacency = buildConstraintAdjacency();
    const seen = new Set();
    const queue = [];
    for (const seed of seeds) {
      if (!seed || seen.has(seed)) continue;
      seen.add(seed);
      queue.push(seed);
    }
    while (queue.length > 0) {
      const node = queue.shift();
      for (const next of adjacency.get(node) || []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    return seen;
  }

  function localSolveVariables(component) {
    const vars = [];
    for (const p of model.points) {
      if (component.has(p) && !p.fixed) {
        vars.push({ object: p, prop: "x", label: `${p.id}.x` });
        vars.push({ object: p, prop: "y", label: `${p.id}.y` });
      }
    }
    for (const c of model.circles) {
      if (component.has(c)) vars.push({ object: c, prop: "radiusValue", label: `${c.id}.r`, min: MIN_LINE_LENGTH });
    }
    for (const a of model.arcs) {
      if (component.has(a)) {
        vars.push({ object: a, prop: "radiusValue", label: `${a.id}.r`, min: MIN_LINE_LENGTH });
        vars.push({ object: a, prop: "startAngle", label: `${a.id}.startAngle` });
        vars.push({ object: a, prop: "endAngle", label: `${a.id}.endAngle` });
      }
    }
    return vars;
  }

  function localSolveConstraints(component) {
    return model.constraints.filter((constraint) => constraint.enabled !== false && constraintGraphNodes(constraint).some((node) => component.has(node)));
  }

  function localSolveLines(component) {
    return model.lines.filter((line) => component.has(line));
  }

  function localSolveContextFromSeeds(seeds) {
    const component = connectedComponentFromSeeds(seeds);
    return {
      component,
      variables: localSolveVariables(component),
      constraints: localSolveConstraints(component),
      lines: localSolveLines(component),
    };
  }

  function removeFromArray(array, item) {
    const i = array.indexOf(item);
    if (i >= 0) array.splice(i, 1);
  }

  function deleteElements({ points = [], lines = [], circles = [], arcs = [], constraints = [] } = {}) {
    const pointSet = new Set(points);
    const lineSet = new Set(lines);
    const circleSet = new Set(circles);
    const arcSet = new Set(arcs);
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
    const remainingLines = model.lines.filter((line) => !lineSet.has(line));
    const remainingCircles = model.circles.filter((circle) => !circleSet.has(circle));
    const remainingArcs = model.arcs.filter((arc) => !arcSet.has(arc));
    for (const line of lineSet) {
      if (line.p1.kind === "endpoint" && !isPointUsedByLine(line.p1, remainingLines) && !isPointUsedByCircle(line.p1, remainingCircles) && !isPointUsedByArc(line.p1, remainingArcs)) pointSet.add(line.p1);
      if (line.p2.kind === "endpoint" && !isPointUsedByLine(line.p2, remainingLines) && !isPointUsedByCircle(line.p2, remainingCircles) && !isPointUsedByArc(line.p2, remainingArcs)) pointSet.add(line.p2);
    }
    for (const circle of circleSet) {
      if (circle.center.kind === "endpoint" && !isPointUsedByCircle(circle.center, remainingCircles) && !isPointUsedByLine(circle.center, remainingLines) && !isPointUsedByArc(circle.center, remainingArcs)) pointSet.add(circle.center);
    }
    for (const arc of arcSet) {
      if (arc.center.kind === "endpoint" && !isPointUsedByArc(arc.center, remainingArcs) && !isPointUsedByLine(arc.center, remainingLines) && !isPointUsedByCircle(arc.center, remainingCircles)) pointSet.add(arc.center);
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
    }

    if (pointSet.size === 0 && lineSet.size === 0 && circleSet.size === 0 && arcSet.size === 0 && constraintSet.size === 0) return false;

    dragSession = null;
    dimensionDragSession = null;
    pendingCommand = null;
    pendingConstraintCommand = null;
    lineStartPoint = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    mode = "select";

    model.constraints = model.constraints.filter((c) => !constraintSet.has(c));
    model.lines = model.lines.filter((l) => !lineSet.has(l));
    model.circles = model.circles.filter((c) => !circleSet.has(c));
    model.arcs = model.arcs.filter((a) => !arcSet.has(a));
    model.points = model.points.filter((p) => !pointSet.has(p));
    selectedPoints = selectedPoints.filter((p) => !pointSet.has(p));
    selectedLines = selectedLines.filter((l) => !lineSet.has(l));
    selectedCircles = selectedCircles.filter((c) => !circleSet.has(c));
    selectedArcs = selectedArcs.filter((a) => !arcSet.has(a));
    if (constraintSet.has(selectedDimensionConstraint)) selectedDimensionConstraint = null;
    if (constraintSet.has(hoveredDimensionConstraint)) hoveredDimensionConstraint = null;

    const result = solver.solve();
    normalizeArcSweeps();
    updateToolbar();
    updateUI();
    draw();
    const msg = `削除しました: 点${pointSet.size} / 線${lineSet.size} / 円${circleSet.size} / 円弧${arcSet.size} / 拘束${constraintSet.size}`;
    setHint(`${msg} (error=${result.errorNorm.toExponential(2)}) / ${constraintSummaryText()}`, result.success && constraintAnalysisState?.analysis?.stable ? "normal" : "error");
    log(`${msg}\n自動solve: success=${result.success}, error=${result.errorNorm.toExponential(3)}`);
    return true;
  }

  function deleteCurrentSelection() {
    const constraints = selectedDimensionConstraint ? [selectedDimensionConstraint] : [];
    return deleteElements({ points: selectedPoints, lines: selectedLines, circles: selectedCircles, arcs: selectedArcs, constraints });
  }

  function ensureDimensionDefaults() {
    for (const c of model.constraints) {
      const target = targetFromConstraint(c);
      if (!target) continue;
      if (!c.dimension) {
        c.dimension = defaultDimensionForTarget(target);
      } else if (!Number.isFinite(c.dimension.offsetU) || !Number.isFinite(c.dimension.offsetN)) {
        const previous = c.dimension;
        c.dimension = dimensionFromAnchor(target, previous, { allowPointAxis: false });
        c.dimension.labelOffsetU = Number.isFinite(previous.labelOffsetU) ? previous.labelOffsetU : 0;
        if (target.dimensionAxis) c.dimension.axis = target.dimensionAxis;
      }
      if (!Number.isFinite(c.dimension.labelOffsetU)) c.dimension.labelOffsetU = 0;
    }
  }

  function togglePointSelection(p) {
    if (!p) return;
    const i = selectedPoints.indexOf(p);
    if (i >= 0) selectedPoints.splice(i, 1);
    else selectedPoints.push(p);
  }

  function toggleLineSelection(l) {
    if (!l) return;
    const i = selectedLines.indexOf(l);
    if (i >= 0) selectedLines.splice(i, 1);
    else selectedLines.push(l);
  }

  function toggleCircleSelection(c) {
    if (!c) return;
    const i = selectedCircles.indexOf(c);
    if (i >= 0) selectedCircles.splice(i, 1);
    else selectedCircles.push(c);
  }

  function toggleArcSelection(a) {
    if (!a) return;
    const i = selectedArcs.indexOf(a);
    if (i >= 0) selectedArcs.splice(i, 1);
    else selectedArcs.push(a);
  }

  function addUnique(target, item) {
    if (item && !target.includes(item)) target.push(item);
  }

  function lineIntersectsRect(line, rect) {
    if (!bboxIntersectsRect(lineBBox(line), rect)) return false;
    if (pointInRect(line.p1, rect) || pointInRect(line.p2, rect)) return true;
    const edges = [
      [{ x: rect.x1, y: rect.y1 }, { x: rect.x2, y: rect.y1 }],
      [{ x: rect.x2, y: rect.y1 }, { x: rect.x2, y: rect.y2 }],
      [{ x: rect.x2, y: rect.y2 }, { x: rect.x1, y: rect.y2 }],
      [{ x: rect.x1, y: rect.y2 }, { x: rect.x1, y: rect.y1 }],
    ];
    return edges.some(([a, b]) => segmentsIntersect(line.p1, line.p2, a, b));
  }

  function segmentsIntersect(a, b, c, d) {
    const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const onSegment = (p, q, r) =>
      Math.min(p.x, q.x) - 1e-9 <= r.x &&
      r.x <= Math.max(p.x, q.x) + 1e-9 &&
      Math.min(p.y, q.y) - 1e-9 <= r.y &&
      r.y <= Math.max(p.y, q.y) + 1e-9;
    const c1 = cross(a, b, c);
    const c2 = cross(a, b, d);
    const c3 = cross(c, d, a);
    const c4 = cross(c, d, b);
    if (Math.abs(c1) < 1e-9 && onSegment(a, b, c)) return true;
    if (Math.abs(c2) < 1e-9 && onSegment(a, b, d)) return true;
    if (Math.abs(c3) < 1e-9 && onSegment(c, d, a)) return true;
    if (Math.abs(c4) < 1e-9 && onSegment(c, d, b)) return true;
    return c1 * c2 < 0 && c3 * c4 < 0;
  }

  function selectByRect(rect, crossing, additive = false) {
    const nextPoints = additive ? [...selectedPoints] : [];
    const nextLines = additive ? [...selectedLines] : [];
    const nextCircles = additive ? [...selectedCircles] : [];
    const nextArcs = additive ? [...selectedArcs] : [];

    for (const p of model.points) {
      if (!isExplicitPoint(p) && !isReferencePoint(p)) continue;
      if (pointInRect(p, rect)) addUnique(nextPoints, p);
    }
    for (const line of model.lines) {
      const selected = crossing ? lineIntersectsRect(line, rect) : bboxInRect(lineBBox(line), rect);
      if (selected) addUnique(nextLines, line);
    }
    for (const circle of model.circles) {
      const box = primitiveBBox(circle);
      const selected = crossing ? bboxIntersectsRect(box, rect) : bboxInRect(box, rect);
      if (selected) addUnique(nextCircles, circle);
    }
    for (const arc of model.arcs) {
      const samples = arcSamplePoints(arc);
      const selected = crossing ? samples.some((p) => pointInRect(p, rect)) : samples.every((p) => pointInRect(p, rect));
      if (selected) addUnique(nextArcs, arc);
    }

    selectedPoints = nextPoints;
    selectedLines = nextLines;
    selectedCircles = nextCircles;
    selectedArcs = nextArcs;
    selectedArcEndpoint = null;
    selectedArcEndpointPair = null;
    selectedDimensionConstraint = null;
  }

  function drawGrid(w, h) {
    const left = -viewport.x / viewport.scale;
    const top = -viewport.y / viewport.scale;
    const right = left + w / viewport.scale;
    const bottom = top + h / viewport.scale;
    const step = 25;
    const startX = Math.floor(left / step) * step;
    const startY = Math.floor(top / step) * step;

    ctx.save();
    ctx.strokeStyle = "#eef2f7";
    ctx.lineWidth = 1 / viewport.scale;
    for (let x = startX; x <= right; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
    for (let y = startY; y <= bottom; y += step) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    const r = canvas.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.scale, viewport.scale);
    drawGrid(w, h);
    drawLines();
    drawCircles();
    drawArcs();
    drawDimensions();
    drawDimensionPreview();
    drawTemporaryLine();
    drawRectanglePreview();
    drawCirclePreview();
    drawArcPreview();
    drawSnapMarker();
    drawArcEndpointHandles();
    drawPoints();
    drawSelectionRect();
    ctx.restore();
    syncDimensionValueInput();
  }

  function hideDimensionValueInput() {
    if (!dimensionValueInput) return;
    dimensionValueInput.hidden = true;
    dimensionValueInput.classList.remove("is-invalid");
  }

  function dimensionInputPointForPendingCommand() {
    if (!pendingCommand || (pendingCommand.type !== "distance-value" && pendingCommand.type !== "fillet-radius-value")) return null;
    if (pendingCommand.type === "fillet-radius-value") {
      const value = Number(pendingCommand.buffer);
      const radius = Number.isFinite(value) && value > 0 ? value : DEFAULT_FILLET_RADIUS;
      const geometry = computeFilletGeometry(pendingCommand.line1, pendingCommand.line2, radius);
      if (!geometry.ok) return null;
      const primitive = {
        id: "R",
        center: geometry.center,
        radius: () => geometry.radius,
      };
      const target = { kind: "radius", primitive, value: radius };
      const anchor = filletRadiusDimensionAnchor(geometry);
      const layout = dimensionLayout(target, dimensionFromAnchor(target, anchor));
      return layout?.text || null;
    }
    const layout = dimensionLayout(pendingCommand.target, pendingCommand.dimension);
    return layout?.text || null;
  }

  function syncDimensionValueInput() {
    if (!dimensionValueInput) return;
    if (!pendingCommand || (pendingCommand.type !== "distance-value" && pendingCommand.type !== "fillet-radius-value")) {
      hideDimensionValueInput();
      return;
    }
    const textPoint = dimensionInputPointForPendingCommand();
    if (!textPoint) {
      hideDimensionValueInput();
      return;
    }
    const screen = worldToCanvasScreen(textPoint);
    dimensionValueInput.hidden = false;
    dimensionValueInput.style.left = `${screen.x}px`;
    dimensionValueInput.style.top = `${screen.y - 4}px`;
    if (dimensionValueInput.value !== pendingCommand.buffer) dimensionValueInput.value = pendingCommand.buffer;
    const value = Number(pendingCommand.buffer);
    dimensionValueInput.classList.toggle("is-invalid", pendingCommand.buffer === "" || !Number.isFinite(value) || value <= 0);
  }

  function focusDimensionValueInput() {
    requestAnimationFrame(() => {
      syncDimensionValueInput();
      if (dimensionValueInput?.hidden === false) {
        dimensionValueInput.focus();
        dimensionValueInput.select();
      }
    });
  }

  function drawSelectionRect() {
    if (!selectionRectSession?.current) return;
    const rect = rectFromPoints(selectionRectSession.start, selectionRectSession.current);
    ctx.save();
    ctx.strokeStyle = selectionRectSession.current.x < selectionRectSession.start.x ? "#f59e0b" : "#2563eb";
    ctx.fillStyle = selectionRectSession.current.x < selectionRectSession.start.x ? "rgba(245, 158, 11, 0.08)" : "rgba(37, 99, 235, 0.08)";
    ctx.lineWidth = 1.2 / viewport.scale;
    ctx.setLineDash([5 / viewport.scale, 4 / viewport.scale]);
    ctx.fillRect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);
    ctx.strokeRect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);
    ctx.restore();
  }

  function drawLines() {
    ctx.save();
    for (const l of model.lines) {
      const sel = selectedLines.includes(l);
      const hovered = hoveredLine === l;
      ctx.strokeStyle = constraintStatusColor(l, sel, hovered);
      ctx.lineWidth = (sel || hovered ? 3 : 2) / viewport.scale;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(l.p1.x, l.p1.y);
      ctx.lineTo(l.p2.x, l.p2.y);
      ctx.stroke();

      if (sel || hovered) {
        const mx = (l.p1.x + l.p2.x) / 2;
        const my = (l.p1.y + l.p2.y) / 2;
        ctx.fillStyle = "#2563eb";
        ctx.font = `${12 / viewport.scale}px system-ui`;
        ctx.fillText(l.id, mx + 4 / viewport.scale, my - 4 / viewport.scale);
      }
    }
    ctx.restore();
  }

  function drawCircles() {
    ctx.save();
    ctx.lineCap = "round";
    for (const c of model.circles) {
      const sel = selectedCircles.includes(c);
      const hovered = hoveredCircle === c;
      ctx.strokeStyle = constraintStatusColor(c, sel, hovered);
      ctx.lineWidth = (sel || hovered ? 3 : 2) / viewport.scale;
      ctx.beginPath();
      ctx.arc(c.center.x, c.center.y, c.radius(), 0, Math.PI * 2);
      ctx.stroke();
      if (sel || hovered) {
        ctx.fillStyle = "#2563eb";
        ctx.font = `${12 / viewport.scale}px system-ui`;
        ctx.fillText(c.id, c.center.x + c.radius() + 4 / viewport.scale, c.center.y - 4 / viewport.scale);
      }
    }
    ctx.restore();
  }

  function drawArcs() {
    ctx.save();
    ctx.lineCap = "round";
    for (const a of model.arcs) {
      const sel = selectedArcs.includes(a);
      const hovered = hoveredArc === a;
      const angles = arcAngles(a);
      ctx.strokeStyle = constraintStatusColor(a, sel, hovered);
      ctx.lineWidth = (sel || hovered ? 3 : 2) / viewport.scale;
      ctx.beginPath();
      ctx.arc(a.center.x, a.center.y, a.radius(), angles.start, angles.end, angles.end < angles.start);
      ctx.stroke();
      if (sel || hovered) {
        const mid = angles.start + (angles.end - angles.start) / 2;
        ctx.fillStyle = "#2563eb";
        ctx.font = `${12 / viewport.scale}px system-ui`;
        ctx.fillText(a.id, a.center.x + Math.cos(mid) * a.radius(), a.center.y + Math.sin(mid) * a.radius());
      }
    }
    ctx.restore();
  }

  function drawDimension(target, dimension, label, preview = false, highlighted = false, editState = null) {
    if (!target || !dimension) return;
    const layout = dimensionLayout(target, dimension);
    if (!layout) return;
    const { a, b, points, d, text } = layout;

    ctx.save();
    ctx.strokeStyle = preview || highlighted ? "#2563eb" : "#6b7280";
    ctx.fillStyle = preview || highlighted ? "#2563eb" : "#6b7280";
    ctx.lineWidth = (highlighted ? 2 : 1.2) / viewport.scale;
    if (preview) ctx.setLineDash([5 / viewport.scale, 4 / viewport.scale]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    for (const p of points) {
      ctx.beginPath();
      ctx.moveTo(p.extensionStart.x, p.extensionStart.y);
      ctx.lineTo(p.extensionEnd.x, p.extensionEnd.y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    drawArrowhead(a, d);
    drawArrowhead(b, { x: -d.x, y: -d.y });

    drawDimensionLabel(label, text, editState);
    ctx.restore();
  }

  function drawDimensionLabel(label, text, editState = null) {
    if (editState) {
      drawDimensionEditLabel(label, text, editState);
    } else {
      ctx.font = `${12 / viewport.scale}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(label, text.x, text.y - 4 / viewport.scale);
    }
  }

  function drawDimensionEditLabel(label, text, state) {
    const fontSize = 12 / viewport.scale;
    const padX = 6 / viewport.scale;
    const padY = 4 / viewport.scale;
    const height = 22 / viewport.scale;
    ctx.save();
    ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const width = Math.max(44 / viewport.scale, ctx.measureText(label).width + padX * 2);
    const x = text.x - width / 2;
    const y = text.y - height - 4 / viewport.scale;
    const border = state.invalid ? "#dc2626" : "#2563eb";

    ctx.fillStyle = "#fff";
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5 / viewport.scale;
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.fill();
    ctx.stroke();

    if (state.selecting && !state.invalid) {
      ctx.fillStyle = "#dbeafe";
      ctx.fillRect(x + padX / 2, y + padY / 2, width - padX, height - padY);
    }

    ctx.fillStyle = border;
    ctx.fillText(label, text.x, y + height / 2);
    ctx.restore();
  }

  function dimensionLayout(target, dimension) {
    const anchor = dimensionAnchor(target, dimension);
    const basisTarget = { ...target, dimensionAxis: storedDimensionAxis(target, dimension) };
    const d = target.kind === "radius" || target.kind === "diameter" ? targetDirection({ ...basisTarget, dimensionAnchor: anchor }) : targetDirection(basisTarget);
    const points = targetPointsForDimension(target, anchor);
    if (points.length < 2) return null;
    const tick = 9 / viewport.scale;
    const extension = 6 / viewport.scale;
    const gap = 12 / viewport.scale;
    const projections = points.map((p) => (p.x - anchor.x) * d.x + (p.y - anchor.y) * d.y);
    const min = Math.min(...projections);
    const max = Math.max(...projections);
    const a = { x: anchor.x + d.x * min, y: anchor.y + d.y * min };
    const b = { x: anchor.x + d.x * max, y: anchor.y + d.y * max };
    const projectedPoints = points.map((source) => {
      const t = (source.x - anchor.x) * d.x + (source.y - anchor.y) * d.y;
      const onDimension = { x: anchor.x + d.x * t, y: anchor.y + d.y * t };
      const ex = onDimension.x - source.x;
      const ey = onDimension.y - source.y;
      const el = hypot2(ex, ey);
      const ux = el > 1e-12 ? ex / el : d.x;
      const uy = el > 1e-12 ? ey / el : d.y;
      const visibleGap = Math.min(gap, Math.max(0, el - 2 / viewport.scale));
      return {
        source,
        extensionStart: {
          x: source.x + ux * visibleGap,
          y: source.y + uy * visibleGap,
        },
        onDimension,
        extensionEnd: {
          x: onDimension.x + ux * extension,
          y: onDimension.y + uy * extension,
        },
      };
    });
    return {
      a,
      b,
      d,
      points: projectedPoints,
      text: { x: (a.x + b.x) / 2 + d.x * (Number(dimension?.labelOffsetU) || 0), y: (a.y + b.y) / 2 + d.y * (Number(dimension?.labelOffsetU) || 0) },
      hitA: { x: a.x - d.x * tick, y: a.y - d.y * tick },
      hitB: { x: b.x + d.x * tick, y: b.y + d.y * tick },
    };
  }

  function drawArrowhead(point, direction) {
    const size = 10 / viewport.scale;
    const wing = 4.5 / viewport.scale;
    const n = { x: -direction.y, y: direction.x };
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x + direction.x * size + n.x * wing, point.y + direction.y * size + n.y * wing);
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x + direction.x * size - n.x * wing, point.y + direction.y * size - n.y * wing);
    ctx.stroke();
  }

  function drawDimensions() {
    for (const c of model.constraints) {
      const target = targetFromConstraint(c);
      if (!target) continue;
      const dimension = c.dimension || defaultDimensionForTarget(target);
      const highlighted = c === hoveredDimensionConstraint || c === selectedDimensionConstraint || c === dimensionDragSession?.constraint;
      drawDimension(target, dimension, Number(c.target).toFixed(2), false, highlighted);
    }
  }

  function drawDimensionPreview() {
    if (pendingCommand?.type === "fillet-radius-value") {
      const value = Number(pendingCommand.buffer);
      const radius = Number.isFinite(value) && value > 0 ? value : DEFAULT_FILLET_RADIUS;
      const geometry = computeFilletGeometry(pendingCommand.line1, pendingCommand.line2, radius);
      if (!geometry.ok) return;
      const primitive = {
        id: "R",
        center: geometry.center,
        radius: () => geometry.radius,
      };
      const target = { kind: "radius", primitive, value: radius };
      const anchor = {
        x: geometry.center.x + Math.cos((geometry.startAngle + geometry.endAngle) / 2) * geometry.radius,
        y: geometry.center.y + Math.sin((geometry.startAngle + geometry.endAngle) / 2) * geometry.radius,
      };
      drawFilletPreviewArc(geometry);
      const invalid = pendingCommand.buffer === "" || !Number.isFinite(value) || value <= 0 || !geometry.ok;
      drawDimension(target, dimensionFromAnchor(target, anchor), `R${pendingCommand.buffer || "_"}|`, true, false, {
        selecting: !pendingCommand.editing,
        invalid,
      });
      return;
    }
    if (!pendingCommand?.type?.startsWith("distance")) return;
    const dimension = pendingCommand.type === "distance-place" ? (pendingCommand.pointer ? dimensionFromAnchor(pendingCommand.target, pendingCommand.pointer) : defaultDimensionForTarget(pendingCommand.target)) : pendingCommand.dimension;
    if (pendingCommand.type === "distance-value") {
      const value = Number(pendingCommand.buffer);
      const invalid = pendingCommand.buffer === "" || !Number.isFinite(value) || value <= 0;
      drawDimension(pendingCommand.target, dimension, `${pendingCommand.buffer || "_"}|`, true, false, {
        selecting: !pendingCommand.editing,
        invalid,
      });
      return;
    }
    const previewTarget =
      pendingCommand.target.kind === "point-point" && (dimension.axis === "x" || dimension.axis === "y")
        ? { ...pendingCommand.target, dimensionAxis: dimension.axis }
        : pendingCommand.target;
    const previewValue =
      previewTarget.kind === "point-point" && previewTarget.dimensionAxis === "x"
        ? Math.abs(previewTarget.p2.x - previewTarget.p1.x)
        : previewTarget.kind === "point-point" && previewTarget.dimensionAxis === "y"
          ? Math.abs(previewTarget.p2.y - previewTarget.p1.y)
          : previewTarget.value;
    drawDimension(previewTarget, dimension, Number(previewValue).toFixed(2), true);
  }

  function drawFilletPreviewArc(geometry) {
    ctx.save();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2 / viewport.scale;
    ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
    ctx.beginPath();
    ctx.arc(geometry.center.x, geometry.center.y, geometry.radius, geometry.startAngle, geometry.endAngle, geometry.endAngle < geometry.startAngle);
    ctx.stroke();
    ctx.restore();
  }

  function drawTemporaryLine() {
    if (mode !== "line" || !lineStartPoint) return;
    const target = pointerPreview || lineStartPoint;
    ctx.save();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2 / viewport.scale;
    ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
    ctx.beginPath();
    ctx.moveTo(lineStartPoint.x, lineStartPoint.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(lineStartPoint.x, lineStartPoint.y, 12 / viewport.scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawRectanglePreview() {
    if (mode !== "rectangle" || !rectangleStartPoint || !pointerPreview) return;
    ctx.save();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2 / viewport.scale;
    ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
    ctx.strokeRect(rectangleStartPoint.x, rectangleStartPoint.y, pointerPreview.x - rectangleStartPoint.x, pointerPreview.y - rectangleStartPoint.y);
    ctx.restore();
  }

  function drawCirclePreview() {
    if (mode !== "circle" || !circleCenterPoint || !pointerPreview) return;
    const radius = hypot2(pointerPreview.x - circleCenterPoint.x, pointerPreview.y - circleCenterPoint.y);
    ctx.save();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2 / viewport.scale;
    ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
    ctx.beginPath();
    ctx.arc(circleCenterPoint.x, circleCenterPoint.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawArcPreview() {
    if (mode !== "arc" || !arcCenterPoint) return;
    if (!arcStartPoint) {
      drawConstructionPoint(arcCenterPoint);
      return;
    }
    if (!pointerPreview) return;
    const angles = {
      start: arcStartPoint.startAngle,
      end: shortestAngleFrom(arcStartPoint.startAngle, Math.atan2(pointerPreview.y - arcCenterPoint.y, pointerPreview.x - arcCenterPoint.x)),
    };
    ctx.save();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2 / viewport.scale;
    ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
    ctx.beginPath();
    ctx.arc(arcCenterPoint.x, arcCenterPoint.y, arcStartPoint.radius, angles.start, angles.end, angles.end < angles.start);
    ctx.stroke();
    ctx.restore();
    drawConstructionPoint(arcCenterPoint);
  }

  function drawSnapMarker() {
    if (!activeSnap) return;
    ctx.save();
    const r = 6 / viewport.scale;
    ctx.strokeStyle = "#f59e0b";
    ctx.fillStyle = "#f59e0b";
    ctx.lineWidth = 1.5 / viewport.scale;
    ctx.beginPath();
    ctx.moveTo(activeSnap.x - r, activeSnap.y);
    ctx.lineTo(activeSnap.x + r, activeSnap.y);
    ctx.moveTo(activeSnap.x, activeSnap.y - r);
    ctx.lineTo(activeSnap.x, activeSnap.y + r);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(activeSnap.x, activeSnap.y, 3 / viewport.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${11 / viewport.scale}px system-ui`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(activeSnap.label, activeSnap.x + 8 / viewport.scale, activeSnap.y - 8 / viewport.scale);
    ctx.restore();
  }

  function drawConstructionPoint(point) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5 / viewport.scale, 0, Math.PI * 2);
    ctx.fillStyle = "#eff6ff";
    ctx.fill();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2 / viewport.scale;
    ctx.stroke();
    ctx.restore();
  }

  function shouldShowPrimitiveCenter(point) {
    if (selectedCircles.some((circle) => circle.center === point) || selectedArcs.some((arc) => arc.center === point)) return true;
    if (hoveredCircle?.center === point || hoveredArc?.center === point || hoveredArcEndpoint?.arc?.center === point) return true;
    if ((dragSession?.kind === "circle" || dragSession?.kind === "arc" || dragSession?.kind === "arc-endpoint") && dragSession.item?.center === point) return true;
    return false;
  }

  function shouldShowArcEndpointHandle(arc, endpoint) {
    if (selectedArcs.includes(arc) || hoveredArc === arc) return true;
    if (sameArcEndpoint(hoveredArcEndpoint, { arc, endpoint }) || sameArcEndpoint(selectedArcEndpoint, { arc, endpoint })) return true;
    if (selectedArcEndpointPair?.some((item) => sameArcEndpoint(item, { arc, endpoint }))) return true;
    if (dragSession?.kind === "arc-endpoint" && dragSession.item === arc && dragSession.endpoint === endpoint) return true;
    return false;
  }

  function drawArcEndpointHandles() {
    ctx.save();
    for (const arc of model.arcs) {
      for (const endpoint of ["start", "end"]) {
        if (!shouldShowArcEndpointHandle(arc, endpoint)) continue;
        const p = arcEndpointPoint(arc, endpoint);
        const selected = sameArcEndpoint(selectedArcEndpoint, { arc, endpoint }) || selectedArcEndpointPair?.some((item) => sameArcEndpoint(item, { arc, endpoint })) || (dragSession?.kind === "arc-endpoint" && dragSession.item === arc && dragSession.endpoint === endpoint);
        const hovered = sameArcEndpoint(hoveredArcEndpoint, { arc, endpoint });
        const fixed = Boolean(findArcEndpointFixedConstraint(arc, endpoint));
        ctx.beginPath();
        ctx.arc(p.x, p.y, (selected ? 7 : 5) / viewport.scale, 0, Math.PI * 2);
        ctx.fillStyle = fixed ? "#fee2e2" : selected ? "#2563eb" : hovered ? "#eff6ff" : "#fff";
        ctx.fill();
        ctx.strokeStyle = fixed ? "#dc2626" : selected || hovered ? "#2563eb" : "#111827";
        ctx.lineWidth = 2 / viewport.scale;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawPoints() {
    for (const p of model.points) {
      if (!isExplicitPoint(p) && !isPointUsedByPrimitive(p) && !isReferencePoint(p)) continue;
      const sel = selectedPoints.includes(p);
      const endpoint = isEndpointPoint(p);
      const hovered = hoveredPoint === p || hoveredEndpointPoint === p;
      const dragging = dragSession?.kind === "point" && dragSession.points.some((target) => target.point === p);
      const primitiveCenter = shouldShowPrimitiveCenter(p);
      const fixedByLine = pointLockedByLineFixed(p);
      const reference = isReferencePoint(p);
      if (reference && !sel && !hovered && !dragging) continue;
      if (endpoint && !reference && !sel && !hovered && !dragging && !primitiveCenter) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (sel ? 7 : endpoint || reference ? 5 : 5) / viewport.scale, 0, Math.PI * 2);
      ctx.fillStyle = p.fixed || fixedByLine ? "#fee2e2" : sel ? "#2563eb" : hovered || primitiveCenter || reference ? "#eff6ff" : "#fff";
      ctx.fill();
      ctx.strokeStyle = p.fixed || fixedByLine ? "#dc2626" : constraintStatusColor(p, sel, hovered || primitiveCenter || reference);
      ctx.lineWidth = (endpoint ? 2 : 2) / viewport.scale;
      ctx.stroke();
      ctx.setLineDash([]);
      if (sel || hovered || dragging) {
        ctx.fillStyle = hovered || endpoint ? "#2563eb" : "#111827";
        ctx.font = `${12 / viewport.scale}px system-ui`;
        ctx.fillText(p.id, p.x + 8 / viewport.scale, p.y - 8 / viewport.scale);
      }

      if (p.fixed) {
        ctx.fillStyle = "#dc2626";
        ctx.fillText("固定", p.x + 8 / viewport.scale, p.y + 8 / viewport.scale);
      }
    }
  }

  function updateToolbar() {
    document.getElementById("toolSelect").classList.toggle("active", mode === "select");
    document.getElementById("toolPoint").classList.toggle("active", mode === "point");
    document.getElementById("toolLine").classList.toggle("active", mode === "line");
    document.getElementById("toolRectangle")?.classList.toggle("active", mode === "rectangle");
    document.getElementById("toolFillet")?.classList.toggle("active", mode === "fillet");
    document.getElementById("toolCircle").classList.toggle("active", mode === "circle");
    document.getElementById("toolArc").classList.toggle("active", mode === "arc");
  }

  function canApplyConstraint(type) {
    const primitives = selectedPrimitives();
    const coincidentPrimitives = selectedArcEndpoint ? primitives.filter((p) => p !== selectedArcEndpoint.arc) : primitives;
    if (type === "distance") {
      const target = distanceTargetFromSelection();
      return Boolean(target && target.kind !== "invalid");
    }
    if (type === "concentric") return (selectedPoints.length === 1 && selectedLines.length === 0 && primitives.length === 1) || (selectedPoints.length === 0 && selectedLines.length === 0 && primitives.length === 2);
    if (type === "equal") return (selectedLines.length === 2 && selectedPoints.length === 0 && primitives.length === 0) || (selectedPoints.length === 0 && selectedLines.length === 0 && primitives.length === 2);
    if (type === "equalRadius") return selectedPoints.length === 0 && selectedLines.length === 0 && primitives.length === 2;
    if (type === "pointOnCircle") return selectedPoints.length === 1 && selectedLines.length === 0 && primitives.length === 1;
    if (type === "tangent") return (selectedPoints.length === 0 && selectedLines.length === 1 && primitives.length === 1) || (selectedPoints.length === 0 && selectedLines.length === 0 && primitives.length === 2);
    if (type === "coincident") {
      if (selectedArcEndpointPair?.length === 2) return true;
      if ((selectedPoints.length === 2 && selectedLines.length === 0) || (selectedPoints.length === 1 && selectedLines.length === 1) || (selectedPoints.length === 1 && selectedLines.length === 0 && coincidentPrimitives.length === 1)) return true;
      return Boolean(selectedArcEndpoint && ((selectedPoints.length === 1 && selectedLines.length === 0 && coincidentPrimitives.length === 0) || (selectedPoints.length === 0 && selectedLines.length === 1 && coincidentPrimitives.length === 0) || (selectedPoints.length === 0 && selectedLines.length === 0 && coincidentPrimitives.length === 1)));
    }
    if (type === "horizontal" || type === "vertical") return selectedLines.length === 1 && lineHasDirection(selectedLines[0]);
    if (type === "parallel" || type === "perpendicular") return selectedLines.length === 2 && selectedLines.every(lineHasDirection);
    if (type === "collinear") return selectedLines.length === 2 && selectedLines.every(lineHasDirection);
    return false;
  }

  function canCompleteConstraintCommand(type) {
    if (type !== "distance") return canApplyConstraint(type);
    const target = distanceTargetFromSelection();
    if (!target || target.kind === "invalid") return false;
    return target.kind !== "line-length" || !pendingConstraintCommand;
  }

  function constraintLabel(type) {
    const btn = constraintButtons.find((b) => b.dataset.constraint === type);
    return btn?.dataset.label || btn?.title || type;
  }

  function constraintTargetHint(type) {
    if (type === "distance") return "寸法対象を選択してください。線長はEnter、または同じ線をダブルクリックで確定できます。";
    if (type === "concentric") return "同心にする円/円弧を2つ、または点と円/円弧を選択してください";
    if (type === "equalRadius") return "同じ半径にする円または円弧を2つ選択してください";
    if (type === "pointOnCircle") return "円周上に置く点と、円または円弧を選択してください";
    if (type === "tangent") return "接線にする線と円/円弧、または円/円弧を2つ選択してください";
    if (type === "coincident") return "一致させる点同士、点と線、または点と円周を選択してください";
    if (type === "collinear") return "同一直線上にする線を2本選択してください";
    if (type === "equal") return "等寸にする線2本、または同じ半径にする円/円弧を2つ選択してください";
    if (type === "horizontal") return "水平にする線を1本選択してください";
    if (type === "vertical") return "垂直にする線を1本選択してください";
    if (type === "parallel") return "平行にする線を2本選択してください";
    if (type === "perpendicular") return "直交させる線を2本選択してください";
    return `${constraintLabel(type)} の対象を選択してください`;
  }

  function invalidConstraintTargetHint(type) {
    if (type === "concentric") return "この拘束では円/円弧を2つ、または点と円/円弧を選択してください";
    if (type === "equalRadius") return "この拘束では円または円弧を2つ選択してください";
    if (type === "pointOnCircle") return "この拘束では点と円または円弧を選択してください";
    if (type === "tangent") return "この拘束では線と円/円弧、または円/円弧を2つ選択してください";
    if (type === "coincident") return "この拘束では点、線、円または円弧を選択してください";
    if (type === "collinear") return "この拘束では線を2本選択してください";
    if (type === "equal") return "この拘束では線2本、または円/円弧を2つ選択してください";
    if (type === "horizontal" || type === "vertical" || type === "parallel" || type === "perpendicular") {
      return "この拘束では線を選択してください";
    }
    if (type === "distance") return "寸法対象として点または線を選択してください";
    return "この拘束では選択できません";
  }

  function trimConstraintSelection(type) {
    const trimPrimitives = (count) => {
      const primitives = selectedPrimitives().slice(0, count);
      selectedCircles = primitives.filter((p) => p instanceof Circle);
      selectedArcs = primitives.filter((p) => p instanceof Arc);
    };
    if (type === "coincident") {
      selectedPoints = selectedPoints.slice(0, 2);
      selectedLines = selectedPoints.length >= 2 ? [] : selectedLines.slice(0, 1);
      trimPrimitives(selectedPoints.length === 1 && selectedLines.length === 0 ? 1 : 0);
    } else if (type === "horizontal" || type === "vertical") {
      selectedPoints = [];
      selectedCircles = [];
      selectedArcs = [];
      selectedLines = selectedLines.slice(0, 1);
    } else if (type === "parallel" || type === "perpendicular") {
      selectedPoints = [];
      selectedCircles = [];
      selectedArcs = [];
      selectedLines = selectedLines.slice(0, 2);
      selectedArcEndpoint = null;
    } else if (type === "collinear") {
      selectedPoints = [];
      selectedCircles = [];
      selectedArcs = [];
      selectedArcEndpoint = null;
      selectedLines = selectedLines.slice(0, 2);
    } else if (type === "equal" || type === "equalRadius") {
      selectedPoints = [];
      selectedArcEndpoint = null;
      if (selectedLines.length > 0) {
        selectedLines = selectedLines.slice(0, 2);
        selectedCircles = [];
        selectedArcs = [];
      } else {
        selectedLines = [];
        trimPrimitives(2);
      }
    } else if (type === "concentric" || type === "pointOnCircle") {
      selectedPoints = selectedPoints.slice(0, 1);
      selectedLines = [];
      trimPrimitives(type === "concentric" && selectedPoints.length === 0 ? 2 : 1);
    } else if (type === "tangent") {
      selectedPoints = [];
      selectedLines = selectedLines.slice(0, 1);
      trimPrimitives(selectedLines.length === 1 ? 1 : 2);
    } else if (type === "distance") {
      selectedPoints = selectedPoints.slice(0, 2);
      selectedLines = selectedLines.slice(0, 2);
      trimPrimitives(1);
      if (selectedPoints.length > 0 && selectedLines.length > 0) {
        selectedPoints = selectedPoints.slice(0, 1);
        selectedLines = selectedLines.slice(0, 1);
        selectedCircles = [];
        selectedArcs = [];
      }
    }
  }

  function startConstraintTargetCommand(type) {
    cancelPendingCommand("");
    if (pendingConstraintCommand?.type === type) {
      cancelConstraintTargetCommand(`${constraintLabel(type)}の対象選択をキャンセルしました`);
      return;
    }
    pendingConstraintCommand = { type };
    trimConstraintSelection(type);
    updateConstraintButtons();
    setHint(constraintTargetHint(type));
    draw();
  }

  function cancelConstraintTargetCommand(message = "拘束対象の選択をキャンセルしました") {
    if (!pendingConstraintCommand) return;
    pendingConstraintCommand = null;
    if (message) setHint(message);
    updateConstraintButtons();
    draw();
  }

  function executeConstraintCommandIfReady() {
    if (!pendingConstraintCommand) return false;
    const type = pendingConstraintCommand.type;
    if (!canCompleteConstraintCommand(type)) {
      const target = type === "distance" ? distanceTargetFromSelection() : null;
      if (target?.kind === "invalid") {
        setHint(target.reason, "error");
        return false;
      }
      if (target?.kind === "line-length") {
        setHint("線長寸法はEnter、または同じ線をダブルクリックで確定できます。点または別の線をクリックすると距離寸法になります。");
        return false;
      }
      setHint(constraintTargetHint(type));
      return false;
    }
    updateConstraintButtons();
    addConstraint(type);
    return true;
  }

  function completePendingDimensionLineLength() {
    if (pendingConstraintCommand?.type !== "distance") return false;
    const target = distanceTargetFromSelection();
    if (!target || target.kind !== "line-length") return false;
    updateConstraintButtons();
    startDistanceCommand();
    return true;
  }

  function pushPrimitiveSelection(primitive) {
    if (!primitive) return;
    if (primitive instanceof Circle) {
      if (!selectedCircles.includes(primitive)) selectedCircles.push(primitive);
    } else if (primitive instanceof Arc) {
      if (!selectedArcs.includes(primitive)) selectedArcs.push(primitive);
    }
  }

  function handleConstraintTargetClick(hitP, hitL, hitC, hitA, hitArcEnd) {
    if (!pendingConstraintCommand) return false;
    const type = pendingConstraintCommand.type;
    selectedDimensionConstraint = null;
    const hitPrimitive = hitC || hitA;

    if (type === "coincident") {
      if (!hitP && !hitL && !hitPrimitive && !hitArcEnd) {
        setHint(invalidConstraintTargetHint(type), "error");
        return true;
      }
      if (hitArcEnd) {
        const next = { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint };
        if (selectedArcEndpoint && !sameArcEndpoint(selectedArcEndpoint, next)) selectedArcEndpointPair = [selectedArcEndpoint, next];
        selectedArcEndpoint = next;
      } else if (hitP) {
        selectedArcEndpointPair = null;
        if (!selectedPoints.includes(hitP)) selectedPoints.push(hitP);
        selectedPoints = selectedPoints.slice(-2);
        if (selectedPoints.length >= 2) selectedLines = [];
      } else if (hitL) {
        selectedArcEndpointPair = null;
        selectedLines = [hitL];
        selectedPoints = selectedPoints.slice(0, 1);
        selectedCircles = [];
        selectedArcs = [];
      } else if (hitPrimitive) {
        selectedArcEndpointPair = null;
        pushPrimitiveSelection(hitPrimitive);
        selectedPoints = selectedPoints.slice(0, 1);
        selectedLines = [];
      }
    } else if (type === "horizontal" || type === "vertical") {
      if (!hitL) {
        setHint(invalidConstraintTargetHint(type), "error");
        return true;
      }
      if (!lineHasDirection(hitL)) {
        setHint("向き拘束の対象線が短すぎます", "error");
        return true;
      }
      selectedLines = [hitL];
      selectedPoints = [];
    } else if (type === "parallel" || type === "perpendicular" || type === "collinear") {
      if (!hitL) {
        setHint(invalidConstraintTargetHint(type), "error");
        return true;
      }
      if (!lineHasDirection(hitL)) {
        setHint("向き拘束の対象線が短すぎます", "error");
        return true;
      }
      selectedPoints = [];
      if (!selectedLines.includes(hitL)) selectedLines.push(hitL);
      selectedLines = selectedLines.slice(-2);
    } else if (type === "distance") {
      if (!hitP && !hitL && !hitPrimitive) {
        const target = distanceTargetFromSelection();
        if (target?.kind === "line-length") {
          setHint("線の長さ寸法は、配置したい位置をダブルクリックしてください");
          return true;
        }
        setHint(invalidConstraintTargetHint(type), "error");
        return true;
      }
      if (hitP) {
        if (!selectedPoints.includes(hitP)) selectedPoints.push(hitP);
        selectedPoints = selectedPoints.slice(-2);
        selectedLines = selectedLines.slice(0, 1);
      } else if (hitL) {
        if (!selectedLines.includes(hitL)) selectedLines.push(hitL);
        selectedLines = selectedLines.slice(-2);
        selectedPoints = selectedPoints.slice(0, 1);
        selectedCircles = [];
        selectedArcs = [];
      } else if (hitPrimitive) {
        selectedPoints = [];
        selectedLines = [];
        selectedCircles = [];
        selectedArcs = [];
        pushPrimitiveSelection(hitPrimitive);
      }
      trimConstraintSelection(type);
    } else if (type === "equal") {
      if (hitL) {
        selectedPoints = [];
        selectedCircles = [];
        selectedArcs = [];
        if (!selectedLines.includes(hitL)) selectedLines.push(hitL);
        selectedLines = selectedLines.slice(-2);
      } else if (hitPrimitive) {
        selectedPoints = [];
        selectedLines = [];
        pushPrimitiveSelection(hitPrimitive);
      } else {
        setHint(invalidConstraintTargetHint(type), "error");
        return true;
      }
      trimConstraintSelection(type);
    } else if (type === "concentric" || type === "equalRadius" || type === "pointOnCircle" || type === "tangent") {
      if (hitP && (type === "concentric" || type === "pointOnCircle")) {
        if (!selectedPoints.includes(hitP)) selectedPoints.push(hitP);
        selectedPoints = selectedPoints.slice(-1);
      } else if (hitL && type === "tangent") {
        selectedLines = [hitL];
      } else if (hitPrimitive) {
        pushPrimitiveSelection(hitPrimitive);
      } else {
        setHint(invalidConstraintTargetHint(type), "error");
        return true;
      }
      trimConstraintSelection(type);
    }

    updateUI();
    if (!executeConstraintCommandIfReady()) draw();
    return true;
  }

  function handleConstraintTargetDoubleClick(hitP, hitL, pointer) {
    if (pendingConstraintCommand?.type !== "distance") return false;
    if (selectedPoints.length !== 0 || selectedLines.length !== 1) return false;
    if (hitL && selectedLines[0] !== hitL) return false;
    updateConstraintButtons();
    startDistanceCommand();
    if (pendingCommand?.type === "distance-place") startDistanceValueInput(defaultDimensionForTarget(pendingCommand.target));
    return true;
  }

  function startDistanceCommand() {
    const target = distanceTargetFromSelection();
    if (!target) return;
    if (target.kind === "invalid") {
      setHint(target.reason, "error");
      log(target.reason);
      return;
    }
    pendingCommand = { type: "distance-place", target, pointer: defaultDimensionForTarget(target) };
    setHint("寸法線の位置をクリックしてください");
    draw();
  }

  function startPrimitiveDimensionCommand(kind) {
    const primitive = selectedPrimitives()[0];
    if (!primitive) return;
    const value = kind === "diameter" ? primitive.radius() * 2 : primitive.radius();
    pendingCommand = { type: "distance-place", target: { kind, primitive, value }, pointer: defaultDimensionForTarget({ kind, primitive, value }) };
    setHint("寸法線の位置をクリックしてください");
    draw();
  }

  function cancelPendingCommand(message = "コマンドをキャンセルしました") {
    if (!pendingCommand) return;
    pendingCommand = null;
    hideDimensionValueInput();
    if (message) setHint(message);
    draw();
  }

  function startDistanceValueInput(pointer) {
    if (!pendingCommand || pendingCommand.type !== "distance-place") return;
    const dimension = dimensionFromAnchor(pendingCommand.target, pointer);
    const target = { ...pendingCommand.target, dimensionAxis: dimension.axis };
    const value =
      pendingCommand.target.kind === "point-point" && dimension.axis === "x"
        ? Math.abs(pendingCommand.target.p2.x - pendingCommand.target.p1.x)
        : pendingCommand.target.kind === "point-point" && dimension.axis === "y"
          ? Math.abs(pendingCommand.target.p2.y - pendingCommand.target.p1.y)
          : pendingCommand.target.value;
    pendingCommand = {
      type: "distance-value",
      target,
      dimension,
      buffer: String(value),
      editing: false,
    };
    setHint("寸法値を入力中: 数値キーで編集、Enter/ダブルクリックで決定、Escでキャンセル");
    draw();
    focusDimensionValueInput();
  }

  function retargetPendingLineLengthDimension(hitP, hitL, pointer) {
    if (pendingCommand?.type !== "distance-place" || pendingCommand.target.kind !== "line-length") return false;
    const baseLine = pendingCommand.target.line;
    if (hitP) {
      if (!lineHasDirection(baseLine)) {
        setHint("寸法対象の線が短すぎます", "error");
        return true;
      }
      selectedPoints = [hitP];
      selectedLines = [baseLine];
      selectedCircles = [];
      selectedArcs = [];
      pendingCommand = {
        type: "distance-place",
        target: { kind: "point-line", point: hitP, line: baseLine, value: Math.abs(signedPointLineDistance(hitP, baseLine)) },
        pointer,
      };
      setHint("点と線の寸法線の位置をクリックしてください");
      updateUI();
      draw();
      return true;
    }
    if (hitL && hitL !== baseLine) {
      if (!lineHasDirection(baseLine) || !lineHasDirection(hitL)) {
        setHint("線-線寸法の対象線が短すぎます", "error");
        return true;
      }
      if (!linesAreParallel(baseLine, hitL)) {
        setHint("線-線寸法は平行線のみです", "error");
        return true;
      }
      selectedPoints = [];
      selectedLines = [baseLine, hitL];
      selectedCircles = [];
      selectedArcs = [];
      pendingCommand = {
        type: "distance-place",
        target: { kind: "line-line", line1: baseLine, line2: hitL, value: Math.abs(signedPointLineDistance(hitL.p1, baseLine)) },
        pointer,
      };
      setHint("線と線の寸法線の位置をクリックしてください");
      updateUI();
      draw();
      return true;
    }
    return false;
  }

  function startDimensionEditInput(hit) {
    if (!hit?.constraint) return false;
    const target = targetFromConstraint(hit.constraint);
    if (!target) return false;
    pendingCommand = {
      type: "distance-value",
      target,
      dimension: hit.constraint.dimension || hit.dimension || defaultDimensionForTarget(target),
      buffer: String(Number(hit.constraint.target).toFixed(3)),
      editing: false,
      constraint: hit.constraint,
    };
    selectedDimensionConstraint = hit.constraint;
    dimensionDragSession = null;
    setHint("寸法値を入力中: 数値キーで編集、Enter/ダブルクリックで決定、Escでキャンセル");
    draw();
    focusDimensionValueInput();
    return true;
  }

  function updateDistanceBufferLabel() {
    if (!pendingCommand || (pendingCommand.type !== "distance-value" && pendingCommand.type !== "fillet-radius-value")) return;
    setHint("寸法値を入力中: 数値キーで編集、Enter/ダブルクリックで決定、Escでキャンセル");
    draw();
  }

  function submitDistanceValue() {
    if (!pendingCommand || pendingCommand.type !== "distance-value") return;
    const value = Number(pendingCommand.buffer);
    if (!Number.isFinite(value) || value <= 0) {
      setHint("寸法値には0より大きい数値を入力してください", "error");
      draw();
      return;
    }
    const { target, dimension, constraint } = pendingCommand;
    pendingCommand = null;
    hideDimensionValueInput();
    if (constraint) {
      const snapshot = snapshotModelState();
      const previousTarget = constraint.target;
      constraint.target = value;
      const result = solver.solve();
      normalizeArcSweeps();
      if (!result.success || result.errorNorm > CONSTRAINT_ACCEPT_ERROR) {
        restoreModelState(snapshot);
        constraint.target = previousTarget;
        setHint(`寸法値を更新できません: 矛盾しています (error=${result.errorNorm.toExponential(3)})`, "error");
      } else {
        setHint(`寸法値更新: success=${result.success}, error=${result.errorNorm.toExponential(2)}, iter=${result.iterations}`);
      }
      updateUI();
      draw();
      return;
    }
    addDistanceConstraintFromTarget(target, value, dimension);
  }

  function handleDistanceKey(e) {
    if (!pendingCommand) return false;
    if (e.key === "Escape") {
      e.preventDefault();
      cancelPendingCommand("寸法入力をキャンセルしました");
      return true;
    }
    if (pendingCommand.type === "distance-place" && e.key === "Enter") {
      e.preventDefault();
      startDistanceValueInput(pendingCommand.pointer || defaultDimensionForTarget(pendingCommand.target));
      return true;
    }
    if (pendingCommand.type !== "distance-value" && pendingCommand.type !== "fillet-radius-value") return false;
    if (e.key === "Enter") {
      e.preventDefault();
      if (pendingCommand.type === "fillet-radius-value") submitFilletRadiusValue();
      else submitDistanceValue();
      return true;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      pendingCommand.buffer = pendingCommand.buffer.slice(0, -1);
      pendingCommand.editing = true;
      updateDistanceBufferLabel();
      return true;
    }
    if (e.key === "Delete") {
      e.preventDefault();
      pendingCommand.buffer = "";
      pendingCommand.editing = true;
      updateDistanceBufferLabel();
      return true;
    }
    if (/^[0-9.]$/.test(e.key)) {
      e.preventDefault();
      if (!pendingCommand.editing) {
        pendingCommand.buffer = "";
        pendingCommand.editing = true;
      }
      if (e.key === "." && pendingCommand.buffer.includes(".")) return true;
      pendingCommand.buffer += e.key;
      updateDistanceBufferLabel();
      return true;
    }
    return false;
  }

  function updateConstraintButtons() {
    if (pendingCommand?.type?.startsWith("distance")) {
      const target = distanceTargetFromSelection();
      if (!target || target.kind === "invalid") cancelPendingCommand("寸法入力をキャンセルしました");
    }

    for (const btn of constraintButtons) {
      btn.setAttribute("aria-disabled", "false");
      btn.classList.toggle("active", pendingConstraintCommand?.type === btn.dataset.constraint);
    }
    const canToggleFixed =
      Boolean(selectedArcEndpoint) ||
      (selectedPoints.length === 1 && selectedLines.length === 0 && selectedCircles.length === 0 && selectedArcs.length === 0) ||
      (selectedPoints.length === 0 && selectedLines.length === 1 && selectedCircles.length === 0 && selectedArcs.length === 0);
    fixPointBtn.setAttribute("aria-disabled", String(!canToggleFixed));

    const enabled = constraintButtons
      .filter((btn) => btn.getAttribute("aria-disabled") !== "true")
      .map((btn) => btn.dataset.label || btn.title);
    const help = enabled.length > 0 ? `追加可能: ${enabled.join(" / ")}` : "点または線を選択すると、追加できる拘束だけが有効になります。";
    document.getElementById("hint").title = help;
  }

  function updateUI() {
    refreshConstraintAnalysis();
    document.getElementById("pointList").innerHTML = model.points
      .filter(isExplicitPoint)
      .map(
        (p) =>
          `<div class="item list-item"><span>${p.id}` +
          `<span class="badge">x=${p.x.toFixed(1)}</span>` +
          `<span class="badge">y=${p.y.toFixed(1)}</span>` +
          `<span class="badge">${constraintStatusBadge(constraintStatusOf(p))}</span>` +
          `${p.fixed ? "<span class='badge'>固定</span>" : ""}</span>` +
          `<button data-id="${p.id}" class="removePointBtn icon-delete-btn" title="削除" aria-label="削除" data-tooltip="削除">` +
          `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>` +
          `</button></div>`,
      )
      .join("");

    document.getElementById("lineList").innerHTML = model.lines
      .map(
        (l) =>
          `<div class="item list-item"><span>${l.id}: ${l.p1.id} - ${l.p2.id}<span class="badge">len=${l.length().toFixed(2)}</span><span class="badge">${constraintStatusBadge(constraintStatusOf(l))}</span>${findLineFixedConstraint(l) ? "<span class='badge'>固定</span>" : ""}</span>` +
          `<button data-id="${l.id}" class="removeLineBtn icon-delete-btn" title="削除" aria-label="削除" data-tooltip="削除">` +
          `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>` +
          `</button></div>`,
      )
      .join("");

    document.getElementById("constraintList").innerHTML = `<div class="item constraint-item"><span>${constraintSummaryText()}</span></div>` + model.constraints
      .map(
        (c, i) =>
          `<div class="item constraint-item"><span>${i + 1}. ${c.name}</span>` +
          `<button data-idx="${i}" class="removeConstraintBtn" title="削除" aria-label="削除" data-tooltip="削除">` +
          `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>` +
          `</button></div>`,
      )
      .join("");

    for (const btn of document.querySelectorAll(".removeConstraintBtn")) {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.idx);
        deleteElements({ constraints: [model.constraints[i]] });
      });
    }

    for (const btn of document.querySelectorAll(".removePointBtn")) {
      btn.addEventListener("click", () => {
        const point = model.points.find((p) => p.id === btn.dataset.id);
        if (point) deleteElements({ points: [point] });
      });
    }

    for (const btn of document.querySelectorAll(".removeLineBtn")) {
      btn.addEventListener("click", () => {
        const line = model.lines.find((l) => l.id === btn.dataset.id);
        if (line) deleteElements({ lines: [line] });
      });
    }

    updateConstraintButtons();
  }

  function supportLineBasis(line) {
    if (line.orientationHint === "horizontal") {
      return { anchor: { x: line.p1.x, y: (line.p1.y + line.p2.y) / 2 }, nx: 0, ny: 1 };
    }
    if (line.orientationHint === "vertical") {
      return { anchor: { x: (line.p1.x + line.p2.x) / 2, y: line.p1.y }, nx: 1, ny: 0 };
    }
    const dx = line.p2.x - line.p1.x;
    const dy = line.p2.y - line.p1.y;
    const len = Math.hypot(dx, dy);
    if (len < MIN_ORIENTATION_LENGTH) return null;
    return { anchor: line.p1, nx: -dy / len, ny: dx / len };
  }

  function preconditionArcEndpointOnLineConstraint(constraint) {
    solver.syncLineOrientationHints?.();
    const basis = supportLineBasis(constraint.line);
    if (!basis) return;
    const arc = constraint.arc;
    const prop = constraint.endpoint === "start" ? "startAngle" : "endAngle";
    const current = arc[prop];
    let radius = arc.radius();
    const offset = basis.nx * (arc.center.x - basis.anchor.x) + basis.ny * (arc.center.y - basis.anchor.y);
    let k = -offset / radius;
    if (Math.abs(k) > 1 && !hasDirectRadiusDimension(arc)) {
      arc.radiusValue = Math.max(Math.abs(offset) + MIN_LINE_LENGTH, MIN_LINE_LENGTH);
      radius = arc.radius();
      k = -offset / radius;
    }
    if (Math.abs(k) > 1) return;

    const normalAngle = Math.atan2(basis.ny, basis.nx);
    const delta = Math.acos(Math.max(-1, Math.min(1, k)));
    const candidates = [normalAngle + delta, normalAngle - delta].map((angle) => unwrapAngleNear(angle, current));
    arc[prop] = candidates.reduce((best, angle) => (Math.abs(angle - current) < Math.abs(best - current) ? angle : best), candidates[0]);
  }

  function preconditionNewConstraint(constraint) {
    if (constraint instanceof ArcEndpointOnLineConstraint) {
      preconditionArcEndpointOnLineConstraint(constraint);
    }
  }

  function commitNewConstraint(type, constraint) {
    const snapshot = snapshotModelState();
    model.constraints.push(constraint);
    preconditionNewConstraint(constraint);

    const result = solver.solve();
    normalizeArcSweeps();
    if (!result.success || result.errorNorm > CONSTRAINT_ACCEPT_ERROR) {
      restoreModelState(snapshot);
      const msg = `拘束を追加できません: 矛盾しています (error=${result.errorNorm.toExponential(3)}, reason=${result.reason})`;
      setHint(msg, "error");
      updateUI();
      draw();
      log(msg);
      return;
    }

    clearSelection();
    updateUI();
    draw();
    setHint(`拘束追加: success=${result.success}, error=${result.errorNorm.toExponential(2)}, iter=${result.iterations} / ${constraintSummaryText()}`);
    log(`拘束を追加しました: ${type}\n自動solve: success=${result.success}, error=${result.errorNorm.toExponential(3)}`);
    return true;
  }

  function addDistanceConstraintFromTarget(target, value, dimension) {
    if (!target || target.kind === "invalid") return false;
    let constraint = null;
    if (target.kind === "point-point" || target.kind === "line-length") {
      const axis = target.dimensionAxis || dimension?.axis;
      if (target.kind === "point-point" && (axis === "x" || axis === "y")) {
        constraint = new PointAxisDistanceConstraint(target.p1, target.p2, value, axis);
      } else {
        constraint = new DistanceConstraint(target.p1, target.p2, value);
      }
    } else if (target.kind === "point-line") {
      constraint = new PointLineDistanceConstraint(target.point, target.line, value);
    } else if (target.kind === "line-line") {
      if (!linesAreParallel(target.line1, target.line2)) {
        setHint("線-線寸法は平行線のみです", "error");
        log("線-線寸法は平行線のみです");
        return false;
      }
      constraint = new LineLineDistanceConstraint(target.line1, target.line2, value);
    } else if (target.kind === "radius") {
      constraint = new RadiusConstraint(target.primitive, value);
    } else if (target.kind === "diameter") {
      constraint = new DiameterConstraint(target.primitive, value);
    }
    if (!constraint) return false;
    constraint.dimension = dimension;
    return commitNewConstraint("dimension", constraint);
  }

  function addConstraint(type) {
    if (!canApplyConstraint(type)) return;
    if (type === "distance") return startDistanceCommand();

    let constraint = null;
    const allPrimitives = selectedPrimitives();
    const primitives = type === "coincident" && selectedArcEndpoint ? allPrimitives.filter((p) => p !== selectedArcEndpoint.arc) : allPrimitives;
    if (type === "coincident") {
      const endpointPair = selectedArcEndpointPair;
      if (endpointPair?.length === 2) {
        constraint = new ArcEndpointArcEndpointCoincidentConstraint(endpointPair[0].arc, endpointPair[0].endpoint, endpointPair[1].arc, endpointPair[1].endpoint);
      } else if (selectedArcEndpoint && selectedPoints.length === 1) {
        constraint = new ArcEndpointCoincidentConstraint(selectedArcEndpoint.arc, selectedArcEndpoint.endpoint, selectedPoints[0]);
      } else if (selectedArcEndpoint && selectedLines.length === 1) {
        constraint = new ArcEndpointOnLineConstraint(selectedArcEndpoint.arc, selectedArcEndpoint.endpoint, selectedLines[0]);
      } else if (selectedArcEndpoint && primitives.length === 1) {
        constraint = new ArcEndpointOnCircleConstraint(selectedArcEndpoint.arc, selectedArcEndpoint.endpoint, primitives[0]);
      } else if (selectedPoints.length === 1 && selectedLines.length === 1) {
        constraint = new PointOnLineConstraint(selectedPoints[0], selectedLines[0]);
      } else if (selectedPoints.length === 1 && primitives.length === 1) {
        constraint = new PointOnCircleConstraint(selectedPoints[0], primitives[0]);
      } else {
        constraint = new CoincidentConstraint(selectedPoints[0], selectedPoints[1]);
      }
    } else if (type === "horizontal") {
      constraint = new HorizontalConstraint(selectedLines[0]);
    } else if (type === "vertical") {
      constraint = new VerticalConstraint(selectedLines[0]);
    } else if (type === "parallel") {
      constraint = new ParallelConstraint(selectedLines[0], selectedLines[1]);
    } else if (type === "perpendicular") {
      constraint = new PerpendicularConstraint(selectedLines[0], selectedLines[1]);
    } else if (type === "collinear") {
      constraint = new CollinearConstraint(selectedLines[0], selectedLines[1]);
    } else if (type === "equal") {
      if (selectedLines.length === 2) constraint = new EqualLengthConstraint(selectedLines[0], selectedLines[1]);
      else constraint = new EqualRadiusConstraint(primitives[0], primitives[1]);
    } else if (type === "concentric") {
      constraint = new ConcentricConstraint(selectedPoints[0] || primitives[0], primitives[selectedPoints.length === 1 ? 0 : 1]);
    } else if (type === "equalRadius") {
      constraint = new EqualRadiusConstraint(primitives[0], primitives[1]);
    } else if (type === "pointOnCircle") {
      constraint = new PointOnCircleConstraint(selectedPoints[0], primitives[0]);
    } else if (type === "tangent") {
      solver.syncLineOrientationHints?.();
      if (selectedLines.length === 1) constraint = new LineCircleTangentConstraint(selectedLines[0], primitives[0]);
      else constraint = new CircleCircleTangentConstraint(primitives[0], primitives[1]);
    }

    if (constraint) {
      selectedArcEndpointPair = null;
      commitNewConstraint(type, constraint);
    }
  }

  function buildDragSession(kind, item, pointer) {
    if (kind === "selection") {
      const points = item
        .filter((p, index, arr) => p && !p.fixed && !pointLockedByLineFixed(p) && arr.indexOf(p) === index)
        .map((p) => ({ point: p, startX: p.x, startY: p.y }));
      if (points.length === 0) return null;
      return { kind, startPointer: pointer, points };
    }

    if (kind === "point") {
      if (item.fixed || pointLockedByLineFixed(item)) return null;
      return {
        kind,
        startPointer: pointer,
        points: [{ point: item, startX: item.x, startY: item.y }],
      };
    }

    if (kind === "line" && findLineFixedConstraint(item)) return null;

    if (kind === "circle" || kind === "arc") {
      return {
        kind,
        mode: "radius",
        item,
        startPointer: pointer,
        startRadius: item.radius(),
        startCenterX: item.center.x,
        startCenterY: item.center.y,
      };
    }

    if (kind === "arc-endpoint") {
      if (findArcEndpointFixedConstraint(item.arc, item.endpoint)) return null;
      return {
        kind,
        mode: "arc-endpoint",
        item: item.arc,
        endpoint: item.endpoint,
        startPointer: pointer,
      };
    }

    const sourcePoints = [item.p1, item.p2];
    const points = sourcePoints
      .filter((p, index, arr) => !p.fixed && !pointLockedByLineFixed(p) && arr.indexOf(p) === index)
      .map((p) => ({ point: p, startX: p.x, startY: p.y }));
    if (points.length === 0) return null;
    return { kind, item, startPointer: pointer, points };
  }

  function dragSessionSeeds(session) {
    const seeds = [];
    if (!session) return seeds;
    if (session.item) {
      seeds.push(session.item);
      if (session.item.center) seeds.push(session.item.center);
    }
    for (const p of session.points || []) seeds.push(p.point);
    return seeds;
  }

  function attachLocalSolveContext(session) {
    if (!session) return session;
    session.local = localSolveContextFromSeeds(dragSessionSeeds(session));
    session.local.pointStarts = model.points
      .filter((p) => session.local.component.has(p) && !p.fixed && !pointLockedByLineFixed(p))
      .map((point) => ({ point, startX: point.x, startY: point.y }));
    session.local.fixedPointCount = model.points.filter((p) => session.local.component.has(p) && (p.fixed || pointLockedByLineFixed(p))).length;
    session.fullDragState = solver.clone(solver.getVariables());
    return session;
  }

  function selectedDragPoints() {
    const points = [...selectedPoints];
    for (const line of selectedLines) points.push(line.p1, line.p2);
    for (const circle of selectedCircles) points.push(circle.center);
    for (const arc of selectedArcs) points.push(arc.center);
    return points;
  }

  function selectedElementCount() {
    return selectedPoints.length + selectedLines.length + selectedCircles.length + selectedArcs.length + (selectedArcEndpoint ? 1 : 0);
  }

  function hitIsSelected(hitP, hitL, hitC, hitA, hitArcEnd) {
    if (hitP && selectedPoints.includes(hitP)) return true;
    if (hitL && selectedLines.includes(hitL)) return true;
    if (hitC && selectedCircles.includes(hitC)) return true;
    if (hitA && selectedArcs.includes(hitA)) return true;
    if (hitArcEnd && sameArcEndpoint(selectedArcEndpoint, { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint })) return true;
    return false;
  }

  function dragTargets(session, pointer) {
    const dx = pointer.x - session.startPointer.x;
    const dy = pointer.y - session.startPointer.y;
    return session.points.map((p) => ({ point: p.point, x: p.startX + dx, y: p.startY + dy }));
  }

  function localComponentMoveTargets(session, pointer) {
    const pointStarts = session?.local?.pointStarts || [];
    if (pointStarts.length === 0) return dragTargets(session, pointer);
    const dx = pointer.x - session.startPointer.x;
    const dy = pointer.y - session.startPointer.y;
    return pointStarts.map((p) => ({ point: p.point, x: p.startX + dx, y: p.startY + dy }));
  }

  function radiusDragTargets(session, pointer) {
    return [
      {
        object: session.item,
        prop: "radiusValue",
        value: hypot2(pointer.x - session.item.center.x, pointer.y - session.item.center.y),
        min: MIN_ORIENTATION_LENGTH,
      },
    ];
  }

  function primitiveMoveTargets(session, pointer) {
    if (session.item.center.fixed) return [];
    const dx = pointer.x - session.startPointer.x;
    const dy = pointer.y - session.startPointer.y;
    return [{ point: session.item.center, x: session.startCenterX + dx, y: session.startCenterY + dy }];
  }

  function primitiveGuidedMoveTargets(session, pointer, fallbackTargets) {
    const targets = localComponentMoveTargets(session, pointer);
    return targets.length > fallbackTargets.length ? targets : fallbackTargets;
  }

  function hasDirectRadiusDimension(primitive) {
    return model.constraints.some(
      (c) => c.enabled !== false && (c instanceof RadiusConstraint || c instanceof DiameterConstraint) && c.primitive === primitive,
    );
  }

  function arcEndpointDragTargets(session, pointer) {
    const prop = session.endpoint === "start" ? "startAngle" : "endAngle";
    const rawAngle = Math.atan2(pointer.y - session.item.center.y, pointer.x - session.item.center.x);
    const value = arcEndpointDragValue(session.item, session.endpoint, rawAngle);
    return [
      {
        object: session.item,
        prop,
        value,
      },
    ];
  }

  function dragConstraintsFromTargets(targets) {
    return targets.map((target) => new DragConstraint(target.point, target.x, target.y));
  }

  function parameterDragConstraintsFromTargets(targets) {
    return targets.map((target) => new ParameterDragConstraint(target.object, target.prop, target.value, target.min));
  }

  function solveLocalDrag(session, extra) {
    if (!session?.local) return null;
    return solver.solveSubset({
      variables: session.local.variables,
      constraints: session.local.constraints,
      lines: session.local.lines,
      extra,
    });
  }

  function solveLocalGuidedDrag(session, targets) {
    if (!session?.local) return null;
    return solver.solveSubsetGuided({
      variables: session.local.variables,
      constraints: session.local.constraints,
      lines: session.local.lines,
      targets,
    });
  }

  function solveDragWithFallback(session, extra, fullSolve, restoreState = null) {
    const localResult = solveLocalDrag(session, extra);
    if (localResult && localResult.success && localResult.errorNorm <= CONSTRAINT_ACCEPT_ERROR) return localResult;
    if (restoreState) solver.restore(restoreState);
    const result = fullSolve();
    result.local = false;
    result.fallback = Boolean(localResult);
    result.localErrorNorm = localResult?.errorNorm;
    return result;
  }

  function solveGuidedDragWithFallback(session, targets, fallbackExtra, fullSolve, restoreState = null) {
    const localResult = solveLocalGuidedDrag(session, targets);
    if (localResult && localResult.success && localResult.errorNorm <= CONSTRAINT_ACCEPT_ERROR) return localResult;
    if (restoreState) solver.restore(restoreState);
    const result = fullSolve();
    result.local = false;
    result.guided = false;
    result.fallback = Boolean(localResult);
    result.localErrorNorm = localResult?.errorNorm;
    return result;
  }

  function solveTranslatedComponentDrag(session, pointer) {
    if (!session?.local || session.local.fixedPointCount > 0) return null;
    const targets = localComponentMoveTargets(session, pointer);
    if (targets.length < 2) return null;
    for (const target of targets) {
      target.point.x = target.x;
      target.point.y = target.y;
    }
    const result = solver.solveSubset({
      variables: session.local.variables,
      constraints: session.local.constraints,
      lines: session.local.lines,
    });
    result.translated = true;
    return result;
  }

  function finalizeDragResult(result, state, session = null, extra = [], retry = null) {
    const lineRepair = enforceMinimumLineLengths(session?.local?.lines || model.lines);
    if (lineRepair.changed > 0) {
      result = retry ? retry() : session?.local ? solveDragWithFallback(session, extra, () => solver.solve(extra), state) : solver.solve(extra);
    }
    normalizeArcSweeps();
    result.lineRepair = lineRepair;
    if (lineRepair.failed) {
      solver.restore(state);
      result.blocked = true;
      result.success = false;
      result.reason = "R寸法と固定点によりこれ以上潰せません";
      result.lineRepair = lineRepair;
    }
    return result;
  }

  function dragResultForSession(session, pointer) {
    let result;
    const dragVars = session?.local?.variables || solver.getVariables();
    const dragState = solver.clone(dragVars);
    if (session.mode === "radius") {
      const moveTargets = primitiveMoveTargets(session, pointer);
      if (hasDirectRadiusDimension(session.item)) {
        session.activeMode = "move";
        const extra = dragConstraintsFromTargets(moveTargets);
        const translated = solveTranslatedComponentDrag(session, pointer);
        if (translated && translated.success && translated.errorNorm <= CONSTRAINT_ACCEPT_ERROR) return finalizeDragResult(translated, dragState, session, extra, () => solveTranslatedComponentDrag(session, pointer));
        if (translated) solver.restore(dragState);
        const targets = primitiveGuidedMoveTargets(session, pointer, moveTargets);
        const retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solver.solve(extra), dragState);
        result = retry();
        return finalizeDragResult(result, dragState, session, extra, retry);
      }

      const state = solver.clone(dragVars);
      let targets = radiusDragTargets(session, pointer);
      let extra = parameterDragConstraintsFromTargets(targets);
      let retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solver.solve(extra), dragState);
      result = retry();
      if (!result.success && moveTargets.length > 0) {
        solver.restore(state);
        session.activeMode = "move";
        targets = primitiveGuidedMoveTargets(session, pointer, moveTargets);
        extra = dragConstraintsFromTargets(moveTargets);
        retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solver.solve(extra), dragState);
        result = retry();
        return finalizeDragResult(result, dragState, session, extra, retry);
      }
      session.activeMode = "radius";
      return finalizeDragResult(result, dragState, session, extra, retry);
    }
    let targets;
    let extra;
    if (session.mode === "arc-endpoint") {
      targets = arcEndpointDragTargets(session, pointer);
      extra = parameterDragConstraintsFromTargets(targets);
    } else {
      const directTargets = dragTargets(session, pointer);
      targets = localComponentMoveTargets(session, pointer);
      extra = dragConstraintsFromTargets(directTargets);
      const translated = directTargets.length >= 2 ? solveTranslatedComponentDrag(session, pointer) : null;
      if (translated && translated.success && translated.errorNorm <= CONSTRAINT_ACCEPT_ERROR) return finalizeDragResult(translated, dragState, session, extra, () => solveTranslatedComponentDrag(session, pointer));
      if (translated) solver.restore(dragState);
    }
    const retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solver.solve(extra), dragState);
    result = retry();
    return finalizeDragResult(result, dragState, session, extra, retry);
  }

  function dragLabel(session) {
    if (session.kind === "selection") return "選択移動";
    if (session.mode === "radius" && session.activeMode === "move") return "ドラッグ";
    if (session.mode === "radius") return "半径変更";
    if (session.mode === "arc-endpoint") return "円弧端点変更";
    return "ドラッグ";
  }

  function beginDrag(e, hitP, hitL, hitC, hitA, hitArcEnd, pointer) {
    if (selectedElementCount() > 1 && hitIsSelected(hitP, hitL, hitC, hitA, hitArcEnd)) {
      dragSession = buildDragSession("selection", selectedDragPoints(), pointer);
      selectedDimensionConstraint = null;
    } else if (hitP) {
      selectedPoints = [hitP];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [];
      selectedArcEndpoint = null;
      dragSession = buildDragSession("point", hitP, pointer);
    } else if (hitArcEnd) {
      selectedArcs = [hitArcEnd.arc];
      selectedArcEndpoint = { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint };
      selectedPoints = [];
      selectedLines = [];
      selectedCircles = [];
      dragSession = buildDragSession("arc-endpoint", hitArcEnd, pointer);
    } else if (hitL) {
      selectedLines = [hitL];
      selectedPoints = [];
      selectedCircles = [];
      selectedArcs = [];
      selectedArcEndpoint = null;
      dragSession = buildDragSession("line", hitL, pointer);
    } else if (hitC) {
      selectedCircles = [hitC];
      selectedPoints = [];
      selectedLines = [];
      selectedArcs = [];
      selectedArcEndpoint = null;
      dragSession = buildDragSession("circle", hitC, pointer);
    } else if (hitA) {
      selectedArcs = [hitA];
      selectedPoints = [];
      selectedLines = [];
      selectedCircles = [];
      selectedArcEndpoint = null;
      dragSession = buildDragSession("arc", hitA, pointer);
    }

    if (dragSession) {
      attachLocalSolveContext(dragSession);
      canvas.classList.add("is-dragging");
      canvas.setPointerCapture(e.pointerId);
      setHint(`${dragLabel(dragSession)}中: 拘束を保ちながら自動solveしています`);
    }
  }

  function beginDimensionDrag(e, hit, pointer) {
    const anchor = dimensionAnchor(hit.target, hit.dimension);
    selectedDimensionConstraint = hit.constraint;
    dimensionDragSession = {
      pointerId: e.pointerId,
      constraint: hit.constraint,
      target: hit.target,
      part: hit.part || "line",
      startPointer: pointer,
      startAnchor: anchor,
      startLabelOffsetU: Number(hit.dimension?.labelOffsetU) || 0,
    };
    canvas.classList.add("is-dragging");
    canvas.setPointerCapture(e.pointerId);
    setHint("寸法線を移動中");
  }

  function orthogonalPointFrom(start, p) {
    const dx = p.x - start.x;
    const dy = p.y - start.y;
    return Math.abs(dx) >= Math.abs(dy) ? { x: p.x, y: start.y } : { x: start.x, y: p.y };
  }

  function addLineOrientationConstraint(line) {
    if (!line) return;
    const dx = Math.abs(line.p2.x - line.p1.x);
    const dy = Math.abs(line.p2.y - line.p1.y);
    model.constraints.push(dx >= dy ? new HorizontalConstraint(line) : new VerticalConstraint(line));
  }

  function handleLineClick(p, lockOrthogonal = false) {
    if (lineStartPoint && lockOrthogonal) p = orthogonalPointFrom(lineStartPoint, p);
    p = snapForDrawing(p);
    if (lineStartPoint) p = pointAtMinimumDistance(lineStartPoint, p);
    const endpoint = lineStartPoint && hypot2(p.x - lineStartPoint.x, p.y - lineStartPoint.y) <= MIN_LINE_LENGTH + 1e-9 ? addPoint(p.x, p.y, false, "endpoint") : endpointAt(p.x, p.y);
    pointerPreview = p;

    if (!lineStartPoint) {
      lineStartPoint = endpoint;
      selectedPoints = [endpoint];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [];
      setHint("次の端点をクリックすると線を作成します。終了はEscです。");
      updateUI();
      draw();
      return;
    }

    const l = addLine(lineStartPoint, endpoint);
    if (l) {
      if (lockOrthogonal) addLineOrientationConstraint(l);
      selectedPoints = [];
      selectedLines = [l];
      selectedCircles = [];
      selectedArcs = [];
      lineStartPoint = endpoint;
      const result = solveAndRefresh("線追加");
      clearSelection();
      updateUI();
      draw();
      log(`線 ${l.id} を追加しました\n自動solve: success=${result.success}`);
    } else {
      selectedPoints = [endpoint];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [];
      setHint("同じ端点です。別の位置をクリックしてください。終了はEscです。");
      updateUI();
      draw();
    }
  }

  function handleRectangleClick(p) {
    p = snapForDrawing(p);
    pointerPreview = p;
    if (!rectangleStartPoint) {
      rectangleStartPoint = endpointAt(p.x, p.y);
      selectedPoints = [rectangleStartPoint];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [];
      setHint("対角の角をクリックすると矩形を作成します。Escで選択モードに戻ります");
      updateUI();
      draw();
      return;
    }

    const rx = p.x - rectangleStartPoint.x;
    const ry = p.y - rectangleStartPoint.y;
    if (Math.abs(rx) < MIN_LINE_LENGTH) p = { ...p, x: rectangleStartPoint.x + (rx < 0 ? -MIN_LINE_LENGTH : MIN_LINE_LENGTH) };
    if (Math.abs(ry) < MIN_LINE_LENGTH) p = { ...p, y: rectangleStartPoint.y + (ry < 0 ? -MIN_LINE_LENGTH : MIN_LINE_LENGTH) };
    const p1 = rectangleStartPoint;
    const p2 = addPoint(p.x, p1.y, false, "endpoint");
    const p3 = addPoint(p.x, p.y, false, "endpoint");
    const p4 = addPoint(p1.x, p.y, false, "endpoint");
    const lines = [addLine(p1, p2), addLine(p2, p3), addLine(p3, p4), addLine(p4, p1)].filter(Boolean);
    if (lines[0]) model.constraints.push(new HorizontalConstraint(lines[0]));
    if (lines[1]) model.constraints.push(new VerticalConstraint(lines[1]));
    if (lines[2]) model.constraints.push(new HorizontalConstraint(lines[2]));
    if (lines[3]) model.constraints.push(new VerticalConstraint(lines[3]));
    selectedPoints = [];
    selectedLines = lines;
    selectedCircles = [];
    selectedArcs = [];
    rectangleStartPoint = null;
    pointerPreview = null;
    clearSnap();
    const result = solveAndRefresh("矩形追加");
    clearSelection();
    updateUI();
    draw();
    log(`矩形を追加しました\n自動solve: success=${result.success}`);
  }

  function sharedLinePoint(a, b) {
    if (a.p1 === b.p1 || a.p1 === b.p2) return a.p1;
    if (a.p2 === b.p1 || a.p2 === b.p2) return a.p2;
    return null;
  }

  function otherLinePoint(line, point) {
    return line.p1 === point ? line.p2 : line.p2 === point ? line.p1 : null;
  }

  function setLineEndpoint(line, from, to) {
    if (line.p1 === from) line.p1 = to;
    else if (line.p2 === from) line.p2 = to;
  }

  function computeFilletGeometry(line1, line2, radius = DEFAULT_FILLET_RADIUS) {
    const corner = sharedLinePoint(line1, line2);
    if (!corner) return { ok: false, reason: "接続された2本の線を選択してください" };
    const o1 = otherLinePoint(line1, corner);
    const o2 = otherLinePoint(line2, corner);
    const l1 = hypot2(o1.x - corner.x, o1.y - corner.y);
    const l2 = hypot2(o2.x - corner.x, o2.y - corner.y);
    if (l1 < MIN_ORIENTATION_LENGTH || l2 < MIN_ORIENTATION_LENGTH) return { ok: false, reason: "面取り対象の線が短すぎます" };

    const u1 = { x: (o1.x - corner.x) / l1, y: (o1.y - corner.y) / l1 };
    const u2 = { x: (o2.x - corner.x) / l2, y: (o2.y - corner.y) / l2 };
    const dot = Math.max(-0.999, Math.min(0.999, u1.x * u2.x + u1.y * u2.y));
    const theta = Math.acos(dot);
    const tangentScale = Math.tan(theta / 2);
    const maxTangent = Math.min(l1, l2) - MIN_LINE_LENGTH;
    if (!Number.isFinite(maxTangent) || maxTangent <= 0) return { ok: false, reason: "R面取り後の線長を確保できません" };
    const tangent = radius / tangentScale;
    if (Number.isFinite(tangent) && tangent >= maxTangent) return { ok: false, reason: "R寸法を保つための直線部を確保できません" };
    if (!Number.isFinite(tangent) || tangent <= 0 || tangent >= Math.min(l1, l2)) return { ok: false, reason: "この角度と線長ではR面取りを作成できません" };

    const bis = { x: u1.x + u2.x, y: u1.y + u2.y };
    const bisLen = hypot2(bis.x, bis.y);
    if (bisLen < 1e-9) return { ok: false, reason: "180度の角にはR面取りを作成できません" };
    const centerDistance = radius / Math.sin(theta / 2);
    const t1 = { x: corner.x + u1.x * tangent, y: corner.y + u1.y * tangent };
    const t2 = { x: corner.x + u2.x * tangent, y: corner.y + u2.y * tangent };
    const center = { x: corner.x + (bis.x / bisLen) * centerDistance, y: corner.y + (bis.y / bisLen) * centerDistance };
    const startAngle = Math.atan2(t1.y - center.y, t1.x - center.x);
    const endAngle = shortestAngleFrom(startAngle, Math.atan2(t2.y - center.y, t2.x - center.x));
    return { ok: true, corner, t1, t2, center, radius, startAngle, endAngle };
  }

  function createFillet(line1, line2, radius = DEFAULT_FILLET_RADIUS) {
    const geometry = computeFilletGeometry(line1, line2, radius);
    if (!geometry.ok) return geometry;
    const { corner, t1: t1Pos, t2: t2Pos, center: centerPos, radius: finalRadius, startAngle, endAngle } = geometry;
    const t1 = addPoint(t1Pos.x, t1Pos.y, false, "endpoint");
    const t2 = addPoint(t2Pos.x, t2Pos.y, false, "endpoint");
    const center = addPoint(centerPos.x, centerPos.y, false, "endpoint");
    setLineEndpoint(line1, corner, t1);
    setLineEndpoint(line2, corner, t2);
    const arc = addArc(center, finalRadius, startAngle, endAngle);
    if (!arc) return { ok: false, reason: "R面取り円弧を作成できません" };
    const radiusConstraint = new RadiusConstraint(arc, finalRadius);
    radiusConstraint.dimension = defaultDimensionForTarget({ kind: "radius", primitive: arc, value: finalRadius });
    solver.syncLineOrientationHints?.();
    model.constraints.push(
      new ArcEndpointCoincidentConstraint(arc, "start", t1),
      new ArcEndpointCoincidentConstraint(arc, "end", t2),
      new PointOnLineConstraint(corner, line1),
      new PointOnLineConstraint(corner, line2),
      new LineCircleTangentConstraint(line1, arc),
      new LineCircleTangentConstraint(line2, arc),
      radiusConstraint,
    );
    return { ok: true, arc };
  }

  function startFilletRadiusInput(line1, line2) {
    pendingCommand = {
      type: "fillet-radius-value",
      line1,
      line2,
      buffer: String(DEFAULT_FILLET_RADIUS),
      editing: false,
    };
    setHint("R寸法を入力してください。数字キーで編集、Enterで作成、Escでキャンセル");
    draw();
    focusDimensionValueInput();
  }

  function submitFilletRadiusValue() {
    if (pendingCommand?.type !== "fillet-radius-value") return false;
    const value = Number(pendingCommand.buffer);
    if (!Number.isFinite(value) || value <= 0) {
      setHint("R寸法には0より大きい数値を入力してください", "error");
      draw();
      return true;
    }
    const { line1, line2 } = pendingCommand;
    pendingCommand = null;
    hideDimensionValueInput();
    const result = createFillet(line1, line2, value);
    if (!result.ok) {
      setHint(result.reason, "error");
      draw();
      return true;
    }
    clearSelection();
    filletFirstLine = null;
    solveAndRefresh("R面取り追加");
    return true;
  }

  function handleFilletClick(line) {
    if (!line) {
      setHint("R面取りする線をクリックしてください", "error");
      return;
    }
    if (!filletFirstLine) {
      filletFirstLine = line;
      selectedLines = [line];
      selectedPoints = [];
      selectedCircles = [];
      selectedArcs = [];
      setHint("接続する2本目の線をクリックするとR面取りを作成します");
      updateUI();
      draw();
      return;
    }
    if (filletFirstLine === line) {
      setHint("別の接続線をクリックしてください", "error");
      return;
    }
    startFilletRadiusInput(filletFirstLine, line);
    filletFirstLine = null;
  }

  function handleCircleClick(p) {
    p = snapForDrawing(p);
    pointerPreview = p;
    if (!circleCenterPoint) {
      const center = endpointAt(p.x, p.y);
      circleCenterPoint = center;
      selectedPoints = [center];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [];
      setHint("半径位置をクリックすると円を作成します。Escで選択モードに戻ります");
      updateUI();
      draw();
      return;
    }
    const circle = addCircle(circleCenterPoint, hypot2(p.x - circleCenterPoint.x, p.y - circleCenterPoint.y));
    if (circle) {
      selectedPoints = [];
      selectedLines = [];
      selectedCircles = [circle];
      selectedArcs = [];
      circleCenterPoint = null;
      pointerPreview = null;
      clearSnap();
      solveAndRefresh("円追加");
      clearSelection();
      updateUI();
      draw();
    }
  }

  function handleArcClick(p) {
    p = snapForDrawing(p);
    pointerPreview = p;
    if (!arcCenterPoint) {
      const center = endpointAt(p.x, p.y);
      arcCenterPoint = center;
      selectedPoints = [center];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [];
      setHint("円弧の始点をクリックしてください。Escで選択モードに戻ります");
      updateUI();
      draw();
      return;
    }
    if (!arcStartPoint) {
      const radius = hypot2(p.x - arcCenterPoint.x, p.y - arcCenterPoint.y);
      if (radius < MIN_ORIENTATION_LENGTH) {
        setHint("中心から離れた位置をクリックしてください", "error");
        draw();
        return;
      }
      arcStartPoint = {
        radius,
        startAngle: Math.atan2(p.y - arcCenterPoint.y, p.x - arcCenterPoint.x),
      };
      selectedPoints = [arcCenterPoint];
      setHint("円弧の終点をクリックすると円弧を作成します。Escで選択モードに戻ります");
      updateUI();
      draw();
      return;
    }
    const arc = addArc(arcCenterPoint, arcStartPoint.radius, arcStartPoint.startAngle, shortestAngleFrom(arcStartPoint.startAngle, Math.atan2(p.y - arcCenterPoint.y, p.x - arcCenterPoint.x)));
    if (arc) {
      selectedPoints = [];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [arc];
      arcCenterPoint = null;
      arcStartPoint = null;
      pointerPreview = null;
      clearSnap();
      solveAndRefresh("円弧追加");
      clearSelection();
      updateUI();
      draw();
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button === 1) {
      e.preventDefault();
      panSession = {
        pointerId: e.pointerId,
        startPointer: canvasScreenPoint(e),
        startX: viewport.x,
        startY: viewport.y,
      };
      canvas.classList.add("is-panning");
      canvas.setPointerCapture(e.pointerId);
      setHint("画面移動中: マウススクロールボタンを押しながらドラッグ");
      return;
    }

    const p = canvasPoint(e);
    const hitP = hitPoint(p.x, p.y);
    const hitL = hitLine(p.x, p.y);
    const hitC = hitCircle(p.x, p.y);
    const hitArcEnd = hitArcEndpoint(p.x, p.y);
    const hitA = hitArc(p.x, p.y);
    const hitD = hitDimension(p.x, p.y);

    if (pendingCommand?.type === "distance-place") {
      e.preventDefault();
      if (retargetPendingLineLengthDimension(hitP, hitL, p)) return;
      startDistanceValueInput(p);
      return;
    }

    if (pendingCommand?.type === "distance-value" || pendingCommand?.type === "fillet-radius-value") {
      e.preventDefault();
      return;
    }

    if (pendingConstraintCommand) {
      e.preventDefault();
      handleConstraintTargetClick(hitP, hitL, hitC, hitA, hitArcEnd);
      return;
    }

    if (mode === "point") {
      const sp = snapForDrawing(p);
      const np = addPoint(sp.x, sp.y, false);
      clearSnap();
      selectedPoints = [np];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [];
      solveAndRefresh("点追加");
      return;
    }

    if (mode === "line") {
      handleLineClick(p, e.shiftKey);
      return;
    }

    if (mode === "rectangle") {
      handleRectangleClick(p);
      return;
    }

    if (mode === "fillet") {
      handleFilletClick(hitL);
      return;
    }

    if (mode === "circle") {
      handleCircleClick(p);
      return;
    }

    if (mode === "arc") {
      handleArcClick(p);
      return;
    }

    const multiSelect = e.shiftKey || e.ctrlKey;

    if (hitP) {
      selectedDimensionConstraint = null;
      if (multiSelect) togglePointSelection(hitP);
      else beginDrag(e, hitP, null, null, null, null, p);
    } else if (hitD && !multiSelect) {
      selectedPoints = [];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [];
      selectedArcEndpoint = null;
      beginDimensionDrag(e, hitD, p);
    } else if (hitArcEnd) {
      selectedDimensionConstraint = null;
      if (multiSelect) {
        const next = { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint };
        if (selectedArcEndpoint && !sameArcEndpoint(selectedArcEndpoint, next)) selectedArcEndpointPair = [selectedArcEndpoint, next];
        selectedArcEndpoint = next;
        if (!selectedArcs.includes(hitArcEnd.arc)) selectedArcs.push(hitArcEnd.arc);
      } else {
        beginDrag(e, null, null, null, null, hitArcEnd, p);
      }
    } else if (hitL) {
      selectedDimensionConstraint = null;
      if (multiSelect) toggleLineSelection(hitL);
      else beginDrag(e, null, hitL, null, null, null, p);
    } else if (hitC) {
      selectedDimensionConstraint = null;
      if (multiSelect) toggleCircleSelection(hitC);
      else beginDrag(e, null, null, hitC, null, null, p);
    } else if (hitA) {
      selectedDimensionConstraint = null;
      if (multiSelect) toggleArcSelection(hitA);
      else beginDrag(e, null, null, null, hitA, null, p);
    } else {
      selectionRectSession = {
        pointerId: e.pointerId,
        start: p,
        current: p,
        additive: multiSelect,
      };
      canvas.setPointerCapture(e.pointerId);
    }

    updateUI();
    draw();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (panSession) {
      const p = canvasScreenPoint(e);
      viewport.x = panSession.startX + (p.x - panSession.startPointer.x);
      viewport.y = panSession.startY + (p.y - panSession.startPointer.y);
      draw();
      return;
    }

    const p = canvasPoint(e);
    if (selectionRectSession) {
      clearSnap();
      selectionRectSession.current = p;
      draw();
      return;
    }

    if (pendingCommand?.type === "distance-place") {
      clearSnap();
      pendingCommand.pointer = p;
      draw();
      return;
    }

    if (dimensionDragSession) {
      clearSnap();
      const dx = p.x - dimensionDragSession.startPointer.x;
      const dy = p.y - dimensionDragSession.startPointer.y;
      if (dimensionDragSession.part === "label") {
        const dimension = dimensionDragSession.constraint.dimension || defaultDimensionForTarget(dimensionDragSession.target);
        const basisTarget = { ...dimensionDragSession.target, dimensionAxis: storedDimensionAxis(dimensionDragSession.target, dimension) };
        const d = targetDirection(basisTarget);
        dimension.labelOffsetU = dimensionDragSession.startLabelOffsetU + dx * d.x + dy * d.y;
        dimensionDragSession.constraint.dimension = dimension;
        draw();
        return;
      }
      const anchor = {
        x: dimensionDragSession.startAnchor.x + dx,
        y: dimensionDragSession.startAnchor.y + dy,
      };
      const nextDimension = dimensionFromAnchor(dimensionDragSession.target, anchor, { allowPointAxis: false });
      nextDimension.labelOffsetU = dimensionDragSession.startLabelOffsetU;
      dimensionDragSession.constraint.dimension = nextDimension;
      draw();
      return;
    }

    if (mode === "line") {
      const rawPreview = lineStartPoint && e.shiftKey ? orthogonalPointFrom(lineStartPoint, p) : p;
      pointerPreview = snapForDrawing(rawPreview);
      draw();
    }

    if (mode === "rectangle" || mode === "circle" || mode === "arc") {
      pointerPreview = snapForDrawing(p);
      draw();
    }

    if (!dragSession) {
      const nextEndpointHover = hitEndpointPoint(p.x, p.y);
      const nextPointHover = nextEndpointHover || hitExplicitPoint(p.x, p.y);
      const nextLineHover = nextPointHover ? null : hitLine(p.x, p.y);
      const nextCircleHover = nextPointHover || nextLineHover ? null : hitCircle(p.x, p.y);
      const nextArcEndpointHover = nextPointHover || nextLineHover || nextCircleHover ? null : hitArcEndpoint(p.x, p.y);
      const nextArcHover = nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover ? null : hitArc(p.x, p.y);
      const hitD = hitDimension(p.x, p.y);
      const nextHover = hitD?.constraint || null;
      if (
        nextPointHover !== hoveredPoint ||
        nextEndpointHover !== hoveredEndpointPoint ||
        nextLineHover !== hoveredLine ||
        nextCircleHover !== hoveredCircle ||
        !sameArcEndpoint(nextArcEndpointHover, hoveredArcEndpoint) ||
        nextArcHover !== hoveredArc ||
        nextHover !== hoveredDimensionConstraint
      ) {
        hoveredPoint = nextPointHover;
        hoveredEndpointPoint = nextEndpointHover;
        hoveredLine = nextLineHover;
        hoveredCircle = nextCircleHover;
        hoveredArcEndpoint = nextArcEndpointHover;
        hoveredArc = nextArcHover;
        hoveredDimensionConstraint = nextHover;
        draw();
      }
    }

    if (!dragSession) return;
    const result = dragResultForSession(dragSession, p);
    const error = result.errorNorm;
    if (result.blocked) {
      setHint(result.reason, "error");
      updateUI();
      draw();
      return;
    }
    const scope = result.local
      ? `${result.translated ? "translated local" : result.guided ? "guided local" : "local"} vars=${result.variableCount}, constraints=${result.constraintCount}${Number.isFinite(result.freeDof) ? `, dof=${result.freeDof}` : ""}`
      : "global";
    const fallback = result.fallback ? ` fallback from local error=${result.localErrorNorm?.toExponential(2)}` : "";
    setHint(`${dragLabel(dragSession)}中: ${scope}, error=${error.toExponential(2)}, iter=${result.iterations}${fallback}`);
    draw();
  });

  function endDrag(e) {
    if (panSession) {
      panSession = null;
      canvas.classList.remove("is-panning");
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {
        // Pointer capture may already be released by the browser.
      }
      setHint("画面移動を終了しました");
      return;
    }

    if (dimensionDragSession) {
      dimensionDragSession = null;
      canvas.classList.remove("is-dragging");
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {
        // Pointer capture may already be released by the browser.
      }
      setHint("寸法線の位置を更新しました");
      updateUI();
      draw();
      return;
    }

    if (selectionRectSession) {
      const session = selectionRectSession;
      selectionRectSession = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {
        // Pointer capture may already be released by the browser.
      }
      const current = session.current || session.start;
      const moved = hypot2(current.x - session.start.x, current.y - session.start.y);
      if (moved <= 3 / viewport.scale) {
        if (!session.additive) clearSelection();
      } else {
        selectByRect(rectFromPoints(session.start, current), current.x < session.start.x, session.additive);
      }
      setHint("矩形選択を更新しました");
      updateUI();
      draw();
      return;
    }

    if (!dragSession) return;
    const session = dragSession;
    const completedLabel = dragLabel(session);
    dragSession = null;
    canvas.classList.remove("is-dragging");
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (_) {
      // Pointer capture may already be released by the browser.
    }
    const result = solver.solve();
    normalizeArcSweeps();
    if (!result.success || result.errorNorm > CONSTRAINT_ACCEPT_ERROR) {
      if (session.fullDragState) solver.restore(session.fullDragState);
      setHint(`${completedLabel}完了時の全体solveに失敗しました (error=${result.errorNorm.toExponential(3)})`, "error");
      updateUI();
      draw();
      return;
    }
    const analysis = refreshConstraintAnalysis();
    setHint(`${completedLabel}完了: success=${result.success}, error=${result.errorNorm.toExponential(2)}, iter=${result.iterations} / ${constraintSummaryText()}`, analysis.analysis.stable ? "normal" : "error");
    updateUI();
    draw();
  }

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("dblclick", (e) => {
    const p = canvasPoint(e);
    const hitL = hitLine(p.x, p.y);
    const hitP = hitPoint(p.x, p.y);
    const hitD = hitDimension(p.x, p.y);
    if (pendingCommand?.type === "fillet-radius-value") {
      e.preventDefault();
      submitFilletRadiusValue();
      return;
    }
    if (!pendingCommand && hitD && startDimensionEditInput(hitD)) {
      e.preventDefault();
      return;
    }
    if (handleConstraintTargetDoubleClick(hitP, hitL, p)) {
      e.preventDefault();
      return;
    }
    if (!pendingCommand?.type?.startsWith("distance")) return;
    e.preventDefault();
    if (pendingCommand.type === "distance-place") {
      startDistanceValueInput(p);
    }
    submitDistanceValue();
  });
  canvas.addEventListener("auxclick", (e) => {
    if (e.button === 1) e.preventDefault();
  });
  if (dimensionValueInput) {
    dimensionValueInput.addEventListener("pointerdown", (e) => e.stopPropagation());
    dimensionValueInput.addEventListener("dblclick", (e) => e.stopPropagation());
    dimensionValueInput.addEventListener("input", () => {
      if (!pendingCommand || (pendingCommand.type !== "distance-value" && pendingCommand.type !== "fillet-radius-value")) return;
      pendingCommand.buffer = dimensionValueInput.value;
      pendingCommand.editing = true;
      updateDistanceBufferLabel();
    });
    dimensionValueInput.addEventListener("keydown", (e) => {
      if (!pendingCommand || (pendingCommand.type !== "distance-value" && pendingCommand.type !== "fillet-radius-value")) return;
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        if (pendingCommand.type === "fillet-radius-value") submitFilletRadiusValue();
        else submitDistanceValue();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelPendingCommand("寸法入力をキャンセルしました");
      }
    });
  }
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const screen = canvasScreenPoint(e);
      const world = screenToWorld(screen);
      const nextScale = clampZoom(viewport.scale * Math.exp(-e.deltaY * 0.001));
      viewport.scale = nextScale;
      viewport.x = screen.x - world.x * viewport.scale;
      viewport.y = screen.y - world.y * viewport.scale;
      setHint(`表示倍率: ${(viewport.scale * 100).toFixed(0)}%`);
      draw();
    },
    { passive: false },
  );

  window.addEventListener("keydown", (e) => {
    if (handleDistanceKey(e)) return;

    if ((e.key === "Delete" || e.key === "Backspace") && deleteCurrentSelection()) {
      e.preventDefault();
      return;
    }

    if (e.key === "Enter" && completePendingDimensionLineLength()) {
      e.preventDefault();
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      if (pendingConstraintCommand) {
        cancelConstraintTargetCommand();
        return;
      }
      if (hasActiveDrawOperation()) {
        cancelActiveDrawOperation();
        return;
      }
      if (mode === "line" || mode === "point" || mode === "rectangle" || mode === "fillet" || mode === "circle" || mode === "arc") {
        exitDrawMode();
        return;
      }
      if (
        selectedPoints.length > 0 ||
        selectedLines.length > 0 ||
        selectedCircles.length > 0 ||
        selectedArcs.length > 0 ||
        selectedArcEndpoint ||
        selectedDimensionConstraint
      ) {
        clearSelection();
        setHint("選択を解除しました");
        updateUI();
        draw();
      }
    }
  });

  document.getElementById("toolSelect").addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "select";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("選択・ドラッグできます。Shift/Ctrlクリックで複数選択できます。");
    draw();
  });

  document.getElementById("toolPoint").addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "point";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("キャンバスをクリックして点を追加します。");
    draw();
  });

  document.getElementById("toolLine").addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "line";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("端点位置をクリックして連続線を作成します。終了はEscです。");
    draw();
  });

  document.getElementById("toolRectangle")?.addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "rectangle";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("矩形の1つ目の角をクリックしてください。Escで選択モードに戻ります");
    draw();
  });

  document.getElementById("toolFillet")?.addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    if (selectedLines.length === 2) {
      startFilletRadiusInput(selectedLines[0], selectedLines[1]);
      filletFirstLine = null;
      return;
    }
    mode = "fillet";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("R面取りする接続線を2本クリックしてください");
    draw();
  });

  document.getElementById("toolCircle").addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "circle";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("円の中心をクリックしてください。Escで選択モードに戻ります");
    draw();
  });

  document.getElementById("toolArc").addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "arc";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("円弧の中心をクリックしてください。Escで選択モードに戻ります");
    draw();
  });

  document.getElementById("exportBtn").addEventListener("click", exportFileData);
  document.getElementById("importBtn").addEventListener("click", () => {
    document.getElementById("importFileInput").click();
  });
  document.getElementById("importFileInput").addEventListener("change", (e) => {
    importFileData(e.target.files[0]);
    e.target.value = "";
  });

  document.getElementById("toggleSideBtn").addEventListener("click", () => {
    const app = document.querySelector(".app");
    const collapsed = app.classList.toggle("side-collapsed");
    const btn = document.getElementById("toggleSideBtn");
    const label = collapsed ? "サイドバーを開く" : "サイドバーをたたむ";
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
    btn.dataset.tooltip = label;
    setHint(collapsed ? "サイドバーをたたみました" : "サイドバーを表示しました");
  });

  for (const btn of constraintButtons) {
    btn.addEventListener("click", () => {
      const type = btn.dataset.constraint;
      if (pendingConstraintCommand?.type === type) {
        cancelConstraintTargetCommand(`${constraintLabel(type)}の対象選択をキャンセルしました`);
      } else if (canApplyConstraint(type)) {
        cancelConstraintTargetCommand("");
        if (type === "distance") startDistanceCommand();
        else {
          cancelPendingCommand("");
          pendingConstraintCommand = { type };
          addConstraint(type);
        }
      } else {
        startConstraintTargetCommand(type);
      }
    });
  }

  fixPointBtn.addEventListener("click", () => {
    if (selectedArcEndpoint) {
      const { arc, endpoint } = selectedArcEndpoint;
      const existing = findArcEndpointFixedConstraint(arc, endpoint);
      if (existing) {
        deleteElements({ constraints: [existing] });
        log(`${arc.id}.${endpoint} の固定を解除しました`);
        return;
      }
      const p = arcEndpointPoint(arc, endpoint);
      commitNewConstraint("fixed", new ArcEndpointFixedConstraint(arc, endpoint, p.x, p.y));
      return;
    }
    if (selectedPoints.length === 0 && selectedLines.length === 1 && selectedCircles.length === 0 && selectedArcs.length === 0) {
      const line = selectedLines[0];
      const existing = findLineFixedConstraint(line);
      if (existing) {
        deleteElements({ constraints: [existing] });
        log(`${line.id} の固定を解除しました`);
        return;
      }
      commitNewConstraint("fixed", new LineFixedConstraint(line));
      return;
    }
    if (selectedPoints.length !== 1 || selectedLines.length > 0 || selectedCircles.length > 0 || selectedArcs.length > 0) return;
    selectedPoints[0].fixed = !selectedPoints[0].fixed;
    const result = solveAndRefresh("固定状態変更");
    log(`${selectedPoints[0].id} の固定状態を ${selectedPoints[0].fixed} にしました\n自動solve: success=${result.success}`);
  });

  window.addEventListener("resize", () => {
    resizeCanvas({ centerWorld: currentCanvasCenterWorld() });
  });
  sampleModel();
  resizeCanvas();
})();
