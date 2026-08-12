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
