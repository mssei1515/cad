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
