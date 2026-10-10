/* Canvas selection ownership and selection rules. No Document, DOM or edit history. */
(function () {
  "use strict";
  const { Point, Line, Circle, Arc, Spline } = window.GeometrySolver;

  function create() {
    const state = {
      points: [],
      lines: [],
      circles: [],
      arcs: [],
      splines: [],
      blockInstances: [],
      geometryInstances: [],
      instanceGeometry: null,
      arcEndpoint: null,
      arcEndpointPair: null,
      dimensionConstraints: [],
      constraint: null,
      annotations: [],
      hatches: [],
      referenceImages: [],
      sketchId: null,
      inspection: null,
    };
    const arrayFields = Object.keys(state).filter(field => Array.isArray(state[field]));
    const fields = Object.keys(state);
    Object.defineProperty(state, "dimensionConstraint", { get: () => state.dimensionConstraints.length === 1 ? state.dimensionConstraints[0] : null, set: value => { state.dimensionConstraints = value ? [value] : []; } });
    function set(field, value) {
      if (!Object.hasOwn(state, field)) throw new TypeError('Unknown selection field: ' + field);
      if (field !== "sketchId" && field !== "inspection" && (Array.isArray(value) ? value.length : value)) clearTreeSelection();
      state[field] = value;
      return value;
    }
    function clear() {
      for (const field of fields) state[field] = arrayFields.includes(field) ? [] : null;
    }
    function clearTreeSelection() { state.sketchId = null; state.inspection = null; }
    function inspectionContains(item) {
      return Boolean(item && state.inspection?.targets.some(target => target.item === item));
    }
    function selectInspection(target, sketchId, additive = false) {
      const previous = state.inspection;
      if (additive && ((previous && previous.sketchId !== sketchId) || selectedElementCount() > 0 || state.constraint)) return false;
      const targets = additive && previous?.sketchId === sketchId && target.category !== "constraint"
        && previous.targets.every(candidate => candidate.category !== "constraint") ? [...previous.targets] : [];
      const index = targets.findIndex(candidate => candidate.kind === target.kind && candidate.category === target.category
        && (candidate.item === target.item || target.item.id != null && candidate.item.id === target.item.id));
      if (index >= 0) targets.splice(index, 1); else targets.push(target);
      clear();
      if (targets.length) state.inspection = { sketchId, targets };
      return true;
    }
    function append(field, ...items) { clearTreeSelection(); return state[field].push(...items); }
    function removeAt(field, index, count) { return state[field].splice(index, count); }
    // Sidebar rows survive regenerated projections: their identity rule uses the ID.
    // Canvas geometry toggles below intentionally use object identity instead.
    function toggleById(field, item) {
      if (!item) return;
      clearTreeSelection();
      const items = state[field];
      const index = items.findIndex(selected => selected === item || item.id != null && selected?.id === item.id);
      if (index >= 0) items.splice(index, 1);
      else items.push(item);
    }

    function applyRectangle(candidates, additive = false) {
      clearTreeSelection();
      for (const field of ["points", "lines", "circles", "arcs", "splines", "blockInstances", "geometryInstances", "annotations", "hatches", "referenceImages", "dimensionConstraints"]) {
        const next = additive ? [...state[field]] : [];
        for (const item of candidates[field] || []) if (item && !next.includes(item)) next.push(item);
        state[field] = next;
      }
      state.arcEndpoint = null;
      state.arcEndpointPair = null;
      state.constraint = null;
    }

    function selectedGeometryItems() {
      return [...state.points, ...state.lines, ...state.circles, ...state.arcs, ...state.splines];
    }

    function appearanceSelectionTarget() {
      if (state.geometryInstances.length === 1 && selectedGeometryItems().length === 0 && state.blockInstances.length === 0) {
        return { kind: "geometryInstance", item: state.geometryInstances[0], key: "appearanceOverride" };
      }
      if (state.blockInstances.length === 1 && selectedGeometryItems().length === 0) {
        return { kind: "blockInstance", item: state.blockInstances[0], key: "appearanceOverride" };
      }
      const items = selectedGeometryItems().filter((item) => !item.blockProjection);
      if (items.length !== 1 || state.blockInstances.length > 0 || state.geometryInstances.length > 0) return null;
      return { kind: "geometry", item: items[0], key: "appearance" };
    }

    function setGeometrySelection(hit, additive = false) {
      clearTreeSelection();
      if (!additive) {
        state.points = [];
        state.lines = [];
        state.circles = [];
        state.arcs = [];
        state.splines = [];
        state.arcEndpoint = null;
        state.arcEndpointPair = null;
        state.dimensionConstraint = null;
      }
      if (!hit?.item) return;
      if (hit.kind === "point") {
        if (additive && state.points.includes(hit.item)) state.points = state.points.filter((item) => item !== hit.item);
        else if (!state.points.includes(hit.item)) state.points.push(hit.item);
      } else if (hit.kind === "line") {
        if (additive && state.lines.includes(hit.item)) state.lines = state.lines.filter((item) => item !== hit.item);
        else if (!state.lines.includes(hit.item)) state.lines.push(hit.item);
      } else if (hit.kind === "circle") {
        if (additive && state.circles.includes(hit.item)) state.circles = state.circles.filter((item) => item !== hit.item);
        else if (!state.circles.includes(hit.item)) state.circles.push(hit.item);
      } else if (hit.kind === "arc") {
        if (additive && state.arcs.includes(hit.item)) state.arcs = state.arcs.filter((item) => item !== hit.item);
        else if (!state.arcs.includes(hit.item)) state.arcs.push(hit.item);
      } else if (hit.kind === "spline") {
        if (additive && state.splines.includes(hit.item)) state.splines = state.splines.filter((item) => item !== hit.item);
        else if (!state.splines.includes(hit.item)) state.splines.push(hit.item);
      }
    }

    function currentConstraintTargets() {
      const axisPointPair = state.arcEndpointPair?.length === 2
        ? state.arcEndpointPair.map((item) => ({ kind: "arc-endpoint", arc: item.arc, endpoint: item.endpoint }))
        : state.arcEndpoint
          ? [{ kind: "arc-endpoint", arc: state.arcEndpoint.arc, endpoint: state.arcEndpoint.endpoint }, ...state.points.map((point) => ({ kind: "point", point }))].slice(0, 2)
          : state.points.map((point) => ({ kind: "point", point })).slice(0, 2);
      return { points: state.points, lines: state.lines, circles: state.circles, arcs: state.arcs, splines: state.splines, arcEndpointPair: state.arcEndpointPair, arcEndpoint: state.arcEndpoint, axisPointPair: axisPointPair.length === 2 ? axisPointPair : null };
    }

    function hasPrimaryCanvasSelection() {
      return state.points.length > 0 ||
        state.lines.length > 0 ||
        state.circles.length > 0 ||
        state.arcs.length > 0 ||
        state.splines.length > 0 ||
        state.blockInstances.length > 0 ||
        state.geometryInstances.length > 0 ||
        Boolean(state.arcEndpoint) ||
        Boolean(state.arcEndpointPair) ||
        state.dimensionConstraints.length > 0;
    }

    function effectiveSelectedConstraint() {
      return hasPrimaryCanvasSelection() ? null : state.constraint;
    }

    function selectedPrimitives() {
      return [...state.circles, ...state.arcs];
    }

    function togglePointSelection(p) {
      if (!p) return;
      clearTreeSelection();
      state.constraint = null;
      const i = state.points.indexOf(p);
      if (i >= 0) state.points.splice(i, 1);
      else state.points.push(p);
    }

    function toggleLineSelection(l) {
      if (!l) return;
      clearTreeSelection();
      state.constraint = null;
      const i = state.lines.indexOf(l);
      if (i >= 0) state.lines.splice(i, 1);
      else state.lines.push(l);
    }

    function toggleCircleSelection(c) {
      if (!c) return;
      clearTreeSelection();
      state.constraint = null;
      const i = state.circles.indexOf(c);
      if (i >= 0) state.circles.splice(i, 1);
      else state.circles.push(c);
    }

    function toggleArcSelection(a) {
      if (!a) return;
      clearTreeSelection();
      state.constraint = null;
      const i = state.arcs.indexOf(a);
      if (i >= 0) state.arcs.splice(i, 1);
      else state.arcs.push(a);
    }

    function toggleSplineSelection(spline) {
      if (!spline) return;
      clearTreeSelection();
      state.constraint = null;
      const index = state.splines.indexOf(spline);
      if (index >= 0) state.splines.splice(index, 1);
      else state.splines.push(spline);
    }

    function toggleBlockInstanceSelection(instance) {
      clearTreeSelection();
      const index = state.blockInstances.indexOf(instance);
      if (index >= 0) state.blockInstances.splice(index, 1);
      else state.blockInstances.push(instance);
    }

    function selectedConstructionTogglePrimitives() {
      if (state.points.length > 0 || state.arcEndpoint || state.arcEndpointPair || state.dimensionConstraints.length) return [];
      return [...state.lines, ...state.circles, ...state.arcs, ...state.splines];
    }

    function trimConstraintSelection(type) {
      const trimPrimitives = (count) => {
        const primitives = selectedPrimitives().slice(0, count);
        state.circles = primitives.filter((p) => p instanceof Circle);
        state.arcs = primitives.filter((p) => p instanceof Arc);
      };
      if (type === "coincident") {
        state.points = state.points.slice(0, 2);
        state.lines = state.points.length >= 2 ? [] : state.lines.slice(0, 2);
        trimPrimitives(state.points.length === 1 && state.lines.length === 0 ? 1 : 0);
      } else if (type === "horizontal" || type === "vertical") {
        state.points = state.lines.length > 0 ? [] : state.points.slice(0, 2);
        state.circles = [];
        state.arcs = [];
        state.lines = state.points.length > 0 ? [] : state.lines.slice(0, 1);
      } else if (type === "parallel" || type === "perpendicular") {
        state.points = [];
        state.circles = [];
        state.arcs = [];
        state.lines = state.lines.slice(0, 2);
        state.arcEndpoint = null;
      } else if (type === "symmetry") {
        state.points = state.arcs.length > 0 ? [] : state.points.slice(0, 2);
        state.lines = state.points.length > 0 || state.arcs.length > 0 ? state.lines.slice(0, 1) : state.lines.slice(0, 3);
        state.circles = [];
        state.arcs = state.points.length === 0 && state.lines.length === 1 ? state.arcs.slice(0, 2) : [];
        state.arcEndpoint = null;
      } else if (type === "collinear") {
        state.points = [];
        state.circles = [];
        state.arcs = [];
        state.arcEndpoint = null;
        state.lines = state.lines.slice(0, 2);
      } else if (type === "equal" || type === "equalRadius") {
        state.points = [];
        state.arcEndpoint = null;
        if (state.lines.length > 0) {
          state.lines = state.lines.slice(0, 2);
          state.circles = [];
          state.arcs = [];
        } else {
          state.lines = [];
          trimPrimitives(2);
        }
      } else if (type === "concentric" || type === "pointOnCircle") {
        state.points = state.points.slice(0, 1);
        state.lines = [];
        trimPrimitives(type === "concentric" && state.points.length === 0 ? 2 : 1);
      } else if (type === "tangent") {
        state.points = [];
        state.lines = state.lines.slice(0, 1);
        trimPrimitives(state.lines.length === 1 ? 1 : 2);
      } else if (type === "distance") {
        state.points = state.points.slice(0, 2);
        state.lines = state.lines.slice(0, 2);
        trimPrimitives(2);
        if (state.points.length > 0 && state.lines.length > 0) {
          state.points = state.points.slice(0, 1);
          state.lines = state.lines.slice(0, 1);
          state.circles = [];
          state.arcs = [];
        } else if (state.lines.length > 0 && selectedPrimitives().length > 0) {
          state.points = [];
          state.lines = state.lines.slice(0, 1);
          trimPrimitives(1);
        }
      }
    }

    function pushPrimitiveSelection(primitive) {
      if (!primitive) return;
      clearTreeSelection();
      if (primitive instanceof Circle) {
        if (!state.circles.includes(primitive)) state.circles.push(primitive);
      } else if (primitive instanceof Arc) {
        if (!state.arcs.includes(primitive)) state.arcs.push(primitive);
      }
    }

    function geometryItemSelectedInCanvas(item) {
      if (!item) return false;
      if (item instanceof Point) return state.points.includes(item);
      if (item instanceof Line) return state.lines.includes(item);
      if (item instanceof Circle) return state.circles.includes(item);
      if (item instanceof Arc) return state.arcs.includes(item) || state.arcEndpoint?.arc === item || state.arcEndpointPair?.some((endpoint) => endpoint.arc === item);
      if (item instanceof Spline) return state.splines.includes(item);
      return false;
    }

    function constraintSelectedInCanvas(constraint) {
      return Boolean(constraint && (state.dimensionConstraints.includes(constraint) || effectiveSelectedConstraint() === constraint));
    }

    function hasSelection() {
      return Boolean(state.sketchId || state.inspection) || state.points.length > 0 ||
        state.lines.length > 0 ||
        state.circles.length > 0 ||
        state.arcs.length > 0 ||
        state.splines.length > 0 ||
        state.blockInstances.length > 0 ||
        state.geometryInstances.length > 0 ||
        Boolean(state.arcEndpoint) ||
        state.dimensionConstraints.length > 0 ||
        state.annotations.length > 0 ||
        state.hatches.length > 0 ||
        state.referenceImages.length > 0 ||
        Boolean(effectiveSelectedConstraint());
    }

    function selectedDragPoints() {
      const points = [...state.points];
      for (const line of state.lines) points.push(line.p1, line.p2);
      for (const circle of state.circles) points.push(circle.center);
      for (const arc of state.arcs) points.push(arc.center);
      for (const spline of state.splines) points.push(...spline.fitPoints);
      return points;
    }

    function selectedElementCount() {
      return state.dimensionConstraints.length + state.points.length + state.lines.length + state.circles.length + state.arcs.length + state.splines.length + state.blockInstances.length + state.geometryInstances.length + state.annotations.length + state.hatches.length + state.referenceImages.length + (state.arcEndpoint ? 1 : 0);
    }

    // Read views retain geometry identity. Mutations go through this instance's API.
    const api = {
      toggleDimensionConstraint: item => { if (!item) return; clearTreeSelection(); state.constraint = null; const index = state.dimensionConstraints.indexOf(item); if (index < 0) state.dimensionConstraints.push(item); else state.dimensionConstraints.splice(index, 1); },
      inspectionContains, selectInspection, selectedDragPoints, selectedElementCount, set, clear, append, removeAt, toggleById, applyRectangle,
      selectedGeometryItems, appearanceSelectionTarget, setGeometrySelection, currentConstraintTargets,
      hasPrimaryCanvasSelection, effectiveSelectedConstraint, selectedPrimitives,
      togglePointSelection, toggleLineSelection, toggleCircleSelection, toggleArcSelection,
      toggleSplineSelection, toggleBlockInstanceSelection, selectedConstructionTogglePrimitives,
      trimConstraintSelection, pushPrimitiveSelection, geometryItemSelectedInCanvas,
      constraintSelectedInCanvas, hasSelection,
    };
    for (const field of [...fields, "dimensionConstraint"]) Object.defineProperty(api, field, { get: () => state[field], enumerable: true });
    return Object.freeze(api);
  }
  window.CanvasSelection = Object.freeze({ create });
})();
