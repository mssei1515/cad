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
    LineAngleConstraint,
    signedPointLineDistance,
    CoincidentConstraint,
    ArcEndpointCoincidentConstraint,
    ArcEndpointArcEndpointCoincidentConstraint,
    PointOnLineConstraint,
    PointOnLineMidpointConstraint,
    ArcEndpointOnLineConstraint,
    ArcEndpointFixedConstraint,
    LineFixedConstraint,
    HorizontalConstraint,
    VerticalConstraint,
    PointHorizontalConstraint,
    PointVerticalConstraint,
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
    ArcEndpointDragConstraint,
    ConstraintSolver,
  } = window.GeometrySolver;

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const dimensionValueInput = document.getElementById("dimensionValueInput");
  const ROOT_SKETCH_ID = "ROOT";
  const ROOT_SKETCH_NAME = "Root Sketch";
  const DEFAULT_SKETCH_ID = "S1";
  const DEFAULT_SKETCH_NAME = "Sketch-1";
  const model = {
    sketches: [
      { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root" },
      { id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch" },
    ],
    activeSketchId: DEFAULT_SKETCH_ID,
    points: [],
    lines: [],
    circles: [],
    arcs: [],
    constraints: [],
  };
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
  let sketchSolveStates = new Map();
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
  let trimPreview = null;
  let pendingCommand = null;
  let pendingConstraintCommand = null;
  let lastPointerWorld = null;
  let hoveredSketchIdentity = null;
  let hoveredSketchTreeId = null;
  let constructionLineMode = false;
  let pointSeq = 1;
  let lineSeq = 1;
  let circleSeq = 1;
  let arcSeq = 1;
  let sketchSeq = 2;
  let sketchTreeCollapsed = false;
  const viewport = { x: 0, y: 0, scale: 1 };
  const MIN_ZOOM = 0.15;
  const MAX_ZOOM = 10000000;
  const CONSTRAINT_ACCEPT_ERROR = 1e-4;
  const DEFAULT_FILLET_RADIUS = 30;
  const MIN_LINE_LENGTH = Math.max(MIN_ORIENTATION_LENGTH, solver.minLineLength || 12);
  const MIN_ARC_LENGTH = MIN_LINE_LENGTH;
  const CONSTRAINT_STATUS_COLORS = {
    full: "#111827",
    under: "#f59e0b",
    conflict: "#dc2626",
  };
  const SKETCH_SOLVE_ERROR_COLOR = "#dc2626";
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

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  }

  function ensureSketchState() {
    if (!Array.isArray(model.sketches)) model.sketches = [];
    let root = model.sketches.find((sketch) => sketch.kind === "root" || sketch.id === ROOT_SKETCH_ID);
    if (!root) {
      root = { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root" };
      model.sketches.unshift(root);
    }
    model.sketches = [root, ...model.sketches.filter((sketch) => sketch !== root && sketch.kind !== "root" && sketch.id !== ROOT_SKETCH_ID)];
    root.id = ROOT_SKETCH_ID;
    root.name = root.name || ROOT_SKETCH_NAME;
    root.parentSketchId = null;
    root.kind = "root";
    if (!model.sketches.some((sketch) => sketch.kind !== "root")) {
      model.sketches.push({ id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
    }
    const ids = new Set(model.sketches.map((sketch) => sketch.id));
    for (const sketch of model.sketches) {
      if (sketch === root) continue;
      sketch.kind = "sketch";
      if (!Object.prototype.hasOwnProperty.call(sketch, "parentSketchId")) sketch.parentSketchId = null;
      if (sketch.parentSketchId === sketch.id || !ids.has(sketch.parentSketchId)) sketch.parentSketchId = ROOT_SKETCH_ID;
      if (sketch.parentSketchId == null) sketch.parentSketchId = ROOT_SKETCH_ID;
    }
    if (!model.activeSketchId || !model.sketches.some((sketch) => sketch.id === model.activeSketchId)) {
      model.activeSketchId = ROOT_SKETCH_ID;
    }
  }

  function isRootSketch(sketchOrId) {
    const sketch = typeof sketchOrId === "string" ? sketchById(sketchOrId) : sketchOrId;
    return sketch?.kind === "root" || sketch?.id === ROOT_SKETCH_ID;
  }

  function isDrawableSketch(sketchOrId) {
    const sketch = typeof sketchOrId === "string" ? sketchById(sketchOrId) : sketchOrId;
    return Boolean(sketch && !isRootSketch(sketch));
  }

  function canCreateInActiveSketch() {
    return isDrawableSketch(activeSketchId());
  }

  function rejectRootSketchCreation() {
    if (canCreateInActiveSketch()) return false;
    setHint("Root Sketchには図形を作成できません。子スケッチを選択してください。", "error");
    clearSnap();
    pointerPreview = null;
    draw();
    return true;
  }

  function firstDrawableSketchId() {
    ensureSketchState();
    return model.sketches.find((sketch) => sketch.kind !== "root")?.id || DEFAULT_SKETCH_ID;
  }

  function activeSketch() {
    ensureSketchState();
    return model.sketches.find((sketch) => sketch.id === model.activeSketchId) || model.sketches.find((sketch) => isRootSketch(sketch)) || model.sketches[0];
  }

  function sketchName(sketchId) {
    ensureSketchState();
    return model.sketches.find((sketch) => sketch.id === sketchId)?.name || sketchId || DEFAULT_SKETCH_NAME;
  }

  function sketchById(sketchId) {
    ensureSketchState();
    return model.sketches.find((sketch) => sketch.id === sketchId) || null;
  }

  function parentSketchOf(sketch) {
    return sketch?.parentSketchId ? sketchById(sketch.parentSketchId) : null;
  }

  function ancestorSketchIds(sketchId = activeSketchId()) {
    const ids = [];
    const visited = new Set();
    let current = sketchById(sketchId);
    while (current?.parentSketchId && !visited.has(current.id)) {
      visited.add(current.id);
      ids.push(current.parentSketchId);
      current = sketchById(current.parentSketchId);
    }
    return ids;
  }

  function isAncestorSketchId(referenceSketchId, sketchId = activeSketchId()) {
    return ancestorSketchIds(sketchId).includes(referenceSketchId);
  }

  function childSketchesOf(sketchId) {
    ensureSketchState();
    return model.sketches.filter((sketch) => sketch.parentSketchId === sketchId);
  }

  function descendantSketchIds(sketchId) {
    const result = [];
    const visit = (id) => {
      for (const child of childSketchesOf(id)) {
        result.push(child.id);
        visit(child.id);
      }
    };
    visit(sketchId);
    return result;
  }

  function siblingSketchesOf(sketch) {
    if (!sketch) return [];
    ensureSketchState();
    return model.sketches.filter((item) => item.id !== sketch.id && item.parentSketchId === sketch.parentSketchId);
  }

  function sketchDepth(sketch) {
    let depth = 0;
    const visited = new Set();
    let current = sketch;
    while (current?.parentSketchId && !visited.has(current.id)) {
      visited.add(current.id);
      current = sketchById(current.parentSketchId);
      if (current) depth++;
    }
    return depth;
  }

  function wouldCreateSketchCycle(sketchId, parentSketchId) {
    let current = sketchById(parentSketchId);
    const visited = new Set([sketchId]);
    while (current) {
      if (visited.has(current.id)) return true;
      visited.add(current.id);
      current = parentSketchOf(current);
    }
    return false;
  }

  function orderedSketches() {
    ensureSketchState();
    const byParent = new Map();
    for (const sketch of model.sketches) {
      const key = sketch.parentSketchId || "";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(sketch);
    }
    const ordered = [];
    const visit = (parentId) => {
      for (const sketch of byParent.get(parentId || "") || []) {
        ordered.push(sketch);
        visit(sketch.id);
      }
    };
    visit("");
    for (const sketch of model.sketches) {
      if (!ordered.includes(sketch)) ordered.push(sketch);
    }
    return ordered;
  }

  function sketchTreeRows() {
    ensureSketchState();
    const byParent = new Map();
    for (const sketch of model.sketches) {
      const key = sketch.parentSketchId || "";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(sketch);
    }
    const rows = [];
    const visit = (parentId, depth, ancestorHasNext) => {
      const children = byParent.get(parentId || "") || [];
      children.forEach((sketch, index) => {
        const isLast = index === children.length - 1;
        const segments = depth === 0 && isRootSketch(sketch) ? [] : [...ancestorHasNext.map((hasNext) => (hasNext ? "pipe" : "blank")), isLast ? "elbow" : "tee"];
        rows.push({ sketch, depth, isLast, hasChildren: childSketchesOf(sketch.id).length > 0, segments });
        visit(sketch.id, depth + 1, [...ancestorHasNext, !isLast]);
      });
    };
    visit("", 0, []);
    for (const sketch of model.sketches) {
      if (!rows.some((row) => row.sketch === sketch)) rows.push({ sketch, depth: 0, isLast: true, hasChildren: false, segments: ["elbow"] });
    }
    return rows;
  }

  function activeSketchId() {
    return activeSketch().id;
  }

  function assignSketchId(item, sketchId = activeSketchId()) {
    const targetSketchId = isDrawableSketch(sketchId) ? sketchId : firstDrawableSketchId();
    if (item) item.sketchId = targetSketchId || activeSketchId();
    return item;
  }

  function elementSketchId(item) {
    ensureSketchState();
    if (!item) return activeSketchId();
    if (item.sketchId) return item.sketchId;
    if (item instanceof Line) return item.p1?.sketchId || item.p2?.sketchId || activeSketchId();
    if (item instanceof Circle || item instanceof Arc) return item.center?.sketchId || activeSketchId();
    return activeSketchId();
  }

  function isActiveSketchElement(item) {
    return elementSketchId(item) === activeSketchId();
  }

  function isEditableSketchId(sketchId) {
    const id = sketchId || activeSketchId();
    return id === activeSketchId();
  }

  function isEditableSketchElement(item) {
    return isEditableSketchId(elementSketchId(item));
  }

  function isVisibleSketchId(sketchId) {
    const id = sketchId || activeSketchId();
    return id === activeSketchId() || isAncestorSketchId(id) || descendantSketchIds(activeSketchId()).includes(id);
  }

  function isVisibleSketchElement(item) {
    return isVisibleSketchId(elementSketchId(item));
  }

  function sketchRelationToActive(sketchId) {
    const id = sketchId || activeSketchId();
    if (id === activeSketchId()) return "active";
    if (isAncestorSketchId(id)) return "ancestor";
    if (descendantSketchIds(activeSketchId()).includes(id)) return "descendant";
    return "hidden";
  }

  function sketchRelationOfElement(item) {
    return sketchRelationToActive(elementSketchId(item));
  }

  function constraintSketchId(constraint) {
    ensureSketchState();
    if (!constraint) return activeSketchId();
    if (constraint.sketchId) return constraint.sketchId;
    const ids = [...new Set(constraintGraphNodes(constraint).map(elementSketchId).filter(Boolean))];
    return ids.length === 1 ? ids[0] : activeSketchId();
  }

  function isActiveSketchConstraint(constraint) {
    return constraintSketchId(constraint) === activeSketchId();
  }

  function assignConstraintSketchId(constraint, sketchId = activeSketchId()) {
    const targetSketchId = isDrawableSketch(sketchId) ? sketchId : firstDrawableSketchId();
    if (constraint) constraint.sketchId = targetSketchId || activeSketchId();
    return constraint;
  }

  function pushModelConstraint(constraint, sketchId = activeSketchId()) {
    assignConstraintSketchId(constraint, sketchId);
    model.constraints.push(constraint);
    return constraint;
  }

  function sameSketchElements(items, sketchId = activeSketchId()) {
    return items.filter(Boolean).every((item) => elementSketchId(item) === sketchId);
  }

  function constraintTargetsAreActive(constraint) {
    return sameSketchElements(constraintGraphNodes(constraint), activeSketchId());
  }

  function constraintReferencesSketch(constraint, sketchId) {
    return constraintGraphNodes(constraint).some((node) => elementSketchId(node) === sketchId);
  }

  function activeReferenceSubject() {
    if (selectedArcEndpoint) return { kind: "arc-endpoint", arc: selectedArcEndpoint.arc, endpoint: selectedArcEndpoint.endpoint };
    if (selectedPoints.length === 1 && selectedLines.length === 0 && selectedCircles.length === 0 && selectedArcs.length === 0) return { kind: "point", point: selectedPoints[0] };
    if (selectedPoints.length === 0 && selectedLines.length === 1 && selectedCircles.length === 0 && selectedArcs.length === 0) return { kind: "line", line: selectedLines[0] };
    if (selectedPoints.length === 0 && selectedLines.length === 0 && selectedCircles.length === 1 && selectedArcs.length === 0) return { kind: "primitive", primitive: selectedCircles[0] };
    if (selectedPoints.length === 0 && selectedLines.length === 0 && selectedCircles.length === 0 && selectedArcs.length === 1) return { kind: "primitive", primitive: selectedArcs[0] };
    return null;
  }

  function referenceSubjectElement(subject) {
    if (!subject) return null;
    if (subject.kind === "point") return subject.point;
    if (subject.kind === "line") return subject.line;
    if (subject.kind === "primitive") return subject.primitive;
    if (subject.kind === "arc-endpoint") return subject.arc;
    return null;
  }

  function referenceSubjectFromHit(hitP, hitL, hitC, hitA, hitArcEnd) {
    if (hitArcEnd) return { kind: "arc-endpoint", arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint };
    if (hitP) return { kind: "point", point: hitP };
    if (hitL) return { kind: "line", line: hitL };
    if (hitC || hitA) return { kind: "primitive", primitive: hitC || hitA };
    return null;
  }

  function selectReferenceSubjectForPreview(subject) {
    if (!subject) return;
    selectedPoints = [];
    selectedLines = [];
    selectedCircles = [];
    selectedArcs = [];
    selectedArcEndpoint = null;
    selectedArcEndpointPair = null;
    if (subject.kind === "point") selectedPoints = [subject.point];
    else if (subject.kind === "line") selectedLines = [subject.line];
    else if (subject.kind === "primitive") {
      if (subject.primitive instanceof Circle) selectedCircles = [subject.primitive];
      else if (subject.primitive instanceof Arc) selectedArcs = [subject.primitive];
    } else if (subject.kind === "arc-endpoint") {
      selectedArcEndpoint = { arc: subject.arc, endpoint: subject.endpoint };
    }
  }

  function referenceSubjectSketchId(subject) {
    return elementSketchId(referenceSubjectElement(subject));
  }

  function resultIsAccepted(result) {
    return Boolean(result?.success) && result.errorNorm <= CONSTRAINT_ACCEPT_ERROR;
  }

  function clearSketchSolveState(sketchId) {
    sketchSolveStates.delete(sketchId);
  }

  function setSketchSolveOk(sketchId, result, sourceSketchId = sketchId) {
    sketchSolveStates.set(sketchId, { status: "ok", sourceSketchId, result });
  }

  function setSketchSolveError(sketchId, result, sourceSketchId = sketchId) {
    sketchSolveStates.set(sketchId, {
      status: "error",
      sourceSketchId,
      errorNorm: Number.isFinite(result?.errorNorm) ? result.errorNorm : Infinity,
      reason: result?.reason || "solve failed",
      result,
    });
  }

  function sketchSolveState(sketchId) {
    return sketchSolveStates.get(sketchId) || null;
  }

  function sketchHasSolveError(sketchId) {
    return sketchSolveState(sketchId)?.status === "error";
  }

  function sketchSolveErrorTitle(sketchId) {
    const state = sketchSolveState(sketchId);
    if (state?.status !== "error") return "";
    const errorText = Number.isFinite(state.errorNorm) ? state.errorNorm.toExponential(3) : "unknown";
    return `子スケッチ破綻: error=${errorText}, reason=${state.reason}`;
  }

  function descendantErrorSummary(descendant) {
    const failures = descendant?.results?.filter((entry) => entry.status === "error") || [];
    if (failures.length === 0) return "";
    const first = failures[0];
    return ` / 子スケッチ破綻: ${sketchName(first.sketchId)} (error=${first.result.errorNorm.toExponential(3)})`;
  }

  function solveAndRefresh(label = "自動solve") {
    const solved = solveSketchAndDescendants(activeSketchId());
    const result = solved.result;
    const analysis = refreshConstraintAnalysis();
    const hasChildError = solved.descendant?.success === false;
    const statusKind = solved.success && analysis.analysis.stable && !hasChildError ? "normal" : "error";
    const childText = solved.descendant?.results?.length > 0 ? `, child=${solved.descendant.results.length}` : "";
    setHint(`${label}: success=${solved.success}, error=${result.errorNorm.toExponential(2)}, iter=${result.iterations}${childText}${descendantErrorSummary(solved.descendant)} / ${constraintSummaryText()}`, statusKind);
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
    const rootSketchId = activeSketchId();
    const sketchIds = [rootSketchId, ...descendantSketchIds(rootSketchId)];
    const analyses = new Map();
    const statuses = new Map();
    const items = [];
    for (const sketchId of sketchIds) {
      const analysis = solver.analyzeConstraintState({
        variables: sketchSolveVariables(sketchId),
        constraints: sketchSolveConstraints(sketchId),
        lines: sketchSolveLines(sketchId),
        errorTolerance: CONSTRAINT_ACCEPT_ERROR,
      });
      const forceConflict = sketchHasSolveError(sketchId);
      analyses.set(sketchId, analysis);
      for (const p of model.points) {
        if (elementSketchId(p) !== sketchId) continue;
        const status = forceConflict ? "conflict" : classifyConstraintStatus(p, "point", analysis);
        statuses.set(p, status);
        if (isEditableSketchElement(p) && isExplicitPoint(p)) items.push(status);
      }
      for (const l of model.lines) {
        if (elementSketchId(l) !== sketchId) continue;
        const status = forceConflict ? "conflict" : classifyConstraintStatus(l, "line", analysis);
        statuses.set(l, status);
        if (isEditableSketchElement(l)) items.push(status);
      }
      for (const c of model.circles) {
        if (elementSketchId(c) !== sketchId) continue;
        const status = forceConflict ? "conflict" : classifyConstraintStatus(c, "circle", analysis);
        statuses.set(c, status);
        if (isEditableSketchElement(c)) items.push(status);
      }
      for (const a of model.arcs) {
        if (elementSketchId(a) !== sketchId) continue;
        const status = forceConflict ? "conflict" : classifyConstraintStatus(a, "arc", analysis);
        statuses.set(a, status);
        if (isEditableSketchElement(a)) items.push(status);
      }
    }
    const summary = {
      full: items.filter((status) => status === "full").length,
      under: items.filter((status) => status === "under").length,
      conflict: items.filter((status) => status === "conflict").length,
      total: items.length,
    };
    constraintAnalysisState = { analysis: analyses.get(rootSketchId), analyses, statuses, summary };
    return constraintAnalysisState;
  }

  function constraintStatusOf(item) {
    if (!constraintAnalysisState) refreshConstraintAnalysis();
    return constraintAnalysisState?.statuses.get(item) || "full";
  }

  function constraintStatusColor(item, selected = false, hovered = false) {
    if (selected) return "#1d4ed8";
    if (hovered) return "#3b82f6";
    if (sketchHasSolveError(elementSketchId(item))) return SKETCH_SOLVE_ERROR_COLOR;
    const relation = sketchRelationOfElement(item);
    if (relation !== "active") return "#cbd5e1";
    const status = constraintStatusOf(item);
    if (status === "conflict") return CONSTRAINT_STATUS_COLORS.conflict;
    return CONSTRAINT_STATUS_COLORS[status] || CONSTRAINT_STATUS_COLORS.full;
  }

  function sketchStrokeWidth(item) {
    const relation = sketchRelationOfElement(item);
    if (relation === "ancestor" || relation === "descendant") return 1.8;
    if (relation === "active") return 2.6;
    return 0;
  }

  function isSketchTreeHoveredElement(item) {
    return Boolean(hoveredSketchTreeId && elementSketchId(item) === hoveredSketchTreeId);
  }

  function isReferenceHoverElement(item) {
    return Boolean(pendingConstraintCommand && item && !isActiveSketchElement(item) && isAncestorSketchId(elementSketchId(item)));
  }

  function isPendingReferenceTarget(item) {
    const target = pendingConstraintCommand?.referenceTarget || pendingCommand?.referenceTarget;
    if (!target || !item) return false;
    if (target.kind === "point") return target.point === item;
    if (target.kind === "line") return target.line === item;
    if (target.kind === "primitive") return target.primitive === item;
    return false;
  }

  function drawOrderBySketch(items) {
    return items.filter(isVisibleSketchElement).sort((a, b) => Number(isEditableSketchElement(a)) - Number(isEditableSketchElement(b)));
  }

  function sketchAlpha(item) {
    const relation = sketchRelationOfElement(item);
    if (relation === "active") return 1;
    if (relation === "ancestor" || relation === "descendant") return 1;
    return 0;
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
    assignSketchId(p);
    model.points.push(p);
    return p;
  }

  function addLine(p1, p2, construction = constructionLineMode) {
    if (p1 === p2) return null;
    const l = new Line(`L${lineSeq++}`, p1, p2, construction);
    assignSketchId(l);
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
      constraint instanceof ParallelConstraint ||
      constraint instanceof PerpendicularConstraint ||
      constraint instanceof CollinearConstraint ||
      constraint instanceof PointOnLineConstraint ||
      constraint instanceof PointOnLineMidpointConstraint ||
      constraint instanceof ArcEndpointOnLineConstraint ||
      constraint instanceof LineCircleTangentConstraint
    );
  }

  function findLineCollapseAfterConstraint(constraint, snapshot, sketchId = activeSketchId()) {
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

  function addCircle(center, radiusValue) {
    if (!center || !Number.isFinite(radiusValue) || radiusValue < MIN_ORIENTATION_LENGTH) return null;
    const c = new Circle(`C${circleSeq++}`, center, radiusValue);
    assignSketchId(c);
    model.circles.push(c);
    return c;
  }

  function addArc(center, radiusValue, startAngle, endAngle) {
    if (!center || !Number.isFinite(radiusValue) || radiusValue < MIN_ORIENTATION_LENGTH) return null;
    if (!Number.isFinite(startAngle) || !Number.isFinite(endAngle)) return null;
    const a = new Arc(`A${arcSeq++}`, center, radiusValue, startAngle, endAngle);
    assignSketchId(a);
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
    constraintAnalysisState = null;
  }

  function resetModelState() {
    model.points.length = 0;
    model.lines.length = 0;
    model.circles.length = 0;
    model.arcs.length = 0;
    model.constraints.length = 0;
    sketchSolveStates.clear();
    constraintAnalysisState = null;
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
    constructionLineMode = false;
    hoveredPoint = null;
    hoveredEndpointPoint = null;
    hoveredLine = null;
    hoveredCircle = null;
    hoveredArc = null;
    hoveredArcEndpoint = null;
    hoveredDimensionConstraint = null;
    hoveredSketchIdentity = null;
    lastPointerWorld = null;
    clearSnap();
    selectedArcEndpoint = null;
    selectedArcEndpointPair = null;
    selectedDimensionConstraint = null;
    pointSeq = 1;
    lineSeq = 1;
    circleSeq = 1;
    arcSeq = 1;
    sketchSeq = 2;
    model.sketches.length = 0;
    model.sketches.push({ id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root" });
    model.sketches.push({ id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
    model.activeSketchId = DEFAULT_SKETCH_ID;
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
    const data = {
      x: Number(anchor.x),
      y: Number(anchor.y),
      offsetU: Number.isFinite(dimension.offsetU) ? dimension.offsetU : null,
      offsetN: Number.isFinite(dimension.offsetN) ? dimension.offsetN : null,
      labelOffsetU: Number.isFinite(dimension.labelOffsetU) ? dimension.labelOffsetU : 0,
      axis,
    };
    if (Number.isFinite(dimension.labelX) && Number.isFinite(dimension.labelY)) {
      data.labelX = Number(dimension.labelX);
      data.labelY = Number(dimension.labelY);
    }
    if (target?.kind === "angle") {
      data.angleStartFlip = Number.isInteger(dimension.angleStartFlip) ? dimension.angleStartFlip : null;
      data.angleEndFlip = Number.isInteger(dimension.angleEndFlip) ? dimension.angleEndFlip : null;
      data.angleRadius = Number.isFinite(dimension.angleRadius) ? dimension.angleRadius : null;
    }
    return data;
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
    if (c instanceof LineAngleConstraint) {
      return {
        type: "lineAngle",
        line1: c.line1.id,
        line2: c.line2.id,
        target: c.target,
        startFlip: c.startFlip || 0,
        endFlip: c.endFlip || 0,
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
    if (c instanceof PointOnLineMidpointConstraint) {
      return { type: "pointOnLineMidpoint", point: c.point.id, line: c.line.id, enabled: c.enabled };
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
    if (c instanceof PointHorizontalConstraint) {
      return { type: "pointHorizontal", p1: c.p1.id, p2: c.p2.id, enabled: c.enabled };
    }
    if (c instanceof PointVerticalConstraint) {
      return { type: "pointVertical", p1: c.p1.id, p2: c.p2.id, enabled: c.enabled };
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
    ensureSketchState();
    return {
      version: 2,
      savedAt: new Date().toISOString(),
      sketches: model.sketches.map((sketch) => ({ id: sketch.id, name: sketch.name, parentSketchId: sketch.parentSketchId || null, kind: isRootSketch(sketch) ? "root" : "sketch" })),
      activeSketchId: activeSketchId(),
      points: model.points.map((p) => ({ id: p.id, x: p.x, y: p.y, fixed: p.fixed, kind: p.kind || (isPointUsedByPrimitive(p) ? "endpoint" : "explicit"), sketchId: elementSketchId(p) })),
      lines: model.lines.map((l) => ({ id: l.id, p1: l.p1.id, p2: l.p2.id, construction: Boolean(l.construction), sketchId: elementSketchId(l) })),
      circles: model.circles.map((c) => ({ id: c.id, center: c.center.id, radius: c.radius(), sketchId: elementSketchId(c) })),
      arcs: model.arcs.map((a) => ({ id: a.id, center: a.center.id, radius: a.radius(), startAngle: a.startAngle, endAngle: a.endAngle, sketchId: elementSketchId(a) })),
      constraints: model.constraints
        .map((constraint) => {
          const data = serializeConstraint(constraint);
          if (data) data.sketchId = constraintSketchId(constraint);
          if (data && constraint.reference) {
            data.reference = true;
            data.referenceSketchId = constraint.referenceSketchId || null;
          }
          return data;
        })
        .filter(Boolean),
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
    } else if (data.type === "lineAngle") {
      constraint = new LineAngleConstraint(line(data.line1), line(data.line2), Number(data.target), Number(data.startFlip) || 0, Number(data.endFlip) || 0);
    } else if (data.type === "coincident") {
      constraint = new CoincidentConstraint(point(data.p1), point(data.p2));
    } else if (data.type === "arcEndpointCoincident") {
      constraint = new ArcEndpointCoincidentConstraint(primitive(data.arc), data.endpoint === "end" ? "end" : "start", point(data.point));
    } else if (data.type === "arcEndpointArcEndpointCoincident") {
      constraint = new ArcEndpointArcEndpointCoincidentConstraint(primitive(data.a), data.endpointA === "end" ? "end" : "start", primitive(data.b), data.endpointB === "end" ? "end" : "start");
    } else if (data.type === "pointOnLine") {
      constraint = new PointOnLineConstraint(point(data.point), line(data.line));
    } else if (data.type === "pointOnLineMidpoint") {
      constraint = new PointOnLineMidpointConstraint(point(data.point), line(data.line));
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
    } else if (data.type === "pointHorizontal") {
      constraint = new PointHorizontalConstraint(point(data.p1), point(data.p2));
    } else if (data.type === "pointVertical") {
      constraint = new PointVerticalConstraint(point(data.p1), point(data.p2));
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
          labelX: Number.isFinite(Number(data.dimension.labelX)) ? Number(data.dimension.labelX) : NaN,
          labelY: Number.isFinite(Number(data.dimension.labelY)) ? Number(data.dimension.labelY) : NaN,
          axis: data.dimension.axis || null,
          angleStartFlip: Number.isInteger(data.dimension.angleStartFlip) ? data.dimension.angleStartFlip : null,
          angleEndFlip: Number.isInteger(data.dimension.angleEndFlip) ? data.dimension.angleEndFlip : null,
          angleRadius: Number.isFinite(Number(data.dimension.angleRadius)) ? Number(data.dimension.angleRadius) : NaN,
        };
        if (constraint instanceof LineAngleConstraint && !Number.isInteger(data.startFlip) && Number.isInteger(constraint.dimension.angleStartFlip)) {
          constraint.startFlip = constraint.dimension.angleStartFlip ? 1 : 0;
          constraint.endFlip = constraint.dimension.angleEndFlip ? 1 : 0;
        }
      }
    }
    return constraint;
  }

  function loadModelData(data) {
    if (!data || !Array.isArray(data.points) || !Array.isArray(data.lines) || !Array.isArray(data.constraints)) {
      throw new Error("保存データの形式が正しくありません");
    }

    let loadedSketches =
      Array.isArray(data.sketches) && data.sketches.length > 0
        ? data.sketches.map((sketch, index) => ({
            id: String(sketch.id || `S${index + 1}`),
            name: String(sketch.name || sketch.id || `Sketch-${index + 1}`),
            parentSketchId: sketch.parentSketchId == null ? null : String(sketch.parentSketchId),
            kind: sketch.kind === "root" || sketch.id === ROOT_SKETCH_ID ? "root" : "sketch",
          }))
        : [{ id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch" }];
    let loadedRoot = loadedSketches.find((sketch) => sketch.kind === "root" || sketch.id === ROOT_SKETCH_ID);
    if (!loadedRoot) loadedRoot = { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root" };
    loadedSketches = [loadedRoot, ...loadedSketches.filter((sketch) => sketch !== loadedRoot && sketch.kind !== "root" && sketch.id !== ROOT_SKETCH_ID)];
    loadedRoot.id = ROOT_SKETCH_ID;
    loadedRoot.name = loadedRoot.name || ROOT_SKETCH_NAME;
    loadedRoot.parentSketchId = null;
    loadedRoot.kind = "root";
    if (!loadedSketches.some((sketch) => sketch.kind !== "root")) {
      loadedSketches.push({ id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
    }
    const loadedSketchIds = new Set(loadedSketches.map((sketch) => sketch.id));
    for (const sketch of loadedSketches) {
      if (sketch.kind === "root") continue;
      sketch.kind = "sketch";
      if (sketch.parentSketchId === sketch.id || !loadedSketchIds.has(sketch.parentSketchId)) sketch.parentSketchId = ROOT_SKETCH_ID;
      if (sketch.parentSketchId == null) sketch.parentSketchId = ROOT_SKETCH_ID;
    }
    const fallbackSketchId = loadedSketches.find((sketch) => sketch.kind !== "root")?.id || DEFAULT_SKETCH_ID;
    const normalizeSketchId = (sketchId) => {
      const id = sketchId == null ? fallbackSketchId : String(sketchId);
      if (id === ROOT_SKETCH_ID) return fallbackSketchId;
      return loadedSketchIds.has(id) ? id : fallbackSketchId;
    };

    const pointById = new Map();
    const points = [];
    const hasPointKind = data.points.some((p) => p.kind === "explicit" || p.kind === "endpoint");
    for (const p of data.points) {
      const point = new Point(String(p.id), Number(p.x), Number(p.y), Boolean(p.fixed), p.kind === "endpoint" ? "endpoint" : "explicit");
      point.sketchId = normalizeSketchId(p.sketchId);
      points.push(point);
      pointById.set(point.id, point);
    }

    const lineById = new Map();
    const lines = [];
    for (const l of data.lines) {
      const p1 = pointById.get(String(l.p1));
      const p2 = pointById.get(String(l.p2));
      if (!p1 || !p2) throw new Error(`線 ${l.id} の端点が見つかりません`);
      const line = new Line(String(l.id), p1, p2, Boolean(l.construction));
      line.sketchId = normalizeSketchId(l.sketchId || p1.sketchId || p2.sketchId);
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
      const circle = new Circle(String(c.id), center, radius);
      circle.sketchId = normalizeSketchId(c.sketchId || center.sketchId);
      circles.push(circle);
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
      const arc = new Arc(String(a.id), center, radius, startAngle, endAngle);
      arc.sketchId = normalizeSketchId(a.sketchId || center.sketchId);
      arcs.push(arc);
    }

    const primitiveById = new Map();
    for (const c of circles) primitiveById.set(c.id, c);
    for (const a of arcs) primitiveById.set(a.id, a);

    const constraints = [];
    for (const c of data.constraints) {
      const constraint = deserializeConstraint(c, pointById, lineById, primitiveById);
      if (!constraint) throw new Error(`未対応の制約です: ${c.type}`);
      constraint.sketchId = normalizeSketchId(c.sketchId || constraintSketchId(constraint));
      constraint.reference = Boolean(c.reference);
      constraint.referenceSketchId = c.referenceSketchId == null ? null : normalizeSketchId(c.referenceSketchId);
      constraints.push(constraint);
    }

    const retainedPoints = points.filter((p) => {
      if (p.kind !== "endpoint") return true;
      if (isPointUsedByLine(p, lines) || isPointUsedByCircle(p, circles) || isPointUsedByArc(p, arcs)) return true;
      return constraints.some((constraint) => constraintReferencesPoint(constraint, p));
    });

    resetModelState();
    model.sketches.length = 0;
    model.sketches.push(...loadedSketches);
    model.activeSketchId = normalizeSketchId(data.activeSketchId);
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
    sketchSeq = nextSeq(model.sketches, "S");
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
    hoveredSketchIdentity = null;
  }

  function selectableSketchElement(item) {
    return isEditableSketchElement(item);
  }

  function exitLineMode() {
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    pointerPreview = null;
    trimPreview = null;
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
    trimPreview = null;
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
    trimPreview = null;
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

    pushModelConstraint(new DistanceConstraint(A, B, 140));
    pushModelConstraint(new DistanceConstraint(B, C, 100));
    pushModelConstraint(new ParallelConstraint(AB, CD));
    pushModelConstraint(new ParallelConstraint(BC, DA));
    pushModelConstraint(new PerpendicularConstraint(AB, BC));
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

  function formatZoom(scale) {
    const percent = scale * 100;
    if (percent >= 1000000) return `${(percent / 1000000).toFixed(2)}M%`;
    if (percent >= 10000) return `${(percent / 1000).toFixed(1)}k%`;
    if (percent >= 1000) return `${percent.toFixed(0)}%`;
    return `${percent.toFixed(percent >= 100 ? 0 : 1)}%`;
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
      if (!isEditableSketchElement(p)) continue;
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
      if (!isEditableSketchElement(l)) continue;
      if (distancePointToSegment(x, y, l) <= threshold) return l;
    }
    return null;
  }

  function hitCircle(x, y) {
    const threshold = 7 / viewport.scale;
    for (let i = model.circles.length - 1; i >= 0; i--) {
      const c = model.circles[i];
      if (!isEditableSketchElement(c)) continue;
      const d = hypot2(x - c.center.x, y - c.center.y);
      if (Math.abs(d - c.radius()) <= threshold) return c;
    }
    return null;
  }

  function hitArc(x, y) {
    const threshold = 7 / viewport.scale;
    for (let i = model.arcs.length - 1; i >= 0; i--) {
      const a = model.arcs[i];
      if (!isEditableSketchElement(a)) continue;
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
      if (!isEditableSketchElement(arc)) continue;
      for (const endpoint of ["end", "start"]) {
        const point = arcEndpointPoint(arc, endpoint);
        if (hypot2(point.x - x, point.y - y) <= threshold) return { arc, endpoint, point };
      }
    }
    return null;
  }

  function makeSnapCandidate(source, x, y, label, priority, data = {}) {
    if (data.line && priority === 1) data = { ...data, midpoint: true };
    const sketchTarget = data.point || data.line || data.primitive || data.arc;
    if (sketchTarget && !isActiveSketchElement(sketchTarget)) label = `${label} / ${sketchName(elementSketchId(sketchTarget))}`;
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
      if (!isVisibleSketchElement(p)) continue;
      if (isReferencePoint(p)) addSnapCandidate(candidates, source, p.x, p.y, "参照点", 0, { point: p });
      else if (isPrimitiveCenterPoint(p)) addSnapCandidate(candidates, source, p.x, p.y, "中心", 0, { point: p });
      else if (isEndpointPoint(p) && isPointUsedByPrimitive(p)) addSnapCandidate(candidates, source, p.x, p.y, "端点", 0, { point: p });
      else if (isExplicitPoint(p)) addSnapCandidate(candidates, source, p.x, p.y, "点", 0, { point: p });
    }
    for (const line of model.lines) {
      if (!isVisibleSketchElement(line)) continue;
      addSnapCandidate(candidates, source, (line.p1.x + line.p2.x) / 2, (line.p1.y + line.p2.y) / 2, "中点", 1, { line });
      const closest = closestPointOnSegment(source.x, source.y, line);
      addSnapCandidate(candidates, source, closest.x, closest.y, "線上", 2, { line });
    }
    for (const circle of model.circles) {
      if (!isVisibleSketchElement(circle)) continue;
      addSnapCandidate(candidates, source, circle.center.x, circle.center.y, "中心", 0, { primitive: circle });
      const p = circlePointAtPointer(source, circle);
      if (p) addSnapCandidate(candidates, source, p.x, p.y, "円周", 2, { primitive: circle });
    }
    for (const arc of model.arcs) {
      if (!isVisibleSketchElement(arc)) continue;
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

  function samePosition(a, b, tolerance = 1e-9) {
    return Boolean(a && b && hypot2(a.x - b.x, a.y - b.y) <= tolerance);
  }

  function addConstraintIfMissing(constraint, matches, options = {}) {
    if (!constraint) return false;
    if (model.constraints.some((c) => c.enabled !== false && matches(c))) return false;
    if (options.referenceSketchId) markReferenceConstraint(constraint, options.referenceSketchId);
    pushModelConstraint(constraint);
    return true;
  }

  function snapTargetElement(snap) {
    if (!snap?.data) return null;
    const { point, line, primitive, arc } = snap.data;
    return point || line || primitive || arc || null;
  }

  function snapReferenceSketchId(snap) {
    const target = snapTargetElement(snap);
    if (!target || isActiveSketchElement(target)) return null;
    const sketchId = elementSketchId(target);
    return isAncestorSketchId(sketchId) ? sketchId : null;
  }

  function snapCanCreateConstraint(snap) {
    const target = snapTargetElement(snap);
    return !target || isActiveSketchElement(target) || Boolean(snapReferenceSketchId(snap));
  }

  function addPointSnapConstraints(point, snap) {
    if (!point || !snap?.data) return 0;
    if (!snapCanCreateConstraint(snap)) return 0;
    const referenceSketchId = snapReferenceSketchId(snap);
    const options = referenceSketchId ? { referenceSketchId } : {};
    const { point: snapPoint, line, midpoint, primitive, arc, endpoint } = snap.data;
    let added = 0;
    if (snapPoint && snapPoint !== point) {
      added += addConstraintIfMissing(
        new CoincidentConstraint(point, snapPoint),
        (c) => c instanceof CoincidentConstraint && ((c.p1 === point && c.p2 === snapPoint) || (c.p1 === snapPoint && c.p2 === point)),
        options,
      ) ? 1 : 0;
    }
    if (line && midpoint) {
      added += addConstraintIfMissing(
        new PointOnLineMidpointConstraint(point, line),
        (c) => c instanceof PointOnLineMidpointConstraint && c.point === point && c.line === line,
        options,
      ) ? 1 : 0;
    } else if (line) {
      added += addConstraintIfMissing(
        new PointOnLineConstraint(point, line),
        (c) => c instanceof PointOnLineConstraint && c.point === point && c.line === line,
        options,
      ) ? 1 : 0;
    }
    if (primitive && primitive.center !== point) {
      added += addConstraintIfMissing(
        new PointOnCircleConstraint(point, primitive),
        (c) => c instanceof PointOnCircleConstraint && c.point === point && c.primitive === primitive,
        options,
      ) ? 1 : 0;
    }
    if (arc && endpoint) {
      added += addConstraintIfMissing(
        new ArcEndpointCoincidentConstraint(arc, endpoint, point),
        (c) => c instanceof ArcEndpointCoincidentConstraint && c.arc === arc && c.endpoint === endpoint && c.point === point,
        options,
      ) ? 1 : 0;
    } else if (arc) {
      added += addConstraintIfMissing(
        new PointOnCircleConstraint(point, arc),
        (c) => c instanceof PointOnCircleConstraint && c.point === point && c.primitive === arc,
        options,
      ) ? 1 : 0;
    }
    return added;
  }

  function addArcEndpointSnapConstraints(arc, endpointName, snap) {
    if (!arc || !snap?.data) return 0;
    if (!snapCanCreateConstraint(snap)) return 0;
    const referenceSketchId = snapReferenceSketchId(snap);
    const options = referenceSketchId ? { referenceSketchId } : {};
    const { point, line, midpoint, primitive, arc: snapArc, endpoint } = snap.data;
    let added = 0;
    if (point) {
      added += addConstraintIfMissing(
        new ArcEndpointCoincidentConstraint(arc, endpointName, point),
        (c) => c instanceof ArcEndpointCoincidentConstraint && c.arc === arc && c.endpoint === endpointName && c.point === point,
        options,
      ) ? 1 : 0;
    }
    if (line && midpoint) {
      const ref = addPoint(snap.x, snap.y, false, "endpoint");
      added += addPointSnapConstraints(ref, snap);
      added += addConstraintIfMissing(
        new ArcEndpointCoincidentConstraint(arc, endpointName, ref),
        (c) => c instanceof ArcEndpointCoincidentConstraint && c.arc === arc && c.endpoint === endpointName && c.point === ref,
      ) ? 1 : 0;
    } else if (line) {
      added += addConstraintIfMissing(
        new ArcEndpointOnLineConstraint(arc, endpointName, line),
        (c) => c instanceof ArcEndpointOnLineConstraint && c.arc === arc && c.endpoint === endpointName && c.line === line,
        options,
      ) ? 1 : 0;
    }
    if (primitive && primitive !== arc) {
      added += addConstraintIfMissing(
        new ArcEndpointOnCircleConstraint(arc, endpointName, primitive),
        (c) => c instanceof ArcEndpointOnCircleConstraint && c.arc === arc && c.endpoint === endpointName && c.primitive === primitive,
        options,
      ) ? 1 : 0;
    }
    if (snapArc && endpoint) {
      added += addConstraintIfMissing(
        new ArcEndpointArcEndpointCoincidentConstraint(arc, endpointName, snapArc, endpoint),
        (c) =>
          c instanceof ArcEndpointArcEndpointCoincidentConstraint &&
          ((c.a === arc && c.endpointA === endpointName && c.b === snapArc && c.endpointB === endpoint) ||
            (c.a === snapArc && c.endpointA === endpoint && c.b === arc && c.endpointB === endpointName)),
        options,
      ) ? 1 : 0;
    } else if (snapArc && snapArc !== arc) {
      added += addConstraintIfMissing(
        new ArcEndpointOnCircleConstraint(arc, endpointName, snapArc),
        (c) => c instanceof ArcEndpointOnCircleConstraint && c.arc === arc && c.endpoint === endpointName && c.primitive === snapArc,
        options,
      ) ? 1 : 0;
    }
    return added;
  }

  function addCircleBoundarySnapConstraints(circle, snap) {
    if (!circle || !snap?.data) return 0;
    if (!snapCanCreateConstraint(snap)) return 0;
    const referenceSketchId = snapReferenceSketchId(snap);
    const options = referenceSketchId ? { referenceSketchId } : {};
    const { point, line, primitive, arc, endpoint } = snap.data;
    let added = 0;
    if (point) {
      added += addConstraintIfMissing(
        new PointOnCircleConstraint(point, circle),
        (c) => c instanceof PointOnCircleConstraint && c.point === point && c.primitive === circle,
        options,
      ) ? 1 : 0;
    } else if (arc && endpoint) {
      added += addConstraintIfMissing(
        new ArcEndpointOnCircleConstraint(arc, endpoint, circle),
        (c) => c instanceof ArcEndpointOnCircleConstraint && c.arc === arc && c.endpoint === endpoint && c.primitive === circle,
        options,
      ) ? 1 : 0;
    } else {
      const ref = addPoint(snap.x, snap.y, false, "endpoint");
      added += addPointSnapConstraints(ref, snap);
      added += addConstraintIfMissing(
        new PointOnCircleConstraint(ref, circle),
        (c) => c instanceof PointOnCircleConstraint && c.point === ref && c.primitive === circle,
      ) ? 1 : 0;
      if (primitive && primitive !== circle) {
        added += addConstraintIfMissing(
          new PointOnCircleConstraint(ref, primitive),
          (c) => c instanceof PointOnCircleConstraint && c.point === ref && c.primitive === primitive,
          options,
        ) ? 1 : 0;
      }
    }
    return added;
  }

  function hitDimension(x, y) {
    const threshold = 12 / viewport.scale;
    for (let i = model.constraints.length - 1; i >= 0; i--) {
      const constraint = model.constraints[i];
      if (!isActiveSketchConstraint(constraint)) continue;
      const target = targetFromConstraint(constraint);
      if (!target) continue;
      const dimension = constraint.dimension || defaultDimensionForTarget(target);
      const layout = dimensionLayout(target, dimension);
      if (!layout) continue;
      if (hypot2(x - layout.text.x, y - layout.text.y) <= threshold * 2.2) {
        return { constraint, target, dimension, part: "label" };
      }
      if (distancePointToSegmentPoints(x, y, layout.hitA, layout.hitB) <= threshold * 1.4) {
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

  function normalizeSignedAngle(angle) {
    let a = angle;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a <= -Math.PI) a += Math.PI * 2;
    return a;
  }

  function lineAngle(line) {
    return Math.atan2(line.dy(), line.dx());
  }

  function signedAngleBetweenLines(line1, line2) {
    return normalizeSignedAngle(lineAngle(line2) - lineAngle(line1));
  }

  function axisAngleBetweenLines(line1, line2) {
    if (!lineHasDirection(line1) || !lineHasDirection(line2)) return 0;
    const a = lineUnit(line1);
    const b = lineUnit(line2);
    const dot = a.x * b.x + a.y * b.y;
    return Math.acos(Math.max(-1, Math.min(1, dot)));
  }

  function angleDimensionSweep(target) {
    return signedAngleBetweenLines(target.line1, target.line2);
  }

  function angleDimensionCandidate(target, startFlip = 0, endFlip = 0) {
    const start = lineAngle(target.line1) + (startFlip ? Math.PI : 0);
    const endAngle = lineAngle(target.line2) + (endFlip ? Math.PI : 0);
    const signed = normalizeSignedAngle(endAngle - start);
    if (Math.abs(signed) < 1e-9 || Math.abs(Math.abs(signed) - Math.PI) < 1e-9) return null;
    return { start, end: start + signed, signed, mid: start + signed / 2, startFlip, endFlip };
  }

  function angleDimensionAngles(target, anchor = null, dimension = null) {
    if (dimension && Number.isInteger(dimension.angleStartFlip) && Number.isInteger(dimension.angleEndFlip)) {
      const stored = angleDimensionCandidate(target, dimension.angleStartFlip, dimension.angleEndFlip);
      if (stored) return stored;
    }
    const fallbackSigned = angleDimensionSweep(target);
    const baseStart = lineAngle(target.line1);
    const fallback = {
      start: baseStart,
      end: baseStart + fallbackSigned,
      signed: fallbackSigned,
      mid: baseStart + fallbackSigned / 2,
      startFlip: 0,
      endFlip: fallbackSigned === signedAngleBetweenLines(target.line1, target.line2) ? 0 : 1,
    };
    if (!anchor) return fallback;
    const vertex = lineIntersection(target.line1, target.line2);
    if (!vertex) return fallback;
    const anchorAngle = Math.atan2(anchor.y - vertex.y, anchor.x - vertex.x);
    let best = fallback;
    let bestScore = Infinity;
    for (const startFlip of [0, 1]) {
      for (const endFlip of [0, 1]) {
        const candidate = angleDimensionCandidate(target, startFlip, endFlip);
        if (!candidate) continue;
        const score = Math.abs(normalizeSignedAngle(candidate.mid - anchorAngle));
        if (score < bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
    }
    return best;
  }

  function angleDegrees(radians) {
    return Math.abs((radians * 180) / Math.PI);
  }

  function lineIntersection(line1, line2) {
    const x1 = line1.p1.x;
    const y1 = line1.p1.y;
    const x2 = line1.p2.x;
    const y2 = line1.p2.y;
    const x3 = line2.p1.x;
    const y3 = line2.p1.y;
    const x4 = line2.p2.x;
    const y4 = line2.p2.y;
    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(den) < 1e-12) return null;
    return {
      x: ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / den,
      y: ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / den,
    };
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
      if (!linesAreParallel(line1, line2)) {
        const signedValue = angleDimensionSweep({ line1, line2 });
        return { kind: "angle", line1, line2, value: angleDegrees(axisAngleBetweenLines(line1, line2)), signedValue };
      }
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
    if (target.kind === "angle") {
      const vertex = lineIntersection(target.line1, target.line2);
      const angles = angleDimensionAngles(target, anchor);
      return {
        x: anchor.x,
        y: anchor.y,
        offsetU: NaN,
        offsetN: NaN,
        labelOffsetU: 0,
        axis: null,
        angleStartFlip: angles.startFlip,
        angleEndFlip: angles.endFlip,
        angleRadius: vertex ? Math.max(14 / viewport.scale, hypot2(anchor.x - vertex.x, anchor.y - vertex.y)) : NaN,
      };
    }
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

  function dimensionWithLabelAt(target, dimension, labelPoint) {
    if (!target || !dimension || !labelPoint) return dimension;
    if (target.kind === "angle") {
      return { ...dimension, labelX: labelPoint.x, labelY: labelPoint.y };
    }
    const anchor = dimensionAnchor(target, dimension);
    const basisTarget = { ...target, dimensionAxis: storedDimensionAxis(target, dimension) };
    const d = target.kind === "radius" || target.kind === "diameter" ? targetDirection({ ...basisTarget, dimensionAnchor: anchor }) : targetDirection(basisTarget);
    const points = targetPointsForDimension(target, anchor);
    if (points.length < 2) return dimension;
    const projections = points.map((p) => (p.x - anchor.x) * d.x + (p.y - anchor.y) * d.y);
    const midpointProjection = (Math.min(...projections) + Math.max(...projections)) / 2;
    const labelProjection = (labelPoint.x - anchor.x) * d.x + (labelPoint.y - anchor.y) * d.y;
    return { ...dimension, labelOffsetU: labelProjection - midpointProjection };
  }

  function applyDefaultCircleDimensionLabelOffset(target, dimension) {
    if (!dimension || !(target?.primitive instanceof Circle)) return dimension;
    if (target.kind !== "radius" && target.kind !== "diameter") return dimension;
    dimension.labelOffsetU = target.primitive.radius() * 0.5;
    return dimension;
  }

  function storedDimensionAxis(target, dimension = null) {
    if (target.kind === "point-point") return target.dimensionAxis || null;
    return dimension?.axis || target.dimensionAxis || null;
  }

  function dimensionAnchor(target, dimension) {
    if (!dimension) return defaultDimensionForTarget(target);
    if (target.kind === "radius" || target.kind === "diameter") {
      if (Number.isFinite(dimension.x) && Number.isFinite(dimension.y)) return { x: dimension.x, y: dimension.y };
    }
    if (target.kind === "angle") {
      const vertex = lineIntersection(target.line1, target.line2);
      if (vertex && Number.isFinite(dimension.angleRadius)) {
        const { mid } = angleDimensionAngles(target, null, dimension);
        return {
          x: vertex.x + Math.cos(mid) * dimension.angleRadius,
          y: vertex.y + Math.sin(mid) * dimension.angleRadius,
        };
      }
      return { x: dimension.x, y: dimension.y };
    }
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
    if (target.kind === "angle") {
      const vertex = lineIntersection(target.line1, target.line2);
      if (!vertex) return { x: 0, y: 0, offsetU: NaN, offsetN: NaN, labelOffsetU: 0, axis: null };
      const angles = angleDimensionAngles(target);
      const radius = 45 / viewport.scale;
      return {
        x: vertex.x + Math.cos(angles.mid) * radius,
        y: vertex.y + Math.sin(angles.mid) * radius,
        offsetU: NaN,
        offsetN: NaN,
        labelOffsetU: 0,
        axis: null,
        angleStartFlip: angles.startFlip,
        angleEndFlip: angles.endFlip,
        angleRadius: radius,
      };
    }
    const points = targetPointsForDimension(target);
    if (points.length < 2) return { x: 0, y: 0 };
    if (target.kind === "radius") {
      const dimension = dimensionFromAnchor(target, points[1]);
      return applyDefaultCircleDimensionLabelOffset(target, dimension);
    }
    const mid = dimensionBasePoint(target);
    const defaultAxis = target.kind === "point-point" ? target.dimensionAxis || null : null;
    const dir = targetDirection(defaultAxis ? { ...target, dimensionAxis: defaultAxis } : target);
    const normal = { x: -dir.y, y: dir.x };
    const dimension = dimensionFromAnchor(defaultAxis ? { ...target, dimensionAxis: defaultAxis } : target, { x: mid.x + normal.x * 30, y: mid.y + normal.y * 30 }, { allowPointAxis: false });
    applyDefaultCircleDimensionLabelOffset(target, dimension);
    if (defaultAxis) dimension.axis = defaultAxis;
    return dimension;
  }

  function targetFromConstraint(c) {
    if (c instanceof DistanceConstraint) return { kind: "point-point", p1: c.p1, p2: c.p2, value: c.target };
    if (c instanceof PointAxisDistanceConstraint) return { kind: "point-point", p1: c.p1, p2: c.p2, value: c.target, dimensionAxis: c.axis };
    if (c instanceof PointLineDistanceConstraint) return { kind: "point-line", point: c.point, line: c.line, value: c.target };
    if (c instanceof LineLineDistanceConstraint) return { kind: "line-line", line1: c.line1, line2: c.line2, value: c.target };
    if (c instanceof LineAngleConstraint) return { kind: "angle", line1: c.line1, line2: c.line2, value: angleDegrees(c.target), signedValue: angleDimensionSweep({ line1: c.line1, line2: c.line2 }) };
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
    if (c instanceof PointOnLineConstraint || c instanceof PointOnLineMidpointConstraint) return c.point === point || c.line.p1 === point || c.line.p2 === point;
    if (c instanceof ArcEndpointOnLineConstraint) return c.arc.center === point || c.line.p1 === point || c.line.p2 === point;
    if (c instanceof HorizontalConstraint || c instanceof VerticalConstraint) return c.line.p1 === point || c.line.p2 === point;
    if (c instanceof PointHorizontalConstraint || c instanceof PointVerticalConstraint) return c.p1 === point || c.p2 === point;
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
    if (c instanceof DistanceConstraint || c instanceof PointAxisDistanceConstraint) {
      return (c.p1 === line.p1 && c.p2 === line.p2) || (c.p1 === line.p2 && c.p2 === line.p1);
    }
    if (c instanceof PointHorizontalConstraint || c instanceof PointVerticalConstraint) {
      return (c.p1 === line.p1 && c.p2 === line.p2) || (c.p1 === line.p2 && c.p2 === line.p1);
    }
    if (c instanceof PointLineDistanceConstraint) return c.line === line;
    if (c instanceof LineLineDistanceConstraint) return c.line1 === line || c.line2 === line;
    if (c instanceof LineFixedConstraint) return c.line === line;
    if (c instanceof PointOnLineConstraint || c instanceof PointOnLineMidpointConstraint) return c.line === line;
    if (c instanceof ArcEndpointOnLineConstraint) return c.line === line;
    if (c instanceof HorizontalConstraint || c instanceof VerticalConstraint) return c.line === line;
    if (c instanceof ParallelConstraint || c instanceof PerpendicularConstraint) return c.line1 === line || c.line2 === line;
    if (c instanceof CollinearConstraint || c instanceof EqualLengthConstraint || c instanceof LineAngleConstraint) return c.line1 === line || c.line2 === line;
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
    } else if (c instanceof PointOnLineConstraint || c instanceof PointOnLineMidpointConstraint) {
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
    } else if (c instanceof PointHorizontalConstraint || c instanceof PointVerticalConstraint) {
      addNode(nodes, c.p1);
      addNode(nodes, c.p2);
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

  function localSolveVariables(component, sketchId = activeSketchId()) {
    const vars = [];
    for (const p of model.points) {
      if (!isVisibleSketchElement(p)) continue;
      if (component.has(p) && elementSketchId(p) === sketchId && !p.fixed) {
        vars.push({ object: p, prop: "x", label: `${p.id}.x` });
        vars.push({ object: p, prop: "y", label: `${p.id}.y` });
      }
    }
    for (const c of model.circles) {
      if (component.has(c) && elementSketchId(c) === sketchId) vars.push({ object: c, prop: "radiusValue", label: `${c.id}.r`, min: MIN_LINE_LENGTH });
    }
    for (const a of model.arcs) {
      if (component.has(a) && elementSketchId(a) === sketchId) {
        vars.push({ object: a, prop: "radiusValue", label: `${a.id}.r`, min: MIN_LINE_LENGTH });
        vars.push({ object: a, prop: "startAngle", label: `${a.id}.startAngle` });
        vars.push({ object: a, prop: "endAngle", label: `${a.id}.endAngle` });
      }
    }
    return vars;
  }

  function localSolveConstraints(component, sketchId = activeSketchId()) {
    return model.constraints.filter((constraint) => constraint.enabled !== false && constraintSketchId(constraint) === sketchId && constraintGraphNodes(constraint).some((node) => component.has(node)));
  }

  function localSolveLines(component, sketchId = activeSketchId()) {
    return model.lines.filter((line) => component.has(line) && elementSketchId(line) === sketchId);
  }

  function sketchSolveVariables(sketchId = activeSketchId()) {
    const vars = [];
    for (const p of model.points) {
      if (elementSketchId(p) === sketchId && !p.fixed) {
        vars.push({ object: p, prop: "x", label: `${p.id}.x` });
        vars.push({ object: p, prop: "y", label: `${p.id}.y` });
      }
    }
    for (const c of model.circles) {
      if (elementSketchId(c) === sketchId) vars.push({ object: c, prop: "radiusValue", label: `${c.id}.r`, min: MIN_LINE_LENGTH });
    }
    for (const a of model.arcs) {
      if (elementSketchId(a) === sketchId) {
        vars.push({ object: a, prop: "radiusValue", label: `${a.id}.r`, min: MIN_LINE_LENGTH });
        vars.push({ object: a, prop: "startAngle", label: `${a.id}.startAngle` });
        vars.push({ object: a, prop: "endAngle", label: `${a.id}.endAngle` });
      }
    }
    return vars;
  }

  function sketchSolveConstraints(sketchId = activeSketchId()) {
    return model.constraints.filter((constraint) => constraint.enabled !== false && constraintSketchId(constraint) === sketchId);
  }

  function sketchSolveLines(sketchId = activeSketchId()) {
    return model.lines.filter((line) => elementSketchId(line) === sketchId);
  }

  function solveActiveSketch(extra = []) {
    const sketchId = activeSketchId();
    return solver.solveSubset({
      variables: sketchSolveVariables(sketchId),
      constraints: sketchSolveConstraints(sketchId),
      lines: sketchSolveLines(sketchId),
      extra,
    });
  }

  function solveSketchById(sketchId, extra = []) {
    return solver.solveSubset({
      variables: sketchSolveVariables(sketchId),
      constraints: sketchSolveConstraints(sketchId),
      lines: sketchSolveLines(sketchId),
      extra,
    });
  }

  function solveDragSketch(session, extra = []) {
    return solveSketchById(session?.sketchId || activeSketchId(), extra);
  }

  function solveDescendantSketches(rootSketchId) {
    const results = [];
    const changedSketches = new Set([rootSketchId]);
    const descendants = descendantSketchIds(rootSketchId);
    for (const sketchId of descendants) clearSketchSolveState(sketchId);
    for (const sketchId of descendants) {
      const needsSolve = model.constraints.some(
        (constraint) => constraint.enabled !== false && constraint.reference && constraintSketchId(constraint) === sketchId && changedSketches.has(constraint.referenceSketchId),
      );
      if (!needsSolve) continue;
      const result = solveSketchById(sketchId);
      normalizeArcSweeps();
      if (resultIsAccepted(result)) {
        setSketchSolveOk(sketchId, result, rootSketchId);
        results.push({ sketchId, result, status: "ok" });
      } else {
        setSketchSolveError(sketchId, result, rootSketchId);
        results.push({ sketchId, result, status: "error" });
      }
      changedSketches.add(sketchId);
    }
    const failed = results.find((entry) => entry.status === "error");
    return { success: !failed, sketchId: failed?.sketchId || null, result: failed?.result || null, results };
  }

  function solveSketchAndDescendants(sketchId = activeSketchId(), rollbackState = null) {
    clearSketchSolveState(sketchId);
    const result = solveSketchById(sketchId);
    normalizeArcSweeps();
    if (!resultIsAccepted(result)) {
      if (rollbackState) {
        solver.restore(rollbackState);
        clearSketchSolveState(sketchId);
      } else {
        setSketchSolveError(sketchId, result, sketchId);
      }
      return { success: false, sketchId, result, descendant: { success: true, results: [] } };
    }
    setSketchSolveOk(sketchId, result, sketchId);
    const descendant = solveDescendantSketches(sketchId);
    return { success: true, sketchId, result, descendant };
  }

  function solveElementSketchAndDescendants(element, rollbackState = null) {
    return solveSketchAndDescendants(elementSketchId(element), rollbackState);
  }

  function localSolveContextFromSeeds(seeds, sketchId = activeSketchId()) {
    const component = connectedComponentFromSeeds(seeds);
    return {
      component,
      variables: localSolveVariables(component, sketchId),
      constraints: localSolveConstraints(component, sketchId),
      lines: localSolveLines(component, sketchId),
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

    const result = solveActiveSketch();
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
      } else if (target.kind === "angle") {
        if (!Number.isFinite(c.dimension.angleRadius) || !Number.isInteger(c.dimension.angleStartFlip) || !Number.isInteger(c.dimension.angleEndFlip)) {
          const previous = dimensionAnchor(target, c.dimension);
          c.dimension = dimensionFromAnchor(target, previous, { allowPointAxis: false });
        }
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
      if (!selectableSketchElement(p)) continue;
      if (!isExplicitPoint(p) && !isReferencePoint(p)) continue;
      if (pointInRect(p, rect)) addUnique(nextPoints, p);
    }
    for (const line of model.lines) {
      if (!selectableSketchElement(line)) continue;
      const selected = crossing ? lineIntersectsRect(line, rect) : bboxInRect(lineBBox(line), rect);
      if (selected) addUnique(nextLines, line);
    }
    for (const circle of model.circles) {
      if (!isVisibleSketchElement(circle)) continue;
      if (!selectableSketchElement(circle)) continue;
      const box = primitiveBBox(circle);
      const selected = crossing ? bboxIntersectsRect(box, rect) : bboxInRect(box, rect);
      if (selected) addUnique(nextCircles, circle);
    }
    for (const arc of model.arcs) {
      if (!isVisibleSketchElement(arc)) continue;
      if (!selectableSketchElement(arc)) continue;
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
    drawTrimPreview();
    drawSnapMarker();
    drawArcEndpointHandles();
    drawPoints();
    drawSketchIdentityLabel();
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
    dimensionValueInput.style.width = `${Math.max(132, Math.min(280, pendingCommand.buffer.length * 9 + 34))}px`;
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

  function extendedLineSegment(line, extension) {
    const len = line.length();
    if (len < 1e-12 || !Number.isFinite(extension) || extension <= 0) return { p1: line.p1, p2: line.p2 };
    const ux = line.dx() / len;
    const uy = line.dy() / len;
    return {
      p1: { x: line.p1.x - ux * extension, y: line.p1.y - uy * extension },
      p2: { x: line.p2.x + ux * extension, y: line.p2.y + uy * extension },
    };
  }

  function drawLines() {
    ctx.save();
    for (const l of drawOrderBySketch(model.lines)) {
      const active = isEditableSketchElement(l);
      ctx.globalAlpha = sketchAlpha(l);
      const refSelected = isPendingReferenceTarget(l);
      const treeHovered = isSketchTreeHoveredElement(l);
      const sel = (active && selectedLines.includes(l)) || refSelected;
      const hovered = (active || isReferenceHoverElement(l)) && hoveredLine === l;
      const construction = Boolean(l.construction) && !sel && !hovered;
      const lineColor = treeHovered ? "#0ea5e9" : constraintStatusColor(l, sel, hovered);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = (treeHovered ? 4 : sel ? 4 : hovered ? 2.6 : construction ? Math.max(1.8, sketchStrokeWidth(l) * 0.72) : sketchStrokeWidth(l)) / viewport.scale;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash(construction ? [12 / viewport.scale, 4 / viewport.scale, 2 / viewport.scale, 4 / viewport.scale] : []);
      ctx.shadowColor = sel || treeHovered ? "rgba(14, 165, 233, 0.45)" : "transparent";
      ctx.shadowBlur = sel || treeHovered ? 8 / viewport.scale : 0;
      const constructionExtension = 6 / viewport.scale;
      const drawSegment = construction ? extendedLineSegment(l, constructionExtension) : { p1: l.p1, p2: l.p2 };
      ctx.beginPath();
      ctx.moveTo(drawSegment.p1.x, drawSegment.p1.y);
      ctx.lineTo(drawSegment.p2.x, drawSegment.p2.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      if (construction) {
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1.4 / viewport.scale;
        const len = l.length();
        const ux = len > 1e-12 ? l.dx() / len : 1;
        const uy = len > 1e-12 ? l.dy() / len : 0;
        const nx = -uy;
        const ny = ux;
        const alongHalf = constructionExtension;
        const normalHalf = constructionExtension;
        for (const p of [l.p1, l.p2]) {
          ctx.beginPath();
          ctx.moveTo(p.x - ux * alongHalf, p.y - uy * alongHalf);
          ctx.lineTo(p.x + ux * alongHalf, p.y + uy * alongHalf);
          ctx.moveTo(p.x - nx * normalHalf, p.y - ny * normalHalf);
          ctx.lineTo(p.x + nx * normalHalf, p.y + ny * normalHalf);
          ctx.stroke();
        }
      }

      if (sel || hovered || treeHovered) {
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
    for (const c of drawOrderBySketch(model.circles)) {
      const active = isEditableSketchElement(c);
      ctx.globalAlpha = sketchAlpha(c);
      const refSelected = isPendingReferenceTarget(c);
      const treeHovered = isSketchTreeHoveredElement(c);
      const sel = (active && selectedCircles.includes(c)) || refSelected;
      const hovered = (active || isReferenceHoverElement(c)) && hoveredCircle === c;
      ctx.strokeStyle = treeHovered ? "#0ea5e9" : constraintStatusColor(c, sel, hovered);
      ctx.lineWidth = (treeHovered ? 4 : sel ? 4 : hovered ? 2.6 : sketchStrokeWidth(c)) / viewport.scale;
      ctx.shadowColor = sel || treeHovered ? "rgba(14, 165, 233, 0.45)" : "transparent";
      ctx.shadowBlur = sel || treeHovered ? 8 / viewport.scale : 0;
      ctx.beginPath();
      ctx.arc(c.center.x, c.center.y, c.radius(), 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (sel || hovered || treeHovered) {
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
    for (const a of drawOrderBySketch(model.arcs)) {
      const active = isEditableSketchElement(a);
      ctx.globalAlpha = sketchAlpha(a);
      const refSelected = isPendingReferenceTarget(a);
      const treeHovered = isSketchTreeHoveredElement(a);
      const sel = (active && selectedArcs.includes(a)) || refSelected;
      const hovered = (active || isReferenceHoverElement(a)) && hoveredArc === a;
      const angles = arcAngles(a);
      ctx.strokeStyle = treeHovered ? "#0ea5e9" : constraintStatusColor(a, sel, hovered);
      ctx.lineWidth = (treeHovered ? 4 : sel ? 4 : hovered ? 2.6 : sketchStrokeWidth(a)) / viewport.scale;
      ctx.shadowColor = sel || treeHovered ? "rgba(14, 165, 233, 0.45)" : "transparent";
      ctx.shadowBlur = sel || treeHovered ? 8 / viewport.scale : 0;
      ctx.beginPath();
      ctx.arc(a.center.x, a.center.y, a.radius(), angles.start, angles.end, angles.end < angles.start);
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (sel || hovered || treeHovered) {
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
    if (target.kind === "angle") return drawAngleDimension(target, dimension, label, preview, highlighted, editState);
    const layout = dimensionLayout(target, dimension);
    if (!layout) return;
    const { a, b, lineA, lineB, points, d, text } = layout;

    ctx.save();
    ctx.strokeStyle = preview || highlighted ? "#2563eb" : "#6b7280";
    ctx.fillStyle = preview || highlighted ? "#2563eb" : "#6b7280";
    ctx.lineWidth = (highlighted ? 2 : 1.2) / viewport.scale;
    if (preview) ctx.setLineDash([5 / viewport.scale, 4 / viewport.scale]);
    ctx.beginPath();
    ctx.moveTo((lineA || a).x, (lineA || a).y);
    ctx.lineTo((lineB || b).x, (lineB || b).y);
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

  function drawAngleDimension(target, dimension, label, preview = false, highlighted = false, editState = null) {
    const layout = angleDimensionLayout(target, dimension);
    if (!layout) return;
    const { vertex, radius, start, end, signed, text } = layout;
    ctx.save();
    ctx.strokeStyle = preview || highlighted ? "#2563eb" : "#6b7280";
    ctx.fillStyle = preview || highlighted ? "#2563eb" : "#6b7280";
    ctx.lineWidth = (highlighted ? 2 : 1.2) / viewport.scale;
    if (preview) ctx.setLineDash([5 / viewport.scale, 4 / viewport.scale]);
    const extension = 8 / viewport.scale;
    const gap = 6 / viewport.scale;
    const visibleGap = Math.min(gap, Math.max(0, radius - 2 / viewport.scale));
    const p1 = { x: vertex.x + Math.cos(start) * radius, y: vertex.y + Math.sin(start) * radius };
    const p2 = { x: vertex.x + Math.cos(end) * radius, y: vertex.y + Math.sin(end) * radius };
    const s1 = { x: vertex.x + Math.cos(start) * visibleGap, y: vertex.y + Math.sin(start) * visibleGap };
    const s2 = { x: vertex.x + Math.cos(end) * visibleGap, y: vertex.y + Math.sin(end) * visibleGap };
    const e1 = { x: vertex.x + Math.cos(start) * (radius + extension), y: vertex.y + Math.sin(start) * (radius + extension) };
    const e2 = { x: vertex.x + Math.cos(end) * (radius + extension), y: vertex.y + Math.sin(end) * (radius + extension) };
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(e1.x, e1.y);
    ctx.moveTo(s2.x, s2.y);
    ctx.lineTo(e2.x, e2.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(vertex.x, vertex.y, radius, start, end, signed < 0);
    ctx.stroke();
    ctx.setLineDash([]);
    drawArrowhead(p1, { x: Math.cos(start + (signed < 0 ? -Math.PI / 2 : Math.PI / 2)), y: Math.sin(start + (signed < 0 ? -Math.PI / 2 : Math.PI / 2)) });
    drawArrowhead(p2, { x: Math.cos(end + (signed < 0 ? Math.PI / 2 : -Math.PI / 2)), y: Math.sin(end + (signed < 0 ? Math.PI / 2 : -Math.PI / 2)) });
    drawDimensionLabel(label, text, editState);
    ctx.restore();
  }

  function drawDimensionLabel(label, text, editState = null) {
    if (editState?.hidden) return;
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
    if (target.kind === "angle") return angleDimensionLayout(target, dimension);
    const anchor = dimensionAnchor(target, dimension);
    const basisTarget = { ...target, dimensionAxis: storedDimensionAxis(target, dimension) };
    const d = target.kind === "radius" || target.kind === "diameter" ? targetDirection({ ...basisTarget, dimensionAnchor: anchor }) : targetDirection(basisTarget);
    const points = targetPointsForDimension(target, anchor);
    if (points.length < 2) return null;
    const tick = 9 / viewport.scale;
    const extension = 6 / viewport.scale;
    const gap = 6 / viewport.scale;
    const projections = points.map((p) => (p.x - anchor.x) * d.x + (p.y - anchor.y) * d.y);
    const min = Math.min(...projections);
    const max = Math.max(...projections);
    const a = { x: anchor.x + d.x * min, y: anchor.y + d.y * min };
    const b = { x: anchor.x + d.x * max, y: anchor.y + d.y * max };
    const labelOffset = Number(dimension?.labelOffsetU) || 0;
    const textProjection = (min + max) / 2 + labelOffset;
    const labelPad = 18 / viewport.scale;
    const lineMin = Math.min(min, textProjection - labelPad);
    const lineMax = Math.max(max, textProjection + labelPad);
    const lineA = { x: anchor.x + d.x * lineMin, y: anchor.y + d.y * lineMin };
    const lineB = { x: anchor.x + d.x * lineMax, y: anchor.y + d.y * lineMax };
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
      lineA,
      lineB,
      d,
      points: projectedPoints,
      text: { x: anchor.x + d.x * textProjection, y: anchor.y + d.y * textProjection },
      hitA: { x: lineA.x - d.x * tick, y: lineA.y - d.y * tick },
      hitB: { x: lineB.x + d.x * tick, y: lineB.y + d.y * tick },
    };
  }

  function angleDimensionLayout(target, dimension) {
    const vertex = lineIntersection(target.line1, target.line2);
    if (!vertex) return null;
    const anchor = dimensionAnchor(target, dimension);
    const radius = Math.max(14 / viewport.scale, hypot2(anchor.x - vertex.x, anchor.y - vertex.y));
    const { start, end, signed, mid } = angleDimensionAngles(target, anchor, dimension);
    return {
      vertex,
      radius,
      start,
      end,
      signed,
      text: {
        x: Number.isFinite(dimension?.labelX) ? dimension.labelX : vertex.x + Math.cos(mid) * (radius + 14 / viewport.scale),
        y: Number.isFinite(dimension?.labelY) ? dimension.labelY : vertex.y + Math.sin(mid) * (radius + 14 / viewport.scale),
      },
      hitA: { x: vertex.x + Math.cos(start) * radius, y: vertex.y + Math.sin(start) * radius },
      hitB: { x: vertex.x + Math.cos(end) * radius, y: vertex.y + Math.sin(end) * radius },
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
    for (const c of [...model.constraints].sort((a, b) => Number(isActiveSketchConstraint(a)) - Number(isActiveSketchConstraint(b)))) {
      const target = targetFromConstraint(c);
      if (!target) continue;
      if (!isActiveSketchConstraint(c) && !constraintReferencesSketch(c, activeSketchId()) && !isVisibleSketchId(constraintSketchId(c))) continue;
      const dimension = c.dimension || defaultDimensionForTarget(target);
      const active = isActiveSketchConstraint(c);
      const highlighted = active && (c === hoveredDimensionConstraint || c === selectedDimensionConstraint || c === dimensionDragSession?.constraint);
      const label = target.kind === "angle" ? `${Number(angleDegrees(c.target)).toFixed(2)}°` : Number(c.target).toFixed(2);
      const editing = pendingCommand?.type === "distance-value" && pendingCommand.constraint === c;
      ctx.save();
      ctx.globalAlpha = active ? 1 : 0.26;
      drawDimension(target, dimension, label, false, highlighted || editing, editing ? { hidden: true } : null);
      ctx.restore();
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
        hidden: true,
      });
      return;
    }
    if (!pendingCommand?.type?.startsWith("distance")) return;
    const dimension =
      pendingCommand.type === "distance-place"
        ? pendingCommand.dimension || applyDefaultCircleDimensionLabelOffset(pendingCommand.target, pendingCommand.pointer ? dimensionFromAnchor(pendingCommand.target, pendingCommand.pointer) : defaultDimensionForTarget(pendingCommand.target))
        : pendingCommand.dimension;
    if (pendingCommand.type === "distance-value") {
      const value = Number(pendingCommand.buffer);
      const invalid = pendingCommand.buffer === "" || !Number.isFinite(value) || value <= 0 || (pendingCommand.target.kind === "angle" && value >= 180);
      const suffix = pendingCommand.target.kind === "angle" ? "°" : "";
      drawDimension(pendingCommand.target, dimension, `${pendingCommand.buffer || "_"}${suffix}|`, true, false, {
        selecting: !pendingCommand.editing,
        invalid,
        hidden: true,
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
          : previewTarget.kind === "angle"
            ? angleDegrees(angleDimensionAngles(previewTarget, pendingCommand.pointer || dimensionAnchor(previewTarget, dimension), dimension).signed)
          : previewTarget.value;
    const label = previewTarget.kind === "angle" ? `${Number(previewValue).toFixed(2)}°` : Number(previewValue).toFixed(2);
    drawDimension(previewTarget, dimensionWithLabelAt(previewTarget, dimension, pendingCommand.pointer), label, true);
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

  function drawTrimPreview() {
    if (mode !== "trim" || !trimPreview) return;
    ctx.save();
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 4 / viewport.scale;
    ctx.lineCap = "round";
    ctx.setLineDash([8 / viewport.scale, 5 / viewport.scale]);
    if (trimPreview.kind === "line") {
      ctx.beginPath();
      ctx.moveTo(trimPreview.interval.left.point.x, trimPreview.interval.left.point.y);
      ctx.lineTo(trimPreview.interval.right.point.x, trimPreview.interval.right.point.y);
      ctx.stroke();
    } else if (trimPreview.kind === "arc") {
      const arc = trimPreview.item;
      ctx.beginPath();
      ctx.arc(arc.center.x, arc.center.y, arc.radius(), angleAtArcParam(arc, trimPreview.interval.left.t), angleAtArcParam(arc, trimPreview.interval.right.t), arc.endAngle < arc.startAngle);
      ctx.stroke();
    } else if (trimPreview.kind === "circle") {
      const circle = trimPreview.item;
      ctx.beginPath();
      if (trimPreview.deleteWhole) ctx.arc(circle.center.x, circle.center.y, circle.radius(), 0, Math.PI * 2);
      else ctx.arc(circle.center.x, circle.center.y, circle.radius(), trimPreview.interval.left.angle, trimPreview.interval.right.angle);
      ctx.stroke();
    }
    ctx.restore();
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
    const pointLike = Boolean(activeSnap.data?.point) || activeSnap.priority === 0;
    const labelX = activeSnap.x + 8 / viewport.scale;
    const labelY = activeSnap.y + (pointLike ? 20 : -8) / viewport.scale;
    const paddingX = 3 / viewport.scale;
    const paddingY = 2 / viewport.scale;
    const metrics = ctx.measureText(activeSnap.label);
    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    ctx.fillRect(labelX - paddingX, labelY - 12 / viewport.scale - paddingY, metrics.width + paddingX * 2, 14 / viewport.scale + paddingY * 2);
    ctx.fillStyle = "#f59e0b";
    ctx.fillText(activeSnap.label, labelX, labelY);
    ctx.restore();
  }

  function selectedSketchIdentityElement() {
    if (selectedArcEndpoint?.arc) return { id: `${selectedArcEndpoint.arc.id}端点`, sketchId: elementSketchId(selectedArcEndpoint.arc), item: selectedArcEndpoint.arc };
    const item = selectedPoints.at(-1) || selectedLines.at(-1) || selectedCircles.at(-1) || selectedArcs.at(-1);
    return item ? { id: item.id, sketchId: elementSketchId(item), item } : null;
  }

  function sketchIdentityRelationLabel(sketchId) {
    const relation = sketchRelationToActive(sketchId);
    if (relation === "ancestor") return "祖先";
    if (relation === "descendant") return "子孫";
    return "";
  }

  function sketchIdentityRelationColor(sketchId) {
    const relation = sketchRelationToActive(sketchId);
    if (relation === "ancestor") return "#7c3aed";
    if (relation === "descendant") return "#047857";
    return "#64748b";
  }

  function sketchIdentityRelationBackground(sketchId) {
    const relation = sketchRelationToActive(sketchId);
    if (relation === "ancestor") return "rgba(237, 233, 254, 0.96)";
    if (relation === "descendant") return "rgba(209, 250, 229, 0.96)";
    return "rgba(241, 245, 249, 0.96)";
  }

  function drawSketchIdentityLabel() {
    const identity = hoveredSketchIdentity || selectedSketchIdentityElement();
    const pointer = lastPointerWorld;
    if (!identity || !pointer || !isVisibleSketchId(identity.sketchId) || identity.sketchId === activeSketchId()) return;
    const baseLabel = `${identity.id} / ${sketchName(identity.sketchId)}`;
    const relationLabel = sketchIdentityRelationLabel(identity.sketchId);
    const separator = relationLabel ? " / " : "";
    ctx.save();
    ctx.font = `${11 / viewport.scale}px system-ui`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    const paddingX = 4 / viewport.scale;
    const paddingY = 2 / viewport.scale;
    const labelX = pointer.x + 14 / viewport.scale;
    const labelY = pointer.y + 26 / viewport.scale;
    const baseWidth = ctx.measureText(baseLabel).width;
    const separatorWidth = ctx.measureText(separator).width;
    const relationWidth = relationLabel ? ctx.measureText(relationLabel).width : 0;
    const width = baseWidth + separatorWidth + relationWidth;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(labelX - paddingX, labelY - 12 / viewport.scale - paddingY, width + paddingX * 2, 14 / viewport.scale + paddingY * 2);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.75)";
    ctx.lineWidth = 1 / viewport.scale;
    ctx.strokeRect(labelX - paddingX, labelY - 12 / viewport.scale - paddingY, width + paddingX * 2, 14 / viewport.scale + paddingY * 2);
    ctx.fillStyle = "#64748b";
    ctx.fillText(baseLabel, labelX, labelY);
    if (relationLabel) {
      const relationX = labelX + baseWidth + separatorWidth;
      const relationPadX = 4 / viewport.scale;
      const relationPadY = 1 / viewport.scale;
      ctx.fillText(separator, labelX + baseWidth, labelY);
      ctx.fillStyle = sketchIdentityRelationBackground(identity.sketchId);
      ctx.fillRect(relationX - relationPadX, labelY - 12 / viewport.scale - relationPadY, relationWidth + relationPadX * 2, 14 / viewport.scale + relationPadY * 2);
      ctx.fillStyle = sketchIdentityRelationColor(identity.sketchId);
      ctx.font = `700 ${11 / viewport.scale}px system-ui`;
      ctx.fillText(relationLabel, relationX, labelY);
    }
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
      if (!isEditableSketchElement(arc)) continue;
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
    ctx.save();
    for (const p of drawOrderBySketch(model.points)) {
      if (!isExplicitPoint(p) && !isPointUsedByPrimitive(p) && !isReferencePoint(p)) continue;
      const active = isEditableSketchElement(p);
      ctx.globalAlpha = sketchAlpha(p);
      const refSelected = isPendingReferenceTarget(p);
      const treeHovered = isSketchTreeHoveredElement(p);
      const sel = (active && selectedPoints.includes(p)) || refSelected;
      const endpoint = isEndpointPoint(p);
      const hovered = (active || isReferenceHoverElement(p)) && (hoveredPoint === p || hoveredEndpointPoint === p);
      const dragging = dragSession?.kind === "point" && dragSession.points.some((target) => target.point === p);
      const primitiveCenter = shouldShowPrimitiveCenter(p);
      const fixedByLine = pointLockedByLineFixed(p);
      const reference = isReferencePoint(p);
      if (reference && !sel && !hovered && !dragging && !treeHovered) continue;
      if (endpoint && !reference && !sel && !hovered && !dragging && !primitiveCenter && !treeHovered) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (sel || treeHovered ? 7 : endpoint || reference ? 5 : 5) / viewport.scale, 0, Math.PI * 2);
      ctx.fillStyle = p.fixed || fixedByLine ? "#fee2e2" : sel ? "#1d4ed8" : treeHovered ? "#e0f2fe" : hovered || primitiveCenter || reference ? "#eff6ff" : "#fff";
      ctx.fill();
      ctx.strokeStyle = treeHovered ? "#0ea5e9" : p.fixed || fixedByLine ? "#dc2626" : constraintStatusColor(p, sel, hovered || primitiveCenter || reference);
      ctx.lineWidth = (sel || treeHovered ? 3 : Math.max(1.2, sketchStrokeWidth(p))) / viewport.scale;
      ctx.shadowColor = sel || treeHovered ? "rgba(14, 165, 233, 0.45)" : "transparent";
      ctx.shadowBlur = sel || treeHovered ? 8 / viewport.scale : 0;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
      if (sel || hovered || dragging || treeHovered) {
        ctx.fillStyle = hovered || endpoint ? "#2563eb" : "#111827";
        ctx.font = `${12 / viewport.scale}px system-ui`;
        ctx.fillText(p.id, p.x + 8 / viewport.scale, p.y - 8 / viewport.scale);
      }

      if (p.fixed) {
        ctx.fillStyle = "#dc2626";
        ctx.fillText("固定", p.x + 8 / viewport.scale, p.y + 8 / viewport.scale);
      }
    }
    ctx.restore();
  }

  function updateToolbar() {
    const states = {
      toolSelect: mode === "select" && !pendingConstraintCommand && !pendingCommand,
      toolPoint: mode === "point",
      toolLine: mode === "line" && !constructionLineMode,
      toolConstructionLine: mode === "line" && constructionLineMode,
      toolRectangle: mode === "rectangle",
      toolFillet: mode === "fillet",
      toolTrim: mode === "trim",
      toolCircle: mode === "circle",
      toolArc: mode === "arc",
    };
    for (const [id, active] of Object.entries(states)) {
      const button = document.getElementById(id);
      if (!button) continue;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }

  function canApplyConstraint(type) {
    const primitives = selectedPrimitives();
    const selectedItems = [...selectedPoints, ...selectedLines, ...primitives, selectedArcEndpoint?.arc, ...(selectedArcEndpointPair || []).map((item) => item.arc)].filter(Boolean);
    if (!sameSketchElements(selectedItems, activeSketchId())) return false;
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
      if ((selectedPoints.length === 2 && selectedLines.length === 0) || (selectedPoints.length === 0 && selectedLines.length === 2 && selectedLines.every(lineHasDirection)) || (selectedPoints.length === 1 && selectedLines.length === 1) || (selectedPoints.length === 1 && selectedLines.length === 0 && coincidentPrimitives.length === 1)) return true;
      return Boolean(selectedArcEndpoint && ((selectedPoints.length === 1 && selectedLines.length === 0 && coincidentPrimitives.length === 0) || (selectedPoints.length === 0 && selectedLines.length === 1 && coincidentPrimitives.length === 0) || (selectedPoints.length === 0 && selectedLines.length === 0 && coincidentPrimitives.length === 1)));
    }
    if (type === "horizontal" || type === "vertical") return (selectedLines.length === 1 && selectedPoints.length === 0 && lineHasDirection(selectedLines[0])) || (selectedPoints.length === 2 && selectedLines.length === 0);
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
    if (type === "coincident") return "一致させる点同士、点と線、点と円周、または同一線上にする線2本を選択してください";
    if (type === "collinear") return "同一直線上にする線を2本選択してください";
    if (type === "equal") return "等寸にする線2本、または同じ半径にする円/円弧を2つ選択してください";
    if (type === "horizontal") return "水平にする線1本、または水平関係にする点2つを選択してください";
    if (type === "vertical") return "垂直にする線1本、または鉛直関係にする点2つを選択してください";
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
    if (type === "horizontal" || type === "vertical") {
      return "この拘束では線1本、または点2つを選択してください";
    }
    if (type === "parallel" || type === "perpendicular") {
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
      selectedLines = selectedPoints.length >= 2 ? [] : selectedLines.slice(0, 2);
      trimPrimitives(selectedPoints.length === 1 && selectedLines.length === 0 ? 1 : 0);
    } else if (type === "horizontal" || type === "vertical") {
      selectedPoints = selectedLines.length > 0 ? [] : selectedPoints.slice(0, 2);
      selectedCircles = [];
      selectedArcs = [];
      selectedLines = selectedPoints.length > 0 ? [] : selectedLines.slice(0, 1);
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
    mode = "select";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    trimPreview = null;
    updateToolbar();
    if (pendingConstraintCommand?.type === type) {
      cancelConstraintTargetCommand(`${constraintLabel(type)}の対象選択をキャンセルしました`);
      return;
    }
    pendingConstraintCommand = { type };
    trimConstraintSelection(type);
    updateToolbar();
    updateConstraintButtons();
    setHint(constraintTargetHint(type));
    draw();
  }

  function cancelConstraintTargetCommand(message = "拘束対象の選択をキャンセルしました") {
    if (!pendingConstraintCommand) return;
    pendingConstraintCommand = null;
    if (message) setHint(message);
    updateConstraintButtons();
    updateToolbar();
    if (document.activeElement instanceof HTMLElement && document.activeElement.matches("[data-constraint]")) {
      document.activeElement.blur();
    }
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
        updateConstraintButtons();
        startDistanceCommand();
        return true;
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
        if (selectedPoints.length > 0) {
          selectedLines = [hitL];
          selectedPoints = selectedPoints.slice(0, 1);
        } else {
          if (!selectedLines.includes(hitL)) selectedLines.push(hitL);
          selectedLines = selectedLines.slice(-2);
        }
        selectedCircles = [];
        selectedArcs = [];
      } else if (hitPrimitive) {
        selectedArcEndpointPair = null;
        pushPrimitiveSelection(hitPrimitive);
        selectedPoints = selectedPoints.slice(0, 1);
        selectedLines = [];
      }
    } else if (type === "horizontal" || type === "vertical") {
      if (!hitL && !hitP) {
        setHint(invalidConstraintTargetHint(type), "error");
        return true;
      }
      if (hitP) {
        selectedLines = [];
        if (!selectedPoints.includes(hitP)) selectedPoints.push(hitP);
        selectedPoints = selectedPoints.slice(-2);
      } else if (!lineHasDirection(hitL)) {
        setHint("向き拘束の対象線が短すぎます", "error");
        return true;
      } else {
        selectedLines = [hitL];
        selectedPoints = [];
      }
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

  function handleReferenceConstraintTargetClick(referenceTarget, pointer, type, distanceMode = false) {
    const subject = activeReferenceSubject();
    if (!subject) {
      setHint("先にアクティブスケッチ側の対象を選択してください");
      return true;
    }
    if (!referenceTarget) return false;
    return handleReferenceSubjectAndTarget(subject, referenceTarget, pointer, type, distanceMode);
  }

  function referenceTargetFromHit(hitP, hitL, hitC, hitA) {
    const item = hitP || hitL || hitC || hitA;
    if (!item) return null;
    const sketchId = elementSketchId(item);
    if (hitP) return { kind: "point", point: hitP, sketchId };
    if (hitL) return { kind: "line", line: hitL, sketchId };
    return { kind: "primitive", primitive: hitC || hitA, sketchId };
  }

  function startDistanceCommand() {
    const resolution = constraintResolutionFromCurrentSelection("distance");
    if (!resolution) return;
    if (resolution.error) {
      setHint(resolution.error, "error");
      log(resolution.error);
      return;
    }
    mode = "select";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    trimPreview = null;
    pendingConstraintCommand = { type: "distance" };
    pendingCommand = {
      type: "distance-place",
      target: resolution.target,
      pointer: defaultDimensionForTarget(resolution.target),
      referenceSketchId: resolution.referenceSketchId,
      sketchId: resolution.sketchId,
    };
    updateConstraintButtons();
    updateToolbar();
    setHint("寸法線の位置をクリックしてください");
    draw();
  }

  function startPrimitiveDimensionCommand(kind) {
    const primitive = selectedPrimitives()[0];
    if (!primitive) return;
    const value = kind === "diameter" ? primitive.radius() * 2 : primitive.radius();
    mode = "select";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    trimPreview = null;
    pendingConstraintCommand = { type: "distance" };
    pendingCommand = { type: "distance-place", target: { kind, primitive, value }, pointer: defaultDimensionForTarget({ kind, primitive, value }) };
    updateConstraintButtons();
    updateToolbar();
    setHint("寸法線の位置をクリックしてください");
    draw();
  }

  function cancelPendingCommand(message = "コマンドをキャンセルしました") {
    if (!pendingCommand) return;
    pendingCommand = null;
    hideDimensionValueInput();
    if (message) setHint(message);
    updateToolbar();
    updateConstraintButtons();
    draw();
  }

  function startDistanceValueInput(pointer) {
    if (!pendingCommand || pendingCommand.type !== "distance-place") return;
    const referenceSketchId = pendingCommand.referenceSketchId;
    const sketchId = pendingCommand.sketchId;
    const dimension = dimensionWithLabelAt(
      pendingCommand.target,
      applyDefaultCircleDimensionLabelOffset(pendingCommand.target, dimensionFromAnchor(pendingCommand.target, pointer)),
      pointer,
    );
    const target = { ...pendingCommand.target, dimensionAxis: dimension.axis };
    const value =
      pendingCommand.target.kind === "point-point" && dimension.axis === "x"
        ? Math.abs(pendingCommand.target.p2.x - pendingCommand.target.p1.x)
        : pendingCommand.target.kind === "point-point" && dimension.axis === "y"
          ? Math.abs(pendingCommand.target.p2.y - pendingCommand.target.p1.y)
          : pendingCommand.target.kind === "angle"
            ? angleDegrees(angleDimensionAngles(pendingCommand.target, pointer, dimension).signed)
          : pendingCommand.target.value;
    pendingCommand = {
      type: "distance-value",
      target,
      dimension,
      buffer: String(value),
      editing: false,
      referenceSketchId,
      sketchId,
    };
    setHint("寸法値を入力中: 数値キーで編集、Enter/ダブルクリックで決定、Escでキャンセル");
    updateConstraintButtons();
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
      selectedPoints = [];
      selectedLines = [baseLine, hitL];
      selectedCircles = [];
      selectedArcs = [];
      const signedValue = angleDimensionSweep({ line1: baseLine, line2: hitL });
      const target = linesAreParallel(baseLine, hitL)
        ? { kind: "line-line", line1: baseLine, line2: hitL, value: Math.abs(signedPointLineDistance(hitL.p1, baseLine)) }
        : { kind: "angle", line1: baseLine, line2: hitL, value: angleDegrees(axisAngleBetweenLines(baseLine, hitL)), signedValue };
      pendingCommand = { type: "distance-place", target, pointer };
      setHint("線と線の寸法線の位置をクリックしてください");
      updateUI();
      draw();
      return true;
    }
    return false;
  }

  function retargetPendingLineLengthToReference(referenceTarget, pointer) {
    if (pendingCommand?.type !== "distance-place" || pendingCommand.target.kind !== "line-length" || !referenceTarget) return false;
    const baseLine = pendingCommand.target.line;
    return commitConstraintResolution(
      constraintResolutionFromSubjectAndReference("distance", { kind: "line", line: baseLine }, referenceTarget),
      pointer,
    );
  }

  function applyReferenceHoverTarget(referenceTarget) {
    hoveredPoint = referenceTarget?.kind === "point" ? referenceTarget.point : null;
    hoveredEndpointPoint = hoveredPoint;
    hoveredLine = referenceTarget?.kind === "line" ? referenceTarget.line : null;
    hoveredCircle = referenceTarget?.primitive instanceof Circle ? referenceTarget.primitive : null;
    hoveredArc = referenceTarget?.primitive instanceof Arc ? referenceTarget.primitive : null;
    hoveredArcEndpoint = null;
    hoveredDimensionConstraint = null;
  }

  function updatePendingLineLengthHover(pointer) {
    if (pendingCommand?.type !== "distance-place" || pendingCommand.target.kind !== "line-length") {
      hoveredPoint = null;
      hoveredEndpointPoint = null;
      hoveredLine = null;
      return false;
    }
    const baseLine = pendingCommand.target.line;
    const referenceTarget = hitReferenceTarget(pointer.x, pointer.y);
    if (referenceTarget) {
      const changed =
        (referenceTarget.kind === "point" ? referenceTarget.point : null) !== hoveredPoint ||
        (referenceTarget.kind === "line" ? referenceTarget.line : null) !== hoveredLine ||
        (referenceTarget.primitive instanceof Circle ? referenceTarget.primitive : null) !== hoveredCircle ||
        (referenceTarget.primitive instanceof Arc ? referenceTarget.primitive : null) !== hoveredArc ||
        hoveredDimensionConstraint;
      applyReferenceHoverTarget(referenceTarget);
      return changed;
    }
    const nextEndpointHover = hitEndpointPoint(pointer.x, pointer.y);
    const nextPointHover = nextEndpointHover || hitExplicitPoint(pointer.x, pointer.y);
    const candidateLine = nextPointHover ? null : hitLine(pointer.x, pointer.y);
    const nextLineHover = candidateLine && candidateLine !== baseLine && lineHasDirection(baseLine) && lineHasDirection(candidateLine) ? candidateLine : null;
    const changed = nextPointHover !== hoveredPoint || nextEndpointHover !== hoveredEndpointPoint || nextLineHover !== hoveredLine || hoveredCircle || hoveredArc || hoveredArcEndpoint || hoveredDimensionConstraint;
    hoveredPoint = nextPointHover;
    hoveredEndpointPoint = nextEndpointHover;
    hoveredLine = nextLineHover;
    hoveredCircle = null;
    hoveredArcEndpoint = null;
    hoveredArc = null;
    hoveredDimensionConstraint = null;
    return changed;
  }

  function startDimensionEditInput(hit) {
    if (!hit?.constraint) return false;
    const target = targetFromConstraint(hit.constraint);
    if (!target) return false;
    pendingCommand = {
      type: "distance-value",
      target,
      dimension: hit.constraint.dimension || hit.dimension || defaultDimensionForTarget(target),
      buffer: String(Number(target.kind === "angle" ? angleDegrees(hit.constraint.target) : hit.constraint.target).toFixed(3)),
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
    const maxAngle = pendingCommand.target?.kind === "angle" ? 180 : Infinity;
    if (!Number.isFinite(value) || value <= 0 || value >= maxAngle) {
      setHint("寸法値には0より大きい数値を入力してください", "error");
      draw();
      return;
    }
    const { target, dimension, constraint, referenceSketchId, sketchId } = pendingCommand;
    pendingCommand = null;
    hideDimensionValueInput();
    if (constraint) {
      const snapshot = snapshotModelState();
      const previousTarget = constraint.target;
      constraint.target = target.kind === "angle" ? (value * Math.PI) / 180 : value;
      const solved = solveSketchAndDescendants(sketchId || constraintSketchId(constraint), snapshot);
      const result = solved.result;
      if (!solved.success || result.errorNorm > CONSTRAINT_ACCEPT_ERROR) {
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
    addDistanceConstraintFromTarget(target, value, dimension, { referenceSketchId, sketchId });
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
      const active = pendingConstraintCommand?.type === btn.dataset.constraint;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    }
    const canToggleFixed =
      Boolean(selectedArcEndpoint) ||
      (selectedPoints.length >= 1 && selectedLines.length === 0 && selectedCircles.length === 0 && selectedArcs.length === 0) ||
      (selectedPoints.length === 0 && selectedLines.length === 1 && selectedCircles.length === 0 && selectedArcs.length === 0);
    fixPointBtn.setAttribute("aria-disabled", String(!canToggleFixed));

    const enabled = constraintButtons
      .filter((btn) => btn.getAttribute("aria-disabled") !== "true")
      .map((btn) => btn.dataset.label || btn.title);
    const help = enabled.length > 0 ? `追加可能: ${enabled.join(" / ")}` : "点または線を選択すると、追加できる拘束だけが有効になります。";
    document.getElementById("hint").title = help;
  }

  function clearInteractionForSketchChange() {
    clearSelection();
    dragSession = null;
    dimensionDragSession = null;
    selectionRectSession = null;
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    trimPreview = null;
    pendingCommand = null;
    pendingConstraintCommand = null;
    hoveredSketchIdentity = null;
    lastPointerWorld = null;
    hideDimensionValueInput();
    clearSnap();
    mode = "select";
    updateToolbar();
  }

  function nextRootSketchName() {
    let max = 0;
    for (const sketch of model.sketches) {
      if (sketch.parentSketchId !== ROOT_SKETCH_ID || isRootSketch(sketch)) continue;
      const match = /^Sketch[-\s](\d+)$/.exec(sketch.name || "");
      if (match) max = Math.max(max, Number(match[1]));
    }
    return `Sketch-${max + 1}`;
  }

  function nextChildSketchName(parentSketchId) {
    const parent = sketchById(parentSketchId);
    if (isRootSketch(parent)) return nextRootSketchName();
    if (!parent) return nextRootSketchName();
    const prefix = `${parent.name}-`;
    let max = 0;
    for (const sketch of childSketchesOf(parentSketchId)) {
      if (!sketch.name?.startsWith(prefix)) continue;
      const suffix = sketch.name.slice(prefix.length);
      if (/^\d+$/.test(suffix)) max = Math.max(max, Number(suffix));
    }
    return `${prefix}${max + 1}`;
  }

  function nextSketchName(parentSketchId) {
    return parentSketchId && parentSketchId !== ROOT_SKETCH_ID ? nextChildSketchName(parentSketchId) : nextRootSketchName();
  }

  function createSketch(kind = "sibling") {
    ensureSketchState();
    const current = activeSketch();
    const parentSketchId = kind === "child" ? current.id : current.parentSketchId || ROOT_SKETCH_ID;
    const sketch = { id: `S${sketchSeq++}`, name: nextSketchName(parentSketchId), parentSketchId, kind: "sketch" };
    model.sketches.push(sketch);
    model.activeSketchId = sketch.id;
    clearInteractionForSketchChange();
    setHint(parentSketchId ? `編集中: ${sketch.name} / 親: ${sketchName(parentSketchId)}` : `編集中: ${sketch.name}`);
    updateUI();
    draw();
  }

  function setActiveSketch(sketchId) {
    ensureSketchState();
    if (!model.sketches.some((sketch) => sketch.id === sketchId)) return;
    if (model.activeSketchId === sketchId) return;
    model.activeSketchId = sketchId;
    clearInteractionForSketchChange();
    setHint(`編集中: ${sketchName(sketchId)}`);
    updateUI();
    draw();
  }

  function renameSketch(sketchId) {
    const sketch = model.sketches.find((item) => item.id === sketchId);
    if (!sketch || isRootSketch(sketch)) return;
    const next = window.prompt("スケッチ名", sketch.name);
    if (!next) return;
    sketch.name = next.trim() || sketch.name;
    updateUI();
    draw();
  }

  function updateSketchUI() {
    ensureSketchState();
    const activeLabel = document.getElementById("activeSketchLabel");
    const overlay = document.getElementById("sketchOverlay");
    if (overlay) overlay.classList.toggle("tree-collapsed", sketchTreeCollapsed);
    const toggleTreeBtn = document.getElementById("toggleSketchTreeBtn");
    if (toggleTreeBtn) {
      toggleTreeBtn.textContent = sketchTreeCollapsed ? "Show" : "Hide";
      toggleTreeBtn.setAttribute("aria-expanded", String(!sketchTreeCollapsed));
    }
    if (activeLabel) activeLabel.textContent = "スケッチツリー";
    const sketchList = document.getElementById("sketchList");
    if (!sketchList) return;
    sketchList.onmouseleave = () => {
      if (hoveredSketchTreeId) {
        hoveredSketchTreeId = null;
        draw();
      }
    };
    sketchList.innerHTML = sketchTreeRows()
      .map(({ sketch, depth, hasChildren, segments }) => {
        const isActive = sketch.id === activeSketchId();
        const isRoot = isRootSketch(sketch);
        const isAncestor = isAncestorSketchId(sketch.id);
        const isDescendant = descendantSketchIds(activeSketchId()).includes(sketch.id);
        const visible = isVisibleSketchId(sketch.id);
        const solveError = sketchHasSolveError(sketch.id);
        const solveErrorTitle = sketchSolveErrorTitle(sketch.id);
        const count =
          model.points.filter((item) => elementSketchId(item) === sketch.id).length +
          model.lines.filter((item) => elementSketchId(item) === sketch.id).length +
          model.circles.filter((item) => elementSketchId(item) === sketch.id).length +
          model.arcs.filter((item) => elementSketchId(item) === sketch.id).length;
        const treeLines = segments.length
          ? `<span class="sketch-tree-gutter" aria-hidden="true">${segments.map((segment) => `<span class="tree-segment ${segment}"></span>`).join("")}</span>`
          : "";
        return (
          `<div class="item sketch-item ${visible ? "visible" : ""} ${isRoot ? "root" : ""} ${isAncestor ? "ancestor-visible" : ""} ${isDescendant ? "descendant-visible" : ""} ${isActive ? "active" : ""} ${solveError ? "solve-error" : ""} ${hasChildren ? "has-children" : ""}" data-id="${sketch.id}" title="${escapeHtml(solveErrorTitle)}" style="--sketch-depth:${depth}">` +
          treeLines +
          `<button class="sketchActivateBtn" data-id="${sketch.id}" ${isActive ? "disabled" : ""}>${escapeHtml(sketch.name)}</button>` +
          `<span class="sketch-badges">${solveError ? `<span class="badge sketch-error-badge">!</span>` : ""}<span class="badge">${count}</span></span>` +
          (isRoot ? "" : `<button class="sketchRenameBtn icon-small-btn" data-id="${sketch.id}" title="名前変更" aria-label="名前変更">Aa</button>`) +
          `</div>`
        );
      })
      .join("");
    for (const btn of document.querySelectorAll(".sketchActivateBtn")) {
      btn.addEventListener("click", () => setActiveSketch(btn.dataset.id));
    }
    for (const row of document.querySelectorAll(".sketch-item")) {
      row.addEventListener("click", (event) => {
        if (event.target.closest(".sketchRenameBtn")) return;
        setActiveSketch(row.dataset.id);
      });
      row.addEventListener("mouseenter", () => {
        hoveredSketchTreeId = row.dataset.id;
        draw();
      });
      row.addEventListener("mouseleave", () => {
        if (hoveredSketchTreeId === row.dataset.id) {
          hoveredSketchTreeId = null;
          draw();
        }
      });
    }
    for (const btn of document.querySelectorAll(".sketchRenameBtn")) {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        renameSketch(btn.dataset.id);
      });
    }
  }

  function updateUI() {
    refreshConstraintAnalysis();
    updateSketchUI();
    document.getElementById("pointList").innerHTML = model.points
      .filter(isActiveSketchElement)
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
      .filter(isActiveSketchElement)
      .map(
        (l) =>
          `<div class="item list-item"><span>${l.id}: ${l.p1.id} - ${l.p2.id}<span class="badge">len=${l.length().toFixed(2)}</span><span class="badge">${constraintStatusBadge(constraintStatusOf(l))}</span>${l.construction ? "<span class='badge'>補助</span>" : ""}${findLineFixedConstraint(l) ? "<span class='badge'>固定</span>" : ""}</span>` +
          `<button data-id="${l.id}" class="removeLineBtn icon-delete-btn" title="削除" aria-label="削除" data-tooltip="削除">` +
          `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>` +
          `</button></div>`,
      )
      .join("");

    document.getElementById("constraintList").innerHTML = `<div class="item constraint-item"><span>${constraintSummaryText()}</span></div>` + model.constraints
      .map((c, index) => ({ c, index }))
      .filter(({ c }) => isActiveSketchConstraint(c))
      .map(
        ({ c, index }) =>
          `<div class="item constraint-item"><span>${index + 1}. ${c.name}${c.reference ? `<span class="badge relation-badge">参照</span>` : ""}</span>` +
          `<button data-idx="${index}" class="removeConstraintBtn" title="削除" aria-label="削除" data-tooltip="削除">` +
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

  function preconditionArcEndpointToPoint(arc, endpoint, point) {
    if (!arc || !point) return;
    const dx = point.x - arc.center.x;
    const dy = point.y - arc.center.y;
    const distance = hypot2(dx, dy);
    if (distance < MIN_LINE_LENGTH) return;
    if (!hasDirectRadiusDimension(arc)) arc.radiusValue = Math.max(distance, MIN_LINE_LENGTH);
    const prop = endpoint === "start" ? "startAngle" : "endAngle";
    arc[prop] = unwrapAngleNear(Math.atan2(dy, dx), arc[prop]);
  }

  function preconditionArcEndpointCoincidentConstraint(constraint) {
    preconditionArcEndpointToPoint(constraint.arc, constraint.endpoint, constraint.point);
  }

  function preconditionArcEndpointArcEndpointCoincidentConstraint(constraint) {
    const aPoint = arcEndpointPoint(constraint.a, constraint.endpointA);
    const bPoint = arcEndpointPoint(constraint.b, constraint.endpointB);
    if (hasDirectRadiusDimension(constraint.a) && !hasDirectRadiusDimension(constraint.b)) {
      preconditionArcEndpointToPoint(constraint.b, constraint.endpointB, aPoint);
    } else {
      preconditionArcEndpointToPoint(constraint.a, constraint.endpointA, bPoint);
    }
  }

  function preconditionNewConstraint(constraint) {
    if (constraint instanceof ArcEndpointOnLineConstraint) {
      preconditionArcEndpointOnLineConstraint(constraint);
    } else if (constraint instanceof ArcEndpointCoincidentConstraint) {
      preconditionArcEndpointCoincidentConstraint(constraint);
    } else if (constraint instanceof ArcEndpointArcEndpointCoincidentConstraint) {
      preconditionArcEndpointArcEndpointCoincidentConstraint(constraint);
    }
  }

  function commitNewConstraint(type, constraint) {
    if (!constraintTargetsAreActive(constraint)) {
      const msg = "別スケッチ同士は通常拘束できません";
      setHint(msg, "error");
      log(msg);
      return false;
    }
    const snapshot = snapshotModelState();
    pushModelConstraint(constraint);
    preconditionNewConstraint(constraint);

    const solved = solveSketchAndDescendants(constraintSketchId(constraint), snapshot);
    const result = solved.result;
    const collapse = findLineCollapseAfterConstraint(constraint, snapshot, constraintSketchId(constraint));
    if (!solved.success || result.errorNorm > CONSTRAINT_ACCEPT_ERROR || collapse) {
      restoreModelState(snapshot);
      const msg = `拘束を追加できません: 矛盾しています (error=${result.errorNorm.toExponential(3)}, reason=${result.reason})`;
      const collapseMsg = collapse
        ? `拘束を追加できません: 線${collapse.line.id}が退化するため矛盾しています (${collapse.before.toExponential(3)} -> ${collapse.after.toExponential(3)})`
        : msg;
      setHint(collapseMsg, "error");
      updateUI();
      draw();
      log(collapseMsg);
      return;
    }

    clearSelection();
    updateUI();
    draw();
    setHint(`拘束追加: success=${result.success}, error=${result.errorNorm.toExponential(2)}, iter=${result.iterations} / ${constraintSummaryText()}`);
    log(`拘束を追加しました: ${type}\n自動solve: success=${result.success}, error=${result.errorNorm.toExponential(3)}`);
    return true;
  }

  function markReferenceConstraint(constraint, referenceSketchId, sketchId = activeSketchId()) {
    constraint.reference = true;
    constraint.referenceSketchId = referenceSketchId;
    constraint.sketchId = sketchId;
    constraint.name = `参照 ${constraint.name}`;
    return constraint;
  }

  function commitReferenceConstraint(type, constraint, referenceSketchId, sketchId = activeSketchId()) {
    if (!constraint || !isAncestorSketchId(referenceSketchId, sketchId)) {
      const msg = "親または祖先スケッチのみ参照できます";
      setHint(msg, "error");
      log(msg);
      return false;
    }
    const snapshot = snapshotModelState();
    markReferenceConstraint(constraint, referenceSketchId, sketchId);
    pushModelConstraint(constraint, sketchId);
    preconditionNewConstraint(constraint);
    const solved = solveSketchAndDescendants(sketchId, snapshot);
    const result = solved.result;
    const collapse = findLineCollapseAfterConstraint(constraint, snapshot, sketchId);
    if (!solved.success || result.errorNorm > CONSTRAINT_ACCEPT_ERROR || collapse) {
      restoreModelState(snapshot);
      const msg = `参照拘束を追加できません: 矛盾しています (error=${result.errorNorm.toExponential(3)}, reason=${result.reason})`;
      const collapseMsg = collapse
        ? `参照拘束を追加できません: 線${collapse.line.id}が退化するため矛盾しています (${collapse.before.toExponential(3)} -> ${collapse.after.toExponential(3)})`
        : msg;
      setHint(collapseMsg, "error");
      updateUI();
      draw();
      log(collapseMsg);
      return false;
    }
    clearSelection();
    updateUI();
    draw();
    setHint(`参照拘束追加: ${sketchName(referenceSketchId)} を参照 / success=${result.success}, error=${result.errorNorm.toExponential(2)}`);
    log(`参照拘束を追加しました: ${type}\n自動solve: success=${result.success}, error=${result.errorNorm.toExponential(3)}`);
    return true;
  }

  function referenceConstraintForSubject(subject, referenceTarget) {
    if (!subject || !referenceTarget) return null;
    if (subject.kind === "point") {
      if (referenceTarget.kind === "point") return new CoincidentConstraint(subject.point, referenceTarget.point);
      if (referenceTarget.kind === "line") return new PointOnLineConstraint(subject.point, referenceTarget.line);
      if (referenceTarget.kind === "primitive") return new PointOnCircleConstraint(subject.point, referenceTarget.primitive);
    }
    if (subject.kind === "line") {
      if (referenceTarget.kind === "line") return new CollinearConstraint(subject.line, referenceTarget.line);
    }
    if (subject.kind === "primitive") {
      if (referenceTarget.kind === "point") return new PointOnCircleConstraint(referenceTarget.point, subject.primitive);
      if (referenceTarget.kind === "primitive") return new ConcentricConstraint(subject.primitive, referenceTarget.primitive);
    }
    if (subject.kind === "arc-endpoint") {
      if (referenceTarget.kind === "point") return new ArcEndpointCoincidentConstraint(subject.arc, subject.endpoint, referenceTarget.point);
      if (referenceTarget.kind === "line") return new ArcEndpointOnLineConstraint(subject.arc, subject.endpoint, referenceTarget.line);
      if (referenceTarget.kind === "primitive") return new ArcEndpointOnCircleConstraint(subject.arc, subject.endpoint, referenceTarget.primitive);
    }
    return null;
  }

  function referenceConstraintForType(type, subject, referenceTarget) {
    if (type === "coincident") return referenceConstraintForSubject(subject, referenceTarget);
    if (!subject || !referenceTarget) return null;
    if (type === "horizontal") {
      if (subject.kind === "point" && referenceTarget.kind === "point") return new PointHorizontalConstraint(subject.point, referenceTarget.point);
      return null;
    }
    if (type === "vertical") {
      if (subject.kind === "point" && referenceTarget.kind === "point") return new PointVerticalConstraint(subject.point, referenceTarget.point);
      return null;
    }
    if (type === "parallel") {
      if (subject.kind === "line" && referenceTarget.kind === "line") return new ParallelConstraint(subject.line, referenceTarget.line);
      return null;
    }
    if (type === "perpendicular") {
      if (subject.kind === "line" && referenceTarget.kind === "line") return new PerpendicularConstraint(subject.line, referenceTarget.line);
      return null;
    }
    if (type === "collinear") {
      if (subject.kind === "line" && referenceTarget.kind === "line") return new CollinearConstraint(subject.line, referenceTarget.line);
      return null;
    }
    if (type === "equal") {
      if (subject.kind === "line" && referenceTarget.kind === "line") return new EqualLengthConstraint(subject.line, referenceTarget.line);
      if (subject.kind === "primitive" && referenceTarget.kind === "primitive") return new EqualRadiusConstraint(subject.primitive, referenceTarget.primitive);
      return null;
    }
    if (type === "equalRadius") {
      if (subject.kind === "primitive" && referenceTarget.kind === "primitive") return new EqualRadiusConstraint(subject.primitive, referenceTarget.primitive);
      return null;
    }
    if (type === "concentric") {
      if (subject.kind === "primitive" && referenceTarget.kind === "primitive") return new ConcentricConstraint(subject.primitive, referenceTarget.primitive);
      if (subject.kind === "primitive" && referenceTarget.kind === "point") return new ConcentricConstraint(subject.primitive, referenceTarget.point);
      if (subject.kind === "point" && referenceTarget.kind === "primitive") return new ConcentricConstraint(subject.point, referenceTarget.primitive);
      return null;
    }
    if (type === "pointOnCircle") {
      if (subject.kind === "point" && referenceTarget.kind === "primitive") return new PointOnCircleConstraint(subject.point, referenceTarget.primitive);
      if (subject.kind === "primitive" && referenceTarget.kind === "point") return new PointOnCircleConstraint(referenceTarget.point, subject.primitive);
      if (subject.kind === "arc-endpoint" && referenceTarget.kind === "primitive") return new ArcEndpointOnCircleConstraint(subject.arc, subject.endpoint, referenceTarget.primitive);
      return null;
    }
    if (type === "tangent") {
      if (subject.kind === "line" && referenceTarget.kind === "primitive") return new LineCircleTangentConstraint(subject.line, referenceTarget.primitive);
      if (subject.kind === "primitive" && referenceTarget.kind === "line") return new LineCircleTangentConstraint(referenceTarget.line, subject.primitive);
      if (subject.kind === "primitive" && referenceTarget.kind === "primitive") return new CircleCircleTangentConstraint(subject.primitive, referenceTarget.primitive);
      return null;
    }
    return null;
  }

  function referenceDistanceTargetForSubject(subject, referenceTarget) {
    if (!subject || !referenceTarget) return null;
    if (subject.kind === "point" && referenceTarget.kind === "point") {
      return { kind: "point-point", p1: subject.point, p2: referenceTarget.point, value: hypot2(referenceTarget.point.x - subject.point.x, referenceTarget.point.y - subject.point.y) };
    }
    if (subject.kind === "point" && referenceTarget.kind === "line") {
      return { kind: "point-line", point: subject.point, line: referenceTarget.line, value: Math.abs(signedPointLineDistance(subject.point, referenceTarget.line)) };
    }
    if (subject.kind === "line" && referenceTarget.kind === "point") {
      return { kind: "point-line", point: referenceTarget.point, line: subject.line, value: Math.abs(signedPointLineDistance(referenceTarget.point, subject.line)) };
    }
    if (subject.kind === "line" && referenceTarget.kind === "line") {
      if (!lineHasDirection(subject.line) || !lineHasDirection(referenceTarget.line)) return { kind: "invalid", reason: "寸法対象の線が短すぎます" };
      if (!linesAreParallel(subject.line, referenceTarget.line)) {
        return { kind: "angle", line1: subject.line, line2: referenceTarget.line, value: angleDegrees(axisAngleBetweenLines(subject.line, referenceTarget.line)), signedValue: angleDimensionSweep({ line1: subject.line, line2: referenceTarget.line }) };
      }
      return { kind: "line-line", line1: subject.line, line2: referenceTarget.line, value: Math.abs(signedPointLineDistance(referenceTarget.line.p1, subject.line)) };
    }
    return null;
  }

  function startReferenceDistanceInput(subject, referenceTarget, pointer) {
    return startDistanceResolution(constraintResolutionFromSubjectAndReference("distance", subject, referenceTarget), pointer);
  }

  function referenceSketchIdFromPair(subject, referenceTarget) {
    const subjectSketchId = referenceSubjectSketchId(subject);
    if (!subjectSketchId || !referenceTarget?.sketchId) return null;
    return isAncestorSketchId(referenceTarget.sketchId, subjectSketchId) ? referenceTarget.sketchId : null;
  }

  function constraintResolutionFromSubjectAndReference(type, subject, referenceTarget) {
    const subjectElement = referenceSubjectElement(subject);
    const subjectSketchId = referenceSubjectSketchId(subject);
    const referenceSketchId = referenceSketchIdFromPair(subject, referenceTarget);
    if (!subject || !subjectElement || !isEditableSketchElement(subjectElement)) {
      return { error: "アクティブスケッチ側の対象を選択してください" };
    }
    if (!referenceTarget || !referenceSketchId) {
      return { error: "親または祖先スケッチのみ参照できます" };
    }
    if (type === "distance") {
      const target = referenceDistanceTargetForSubject(subject, referenceTarget);
      if (!target || target.kind === "invalid") return { error: target?.reason || "参照寸法の組み合わせに対応していません" };
      return { type, target, referenceSketchId, sketchId: subjectSketchId, referenceTarget, referenceSubject: subject };
    }
    const constraint = referenceConstraintForType(type, subject, referenceTarget);
    if (!constraint) return { error: "この参照拘束の組み合わせには対応していません" };
    return { type, constraint, referenceSketchId, sketchId: subjectSketchId };
  }

  function constraintResolutionFromCurrentSelection(type) {
    const referenceTarget = pendingConstraintCommand?.referenceTarget;
    if (referenceTarget) return constraintResolutionFromSubjectAndReference(type, activeReferenceSubject(), referenceTarget);
    if (type === "distance") {
      const target = distanceTargetFromSelection();
      if (!target) return null;
      if (target.kind === "invalid") return { error: target.reason };
      return { type, target, sketchId: activeSketchId() };
    }
    const constraint = constraintFromSelection(type);
    if (!constraint) return null;
    return { type, constraint, sketchId: activeSketchId() };
  }

  function startDistanceResolution(resolution, pointer) {
    if (!resolution || resolution.error || !resolution.target) {
      if (resolution?.error) setHint(resolution.error, "error");
      return false;
    }
    mode = "select";
    const initialDimension = pointer ? null : defaultDimensionForTarget(resolution.target);
    const initialPointer = pointer || dimensionAnchor(resolution.target, initialDimension);
    if (resolution.referenceSubject) selectReferenceSubjectForPreview(resolution.referenceSubject);
    pendingConstraintCommand = { type: "distance", referenceTarget: resolution.referenceTarget };
    pendingCommand = {
      type: "distance-place",
      target: resolution.target,
      pointer: initialPointer,
      dimension: initialDimension,
      referenceTarget: resolution.referenceTarget,
      referenceSubject: resolution.referenceSubject,
      referenceSketchId: resolution.referenceSketchId,
      sketchId: resolution.sketchId,
    };
    updateConstraintButtons();
    updateToolbar();
    setHint(resolution.referenceSketchId ? "参照寸法線の位置をクリックしてください" : "寸法線の位置をクリックしてください");
    draw();
    return true;
  }

  function commitConstraintResolution(resolution, pointer = null) {
    if (!resolution || resolution.error) {
      if (resolution?.error) setHint(resolution.error, "error");
      return false;
    }
    if (resolution.type === "distance") return startDistanceResolution(resolution, resolution.referenceSketchId ? null : pointer);
    if (!resolution.constraint) return false;
    if (resolution.referenceSketchId) return commitReferenceConstraint(resolution.type || "reference", resolution.constraint, resolution.referenceSketchId, resolution.sketchId || activeSketchId());
    return commitNewConstraint(resolution.type || "constraint", resolution.constraint);
  }

  function handleReferenceTargetClick(referenceTarget, pointer, distanceMode = false) {
    const subject = activeReferenceSubject();
    const subjectElement = referenceSubjectElement(subject);
    const subjectSketchId = referenceSubjectSketchId(subject);
    if (!subject || !isEditableSketchElement(subjectElement)) {
      setHint("参照先を選ぶ前に、操作可能なスケッチ側の対象を1つ選択してください");
      return true;
    }
    if (!referenceTarget) {
      setHint("親または祖先スケッチの点・線・円・円弧をクリックしてください", "error");
      return true;
    }
    if (!isAncestorSketchId(referenceTarget.sketchId, subjectSketchId)) {
      setHint("親または祖先スケッチのみ参照できます", "error");
      return true;
    }
    commitConstraintResolution(constraintResolutionFromSubjectAndReference(distanceMode && referenceTarget.kind === "line" ? "distance" : "coincident", subject, referenceTarget), pointer);
    return true;
  }

  function handleReferenceSubjectAndTarget(subject, referenceTarget, pointer, type, distanceMode = false) {
    if (!subject) {
      setHint("アクティブスケッチ側の対象を選択してください", "error");
      return true;
    }
    const subjectElement = referenceSubjectElement(subject);
    if (!isEditableSketchElement(subjectElement)) {
      setHint("アクティブスケッチ側の対象を選択してください", "error");
      return true;
    }
    const subjectSketchId = referenceSubjectSketchId(subject);
    if (!referenceTarget || !isAncestorSketchId(referenceTarget.sketchId, subjectSketchId)) {
      setHint("親または祖先スケッチのみ参照できます", "error");
      return true;
    }
    commitConstraintResolution(constraintResolutionFromSubjectAndReference(type === "distance" || (distanceMode && referenceTarget.kind === "line") ? "distance" : type, subject, referenceTarget), pointer);
    return true;
  }

  function tryStartReferenceDistanceFromHits(activeSubject, referenceTarget, pointer) {
    if (pendingConstraintCommand?.type !== "distance" || !activeSubject || !referenceTarget) return false;
    return commitConstraintResolution(constraintResolutionFromSubjectAndReference("distance", activeSubject, referenceTarget), pointer);
  }

  function addDistanceConstraintFromTarget(target, value, dimension, options = {}) {
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
    } else if (target.kind === "angle") {
      constraint = new LineAngleConstraint(target.line1, target.line2, (value * Math.PI) / 180, dimension?.angleStartFlip || 0, dimension?.angleEndFlip || 0);
    } else if (target.kind === "radius") {
      constraint = new RadiusConstraint(target.primitive, value);
    } else if (target.kind === "diameter") {
      constraint = new DiameterConstraint(target.primitive, value);
    }
    if (!constraint) return false;
    constraint.dimension = dimension;
    return commitConstraintResolution({
      type: options.referenceSketchId ? "referenceDimension" : "dimension",
      constraint,
      referenceSketchId: options.referenceSketchId,
      sketchId: options.sketchId || activeSketchId(),
    });
  }

  function constraintFromSelection(type) {
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
      } else if (selectedPoints.length === 0 && selectedLines.length === 2) {
        constraint = new CollinearConstraint(selectedLines[0], selectedLines[1]);
      } else {
        constraint = new CoincidentConstraint(selectedPoints[0], selectedPoints[1]);
      }
    } else if (type === "horizontal") {
      constraint = selectedPoints.length === 2 ? new PointHorizontalConstraint(selectedPoints[0], selectedPoints[1]) : new HorizontalConstraint(selectedLines[0]);
    } else if (type === "vertical") {
      constraint = selectedPoints.length === 2 ? new PointVerticalConstraint(selectedPoints[0], selectedPoints[1]) : new VerticalConstraint(selectedLines[0]);
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
    return constraint;
  }

  function addConstraint(type) {
    if (!canApplyConstraint(type)) return;
    if (type === "distance") return startDistanceCommand();

    const resolution = constraintResolutionFromCurrentSelection(type);
    if (resolution?.constraint) {
      selectedArcEndpointPair = null;
      commitConstraintResolution(resolution);
    }
  }

  function dragSketchIdFromSelection(points = []) {
    const ids = [...new Set(points.filter(Boolean).map(elementSketchId).filter(isEditableSketchId))];
    if (ids.length === 1) return ids[0];
    if (ids.includes(activeSketchId())) return activeSketchId();
    return ids[0] || activeSketchId();
  }

  function dragSketchIdFor(kind, item) {
    if (kind === "arc-endpoint") return elementSketchId(item?.arc);
    if (kind === "selection") return dragSketchIdFromSelection(item);
    return elementSketchId(item);
  }

  function buildDragSession(kind, item, pointer) {
    const sketchId = dragSketchIdFor(kind, item);
    if (kind === "selection") {
      const points = item
        .filter((p, index, arr) => p && elementSketchId(p) === sketchId && !p.fixed && !pointLockedByLineFixed(p) && arr.indexOf(p) === index)
        .map((p) => ({ point: p, startX: p.x, startY: p.y }));
      if (points.length === 0) return null;
      return { kind, sketchId, startPointer: pointer, points };
    }

    if (kind === "point") {
      if (item.fixed || pointLockedByLineFixed(item)) return null;
      return {
        kind,
        sketchId,
        startPointer: pointer,
        points: [{ point: item, startX: item.x, startY: item.y }],
      };
    }

    if (kind === "line" && findLineFixedConstraint(item)) return null;

    if (kind === "circle" || kind === "arc") {
      return {
        kind,
        sketchId,
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
        sketchId,
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
    return { kind, sketchId, item, startPointer: pointer, points };
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
    session.local = localSolveContextFromSeeds(dragSessionSeeds(session), session.sketchId);
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

  function selectHitOnly(hitP, hitL, hitC, hitA, hitArcEnd) {
    selectedDimensionConstraint = null;
    selectedPoints = hitP ? [hitP] : [];
    selectedLines = hitL ? [hitL] : [];
    selectedCircles = hitC ? [hitC] : [];
    selectedArcs = hitA ? [hitA] : hitArcEnd ? [hitArcEnd.arc] : [];
    selectedArcEndpoint = hitArcEnd ? { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint } : null;
    selectedArcEndpointPair = null;
    draw();
  }

  function dragTargets(session, pointer) {
    const dx = pointer.x - session.startPointer.x;
    const dy = pointer.y - session.startPointer.y;
    return session.points.map((p) => ({ point: p.point, x: p.startX + dx, y: p.startY + dy }));
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

  function arcEndpointDragConstraints(session, pointer) {
    return [new ArcEndpointDragConstraint(session.item, session.endpoint, pointer.x, pointer.y)];
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
    if (session?.local && session.local.constraints.length === 0) {
      for (const target of targets) {
        if (target.point) {
          target.point.x = target.x;
          target.point.y = target.y;
        } else if (target.object && target.prop) {
          target.object[target.prop] = target.min != null ? Math.max(target.min, target.value) : target.value;
        }
      }
      return {
        success: true,
        errorNorm: 0,
        iterations: 0,
        reason: "直接移動",
        local: true,
        guided: true,
        variableCount: session.local.variables.length,
        constraintCount: 0,
      };
    }
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

  function finalizeDragResult(result, state, session = null, extra = [], retry = null) {
    const lineRepair = enforceMinimumLineLengths(session?.local?.lines || model.lines);
    if (lineRepair.changed > 0) {
      result = retry ? retry() : session?.local ? solveDragWithFallback(session, extra, () => solveDragSketch(session, extra), state) : solveDragSketch(session, extra);
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
        const targets = moveTargets;
        const retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solveDragSketch(session, extra), dragState);
        result = retry();
        return finalizeDragResult(result, dragState, session, extra, retry);
      }

      const state = solver.clone(dragVars);
      let targets = radiusDragTargets(session, pointer);
      let extra = parameterDragConstraintsFromTargets(targets);
      let retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solveDragSketch(session, extra), dragState);
      result = retry();
      if (!result.success && moveTargets.length > 0) {
        solver.restore(state);
        session.activeMode = "move";
        targets = moveTargets;
        extra = dragConstraintsFromTargets(moveTargets);
        retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solveDragSketch(session, extra), dragState);
        result = retry();
        return finalizeDragResult(result, dragState, session, extra, retry);
      }
      session.activeMode = "radius";
      return finalizeDragResult(result, dragState, session, extra, retry);
    }
    let targets;
    let extra;
    if (session.mode === "arc-endpoint") {
      extra = arcEndpointDragConstraints(session, pointer);
      const retry = () => solveDragWithFallback(session, extra, () => solveDragSketch(session, extra), dragState);
      result = retry();
      return finalizeDragResult(result, dragState, session, extra, retry);
    } else {
      const directTargets = dragTargets(session, pointer);
      targets = directTargets;
      extra = dragConstraintsFromTargets(directTargets);
    }
    const retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solveDragSketch(session, extra), dragState);
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

  function syncAngleConstraintFromDimension(constraint, target, dimension) {
    if (!(constraint instanceof LineAngleConstraint) || target.kind !== "angle" || !dimension) return;
    const angles = angleDimensionAngles(target, null, dimension);
    constraint.startFlip = dimension.angleStartFlip ? 1 : 0;
    constraint.endFlip = dimension.angleEndFlip ? 1 : 0;
    constraint.target = Math.abs(angles.signed);
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
    pushModelConstraint(dx >= dy ? new HorizontalConstraint(line) : new VerticalConstraint(line));
  }

  function handleLineClick(p, lockOrthogonal = false) {
    if (lineStartPoint && lockOrthogonal) p = orthogonalPointFrom(lineStartPoint, p);
    p = snapForDrawing(p);
    let snap = activeSnap;
    if (lineStartPoint) p = pointAtMinimumDistance(lineStartPoint, p);
    if (snap && !samePosition(p, snap)) snap = null;
    const endpoint = lineStartPoint && hypot2(p.x - lineStartPoint.x, p.y - lineStartPoint.y) <= MIN_LINE_LENGTH + 1e-9 ? addPoint(p.x, p.y, false, "endpoint") : endpointAt(p.x, p.y);
    pointerPreview = p;

    if (!lineStartPoint) {
      addPointSnapConstraints(endpoint, snap);
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
      addPointSnapConstraints(endpoint, snap);
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
    let snap = activeSnap;
    pointerPreview = p;
    if (!rectangleStartPoint) {
      rectangleStartPoint = endpointAt(p.x, p.y);
      addPointSnapConstraints(rectangleStartPoint, snap);
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
    if (snap && !samePosition(p, snap)) snap = null;
    const p1 = rectangleStartPoint;
    const p2 = addPoint(p.x, p1.y, false, "endpoint");
    const p3 = addPoint(p.x, p.y, false, "endpoint");
    const p4 = addPoint(p1.x, p.y, false, "endpoint");
    addPointSnapConstraints(p3, snap);
    const lines = [addLine(p1, p2), addLine(p2, p3), addLine(p3, p4), addLine(p4, p1)].filter(Boolean);
    if (lines[0]) pushModelConstraint(new HorizontalConstraint(lines[0]));
    if (lines[1]) pushModelConstraint(new VerticalConstraint(lines[1]));
    if (lines[2]) pushModelConstraint(new HorizontalConstraint(lines[2]));
    if (lines[3]) pushModelConstraint(new VerticalConstraint(lines[3]));
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

  function pointOnLineAt(line, t) {
    return { x: line.p1.x + (line.p2.x - line.p1.x) * t, y: line.p1.y + (line.p2.y - line.p1.y) * t };
  }

  function lineParam(line, p) {
    const dx = line.p2.x - line.p1.x;
    const dy = line.p2.y - line.p1.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return 0;
    return ((p.x - line.p1.x) * dx + (p.y - line.p1.y) * dy) / len2;
  }

  function addUniqueBoundary(list, boundary, tolerance = 1e-6) {
    if (!Number.isFinite(boundary.t)) return;
    if (boundary.t < -tolerance || boundary.t > 1 + tolerance) return;
    boundary.t = Math.max(0, Math.min(1, boundary.t));
    if (list.some((item) => Math.abs(item.t - boundary.t) <= tolerance)) return;
    list.push(boundary);
  }

  function lineLineBoundary(target, other) {
    const x1 = target.p1.x, y1 = target.p1.y, x2 = target.p2.x, y2 = target.p2.y;
    const x3 = other.p1.x, y3 = other.p1.y, x4 = other.p2.x, y4 = other.p2.y;
    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(den) < 1e-12) return null;
    const point = {
      x: ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / den,
      y: ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / den,
    };
    const t = lineParam(target, point);
    const u = lineParam(other, point);
    if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null;
    return { t, point, source: { line: other } };
  }

  function lineCircleBoundaries(line, primitive, requireArc = false) {
    const dx = line.p2.x - line.p1.x;
    const dy = line.p2.y - line.p1.y;
    const fx = line.p1.x - primitive.center.x;
    const fy = line.p1.y - primitive.center.y;
    const qa = dx * dx + dy * dy;
    if (qa < 1e-12) return [];
    const qb = 2 * (fx * dx + fy * dy);
    const qc = fx * fx + fy * fy - primitive.radius() * primitive.radius();
    const disc = qb * qb - 4 * qa * qc;
    if (disc < -1e-9) return [];
    const roots = Math.abs(disc) < 1e-9 ? [-qb / (2 * qa)] : [(-qb - Math.sqrt(disc)) / (2 * qa), (-qb + Math.sqrt(disc)) / (2 * qa)];
    return roots.map((t) => {
      if (t < -1e-6 || t > 1 + 1e-6) return null;
      const point = pointOnLineAt(line, t);
      if (requireArc && !angleOnSignedSweep(Math.atan2(point.y - primitive.center.y, point.x - primitive.center.x), primitive.startAngle, primitive.endAngle)) return null;
      return { t, point, source: requireArc ? { arc: primitive } : { primitive } };
    }).filter(Boolean);
  }

  function circleCirclePoints(a, b) {
    const dx = b.center.x - a.center.x;
    const dy = b.center.y - a.center.y;
    const d = hypot2(dx, dy);
    const r0 = a.radius();
    const r1 = b.radius();
    if (d < 1e-12 || d > r0 + r1 + 1e-9 || d < Math.abs(r0 - r1) - 1e-9) return [];
    const x = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
    const h2 = r0 * r0 - x * x;
    if (h2 < -1e-9) return [];
    const h = Math.sqrt(Math.max(0, h2));
    const ux = dx / d;
    const uy = dy / d;
    const base = { x: a.center.x + ux * x, y: a.center.y + uy * x };
    if (h < 1e-9) return [base];
    return [{ x: base.x - uy * h, y: base.y + ux * h }, { x: base.x + uy * h, y: base.y - ux * h }];
  }

  function circleParam(circle, angle) {
    return normalizeAngle(angle) / (Math.PI * 2);
  }

  function angleAtCircleParam(t) {
    return t * Math.PI * 2;
  }

  function arcParam(arc, angle) {
    const sweep = arc.endAngle - arc.startAngle;
    if (Math.abs(sweep) < 1e-12) return 0;
    return sweep >= 0 ? normalizeAngle(angle - arc.startAngle) / sweep : normalizeAngle(arc.startAngle - angle) / -sweep;
  }

  function arcParamOnSweep(arc, angle) {
    const sweep = arc.endAngle - arc.startAngle;
    if (Math.abs(sweep) < 1e-12) return null;
    if (!angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return null;
    return sweep >= 0 ? normalizeAngle(angle - arc.startAngle) / sweep : normalizeAngle(arc.startAngle - angle) / -sweep;
  }

  function angleAtArcParam(arc, t) {
    return arc.startAngle + (arc.endAngle - arc.startAngle) * t;
  }

  function pointAtArcParam(arc, t) {
    const angle = angleAtArcParam(arc, t);
    return { x: arc.center.x + Math.cos(angle) * arc.radius(), y: arc.center.y + Math.sin(angle) * arc.radius() };
  }

  function lineTrimBoundaries(line) {
    const boundaries = [{ t: 0, point: line.p1 }, { t: 1, point: line.p2 }];
    for (const other of model.lines) {
      if (!isActiveSketchElement(other)) continue;
      if (other === line) continue;
      const b = lineLineBoundary(line, other);
      if (b) addUniqueBoundary(boundaries, b);
    }
    for (const circle of model.circles) if (isActiveSketchElement(circle)) for (const b of lineCircleBoundaries(line, circle)) addUniqueBoundary(boundaries, b);
    for (const arc of model.arcs) if (isActiveSketchElement(arc)) for (const b of lineCircleBoundaries(line, arc, true)) addUniqueBoundary(boundaries, b);
    return boundaries.sort((a, b) => a.t - b.t);
  }

  function arcTrimBoundaries(arc) {
    const boundaries = [{ t: 0, point: arcEndpointPoint(arc, "start") }, { t: 1, point: arcEndpointPoint(arc, "end") }];
    const addPointBoundary = (point, source) => {
      const t = arcParamOnSweep(arc, Math.atan2(point.y - arc.center.y, point.x - arc.center.x));
      if (t !== null) addUniqueBoundary(boundaries, { t, point, source });
    };
    for (const line of model.lines) if (isActiveSketchElement(line)) for (const b of lineCircleBoundaries(line, arc, true)) addPointBoundary(b.point, { line });
    for (const circle of model.circles) if (isActiveSketchElement(circle)) for (const point of circleCirclePoints(arc, circle)) addPointBoundary(point, { primitive: circle });
    for (const other of model.arcs) {
      if (!isActiveSketchElement(other)) continue;
      if (other === arc) continue;
      for (const point of circleCirclePoints(arc, other)) {
        if (angleOnSignedSweep(Math.atan2(point.y - other.center.y, point.x - other.center.x), other.startAngle, other.endAngle)) addPointBoundary(point, { arc: other });
      }
    }
    return boundaries.sort((a, b) => a.t - b.t);
  }

  function circleTrimBoundaries(circle) {
    const boundaries = [];
    const addPointBoundary = (point, source) => {
      const angle = Math.atan2(point.y - circle.center.y, point.x - circle.center.x);
      addUniqueBoundary(boundaries, { t: circleParam(circle, angle), angle, point, source });
    };
    for (const line of model.lines) if (isActiveSketchElement(line)) for (const b of lineCircleBoundaries(line, circle)) addPointBoundary(b.point, { line });
    for (const other of model.circles) {
      if (!isActiveSketchElement(other)) continue;
      if (other === circle) continue;
      for (const point of circleCirclePoints(circle, other)) addPointBoundary(point, { primitive: other });
    }
    for (const arc of model.arcs) {
      if (!isActiveSketchElement(arc)) continue;
      for (const point of circleCirclePoints(circle, arc)) {
        if (angleOnSignedSweep(Math.atan2(point.y - arc.center.y, point.x - arc.center.x), arc.startAngle, arc.endAngle)) addPointBoundary(point, { arc });
      }
    }
    return boundaries.sort((a, b) => a.t - b.t);
  }

  function trimInterval(boundaries, t) {
    for (let i = 0; i < boundaries.length - 1; i++) {
      if (t >= boundaries[i].t - 1e-6 && t <= boundaries[i + 1].t + 1e-6) return { left: boundaries[i], right: boundaries[i + 1] };
    }
    return null;
  }

  function hitInactiveElement(x, y) {
    const hit = hitSketchIdentityElement(x, y, { inactiveOnly: true });
    return hit ? { id: hit.id, sketchId: hit.sketchId, item: hit.item } : null;
  }

  function hitSketchIdentityElement(x, y, options = {}) {
    const inactiveOnly = Boolean(options.inactiveOnly);
    const threshold = 7 / viewport.scale;
    const pointThreshold = 10 / viewport.scale;
    const accepts = (item) => isVisibleSketchElement(item) && (!inactiveOnly || !isEditableSketchElement(item));
    for (let i = model.points.length - 1; i >= 0; i--) {
      const p = model.points[i];
      if (!accepts(p)) continue;
      if (hypot2(p.x - x, p.y - y) <= pointThreshold) return { id: p.id, sketchId: elementSketchId(p), item: p, kind: "point" };
    }
    for (let i = model.lines.length - 1; i >= 0; i--) {
      const line = model.lines[i];
      if (!accepts(line)) continue;
      if (distancePointToSegment(x, y, line) <= threshold) return { id: line.id, sketchId: elementSketchId(line), item: line, kind: "line" };
    }
    for (let i = model.circles.length - 1; i >= 0; i--) {
      const circle = model.circles[i];
      if (!accepts(circle)) continue;
      if (Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold) return { id: circle.id, sketchId: elementSketchId(circle), item: circle, kind: "circle" };
    }
    for (let i = model.arcs.length - 1; i >= 0; i--) {
      const arc = model.arcs[i];
      if (!accepts(arc)) continue;
      const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
      if (Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return { id: arc.id, sketchId: elementSketchId(arc), item: arc, kind: "arc" };
    }
    return null;
  }

  function hitReferenceTarget(x, y) {
    const threshold = 7 / viewport.scale;
    const pointThreshold = 10 / viewport.scale;
    const allowedSketches = new Set(ancestorSketchIds());
    if (allowedSketches.size === 0) return null;
    for (let i = model.points.length - 1; i >= 0; i--) {
      const point = model.points[i];
      const sketchId = elementSketchId(point);
      if (!allowedSketches.has(sketchId)) continue;
      if (!isExplicitPoint(point) && !isPointUsedByPrimitive(point) && !isReferencePoint(point)) continue;
      if (hypot2(point.x - x, point.y - y) <= pointThreshold) return { kind: "point", point, sketchId };
    }
    for (let i = model.lines.length - 1; i >= 0; i--) {
      const line = model.lines[i];
      const sketchId = elementSketchId(line);
      if (!allowedSketches.has(sketchId)) continue;
      if (distancePointToSegment(x, y, line) <= threshold) return { kind: "line", line, sketchId };
    }
    for (let i = model.circles.length - 1; i >= 0; i--) {
      const circle = model.circles[i];
      const sketchId = elementSketchId(circle);
      if (!allowedSketches.has(sketchId)) continue;
      if (Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold) return { kind: "primitive", primitive: circle, sketchId };
    }
    for (let i = model.arcs.length - 1; i >= 0; i--) {
      const arc = model.arcs[i];
      const sketchId = elementSketchId(arc);
      if (!allowedSketches.has(sketchId)) continue;
      const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
      if (Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return { kind: "primitive", primitive: arc, sketchId };
    }
    return null;
  }

  function cyclicTrimInterval(boundaries, t) {
    if (boundaries.length < 2) return null;
    for (let i = 0; i < boundaries.length; i++) {
      const left = boundaries[i];
      const right = boundaries[(i + 1) % boundaries.length];
      if (left.t <= right.t) {
        if (t >= left.t - 1e-6 && t <= right.t + 1e-6) return { left, right, wraps: false };
      } else if (t >= left.t - 1e-6 || t <= right.t + 1e-6) {
        return { left, right, wraps: true };
      }
    }
    return null;
  }

  function trimPreviewForLine(line, pointer) {
    const projected = closestPointOnSegment(pointer.x, pointer.y, line);
    const boundaries = lineTrimBoundaries(line);
    const interval = trimInterval(boundaries, lineParam(line, projected));
    if (boundaries.length <= 2) return { kind: "line", item: line, deleteWhole: true, interval: { left: boundaries[0], right: boundaries[1] } };
    if (!interval) return null;
    if (line.length() * Math.max(0, interval.right.t - interval.left.t) < MIN_LINE_LENGTH) return null;
    return { kind: "line", item: line, interval };
  }

  function trimPreviewForArc(arc, pointer) {
    const t = arcParamOnSweep(arc, Math.atan2(pointer.y - arc.center.y, pointer.x - arc.center.x));
    if (t === null) return null;
    const boundaries = arcTrimBoundaries(arc);
    const interval = trimInterval(boundaries, t);
    if (boundaries.length <= 2) return { kind: "arc", item: arc, deleteWhole: true, interval: { left: boundaries[0], right: boundaries[1] } };
    if (!interval) return null;
    if (arc.radius() * Math.abs(arc.endAngle - arc.startAngle) * Math.max(0, interval.right.t - interval.left.t) < MIN_ARC_LENGTH) return null;
    return { kind: "arc", item: arc, interval };
  }

  function trimPreviewForCircle(circle, pointer) {
    const t = circleParam(circle, Math.atan2(pointer.y - circle.center.y, pointer.x - circle.center.x));
    const boundaries = circleTrimBoundaries(circle);
    if (boundaries.length === 0) return { kind: "circle", item: circle, deleteWhole: true };
    if (boundaries.length < 2) return null;
    const interval = cyclicTrimInterval(boundaries, t);
    if (!interval) return null;
    const left = { ...interval.left, angle: angleAtCircleParam(interval.left.t) };
    const right = { ...interval.right, angle: angleAtCircleParam(interval.right.t) + (interval.wraps ? Math.PI * 2 : 0) };
    const span = Math.max(0, right.angle - left.angle);
    if (span * circle.radius() < MIN_ARC_LENGTH) return null;
    return { kind: "circle", item: circle, interval: { left, right }, boundaries };
  }

  function computeTrimPreview(pointer) {
    const threshold = 7 / viewport.scale;
    const candidates = [];
    for (const line of model.lines) {
      if (!isActiveSketchElement(line)) continue;
      const p = closestPointOnSegment(pointer.x, pointer.y, line);
      const distance = hypot2(pointer.x - p.x, pointer.y - p.y);
      if (distance <= threshold) candidates.push({ distance, preview: () => trimPreviewForLine(line, pointer) });
    }
    for (const arc of model.arcs) {
      if (!isActiveSketchElement(arc)) continue;
      const angle = Math.atan2(pointer.y - arc.center.y, pointer.x - arc.center.x);
      if (!angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) continue;
      const distance = Math.abs(hypot2(pointer.x - arc.center.x, pointer.y - arc.center.y) - arc.radius());
      if (distance <= threshold) candidates.push({ distance, preview: () => trimPreviewForArc(arc, pointer) });
    }
    for (const circle of model.circles) {
      if (!isActiveSketchElement(circle)) continue;
      const distance = Math.abs(hypot2(pointer.x - circle.center.x, pointer.y - circle.center.y) - circle.radius());
      if (distance <= threshold) candidates.push({ distance, preview: () => trimPreviewForCircle(circle, pointer) });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    for (const candidate of candidates) {
      const preview = candidate.preview();
      if (preview) return preview;
    }
    return null;
  }

  function cleanupTrimConstraints(item) {
    model.constraints = model.constraints.filter((c) => {
      if (item instanceof Line && constraintReferencesLine(c, item)) return false;
      if (item instanceof Arc && constraintReferencesPrimitive(c, item)) return false;
      if (item instanceof Circle && constraintReferencesPrimitive(c, item)) return false;
      return true;
    });
  }

  function addBoundaryPointConstraint(point, boundary) {
    const source = boundary?.source || {};
    if (source.line) pushModelConstraint(new PointOnLineConstraint(point, source.line));
    else if (source.primitive) pushModelConstraint(new PointOnCircleConstraint(point, source.primitive));
    else if (source.arc) pushModelConstraint(new PointOnCircleConstraint(point, source.arc));
  }

  function addArcBoundaryConstraint(arc, endpoint, boundary) {
    const source = boundary?.source || {};
    if (source.line) pushModelConstraint(new ArcEndpointOnLineConstraint(arc, endpoint, source.line));
    else if (source.primitive) pushModelConstraint(new ArcEndpointOnCircleConstraint(arc, endpoint, source.primitive));
    else if (source.arc) pushModelConstraint(new ArcEndpointOnCircleConstraint(arc, endpoint, source.arc));
  }

  function removeTrimmedItem(item) {
    cleanupTrimConstraints(item);
    if (item instanceof Line) {
      const endpoints = [item.p1, item.p2];
      model.lines = model.lines.filter((line) => line !== item);
      model.points = model.points.filter((point) => !endpoints.includes(point) || point.kind !== "endpoint" || isPointUsedByPrimitive(point) || isReferencePoint(point));
    } else if (item instanceof Circle) {
      const center = item.center;
      model.circles = model.circles.filter((circle) => circle !== item);
      model.points = model.points.filter((point) => point !== center || point.kind !== "endpoint" || isPointUsedByPrimitive(point) || isReferencePoint(point));
    } else if (item instanceof Arc) {
      const center = item.center;
      model.arcs = model.arcs.filter((arc) => arc !== item);
      model.points = model.points.filter((point) => point !== center || point.kind !== "endpoint" || isPointUsedByPrimitive(point) || isReferencePoint(point));
    }
  }

  function executeLineTrim(preview) {
    const line = preview.item;
    if (preview.deleteWhole) {
      removeTrimmedItem(line);
      return;
    }
    const { left, right } = preview.interval;
    cleanupTrimConstraints(line);
    if (left.t <= 1e-6) {
      const p = addPoint(right.point.x, right.point.y, false, "endpoint");
      line.p1 = p;
      addBoundaryPointConstraint(p, right);
    } else if (right.t >= 1 - 1e-6) {
      const p = addPoint(left.point.x, left.point.y, false, "endpoint");
      line.p2 = p;
      addBoundaryPointConstraint(p, left);
    } else {
      const oldP2 = line.p2;
      const pLeft = addPoint(left.point.x, left.point.y, false, "endpoint");
      const pRight = addPoint(right.point.x, right.point.y, false, "endpoint");
      line.p2 = pLeft;
      addLine(pRight, oldP2);
      addBoundaryPointConstraint(pLeft, left);
      addBoundaryPointConstraint(pRight, right);
    }
    enforceMinimumLineLengths([line]);
  }

  function executeArcTrim(preview) {
    const arc = preview.item;
    if (preview.deleteWhole) {
      removeTrimmedItem(arc);
      return;
    }
    const { left, right } = preview.interval;
    cleanupTrimConstraints(arc);
    if (left.t <= 1e-6) {
      arc.startAngle = angleAtArcParam(arc, right.t);
      addArcBoundaryConstraint(arc, "start", right);
    } else if (right.t >= 1 - 1e-6) {
      arc.endAngle = angleAtArcParam(arc, left.t);
      addArcBoundaryConstraint(arc, "end", left);
    } else {
      const oldEnd = arc.endAngle;
      arc.endAngle = angleAtArcParam(arc, left.t);
      const newArc = addArc(arc.center, arc.radius(), angleAtArcParam(arc, right.t), oldEnd);
      addArcBoundaryConstraint(arc, "end", left);
      if (newArc) addArcBoundaryConstraint(newArc, "start", right);
    }
    normalizeArcSweeps();
  }

  function executeCircleTrim(preview) {
    const circle = preview.item;
    if (preview.deleteWhole) {
      removeTrimmedItem(circle);
      return;
    }
    cleanupTrimConstraints(circle);
    const kept = [];
    const boundaries = preview.boundaries || [];
    for (let i = 0; i < boundaries.length; i++) {
      const left = boundaries[i];
      const right = boundaries[(i + 1) % boundaries.length];
      const wraps = left.t > right.t;
      const start = angleAtCircleParam(left.t);
      const end = angleAtCircleParam(right.t) + (wraps ? Math.PI * 2 : 0);
      const sameRemoved = Math.abs(left.t - preview.interval.left.t) <= 1e-6 && Math.abs(right.t - preview.interval.right.t) <= 1e-6;
      if (sameRemoved || (end - start) * circle.radius() < MIN_ARC_LENGTH) continue;
      const arc = addArc(circle.center, circle.radius(), start, end);
      if (arc) {
        addArcBoundaryConstraint(arc, "start", left);
        addArcBoundaryConstraint(arc, "end", right);
        kept.push(arc);
      }
    }
    model.circles = model.circles.filter((item) => item !== circle);
    if (kept.length === 0) model.points = model.points.filter((p) => p !== circle.center || isPointUsedByPrimitive(p));
  }

  function executeTrimAt(pointer) {
    const preview = computeTrimPreview(pointer);
    if (!preview) {
      setHint("トリムできる交点がありません", "error");
      draw();
      return false;
    }
    if (preview.kind === "line") executeLineTrim(preview);
    else if (preview.kind === "arc") executeArcTrim(preview);
    else executeCircleTrim(preview);
    trimPreview = null;
    clearSelection();
    const result = solveAndRefresh("トリム");
    setHint(`トリムしました (error=${result.errorNorm.toExponential(2)})`);
    return true;
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
    [
      new ArcEndpointCoincidentConstraint(arc, "start", t1),
      new ArcEndpointCoincidentConstraint(arc, "end", t2),
      new PointOnLineConstraint(corner, line1),
      new PointOnLineConstraint(corner, line2),
      new LineCircleTangentConstraint(line1, arc),
      new LineCircleTangentConstraint(line2, arc),
      radiusConstraint,
    ].forEach((constraint) => pushModelConstraint(constraint));
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
    const snap = activeSnap;
    pointerPreview = p;
    if (!circleCenterPoint) {
      const center = endpointAt(p.x, p.y);
      addPointSnapConstraints(center, snap);
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
      addCircleBoundarySnapConstraints(circle, snap);
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
    const snap = activeSnap;
    pointerPreview = p;
    if (!arcCenterPoint) {
      const center = endpointAt(p.x, p.y);
      addPointSnapConstraints(center, snap);
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
        snap,
      };
      selectedPoints = [arcCenterPoint];
      setHint("円弧の終点をクリックすると円弧を作成します。Escで選択モードに戻ります");
      updateUI();
      draw();
      return;
    }
    const arc = addArc(arcCenterPoint, arcStartPoint.radius, arcStartPoint.startAngle, shortestAngleFrom(arcStartPoint.startAngle, Math.atan2(p.y - arcCenterPoint.y, p.x - arcCenterPoint.x)));
    if (arc) {
      addArcEndpointSnapConstraints(arc, "start", arcStartPoint.snap);
      addArcEndpointSnapConstraints(arc, "end", snap);
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
    lastPointerWorld = p;
    const hitP = hitPoint(p.x, p.y);
    const hitL = hitLine(p.x, p.y);
    const hitC = hitCircle(p.x, p.y);
    const hitArcEnd = hitArcEndpoint(p.x, p.y);
    const hitA = hitArc(p.x, p.y);
    const hitD = hitDimension(p.x, p.y);
    hoveredSketchIdentity = hitSketchIdentityElement(p.x, p.y);
    const inactiveHit = !hitP && !hitL && !hitC && !hitArcEnd && !hitA && !hitD ? hitInactiveElement(p.x, p.y) : null;

    if (hitD && !e.shiftKey && !e.ctrlKey && !pendingCommand) {
      e.preventDefault();
      selectedPoints = [];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [];
      selectedArcEndpoint = null;
      beginDimensionDrag(e, hitD, p);
      return;
    }

    if (pendingCommand?.type === "distance-place") {
      e.preventDefault();
      const referenceTarget = pendingCommand.target.kind === "line-length" ? hitReferenceTarget(p.x, p.y) : null;
      if (retargetPendingLineLengthToReference(referenceTarget, p)) return;
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
      const activeHitSubject = referenceSubjectFromHit(hitP, hitL, hitC, hitA, hitArcEnd);
      if (pendingConstraintCommand.referenceTarget) {
        if (tryStartReferenceDistanceFromHits(activeHitSubject, pendingConstraintCommand.referenceTarget, p)) return;
        if (activeHitSubject) {
          handleReferenceSubjectAndTarget(activeHitSubject, pendingConstraintCommand.referenceTarget, p, pendingConstraintCommand.type, e.shiftKey);
          return;
        }
      }
      const referenceTarget = hitReferenceTarget(p.x, p.y);
      if (referenceTarget) {
        const subject = activeReferenceSubject();
        if (tryStartReferenceDistanceFromHits(subject, referenceTarget, p)) return;
        if (subject) {
          handleReferenceSubjectAndTarget(subject, referenceTarget, p, pendingConstraintCommand.type, e.shiftKey);
        } else {
          pendingConstraintCommand.referenceTarget = referenceTarget;
          setHint(`${sketchName(referenceTarget.sketchId)} の対象を選択しました。続けてアクティブスケッチ側の対象を選択してください`);
          draw();
        }
        return;
      }
      const hitReferenceLikeTarget = referenceTargetFromHit(hitP, hitL, hitC, hitA);
      const subject = activeReferenceSubject();
      const subjectSketchId = referenceSubjectSketchId(subject);
      if (hitReferenceLikeTarget && subject && isAncestorSketchId(hitReferenceLikeTarget.sketchId, subjectSketchId)) {
        handleReferenceConstraintTargetClick(hitReferenceLikeTarget, p, pendingConstraintCommand.type, e.shiftKey);
        return;
      }
      handleConstraintTargetClick(hitP, hitL, hitC, hitA, hitArcEnd);
      return;
    }

    if (["point", "line", "rectangle", "circle", "arc", "fillet", "trim"].includes(mode) && rejectRootSketchCreation()) {
      e.preventDefault();
      return;
    }

    if (mode === "point") {
      const sp = snapForDrawing(p);
      const snap = activeSnap;
      const np = addPoint(sp.x, sp.y, false);
      addPointSnapConstraints(np, snap);
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

    if (mode === "trim") {
      executeTrimAt(p);
      return;
    }

    if (inactiveHit) {
      setHint(`${inactiveHit.id} / ${sketchName(inactiveHit.sketchId)} は非アクティブスケッチの要素です`);
      draw();
      return;
    }

    const multiSelect = e.shiftKey || e.ctrlKey;

    if (hitD && !multiSelect) {
      selectedPoints = [];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [];
      selectedArcEndpoint = null;
      beginDimensionDrag(e, hitD, p);
    } else if (hitP) {
      selectedDimensionConstraint = null;
      if (multiSelect) togglePointSelection(hitP);
      else beginDrag(e, hitP, null, null, null, null, p);
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
    lastPointerWorld = p;
    if (selectionRectSession) {
      clearSnap();
      hoveredSketchIdentity = null;
      selectionRectSession.current = p;
      draw();
      return;
    }

    if (pendingCommand?.type === "distance-place") {
      clearSnap();
      hoveredSketchIdentity = hitSketchIdentityElement(p.x, p.y);
      pendingCommand.pointer = p;
      pendingCommand.dimension = null;
      updatePendingLineLengthHover(p);
      draw();
      return;
    }

    if (dimensionDragSession) {
      clearSnap();
      const dx = p.x - dimensionDragSession.startPointer.x;
      const dy = p.y - dimensionDragSession.startPointer.y;
      if (dimensionDragSession.part === "label") {
        const anchor =
          dimensionDragSession.target.kind === "radius" || dimensionDragSession.target.kind === "diameter"
            ? p
            : {
                x: dimensionDragSession.startAnchor.x + dx,
                y: dimensionDragSession.startAnchor.y + dy,
              };
        const nextDimension = dimensionWithLabelAt(
          dimensionDragSession.target,
          dimensionFromAnchor(dimensionDragSession.target, anchor, { allowPointAxis: false }),
          p,
        );
        dimensionDragSession.constraint.dimension = nextDimension;
        syncAngleConstraintFromDimension(dimensionDragSession.constraint, dimensionDragSession.target, nextDimension);
        draw();
        return;
      }
      const anchor =
        dimensionDragSession.target.kind === "radius" || dimensionDragSession.target.kind === "diameter"
          ? p
          : {
              x: dimensionDragSession.startAnchor.x + dx,
              y: dimensionDragSession.startAnchor.y + dy,
            };
      const nextDimension = dimensionFromAnchor(dimensionDragSession.target, anchor, { allowPointAxis: false });
      nextDimension.labelOffsetU = dimensionDragSession.startLabelOffsetU;
      dimensionDragSession.constraint.dimension = nextDimension;
      syncAngleConstraintFromDimension(dimensionDragSession.constraint, dimensionDragSession.target, nextDimension);
      draw();
      return;
    }

    if (["point", "line", "rectangle", "circle", "arc", "fillet", "trim"].includes(mode) && !canCreateInActiveSketch()) {
      clearSnap();
      pointerPreview = null;
      trimPreview = null;
      hoveredSketchIdentity = null;
      return;
    }

    if (mode === "line") {
      hoveredSketchIdentity = null;
      const rawPreview = lineStartPoint && e.shiftKey ? orthogonalPointFrom(lineStartPoint, p) : p;
      pointerPreview = snapForDrawing(rawPreview);
      draw();
    }

    if (mode === "rectangle" || mode === "circle" || mode === "arc") {
      hoveredSketchIdentity = null;
      pointerPreview = snapForDrawing(p);
      draw();
    }

    if (mode === "trim") {
      clearSnap();
      const hadHover = Boolean(hoveredPoint || hoveredEndpointPoint || hoveredLine || hoveredCircle || hoveredArcEndpoint || hoveredArc || hoveredDimensionConstraint);
      hoveredPoint = null;
      hoveredEndpointPoint = null;
      hoveredLine = null;
      hoveredCircle = null;
      hoveredArcEndpoint = null;
      hoveredArc = null;
      hoveredDimensionConstraint = null;
      hoveredSketchIdentity = null;
      const nextTrimPreview = computeTrimPreview(p);
      if (nextTrimPreview !== trimPreview || hadHover) {
        trimPreview = nextTrimPreview;
        draw();
      }
      return;
    }

    if (pendingConstraintCommand && !dragSession) {
      const referenceTarget = hitReferenceTarget(p.x, p.y);
      const nextSketchIdentity = hitSketchIdentityElement(p.x, p.y);
      const nextEndpointHover = referenceTarget ? null : hitEndpointPoint(p.x, p.y);
      const nextPointHover = referenceTarget ? (referenceTarget.kind === "point" ? referenceTarget.point : null) : nextEndpointHover || hitExplicitPoint(p.x, p.y);
      const nextLineHover = referenceTarget ? (referenceTarget.kind === "line" ? referenceTarget.line : null) : nextPointHover ? null : hitLine(p.x, p.y);
      const nextCircleHover = referenceTarget
        ? referenceTarget.primitive instanceof Circle
          ? referenceTarget.primitive
          : null
        : nextPointHover || nextLineHover
          ? null
          : hitCircle(p.x, p.y);
      const nextArcEndpointHover = referenceTarget || nextPointHover || nextLineHover || nextCircleHover ? null : hitArcEndpoint(p.x, p.y);
      const nextArcHover = referenceTarget
        ? referenceTarget.primitive instanceof Arc
          ? referenceTarget.primitive
          : null
        : nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover
          ? null
          : hitArc(p.x, p.y);
      if (
        nextPointHover !== hoveredPoint ||
        nextEndpointHover !== hoveredEndpointPoint ||
        nextLineHover !== hoveredLine ||
        nextCircleHover !== hoveredCircle ||
        !sameArcEndpoint(nextArcEndpointHover, hoveredArcEndpoint) ||
        nextArcHover !== hoveredArc ||
        hoveredDimensionConstraint ||
        nextSketchIdentity?.item !== hoveredSketchIdentity?.item ||
        Boolean(nextSketchIdentity)
      ) {
        hoveredPoint = nextPointHover;
        hoveredEndpointPoint = nextEndpointHover;
        hoveredLine = nextLineHover;
        hoveredCircle = nextCircleHover;
        hoveredArcEndpoint = nextArcEndpointHover;
        hoveredArc = nextArcHover;
        hoveredDimensionConstraint = null;
        hoveredSketchIdentity = nextSketchIdentity;
        draw();
      }
      return;
    }

    if (!dragSession) {
      const hitD = hitDimension(p.x, p.y);
      const nextHover = hitD?.constraint || null;
      const nextEndpointHover = nextHover ? null : hitEndpointPoint(p.x, p.y);
      const nextPointHover = nextHover ? null : nextEndpointHover || hitExplicitPoint(p.x, p.y);
      const nextLineHover = nextPointHover ? null : hitLine(p.x, p.y);
      const nextCircleHover = nextPointHover || nextLineHover ? null : hitCircle(p.x, p.y);
      const nextArcEndpointHover = nextPointHover || nextLineHover || nextCircleHover ? null : hitArcEndpoint(p.x, p.y);
      const nextArcHover = nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover ? null : hitArc(p.x, p.y);
      const nextSketchIdentity = hitSketchIdentityElement(p.x, p.y);
      if (
        nextPointHover !== hoveredPoint ||
        nextEndpointHover !== hoveredEndpointPoint ||
        nextLineHover !== hoveredLine ||
        nextCircleHover !== hoveredCircle ||
        !sameArcEndpoint(nextArcEndpointHover, hoveredArcEndpoint) ||
        nextArcHover !== hoveredArc ||
        nextHover !== hoveredDimensionConstraint ||
        nextSketchIdentity?.item !== hoveredSketchIdentity?.item ||
        Boolean(nextSketchIdentity)
      ) {
        hoveredPoint = nextPointHover;
        hoveredEndpointPoint = nextEndpointHover;
        hoveredLine = nextLineHover;
        hoveredCircle = nextCircleHover;
        hoveredArcEndpoint = nextArcEndpointHover;
        hoveredArc = nextArcHover;
        hoveredDimensionConstraint = nextHover;
        hoveredSketchIdentity = nextSketchIdentity;
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
      ? `${result.guided ? "guided local" : "local"} vars=${result.variableCount}, constraints=${result.constraintCount}${Number.isFinite(result.freeDof) ? `, dof=${result.freeDof}` : ""}`
      : "global";
    const fallback = result.fallback ? ` fallback from local error=${result.localErrorNorm?.toExponential(2)}` : "";
    const descendantResult = solveDescendantSketches(dragSession.sketchId || activeSketchId());
    const childText = descendantResult.results.length > 0 ? `, child=${descendantResult.results.length}` : "";
    const childErrorText = descendantErrorSummary(descendantResult);
    setHint(`${dragLabel(dragSession)}中: ${scope}, error=${error.toExponential(2)}, iter=${result.iterations}${fallback}${childText}${childErrorText}`, descendantResult.success ? "normal" : "error");
    if (!descendantResult.success) updateUI();
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
    const result = solveDragSketch(session);
    normalizeArcSweeps();
    if (!result.success || result.errorNorm > CONSTRAINT_ACCEPT_ERROR) {
      if (session.fullDragState) solver.restore(session.fullDragState);
      clearSketchSolveState(session.sketchId || activeSketchId());
      setHint(`${completedLabel}完了時の全体solveに失敗しました (error=${result.errorNorm.toExponential(3)})`, "error");
      updateUI();
      draw();
      return;
    }
    const descendantResult = solveDescendantSketches(session.sketchId || activeSketchId());
    const analysis = refreshConstraintAnalysis();
    const childErrorText = descendantErrorSummary(descendantResult);
    setHint(`${completedLabel}完了: success=${result.success}, error=${result.errorNorm.toExponential(2)}, iter=${result.iterations}${childErrorText} / ${constraintSummaryText()}`, analysis.analysis.stable && descendantResult.success ? "normal" : "error");
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
    if (pendingCommand?.type?.startsWith("distance")) {
      e.preventDefault();
      if (pendingCommand.type === "distance-place") {
        startDistanceValueInput(p);
      }
      submitDistanceValue();
      return;
    }
    if (handleConstraintTargetDoubleClick(hitP, hitL, p)) {
      e.preventDefault();
      return;
    }
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
      setHint(`表示倍率: ${formatZoom(viewport.scale)}`);
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
      if (mode === "line" || mode === "point" || mode === "rectangle" || mode === "fillet" || mode === "trim" || mode === "circle" || mode === "arc") {
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
    constructionLineMode = false;
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
    constructionLineMode = false;
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
    constructionLineMode = false;
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

  document.getElementById("toolConstructionLine")?.addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    if (selectedLines.length > 0 && selectedPoints.length === 0 && selectedCircles.length === 0 && selectedArcs.length === 0 && !selectedArcEndpoint) {
      const next = !selectedLines.every((line) => line.construction);
      for (const line of selectedLines) line.construction = next;
      setHint(next ? "選択線を補助線にしました" : "選択線を通常線にしました");
      updateUI();
      draw();
      return;
    }
    mode = "line";
    constructionLineMode = !constructionLineMode;
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint(constructionLineMode ? "補助線作図: 端点位置をクリックしてください" : "通常線作図に戻しました");
    draw();
  });

  document.getElementById("toolRectangle")?.addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "rectangle";
    constructionLineMode = false;
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
    constructionLineMode = false;
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

  document.getElementById("toolTrim")?.addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "trim";
    constructionLineMode = false;
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    trimPreview = null;
    hoveredPoint = null;
    hoveredEndpointPoint = null;
    hoveredLine = null;
    hoveredCircle = null;
    hoveredArcEndpoint = null;
    hoveredArc = null;
    hoveredDimensionConstraint = null;
    clearSnap();
    updateToolbar();
    setHint("トリムする線、円、円弧の削除したい区間をクリックしてください。Escで選択モードに戻ります");
    draw();
  });

  document.getElementById("toolCircle").addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "circle";
    constructionLineMode = false;
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
    constructionLineMode = false;
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
  document.getElementById("addSketchBtn")?.addEventListener("click", () => createSketch("sibling"));
  document.getElementById("addChildSketchBtn")?.addEventListener("click", () => createSketch("child"));
  document.getElementById("toggleSketchTreeBtn")?.addEventListener("click", () => {
    sketchTreeCollapsed = !sketchTreeCollapsed;
    updateSketchUI();
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
          updateToolbar();
          updateConstraintButtons();
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
    if (selectedPoints.length < 1 || selectedLines.length > 0 || selectedCircles.length > 0 || selectedArcs.length > 0) return;
    const points = [...selectedPoints];
    const sketchId = elementSketchId(points[0]);
    if (!points.every((point) => elementSketchId(point) === sketchId)) return;
    const snapshot = snapshotModelState();
    const nextFixed = !points.every((point) => point.fixed);
    for (const point of points) point.fixed = nextFixed;
    const solved = solveSketchAndDescendants(sketchId, snapshot);
    const fixedResult = solved.result;
    if (!solved.success || fixedResult.errorNorm > CONSTRAINT_ACCEPT_ERROR) {
      restoreModelState(snapshot);
      setHint(`子スケッチ内で固定状態を変更できません (error=${fixedResult.errorNorm.toExponential(3)})`, "error");
      updateUI();
      draw();
      return;
    }
    refreshConstraintAnalysis();
    setHint(`固定状態変更: success=${fixedResult.success}, error=${fixedResult.errorNorm.toExponential(2)}, iter=${fixedResult.iterations}`);
    updateUI();
    draw();
    log(`${points.map((point) => point.id).join(", ")} の固定状態を ${nextFixed} にしました\n自動solve: success=${fixedResult.success}`);
    return;
  });

  window.addEventListener("resize", () => {
    resizeCanvas({ centerWorld: currentCanvasCenterWorld() });
  });
  sampleModel();
  resizeCanvas();
})();
