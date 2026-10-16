const assert = require('node:assert/strict'); const fs = require('node:fs');
const path = require('node:path'); const vm = require('node:vm'); const test = require('node:test');
function fixture() {
  const events = [], browser = new EventTarget(), nodes = Object.fromEntries(['exportBtn', 'saveAsBtn', 'importBtn', 'documentFileInput'].map(id => [id, new EventTarget()]));
  nodes.documentFileInput.click = () => events.push('fileInput');
  const status = { textContent: '', title: '', dataset: {} };
  const state = { data: { documentName: 'Initial', points: [] }, block: false, snapshot: null, repair: '', failLoad: null };
  state.snapshot = JSON.stringify(state.data);
  let title = '';
  const document = { getElementById: id => id === 'documentSaveStatus' ? status : nodes[id] || null,
    get title() { return title; }, set title(value) { title = value; events.push('status'); } };
  browser.location = { href: 'http://localhost/index.html', search: '' }; browser.URL = URL; browser.URLSearchParams = URLSearchParams;
  browser.FileReader = class { constructor() { this.listeners = {}; } addEventListener(type, fn) { this.listeners[type] = fn; }
    readAsText(file) { this.result = file.content; this.listeners.load(); } };
  const nativeListen = browser.addEventListener.bind(browser);
  browser.addEventListener = (type, handler) => { events.push(['listen', type]); nativeListen(type, handler); };
  const sandbox = { window: {} }; vm.createContext(sandbox);
  for (const file of ['src/persistence/document_files.js', 'src/persistence/document_bookmarks.js', 'src/commands/document_file_command.js', 'src/ui/document_status_view.js', 'src/ui/document_file_controls.js', 'src/application/document_file.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox);
  const session = sandbox.window.DocumentFiles.create();
  const feature = sandbox.window.DocumentFileFeature.create({ window: browser, document, fileSession: session, applicationText: (_ja, en) => en,
    readDocumentName: () => state.data.documentName, currentSnapshot: () => state.snapshot, isEditingBlock: () => state.block,
    serializeModel: () => { events.push('serialize'); return state.data; }, requestChoice: async () => 'discard',
    loadModelData(data, options) { events.push(['load', options.documentNameOverride]); if (state.failLoad) throw state.failLoad; state.data = { ...data, documentName: options.documentNameOverride }; },
    solveAndRefresh: label => events.push(['solve', label]), resetHistory: label => { state.snapshot = JSON.stringify(state.data); events.push(['history', label]); },
    fitAllGeometryToViewport: () => events.push('fit'), repairMessage: () => state.repair,
    setHint: (...args) => events.push(['hint', ...args]), log: message => events.push(['log', message]), draw: () => events.push('draw'),
  });
  assert.deepEqual(events, []);
  return { feature, state, events, browser, document, status, session, nodes };
}

test('file feature keeps history-based status separate from live-data unload protection', () => {
  const f = fixture(); f.feature.markCheckpoint('new'); assert.equal(f.status.dataset.dirty, 'false');
  f.state.data.points.push({ id: 'P1' }); f.feature.refreshStatus(); assert.equal(f.status.dataset.dirty, 'false');
  f.feature.start(); const dirty = new Event('beforeunload', { cancelable: true }); f.browser.dispatchEvent(dirty); assert.equal(dirty.defaultPrevented, true);
  f.state.snapshot = JSON.stringify(f.state.data); f.feature.refreshStatus(); assert.equal(f.status.dataset.dirty, 'true');
  f.feature.markCheckpoint('saved'); assert.equal(f.status.dataset.dirty, 'false');
  const clean = new Event('beforeunload', { cancelable: true }); f.browser.dispatchEvent(clean); assert.equal(clean.defaultPrevented, false);
  f.state.block = true; const block = new Event('beforeunload', { cancelable: true }); f.browser.dispatchEvent(block); assert.equal(block.defaultPrevented, true);
});

test('decoded file completes load, solve, history, checkpoint/status, viewport and repair feedback in order', async () => {
  const f = fixture(); f.state.repair = 'repaired';
  assert.equal(await f.feature.importFileData({ name: 'Part.jot2d', content: '{"documentName":"Stored","points":[]}' }), true);
  assert.deepEqual(f.events, [['load', 'Part'], ['solve', 'ファイル読み込み'], ['history', 'ファイル読み込み'], 'serialize', 'status', 'status', 'fit', 'draw', ['hint', 'repaired'], ['log', 'ファイルを読み込みました: Part.jot2d']]);
  assert.equal(f.session.checkpointKind, 'saved'); assert.equal(f.session.matchesCheckpoint(f.state.data), true);
  assert.equal(f.document.title, 'Part - Jot2D');
});

test('load failure does not continue to solve, checkpoint or viewport completion', async () => {
  const f = fixture(); f.state.failLoad = new Error('invalid');
  assert.equal(await f.feature.importFileData({ name: 'bad.jot2d', content: '{}' }), false);
  assert.deepEqual(f.events, [['load', 'bad'], ['hint', 'ファイル読み込みに失敗しました: invalid'], ['log', 'ファイル読み込みに失敗しました: invalid']]);
});

test('file control and startup listeners bind once, dispose only their listeners, and can restart', async () => {
  const f = fixture(); f.feature.markCheckpoint('new'); f.events.length = 0;
  f.feature.bindControls(); f.feature.bindControls(); f.feature.start(); f.feature.start();
  assert.equal(f.events.filter(value => Array.isArray(value) && value[0] === 'listen').length, 1);
  f.nodes.importBtn.dispatchEvent(new Event('click')); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.events.filter(value => value === 'fileInput').length, 1);
  f.feature.dispose(); f.events.length = 0; f.state.block = true;
  f.nodes.importBtn.dispatchEvent(new Event('click')); const event = new Event('beforeunload', { cancelable: true }); f.browser.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false); assert.deepEqual(f.events, []);
  f.feature.bindControls(); f.feature.start(); const restored = new Event('beforeunload', { cancelable: true }); f.browser.dispatchEvent(restored); assert.equal(restored.defaultPrevented, true);
});
