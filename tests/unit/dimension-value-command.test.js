const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/dimension_value_command.js'), 'utf8'), sandbox);
function fixture({ existing = false, success = true, value = 25, added = true } = {}) {
  const constraint = { expression: '10' }, calls = [];
  let pending = { type: 'distance-value', target: {}, buffer: '25', dimension: {}, constraint: existing ? constraint : null };
  const command = sandbox.window.DimensionValueCommand.create({
    getPending: () => pending, setPending: p => { pending = p; calls.push('clear'); },
    expressionFromUserInput: value => value, evaluateDimensionExpressionDraft: () => { if (value instanceof Error) throw value; return value; },
    applicationText: (_ja, en) => en, parameterErrorText: error => error.message,
    setHint: () => calls.push('hint'), syncDimensionValueInput: () => calls.push('sync'), draw: () => calls.push('draw'),
    activeSketchId: () => 'S1', constraintSketchId: () => 'S1', sketchHasDimensionConstraint: () => false,
    captureSketchScreenFootprint: () => { calls.push('footprint'); return {}; },
    snapshotModelState: () => constraint.expression, restoreModelState: expression => { constraint.expression = expression; calls.push('restore'); },
    withTemporarySolveStepNorm: (_norm, run) => run(), solveStepNormForConstraint: () => 1,
    stabilizeActiveParameterNamespace: () => ({ success, result: { errorNorm: 0 } }), acceptError: 1e-4,
    hideDimensionValueInput: () => calls.push('hide'), recordHistory: () => calls.push('history'), updateUI: () => calls.push('ui'),
    scaleSketchForFirstDimension: () => calls.push('scale'), addDistanceConstraintFromTarget: () => { calls.push('add'); return added; },
    restoreSketchScreenFootprint: () => { calls.push('frame'); return true; },
  });
  return { command, calls, constraint, pending: () => pending };
}
test('failed existing dimension update restores the expression and keeps input open', () => {
  const f = fixture({ existing: true, success: false }); f.command.submit();
  assert.equal(f.constraint.expression, '10'); assert.ok(f.pending());
  assert.deepEqual(f.calls, ['restore', 'hint', 'sync', 'ui', 'draw']);
});
test('successful update clears input and records history before UI refresh', () => {
  const f = fixture({ existing: true }); f.command.submit();
  assert.equal(f.constraint.expression, '25'); assert.equal(f.pending(), null);
  assert.deepEqual(f.calls, ['clear', 'hide', 'hint', 'history', 'ui', 'draw']);
});
test('first dimension scales before insertion and restores framing only after acceptance', () => {
  const f = fixture(); f.command.submit();
  assert.deepEqual(f.calls, ['footprint', 'scale', 'add', 'clear', 'hide', 'frame', 'hint', 'draw']);
  const rejected = fixture({ added: false }); rejected.command.submit();
  assert.deepEqual(rejected.calls, ['footprint', 'scale', 'add']); assert.ok(rejected.pending());
});
test('evaluation errors and out-of-range values keep input and skip model operations', () => {
  const error = fixture({ value: new Error('invalid') }); error.command.submit();
  assert.deepEqual(error.calls, ['hint', 'sync', 'draw']);
  for (const value of [0, -1, NaN, Infinity]) {
    const f = fixture({ value }); f.command.submit(); assert.deepEqual(f.calls, ['hint', 'draw']); assert.ok(f.pending());
  }
  const angle = fixture({ value: 180 }); angle.pending().target.kind = 'angle'; angle.command.submit();
  assert.deepEqual(angle.calls, ['hint', 'draw']);
});

test('property expression commits once and restores failed solver changes without controlling canvas input', () => {
  for (const success of [true, false]) {
    const f = fixture({ existing: true, success });
    assert.equal(f.command.commitProperty(f.constraint, 'constraint-expression', '30'), success);
    assert.equal(f.constraint.expression, success ? '30' : '10');
    assert.ok(f.pending());
    assert.deepEqual(f.calls, success ? ['history', 'hint'] : ['restore', 'hint']);
  }
});

test('property rename restores the entire checkpoint when dependent solving fails', () => {
  const state = { name: 'd1', expression: 'd1 * 2' }, calls = [];
  const command = sandbox.window.DimensionValueCommand.create({
    snapshotModelState: () => ({ ...state }), restoreModelState: snapshot => { Object.assign(state, snapshot); calls.push('restore'); },
    renameDimension: (_constraint, value) => { state.name = value; state.expression = `${value} * 2`; },
    constraintSketchId: () => 'S1', stabilizeActiveParameterNamespace: () => ({ success: true, dependent: { success: false }, result: { errorNorm: 0 } }),
    applicationText: (_ja, en) => en, parameterErrorText: error => error.message,
    acceptError: 1e-4, recordHistory: () => calls.push('history'), setHint: () => calls.push('hint'),
  });
  assert.equal(command.commitProperty({}, 'constraint-parameter-name', 'd3'), false);
  assert.deepEqual(state, { name: 'd1', expression: 'd1 * 2' });
  assert.deepEqual(calls, ['restore', 'hint']);
});


function editFixture() {
 const events=[],state={pending:{type:'previous'},editable:true,target:{kind:'line-length'}},constraint={sketchId:'owner',expression:'= L',dimension:{offset:17}};
 const command=sandbox.window.DimensionValueCommand.create({
  canEdit:(id,operation)=>{events.push(['permission',id,operation]);return state.editable;},constraintSketchId:c=>c.sketchId,
  targetFromConstraint:c=>{assert.equal(c,constraint);events.push('target');return state.target;},isReadOnlyDimension:c=>Boolean(c.readOnlyDimension),
  setPending:value=>{events.push('pending');state.pending=value;},selectEditedConstraint:c=>{assert.equal(c,constraint);events.push('selection-and-drag');},
  defaultDimensionForTarget:t=>{assert.equal(t,state.target);events.push('default');return state.defaultDimension={offset:99};},
  expressionInputValue:value=>{events.push(['format',value]);return 'formatted:'+value;},numericDimensionExpression:c=>{assert.equal(c,constraint);events.push('numeric');return '12.5';},
  applicationText:ja=>ja,setHint:text=>{state.hint=text;events.push('hint');},draw:()=>events.push('draw'),focusDimensionValueInput:()=>events.push('focus'),
 });return {command,events,state,constraint};
}
test('dimension edit consumes denied owner hits without target resolution, while absent or unsupported constraints fall through',()=>{
 const f=editFixture(),previous=f.state.pending;
 assert.equal(f.command.startEdit(null),false);assert.deepEqual(f.events,[]);
 f.state.editable=false;assert.equal(f.command.startEdit({constraint:f.constraint}),true);
 assert.deepEqual(f.events,[['permission','owner',undefined]]);assert.equal(f.state.pending,previous);
 f.events.length=0;f.state.editable=true;f.state.target=null;assert.equal(f.command.startEdit({constraint:f.constraint}),false);
 assert.deepEqual(f.events,[['permission','owner',undefined],'target']);assert.equal(f.state.pending,previous);
});
test('read-only dimension selects and resets drag without replacing a pending command or focusing input',()=>{
 const f=editFixture(),previous=f.state.pending;f.constraint.readOnlyDimension=true;
 assert.equal(f.command.startEdit({constraint:f.constraint}),true);assert.equal(f.state.pending,previous);
 assert.deepEqual(f.events,[['permission','owner',undefined],'target','selection-and-drag','hint','draw']);
 assert.match(f.state.hint,/読み取り専用/);
});
test('dimension edit retains constraint and saved placement, formats existing expression and draws before focus',()=>{
 const f=editFixture(),hitDimension={offset:20};assert.equal(f.command.startEdit({constraint:f.constraint,dimension:hitDimension}),true);
 const pending=f.state.pending;assert.equal(pending.type,'distance-value');assert.equal(pending.constraint,f.constraint);
 assert.equal(pending.target,f.state.target);assert.equal(pending.dimension,f.constraint.dimension);assert.equal(pending.editing,false);
 assert.equal(pending.buffer,'formatted:= L');assert.equal(f.constraint.expression,'= L');
 assert.deepEqual(f.events,[['permission','owner',undefined],'target',['format','= L'],'pending','selection-and-drag','hint','draw','focus']);
});
test('dimension edit falls back from saved placement to hit placement or default, and from empty expression to numeric expression',()=>{
 for(const withHit of [true,false]){
  const f=editFixture();delete f.constraint.dimension;f.constraint.expression='';const hit={constraint:f.constraint};if(withHit)hit.dimension={offset:30};
  assert.equal(f.command.startEdit(hit),true);assert.equal(f.state.pending.dimension,withHit?hit.dimension:f.state.defaultDimension);
  assert.equal(f.state.pending.buffer,'formatted:12.5');assert.equal(f.events.includes('default'),!withHit);assert.ok(f.events.includes('numeric'));
  assert.deepEqual(f.events.slice(-4),['selection-and-drag','hint','draw','focus']);
 }
});
