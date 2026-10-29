const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test');
function fixture(){
 const sandbox={window:{},structuredClone};vm.createContext(sandbox);
 const sources=vm.runInNewContext(fs.readFileSync('index.html','utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
 for(const file of sources.filter(p=>p.startsWith('src/')))vm.runInContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
 const w=sandbox.window,events=[],scope=()=>({activeSketchId:'S1',points:[],lines:[],circles:[],arcs:[],splines:[],constraints:[],annotations:[],parameters:[],blockInstances:[]});
 const state={ready:false,scope:scope(),definitionSeq:0,instanceSeq:0,resetFailure:null,validateFailure:null,deleteFailure:null},documentModel={blockDefinitions:[]};
 const read=()=>{assert.equal(state.ready,true,'no eager scope reads');return state.scope;},ids=w.GeometryIds.create();
 const actualNamespace=w.ParameterNamespace.create({currentParameterNamespace:read,applicationText:(_ja,en)=>en});
 const namespace=Object.freeze({...actualNamespace,validateParameterNamespace:value=>{events.push('validate');if(state.validateFailure)throw state.validateFailure;return actualNamespace.validateParameterNamespace(value);}});
 const geometry=w.GeometryCreation.create({currentScope:read,ids,assignSketchId:item=>{item.sketchId=read().activeSketchId;},currentConstruction:()=>false,minLineLength:0.01,minArcLength:0.01});
 const insertion=w.ConstraintCommitCommand.createInsertion({currentScope:read,currentParameterNamespace:read,activeSketchId:()=>read().activeSketchId,
  isDrawableSketch:()=>true,firstDrawableSketchId:()=> 'S1',ensureDimensionParameter:namespace.ensureDimensionParameter});
 const selection=w.CanvasSelection.create(),documentIds={allocate(kind){assert.equal(this,documentIds);assert.equal(kind,'blockInstance');return 'BI'+(++state.instanceSeq);}};
 const center={x:12,y:15};let lastDefinition;
 const api=w.ParameterTestDriver.createBrowserSupport({documentWorkspace:Object.freeze({document:documentModel,workspace:Object.freeze({current:read}),parameters:namespace,documentIds}),geometry,
  resetModelState:()=>{read();events.push('reset');if(state.resetFailure)throw state.resetFailure;state.scope=scope();ids.reset();documentModel.blockDefinitions=[];},
  pushModelConstraint:insertion.push,dimensionFromAnchor:(_target,p)=>({...p}),
  createEmptyBlockDefinition:name=>({...scope(),id:'BD'+(++state.definitionSeq),name}),invalidateBlockProjectionCache:()=>events.push('invalidate'),
  stabilizeActiveParameterNamespace:(id,options)=>{assert.equal(id,read().activeSketchId);assert.deepEqual(Array.from(options.allSketches),[id]);events.push('stabilize');return {success:true};},
  activeSketchId:()=>read().activeSketchId,resetHistory:label=>events.push(label),updateUI:()=>events.push('ui'),draw:()=>events.push('draw'),
  blockProjectionBundle:instance=>({lines:documentModel.blockDefinitions.find(d=>d.id===instance.definitionId).lines}),serializeModel:()=>read(),
  clearSelection:()=>{events.push('clear');selection.clear();},canvasSelection:selection,blockSelectionGeometry:()=>({lines:selection.lines}),blockSelectionBoundsCenter:()=>center,
  createBlockDefinitionFromSelection:(selected,point,name)=>{assert.equal(selected.lines[0],read().lines[0]);assert.equal(point,center);assert.equal(name,'Frozen Formula Block');
   const dimension=new w.GeometrySolver.DistanceConstraint(read().points[0],read().points[1],25);dimension.parameterName='frozen';dimension.expression='25';
   lastDefinition={parameters:[],constraints:[dimension]};return lastDefinition;},
  deleteElements:({constraints})=>{events.push('delete');if(state.deleteFailure)throw state.deleteFailure;state.scope.constraints=read().constraints.filter(c=>!constraints.includes(c));return true;},
  document:{getElementById:id=>{assert.equal(id,'hint');events.push('hint');return {textContent:'existing hint'};}}});
 assert.deepEqual(events,[]);assert.equal(Object.isFrozen(api),true);state.ready=true;
 return {api,state,documentModel,events,ids,namespace,selection,get lastDefinition(){return lastDefinition;}};
}

test('Parameter browser support shares live geometry, namespace and document definitions without eager setup or copied scope',()=>{
 const f=fixture(),initialDefinitions=f.documentModel.blockDefinitions,result=f.api.fixture.reset();
 assert.equal(result.success,true);assert.equal(result.drivenName,'d1');assert.equal(result.measuredName,'d2');
 assert.equal(f.state.scope.points.length,4);assert.equal(f.state.scope.lines.length,2);assert.equal(f.ids.peek('point'),5);
 assert.equal(initialDefinitions.length,0);assert.equal(f.documentModel.blockDefinitions.length,2);
 assert.deepEqual(Array.from(f.state.scope.blockInstances,i=>i.id),['BI1','BI2']);assert.deepEqual(f.events.slice(-5),['invalidate','stabilize','parameter test','ui','draw']);
 const observed=f.api.observation.state();assert.equal(observed.valid,true);assert.equal(observed.serialized,f.state.scope);assert.equal(observed.blockNamespaces[0].id,f.documentModel.blockDefinitions[0].id);
 assert.equal(observed.dimensions.length,2);assert.equal(observed.dimensions[1].readOnly,true);
 f.state.scope={activeSketchId:'S2',parameters:[{name:'other',expression:'7'}],constraints:[],annotations:[],blockInstances:[]};
 const other=f.api.observation.state();assert.equal(other.parameters[0].value,7);assert.equal(other.serialized,f.state.scope);assert.equal(other.blockNamespaces.length,2);
});

test('Parameter browser operations preserve source selection, definition result identity and named dimension deletion',()=>{
 const f=fixture();f.api.fixture.resetFeedback();f.events.length=0;
 const frozen=f.api.interaction.freezeBlock();assert.equal(frozen.parameters,f.lastDefinition.parameters);assert.equal(frozen.name,'frozen');
 assert.equal(frozen.expression,'25');assert.equal(frozen.sourceExpression,'40');assert.equal(f.selection.lines[0],f.state.scope.lines[0]);assert.deepEqual(f.events,['clear']);
 const removed=f.api.interaction.deleteDimension('d1');assert.equal(removed.deleted,true);assert.deepEqual(Array.from(removed.names),['d2']);assert.equal(removed.hint,'existing hint');
 f.events.length=0;const absent=f.api.interaction.deleteDimension('missing');assert.equal(absent.deleted,false);assert.deepEqual(f.events,['hint']);
});

test('Parameter browser support propagates reset, namespace and deletion errors with the same partial-state boundaries',()=>{
 const f=fixture(),marker=new Error('boundary failed'),previous=f.state.scope;f.state.resetFailure=marker;
 assert.throws(()=>f.api.fixture.reset(),error=>error===marker);assert.equal(f.state.scope,previous);assert.equal(f.ids.peek('point'),1);assert.deepEqual(f.events,['reset']);
 f.state.resetFailure=null;f.api.fixture.resetFeedback();f.events.length=0;f.state.validateFailure=marker;
 assert.throws(()=>f.api.observation.state(),error=>error===marker);assert.deepEqual(f.events,['validate']);
 f.state.deleteFailure=marker;f.events.length=0;const constraint=f.state.scope.constraints.find(c=>c.parameterName==='d1');
 assert.throws(()=>f.api.interaction.deleteDimension('d1'),error=>error===marker);assert.equal(f.state.scope.constraints.includes(constraint),true);assert.deepEqual(f.events,['delete']);
});
