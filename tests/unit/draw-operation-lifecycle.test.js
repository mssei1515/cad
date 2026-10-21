const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/editing/draw_operation_lifecycle.js'), 'utf8'), sandbox);
test('tool mode classification works before construction and remains distinct from an active drawing draft', () => {
  const isToolMode = sandbox.window.DrawOperationLifecycle.isToolMode;
  assert.equal(isToolMode('instance-sources'), true);
  const f = fixture(); f.state.mode = 'hatch';
  assert.equal(isToolMode(f.state.mode), true); assert.equal(f.controller.active(), false);
  f.state.mode = 'select'; f.deps.line.startPoint = { x: 0, y: 0 };
  assert.equal(isToolMode(f.state.mode), false); assert.equal(f.controller.active(), true); assert.deepEqual(f.calls, []);
  for (const mode of ['select', 'annotation', 'block-placement', '', null, undefined, 0, Symbol('line'), { [Symbol.toPrimitive]() { throw new Error('coercion'); } }]) assert.equal(isToolMode(mode), false);
});
function fixture() {
  const calls = [], deps = {}, state = { mode: "select" }; const record = name => () => calls.push(name);
  for (const name of ['instances', 'instanceSources', 'centerline', 'line', 'rectangle', 'slot', 'fillet', 'spline', 'splineEditing', 'projection', 'preview', 'offset', 'hatch']) deps[name] = { reset: record(name) };
  deps.centerline.targets = []; deps.spline.points = []; deps.offset.entries = []; deps.spline.cancel = record('splineCancel');
  deps.circular = { resetCircle: record('circle'), resetArcs: record('arcs'), resetCenterArc: record('centerArc') };
  deps.preview.setPointer = value => { assert.equal(value, null); calls.push('pointer'); };
  deps.cancelConstraintTargetCommand = record('cancelConstraint'); deps.setMode = value => calls.push(value); deps.clearTrimHover = record('trimHover');
  deps.transient = { clearPoint: record('clearPoint'), clearLineCompletion: record('clearCompletion'), rollbackLineStart: record('rollbackLine') };
  for (const name of ['clearSnap', 'clearSelection', 'selectMode', 'updateToolbar', 'setHint', 'updateUI', 'draw']) deps[name] = record(name);
  deps.cancelPendingCommand = message => { assert.equal(message, ""); calls.push("pendingCancel"); }; deps.readMode = () => state.mode;
  return { deps, calls, state, controller: sandbox.window.DrawOperationLifecycle.create(deps) };
}

test('session owns live mode before binding and uses it for actual transitions after binding', () => {
  const f = fixture(), session = sandbox.window.DrawOperationLifecycle.createSession();
  const read = session.readMode, write = session.setMode, select = session.selectMode;
  assert.equal(read(), 'select'); assert.equal(session.mode, 'select');
  assert.equal(write('offset'), undefined); assert.equal(session.isToolMode(), true);
  assert.deepEqual(f.calls, []);
  assert.equal(session.bind(f.deps), session); assert.deepEqual(f.calls, []);
  assert.equal(session.mode, 'offset');
  assert.equal(session.start('line'), true); assert.equal(read(), 'line');
  assert.deepEqual(f.calls, ['cancelConstraint', 'line', 'rectangle', 'fillet', 'circle', 'arcs', 'pointer', 'clearSnap', 'updateToolbar', 'setHint', 'draw']);
  f.calls.length = 0; session.cancel(); assert.equal(read(), 'line');
  assert.ok(f.calls.includes('rollbackLine')); assert.ok(f.calls.includes('splineCancel'));
  f.calls.length = 0; session.exit(); assert.equal(read(), 'select');
  assert.equal(f.calls.includes('selectMode'), false); assert.equal(f.calls.includes('rollbackLine'), false);
  write('block-place'); assert.equal(session.isToolMode(), false); assert.equal(select(), undefined); assert.equal(read(), 'select');
  assert.equal(f.state.mode, 'select'); // The legacy fixture's external state is not the session's mode.
});

test('session preserves reset subsets, start guards and partially applied transitions on failure', () => {
  const f = fixture(), session = sandbox.window.DrawOperationLifecycle.createSession();
  f.deps.instances.clearSources = () => f.calls.push('clearSources');
  session.bind({ ...f.deps, canStart: () => false });
  session.setMode('slot'); assert.equal(session.start('line'), false); assert.deepEqual(f.calls, []);
  session.prepareConstraintCancel(); assert.deepEqual(f.calls, ['slot']);
  f.calls.length = 0; session.resetInputsForSketchChange(); assert.equal(session.mode, 'slot');
  assert.deepEqual(f.calls, ['line', 'rectangle', 'fillet', 'circle', 'arcs', 'preview', 'offset']);
  f.calls.length = 0; session.resetForDocument(); assert.equal(session.mode, 'slot');
  assert.equal(f.calls.includes('rollbackLine'), false); assert.equal(f.calls.includes('splineCancel'), false);
  f.calls.length = 0; const marker = new Error('line reset failed'); f.deps.line.reset = () => { throw marker; };
  assert.throws(() => session.prepare('offset'), error => error === marker);
  assert.equal(session.mode, 'offset'); assert.deepEqual(f.calls, []);
  assert.throws(() => session.prepareDimensionStart(), error => error === marker);
  assert.equal(session.mode, 'select'); assert.deepEqual(f.calls, []);
});
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

test('specialized preparation resets only mode inputs and leaves selection and feedback to the command', () => {
  const f = fixture(); f.controller.prepare('offset');
  assert.deepEqual(f.calls, ['offset', 'line', 'rectangle', 'fillet', 'circle', 'arcs', 'preview', 'offset']);
  f.calls.length = 0; f.controller.prepare('fillet');
  assert.deepEqual(f.calls, ['fillet', 'line', 'rectangle', 'fillet', 'circle', 'arcs', 'pointer']);
});


test('document replacement discards authoring drafts without rollback, UI work or resetting unrelated preview fields', () => {
  const f = fixture();
  f.deps.instances.clearSources = () => f.calls.push('clearSources');
  f.deps.preview.trim = { retained: true };
  f.controller.resetForDocument();
  assert.deepEqual(f.calls, ['line', 'centerline', 'clearPoint', 'clearCompletion', 'rectangle', 'slot', 'fillet', 'circle', 'arcs', 'spline', 'projection', 'clearSources', 'instanceSources', 'splineEditing', 'pointer', 'offset']);
  assert.equal(f.deps.preview.trim.retained, true);
  f.calls.length = 0;
  f.controller.resetForDocument();
  assert.equal(f.calls.length, 16);
});

test('document reset propagates command failure and leaves later owners untouched', () => {
  const f = fixture(), marker = new Error('reset failed');
  f.deps.rectangle.reset = () => { throw marker; };
  assert.throws(() => f.controller.resetForDocument(), error => error === marker);
  assert.deepEqual(f.calls, ['line', 'centerline', 'clearPoint', 'clearCompletion']);
});


test('Sketch switch resets only its ordered drawing input subset without rollback, selection, feedback or mode effects',()=>{
 const f=fixture();f.deps.slot.firstCenter={id:'slot'};f.deps.centerline.targets=[{id:'target'}];f.deps.spline.points=[{id:'point'}];
 const slot=f.deps.slot.firstCenter,targets=f.deps.centerline.targets,points=f.deps.spline.points;
 assert.equal(f.controller.resetInputsForSketchChange(),undefined);
 assert.deepEqual(f.calls,['line','rectangle','fillet','circle','arcs','preview','offset']);
 assert.equal(f.deps.slot.firstCenter,slot);assert.equal(f.deps.centerline.targets,targets);assert.equal(f.deps.spline.points,points);
});

test('Sketch input reset errors propagate at the same boundary without resetting later owners or adding recovery',()=>{
 const f=fixture(),error=new Error('circle reset');f.deps.circular.resetCircle=()=>{throw error;};
 assert.throws(()=>f.controller.resetInputsForSketchChange(),value=>value===error);assert.deepEqual(f.calls,['line','rectangle','fillet']);
});


test('constraint and dimension start preparation retain distinct cancellation prefixes and the same ordered reset subset', () => {
  const f = fixture();
  f.controller.prepareConstraintStart();
  assert.deepEqual(f.calls, ['pendingCancel', 'centerline', 'slot', 'selectMode', 'line', 'rectangle', 'fillet', 'circle', 'arcs', 'preview']);
  f.calls.length = 0; f.controller.prepareDimensionStart();
  assert.deepEqual(f.calls, ['selectMode', 'line', 'rectangle', 'fillet', 'circle', 'arcs', 'preview']);
});

test('start preparation propagates a command reset error without resetting later drafts, drawing or rolling back', () => {
  for (const method of ['prepareConstraintStart', 'prepareDimensionStart']) {
    const f = fixture(), marker = new Error('circle reset failed'); f.deps.circular.resetCircle = () => { throw marker; };
    assert.throws(() => f.controller[method](), error => error === marker);
    assert.deepEqual(f.calls, [...(method === 'prepareConstraintStart' ? ['pendingCancel', 'centerline', 'slot'] : []), 'selectMode', 'line', 'rectangle', 'fillet']);
  }
});

test('constraint cancellation reads mode independently before each conditional reset without selecting or notifying', () => {
  const f = fixture(); f.state.mode = 'centerline';
  f.deps.centerline.reset = () => { f.calls.push('centerline'); f.state.mode = 'slot'; };
  f.controller.prepareConstraintCancel(); assert.deepEqual(f.calls, ['centerline', 'slot']); assert.equal(f.state.mode, 'slot');
  f.state.mode = 'line'; f.calls.length = 0; f.controller.prepareConstraintCancel(); assert.deepEqual(f.calls, []);
});
