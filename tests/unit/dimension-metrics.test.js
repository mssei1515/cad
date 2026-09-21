const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["src/document/appearance.js", "src/rendering/dimension_metrics.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
}
const { DEFAULT_DIMENSION_APPEARANCE, CSS_PX_PER_MM } = sandbox.window.Appearance;
function create() {
  const viewport = { scale: 2 };
  const stack = [];
  let measurements = 0;
  const ctx = { font: "original", save() { stack.push(this.font); }, restore() { this.font = stack.pop(); }, measureText(text) { measurements++; return { width: text.length * parseFloat(this.font) / 2 }; } };
  return { metrics: sandbox.window.DimensionMetrics.create({ ctx, viewport }), ctx, viewport, measurements: () => measurements };
}
test("text measurement preserves context and screen size across zoom", () => {
  const { metrics, ctx, viewport } = create();
  const first = metrics.dimensionTextWidth("1234");
  assert.equal(ctx.font, "original");
  viewport.scale *= 2;
  assert.equal(metrics.dimensionTextWidth("1234"), first / 2);
  assert.ok(metrics.dimensionTextWidth("1234", DEFAULT_DIMENSION_APPEARANCE, true) > first / 2);
});
test("text cache reuses measurements across zoom but invalidates changed text and marks", () => {
  const { metrics, viewport, measurements } = create();
  const appearance = { ...DEFAULT_DIMENSION_APPEARANCE, terminatorType: "arrow" }, owner = {};
  assert.equal(metrics.shouldPlaceDimensionTerminatorsOutside(0, "12", appearance, owner), true);
  metrics.shouldPlaceDimensionTerminatorsOutside(0, "12", appearance, owner);
  assert.equal(measurements(), 1);
  viewport.scale = 4;
  metrics.shouldPlaceDimensionTerminatorsOutside(10000, "12", appearance, owner);
  assert.equal(measurements(), 1);
  metrics.shouldPlaceDimensionTerminatorsOutside(0, "123", appearance, owner);
  metrics.shouldPlaceDimensionTerminatorsOutside(0, "123", appearance, owner, true);
  assert.equal(measurements(), 3);
});
test("arrow dimensions scale in world space and open-arrow stroke compensation preserves wings", () => {
  const { metrics, viewport } = create();
  const appearance = { ...DEFAULT_DIMENSION_APPEARANCE, terminatorSize: 3, arrowheadAngle: 30 };
  const point = { x: 0, y: 0 }, direction = { x: 1, y: 0 };
  const solid = metrics.dimensionArrowheadPoints(point, direction, appearance);
  const open = metrics.dimensionOpenArrowheadRenderPoints(point, direction, appearance, 1 / viewport.scale);
  assert.equal(solid[1].x, 3 * CSS_PX_PER_MM / viewport.scale);
  assert.ok(open[0].x > 0);
  assert.equal(open[1].x, solid[1].x);
  assert.equal(open[1].y, solid[1].y);
  viewport.scale *= 2;
  const zoomed = metrics.dimensionOpenArrowheadRenderPoints(point, direction, appearance, 1 / viewport.scale);
  assert.equal(zoomed[0].x, open[0].x / 2);
  assert.equal(zoomed[1].y, open[1].y / 2);
});
