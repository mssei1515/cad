const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.runInNewContext(fs.readFileSync('src/commands/annotation_drag.js', 'utf8'), sandbox);
function fixture() {
  const item = { id: 'AN1', x: 10, y: 20, start: { x: 0, y: 0 }, end: { x: 4, y: 5 }, elbow: { x: 2, y: 3 } }, state = { item }, events = [];
  const command = sandbox.window.AnnotationDrag.create({ annotationById: id => id === state.item?.id ? state.item : null,
    canvasSelection: { set: (_kind, items) => events.push(['select', items[0]]) }, beginPointer: id => events.push(['begin', id]), endPointer: id => events.push(['end', id]),
    setHint: text => events.push(['hint', text]), updateUI: () => events.push('ui'), draw: () => events.push('draw'), recordHistory: label => events.push(['history', label]) });
  return { command, item, state, events };
}
test('Leader drag uses the current identity and initial coordinates without moving its attached start', () => {
  const f = fixture(); f.command.begin({ pointerId: 1 }, { type: 'leader', element: f.item }, { x: 2, y: 3 });
  const replacement = f.state.item = { ...f.item }; f.command.update({ x: 5, y: 7 });
  assert.deepEqual([replacement.x, replacement.y, replacement.end.x, replacement.end.y, replacement.elbow.x, replacement.elbow.y], [13, 24, 7, 9, 5, 7]);
  assert.deepEqual(replacement.start, { x: 0, y: 0 }); assert.equal(f.item.x, 10);
  f.command.update({ x: 6, y: 8 }); assert.deepEqual([replacement.x, replacement.y], [14, 25]);
  assert.equal(f.events.some(e => e[0] === 'history'), false); assert.equal(f.command.inspect().elementId, 'AN1');
});
test('text drag falls back to its hit element and completion preserves update and history order', () => {
  const f = fixture(); f.command.begin({ pointerId: 2 }, { type: 'text', element: f.item }, { x: 0, y: 0 }); f.state.item = null;
  f.command.update({ x: -2, y: 5 }); assert.deepEqual([f.item.x, f.item.y], [8, 25]); assert.equal(f.item.end.x, 4);
  f.events.length = 0; assert.equal(f.command.finish({ pointerId: 2 }), true);
  assert.deepEqual(f.events.map(e => Array.isArray(e) ? e[0] : e), ['end', 'hint', 'ui', 'draw', 'history']);
  assert.equal(f.command.active, false); assert.equal(f.command.inspect(), null); assert.equal(f.command.finish({ pointerId: 2 }), false);
});
test('reset abandons a drag without committing and an unmoved completion still requests history', () => {
  const f = fixture(); f.command.begin({ pointerId: 1 }, { type: 'text', element: f.item }, { x: 0, y: 0 }); f.command.reset();
  f.command.update({ x: 9, y: 9 }); assert.equal(f.item.x, 10); assert.equal(f.command.active, false);
  assert.equal(f.events.some(e => e[0] === 'history'), false);
  f.command.begin({ pointerId: 1 }, { type: 'text', element: f.item }, { x: 0, y: 0 }); f.command.finish({ pointerId: 1 });
  assert.equal(f.events.filter(e => e[0] === 'history').length, 1);
});
