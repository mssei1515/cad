const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/instance_source_command.js'), 'utf8'), sandbox);
function fixture({ allowDeletion = true } = {}) {
  const calls = [], instance = { id: 'I1', type: 'free', sketchId: 'S1', sources: [{ id: 'A' }, { id: 'B' }], legacyOutput: 'legacy' };
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
    clearSketchSolveState: () => calls.push('clearSolve'), recordHistory: () => calls.push('history'),
  });
  command.start(instance); calls.length = 0;
  return { command, instance, model, calls };
}

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

test('committing a removed source drops only its output constraints and annotations', () => {
  const f = fixture(); f.command.toggle({ derivedInstance: f.instance, sourceElement: { id: 'A' } });
  assert.equal(f.command.finish(true), true);
  assert.deepEqual(Array.from(f.instance.sources, ref => ref.id), ['B']);
  assert.equal(Object.hasOwn(f.instance, 'legacyOutput'), false);
  assert.deepEqual(f.model.constraints.map(item => item.id), ['CB']); assert.deepEqual(f.model.annotations, []);
  assert.ok(f.calls.indexOf('clearSolve') < f.calls.indexOf('history'));
});

test('symbol deletion refusal retains the edit session and cancellation leaves document data intact', () => {
  const f = fixture({ allowDeletion: false }); f.command.toggle({ id: 'A' });
  assert.equal(f.command.finish(true), false); assert.ok(f.command.current);
  assert.deepEqual(f.instance.sources.map(ref => ref.id), ['A', 'B']); assert.equal(f.model.constraints.length, 2);
  assert.equal(f.command.finish(false), true); assert.equal(f.command.current, null);
  assert.equal(f.calls.includes('history'), false); assert.equal(f.model.annotations.length, 1);
});
