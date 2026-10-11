const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/constraints/dimension_queries.js', 'src/constraints/dimension_read_only_query.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
}
function fixture() {
  const events = [], candidate = {}, state = { result: { redundant: true }, active: 'active' };
  const query = sandbox.window.DimensionReadOnlyQuery.create({
    fromTarget: target => ({ constraint: target?.invalid ? null : candidate }),
    activeSketchId: () => { events.push('active'); return state.active; },
    assignSketch: (c, id) => { events.push(['assign', id]); c.sketchId = id; return c; },
    markReference: (c, source, owner) => { events.push(['reference', source, owner]); c.referenceSketchId = source; },
    probeRedundancy: (c, id) => { assert.equal(c, candidate); events.push(['probe', id]); return state.result; },
    targetItems: sandbox.window.DimensionQueries.targetItems,
  });
  return { events, candidate, state, query };
}
test('invalid construction skips ownership and redundancy; explicit measurement only assigns its owner', () => {
  const f = fixture();
  assert.equal(f.query.forPlacement({ invalid: true }, 1, {}), null); assert.deepEqual(f.events, []);
  assert.equal(f.query.forPlacement({}, 1, {}, { readOnlyDimension: true, sketchId: 'owner', referenceSketchId: 'source' }), f.candidate);
  assert.deepEqual(f.events, [['assign', 'owner']]); assert.equal(f.candidate.referenceSketchId, undefined);
});
test('only targets entirely inside one Block bypass owner assignment and numerical probing', () => {
  const f = fixture(), block = {}, a = { blockInstance: block }, b = { blockInstance: block };
  assert.equal(f.query.forPlacement({ kind: 'point-point', p1: a, p2: b }, 1, {}), f.candidate);
  assert.deepEqual(f.events, []);
  f.query.forPlacement({ kind: 'point-point', p1: a, p2: {} }, 1, {}, { sketchId: 'S' });
  assert.deepEqual(f.events, [['assign', 'S'], ['probe', 'S']]);
});
test('reference metadata precedes probing and redundant candidate retains object identity', () => {
  const f = fixture();
  assert.equal(f.query.forPlacement({ kind: 'unknown' }, 1, {}, { referenceSketchId: 'source' }), f.candidate);
  assert.deepEqual(f.events, ['active', ['assign', 'active'], ['reference', 'source', 'active'], ['probe', 'active']]);
  assert.equal(f.candidate.referenceSketchId, 'source');
});
test('unstable, nonredundant and missing contributions do not produce read-only candidates', () => {
  for (const result of [{ redundant: false }, { unstable: true }, null]) {
    const f = fixture(); f.state.result = result;
    assert.equal(f.query.forPlacement({ kind: 'unknown' }, 1, {}, { sketchId: 'S' }), null);
    assert.equal(f.candidate.sketchId, 'S');
  }
});
