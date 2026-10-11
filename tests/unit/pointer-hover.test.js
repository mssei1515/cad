const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.resolve(__dirname, '../..');
const sandbox = { window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(p => p.startsWith('src/'))) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox);
function fixture() {
  const hover = sandbox.window.CanvasHover.create({ isEndpointPoint: () => false }), values = {}, calls = [];
  const port = name => (...args) => { calls.push([name, args]); return values[name] || null; };
  const geometry = Object.fromEntries(['hitEndpointPoint', 'hitExplicitPoint', 'hitLine', 'hitCircle', 'hitArcEndpoint', 'hitArc', 'hitSpline'].map(name => [name, port(name)]));
  const scene = Object.fromEntries(['hitDimension', 'hitDerivedProjectionOperand', 'hitBlockProjectionOperand', 'hitReferenceTarget', 'hitSketchIdentityElement', 'hitBlockInstance', 'hitGeometryInstance', 'hitAnnotationElement', 'hitHatchAt', 'hitReferenceImageAt'].map(name => [name, port(name)]));
  scene.hitAnnotationInteraction = (...args) => values.interaction?.(...args) || null;
  const controller = sandbox.window.PointerHover.create({ canvasHover: hover, geometry, scene,
    sameArcEndpoint: (a, b) => a?.arc === b?.arc && a?.endpoint === b?.endpoint,
    isActiveSketchConstraint: c => c.active !== false });
  return { hover, controller, values, calls };
}
const p = { x: 1, y: 2 };
test('annotation handles and text outrank overlapping geometry and stop highlighting after leaving', () => {
  const f = fixture(), annotation = {}, line = {};
  f.values.hitLine = line; f.values.interaction = () => annotation;
  assert.equal(f.controller.updateOrdinary(p), true); assert.equal(f.hover.current.annotation, annotation); assert.equal(f.hover.current.line, null);
  assert.equal(f.controller.updateOrdinary(p), false);
  assert.equal(f.controller.updateConstraint(p, 'coincident'), false);
  f.values.interaction = null;
  assert.equal(f.controller.updateConstraint(p, 'coincident'), true); assert.equal(f.hover.current.annotation, null); assert.equal(f.hover.current.line, line);
});
test('ordinary hover prioritizes endpoints and skips lower primitive queries, then avoids unchanged updates', () => {
  const f = fixture(), point = {}; f.values.hitEndpointPoint = point;
  assert.equal(f.controller.updateOrdinary(p), true); assert.equal(f.hover.current.point, point);
  assert.equal(f.hover.current.endpointPoint, point); assert.ok(!f.calls.some(([name]) => name === 'hitLine'));
  const previous = f.hover.current; assert.equal(f.controller.updateOrdinary(p), false); assert.equal(f.hover.current, previous);
});
test('dimension and hatch overlap rules preserve their existing independent highlights', () => {
  const f = fixture(), constraint = {}, line = {}, hatch = {};
  f.values.hitDimension = { constraint }; f.values.hitLine = line; f.values.hitHatchAt = hatch;
  f.controller.updateOrdinary(p);
  assert.equal(f.hover.current.dimension, constraint); assert.equal(f.hover.current.line, line); assert.equal(f.hover.current.hatch, hatch);
  assert.ok(!f.calls.some(([name]) => name === 'hitReferenceImageAt'));
});
test('projected hatches highlight their owning block and sketch identity forces refresh', () => {
  const f = fixture(), block = {}, identity = { item: {} }; f.values.hitHatchAt = { blockProjection: true, blockInstance: block };
  f.values.hitSketchIdentityElement = identity; assert.equal(f.controller.updateOrdinary(p), true);
  assert.equal(f.hover.current.block, block); assert.equal(f.hover.current.hatch, null);
  assert.equal(f.controller.updateOrdinary(p), true);
});
test('derived instances retain the existing reference image coexistence rule', () => {
  const f = fixture(), instance = {}, image = {}; f.values.hitGeometryInstance = instance; f.values.hitReferenceImageAt = image;
  f.controller.updateOrdinary(p); assert.equal(f.hover.current.geometryInstance, instance); assert.equal(f.hover.current.referenceImage, image);
});
test('distance command dimensions preempt projected operands and preserve untouched hover fields', () => {
  const f = fixture(), constraint = {}, spline = {}; f.hover.update({ spline }); f.values.hitDimension = { constraint };
  assert.equal(f.controller.updateConstraint(p, 'distance'), true); assert.equal(f.hover.current.dimension, constraint);
  assert.equal(f.hover.current.spline, spline); assert.ok(!f.calls.some(([name]) => name === 'hitDerivedProjectionOperand'));
});
test('constraint hover prefers derived operands to block operands and ordinary geometry', () => {
  const f = fixture(), line = {}; f.values.hitDerivedProjectionOperand = { kind: 'line', line };
  assert.equal(f.controller.updateConstraint(p, 'parallel'), true); assert.equal(f.hover.current.line, line);
  assert.equal(f.hover.current.block, null); assert.ok(!f.calls.some(([name]) => name === 'hitBlockProjectionOperand'));
  assert.ok(!f.calls.some(([name]) => name === 'hitLine'));
});
test('reference target outranks ordinary endpoints and clears annotation hover after leaving it', () => {
  const f = fixture(), point = {}, annotation = {}; f.hover.update({ dimension: {}, annotation });
  f.values.hitReferenceTarget = { kind: 'point', point };
  assert.equal(f.controller.updateConstraint(p, 'coincident'), true);
  assert.equal(f.hover.current.point, point); assert.equal(f.hover.current.endpointPoint, null);
  assert.equal(f.hover.current.dimension, null); assert.equal(f.hover.current.annotation, null);
  assert.ok(!f.calls.some(([name]) => name === 'hitEndpointPoint'));
  assert.equal(f.controller.updateConstraint(p, 'coincident'), false);
});

test('corner hover refreshes within one annotation and clears on body, frame activation and leaving', () => {
  const f = fixture(), element = {};
  let hit = { element, part: 'frame', resizeX: -1, resizeY: -1 };
  f.values.interaction = () => hit;
  assert.equal(f.controller.updateOrdinary(p), true);
  assert.equal(f.hover.current.annotationHandle.resizeX, -1);
  assert.equal(f.controller.updateOrdinary(p), false);
  hit = { ...hit, resizeX: 1 };
  assert.equal(f.controller.updateOrdinary(p), true);
  assert.equal(f.hover.current.annotationHandle.resizeX, 1);
  for (const part of ['label', 'frame-enable', 'anchor']) {
    hit = { element, part: 'frame', resizeX: -1, resizeY: 1 };
    f.controller.updateOrdinary(p);
    hit = { element, part };
    assert.equal(f.controller.updateOrdinary(p), true);
    assert.equal(f.hover.current.annotation, element);
    assert.equal(f.hover.current.annotationHandle, null);
  }
  hit = { element, part: 'frame', resizeX: -1, resizeY: 1 };
  f.controller.updateOrdinary(p); hit = null;
  assert.equal(f.controller.updateOrdinary(p), true);
  assert.equal(f.hover.current.annotationHandle, null);
  assert.equal(f.hover.current.annotation, null);
});
