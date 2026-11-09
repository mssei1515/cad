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

function workspaceHistoryFixture(composed) {
  'use strict';
  const w = featureSandbox.window, events = [], error = new Error('workspace history failure');
  const state = { name: 'Current', value: 0, enabled: true, current: null, profiling: false,
    definition: { ...w.DocumentState.create(), id: 'B1', points: [{ id: 'P1', x: 0, y: 0 }] } };
  const check = name => { events.push(name); if (state.fail === name) throw error; };
  const raw = (name, work) => function (...args) { assert.equal(this, undefined); check(name); return work?.(...args); };
  const documentModel = { get documentName() { check('name'); return state.name; }, set documentName(value) { check('rename'); state.name = value; } };
  let feature, documentAdapter;
  function loadDocument(data, options) {
    assert.equal(this, documentAdapter); check('load'); assert.equal(feature.controller.restoring, true);
    assert.equal(options.documentNameFallback, 'Current'); assert.equal(options.preserveSketchTreeState, true);
    state.value = data.value; state.name = 'Loaded'; state.enabled = false;
  }
  const session = { get current() { check('current'); return state.current; },
    live: raw('live', () => state.definition),
    replaceDraft(value) { assert.equal(this, session); check('replace'); state.definition = value; } };
  const blocks = { session, editing: { clone: raw('clone', value => structuredClone(value)) } };
  const readServices = { projections: { invalidateBlockProjectionCache: raw('invalidate') } };
  const constructionCommand = { get enabled() { check('enabled'); return state.enabled; },
    restore(value) { assert.equal(this, constructionCommand); check('construction'); state.enabled = value; } };
  const presentation = { setHint: raw('hint'), log: raw('log'), profiler: {
    get active() { check('profiling'); return state.profiling; },
    work: raw('profile', (phase, work) => { assert.equal(phase, 'history'); work(); return 'profile-result'; }) } };
  const serializeDocument = raw('capture', () => ({ value: state.value, savedAt: 'clock', documentName: state.name }));
  const options = { documentWorkspace: { document: documentModel }, blocks, readServices, presentation,
    serializeDocument, loadDocument, serializeConstraint: value => value, decorateSerializedConstraint: value => value,
    constructionCommand, clearInteractionForSketchChange: raw('clear'), changed: raw('changed'), limit: 3,
    solveAndRefresh: raw('solve', () => { assert.equal(feature.controller.restoring, true); feature.controller.record('suppressed'); }) };
  const original = w.HistoryRestoration;
  w.HistoryRestoration = { create(input) { documentAdapter = input.document; return original.create(input); } };
  try {
    feature = composed ? w.HistoryController.createForWorkspace(options) : w.HistoryController.createFeature({
      serializeDocument, document: { getName: () => documentModel.documentName,
        setName: name => { documentModel.documentName = name; }, load: loadDocument },
      blockEditor: session, liveBlockDefinition: session.live, cloneBlockDefinition: blocks.editing.clone,
      serializeConstraint: options.serializeConstraint, decorateSerializedConstraint: options.decorateSerializedConstraint,
      constructionCommand, invalidateBlockProjectionCache: readServices.projections.invalidateBlockProjectionCache,
      clearInteractionForSketchChange: options.clearInteractionForSketchChange, solveAndRefresh: options.solveAndRefresh,
      changed: options.changed, limit: 3, setHint: presentation.setHint, log: presentation.log, interactionProfiler: presentation.profiler });
  } finally { w.HistoryRestoration = original; }
  assert.deepEqual(events, []);
  return { state, events, error, feature, documentModel,
    snapshot() { return JSON.parse(JSON.stringify({ events, value: state.value, name: state.name, enabled: state.enabled,
      definition: state.definition, restoring: feature.controller.restoring, documentUndo: feature.documentHistory.undoCount,
      documentRedo: feature.documentHistory.redoCount, blockUndo: state.current?.history.undoCount, blockRedo: state.current?.history.redoCount })); } };
}

test('workspace history connects cold to the same owners and preserves live name, construction preference and profile return', () => {
  const run = composed => {
    const f = workspaceHistoryFixture(composed), h = f.feature;
    assert.ok(Object.isFrozen(h)); h.documentHistory.reset(); f.state.value = 1; h.record('edit');
    assert.equal(h.controller.undo(), true); assert.equal(f.state.name, 'Current'); assert.equal(f.state.enabled, true);
    assert.equal(h.controller.redo(), true); assert.equal(f.state.value, 1);
    f.state.profiling = true; assert.equal(h.record(), 'profile-result');
    assert.equal(h.captureDocument(), '{"value":1}'); return f.snapshot();
  };
  assert.deepEqual(run(true), run(false));
});

test('workspace history retains independent block stacks and restores cloned drafts through the actual editor', () => {
  const run = composed => {
    const f = workspaceHistoryFixture(composed), h = f.feature;
    h.documentHistory.reset(); const first = h.createBlockHistory(), second = h.createBlockHistory();
    f.state.current = { history: first }; h.controller.resetBlock(); f.state.definition.points[0].x = 10; h.record();
    assert.equal(h.controller.undo(), true); assert.equal(f.state.definition.points[0].x, 0);
    assert.notEqual(f.state.definition, first.currentSnapshot.definition);
    f.state.current = { history: second }; h.controller.resetBlock(); assert.equal(first.redoCount, 1);
    f.state.current = null; assert.equal(h.controller.active(), h.documentHistory); return f.snapshot();
  };
  assert.deepEqual(run(true), run(false));
});

test('workspace history keeps callback receivers, exceptions, moved stacks and finally notifications at each restore stage', () => {
  for (const failure of ['current', 'capture', 'profiling', 'profile', 'log', 'name', 'enabled', 'load', 'rename', 'construction', 'clear', 'solve', 'hint', 'changed', 'live', 'clone', 'replace', 'invalidate']) {
    const run = composed => {
      const f = workspaceHistoryFixture(composed), h = f.feature;
      h.documentHistory.reset(); f.state.value = 1; h.record();
      const block = ['live', 'clone', 'replace', 'invalidate'].includes(failure);
      if (block) { f.state.current = { history: h.createBlockHistory() }; h.controller.resetBlock(); f.state.definition.points[0].x = 10; h.record(); }
      f.events.length = 0; f.state.fail = failure;
      const record = ['current', 'capture', 'profiling', 'profile', 'log', 'live'].includes(failure);
      if (failure === 'profile') f.state.profiling = true;
      if (failure === 'log') f.state.value = 2;
      assert.throws(() => record ? h.record() : h.controller.undo(), error => error === f.error);
      return f.snapshot();
    };
    assert.deepEqual(run(true), run(false), failure);
  }
});
