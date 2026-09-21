const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ["src/geometry/geometry_kernel.js", "src/geometry/spline_geometry.js", "src/solver/constraint_solver.js", "src/constraints/dimension_queries.js", "src/document/appearance.js", "src/rendering/dimension_metrics.js", "src/rendering/dimension_placement.js", "src/rendering/dimension_layout.js"]) vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
const { Point, Line, Circle, Arc } = sandbox.window.GeometrySolver;
const { CSS_PX_PER_MM, DEFAULT_DIMENSION_APPEARANCE } = sandbox.window.Appearance;
const plain = value => JSON.parse(JSON.stringify(value));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
function create() {
  const viewport = { scale: 2 }, state = { lines: [] }, stack = [];
  const ctx = { font: "original", save() { stack.push(this.font); }, restore() { this.font = stack.pop(); }, measureText(text) { return { width: text.length * parseFloat(this.font) / 2 }; } };
  const metrics = sandbox.window.DimensionMetrics.create({ ctx, viewport });
  const placement = sandbox.window.DimensionPlacement.create({ viewport });
  const layouts = sandbox.window.DimensionLayout.create({ viewport, placement, metrics, currentLines: () => state.lines, minLineLength: 1e-6 });
  return { viewport, state, placement, layouts, metrics };
}
function angleTarget() {
  const vertex = new Point("O", 0, 0);
  return { kind: "angle", line1: new Line("L1", vertex, new Point("P1", 100, 0)), line2: new Line("L2", vertex, new Point("P2", 0, 100)) };
}
test("relative linear placement follows geometry translation and keeps label movement separate", () => {
  const { placement } = create(); const p1 = new Point("P1", 0, 0), p2 = new Point("P2", 100, 0), target = { kind: "line-length", p1, p2 };
  const dimension = placement.dimensionFromAnchor(target, { x: 50, y: 30 });
  const labeled = placement.dimensionWithLabelAt(target, dimension, { x: 70, y: 30 });
  assert.equal(dimension.labelOffsetU, 0); assert.equal(labeled.labelOffsetU, 20);
  p1.x += 15; p2.x += 15; p1.y -= 8; p2.y -= 8;
  assert.deepEqual(plain(placement.dimensionAnchor(target, labeled)), { x: 65, y: 22 });
});
test("point-axis selection uses screen distance and stored target axis retains existing precedence", () => {
  const { placement, viewport } = create(); const target = { kind: "point-point", p1: new Point("P1", 0, 0), p2: new Point("P2", 100, 0) };
  assert.equal(placement.dimensionFromAnchor(target, { x: 50, y: 4 }).axis, null);
  viewport.scale = 4;
  assert.equal(placement.dimensionFromAnchor(target, { x: 50, y: 4 }).axis, "x");
  assert.equal(placement.dimensionFromAnchor(target, { x: 50, y: 40 }, { allowPointAxis: false }).axis, null);
  assert.equal(placement.storedDimensionAxis(target, { axis: "y" }), null);
  assert.equal(placement.storedDimensionAxis({ ...target, dimensionAxis: "x" }, { axis: "y" }), "x");
});
test("radial and offset placement use primitive geometry and explicit anchor directions", () => {
  const { placement } = create(); const center = new Point("O", 5, 6), circle = new Circle("C1", center, 20), outer = new Circle("C2", center, 30);
  const target = { kind: "radius", primitive: circle };
  assert.equal(placement.defaultDimensionForTarget(target).labelOffsetU, 10);
  const points = placement.targetPointsForDimension({ kind: "offset-distance", source: circle, offset: outer }, { x: 5, y: 60 });
  assert.deepEqual(plain(points), [{ x: 5, y: 26 }, { x: 5, y: 36 }]);
  assert.deepEqual(plain(sandbox.window.GeometryKernel.circlePointAtAngle(circle, 0)), { x: 25, y: 6 });
});
test("angle label migration is explicit, preserves v2 offsets, and layout retains legacy normalization", () => {
  const { placement, layouts } = create(), target = angleTarget();
  const dimension = placement.dimensionFromAnchor(target, { x: 30, y: 30 });
  const legacy = { ...dimension, labelX: 40, labelY: 45 };
  const before = placement.angleDimensionLabelOffsets(target, legacy);
  placement.migrateAngleDimensionLabelPlacement(target, legacy);
  assert.equal(legacy.angleLabelPlacementVersion, 2); assert.equal("labelX" in legacy, false);
  close(legacy.angleLabelOffsetR, before.radial); close(legacy.angleLabelOffsetT, before.tangent);
  const invalidVersion = { ...dimension, angleLabelOffsetR: 99, angleLabelOffsetT: -20 };
  layouts.angleDimensionLayout(target, invalidVersion);
  assert.equal(invalidVersion.angleLabelOffsetR, 0); assert.equal(invalidVersion.angleLabelOffsetT, 0);
  const stable = placement.setAngleDimensionLabelOffsets({ ...dimension }, { radial: 4, tangent: 8 });
  layouts.angleDimensionLayout(target, stable); assert.equal(stable.angleLabelOffsetR, 4); assert.equal(stable.angleLabelOffsetT, 8);
});
test("extension visibility reads the current scope and preserves source point identity", () => {
  const { placement, layouts, state } = create(); const point = new Point("P", 0, 0);
  const line = new Line("L", new Point("A", 20, -100), new Point("B", 20, 100));
  const target = { kind: "point-line", point, line }, dimension = placement.dimensionFromAnchor(target, { x: 0, y: 10 });
  const first = layouts.dimensionLayout(target, dimension); assert.equal(first.points[0].source, point); assert.equal(first.points[0].showExtension, true);
  state.lines = [new Line("incident", point, new Point("C", 0, 20))];
  assert.equal(layouts.dimensionLayout(target, dimension).points[0].showExtension, false);
  state.lines = [new Line("other-scope", new Point("same-coordinates", 0, 0), new Point("D", 0, 20))];
  assert.equal(layouts.dimensionLayout(target, dimension).points[0].showExtension, true);
});
test("short extension gaps retain two screen pixels and text angles obey JIS orientation", () => {
  const { placement, layouts, viewport } = create(); const target = { kind: "point-point", p1: new Point("A", 0, 0), p2: new Point("B", 100, 0) };
  const dimension = placement.dimensionFromAnchor(target, { x: 50, y: 2 }, { allowPointAxis: false });
  const layout = layouts.dimensionLayout(target, dimension, { ...DEFAULT_DIMENSION_APPEARANCE, extensionLineOriginGap: 100 });
  close(layout.points[0].onDimension.y - layout.points[0].extensionStart.y, 2 / viewport.scale);
  assert.equal(layouts.jisDimensionTextAngle({ x: 0, y: 1 }), -Math.PI / 2);
  close(layouts.jisDimensionTextAngle({ x: -1, y: -1 }), Math.PI / 4);
});
test("arc radius layout omits the center terminator and extends the nearest arc end", () => {
  const { placement, layouts } = create(); const arc = new Arc("A", new Point("O", 0, 0), 30, 0, Math.PI / 2), target = { kind: "radius", primitive: arc };
  const dimension = placement.dimensionFromAnchor(target, { x: 0, y: -30 });
  const layout = layouts.dimensionLayout(target, dimension);
  const extension = layouts.arcRadiusDimensionExtensionSegment(target, layout);
  assert.equal(extension.sourceEndpoint, "start"); assert.equal(extension.counterclockwise, true);
  assert.ok(layout.points.every(point => !point.showExtension));
  const plan = layouts.linearDimensionRenderPlan(target, layout, "R30", DEFAULT_DIMENSION_APPEARANCE, dimension);
  assert.equal(plan.firstTerminator, null); assert.equal(plan.secondTerminator.point, layout.b);
  const inside = layouts.dimensionLayout(target, placement.dimensionFromAnchor(target, { x: 30, y: 30 }));
  assert.equal(layouts.arcRadiusDimensionExtensionSegment(target, inside), null);
});
test("angle extensions scale with the viewport and parallel angle targets have no layout", () => {
  const { placement, layouts, viewport } = create(); const layout = { vertex: { x: 0, y: 0 }, radius: 30, start: 0, end: Math.PI / 2 };
  const first = layouts.angleDimensionExtensionSegments(layout)[0];
  close(first.start.x, DEFAULT_DIMENSION_APPEARANCE.extensionLineOriginGap * CSS_PX_PER_MM / viewport.scale);
  viewport.scale *= 2;
  close(layouts.angleDimensionExtensionSegments(layout)[0].start.x, first.start.x / 2);
  const target = angleTarget(); target.line2 = new Line("parallel", new Point("A", 0, 10), new Point("B", 100, 10));
  assert.equal(layouts.angleDimensionLayout(target, placement.dimensionFromAnchor(target, { x: 20, y: 20 })), null);
});
