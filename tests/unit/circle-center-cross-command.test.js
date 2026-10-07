const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const vm = require('node:vm'); const path = require('node:path');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['geometry/geometry_kernel.js', 'geometry/spline_geometry.js', 'solver/constraint_solver.js', 'commands/circle_center_cross_command.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src', file), 'utf8'), sandbox);
const { Point, Line, Circle } = sandbox.window.GeometrySolver;
function fixture() {
  const circle = new Circle('C1', new Point('P0', 10, 20), 5); circle.sketchId = 'S1';
  const model = { points: [circle.center], lines: [], constraints: [] };
  const state = { seq: 0, mode: 'circle-center-cross', solves: 0, calls: [], result: { success: true, result: {} } };
  const selection = { circles: [], set: (kind, values) => { state.selected = values; } };
  const command = sandbox.window.CircleCenterCrossCommand.create({
    geometry: { addPoint: (x, y, fixed, kind) => { const p = new Point('P' + (++state.seq), x, y, fixed, kind); model.points.push(p); return p; }, addLine: (a, b, construction) => { const line = new Line('L' + (++state.seq), a, b, construction); model.lines.push(line); return line; }, pushModelConstraint: (c, sketchId) => { c.sketchId = sketchId; model.constraints.push(c); } },
    checkpoint: { capture: () => ({ seq: state.seq, points: model.points.length }), restore: snapshot => { state.calls.push('restore'); state.seq = snapshot.seq; model.points.length = snapshot.points; model.lines.length = 0; model.constraints.length = 0; } },
    solveSketchAndDependents: () => { state.solves++; state.calls.push('solve'); return state.result; }, resultIsAccepted: () => state.accept !== false, minOrientationLength: 0.01,
    activeSketchId: () => 'S1', isActiveSketchElement: c => c.sketchId === 'S1', selection, selectedElementCount: () => selection.circles.length,
    cancelConstraintTargetCommand() {}, cancelPendingCommand() {}, canCreateInActiveSketch: () => true, rejectRootSketchCreation() {},
    setMode: value => { state.mode = value; }, clearPreview() {}, clearSnap() {}, clearSelection() {}, invalidateAnalysis() {}, updateUI() {}, draw() {}, setHint() {}, recordHistory: () => state.calls.push('history'), applicationText: (ja, en) => en,
  }); return { circle, model, state, selection, command };
}
test('duplicate circles create one pair of constrained construction lines in one history step', () => {
  const f = fixture(); assert.equal(f.command.createCrosses([f.circle, f.circle]), true);
  assert.equal(f.model.lines.length, 2); assert.equal(f.model.points.length, 5); assert.equal(f.model.constraints.length, 8);
  assert.equal(f.model.lines.every(l => l.construction), true);
  assert.deepEqual(f.model.lines.map(l => [l.p1.x, l.p1.y, l.p2.x, l.p2.y]), [[10,15,10,25], [5,20,15,20]]);
  assert.equal(f.state.selected[0], f.model.lines[0]); assert.equal(f.state.mode, 'select');
  assert.deepEqual(f.state.calls, ['solve', 'history']);
});
test('solver, dependent solver or acceptance failure restores before solving again without history', () => {
  for (const reason of ['solve', 'dependent', 'accept']) {
    const f = fixture(); if (reason === 'solve') f.state.result.success = false;
    if (reason === 'dependent') f.state.result.dependent = { success: false };
    if (reason === 'accept') f.state.accept = false;
    assert.equal(f.command.click(f.circle), false);
    assert.equal(f.model.points[0], f.circle.center); assert.equal(f.model.points.length, 1);
    assert.equal(f.model.lines.length, 0); assert.equal(f.model.constraints.length, 0); assert.equal(f.state.seq, 0);
    assert.deepEqual(f.state.calls, ['solve', 'restore', 'solve']); assert.equal(f.state.mode, 'circle-center-cross');
  }
});
test('invalid targets never mutate, and failed preselection returns to circle input', () => {
  const f = fixture(); assert.equal(f.command.click(null), false); f.circle.sketchId = 'other'; assert.equal(f.command.click(f.circle), false);
  f.circle.sketchId = 'S1'; f.circle.radiusValue = 0; assert.equal(f.command.click(f.circle), false);
  assert.equal(f.state.seq, 0); assert.equal(f.state.solves, 0);
  f.selection.circles = [f.circle]; f.state.mode = 'select'; f.command.start(); assert.equal(f.state.mode, 'circle-center-cross');
});
