const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.resolve(__dirname, '../..');
const sandbox = { window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(p => p.startsWith('src/'))) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox);
const { Point, Line, Circle, Arc, Spline } = sandbox.window.GeometrySolver;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const point = (id, x, y) => Object.assign(new Point(id, x, y), { sketchId: 'S1' });
const scoped = item => Object.assign(item, { sketchId: 'S1' });
function fixture(reference = () => false) {
  let selected = [], active = 'S1', resolved = null;
  const query = sandbox.window.AnnotationAnchorQuery.create({ selectedGeometryItems: () => selected,
    isReferenceSourceSketchId: reference, activeSketchId: () => active, elementSketchId: item => item.sketchId, resolveGeometryRef: () => resolved });
  return { query, select: value => { selected = value; }, activate: value => { active = value; }, resolve: value => { resolved = value; } };
}

test('selection and hits require one supported object in the current sketch', () => {
  const f = fixture(), p = point('P1', 4, 8);
  assert.equal(f.query.annotationLeaderTargetFromSelection(), null);
  f.select([p, p]); assert.equal(f.query.annotationLeaderTargetFromSelection(), null);
  f.select([p]); const target = f.query.annotationLeaderTargetFromSelection();
  assert.equal(target.item, p); assert.deepEqual({ ...target.anchor }, { x: 4, y: 8 });
  assert.equal(target.geometryRef.kind, 'point'); assert.equal(target.geometryRef.path[0], 'P1');
  assert.equal(f.query.annotationLeaderTargetFromHit(null), null);
  f.activate('S2'); assert.equal(f.query.annotationLeaderTargetFromHit({ item: p }), null);
});

test('line targets project onto the segment and default to the midpoint', () => {
  const f = fixture(), line = scoped(new Line('L1', point('P1', 0, 0), point('P2', 10, 0)));
  near(f.query.annotationLeaderTargetFromItem(line).anchor.x, 5);
  const atEnd = f.query.annotationLeaderTargetFromItem(line, { x: 20, y: 3 }).anchor;
  near(atEnd.x, 10); near(atEnd.y, 0);
  const inside = f.query.annotationLeaderTargetFromItem(line, { x: 3, y: 4 }).anchor;
  near(inside.x, 3); near(inside.y, 0);
});

test('circle anchors follow radial direction and arcs clamp to their signed sweep', () => {
  const f = fixture(), center = point('C', 0, 0), circle = scoped(new Circle('C1', center, 10));
  near(f.query.annotationLeaderTargetFromItem(circle).anchor.x, 10);
  near(f.query.annotationLeaderTargetFromItem(circle, { x: 0, y: 30 }).anchor.y, 10);
  const arc = scoped(new Arc('A1', center, 10, 0, -Math.PI / 2));
  const inside = f.query.annotationLeaderTargetFromItem(arc, { x: 10, y: -10 }).anchor;
  near(inside.x, Math.sqrt(50)); near(inside.y, -Math.sqrt(50));
  const outside = f.query.annotationLeaderTargetFromItem(arc, { x: 0, y: 20 }).anchor;
  near(outside.x, 10); near(outside.y, 0);
});

test('anchors re-resolve geometry and preserve stored start when unavailable or outside the active sketch', () => {
  const f = fixture(), start = { x: 3, y: 4 }, annotation = { geometryRef: { kind: 'point', path: ['P1'] }, start };
  assert.equal(f.query.annotationLeaderAnchor(annotation), start);
  const p = point('P1', 10, 20); f.resolve(p);
  assert.deepEqual({ ...f.query.annotationLeaderAnchor(annotation) }, { x: 10, y: 20 });
  p.x = 30; near(f.query.annotationLeaderAnchor(annotation).x, 30);
  f.activate('S2'); assert.equal(f.query.annotationLeaderAnchor(annotation), start);
  f.resolve(null); assert.equal(f.query.annotationLeaderAnchor(null), null);
});

test('spline anchors use the fitted curve and retain the canonical geometry reference', () => {
  const f = fixture(), spline = scoped(new Spline('SP1', [point('P1', 0, 0), point('P2', 10, 0), point('P3', 20, 0)]));
  const target = f.query.annotationLeaderTargetFromItem(spline, { x: 7, y: 4 });
  near(target.anchor.x, 7); near(target.anchor.y, 0);
  assert.equal(target.geometryRef.kind, 'spline'); assert.equal(target.geometryRef.path[0], 'SP1');
  near(f.query.annotationLeaderTargetFromItem(spline).anchor.x, 10);
});

function targetFixture() {
  const data = { points: [], lines: [], circles: [], arcs: [], splines: [] };
  const query = sandbox.window.AnnotationAnchorQuery.create({ viewportScale: () => 1, activeSketchId: () => 'S1', elementSketchId: item => item.sketchId || 'S1',
    isVisibleSketchElement: item => item.visible !== false, isExplicitPoint: item => item.kind !== 'endpoint',
    isPointUsedByPrimitive: () => false, isPointUsedByLine: () => false, isReferencePoint: () => false,
    geometry: { allGeometryPoints: () => data.points, allGeometryLines: () => data.lines, allGeometryCircles: () => data.circles,
      allGeometryArcs: () => data.arcs, allGeometrySplines: () => data.splines } });
  return { data, query };
}
test('annotation target query keeps arc then circle then line priority with visible geometry', () => {
  const f = targetFixture(), center = point('O', 0, 0), arc = new Arc('A', center, 100, 0, Math.PI / 2), circle = new Circle('C', center, 100), line = new Line('L', point('a', 100, -10), point('b', 100, 10));
  f.data.arcs.push(arc); f.data.circles.push(circle); f.data.lines.push(line);
  assert.equal(f.query.hitAnnotationTarget(100, 0).item, arc); arc.visible = false;
  assert.equal(f.query.hitAnnotationTarget(100, 0).item, circle); circle.visible = false;
  assert.equal(f.query.hitAnnotationTarget(100, 0).item, line);
});
test('annotation target query ignores orphan endpoints except projected points and reads current arrays', () => {
  const f = targetFixture(), p = Object.assign(point('P', 0, 0), { kind: 'endpoint' }); f.data.points.push(p);
  assert.equal(f.query.hitAnnotationTarget(0, 0), null); p.blockProjection = true;
  assert.equal(f.query.hitAnnotationTarget(0, 0).item, p); p.visible = false;
  assert.equal(f.query.hitAnnotationTarget(0, 0), null); f.data.points = [point('Q', 0, 0)];
  assert.equal(f.query.hitAnnotationTarget(0, 0).item.id, 'Q');
});

test('relative line attachment follows translation and stretch, while legacy retains nearest-point projection', () => {
  const f = fixture(), a = point('a', 0, 0), b = point('b', 100, 0), line = scoped(new Line('L1', a, b));
  const target = f.query.annotationLeaderTargetFromItem(line, { x: 25, y: 0 });
  const leader = { start: target.anchor, geometryRef: target.geometryRef, attachment: target.attachment };
  f.resolve(line); a.x = 100; b.x = 300; a.y = b.y = 20;
  near(f.query.annotationLeaderAnchor(leader).x, 150); near(f.query.annotationLeaderAnchor(leader).y, 20);
  near(f.query.annotationLeaderAnchor({ ...leader, attachment: undefined }).x, 100);
  f.activate('S2'); near(f.query.annotationLeaderAnchor(leader).x, 150);
});

test('circle, signed arc and spline attachments preserve their curve parameter after deformation', () => {
  const f = fixture(), c = point('c', 0, 0), circle = scoped(new Circle('C1', c, 10));
  const target = f.query.annotationLeaderTargetFromItem(circle, { x: 0, y: 10 });
  f.resolve(circle); c.x = 30; c.y = 40; circle.radiusValue = 20;
  const leader = { start: target.anchor, attachment: target.attachment };
  near(f.query.annotationLeaderAnchor(leader).x, 30); near(f.query.annotationLeaderAnchor(leader).y, 60);
  const arc = scoped(new Arc('A1', c, 20, 0, -Math.PI / 2));
  const arcTarget = f.query.annotationLeaderTargetFromItem(arc, { x: 40, y: 30 });
  near(arcTarget.attachment.t, 0.5); f.resolve(arc);
  arc.endAngle = -Math.PI;
  const anchor = f.query.annotationLeaderAnchor({ start: arcTarget.anchor, attachment: arcTarget.attachment });
  near(anchor.x, 30); near(anchor.y, 20);
  const spline = scoped(new Spline('SP1', [point('P1', 0, 0), point('P2', 10, 0), point('P3', 20, 0)]));
  const st = f.query.annotationLeaderTargetFromItem(spline, { x: 7, y: 0 });
  spline.fitPoints.forEach(p => { p.x += 100; p.y += 25; }); f.resolve(spline);
  const sa = f.query.annotationLeaderAnchor({ start: st.anchor, attachment: st.attachment });
  near(sa.x, 107); near(sa.y, 25);
});

test('leader accepts referenceable ancestors but rejects unrelated sketches', () => {
  const f = fixture(id => id === 'PARENT');
  const p = Object.assign(point('P1', 4, 8), { sketchId: 'PARENT' });
  const target = f.query.annotationLeaderTargetFromHit({ item: p });
  assert.equal(target.item, p);
  f.resolve(p); p.x = 25;
  near(f.query.annotationLeaderAnchor({ ...target, start: target.anchor }).x, 25);
  p.sketchId = 'UNRELATED';
  assert.equal(f.query.annotationLeaderTargetFromHit({ item: p }), null);
});

function composedQueryFixture() {
  const state = { ready: false, active: 'S1', points: [], selected: [], scale: 1, visible: true,
    reference: false, explicit: true, referencePoint: false, resolved: null, failure: null };
  const calls = [], marker = new Error('annotation target read');
  function read(name, value) { assert.equal(state.ready, true); calls.push(name); if (state.failure === name) throw marker; return value; }
  const query = sandbox.window.AnnotationFeature.createAnchorQuery({
    selection: { selectedGeometryItems: () => read('selection', state.selected) },
    sketches: { elementSketchId: item => read('sketch', item.sketchId), activeSketchId: () => read('active', state.active),
      isReferenceSourceSketchId: () => read('reference', state.reference) },
    readServices: { reads: { resolveGeometryRef: () => read('resolve', state.resolved),
      allGeometryPoints: () => read('points', state.points), allGeometryLines: () => read('lines', []),
      allGeometryCircles: () => read('circles', []), allGeometryArcs: () => read('arcs', []), allGeometrySplines: () => read('splines', []) },
      geometryAppearance: { isVisibleSketchElement: () => read('visible', state.visible) } },
    pointUsage: { isExplicitPoint: () => read('explicit', state.explicit), isPointUsedByPrimitive: () => read('primitive', false),
      isPointUsedByLine: () => read('line', false), isReferencePoint: () => read('reference-point', state.referencePoint) },
    viewportScale: () => read('scale', state.scale),
  });
  assert.ok(Object.isFrozen(query)); assert.deepEqual(calls, []); state.ready = true;
  return { query, state, calls, marker };
}

test('annotation feature composes live geometry, visibility, PointUsage, Sketch and scale without eager queries', () => {
  const f = composedQueryFixture(), p = point('P-live', 0, 0); f.state.points = [p];
  assert.equal(f.query.hitAnnotationTarget(8, 0).item, p); f.state.scale = 2; assert.equal(f.query.hitAnnotationTarget(8, 0), null);
  f.state.scale = 1; f.state.visible = false; assert.equal(f.query.hitAnnotationTarget(0, 0), null);
  f.state.visible = true; f.state.explicit = false; assert.equal(f.query.hitAnnotationTarget(0, 0), null);
  f.state.referencePoint = true; assert.equal(f.query.hitAnnotationTarget(0, 0).item, p);
  f.state.active = 'S2'; assert.equal(f.query.hitAnnotationTarget(0, 0), null);
  f.state.reference = true; assert.equal(f.query.hitAnnotationTarget(0, 0).item, p);
  f.state.selected = [p]; const target = f.query.annotationLeaderTargetFromSelection(); assert.equal(target.item, p);
  assert.equal(target.geometryRef.path[0], p.id); assert.deepEqual({ ...target.anchor }, { x: 0, y: 0 });
  f.state.selected = [p, p]; assert.equal(f.query.annotationLeaderTargetFromSelection(), null);
  const replacement = point('P-next', 30, 40); f.state.points = [replacement];
  assert.equal(f.query.hitAnnotationTarget(30, 40).item, replacement);
});

test('composed annotation anchors re-resolve identity and preserve fallback and inputs after read failures', () => {
  const f = composedQueryFixture(), p = point('P-live', 10, 20), start = { x: 2, y: 3 };
  const annotation = { geometryRef: { kind: 'point', path: [p.id] }, attachment: { kind: 'point' }, start };
  f.state.resolved = p; assert.deepEqual({ ...f.query.annotationLeaderAnchor(annotation) }, { x: 10, y: 20 });
  p.x = 30; assert.deepEqual({ ...f.query.annotationLeaderAnchor(annotation) }, { x: 30, y: 20 });
  f.state.resolved = null; assert.equal(f.query.annotationLeaderAnchor(annotation), start);
  f.state.failure = 'resolve'; assert.throws(() => f.query.annotationLeaderAnchor(annotation), error => error === f.marker);
  assert.equal(annotation.start, start); assert.equal(annotation.geometryRef.path[0], p.id);
  f.state.failure = 'points'; f.state.points = [p]; const points = f.state.points;
  assert.throws(() => f.query.hitAnnotationTarget(30, 20), error => error === f.marker);
  assert.equal(f.state.points, points); assert.equal(points[0], p); assert.equal(p.x, 30); assert.equal(p.y, 20);
});
