const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const sandbox = { window: { SplineGeometry: { closestPoint: () => ({ t: 0.5, point: { x: 5, y: 2 } }) } } }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/spline_edit_command.js'), 'utf8'), sandbox);
function fixture() {
  const calls = [], state = { success: true, allowed: true, shared: false }; let seq = 4;
  const points = Array.from({ length: 4 }, (_, i) => ({ id: 'P' + i, kind: 'endpoint', x: i, y: i }));
  const spline = { id: 'SP1', fitPoints: points.slice(), curve: () => ({ valid: true, spans: [{ t1: 1 }] }) };
  const constraint = { point: points[1] }, annotation = { point: points[1] };
  const model = { splines: [spline], points: points.slice(), constraints: [constraint], annotations: [annotation] };
  const selection = { annotations: [annotation], set: (key, value) => { selection[key] = value; } };
  const command = sandbox.window.SplineEditCommand.create({ currentScope: () => model,
    ids: { peek: () => seq, restore: data => { seq = data.pointSeq; } },
    clearSelection: () => calls.push('clear'), canvasSelection: selection, applicationText: text => text,
    setHint: () => calls.push('hint'), updateUI: () => calls.push('ui'), draw: () => calls.push('draw'),
    snapshotModelState: () => 'snapshot', restoreModelState: snapshot => calls.push(snapshot),
    stabilizeActiveParameterNamespace: () => ({ success: state.success, dependent: { success: state.success } }),
    elementSketchId: () => 'S1', invalidateAnalysis: () => calls.push('invalidate'), recordHistory: () => calls.push('history'),
    guardSketchProjectionShapeEdit: () => state.allowed,
    addPoint: (x, y, fixed, kind) => { const p = { id: 'P' + seq++, x, y, fixed, kind }; model.points.push(p); return p; },
    isPointUsedByLine: () => state.shared, isPointUsedByCircle: () => false, isPointUsedByArc: () => false,
    constraintReferencesPoint: (c, p) => c.point === p, guardDimensionSymbolDeletion: () => true,
    geometryElementKey: p => p.id, annotationReferencesRemovedGeometry: (a, ids) => ids.has(a.point.id),
  });
  return { command, model, spline, points, selection, calls, state, seq: () => seq, constraint, annotation };
}
test('begin, silent activation, finish and deletion reset share one session owner', () => {
  const f = fixture(); f.command.activate(f.spline); assert.deepEqual(f.calls, []);
  f.command.begin(f.spline); assert.equal(f.command.current.spline, f.spline); assert.equal(f.selection.splines[0], f.spline);
  f.calls.length = 0; f.command.forgetDeleted(new Set()); assert.equal(f.command.current.spline, f.spline);
  f.command.forgetDeleted(new Set([f.spline])); assert.equal(f.command.current, null); assert.deepEqual(f.calls, []);
  assert.equal(f.command.finish(), false); f.command.activate(f.spline); assert.equal(f.command.finish(), true);
  assert.deepEqual(f.calls, ['hint', 'ui', 'draw']);
});
test('point insertion commits one history step and solver failure restores references and ids', () => {
  const f = fixture(); f.command.activate(f.spline);
  assert.equal(f.command.addPoint(f.spline, {}), true); const added = f.spline.fitPoints[1];
  assert.equal(added.sketchId, 'S1'); assert.equal(f.selection.points[0], added); assert.equal(f.calls.filter(c => c === 'history').length, 1);
  const before = f.spline.fitPoints.slice(), seq = f.seq(); f.state.success = false; f.calls.length = 0;
  assert.equal(f.command.addPoint(f.spline, {}), false); assert.equal(f.seq(), seq);
  assert.deepEqual(f.spline.fitPoints, before); assert.equal(f.command.current.spline, f.spline);
  assert.equal(f.model.points.length, 5); assert.equal(f.calls.includes('history'), false); assert.equal(f.calls.includes('snapshot'), true);
});
test('deletion removes only unused endpoints and their dependent data, preserving shared points', () => {
  for (const shared of [false, true]) {
    const f = fixture(); f.state.shared = shared; f.command.activate(f.spline);
    assert.equal(f.command.deletePoint(f.spline, f.points[1]), true); assert.equal(f.spline.fitPoints.length, 3);
    assert.equal(f.model.points.includes(f.points[1]), shared); assert.equal(f.model.constraints.includes(f.constraint), shared);
    assert.equal(f.model.annotations.includes(f.annotation), shared); assert.equal(f.selection.annotations.includes(f.annotation), shared);
    assert.equal(f.command.deletePoint(f.spline, f.points[0]), false);
    assert.equal(f.calls.filter(c => c === 'history').length, 1);
  }
});
test('failed deletion restores model arrays and fit point identities without recording history', () => {
  const f = fixture(); f.command.activate(f.spline); f.state.success = false;
  assert.equal(f.command.deletePoint(f.spline, f.points[1]), false);
  assert.equal(f.spline.fitPoints[1], f.points[1]); assert.equal(f.model.constraints[0], f.constraint);
  assert.equal(f.model.annotations[0], f.annotation); assert.equal(f.command.current.spline, f.spline);
  assert.equal(f.calls.includes('history'), false);
  f.command.reset(); f.calls.length = 0; assert.equal(f.command.addPoint(f.spline, {}), false); assert.deepEqual(f.calls, []);
});
