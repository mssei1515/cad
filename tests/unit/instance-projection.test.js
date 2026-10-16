const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { structuredClone, window: {} };
vm.createContext(sandbox);
for (const file of ["src/geometry/geometry_kernel.js", "src/geometry/geometry_ref.js", "src/geometry/spline_geometry.js", "src/solver/constraint_solver.js", "src/geometry/objects.js", "src/geometry/pattern_instance_model.js", "src/geometry/instance_projection.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
}
const { Point, Line, Circle, Arc } = sandbox.window.GeometrySolver;
const { parseId: ref } = sandbox.window.GeometryRef;
const { geometryRefForItem, addGeometryBundleToMaps } = sandbox.window.GeometryObjects;
const createBase = () => sandbox.window.InstanceProjection.create({ elementSketchId: item => item.sketchId, applicationText: (_ja, en) => en });
const create = () => createBase();
const point = (id, x, y, sketchId = "S1") => Object.assign(new Point(id, x, y), { sketchId });
const free = (id, sources, fields = {}) => ({ id, type: "pattern", count: 2, occurrences: [""], placementPointDefined: true, placement: { kind: "linear" }, anchor: { relation: null, fallbackPosition: { x: 0, y: 0 } }, reflected: false, rotationLocked: false, sources, sketchId: "S1", x: 10, y: 20, rotation: 0, origin: { x: 0, y: 0 }, mirrorX: false, mirrorY: false, ...fields });
const scope = (points, instances, extra = {}) => ({ points, lines: [], circles: [], arcs: [], splines: [], geometryInstances: instances.map(i => { if (!i.placement && i.type !== "sketchProjection") { const n = sandbox.window.PatternInstanceModel.normalize(i); for (const k of Object.keys(i)) delete i[k]; Object.assign(i, n); } return i; }), ...extra });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('hatch-only mirror, pattern and chained free instances retain live boundaries and pattern transforms', () => {
  const a = point('P1', 0, 0), b = point('P2', 0, 10);
  const axis = Object.assign(new Line('L1', a, b), { sketchId: 'S1' });
  const hatch = { id: 'H1', sketchId: 'S1', seed: { x: 2, y: 3 }, boundaryLoops: [], appearance: { angle: 30, color: '#123456' } };
  let width = 5;
  const api = sandbox.window.InstanceProjection.create({ elementSketchId: item => item.sketchId, applicationText: (_ja, en) => en,
    resolveHatch: () => ({ ok: true, area: width * 2, loops: [{ role: 'outer', points: [{ x: 1, y: 2 }, { x: width, y: 2 }] }] }),
  });
  const mirror = { id: 'MI1', type: 'mirror', sources: [ref('hatch', 'H1')], axis: ref('line', 'L1'), sketchId: 'S1' };
  const pattern = { id: 'PI1', type: 'pattern', sources: [ref('hatch', 'MI1@H1')], direction: ref('line', 'L1'), sketchId: 'S1', copies: 2, spacing: 5 };
  const synced = free('FI1', [ref('hatch', 'PI1@2@MI1@H1')], { rotation: Math.PI / 2 });
  const bundles = api.geometryInstanceBundlesForScope(scope([a, b], [synced, pattern, mirror], { lines: [axis], hatches: [hatch] }));
  assert.ok(bundles.every(bundle => bundle.valid));
  assert.equal(bundles[2].lines.length, 0); assert.equal(bundles[2].hatches.length, 1);
  near(bundles[2].hatches[0].seed.x, -2); near(bundles[2].hatches[0].appearance.angle, 150);
  near(bundles[1].hatches[1].seed.y, 13);
  near(bundles[0].hatches[0].seed.x, -3); near(bundles[0].hatches[0].seed.y, 18);
  width = 9;
  near(bundles[2].hatches[0].resolvedBoundary.loops[0].points[1].x, -9);
  near(bundles[0].hatches[0].resolvedBoundary.area, 18);
  mirror.placement.axis = ref('line', 'missing');
  assert.equal(api.geometryInstanceBundlesForScope(scope([a, b], [mirror], { lines: [axis], hatches: [hatch] }))[0].valid, false);
});

test("derived points retain source identity, live transforms and the inverse mapping", () => {
  const api = create();
  const a = point("P1", 2, 3), b = point("P2", 6, 3);
  const line = Object.assign(new Line("L1", a, b), { sketchId: "S1" });
  const instance = free("FI1", [ref("line", "L1")], { rotation: Math.PI / 2, reflected: true });
  const bundle = api.geometryInstanceBundlesForScope(scope([a, b], [instance], { lines: [line] }))[0];
  assert.equal(bundle.valid, true);
  const output = bundle.lines[0];
  assert.equal(output.sourceElement, line);
  assert.equal(output.p1, bundle.points[0]);
  assert.equal(output.p1.sourceElement, a);
  near(output.p1.x, 7); near(output.p1.y, 18);
  const original = output.derivedInversePoint(output.p1);
  near(original.x, a.x); near(original.y, a.y);
  a.x = 5;
  near(output.p1.y, 15);
  instance.x = 30;
  near(output.p1.x, 27);
  assert.equal(output.p1, bundle.points[0], "Reads do not recreate projected geometry");
});

test("dependency resolution preserves input order and does not mix equal IDs across scopes", () => {
  const api = create();
  const first = free("FI1", [ref("point", "P1")]);
  const second = free("FI2", [ref("point", "FI1@P1")], { x: 100, y: 0 });
  const a = point("P1", 1, 2), b = point("P1", 50, 60);
  const bundles = api.geometryInstanceBundlesForScope(scope([a], [second, first]));
  assert.deepEqual(Array.from(bundles, bundle => bundle.instance.id), ["FI2", "FI1"]);
  assert.equal(bundles[0].points[0].x, 111);
  const other = api.geometryInstanceBundlesForScope(scope([b], [first]))[0];
  assert.equal(other.points[0].x, 60);
  assert.equal(bundles[1].points[0].x, 11);
  assert.equal(bundles[0].points[0].sourceElement, bundles[1].points[0]);
});

test("mirror and pattern transforms share points and preserve directional occurrences", () => {
  const api = create();
  const a = point("P1", 2, 3), b = point("P2", 0, 0), c = point("P3", 0, 10);
  const axis = Object.assign(new Line("L1", b, c), { sketchId: "S1" });
  const mirror = { id: "MI1", type: "mirror", sources: [ref("point", "P1")], axis: ref("line", "L1"), sketchId: "S1" };
  const pattern = { id: "PI1", type: "pattern", sources: [ref("point", "P1")], direction: ref("line", "L1"), sketchId: "S1", copies: 2, spacing: 5, reversed: true };
  const [mirrored, repeated] = api.geometryInstanceBundlesForScope(scope([a, b, c], [mirror, pattern], { lines: [axis] }));
  near(mirrored.points[0].x, -2); near(mirrored.points[0].y, 3);
  near(mirrored.points[0].derivedInversePoint(mirrored.points[0]).x, 2);
  assert.deepEqual(Array.from(repeated.points, p => [p.id, p.y]), [["PI1@1@P1", -2], ["PI1@2@P1", -7]]);
  near(repeated.points[1].derivedInversePoint(repeated.points[1]).y, 3);
});

test("invalid and cyclic references produce ordered invalid bundles without changing the scope", () => {
  const api = create();
  const a = point("P1", 0, 0);
  const axis = Object.assign(new Line("L1", a, a), { sketchId: "S1" });
  const instances = [free("FI1", []), free("FI2", [ref("point", "missing")]),
    free("FI3", [ref("point", "FI4@P1")]), free("FI4", [ref("point", "FI3@P1")]),
    { id: "MI1", type: "mirror", sources: [ref("point", "P1")], axis: ref("line", "L1"), sketchId: "S1" }];
  const document = scope([a], instances, { lines: [axis] });
  const before = JSON.stringify(document);
  const bundles = api.geometryInstanceBundlesForScope(document);
  assert.deepEqual(Array.from(bundles, bundle => bundle.valid), [false, false, false, false, false]);
  assert.equal(bundles[0].reason, "No source geometry");
  assert.equal(bundles[1].reason, "Missing or cyclic reference");
  assert.equal(bundles[4].reason, "Mirror axis is too short");
  assert.equal(JSON.stringify(document), before);
});

test("sketch projection requires an ancestor while other derived instances require the same sketch", () => {
  const api = create();
  const a = point("P1", 2, 3, "S1");
  const sketches = [{ id: "S1", parentSketchId: null }, { id: "S2", parentSketchId: "S1" }, { id: "S3", parentSketchId: null }];
  const projected = { id: "SPI1", type: "sketchProjection", sources: [ref("point", "P1")], sketchId: "S2" };
  const unrelated = { ...projected, id: "SPI2", sketchId: "S3" };
  const localOnly = free("FI1", [ref("point", "P1")], { sketchId: "S2" });
  const bundles = api.geometryInstanceBundlesForScope(scope([a], [projected, unrelated, localOnly], { sketches }));
  assert.equal(bundles[0].valid, true);
  assert.equal(bundles[1].reason, "Projection source is not in an ancestor sketch");
  assert.equal(bundles[2].reason, "Referenced geometry belongs to another sketch");
});

test("curve read views preserve live radii, reflected arc sweep, legacy IDs and canonical lookup identity", () => {
  const api = create();
  const center = point("P1", 0, 0);
  const circle = Object.assign(new Circle("C1", center, 3), { sketchId: "S1" });
  const arc = Object.assign(new Arc("A1", center, 3, 0, Math.PI / 2), { sketchId: "S1" });
  const instance = free("FI1", [ref("circle", "C1"), ref("arc", "A1")], { reflected: true, legacyOutput: { id: "OLD_C1", pointIds: ["OLD_P1"] } });
  const bundle = api.geometryInstanceBundlesForScope(scope([center], [instance], { circles: [circle], arcs: [arc] }))[0];
  assert.equal(bundle.circles[0].id, "OLD_C1");
  assert.equal(bundle.points[0].id, "OLD_P1");
  assert.equal(bundle.circles[0].center, bundle.arcs[0].center);
  near(bundle.arcs[0].endAngle - bundle.arcs[0].startAngle, -Math.PI / 2);
  circle.radiusValue = 7;
  assert.equal(bundle.circles[0].radius(), 7);
  const points = new Map(), lines = new Map(), primitives = new Map();
  addGeometryBundleToMaps(bundle, points, lines, primitives);
  assert.equal(points.get("OLD_P1"), bundle.points[0]);
  assert.equal(primitives.get("FI1@A1"), bundle.arcs[0]);
  assert.deepEqual(Array.from(geometryRefForItem(bundle.arcs[0]).path), ["FI1", "A1"]);
});

test('Instance source selection keeps collection order, original refs and identity dedup across selected/Block/derived bundles', () => {
  const calls = [], item = id => ({ id, sketchId: 'active' }), selected = item('selected'), sameId = item('selected'), hatch = item('hatch'), stale = item('stale'), blockLine = item('block-line'), blockHatch = item('block-hatch'), blockPoint = { ...item('block-point'), localElement: { kind: 'explicit' } }, skippedBlockPoint = { ...item('endpoint'), localElement: { kind: 'endpoint' } };
  const derivedLine = item('derived-line'), derivedPoint = { ...item('derived-point'), sourceElement: Object.assign(new Point('P', 1, 2), { kind: 'explicit' }) }, skippedDerived = { ...item('plain'), sourceElement: { kind: 'explicit' } };
  const block = {}, instance = {}, selection = { hatches: [hatch, stale], blockInstances: [block], geometryInstances: [instance] }, scope = { hatches: [hatch] };
  const bundle = fields => ({ lines: [], circles: [], arcs: [], splines: [], points: [], ...fields });
  const query = sandbox.window.InstanceProjection.createSourceSelection({ currentScope: () => scope, selectedGeometryItems: () => [selected, sameId], canvasSelection: selection,
    blockProjectionBundle: value => { assert.equal(value, block); calls.push('block'); return bundle({ lines: [blockLine, selected], hatches: [blockHatch], points: [blockPoint, skippedBlockPoint] }); },
    geometryInstanceBundle: value => { assert.equal(value, instance); calls.push('derived'); return bundle({ lines: [derivedLine, blockLine], points: [derivedPoint, skippedDerived] }); },
    elementSketchId: value => value.sketchId, activeSketchId: () => 'active', geometryRefForItem: value => ({ id: value.id }),
  });
  const before = JSON.stringify(selection), result = query.read(); assert.deepEqual(Array.from(result), [selected, sameId, hatch, blockLine, blockHatch, blockPoint, derivedLine, derivedPoint]);
  assert.deepEqual(calls, ['block', 'derived']); assert.equal(JSON.stringify(selection), before); assert.equal(scope.hatches[0], hatch);
});
test('Instance source selection reads current scope/selection/active target and rejects missing refs without new state', () => {
  const a = { id: 'a', sketchId: 'A' }, b = { id: 'b', sketchId: 'B' }, noRef = { id: 'x', sketchId: 'A', noRef: true }, hatch = { id: 'h', sketchId: 'A' };
  let active = 'A', items = [a, b, noRef], scope = { hatches: [hatch] }; const selection = { hatches: [hatch], blockInstances: [], geometryInstances: [] }, refs = [];
  const query = sandbox.window.InstanceProjection.createSourceSelection({ currentScope: () => scope, selectedGeometryItems: () => items, canvasSelection: selection,
    blockProjectionBundle: () => { throw Error('no Block selected'); }, geometryInstanceBundle: () => { throw Error('no Instance selected'); },
    elementSketchId: value => value.sketchId, activeSketchId: () => active, geometryRefForItem: value => { refs.push(value); return value.noRef ? null : { id: value.id }; },
  });
  assert.deepEqual(Array.from(query.read()), [a, hatch]); assert.equal(refs.includes(b), false);
  active = 'B'; scope = { hatches: [] }; items = [b]; assert.deepEqual(Array.from(query.read()), [b]);
  items = []; selection.hatches = []; assert.equal(query.read().length, 0);
});

test('drag source query collects shared geometry, Block and derived owners by identity in existing traversal order', () => {
  const p1 = point('P1', 0, 0), p2 = point('P2', 10, 0), p3 = point('P1', 20, 0);
  const projected = new Line('I1/L1', p1, p2), source = new Line('L1', p1, p3);
  const block = { id: 'BI1' }, derived = { id: 'I2' };
  projected.blockInstance = block; projected.derivedInstance = derived;
  const a = { kind: 'line', path: ['I1/L1'] }, b = { kind: 'line', path: ['L1'] }, missing = { kind: 'line', path: ['missing'] };
  const resolved = new Map([[a, projected], [b, source]]), calls = [];
  const query = sandbox.window.InstanceProjection.createDragSourceQuery({ geometryInstanceSourcePoints: create().geometryInstanceSourcePoints,
    geometryInstanceDependencyRefs: item => { assert.equal(item, derived); return [a, b]; },
    resolveGeometryRef: value => { calls.push(value); return resolved.get(value); },
  });
  const before = JSON.stringify({ projected, source, block, derived });
  const objects = query.sourceObjects({ sources: [a, missing, a] });
  assert.deepEqual(Array.from(objects), [projected, p1, p2, block, derived, source, p3]);
  assert.deepEqual(calls, [a, a, b, missing, a]);
  assert.equal(JSON.stringify({ projected, source, block, derived }), before);
  objects.clear(); resolved.set(a, source);
  assert.deepEqual(Array.from(query.sourceObjects({ sources: [a] })), [source, p1, p3]);
});

test('drag source query applies inverse transforms in chain order, clones pointer input and retains the resolved mapping', () => {
  const calls = [], source = {};
  const inner = { derivedProjection: true, derivedInstance: { type: 'sketchProjection' }, sourceElement: source,
    derivedInversePoint(p) { 'use strict'; assert.equal(this, undefined); calls.push('inner'); return { x: p.x * 2, y: p.y + 3 }; } };
  const outer = { derivedProjection: true, derivedInstance: { type: 'pattern' }, sourceElement: inner,
    derivedInversePoint(p) { 'use strict'; assert.equal(this, undefined); calls.push('outer'); p.x -= 10; return p; } };
  const query = sandbox.window.InstanceProjection.createDragSourceQuery({});
  const pointer = { x: 12, y: 4 }, hit = { item: outer };
  const result = query.resolve(hit, pointer);
  assert.equal(result.item, source); assert.equal(result.crossesSketchProjection, true);
  assert.deepEqual(result.pointer, { x: 4, y: 7 }); assert.deepEqual(pointer, { x: 12, y: 4 });
  assert.deepEqual(calls, ['outer', 'inner']);
  outer.derivedInversePoint = () => { throw new Error('new transform must not replace the captured chain'); };
  assert.deepEqual(result.mapPointer({ x: 15, y: 1 }), { x: 10, y: 4 });
  assert.equal(hit.item, outer); assert.equal(outer.sourceElement, inner);
});

test('drag source query rejects absent, unprojected, broken and cyclic chains before applying transforms', () => {
  const query = sandbox.window.InstanceProjection.createDragSourceQuery({});
  let transforms = 0;
  const a = { derivedProjection: true, derivedInversePoint: p => { transforms++; return p; } }, b = { ...a };
  a.sourceElement = b; b.sourceElement = a;
  for (const hit of [null, { item: {} }, { item: { derivedProjection: true } },
    { item: { derivedProjection: true, sourceElement: {}, derivedInversePoint: null } }, { item: a }]) {
    assert.equal(query.resolve(hit, { x: 1, y: 2 }), null);
  }
  assert.equal(transforms, 0);
});
