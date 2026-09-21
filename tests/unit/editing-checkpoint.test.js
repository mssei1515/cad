const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/editing/geometry_ids.js', 'src/editing/checkpoint.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
const { Point, Line, Circle, Arc, Spline, PointOnSplineConstraint } = sandbox.window.GeometrySolver;
const plain = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const points = [new Point('P1', 0, 0), new Point('P2', 10, 0), new Point('P3', 10, 10)];
  const spline = new Spline('SP1', points.slice(), false, false);
  const constraint = new PointOnSplineConstraint(points[0], spline, 0.25);
  Object.assign(constraint, { target: 5, parameterName: 'd1', expression: 'width / 2', evaluatedParameterValue: 5 });
  const model = { points, lines: [new Line('L1', points[0], points[1])], circles: [new Circle('C1', points[0], 5)], arcs: [new Arc('A1', points[1], 8, 0.2, 1.4)], splines: [spline], annotations: [{ id: 'AN1' }], blockInstances: [{ id: 'BI1', x: 4, y: 8, rotation: 0.4, fixed: true, rotationLocked: true }], geometryInstances: [{ id: 'FI1', type: 'free', x: 2, y: 3, rotation: 0.3, mirrorX: true, mirrorY: false }, { id: 'MI1', type: 'mirror', x: 90 }], constraints: [constraint], parameters: [{ name: 'width', expression: '10' }], nextDimensionParameterIndex: 2 };
  const state = { model, events: [] }, ids = sandbox.window.GeometryIds.create(); ids.reserve(model);
  const checkpoint = sandbox.window.EditingCheckpoint.create({ currentScope: () => state.model, ids, invalidateProjection: () => { state.events.push(['projection', state.model.points[0].x, state.model.constraints.length]); }, invalidateAnalysis: () => { state.events.push(['analysis', state.model.constraints.length, state.model.nextDimensionParameterIndex]); } });
  return { state, model, ids, checkpoint, constraint, spline };
}
test('value checkpoints restore geometry and placement without replacing referenced objects', () => {
  const { model, checkpoint } = fixture(); const snapshot = checkpoint.captureValues(); const p = model.points[0], circle = model.circles[0], arc = model.arcs[0];
  Object.assign(p, { x: 40, y: 50, fixed: true }); circle.radiusValue = 90; Object.assign(arc, { radiusValue: 70, startAngle: 2, endAngle: 3 });
  Object.assign(model.blockInstances[0], { x: 20, y: 30, rotation: 2, fixed: false, rotationLocked: false });
  Object.assign(model.geometryInstances[0], { x: 20, y: 30, rotation: 2, mirrorX: false, mirrorY: true }); model.geometryInstances[1].x = 100;
  checkpoint.restoreValues(snapshot);
  assert.equal(model.points[0], p); assert.deepEqual([p.x, p.y, p.fixed], [0, 0, false]); assert.equal(model.circles[0], circle); assert.equal(circle.radiusValue, 5);
  assert.equal(model.arcs[0], arc); assert.deepEqual([arc.radiusValue, arc.startAngle, arc.endAngle], [8, 0.2, 1.4]);
  assert.deepEqual(model.blockInstances[0], { id: 'BI1', x: 4, y: 8, rotation: 0.4, fixed: true, rotationLocked: true });
  assert.deepEqual(model.geometryInstances[0], { id: 'FI1', type: 'free', x: 2, y: 3, rotation: 0.3, mirrorX: true, mirrorY: false });
  assert.equal(model.geometryInstances[1].x, 100, 'derived-instance fields are outside this checkpoint');
});
test('value restoration restores constraint identity and parameters before analysis invalidation', () => {
  const { model, state, checkpoint, constraint } = fixture(); const snapshot = checkpoint.captureValues();
  Object.assign(constraint, { target: 99, parameterName: 'changed', expression: 'other', evaluatedParameterValue: 99, parameter: 0.8 });
  model.constraints.push({ target: 12 }); model.parameters[0].expression = '99'; model.nextDimensionParameterIndex = 80; model.points[0].x = 80;
  checkpoint.restoreValues(snapshot);
  assert.equal(model.constraints.length, 1); assert.equal(model.constraints[0], constraint);
  assert.deepEqual([constraint.target, constraint.parameterName, constraint.expression, constraint.evaluatedParameterValue, constraint.parameter], [5, 'd1', 'width / 2', 5, 0.25]);
  assert.deepEqual(plain(model.parameters), [{ name: 'width', expression: '10' }]); model.parameters[0].expression = '20';
  assert.equal(snapshot.parameters[0].expression, '10'); assert.deepEqual(state.events, [['projection', 0, 2], ['analysis', 1, 2]]);
});
test('geometry checkpoints restore membership, endpoint identity, spline topology and ID allocation', () => {
  const { model, checkpoint, ids, spline } = fixture(); const originalPoints = model.points.slice(), line = model.lines[0], annotation = model.annotations[0];
  const snapshot = checkpoint.captureGeometry();
  const extra = new Point(ids.allocate('point'), 90, 90); model.points.push(extra); model.lines.push(new Line(ids.allocate('line'), extra, extra));
  line.p1 = extra; line.p2 = extra; line.construction = true;
  spline.fitPoints = [extra]; spline.closed = true; spline.construction = true; spline._curveCache = { stale: true };
  model.annotations = []; model.circles = []; model.arcs = []; model.splines = [];
  checkpoint.restoreGeometry(snapshot);
  assert.deepEqual(Array.from(model.points), originalPoints); assert.equal(model.lines.length, 1); assert.equal(model.lines[0], line);
  assert.equal(line.p1, originalPoints[0]); assert.equal(line.p2, originalPoints[1]); assert.equal(line.construction, false);
  assert.equal(model.splines[0], spline); assert.deepEqual(Array.from(spline.fitPoints), originalPoints); assert.equal(spline.closed, false); assert.equal(spline.construction, false); assert.equal(spline._curveCache, null);
  assert.equal(model.annotations[0], annotation); assert.equal(model.circles.length, 1); assert.equal(model.arcs.length, 1);
  assert.equal(ids.allocate('point'), 'P4'); assert.equal(ids.allocate('line'), 'L2');
});
test('value checkpoints intentionally leave geometry membership and allocation to the operation', () => {
  const { model, checkpoint, ids } = fixture(); const snapshot = checkpoint.captureValues();
  const added = new Point(ids.allocate('point'), 20, 20); model.points.push(added);
  checkpoint.restoreValues(snapshot);
  assert.equal(model.points[3], added); assert.equal(ids.allocate('point'), 'P5');
});
test('optional legacy checkpoint fields retain prior restoration defaults', () => {
  const { model, checkpoint, constraint } = fixture(); const snapshot = checkpoint.captureValues();
  snapshot.constraints[0].expression = null; snapshot.constraints[0].splineParameter = NaN;
  delete snapshot.parameters; delete snapshot.nextDimensionParameterIndex; delete snapshot.freeInstances; delete snapshot.blockInstances;
  constraint.parameter = 0.7; checkpoint.restoreValues(snapshot);
  assert.equal(Object.hasOwn(constraint, 'expression'), false); assert.equal(constraint.parameter, 0.7); assert.equal(model.parameters.length, 0); assert.equal(model.nextDimensionParameterIndex, 1);
});
test('checkpoints read the active editing scope after a scope switch', () => {
  const first = fixture(), second = fixture(); first.state.model = second.model;
  second.model.points[0].x = 11; const snapshot = first.checkpoint.captureGeometry(); second.model.points[0].x = 100;
  first.checkpoint.restoreGeometry(snapshot);
  assert.equal(second.model.points[0].x, 11); assert.equal(first.model.points[0].x, 0); assert.equal(first.model.constraints[0], first.constraint);
});
