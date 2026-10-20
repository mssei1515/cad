const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/solver/constraint_solver.js', 'src/editing/workspace.js', 'src/application/editing_scope_binding.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
}
const w = sandbox.window;
function fixture(Solver = w.GeometrySolver.ConstraintSolver) {
  const document = { points: [{ id: 'P1', x: 1, y: 2 }], lines: [], constraints: [] }, workspace = w.EditingWorkspace.create(document);
  const calls = [], state = { fail: null, error: new Error('activation failed'), context: null, move: null };
  const stage = name => { calls.push({ name, bound: binding.current, workspace: workspace.current(), solver: binding.solver.model }); if (state.fail === name) throw state.error; };
  const binding = w.EditingScopeBinding.create({ workspace, Solver,
    closeSketchContext: () => { stage('close'); state.context?.close(); }, resetSketchMove: () => { stage('move'); state.move?.reset(); },
    clearGeometryReads: () => stage('reads'), invalidateProjection: () => stage('projection') });
  assert.deepEqual(calls, []);
  return { document, workspace, binding, calls, state };
}

test('binding creates one Solver for the initial scope and activates current geometry without copying models', () => {
  const f = fixture(), firstSolver = f.binding.solver;
  assert.equal(Object.isFrozen(f.binding), true); assert.equal(f.binding.current, f.document); assert.equal(firstSolver.model, f.document);
  const target = { points: [{ id: 'P2', x: 3, y: 4 }] };
  assert.equal(f.binding.activate(target), target); assert.equal(f.binding.current, target); assert.equal(f.workspace.current(), target);
  assert.equal(f.binding.solver, firstSolver); assert.equal(firstSolver.model, target);
  assert.ok(Array.isArray(target.constraints)); assert.equal(firstSolver.getVariables()[0].object, target.points[0]);
  assert.equal(f.document.points[0].id, 'P1');
  assert.deepEqual(f.calls.map(c => c.name), ['close', 'move', 'reads', 'projection']);
  assert.ok(f.calls.slice(0, 2).every(c => c.bound === f.document && c.workspace === f.document && c.solver === f.document));
  assert.ok(f.calls.slice(2).every(c => c.bound === target && c.workspace === target && c.solver === target));
});

test('Workspace restoration can precede teardown while command reads and Solver retain the previously bound draft', () => {
  const f = fixture(), host = f.workspace.capture(), draft = { points: [{ id: 'P2' }] };
  f.binding.activate(draft); const parent = f.workspace.capture(), nested = { points: [{ id: 'P3' }] }; f.binding.activate(nested);
  f.calls.length = 0;
  const restored = f.workspace.restore(parent);
  assert.equal(restored, draft); assert.equal(f.workspace.current(), draft); assert.equal(f.binding.current, nested); assert.equal(f.binding.solver.model, nested);
  assert.equal(f.binding.activate(restored), draft);
  assert.ok(f.calls.slice(0, 2).every(c => c.bound === nested && c.workspace === draft && c.solver === nested));
  assert.ok(f.calls.slice(2).every(c => c.bound === draft && c.workspace === draft && c.solver === draft));
  f.calls.length = 0; f.binding.activate(f.workspace.restore(host));
  assert.equal(f.binding.current, f.document); assert.equal(f.binding.solver.model, f.document); assert.equal(f.document.points, host.values.points);
  assert.ok(f.calls.slice(0, 2).every(c => c.bound === draft && c.workspace === f.document && c.solver === draft));
});

test('teardown, Workspace preparation, Solver assignment and cache failures keep their original partial states', () => {
  let currentFixture;
  class Solver {
    constructor(model) { this.value = model; }
    get model() { return this.value; }
    set model(value) { if (currentFixture.state.fail === 'solver') throw currentFixture.state.error; this.value = value; }
  }
  for (const fail of ['close', 'move', 'prepare', 'solver', 'reads', 'projection']) {
    const f = fixture(Solver); currentFixture = f; f.state.fail = fail; const target = { points: [{ id: 'P2' }] };
    if (fail === 'prepare') Object.defineProperty(target, 'hatches', { get() { throw f.state.error; } });
    assert.throws(() => f.binding.activate(target), error => error === f.state.error);
    const switched = ['solver', 'reads', 'projection'].includes(fail);
    assert.equal(f.binding.current, switched ? target : f.document); assert.equal(f.workspace.current(), switched ? target : f.document);
    assert.equal(f.binding.solver.model, ['reads', 'projection'].includes(fail) ? target : f.document);
    const stages = { close: ['close'], move: ['close', 'move'], prepare: ['close', 'move'], solver: ['close', 'move'],
      reads: ['close', 'move', 'reads'], projection: ['close', 'move', 'reads', 'projection'] };
    assert.deepEqual(f.calls.map(c => c.name), stages[fail]); assert.equal(f.document.points[0].id, 'P1');
  }
  const f = fixture(); assert.throws(() => f.binding.activate(null), error => error.name === 'TypeError'); assert.equal(f.binding.current, f.document);
});

test('late teardown owners are read on each activation and constructor failures do not invoke teardown or caches', () => {
  const f = fixture(), owners = [];
  f.binding.activate({});
  f.state.context = { close() { assert.equal(this, f.state.context); owners.push(['close', f.binding.current]); } };
  f.state.move = { reset() { assert.equal(this, f.state.move); owners.push(['move', f.binding.current]); } };
  const previous = f.binding.current, next = {}; f.binding.activate(next);
  assert.deepEqual(owners, [['close', previous], ['move', previous]]);
  f.state.context = null; f.state.move = null; f.binding.activate(f.document); assert.equal(owners.length, 2);
  const error = new Error('solver construction failed'), calls = [], initial = {};
  class FailingSolver { constructor(scope) { assert.equal(scope, initial); calls.push('solver'); throw error; } }
  assert.throws(() => w.EditingScopeBinding.create({ workspace: { current: () => initial }, Solver: FailingSolver,
    closeSketchContext: () => calls.push('close'), resetSketchMove: () => calls.push('move'), clearGeometryReads: () => calls.push('reads'), invalidateProjection: () => calls.push('projection') }), value => value === error);
  assert.deepEqual(calls, ['solver']);
});
