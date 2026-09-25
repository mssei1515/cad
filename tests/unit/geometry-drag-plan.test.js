const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/editing/geometry_drag_plan.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
function fixture() {
  const state = { active: 'S1', definition: { origin: { x: 1, y: 2 } }, center: { x: 3, y: 4 } };
  const plan = sandbox.window.GeometryDragPlan.create({ elementSketchId: item => item?.sketchId,
    isEditableSketchId: id => id === 'S1' || id === 'S2', activeSketchId: () => state.active,
    blockDefinitionById: () => state.definition, blockLocalGeometryBounds: () => state.center && ({ center: state.center }),
    blockInstanceEnabledSketchSet: () => new Set(['S1']), blockWorldPoint: (instance, p) => ({ x: instance.x + p.x, y: instance.y + p.y }),
    pointLockedByLineFixed: p => p.lineLocked, findLineFixedConstraint: line => line.locked,
    findArcEndpointFixedConstraint: arc => arc.endpointLocked, arcEndpointPoint: arc => ({ ...arc.endpoint }),
    arcEndpointDragValue: (_arc, _endpoint, angle) => angle, hypot2: Math.hypot, minimumLength: 0.01 });
  return { plan, state };
}
const point = (id, sketchId = 'S1') => ({ id, sketchId, x: 10, y: 20 });
test('drag plans restrict mixed selections to the chosen scope and omit fixed, locked and repeated points', () => {
  const { plan, state } = fixture(), a = point('a'), b = point('b', 'S2'), fixed = { ...point('fixed'), fixed: true }, locked = { ...point('locked'), lineLocked: true };
  const session = plan.build('selection', [a, b, a, fixed, locked], { x: 1, y: 2 });
  assert.equal(session.sketchId, 'S1'); assert.equal(session.points.length, 1); assert.equal(session.points[0].point, a);
  state.active = 'S2'; assert.equal(plan.build('selection', [a, b], { x: 0, y: 0 }).points[0].point, b);
  assert.equal(plan.build('point', fixed, {}), null); assert.equal(plan.build('selection', [fixed, locked], {}), null);
  assert.equal(plan.build('line', { p1: a, p2: b, locked: true }, {}), null);
});
test('point and spline requests remain anchored to pointer-down geometry', () => {
  const { plan } = fixture(), a = point('a'), b = point('b'); b.fixed = true;
  const session = plan.build('spline', { sketchId: 'S1', fitPoints: [a, a, b] }, { x: 1, y: 2 });
  a.x = 999; const targets = plan.points(session, { x: 4, y: 6 }); assert.equal(targets.length, 1);
  assert.deepEqual([targets[0].x, targets[0].y], [13, 24]); assert.equal(targets[0].point, a);
  const constraint = plan.pointConstraints(targets)[0]; assert.equal(constraint.point, a); assert.equal(constraint.targetX, 13);
});
test('radius requests use the starting center while center-move targets respect fixed centers', () => {
  const { plan } = fixture(), center = { x: 10, y: 20 }, item = { sketchId: 'S1', center, radius: () => 3 };
  const session = plan.build('circle', item, { x: 13, y: 20 }); center.x = 1000;
  const target = plan.radius(session, { x: 16, y: 28 })[0]; assert.equal(target.value, 10); assert.equal(target.min, 0.01);
  const parameter = plan.parameterConstraints([target])[0]; assert.equal(parameter.object, item); assert.equal(parameter.target, 10);
  assert.equal(plan.primitiveMove(session, { x: 16, y: 28 })[0].x, 13);
  center.fixed = true; assert.equal(plan.primitiveMove(session, {}).length, 0);
});
test('Block drag stores its visible center and rejects fixed or rotation-locked placement', () => {
  const { plan, state } = fixture(), instance = { sketchId: 'S1', x: 10, y: 20, rotation: 0.5 };
  const session = plan.build('block-rotation', instance, { x: 0, y: 0 });
  assert.deepEqual([session.rotationPivot.x, session.rotationPivot.y], [13, 24]); assert.equal(session.startRotation, 0.5);
  instance.rotationLocked = true; assert.equal(plan.build('block-rotation', instance, {}), null); assert.ok(plan.build('block', instance, {}));
  state.center = null; assert.equal(plan.build('block', instance, {}).localCenter, state.definition.origin);
  instance.fixed = true; assert.equal(plan.build('block', instance, {}), null);
});
test('Arc endpoint targets preserve the pointer-down endpoint and reject fixed endpoints', () => {
  const { plan } = fixture(), arc = { sketchId: 'S1', center: { x: 0, y: 0 }, endpoint: { x: 10, y: 0 } };
  const session = plan.build('arc-endpoint', { arc, endpoint: 'end' }, { x: 9, y: 0 });
  arc.endpoint.x = 20; const target = plan.arcEndpoint(session, { x: 9, y: 3 })[0];
  assert.equal(target.prop, 'endAngle'); assert.deepEqual([target.endpointPointer.x, target.endpointPointer.y], [10, 3]);
  arc.endpointLocked = true; assert.equal(plan.build('arc-endpoint', { arc, endpoint: 'end' }, {}), null);
});
