const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["src/geometry/geometry_kernel.js", "src/geometry/spline_geometry.js", "src/solver/constraint_solver.js", "src/constraints/references.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
}
const { Point, Line, Arc, Spline, DistanceConstraint, ArcEndpointCoincidentConstraint, PointOnSplineConstraint, SketchProjectionConstraint, OffsetChainConstraint } = sandbox.window.GeometrySolver;
const create = sandbox.window.ConstraintReferences.create;

test("line dependencies preserve point identity and recognize either distance endpoint order", () => {
  const queries = create({ resolveGeometryRef: () => null });
  const p = new Point("P1", 0, 0), q = new Point("P2", 10, 0);
  const c = new DistanceConstraint(p, q, 10);
  assert.equal(queries.constraintReferencesLine(c, new Line("L1", q, p)), true);
  assert.equal(queries.constraintReferencesPoint(c, new Point("P1", 0, 0)), false);
  assert.deepEqual(Array.from(queries.constraintGraphNodes(c)), [p, q]);
  assert.deepEqual(Array.from(queries.constraintGraphNodes({})), []);
});

test("arc endpoint and spline constraints enumerate their defining points without solving", () => {
  const queries = create({ resolveGeometryRef: () => null });
  const p = new Point("P1", 0, 0), q = new Point("P2", 10, 0), r = new Point("P3", 10, 10);
  const arc = new Arc("A1", p, 10, 0, Math.PI);
  const endpoint = new ArcEndpointCoincidentConstraint(arc, "end", q);
  assert.equal(queries.constraintReferencesPoint(endpoint, p), true);
  assert.equal(queries.constraintReferencesPoint(endpoint, q), true);
  assert.equal(queries.constraintReferencesPrimitive(endpoint, arc), true);
  const spline = new Spline("SP1", [p, q, r]);
  const c = new PointOnSplineConstraint(p, spline, 0.3);
  const nodes = queries.constraintGraphNodes(c);
  assert.equal(nodes.length, 4);
  assert.ok([p, q, r, spline].every(item => nodes.includes(item)));
  assert.equal(queries.constraintReferencesPoint(c, r), true);
  assert.equal(queries.constraintReferencesPrimitive(c, spline), true);
  assert.equal(c.parameter, 0.3);
});

test("intrinsic instance references use the supplied scope and can be excluded without resolving", () => {
  const source = new Point("P1", 0, 0), target = new Point("P2", 0, 0);
  const a = new Point("P1", 1, 0), b = new Point("P1", 2, 0);
  const ref = { kind: "point", id: "P1" };
  const axis = { kind: "line", id: "L1" }, direction = { kind: "line", id: "L2" };
  const block = { id: "BI1" }, instance = { id: "FI1", sources: [ref], axis, direction };
  source.derivedInstance = instance;
  source.blockInstance = block;
  const c = new SketchProjectionConstraint("point", source, target);
  const calls = [];
  const first = create({ resolveGeometryRef: r => { calls.push(r); return r === ref ? a : null; } });
  const second = create({ resolveGeometryRef: r => r === ref ? b : null });
  const direct = first.constraintGraphNodes(c, { includeIntrinsicDependencies: false });
  assert.deepEqual(Array.from(direct), [source, target]);
  assert.equal(calls.length, 0);
  const expanded = first.constraintGraphNodes(c);
  assert.ok([source, target, block, instance, a].every(item => expanded.includes(item)));
  assert.equal(expanded.includes(b), false);
  assert.deepEqual(calls, [ref, axis, direction]);
  assert.equal(second.constraintGraphNodes(c).includes(b), true);
  assert.equal(first.constraintReferencesPoint(c, a), true);
  assert.equal(second.constraintReferencesPoint(c, a), false);
});

test("offset chains enumerate both sides and shared endpoints only once", () => {
  const queries = create({ resolveGeometryRef: () => null });
  const p = new Point("P1", 0, 0), q = new Point("P2", 10, 0), r = new Point("P3", 10, 10);
  const a = new Line("L1", p, q), b = new Line("L2", q, r);
  const c = new OffsetChainConstraint([a], [b], 2);
  const nodes = queries.constraintGraphNodes(c);
  assert.equal(nodes.length, 5);
  assert.ok([a, b, p, q, r].every(item => nodes.includes(item)));
  assert.equal(queries.constraintReferencesPoint(c, r), true);
  assert.equal(queries.constraintReferencesLine(c, b), true);
});
