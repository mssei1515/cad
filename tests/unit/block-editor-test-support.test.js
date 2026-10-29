const assert=require('node:assert/strict');const fs=require('node:fs');
const path=require('node:path');const vm=require('node:vm');const test=require('node:test');
const sandbox={window:{},structuredClone};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../src/testing/block_test_driver.js'),'utf8'),sandbox);
function fixture(){
 const events=[],editor={current:null},state={ready:false,definitions:[],mode:'select',scope:{sketches:[],activeSketchId:'S1',lines:[],blockInstances:[]}};
 const placement={definitionId:'B1',setAnchor(value){assert.equal(this,placement);this.anchor=value;events.push(['anchor',value.x,value.y]);}};
 const ports={blockEditor:editor,blockEditorSessionChain:()=>editor.current?[editor.current]:[],currentScope:()=>{assert.equal(state.ready,true,'no eager scope read');return state.scope;},
 readDefinitions:()=>{assert.equal(state.ready,true,'no eager definition read');return state.definitions;},readMode:()=>state.mode,
 blockPlacementCommand:placement,commitBlockPlacement:rotation=>{events.push(['place',rotation]);return{id:'BI1',definitionId:'B1',...placement.anchor,rotation};},
 cancelBlockDefinitionEdit:()=>{events.push('cancel');editor.current=null;state.definitions=[{id:'after-cancel'}];},
 completeBlockDefinitionEdit:options=>{events.push(['complete',options.rotationLocked]);editor.current=null;state.definitions=[{id:'one'},{id:'two'}];state.scope.blockInstances=[{id:'BI2'}];},
 setBlockInstanceEnabledSketchIds:(instance,ids)=>{events.push(['enabled',instance,ids]);return 'changed';},
 serializeModel:()=>{events.push('serialize');return{version:26,blockDefinitions:[],blockInstances:[]};},loadModelData:data=>{events.push('load');state.definitions=[{},{}];state.scope={...state.scope,blockInstances:[{},{},{}]};},
 updateUI:()=>events.push('ui'),draw:()=>events.push('draw'),allGeometryLines:()=>[{blockProjection:true},{}],
 };
 const support=sandbox.window.BlockTestDriver.createEditorSupport(ports);assert.deepEqual(events,[]);state.ready=true;
 return{support,state,editor,events,ports};
}

test('Block editor support retains eleven API entries and live post-cancel/complete observations',()=>{
 const f=fixture();assert.equal(typeof f.support.resetForEmptyBlockCreation,'function');assert.equal(typeof f.support.blockDefinitionUpdateCase,'function');
 assert.deepEqual(Object.keys(f.support.lifecycle),['reloadBlockState','reloadLegacyBlockState','blockEditorState','commitBlockPlacementForTest','constrainFirstNestedBlockLineForTest','addBlockEditorChildGeometry','cancelBlockEditor','completeBlockEditor','setFirstBlockInstanceSketches']);
 f.editor.current={isNew:true,draft:{name:'draft'},original:{values:{lines:[{}]}}};
 const editing=f.support.lifecycle.blockEditorState();assert.equal(editing.name,'draft');assert.equal(editing.depth,1);assert.equal(editing.hostLineCount,1);
 const canceled=f.support.lifecycle.cancelBlockEditor();assert.equal(canceled.editing,false);assert.equal(canceled.definitions,1);assert.equal(f.events[0],'cancel');
 f.editor.current={};const completed=f.support.lifecycle.completeBlockEditor();assert.equal(completed.editing,false);assert.equal(completed.definitions,2);assert.equal(completed.instances,1);assert.deepEqual(f.events.at(-1),['complete',true]);
});

test('placement and enabled-Sketch operations keep owner receiver, coercion and exact instance/argument forwarding',()=>{
 const f=fixture();assert.equal(f.support.lifecycle.commitBlockPlacementForTest({x:1,y:2}),null);assert.deepEqual(f.events,[]);
 f.state.mode='block-place';const placed=f.support.lifecycle.commitBlockPlacementForTest({x:'5',y:'bad'},'bad');assert.equal(placed.x,5);assert.equal(placed.y,0);assert.equal(placed.rotation,0);
 assert.deepEqual(f.events,[['anchor',5,0],['place',0]]);
 assert.equal(f.support.lifecycle.setFirstBlockInstanceSketches([]),false);
 const instance={id:'BI7'},ids=['S1'];f.state.scope.blockInstances=[instance];assert.equal(f.support.lifecycle.setFirstBlockInstanceSketches(ids),'changed');
 assert.equal(f.events.at(-1)[1],instance);assert.equal(f.events.at(-1)[2],ids);
});

test('Block reload sequences current serialization, load and display before returning live definition and projection counts',()=>{
 const f=fixture(),state=f.support.lifecycle.reloadBlockState();assert.deepEqual(f.events,['serialize','load','ui','draw','serialize']);
 assert.equal(state.definitions,2);assert.equal(state.instances,3);assert.equal(state.projectionLines,1);assert.equal(state.serializedVersion,26);
 f.state.definitions=[];assert.equal(f.support.blockDefinitionUpdateCase(),null);
});

function browserFixture() {
 const local={window:{},structuredClone};vm.createContext(local);
 for(const file of ['geometry/geometry_kernel.js','geometry/spline_geometry.js','solver/constraint_solver.js','editing/selection.js','testing/block_test_driver.js'])
  vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../src',file),'utf8'),local);
 const w=local.window,t=w.GeometrySolver,selection=w.CanvasSelection.create(),events=[];
 const empty=()=>({points:[],lines:[],constraints:[],sketches:[],annotations:[],blockInstances:[],activeSketchId:'S1'});
 const state={ready:false,scope:empty(),definitions:[],mode:'select',seq:0,cancelFailure:null},editor={current:null},hover={current:{}},targets={command:null};
 const read=()=>{assert.equal(state.ready,true,'no eager product read');return state.scope;};
 const geometry={addPoint:(x,y,fixed,kind)=>{const p=new t.Point('P'+(++state.seq),x,y,fixed,kind);p.sketchId=read().activeSketchId;read().points.push(p);return p;},
  addLine:(a,b,construction)=>{const l=new t.Line('L'+(++state.seq),a,b,construction);l.sketchId=read().activeSketchId;read().lines.push(l);return l;}};
 const documentModel={get blockDefinitions(){read();return state.definitions;}},placement={definitionId:'B1',setAnchor(value){assert.equal(this,placement);this.anchor=value;events.push('anchor');}};
 const ports={geometry,modelTypes:t,documentModel,currentScope:read,sketches:{activeSketchId:()=>read().activeSketchId},
  projections:{blockProjectionBundle:()=>state.bundle,invalidateBlockProjectionCache:()=>events.push('invalidate')},
  reads:{blockProjectionBundles:()=>read().blockInstances.map(()=>state.bundle),allGeometryLines:()=>read().lines},
  queries:{blockInstanceById:id=>read().blockInstances.find(item=>item.id===id)},selection,editor,editorChain:()=>editor.current?[editor.current]:[],placement,
  readMode:()=>state.mode,solver:{getVariables(){assert.equal(this,ports.solver);read();return state.variables||[];}},
  canvas:{getBoundingClientRect:()=>({left:10,top:20})},viewport:{scale:2},worldToCanvasScreen:p=>({x:p.x*2,y:p.y*2}),
  resetModelState:()=>{read();events.push('reset');state.scope=empty();state.definitions=[];state.seq=0;selection.clear();},
  pushModelConstraint:c=>read().constraints.push(c),fitAllGeometryToViewport:margin=>events.push(['fit',margin]),updateUI:()=>events.push('ui'),draw:()=>events.push('draw'),
  commitBlockPlacement:rotation=>({id:'BI1',definitionId:'B1',...placement.anchor,rotation}),solveSketchById:()=>({success:true}),recordHistory:label=>events.push(['history',label]),
  serializeConstraint:c=>({id:c.id}),createSketch:()=>({id:'S1'}),cancelBlockDefinitionEdit:()=>{events.push('cancel');if(state.cancelFailure)throw state.cancelFailure;editor.current=null;},
  completeBlockDefinitionEdit:()=>{editor.current=null;},setBlockInstanceEnabledSketchIds:()=>true,serializeModel:()=>state.serialized,
  loadModelData:()=>{},enterBlockDefinitionEdit:()=>{},blockInstanceDisplayCenter:item=>({x:item.x,y:item.y}),buildDragSession:()=>({}),
  constraintTargetSession:targets,canvasHover:hover,blockSelectionGeometry:()=>({}),geometryRefForItem:item=>({id:item.id})};
 const support=w.BlockTestDriver.createBrowserSupport(ports);
 const actions=support.createDimensionCases({defaultDimensionForTarget:target=>{events.push(['dimension',target]);return {kind:'linear'};},
  readOnlyDimensionConstraintForPlacement:(target,value,dimension,options)=>{events.push(['create',target,value,dimension,options]);return {readOnlyDimension:true,enabled:false,target};},
  addReadOnlyDimensionConstraint:(...args)=>events.push(['add',...args]),blockDefinitionById:id=>state.definitions.find(d=>d.id===id)});
 assert.deepEqual(events,[]);state.ready=true;
 return {support,actions,state,ports,selection,editor,hover,targets,events,t};
}

test('Block browser support groups the original ordered API and shares real geometry and selection across reset and current observations',()=>{
 const f=browserFixture();assert.equal(Object.isFrozen(f.support),true);assert.equal(Object.isFrozen(f.actions),true);
 assert.deepEqual(Object.keys(f.support.resets),['resetForBlockCreationUi','resetForEmptyBlockCreation']);
 assert.deepEqual(Object.keys(f.support.observations),['blockState','blockInteractionPoints','blockRotationLockStateForTest','blockProjectionEndpointForTest','blockProjectionHoverState']);
 assert.deepEqual(Object.keys(f.actions),['blockDefinitionUpdateCase','blockReadOnlyDimensionCase','blockExternalConstraintCase','reloadBlockState','reloadLegacyBlockState','blockEditorState','commitBlockPlacementForTest','constrainFirstNestedBlockLineForTest','addBlockEditorChildGeometry','cancelBlockEditor','completeBlockEditor','setFirstBlockInstanceSketches','blockCreationRejectionCases']);
 const result=f.support.resets.resetForBlockCreationUi();assert.deepEqual({...result.origin},{x:10,y:20});
 assert.equal(f.state.scope.points.length,4);assert.equal(f.state.scope.lines.length,4);assert.equal(f.state.scope.constraints.length,4);
 assert.equal(f.selection.lines[0],f.state.scope.lines[0]);assert.equal(f.state.scope.constraints[0] instanceof f.t.HorizontalConstraint,true);
 assert.deepEqual(f.events,['reset',['fit',220],'ui','draw']);
 f.state.serialized={version:26};assert.equal(f.support.observations.blockState().serialized,f.state.serialized);
 f.state.scope={...f.state.scope,points:[],lines:[],blockInstances:[]};f.state.mode='block-place';f.targets.command={type:'distance'};f.hover.current={point:{id:'P9',blockProjection:true}};
 assert.equal(f.support.observations.blockProjectionHoverState().pointId,'P9');assert.equal(f.support.observations.blockProjectionHoverState().command,'distance');
 const placed=f.actions.commitBlockPlacementForTest({x:'7',y:'8'},'0.5');assert.equal(placed.x,7);assert.equal(placed.rotation,0.5);assert.equal(f.events.at(-1),'anchor');
});

test('Block browser dimension and lifecycle actions preserve current projected references, Sketch and exception boundaries',()=>{
 const f=browserFixture();assert.equal(f.actions.blockReadOnlyDimensionCase(),null);
 const a=new f.t.Point('P1',0,0),b=new f.t.Point('P2',10,0),line=new f.t.Line('L1',a,b),instance={id:'BI2',definitionId:'B2',sketchId:'S2'};
 f.state.scope={...f.state.scope,blockInstances:[instance]};f.state.bundle={lines:[line],points:[a,b]};
 const result=f.actions.blockReadOnlyDimensionCase();assert.equal(result.created,true);assert.equal(result.readOnly,true);assert.equal(result.target.line,line);
 assert.equal(f.events[1][4].sketchId,'S2');assert.equal(f.events[2][1].target.line,line);assert.equal(f.events[2][2],'S2');assert.equal(f.events[2][3],'ブロック固有寸法');
 f.editor.current={draft:{name:'draft'},original:{values:{lines:[]}}};const marker=new Error('cancel failed');f.state.cancelFailure=marker;f.events.length=0;
 assert.throws(()=>f.actions.cancelBlockEditor(),error=>error===marker);assert.equal(f.editor.current.draft.name,'draft');assert.deepEqual(f.events,['cancel']);
});
