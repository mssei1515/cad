const assert = require('node:assert/strict'); const fs = require('node:fs');
const path = require('node:path'); const vm = require('node:vm'); const test = require('node:test');
function fixture() {
  const events = [], button = new EventTarget(), canvas = { width: 80, height: 60 };
  const state = { fileBusy: false, authoring: false, pending: null, constraint: null, mode: 'select', scale: 2, snap: null, images: [], flush: null };
  let resolveFonts, fontsRead;
  const fonts = new Promise(resolve => { resolveFonts = resolve; });
  const waitingForFonts = new Promise(resolve => { fontsRead = resolve; });
  const document = { fonts: { get ready() { events.push('fonts'); fontsRead(); return fonts; } }, getElementById: () => button,
    createElement(type) { assert.equal(type, 'canvas'); return { getContext: () => ({ drawImage(value) { assert.equal(value, canvas); events.push('copy'); } }), toBlob(callback) { events.push('blob'); callback({ type: 'image/png' }); } }; },
  };
  const sandbox = { window: {} }; vm.createContext(sandbox);
  for (const file of ['src/geometry/export_region.js', 'src/rendering/canvas_export.js', 'src/commands/png_export_command.js', 'src/persistence/document_files.js', 'src/persistence/png_file.js', 'src/application/png_export.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox);
  sandbox.window.showSaveFilePicker = async options => { events.push(['picker', options.suggestedName]); return { createWritable: async () => ({ write: async value => { assert.equal(value.type, 'image/png'); events.push('write'); }, close: async () => events.push('close') }) }; };
  const pending = { get current() { events.push('pending'); return state.pending; }, replace(value) { assert.equal(this, pending); state.pending = value; events.push('replace'); }, clear() { state.pending = null; events.push('clear'); } };
  const feature = sandbox.window.PngExport.create({ document, window: sandbox.window, canvas,
    rendering: { render(region, ratio) { events.push(['render', region.width, ratio.x]); }, restore() { events.push('restore'); } },
    text: (_ja, en) => en, documentName: () => 'drawing', prepareImages: async () => events.push(['images', state.images]),
    readViewScale: () => state.scale, readMode: () => { events.push('mode'); return state.mode; }, setMode: mode => { state.mode = mode; events.push(['mode', mode]); }, pendingCommandSession: pending,
    fileSession: { get busy() { events.push('file'); return state.fileBusy; } }, drawOperationLifecycle: { active() { events.push('authoring'); return state.authoring; } }, constraintTargetSession: { get command() { events.push('constraint'); return state.constraint; } },
    withGeometryReadCache: callback => { events.push('cache'); return callback(); }, findSnap: (point, tolerance) => { events.push(['snap', point.x, tolerance]); return state.snap; },
    flushPointerMove: () => { events.push('flush'); state.flush?.(); }, setHint: message => events.push(['hint', message]), draw: () => events.push('draw'),
  });
  assert.deepEqual(events, []);
  return { feature, state, events, button, canvas, resolveFonts, waitingForFonts };
}

test('PNG start flushes before live guards and preserves their short-circuit order', () => {
  for (const [field, value, expected] of [
    ['fileBusy', true, ['flush', 'file']], ['authoring', true, ['flush', 'file', 'authoring']],
    ['pending', {}, ['flush', 'file', 'authoring', 'pending']], ['constraint', {}, ['flush', 'file', 'authoring', 'pending', 'constraint']],
    ['mode', 'block-place', ['flush', 'file', 'authoring', 'pending', 'constraint', 'mode']],
  ]) {
    const f = fixture(); f.state[field] = value; f.feature.open();
    assert.equal(f.feature.command.active, false); assert.deepEqual(f.events.slice(0, -1), expected);
    assert.deepEqual(f.events.at(-1), ['hint', 'Finish or cancel the current operation before exporting PNG']);
  }
  const f = fixture(); f.state.fileBusy = true; f.state.flush = () => { f.state.fileBusy = false; };
  f.feature.open(); assert.equal(f.feature.command.active, true); assert.equal(f.state.mode, 'png-export');
  f.feature.command.cancel(); assert.equal(f.state.mode, 'select'); assert.equal(f.state.pending, null);
});

test('PNG feature start control binds once and can be disposed and restarted', () => {
  const f = fixture(); f.feature.start(); f.feature.start(); f.button.dispatchEvent(new Event('click'));
  assert.equal(f.events.filter(value => value === 'flush').length, 1);
  f.feature.command.cancel(); f.feature.dispose(); f.events.length = 0;
  f.button.dispatchEvent(new Event('click')); assert.deepEqual(f.events, []);
  f.feature.start(); f.button.dispatchEvent(new Event('click')); assert.equal(f.feature.command.active, true);
});

test('PNG composition keeps snapping, fonts-before-live-images, capture restoration and successful file completion', async () => {
  const f = fixture(); f.feature.open(); f.state.snap = { x: 1, y: 2 }; f.feature.command.pick({ x: 0, y: 0 });
  f.state.snap = null; f.feature.command.pick({ x: 11, y: 12 });
  assert.equal(f.events.some(value => Array.isArray(value) && value[0] === 'snap' && value[2] === 5), true);
  f.events.length = 0; const done = f.feature.command.onAction('finish'); await f.waitingForFonts;
  assert.equal(f.events.some(value => Array.isArray(value) && value[0] === 'images'), false);
  f.state.images = ['latest']; f.state.scale = 4; f.resolveFonts(); await done;
  assert.equal(f.feature.command.active, false); assert.equal(f.state.mode, 'select'); assert.equal(f.state.pending, null);
  assert.equal(f.canvas.width, 80); assert.equal(f.canvas.height, 60);
  const labels = f.events.map(value => Array.isArray(value) ? value[0] : value);
  for (const [a,b] of [['picker','fonts'], ['fonts','images'], ['images','render'], ['render','copy'], ['copy','restore'], ['restore','blob'], ['blob','write'], ['write','close']]) assert.ok(labels.indexOf(a) < labels.indexOf(b), a + ' before ' + b);
  assert.deepEqual(f.events.find(value => Array.isArray(value) && value[0] === 'images'), ['images', f.state.images]);
  assert.deepEqual(f.events.find(value => Array.isArray(value) && value[0] === 'render'), ['render', 10, 6.3]);
  assert.equal(f.events.some(value => Array.isArray(value) && value[0] === 'hint' && value[1] === 'PNG saved'), true);
});
