const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const test = require("node:test");
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["src/geometry/geometry_kernel.js", "src/geometry/spline_geometry.js", "src/solver/constraint_solver.js", "src/constraints/dimension_queries.js", "src/constraints/candidates.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
}
const { Point, Line, Circle, HorizontalConstraint, LineCircleTangentConstraint } = sandbox.window.GeometrySolver;
function create(sameSketchElements = () => true) {
  let syncCount = 0;
  const candidates = sandbox.window.ConstraintCandidates.create({ sameSketchElements, syncLineOrientationHints: () => syncCount++, constraintAcceptError: 1e-4 });
  return { candidates, syncCount: () => syncCount };
}
const point = (id, x, y) => new Point(id, x, y);
const line = () => new Line("L1", point("P1", 0, 0), point("P2", 10, 0));

test("operand grouping preserves object identity and removes duplicate geometry", () => {
  const { candidates } = create();
  const p = point("P1", 0, 0), l = line();
  const operands = [{ kind: "point", point: p }, { kind: "line", line: l }, { kind: "point", point: p }];
  const targets = candidates.constraintTargetsFromOperands(operands);
  assert.deepEqual(Array.from(targets.points), [p]);
  assert.deepEqual(Array.from(targets.lines), [l]);
  assert.equal(targets.axisPointPair, null);
  assert.equal(operands.length, 3);
});

test("candidate construction honors the sketch boundary without mutating inputs", () => {
  const l = line(); l.sketchId = "S1";
  const { candidates } = create();
  const targets = candidates.constraintTargetsFromOperands([{ kind: "line", line: l }]);
  const constraint = candidates.constraintFromTargets("horizontal", targets, "S1");
  assert.ok(constraint instanceof HorizontalConstraint);
  assert.equal(constraint.line, l);
  assert.equal(create(() => false).candidates.constraintFromTargets("horizontal", targets, "S1"), null);
  assert.equal(l.p2.x, 10);
});

test("distance candidates retain operand order and reject degenerate lines", () => {
  const { candidates } = create();
  const a = point("P1", 0, 0), b = point("P2", 3, 4);
  const target = candidates.distanceTargetFromOperands([{ kind: "point", point: b }, { kind: "point", point: a }]);
  assert.equal(target.p1, b); assert.equal(target.p2, a); assert.equal(target.value, 5);
  const invalid = candidates.distanceTargetFromOperands([{ kind: "point", point: b }, { kind: "line", line: new Line("L0", a, a) }]);
  assert.equal(invalid.kind, "invalid");
});

test("normal tangent candidates prepare orientation hints only when applicable", () => {
  const harness = create(), l = line(), circle = new Circle("C1", point("PC", 5, 2), 2);
  const targets = harness.candidates.constraintTargetsFromOperands([{ kind: "line", line: l }, { kind: "primitive", primitive: circle }]);
  assert.ok(harness.candidates.constraintFromTargets("tangent", targets, "S1") instanceof LineCircleTangentConstraint);
  assert.equal(harness.syncCount(), 1);
  harness.candidates.constraintFromTargets("horizontal", harness.candidates.constraintTargetsFromOperands([{ kind: "line", line: l }]), "S1");
  assert.equal(harness.syncCount(), 1);
});

test("reference tangent candidates preserve the existing preparation boundary", () => {
  const harness = create(), l = line(), circle = new Circle("C1", point("PC", 5, 2), 2);
  const constraint = harness.candidates.referenceConstraintForType("tangent", { kind: "line", line: l }, { kind: "primitive", primitive: circle });
  assert.ok(constraint instanceof LineCircleTangentConstraint);
  assert.equal(constraint.line, l);
  assert.equal(harness.syncCount(), 0);
});

test("two endpoints of one arc remain distinct ordered operands", () => {
  const { candidates } = create();
  const arc = new sandbox.window.GeometrySolver.Arc("A1", point("PC", 0, 0), 5, 0, Math.PI);
  const first = { kind: "arc-endpoint", arc, endpoint: "end" };
  const second = { kind: "arc-endpoint", arc, endpoint: "start" };
  const targets = candidates.constraintTargetsFromOperands([first, second]);
  assert.equal(targets.arcs.length, 1);
  assert.equal(targets.arcEndpointPair[0].endpoint, "end");
  assert.equal(targets.arcEndpointPair[1], second);
  assert.deepEqual(Array.from(targets.axisPointPair), [first, second]);
  assert.equal(candidates.sameArcEndpoint(first, second), false);
});
