const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync('src/application/application_refresh.js', 'utf8'), sandbox);
function fixture() {
  const state = { ready: false, blockOpen: false, moving: false, active: false, panel: { inert: false },
    namespace: 'first', prepared: null, selection: 'first', rendered: null, analysis: 0 };
  const events = [], profiles = [];
  const call = (name, run = () => {}) => () => { assert.equal(state.ready, true); events.push(name); return run(); };
  const document = { getElementById(id) {
    assert.equal(state.ready, true); events.push(id);
    return id === 'propertiesPanel' ? state.panel : state.blockOpen ? { open: true } : null;
  } };
  const profiler = { get active() { assert.equal(state.ready, true); return state.active; } };
  const api = sandbox.window.ApplicationRefresh.create({ document, interactionProfiler: profiler,
    profileInteractionWork: (name, work) => { profiles.push(`begin:${name}`); try { return work(); } finally { profiles.push(`end:${name}`); } },
    syncAnnotationResize: call('annotation'), prepareParameterNamespace: call('namespace', () => { state.prepared = state.namespace; }),
    refreshConstraintAnalysis: call('analysis', () => { state.analysis++; }), updateDocumentName: call('name'),
    updateToolbar: call('toolbar'), renderSketch: call('sketch'), updateBlockUI: call('blocks'),
    renderProperties: call('properties', () => { state.rendered = state.selection; return state.rendered; }),
    readSketchMoving: call('moving', () => state.moving), updateStatusUI: call('status'), updateConstraintButtons: call('constraints'),
    localizeApplicationUI: call('localize'), syncDimensionInput: call('dimension-input'), refreshSketchSelection: call('sketch-selection'),
  });
  return { state, events, profiles, api };
}

test('full refresh prepares the current namespace before analysis and updates live views and Properties inert state', () => {
  const f = fixture(); assert.deepEqual(f.events, []); assert.deepEqual(f.profiles, []); f.state.ready = true;
  f.api.refresh(); assert.equal(f.state.prepared, 'first'); assert.equal(f.state.analysis, 1); assert.equal(f.state.rendered, 'first');
  assert.deepEqual(f.events, ['annotation', 'namespace', 'analysis', 'name', 'toolbar', 'sketch', 'blocks', 'properties',
    'propertiesPanel', 'moving', 'status', 'constraints', 'localize', 'dimension-input']);
  f.events.length = 0; f.state.namespace = 'replacement'; f.state.selection = 'replacement'; f.state.moving = true;
  f.api.refresh({ refreshAnalysis: false }); assert.equal(f.state.prepared, 'replacement'); assert.equal(f.state.rendered, 'replacement');
  assert.equal(f.state.analysis, 1); assert.equal(f.state.panel.inert, true); assert.equal(f.events.includes('analysis'), false);
  f.state.moving = false; f.api.refresh(); assert.equal(f.state.panel.inert, false); assert.equal(f.state.analysis, 2);
});

test('selection refresh avoids model preparation and full tree render, updating Block view only while the dialog is open', () => {
  const f = fixture(); f.state.ready = true;
  f.api.selection(); assert.deepEqual(f.events, ['annotation', 'toolbar', 'constraints', 'blockDefinitionsDialog', 'sketch-selection', 'properties']);
  assert.equal(f.state.analysis, 0); assert.equal(f.state.prepared, null);
  f.events.length = 0; f.state.blockOpen = true; f.state.selection = 'next'; f.api.selection();
  assert.deepEqual(f.events, ['annotation', 'toolbar', 'constraints', 'blockDefinitionsDialog', 'blocks', 'sketch-selection', 'properties']);
  assert.equal(f.state.rendered, 'next'); assert.equal(f.state.panel.inert, false);
});

test('live profiling wraps full, selection and individual refreshes with the original nested work categories', () => {
  const f = fixture(); f.state.ready = true; f.state.active = true;
  f.api.refresh({ refreshAnalysis: false });
  assert.deepEqual(f.profiles, ['begin:ui', 'begin:tree', 'end:tree', 'begin:properties', 'end:properties', 'end:ui']);
  f.profiles.length = 0; f.api.selection();
  assert.deepEqual(f.profiles, ['begin:ui', 'begin:properties', 'end:properties', 'end:ui']);
  f.profiles.length = 0; assert.equal(f.api.properties(), 'first'); f.api.sketch();
  assert.deepEqual(f.profiles, ['begin:properties', 'end:properties', 'begin:tree', 'end:tree']);
  f.state.active = false; f.profiles.length = 0; f.api.refresh(); assert.deepEqual(f.profiles, []);
});

test('missing Properties DOM skips movement reads and refresh exceptions preserve the original stop boundary', () => {
  const f = fixture(); f.state.ready = true; f.state.panel = null;
  f.api.refresh(); assert.equal(f.events.includes('moving'), false); assert.equal(f.events.at(-1), 'dimension-input');
  const failure = new Error('namespace preparation failed');
  Object.defineProperty(f.state, 'namespace', { get() { throw failure; } }); f.events.length = 0; f.state.active = true;
  assert.throws(() => f.api.refresh(), error => error === failure);
  assert.deepEqual(f.events, ['annotation', 'namespace']); assert.deepEqual(f.profiles, ['begin:ui', 'end:ui']);
});
