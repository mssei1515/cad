const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const { phase0DocumentFixture } = require("../fixtures/phase0-document");

const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["geometry_kernel.js", "geometry_ref.js", "spline_geometry.js", "constraint_solver.js", "constraint_codec_registry.js", "src/document/appearance.js", "src/persistence/constraints.js"]) {
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
