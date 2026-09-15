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
      dimensionConstraint: null,
      constraint: null,
      annotations: [],
      hatches: [],
      referenceImages: [],
    };
    const arrayFields = Object.keys(state).filter(field => Array.isArray(state[field]));
    const fields = Object.keys(state);
    function set(field, value) {
      if (!Object.hasOwn(state, field)) throw new TypeError('Unknown selection field: ' + field);
      state[field] = value;
      return value;
    }
    function clear() {
      for (const field of fields) state[field] = arrayFields.includes(field) ? [] : null;
    }
    function append(field, ...items) { return state[field].push(...items); }
    function removeAt(field, index, count) { return state[field].splice(index, count); }
    // Sidebar rows survive regenerated projections: their identity rule uses the ID.
    // Canvas geometry toggles below intentionally use object identity instead.
    function toggleById(field, item) {
      if (!item) return;
      const items = state[field];
      const index = items.findIndex(selected => selected === item || selected?.id === item.id);
      if (index >= 0) items.splice(index, 1);
      else items.push(item);
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
        Boolean(state.dimensionConstraint);
    }

    function effectiveSelectedConstraint() {
      return hasPrimaryCanvasSelection() ? null : state.constraint;
    }

    function selectedPrimitives() {
      return [...state.circles, ...state.arcs];
    }

    function togglePointSelection(p) {
      if (!p) return;
      state.constraint = null;
      const i = state.points.indexOf(p);
      if (i >= 0) state.points.splice(i, 1);
      else state.points.push(p);
    }

    function toggleLineSelection(l) {
      if (!l) return;
      state.constraint = null;
      const i = state.lines.indexOf(l);
      if (i >= 0) state.lines.splice(i, 1);
      else state.lines.push(l);
    }

    function toggleCircleSelection(c) {
      if (!c) return;
      state.constraint = null;
      const i = state.circles.indexOf(c);
      if (i >= 0) state.circles.splice(i, 1);
      else state.circles.push(c);
    }

    function toggleArcSelection(a) {
      if (!a) return;
      state.constraint = null;
      const i = state.arcs.indexOf(a);
      if (i >= 0) state.arcs.splice(i, 1);
      else state.arcs.push(a);
    }

    function toggleSplineSelection(spline) {
      if (!spline) return;
      state.constraint = null;
      const index = state.splines.indexOf(spline);
      if (index >= 0) state.splines.splice(index, 1);
      else state.splines.push(spline);
    }

    function toggleBlockInstanceSelection(instance) {
      const index = state.blockInstances.indexOf(instance);
      if (index >= 0) state.blockInstances.splice(index, 1);
      else state.blockInstances.push(instance);
    }

    function selectedConstructionTogglePrimitives() {
      if (state.points.length > 0 || state.arcEndpoint || state.arcEndpointPair || state.dimensionConstraint) return [];
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
      return Boolean(constraint && (state.dimensionConstraint === constraint || effectiveSelectedConstraint() === constraint));
    }

    function hasSelection() {
      return state.points.length > 0 ||
        state.lines.length > 0 ||
        state.circles.length > 0 ||
        state.arcs.length > 0 ||
        state.splines.length > 0 ||
        state.blockInstances.length > 0 ||
        state.geometryInstances.length > 0 ||
        Boolean(state.arcEndpoint) ||
        Boolean(state.dimensionConstraint) ||
        state.annotations.length > 0 ||
        state.hatches.length > 0 ||
        state.referenceImages.length > 0 ||
        Boolean(effectiveSelectedConstraint());
    }

    // Read views retain geometry identity. Mutations go through this instance's API.
    const api = {
      set, clear, append, removeAt, toggleById,
      selectedGeometryItems, appearanceSelectionTarget, setGeometrySelection, currentConstraintTargets,
      hasPrimaryCanvasSelection, effectiveSelectedConstraint, selectedPrimitives,
      togglePointSelection, toggleLineSelection, toggleCircleSelection, toggleArcSelection,
      toggleSplineSelection, toggleBlockInstanceSelection, selectedConstructionTogglePrimitives,
      trimConstraintSelection, pushPrimitiveSelection, geometryItemSelectedInCanvas,
      constraintSelectedInCanvas, hasSelection,
    };
    for (const field of fields) Object.defineProperty(api, field, { get: () => state[field], enumerable: true });
    return Object.freeze(api);
  }
  window.CanvasSelection = Object.freeze({ create });
})();
