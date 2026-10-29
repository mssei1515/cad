const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: { GeometrySolver: { vectorNorm: values => Math.hypot(...values) } } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/solver/sketch_solving.js', 'utf8'), sandbox);
function fixture(sharedState) {
  const events = [], state = { scope: { constraints: [] }, active: 'A', order: ['A', 'B', 'C', 'D'], bundles: [],
    results: [], residual: 0, variables: [{ prop: 'x' }, { prop: 'y' }], local: { local: true } };
  const scopeQuery = {
    sketchSolveVariables: () => state.variables,
    sketchSolveConstraints: id => [{ sketchId: id }], sketchSolveLines: id => [{ sketchId: id }],
    localSolveContextFromSeeds: (nodes, id) => { events.push(['local', nodes, id]); return state.local; },
  };
  const solver = {
    solveSubset: options => { events.push(['solve', options]); return state.results.shift() || { success: true, errorNorm: 0 }; },
    computeErrorVectorForConstraints: constraints => { events.push(['residual', constraints]); return [state.residual]; },
  };
  const service = sandbox.window.SketchSolving.create({ currentScope: () => state.scope, solver, scopeQuery,
    activeSketchId: () => state.active, elementSketchId: item => item.sketchId, constraintSketchId: item => item.sketchId,
    constraintGraphNodes: item => item.nodes, constraintIsOperational: item => item.enabled !== false,
    geometryInstanceBundles: () => state.bundles, orderedSketches: () => state.order.map(id => ({ id })),
    synchronizeSketchProjectionMetadata: id => events.push(['sync', id]),
    refreshReferenceConstraintValidity: () => events.push(['validity']), normalizeArcSweeps: () => events.push(['normalize']),
    resultIsAccepted: result => Number.isFinite(result?.errorNorm) && result.errorNorm <= 0.01,
    restoreModelState: snapshot => events.push(['restore', snapshot]),
    profileDependencies: work => { events.push(['profile']); return work(); }, acceptError: 0.01, state: sharedState });
  const edge = (source, destination, enabled = true) => ({ reference: true, referenceSketchId: source, sketchId: destination, enabled });
  return { service, state, events, edge };
}
test('single Sketch solve synchronizes projection first and preserves variable filtering and extra constraints', () => {
  const f = fixture(), extra = [{}];
  f.service.solveSketchById('B', extra, v => v.prop === 'x');
  assert.deepEqual(f.events[0], ['sync', 'B']);
  const options = f.events[1][1];
  assert.equal(options.variables.length, 1); assert.equal(options.variables[0], f.state.variables[0]);
  assert.equal(options.extra, extra); assert.equal(options.constraints[0].sketchId, 'B');
  f.state.active = 'D'; f.events.length = 0; f.service.solveActiveSketch(extra);
  assert.deepEqual(f.events[0], ['sync', 'D']);
  assert.equal(f.events[1][1].variables, f.state.variables);
  assert.equal(f.service.sketchSolveState('D'), null);
});
test('dependency solving combines references and valid projections in stable topological order', () => {
  const f = fixture(); f.state.order = ['A', 'C', 'B', 'D'];
  f.state.scope.constraints = [f.edge('A', 'B'), f.edge('A', 'C'), f.edge('B', 'D'), f.edge('A', 'ignored', false)];
  const source = { sketchId: 'C' };
  f.state.bundles = [{ valid: true, instance: { sketchId: 'D' }, points: [{ sourceElement: source }, { sourceElement: source }], lines: [], circles: [], arcs: [], splines: [] }, { valid: false }];
  const result = f.service.solveReferenceDependentSketches('A');
  assert.deepEqual(Array.from(result.results, entry => entry.sketchId), ['C', 'B', 'D']);
  assert.equal(result.success, true); assert.equal(f.service.sketchSolveState('A'), null);
  assert.equal(f.service.sketchSolveState('D').sourceSketchId, 'A');
  assert.deepEqual(f.events.slice(0, 2), [['profile'], ['validity']]);
  assert.equal(f.events.filter(e => e[0] === 'normalize').length, 3);
});
test('cycles are recorded as failures without solving blocked descendants or unrelated Sketches', () => {
  const f = fixture();
  f.state.scope.constraints = [f.edge('A', 'B'), f.edge('B', 'C'), f.edge('C', 'B'), f.edge('C', 'D'), f.edge('X', 'Y')];
  const result = f.service.solveReferenceDependentSketches('A');
  assert.equal(result.success, false); assert.equal(result.sketchId, 'B');
  assert.equal(f.events.some(e => e[0] === 'solve'), false);
  for (const id of ['B', 'C', 'D']) {
    const status = f.service.sketchSolveState(id);
    assert.equal(status.reason, '循環参照'); assert.equal(status.errorNorm, Infinity);
  }
  assert.equal(f.service.sketchSolveState('Y'), null);
});
test('source success and dependent failure remain separate and do not trigger source rollback', () => {
  const f = fixture(), snapshot = {}, fail = { success: false, errorNorm: 10 };
  f.state.scope.constraints = [f.edge('A', 'B'), f.edge('B', 'C')];
  f.state.results = [{ success: false, errorNorm: 0 }, fail, { success: true, errorNorm: 0 }];
  const result = f.service.solveSketchAndDependents('A', snapshot);
  assert.equal(result.success, true); assert.equal(result.dependent.success, false);
  assert.equal(result.dependent.result, fail); assert.equal(f.service.sketchSolveState('C').status, 'ok');
  assert.equal(f.events.some(e => e[0] === 'restore'), false);
});
test('source failure restores only when supplied a checkpoint and clears its prior state', () => {
  for (const snapshot of [null, {}]) {
    const f = fixture(), fail = { errorNorm: NaN };
    f.service.setSketchSolveOk('A', {}); f.state.results = [fail];
    const result = f.service.solveSketchAndDependents('A', snapshot);
    assert.equal(result.success, false); assert.equal(result.dependent.results.length, 0);
    assert.equal(f.events.some(e => e[0] === 'profile'), false);
    if (snapshot) {
      assert.equal(f.service.sketchSolveState('A'), null);
      assert.equal(f.events.at(-1)[1], snapshot);
    } else {
      assert.equal(f.service.sketchSolveState('A').errorNorm, Infinity);
      assert.equal(f.service.sketchSolveState('A').reason, 'solve failed');
    }
  }
});
test('component solve checks whole Sketch residual and restores failed full fallback', () => {
  for (const fullFailure of [false, true]) {
    const f = fixture(), snapshot = {}, constraint = { sketchId: 'A', nodes: [{}] };
    f.state.residual = 0.2;
    const fullResult = { errorNorm: fullFailure ? 5 : 0 };
    f.state.results = [{ errorNorm: 0 }, fullResult];
    const result = f.service.solveConstraintComponentAndDependents(constraint, snapshot);
    assert.equal(result.fullFallback, true); assert.equal(result.local, false);
    assert.equal(result.result, fullResult); assert.equal(fullResult.localErrorNorm, 0.2);
    assert.equal(result.success, !fullFailure);
    const solves = f.events.filter(e => e[0] === 'solve');
    assert.equal(solves.length, 2); assert.equal(solves[0][1], f.state.local);
    assert.equal(f.events.some(e => e[0] === 'restore'), fullFailure);
  }
  const f = fixture(); f.state.residual = 0.2; f.state.results = [{ errorNorm: 5 }];
  const result = f.service.solveConstraintComponentAndDependents({ sketchId: 'A', nodes: [] });
  assert.equal(result.local, true); assert.equal(result.fullFallback, false);
  assert.equal(f.events.filter(e => e[0] === 'solve').length, 1);
});
test('result state belongs to the service and clear APIs support deletion and model reset', () => {
  const a = fixture(), b = fixture();
  a.service.setSketchSolveError('A', { errorNorm: 5, reason: 'bad' }, 'B');
  a.service.setSketchSolveOk('B', {});
  assert.equal(b.service.sketchSolveState('A'), null);
  assert.equal(a.service.sketchSolveState('A').sourceSketchId, 'B');
  a.service.clearSketchSolveState('A'); assert.equal(a.service.sketchSolveState('A'), null);
  a.service.clearAll(); assert.equal(a.service.sketchSolveState('B'), null);
  a.state.scope = { constraints: [a.edge('A', 'D')] };
  assert.deepEqual(Array.from(a.service.solveReferenceDependentSketches('A').results, r => r.sketchId), ['D']);
});

test('result acceptance retains finite inclusive tolerance, ignores success, and preserves getter reads and failures',()=>{
 const accepts=sandbox.window.SketchSolving.createResultAcceptance(1e-4);
 for(const value of [null,undefined,false,0,'',{},...['0',NaN,Infinity,-Infinity].map(errorNorm=>({errorNorm}))])assert.equal(accepts(value),false);
 for(const errorNorm of [0,-1,1e-4])assert.equal(accepts({success:false,errorNorm}),true);
 assert.equal(accepts({success:true,errorNorm:1e-4+Number.EPSILON}),false);
 assert.equal(accepts({get success(){throw Error('success is not the acceptance policy');},errorNorm:0}),true);
 let reads=0;assert.equal(accepts({get errorNorm(){return ++reads===1?0:1;}}),false);assert.equal(reads,2);
 reads=0;assert.equal(accepts({get errorNorm(){reads++;return NaN;}}),false);assert.equal(reads,1);
 const marker=new Error('error read failed');for(const failureRead of [1,2]){reads=0;assert.throws(()=>accepts({get errorNorm(){if(++reads===failureRead)throw marker;return 0;}}),error=>error===marker);assert.equal(reads,failureRead);}
 assert.equal(sandbox.window.SketchSolving.createResultAcceptance(2)({errorNorm:1}),true);
});

test('result state retains original records and result identity while deletion and clear isolate owners',()=>{
 const a=sandbox.window.SketchSolving.createState(),b=sandbox.window.SketchSolving.createState(),result={errorNorm:0.2,reason:'bad'},key={id:'A'};
 assert(Object.isFrozen(a));assert.equal(a.sketchSolveState(key),null);assert.equal(a.hasError(key),false);
 a.setSketchSolveError(key,result,'source');const record=a.sketchSolveState(key);
 assert.equal(record.status,'error');assert.equal(record.sourceSketchId,'source');assert.equal(record.result,result);assert.equal(record.errorNorm,0.2);assert.equal(record.reason,'bad');assert.equal(a.hasError(key),true);
 result.errorNorm=3;assert.equal(a.sketchSolveState(key),record);assert.equal(record.errorNorm,0.2);assert.equal(record.result.errorNorm,3);
 assert.equal(a.sketchSolveState({id:'A'}),null);assert.equal(b.hasError(key),false);
 a.setSketchSolveOk(key,result);assert.equal(a.hasError(key),false);assert.equal(a.sketchSolveState(key).sourceSketchId,key);assert.equal(a.sketchSolveState(key).result,result);
 a.setSketchSolveError('B',{});assert.equal(a.sketchSolveState('B').errorNorm,Infinity);assert.equal(a.sketchSolveState('B').reason,'solve failed');
 assert.equal(a.clearSketchSolveState(key),undefined);assert.equal(a.sketchSolveState(key),null);assert.equal(a.hasError('B'),true);
 assert.equal(a.clearAll(),undefined);assert.equal(a.hasError('B'),false);assert.equal(b.sketchSolveState('B'),null);
});

test('injected result state is shared through solve, failure rollback and reset without changing default isolation',()=>{
 const shared=sandbox.window.SketchSolving.createState(),f=fixture(shared),other=fixture();
 const result={errorNorm:0};f.state.results=[result];f.service.solveSketchAndDependents('A');assert.equal(shared.sketchSolveState('A').result,result);assert.equal(other.service.sketchSolveState('A'),null);
 const failed={errorNorm:1,reason:'failure'};f.state.results=[failed];assert.equal(f.service.solveSketchAndDependents('A').success,false);assert.equal(shared.hasError('A'),true);assert.equal(shared.sketchSolveState('A').result,failed);
 f.state.results=[failed];const checkpoint={point:'original'};f.service.solveSketchAndDependents('A',checkpoint);assert.equal(shared.sketchSolveState('A'),null);assert(f.events.some(e=>e[0]==='restore'&&e[1]===checkpoint));
 shared.setSketchSolveError('B',failed);assert.equal(f.service.sketchSolveState('B'),shared.sketchSolveState('B'));f.service.clearAll();assert.equal(shared.hasError('B'),false);
});
