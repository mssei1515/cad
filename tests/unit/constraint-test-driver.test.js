const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/constraint_test_driver.js'), 'utf8'), sandbox);

test('analysis observation uses current scope and preserves error ranking, indices and top twelve', () => {
  const constraints = Array.from({ length: 16 }, (_, index) => ({ name: 'c' + index, error: () => index === 4 ? [4, 0] : index }));
  const variables = [{}], lines = [{}], calls = [];
  let scope = { points: [{ sketchId: 'S1' }, { sketchId: 'S2' }], lines: [], circles: [], arcs: [], splines: [] };
  const observation = sandbox.window.ConstraintTestDriver.createAnalysisObservation({
    activeSketchId: () => 'S1', currentScope: () => scope, elementSketchId: value => value.sketchId,
    sketchSolveVariables: id => { calls.push(['variables', id]); return variables; },
    sketchSolveConstraints: id => { calls.push(['constraints', id]); return constraints; },
    sketchSolveLines: id => { calls.push(['lines', id]); return lines; }, acceptError: 0.01,
    analyzeConstraintState: options => { assert.equal(options.variables, variables); assert.equal(options.constraints, constraints); assert.equal(options.lines, lines); assert.equal(options.errorTolerance, 0.01); return { stable: true, rank: 2 }; },
    vectorNorm: values => Math.hypot(...values),
  });
  const result = observation.analysis();
  assert.equal(result.pointCount, 1); assert.equal(result.constraintCount, 16); assert.equal(result.rank, 2);
  assert.deepEqual(Array.from(result.largestConstraintErrors, value => value.index), [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4]);
  assert.deepEqual(calls, [['variables', 'S1'], ['constraints', 'S1'], ['lines', 'S1']]);
  scope = { ...scope, points: [] }; assert.equal(observation.analysis().pointCount, 0);
});

test('block observation refreshes first, filters bundles and preserves identity lookup and summary copy', () => {
  const point = { id: 'P1' }, spline = { id: 'SP1' }, summary = { nested: {} }, calls = [];
  const observation = sandbox.window.ConstraintTestDriver.createBlockObservation({
    refreshConstraintAnalysis: () => { calls.push('refresh'); return { analysis: { stable: true }, summary, statuses: new Map([[point, 'fixed'], [spline, 'free']]) }; },
    blockProjectionBundles: () => { calls.push('bundles'); return [
      { instance: { id: 'BI1' }, points: [point], lines: [], circles: [], arcs: [] },
      { instance: { id: 'BI2' }, points: [], lines: [], circles: [], arcs: [], splines: [spline] },
    ]; },
  });
  const result = observation.state('BI2');
  assert.deepEqual(calls, ['refresh', 'bundles']);
  assert.deepEqual(Array.from(result.projections, value => ({ ...value })), [{ id: 'SP1', status: 'free' }]);
  assert.notEqual(result.summary, summary); assert.equal(result.summary.nested, summary.nested);
  assert.equal(observation.state().projections.length, 2);
});

test('block constraint insertion resolves original projections and observes even a refused commit in order', () => {
  const point = { localElement: { id: 'P1' } }, line = { localElement: { id: 'L1' } }, calls = [];
  class PointOnLineConstraint { constructor(p, l) { assert.equal(p, point); assert.equal(l, line); } }
  const insertion = sandbox.window.ConstraintTestDriver.createBlockConstraintInsertion({
    blockInstanceById: id => id === 'missing' ? null : { id },
    blockProjectionBundle: () => ({ points: [point], lines: [line] }), PointOnLineConstraint,
    commitNewConstraint: (type, constraint) => { assert.equal(type, 'coincident'); assert.ok(constraint instanceof PointOnLineConstraint); calls.push('commit'); return 1; },
    readAnalysis: () => { calls.push('analysis'); return {}; },
    readBlockState: id => { calls.push(['status', id]); return {}; },
    serializeModel: () => { calls.push('serialize'); return {}; },
  });
  assert.equal(insertion.add('missing', 'P1', 'BI2', 'L1').reason, 'projection-not-found'); assert.deepEqual(calls, []);
  assert.equal(insertion.add('BI1', 'P1', 'BI2', 'L1').committed, false);
  assert.deepEqual(calls, ['commit', 'analysis', ['status', 'BI1'], 'serialize']);
});
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

test('intent fixture resolves call-time geometry references and rejects missing input before calling the resolver', () => {
  const oldPoint = { id: 'P1' }, livePoint = { id: 'P1' }, arc = { id: 'A1' }, constraint = {}, normalized = [];
  let scope = { points: [oldPoint] }, calls = 0, resolution = null, serialized = 0;
  const driver = sandbox.window.ConstraintTestDriver.createIntentResolution({ currentScope: () => scope,
    makeConstraintOperand: (kind, input) => { normalized.push({ kind, input }); return { kind, input }; },
    resolveConstraintIntent: (type, operands) => { assert.equal(type, 'coincidence'); calls += 1; assert.equal(operands[0].input.point, livePoint); return resolution; },
    serializeConstraint: value => { assert.equal(value, constraint); serialized += 1; return { type: 'serialized' }; },
  });
  scope = { points: [livePoint], lines: [], splines: [], circles: [], arcs: [arc] };
  const inputs = [{ kind: 'point', id: 'P1' }, { kind: 'arc-endpoint', id: 'A1', endpoint: 'start', parameter: 0.25 }];
  assert.equal(driver.resolve('coincidence', inputs), null);
  assert.equal(serialized, 0);
  assert.equal(normalized[1].input.arc, arc);
  assert.equal(normalized[1].input.endpoint, 'start');
  assert.equal(normalized[1].input.parameter, 0.25);
  assert.throws(() => driver.resolve('coincidence', [{ kind: 'point', id: 'missing' }]), /Missing test operand: missing/);
  assert.equal(calls, 1);
  resolution = { constraint, target: { kind: 'arc-endpoint' } };
  assert.deepEqual(JSON.parse(JSON.stringify(driver.resolve('coincidence', inputs))), { action: null, error: null, constraint: { type: 'serialized' }, targetKind: 'arc-endpoint' });
  assert.equal(serialized, 1);
  assert.deepEqual(inputs, [{ kind: 'point', id: 'P1' }, { kind: 'arc-endpoint', id: 'A1', endpoint: 'start', parameter: 0.25 }]);
});


test('status observation captures the current sketch after refresh and observes replacement state on each query', () => {
  const first = { id: 'P1', sketchId: 'S1' }, second = { id: 'P2', sketchId: 'S2' };
  let active = 'S1', reads = 0, refreshed = 0;
  let analysis = { stable: true, errorNorm: 0, freeVariableCount: 2 };
  let statuses = new Map([[first, 'full'], [second, 'under']]);
  const observation = sandbox.window.ConstraintTestDriver.createStatusObservation({
    refreshConstraintAnalysis: () => { refreshed++; active = refreshed === 1 ? 'S2' : 'S1'; return { analysis, statuses }; },
    readMembership: () => { reads++; return { activeSketchId: active, elementSketchId: item => item.sketchId }; },
  });
  assert.equal(reads, 0);
  const result = observation.state();
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { stable: true, errorNorm: 0, freeDof: 2, items: [{ id: 'P2', status: 'under' }] });
  assert.equal(reads, 1); assert.equal(statuses.size, 2);
  result.items[0].status = 'changed'; assert.equal(statuses.get(second), 'under');
  analysis = { stable: false, errorNorm: 0.5, freeVariableCount: 0 };
  statuses = new Map([[first, 'conflict']]);
  const next = observation.state();
  assert.deepEqual(JSON.parse(JSON.stringify(next)), { stable: false, errorNorm: 0.5, freeDof: 0, items: [{ id: 'P1', status: 'conflict' }] });
  assert.equal(reads, 2); assert.equal(refreshed, 2);
});
