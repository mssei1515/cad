const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {}, structuredClone };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/document_test_driver.js'), 'utf8'), sandbox);
const plain = value => JSON.parse(JSON.stringify(value));

test('file fixture awaits import before observing the current names, title and elapsed time, including refusal', async () => {
  for (const success of [true, false]) {
    let finish, observed = 0, now = 10, name = 'before';
    const document = { title: 'before' }, data = { text: '日本語', constraints: [] };
    const fixture = sandbox.window.DocumentTestDriver.createImport({
      performance: { now: () => now },
      File: class { constructor(parts, fileName, options) { assert.deepEqual(plain(parts), [JSON.stringify(data)]); assert.equal(fileName, 'fixture.jot2d'); assert.deepEqual(plain(options), { type: 'application/json' }); } },
      importFileData: () => new Promise(resolve => { finish = resolve; }),
      readDocumentName: () => { observed += 1; return name; },
      effectiveDocumentName: () => name + ' display', serializeModel: () => ({ documentName: name + ' saved' }), document,
    });
    const pending = fixture.importName(data, 'fixture.jot2d');
    assert.equal(observed, 0);
    now = 35; name = 'after'; document.title = 'after title'; finish(success);
    assert.deepEqual(plain(await pending), { success, elapsedMs: 25, modelName: 'after', displayName: 'after display', serializedName: 'after saved', title: 'after title' });
  }
});

test('file fixture propagates import rejection and does not observe names afterward', async () => {
  const failure = new Error('import failed');
  const fixture = sandbox.window.DocumentTestDriver.createImport({ performance: { now: () => 0 }, File: class {},
    importFileData: async () => { throw failure; }, readDocumentName: () => { throw new Error('unexpected observation'); },
  });
  await assert.rejects(fixture.importName({}, 'bad.jot2d'), error => error === failure);
});

test('direct load clones fixture data, optionally resets history, and reads the scope after application and display', () => {
  for (const resetLoadedHistory of [false, true]) {
    const data = { constraints: [1] }, calls = []; let scope = { constraints: [] };
    const fixture = sandbox.window.DocumentTestDriver.createLoad({
      fileNameStem: name => { assert.equal(name, 'drag-fixture.json'); return 'drag-fixture'; },
      loadModelData: (loaded, options) => { assert.notEqual(loaded, data); assert.deepEqual(loaded, data); assert.deepEqual(plain(options), { documentNameOverride: 'drag-fixture' }); loaded.constraints.push(2); scope = loaded; calls.push('load'); },
      resetHistory: name => { assert.equal(name, 'fixture load'); calls.push('history'); },
      updateUI: () => calls.push('ui'), draw: () => calls.push('draw'), currentScope: () => { calls.push('scope'); return scope; },
    });
    assert.deepEqual(plain(fixture.load(data, undefined, { resetLoadedHistory })), { success: true, constraintCount: 2 });
    assert.deepEqual(data, { constraints: [1] });
    assert.deepEqual(calls, resetLoadedHistory ? ['load', 'history', 'ui', 'draw', 'scope'] : ['load', 'ui', 'draw', 'scope']);
  }
});

test('direct load retains the existing failure boundary around application, history and display updates', () => {
  for (const failureAt of ['load', 'history', 'ui', 'draw']) {
    const calls = [], step = name => { calls.push(name); if (name === failureAt) throw new Error(name + ' failed'); };
    const fixture = sandbox.window.DocumentTestDriver.createLoad({ fileNameStem: () => 'fixture',
      loadModelData: () => step('load'), resetHistory: () => step('history'), updateUI: () => step('ui'), draw: () => step('draw'),
      currentScope: () => { throw new Error('unexpected success observation'); },
    });
    assert.deepEqual(plain(fixture.load({}, 'fixture.json', { resetLoadedHistory: true })), { success: false, error: failureAt + ' failed' });
    assert.deepEqual(calls, ['load', 'history', 'ui', 'draw'].slice(0, ['load', 'history', 'ui', 'draw'].indexOf(failureAt) + 1));
  }
});

vm.runInContext(fs.readFileSync('src/persistence/document_files.js', 'utf8'), sandbox);
function fileApiFixture(composed) {
  const calls = [], state = { ready: false, time: 10, model: { documentName: 'Before', constraints: [{ id: 'C1' }] },
    loadFailure: null, serializeFailure: null, importFailure: null, importGate: Promise.resolve() };
  const document = { title: 'Before | Jot2D' }, files = sandbox.window.DocumentFiles.create();
  const read = name => { assert.equal(state.ready, true); calls.push(name); };
  const inputs = { performance: { now: () => { read('clock'); return state.time; } },
    File, document, fileSession: files,
    readDocumentName: () => { read('name'); return state.model.documentName; },
    effectiveDocumentName: () => { read('display'); return sandbox.window.DocumentFiles.effectiveDocumentNameFromValue(state.model.documentName); },
    serializeModel: () => { read('serialize'); if (state.serializeFailure) throw state.serializeFailure; return state.model; },
    importFileData: async file => {
      read('import'); assert.equal(file instanceof File, true); assert.equal(file.type, 'application/json');
      const loaded = JSON.parse(await file.text()); await state.importGate;
      if (state.importFailure) throw state.importFailure;
      state.model = loaded; document.title = loaded.documentName + ' | Jot2D'; files.setHandle({ name: file.name }); return true;
    },
    loadModelData: (loaded, options) => { read('load'); if (state.loadFailure) throw state.loadFailure;
      loaded.documentName = options.documentNameOverride; state.model = loaded; document.title = loaded.documentName + ' | Jot2D'; },
    fileNameStem: sandbox.window.DocumentFiles.fileNameStem,
    resetHistory: label => { read('history'); assert.equal(label, 'fixture load'); }, updateUI: () => read('ui'), draw: () => read('draw'),
    currentScope: () => { read('scope'); return state.model; },
  };
  const support = composed ? sandbox.window.DocumentTestDriver.createForWorkspace({
    documentWorkspace: { document: { get documentName() { return inputs.readDocumentName(); } }, workspace: { current: inputs.currentScope } },
    geometry: {}, presentation: { updateUI: inputs.updateUI, draw: inputs.draw }, document,
    history: { controller: { resetDocument: inputs.resetHistory } }, blocks: { session: {} }, constructionCommand: {},
    files: { effectiveDocumentName: inputs.effectiveDocumentName, importFileData: inputs.importFileData }, fileSession: files,
  }) : null;
  const api = support ? support.createFileApi({ performance: inputs.performance, File, serializeModel: inputs.serializeModel, loadModelData: inputs.loadModelData }) :
    sandbox.window.DocumentTestDriver.createFileApi(inputs);
  return { api, state, calls, files, document };
}

test('file browser API shares live document readers across cloned snapshots, load and awaited import without eager access', async () => {
  const f = fileApiFixture(); assert.deepEqual(f.calls, []);
  assert.equal(Object.isFrozen(f.api), true); assert.equal(Object.isFrozen(f.api.observations), true); assert.equal(Object.isFrozen(f.api.fixtures), true);
  assert.deepEqual(Object.keys(f.api.observations), ['documentNameState','fileSystemAccessStateForTest','serializedModelForTest']);
  assert.deepEqual(Object.keys(f.api.fixtures), ['importDocumentNameFixture','loadDocumentFixtureForDragTest']);
  f.state.ready = true; const copied = f.api.observations.serializedModelForTest(); copied.constraints[0].id = 'changed';
  assert.equal(f.state.model.constraints[0].id, 'C1'); assert.notEqual(copied.constraints, f.state.model.constraints);
  f.files.setHandle({ name: 'first.jot2d' }); assert.deepEqual(plain(f.api.observations.fileSystemAccessStateForTest()), { hasHandle: true, handleName: 'first.jot2d' });
  const fixture = { documentName: 'fixture', constraints: [{ id: 'C2' }] }; f.calls.length = 0;
  assert.deepEqual(plain(f.api.fixtures.loadDocumentFixtureForDragTest(fixture, 'new.name.jot2d', { resetLoadedHistory: true })), { success: true, constraintCount: 1 });
  assert.deepEqual(f.calls, ['load','history','ui','draw','scope']); assert.equal(fixture.documentName, 'fixture'); assert.notEqual(f.state.model, fixture);
  assert.deepEqual(plain(f.api.observations.documentNameState()), { modelName: 'new.name', displayName: 'new.name', serializedName: 'new.name', title: 'new.name | Jot2D' });
  let finish; f.state.importGate = new Promise(resolve => { finish = resolve; }); f.calls.length = 0;
  const imported = { documentName: 'Imported', constraints: [] }, pending = f.api.fixtures.importDocumentNameFixture(imported, 'imported.jot2d');
  assert.equal(f.calls.includes('name'), false); assert.equal(f.state.model.documentName, 'new.name'); f.state.time = 35; finish();
  assert.deepEqual(plain(await pending), { success: true, elapsedMs: 25, modelName: 'Imported', displayName: 'Imported', serializedName: 'Imported', title: 'Imported | Jot2D' });
  assert.deepEqual(plain(f.api.observations.fileSystemAccessStateForTest()), { hasHandle: true, handleName: 'imported.jot2d' });
  assert.equal(f.api.observations.serializedModelForTest().documentName, 'Imported'); assert.deepEqual(imported, { documentName: 'Imported', constraints: [] });
});

test('file browser API preserves load failures and import or serialization rejection boundaries without model mutation', async () => {
  const f = fileApiFixture(); f.state.ready = true; const original = f.state.model, constraints = original.constraints;
  const failure = new Error('file API failure'); f.state.loadFailure = failure;
  assert.deepEqual(plain(f.api.fixtures.loadDocumentFixtureForDragTest({ constraints: [] })), { success: false, error: 'file API failure' });
  assert.deepEqual(f.calls, ['load']); assert.equal(f.state.model, original); assert.equal(f.state.model.constraints, constraints);
  f.calls.length = 0; f.state.serializeFailure = failure;
  assert.throws(() => f.api.observations.serializedModelForTest(), error => error === failure); assert.deepEqual(f.calls, ['serialize']);
  f.calls.length = 0; f.state.importFailure = failure;
  await assert.rejects(f.api.fixtures.importDocumentNameFixture({ documentName: 'Failed' }, 'failed.jot2d'), error => error === failure);
  assert.deepEqual(f.calls, ['clock','import']); assert.equal(f.state.model, original); assert.equal(f.state.model.constraints, constraints);
  assert.equal(f.files.handle, null); assert.equal(f.document.title, 'Before | Jot2D');
});

test('Document workspace file API keeps ordered public entries, live names, cloning, async import and failure boundaries', async () => {
  const run = async composed => {
    const f = fileApiFixture(composed); assert.deepEqual(f.calls, []); f.state.ready = true;
    const keys = [Object.keys(f.api.observations), Object.keys(f.api.fixtures)];
    const input = { constraints: [{ id: 'C2' }] };
    const loaded = f.api.fixtures.loadDocumentFixtureForDragTest(input, 'new.jot2d', { resetLoadedHistory: true });
    assert.equal(loaded.success, true); assert.equal(input.constraints[0].id, 'C2'); assert.notEqual(f.state.model, input);
    const copy = f.api.observations.serializedModelForTest(); copy.constraints.length = 0; assert.equal(f.state.model.constraints.length, 1);
    let finish; f.state.importGate = new Promise(resolve => { finish = resolve; });
    const pending = f.api.fixtures.importDocumentNameFixture({ documentName: 'Imported', constraints: [] }, 'imported.jot2d');
    assert.equal(f.state.model.documentName, 'new'); f.state.time = 35; finish(); const imported = await pending;
    const names = f.api.observations.documentNameState(), file = f.api.observations.fileSystemAccessStateForTest();
    const marker = new Error('original file error'); f.state.loadFailure = marker;
    const failure = f.api.fixtures.loadDocumentFixtureForDragTest({ constraints: [] });
    f.state.serializeFailure = marker; assert.throws(() => f.api.observations.serializedModelForTest(), error => error === marker);
    f.state.importFailure = marker; await assert.rejects(f.api.fixtures.importDocumentNameFixture({}, 'bad.jot2d'), error => error === marker);
    return plain({ keys, loaded, imported, names, file, failure, calls: f.calls, model: f.state.model, title: f.document.title });
  };
  assert.deepEqual(await run(true), await run(false));
});

const workspaceSandbox = { window: {}, structuredClone }; vm.createContext(workspaceSandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(p => p.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), workspaceSandbox, { filename: file });
function workspaceFixture(composed, failure) {
  'use strict';
  const w = workspaceSandbox.window, events = [], marker = new Error('Document support failure');
  const state = { scope: w.DocumentState.create(), history: { undoCount: 2, redoCount: 1 }, editor: null, enabled: false, disabled: true, ready: false };
  const check = name => { assert.equal(state.ready, true); events.push(name); if (failure === name) throw marker; };
  const raw = (name, work) => function (...args) { assert.equal(this, undefined); check(name); return work?.(...args); };
  const current = raw('scope', () => state.scope), ids = w.GeometryIds.create();
  const sketches = w.SketchContext.create({ currentScope: current, constraintGraphNodes: () => [] });
  const geometry = w.GeometryCreation.create({ currentScope: current, ids, assignSketchId: sketches.assignSketchId,
    currentConstruction: () => false, minLineLength: .01, minArcLength: .01 });
  const documentWorkspace = { document: {}, workspace: { current }, sketches };
  const history = { controller: { active: raw('history', () => state.history) } };
  const blocks = { session: { get current() { check('editor'); return state.editor; } } };
  const constructionCommand = { get enabled() { check('construction'); return state.enabled; } };
  const document = { getElementById(id) { assert.equal(this, document); check('dom');
    return id === 'toolConstructionLine' ? { classList: { contains: () => state.enabled } } : { disabled: state.disabled }; },
    querySelectorAll() { assert.equal(this, document); check('badges'); return [1, 2]; } };
  const presentation = { updateUI: raw('ui'), draw: raw('draw') };
  const support = composed ? w.DocumentTestDriver.createForWorkspace({ documentWorkspace, geometry, presentation, document, history, blocks, constructionCommand }) : null;
  const observation = support ? support.history : w.DocumentTestDriver.createHistoryObservation({ activeEditHistory: history.controller.active, blockEditor: blocks.session, document, constructionCommand });
  const resetModelState = raw('reset', () => { state.scope = w.DocumentState.create(); ids.reset(); });
  const deleteSketch = raw('delete', (id, confirm) => { assert.equal(confirm, false); return id === 'S2' ? false : 'deleted:' + id; });
  const deletion = support ? support.createSketchDeletion({ resetModelState, deleteSketch }) : w.DocumentTestDriver.createSketchDeletionFixture({
    resetModelState, currentScope: current, rootSketchId: w.SketchHierarchy.ROOT_SKETCH_ID,
    addPoint: geometry.addPoint, addLine: geometry.addLine, addCircle: geometry.addCircle, geometryRefForItem: w.GeometryObjects.geometryRefForItem, deleteSketch });
  const markReferenceConstraint = raw('mark', (constraint, source, target) => Object.assign(constraint, { source, target }));
  const serializeModel = raw('serialize', () => structuredClone(state.scope)), loadModelData = raw('load', data => { state.scope = data; });
  const analysis = { refresh(options) { assert.equal(this, analysis); assert.deepEqual(plain(options), {}); check('analysis'); } };
  const referenceState = { constraintIsOperational: raw('operational', () => false), errorReasons() { assert.equal(this, referenceState); check('errors'); return ['cyclic']; } };
  const cyclic = support ? support.createCyclicReference({ resetModelState, markReferenceConstraint, serializeModel, loadModelData, analysis, referenceState }) :
    w.DocumentTestDriver.createCyclicReferenceFixture({ resetModelState, currentScope: current, rootSketchId: w.SketchHierarchy.ROOT_SKETCH_ID,
      defaultSketchId: w.SketchHierarchy.DEFAULT_SKETCH_ID, addPoint: geometry.addPoint, markReferenceConstraint, CoincidentConstraint: w.GeometrySolver.CoincidentConstraint,
      serializeModel, loadModelData, refreshConstraintAnalysis: (options = {}) => analysis.refresh(options), updateUI: presentation.updateUI,
      constraintIsOperational: referenceState.constraintIsOperational, readReferenceErrors: () => referenceState.errorReasons(), document });
  assert.deepEqual(events, []);
  return { state, events, marker, observation, deletion, cyclic, geometry,
    options: { documentWorkspace, geometry, presentation, document, history, blocks, constructionCommand },
    caseOptions: { resetModelState, deleteSketch, markReferenceConstraint, serializeModel, loadModelData, analysis, referenceState },
    snapshot() { return plain({ events, scope: state.scope, history: state.history, editor: state.editor, enabled: state.enabled }); } };
}

test('Document workspace fixture factories stay cold and preserve live history, Geometry identity, deletion options and cyclic reload order', () => {
  const run = composed => {
    const f = workspaceFixture(composed); f.state.ready = true;
    const before = f.observation.state(); f.state.history = { undoCount: 4, redoCount: 3 }; f.state.editor = {}; f.state.enabled = true; f.state.disabled = false;
    const after = f.observation.state(); assert.equal(after.undoCount, 4); assert.equal(after.blockEditing, true); assert.equal(after.constructionLineMode, true);
    const deleted = f.deletion.reset(); assert.equal(deleted.deleted, false);
    assert.ok(f.state.scope.lines[0] instanceof workspaceSandbox.window.GeometrySolver.Line);
    assert.equal(f.state.scope.lines[0].p1, f.state.scope.points[0]); assert.equal(f.deletion.remove('S3'), 'deleted:S3');
    const cyclic = f.cyclic.loadCase(); assert.equal(cyclic.total, 2); assert.equal(cyclic.operational, 0); assert.equal(cyclic.badges, 2);
    return plain({ before, after, deleted, cyclic, state: f.snapshot() });
  };
  assert.deepEqual(run(true), run(false));
});

test('Document workspace adapters preserve observation and fixture failures with the same partially created model', () => {
  for (const failure of ['history', 'editor', 'construction', 'dom', 'reset', 'scope', 'delete', 'mark', 'serialize', 'load', 'analysis', 'ui', 'operational', 'errors', 'badges']) {
    const run = composed => { const f = workspaceFixture(composed, failure); f.state.ready = true;
      const action = ['history', 'editor', 'construction', 'dom'].includes(failure) ? () => f.observation.state() :
        failure === 'delete' ? () => f.deletion.reset() : () => f.cyclic.loadCase();
      assert.throws(action, error => error === f.marker); return f.snapshot(); };
    assert.deepEqual(run(true), run(false), failure);
  }
});

function browserDocumentFixture(assembled, failure) {
  const f = workspaceFixture(true, failure), w = workspaceSandbox.window;
  const root = f.options.documentWorkspace.document, fileSession = w.DocumentFiles.create();
  root.documentName = 'Root'; f.options.document.title = 'Root | Jot2D';
  f.state.importGate = Promise.resolve(); f.state.time = 10;
  const files = {
    effectiveDocumentName: () => { assert.equal(f.state.ready, true); return root.documentName + ' display'; },
    async importFileData(file) {
      assert.equal(f.state.ready, true); f.events.push('import');
      const data = JSON.parse(await file.text()); await f.state.importGate;
      if (f.state.importFailure) throw f.marker;
      root.documentName = data.documentName; f.options.document.title = data.documentName + ' | Jot2D';
      fileSession.setHandle({ name: file.name }); return true;
    },
  };
  const options = { ...f.options, files, fileSession }, cases = { ...f.caseOptions,
    performance: { now: () => { assert.equal(f.state.ready, true); return f.state.time; } }, File };
  let support;
  if (assembled) support = w.DocumentTestDriver.createBrowserSupportForWorkspace(options, cases);
  else {
    const raw = w.DocumentTestDriver.createForWorkspace(options), readTestHistory = raw.history.state;
    const sketchDeletionFixture = raw.createSketchDeletion(cases), cyclicReferenceFixture = raw.createCyclicReference(cases);
    const documentTestApi = raw.createFileApi(cases);
    support = Object.freeze({ documents: Object.freeze({ documentTestApi, readTestHistory, cyclicReferenceFixture }), sketchDeletionFixture });
  }
  assert.deepEqual(f.events, []);
  return { ...f, root, fileSession, options, cases, support };
}

test('Document browser support publishes the same cold groups and shares live history, fixed document and current scope', () => {
  function run(assembled) {
    const f = browserDocumentFixture(assembled), { documents, sketchDeletionFixture } = f.support;
    assert.ok(Object.isFrozen(f.support)); assert.ok(Object.isFrozen(documents));
    assert.deepEqual(Object.keys(documents), ['documentTestApi','readTestHistory','cyclicReferenceFixture']);
    f.state.ready = true; f.state.history = { undoCount: 5, redoCount: 2 };
    assert.equal(documents.readTestHistory().undoCount, 5);
    f.state.scope = workspaceSandbox.window.DocumentState.create(); f.state.scope.documentName = 'Bound';
    const names = documents.documentTestApi.observations.documentNameState();
    assert.equal(names.modelName, 'Root'); assert.equal(names.serializedName, 'Bound');
    const deleted = sketchDeletionFixture.reset();
    assert.ok(f.state.scope.lines[0] instanceof workspaceSandbox.window.GeometrySolver.Line);
    assert.equal(f.state.scope.lines[0].p1, f.state.scope.points[0]);
    assert.equal(sketchDeletionFixture.remove('S3'), 'deleted:S3');
    const cyclic = documents.cyclicReferenceFixture.loadCase();
    return plain({ names, deleted, cyclic, state: f.snapshot() });
  }
  assert.deepEqual(run(true), run(false));
});

test('Document browser support preserves file import waiting, cloning and original fixture exceptions', async () => {
  async function run(assembled) {
    const f = browserDocumentFixture(assembled), api = f.support.documents.documentTestApi; f.state.ready = true;
    const snapshot = api.observations.serializedModelForTest(); assert.notEqual(snapshot, f.state.scope);
    let finish; f.state.importGate = new Promise(resolve => { finish = resolve; });
    const pending = api.fixtures.importDocumentNameFixture({ documentName: 'Imported' }, 'new.jot2d');
    assert.equal(f.root.documentName, 'Root'); f.state.time = 35; finish();
    const imported = await pending; assert.equal(imported.elapsedMs, 25); assert.equal(imported.modelName, 'Imported');
    assert.equal(f.fileSession.handle.name, 'new.jot2d');
    f.state.importFailure = true; await assert.rejects(api.fixtures.importDocumentNameFixture({}, 'bad.jot2d'), error => error === f.marker);
    return plain({ imported, events: f.events, files: api.observations.fileSystemAccessStateForTest() });
  }
  assert.deepEqual(await run(true), await run(false));
  for (const failure of ['history','dom','delete','mark','serialize','load','analysis','ui','operational','errors','badges']) {
    const run = assembled => {
      const f = browserDocumentFixture(assembled, failure); f.state.ready = true;
      const action = ['history','dom'].includes(failure) ? f.support.documents.readTestHistory :
        failure === 'delete' ? f.support.sketchDeletionFixture.reset : f.support.documents.cyclicReferenceFixture.loadCase;
      assert.throws(action, error => error === f.marker); return f.snapshot();
    };
    assert.deepEqual(run(true), run(false), failure);
  }
});

test('Document browser support only publishes after the last factory succeeds and leaves previous support usable', () => {
  const f = browserDocumentFixture(true), before = f.snapshot(), marker = new Error('file binding failed');
  const files = { get effectiveDocumentName() { throw marker; } };
  assert.throws(() => workspaceSandbox.window.DocumentTestDriver.createBrowserSupportForWorkspace({ ...f.options, files }, f.cases), error => error === marker);
  assert.deepEqual(f.snapshot(), before); f.state.ready = true;
  assert.equal(f.support.documents.readTestHistory().undoCount, 2);
  assert.equal(f.support.sketchDeletionFixture.remove('S3'), 'deleted:S3');
});