const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../../src/rendering/viewport.js"), "utf8"), sandbox);
function create() {
  const rect = { left: 30, top: 50, width: 800, height: 600 };
  const viewport = sandbox.window.CanvasViewport.create({ canvasRect: () => rect, initialScale: 2, minZoom: 0.01, maxZoom: 1000, minLength: 12 });
  return { viewport, rect };
}
test("viewport owns its state and snapshots can be restored without sharing mutable data", () => {
  const { viewport } = create();
  const initial = viewport.snapshot();
  initial.x = 999;
  assert.equal(viewport.x, 0);
  viewport.update({ x: 50, y: -20, scale: 4 });
  const world = { x: 5, y: -7 };
  const screen = viewport.worldToCanvasScreen(world);
  assert.equal(screen.x, 70); assert.equal(screen.y, -48);
  assert.deepEqual({ ...viewport.screenToWorld(screen) }, world);
  viewport.update(initial);
  assert.equal(viewport.x, 999); assert.equal(viewport.scale, 2);
  assert.equal(Object.isFrozen(viewport), true);
});
test("client coordinates use the current canvas rect and viewport transform", () => {
  const { viewport, rect } = create();
  viewport.update({ x: 10, y: 20 });
  assert.deepEqual({ ...viewport.canvasPoint({ clientX: 50, clientY: 90 }) }, { x: 5, y: 10 });
  rect.left = 40;
  assert.equal(viewport.canvasPoint({ clientX: 50, clientY: 90 }).x, 0);
  rect.width = 0;
  assert.equal(viewport.currentCanvasCenterWorld(), null);
});
test("fit preserves minimum extent, zoom limits and center alignment", () => {
  const { viewport, rect } = create();
  assert.equal(viewport.fitBoundsToViewport({ x1: 0, y1: 0, x2: 100, y2: 100 }, 100), true);
  assert.equal(viewport.scale, 4);
  assert.deepEqual({ ...viewport.worldToCanvasScreen({ x: 50, y: 50 }) }, { x: 400, y: 300 });
  assert.equal(viewport.clampZoom(2000), 1000);
  assert.equal(viewport.clampZoom(0), 0.01);
  const before = viewport.snapshot(); rect.height = 0;
  assert.equal(viewport.fitBoundsToViewport({ x1: 0, y1: 0, x2: 1, y2: 1 }), false);
  assert.deepEqual(viewport.snapshot(), before);
});

test("visible world bounds and screen boxes use the same current transform", () => {
  const { viewport } = create();
  viewport.update({ x: 100, y: 50, scale: 4 });
  assert.deepEqual({ ...viewport.visibleWorldBounds() }, { x1: -25, y1: -12.5, x2: 175, y2: 137.5 });
  assert.deepEqual({ ...viewport.screenBoxForBounds({ x1: 3, y1: 5, x2: -2, y2: -1 }) }, { left: 92, right: 112, top: 46, bottom: 70 });
  assert.equal(viewport.screenBoxForBounds(null), null);
  assert.equal(viewport.formatZoom(2), "100%");
});
