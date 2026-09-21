const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/editing/drawing_snap.js', 'src/editing/snap_constraints.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
const { Point, Line, Circle, Arc, Spline, CoincidentConstraint, PointOnLineConstraint, PointOnCircleConstraint, PointOnSplineConstraint, ArcEndpointArcEndpointCoincidentConstraint } = sandbox.window.GeometrySolver;
const point = (id, x, y, sketchId = 'S1') => Object.assign(new Point(id, x, y), { sketchId });
function fixture() {
  const state = { points: [], lines: [], circles: [], arcs: [], splines: [], constraints: [], references: new Set(['S2']), added: [] };
  const reads = Object.fromEntries(['Points', 'Lines', 'Circles', 'Arcs', 'Splines'].map(name => ['allGeometry' + name, () => state[name.toLowerCase()]]));
  const active = item => item.sketchId === 'S1';
  const drawing = sandbox.window.DrawingSnap.create({ geometryReads: reads, isVisibleSketchElement: item => item.visible !== false, isActiveSketchElement: active, isSplineOnlyFitPoint: p => p.fitOnly, isReferencePoint: p => p.referencePoint, isPrimitiveCenterPoint: p => [...state.circles, ...state.arcs].some(c => c.center === p), isEndpointPoint: p => p.kind === 'endpoint', isPointUsedByPrimitive: p => state.lines.some(l => l.p1 === p || l.p2 === p), isExplicitPoint: p => p.kind !== 'endpoint', sketchName: id => 'Sketch ' + id, elementSketchId: item => item.sketchId, applicationText: (ja, en) => en });
  const binding = sandbox.window.SnapConstraints.create({ isActiveSketchElement: active, elementSketchId: item => item.sketchId, isReferenceSourceSketchId: id => state.references.has(id), addPoint(x, y, fixed, kind) { const p = Object.assign(point('new' + state.points.length, x, y), { fixed, kind }); state.points.push(p); return p; }, addConstraintIfMissing(c, matches, options = {}) { if (state.constraints.some(old => old.enabled !== false && matches(old))) return false; state.constraints.push(c); state.added.push({ c, options }); return true; } });
  return { state, drawing, binding };
}
test('snap priority precedes distance, ties keep source order and misses return the input object', () => {
  const { state, drawing } = fixture(); const p = point('P1', 9, 0), same = point('P2', 9, 0); state.points = [p, same]; state.lines = [Object.assign(new Line('L1', point('', -20, 0), point('', 20, 0)), { sketchId: 'S1' })];
  const input = { x: 0, y: 0 }; const resolved = drawing.resolve(input, 10); assert.equal(resolved.x, 9); assert.equal(drawing.active.data.point, p);
  drawing.resolve(input, 8); assert.equal(drawing.active.data.line, state.lines[0]);
  drawing.clear(); assert.equal(drawing.active, null); const miss = { x: 100, y: 100 }; assert.equal(drawing.resolve(miss, 1), miss); assert.equal(drawing.active, null);
});
test('candidate reads reflect visibility, fit-point exclusions and other-sketch labels', () => {
  const { state, drawing } = fixture(); const foreign = point('foreign', 1, 0, 'S2'), hidden = point('hidden', 0, 0), fit = point('fit', 0, 0); hidden.visible = false; fit.fitOnly = true; state.points = [hidden, fit, foreign];
  const candidates = drawing.candidates({ x: 0, y: 0 }); assert.equal(candidates.length, 1); assert.equal(candidates[0].label, '点 / Sketch S2'); assert.equal(candidates[0].data.point, foreign);
  state.points = []; assert.equal(drawing.candidates({ x: 0, y: 0 }).length, 0);
});
test('arc candidates include endpoints but limit circumference projection to the signed sweep', () => {
  const { state, drawing } = fixture(); const arc = Object.assign(new Arc('A1', point('C', 0, 0), 10, 0, Math.PI / 2), { sketchId: 'S1' }); state.arcs = [arc];
  let candidates = drawing.candidates({ x: -10, y: 0 }); assert.equal(candidates.length, 3); assert.equal(candidates.filter(c => c.data.endpoint).length, 2);
  candidates = drawing.candidates({ x: 7, y: 7 }); assert.equal(candidates.length, 4); assert.equal(candidates.at(-1).data.arc, arc);
  assert.equal(sandbox.window.GeometryKernel.circlePointAtPointer({ x: 0, y: 0 }, arc), null);
});
test('open spline offers endpoints and preserves the closest-point parameter for binding', () => {
  const { state, drawing, binding } = fixture(); const points = [point('P1', 0, 0), point('P2', 10, 10), point('P3', 20, 0)]; points.forEach(p => { p.fitOnly = true; }); state.points = points;
  const spline = Object.assign(new Spline('SP1', points, false), { sketchId: 'S1' }); state.splines = [spline];
  const candidates = drawing.candidates({ x: 10, y: 10 }); assert.ok(candidates.some(c => c.label === 'Start point')); assert.ok(candidates.some(c => c.label === 'End point'));
  const snap = candidates.find(c => c.data.spline); assert.ok(Number.isFinite(snap.data.parameter)); const target = point('target', snap.x, snap.y);
  assert.equal(binding.addPointSnapConstraints(target, snap), 1); assert.ok(state.constraints[0] instanceof PointOnSplineConstraint); assert.equal(state.constraints[0].parameter, snap.data.parameter);
});
test('point snaps avoid self coincidence and suppress duplicates in either point order', () => {
  const { state, binding } = fixture(), a = point('a', 0, 0), b = point('b', 0, 0);
  assert.equal(binding.addPointSnapConstraints(a, { data: { point: a } }), 0);
  state.constraints.push(new CoincidentConstraint(b, a)); assert.equal(binding.addPointSnapConstraints(a, { data: { point: b } }), 0);
  state.constraints[0].enabled = false; assert.equal(binding.addPointSnapConstraints(a, { data: { point: b } }), 1);
});
test('reference permission is checked before boundary allocation and passed only to the reference side', () => {
  const { state, binding } = fixture(); const source = Object.assign(new Line('L1', point('a', 0, 0), point('b', 10, 0)), { sketchId: 'S3' });
  const target = Object.assign(new Circle('C1', point('c', 0, 5), 5), { sketchId: 'S1' }); const snap = { x: 0, y: 0, data: { line: source } };
  assert.equal(binding.addCircularBoundarySnapConstraints(target, snap), 0); assert.equal(state.points.length, 0);
  state.references.add('S3'); assert.equal(binding.addCircularBoundarySnapConstraints(target, snap), 2); assert.equal(state.points.length, 1);
  assert.ok(state.added[0].c instanceof PointOnLineConstraint); assert.equal(state.added[0].options.referenceSketchId, 'S3'); assert.ok(state.added[1].c instanceof PointOnCircleConstraint); assert.equal(state.added[1].options.referenceSketchId, undefined);
});
test('arc endpoint pair snaps recognize reversed duplicates and line boundary point snaps allocate no point', () => {
  const { state, binding } = fixture(); const a = Object.assign(new Arc('A1', point('c1', 0, 0), 10, 0, 1), { sketchId: 'S1' }), b = Object.assign(new Arc('A2', point('c2', 20, 0), 10, 2, 3), { sketchId: 'S1' });
  state.constraints.push(new ArcEndpointArcEndpointCoincidentConstraint(b, 'end', a, 'start'));
  assert.equal(binding.addArcEndpointSnapConstraints(a, 'start', { data: { arc: b, endpoint: 'end' } }), 0);
  const line = new Line('L1', point('p1', 0, 0), point('p2', 10, 0)), p = point('p3', 5, 0);
  assert.equal(binding.addLineBoundarySnapConstraints(line, { data: { point: p } }), 1); assert.equal(state.points.length, 0); assert.equal(state.constraints.at(-1).point, p);
});
