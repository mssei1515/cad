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

function layerFixture() {
  const calls = [], inspected = new Set();
  const selection = { inspection: null, referenceImages: [], inspectionContains: item => inspected.has(item) };
  const state = { images: [], hover: {}, calibration: null };
  const renderer = { drawImages: items => calls.push(['images', items]), drawOverlays: (...args) => calls.push(['overlays', ...args]) };
  const layer = sandbox.window.ReferenceImageRenderer.createLayer({
    renderer, readImages: () => state.images, canvasSelection: selection, readHover: () => state.hover,
    isVisibleValue: value => value !== false, isVisibleSketchId: id => id !== 'hidden', activeSketchId: () => 'active',
    readCalibrationPoints: () => state.calibration,
  });
  return { layer, state, selection, inspected, calls };
}

test('image presentation filters visibility using current inputs and preserves image references and order', () => {
  const h = layerFixture();
  const first = { sketchId: 'active' }, last = { sketchId: 'other' };
  h.state.images = [first, { visible: false }, { sketchId: 'hidden' }, last];
  h.layer.drawImages(); assert.deepEqual(h.calls[0][1], [first, last]); assert.equal(h.calls[0][1][0], first);
  h.state.images = [last]; h.layer.drawImages(); assert.deepEqual(h.calls[1][1], [last]);
  assert.equal(h.state.images.length, 1);
});

test('overlay priority is inspection then single selection then hover, without fallback after visibility rejection', () => {
  const h = layerFixture(), inspected = { sketchId: 'other' }, selected = { sketchId: 'active' }, hovered = { sketchId: 'active' };
  h.selection.inspection = { targets: [{ kind: 'line', item: selected }, { kind: 'referenceImage', item: inspected }] };
  h.inspected.add(inspected); h.selection.referenceImages = [selected]; h.state.hover.referenceImage = hovered;
  h.layer.drawOverlays(); assert.deepEqual(h.calls.at(-1).slice(1), [inspected, true, null]);
  inspected.visible = false; h.layer.drawOverlays(); assert.equal(h.calls.at(-1)[1], null);
  h.selection.inspection = null; h.layer.drawOverlays(); assert.equal(h.calls.at(-1)[1], selected);
  h.selection.referenceImages = [selected, inspected]; h.layer.drawOverlays(); assert.equal(h.calls.at(-1)[1], hovered); assert.equal(h.calls.at(-1)[2], false);
  h.state.hover.referenceImage = { sketchId: 'other' }; h.layer.drawOverlays(); assert.equal(h.calls.at(-1)[1], null);
});

test('calibration markers remain available without an eligible overlay and use current interaction data', () => {
  const h = layerFixture(); h.state.calibration = [{ x: 1, y: 2 }];
  h.layer.drawOverlays(); assert.equal(h.calls[0][1], null); assert.equal(h.calls[0][3], h.state.calibration);
  h.state.calibration = [{ x: 3, y: 4 }, { x: 5, y: 6 }]; h.layer.drawOverlays(); assert.equal(h.calls[1][3], h.state.calibration);
  assert.equal(h.selection.referenceImages.length, 0);
});
