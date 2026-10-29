const assert = require('node:assert/strict'); const fs = require('node:fs');
const path = require('node:path'); const vm = require('node:vm'); const test = require('node:test');
const sandbox = { window: {}, structuredClone }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/annotation_test_driver.js'), 'utf8'), sandbox);
function fixture() {
  const calls = [], state = { scope: { annotations: [] }, drag: {}, hit: { type: 'leader', part: 'body' } };
  const ports = { currentScope: () => { calls.push('scope'); return state.scope; }, canvas: { getBoundingClientRect: () => ({ left: 10, top: 20 }) },
    worldToCanvasScreen: point => ({ x: point.x*2, y: point.y*2 }), screenToWorld: point => ({ x: point.x/2, y: point.y/2 }),
    annotationLeaderDisplayGeometry: item => item,
    hitAnnotationElement: (x,y) => { calls.push(['hit',x,y]); return state.hit; }, readDragState: () => state.drag,
    resetModelState: () => { state.scope = { annotations: [] }; calls.push('reset'); }, addPoint: (x,y) => ({x,y}), addLine: (p1,p2) => ({p1,p2}),
    annotationLeaderTargetFromItem: () => ({ anchor: {x:0,y:35}, geometryRef: { id: 'L3' } }),
    pushAnnotation: item => { state.scope.annotations.push(item); calls.push(['annotation',item.type]); },
    defaultStyle: Object.freeze({ fontSize: 10 }), resizeCanvas: options => calls.push(['resize',options.centerWorld.x,options.centerWorld.y]),
  };
  const support = sandbox.window.AnnotationTestDriver.createSupport(ports); assert.deepEqual(calls, []);
  return { support, state, calls, ports };
}

test('Annotation test groups preserve the legacy seven names, lazy reads and coordinate/drag queries', () => {
  const f = fixture();
  const api = { ...f.support.fixtures, ...f.support.observations, ...f.support.interaction };
  assert.deepEqual(Object.keys(api), ['resetForAnnotationDrag', 'annotationSnapshot', 'annotationDimensionStateForTest', 'annotationAppearanceStateForTest', 'annotationOwnershipStateForTest', 'annotationHitAt', 'annotationDragActive']);
  for (const value of Object.values(api)) assert.equal(typeof value, 'function');
  for (const group of Object.values(f.support)) assert.equal(Object.isFrozen(group), true);
  assert.equal(api.annotationDragActive(), f.state.drag); f.state.drag = { changed: true }; assert.equal(api.annotationDragActive(), f.state.drag);
  const hit = api.annotationHitAt({ x:30, y:60 }); assert.equal(hit.type, 'leader'); assert.equal(hit.part, 'body');
  assert.deepEqual(f.calls, [['hit',10,20]]); f.state.hit = null; assert.equal(api.annotationHitAt({x:10,y:20}), null);
  f.state.scope = { annotations: [{ type:'text', x:3, y:4 }] };
  const snapshot = api.annotationSnapshot(); assert.equal(snapshot.text.world.x, 3); assert.equal(snapshot.text.viewport.y, 28);
});

test('Annotation drag fixture uses the same shared live snapshot and leaves the style template unchanged', () => {
  const f = fixture(), snapshot = f.support.fixtures.resetForAnnotationDrag();
  assert.equal(snapshot.leader.viewport.x, 234); assert.equal(snapshot.text.viewport.x, -170);
  assert.equal(f.state.scope.annotations.length, 2);
  assert.equal(f.state.scope.annotations[0].style.fontSize, 10); assert.notEqual(f.state.scope.annotations[0].style, f.ports.defaultStyle);
  assert.deepEqual(f.calls.slice(0,4), ['reset', ['annotation','leader'], ['annotation','text'], ['resize',20,20]]);
  f.state.scope.annotations[0].end.x = 130;
  assert.equal(f.support.observations.annotationSnapshot().leader.world.x, 130);
});

function featureFixture() {
 const local={window:{},structuredClone};vm.createContext(local);
 const sources=vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
 for(const file of sources.filter(p=>p.startsWith('src/')))vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../..',file),'utf8'),local);
 const w=local.window,state={ready:false,scope:{annotations:[],points:[],lines:[]},seq:0,drag:{},hit:{type:'text',part:'body'},hitFailure:null,layoutFailure:null,dimensions:[]},calls=[];
 const read=()=>{assert.equal(state.ready,true,'no eager scope read');return state.scope;};
 const canvas={getBoundingClientRect:()=>({left:10,top:20,width:400,height:300})};
 const viewport=w.CanvasViewport.create({canvasRect:canvas.getBoundingClientRect,initialScale:2,minZoom:0.1,maxZoom:20,minLength:0.01});
 const selection=w.CanvasSelection.create(),ctx={save(){},restore(){},measureText:text=>({width:text.length*5})};
 const style=item=>{read();return w.Appearance.normalizeAnnotationStyle(item.style);},anchor=item=>item.start;
 const renderer=w.AnnotationRenderer.create({ctx,viewport,withCanvasState:work=>work(),annotationDisplayColor:()=>'',annotationLeaderAnchor:anchor,appearanceLineDash:()=>[],formatValue:w.NumberDisplay.formatDisplayNumber,effectiveAnnotationStyle:style});
 const feature={renderer,dimensions:{entries:()=>{read();return state.dimensions;}},command:{pushAnnotation:item=>{item.id='A'+(++state.seq);read().annotations.push(item);calls.push(['annotation',item.type]);}}};
 const geometry={addPoint:(x,y,fixed,kind)=>{const p=new w.GeometrySolver.Point('P'+(++state.seq),x,y,fixed,kind);read().points.push(p);return p;},
  addLine:(a,b)=>{const line=new w.GeometrySolver.Line('L'+(++state.seq),a,b);read().lines.push(line);return line;}};
 const dimensionDisplay={layout(){assert.equal(this,dimensionDisplay);if(state.layoutFailure)throw state.layoutFailure;return {};}};
 const dragOwner={inspect(){assert.equal(this,dragOwner);read();return state.drag;}};
 const support=w.AnnotationTestDriver.createForFeature({feature,geometry,readServices:{dimensionAppearance:{effectiveDimensionAppearance:()=>({})},annotationAppearance:{effectiveAnnotationStyle:style},reads:{allAnnotations:()=>read().annotations}},
  dimensionDisplay,dimensionLabelForConstraint:()=>'',currentScope:read,viewport,canvas,selection,drag:dragOwner,
  annotationLeaderAnchor:anchor,annotationLeaderTargetFromItem:line=>({anchor:{x:0,y:35},geometryRef:{id:line.id}}),draw:()=>calls.push('draw'),allGeometryBounds:()=>({}),
  resetModelState:()=>{read();state.scope={annotations:[],points:[],lines:[]};state.seq=0;calls.push('reset');},resizeCanvas:()=>calls.push('resize'),
  hitAnnotationElement:(x,y)=>{read();calls.push(['hit',x,y]);if(state.hitFailure)throw state.hitFailure;return state.hit;}});
 assert.deepEqual(calls,[]);state.ready=true;
 return {w,state,calls,support,viewport,selection,feature,dragOwner};
}

test('feature-based Annotation support shares real rendering, viewport, selection and the original fixture groups without eager reads',()=>{
 const f=featureFixture();assert.deepEqual(Object.keys(f.support.fixtures),['resetForAnnotationDrag']);assert.deepEqual(Object.keys(f.support.observations),['annotationSnapshot','annotationDimensionStateForTest','annotationAppearanceStateForTest','annotationOwnershipStateForTest']);
 const snapshot=f.support.fixtures.resetForAnnotationDrag();assert.equal(f.state.scope.annotations.length,2);assert.equal(f.state.scope.points.length,4);assert.equal(f.state.scope.lines.length,4);
 assert.deepEqual(f.calls.slice(0,4),['reset',['annotation','leader'],['annotation','text'],'resize']);assert.equal(snapshot.text.world.x,-90);
 const text=f.state.scope.annotations[1];f.selection.set('annotations',[text]);
 const appearance=f.support.observations.annotationAppearanceStateForTest('text',4);assert.equal(f.viewport.scale,4);assert.equal(appearance.displayedText,'自由テキスト');assert.ok(appearance.screenTextHeight>0);
 const ownership=f.support.observations.annotationOwnershipStateForTest();assert.equal(ownership.selectedIds[0],text.id);assert.equal(ownership.direct.length,2);
 text.x=123;assert.equal(f.support.observations.annotationSnapshot().text.world.x,123);
 assert.equal(f.support.interaction.annotationDragActive(),f.state.drag);f.state.drag={kind:'move'};assert.equal(f.support.interaction.annotationDragActive(),f.state.drag);
 f.state.scope={annotations:[],points:[],lines:[]};assert.equal(f.support.observations.annotationAppearanceStateForTest('text'),null);
});

test('feature-based Annotation support retains the explicit selection-aware hit callback and propagates its original failure',()=>{
 const f=featureFixture(),point={x:30,y:60};const expected=f.viewport.screenToWorld({x:20,y:40});
 const hit=f.support.interaction.annotationHitAt(point);assert.equal(hit.type,'text');assert.deepEqual(f.calls,[['hit',expected.x,expected.y]]);
 const marker=new Error('hit policy failed');f.state.hitFailure=marker;assert.throws(()=>f.support.interaction.annotationHitAt(point),error=>error===marker);
 const c=new f.w.GeometrySolver.DistanceConstraint(new f.w.GeometrySolver.Point('P1',0,0),new f.w.GeometrySolver.Point('P2',10,0),10);c.annotationOwner={id:'A1'};c.annotationRelation={type:'distance'};c.dimension={};f.state.dimensions=[c];
 assert.equal(f.support.observations.annotationDimensionStateForTest()[0].annotationId,'A1');f.state.layoutFailure=marker;assert.throws(()=>f.support.observations.annotationDimensionStateForTest(),error=>error===marker);
 assert.equal(f.viewport.scale,2);assert.equal(f.state.scope.annotations.length,0);
});
