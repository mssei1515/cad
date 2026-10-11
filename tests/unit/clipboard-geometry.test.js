const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/document/appearance.js', 'src/editing/geometry_ids.js', 'src/editing/clipboard_geometry.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}
const plain = value => JSON.parse(JSON.stringify(value));
const scope = () => ({ points: [], lines: [], circles: [], arcs: [], splines: [] });
function fixture() {
  const ids = sandbox.window.GeometryIds.create();
  const calls = [];
  const api = sandbox.window.ClipboardGeometry.create({ geometryIds: ids,
    ensureLineMinimumLength: line => calls.push(line), normalizeArcSweep: arc => calls.push(arc) });
  return { ids, calls, api };
}

test('clipboard primitives reconnect shared points by identity, retain source values and target ownership', () => {
  const { ids, calls, api } = fixture(), model = scope();
  const existing = new sandbox.window.GeometrySolver.Point('P1', 100, 100);
  model.points.push(existing); ids.reserve(model);
  const payload = {
    points: [{ id: 'old1', x: 2, y: 3, fixed: false, kind: 'endpoint', appearance: { color: '#123456' } },
      { id: 'old2', x: 8, y: 9, fixed: false, kind: 'explicit' }],
    lines: [{ id: 'oldL', p1: 'old1', p2: 'old2', construction: true }],
    circles: [{ id: 'oldC', center: 'old1', radius: 5, construction: false }],
    arcs: [{ id: 'oldA', center: 'old1', radius: 6, startAngle: 0, endAngle: 1, construction: true }],
    splines: [{ id: 'oldS', fitPoints: ['old1', 'old2'], closed: false, construction: false }],
  };
  const before = structuredClone(payload);
  const maps = api.append(model, payload, 'S2', 10, -4);
  const point = maps.pointById.get(maps.idMap.get('old1'));
  assert.equal(point, model.points[1]); assert.equal(model.points[0], existing);
  assert.equal(point.x, 12); assert.equal(point.y, -1); assert.equal(point.kind, 'endpoint');
  assert.equal(model.lines[0].p1, point); assert.equal(model.circles[0].center, point);
  assert.equal(model.arcs[0].center, point); assert.equal(model.splines[0].fitPoints[0], point);
  assert.equal(maps.lineById.get(maps.idMap.get('oldL')), model.lines[0]);
  for (const kind of ['circles', 'arcs', 'splines']) assert.equal(maps.primitiveById.get(model[kind][0].id), model[kind][0]);
  for (const item of [...model.points.slice(1), ...model.lines, ...model.circles, ...model.arcs, ...model.splines]) assert.equal(item.sketchId, 'S2');
  assert.equal(model.lines[0].construction, true); assert.equal(model.arcs[0].construction, true);
  assert.deepEqual(calls, [model.lines[0], model.arcs[0]]);
  point.appearance.color = '#abcdef'; assert.deepEqual(payload, before);
});

test('missing spline points leave partial appends for the enclosing paste rollback, without creating the spline', () => {
  const { ids, api } = fixture(), model = scope();
  const checkpoint = ids.snapshot();
  const payload = { points: [{ id: 'p', x: 0, y: 0 }], lines: [], circles: [], arcs: [],
    splines: [{ id: 'broken', fitPoints: ['p', 'missing'] }] };
  assert.throws(() => api.append(model, payload, 'S1', 0, 0), /broken/);
  assert.equal(model.points.length, 1); assert.equal(model.splines.length, 0);
  assert.equal(ids.peek('point'), 2); assert.equal(ids.peek('spline'), 1);
  model.points.length = 0; ids.restore(checkpoint);
  assert.deepEqual(plain(ids.snapshot()), plain(checkpoint));
});

test('legacy payloads may omit splines and keep the point-kind fallback', () => {
  const { api } = fixture(), model = scope();
  api.append(model, { points: [{ id: 'p', x: 0, y: 1, kind: 'unknown' }], lines: [], circles: [], arcs: [] }, 'S3', 0, 0);
  assert.equal(model.points[0].kind, 'explicit'); assert.equal(model.splines.length, 0);
});
