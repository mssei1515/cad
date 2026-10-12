const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { structuredClone, window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/document/appearance.js', 'src/editing/geometry_ids.js', 'src/geometry/synchronized_instance.js', 'src/editing/clipboard_geometry.js']) {
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

test('Block materialization preserves drawing intent and owns detached copied values with explicit target IDs', () => {
  const calls = []; let sequence = 3;
  const api = sandbox.window.ClipboardGeometry.create({
    blockDefinitionById: id => { calls.push(id); return { id }; }, allocateBlockInstanceId: () => 'BI' + sequence++,
  });
  const source = { id: 'old', definitionId: 'BD1', x: 2, y: 3, rotation: 0.7, fixed: true, rotationLocked: true,
    enabledSketchIds: ['S1', 'S2'], appearanceOverride: { color: '#123456' } };
  const before = structuredClone(source), existing = { id: 'BI1' }, model = { blockInstances: [existing] }, ids = new Map();
  const result = api.appendBlocks(model, { blockInstances: [source] }, 'S9', 10, -4, ids);
  assert.deepEqual(calls, ['BD1']); assert.equal(model.blockInstances[0], existing); assert.equal(result[0], model.blockInstances[1]);
  const instance = result[0]; assert.equal(instance.id, 'BI3'); assert.equal(ids.get('old'), 'BI3'); assert.equal(instance.sketchId, 'S9');
  assert.equal(instance.x, 12); assert.equal(instance.y, -1); assert.equal(instance.rotation, 0.7);
  assert.equal(instance.fixed, true); assert.equal(instance.rotationLocked, true); assert.equal(instance.definitionId, 'BD1');
  instance.enabledSketchIds.push('changed'); instance.appearanceOverride.color = '#abcdef'; assert.deepEqual(source, before);
});

test('missing Block definition fails before allocating its ID and leaves earlier appends to the enclosing rollback', () => {
  let allocated = 0;
  const api = sandbox.window.ClipboardGeometry.create({ blockDefinitionById: id => id === 'valid' ? {} : null,
    allocateBlockInstanceId: () => 'BI' + ++allocated });
  const model = { blockInstances: [] }, ids = new Map();
  assert.throws(() => api.appendBlocks(model, { blockInstances: [
    { id: 'first', definitionId: 'valid', x: 0, y: 0, enabledSketchIds: [] },
    { id: 'second', definitionId: 'missing' },
  ] }, 'S1', 0, 0, ids), /missing/);
  assert.equal(allocated, 1); assert.equal(model.blockInstances.length, 1); assert.equal(ids.get('first'), 'BI1'); assert.equal(ids.has('second'), false);
});

test('derived creation reserves all owners and legacy paths before normalizing or adding copied instances', () => {
  const transfer = { structuredClone, window: {} }; vm.createContext(transfer);
  vm.runInContext(fs.readFileSync('src/editing/clipboard_transfer.js', 'utf8'), transfer);
  const { copiedGeometryInstance } = transfer.window.ClipboardTransfer.create({});
  const ids = new Map([['L1', 'L9']]), calls = [], model = { geometryInstances: [] };
  const api = sandbox.window.ClipboardGeometry.create({ allocateGeometryInstanceId: type => { calls.push(type); return type === 'free' ? 'FI9' : 'MI9'; },
    copiedGeometryInstance, normalizeGeometryInstance: item => { assert.equal(ids.get('legacy'), 'MI9@FI9@L9'); calls.push(item.id); return item; }, applicationText: (_ja, en) => en });
  const source = { parameterNamespaceKey: 'document', geometryInstances: [
    { id: 'FI1', type: 'free', sources: [{ kind: 'line', path: ['L1'] }], origin: { x: 0, y: 0 }, x: 2, y: 3, appearanceOverride: {} },
    { id: 'MI1', type: 'mirror', sources: [{ kind: 'line', path: ['FI1', 'L1'] }], axis: { kind: 'line', path: ['L1'] },
      projection: { lines: [{ id: 'legacy', path: ['MI1', 'FI1', 'L1'] }] }, appearanceOverride: {} },
  ] };
  const before = JSON.stringify(source);
  const result = api.appendDerived(model, source, 'S2', 10, -4, ids, 'document');
  assert.deepEqual(calls, ['free', 'mirror', 'FI9', 'MI9']); assert.equal(model.geometryInstances[0], result[0]);
  assert.equal(result[0].x, 12); assert.equal(result[0].y, -1); assert.equal(result[1].sketchId, 'S2');
  assert.deepEqual(plain(result[1].sources[0].path), ['FI9', 'L9']); assert.equal(result[1].projection, undefined);
  assert.equal(JSON.stringify(source), before);
});

test('derived creation rejects cross-namespace external references after reservation but before model additions', () => {
  let allocated = 0, normalized = 0;
  const api = sandbox.window.ClipboardGeometry.create({ allocateGeometryInstanceId: () => 'FI' + ++allocated,
    normalizeGeometryInstance: item => { normalized++; return item; }, copiedGeometryInstance: item => item,
    applicationText: (_ja, en) => en });
  const model = { geometryInstances: [] }, ids = new Map();
  const payload = { parameterNamespaceKey: 'document', geometryInstances: [{ id: 'old', type: 'free', sources: [{ kind: 'line', path: ['external'] }] }] };
  assert.throws(() => api.appendDerived(model, payload, 'S1', 0, 0, ids, 'block:BD1'), /another namespace/);
  assert.equal(allocated, 1); assert.equal(normalized, 0); assert.equal(model.geometryInstances.length, 0); assert.equal(ids.get('old'), 'FI1');
  api.appendDerived(model, payload, 'S1', 0, 0, ids, 'document'); assert.equal(normalized, 1); assert.equal(model.geometryInstances.length, 1);
});
