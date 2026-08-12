const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadGeometrySolver() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const fileName of ["geometry_kernel.js", "constraint_solver.js"]) {
    const source = fs.readFileSync(path.resolve(__dirname, `../../${fileName}`), "utf8");
    vm.runInContext(source, sandbox, { filename: fileName });
  }
  return sandbox.window.GeometrySolver;
}

function residualNorm(value) {
  const values = Array.isArray(value) ? value : [value];
  return Math.sqrt(values.reduce((sum, item) => sum + item * item, 0));
}

const geometry = loadGeometrySolver();

test("geometry primitives preserve their public measurement contract", () => {
  const center = new geometry.Point("P0", 2, -3, true);
  const p1 = new geometry.Point("P1", -1, 1);
  const p2 = new geometry.Point("P2", 2, 5);
  const line = new geometry.Line("L1", p1, p2, true);
  const circle = new geometry.Circle("C1", center, 0);
  const arc = new geometry.Arc("A1", center, 5, 0, Math.PI / 2);

  assert.equal(line.length(), 5);
  assert.equal(line.construction, true);
  assert.equal(circle.radius(), 1e-6);
  assert.equal(arc.startPoint().x, 7);
  assert.equal(arc.startPoint().y, -3);
  assert.ok(Math.abs(arc.endPoint().x - 2) < 1e-12);
  assert.ok(Math.abs(arc.endPoint().y - 2) < 1e-12);
});

test("representative persistent constraints have zero residual on canonical geometry", () => {
  const fixed = (id, x, y) => new geometry.Point(id, x, y, true);
  const p0 = fixed("P0", 0, 0);
  const p3 = fixed("P3", 3, 0);
  const p4 = fixed("P4", 0, 4);
  const p5 = fixed("P5", 3, 4);
  const left = fixed("PL", -2, 1);
  const right = fixed("PR", 2, 1);
  const horizontal1 = new geometry.Line("LH1", p0, p3);
  const horizontal2 = new geometry.Line("LH2", p4, p5);
  const vertical = new geometry.Line("LV", p0, p4);
  const symmetryAxis = new geometry.Line("LA", fixed("PA1", 0, -3), fixed("PA2", 0, 3));
  const circleCenter = fixed("PC", 0, 0);
  const circle = new geometry.Circle("C1", circleCenter, 5);
  const sameCircle = new geometry.Circle("C2", circleCenter, 5);
  const tangentLine = new geometry.Line("LT", fixed("PT1", -5, 5), fixed("PT2", 5, 5));
  const externalCircle = new geometry.Circle("C3", fixed("PC3", 10, 0), 5);

  const cases = [
    new geometry.DistanceConstraint(p0, fixed("PD", 3, 4), 5),
    new geometry.CoincidentConstraint(p0, fixed("PE", 0, 0)),
    new geometry.PointOnLineConstraint(p3, horizontal1),
    new geometry.HorizontalConstraint(horizontal1),
    new geometry.VerticalConstraint(vertical),
    new geometry.ParallelConstraint(horizontal1, horizontal2),
    new geometry.PerpendicularConstraint(horizontal1, vertical),
    new geometry.EqualLengthConstraint(horizontal1, horizontal2),
    new geometry.ConcentricConstraint(circle, sameCircle),
    new geometry.EqualRadiusConstraint(circle, sameCircle),
    new geometry.PointOnCircleConstraint(fixed("POC", 5, 0), circle),
    new geometry.LineCircleTangentConstraint(tangentLine, circle, -1),
    new geometry.CircleCircleTangentConstraint(circle, externalCircle, "external"),
    new geometry.SymmetryConstraint(left, right, symmetryAxis),
  ];

  for (const constraint of cases) {
    assert.ok(residualNorm(constraint.rawError()) < 1e-9, `${constraint.constructor.name} residual was ${JSON.stringify(constraint.rawError())}`);
  }
});

test("solver satisfies distance and orientation while reporting no remaining freedom", () => {
  const p1 = new geometry.Point("P1", 0, 0, true);
  const p2 = new geometry.Point("P2", 8, 6, false);
  const line = new geometry.Line("L1", p1, p2);
  const model = {
    points: [p1, p2],
    lines: [line],
    circles: [],
    arcs: [],
    blockInstances: [],
    constraints: [
      new geometry.DistanceConstraint(p1, p2, 5),
      new geometry.HorizontalConstraint(line),
    ],
  };
  const solver = new geometry.ConstraintSolver(model);

  const result = solver.solve();
  const analysis = solver.analyzeConstraintState();

  assert.equal(result.success, true, result.reason);
  assert.ok(result.errorNorm < 1e-6);
  assert.ok(Math.abs(line.length() - 5) < 1e-6);
  assert.ok(Math.abs(p2.y) < 1e-6);
  assert.equal(analysis.stable, true);
  assert.equal(analysis.freeVariableCount, 0);
});
