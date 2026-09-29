const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/constraints/constraint_redundancy.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
}
const G = sandbox.window.GeometrySolver;
function fixture() {
  const state = { scope: { constraints: [], sketches: [{ id: 'root' }, { id: 'S1' }, { id: 'S2' }] }, calls: [],
    analysis: { stable: true, byConstraint: new Map() } };
  const service = sandbox.window.ConstraintRedundancy.create({ currentScope: () => state.scope,
    solver: { constraintRedundancyState: options => { state.calls.push(options); return state.analysis; } },
    sketchSolveVariables: id => [{ sketchId: id }], constraintSketchId: c => c?.sketchId || 'S1',
    constraintIsOperational: c => c.enabled !== false && !c.invalid,
    isRootSketch: sketch => sketch.id === 'root', acceptError: 0.001 });
  return { state, service };
}
test('individual checks ignore disabled, invalid and absent constraints and preserve analysis tolerances', () => {
  const { state, service } = fixture(), a = {}, disabled = { enabled: false }, invalid = { invalid: true }, other = { sketchId: 'S2' };
  state.scope.constraints = [a, disabled, invalid, other];
  for (const c of [null, disabled, invalid, {}]) assert.equal(service.redundantConstraintInfo(c).redundant, false);
  assert.equal(state.calls.length, 0);
  state.analysis.byConstraint.set(a, { redundant: true, rankBefore: 2, rankAfter: 2 });
  const result = service.redundantConstraintInfo(a);
  assert.equal(result.redundant, true); assert.equal(result.rankBefore, 2); assert.equal(result.redundancy, state.analysis);
  assert.deepEqual(Array.from(state.calls[0].constraints), [a]);
  assert.equal(state.calls[0].errorTolerance, 0.001); assert.equal(state.calls[0].rankTolerance, 1e-8);
  assert.equal(service.count, 0); // Candidate checks do not refresh display state.
  state.analysis.stable = false;
  assert.equal(service.redundantConstraintInfo(a).unstable, true);
  state.analysis.stable = true; state.analysis.byConstraint.clear();
  assert.equal(service.redundantConstraintInfo(a).unstable, true);
});
test('connected arc retains the first equivalent tangency while duplicates and unrelated contacts remain redundant', () => {
  const { state, service } = fixture();
  const p1 = new G.Point('p1', 0, 0), p2 = new G.Point('p2', 10, 0), center = new G.Point('center', 0, 5);
  const line = new G.Line('line', p1, p2), arc = new G.Arc('arc', center, 5, 0, Math.PI);
  const first = new G.LineCircleTangentConstraint(line, arc, 1), duplicate = new G.LineCircleTangentConstraint(line, arc, 1);
  const contact = new G.ArcEndpointCoincidentConstraint(arc, 'start', p1);
  state.scope.constraints = [first, duplicate, contact];
  for (const c of state.scope.constraints) state.analysis.byConstraint.set(c, { redundant: true, rankBefore: 1, rankAfter: 1 });
  assert.equal(service.redundantConstraintInfo(first).redundant, false);
  assert.equal(service.redundantConstraintInfo(duplicate).redundant, true);
  service.refreshConstraintRedundancy();
  assert.equal(service.constraintIsRedundant(first), false); assert.equal(service.constraintIsRedundant(duplicate), true);
  contact.point = center;
  assert.equal(service.redundantConstraintInfo(first).redundant, true);
  contact.point = p2; first.enabled = false;
  assert.equal(service.redundantConstraintInfo(duplicate).redundant, false);
});
test('refresh reuses per-Sketch analyses, skips root and replaces detail and count snapshots', () => {
  const { state, service } = fixture(), a = {}, b = { sketchId: 'S2' }, root = { sketchId: 'root' };
  state.scope.constraints = [a, b, root];
  state.analysis.byConstraint.set(b, { redundant: true, rankBefore: 3, rankAfter: 3 });
  const precomputed = { stable: true, byConstraint: new Map([[a, { redundant: true, rankBefore: 2, rankAfter: 2 }]]) };
  const snapshot = service.refreshConstraintRedundancy(new Map([['S1', precomputed]]));
  assert.equal(state.calls.length, 1); assert.equal(state.calls[0].variables[0].sketchId, 'S2');
  assert.equal(service.count, 2); assert.equal(service.constraintDuplicateCountForSketch('S1'), 1);
  assert.equal(service.constraintDuplicateCountForSketch('root'), 0);
  assert.equal(service.constraintRedundancyInfo(a).rankBefore, 2);
  snapshot.constraints.clear(); snapshot.sketches.clear(); snapshot.count = 0;
  assert.equal(service.constraintIsRedundant(a), true); assert.equal(service.count, 2);
  service.forgetConstraint(a);
  assert.equal(service.constraintRedundancyInfo(a), null);
  assert.equal(service.count, 2); // Existing counts are replaced by the next full refresh.
  state.scope = { constraints: [], sketches: [{ id: 'root' }, { id: 'S1' }] };
  service.refreshConstraintRedundancy();
  assert.equal(service.count, 0); assert.equal(service.constraintRedundancyInfo(b), null);
});
test('unstable or missing contributions are never presented as duplicates', () => {
  const { state, service } = fixture(), a = {};
  state.scope.constraints = [a];
  state.analysis = { stable: false, byConstraint: new Map([[a, { redundant: true }]]) };
  service.refreshConstraintRedundancy(); assert.equal(service.count, 0);
  state.analysis = { stable: true, byConstraint: new Map() };
  service.refreshConstraintRedundancy(); assert.equal(service.constraintIsRedundant(a), false);
});
