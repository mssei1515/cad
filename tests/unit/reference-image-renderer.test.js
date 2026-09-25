const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../../src/rendering/reference_image_renderer.js"), "utf8"), sandbox);
function create() {
  const calls = [], resources = [];
  let loads = 0;
  const ctx = {};
  for (const name of ["translate", "rotate", "scale", "drawImage", "setLineDash", "beginPath", "moveTo", "lineTo", "closePath", "stroke", "fillText", "arc", "fill"]) ctx[name] = (...args) => calls.push([name, ...args]);
  const renderer = sandbox.window.ReferenceImageRenderer.create({
    ctx, viewport: { scale: 2 }, withCanvasState: callback => callback(), onImageLoad: () => loads++,
    createImage: () => { const image = { complete: false, naturalWidth: 0, addEventListener(type, listener, options) { this.listener = listener; assert.equal(type, "load"); assert.equal(options.once, true); } }; resources.push(image); return image; },
    referenceImageCorners: () => [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 20 }, { x: 0, y: 20 }],
  });
  return { renderer, resources, calls, loads: () => loads, ctx };
}
const item = () => ({ dataUrl: "data:image/png;base64,test", x: 3, y: 4, rotation: 0.5, scale: 2, opacity: 0.4, pixelWidth: 10, pixelHeight: 20 });
test("resources are shared by URL, skip incomplete images and refresh after clear", () => {
  const h = create(), a = item();
  h.renderer.drawImages([a, { ...a }]);
  assert.equal(h.resources.length, 1); assert.equal(h.calls.length, 0);
  Object.assign(h.resources[0], { complete: true, naturalWidth: 10 }); h.resources[0].listener();
  assert.equal(h.loads(), 1);
  h.renderer.drawImages([a]);
  assert.deepEqual(h.calls.map(call => call[0]), ["translate", "rotate", "scale", "drawImage"]);
  assert.deepEqual(h.calls.at(-1).slice(2), [-5, -10, 10, 20]);
  assert.equal(h.ctx.globalAlpha, 0.4);
  h.renderer.clear(); h.renderer.drawImages([a]); assert.equal(h.resources.length, 2);
});
test("selection overlays include the lock and calibration markers keep screen size", () => {
  const h = create();
  h.renderer.drawOverlays({ ...item(), locked: true }, true, [{ x: 1, y: 2 }, { x: 3, y: 4 }]);
  assert.equal(h.calls.find(call => call[0] === "fillText")[1], "🔒");
  assert.deepEqual(h.calls.filter(call => call[0] === "arc").map(call => call.slice(1, 4)), [[1, 2, 2.5], [3, 4, 2.5]]);
});
