const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const { Point, Line, Circle, Spline } = sandbox.window.GeometrySolver;
const point = (id, x = 0, y = 0) => Object.assign(new Point(id, x, y), { sketchId: 'S1' });
function fixture() {
  const a = point('P1'), b = point('P2', 2, 2), outside = point('outside', 20, 20);
  const line = Object.assign(new Line('L1', a, b), { sketchId: 'S1' });
  const model = { points: [a, b, outside], lines: [line], circles: [], arcs: [], splines: [], blockInstances: [], annotations: [], hatches: [], constraints: [] };
  const selection = { points: [], lines: [line], circles: [], arcs: [], splines: [], blockInstances: [], annotations: [], hatches: [] };
  const state = { model, bundles: new Map(), references: new Map() }, serialized = [];
  const query = sandbox.window.BlockSelectionQuery.create({ currentScope: () => state.model, canvasSelection: selection,
    blockProjectionBundle: instance => state.bundles.get(instance), elementSketchId: item => item.sketchId, activeSketchId: () => 'S1',
    constraintGraphNodes: constraint => constraint.nodes, serializeConstraint: constraint => { serialized.push(constraint); return constraint.unsupported ? null : {}; },
    constraintLabelForList: constraint => constraint.id, resolveGeometryRef: ref => state.references.get(ref), applicationText: (_ja, en) => en,
    mergeBounds: (a, b) => !b ? a : !a ? b : ({ x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1), x2: Math.max(a.x2, b.x2), y2: Math.max(a.y2, b.y2) }),
    lineBBox: line => ({ x1: Math.min(line.p1.x, line.p2.x), y1: Math.min(line.p1.y, line.p2.y), x2: Math.max(line.p1.x, line.p2.x), y2: Math.max(line.p1.y, line.p2.y) }),
    primitiveBBox: item => item.box, splineBBox: item => item.box, annotationBounds: item => item.box });
  return { query, state, model, selection, a, b, line, outside, serialized };
}
test('Block candidates include support points and classify internal, external and reference constraints without mutation', () => {
  const f = fixture(), internal = { id: 'internal', nodes: [f.a, f.line] }, external = { id: 'external', nodes: [f.a, f.outside], unsupported: true }, reference = { id: 'reference', nodes: [f.line], reference: true };
  f.model.constraints = [internal, external, reference, { id: 'unrelated', nodes: [f.outside] }];
  const before = JSON.stringify([f.model, f.selection]), result = f.query.read();
  assert.equal(result.points.length, 2); assert.equal(result.points[0], f.a); assert.equal(result.points[1], f.b);
  assert.deepEqual(Array.from(result.constraints), [internal]); assert.deepEqual(Array.from(result.externalConstraints), [external, reference]);
  assert.deepEqual(f.serialized, [internal]); assert.equal(JSON.stringify([f.model, f.selection]), before);
  internal.unsupported = true; assert.match(f.query.read().error, /internal/);
});
test('Block candidates reject shared support points, cross-Sketch geometry and point-only selections', () => {
  for (const kind of ['line', 'circle', 'spline']) {
    const f = fixture();
    if (kind === 'line') f.model.lines.push(new Line('other', f.a, f.outside));
    if (kind === 'circle') f.model.circles.push(new Circle('C1', f.a, 3));
    if (kind === 'spline') f.model.splines.push(new Spline('SP1', [f.a, f.b, f.outside]));
    assert.match(f.query.read().error, /共有/);
  }
  const f = fixture(); f.line.sketchId = 'S2'; assert.match(f.query.read().error, /アクティブ/);
  f.selection.lines = []; f.selection.points = [f.a]; assert.match(f.query.read().error, /Select geometry/);
});
test('Block candidates recognize rebuilt projections by id and filter stale selected instances', () => {
  const f = fixture(), instance = { id: 'BI1', sketchId: 'S1' };
  const projected = Object.assign(point('BI1@P1'), { blockProjection: true });
  f.selection.lines = []; f.selection.points = [projected]; f.selection.blockInstances = [instance]; f.model.blockInstances = [instance];
  f.state.bundles.set(instance, { points: [projected], lines: [], circles: [], arcs: [], splines: [] });
  const rebuilt = Object.assign(point(projected.id), { blockProjection: true }), internal = { id: 'projected', nodes: [rebuilt] };
  f.model.constraints = [internal];
  const result = f.query.read(); assert.equal(result.points.length, 0); assert.equal(result.projectedGeometry[0], projected); assert.equal(result.constraints[0], internal);
  f.state.model = { ...f.model, blockInstances: [] }; assert.match(f.query.read().error, /Select geometry/);
});
test('Block candidates require selected leaders and hatch boundaries to remain inside the transfer', () => {
  const f = fixture(), leader = { id: 'AN1', type: 'leader', sketchId: 'S1', geometryRef: 'target' };
  f.model.annotations = [leader]; f.state.references.set('target', f.line);
  assert.match(f.query.read().error, /AN1/);
  f.selection.annotations = [leader]; f.state.references.set('target', f.outside); assert.match(f.query.read().error, /Also select the target/);
  f.state.references.set('target', f.line); assert.equal(f.query.read().error, undefined);
  const boundary = id => [{ spans: [{ source: { kind: 'line', path: [id] }, start: { type: 'endpoint', name: 'p1' }, end: { type: 'endpoint', name: 'p2' } }] }];
  const hatch = { id: 'H1', sketchId: 'S1', boundaryLoops: boundary('L1') }; f.model.hatches = [hatch];
  assert.match(f.query.read().error, /Also select hatch H1/);
  f.selection.hatches = [hatch]; hatch.boundaryLoops = boundary('L2'); assert.match(f.query.read().error, /boundary L2/);
  hatch.boundaryLoops = boundary('L1'); assert.equal(f.query.read().hatches[0], hatch);
  leader.sketchId = 'S2'; assert.match(f.query.read().error, /Only annotations/);
});
test('Block placement center includes projected points and annotations while ignoring loose selected points', () => {
  const f = fixture(), instance = { id: 'BI1' };
  f.state.bundles.set(instance, { points: [point('projected', 10, 12)], lines: [], circles: [], arcs: [], splines: [], annotations: [{ box: { x1: 20, y1: 8, x2: 24, y2: 10 } }] });
  const center = f.query.center({ points: [point('loose', 100, 100)], lines: [f.line], annotations: [{ box: { x1: -4, y1: 0, x2: -2, y2: 2 } }], blockInstances: [instance] });
  assert.equal(center.x, 10); assert.equal(center.y, 6);
  const empty = f.query.center({}); assert.equal(empty.x, 0); assert.equal(empty.y, 0);
});
