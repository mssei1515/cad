const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/geometry_property_command.js'), 'utf8'), sandbox);
class LineTangent {}
class SplineTangent {}
function fixture({ allowed = true, valid = true, success = true, dependent = true } = {}) {
  const calls = [], scope = { constraints: [] }, otherPoint = { x: 5 };
  const item = { construction: false, closed: false, _curveCache: {}, curve: () => ({ valid }) };
  const command = sandbox.window.GeometryPropertyCommand.create({
    currentScope: () => scope, SplineLineTangentConstraint: LineTangent, SplineSplineTangentConstraint: SplineTangent,
    guardSketchProjectionShapeEdit: () => allowed, applicationText: (_ja, en) => en,
    synchronizeSketchProjectionMetadata: () => calls.push('sync'),
    snapshotModelState: () => { calls.push('capture'); return { closed: item.closed, x: otherPoint.x }; },
    restoreModelState: snapshot => { item.closed = snapshot.closed; otherPoint.x = snapshot.x; calls.push('restore'); },
    stabilizeActiveParameterNamespace: id => { assert.equal(id, 'S2'); otherPoint.x = 8; calls.push('solve'); return { success, dependent: { success: dependent } }; },
    elementSketchId: () => 'S2', recordHistory: () => calls.push('history'),
  });
  return { command, item, scope, calls, otherPoint };
}

test('construction rejects protected geometry before mutation and commits after metadata synchronization', () => {
  const rejected = fixture({ allowed: false });
  const result = rejected.command.setConstruction(rejected.item, true);
  assert.equal(result.success, false); assert.equal(result.checked, false); assert.equal(result.refresh, 'properties');
  assert.equal(rejected.item.construction, false); assert.deepEqual(rejected.calls, []);
  const accepted = fixture(); assert.equal(accepted.command.setConstruction(accepted.item, true).success, true);
  assert.equal(accepted.item.construction, true); assert.deepEqual(accepted.calls, ['sync', 'history']);
});

test('spline closing rejects tangent constraints and invalid curves without solving or history', () => {
  for (const tangent of [Object.assign(new LineTangent(), { spline: null }), Object.assign(new SplineTangent(), { b: null })]) {
    const f = fixture();
    if (tangent instanceof LineTangent) tangent.spline = f.item; else tangent.b = f.item;
    f.scope.constraints.push(tangent);
    const result = f.command.setSplineClosed(f.item, true);
    assert.equal(result.success, false); assert.equal(result.checked, false); assert.equal(result.refresh, undefined);
    assert.equal(f.item.closed, false); assert.deepEqual(f.calls, []);
  }
  const invalid = fixture({ valid: false });
  assert.equal(invalid.command.setSplineClosed(invalid.item, true).success, false);
  assert.equal(invalid.item.closed, false); assert.equal(invalid.item._curveCache, null);
  assert.deepEqual(invalid.calls, ['capture']);
});

test('spline closing restores the checkpoint for local or dependent solve failure and commits once on success', () => {
  for (const options of [{ success: false }, { dependent: false }, {}]) {
    const f = fixture(options), expected = options.success !== false && options.dependent !== false;
    const result = f.command.setSplineClosed(f.item, true);
    assert.equal(result.success, expected); assert.equal(result.refresh, 'all');
    assert.equal(f.item.closed, expected); assert.equal(f.otherPoint.x, expected ? 8 : 5);
    assert.deepEqual(f.calls, ['capture', 'solve', expected ? 'history' : 'restore']);
  }
});
