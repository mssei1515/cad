const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/rendering/placement_preview_renderer.js'), 'utf8'), sandbox);
function fixture() {
  const calls=[],ctx={};
  for(const name of ['beginPath','moveTo','lineTo','stroke','arc','setLineDash'])ctx[name]=(...args)=>calls.push([name,...args]);
  const renderer=sandbox.window.PlacementPreviewRenderer.create({ctx,viewport:{scale:2},
    withCanvasState:fn=>{calls.push(['enter']);try{fn();}finally{calls.push(['exit']);}},
    traceSplinePath:spline=>calls.push(['spline',spline]),resolvedHatchBoundary:h=>h.boundary,
    hatchAppearanceForDisplay:h=>h.appearance,hatchPatternOrigin:h=>h.origin,
    drawResolvedHatch:(...args)=>calls.push(['hatch',...args]),
    drawAnnotationLeader:(...args)=>calls.push(['leader',...args]),drawAnnotationText:(...args)=>calls.push(['text',...args])});
  return {renderer,calls,ctx};
}
const bundle=()=>({lines:[{p1:{x:1,y:2},p2:{x:3,y:4}}],circles:[],arcs:[],splines:[],points:[{x:5,y:6}]});
test('Block preview paints hatch then geometry then annotations without mutating their styles',()=>{
  const f=fixture(),b=bundle();
  b.hatches=[{boundary:{id:'H'},appearance:Object.freeze({color:'red'}),origin:{x:0,y:0}}];
  const text=Object.freeze({type:'text',style:Object.freeze({color:'black'})}),leader=Object.freeze({type:'leader',style:Object.freeze({color:'green'})});
  b.annotations=[text,leader];f.renderer.drawBlock(b);
  const order=f.calls.filter(c=>['hatch','moveTo','text','leader'].includes(c[0])).map(c=>c[0]);
  assert.deepEqual(order,['hatch','moveTo','text','leader']);
  const hatch=f.calls.find(c=>c[0]==='hatch');assert.equal(hatch[1],b.hatches[0].boundary);
  assert.equal(hatch[2].color,'#2563eb');assert.equal(hatch[4].alpha,0.75);assert.equal(hatch[4].preview,true);
  const copy=f.calls.find(c=>c[0]==='text')[1];assert.notEqual(copy,text);assert.equal(copy.style.color,'#2563eb');assert.equal(text.style.color,'black');
  assert.equal(f.calls.find(c=>c[0]==='leader')[2],true);
  assert.equal(f.calls.some(c=>c[0]==='arc'),false);
});
test('Free Instance preview retains signed arc direction, splines and point markers',()=>{
  const f=fixture(),b=bundle();b.circles=[{center:{x:10,y:20},radius:()=>7}];
  b.arcs=[{center:{x:30,y:40},radius:()=>9,startAngle:2,endAngle:1}];b.splines=[{id:'S1'}];
  f.renderer.drawFreeInstance(b);
  assert.deepEqual(f.calls.filter(c=>c[0]==='arc'),[['arc',10,20,7,0,Math.PI*2],['arc',30,40,9,2,1,true],['arc',5,6,1.5,0,Math.PI*2]]);
  assert.equal(f.calls.find(c=>c[0]==='spline')[1],b.splines[0]);assert.equal(f.ctx.lineWidth,1);
  assert.equal(f.calls[0][0],'enter');assert.equal(f.calls.at(-1)[0],'exit');
});
test('missing previews do not enter Canvas state and drawing failure still leaves the state scope',()=>{
  const f=fixture();f.renderer.drawBlock(null);f.renderer.drawFreeInstance(null);assert.equal(f.calls.length,0);
  const b=bundle();b.circles=[{center:{x:0,y:0},radius:()=>{throw Error('failed');}}];
  assert.throws(()=>f.renderer.drawFreeInstance(b),/failed/);assert.equal(f.calls.at(-1)[0],'exit');
});

function placementLayerFixture() {
  const calls = [], pointer = { x: 1, y: 2 }, instance = {}, definition = {}, bundle = {}, free = {};
  const state = { mode: 'select', pointer, definitionId: 'D', preview: { instance, definition }, free };
  const blockCommand = { get definitionId() { calls.push(['definition']); return state.definitionId; }, preview(p) { assert.equal(this, blockCommand); calls.push(['block-preview', p]); return state.preview; } };
  const instanceCommand = { preview(p) { assert.equal(this, instanceCommand); calls.push(['instance-preview', p]); return state.free; } };
  const renderer = { drawBlock(value) { assert.equal(this, renderer); calls.push(['block', value]); }, drawFreeInstance(value) { assert.equal(this, renderer); calls.push(['free', value]); } };
  const layer = sandbox.window.PlacementPreviewRenderer.createLayer({ renderer, readMode: () => state.mode, readPointer: () => { calls.push(['pointer']); return state.pointer; },
    blockPlacementCommand: blockCommand, geometryInstanceCommand: instanceCommand, createBlockProjectionBundle: (i, d) => { calls.push(['bundle', i, d]); return bundle; } });
  return { layer, state, calls, pointer, instance, definition, bundle, free };
}
test('Block preview preserves mode/definition/pointer/plan guards and projection/painter reference order', () => {
  const h = placementLayerFixture(); h.layer.drawBlockPlacementPreview(); assert.equal(h.calls.length, 0);
  h.state.mode = 'block-place'; h.state.definitionId = null; h.layer.drawBlockPlacementPreview(); assert.deepEqual(h.calls.map(c => c[0]), ['definition']);
  h.calls.length = 0; h.state.definitionId = 'D'; h.state.pointer = null; h.layer.drawBlockPlacementPreview(); assert.deepEqual(h.calls.map(c => c[0]), ['definition', 'pointer']);
  h.calls.length = 0; h.state.pointer = h.pointer; h.state.preview = null; h.layer.drawBlockPlacementPreview(); assert.deepEqual(h.calls.map(c => c[0]), ['definition', 'pointer', 'pointer', 'block-preview']);
  h.calls.length = 0; h.state.preview = { instance: h.instance, definition: h.definition }; h.layer.drawBlockPlacementPreview(); assert.deepEqual(h.calls.map(c => c[0]), ['definition', 'pointer', 'pointer', 'block-preview', 'bundle', 'block']);
  assert.equal(h.calls[3][1], h.pointer); assert.equal(h.calls[4][1], h.instance); assert.equal(h.calls[4][2], h.definition); assert.equal(h.calls[5][1], h.bundle);
});
test('Instance preview remains independent of mode and passes current pointer/plan including null through existing owners', () => {
  const h = placementLayerFixture(); h.layer.drawFreeInstancePreview(); assert.deepEqual(h.calls.map(c => c[0]), ['pointer', 'instance-preview', 'free']); assert.equal(h.calls[1][1], h.pointer); assert.equal(h.calls[2][1], h.free);
  h.calls.length = 0; h.state.pointer = null; h.state.free = null; h.layer.drawFreeInstancePreview(); assert.equal(h.calls[1][1], null); assert.equal(h.calls[2][1], null);
});
