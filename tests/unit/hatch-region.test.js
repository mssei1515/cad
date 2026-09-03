const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadEngine() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const fileName of ["spline_geometry.js", "hatch_region.js"]) {
    const source = fs.readFileSync(path.resolve(__dirname, `../../${fileName}`), "utf8");
    vm.runInContext(source, sandbox, { filename: fileName });
  }
  return sandbox.window.HatchRegionEngine;
}

const engine = loadEngine();
const line = (id, x1, y1, x2, y2) => ({ kind: "line", id, p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 } });
const circle = (id, x, y, radius) => ({ kind: "circle", id, center: { x, y }, radius });
const arc = (id, x, y, radius, startAngle, endAngle) => ({ kind: "arc", id, center: { x, y }, radius, startAngle, endAngle });
const spline = (id, points, closed = false) => ({ kind: "spline", id, points, closed });
const rectangle = (prefix, x1, y1, x2, y2) => [
  line(`${prefix}1`, x1, y1, x2, y1),
  line(`${prefix}2`, x2, y1, x2, y2),
  line(`${prefix}3`, x2, y2, x1, y2),
  line(`${prefix}4`, x1, y2, x1, y1),
];

test("detects a rectangular closed face and serializes associative spans", () => {
  const result = engine.findFaceAtPoint(rectangle("L", 0, 0, 100, 60), { x: 20, y: 20 });
  assert.equal(result.ok, true);
  assert.equal(result.boundaryLoops.length, 1);
  assert.equal(result.boundaryLoops[0].role, "outer");
  assert.deepEqual(new Set(result.boundaryLoops[0].spans.map((span) => span.source.path[0])), new Set(["L1", "L2", "L3", "L4"]));
});

test("detects adjacent regions even when the divider is not pre-split", () => {
  const primitives = [...rectangle("L", 0, 0, 100, 60), line("L5", 50, -20, 50, 80)];
  const left = engine.findFaceAtPoint(primitives, { x: 20, y: 20 });
  const right = engine.findFaceAtPoint(primitives, { x: 80, y: 20 });
  assert.equal(left.ok, true);
  assert.equal(right.ok, true);
  assert.ok(left.boundaryLoops[0].spans.some((span) => span.source.path[0] === "L5"));
  assert.ok(right.boundaryLoops[0].spans.some((span) => span.source.path[0] === "L5"));
});

test("treats a nested circle as a hole and its interior as a separate face", () => {
  const primitives = [...rectangle("L", 0, 0, 100, 100), circle("C1", 50, 50, 20)];
  const annulus = engine.findFaceAtPoint(primitives, { x: 15, y: 50 });
  assert.equal(annulus.ok, true);
  assert.equal(annulus.boundaryLoops.length, 2);
  assert.equal(annulus.boundaryLoops[1].role, "hole");
  assert.equal(annulus.boundaryLoops[1].spans[0].fullCircle, true);
  const center = engine.findFaceAtPoint(primitives, { x: 50, y: 50 });
  assert.equal(center.ok, true);
  assert.equal(center.boundaryLoops.length, 1);
  assert.equal(center.boundaryLoops[0].spans[0].source.path[0], "C1");
});

test("supports closed regions composed of lines and arcs", () => {
  const primitives = [line("L1", -30, 0, 30, 0), arc("A1", 0, 0, 30, 0, Math.PI)];
  const result = engine.findFaceAtPoint(primitives, { x: 0, y: 10 });
  assert.equal(result.ok, true);
  assert.deepEqual(new Set(result.boundaryLoops[0].spans.map((span) => span.source.path[0])), new Set(["L1", "A1"]));
});

test("joins adjacent same-support arcs into an annular-sector boundary", () => {
  const innerRadius = 20;
  const outerRadius = 30;
  const startAngle = 0.25;
  const joinAngle = 0.8;
  const endAngle = 1.35;
  const radialPoint = (radius, angle) => ({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  const innerStart = radialPoint(innerRadius, startAngle);
  const outerStart = radialPoint(outerRadius, startAngle);
  const innerEnd = radialPoint(innerRadius, endAngle);
  const outerEnd = radialPoint(outerRadius, endAngle);
  const primitives = [
    line("L1", innerStart.x, innerStart.y, outerStart.x, outerStart.y),
    line("L2", innerEnd.x, innerEnd.y, outerEnd.x, outerEnd.y),
    arc("A1", 0, 0, innerRadius, startAngle, joinAngle),
    arc("A2", 0, 0, innerRadius, joinAngle, endAngle),
    arc("A3", 0, 0, outerRadius, startAngle, joinAngle),
    arc("A4", 0, 0, outerRadius, joinAngle, endAngle),
  ];
  const seed = radialPoint((innerRadius + outerRadius) / 2, joinAngle);
  const result = engine.findFaceAtPoint(primitives, seed);
  assert.equal(result.ok, true);
  assert.deepEqual(
    new Set(result.boundaryLoops[0].spans.map((span) => span.source.path[0])),
    new Set(["L1", "L2", "A1", "A2", "A3", "A4"]),
  );
  assert.equal(engine.resolveBoundary(result.boundaryLoops, primitives).ok, true);
});

test("rejects genuinely overlapping same-support arcs", () => {
  const primitives = [
    line("L1", -30, 0, 30, 0),
    arc("A1", 0, 0, 30, 0, Math.PI * 0.75),
    arc("A2", 0, 0, 30, Math.PI * 0.5, Math.PI),
  ];
  const result = engine.findFaceAtPoint(primitives, { x: 0, y: 10 });
  assert.equal(result.ok, false);
  assert.equal(result.code, "overlapping-boundary");
});

test("supports a closed cubic spline as an associative hatch boundary", () => {
  const boundary = spline("SP1", [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }, { x: 0, y: 80 }], true);
  const result = engine.findFaceAtPoint([boundary], { x: 50, y: 40 });
  assert.equal(result.ok, true);
  assert.equal(result.boundaryLoops.length, 1);
  assert.equal(result.boundaryLoops[0].spans[0].source.kind, "spline");
  assert.equal(result.boundaryLoops[0].spans[0].fullLoop, true);
  const rebuilt = engine.resolveBoundary(result.boundaryLoops, [boundary]);
  assert.equal(rebuilt.ok, true);
  assert.equal(engine.containsPoint(rebuilt, { x: 50, y: 40 }), true);
});

test("keeps tangent contacts from creating a false split face", () => {
  const primitives = [circle("C1", 0, 0, 20), circle("C2", 40, 0, 20)];
  const left = engine.findFaceAtPoint(primitives, { x: 0, y: 0 });
  const right = engine.findFaceAtPoint(primitives, { x: 40, y: 0 });
  assert.equal(left.ok, true);
  assert.equal(right.ok, true);
  assert.equal(left.boundaryLoops[0].spans[0].source.path[0], "C1");
  assert.equal(right.boundaryLoops[0].spans[0].source.path[0], "C2");
  assert.equal(engine.findFaceAtPoint(primitives, { x: 20, y: 0 }).code, "point-on-boundary");
});

test("rejects open and overlapping boundaries", () => {
  const open = rectangle("L", 0, 0, 100, 100).slice(0, 3);
  assert.equal(engine.findFaceAtPoint(open, { x: 50, y: 50 }).ok, false);
  const overlap = [...rectangle("L", 0, 0, 100, 100), line("L5", 0, 0, 100, 0)];
  const result = engine.findFaceAtPoint(overlap, { x: 50, y: 50 });
  assert.equal(result.ok, false);
  assert.equal(result.code, "overlapping-boundary");
});

test("rebuilds a stored boundary after geometry movement and reports missing geometry", () => {
  const original = rectangle("L", 0, 0, 100, 60);
  const created = engine.findFaceAtPoint(original, { x: 20, y: 20 });
  assert.equal(created.ok, true);
  const moved = rectangle("L", 25, 10, 125, 70);
  const resolved = engine.resolveBoundary(created.boundaryLoops, moved);
  assert.equal(resolved.ok, true);
  assert.equal(engine.containsPoint(resolved, { x: 50, y: 30 }), true);
  const missing = engine.resolveBoundary(created.boundaryLoops, moved.slice(0, 3));
  assert.equal(missing.ok, false);
  assert.equal(missing.code, "missing-boundary");
});

test("rewrites every source and intersection reference for copy and block creation", () => {
  const created = engine.findFaceAtPoint(rectangle("L", 0, 0, 100, 60), { x: 20, y: 20 });
  const rewritten = engine.rewriteBoundaryRefs(created.boundaryLoops, (ref) => ({ ...ref, path: [`N${ref.path[0]}`] }));
  assert.ok(rewritten);
  for (const loop of rewritten) {
    for (const span of loop.spans) {
      assert.match(span.source.path[0], /^NL/);
      for (const anchor of [span.start, span.end]) if (anchor?.type === "intersection") assert.match(anchor.other.path[0], /^NL/);
    }
  }
});

test("reuses a region index for repeated preview point queries", () => {
  const primitives = rectangle("L", 0, 0, 10, 10);
  const index = engine.createRegionIndex(primitives);
  assert.equal(engine.findFaceInIndex(index, { x: 5, y: 5 }).ok, true);
  assert.equal(engine.findFaceInIndex(index, { x: 25, y: 5 }).code, "open-region");
});
