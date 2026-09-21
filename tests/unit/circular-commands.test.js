const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ["src/geometry/geometry_kernel.js", "src/geometry/spline_geometry.js", "src/solver/constraint_solver.js", "src/editing/circular_construction.js", "src/commands/circular_commands.js"]) vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
const { Point, Circle, Arc } = sandbox.window.GeometrySolver;
function create() {
  const state = { model: { points: [], circles: [], arcs: [] }, pointSeq: 1, failCircle: false, failArc: false, success: true, preview: null, log: [], snaps: [], selected: {} };
  const addPoint = (x, y, fixed, kind) => { const p = new Point(`P${state.pointSeq++}`, x, y, fixed, kind); state.model.points.push(p); return p; };
  const construction = sandbox.window.CircularConstruction.create({
    endpointAt: (x, y) => addPoint(x, y, false, "endpoint"), addPoint,
    addCircle(center, radius) { if (state.failCircle || radius < 1e-6) return null; const c = new Circle("C1", center, radius, true); state.model.circles.push(c); return c; },
    addArc(center, radius, start, end) { if (state.failArc) return null; const a = new Arc("A1", center, radius, start, end, true); state.model.arcs.push(a); return a; },
    addPointSnapConstraints(point, snap) { state.snaps.push(["center", point, snap]); },
    addArcEndpointSnapConstraints(arc, endpoint, snap) { state.snaps.push([endpoint, arc, snap]); },
    addCircularBoundarySnapConstraints(primitive, snap) { state.snaps.push(["boundary", primitive, snap]); },
    currentScope: () => state.model, readPointSequence: () => state.pointSeq, restorePointSequence: value => { state.pointSeq = value; },
  });
  const commands = sandbox.window.CircularCommands.create({ construction, minArcLength: 1,
    selection: { set(key, values) { state.selected[key] = Array.from(values); } },
    setPointerPreview(point) { state.preview = point; state.log.push(point ? "preview" : "clear-preview"); },
    clearSnap() { state.log.push("clear-snap"); }, clearSelection() { state.selected = {}; state.log.push("clear-selection"); },
    setHint(text, severity) { state.log.push(["hint", text, severity]); }, updateUI() { state.log.push("ui"); }, draw() { state.log.push("draw"); },
    solveAndRefresh(label) { assert.equal(state.preview, null); assert.deepEqual(state.selected, {}); state.log.push(["solve", label]); return { success: state.success }; },
  });
  return { commands, state, addPoint };
}
test("circle creates a model center immediately, retains it on rejection and clears inputs before solve", () => {
  const h = create(); h.commands.clickCircle({ x: 0, y: 0 }, "center-snap");
  assert.equal(h.state.model.points.length, 1); assert.equal(h.state.selected.points[0], h.commands.circleCenterPoint);
  h.commands.clickCircle({ x: 0, y: 0 }, "bad-radius"); assert.ok(h.commands.circleCenterPoint); assert.equal(h.state.model.circles.length, 0);
  h.state.log.length = 0; h.commands.clickCircle({ x: 3, y: 4 }, "boundary-snap");
  assert.equal(h.state.model.circles[0].radius(), 5); assert.equal(h.commands.circleCenterPoint, null);
  assert.equal(h.state.snaps[0][2], "center-snap"); assert.equal(h.state.snaps[1][2], "boundary-snap");
  assert.deepEqual(h.state.log, ["preview", "clear-preview", "clear-snap", "clear-selection", ["solve", "円追加"]]);
});
test("center arc rejects zero radius and retains start snap while crossing the angle wrap", () => {
  const h = create(); h.commands.clickArc({ x: 0, y: 0 }, "center"); h.commands.clickArc({ x: 0, y: 0 });
  assert.equal(h.commands.arcStartPoint, null); assert.ok(h.commands.arcCenterPoint);
  h.commands.clickArc({ x: -40, y: 1 }, "start"); const start = h.commands.arcStartPoint;
  assert.equal(Object.isFrozen(start), true);
  h.commands.clickArc({ x: -40, y: -1 }, "end");
  const arc = h.state.model.arcs[0]; assert.ok(Math.abs(arc.radius() - Math.hypot(40, 1)) < 1e-12);
  assert.ok(arc.endAngle > Math.PI); assert.ok(arc.endAngle - arc.startAngle < 0.1);
  assert.deepEqual(h.state.snaps.map(entry => [entry[0], entry[2]]), [["center", "center"], ["start", "start"], ["end", "end"]]);
  assert.equal(h.commands.arcCenterPoint, null); assert.equal(h.commands.arcStartPoint, null);
});
test("three-point arc holds coordinate snapshots and applies endpoint and boundary snaps on final click", () => {
  const h = create(), first = { x: -50, y: 0 }; h.commands.clickThreePointArc(first, "start"); first.x = -500;
  h.commands.clickThreePointArc({ x: -50, y: 0 }); assert.equal(h.commands.threePointArcEnd, null);
  h.commands.clickThreePointArc({ x: 50, y: 0 }, "end"); h.commands.clickThreePointArc({ x: 0, y: 0 });
  assert.equal(h.state.model.points.length, 0); assert.equal(h.commands.threePointArcStart.x, -50);
  h.commands.clickThreePointArc({ x: 0, y: -50 }, "through");
  assert.equal(h.state.model.points.length, 1); assert.equal(h.state.model.arcs[0].radius(), 50);
  assert.deepEqual(h.state.snaps.map(entry => [entry[0], entry[2]]), [["start", "start"], ["end", "end"], ["boundary", "through"]]);
  assert.equal(h.commands.threePointArcStart, null); assert.equal(h.commands.threePointArcEnd, null);
});
test("failed three-point arc allocation removes only its new center and restores point sequence for retry", () => {
  const h = create(), existing = h.addPoint(200, 200, true, "explicit");
  h.commands.clickThreePointArc({ x: -50, y: 0 }); h.commands.clickThreePointArc({ x: 50, y: 0 });
  h.state.failArc = true; h.commands.clickThreePointArc({ x: 0, y: -50 });
  assert.deepEqual(h.state.model.points, [existing]); assert.equal(h.state.pointSeq, 2); assert.ok(h.commands.threePointArcEnd);
  h.state.failArc = false; h.commands.clickThreePointArc({ x: 0, y: -50 });
  assert.equal(h.state.model.arcs[0].center.id, "P2");
});
test("reset APIs preserve the existing distinction between circle, center-arc and both arc inputs", () => {
  const h = create(), other = create(); h.commands.clickCircle({ x: 0, y: 0 }); h.commands.clickArc({ x: 30, y: 0 }); h.commands.clickThreePointArc({ x: 60, y: 0 });
  h.commands.resetCenterArc(); assert.equal(h.commands.arcCenterPoint, null); assert.ok(h.commands.circleCenterPoint); assert.ok(h.commands.threePointArcStart);
  h.commands.resetArcs(); assert.equal(h.commands.threePointArcStart, null); assert.ok(h.commands.circleCenterPoint);
  h.commands.resetCircle(); assert.equal(h.commands.circleCenterPoint, null); assert.equal(h.state.model.points.length, 2);
  assert.equal(other.commands.circleCenterPoint, null); assert.equal(other.state.model.points.length, 0);
});
test("circular commands leave solve failure policy with the solver port without adding a new rollback", () => {
  const h = create(); h.state.success = false; h.commands.clickCircle({ x: 0, y: 0 }); h.commands.clickCircle({ x: 30, y: 0 });
  assert.equal(h.state.model.circles.length, 1); assert.equal(h.commands.circleCenterPoint, null);
  h.commands.clickThreePointArc({ x: -50, y: 50 }); h.commands.clickThreePointArc({ x: 50, y: 50 }); h.commands.clickThreePointArc({ x: 0, y: 100 });
  assert.equal(h.state.model.arcs.length, 1); assert.equal(h.commands.threePointArcStart, null);
});

test("center arc allocation failure retains the same center/start for retry and does not attach endpoint snaps", () => {
  const h = create(); h.commands.clickArc({ x: 0, y: 0 }, "center"); h.commands.clickArc({ x: 40, y: 0 }, "start");
  const center = h.commands.arcCenterPoint, start = h.commands.arcStartPoint;
  h.state.failArc = true; h.commands.clickArc({ x: 0, y: 40 }, "end");
  assert.equal(h.commands.arcCenterPoint, center); assert.equal(h.commands.arcStartPoint, start);
  assert.equal(h.state.model.arcs.length, 0); assert.equal(h.state.snaps.length, 1);
  h.state.failArc = false; h.commands.clickArc({ x: 0, y: 40 }, "end");
  assert.equal(h.state.model.arcs[0].center, center); assert.equal(h.state.snaps.length, 3);
  assert.equal(h.commands.arcStartPoint, null);
});
