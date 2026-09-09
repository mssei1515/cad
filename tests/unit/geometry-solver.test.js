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

test("observable drag maps output motion to constrained real variables without changing the model", () => {
  const p1 = new geometry.Point("P1", 0, 0);
  const p2 = new geometry.Point("P2", 0, 40);
  const line = new geometry.Line("L1", p1, p2);
  const constraint = new geometry.VerticalConstraint(line);
  const model = { points: [p1, p2], lines: [line], circles: [], arcs: [], blockInstances: [], constraints: [constraint] };
  const solver = new geometry.ConstraintSolver(model);
  const variables = solver.getVariables();
  const point = { get x() { return p1.x + p2.x; }, get y() { return 0; } };
  const targets = solver.observablePointDragTargets({ variables, constraints: model.constraints, lines: [line], point, x: 10, y: 8 });
  assert.equal(p1.x, 0);
  assert.equal(p2.x, 0);
  assert.ok(targets.length > 0);
  const result = solver.solveSubsetGuided({ variables, constraints: model.constraints, lines: [line], targets });
  assert.equal(result.success, true);
  assert.ok(Math.abs(point.x - 10) < 1e-5);
  assert.ok(Math.abs(p1.x - p2.x) < 1e-6);
  assert.equal(p1.y, 0);
  assert.equal(p2.y, 40);
  assert.equal(solver.observablePointDragTargets({ variables: [], point, x: 30, y: 8 }).length, 0);
});

test("fixed circular geometry restores center, radius and arc angles after perturbation", () => {
  for (const kind of ["circle", "arc"]) {
    const center = new geometry.Point("P1", 12, -8);
    const primitive = kind === "circle"
      ? new geometry.Circle("C1", center, 30)
      : new geometry.Arc("A1", center, 30, -0.4, 1.2);
    const fixed = new geometry.GeometryFixedConstraint(primitive);
    const solver = new geometry.ConstraintSolver({ points: [center], lines: [], circles: kind === "circle" ? [primitive] : [], arcs: kind === "arc" ? [primitive] : [], constraints: [fixed], blockInstances: [] });
    center.x += 7;
    center.y -= 4;
    primitive.radiusValue += 6;
    if (kind === "arc") {
      primitive.startAngle += 2 * Math.PI + 0.2;
      primitive.endAngle -= 2 * Math.PI + 0.3;
    }
    solver.solve();
    assert.ok(residualNorm(fixed.rawError()) < 1e-5);
    assert.ok(Math.abs(center.x - 12) < 1e-5);
    assert.ok(Math.abs(center.y + 8) < 1e-5);
    assert.ok(Math.abs(primitive.radius() - 30) < 1e-5);
    assert.equal(solver.analyzeConstraintState().freeVariableCount, 0);
  }
});

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

test("sketch projection constraints preserve point, line, circle, arc, and spline geometry", () => {
  const point = (id, x, y) => new geometry.Point(id, x, y);
  const sourcePoint = point("SP", 4, -2);
  const targetPoint = point("TP", 4, -2);
  const sourceLine = new geometry.Line("SL", point("SL1", 0, 0), point("SL2", 20, 5));
  const targetLine = new geometry.Line("TL", point("TL1", 0, 0), point("TL2", 20, 5));
  const sourceCircle = new geometry.Circle("SC", point("SC0", 3, 7), 12);
  const targetCircle = new geometry.Circle("TC", point("TC0", 3, 7), 12);
  const sourceArc = new geometry.Arc("SA", point("SA0", -5, 8), 9, -0.4, 1.2);
  const targetArc = new geometry.Arc("TA", point("TA0", -5, 8), 9, -0.4, 1.2);
  const sourceSpline = new geometry.Spline("SS", [point("SS1", 0, 0), point("SS2", 20, 10), point("SS3", 40, -5), point("SS4", 60, 4)], true);
  const targetSpline = new geometry.Spline("TS", [point("TS1", 0, 0), point("TS2", 20, 10), point("TS3", 40, -5), point("TS4", 60, 4)], true);
  const cases = [
    new geometry.SketchProjectionConstraint("point", sourcePoint, targetPoint),
    new geometry.SketchProjectionConstraint("line", sourceLine, targetLine),
    new geometry.SketchProjectionConstraint("circle", sourceCircle, targetCircle),
    new geometry.SketchProjectionConstraint("arc", sourceArc, targetArc),
    new geometry.SketchProjectionConstraint("spline", sourceSpline, targetSpline),
  ];

  for (const constraint of cases) assert.ok(residualNorm(constraint.rawError()) < 1e-9, constraint.kind);
  targetArc.endAngle += 0.1;
  assert.ok(residualNorm(cases[3].rawError()) > 0.09);
  targetSpline.fitPoints[2].y += 2;
  assert.ok(residualNorm(cases[4].rawError()) > 1.9);
  targetSpline.closed = false;
  assert.deepEqual(Array.from(cases[4].rawError()), [1e6]);
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
  const largerCircle = new geometry.Circle("C4", circleCenter, 8);
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
    new geometry.LineCircleDistanceConstraint(tangentLine, circle, 5),
    new geometry.ConcentricRadiusDifferenceConstraint(circle, largerCircle, 3),
    new geometry.LineCircleTangentConstraint(tangentLine, circle, -1),
    new geometry.CircleCircleTangentConstraint(circle, externalCircle, "external"),
    new geometry.SymmetryConstraint(left, right, symmetryAxis),
  ];

  for (const constraint of cases) {
    assert.ok(residualNorm(constraint.rawError()) < 1e-9, `${constraint.constructor.name} residual was ${JSON.stringify(constraint.rawError())}`);
  }
});

test("line-circle dimension constrains the circle center to the line support", () => {
  const line = new geometry.Line(
    "L1",
    new geometry.Point("P1", -40, 10, true),
    new geometry.Point("P2", 40, 10, true),
  );
  const center = new geometry.Point("P3", 8, 43);
  const circle = new geometry.Circle("C1", center, 12);
  const constraint = new geometry.LineCircleDistanceConstraint(line, circle, 25);
  const solver = new geometry.ConstraintSolver({
    points: [line.p1, line.p2, center],
    lines: [line],
    circles: [circle],
    arcs: [],
    blockInstances: [],
    constraints: [constraint],
  });

  const result = solver.solve();

  assert.equal(result.success, true, result.reason);
  assert.ok(result.errorNorm < 1e-6);
  assert.ok(Math.abs(Math.abs(geometry.signedPointLineDistance(center, line)) - 25) < 1e-6);
  assert.equal(circle.radius(), 12);
});

test("concentric radius-difference dimension supports circles and arcs while preserving concentricity", () => {
  const centerA = new geometry.Point("P1", -3, 4, true);
  const centerB = new geometry.Point("P2", 11, -8);
  const circle = new geometry.Circle("C1", centerA, 18);
  const arc = new geometry.Arc("A1", centerB, 46, -0.8, 1.4);
  const constraint = new geometry.ConcentricRadiusDifferenceConstraint(circle, arc, 12);
  const solver = new geometry.ConstraintSolver({
    points: [centerA, centerB],
    lines: [],
    circles: [circle],
    arcs: [arc],
    blockInstances: [],
    constraints: [new geometry.RadiusConstraint(circle, 18), constraint],
  });

  const result = solver.solve();

  assert.equal(result.success, true, result.reason);
  assert.ok(result.errorNorm < 1e-6);
  assert.ok(Math.hypot(centerA.x - centerB.x, centerA.y - centerB.y) < 1e-6);
  assert.ok(Math.abs(Math.abs(arc.radius() - circle.radius()) - 12) < 1e-6);
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

test("line symmetry constrains mirrored support lines while both target endpoints remain independently movable", () => {
  const point = (id, x, y, fixed = false) => new geometry.Point(id, x, y, fixed);
  const axis = new geometry.Line("AXIS", point("AX1", 0, -20, true), point("AX2", 0, 20, true));
  const first = new geometry.Line("L1", point("L1A", -7, -3, true), point("L1B", -3, 5, true));
  const reflectedStart = { x: 7, y: -3 };
  const reflectedDirection = { x: -4 / Math.sqrt(80), y: 8 / Math.sqrt(80) };
  const supportPoint = (id, parameter) => point(
    id,
    reflectedStart.x + reflectedDirection.x * parameter,
    reflectedStart.y + reflectedDirection.y * parameter,
  );
  const second = new geometry.Line("L2", supportPoint("L2A", 6), supportPoint("L2B", 25));
  const constraint = new geometry.LineSymmetryConstraint(first, second, axis);
  const model = {
    points: [axis.p1, axis.p2, first.p1, first.p2, second.p1, second.p2],
    lines: [axis, first, second],
    circles: [],
    arcs: [],
    blockInstances: [],
    constraints: [constraint],
  };

  assert.ok(residualNorm(constraint.rawError()) < 1e-9);
  assert.notEqual(first.length(), second.length());
  const reflectedMidpoint = { x: 5, y: 1 };
  const secondMidpoint = { x: (second.p1.x + second.p2.x) / 2, y: (second.p1.y + second.p2.y) / 2 };
  assert.ok(Math.hypot(secondMidpoint.x - reflectedMidpoint.x, secondMidpoint.y - reflectedMidpoint.y) > 5);
  assert.equal(new geometry.ConstraintSolver(model).analyzeConstraintState().freeVariableCount, 2);

  const fixedEndpoint = { x: second.p1.x, y: second.p1.y };
  const beforeLength = second.length();
  second.p2.x += reflectedDirection.x * 7;
  second.p2.y += reflectedDirection.y * 7;
  assert.ok(residualNorm(constraint.rawError()) < 1e-9);
  assert.deepEqual({ x: second.p1.x, y: second.p1.y }, fixedEndpoint);
  assert.ok(Math.abs(second.length() - beforeLength - 7) < 1e-9);

  second.p1.x += reflectedDirection.y;
  second.p2.x += reflectedDirection.y;
  second.p1.y -= reflectedDirection.x;
  second.p2.y -= reflectedDirection.x;
  assert.ok(residualNorm(constraint.rawError()) > 1e-3);
});

test("parallel-line centerline follows the equidistant support line without constraining its endpoints", () => {
  const point = (id, x, y, fixed = false) => new geometry.Point(id, x, y, fixed);
  const top = new geometry.Line("L1", point("P1", -80, -30, true), point("P2", 80, -30, true));
  const bottom = new geometry.Line("L2", point("P3", -80, 50, true), point("P4", 80, 50, true));
  const center = new geometry.Line("CL", point("CP1", -25, 10), point("CP2", 60, 10), true);
  const constraint = new geometry.ParallelLinesCenterlineConstraint(top, bottom, center);
  const model = {
    points: [top.p1, top.p2, bottom.p1, bottom.p2, center.p1, center.p2],
    lines: [top, bottom, center], circles: [], arcs: [], blockInstances: [], constraints: [constraint],
  };

  assert.ok(residualNorm(constraint.rawError()) < 1e-9);
  assert.equal(new geometry.ConstraintSolver(model).analyzeConstraintState().freeVariableCount, 2);

  top.p2.x = 35;
  assert.ok(residualNorm(constraint.rawError()) < 1e-9, "shortening a source along its support line must not move the centerline");
  center.p1.x = -60;
  assert.ok(residualNorm(constraint.rawError()) < 1e-9, "one centerline endpoint may extend independently");

  bottom.p2.y += 5;
  assert.ok(residualNorm(constraint.rawError()) > 1e-3, "non-parallel source supports must violate the relation");
});

test("point-pair centerline is a perpendicular bisector with independently movable endpoints", () => {
  const p1 = new geometry.Point("P1", -30, 15, true);
  const p2 = new geometry.Point("P2", 50, 15, true);
  const center = new geometry.Line("CL", new geometry.Point("CP1", 10, -45), new geometry.Point("CP2", 10, 70), true);
  const constraint = new geometry.PointPairCenterlineConstraint(p1, p2, center);
  const model = {
    points: [p1, p2, center.p1, center.p2], lines: [center], circles: [], arcs: [], blockInstances: [], constraints: [constraint],
  };

  assert.ok(residualNorm(constraint.rawError()) < 1e-9);
  assert.equal(new geometry.ConstraintSolver(model).analyzeConstraintState().freeVariableCount, 2);
  center.p2.y += 40;
  assert.ok(residualNorm(constraint.rawError()) < 1e-9);
  center.p1.x += 3;
  center.p2.x += 3;
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

test("contact tangency keeps the same freedom across radius, angle turns and equation ordering", () => {
  for (const radius of [1e-6, 0.1, 20, 6600]) for (const turns of [0, 45000, -45000]) for (const perturbation of [0, 1e-6, -1e-6]) {
    const angle = Math.PI + turns * 2 * Math.PI + perturbation;
    const p = new geometry.Point("contact", 0, 0, true);
    const a = new geometry.Point("a", 0, -100, true);
    const b = new geometry.Point("b", 0, 100, true);
    const line = new geometry.Line("line", a, b);
    const center = new geometry.Point("center", -radius * Math.cos(angle), -radius * Math.sin(angle));
    const arc = new geometry.Arc("arc", center, radius, angle, angle + 1);
    const constraints = [new geometry.ArcEndpointCoincidentConstraint(arc, "start", p),
      new geometry.PointOnLineConstraint(p, line), new geometry.LineCircleTangentConstraint(line, arc, -1)];
    const model = { points: [p, a, b, center], lines: [line], circles: [], arcs: [arc], constraints };
    const solver = new geometry.ConstraintSolver(model);
    for (const reverse of [false, true]) {
      const variables = solver.getVariables();
      const ordered = [...constraints];
      if (reverse) { variables.reverse(); ordered.reverse(); }
      const state = solver.analyzeConstraintState({ variables, constraints: ordered, lines: [line] });
      assert.equal(state.stable, true);
      assert.equal(state.freeVariableCount, 2, `radius=${radius} turns=${turns} perturbation=${perturbation} reverse=${reverse}`);
      assert.equal(state.variableFreedom.get(arc).radiusValue, true);
      assert.equal(state.variableFreedom.get(arc).endAngle, true);
    }
  }
});

test("a tangent contact is inferred from coincidence topology, never proximity", () => {
  const p = new geometry.Point("p", 0, 0, true);
  const q = new geometry.Point("q", 0, 0);
  const end = new geometry.Point("end", 0, 50, true);
  const line = new geometry.Line("line", p, end);
  const center = new geometry.Point("center", 20, 0);
  const arc = new geometry.Arc("arc", center, 20, Math.PI, 1);
  const tangent = new geometry.LineCircleTangentConstraint(line, arc, -1);
  const coincidence = new geometry.CoincidentConstraint(q, p);
  const endpoint = new geometry.ArcEndpointCoincidentConstraint(arc, "start", q);
  const solver = new geometry.ConstraintSolver({ points: [p, q, end, center], lines: [line], circles: [], arcs: [arc], constraints: [tangent, endpoint] });
  assert.equal(solver.getConstraints()[0], tangent);
  solver.model.constraints.push(coincidence);
  assert.equal(solver.getConstraints()[0].sourceConstraint, tangent);
  coincidence.enabled = false;
  assert.equal(solver.getConstraints()[0], tangent);
});

test("bounded finite differences use the actual interval and restore the variables", () => {
  const p = new geometry.Point("p", 0, 0, true);
  const arc = new geometry.Arc("arc", p, 1e-6, 0, 1);
  const solver = new geometry.ConstraintSolver({ points: [p], lines: [], circles: [], arcs: [arc], constraints: [] });
  const constraint = new geometry.RadiusConstraint(arc, 1e-6);
  const vars = solver.getVariables();
  const matrix = solver.computeJacobianForConstraints(vars, [constraint.error()], [constraint]);
  assert.ok(Math.abs(matrix[0][0] - 1) < 1e-10);
  assert.equal(arc.radius(), 1e-6);
});

test("nonfinite residuals cannot be classified as a stable constrained model", () => {
  const p = new geometry.Point("p", 0, 0);
  const constraint = new geometry.Constraint("invalid", 1);
  constraint.rawError = () => NaN;
  const solver = new geometry.ConstraintSolver({ points: [p], lines: [], circles: [], arcs: [], constraints: [constraint] });
  assert.equal(solver.analyzeConstraintState().stable, false);
});

test("a point constrained to a tangent line and circle has no phantom sliding freedom", () => {
  for (const offset of [0, 1e-5, -1e-5]) {
    const center = new geometry.Point('center', 0, 20, true);
    const p1 = new geometry.Point('p1', -100, 0, true), p2 = new geometry.Point('p2', 100, 0, true);
    const point = new geometry.Point('contact', offset, 0);
    const line = new geometry.Line('line', p1, p2);
    const circle = new geometry.Circle('circle', center, 20);
    const constraints = [new geometry.RadiusConstraint(circle, 20), new geometry.LineCircleTangentConstraint(line, circle, 1),
      new geometry.PointOnLineConstraint(point, line), new geometry.PointOnCircleConstraint(point, circle)];
    const solver = new geometry.ConstraintSolver({ points: [center, p1, p2, point], lines: [line], circles: [circle], arcs: [], constraints });
    const analysis = solver.analyzeConstraintState();
    assert.equal(analysis.stable, true);
    assert.equal(analysis.freeVariableCount, 0);
    assert.equal(analysis.variableFreedom.get(point).x, false);
    assert.equal(solver.constraintRankState({ variables: solver.getVariables(), constraints }).rank, analysis.rank);
    assert.equal(solver.constraintRedundancyState({ variables: solver.getVariables(), constraints }).rank, analysis.rank);
  }
});

test("an arc endpoint on a tangent circle preserves exactly the rotation and free endpoint freedoms", () => {
  for (const perturbation of [0, 1e-6, -1e-6]) for (const mode of ['external', 'internal']) {
    const fixed = new geometry.Point('fixed', 0, 0, true);
    const circle = new geometry.Circle('circle', fixed, 20);
    const center = new geometry.Point('center', mode === 'external' ? 30 : 10, 0);
    const arc = new geometry.Arc('arc', center, 10, (mode === 'external' ? Math.PI : 0) + perturbation, 1);
    const constraints = [new geometry.RadiusConstraint(circle, 20), new geometry.RadiusConstraint(arc, 10),
      new geometry.CircleCircleTangentConstraint(circle, arc, mode), new geometry.ArcEndpointOnCircleConstraint(arc, 'start', circle)];
    const solver = new geometry.ConstraintSolver({ points: [fixed, center], lines: [], circles: [circle], arcs: [arc], constraints });
    const before = solver.clone(solver.getVariables());
    const analysis = solver.analyzeConstraintState();
    assert.equal(analysis.stable, true);
    assert.equal(analysis.freeVariableCount, 2, `${mode}/${perturbation}`);
    for (const entry of before) assert.equal(entry.object[entry.prop], entry.value, 'analysis must not edit geometry');
  }
});

test("the bounded drag predictor can move a coupled point without asking a minimum-radius arc to shrink", () => {
  const point = new geometry.Point('point', 0, 0);
  const center = new geometry.Point('center', 0, 1e-6);
  const arc = new geometry.Arc('arc', center, 1e-6, -Math.PI / 2, 0);
  const constraint = new geometry.ArcEndpointCoincidentConstraint(arc, 'start', point);
  const solver = new geometry.ConstraintSolver({ points: [point, center], lines: [], circles: [], arcs: [arc], constraints: [constraint] });
  solver.maxStepNorm = 200;
  for (const y of [10, -10, 0, 40, -40, 0]) {
    const result = solver.solveSubsetGuided({ variables: solver.getVariables(), constraints: [constraint], targets: [{ point, x: 0, y }] });
    assert.equal(result.success, true);
    assert.ok(Math.abs(point.y - y) < 1e-4, `${point.y} should follow ${y}`);
    assert.ok(arc.radius() >= 1e-6);
    assert.ok(residualNorm(constraint.error()) < 1e-4);
  }
});

test("contact Jacobians retain the moving tangent line dependencies", () => {
  const a = new geometry.Point("a", -10, 0), b = new geometry.Point("b", 10, 0);
  const center = new geometry.Point("center", 0, 5, true), point = new geometry.Point("point", 0, 0);
  const line = new geometry.Line("line", a, b), circle = new geometry.Circle("circle", center, 5);
  const constraints = [new geometry.PointOnLineConstraint(point, line), new geometry.PointOnCircleConstraint(point, circle),
    new geometry.LineCircleTangentConstraint(line, circle, 1)];
  const solver = new geometry.ConstraintSolver({ points: [a, b, center, point], lines: [line], circles: [circle], arcs: [], constraints });
  const contact = solver.getConstraints().find((c) => c.sourceConstraint === constraints[1]);
  const dense = new geometry.Constraint("dense reference", 1);
  dense.rawError = () => contact.rawError();
  const variables = solver.getVariables();
  const sparseJacobian = solver.computeJacobianForConstraints(variables, [contact.error()], [contact]);
  const denseJacobian = solver.computeJacobianForConstraints(variables, [dense.error()], [dense]);
  for (let i = 0; i < variables.length; i++) assert.ok(Math.abs(sparseJacobian[0][i] - denseJacobian[0][i]) < 1e-8);
  assert.ok(Math.abs(sparseJacobian[0][variables.findIndex((v) => v.object === b && v.prop === "y")]) > 0.1);
});

test("offset joins inherit explicit source tangency without a phantom endpoint degree of freedom", () => {
  for (const perturbation of [0, 1e-6, -1e-6]) {
    const ca = new geometry.Point('ca', 0, 0, true), cb = new geometry.Point('cb', 0, 40, true);
    const a = new geometry.Arc('a', ca, 20, 0, Math.PI / 2), b = new geometry.Arc('b', cb, 20, 3 * Math.PI / 2, Math.PI);
    const oa = new geometry.Arc('oa', ca, 10, 0, Math.PI / 2 + perturbation), ob = new geometry.Arc('ob', cb, 30, 3 * Math.PI / 2, Math.PI);
    const tangent = new geometry.CircleCircleTangentConstraint(a, b, 'external');
    const contact = new geometry.ArcEndpointArcEndpointCoincidentConstraint(a, 'end', b, 'start');
    const offset = new geometry.OffsetChainConstraint([a, b], [oa, ob], 10);
    const solver = new geometry.ConstraintSolver({ points: [ca, cb], lines: [], circles: [], arcs: [a, b, oa, ob], constraints: [tangent, contact, offset] });
    const variables = [{ object: oa, prop: 'endAngle' }, { object: ob, prop: 'startAngle' }];
    const rank = solver.constraintRankState({ variables, constraints: [tangent, contact, offset] });
    assert.equal(rank.rank, 2);
    tangent.enabled = false;
    assert.equal(solver.getConstraints().find((c) => c.sourceConstraint === offset), undefined);
  }
});

test("physical angle scaling lets a circle drag leave endpoint tangencies without locking", () => {
  const left = new geometry.Point('left', -100, 20, true), right = new geometry.Point('right', 100, 20, true);
  const support = new geometry.Line('support', left, right);
  const fixedCenter = new geometry.Point('fixedCenter', 60, 0, true), center = new geometry.Point('center', 20, 0);
  const circle = new geometry.Circle('circle', fixedCenter, 20), arc = new geometry.Arc('arc', center, 20, 0, Math.PI / 2);
  const constraints = [new geometry.RadiusConstraint(circle, 20), new geometry.ArcEndpointOnCircleConstraint(arc, 'start', circle),
    new geometry.ArcEndpointOnLineConstraint(arc, 'end', support)];
  const solver = new geometry.ConstraintSolver({ points: [left, right, fixedCenter, center], lines: [support], circles: [circle], arcs: [arc], constraints });
  solver.maxStepNorm = 200;
  const pointer = { x: 20 + 20 / Math.sqrt(2) + 10, y: 20 / Math.sqrt(2) };
  const result = solver.solveSubsetGuided({ variables: solver.getVariables(), constraints, lines: [support],
    targets: [{ object: arc, prop: 'radiusValue', value: Math.hypot(pointer.x - 20, pointer.y), radialPointer: pointer }] });
  assert.equal(result.success, true);
  assert.ok(Math.abs(Math.hypot(pointer.x - center.x, pointer.y - center.y) - arc.radius()) < 1e-4);
  assert.ok(residualNorm(solver.computeErrorVectorForConstraints(constraints)) < 1e-4);
});


test("equal concentric internally tangent circles do not pin an arbitrary arc endpoint angle", () => {
  const center = new geometry.Point('center', 0, 0, true);
  const arc = new geometry.Arc('arc', center, 10, 0.7, 1.9);
  const circle = new geometry.Circle('circle', center, 10);
  const constraints = [new geometry.RadiusConstraint(arc, 10), new geometry.RadiusConstraint(circle, 10),
    new geometry.CircleCircleTangentConstraint(arc, circle, 'internal'), new geometry.ArcEndpointOnCircleConstraint(arc, 'start', circle)];
  const solver = new geometry.ConstraintSolver({points: [center], lines: [], circles: [circle], arcs: [arc], constraints});
  assert.equal(solver.analyzeConstraintState().freeVariableCount, 2);
  assert.equal(arc.startAngle, 0.7);
  assert.ok(residualNorm(solver.computeErrorVectorForConstraints(solver.getConstraints())) < 1e-8);
});

test("offset contact regularization retains an inconsistent positional join", () => {
  const ca = new geometry.Point('ca', 0, 0, true), cb = new geometry.Point('cb', 0, 40, true);
  const a = new geometry.Arc('a', ca, 20, 0, Math.PI / 2), b = new geometry.Arc('b', cb, 20, 3 * Math.PI / 2, 2 * Math.PI);
  const oa = new geometry.Arc('oa', ca, 10, 0, Math.PI / 2), ob = new geometry.Arc('ob', cb, 10, 3 * Math.PI / 2, 2 * Math.PI);
  const constraints = [new geometry.CircleCircleTangentConstraint(a, b, 'external'),
    new geometry.ArcEndpointArcEndpointCoincidentConstraint(a, 'end', b, 'start'), new geometry.OffsetChainConstraint([a, b], [oa, ob], 10)];
  const solver = new geometry.ConstraintSolver({points: [ca, cb], lines: [], circles: [], arcs: [a, b, oa, ob], constraints});
  const result = solver.solveSubset({variables: [], constraints});
  assert.equal(result.success, false);
  assert.ok(result.errorNorm >= 20);
});


test("a radius prediction crossing zero does not remove a reachable point direction", () => {
  const center = new geometry.Point('center', -20, 0, true), point = new geometry.Point('point', 0, 0);
  const arc = new geometry.Arc('arc', center, 20, 0, Math.PI);
  const constraints = [new geometry.ArcEndpointCoincidentConstraint(arc, 'start', point)];
  const solver = new geometry.ConstraintSolver({points: [center, point], lines: [], circles: [], arcs: [arc], constraints});
  solver.maxStepNorm = 200;
  const result = solver.solveSubsetGuided({variables: solver.getVariables(), constraints, targets: [{point, x: -30, y: 10}]});
  assert.equal(result.success, true);
  assert.ok(Math.hypot(point.x + 30, point.y - 10) < 1e-4);
  assert.ok(Math.abs(arc.radius() - Math.sqrt(200)) < 1e-4);
  assert.ok(residualNorm(solver.computeErrorVectorForConstraints(constraints)) < 1e-4);
});
