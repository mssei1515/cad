const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const vm = require('node:vm'); const path = require('node:path');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['history_controller.js','history_restoration.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/editing', file), 'utf8'), sandbox);
function fixture() {
  const state = { name: 'Current', construction: true, current: {}, calls: [] };
  const controller = sandbox.window.HistoryController.create({ documentHistory: {}, currentBlockHistory: () => null, changed: () => state.calls.push('changed'), log() {} });
  const restoration = sandbox.window.HistoryRestoration.create({ historyController: controller,
    document: { getName: () => state.name, setName: value => { state.name = value; }, load: (data, options) => { assert.equal(controller.restoring, true); state.loaded = data; state.options = options; state.calls.push('load'); if (state.fail) throw new Error('load failed'); state.name = 'Restored'; state.construction = false; } },
    constructionCommand: { get enabled() { return state.construction; }, restore: value => { state.construction = value; } },
    blockEditor: { get current() { return state.current; }, replaceDraft: value => { state.draft = value; state.calls.push('replace'); } },
    cloneBlockDefinition: value => JSON.parse(JSON.stringify(value)), invalidateBlockProjectionCache: () => state.calls.push('invalidate'),
    clearInteractionForSketchChange: () => state.calls.push('clear'), solveAndRefresh: label => { assert.equal(controller.restoring, true); state.calls.push('solve:' + label); }, setHint: label => state.calls.push('hint:' + label),
  }); return { state, controller, restoration };
}
test('document restoration preserves current name and authoring setting and retains tree state', () => {
  const f = fixture(); f.restoration.document('{"points":[]}', 'undo');
  assert.equal(f.state.name, 'Current'); assert.equal(f.state.construction, true);
  assert.equal(f.state.options.documentNameFallback, 'Current'); assert.equal(f.state.options.preserveSketchTreeState, true);
  assert.deepEqual(f.state.calls, ['load', 'clear', 'solve:undo', 'hint:undo', 'changed']); assert.equal(f.controller.restoring, false);
});
test('failed load releases history suppression and does not continue clearing or solving', () => {
  const f = fixture(); f.state.fail = true;
  assert.throws(() => f.restoration.document('{}', 'undo'), /load failed/);
  assert.deepEqual(f.state.calls, ['load', 'changed']); assert.equal(f.controller.restoring, false);
});
test('block restoration clones the definition, invalidates projections and rejects missing sessions', () => {
  const f = fixture(); const snapshot = { definition: { points: [{ x: 1 }] } };
  assert.equal(f.restoration.block(snapshot, 'redo'), true); assert.notEqual(f.state.draft, snapshot.definition);
  f.state.draft.points[0].x = 5; assert.equal(snapshot.definition.points[0].x, 1);
  assert.deepEqual(f.state.calls, ['replace', 'invalidate', 'clear', 'solve:redo', 'hint:redo', 'changed']);
  f.state.calls = []; f.state.current = null; assert.equal(f.restoration.block(snapshot, 'redo'), false);
  f.state.current = {}; assert.equal(f.restoration.block({}, 'redo'), false); assert.deepEqual(f.state.calls, []);
});

const featureSandbox = { window: {} }; vm.createContext(featureSandbox);
const root = path.resolve(__dirname, '../..');
const sources = vm.runInNewContext(fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), featureSandbox);
function featureFixture() {
  'use strict';
  const state = { data: { value: 0, savedAt: 'time', documentName: 'Old' }, name: 'Current', construction: true, current: null,
    definition: { id: 'B1', name: 'Block', sketches: [], activeSketchId: 'ROOT', points: [{ id: 'P1', x: 1, y: 0 }],
      lines: [], circles: [], arcs: [], splines: [], constraints: [], geometryInstances: [], blockInstances: [] }, events: [], reads: 0, profiling: false };
  const raw = (name, work) => function(...args) { assert.equal(this, undefined); state.events.push(name);
    if (state.fail === name) throw state.error; return work?.(...args); };
  let feature;
  const blockEditor = { get current() { state.reads++; return state.current; }, replaceDraft(value) { assert.equal(this, blockEditor); state.definition = value; state.events.push('replace'); } };
  const document = { getName() { assert.equal(this, document); return state.name; }, setName(value) { state.name = value; },
    load(data, options) { assert.equal(this, document); assert.equal(feature.controller.restoring, true); state.events.push('load');
      if (state.fail === 'load') throw state.error;
      assert.equal(options.documentNameFallback, 'Current'); assert.equal(options.preserveSketchTreeState, true); state.data = data; state.name = 'Loaded'; state.construction = false; } };
  const profiler = { get active() { state.reads++; return state.profiling; }, work: raw('profile', (phase, work) => {
    assert.equal(phase, 'history'); work(); return 'profile-result';
  }) };
  feature = featureSandbox.window.HistoryController.createFeature({
    serializeDocument: raw('capture', () => structuredClone(state.data)), document, blockEditor,
    liveBlockDefinition: raw('live', () => state.definition), cloneBlockDefinition: raw('clone', value => structuredClone(value)),
    serializeConstraint: value => value, decorateSerializedConstraint: value => value,
    constructionCommand: { get enabled() { state.reads++; return state.construction; }, restore(value) { state.construction = value; } },
    invalidateBlockProjectionCache: raw('invalidate'), clearInteractionForSketchChange: raw('clear'),
    solveAndRefresh: raw('solve', () => { assert.equal(feature.controller.restoring, true); feature.record('suppressed'); }), setHint: raw('hint'),
    changed: raw('changed'), log: raw('log'), limit: 3, interactionProfiler: profiler,
  });
  return { state, feature };
}

test('workspace history composes lazy independent stacks and shares live capture, restoration and profile contracts', () => {
  const { state, feature } = featureFixture();
  assert.deepEqual(state.events, []); assert.equal(state.reads, 0);
  const first = feature.createBlockHistory(), second = feature.createBlockHistory();
  assert.deepEqual(state.events, []); assert.equal(state.reads, 0);
  assert.equal(feature.controller.active(), feature.documentHistory);
  feature.documentHistory.reset(); assert.equal(feature.documentHistory.currentSnapshot, '{"value":0}');
  assert.equal(state.data.documentName, 'Old'); assert.equal(state.data.savedAt, 'time');
  state.data.value = 1; assert.equal(feature.record(), undefined); assert.equal(feature.documentHistory.undoCount, 2);
  state.data.documentName = 'Renamed'; state.data.savedAt = 'later'; feature.record(); assert.equal(feature.documentHistory.undoCount, 2);
  assert.equal(feature.documentHistory.undo(), true); assert.equal(state.name, 'Current'); assert.equal(state.construction, true);
  assert.equal(state.data.value, 0); assert.equal(feature.controller.restoring, false);
  assert.equal(feature.documentHistory.redo(), true); assert.equal(state.data.value, 1);
  state.current = { history: first }; feature.controller.resetBlock(); state.definition.points[0].x = 2; feature.record('Block edit');
  assert.equal(first.undoCount, 2); assert.equal(feature.documentHistory.undoCount, 2);
  assert.equal(feature.controller.undo(), true); assert.equal(state.definition.points[0].x, 1); assert.equal(first.redoCount, 1);
  state.current = { history: second }; feature.controller.resetBlock(); assert.equal(second.undoCount, 1); assert.equal(first.redoCount, 1);
  state.current = null; state.profiling = true; state.events.length = 0;
  assert.equal(feature.record('Profiled'), 'profile-result'); assert.deepEqual(state.events, ['profile', 'capture', 'changed']);
});

test('composed history retains moved stacks, finally notifications and short circuiting on capture, load and profile failures', () => {
  const { state, feature } = featureFixture(); feature.documentHistory.reset(); state.data.value = 1; feature.record();
  state.error = new Error('original failure'); state.events.length = 0; state.fail = 'load';
  assert.throws(() => feature.controller.undo(), error => error === state.error);
  assert.deepEqual(state.events, ['load', 'changed']); assert.equal(feature.controller.restoring, false);
  assert.equal(feature.documentHistory.undoCount, 1); assert.equal(feature.documentHistory.redoCount, 1);
  state.events.length = 0; state.fail = 'capture';
  assert.throws(() => feature.record(), error => error === state.error); assert.deepEqual(state.events, ['capture']);
  assert.equal(feature.documentHistory.undoCount, 1); assert.equal(feature.documentHistory.redoCount, 1);
  state.events.length = 0; state.profiling = true; state.fail = 'profile';
  assert.throws(() => feature.record(), error => error === state.error); assert.deepEqual(state.events, ['profile']);
  assert.equal(feature.documentHistory.undoCount, 1); assert.equal(feature.documentHistory.redoCount, 1);
});
