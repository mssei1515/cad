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
    OffsetConstraint,
    LineAngleConstraint,
    signedPointLineDistance,
    signedPointDirectedLineDistance,
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
  const DEFAULT_PRESENTATION_SHEET_ID = "PS1";
  const DEFAULT_PRESENTATION_SHEET_NAME = "Sheet-1";
  const model = {
    appMode: "geometry",
    sketches: [
      { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", visible: true },
      { id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true },
    ],
    activeSketchId: DEFAULT_SKETCH_ID,
    presentationSheets: [{ id: DEFAULT_PRESENTATION_SHEET_ID, name: DEFAULT_PRESENTATION_SHEET_NAME, visibleGeometrySketchIds: null, elementStyles: {}, elements: [] }],
    activePresentationSheetId: DEFAULT_PRESENTATION_SHEET_ID,
    points: [],
    lines: [],
    circles: [],
    arcs: [],
    constraints: [],
    blockDefinitions: [],
    blockInstances: [],
  };
  const solver = new ConstraintSolver(model);

  let mode = "select";
  let selectedPoints = [];
  let selectedLines = [];
  let selectedCircles = [];
  let selectedArcs = [];
  let selectedBlockInstances = [];
  let dragSession = null;
  let dimensionDragSession = null;
  let presentationDragSession = null;
  let hoveredPoint = null;
  let hoveredEndpointPoint = null;
  let hoveredLine = null;
  let hoveredCircle = null;
  let hoveredArc = null;
  let hoveredBlockInstance = null;
  let hoveredArcEndpoint = null;
  let hoveredDimensionConstraint = null;
  let selectedArcEndpoint = null;
  let selectedArcEndpointPair = null;
  let selectedDimensionConstraint = null;
  let selectedConstraint = null;
  let hoveredSidebarItem = null;
  let constraintAnalysisState = null;
  let constraintRedundancyState = { constraints: new Map(), sketches: new Map(), count: 0 };
  let sketchSolveStates = new Map();
  let invalidReferenceConstraints = new Map();
  let panSession = null;
  let selectionRectSession = null;
  let blankDoubleClickCandidate = null;
  let suppressNextBlankDoubleClickEvent = false;
  let lineStartPoint = null;
  let pointStartRollback = null;
  let rectangleStartPoint = null;
  let lineStartRollback = null;
  let lineCompletionRollback = null;
  let filletFirstLine = null;
  let circleCenterPoint = null;
  let arcCenterPoint = null;
  let arcStartPoint = null;
  let pointerPreview = null;
  let activeSnap = null;
  let trimPreview = null;
  let offsetSource = null;
  let pendingCommand = null;
  let pendingConstraintCommand = null;
  let constraintOperands = [];
  let lastPointerWorld = null;
  let hoveredSketchIdentity = null;
  let hoveredSketchTreeId = null;
  let constructionLineMode = false;
  let pointSeq = 1;
  let lineSeq = 1;
  let circleSeq = 1;
  let arcSeq = 1;
  let sketchSeq = 2;
  let presentationSheetSeq = 2;
  let presentationElementSeq = 1;
  let blockDefinitionSeq = 1;
  let blockInstanceSeq = 1;
  let blockElementSeq = 1;
  let lastMiddleAuxClick = null;
  let blockPlacementDefinitionId = null;
  let blockPlacementAnchor = null;
  let blockPlacementEnabledSketchIds = [];
  let blockEditSession = null;
  let blockProjectionCache = new Map();
  let sketchTreeCollapsed = false;
  let undoStack = [];
  let redoStack = [];
  let historyRestoring = false;
  const HISTORY_LIMIT = 80;
  const viewport = { x: 0, y: 0, scale: 1 };
  const MIN_ZOOM = 0.001;
  const MAX_ZOOM = 10000000;
  const GRID_SCREEN_STEP_PX = 32;
  const CONSTRUCTION_EXTENSION_SCREEN_PX = 12;
  const DIMENSION_EXTENSION_GAP_SCREEN_PX = 6;
  const DIMENSION_EXTENSION_SCREEN_PX = 6;
  const DIMENSION_POINT_MARKER_RADIUS_SCREEN_PX = 5;
  const DIMENSION_ARROW_LENGTH_SCREEN_PX = 10;
  const DIMENSION_ARROW_HALF_WIDTH_SCREEN_PX = 2.4;
  const DIMENSION_DISPLAY_PRECISION = 1e-6;
  const MEASURED_DIMENSION_SNAP_TOLERANCE = 1e-5;
  const CONSTRAINT_ACCEPT_ERROR = 1e-4;
  const DEFAULT_FILLET_RADIUS = 30;
  const MIN_LINE_LENGTH = Math.max(MIN_ORIENTATION_LENGTH, solver.minLineLength || 12);
  const MIN_ARC_LENGTH = MIN_LINE_LENGTH;
  const CONSTRAINT_STATUS_COLORS = {
    full: "#111827",
    support: "#0f766e",
    under: "#f59e0b",
    conflict: "#dc2626",
  };
  const DEFAULT_PRESENTATION_STYLE = {
    visible: true,
    color: "#111827",
    lineType: "solid",
    lineWidthPx: 2.2,
    opacity: 1,
  };
  const DEFAULT_PRESENTATION_CONSTRUCTION_STYLE = {
    visible: true,
    color: "#64748b",
    lineType: "dashdot",
    lineWidthPx: 1.8,
    opacity: 1,
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
    if (!el) return;
    el.textContent = `${msg}\n` + el.textContent;
  }

  function activateSidebarTab(tabId) {
    for (const button of document.querySelectorAll("[data-sidebar-tab]")) {
      const active = button.dataset.sidebarTab === tabId;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    }
    for (const panel of document.querySelectorAll("[data-sidebar-panel]")) {
      const active = panel.dataset.sidebarPanel === tabId;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    }
  }

  function setSidebarCollapsed(collapsed, hintText = "") {
    const app = document.querySelector(".app");
    if (!app) return false;
    const changed = app.classList.contains("side-collapsed") !== collapsed;
    app.classList.toggle("side-collapsed", collapsed);
    const btn = document.getElementById("toggleSideBtn");
    const label = collapsed ? "サイドバーを開く" : "サイドバーをたたむ";
    btn?.setAttribute("aria-label", label);
    btn?.setAttribute("title", label);
    if (btn) btn.dataset.tooltip = label;
    if (hintText) setHint(hintText);
    return changed;
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
      root = { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", visible: true };
      model.sketches.unshift(root);
    }
    model.sketches = [root, ...model.sketches.filter((sketch) => sketch !== root && sketch.kind !== "root" && sketch.id !== ROOT_SKETCH_ID)];
    root.id = ROOT_SKETCH_ID;
    root.name = root.name || ROOT_SKETCH_NAME;
    root.parentSketchId = null;
    root.kind = "root";
    root.visible = true;
    const ids = new Set(model.sketches.map((sketch) => sketch.id));
    for (const sketch of model.sketches) {
      if (sketch === root) continue;
      sketch.kind = "sketch";
      sketch.visible = sketch.visible !== false;
      if (!Object.prototype.hasOwnProperty.call(sketch, "parentSketchId")) sketch.parentSketchId = null;
      if (sketch.parentSketchId === sketch.id || !ids.has(sketch.parentSketchId)) sketch.parentSketchId = ROOT_SKETCH_ID;
      if (sketch.parentSketchId == null) sketch.parentSketchId = ROOT_SKETCH_ID;
    }
    if (!model.activeSketchId || !model.sketches.some((sketch) => sketch.id === model.activeSketchId)) {
      model.activeSketchId = ROOT_SKETCH_ID;
    }
  }

  function ensurePresentationState() {
    model.appMode = model.appMode === "presentation" ? "presentation" : "geometry";
    if (!Array.isArray(model.presentationSheets)) model.presentationSheets = [];
    if (model.presentationSheets.length === 0) {
      model.presentationSheets.push({ id: DEFAULT_PRESENTATION_SHEET_ID, name: DEFAULT_PRESENTATION_SHEET_NAME, visibleGeometrySketchIds: null, elementStyles: {}, elements: [] });
    }
    const seen = new Set();
    model.presentationSheets = model.presentationSheets.map((sheet, index) => {
      let id = String(sheet.id || `PS${index + 1}`);
      while (seen.has(id)) id = `PS${index + 1}-${seen.size + 1}`;
      seen.add(id);
      return {
        id,
        name: String(sheet.name || `Sheet-${index + 1}`),
        visibleGeometrySketchIds: Array.isArray(sheet.visibleGeometrySketchIds) ? sheet.visibleGeometrySketchIds.map(String) : null,
        elementStyles: normalizePresentationElementStyles(sheet.elementStyles),
        elements: normalizePresentationElements(sheet.elements),
      };
    });
    if (!model.activePresentationSheetId || !model.presentationSheets.some((sheet) => sheet.id === model.activePresentationSheetId)) {
      model.activePresentationSheetId = model.presentationSheets[0].id;
    }
  }

  function ensureBlockState() {
    if (!Array.isArray(model.blockDefinitions)) model.blockDefinitions = [];
    if (!Array.isArray(model.blockInstances)) model.blockInstances = [];
    const definitionIds = new Set();
    model.blockDefinitions = model.blockDefinitions.filter(Boolean).map((definition, index) => {
      let id = String(definition.id || `B${index + 1}`);
      while (definitionIds.has(id)) id = `B${index + 1}-${definitionIds.size + 1}`;
      definitionIds.add(id);
      definition.id = id;
      definition.name = String(definition.name || `Block-${index + 1}`);
      definition.origin = {
        x: Number(definition.origin?.x) || 0,
        y: Number(definition.origin?.y) || 0,
      };
      if (!Array.isArray(definition.sketches) || definition.sketches.length === 0) {
        definition.sketches = [
          { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", visible: true },
          { id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true },
        ];
      }
      let root = definition.sketches.find((sketch) => sketch?.kind === "root" || sketch?.id === ROOT_SKETCH_ID);
      if (!root) {
        root = { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", visible: true };
        definition.sketches.unshift(root);
      }
      root.id = ROOT_SKETCH_ID;
      root.name = ROOT_SKETCH_NAME;
      root.parentSketchId = null;
      root.kind = "root";
      root.visible = true;
      definition.sketches = [root, ...definition.sketches.filter((sketch) => sketch && sketch !== root && sketch.id !== ROOT_SKETCH_ID && sketch.kind !== "root")];
      if (!definition.sketches.some((sketch) => sketch.kind !== "root")) {
        definition.sketches.push({ id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
      }
      const sketchIds = new Set(definition.sketches.map((sketch) => String(sketch.id)));
      for (const sketch of definition.sketches) {
        sketch.id = String(sketch.id);
        if (sketch === root) continue;
        sketch.kind = "sketch";
        sketch.name = String(sketch.name || sketch.id);
        sketch.visible = sketch.visible !== false;
        sketch.parentSketchId = sketch.parentSketchId == null ? ROOT_SKETCH_ID : String(sketch.parentSketchId);
        if (sketch.parentSketchId === sketch.id || !sketchIds.has(sketch.parentSketchId)) sketch.parentSketchId = ROOT_SKETCH_ID;
      }
      const fallbackSketchId = definition.sketches.find((sketch) => sketch.kind !== "root")?.id || DEFAULT_SKETCH_ID;
      definition.activeSketchId = sketchIds.has(String(definition.activeSketchId)) ? String(definition.activeSketchId) : fallbackSketchId;
      definition.points = Array.isArray(definition.points) ? definition.points : [];
      definition.lines = Array.isArray(definition.lines) ? definition.lines : [];
      definition.circles = Array.isArray(definition.circles) ? definition.circles : [];
      definition.arcs = Array.isArray(definition.arcs) ? definition.arcs : [];
      definition.constraints = Array.isArray(definition.constraints) ? definition.constraints : [];
      for (const item of [...definition.points, ...definition.lines, ...definition.circles, ...definition.arcs, ...definition.constraints]) {
        if (!sketchIds.has(String(item.sketchId)) || item.sketchId === ROOT_SKETCH_ID) item.sketchId = fallbackSketchId;
        else item.sketchId = String(item.sketchId);
      }
      definition.revision = Number(definition.revision) || 0;
      return definition;
    });
    const instanceIds = new Set();
    model.blockInstances = model.blockInstances.filter((instance) => instance && definitionIds.has(String(instance.definitionId))).map((instance, index) => {
      let id = String(instance.id || `BI${index + 1}`);
      while (instanceIds.has(id)) id = `BI${index + 1}-${instanceIds.size + 1}`;
      instanceIds.add(id);
      instance.id = id;
      instance.definitionId = String(instance.definitionId);
      instance.sketchId = isDrawableSketch(instance.sketchId) ? String(instance.sketchId) : firstDrawableSketchId();
      instance.x = Number(instance.x) || 0;
      instance.y = Number(instance.y) || 0;
      instance.rotation = Number(instance.rotation) || 0;
      instance.fixed = Boolean(instance.fixed);
      const definition = model.blockDefinitions.find((item) => item.id === instance.definitionId);
      const drawableIds = blockDefinitionDrawableSketchIds(definition);
      const requested = Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.map(String) : drawableIds;
      instance.enabledSketchIds = [...new Set(requested.filter((id) => drawableIds.includes(id)))];
      if (instance.enabledSketchIds.length === 0) instance.enabledSketchIds = blockDefinitionGeometrySketchIds(definition);
      return instance;
    });
  }

  function ensureModelState() {
    ensureSketchState();
    ensurePresentationState();
    ensureBlockState();
  }

  function isGeometryMode() {
    return model.appMode !== "presentation";
  }

  function isPresentationMode() {
    return model.appMode === "presentation";
  }

  function activePresentationSheet() {
    ensurePresentationState();
    return model.presentationSheets.find((sheet) => sheet.id === model.activePresentationSheetId) || model.presentationSheets[0];
  }

  function nextPresentationElementId() {
    return `PE${presentationElementSeq++}`;
  }

  function pushPresentationElement(element) {
    const sheet = activePresentationSheet();
    if (!sheet) return null;
    if (!Array.isArray(sheet.elements)) sheet.elements = [];
    const item = {
      id: nextPresentationElementId(),
      visible: true,
      geometryRefs: {},
      style: {},
      ...element,
    };
    sheet.elements.push(item);
    updateUI();
    draw();
    return item;
  }

  function normalizePresentationElementStyles(styles) {
    const result = {};
    if (!styles || typeof styles !== "object" || Array.isArray(styles)) return result;
    for (const [key, value] of Object.entries(styles)) {
      if (!value || typeof value !== "object") continue;
      const normalized = {};
      if (Object.prototype.hasOwnProperty.call(value, "visible")) normalized.visible = value.visible !== false;
      if (typeof value.color === "string" && /^#[0-9a-fA-F]{6}$/.test(value.color)) normalized.color = value.color;
      if (["solid", "dashed", "dashdot", "dotted"].includes(value.lineType)) normalized.lineType = value.lineType;
      const lineWidthPx = Number(value.lineWidthPx);
      if (Number.isFinite(lineWidthPx)) normalized.lineWidthPx = Math.max(0.5, Math.min(10, lineWidthPx));
      const opacity = Number(value.opacity);
      if (Number.isFinite(opacity)) normalized.opacity = Math.max(0.05, Math.min(1, opacity));
      result[key] = normalized;
    }
    return result;
  }

  function normalizePresentationElements(elements) {
    if (!Array.isArray(elements)) return [];
    return elements
      .map((element, index) => {
        if (!element || typeof element !== "object") return null;
        const type = String(element.type || "");
        if (!["annotationDimension", "leader"].includes(type)) return null;
        return {
          id: String(element.id || `PE${index + 1}`),
          type,
          visible: element.visible !== false,
          geometryRefs: element.geometryRefs && typeof element.geometryRefs === "object" ? { ...element.geometryRefs } : {},
          target: element.target && typeof element.target === "object" ? { ...element.target } : null,
          dimension: element.dimension && typeof element.dimension === "object" ? { ...element.dimension } : null,
          text: String(element.text || ""),
          x: Number.isFinite(Number(element.x)) ? Number(element.x) : 0,
          y: Number.isFinite(Number(element.y)) ? Number(element.y) : 0,
          start: element.start && Number.isFinite(Number(element.start.x)) && Number.isFinite(Number(element.start.y)) ? { x: Number(element.start.x), y: Number(element.start.y) } : null,
          elbow: element.elbow && Number.isFinite(Number(element.elbow.x)) && Number.isFinite(Number(element.elbow.y)) ? { x: Number(element.elbow.x), y: Number(element.elbow.y) } : null,
          end: element.end && Number.isFinite(Number(element.end.x)) && Number.isFinite(Number(element.end.y)) ? { x: Number(element.end.x), y: Number(element.end.y) } : null,
          style: element.style && typeof element.style === "object" ? { ...element.style } : {},
        };
      })
      .filter(Boolean);
  }

  function serializePresentationElement(element) {
    const data = {
      id: element.id,
      type: element.type,
      visible: element.visible !== false,
      geometryRefs: element.geometryRefs && typeof element.geometryRefs === "object" ? { ...element.geometryRefs } : {},
      style: element.style && typeof element.style === "object" ? { ...element.style } : {},
    };
    if (element.type === "annotationDimension") {
      data.target = element.target;
      data.dimension = element.dimension;
    } else if (element.type === "leader") {
      data.text = element.text || "";
      data.start = element.start;
      data.elbow = element.elbow;
      data.end = element.end;
      data.x = element.x;
      data.y = element.y;
    }
    return data;
  }

  function presentationElementKey(item) {
    if (item instanceof Line) return `line:${item.id}`;
    if (item instanceof Circle) return `circle:${item.id}`;
    if (item instanceof Arc) return `arc:${item.id}`;
    if (item instanceof Point) return `point:${item.id}`;
    return "";
  }

  function presentationElementFromKey(key) {
    if (typeof key !== "string") return null;
    const [kind, id] = key.split(":");
    if (!kind || !id) return null;
    if (kind === "point") return allGeometryPoints().find((item) => item.id === id) || null;
    if (kind === "line") return allGeometryLines().find((item) => item.id === id) || null;
    if (kind === "circle") return allGeometryCircles().find((item) => item.id === id) || null;
    if (kind === "arc") return allGeometryArcs().find((item) => item.id === id) || null;
    return null;
  }

  function blockDefinitionById(id) {
    return model.blockDefinitions.find((definition) => definition.id === id) || null;
  }

  function blockDefinitionDrawableSketchIds(definition) {
    return (definition?.sketches || []).filter((sketch) => sketch && sketch.kind !== "root" && sketch.id !== ROOT_SKETCH_ID).map((sketch) => String(sketch.id));
  }

  function blockDefinitionGeometrySketchIds(definition) {
    if (!definition) return [];
    const ids = new Set([...definition.lines, ...definition.circles, ...definition.arcs].map((item) => String(item.sketchId || DEFAULT_SKETCH_ID)));
    return blockDefinitionDrawableSketchIds(definition).filter((id) => ids.has(id));
  }

  function blockInstanceEnabledSketchSet(instance, definition = blockDefinitionById(instance?.definitionId)) {
    const drawableIds = blockDefinitionDrawableSketchIds(definition);
    const requested = Array.isArray(instance?.enabledSketchIds) ? instance.enabledSketchIds.map(String) : drawableIds;
    const enabled = requested.filter((id) => drawableIds.includes(id));
    return new Set(enabled.length > 0 ? enabled : blockDefinitionGeometrySketchIds(definition));
  }

  function blockLocalGeometryBounds(definition, enabledSketchIds = blockDefinitionDrawableSketchIds(definition)) {
    if (!definition) return null;
    const enabled = new Set(enabledSketchIds);
    const points = [];
    for (const line of definition.lines || []) {
      if (!enabled.has(String(line.sketchId))) continue;
      points.push(line.p1, line.p2);
    }
    for (const circle of definition.circles || []) {
      if (!enabled.has(String(circle.sketchId))) continue;
      points.push({ x: circle.center.x - circle.radius(), y: circle.center.y - circle.radius() }, { x: circle.center.x + circle.radius(), y: circle.center.y + circle.radius() });
    }
    for (const arc of definition.arcs || []) {
      if (!enabled.has(String(arc.sketchId))) continue;
      const samples = [arc.startAngle, arc.endAngle, 0, Math.PI / 2, Math.PI, Math.PI * 1.5];
      for (const angle of samples) {
        if (angle === arc.startAngle || angle === arc.endAngle || angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) {
          points.push({ x: arc.center.x + Math.cos(angle) * arc.radius(), y: arc.center.y + Math.sin(angle) * arc.radius() });
        }
      }
    }
    if (points.length === 0) return null;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { minX, minY, maxX, maxY, center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 } };
  }

  function blockInstanceDisplayCenter(instance) {
    const definition = blockDefinitionById(instance?.definitionId);
    const bounds = blockLocalGeometryBounds(definition, [...blockInstanceEnabledSketchSet(instance, definition)]);
    const center = bounds?.center || definition?.origin || { x: 0, y: 0 };
    return blockWorldPoint(instance, center);
  }

  function blockInstanceTranslationForAnchor(definition, enabledSketchIds, anchor, rotation) {
    const localCenter = blockLocalGeometryBounds(definition, enabledSketchIds)?.center || definition?.origin || { x: 0, y: 0 };
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return {
      x: anchor.x - localCenter.x * cos + localCenter.y * sin,
      y: anchor.y - localCenter.x * sin - localCenter.y * cos,
      localCenter,
    };
  }

  function blockInstanceById(id) {
    return model.blockInstances.find((instance) => instance.id === id) || null;
  }

  function blockProjectionId(instance, localElement) {
    return `${instance.id}@${localElement.id}`;
  }

  function blockWorldPoint(instance, localPoint) {
    const cos = Math.cos(instance.rotation);
    const sin = Math.sin(instance.rotation);
    return {
      x: instance.x + localPoint.x * cos - localPoint.y * sin,
      y: instance.y + localPoint.x * sin + localPoint.y * cos,
    };
  }

  function createProjectedPoint(instance, definition, localPoint) {
    const point = new Point(blockProjectionId(instance, localPoint), 0, 0, false, localPoint.kind || "endpoint");
    Object.defineProperties(point, {
      x: { configurable: true, enumerable: true, get: () => blockWorldPoint(instance, localPoint).x },
      y: { configurable: true, enumerable: true, get: () => blockWorldPoint(instance, localPoint).y },
    });
    point.sketchId = instance.sketchId;
    point.blockProjection = true;
    point.blockInstance = instance;
    point.blockDefinition = definition;
    point.localElement = localPoint;
    return point;
  }

  function createBlockProjectionBundle(instance, definition, enabledSketchIdsOverride = null) {
    if (!definition) return { points: [], lines: [], circles: [], arcs: [], pointByLocalId: new Map() };
    const enabledSketchIds = enabledSketchIdsOverride
      ? new Set(enabledSketchIdsOverride.map(String))
      : blockInstanceEnabledSketchSet(instance, definition);
    const pointByLocalId = new Map();
    const allPoints = definition.points.map((localPoint) => {
      const point = createProjectedPoint(instance, definition, localPoint);
      pointByLocalId.set(localPoint.id, point);
      return point;
    });
    const mark = (item, localElement) => {
      item.sketchId = instance.sketchId;
      item.blockProjection = true;
      item.blockInstance = instance;
      item.blockDefinition = definition;
      item.localElement = localElement;
      return item;
    };
    const lines = definition.lines.filter((localLine) => enabledSketchIds.has(String(localLine.sketchId))).map((localLine) => mark(new Line(blockProjectionId(instance, localLine), pointByLocalId.get(localLine.p1.id), pointByLocalId.get(localLine.p2.id), localLine.construction), localLine));
    const circles = definition.circles.filter((localCircle) => enabledSketchIds.has(String(localCircle.sketchId))).map((localCircle) => {
      const circle = mark(new Circle(blockProjectionId(instance, localCircle), pointByLocalId.get(localCircle.center.id), localCircle.radius(), localCircle.construction), localCircle);
      Object.defineProperty(circle, "radiusValue", { configurable: true, enumerable: true, get: () => localCircle.radius() });
      return circle;
    });
    const arcs = definition.arcs.filter((localArc) => enabledSketchIds.has(String(localArc.sketchId))).map((localArc) => {
      const arc = mark(new Arc(blockProjectionId(instance, localArc), pointByLocalId.get(localArc.center.id), localArc.radius(), localArc.startAngle, localArc.endAngle, localArc.construction), localArc);
      Object.defineProperties(arc, {
        radiusValue: { configurable: true, enumerable: true, get: () => localArc.radius() },
        startAngle: { configurable: true, enumerable: true, get: () => localArc.startAngle + instance.rotation },
        endAngle: { configurable: true, enumerable: true, get: () => localArc.endAngle + instance.rotation },
      });
      return arc;
    });
    const visiblePointIds = new Set();
    for (const line of lines) visiblePointIds.add(line.p1.id).add(line.p2.id);
    for (const primitive of [...circles, ...arcs]) visiblePointIds.add(primitive.center.id);
    for (const localPoint of definition.points) if (enabledSketchIds.has(String(localPoint.sketchId)) && localPoint.kind === "explicit") visiblePointIds.add(blockProjectionId(instance, localPoint));
    const points = allPoints.filter((point) => visiblePointIds.has(point.id));
    return { definition, revision: definition.revision, sketchId: instance.sketchId, enabledSketchKey: [...enabledSketchIds].sort().join("|"), instance, points, lines, circles, arcs, pointByLocalId };
  }

  function blockAllProjectionBundle(instance) {
    const definition = blockDefinitionById(instance?.definitionId);
    if (!definition) return { points: [], lines: [], circles: [], arcs: [], pointByLocalId: new Map() };
    return createBlockProjectionBundle(instance, definition, blockDefinitionDrawableSketchIds(definition));
  }

  function blockProjectionBundle(instance) {
    const definition = blockDefinitionById(instance.definitionId);
    if (!definition) return { points: [], lines: [], circles: [], arcs: [], pointByLocalId: new Map() };
    const cached = blockProjectionCache.get(instance.id);
    const enabledSketchKey = [...blockInstanceEnabledSketchSet(instance, definition)].sort().join("|");
    if (cached && cached.definition === definition && cached.revision === definition.revision && cached.sketchId === instance.sketchId && cached.enabledSketchKey === enabledSketchKey) return cached;
    const bundle = createBlockProjectionBundle(instance, definition);
    blockProjectionCache.set(instance.id, bundle);
    return bundle;
  }

  function invalidateBlockProjectionCache(instanceId = null) {
    if (instanceId) blockProjectionCache.delete(instanceId);
    else blockProjectionCache.clear();
  }

  function blockProjectionBundles() {
    ensureBlockState();
    return model.blockInstances.map(blockProjectionBundle);
  }

  function allGeometryPoints() {
    return [...model.points, ...blockProjectionBundles().flatMap((bundle) => bundle.points)];
  }

  function allGeometryLines() {
    return [...model.lines, ...blockProjectionBundles().flatMap((bundle) => bundle.lines)];
  }

  function allGeometryCircles() {
    return [...model.circles, ...blockProjectionBundles().flatMap((bundle) => bundle.circles)];
  }

  function allGeometryArcs() {
    return [...model.arcs, ...blockProjectionBundles().flatMap((bundle) => bundle.arcs)];
  }

  function allGeometryPrimitives() {
    return [...allGeometryCircles(), ...allGeometryArcs()];
  }

  function decorateSerializedConstraint(data, constraint) {
    if (!data || !constraint) return data;
    if (constraint.readOnlyDimension) data.readOnlyDimension = true;
    return data;
  }

  function presentationBaseStyle(item) {
    const construction = (item instanceof Line || item instanceof Circle || item instanceof Arc) && item.construction;
    return construction ? DEFAULT_PRESENTATION_CONSTRUCTION_STYLE : DEFAULT_PRESENTATION_STYLE;
  }

  function presentationStyleForElement(item) {
    const key = presentationElementKey(item);
    const sheet = activePresentationSheet();
    const override = key ? sheet?.elementStyles?.[key] || {} : {};
    return { ...presentationBaseStyle(item), ...override };
  }

  function presentationLineDash(lineType) {
    if (lineType === "dashed") return [10 / viewport.scale, 6 / viewport.scale];
    if (lineType === "dashdot") return [12 / viewport.scale, 4 / viewport.scale, 2 / viewport.scale, 4 / viewport.scale];
    if (lineType === "dotted") return [2 / viewport.scale, 5 / viewport.scale];
    return [];
  }

  function presentationSelectedItems() {
    return [...selectedPoints, ...selectedLines, ...selectedCircles, ...selectedArcs];
  }

  function selectedPresentationStyle() {
    const items = presentationSelectedItems();
    if (items.length === 0) return { ...DEFAULT_PRESENTATION_STYLE };
    const first = presentationStyleForElement(items[0]);
    const mixed = { ...first };
    for (const item of items.slice(1)) {
      const style = presentationStyleForElement(item);
      for (const key of ["visible", "color", "lineType", "lineWidthPx", "opacity"]) {
        if (mixed[key] !== style[key]) mixed[key] = "";
      }
    }
    return mixed;
  }

  function setPresentationStyleForSelection(patch) {
    const sheet = activePresentationSheet();
    const items = presentationSelectedItems();
    if (!sheet || items.length === 0) return;
    if (!sheet.elementStyles || typeof sheet.elementStyles !== "object") sheet.elementStyles = {};
    for (const item of items) {
      const key = presentationElementKey(item);
      if (!key) continue;
      const current = sheet.elementStyles[key] || {};
      sheet.elementStyles[key] = { ...current, ...patch };
    }
    updatePresentationUI();
    draw();
    recordHistory("Presentation style");
  }

  function setPresentationSelection(hit, additive = false) {
    if (!additive) {
      selectedPoints = [];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [];
      selectedArcEndpoint = null;
      selectedArcEndpointPair = null;
      selectedDimensionConstraint = null;
    }
    if (!hit?.item) return;
    if (hit.kind === "point") {
      if (additive && selectedPoints.includes(hit.item)) selectedPoints = selectedPoints.filter((item) => item !== hit.item);
      else if (!selectedPoints.includes(hit.item)) selectedPoints.push(hit.item);
    } else if (hit.kind === "line") {
      if (additive && selectedLines.includes(hit.item)) selectedLines = selectedLines.filter((item) => item !== hit.item);
      else if (!selectedLines.includes(hit.item)) selectedLines.push(hit.item);
    } else if (hit.kind === "circle") {
      if (additive && selectedCircles.includes(hit.item)) selectedCircles = selectedCircles.filter((item) => item !== hit.item);
      else if (!selectedCircles.includes(hit.item)) selectedCircles.push(hit.item);
    } else if (hit.kind === "arc") {
      if (additive && selectedArcs.includes(hit.item)) selectedArcs = selectedArcs.filter((item) => item !== hit.item);
      else if (!selectedArcs.includes(hit.item)) selectedArcs.push(hit.item);
    }
  }

  function presentationTargetFromSelection() {
    return presentationTargetFromOperands(presentationOperandsFromSelection());
  }

  function presentationOperandFromHit(hit) {
    if (!hit?.item) return null;
    if (hit.kind === "point") return { kind: "point", item: hit.item };
    if (hit.kind === "line") return { kind: "line", item: hit.item };
    if (hit.kind === "circle" || hit.kind === "arc") return { kind: "primitive", item: hit.item };
    return null;
  }

  function presentationOperandsFromSelection() {
    return [
      ...selectedPoints.map((item) => ({ kind: "point", item })),
      ...selectedLines.map((item) => ({ kind: "line", item })),
      ...selectedCircles.map((item) => ({ kind: "primitive", item })),
      ...selectedArcs.map((item) => ({ kind: "primitive", item })),
    ];
  }

  function samePresentationOperand(a, b) {
    return Boolean(a && b && a.kind === b.kind && a.item === b.item);
  }

  function presentationTargetFromOperands(operands = []) {
    const unique = [];
    for (const operand of operands) {
      if (!operand?.item || unique.some((item) => samePresentationOperand(item, operand))) continue;
      unique.push(operand);
    }
    const points = unique.filter((operand) => operand.kind === "point").map((operand) => operand.item);
    const lines = unique.filter((operand) => operand.kind === "line").map((operand) => operand.item);
    const primitives = unique.filter((operand) => operand.kind === "primitive").map((operand) => operand.item);
    if (points.length === 2 && lines.length === 0 && primitives.length === 0) {
      return { kind: "point-point", p1: points[0], p2: points[1], value: hypot2(points[1].x - points[0].x, points[1].y - points[0].y) };
    }
    if (points.length === 1 && lines.length === 1 && primitives.length === 0) {
      return { kind: "point-line", point: points[0], line: lines[0], value: Math.abs(signedPointLineDistance(points[0], lines[0])) };
    }
    if (points.length === 0 && lines.length === 1 && primitives.length === 0) {
      const [line] = lines;
      return { kind: "line-length", line, p1: line.p1, p2: line.p2, value: line.length() };
    }
    if (points.length === 0 && lines.length === 2 && primitives.length === 0) {
      if (linesNearlyParallelForDimension(lines[0], lines[1])) {
        return { kind: "line-line", line1: lines[0], line2: lines[1], value: Math.abs(signedPointLineDistance(lines[0].p1, lines[1])) };
      }
      return { kind: "angle", line1: lines[0], line2: lines[1], value: angleDegrees(Math.abs(angleDimensionSweep({ line1: lines[0], line2: lines[1] }))), signedValue: angleDimensionSweep({ line1: lines[0], line2: lines[1] }) };
    }
    if (points.length === 0 && lines.length === 0 && primitives.length === 1) {
      const primitive = primitives[0];
      return primitive instanceof Circle ? { kind: "diameter", primitive, value: primitive.radius() * 2 } : { kind: "radius", primitive, value: primitive.radius() };
    }
    return null;
  }

  function linesNearlyParallelForDimension(line1, line2) {
    if (!lineHasDirection(line1) || !lineHasDirection(line2)) return false;
    const denom = Math.max(line1.length() * line2.length(), 1e-12);
    const crossRatio = Math.abs(line1.dx() * line2.dy() - line1.dy() * line2.dx()) / denom;
    return crossRatio <= Math.sin((5 * Math.PI) / 180);
  }

  function startPresentationDimensionPlacement(target, operands = [], pointer = null) {
    pendingCommand = {
      type: "presentation-dimension-place",
      target,
      targetData: presentationTargetToData(target),
      operands: operands.slice(),
      pointer: pointer || lastPointerWorld || dimensionAnchor(target, defaultDimensionForTarget(target)),
    };
    setHint("注記寸法線の位置をクリックしてください");
    updatePresentationUI();
    updateToolbar();
    draw();
  }

  function createPresentationAnnotationDimension() {
    if (!isPresentationMode()) return;
    const target = presentationTargetFromSelection();
    if (target) {
      startPresentationDimensionPlacement(target, presentationOperandsFromSelection());
      updateToolbar();
      return;
    }
    clearSelection();
    pendingCommand = { type: "presentation-dimension-select", operands: [] };
    setHint("注記寸法対象をクリックしてください");
    updatePresentationUI();
    updateToolbar();
    draw();
  }

  function enterPresentationSelectCommand(message = "プレゼンテーション選択") {
    if (!isPresentationMode()) return;
    pendingCommand = null;
    pendingConstraintCommand = null;
    setHint(message);
    updatePresentationUI();
    updateToolbar();
    draw();
  }

  function handlePresentationDimensionTargetClick(hit, pointer) {
    if (pendingCommand?.type !== "presentation-dimension-select") return false;
    const operand = presentationOperandFromHit(hit);
    if (!operand) {
      setHint("注記寸法対象をクリックしてください", "error");
      return true;
    }
    if (!pendingCommand.operands.some((item) => samePresentationOperand(item, operand))) {
      pendingCommand.operands.push(operand);
      setPresentationSelection(hit, true);
    }
    const target = presentationTargetFromOperands(pendingCommand.operands);
    if (target) {
      startPresentationDimensionPlacement(target, pendingCommand.operands, pointer);
    } else {
      setHint("次の注記寸法対象をクリックしてください");
      updatePresentationUI();
      draw();
    }
    return true;
  }

  function retargetPresentationDimensionWithHit(hit, pointer) {
    if (pendingCommand?.type !== "presentation-dimension-place") return false;
    const operand = presentationOperandFromHit(hit);
    if (!operand) return false;
    const operands = pendingCommand.operands?.length ? pendingCommand.operands.slice() : presentationOperandsFromSelection();
    if (operands.some((item) => samePresentationOperand(item, operand))) return false;
    operands.push(operand);
    const target = presentationTargetFromOperands(operands);
    if (!target) return false;
    setPresentationSelection(hit, true);
    startPresentationDimensionPlacement(target, operands, pointer);
    return true;
  }

  function commitPresentationAnnotationDimensionAt(anchor) {
    if (!pendingCommand || pendingCommand.type !== "presentation-dimension-place") return;
    const target = pendingCommand.target;
    const targetData = pendingCommand.targetData || presentationTargetToData(target);
    const dimension = dimensionFromAnchor(target, anchor);
    pushPresentationElement({
      type: "annotationDimension",
      target: targetData,
      dimension,
      geometryRefs: targetData || {},
      style: {},
    });
    pendingCommand = null;
    setHint("注記寸法を追加しました");
    updateToolbar();
    recordHistory("注記寸法追加");
  }

  function createPresentationLeader() {
    if (!isPresentationMode()) return;
    const target = presentationLeaderTargetFromSelection(lastPointerWorld);
    if (target) {
      startPresentationLeaderPlacement(target, lastPointerWorld);
      return;
    }
    clearSelection();
    pendingCommand = { type: "presentation-leader-select" };
    setHint("引出線を付ける図形をクリックしてください");
    updatePresentationUI();
    updateToolbar();
    draw();
  }

  function handlePresentationLeaderTargetClick(hit, pointer) {
    if (pendingCommand?.type !== "presentation-leader-select") return false;
    const target = presentationLeaderTargetFromHit(hit, pointer);
    if (!target) {
      setHint("引出線を付ける図形をクリックしてください", "error");
      return true;
    }
    setPresentationSelection(hit, false);
    startPresentationLeaderPlacement(target, pointer);
    return true;
  }

  function presentationLeaderTargetFromSelection(pointer = null) {
    const items = presentationSelectedItems();
    if (items.length !== 1) return null;
    return presentationLeaderTargetFromItem(items[0], pointer);
  }

  function presentationLeaderTargetFromHit(hit, pointer = null) {
    if (!hit?.item) return null;
    return presentationLeaderTargetFromItem(hit.item, pointer);
  }

  function presentationLeaderTargetFromItem(item, pointer = null) {
    if (item instanceof Point) return { item, anchor: { x: item.x, y: item.y }, geometryRef: presentationElementKey(item) };
    if (item instanceof Line) {
      const anchor = pointer ? projectPointToSegmentPoint(pointer, item) : { x: (item.p1.x + item.p2.x) / 2, y: (item.p1.y + item.p2.y) / 2 };
      return { item, anchor, geometryRef: presentationElementKey(item) };
    }
    if (item instanceof Circle) {
      const base = pointer || { x: item.center.x + item.radius(), y: item.center.y };
      const angle = Math.atan2(base.y - item.center.y, base.x - item.center.x);
      return { item, anchor: { x: item.center.x + Math.cos(angle) * item.radius(), y: item.center.y + Math.sin(angle) * item.radius() }, geometryRef: presentationElementKey(item) };
    }
    if (item instanceof Arc) {
      const base = pointer || arcEndpointPoint(item, "start");
      const angle = clampAngleToArcSweep(item, Math.atan2(base.y - item.center.y, base.x - item.center.x));
      return { item, anchor: { x: item.center.x + Math.cos(angle) * item.radius(), y: item.center.y + Math.sin(angle) * item.radius() }, geometryRef: presentationElementKey(item) };
    }
    return null;
  }

  function presentationLeaderAnchorForElement(element) {
    const item = presentationElementFromKey(element?.geometryRefs?.target);
    if (!item) return element?.start || null;
    return presentationLeaderTargetFromItem(item, element.start || null)?.anchor || element.start || null;
  }

  function clampAngleToArcSweep(arc, angle) {
    if (angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return angle;
    const start = arcEndpointPoint(arc, "start");
    const end = arcEndpointPoint(arc, "end");
    const point = {
      x: arc.center.x + Math.cos(angle) * arc.radius(),
      y: arc.center.y + Math.sin(angle) * arc.radius(),
    };
    return hypot2(point.x - start.x, point.y - start.y) <= hypot2(point.x - end.x, point.y - end.y) ? arc.startAngle : arc.endAngle;
  }

  function startPresentationLeaderPlacement(target, pointer = null) {
    pendingCommand = {
      type: "presentation-leader-place",
      leaderTarget: target,
      pointer: pointer || {
        x: target.anchor.x + 90 / viewport.scale,
        y: target.anchor.y - 36 / viewport.scale,
      },
    };
    setHint("引出線の文字位置をクリックしてください");
    updatePresentationUI();
    updateToolbar();
    draw();
  }

  function presentationLeaderLayout(anchor, pointer) {
    const side = pointer.x >= anchor.x ? 1 : -1;
    const minShelf = 64 / viewport.scale;
    const end = { x: pointer.x, y: pointer.y };
    if (Math.abs(end.x - anchor.x) < minShelf) end.x = anchor.x + side * minShelf;
    const elbowX = side > 0 ? Math.min(anchor.x + 42 / viewport.scale, end.x - minShelf) : Math.max(anchor.x - 42 / viewport.scale, end.x + minShelf);
    const elbow = { x: elbowX, y: end.y };
    const text = {
      x: (elbow.x + end.x) / 2,
      y: end.y - 10 / viewport.scale,
    };
    return { start: anchor, elbow, end, text };
  }

  function commitPresentationLeaderAt(pointer) {
    if (pendingCommand?.type !== "presentation-leader-place" || !pendingCommand.leaderTarget) return;
    const target = pendingCommand.leaderTarget;
    const layout = presentationLeaderLayout(target.anchor, pointer);
    const text = window.prompt("引出線テキスト", "注記");
    if (!text) {
      setHint("引出線をキャンセルしました");
      pendingCommand = null;
      updateToolbar();
      draw();
      return;
    }
    pushPresentationElement({
      type: "leader",
      text,
      start: layout.start,
      elbow: layout.elbow,
      end: layout.end,
      x: layout.text.x,
      y: layout.text.y,
      geometryRefs: { target: target.geometryRef },
      style: { color: "#111827", fontSize: 13, lineWidthPx: 1.4 },
    });
    pendingCommand = null;
    setHint("引出線を追加しました");
    updateToolbar();
    recordHistory("引出線追加");
  }

  function drawPresentationLeaderCommandPreview() {
    if (pendingCommand?.type !== "presentation-leader-place" || !pendingCommand.leaderTarget) return;
    const layout = presentationLeaderLayout(pendingCommand.leaderTarget.anchor, pendingCommand.pointer);
    drawPresentationLeader({
      start: layout.start,
      elbow: layout.elbow,
      end: layout.end,
      x: layout.text.x,
      y: layout.text.y,
      text: "注記",
      style: { color: "#2563eb", fontSize: 13, lineWidthPx: 1.4 },
    }, true);
  }

  function rejectPresentationGeometryEdit(action = "Geometry editing") {
    if (isGeometryMode()) return false;
    setHint(`${action} is disabled in Presentation Mode`, "error");
    cancelConstraintTargetCommand("");
    clearSnap();
    pointerPreview = null;
    trimPreview = null;
    draw();
    return true;
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
    return isGeometryMode() && isDrawableSketch(activeSketchId());
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

  function isReferenceSourceSketchId(referenceSketchId, subjectSketchId = activeSketchId()) {
    if (!referenceSketchId || !subjectSketchId) return false;
    if (!isDrawableSketch(referenceSketchId)) return false;
    if (referenceSketchId === subjectSketchId) return false;
    return !descendantSketchIds(subjectSketchId).includes(referenceSketchId);
  }

  function referenceSourceSketchIds(subjectSketchId = activeSketchId()) {
    ensureSketchState();
    return model.sketches
      .filter((sketch) => isReferenceSourceSketchId(sketch.id, subjectSketchId))
      .map((sketch) => sketch.id);
  }

  function constraintIsOperational(constraint) {
    return constraint?.enabled !== false && !invalidReferenceConstraints.has(constraint);
  }

  function referenceSketchTargets(sketchId) {
    return [...new Set(model.constraints
      .filter((constraint) => constraintIsOperational(constraint) && constraint.reference && constraintSketchId(constraint) === sketchId && constraint.referenceSketchId)
      .map((constraint) => constraint.referenceSketchId))];
  }

  function referencePathExists(fromSketchId, toSketchId) {
    const pending = [fromSketchId];
    const visited = new Set();
    while (pending.length > 0) {
      const current = pending.pop();
      if (current === toSketchId) return true;
      if (!current || visited.has(current)) continue;
      visited.add(current);
      pending.push(...referenceSketchTargets(current));
    }
    return false;
  }

  function wouldCreateReferenceCycle(subjectSketchId, referenceSketchId) {
    return subjectSketchId === referenceSketchId || referencePathExists(referenceSketchId, subjectSketchId);
  }

  function refreshReferenceConstraintValidity() {
    const invalid = new Map();
    const acceptedTargets = new Map();
    const targetsOf = (sketchId) => acceptedTargets.get(sketchId) || [];
    const pathExists = (fromSketchId, toSketchId) => {
      const pending = [fromSketchId];
      const visited = new Set();
      while (pending.length > 0) {
        const current = pending.pop();
        if (current === toSketchId) return true;
        if (!current || visited.has(current)) continue;
        visited.add(current);
        pending.push(...targetsOf(current));
      }
      return false;
    };
    for (const constraint of model.constraints) {
      if (constraint.enabled === false || !constraint.reference || !constraint.referenceSketchId) continue;
      const ownerSketchId = constraintSketchId(constraint);
      const referenceSketchId = constraint.referenceSketchId;
      if (!isReferenceSourceSketchId(referenceSketchId, ownerSketchId)) {
        invalid.set(constraint, "参照範囲外");
        continue;
      }
      if (ownerSketchId === referenceSketchId || pathExists(referenceSketchId, ownerSketchId)) {
        invalid.set(constraint, "循環参照");
        continue;
      }
      if (!acceptedTargets.has(ownerSketchId)) acceptedTargets.set(ownerSketchId, []);
      acceptedTargets.get(ownerSketchId).push(referenceSketchId);
    }
    invalidReferenceConstraints = invalid;
    return invalid;
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
    if (id === activeSketchId()) return true;
    const sketch = sketchById(id);
    return Boolean(sketch && sketch.visible !== false);
  }

  function isVisibleSketchElement(item) {
    return isVisibleSketchId(elementSketchId(item));
  }

  function sketchRelationToActive(sketchId) {
    const id = sketchId || activeSketchId();
    if (id === activeSketchId()) return "active";
    if (descendantSketchIds(activeSketchId()).includes(id)) return "descendant";
    if (isReferenceSourceSketchId(id)) return "reference";
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

  function operandElement(operand) {
    if (!operand) return null;
    if (operand.kind === "point") return operand.point;
    if (operand.kind === "line") return operand.line;
    if (operand.kind === "primitive") return operand.primitive;
    if (operand.kind === "arc-endpoint") return operand.arc;
    return operand.element || null;
  }

  function operandRelationForSketch(sketchId) {
    if (isEditableSketchId(sketchId)) return "active";
    if (descendantSketchIds(activeSketchId()).includes(sketchId)) return "descendant";
    if (isReferenceSourceSketchId(sketchId)) return "reference";
    return null;
  }

  function makeConstraintOperand(kind, data) {
    const element = data.element || data.point || data.line || data.primitive || data.arc || null;
    const sketchId = data.sketchId || elementSketchId(element);
    const relation = operandRelationForSketch(sketchId);
    if (!element || !sketchId || !relation) return null;
    return { kind, ...data, element, sketchId, relation };
  }

  function operandFromReferenceTarget(target) {
    if (!target) return null;
    if (target.kind === "point") return makeConstraintOperand("point", { point: target.point, sketchId: target.sketchId });
    if (target.kind === "line") return makeConstraintOperand("line", { line: target.line, sketchId: target.sketchId });
    if (target.kind === "primitive") return makeConstraintOperand("primitive", { primitive: target.primitive, sketchId: target.sketchId });
    return null;
  }

  function referenceTargetFromOperand(operand) {
    if (!operand) return null;
    if (operand.kind === "point") return { kind: "point", point: operand.point, sketchId: operand.sketchId };
    if (operand.kind === "line") return { kind: "line", line: operand.line, sketchId: operand.sketchId };
    if (operand.kind === "primitive") return { kind: "primitive", primitive: operand.primitive, sketchId: operand.sketchId };
    return null;
  }

  function subjectFromOperand(operand) {
    if (!operand) return null;
    if (operand.kind === "point") return { kind: "point", point: operand.point };
    if (operand.kind === "line") return { kind: "line", line: operand.line };
    if (operand.kind === "primitive") return { kind: "primitive", primitive: operand.primitive };
    if (operand.kind === "arc-endpoint") return { kind: "arc-endpoint", arc: operand.arc, endpoint: operand.endpoint };
    return null;
  }

  function sameConstraintOperand(a, b) {
    if (!a || !b || a.kind !== b.kind) return false;
    if (a.kind === "arc-endpoint") return sameArcEndpoint(a, b);
    return operandElement(a) === operandElement(b);
  }

  function isConstraintOperandSelected(item, options = {}) {
    if (!item) return false;
    if (options.arcEndpoint) {
      return constraintOperands.some((operand) => operand.kind === "arc-endpoint" && sameArcEndpoint(operand, options.arcEndpoint));
    }
    return constraintOperands.some((operand) => operandElement(operand) === item);
  }

  function syncSelectionFromConstraintOperands() {
    selectedPoints = [];
    selectedLines = [];
    selectedCircles = [];
    selectedArcs = [];
    selectedBlockInstances = [];
    selectedArcEndpoint = null;
    selectedArcEndpointPair = null;
    for (const operand of constraintOperands) {
      if (operand.kind === "point" && !selectedPoints.includes(operand.point)) selectedPoints.push(operand.point);
      else if (operand.kind === "line" && !selectedLines.includes(operand.line)) selectedLines.push(operand.line);
      else if (operand.kind === "primitive") {
        if (operand.primitive instanceof Circle && !selectedCircles.includes(operand.primitive)) selectedCircles.push(operand.primitive);
        if (operand.primitive instanceof Arc && !selectedArcs.includes(operand.primitive)) selectedArcs.push(operand.primitive);
      } else if (operand.kind === "arc-endpoint") {
        if (selectedArcEndpoint && !sameArcEndpoint(selectedArcEndpoint, operand)) selectedArcEndpointPair = [selectedArcEndpoint, operand];
        selectedArcEndpoint = { arc: operand.arc, endpoint: operand.endpoint };
        if (!selectedArcs.includes(operand.arc)) selectedArcs.push(operand.arc);
      }
    }
  }

  function constraintOperandsFromSelection() {
    const operands = [];
    for (const p of selectedPoints) operands.push(makeConstraintOperand("point", { point: p }));
    for (const l of selectedLines) operands.push(makeConstraintOperand("line", { line: l }));
    for (const c of selectedCircles) operands.push(makeConstraintOperand("primitive", { primitive: c }));
    for (const a of selectedArcs) {
      if (selectedArcEndpoint?.arc === a) continue;
      operands.push(makeConstraintOperand("primitive", { primitive: a }));
    }
    if (selectedArcEndpoint) operands.push(makeConstraintOperand("arc-endpoint", { arc: selectedArcEndpoint.arc, endpoint: selectedArcEndpoint.endpoint }));
    return operands.filter(Boolean);
  }

  function referenceSubjectElement(subject) {
    if (!subject) return null;
    if (subject.kind === "point") return subject.point;
    if (subject.kind === "line") return subject.line;
    if (subject.kind === "primitive") return subject.primitive;
    if (subject.kind === "arc-endpoint") return subject.arc;
    return null;
  }

  function referenceSubjectSketchId(subject) {
    return elementSketchId(referenceSubjectElement(subject));
  }

  function resultIsAccepted(result) {
    return Boolean(result?.success) && result.errorNorm <= CONSTRAINT_ACCEPT_ERROR;
  }

  function rankStateForConstraints(sketchId, constraints) {
    return solver.constraintRankState({
      variables: sketchSolveVariables(sketchId),
      constraints,
      errorTolerance: CONSTRAINT_ACCEPT_ERROR,
      rankTolerance: 1e-8,
    });
  }

  function constraintsForRedundancy(sketchId) {
    return model.constraints.filter((constraint) => constraintIsOperational(constraint) && constraintSketchId(constraint) === sketchId);
  }

  function redundantConstraintInfo(constraint, sketchId = constraintSketchId(constraint)) {
    if (!constraint || constraint.enabled === false) return { redundant: false };
    const constraints = constraintsForRedundancy(sketchId);
    if (!constraints.includes(constraint)) return { redundant: false };
    const before = rankStateForConstraints(sketchId, constraints.filter((item) => item !== constraint));
    const after = rankStateForConstraints(sketchId, constraints);
    if (!before.stable || !after.stable) return { redundant: false, unstable: true, before, after };
    return {
      redundant: after.rank <= before.rank,
      before,
      after,
      rankBefore: before.rank,
      rankAfter: after.rank,
    };
  }

  function refreshConstraintRedundancy() {
    const byConstraint = new Map();
    const bySketch = new Map();
    let count = 0;
    for (const sketch of model.sketches.filter((item) => !isRootSketch(item))) {
      const sketchId = sketch.id;
      const constraints = constraintsForRedundancy(sketchId);
      const accepted = [];
      let before = rankStateForConstraints(sketchId, accepted);
      let sketchCount = 0;
      for (const constraint of constraints) {
        const after = rankStateForConstraints(sketchId, [...accepted, constraint]);
        if (!before.stable || !after.stable) {
          accepted.push(constraint);
          before = after;
          continue;
        }
        if (after.rank <= before.rank) {
          const info = { redundant: true, sketchId, rankBefore: before.rank, rankAfter: after.rank, before, after };
          byConstraint.set(constraint, info);
          sketchCount += 1;
          count += 1;
        } else {
          accepted.push(constraint);
          before = after;
        }
      }
      if (sketchCount > 0) bySketch.set(sketchId, sketchCount);
    }
    constraintRedundancyState = { constraints: byConstraint, sketches: bySketch, count };
    return constraintRedundancyState;
  }

  function constraintRedundancyInfo(constraint) {
    return constraintRedundancyState?.constraints?.get(constraint) || null;
  }

  function constraintIsRedundant(constraint) {
    return Boolean(constraintRedundancyInfo(constraint)?.redundant);
  }

  function constraintDuplicateCountForSketch(sketchId) {
    return constraintRedundancyState?.sketches?.get(sketchId) || 0;
  }

  function constraintDuplicateSummary() {
    const count = constraintRedundancyState?.count || 0;
    return count > 0 ? ` / 重複拘束: ${count}` : "";
  }

  function referenceConstraintErrorInfo(constraint) {
    return invalidReferenceConstraints.get(constraint) || null;
  }

  function referenceConstraintErrorCountForSketch(sketchId) {
    let count = 0;
    for (const constraint of invalidReferenceConstraints.keys()) {
      if (constraintSketchId(constraint) === sketchId) count += 1;
    }
    return count;
  }

  function referenceConstraintErrorSummary() {
    const count = invalidReferenceConstraints.size;
    return count > 0 ? ` / 参照エラー: ${count}` : "";
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

  function dependentErrorSummary(dependent) {
    const failures = dependent?.results?.filter((entry) => entry.status === "error") || [];
    if (failures.length === 0) return "";
    const first = failures[0];
    return ` / 参照スケッチ破綻: ${sketchName(first.sketchId)} (error=${first.result.errorNorm.toExponential(3)})`;
  }

  function solveAndRefresh(label = "自動solve") {
    const solved = solveSketchAndDependents(activeSketchId());
    const result = solved.result;
    const analysis = refreshConstraintAnalysis();
    const hasDependentError = solved.dependent?.success === false;
    const hasDuplicateConstraints = (constraintRedundancyState?.count || 0) > 0;
    const statusKind = solved.success && analysis.analysis.stable && !hasDependentError && !hasDuplicateConstraints ? "normal" : "error";
    const dependentText = solved.dependent?.results?.length > 0 ? `, dependent=${solved.dependent.results.length}` : "";
    setHint(`${label}: success=${solved.success}, error=${result.errorNorm.toExponential(2)}, iter=${result.iterations}${dependentText}${dependentErrorSummary(solved.dependent)} / ${constraintSummaryText()}`, statusKind);
    updateUI();
    draw();
    if (solved.success && !historyRestoring) recordHistory(label);
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

  function variableDeltaInBasis(object, prop, basis, analysis) {
    const index = analysis.variableIndex?.get(object)?.[prop];
    return index >= 0 ? basis[index] || 0 : 0;
  }

  function lineSupportHasConstraintFreedom(line, analysis) {
    const normal = lineSupportNormal(line);
    for (const basis of analysis.nullspaceBasis || []) {
      const norm = Math.max(1, Math.sqrt(basis.reduce((sum, value) => sum + value * value, 0)));
      const p1Normal = normal.x * variableDeltaInBasis(line.p1, "x", basis, analysis) + normal.y * variableDeltaInBasis(line.p1, "y", basis, analysis);
      const p2Normal = normal.x * variableDeltaInBasis(line.p2, "x", basis, analysis) + normal.y * variableDeltaInBasis(line.p2, "y", basis, analysis);
      if (Math.abs(p1Normal) > 1e-7 * norm || Math.abs(p2Normal) > 1e-7 * norm) return true;
    }
    return false;
  }

  function classifyConstraintStatus(item, kind, analysis) {
    if (!analysis.stable) return "conflict";
    if (kind === "point") return pointHasConstraintFreedom(item, analysis) ? "under" : "full";
    if (kind === "line") {
      const hasEndpointFreedom = pointHasConstraintFreedom(item.p1, analysis) || pointHasConstraintFreedom(item.p2, analysis);
      if (!hasEndpointFreedom) return "full";
      return lineSupportHasConstraintFreedom(item, analysis) ? "under" : "support";
    }
    if (kind === "circle") return pointHasConstraintFreedom(item.center, analysis) || objectHasConstraintFreedom(item, "radiusValue", analysis) ? "under" : "full";
    if (kind === "arc") {
      const supportFreedom = pointHasConstraintFreedom(item.center, analysis) || objectHasConstraintFreedom(item, "radiusValue", analysis);
      const endpointFreedom = objectHasConstraintFreedom(item, "startAngle", analysis) || objectHasConstraintFreedom(item, "endAngle", analysis);
      if (!supportFreedom && !endpointFreedom) return "full";
      return !supportFreedom && endpointFreedom ? "support" : "under";
    }
    return "full";
  }

  function classifyBlockProjectionStatus(item, analysis) {
    const instance = item?.blockInstance;
    if (!instance || instance.fixed) return "full";
    const freedom = analysis.variableFreedom.get(instance) || {};
    const translationFree = Boolean(freedom.x || freedom.y);
    const rotationFree = Boolean(freedom.rotation);
    if (item instanceof Arc) {
      if (translationFree) return "under";
      return rotationFree ? "support" : "full";
    }
    if (item instanceof Circle || item instanceof Point) return translationFree ? "under" : "full";
    if (item instanceof Line) {
      if (!translationFree && !rotationFree) return "full";
      const length = Math.max(item.length(), MIN_LINE_LENGTH);
      const direction = { x: item.dx() / length, y: item.dy() / length };
      for (const basis of analysis.nullspaceBasis || []) {
        const norm = Math.max(1, Math.sqrt(basis.reduce((sum, value) => sum + value * value, 0)));
        const dx = variableDeltaInBasis(instance, "x", basis, analysis);
        const dy = variableDeltaInBasis(instance, "y", basis, analysis);
        const dr = variableDeltaInBasis(instance, "rotation", basis, analysis);
        const normalMotion = -direction.y * dx + direction.x * dy;
        if (Math.abs(normalMotion) > 1e-7 * norm || Math.abs(dr) > 1e-7 * norm) return "under";
      }
      return "support";
    }
    return translationFree || rotationFree ? "under" : "full";
  }

  function refreshConstraintAnalysis() {
    refreshReferenceConstraintValidity();
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
      for (const bundle of blockProjectionBundles()) {
        if (bundle.instance.sketchId !== sketchId) continue;
        for (const item of [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs]) {
          const status = forceConflict ? "conflict" : classifyBlockProjectionStatus(item, analysis);
          statuses.set(item, status);
          if (isEditableSketchElement(item) && !(item instanceof Point)) items.push(status);
        }
      }
    }
    const summary = {
      full: items.filter((status) => status === "full").length,
      support: items.filter((status) => status === "support").length,
      under: items.filter((status) => status === "under").length,
      conflict: items.filter((status) => status === "conflict").length,
      total: items.length,
    };
    constraintAnalysisState = { analysis: analyses.get(rootSketchId), analyses, statuses, summary };
    refreshConstraintRedundancy();
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
    if (relation === "active") return 2.6;
    if (relation === "reference" || relation === "descendant") return 1.8;
    return 0;
  }

  function isSidebarHighlightedElement(item) {
    return Boolean(hoveredSketchTreeId && elementSketchId(item) === hoveredSketchTreeId);
  }

  function isSidebarHoveredElement(item) {
    return Boolean(item && hoveredSidebarItem?.elements?.has(item));
  }

  function hasPrimaryCanvasSelection() {
    return selectedPoints.length > 0 ||
      selectedLines.length > 0 ||
      selectedCircles.length > 0 ||
      selectedArcs.length > 0 ||
      selectedBlockInstances.length > 0 ||
      Boolean(selectedArcEndpoint) ||
      Boolean(selectedArcEndpointPair) ||
      Boolean(selectedDimensionConstraint);
  }

  function effectiveSelectedConstraint() {
    return hasPrimaryCanvasSelection() ? null : selectedConstraint;
  }

  function isSelectedConstraintRelatedElement(item) {
    const constraint = effectiveSelectedConstraint();
    return Boolean(constraint && constraintGraphNodes(constraint).includes(item));
  }

  function isReferenceHoverElement(item) {
    return Boolean(pendingConstraintCommand && item && !isActiveSketchElement(item) && isReferenceSourceSketchId(elementSketchId(item)));
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
    if (relation === "reference" || relation === "descendant") return 1;
    return 0;
  }

  function constraintStatusBadge(status) {
    if (status === "conflict") return "矛盾";
    if (status === "support") return "支持位置拘束";
    if (status === "under") return "未拘束";
    return "完全拘束";
  }

  function constraintSummaryText() {
    if (!constraintAnalysisState) refreshConstraintAnalysis();
    const s = constraintAnalysisState?.summary || { full: 0, support: 0, under: 0, conflict: 0 };
    return `完全拘束: ${s.full} / 支持位置拘束: ${s.support} / 未拘束: ${s.under} / 矛盾: ${s.conflict}${constraintDuplicateSummary()}${referenceConstraintErrorSummary()}`;
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

  function addCircle(center, radiusValue, construction = constructionLineMode) {
    if (!center || !Number.isFinite(radiusValue) || radiusValue < MIN_ORIENTATION_LENGTH) return null;
    const c = new Circle(`C${circleSeq++}`, center, radiusValue, construction);
    assignSketchId(c);
    model.circles.push(c);
    return c;
  }

  function addArc(center, radiusValue, startAngle, endAngle, construction = constructionLineMode) {
    if (!center || !Number.isFinite(radiusValue) || radiusValue < MIN_ORIENTATION_LENGTH) return null;
    if (!Number.isFinite(startAngle) || !Number.isFinite(endAngle)) return null;
    const a = new Arc(`A${arcSeq++}`, center, radiusValue, startAngle, endAngle, construction);
    assignSketchId(a);
    normalizeArcSweep(a);
    model.arcs.push(a);
    return a;
  }

  function blockSelectionGeometry() {
    if (selectedBlockInstances.length > 0) return { error: "ブロックを含む選択はブロック化できません" };
    const lines = selectedLines.filter((item) => !item.blockProjection);
    const circles = selectedCircles.filter((item) => !item.blockProjection);
    const arcs = selectedArcs.filter((item) => !item.blockProjection);
    const points = new Set(selectedPoints.filter((item) => !item.blockProjection));
    for (const line of lines) {
      points.add(line.p1);
      points.add(line.p2);
    }
    for (const primitive of [...circles, ...arcs]) points.add(primitive.center);
    const geometry = [...points, ...lines, ...circles, ...arcs];
    if (lines.length + circles.length + arcs.length === 0) return { error: "ブロック化する図形を選択してください" };
    if (!geometry.every((item) => elementSketchId(item) === activeSketchId())) return { error: "アクティブスケッチ内の図形だけをブロック化できます" };
    const selectedSet = new Set(geometry);
    for (const point of points) {
      const shared = model.lines.some((line) => !selectedSet.has(line) && (line.p1 === point || line.p2 === point)) ||
        model.circles.some((circle) => !selectedSet.has(circle) && circle.center === point) ||
        model.arcs.some((arc) => !selectedSet.has(arc) && arc.center === point);
      if (shared) return { error: `${point.id} は非選択図形と共有されています` };
    }
    const internalConstraints = [];
    for (const constraint of model.constraints) {
      const nodes = constraintGraphNodes(constraint).filter((node) => node instanceof Point || node instanceof Line || node instanceof Circle || node instanceof Arc);
      if (!nodes.some((node) => selectedSet.has(node))) continue;
      if (constraint.reference || nodes.some((node) => !selectedSet.has(node))) return { error: `選択範囲をまたぐ拘束があります: ${constraintLabelForList(constraint)}` };
      internalConstraints.push(constraint);
    }
    const selectedIds = new Set(geometry.map((item) => item.id));
    for (const sheet of model.presentationSheets) {
      for (const element of sheet.elements || []) {
        if (Object.values(element.geometryRefs || {}).map(String).some((value) => {
          if (selectedIds.has(value)) return true;
          const referenced = presentationElementFromKey(value);
          return referenced ? selectedSet.has(referenced) : false;
        })) return { error: `Presentation注記 ${element.id} が選択図形を参照しています` };
      }
    }
    return { points: [...points], lines, circles, arcs, constraints: internalConstraints };
  }

  function cloneConstraintForBlock(constraint, pointById, lineById, primitiveById, origin = { x: 0, y: 0 }, preserveReference = false) {
    const data = decorateSerializedConstraint(serializeConstraint(constraint), constraint);
    if (!data) throw new Error("未対応の内部拘束があります");
    if (data.dimension) {
      data.dimension = { ...data.dimension };
      for (const key of ["x", "labelX"]) if (Number.isFinite(Number(data.dimension[key]))) data.dimension[key] = Number(data.dimension[key]) - origin.x;
      for (const key of ["y", "labelY"]) if (Number.isFinite(Number(data.dimension[key]))) data.dimension[key] = Number(data.dimension[key]) - origin.y;
    }
    const cloned = deserializeConstraint(data, pointById, lineById, primitiveById);
    if (!cloned) throw new Error("内部拘束を複製できません");
    cloned.sketchId = constraint.sketchId || DEFAULT_SKETCH_ID;
    cloned.reference = preserveReference && Boolean(constraint.reference);
    cloned.referenceSketchId = cloned.reference ? constraint.referenceSketchId || null : null;
    return cloned;
  }

  function createBlockSketchState() {
    return {
      sketches: [
        { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", visible: true },
        { id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true },
      ],
      activeSketchId: DEFAULT_SKETCH_ID,
    };
  }

  function blockSelectionBoundsCenter(selection) {
    const temp = {
      sketches: createBlockSketchState().sketches,
      lines: selection.lines || [],
      circles: selection.circles || [],
      arcs: selection.arcs || [],
    };
    const originalSketchIds = new Map();
    for (const item of [...temp.lines, ...temp.circles, ...temp.arcs]) {
      originalSketchIds.set(item, item.sketchId);
      item.sketchId = DEFAULT_SKETCH_ID;
    }
    const center = blockLocalGeometryBounds(temp, [DEFAULT_SKETCH_ID])?.center || { x: 0, y: 0 };
    for (const [item, sketchId] of originalSketchIds) item.sketchId = sketchId;
    return center;
  }

  function createBlockDefinitionFromSelection(selection, origin, name) {
    const sketchState = createBlockSketchState();
    const pointById = new Map();
    const points = selection.points.map((source) => {
      const point = new Point(source.id, source.x - origin.x, source.y - origin.y, source.fixed, source.kind || "endpoint");
      point.sketchId = DEFAULT_SKETCH_ID;
      pointById.set(point.id, point);
      return point;
    });
    const lineById = new Map();
    const lines = selection.lines.map((source) => {
      const line = new Line(source.id, pointById.get(source.p1.id), pointById.get(source.p2.id), source.construction);
      line.sketchId = DEFAULT_SKETCH_ID;
      lineById.set(line.id, line);
      return line;
    });
    const primitiveById = new Map();
    const circles = selection.circles.map((source) => {
      const circle = new Circle(source.id, pointById.get(source.center.id), source.radius(), source.construction);
      circle.sketchId = DEFAULT_SKETCH_ID;
      primitiveById.set(circle.id, circle);
      return circle;
    });
    const arcs = selection.arcs.map((source) => {
      const arc = new Arc(source.id, pointById.get(source.center.id), source.radius(), source.startAngle, source.endAngle, source.construction);
      arc.sketchId = DEFAULT_SKETCH_ID;
      primitiveById.set(arc.id, arc);
      return arc;
    });
    const constraints = selection.constraints.map((constraint) => {
      const cloned = cloneConstraintForBlock(constraint, pointById, lineById, primitiveById, origin);
      cloned.sketchId = DEFAULT_SKETCH_ID;
      return cloned;
    });
    return { id: `B${blockDefinitionSeq++}`, name, origin: { x: 0, y: 0 }, ...sketchState, points, lines, circles, arcs, constraints, revision: 1 };
  }

  function createEmptyBlockDefinition(name) {
    const sketchState = createBlockSketchState();
    return { id: `B${blockDefinitionSeq++}`, name, origin: { x: 0, y: 0 }, ...sketchState, points: [], lines: [], circles: [], arcs: [], constraints: [], revision: 1 };
  }

  function cloneBlockDefinition(definition) {
    const pointById = new Map();
    const points = definition.points.map((source) => {
      const point = new Point(source.id, source.x, source.y, source.fixed, source.kind || "endpoint");
      point.sketchId = source.sketchId;
      pointById.set(point.id, point);
      return point;
    });
    const lineById = new Map();
    const lines = definition.lines.map((source) => {
      const line = new Line(source.id, pointById.get(source.p1.id), pointById.get(source.p2.id), source.construction);
      line.sketchId = source.sketchId;
      lineById.set(line.id, line);
      return line;
    });
    const primitiveById = new Map();
    const circles = definition.circles.map((source) => {
      const circle = new Circle(source.id, pointById.get(source.center.id), source.radius(), source.construction);
      circle.sketchId = source.sketchId;
      primitiveById.set(circle.id, circle);
      return circle;
    });
    const arcs = definition.arcs.map((source) => {
      const arc = new Arc(source.id, pointById.get(source.center.id), source.radius(), source.startAngle, source.endAngle, source.construction);
      arc.sketchId = source.sketchId;
      primitiveById.set(arc.id, arc);
      return arc;
    });
    const constraints = definition.constraints.map((constraint) => cloneConstraintForBlock(constraint, pointById, lineById, primitiveById, { x: 0, y: 0 }, true));
    return {
      id: definition.id,
      name: definition.name,
      origin: { x: Number(definition.origin?.x) || 0, y: Number(definition.origin?.y) || 0 },
      sketches: definition.sketches.map((sketch) => ({ ...sketch })),
      activeSketchId: definition.activeSketchId,
      points,
      lines,
      circles,
      arcs,
      constraints,
      revision: Number(definition.revision) || 0,
    };
  }

  function startBlockCreation() {
    if (blockEditSession) {
      setHint("ブロック内にブロックは作成できません", "error");
      return;
    }
    if (!isGeometryMode() || !canCreateInActiveSketch()) return;
    const defaultName = `Block-${blockDefinitionSeq}`;
    const hasGeometrySelection = selectedLines.length + selectedCircles.length + selectedArcs.length > 0;
    let selection = null;
    let origin = { x: 0, y: 0 };
    if (hasGeometrySelection || selectedBlockInstances.length > 0) {
      selection = blockSelectionGeometry();
      if (selection.error) {
        setHint(selection.error, "error");
        return;
      }
      origin = blockSelectionBoundsCenter(selection);
    }
    const draft = selection ? createBlockDefinitionFromSelection(selection, origin, defaultName) : createEmptyBlockDefinition(defaultName);
    openBlockDefinitionEditor(draft, { isNew: true, creationSelection: selection, replacementCenter: origin });
  }

  function startBlockPlacement(definitionId) {
    if (blockEditSession) {
      setHint("ブロックエディタ内にはブロックを配置できません", "error");
      return;
    }
    if (!isGeometryMode() || !canCreateInActiveSketch()) return;
    if (!blockDefinitionById(definitionId)) return;
    clearSelection();
    mode = "block-place";
    blockPlacementDefinitionId = definitionId;
    blockPlacementAnchor = null;
    blockPlacementEnabledSketchIds = blockDefinitionDrawableSketchIds(blockDefinitionById(definitionId));
    pointerPreview = lastPointerWorld || { x: 0, y: 0 };
    setHint("配置する内部スケッチを選び、表示中心をクリックしてください");
    updateToolbar();
    updateBlockUI();
    draw();
  }

  function commitBlockPlacement(rotation = 0) {
    const definition = blockDefinitionById(blockPlacementDefinitionId);
    if (!definition || !blockPlacementAnchor) return null;
    const enabledSketchIds = blockPlacementEnabledSketchIds.filter((id) => blockDefinitionDrawableSketchIds(definition).includes(id));
    if (!enabledSketchIds.some((id) => blockDefinitionGeometrySketchIds(definition).includes(id))) {
      setHint("図形を持つ内部スケッチを1つ以上有効にしてください", "error");
      return null;
    }
    const translation = blockInstanceTranslationForAnchor(definition, enabledSketchIds, blockPlacementAnchor, rotation);
    const instance = { id: `BI${blockInstanceSeq++}`, definitionId: definition.id, sketchId: activeSketchId(), x: translation.x, y: translation.y, rotation, fixed: false, enabledSketchIds: enabledSketchIds.slice() };
    model.blockInstances.push(instance);
    invalidateBlockProjectionCache(instance.id);
    clearSelection();
    selectedBlockInstances = [instance];
    blockPlacementAnchor = null;
    blockPlacementEnabledSketchIds = [];
    pointerPreview = null;
    mode = "select";
    solveAndRefresh("ブロック配置");
    setHint(`${definition.name} を配置しました`);
    updateUI();
    draw();
    return instance;
  }

  function handleBlockPlacementClick(pointer) {
    if (!blockPlacementAnchor) {
      if (!blockPlacementEnabledSketchIds.some((id) => blockDefinitionGeometrySketchIds(blockDefinitionById(blockPlacementDefinitionId)).includes(id))) {
        setHint("図形を持つ内部スケッチを1つ以上有効にしてください", "error");
        return;
      }
      blockPlacementAnchor = { x: pointer.x, y: pointer.y };
      pointerPreview = pointer;
      setHint("回転方向をクリックしてください。Escで角度0度として配置します");
      draw();
      return;
    }
    commitBlockPlacement(Math.atan2(pointer.y - blockPlacementAnchor.y, pointer.x - blockPlacementAnchor.x));
  }

  function openBlockDefinitionEditor(draft, options = {}) {
    if (blockEditSession || !draft) return;
    const original = {
      points: model.points,
      lines: model.lines,
      circles: model.circles,
      arcs: model.arcs,
      constraints: model.constraints,
      blockInstances: model.blockInstances,
      sketches: model.sketches,
      activeSketchId: model.activeSketchId,
      appMode: model.appMode,
      viewport: { ...viewport },
    };
    const sourceDefinition = options.sourceDefinition || null;
    const originalElementIds = new Set(sourceDefinition ? [...sourceDefinition.points, ...sourceDefinition.lines, ...sourceDefinition.circles, ...sourceDefinition.arcs].map((item) => item.id) : []);
    blockEditSession = { draft, sourceDefinition, original, originalElementIds, isNew: Boolean(options.isNew), creationSelection: options.creationSelection || null, replacementCenter: options.replacementCenter || null };
    model.points = draft.points;
    model.lines = draft.lines;
    model.circles = draft.circles;
    model.arcs = draft.arcs;
    model.constraints = draft.constraints;
    model.blockInstances = [];
    model.sketches = draft.sketches;
    model.activeSketchId = draft.activeSketchId;
    model.appMode = "geometry";
    clearSelection();
    mode = "select";
    document.body.classList.add("block-editing");
    if (draft.lines.length + draft.circles.length + draft.arcs.length > 0) fitAllGeometryToViewport();
    else {
      const rect = canvas.getBoundingClientRect();
      viewport.scale = 1;
      viewport.x = rect.width / 2;
      viewport.y = rect.height / 2;
    }
    setHint(`ブロックエディタ: ${draft.name}`);
    updateUI();
    draw();
  }

  function enterBlockDefinitionEdit(definitionId) {
    const definition = blockDefinitionById(definitionId);
    if (!definition) return;
    openBlockDefinitionEditor(cloneBlockDefinition(definition), { sourceDefinition: definition });
  }

  function validateBlockDraft(draft) {
    if (draft.lines.length + draft.circles.length + draft.arcs.length === 0) return { success: false, reason: "ブロックには図形が必要です" };
    refreshReferenceConstraintValidity();
    if (invalidReferenceConstraints.size > 0) return { success: false, reason: "内部スケッチの参照関係に循環または無効な参照があります" };
    const drawableIds = blockDefinitionDrawableSketchIds(draft);
    for (const sketchId of drawableIds) {
      const result = solveSketchById(sketchId);
      if (!resultIsAccepted(result)) return { success: false, reason: `${sketchName(sketchId)} が成立しません (error=${result.errorNorm.toExponential(3)})` };
      const dependent = solveReferenceDependentSketches(sketchId);
      if (!dependent.success) return { success: false, reason: `${sketchName(dependent.sketchId)} が成立しません` };
    }
    return { success: true };
  }

  function translateBlockDefinition(definition, dx, dy) {
    for (const point of definition.points) {
      point.x += dx;
      point.y += dy;
    }
    for (const constraint of definition.constraints) {
      const dimension = constraint.dimension;
      if (!dimension) continue;
      for (const key of ["x", "labelX"]) if (Number.isFinite(Number(dimension[key]))) dimension[key] = Number(dimension[key]) + dx;
      for (const key of ["y", "labelY"]) if (Number.isFinite(Number(dimension[key]))) dimension[key] = Number(dimension[key]) + dy;
    }
  }

  function mergeBlockDefinitionDraft(target, draft) {
    const pointById = new Map();
    const oldPoints = new Map(target.points.map((point) => [point.id, point]));
    const points = draft.points.map((source) => {
      const point = oldPoints.get(source.id) || new Point(source.id, source.x, source.y, source.fixed, source.kind || "endpoint");
      point.x = source.x;
      point.y = source.y;
      point.fixed = source.fixed;
      point.kind = source.kind;
      point.sketchId = source.sketchId;
      pointById.set(point.id, point);
      return point;
    });
    const oldLines = new Map(target.lines.map((line) => [line.id, line]));
    const lineById = new Map();
    const lines = draft.lines.map((source) => {
      const line = oldLines.get(source.id) || new Line(source.id, pointById.get(source.p1.id), pointById.get(source.p2.id), source.construction);
      line.p1 = pointById.get(source.p1.id);
      line.p2 = pointById.get(source.p2.id);
      line.construction = source.construction;
      line.sketchId = source.sketchId;
      lineById.set(line.id, line);
      return line;
    });
    const primitiveById = new Map();
    const oldCircles = new Map(target.circles.map((circle) => [circle.id, circle]));
    const circles = draft.circles.map((source) => {
      const circle = oldCircles.get(source.id) || new Circle(source.id, pointById.get(source.center.id), source.radius(), source.construction);
      circle.center = pointById.get(source.center.id);
      circle.radiusValue = source.radius();
      circle.construction = source.construction;
      circle.sketchId = source.sketchId;
      primitiveById.set(circle.id, circle);
      return circle;
    });
    const oldArcs = new Map(target.arcs.map((arc) => [arc.id, arc]));
    const arcs = draft.arcs.map((source) => {
      const arc = oldArcs.get(source.id) || new Arc(source.id, pointById.get(source.center.id), source.radius(), source.startAngle, source.endAngle, source.construction);
      arc.center = pointById.get(source.center.id);
      arc.radiusValue = source.radius();
      arc.startAngle = source.startAngle;
      arc.endAngle = source.endAngle;
      arc.construction = source.construction;
      arc.sketchId = source.sketchId;
      primitiveById.set(arc.id, arc);
      return arc;
    });
    const constraints = draft.constraints.map((constraint) => cloneConstraintForBlock(constraint, pointById, lineById, primitiveById, { x: 0, y: 0 }, true));
    target.name = draft.name;
    target.origin = { ...draft.origin };
    target.sketches = draft.sketches.map((sketch) => ({ ...sketch }));
    target.activeSketchId = draft.activeSketchId;
    target.points = points;
    target.lines = lines;
    target.circles = circles;
    target.arcs = arcs;
    target.constraints = constraints;
    target.revision = (Number(target.revision) || 0) + 1;
    return target;
  }

  function restoreBlockEditorHost(session) {
    const { original } = session;
    model.points = original.points;
    model.lines = original.lines;
    model.circles = original.circles;
    model.arcs = original.arcs;
    model.constraints = original.constraints;
    model.blockInstances = original.blockInstances;
    model.sketches = original.sketches;
    model.activeSketchId = original.activeSketchId;
    model.appMode = original.appMode;
    Object.assign(viewport, original.viewport);
    blockEditSession = null;
    document.body.classList.remove("block-editing");
  }

  function completeBlockDefinitionEdit() {
    if (!blockEditSession) return;
    const session = blockEditSession;
    const { draft, sourceDefinition, originalElementIds, creationSelection } = session;
    draft.points = model.points;
    draft.lines = model.lines;
    draft.circles = model.circles;
    draft.arcs = model.arcs;
    draft.constraints = model.constraints;
    draft.sketches = model.sketches.map((sketch) => ({ ...sketch }));
    draft.activeSketchId = activeSketchId();
    const validation = validateBlockDraft(draft);
    if (!validation.success) {
      setHint(validation.reason, "error");
      draw();
      return;
    }
    if (session.isNew && !creationSelection) {
      const center = blockLocalGeometryBounds(draft, blockDefinitionDrawableSketchIds(draft))?.center || { x: 0, y: 0 };
      translateBlockDefinition(draft, -center.x, -center.y);
      draft.origin = { x: 0, y: 0 };
    }
    if (sourceDefinition) {
      for (const instance of session.original.blockInstances.filter((item) => item.definitionId === sourceDefinition.id)) {
        const remaining = instance.enabledSketchIds.filter((id) => blockDefinitionGeometrySketchIds(draft).includes(id));
        if (remaining.length === 0) {
          setHint(`${instance.id} の有効スケッチが空になるため編集を完了できません`, "error");
          return;
        }
      }
    }
    restoreBlockEditorHost(session);
    let definition = draft;
    let createdInstance = null;
    if (sourceDefinition) {
      definition = mergeBlockDefinitionDraft(sourceDefinition, draft);
      for (const instance of model.blockInstances.filter((item) => item.definitionId === definition.id)) {
        instance.enabledSketchIds = instance.enabledSketchIds.filter((id) => blockDefinitionGeometrySketchIds(definition).includes(id));
      }
    } else {
      definition.revision = 1;
      model.blockDefinitions.push(definition);
      if (creationSelection) {
        const enabledSketchIds = blockDefinitionGeometrySketchIds(definition);
        createdInstance = { id: `BI${blockInstanceSeq++}`, definitionId: definition.id, sketchId: model.activeSketchId, x: session.replacementCenter.x, y: session.replacementCenter.y, rotation: 0, fixed: false, enabledSketchIds };
        model.blockInstances.push(createdInstance);
        for (const sheet of model.presentationSheets) {
          for (const source of [...creationSelection.points, ...creationSelection.lines, ...creationSelection.circles, ...creationSelection.arcs]) {
            const oldKey = presentationElementKey(source);
            const style = sheet.elementStyles?.[oldKey];
            if (!style) continue;
            const projectedKind = source instanceof Point ? "point" : source instanceof Line ? "line" : source instanceof Circle ? "circle" : "arc";
            sheet.elementStyles[`${projectedKind}:${createdInstance.id}@${source.id}`] = { ...style };
            delete sheet.elementStyles[oldKey];
          }
        }
        model.constraints = model.constraints.filter((constraint) => !creationSelection.constraints.includes(constraint));
        model.lines = model.lines.filter((line) => !creationSelection.lines.includes(line));
        model.circles = model.circles.filter((circle) => !creationSelection.circles.includes(circle));
        model.arcs = model.arcs.filter((arc) => !creationSelection.arcs.includes(arc));
        model.points = model.points.filter((point) => !creationSelection.points.includes(point));
      }
    }
    const currentElementIds = new Set([...definition.points, ...definition.lines, ...definition.circles, ...definition.arcs].map((item) => item.id));
    const removedLocalIds = new Set([...originalElementIds].filter((id) => !currentElementIds.has(id)));
    if (removedLocalIds.size > 0) {
      model.constraints = model.constraints.filter((constraint) => !constraintGraphNodes(constraint).some((node) =>
        node?.blockDefinition === definition && removedLocalIds.has(node.localElement?.id),
      ));
      const removedProjectionIds = new Set();
      const removedProjectionKeys = new Set();
      for (const instance of model.blockInstances.filter((item) => item.definitionId === definition.id)) {
        for (const localId of removedLocalIds) {
          const projectionId = `${instance.id}@${localId}`;
          removedProjectionIds.add(projectionId);
          for (const kind of ["point", "line", "circle", "arc"]) removedProjectionKeys.add(`${kind}:${projectionId}`);
        }
      }
      for (const sheet of model.presentationSheets) {
        for (const key of Object.keys(sheet.elementStyles || {})) if (removedProjectionKeys.has(key)) delete sheet.elementStyles[key];
        sheet.elements = (sheet.elements || []).filter((element) => !valueReferencesRemovedGeometry(element.geometryRefs, removedProjectionIds, removedProjectionKeys));
      }
    }
    invalidateBlockProjectionCache();
    const affectedSketchIds = [...new Set(model.blockInstances.filter((instance) => instance.definitionId === definition.id).map((instance) => instance.sketchId))];
    for (const sketchId of affectedSketchIds) {
      const placementResult = solveSketchById(sketchId);
      if (placementResult.success && placementResult.errorNorm <= CONSTRAINT_ACCEPT_ERROR) setSketchSolveOk(sketchId, placementResult, definition.id);
      else setSketchSolveError(sketchId, placementResult, definition.id);
      solveReferenceDependentSketches(sketchId);
    }
    clearSelection();
    if (createdInstance) selectedBlockInstances = [createdInstance];
    mode = "select";
    setHint(sourceDefinition ? `ブロック定義を更新しました: ${definition.name}` : `ブロックを作成しました: ${definition.name}`);
    updateUI();
    draw();
    recordHistory(sourceDefinition ? "ブロック定義編集" : "ブロック作成");
  }

  function cancelBlockDefinitionEdit() {
    if (!blockEditSession) return;
    const session = blockEditSession;
    restoreBlockEditorHost(session);
    clearSelection();
    mode = "select";
    setHint(session.sourceDefinition ? "ブロック定義編集をキャンセルしました" : "ブロック作成をキャンセルしました");
    updateUI();
    draw();
  }

  function exitBlockDefinitionEdit() {
    completeBlockDefinitionEdit();
  }

  function renameBlockDefinition(definitionId) {
    const definition = blockDefinitionById(definitionId);
    if (!definition) return;
    const name = window.prompt("ブロック名", definition.name);
    if (name == null || !name.trim()) return;
    definition.name = name.trim();
    updateBlockUI();
    recordHistory("ブロック名変更");
  }

  function deleteBlockDefinition(definitionId) {
    const definition = blockDefinitionById(definitionId);
    if (!definition) return;
    const instances = model.blockInstances.filter((instance) => instance.definitionId === definitionId);
    if (instances.length > 0) {
      const sketches = [...new Set(instances.map((instance) => sketchName(instance.sketchId)))].join(", ");
      setHint(`${definition.name} は ${sketches} で ${instances.length}個使用中のため削除できません`, "error");
      return;
    }
    model.blockDefinitions = model.blockDefinitions.filter((item) => item !== definition);
    invalidateBlockProjectionCache();
    updateBlockUI();
    draw();
    recordHistory("ブロック定義削除");
  }

  function offsetDistanceFromPointer(source, pointer) {
    if (source instanceof Line) {
      const signed = signedPointDirectedLineDistance(pointer, source);
      return { distance: Math.abs(signed), sign: signed < 0 ? -1 : 1 };
    }
    const radial = hypot2(pointer.x - source.center.x, pointer.y - source.center.y);
    const signed = radial - source.radius();
    return { distance: Math.abs(signed), sign: signed < 0 ? -1 : 1 };
  }

  function offsetDraftGeometry(source, distance, sign) {
    if (!source || !Number.isFinite(distance) || distance <= 0) return null;
    if (source instanceof Line) {
      const normal = lineNormal(source);
      const dx = normal.x * sign * distance;
      const dy = normal.y * sign * distance;
      const p1 = new Point("OP1", source.p1.x + dx, source.p1.y + dy, false, "endpoint");
      const p2 = new Point("OP2", source.p2.x + dx, source.p2.y + dy, false, "endpoint");
      return new Line("OFFSET", p1, p2, source.construction);
    }
    const radius = source.radius() + sign * distance;
    if (radius < MIN_ORIENTATION_LENGTH) return null;
    const center = new Point("OC", source.center.x, source.center.y, false, "center");
    if (source instanceof Circle) return new Circle("OFFSET", center, radius, source.construction);
    if (source instanceof Arc) return new Arc("OFFSET", center, radius, source.startAngle, source.endAngle, source.construction);
    return null;
  }

  function offsetDimensionTarget(source, offset, distance, sign) {
    return { kind: "offset-distance", source, offset, value: distance, sign };
  }

  function startOffsetDistanceInput(source, pointer) {
    if (!source || !pointer) return false;
    let { distance, sign } = offsetDistanceFromPointer(source, pointer);
    if (distance < MIN_ORIENTATION_LENGTH) distance = Math.max(20 / viewport.scale, MIN_ORIENTATION_LENGTH * 10);
    const offset = offsetDraftGeometry(source, distance, sign);
    if (!offset) {
      setHint("指定した側にはオフセットを作成できません", "error");
      return false;
    }
    const target = offsetDimensionTarget(source, offset, distance, sign);
    pendingCommand = {
      type: "offset-value",
      source,
      sign,
      pointer: { ...pointer },
      target,
      dimension: dimensionWithLabelAt(target, dimensionFromAnchor(target, pointer, { allowPointAxis: false }), pointer),
      buffer: formatDisplayNumber(distance),
      editing: false,
    };
    setHint("オフセット距離を入力してください。Enterまたはダブルクリックで決定します");
    updateToolbar();
    draw();
    focusDimensionValueInput();
    return true;
  }

  function createOffsetGeometry(source, distance, sign, pointer) {
    const state = {
      pointLength: model.points.length,
      lineLength: model.lines.length,
      circleLength: model.circles.length,
      arcLength: model.arcs.length,
      pointSeq,
      lineSeq,
      circleSeq,
      arcSeq,
    };
    let offset = null;
    if (source instanceof Line) {
      const normal = lineNormal(source);
      const dx = normal.x * sign * distance;
      const dy = normal.y * sign * distance;
      const p1 = addPoint(source.p1.x + dx, source.p1.y + dy, false, "endpoint");
      const p2 = addPoint(source.p2.x + dx, source.p2.y + dy, false, "endpoint");
      offset = addLine(p1, p2, source.construction);
    } else {
      const radius = source.radius() + sign * distance;
      if (radius < MIN_ORIENTATION_LENGTH) return false;
      const center = addPoint(source.center.x, source.center.y, false, "center");
      offset = source instanceof Circle
        ? addCircle(center, radius, source.construction)
        : addArc(center, radius, source.startAngle, source.endAngle, source.construction);
    }
    if (!offset) return false;
    const constraint = new OffsetConstraint(source, offset, distance, sign);
    const target = offsetDimensionTarget(source, offset, distance, sign);
    constraint.dimension = dimensionWithLabelAt(target, dimensionFromAnchor(target, pointer, { allowPointAxis: false }), pointer);
    const ok = commitNewConstraint("offset", constraint);
    if (ok) return true;

    model.points.length = state.pointLength;
    model.lines.length = state.lineLength;
    model.circles.length = state.circleLength;
    model.arcs.length = state.arcLength;
    pointSeq = state.pointSeq;
    lineSeq = state.lineSeq;
    circleSeq = state.circleSeq;
    arcSeq = state.arcSeq;
    constraintAnalysisState = null;
    updateUI();
    draw();
    return false;
  }

  function submitOffsetValue() {
    if (pendingCommand?.type !== "offset-value") return false;
    const value = Number(pendingCommand.buffer);
    const { source, sign, pointer } = pendingCommand;
    if (!Number.isFinite(value) || value <= 0 || (!(source instanceof Line) && source.radius() + sign * value < MIN_ORIENTATION_LENGTH)) {
      setHint("作成可能な0より大きいオフセット距離を入力してください", "error");
      draw();
      return false;
    }
    pendingCommand = null;
    hideDimensionValueInput();
    const ok = createOffsetGeometry(source, value, sign, pointer);
    offsetSource = null;
    pointerPreview = null;
    clearSelection();
    updateToolbar();
    if (ok) setHint(`オフセット ${formatDimensionLabel(value)} を作成しました。次の図形を選択してください`);
    draw();
    return ok;
  }

  function snapshotModelState() {
    return {
      points: model.points.map((p) => ({ point: p, x: p.x, y: p.y, fixed: p.fixed })),
      circles: model.circles.map((c) => ({ circle: c, radiusValue: c.radiusValue })),
      arcs: model.arcs.map((a) => ({ arc: a, radiusValue: a.radiusValue, startAngle: a.startAngle, endAngle: a.endAngle })),
      blockInstances: model.blockInstances.map((instance) => ({
        instance,
        x: instance.x,
        y: instance.y,
        rotation: instance.rotation,
        fixed: instance.fixed,
      })),
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
    for (const entry of snapshot.blockInstances || []) {
      entry.instance.x = entry.x;
      entry.instance.y = entry.y;
      entry.instance.rotation = entry.rotation;
      entry.instance.fixed = entry.fixed;
    }
    invalidateBlockProjectionCache();
    model.constraints.length = snapshot.constraintLength;
    constraintAnalysisState = null;
  }

  function resetModelState() {
    model.points.length = 0;
    model.lines.length = 0;
    model.circles.length = 0;
    model.arcs.length = 0;
    model.constraints.length = 0;
    model.blockDefinitions.length = 0;
    model.blockInstances.length = 0;
    invalidateBlockProjectionCache();
    sketchSolveStates.clear();
    invalidReferenceConstraints.clear();
    constraintAnalysisState = null;
    clearSelection();
    dragSession = null;
    dimensionDragSession = null;
    panSession = null;
    suppressNextBlankDoubleClickEvent = false;
    lineStartPoint = null;
    pointStartRollback = null;
    lineCompletionRollback = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    offsetSource = null;
    pendingCommand = null;
    pendingConstraintCommand = null;
    constraintOperands = [];
    constructionLineMode = false;
    hoveredPoint = null;
    hoveredEndpointPoint = null;
    hoveredLine = null;
    hoveredCircle = null;
    hoveredArc = null;
    hoveredArcEndpoint = null;
    hoveredDimensionConstraint = null;
    hoveredSidebarItem = null;
    hoveredSketchIdentity = null;
    lastPointerWorld = null;
    lastMiddleAuxClick = null;
    clearSnap();
    selectedArcEndpoint = null;
    selectedArcEndpointPair = null;
    selectedDimensionConstraint = null;
    selectedConstraint = null;
    selectedBlockInstances = [];
    hoveredBlockInstance = null;
    pointSeq = 1;
    lineSeq = 1;
    circleSeq = 1;
    arcSeq = 1;
    sketchSeq = 2;
    presentationSheetSeq = 2;
    blockDefinitionSeq = 1;
    blockInstanceSeq = 1;
    blockElementSeq = 1;
    blockPlacementDefinitionId = null;
    blockPlacementAnchor = null;
    blockPlacementEnabledSketchIds = [];
    blockEditSession = null;
    model.sketches.length = 0;
    model.sketches.push({ id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", visible: true });
    model.sketches.push({ id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
    model.activeSketchId = DEFAULT_SKETCH_ID;
    model.appMode = "geometry";
    model.presentationSheets = [{ id: DEFAULT_PRESENTATION_SHEET_ID, name: DEFAULT_PRESENTATION_SHEET_NAME, visibleGeometrySketchIds: null, elementStyles: {}, elements: [] }];
    model.activePresentationSheetId = DEFAULT_PRESENTATION_SHEET_ID;
    presentationElementSeq = 1;
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
    if (c instanceof OffsetConstraint) {
      return {
        type: "offsetDimension",
        source: c.source.id,
        offset: c.offset.id,
        target: c.target,
        sign: c.sign,
        directionBasis: c.source instanceof Line ? "endpoint" : "radial",
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
    ensureModelState();
    return {
      version: 8,
      savedAt: new Date().toISOString(),
      appMode: model.appMode,
      sketches: model.sketches.map((sketch) => ({
        id: sketch.id,
        name: sketch.name,
        parentSketchId: sketch.parentSketchId || null,
        kind: isRootSketch(sketch) ? "root" : "sketch",
        visible: isRootSketch(sketch) ? true : sketch.visible !== false,
      })),
      activeSketchId: activeSketchId(),
      presentationSheets: model.presentationSheets.map((sheet) => ({
        id: sheet.id,
        name: sheet.name,
        visibleGeometrySketchIds: Array.isArray(sheet.visibleGeometrySketchIds) ? sheet.visibleGeometrySketchIds.slice() : null,
        elementStyles: normalizePresentationElementStyles(sheet.elementStyles),
        elements: normalizePresentationElements(sheet.elements).map(serializePresentationElement),
      })),
      activePresentationSheetId: activePresentationSheet().id,
      blockDefinitions: model.blockDefinitions.map((definition) => ({
        id: definition.id,
        name: definition.name,
        revision: Number(definition.revision) || 0,
        origin: { x: Number(definition.origin?.x) || 0, y: Number(definition.origin?.y) || 0 },
        sketches: definition.sketches.map((sketch) => ({ id: sketch.id, name: sketch.name, parentSketchId: sketch.parentSketchId || null, kind: sketch.kind === "root" ? "root" : "sketch", visible: sketch.visible !== false })),
        activeSketchId: definition.activeSketchId,
        points: definition.points.map((point) => ({ id: point.id, x: point.x, y: point.y, fixed: point.fixed, kind: point.kind || "endpoint", sketchId: point.sketchId })),
        lines: definition.lines.map((line) => ({ id: line.id, p1: line.p1.id, p2: line.p2.id, construction: Boolean(line.construction), sketchId: line.sketchId })),
        circles: definition.circles.map((circle) => ({ id: circle.id, center: circle.center.id, radius: circle.radius(), construction: Boolean(circle.construction), sketchId: circle.sketchId })),
        arcs: definition.arcs.map((arc) => ({ id: arc.id, center: arc.center.id, radius: arc.radius(), startAngle: arc.startAngle, endAngle: arc.endAngle, construction: Boolean(arc.construction), sketchId: arc.sketchId })),
        constraints: definition.constraints.map((constraint) => {
          const data = decorateSerializedConstraint(serializeConstraint(constraint), constraint);
          if (!data) return null;
          data.sketchId = constraint.sketchId;
          if (constraint.reference) {
            data.reference = true;
            data.referenceSketchId = constraint.referenceSketchId || null;
          }
          return data;
        }).filter(Boolean),
      })),
      blockInstances: model.blockInstances.map((instance) => ({
        id: instance.id,
        definitionId: instance.definitionId,
        sketchId: instance.sketchId,
        x: instance.x,
        y: instance.y,
        rotation: instance.rotation,
        fixed: Boolean(instance.fixed),
        enabledSketchIds: Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.slice() : [],
      })),
      points: model.points.map((p) => ({ id: p.id, x: p.x, y: p.y, fixed: p.fixed, kind: p.kind || (isPointUsedByPrimitive(p) ? "endpoint" : "explicit"), sketchId: elementSketchId(p) })),
      lines: model.lines.map((l) => ({ id: l.id, p1: l.p1.id, p2: l.p2.id, construction: Boolean(l.construction), sketchId: elementSketchId(l) })),
      circles: model.circles.map((c) => ({ id: c.id, center: c.center.id, radius: c.radius(), construction: Boolean(c.construction), sketchId: elementSketchId(c) })),
      arcs: model.arcs.map((a) => ({ id: a.id, center: a.center.id, radius: a.radius(), startAngle: a.startAngle, endAngle: a.endAngle, construction: Boolean(a.construction), sketchId: elementSketchId(a) })),
      constraints: model.constraints
        .map((constraint) => {
          const data = decorateSerializedConstraint(serializeConstraint(constraint), constraint);
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

  function historySnapshot() {
    const data = serializeModel();
    delete data.savedAt;
    return JSON.stringify(data);
  }

  function updateHistoryButtons() {
    const undoBtn = document.getElementById("undoBtn");
    const redoBtn = document.getElementById("redoBtn");
    if (undoBtn) undoBtn.disabled = Boolean(blockEditSession) || undoStack.length <= 1;
    if (redoBtn) redoBtn.disabled = Boolean(blockEditSession) || redoStack.length === 0;
  }

  function resetHistory(label = "initial") {
    undoStack = [historySnapshot()];
    redoStack = [];
    updateHistoryButtons();
    log(`履歴を初期化しました: ${label}`);
  }

  function recordHistory(label = "変更") {
    if (historyRestoring || blockEditSession) return;
    const snapshot = historySnapshot();
    if (undoStack[undoStack.length - 1] === snapshot) {
      updateHistoryButtons();
      return;
    }
    undoStack.push(snapshot);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    updateHistoryButtons();
    log(`履歴に追加しました: ${label}`);
  }

  function restoreHistorySnapshot(snapshot, label) {
    const constructionModeBeforeRestore = constructionLineMode;
    historyRestoring = true;
    try {
      loadModelData(JSON.parse(snapshot));
      constructionLineMode = constructionModeBeforeRestore;
      clearInteractionForSketchChange();
      solveAndRefresh(label);
      setHint(label);
    } finally {
      historyRestoring = false;
      updateHistoryButtons();
    }
  }

  function undoHistory() {
    if (blockEditSession) {
      setHint("ブロックエディタの変更は完了またはキャンセルしてください", "error");
      return false;
    }
    if (undoStack.length <= 1) return false;
    const current = undoStack.pop();
    redoStack.push(current);
    restoreHistorySnapshot(undoStack[undoStack.length - 1], "戻る");
    return true;
  }

  function redoHistory() {
    if (blockEditSession) {
      setHint("ブロックエディタの変更は完了またはキャンセルしてください", "error");
      return false;
    }
    if (redoStack.length === 0) return false;
    const snapshot = redoStack.pop();
    undoStack.push(snapshot);
    restoreHistorySnapshot(snapshot, "進む");
    return true;
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
    } else if (data.type === "offsetDimension") {
      const source = lineById.get(String(data.source)) || primitiveById.get(String(data.source));
      const offset = lineById.get(String(data.offset)) || primitiveById.get(String(data.offset));
      if (!source || !offset) throw new Error(`オフセット対象 ${data.source}/${data.offset} が見つかりません`);
      const savedSign = data.directionBasis === "endpoint" || data.directionBasis === "radial" ? Number(data.sign) || null : null;
      constraint = new OffsetConstraint(source, offset, Number(data.target), savedSign);
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
      constraint.readOnlyDimension = Boolean(data.readOnlyDimension);
      if (constraint.readOnlyDimension) constraint.enabled = false;
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
            visible: sketch.visible !== false,
          }))
        : [{ id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true }];
    let loadedRoot = loadedSketches.find((sketch) => sketch.kind === "root" || sketch.id === ROOT_SKETCH_ID);
    if (!loadedRoot) loadedRoot = { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", visible: true };
    loadedSketches = [loadedRoot, ...loadedSketches.filter((sketch) => sketch !== loadedRoot && sketch.kind !== "root" && sketch.id !== ROOT_SKETCH_ID)];
    loadedRoot.id = ROOT_SKETCH_ID;
    loadedRoot.name = loadedRoot.name || ROOT_SKETCH_NAME;
    loadedRoot.parentSketchId = null;
    loadedRoot.kind = "root";
    loadedRoot.visible = true;
    if (!loadedSketches.some((sketch) => sketch.kind !== "root")) {
      loadedSketches.push({ id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
    }
    const loadedSketchIds = new Set(loadedSketches.map((sketch) => sketch.id));
    for (const sketch of loadedSketches) {
      if (sketch.kind === "root") continue;
      sketch.kind = "sketch";
      sketch.visible = sketch.visible !== false;
      if (sketch.parentSketchId === sketch.id || !loadedSketchIds.has(sketch.parentSketchId)) sketch.parentSketchId = ROOT_SKETCH_ID;
      if (sketch.parentSketchId == null) sketch.parentSketchId = ROOT_SKETCH_ID;
    }
    const fallbackSketchId = loadedSketches.find((sketch) => sketch.kind !== "root")?.id || DEFAULT_SKETCH_ID;
    const normalizeSketchId = (sketchId) => {
      const id = sketchId == null ? fallbackSketchId : String(sketchId);
      if (id === ROOT_SKETCH_ID) return fallbackSketchId;
      return loadedSketchIds.has(id) ? id : fallbackSketchId;
    };

    const loadedBlockDefinitions = [];
    for (const rawDefinition of Array.isArray(data.blockDefinitions) ? data.blockDefinitions : []) {
      let definitionSketches = Array.isArray(rawDefinition.sketches) && rawDefinition.sketches.length > 0
        ? rawDefinition.sketches.map((sketch, index) => ({
            id: String(sketch.id || `S${index + 1}`),
            name: String(sketch.name || sketch.id || `Sketch-${index + 1}`),
            parentSketchId: sketch.parentSketchId == null ? null : String(sketch.parentSketchId),
            kind: sketch.kind === "root" || sketch.id === ROOT_SKETCH_ID ? "root" : "sketch",
            visible: sketch.visible !== false,
          }))
        : [
            { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", visible: true },
            { id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true },
          ];
      let definitionRoot = definitionSketches.find((sketch) => sketch.kind === "root" || sketch.id === ROOT_SKETCH_ID);
      if (!definitionRoot) definitionRoot = { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", visible: true };
      definitionSketches = [definitionRoot, ...definitionSketches.filter((sketch) => sketch !== definitionRoot && sketch.kind !== "root" && sketch.id !== ROOT_SKETCH_ID)];
      definitionRoot.id = ROOT_SKETCH_ID;
      definitionRoot.name = ROOT_SKETCH_NAME;
      definitionRoot.parentSketchId = null;
      definitionRoot.kind = "root";
      definitionRoot.visible = true;
      if (!definitionSketches.some((sketch) => sketch.kind !== "root")) definitionSketches.push({ id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
      const definitionSketchIds = new Set(definitionSketches.map((sketch) => sketch.id));
      const definitionFallbackSketchId = definitionSketches.find((sketch) => sketch.kind !== "root")?.id || DEFAULT_SKETCH_ID;
      for (const sketch of definitionSketches) {
        if (sketch.kind === "root") continue;
        sketch.kind = "sketch";
        sketch.parentSketchId = sketch.parentSketchId == null ? ROOT_SKETCH_ID : String(sketch.parentSketchId);
        if (sketch.parentSketchId === sketch.id || !definitionSketchIds.has(sketch.parentSketchId)) sketch.parentSketchId = ROOT_SKETCH_ID;
      }
      const normalizeDefinitionSketchId = (sketchId) => {
        const id = sketchId == null ? definitionFallbackSketchId : String(sketchId);
        return id !== ROOT_SKETCH_ID && definitionSketchIds.has(id) ? id : definitionFallbackSketchId;
      };
      const pointById = new Map();
      const points = (rawDefinition.points || []).map((rawPoint) => {
        const point = new Point(String(rawPoint.id), Number(rawPoint.x), Number(rawPoint.y), Boolean(rawPoint.fixed), rawPoint.kind === "explicit" ? "explicit" : "endpoint");
        point.sketchId = normalizeDefinitionSketchId(rawPoint.sketchId);
        pointById.set(point.id, point);
        return point;
      });
      const lineById = new Map();
      const lines = (rawDefinition.lines || []).map((rawLine) => {
        const p1 = pointById.get(String(rawLine.p1));
        const p2 = pointById.get(String(rawLine.p2));
        if (!p1 || !p2) throw new Error(`ブロック ${rawDefinition.id} の線端点が見つかりません`);
        const line = new Line(String(rawLine.id), p1, p2, Boolean(rawLine.construction));
        line.sketchId = normalizeDefinitionSketchId(rawLine.sketchId || p1.sketchId || p2.sketchId);
        lineById.set(line.id, line);
        return line;
      });
      const primitiveById = new Map();
      const circles = (rawDefinition.circles || []).map((rawCircle) => {
        const center = pointById.get(String(rawCircle.center));
        if (!center) throw new Error(`ブロック ${rawDefinition.id} の円中心が見つかりません`);
        const circle = new Circle(String(rawCircle.id), center, Number(rawCircle.radius), Boolean(rawCircle.construction));
        circle.sketchId = normalizeDefinitionSketchId(rawCircle.sketchId || center.sketchId);
        primitiveById.set(circle.id, circle);
        return circle;
      });
      const arcs = (rawDefinition.arcs || []).map((rawArc) => {
        const center = pointById.get(String(rawArc.center));
        if (!center) throw new Error(`ブロック ${rawDefinition.id} の円弧中心が見つかりません`);
        const arc = new Arc(String(rawArc.id), center, Number(rawArc.radius), Number(rawArc.startAngle), Number(rawArc.endAngle), Boolean(rawArc.construction));
        arc.sketchId = normalizeDefinitionSketchId(rawArc.sketchId || center.sketchId);
        primitiveById.set(arc.id, arc);
        return arc;
      });
      const constraints = (rawDefinition.constraints || []).map((rawConstraint) => {
        const constraint = deserializeConstraint(rawConstraint, pointById, lineById, primitiveById);
        if (!constraint) return null;
        constraint.sketchId = normalizeDefinitionSketchId(rawConstraint.sketchId || constraintSketchId(constraint));
        constraint.reference = Boolean(rawConstraint.reference);
        constraint.referenceSketchId = rawConstraint.referenceSketchId == null ? null : normalizeDefinitionSketchId(rawConstraint.referenceSketchId);
        return constraint;
      }).filter(Boolean);
      loadedBlockDefinitions.push({
        id: String(rawDefinition.id),
        name: String(rawDefinition.name || rawDefinition.id || "Block"),
        origin: { x: Number(rawDefinition.origin?.x) || 0, y: Number(rawDefinition.origin?.y) || 0 },
        sketches: definitionSketches,
        activeSketchId: normalizeDefinitionSketchId(rawDefinition.activeSketchId),
        points,
        lines,
        circles,
        arcs,
        constraints,
        revision: Number(rawDefinition.revision) || 0,
      });
    }
    const loadedDefinitionIds = new Set(loadedBlockDefinitions.map((definition) => definition.id));
    const loadedBlockInstances = (Array.isArray(data.blockInstances) ? data.blockInstances : [])
      .filter((instance) => loadedDefinitionIds.has(String(instance.definitionId)))
      .map((instance, index) => ({
        id: String(instance.id || `BI${index + 1}`),
        definitionId: String(instance.definitionId),
        sketchId: normalizeSketchId(instance.sketchId),
        x: Number(instance.x) || 0,
        y: Number(instance.y) || 0,
        rotation: Number(instance.rotation) || 0,
        fixed: Boolean(instance.fixed),
        enabledSketchIds: Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.map(String) : null,
      }));
    for (const instance of loadedBlockInstances) {
      const definition = loadedBlockDefinitions.find((item) => item.id === instance.definitionId);
      const drawableIds = blockDefinitionDrawableSketchIds(definition);
      const enabled = Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.filter((id) => drawableIds.includes(id)) : drawableIds;
      instance.enabledSketchIds = enabled.length > 0 ? [...new Set(enabled)] : blockDefinitionGeometrySketchIds(definition);
    }
    let loadedPresentationSheets =
      Array.isArray(data.presentationSheets) && data.presentationSheets.length > 0
        ? data.presentationSheets.map((sheet, index) => ({
            id: String(sheet.id || `PS${index + 1}`),
            name: String(sheet.name || `Sheet-${index + 1}`),
            visibleGeometrySketchIds: Array.isArray(sheet.visibleGeometrySketchIds) ? sheet.visibleGeometrySketchIds.map(normalizeSketchId) : null,
            elementStyles: normalizePresentationElementStyles(sheet.elementStyles),
            elements: normalizePresentationElements(sheet.elements),
          }))
        : [{ id: DEFAULT_PRESENTATION_SHEET_ID, name: DEFAULT_PRESENTATION_SHEET_NAME, visibleGeometrySketchIds: null, elementStyles: {}, elements: [] }];
    const sheetIds = new Set();
    loadedPresentationSheets = loadedPresentationSheets.map((sheet, index) => {
      let id = sheet.id;
      while (sheetIds.has(id)) id = `PS${index + 1}-${sheetIds.size + 1}`;
      sheetIds.add(id);
      return { ...sheet, id, elementStyles: normalizePresentationElementStyles(sheet.elementStyles), elements: normalizePresentationElements(sheet.elements) };
    });

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
      const circle = new Circle(String(c.id), center, radius, Boolean(c.construction));
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
      const arc = new Arc(String(a.id), center, radius, startAngle, endAngle, Boolean(a.construction));
      arc.sketchId = normalizeSketchId(a.sketchId || center.sketchId);
      arcs.push(arc);
    }

    const primitiveById = new Map();
    for (const c of circles) primitiveById.set(c.id, c);
    for (const a of arcs) primitiveById.set(a.id, a);
    for (const instance of loadedBlockInstances) {
      const definition = loadedBlockDefinitions.find((item) => item.id === instance.definitionId);
      const bundle = createBlockProjectionBundle(instance, definition);
      for (const point of bundle.points) pointById.set(point.id, point);
      for (const line of bundle.lines) lineById.set(line.id, line);
      for (const primitive of [...bundle.circles, ...bundle.arcs]) primitiveById.set(primitive.id, primitive);
    }

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
    model.appMode = data.appMode === "presentation" ? "presentation" : "geometry";
    model.presentationSheets = loadedPresentationSheets;
    model.activePresentationSheetId = sheetIds.has(String(data.activePresentationSheetId)) ? String(data.activePresentationSheetId) : loadedPresentationSheets[0].id;
    model.blockDefinitions = loadedBlockDefinitions;
    model.blockInstances = loadedBlockInstances;
    invalidateBlockProjectionCache();
    model.points.push(...retainedPoints);
    model.lines.push(...lines);
    model.circles.push(...circles);
    model.arcs.push(...arcs);
    normalizeArcSweeps(model.arcs);
    model.constraints.push(...constraints);
    refreshReferenceConstraintValidity();
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
    presentationSheetSeq = nextSeq(model.presentationSheets, "PS");
    presentationElementSeq = Math.max(1, ...model.presentationSheets.flatMap((sheet) => (sheet.elements || []).map((element) => Number(/^PE(\d+)$/.exec(element.id || "")?.[1]) + 1 || 1)));
    blockDefinitionSeq = nextSeq(model.blockDefinitions, "B");
    blockInstanceSeq = nextSeq(model.blockInstances, "BI");
    blockElementSeq = Math.max(1, ...model.blockDefinitions.flatMap((definition) => [...definition.points, ...definition.lines, ...definition.circles, ...definition.arcs].map((element) => Number(/^[PLCA](\d+)$/.exec(element.id || "")?.[1]) + 1 || 1)));
    ensurePresentationState();
    ensureBlockState();
  }

  function exportFileData() {
    if (blockEditSession) {
      setHint("ブロック定義編集を終了してから保存してください", "error");
      return;
    }
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
    if (blockEditSession) {
      setHint("ブロック定義編集を終了してから読み込んでください", "error");
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        loadModelData(JSON.parse(String(reader.result)));
        solveAndRefresh("ファイル読み込み");
        fitAllGeometryToViewport();
        draw();
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
    selectedBlockInstances = [];
    selectedArcEndpoint = null;
    selectedArcEndpointPair = null;
    selectedDimensionConstraint = null;
    selectedConstraint = null;
    constraintOperands = [];
    hoveredSketchIdentity = null;
    hoveredBlockInstance = null;
    hoveredSidebarItem = null;
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
    offsetSource = null;
    clearSnap();
    mode = "select";
    updateToolbar();
    setHint("連続線を終了しました");
    updateUI();
    draw();
  }

  function exitDrawMode() {
    lineStartPoint = null;
    pointStartRollback = null;
    lineCompletionRollback = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    trimPreview = null;
    offsetSource = null;
    clearSnap();
    mode = "select";
    updateToolbar();
    setHint("選択・ドラッグモードに戻りました");
    updateUI();
    draw();
  }

  function hasActiveDrawOperation() {
    return Boolean(lineStartPoint || rectangleStartPoint || filletFirstLine || circleCenterPoint || arcCenterPoint || arcStartPoint || offsetSource);
  }

  function beginTransientLineStartRollback() {
    lineStartRollback = {
      pointLength: model.points.length,
      constraintLength: model.constraints.length,
      pointSeq,
      lineLength: model.lines.length,
    };
  }

  function clearTransientLineStartRollback() {
    lineStartRollback = null;
  }

  function beginTransientLineCompletionRollback() {
    lineCompletionRollback = {
      pointLength: model.points.length,
      constraintLength: model.constraints.length,
      lineLength: model.lines.length,
      pointSeq,
      lineSeq,
      completedEndpoint: null,
      completedLine: null,
      startRollback: lineStartRollback ? { ...lineStartRollback } : null,
      createdAt: performance.now(),
    };
  }

  function clearTransientLineCompletionRollback() {
    lineCompletionRollback = null;
  }

  function rollbackTransientLineCompletion() {
    if (!lineCompletionRollback) return false;
    const transientSnapshot = historySnapshot();
    const target = lineCompletionRollback.startRollback || lineCompletionRollback;
    model.points.length = target.pointLength;
    model.lines.length = target.lineLength ?? lineCompletionRollback.lineLength;
    model.constraints.length = target.constraintLength;
    pointSeq = target.pointSeq;
    lineSeq = lineCompletionRollback.lineSeq;
    constraintAnalysisState = null;
    lineCompletionRollback = null;
    lineStartRollback = null;
    if (!historyRestoring && undoStack.length > 1 && undoStack[undoStack.length - 1] === transientSnapshot) {
      undoStack.pop();
      redoStack = [];
      updateHistoryButtons();
    }
    return true;
  }

  function beginTransientPointRollback() {
    pointStartRollback = {
      pointLength: model.points.length,
      constraintLength: model.constraints.length,
      pointSeq,
      createdPoint: null,
      createdAt: performance.now(),
    };
  }

  function clearTransientPointRollback() {
    pointStartRollback = null;
  }

  function rollbackTransientPoint() {
    if (!pointStartRollback) return false;
    const transientSnapshot = historySnapshot();
    model.points.length = pointStartRollback.pointLength;
    model.constraints.length = pointStartRollback.constraintLength;
    pointSeq = pointStartRollback.pointSeq;
    constraintAnalysisState = null;
    pointStartRollback = null;
    if (!historyRestoring && undoStack.length > 1 && undoStack[undoStack.length - 1] === transientSnapshot) {
      undoStack.pop();
      redoStack = [];
      updateHistoryButtons();
    }
    return true;
  }

  function rollbackTransientLineStart() {
    if (!lineStartRollback) return false;
    if (model.lines.length === lineStartRollback.lineLength) {
      model.points.length = lineStartRollback.pointLength;
      model.constraints.length = lineStartRollback.constraintLength;
      pointSeq = lineStartRollback.pointSeq;
      constraintAnalysisState = null;
    }
    lineStartRollback = null;
    return true;
  }

  function cancelActiveDrawOperation() {
    rollbackTransientLineStart();
    clearTransientPointRollback();
    clearTransientLineCompletionRollback();
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    trimPreview = null;
    offsetSource = null;
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
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
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
    if (percent >= 100) return `${percent.toFixed(0)}%`;
    if (percent >= 1) return `${percent.toFixed(1)}%`;
    return `${percent.toFixed(2)}%`;
  }

  function formatDisplayNumber(value, maxFractionDigits = 10, snapTolerance = DIMENSION_DISPLAY_PRECISION) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    const displayDigits = Math.max(0, Math.min(10, maxFractionDigits));
    const floatingPointSlack = Number.EPSILON * Math.max(1, Math.abs(n)) * 8;
    const effectiveSnapTolerance = Math.max(0, snapTolerance) + floatingPointSlack;
    let rounded = Number(n.toFixed(displayDigits));
    let roundedDigits = displayDigits;
    for (let digits = 0; digits <= displayDigits; digits += 1) {
      const candidate = Number(n.toFixed(digits));
      if (candidate === 0 && n !== 0) continue;
      if (Math.abs(n - candidate) <= effectiveSnapTolerance) {
        rounded = candidate;
        roundedDigits = digits;
        break;
      }
    }
    if (Object.is(rounded, -0)) return "0";
    const formatted = rounded.toFixed(roundedDigits);
    if (!formatted.includes(".")) return formatted;
    return formatted.replace(/0+$/, "").replace(/\.$/, "");
  }

  function formatDimensionLabel(value, suffix = "") {
    return `${formatDisplayNumber(value)}${suffix}`;
  }

  function formatMeasuredDimensionLabel(value, suffix = "") {
    return `${formatDisplayNumber(value, 10, MEASURED_DIMENSION_SNAP_TOLERANCE)}${suffix}`;
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

  function mergeBounds(bounds, box) {
    if (!box) return bounds;
    const x1 = box.x1 ?? box.left;
    const y1 = box.y1 ?? box.top;
    const x2 = box.x2 ?? box.right;
    const y2 = box.y2 ?? box.bottom;
    if (![x1, y1, x2, y2].every(Number.isFinite)) return bounds;
    if (!bounds) return { x1, y1, x2, y2 };
    return {
      x1: Math.min(bounds.x1, x1),
      y1: Math.min(bounds.y1, y1),
      x2: Math.max(bounds.x2, x2),
      y2: Math.max(bounds.y2, y2),
    };
  }

  function sketchGeometryBounds(sketchId = activeSketchId()) {
    let bounds = null;
    for (const line of allGeometryLines()) {
      if (elementSketchId(line) === sketchId) bounds = mergeBounds(bounds, lineBBox(line));
    }
    for (const circle of allGeometryCircles()) {
      if (elementSketchId(circle) === sketchId) bounds = mergeBounds(bounds, primitiveBBox(circle));
    }
    for (const arc of allGeometryArcs()) {
      if (elementSketchId(arc) === sketchId) bounds = mergeBounds(bounds, primitiveBBox(arc));
    }
    for (const point of allGeometryPoints()) {
      if (elementSketchId(point) === sketchId) bounds = mergeBounds(bounds, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
    }
    return bounds;
  }

  function allGeometryBounds() {
    let bounds = null;
    for (const line of allGeometryLines()) bounds = mergeBounds(bounds, lineBBox(line));
    for (const circle of allGeometryCircles()) bounds = mergeBounds(bounds, primitiveBBox(circle));
    for (const arc of allGeometryArcs()) bounds = mergeBounds(bounds, primitiveBBox(arc));
    for (const point of allGeometryPoints()) bounds = mergeBounds(bounds, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
    return bounds;
  }

  function isVisibleOnCanvasGeometry(item) {
    if (!isVisibleSketchElement(item)) return false;
    return !isPresentationMode() || presentationStyleForElement(item).visible !== false;
  }

  function visibleGeometryBounds() {
    let bounds = null;
    for (const line of allGeometryLines()) {
      if (isVisibleOnCanvasGeometry(line)) bounds = mergeBounds(bounds, lineBBox(line));
    }
    for (const circle of allGeometryCircles()) {
      if (isVisibleOnCanvasGeometry(circle)) bounds = mergeBounds(bounds, primitiveBBox(circle));
    }
    for (const arc of allGeometryArcs()) {
      if (isVisibleOnCanvasGeometry(arc)) bounds = mergeBounds(bounds, primitiveBBox(arc));
    }
    for (const point of allGeometryPoints()) {
      if (isVisibleOnCanvasGeometry(point)) bounds = mergeBounds(bounds, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
    }
    return bounds;
  }

  function fitBoundsToViewport(bounds, paddingPx = 96) {
    if (!bounds) return false;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const width = Math.max(bounds.x2 - bounds.x1, MIN_LINE_LENGTH);
    const height = Math.max(bounds.y2 - bounds.y1, MIN_LINE_LENGTH);
    const availableWidth = Math.max(80, rect.width - paddingPx * 2);
    const availableHeight = Math.max(80, rect.height - paddingPx * 2);
    const nextScale = clampZoom(Math.min(availableWidth / width, availableHeight / height));
    const centerX = (bounds.x1 + bounds.x2) / 2;
    const centerY = (bounds.y1 + bounds.y2) / 2;
    viewport.scale = nextScale;
    viewport.x = rect.width / 2 - centerX * viewport.scale;
    viewport.y = rect.height / 2 - centerY * viewport.scale;
    return true;
  }

  function fitSketchToViewport(sketchId = activeSketchId(), paddingPx = 96) {
    return fitBoundsToViewport(sketchGeometryBounds(sketchId), paddingPx);
  }

  function fitAllGeometryToViewport(paddingPx = 96) {
    return fitBoundsToViewport(allGeometryBounds(), paddingPx);
  }

  function fitVisibleGeometryToViewport(paddingPx = 96) {
    return fitBoundsToViewport(visibleGeometryBounds(), paddingPx);
  }

  function screenBoxForBounds(bounds) {
    if (!bounds) return null;
    const p1 = worldToCanvasScreen({ x: bounds.x1, y: bounds.y1 });
    const p2 = worldToCanvasScreen({ x: bounds.x2, y: bounds.y2 });
    return {
      left: Math.min(p1.x, p2.x),
      right: Math.max(p1.x, p2.x),
      top: Math.min(p1.y, p2.y),
      bottom: Math.max(p1.y, p2.y),
    };
  }

  function captureSketchScreenFootprint(sketchId = activeSketchId()) {
    const bounds = sketchGeometryBounds(sketchId);
    const screenBox = screenBoxForBounds(bounds);
    if (!bounds || !screenBox) return null;
    return {
      bounds,
      screenBox,
      center: {
        x: (screenBox.left + screenBox.right) / 2,
        y: (screenBox.top + screenBox.bottom) / 2,
      },
      width: Math.max(screenBox.right - screenBox.left, 1),
      height: Math.max(screenBox.bottom - screenBox.top, 1),
    };
  }

  function restoreSketchScreenFootprint(sketchId, footprint) {
    if (!footprint) return false;
    const bounds = sketchGeometryBounds(sketchId);
    if (!bounds) return false;
    const worldWidth = bounds.x2 - bounds.x1;
    const worldHeight = bounds.y2 - bounds.y1;
    const scaleCandidates = [];
    if (worldWidth > MIN_LINE_LENGTH) scaleCandidates.push(footprint.width / worldWidth);
    if (worldHeight > MIN_LINE_LENGTH) scaleCandidates.push(footprint.height / worldHeight);
    if (scaleCandidates.length === 0) return false;
    const nextScale = clampZoom(Math.min(...scaleCandidates));
    const centerX = (bounds.x1 + bounds.x2) / 2;
    const centerY = (bounds.y1 + bounds.y2) / 2;
    viewport.scale = nextScale;
    viewport.x = footprint.center.x - centerX * viewport.scale;
    viewport.y = footprint.center.y - centerY * viewport.scale;
    return true;
  }

  function scalePointAbout(point, origin, scale) {
    point.x = origin.x + (point.x - origin.x) * scale;
    point.y = origin.y + (point.y - origin.y) * scale;
  }

  function scaleValueAbout(value, originValue, scale) {
    return originValue + (value - originValue) * scale;
  }

  function scaleDimensionAbout(dimension, origin, scale) {
    if (!dimension) return dimension;
    for (const key of ["x", "labelX"]) {
      if (Number.isFinite(dimension[key])) dimension[key] = scaleValueAbout(dimension[key], origin.x, scale);
    }
    for (const key of ["y", "labelY"]) {
      if (Number.isFinite(dimension[key])) dimension[key] = scaleValueAbout(dimension[key], origin.y, scale);
    }
    for (const key of ["offsetU", "offsetN", "labelOffsetU", "angleRadius"]) {
      if (Number.isFinite(dimension[key])) dimension[key] *= scale;
    }
    return dimension;
  }

  function currentTargetValue(target) {
    if (!target) return NaN;
    if (target.kind === "point-point") {
      if (target.dimensionAxis === "x") return Math.abs(target.p2.x - target.p1.x);
      if (target.dimensionAxis === "y") return Math.abs(target.p2.y - target.p1.y);
      return hypot2(target.p2.x - target.p1.x, target.p2.y - target.p1.y);
    }
    if (target.kind === "line-length") return target.line.length();
    if (target.kind === "point-line") return Math.abs(signedPointLineDistance(target.point, target.line));
    if (target.kind === "line-line") return Math.abs(signedPointLineDistance(target.line1.p1, target.line2));
    if (target.kind === "radius") return target.primitive.radius();
    if (target.kind === "diameter") return target.primitive.radius() * 2;
    if (target.kind === "offset-distance") {
      if (target.source instanceof Line) return Math.abs(signedPointLineDistance(target.offset.p1, target.source));
      return Math.abs(target.offset.radius() - target.source.radius());
    }
    return target.value;
  }

  function sketchHasReferenceConstraint(sketchId = activeSketchId()) {
    return model.constraints.some((constraint) => constraintSketchId(constraint) === sketchId && constraint.reference);
  }

  function sketchHasFixedGeometry(sketchId = activeSketchId()) {
    if (model.points.some((point) => elementSketchId(point) === sketchId && point.fixed)) return true;
    return model.constraints.some((constraint) => constraintSketchId(constraint) === sketchId && constraint instanceof LineFixedConstraint);
  }

  function scaleSketchForFirstDimension(sketchId, target, targetValue, dimension) {
    if (!sketchId || target?.kind === "angle" || sketchHasReferenceConstraint(sketchId) || sketchHasFixedGeometry(sketchId)) return false;
    const current = currentTargetValue(target);
    if (!Number.isFinite(current) || current <= MIN_LINE_LENGTH || !Number.isFinite(targetValue) || targetValue <= 0) return false;
    const scale = targetValue / current;
    if (!Number.isFinite(scale) || scale <= 0 || Math.abs(scale - 1) < 1e-9) return false;
    const bounds = sketchGeometryBounds(sketchId);
    if (!bounds) return false;
    const origin = { x: (bounds.x1 + bounds.x2) / 2, y: (bounds.y1 + bounds.y2) / 2 };
    for (const point of model.points) {
      if (elementSketchId(point) === sketchId) scalePointAbout(point, origin, scale);
    }
    for (const circle of model.circles) {
      if (elementSketchId(circle) === sketchId) circle.radiusValue = Math.max(MIN_LINE_LENGTH, circle.radiusValue * scale);
    }
    for (const arc of model.arcs) {
      if (elementSketchId(arc) === sketchId) arc.radiusValue = Math.max(MIN_LINE_LENGTH, arc.radiusValue * scale);
    }
    scaleDimensionAbout(dimension, origin, scale);
    return true;
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
    for (const p of allGeometryPoints()) {
      if (!isVisibleSketchElement(p)) continue;
      if (p.blockProjection) addSnapCandidate(candidates, source, p.x, p.y, "ブロック点", 0, { point: p });
      else if (isReferencePoint(p)) addSnapCandidate(candidates, source, p.x, p.y, "参照点", 0, { point: p });
      else if (isPrimitiveCenterPoint(p)) addSnapCandidate(candidates, source, p.x, p.y, "中心", 0, { point: p });
      else if (isEndpointPoint(p) && isPointUsedByPrimitive(p)) addSnapCandidate(candidates, source, p.x, p.y, "端点", 0, { point: p });
      else if (isExplicitPoint(p)) addSnapCandidate(candidates, source, p.x, p.y, "点", 0, { point: p });
    }
    for (const line of allGeometryLines()) {
      if (!isVisibleSketchElement(line)) continue;
      addSnapCandidate(candidates, source, (line.p1.x + line.p2.x) / 2, (line.p1.y + line.p2.y) / 2, "中点", 1, { line });
      const closest = closestPointOnSegment(source.x, source.y, line);
      addSnapCandidate(candidates, source, closest.x, closest.y, "線上", 2, { line });
    }
    for (const circle of allGeometryCircles()) {
      if (!isVisibleSketchElement(circle)) continue;
      addSnapCandidate(candidates, source, circle.center.x, circle.center.y, "中心", 0, { primitive: circle });
      const p = circlePointAtPointer(source, circle);
      if (p) addSnapCandidate(candidates, source, p.x, p.y, "円周", 2, { primitive: circle });
    }
    for (const arc of allGeometryArcs()) {
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
    const sketchId = options.sketchId || activeSketchId();
    if (options.referenceSketchId) {
      if (!isReferenceSourceSketchId(options.referenceSketchId, sketchId) || wouldCreateReferenceCycle(sketchId, options.referenceSketchId)) return false;
      markReferenceConstraint(constraint, options.referenceSketchId, sketchId);
    }
    pushModelConstraint(constraint, sketchId);
    const duplicate = redundantConstraintInfo(constraint, constraintSketchId(constraint));
    if (duplicate?.redundant) {
      model.constraints = model.constraints.filter((item) => item !== constraint);
      constraintRedundancyState.constraints.delete(constraint);
      return false;
    }
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
    return isReferenceSourceSketchId(sketchId) ? sketchId : null;
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

  function lineSupportNormal(line) {
    if (line.orientationHint === "horizontal") return { x: 0, y: 1 };
    if (line.orientationHint === "vertical") return { x: -1, y: 0 };
    return lineNormal(line);
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

  function hitBlockInstance(x, y, editableOnly = true) {
    const threshold = 8 / viewport.scale;
    for (let i = model.blockInstances.length - 1; i >= 0; i--) {
      const instance = model.blockInstances[i];
      if (editableOnly && !isEditableSketchId(instance.sketchId)) continue;
      if (!isVisibleSketchId(instance.sketchId)) continue;
      const bundle = blockProjectionBundle(instance);
      if (bundle.points.some((point) => hypot2(point.x - x, point.y - y) <= threshold)) return instance;
      if (bundle.lines.some((line) => distancePointToSegment(x, y, line) <= threshold)) return instance;
      if (bundle.circles.some((circle) => Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold)) return instance;
      if (bundle.arcs.some((arc) => Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(Math.atan2(y - arc.center.y, x - arc.center.x), arc.startAngle, arc.endAngle))) return instance;
    }
    return null;
  }

  function blockRotationHandlePoint(instance) {
    const bundle = blockProjectionBundle(instance);
    const center = blockInstanceDisplayCenter(instance);
    const points = bundle.points.length > 0 ? bundle.points : [center];
    const maxRadius = Math.max(30 / viewport.scale, ...points.map((point) => hypot2(point.x - center.x, point.y - center.y)));
    return {
      x: center.x + Math.cos(instance.rotation) * (maxRadius + 28 / viewport.scale),
      y: center.y + Math.sin(instance.rotation) * (maxRadius + 28 / viewport.scale),
    };
  }

  function hitBlockRotationHandle(x, y) {
    const threshold = 10 / viewport.scale;
    for (const instance of selectedBlockInstances) {
      const handle = blockRotationHandlePoint(instance);
      const center = blockInstanceDisplayCenter(instance);
      if (hypot2(handle.x - x, handle.y - y) <= threshold) return instance;
    }
    return null;
  }

  function hitBlockProjectionOperand(x, y) {
    const threshold = 8 / viewport.scale;
    const pointThreshold = 10 / viewport.scale;
    for (const bundle of blockProjectionBundles().slice().reverse()) {
      if (!isVisibleSketchId(bundle.instance.sketchId)) continue;
      const relation = operandRelationForSketch(bundle.instance.sketchId);
      if (!relation) continue;
      for (const point of bundle.points.slice().reverse()) {
        if (hypot2(point.x - x, point.y - y) <= pointThreshold) return makeConstraintOperand("point", { point });
      }
      for (const line of bundle.lines.slice().reverse()) {
        if (distancePointToSegment(x, y, line) <= threshold) return makeConstraintOperand("line", { line });
      }
      for (const circle of bundle.circles.slice().reverse()) {
        if (Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold) return makeConstraintOperand("primitive", { primitive: circle });
      }
      for (const arc of bundle.arcs.slice().reverse()) {
        for (const endpoint of ["start", "end"]) {
          const point = arcEndpointPoint(arc, endpoint);
          if (hypot2(point.x - x, point.y - y) <= pointThreshold) return makeConstraintOperand("arc-endpoint", { arc, endpoint });
        }
        const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
        if (Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return makeConstraintOperand("primitive", { primitive: arc });
      }
    }
    return null;
  }

  function distanceTargetFromOperands(operands) {
    const points = operands.filter((operand) => operand.kind === "point").map((operand) => operand.point);
    const lines = operands.filter((operand) => operand.kind === "line").map((operand) => operand.line);
    const primitives = operands.filter((operand) => operand.kind === "primitive").map((operand) => operand.primitive);
    if (points.length === 0 && lines.length === 0 && primitives.length === 1) {
      const [primitive] = primitives;
      if (primitive instanceof Circle) return { kind: "diameter", primitive, value: primitive.radius() * 2 };
      return { kind: "radius", primitive, value: primitive.radius() };
    }
    if (points.length === 2 && lines.length === 0 && primitives.length === 0) {
      const [p1, p2] = points;
      return { kind: "point-point", p1, p2, value: hypot2(p2.x - p1.x, p2.y - p1.y) };
    }
    if (points.length === 0 && lines.length === 1 && primitives.length === 0) {
      const [line] = lines;
      return { kind: "line-length", line, p1: line.p1, p2: line.p2, value: line.length() };
    }
    if (points.length === 1 && lines.length === 1 && primitives.length === 0) {
      const [point] = points;
      const [line] = lines;
      if (!lineHasDirection(line)) return { kind: "invalid", reason: "寸法対象の線が短すぎます" };
      return { kind: "point-line", point, line, value: Math.abs(signedPointLineDistance(point, line)) };
    }
    if (points.length === 0 && lines.length === 2 && primitives.length === 0) {
      const [line1, line2] = lines;
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
    if (target.kind === "offset-distance") {
      if (target.source instanceof Line && target.offset instanceof Line) {
        const dx = target.offset.p1.x - target.source.p1.x;
        const dy = target.offset.p1.y - target.source.p1.y;
        const len = hypot2(dx, dy);
        if (len > 1e-12) return { x: dx / len, y: dy / len };
        const normal = lineNormal(target.source);
        return { x: normal.x * (target.sign || 1), y: normal.y * (target.sign || 1) };
      }
      const defaultAngle = target.source instanceof Arc ? (target.source.startAngle + target.source.endAngle) / 2 : 0;
      const anchor = target.dimensionAnchor || circlePointAtAngle(target.offset, defaultAngle);
      const dx = anchor.x - target.source.center.x;
      const dy = anchor.y - target.source.center.y;
      const len = hypot2(dx, dy);
      if (len > 1e-12) return { x: dx / len, y: dy / len };
      return { x: 1, y: 0 };
    }
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
    if (target.kind === "offset-distance") {
      if (target.source instanceof Line && target.offset instanceof Line) {
        const guide = anchor || {
          x: (target.source.p1.x + target.source.p2.x + target.offset.p1.x + target.offset.p2.x) / 4,
          y: (target.source.p1.y + target.source.p2.y + target.offset.p1.y + target.offset.p2.y) / 4,
        };
        const sourcePoint = projectPointToLine(guide, target.source);
        const offsetPoint = projectPointToLine(guide, target.offset);
        return [sourcePoint, offsetPoint];
      }
      const dir = targetDirection({ ...target, dimensionAnchor: anchor || target.dimensionAnchor });
      return [
        {
          x: target.source.center.x + dir.x * target.source.radius(),
          y: target.source.center.y + dir.y * target.source.radius(),
        },
        {
          x: target.offset.center.x + dir.x * target.offset.radius(),
          y: target.offset.center.y + dir.y * target.offset.radius(),
        },
      ];
    }
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
    const radial = target.kind === "radius" || target.kind === "diameter" || (target.kind === "offset-distance" && !(target.source instanceof Line));
    const d = radial ? targetDirection({ ...basisTarget, dimensionAnchor: anchor }) : targetDirection(basisTarget);
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
    if (target.kind === "radius" || target.kind === "diameter" || (target.kind === "offset-distance" && !(target.source instanceof Line))) {
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
    if (c instanceof OffsetConstraint) return { kind: "offset-distance", source: c.source, offset: c.offset, value: c.target, sign: c.sign };
    if (c instanceof LineAngleConstraint) return { kind: "angle", line1: c.line1, line2: c.line2, value: angleDegrees(c.target), signedValue: angleDimensionSweep({ line1: c.line1, line2: c.line2 }) };
    if (c instanceof RadiusConstraint) return { kind: "radius", primitive: c.primitive, value: c.target };
    if (c instanceof DiameterConstraint) return { kind: "diameter", primitive: c.primitive, value: c.target };
    return null;
  }

  function isDimensionConstraint(constraint) {
    return (
      constraint instanceof DistanceConstraint ||
      constraint instanceof PointAxisDistanceConstraint ||
      constraint instanceof PointLineDistanceConstraint ||
      constraint instanceof LineLineDistanceConstraint ||
      constraint instanceof OffsetConstraint ||
      constraint instanceof LineAngleConstraint ||
      constraint instanceof RadiusConstraint ||
      constraint instanceof DiameterConstraint
    );
  }

  function isReadOnlyDimension(constraint) {
    return Boolean(constraint?.readOnlyDimension);
  }

  function measuredDimensionValue(target, dimension = null) {
    if (!target) return NaN;
    if (target.kind === "angle") {
      return angleDegrees(angleDimensionAngles(target, null, dimension).signed);
    }
    return presentationTargetValue(target);
  }

  function measuredConstraintTargetValue(constraint, target = targetFromConstraint(constraint), dimension = constraint?.dimension) {
    if (!target) return NaN;
    const measured = measuredDimensionValue(target, dimension);
    return target.kind === "angle" ? (measured * Math.PI) / 180 : measured;
  }

  function dimensionLabelForConstraint(constraint, target, dimension) {
    const readOnly = isReadOnlyDimension(constraint);
    const value = readOnly ? measuredDimensionValue(target, dimension) : target.kind === "angle" ? angleDegrees(constraint.target) : constraint.target;
    const formatLabel = readOnly ? formatMeasuredDimensionLabel : formatDimensionLabel;
    const label = target.kind === "angle" ? formatLabel(value, "°") : formatLabel(value);
    return isReadOnlyDimension(constraint) ? `(${label})` : label;
  }

  function constraintReferencesPoint(c, point) {
    if (c instanceof DistanceConstraint || c instanceof PointAxisDistanceConstraint) return c.p1 === point || c.p2 === point;
    if (c instanceof PointLineDistanceConstraint) return c.point === point || c.line.p1 === point || c.line.p2 === point;
    if (c instanceof LineLineDistanceConstraint) return c.line1.p1 === point || c.line1.p2 === point || c.line2.p1 === point || c.line2.p2 === point;
    if (c instanceof OffsetConstraint) {
      if (c.source instanceof Line && c.offset instanceof Line) {
        return c.source.p1 === point || c.source.p2 === point || c.offset.p1 === point || c.offset.p2 === point;
      }
      return c.source.center === point || c.offset.center === point;
    }
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
    if (c instanceof OffsetConstraint) return c.source === line || c.offset === line;
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
    if (c instanceof OffsetConstraint) return c.source === primitive || c.offset === primitive;
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
    for (const node of [...nodes]) {
      if (node?.blockInstance) addNode(nodes, node.blockInstance);
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
    for (const p of allGeometryPoints()) {
      if (!adjacency.has(p)) adjacency.set(p, new Set());
      if (p.blockInstance) addIntrinsicGraphEdges(adjacency, p, p.blockInstance);
    }
    for (const line of allGeometryLines()) {
      addIntrinsicGraphEdges(adjacency, line, line.p1);
      addIntrinsicGraphEdges(adjacency, line, line.p2);
      if (line.blockInstance) addIntrinsicGraphEdges(adjacency, line, line.blockInstance);
    }
    for (const circle of allGeometryCircles()) {
      addIntrinsicGraphEdges(adjacency, circle, circle.center);
      if (circle.blockInstance) addIntrinsicGraphEdges(adjacency, circle, circle.blockInstance);
    }
    for (const arc of allGeometryArcs()) {
      addIntrinsicGraphEdges(adjacency, arc, arc.center);
      if (arc.blockInstance) addIntrinsicGraphEdges(adjacency, arc, arc.blockInstance);
    }

    for (const constraint of model.constraints) {
      if (!constraintIsOperational(constraint)) continue;
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
    for (const instance of model.blockInstances) {
      if (!component.has(instance) || instance.sketchId !== sketchId || instance.fixed) continue;
      vars.push({ object: instance, prop: "x", label: `${instance.id}.x` });
      vars.push({ object: instance, prop: "y", label: `${instance.id}.y` });
      vars.push({ object: instance, prop: "rotation", label: `${instance.id}.rotation` });
    }
    return vars;
  }

  function localSolveConstraints(component, sketchId = activeSketchId()) {
    return model.constraints.filter((constraint) => constraintIsOperational(constraint) && constraintSketchId(constraint) === sketchId && constraintGraphNodes(constraint).some((node) => component.has(node)));
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
    for (const instance of model.blockInstances) {
      if (instance.sketchId !== sketchId || instance.fixed) continue;
      vars.push({ object: instance, prop: "x", label: `${instance.id}.x` });
      vars.push({ object: instance, prop: "y", label: `${instance.id}.y` });
      vars.push({ object: instance, prop: "rotation", label: `${instance.id}.rotation` });
    }
    return vars;
  }

  function sketchSolveConstraints(sketchId = activeSketchId()) {
    return model.constraints.filter((constraint) => constraintIsOperational(constraint) && constraintSketchId(constraint) === sketchId);
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

  function solveReferenceDependentSketches(rootSketchId) {
    refreshReferenceConstraintValidity();
    const results = [];
    const dependentsBySource = new Map();
    for (const constraint of model.constraints) {
      if (!constraintIsOperational(constraint) || !constraint.reference || !constraint.referenceSketchId) continue;
      const dependentSketchId = constraintSketchId(constraint);
      if (!dependentSketchId || dependentSketchId === constraint.referenceSketchId) continue;
      if (!dependentsBySource.has(constraint.referenceSketchId)) dependentsBySource.set(constraint.referenceSketchId, new Set());
      dependentsBySource.get(constraint.referenceSketchId).add(dependentSketchId);
    }

    const affected = new Set([rootSketchId]);
    const pending = [rootSketchId];
    while (pending.length > 0) {
      const sourceSketchId = pending.shift();
      for (const dependentSketchId of dependentsBySource.get(sourceSketchId) || []) {
        if (affected.has(dependentSketchId)) continue;
        affected.add(dependentSketchId);
        pending.push(dependentSketchId);
      }
    }

    const indegree = new Map([...affected].map((sketchId) => [sketchId, 0]));
    for (const [sourceSketchId, dependents] of dependentsBySource) {
      if (!affected.has(sourceSketchId)) continue;
      for (const dependentSketchId of dependents) {
        if (affected.has(dependentSketchId)) indegree.set(dependentSketchId, (indegree.get(dependentSketchId) || 0) + 1);
      }
    }
    const orderIndex = new Map(orderedSketches().map((sketch, index) => [sketch.id, index]));
    const ready = [...affected]
      .filter((sketchId) => (indegree.get(sketchId) || 0) === 0)
      .sort((a, b) => (orderIndex.get(a) ?? Infinity) - (orderIndex.get(b) ?? Infinity));
    const processed = new Set();
    while (ready.length > 0) {
      const sketchId = ready.shift();
      if (processed.has(sketchId)) continue;
      processed.add(sketchId);
      if (sketchId !== rootSketchId) {
        clearSketchSolveState(sketchId);
        const result = solveSketchById(sketchId);
        normalizeArcSweeps();
        const status = resultIsAccepted(result) ? "ok" : "error";
        if (status === "ok") setSketchSolveOk(sketchId, result, rootSketchId);
        else setSketchSolveError(sketchId, result, rootSketchId);
        results.push({ sketchId, result, status });
      }
      for (const dependentSketchId of dependentsBySource.get(sketchId) || []) {
        if (!affected.has(dependentSketchId)) continue;
        indegree.set(dependentSketchId, (indegree.get(dependentSketchId) || 0) - 1);
        if (indegree.get(dependentSketchId) === 0) {
          ready.push(dependentSketchId);
          ready.sort((a, b) => (orderIndex.get(a) ?? Infinity) - (orderIndex.get(b) ?? Infinity));
        }
      }
    }

    for (const sketchId of affected) {
      if (sketchId === rootSketchId || processed.has(sketchId)) continue;
      const result = { success: false, errorNorm: Infinity, iterations: 0, reason: "循環参照" };
      setSketchSolveError(sketchId, result, rootSketchId);
      results.push({ sketchId, result, status: "error" });
    }
    const failed = results.find((entry) => entry.status === "error");
    return { success: !failed, sketchId: failed?.sketchId || null, result: failed?.result || null, results };
  }

  function solveSketchAndDependents(sketchId = activeSketchId(), rollbackState = null) {
    refreshReferenceConstraintValidity();
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
      return { success: false, sketchId, result, dependent: { success: true, results: [] } };
    }
    setSketchSolveOk(sketchId, result, sketchId);
    const dependent = solveReferenceDependentSketches(sketchId);
    return { success: true, sketchId, result, dependent };
  }

  function solveElementSketchAndDescendants(element, rollbackState = null) {
    return solveSketchAndDependents(elementSketchId(element), rollbackState);
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
    presentationDragSession = null;
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
    if (constraintSet.has(selectedConstraint)) selectedConstraint = null;
    if (constraintSet.has(hoveredDimensionConstraint)) hoveredDimensionConstraint = null;

    const result = solveActiveSketch();
    normalizeArcSweeps();
    updateToolbar();
    updateUI();
    draw();
    const msg = `削除しました: 点${pointSet.size} / 線${lineSet.size} / 円${circleSet.size} / 円弧${arcSet.size} / 拘束${constraintSet.size}`;
    setHint(`${msg} (error=${result.errorNorm.toExponential(2)}) / ${constraintSummaryText()}`, result.success && constraintAnalysisState?.analysis?.stable ? "normal" : "error");
    log(`${msg}\n自動solve: success=${result.success}, error=${result.errorNorm.toExponential(3)}`);
    recordHistory("削除");
    return true;
  }

  function deleteCurrentSelection() {
    if (selectedBlockInstances.length > 0) {
      const instances = [...selectedBlockInstances];
      const projectionItems = instances.flatMap((instance) => {
        const bundle = blockAllProjectionBundle(instance);
        return [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs];
      });
      const removedIds = new Set(projectionItems.map((item) => item.id));
      const removedKeys = new Set(projectionItems.map(presentationElementKey));
      model.constraints = model.constraints.filter((constraint) => !constraintGraphNodes(constraint).some((node) => instances.includes(node) || projectionItems.includes(node)));
      for (const sheet of model.presentationSheets) {
        for (const key of Object.keys(sheet.elementStyles || {})) if (removedKeys.has(key)) delete sheet.elementStyles[key];
        sheet.elements = (sheet.elements || []).filter((element) => !valueReferencesRemovedGeometry(element.geometryRefs, removedIds, removedKeys));
      }
      model.blockInstances = model.blockInstances.filter((instance) => !instances.includes(instance));
      invalidateBlockProjectionCache();
      clearSelection();
      solveAndRefresh("ブロックインスタンス削除");
      setHint(`ブロックインスタンスを ${instances.length}個削除しました`);
      return true;
    }
    const constraints = [...new Set([selectedDimensionConstraint, effectiveSelectedConstraint()].filter(Boolean))];
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
    selectedConstraint = null;
    const i = selectedPoints.indexOf(p);
    if (i >= 0) selectedPoints.splice(i, 1);
    else selectedPoints.push(p);
  }

  function toggleLineSelection(l) {
    if (!l) return;
    selectedConstraint = null;
    const i = selectedLines.indexOf(l);
    if (i >= 0) selectedLines.splice(i, 1);
    else selectedLines.push(l);
  }

  function toggleCircleSelection(c) {
    if (!c) return;
    selectedConstraint = null;
    const i = selectedCircles.indexOf(c);
    if (i >= 0) selectedCircles.splice(i, 1);
    else selectedCircles.push(c);
  }

  function toggleArcSelection(a) {
    if (!a) return;
    selectedConstraint = null;
    const i = selectedArcs.indexOf(a);
    if (i >= 0) selectedArcs.splice(i, 1);
    else selectedArcs.push(a);
  }

  function toggleSidebarSelectionById(selection, item) {
    if (!item) return;
    const i = selection.findIndex((selected) => selected === item || selected?.id === item.id);
    if (i >= 0) selection.splice(i, 1);
    else selection.push(item);
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
    const nextBlocks = additive ? [...selectedBlockInstances] : [];

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
    for (const instance of model.blockInstances) {
      if (!isEditableSketchId(instance.sketchId) || !isVisibleSketchId(instance.sketchId)) continue;
      const bundle = blockProjectionBundle(instance);
      let box = null;
      for (const line of bundle.lines) box = mergeBounds(box, lineBBox(line));
      for (const circle of bundle.circles) box = mergeBounds(box, primitiveBBox(circle));
      for (const arc of bundle.arcs) box = mergeBounds(box, primitiveBBox(arc));
      for (const point of bundle.points) box = mergeBounds(box, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
      if (!box) continue;
      const selected = crossing ? bboxIntersectsRect(box, rect) : bboxInRect(box, rect);
      if (selected) addUnique(nextBlocks, instance);
    }

    selectedPoints = nextPoints;
    selectedLines = nextLines;
    selectedCircles = nextCircles;
    selectedArcs = nextArcs;
    selectedBlockInstances = nextBlocks;
    selectedArcEndpoint = null;
    selectedArcEndpointPair = null;
    selectedDimensionConstraint = null;
    selectedConstraint = null;
  }

  function drawGrid(w, h) {
    if (isPresentationMode()) return;
    const dpr = window.devicePixelRatio || 1;
    const step = GRID_SCREEN_STEP_PX;
    const offsetX = ((viewport.x % step) + step) % step;
    const offsetY = ((viewport.y % step) + step) % step;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = "#eef2f7";
    ctx.lineWidth = 1;
    for (let x = offsetX; x <= w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = offsetY; y <= h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function resetCanvasStrokeState() {
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    ctx.globalAlpha = 1;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.lineWidth = 1;
  }

  function withCanvasState(drawFn) {
    ctx.save();
    try {
      resetCanvasStrokeState();
      drawFn();
    } finally {
      ctx.restore();
      resetCanvasStrokeState();
    }
  }

  function drawBlockInstanceHandles() {
    if (!isGeometryMode()) return;
    withCanvasState(() => {
      for (const instance of selectedBlockInstances) {
        if (!isVisibleSketchId(instance.sketchId)) continue;
        const center = blockInstanceDisplayCenter(instance);
        const handle = blockRotationHandlePoint(instance);
        ctx.strokeStyle = "#2563eb";
        ctx.fillStyle = "#fff";
        ctx.lineWidth = 1.5 / viewport.scale;
        ctx.setLineDash([4 / viewport.scale, 3 / viewport.scale]);
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(handle.x, handle.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(center.x, center.y, 4 / viewport.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(handle.x, handle.y, 6 / viewport.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });
  }

  function drawBlockPlacementPreview() {
    if (mode !== "block-place" || !blockPlacementDefinitionId || !pointerPreview) return;
    const definition = blockDefinitionById(blockPlacementDefinitionId);
    if (!definition) return;
    const anchor = blockPlacementAnchor || pointerPreview;
    const rotation = blockPlacementAnchor ? Math.atan2(pointerPreview.y - anchor.y, pointerPreview.x - anchor.x) : 0;
    const translation = blockInstanceTranslationForAnchor(definition, blockPlacementEnabledSketchIds, anchor, rotation);
    const previewInstance = { id: "BLOCK_PREVIEW", definitionId: definition.id, sketchId: activeSketchId(), x: translation.x, y: translation.y, rotation, fixed: false, enabledSketchIds: blockPlacementEnabledSketchIds.slice() };
    const bundle = createBlockProjectionBundle(previewInstance, definition);
    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      for (const line of bundle.lines) {
        ctx.beginPath();
        ctx.moveTo(line.p1.x, line.p1.y);
        ctx.lineTo(line.p2.x, line.p2.y);
        ctx.stroke();
      }
      for (const circle of bundle.circles) {
        ctx.beginPath();
        ctx.arc(circle.center.x, circle.center.y, circle.radius(), 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const arc of bundle.arcs) {
        ctx.beginPath();
        ctx.arc(arc.center.x, arc.center.y, arc.radius(), arc.startAngle, arc.endAngle, arc.endAngle < arc.startAngle);
        ctx.stroke();
      }
    });
  }

  function draw() {
    const r = canvas.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    const dpr = window.devicePixelRatio || 1;
    const bitmapWidth = Math.max(1, Math.floor(w * dpr));
    const bitmapHeight = Math.max(1, Math.floor(h * dpr));
    if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
      canvas.width = bitmapWidth;
      canvas.height = bitmapHeight;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    resetCanvasStrokeState();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    resetCanvasStrokeState();
    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.scale, viewport.scale);
    resetCanvasStrokeState();
    drawGrid(w, h);
    drawLines();
    drawCircles();
    drawArcs();
    drawBlockInstanceHandles();
    if (isGeometryMode()) {
      drawDimensions();
      drawDimensionPreview();
    } else {
      drawPresentationElements();
      drawPresentationDimensionPreview();
      drawPresentationLeaderCommandPreview();
    }
    drawTemporaryLine();
    drawRectanglePreview();
    drawCirclePreview();
    drawArcPreview();
    drawBlockPlacementPreview();
    drawOffsetPreview();
    drawTrimPreview();
    drawSnapMarker();
    if (isGeometryMode()) {
      drawArcEndpointHandles();
      drawPoints();
    } else {
      drawPresentationPointHandles();
    }
    drawSketchIdentityLabel();
    drawSelectionRect();
    resetCanvasStrokeState();
    ctx.restore();
    resetCanvasStrokeState();
    syncDimensionValueInput();
    updateSidebarSelectionRowClasses();
  }

  function hideDimensionValueInput() {
    if (!dimensionValueInput) return;
    dimensionValueInput.hidden = true;
    dimensionValueInput.classList.remove("is-invalid");
  }

  function dimensionInputPointForPendingCommand() {
    if (!pendingCommand || !["distance-value", "fillet-radius-value", "offset-value"].includes(pendingCommand.type)) return null;
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
    if (!pendingCommand || !["distance-value", "fillet-radius-value", "offset-value"].includes(pendingCommand.type)) {
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
    withCanvasState(() => {
      ctx.strokeStyle = selectionRectSession.current.x < selectionRectSession.start.x ? "#f59e0b" : "#2563eb";
      ctx.fillStyle = selectionRectSession.current.x < selectionRectSession.start.x ? "rgba(245, 158, 11, 0.08)" : "rgba(37, 99, 235, 0.08)";
      ctx.lineWidth = 1.2 / viewport.scale;
      ctx.setLineDash([5 / viewport.scale, 4 / viewport.scale]);
      ctx.fillRect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);
      ctx.strokeRect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);
    });
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
    for (const l of drawOrderBySketch(allGeometryLines())) {
      const presentation = isPresentationMode();
      const style = presentation ? presentationStyleForElement(l) : null;
      if (presentation && style.visible === false) continue;
      const active = isEditableSketchElement(l);
      ctx.globalAlpha = presentation ? style.opacity : sketchAlpha(l);
      const refSelected = isPendingReferenceTarget(l) || isConstraintOperandSelected(l);
      const treeHovered = isSidebarHighlightedElement(l);
      const sidebarHovered = isSidebarHoveredElement(l);
      const relatedHighlighted = isSelectedConstraintRelatedElement(l);
      const auxiliaryHighlighted = treeHovered || relatedHighlighted;
      const blockSelected = l.blockInstance && selectedBlockInstances.includes(l.blockInstance);
      const sel = blockSelected || (active && selectedLines.includes(l)) || (presentation && selectedLines.includes(l)) || refSelected;
      const hovered = sidebarHovered || (l.blockInstance && hoveredBlockInstance === l.blockInstance) || ((active || isReferenceHoverElement(l)) && hoveredLine === l) || (presentation && hoveredLine === l);
      const construction = Boolean(l.construction) && !sel && !hovered;
      const lineColor = auxiliaryHighlighted ? "#0ea5e9" : presentation && !sel && !hovered ? style.color : constraintStatusColor(l, sel, hovered);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = (auxiliaryHighlighted ? 4 : sel ? 4 : hovered ? 2.6 : presentation ? style.lineWidthPx : construction ? Math.max(1.8, sketchStrokeWidth(l) * 0.72) : sketchStrokeWidth(l)) / viewport.scale;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash(presentation ? presentationLineDash(style.lineType) : construction ? [12 / viewport.scale, 4 / viewport.scale, 2 / viewport.scale, 4 / viewport.scale] : []);
      ctx.shadowColor = sel || auxiliaryHighlighted ? "rgba(14, 165, 233, 0.45)" : "transparent";
      ctx.shadowBlur = sel || auxiliaryHighlighted ? 8 / viewport.scale : 0;
      const constructionExtension = CONSTRUCTION_EXTENSION_SCREEN_PX / viewport.scale;
      const drawSegment = construction ? extendedLineSegment(l, constructionExtension) : { p1: l.p1, p2: l.p2 };
      ctx.beginPath();
      ctx.moveTo(drawSegment.p1.x, drawSegment.p1.y);
      ctx.lineTo(drawSegment.p2.x, drawSegment.p2.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      if (construction) {
        ctx.fillStyle = lineColor;
        const endpointRadius = 2.4 / viewport.scale;
        for (const p of [l.p1, l.p2]) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, endpointRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (sel || hovered || auxiliaryHighlighted) {
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
    for (const c of drawOrderBySketch(allGeometryCircles())) {
      const presentation = isPresentationMode();
      const style = presentation ? presentationStyleForElement(c) : null;
      if (presentation && style.visible === false) continue;
      const active = isEditableSketchElement(c);
      ctx.globalAlpha = presentation ? style.opacity : sketchAlpha(c);
      const refSelected = isPendingReferenceTarget(c) || isConstraintOperandSelected(c);
      const treeHovered = isSidebarHighlightedElement(c);
      const sidebarHovered = isSidebarHoveredElement(c);
      const relatedHighlighted = isSelectedConstraintRelatedElement(c);
      const auxiliaryHighlighted = treeHovered || relatedHighlighted;
      const blockSelected = c.blockInstance && selectedBlockInstances.includes(c.blockInstance);
      const sel = blockSelected || (active && selectedCircles.includes(c)) || (presentation && selectedCircles.includes(c)) || refSelected;
      const hovered = sidebarHovered || (c.blockInstance && hoveredBlockInstance === c.blockInstance) || ((active || isReferenceHoverElement(c)) && hoveredCircle === c) || (presentation && hoveredCircle === c);
      const construction = Boolean(c.construction) && !sel && !hovered;
      ctx.strokeStyle = auxiliaryHighlighted ? "#0ea5e9" : presentation && !sel && !hovered ? style.color : constraintStatusColor(c, sel, hovered);
      ctx.lineWidth = (auxiliaryHighlighted ? 4 : sel ? 4 : hovered ? 2.6 : presentation ? style.lineWidthPx : construction ? Math.max(1.8, sketchStrokeWidth(c) * 0.72) : sketchStrokeWidth(c)) / viewport.scale;
      ctx.setLineDash(presentation ? presentationLineDash(style.lineType) : construction ? [12 / viewport.scale, 4 / viewport.scale, 2 / viewport.scale, 4 / viewport.scale] : []);
      ctx.shadowColor = sel || auxiliaryHighlighted ? "rgba(14, 165, 233, 0.45)" : "transparent";
      ctx.shadowBlur = sel || auxiliaryHighlighted ? 8 / viewport.scale : 0;
      ctx.beginPath();
      ctx.arc(c.center.x, c.center.y, c.radius(), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      if (sel || hovered || auxiliaryHighlighted) {
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
    for (const a of drawOrderBySketch(allGeometryArcs())) {
      const presentation = isPresentationMode();
      const style = presentation ? presentationStyleForElement(a) : null;
      if (presentation && style.visible === false) continue;
      const active = isEditableSketchElement(a);
      ctx.globalAlpha = presentation ? style.opacity : sketchAlpha(a);
      const refSelected = isPendingReferenceTarget(a) || isConstraintOperandSelected(a);
      const treeHovered = isSidebarHighlightedElement(a);
      const sidebarHovered = isSidebarHoveredElement(a);
      const relatedHighlighted = isSelectedConstraintRelatedElement(a);
      const auxiliaryHighlighted = treeHovered || relatedHighlighted;
      const blockSelected = a.blockInstance && selectedBlockInstances.includes(a.blockInstance);
      const sel = blockSelected || (active && selectedArcs.includes(a)) || (presentation && selectedArcs.includes(a)) || refSelected;
      const hovered = sidebarHovered || (a.blockInstance && hoveredBlockInstance === a.blockInstance) || ((active || isReferenceHoverElement(a)) && hoveredArc === a) || (presentation && hoveredArc === a);
      const construction = Boolean(a.construction) && !sel && !hovered;
      const angles = arcAngles(a);
      ctx.strokeStyle = auxiliaryHighlighted ? "#0ea5e9" : presentation && !sel && !hovered ? style.color : constraintStatusColor(a, sel, hovered);
      ctx.lineWidth = (auxiliaryHighlighted ? 4 : sel ? 4 : hovered ? 2.6 : presentation ? style.lineWidthPx : construction ? Math.max(1.8, sketchStrokeWidth(a) * 0.72) : sketchStrokeWidth(a)) / viewport.scale;
      ctx.setLineDash(presentation ? presentationLineDash(style.lineType) : construction ? [12 / viewport.scale, 4 / viewport.scale, 2 / viewport.scale, 4 / viewport.scale] : []);
      ctx.shadowColor = sel || auxiliaryHighlighted ? "rgba(14, 165, 233, 0.45)" : "transparent";
      ctx.shadowBlur = sel || auxiliaryHighlighted ? 8 / viewport.scale : 0;
      ctx.beginPath();
      ctx.arc(a.center.x, a.center.y, a.radius(), angles.start, angles.end, angles.end < angles.start);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      if (sel || hovered || auxiliaryHighlighted) {
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
    ctx.setLineDash(preview ? [5 / viewport.scale, 4 / viewport.scale] : []);
    ctx.beginPath();
    ctx.moveTo((lineA || a).x, (lineA || a).y);
    ctx.lineTo((lineB || b).x, (lineB || b).y);
    ctx.stroke();

    for (const p of points) {
      if (p.showExtension === false) continue;
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
    ctx.setLineDash(preview ? [5 / viewport.scale, 4 / viewport.scale] : []);
    const extension = DIMENSION_EXTENSION_SCREEN_PX / viewport.scale;
    const gap = DIMENSION_EXTENSION_GAP_SCREEN_PX / viewport.scale;
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
    const radial = target.kind === "radius" || target.kind === "diameter" || (target.kind === "offset-distance" && !(target.source instanceof Line));
    const d = radial ? targetDirection({ ...basisTarget, dimensionAnchor: anchor }) : targetDirection(basisTarget);
    const points = targetPointsForDimension(target, anchor);
    if (points.length < 2) return null;
    const tick = 9 / viewport.scale;
    const extension = DIMENSION_EXTENSION_SCREEN_PX / viewport.scale;
    const gap = DIMENSION_EXTENSION_GAP_SCREEN_PX / viewport.scale;
    const projectedPoints = points.map((source, index) => {
      const t = (source.x - anchor.x) * d.x + (source.y - anchor.y) * d.y;
      const onDimension = { x: anchor.x + d.x * t, y: anchor.y + d.y * t };
      const ex = onDimension.x - source.x;
      const ey = onDimension.y - source.y;
      const el = hypot2(ex, ey);
      const ux = el > 1e-12 ? ex / el : d.x;
      const uy = el > 1e-12 ? ey / el : d.y;
      const extensionDirection = { x: ux, y: uy };
      const pointClearance = dimensionPointSourceClearance(target, index, source, extensionDirection);
      const constructionClearance = dimensionConstructionExtensionClearance(target, index, source, extensionDirection);
      const visibleGap = Math.min(gap + pointClearance + constructionClearance, Math.max(0, el - 2 / viewport.scale));
      return {
        source,
        projection: t,
        showExtension: shouldShowDimensionExtension(target, index, { source, onDimension, extensionDirection }),
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
    const projections = projectedPoints.map((p) => p.projection);
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

  function incidentLinesAtPoint(point) {
    if (!point) return [];
    return model.lines.filter((line) => line.p1 === point || line.p2 === point);
  }

  function chooseIncidentLineForExtension(point, extensionDirection = null) {
    const candidates = incidentLinesAtPoint(point).filter(lineHasDirection);
    if (candidates.length === 0) return null;
    if (!extensionDirection) return candidates[0];
    let best = candidates[0];
    let bestScore = -Infinity;
    for (const line of candidates) {
      const u = lineUnit(line);
      const score = Math.abs(u.x * extensionDirection.x + u.y * extensionDirection.y);
      if (score > bestScore) {
        bestScore = score;
        best = line;
      }
    }
    return best;
  }

  function dimensionSourceLine(target, index, source = null, extensionDirection = null) {
    if (target.kind === "point-line" && index === 1) return target.line;
    if (target.kind === "line-line") return index === 0 ? target.line1 : target.line2;
    if (target.kind === "offset-distance" && target.source instanceof Line) return index === 0 ? target.source : target.offset;
    if (source instanceof Point) return chooseIncidentLineForExtension(source, extensionDirection);
    return null;
  }

  function lineOutwardDirectionAtSource(line, source) {
    const u = lineUnit(line);
    const tol = Math.max(MIN_LINE_LENGTH * 10, 1e-7);
    const d1 = hypot2(source.x - line.p1.x, source.y - line.p1.y);
    const d2 = hypot2(source.x - line.p2.x, source.y - line.p2.y);
    if (d1 <= tol && d1 <= d2) return { x: -u.x, y: -u.y, endpoint: "p1" };
    if (d2 <= tol) return { x: u.x, y: u.y, endpoint: "p2" };
    return null;
  }

  function shouldShowDimensionExtension(target, index, context = {}) {
    const line = dimensionSourceLine(target, index, context.source, context.extensionDirection);
    if (!line || !context.source || !context.onDimension) return true;
    const vx = context.onDimension.x - context.source.x;
    const vy = context.onDimension.y - context.source.y;
    const len = hypot2(vx, vy);
    if (len <= 1e-12) return false;
    const v = { x: vx / len, y: vy / len };
    const u = lineUnit(line);
    const parallel = Math.abs(v.x * u.y - v.y * u.x) <= 0.08;
    if (!parallel) return true;
    const outward = lineOutwardDirectionAtSource(line, context.source);
    if (!outward) return false;
    return v.x * outward.x + v.y * outward.y > 0.1;
  }

  function dimensionPointSourceClearance(target, index, source = null, extensionDirection = null) {
    if (!(source instanceof Point)) return 0;
    if (dimensionSourceLine(target, index, source, extensionDirection)) return 0;
    return DIMENSION_POINT_MARKER_RADIUS_SCREEN_PX / viewport.scale;
  }

  function dimensionConstructionExtensionClearance(target, index, source = null, extensionDirection = null) {
    if (!source || !extensionDirection) return 0;
    const line = dimensionSourceLine(target, index, source, extensionDirection);
    if (!line?.construction) return 0;
    const outward = lineOutwardDirectionAtSource(line, source);
    if (!outward) return 0;
    const directionalComponent = outward.x * extensionDirection.x + outward.y * extensionDirection.y;
    return Math.max(0, directionalComponent) * (CONSTRUCTION_EXTENSION_SCREEN_PX / viewport.scale);
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
    const size = DIMENSION_ARROW_LENGTH_SCREEN_PX / viewport.scale;
    const wing = DIMENSION_ARROW_HALF_WIDTH_SCREEN_PX / viewport.scale;
    const n = { x: -direction.y, y: direction.x };
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x + direction.x * size + n.x * wing, point.y + direction.y * size + n.y * wing);
    ctx.lineTo(point.x + direction.x * size - n.x * wing, point.y + direction.y * size - n.y * wing);
    ctx.closePath();
    ctx.fill();
  }

  function drawDimensions() {
    for (const c of [...model.constraints].sort((a, b) => Number(isActiveSketchConstraint(a)) - Number(isActiveSketchConstraint(b)))) {
      if (!isActiveSketchConstraint(c)) continue;
      const target = targetFromConstraint(c);
      if (!target) continue;
      const dimension = c.dimension || defaultDimensionForTarget(target);
      const highlighted = c === hoveredDimensionConstraint || c === selectedDimensionConstraint || c === dimensionDragSession?.constraint;
      const label = dimensionLabelForConstraint(c, target, dimension);
      const editing = pendingCommand?.type === "distance-value" && pendingCommand.constraint === c;
      ctx.save();
      drawDimension(target, dimension, label, false, highlighted || editing, editing ? { hidden: true } : null);
      ctx.restore();
    }
  }

  function drawPresentationElements() {
    const sheet = activePresentationSheet();
    if (!sheet || !Array.isArray(sheet.elements)) return;
    for (const element of sheet.elements) {
      if (element.visible === false) continue;
      if (element.type === "annotationDimension") {
        const target = presentationTargetFromData(element.target);
        if (!target) continue;
        const dimension = element.dimension || defaultDimensionForTarget(target);
        const value = presentationTargetValue(target);
        const label = target.kind === "angle" ? formatMeasuredDimensionLabel(value, "°") : formatMeasuredDimensionLabel(value);
        drawDimension(target, dimension, label, false, false);
      } else if (element.type === "leader") {
        drawPresentationLeader(element);
      }
    }
  }

  function drawPresentationDimensionPreview() {
    if (pendingCommand?.type !== "presentation-dimension-place") return;
    const target = pendingCommand.target;
    if (!target) return;
    const anchor = pendingCommand.pointer || dimensionAnchor(target, defaultDimensionForTarget(target));
    const dimension = dimensionFromAnchor(target, anchor);
    const value = presentationTargetValue(target);
    const label = target.kind === "angle" ? formatMeasuredDimensionLabel(value, "°") : formatMeasuredDimensionLabel(value);
    drawDimension(target, dimension, label, true, false);
  }

  function drawPresentationText(element) {
    ctx.save();
    ctx.font = `${Number(element.style?.fontSize || 13) / viewport.scale}px system-ui`;
    ctx.fillStyle = element.style?.color || "#111827";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(element.text || "", element.x, element.y);
    ctx.restore();
  }

  function drawPresentationLeader(element, preview = false) {
    if (!element.start || !element.end) return;
    const start = preview ? element.start : presentationLeaderAnchorForElement(element);
    if (!start) return;
    const elbow = element.elbow || {
      x: (start.x + element.end.x) / 2,
      y: element.end.y,
    };
    withCanvasState(() => {
      ctx.strokeStyle = element.style?.color || "#111827";
      ctx.fillStyle = element.style?.color || "#111827";
      ctx.lineWidth = Number(element.style?.lineWidthPx || 1.4) / viewport.scale;
      if (preview) ctx.setLineDash([5 / viewport.scale, 4 / viewport.scale]);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(elbow.x, elbow.y);
      ctx.lineTo(element.end.x, element.end.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const dx = elbow.x - start.x;
      const dy = elbow.y - start.y;
      const len = Math.max(1e-9, hypot2(dx, dy));
      drawArrowhead(start, { x: dx / len, y: dy / len });
      if (element.text) drawPresentationText(element);
    });
  }

  function textHitBox(text, x, y, fontSize = 13) {
    const width = Math.max(28, String(text || "").length * fontSize * 0.62);
    const height = fontSize + 10;
    return {
      left: x - width / 2,
      right: x + width / 2,
      top: y - height / 2,
      bottom: y + height / 2,
    };
  }

  function pointInExpandedBox(x, y, box, padding) {
    return x >= box.left - padding && x <= box.right + padding && y >= box.top - padding && y <= box.bottom + padding;
  }

  function boxFromPoints(points) {
    const valid = points.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
    if (valid.length === 0) return null;
    return {
      left: Math.min(...valid.map((p) => p.x)),
      right: Math.max(...valid.map((p) => p.x)),
      top: Math.min(...valid.map((p) => p.y)),
      bottom: Math.max(...valid.map((p) => p.y)),
    };
  }

  function hitPresentationAnnotationElement(x, y) {
    const sheet = activePresentationSheet();
    if (!sheet || !Array.isArray(sheet.elements)) return null;
    const threshold = 12 / viewport.scale;
    for (let i = sheet.elements.length - 1; i >= 0; i--) {
      const element = sheet.elements[i];
      if (!element || element.visible === false) continue;
      if (element.type === "annotationDimension") {
        const target = presentationTargetFromData(element.target);
        if (!target) continue;
        const dimension = element.dimension || defaultDimensionForTarget(target);
        const layout = dimensionLayout(target, dimension);
        if (!layout) continue;
        const presentationValue = presentationTargetValue(target);
        const label = target.kind === "angle" ? formatMeasuredDimensionLabel(presentationValue, "°") : formatMeasuredDimensionLabel(presentationValue);
        if (pointInExpandedBox(x, y, textHitBox(label, layout.text.x, layout.text.y, 13 / viewport.scale), threshold * 0.8)) return { element, type: "annotationDimension", target, dimension, part: "label" };
        if (hypot2(x - layout.text.x, y - layout.text.y) <= threshold * 3) return { element, type: "annotationDimension", target, dimension, part: "label" };
        if (distancePointToSegmentPoints(x, y, layout.hitA, layout.hitB) <= threshold * 2.2) return { element, type: "annotationDimension", target, dimension, part: "line" };
        const dimensionBox = boxFromPoints([layout.hitA, layout.hitB, layout.text, ...(layout.points || []).flatMap((p) => [p.extensionStart, p.extensionEnd])]);
        if (dimensionBox && pointInExpandedBox(x, y, dimensionBox, threshold * 2.5)) return { element, type: "annotationDimension", target, dimension, part: "line" };
      } else if (element.type === "leader") {
        const start = presentationLeaderAnchorForElement(element);
        if (!start || !element.end) continue;
        const elbow = element.elbow || { x: (start.x + element.end.x) / 2, y: element.end.y };
        if (distancePointToSegmentPoints(x, y, start, elbow) <= threshold * 2.2 || distancePointToSegmentPoints(x, y, elbow, element.end) <= threshold * 2.2) return { element, type: "leader", part: "line" };
        if (pointInExpandedBox(x, y, textHitBox(element.text, element.x, element.y, Number(element.style?.fontSize || 13) / viewport.scale), threshold)) return { element, type: "leader", part: "label" };
        if (hypot2(x - element.x, y - element.y) <= threshold * 3) return { element, type: "leader", part: "label" };
        const leaderBox = boxFromPoints([start, elbow, element.end, { x: element.x, y: element.y }]);
        if (leaderBox && pointInExpandedBox(x, y, leaderBox, threshold * 2.2)) return { element, type: "leader", part: "line" };
      }
    }
    return null;
  }

  function presentationElementById(id) {
    if (!id) return null;
    const sheet = activePresentationSheet();
    return sheet?.elements?.find((element) => element.id === id) || null;
  }

  function beginPresentationAnnotationDrag(e, hit, pointer) {
    presentationDragSession = {
      pointerId: e.pointerId,
      elementId: hit.element?.id || null,
      hit,
      startPointer: pointer,
      startDimension: hit.dimension ? { ...hit.dimension } : null,
      startAnchor: hit.target && hit.dimension ? dimensionAnchor(hit.target, hit.dimension) : null,
      startEnd: hit.element?.end ? { ...hit.element.end } : null,
      startElbow: hit.element?.elbow ? { ...hit.element.elbow } : null,
      startText: hit.element ? { x: hit.element.x, y: hit.element.y } : null,
    };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("is-dragging");
    setHint(hit.type === "leader" ? "引出線を移動中" : "注記寸法を移動中");
  }

  function updatePresentationAnnotationDrag(pointer) {
    const session = presentationDragSession;
    if (!session) return;
    const dx = pointer.x - session.startPointer.x;
    const dy = pointer.y - session.startPointer.y;
    const element = presentationElementById(session.elementId) || session.hit.element;
    if (!element) return;
    if (session.hit.type === "annotationDimension" && session.hit.target && session.startAnchor) {
      const anchor = { x: session.startAnchor.x + dx, y: session.startAnchor.y + dy };
      element.dimension = dimensionFromAnchor(session.hit.target, anchor, { allowPointAxis: false });
    } else if (session.hit.type === "leader") {
      if (session.startEnd) element.end = { x: session.startEnd.x + dx, y: session.startEnd.y + dy };
      if (session.startElbow) element.elbow = { x: session.startElbow.x + dx, y: session.startElbow.y + dy };
      if (session.startText) {
        element.x = session.startText.x + dx;
        element.y = session.startText.y + dy;
      }
    }
    draw();
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
    const label = previewTarget.kind === "angle" ? formatDimensionLabel(previewValue, "°") : formatDimensionLabel(previewValue);
    drawDimension(previewTarget, dimensionWithLabelAt(previewTarget, dimension, pendingCommand.pointer), label, true);
  }

  function drawFilletPreviewArc(geometry) {
    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      ctx.beginPath();
      ctx.arc(geometry.center.x, geometry.center.y, geometry.radius, geometry.startAngle, geometry.endAngle, geometry.endAngle < geometry.startAngle);
      ctx.stroke();
    });
  }

  function drawTemporaryLine() {
    if (mode !== "line" || !lineStartPoint) return;
    const target = pointerPreview || lineStartPoint;
    withCanvasState(() => {
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
    });
  }

  function drawRectanglePreview() {
    if (mode !== "rectangle" || !rectangleStartPoint || !pointerPreview) return;
    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      ctx.strokeRect(rectangleStartPoint.x, rectangleStartPoint.y, pointerPreview.x - rectangleStartPoint.x, pointerPreview.y - rectangleStartPoint.y);
    });
  }

  function drawCirclePreview() {
    if (mode !== "circle" || !circleCenterPoint || !pointerPreview) return;
    const radius = hypot2(pointerPreview.x - circleCenterPoint.x, pointerPreview.y - circleCenterPoint.y);
    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      ctx.beginPath();
      ctx.arc(circleCenterPoint.x, circleCenterPoint.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    });
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
    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      ctx.beginPath();
      ctx.arc(arcCenterPoint.x, arcCenterPoint.y, arcStartPoint.radius, angles.start, angles.end, angles.end < angles.start);
      ctx.stroke();
    });
    drawConstructionPoint(arcCenterPoint);
  }

  function drawOffsetPreview() {
    if (mode !== "offset" || !offsetSource) return;
    const pointer = pendingCommand?.type === "offset-value" ? pendingCommand.pointer : pointerPreview;
    if (!pointer) return;
    const measured = offsetDistanceFromPointer(offsetSource, pointer);
    const sign = pendingCommand?.type === "offset-value" ? pendingCommand.sign : measured.sign;
    const inputValue = pendingCommand?.type === "offset-value" ? Number(pendingCommand.buffer) : measured.distance;
    const distance = Number.isFinite(inputValue) && inputValue > 0 ? inputValue : measured.distance;
    const offset = offsetDraftGeometry(offsetSource, distance, sign);
    if (!offset) return;

    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      ctx.beginPath();
      if (offset instanceof Line) {
        ctx.moveTo(offset.p1.x, offset.p1.y);
        ctx.lineTo(offset.p2.x, offset.p2.y);
      } else if (offset instanceof Circle) {
        ctx.arc(offset.center.x, offset.center.y, offset.radius(), 0, Math.PI * 2);
      } else {
        ctx.arc(offset.center.x, offset.center.y, offset.radius(), offset.startAngle, offset.endAngle, offset.endAngle < offset.startAngle);
      }
      ctx.stroke();
    });

    const target = offsetDimensionTarget(offsetSource, offset, distance, sign);
    const dimension = dimensionWithLabelAt(target, dimensionFromAnchor(target, pointer, { allowPointAxis: false }), pointer);
    if (pendingCommand?.type === "offset-value") {
      pendingCommand.target = target;
      pendingCommand.dimension = dimension;
    }
    drawDimension(target, dimension, formatDimensionLabel(distance), true);
  }

  function drawTrimPreview() {
    if (mode !== "trim" || !trimPreview) return;
    withCanvasState(() => {
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
    });
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
    if (relation === "reference") return "参照可";
    if (relation === "descendant") return "参照不可（子孫）";
    return "";
  }

  function sketchIdentityRelationColor(sketchId) {
    const relation = sketchRelationToActive(sketchId);
    if (relation === "reference") return "#1d4ed8";
    if (relation === "descendant") return "#b91c1c";
    return "#64748b";
  }

  function sketchIdentityRelationBackground(sketchId) {
    const relation = sketchRelationToActive(sketchId);
    if (relation === "reference") return "rgba(219, 234, 254, 0.96)";
    if (relation === "descendant") return "rgba(254, 226, 226, 0.96)";
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
        const selected = sameArcEndpoint(selectedArcEndpoint, { arc, endpoint }) || selectedArcEndpointPair?.some((item) => sameArcEndpoint(item, { arc, endpoint })) || isConstraintOperandSelected(arc, { arcEndpoint: { arc, endpoint } }) || (dragSession?.kind === "arc-endpoint" && dragSession.item === arc && dragSession.endpoint === endpoint);
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

  function drawPresentationPointHandles() {
    ctx.save();
    const points = new Set([...selectedPoints]);
    if (hoveredPoint) points.add(hoveredPoint);
    for (const point of points) {
      if (!point || !isVisibleSketchElement(point)) continue;
      ctx.beginPath();
      ctx.arc(point.x, point.y, (selectedPoints.includes(point) ? 6 : 4.5) / viewport.scale, 0, Math.PI * 2);
      ctx.fillStyle = selectedPoints.includes(point) ? "#2563eb" : "#eff6ff";
      ctx.fill();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.8 / viewport.scale;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPoints() {
    ctx.save();
    for (const p of drawOrderBySketch(model.points)) {
      if (!isExplicitPoint(p) && !isPointUsedByPrimitive(p) && !isReferencePoint(p)) continue;
      const active = isEditableSketchElement(p);
      ctx.globalAlpha = sketchAlpha(p);
      const refSelected = isPendingReferenceTarget(p) || isConstraintOperandSelected(p);
      const treeHovered = isSidebarHighlightedElement(p);
      const sidebarHovered = isSidebarHoveredElement(p);
      const relatedHighlighted = isSelectedConstraintRelatedElement(p);
      const auxiliaryHighlighted = treeHovered || relatedHighlighted;
      const sel = (active && selectedPoints.includes(p)) || refSelected;
      const endpoint = isEndpointPoint(p);
      const hovered = sidebarHovered || ((active || isReferenceHoverElement(p)) && (hoveredPoint === p || hoveredEndpointPoint === p));
      const dragging = dragSession?.kind === "point" && dragSession.points.some((target) => target.point === p);
      const primitiveCenter = shouldShowPrimitiveCenter(p);
      const fixedByLine = pointLockedByLineFixed(p);
      const reference = isReferencePoint(p);
      if (reference && !sel && !hovered && !dragging && !auxiliaryHighlighted) continue;
      if (endpoint && !reference && !sel && !hovered && !dragging && !primitiveCenter && !auxiliaryHighlighted) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (sel || auxiliaryHighlighted ? 7 : endpoint || reference ? 5 : 5) / viewport.scale, 0, Math.PI * 2);
      ctx.fillStyle = p.fixed || fixedByLine ? "#fee2e2" : sel ? "#1d4ed8" : auxiliaryHighlighted ? "#e0f2fe" : hovered || primitiveCenter || reference ? "#eff6ff" : "#fff";
      ctx.fill();
      ctx.strokeStyle = auxiliaryHighlighted ? "#0ea5e9" : p.fixed || fixedByLine ? "#dc2626" : constraintStatusColor(p, sel, hovered || primitiveCenter || reference);
      ctx.lineWidth = (sel || auxiliaryHighlighted ? 3 : Math.max(1.2, sketchStrokeWidth(p))) / viewport.scale;
      ctx.shadowColor = sel || auxiliaryHighlighted ? "rgba(14, 165, 233, 0.45)" : "transparent";
      ctx.shadowBlur = sel || auxiliaryHighlighted ? 8 / viewport.scale : 0;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
      if (sel || hovered || dragging || auxiliaryHighlighted) {
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
    const geometryMode = isGeometryMode();
    const presentationMode = isPresentationMode();
    const constructionState = constructionToggleState(geometryMode);
    const states = {
      toolSelect: geometryMode && mode === "select" && !pendingConstraintCommand && !pendingCommand,
      toolPoint: geometryMode && mode === "point",
      toolLine: geometryMode && mode === "line",
      toolConstructionLine: constructionState.active,
      toolRectangle: geometryMode && mode === "rectangle",
      toolCreateBlock: geometryMode && Boolean(blockEditSession?.isNew),
      toolPlaceBlock: geometryMode && mode === "block-place",
      toolFillet: geometryMode && mode === "fillet",
      toolTrim: geometryMode && mode === "trim",
      toolOffset: geometryMode && mode === "offset",
      toolCircle: geometryMode && mode === "circle",
      toolArc: geometryMode && mode === "arc",
      presentationSelectBtn: presentationMode && !pendingCommand,
      presentationDimensionBtn: presentationMode && Boolean(pendingCommand?.type?.startsWith("presentation-dimension")),
      presentationLeaderBtn: presentationMode && Boolean(pendingCommand?.type?.startsWith("presentation-leader")),
    };
    for (const [id, active] of Object.entries(states)) {
      const button = document.getElementById(id);
      if (!button) continue;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-disabled", id.startsWith("presentation") ? String(!presentationMode) : String(!geometryMode));
    }
    const blockToolsDisabled = Boolean(blockEditSession);
    for (const id of ["toolCreateBlock", "toolPlaceBlock"]) {
      const button = document.getElementById(id);
      if (button) button.disabled = blockToolsDisabled;
    }
    updateHistoryButtons();
  }

  function constructionToggleState(geometryMode = isGeometryMode()) {
    if (!geometryMode) return { active: false, mixed: false };
    const primitives = selectedConstructionTogglePrimitives();
    if (primitives.length > 0) {
      const constructionCount = primitives.filter((item) => item.construction).length;
      return {
        active: constructionCount === primitives.length,
        mixed: false,
      };
    }
    return { active: constructionLineMode, mixed: false };
  }

  function selectedConstructionTogglePrimitives() {
    if (selectedPoints.length > 0 || selectedArcEndpoint || selectedArcEndpointPair || selectedDimensionConstraint) return [];
    return [...selectedLines, ...selectedCircles, ...selectedArcs];
  }

  function canApplyConstraint(type) {
    if (!isGeometryMode()) return false;
    if (pendingConstraintCommand?.type === type && constraintOperands.length > 0) {
      const resolution = resolveConstraintIntent(type, constraintOperands);
      return Boolean(resolution && !resolution.error && (resolution.constraint || resolution.target || resolution.action));
    }
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
    if (constraintOperands.length > 0) {
      const resolution = resolveConstraintIntent(type, constraintOperands);
      if (!resolution || resolution.error) return false;
      if (type === "distance") return Boolean(resolution.target);
      return Boolean(resolution.constraint);
    }
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
    if (rejectPresentationGeometryEdit("Constraints")) return;
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
    constraintOperands = constraintOperandsFromSelection();
    pendingConstraintCommand = { type };
    trimConstraintSelection(type);
    if (constraintOperands.length > 0) {
      const resolution = resolveConstraintIntent(type, constraintOperands);
      if (resolution?.action === "place-dimension") {
        startDistanceResolution(resolution, null);
        return;
      }
      if (resolution?.action === "commit" && resolution.constraint) {
        commitConstraintResolution(resolution);
        return;
      }
      syncSelectionFromConstraintOperands();
    }
    updateToolbar();
    updateConstraintButtons();
    setHint(constraintTargetHint(type));
    draw();
  }

  function cancelConstraintTargetCommand(message = "拘束対象の選択をキャンセルしました") {
    if (!pendingConstraintCommand) return;
    pendingConstraintCommand = null;
    constraintOperands = [];
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
    if (constraintOperands.length > 0) {
      const resolution = resolveConstraintIntent(type, constraintOperands);
      if (resolution?.error) {
        setHint(resolution.error, "error");
        return false;
      }
      if (resolution?.action === "place-dimension") {
        startDistanceResolution(resolution, null);
        return true;
      }
      if (resolution?.action === "commit" && resolution.constraint) {
        commitConstraintResolution(resolution);
        return true;
      }
      setHint(constraintTargetHint(type));
      return false;
    }
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

  function hitConstraintOperand(pointer, type, hits = {}) {
    const hitP = hits.hitP ?? hitPoint(pointer.x, pointer.y);
    const hitL = hits.hitL ?? hitLine(pointer.x, pointer.y);
    const hitC = hits.hitC ?? hitCircle(pointer.x, pointer.y);
    const hitA = hits.hitA ?? hitArc(pointer.x, pointer.y);
    const hitArcEnd = hits.hitArcEnd ?? hitArcEndpoint(pointer.x, pointer.y);
    if (hitArcEnd && (type === "coincident" || type === "pointOnCircle")) return makeConstraintOperand("arc-endpoint", { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint });
    if (hitP) return makeConstraintOperand("point", { point: hitP });
    if (hitL) return makeConstraintOperand("line", { line: hitL });
    if (hitC || hitA) return makeConstraintOperand("primitive", { primitive: hitC || hitA });
    const blockOperand = hitBlockProjectionOperand(pointer.x, pointer.y);
    if (blockOperand) return blockOperand;
    return operandFromReferenceTarget(hitReferenceTarget(pointer.x, pointer.y));
  }

  function constraintOperandLimit(type, operands) {
    if (type === "distance") return operands.some((operand) => operand.kind === "primitive") ? 1 : 2;
    if (type === "horizontal" || type === "vertical") return operands.some((operand) => operand.kind === "point") ? 2 : 1;
    return 2;
  }

  function appendConstraintOperand(type, operand) {
    if (!operand) return { ok: false, error: invalidConstraintTargetHint(type) };
    if ((type === "parallel" || type === "perpendicular" || type === "collinear") && operand.kind !== "line") return { ok: false, error: invalidConstraintTargetHint(type) };
    if ((type === "parallel" || type === "perpendicular" || type === "collinear") && !lineHasDirection(operand.line)) return { ok: false, error: "向き拘束の対象線が短すぎます" };
    if ((type === "horizontal" || type === "vertical") && operand.kind !== "line" && operand.kind !== "point") return { ok: false, error: invalidConstraintTargetHint(type) };
    if (type === "tangent" && operand.kind !== "line" && operand.kind !== "primitive") return { ok: false, error: invalidConstraintTargetHint(type) };
    if ((type === "equal" || type === "equalRadius" || type === "concentric") && operand.kind !== "line" && operand.kind !== "primitive" && operand.kind !== "point") return { ok: false, error: invalidConstraintTargetHint(type) };
    if (type === "pointOnCircle" && operand.kind !== "point" && operand.kind !== "primitive" && operand.kind !== "arc-endpoint") return { ok: false, error: invalidConstraintTargetHint(type) };
    if (type === "distance" && operand.kind === "arc-endpoint") return { ok: false, error: invalidConstraintTargetHint(type) };

    let next = constraintOperands.filter((existing) => !sameConstraintOperand(existing, operand));
    if (type === "distance" && operand.kind === "primitive") next = [];
    if (type === "distance" && next.some((existing) => existing.kind === "primitive")) next = [];
    next.push(operand);
    const limit = constraintOperandLimit(type, next);
    if (next.length > limit) next = next.slice(next.length - limit);
    constraintOperands = next;
    syncSelectionFromConstraintOperands();
    return { ok: true };
  }

  function handleConstraintOperandClick(pointer, type, hits = {}) {
    const added = appendConstraintOperand(type, hitConstraintOperand(pointer, type, hits));
    if (!added.ok) {
      setHint(added.error, "error");
      return true;
    }
    const resolution = resolveConstraintIntent(type, constraintOperands);
    if (resolution?.error) {
      setHint(resolution.error, "error");
      draw();
      return true;
    }
    if (resolution?.action === "place-dimension") {
      startDistanceResolution(resolution, null);
      return true;
    }
    if (resolution?.action === "commit" && resolution.constraint) {
      commitConstraintResolution(resolution);
      return true;
    }
    updateUI();
    setHint(constraintTargetHint(type));
    draw();
    return true;
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

  function startDistanceCommand() {
    if (constraintOperands.length === 0) constraintOperands = constraintOperandsFromSelection();
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
      resolution,
      pointer: defaultDimensionForTarget(resolution.target),
      operands: resolution.operands || constraintOperands.slice(),
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
    if (pendingCommand.type === "offset-value") {
      offsetSource = null;
      pointerPreview = null;
    }
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
    const readOnlyConstraint = readOnlyDimensionConstraintForPlacement(target, value, dimension, { referenceSketchId, sketchId });
    if (readOnlyConstraint) {
      pendingCommand = null;
      hideDimensionValueInput();
      addReadOnlyDimensionConstraint(readOnlyConstraint, sketchId || activeSketchId(), referenceSketchId ? "重複参照寸法" : "重複寸法");
      return;
    }
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

  function retargetDistancePlaceWithOperand(pointer, hits = {}) {
    if (pendingCommand?.type !== "distance-place" || pendingCommand.target.kind !== "line-length") return false;
    const baseOperands = pendingCommand.operands?.length ? pendingCommand.operands : [{ kind: "line", line: pendingCommand.target.line, element: pendingCommand.target.line, sketchId: elementSketchId(pendingCommand.target.line), relation: "active" }];
    const operand = hitConstraintOperand(pointer, "distance", hits);
    if (!operand || sameConstraintOperand(baseOperands[0], operand)) return false;
    const resolution = resolveConstraintIntent("distance", [baseOperands[0], operand]);
    if (resolution?.error) {
      setHint(resolution.error, "error");
      return true;
    }
    if (!resolution?.target) return false;
    startDistanceResolution(resolution, null);
    pendingCommand.pointer = pointer;
    pendingCommand.dimension = null;
    return true;
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
    if (isReadOnlyDimension(hit.constraint)) {
      selectedDimensionConstraint = hit.constraint;
      selectedConstraint = null;
      dimensionDragSession = null;
      setHint("読み取り専用寸法の値は編集できません");
      draw();
      return true;
    }
    pendingCommand = {
      type: "distance-value",
      target,
      dimension: hit.constraint.dimension || hit.dimension || defaultDimensionForTarget(target),
      buffer: String(Number(target.kind === "angle" ? angleDegrees(hit.constraint.target) : hit.constraint.target).toFixed(3)),
      editing: false,
      constraint: hit.constraint,
    };
    selectedDimensionConstraint = hit.constraint;
    selectedConstraint = null;
    dimensionDragSession = null;
    setHint("寸法値を入力中: 数値キーで編集、Enter/ダブルクリックで決定、Escでキャンセル");
    draw();
    focusDimensionValueInput();
    return true;
  }

  function updateDistanceBufferLabel() {
    if (!pendingCommand || !["distance-value", "fillet-radius-value", "offset-value"].includes(pendingCommand.type)) return;
    setHint(pendingCommand.type === "offset-value" ? "オフセット距離を入力中: Enter/ダブルクリックで決定、Escでキャンセル" : "寸法値を入力中: 数値キーで編集、Enter/ダブルクリックで決定、Escでキャンセル");
    draw();
  }

  function sketchHasDimensionConstraint(sketchId = activeSketchId()) {
    return model.constraints.some((constraint) => constraintSketchId(constraint) === sketchId && constraint.dimension);
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
    const targetSketchId = sketchId || activeSketchId();
    const shouldFitFirstDimension = !constraint && !sketchHasDimensionConstraint(targetSketchId);
    const firstDimensionFootprint = shouldFitFirstDimension ? captureSketchScreenFootprint(targetSketchId) : null;
    pendingCommand = null;
    hideDimensionValueInput();
    if (constraint) {
      const snapshot = snapshotModelState();
      const previousTarget = constraint.target;
      constraint.target = target.kind === "angle" ? (value * Math.PI) / 180 : value;
      preconditionNewConstraint(constraint);
      const solved = withTemporarySolveStepNorm(solveStepNormForConstraint(constraint), () => solveSketchAndDependents(sketchId || constraintSketchId(constraint), snapshot));
      const result = solved.result;
      if (!solved.success || result.errorNorm > CONSTRAINT_ACCEPT_ERROR) {
        restoreModelState(snapshot);
        constraint.target = previousTarget;
        setHint(`寸法値を更新できません: 矛盾しています (error=${result.errorNorm.toExponential(3)})`, "error");
      } else {
        setHint(`寸法値更新: success=${result.success}, error=${result.errorNorm.toExponential(2)}, iter=${result.iterations}`);
        recordHistory("寸法値変更");
      }
      updateUI();
      draw();
      return;
    }
    if (shouldFitFirstDimension) scaleSketchForFirstDimension(targetSketchId, target, value, dimension);
    const ok = addDistanceConstraintFromTarget(target, value, dimension, { referenceSketchId, sketchId });
    if (ok && firstDimensionFootprint && restoreSketchScreenFootprint(targetSketchId, firstDimensionFootprint)) {
      setHint(`最初の寸法 ${value} に合わせて、見た目の大きさを保つよう表示スケールを調整しました`);
      draw();
    }
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
    if (!["distance-value", "fillet-radius-value", "offset-value"].includes(pendingCommand.type)) return false;
    if (e.key === "Enter") {
      e.preventDefault();
      if (pendingCommand.type === "fillet-radius-value") submitFilletRadiusValue();
      else if (pendingCommand.type === "offset-value") submitOffsetValue();
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
    if (!isGeometryMode()) {
      for (const btn of constraintButtons) {
        btn.classList.remove("active");
        btn.setAttribute("aria-disabled", "true");
        btn.setAttribute("aria-pressed", "false");
      }
      fixPointBtn?.setAttribute("aria-disabled", "true");
      return;
    }
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
    const selectedProjectionItems = [...selectedPoints, ...selectedLines, ...selectedCircles, ...selectedArcs].filter((item) => item?.blockProjection);
    const selectedProjectionInstances = [...new Set(selectedProjectionItems.map((item) => item.blockInstance))];
    const canToggleFixed =
      selectedBlockInstances.length === 1 ||
      (selectedProjectionItems.length > 0 && selectedProjectionInstances.length === 1 && selectedProjectionItems.length === selectedPoints.length + selectedLines.length + selectedCircles.length + selectedArcs.length) ||
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
    if (rejectPresentationGeometryEdit("Sketch editing")) return;
    ensureSketchState();
    const current = activeSketch();
    const parentSketchId = kind === "child" ? current.id : current.parentSketchId || ROOT_SKETCH_ID;
    const sketch = { id: `S${sketchSeq++}`, name: nextSketchName(parentSketchId), parentSketchId, kind: "sketch", visible: true };
    model.sketches.push(sketch);
    model.activeSketchId = sketch.id;
    clearInteractionForSketchChange();
    setHint(parentSketchId ? `編集中: ${sketch.name} / 親: ${sketchName(parentSketchId)}` : `編集中: ${sketch.name}`);
    updateUI();
    draw();
    recordHistory("スケッチ追加");
  }

  function setActiveSketch(sketchId) {
    ensureSketchState();
    const sketch = model.sketches.find((item) => item.id === sketchId);
    if (!sketch) return;
    if (model.activeSketchId === sketchId) return;
    sketch.visible = true;
    model.activeSketchId = sketchId;
    clearInteractionForSketchChange();
    setHint(`編集中: ${sketchName(sketchId)}`);
    updateUI();
    draw();
  }

  function renameSketch(sketchId) {
    if (rejectPresentationGeometryEdit("Sketch editing")) return;
    const sketch = model.sketches.find((item) => item.id === sketchId);
    if (!sketch || isRootSketch(sketch)) return;
    const next = window.prompt("スケッチ名", sketch.name);
    if (!next) return;
    sketch.name = next.trim() || sketch.name;
    updateUI();
    draw();
    recordHistory("スケッチ名変更");
  }

  function toggleSketchVisibility(sketchId) {
    const sketch = sketchById(sketchId);
    if (!sketch || isRootSketch(sketch) || sketch.id === activeSketchId()) return false;
    sketch.visible = sketch.visible === false;
    hoveredSketchTreeId = null;
    clearSnap();
    setHint(`${sketch.name}: ${sketch.visible ? "表示" : "非表示"}`);
    updateUI();
    draw();
    recordHistory(sketch.visible ? "スケッチ表示" : "スケッチ非表示");
    return true;
  }

  function valueReferencesRemovedGeometry(value, removedIds, removedKeys) {
    if (typeof value === "string") return removedIds.has(value) || removedKeys.has(value);
    if (Array.isArray(value)) return value.some((item) => valueReferencesRemovedGeometry(item, removedIds, removedKeys));
    if (value && typeof value === "object") return Object.values(value).some((item) => valueReferencesRemovedGeometry(item, removedIds, removedKeys));
    return false;
  }

  function deleteSketch(sketchId, confirmFirst = true) {
    if (rejectPresentationGeometryEdit("Sketch editing")) return false;
    ensureSketchState();
    const sketch = sketchById(sketchId);
    if (!sketch || isRootSketch(sketch)) return false;

    const sketchIds = new Set([sketch.id, ...descendantSketchIds(sketch.id)]);
    const externalReferences = model.constraints.filter((constraint) => {
      if (!constraint.reference || !sketchIds.has(constraint.referenceSketchId)) return false;
      return !sketchIds.has(constraintSketchId(constraint));
    });
    if (externalReferences.length > 0) {
      const owners = new Map();
      for (const constraint of externalReferences) {
        const ownerId = constraintSketchId(constraint);
        owners.set(ownerId, (owners.get(ownerId) || 0) + 1);
      }
      const ownerText = [...owners.entries()].map(([ownerId, count]) => `${sketchName(ownerId)} ${count}件`).join("、");
      const msg = `削除できません: ${sketch.name} またはその子孫が ${ownerText} から参照されています`;
      setHint(msg, "error");
      log(msg);
      return false;
    }
    const blockInstancesToRemove = model.blockInstances.filter((instance) => sketchIds.has(instance.sketchId));
    const blockProjectionItemsToRemove = blockInstancesToRemove.flatMap((instance) => {
      const bundle = blockAllProjectionBundle(instance);
      return [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs];
    });
    const geometryCount = [...model.points, ...model.lines, ...model.circles, ...model.arcs].filter((item) => sketchIds.has(elementSketchId(item))).length + blockProjectionItemsToRemove.length;
    if (confirmFirst && !window.confirm(`${sketch.name} と配下のスケッチを削除します。\n図形 ${geometryCount} 件も削除されます。`)) return false;

    const pointSet = new Set(model.points.filter((point) => sketchIds.has(elementSketchId(point))));
    const lineSet = new Set(model.lines.filter((line) => sketchIds.has(elementSketchId(line)) || pointSet.has(line.p1) || pointSet.has(line.p2)));
    const circleSet = new Set(model.circles.filter((circle) => sketchIds.has(elementSketchId(circle)) || pointSet.has(circle.center)));
    const arcSet = new Set(model.arcs.filter((arc) => sketchIds.has(elementSketchId(arc)) || pointSet.has(arc.center)));
    const removedItems = [...pointSet, ...lineSet, ...circleSet, ...arcSet, ...blockProjectionItemsToRemove];
    const removedIds = new Set(removedItems.map((item) => item.id));
    const removedKeys = new Set(removedItems.map(presentationElementKey).filter(Boolean));

    model.constraints = model.constraints.filter((constraint) => {
      if (sketchIds.has(constraintSketchId(constraint)) || sketchIds.has(constraint.referenceSketchId)) return false;
      return !constraintGraphNodes(constraint).some((node) => removedItems.includes(node));
    });
    model.lines = model.lines.filter((line) => !lineSet.has(line));
    model.circles = model.circles.filter((circle) => !circleSet.has(circle));
    model.arcs = model.arcs.filter((arc) => !arcSet.has(arc));
    model.points = model.points.filter((point) => !pointSet.has(point));
    model.blockInstances = model.blockInstances.filter((instance) => !blockInstancesToRemove.includes(instance));
    invalidateBlockProjectionCache();

    for (const sheet of model.presentationSheets) {
      if (Array.isArray(sheet.visibleGeometrySketchIds)) {
        sheet.visibleGeometrySketchIds = sheet.visibleGeometrySketchIds.filter((id) => !sketchIds.has(id));
      }
      for (const key of Object.keys(sheet.elementStyles || {})) {
        if (removedKeys.has(key)) delete sheet.elementStyles[key];
      }
      sheet.elements = (sheet.elements || []).filter((element) => !valueReferencesRemovedGeometry(element.geometryRefs, removedIds, removedKeys));
    }

    const fallbackId = sketch.parentSketchId && !sketchIds.has(sketch.parentSketchId) ? sketch.parentSketchId : ROOT_SKETCH_ID;
    model.sketches = model.sketches.filter((item) => !sketchIds.has(item.id));
    if (sketchIds.has(model.activeSketchId)) model.activeSketchId = sketchById(fallbackId)?.id || ROOT_SKETCH_ID;
    for (const id of sketchIds) sketchSolveStates.delete(id);

    clearInteractionForSketchChange();
    constraintAnalysisState = null;
    solveSketchAndDependents(activeSketchId());
    refreshConstraintAnalysis();
    updateUI();
    draw();
    setHint(`${sketch.name} を削除しました`);
    recordHistory("スケッチ削除");
    return true;
  }

  function createPresentationSheet() {
    ensurePresentationState();
    const id = `PS${presentationSheetSeq++}`;
    const sheet = { id, name: `Sheet-${model.presentationSheets.length + 1}`, visibleGeometrySketchIds: null, elementStyles: {}, elements: [] };
    model.presentationSheets.push(sheet);
    model.activePresentationSheetId = id;
    updateUI();
    draw();
    recordHistory("Presentation Sheet追加");
  }

  function renamePresentationSheet() {
    const sheet = activePresentationSheet();
    if (!sheet) return;
    const next = window.prompt("Presentation Sheet name", sheet.name);
    if (!next) return;
    sheet.name = next.trim() || sheet.name;
    updateUI();
    draw();
    recordHistory("Presentation Sheet名変更");
  }

  function setActivePresentationSheet(sheetId) {
    ensurePresentationState();
    if (!model.presentationSheets.some((sheet) => sheet.id === sheetId)) return;
    model.activePresentationSheetId = sheetId;
    updateUI();
    draw();
  }

  function setAppMode(nextMode) {
    if (blockEditSession && nextMode === "presentation") {
      setHint("ブロック定義編集中はプレゼンテーション・モードへ切り替えられません", "error");
      return;
    }
    model.appMode = nextMode === "presentation" ? "presentation" : "geometry";
    cancelConstraintTargetCommand("");
    cancelPendingCommand("");
    clearSelection();
    presentationDragSession = null;
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    trimPreview = null;
    offsetSource = null;
    clearSnap();
    mode = "select";
    updateUI();
    updateToolbar();
    setHint(isPresentationMode() ? `プレゼンテーション・モード: ${activePresentationSheet().name}` : "ジオメトリ・モード");
    draw();
  }

  function updatePresentationUI() {
    ensurePresentationState();
    const geometryBtn = document.getElementById("geometryModeBtn");
    const presentationBtn = document.getElementById("presentationModeBtn");
    const sheetSelect = document.getElementById("presentationSheetSelect");
    const addSheetBtn = document.getElementById("addPresentationSheetBtn");
    const renameSheetBtn = document.getElementById("renamePresentationSheetBtn");
    const addSketchBtn = document.getElementById("addSketchBtn");
    const addChildSketchBtn = document.getElementById("addChildSketchBtn");
    const sheetLabel = document.getElementById("presentationSheetLabel");
    const styleGroup = document.getElementById("presentationStyleGroup");
    const colorInput = document.getElementById("presentationColorInput");
    const lineTypeSelect = document.getElementById("presentationLineTypeSelect");
    const lineWidthInput = document.getElementById("presentationLineWidthInput");
    const visibleInput = document.getElementById("presentationVisibleInput");
    const isPresentation = isPresentationMode();
    if (geometryBtn) {
      geometryBtn.classList.toggle("active", !isPresentation);
      geometryBtn.setAttribute("aria-pressed", String(!isPresentation));
    }
    if (presentationBtn) {
      presentationBtn.classList.toggle("active", isPresentation);
      presentationBtn.setAttribute("aria-pressed", String(isPresentation));
    }
    if (sheetSelect) {
      const current = model.activePresentationSheetId;
      sheetSelect.innerHTML = model.presentationSheets.map((sheet) => `<option value="${escapeHtml(sheet.id)}">${escapeHtml(sheet.name)}</option>`).join("");
      sheetSelect.value = current;
      sheetSelect.disabled = !isPresentation;
    }
    if (addSheetBtn) addSheetBtn.disabled = !isPresentation;
    if (renameSheetBtn) renameSheetBtn.disabled = !isPresentation;
    if (addSketchBtn) addSketchBtn.disabled = isPresentation;
    if (addChildSketchBtn) addChildSketchBtn.disabled = isPresentation;
    if (sheetLabel) {
      sheetLabel.textContent = isPresentation ? `プレゼンテーション・モード: ${activePresentationSheet().name}` : "ジオメトリ・モード";
    }
    const selectedPresentationCount = presentationSelectedItems().length;
    if (styleGroup) styleGroup.classList.toggle("has-selection", selectedPresentationCount > 0);
    const selectedStyle = selectedPresentationStyle();
    if (colorInput) {
      colorInput.disabled = !isPresentation || selectedPresentationCount === 0;
      colorInput.value = selectedStyle.color || DEFAULT_PRESENTATION_STYLE.color;
    }
    if (lineTypeSelect) {
      lineTypeSelect.disabled = !isPresentation || selectedPresentationCount === 0;
      lineTypeSelect.value = selectedStyle.lineType || DEFAULT_PRESENTATION_STYLE.lineType;
    }
    if (lineWidthInput) {
      lineWidthInput.disabled = !isPresentation || selectedPresentationCount === 0;
      lineWidthInput.value = selectedStyle.lineWidthPx || DEFAULT_PRESENTATION_STYLE.lineWidthPx;
    }
    if (visibleInput) {
      visibleInput.disabled = !isPresentation || selectedPresentationCount === 0;
      visibleInput.indeterminate = selectedStyle.visible === "";
      visibleInput.checked = selectedStyle.visible === "" ? true : selectedStyle.visible !== false;
    }
    document.body.classList.toggle("presentation-mode", isPresentation);
    document.body.classList.toggle("geometry-mode", !isPresentation);
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
        const visible = isVisibleSketchId(sketch.id);
        const visibilityEnabled = sketch.visible !== false;
        const solveError = sketchHasSolveError(sketch.id);
        const solveErrorTitle = sketchSolveErrorTitle(sketch.id);
        const duplicateCount = constraintDuplicateCountForSketch(sketch.id);
        const referenceErrorCount = referenceConstraintErrorCountForSketch(sketch.id);
        const count =
          model.points.filter((item) => elementSketchId(item) === sketch.id).length +
          model.lines.filter((item) => elementSketchId(item) === sketch.id).length +
          model.circles.filter((item) => elementSketchId(item) === sketch.id).length +
          model.arcs.filter((item) => elementSketchId(item) === sketch.id).length +
          model.blockInstances.filter((item) => item.sketchId === sketch.id).length;
        const treeLines = segments.length
          ? `<span class="sketch-tree-gutter" aria-hidden="true">${segments.map((segment) => `<span class="tree-segment ${segment}"></span>`).join("")}</span>`
          : "";
        const visibilityButton = isRoot
          ? ""
          : `<button class="sketchVisibilityBtn icon-small-btn ${visibilityEnabled ? "visible-on" : "visible-off"}" data-id="${sketch.id}" title="${visibilityEnabled ? "非表示にする" : "表示する"}" aria-label="${visibilityEnabled ? "非表示にする" : "表示する"}" aria-pressed="${visibilityEnabled}" ${isActive ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.6"/>${visibilityEnabled ? "" : '<path class="visibility-slash" d="M4 4l16 16"/>'}</svg></button>`;
        return (
          `<div class="item sketch-item ${visible ? "visible" : ""} ${visibilityEnabled ? "visibility-on" : "visibility-off"} ${isRoot ? "root" : ""} ${isActive ? "active" : ""} ${solveError ? "solve-error" : ""} ${referenceErrorCount ? "reference-error" : ""} ${hasChildren ? "has-children" : ""}" data-id="${sketch.id}" title="${escapeHtml(solveErrorTitle || (referenceErrorCount ? `参照エラー ${referenceErrorCount}件` : ""))}" style="--sketch-depth:${depth}">` +
          treeLines +
          `<button class="sketchActivateBtn" data-id="${sketch.id}" ${isActive ? "disabled" : ""}>${escapeHtml(sketch.name)}</button>` +
          `<span class="sketch-badges">${solveError ? `<span class="badge sketch-error-badge">!</span>` : ""}${referenceErrorCount ? `<span class="badge sketch-reference-error-badge" title="参照エラー">参照!${referenceErrorCount}</span>` : ""}${duplicateCount ? `<span class="badge sketch-duplicate-badge">重複${duplicateCount}</span>` : ""}<span class="badge">${count}</span></span>` +
          visibilityButton +
          (isRoot ? "" : `<button class="sketchRenameBtn icon-small-btn" data-id="${sketch.id}" title="名前変更" aria-label="名前変更">Aa</button><button class="sketchDeleteBtn icon-small-btn" data-id="${sketch.id}" title="スケッチ削除" aria-label="スケッチ削除"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg></button>`) +
          `</div>`
        );
      })
      .join("");
    for (const btn of document.querySelectorAll(".sketchActivateBtn")) {
      btn.addEventListener("click", () => setActiveSketch(btn.dataset.id));
    }
    for (const row of document.querySelectorAll(".sketch-item")) {
      row.addEventListener("click", (event) => {
        if (event.target.closest(".sketchVisibilityBtn, .sketchRenameBtn, .sketchDeleteBtn")) return;
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
    for (const btn of document.querySelectorAll(".sketchVisibilityBtn")) {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleSketchVisibility(btn.dataset.id);
      });
    }
    for (const btn of document.querySelectorAll(".sketchDeleteBtn")) {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteSketch(btn.dataset.id);
      });
    }
  }

  function geometryItemSelectedInCanvas(item) {
    if (!item) return false;
    if (item instanceof Point) return selectedPoints.includes(item);
    if (item instanceof Line) return selectedLines.includes(item);
    if (item instanceof Circle) return selectedCircles.includes(item);
    if (item instanceof Arc) return selectedArcs.includes(item) || selectedArcEndpoint?.arc === item || selectedArcEndpointPair?.some((endpoint) => endpoint.arc === item);
    return false;
  }

  function constraintSelectedInCanvas(constraint) {
    return Boolean(constraint && (selectedDimensionConstraint === constraint || effectiveSelectedConstraint() === constraint));
  }

  function fixedPointSelectedInCanvas(point) {
    return Boolean(point && selectedPoints.includes(point));
  }

  function sidebarHoverElementsForItem(item) {
    const elements = new Set();
    if (!item) return elements;
    elements.add(item);
    if (item instanceof Point) {
      for (const line of allGeometryLines()) {
        if (line.p1 === item || line.p2 === item) elements.add(line);
      }
      for (const circle of allGeometryCircles()) {
        if (circle.center === item) elements.add(circle);
      }
      for (const arc of allGeometryArcs()) {
        if (arc.center === item) elements.add(arc);
      }
      return elements;
    }
    if (item instanceof Line) {
      elements.add(item.p1);
      elements.add(item.p2);
      return elements;
    }
    if (item instanceof Circle) {
      elements.add(item.center);
      return elements;
    }
    if (item instanceof Arc) {
      elements.add(item.center);
      return elements;
    }
    return elements;
  }

  function sidebarHoverElementsForConstraint(constraint) {
    return new Set(constraint ? constraintGraphNodes(constraint).filter(Boolean) : []);
  }

  function setSidebarHover(type, item, elements) {
    hoveredSidebarItem = { type, item, elements };
    if (type === "constraint" && targetFromConstraint(item)) hoveredDimensionConstraint = item;
    draw();
  }

  function clearSidebarHover(type = null, item = null) {
    if (!hoveredSidebarItem) return;
    if (type && hoveredSidebarItem.type !== type) return;
    if (item && hoveredSidebarItem.item !== item) return;
    if (hoveredDimensionConstraint === hoveredSidebarItem.item) hoveredDimensionConstraint = null;
    hoveredSidebarItem = null;
    draw();
  }

  function updateSidebarSelectionRowClasses() {
    for (const row of document.querySelectorAll(".geometry-list-row")) {
      const item = sidebarGeometryItem(row.dataset.kind, row.dataset.id);
      row.classList.toggle("sidebar-selected", geometryItemSelectedInCanvas(item));
    }
    for (const row of document.querySelectorAll(".constraint-list-row[data-idx]")) {
      const constraint = model.constraints[Number(row.dataset.idx)];
      row.classList.toggle("sidebar-selected", constraintSelectedInCanvas(constraint));
    }
    for (const row of document.querySelectorAll(".fixed-point-list-row")) {
      const point = model.points.find((item) => item.id === row.dataset.pointId);
      row.classList.toggle("sidebar-selected", fixedPointSelectedInCanvas(point));
    }
  }

  function selectSidebarGeometryItem(item) {
    selectedDimensionConstraint = null;
    selectedConstraint = null;
    selectedArcEndpoint = null;
    selectedArcEndpointPair = null;
    if (!item) {
      updateSidebarSelectionRowClasses();
      draw();
      return;
    }
    if (item instanceof Point) toggleSidebarSelectionById(selectedPoints, item);
    else if (item instanceof Line) toggleSidebarSelectionById(selectedLines, item);
    else if (item instanceof Circle) toggleSidebarSelectionById(selectedCircles, item);
    else if (item instanceof Arc) toggleSidebarSelectionById(selectedArcs, item);
    updateToolbar();
    updateSidebarSelectionRowClasses();
    draw();
  }

  function selectSidebarConstraintItem(constraint) {
    clearSelection();
    if (!constraint) {
      updateSidebarSelectionRowClasses();
      draw();
      return;
    }
    if (targetFromConstraint(constraint)) selectedDimensionConstraint = constraint;
    else selectedConstraint = constraint;
    updateToolbar();
    updateSidebarSelectionRowClasses();
    draw();
  }

  function selectSidebarFixedPoint(point) {
    selectedDimensionConstraint = null;
    selectedConstraint = null;
    selectedArcEndpoint = null;
    selectedArcEndpointPair = null;
    if (point) toggleSidebarSelectionById(selectedPoints, point);
    updateToolbar();
    updateSidebarSelectionRowClasses();
    draw();
  }

  function sidebarGeometryItem(kind, id) {
    if (kind === "point") return model.points.find((item) => item.id === id) || null;
    if (kind === "line") return model.lines.find((item) => item.id === id) || null;
    if (kind === "circle") return model.circles.find((item) => item.id === id) || null;
    if (kind === "arc") return model.arcs.find((item) => item.id === id) || null;
    return null;
  }

  function bindSidebarItemHover() {
    for (const row of document.querySelectorAll(".geometry-list-row")) {
      row.addEventListener("mouseenter", () => {
        const item = sidebarGeometryItem(row.dataset.kind, row.dataset.id);
        setSidebarHover("geometry", item, sidebarHoverElementsForItem(item));
      });
      row.addEventListener("mouseleave", () => {
        const item = sidebarGeometryItem(row.dataset.kind, row.dataset.id);
        clearSidebarHover("geometry", item);
      });
      row.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        const item = sidebarGeometryItem(row.dataset.kind, row.dataset.id);
        selectSidebarGeometryItem(item);
      });
    }
    for (const row of document.querySelectorAll(".constraint-list-row[data-idx]")) {
      row.addEventListener("mouseenter", () => {
        const constraint = model.constraints[Number(row.dataset.idx)];
        setSidebarHover("constraint", constraint, sidebarHoverElementsForConstraint(constraint));
      });
      row.addEventListener("mouseleave", () => {
        const constraint = model.constraints[Number(row.dataset.idx)];
        clearSidebarHover("constraint", constraint);
      });
      row.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        const constraint = model.constraints[Number(row.dataset.idx)];
        selectSidebarConstraintItem(constraint);
      });
    }
    for (const row of document.querySelectorAll(".fixed-point-list-row")) {
      row.addEventListener("mouseenter", () => {
        const point = model.points.find((item) => item.id === row.dataset.pointId);
        setSidebarHover("fixed-point", point, sidebarHoverElementsForItem(point));
      });
      row.addEventListener("mouseleave", () => {
        const point = model.points.find((item) => item.id === row.dataset.pointId);
        clearSidebarHover("fixed-point", point);
      });
      row.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        const point = model.points.find((item) => item.id === row.dataset.pointId);
        selectSidebarFixedPoint(point);
      });
    }
    updateSidebarSelectionRowClasses();
  }

  function blockInstanceDisabledReference(instance, nextEnabledSketchIds) {
    const definition = blockDefinitionById(instance.definitionId);
    const enabled = new Set(nextEnabledSketchIds);
    const disabledLocalIds = new Set([...definition.points, ...definition.lines, ...definition.circles, ...definition.arcs]
      .filter((item) => !enabled.has(String(item.sketchId)))
      .map((item) => item.id));
    const referencedConstraint = model.constraints.find((constraint) => constraintGraphNodes(constraint).some((node) => node?.blockInstance === instance && disabledLocalIds.has(node.localElement?.id)));
    if (referencedConstraint) return `拘束「${constraintLabelForList(referencedConstraint)}」から参照されています`;
    const removedIds = new Set([...disabledLocalIds].map((id) => `${instance.id}@${id}`));
    const removedKeys = new Set([...removedIds].flatMap((id) => ["point", "line", "circle", "arc"].map((kind) => `${kind}:${id}`)));
    for (const sheet of model.presentationSheets) {
      const element = (sheet.elements || []).find((item) => valueReferencesRemovedGeometry(item.geometryRefs, removedIds, removedKeys));
      if (element) return `${sheet.name} の注記 ${element.id} から参照されています`;
    }
    return null;
  }

  function setBlockInstanceEnabledSketchIds(instance, nextIds) {
    if (!instance) return false;
    const definition = blockDefinitionById(instance.definitionId);
    const drawableIds = blockDefinitionDrawableSketchIds(definition);
    const next = [...new Set(nextIds.filter((id) => drawableIds.includes(id)))];
    if (!next.some((id) => blockDefinitionGeometrySketchIds(definition).includes(id))) {
      setHint("図形を持つ内部スケッチを1つ以上有効にしてください", "error");
      updateBlockUI();
      return false;
    }
    const referenceError = blockInstanceDisabledReference(instance, next);
    if (referenceError) {
      setHint(`スケッチを無効にできません: ${referenceError}`, "error");
      updateBlockUI();
      return false;
    }
    instance.enabledSketchIds = next;
    invalidateBlockProjectionCache(instance.id);
    setHint(`${blockDefinitionById(instance.definitionId)?.name || instance.id} の表示スケッチを更新しました`);
    updateUI();
    draw();
    recordHistory("ブロック構成変更");
    return true;
  }

  function updateBlockUI() {
    ensureBlockState();
    const list = document.getElementById("blockList");
    const title = document.getElementById("blockOverlayTitle");
    const nameInput = document.getElementById("blockEditorNameInput");
    const editorActions = document.getElementById("blockEditorActions");
    const sketchConfig = document.getElementById("blockSketchConfig");
    if (title) title.textContent = blockEditSession ? "ブロックエディタ" : "ブロック";
    if (nameInput) {
      nameInput.hidden = !blockEditSession;
      if (blockEditSession && document.activeElement !== nameInput) nameInput.value = blockEditSession.draft.name;
    }
    if (editorActions) editorActions.hidden = !blockEditSession;
    if (!list) return;
    list.hidden = Boolean(blockEditSession);
    if (blockEditSession) {
      if (sketchConfig) sketchConfig.hidden = true;
      return;
    }
    if (model.blockDefinitions.length === 0) {
      list.innerHTML = '<div class="block-item"><span class="block-item-name">ブロックはありません</span></div>';
      if (sketchConfig) sketchConfig.hidden = true;
      return;
    }
    list.innerHTML = model.blockDefinitions.map((definition) => {
      const count = (blockEditSession ? blockEditSession.original.blockInstances : model.blockInstances).filter((instance) => instance.definitionId === definition.id).length;
      return `<div class="block-item" data-id="${escapeHtml(definition.id)}"><span class="block-item-name" title="${escapeHtml(definition.name)}">${escapeHtml(definition.name)}</span><span class="block-item-count">${count}</span><button class="blockPlaceBtn" data-id="${escapeHtml(definition.id)}" ${blockEditSession ? "disabled" : ""}>配置</button><button class="blockEditBtn" data-id="${escapeHtml(definition.id)}" ${blockEditSession ? "disabled" : ""}>編集</button><button class="blockRenameBtn" data-id="${escapeHtml(definition.id)}" ${blockEditSession ? "disabled" : ""}>Aa</button><button class="blockDeleteBtn" data-id="${escapeHtml(definition.id)}" ${blockEditSession ? "disabled" : ""}>削除</button></div>`;
    }).join("");
    for (const button of document.querySelectorAll(".blockPlaceBtn")) button.addEventListener("click", () => startBlockPlacement(button.dataset.id));
    for (const button of document.querySelectorAll(".blockEditBtn")) button.addEventListener("click", () => enterBlockDefinitionEdit(button.dataset.id));
    for (const button of document.querySelectorAll(".blockRenameBtn")) button.addEventListener("click", () => renameBlockDefinition(button.dataset.id));
    for (const button of document.querySelectorAll(".blockDeleteBtn")) button.addEventListener("click", () => deleteBlockDefinition(button.dataset.id));
    for (const row of document.querySelectorAll(".block-item[data-id]")) row.addEventListener("dblclick", (event) => {
      if (!event.target.closest("button")) enterBlockDefinitionEdit(row.dataset.id);
    });
    const configuringPlacement = mode === "block-place" && blockPlacementDefinitionId;
    const configuringInstance = !configuringPlacement && selectedBlockInstances.length === 1 ? selectedBlockInstances[0] : null;
    const definition = configuringPlacement ? blockDefinitionById(blockPlacementDefinitionId) : configuringInstance ? blockDefinitionById(configuringInstance.definitionId) : null;
    if (!sketchConfig || !definition) {
      if (sketchConfig) sketchConfig.hidden = true;
      return;
    }
    sketchConfig.hidden = false;
    const enabled = new Set(configuringPlacement ? blockPlacementEnabledSketchIds : configuringInstance.enabledSketchIds);
    const children = new Map();
    for (const sketch of definition.sketches) {
      if (!children.has(sketch.parentSketchId)) children.set(sketch.parentSketchId, []);
      children.get(sketch.parentSketchId).push(sketch);
    }
    const rows = [];
    const visit = (parentId, depth) => {
      for (const sketch of children.get(parentId) || []) {
        if (sketch.kind === "root") continue;
        rows.push({ sketch, depth });
        visit(sketch.id, depth + 1);
      }
    };
    visit(ROOT_SKETCH_ID, 0);
    sketchConfig.innerHTML = `<div class="block-sketch-config-title">${configuringPlacement ? "配置するスケッチ" : "表示するスケッチ"}</div>` + rows.map(({ sketch, depth }) => {
      const count = [...definition.lines, ...definition.circles, ...definition.arcs].filter((item) => item.sketchId === sketch.id).length;
      return `<label class="block-sketch-option" style="--block-sketch-depth:${depth}"><input type="checkbox" data-sketch-id="${escapeHtml(sketch.id)}" ${enabled.has(sketch.id) ? "checked" : ""}><span>${escapeHtml(sketch.name)}</span><small>${count}</small></label>`;
    }).join("");
    for (const input of sketchConfig.querySelectorAll("input[data-sketch-id]")) {
      input.addEventListener("change", () => {
        const next = [...sketchConfig.querySelectorAll("input[data-sketch-id]:checked")].map((item) => item.dataset.sketchId);
        if (configuringPlacement) {
          blockPlacementEnabledSketchIds = next;
          invalidateBlockProjectionCache();
          draw();
          return;
        }
        setBlockInstanceEnabledSketchIds(configuringInstance, next);
      });
    }
  }

  function updateUI() {
    refreshConstraintAnalysis();
    updatePresentationUI();
    updateToolbar();
    updateSketchUI();
    updateBlockUI();
    document.getElementById("pointList").innerHTML = model.points
      .filter(isActiveSketchElement)
      .filter(isExplicitPoint)
      .map(
        (p) =>
          `<div class="item list-item geometry-list-row" data-kind="point" data-id="${p.id}"><span>${p.id}` +
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
          `<div class="item list-item geometry-list-row" data-kind="line" data-id="${l.id}"><span>${l.id}: ${l.p1.id} - ${l.p2.id}<span class="badge">len=${formatDisplayNumber(l.length())}</span><span class="badge">${constraintStatusBadge(constraintStatusOf(l))}</span>${l.construction ? "<span class='badge'>補助</span>" : ""}${findLineFixedConstraint(l) ? "<span class='badge'>固定</span>" : ""}</span>` +
          `<button data-id="${l.id}" class="removeLineBtn icon-delete-btn" title="削除" aria-label="削除" data-tooltip="削除">` +
          `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>` +
          `</button></div>`,
      )
      .join("");

    document.getElementById("circleList").innerHTML = model.circles
      .filter(isActiveSketchElement)
      .map(
        (circle) =>
          `<div class="item list-item geometry-list-row" data-kind="circle" data-id="${circle.id}"><span>${circle.id}: 中心 ${circle.center.id}<span class="badge">R=${formatDisplayNumber(circle.radius())}</span><span class="badge">${constraintStatusBadge(constraintStatusOf(circle))}</span>${circle.construction ? "<span class='badge'>補助</span>" : ""}</span>` +
          `<button data-id="${circle.id}" class="removeCircleBtn icon-delete-btn" title="削除" aria-label="削除" data-tooltip="削除">` +
          `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>` +
          `</button></div>`,
      )
      .join("");

    document.getElementById("arcList").innerHTML = model.arcs
      .filter(isActiveSketchElement)
      .map(
        (arc) =>
          `<div class="item list-item geometry-list-row" data-kind="arc" data-id="${arc.id}"><span>${arc.id}: 中心 ${arc.center.id}<span class="badge">R=${formatDisplayNumber(arc.radius())}</span><span class="badge">角度=${formatDisplayNumber(angleDegrees(Math.abs(arc.endAngle - arc.startAngle)))}°</span><span class="badge">${constraintStatusBadge(constraintStatusOf(arc))}</span>${arc.construction ? "<span class='badge'>補助</span>" : ""}</span>` +
          `<button data-id="${arc.id}" class="removeArcBtn icon-delete-btn" title="削除" aria-label="削除" data-tooltip="削除">` +
          `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>` +
          `</button></div>`,
      )
      .join("");

    const listedConstraints = model.constraints
      .map((constraint, index) => ({ constraint, index }))
      .filter(({ constraint }) => isActiveSketchConstraint(constraint) && !isReadOnlyDimension(constraint));
    const fixedPoints = model.points.filter((point) => isActiveSketchElement(point) && point.fixed);
    const constraintRows = listedConstraints.map(({ constraint, index }, displayIndex) => {
      const duplicate = constraintIsRedundant(constraint);
      const referenceError = referenceConstraintErrorInfo(constraint);
      return `<div class="item constraint-item constraint-list-row ${duplicate ? "duplicate" : ""} ${referenceError ? "reference-error" : ""}" data-idx="${index}" title="${escapeHtml(referenceError || "")}"><span>${displayIndex + 1}. ${constraint.name}${referenceError ? `<span class="badge constraint-reference-error-badge">参照エラー</span>` : ""}${duplicate ? `<span class="badge constraint-duplicate-badge">重複</span>` : ""}</span>` +
        `<button data-idx="${index}" class="removeConstraintBtn" title="削除" aria-label="削除" data-tooltip="削除">` +
        `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>` +
        `</button></div>`;
    });
    const fixedPointRows = fixedPoints.map((point, fixedIndex) => {
      const displayIndex = listedConstraints.length + fixedIndex + 1;
      return `<div class="item constraint-item fixed-point-list-row" data-point-id="${point.id}"><span>${displayIndex}. 固定 ${point.id}</span>` +
        `<button data-id="${point.id}" class="removeFixedPointBtn icon-delete-btn" title="固定解除" aria-label="固定解除" data-tooltip="固定解除">` +
        `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>` +
        `</button></div>`;
    });
    document.getElementById("constraintList").innerHTML =
      `<div class="item constraint-item"><span>${constraintSummaryText()}</span></div>` + [...constraintRows, ...fixedPointRows].join("");

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

    for (const btn of document.querySelectorAll(".removeFixedPointBtn")) {
      btn.addEventListener("click", () => {
        const point = model.points.find((item) => item.id === btn.dataset.id);
        if (!point) return;
        point.fixed = false;
        solveAndRefresh(`固定解除 ${point.id}`);
      });
    }

    for (const btn of document.querySelectorAll(".removeCircleBtn")) {
      btn.addEventListener("click", () => {
        const circle = model.circles.find((item) => item.id === btn.dataset.id);
        if (circle) deleteElements({ circles: [circle] });
      });
    }

    for (const btn of document.querySelectorAll(".removeArcBtn")) {
      btn.addEventListener("click", () => {
        const arc = model.arcs.find((item) => item.id === btn.dataset.id);
        if (arc) deleteElements({ arcs: [arc] });
      });
    }

    bindSidebarItemHover();

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

  function preconditionOffsetConstraint(constraint) {
    if (!(constraint instanceof OffsetConstraint)) return;
    const { source, offset, target, sign } = constraint;
    if (source instanceof Line && offset instanceof Line) {
      const normal = lineNormal(source);
      const dx = normal.x * sign * target;
      const dy = normal.y * sign * target;
      offset.p1.x = source.p1.x + dx;
      offset.p1.y = source.p1.y + dy;
      offset.p2.x = source.p2.x + dx;
      offset.p2.y = source.p2.y + dy;
      return;
    }
    offset.center.x = source.center.x;
    offset.center.y = source.center.y;
    offset.radiusValue = Math.max(MIN_ORIENTATION_LENGTH, source.radius() + sign * target);
    if (source instanceof Arc && offset instanceof Arc) {
      offset.startAngle = source.startAngle;
      offset.endAngle = source.endAngle;
    }
  }

  function preconditionNewConstraint(constraint) {
    if (constraint instanceof ArcEndpointOnLineConstraint) {
      preconditionArcEndpointOnLineConstraint(constraint);
    } else if (constraint instanceof ArcEndpointCoincidentConstraint) {
      preconditionArcEndpointCoincidentConstraint(constraint);
    } else if (constraint instanceof ArcEndpointArcEndpointCoincidentConstraint) {
      preconditionArcEndpointArcEndpointCoincidentConstraint(constraint);
    } else if (constraint instanceof OffsetConstraint) {
      preconditionOffsetConstraint(constraint);
    }
  }

  function solveStepNormForConstraint(constraint) {
    if (!constraint) return solver.maxStepNorm;
    const e = constraint.error();
    const values = Array.isArray(e) ? e : [e];
    const errorNorm = vectorNorm(values);
    return Math.max(solver.maxStepNorm, errorNorm * 1.5);
  }

  function withTemporarySolveStepNorm(stepNorm, callback) {
    const previous = solver.maxStepNorm;
    solver.maxStepNorm = Math.max(previous, Number.isFinite(stepNorm) ? stepNorm : previous);
    try {
      return callback();
    } finally {
      solver.maxStepNorm = previous;
    }
  }

  function addReadOnlyDimensionConstraint(constraint, sketchId = constraintSketchId(constraint), messagePrefix = "重複寸法") {
    if (!isDimensionConstraint(constraint)) return false;
    const target = targetFromConstraint(constraint);
    if (!target) return false;
    constraint.target = measuredConstraintTargetValue(constraint, target, constraint.dimension);
    constraint.readOnlyDimension = true;
    constraint.enabled = false;
    pushModelConstraint(constraint, sketchId);
    clearSelection();
    refreshConstraintAnalysis();
    updateUI();
    draw();
    setHint(`${messagePrefix}を読み取り専用寸法として追加しました`);
    log(`${messagePrefix}を読み取り専用寸法として追加しました`);
    recordHistory(`${messagePrefix}を読み取り専用寸法として追加`);
    return true;
  }

  function commitNewConstraint(type, constraint) {
    if (rejectPresentationGeometryEdit("Constraints")) return false;
    if (!constraintTargetsAreActive(constraint)) {
      const msg = "別スケッチ同士は通常拘束できません";
      setHint(msg, "error");
      log(msg);
      return false;
    }
    const snapshot = snapshotModelState();
    const solveStepNorm = solveStepNormForConstraint(constraint);
    pushModelConstraint(constraint);
    preconditionNewConstraint(constraint);

    const solved = withTemporarySolveStepNorm(solveStepNorm, () => solveSketchAndDependents(constraintSketchId(constraint), snapshot));
    const result = solved.result;
    const collapse = findLineCollapseAfterConstraint(constraint, snapshot, constraintSketchId(constraint));
    const duplicate = solved.success && result.errorNorm <= CONSTRAINT_ACCEPT_ERROR && !collapse ? redundantConstraintInfo(constraint, constraintSketchId(constraint)) : null;
    if (!solved.success || result.errorNorm > CONSTRAINT_ACCEPT_ERROR || collapse || duplicate?.redundant) {
      if (duplicate?.redundant && isDimensionConstraint(constraint)) {
        restoreModelState(snapshot);
        return addReadOnlyDimensionConstraint(constraint, constraintSketchId(constraint));
      }
      restoreModelState(snapshot);
      const msg = `拘束を追加できません: 矛盾しています (error=${result.errorNorm.toExponential(3)}, reason=${result.reason})`;
      const collapseMsg = collapse
        ? `拘束を追加できません: 線${collapse.line.id}が退化するため矛盾しています (${collapse.before.toExponential(3)} -> ${collapse.after.toExponential(3)})`
        : msg;
      const duplicateMsg = duplicate?.redundant
        ? `拘束を追加できません: 重複しています (rank ${duplicate.rankBefore} -> ${duplicate.rankAfter})`
        : collapseMsg;
      setHint(duplicateMsg, "error");
      updateUI();
      draw();
      log(duplicateMsg);
      return;
    }

    clearSelection();
    updateUI();
    draw();
    setHint(`拘束追加: success=${result.success}, error=${result.errorNorm.toExponential(2)}, iter=${result.iterations} / ${constraintSummaryText()}`);
    log(`拘束を追加しました: ${type}\n自動solve: success=${result.success}, error=${result.errorNorm.toExponential(3)}`);
    recordHistory(`拘束追加: ${type}`);
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
    if (!constraint || !isReferenceSourceSketchId(referenceSketchId, sketchId)) {
      const msg = descendantSketchIds(sketchId).includes(referenceSketchId) ? "子孫スケッチは参照できません" : "参照可能な非下位スケッチのみ参照できます";
      setHint(msg, "error");
      log(msg);
      return false;
    }
    if (wouldCreateReferenceCycle(sketchId, referenceSketchId)) {
      const msg = "スケッチ間の参照が循環するため追加できません";
      setHint(msg, "error");
      log(msg);
      return false;
    }
    const snapshot = snapshotModelState();
    markReferenceConstraint(constraint, referenceSketchId, sketchId);
    const solveStepNorm = solveStepNormForConstraint(constraint);
    pushModelConstraint(constraint, sketchId);
    preconditionNewConstraint(constraint);
    const solved = withTemporarySolveStepNorm(solveStepNorm, () => solveSketchAndDependents(sketchId, snapshot));
    const result = solved.result;
    const collapse = findLineCollapseAfterConstraint(constraint, snapshot, sketchId);
    const duplicate = solved.success && result.errorNorm <= CONSTRAINT_ACCEPT_ERROR && !collapse ? redundantConstraintInfo(constraint, sketchId) : null;
    if (!solved.success || result.errorNorm > CONSTRAINT_ACCEPT_ERROR || collapse || duplicate?.redundant) {
      if (duplicate?.redundant && isDimensionConstraint(constraint)) {
        restoreModelState(snapshot);
        return addReadOnlyDimensionConstraint(constraint, sketchId, "重複参照寸法");
      }
      restoreModelState(snapshot);
      const msg = `参照拘束を追加できません: 矛盾しています (error=${result.errorNorm.toExponential(3)}, reason=${result.reason})`;
      const collapseMsg = collapse
        ? `参照拘束を追加できません: 線${collapse.line.id}が退化するため矛盾しています (${collapse.before.toExponential(3)} -> ${collapse.after.toExponential(3)})`
        : msg;
      const duplicateMsg = duplicate?.redundant
        ? `参照拘束を追加できません: 重複しています (rank ${duplicate.rankBefore} -> ${duplicate.rankAfter})`
        : collapseMsg;
      setHint(duplicateMsg, "error");
      updateUI();
      draw();
      log(duplicateMsg);
      return false;
    }
    clearSelection();
    updateUI();
    draw();
    setHint(`参照拘束追加: ${sketchName(referenceSketchId)} を参照 / success=${result.success}, error=${result.errorNorm.toExponential(2)}`);
    log(`参照拘束を追加しました: ${type}\n自動solve: success=${result.success}, error=${result.errorNorm.toExponential(3)}`);
    recordHistory(`参照拘束追加: ${type}`);
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
      if (referenceTarget.kind === "point") return new PointOnLineConstraint(referenceTarget.point, subject.line);
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

  function presentationTargetToData(target) {
    if (!target) return null;
    if (target.kind === "point-point") return { kind: target.kind, p1: target.p1.id, p2: target.p2.id, dimensionAxis: target.dimensionAxis || null };
    if (target.kind === "point-line") return { kind: target.kind, point: target.point.id, line: target.line.id };
    if (target.kind === "line-line") return { kind: target.kind, line1: target.line1.id, line2: target.line2.id };
    if (target.kind === "line-length") return { kind: target.kind, line: target.line.id };
    if (target.kind === "angle") return { kind: target.kind, line1: target.line1.id, line2: target.line2.id };
    if (target.kind === "radius" || target.kind === "diameter") return { kind: target.kind, primitive: target.primitive.id };
    return null;
  }

  function presentationTargetFromData(data) {
    if (!data || typeof data !== "object") return null;
    const point = (id) => allGeometryPoints().find((item) => item.id === id) || null;
    const line = (id) => allGeometryLines().find((item) => item.id === id) || null;
    const primitive = (id) => allGeometryCircles().find((item) => item.id === id) || allGeometryArcs().find((item) => item.id === id) || null;
    if (data.kind === "point-point") {
      const p1 = point(data.p1);
      const p2 = point(data.p2);
      return p1 && p2 ? { kind: "point-point", p1, p2, dimensionAxis: data.dimensionAxis || null, value: hypot2(p2.x - p1.x, p2.y - p1.y) } : null;
    }
    if (data.kind === "point-line") {
      const p = point(data.point);
      const l = line(data.line);
      return p && l ? { kind: "point-line", point: p, line: l, value: Math.abs(signedPointLineDistance(p, l)) } : null;
    }
    if (data.kind === "line-line") {
      const line1 = line(data.line1);
      const line2 = line(data.line2);
      return line1 && line2 ? { kind: "line-line", line1, line2, value: Math.abs(signedPointLineDistance(line1.p1, line2)) } : null;
    }
    if (data.kind === "line-length") {
      const l = line(data.line);
      return l ? { kind: "line-length", line: l, p1: l.p1, p2: l.p2, value: l.length() } : null;
    }
    if (data.kind === "angle") {
      const line1 = line(data.line1);
      const line2 = line(data.line2);
      return line1 && line2 ? { kind: "angle", line1, line2, value: angleDegrees(Math.abs(angleDimensionSweep({ line1, line2 }))), signedValue: angleDimensionSweep({ line1, line2 }) } : null;
    }
    if (data.kind === "radius" || data.kind === "diameter") {
      const p = primitive(data.primitive);
      return p ? { kind: data.kind, primitive: p, value: data.kind === "diameter" ? p.radius() * 2 : p.radius() } : null;
    }
    return null;
  }

  function presentationTargetValue(target) {
    if (!target) return NaN;
    if (target.kind === "point-point") {
      if (target.dimensionAxis === "x") return Math.abs(target.p2.x - target.p1.x);
      if (target.dimensionAxis === "y") return Math.abs(target.p2.y - target.p1.y);
      return hypot2(target.p2.x - target.p1.x, target.p2.y - target.p1.y);
    }
    if (target.kind === "point-line") return Math.abs(signedPointLineDistance(target.point, target.line));
    if (target.kind === "line-line") return Math.abs(signedPointLineDistance(target.line1.p1, target.line2));
    if (target.kind === "line-length") return target.line.length();
    if (target.kind === "angle") return angleDegrees(Math.abs(angleDimensionSweep(target)));
    if (target.kind === "radius") return target.primitive.radius();
    if (target.kind === "diameter") return target.primitive.radius() * 2;
    if (target.kind === "offset-distance") {
      if (target.source instanceof Line) return Math.abs(signedPointLineDistance(target.offset.p1, target.source));
      return Math.abs(target.offset.radius() - target.source.radius());
    }
    return target.value;
  }

  function splitConstraintOperands(operands) {
    return {
      active: operands.filter((operand) => operand.relation === "active"),
      reference: operands.filter((operand) => operand.relation === "reference"),
      descendant: operands.filter((operand) => operand.relation === "descendant"),
    };
  }

  function referenceResolutionFromOperands(type, operands) {
    const { active, reference } = splitConstraintOperands(operands);
    if (active.length !== 1 || reference.length !== 1) return { error: "参照拘束はアクティブスケッチ側1つと参照可能スケッチ側1つを選択してください" };
    return constraintResolutionFromSubjectAndReference(type, subjectFromOperand(active[0]), referenceTargetFromOperand(reference[0]));
  }

  function normalConstraintFromOperands(type, operands) {
    const previous = {
      points: selectedPoints,
      lines: selectedLines,
      circles: selectedCircles,
      arcs: selectedArcs,
      arcEndpoint: selectedArcEndpoint,
      arcEndpointPair: selectedArcEndpointPair,
    };
    constraintOperands = operands.slice();
    syncSelectionFromConstraintOperands();
    const constraint = constraintFromSelection(type);
    selectedPoints = previous.points;
    selectedLines = previous.lines;
    selectedCircles = previous.circles;
    selectedArcs = previous.arcs;
    selectedArcEndpoint = previous.arcEndpoint;
    selectedArcEndpointPair = previous.arcEndpointPair;
    return constraint;
  }

  function resolveConstraintIntent(type, operands) {
    const cleanOperands = operands.filter(Boolean);
    const { active, reference, descendant } = splitConstraintOperands(cleanOperands);
    if (descendant.length > 0) return { error: "子孫スケッチは参照できません" };
    if (reference.length > 0) {
      if (cleanOperands.length < 2 || active.length === 0) return null;
      if (cleanOperands.length !== 2) return { error: "参照拘束はアクティブスケッチ側と参照可能スケッチ側を1つずつ選択してください" };
      const resolution = referenceResolutionFromOperands(type, cleanOperands);
      if (type === "distance" && resolution?.target) return { ...resolution, action: "place-dimension", operands: cleanOperands };
      return resolution?.constraint ? { ...resolution, action: "commit", operands: cleanOperands } : resolution;
    }
    if (active.length !== cleanOperands.length) return { error: "拘束対象はアクティブスケッチ、または参照可能スケッチだけを選択できます" };
    const sketchIds = [...new Set(cleanOperands.map((operand) => operand.sketchId))];
    if (sketchIds.length > 1) return { error: "別スケッチ同士は通常拘束できません" };
    if (type === "distance") {
      const target = distanceTargetFromOperands(cleanOperands);
      if (!target || target.kind === "invalid") return target?.kind === "invalid" ? { error: target.reason } : null;
      return { type, action: "place-dimension", target, operands: cleanOperands, sketchId: sketchIds[0] || activeSketchId() };
    }
    const constraint = normalConstraintFromOperands(type, cleanOperands);
    return constraint ? { type, action: "commit", constraint, operands: cleanOperands, sketchId: sketchIds[0] || activeSketchId() } : null;
  }

  function referenceSketchIdFromPair(subject, referenceTarget) {
    const subjectSketchId = referenceSubjectSketchId(subject);
    if (!subjectSketchId || !referenceTarget?.sketchId) return null;
    return isReferenceSourceSketchId(referenceTarget.sketchId, subjectSketchId) ? referenceTarget.sketchId : null;
  }

  function constraintResolutionFromSubjectAndReference(type, subject, referenceTarget) {
    const subjectElement = referenceSubjectElement(subject);
    const subjectSketchId = referenceSubjectSketchId(subject);
    const referenceSketchId = referenceSketchIdFromPair(subject, referenceTarget);
    if (!subject || !subjectElement || !isEditableSketchElement(subjectElement)) {
      return { error: "アクティブスケッチ側の対象を選択してください" };
    }
    if (!referenceTarget || !referenceSketchId) {
      return { error: referenceTarget?.sketchId && descendantSketchIds(subjectSketchId).includes(referenceTarget.sketchId) ? "子孫スケッチは参照できません" : "参照可能な非下位スケッチのみ参照できます" };
    }
    if (wouldCreateReferenceCycle(subjectSketchId, referenceSketchId)) {
      return { error: "スケッチ間の参照が循環するため追加できません" };
    }
    if (type === "distance") {
      const target = referenceDistanceTargetForSubject(subject, referenceTarget);
      if (!target || target.kind === "invalid") return { error: target?.reason || "参照寸法の組み合わせに対応していません" };
      return { type, target, referenceSketchId, sketchId: subjectSketchId };
    }
    const constraint = referenceConstraintForType(type, subject, referenceTarget);
    if (!constraint) return { error: "この参照拘束の組み合わせには対応していません" };
    return { type, constraint, referenceSketchId, sketchId: subjectSketchId };
  }

  function constraintResolutionFromCurrentSelection(type) {
    if (constraintOperands.length > 0) return resolveConstraintIntent(type, constraintOperands);
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
    if (resolution.operands) {
      constraintOperands = resolution.operands.slice();
      syncSelectionFromConstraintOperands();
    }
    pendingConstraintCommand = { type: "distance" };
    pendingCommand = {
      type: "distance-place",
      target: resolution.target,
      resolution,
      pointer: initialPointer,
      dimension: initialDimension,
      operands: resolution.operands || constraintOperands.slice(),
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
    const ok = resolution.referenceSketchId
      ? commitReferenceConstraint(resolution.type || "reference", resolution.constraint, resolution.referenceSketchId, resolution.sketchId || activeSketchId())
      : commitNewConstraint(resolution.type || "constraint", resolution.constraint);
    if (ok) recordHistory(`拘束追加: ${resolution.type || "constraint"}`);
    return ok;
  }

  function distanceConstraintFromTarget(target, value, dimension, options = {}) {
    if (!target || target.kind === "invalid") return null;
    let constraint = null;
    if (target.kind === "point-point" || target.kind === "line-length") {
      const axis = target.dimensionAxis || dimension?.axis;
      constraint = target.kind === "point-point" && (axis === "x" || axis === "y")
        ? new PointAxisDistanceConstraint(target.p1, target.p2, value, axis)
        : new DistanceConstraint(target.p1, target.p2, value);
    } else if (target.kind === "point-line") {
      constraint = new PointLineDistanceConstraint(target.point, target.line, value);
    } else if (target.kind === "line-line") {
      if (!linesAreParallel(target.line1, target.line2)) {
        if (!options.silent) {
          setHint("線-線寸法は平行線のみです", "error");
          log("線-線寸法は平行線のみです");
        }
        return null;
      }
      constraint = new LineLineDistanceConstraint(target.line1, target.line2, value);
    } else if (target.kind === "angle") {
      constraint = new LineAngleConstraint(target.line1, target.line2, (value * Math.PI) / 180, dimension?.angleStartFlip || 0, dimension?.angleEndFlip || 0);
    } else if (target.kind === "radius") {
      constraint = new RadiusConstraint(target.primitive, value);
    } else if (target.kind === "diameter") {
      constraint = new DiameterConstraint(target.primitive, value);
    }
    if (constraint) constraint.dimension = dimension;
    return constraint;
  }

  function readOnlyDimensionConstraintForPlacement(target, value, dimension, options = {}) {
    const constraint = distanceConstraintFromTarget(target, value, dimension, { silent: true });
    if (!constraint) return null;
    const targetItems = target.kind === "point-point"
      ? [target.p1, target.p2]
      : target.kind === "point-line"
        ? [target.point, target.line]
        : target.kind === "line-line" || target.kind === "angle"
          ? [target.line1, target.line2]
          : target.kind === "line-length"
            ? [target.line]
            : target.primitive
              ? [target.primitive]
              : [];
    const blockInstances = [...new Set(targetItems.map((item) => item?.blockInstance).filter(Boolean))];
    if (targetItems.length > 0 && blockInstances.length === 1 && targetItems.every((item) => item?.blockInstance === blockInstances[0])) return constraint;
    const sketchId = options.sketchId || activeSketchId();
    assignConstraintSketchId(constraint, sketchId);
    if (options.referenceSketchId) markReferenceConstraint(constraint, options.referenceSketchId, sketchId);
    model.constraints.push(constraint);
    const duplicate = redundantConstraintInfo(constraint, sketchId);
    model.constraints = model.constraints.filter((item) => item !== constraint);
    return duplicate?.redundant ? constraint : null;
  }

  function addDistanceConstraintFromTarget(target, value, dimension, options = {}) {
    const constraint = distanceConstraintFromTarget(target, value, dimension);
    if (!constraint) return false;
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
    const resolution = constraintResolutionFromCurrentSelection(type);
    if (!resolution || resolution.error) {
      if (resolution?.error) setHint(resolution.error, "error");
      return;
    }
    if (resolution.action === "place-dimension" || resolution.target) return startDistanceResolution(resolution, null);
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
    if (kind === "block" || kind === "block-rotation") {
      if (item.fixed) return null;
      const definition = blockDefinitionById(item.definitionId);
      const localCenter = blockLocalGeometryBounds(definition, [...blockInstanceEnabledSketchSet(item, definition)])?.center || definition?.origin || { x: 0, y: 0 };
      return {
        kind,
        sketchId: item.sketchId,
        mode: kind,
        item,
        startPointer: pointer,
        startX: item.x,
        startY: item.y,
        startRotation: item.rotation,
        localCenter,
        rotationPivot: blockWorldPoint(item, localCenter),
      };
    }
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
    if ((session.kind === "block" || session.kind === "block-rotation") && session.item && !session.item.fixed) {
      const existing = new Set(session.local.variables.filter((variable) => variable.object === session.item).map((variable) => variable.prop));
      if (!existing.has("x")) session.local.variables.push({ object: session.item, prop: "x", label: `${session.item.id}.x` });
      if (!existing.has("y")) session.local.variables.push({ object: session.item, prop: "y", label: `${session.item.id}.y` });
      if (!existing.has("rotation")) session.local.variables.push({ object: session.item, prop: "rotation", label: `${session.item.id}.rotation` });
    }
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
    return selectedPoints.length + selectedLines.length + selectedCircles.length + selectedArcs.length + selectedBlockInstances.length + (selectedArcEndpoint ? 1 : 0);
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
    selectedConstraint = null;
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
    return withDragStepNorm(dragStepNormForTargets(targets), () =>
      solver.solveSubsetGuided({
        variables: session.local.variables,
        constraints: session.local.constraints,
        lines: session.local.lines,
        targets,
      }),
    );
  }

  function dragStepNormForTargets(targets = []) {
    let maxDelta = solver.maxStepNorm;
    for (const target of targets) {
      if (target.point) {
        maxDelta = Math.max(maxDelta, hypot2(target.x - target.point.x, target.y - target.point.y));
      } else if (target.object && target.prop) {
        maxDelta = Math.max(maxDelta, Math.abs(target.value - target.object[target.prop]));
      }
    }
    return Math.max(solver.maxStepNorm, maxDelta * 1.25);
  }

  function dragStepNormForExtra(extra = []) {
    let maxDelta = solver.maxStepNorm;
    for (const constraint of extra) {
      if (constraint instanceof DragConstraint) {
        maxDelta = Math.max(maxDelta, hypot2(constraint.targetX - constraint.point.x, constraint.targetY - constraint.point.y));
      } else if (constraint instanceof ArcEndpointDragConstraint) {
        const p = arcEndpointPoint(constraint.arc, constraint.endpoint);
        maxDelta = Math.max(maxDelta, hypot2(constraint.targetX - p.x, constraint.targetY - p.y));
      } else if (constraint instanceof ParameterDragConstraint) {
        maxDelta = Math.max(maxDelta, Math.abs(constraint.target - constraint.object[constraint.prop]));
      }
    }
    return Math.max(solver.maxStepNorm, maxDelta * 1.25);
  }

  function withDragStepNorm(stepNorm, callback) {
    const previous = solver.maxStepNorm;
    solver.maxStepNorm = Math.max(previous, Number.isFinite(stepNorm) ? stepNorm : previous);
    try {
      return callback();
    } finally {
      solver.maxStepNorm = previous;
    }
  }

  function solveDragWithFallback(session, extra, fullSolve, restoreState = null) {
    const stepNorm = dragStepNormForExtra(extra);
    const localResult = withDragStepNorm(stepNorm, () => solveLocalDrag(session, extra));
    if (localResult && localResult.success && localResult.errorNorm <= CONSTRAINT_ACCEPT_ERROR) return localResult;
    if (restoreState) solver.restore(restoreState);
    const result = withDragStepNorm(stepNorm, fullSolve);
    result.local = false;
    result.fallback = Boolean(localResult);
    result.localErrorNorm = localResult?.errorNorm;
    return result;
  }

  function solveGuidedDragWithFallback(session, targets, fallbackExtra, fullSolve, restoreState = null) {
    const stepNorm = Math.max(dragStepNormForTargets(targets), dragStepNormForExtra(fallbackExtra));
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
    const localResult = withDragStepNorm(stepNorm, () => solveLocalGuidedDrag(session, targets));
    if (localResult && localResult.success && localResult.errorNorm <= CONSTRAINT_ACCEPT_ERROR) return localResult;
    if (restoreState) solver.restore(restoreState);
    const result = withDragStepNorm(stepNorm, fullSolve);
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
    if (session.mode === "block" || session.mode === "block-rotation") {
      const targets = session.mode === "block"
        ? [
            { object: session.item, prop: "x", value: session.startX + pointer.x - session.startPointer.x },
            { object: session.item, prop: "y", value: session.startY + pointer.y - session.startPointer.y },
          ]
        : (() => {
            const rotation = Math.atan2(pointer.y - session.rotationPivot.y, pointer.x - session.rotationPivot.x);
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            return [
              { object: session.item, prop: "x", value: session.rotationPivot.x - session.localCenter.x * cos + session.localCenter.y * sin },
              { object: session.item, prop: "y", value: session.rotationPivot.y - session.localCenter.x * sin - session.localCenter.y * cos },
              { object: session.item, prop: "rotation", value: rotation },
            ];
          })();
      const extra = parameterDragConstraintsFromTargets(targets);
      const retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solveDragSketch(session, extra), dragState);
      result = retry();
      invalidateBlockProjectionCache(session.item.id);
      return finalizeDragResult(result, dragState, session, extra, retry);
    }
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
    if (session.mode === "block") return "ブロック移動";
    if (session.mode === "block-rotation") return "ブロック回転";
    if (session.kind === "selection") return "選択移動";
    if (session.mode === "radius" && session.activeMode === "move") return "ドラッグ";
    if (session.mode === "radius") return "半径変更";
    if (session.mode === "arc-endpoint") return "円弧端点変更";
    return "ドラッグ";
  }

  function beginDrag(e, hitP, hitL, hitC, hitA, hitArcEnd, pointer) {
    selectedConstraint = null;
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
    selectedConstraint = null;
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
    if (isReadOnlyDimension(constraint)) return;
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
    if (lineStartPoint) beginTransientLineCompletionRollback();
    else beginTransientLineStartRollback();
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
      if (lineCompletionRollback) {
        lineCompletionRollback.completedEndpoint = endpoint;
        lineCompletionRollback.completedLine = l;
        lineCompletionRollback.createdAt = performance.now();
      }
      clearTransientLineStartRollback();
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

  function beginBlockDrag(e, instance, pointer, rotate = false) {
    clearSelection();
    selectedBlockInstances = [instance];
    dragSession = buildDragSession(rotate ? "block-rotation" : "block", instance, pointer);
    if (!dragSession) {
      setHint("固定されたブロックインスタンスです", "error");
      draw();
      return;
    }
    attachLocalSolveContext(dragSession);
    canvas.classList.add("is-dragging");
    canvas.setPointerCapture(e.pointerId);
    setHint(rotate ? "ブロックを回転中" : "ブロックを移動中");
    updateUI();
    draw();
  }

  function hitPresentationElement(x, y) {
    const threshold = 8 / viewport.scale;
    const pointThreshold = 10 / viewport.scale;
    const points = allGeometryPoints();
    const arcs = allGeometryArcs();
    const circles = allGeometryCircles();
    const lines = allGeometryLines();
    for (let i = points.length - 1; i >= 0; i--) {
      const point = points[i];
      if (!isVisibleSketchElement(point)) continue;
      if (!point.blockProjection && !isExplicitPoint(point) && !isPointUsedByPrimitive(point) && !isPointUsedByLine(point) && !isReferencePoint(point)) continue;
      if (hypot2(point.x - x, point.y - y) <= pointThreshold) return { kind: "point", item: point };
    }
    for (let i = arcs.length - 1; i >= 0; i--) {
      const arc = arcs[i];
      if (!isVisibleSketchElement(arc) || presentationStyleForElement(arc).visible === false) continue;
      const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
      if (Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return { kind: "arc", item: arc };
    }
    for (let i = circles.length - 1; i >= 0; i--) {
      const circle = circles[i];
      if (!isVisibleSketchElement(circle) || presentationStyleForElement(circle).visible === false) continue;
      if (Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold) return { kind: "circle", item: circle };
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!isVisibleSketchElement(line) || presentationStyleForElement(line).visible === false) continue;
      if (distancePointToSegment(x, y, line) <= threshold) return { kind: "line", item: line };
    }
    return null;
  }

  function hitReferenceTarget(x, y) {
    const threshold = 7 / viewport.scale;
    const pointThreshold = 10 / viewport.scale;
    const allowedSketches = new Set(referenceSourceSketchIds());
    if (allowedSketches.size === 0) return null;
    const points = allGeometryPoints();
    const lines = allGeometryLines();
    const circles = allGeometryCircles();
    const arcs = allGeometryArcs();
    for (let i = points.length - 1; i >= 0; i--) {
      const point = points[i];
      const sketchId = elementSketchId(point);
      if (!allowedSketches.has(sketchId) || !isVisibleSketchElement(point)) continue;
      if (!point.blockProjection && !isExplicitPoint(point) && !isPointUsedByPrimitive(point) && !isReferencePoint(point)) continue;
      if (hypot2(point.x - x, point.y - y) <= pointThreshold) return { kind: "point", point, sketchId };
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const sketchId = elementSketchId(line);
      if (!allowedSketches.has(sketchId) || !isVisibleSketchElement(line)) continue;
      if (distancePointToSegment(x, y, line) <= threshold) return { kind: "line", line, sketchId };
    }
    for (let i = circles.length - 1; i >= 0; i--) {
      const circle = circles[i];
      const sketchId = elementSketchId(circle);
      if (!allowedSketches.has(sketchId) || !isVisibleSketchElement(circle)) continue;
      if (Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold) return { kind: "primitive", primitive: circle, sketchId };
    }
    for (let i = arcs.length - 1; i >= 0; i--) {
      const arc = arcs[i];
      const sketchId = elementSketchId(arc);
      if (!allowedSketches.has(sketchId) || !isVisibleSketchElement(arc)) continue;
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

  function cleanupTrimConstraints(item, options = {}) {
    model.constraints = model.constraints.filter((c) => {
      if (item instanceof Line && constraintReferencesLine(c, item)) return options.preserveLineSupport && shouldPreserveTrimmedLineConstraint(c, item);
      if (item instanceof Arc && constraintReferencesPrimitive(c, item)) return false;
      if (item instanceof Circle && constraintReferencesPrimitive(c, item)) return false;
      return true;
    });
  }

  function shouldPreserveTrimmedLineConstraint(c, line) {
    if (c instanceof HorizontalConstraint || c instanceof VerticalConstraint) return true;
    if (c instanceof ParallelConstraint || c instanceof PerpendicularConstraint || c instanceof CollinearConstraint || c instanceof LineAngleConstraint) return true;
    if (c instanceof PointOnLineConstraint || c instanceof PointOnLineMidpointConstraint || c instanceof ArcEndpointOnLineConstraint) return true;
    if (c instanceof PointLineDistanceConstraint || c instanceof LineLineDistanceConstraint || c instanceof LineCircleTangentConstraint) return true;
    return false;
  }

  function cloneTrimmedLineConstraint(c, sourceLine, targetLine) {
    if (c instanceof HorizontalConstraint && c.line === sourceLine) return new HorizontalConstraint(targetLine);
    if (c instanceof VerticalConstraint && c.line === sourceLine) return new VerticalConstraint(targetLine);
    if (c instanceof ParallelConstraint) {
      if (c.line1 === sourceLine) return new ParallelConstraint(targetLine, c.line2);
      if (c.line2 === sourceLine) return new ParallelConstraint(c.line1, targetLine);
    }
    if (c instanceof PerpendicularConstraint) {
      if (c.line1 === sourceLine) return new PerpendicularConstraint(targetLine, c.line2);
      if (c.line2 === sourceLine) return new PerpendicularConstraint(c.line1, targetLine);
    }
    if (c instanceof CollinearConstraint) {
      if (c.line1 === sourceLine) return new CollinearConstraint(targetLine, c.line2);
      if (c.line2 === sourceLine) return new CollinearConstraint(c.line1, targetLine);
    }
    if (c instanceof LineAngleConstraint) {
      if (c.line1 === sourceLine) return new LineAngleConstraint(targetLine, c.line2, c.target, c.startFlip, c.endFlip);
      if (c.line2 === sourceLine) return new LineAngleConstraint(c.line1, targetLine, c.target, c.startFlip, c.endFlip);
    }
    return null;
  }

  function cloneTrimmedLineConstraints(sourceLine, targetLine) {
    const clones = model.constraints.map((c) => cloneTrimmedLineConstraint(c, sourceLine, targetLine)).filter(Boolean);
    for (const clone of clones) pushModelConstraint(clone, elementSketchId(sourceLine));
  }

  function trimmedLinePointConstraintAnchor(constraint, line) {
    if (constraint instanceof PointOnLineConstraint && constraint.line === line) return constraint.point;
    if (constraint instanceof ArcEndpointOnLineConstraint && constraint.line === line) return arcEndpointPoint(constraint.arc, constraint.endpoint);
    return null;
  }

  function captureRightTrimmedLinePointConstraints(line, rightBoundaryT) {
    return model.constraints.filter((constraint) => {
      const anchor = trimmedLinePointConstraintAnchor(constraint, line);
      return anchor && lineParam(line, anchor) >= rightBoundaryT - 1e-6;
    });
  }

  function retargetTrimmedLinePointConstraints(constraints, sourceLine, targetLine) {
    for (const constraint of constraints) {
      if (constraint.line !== sourceLine) continue;
      constraint.line = targetLine;
      if (constraint instanceof PointOnLineConstraint) constraint.name = new PointOnLineConstraint(constraint.point, targetLine).name;
      else if (constraint instanceof ArcEndpointOnLineConstraint) constraint.name = new ArcEndpointOnLineConstraint(constraint.arc, constraint.endpoint, targetLine).name;
    }
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
      removeOrphanTrimmedEndpoints(endpoints);
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

  function removeOrphanTrimmedEndpoints(points) {
    const removable = points.filter((point) => point?.kind === "endpoint" && !isPointUsedByPrimitive(point));
    if (removable.length === 0) return;
    model.constraints = model.constraints.filter((constraint) => !removable.some((point) => constraintReferencesPoint(constraint, point)));
    model.points = model.points.filter((point) => !removable.includes(point));
  }

  function executeLineTrim(preview) {
    const line = preview.item;
    if (preview.deleteWhole) {
      removeTrimmedItem(line);
      return;
    }
    const { left, right } = preview.interval;
    cleanupTrimConstraints(line, { preserveLineSupport: true });
    if (left.t <= 1e-6) {
      const p = addPoint(right.point.x, right.point.y, false, "endpoint");
      line.p1 = p;
      addBoundaryPointConstraint(p, right);
    } else if (right.t >= 1 - 1e-6) {
      const p = addPoint(left.point.x, left.point.y, false, "endpoint");
      line.p2 = p;
      addBoundaryPointConstraint(p, left);
    } else {
      const rightSidePointConstraints = captureRightTrimmedLinePointConstraints(line, right.t);
      const oldP2 = line.p2;
      const pLeft = addPoint(left.point.x, left.point.y, false, "endpoint");
      const pRight = addPoint(right.point.x, right.point.y, false, "endpoint");
      line.p2 = pLeft;
      const newLine = addLine(pRight, oldP2, line.construction);
      if (newLine) {
        cloneTrimmedLineConstraints(line, newLine);
        retargetTrimmedLinePointConstraints(rightSidePointConstraints, line, newLine);
      }
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
      const newArc = addArc(arc.center, arc.radius(), angleAtArcParam(arc, right.t), oldEnd, arc.construction);
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
      const arc = addArc(circle.center, circle.radius(), start, end, circle.construction);
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
    const arc = addArc(center, finalRadius, startAngle, endAngle, false);
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
    const hitBlockHandle = hitBlockRotationHandle(p.x, p.y);
    const hitBlock = hitBlockHandle || hitBlockInstance(p.x, p.y);
    hoveredSketchIdentity = hitSketchIdentityElement(p.x, p.y);
    const inactiveHit = !hitP && !hitL && !hitC && !hitArcEnd && !hitA && !hitD && !hitBlock ? hitInactiveElement(p.x, p.y) : null;
    const blankAnnotationHit = isPresentationMode() ? hitPresentationAnnotationElement(p.x, p.y) : null;
    const blankPresentationHit = isPresentationMode() ? hitPresentationElement(p.x, p.y) : null;

    const blankDoubleClickHits = { hitP, hitL, hitC, hitArcEnd, hitA, hitD, hitBlock, inactiveHit, annotationHit: blankAnnotationHit, presentationHit: blankPresentationHit };
    if (isRepeatedBlankDoubleClick(e, blankDoubleClickHits) && handleBlankCanvasDoubleClick(p, blankDoubleClickHits)) {
      suppressNextBlankDoubleClickEvent = true;
      e.preventDefault();
      return;
    }

    if (isPresentationMode()) {
      e.preventDefault();
      const annotationHit = blankAnnotationHit;
      const presentationHit = blankPresentationHit;
      if (pendingCommand?.type === "presentation-dimension-place") {
        if (presentationHit && retargetPresentationDimensionWithHit(presentationHit, p)) return;
        commitPresentationAnnotationDimensionAt(p);
        draw();
        return;
      }
      if (pendingCommand?.type === "presentation-dimension-select") {
        handlePresentationDimensionTargetClick(presentationHit, p);
        return;
      }
      if (pendingCommand?.type === "presentation-leader-select") {
        handlePresentationLeaderTargetClick(presentationHit, p);
        return;
      }
      if (pendingCommand?.type === "presentation-leader-place") {
        commitPresentationLeaderAt(p);
        draw();
        return;
      }
      if (annotationHit) {
        beginPresentationAnnotationDrag(e, annotationHit, p);
        return;
      }
      if (presentationHit) {
        setPresentationSelection(presentationHit, e.shiftKey || e.ctrlKey);
        updatePresentationUI();
        setHint(`プレゼンテーション・モード: ${activePresentationSheet().name} / ${presentationSelectedItems().length}個選択`);
      } else {
        clearSelection();
        updatePresentationUI();
        setHint(`プレゼンテーション・モード: ${activePresentationSheet().name}`);
      }
      draw();
      return;
    }

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
      if (retargetDistancePlaceWithOperand(p, { hitP, hitL, hitC, hitA, hitArcEnd })) return;
      startDistanceValueInput(p);
      return;
    }

    if (pendingCommand?.type === "distance-value" || pendingCommand?.type === "fillet-radius-value" || pendingCommand?.type === "offset-value") {
      e.preventDefault();
      return;
    }

    if (
      pendingConstraintCommand &&
      (selectedDimensionConstraint || effectiveSelectedConstraint()) &&
      !hitP &&
      !hitL &&
      !hitC &&
      !hitArcEnd &&
      !hitA &&
      !hitD &&
      !inactiveHit
    ) {
      e.preventDefault();
      selectedDimensionConstraint = null;
      selectedConstraint = null;
      hoveredDimensionConstraint = null;
      setHint(constraintTargetHint(pendingConstraintCommand.type));
      updateUI();
      draw();
      return;
    }

    if (pendingConstraintCommand) {
      e.preventDefault();
      handleConstraintOperandClick(p, pendingConstraintCommand.type, { hitP, hitL, hitC, hitA, hitArcEnd });
      return;
    }

    if (mode === "block-place") {
      e.preventDefault();
      handleBlockPlacementClick(p);
      return;
    }

    if (["point", "line", "rectangle", "circle", "arc", "fillet", "trim", "offset", "block-place"].includes(mode) && rejectRootSketchCreation()) {
      e.preventDefault();
      return;
    }

    if (mode === "point") {
      clearTransientPointRollback();
      beginTransientPointRollback();
      const sp = snapForDrawing(p);
      const snap = activeSnap;
      const np = addPoint(sp.x, sp.y, false);
      if (pointStartRollback) pointStartRollback.createdPoint = np;
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

    if (mode === "offset") {
      if (!offsetSource) {
        offsetSource = hitL || hitC || hitA;
        if (!offsetSource) {
          setHint("オフセットする線、円、円弧をクリックしてください", "error");
          return;
        }
        selectedPoints = [];
        selectedLines = offsetSource instanceof Line ? [offsetSource] : [];
        selectedCircles = offsetSource instanceof Circle ? [offsetSource] : [];
        selectedArcs = offsetSource instanceof Arc ? [offsetSource] : [];
        pointerPreview = p;
        setHint("オフセットする側と距離の目安をクリックしてください");
        updateUI();
        draw();
        return;
      }
      startOffsetDistanceInput(offsetSource, p);
      return;
    }

    if (inactiveHit) {
      setHint(`${inactiveHit.id} / ${sketchName(inactiveHit.sketchId)} は非アクティブスケッチの要素です`);
      draw();
      return;
    }

    const multiSelect = e.shiftKey || e.ctrlKey;

    if (hitBlock) {
      beginBlockDrag(e, hitBlock, p, Boolean(hitBlockHandle));
    } else if (hitD && !multiSelect) {
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

    if (isPresentationMode()) {
      clearSnap();
      if (presentationDragSession) {
        updatePresentationAnnotationDrag(p);
        return;
      }
      if (pendingCommand?.type === "presentation-dimension-place") {
        pendingCommand.pointer = p;
        hoveredPoint = null;
        hoveredEndpointPoint = null;
        hoveredLine = null;
        hoveredCircle = null;
        hoveredArcEndpoint = null;
        hoveredArc = null;
        hoveredDimensionConstraint = null;
        hoveredSketchIdentity = null;
        draw();
        return;
      }
      if (pendingCommand?.type === "presentation-leader-place") {
        pendingCommand.pointer = p;
        hoveredPoint = null;
        hoveredEndpointPoint = null;
        hoveredLine = null;
        hoveredCircle = null;
        hoveredArcEndpoint = null;
        hoveredArc = null;
        hoveredDimensionConstraint = null;
        hoveredSketchIdentity = null;
        draw();
        return;
      }
      const hit = hitPresentationElement(p.x, p.y);
      const nextPoint = hit?.kind === "point" ? hit.item : null;
      const nextLine = hit?.kind === "line" ? hit.item : null;
      const nextCircle = hit?.kind === "circle" ? hit.item : null;
      const nextArc = hit?.kind === "arc" ? hit.item : null;
      const nextSketchIdentity = hitSketchIdentityElement(p.x, p.y);
      if (
        hoveredPoint !== nextPoint ||
        hoveredLine !== nextLine ||
        hoveredCircle !== nextCircle ||
        hoveredArc !== nextArc ||
        hoveredEndpointPoint ||
        hoveredArcEndpoint ||
        hoveredDimensionConstraint ||
        nextSketchIdentity?.item !== hoveredSketchIdentity?.item ||
        Boolean(nextSketchIdentity)
      ) {
        hoveredPoint = nextPoint;
        hoveredEndpointPoint = null;
        hoveredLine = nextLine;
        hoveredCircle = nextCircle;
        hoveredArcEndpoint = null;
        hoveredArc = nextArc;
        hoveredDimensionConstraint = null;
        hoveredSketchIdentity = nextSketchIdentity;
        draw();
      }
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

    if (["point", "line", "rectangle", "circle", "arc", "fillet", "trim", "offset", "block-place"].includes(mode) && !canCreateInActiveSketch()) {
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

    if (mode === "block-place") {
      clearSnap();
      hoveredSketchIdentity = null;
      pointerPreview = p;
      draw();
      return;
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

    if (mode === "offset") {
      clearSnap();
      hoveredSketchIdentity = null;
      if (pendingCommand?.type === "offset-value") {
        draw();
        return;
      }
      if (offsetSource) {
        pointerPreview = p;
        hoveredPoint = null;
        hoveredEndpointPoint = null;
        hoveredLine = offsetSource instanceof Line ? offsetSource : null;
        hoveredCircle = offsetSource instanceof Circle ? offsetSource : null;
        hoveredArc = offsetSource instanceof Arc ? offsetSource : null;
      } else {
        const nextLine = hitLine(p.x, p.y);
        const nextCircle = nextLine ? null : hitCircle(p.x, p.y);
        const nextArc = nextLine || nextCircle ? null : hitArc(p.x, p.y);
        hoveredPoint = null;
        hoveredEndpointPoint = null;
        hoveredLine = nextLine;
        hoveredCircle = nextCircle;
        hoveredArc = nextArc;
      }
      hoveredArcEndpoint = null;
      hoveredDimensionConstraint = null;
      draw();
      return;
    }

    if (pendingConstraintCommand && !dragSession) {
      const blockOperand = hitBlockProjectionOperand(p.x, p.y);
      if (blockOperand) {
        hoveredPoint = blockOperand.kind === "point" ? blockOperand.point : null;
        hoveredEndpointPoint = null;
        hoveredLine = blockOperand.kind === "line" ? blockOperand.line : null;
        hoveredCircle = blockOperand.kind === "primitive" && blockOperand.primitive instanceof Circle ? blockOperand.primitive : null;
        hoveredArc = blockOperand.kind === "primitive" && blockOperand.primitive instanceof Arc ? blockOperand.primitive : null;
        hoveredArcEndpoint = null;
        hoveredDimensionConstraint = null;
        hoveredBlockInstance = null;
        draw();
        return;
      }
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
      const nextBlockHover = nextHover || nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover || nextArcHover ? null : hitBlockInstance(p.x, p.y);
      if (
        nextPointHover !== hoveredPoint ||
        nextEndpointHover !== hoveredEndpointPoint ||
        nextLineHover !== hoveredLine ||
        nextCircleHover !== hoveredCircle ||
        !sameArcEndpoint(nextArcEndpointHover, hoveredArcEndpoint) ||
        nextArcHover !== hoveredArc ||
        nextHover !== hoveredDimensionConstraint ||
        nextSketchIdentity?.item !== hoveredSketchIdentity?.item ||
        Boolean(nextSketchIdentity) || nextBlockHover !== hoveredBlockInstance
      ) {
        hoveredPoint = nextPointHover;
        hoveredEndpointPoint = nextEndpointHover;
        hoveredLine = nextLineHover;
        hoveredCircle = nextCircleHover;
        hoveredArcEndpoint = nextArcEndpointHover;
        hoveredArc = nextArcHover;
        hoveredDimensionConstraint = nextHover;
        hoveredSketchIdentity = nextSketchIdentity;
        hoveredBlockInstance = nextBlockHover;
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
    const dependentResult = solveReferenceDependentSketches(dragSession.sketchId || activeSketchId());
    const dependentText = dependentResult.results.length > 0 ? `, dependent=${dependentResult.results.length}` : "";
    const dependentErrorText = dependentErrorSummary(dependentResult);
    setHint(`${dragLabel(dragSession)}中: ${scope}, error=${error.toExponential(2)}, iter=${result.iterations}${fallback}${dependentText}${dependentErrorText}`, dependentResult.success ? "normal" : "error");
    if (!dependentResult.success) updateUI();
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

    if (presentationDragSession) {
      presentationDragSession = null;
      canvas.classList.remove("is-dragging");
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {
        // Pointer capture may already be released by the browser.
      }
      setHint("Presentation注記の位置を更新しました");
      updateUI();
      draw();
      recordHistory("Presentation注記移動");
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
      recordHistory("寸法線移動");
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
        setHint("矩形選択を更新しました");
      }
      updateUI();
      draw();
      return;
    }

    if (!dragSession) {
      recordHistory("操作");
      return;
    }
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
    const dependentResult = solveReferenceDependentSketches(session.sketchId || activeSketchId());
    if (session.item && model.blockInstances.includes(session.item)) invalidateBlockProjectionCache(session.item.id);
    const analysis = refreshConstraintAnalysis();
    const dependentErrorText = dependentErrorSummary(dependentResult);
    setHint(`${completedLabel}完了: success=${result.success}, error=${result.errorNorm.toExponential(2)}, iter=${result.iterations}${dependentErrorText} / ${constraintSummaryText()}`, analysis.analysis.stable && dependentResult.success ? "normal" : "error");
    updateUI();
    draw();
    recordHistory(`${completedLabel}ドラッグ`);
  }

  function hasSelection() {
    return selectedPoints.length > 0 ||
      selectedLines.length > 0 ||
      selectedCircles.length > 0 ||
      selectedArcs.length > 0 ||
      selectedBlockInstances.length > 0 ||
      Boolean(selectedArcEndpoint) ||
      Boolean(selectedDimensionConstraint) ||
      Boolean(effectiveSelectedConstraint());
  }

  function isBlankCanvasHit(hits = {}) {
    return !hits.hitP &&
      !hits.hitL &&
      !hits.hitC &&
      !hits.hitArcEnd &&
      !hits.hitA &&
      !hits.hitD &&
      !hits.hitBlock &&
      !hits.annotationHit &&
      !hits.presentationHit &&
      !hits.inactiveHit;
  }

  function isTransientLineStartHit(hits = {}) {
    return Boolean(
      lineStartRollback &&
        lineStartPoint &&
        hits.hitP === lineStartPoint &&
        model.points.indexOf(lineStartPoint) >= lineStartRollback.pointLength,
    );
  }

  function isTransientLineCompletionHit(hits = {}) {
    return Boolean(
      mode === "line" &&
        lineCompletionRollback &&
        lineCompletionRollback.completedEndpoint &&
        performance.now() - lineCompletionRollback.createdAt <= 650 &&
        hits.hitP === lineCompletionRollback.completedEndpoint &&
        hits.hitP === lineStartPoint &&
        model.lines.includes(lineCompletionRollback.completedLine),
    );
  }

  function isTransientPointCommandHit(hits = {}) {
    return Boolean(
      mode === "point" &&
        pointStartRollback &&
        pointStartRollback.createdPoint &&
        performance.now() - pointStartRollback.createdAt <= 650 &&
        hits.hitP === pointStartRollback.createdPoint &&
        model.points.indexOf(pointStartRollback.createdPoint) >= pointStartRollback.pointLength,
    );
  }

  function isBlankDoubleClickTarget(hits = {}) {
    if (isBlankCanvasHit(hits)) return true;
    if (
      isTransientPointCommandHit(hits) &&
      !hits.hitL &&
      !hits.hitC &&
      !hits.hitArcEnd &&
      !hits.hitA &&
      !hits.hitD &&
      !hits.annotationHit &&
      !hits.presentationHit &&
      !hits.inactiveHit
    ) {
      return true;
    }
    if (isTransientLineCompletionHit(hits)) {
      return !hits.hitC &&
        !hits.hitArcEnd &&
        !hits.hitA &&
        !hits.hitD &&
        !hits.annotationHit &&
        !hits.presentationHit &&
        !hits.inactiveHit;
    }
    return isTransientLineStartHit(hits) &&
      !hits.hitC &&
      !hits.hitArcEnd &&
      !hits.hitA &&
      !hits.hitD &&
      !hits.annotationHit &&
      !hits.presentationHit &&
      !hits.inactiveHit;
  }

  function isRepeatedBlankDoubleClick(e, hits = {}) {
    const screen = canvasScreenPoint(e);
    const now = performance.now();
    const repeated = Boolean(
      isBlankDoubleClickTarget(hits) &&
        blankDoubleClickCandidate &&
        now - blankDoubleClickCandidate.time <= 450 &&
        hypot2(screen.x - blankDoubleClickCandidate.x, screen.y - blankDoubleClickCandidate.y) <= 6,
    );
    blankDoubleClickCandidate = isBlankDoubleClickTarget(hits) ? { time: now, x: screen.x, y: screen.y } : null;
    return repeated;
  }

  function isDrawToolMode() {
    return mode === "line" || mode === "point" || mode === "rectangle" || mode === "fillet" || mode === "trim" || mode === "offset" || mode === "circle" || mode === "arc";
  }

  function handleBlankCanvasDoubleClick(pointer, hits = {}) {
    if (!isBlankDoubleClickTarget(hits)) return false;
    blankDoubleClickCandidate = null;
    if (pendingCommand?.type === "distance-value") {
      submitDistanceValue();
      return true;
    }
    if (pendingCommand?.type === "fillet-radius-value") {
      submitFilletRadiusValue();
      return true;
    }
    if (pendingCommand?.type === "offset-value") {
      submitOffsetValue();
      return true;
    }
    if (pendingCommand) {
      cancelPendingCommand();
      if (isDrawToolMode()) exitDrawMode();
      return true;
    }
    if (pendingConstraintCommand) {
      cancelConstraintTargetCommand();
      return true;
    }
    if (mode === "line") {
      if (isTransientLineCompletionHit(hits)) {
        rollbackTransientLineCompletion();
        lineStartPoint = null;
        pointerPreview = null;
        clearSnap();
        clearSelection();
        setHint("線の作図をキャンセルしました");
        updateUI();
        draw();
      } else if (isTransientLineStartHit(hits) || (lineStartRollback && lineStartPoint && !lineCompletionRollback)) {
        cancelActiveDrawOperation();
        exitDrawMode();
      } else if (lineStartPoint) {
        cancelActiveDrawOperation();
        updateUI();
        draw();
      } else {
        exitDrawMode();
      }
      return true;
    }
    if (mode === "point") {
      rollbackTransientPoint();
      exitDrawMode();
      return true;
    }
    if (hasActiveDrawOperation()) {
      cancelActiveDrawOperation();
      exitDrawMode();
      return true;
    }
    if (isDrawToolMode()) {
      exitDrawMode();
      return true;
    }
    if (hasSelection()) {
      clearSelection();
      setHint("選択を解除しました");
      updateUI();
      draw();
      return true;
    }
    return false;
  }

  function handleMiddleButtonDoubleClickFit(e) {
    if (e.button !== 1) return false;
    const now = performance.now();
    const screen = canvasScreenPoint(e);
    const previous = lastMiddleAuxClick;
    const repeated =
      previous &&
      now - previous.time <= 450 &&
      hypot2(screen.x - previous.x, screen.y - previous.y) <= 12;
    lastMiddleAuxClick = repeated ? null : { time: now, x: screen.x, y: screen.y };
    if (!repeated) return false;
    if (fitVisibleGeometryToViewport()) {
      setHint("表示中の図形全体が見えるように調整しました");
    } else {
      setHint("表示中の図形がありません", "error");
    }
    draw();
    return true;
  }

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("dblclick", (e) => {
    if (suppressNextBlankDoubleClickEvent) {
      suppressNextBlankDoubleClickEvent = false;
      e.preventDefault();
      return;
    }
    const p = canvasPoint(e);
    const hitL = hitLine(p.x, p.y);
    const hitP = hitPoint(p.x, p.y);
    const hitC = hitCircle(p.x, p.y);
    const hitArcEnd = hitArcEndpoint(p.x, p.y);
    const hitA = hitArc(p.x, p.y);
    const hitD = hitDimension(p.x, p.y);
    const hitBlock = hitBlockInstance(p.x, p.y);
    if (pendingCommand?.type === "fillet-radius-value") {
      e.preventDefault();
      submitFilletRadiusValue();
      return;
    }
    if (pendingCommand?.type === "offset-value") {
      e.preventDefault();
      submitOffsetValue();
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
    if (!pendingCommand && !pendingConstraintCommand && hitBlock) {
      e.preventDefault();
      enterBlockDefinitionEdit(hitBlock.definitionId);
      return;
    }
    if (handleBlankCanvasDoubleClick(p, { hitP, hitL, hitC, hitArcEnd, hitA, hitD })) {
      e.preventDefault();
      return;
    }
  });
  canvas.addEventListener("auxclick", (e) => {
    if (e.button === 1) {
      e.preventDefault();
      handleMiddleButtonDoubleClickFit(e);
    }
  });
  if (dimensionValueInput) {
    dimensionValueInput.addEventListener("pointerdown", (e) => e.stopPropagation());
    dimensionValueInput.addEventListener("dblclick", (e) => e.stopPropagation());
    dimensionValueInput.addEventListener("input", () => {
      if (!pendingCommand || !["distance-value", "fillet-radius-value", "offset-value"].includes(pendingCommand.type)) return;
      pendingCommand.buffer = dimensionValueInput.value;
      pendingCommand.editing = true;
      updateDistanceBufferLabel();
    });
    dimensionValueInput.addEventListener("keydown", (e) => {
      if (!pendingCommand || !["distance-value", "fillet-radius-value", "offset-value"].includes(pendingCommand.type)) return;
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        if (pendingCommand.type === "fillet-radius-value") submitFilletRadiusValue();
        else if (pendingCommand.type === "offset-value") submitOffsetValue();
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
    const key = e.key.toLowerCase();
    const commandKey = e.ctrlKey || e.metaKey;
    if (commandKey && key === "z" && !e.shiftKey) {
      e.preventDefault();
      undoHistory();
      return;
    }
    if (commandKey && (key === "y" || (key === "z" && e.shiftKey))) {
      e.preventDefault();
      redoHistory();
      return;
    }

    if (handleDistanceKey(e)) return;

    if ((e.key === "Delete" || e.key === "Backspace") && isGeometryMode() && deleteCurrentSelection()) {
      e.preventDefault();
      return;
    }

    if (e.key === "Enter" && completePendingDimensionLineLength()) {
      e.preventDefault();
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      if (mode === "block-place") {
        if (blockPlacementAnchor) commitBlockPlacement(0);
        else {
          blockPlacementDefinitionId = null;
          blockPlacementAnchor = null;
          blockPlacementEnabledSketchIds = [];
          pointerPreview = null;
          mode = "select";
          setHint("ブロック配置をキャンセルしました");
          updateUI();
          draw();
        }
        return;
      }
      if (pendingCommand) {
        cancelPendingCommand();
        return;
      }
      if (pendingConstraintCommand) {
        cancelConstraintTargetCommand();
        return;
      }
      if (hasActiveDrawOperation()) {
        cancelActiveDrawOperation();
        return;
      }
      if (mode === "line" || mode === "point" || mode === "rectangle" || mode === "fillet" || mode === "trim" || mode === "offset" || mode === "circle" || mode === "arc") {
        exitDrawMode();
        return;
      }
      if (
        selectedPoints.length > 0 ||
        selectedLines.length > 0 ||
        selectedCircles.length > 0 ||
        selectedArcs.length > 0 ||
        selectedBlockInstances.length > 0 ||
        selectedArcEndpoint ||
        selectedDimensionConstraint ||
        effectiveSelectedConstraint()
      ) {
        clearSelection();
        setHint("選択を解除しました");
        updateUI();
        draw();
      }
    }
  });

  document.getElementById("undoBtn")?.addEventListener("click", undoHistory);
  document.getElementById("redoBtn")?.addEventListener("click", redoHistory);
  document.getElementById("deleteSelectionBtn")?.addEventListener("click", () => {
    if (!isGeometryMode()) return;
    if (deleteCurrentSelection()) {
      updateUI();
      draw();
    }
  });
  document.getElementById("geometryModeBtn")?.addEventListener("click", () => setAppMode("geometry"));
  document.getElementById("presentationModeBtn")?.addEventListener("click", () => setAppMode("presentation"));
  document.getElementById("presentationSheetSelect")?.addEventListener("change", (event) => setActivePresentationSheet(event.target.value));
  document.getElementById("addPresentationSheetBtn")?.addEventListener("click", createPresentationSheet);
  document.getElementById("renamePresentationSheetBtn")?.addEventListener("click", renamePresentationSheet);
  document.getElementById("presentationColorInput")?.addEventListener("input", (event) => setPresentationStyleForSelection({ color: event.target.value }));
  document.getElementById("presentationLineTypeSelect")?.addEventListener("change", (event) => setPresentationStyleForSelection({ lineType: event.target.value }));
  document.getElementById("presentationLineWidthInput")?.addEventListener("change", (event) => {
    const lineWidthPx = Number(event.target.value);
    if (Number.isFinite(lineWidthPx)) setPresentationStyleForSelection({ lineWidthPx: Math.max(0.5, Math.min(10, lineWidthPx)) });
  });
  document.getElementById("presentationVisibleInput")?.addEventListener("change", (event) => setPresentationStyleForSelection({ visible: event.target.checked }));
  document.getElementById("presentationSelectBtn")?.addEventListener("click", () => enterPresentationSelectCommand());
  document.getElementById("presentationDimensionBtn")?.addEventListener("click", createPresentationAnnotationDimension);
  document.getElementById("presentationLeaderBtn")?.addEventListener("click", createPresentationLeader);
  document.getElementById("completeBlockEditBtn")?.addEventListener("click", completeBlockDefinitionEdit);
  document.getElementById("cancelBlockEditBtn")?.addEventListener("click", cancelBlockDefinitionEdit);
  document.getElementById("blockEditorNameInput")?.addEventListener("input", (event) => {
    if (!blockEditSession) return;
    blockEditSession.draft.name = event.target.value || blockEditSession.draft.name;
    const title = document.getElementById("blockOverlayTitle");
    if (title) title.textContent = "ブロックエディタ";
  });

  document.getElementById("toolSelect").addEventListener("click", () => {
    if (rejectPresentationGeometryEdit("Geometry selection")) return;
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
    if (rejectPresentationGeometryEdit("Point creation")) return;
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
    if (rejectPresentationGeometryEdit("Line creation")) return;
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

  document.getElementById("toolConstructionLine")?.addEventListener("click", () => {
    if (rejectPresentationGeometryEdit("Construction line editing")) return;
    cancelConstraintTargetCommand("");
    const primitives = selectedConstructionTogglePrimitives();
    if (primitives.length > 0) {
      const next = !primitives.every((item) => item.construction);
      for (const item of primitives) item.construction = next;
      setHint(next ? "選択図形を補助作図にしました" : "選択図形を通常作図にしました");
      clearSelection();
      updateUI();
      draw();
      recordHistory("補助線切替");
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
    if (rejectPresentationGeometryEdit("Rectangle creation")) return;
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
    if (rejectPresentationGeometryEdit("Fillet creation")) return;
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

  document.getElementById("toolTrim")?.addEventListener("click", () => {
    if (rejectPresentationGeometryEdit("Trim")) return;
    cancelConstraintTargetCommand("");
    mode = "trim";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    trimPreview = null;
    offsetSource = null;
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

  document.getElementById("toolCreateBlock")?.addEventListener("click", startBlockCreation);
  document.getElementById("toolPlaceBlock")?.addEventListener("click", () => {
    if (model.blockDefinitions.length === 0) {
      setHint("配置できるブロックがありません", "error");
      return;
    }
    startBlockPlacement(model.blockDefinitions[0].id);
  });

  document.getElementById("toolOffset")?.addEventListener("click", () => {
    if (rejectPresentationGeometryEdit("Offset")) return;
    cancelConstraintTargetCommand("");
    cancelPendingCommand("");
    mode = "offset";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    trimPreview = null;
    const selected = [...selectedLines, ...selectedCircles, ...selectedArcs];
    offsetSource = selected.length === 1 ? selected[0] : null;
    if (!offsetSource) clearSelection();
    clearSnap();
    updateToolbar();
    setHint(offsetSource ? "オフセットする側と距離の目安をクリックしてください" : "オフセットする線、円、円弧をクリックしてください");
    updateUI();
    draw();
  });

  document.getElementById("toolCircle").addEventListener("click", () => {
    if (rejectPresentationGeometryEdit("Circle creation")) return;
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
    if (rejectPresentationGeometryEdit("Arc creation")) return;
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
  document.getElementById("addSketchBtn")?.addEventListener("click", () => createSketch("sibling"));
  document.getElementById("addChildSketchBtn")?.addEventListener("click", () => createSketch("child"));
  document.getElementById("toggleSketchTreeBtn")?.addEventListener("click", () => {
    sketchTreeCollapsed = !sketchTreeCollapsed;
    updateSketchUI();
  });

  document.getElementById("toggleSideBtn")?.addEventListener("click", () => {
    const app = document.querySelector(".app");
    const isCollapsed = app?.classList.contains("side-collapsed");
    setSidebarCollapsed(!isCollapsed, isCollapsed ? "サイドバーを表示しました" : "サイドバーをたたみました");
  });

  for (const button of document.querySelectorAll("[data-sidebar-tab]")) {
    button.addEventListener("click", () => {
      const app = document.querySelector(".app");
      const isCollapsed = app?.classList.contains("side-collapsed");
      const isActive = button.classList.contains("active");
      if (isActive && !isCollapsed) {
        setSidebarCollapsed(true);
        return;
      }
      activateSidebarTab(button.dataset.sidebarTab);
      setSidebarCollapsed(false);
    });
  }

  for (const btn of constraintButtons) {
    btn.addEventListener("click", () => {
      const type = btn.dataset.constraint;
      if (rejectPresentationGeometryEdit("Constraints")) return;
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
    if (rejectPresentationGeometryEdit("Fixed constraint")) return;
    const projectedSelection = [...selectedPoints, ...selectedLines, ...selectedCircles, ...selectedArcs].filter((item) => item?.blockProjection);
    const projectedInstances = [...new Set(projectedSelection.map((item) => item.blockInstance))];
    const instance = selectedBlockInstances.length === 1
      ? selectedBlockInstances[0]
      : projectedSelection.length > 0 && projectedInstances.length === 1 && projectedSelection.length === selectedPoints.length + selectedLines.length + selectedCircles.length + selectedArcs.length
        ? projectedInstances[0]
        : null;
    if (instance) {
      instance.fixed = !instance.fixed;
      setHint(`${blockDefinitionById(instance.definitionId)?.name || instance.id} を${instance.fixed ? "固定" : "固定解除"}しました`);
      clearSelection();
      updateUI();
      draw();
      recordHistory("ブロック固定切替");
      return;
    }
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
    const solved = solveSketchAndDependents(sketchId, snapshot);
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

  function installTestHooks() {
    if (!new URLSearchParams(window.location.search).has("test")) return;
    window.__cadTest = {
      resetForPresentationDrag() {
        resetModelState();
        const p1 = addPoint(-60, -25, false, "endpoint");
        const p2 = addPoint(60, -25, false, "endpoint");
        const p3 = addPoint(60, 35, false, "endpoint");
        const p4 = addPoint(-60, 35, false, "endpoint");
        const l1 = addLine(p1, p2);
        addLine(p2, p3);
        const l3 = addLine(p3, p4);
        addLine(p4, p1);
        setAppMode("presentation");
        const sheet = activePresentationSheet();
        sheet.elements = [];
        const dimensionTarget = { kind: "line-length", line: l1, p1: l1.p1, p2: l1.p2, value: l1.length() };
        pushPresentationElement({
          type: "annotationDimension",
          target: presentationTargetToData(dimensionTarget),
          dimension: dimensionFromAnchor(dimensionTarget, { x: 0, y: -58 }),
          geometryRefs: presentationTargetToData(dimensionTarget) || {},
          style: {},
        });
        const leaderTarget = presentationLeaderTargetFromItem(l3, { x: 0, y: 35 });
        const leaderLayout = presentationLeaderLayout(leaderTarget.anchor, { x: 112, y: 82 });
        pushPresentationElement({
          type: "leader",
          text: "注記",
          start: leaderLayout.start,
          elbow: leaderLayout.elbow,
          end: leaderLayout.end,
          x: leaderLayout.text.x,
          y: leaderLayout.text.y,
          geometryRefs: { target: leaderTarget.geometryRef },
          style: { color: "#111827", fontSize: 13, lineWidthPx: 1.4 },
        });
        resizeCanvas({ centerWorld: { x: 20, y: 20 } });
        return this.presentationSnapshot();
      },
      resetForReadOnlyDuplicateDimension() {
        resetModelState();
        setAppMode("geometry");
        const p1 = addPoint(-50, 0, false, "endpoint");
        const p2 = addPoint(50, 0, false, "endpoint");
        const line = addLine(p1, p2);
        const target = { kind: "line-length", line, p1, p2, value: line.length() };
        const firstDimension = dimensionFromAnchor(target, { x: 0, y: -28 });
        const first = addDistanceConstraintFromTarget(target, line.length(), firstDimension, { sketchId: activeSketchId() });
        const second = addDistanceConstraintFromTarget(target, line.length(), dimensionFromAnchor(target, { x: 0, y: -54 }), { sketchId: activeSketchId() });
        const dimensionConstraints = model.constraints.filter(isDimensionConstraint);
        const layout = dimensionLayout(target, firstDimension);
        const extensionAlignmentErrors = layout.points.map((point) => {
          const vx = point.extensionEnd.x - point.extensionStart.x;
          const vy = point.extensionEnd.y - point.extensionStart.y;
          const wx = point.source.x - point.extensionStart.x;
          const wy = point.source.y - point.extensionStart.y;
          return Math.abs(vx * wy - vy * wx) / Math.max(hypot2(vx, vy), 1e-12);
        });
        return {
          first,
          second,
          count: dimensionConstraints.length,
          enabledCount: dimensionConstraints.filter((constraint) => constraint.enabled !== false).length,
          readOnlyCount: dimensionConstraints.filter(isReadOnlyDimension).length,
          labels: dimensionConstraints.map((constraint) => dimensionLabelForConstraint(constraint, targetFromConstraint(constraint), constraint.dimension || defaultDimensionForTarget(targetFromConstraint(constraint)))),
          serializedReadOnlyCount: serializeModel().constraints.filter((constraint) => constraint.readOnlyDimension).length,
          extensionAlignmentErrors,
        };
      },
      resetForReadOnlyDimensionPlacement() {
        resetModelState();
        setAppMode("geometry");
        const p1 = addPoint(-50, 0, false, "endpoint");
        const p2 = addPoint(50, 0, false, "endpoint");
        const line = addLine(p1, p2);
        const target = { kind: "line-length", line, p1, p2, value: line.length() };
        addDistanceConstraintFromTarget(target, line.length(), dimensionFromAnchor(target, { x: 0, y: -28 }), { sketchId: activeSketchId() });
        pendingConstraintCommand = { type: "distance" };
        pendingCommand = {
          type: "distance-place",
          target,
          pointer: { x: 0, y: -54 },
          sketchId: activeSketchId(),
        };
        startDistanceValueInput({ x: 0, y: -54 });
        return {
          pendingType: pendingCommand?.type || null,
          inputHidden: dimensionValueInput.hidden,
          readOnlyCount: model.constraints.filter(isReadOnlyDimension).length,
          dimensionCount: model.constraints.filter(isDimensionConstraint).length,
        };
      },
      constructionDimensionClearanceCases() {
        resetModelState();
        setAppMode("geometry");
        const p1 = addPoint(0, 0, false, "endpoint");
        const p2 = addPoint(100, 0, false, "endpoint");
        const line = addLine(p1, p2);
        line.construction = true;
        const target = { kind: "line-length", line, p1, p2, value: line.length() };
        const screenClearance = (direction) => dimensionConstructionExtensionClearance(target, 1, p2, direction) * viewport.scale;
        const diagonal = Math.SQRT1_2;
        return {
          sameDirection: screenClearance({ x: 1, y: 0 }),
          diagonal: screenClearance({ x: diagonal, y: diagonal }),
          perpendicular: screenClearance({ x: 0, y: 1 }),
          opposite: screenClearance({ x: -1, y: 0 }),
        };
      },
      dimensionDisplayPrecisionCases() {
        return {
          integerTrailingZero: formatDimensionLabel(140),
          integerHundred: formatDimensionLabel(100),
          positiveNoise: formatDimensionLabel(15.0000000058),
          negativeNoise: formatDimensionLabel(824.9999999982),
          precisionBoundaryNoise: formatDimensionLabel(1844.999999),
          measuredAccumulatedNoise: formatMeasuredDimensionLabel(1844.9999986000548),
          minimumResolution: formatDimensionLabel(0.000001),
          measuredMinimumResolution: formatMeasuredDimensionLabel(0.000001),
          roundedFraction: formatDimensionLabel(1.2345674),
        };
      },
      resetForTrimConstraintTransfer() {
        resetModelState();
        setAppMode("geometry");
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
        const rightLine = model.lines.find((candidate) => candidate !== line);
        return {
          lineCount: model.lines.length,
          leftConstraintOnLeftLine: leftConstraint.line === line,
          rightConstraintOnRightLine: rightConstraint.line === rightLine,
          leftLineEnd: { x: line.p2.x, y: line.p2.y },
          rightLineStart: rightLine ? { x: rightLine.p1.x, y: rightLine.p1.y } : null,
        };
      },
      presentationSnapshot() {
        const sheet = activePresentationSheet();
        const dimensionElement = [...sheet.elements].reverse().find((element) => element.type === "annotationDimension");
        const leaderElement = [...sheet.elements].reverse().find((element) => element.type === "leader");
        const target = dimensionElement ? presentationTargetFromData(dimensionElement.target) : null;
        const dimensionLayoutValue = target && dimensionElement ? dimensionLayout(target, dimensionElement.dimension) : null;
        const canvasRect = canvas.getBoundingClientRect();
        const toViewport = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: canvasRect.left + screen.x, y: canvasRect.top + screen.y };
        };
        return {
          mode: model.appMode,
          dimension: dimensionLayoutValue
            ? {
                world: { ...dimensionLayoutValue.text },
                viewport: toViewport(dimensionLayoutValue.text),
                dimension: { ...dimensionElement.dimension },
              }
            : null,
          leader: leaderElement
            ? {
                world: { x: leaderElement.x, y: leaderElement.y },
                viewport: toViewport({ x: leaderElement.x, y: leaderElement.y }),
                end: { ...leaderElement.end },
                elbow: leaderElement.elbow ? { ...leaderElement.elbow } : null,
              }
            : null,
        };
      },
      presentationAnnotationHitAt(viewportPoint) {
        const canvasRect = canvas.getBoundingClientRect();
        const world = screenToWorld({ x: viewportPoint.x - canvasRect.left, y: viewportPoint.y - canvasRect.top });
        const hit = hitPresentationAnnotationElement(world.x, world.y);
        return hit ? { type: hit.type, part: hit.part } : null;
      },
      presentationDragActive() {
        const element = presentationElementById(presentationDragSession?.elementId);
        return presentationDragSession
          ? {
              type: presentationDragSession.hit?.type,
              hasAnchor: Boolean(presentationDragSession.startAnchor),
              dimension: element?.dimension ? { ...element.dimension } : null,
            }
          : null;
      },
      historyState() {
        return {
          undoCount: undoStack.length,
          redoCount: redoStack.length,
          undoDisabled: document.getElementById("undoBtn")?.disabled,
          redoDisabled: document.getElementById("redoBtn")?.disabled,
          constructionLineMode,
          constructionButtonActive: document.getElementById("toolConstructionLine")?.classList.contains("active"),
        };
      },
      resetForActiveSketchDimensionVisibility() {
        resetModelState();
        setAppMode("geometry");
        const firstSketchId = activeSketchId();
        const p1 = addPoint(0, 0, false, "endpoint");
        const p2 = addPoint(100, 0, false, "endpoint");
        const firstLine = addLine(p1, p2);
        addDistanceConstraintFromTarget(
          { kind: "line-length", line: firstLine, p1, p2, value: firstLine.length() },
          firstLine.length(),
          dimensionFromAnchor({ kind: "line-length", line: firstLine, p1, p2, value: firstLine.length() }, { x: 50, y: -30 }),
          { sketchId: firstSketchId },
        );

        const secondSketchId = "S2";
        model.sketches.push({ id: secondSketchId, name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
        model.activeSketchId = secondSketchId;
        const p3 = addPoint(0, 80, false, "endpoint");
        const p4 = addPoint(160, 80, false, "endpoint");
        const secondLine = addLine(p3, p4);
        addDistanceConstraintFromTarget(
          { kind: "line-length", line: secondLine, p1: p3, p2: p4, value: secondLine.length() },
          secondLine.length(),
          dimensionFromAnchor({ kind: "line-length", line: secondLine, p1: p3, p2: p4, value: secondLine.length() }, { x: 80, y: 50 }),
          { sketchId: secondSketchId },
        );
        model.activeSketchId = firstSketchId;
        return {
          activeSketchId: firstSketchId,
          dimensionSketchIds: model.constraints.filter(isDimensionConstraint).map((constraint) => constraintSketchId(constraint)),
          drawnDimensionSketchIds: model.constraints
            .filter((constraint) => isDimensionConstraint(constraint) && isActiveSketchConstraint(constraint))
            .map((constraint) => constraintSketchId(constraint)),
        };
      },
      resetForAllGeometryFit() {
        resetModelState();
        const p1 = addPoint(-50000, -25000, false, "endpoint");
        const p2 = addPoint(-40000, -25000, false, "endpoint");
        addLine(p1, p2);
        const secondSketchId = "S2";
        model.sketches.push({ id: secondSketchId, name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
        model.activeSketchId = secondSketchId;
        const p3 = addPoint(45000, 30000, false, "endpoint");
        const p4 = addPoint(50000, 30000, false, "endpoint");
        addLine(p3, p4);
        viewport.scale = 10;
        viewport.x = -100000;
        viewport.y = 50000;
        fitAllGeometryToViewport();
        const bounds = allGeometryBounds();
        const screen = screenBoxForBounds(bounds);
        const rect = canvas.getBoundingClientRect();
        return {
          screen,
          canvas: { width: rect.width, height: rect.height },
          scale: viewport.scale,
        };
      },
      resetForMiddleButtonFit() {
        resetModelState();
        setAppMode("geometry");
        const nearLine = addLine(addPoint(0, 0, true, "endpoint"), addPoint(100, 0, true, "endpoint"));
        const hiddenSketchId = "S2";
        model.sketches.push({ id: hiddenSketchId, name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: false });
        const previousActive = model.activeSketchId;
        model.activeSketchId = hiddenSketchId;
        addLine(addPoint(10000, 0, true, "endpoint"), addPoint(10100, 0, true, "endpoint"));
        model.activeSketchId = previousActive;
        viewport.scale = 0.02;
        viewport.x = 10;
        viewport.y = 10;
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        return {
          click: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
          nearLineId: nearLine.id,
        };
      },
      middleButtonFitState() {
        const rect = canvas.getBoundingClientRect();
        return {
          scale: viewport.scale,
          visibleScreen: screenBoxForBounds(visibleGeometryBounds()),
          canvas: { width: rect.width, height: rect.height },
          hiddenVisible: isVisibleSketchId("S2"),
        };
      },
      canvasDashIsolationCases() {
        const results = {};
        const resetForCase = () => {
          resetModelState();
          setAppMode("geometry");
          viewport.scale = 1;
          viewport.x = 0;
          viewport.y = 0;
          pointerPreview = null;
          trimPreview = null;
          selectionRectSession = null;
          mode = "select";
        };
        const capture = (name, setup, drawFn) => {
          resetForCase();
          setup();
          ctx.setLineDash([13, 7]);
          drawFn();
          results[name] = ctx.getLineDash();
        };
        const makeBlockDefinition = () => {
          const definition = createEmptyBlockDefinition("Block-Dash");
          const p1 = new Point("BP1", 0, 0, false, "endpoint");
          const p2 = new Point("BP2", 40, 0, false, "endpoint");
          p1.sketchId = DEFAULT_SKETCH_ID;
          p2.sketchId = DEFAULT_SKETCH_ID;
          const line = new Line("BL1", p1, p2);
          line.sketchId = DEFAULT_SKETCH_ID;
          definition.points.push(p1, p2);
          definition.lines.push(line);
          model.blockDefinitions.push(definition);
          return definition;
        };

        capture("line", () => {
          mode = "line";
          lineStartPoint = addPoint(0, 0, true, "endpoint");
          pointerPreview = { x: 80, y: 0 };
        }, drawTemporaryLine);
        capture("rectangle", () => {
          mode = "rectangle";
          rectangleStartPoint = { x: 0, y: 0 };
          pointerPreview = { x: 80, y: 45 };
        }, drawRectanglePreview);
        capture("circle", () => {
          mode = "circle";
          circleCenterPoint = addPoint(0, 0, true, "center");
          pointerPreview = { x: 35, y: 0 };
        }, drawCirclePreview);
        capture("arc", () => {
          mode = "arc";
          arcCenterPoint = addPoint(0, 0, true, "center");
          arcStartPoint = { radius: 35, startAngle: 0 };
          pointerPreview = { x: 0, y: 35 };
        }, drawArcPreview);
        capture("offset", () => {
          mode = "offset";
          offsetSource = addLine(addPoint(0, 0, true, "endpoint"), addPoint(80, 0, true, "endpoint"));
          pointerPreview = { x: 40, y: 20 };
        }, drawOffsetPreview);
        capture("trim", () => {
          mode = "trim";
          trimPreview = {
            kind: "line",
            interval: {
              left: { point: { x: 0, y: 0 } },
              right: { point: { x: 80, y: 0 } },
            },
          };
        }, drawTrimPreview);
        capture("selection", () => {
          selectionRectSession = { start: { x: 0, y: 0 }, current: { x: 80, y: 45 } };
        }, drawSelectionRect);
        capture("blockPlacement", () => {
          const definition = makeBlockDefinition();
          mode = "block-place";
          blockPlacementDefinitionId = definition.id;
          blockPlacementEnabledSketchIds = [DEFAULT_SKETCH_ID];
          pointerPreview = { x: 120, y: 40 };
        }, drawBlockPlacementPreview);
        capture("blockHandles", () => {
          const definition = makeBlockDefinition();
          const instance = { id: "BI-DASH", definitionId: definition.id, sketchId: activeSketchId(), x: 20, y: 20, rotation: 0, fixed: false, enabledSketchIds: [DEFAULT_SKETCH_ID] };
          model.blockInstances.push(instance);
          selectedBlockInstances = [instance];
        }, drawBlockInstanceHandles);
        capture("presentationLeader", () => {
          setAppMode("presentation");
        }, () => drawPresentationLeader({
          start: { x: 0, y: 0 },
          elbow: { x: 40, y: 15 },
          end: { x: 80, y: 15 },
          text: "note",
          x: 84,
          y: 15,
          style: {},
        }, true));
        capture("frame", () => {
          addLine(addPoint(0, 0, true, "endpoint"), addPoint(80, 0, true, "endpoint"));
        }, draw);
        return results;
      },
      resetForSidebarInspection() {
        resetModelState();
        setAppMode("geometry");
        const p1 = addPoint(-80, 0, true, "endpoint");
        const p2 = addPoint(20, 0, false, "endpoint");
        const line = addLine(p1, p2);
        const circleCenter = addPoint(80, 0, false, "endpoint");
        const circle = addCircle(circleCenter, 28);
        const arcCenter = addPoint(0, 80, false, "endpoint");
        const arc = addArc(arcCenter, 32, Math.PI, Math.PI * 1.75);
        const horizontal = pushModelConstraint(new HorizontalConstraint(line));
        horizontal.reference = true;
        const readOnly = new DistanceConstraint(p1, p2, line.length());
        readOnly.dimension = dimensionFromAnchor({ kind: "line-length", line, p1, p2, value: line.length() }, { x: -30, y: -28 });
        readOnly.readOnlyDimension = true;
        readOnly.enabled = false;
        assignConstraintSketchId(readOnly, activeSketchId());
        model.constraints.push(readOnly);
        updateUI();
        fitAllGeometryToViewport(140);
        draw();
        const rect = canvas.getBoundingClientRect();
        const lineMid = worldToCanvasScreen({ x: (line.p1.x + line.p2.x) / 2, y: (line.p1.y + line.p2.y) / 2 });
        return {
          line: line.id,
          fixedPoint: p1.id,
          circle: circle.id,
          circleCenter: circleCenter.id,
          arc: arc.id,
          arcCenter: arcCenter.id,
          lineMid: { x: rect.left + lineMid.x, y: rect.top + lineMid.y },
          blank: { x: rect.left + rect.width - 35, y: rect.top + rect.height - 35 },
        };
      },
      resetForOffsetConstraints() {
        resetModelState();
        setAppMode("geometry");
        const lineP1 = addPoint(-120, -70, true, "endpoint");
        const lineP2 = addPoint(-20, -70, true, "endpoint");
        const sourceLine = addLine(lineP1, lineP2);
        const sourceCircle = addCircle(addPoint(80, -20, true, "center"), 30);
        const sourceArc = addArc(addPoint(0, 90, true, "center"), 40, 0, Math.PI / 2);
        pushModelConstraint(new RadiusConstraint(sourceCircle, 30));
        pushModelConstraint(new RadiusConstraint(sourceArc, 40));

        const lineCreated = createOffsetGeometry(sourceLine, 20, 1, { x: -70, y: -50 });
        const circleCreated = createOffsetGeometry(sourceCircle, 15, 1, { x: 125, y: -20 });
        const arcCreated = createOffsetGeometry(sourceArc, 10, -1, { x: 0, y: 120 });
        const offsets = model.constraints.filter((constraint) => constraint instanceof OffsetConstraint);
        offsets[0].target = 25;
        offsets[1].target = 18;
        offsets[2].target = 12;
        offsets.forEach(preconditionNewConstraint);
        solveSketchAndDependents(activeSketchId(), snapshotModelState());
        const measurements = offsets.map((constraint) => measuredConstraintTargetValue(constraint));
        const sourceRadii = [sourceCircle.radius(), sourceArc.radius()];
        const serialized = serializeModel();
        loadModelData(serialized);
        const restored = model.constraints.filter((constraint) => constraint instanceof OffsetConstraint);
        fitAllGeometryToViewport(140);
        draw();
        return {
          created: [lineCreated, circleCreated, arcCreated],
          measurements,
          sourceRadii,
          restoredCount: restored.length,
          restoredTypes: serializeModel().constraints.filter((constraint) => constraint.type === "offsetDimension").length,
          restoredTargets: restored.map((constraint) => constraint.target),
          geometry: { lines: model.lines.length, circles: model.circles.length, arcs: model.arcs.length },
        };
      },
      resetForOffsetUi() {
        resetModelState();
        setAppMode("geometry");
        const p1 = addPoint(-60, 0, false, "endpoint");
        const p2 = addPoint(60, 0, false, "endpoint");
        addLine(p1, p2);
        fitAllGeometryToViewport(220);
        draw();
        const rect = canvas.getBoundingClientRect();
        const source = worldToCanvasScreen({ x: 0, y: 0 });
        const side = worldToCanvasScreen({ x: 0, y: 35 });
        return {
          source: { x: rect.left + source.x, y: rect.top + source.y },
          side: { x: rect.left + side.x, y: rect.top + side.y },
        };
      },
      offsetUiState() {
        const constraints = model.constraints.filter((constraint) => constraint instanceof OffsetConstraint);
        const preview = offsetSource && pointerPreview ? offsetDistanceFromPointer(offsetSource, pointerPreview) : null;
        return {
          pendingType: pendingCommand?.type || null,
          lineCount: model.lines.length,
          constraintCount: constraints.length,
          targets: constraints.map((constraint) => constraint.target),
          toolActive: document.getElementById("toolOffset")?.classList.contains("active"),
          previewDistance: preview?.distance ?? null,
          previewSign: preview?.sign ?? null,
          lineOffsetDeltas: constraints
            .filter((constraint) => constraint.source instanceof Line)
            .map((constraint) => ({
              x: (constraint.offset.p1.x + constraint.offset.p2.x - constraint.source.p1.x - constraint.source.p2.x) / 2,
              y: (constraint.offset.p1.y + constraint.offset.p2.y - constraint.source.p1.y - constraint.source.p2.y) / 2,
            })),
        };
      },
      resetForOffsetDirection(directionCase = "vertical") {
        resetModelState();
        setAppMode("geometry");
        const horizontal = directionCase === "horizontal";
        const p1 = addPoint(horizontal ? 60 : 0, horizontal ? 0 : 60, false, "endpoint");
        const p2 = addPoint(horizontal ? -60 : 0, horizontal ? 0 : -60, false, "endpoint");
        const line = addLine(p1, p2);
        pushModelConstraint(horizontal ? new HorizontalConstraint(line) : new VerticalConstraint(line));
        solveAndRefresh("offset direction test");
        fitAllGeometryToViewport(220);
        draw();
        const rect = canvas.getBoundingClientRect();
        const screenPoint = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };
        return {
          source: screenPoint({ x: 0, y: 0 }),
          side: screenPoint(horizontal ? { x: 0, y: 35 } : { x: 35, y: 0 }),
          expectedAxis: horizontal ? "y" : "x",
        };
      },
      resetForSketchDeletion() {
        resetModelState();
        setAppMode("geometry");
        model.sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
        model.sketches.push({ id: "S3", name: "Sketch-2-1", parentSketchId: "S2", kind: "sketch" });
        model.sketches.push({ id: "S4", name: "Sketch-3", parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
        model.activeSketchId = "S2";
        const p1 = addPoint(0, 0, false, "endpoint");
        const p2 = addPoint(80, 0, false, "endpoint");
        const line = addLine(p1, p2);
        model.activeSketchId = "S3";
        const center = addPoint(30, 30, false, "center");
        const circle = addCircle(center, 20);
        const sheet = activePresentationSheet();
        sheet.elementStyles[presentationElementKey(line)] = { color: "#ef4444" };
        sheet.elementStyles[presentationElementKey(circle)] = { color: "#22c55e" };
        sheet.elements.push({ id: "PE-test", type: "leader", visible: true, geometryRefs: { target: presentationElementKey(line) }, style: {} });
        model.activeSketchId = "S3";
        const deleted = deleteSketch("S2", false);
        return {
          deleted,
          sketchIds: model.sketches.map((sketch) => sketch.id),
          activeSketchId: model.activeSketchId,
          geometry: { points: model.points.length, lines: model.lines.length, circles: model.circles.length, arcs: model.arcs.length },
          styleKeys: Object.keys(sheet.elementStyles),
          presentationElementCount: sheet.elements.length,
        };
      },
      resetForSiblingVisibility() {
        resetModelState();
        setAppMode("geometry");
        model.sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
        model.activeSketchId = "S2";
        const p1 = addPoint(-40, 0, false, "endpoint");
        const p2 = addPoint(40, 0, false, "endpoint");
        const line = addLine(p1, p2);
        model.activeSketchId = DEFAULT_SKETCH_ID;
        updateUI();
        draw();
        return {
          visible: isVisibleSketchId("S2"),
          relation: sketchRelationToActive("S2"),
          strokeWidth: sketchStrokeWidth(line),
          color: constraintStatusColor(line),
          rowHasVisibleClass: document.querySelector('.sketch-item[data-id="S2"]')?.classList.contains("visible") || false,
        };
      },
      resetForSiblingSubtreeReference() {
        resetModelState();
        setAppMode("geometry");
        const parentSketchId = "S10";
        const siblingSketchId = "S2";
        const siblingChildId = "S3";
        const siblingGrandchildId = "S4";
        const unrelatedSketchId = "S9";
        const activeChildSketchId = "S11";
        const active = sketchById(DEFAULT_SKETCH_ID);
        active.parentSketchId = parentSketchId;
        model.sketches.push({ id: parentSketchId, name: "Sketch-P", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
        model.sketches.push({ id: siblingSketchId, name: "Sketch-S", parentSketchId, kind: "sketch", visible: true });
        model.sketches.push({ id: siblingChildId, name: "Sketch-S-1", parentSketchId: siblingSketchId, kind: "sketch", visible: true });
        model.sketches.push({ id: siblingGrandchildId, name: "Sketch-S-1-1", parentSketchId: siblingChildId, kind: "sketch", visible: true });
        model.sketches.push({ id: unrelatedSketchId, name: "Sketch-U", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
        model.sketches.push({ id: activeChildSketchId, name: "Sketch-1-1", parentSketchId: DEFAULT_SKETCH_ID, kind: "sketch", visible: true });

        model.activeSketchId = DEFAULT_SKETCH_ID;
        const activePoint = addPoint(45, 70, false, "explicit");
        model.activeSketchId = activeChildSketchId;
        const childLine = addLine(addPoint(-80, 80, true, "endpoint"), addPoint(80, 80, true, "endpoint"));
        model.activeSketchId = siblingSketchId;
        addLine(addPoint(-80, 0, true, "endpoint"), addPoint(80, 0, true, "endpoint"));
        model.activeSketchId = siblingChildId;
        addLine(addPoint(-80, 20, true, "endpoint"), addPoint(80, 20, true, "endpoint"));
        model.activeSketchId = siblingGrandchildId;
        const referenceLine = addLine(addPoint(-80, 40, true, "endpoint"), addPoint(80, 40, true, "endpoint"));
        model.activeSketchId = unrelatedSketchId;
        const unrelatedLine = addLine(addPoint(-80, -40, true, "endpoint"), addPoint(80, -40, true, "endpoint"));
        model.activeSketchId = DEFAULT_SKETCH_ID;
        refreshReferenceConstraintValidity();
        fitAllGeometryToViewport(190);
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        const screenPoint = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };
        return {
          activePoint: screenPoint(activePoint),
          referenceLine: screenPoint({ x: 45, y: 40 }),
          unrelatedLine: screenPoint({ x: 45, y: -40 }),
          childLine: screenPoint({ x: 45, y: 80 }),
          relations: Object.fromEntries([parentSketchId, siblingSketchId, siblingChildId, siblingGrandchildId, unrelatedSketchId, activeChildSketchId].map((id) => [id, sketchRelationToActive(id)])),
          relationLabels: Object.fromEntries([unrelatedSketchId, activeChildSketchId].map((id) => [id, sketchIdentityRelationLabel(id)])),
          relationColors: Object.fromEntries([unrelatedSketchId, activeChildSketchId].map((id) => [id, sketchIdentityRelationColor(id)])),
          rowBackgrounds: Object.fromEntries([siblingSketchId, siblingChildId, siblingGrandchildId, unrelatedSketchId, activeChildSketchId].map((id) => {
            const row = document.querySelector(`.sketch-item[data-id="${id}"]`);
            return [id, row ? getComputedStyle(row).backgroundColor : ""];
          })),
          visible: Object.fromEntries([parentSketchId, siblingSketchId, siblingChildId, siblingGrandchildId, unrelatedSketchId, activeChildSketchId].map((id) => [id, isVisibleSketchId(id)])),
          rowClasses: Object.fromEntries([siblingSketchId, siblingChildId, siblingGrandchildId, unrelatedSketchId, activeChildSketchId].map((id) => [id, document.querySelector(`.sketch-item[data-id="${id}"]`)?.classList.contains("visible") || false])),
          referenceLineId: referenceLine.id,
          unrelatedLineId: unrelatedLine.id,
          childLineId: childLine.id,
        };
      },
      siblingSubtreeVisibilityState() {
        return Object.fromEntries(["S2", "S3", "S4"].map((id) => [id, {
          preferenceVisible: sketchById(id)?.visible !== false,
          effectiveVisible: isVisibleSketchId(id),
        }]));
      },
      moveSiblingSubtreeReferenceLine(dy) {
        const line = model.lines.find((item) => elementSketchId(item) === "S4");
        if (!line) return null;
        line.p1.y += dy;
        line.p2.y += dy;
        const result = solveReferenceDependentSketches("S4");
        refreshConstraintAnalysis();
        updateUI();
        draw();
        const point = model.points.find((item) => elementSketchId(item) === DEFAULT_SKETCH_ID && isExplicitPoint(item));
        return {
          success: result.success,
          dependentSketchIds: result.results.map((entry) => entry.sketchId),
          point: point ? { x: point.x, y: point.y } : null,
          line: { p1: { x: line.p1.x, y: line.p1.y }, p2: { x: line.p2.x, y: line.p2.y } },
        };
      },
      deleteSketchForTest(sketchId) {
        return deleteSketch(sketchId, false);
      },
      referenceDependencyOrderCase() {
        resetModelState();
        setAppMode("geometry");
        const parentSketchId = "S10";
        const siblingSketchId = "S2";
        const sourceSketchId = "S4";
        const childSketchId = "S5";
        sketchById(DEFAULT_SKETCH_ID).parentSketchId = parentSketchId;
        model.sketches.push({ id: parentSketchId, name: "Sketch-P", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
        model.sketches.push({ id: siblingSketchId, name: "Sketch-S", parentSketchId, kind: "sketch", visible: true });
        model.sketches.push({ id: sourceSketchId, name: "Sketch-S-1", parentSketchId: siblingSketchId, kind: "sketch", visible: true });
        model.sketches.push({ id: childSketchId, name: "Sketch-1-1", parentSketchId: DEFAULT_SKETCH_ID, kind: "sketch", visible: true });
        model.activeSketchId = sourceSketchId;
        const sourceLine = addLine(addPoint(-50, 0, true, "endpoint"), addPoint(50, 0, true, "endpoint"));
        model.activeSketchId = DEFAULT_SKETCH_ID;
        const activePoint = addPoint(0, 15, false, "explicit");
        const first = markReferenceConstraint(new PointOnLineConstraint(activePoint, sourceLine), sourceSketchId, DEFAULT_SKETCH_ID);
        model.constraints.push(first);
        model.activeSketchId = childSketchId;
        const childPoint = addPoint(0, 30, false, "explicit");
        const second = markReferenceConstraint(new CoincidentConstraint(childPoint, activePoint), DEFAULT_SKETCH_ID, childSketchId);
        model.constraints.push(second);
        model.activeSketchId = DEFAULT_SKETCH_ID;
        refreshReferenceConstraintValidity();
        sourceLine.p1.y = 25;
        sourceLine.p2.y = 25;
        const result = solveReferenceDependentSketches(sourceSketchId);
        return {
          order: result.results.map((entry) => entry.sketchId),
          activePointY: activePoint.y,
          childPointY: childPoint.y,
        };
      },
      cyclicReferenceLoadCase() {
        resetModelState();
        setAppMode("geometry");
        model.sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
        model.activeSketchId = DEFAULT_SKETCH_ID;
        const p1 = addPoint(0, 0, false, "explicit");
        model.activeSketchId = "S2";
        const p2 = addPoint(20, 0, false, "explicit");
        const forward = markReferenceConstraint(new CoincidentConstraint(p1, p2), "S2", DEFAULT_SKETCH_ID);
        const reverse = markReferenceConstraint(new CoincidentConstraint(p2, p1), DEFAULT_SKETCH_ID, "S2");
        model.constraints.push(forward, reverse);
        const serialized = serializeModel();
        serialized.activeSketchId = DEFAULT_SKETCH_ID;
        loadModelData(serialized);
        refreshConstraintAnalysis();
        updateUI();
        return {
          total: model.constraints.length,
          operational: model.constraints.filter(constraintIsOperational).length,
          invalid: [...invalidReferenceConstraints.values()],
          badges: document.querySelectorAll(".sketch-reference-error-badge, .constraint-reference-error-badge").length,
        };
      },
      sketchVisibilityState(sketchId) {
        const sketch = sketchById(sketchId);
        const serialized = serializeModel().sketches.find((item) => item.id === sketchId);
        return {
          preferenceVisible: sketch?.visible !== false,
          effectiveVisible: isVisibleSketchId(sketchId),
          serializedVisible: serialized?.visible,
          buttonPressed: document.querySelector(`.sketchVisibilityBtn[data-id="${sketchId}"]`)?.getAttribute("aria-pressed") || null,
        };
      },
      resetForConstraintDimensionSelection() {
        resetModelState();
        setAppMode("geometry");
        const p1 = addPoint(-50, 0, false, "endpoint");
        const p2 = addPoint(50, 0, false, "endpoint");
        const line = addLine(p1, p2);
        const target = { kind: "line-length", line, p1, p2, value: line.length() };
        const constraint = new DistanceConstraint(p1, p2, line.length());
        constraint.dimension = dimensionFromAnchor(target, { x: 0, y: -30 });
        pushModelConstraint(constraint);
        selectedDimensionConstraint = constraint;
        pendingConstraintCommand = { type: "parallel" };
        updateUI();
        fitAllGeometryToViewport(180);
        draw();
        const rect = canvas.getBoundingClientRect();
        return { blank: { x: rect.left + rect.width - 35, y: rect.top + rect.height - 35 } };
      },
      constraintDimensionSelectionState() {
        return {
          selected: Boolean(selectedDimensionConstraint),
          command: pendingConstraintCommand?.type || null,
        };
      },
      resetForSupportConstraintStatus() {
        resetModelState();
        setAppMode("geometry");

        const anchor = addPoint(-60, -40, true, "explicit");
        const supportLine = addLine(addPoint(-100, -40, false, "endpoint"), addPoint(-20, -40, false, "endpoint"));
        pushModelConstraint(new HorizontalConstraint(supportLine));
        pushModelConstraint(new PointOnLineConstraint(anchor, supportLine));

        const underLine = addLine(addPoint(20, 0, false, "endpoint"), addPoint(100, 0, false, "endpoint"));
        pushModelConstraint(new HorizontalConstraint(underLine));

        const fullLine = addLine(addPoint(-100, 50, true, "endpoint"), addPoint(-20, 50, true, "endpoint"));
        const supportArc = addArc(addPoint(65, 60, true, "center"), 30, Math.PI, Math.PI * 1.5);
        pushModelConstraint(new RadiusConstraint(supportArc, 30));

        solveSketchAndDependents(activeSketchId(), snapshotModelState());
        refreshConstraintAnalysis();
        fitAllGeometryToViewport(150);
        draw();
        return {
          supportLine: { status: constraintStatusOf(supportLine), color: constraintStatusColor(supportLine) },
          underLine: { status: constraintStatusOf(underLine), color: constraintStatusColor(underLine) },
          fullLine: { status: constraintStatusOf(fullLine), color: constraintStatusColor(fullLine) },
          supportArc: { status: constraintStatusOf(supportArc), color: constraintStatusColor(supportArc) },
          summary: constraintAnalysisState.summary,
        };
      },
      resetForReferencePointLineCoincidence() {
        resetModelState();
        setAppMode("geometry");
        const parentPoint = addPoint(-45, 0, false, "explicit");
        const parentLineP1 = addPoint(20, -20, false, "endpoint");
        const parentLineP2 = addPoint(80, -20, false, "endpoint");
        const parentLine = addLine(parentLineP1, parentLineP2);
        const childSketchId = "S2";
        const parentSketchId = activeSketchId();
        model.sketches.push({ id: childSketchId, name: "Sketch-1-1", parentSketchId, kind: "sketch" });
        model.activeSketchId = childSketchId;
        const childLineP1 = addPoint(-80, 35, false, "endpoint");
        const childLineP2 = addPoint(-10, 35, false, "endpoint");
        const childLine = addLine(childLineP1, childLineP2);
        const childPoint = addPoint(50, 30, false, "explicit");
        fitAllGeometryToViewport(190);
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        const screenPoint = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };
        return {
          parentPoint: screenPoint(parentPoint),
          parentLine: screenPoint({ x: 50, y: -20 }),
          childLine: screenPoint({ x: -45, y: 35 }),
          childPoint: screenPoint(childPoint),
        };
      },
      resetForSiblingPointLineReference() {
        resetModelState();
        setAppMode("geometry");
        const activePoint = addPoint(50, 35, false, "explicit");
        const siblingSketchId = "S2";
        model.sketches.push({ id: siblingSketchId, name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
        model.activeSketchId = siblingSketchId;
        const lineP1 = addPoint(10, 0, true, "endpoint");
        const lineP2 = addPoint(90, 0, true, "endpoint");
        const siblingLine = addLine(lineP1, lineP2);
        model.activeSketchId = DEFAULT_SKETCH_ID;
        fitAllGeometryToViewport(190);
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        const screenPoint = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };
        return {
          activePoint: screenPoint(activePoint),
          siblingLine: screenPoint({ x: 50, y: 0 }),
        };
      },
      moveSiblingReferenceLine(dy) {
        const siblingLine = model.lines.find((line) => elementSketchId(line) === "S2");
        if (!siblingLine) return null;
        siblingLine.p1.y += dy;
        siblingLine.p2.y += dy;
        const result = solveReferenceDependentSketches("S2");
        refreshConstraintAnalysis();
        updateUI();
        draw();
        const activePoint = model.points.find((point) => elementSketchId(point) === DEFAULT_SKETCH_ID && isExplicitPoint(point));
        return {
          success: result.success,
          dependentSketchIds: result.results.map((entry) => entry.sketchId),
          activePoint: activePoint ? { x: activePoint.x, y: activePoint.y } : null,
          siblingLine: { p1: { x: siblingLine.p1.x, y: siblingLine.p1.y }, p2: { x: siblingLine.p2.x, y: siblingLine.p2.y } },
          reverseWouldCycle: wouldCreateReferenceCycle("S2", DEFAULT_SKETCH_ID),
        };
      },
      referencePointLineState() {
        const constraints = model.constraints.filter((constraint) => constraint instanceof PointOnLineConstraint && constraint.reference);
        return {
          count: constraints.length,
          errors: constraints.map((constraint) => Math.abs(signedPointLineDistance(constraint.point, constraint.line))),
          referenceSketchIds: constraints.map((constraint) => constraint.referenceSketchId),
          sketchIds: constraints.map((constraint) => constraintSketchId(constraint)),
        };
      },
      resetForBlockCreationUi() {
        resetModelState();
        setAppMode("geometry");
        const p1 = addPoint(-60, -30, false, "endpoint");
        const p2 = addPoint(60, -30, false, "endpoint");
        const p3 = addPoint(60, 30, false, "endpoint");
        const p4 = addPoint(-60, 30, false, "endpoint");
        const lines = [addLine(p1, p2), addLine(p2, p3), addLine(p3, p4), addLine(p4, p1)];
        pushModelConstraint(new HorizontalConstraint(lines[0]));
        pushModelConstraint(new VerticalConstraint(lines[1]));
        pushModelConstraint(new HorizontalConstraint(lines[2]));
        pushModelConstraint(new VerticalConstraint(lines[3]));
        selectedLines = lines.slice();
        fitAllGeometryToViewport(220);
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        const origin = worldToCanvasScreen({ x: 0, y: 0 });
        return { origin: { x: rect.left + origin.x, y: rect.top + origin.y } };
      },
      resetForEmptyBlockCreation() {
        resetModelState();
        setAppMode("geometry");
        updateUI();
        draw();
        return { definitions: model.blockDefinitions.length, lines: model.lines.length };
      },
      blockState() {
        const bundles = blockProjectionBundles();
        return {
          definitions: model.blockDefinitions.map((definition) => ({
            id: definition.id,
            name: definition.name,
            points: definition.points.length,
            lines: definition.lines.length,
            constraints: definition.constraints.length,
            sketches: definition.sketches.map((sketch) => ({ id: sketch.id, name: sketch.name, parentSketchId: sketch.parentSketchId, kind: sketch.kind })),
            activeSketchId: definition.activeSketchId,
            origin: { ...definition.origin },
          })),
          instances: model.blockInstances.map((instance) => ({
            id: instance.id,
            definitionId: instance.definitionId,
            sketchId: instance.sketchId,
            x: instance.x,
            y: instance.y,
            rotation: instance.rotation,
            fixed: instance.fixed,
            enabledSketchIds: instance.enabledSketchIds.slice(),
          })),
          projectionLineIds: bundles.flatMap((bundle) => bundle.lines.map((line) => line.id)),
          selectedInstanceIds: selectedBlockInstances.map((instance) => instance.id),
          mode,
          serialized: serializeModel(),
        };
      },
      blockInteractionPoints() {
        const instance = model.blockInstances[0];
        if (!instance) return null;
        const rect = canvas.getBoundingClientRect();
        const firstLine = blockProjectionBundle(instance).lines[0];
        const hitPoint = firstLine
          ? { x: (firstLine.p1.x + firstLine.p2.x) / 2, y: (firstLine.p1.y + firstLine.p2.y) / 2 }
          : { x: instance.x, y: instance.y };
        const center = worldToCanvasScreen(hitPoint);
        const pivot = worldToCanvasScreen(blockInstanceDisplayCenter(instance));
        const handle = worldToCanvasScreen(blockRotationHandlePoint(instance));
        return {
          center: { x: rect.left + center.x, y: rect.top + center.y },
          pivot: { x: rect.left + pivot.x, y: rect.top + pivot.y },
          handle: { x: rect.left + handle.x, y: rect.top + handle.y },
          scale: viewport.scale,
        };
      },
      blockDefinitionUpdateCase() {
        const definition = model.blockDefinitions[0];
        if (!definition || model.blockInstances.length === 0) return null;
        const before = blockProjectionBundle(model.blockInstances[0]).lines[0].length();
        enterBlockDefinitionEdit(definition.id);
        const editableLine = blockEditSession.draft.lines[0];
        editableLine.p2.x += 40;
        completeBlockDefinitionEdit();
        const lengths = model.blockInstances.map((instance) => blockProjectionBundle(instance).lines[0].length());
        return { before, lengths, revision: definition.revision, editing: Boolean(blockEditSession) };
      },
      blockReadOnlyDimensionCase() {
        const instance = model.blockInstances[0];
        if (!instance) return null;
        const line = blockProjectionBundle(instance).lines[0];
        const target = { kind: "line-length", line, p1: line.p1, p2: line.p2, value: line.length() };
        const dimension = defaultDimensionForTarget(target);
        const constraint = readOnlyDimensionConstraintForPlacement(target, target.value, dimension, { sketchId: instance.sketchId });
        if (!constraint) return { created: false };
        addReadOnlyDimensionConstraint(constraint, instance.sketchId, "ブロック固有寸法");
        return {
          created: true,
          readOnly: constraint.readOnlyDimension,
          enabled: constraint.enabled,
          target: constraint.target,
        };
      },
      blockExternalConstraintCase() {
        const instance = model.blockInstances[1] || model.blockInstances[0];
        if (!instance) return null;
        const definition = blockDefinitionById(instance.definitionId);
        const localPoint = definition?.points[0];
        const projectedPoint = blockProjectionBundle(instance).points.find((point) => point.localElement === localPoint);
        if (!localPoint || !projectedPoint) return null;
        const localBefore = { x: localPoint.x, y: localPoint.y };
        const anchor = addPoint(projectedPoint.x + 75, projectedPoint.y + 40, true, "explicit");
        const constraint = new CoincidentConstraint(projectedPoint, anchor);
        pushModelConstraint(constraint, instance.sketchId);
        const result = solveSketchById(instance.sketchId);
        invalidateBlockProjectionCache(instance.id);
        const nextProjection = blockProjectionBundle(instance).points.find((point) => point.localElement === localPoint);
        return {
          success: result.success,
          errorNorm: result.errorNorm,
          projectedError: hypot2(nextProjection.x - anchor.x, nextProjection.y - anchor.y),
          localBefore,
          localAfter: { x: localPoint.x, y: localPoint.y },
          instance: { x: instance.x, y: instance.y, rotation: instance.rotation },
        };
      },
      reloadBlockState() {
        const data = serializeModel();
        loadModelData(data);
        updateUI();
        draw();
        return {
          definitions: model.blockDefinitions.length,
          instances: model.blockInstances.length,
          projectionLines: allGeometryLines().filter((line) => line.blockProjection).length,
          serializedVersion: serializeModel().version,
        };
      },
      reloadLegacyBlockState() {
        const data = JSON.parse(JSON.stringify(serializeModel()));
        data.version = 7;
        for (const definition of data.blockDefinitions || []) {
          delete definition.origin;
          delete definition.sketches;
          delete definition.activeSketchId;
          for (const item of [...(definition.points || []), ...(definition.lines || []), ...(definition.circles || []), ...(definition.arcs || []), ...(definition.constraints || [])]) {
            delete item.sketchId;
          }
        }
        for (const instance of data.blockInstances || []) delete instance.enabledSketchIds;
        loadModelData(data);
        updateUI();
        draw();
        const definition = model.blockDefinitions[0];
        const instance = model.blockInstances[0];
        return {
          version: serializeModel().version,
          sketches: definition?.sketches.map((sketch) => ({ id: sketch.id, parentSketchId: sketch.parentSketchId, kind: sketch.kind })) || [],
          origin: definition ? { ...definition.origin } : null,
          elementSketchIds: definition ? [...definition.points, ...definition.lines, ...definition.circles, ...definition.arcs].map((item) => item.sketchId) : [],
          enabledSketchIds: instance?.enabledSketchIds.slice() || [],
          projectionLineIds: instance ? blockProjectionBundle(instance).lines.map((line) => line.id) : [],
        };
      },
      blockEditorState() {
        return {
          editing: Boolean(blockEditSession),
          isNew: Boolean(blockEditSession?.isNew),
          name: blockEditSession?.draft?.name || null,
          sketches: model.sketches.map((sketch) => ({ id: sketch.id, name: sketch.name, parentSketchId: sketch.parentSketchId, kind: sketch.kind })),
          activeSketchId: model.activeSketchId,
          hostLineCount: blockEditSession?.original?.lines?.length || 0,
          editorLineCount: model.lines.length,
        };
      },
      addBlockEditorChildGeometry() {
        if (!blockEditSession) return null;
        createSketch("child");
        const sketchId = activeSketchId();
        addLine(addPoint(-20, 50, false, "endpoint"), addPoint(20, 50, false, "endpoint"));
        updateUI();
        draw();
        return { sketchId, sketches: model.sketches.map((sketch) => ({ id: sketch.id, parentSketchId: sketch.parentSketchId })), lineCount: model.lines.length };
      },
      cancelBlockEditor() {
        cancelBlockDefinitionEdit();
        return { editing: Boolean(blockEditSession), definitions: model.blockDefinitions.length, instances: model.blockInstances.length, lines: model.lines.length };
      },
      completeBlockEditor() {
        completeBlockDefinitionEdit();
        return { editing: Boolean(blockEditSession), definitions: model.blockDefinitions.length, instances: model.blockInstances.length };
      },
      setFirstBlockInstanceSketches(ids) {
        const instance = model.blockInstances[0];
        if (!instance) return false;
        return setBlockInstanceEnabledSketchIds(instance, ids);
      },
      blockCreationRejectionCases() {
        resetModelState();
        setAppMode("geometry");
        const p1 = addPoint(0, 0, false, "endpoint");
        const p2 = addPoint(60, 0, false, "endpoint");
        const p3 = addPoint(100, 30, false, "endpoint");
        const selectedLine = addLine(p1, p2);
        addLine(p2, p3);
        selectedLines = [selectedLine];
        const sharedPointError = blockSelectionGeometry().error || null;
        const sharedCounts = { definitions: model.blockDefinitions.length, instances: model.blockInstances.length, lines: model.lines.length };

        resetModelState();
        setAppMode("geometry");
        const line = addLine(addPoint(0, 0, false, "endpoint"), addPoint(60, 0, false, "endpoint"));
        activePresentationSheet().elements.push({
          id: "PE-block-ref",
          type: "leader",
          visible: true,
          geometryRefs: { target: presentationElementKey(line) },
          style: {},
        });
        selectedLines = [line];
        const presentationError = blockSelectionGeometry().error || null;
        return {
          sharedPointError,
          sharedCounts,
          presentationError,
          presentationCounts: { definitions: model.blockDefinitions.length, instances: model.blockInstances.length, lines: model.lines.length },
        };
      },
      sidebarHighlightIds() {
        const ids = new Set();
        for (const point of selectedPoints) ids.add(point.id);
        for (const line of selectedLines) {
          ids.add(line.id);
          ids.add(line.p1.id);
          ids.add(line.p2.id);
        }
        for (const circle of selectedCircles) {
          ids.add(circle.id);
          ids.add(circle.center.id);
        }
        for (const arc of selectedArcs) {
          ids.add(arc.id);
          ids.add(arc.center.id);
        }
        const constraint = effectiveSelectedConstraint() || selectedDimensionConstraint;
        if (constraint) {
          for (const item of constraintGraphNodes(constraint)) {
            if (item?.id) ids.add(item.id);
          }
        }
        for (const item of hoveredSidebarItem?.elements || []) {
          if (item?.id) ids.add(item.id);
        }
        if (hoveredDimensionConstraint) {
          for (const item of constraintGraphNodes(hoveredDimensionConstraint)) {
            if (item?.id) ids.add(item.id);
          }
        }
        return [...ids].sort();
      },
    };
  }

  installTestHooks();
  sampleModel();
  resizeCanvas();
  resetHistory("起動");
})();
