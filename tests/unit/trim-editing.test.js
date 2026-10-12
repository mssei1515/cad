const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/constraints/references.js', 'src/editing/geometry_ids.js', 'src/editing/geometry_creation.js', 'src/editing/trim_query.js', 'src/editing/trim_editing.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
const { HorizontalConstraint, PointOnLineConstraint, ArcEndpointOnLineConstraint, DiameterConstraint, DistanceConstraint, PointOnCircleConstraint } = sandbox.window.GeometrySolver;
const newScope = () => ({ points: [], lines: [], circles: [], arcs: [], splines: [], constraints: [] });
function fixture() {
  const state = { scope: newScope(), sketch: 'S1' }, ids = sandbox.window.GeometryIds.create();
  const references = sandbox.window.ConstraintReferences.create({ resolveGeometryRef: () => null });
  const geometry = sandbox.window.GeometryCreation.create({ currentScope: () => state.scope, ids, assignSketchId: item => { item.sketchId = state.sketch; }, currentConstruction: () => false, minLineLength: 1, minArcLength: 1 });
  const query = sandbox.window.TrimQuery.create({ currentScope: () => state.scope, isActiveSketchElement: () => true, minLineLength: 1, minArcLength: 1 });
  const used = p => state.scope.lines.some(l => l.p1 === p || l.p2 === p) || [...state.scope.circles, ...state.scope.arcs].some(c => c.center === p) || state.scope.splines.some(s => s.fitPoints.includes(p));
  const push = (c, sketch = state.sketch) => { c.sketchId = sketch; state.scope.constraints.push(c); return c; };
  const editing = sandbox.window.TrimEditing.create({ currentScope: () => state.scope, geometry, references, query, pushModelConstraint: push, elementSketchId: item => item.sketchId, isPointUsedByPrimitive: used, isReferencePoint: p => p.kind === 'endpoint' && !used(p) && state.scope.constraints.some(c => c.enabled !== false && references.constraintReferencesPoint(c, p)), minArcLength: 1 });
  const point = (x, y, kind = 'endpoint') => geometry.addPoint(x, y, false, kind);
  const line = (x1, y1, x2, y2, construction = false) => geometry.addLine(point(x1, y1), point(x2, y2), construction);
  return { state, geometry, query, editing, push, point, line };
}
test('middle line trim transfers right-side point constraints, clones support and drops length constraints', () => {
  const h = fixture(), target = h.line(0, 0, 30, 0, true), left = h.line(10, -10, 10, 10), right = h.line(20, -10, 20, 10);
  const oldEnd = target.p2, support = h.push(new HorizontalConstraint(target));
  const dimension = h.push(new DistanceConstraint(target.p1, target.p2, 30));
  const leftPoint = h.push(new PointOnLineConstraint(h.point(5, 0, 'explicit'), target));
  const rightPoint = h.push(new PointOnLineConstraint(h.point(25, 0, 'explicit'), target));
  const arc = h.geometry.addArc(h.point(25, -5), 5, Math.PI / 2, Math.PI);
  const endpoint = h.push(new ArcEndpointOnLineConstraint(arc, 'start', target));
  h.editing.executeLineTrim({ item: target, interval: { left: { t: 1 / 3, point: { x: 10, y: 0 }, source: { line: left } }, right: { t: 2 / 3, point: { x: 20, y: 0 }, source: { line: right } } } });
  const added = h.state.scope.lines.at(-1); assert.equal(target.p2.x, 10); assert.equal(added.p1.x, 20); assert.equal(added.p2, oldEnd); assert.equal(added.construction, true);
  assert.equal(leftPoint.line, target); assert.equal(rightPoint.line, added); assert.equal(endpoint.line, added); assert.equal(rightPoint.name, new PointOnLineConstraint(rightPoint.point, added).name);
  assert.ok(h.state.scope.constraints.includes(support)); assert.ok(!h.state.scope.constraints.includes(dimension));
  assert.ok(h.state.scope.constraints.some(c => c instanceof HorizontalConstraint && c.line === added && c.sketchId === target.sketchId));
  assert.ok(h.state.scope.constraints.some(c => c instanceof PointOnLineConstraint && c.point === target.p2 && c.line === left));
  assert.ok(h.state.scope.constraints.some(c => c instanceof PointOnLineConstraint && c.point === added.p1 && c.line === right));
});
test('circle trim keeps diameter metadata and constraint identity when a single arc remains', () => {
  const h = fixture(), target = h.geometry.addCircle(h.point(0, 0), 10); h.line(-20, 0, 20, 0);
  const dimension = h.push(new DiameterConstraint(target, 20)); const appearance = { color: '#f00' }, placement = { x: 2, y: 3 };
  Object.assign(dimension, { parameterName: 'd1', expression: 'width', appearance, dimension: placement });
  h.editing.executeCircleTrim(h.query.trimPreviewForCircle(target, { x: 0, y: 10 }));
  assert.equal(h.state.scope.circles.length, 0); assert.equal(h.state.scope.arcs.length, 1); assert.ok(h.state.scope.constraints.includes(dimension));
  assert.equal(dimension.primitive, h.state.scope.arcs[0]); assert.equal(dimension.target, 20); assert.equal(dimension.expression, 'width'); assert.equal(dimension.parameterName, 'd1'); assert.equal(dimension.appearance, appearance); assert.equal(dimension.dimension, placement);
});
test('circle trim removes its diameter dimension when multiple arcs remain', () => {
  const h = fixture(), target = h.geometry.addCircle(h.point(0, 0), 10); h.line(-20, 0, 20, 0); h.line(0, -20, 0, 20);
  const dimension = h.push(new DiameterConstraint(target, 20));
  h.editing.executeCircleTrim(h.query.trimPreviewForCircle(target, { x: 7, y: 7 }));
  assert.equal(h.state.scope.arcs.length, 3); assert.ok(!h.state.scope.constraints.includes(dimension));
});
test('whole-line deletion removes orphan endpoints and their constraints but keeps shared endpoints', () => {
  const h = fixture(), target = h.line(0, 0, 10, 0), orphan = target.p1, shared = target.p2;
  h.geometry.addLine(shared, h.point(20, 10)); const related = h.push(new PointOnLineConstraint(orphan, h.state.scope.lines[1]));
  h.editing.executeLineTrim({ item: target, deleteWhole: true });
  assert.ok(!h.state.scope.points.includes(orphan)); assert.ok(h.state.scope.points.includes(shared)); assert.ok(!h.state.scope.constraints.includes(related)); assert.equal(h.state.scope.lines.length, 1);
});
test('whole-circle deletion retains a center used by an independent reference constraint', () => {
  const h = fixture(), center = h.point(0, 0), target = h.geometry.addCircle(center, 10), other = h.geometry.addCircle(h.point(10, 0), 10);
  const reference = h.push(new PointOnCircleConstraint(center, other)); h.editing.executeCircleTrim({ item: target, deleteWhole: true });
  assert.ok(h.state.scope.points.includes(center)); assert.ok(h.state.scope.constraints.includes(reference)); assert.deepEqual(Array.from(h.state.scope.circles), [other]);
});
test('arc endpoint trim applies the boundary constraint in the current scope', () => {
  const h = fixture(), previous = h.state.scope; h.state.scope = newScope(); h.state.sketch = 'S2';
  const target = h.geometry.addArc(h.point(0, 0), 10, 0, Math.PI), boundary = h.line(-20, 0, 20, 0);
  h.editing.executeArcTrim({ item: target, interval: { left: { t: 0 }, right: { t: 0.5, source: { line: boundary } } } });
  assert.equal(target.startAngle, Math.PI / 2); assert.equal(target.endAngle, Math.PI); assert.equal(previous.arcs.length, 0);
  assert.ok(h.state.scope.constraints.some(c => c instanceof ArcEndpointOnLineConstraint && c.arc === target && c.endpoint === 'start' && c.line === boundary && c.sketchId === 'S2'));
});
