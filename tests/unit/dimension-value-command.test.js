const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/dimension_value_command.js'), 'utf8'), sandbox);
function fixture({ existing = false, success = true, value = 25, added = true, special = null } = {}) {
  const constraint = { expression: '10' }, calls = [];
  let pending = { type: 'distance-value', target: {}, buffer: '25', dimension: {}, constraint: existing ? constraint : null };
  const command = sandbox.window.DimensionValueCommand.create({
    ...(special === null ? {} : { submitSpecialDistance: () => { calls.push('special'); return special; } }),
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

test('annotation distance submission reuses evaluation and input lifecycle without scaling geometry or adding a geometry dimension', () => {
  for (const accepted of [true, false]) {
    const f = fixture({special: accepted}); f.command.submit();
    assert.deepEqual(f.calls, accepted ? ['special', 'clear', 'hide', 'ui', 'draw'] : ['special', 'ui', 'draw']);
    assert.equal(f.pending() === null, accepted);
  }
});

for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
}
function supportFixture() {
  const events = [], state = { ready: false, value: 20, namespace: 'document', accepted: true, intervalResult: true, anchorResult: true, failure: null };
  const ready = () => assert.equal(state.ready, true);
  const fail = name => { if (state.failure?.name === name) throw state.failure.error; };
  const ports = {
    synchronizedInstanceEditing: { interval(pending, value, expression) { ready(); events.push(['interval', pending, value, expression]); fail('interval'); return state.intervalResult; } },
    annotationDimensions: { setValue(constraint, value) { ready(); events.push(['annotation', constraint, value]); fail('annotation'); return state.accepted; } },
    annotationAnchorConstraints: { submitDistance(value, axis, dimension) { ready(); events.push(['anchor', value, axis, dimension]); fail('anchor'); return state.anchorResult; } },
    expressionFromUserInput: input => { ready(); events.push(['normalize', input]); fail('normalize'); return 'normalized:'+input; },
    evaluateDimensionExpressionDraft: (constraint, expression, namespace, options) => { ready(); events.push(['evaluate', constraint, expression, state.namespace, namespace, options]); fail('evaluate'); return state.value; },
    targetFromConstraint: constraint => { ready(); events.push(['target', constraint]); fail('target'); return state.target; },
    parameterErrorText: error => { ready(); events.push(['error', error]); return error.message; },
    setHint: (...args) => { ready(); events.push(['hint', ...args]); },
    recordHistory: label => { ready(); events.push(['history', label]); fail('history'); },
    canvasSelection: { dimensionConstraint: null, constraint: { id: 'old' }, annotations: [{}], set(field, value) { ready(); assert.equal(this, ports.canvasSelection); events.push(['selection', field, value]); this[field] = value; } },
    resetDimensionDrag: () => { ready(); events.push(['drag-reset', state.drag]); fail('drag'); },
  };
  const support = sandbox.window.DimensionValueCommand.createEditingSupport(ports); assert.deepEqual(events, []); state.ready = true;
  return { support, state, events, ports, names: () => events.map(event => event[0]) };
}
function intervalConstraint() {
  const G = sandbox.window.GeometrySolver;
  return new G.InstanceAngleIntervalConstraint(new G.Point('P', 0, 0), .5);
}

test('editing support is lazy and selection preserves identity and clear-before-live-drag-reset even on failure', () => {
  const f = supportFixture(), constraint = {}, annotations = f.ports.canvasSelection.annotations; assert.ok(Object.isFrozen(f.support));
  f.state.drag = {}; f.support.selectEditedConstraint(constraint);
  assert.deepEqual(f.names(), ['selection','selection','drag-reset']); assert.equal(f.events[2][1], f.state.drag);
  assert.equal(f.ports.canvasSelection.dimensionConstraint, constraint); assert.equal(f.ports.canvasSelection.constraint, null); assert.equal(f.ports.canvasSelection.annotations, annotations);
  f.events.length = 0; const error = new Error('reset failed'); f.state.failure = { name: 'drag', error };
  assert.throws(() => f.support.selectEditedConstraint(constraint), value => value === error); assert.deepEqual(f.names(), ['selection','selection','drag-reset']);
});

test('special submit keeps interval before annotation before anchor, exact arguments and null versus rejection results', () => {
  const f = supportFixture(), dimension = {}, constraint = { annotationOwner: {} }, pending = { target: { interval: true, annotationAnchor: true }, constraint, buffer: '=a', dimension };
  f.state.intervalResult = false; assert.equal(f.support.submitSpecialDistance(pending, -20), false);
  assert.deepEqual(f.names(), ['normalize','interval']); assert.equal(f.events[1][1], pending); assert.equal(f.events[1][2], -20); assert.equal(f.events[1][3], 'normalized:=a');
  delete pending.target.interval; f.events.length = 0; f.state.accepted = false; assert.equal(f.support.submitSpecialDistance(pending, 25), false);
  assert.deepEqual(f.names(), ['annotation','hint']); assert.equal(f.events[0][1], constraint); assert.equal(f.events[1][2], 'error');
  f.events.length = 0; f.state.accepted = true; assert.equal(f.support.submitSpecialDistance(pending, 25), true); assert.deepEqual(f.names(), ['annotation','history']); assert.equal(f.events[1][1], '注記寸法値変更');
  f.events.length = 0; delete pending.constraint; pending.target.dimensionAxis = 'y'; const result = {}; f.state.anchorResult = result;
  assert.equal(f.support.submitSpecialDistance(pending, 15), result); assert.deepEqual(f.events, [['anchor',15,'y',dimension]]);
  f.events.length = 0; assert.equal(f.support.submitSpecialDistance({ target: {} }, 15), null); assert.deepEqual(f.events, []);
});

test('special property editing retains type/property guards, target and current expression scope, and annotation null constraint', () => {
  const f = supportFixture(), constraint = intervalConstraint(); constraint.dimension = {}; f.state.target = { interval: true };
  assert.equal(f.support.commitSpecialProperty(constraint, 'constraint-parameter-name', 'x'), null); assert.deepEqual(f.events, []);
  assert.equal(f.support.commitSpecialProperty(constraint, 'constraint-expression', '=x'), true);
  assert.deepEqual(f.names(), ['normalize','target','evaluate','interval']); assert.equal(f.events[2][1], constraint); assert.equal(f.events[3][1].constraint, constraint); assert.equal(f.events[3][1].target, f.state.target); assert.equal(f.events[3][1].dimension, constraint.dimension);
  f.events.length = 0; f.state.namespace = 'block'; f.state.value = -30; f.support.commitSpecialProperty(constraint, 'constraint-expression', '=y'); assert.equal(f.events[2][3], 'block'); assert.equal(f.events[3][2], -30);
  f.events.length = 0; const annotation = { annotationOwner: {} }; assert.equal(f.support.commitSpecialProperty(annotation, 'constraint-expression', '2'), true);
  assert.deepEqual(f.names(), ['normalize','evaluate','annotation','history']); assert.equal(f.events[1][1], null); assert.equal(f.events[2][1], annotation);
  f.events.length = 0; assert.equal(f.support.commitSpecialProperty(annotation, 'constraint-parameter-name', 'name'), false);
  assert.deepEqual(f.names(), ['normalize','evaluate','error','hint']); assert.equal(f.events[2][1].message, '注記の距離拘束が成立しません');
  f.events.length = 0; assert.equal(f.support.commitSpecialProperty({}, 'constraint-expression', '2'), null); assert.deepEqual(f.events, []);
});

test('submit errors propagate while Properties errors become one error hint without adding rollback or duplicate history', () => {
  for (const name of ['normalize','interval','annotation','anchor','history']) {
    const f = supportFixture(), error = new Error(name); f.state.failure = { name, error };
    const pending = name === 'normalize' || name === 'interval' ? { target: { interval: true }, buffer: 'x' } : name === 'anchor' ? { target: { annotationAnchor: true } } : { constraint: { annotationOwner: {} } };
    assert.throws(() => f.support.submitSpecialDistance(pending, 25), value => value === error); assert.ok(!f.names().includes('error')); assert.ok(!f.names().includes('hint'));
  }
  for (const name of ['normalize','target','evaluate','interval','annotation','history']) {
    const f = supportFixture(), error = new Error(name); f.state.failure = { name, error };
    const constraint = name === 'annotation' || name === 'history' ? { annotationOwner: {} } : intervalConstraint();
    assert.equal(f.support.commitSpecialProperty(constraint, 'constraint-expression', 'x'), false);
    assert.deepEqual(f.names().slice(-2), ['error','hint']); assert.equal(f.events.at(-2)[1], error); assert.deepEqual(f.events.at(-1), ['hint',name,'error']);
    assert.ok(f.names().filter(value => value === 'history').length <= 1);
  }
  const f = supportFixture(); f.state.accepted = false;
  assert.equal(f.support.commitSpecialProperty({ annotationOwner: {} }, 'constraint-expression', 'x'), false);
  assert.deepEqual(f.names(), ['normalize','evaluate','annotation','error','hint']);
});

test('composed special submit retains the general permission, evaluation and pending/input lifecycle for success and rejection', () => {
  for (const interval of [false,true]) for (const accepted of [false,true]) {
    const f = supportFixture(); f.state.intervalResult = f.state.accepted = accepted;
    let pending = { type: 'distance-value', target: interval ? { interval: true } : {}, constraint: interval ? intervalConstraint() : { annotationOwner: {} }, buffer: '=x' };
    const original = pending;
    const command = sandbox.window.DimensionValueCommand.create({ ...f.ports, ...f.support,
      canEdit: () => true, getPending: () => pending, setPending: value => { f.events.push(['pending',value]); pending = value; },
      constraintSketchId: () => 'S', hideDimensionValueInput: () => f.events.push(['hide']), updateUI: () => f.events.push(['ui']), draw: () => f.events.push(['draw']),
    });
    command.submit(); assert.equal(pending, accepted ? null : original);
    assert.deepEqual(f.names().slice(-2), ['ui','draw']); assert.equal(f.names().includes('hide'), accepted);
    assert.equal(f.names().filter(name => name === 'normalize').length, interval ? 2 : 1); assert.equal(f.names().filter(name => name === 'history').length, !interval && accepted ? 1 : 0);
    assert.equal(f.events.find(event => event[0] === 'evaluate')[5].signedAngle, interval);
  }
  const f = supportFixture(), constraint = intervalConstraint();
  const denied = sandbox.window.DimensionValueCommand.create({ ...f.ports, ...f.support, canEdit: () => false, constraintSketchId: () => 'S' });
  assert.equal(denied.commitProperty(constraint, 'constraint-expression', 'x'), false); assert.deepEqual(f.events, []);
});
