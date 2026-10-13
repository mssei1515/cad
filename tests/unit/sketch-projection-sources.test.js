const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['geometry/geometry_kernel', 'geometry/spline_geometry', 'solver/constraint_solver', 'constraints/sketch_projection_queries']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src', file + '.js'), 'utf8'), sandbox);
const { Point, Line, SketchProjectionConstraint } = sandbox.window.GeometrySolver;
function fixture() {
  const calls = [], state = { scope: { geometryInstances: [], constraints: [] }, active: 'target', reference: true, visible: true };
  const queries = sandbox.window.SketchProjectionQueries.create({ currentScope: () => state.scope, constraintIsOperational: c => c.enabled !== false });
  const api = sandbox.window.SketchProjectionQueries.createSources({ currentScope: () => { calls.push('scope'); return state.scope; }, activeSketchId: () => { calls.push('active'); return state.active; },
    geometryRefForItem: item => { calls.push('ref'); return item ? { id: String(item.id) } : null; }, geometryRefsEqual: (a, b) => String(a.id) === String(b.id),
    queries: { sketchProjectionConstraints: () => { calls.push('constraints'); return queries.sketchProjectionConstraints(); }, sketchProjectionPointPairs: queries.sketchProjectionPointPairs },
    constraintIsOperational: c => { calls.push('operational'); return c.enabled !== false; }, constraintSketchId: c => c.sketchId,
    geometryElementKey: item => item ? item.kind + ':' + item.id : null, geometryKindForItem: item => { calls.push('kind'); return item?.kind || (item instanceof Point ? 'point' : null); },
    elementSketchId: item => { calls.push('sketch'); return item?.sketchId; }, isReferenceSourceSketchId: () => { calls.push('reference'); return state.reference; },
    isVisibleSketchElement: () => { calls.push('visible'); return state.visible; }, operandElement: op => op.item,
  });
  return { api, state, calls };
}
test('projection Instance coverage precedes legacy constraints and reads current model/target Sketch without caches', () => {
  const h = fixture(), item = { id: 'L', kind: 'line' }; h.state.scope.geometryInstances = [{ type: 'sketchProjection', sketchId: 'target', sources: [{ id: 'L' }] }];
  assert.equal(h.api.sketchProjectionSourceIsCovered(item), true); assert.deepEqual(h.calls, ['active', 'ref', 'scope']);
  h.calls.length = 0; h.state.active = 'other'; assert.equal(h.api.sketchProjectionSourceIsCovered(item), false); assert.equal(h.calls.includes('constraints'), true);
  h.calls.length = 0; assert.equal(h.api.sketchProjectionSourceIsCovered(item, 'target'), true); assert.equal(h.calls.includes('active'), false);
  h.state.scope = { geometryInstances: [], constraints: [] }; h.calls.length = 0; assert.equal(h.api.sketchProjectionSourceIsCovered(null, 'target'), false); assert.deepEqual(h.calls, ['ref']);
});
test('legacy Point coverage uses identity or string ID across source nodes and preserves operational/target restrictions', () => {
  const h = fixture(), source = new Point('P', 0, 0), end = new Point('E', 1, 0), target = new Point('T', 0, 0), line = new Line('L', source, end), copy = new Line('Q', target, new Point('U', 1, 0));
  const c = new SketchProjectionConstraint('line', line, copy); c.sketchId = 'target'; h.state.scope.constraints = [c];
  assert.equal(h.api.sketchProjectionSourceIsCovered(source), false);
  const point = new SketchProjectionConstraint('point', source, target); point.sketchId = 'target'; h.state.scope.constraints = [point];
  assert.equal(h.api.sketchProjectionSourceIsCovered(source), true); assert.equal(h.api.sketchProjectionSourceIsCovered(new Point('P', 9, 9)), true);
  point.enabled = false; assert.equal(h.api.sketchProjectionSourceIsCovered(source), false); point.enabled = true; point.sketchId = 'other'; assert.equal(h.api.sketchProjectionSourceIsCovered(source), false);
});
test('legacy primitive coverage requires matching kind/source key and preserves target/operational filtering', () => {
  const h = fixture(), item = { id: 'L', kind: 'line' }, source = { ...item }, constraint = new SketchProjectionConstraint('line', source, {}); constraint.sketchId = 'target'; h.state.scope.constraints = [constraint];
  assert.equal(h.api.sketchProjectionSourceIsCovered(item), true); constraint.kind = 'circle'; assert.equal(h.api.sketchProjectionSourceIsCovered(item), false);
  constraint.kind = 'line'; constraint.source.id = 'other'; assert.equal(h.api.sketchProjectionSourceIsCovered(item), false); constraint.source.id = 'L'; constraint.enabled = false; assert.equal(h.api.sketchProjectionSourceIsCovered(item), false);
});
test('projection candidate conversion retains refs/metadata and current reference/visibility guards including operand routing', () => {
  const h = fixture(), item = { id: 'L', kind: 'line', sketchId: 'source' }, entry = h.api.sketchProjectionEntryFromOperand({ item });
  assert.equal(entry.item, item); assert.equal(entry.kind, 'line'); assert.equal(entry.sketchId, 'source'); assert.equal(entry.key, 'line:L');
  h.state.reference = false; h.calls.length = 0; assert.equal(h.api.sketchProjectionEntryFromItem(item), null); assert.deepEqual(h.calls, ['kind', 'sketch', 'reference']);
  h.state.reference = true; h.state.visible = false; assert.equal(h.api.sketchProjectionEntryFromItem(item), null);
  h.calls.length = 0; assert.equal(h.api.sketchProjectionEntryFromItem(null), null); assert.deepEqual(h.calls, ['kind', 'sketch']);
});
