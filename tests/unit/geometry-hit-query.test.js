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
const point = (id, x, y) => Object.assign(new Point(id, x, y), { sketchId: 'S1' });
const scoped = item => Object.assign(item, { sketchId: 'S1' });
const empty = () => ({ points: [], lines: [], circles: [], arcs: [], splines: [] });
function fixture() {
  let model = empty(), scale = 1;
  const query = sandbox.window.GeometryHitQuery.create({ currentScope: () => model, viewportScale: () => scale,
    isEditableSketchElement: item => item.sketchId === 'S1', isSelectableEndpointPoint: item => item.endpoint === true,
    isExplicitPoint: item => item.endpoint !== true });
  return { query, model: () => model, scope: value => { model = value; }, zoom: value => { scale = value; } };
}
test('endpoints have priority over later explicit points, with reverse order within each class', () => {
  const f = fixture(), a = Object.assign(point('a', 0, 0), { endpoint: true }), b = Object.assign(point('b', 1, 0), { endpoint: true }), c = point('c', 0, 0);
  f.model().points.push(a, b, c);
  assert.equal(f.query.hitPoint(0, 0), b); assert.equal(f.query.hitAnyPoint(0, 0), b);
  assert.equal(f.query.hitExplicitPoint(0, 0), c);
  b.sketchId = 'S2'; assert.equal(f.query.hitEndpointPoint(0, 0), a);
});
test('line hits prefer drawing order rather than distance and never reorder the model', () => {
  const f = fixture(), a = scoped(new Line('a', point('a1', -20, 0), point('a2', 20, 0))), b = scoped(new Line('b', point('b1', -20, 4), point('b2', 20, 4)));
  a.drawingOrder = 1; b.drawingOrder = 2; f.model().lines.push(a, b);
  assert.equal(f.query.hitLine(0, 0), b); assert.deepEqual(f.model().lines, [a, b]);
  b.sketchId = 'S2'; assert.equal(f.query.hitLine(0, 0), a);
});
test('circle and signed arc hits respect radial tolerance and sweep', () => {
  const f = fixture(), center = point('O', 0, 0), circle = scoped(new Circle('C', center, 100)), arc = scoped(new Arc('A', center, 100, 0, -Math.PI / 2));
  f.model().circles.push(circle); f.model().arcs.push(arc);
  assert.equal(f.query.hitCircle(103, 0), circle); assert.equal(f.query.hitCircle(110, 0), null);
  assert.equal(f.query.hitArc(70.71, -70.71), arc); assert.equal(f.query.hitArc(70.71, 70.71), null);
});
test('arc endpoints use reverse arc order and end before start when both are within tolerance', () => {
  const f = fixture(), a = scoped(new Arc('a', point('O', 0, 0), 2, 0, Math.PI / 2)), b = scoped(new Arc('b', point('O2', 0, 0), 2, 0, Math.PI / 2));
  f.model().arcs.push(a, b); const hit = f.query.hitArcEndpoint(0, 0);
  assert.equal(hit.arc, b); assert.equal(hit.endpoint, 'end');
  assert.ok(Math.abs(hit.point.y - 2) < 1e-8);
});
test('queries use current scope and zoom, including fitted spline distance', () => {
  const f = fixture(), p = point('P', 8, 0); f.model().points.push(p);
  assert.equal(f.query.hitPoint(0, 0), p); f.zoom(2); assert.equal(f.query.hitPoint(0, 0), null);
  const next = empty(), spline = scoped(new Spline('S', [point('p1', 0, 0), point('p2', 10, 0), point('p3', 20, 0)]));
  next.splines.push(spline); f.scope(next);
  assert.equal(f.query.hitPoint(8, 0), null); assert.equal(f.query.hitSpline(10, 3), spline); assert.equal(f.query.hitSpline(10, 4), null);
});

test('identity query gives dimensions priority and preserves their owning sketch', () => {
  const model = empty(), constraint = { name: 'Length', sketchId: 'S2' }; model.points.push(point('P', 0, 0));
  const query = sandbox.window.GeometryHitQuery.create({ currentScope: () => model, viewportScale: () => 1,
    hitDimension: (x, y, options) => { assert.equal(options.activeOnly, false); return { constraint }; },
    constraintSketchId: item => item.sketchId });
  const result = query.hitSketchIdentityElement(0, 0);
  assert.equal(result.item, constraint); assert.equal(result.sketchId, 'S2'); assert.equal(result.label, 'Length');
});
test('identity query optionally includes inactive geometry but always excludes hidden geometry', () => {
  const model = empty(), p = Object.assign(point('P', 0, 0), { sketchId: 'S2' }), block = { id: 'B', definitionId: 'D', sketchId: 'S1' };
  model.points.push(p); const flags = [];
  const query = sandbox.window.GeometryHitQuery.create({ currentScope: () => model, viewportScale: () => 1, hitDimension: () => null,
    isVisibleSketchElement: item => item.visible !== false, isEditableSketchElement: item => item.sketchId === 'S1', elementSketchId: item => item.sketchId,
    hitBlockInstance: (x, y, editableOnly) => { flags.push(editableOnly); return block; }, blockDefinitionById: () => ({ name: 'Door' }) });
  assert.equal(query.hitSketchIdentityElement(0, 0).item, block); assert.equal(flags[0], true);
  assert.equal(query.hitSketchIdentityElement(0, 0, { allowInactiveGeometry: true }).item, p);
  p.visible = false; const result = query.hitSketchIdentityElement(0, 0, { allowInactiveGeometry: true });
  assert.equal(result.label, 'Block B: Door'); assert.equal(flags.at(-1), false);
});
