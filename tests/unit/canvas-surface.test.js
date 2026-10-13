const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../../src/rendering/canvas_surface.js"), "utf8"), sandbox);
function create() {
  const calls = [], observers = [];
  let dpr = 2, redraws = 0;
  const canvas = { width: 0, height: 0, getBoundingClientRect: () => ({ width: 100.5, height: 70.25 }) };
  const ctx = { setTransform: (...args) => calls.push(["transform", ...args]), setLineDash: value => calls.push(["dash", ...value]), save: () => calls.push(["save"]), restore: () => calls.push(["restore"]) };
  class Observer { constructor(callback) { this.callback = callback; observers.push(this); } observe(target) { assert.equal(target, canvas); } disconnect() { this.disconnected = true; } }
  const surface = sandbox.window.CanvasSurface.create({ canvas, ctx, viewport: { scale: 2 }, readPixelRatio: () => dpr, ResizeObserverClass: Observer, onResize: () => redraws++ });
  return { surface, canvas, ctx, calls, observers, redraws: () => redraws, setDpr: value => { dpr = value; } };
}
test("bitmap sizing floors device pixels, keeps CSS metrics and detects DPR changes", () => {
  const h = create();
  assert.equal(h.surface.syncCanvasBitmapSize(), true);
  assert.equal(h.canvas.width, 201); assert.equal(h.canvas.height, 140);
  assert.equal(h.surface.width, 100.5); assert.equal(h.surface.height, 70.25);
  assert.equal(h.surface.syncCanvasBitmapSize(), false);
  h.setDpr(1); assert.equal(h.surface.syncCanvasBitmapSize(), true);
  assert.equal(h.surface.dpr, 1);
  h.surface.syncCanvasBitmapSize(0, 0); assert.equal(h.canvas.width, 1); assert.equal(h.canvas.height, 1);
});
test("resize observer is owned once and only changed bitmap metrics trigger redraw", () => {
  const h = create(); h.surface.start(); h.surface.start(); assert.equal(h.observers.length, 1);
  h.observers[0].callback([]); assert.equal(h.redraws(), 0);
  const entry = { contentRect: { width: 100, height: 70 } };
  h.observers[0].callback([entry]); h.observers[0].callback([entry]); assert.equal(h.redraws(), 1);
  h.surface.dispose(); assert.equal(h.observers[0].disconnected, true);
  h.surface.start(); assert.equal(h.observers.length, 2);
});
test("drawing failures restore context and reset leaking stroke state", () => {
  const h = create(), error = new Error("draw");
  assert.throws(() => h.surface.withCanvasState(() => { h.ctx.globalAlpha = 0.2; h.ctx.shadowBlur = 8; throw error; }), caught => caught === error);
  assert.deepEqual(h.calls.map(call => call[0]), ["save", "dash", "restore", "dash"]);
  assert.equal(h.ctx.globalAlpha, 1); assert.equal(h.ctx.shadowBlur, 0); assert.equal(h.ctx.lineJoin, "miter");
  assert.deepEqual(Array.from(h.surface.appearanceLineDash("dashdot")), [6, 2, 1, 2]);
});

function createFrameHarness() {
  const calls = [], canvas = { width: 200, height: 120 }, viewport = { x: 10, y: 20, scale: 3 };
  let frame = null, width = 0, height = 0, dpr = 2, failure = null;
  const ctx = Object.fromEntries(['setTransform', 'clearRect', 'save', 'translate', 'scale', 'restore'].map(name => [name, (...args) => calls.push([name, ...args])]));
  const surface = { get width() { return width; }, get height() { return height; }, get dpr() { return dpr; },
    syncCanvasBitmapSize() { assert.equal(this, surface); calls.push(['size']); width = 100; height = 60; },
    resetCanvasStrokeState() { assert.equal(this, surface); calls.push(['stroke']); },
  };
  function stage(name) { return () => { calls.push([name]); if (failure === name) throw new Error(name); }; }
  const renderer = sandbox.window.CanvasSurface.createFrameRenderer({ canvas, ctx, viewport, surface,
    syncZoom: stage('zoom'), readExportFrame: () => frame, recordDraw: stage('record'),
    drawContent: stage('content'), drawExport: stage('export'), drawInteractive: stage('interactive'),
  });
  return { renderer, calls, viewport, setFrame: value => { frame = value; }, setDpr: value => { dpr = value; }, fail: value => { failure = value; } };
}
test('canvas frame uses live DPR/viewport and preserves interactive versus PNG stage and stroke/transform order', () => {
  const h = createFrameHarness(); h.renderer.draw();
  assert.deepEqual(h.calls, [['zoom'], ['size'], ['record'], ['setTransform', 1, 0, 0, 1, 0, 0], ['stroke'], ['clearRect', 0, 0, 200, 120],
    ['setTransform', 2, 0, 0, 2, 0, 0], ['stroke'], ['save'], ['translate', 10, 20], ['scale', 3, 3], ['stroke'], ['content'], ['interactive'], ['stroke'], ['restore'], ['stroke']]);
  h.calls.length = 0; h.setFrame({ ratio: { x: 4, y: 5 }, region: { x: 6, y: 7 } }); h.viewport.scale = 8; h.renderer.draw();
  assert.deepEqual(h.calls, [['zoom'], ['setTransform', 1, 0, 0, 1, 0, 0], ['stroke'], ['clearRect', 0, 0, 200, 120],
    ['setTransform', 4, 0, 0, 5, -24, -35], ['stroke'], ['save'], ['translate', 10, 20], ['scale', 8, 8], ['stroke'], ['content'], ['export'], ['restore'], ['stroke']]);
  h.calls.length = 0; h.setFrame(null); h.setDpr(1.5); h.renderer.draw();
  assert.ok(h.calls.some(call => call[0] === 'record'));
  assert.deepEqual(h.calls.filter(call => call[0] === 'setTransform').at(-1), ['setTransform', 1.5, 0, 0, 1.5, 0, 0]);
});
test('canvas frame propagates stage failures without introducing new restore/finally semantics', () => {
  for (const stage of ['content', 'interactive', 'export']) {
    const h = createFrameHarness(); if (stage === 'export') h.setFrame({ ratio: { x: 1, y: 1 }, region: { x: 0, y: 0 } });
    h.fail(stage); assert.throws(() => h.renderer.draw(), new RegExp(stage));
    assert.equal(h.calls.at(-1)[0], stage); assert.equal(h.calls.some(call => call[0] === 'restore'), false);
  }
});
