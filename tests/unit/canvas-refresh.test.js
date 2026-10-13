const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/canvas_refresh.js'), 'utf8'), sandbox);
function fixture() {
  const calls = [], profiler = { active: false }, item = {};
  const state = { png: null, pending: null, mode: 'select', item, failure: null, panel: null, derived: null };
  state.panel = { update() { assert.equal(this, state.panel); calls.push('panel'); if (state.failure === 'panel') throw Error('panel'); } };
  state.derived = { selectedItem() { assert.equal(this, state.derived); calls.push('selection'); if (state.failure === 'selection') throw Error('selection'); return state.item; } };
  let refresh;
  const drawCanvas = () => { assert.equal(refresh.selectedItem, state.item || null); calls.push('canvas'); if (state.failure === 'canvas') throw Error('canvas'); return item; };
  refresh = sandbox.window.CanvasRefresh.create({ readPngCommand: () => state.png, readPending: () => state.pending, readMode: () => { calls.push('mode'); return state.mode; },
    readCommandPanel: () => state.panel, syncAnnotationInput: () => { calls.push('input'); if (state.failure === 'input') throw Error('input'); }, readDerivedPanel: () => state.derived,
    interactionProfiler: profiler, profileInteractionWork: (name, callback) => { assert.equal(name, 'draw'); calls.push('profile-enter'); try { return callback(); } finally { calls.push('profile-exit'); } },
    withGeometryReadCache: callback => { assert.equal(callback, drawCanvas); calls.push('cache-enter'); try { return callback(); } finally { calls.push('cache-exit'); } }, drawCanvas,
  });
  return { refresh, state, calls, profiler, item };
}
test('canvas refresh preserves UI/input/selection/profile/cache ordering and current panel selection snapshot', () => {
  const h = fixture(); assert.equal(h.refresh.selectedItem, null); assert.equal(h.refresh.draw(), h.item);
  assert.deepEqual(h.calls, ['panel', 'input', 'selection', 'cache-enter', 'canvas', 'cache-exit']); assert.equal(h.refresh.selectedItem, h.item);
  h.calls.length = 0; h.profiler.active = true; const next = {}; h.state.item = next; h.refresh.draw(); assert.equal(h.refresh.selectedItem, next);
  assert.deepEqual(h.calls, ['panel', 'input', 'selection', 'profile-enter', 'cache-enter', 'canvas', 'cache-exit', 'profile-exit']);
  h.calls.length = 0; h.state.item = null; h.state.panel = null; h.state.derived = null; h.refresh.draw(); assert.equal(h.refresh.selectedItem, null);
  assert.equal(h.calls.includes('panel'), false); assert.equal(h.calls.includes('selection'), false);
});
test('PNG cancellation precedes presentation refresh and retains busy/current session and mode short circuit', () => {
  for (const [active, busy, pending, mode, cancel, readMode] of [[true, false, null, 'select', true, false], [true, false, { type: 'png-export' }, 'select', true, true],
    [true, false, { type: 'png-export' }, 'png-export', false, true], [true, true, null, 'select', false, false], [false, false, null, 'select', false, false]]) {
    const h = fixture(); h.state.pending = pending; h.state.mode = mode;
    const command = { active, busy, cancel() { assert.equal(this, command); h.calls.push('cancel'); command.active = false; } }; h.state.png = command; h.refresh.draw();
    assert.equal(h.calls.includes('cancel'), cancel); assert.equal(h.calls.includes('mode'), readMode);
    if (cancel) assert.ok(h.calls.indexOf('cancel') < h.calls.indexOf('panel'));
  }
});
test('refresh failure preserves the last selection before assignment and original propagation/cache cleanup scope', () => {
  for (const failure of ['panel', 'input', 'selection', 'canvas']) {
    const h = fixture(); h.refresh.draw(); h.calls.length = 0; const next = {}; h.state.item = next; h.state.failure = failure; h.profiler.active = true;
    assert.throws(() => h.refresh.draw(), new RegExp(failure)); assert.equal(h.refresh.selectedItem, failure === 'canvas' ? next : h.item);
    if (failure === 'canvas') assert.deepEqual(h.calls.slice(-4), ['cache-enter', 'canvas', 'cache-exit', 'profile-exit']);
    else assert.equal(h.calls.includes('cache-enter'), false);
  }
});
