const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ["src/geometry/geometry_kernel.js", "src/geometry/hatch_region.js", "src/document/appearance.js", "src/rendering/hatch_renderer.js"]) vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
const loop = (x1, y1, x2, y2) => ({ points: [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }] });
const resolved = { ok: true, loops: [loop(0, 0, 20, 20), loop(5, 5, 10, 10)] };
function harness(scale = sandbox.window.Appearance.CSS_PX_PER_MM, bounds = { x1: 0, y1: 0, x2: 20, y2: 20 }, isVisibleValue) {
  const calls = [], ctx = {}, viewport = { scale };
  for (const name of ["save", "restore", "beginPath", "moveTo", "lineTo", "closePath", "clip", "fill", "stroke"]) ctx[name] = (...args) => calls.push([name, ...args]);
  const renderer = sandbox.window.HatchRenderer.create({ isVisibleValue, viewport, visibleWorldBounds: () => bounds, canvasThemeColor: color => `theme:${color}` });
  const appearance = { ...sandbox.window.Appearance.DEFAULT_HATCH_APPEARANCE, patternType: "parallel", angle: 0, spacing: 2 };
  return { calls, ctx, viewport, appearance, draw: (region = resolved, style = appearance, origin = { x: 0, y: 0 }, state) => renderer.drawResolvedHatchContent(ctx, region, style, origin, state) };
}
test("resolved loop bounds include holes and disconnected loops without a canvas", () => {
  assert.equal(sandbox.window.HatchRegionEngine.resolvedLoopBounds(null), null);
  assert.equal(sandbox.window.HatchRegionEngine.resolvedLoopBounds({ loops: [] }), null);
  const region = { loops: [loop(-5, 2, 3, 8), loop(10, -4, 12, 6)] };
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.HatchRegionEngine.resolvedLoopBounds(region))), { x1: -5, y1: -4, x2: 12, y2: 8 });
});
test("solid hatches clip and fill holes with even-odd and preserve selection emphasis", () => {
  const h = harness(); h.draw(resolved, { ...h.appearance, patternType: "solid", opacity: 0.4 }, undefined, { selected: true, alpha: 0.5 });
  assert.deepEqual(h.calls.filter(call => ["clip", "fill"].includes(call[0])), [["clip", "evenodd"], ["fill", "evenodd"]]);
  assert.equal(h.calls.filter(call => call[0] === "closePath").length, 4);
  assert.equal(h.ctx.globalAlpha, 0.2); assert.equal(h.ctx.fillStyle, "theme:#2563eb");
  assert.equal(h.calls.at(-1)[0], "restore");
});
function patternSegments(h) {
  const start = h.calls.findLastIndex(call => call[0] === "beginPath");
  return h.calls.slice(start + 1).filter(call => call[0] === "moveTo" || call[0] === "lineTo");
}
test("pattern spacing follows screen scale and origin sets phase; cross adds an orthogonal family", () => {
  const h = harness(); h.draw(resolved, h.appearance, { x: 0, y: 1 });
  const moves = patternSegments(h).filter(call => call[0] === "moveTo");
  assert.equal(moves[1][2] - moves[0][2], 2); assert.ok(moves.every(call => Math.abs(call[2] % 2) === 1));
  h.calls.length = 0; h.viewport.scale *= 2; h.draw();
  const zoomed = patternSegments(h).filter(call => call[0] === "moveTo");
  assert.equal(zoomed[1][2] - zoomed[0][2], 1);
  const cross = harness(); cross.draw(resolved, { ...cross.appearance, patternType: "cross" });
  const segments = patternSegments(cross);
  assert.ok(segments.some((call, i) => call[0] === "moveTo" && Math.abs(call[1] - segments[i + 1][1]) < 1e-10));
  assert.ok(segments.some((call, i) => call[0] === "moveTo" && call[2] === segments[i + 1][2]));
});
test("invalid, hidden and offscreen hatches do not touch the canvas; preview remains clipped", () => {
  const h = harness(); h.draw({ ...resolved, ok: false }); h.draw(resolved, { ...h.appearance, visible: false }); h.draw({ ok: true, loops: [] });
  assert.equal(h.calls.length, 0);
  const off = harness(1, { x1: 30, y1: 30, x2: 40, y2: 40 }); off.draw(); assert.equal(off.calls.length, 0);
  h.draw(resolved, h.appearance, undefined, { preview: true });
  assert.ok(h.calls.findIndex(call => call[0] === "clip") < h.calls.findIndex(call => call[0] === "fill"));
  assert.equal(h.ctx.strokeStyle, "theme:#0ea5e9"); assert.equal(h.calls.at(-1)[0], "restore");
});

test("show hidden override paints without changing appearance and restores when switched off", () => {
  let showHidden = false;
  const h = harness(undefined, undefined, visible => showHidden || visible !== false);
  const appearance = { ...h.appearance, visible: false, patternType: "solid" };
  h.draw(resolved, appearance); assert.equal(h.calls.length, 0);
  showHidden = true; h.draw(resolved, appearance); assert.ok(h.calls.some(call => call[0] === "fill"));
  assert.equal(appearance.visible, false);
  h.calls.length = 0; showHidden = false; h.draw(resolved, appearance); assert.equal(h.calls.length, 0);
});

function layerHarness() {
  const calls = [], ctx = {}, selected = new Set();
  const selection = { inspectionContains: item => selected.has(item), geometryInstances: [], blockInstances: [], hatches: [] };
  const state = { exporting: false, mode: "select", hover: {}, command: { regions: [], preview: null }, all: [] };
  class Line {} class Circle {} class Arc {} class Spline {}
  const boundaryItems = [new Spline(), new Arc(), new Line(), new Circle()];
  const layer = sandbox.window.HatchRenderer.createLayer({
    ctx, drawResolvedHatchContent: (...args) => calls.push(["content", ...args]),
    hatchBoundaryGeometryItems: () => boundaryItems,
    boundaryPainters: [Line, Circle, Arc, Spline].map(type => ({ type, draw: (items, options) => calls.push([type.name, ...items, options]) })),
    allHatches: () => state.all, isVisibleSketchId: id => id !== "hidden",
    hatchAppearanceForDisplay: item => item.appearance, isConstraintOperandSelected: item => Boolean(item.operand),
    canvasSelection: selection, activeSketchId: () => "active", readHover: () => state.hover,
    resolvedHatchBoundary: item => item.resolved, hatchPatternOrigin: item => item.origin,
    isExporting: () => state.exporting, sketchAlpha: () => 0.5, readMode: () => state.mode, readCommand: () => state.command,
  });
  const hatch = { sketchId: "active", appearance: {}, resolved, origin: { x: 2, y: 3 } };
  return { layer, calls, ctx, state, hatch, selection, selected, boundaryItems };
}

test("hatch layer paints content before ordered boundary overlays and omits overlays for previews", () => {
  const h = layerHarness(); h.layer.drawResolvedHatch(resolved, {}, undefined, { hatch: h.hatch });
  assert.deepEqual(h.calls.map(call => call[0]), ["content", "Line", "Circle", "Arc", "Spline"]);
  assert.equal(h.calls[0][1], h.ctx);
  assert.equal(h.calls[1][1], h.boundaryItems[2]);
  assert.ok(h.calls.slice(1).every(call => call.at(-1).selectionGlow === false));
  h.calls.length = 0; h.layer.drawResolvedHatch(resolved, {}, undefined, { hatch: h.hatch, preview: true });
  assert.deepEqual(h.calls.map(call => call[0]), ["content"]);
});

test("hatch layer preserves inspection and direct, Block and derived selection and hover", () => {
  const h = layerHarness();
  for (const kind of ["direct", "block", "derived", "inspection", "operand"]) {
    h.calls.length = 0; h.selection.hatches.length = h.selection.blockInstances.length = h.selection.geometryInstances.length = 0;
    const hatch = { ...h.hatch };
    h.state.hover = {};
    if (kind === "direct") { h.selection.hatches.push(hatch); h.state.hover.hatch = hatch; }
    if (kind === "block") { hatch.blockProjection = true; hatch.blockInstance = {}; h.selection.blockInstances.push(hatch.blockInstance); h.state.hover.block = hatch.blockInstance; }
    if (kind === "derived") { hatch.derivedProjection = true; hatch.derivedInstance = {}; h.selection.geometryInstances.push(hatch.derivedInstance); h.state.hover.geometryInstance = hatch.derivedInstance; }
    if (kind === "inspection") { hatch.sketchId = "other"; h.selected.add(hatch); }
    if (kind === "operand") hatch.operand = true;
    h.layer.drawHatches([hatch]);
    const call = h.calls[0]; assert.equal(call[2], resolved); assert.equal(call[3], hatch.appearance); assert.equal(call[4], hatch.origin);
    assert.equal(call[5].selected, true); assert.equal(call[5].hovered, ["direct", "block", "derived"].includes(kind)); assert.equal(call[5].alpha, 0.5);
  }
});

test("hatch layer reads live draft state, skips hidden Sketches and suppresses preview in export", () => {
  const h = layerHarness(); h.state.all = [{ ...h.hatch, sketchId: "hidden" }, h.hatch]; h.selection.hatches.push(h.hatch); h.state.hover.hatch = h.hatch;
  const region = { resolved, selected: true }; h.state.mode = "hatch-repair";
  h.state.command = { regions: [region], preview: { result: { ok: true, resolved } } };
  h.layer.drawHatches();
  const calls = h.calls.filter(call => call[0] === "content"); assert.equal(calls.length, 3); assert.equal(calls[1][2], resolved); assert.equal(calls[1][5].preview, true); assert.equal(calls[1][5].selected, true); assert.equal(calls[2][5].preview, true);
  h.calls.length = 0; h.state.exporting = true; h.layer.drawHatches();
  assert.equal(h.calls.filter(call => call[0] === "content").length, 1);
  assert.equal(h.calls[0][5].selected, false); assert.equal(h.calls[0][5].hovered, false);
  h.calls.length = 0; h.state.exporting = false; h.layer.drawHatches([], { includePreview: false }); assert.equal(h.calls.length, 0);
});
