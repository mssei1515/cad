const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/editing/geometry_ids.js', 'src/editing/geometry_creation.js', 'src/editing/checkpoint.js', 'src/geometry/fillet_geometry.js', 'src/editing/fillet_construction.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
const { Point, Line, RadiusConstraint, ArcEndpointCoincidentConstraint, PointOnLineConstraint, LineCircleTangentConstraint } = sandbox.window.GeometrySolver;
function fixture() {
  const scope = { points: [], lines: [], circles: [], arcs: [], splines: [], annotations: [], constraints: [], blockInstances: [], geometryInstances: [], parameters: [], nextDimensionParameterIndex: 1 };
  const ids = sandbox.window.GeometryIds.create(), events = [];
  const geometry = sandbox.window.GeometryCreation.create({ currentScope: () => scope, ids, assignSketchId: item => { item.sketchId = 'S1'; }, currentConstruction: () => true, minLineLength: 1, minArcLength: 1 });
  const corner = geometry.addPoint(0, 0), line1 = geometry.addLine(corner, geometry.addPoint(30, 0)), line2 = geometry.addLine(geometry.addPoint(0, 30), corner);
  const plans = sandbox.window.FilletGeometry.create({ minLineLength: 1 });
  const make = supplied => sandbox.window.FilletConstruction.create({ plans, geometry: supplied || geometry,
    defaultDimensionForTarget(target) { events.push('dimension'); return { kind: target.kind, labelX: 9 }; },
    syncLineOrientationHints() { events.push('orientation'); assert.notEqual(line1.p1, corner); assert.notEqual(line2.p2, corner); assert.equal(scope.constraints.length, 0); },
    pushModelConstraint(c) { events.push('constraint'); c.sketchId = 'S1'; scope.constraints.push(c); },
  });
  return { scope, ids, events, geometry, corner, line1, line2, plans, make };
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
test('fillet plans preserve inputs and produce tangent points for reversed endpoint order', () => {
  const h = fixture(), before = JSON.stringify(h.scope), plan = h.plans.computeFilletGeometry(h.line1, h.line2, 5);
  assert.equal(plan.ok, true); assert.equal(plan.corner, h.corner); near(plan.t1.x, 5); near(plan.t1.y, 0); near(plan.t2.x, 0); near(plan.t2.y, 5); near(plan.center.x, 5); near(plan.center.y, 5);
  near(Math.abs(plan.endAngle - plan.startAngle), Math.PI / 2); assert.equal(JSON.stringify(h.scope), before);
});
test('fillet plans require shared Point identity, usable line length and a non-straight corner', () => {
  const h = fixture();
  assert.equal(h.plans.filletGeometryBasis(h.line1, new Line('other', new Point('same-position', 0, 0), new Point('p', 0, 30))).ok, false);
  assert.equal(h.plans.filletGeometryBasis(h.line1, new Line('short', h.corner, new Point('p', 0, 0.5))).ok, false);
  assert.equal(h.plans.filletGeometryBasis(h.line1, new Line('straight', h.corner, new Point('p', -30, 0))).ok, false);
  assert.equal(h.plans.computeFilletGeometry(h.line1, h.line2, NaN).ok, false); assert.equal(h.plans.computeFilletGeometry(h.line1, h.line2, 0).ok, false);
});
test('pointer radius clamps below the maximum while direct overlarge radius is rejected', () => {
  const h = fixture(), basis = h.plans.filletGeometryBasis(h.line1, h.line2);
  assert.equal(h.plans.computeFilletGeometry(h.line1, h.line2, basis.maximumRadius * 2).ok, false);
  const plan = h.plans.filletGeometryFromPointer(h.line1, h.line2, { x: 100, y: 0 });
  assert.equal(plan.ok, true); assert.equal(plan.requestedRadius, 100); near(plan.radius, basis.maximumRadius * (1 - 1e-6));
  assert.equal(h.plans.filletGeometryFromPointer(h.line1, h.line2, null).ok, false);
});
test('fillet creation replaces shared endpoints and inserts seven constraints after orientation synchronization', () => {
  const h = fixture(), result = h.make().createFillet(h.line1, h.line2, 5);
  assert.equal(result.ok, true); assert.equal(h.scope.points.length, 6); assert.equal(h.scope.arcs[0], result.arc); assert.equal(result.arc.construction, false);
  assert.ok(h.scope.points.includes(h.corner)); assert.notEqual(h.line1.p1, h.corner); assert.notEqual(h.line2.p2, h.corner);
  assert.deepEqual(h.scope.constraints.map(c => c.constructor), [ArcEndpointCoincidentConstraint, ArcEndpointCoincidentConstraint, PointOnLineConstraint, PointOnLineConstraint, LineCircleTangentConstraint, LineCircleTangentConstraint, RadiusConstraint]);
  assert.equal(h.scope.constraints[0].point, h.line1.p1); assert.equal(h.scope.constraints[1].point, h.line2.p2); assert.equal(h.scope.constraints[2].point, h.corner);
  assert.equal(h.scope.constraints[6].target, 5); assert.equal(h.scope.constraints[6].dimension.labelX, 9); assert.ok(h.scope.constraints.every(c => c.sketchId === 'S1'));
  assert.deepEqual(h.events, ['dimension', 'orientation', ...Array(7).fill('constraint')]);
});
test('invalid plans do not allocate and failed arc insertion remains recoverable by the operation checkpoint', () => {
  const h = fixture(), initial = JSON.stringify(h.ids.snapshot());
  assert.equal(h.make().createFillet(h.line1, h.line2, NaN).ok, false); assert.equal(h.scope.points.length, 3); assert.equal(JSON.stringify(h.ids.snapshot()), initial);
  const checkpoints = sandbox.window.EditingCheckpoint.create({ currentScope: () => h.scope, ids: h.ids, invalidateProjection() {}, invalidateAnalysis() {} });
  const checkpoint = checkpoints.captureGeometry();
  const failed = h.make({ ...h.geometry, addArc: () => null }).createFillet(h.line1, h.line2, 5);
  assert.equal(failed.ok, false); assert.equal(h.scope.constraints.length, 0); assert.equal(h.scope.points.length, 6);
  checkpoints.restoreGeometry(checkpoint);
  assert.equal(h.scope.points.length, 3); assert.equal(h.line1.p1, h.corner); assert.equal(h.line2.p2, h.corner); assert.equal(JSON.stringify(h.ids.snapshot()), initial);
});
