const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ["src/geometry/geometry_kernel.js", "src/geometry/spline_geometry.js", "src/solver/constraint_solver.js", "src/document/appearance.js", "src/rendering/dimension_metrics.js", "src/rendering/terminator_renderer.js", "src/rendering/annotation_renderer.js"]) vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
function create(anchor = { x: 10, y: 20 }) {
  const calls = [], ctx = {}, viewport = { scale: 2 };
  let anchorReads = 0;
  for (const name of ["save", "restore", "translate", "rotate", "fillText", "beginPath", "moveTo", "lineTo", "stroke", "closePath", "fill", "arc", "setLineDash"]) ctx[name] = (...args) => calls.push([name, ...args]);
  ctx.measureText = text => ({ width: text.length * 8 });
  const renderer = sandbox.window.AnnotationRenderer.create({ ctx, viewport, withCanvasState: callback => callback(), annotationDisplayColor: () => "blue", annotationLeaderAnchor: () => { anchorReads++; return anchor; }, appearanceLineDash: () => [1, 2] });
  return { renderer, viewport, ctx, calls, anchorReads: () => anchorReads };
}

test("OFF leaders scale text, terminators and strokes while keeping all path coordinates", () => {
  const h = create();
  const px = sandbox.window.Appearance.CSS_PX_PER_MM;
  h.viewport.scale = px * 3;
  const element = { start: { x: 10, y: 20 }, elbow: { x: 30, y: 20 }, end: { x: 40, y: 20 }, x: 40, y: 20, text: "note",
    style: { fixedDisplaySize: false, displayScale: 1.5, textHeight: 3, terminatorType: "dot", terminatorSize: 2, lineWidth: 1.5 } };
  h.renderer.drawAnnotationLeader(element);
  assert.equal(parseFloat(h.ctx.font), 2);
  assert.ok(Math.abs(h.ctx.lineWidth * h.viewport.scale - 3) < 1e-12);
  assert.ok(h.calls.some(call => call[0] === "arc" && call[1] === 10 && call[2] === 20 && Math.abs(call[3] - 2 / 3) < 1e-12));
  for (const expected of [["moveTo", 10, 20], ["lineTo", 30, 20], ["lineTo", 40, 20]]) assert.ok(h.calls.some(call => JSON.stringify(call) === JSON.stringify(expected)));
  h.viewport.scale *= 2;
  assert.equal(h.renderer.annotationTextWorldHeight(element.style), 2);
  assert.equal(element.style.displayScale, 1.5);
});
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

 test("annotation affixes render multiline text around the existing anchor", () => {
  const h = create();
  h.renderer.drawAnnotationText({ text: "body", parameterEnabled: true, evaluatedParameterValue: 120, x: 3, y: 4, style: { prefix: "top\n", suffix: "\nend", textHeight: 3 } });
  const text = h.calls.filter(call => call[0] === "fillText");
  assert.deepEqual(text.map(call => call[1]), ["top", "120", "end"]);
  const height = h.renderer.annotationTextWorldHeight({ textHeight: 3 });
  assert.equal(text[0][3], -height * 1.2);
  assert.equal(text[1][3], 0);
  assert.equal(text[2][3], height * 1.2);
});

test("unchecked text preserves its body and projected parameters read their definition source", () => {
  const render = sandbox.window.AnnotationRenderer.displayText;
  assert.equal(render({ text: 'body', style: { prefix: 'prefix', suffix: 'suffix' } }), 'body');
  assert.equal(render({ text: 'body', parameterEnabled: true, localElement: { parameterEnabled: true, evaluatedParameterValue: 150 }, style: { prefix: 'Width: ', suffix: ' mm' } }), 'Width: 150 mm');
});

test("leaders and dimensions use identical terminal paths for all types and angles", () => {
  for (const terminatorType of ["arrow", "filledArrow", "dot", "none"]) for (const angle of [15, 30, 75]) {
    const leader = create({ x: 10, y: 20 }), shared = create();
    const style = { ...sandbox.window.Appearance.DEFAULT_DIMENSION_APPEARANCE, terminatorType, arrowheadAngle: angle, lineWidth: 2, terminatorSize: 4 };
    leader.renderer.drawAnnotationLeader({ start: { x: 10, y: 20 }, elbow: { x: 30, y: 20 }, end: { x: 40, y: 20 }, style });
    shared.ctx.lineWidth = 1;
    sandbox.window.TerminatorRenderer.create({ ctx: shared.ctx, viewport: shared.viewport }).draw({ x: 10, y: 20 }, { x: 1, y: 0 }, style);
    const terminalStart = leader.calls.findIndex(c => c[0] === "setLineDash" && c[1].length === 0) + 1;
    assert.deepEqual(leader.calls.slice(terminalStart), shared.calls);
  }
});

test("shelf text gap follows text bounds, rotation, multiline labels and display zoom without changing geometry", () => {
  const h = create();
  const element = { type: "leader", appearanceInheritance: true, textPlacement: "shelf", text: "Text",
    start: { x: 10, y: 20 }, elbow: { x: 30, y: 40 }, end: { x: 70, y: 40 }, style: { textGap: 2, textHeight: 5, lineWidth: 2 } };
  // This harness resolves styles directly; use the production hierarchy to retain Leader-only settings.
  const renderer = sandbox.window.AnnotationRenderer.create({ ctx: h.ctx, viewport: h.viewport,
    effectiveAnnotationStyle: item => sandbox.window.Appearance.resolveLeaderAppearance({}, {}, {}, item.style) });
  const original = JSON.stringify(element);
  for (const rotation of [0, 0.7, -1, Math.PI]) {
    element.style.rotation = rotation;
    element.text = "First\nSecond";
    const layout = renderer.annotationTextLayout(element);
    assert.ok(Math.abs(element.end.y - layout.bounds.y2 - layout.strokeHalfWidth - layout.gapWorld) < 1e-8);
    assert.ok(Math.abs(layout.gapWorld * h.viewport.scale - 2 * sandbox.window.Appearance.CSS_PX_PER_MM) < 1e-8);
  }
  element.style.fixedDisplaySize = false; element.style.displayScale = 1.5;
  const before = renderer.annotationTextLayout(element);
  h.viewport.scale *= 2;
  const after = renderer.annotationTextLayout(element);
  assert.equal(before.gapWorld, after.gapWorld);
  assert.deepEqual(element.elbow, JSON.parse(original).elbow);
  assert.deepEqual(element.end, JSON.parse(original).end);
  assert.equal(renderer.annotationTextLayout({ ...element, textPlacement: undefined }), null);
});
