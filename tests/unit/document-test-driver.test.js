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
function fileApiFixture() {
  const calls = [], state = { ready: false, time: 10, model: { documentName: 'Before', constraints: [{ id: 'C1' }] },
    loadFailure: null, serializeFailure: null, importFailure: null, importGate: Promise.resolve() };
  const document = { title: 'Before | Jot2D' }, files = sandbox.window.DocumentFiles.create();
  const read = name => { assert.equal(state.ready, true); calls.push(name); };
  const api = sandbox.window.DocumentTestDriver.createFileApi({ performance: { now: () => { read('clock'); return state.time; } },
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
  });
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
