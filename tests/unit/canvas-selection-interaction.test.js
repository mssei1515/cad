
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/editing/canvas_selection_interaction.js'), 'utf8'), sandbox);
function fixture() {
  const f = { calls: [], count: 1, top: null };
  const selection = {};
  const arrays = ['points','lines','circles','arcs','splines','blockInstances','geometryInstances','annotations','hatches','referenceImages'];
  const clear = () => { arrays.forEach(k => selection[k] = []); selection.arcEndpoint = null; };
  clear();
  Object.assign(selection, { set: (k,v) => selection[k]=v, append: (k,v) => selection[k].push(v),
    removeAt: (k,i,n) => selection[k].splice(i,n), toggleById: (k,v) => { const i=selection[k].findIndex(x=>x.id===v.id); if(i<0)selection[k].push(v);else selection[k].splice(i,1); } });
  for(const [name,key] of Object.entries({Point:'points',Line:'lines',Circle:'circles',Arc:'arcs',Spline:'splines',BlockInstance:'blockInstances'})) {
    selection['toggle'+name+'Selection'] = v => selection.toggleById(key,v);
  }
  const record = name => (...args) => f.calls.push({name,args});
  f.selection=selection; f.event={pointerId:3}; f.point={x:1,y:2};
  f.controller=sandbox.window.CanvasSelectionInteraction.create({canvasSelection:selection,clearSelection:clear,
    sameArcEndpoint:(a,b)=>a?.arc===b?.arc&&a?.endpoint===b?.endpoint,
    topmostDrawingOrderOwner:items=>f.top||items.find(Boolean),drawingOrderOwner:x=>x.owner||x,
    beginDerivedGeometryDrag:record('derived'),beginBlockDrag:record('block'),beginDimensionDrag:record('dimension'),
    beginDrag:record('geometry'),beginReferenceImageDrag:record('image'), selectedElementCount:()=>f.count,
    selectedDragPoints:()=>f.dragPoints,buildDragSession:(...args)=>{f.plan=args;return args;},
    geometryDrag:{begin:(...args)=>{record('spline')(...args);return true;},label:'drag'},
    selectionRectangle:{begin:record('rectangle')},capturePointer:record('capture'),setHint:record('hint'),
    applicationText:a=>a,updateGeometrySelectionUI:record('ui'),draw:record('draw')});
  f.begin=hits=>f.controller.begin(f.event,f.point,hits);
  f.names=()=>f.calls.map(c=>c.name);return f;
}
test('drawing order chooses front geometry while a direct point wins over a block handle',()=>{
  const f=fixture(),line={id:'L'},circle={id:'C'};f.top=circle;f.begin({hitL:line,hitC:circle});
  assert.equal(f.calls[0].args[3],circle);assert.deepEqual(f.names(),['geometry','ui','draw']);
  f.calls=[];const block={id:'B'},point={id:'P'};f.top=block;f.begin({hitBlock:block,hitBlockHandle:block,hitP:point});
  assert.equal(f.calls[0].args[1],point);assert.equal(f.calls[0].args[0],f.event);
});
test('derived geometry additive selection toggles its owner and clears constraint selection',()=>{
  const f=fixture(),instance={id:'I'};f.event.shiftKey=true;f.selection.constraint={};f.selection.instanceGeometry={};
  f.begin({hitDerivedGeometry:{instance}});assert.equal(f.selection.geometryInstances[0],instance);
  assert.equal(f.selection.constraint,null);assert.equal(f.selection.instanceGeometry,null);
  f.begin({hitDerivedGeometry:{instance}});assert.equal(f.selection.geometryInstances.length,0);
});
test('arc endpoint additive selection retains a distinct endpoint pair',()=>{
  const f=fixture(),arc={id:'A'},first={arc,endpoint:'start'},last={arc,endpoint:'end'};
  f.event.ctrlKey=true;f.selection.arcEndpoint=first;f.begin({hitArcEnd:last});
  assert.equal(f.selection.arcEndpointPair[0],first);assert.equal(f.selection.arcEndpointPair[1].endpoint,'end');
  assert.equal(f.selection.arcs[0],arc);
});
test('spline dragging preserves mixed selection or replaces it for an unselected spline',()=>{
  const f=fixture(),spline={id:'S'},point={id:'P'};f.count=2;f.dragPoints=[point];f.selection.splines=[spline];f.selection.points=[point];
  f.begin({hitS:spline});assert.equal(f.plan[0],'selection');assert.equal(f.plan[1],f.dragPoints);assert.equal(f.selection.points[0],point);
  const other={id:'S2'};f.begin({hitS:other});assert.equal(f.plan[0],'spline');assert.equal(f.plan[1],other);assert.equal(f.selection.points.length,0);
});
test('projected hatch selects its block and image drag owns its update path',()=>{
  const f=fixture(),block={id:'B'};f.begin({hatchHit:{blockProjection:true,blockInstance:block}});
  assert.equal(f.selection.blockInstances[0],block);assert.equal(f.selection.hatches.length,0);
  f.calls=[];f.begin({referenceImageHit:{id:'R'}});assert.deepEqual(f.names(),['image']);
});
test('blank additive selection begins a rectangle and captures the same pointer',()=>{
  const f=fixture();f.event.shiftKey=true;f.begin({});assert.deepEqual(f.names(),['rectangle','capture','ui','draw']);
  assert.equal(f.calls[0].args[0],f.point);assert.equal(f.calls[0].args[1].additive,true);assert.equal(f.calls[1].args[0],3);
});
