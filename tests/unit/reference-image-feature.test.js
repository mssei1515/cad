const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: { GeometrySolver: { hypot2: Math.hypot } } }; vm.createContext(sandbox);
for (const file of ['src/ui/number_display.js', 'src/editing/selection.js', 'src/document/reference_images.js', 'src/geometry/reference_image_geometry.js',
  'src/rendering/reference_image_renderer.js', 'src/persistence/reference_image_import.js', 'src/commands/reference_image_command.js',
  'src/editing/image_clipboard.js', 'src/application/reference_image_input.js', 'src/commands/reference_image_interaction.js',
  'src/application/reference_image_feature.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });

function fixture(assemble = null) {
  const calls = [], resources = [], state = { ready: false, allowed: true, sketch: 'S1', answer: '20', hit: null,
    editing: { referenceImages: [] }, display: { referenceImages: [] }, hiddenSketch: null };
  const ready = () => assert.equal(state.ready, true, 'construction must not read or bind the application');
  function target() {
    const handlers = new Map();
    return { addEventListener(type, fn) { ready(); if (!handlers.has(type)) handlers.set(type, new Set()); handlers.get(type).add(fn); },
      removeEventListener(type, fn) { handlers.get(type)?.delete(fn); },
      emit(type, event = {}) { for (const fn of handlers.get(type) || []) fn({ type, ...event }); },
      count: () => [...handlers.values()].reduce((n, set) => n + set.size, 0) };
  }
  const document = target(), button = target(), input = target();
  document.getElementById = id => { ready(); return id === 'importReferenceImageBtn' ? button : input; };
  const canvas = { getBoundingClientRect() { ready(); return { width: 1000, height: 500 }; },
    classList: { add: value => calls.push(['class+', value]), remove: value => calls.push(['class-', value]) },
    setPointerCapture: id => calls.push(['capture', id]), releasePointerCapture(id) { calls.push(['release', id]); throw new Error('already released'); } };
  const ctx = Object.fromEntries(['translate', 'rotate', 'scale', 'drawImage', 'setLineDash', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'stroke', 'fillText', 'arc', 'fill']
    .map(name => [name, (...args) => { ready(); calls.push([name, ...args]); }]));
  class FileReader {
    constructor() { ready(); this.listeners = {}; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    readAsDataURL() { state.finishRead = () => { this.result = 'data:image/png;base64,AA=='; this.listeners.load(); }; }
  }
  class Image {
    constructor() { ready(); this.naturalWidth = 100; this.naturalHeight = 50; this.listeners = {}; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    set src(value) { this.listeners.load(); }
  }
  const browser = { FileReader, Image, navigator: {}, prompt(message, value) {
    assert.equal(this, browser); calls.push(['prompt', message, value]); return state.answer;
  } };
  const selection = sandbox.window.CanvasSelection.create(), viewport = { scale: 2 };
  const options = { canvas, ctx, viewport, document, window: browser,
    withCanvasState: work => work(), createImage() { ready(); const image = { complete: true, naturalWidth: 100,
      addEventListener(type, fn) { this.load = fn; }, async decode() { calls.push(['decode', this.src]); } }; resources.push(image); return image; },
    readImages: () => { ready(); return state.display.referenceImages; }, currentScope: () => { ready(); return state.editing; },
    canvasSelection: selection, readHover: () => ({ referenceImage: state.hit }), isVisibleValue: value => value !== false,
    isVisibleSketchId: id => id !== state.hiddenSketch, activeSketchId: () => { ready(); return state.sketch; },
    guardSketchEdit: () => state.allowed, clearSelection: () => { selection.clear(); calls.push(['clear']); },
    applicationText: (_ja, en) => en, setHint: (...args) => calls.push(['hint', ...args]), updateUI: () => calls.push(['ui']),
    draw: () => calls.push(['draw']), clearSnap: () => calls.push(['snap']), hypot2: Math.hypot,
    hitReferenceImageAt: () => state.hit, formatDisplayNumber: value => String(value), recordHistory: label => calls.push(['history', label]),
    screenToWorld: point => ({ x: point.x + 1, y: point.y + 2 }), nextId: () => 'RI1', canCreateInActiveSketch: () => state.allowed,
    pasteGeometry: () => true, copyGeometry: () => true, isGeometryMode: () => true, isTextEditingTarget: () => false };
  const feature = assemble ? assemble(options, state, calls, resources) : sandbox.window.ReferenceImageFeature.create(options);
  assert.deepEqual(calls, []); assert.deepEqual(resources, []); assert.equal(document.count(), 0); assert.ok(Object.isFrozen(feature));
  state.ready = true;
  return { feature, state, selection, viewport, calls, resources, document, button, input };
}

test('reference-image assembly shares live import selection and the actual drag/calibration session with presentation', async () => {
  const f = fixture(), old = f.state.editing;
  const pending = f.feature.input.importFile({ name: 'plan.png', type: 'image/png' });
  f.state.editing = { referenceImages: [] }; f.state.sketch = 'S2'; f.viewport.scale = 4;
  f.state.finishRead(); assert.equal(await pending, true); assert.equal(old.referenceImages.length, 0);
  const image = f.state.editing.referenceImages[0]; assert.equal(f.selection.referenceImages[0], image);
  assert.equal(image.sketchId, 'S2'); assert.equal(image.scale, 1.7); assert.equal(image.x, 501); assert.equal(image.y, 252);
  f.state.display = f.state.editing; f.state.hit = image; f.calls.length = 0;
  f.feature.interaction.beginDrag({ pointerId: 7 }, image, { x: 0, y: 0 });
  f.feature.interaction.updateDrag({ x: 0.75, y: 0 }); assert.equal(image.x, 501);
  f.feature.interaction.updateDrag({ x: 2, y: 3 }); assert.equal(image.x, 503);
  assert.equal(f.feature.interaction.finishDrag({ pointerId: 7 }), true);
  assert.deepEqual(f.calls.filter(c => ['class+', 'capture', 'class-', 'release'].includes(c[0])),
    [['class+', 'is-dragging'], ['capture', 7], ['class-', 'is-dragging'], ['release', 7]]);
  assert.equal(f.feature.interaction.startCalibration(image), true);
  f.feature.interaction.calibrationClick({ x: image.x, y: image.y }); f.calls.length = 0;
  f.feature.layer.drawOverlays(); assert.ok(f.calls.some(c => c[0] === 'arc' && c[1] === image.x && c[2] === image.y));
  f.feature.interaction.calibrationClick({ x: image.x + image.scale * 10, y: image.y });
  assert.ok(Math.abs(image.scale - 2) < 1e-12); assert.equal(f.feature.interaction.calibrationPoints, null);
  assert.equal(f.calls.filter(c => c[0] === 'history').length, 1);
});

test('image painting and PNG readiness use the current display scope and the same resource cache', async () => {
  const f = fixture(), item = (id, extra = {}) => ({ id, dataUrl: id, x: 0, y: 0, scale: 1, rotation: 0, opacity: 0.5, sketchId: 'S1', visible: true, pixelWidth: 10, pixelHeight: 10, ...extra });
  f.state.editing.referenceImages = [item('editing-only')];
  f.state.display.referenceImages = [item('shown'), item('hidden', { visible: false }), item('hidden-sketch', { sketchId: 'S2' })];
  f.state.hiddenSketch = 'S2'; await f.feature.prepareImages();
  assert.deepEqual(f.resources.map(r => r.src), ['shown']);
  f.feature.layer.drawImages(); assert.equal(f.resources.length, 1);
  assert.equal(f.calls.filter(c => c[0] === 'drawImage').length, 1);
  f.resources[0].load(); assert.equal(f.calls.at(-1)[0], 'draw');
  f.state.display = { referenceImages: [item('new-scope')] }; await f.feature.prepareImages();
  assert.deepEqual(f.resources.map(r => r.src), ['shown', 'new-scope']);
  f.feature.renderer.clear(); await f.feature.prepareImages();
  assert.deepEqual(f.resources.map(r => r.src), ['shown', 'new-scope', 'new-scope']);
});

test('input binding stays deferred and disposal plus permission rejection do not alter model or history', async () => {
  const f = fixture(); f.feature.input.bindClipboard(); f.feature.input.bindClipboard();
  assert.equal(f.document.count(), 3); assert.equal(f.button.count() + f.input.count(), 0);
  f.feature.input.bindControls(); f.feature.input.bindControls(); assert.equal(f.button.count() + f.input.count(), 2);
  const pending = f.feature.input.importFile({ name: 'plan.png', type: 'image/png' });
  f.state.allowed = false; f.state.finishRead(); assert.equal(await pending, false);
  assert.equal(f.state.editing.referenceImages.length, 0); assert.equal(f.selection.referenceImages.length, 0);
  assert.deepEqual(f.calls.map(c => c[0]), ['hint']);
  f.feature.input.dispose(); assert.equal(f.document.count() + f.button.count() + f.input.count(), 0);
});
function ownerFixture(composed, probe = {}) {
  return fixture((options, state, calls) => {
    const w = sandbox.window, ready = () => assert.equal(state.ready, true);
    const documentIds = { allocate(kind) { ready(); assert.equal(this, documentIds); assert.equal(kind, 'referenceImage'); calls.push(['allocate', kind]); return 'RI1'; } };
    const editingScope = { get current() { ready(); return state.display; } }, hover = { get current() { ready(); return { referenceImage: state.hit }; } };
    options.viewport.screenToWorld = options.screenToWorld; options.formatDisplayNumber = w.NumberDisplay.formatDisplayNumber;
    options.nextId = () => documentIds.allocate('referenceImage');
    const inputs = {
      canvas: options.canvas, ctx: options.ctx, viewport: options.viewport, document: options.document, window: options.window,
      withCanvasState: options.withCanvasState, createImage: options.createImage,
      documentWorkspace: { workspace: { current: options.currentScope }, sketches: { activeSketchId: options.activeSketchId }, documentIds }, editingScope,
      interaction: { selection: options.canvasSelection, hover, access: { guardSketchEdit: options.guardSketchEdit, canCreateInActiveSketch: options.canCreateInActiveSketch } },
      presentation: { settings: { applicationText: options.applicationText }, setHint: options.setHint, updateUI: options.updateUI, draw: options.draw },
      appearance: { isVisibleValue: options.isVisibleValue, isVisibleSketchId: options.isVisibleSketchId },
      clearSelection: options.clearSelection, clearSnap: options.clearSnap, hitReferenceImageAt: options.hitReferenceImageAt,
      recordHistory: options.recordHistory, pasteGeometry: options.pasteGeometry, copyGeometry: options.copyGeometry,
      isGeometryMode: options.isGeometryMode, isTextEditingTarget: options.isTextEditingTarget,
    };
    probe.inputs = inputs; probe.options = options; probe.state = state; probe.calls = calls; probe.order = []; probe.ports = {}; probe.results = {};
    const originals = [];
    for (const [namespace, method, name] of [['ReferenceImageRenderer','create','renderer'],['ReferenceImageRenderer','createLayer','layer'],
      ['ReferenceImageInteraction','create','interaction'],['ReferenceImageInput','create','input']]) {
      const original = w[namespace][method]; originals.push([namespace, w[namespace]]);
      w[namespace] = { ...w[namespace], [method]: ports => { probe.order.push(name); probe.ports[name] = ports;
        if (probe.failAt === name) throw probe.error; return probe.results[name] = original(ports); } };
    }
    try { return composed ? w.ReferenceImageFeature.createForWorkspace(inputs) : w.ReferenceImageFeature.create(options); }
    finally { for (const [namespace, original] of originals.reverse()) w[namespace] = original; }
  });
}

test('reference-image owner assembly stays cold and retains actual layers, Selection, browser and delayed input binding', () => {
  for (const composed of [false, true]) {
    const probe = {}, f = ownerFixture(composed, probe), p = probe.ports;
    assert.deepEqual(probe.order, ['renderer','layer','interaction','input']); assert.deepEqual(f.calls, []); assert.deepEqual(f.resources, []);
    assert.equal(f.feature.renderer, probe.results.renderer); assert.equal(f.feature.layer, probe.results.layer); assert.equal(f.feature.interaction, probe.results.interaction);
    assert.equal(p.layer.canvasSelection, f.selection); assert.equal(p.input.canvasSelection, f.selection); assert.equal(p.input.window, probe.inputs.window);
    assert.equal(p.input.currentScope, probe.options.currentScope); assert.equal(p.input.screenToWorld, probe.options.screenToWorld);
    f.state.allowed = false; assert.equal(p.interaction.canEdit({ sketchId:'S2' }), false); f.state.allowed = true;
    assert.equal(p.input.copyGeometry, probe.options.copyGeometry);
    f.feature.input.bindClipboard(); assert.equal(f.document.count(), 3); f.feature.input.dispose(); assert.equal(f.document.count(), 0);
  }
});

test('reference-image owners keep import Workspace distinct from display editing scope, live Selection, calibration and resource readiness', async () => {
  const traces = [];
  for (const composed of [false, true]) {
    const f = ownerFixture(composed), old = f.state.editing, pending = f.feature.input.importFile({ name:'plan.png', type:'image/png' });
    f.state.editing = { referenceImages: [] }; f.state.sketch = 'S2'; f.viewport.scale = 4; f.state.finishRead();
    assert.equal(await pending, true); assert.equal(old.referenceImages.length, 0); const image = f.state.editing.referenceImages[0];
    assert.equal(f.selection.referenceImages[0], image); assert.equal(f.state.display.referenceImages.length, 0);
    await f.feature.prepareImages(); assert.equal(f.resources.length, 0);
    f.state.display = f.state.editing; f.state.hit = image; await f.feature.prepareImages(); assert.equal(f.resources.length, 1);
    f.feature.interaction.beginDrag({ pointerId:7 }, image, { x:0, y:0 }); f.feature.interaction.updateDrag({ x:2, y:3 }); f.feature.interaction.finishDrag({ pointerId:7 });
    assert.equal(image.x, 503); assert.equal(image.y, 255); assert.equal(f.feature.interaction.startCalibration(image), true);
    f.feature.interaction.calibrationClick({ x:image.x, y:image.y }); f.feature.layer.drawOverlays();
    f.feature.interaction.calibrationClick({ x:image.x+image.scale*10, y:image.y }); assert.ok(Math.abs(image.scale-2)<1e-12);
    f.feature.layer.drawImages(); f.state.hiddenSketch = 'S2'; const before = f.calls.filter(c=>c[0]==='drawImage').length;
    f.feature.layer.drawImages(); assert.equal(f.calls.filter(c=>c[0]==='drawImage').length, before);
    traces.push(JSON.stringify({ calls:f.calls, images:f.state.editing.referenceImages, selected:f.selection.referenceImages }));
  }
  assert.equal(traces[1], traces[0]);
});

test('reference-image owner assembly preserves constructor failure identity and deferred-import permission rejection', async () => {
  const order = ['renderer','layer','interaction','input'];
  for (const composed of [false, true]) {
    for (const failAt of order) {
      const probe = { failAt, error:new Error(failAt) };
      assert.throws(()=>ownerFixture(composed, probe), error=>error===probe.error); assert.deepEqual(probe.order, order.slice(0, order.indexOf(failAt)+1));
      assert.deepEqual(probe.calls, []); assert.equal(probe.state.ready, false); assert.equal(probe.state.editing.referenceImages.length, 0);
    }
    const f = ownerFixture(composed), pending = f.feature.input.importFile({ name:'plan.png', type:'image/png' });
    f.state.allowed = false; f.state.finishRead(); assert.equal(await pending, false);
    assert.equal(f.state.editing.referenceImages.length, 0); assert.equal(f.selection.referenceImages.length, 0);
    assert.deepEqual(f.calls.map(c=>c[0]), ['hint']); assert.equal(f.document.count(), 0);
  }
});
