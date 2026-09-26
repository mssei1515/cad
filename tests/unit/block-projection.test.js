const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const root = path.resolve(__dirname, "../..");
const sandbox = { window: {} };
vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync(path.join(root, "index.html"), "utf8").match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(source => source.startsWith("src/"))) vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), sandbox, { filename: file });
const { Point, Line, Circle } = sandbox.window.GeometrySolver;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
const point = (id, x, y) => Object.assign(new Point(id, x, y), { sketchId: "S1" });
function definition(id) {
  const a = point("P1", 1, 0), b = point("P2", 4, 0);
  const line = Object.assign(new Line("L1", a, b), { sketchId: "S1" });
  return { id, revision: 1, sketches: [{ id: "ROOT", kind: "root" }, { id: "S1" }, { id: "S2" }], points: [a, b], lines: [line], circles: [], arcs: [], splines: [], annotations: [], hatches: [], blockInstances: [], geometryInstances: [] };
}
const instance = (id, definitionId, fields = {}) => ({ id, definitionId, sketchId: "S1", x: 10, y: 20, rotation: 0, ...fields });
function services(definitions) {
  const catalog = sandbox.window.BlockCatalog.create({ definitions });
  const derived = sandbox.window.InstanceProjection.create({ elementSketchId: item => item.sketchId, applicationText: (_ja, en) => en });
  const hatchPrimitivesFromElements = elements => elements.flatMap(item => {
    if (item instanceof Line) return [{ kind: "line", id: item.id, p1: item.p1, p2: item.p2 }];
    if (item instanceof Circle) return [{ kind: "circle", id: item.id, center: item.center, radius: item.radius() }];
    return [];
  });
  const projection = sandbox.window.BlockProjection.create({ blockCatalog: catalog, ...derived, hatchPrimitivesFromElements, hatchPrimitivesForScope: scope => hatchPrimitivesFromElements(scope.lines) });
  return { catalog, projection };
}

test("rigid projection Jacobians match dense evaluation through nested and derived geometry", () => {
  const { Constraint, ConstraintSolver, CoincidentConstraint, PointOnLineConstraint } = sandbox.window.GeometrySolver;
  const child = definition("child"), parent = definition("parent");
  parent.points = []; parent.lines = [];
  parent.blockInstances = [instance("nested", "child", { x: 3, y: 4, rotation: 0.2 })];
  parent.geometryInstances = [{ id: "MI1", type: "mirror", sketchId: "S1",
    sources: [{ kind: "line", path: ["nested", "L1"] }], axis: { kind: "line", path: ["nested", "L1"] } }];
  const { projection } = services(() => [parent, child]);
  const outer = instance("outer", "parent", { rotation: 0.4 });
  const free = point("free", 12, 25), unrelated = point("unrelated", 100, 200);
  const variables = [outer, free, unrelated].flatMap(object => ["x", "y"].map(prop => ({ object, prop })));
  variables.push({ object: outer, prop: "rotation" });
  const solver = new ConstraintSolver({ points: [free, unrelated], lines: [], circles: [], arcs: [], constraints: [] });
  const check = () => {
    const bundle = projection.blockProjectionBundle(outer);
    assert.equal(bundle.lines.length, 2);
    for (const line of bundle.lines) for (const constraint of [new CoincidentConstraint(line.p1, free), new PointOnLineConstraint(free, line)]) {
      const dense = new Constraint("dense reference", 1);
      dense.rawError = () => constraint.rawError();
      const errors = solver.computeErrorVectorForConstraints([constraint]);
      const actual = solver.computeJacobianForConstraints(variables, errors, [constraint]);
      const expected = solver.computeJacobianForConstraints(variables, errors, [dense]);
      actual.forEach((row, i) => row.forEach((value, j) => {
        assert.ok(Math.abs(value - expected[i][j]) < 1e-6, `${line.id} row ${i} column ${j}: ${value} != ${expected[i][j]}`);
      }));
      assert.ok(actual.some(row => Math.abs(row[6]) > 0.1), "outer rotation must participate");
    }
  };
  check();
  child.points[0].x += 2;
  parent.revision += 1;
  projection.invalidateBlockProjectionCache();
  check();
});

test("external differentiation neither scans definition contents nor evaluates unrelated variables", () => {
  const { ConstraintSolver, CoincidentConstraint } = sandbox.window.GeometrySolver;
  const source = definition("B1");
  const { projection } = services(() => [source]);
  const block = instance("BI1", source.id);
  const projected = projection.blockProjectionBundle(block).points[0];
  // A definition can contain arbitrarily many objects. Visiting even this
  // sentinel while differentiating an external constraint is a regression.
  source.constraints = new Proxy([], { ownKeys() { throw Error("external solve traversed the definition"); } });
  const fixed = point("fixed", projected.x, projected.y);
  const constraint = new CoincidentConstraint(projected, fixed);
  let calls = 0;
  const raw = constraint.rawError.bind(constraint);
  constraint.rawError = () => { calls++; return raw(); };
  const solver = new ConstraintSolver({ points: [], lines: [], circles: [], arcs: [], constraints: [] });
  const vars = ["x", "y", "rotation"].map(prop => ({ object: block, prop }));
  const errors = solver.computeErrorVectorForConstraints([constraint]);
  calls = 0;
  const first = solver.computeJacobianForConstraints(vars, errors, [constraint]);
  const baselineCalls = calls;
  const unrelated = Array.from({ length: 100 }, (_, i) => ({ object: point(`U${i}`, i, i), prop: "x" }));
  calls = 0;
  const expanded = solver.computeJacobianForConstraints([...vars, ...unrelated], errors, [constraint]);
  assert.equal(calls, baselineCalls);
  expanded.forEach((row, i) => {
    assert.deepEqual(Array.from(row.slice(0, 3)), Array.from(first[i]));
    assert.ok(row.slice(3).every(value => value === 0));
  });
  fixed.x += 6;
  fixed.y -= 2;
  const result = solver.solveSubset({ variables: vars, constraints: [constraint] });
  assert.equal(result.success, true);
  assert.ok(Math.hypot(projected.x - fixed.x, projected.y - fixed.y) < 1e-4);
});

test("catalog follows registry replacement and preserves enabled-sketch fallback through nested definitions", () => {
  const leaf = definition("B1"), parent = definition("B2");
  parent.lines = []; parent.points = [];
  parent.blockInstances = [instance("BI1", "B1", { sketchId: "S2" })];
  let registry = [leaf, parent];
  const { catalog } = services(() => registry);
  assert.deepEqual(Array.from(catalog.blockDefinitionDrawableSketchIds(parent)), ["S1", "S2"]);
  assert.deepEqual(Array.from(catalog.blockDefinitionGeometrySketchIds(parent)), ["S2"]);
  assert.deepEqual(Array.from(catalog.blockInstanceEnabledSketchSet(instance("BI2", "B2", { enabledSketchIds: ["missing"] }))), ["S2"]);
  registry = [definition("B1")];
  assert.equal(catalog.blockDefinitionById("B1"), registry[0]);
  assert.equal(catalog.blockDefinitionById("B2"), null);
  assert.equal(catalog.hasHatches(), false);
  registry[0].hatches.push({ id: "H1" });
  assert.equal(catalog.hasHatches(), true);
});

test("a sketch containing only a derived projection can be the sole enabled block sketch", () => {
  const source = definition("B1");
  source.sketches[1].parentSketchId = "ROOT";
  source.sketches[2].parentSketchId = "S1";
  source.geometryInstances = [{ id: "SPI1", type: "sketchProjection", sketchId: "S2", sources: [{ kind: "line", path: ["L1"] }], appearanceOverride: {} }];
  const { catalog, projection } = services(() => [source]);
  assert.equal(catalog.blockDefinitionHasGeometry(source), true);
  assert.deepEqual(Array.from(catalog.blockDefinitionGeometrySketchIds(source)), ["S1", "S2"]);
  const block = instance("BI1", source.id, { enabledSketchIds: ["S2"] });
  assert.deepEqual(Array.from(catalog.blockInstanceEnabledSketchSet(block)), ["S2"]);
  const bundle = projection.blockProjectionBundle(block);
  assert.equal(bundle.lines.length, 1);
  assert.equal(bundle.lines[0].id, "BI1@SPI1@L1");
});

test("projection cache preserves live point reads and refreshes only on its existing invalidation inputs", () => {
  const source = definition("B1");
  const { projection } = services(() => [source]);
  const block = instance("BI1", source.id);
  const first = projection.blockProjectionBundle(block);
  assert.equal(projection.blockProjectionBundle(block), first);
  block.x = 30; source.points[0].x = 2;
  assert.equal(first.lines[0].p1.x, 32);
  assert.equal(projection.blockProjectionBundle(block), first);
  source.revision += 1;
  const revised = projection.blockProjectionBundle(block);
  assert.notEqual(revised, first);
  block.sketchId = "S2";
  const relocated = projection.blockProjectionBundle(block);
  assert.notEqual(relocated, revised);
  assert.equal(relocated.lines[0].sketchId, "S2");
  block.enabledSketchIds = ["S2"];
  assert.equal(projection.blockProjectionBundle(block).lines.length, 0);
  assert.equal(projection.blockAllProjectionBundle(block).lines.length, 1);
  const beforeInvalidation = projection.blockProjectionBundle(block);
  const other = instance("BI2", source.id);
  const otherBundle = projection.blockProjectionBundle(other);
  projection.invalidateBlockProjectionCache(block.id);
  assert.notEqual(projection.blockProjectionBundle(block), beforeInvalidation);
  assert.equal(projection.blockProjectionBundle(other), otherBundle);
  const beforeClear = projection.blockProjectionBundle(block);
  projection.invalidateBlockProjectionCache();
  assert.notEqual(projection.blockProjectionBundle(block), beforeClear);
});

test("nested transforms retain canonical paths, local object identity and the outer owner", () => {
  const leaf = definition("leaf"), parent = definition("parent");
  parent.points = []; parent.lines = [];
  const nested = instance("child", "leaf", { x: 5, y: 0 });
  parent.blockInstances = [nested];
  const { projection } = services(() => [parent, leaf]);
  const outer = instance("outer", "parent", { rotation: Math.PI / 2 });
  const bundle = projection.blockProjectionBundle(outer);
  const line = bundle.lines[0];
  assert.equal(line.id, "outer@child@L1");
  assert.equal(line.blockInstance, outer);
  assert.equal(line.blockDefinition, leaf);
  assert.equal(line.localElement, leaf.lines[0]);
  assert.equal(bundle.pointByLocalId.get("child@P1"), line.p1);
  near(line.p1.x, 10); near(line.p1.y, 26);
  nested.x = 7;
  near(line.p1.y, 28);
});

test("temporary loader resolvers and derived instances use the supplied definition graph", () => {
  const stored = definition("child"), loaded = definition("child"), parent = definition("parent");
  stored.points[0].x = 100;
  parent.points = []; parent.lines = [];
  parent.blockInstances = [instance("nested", "child", { x: 0, y: 0 })];
  parent.geometryInstances = [{ id: "FI1", type: "free", sketchId: "S1", sources: [sandbox.window.GeometryRef.parseId("line", "nested@L1")], x: 5, y: 0, rotation: 0, origin: { x: 0, y: 0 }, mirrorX: false, mirrorY: false }];
  const { projection } = services(() => [parent, stored]);
  const bundle = projection.createBlockProjectionBundle(instance("outer", "parent", { x: 0, y: 0 }), parent, null, { definitionResolver: id => id === "child" ? loaded : parent });
  const direct = bundle.lines.find(line => line.id === "outer@nested@L1");
  const derived = bundle.lines.find(line => line.id === "outer@FI1@nested@L1");
  assert.equal(direct.p1.x, 1);
  assert.equal(derived.p1.x, 6);
  assert.equal(stored.points[0].x, 100);
});

test("missing and cyclic definitions terminate without leaking a prior cached bundle", () => {
  const source = definition("B1");
  source.blockInstances.push(instance("self", "B1"));
  let registry = [source];
  const { projection } = services(() => registry);
  const block = instance("BI1", "B1");
  assert.equal(projection.blockProjectionBundle(block).lines.length, 1);
  registry = [];
  assert.equal(projection.blockProjectionBundle(block).lines.length, 0);
  assert.equal(projection.blockAllProjectionBundle(block).points.length, 0);
});

test("annotation projection preserves geometry references, transforms and outer appearance overrides", () => {
  const source = definition("B1");
  source.annotations = [{ id: "AN1", type: "text", sketchId: "S1", text: "Note", x: 2, y: 3, rotation: 0, style: { color: "#112233" }, geometryRef: sandbox.window.GeometryRef.parseId("line", "L1") }];
  const { projection } = services(() => [source]);
  const block = instance("BI1", "B1", { rotation: Math.PI / 2, appearanceOverride: { color: "#ff0000" } });
  const projected = projection.blockProjectionBundle(block).annotations[0];
  assert.equal(projected.id, "BI1/AN1");
  assert.deepEqual(Array.from(projected.geometryRef.path), ["BI1", "L1"]);
  near(projected.x, 7); near(projected.y, 22); near(projected.rotation, Math.PI / 2);
  assert.equal(projected.style.color, "#ff0000");
  assert.equal(source.annotations[0].style.color, "#112233");
  assert.equal(projected.localElement, source.annotations[0]);
});

test("cached block hatch projections follow instance translation and rotation", () => {
  const source = definition("B1");
  const center = point("PC1", 2, 3);
  const circle = Object.assign(new Circle("C1", center, 2), { sketchId: "S1" });
  source.points.push(center);
  source.lines = [];
  source.circles = [circle];
  source.hatches = [{
    id: "H1",
    sketchId: "S1",
    seed: { x: 2, y: 3 },
    boundaryLoops: [{ spans: [{ source: { kind: "circle", path: ["C1"] }, fullLoop: true }] }],
    appearance: { patternType: "solid", angle: 10, color: "#112233", visible: true, spacing: 2, lineWidth: 1, opacity: 1 },
  }];
  const { projection } = services(() => [source]);
  const block = instance("BI1", source.id, { x: 10, y: 20, rotation: 0 });
  const first = projection.blockProjectionBundle(block);
  const hatch = first.hatches[0];
  assert.equal(projection.blockProjectionBundle(block), first);
  near(hatch.resolvedBoundary.loops[0].points[0].x, 14);
  near(hatch.resolvedBoundary.loops[0].points[0].y, 23);
  near(hatch.seed.x, 12);
  near(hatch.seed.y, 23);
  near(hatch.patternOrigin.x, 10);
  near(hatch.patternOrigin.y, 20);
  near(hatch.appearance.angle, 10);

  block.x = 30;
  block.y = 40;
  block.rotation = Math.PI / 2;
  assert.equal(projection.blockProjectionBundle(block), first);
  near(hatch.resolvedBoundary.loops[0].points[0].x, 27);
  near(hatch.resolvedBoundary.loops[0].points[0].y, 44);
  near(hatch.seed.x, 27);
  near(hatch.seed.y, 42);
  near(hatch.patternOrigin.x, 30);
  near(hatch.patternOrigin.y, 40);
  near(hatch.appearance.angle, 100);
});
