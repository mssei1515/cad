const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ["src/document/appearance.js", "src/rendering/dimension_metrics.js", "src/rendering/dimension_renderer.js"]) vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
function harness() {
  const calls = [], marks = [], ctx = {}, viewport = { scale: 2 };
  for (const name of ["save", "restore", "beginPath", "moveTo", "lineTo", "stroke", "arc", "fill", "closePath", "setLineDash", "translate", "rotate", "fillText", "rect", "fillRect"]) ctx[name] = (...args) => calls.push([name, ...args]);
  ctx.measureText = text => ({ width: text.length * 8 });
  const metrics = sandbox.window.DimensionMetrics.create({ ctx, viewport });
  const renderer = sandbox.window.DimensionRenderer.create({ ctx, viewport, metrics, canvasThemeColor: color => color, onExpressionMark: mark => marks.push(mark) });
  const appearance = { ...sandbox.window.Appearance.DEFAULT_DIMENSION_APPEARANCE };
  const input = {
    appearance, label: "120", layout: { text: { x: 60, y: 20 }, textAngle: 0, points: [{ extensionStart: { x: 0, y: 2 }, extensionEnd: { x: 0, y: 23 } }, { showExtension: false, extensionStart: { x: 120, y: 2 }, extensionEnd: { x: 120, y: 23 } }] },
    renderPlan: { lineStart: { x: 0, y: 20 }, lineEnd: { x: 120, y: 20 }, firstTerminator: { point: { x: 0, y: 20 }, direction: { x: 1, y: 0 } }, secondTerminator: { point: { x: 120, y: 20 }, direction: { x: -1, y: 0 } }, shafts: [{ start: { x: 0, y: 20 }, end: { x: -10, y: 20 } }] },
  };
  return { renderer, ctx, calls, marks, input };
}
test("linear painter respects prepared extension visibility and outside shafts, then clears preview dash for arrows", () => {
  const h = harness(); h.renderer.drawLinear({ ...h.input, preview: true });
  assert.ok(h.calls.some(c => c[0] === "lineTo" && c[1] === 0 && c[2] === 23));
  assert.ok(!h.calls.some(c => c[0] === "lineTo" && c[1] === 120 && c[2] === 23));
  assert.ok(h.calls.some(c => c[0] === "lineTo" && c[1] === -10 && c[2] === 20));
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls.filter(c => c[0] === "setLineDash"))), [["setLineDash", [2.5, 2]], ["setLineDash", []]]);
  assert.equal(h.ctx.strokeStyle, "#2563eb"); assert.equal(h.calls.at(-1)[0], "restore");
});
test("radius painter accepts a single terminator and curved extension without needing the source arc", () => {
  const h = harness();
  const arcExtension = { center: { x: 8, y: 9 }, radius: 40, startAngle: 1, endAngle: 2, counterclockwise: true };
  h.renderer.drawLinear({ ...h.input, appearance: { ...h.input.appearance, terminatorType: "dot" }, renderPlan: { ...h.input.renderPlan, firstTerminator: null }, arcExtension });
  const arcs = h.calls.filter(c => c[0] === "arc");
  assert.deepEqual(arcs[0], ["arc", 8, 9, 40, 1, 2, true]); assert.equal(arcs.length, 2);
  assert.deepEqual(arcs[1].slice(1, 3), [120, 20]);
});
test("dimension labels handle formula marks, hidden editing and invalid selection state", () => {
  const formula = harness(); formula.renderer.drawLinear({ ...formula.input, expressionMark: true });
  assert.equal(formula.marks.length, 1); assert.equal(formula.marks[0].pointCount, 6); assert.equal(formula.marks[0].filled, true);
  const hidden = harness(); hidden.renderer.drawLinear({ ...hidden.input, editState: { hidden: true }, expressionMark: true });
  assert.ok(!hidden.calls.some(c => c[0] === "fillText")); assert.equal(hidden.marks.length, 0);
  const selected = harness(); selected.renderer.drawLinear({ ...selected.input, editState: { selecting: true } });
  assert.ok(selected.calls.some(c => c[0] === "fillRect"));
  const invalid = harness(); invalid.renderer.drawLinear({ ...invalid.input, editState: { selecting: true, invalid: true } });
  assert.ok(!invalid.calls.some(c => c[0] === "fillRect")); assert.equal(invalid.ctx.fillStyle, "#dc2626");
});
test("angle painter preserves signed sweeps and outside arc extension", () => {
  for (const signed of [1, -1]) {
    const h = harness(); const layout = { vertex: { x: 1, y: 2 }, radius: 30, start: 0, end: signed, signed, text: { x: 15, y: 20 }, textAngle: 0.4 };
    const extensions = [{ start: { x: 1, y: 2 }, end: { x: 31, y: 2 } }, { start: { x: 1, y: 2 }, end: { x: 11, y: 22 } }];
    h.renderer.drawAngle({ layout, extensions, outside: true, arcExtension: 0.2, appearance: { ...h.input.appearance, terminatorType: "filledArrow" }, label: "60°" });
    assert.deepEqual(h.calls.find(c => c[0] === "arc"), ["arc", 1, 2, 30, -Math.sign(signed) * 0.2, signed + Math.sign(signed) * 0.2, signed < 0]);
    assert.equal(h.calls.filter(c => c[0] === "closePath").length, 2);
    assert.deepEqual(h.calls.find(c => c[0] === "rotate"), ["rotate", 0.4]);
  }
});
