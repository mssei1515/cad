
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test');
const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../src/editing/blank_canvas_gesture.js'),'utf8'),sandbox);
function fixture(){
  const f={mode:'select',pending:null,constraint:null,edit:null,time:0,calls:[],startHit:false,completionHit:false,pointHit:false,active:false,selected:false,drawMode:false};
  const record=name=>(...args)=>{f.calls.push(name);return true;};
  f.line={startPoint:null,reset:record('resetLine')};
  f.transient={hasLineStart:false,hasLineCompletion:false,isLineStartHit:()=>f.startHit,isLineCompletionHit:()=>f.completionHit,isPointHit:()=>f.pointHit};
  const ports={getMode:()=>f.mode,getPending:()=>f.pending,getPendingConstraint:()=>f.constraint,getSplineEditSession:()=>f.edit,
    getLineCommand:()=>f.line,getTransientAuthoring:()=>f.transient,getTime:()=>f.time,hypot2:Math.hypot,
    isDrawToolMode:()=>f.drawMode,hasActiveDrawOperation:()=>f.active,hasSelection:()=>f.selected};
  for(const name of ['clearPreview','finalizeSplineFromDoubleClick','finishSplineEditSession','submitDistanceValue','submitOffsetValue','submitAnnotationValue','cancelPendingCommand','exitDrawMode','cancelConstraintTargetCommand','rollbackTransientLineCompletion','clearSnap','clearSelection','setHint','updateUI','draw','cancelActiveDrawOperation','rollbackTransientPoint','updateGeometrySelectionUI'])ports[name]=record(name);
  f.gesture=sandbox.window.BlankCanvasGesture.create(ports);return f;
}
test('blank repeat uses inclusive 450ms and 6px bounds and rejected hits reset its candidate',()=>{
  const f=fixture(),g=f.gesture;assert.equal(g.isRepeated({x:0,y:0}),false);f.time=450;
  assert.equal(g.isRepeated({x:6,y:0}),true);f.time=901;assert.equal(g.isRepeated({x:6,y:0}),false);
  f.time=902;assert.equal(g.isRepeated({x:12.01,y:0}),false);
  assert.equal(g.isRepeated({x:12.01,y:0},{hitL:{}}),false);assert.equal(g.isRepeated({x:12.01,y:0}),false);
  g.resetCandidate();assert.equal(g.isRepeated({x:12.01,y:0}),false);
});
test('native duplicate suppression is consumed once and can be cleared independently',()=>{
  const g=fixture().gesture;g.suppressNext();assert.equal(g.takeSuppression(),true);assert.equal(g.takeSuppression(),false);
  g.suppressNext();g.clearSuppression();assert.equal(g.takeSuppression(),false);
});
test('spline completion and fit-point editing precede pending value acceptance',()=>{
  const f=fixture();f.mode='spline';f.pending={type:'distance-value'};f.edit={};assert.equal(f.gesture.handle({}),true);
  assert.deepEqual(f.calls,['finalizeSplineFromDoubleClick']);f.mode='select';f.calls=[];f.gesture.handle({});assert.deepEqual(f.calls,['finishSplineEditSession']);
  f.edit=null;f.calls=[];f.gesture.handle({});assert.deepEqual(f.calls,['submitDistanceValue']);
  f.pending={type:'offset-value'};f.calls=[];f.gesture.handle({});assert.deepEqual(f.calls,['submitOffsetValue']);
});
test('pending commands cancel before constraint commands and optionally exit drawing mode',()=>{
  const f=fixture();f.pending={type:'other'};f.constraint={};f.drawMode=true;f.gesture.handle({});assert.deepEqual(f.calls,['cancelPendingCommand','exitDrawMode']);
  f.pending=null;f.calls=[];f.gesture.handle({});assert.deepEqual(f.calls,['cancelConstraintTargetCommand']);
});
test('provisional line completion rolls back before clearing preview and selection',()=>{
  const f=fixture();f.mode='line';f.completionHit=true;
  assert.equal(f.gesture.handle({}, {hitP:{},hitL:{}}),true);
  assert.deepEqual(f.calls,['rollbackTransientLineCompletion','resetLine','clearPreview','clearSnap','clearSelection','setHint','updateUI','draw']);
  f.calls=[];assert.equal(f.gesture.handle({}, {hitC:{}}),false);assert.deepEqual(f.calls,[]);
});
test('line start exits, established line continuation stays in command, and point creation rolls back',()=>{
  const f=fixture();f.mode='line';f.line.startPoint={};f.transient.hasLineStart=true;f.gesture.handle({});assert.deepEqual(f.calls,['cancelActiveDrawOperation','exitDrawMode']);
  f.calls=[];f.transient.hasLineStart=false;f.gesture.handle({});assert.deepEqual(f.calls,['cancelActiveDrawOperation','updateUI','draw']);
  f.calls=[];f.mode='point';f.pointHit=true;f.gesture.handle({}, {hitP:{}});assert.deepEqual(f.calls,['rollbackTransientPoint','exitDrawMode']);
});
test('active drawing wins over selection clearing and idle blank clicks fall through',()=>{
  const f=fixture();f.active=true;f.selected=true;f.gesture.handle({});assert.deepEqual(f.calls,['cancelActiveDrawOperation','exitDrawMode']);
  f.active=false;f.calls=[];f.gesture.handle({});assert.deepEqual(f.calls,['clearSelection','setHint','updateGeometrySelectionUI','draw']);
  f.selected=false;f.calls=[];assert.equal(f.gesture.handle({}),false);assert.deepEqual(f.calls,[]);
});

test('annotation blank confirmation submits instead of cancelling and rejects occupied canvas',()=>{
  const f=fixture();f.pending={type:'annotation-value'};
  for(const key of ['hitP','hitL','hitC','hitArcEnd','hitA','hitS','hitD','hitBlock','hitDerivedInstance','hatchHit','referenceImageHit','annotationHit','inactiveHit']) {
    assert.equal(f.gesture.handle({}, {[key]:{}}),false);assert.deepEqual(f.calls,[]);
  }
  assert.equal(f.gesture.handle({}),true);assert.deepEqual(f.calls,['submitAnnotationValue']);
});
