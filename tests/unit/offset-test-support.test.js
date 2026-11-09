const assert = require('node:assert/strict'); const fs = require('node:fs');
const path = require('node:path'); const vm = require('node:vm'); const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/offset_test_driver.js'), 'utf8'), sandbox);
function fixture() {
  const calls = [], state = { scope: { constraints: [], lines: [] } };
  class OffsetConstraint {} class OffsetChainConstraint {} class Line {}
  const selection = { source: null, entries: [], committed: false };
  const pending = { current: null };
  const ports = { currentScope: () => { calls.push('scope'); return state.scope; }, OffsetConstraint, OffsetChainConstraint, Line,
    offsetSelection: selection, pendingCommandSession: pending, drawingPreview: { pointer: null },
    document: { getElementById: () => ({ classList: { contains: () => false } }) },
    serializeModel: () => { calls.push('serialize'); return { version: 26, constraints: [] }; },
    loadModelData: data => { calls.push(['load', data]); state.scope = { constraints: [Object.assign(new OffsetChainConstraint(), { target: 12, sources: [{}], offsets: [{}, {}], sourceReversed: [true] })], lines: [] }; return true; },
  };
  const support = sandbox.window.OffsetTestDriver.createSupport(ports);
  assert.deepEqual(calls, []);
  return { support, state, calls, ports, selection, pending, OffsetConstraint, OffsetChainConstraint };
}

test('Offset support publishes the same ordered nine entry points and reads live owners without eager work', () => {
  const f = fixture();
  assert.deepEqual(Object.keys(f.support), ['resetForOffsetConstraints', 'resetForOffsetUi', 'offsetUiState', 'resetForOffsetDirection', 'resetForOffsetChainUi', 'offsetChainUiState', 'roundTripOffsetChainForTest', 'updateOffsetChainTargetForTest', 'canReselectOffsetResultChainForTest']);
  assert.equal(Object.isFrozen(f.support), true); for (const fn of Object.values(f.support)) assert.equal(typeof fn, 'function');
  assert.equal(f.support.offsetUiState().lineCount, 0);
  f.state.scope = { lines: [{}, {}], constraints: [Object.assign(new f.OffsetConstraint(), { target: 7 })] };
  f.pending.current = { type: 'offset-value' };
  const ui = f.support.offsetUiState(); assert.equal(ui.lineCount, 2); assert.equal(ui.constraintCount, 1); assert.equal(ui.targets[0], 7); assert.equal(ui.pendingType, 'offset-value');
  f.selection.entries = [{}]; f.selection.committed = true;
  const chain = f.support.offsetChainUiState(); assert.equal(chain.selectedCount, 1); assert.equal(chain.selectionCommitted, true); assert.equal(chain.jsonVersion, 26);
});

test('Offset support routes reload and UI fixture creation to their existing owners', () => {
  const f = fixture(), result = f.support.roundTripOffsetChainForTest();
  assert.equal(result.loaded, true); assert.equal(result.count, 1); assert.equal(result.target, 12); assert.equal(result.offsetCount, 2);
  assert.deepEqual(f.calls.slice(0, 2).map(value => Array.isArray(value) ? value[0] : value), ['serialize', 'load']);
  const calls = [], ports = {
    resetModelState: () => calls.push('reset'), addPoint: (x,y) => ({ x,y }), addLine: (a,b) => calls.push(['line',a.x,b.x]),
    fitAllGeometryToViewport: padding => calls.push(['fit',padding]), draw: () => calls.push('draw'),
    canvas: { getBoundingClientRect: () => ({ left: 10, top: 20 }) }, worldToCanvasScreen: point => point,
  };
  const support = sandbox.window.OffsetTestDriver.createSupport(ports);
  assert.deepEqual(calls, []); const points = support.resetForOffsetUi();
  assert.equal(points.source.x, 10); assert.equal(points.side.y, 55);
  assert.deepEqual(calls, ['reset', ['line', -60, 60], ['fit',220], 'draw']);
});

function workspaceSupportFixture(composed) {
 const env={window:{},structuredClone};vm.createContext(env);
 const sources=vm.runInNewContext(fs.readFileSync('index.html','utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
 for(const file of sources.filter(p=>p.startsWith('src/')))vm.runInContext(fs.readFileSync(file,'utf8'),env,{filename:file});
 const w=env.window,g=w.GeometrySolver,state={ready:false,scale:2,failAt:null,error:null,active:false},events=[],reads=[],ids=w.GeometryIds.create();
 const ready=()=>assert.equal(state.ready,true,'no eager Offset owner read'),stage=name=>{ready();events.push(name);if(state.failAt===name)throw state.error;};
 function setModel(model){state.model=model;state.editing={...model,view:'editing'};}
 const empty=()=>Object.assign(w.DocumentState.create(),{activeSketchId:'S1'});setModel(empty());
 const current=()=>{ready();reads.push('workspace');return state.model;},activeSketchId=()=>{ready();return state.model.activeSketchId;};
 const geometry=w.GeometryCreation.create({currentScope:current,ids,assignSketchId:item=>{ready();item.sketchId=state.model.activeSketchId;},currentConstruction:()=>false,minLineLength:0.01,minArcLength:0.01});
 const selection=w.CanvasSelection.create(),pending=w.PendingCommandSession.create({}),preview={pointer:null,setPointer(value){assert.equal(this,preview);this.pointer=value;}};
 let sourceSelection;sourceSelection=w.OffsetSelection.create({...g,getModel:current,activeSketchId,elementSketchId:item=>item.sketchId,constraintSketchId:item=>item.sketchId,
  onSelectionChanged:()=>selection.applyOffsetSelection(sourceSelection)});
 function push(constraint){'use strict';assert.equal(this,undefined);stage('push');constraint.sketchId=activeSketchId();state.model.constraints.push(constraint);}
 const viewport={get scale(){ready();return state.scale;},worldToCanvasScreen(point){'use strict';assert.equal(this,undefined);ready();return{x:point.x*state.scale,y:point.y*state.scale};}};
 const noop=()=>{},offset=w.OffsetFeature.create({currentScope:()=>{ready();reads.push('editing');return state.editing;},geometry,ids,
  placement:{dimensionWithLabelAt:(_target,dimension,pointer)=>({...dimension,x:pointer.x,y:pointer.y}),dimensionFromAnchor:()=>({anchor:true})},
  sourceSelection,selection,pending,preview,valueInput:{sync:noop,focus:noop,hide:noop},viewport,ctx:{},withCanvasState:work=>work(),drawDimension:noop,readMode:()=> 'offset',
  minLineLength:0.01,minArcLength:0.01,commitNewConstraint:(_type,constraint)=>{push(constraint);return true;},offsetChainErrorText:plan=>plan.code,applicationText:(_ja,en)=>en,
  cancelConstraintTargetCommand:noop,cancelPendingCommand:noop,clearSnap:noop,clearSelection:selection.clear,prepareStart:noop,setHint:noop,updateUI:noop,draw:noop,
  updateToolbar:noop,updateGeometrySelectionUI:noop,invalidateAnalysis:noop});
 const snapshot={kind:'checkpoint'};
 function capture(){'use strict';assert.equal(this,undefined);stage('capture');return snapshot;}
 function prepare(constraint,index,all){'use strict';assert.equal(this,undefined);stage('prepare');assert.ok(constraint instanceof g.OffsetConstraint);assert.equal(all[index],constraint);}
 function solve(id,value){'use strict';assert.equal(this,undefined);stage('solve');assert.equal(id,activeSketchId());assert.equal(value,snapshot);}
 let saved,model;
 const resetModelState=()=>{stage('reset');setModel(empty());ids.reset();sourceSelection.reset();selection.clear();pending.replace(null);preview.setPointer(null);};
 const serializeModel=()=>{stage('serialize');model=state.model;return saved={version:26,constraints:model.constraints.map(c=>({type:c instanceof g.OffsetConstraint?'offsetDimension':c.constructor.name,target:c.target}))};};
 const loadModelData=data=>{stage('load');assert.equal(data,saved);setModel({...model});return true;};
 const draw=()=>stage('draw'),canvas={getBoundingClientRect(){assert.equal(this,canvas);ready();return{left:10,top:20};}},
  document={getElementById(){assert.equal(this,document);ready();return{classList:{contains:()=>state.active}};}};
 const options={resetModelState,serializeModel,loadModelData,clearSelection:selection.clear,fitAllGeometryToViewport:padding=>{stage('fit');assert.ok(padding>0);},
  resetHistory:()=>stage('history'),solveAndRefresh:()=>stage('refresh'),canvas,document};
 const owners={documentWorkspace:{workspace:{current},sketches:{activeSketchId}},geometry,insertion:{push},offset,sourceSelection,
  solvePreparation:{precondition:prepare},solving:{solveSketchAndDependents:solve},checkpoint:{captureValues:capture},sessions:{pending,preview},presentation:{draw},viewport};
 const support=composed?w.OffsetTestDriver.createForWorkspace({...options,...owners}):w.OffsetTestDriver.createSupport({...options,
  addPoint:geometry.addPoint,addLine:geometry.addLine,addCircle:geometry.addCircle,addArc:geometry.addArc,pushModelConstraint:push,currentScope:current,
  RadiusConstraint:g.RadiusConstraint,OffsetConstraint:g.OffsetConstraint,OffsetChainConstraint:g.OffsetChainConstraint,HorizontalConstraint:g.HorizontalConstraint,VerticalConstraint:g.VerticalConstraint,Line:g.Line,
  createOffsetGeometry:offset.createGeometry,preconditionNewConstraint:prepare,solveSketchAndDependents:solve,activeSketchId,snapshotModelState:capture,
  targetFromConstraint:w.DimensionQueries.targetFromConstraint,measuredConstraintTargetValue:w.DimensionQueries.measuredConstraintTargetValue,
  offsetSelection:sourceSelection,drawingPreview:preview,offsetDistanceFromPointer:offset.plans.offsetDistanceFromPointer,pendingCommandSession:pending,addOffsetChainGeometry:sourceSelection.add,
  draw,worldToCanvasScreen:viewport.worldToCanvasScreen});
 assert.deepEqual(events,[]);assert.deepEqual(reads,[]);state.ready=true;
 return{support,owners,options,state,events,reads,w,g,geometry,selection,sourceSelection,pending,preview,ids};
}

test('workspace Offset support creates the same nine operations cold and delegates actual primitive construction, checkpoint and reload in order',()=>{
 const results=[];
 for(const composed of [false,true]){
  const f=workspaceSupportFixture(composed);assert.equal(Object.isFrozen(f.support),true);assert.equal(Object.keys(f.support).length,9);
  const result=f.support.resetForOffsetConstraints();assert.equal(result.restoredCount,3);assert.deepEqual(Array.from(result.restoredTargets),[25,18,12]);
  assert.equal(f.state.model.constraints.filter(c=>c instanceof f.g.OffsetConstraint).length,3);
  assert.ok(f.reads.includes('workspace'));assert.ok(f.reads.includes('editing'));assert.notEqual(f.state.model,f.state.editing);
  const tail=f.events.filter(name=>['prepare','capture','solve','serialize','load','fit','draw'].includes(name));
  assert.deepEqual(tail,['prepare','prepare','prepare','capture','solve','serialize','load','fit','draw','serialize']);
  results.push(JSON.stringify({result,tail,ids:f.ids.snapshot()}));
 }assert.equal(results[1],results[0]);
});

test('workspace Offset support retains live Workspace, selection, pointer, pending and viewport independently of the construction view',()=>{
 const results=[];
 for(const composed of [false,true]){
  const f=workspaceSupportFixture(composed);const first=f.support.resetForOffsetUi();assert.equal(first.side.y,90);f.state.scale=3;
  const next=f.support.resetForOffsetDirection('horizontal');assert.equal(f.state.model.constraints[0] instanceof f.g.HorizontalConstraint,true);
  const source=f.state.model.lines[0];f.sourceSelection.add(source);f.preview.setPointer({x:0,y:6});f.pending.replace({type:'offset-value'});f.state.active=true;
  const offset=f.geometry.addLine(f.geometry.addPoint(60,4,false,'endpoint'),f.geometry.addPoint(-60,4,false,'endpoint'));
  f.state.model.constraints.push(new f.g.OffsetConstraint(source,offset,7,1));f.state.editing.lines=[...f.state.model.lines,{id:'view-only'}];
  const observation=f.support.offsetUiState();assert.equal(observation.lineCount,2);assert.equal(observation.constraintCount,1);assert.equal(observation.targets[0],7);assert.equal(observation.pendingType,'offset-value');
  assert.equal(observation.toolActive,true);assert.equal(observation.previewDistance,6);assert.equal(f.support.offsetChainUiState().selectedCount,1);
  f.options.resetModelState();const cleared=f.support.offsetUiState();assert.equal(cleared.lineCount,0);assert.equal(cleared.pendingType,null);
  results.push(JSON.stringify({first,next,observation,cleared}));
 }assert.equal(results[1],results[0]);
});

test('workspace Offset support propagates original preparation, capture, solve and load failures without later effects or hidden rollback',()=>{
 for(const composed of [false,true])for(const failAt of ['prepare','capture','solve','load']){
  const f=workspaceSupportFixture(composed),error=new Error(failAt);f.state.failAt=failAt;f.state.error=error;
  assert.throws(()=>f.support.resetForOffsetConstraints(),value=>value===error);
  assert.equal(f.events.at(-1),failAt);assert.equal(f.state.model.constraints.filter(c=>c instanceof f.g.OffsetConstraint).length,3);
  assert.deepEqual(Array.from(f.state.model.constraints.filter(c=>c instanceof f.g.OffsetConstraint),c=>c.target),[25,18,12]);
  assert.equal(f.events.includes('fit'),false);assert.equal(f.events.includes('draw'),false);
 }
});
