const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test');
function fixture(){
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
 const api=sandbox.window.SketchSolvingFeature.create({currentScope:read,solver,scopeQuery:{sketchSolveVariables:()=>[variable],
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
  historyController:history,recordHistory:label=>events.push(['history',label])});
 assert.deepEqual(events,[]);assert.equal(Object.isFrozen(api),true);state.ready=true;
 return {api,state,events,history,analysis,variable};
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
