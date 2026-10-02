
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test');
const sandbox={window:{}};vm.createContext(sandbox);
for(const file of ['src/commands/point_command.js','src/editing/drawing_command_input.js'])vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../..',file),'utf8'),sandbox);
function fixture(){
  const f={mode:'select',rejected:false,calls:[],guards:0,prevented:0};
  const record=name=>(...args)=>{f.calls.push({name,args});};
  const ports={getMode:()=>f.mode,rejectRootSketchCreation:()=>{f.guards++;return f.rejected;},pointCommand:{click:record('point')},offsetCommand:{click:record('offset')}};
  for(const name of ['handleLineClick','handleCenterlineClick','handleCircleCenterCrossClick','handleRectangleClick','handleSlotClick','handleFilletClick','handleCircleClick','handleArcClick','handleThreePointArcClick','handleSplineClick','executeTrimAt'])ports[name]=record(name);
  f.input=sandbox.window.DrawingCommandInput.create(ports);f.event={shiftKey:true,preventDefault:()=>f.prevented++};f.p={x:2,y:3};f.hits={hitP:{id:'P'},hitL:{id:'L'},hitC:{id:'C'},hitA:{id:'A'}};f.click=()=>f.input.click(f.event,f.p,f.hits);return f;
}
test('drawing modes dispatch once with their original argument shapes',()=>{
  const f=fixture(),p=f.p,h=f.hits;
  const cases=[['point','point',[p]],['line','handleLineClick',[p,true]],['centerline','handleCenterlineClick',[p,h.hitP,h.hitL]],['circle-center-cross','handleCircleCenterCrossClick',[h.hitC]],['rectangle','handleRectangleClick',[p]],['slot','handleSlotClick',[p]],['fillet','handleFilletClick',[h.hitL,p]],['circle','handleCircleClick',[p]],['arc','handleArcClick',[p]],['three-point-arc','handleThreePointArcClick',[p]],['spline','handleSplineClick',[p]],['trim','executeTrimAt',[p]]];
  for(const [mode,name,args] of cases){f.mode=mode;f.calls=[];assert.equal(f.click(),true);assert.deepEqual(f.calls,[{name,args}]);}
  f.mode='offset';f.calls=[];assert.equal(f.click(),true);assert.equal(f.calls[0].args[0],p);assert.equal(f.calls[0].args[1].hitA,h.hitA);assert.equal(f.calls[0].args[1].hitL,h.hitL);assert.equal(f.calls[0].args[1].hitC,h.hitC);assert.equal(f.prevented,0);
});
test('rejected creation consumes input without dispatch and unrelated modes fall through',()=>{
  const f=fixture();f.mode='point';f.rejected=true;assert.equal(f.click(),true);assert.equal(f.prevented,1);assert.deepEqual(f.calls,[]);
  f.mode='select';f.guards=0;assert.equal(f.click(),false);assert.equal(f.guards,0);
  f.mode='sketch-projection';assert.equal(f.click(),false);assert.equal(f.guards,0);
});
test('point creation snapshots before snapping and preserves snap identity through creation and solve',()=>{
  const calls=[],original={x:1,y:2},snapped={x:3,y:4},snap={},point={id:'P'};
  const selected={annotations:[{id:'N'}],arcEndpoint:{}};
  const drawingSnap={active:null};
  const command=sandbox.window.PointCommand.create({
    transientAuthoring:{clearTransientPointRollback:()=>calls.push('clearRollback'),beginTransientPointRollback:()=>calls.push('beginRollback'),markCreatedPoint:value=>{assert.equal(value,point);calls.push('mark');}},
    snapForDrawing:value=>{assert.equal(value,original);drawingSnap.active=snap;calls.push('snap');return snapped;},drawingSnap,
    addPoint:(x,y,fixed)=>{assert.deepEqual([x,y,fixed],[3,4,false]);calls.push('add');return point;},
    addPointSnapConstraints:(value,target)=>{assert.equal(value,point);assert.equal(target,snap);calls.push('constraints');},
    clearSnap:()=>{drawingSnap.active=null;calls.push('clearSnap');},canvasSelection:{set:(key,value)=>{selected[key]=value;calls.push(key);}},
    solveAndRefresh:label=>{assert.equal(label,'点追加');calls.push('solve');},
  });
  command.click(original);assert.deepEqual(calls,['clearRollback','beginRollback','snap','add','mark','constraints','clearSnap','points','lines','circles','arcs','splines','solve']);
  assert.equal(selected.points[0],point);assert.equal(selected.annotations[0].id,'N');assert.ok(selected.arcEndpoint);
});
