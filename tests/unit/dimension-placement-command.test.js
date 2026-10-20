const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const path of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/editing/constraint_target_session.js', 'src/commands/dimension_placement_command.js']) vm.runInContext(fs.readFileSync(path, 'utf8'), sandbox);
function fixture(overrides = {}) {
 const events = [], state = { pending: null, editable: true, resolution: null, selected: [], operands: [], hit: null, readOnly: null, axis: 'x' };
 const session = sandbox.window.ConstraintTargetSession.create({ acceptTarget: () => ({ ok: true, operands: [] }) });
 const placement = { defaultDimensionForTarget: () => ({ x: 10, y: 20 }), dimensionAnchor: () => ({ x: 30, y: 40 }),
  dimensionFromAnchor: () => ({ axis: state.axis }), applyDefaultCircleDimensionLabelOffset: (t, d) => d, dimensionWithLabelAt: (t, d) => d };
 const selection={points:[],lines:[]};
 const command = sandbox.window.DimensionPlacementCommand.create({ session, selection, placement,
  getPending: () => state.pending, setPending: p => { events.push('pending'); state.pending = p; },
  canStart: () => state.editable, prepareStart: () => events.push('prepare'), selectMode: () => events.push('mode'),
  constraintOperandsFromSelection: () => state.operands, constraintResolutionFromCurrentSelection: () => state.resolution,
  selectedPrimitives: () => state.selected, angleDegrees: value => value * 180 / Math.PI, angleDimensionAngles: () => ({ signed: Math.PI / 2 }),
  readOnlyDimensionConstraintForPlacement: (...args) => { state.probe = args; return state.readOnly; },
  addReadOnlyDimensionConstraint: (...args) => { events.push('readOnly'); state.added = args; }, activeSketchId: () => 'active',
  syncSelectionFromConstraintOperands: () => events.push('selection'), makeConstraintOperand: (kind, data) => ({ kind, ...data }),
  hitConstraintOperand: () => state.hit, sameConstraintOperand: (a, b) => a === b, resolveConstraintIntent: (type, operands) => { state.resolvedOperands = operands; return state.resolution; },
  hideDimensionValueInput: () => events.push('hide'), syncDimensionValueInput: () => events.push('input'), focusDimensionValueInput: () => events.push('focus'),
  applicationText: text => text, setHint: (text, kind) => { events.push('hint'); state.hint = { text, kind }; }, log: () => events.push('log'),
  updateConstraintButtons: () => events.push('buttons'), updateToolbar: () => events.push('toolbar'), draw: () => events.push('draw'),
  ...overrides,
 });
 return { command, state, session, selection, events };
}
test('denial and invalid selection resolution leave placement untouched and do not reset drawing', () => {
 const f = fixture(); f.state.editable = false; f.command.startDistanceCommand(); assert.deepEqual(f.events, []);
 f.state.editable = true; f.state.resolution = { error: 'invalid' }; f.command.startDistanceCommand();
 assert.deepEqual(f.events, ['hint', 'log']); assert.equal(f.state.pending, null); assert.equal(f.session.command, null);
});
test('selection start and intent start retain their distinct default pointer and reset contracts', () => {
 const f = fixture(), target = { kind: 'line-length' }, operand = {};
 f.state.operands = [operand]; f.state.resolution = { target, sketchId: 'S' };
 f.command.startDistanceCommand(); assert.deepEqual(f.events, ['prepare', 'pending', 'buttons', 'toolbar', 'hint', 'draw']);
 assert.equal(f.state.pending.pointer.x, 10); assert.equal(f.state.pending.target, target); assert.equal(f.state.pending.operands[0], operand);
 f.events.length = 0;
 assert.equal(f.command.startDistanceResolution({ target, operands: [operand], referenceSketchId: 'source' }, null), true);
 assert.deepEqual(f.events, ['mode', 'selection', 'pending', 'buttons', 'toolbar', 'hint', 'draw']);
 assert.equal(f.state.pending.pointer.x, 30); assert.equal(f.state.pending.dimension.x, 10); assert.equal(f.session.operands[0], operand);
 assert.match(f.state.hint.text, /参照寸法/);
});
test('primitive start measures diameter and retains the selected primitive', () => {
 const f = fixture(), primitive = { radius: () => 7 }; f.state.selected = [primitive];
 f.command.startPrimitiveDimensionCommand('diameter'); assert.equal(f.state.pending.target.value, 14); assert.equal(f.state.pending.target.primitive, primitive);
 assert.deepEqual(f.events, ['prepare', 'pending', 'buttons', 'toolbar', 'hint', 'draw']);
});
test('value entry computes axis and angle measurements while retaining target geometry and focusing after draw', () => {
 for (const [kind, axis, value] of [['point-point', 'x', 8], ['point-point', 'y', 12], ['angle', 'x', 90]]) {
  const f = fixture(), p1 = { x: 2, y: 3 }, p2 = { x: 10, y: 15 }, target = { kind, p1, p2, value: 100 };
  f.state.axis = axis; f.state.pending = { type: 'distance-place', target, sketchId: 'S', referenceSketchId: 'R' };
  f.command.startDistanceValueInput({ x: 0, y: 0 });
  assert.equal(f.state.pending.type, 'distance-value'); assert.equal(f.state.pending.buffer, String(value)); assert.equal(f.state.pending.target.p1, p1);
  assert.notEqual(f.state.pending.target, target); assert.equal(target.dimensionAxis, undefined); assert.equal(f.state.pending.referenceSketchId, 'R');
  assert.deepEqual(f.events, ['pending', 'hint', 'buttons', 'input', 'draw', 'focus']);
 }
});
test('read-only placement clears pending and hides input before immediate registration', () => {
 const f = fixture(), constraint = {}; f.state.readOnly = constraint;
 f.state.pending = { type: 'distance-place', target: { kind: 'radius', value: 7 }, readOnlyDimension: true, referenceSketchId: 'R' };
 f.command.startDistanceValueInput({}); assert.equal(f.state.pending, null);
 assert.deepEqual(f.events, ['pending', 'hide', 'readOnly']); assert.deepEqual(f.state.added, [constraint, 'active', '参照元の測定寸法']);
});
test('retargeting rejects repeated operands and preserves old placement on error before replacing successful placement', () => {
 const f = fixture(), operand = {}, old = { type: 'distance-place', target: { kind: 'line-length' }, operands: [operand] };
 f.state.pending = old; f.state.hit = operand; assert.equal(f.command.retargetDistancePlaceWithOperand({}), false); assert.equal(f.state.pending, old);
 f.state.hit = {}; f.state.resolution = { error: 'invalid' }; assert.equal(f.command.retargetDistancePlaceWithOperand({}), true); assert.equal(f.state.pending, old);
 f.state.resolution = { target: { kind: 'line-line' }, operands: [operand, f.state.hit] }; const pointer = { x: 50, y: 60 };
 assert.equal(f.command.retargetDistancePlaceWithOperand(pointer), true); assert.notEqual(f.state.pending, old);
 assert.equal(f.state.pending.pointer, pointer); assert.equal(f.state.pending.dimension, null); assert.equal(old.target.kind, 'line-length');
});


test('distance target double-click rejects inactive commands, point or multi-line selection and a different hit without side effects',()=>{
 for(const variant of ['inactive','point','multiple','different']){
  const f=fixture(),line={};f.selection.lines=[line];f.session.replaceCommand({type:variant==='inactive'?'parallel':'distance'});
  if(variant==='point')f.selection.points=[{}];if(variant==='multiple')f.selection.lines.push({});
  assert.equal(f.command.targetDoubleClick(null,variant==='different'?{}:line,{x:1,y:2}),false);
  assert.deepEqual(f.events,[]);assert.equal(f.state.pending,null);
 }
});
test('distance target double-click consumes a single-line gesture and opens value entry only after placement starts',()=>{
 const f=fixture(),line={};f.selection.lines=[line];f.session.replaceCommand({type:'distance'});
 assert.equal(f.command.targetDoubleClick(null,line,{x:9,y:9}),true);assert.deepEqual(f.events,['buttons']);assert.equal(f.state.pending,null);
 f.events.length=0;f.state.resolution={target:{kind:'line-length',value:12}};
 assert.equal(f.command.targetDoubleClick(null,null,{x:9,y:9}),true);assert.equal(f.state.pending.type,'distance-value');
 assert.equal(f.state.pending.buffer,'12');assert.deepEqual(f.events.slice(-3),['input','draw','focus']);
 assert.deepEqual(f.events.slice(0,3),['buttons','prepare','pending']);
});

test('annotation point distance uses normal placement and input while retaining its command and skipping geometric duplicate detection', () => {
 const f = fixture(), target = { kind: 'point-point', annotationAnchor: true, p1: {x:0,y:0}, p2: {x:10,y:20}, value: 22 };
 f.state.readOnly = {};
 f.command.startDistanceResolution({target, sketchId: 'S'}, null);
 assert.equal(f.session.command.annotationAnchor, true); assert.equal(f.state.pending.type, 'distance-place');
 f.command.startDistanceValueInput({x:20,y:40});
 assert.equal(f.state.pending.type, 'distance-value'); assert.equal(f.state.pending.target.annotationAnchor, true);
 assert.equal(f.state.pending.target.dimensionAxis, 'x'); assert.equal(f.state.probe, undefined);
 assert.ok(!f.events.includes('readOnly'));
});


function intervalFixture() {
 let f; const target = { kind: 'angle' }, pointer = { x: 40, y: 50 };
 f = fixture({ guardSketchEdit: id => { f.events.push('guard'); assert.equal(id, f.state.instance.sketchId); return f.state.editable; },
  isPlacingInstance: instance => { f.events.push('placing'); assert.equal(instance, f.state.instance); return f.state.placing; },
  geometryInstanceBundle: instance => { f.events.push('bundle'); assert.equal(instance, f.state.instance); return f.state.bundle; },
  targetFromConstraint: constraint => { f.events.push('target'); if (f.state.failTarget) throw f.state.failTarget; f.state.constraint = constraint; return target; },
  cancelPendingCommand: message => { assert.equal(message, ''); f.events.push('cancelPending'); if (f.state.failCancel) throw f.state.failCancel; f.state.pending = null; },
  cancelConstraintTargetCommand: message => { assert.equal(message, ''); f.events.push('cancelConstraint'); f.session.reset(); },
  placement: { defaultDimensionForTarget: value => { f.events.push('pointer'); assert.equal(value, target); return pointer; } },
 });
 const instance = { id: 'FI1', sketchId: 'S2', placement: { kind: 'circular', angleStep: Math.PI / 6 } };
 const anchor = Object.assign(new sandbox.window.GeometrySolver.Point('FI1@anchor', 1, 2), { instanceControl: 'anchor', derivedInstance: instance });
 Object.assign(f.state, { instance, anchor, placing: false, bundle: { controlPoints: [{ instanceControl: 'destination' }, anchor] }, target, pointer });
 return f;
}

test('interval dimension denial checks authority, placement and circular kind in order without cancelling existing work', () => {
 for (const reason of ['authority', 'placing', 'kind']) {
  const f = intervalFixture(), old = { type: 'old' }; f.state.pending = old; f.session.begin('parallel', []); const command = f.session.command;
  if (reason === 'authority') f.state.editable = false;
  if (reason === 'placing') f.state.placing = true;
  if (reason === 'kind') f.state.instance.placement.kind = 'linear';
  assert.equal(f.command.startInstanceAngleDimension(f.state.instance), false);
  assert.deepEqual(f.events, reason === 'authority' ? ['guard'] : ['guard', 'placing']);
  assert.equal(f.state.pending, old); assert.equal(f.session.command, command);
 }
});

test('interval dimension cancels both sessions before selecting mode and uses the live anchor, angle step and same target/pointer', () => {
 const f = intervalFixture(); f.session.begin('parallel', []); f.state.pending = { type: 'old' };
 assert.equal(f.command.startInstanceAngleDimension(f.state.instance), true);
 assert.deepEqual(f.events, ['guard', 'placing', 'cancelPending', 'cancelConstraint', 'mode', 'bundle', 'target', 'pointer', 'pending', 'hint', 'toolbar', 'draw']);
 assert.ok(f.state.constraint instanceof sandbox.window.GeometrySolver.InstanceAngleIntervalConstraint);
 assert.equal(f.state.constraint.point, f.state.anchor); assert.equal(f.state.constraint.target, Math.PI / 6); assert.equal(f.session.command, null);
 assert.equal(f.state.pending.type, 'distance-place'); assert.equal(f.state.pending.target, f.state.target); assert.equal(f.state.pending.pointer, f.state.pointer); assert.equal(f.state.pending.sketchId, 'S2');
 f.state.instance.placement.angleStep = Math.PI / 4; f.events.length = 0; f.command.startInstanceAngleDimension(f.state.instance); assert.equal(f.state.constraint.target, Math.PI / 4);
});

test('interval dimension preserves partial cancellation and propagates errors without later placement, UI or recovery', () => {
 for (const phase of ['cancel', 'target']) {
  const f = intervalFixture(), marker = new Error(phase), old = { type: 'old' }; f.state.pending = old;
  f.session.begin('parallel', []); const command = f.session.command;
  if (phase === 'cancel') f.state.failCancel = marker; else f.state.failTarget = marker;
  assert.throws(() => f.command.startInstanceAngleDimension(f.state.instance), error => error === marker);
  assert.deepEqual(f.events, phase === 'cancel' ? ['guard', 'placing', 'cancelPending'] : ['guard', 'placing', 'cancelPending', 'cancelConstraint', 'mode', 'bundle', 'target']);
  assert.equal(f.state.pending, phase === 'cancel' ? old : null); assert.equal(f.session.command, phase === 'cancel' ? command : null);
 }
});
