const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ["src/geometry/geometry_kernel.js", "src/geometry/spline_geometry.js", "src/solver/constraint_solver.js", "src/editing/slot_construction.js", "src/commands/slot_command.js"]) vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
const { Point, Line, Arc, ArcEndpointCoincidentConstraint, LineCircleTangentConstraint, EqualRadiusConstraint } = sandbox.window.GeometrySolver;
function create() {
  const state = { model: { points: [], lines: [], arcs: [], constraints: [] }, sequence: 1, success: true, failArc: false, preview: null, log: [], snaps: [] };
  let command;
  const construction = sandbox.window.SlotConstruction.create({
    addPoint(x, y, fixed, kind) { const p = new Point(`P${state.sequence++}`, x, y, fixed, kind); state.model.points.push(p); return p; },
    addLine(p1, p2) { const l = new Line(`L${state.sequence++}`, p1, p2, true); state.model.lines.push(l); return l; },
    addArc(center, radius, start, end) { if (state.failArc) return null; const a = new Arc(`A${state.sequence++}`, center, radius, start, end, true); state.model.arcs.push(a); return a; },
    addConstraintIfMissing(c, matches) { if (!state.model.constraints.some(matches)) state.model.constraints.push(c); },
    addPointSnapConstraints(point, snap) { state.snaps.push(["point", point, snap]); },
    addLineBoundarySnapConstraints(line, snap) { state.snaps.push(["line", line, snap]); },
    snapshotGeometryMutationState() { state.log.push("capture"); return { model: Object.fromEntries(Object.entries(state.model).map(([key, list]) => [key, list.slice()])), sequence: state.sequence }; },
    restoreGeometryMutationState(snapshot) { state.log.push("restore"); state.model = snapshot.model; state.sequence = snapshot.sequence; },
    solveAndRefresh(label) { state.log.push(["solve", label]); assert.equal(command.firstCenter, null); assert.equal(command.secondCenter, null); assert.equal(state.preview, null); return { success: state.success }; },
  });
  command = sandbox.window.SlotCommand.create({ construction, minLineLength: 1, minArcLength: 1,
    setPointerPreview(point) { state.preview = point; state.log.push(point ? "preview" : "clear-preview"); },
    clearSnap() { state.log.push("clear-snap"); }, clearSelection() { state.log.push("clear-selection"); },
    setHint(text, severity) { state.log.push(["hint", text, severity]); }, updateUI() { state.log.push("ui"); }, draw() { state.log.push("draw"); },
  });
  return { state, command };
}
function centers(h) { h.command.click({ x: 0, y: 0 }, "first"); h.command.click({ x: 80, y: 0 }, "second"); }
test("slot input owns immutable center snapshots and rejects invalid clicks without model mutation", () => {
  const h = create(), input = { x: 0, y: 0 }; h.command.click(input, "first"); input.x = 500;
  assert.equal(h.command.firstCenter.x, 0); assert.equal(Object.isFrozen(h.command.firstCenter), true);
  h.command.click({ x: 0, y: 0 }); assert.equal(h.command.secondCenter, null);
  h.command.click({ x: 80, y: 0 }, "second"); h.command.click({ x: 40, y: 0 });
  assert.ok(h.command.firstCenter && h.command.secondCenter);
  assert.equal(h.state.model.points.length, 0); assert.equal(h.state.log.includes("capture"), false);
  assert.match(h.state.log.filter(e => Array.isArray(e) && e[0] === "hint").at(-1)[1], /中心線から離れた/);
});
test("slot creation preserves geometry, nine shape constraints and snap targets before committing", () => {
  const h = create(); centers(h); h.state.log.length = 0; h.command.click({ x: 40, y: 20 }, "width");
  const { points, lines, arcs, constraints } = h.state.model;
  assert.equal(points.length, 6); assert.equal(lines.length, 2); assert.equal(arcs.length, 2);
  assert.ok([...lines, ...arcs].every(item => item.construction));
  assert.equal(constraints.filter(c => c instanceof ArcEndpointCoincidentConstraint).length, 4);
  assert.equal(constraints.filter(c => c instanceof LineCircleTangentConstraint).length, 4);
  assert.equal(constraints.filter(c => c instanceof EqualRadiusConstraint).length, 1);
  assert.equal(h.state.snaps[0][1], points[0]); assert.equal(h.state.snaps[0][2], "first");
  assert.equal(h.state.snaps[1][1], points[1]); assert.equal(h.state.snaps[1][2], "second");
  assert.equal(h.state.snaps[2][1], lines[0]); assert.equal(h.state.snaps[2][2], "width");
  assert.deepEqual(h.state.log, ["preview", "capture", "clear-preview", "clear-snap", "clear-selection", ["solve", "長穴追加"]]);
});
test("failed geometry preparation restores allocations and retains input for retry", () => {
  const h = create(); centers(h); h.state.failArc = true; h.command.click({ x: 40, y: 20 });
  assert.equal(h.state.model.points.length, 0); assert.equal(h.state.model.lines.length, 0); assert.equal(h.state.sequence, 1);
  assert.ok(h.command.firstCenter && h.command.secondCenter); assert.equal(h.state.log.some(e => Array.isArray(e) && e[0] === "solve"), false);
  h.state.failArc = false; h.command.click({ x: 40, y: 20 }); assert.equal(h.state.model.points[0].id, "P1");
});
test("failed solve restores the geometry checkpoint after resetting input, then refreshes error UI", () => {
  const h = create(); centers(h); h.state.success = false; h.state.log.length = 0; h.command.click({ x: 40, y: 20 });
  assert.equal(h.state.model.points.length, 0); assert.equal(h.state.model.constraints.length, 0); assert.equal(h.state.sequence, 1);
  assert.equal(h.command.firstCenter, null); assert.equal(h.command.secondCenter, null);
  const solveIndex = h.state.log.findIndex(e => Array.isArray(e) && e[0] === "solve");
  assert.equal(h.state.log[solveIndex + 1], "restore");
  assert.deepEqual(h.state.log.slice(-2), ["ui", "draw"]);
  h.command.click({ x: 10, y: 20 }); assert.equal(h.command.firstCenter.x, 10); assert.equal(h.command.secondCenter, null);
});
test("reset cancels only private inputs and independent command instances do not share them", () => {
  const first = create(), second = create(); centers(first); first.state.log.length = 0;
  assert.equal(second.command.firstCenter, null); first.command.reset(); first.command.reset();
  assert.equal(first.command.firstCenter, null); assert.equal(first.command.secondCenter, null);
  assert.equal(first.state.log.length, 0); assert.equal(first.state.model.points.length, 0);
});
