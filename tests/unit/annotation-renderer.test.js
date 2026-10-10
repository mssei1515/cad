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

test("parameter decimal places format text and projected leaders without changing evaluation", () => {
  const { displayText } = sandbox.window.AnnotationRenderer;
  const element = { parameterEnabled: true, evaluatedParameterValue: 1.2, style: { precision: 3, prefix: "P:", suffix: "mm" } };
  assert.equal(displayText(element), "P:1.200mm");
  assert.equal(element.evaluatedParameterValue, 1.2);
  assert.equal(displayText({ localElement: element, style: element.style }), "P:1.200mm");
  assert.equal(displayText({ ...element, style: { precision: 0 } }), "1");
  assert.equal(displayText({ ...element, style: { precision: null } }, value => `auto:${value}`), "auto:1.2");
  assert.equal(displayText({ ...element, evaluatedParameterValue: NaN }), "P:—mm");
  assert.equal(displayText({ ...element, parameterEnabled: false, text: "plain" }), "plain");
  const style = sandbox.window.Appearance.annotationStoredStyle({ type: "leader", appearanceInheritance: true, style: { precision: 3 } });
  assert.equal(style.precision, 3);
});

test("OFF leaders scale text, terminators and strokes while keeping all path coordinates", () => {
  const h = create();
  const px = sandbox.window.Appearance.CSS_PX_PER_MM;
  h.viewport.scale = px * 3;
  const element = { start: { x: 10, y: 20 }, elbow: { x: 30, y: 20 }, end: { x: 40, y: 20 }, x: 40, y: 20, text: "note",
    shelfReferenceScale: px * 1.5, style: { fixedDisplaySize: false, displayScale: 1.5, textHeight: 3, terminatorType: "dot", terminatorSize: 2, lineWidth: 1.5 } };
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
    assert.ok(Math.abs(renderer.annotationLeaderDisplayGeometry(element).end.y - layout.bounds.y2 - layout.strokeHalfWidth - layout.gapWorld) < 1e-8);
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

test("shelf display preserves signed span and rotated block direction, and legacy baseline is 100 percent", () => {
  const h = create({ x: 0, y: 0 }), px = sandbox.window.Appearance.CSS_PX_PER_MM;
  for (const vector of [{ x: -20, y: 0 }, { x: 0, y: 20 }]) {
    const element = { type: "leader", start: { x: 0, y: 0 }, elbow: { x: 30, y: 40 },
      end: { x: 30 + vector.x, y: 40 + vector.y }, x: 35, y: 20, shelfReferenceScale: 3, style: {} };
    const before = JSON.stringify(element);
    h.viewport.scale = 3;
    const a = h.renderer.annotationLeaderDisplayGeometry(element);
    h.viewport.scale = 6;
    const b = h.renderer.annotationLeaderDisplayGeometry(element);
    assert.equal((b.end.x - b.elbow.x) * 6, (a.end.x - a.elbow.x) * 3);
    assert.equal((b.end.y - b.elbow.y) * 6, (a.end.y - a.elbow.y) * 3);
    assert.equal(b.x * 6, a.x * 3);
    assert.equal(b.elbow.x * 6, a.elbow.x * 3);
    assert.equal(b.elbow.y * 6, a.elbow.y * 3);
    assert.equal(JSON.stringify(element), before);
    element.style = { fixedDisplaySize: false, displayScale: 6 / px };
    const locked = h.renderer.annotationLeaderDisplayGeometry(element);
    h.viewport.scale = 12;
    const zoomed = h.renderer.annotationLeaderDisplayGeometry(element);
    assert.deepEqual(zoomed, locked);
    delete element.shelfReferenceScale; element.style = {};
    h.viewport.scale = px;
    assert.equal(JSON.stringify(h.renderer.annotationLeaderDisplayGeometry(element).end), JSON.stringify(element.end));
  }
});

test("leader elbow, shelf and legacy label follow anchor displacement without rewriting saved coordinates", () => {
  const anchor = { x: 10, y: 20 }, h = create(anchor);
  const element = { type: "leader", start: { x: 10, y: 20 }, elbow: { x: 30, y: 40 }, end: { x: 60, y: 40 },
    x: 45, y: 35, shelfReferenceScale: 2, style: {} };
  const saved = JSON.stringify(element);
  for (const scale of [1, 2, 5]) {
    h.viewport.scale = scale;
    anchor.x = 10; anchor.y = 20;
    const before = h.renderer.annotationLeaderDisplayGeometry(element);
    anchor.x = 37; anchor.y = -5;
    const after = h.renderer.annotationLeaderDisplayGeometry(element);
    assert.equal((after.elbow.x - anchor.x) * scale, 40); assert.equal((after.elbow.y - anchor.y) * scale, 40);
    for (const key of ["elbow", "end"]) {
      assert.equal(after[key].x - before[key].x, 27); assert.equal(after[key].y - before[key].y, -25);
    }
    assert.equal(after.x - before.x, 27); assert.equal(after.y - before.y, -25);
    assert.equal(JSON.stringify(element), saved);
  }
});


test("shelf text has a half-font-height inset in either direction and rotated blocks", () => {
  const h = create();
  for (const scale of [1, 4]) for (const direction of [-1, 1]) for (const angle of [0, Math.PI / 2, Math.PI]) {
    h.viewport.scale = scale;
    const c = Math.cos(angle), s = Math.sin(angle);
    const element = { type: "leader", textPlacement: "shelf", text: "Label", start: { x: 0, y: 0 },
      elbow: { x: 30 * c - 40 * s, y: 30 * s + 40 * c },
      end: { x: (30 + direction * 20) * c - 40 * s, y: (30 + direction * 20) * s + 40 * c },
      annotationTransformRotation: angle, shelfReferenceScale: 2, style: {} };
    const layout = h.renderer.annotationTextLayout(element), geometry = h.renderer.annotationLeaderDisplayGeometry(element);
    const left = direction < 0 ? geometry.end : geometry.elbow;
    assert.ok(Math.abs((layout.x - left.x) * c + (layout.y - left.y) * s - layout.fontSize / 2) < 1e-8);
  }
});
