const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/constraint_test_driver.js'), 'utf8'), sandbox);

test('analysis observation uses current scope and preserves error ranking, indices and top twelve', () => {
  const constraints = Array.from({ length: 16 }, (_, index) => ({ name: 'c' + index, error: () => index === 4 ? [4, 0] : index }));
  const variables = [{}], lines = [{}], calls = [];
  let scope = { points: [{ sketchId: 'S1' }, { sketchId: 'S2' }], lines: [], circles: [], arcs: [], splines: [] };
  const observation = sandbox.window.ConstraintTestDriver.createAnalysisObservation({
    activeSketchId: () => 'S1', currentScope: () => scope, elementSketchId: value => value.sketchId,
    sketchSolveVariables: id => { calls.push(['variables', id]); return variables; },
    sketchSolveConstraints: id => { calls.push(['constraints', id]); return constraints; },
    sketchSolveLines: id => { calls.push(['lines', id]); return lines; }, acceptError: 0.01,
    analyzeConstraintState: options => { assert.equal(options.variables, variables); assert.equal(options.constraints, constraints); assert.equal(options.lines, lines); assert.equal(options.errorTolerance, 0.01); return { stable: true, rank: 2 }; },
    vectorNorm: values => Math.hypot(...values),
  });
  const result = observation.analysis();
  assert.equal(result.pointCount, 1); assert.equal(result.constraintCount, 16); assert.equal(result.rank, 2);
  assert.deepEqual(Array.from(result.largestConstraintErrors, value => value.index), [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4]);
  assert.deepEqual(calls, [['variables', 'S1'], ['constraints', 'S1'], ['lines', 'S1']]);
  scope = { ...scope, points: [] }; assert.equal(observation.analysis().pointCount, 0);
});

test('block observation refreshes first, filters bundles and preserves identity lookup and summary copy', () => {
  const point = { id: 'P1' }, spline = { id: 'SP1' }, summary = { nested: {} }, calls = [];
  const observation = sandbox.window.ConstraintTestDriver.createBlockObservation({
    refreshConstraintAnalysis: () => { calls.push('refresh'); return { analysis: { stable: true }, summary, statuses: new Map([[point, 'fixed'], [spline, 'free']]) }; },
    blockProjectionBundles: () => { calls.push('bundles'); return [
      { instance: { id: 'BI1' }, points: [point], lines: [], circles: [], arcs: [] },
      { instance: { id: 'BI2' }, points: [], lines: [], circles: [], arcs: [], splines: [spline] },
    ]; },
  });
  const result = observation.state('BI2');
  assert.deepEqual(calls, ['refresh', 'bundles']);
  assert.deepEqual(Array.from(result.projections, value => ({ ...value })), [{ id: 'SP1', status: 'free' }]);
  assert.notEqual(result.summary, summary); assert.equal(result.summary.nested, summary.nested);
  assert.equal(observation.state().projections.length, 2);
});

test('block constraint insertion resolves original projections and observes even a refused commit in order', () => {
  const point = { localElement: { id: 'P1' } }, line = { localElement: { id: 'L1' } }, calls = [];
  class PointOnLineConstraint { constructor(p, l) { assert.equal(p, point); assert.equal(l, line); } }
  const insertion = sandbox.window.ConstraintTestDriver.createBlockConstraintInsertion({
    blockInstanceById: id => id === 'missing' ? null : { id },
    blockProjectionBundle: () => ({ points: [point], lines: [line] }), PointOnLineConstraint,
    commitNewConstraint: (type, constraint) => { assert.equal(type, 'coincident'); assert.ok(constraint instanceof PointOnLineConstraint); calls.push('commit'); return 1; },
    readAnalysis: () => { calls.push('analysis'); return {}; },
    readBlockState: id => { calls.push(['status', id]); return {}; },
    serializeModel: () => { calls.push('serialize'); return {}; },
  });
  assert.equal(insertion.add('missing', 'P1', 'BI2', 'L1').reason, 'projection-not-found'); assert.deepEqual(calls, []);
  assert.equal(insertion.add('BI1', 'P1', 'BI2', 'L1').committed, false);
  assert.deepEqual(calls, ['commit', 'analysis', ['status', 'BI1'], 'serialize']);
});
class DistanceConstraint { constructor(p1, p2, value) { Object.assign(this, { p1, p2, value }); } }
function fixture() {
  const original = () => 'original', solver = { solveSubset: original }, calls = [], hint = { textContent: 'result', classList: { contains: value => value === 'error' } };
  const state = { scope: { constraints: [] }, commitResult: true, failure: null, result: null };
  const driver = sandbox.window.ConstraintTestDriver.createForcedCommit({
    resetModelState: () => { calls.push('reset'); state.scope = { constraints: [] }; },
    addPoint: (...args) => { calls.push(args); return { args }; }, DistanceConstraint, solver,
    commitNewConstraint: (type, constraint) => {
      calls.push(['commit', type, constraint]); state.result = solver.solveSubset();
      if (state.failure) throw state.failure;
      state.scope = { constraints: [constraint] }; return state.commitResult;
    }, currentScope: () => state.scope,
    document: { getElementById: id => { assert.equal(solver.solveSubset, original); calls.push(['dom', id]); return hint; } },
  });
  return { driver, original, solver, calls, state, hint };
}
test('forced commit preserves fixture arguments, result coercion, restores Solver before observations and reads replaced scope', () => {
  const f = fixture(); const forced = { success: 1, errorNorm: '0.25', iterations: '3', reason: 'forced' };
  const result = f.driver.commit(forced);
  assert.deepEqual(f.calls.slice(0, 3), ['reset', [0, 0, true, 'endpoint'], [10, 0, false, 'endpoint']]);
  assert.equal(f.calls[3][1], 'distance'); assert.equal(f.calls[3][2].value, 10);
  assert.deepEqual({ ...f.state.result }, { success: true, errorNorm: 0.25, iterations: 3, reason: 'forced', variableCount: 2, constraintCount: 1 });
  assert.deepEqual({ ...result }, { committed: true, constraintCount: 1, hint: 'result', hintIsError: true });
  assert.equal(f.solver.solveSubset, f.original); assert.deepEqual(forced, { success: 1, errorNorm: '0.25', iterations: '3', reason: 'forced' });
});
test('forced commit restores Solver on a thrown commit without swallowing the original error or observing DOM', () => {
  const f = fixture(); f.state.failure = new Error('commit failed');
  assert.throws(() => f.driver.commit({ success: false }), error => error === f.state.failure);
  assert.equal(f.solver.solveSubset, f.original); assert.equal(f.calls.some(call => Array.isArray(call) && call[0] === 'dom'), false);
});
test('missing forced fields keep existing coercion and only literal true means committed', () => {
  const f = fixture(); f.state.commitResult = 'accepted'; assert.equal(f.driver.commit().committed, false);
  assert.equal(f.state.result.success, false); assert.ok(Number.isNaN(f.state.result.errorNorm));
  assert.equal(f.state.result.iterations, 0); assert.equal(f.state.result.reason, 'test'); assert.equal(f.solver.solveSubset, f.original);
});

test('intent fixture resolves call-time geometry references and rejects missing input before calling the resolver', () => {
  const oldPoint = { id: 'P1' }, livePoint = { id: 'P1' }, arc = { id: 'A1' }, constraint = {}, normalized = [];
  let scope = { points: [oldPoint] }, calls = 0, resolution = null, serialized = 0;
  const driver = sandbox.window.ConstraintTestDriver.createIntentResolution({ currentScope: () => scope,
    makeConstraintOperand: (kind, input) => { normalized.push({ kind, input }); return { kind, input }; },
    resolveConstraintIntent: (type, operands) => { assert.equal(type, 'coincidence'); calls += 1; assert.equal(operands[0].input.point, livePoint); return resolution; },
    serializeConstraint: value => { assert.equal(value, constraint); serialized += 1; return { type: 'serialized' }; },
  });
  scope = { points: [livePoint], lines: [], splines: [], circles: [], arcs: [arc] };
  const inputs = [{ kind: 'point', id: 'P1' }, { kind: 'arc-endpoint', id: 'A1', endpoint: 'start', parameter: 0.25 }];
  assert.equal(driver.resolve('coincidence', inputs), null);
  assert.equal(serialized, 0);
  assert.equal(normalized[1].input.arc, arc);
  assert.equal(normalized[1].input.endpoint, 'start');
  assert.equal(normalized[1].input.parameter, 0.25);
  assert.throws(() => driver.resolve('coincidence', [{ kind: 'point', id: 'missing' }]), /Missing test operand: missing/);
  assert.equal(calls, 1);
  resolution = { constraint, target: { kind: 'arc-endpoint' } };
  assert.deepEqual(JSON.parse(JSON.stringify(driver.resolve('coincidence', inputs))), { action: null, error: null, constraint: { type: 'serialized' }, targetKind: 'arc-endpoint' });
  assert.equal(serialized, 1);
  assert.deepEqual(inputs, [{ kind: 'point', id: 'P1' }, { kind: 'arc-endpoint', id: 'A1', endpoint: 'start', parameter: 0.25 }]);
});


test('status observation captures the current sketch after refresh and observes replacement state on each query', () => {
  const first = { id: 'P1', sketchId: 'S1' }, second = { id: 'P2', sketchId: 'S2' };
  let active = 'S1', reads = 0, refreshed = 0;
  let analysis = { stable: true, errorNorm: 0, freeVariableCount: 2 };
  let statuses = new Map([[first, 'full'], [second, 'under']]);
  const observation = sandbox.window.ConstraintTestDriver.createStatusObservation({
    refreshConstraintAnalysis: () => { refreshed++; active = refreshed === 1 ? 'S2' : 'S1'; return { analysis, statuses }; },
    readMembership: () => { reads++; return { activeSketchId: active, elementSketchId: item => item.sketchId }; },
  });
  assert.equal(reads, 0);
  const result = observation.state();
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { stable: true, errorNorm: 0, freeDof: 2, items: [{ id: 'P2', status: 'under' }] });
  assert.equal(reads, 1); assert.equal(statuses.size, 2);
  result.items[0].status = 'changed'; assert.equal(statuses.get(second), 'under');
  analysis = { stable: false, errorNorm: 0.5, freeVariableCount: 0 };
  statuses = new Map([[first, 'conflict']]);
  const next = observation.state();
  assert.deepEqual(JSON.parse(JSON.stringify(next)), { stable: false, errorNorm: 0.5, freeDof: 0, items: [{ id: 'P1', status: 'conflict' }] });
  assert.equal(reads, 2); assert.equal(refreshed, 2);
});

test('model support shares live analysis and block status after real insertion or refusal and propagates commit errors', () => {
  const calls=[],state={ready:false,accept:false,failure:null};
  const read=name=>{assert.equal(state.ready,true);calls.push(name);};
  const point={id:'P1',localElement:{id:'localP'},sketchId:'S1'},line={id:'L1',localElement:{id:'localL'},sketchId:'S1'},instance={id:'BI1'};
  state.scope={points:[point],lines:[line],circles:[],arcs:[],splines:[],constraints:[]};
  state.bundle={instance,points:[point],lines:[line],circles:[],arcs:[]};state.statuses=new Map([[point,'fixed'],[line,'free']]);
  class PointOnLineConstraint { constructor(p,l){assert.equal(p,state.bundle.points[0]);assert.equal(l,state.bundle.lines[0]);this.name='point-line';} error(){return 0;} }
  const support=sandbox.window.ConstraintTestDriver.createModelSupport({
    refreshConstraintAnalysis:()=>{read('refresh');return{analysis:{stable:true,errorNorm:0,freeVariableCount:1},summary:{count:state.scope.constraints.length},statuses:state.statuses};},
    readMembership:()=>{read('membership');return{activeSketchId:'S1',elementSketchId:item=>item.sketchId};},
    activeSketchId:()=>{read('active');return'S1';},sketchSolveVariables:()=>{read('variables');return[];},
    sketchSolveConstraints:()=>{read('constraints');return state.scope.constraints;},sketchSolveLines:()=>{read('lines');return state.scope.lines;},
    analyzeConstraintState:()=>{read('analysis');return{stable:true};},acceptError:0.01,vectorNorm:values=>Math.hypot(...values),
    currentScope:()=>{read('scope');return state.scope;},elementSketchId:item=>item.sketchId,
    blockProjectionBundles:()=>{read('bundles');return[state.bundle];},blockInstanceById:id=>id==='BI1'?instance:null,
    blockProjectionBundle:value=>{assert.equal(value,instance);return state.bundle;},PointOnLineConstraint,
    commitNewConstraint:(type,constraint)=>{read('commit');assert.equal(type,'coincident');if(state.failure)throw state.failure;if(state.accept)state.scope.constraints.push(constraint);return state.accept;},
    serializeModel:()=>{read('serialize');return{count:state.scope.constraints.length};},
  });
  assert.deepEqual(calls,[]);assert.equal(support.readStatuses,support.publicAPI.constraintStatusesForTest);state.ready=true;
  const api=support.publicAPI;
  let result=api.addBlockPointOnLineConstraintForTest('BI1','localP','BI1','localL');
  assert.equal(result.committed,false);assert.equal(result.analysis.constraintCount,0);assert.equal(result.status.summary.count,0);assert.equal(result.serialized.count,0);
  assert.equal(calls[0],'commit');assert.ok(calls.indexOf('analysis')<calls.indexOf('refresh'));assert.equal(calls.at(-1),'serialize');
  state.accept=true;result=api.addBlockPointOnLineConstraintForTest('BI1','localP','BI1','localL');
  assert.equal(result.committed,true);assert.equal(result.analysis.constraintCount,1);assert.equal(result.status.summary.count,1);assert.equal(result.serialized.count,1);
  const replacement={...point};state.scope={...state.scope,points:[replacement],constraints:[]};state.bundle={...state.bundle,points:[replacement]};state.statuses=new Map([[replacement,'replacement']]);
  calls.length=0;assert.equal(support.readStatuses().items[0].status,'replacement');assert.deepEqual(calls,['refresh','membership']);
  assert.equal(api.constraintAnalysisForTest().constraintCount,0);assert.equal(api.blockConstraintStatusForTest('BI1').projections[0].status,'replacement');
  const marker=new Error('commit');state.failure=marker;calls.length=0;
  assert.throws(()=>api.addBlockPointOnLineConstraintForTest('BI1','localP','BI1','localL'),error=>error===marker);assert.deepEqual(calls,['commit']);assert.equal(state.scope.constraints.length,0);
});

function browserFixture(composed=true) {
 const events=[],state={ready:false,model:null,statuses:new Map(),summary:{count:0,nested:{}},variables:[{id:'variable'}],selected:{current:true},failure:null,accepted:true,sequence:0,afterRefresh:null},marker=new Error('browser constraint boundary');
 const ready=()=>assert.equal(state.ready,true,'binding and creator calls must not query model, analysis, solver, Selection, DOM or history');
 const event=name=>{ready();events.push(name);if(state.failure===name)throw marker;};
 class Point {constructor(id,x,y,fixed,kind){Object.assign(this,{id,x,y,fixed,kind});}}
 class Line {constructor(id,p1,p2){Object.assign(this,{id,p1,p2});}length(){return Math.hypot(this.p2.x-this.p1.x,this.p2.y-this.p1.y);}}
 class Circle {} class Arc {constructor(id,center,radius,a0,a1){Object.assign(this,{id,center,radius,a0,a1});}} class Spline {}
 class PointOnLineConstraint {constructor(point,line){Object.assign(this,{point,line,name:'on-line'});}error(){return[0];}}
 class CoincidentConstraint {constructor(p1,p2){Object.assign(this,{p1,p2,name:'coincident'});}error(){return[0,0];}}
 class DistanceConstraint {constructor(p1,p2,value){Object.assign(this,{p1,p2,value,name:'distance'});}error(){return[0];}}
 class HorizontalConstraint {constructor(line){Object.assign(this,{line,name:'horizontal'});}error(){return[0];}}
 class RadiusConstraint {constructor(arc,value){Object.assign(this,{arc,value,name:'radius'});}error(){return[0];}}
 const w={GeometrySolver:{Point,Line,Circle,Arc,Spline,PointOnLineConstraint,CoincidentConstraint,DistanceConstraint,HorizontalConstraint,RadiusConstraint,vectorNorm:values=>Math.hypot(...values)},
  SketchHierarchy:{ROOT_SKETCH_ID:'ROOT',DEFAULT_SKETCH_ID:'S1'},GeometryKernel:{signedPointLineDistance:(point,line)=>point.y-line.p1.y}};
 const context={window:w};vm.createContext(context);for(const file of ['src/editing/selection.js','src/editing/constraint_target_session.js','src/testing/constraint_test_driver.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
 const model=()=>({points:[],lines:[],circles:[],arcs:[],splines:[],constraints:[],blockInstances:[],sketches:[{id:'S1'}],activeSketchId:'S1'});state.model=model();const original=state.model;
 const selection=w.CanvasSelection.create(),targets=w.ConstraintTargetSession.create({acceptTarget:()=>assert.fail('no new operand targets')}),currentScope=()=>{ready();return state.model;},activeSketchId=()=>{ready();return state.model.activeSketchId;},elementSketchId=item=>item.sketchId;
 const analysis={refresh(options){assert.equal(this,analysis);event('refresh');state.refreshOptions=options;(state.optionReads||=[]).push(options);if(state.afterRefresh)state.model.activeSketchId=state.afterRefresh;return{analysis:{stable:true,errorNorm:0,freeVariableCount:2},summary:state.summary,statuses:state.statuses};},
  summary(){assert.equal(this,analysis);event('summary');return state.summary;},statusOf:function(item){'use strict';assert.equal(this,undefined);ready();return state.statuses.get(item)||'free';}};
 const originalSolve=function(){assert.equal(this,solver);event('originalSolve');return{success:true};};
 const solver={solveSubset:originalSolve,analyzeConstraintState(options){assert.equal(this,solver);event('analyze');assert.equal(options.variables,state.variables);assert.equal(options.constraints,state.lastConstraints);state.analysisOptions=options;return{stable:true,errorNorm:0,rank:1,variableCount:1,freeVariableCount:0};}};
 function addPoint(x,y,fixed,kind){'use strict';assert.equal(this,undefined);event('point');const p=new Point('P'+(++state.sequence),x,y,fixed,kind);p.sketchId=state.model.activeSketchId;state.model.points.push(p);return p;}
 function addLine(a,b){'use strict';assert.equal(this,undefined);event('line');const l=new Line('L'+(++state.sequence),a,b);l.sketchId=state.model.activeSketchId;state.model.lines.push(l);return l;}
 function addArc(center,radius,a0,a1){'use strict';assert.equal(this,undefined);event('arc');const a=new Arc('A'+(++state.sequence),center,radius,a0,a1);a.sketchId=state.model.activeSketchId;state.model.arcs.push(a);return a;}
 const readMembership=()=>{event('membership');return{activeSketchId:activeSketchId(),elementSketchId};};
 const p={refreshConstraintAnalysis:(options={})=>analysis.refresh(options),readMembership,activeSketchId,elementSketchId,sketchById:id=>{ready();return state.model.sketches.find(s=>s.id===id);},constraintSketchId:c=>c.sketchId,
  sketchSolveVariables:id=>{event('variables:'+id);return state.variables;},sketchSolveConstraints:id=>{event('constraints:'+id);return state.lastConstraints=state.model.constraints.filter(c=>c.sketchId===id);},sketchSolveLines:id=>{event('lines:'+id);return state.model.lines.filter(l=>l.sketchId===id);},
  analyzeConstraintState:options=>solver.analyzeConstraintState(options),acceptError:0.001,vectorNorm:w.GeometrySolver.vectorNorm,currentScope,
  blockProjectionBundles:()=>{event('bundles');return state.bundle?[state.bundle]:[];},blockInstanceById:id=>{ready();return state.model.blockInstances.find(b=>b.id===id);},blockProjectionBundle:b=>{ready();return b.bundle;},
  commitNewConstraint:(type,c)=>{event('commit');state.forced=solver.solveSubset();if(state.accepted){c.sketchId=activeSketchId();state.model.constraints.push(c);}return state.accepted;},
  PointOnLineConstraint,CoincidentConstraint,DistanceConstraint,HorizontalConstraint,RadiusConstraint,serializeModel:()=>{event('serializeModel');return state.model;},
  solveReferenceDependentSketches:function(id){'use strict';assert.equal(this,undefined);event('dependents:'+id);return{success:true,results:[{sketchId:'S1'},{sketchId:'S5'}]};},
  updateUI:()=>event('ui'),draw:()=>event('draw'),defaultSketchId:'S1',rootSketchId:'ROOT',isExplicitPoint:item=>{ready();return item.kind==='explicit';},
  resetModelState:()=>{event('reset');state.model=model();state.sequence=0;},addPoint,addLine,addArc,
  markReferenceConstraint:(c,source,target)=>{event('reference:'+source+':'+target);Object.assign(c,{reference:true,referenceSketchId:source,sketchId:target});return c;},refreshReferenceConstraintValidity:()=>event('validity'),
  dimensionFromAnchor:()=>{event('dimension');return{anchor:'value'};},pushModelConstraint:c=>{event('push');c.sketchId=activeSketchId();state.model.constraints.push(c);return c;},
  canvasSelection:selection,constraintTargetSession:targets,fitAllGeometryToViewport:()=>event('fit'),canvas:{getBoundingClientRect(){assert.equal(this,p.canvas);event('bounds');return{left:10,top:20,width:500,height:400};}},
  solveSketchAndDependents:function(id,snapshot){'use strict';assert.equal(this,undefined);event('solve:'+id);assert.equal(snapshot,state.snapshot);return{success:true};},
  snapshotModelState:()=>{event('snapshot');return state.snapshot;},constraintStatusOf:analysis.statusOf,constraintStatusColor:item=>{ready();return 'color:'+(state.statuses.get(item)||'free');},readSummary:()=>analysis.summary(),worldToCanvasScreen:point=>{event('screen');return point;},
  wouldCreateReferenceCycle:(a,b)=>{event('cycle:'+a+':'+b);return false;},signedPointLineDistance:w.GeometryKernel.signedPointLineDistance,
  readSelectedGeometry:()=>{ready();return state.selected;},operandElement:o=>o.point||o.line||o.arc||o.circle,
  makeConstraintOperand:function(kind,value){'use strict';assert.equal(this,undefined);event('operand');return{kind,...value};},
  resolveConstraintIntent:(type,operands)=>{event('intent:'+type);state.resolvedOperands=operands;return state.resolution||{action:'commit',constraint:operands[0].point,target:{kind:'point'}};},
  serializeConstraint:function(c){'use strict';assert.equal(arguments.length,1);event('serializeConstraint');return{id:c.id};},
  solver,document:{getElementById(id){assert.equal(this,p.document);assert.equal(solver.solveSubset,state.expectedSolve||originalSolve,'restore solver before DOM observations');event('document');return{textContent:'hint',classList:{contains:()=>false}};}}};
 state.snapshot={identity:true};const options={documentWorkspace:{workspace:{current:currentScope},sketches:{membershipQuery:readMembership,activeSketchId,elementSketchId,sketchById:p.sketchById,constraintSketchId:p.constraintSketchId}},geometry:{addPoint,addLine,addArc},
  readServices:{reads:{blockProjectionBundles:p.blockProjectionBundles},projections:{blockProjectionBundle:p.blockProjectionBundle}},scopeQuery:{sketchSolveVariables:p.sketchSolveVariables,sketchSolveConstraints:p.sketchSolveConstraints,sketchSolveLines:p.sketchSolveLines},
  solving:{solveReferenceDependentSketches:p.solveReferenceDependentSketches,solveSketchAndDependents:p.solveSketchAndDependents},analysis,solver,
  referenceState:{refreshReferenceConstraintValidity:p.refreshReferenceConstraintValidity,wouldCreateReferenceCycle:p.wouldCreateReferenceCycle},blockQueries:{blockInstanceById:p.blockInstanceById},
  operandValues:{operandElement:p.operandElement,makeConstraintOperand:p.makeConstraintOperand},interaction:{selection,pointUsage:{isExplicitPoint:p.isExplicitPoint}},sessions:{targets},placement:{dimensionFromAnchor:p.dimensionFromAnchor},checkpoint:{captureValues:p.snapshotModelState},
  presentation:{updateUI:p.updateUI,draw:p.draw},viewport:{worldToCanvasScreen:p.worldToCanvasScreen},sketchPresentation:{constraintStatusColor:p.constraintStatusColor},canvas:p.canvas,document:p.document,
  readSelectedGeometry:p.readSelectedGeometry,commitNewConstraint:p.commitNewConstraint,markReferenceConstraint:p.markReferenceConstraint,serializeModel:p.serializeModel,serializeConstraint:p.serializeConstraint,
  resolveConstraintIntent:p.resolveConstraintIntent,resetModelState:p.resetModelState,pushModelConstraint:p.pushModelConstraint,fitAllGeometryToViewport:p.fitAllGeometryToViewport,acceptError:p.acceptError};
 const names=['createModelSupport','createReferenceLineMove','createDependencyOrderFixture','createEditingCases','createInputObservation','createIntentResolution','createForcedCommit'];
 const factories=composed?w.ConstraintTestDriver.createBrowserFactories(options):Object.fromEntries(names.map(n=>[n,()=>w.ConstraintTestDriver[n](p)]));assert.deepEqual(events,[]);
 const support=Object.fromEntries(names.map(n=>[n,factories[n]()]));assert.deepEqual(events,[]);state.ready=true;
 return{w,state,p,options,events,marker,support,factories,selection,targets,model,original,originalSolve,seed(){const a=addPoint(0,0,false,'explicit'),b=addPoint(10,0,false,'endpoint'),l=addLine(a,b);return{a,b,l};}};
}

test('constraint browser factories keep seven lazy creation stages and the exact status function within each model support',()=>{
 const f=browserFixture();assert.equal(Object.isFrozen(f.factories),true);assert.deepEqual(f.events,[]);
 for(const [name,api]of Object.entries(f.support)){assert.equal(Object.isFrozen(api),true,name);assert.notEqual(f.factories[name](),api,name);}
 assert.equal(f.support.createModelSupport.readStatuses,f.support.createModelSupport.publicAPI.constraintStatusesForTest);assert.deepEqual(f.events,[]);assert.equal(f.state.model,f.original);
});

test('bound model support preserves live membership, projection object identity, default refresh arguments and solver receivers',()=>{
 for(const composed of [false,true]){const f=browserFixture(composed),m=f.support.createModelSupport,{a,l}=f.seed();a.localElement={id:'local'};const instance={id:'B'};f.state.bundle={instance,points:[a],lines:[l],circles:[],arcs:[],splines:[]};instance.bundle=f.state.bundle;f.state.model.blockInstances=[instance];f.state.statuses=new Map([[a,'first']]);
  let result=m.readStatuses();assert.equal(result.items[0].status,'first');assert.deepEqual(f.events.slice(-2),['refresh','membership']);const first=f.state.refreshOptions;assert.equal(Object.keys(first).length,0);m.readStatuses();assert.notEqual(f.state.refreshOptions,first);
  const replacement={...a,sketchId:'S2'};f.state.model={...f.state.model,points:[replacement],activeSketchId:'S2'};f.state.statuses=new Map([[replacement,'replacement']]);f.state.bundle.points=[replacement];
  assert.equal(m.readStatuses().items[0].status,'replacement');result=m.publicAPI.blockConstraintStatusForTest('B');assert.equal(result.projections[0].status,'replacement');assert.notEqual(result.summary,f.state.summary);assert.equal(result.summary.nested,f.state.summary.nested);
  assert.equal(m.publicAPI.constraintAnalysisForTest().pointCount,1);assert.equal(f.state.analysisOptions.errorTolerance,0.001);
  f.state.failure='refresh';assert.throws(()=>m.readStatuses(),error=>error===f.marker);assert.equal(f.events.at(-1),'refresh');
 }
});

test('bound input and intent supports observe the real target session and resolve only current scope objects',()=>{
 for(const composed of [false,true]){const f=browserFixture(composed),s=f.support,{a}=f.seed(),operands=[{kind:'point',point:a}];f.targets.begin('distance',operands);f.selection.set('geometryInstances',[{id:'I'}]);
  const observation=s.createInputObservation.state();assert.equal(observation.selected,f.state.selected);assert.equal(observation.operands[0].id,a.id);assert.equal(observation.pendingType,'distance');assert.equal(f.targets.operands,operands);
  const replacement={...a,x:99};f.state.model={...f.state.model,points:[replacement]};let result=s.createIntentResolution.resolve('distance',[{kind:'point',id:a.id}]);assert.equal(f.state.resolvedOperands[0].point,replacement);assert.equal(result.constraint.id,a.id);
  f.events.length=0;assert.throws(()=>s.createIntentResolution.resolve('distance',[{kind:'point',id:'missing'}]),/Missing test operand: missing/);assert.deepEqual(f.events,[]);assert.equal(f.targets.operands,operands);
  f.state.failure='intent:distance';assert.throws(()=>s.createIntentResolution.resolve('distance',[{kind:'point',id:a.id}]),error=>error===f.marker);assert.equal(f.events.at(-1),'intent:distance');
 }
});

test('bound dependency and editing fixtures keep reference graph identity, reset scope and solve, capture, display order',()=>{
 const normalize=value=>JSON.parse(JSON.stringify(value));for(const scenario of ['dependencies','support-status','move']){const runs=[];for(const composed of [false,true]){
  const f=browserFixture(composed);let result;if(scenario==='dependencies'){result=f.support.createDependencyOrderFixture.orderCase();assert.equal(f.state.model.constraints[0].point,f.state.model.points[2]);assert.equal(f.state.model.constraints[0].line,f.state.model.lines[0]);assert.notEqual(f.state.model,f.original);assert.equal(f.original.points.length,0);}
  if(scenario==='support-status')result=f.support.createEditingCases.resetForSupportConstraintStatus();
  if(scenario==='move'){const {a,l}=f.seed();l.sketchId='S4';a.sketchId='S1';f.events.length=0;result=f.support.createReferenceLineMove.move(5);assert.equal(l.p1.y,5);assert.deepEqual(f.events,['dependents:S4','refresh','ui','draw']);}
  runs.push({result:normalize(result),events:f.events.slice(),model:normalize(f.state.model)});
 }assert.deepEqual(runs[1],runs[0],scenario);}
});

test('bound forced commits restore the latest Solver method before observations and on the original commit exception',()=>{
 for(const composed of [false,true])for(const failure of [false,true]){const f=browserFixture(composed),replacement=function(){return{original:true};};f.p.solver.solveSubset=replacement;f.state.expectedSolve=replacement;if(failure)f.state.failure='commit';
  if(failure){assert.throws(()=>f.support.createForcedCommit.commit({success:true,errorNorm:0}),error=>error===f.marker);assert.equal(f.events.includes('document'),false);}
  else{const result=f.support.createForcedCommit.commit({success:true,errorNorm:'0.25',iterations:'4',reason:'forced'});assert.equal(result.committed,true);assert.equal(result.constraintCount,1);assert.equal(f.state.forced.errorNorm,0.25);assert.equal(f.state.forced.iterations,4);assert.equal(f.events.at(-1),'document');}
  assert.equal(f.p.solver.solveSubset,replacement);assert.notEqual(f.state.model,f.original);assert.equal(f.original.points.length,0);
 }
});
