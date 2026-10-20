const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const { phase0DocumentFixture } = require("../fixtures/phase0-document");

const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["src/geometry/geometry_kernel.js", "src/geometry/geometry_ref.js", "src/geometry/spline_geometry.js", "src/solver/constraint_solver.js", "src/persistence/constraint_codec_registry.js", "src/document/appearance.js", "src/constraints/dimension_queries.js", "src/persistence/constraints.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
}
const geometry = sandbox.window.GeometrySolver;
const persistence = sandbox.window.ConstraintPersistence;
const codec = persistence.create({ geometryId: (item) => item.id, dimensionData: (constraint) => constraint.dimension || null });

function fixtureScope() {
  const fixture = phase0DocumentFixture();
  const points = new Map(fixture.points.map((p) => [p.id, new geometry.Point(p.id, p.x, p.y, p.fixed)]));
  const lines = new Map(fixture.lines.map((l) => [l.id, new geometry.Line(l.id, points.get(l.p1), points.get(l.p2))]));
  const primitives = new Map([
    ...fixture.circles.map((c) => [c.id, new geometry.Circle(c.id, points.get(c.center), c.radius)]),
    ...fixture.arcs.map((a) => [a.id, new geometry.Arc(a.id, points.get(a.center), a.radius, a.startAngle, a.endAngle)]),
  ]);
  return { fixture, maps: [points, lines, primitives] };
}

test("persistent constraint types round-trip the existing characterization fixture without a DOM", () => {
  const { fixture, maps } = fixtureScope();
  let count = 0;
  for (const saved of fixture.constraints) {
    if (saved.type === "pointOnLineMidpoint") continue;
    // Projection bundles are supplied by the application; tested separately below.
    if (Object.values(saved).some((value) => typeof value === "string" && value.includes("@"))) continue;
    const constraint = codec.deserialize(saved, ...maps);
    assert.ok(constraint, saved.type);
    const first = codec.serialize(constraint);
    const again = codec.serialize(codec.deserialize(first, ...maps));
    assert.equal(JSON.stringify(again), JSON.stringify(first), saved.type);
    assert.equal(first.type, saved.type);
    assert.equal(first.enabled, false);
    count++;
  }
  assert.ok(count >= 25);
});

test("constraint references resolve only inside explicitly supplied namespaces", () => {
  const first = fixtureScope().maps, second = fixtureScope().maps;
  const saved = { type: "distance", p1: "P1", p2: "P2", target: 100 };
  const a = codec.deserialize(saved, ...first), b = codec.deserialize(saved, ...second);
  assert.equal(a.p1, first[0].get("P1"));
  assert.equal(b.p1, second[0].get("P1"));
  assert.notEqual(a.p1, b.p1);
  first[0].set("BI1@P1", first[0].get("P1"));
  assert.equal(codec.deserialize({ ...saved, p1: "BI1@P1" }, ...first).p1, a.p1);
  assert.throws(() => codec.deserialize({ ...saved, p1: "BI1@P1" }, ...second), /見つかりません/);
});

test("dimension metadata retains read-only state, legacy loaders, and missing placement sentinels", () => {
  const maps = fixtureScope().maps;
  const data = { type: "distance", p1: "P1", p2: "P2", target: 100, parameterName: "d1", expression: "old", dimension: { x: 1, y: 2, display: { dimensionTextHeight: 10 } } };
  const constraint = codec.deserialize(data, ...maps, (value) => ({ ...value, dimensionTextHeight: 5 }), (value) => `converted:${value}`);
  assert.equal(constraint.expression, "converted:old");
  assert.equal(constraint.parameterName, "d1");
  assert.equal(constraint.dimension.display.dimensionTextHeight, 5);
  assert.ok(Number.isNaN(constraint.dimension.offsetU));
  assert.equal(data.dimension.display.dimensionTextHeight, 10);
  const reference = codec.deserialize({ ...data, readOnlyDimension: true, enabled: true }, ...maps);
  assert.equal(reference.enabled, false);
  assert.equal(reference.expression, undefined);
  assert.equal(persistence.isDimensionConstraint(reference), true);
});

test("unknown types stay distinct from malformed known constraints", () => {
  const maps = fixtureScope().maps;
  assert.equal(codec.deserialize({ type: "unknown" }, ...maps), null);
  assert.equal(codec.serialize({}), null);
  assert.throws(() => codec.deserialize({ type: "offsetChainDimension", sources: [], offsets: [] }, ...maps), /参照数/);
  assert.throws(() => codec.deserialize({ type: "geometryFixed", kind: "circle", geometry: "C1", x: 0, y: 0, radius: -1 }, ...maps), /Invalid fixed geometry/);
});


test('metadata decoration preserves data identity, field order and read-only versus expression fallback rules', () => {
  let numericCalls = 0;
  const metadata = persistence.createMetadata({ numericDimensionExpression: () => { numericCalls++; return '5'; } });
  const a = new geometry.Point('P1', 0, 0), b = new geometry.Point('P2', 5, 0), c = new geometry.DistanceConstraint(a, b, 5);
  const data = { type: 'distance', extension: { opaque: true } }, extension = data.extension;
  assert.equal(metadata.decorate(data, c), data); assert.equal(data.extension, extension);
  assert.deepEqual(Object.keys(data), ['type', 'extension', 'parameterName', 'expression']); assert.equal(data.parameterName, null); assert.equal(data.expression, '5'); assert.equal(numericCalls, 1);
  c.parameterName = 'd1'; c.expression = '"width"'; const named = metadata.decorate({}, c);
  assert.equal(named.parameterName, 'd1'); assert.equal(named.expression, '"width"'); assert.equal(numericCalls, 1);
  c.readOnlyDimension = true; const readOnly = { expression: 'opaque existing field' }; metadata.decorate(readOnly, c);
  assert.deepEqual(readOnly, { expression: 'opaque existing field', readOnlyDimension: true, parameterName: 'd1' }); assert.equal(numericCalls, 1);
  const ordinary = new geometry.HorizontalConstraint(new geometry.Line('L1', a, b)); const plain = { extension: true };
  assert.equal(metadata.decorate(plain, ordinary), plain); assert.deepEqual(plain, { extension: true });
  assert.equal(metadata.decorate(null, c), null); assert.equal(metadata.decorate(undefined, c), undefined); assert.equal(metadata.decorate(data, null), data);
});

test('snapshot metadata reads only the Document Sketch resolver and keeps Block field absence, references and raw values', () => {
  const events = [], raw = { type: 'opaque', extension: {} }, constraint = { sketchId: undefined, reference: true, referenceSketchId: '' };
  const metadata = persistence.createMetadata({ serializeConstraint: value => { assert.equal(value, constraint); events.push('serialize'); return { ...raw }; },
    numericDimensionExpression: () => { throw Error('not a dimension'); }, constraintSketchId: value => { assert.equal(value, constraint); events.push('sketch'); return 'DOCUMENT'; } });
  const unusedScope = new Proxy({}, { get() { throw Error('scope must not be read'); } });
  const doc = metadata.snapshotData(constraint, unusedScope, true);
  assert.equal(doc.sketchId, 'DOCUMENT'); assert.equal(doc.extension, raw.extension); assert.equal(doc.reference, true); assert.equal(doc.referenceSketchId, null);
  assert.deepEqual(Object.keys(doc), ['type', 'extension', 'sketchId', 'reference', 'referenceSketchId']); assert.deepEqual(events, ['serialize', 'sketch']);
  events.length = 0; const block = metadata.snapshotData(constraint, unusedScope, false);
  assert.equal(Object.hasOwn(block, 'sketchId'), true); assert.equal(block.sketchId, undefined); assert.deepEqual(events, ['serialize']);
  constraint.sketchId = 'LOCAL'; constraint.reference = false; const local = metadata.snapshotData(constraint, unusedScope, false);
  assert.equal(local.sketchId, 'LOCAL'); assert.equal(Object.hasOwn(local, 'reference'), false); assert.equal(Object.hasOwn(local, 'referenceSketchId'), false);
});

test('metadata construction is lazy and raw failure, unsupported types and numeric fallback retain their original stop points', () => {
  let ready = false, raw = null, fail = null, rawFailure = false; const calls = [], marker = new Error('numeric failed');
  const a = new geometry.Point('P1', 0, 0), b = new geometry.Point('P2', 5, 0), c = new geometry.DistanceConstraint(a, b, 5);
  const metadata = persistence.createMetadata({ serializeConstraint: value => { assert.equal(ready, true); calls.push('serialize'); if (rawFailure) throw marker; return raw; },
    numericDimensionExpression: () => { calls.push('numeric'); if (fail) throw fail; return '7'; }, constraintSketchId: () => { calls.push('sketch'); return 'S1'; } });
  assert.deepEqual(calls, []); ready = true; assert.equal(metadata.snapshotData(c, null, true), null); assert.deepEqual(calls, ['serialize']);
  rawFailure = true; calls.length = 0; assert.throws(() => metadata.snapshotData(c, null, true), error => error === marker); assert.deepEqual(calls, ['serialize']);
  rawFailure = false; raw = { type: 'distance' }; fail = marker; calls.length = 0;
  assert.throws(() => metadata.snapshotData(c, null, true), error => error === marker); assert.deepEqual(calls, ['serialize', 'numeric']);
  assert.equal(raw.parameterName, null); assert.equal(Object.hasOwn(raw, 'sketchId'), false);
  fail = null; c.expression = ''; calls.length = 0; assert.equal(metadata.snapshotData(c, null, true).expression, '7'); assert.deepEqual(calls, ['serialize', 'numeric', 'sketch']);
});

test('real Snapshot and raw codecs preserve separate Document and Block constraint metadata through JSON and decode', () => {
  const full = { structuredClone, window: {} }; vm.createContext(full);
  const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
  for (const file of sources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), full, { filename: file });
  const w = full.window, doc = w.DocumentState.create(), rootId = doc.activeSketchId, calls = [];
  const make = (sketchId, value) => { const a = Object.assign(new w.GeometrySolver.Point('P1', 0, 0), { sketchId }); const b = Object.assign(new w.GeometrySolver.Point('P2', value, 0), { sketchId }); return { points: [a,b], constraint: new w.GeometrySolver.DistanceConstraint(a,b,value) }; };
  const root = make(rootId, 5), local = make('LOCAL', 7); root.constraint.parameterName = 'd1'; root.constraint.expression = '"width"';
  Object.assign(local.constraint, { sketchId: 'LOCAL', readOnlyDimension: true, enabled: false, reference: true, referenceSketchId: 'SOURCE' });
  doc.points = root.points; doc.constraints = [root.constraint];
  doc.blockDefinitions = [{ ...w.DocumentState.create(), id: 'BD1', name: 'Part', points: local.points, constraints: [local.constraint], activeSketchId: 'LOCAL', sketches: [{ id: 'LOCAL', name: 'Local', kind: 'sketch' }] }];
  const rawCodec = w.ConstraintPersistence.create({ geometryId: item => item.id, dimensionData: constraint => constraint.dimension || null });
  const metadata = w.ConstraintPersistence.createMetadata({ serializeConstraint: rawCodec.serialize, numericDimensionExpression: c => String(c.target), constraintSketchId: c => { assert.equal(c, root.constraint); calls.push('root'); return rootId; } });
  const serializer = w.DocumentSnapshot.create({ geometryMetadata: item => ({ sketchId: item.sketchId, kind: 'explicit' }), constraintData: metadata.snapshotData });
  const before = JSON.stringify([root.constraint, local.constraint]);
  const data = JSON.parse(JSON.stringify(serializer.serialize(doc, { version: 22, savedAt: 'fixed', documentName: 'Drawing', nextHatchIndex: 1 })));
  assert.deepEqual(calls, ['root']);
  assert.equal(JSON.stringify(data.constraints[0]), JSON.stringify({ ...rawCodec.serialize(root.constraint), parameterName: 'd1', expression: '"width"', sketchId: rootId }));
  assert.equal(JSON.stringify(data.blockDefinitions[0].constraints[0]), JSON.stringify({ ...rawCodec.serialize(local.constraint), readOnlyDimension: true, parameterName: null, sketchId: 'LOCAL', reference: true, referenceSketchId: 'SOURCE' }));
  const decode = (record, points) => rawCodec.deserialize(record, new Map(points.map(point => [point.id, point])), new Map(), new Map());
  const rootRestored = decode(data.constraints[0], root.points), blockRestored = decode(data.blockDefinitions[0].constraints[0], local.points);
  assert.equal(rootRestored.p1, root.points[0]); assert.equal(rootRestored.parameterName, 'd1'); assert.equal(rootRestored.expression, '"width"');
  assert.equal(blockRestored.p1, local.points[0]); assert.equal(blockRestored.readOnlyDimension, true); assert.equal(blockRestored.enabled, false); assert.equal(blockRestored.expression, undefined);
  assert.equal(JSON.stringify([root.constraint, local.constraint]), before);
});
