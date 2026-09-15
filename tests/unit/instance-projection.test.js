const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["src/geometry/geometry_kernel.js", "src/geometry/geometry_ref.js", "src/geometry/spline_geometry.js", "src/solver/constraint_solver.js", "src/geometry/objects.js", "src/geometry/instance_projection.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
}
const { Point, Line, Circle, Arc } = sandbox.window.GeometrySolver;
const { parseId: ref } = sandbox.window.GeometryRef;
const { geometryRefForItem, addGeometryBundleToMaps } = sandbox.window.GeometryObjects;
const create = () => sandbox.window.InstanceProjection.create({ elementSketchId: item => item.sketchId, applicationText: (_ja, en) => en });
const point = (id, x, y, sketchId = "S1") => Object.assign(new Point(id, x, y), { sketchId });
const free = (id, sources, fields = {}) => ({ id, type: "free", sources, sketchId: "S1", x: 10, y: 20, rotation: 0, origin: { x: 0, y: 0 }, mirrorX: false, mirrorY: false, ...fields });
const scope = (points, instances, extra = {}) => ({ points, lines: [], circles: [], arcs: [], splines: [], geometryInstances: instances, ...extra });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test("derived points retain source identity, live transforms and the inverse mapping", () => {
  const api = create();
  const a = point("P1", 2, 3), b = point("P2", 6, 3);
  const line = Object.assign(new Line("L1", a, b), { sketchId: "S1" });
  const instance = free("FI1", [ref("line", "L1")], { rotation: Math.PI / 2, mirrorX: true });
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
  const instance = free("FI1", [ref("circle", "C1"), ref("arc", "A1")], { mirrorX: true, legacyOutput: { id: "OLD_C1", pointIds: ["OLD_P1"] } });
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
