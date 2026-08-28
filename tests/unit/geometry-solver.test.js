const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadGeometryRuntime() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const fileName of ["geometry_kernel.js", "spline_geometry.js", "constraint_solver.js"]) {
    const source = fs.readFileSync(path.resolve(__dirname, `../../${fileName}`), "utf8");
    vm.runInContext(source, sandbox, { filename: fileName });
  }
  return sandbox.window;
}

function residualNorm(value) {
  const values = Array.isArray(value) ? value : [value];
  return Math.sqrt(values.reduce((sum, item) => sum + item * item, 0));
}

const runtime = loadGeometryRuntime();
const geometry = runtime.GeometrySolver;
const kernel = runtime.GeometryKernel;

test("legacy solver math exports alias the shared geometry kernel", () => {
  assert.equal(geometry.MIN_ORIENTATION_LENGTH, kernel.MIN_ORIENTATION_LENGTH);
  assert.equal(geometry.signedPointLineDistance, kernel.signedPointLineDistance);
  assert.equal(geometry.signedPointDirectedLineDistance, kernel.signedPointDirectedLineDistance);
});

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

test("fit splines support point-on-curve and endpoint tangent constraints", () => {
  const fitA = [new geometry.Point("P1", 0, 0), new geometry.Point("P2", 40, 0), new geometry.Point("P3", 80, 0)];
  const fitB = [new geometry.Point("P4", 80, 0), new geometry.Point("P5", 120, 0), new geometry.Point("P6", 160, 0)];
  const splineA = new geometry.Spline("SP1", fitA);
  const splineB = new geometry.Spline("SP2", fitB);
  const onCurve = runtime.SplineGeometry.evaluate(splineA.curve(), 0.35);
  const point = new geometry.Point("P7", onCurve.x, onCurve.y);
  const line = new geometry.Line("L1", new geometry.Point("P8", 0, 10), new geometry.Point("P9", 80, 10));
  const pointConstraint = new geometry.PointOnSplineConstraint(point, splineA, 0.35);
  const lineTangent = new geometry.SplineLineTangentConstraint(splineA, "start", line);
  const splineTangent = new geometry.SplineSplineTangentConstraint(splineA, "end", splineB, "start");

  assert.ok(residualNorm(pointConstraint.error()) < 1e-9);
  assert.ok(residualNorm(lineTangent.error()) < 1e-9);
  assert.ok(residualNorm(splineTangent.error()) < 1e-9);
  const solver = new geometry.ConstraintSolver({ points: [...fitA, ...fitB, point, line.p1, line.p2], lines: [line], circles: [], arcs: [], constraints: [pointConstraint, lineTangent, splineTangent], blockInstances: [] });
  assert.ok(solver.getVariables().some((variable) => variable.object === pointConstraint && variable.prop === "parameter" && variable.min === 0 && variable.max === 1));
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

test("offset chain constraint preserves distance, direction, and miter joins", () => {
  const point = (id, x, y) => new geometry.Point(id, x, y);
  const corner = point("P2", 100, 0);
  const source1 = new geometry.Line("L1", point("P1", 0, 0), corner);
  const source2 = new geometry.Line("L2", corner, point("P3", 100, 100));
  const offset1 = new geometry.Line("L3", point("P4", 0, 10), point("P5", 90, 10));
  const offset2 = new geometry.Line("L4", offset1.p2, point("P6", 90, 100));
  const constraint = new geometry.OffsetChainConstraint(
    [source1, source2],
    [offset1, offset2],
    10,
    1,
    [false, false],
    false,
    0,
  );

  assert.ok(residualNorm(constraint.rawError()) < 1e-9, JSON.stringify(constraint.rawError()));
  offset2.p1.x += 2;
  assert.ok(residualNorm(constraint.rawError()) > 1);
});

test("offset chain constraint supports a line and arc with an explicit traversal", () => {
  const point = (id, x, y) => new geometry.Point(id, x, y);
  const sourceLine = new geometry.Line("L1", point("P1", 0, 0), point("P2", 100, 0));
  const sourceArc = new geometry.Arc("A1", point("P3", 100, 50), 50, -Math.PI / 2, 0);
  const offsetLine = new geometry.Line("L2", point("P4", 0, 10), point("P5", 100, 10));
  const offsetArc = new geometry.Arc("A2", point("P6", 100, 50), 40, -Math.PI / 2, 0);
  const constraint = new geometry.OffsetChainConstraint(
    [sourceLine, sourceArc],
    [offsetLine, offsetArc],
    10,
    1,
    [false, false],
    false,
    1,
  );

  assert.ok(residualNorm(constraint.rawError()) < 1e-9, JSON.stringify(constraint.rawError()));
});

test("offset chain constraint closes the final miter of a loop", () => {
  const point = (id, x, y) => new geometry.Point(id, x, y);
  const sourceCorners = [point("P1", 0, 0), point("P2", 100, 0), point("P3", 100, 100), point("P4", 0, 100)];
  const resultCorners = [point("P5", 10, 10), point("P6", 90, 10), point("P7", 90, 90), point("P8", 10, 90)];
  const lines = (prefix, points) => points.map((start, index) => new geometry.Line(`${prefix}${index + 1}`, start, points[(index + 1) % points.length]));
  const constraint = new geometry.OffsetChainConstraint(
    lines("S", sourceCorners),
    lines("O", resultCorners),
    10,
    1,
    [false, false, false, false],
    true,
    0,
  );

  assert.ok(residualNorm(constraint.rawError()) < 1e-9, JSON.stringify(constraint.rawError()));
});

test("line symmetry constrains midpoint and direction without constraining length", () => {
  const point = (id, x, y) => new geometry.Point(id, x, y);
  const axis = new geometry.Line("AXIS", point("AX1", 0, -20), point("AX2", 0, 20));
  const angle = Math.PI / 6;
  const lineFromCenter = (id, centerX, centerY, directionAngle, length) => {
    const dx = Math.cos(directionAngle) * length / 2;
    const dy = Math.sin(directionAngle) * length / 2;
    return new geometry.Line(id, point(`${id}A`, centerX - dx, centerY - dy), point(`${id}B`, centerX + dx, centerY + dy));
  };
  const first = lineFromCenter("L1", -5, 2, angle, 4);
  const second = lineFromCenter("L2", 5, 2, Math.PI - angle, 11);
  const constraint = new geometry.LineSymmetryConstraint(first, second, axis);

  assert.ok(residualNorm(constraint.rawError()) < 1e-9);
  assert.notEqual(first.length(), second.length());

  second.p1.x += 1;
  second.p2.x += 1;
  assert.ok(residualNorm(constraint.rawError()) > 1e-3);
});

test("arc symmetry constrains center and radius without constraining endpoints", () => {
  const point = (id, x, y) => new geometry.Point(id, x, y);
  const axis = new geometry.Line("AXIS", point("AX1", 0, -20), point("AX2", 0, 20));
  const first = new geometry.Arc("A1", point("C1", -6, 3), 8, 0.1, 1.2);
  const second = new geometry.Arc("A2", point("C2", 6, 3), 8, 2.4, 5.7);
  const constraint = new geometry.ArcSymmetryConstraint(first, second, axis);

  assert.ok(residualNorm(constraint.rawError()) < 1e-9);
  first.startAngle = -2;
  first.endAngle = -0.4;
  second.startAngle = 0.7;
  second.endAngle = 2.8;
  assert.ok(residualNorm(constraint.rawError()) < 1e-9);

  second.radiusValue = 9;
  assert.ok(residualNorm(constraint.rawError()) > 0.9);
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
