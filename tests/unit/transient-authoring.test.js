const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/editing/geometry_ids.js', 'src/editing/transient_authoring.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox);
}
function fixture() {
  const scope = { points: [{ id: 'P1' }], lines: [], constraints: [] };
  const ids = sandbox.window.GeometryIds.create(); ids.reserve(scope);
  const calls = [], selection = { points: [], set(key, value) { this[key] = value; } };
  let time = 0, restoring = false;
  const service = sandbox.window.TransientAuthoring.create({ currentScope: () => scope, ids, selection,
    historySnapshot: () => { calls.push(['snapshot', scope.points.length]); return 'snapshot'; },
    documentHistory: { discardLatest: value => { calls.push(['discard', value]); return true; } },
    isHistoryRestoring: () => restoring, updateHistoryButtons: () => calls.push(['buttons']),
    invalidateAnalysis: () => calls.push(['invalidate']), now: () => time,
  });
  const addPoint = () => { const p = { id: ids.allocate('point') }; scope.points.push(p); return p; };
  return { service, scope, ids, selection, calls, addPoint, advance: n => { time += n; }, restoring: () => { restoring = true; } };
}
test('point rollback filters selection, restores IDs and discards the provisional history snapshot', () => {
  const f = fixture(); f.service.beginTransientPointRollback();
  const point = f.addPoint(); f.service.markCreatedPoint(point); f.scope.constraints.push({});
  f.selection.points = [f.scope.points[0], point];
  assert.equal(f.service.isPointHit(point), true); f.advance(651); assert.equal(f.service.isPointHit(point), false);
  assert.equal(f.service.rollbackTransientPoint(), true);
  assert.equal(f.scope.points.length, 1); assert.equal(f.scope.constraints.length, 0);
  assert.equal(f.selection.points.length, 1); assert.equal(f.ids.peek('point'), 2);
  assert.deepEqual(f.calls, [['snapshot', 2], ['invalidate'], ['discard', 'snapshot'], ['buttons']]);
  assert.equal(f.service.rollbackTransientPoint(), false);
});
test('line completion rollback includes the provisional starting point and restores both ID sequences', () => {
  const f = fixture(); f.service.beginTransientLineStartRollback(); const start = f.addPoint();
  assert.equal(f.service.isLineStartHit(start, start), true);
  f.service.beginTransientLineCompletionRollback(); const end = f.addPoint();
  const line = { id: f.ids.allocate('line') }; f.scope.lines.push(line);
  f.service.markCompletedLine(end, line); f.service.clearTransientLineStartRollback();
  f.advance(650); assert.equal(f.service.isLineCompletionHit(end, end), true);
  f.service.rollbackTransientLineCompletion();
  assert.equal(f.scope.points.length, 1); assert.equal(f.scope.lines.length, 0);
  assert.equal(f.ids.peek('point'), 2); assert.equal(f.ids.peek('line'), 1);
  assert.equal(f.service.hasLineStart, false); assert.equal(f.service.hasLineCompletion, false);
});
test('start rollback does not truncate a line that has already been added', () => {
  const f = fixture(); f.service.beginTransientLineStartRollback(); f.addPoint(); f.scope.lines.push({});
  f.service.rollbackTransientLineStart();
  assert.equal(f.scope.points.length, 2); assert.equal(f.service.hasLineStart, false);
  assert.deepEqual(f.calls, []);
});
test('history restoration suppresses history removal but still rolls back geometry', () => {
  const f = fixture(); f.service.beginTransientPointRollback(); f.addPoint(); f.restoring();
  f.service.rollbackTransientPoint(); assert.equal(f.scope.points.length, 1);
  assert.deepEqual(f.calls, [['snapshot', 2], ['invalidate']]);
});
