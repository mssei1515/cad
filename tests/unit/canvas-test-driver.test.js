const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/canvas_test_driver.js'), 'utf8'), sandbox);
function fixture() {
  const calls = [], state = { rect: { left: 5, top: 7, width: 200, height: 100 }, center: { x: 3, y: 4 } };
  const viewport = { scale: 1, update: values => { calls.push(['viewport', { ...values }]); Object.assign(viewport, values); } };
  const command = sandbox.window.CanvasTestDriver.create({ viewport,
    clampZoom: scale => { calls.push(['clamp', scale]); return Math.min(10, Math.max(0.1, scale)); },
    resizeCanvas: options => { calls.push(['resize', JSON.parse(JSON.stringify(options))]); state.center = options.centerWorld; },
    draw: () => { calls.push(['draw']); state.rect = { left: 11, top: 13, width: 300, height: 150 }; },
    canvas: { getBoundingClientRect: () => { calls.push(['rect']); return state.rect; } },
    currentCanvasCenterWorld: () => { calls.push(['center']); return state.center; },
    worldToCanvasScreen: point => { calls.push(['screen', { ...point }]); return { x: point.x * viewport.scale, y: point.y * viewport.scale }; },
  });
  return { command, calls, state, viewport };
}
test('focus clamps scale, preserves resize/draw order and reads display metadata after drawing', () => {
  const f = fixture(); const result = f.command.focus({ x: '4', y: 'bad' }, '20');
  assert.deepEqual(f.calls, [['clamp', 20], ['viewport', { scale: 10 }], ['resize', { centerWorld: { x: 4, y: 0 } }], ['draw'], ['rect'], ['center']]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { scale: 10, center: { x: 4, y: 0 }, canvas: { left: 11, top: 13, width: 300, height: 150 } });
});
test('focus retains existing zero and invalid numeric fallbacks without mutating supplied center', () => {
  const f = fixture(), center = { x: 0, y: '8' }; f.command.focus(center, 0);
  assert.equal(f.viewport.scale, 1); assert.deepEqual(center, { x: 0, y: '8' });
  assert.deepEqual(f.calls[2], ['resize', { centerWorld: { x: 0, y: 8 } }]);
});
test('client position reads the current rectangle and scale, normalizes inputs and produces no repaint', () => {
  const f = fixture(); f.viewport.scale = 2;
  assert.deepEqual({ ...f.command.clientPosition({ x: '3', y: 'bad' }) }, { x: 11, y: 7 });
  assert.deepEqual(f.calls, [['rect'], ['screen', { x: 3, y: 0 }]]);
  f.state.rect.left = 20; assert.equal(f.command.clientPosition(null).x, 20);
});
