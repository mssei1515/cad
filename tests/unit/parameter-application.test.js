const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/parameters/application.js'), 'utf8'), sandbox);
function fixture({ stored = false, failure = null } = {}) {
  const scope = { parameters: [{ name: 'old', expression: '1' }] };
  const driving = { parameterName: 'oldD', expression: '1' }, measured = { parameterName: 'oldR', expression: 'preserved' };
  const session = { namespace: scope, parameters: [{ name: ' width ', expression: '12' }], dimensions: [
    { constraint: driving, name: ' d1 ', expression: '24' }, { constraint: measured, name: ' d2 ', expression: 'ignored', readOnly: true },
  ] };
  const calls = [], marker = new Error('failure');
  const application = sandbox.window.ParameterApplication.create({
    namespace: { expressionFromUserInput: value => value, ensureParameterNamespace() { calls.push('normalize'); if (failure === 'normalize') throw marker; } },
    currentScope: () => stored ? {} : scope,
    capture() { calls.push('capture'); return { parameters: scope.parameters, driving: { ...driving }, measured: { ...measured } }; },
    restore(checkpoint) { calls.push('restore'); scope.parameters = checkpoint.parameters; Object.assign(driving, checkpoint.driving); Object.assign(measured, checkpoint.measured); },
    stabilize(target) { assert.equal(target, scope); calls.push('solve'); return {
      success: failure !== 'solve', dependent: { success: failure !== 'dependent' }, result: { errorNorm: failure === 'errorNorm' ? 2 : 0 },
    }; },
    propagate(target) { assert.equal(target, scope); calls.push('propagate'); if (failure === 'propagate') throw marker; },
    acceptError: 1, applicationText: (_ja, en) => en,
  });
  const apply = () => application.apply(session, () => { calls.push('commit'); if (failure === 'commit') throw marker; });
  return { application, apply, scope, driving, measured, calls };
}
test('parameter application preserves measured expression and commits only after solve', () => {
  const f = fixture(); assert.equal(f.apply().success, true);
  assert.equal(f.scope.parameters[0].name, 'width'); assert.equal(f.driving.expression, '24');
  assert.equal(f.measured.parameterName, 'd2'); assert.equal(f.measured.expression, 'preserved');
  assert.deepEqual(f.calls, ['capture', 'normalize', 'solve', 'commit']);
});
test('stored definition propagates before commit', () => {
  const f = fixture({ stored: true }); assert.equal(f.apply().success, true);
  assert.deepEqual(f.calls, ['capture', 'normalize', 'solve', 'propagate', 'commit']);
});
for (const failure of ['normalize', 'solve', 'dependent', 'errorNorm', 'propagate', 'commit']) {
  test(`parameter application restores original values after ${failure} failure`, () => {
    const f = fixture({ stored: true, failure }), original = f.scope.parameters;
    const outcome = f.apply(); assert.equal(outcome.success, false); assert.ok(outcome.error);
    assert.equal(f.scope.parameters, original); assert.equal(f.driving.parameterName, 'oldD');
    assert.equal(f.measured.parameterName, 'oldR'); assert.equal(f.calls.at(-1), 'restore');
    if (failure !== 'commit') assert.equal(f.calls.includes('commit'), false);
  });
}
test('closed dialog does not capture or apply', () => {
  const f = fixture(); assert.equal(f.application.apply(null, () => assert.fail()).success, false);
  assert.deepEqual(f.calls, []);
});
