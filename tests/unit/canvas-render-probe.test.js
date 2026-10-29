const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('src/diagnostics/canvas_render_probe.js','utf8'),sandbox);
function fixture() {
 const calls=[],points=[{id:'P1',x:4,y:7}],handlers={},original={};
 const ctx={fillStyle:'#abc',strokeStyle:'#def',lineWidth:3};
 for(const name of ['arc','fill','stroke','fillText'])ctx[name]=original[name]=function(...args){assert.equal(this,ctx);calls.push([name,...args]);return 'native:'+name;};
 const drawCalls=[];const dependencies={ctx,allGeometryPoints:()=>points,allGeometryLines:()=>[{id:'L1'}],allGeometryCircles:()=>[{id:'C1'}],allGeometryArcs:()=>[{id:'A1'}]};
 for(const name of ['drawLines','drawCircles','drawArcs','drawPoints','drawArcEndpointHandles','drawDimensions'])dependencies[name]=()=>{drawCalls.push(name);handlers[name]?.();};
 const probe=sandbox.window.CanvasRenderProbe.create(dependencies);return {probe,ctx,original,points,handlers,calls,drawCalls};
}
function restored(f){for(const name of Object.keys(f.original))assert.equal(f.ctx[name],f.original[name]);}
test('geometry labels filter current geometry IDs in drawing order without forwarding text, then restore context',()=>{
 const f=fixture();f.handlers.drawLines=()=>{f.ctx.fillText('L1');f.ctx.fillText('dimension');};
 f.handlers.drawCircles=()=>f.ctx.fillText('C1');f.handlers.drawArcs=()=>f.ctx.fillText('A1');f.handlers.drawPoints=()=>f.ctx.fillText('P1');
 assert.deepEqual(Array.from(f.probe.geometryIdLabels()),['L1','C1','A1','P1']);assert.deepEqual(f.calls,[]);
 assert.deepEqual(f.drawCalls,['drawLines','drawCircles','drawArcs','drawPoints']);restored(f);
});
test('marker probes count only their drawing paths while forwarding original arc receiver, arguments and return value',()=>{
 const f=fixture();f.handlers.drawLines=()=>{assert.equal(f.ctx.arc(1,2,3,4,5),'native:arc');};
 f.handlers.drawPoints=()=>{f.ctx.arc(4,7,2,0,1);f.ctx.arc(8,9,2,0,1);};f.handlers.drawArcEndpointHandles=()=>f.ctx.arc(9,10,1,0,2);
 assert.equal(f.probe.constraintEndpointMarkerCount(),3);assert.deepEqual(f.drawCalls,['drawLines','drawPoints']);restored(f);
 f.drawCalls.length=0;assert.equal(f.probe.pointMarkerCount(),2);assert.deepEqual(f.drawCalls,['drawPoints']);restored(f);
 f.drawCalls.length=0;assert.equal(f.probe.arcEndpointHandleCount(),1);assert.deepEqual(f.drawCalls,['drawArcEndpointHandles']);restored(f);
 assert.deepEqual(f.calls[0],['arc',1,2,3,4,5]);
});
test('point display observes only the requested coordinates and forwards native drawing without changing the point',()=>{
 const f=fixture(),point=f.points[0];f.handlers.drawPoints=()=>{
  f.ctx.arc(point.x,point.y,2,0,3);f.ctx.fill();f.ctx.stroke();f.ctx.fillText('P1',point.x,point.y);
  f.ctx.arc(9,10,2,0,3);f.ctx.fillText('other',9,10);f.ctx.fill();
 };
 assert.equal(f.probe.pointDisplayState('missing'),null);assert.deepEqual(f.drawCalls,[]);restored(f);
 const state=f.probe.pointDisplayState('P1');assert.equal(state.fill,'#abc');assert.equal(state.stroke,'#def');assert.equal(state.lineWidth,3);assert.deepEqual(Array.from(state.labels),['P1']);
 assert.equal(f.points[0],point);assert.deepEqual(point,{id:'P1',x:4,y:7});assert.equal(f.calls.length,7);restored(f);
});
test('dimension labels capture string values, and expression marks preserve identity and remain inactive outside a probe',()=>{
 const f=fixture(),mark={pointCount:3,filled:true};assert.equal(f.probe.captureExpressionMark(mark),undefined);
 f.handlers.drawDimensions=()=>{f.ctx.fillText(50);f.ctx.fillText('(40)');};assert.deepEqual(Array.from(f.probe.dimensionLabels()),['50','(40)']);assert.deepEqual(f.calls,[]);restored(f);
 f.handlers.drawDimensions=()=>{assert.equal(f.probe.captureExpressionMark(mark),1);};const marks=f.probe.dimensionExpressionMarks();assert.equal(marks.length,1);assert.equal(marks[0],mark);
 assert.equal(f.probe.captureExpressionMark(mark),undefined);assert.equal(marks.length,1);restored(f);
});
test('every probe restores instrumented context and expression capture after a drawing exception',()=>{
 for(const [method,path,args] of [['geometryIdLabels','drawCircles',[]],['constraintEndpointMarkerCount','drawLines',[]],['pointMarkerCount','drawPoints',[]],['arcEndpointHandleCount','drawArcEndpointHandles',[]],['pointDisplayState','drawPoints',['P1']],['dimensionLabels','drawDimensions',[]],['dimensionExpressionMarks','drawDimensions',[]]]){
  const f=fixture(),error=new Error(method);f.handlers[path]=()=>{throw error;};assert.throws(()=>f.probe[method](...args),e=>e===error);restored(f);assert.equal(f.probe.captureExpressionMark({}),undefined);
 }
});
test('expression capture is probe-local; nested capture retains the existing clear-on-exit contract',()=>{
 const f=fixture(),other=fixture(),a={},b={},c={};let nesting=false,inner;
 f.handlers.drawDimensions=()=>{if(nesting){f.probe.captureExpressionMark(b);return;}f.probe.captureExpressionMark(a);assert.equal(other.probe.captureExpressionMark(c),undefined);nesting=true;inner=f.probe.dimensionExpressionMarks();nesting=false;assert.equal(f.probe.captureExpressionMark(c),undefined);};
 const outer=f.probe.dimensionExpressionMarks();assert.equal(outer.length,1);assert.equal(outer[0],a);assert.equal(inner.length,1);assert.equal(inner[0],b);assert.equal(f.probe.captureExpressionMark(c),undefined);
});

test('scene probe defers painter lookup, reads live geometry IDs, and preserves painter receivers and order',()=>{
 const calls=[],ctx={fillText(){throw Error('labels must be captured');}},state={ready:false,points:[{id:'P1'}],geometry:null,dimensions:null};
 const readServices={reads:{}};for(const [name,id]of [['Points','P'],['Lines','L'],['Circles','C'],['Arcs','A']])readServices.reads['allGeometry'+name]=()=>{assert(state.ready);calls.push('read'+name);return name==='Points'?state.points:[{id:id+'1'}];};
 const native=ctx.fillText;
 const probe=sandbox.window.CanvasRenderProbe.createForScene({ctx,readServices,
  readGeometry:()=>{assert(state.ready);calls.push('geometry');return state.geometry;},readDimensions:()=>{assert(state.ready);calls.push('dimensions');return state.dimensions;}});
 assert.deepEqual(calls,[]);state.ready=true;
 const geometry={};for(const[name,id]of [['drawLines','L1'],['drawCircles','C1'],['drawArcs','A1'],['drawPoints','P1']])geometry[name]=function(...args){assert.equal(this,state.geometry);assert.deepEqual(args,[]);calls.push(name);ctx.fillText(id);};state.geometry=Object.freeze(geometry);
 assert.deepEqual(Array.from(probe.geometryIdLabels()),['L1','C1','A1','P1']);assert.equal(ctx.fillText,native);
 assert.deepEqual(calls,['readPoints','readLines','readCircles','readArcs','geometry','drawLines','geometry','drawCircles','geometry','drawArcs','geometry','drawPoints']);
 calls.length=0;state.points=[{id:'P2'}];const next=Object.freeze({...geometry,drawPoints(){assert.equal(this,next);ctx.fillText('P1');ctx.fillText('P2');}});state.geometry=next;
 assert.deepEqual(Array.from(probe.geometryIdLabels()),['L1','C1','A1','P2']);assert.equal(ctx.fillText,native);
 const dimensions=Object.freeze({draw(){assert.equal(this,dimensions);ctx.fillText('42');}});state.dimensions=dimensions;
 assert.deepEqual(Array.from(probe.dimensionLabels()),['42']);const mark={pointCount:2};state.dimensions=Object.freeze({draw(){assert.equal(this,state.dimensions);probe.captureExpressionMark(mark);}});
 assert.equal(probe.dimensionExpressionMarks()[0],mark);assert.equal(probe.captureExpressionMark(mark),undefined);assert.equal(ctx.fillText,native);
});

test('scene probe restores instrumentation and expression capture after owner lookup or painter failures',()=>{
 const f=fixture(),error=new Error('scene not available');let failLookup=true;
 const geometry={};for(const name of ['drawLines','drawCircles','drawArcs','drawPoints','drawArcEndpointHandles'])geometry[name]=function(){assert.equal(this,geometry);throw error;};
 const dimensions={draw(){assert.equal(this,dimensions);throw error;}};
 const probe=sandbox.window.CanvasRenderProbe.createForScene({ctx:f.ctx,readServices:{reads:{allGeometryPoints:()=>f.points,allGeometryLines:()=>[],allGeometryCircles:()=>[],allGeometryArcs:()=>[]}},
  readGeometry:()=>{if(failLookup)throw error;return geometry;},readDimensions:()=>{if(failLookup)throw error;return dimensions;}});
 for(const failure of ['lookup','painter']){
  failLookup=failure==='lookup';for(const[method,args]of [['geometryIdLabels',[]],['constraintEndpointMarkerCount',[]],['pointMarkerCount',[]],['arcEndpointHandleCount',[]],['pointDisplayState',['P1']],['dimensionLabels',[]],['dimensionExpressionMarks',[]]]){
   assert.throws(()=>probe[method](...args),value=>value===error);restored(f);assert.equal(probe.captureExpressionMark({}),undefined);
  }
 }
});
