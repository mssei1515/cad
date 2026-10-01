const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.resolve(__dirname, '../..');
const sandbox = { window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(p => p.startsWith('src/'))) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox);
const { Point, Line, Arc } = sandbox.window.GeometrySolver;
const empty = () => ({ points: [], lines: [], circles: [], arcs: [], splines: [], instance: { sketchId: 'S1' } });
const point = (id, x, y = 0) => Object.assign(new Point(id, x, y), { sketchId: 'S1' });
function fixture() {
  let scale = 1, allowed = ['S1']; const geometry = empty(), blocks = [], derived = [];
  const query = sandbox.window.OperandHitQuery.create({ viewportScale: () => scale,
    geometry: { geometryInstanceBundles: () => derived, blockProjectionBundles: () => blocks,
      allGeometryPoints: () => geometry.points, allGeometryLines: () => geometry.lines, allGeometryCircles: () => geometry.circles,
      allGeometryArcs: () => geometry.arcs, allGeometrySplines: () => geometry.splines },
    sketches: { isVisibleSketchId: id => id !== 'hidden', operandRelationForSketch: id => id === 'S1' ? 'active' : null,
      referenceSourceSketchIds: () => allowed, elementSketchId: item => item.sketchId, isVisibleSketchElement: item => item.visible !== false },
    points: { isExplicitPoint: item => item.kind !== 'endpoint', isPointUsedByPrimitive: () => false, isReferencePoint: () => false },
    makeConstraintOperand: (kind, data) => ({ kind, ...data }) });
  return { query, geometry, blocks, derived, zoom: value => { scale = value; }, allow: value => { allowed = value; } };
}
test('projection hits preserve reversed bundle and point order and point priority over lines', () => {
  const f = fixture(), first = empty(), last = empty(), a = point('a', 0), b = point('b', 1);
  first.points.push(a); last.points.push(a, b); last.lines.push(new Line('L', point('p1', -20), point('p2', 20)));
  f.blocks.push(first, last); assert.equal(f.query.hitBlockProjectionOperand(0, 0).point, b);
  f.derived.push(first, last); assert.equal(f.query.hitDerivedProjectionOperand(0, 0).point, b);
  assert.equal(last.points[0], a);
});
test('projection eligibility and zoom are read for each call', () => {
  const f = fixture(), bundle = empty(); bundle.points.push(point('p', 8)); f.blocks.push(bundle);
  assert.equal(f.query.hitBlockProjectionOperand(0, 0).kind, 'point'); f.zoom(2);
  assert.equal(f.query.hitBlockProjectionOperand(0, 0), null); f.zoom(1);
  bundle.instance.sketchId = 'S2'; assert.equal(f.query.hitBlockProjectionOperand(0, 0), null);
  bundle.instance.sketchId = 'hidden'; assert.equal(f.query.hitBlockProjectionOperand(0, 0), null);
});
test('block arc endpoints and derived arc bodies retain distinct operand semantics', () => {
  const f = fixture(), bundle = empty(), arc = new Arc('A', point('O', 0), 100, 0, Math.PI / 2);
  bundle.arcs.push(arc); f.blocks.push(bundle); f.derived.push(bundle);
  const block = f.query.hitBlockProjectionOperand(100, 0), derived = f.query.hitDerivedProjectionOperand(100, 0);
  assert.equal(block.kind, 'arc-endpoint'); assert.equal(block.arc, arc); assert.equal(block.endpoint, 'start');
  assert.equal(derived.kind, 'primitive'); assert.equal(derived.primitive, arc);
  assert.ok(Math.abs(derived.hitPoint.x - 100) < 1e-8);
});
test('reference hits respect allowed sketches, visibility and the projected-point exception', () => {
  const f = fixture(), implicit = Object.assign(point('P', 0), { kind: 'endpoint' }); f.geometry.points.push(implicit);
  assert.equal(f.query.hitReferenceTarget(0, 0), null); implicit.blockProjection = true;
  assert.equal(f.query.hitReferenceTarget(0, 0).point, implicit);
  implicit.visible = false; assert.equal(f.query.hitReferenceTarget(0, 0), null); implicit.visible = true;
  f.allow([]); assert.equal(f.query.hitReferenceTarget(0, 0), null);
  f.allow(['S1']); assert.equal(f.query.hitReferenceTarget(0, 0).sketchId, 'S1');
});
