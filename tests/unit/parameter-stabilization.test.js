const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: { DimensionQueries: { isReadOnlyDimension: c => Boolean(c.readOnlyDimension) } } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/parameters/stabilization.js', 'utf8'), sandbox);
function fixture() {
  const state = { namespace: { constraints: [] }, active: 'A', events: [], geometry: 0, measured: new Map(),
    evaluate: () => {}, ensure: () => {}, measure: () => new Map(state.measured),
    solve: id => ({ success: true, sketchId: id, result: { success: true, errorNorm: 0 }, dependent: { success: true, results: [{ sketchId: id + '-child' }] } }) };
  const service = sandbox.window.ParameterStabilization.create({
    namespace: {
      ensureParameterNamespace: n => { state.events.push(['ensure', n]); state.ensure(n); },
      referenceDimensionValues: n => { state.events.push(['measure', n]); return state.measure(n); },
      dimensionConstraintsInNamespace: n => n.constraints,
      evaluateParameterNamespace: (n, options) => { state.events.push(['evaluate', n, options]); state.evaluate(n, options); },
      parameterErrorText: error => error.message,
    }, currentParameterNamespace: () => state.namespace, activeSketchId: () => state.active,
    solveSketchAndDependents: (id, rollback, allowed) => { state.events.push(['solve', id, rollback, allowed]); return state.solve(id); },
    captureValues: () => { state.events.push(['capture']); return { geometry: state.geometry, targets: state.namespace.constraints.map(c => c.target) }; },
    restoreValues: snapshot => { state.events.push(['restore']); state.geometry = snapshot.geometry; state.namespace.constraints.forEach((c, i) => { c.target = snapshot.targets[i]; }); },
    maxPasses: 20, relativeTolerance: 1e-7, nonConvergenceReason: () => 'nonconvergent',
    profile: work => { state.events.push(['profile']); return work(); },
  });
  return { state, service };
}
test('unchanged targets solve requested Sketches once in order with a shared variable filter', () => {
  const { state, service } = fixture(), allowed = () => true;
  state.namespace.constraints = [{ target: 10 }];
  const result = service.stabilize(undefined, { allSketches: ['B', 'A', 'B'], variableAllowed: allowed });
  assert.equal(result.sketchId, 'B'); assert.equal(result.parameterPasses, 1);
  assert.deepEqual(state.events.filter(e => e[0] === 'solve').map(e => e[1]), ['B', 'A']);
  assert.equal(state.events.find(e => e[0] === 'solve')[3], allowed);
  assert.equal(state.events.some(e => e[0] === 'capture'), false);
  assert.deepEqual(Array.from(result.dependent.results, r => r.sketchId), ['B-child', 'A-child']);
  assert.equal(state.events.filter(e => e[0] === 'evaluate').length, 2);
  state.namespace = { constraints: [] }; state.active = 'C'; state.events.length = 0;
  assert.equal(service.stabilize().sketchId, 'C'); assert.equal(state.events[1][1], state.namespace);
});
test('changed dimensions follow common progress with bounded increments and exact final targets', () => {
  const { state, service } = fixture(), a = { target: 100 }, b = { target: 200 }, readOnly = { target: 1, readOnlyDimension: true };
  state.namespace.constraints = [a, b, readOnly];
  state.evaluate = () => { a.target = 10; b.target = 20; readOnly.target = 1000; };
  const attempts = [];
  state.solve = id => { attempts.push([a.target, b.target]); return { success: true, sketchId: id, result: { errorNorm: 0 } }; };
  const result = service.stabilize();
  assert.equal(result.success, true); assert.ok(attempts.length > 1 && attempts.length <= 128);
  let previous = 100;
  for (const [x, y] of attempts) {
    assert.ok(Math.abs(x - previous) <= 0.2 * previous + 1e-9); assert.ok(Math.abs(y - 2 * x) < 1e-9); previous = x;
  }
  assert.deepEqual(attempts.at(-1), [10, 20]); assert.equal(a.target, 10); assert.equal(b.target, 20);
  assert.equal(result.parameterPasses, 1);
});
test('failed transition restores its step snapshot and retries at half the progress', () => {
  const { state, service } = fixture(), c = { target: 100 }; state.namespace.constraints = [c]; state.geometry = 7;
  state.evaluate = () => { c.target = 50; }; const attempts = [];
  state.solve = id => {
    attempts.push(c.target);
    if (attempts.length === 1) { state.geometry = 99; return { success: false, result: { errorNorm: 1 } }; }
    if (attempts.length === 2) assert.equal(state.geometry, 7);
    return { success: true, sketchId: id, result: { errorNorm: 0 } };
  };
  assert.equal(service.stabilize().success, true);
  assert.equal(attempts[0], 80); assert.equal(attempts[1], 90);
  assert.equal(state.events.filter(e => e[0] === 'restore').length, 1); assert.equal(c.target, 50);
});
test('retry exhaustion, step exhaustion and thrown solve always restore the final requested target', () => {
  for (const mode of ['retry', 'steps', 'throw']) {
    const { state, service } = fixture(), c = { target: 1 }; state.namespace.constraints = [c];
    const final = mode === 'steps' ? 1e100 : 10; state.evaluate = () => { c.target = final; };
    let attempts = 0;
    state.solve = () => { attempts++; if (mode === 'throw') throw Error('solver exception'); return { success: mode !== 'retry', result: { errorNorm: mode === 'retry' ? 1 : 0 } }; };
    if (mode === 'throw') assert.throws(() => service.stabilize(), /solver exception/);
    else {
      const result = service.stabilize(); assert.equal(result.success, false);
      assert.equal(attempts, mode === 'retry' ? 12 : 128);
      if (mode === 'steps') assert.equal(result.result.reason, 'nonconvergent');
    }
    assert.equal(c.target, final);
  }
});
test('feedback converges using relative tolerance or returns nonconvergence at twenty passes', () => {
  for (const converges of [true, false]) {
    const { state, service } = fixture(); let measures = 0;
    state.measure = () => new Map([['reference', converges ? 10 + (++measures > 1 ? 1e-8 : 0) : ++measures]]);
    const result = service.stabilize();
    if (converges) { assert.equal(result.success, true); assert.equal(result.parameterPasses, 1); }
    else { assert.equal(result.parameterNonConvergent, true); assert.equal(result.result.reason, 'nonconvergent'); assert.equal(state.events.filter(e => e[0] === 'solve').length, 20); }
  }
});
test('namespace and measurement errors are reported while dependent failure is returned intact', () => {
  for (const phase of ['ensure', 'evaluate', 'measureAfterSolve']) {
    const { state, service } = fixture(), error = Error(phase); let measures = 0;
    if (phase === 'ensure') state.ensure = () => { throw error; };
    if (phase === 'evaluate') state.evaluate = () => { throw error; };
    if (phase === 'measureAfterSolve') state.measure = () => { if (++measures > 1) throw error; return new Map(); };
    const result = service.stabilize(); assert.equal(result.success, false); assert.equal(result.parameterError, error);
    assert.equal(result.result.reason, phase);
    if (phase === 'measureAfterSolve') assert.equal(result.dependent.results[0].sketchId, 'A-child');
  }
  const { state, service } = fixture(), failed = { success: true, result: { errorNorm: 0 }, dependent: { success: false } };
  state.solve = () => failed; assert.equal(service.stabilize(), failed);
});
