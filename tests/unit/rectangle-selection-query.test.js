const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: { SplineGeometry: { flatten: curve => curve.map(point => ({ point })) } } };
vm.runInNewContext(fs.readFileSync('src/editing/rectangle_selection_query.js', 'utf8'), sandbox);
function fixture() {
  const state = { model: { points: [], lines: [], circles: [], arcs: [], splines: [], blockInstances: [], annotations: [], hatches: [], referenceImages: [] } };
  const inside = (p, r) => p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2;
  const contains = (b, r) => b.x1 >= r.x1 && b.y1 >= r.y1 && b.x2 <= r.x2 && b.y2 <= r.y2;
  const intersects = (b, r) => b.x1 <= r.x2 && b.x2 >= r.x1 && b.y1 <= r.y2 && b.y2 >= r.y1;
  const query = sandbox.window.RectangleSelectionQuery.create({ currentScope: () => state.model,
    selectableSketchElement: item => item.sketchId === 'S1' && item.visible !== false,
    isExplicitPoint: p => p.kind === 'explicit', isReferencePoint: p => p.reference, pointInRect: inside,
    lineIntersectsRect: (line, rect) => intersects(line.box, rect), bboxInRect: contains, lineBBox: item => item.box,
    isVisibleSketchElement: item => item.visible !== false, primitiveBBox: item => item.box, bboxIntersectsRect: intersects,
    arcSamplePoints: arc => arc.samples, viewScale: () => 2, isEditableSketchId: id => id === 'S1', isVisibleSketchId: id => id !== 'hidden',
    blockProjectionBundle: instance => instance.bundle,
    mergeBounds: (a, b) => !b ? a : !a ? b : ({ x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1), x2: Math.max(a.x2, b.x2), y2: Math.max(a.y2, b.y2) }),
    splineBBox: item => item.box, annotationBounds: item => item.box, resolvedLoopBounds: value => value,
    resolvedHatchBoundary: item => item.box, activeSketchId: () => 'S1', hatchAppearanceForDisplay: h => ({ visible: h.visible }), referenceImageBounds: item => item.box });
  return { state, query, rect: { x1: 0, y1: 0, x2: 10, y2: 10 } };
}
test('rectangle candidates filter scope and visibility and distinguish support points and containment', () => {
  const f = fixture(), point = { id: 'P1', x: 2, y: 2, sketchId: 'S1', kind: 'explicit' };
  f.state.model.points = [point, { ...point, id: 'support', kind: 'support' }, { ...point, id: 'reference', kind: 'support', reference: true }, { ...point, id: 'other', sketchId: 'S2' }];
  const line = { id: 'L1', sketchId: 'S1', box: { x1: -2, y1: 2, x2: 5, y2: 3 } }; f.state.model.lines = [line, { ...line, visible: false }];
  const before = JSON.stringify(f.state.model), contained = f.query.read(f.rect, false);
  assert.deepEqual(Array.from(contained.points, p => p.id), ['P1', 'reference']); assert.equal(contained.lines.length, 0);
  assert.equal(f.query.read(f.rect, true).lines[0], line); assert.equal(JSON.stringify(f.state.model), before);
  f.state.model = { ...f.state.model, points: [], lines: [] }; assert.equal(f.query.read(f.rect, true).points.length, 0);
});
test('arc and spline candidates use the existing sample any/all rule', () => {
  const f = fixture(), samples = [{ x: 2, y: 2 }, { x: 12, y: 2 }];
  const arc = { sketchId: 'S1', samples }, spline = { sketchId: 'S1', curve: () => samples };
  f.state.model.arcs = [arc]; f.state.model.splines = [spline];
  assert.equal(f.query.read(f.rect, false).arcs.length, 0); assert.equal(f.query.read(f.rect, false).splines.length, 0);
  const crossing = f.query.read(f.rect, true); assert.equal(crossing.arcs[0], arc); assert.equal(crossing.splines[0], spline);
});
test('Block bounds include projected annotations and hatches while local auxiliary elements respect their scope', () => {
  const f = fixture(), box = { x1: 1, y1: 1, x2: 3, y2: 3 };
  const instance = { sketchId: 'S1', bundle: { points: [], lines: [], circles: [], arcs: [], splines: [], annotations: [{ box }], hatches: [{ box }] } };
  f.state.model.blockInstances = [instance];
  for (const field of ['annotations', 'hatches', 'referenceImages']) f.state.model[field] = [{ sketchId: 'S1', box }, { sketchId: 'S2', box }, { sketchId: 'S1', box, visible: false }];
  const result = f.query.read(f.rect, false); assert.equal(result.blockInstances[0], instance);
  for (const field of ['annotations', 'hatches', 'referenceImages']) assert.equal(result[field].length, 1);
  instance.bundle.points.push({ x: 20, y: 20 }); assert.equal(f.query.read(f.rect, false).blockInstances.length, 0); assert.equal(f.query.read(f.rect, true).blockInstances.length, 1);
});
