const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test');
function fixture(withSharedState=false,withWorkspace=false,buildFeature=null){
 const sandbox={window:{},structuredClone};vm.createContext(sandbox);
 const sources=vm.runInNewContext(fs.readFileSync('index.html','utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
 for(const file of sources.filter(p=>p.startsWith('src/')))vm.runInContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
 const events=[],state={ready:false,scope:{activeSketchId:'A',constraints:[]},editing:{id:'previous'},profiling:false,
  result:{success:true,errorNorm:0},failure:null,restoringOnDraw:false};
 const read=()=>{assert.equal(state.ready,true,'no state reads during construction');return state.scope;};
 const history={restoring:false},variable={prop:'x'},analysis={status:'ok'};
 const profiler={get active(){read();return state.profiling;},work:function(label,work){'use strict';assert.equal(this,undefined);events.push(['profile',label]);return work();}};
 const namespace={ensureParameterNamespace:scope=>{assert.equal(scope,read());},referenceDimensionValues:()=>new Map(),
  dimensionConstraintsInNamespace:scope=>scope.constraints,evaluateParameterNamespace:scope=>{assert.equal(scope,read());},parameterErrorText:error=>error.message};
 const solver={solveSubset(options){assert.equal(this,solver);read();events.push(['solve',options]);if(state.failure?.stage==='solve')throw state.failure.error;return state.result;}};
 const solveState=withSharedState?sandbox.window.SketchSolving.createState():undefined;
 const input={solveState,currentScope:read,solver,scopeQuery:{sketchSolveVariables:()=>[variable],
  sketchSolveConstraints:()=>read().constraints,sketchSolveLines:()=>[],localSolveContextFromSeeds:()=>({})},activeSketchId:()=>read().activeSketchId,
  elementSketchId:item=>item.sketchId,constraintSketchId:item=>item.sketchId,constraintGraphNodes:()=>new Set(),constraintIsOperational:()=>true,
  geometryInstanceBundles:()=>[],orderedSketches:()=>[{id:read().activeSketchId}],synchronizeSketchProjectionMetadata:id=>events.push(['sync',id]),
  refreshReferenceConstraintValidity:()=>events.push(['validity']),normalizeArcSweeps:()=>events.push(['normalize']),
  resultIsAccepted:result=>result.success&&result.errorNorm<=0.01,snapshotModelState:()=>({}),restoreModelState:()=>events.push(['restore']),acceptError:0.01,
  namespace,currentParameterNamespace:read,maxPasses:3,relativeTolerance:1e-8,applicationText:(_ja,en)=>{read();return en;},profiler,
  readEditingScope:()=>{read();return state.editing;},activateEditingScope:scope=>{events.push(['activate',scope]);state.scope=scope;state.editing=scope;},
  nextHatchIndex:()=>7,drawableSketchIds:definition=>{assert.equal(definition,state.scope);return [definition.activeSketchId];},
  refreshConstraintAnalysis:()=>{events.push(['analysis']);return analysis;},setSolveResultHint:(...args)=>events.push(['hint',...args]),
  updateUI:options=>events.push(['ui',options]),draw:()=>{events.push(['draw']);if(state.restoringOnDraw)history.restoring=true;if(state.failure?.stage==='draw')throw state.failure.error;},
  historyController:history,recordHistory:label=>events.push(['history',label])};
 const editingScope={solver,get current(){return input.readEditingScope();},activate(...args){assert.equal(this,editingScope);return input.activateEditingScope(...args);}};
 const analysisOwner={refresh(options){assert.equal(this,analysisOwner);state.analysisOptions=options;return input.refreshConstraintAnalysis(options);}};
 const ids={peek(kind){assert.equal(this,ids);assert.equal(kind,'hatch');read();return input.nextHatchIndex();}};
 const owners={documentWorkspace:{workspace:{current:read},parameters:namespace,documentIds:ids,
  sketches:{activeSketchId:input.activeSketchId,elementSketchId:input.elementSketchId,constraintSketchId:input.constraintSketchId,orderedSketches:input.orderedSketches}},
  scopeQuery:input.scopeQuery,references:{constraintGraphNodes:input.constraintGraphNodes},referenceState:{constraintIsOperational:input.constraintIsOperational,refreshReferenceConstraintValidity:input.refreshReferenceConstraintValidity},
  readServices:{reads:{geometryInstanceBundles:input.geometryInstanceBundles},catalog:{blockDefinitionDrawableSketchIds:input.drawableSketchIds}},
  projectionEditing:{synchronizeSketchProjectionMetadata:input.synchronizeSketchProjectionMetadata},geometry:{normalizeArcSweeps:input.normalizeArcSweeps},checkpoint:{captureValues:input.snapshotModelState,restoreValues:input.restoreModelState},
  editingScope,analysis:analysisOwner,presentation:{settings:{applicationText:input.applicationText},profiler,setSolveResultHint:input.setSolveResultHint,updateUI:input.updateUI,draw:input.draw},
  historyController:history,recordHistory:input.recordHistory,resultIsAccepted:input.resultIsAccepted,acceptError:input.acceptError,solveState,maxPasses:input.maxPasses,relativeTolerance:input.relativeTolerance};
 const api=buildFeature?buildFeature({w:sandbox.window,owners,input,state,events,read,solver}):withWorkspace?sandbox.window.SketchSolvingFeature.createForWorkspace(owners):sandbox.window.SketchSolvingFeature.create(input);
 assert.deepEqual(events,[]);assert.equal(Object.isFrozen(api),true);state.ready=true;
 return {api,state,events,history,analysis,variable,solveState,owners};
}

test('solving feature shares actual solve state through parameters and refresh, with live mode, profiling and ordered feedback',()=>{
 const f=fixture(),{api,state,events}=f;
 assert.equal(api.refresh.run('edit'),state.result);const hint=events.find(e=>e[0]==='hint');
 assert.equal(hint[2].result,state.result);assert.equal(hint[3],f.analysis);assert.equal(api.solving.sketchSolveState('A').result,state.result);
 assert.equal(events.find(e=>e[0]==='solve')[1].variables[0],f.variable);assert.equal(events.some(e=>e[0]==='profile'),false);
 assert.deepEqual(events.slice(-5).map(e=>e[0]),['analysis','hint','ui','draw','history']);assert.equal(events.at(-1)[1],'edit');
 state.scope={activeSketchId:'B',constraints:[]};state.profiling=true;events.length=0;
 api.refresh.run('next');assert.equal(events.find(e=>e[0]==='sync')[1],'B');assert.equal(api.solving.sketchSolveState('B').result,state.result);
 assert.deepEqual(events.filter(e=>e[0]==='profile').map(e=>e[1]),['parameters','dependencies']);
});

function contextFixture(composed, failureAt=null) {
 const probe={order:[],error:new Error(failureAt || 'failure')};
 const f=fixture(true,true,({w,owners,input,state,events,read,solver})=>{
  const empty=()=>({activeSketchId:'A',sketches:[{id:'A'}],points:[],lines:[],circles:[],arcs:[],splines:[],constraints:[],blockInstances:[],geometryInstances:[]});
  state.scope=empty();state.virtual=empty();
  const point=new w.GeometrySolver.Point('virtual',1,2);point.sketchId='A';state.virtual.points.push(point);
  state.extra={object:{sketchId:'A',value:3},prop:'value'};
  const annotationDrag={scope:()=>{read();return state.virtual;},additionalVariables:()=>{read();return [state.extra];}};
  Object.assign(owners.documentWorkspace.sketches,{membershipQuery:()=>{read();return {activeSketchId:'A',elementSketchId:input.elementSketchId};},
   descendantSketchIds:()=>[],isEditableSketchElement:()=>true,isRootSketch:()=>false});
  const reads={resolveGeometryRef:ref=>ref.target};for(const name of ['Points','Lines','Circles','Arcs','Splines'])reads['allGeometry'+name]=()=>{read();return state.virtual[name.toLowerCase()];};
  Object.assign(owners.readServices,{reads:{...reads,geometryInstanceBundles:()=>[],blockProjectionBundles:()=>[]},instances:{geometryInstanceSourcePoints:()=>[]},geometryAppearance:{isVisibleSketchElement:()=>true}});
  owners.references.geometryInstanceDependencyRefs=item=>item.refs||[];
  solver.analyzeConstraintState=function(options){assert.equal(this,solver);read();events.push(['analyze',options]);return {stable:true,variableFreedom:new Map(),variableIndex:new Map(),nullspaceBasis:[],variables:options.variables};};
  solver.constraintRedundancyState=function(){assert.equal(this,solver);read();return {stable:true,byConstraint:new Map()};};
  const originalQuery=w.SolveScopeQuery,originalAnalysis=w.ConstraintAnalysis;
  w.SolveScopeQuery={...originalQuery,create(options){probe.order.push('query');probe.queryPorts=options;if(failureAt==='query')throw probe.error;return probe.query=originalQuery.create(options);}};
  w.ConstraintAnalysis={...originalAnalysis,createWithRedundancy(options){probe.order.push('analysis');probe.analysisPorts=options;if(failureAt==='analysis')throw probe.error;return probe.parts=originalAnalysis.createWithRedundancy(options);}};
  let context;try {
   const contextInput={documentWorkspace:owners.documentWorkspace,readServices:owners.readServices,references:owners.references,referenceState:owners.referenceState,
    annotationDrag,solver,pointUsage:{isExplicitPoint:()=>true},presentation:owners.presentation,solveState:owners.solveState,minimumLength:0.001,acceptError:owners.acceptError};
   if(composed)context=w.SketchSolvingFeature.createContextForWorkspace(contextInput);
   else {
    const scopeQuery=w.SolveScopeQuery.create({currentScope:annotationDrag.scope,additionalVariables:annotationDrag.additionalVariables,geometryReads:owners.readServices.reads,
     activeSketchId:input.activeSketchId,elementSketchId:input.elementSketchId,constraintSketchId:input.constraintSketchId,isVisibleSketchElement:owners.readServices.geometryAppearance.isVisibleSketchElement,
     constraintIsOperational:input.constraintIsOperational,constraintGraphNodes:c=>c.annotationGeometryNodes||input.constraintGraphNodes(c),geometryInstanceDependencyRefs:owners.references.geometryInstanceDependencyRefs,minimumLength:0.001});
    const {analysis,redundancy}=w.ConstraintAnalysis.createWithRedundancy({currentScope:input.currentScope,solver,scopeQuery,sketchContext:owners.documentWorkspace.sketches,readServices:owners.readServices,
     constraintIsOperational:input.constraintIsOperational,refreshReferenceConstraintValidity:input.refreshReferenceConstraintValidity,sketchHasSolveError:owners.solveState.hasError,isExplicitPoint:contextInput.pointUsage.isExplicitPoint,
     minimumLength:0.001,acceptError:owners.acceptError,profileAnalysis:work=>input.profiler.active?input.profiler.work.call(undefined,'analysis',work):work()});
    context={scopeQuery,analysis,redundancy,createSolving:late=>w.SketchSolvingFeature.createForWorkspace({...owners,...late,scopeQuery,analysis})};
   }
  } finally {w.SolveScopeQuery=originalQuery;w.ConstraintAnalysis=originalAnalysis;}
  probe.context=context;probe.owners=owners;probe.point=point;probe.earlySolver=solver;
  const lateSolver={solveSubset(options){read();assert.equal(this,lateSolver);events.push(['late-solve',options]);if(state.failure)throw state.failure.error;return state.result;}};
  Object.defineProperty(owners.editingScope,'solver',{get(){probe.order.push('late-solver');return lateSolver;}});
  assert.deepEqual(probe.order,['query','analysis']);
  const api=context.createSolving({projectionEditing:owners.projectionEditing,geometry:owners.geometry,checkpoint:owners.checkpoint,editingScope:owners.editingScope,
   historyController:owners.historyController,recordHistory:owners.recordHistory,resultIsAccepted:owners.resultIsAccepted,maxPasses:owners.maxPasses,relativeTolerance:owners.relativeTolerance});
  assert.deepEqual(probe.order,['query','analysis','late-solver']);return api;
 });return {...f,probe};
}

test('solving context keeps actual query and analysis owners cold, with virtual annotation scope distinct from Workspace scope and late solver',()=>{
 for(const composed of [false,true]){
  const f=contextFixture(composed),{context,queryPorts,analysisPorts,point}=f.probe;
  assert.equal(context.scopeQuery,f.probe.query);assert.equal(context.analysis,f.probe.parts.analysis);assert.equal(context.redundancy,f.probe.parts.redundancy);
  assert.notEqual(queryPorts.currentScope,analysisPorts.currentScope);assert.equal(analysisPorts.solver,f.probe.earlySolver);
  const variables=context.scopeQuery.sketchSolveVariables('A');assert.ok(variables.some(v=>v.object===point));assert.ok(variables.includes(f.state.extra));
  const nodes=[point];assert.equal(queryPorts.constraintGraphNodes({annotationGeometryNodes:nodes}),nodes);
  f.api.refresh.run('edit');assert.ok(f.events.some(e=>e[0]==='late-solve'));assert.ok(f.events.some(e=>e[0]==='analyze'));
  assert.equal(f.solveState.sketchSolveState('A').result,f.state.result);assert.equal(f.events.at(-1)[0],'history');
  if(composed)assert.equal(Object.isFrozen(context),true);
 }
});

test('solving context preserves live profiling, failed result diagnostics and exception boundaries',()=>{
 for(const composed of [false,true]){
  const f=contextFixture(composed);f.state.profiling=true;f.api.refresh.run('edit');assert.ok(f.events.some(e=>e[0]==='profile'&&e[1]==='analysis'));
  f.events.length=0;f.state.result={success:false,errorNorm:2};f.api.refresh.run('failed');assert.equal(f.solveState.hasError('A'),true);assert.equal(f.events.some(e=>e[0]==='history'),false);
  const error=new Error('late solver failed');f.state.failure={error};f.events.length=0;assert.throws(()=>f.api.refresh.run('exception'),e=>e===error);assert.equal(f.events.some(e=>e[0]==='draw'||e[0]==='history'),false);
  for(const stage of ['query','analysis'])assert.throws(()=>contextFixture(composed,stage),e=>e.message===stage);
 }
});

test('solving feature retains failed-solve feedback and skips history, while draw exceptions keep identity and partial state',()=>{
 const f=fixture(),{api,state,events}=f;state.result={success:false,errorNorm:2};
 assert.equal(api.refresh.run('failed'),state.result);assert.equal(api.solving.sketchSolveState('A').status,'error');
 assert.deepEqual(events.slice(-4).map(e=>e[0]),['analysis','hint','ui','draw']);assert.equal(events.some(e=>e[0]==='history'),false);
 state.result={success:true,errorNorm:0};const marker=new Error('draw failed');state.failure={stage:'draw',error:marker};events.length=0;
 assert.throws(()=>api.refresh.run('throw'),error=>error===marker);assert.equal(api.solving.sketchSolveState('A').result,state.result);
 assert.equal(events.at(-1)[0],'draw');assert.equal(events.some(e=>e[0]==='history'),false);
 state.failure=null;state.restoringOnDraw=true;events.length=0;api.refresh.run('restoring');assert.equal(events.some(e=>e[0]==='history'),false);
});

test('stored-definition stabilization uses the editing scope and always restores it, without application feedback or history',()=>{
 const f=fixture(),{api,state,events}=f,previous={activeSketchId:'previous',constraints:[]},definition={activeSketchId:'D',constraints:[],nextHatchIndex:2};
 state.editing=previous;assert.notEqual(state.scope,previous);const result=api.storedDefinitions.stabilize(definition);
 assert.equal(result.success,true);assert.equal(result.result,state.result);assert.equal(state.scope,previous);assert.equal(state.editing,previous);assert.equal(definition.nextHatchIndex,7);
 assert.equal(events[0][1],definition);assert.equal(events.at(-1)[1],previous);assert.equal(events.some(e=>['analysis','hint','ui','draw','history'].includes(e[0])),false);
 const marker=new Error('solver failed');state.failure={stage:'solve',error:marker};events.length=0;definition.nextHatchIndex=9;
 assert.throws(()=>api.storedDefinitions.stabilize(definition),error=>error===marker);assert.equal(state.editing,previous);assert.equal(definition.nextHatchIndex,9);
 assert.equal(events.at(-1)[1],previous);
});

test('solving feature connects the same explicit result owner to parameter stabilization, refresh and model reset',()=>{
 const f=fixture(true),{api,state,solveState}=f;assert.equal(solveState.sketchSolveState('A'),null);
 solveState.setSketchSolveError('A',{errorNorm:2});assert.equal(api.solving.sketchSolveState('A'),solveState.sketchSolveState('A'));
 api.parameters.stabilize();assert.equal(solveState.hasError('A'),false);assert.equal(solveState.sketchSolveState('A').result,state.result);
 state.result={success:false,errorNorm:1};api.refresh.run('failed');assert.equal(solveState.hasError('A'),true);assert.equal(solveState.sketchSolveState('A').result,state.result);
 api.solving.clearAll();assert.equal(solveState.sketchSolveState('A'),null);
});

test('Workspace solving composition matches raw owners through live scope, profiling, feedback and shared result state',()=>{
 const results=[];for(const composed of [false,true]){
  const f=fixture(true,composed);assert.equal(f.solveState.sketchSolveState('A'),null);f.api.refresh.run('edit');
  assert.equal(f.solveState.sketchSolveState('A').result,f.state.result);assert.equal(f.events.find(e=>e[0]==='hint')[3],f.analysis);
  f.state.scope={activeSketchId:'B',constraints:[]};f.state.profiling=true;f.events.length=0;f.api.refresh.run('other');
  assert.equal(f.solveState.sketchSolveState('B').result,f.state.result);assert.equal(f.events.find(e=>e[0]==='solve')[1].variables[0],f.variable);
  if(composed)assert.deepEqual(Object.keys(f.state.analysisOptions),[]);
  results.push(JSON.stringify({events:f.events,a:f.solveState.sketchSolveState('A'),b:f.solveState.sketchSolveState('B')}));
 }assert.equal(results[1],results[0]);
});

test('Workspace solving composition restores the distinct editing scope for stored definitions on success and failure',()=>{
 const results=[];for(const composed of [false,true]){
  const f=fixture(true,composed),previous={activeSketchId:'previous',constraints:[]},definition={activeSketchId:'D',constraints:[],nextHatchIndex:2};
  f.state.editing=previous;assert.notEqual(f.state.scope,previous);f.api.storedDefinitions.stabilize(definition);
  assert.equal(f.state.scope,previous);assert.equal(f.state.editing,previous);assert.equal(definition.nextHatchIndex,7);
  const marker=new Error('definition solve failed');f.state.failure={stage:'solve',error:marker};definition.nextHatchIndex=9;f.events.length=0;
  assert.throws(()=>f.api.storedDefinitions.stabilize(definition),error=>error===marker);assert.equal(f.state.editing,previous);assert.equal(definition.nextHatchIndex,9);
  assert.equal(f.events.some(e=>['analysis','ui','draw','history'].includes(e[0])),false);results.push(JSON.stringify({events:f.events,scope:f.state.scope,definition}));
 }assert.equal(results[1],results[0]);
});

test('Workspace solving composition retains failed result state, draw exception and history suppression during restore',()=>{
 const results=[];for(const composed of [false,true]){
  const f=fixture(true,composed);f.state.result={success:false,errorNorm:2};f.api.refresh.run('failed');assert.equal(f.solveState.hasError('A'),true);assert.equal(f.events.some(e=>e[0]==='history'),false);
  f.state.result={success:true,errorNorm:0};const marker=new Error('draw failed');f.state.failure={stage:'draw',error:marker};f.events.length=0;
  assert.throws(()=>f.api.refresh.run('draw'),error=>error===marker);assert.equal(f.solveState.sketchSolveState('A').result,f.state.result);assert.equal(f.events.at(-1)[0],'draw');assert.equal(f.events.some(e=>e[0]==='history'),false);
  f.state.failure=null;f.state.restoringOnDraw=true;f.events.length=0;f.api.refresh.run('restoring');assert.equal(f.history.restoring,true);assert.equal(f.events.some(e=>e[0]==='history'),false);
  results.push(JSON.stringify({events:f.events,result:f.solveState.sketchSolveState('A')}));
 }assert.equal(results[1],results[0]);
});
