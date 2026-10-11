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
  const calls = [], hits = {};
  const hitProviders = Object.fromEntries(["hitPoint", "hitLine", "hitCircle", "hitArc", "hitSpline", "hitArcEndpoint"].map(name => [name, () => { calls.push(name); return hits[name] || null; }]));
  const query = sandbox.window.OperandHitQuery.create({ viewportScale: () => scale,
    geometry: { geometryInstanceBundles: () => derived, blockProjectionBundles: () => blocks,
      allGeometryPoints: () => geometry.points, allGeometryLines: () => geometry.lines, allGeometryCircles: () => geometry.circles,
      allGeometryArcs: () => geometry.arcs, allGeometrySplines: () => geometry.splines },
    sketches: { isVisibleSketchId: id => id !== 'hidden', operandRelationForSketch: id => id === 'S1' ? 'active' : null,
      referenceSourceSketchIds: () => allowed, elementSketchId: item => item.sketchId, isVisibleSketchElement: item => item.visible !== false },
    points: { isExplicitPoint: item => item.kind !== 'endpoint', isPointUsedByPrimitive: () => false, isReferencePoint: () => false },
    hits: hitProviders, operandFromReferenceTarget: target => target,
    makeConstraintOperand: (kind, data) => ({ kind, ...data }) });
  return { query, geometry, blocks, derived, hits, calls, zoom: value => { scale = value; }, allow: value => { allowed = value; } };
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


test('constraint operand query reads all hit providers in order and gives allowed arc endpoints priority', () => {
 const f = fixture(); const p = point('P', 0), arc = {}; f.hits.hitPoint = p; f.hits.hitArcEndpoint = { arc, endpoint: 'end' };
 const operands = []; const result = f.query.hitConstraintOperand({ x: 0, y: 0 }, 'coincident', operands);
 assert.equal(result.kind, 'arc-endpoint'); assert.equal(result.arc, arc); assert.equal(result.endpoint, 'end');
 assert.deepEqual(f.calls, ['hitPoint', 'hitLine', 'hitCircle', 'hitArc', 'hitSpline', 'hitArcEndpoint']); assert.equal(operands.length, 0);
 assert.equal(f.query.hitConstraintOperand({ x: 0, y: 0 }, 'distance', operands).point, p);
});
test('symmetry prioritizes its axis and matching subject kind using the supplied operand stage', () => {
 const f = fixture(); const p = point('P', 0), line = {}, arc = {}; f.hits.hitPoint = p; f.hits.hitLine = line; f.hits.hitArc = arc;
 assert.equal(f.query.hitConstraintOperand({ x: 0, y: 0 }, 'symmetry', []).line, line);
 assert.equal(f.query.hitConstraintOperand({ x: 0, y: 0 }, 'symmetry', [{ kind: 'line' }]).point, p);
 const operands = [{ kind: 'line' }, { kind: 'primitive' }];
 assert.equal(f.query.hitConstraintOperand({ x: 0, y: 0 }, 'symmetry', operands).primitive, arc); assert.equal(operands.length, 2);
});
test('provided non-null hits skip only their provider and explicit null still uses the live provider', () => {
 const f = fixture(); const selected = point('provided', 0), live = point('live', 0); f.hits.hitPoint = live;
 assert.equal(f.query.hitConstraintOperand({ x: 0, y: 0 }, 'distance', [], { hitP: selected }).point, selected);
 assert.equal(f.calls.includes('hitPoint'), false); f.calls.length = 0;
 assert.equal(f.query.hitConstraintOperand({ x: 0, y: 0 }, 'distance', [], { hitP: null }).point, live);
 assert.equal(f.calls[0], 'hitPoint');
});
test('empty active hits prefer derived projections over Block and then fall back to reference geometry', () => {
 const f = fixture(), d = empty(), b = empty(); const derived = point('derived', 0), block = point('block', 0), reference = point('reference', 0);
 d.points.push(derived); b.points.push(block); f.derived.push(d); f.blocks.push(b); f.geometry.points.push(reference);
 assert.equal(f.query.hitConstraintOperand({ x: 0, y: 0 }, 'distance', []).point, derived);
 f.derived.length = 0; assert.equal(f.query.hitConstraintOperand({ x: 0, y: 0 }, 'distance', []).point, block);
 f.blocks.length = 0; assert.equal(f.query.hitConstraintOperand({ x: 0, y: 0 }, 'distance', []).point, reference);
});
