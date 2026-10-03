const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/canvas_input_binding.js'), 'utf8'), sandbox);
function fixture() {
  const calls = [], listeners = {}, status = { textContent: '' }; const record = name => (...args) => calls.push([name, ...args]);
  const binding = sandbox.window.CanvasInputBinding.create({ canvas: { addEventListener: (name, handler, options) => { listeners[name] = { handler, options }; } },
    pointer: Object.fromEntries(['down','move','finish','leave','doubleClick'].map(name => [name, record(name)])),
    scheduler: { flush: record('flush'), schedule: record('schedule') }, navigation: { zoom: record('zoom'), doubleClickFit: record('fit') },
    profileCommit: work => { calls.push(['profile']); return work(); }, closeContextMenu: record('close'), afterZoom: record('after'),
    screenToWorld: p => ({ x: p.x / 2, y: p.y / 2 }), formatCoordinate: (v, digits) => v.toFixed(digits), coordinateStatus: () => status });
  binding.bind(); return { binding, calls, listeners, status };
}
test('press, activation and completion flush before delegation and preserve original events', () => {
  const f = fixture(), event = {};
  for (const [name, target] of [['pointerdown','down'],['dblclick','doubleClick'],['pointerup','finish'],['pointercancel','finish']]) {
    f.calls.length = 0; f.listeners[name].handler(event);
    assert.equal(f.calls[0][0], 'flush'); assert.equal(f.calls.at(-1)[0], target); assert.equal(f.calls.at(-1)[1], event);
    assert.equal(f.calls.some(c => c[0] === 'profile'), target === 'finish');
  }
  f.calls.length = 0; f.listeners.pointerleave.handler(event); assert.deepEqual(f.calls, [['leave']]);
  f.calls.length = 0; f.listeners.pointermove.handler(event); assert.equal(f.calls[0][0], 'schedule'); assert.equal(f.calls[0][1], event);
});
test('wheel orders prevention, flush, menu closure, zoom and input synchronization', () => {
  const f = fixture(), event = { preventDefault: () => f.calls.push(['prevent']) };
  f.listeners.wheel.handler(event); assert.deepEqual(f.calls.map(c => c[0]), ['prevent','flush','close','zoom','after']);
  assert.equal(f.listeners.wheel.options.passive, false); assert.equal(f.calls[3][1], event);
  f.calls.length = 0; f.listeners.auxclick.handler({ button: 0 }); assert.deepEqual(f.calls, []);
  f.listeners.auxclick.handler({ ...event, button: 1 }); assert.deepEqual(f.calls.map(c => c[0]), ['prevent','fit']);
});
test('processed movement updates coordinates before forwarding screen, world and shift', () => {
  const f = fixture(); f.binding.processMove({ offsetX: 8, offsetY: 12, shiftKey: true });
  assert.equal(f.status.textContent, 'X 4.000 / Y 6.000'); assert.equal(f.calls[0][1].x, 8); assert.equal(f.calls[0][2].y, 6); assert.equal(f.calls[0][3], true);
  let writes = 0; Object.defineProperty(f.status, 'textContent', { get: () => 'X 4.000 / Y 6.000', set: () => writes++ });
  f.binding.processMove({ offsetX: 8, offsetY: 12 }); assert.equal(writes, 0);
});
