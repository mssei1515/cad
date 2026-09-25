const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.runInNewContext(fs.readFileSync('src/commands/selection_rectangle.js', 'utf8'), sandbox);
function fixture() {
  const events = [], state = { scale: 2 };
  const command = sandbox.window.SelectionRectangle.create({
    rectFromPoints: (a, b) => ({ x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y), x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y) }),
    hypot2: Math.hypot, viewScale: () => state.scale, releasePointer: id => events.push(['release', id]), clearSelection: () => events.push('clear'),
    selectByRect: (...args) => events.push(['select', ...args]), addSketchProjectionSourcesByRect: (...args) => events.push(['projection', ...args]),
    setHint: text => events.push(['hint', text]), updateGeometrySelectionUI: () => events.push('ui'), draw: () => events.push('draw') });
  return { command, events, state };
}
test('rectangle selection preserves crossing direction, additive choice and update order', () => {
  const f = fixture(); f.command.begin({ x: 10, y: 10 }, { additive: true }); f.command.update({ x: 1, y: 2 });
  const preview = f.command.preview(); assert.equal(preview.crossing, true); assert.deepEqual(preview.rect, { x1: 1, y1: 2, x2: 10, y2: 10 });
  assert.equal(f.command.finish({ pointerId: 4 }), true); assert.equal(f.command.active, false);
  assert.deepEqual(f.events[1], ['select', preview.rect, true, true]);
  assert.deepEqual(f.events.map(e => Array.isArray(e) ? e[0] : e), ['release', 'select', 'hint', 'ui', 'draw']);
  assert.equal(f.command.finish({ pointerId: 4 }), false);
});
test('a movement at the click threshold clears only non-additive selection', () => {
  for (const additive of [true, false]) {
    const f = fixture(); f.command.begin({ x: 0, y: 0 }, { additive }); f.command.update({ x: 1.5, y: 0 }); f.command.finish({ pointerId: 1 });
    assert.equal(f.events.includes('clear'), !additive); assert.equal(f.events.some(e => e[0] === 'select'), false);
  }
});
test('projection rectangles delegate source selection without ordinary selection updates', () => {
  const f = fixture(); f.command.begin({ x: 0, y: 0 }, { kind: 'sketch-projection' }); f.command.update({ x: 5, y: 4 });
  f.command.finish({ pointerId: 2 }); assert.deepEqual(f.events.map(e => e[0]), ['release', 'projection']); assert.equal(f.events[1][2], false);
  f.events.length = 0; f.command.begin({ x: 0, y: 0 }, { kind: 'sketch-projection' }); f.command.finish({ pointerId: 2 });
  assert.deepEqual(f.events, [['release', 2], 'draw']);
});
test('rectangle reset discards state and preview values do not mutate the session', () => {
  const f = fixture(); f.command.begin({ x: 0, y: 0 }, { current: { x: 8, y: 5 } });
  f.command.preview().rect.x2 = 99; assert.equal(f.command.preview().rect.x2, 8);
  f.command.reset(); f.command.update({ x: 1, y: 1 }); assert.equal(f.command.active, false); assert.equal(f.command.preview(), null); assert.deepEqual(f.events, []);
});
