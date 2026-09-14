const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["src/geometry/geometry_kernel.js", "src/geometry/spline_geometry.js", "src/solver/constraint_solver.js", "src/document/appearance.js", "src/document/drawing_order.js", "src/persistence/geometry.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
}
const codec = sandbox.window.GeometryPersistence;
const options = { sourceVersion: 22, normalizeSketchId: (id) => id || "S1" };
const document = () => ({ id: "B1", points: [{ id: "P1", x: 0, y: 0 }, { id: "P2", x: 3, y: 4 }, { id: "P3", x: 5, y: 0 }], lines: [{ id: "L1", p1: "P1", p2: "P2", drawingOrder: 3 }], circles: [], arcs: [], splines: [] });

test("geometry restoration builds isolated namespaces while sharing references within each scope", () => {
  const data = document(), before = JSON.stringify(data);
  const first = codec.decodeDocument(data, options), second = codec.decodeDocument(data, options);
  assert.equal(first.lines[0].p1, first.pointById.get("P1"));
  assert.equal(first.lineById.get("L1"), first.lines[0]);
  assert.equal(first.lines[0].drawingOrder, 3);
  assert.notEqual(first.points[0], second.points[0]);
  first.points[0].x = 20;
  assert.equal(second.points[0].x, 0);
  assert.equal(JSON.stringify(data), before);
});

test("legacy root circles and arcs recover radius and angles from referenced points", () => {
  const data = document();
  data.circles = [{ id: "C1", center: "P1", radiusPoint: "P2" }];
  data.arcs = [{ id: "A1", center: "P1", startPoint: "P2", endPoint: "P3" }];
  const before = JSON.stringify(data);
  const loaded = codec.decodeDocument(data, { ...options, sourceVersion: 1 });
  assert.equal(loaded.circles[0].radius(), 5);
  assert.equal(loaded.arcs[0].radius(), 5);
  assert.equal(loaded.arcs[0].startAngle, Math.atan2(4, 3));
  assert.equal(loaded.arcs[0].endAngle, 0);
  assert.ok(loaded.points.every((p) => p.kind === "endpoint"));
  assert.equal(loaded.primitiveById.get("A1"), loaded.arcs[0]);
  assert.equal(JSON.stringify(data), before);
});

test("root and block point defaults preserve their existing compatibility policies", () => {
  const data = document();
  const root = codec.decodeDocument(data, options), block = codec.decodeBlock(data, options);
  assert.equal(root.points[2].kind, "explicit");
  assert.equal(block.points[2].kind, "endpoint");
  assert.equal(Object.hasOwn(root.points[2], "appearance"), false);
  assert.equal(Object.hasOwn(block.points[2], "appearance"), true);
  assert.equal(block.lines[0].p1, block.points[0]);
});

test("invalid geometry is rejected locally without modifying raw data or a previous result", () => {
  const previous = codec.decodeDocument(document(), options);
  for (const method of ["decodeDocument", "decodeBlock"]) {
    const data = document();
    data.lines[0].p2 = "missing";
    const before = JSON.stringify(data);
    assert.throws(() => codec[method](data, options), /端点が見つかりません/);
    assert.equal(JSON.stringify(data), before);
    assert.equal(previous.points[0].x, 0);
  }
});

test("spline version, construction, and owning sketch checks remain inside restoration", () => {
  const data = document();
  data.splines = [{ id: "SP1", definitionMode: "fit", degree: 3, endCondition: "natural", fitPoints: ["P1", "P2", "P3"], closed: false, construction: true, sketchId: "S1" }];
  for (const method of ["decodeDocument", "decodeBlock"]) {
    const loaded = codec[method](data, options);
    assert.equal(loaded.splines[0].fitPoints[0], loaded.points[0]);
    assert.equal(loaded.splines[0].construction, true);
    assert.equal(codec[method](data, { ...options, sourceVersion: 14 }).splines.length, 0);
    const invalid = structuredClone(data);
    invalid.points[0].sketchId = "S2";
    assert.throws(() => codec[method](invalid, options), /別のスケッチ/);
  }
});
