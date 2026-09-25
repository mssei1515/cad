const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/canvas_navigation.js'), 'utf8'), sandbox);

function fixture() {
  let time = 0;
  const calls = [];
  const viewport = { x: 20, y: 40, canvasScreenPoint: e => ({ x: e.clientX, y: e.clientY }), update(patch) { Object.assign(this, patch); } };
  const canvas = {
    classList: { add: value => calls.push(['add', value]), remove: value => calls.push(['remove', value]) },
    setPointerCapture: id => calls.push(['capture', id]), releasePointerCapture: () => { throw new Error('already released'); },
  };
  const navigation = sandbox.window.CanvasNavigation.create({ canvas, viewport,
    now: () => time, draw: () => calls.push(['draw']), setHint: (...args) => calls.push(['hint', ...args]),
    fitVisibleGeometry: () => { calls.push(['fit']); return false; },
  });
  const event = (x = 5, y = 7, button = 1) => ({ clientX: x, clientY: y, button, pointerId: 3, preventDefault: () => calls.push(['prevent']) });
  return { navigation, viewport, calls, event, advance: delta => { time += delta; } };
}

test('pan displacement remains relative to its initial pointer and viewport', () => {
  const f = fixture();
  assert.equal(f.navigation.movePan({ x: 10, y: 10 }), false);
  f.navigation.beginPan(f.event());
  assert.equal(f.navigation.panning, true);
  f.navigation.movePan({ x: 15, y: 27 });
  assert.equal(f.viewport.x, 30);
  assert.equal(f.viewport.y, 60);
  f.navigation.movePan({ x: 25, y: 37 });
  assert.equal(f.viewport.x, 40);
  assert.equal(f.viewport.y, 70);
  assert.equal(f.navigation.endPan(f.event()), true);
  assert.equal(f.navigation.panning, false);
  assert.equal(f.navigation.endPan(f.event()), false);
});

test('middle double click accepts inclusive time and distance limits and consumes the pair', () => {
  const f = fixture();
  assert.equal(f.navigation.doubleClickFit(f.event()), false);
  f.advance(450);
  assert.equal(f.navigation.doubleClickFit(f.event(17, 7)), true);
  assert.equal(f.calls.filter(call => call[0] === 'fit').length, 1);
  assert.ok(f.calls.some(call => call[0] === 'hint' && call[2] === 'error'));
  assert.equal(f.navigation.doubleClickFit(f.event(17, 7)), false);
});

test('other buttons do not count and slow or distant middle clicks start a new pair', () => {
  const f = fixture();
  f.navigation.doubleClickFit(f.event(5, 7, 0));
  assert.equal(f.navigation.doubleClickFit(f.event()), false);
  f.advance(451);
  assert.equal(f.navigation.doubleClickFit(f.event()), false);
  assert.equal(f.navigation.doubleClickFit(f.event(18, 7)), false);
  assert.equal(f.navigation.doubleClickFit(f.event(18, 7)), true);
});

test('reset discards pan and click state without invoking viewport or UI callbacks', () => {
  const f = fixture();
  f.navigation.beginPan(f.event());
  f.navigation.doubleClickFit(f.event());
  const count = f.calls.length;
  f.navigation.reset();
  assert.equal(f.calls.length, count);
  assert.equal(f.navigation.panning, false);
  assert.equal(f.navigation.doubleClickFit(f.event()), false);
});
