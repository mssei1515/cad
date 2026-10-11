const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/constraint_test_driver.js'), 'utf8'), sandbox);
class DistanceConstraint { constructor(p1, p2, value) { Object.assign(this, { p1, p2, value }); } }
function fixture() {
  const original = () => 'original', solver = { solveSubset: original }, calls = [], hint = { textContent: 'result', classList: { contains: value => value === 'error' } };
  const state = { scope: { constraints: [] }, commitResult: true, failure: null, result: null };
  const driver = sandbox.window.ConstraintTestDriver.createForcedCommit({
    resetModelState: () => { calls.push('reset'); state.scope = { constraints: [] }; },
    addPoint: (...args) => { calls.push(args); return { args }; }, DistanceConstraint, solver,
    commitNewConstraint: (type, constraint) => {
      calls.push(['commit', type, constraint]); state.result = solver.solveSubset();
      if (state.failure) throw state.failure;
      state.scope = { constraints: [constraint] }; return state.commitResult;
    }, currentScope: () => state.scope,
    document: { getElementById: id => { assert.equal(solver.solveSubset, original); calls.push(['dom', id]); return hint; } },
  });
  return { driver, original, solver, calls, state, hint };
}
test('forced commit preserves fixture arguments, result coercion, restores Solver before observations and reads replaced scope', () => {
  const f = fixture(); const forced = { success: 1, errorNorm: '0.25', iterations: '3', reason: 'forced' };
  const result = f.driver.commit(forced);
  assert.deepEqual(f.calls.slice(0, 3), ['reset', [0, 0, true, 'endpoint'], [10, 0, false, 'endpoint']]);
  assert.equal(f.calls[3][1], 'distance'); assert.equal(f.calls[3][2].value, 10);
  assert.deepEqual({ ...f.state.result }, { success: true, errorNorm: 0.25, iterations: 3, reason: 'forced', variableCount: 2, constraintCount: 1 });
  assert.deepEqual({ ...result }, { committed: true, constraintCount: 1, hint: 'result', hintIsError: true });
  assert.equal(f.solver.solveSubset, f.original); assert.deepEqual(forced, { success: 1, errorNorm: '0.25', iterations: '3', reason: 'forced' });
});
test('forced commit restores Solver on a thrown commit without swallowing the original error or observing DOM', () => {
  const f = fixture(); f.state.failure = new Error('commit failed');
  assert.throws(() => f.driver.commit({ success: false }), error => error === f.state.failure);
  assert.equal(f.solver.solveSubset, f.original); assert.equal(f.calls.some(call => Array.isArray(call) && call[0] === 'dom'), false);
});
test('missing forced fields keep existing coercion and only literal true means committed', () => {
  const f = fixture(); f.state.commitResult = 'accepted'; assert.equal(f.driver.commit().committed, false);
  assert.equal(f.state.result.success, false); assert.ok(Number.isNaN(f.state.result.errorNorm));
  assert.equal(f.state.result.iterations, 0); assert.equal(f.state.result.reason, 'test'); assert.equal(f.solver.solveSubset, f.original);
});
