const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.runInNewContext(fs.readFileSync('src/commands/annotation_drag.js', 'utf8'), sandbox);
test('multiple free texts use shared displacement, current identities and one history entry', () => {
  const items = [{ id: 'AN1', type: 'text', x: 10, y: 20 }, { id: 'AN2', type: 'text', x: -5, y: 7 }];
  const selection = { annotations: items, set: (kind, value) => { selection[kind] = value; } };
  const current = new Map(items.map(item => [item.id, item]));
  let commits = 0;
  const command = sandbox.window.AnnotationDrag.create({ annotationById: id => current.get(id), canvasSelection: selection,
    beginPointer() {}, endPointer() {}, setHint() {}, updateUI() {}, draw() {}, recordHistory() { commits++; } });
  command.begin({ pointerId: 1 }, { type: 'text', element: items[0] }, { x: 2, y: 3 });
  current.set('AN2', { ...items[1] });
  command.update({ x: 5, y: 7 });
  command.update({ x: 6, y: 8 });
  assert.deepEqual([items[0].x, items[0].y, current.get('AN2').x, current.get('AN2').y], [14, 25, -1, 12]);
  assert.equal(items[1].x, -5);
  assert.equal(selection.annotations.length, 2);
  command.finish({ pointerId: 1 });
  assert.equal(commits, 1);
});
function fixture(scale = 1) {
  const item = { id: 'AN1', x: 10, y: 20, start: { x: 0, y: 0 }, end: { x: 4, y: 5 }, elbow: { x: 2, y: 3 } }, state = { item }, events = [];
  const command = sandbox.window.AnnotationDrag.create({ annotationLeaderDisplayGeometry: element => ({ ...element, shelfScale: scale }), annotationById: id => id === state.item?.id ? state.item : null,
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

test('shelf resizing converts display delta, crosses zero, preserves anchors and commits once', () => {
  for (const scale of [0.5, 1, 4]) {
    const f = fixture(scale);
    f.item.end.y = f.item.elbow.y;
    const original = JSON.parse(JSON.stringify(f.item));
    f.command.begin({ pointerId: 1 }, { type: 'leader', part: 'end', element: f.item }, { x: 9, y: 3 });
    for (const dx of [-2 * scale, -10 * scale, 5 * scale]) {
      f.command.update({ x: 9 + dx, y: 99 });
      assert.equal(f.item.end.x, original.end.x + dx / scale);
      assert.equal(f.item.end.y, original.elbow.y);
      assert.deepEqual(f.item.elbow, original.elbow); assert.deepEqual(f.item.start, original.start);
      assert.equal(f.item.x, original.x + dx / scale / 2); assert.equal(f.item.y, original.y);
    }
    f.command.finish({ pointerId: 1 });
    assert.equal(f.events.filter(e => e[0] === 'history').length, 1);
    assert.equal(f.events.find(e => e[0] === 'history')[1], '引出線横棒長さ変更');
  }
});

test('whole leader drag converts display displacement at non-unit annotation scale', () => {
  const f = fixture(0.5), original = JSON.parse(JSON.stringify(f.item));
  f.command.begin({ pointerId: 1 }, { type: 'leader', part: 'line', element: f.item }, { x: 10, y: 20 });
  f.command.update({ x: 15, y: 17 });
  assert.equal(f.item.elbow.x, original.elbow.x + 10); assert.equal(f.item.elbow.y, original.elbow.y - 6);
  assert.equal(f.item.end.x, original.end.x + 10); assert.equal(f.item.end.y, original.end.y - 6);
  assert.equal(f.item.x, original.x + 10); assert.equal(f.item.y, original.y - 6);
  assert.deepEqual(f.item.start, original.start);
});
