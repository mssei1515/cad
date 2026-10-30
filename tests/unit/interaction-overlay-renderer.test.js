const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/rendering/interaction_overlay_renderer.js'), 'utf8'), sandbox);
function fixture() {
  const calls=[],ctx={},relations={ref:'reference',child:'descendant',other:'inactive',active:'active'};
  for(const name of ['save','restore','beginPath','moveTo','lineTo','stroke','fill','arc','fillRect','strokeRect','fillText','setLineDash'])ctx[name]=(...args)=>calls.push([name,...args]);
  ctx.measureText=text=>({width:text.length*5});
  const selection={points:[],lines:[],circles:[],arcs:[],splines:[]};
  const f={calls,ctx,selection,viewport:{scale:2},language:'en',active:'active'};
  f.renderer=sandbox.window.InteractionOverlayRenderer.create({ctx,viewport:f.viewport,withCanvasState:work=>{ctx.save();try{return work();}finally{ctx.restore();}},elementSketchId:item=>item.sketchId,
    sketchRelationToActive:id=>relations[id],applicationText:(ja,en)=>f.language==='en'?en:ja,
    isVisibleSketchId:id=>id!=='hidden',activeSketchId:()=>f.active,sketchName:id=>'Sketch '+id});
  f.draw=(hoveredIdentity=null,pointer={x:10,y:20})=>f.renderer.drawSketchIdentityLabel({hoveredIdentity,selection,pointer});
  return f;
}
test('snap marker scales its crosshair and places point labels below other snap labels',()=>{
  const f=fixture();f.renderer.drawSnapMarker(null);assert.equal(f.calls.length,0);
  f.renderer.drawSnapMarker({x:10,y:20,label:'snap',priority:0});
  assert.deepEqual(f.calls.find(c=>c[0]==='moveTo'),['moveTo',7,20]);
  assert.deepEqual(f.calls.find(c=>c[0]==='fillText'),['fillText','snap',14,30]);
  f.calls.length=0;f.renderer.drawSnapMarker({x:10,y:20,label:'line',priority:1});
  assert.deepEqual(f.calls.find(c=>c[0]==='fillText'),['fillText','line',14,16]);
  f.calls.length=0;f.renderer.drawSnapMarker({x:10,y:20,label:'point',priority:1,data:{point:{}}});
  assert.equal(f.calls.find(c=>c[0]==='fillText')[3],30);
});
test('Sketch identity prefers hovered identity then arc endpoint then the last point',()=>{
  const f=fixture();f.selection.points.push({id:'P1',sketchId:'ref'},{id:'P2',sketchId:'ref'});
  f.selection.lines.push({id:'L1',sketchId:'other'});f.draw();
  assert.equal(f.calls.find(c=>c[0]==='fillText')[1],'P2 / Sketch ref');
  f.calls.length=0;f.selection.arcEndpoint={arc:{id:'A1',sketchId:'child'},endpoint:'start'};f.draw();
  assert.equal(f.calls.find(c=>c[0]==='fillText')[1],'A1端点 / Sketch child');
  f.calls.length=0;f.draw({id:'B1',label:'Block',sketchId:'other'});
  assert.equal(f.calls.find(c=>c[0]==='fillText')[1],'Block / Sketch other');
  assert.equal(f.selection.points.length,2);
});
test('missing pointer, hidden or active identity suppresses overlay including selection fallback',()=>{
  const f=fixture();f.selection.points.push({id:'P1',sketchId:'ref'});
  f.draw(null,null);f.draw({id:'X',sketchId:'hidden'});f.draw({id:'X',sketchId:'active'});
  assert.equal(f.calls.length,0);
  f.active='ref';f.draw();assert.equal(f.calls.length,0);
});

test('read-only selection keeps owning sketch and editability visible after hover leaves the object', () => {
  const f = fixture();
  f.selection.inspection = { sketchId: 'other', targets: [{ item: { id: 'L1' }, kind: 'geometry', category: 'line' }] };
  f.draw(null, { x: 100, y: 200 });
  assert.equal(f.calls.find(c => c[0] === 'fillText')[1], 'L1 / Sketch other');
  assert.match(f.calls.filter(c => c[0] === 'fillText').at(-1)[1], /Other sketch/);
  assert.equal(f.selection.lines.length, 0);
});
test('relation labels and colors use current language and retain distinct reference and descendant states',()=>{
  const f=fixture();assert.equal(f.renderer.sketchIdentityRelationLabel('ref'),'Reference available');
  assert.equal(f.renderer.sketchIdentityRelationColor('ref'),'#1d4ed8');
  assert.equal(f.renderer.sketchIdentityRelationColor('child'),'#b91c1c');
  assert.equal(f.renderer.sketchIdentityRelationLabel('active'),'');
  f.language='ja';assert.equal(f.renderer.sketchIdentityRelationLabel('child'),'参照不可（子孫）');
  f.draw({id:'X',sketchId:'child'});
  assert.equal(f.calls.filter(c=>c[0]==='fillText').at(-1)[1],'別スケッチ / 参照不可（子孫）');
  assert.equal(f.ctx.fillStyle,'#b91c1c');assert.equal(f.calls.at(-1)[0],'restore');
});

test('selection rectangle paints crossing/enclosing states at current zoom, preserves input and skips absent preview', () => {
  const calls = [], ctx = {}, viewport = { scale: 2 };
  for (const name of ['setLineDash', 'fillRect', 'strokeRect']) ctx[name] = (...args) => calls.push([name, ...args]);
  const renderer = sandbox.window.InteractionOverlayRenderer.create({ ctx, viewport,
    withCanvasState: callback => { calls.push(['enter']); callback(); calls.push(['exit']); } });
  renderer.drawSelectionRect(null); assert.equal(calls.length, 0);
  const preview = { rect: { x1: 10, y1: 20, x2: 40, y2: 60 }, crossing: true }, before = JSON.stringify(preview);
  renderer.drawSelectionRect(preview); assert.equal(ctx.strokeStyle, '#f59e0b'); assert.equal(ctx.fillStyle, 'rgba(245, 158, 11, 0.08)'); assert.equal(ctx.lineWidth, 0.6);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['enter'], ['setLineDash', [2.5, 2]], ['fillRect', 10, 20, 30, 40], ['strokeRect', 10, 20, 30, 40], ['exit']]);
  assert.equal(JSON.stringify(preview), before);
  calls.length = 0; viewport.scale = 4; preview.crossing = false; renderer.drawSelectionRect(preview);
  assert.equal(ctx.strokeStyle, '#2563eb'); assert.equal(ctx.fillStyle, 'rgba(37, 99, 235, 0.08)'); assert.equal(ctx.lineWidth, 0.3);
  assert.equal(JSON.stringify(calls[1]), '["setLineDash",[1.25,1]]');
});

function layerFor(composed, {renderer,rectangle,snap,hover,selection,pointer}) {
  return composed ? sandbox.window.InteractionOverlayRenderer.createLayer({renderer,rectangle,snap,hover,selection,pointer}) : {
    drawSelectionRect() { return renderer.drawSelectionRect(rectangle.preview()); },
    drawSnapMarker() { renderer.drawSnapMarker(snap.active); },
    drawSketchIdentityLabel() { renderer.drawSketchIdentityLabel({hoveredIdentity:hover.current.sketchIdentity,selection,pointer:pointer.lastWorld}); },
  };
}

function observedLayer(composed) {
  const events=[],observed=[],token=Symbol('renderer result'),error=new Error('overlay failure');
  const state={ready:false,preview:{id:'rectangle'},snap:{id:'snap'},identity:{id:'identity'},pointer:{x:1,y:2},failAt:null};
  const visit=(name,value)=>{assert.equal(state.ready,true,'construction must not read live owners');events.push(name);if(state.failAt===name)throw error;return value;};
  const renderer={};for(const name of ['rectangle','snap','identity']){
    const method={rectangle:'drawSelectionRect',snap:'drawSnapMarker',identity:'drawSketchIdentityLabel'}[name];
    Object.defineProperty(renderer,method,{get(){visit(name+':method');return function(value){assert.equal(this,renderer);observed.push([name,value]);visit(name+':paint');return token;};}});
  }
  const rectangle={get preview(){visit('preview:get');return function(){assert.equal(this,rectangle);return visit('preview:call',state.preview);};}},
    snap={get active(){assert.equal(this,snap);return visit('snap:read',state.snap);}},
    hovered={get sketchIdentity(){return visit('identity:read',state.identity);}},
    hover={get current(){assert.equal(this,hover);return visit('hover:read',hovered);}},
    pointer={get lastWorld(){assert.equal(this,pointer);return visit('pointer:read',state.pointer);}},selection={points:[]};
  const layer=layerFor(composed,{renderer,rectangle,snap,hover,selection,pointer});assert.deepEqual(events,[]);state.ready=true;
  return {layer,state,events,observed,token,error,selection};
}

test('overlay layer defers all owner reads and retains member receivers, returns and live input identities',()=>{
  for(const composed of [false,true]){
    const f=observedLayer(composed);assert.equal(f.layer.drawSelectionRect(),f.token);assert.equal(f.layer.drawSnapMarker(),undefined);assert.equal(f.layer.drawSketchIdentityLabel(),undefined);
    assert.deepEqual(f.events,['rectangle:method','preview:get','preview:call','rectangle:paint','snap:method','snap:read','snap:paint','identity:method','hover:read','identity:read','pointer:read','identity:paint']);
    assert.equal(f.observed[0][1],f.state.preview);assert.equal(f.observed[1][1],f.state.snap);
    assert.equal(f.observed[2][1].hoveredIdentity,f.state.identity);assert.equal(f.observed[2][1].selection,f.selection);assert.equal(f.observed[2][1].pointer,f.state.pointer);
    f.state.preview={id:'next rectangle'};f.state.snap=null;f.state.identity={id:'next identity'};f.state.pointer={x:8,y:9};f.selection.points.push({id:'P1'});
    f.layer.drawSelectionRect();f.layer.drawSnapMarker();f.layer.drawSketchIdentityLabel();
    assert.equal(f.observed[3][1],f.state.preview);assert.equal(f.observed[4][1],null);assert.equal(f.observed[5][1].selection.points[0],f.selection.points[0]);assert.equal(f.observed[5][1].pointer,f.state.pointer);
    if(composed)assert.equal(Object.isFrozen(f.layer),true);
  }
});

test('overlay layer matches actual rectangle, snap and Sketch identity Canvas operations across zoom and live replacements',()=>{
  const results=[];for(const composed of [false,true]){
    const f=fixture(),state={preview:{rect:{x1:10,y1:20,x2:40,y2:60},crossing:true},snap:{x:12,y:15,label:'point',priority:1,data:{point:{}}},identity:{id:'G1',sketchId:'ref'},pointer:{x:10,y:20}};
    const layer=layerFor(composed,{renderer:f.renderer,rectangle:{preview:()=>state.preview},snap:{get active(){return state.snap;}},hover:{get current(){return {sketchIdentity:state.identity};}},selection:f.selection,pointer:{get lastWorld(){return state.pointer;}}});
    assert.deepEqual(f.calls,[]);const paint=()=>{layer.drawSelectionRect();layer.drawSnapMarker();layer.drawSketchIdentityLabel();};
    const before=JSON.stringify(state.preview);paint();assert.equal(JSON.stringify(state.preview),before);
    const first=JSON.stringify(f.calls);assert.ok(f.calls.some(call=>call[0]==='setLineDash'));assert.ok(f.calls.some(call=>call[0]==='fillText'&&call[1]==='point'));
    f.calls.length=0;f.viewport.scale=4;state.preview={rect:{x1:2,y1:3,x2:9,y2:11},crossing:false};state.snap={x:30,y:40,label:'line'};state.identity={id:'G2',sketchId:'child'};state.pointer={x:50,y:60};paint();
    const second=JSON.stringify(f.calls);assert.equal(JSON.stringify(f.calls.find(call=>call[0]==='setLineDash')), '["setLineDash",[1.25,1]]');
    f.calls.length=0;state.preview=null;state.snap=null;state.identity=null;state.pointer=null;paint();assert.deepEqual(f.calls,[]);
    results.push([first,second]);
  }assert.deepEqual(results[1],results[0]);
});

test('overlay layer keeps getter and paint failure identity, evaluation order and partial effects',()=>{
  const orders={drawSelectionRect:['rectangle:method','preview:get','preview:call','rectangle:paint'],drawSnapMarker:['snap:method','snap:read','snap:paint'],drawSketchIdentityLabel:['identity:method','hover:read','identity:read','pointer:read','identity:paint']};
  for(const composed of [false,true])for(const[method,order]of Object.entries(orders))for(const failAt of order){
    const f=observedLayer(composed),preview=f.state.preview,snap=f.state.snap;f.state.failAt=failAt;
    assert.throws(()=>f.layer[method](),error=>error===f.error);assert.deepEqual(f.events,order.slice(0,order.indexOf(failAt)+1));
    assert.equal(f.state.preview,preview);assert.equal(f.state.snap,snap);assert.deepEqual(f.selection.points,[]);
    assert.equal(f.observed.length,failAt.endsWith(':paint')?1:0);
  }
});
