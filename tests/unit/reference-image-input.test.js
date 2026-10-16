const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function fixture() {
  const events = [], document = new EventTarget();
  const input = new EventTarget(), button = new EventTarget();
  input.value = ''; input.files = []; input.click = () => events.push('choose');
  const nodes = { referenceImageFileInput: input, importReferenceImageBtn: button };
  document.getElementById = id => nodes[id] || null;
  const state = { allowed: true, geometry: true, scope: { referenceImages: [] }, sketchId: 'S1', viewport: { scale: 2 }, copies: true };
  let resolvePreparation;
  const prepared = new Promise(resolve => { resolvePreparation = resolve; });
  const sandbox = { window: { ReferenceImageData: { REFERENCE_IMAGE_MAX_SIDE_PX: 4096 },
    ReferenceImageImport: { create: () => ({ prepare: file => { events.push(['prepare', file, input.value]); return prepared; } }) } } };
  vm.createContext(sandbox);
  for (const name of ['src/commands/reference_image_command.js', 'src/editing/image_clipboard.js', 'src/application/reference_image_input.js']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', name), 'utf8'), sandbox);
  }
  const feature = sandbox.window.ReferenceImageInput.create({ document, window: { navigator: {} }, applicationText: jp => jp,
    canvas: { getBoundingClientRect: () => ({ width: 1000, height: 500 }) }, viewport: state.viewport,
    screenToWorld: point => ({ x: point.x + 1, y: point.y + 2 }), currentScope: () => state.scope,
    activeSketchId: () => state.sketchId, nextId: () => 'RI1', canCreateInActiveSketch: () => state.allowed,
    clearSelection: () => events.push('clear'), canvasSelection: { set: (kind, items) => events.push(['select', kind, items[0]]) },
    updateUI: () => events.push('ui'), draw: () => events.push('draw'), recordHistory: label => events.push(['history', label]),
    setHint: (...args) => events.push(['hint', ...args]), pasteGeometry: () => { events.push('pasteGeometry'); return true; },
    copyGeometry: options => { events.push(['copyGeometry', options.cut]); return state.copies; },
    isGeometryMode: () => state.geometry, isTextEditingTarget: target => Boolean(target?.editing),
  });
  function finish() { resolvePreparation({ dataUrl: 'data:image/png;base64,AA==', mimeType: 'image/png', pixelWidth: 200, pixelHeight: 100, resized: false }); }
  return { feature, state, events, input, button, document, nodes, finish };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('file input clears before preparation and placement uses current scope, sketch and viewport after await', async () => {
  const f = fixture(); assert.deepEqual(f.events, []);
  f.feature.bindControls(); f.feature.bindControls(); f.button.dispatchEvent(new Event('click'));
  assert.deepEqual(f.events, ['choose']); f.events.length = 0;
  const file = { name: 'image.png', type: 'image/png' }; f.input.files = [file]; f.input.value = 'chosen';
  f.input.dispatchEvent(new Event('change')); assert.equal(f.events[0][1], file); assert.equal(f.events[0][2], '');
  const oldScope = f.state.scope; f.state.scope = { referenceImages: [] }; f.state.sketchId = 'S2'; f.state.viewport.scale = 4;
  f.finish(); await settle();
  assert.equal(oldScope.referenceImages.length, 0); const image = f.state.scope.referenceImages[0];
  assert.equal(image.sketchId, 'S2'); assert.equal(image.scale, 0.85); assert.equal(image.x, 501); assert.equal(image.y, 252);
  assert.equal(f.events[2][2], image); assert.deepEqual(f.events.slice(1, 5).map(e => Array.isArray(e) ? e[0] : e), ['clear', 'select', 'ui', 'draw']);
  assert.equal(f.events[5][0], 'history');
});

test('permission changes while image preparation awaits reject placement without history or selection changes', async () => {
  const f = fixture(), pending = f.feature.importFile({ name: 'image.png' });
  f.state.allowed = false; f.finish(); assert.equal(await pending, false);
  assert.equal(f.state.scope.referenceImages.length, 0); assert.deepEqual(f.events.map(e => e[0]), ['prepare', 'hint']);
  assert.equal(await f.feature.importFile(null), false);
});

test('native clipboard binding preserves geometry markers, text editing and cut routing across dispose and rebind', () => {
  const f = fixture(); f.feature.bindClipboard(); f.feature.bindClipboard();
  function dispatch(type, text = '', editing = false) {
    f.document.editing = editing; const event = new Event(type, { cancelable: true });
    event.clipboardData = { getData: () => text, setData: (kind, value) => f.events.push([kind, value]) };
    f.document.dispatchEvent(event); return event;
  }
  assert.equal(dispatch('paste', 'Jot2D internal selection').defaultPrevented, true);
  assert.equal(dispatch('paste', '', true).defaultPrevented, false);
  assert.equal(dispatch('cut').defaultPrevented, true);
  assert.deepEqual(f.events.map(e => Array.isArray(e) ? e[0] : e), ['pasteGeometry', 'copyGeometry', 'text/plain']);
  assert.equal(f.events[1][1], true);
  f.feature.dispose(); f.events.length = 0; dispatch('paste'); assert.deepEqual(f.events, []);
  f.feature.bindClipboard(); dispatch('paste'); assert.deepEqual(f.events, ['pasteGeometry']);
});

test('control disposal and rebinding tolerate absent controls and do not import empty file selections', async () => {
  const f = fixture(); f.feature.bindControls(); f.feature.dispose(); f.button.dispatchEvent(new Event('click')); assert.deepEqual(f.events, []);
  f.feature.bindControls(); f.input.dispatchEvent(new Event('change')); await settle(); assert.deepEqual(f.events, []);
  delete f.nodes.referenceImageFileInput; f.button.dispatchEvent(new Event('click')); assert.deepEqual(f.events, []);
  f.feature.dispose(); delete f.nodes.importReferenceImageBtn; f.feature.bindControls(); f.feature.dispose();
});
