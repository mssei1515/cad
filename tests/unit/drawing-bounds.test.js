const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['geometry/spline_geometry.js', 'geometry/bounds.js', 'geometry/reference_image_geometry.js', 'rendering/drawing_bounds.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src', file), 'utf8'), sandbox);
}
const { GeometryBounds: bounds, ReferenceImageGeometry: images } = sandbox.window;
const plain = value => JSON.parse(JSON.stringify(value));
const box = (x1, y1, x2, y2) => ({ x1, y1, x2, y2 });

test('bounds union ignores invalid input and preserves inclusive rectangle edges', () => {
  const original = box(0, 0, 2, 3);
  assert.equal(bounds.mergeBounds(original, box(NaN, 0, 4, 5)), original);
  assert.deepEqual(plain(bounds.mergeBounds(original, { left: -1, top: -2, right: 4, bottom: 5 })), box(-1, -2, 4, 5));
  assert.deepEqual(original, box(0, 0, 2, 3));
  assert.equal(bounds.pointInRect({ x: 2, y: 3 }, original), true);
  assert.equal(bounds.bboxIntersectsRect(box(2, 3, 4, 5), original), true);
  assert.equal(bounds.bboxInRect(box(0, 0, 2, 3), original), true);
  assert.deepEqual(plain(bounds.rectFromPoints({ x: 2, y: -3 }, { x: -1, y: 5 })), box(-1, -3, 2, 5));
});

test('rotated image coordinates round trip and bounds contain every corner', () => {
  const image = { x: 13, y: -7, rotation: Math.PI / 3, scale: 2.5, pixelWidth: 80, pixelHeight: 30 };
  const world = images.referenceImageLocalToWorld(image, { x: -21, y: 9 });
  const local = images.referenceImageWorldToLocal(image, world);
  assert.ok(Math.abs(local.x + 21) < 1e-12);
  assert.ok(Math.abs(local.y - 9) < 1e-12);
  const extent = images.referenceImageBounds(image);
  assert.equal(images.referenceImageCorners(image).length, 4);
  for (const corner of images.referenceImageCorners(image)) assert.equal(bounds.pointInRect(corner, extent), true);
  assert.ok(Math.abs((extent.x1 + extent.x2) / 2 - image.x) < 1e-12);
});

function fixture() {
  let scope = { lines: [], circles: [], arcs: [], splines: [], points: [], annotations: [], hatches: [], referenceImages: [] };
  let active = 'S1';
  const geometryReads = {};
  for (const [method, key] of Object.entries({ allGeometryLines: 'lines', allGeometryCircles: 'circles', allGeometryArcs: 'arcs', allGeometrySplines: 'splines', allGeometryPoints: 'points', allAnnotations: 'annotations', allHatches: 'hatches' })) geometryReads[method] = () => scope[key];
  const api = sandbox.window.DrawingBounds.create({
    currentScope: () => scope, geometryReads, activeSketchId: () => active, elementSketchId: item => item.sketchId,
    isVisibleSketchElement: item => item.visible !== false && item.sketchId !== 'hidden', isVisibleSketchId: id => id !== 'hidden',
    annotationBounds: item => item.bounds, resolvedLoopBounds: loops => loops.bounds, resolvedHatchBoundary: hatch => hatch,
    hatchAppearanceForDisplay: hatch => hatch.appearance || {},
  });
  return { api, get scope() { return scope; }, setScope: next => { scope = next; }, activate: id => { active = id; } };
}

test('drawing bounds read current scope and active sketch on every call', () => {
  const f = fixture();
  assert.equal(f.api.allGeometryBounds(), null);
  f.scope.points.push({ x: 2, y: 3, sketchId: 'S1' }, { x: -5, y: 9, sketchId: 'S2' });
  assert.deepEqual(plain(f.api.sketchGeometryBounds()), box(2, 3, 2, 3));
  f.activate('S2');
  assert.deepEqual(plain(f.api.sketchGeometryBounds()), box(-5, 9, -5, 9));
  assert.deepEqual(plain(f.api.allGeometryBounds()), box(-5, 3, 2, 9));
  f.setScope({ ...f.scope, points: [], referenceImages: [{ x: 10, y: 20, scale: 1, rotation: 0, pixelWidth: 4, pixelHeight: 6, sketchId: 'S2' }] });
  assert.deepEqual(plain(f.api.sketchGeometryBounds()), box(8, 17, 12, 23));
});

test('visible extents exclude hidden sketches, annotation/image flags and hatch appearance', () => {
  const f = fixture();
  f.scope.points.push({ x: 0, y: 0, sketchId: 'S1' }, { x: 900, y: 900, sketchId: 'hidden' });
  f.scope.annotations.push({ sketchId: 'S1', visible: false, bounds: box(-100, -100, -90, -90) });
  f.scope.hatches.push({ sketchId: 'S1', appearance: { visible: false }, bounds: box(100, 100, 110, 110) });
  f.scope.referenceImages.push({ sketchId: 'S1', visible: false, x: 200, y: 200, scale: 1, rotation: 0, pixelWidth: 10, pixelHeight: 10 });
  assert.deepEqual(plain(f.api.visibleGeometryBounds()), box(0, 0, 0, 0));
  assert.deepEqual(plain(f.api.allGeometryBounds()), box(-100, -100, 900, 900));
  f.scope.hatches[0].appearance.visible = true;
  assert.deepEqual(plain(f.api.visibleGeometryBounds()), box(0, 0, 110, 110));
});

test('primitive extents preserve whole-circle arc bounds and actual spline bounds', () => {
  const f = fixture();
  f.scope.lines.push({ sketchId: 'S1', p1: { x: -10, y: 3 }, p2: { x: 4, y: 8 } });
  f.scope.arcs.push({ sketchId: 'S1', center: { x: 0, y: 0 }, radius: () => 5 });
  assert.deepEqual(plain(f.api.allGeometryBounds()), box(-10, -5, 5, 8));
  const curve = sandbox.window.SplineGeometry.build([{ x: 20, y: 30 }, { x: 21, y: 32 }, { x: 23, y: 36 }, { x: 25, y: 40 }]);
  const spline = { sketchId: 'S1', curve: () => curve };
  assert.deepEqual(plain(bounds.splineBBox(spline)), box(20, 30, 25, 40));
  f.scope.splines.push(spline);
  assert.deepEqual(plain(f.api.allGeometryBounds()), box(-10, -5, 25, 40));
});
