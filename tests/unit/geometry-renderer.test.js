const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ["src/geometry/geometry_kernel.js", "src/geometry/spline_geometry.js", "src/rendering/geometry_renderer.js"]) vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
function create(state = {}) {
  const calls = [];
  const ctx = {};
  for (const name of ["save", "restore", "beginPath", "closePath", "moveTo", "lineTo", "stroke", "fill", "arc", "fillText", "setLineDash"]) ctx[name] = (...args) => calls.push([name, ...args]);
  const renderer = sandbox.window.GeometryRenderer.create({ ctx, viewport: { scale: 2 }, paintState: () => ({ appearance: { lineType: "solid" }, alpha: 0.7, color: "red", strokeWidth: 4, ...state }), appearanceLineDash: () => [], lineDisplaySegment: line => line, canvasThemeColor: color => color });
  return { renderer, calls, ctx };
}
test("line rendering consumes prepared visual state and preserves drawing order", () => {
  const { renderer, calls, ctx } = create({ showId: true });
  renderer.drawLines([{ id: "L1", p1: { x: 1, y: 2 }, p2: { x: 3, y: 4 } }]);
  assert.deepEqual(calls.filter(c => ["moveTo", "lineTo", "stroke"].includes(c[0])), [["moveTo", 1, 2], ["lineTo", 3, 4], ["stroke"]]);
  assert.equal(ctx.strokeStyle, "red"); assert.equal(ctx.lineWidth, 2); assert.equal(ctx.globalAlpha, 0.7);
  assert.equal(calls.filter(c => c[0] === "fillText")[0][1], "L1");
  assert.equal(calls[0][0], "save"); assert.equal(calls.at(-1)[0], "restore");
});
test("construction endpoint markers use source endpoints and scale", () => {
  const { renderer, calls } = create({ construction: true });
  renderer.drawLines([{ p1: { x: 1, y: 2 }, p2: { x: 3, y: 4 } }]);
  const circles = calls.filter(c => c[0] === "arc");
  assert.equal(circles.length, 2); assert.deepEqual(circles[0].slice(1, 4), [1, 2, 1.2]);
  assert.equal(calls.some(c => c[0] === "fillText"), false);
});
test("circle and arc rendering retain radius and signed arc direction", () => {
  const { renderer, calls } = create();
  renderer.drawCircles([{ center: { x: 2, y: 3 }, radius: () => 7 }]);
  renderer.drawArcs([{ center: { x: 4, y: 5 }, radius: () => 8, startAngle: 2, endAngle: -1 }]);
  assert.deepEqual(calls.filter(c => c[0] === "arc"), [["arc", 2, 3, 7, 0, Math.PI * 2], ["arc", 4, 5, 8, 2, -1, true]]);
});
