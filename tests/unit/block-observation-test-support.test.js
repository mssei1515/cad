const assert=require('node:assert/strict');const fs=require('node:fs');
const path=require('node:path');const vm=require('node:vm');const test=require('node:test');
const sandbox={window:{},structuredClone};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../src/testing/block_test_driver.js'),'utf8'),sandbox);
function fixture(){
 const events=[],instance={id:'BI1',definitionId:'B1',sketchId:'S1',x:3,y:4,rotation:0,enabledSketchIds:['S1']};
 const state={ready:false,scope:{blockInstances:[instance]},definitions:[],mode:'select',variables:[{object:instance,prop:'rotation'},{object:instance,prop:'x'},{object:{...instance},prop:'y'}],allowRotation:false,serialized:{version:26},bundle:{lines:[{id:'L1',p1:{id:'P1',x:2,y:3},p2:{x:8,y:7}}]}};
 const viewport={scale:2},selection={blockInstances:[instance]},hover={current:{block:instance,point:{id:'P1',blockProjection:true},line:{id:'L1'},arcEndpoint:{arc:{id:'A1'},endpoint:'start'}}},target={command:{type:'distance'}};
 const check=()=>assert.equal(state.ready,true,'no eager owner reads');
 const ports={blockInstanceById:id=>state.scope.blockInstances.find(item=>item.id===id),currentScope:()=>{check();return state.scope;},blockInstanceDisplayCenter:item=>({x:item.x,y:item.y}),
 readSolverVariables:()=>{check();return state.variables;},buildDragSession:(kind,item,point)=>{events.push([kind,item,point]);return kind==='block-rotation'&&!state.allowRotation?null:{};},
 blockProjectionBundle:()=>state.bundle,blockProjectionBundles:()=>state.scope.blockInstances.map(()=>state.bundle),
 worldToCanvasScreen:point=>({x:point.x*viewport.scale,y:point.y*viewport.scale}),canvas:{getBoundingClientRect:()=>({left:10,top:20})},
 constraintTargetSession:target,canvasHover:hover,canvasSelection:selection,readDefinitions:()=>{check();return state.definitions;},readMode:()=>state.mode,serializeModel:()=>state.serialized,viewport};
 const support=sandbox.window.BlockTestDriver.createObservationSupport(ports);assert.deepEqual(events,[]);state.ready=true;
 return{support,state,events,instance,viewport,selection,hover,target};
}

test('Block observations retain five ordered API names and use current projection and viewport owners',()=>{
 const f=fixture();assert.deepEqual(Object.keys(f.support),['blockState','blockInteractionPoints','blockRotationLockStateForTest','blockProjectionEndpointForTest','blockProjectionHoverState']);assert.equal(Object.isFrozen(f.support),true);
 const endpoint=f.support.blockProjectionEndpointForTest(),points=f.support.blockInteractionPoints();assert.equal(endpoint.x,14);assert.equal(endpoint.y,26);assert.equal(endpoint.id,'P1');assert.equal(points.center.x,20);assert.equal(points.center.y,30);assert.equal(points.pivot.x,16);
 f.viewport.scale=4;f.state.bundle.lines[0].p1.x=9;assert.equal(f.support.blockProjectionEndpointForTest().x,46);assert.equal(f.support.blockInteractionPoints().scale,4);
});

test('rotation observation preserves variable Object identity and delegates session availability with the same instance and center',()=>{
 const f=fixture(),rotation=f.support.blockRotationLockStateForTest();assert.deepEqual(Array.from(rotation.solverVariables),['rotation','x']);assert.equal(rotation.translationSessionAvailable,true);assert.equal(rotation.rotationSessionAvailable,false);
 assert.equal(f.events[0][1],f.instance);assert.equal(f.events[1][1],f.instance);assert.equal(f.events[0][2],f.events[1][2]);
 f.state.allowRotation=true;f.state.variables=[{object:f.instance,prop:'y'}];assert.equal(f.support.blockRotationLockStateForTest().solverVariables[0],'y');assert.equal(f.support.blockRotationLockStateForTest().rotationSessionAvailable,true);
 f.state.scope={blockInstances:[]};f.events.length=0;assert.equal(f.support.blockRotationLockStateForTest(),null);assert.deepEqual(f.events,[]);
});

test('Block state and hover queries follow replaced scope, definitions and session values without copying product state',()=>{
 const f=fixture(),first=f.support.blockState();assert.equal(first.instances.length,1);assert.equal(first.serialized,f.state.serialized);assert.notEqual(first.instances[0].enabledSketchIds,f.instance.enabledSketchIds);
 let hover=f.support.blockProjectionHoverState();assert.equal(hover.command,'distance');assert.equal(hover.arcEndpointId,'A1.start');assert.equal(hover.pointIsBlockProjection,true);
 f.state.scope={blockInstances:[]};f.state.definitions=[{id:'B2',name:'new',points:[],lines:[],constraints:[],sketches:[],origin:{x:0,y:0}}];f.state.mode='block-place';f.selection.blockInstances=[];f.target.command=null;f.hover.current={};
 const current=f.support.blockState();assert.equal(current.definitions[0].id,'B2');assert.equal(current.instances.length,0);assert.equal(current.mode,'block-place');assert.equal(current.selectedInstanceIds.length,0);
 hover=f.support.blockProjectionHoverState();assert.equal(hover.command,null);assert.equal(hover.blockInstanceId,null);
});
