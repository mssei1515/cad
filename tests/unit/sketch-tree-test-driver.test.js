const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test');
const sandbox={window:{},structuredClone};vm.createContext(sandbox);
const sources=vm.runInNewContext(fs.readFileSync('index.html','utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for(const file of sources.filter(p=>p.startsWith('src/')))vm.runInContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
const w=sandbox.window;
function fixture(composed,failure){
  'use strict';
  const events=[],marker=new Error('Sketch Tree test support failure'),state={scope:w.DocumentState.create(),width:1,color:'blue',background:'white',visible:true,id:0,pressed:'true'};
  const documentModel=w.DocumentState.create(),check=name=>{if(failure===name)throw marker;};
  const current=()=>{check('scope');events.push('scope');return state.scope;};
  const sketches=w.SketchContext.create({currentScope:current,constraintGraphNodes:()=>[]}),ids=w.GeometryIds.create();
  const geometry=w.GeometryCreation.create({currentScope:current,ids,assignSketchId:sketches.assignSketchId,currentConstruction:()=>false,minLineLength:.01,minArcLength:.01});
  const documentIds={allocate(kind){assert.equal(this,documentIds);assert.equal(kind,'blockInstance');return 'BI'+ ++state.id;}};
  const documentWorkspace={document:documentModel,workspace:{current},sketches,documentIds};
  const effect=name=>(...args)=>{check(name);events.push([name,...args]);};
  const presentation={updateUI:effect('ui'),draw:effect('draw')};
  const canvas={getBoundingClientRect(){check('rect');events.push('rect');return{left:10,top:20,width:400,height:300};}};
  const viewport=w.CanvasViewport.create({canvasRect:()=>canvas.getBoundingClientRect(),initialScale:2,minZoom:.001,maxZoom:100,minLength:.01});
  const canvasDriver={clientPosition(point){assert.equal(this,undefined);check('client');const p=viewport.worldToCanvasScreen(point);return{x:10+p.x,y:20+p.y};}};
  const overlay={sketchIdentityRelationLabel(id){assert.equal(this,undefined);check('label');return 'label:'+sketches.sketchRelationToActive(id);},sketchIdentityRelationColor(){assert.equal(this,undefined);return state.color;}};
  const sketchPresentation={sketchStrokeWidth(){assert.equal(this,undefined);check('style');return state.width;},constraintStatusColor(){assert.equal(this,undefined);return state.color;}};
  const blocks={editing:{empty(name){assert.equal(this,undefined);return{...w.DocumentState.create(),id:'BD1',name,revision:0};}}};
  const projections={invalidateBlockProjectionCache:effect('invalidate'),blockProjectionBundle(instance){assert.equal(this,undefined);check('projection');const d=documentModel.blockDefinitions.find(d=>d.id===instance.definitionId);return{points:d.points.map(p=>Object.assign(new w.GeometrySolver.Point(p.id,p.x,p.y),{localElement:p})),lines:d.lines};}};
  const readServices={projections,geometryAppearance:{isVisibleSketchId(id){assert.equal(this,undefined);check('visible');return state.visible&&sketches.sketchById(id)?.visible!==false;}}};
  const hover={current:{}},interaction={hover};
  const drawingFit={fitAllGeometryToViewport:effect('fit')},referenceState={refreshReferenceConstraintValidity:effect('references')};
  const dimensionDisplay={placement:{dimensionFromAnchor(target,point){assert.equal(this,undefined);return{x:point.x,y:point.y};}}};
  function addDistanceConstraintFromTarget(target,value,dimension,options){assert.equal(this,undefined);const c=new w.GeometrySolver.DistanceConstraint(target.p1,target.p2,value);Object.assign(c,{dimension,sketchId:options.sketchId});state.scope.constraints.push(c);return c;}
  function dimensionLayout(target,dimension){assert.equal(this,undefined);check('layout');return{text:{x:dimension.x,y:dimension.y}};}
  function blockInstanceDisplayCenter(instance){assert.equal(this,undefined);return{x:instance.x,y:instance.y};}
  const document={querySelector(selector){check('dom');events.push(['dom',selector]);return{classList:{contains:()=>state.visible},getAttribute:()=>state.pressed};}};
  function getComputedStyle(){assert.equal(this,undefined);check('css');return{backgroundColor:state.background};}
  function serializeModel(){assert.equal(this,undefined);check('serialize');return{sketches:state.scope.sketches.map(s=>({id:s.id,appearance:{visible:s.visible!==false}}))};}
  function resetModelState(){assert.equal(this,undefined);check('reset');state.scope=w.DocumentState.create();documentModel.blockDefinitions=[];ids.reset();state.id=0;events.push('reset');}
  const input={documentWorkspace,geometry,readServices,interaction,presentation,sketchPresentation,overlay,viewport,canvasDriver,drawingFit,blocks,dimensionDisplay,referenceState,
    document,canvas,getComputedStyle,serializeModel,resetModelState,addDistanceConstraintFromTarget,dimensionLayout,blockInstanceDisplayCenter};
  const api=composed?w.SketchTreeTestDriver.createForWorkspace(input):w.SketchTreeTestDriver.createBrowserApi({
    resetModelState,sketchById:sketches.sketchById,defaultSketchId:w.SketchHierarchy.DEFAULT_SKETCH_ID,currentScope:current,rootSketchId:w.SketchHierarchy.ROOT_SKETCH_ID,
    addPoint:geometry.addPoint,addLine:geometry.addLine,addCircle:geometry.addCircle,addArc:geometry.addArc,refreshReferenceConstraintValidity:referenceState.refreshReferenceConstraintValidity,
    fitAllGeometryToViewport:drawingFit.fitAllGeometryToViewport,updateUI:presentation.updateUI,draw:presentation.draw,canvas,worldToCanvasScreen:viewport.worldToCanvasScreen,
    sketchRelationToActive:sketches.sketchRelationToActive,sketchIdentityRelationLabel:overlay.sketchIdentityRelationLabel,sketchIdentityRelationColor:overlay.sketchIdentityRelationColor,
    document,getComputedStyle,isVisibleSketchId:readServices.geometryAppearance.isVisibleSketchId,serializeModel,sketchStrokeWidth:sketchPresentation.sketchStrokeWidth,
    constraintStatusColor:sketchPresentation.constraintStatusColor,activeSketchId:sketches.activeSketchId,addDistanceConstraintFromTarget,dimensionFromAnchor:dimensionDisplay.placement.dimensionFromAnchor,
    isDimensionConstraint:w.DimensionQueries.isDimensionConstraint,createEmptyBlockDefinition:blocks.editing.empty,Point:w.GeometrySolver.Point,Line:w.GeometrySolver.Line,
    appendDefinition:definition=>documentModel.blockDefinitions.push(definition),nextInstanceId:()=>documentIds.allocate('blockInstance'),invalidateBlockProjectionCache:projections.invalidateBlockProjectionCache,
    viewport,dimensionLayout,targetFromConstraint:w.DimensionQueries.targetFromConstraint,clientPosition:canvasDriver.clientPosition,blockInstanceDisplayCenter,canvasHover:hover,blockProjectionBundle:projections.blockProjectionBundle});
  assert.deepEqual(events,[]);return{state,events,api,marker,documentModel,hover,viewport,sketches,
    snapshot(){return JSON.parse(JSON.stringify({events,scope:state.scope,definitions:documentModel.blockDefinitions,viewport:viewport.snapshot()}));}};
}

test('Sketch Tree workspace test API stays cold, keeps all eight ordered entries and reads replacement Sketch, visibility and hover state live',()=>{
  const run=composed=>{const f=fixture(composed);assert.ok(Object.isFrozen(f.api));const keys=Object.keys(f.api);assert.equal(keys.length,8);
    const first=f.api.sketchVisibilityState('S1');assert.equal(first.effectiveVisible,true);f.state.scope=w.DocumentState.create();Object.assign(f.state.scope.sketches.find(s=>s.id==='S1'),{visible:false,appearance:{visible:false}});f.state.visible=false;f.state.pressed='false';
    const second=f.api.sketchVisibilityState('S1');assert.equal(second.preferenceVisible,false);assert.equal(second.serializedVisible,false);assert.equal(second.buttonPressed,'false');
    f.hover.current={sketchIdentity:{kind:'line',id:'L1',sketchId:'S1'},dimension:{name:'D1'},block:{id:'BI1'}};const identity=f.api.hoverIdentityStateForTest();assert.equal(identity.id,'L1');assert.equal(identity.hoveredDimension,'D1');
    return JSON.parse(JSON.stringify({keys,first,second,identity,events:f.events}));};assert.deepEqual(run(true),run(false));
});

test('Sketch Tree fixture assembly keeps actual Geometry and Sketch ownership, root Document definitions, coordinates, relations and live styling',()=>{
  const run=composed=>{const f=fixture(composed),subtree=f.api.resetForSiblingSubtreeReference();assert.equal(subtree.relations.S2,f.sketches.sketchRelationToActive('S2'));
    f.state.width=3;f.state.color='orange';const sibling=f.api.resetForSiblingVisibility();assert.equal(sibling.strokeWidth,3);assert.equal(sibling.color,'orange');
    const root=f.api.resetForRootSketchTreeHoverTest();assert.equal(f.documentModel.blockDefinitions.length,1);assert.equal(f.state.scope.blockDefinitions.length,0);assert.ok(f.state.scope.lines[0] instanceof w.GeometrySolver.Line);
    const block=f.api.resetForSketchTreeBlockHoverTest(),inactive=f.api.resetForInactiveDimensionAndBlockHover();
    return JSON.parse(JSON.stringify({subtree,sibling,root,block,inactive,state:f.snapshot()}));};assert.deepEqual(run(true),run(false));
});

test('Sketch Tree workspace support propagates reader, display and fixture failures with the same partially built model',()=>{
  for(const failure of ['scope','reset','references','fit','ui','draw','rect','dom','css','visible','label','style','projection','client','layout','serialize']){
    const run=composed=>{const f=fixture(composed,failure);const operation=failure==='serialize'?()=>f.api.sketchVisibilityState('S1'):failure==='style'?()=>f.api.resetForSiblingVisibility():
      failure==='projection'?()=>f.api.resetForSketchTreeBlockHoverTest():['client','layout'].includes(failure)?()=>f.api.resetForInactiveDimensionAndBlockHover():()=>f.api.resetForSiblingSubtreeReference();
      assert.throws(operation,error=>error===f.marker);return f.snapshot();};assert.deepEqual(run(true),run(false),failure);
  }
});
