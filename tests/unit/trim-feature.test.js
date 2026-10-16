const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js',
  'src/geometry/pattern_instance_model.js', 'src/constraints/references.js', 'src/editing/geometry_ids.js',
  'src/editing/geometry_creation.js', 'src/editing/checkpoint.js', 'src/editing/selection.js', 'src/editing/trim_query.js',
  'src/editing/trim_editing.js', 'src/commands/trim_command.js', 'src/application/trim_feature.js', 'src/testing/trim_test_driver.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}
const w = sandbox.window, g = w.GeometrySolver;
const scope = () => ({ points: [], lines: [], circles: [], arcs: [], splines: [], constraints: [], annotations: [],
  blockInstances: [], geometryInstances: [], parameters: [], nextDimensionParameterIndex: 1 });
function fixture() {
  const state = { scope: scope(), scale: 2, reads: 0, solved: true }, events = [], ids = w.GeometryIds.create();
  const currentScope = () => { state.reads++; return state.scope; }, selection = w.CanvasSelection.create();
  const references = w.ConstraintReferences.create({ resolveGeometryRef: () => null });
  const geometry = w.GeometryCreation.create({ currentScope, ids, assignSketchId: item => { item.sketchId = 'S1'; },
    currentConstruction: () => false, minLineLength: 1, minArcLength: 1 });
  const checkpoint = w.EditingCheckpoint.create({ currentScope, ids, invalidateProjection() {}, invalidateAnalysis() {} });
  const preview = { trim: {}, setTrim(value) { assert.equal(this, preview); this.trim = value; } };
  const push = constraint => { constraint.sketchId = 'S1'; state.scope.constraints.push(constraint); return constraint; };
  const used = point => state.scope.lines.some(line => line.p1 === point || line.p2 === point)
    || [...state.scope.circles, ...state.scope.arcs].some(item => item.center === point);
  const feature = w.TrimFeature.create({ currentScope, geometry, references, isActiveSketchElement: item => item.sketchId === 'S1',
    minLineLength: 1, minArcLength: 1, pushModelConstraint: push, elementSketchId: item => item.sketchId,
    isPointUsedByPrimitive: used, isReferencePoint: point => point.kind === 'endpoint' && !used(point)
      && state.scope.constraints.some(constraint => constraint.enabled !== false && references.constraintReferencesPoint(constraint, point)),
    viewportScale: () => state.scale, preview, checkpoint, hitSketchIdentityElement: () => ({ sketchId: 'S1' }), guardSketchEdit: () => true,
    activeSketchId: () => 'S1', setHint: () => events.push('hint'), draw: () => events.push('draw'), guardSketchProjectionShapeEdit: () => true,
    applicationText: (_ja, en) => en, clearSelection: selection.clear,
    stabilizeActiveParameterNamespace: () => ({ success: state.solved, result: { errorNorm: 0 } }), acceptError: 1e-4,
    invalidateAnalysis: () => events.push('invalidate'), refreshConstraintAnalysis: () => events.push('analysis'),
    updateUI: () => events.push('ui'), recordHistory: () => events.push('history'),
  });
  const point = (x, y, kind = 'endpoint') => geometry.addPoint(x, y, false, kind);
  const line = (x1, y1, x2, y2) => geometry.addLine(point(x1, y1), point(x2, y2));
  function scene() { const target = line(0, 0, 30, 0); line(10, -10, 10, 10); line(20, -10, 20, 10); return target; }
  return { feature, state, ids, selection, preview, geometry, currentScope, push, point, scene, events };
}

test('Trim composition does not read scope at creation and preview uses the current scale and replacement scope', () => {
  const f = fixture(); assert.equal(f.state.reads, 0); assert.deepEqual(f.events, []); assert.equal(Object.isFrozen(f.feature), true);
  const target = f.scene(), plan = f.feature.computePreview({ x: 15, y: 2 });
  assert.equal(plan.item, target); assert.equal(plan.kind, 'line');
  assert.equal(plan.interval.left.point.x, 10); assert.equal(plan.interval.right.point.x, 20);
  f.state.scale = 4; assert.equal(f.feature.computePreview({ x: 15, y: 2 }), null);
  f.state.scope = scope(); assert.equal(f.feature.computePreview({ x: 15, y: 0 }), null);
});

test('Trim feature transfers surviving Point constraints through the real query, editing and successful command', () => {
  const f = fixture(), target = f.scene(), oldEnd = target.p2;
  const right = f.push(new g.PointOnLineConstraint(f.point(25, 0, 'explicit'), target));
  const length = f.push(new g.DistanceConstraint(target.p1, target.p2, 30)); f.selection.set('lines', [target]);
  assert.equal(f.feature.execute({ x: 15, y: 0 }), true);
  const retainedRight = f.state.scope.lines.find(item => item !== target && item.p2 === oldEnd);
  assert.equal(target.p2.x, 10); assert.equal(retainedRight.p1.x, 20); assert.equal(right.line, retainedRight);
  assert.equal(f.state.scope.constraints.includes(right), true); assert.equal(f.state.scope.constraints.includes(length), false);
  assert.equal(f.preview.trim, null); assert.equal(f.selection.lines.length, 0); assert.equal(f.events.at(-1), 'history');
});

test('Trim failure restores original endpoints, arrays and IDs while leaving preview and selection cleared', () => {
  const f = fixture(), target = f.scene(), first = target.p1, last = target.p2, before = JSON.stringify(f.ids.snapshot());
  const points = [...f.state.scope.points]; f.selection.set('lines', [target]); f.state.solved = false;
  assert.equal(f.feature.execute({ x: 15, y: 0 }), false);
  assert.equal(target.p1, first); assert.equal(target.p2, last); assert.equal(f.state.scope.lines.length, 3);
  assert.deepEqual(Array.from(f.state.scope.points), points); assert.equal(JSON.stringify(f.ids.snapshot()), before);
  assert.equal(f.preview.trim, null); assert.equal(f.selection.lines.length, 0); assert.equal(f.events.includes('history'), false);
});

test('Trim test support composes the existing line transfer, construction exclusion and diameter transfer fixtures', () => {
  const f = fixture(), support = w.TrimTestDriver.createFeature({ feature: f.feature, geometry: f.geometry, pushModelConstraint: f.push,
    currentScope: f.currentScope, resetModelState: () => { f.state.scope = scope(); f.ids.reset(); f.selection.clear(); } });
  assert.equal(f.state.reads, 0);
  const line = support.lineTransfer.reset();
  assert.equal(line.lineCount, 2); assert.equal(line.leftConstraintOnLeftLine, true); assert.equal(line.rightConstraintOnRightLine, true);
  assert.equal(line.leftLineEnd.x, 40); assert.equal(line.rightLineStart.x, 60);
  const construction = support.constructionBoundary.boundaryCase();
  assert.deepEqual(Array.from(construction.lineBoundaryXs), [-100, -60, 60, 100]);
  const single = support.diameterTransfer.diameterCase(2); assert.equal(single.arcCount, 1); assert.equal(single.retainedSameConstraint, true);
  const multiple = support.diameterTransfer.diameterCase(3); assert.equal(multiple.arcCount, 2); assert.equal(multiple.diameterCount, 0);
});
