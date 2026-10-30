const assert = require('node:assert/strict'); const fs = require('node:fs');
const path = require('node:path'); const vm = require('node:vm'); const test = require('node:test');
function fixture(extraFiles = []) {
  const events = [], browser = new EventTarget(), nodes = Object.fromEntries(['exportBtn', 'saveAsBtn', 'importBtn', 'documentFileInput', 'dxfImportBtn', 'dxfFileInput'].map(id => [id, new EventTarget()]));
  nodes.documentFileInput.click = () => events.push('fileInput');
  nodes.dxfFileInput.click = () => events.push('dxf-input');
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
  for (const file of [...extraFiles, 'src/persistence/document_files.js', 'src/persistence/document_bookmarks.js', 'src/commands/document_file_command.js', 'src/ui/document_status_view.js', 'src/ui/document_file_controls.js', 'src/application/document_file.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox);
  const session = sandbox.window.DocumentFiles.create();
  const feature = sandbox.window.DocumentFileFeature.create({ window: browser, document, fileSession: session, applicationText: (_ja, en) => en,
    readDocumentName: () => state.data.documentName, currentSnapshot: () => state.snapshot, isEditingBlock: () => state.block,
    serializeModel: () => { events.push('serialize'); return state.data; }, requestChoice: async options => state.choice ? state.choice(options) : 'discard',
    loadModelData(data, options) { events.push(['load', options.documentNameOverride]); if (state.failLoad) throw state.failLoad; state.data = { ...data, documentName: options.documentNameOverride }; },
    solveAndRefresh: label => events.push(['solve', label]), resetHistory: label => { state.snapshot = JSON.stringify(state.data); events.push(['history', label]); },
    fitAllGeometryToViewport: () => events.push('fit'), repairMessage: () => state.repair,
    setHint: (...args) => events.push(['hint', ...args]), log: message => events.push(['log', message]), draw: () => events.push('draw'),
  });
  assert.deepEqual(events, []);
  return { feature, state, events, browser, document, status, session, nodes, w: sandbox.window };
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

const dxfText = (units = 4) => [0,'SECTION',2,'HEADER',9,'$INSUNITS',70,units,0,'ENDSEC',0,'SECTION',2,'ENTITIES',0,'LINE',10,1,20,2,11,11,21,12,0,'ENDSEC',0,'EOF',''].join('\n');
function dxfFixture({ composed = false, editingGuard = false, lateControls = false } = {}) {
  const f = fixture(['src/geometry/geometry_kernel.js','src/geometry/spline_geometry.js','src/solver/constraint_solver.js',
    'src/editing/geometry_ids.js','src/editing/geometry_creation.js','src/persistence/dxf_import.js','src/commands/dxf_import_command.js']);
  Object.assign(f.state.data, { lines: [], circles: [], arcs: [], constraints: [] }); f.state.sketch = 'S1'; f.state.allowed = true;
  const ids = f.w.GeometryIds.create(), geometry = f.w.GeometryCreation.create({ currentScope: () => f.state.data, ids,
    assignSketchId: item => { item.sketchId = f.state.sketch; }, currentConstruction: () => true, minLineLength: 1e-6, minArcLength: 1e-6 });
  const guardTrace = [], state = f.state; state.guardReady = false; state.mode = 'select';
  const read = (name, value) => { assert.equal(state.guardReady, true); guardTrace.push(name); if (state.guardError?.name === name) throw state.guardError.error; return value; };
  const permission = () => read('access', state.allowed), active = () => read('active', Boolean(state.active));
  const lifecycle = { active, get mode() { return read('mode', state.mode); } };
  const pending = { get current() { return read('pending', state.pending); } }, targets = { get command() { return read('target', state.target); } };
  const workspace = { current: () => f.state.data }, activeSketchId = () => f.state.sketch;
  const onImport = { minimumLength: 1e-6, clearSelection: () => f.events.push('clear'), updateUI: () => f.events.push('ui'), recordHistory: label => f.events.push(['dxf-history', label]) };
  const originalCreate = f.w.DxfImportCommand.create; let ports;
  f.w.DxfImportCommand = { ...f.w.DxfImportCommand, create(options) { ports = options; return originalCreate(options); } };
  let dxf;
  try {
    dxf = composed ? f.feature.createDxfForEditing({ documentWorkspace: { workspace, geometryIds: ids, sketches: { activeSketchId } }, geometry,
      interaction: { access: { canCreateInActiveSketch: permission }, lifecycle }, sessions: { pending, targets }, ...onImport })
      : f.feature.createDxf({ geometry, ids, currentScope: workspace.current, activeSketchId,
        canImport: editingGuard ? () => permission() && !active() && !pending.current && !targets.command && lifecycle.mode !== 'block-place' : () => state.allowed, ...onImport });
  } finally { f.w.DxfImportCommand = { ...f.w.DxfImportCommand, create: originalCreate }; }
  assert.deepEqual(guardTrace, []); state.guardReady = true;
  const controlOptions = { flushScheduledCanvasPointerMove: () => f.events.push('flush') };
  const controls = lateControls ? null : dxf.createControls(controlOptions);
  const bindControls = () => { if (composed) return dxf.bindControls(controlOptions); const result = dxf.createControls(controlOptions); result.bind(); return result; };
  assert.deepEqual(f.events, []);
  return { ...f, dxf, controls, bindControls, ids, ports, workspace, activeSketchId, guardTrace, file: { size: 100, name: 'part.dxf', text: async () => dxfText() } };
}

test('DXF feature connects the same file session and real import to delayed controls without marking the document saved', async () => {
  const f = dxfFixture(); f.nodes.dxfImportBtn.dispatchEvent(new Event('click')); assert.deepEqual(f.events, []);
  f.feature.markCheckpoint('saved'); f.events.length = 0; f.controls.bind(); f.controls.bind();
  f.nodes.dxfImportBtn.dispatchEvent(new Event('click')); assert.deepEqual(f.events, ['flush','dxf-input']);
  f.events.length = 0; assert.equal(f.session.beginOpen(), true); f.nodes.dxfImportBtn.dispatchEvent(new Event('click'));
  assert.equal(f.events[0], 'flush'); assert.equal(f.events[1][0], 'hint'); assert.equal(f.events.includes('dxf-input'), false); f.session.finishOpen();
  f.events.length = 0; f.nodes.dxfFileInput.files = [f.file]; f.nodes.dxfFileInput.value = 'selected';
  f.nodes.dxfFileInput.dispatchEvent(new Event('change')); assert.equal(f.nodes.dxfFileInput.value, '');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.state.data.lines.length, 1); assert.equal(f.state.data.lines[0].sketchId, 'S1'); assert.equal(f.state.data.lines[0].construction, false);
  assert.equal(f.state.data.lines[0].p1, f.state.data.points[0]); assert.equal(f.state.data.points[0].x, 1); assert.equal(f.state.data.points[0].y, -2);
  assert.deepEqual(f.events.filter(event => event !== 'serialize').map(event => Array.isArray(event) ? event[0] : event), ['clear','ui','dxf-history','fit','draw','hint']);
  assert.equal(f.session.busy, false); assert.equal(f.session.checkpointKind, 'saved'); assert.equal(f.session.matchesCheckpoint(f.state.data), false);
  f.controls.dispose(); f.events.length = 0; f.nodes.dxfImportBtn.dispatchEvent(new Event('click')); assert.deepEqual(f.events, []);
  f.controls.bind(); f.nodes.dxfImportBtn.dispatchEvent(new Event('click')); assert.deepEqual(f.events, ['flush','dxf-input']); f.controls.dispose();
});

test('DXF feature uses the shared choice dialog and rejects async drawing, scope, target and permission changes without allocating IDs', async () => {
  const canceled = dxfFixture(); canceled.state.choice = options => { canceled.events.push(['choice',options]); return null; };
  assert.equal(await canceled.dxf.command.importFile({ ...canceled.file, text: async () => dxfText(0) }), false);
  assert.equal(canceled.events.find(event => event[0] === 'choice')[1].title, 'DXF units'); assert.equal(canceled.session.busy, false);
  assert.equal(canceled.state.data.points.length, 0);
  for (const change of ['drawing','scope','target','permission']) {
    const f = dxfFixture(), beforeIds = JSON.stringify(f.ids.snapshot()), original = f.state.data;
    let resolveText; const pending = f.dxf.command.importFile({ ...f.file, text: () => new Promise(resolve => { resolveText = resolve; }) });
    assert.equal(f.session.busy, true);
    if (change === 'drawing') f.state.data.documentName = 'Changed';
    if (change === 'scope') f.state.data = { ...f.state.data };
    if (change === 'target') f.state.sketch = 'S2';
    if (change === 'permission') f.state.allowed = false;
    resolveText(dxfText()); assert.equal(await pending, false, change);
    assert.equal(f.state.data.points.length, 0); assert.equal(original.points.length, 0); assert.equal(JSON.stringify(f.ids.snapshot()), beforeIds);
    assert.equal(f.events.some(event => Array.isArray(event) && event[0] === 'dxf-history'), false); assert.equal(f.session.busy, false);
  }
});


test('DXF editing availability preserves permission, active operation, pending, target and mode short-circuit order without eager reads', async () => {
  for (const composed of [false, true]) {
    const f = dxfFixture({ composed, editingGuard: true, lateControls: true }), beforeIds = JSON.stringify(f.ids.snapshot());
    assert.equal(f.ports.currentScope, f.workspace.current); assert.equal(f.ports.activeSketchId, f.activeSketchId); assert.equal(f.ports.ids, f.ids);
    for (const [state, trace] of [[{ allowed: false }, ['access']], [{ active: true }, ['access', 'active']],
      [{ pending: {} }, ['access', 'active', 'pending']], [{ target: {} }, ['access', 'active', 'pending', 'target']],
      [{ mode: 'block-place' }, ['access', 'active', 'pending', 'target', 'mode']]]) {
      Object.assign(f.state, { allowed: true, active: false, pending: null, target: null, mode: 'select' }, state); f.guardTrace.length = 0;
      assert.equal(await f.dxf.command.importFile(f.file), false); assert.deepEqual(f.guardTrace, trace);
      assert.equal(f.session.busy, false); assert.equal(f.state.data.points.length, 0); assert.equal(JSON.stringify(f.ids.snapshot()), beforeIds);
    }
    const marker = new Error('availability'); Object.assign(f.state, { mode: 'select', guardError: { name: 'active', error: marker } });
    await assert.rejects(f.dxf.command.importFile(f.file), error => error === marker); assert.equal(f.session.busy, false); assert.equal(JSON.stringify(f.ids.snapshot()), beforeIds);
  }
});

test('DXF editing availability is rechecked after async reads and never inserts into a newly active command or scope', async () => {
  for (const composed of [false, true]) for (const change of ['active', 'pending', 'target', 'mode', 'scope']) {
    const f = dxfFixture({ composed, editingGuard: true, lateControls: true }), original = f.state.data, beforeIds = JSON.stringify(f.ids.snapshot());
    let resolveText; const operation = f.dxf.command.importFile({ ...f.file, text: () => new Promise(resolve => { resolveText = resolve; }) });
    assert.equal(f.session.busy, true);
    if (change === 'mode') f.state.mode = 'block-place'; else if (change === 'scope') f.state.data = { ...f.state.data }; else f.state[change] = {};
    resolveText(dxfText()); assert.equal(await operation, false); assert.equal(f.session.busy, false);
    assert.equal(original.points.length, 0); assert.equal(f.state.data.points.length, 0); assert.equal(JSON.stringify(f.ids.snapshot()), beforeIds);
    assert.equal(f.events.some(event => Array.isArray(event) && event[0] === 'dxf-history'), false);
  }
});

test('DXF editing binds actual controls at the later stage and preserves flush, file-session checks, import and disposal', async () => {
  for (const composed of [false, true]) {
    const f = dxfFixture({ composed, editingGuard: true, lateControls: true }), reads = [], getElementById = f.document.getElementById;
    f.document.getElementById = id => { reads.push(id); return getElementById(id); };
    f.nodes.dxfImportBtn.dispatchEvent(new Event('click')); assert.deepEqual(f.events, []); assert.deepEqual(reads, []);
    const controls = f.bindControls(); assert.deepEqual(reads, ['dxfImportBtn', 'dxfFileInput']); assert.equal(typeof controls.dispose, 'function');
    f.nodes.dxfImportBtn.dispatchEvent(new Event('click')); assert.deepEqual(f.events, ['flush', 'dxf-input']);
    f.events.length = 0; assert.equal(f.session.beginOpen(), true); f.nodes.dxfImportBtn.dispatchEvent(new Event('click'));
    assert.equal(f.events[0], 'flush'); assert.equal(f.events.includes('dxf-input'), false); f.session.finishOpen(); f.events.length = 0;
    assert.equal(await f.dxf.command.importFile(f.file), true); assert.equal(f.state.data.lines.length, 1); assert.equal(f.state.data.lines[0].p1, f.state.data.points[0]);
    assert.equal(f.events.filter(event => Array.isArray(event) && event[0] === 'dxf-history').length, 1); assert.equal(f.session.busy, false);
    controls.dispose(); f.events.length = 0; f.nodes.dxfImportBtn.dispatchEvent(new Event('click')); assert.deepEqual(f.events, []);
  }
});
