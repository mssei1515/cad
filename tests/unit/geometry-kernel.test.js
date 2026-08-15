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
