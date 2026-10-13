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

test('geometry path preserves line reference, fraction clamping and initial-relative previews', () => {
  const line = { id: 'L1', p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 }, length: () => 10 };
  const session = { sketchId: 'S1', lineDragPoint: { point: { id: 'P2' } } }, calls = [];
  let tick = 0;
  const status = { stable: true };
  const driver = sandbox.window.GeometryDragTestDriver.createGeometryDriver({
    currentScope: () => ({ lines: [line] }),
    buildDragSession: (kind, item, start) => { assert.equal(item, line); calls.push(['build', kind, { ...start }]); return session; },
    attachLocalSolveContext: value => assert.equal(value, session),
    dragResultForSession: (value, target) => { assert.equal(value, session); calls.push(['preview', { ...target }]); line.p1.x = target.x; return { success: false, blocked: true, guidedSubstepCount: 0 }; },
    solveFinalDragSession: () => { calls.push(['final']); line.p1.x = 50; return { success: true }; },
    normalizeArcSweeps: () => calls.push(['normalize']),
    sketchSolveConstraints: id => { assert.equal(id, 'S1'); return []; }, computeErrorVector: () => [0], vectorNorm: () => 0,
    now: () => ++tick, readConstraintStatuses: () => { calls.push(['status', line.p1.x]); return status; },
  });
  const result = driver.path({ kind: 'line', id: 'L1', fraction: 3, inspectConstraints: true }, [[2, 0], [-1, 0]]);
  assert.deepEqual(calls.slice(0, 5), [['build', 'line', { x: 10, y: 0 }], ['preview', { x: 12, y: 0 }], ['status', 12], ['preview', { x: 9, y: 0 }], ['status', 9]]);
  assert.equal(result.startState.p1.x, 0); assert.equal(result.previews[0].state.p1.x, 12);
  assert.equal(result.previews[1].state.p1.x, 9); assert.equal(result.final.state.p1.x, 50);
  assert.equal(result.previews[0].constraintState, status); assert.equal(result.previews[0].elapsedMs, 1);
  assert.equal(result.previews[0].radialObjective, false); assert.equal(result.representativePointId, 'P2');
  assert.deepEqual(calls.slice(-2), [['final'], ['normalize']]);
});

test('arc endpoint unavailable session preserves endpoint wrapper and initial snapshot without solving', () => {
  const arc = { id: 'A1', center: { x: 1, y: 2 }, radius: () => 3 }, calls = [];
  const end = { x: 4, y: 5 }, start = { x: 6, y: 7 };
  const driver = sandbox.window.GeometryDragTestDriver.createGeometryDriver({
    currentScope: () => ({ arcs: [arc] }),
    arcEndpointPoint: (item, endpoint) => { assert.equal(item, arc); calls.push(['endpoint', endpoint]); return endpoint === 'end' ? end : start; },
    buildDragSession: (kind, item, pointer) => { assert.equal(kind, 'arc-endpoint'); assert.equal(item.arc, arc); assert.equal(item.endpoint, 'end'); assert.equal(pointer, end); calls.push(['build']); return null; },
    attachLocalSolveContext: () => { throw Error('unexpected solve context'); },
  });
  assert.equal(driver.path({ kind: 'arc-endpoint', id: 'missing' }, []), null);
  const result = driver.path({ kind: 'arc-endpoint', id: 'A1', endpoint: 'end' }, []);
  assert.equal(result.sessionAvailable, false); assert.equal(result.startPointer, end);
  assert.equal(result.startState.draggedEndpoint, result.startState.end); assert.equal(result.final, null);
  assert.deepEqual(calls, [['endpoint', 'end'], ['build'], ['endpoint', 'start'], ['endpoint', 'end']]);
});
