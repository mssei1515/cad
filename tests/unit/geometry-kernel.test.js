const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadGeometryKernel() {
  const source = fs.readFileSync(path.resolve(__dirname, "../../geometry_kernel.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "geometry_kernel.js" });
  return sandbox.window.GeometryKernel;
}

const kernel = loadGeometryKernel();

test("positive angle normalization preserves the app range [0, 2pi)", () => {
  const twoPi = Math.PI * 2;
  assert.equal(kernel.normalizeAnglePositive(0), 0);
  assert.equal(kernel.normalizeAnglePositive(twoPi), 0);
  assert.equal(kernel.normalizeAnglePositive(-twoPi), 0);
  assert.ok(Math.abs(kernel.normalizeAnglePositive(-Math.PI / 2) - Math.PI * 1.5) < 1e-12);
  assert.ok(Math.abs(kernel.normalizeAnglePositive(twoPi * 4 + 0.25) - 0.25) < 1e-12);
});

test("signed angle normalization preserves the solver range (-pi, pi]", () => {
  assert.equal(kernel.normalizeAngleSigned(0), 0);
  assert.equal(kernel.normalizeAngleSigned(Math.PI), Math.PI);
  assert.equal(kernel.normalizeAngleSigned(-Math.PI), Math.PI);
  assert.equal(kernel.normalizeAngleSigned(Math.PI * 3), Math.PI);
  assert.equal(kernel.normalizeAngleSigned(-Math.PI * 3), Math.PI);
  assert.ok(Math.abs(kernel.normalizeAngleSigned(Math.PI * 1.5) + Math.PI / 2) < 1e-12);
});

test("arc endpoint calculation uses the selected angle and public radius contract", () => {
  const arc = {
    center: { x: 3, y: -2 },
    startAngle: 0,
    endAngle: Math.PI / 2,
    radius: () => 5,
  };

  const start = kernel.arcEndpointPoint(arc, "start");
  assert.equal(start.x, 8);
  assert.equal(start.y, -2);
  const end = kernel.arcEndpointPoint(arc, "end");
  assert.ok(Math.abs(end.x - 3) < 1e-12);
  assert.ok(Math.abs(end.y - 3) < 1e-12);
});

test("line direction helpers preserve unit, normal, angle, and degeneracy contracts", () => {
  const line = {
    p1: { x: 1, y: 2 },
    p2: { x: 4, y: 6 },
    dx: () => 3,
    dy: () => 4,
    length: () => 5,
  };
  const unit = kernel.lineUnit(line);
  const normal = kernel.lineNormal(line);
  assert.ok(Math.abs(unit.x - 0.6) < 1e-12);
  assert.ok(Math.abs(unit.y - 0.8) < 1e-12);
  assert.ok(Math.abs(normal.x + 0.8) < 1e-12);
  assert.ok(Math.abs(normal.y - 0.6) < 1e-12);
  assert.ok(Math.abs(kernel.lineAngle(line) - Math.atan2(4, 3)) < 1e-12);

  const degenerate = {
    p1: { x: 2, y: 3 },
    p2: { x: 2, y: 3 },
    dx: () => 0,
    dy: () => 0,
    length: () => 0,
  };
  assert.equal(kernel.lineUnit(degenerate).x, 1);
  assert.equal(kernel.lineUnit(degenerate).y, 0);
  assert.equal(kernel.lineNormal(degenerate).x, 0);
  assert.equal(kernel.lineNormal(degenerate).y, 1);
  assert.equal(kernel.lineHasDirection(degenerate), false);

  const thresholdLine = { ...degenerate, p2: { x: 2 + 1e-9, y: 3 }, dx: () => 1e-9, length: () => 1e-9 };
  const belowThresholdLine = { ...thresholdLine, p2: { x: 2 + 5e-10, y: 3 }, dx: () => 5e-10, length: () => 5e-10 };
  assert.equal(kernel.MIN_ORIENTATION_LENGTH, 1e-9);
  assert.equal(kernel.lineHasDirection(thresholdLine), true);
  assert.equal(kernel.lineHasDirection(belowThresholdLine), false);
});

test("support normals and signed distances preserve orientation hints and direction", () => {
  const horizontal = {
    p1: { x: 0, y: 2 },
    p2: { x: 0, y: 4 },
    orientationHint: "horizontal",
    dx: () => 0,
    dy: () => 2,
    length: () => 2,
  };
  const vertical = {
    p1: { x: 2, y: 0 },
    p2: { x: 4, y: 0 },
    orientationHint: "vertical",
    dx: () => 2,
    dy: () => 0,
    length: () => 2,
  };
  assert.equal(kernel.lineSupportNormal(horizontal).x, 0);
  assert.equal(kernel.lineSupportNormal(horizontal).y, 1);
  assert.equal(kernel.lineSupportNormal(vertical).x, -1);
  assert.equal(kernel.lineSupportNormal(vertical).y, 0);
  assert.equal(kernel.signedPointLineDistance({ x: 9, y: 8 }, horizontal), 5);
  assert.equal(kernel.signedPointLineDistance({ x: 8, y: 9 }, vertical), -5);
  assert.equal(kernel.signedPointDirectedLineDistance({ x: 3, y: 5 }, horizontal), -3);

  const forward = {
    p1: { x: 0, y: 0 },
    p2: { x: 4, y: 0 },
    orientationHint: null,
    dx: () => 4,
    dy: () => 0,
    length: () => 4,
  };
  const reverse = {
    p1: forward.p2,
    p2: forward.p1,
    orientationHint: null,
    dx: () => -4,
    dy: () => 0,
    length: () => 4,
  };
  assert.equal(kernel.signedPointLineDistance({ x: 0, y: 3 }, forward), 3);
  assert.equal(kernel.signedPointLineDistance({ x: 0, y: 3 }, reverse), -3);

  const degenerate = {
    p1: { x: 1, y: 1 },
    p2: { x: 1, y: 1 },
    orientationHint: null,
    dx: () => 0,
    dy: () => 0,
    length: () => 0,
  };
  assert.equal(kernel.signedPointLineDistance({ x: 4, y: 5 }, degenerate), 0);
  assert.equal(kernel.signedPointDirectedLineDistance({ x: 4, y: 5 }, degenerate), 0);
});

test("line and segment projection preserve unclamped and clamped parameters", () => {
  const line = {
    p1: { x: 0, y: 0 },
    p2: { x: 4, y: 0 },
    dx: () => 4,
    dy: () => 0,
  };

  const lineProjection = kernel.projectPointToLine({ x: 8, y: 3 }, line);
  assert.equal(lineProjection.x, 8);
  assert.equal(lineProjection.y, 0);

  const segmentProjection = kernel.projectPointToSegmentPoint({ x: 8, y: 3 }, line);
  assert.equal(segmentProjection.x, 4);
  assert.equal(segmentProjection.y, 0);

  const interior = kernel.closestPointOnSegment(2, 3, line);
  assert.equal(interior.x, 2);
  assert.equal(interior.y, 0);
  assert.equal(interior.t, 0.5);

  const before = kernel.closestPointOnSegment(-3, 2, line);
  assert.equal(before.x, 0);
  assert.equal(before.y, 0);
  assert.equal(before.t, 0);
});

test("segment distance and degeneracy preserve the existing squared-length boundary", () => {
  const line = {
    p1: { x: 0, y: 0 },
    p2: { x: 4, y: 0 },
    dx: () => 4,
    dy: () => 0,
  };
  assert.equal(kernel.distancePointToSegment(8, 3, line), 5);
  assert.equal(kernel.distancePointToSegmentPoints(8, 3, line.p1, line.p2), 5);

  const degenerate = {
    p1: { x: 1, y: 1 },
    p2: { x: 1 + 5e-7, y: 1 },
    dx: () => 5e-7,
    dy: () => 0,
  };
  const degenerateProjection = kernel.closestPointOnSegment(4, 5, degenerate);
  assert.equal(degenerateProjection.x, 1);
  assert.equal(degenerateProjection.y, 1);
  assert.equal(degenerateProjection.t, 0);
  const degenerateLineProjection = kernel.projectPointToLine({ x: 4, y: 5 }, degenerate);
  assert.equal(degenerateLineProjection.x, 1);
  assert.equal(degenerateLineProjection.y, 1);
  const degenerateSegmentProjection = kernel.projectPointToSegmentPoint({ x: 4, y: 5 }, degenerate);
  assert.equal(degenerateSegmentProjection.x, 1);
  assert.equal(degenerateSegmentProjection.y, 1);
  assert.equal(kernel.distancePointToSegment(4, 5, degenerate), 5);

  const boundary = {
    p1: { x: 0, y: 1 },
    p2: { x: 1e-6, y: 1 },
    dx: () => 1e-6,
    dy: () => 0,
  };
  const boundaryProjection = kernel.closestPointOnSegment(5e-7, 2, boundary);
  assert.ok(Math.abs(boundaryProjection.x - 5e-7) < 1e-12);
  assert.equal(boundaryProjection.y, 1);
  assert.ok(Math.abs(boundaryProjection.t - 0.5) < 1e-9);
  const boundaryLineProjection = kernel.projectPointToLine({ x: 5e-7, y: 2 }, boundary);
  assert.ok(Math.abs(boundaryLineProjection.x - 5e-7) < 1e-12);
  assert.equal(boundaryLineProjection.y, 1);
});

test("line intersection preserves infinite-line and determinant boundary contracts", () => {
  const horizontal = { p1: { x: 0, y: 1 }, p2: { x: 4, y: 1 } };
  const vertical = { p1: { x: 2, y: 3 }, p2: { x: 2, y: 4 } };
  const crossing = kernel.lineIntersection(horizontal, vertical);
  assert.equal(crossing.x, 2);
  assert.equal(crossing.y, 1);

  const reversed = kernel.lineIntersection(
    { p1: horizontal.p2, p2: horizontal.p1 },
    { p1: vertical.p2, p2: vertical.p1 },
  );
  assert.equal(reversed.x, crossing.x);
  assert.equal(reversed.y, crossing.y);

  const parallel = kernel.lineIntersection(horizontal, {
    p1: { x: 0, y: 3 },
    p2: { x: 4, y: 3 },
  });
  assert.equal(parallel, null);

  const belowBoundary = kernel.lineIntersection(
    { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } },
    { p1: { x: 0, y: 0 }, p2: { x: 1, y: 5e-13 } },
  );
  assert.equal(belowBoundary, null);

  const atBoundary = kernel.lineIntersection(
    { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } },
    { p1: { x: 0, y: 0 }, p2: { x: 1, y: 1e-12 } },
  );
  assert.equal(Math.abs(atBoundary.x), 0);
  assert.equal(Math.abs(atBoundary.y), 0);
});

test("line reflection preserves endpoint direction and orientation-length boundary", () => {
  const horizontal = {
    p1: { x: 0, y: 0 },
    p2: { x: 4, y: 0 },
    orientationHint: null,
    dx: () => 4,
    dy: () => 0,
  };
  const reflected = kernel.reflectedPointAcrossLine({ x: 2, y: 3 }, horizontal);
  assert.equal(reflected.x, 2);
  assert.equal(reflected.y, -3);

  const diagonalWithIgnoredHint = {
    p1: { x: 0, y: 0 },
    p2: { x: 1, y: 1 },
    orientationHint: "horizontal",
    dx: () => 1,
    dy: () => 1,
  };
  const diagonalReflection = kernel.reflectedPointAcrossLine({ x: 2, y: 0 }, diagonalWithIgnoredHint);
  assert.ok(Math.abs(diagonalReflection.x) < 1e-12);
  assert.equal(diagonalReflection.y, 2);

  const reversed = {
    ...diagonalWithIgnoredHint,
    p1: diagonalWithIgnoredHint.p2,
    p2: diagonalWithIgnoredHint.p1,
    dx: () => -1,
    dy: () => -1,
  };
  const reversedReflection = kernel.reflectedPointAcrossLine({ x: 2, y: 0 }, reversed);
  assert.ok(Math.abs(reversedReflection.x - diagonalReflection.x) < 1e-12);
  assert.equal(reversedReflection.y, diagonalReflection.y);

  const belowBoundary = {
    p1: { x: 0, y: 0 },
    p2: { x: 5e-10, y: 0 },
    dx: () => 5e-10,
    dy: () => 0,
  };
  const unchanged = kernel.reflectedPointAcrossLine({ x: 2, y: 3 }, belowBoundary);
  assert.equal(unchanged.x, 2);
  assert.equal(unchanged.y, 3);

  const atBoundary = {
    p1: { x: 0, y: 0 },
    p2: { x: 1e-9, y: 0 },
    dx: () => 1e-9,
    dy: () => 0,
  };
  const boundaryReflection = kernel.reflectedPointAcrossLine({ x: 2, y: 3 }, atBoundary);
  assert.equal(boundaryReflection.x, 2);
  assert.equal(boundaryReflection.y, -3);
});

test("arc angle unwrapping and shortest branches preserve signed boundaries", () => {
  const twoPi = Math.PI * 2;
  assert.equal(kernel.unwrapAngleNear(0, Math.PI * 1.5), twoPi);
  assert.equal(kernel.unwrapAngleNear(0, -Math.PI * 1.5), -twoPi);
  assert.equal(kernel.unwrapAngleNear(0, Math.PI), twoPi);
  assert.equal(kernel.unwrapAngleNear(0, -Math.PI), 0);

  assert.ok(Math.abs(kernel.shortestAngleFrom(0, Math.PI * 1.5) + Math.PI / 2) < 1e-12);
  assert.equal(kernel.shortestAngleFrom(0, -Math.PI), Math.PI);
  assert.ok(Math.abs(kernel.shortestAngleFrom(twoPi * 2, Math.PI / 2) - (twoPi * 2 + Math.PI / 2)) < 1e-12);
});

test("slot geometry uses two semicircle centers and a width-side point", () => {
  const geometry = kernel.slotGeometry({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 35, y: 20 });
  assert.equal(geometry.centerDistance, 100);
  assert.equal(geometry.radius, 20);
  assert.equal(geometry.side, 1);
  assert.equal(geometry.sideStart.x, 0);
  assert.equal(geometry.sideStart.y, 20);
  assert.equal(geometry.sideEnd.x, 100);
  assert.equal(geometry.sideEnd.y, 20);
  assert.equal(geometry.oppositeEnd.x, 100);
  assert.equal(geometry.oppositeEnd.y, -20);
  assert.equal(geometry.oppositeStart.x, 0);
  assert.equal(geometry.oppositeStart.y, -20);
  assert.ok(Math.abs(geometry.endArc.endAngle - geometry.endArc.startAngle + Math.PI) < 1e-12);
  assert.ok(Math.abs(geometry.startArc.endAngle - geometry.startArc.startAngle + Math.PI) < 1e-12);
});

test("slot geometry reverses semicircle direction when width is picked on the other side", () => {
  const geometry = kernel.slotGeometry({ x: 10, y: 5 }, { x: 110, y: 5 }, { x: 60, y: -10 });
  assert.equal(geometry.radius, 15);
  assert.equal(geometry.side, -1);
  assert.equal(geometry.sideStart.x, 10);
  assert.equal(geometry.sideStart.y, -10);
  assert.equal(geometry.sideEnd.x, 110);
  assert.equal(geometry.sideEnd.y, -10);
  assert.ok(Math.abs(geometry.endArc.endAngle - geometry.endArc.startAngle - Math.PI) < 1e-12);
  assert.ok(Math.abs(geometry.startArc.endAngle - geometry.startArc.startAngle - Math.PI) < 1e-12);
});

test("slot geometry preserves perpendicular radius for rotated slots and rejects degenerate input", () => {
  const geometry = kernel.slotGeometry({ x: 2, y: 3 }, { x: 5, y: 7 }, { x: -2, y: 6 });
  assert.ok(geometry);
  assert.equal(geometry.centerDistance, 5);
  assert.ok(Math.abs(geometry.radius - 5) < 1e-12);
  assert.ok(Math.abs(Math.hypot(geometry.sideStart.x - 2, geometry.sideStart.y - 3) - 5) < 1e-12);
  assert.equal(kernel.slotGeometry({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 10 }), null);
  assert.equal(kernel.slotGeometry({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }), null);
  assert.equal(kernel.slotGeometry({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: Number.NaN, y: 2 }), null);
  assert.equal(kernel.slotGeometry({ x: 0, y: 0 }, { x: 1e-10, y: 0 }, { x: 0, y: 1 }, 1e-9), null);
});

test("signed arc sweep membership and parameters preserve direction and degeneracy", () => {
  const twoPi = Math.PI * 2;
  assert.equal(kernel.angleOnSignedSweep(0, Math.PI * 1.5, Math.PI * 2.5), true);
  assert.equal(kernel.angleOnSignedSweep(Math.PI, Math.PI * 1.5, Math.PI * 2.5), false);
  assert.equal(kernel.angleOnSignedSweep(0, Math.PI / 2, -Math.PI / 2), true);
  assert.equal(kernel.angleOnSignedSweep(Math.PI, Math.PI / 2, -Math.PI / 2), false);
  assert.equal(kernel.angleOnSignedSweep(123, 0, twoPi), true);
  assert.equal(kernel.angleOnSignedSweep(twoPi, 0, 0), true);
  assert.equal(kernel.angleOnSignedSweep(Math.PI, 0, 0), false);

  const positive = { startAngle: Math.PI * 1.5, endAngle: Math.PI * 2.5 };
  const negative = { startAngle: Math.PI / 2, endAngle: -Math.PI / 2 };
  assert.equal(kernel.arcSweep(positive), Math.PI);
  assert.equal(kernel.arcSweep(negative), -Math.PI);
  assert.ok(Math.abs(kernel.arcParamOnSweep(positive, 0) - 0.5) < 1e-12);
  assert.ok(Math.abs(kernel.arcParamOnSweep(negative, 0) - 0.5) < 1e-12);
  assert.equal(kernel.arcParamOnSweep(positive, Math.PI), null);
  assert.equal(kernel.arcParamOnSweep({ startAngle: 0, endAngle: 5e-13 }, 0), null);
  assert.equal(
    kernel.arcParamOnSweep({ startAngle: 0, endAngle: 1e-12 }, 5e-13),
    kernel.normalizeAnglePositive(5e-13) / 1e-12,
  );
});

test("arc parameter conversion and sampling preserve signed interpolation", () => {
  const arc = {
    center: { x: 1, y: 2 },
    radius: () => 2,
    startAngle: Math.PI * 1.5,
    endAngle: Math.PI * 2.5,
  };
  assert.equal(kernel.angleAtArcParam(arc, 0), arc.startAngle);
  assert.equal(kernel.angleAtArcParam(arc, 1), arc.endAngle);
  assert.ok(Math.abs(kernel.angleAtArcParam(arc, 0.5) - Math.PI * 2) < 1e-12);

  const midpoint = kernel.pointAtArcParam(arc, 0.5);
  assert.ok(Math.abs(midpoint.x - 3) < 1e-12);
  assert.ok(Math.abs(midpoint.y - 2) < 1e-12);

  const samples = kernel.arcSamplePoints(arc, 2);
  assert.equal(samples.length, 3);
  assert.ok(Math.abs(samples[0].x - 1) < 1e-12);
  assert.ok(Math.abs(samples[0].y) < 1e-12);
  assert.ok(Math.abs(samples[1].x - 3) < 1e-12);
  assert.ok(Math.abs(samples[1].y - 2) < 1e-12);
  assert.ok(Math.abs(samples[2].x - 1) < 1e-12);
  assert.ok(Math.abs(samples[2].y - 4) < 1e-12);

  const startOnly = kernel.arcSamplePoints(arc, 0);
  assert.equal(startOnly.length, 1);
  assert.ok(Math.abs(startOnly[0].x - samples[0].x) < 1e-12);
  assert.ok(Math.abs(startOnly[0].y - samples[0].y) < 1e-12);
});
