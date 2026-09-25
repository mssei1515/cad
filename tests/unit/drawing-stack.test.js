const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ["src/geometry/geometry_kernel.js", "src/geometry/spline_geometry.js", "src/solver/constraint_solver.js", "src/document/drawing_order.js", "src/rendering/drawing_stack.js"]) vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
const { Line, Point } = sandbox.window.GeometrySolver;
const line = (id, sketchId, drawingOrder) => Object.assign(new Line(id, new Point(id + "a", 0, 0), new Point(id + "b", 10, 0)), { sketchId, drawingOrder });
function create(scope) {
  let current = scope, reads = 0;
  const painted = [];
  const geometryReads = {};
  for (const [fn, collection] of [["allHatches", "hatches"], ["allGeometryLines", "lines"], ["allGeometryCircles", "circles"], ["allGeometryArcs", "arcs"], ["allGeometrySplines", "splines"]]) geometryReads[fn] = () => { reads++; return current[collection]; };
  const painters = Object.fromEntries(["hatch", "line", "circle", "arc", "spline"].map(kind => [kind, items => painted.push({ kind, items })]));
  const stack = sandbox.window.DrawingStack.create({ currentScope: () => current, activeSketchId: () => "S1", geometryReads, isVisibleSketchId: id => id !== "hidden", isVisibleSketchElement: item => item.sketchId !== "hidden", hatchAppearanceForDisplay: item => ({ visible: item.visible }), painters });
  return { stack, painted, reads: () => reads, switchScope: next => { current = next; } };
}
const scope = () => ({ sketches: [{ id: "S1" }, { id: "S2" }], hatches: [], lines: [], circles: [], arcs: [], splines: [], blockInstances: [], geometryInstances: [] });
test("collection-order fast path preserves original arrays and avoids projection reads", () => {
  const model = scope(); model.lines.push(line("L1", "S1", 0));
  const { stack, painted, reads } = create(model);
  stack.drawDrawingStack();
  assert.equal(reads(), 0);
  assert.equal(painted.find(entry => entry.kind === "line").items, model.lines);
});
test("active sketch is last, invisible items are omitted and adjacent kinds batch", () => {
  const model = scope();
  const active = line("active", "S1", 0), other = line("other", "S2", 0);
  model.lines.push(active, line("hidden", "hidden", 0), other);
  const { stack, painted } = create(model);
  assert.deepEqual(Array.from(stack.drawingStackEntries(), entry => entry.item.id), ["other", "active"]);
  stack.drawDrawingStack();
  assert.equal(painted.length, 1);
  assert.deepEqual(Array.from(painted[0].items), [other, active]);
});
test("current scope is read at invocation and projected local order is preserved", () => {
  const first = scope(), next = scope();
  const instance = { id: "B1", sketchId: "S1", drawingOrder: 0 };
  const a = Object.assign(line("a", "S1", 0), { blockProjection: true, blockInstance: instance, localElement: { drawingOrder: 2 } });
  const b = Object.assign(line("b", "S1", 0), { blockProjection: true, blockInstance: instance, localElement: { drawingOrder: 1 } });
  next.lines.push(a, b); next.blockInstances.push(instance);
  const { stack, switchScope } = create(first);
  assert.equal(stack.drawingStackEntries().length, 0);
  switchScope(next);
  assert.deepEqual(Array.from(stack.drawingStackEntries(), entry => entry.item.id), ["b", "a"]);
});

test("hidden hatch appearance is excluded and equal owner order retains hatch-first fallback", () => {
  const model = scope();
  model.hatches.push({ id: "visible", sketchId: "S1", drawingOrder: 0 }, { id: "invisible", sketchId: "S1", drawingOrder: 0, visible: false });
  model.lines.push(line("L1", "S1", 0));
  const { stack } = create(model);
  assert.deepEqual(Array.from(stack.drawingStackEntries(), entry => entry.item.id), ["visible", "L1"]);
});
