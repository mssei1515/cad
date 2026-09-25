const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ["src/geometry/geometry_kernel.js", "src/geometry/spline_geometry.js", "src/solver/constraint_solver.js", "src/document/appearance.js", "src/rendering/annotation_renderer.js"]) vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
function create(anchor = { x: 10, y: 20 }) {
  const calls = [], ctx = {}, viewport = { scale: 2 };
  let anchorReads = 0;
  for (const name of ["save", "restore", "translate", "rotate", "fillText", "beginPath", "moveTo", "lineTo", "stroke", "closePath", "fill", "arc", "setLineDash"]) ctx[name] = (...args) => calls.push([name, ...args]);
  const renderer = sandbox.window.AnnotationRenderer.create({ ctx, viewport, withCanvasState: callback => callback(), annotationDisplayColor: () => "blue", annotationLeaderAnchor: () => { anchorReads++; return anchor; }, appearanceLineDash: () => [1, 2] });
  return { renderer, viewport, ctx, calls, anchorReads: () => anchorReads };
}
test("annotation text preserves rotation, alignment and explicit color overrides", () => {
  const h = create();
  h.renderer.drawAnnotationText({ text: "note", x: 3, y: 4, rotation: 0.5, style: { textHeight: 3, textAlign: "right", bold: true, italic: true, fontFamily: "serif" } }, "red");
  assert.equal(h.ctx.fillStyle, "red"); assert.equal(h.ctx.textAlign, "right");
  assert.ok(h.ctx.font.startsWith("italic 700 ")); assert.ok(h.ctx.font.includes("Georgia"));
  assert.deepEqual(h.calls, [["save"], ["translate", 3, 4], ["rotate", 0.5], ["fillText", "note", 0, 0], ["restore"]]);
  const height = h.renderer.annotationTextWorldHeight({ textHeight: 3 }); h.viewport.scale *= 2;
  assert.equal(h.renderer.annotationTextWorldHeight({ textHeight: 3 }), height / 2);
});
test("leader preview uses its own start while committed drawing resolves the anchor", () => {
  const element = { start: { x: 1, y: 2 }, end: { x: 30, y: 40 }, style: { terminatorType: "none" } };
  const preview = create(); preview.renderer.drawAnnotationLeader(element, true);
  assert.equal(preview.anchorReads(), 0);
  assert.deepEqual(preview.calls.find(call => call[0] === "moveTo"), ["moveTo", 1, 2]);
  const committed = create(); committed.renderer.drawAnnotationLeader(element);
  assert.equal(committed.anchorReads(), 1);
  assert.deepEqual(committed.calls.find(call => call[0] === "moveTo"), ["moveTo", 10, 20]);
  const missing = create(null); missing.renderer.drawAnnotationLeader(element); assert.equal(missing.calls.length, 0);
});

test("leader terminators preserve open, filled and dot drawing modes", () => {
  const element = { start: { x: 10, y: 20 }, elbow: { x: 20, y: 20 }, end: { x: 30, y: 40 } };
  const open = create(); open.renderer.drawAnnotationLeader({ ...element, style: { terminatorType: "arrow" } });
  assert.equal(open.calls.filter(call => call[0] === "stroke").length, 2);
  assert.equal(open.calls.some(call => call[0] === "fill"), false);
  const filled = create(); filled.renderer.drawAnnotationLeader({ ...element, style: { terminatorType: "filledArrow" } });
  assert.equal(filled.calls.filter(call => call[0] === "fill").length, 1);
  assert.equal(filled.calls.some(call => call[0] === "closePath"), true);
  const dot = create(); dot.renderer.drawAnnotationLeader({ ...element, style: { terminatorType: "dot", terminatorSize: 4 } });
  const circle = dot.calls.find(call => call[0] === "arc");
  assert.deepEqual(circle.slice(1, 3), [10, 20]);
  assert.equal(circle[3], sandbox.window.Appearance.CSS_PX_PER_MM);
});
