const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/editing/geometry_ids.js', 'src/editing/geometry_creation.js', 'src/geometry/centerline_geometry.js', 'src/editing/centerline_construction.js', 'src/commands/centerline_command.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
const { Point, Line, ParallelLinesCenterlineConstraint, PointPairCenterlineConstraint } = sandbox.window.GeometrySolver;
const text = (ja, en) => en;
function fixture() {
  const model = { points: [], lines: [], circles: [], arcs: [], splines: [], constraints: [] };
  const state = { success: true, snap: null, snaps: [], events: [], mode: 'centerline', selected: {}, commitInputs: null, validSketch: true };
  const ids = sandbox.window.GeometryIds.create();
  const geometry = sandbox.window.GeometryCreation.create({ currentScope: () => model, ids, assignSketchId: item => { item.sketchId = 'S1'; }, currentConstruction: () => false, minLineLength: 1, minArcLength: 1 });
  const plans = sandbox.window.CenterlineGeometry.create({ applicationText: text, parallelTolerance: 1e-5 });
  let command;
  const construction = sandbox.window.CenterlineConstruction.create({ currentScope: () => model, geometry, ids,
    addPointSnapConstraints(point, snap) { state.snaps.push([point, snap]); if (snap) model.constraints.push({ point, snap }); },
    commitNewConstraint(type, constraint) { state.events.push('commit'); state.commitInputs = { targets: command.targets, first: command.firstPoint }; model.constraints.push(constraint); if (!state.success) ids.allocate('circle'); return state.success; },
  });
  command = sandbox.window.CenterlineCommand.create({ plans, construction, selection: { set: (kind, values) => { state.selected[kind] = Array.from(values); } }, sameSketchElements: () => state.validSketch, activeSketchId: () => 'S1', isActiveSketchElement: item => item.sketchId === 'S1', applicationText: text, minLineLength: 1,
    snapForDrawing: pointer => ({ point: pointer, snap: state.snap }), clearSnap() { state.snap = null; state.events.push('clear-snap'); }, setPointerPreview: value => { state.preview = value; }, setMode: value => { state.mode = value; state.events.push('mode'); }, invalidateAnalysis: () => state.events.push('invalidate'), setHint: (message, severity) => { state.hint = [message, severity]; }, updateUI: () => state.events.push('ui'), draw: () => state.events.push('draw'),
  });
  return { model, state, ids, geometry, plans, command };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-10);
test('centerline supports handle reversed parallel directions and point-pair perpendicular projection', () => {
  const h = fixture(), p = (x, y) => new Point('', x, y), a = new Line('', p(0, 0), p(20, 0)), b = new Line('', p(20, 10), p(0, 10));
  let support = h.plans.centerlineSupportForTargets([a, b]); assert.equal(support.ok, true); near(support.anchor.y, 5);
  let projected = h.plans.projectPointToCenterlineSupport({ x: 4, y: 90 }, support); near(projected.x, 4); near(projected.y, 5);
  support = h.plans.centerlineSupportForTargets([p(0, 0), p(10, 0)]); projected = h.plans.projectPointToCenterlineSupport({ x: 90, y: 7 }, support); near(projected.x, 5); near(projected.y, 7);
  assert.equal(h.plans.centerlineSupportForTargets([a, a]).ok, false); assert.equal(h.plans.centerlineSupportForTargets([a, p(0, 0)]).ok, false);
});
test('invalid second target retains the first target and preparation rejects another sketch', () => {
  const h = fixture(), p = (x, y) => h.geometry.addPoint(x, y), a = h.geometry.addLine(p(0, 0), p(10, 0)), b = h.geometry.addLine(p(0, 10), p(10, 20));
  h.command.click({}, null, a); h.command.click({}, null, a); assert.deepEqual(Array.from(h.command.targets), [a]);
  h.command.click({}, null, b); assert.deepEqual(Array.from(h.command.targets), [a]); assert.equal(h.command.support, null);
  const copy = h.command.targets; copy.length = 0; assert.equal(h.command.targets.length, 1);
  h.state.validSketch = false; assert.equal(h.command.prepare([a, b]), false); assert.equal(h.command.targets.length, 1);
});
test('point-pair input projects endpoints, rejects short length, then commits before clearing input', () => {
  const h = fixture(), a = h.geometry.addPoint(0, 0), b = h.geometry.addPoint(10, 0); h.command.prepare([a, b]);
  h.state.snap = 'first'; h.command.click({ x: 30, y: -10 }); assert.equal(h.model.lines.length, 0); assert.equal(h.command.firstPoint.x, 5); assert.equal(Object.isFrozen(h.command.firstPoint), true);
  h.command.click({ x: 0, y: -9.8 }); assert.equal(h.model.lines.length, 0); assert.ok(h.command.firstPoint);
  h.state.snap = 'second'; h.state.events = []; h.command.click({ x: -20, y: 10 });
  const line = h.model.lines[0]; assert.equal(line.construction, true); assert.equal(line.p1.x, 5); assert.equal(line.p2.x, 5); assert.equal(h.state.snaps[0][1], 'first'); assert.equal(h.state.snaps[1][1], 'second');
  assert.ok(h.model.constraints.at(-1) instanceof PointPairCenterlineConstraint); assert.equal(h.state.commitInputs.targets.length, 2); assert.ok(h.state.commitInputs.first);
  assert.equal(h.command.targets.length, 0); assert.equal(h.command.firstPoint, null); assert.equal(h.state.mode, 'select'); assert.equal(h.state.selected.lines[0], line); assert.ok(h.state.events.indexOf('commit') < h.state.events.indexOf('mode'));
});
test('failed commit rolls back only new arrays and point/line IDs while retaining inputs for retry', () => {
  const h = fixture(), a = h.geometry.addPoint(0, 0), b = h.geometry.addPoint(10, 0); h.command.prepare([a, b]); h.state.snap = 'first'; h.command.click({ x: 5, y: -10 });
  const first = h.command.firstPoint; h.state.success = false; h.state.snap = 'second'; h.command.click({ x: 5, y: 10 });
  assert.equal(h.model.points.length, 2); assert.equal(h.model.lines.length, 0); assert.equal(h.model.constraints.length, 0); assert.equal(h.ids.peek('point'), 3); assert.equal(h.ids.peek('line'), 1); assert.equal(h.ids.peek('circle'), 2);
  assert.equal(h.command.firstPoint, first); assert.equal(h.command.targets.length, 2); assert.equal(h.state.mode, 'centerline'); assert.ok(h.state.events.includes('invalidate'));
  h.state.success = true; h.command.click({ x: 5, y: 20 }); assert.equal(h.model.lines[0].id, 'L1'); assert.equal(h.model.lines[0].p1.id, 'P3');
});
test('parallel-line creation uses its own constraint type and reset only clears input', () => {
  const h = fixture(), p = (x, y) => h.geometry.addPoint(x, y), a = h.geometry.addLine(p(0, 0), p(20, 0)), b = h.geometry.addLine(p(0, 10), p(20, 10));
  h.command.prepare([a, b]); assert.equal(Object.isFrozen(h.command.support.anchor), true); h.command.click({ x: 0, y: 90 }); h.command.click({ x: 20, y: -90 });
  assert.ok(h.model.constraints.at(-1) instanceof ParallelLinesCenterlineConstraint); assert.equal(h.model.lines[2].p1.y, 5);
  h.command.prepare([a, b]); h.command.click({ x: 0, y: 0 }); h.command.reset(); assert.equal(h.command.support, null); assert.equal(h.command.firstPoint, null); assert.equal(h.model.lines.length, 3);
});
