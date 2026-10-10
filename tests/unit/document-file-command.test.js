const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['persistence/document_files.js', 'commands/document_file_command.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src', file), 'utf8'), sandbox);
function fixture() {
  const session = sandbox.window.DocumentFiles.create();
  const state = { data: { documentName: 'Drawing', points: [] }, block: false, choice: 'discard', imported: [], checkpoints: [], hints: [] };
  session.markCheckpoint('new', state.data);
  const browser = { location: { search: '' }, URLSearchParams, FileReader: class {
    constructor() { this.listeners = {}; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    readAsText(file) {
      state.finishRead = () => { this.result = file.content ?? JSON.stringify({ documentName: 'Loaded' }); this.listeners[file.error ? 'error' : 'load'](); };
      if (!state.holdRead) state.finishRead();
    }
  } };
  const registrations = new Map();
  const command = sandbox.window.DocumentFileCommand.create({ window: browser, document: { getElementById: () => null }, fileSession: session,
    bookmarks: { get: async id => registrations.get(id), register: async handle => { if (state.storageError) throw new Error('Storage failed'); registrations.set('registered', { handle }); return 'registered'; } },
    choiceDialog: { show: async () => state.choice }, applicationText: (ja, en) => en,
    isEditingBlock: () => state.block, getDocumentName: () => state.data.documentName,
    serializeModel: () => state.data, applyLoadedDocument: (data, name) => { if (state.accept === false) throw new Error('Invalid document'); state.imported.push([data, name]); },
    markDocumentFileCheckpoint: (kind, data) => { state.checkpoints.push([kind, data]); session.markCheckpoint(kind, data); },
    updateDocumentNameUI() {}, setHint: (...args) => state.hints.push(args), log() {},
  });
  return { session, state, browser, command, registrations };
}
test('save captures written data and excludes overlapping saves until completion', async () => {
  const f = fixture(); let release; let written;
  f.browser.showSaveFilePicker = async () => ({ name: 'saved.jot2d', createWritable: async () => ({ write: async content => { written = content; await new Promise(resolve => { release = resolve; }); }, close: async () => {} }) });
  const saving = f.command.save();
  while (!release) await Promise.resolve();
  assert.equal(await f.command.save(), false);
  f.state.data = { documentName: 'Changed', points: [] }; release();
  assert.equal(await saving, true); assert.equal(f.session.busy, false);
  assert.equal(f.state.checkpoints[0][1].documentName, JSON.parse(written).documentName);
  assert.equal(f.session.matchesCheckpoint(f.state.data), false);
});
test('block editing begun while the picker is open prevents writing', async () => {
  const f = fixture(); let writes = 0;
  f.browser.showSaveFilePicker = async () => { f.state.block = true; return { createWritable: () => { writes++; } }; };
  assert.equal(await f.command.save(), false); assert.equal(writes, 0);
  assert.equal(f.session.busy, false); assert.equal(f.state.checkpoints.length, 0);
});
test('failed import preserves the save target and releases native open exclusion', async () => {
  const f = fixture(); const original = { name: 'original.jot2d' }; f.session.setHandle(original);
  const file = { name: 'new.jot2d' }; f.state.accept = false;
  f.browser.showOpenFilePicker = async () => [{ getFile: async () => file }];
  assert.equal(await f.command.open(), false);
  assert.equal(f.state.imported.length, 0); assert.equal(f.session.handle, original); assert.equal(f.session.busy, false);
});
test('canceling replacement from file input clears input but preserves target and model', async () => {
  const f = fixture(); f.state.data = { documentName: 'Edited' }; f.state.choice = null;
  const input = { value: 'path', files: [{ name: 'new.jot2d' }] };
  await f.command.fileInputChanged({ currentTarget: input });
  assert.equal(input.value, ''); assert.equal(f.state.imported.length, 0); assert.equal(f.session.busy, false);
});

test('unload checks live data and pending writes, independently of history status', () => {
  const f = fixture(); const check = expected => { let prevented = false; const event = { preventDefault() { prevented = true; } }; f.command.beforeUnload(event); assert.equal(prevented, expected); assert.equal(event.returnValue, expected ? '' : undefined); };
  check(false); f.state.data.points.push(1); check(true); f.state.data.points.pop();
  f.session.beginSave(); check(true); f.session.finishSave(); check(false);
  f.state.block = true; check(true);
});

test('read completion rechecks live changes and Block editing before applying data', async () => {
  for (const edit of ['document', 'block']) {
    const f = fixture(); f.state.holdRead = true;
    const expectedContentSignature = sandbox.window.DocumentFiles.documentContentSignature(f.state.data);
    const reading = f.command.importFileData({ name: 'held.jot2d' }, { expectedContentSignature });
    if (edit === 'document') f.state.data.points.push(1); else f.state.block = true;
    f.state.finishRead(); assert.equal(await reading, false); assert.equal(f.state.imported.length, 0);
  }
});
test('read parses data before model application and reports read or JSON failures', async () => {
  const f = fixture();
  assert.equal(await f.command.importFileData(null), false);
  assert.equal(await f.command.importFileData({ name: 'broken', content: '{' }), false);
  assert.equal(await f.command.importFileData({ name: 'unreadable', error: true }), false);
  assert.equal(f.state.imported.length, 0);
  assert.equal(await f.command.importFileData({ name: 'valid.jot2d', content: '{"documentName":"Parsed"}' }), true);
  assert.equal(f.state.imported[0][0].documentName, 'Parsed'); assert.equal(f.state.imported[0][1], 'valid.jot2d');
});

function linkedFixture(permission = 'granted') {
  const f = fixture();
  supportLinks(f);
  const handle = { name: 'linked.jot2d', queryPermission: async () => permission,
    requestPermission: async () => { f.state.requested = true; return f.state.permissionResult || 'granted'; },
    getFile: async () => { if (f.state.fileError) throw new Error('File removed'); return { name: 'linked.jot2d' }; } };
  f.registrations.set('registered', { handle });
  f.browser.location.search = '?document=registered';
  f.browser.location.href = 'https://local.test/index.html?document=registered';
  return { ...f, handle };
}

test('registered startup reads the latest file and preserves its save handle without requesting granted permission', async () => {
  const f = linkedFixture();
  assert.equal(await f.command.openStartupDocument(), true);
  assert.equal(f.state.imported[0][1], 'linked.jot2d');
  assert.equal(f.session.handle, f.handle); assert.equal(f.state.requested, undefined); assert.equal(f.session.busy, false);
});

test('startup permission cancel preserves drawing and retry requests permission', async () => {
  const f = linkedFixture('prompt'); f.state.choice = null;
  assert.equal(await f.command.openStartupDocument(), false);
  assert.equal(f.state.requested, undefined); assert.equal(f.state.imported.length, 0);
  assert.equal(await f.command.openLinkedDocument(), true); assert.equal(f.state.requested, true);
});

test('permission denial, removed file and unknown registration preserve original save target', async () => {
  for (const failure of ['denied', 'missing', 'unknown']) {
    const f = linkedFixture('prompt'); const original = { name: 'original' }; f.session.setHandle(original);
    f.state.choice = 'open';
    if (failure === 'denied') f.state.permissionResult = 'denied';
    if (failure === 'missing') f.state.fileError = true;
    if (failure === 'unknown') f.registrations.clear();
    assert.equal(await f.command.openStartupDocument(), false);
    assert.equal(f.state.imported.length, 0); assert.equal(f.session.handle, original); assert.equal(f.session.busy, false);
  }
});

test('linked startup respects dirty drawing cancellation and edits during reading', async () => {
  const f = linkedFixture(); f.state.data.points.push(1); f.state.choice = null;
  assert.equal(await f.command.openStartupDocument(), false); assert.equal(f.state.imported.length, 0);
  f.state.choice = 'discard'; f.state.holdRead = true;
  const opening = f.command.openLinkedDocument();
  while (!f.state.finishRead) await Promise.resolve();
  f.state.data.points.push(2); f.state.finishRead();
  assert.equal(await opening, false); assert.equal(f.state.imported.length, 0);
});

test('link creation registers a handle, strips startup queries, and tolerates clipboard denial', async () => {
  const f = fixture(); const handle = { name: 'drawing.jot2d' }; f.session.setHandle(handle);
  supportLinks(f);
  f.browser.URL = URL; f.browser.location.href = 'file:///C:/dev/cad/index.html?test=1&filePicker=input#old';
  f.browser.navigator = { clipboard: { writeText: async () => { throw new Error('Clipboard denied'); } } };
  assert.equal(await f.command.copyDocumentLink(), 'file:///C:/dev/cad/index.html?document=registered');
  assert.equal(f.registrations.get('registered').handle, handle); assert.equal(f.state.checkpoints.length, 0);
  f.state.storageError = true; assert.equal(await f.command.copyDocumentLink(), false);
  f.session.setHandle(null); assert.equal(await f.command.copyDocumentLink(), false);
});

function supportLinks(f) {
  f.browser.URL = URL;
  f.browser.indexedDB = {};
  f.browser.crypto = { randomUUID() {} };
  f.browser.showOpenFilePicker = async () => [];
  f.browser.FileSystemFileHandle = function () {};
  f.browser.FileSystemFileHandle.prototype = { isSameEntry() {}, queryPermission() {}, requestPermission() {} };
  f.browser.location.href = 'https://local.test/index.html?other=keep';
  f.browser.history = { state: { marker: 1 }, replaceState(state, title, url) {
    f.state.urlChanges = [...(f.state.urlChanges || []), url];
    f.browser.location.href = url; f.browser.location.search = new URL(url).search;
    assert.equal(state.marker, 1);
  } };
}

test('native open updates URL without navigation, retaining unrelated query parameters', async () => {
  const f = fixture(); supportLinks(f);
  const handle = { getFile: async () => ({ name: 'loaded.jot2d' }) };
  f.browser.showOpenFilePicker = async () => [handle];
  assert.equal(await f.command.open(), true);
  assert.equal(f.browser.location.href, 'https://local.test/index.html?other=keep&document=registered');
});

test('registration and history failures do not change successful opening into failure or leave old file IDs', async () => {
  for (const failure of ['storage', 'history']) {
    const f = fixture(); supportLinks(f);
    f.browser.location.href = 'https://local.test/index.html?document=old';
    f.browser.location.search = '?document=old';
    f.browser.showOpenFilePicker = async () => [{ getFile: async () => ({ name: 'loaded.jot2d' }) }];
    if (failure === 'storage') f.state.storageError = true;
    else f.browser.history.replaceState = () => { throw new Error('Unavailable'); };
    assert.equal(await f.command.open(), true); assert.equal(f.state.imported.length, 1);
    if (failure === 'storage') assert.equal(new URL(f.browser.location.href).searchParams.has('document'), false);
  }
});

test('unsupported startup ignores dedicated links without touching registration storage or throwing', async () => {
  const f = fixture(); supportLinks(f); f.browser.showOpenFilePicker = undefined;
  f.browser.location.href = 'https://local.test/index.html?document=old&other=keep';
  f.browser.location.search = '?document=old&other=keep';
  assert.equal(await f.command.openStartupDocument(), false);
  assert.equal(f.browser.location.href, 'https://local.test/index.html?other=keep');
  assert.equal(f.state.hints.length, 0); assert.equal(f.state.imported.length, 0);
});

test('linked replacement can save the current file before opening its captured target', async () => {
  const f = linkedFixture(); f.state.choice = 'save'; f.state.data.points.push(1);
  let written = false;
  f.session.setHandle({ createWritable: async () => ({ write: async () => { written = true; }, close: async () => {} }) });
  assert.equal(await f.command.openStartupDocument(), true);
  assert.equal(written, true); assert.equal(f.session.handle, f.handle);
  assert.equal(f.state.imported[0][1], 'linked.jot2d');
});
