const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["src/geometry/geometry_kernel.js", "src/geometry/spline_geometry.js", "src/solver/constraint_solver.js", "src/editing/selection.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
}
const { Point, Line, Circle, Arc } = sandbox.window.GeometrySolver;
const create = sandbox.window.CanvasSelection.create;

test("selection instances are isolated and preserve Canvas identity versus sidebar ID matching", () => {
  const first = create(), second = create();
  const point = new Point("P1", 0, 0), regenerated = new Point("P1", 0, 0);
  first.togglePointSelection(point);
  first.togglePointSelection(regenerated);
  assert.equal(first.points.length, 2);
  assert.equal(second.points.length, 0);
  first.togglePointSelection(point);
  assert.equal(first.points[0], regenerated);
  first.toggleById("points", point);
  assert.equal(first.points.length, 0);
  second.set("points", [point]);
  first.clear();
  assert.equal(second.points[0], point);
});

test("geometry replacement clears endpoint and dimension selection but preserves other categories", () => {
  const selection = create(), point = new Point("P1", 0, 0);
  const annotation = { id: "N1" }, constraint = { type: "horizontal" };
  selection.set("annotations", [annotation]);
  selection.set("constraint", constraint);
  selection.set("arcEndpoint", { arc: {}, endpoint: "start" });
  selection.set("arcEndpointPair", [{ arc: {}, endpoint: "end" }]);
  selection.set("dimensionConstraint", {});
  selection.setGeometrySelection({ kind: "point", item: point });
  assert.equal(selection.points[0], point);
  assert.equal(selection.arcEndpoint, null);
  assert.equal(selection.arcEndpointPair, null);
  assert.equal(selection.dimensionConstraint, null);
  assert.equal(selection.annotations[0], annotation);
  assert.equal(selection.constraint, constraint);
  assert.equal(selection.effectiveSelectedConstraint(), null);
  selection.setGeometrySelection({ kind: "point", item: point }, true);
  assert.equal(selection.effectiveSelectedConstraint(), constraint);
  selection.clear();
  assert.equal(selection.hasSelection(), false);
});

test("arc endpoint targets preserve order, highlight their arc and supersede point pairs", () => {
  const selection = create();
  const p = new Point("P1", 0, 0), other = new Point("P2", 10, 0);
  const arc = new Arc("A1", p, 10, 0, Math.PI);
  selection.set("points", [other]);
  selection.set("arcEndpoint", { arc, endpoint: "end" });
  let targets = selection.currentConstraintTargets();
  assert.equal(targets.axisPointPair[0].arc, arc);
  assert.equal(targets.axisPointPair[0].endpoint, "end");
  assert.equal(targets.axisPointPair[1].point, other);
  assert.equal(selection.geometryItemSelectedInCanvas(arc), true);
  selection.set("arcEndpointPair", [{ arc, endpoint: "start" }, { arc, endpoint: "end" }]);
  targets = selection.currentConstraintTargets();
  assert.equal(targets.axisPointPair[0].endpoint, "start");
  assert.equal(targets.axisPointPair[1].endpoint, "end");
});

test("constraint trimming preserves mixed geometry precedence and Circle before Arc ordering", () => {
  const selection = create();
  const p = new Point("P1", 0, 0), q = new Point("P2", 10, 0);
  const line = new Line("L1", p, q), circle = new Circle("C1", p, 10), arc = new Arc("A1", p, 10, 0, 1);
  selection.set("points", [p, q]);
  selection.set("lines", [line]);
  selection.set("circles", [circle]);
  selection.set("arcs", [arc]);
  selection.trimConstraintSelection("distance");
  assert.equal(selection.points.length, 1);
  assert.equal(selection.lines[0], line);
  assert.equal(selection.selectedPrimitives().length, 0);
  selection.clear();
  selection.set("points", [p]);
  selection.set("circles", [circle]);
  selection.set("arcs", [arc]);
  selection.trimConstraintSelection("pointOnCircle");
  assert.equal(selection.selectedPrimitives().length, 1);
  assert.equal(selection.selectedPrimitives()[0], circle);
});

test("appearance targets distinguish ordinary geometry and instance overrides", () => {
  const selection = create(), instance = { id: "FI1" };
  selection.set("geometryInstances", [instance]);
  assert.equal(selection.appearanceSelectionTarget().key, "appearanceOverride");
  selection.set("points", [new Point("P1", 0, 0)]);
  assert.equal(selection.appearanceSelectionTarget(), null);
  selection.clear();
  const point = new Point("P1", 0, 0);
  selection.set("points", [point]);
  assert.equal(selection.appearanceSelectionTarget().item, point);
  point.blockProjection = true;
  assert.equal(selection.appearanceSelectionTarget(), null);
});


test('rectangle application merges by identity and retains unrelated derived-instance selection', () => {
  const selection = create(), a = { id: 'P1' }, b = { id: 'P1' }, instance = { id: 'GI1' };
  selection.set('points', [a]); selection.set('geometryInstances', [instance]); selection.set('constraint', {}); selection.set('arcEndpointPair', {});
  const candidates = { points: [a, b], lines: [], circles: [], arcs: [], splines: [], blockInstances: [], annotations: [], hatches: [], referenceImages: [] };
  selection.applyRectangle(candidates, true); assert.deepEqual(Array.from(selection.points), [a, b]);
  assert.equal(selection.constraint, null); assert.equal(selection.arcEndpointPair, null); assert.equal(selection.geometryInstances[0], instance);
  candidates.points = [b]; selection.applyRectangle(candidates); assert.deepEqual(Array.from(selection.points), [b]); assert.equal(selection.geometryInstances[0], instance);
});
