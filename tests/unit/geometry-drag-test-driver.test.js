const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/geometry_drag_test_driver.js'), 'utf8'), sandbox);

function fixture() {
  const calls = [], point = { id: 'P1', x: 10, y: 20 }, session = { sketchId: 'S2' };
  let scope = { points: [point] }, available = true, tick = 0, throws = false;
  const constraints = [{}], vector = [3, 4];
  const driver = sandbox.window.GeometryDragTestDriver.createPointDriver({
    currentScope: () => scope,
    buildDragSession: (kind, item, start) => { calls.push(['build', kind, item, { ...start }]); return available ? session : null; },
    attachLocalSolveContext: value => { assert.equal(value, session); calls.push(['attach']); },
    dragResultForSession: (value, target) => {
      assert.equal(value, session); calls.push(['preview', { ...target }]);
      if (throws) throw Error('preview failed');
      point.x = target.x; point.y = target.y;
      return { success: false, blocked: true, errorNorm: 0.1, acceptError: 0.2, iterations: 2, targetConstraints: [{}, {}] };
    },
    solveFinalDragSession: value => { assert.equal(value, session); calls.push(['final']); point.x = 99; return { success: true, errorNorm: 0, iterations: 3 }; },
    normalizeArcSweeps: () => calls.push(['normalize']),
    sketchSolveConstraints: id => { calls.push(['constraints', id]); return constraints; },
    computeErrorVector: value => { assert.equal(value, constraints); calls.push(['errors']); return vector; },
    vectorNorm: value => { assert.equal(value, vector); calls.push(['norm']); return 5; },
    targetConstraintCount: value => { assert.equal(value, session); calls.push(['count']); return 2; },
    now: () => ++tick,
  });
  return { driver, point, calls, setScope: value => { scope = value; }, unavailable: () => { available = false; }, fail: () => { throws = true; } };
}

test('single point drag delegates session identity and observes preview before final normalization', () => {
  const f = fixture(), result = f.driver.drag('P1', 2, -1);
  assert.deepEqual({ ...result.target }, { x: 12, y: 19 });
  assert.deepEqual({ ...result.preview.point }, { x: 12, y: 19 });
  assert.equal(result.final.point.x, 99); assert.equal(result.final.baseErrorNorm, 5);
  assert.equal(result.targetConstraintCount, 2);
  assert.deepEqual(f.calls.map(c => c[0]), ['build', 'attach', 'preview', 'final', 'normalize', 'constraints', 'errors', 'norm', 'count']);
  assert.equal(f.calls[0][2], f.point);
});

test('point path offsets remain relative to the original point and snapshots survive final solve', () => {
  const f = fixture(), result = f.driver.path('P1', [[2, -1], [-3, 4]]);
  assert.deepEqual(f.calls.filter(c => c[0] === 'preview'), [['preview', { x: 12, y: 19 }], ['preview', { x: 7, y: 24 }]]);
  assert.deepEqual({ ...result.startPoint }, { x: 10, y: 20 });
  assert.deepEqual({ ...result.previews[0].point }, { x: 12, y: 19 });
  assert.deepEqual({ ...result.previews[1].point }, { x: 7, y: 24 });
  assert.equal(result.previews[0].elapsedMs, 1); assert.equal(result.previews[1].targetConstraintCount, 2);
  assert.equal(result.previews[0].blocked, true); assert.equal(result.final.point.x, 99);
  assert.deepEqual(f.calls.slice(-5).map(c => c[0]), ['final', 'normalize', 'constraints', 'errors', 'norm']);
});

test('missing point and unavailable session retain null; preview errors stop without final solving', () => {
  const f = fixture(); f.setScope({ points: [] });
  assert.equal(f.driver.drag('P1', 1, 1), null); assert.equal(f.driver.path('P1', []), null);
  assert.deepEqual(f.calls, []);
  f.setScope({ points: [f.point] }); f.unavailable();
  assert.equal(f.driver.path('P1', []), null); assert.deepEqual(f.calls.map(c => c[0]), ['build']);
  const failed = fixture(); failed.fail();
  assert.throws(() => failed.driver.path('P1', [[1, 1]]), /preview failed/);
  assert.deepEqual(failed.calls.map(c => c[0]), ['build', 'attach', 'preview']);
});
