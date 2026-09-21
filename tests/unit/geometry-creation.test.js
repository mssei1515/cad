const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/editing/geometry_ids.js', 'src/editing/geometry_creation.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
const { GeometryIds, GeometryCreation, GeometrySolver } = sandbox.window;
const { Point, Line, Arc, GeometryFixedConstraint, OffsetChainConstraint } = GeometrySolver;
const plain = value => JSON.parse(JSON.stringify(value));
const scope = () => ({ points: [], lines: [], circles: [], arcs: [], splines: [], constraints: [] });
function fixture() {
  const state = { scope: scope(), sketch: 'S1', construction: false };
  const ids = GeometryIds.create();
  const creation = GeometryCreation.create({ currentScope: () => state.scope, ids, assignSketchId: item => { item.sketchId = state.sketch; }, currentConstruction: () => state.construction, minLineLength: 1, minArcLength: 1 });
  return { state, ids, creation };
}
test('Geometry IDs isolate kinds and instances and restore only checkpointed kinds', () => {
  const ids = GeometryIds.create(), other = GeometryIds.create();
  assert.equal(ids.allocate('point'), 'P1');
  const checkpoint = ids.snapshot(['point']); ids.allocate('point'); ids.allocate('circle');
  ids.restore(checkpoint);
  assert.equal(ids.allocate('point'), 'P2'); assert.equal(ids.allocate('circle'), 'C2');
  checkpoint.pointSeq = 900; assert.equal(ids.peek('point'), 3);
  assert.equal(other.allocate('point'), 'P1');
  ids.reset(); assert.deepEqual(plain(ids.snapshot()), { pointSeq: 1, lineSeq: 1, circleSeq: 1, arcSeq: 1, splineSeq: 1 });
});
test('Geometry ID reservation accepts only local numeric IDs and never moves backwards', () => {
  const ids = GeometryIds.create();
  ids.reserve({ points: ['P9', 'BI1/P100', 'P50x', 'P-30'].map(id => ({ id })), lines: [{ id: 'L4' }], circles: [{ id: 'C7' }], arcs: [{ id: 'A2' }], splines: [{ id: 'SP8' }] });
  ids.reserve({ points: [{ id: 'P1' }] });
  assert.deepEqual(['point', 'line', 'circle', 'arc', 'spline'].map(kind => ids.allocate(kind)), ['P10', 'L5', 'C8', 'A3', 'SP9']);
  assert.equal(GeometryIds.nextSeq([{ id: 'AN6' }, { id: 'AN7x' }], 'AN'), 7);
});
test('creation resolves current scope, sketch and construction mode at each call', () => {
  const { state, creation } = fixture(); const first = state.scope;
  const p = creation.addPoint(0, 0); assert.equal(p.sketchId, 'S1');
  state.scope = scope(); state.sketch = 'S2'; state.construction = true;
  const q = creation.addPointToSketch(5, 0, 'explicit-sketch');
  assert.equal(q.sketchId, 'explicit-sketch'); assert.equal(q.kind, 'endpoint');
  const line = creation.addLine(p, q); assert.equal(line.sketchId, 'S2'); assert.equal(line.construction, true);
  assert.equal(creation.addCircle(q, 5, false).construction, false);
  assert.equal(first.points.length, 1); assert.equal(first.lines.length, 0); assert.equal(state.scope.lines[0], line);
});
test('rejected primitives preserve allocation timing including invalid spline curves', () => {
  const { creation, ids, state } = fixture(); const p = creation.addPoint(0, 0);
  assert.equal(creation.addLine(p, p), null); assert.equal(creation.addCircle(p, NaN), null);
  assert.equal(creation.addArc(p, 5, NaN, 1), null); assert.equal(creation.addSpline([p, p, p]), null);
  assert.equal(ids.peek('line'), 1); assert.equal(ids.peek('circle'), 1); assert.equal(ids.peek('arc'), 1); assert.equal(ids.peek('spline'), 1);
  assert.equal(creation.addSpline([p, creation.addPoint(0, 0), creation.addPoint(0, 0)]), null);
  assert.equal(ids.peek('spline'), 2); assert.equal(state.scope.splines.length, 0);
  assert.equal(creation.addSpline([p, creation.addPoint(10, 0), creation.addPoint(10, 10)]).id, 'SP2');
});
test('minimum line repair respects fixed endpoints and retains legacy insertion on failure', () => {
  const { creation, state } = fixture();
  const p = new Point('p', 0, 0), q = new Point('q', 0, 0);
  const line = new Line('l', p, q);
  assert.deepEqual(plain(creation.ensureLineMinimumLength(line, { x: 0, y: 2 })), { changed: true, failed: false }); assert.equal(q.y, 1);
  q.y = 0; q.fixed = true; creation.ensureLineMinimumLength(line); assert.equal(p.x, -1);
  p.x = 0; p.fixed = true;
  assert.deepEqual(plain(creation.ensureLineMinimumLength(line)), { changed: false, failed: true });
  assert.ok(creation.addLine(p, q)); assert.equal(state.scope.lines.length, 1); assert.equal(p.x, q.x);
});
test('arc minimum normalization preserves enabled endpoint, fixed and offset constraints', () => {
  const { creation, state } = fixture(); const center = new Point('p', 0, 0);
  const protectors = [arc => ({ arc, endpoint: 'start' }), arc => ({ a: arc, endpointA: 'end' }), arc => ({ b: arc, endpointB: 'start' }), arc => new GeometryFixedConstraint(arc), arc => new OffsetChainConstraint([arc], [], 2), arc => new OffsetChainConstraint([], [arc], 2)];
  for (const protect of protectors) {
    const arc = new Arc('a', center, 10, 0, 0.01); const constraint = protect(arc); state.scope = scope(); state.scope.constraints.push(constraint);
    assert.equal(creation.normalizeArcSweep(arc), false); assert.equal(arc.endAngle, 0.01);
    constraint.enabled = false; assert.equal(creation.normalizeArcSweep(arc), true); assert.equal(arc.endAngle, 0);
  }
  state.scope = scope(); const full = new Arc('full', center, 10, 0, 2 * Math.PI);
  assert.equal(creation.normalizeArcSweep(full), true); assert.equal(full.endAngle, 0);
});
test('batch minimum-shape repair uses the current scope and reports changes and failures', () => {
  const { creation, state } = fixture();
  const free = new Line('free', new Point('p1', 0, 0), new Point('p2', 0, 0));
  const fixed = new Line('fixed', new Point('p3', 0, 0, true), new Point('p4', 0, 0, true));
  state.scope.lines = [free, fixed];
  assert.deepEqual(plain(creation.enforceMinimumLineLengths()), { changed: 1, failed: 1 });
  state.scope = scope(); state.scope.arcs = [new Arc('a', new Point('p5', 0, 0), 10, 0, 0.01)];
  assert.deepEqual(plain(creation.enforceMinimumLineLengths()), { changed: 0, failed: 0 });
  assert.equal(creation.normalizeArcSweeps(), 1); assert.equal(creation.normalizeArcSweeps(), 0);
});
