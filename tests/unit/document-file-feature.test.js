const assert = require('node:assert/strict'); const fs = require('node:fs');
const path = require('node:path'); const vm = require('node:vm'); const test = require('node:test');
function fixture(extraFiles = [], build = (w, ports) => w.DocumentFileFeature.create(ports), createSession = w => w.DocumentFiles.create()) {
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
  const session = createSession(sandbox.window);
  const feature = build(sandbox.window, { window: browser, document, fileSession: session, applicationText: (_ja, en) => en,
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

function fileOwnersFixture(composed, probe = {}) {
  const order = [], ports = {}, results = {}, reads = [], restorations = [];
  Object.assign(probe, { order, ports, results, reads, ready: false }); let prepared;
  try {
    const f = fixture([], (w, input) => {
      order.push("between");
      for (const [key, name] of [["readDocumentName", "name"], ["currentSnapshot", "snapshot"], ["isEditingBlock", "block"]]) {
        const original = input[key]; input[key] = () => { assert.equal(probe.ready, true); reads.push(name); if (probe.failRead === name) throw probe.error; return original(); };
      }
      if (probe.configureInput) probe.configureInput(input, w);
      const options = { window: input.window, document: input.document,
        documentWorkspace: { document: { get documentName() { return input.readDocumentName(); } } },
        history: { documentHistory: { get currentSnapshot() { return input.currentSnapshot(); } }, controller: { resetDocument: input.resetHistory } },
        blockEditor: { get current() { return input.isEditingBlock() ? {} : null; } },
        presentation: { settings: { applicationText: input.applicationText }, setHint: input.setHint, log: input.log, draw: input.draw },
        fit: { fitAllGeometryToViewport: input.fitAllGeometryToViewport }, serializeModel: input.serializeModel, requestChoice: input.requestChoice,
        loadModelData: input.loadModelData, solveAndRefresh: input.solveAndRefresh, repairMessage: input.repairMessage };
      probe.input = input; probe.options = options;
      return composed ? prepared.createForWorkspace(options) : w.DocumentFileFeature.create(input);
    }, w => {
      for (const [name, method, label] of [["DocumentFiles", "create", "session"], ["DocumentStatusView", "create", "status"],
        ["DocumentBookmarks", "create", "bookmarks"], ["DocumentFileCommand", "create", "command"], ["DocumentFileControls", "createDocument", "controls"]]) {
        const original = w[name]; restorations.push(() => { w[name] = original; });
        w[name] = { ...original, [method](input) { order.push(label); ports[label] = input; if (probe.failAt === label) throw probe.error; return results[label] = original[method](input); } };
      }
      prepared = composed ? w.DocumentFileFeature.prepare() : { session: w.DocumentFiles.create() };
      return prepared.session;
    });
    assert.deepEqual(reads, []); assert.deepEqual(f.events, []); probe.ready = true;
    return { ...f, prepared, probe };
  } finally { for (const restore of restorations) restore(); }
}

test("file owners retain early shared Session and cold late Status, Bookmarks, Command and Controls construction without extra listeners", () => {
  for (const composed of [false, true]) {
    const f = fileOwnersFixture(composed), { ports, results, input } = f.probe;
    assert.deepEqual(f.probe.order, ["session", "between", "status", "bookmarks", "command", "controls"]);
    assert.equal(f.session, results.session); assert.equal(ports.status.fileSession, f.session); assert.equal(ports.command.fileSession, f.session);
    assert.equal(ports.controls.documentFileCommand, results.command); assert.equal(f.feature.save, results.command.save);
    assert.equal(f.feature.saveAs, results.command.saveAs); assert.equal(f.feature.importFileData, results.command.importFileData);
    assert.equal(ports.status.getDocumentName, f.feature.effectiveDocumentName);
    assert.equal(ports.command.setHint, input.setHint); assert.equal(ports.command.log, input.log);
    assert.equal(Object.isFrozen(f.feature), true); if (composed) assert.equal(Object.isFrozen(f.prepared), true);
    f.state.data.documentName = "  Live\nName  "; assert.equal(f.feature.effectiveDocumentName(), "Live Name");
    f.feature.refreshStatus(); assert.equal(f.document.title, "Live Name - Jot2D");
    f.state.data.documentName = " \t "; assert.equal(f.feature.effectiveDocumentName(), "無題");
  }
});

test("prepared file owners preserve live history status, shared save exclusion, unload, import checkpoint and original completion order", async () => {
  const traces = [];
  for (const composed of [false, true]) {
    const f = fileOwnersFixture(composed); f.feature.markCheckpoint("new"); f.events.length = 0;
    f.session.beginSave(); f.browser.showOpenFilePicker = async () => assert.fail("busy shared Session must reject opening");
    assert.equal(await f.feature.open(), false); assert.equal(f.session.savePending, true); f.session.finishSave();
    f.feature.start(); f.state.data.points.push({ id: "P" }); f.feature.refreshStatus(); assert.equal(f.status.dataset.dirty, "false");
    const unload = new Event("beforeunload", { cancelable: true }); f.browser.dispatchEvent(unload); assert.equal(unload.defaultPrevented, true);
    f.state.snapshot = JSON.stringify(f.state.data); f.feature.refreshStatus(); assert.equal(f.status.dataset.dirty, "true");
    f.events.length = 0; f.state.repair = "repaired";
    assert.equal(await f.feature.importFileData({ name: "Part.jot2d", content: '{"documentName":"Stored","points":[]}' }), true);
    assert.equal(f.feature.effectiveDocumentName(), "Part"); assert.equal(f.session.checkpointKind, "saved"); assert.equal(f.session.matchesCheckpoint(f.state.data), true);
    assert.deepEqual(f.events, [["load", "Part"], ["solve", "ファイル読み込み"], ["history", "ファイル読み込み"], "serialize", "status", "status", "fit", "draw", ["hint", "repaired"], ["log", "ファイルを読み込みました: Part.jot2d"]]);
    f.state.block = true; const blocked = new Event("beforeunload", { cancelable: true }); f.browser.dispatchEvent(blocked); assert.equal(blocked.defaultPrevented, true);
    f.feature.dispose(); f.state.data.points.push({ id: "dirty-after-dispose" }); const disposed = new Event("beforeunload", { cancelable: true }); f.browser.dispatchEvent(disposed); assert.equal(disposed.defaultPrevented, false);
    traces.push(JSON.stringify({ events: f.events, reads: f.probe.reads, status: f.status, title: f.document.title }));
  }
  assert.equal(traces[1], traces[0]);
});

test("file owner preparation and late construction keep failure boundaries; live reader and load failures retain original state and feedback", async () => {
  const order = ["session", "between", "status", "bookmarks", "command", "controls"];
  for (const composed of [false, true]) {
    for (const failAt of order.filter(name => name !== "between")) {
      const error = new Error(failAt), probe = { failAt, error }; assert.throws(() => fileOwnersFixture(composed, probe), value => value === error);
      assert.deepEqual(probe.order, order.slice(0, order.indexOf(failAt) + 1)); assert.deepEqual(probe.reads, []);
    }
    for (const failRead of ["name", "snapshot", "block"]) {
      const error = new Error(failRead), f = fileOwnersFixture(composed, { error }); f.probe.failRead = failRead;
      assert.throws(() => f.feature.refreshStatus(), value => value === error); assert.equal(f.probe.reads.at(-1), failRead); assert.deepEqual(f.events, []);
    }
    const f = fileOwnersFixture(composed), before = f.state.data; f.state.failLoad = new Error("invalid");
    assert.equal(await f.feature.importFileData({ name: "bad.jot2d", content: "{}" }), false); assert.equal(f.state.data, before);
    assert.equal(f.session.checkpointKind, "new"); assert.deepEqual(f.events, [["load", "bad"], ["hint", "ファイル読み込みに失敗しました: invalid"], ["log", "ファイル読み込みに失敗しました: invalid"]]);
  }
});

(function () {
"use strict";
function ownedDxfFixture(composed, failConstructor = null) {
 const f=fileOwnersFixture(true),w=f.w,trace=[],state={ready:false,allowed:true,active:false,pending:null,target:null,mode:'select',sketch:'S1',historyError:null};
 for(const file of ['src/geometry/geometry_kernel.js','src/geometry/spline_geometry.js','src/solver/constraint_solver.js','src/editing/geometry_ids.js','src/editing/geometry_creation.js','src/persistence/dxf_import.js','src/commands/dxf_import_command.js']){
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{window:w});
 }
 Object.assign(f.state.data,{lines:[],circles:[],arcs:[],constraints:[]});
 const ready=()=>assert.equal(state.ready,true,'no model/guard/notification reads during DXF construction');
 const ids=w.GeometryIds.create(),workspace={current:()=>{ready();return f.state.data;}},sketches={activeSketchId:()=>{ready();return state.sketch;}};
 const geometry=w.GeometryCreation.create({currentScope:workspace.current,ids,assignSketchId:item=>{ready();item.sketchId=state.sketch;},
  currentConstruction:()=>false,minLineLength:1e-6,minArcLength:1e-6});
 const parent=f.probe.options;
 Object.assign(parent.documentWorkspace,{workspace,geometryIds:ids,sketches});
 parent.history.record=function(label){assert.equal(this,parent.history);assert.equal(arguments.length,1);ready();f.events.push(['record',label]);if(state.historyError)throw state.historyError;return state.historyResult;};
 parent.presentation.updateUI=()=>{ready();f.events.push('ui');};
 const input={geometry,interaction:{access:{canCreateInActiveSketch:()=>{ready();trace.push('permission');return state.allowed;}},
  lifecycle:{active:()=>{ready();trace.push('active');return state.active;},get mode(){ready();trace.push('mode');return state.mode;}}},
  sessions:{pending:{get current(){ready();trace.push('pending');return state.pending;}},targets:{get command(){ready();trace.push('target');return state.target;}}},
  minimumLength:1e-6,clearSelection:()=>{ready();f.events.push('clear');}};
 const original=w.DxfImportCommand;let actual,ports;
 w.DxfImportCommand={...original,create(options){ports=options;if(failConstructor)throw failConstructor;return actual=original.create(options);}};
 let child;
 try{
  child=composed?f.feature.createDxfForWorkspace(input):f.feature.createDxfForEditing({...input,documentWorkspace:parent.documentWorkspace,
   updateUI:parent.presentation.updateUI,recordHistory:function(label='変更'){return parent.history.record(label);}});
 }finally{w.DxfImportCommand=original;}
 assert.deepEqual(f.events,[]);assert.deepEqual(trace,[]);state.ready=true;
 const file={size:100,name:'same.dxf',text:async()=>dxfText()};
 const button=new EventTarget(),fileInput=Object.assign(new EventTarget(),{files:[],value:'',click:()=>f.events.push('input')});
 f.nodes.dxfImportBtn=button;f.nodes.dxfFileInput=fileInput;
 const snapshot=()=>JSON.stringify({events:f.events,trace,ids:ids.snapshot(),data:f.state.data,busy:f.session.busy,checkpoint:f.session.checkpointKind});
 return {...f,documentState:f.state,state,child,actual,ports,input,file,button,fileInput,snapshot};
}

test('parent-owned DXF shares file Session, Document and actual command cold while retaining independent late control binding',()=>{
 for(const composed of [false,true]){
  const f=ownedDxfFixture(composed);
  assert.equal(f.child.command,f.actual);assert.equal(f.ports.fileSession,f.session);
  assert.equal(f.ports.ids,f.probe.options.documentWorkspace.geometryIds);
  assert.equal(f.ports.currentScope,f.probe.options.documentWorkspace.workspace.current);
  assert.equal(f.ports.activeSketchId,f.probe.options.documentWorkspace.sketches.activeSketchId);
  f.button.dispatchEvent(new Event('click'));assert.deepEqual(f.events,[]);
  const controls=f.child.bindControls({flushScheduledCanvasPointerMove:()=>f.events.push('flush')});
  f.button.dispatchEvent(new Event('click'));assert.deepEqual(f.events,['flush','input']);
  controls.dispose();f.events.length=0;f.button.dispatchEvent(new Event('click'));assert.deepEqual(f.events,[]);
 }
});

test('parent-owned DXF preserves real import, history receiver, dirty checkpoint and live guard or scope refusals',async()=>{
 for(const scenario of ['accepted','permission-refused','busy','scope-changed']){
  const results=[];
  for(const composed of [false,true]){
   const f=ownedDxfFixture(composed);f.feature.markCheckpoint('saved');f.events.length=0;const original=f.documentState.data;
   if(scenario==='permission-refused')f.state.allowed=false;
   if(scenario==='busy')assert.equal(f.session.beginOpen(),true);
   if(scenario==='scope-changed')f.documentState.choice=async()=>{f.documentState.data={documentName:'Other',points:[],lines:[],circles:[],arcs:[],constraints:[]};return 1;};
   const file=scenario==='scope-changed'?{...f.file,text:async()=>dxfText(0)}:f.file;
   assert.equal(await f.child.command.importFile(file),scenario==='accepted');
   assert.equal(f.documentState.data.lines.length,scenario==='accepted'?1:0);
   if(scenario==='accepted'){
    assert.equal(f.documentState.data.lines[0].p1,f.documentState.data.points[0]);assert.equal(f.documentState.data.lines[0].sketchId,'S1');
    assert.equal(f.session.matchesCheckpoint(f.documentState.data),false);assert.equal(f.session.checkpointKind,'saved');
    assert.deepEqual(f.events.filter(e=>Array.isArray(e)&&e[0]==='record'),[['record','DXF読み込み']]);
   }
   if(scenario==='scope-changed')assert.equal(original.lines.length,0);
   if(scenario==='busy')f.session.finishOpen();
   assert.equal(f.session.busy,false);results.push(f.snapshot());
  }
  assert.equal(results[1],results[0],scenario);
 }
});

test('parent-owned DXF preserves constructor and completion failure identity or handling without changing rollback and file exclusion',async()=>{
 for(const composed of [false,true]){
  const marker=new Error('DXF constructor');assert.throws(()=>ownedDxfFixture(composed,marker),error=>error===marker);
 }
 const results=[];
 for(const composed of [false,true]){
  const f=ownedDxfFixture(composed);f.state.historyError=new Error('history failed');
  assert.equal(await f.child.command.importFile(f.file),false);assert.equal(f.session.busy,false);
  assert.ok(f.events.some(e=>Array.isArray(e)&&e[0]==='hint'&&String(e[1]).includes('history failed')));
  results.push(f.snapshot());
 }
 assert.equal(results[1],results[0]);
});
})();

function documentStartupFixture(composed) {
 'use strict';
 const trace=[],state={fail:null,resets:0},marker=new Error('Document startup');
 const step=name=>{trace.push(name);if(state.fail===name)throw marker;};
 const f=fileOwnersFixture(true,{configureInput(input){
  const history=input.resetHistory,serialize=input.serializeModel,descriptor=Object.getOwnPropertyDescriptor(input.document,'title'),listen=input.window.addEventListener;
  input.resetHistory=function(label){assert.equal(this,undefined);assert.equal(arguments.length,1);assert.equal(label,'起動');step('history');return history(label);};
  input.serializeModel=function(){assert.equal(this,undefined);assert.equal(arguments.length,0);step('serialize');return serialize();};
  Object.defineProperty(input.document,'title',{...descriptor,set(value){step('status');descriptor.set.call(this,value);}});
  input.window.addEventListener=function(type,listener){assert.equal(this,input.window);assert.equal(type,'beforeunload');step('listen');return listen(type,listener);};
 }});
 const getElement=f.document.getElementById;
 f.document.getElementById=function(id){if(id==='copyDocumentLinkBtn'){step('startup');assert.equal(f.session.checkpointKind,'new');assert.equal(f.session.matchesCheckpoint(f.state.data),true);}return getElement.call(this,id);};
 function resetModelState(){assert.equal(this,undefined);assert.equal(arguments.length,0);step('reset');state.resets++;f.state.data={documentName:'New drawing',points:[]};}
 function initializePresentation(message){assert.equal(this,undefined);assert.equal(arguments.length,1);assert.equal(message,'空の新規Documentを作成しました');step('presentation');}
 function start(){
  if(composed)return f.feature.startForEmptyDocument({resetModelState,initializePresentation});
  resetModelState();initializePresentation('空の新規Documentを作成しました');const {resetDocument:resetHistory}=f.probe.options.history.controller;resetHistory('起動');const {markCheckpoint}=f.feature;markCheckpoint('new');f.feature.start();
 }
 function snapshot(){return JSON.stringify({trace,events:f.events,data:f.state.data,snapshot:f.state.snapshot,checkpointKind:f.session.checkpointKind,checkpointMatches:f.session.matchesCheckpoint(f.state.data),status:f.status,title:f.document.title,resets:state.resets});}
 assert.deepEqual(trace,[]);return {...f,trace,start,snapshot,startState:state,marker};
}

test('empty Document startup resets and presents before history and checkpoint, then installs unload protection before native startup opening',async()=>{
 const snapshots=[];for(const composed of [false,true]){const f=documentStartupFixture(composed),original=f.state.data;assert.equal(f.start(),undefined);
  await Promise.resolve();assert.notEqual(f.state.data,original);assert.deepEqual(f.trace,['reset','presentation','history','serialize','status','listen','startup']);
  assert.equal(f.session.checkpointKind,'new');assert.equal(f.session.matchesCheckpoint(f.state.data),true);assert.equal(f.status.dataset.dirty,'false');
  f.state.data.points.push({id:'P1'});const event=new Event('beforeunload',{cancelable:true});f.browser.dispatchEvent(event);assert.equal(event.defaultPrevented,true);snapshots.push(f.snapshot());
 }assert.equal(snapshots[1],snapshots[0]);
});

test('empty Document startup propagates each synchronous failure without rolling back completed reset, history, checkpoint or listener-start state',()=>{
 for(const stage of ['reset','presentation','history','serialize','status','listen']){const snapshots=[];for(const composed of [false,true]){
  const f=documentStartupFixture(composed);f.startState.fail=stage;assert.throws(f.start,e=>e===f.marker);assert.equal(f.trace.at(-1),stage);assert.equal(f.trace.includes('startup'),false);snapshots.push(f.snapshot());
 }assert.equal(snapshots[1],snapshots[0],stage);}
});

test('empty Document startup preserves native start idempotency while repeating explicit initialization and restarts after dispose',async()=>{
 const snapshots=[];for(const composed of [false,true]){const f=documentStartupFixture(composed);f.start();f.start();await Promise.resolve();
  assert.equal(f.startState.resets,2);assert.equal(f.trace.filter(x=>x==='history').length,2);assert.equal(f.trace.filter(x=>x==='listen').length,1);assert.equal(f.trace.filter(x=>x==='startup').length,1);
  f.feature.dispose();f.start();await Promise.resolve();assert.equal(f.startState.resets,3);assert.equal(f.trace.filter(x=>x==='listen').length,2);assert.equal(f.trace.filter(x=>x==='startup').length,2);snapshots.push(f.snapshot());
 }assert.equal(snapshots[1],snapshots[0]);
});

function fileExportControlsFixture(composed, failAt) {
  'use strict';
  const trace = [], state = { published: null, failAt, snap: null }, marker = new Error('file exports'); let completed;
  const step = name => { trace.push(name); if (state.failAt === name) throw marker; };
  const f = fileOwnersFixture(true, { configureInput(input, w) {
    const original = w.DocumentFileControls;
    w.DocumentFileControls = { ...original, createDocument(options) {
      const controls = original.createDocument(options);
      return { ...controls, bind() { assert.equal(this, completed); assert.equal(arguments.length, 0); step('file-bind'); return controls.bind(); } };
    } };
  } });
  completed = f.feature;
  for (const file of ['src/geometry/export_region.js', 'src/rendering/canvas_export.js', 'src/commands/png_export_command.js', 'src/persistence/png_file.js', 'src/application/png_export.js', 'src/persistence/dxf_import.js', 'src/commands/dxf_import_command.js']) {
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), { window: f.w });
  }
  f.nodes.pngExportBtn = new EventTarget();
  for (const [id, node] of Object.entries(f.nodes)) {
    const listen = node.addEventListener;
    node.addEventListener = function(type, handler) {
      assert.equal(this, node); if (id === 'pngExportBtn') assert.equal(state.published, nativePng.command);
      step('listen:' + id + ':' + type); return listen.call(this, type, handler);
    };
  }
  const pngExport = f.w.PngExport.prepare(), nativeStart = pngExport.start; let nativePng, ports;
  const lifecycle = { ...pngExport, start() { assert.equal(this, lifecycle); assert.equal(arguments.length, 0); step('png-start'); return nativeStart(); } };
  const dxf = f.feature.createDxf({ geometry: {}, ids: {}, currentScope: () => f.state.data, activeSketchId: () => 'S1', canImport: () => true,
    minimumLength: 1e-6, clearSelection() {}, updateUI() {}, recordHistory() {} });
  const dxfImport = { bindControls(options) {
    assert.equal(this, dxfImport); assert.equal(arguments.length, 1); assert.deepEqual(Object.keys(options), ['flushScheduledCanvasPointerMove']);
    assert.equal(options.flushScheduledCanvasPointerMove, flushPointerMove); step('dxf-bind'); const controls = dxf.createControls(options); controls.bind(); return controls;
  } };
  const referenceImage = { get prepareImages() { step('images-port'); return prepareImages; } };
  function prepareImages() { assert.equal(this, undefined); step('prepare-images'); }
  function flushPointerMove() { assert.equal(this, undefined); step('flush'); }
  const drawingSnap = { find(point, tolerance) { assert.equal(this, drawingSnap); assert.equal(arguments.length, 2); step('snap'); assert.equal(point, state.point); assert.equal(tolerance, 7); if (state.snapError) throw state.snapError; return state.snap; } };
  function createPngExport(options) {
    assert.equal(this, undefined); assert.equal(arguments.length, 1); step('png-create'); ports = options;
    assert.deepEqual(Object.keys(options), ['documentName', 'prepareImages', 'fileSession', 'pngExport', 'findSnap', 'flushPointerMove']);
    assert.equal(options.documentName, f.feature.effectiveDocumentName); assert.equal(options.prepareImages, prepareImages);
    assert.equal(options.fileSession, f.session); assert.equal(options.pngExport, lifecycle); assert.equal(options.flushPointerMove, flushPointerMove);
    return nativePng = options.pngExport.create({ ...options, document: f.document, window: f.browser, canvas: {}, rendering: {}, text: (_ja, en) => en,
      readViewScale: () => 1, readMode: () => 'select', setMode() {}, pendingCommandSession: { current: null, replace() {}, clear() {} },
      drawOperationLifecycle: { active: () => false }, constraintTargetSession: { command: null }, withGeometryReadCache: callback => callback(), setHint: value => f.events.push(['hint', value]), draw() {} });
  }
  function prepare() {
    const options = { createPngExport, referenceImage, drawingSnap, pngExport: lifecycle, dxfImport, flushPointerMove };
    if (composed) return f.feature.prepareExportControls(options);
    f.feature.bindControls();
    const png = createPngExport({ documentName: f.feature.effectiveDocumentName, prepareImages: referenceImage.prepareImages, fileSession: f.session, pngExport: lifecycle,
      findSnap: (point, tolerance) => drawingSnap.find(point, tolerance), flushPointerMove });
    return { png, start() { lifecycle.start(); dxfImport.bindControls({ flushScheduledCanvasPointerMove: flushPointerMove }); } };
  }
  const snapshot = () => JSON.stringify({ trace, events: f.events, data: f.state.data, published: Boolean(state.published), busy: f.session.busy });
  assert.deepEqual(trace, []); assert.deepEqual(f.events, []);
  return { ...f, trace, exportState: state, marker, prepare, snapshot, readPorts: () => ports, nativePng: () => nativePng };
}

test('file export controls share the actual session, live document name and snap port while publishing PNG before starting native controls', () => {
  const results = [];
  for (const composed of [false, true]) {
    const f = fileExportControlsFixture(composed), controls = f.prepare();
    if (composed) assert.ok(Object.isFrozen(controls)); assert.equal(controls.png, f.nativePng());
    assert.equal(f.exportState.published, null); assert.equal(f.trace.includes('png-start'), false);
    f.nodes.pngExportBtn.dispatchEvent(new Event('click')); assert.deepEqual(f.events, []);
    f.exportState.published = controls.png.command; assert.equal(controls.start(), undefined);
    assert.ok(f.trace.indexOf('file-bind') < f.trace.indexOf('png-create')); assert.ok(f.trace.indexOf('png-create') < f.trace.indexOf('png-start'));
    assert.ok(f.trace.indexOf('png-start') < f.trace.indexOf('dxf-bind'));
    f.state.data.documentName = '  Later name  '; assert.equal(f.readPorts().documentName(), 'Later name');
    const point = {}; f.exportState.point = point; f.exportState.snap = { x: 2 }; assert.equal(f.readPorts().findSnap(point, 7), f.exportState.snap);
    const marker = new Error('live snap'); f.exportState.snap = null; const old = f.readPorts().findSnap;
    assert.equal(old.length, 2); assert.equal(old.name, 'findSnap'); assert.equal(old(point, 7), null);
    f.exportState.snapError = marker; assert.throws(() => old(point, 7), error => error === marker); f.exportState.snapError = null;
    f.session.beginSave(); f.nodes.pngExportBtn.dispatchEvent(new Event('click')); f.nodes.dxfImportBtn.dispatchEvent(new Event('click'));
    assert.equal(controls.png.command.active, false); assert.equal(f.events.includes('dxf-input'), false); f.session.finishSave();
    f.nodes.importBtn.dispatchEvent(new Event('click')); f.nodes.dxfImportBtn.dispatchEvent(new Event('click'));
    assert.equal(f.events.includes('fileInput'), true); assert.equal(f.events.includes('dxf-input'), true);
    controls.start(); assert.equal(f.trace.filter(x => x === 'listen:pngExportBtn:click').length, 1);
    assert.equal(f.trace.filter(x => x === 'listen:exportBtn:click').length, 1);
    results.push(f.snapshot());
  }
  assert.equal(results[1], results[0]);
});

test('file export control preparation and start retain partial binding and PNG publication on each original failure boundary', () => {
  for (const stage of ['file-bind', 'listen:exportBtn:click', 'listen:importBtn:click', 'images-port', 'png-create', 'png-start', 'listen:pngExportBtn:click', 'dxf-bind', 'listen:dxfFileInput:change']) {
    const results = [];
    for (const composed of [false, true]) {
      const f = fileExportControlsFixture(composed, stage);
      assert.throws(() => { const controls = f.prepare(); f.exportState.published = controls.png.command; controls.start(); }, error => error === f.marker);
      assert.equal(f.trace.at(-1), stage); assert.equal(Boolean(f.exportState.published), ['png-start', 'listen:pngExportBtn:click', 'dxf-bind', 'listen:dxfFileInput:change'].includes(stage));
      f.exportState.failAt = null; f.nodes.importBtn.dispatchEvent(new Event('click')); f.nodes.dxfImportBtn.dispatchEvent(new Event('click'));
      results.push(f.snapshot());
    }
    assert.equal(results[1], results[0], stage);
  }
});
