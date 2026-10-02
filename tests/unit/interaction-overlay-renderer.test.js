const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/rendering/interaction_overlay_renderer.js'), 'utf8'), sandbox);
function fixture() {
  const calls=[],ctx={},relations={ref:'reference',child:'descendant',other:'inactive',active:'active'};
  for(const name of ['save','restore','beginPath','moveTo','lineTo','stroke','fill','arc','fillRect','strokeRect','fillText'])ctx[name]=(...args)=>calls.push([name,...args]);
  ctx.measureText=text=>({width:text.length*5});
  const selection={points:[],lines:[],circles:[],arcs:[],splines:[]};
  const f={calls,ctx,selection,language:'en',active:'active'};
  f.renderer=sandbox.window.InteractionOverlayRenderer.create({ctx,viewport:{scale:2},elementSketchId:item=>item.sketchId,
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
test('relation labels and colors use current language and retain distinct reference and descendant states',()=>{
  const f=fixture();assert.equal(f.renderer.sketchIdentityRelationLabel('ref'),'Reference available');
  assert.equal(f.renderer.sketchIdentityRelationColor('ref'),'#1d4ed8');
  assert.equal(f.renderer.sketchIdentityRelationColor('child'),'#b91c1c');
  assert.equal(f.renderer.sketchIdentityRelationLabel('active'),'');
  f.language='ja';assert.equal(f.renderer.sketchIdentityRelationLabel('child'),'参照不可（子孫）');
  f.draw({id:'X',sketchId:'child'});
  assert.equal(f.calls.filter(c=>c[0]==='fillText').at(-1)[1],'参照不可（子孫）');
  assert.equal(f.ctx.fillStyle,'#b91c1c');assert.equal(f.calls.at(-1)[0],'restore');
});
