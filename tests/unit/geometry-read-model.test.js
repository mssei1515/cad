const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["src/geometry/geometry_ref.js", "src/geometry/read_model.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
}
const bundle = values => ({ points: [], lines: [], circles: [], arcs: [], splines: [], annotations: [], hatches: [], ...values });
const scope = values => ({ ...bundle(), blockInstances: [], geometryInstances: [], ...values });
function harness(initialScope, { derived = [], hasHatches = false } = {}) {
  let current = initialScope;
  const counts = { prepare: 0, block: 0, derived: 0, profile: 0 };
  const reader = sandbox.window.GeometryReadModel.create({
    currentScope: () => current,
    prepareBlocks: () => { counts.prepare++; },
    blockProjections: { blockProjectionBundle: instance => { counts.block++; return instance.bundle; } },
    instanceProjections: {
      geometryInstanceBundlesForScope: (suppliedScope, blocks) => { counts.derived++; assert.equal(suppliedScope, current); assert.equal(blocks.length, current.blockInstances.length); return derived; },
      emptyGeometryInstanceBundle: instance => ({ ...bundle(), instance, valid: false }),
    },
    hasBlockHatches: () => hasHatches,
    profileRead: read => { counts.profile++; return read(); },
  });
  return { reader, counts, switchScope: value => { current = value; reader.clearReadCache(); } };
}

test("one synchronous read window shares expanded arrays, object identities and nested reads", () => {
  const local = { id: "P1" }, projected = { id: "BI1@P1" }, derivedPoint = { id: "FI1@P1" };
  const instance = { id: "FI1" };
  const derived = bundle({ instance, valid: true, points: [derivedPoint] });
  const { reader, counts } = harness(scope({ points: [local], blockInstances: [{ bundle: bundle({ points: [projected] }) }] }), { derived: [derived] });
  let first;
  reader.withGeometryReadCache(() => {
    first = reader.allGeometryPoints();
    assert.deepEqual(Array.from(first), [local, projected, derivedPoint]);
    reader.withGeometryReadCache(() => assert.equal(reader.allGeometryPoints(), first));
    assert.equal(reader.allGeometryPoints(), first);
    assert.equal(reader.geometryInstanceBundle(instance), derived);
    assert.equal(reader.geometryElementFromKey("point:BI1@P1"), projected);
    assert.deepEqual(counts, { prepare: 1, block: 1, derived: 1, profile: 3 });
  });
  reader.withGeometryReadCache(() => {
    assert.notEqual(reader.allGeometryPoints(), first);
    assert.equal(reader.allGeometryPoints()[0], local);
  });
  assert.deepEqual(counts, { prepare: 2, block: 2, derived: 2, profile: 6 });
});

test("appearance memoization is private to a read window and exceptions always release it", () => {
  const { reader } = harness(scope());
  const item = { id: "L1" }, appearance = { color: "#ff0000" };
  reader.cacheAppearance(item, appearance);
  assert.equal(reader.readAppearance(item), undefined);
  const failure = new Error("draw failed");
  assert.throws(() => reader.withGeometryReadCache(() => {
    reader.cacheAppearance(item, appearance);
    assert.equal(reader.readAppearance(item), appearance);
    reader.withGeometryReadCache(() => assert.equal(reader.readAppearance(item), appearance));
    throw failure;
  }), error => error === failure);
  assert.equal(reader.readAppearance(item), undefined);
  reader.withGeometryReadCache(() => assert.equal(reader.readAppearance(item), undefined));
});

test("explicit scope invalidation releases geometry and appearance views with equal IDs", () => {
  const a = { id: "P1", x: 1 }, b = { id: "P1", x: 2 };
  const { reader, switchScope } = harness(scope({ points: [a] }));
  reader.withGeometryReadCache(() => {
    assert.equal(reader.geometryElementFromKey("point:P1"), a);
    reader.cacheAppearance(a, { color: "#ffffff" });
    switchScope(scope({ points: [b] }));
    assert.equal(reader.geometryElementFromKey("point:P1"), b);
    assert.equal(reader.readAppearance(a), undefined);
  });
  assert.equal(reader.resolveGeometryRef(sandbox.window.GeometryRef.parseId("point", "P1")), b);
});

test("hatch-free documents skip Block expansion, while annotations and hatch projections preserve order", () => {
  const empty = harness(scope());
  assert.deepEqual(Array.from(empty.reader.allHatches()), []);
  assert.equal(empty.counts.prepare, 0);
  const localHatch = { id: "H1" }, projectedHatch = { id: "BI1/H1" };
  const localAnnotation = { id: "AN1" }, projectedAnnotation = { id: "BI1/AN1" };
  const { reader } = harness(scope({ hatches: [localHatch], annotations: [localAnnotation], blockInstances: [{ bundle: bundle({ hatches: [projectedHatch], annotations: [projectedAnnotation] }) }] }));
  assert.deepEqual(Array.from(reader.allHatches()), [localHatch, projectedHatch]);
  assert.deepEqual(Array.from(reader.allAnnotations()), [localAnnotation, projectedAnnotation]);
  const definitionOnly = harness(scope({ blockInstances: [{ bundle: bundle({ hatches: [projectedHatch] }) }] }), { hasHatches: true });
  assert.deepEqual(Array.from(definitionOnly.reader.allHatches()), [projectedHatch]);
});

test("reference lookups include splines while the legacy primitive list remains circle and arc only", () => {
  const line = { id: "L1" }, circle = { id: "C1" }, arc = { id: "A1" }, spline = { id: "SP1" };
  const { reader } = harness(scope({ lines: [line], circles: [circle], arcs: [arc], splines: [spline] }));
  reader.withGeometryReadCache(() => {
    assert.deepEqual(Array.from(reader.allGeometryPrimitives()), [circle, arc]);
    assert.equal(reader.geometryElementFromKey("spline:SP1"), spline);
    assert.equal(reader.geometryElementFromKey("line:L1"), line);
    assert.equal(reader.geometryElementFromKey("line:missing"), null);
    assert.equal(reader.geometryElementFromKey("invalid"), null);
  });
});
