const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/editing/point_usage.js', 'utf8'), sandbox);
const empty = () => ({ lines: [], circles: [], arcs: [], splines: [], constraints: [] });
function fixture() {
  let scope = empty(), edited = []; const expanded = empty();
  const query = sandbox.window.PointUsage.create({ currentScope: () => scope,
    allGeometryLines: () => expanded.lines, allGeometryCircles: () => expanded.circles,
    allGeometryArcs: () => expanded.arcs, allGeometrySplines: () => expanded.splines,
    editedFitPoints: () => edited, constraintReferencesPoint: (c, p) => c.point === p });
  return { query, scope: () => scope, activate: value => { scope = value; }, expanded, edit: value => { edited = value; } };
}
test('usage follows reference identity, current scope and explicit collection overrides', () => {
  const f = fixture(), p = { id: 'P' }, other = { id: 'P' }, line = { p1: p, p2: {} }; f.scope().lines.push(line);
  assert.equal(f.query.isPointUsedByLine(p), true); assert.equal(f.query.isPointUsedByLine(other), false);
  f.activate(empty()); assert.equal(f.query.isPointUsedByLine(p), false); assert.equal(f.query.isPointUsedByLine(p, [line]), true);
  f.expanded.lines.push(line); assert.equal(f.query.isAnyLineEndpoint(p), true);
});
test('explicit standalone points become endpoint and center roles as geometry starts using them', () => {
  const f = fixture(), p = { kind: 'explicit' }; assert.equal(f.query.isStandalonePoint(p), true);
  f.scope().circles.push({ center: p });
  assert.equal(f.query.isStandalonePoint(p), false); assert.equal(f.query.isEndpointPoint(p), true);
  assert.equal(f.query.isPrimitiveCenterPoint(p), true); assert.equal(f.query.isExplicitPoint(p), true);
});
test('reference points require an enabled constraint and no primitive usage', () => {
  const f = fixture(), p = { kind: 'endpoint' }, constraint = { point: p, enabled: false }; f.scope().constraints.push(constraint);
  assert.equal(f.query.isReferencePoint(p), false); constraint.enabled = true;
  assert.equal(f.query.isReferencePoint(p), true); assert.equal(f.query.isSelectableEndpointPoint(p), true);
  f.scope().arcs.push({ center: p }); assert.equal(f.query.isReferencePoint(p), false);
});
test('spline-only endpoint handles are selectable only while their spline is being edited', () => {
  const f = fixture(), p = { kind: 'endpoint' }; f.scope().splines.push({ fitPoints: [p] });
  assert.equal(f.query.isSplineOnlyFitPoint(p), true); assert.equal(f.query.isSelectableEndpointPoint(p), false);
  f.edit([p]); assert.equal(f.query.isEditableSplineFitPoint(p), true); assert.equal(f.query.isSelectableEndpointPoint(p), true);
  f.edit([]); f.scope().lines.push({ p1: p, p2: {} });
  assert.equal(f.query.isSplineOnlyFitPoint(p), false); assert.equal(f.query.isSelectableEndpointPoint(p), true);
});
test('projected spline classification reads expanded geometry instead of current-scope arrays', () => {
  const f = fixture(), p = { kind: 'endpoint', blockProjection: true }; f.expanded.splines.push({ fitPoints: [p] });
  assert.equal(f.query.isSplineOnlyFitPoint(p), true);
  f.expanded.circles.push({ center: p }); assert.equal(f.query.isSplineOnlyFitPoint(p), false);
  f.expanded.circles.length = 0; p.blockProjection = false; assert.equal(f.query.isSplineOnlyFitPoint(p), false);
});
