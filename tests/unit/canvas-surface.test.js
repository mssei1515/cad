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
