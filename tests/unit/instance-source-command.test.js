const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/instance_source_command.js'), 'utf8'), sandbox);
function fixture({ allowDeletion = true, activate = true, ...extra } = {}) {
  const calls = [], instance = { id: 'I1', type: 'pattern', placement: { kind: 'linear' }, sketchId: 'S1', sources: [{ id: 'A' }, { id: 'B' }], legacyOutput: 'legacy' };
  const model = { geometryInstances: [instance], constraints: [{ id: 'CA', node: { id: 'A' } }, { id: 'CB', node: { id: 'B' } }], annotations: [{ id: 'NA', source: 'A' }] };
  let mode = 'select';
  const bundle = item => ({ instance: item, valid: true, points: [], lines: item.sources.map(ref => ({ id: ref.id })), circles: [], arcs: [], splines: [] });
  const command = sandbox.window.InstanceSourceCommand.create({ currentScope: () => model, activeSketchId: () => 'S1',
    exitDrawMode() {}, cancelConstraintTargetCommand() {}, cancelPendingCommand() {}, clearSelection() {}, canvasSelection: { set() {} },
    getMode: () => mode, setMode: value => { mode = value; }, updateToolbar() {}, updateUI() {}, updatePropertiesUI() {},
    applicationText: (_ja, en) => en, setHint: () => calls.push('hint'), draw() {},
    geometryRefForItem: item => ({ id: item.id }), isVisibleSketchElement: () => true, geometryRefsEqual: (a, b) => a?.id === b?.id,
    elementSketchId: () => 'S1', geometryInstanceBundlesForScope: scope => scope.geometryInstances.map(bundle), blockProjectionBundles: () => [],
    geometryElementKey: item => item.id, geometryInstanceBundle: bundle, constraintGraphNodes: constraint => [constraint.node],
    guardDimensionSymbolDeletion: () => allowDeletion, annotationReferencesRemovedGeometry: (annotation, ids) => ids.has(annotation.source),
    clearSketchSolveState: () => calls.push('clearSolve'), recordHistory: () => calls.push('history'), ...extra,
  });
  if (activate) command.start(instance); calls.length = 0;
  return { command, instance, model, calls, mode: () => mode };
}

test('source edit entry keeps placement-free membership checks and legacy session without consulting placement guards', () => {
  const f = fixture({ activate: false, guardSketchEdit() { throw new Error('unexpected guard'); } });
  delete f.instance.placement;
  assert.equal(f.command.startForInstance({ ...f.instance }), false); assert.equal(f.command.current, null);
  assert.equal(f.command.startForInstance(f.instance), undefined); assert.equal(f.command.instance, f.instance);
  assert.equal(f.mode(), 'instance-sources'); assert.deepEqual(Array.from(f.command.current.sources), f.instance.sources);
  assert.equal(f.command.finish(false), true); assert.equal(f.command.current, null); assert.equal(f.calls.includes('history'), false);
});

test('placed source editing reads current sketch before the guard and delegates the original instance without changing legacy state', () => {
  const calls = [], state = { active: 'S2', allowed: false, fail: null }, marker = new Error('start failed'), result = Symbol('result');
  const placementCommand = { startEdit(instance, key) { assert.equal(this, placementCommand); calls.push(['start', instance, key]); if (state.fail === 'start') throw marker; return result; } };
  const f = fixture({ activate: false, placementCommand,
    activeSketchId: () => { calls.push(['active']); return state.active; },
    guardSketchEdit: function(id, operation) { 'use strict'; assert.equal(this, undefined); calls.push(['guard', id, operation]); if (state.fail === 'guard') throw marker; return state.allowed; } });
  const before = JSON.stringify(f.model);
  assert.equal(f.command.startForInstance(f.instance), false); assert.deepEqual(calls, [['active']]);
  calls.length = 0; state.active = 'S1'; assert.equal(f.command.startForInstance(f.instance), false);
  assert.deepEqual(calls, [['active'], ['guard', 'S1', 'structure']]); assert.equal(JSON.stringify(f.model), before); assert.equal(f.mode(), 'select');
  calls.length = 0; state.allowed = true; assert.equal(f.command.startForInstance(f.instance), result);
  assert.deepEqual(calls, [['active'], ['guard', 'S1', 'structure'], ['start', f.instance, 'sources']]); assert.equal(f.command.current, null); assert.deepEqual(f.calls, []);
  calls.length = 0; const draft = { ...f.instance }; assert.equal(f.model.geometryInstances.includes(draft), false);
  assert.equal(f.command.startForInstance(draft), result); assert.equal(calls.at(-1)[1], draft);
  for (const failure of ['guard', 'start']) { calls.length = 0; state.fail = failure; assert.throws(() => f.command.startForInstance(f.instance), error => error === marker); assert.equal(f.command.current, null); }
  assert.equal(JSON.stringify(f.model), before);
});

test('bulk source addition maps own outputs to sources and keeps retained entries', () => {
  const f = fixture();
  const source = { id: 'C' };
  f.command.addSources([{ id: 'A' }, { id: 'I1@C', derivedInstance: f.instance, sourceElement: source }]);
  assert.deepEqual(Array.from(f.command.current.sources, ref => ref.id), ['A', 'B', 'C']);
  f.command.addSources([{ id: 'C' }]);
  assert.equal(f.command.current.sources.length, 3);
});

test('source edits keep retained order and legacy output identity even after removing and readding the first source', () => {
  const f = fixture();
  f.command.toggle({ id: 'A' }); f.command.toggle({ id: 'C' }); f.command.toggle({ id: 'A' });
  f.command.current.sources.pop(); // Display snapshots cannot change the candidate list.
  assert.equal(f.command.current.sources.length, 3);
  assert.deepEqual(f.instance.sources.map(ref => ref.id), ['A', 'B']);
  assert.equal(f.command.finish(true), true);
  assert.deepEqual(Array.from(f.instance.sources, ref => ref.id), ['A', 'B', 'C']);
  assert.equal(f.instance.legacyOutput, 'legacy'); assert.equal(f.command.current, null);
  assert.equal(f.calls.filter(call => call === 'history').length, 1);
});

test('removing a referenced unified source is rejected without dropping constraints or annotations', () => {
  const f = fixture(); f.command.toggle({ derivedInstance: f.instance, sourceElement: { id: 'A' } });
  assert.equal(f.command.finish(true), false);
  assert.deepEqual(Array.from(f.instance.sources, ref => ref.id), ['A', 'B']);
  assert.equal(f.model.constraints.length, 2); assert.equal(f.model.annotations.length, 1); assert.equal(f.calls.includes('history'), false);
});

test('symbol deletion refusal retains the edit session and cancellation leaves document data intact', () => {
  const f = fixture({ allowDeletion: false }); f.command.toggle({ id: 'A' });
  assert.equal(f.command.finish(true), false); assert.ok(f.command.current);
  assert.deepEqual(f.instance.sources.map(ref => ref.id), ['A', 'B']); assert.equal(f.model.constraints.length, 2);
  assert.equal(f.command.finish(false), true); assert.equal(f.command.current, null);
  assert.equal(f.calls.includes('history'), false); assert.equal(f.model.annotations.length, 1);
});
