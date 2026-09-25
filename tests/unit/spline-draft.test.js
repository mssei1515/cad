const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['src/editing/geometry_ids.js', 'src/editing/spline_draft.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox);
}
function fixture() {
  let time = 0;
  const scope = { points: [{ id: 'P1', x: 0, y: 0 }] };
  const ids = sandbox.window.GeometryIds.create(); ids.reserve(scope);
  const used = new Set();
  const draft = sandbox.window.SplineDraft.create({ currentScope: () => scope, ids, now: () => time,
    samePosition: (a, b) => a.x === b.x && a.y === b.y, isPointUsedByPrimitive: point => used.has(point),
    endpointAt: (x, y) => {
      let point = scope.points.find(p => p.x === x && p.y === y);
      if (!point) { point = { id: ids.allocate('point'), x, y }; scope.points.push(point); }
      return point;
    },
  });
  return { scope, ids, used, draft, add: x => draft.add({ x, y: 0 }, { x, y: 0 }), advance: delta => { time += delta; } };
}
test('cancel restores initial points and point sequence, while reset keeps committed geometry', () => {
  const f = fixture(); f.draft.begin(); f.add(10); f.add(20);
  f.draft.cancel();
  assert.equal(f.scope.points.length, 1); assert.equal(f.ids.peek('point'), 2);
  f.draft.begin(); f.add(10); f.draft.reset(); f.draft.cancel();
  assert.equal(f.scope.points.length, 2); assert.equal(f.ids.peek('point'), 3);
});
test('Backspace preserves reused and referenced points, removing only unused draft points', () => {
  const f = fixture(); f.draft.begin(); f.add(0); f.draft.removeLast();
  assert.equal(f.scope.points.length, 1);
  f.add(10); f.used.add(f.draft.points[0]); f.draft.removeLast();
  assert.equal(f.scope.points.length, 2);
  f.add(20); f.draft.removeLast();
  assert.equal(f.scope.points.length, 2);
  assert.equal(f.ids.peek('point'), 4);
});
test('double-click removes its temporary point at inclusive time and distance limits', () => {
  const f = fixture(); f.draft.begin(); f.add(10); f.advance(650);
  assert.equal(f.draft.discardDoubleClick({ x: 18, y: 0 }, 8), true);
  assert.equal(f.scope.points.length, 1); assert.equal(f.ids.peek('point'), 3);
  f.add(0);
  assert.equal(f.draft.discardDoubleClick({ x: 0, y: 0 }, 8), true);
  assert.equal(f.scope.points.length, 1);
});
test('late or distant clicks are retained and consecutive duplicate points are rejected', () => {
  const f = fixture(); f.draft.begin(); f.add(10);
  assert.equal(f.add(10), false); assert.equal(f.draft.points.length, 1);
  f.advance(651); assert.equal(f.draft.discardDoubleClick({ x: 10, y: 0 }, 8), false);
  f.add(20); assert.equal(f.draft.discardDoubleClick({ x: 29, y: 0 }, 8), false);
  assert.equal(f.draft.points.length, 2);
});
