const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/editing/draw_operation_lifecycle.js'), 'utf8'), sandbox);
function fixture() {
  const calls = [], deps = {}; const record = name => () => calls.push(name);
  for (const name of ['instances', 'instanceSources', 'centerline', 'line', 'rectangle', 'slot', 'fillet', 'spline', 'splineEditing', 'projection', 'preview', 'offset', 'hatch']) deps[name] = { reset: record(name) };
  deps.centerline.targets = []; deps.spline.points = []; deps.offset.entries = []; deps.spline.cancel = record('splineCancel');
  deps.circular = { resetCircle: record('circle'), resetArcs: record('arcs'), resetCenterArc: record('centerArc') };
  deps.preview.setPointer = value => { assert.equal(value, null); calls.push('pointer'); };
  deps.cancelConstraintTargetCommand = record('cancelConstraint'); deps.setMode = value => calls.push(value); deps.clearTrimHover = record('trimHover');
  deps.transient = { clearPoint: record('clearPoint'), clearLineCompletion: record('clearCompletion'), rollbackLineStart: record('rollbackLine') };
  for (const name of ['clearSnap', 'clearSelection', 'selectMode', 'updateToolbar', 'setHint', 'updateUI', 'draw']) deps[name] = record(name);
  return { deps, calls, controller: sandbox.window.DrawOperationLifecycle.create(deps) };
}
test('exit resets drafts and selects normal mode without rolling geometry back', () => {
  const f = fixture(); f.controller.exit();
  assert.deepEqual(f.calls, ['instances', 'instanceSources', 'centerline', 'line', 'clearPoint', 'clearCompletion', 'rectangle', 'slot', 'fillet', 'circle', 'arcs', 'spline', 'splineEditing', 'projection', 'preview', 'offset', 'hatch', 'clearSnap', 'selectMode', 'updateToolbar', 'setHint', 'updateUI', 'draw']);
});
test('cancel rolls back provisional line and spline geometry but preserves the current mode', () => {
  const f = fixture(); f.controller.cancel();
  assert.deepEqual(f.calls, ['centerline', 'rollbackLine', 'clearPoint', 'clearCompletion', 'line', 'rectangle', 'slot', 'fillet', 'circle', 'arcs', 'splineCancel', 'splineEditing', 'projection', 'preview', 'offset', 'hatch', 'clearSnap', 'clearSelection', 'setHint', 'updateUI', 'draw']);
});
test('continuous-line exit retains its narrower reset scope', () => {
  const f = fixture(); f.controller.exitLine();
  assert.deepEqual(f.calls, ['centerline', 'line', 'rectangle', 'slot', 'fillet', 'preview', 'offset', 'clearSnap', 'selectMode', 'updateToolbar', 'setHint', 'updateUI', 'draw']);
});
test('activity reads each live command draft without changing it', () => {
  const f = fixture(); assert.equal(f.controller.active(), false);
  for (const [owner, field, value] of [['line','startPoint',{}], ['centerline','targets',[{}]], ['centerline','firstPoint',{}], ['rectangle','startPoint',{}], ['slot','firstCenter',{}], ['slot','secondCenter',{}], ['fillet','firstLine',{}], ['circular','circleCenterPoint',{}], ['circular','arcCenterPoint',{}], ['circular','arcStartPoint',{}], ['circular','threePointArcStart',{}], ['circular','threePointArcEnd',{}], ['spline','points',[{}]], ['offset','source',{}], ['offset','entries',[{}]]]) {
    const before = f.deps[owner][field]; f.deps[owner][field] = value;
    assert.equal(f.controller.active(), true, owner + '.' + field); assert.equal(f.deps[owner][field], value);
    f.deps[owner][field] = before; assert.equal(f.controller.active(), false);
  }
  assert.deepEqual(f.calls, []);
});

test('basic starts preserve partial reset scope without clearing selection or pending value input', () => {
  for (const mode of ['select', 'point', 'line', 'rectangle', 'circle', 'arc', 'three-point-arc']) {
    const f = fixture(); assert.equal(f.controller.start(mode), true);
    assert.deepEqual(f.calls, ['cancelConstraint', mode, 'line', 'rectangle', 'fillet', 'circle', 'arcs', 'pointer', 'clearSnap', 'updateToolbar', 'setHint', 'draw']);
  }
});
test('slot start retains the distinct center arc reset and trim clears only its preview and hover', () => {
  const slot = fixture(); slot.controller.start('slot');
  assert.deepEqual(slot.calls, ['cancelConstraint', 'slot', 'line', 'rectangle', 'slot', 'fillet', 'circle', 'centerArc', 'pointer', 'clearSnap', 'updateToolbar', 'setHint', 'draw']);
  const trim = fixture(); trim.controller.start('trim');
  assert.deepEqual(trim.calls, ['cancelConstraint', 'trim', 'line', 'rectangle', 'fillet', 'circle', 'arcs', 'preview', 'offset', 'trimHover', 'clearSnap', 'updateToolbar', 'setHint', 'draw']);
});
test('specialized or unknown modes are not started through the basic transition', () => {
  const f = fixture(); for (const mode of ['fillet', 'offset', 'spline', 'unknown', 'toString']) assert.equal(f.controller.start(mode), false);
  assert.deepEqual(f.calls, []);
});
