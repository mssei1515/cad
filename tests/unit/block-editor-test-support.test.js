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
