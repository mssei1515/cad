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
