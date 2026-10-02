const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/editing/drawing_preview.js'), 'utf8'), sandbox);
class Point {} class Line {} class Circle {} class Arc {}
function fixture() {
  const hover={current:{},update(values){Object.assign(this.current,values);}};
  const f={hover,allowed:true,draws:0,clears:0,hits:{},hitCalls:[],centerline:{targets:[]},offset:{},trim:null,snapCalls:[]};
  const hits=Object.fromEntries(['Point','Line','Circle','Arc'].map(kind=>['hit'+kind,()=>{f.hitCalls.push(kind);return f.hits[kind]||null;}]));
  f.preview=sandbox.window.DrawingPreview.create({types:{Point,Line,Circle,Arc},canvasHover:hover,
    canCreateInActiveSketch:()=>f.allowed,clearSnap:()=>f.clears++,snapForDrawing:p=>{f.snapCalls.push(p);return {x:p.x+1,y:p.y};},draw:()=>f.draws++,
    linePreviewPoint:(p,shift)=>({x:p.x,y:shift?0:p.y}),readCenterline:()=>f.centerline,
    projectPointToCenterlineSupport:p=>({x:p.x,y:10}),readOffsetSelection:()=>f.offset,
    computeTrimPreview:()=>f.trim,hits});return f;
}
test('line and circular previews update but deliberately allow ordinary hover processing to continue',()=>{
  const f=fixture(),p={x:2,y:3};assert.equal(f.preview.updateAuthoring('line',p,true),false);
  assert.deepEqual(f.preview.pointer,{x:3,y:0});assert.equal(f.draws,1);
  for(const mode of ['rectangle','slot','circle','arc','three-point-arc','spline'])assert.equal(f.preview.updateAuthoring(mode,p,false),false);
  assert.equal(f.draws,7);assert.equal(f.preview.updateAuthoring('select',p),false);assert.equal(f.draws,7);
  assert.equal(f.preview.updateAuthoring('block-place',p),true);assert.equal(f.preview.pointer,p);
});
test('creation guard resets both previews without drawing or clearing unrelated hover',()=>{
  const f=fixture(),point={};f.preview.setPointer(point);f.preview.setTrim({});f.hover.current.line=point;f.allowed=false;
  assert.equal(f.preview.updateAuthoring('offset',{x:0,y:0}),true);
  assert.equal(f.preview.pointer,null);assert.equal(f.preview.trim,null);assert.equal(f.draws,0);
  assert.equal(f.hover.current.line,point);assert.equal(f.hover.current.sketchIdentity,null);
});
test('centerline hover honors the first target type and completed support projects the snapped pointer',()=>{
  const f=fixture(),point=new Point(),line=new Line();f.hits.Point=point;f.hits.Line=line;
  f.centerline.targets=[line];assert.equal(f.preview.updateAuthoring('centerline',{x:2,y:3}),true);
  assert.equal(f.hover.current.point,null);assert.equal(f.hover.current.line,line);assert.deepEqual(f.hitCalls,['Line']);
  f.centerline.targets=[point];f.hitCalls=[];f.preview.updateAuthoring('centerline',{x:2,y:3});
  assert.equal(f.hover.current.endpointPoint,point);assert.equal(f.hover.current.line,null);assert.deepEqual(f.hitCalls,['Point']);
  f.centerline={targets:[point,point],support:{ok:true}};f.preview.updateAuthoring('centerline',{x:2,y:3});
  assert.deepEqual(f.preview.pointer,{x:3,y:10});assert.equal(f.hover.current.point,null);
});
test('trim redraw depends on preview identity and legacy hover fields',()=>{
  const f=fixture();f.trim={kind:'line'};f.preview.updateTrim({});assert.equal(f.draws,1);
  f.preview.updateTrim({});assert.equal(f.draws,1);
  f.hover.current.spline={};f.preview.updateTrim({});assert.equal(f.draws,1);assert.equal(f.hover.current.spline,null);
  f.hover.current.line={};f.preview.updateTrim({});assert.equal(f.draws,2);
  f.preview.reset();assert.equal(f.preview.trim,null);
});
test('offset value entry keeps pointer; committed sources win and otherwise hits follow line circle arc order',()=>{
  const f=fixture(),p={x:2,y:3},saved={};f.preview.setPointer(saved);f.preview.updateOffset(p,true);
  assert.equal(f.preview.pointer,saved);assert.equal(f.hitCalls.length,0);
  f.offset={source:new Circle()};f.preview.updateOffset(p,false);assert.equal(f.hover.current.circle,f.offset.source);
  f.offset={};f.hits.Line=new Line();f.hits.Circle=new Circle();f.preview.updateOffset(p,false);
  assert.deepEqual(f.hitCalls,['Line']);assert.equal(f.hover.current.circle,null);
  f.hitCalls=[];f.hits.Line=null;f.hits.Circle=null;f.hits.Arc=new Arc();f.preview.updateOffset(p,false);
  assert.deepEqual(f.hitCalls,['Line','Circle','Arc']);assert.equal(f.hover.current.arc,f.hits.Arc);
});
test('free-instance and circle-center-cross feedback retain their different snap and consumption rules',()=>{
  const f=fixture(),p={x:2,y:3};f.allowed=false;f.preview.updateFreeInstance(p);assert.deepEqual(f.preview.pointer,{x:3,y:3});
  f.allowed=true;f.hits.Circle=new Circle();assert.equal(f.preview.updateAuthoring('circle-center-cross',p),true);
  assert.equal(f.preview.pointer,p);assert.equal(f.hover.current.circle,f.hits.Circle);assert.equal(f.hover.current.dimension,null);
});
