const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadEngine() {
  const source = fs.readFileSync(path.resolve(__dirname, "../../offset_chain.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "offset_chain.js" });
  return sandbox.window.OffsetChainEngine;
}

const engine = loadEngine();
const line = (id, x1, y1, x2, y2, reversed = false) => ({ geometry: { id, p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 } }, reversed });
const arc = (id, x, y, radius, startAngle, endAngle, reversed = false) => ({ geometry: { id, center: { x, y }, radius, startAngle, endAngle }, reversed });

test("offsets an open right-angle line chain with a miter join", () => {
  const result = engine.build([
    line("L1", 0, 0, 100, 0),
    line("L2", 100, 0, 100, 80),
  ], { distance: 10, side: 1, closed: false });
  assert.equal(result.ok, true);
  assert.deepEqual([result.geometries[0].p1.x, result.geometries[0].p1.y], [0, 10]);
  assert.deepEqual([result.geometries[0].p2.x, result.geometries[0].p2.y], [90, 10]);
  assert.deepEqual([result.geometries[1].p1.x, result.geometries[1].p1.y], [90, 10]);
  assert.deepEqual([result.geometries[1].p2.x, result.geometries[1].p2.y], [90, 80]);
});

test("offsets a closed rectangle inward and outward", () => {
  const rectangle = [
    line("L1", 0, 0, 100, 0),
    line("L2", 100, 0, 100, 60),
    line("L3", 100, 60, 0, 60),
    line("L4", 0, 60, 0, 0),
  ];
  const inward = engine.build(rectangle, { distance: 10, side: 1, closed: true });
  const outward = engine.build(rectangle, { distance: 10, side: -1, closed: true });
  assert.equal(inward.ok, true);
  assert.equal(outward.ok, true);
  assert.deepEqual([inward.geometries[0].p1.x, inward.geometries[0].p1.y], [10, 10]);
  assert.deepEqual([inward.geometries[0].p2.x, inward.geometries[0].p2.y], [90, 10]);
  assert.deepEqual([outward.geometries[0].p1.x, outward.geometries[0].p1.y], [-10, -10]);
  assert.deepEqual([outward.geometries[0].p2.x, outward.geometries[0].p2.y], [110, -10]);
});

test("supports reversed definitions and mixed line-arc chains", () => {
  const result = engine.build([
    line("L1", 100, 0, 0, 0, true),
    arc("A1", 100, 40, 40, -Math.PI / 2, Math.PI / 2),
  ], { distance: 5, side: 1, closed: false });
  assert.equal(result.ok, true);
  assert.equal(result.geometries[0].kind, "line");
  assert.equal(result.geometries[1].kind, "arc");
  assert.ok(Math.abs(result.geometries[1].radius - 35) < 1e-9);
  assert.ok(Math.hypot(
    result.geometries[0].p2.x - (result.geometries[1].center.x + Math.cos(result.geometries[1].startAngle) * result.geometries[1].radius),
    result.geometries[0].p2.y - (result.geometries[1].center.y + Math.sin(result.geometries[1].startAngle) * result.geometries[1].radius),
  ) < 1e-7);
});

test("rejects radius collapse and a self-intersecting result", () => {
  assert.equal(engine.build([arc("A1", 0, 0, 5, 0, Math.PI)], { distance: 5, side: 1 }).code, "collapsed-radius");
  const bow = engine.build([
    line("L1", 0, 0, 100, 100),
    line("L2", 100, 100, 0, 100),
    line("L3", 0, 100, 100, 0),
  ], { distance: 5, side: 1 });
  assert.equal(bow.ok, false);
  assert.equal(bow.code, "self-intersection");
});
