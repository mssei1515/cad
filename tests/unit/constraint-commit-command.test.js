const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/commands/constraint_commit_command.js', 'utf8'), sandbox);
function implicitFixture() {
 const events = [], state = { scope: { constraints: [] }, active: 'S1', source: true, cycle: false, redundant: false };
 const command = sandbox.window.ConstraintCommitCommand.create({
  currentScope: () => { events.push(['scope']); return state.scope; },
  activeSketchId: () => { events.push(['active']); return state.active; },
  isReferenceSourceSketchId: (...args) => { events.push(['source', ...args]); return state.source; },
  wouldCreateReferenceCycle: (...args) => { events.push(['cycle', ...args]); return state.cycle; },
  pushModelConstraint: (constraint, sketchId) => { constraint.sketchId = sketchId; state.scope.constraints.push(constraint); events.push(['push', constraint, sketchId]); },
  constraintSketchId: constraint => constraint.sketchId,
  redundantConstraintInfo: (constraint, sketchId) => { events.push(['redundancy', constraint, sketchId]); return { redundant: state.redundant }; },
  forgetConstraint: constraint => { assert.equal(state.scope.constraints.includes(constraint), false); events.push(['forget', constraint]); },
 });
 return { command, state, events };
}

test('implicit additions reject absent constraints and enabled matches before Sketch reads or mutations', () => {
 const f = implicitFixture(), disabled = { enabled: false }, enabled = {}, candidate = {};
 assert.deepEqual(f.events, []);
 assert.equal(f.command.ifMissing(null, () => { throw Error('absent constraint must short circuit'); }), false);
 assert.deepEqual(f.events, []);
 const constraints = f.state.scope.constraints = [disabled, enabled], matched = [];
 assert.equal(f.command.ifMissing(candidate, item => { matched.push(item); return true; }), false);
 assert.deepEqual(matched, [enabled]); assert.equal(f.state.scope.constraints, constraints);
 assert.deepEqual(candidate, {}); assert.deepEqual(f.events, [['scope']]);
});

test('implicit additions use the current scope and explicit or current Sketch while preserving constraint identity', () => {
 const f = implicitFixture(), previous = f.state.scope, candidate = { name: 'snap' }, disabled = { enabled: false };
 f.state.scope = { constraints: [disabled] }; f.state.active = 'S2';
 assert.equal(f.command.ifMissing(candidate, () => { throw Error('disabled match must be skipped'); }), true);
 assert.equal(previous.constraints.length, 0); assert.equal(f.state.scope.constraints[1], candidate); assert.equal(candidate.sketchId, 'S2');
 assert.deepEqual(f.events.map(e => e[0]), ['scope', 'active', 'push', 'redundancy']);
 f.events.length = 0; const explicit = {};
 assert.equal(f.command.ifMissing(explicit, () => false, { sketchId: 'S3' }), true);
 assert.equal(explicit.sketchId, 'S3'); assert.equal(f.events.some(e => e[0] === 'active'), false);
});

test('implicit reference guards retain short-circuit order and mark before insertion without ordinary commit effects', () => {
 const f = implicitFixture(), candidate = { name: 'coincident' }, options = { sketchId: 'child', referenceSketchId: 'parent' };
 f.state.source = false;
 assert.equal(f.command.ifMissing(candidate, () => false, options), false);
 assert.deepEqual(f.events, [['scope'], ['source', 'parent', 'child']]); assert.deepEqual(candidate, { name: 'coincident' });
 f.events.length = 0; f.state.source = true; f.state.cycle = true;
 assert.equal(f.command.ifMissing(candidate, () => false, options), false);
 assert.deepEqual(f.events, [['scope'], ['source', 'parent', 'child'], ['cycle', 'child', 'parent']]);
 f.events.length = 0; f.state.cycle = false;
 assert.equal(f.command.ifMissing(candidate, () => false, options), true);
 assert.deepEqual(candidate, { name: '参照 coincident', reference: true, referenceSketchId: 'parent', sketchId: 'child' });
 assert.equal(f.state.scope.constraints[0], candidate);
 assert.deepEqual(f.events.map(e => e[0]), ['scope', 'source', 'cycle', 'push', 'redundancy']);
});

test('redundant implicit additions replace the current array by identity before forgetting but retain metadata on the rejected object', () => {
 const f = implicitFixture(), candidate = { id: 'same', name: 'snap' }, survivor = { id: 'same' };
 const previous = f.state.scope.constraints = [survivor]; f.state.redundant = true;
 assert.equal(f.command.ifMissing(candidate, () => false, { referenceSketchId: 'parent' }), false);
 assert.notEqual(f.state.scope.constraints, previous); assert.equal(previous[1], candidate);
 assert.equal(f.state.scope.constraints.length, 1); assert.equal(f.state.scope.constraints[0], survivor);
 assert.equal(candidate.reference, true); assert.equal(candidate.name, '参照 snap');
 assert.equal(f.events.at(-1)[0], 'forget'); assert.equal(f.events.at(-1)[1], candidate);
});
function fixture() {
 const events = [], hints = [], model = { constraints: [] }, state = { editable: true, active: true, source: true, cycle: false, dimension: false, collapse: null, duplicate: null, trace: null, target: {}, history: [], measured: 44 };
 const result = { success: true, result: { errorNorm: 0, variableCount: 2, constraintCount: 1, iterations: 3, reason: 'ok' } };
 const constraint = { name: 'test', sketchId: 'S1' }; let time = 0;
 const command = sandbox.window.ConstraintCommitCommand.create({ guardSketchEdit: () => state.editable, activeSketchId: () => 'S1', constraintTargetsAreActive: () => state.active,
  snapshotModelState: () => { events.push('capture'); return { constraints: [...model.constraints] }; }, restoreModelState: saved => { events.push('restore'); model.constraints = saved.constraints; },
  solveStepNormForConstraint: () => 1, pushModelConstraint: c => { model.constraints.push(c); events.push('push'); }, preconditionNewConstraint: () => events.push('precondition'),
  withTemporarySolveStepNorm: (step, work) => work(), solveConstraintComponentAndDependents: () => { events.push('solve'); return result; },
  isDimensionConstraint: () => state.dimension, isReadOnlyDimension: () => false, stabilizeActiveParameterNamespace: () => { events.push('stabilize'); return result; },
  constraintSketchId: c => c.sketchId, lineCollapseQuery: { find: () => state.collapse }, redundantConstraintInfo: () => state.duplicate, acceptError: 0.001,
  targetFromConstraint: c => { assert.equal(model.constraints.length, 0); events.push('readOnly'); return state.target; },
  measuredConstraintTargetValue: (...args) => { state.measurementArgs=args; return state.measured; },
  startDistanceResolution: (resolution,pointer) => { events.push('place');state.placement={resolution,pointer};return Object.hasOwn(state,"placementReturn") ? state.placementReturn : true; },
  distanceConstraintFromTarget: (...args) => { state.creationArgs=args;return state.constructionRejected?null:constraint; },
  clearSelection: () => events.push('clear'), refreshConstraintAnalysis: () => events.push('analysis'), updateUI: () => events.push('ui'), draw: () => events.push('draw'),
  setHint: (text, kind) => { hints.push([text, kind]); events.push('hint'); }, log: () => events.push('log'), recordHistory: text => { state.history.push(text);events.push('history'); },
  applicationText: text => text, isReferenceSourceSketchId: () => state.source, descendantSketchIds: () => [], wouldCreateReferenceCycle: () => state.cycle,
  sketchName: id => id, now: () => ++time, recordPerformance: trace => { state.trace = trace; events.push('performance'); },
  resolveSelection: type => { events.push('resolve'); state.requestedType=type; return state.resolution; },
  canvasSelection: { set: (field,value) => { assert.equal(field,'arcEndpointPair'); state.arcEndpointPair=value; events.push('selection'); } },
 });
 return { command, model, state, events, hints, result, constraint };
}
test('ordinary authority and cross-Sketch guards reject before capture or mutation', () => {
 const f = fixture(); f.state.editable = false; assert.equal(f.command.ordinary('parallel', f.constraint), false); assert.equal(f.events.length, 0);
 f.state.editable = true; f.state.active = false; assert.equal(f.command.ordinary('parallel', f.constraint), false); assert.deepEqual(f.events, ['hint', 'log']);
});
test('successful ordinary commit preserves constraint identity, solve ordering and performance publication after history', () => {
 const f = fixture(); assert.equal(f.command.ordinary('parallel', f.constraint), true); assert.equal(f.model.constraints[0], f.constraint);
 assert.deepEqual(f.events, ['capture', 'push', 'precondition', 'solve', 'clear', 'analysis', 'ui', 'draw', 'hint', 'log', 'history', 'performance']);
 assert.equal(f.state.trace.type, 'parallel'); assert.equal(f.state.trace.solveVariableCount, 2); assert.equal(f.state.trace.solveIterations, 3);
});
test('ordinary solve rejection restores and reports without history, retaining the existing undefined return', () => {
 const f = fixture(); f.result.success = false; assert.equal(f.command.ordinary('parallel', f.constraint), undefined);
 assert.equal(f.model.constraints.length, 0); assert.deepEqual(f.events.slice(-5), ['restore', 'hint', 'ui', 'draw', 'log']); assert.equal(f.state.trace, null);
});
test('redundant dimension restores before read-only conversion and emits no ordinary history', () => {
 const f = fixture(); f.state.dimension = true; f.state.duplicate = { redundant: true };
 assert.equal(f.command.ordinary('distance', f.constraint), true); assert.deepEqual(f.events, ['capture', 'push', 'precondition', 'solve', 'stabilize', 'restore', 'readOnly', 'push', 'clear', 'analysis', 'ui', 'draw', 'hint', 'log', 'history']);
});
test('reference scope and cycle guards reject before marking or capture', () => {
 const f = fixture(); f.state.source = false; assert.equal(f.command.reference('parallel', f.constraint, 'S0'), false); assert.equal(f.constraint.reference, undefined);
 f.events.length = 0; f.state.source = true; f.state.cycle = true; assert.equal(f.command.reference('parallel', f.constraint, 'S0'), false); assert.deepEqual(f.events, ['hint', 'log']);
});
test('reference commit marks the same object and rejection restores model without ordinary performance', () => {
 const f = fixture(); assert.equal(f.command.reference('parallel', f.constraint, 'S0'), true);
 assert.equal(f.constraint.reference, true); assert.equal(f.constraint.referenceSketchId, 'S0'); assert.equal(f.constraint.name, '参照 test'); assert.equal(f.model.constraints[0], f.constraint); assert.equal(f.state.trace, null);
 const rejected = fixture(); rejected.result.result.errorNorm = 1;
 assert.equal(rejected.command.reference('parallel', rejected.constraint, 'S0'), false); assert.equal(rejected.model.constraints.length, 0);
 assert.equal(rejected.events.includes('history'), false);
});


test('read-only registration measures before push and preserves identity, disable flag and feedback order',()=>{
 const f=fixture();f.state.dimension=true;const dimension={x:4};f.constraint.dimension=dimension;
 assert.equal(f.command.readOnly(f.constraint),true);assert.equal(f.constraint.target,44);assert.equal(f.constraint.readOnlyDimension,true);assert.equal(f.constraint.enabled,false);
 assert.equal(f.model.constraints[0],f.constraint);assert.equal(f.state.measurementArgs[0],f.constraint);assert.equal(f.state.measurementArgs[1],f.state.target);assert.equal(f.state.measurementArgs[2],dimension);
 assert.deepEqual(f.events,['readOnly','push','clear','analysis','ui','draw','hint','log','history']);assert.equal(f.events.includes('solve'),false);
 assert.equal(f.state.history[0],'重複寸法を読み取り専用寸法として追加');
});
test('unsupported read-only registration refuses before mutation and missing target refuses before measuring',()=>{
 const f=fixture();assert.equal(f.command.readOnly(f.constraint),false);assert.deepEqual(f.events,[]);
 f.state.dimension=true;f.state.target=null;assert.equal(f.command.readOnly(f.constraint),false);assert.deepEqual(f.events,['readOnly']);
 assert.equal(f.constraint.readOnlyDimension,undefined);assert.equal(f.model.constraints.length,0);assert.equal(f.state.measurementArgs,undefined);
});
test('intent resolution retains placement pointer rules and rejects invalid intent before commit',()=>{
 const f=fixture(),pointer={x:5};const resolution={type:'distance',target:{},referenceSketchId:'S0'};
 assert.equal(f.command.resolution(resolution,pointer),true);assert.equal(f.state.placement.resolution,resolution);assert.equal(f.state.placement.pointer,null);assert.deepEqual(f.events,['place']);
 resolution.referenceSketchId=null;f.command.resolution(resolution,pointer);assert.equal(f.state.placement.pointer,pointer);
 f.events.length=0;assert.equal(f.command.resolution({error:'invalid'}),false);assert.deepEqual(f.events,['hint']);
 f.events.length=0;f.state.editable=false;assert.equal(f.command.resolution({type:'parallel',constraint:f.constraint}),false);assert.deepEqual(f.events,[]);
});
test('successful ordinary and reference resolutions retain existing commit history followed by intent history',()=>{
 const f=fixture();assert.equal(f.command.resolution({type:'parallel',constraint:f.constraint}),true);
 assert.deepEqual(f.state.history,['拘束追加: parallel','拘束追加: parallel']);assert.equal(f.model.constraints[0],f.constraint);
 const r=fixture();assert.equal(r.command.resolution({type:'parallel',constraint:r.constraint,referenceSketchId:'S0',sketchId:'S1'}),true);
 assert.deepEqual(r.state.history,['参照拘束追加: parallel','拘束追加: parallel']);assert.equal(r.constraint.referenceSketchId,'S0');
 const failed=fixture();failed.result.success=false;assert.equal(failed.command.resolution({type:'parallel',constraint:failed.constraint}),undefined);assert.deepEqual(failed.state.history,[]);
});
test('dimension commit preserves constructor arguments, expression fallback and reference expression omission',()=>{
 const f=fixture(),target={},dimension={};assert.equal(f.command.dimension(target,5,dimension,{expression:'= 2 + 3'}),true);
 assert.deepEqual(f.state.creationArgs,[target,5,dimension]);assert.equal(f.constraint.expression,'= 2 + 3');assert.equal(f.state.history[0],'拘束追加: dimension');
 const fallback=fixture();fallback.command.dimension(target,5,dimension,{expression:''});assert.equal(fallback.constraint.expression,'5');
 const ref=fixture();assert.equal(ref.command.dimension(target,5,dimension,{referenceSketchId:'S0'}),true);assert.equal(ref.constraint.expression,undefined);assert.equal(ref.constraint.referenceSketchId,'S0');
 const rejected=fixture();rejected.state.constructionRejected=true;assert.equal(rejected.command.dimension(target,5,dimension),false);assert.deepEqual(rejected.events,[]);
});


test('selection application short-circuits empty and error resolutions before selection, guards or effects',()=>{
 const f=fixture();assert.deepEqual(f.events,[]);assert.equal(f.command.fromSelection('parallel'),undefined);
 assert.deepEqual(f.events,['resolve']);assert.equal(f.state.requestedType,'parallel');
 f.events.length=0;f.state.resolution={error:'invalid target',target:{},constraint:f.constraint};
 assert.equal(f.command.fromSelection('equal'),undefined);assert.deepEqual(f.events,['resolve','hint']);assert.deepEqual(f.hints,[['invalid target','error']]);
 f.events.length=0;f.state.resolution={};f.command.fromSelection('parallel');assert.deepEqual(f.events,['resolve']);
});

test('selection application routes dimension action or target before ordinary commit and preserves resolution and raw return',()=>{
 for(const resolution of [{action:'place-dimension',constraint:{}},{target:{},constraint:{}}]){
  const f=fixture();f.state.editable=false;f.state.resolution=resolution;f.state.placementReturn={placed:true};
  assert.equal(f.command.fromSelection('distance'),f.state.placementReturn);assert.equal(f.state.placement.resolution,resolution);assert.equal(f.state.placement.pointer,null);
  assert.deepEqual(f.events,['resolve','place']);assert.equal(f.model.constraints.length,0);assert.deepEqual(f.state.history,[]);
 }
});

test('ordinary selection application clears arc pair before commit while retaining guard result semantics and undefined return',()=>{
 const f=fixture();f.state.arcEndpointPair={endpoint:'start'};f.state.resolution={type:'parallel',constraint:f.constraint,sketchId:'S1'};
 assert.equal(f.command.fromSelection('parallel'),undefined);assert.equal(f.state.arcEndpointPair,null);assert.equal(f.model.constraints[0],f.constraint);
 assert.deepEqual(f.events.slice(0,2),['resolve','selection']);assert.equal(f.state.history.at(-1),'拘束追加: parallel');
 const denied=fixture();denied.state.editable=false;denied.state.resolution={constraint:denied.constraint};
 assert.equal(denied.command.fromSelection('parallel'),undefined);assert.equal(denied.state.arcEndpointPair,null);assert.deepEqual(denied.events,['resolve','selection']);assert.equal(denied.model.constraints.length,0);
});
