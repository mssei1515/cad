const assert = require('node:assert/strict');
const fs = require('node:fs'); const vm = require('node:vm'); const test = require('node:test');
function fixture() {
 const created = {}, events = [], state = { snapped: { x: 2, y: 3 }, snap: { id: 'snap1' } };
 const sandbox = { window: {} };
 for (const name of ['LineCommand', 'RectangleCommand', 'CircularConstruction', 'CircularCommands', 'SlotConstruction', 'SlotCommand']) {
  sandbox.window[name] = { create(ports) {
   const owner = { id: name };
   for (const method of ['click', 'clickCircle', 'clickArc', 'clickThreePointArc']) owner[method] = function(...args) {
    events.push([name, method, this, ...args]);
   };
   created[name] = { ports, owner }; return owner;
  } };
 }
 vm.runInNewContext(fs.readFileSync('src/application/basic_drawing_tools.js', 'utf8'), sandbox);
 const noop = () => {}; const snap = { active: null, clear: noop };
 const preview = { setPointer(point) { assert.equal(this, preview); events.push(['preview', point]); } };
 const ports = { geometry: { addPoint: noop, addLine: noop, addCircle: noop, addArc: noop }, ids: {}, currentScope: () => { throw Error('no eager scope'); },
  snap, snapConstraints: { addPointSnapConstraints: noop, addArcEndpointSnapConstraints: noop, addCircularBoundarySnapConstraints: noop, addLineBoundarySnapConstraints: noop },
  snapForDrawing: point => { events.push(['snap', point]); snap.active = state.snap; return state.snapped; }, endpointAt: noop, samePosition: noop,
  transientAuthoring: {}, pushModelConstraint: noop, addConstraintIfMissing: noop, minLineLength: 5, minArcLength: 7,
  selection: {}, preview, checkpoint: { capture: () => { throw Error('no eager checkpoint'); }, restore: noop },
  clearSelection: noop, setHint: noop, updateUI: noop, draw: noop, solveAndRefresh: noop, log: noop };
 const tools = sandbox.window.BasicDrawingTools.create(ports);
 return { tools, created, events, state, ports };
}

test('drawing composition exposes the same command owners and shares explicit geometry, selection and checkpoint capabilities', () => {
 const f = fixture(); assert.deepEqual(f.events, []); assert.equal(Object.isFrozen(f.tools), true); assert.equal(Object.isFrozen(f.tools.input), true);
 for (const [field, factory] of [['line','LineCommand'],['rectangle','RectangleCommand'],['circular','CircularCommands'],['slot','SlotCommand']]) {
  assert.equal(f.tools[field], f.created[factory].owner);
 }
 assert.equal(f.tools.input.line, f.created.LineCommand.owner.click);
 assert.equal(f.created.LineCommand.ports.selection, f.ports.selection); assert.equal(f.created.RectangleCommand.ports.selection, f.ports.selection);
 assert.equal(f.created.CircularCommands.ports.construction, f.created.CircularConstruction.owner);
 assert.equal(f.created.SlotCommand.ports.construction, f.created.SlotConstruction.owner);
 assert.equal(f.created.CircularConstruction.ports.sequences, f.ports.ids); assert.equal(f.created.CircularConstruction.ports.currentScope, f.ports.currentScope);
 assert.equal(f.created.LineCommand.ports.addPoint, f.ports.geometry.addPoint);
 assert.equal(f.created.CircularConstruction.ports.addArc, f.ports.geometry.addArc);
 assert.equal(f.created.SlotConstruction.ports.snapshotGeometryMutationState, f.ports.checkpoint.capture);
 assert.equal(f.created.SlotConstruction.ports.restoreGeometryMutationState, f.ports.checkpoint.restore);
 assert.equal(f.created.LineCommand.ports.minLineLength, 5); assert.equal(f.created.SlotCommand.ports.minArcLength, 7);
});

test('snapped click adapters read snap after resolution and call current command methods with owner receivers', () => {
 const f = fixture(), pointer = { x: 8, y: 9 };
 for (const [input, owner, method] of [['rectangle','rectangle','click'],['circle','circular','clickCircle'],['arc','circular','clickArc'],['threePointArc','circular','clickThreePointArc'],['slot','slot','click']]) {
  f.events.length = 0; f.state.snap = { id: input }; f.state.snapped = { x: input.length, y: 0 };
  assert.equal(f.tools.input[input](pointer), undefined);
  assert.equal(f.events[0][0], 'snap'); assert.equal(f.events[0][1], pointer);
  assert.equal(f.events[1][1], method); assert.equal(f.events[1][2], f.tools[owner]);
  assert.equal(f.events[1][3], f.state.snapped); assert.equal(f.events[1][4], f.state.snap);
 }
 let receiver; f.tools.rectangle.click = function() { receiver = this; }; f.tools.input.rectangle(pointer); assert.equal(receiver, f.tools.rectangle);
});

test('line snapping and shared preview adapters preserve resolved values and current preview owner', () => {
 const f = fixture(), point = { x: 1, y: 1 };
 const result = f.created.LineCommand.ports.snapForDrawing(point); assert.equal(result.point, f.state.snapped); assert.equal(result.snap, f.state.snap);
 for (const name of ['LineCommand','RectangleCommand','CircularCommands','SlotCommand']) {
  const ports = f.created[name].ports; ports.setPointerPreview(point); assert.equal(f.events.at(-1)[1], point);
  if (name !== 'LineCommand') assert.equal(ports.clearSnap, f.ports.snap.clear);
 }
});


function splineFixture() {
 const events=[],state={ready:false,allowed:true,scope:{points:[]},seq:1,mode:'select',created:null,selected:null};
 const sandbox={window:{GeometrySolver:{hypot2:Math.hypot}},performance:{now:()=>100}};vm.createContext(sandbox);
 for(const file of ['src/editing/spline_draft.js','src/commands/spline_command.js','src/application/basic_drawing_tools.js']) vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
 const selection={set(kind,items){assert.equal(this,selection);assert.equal(kind,'splines');state.selected=items;events.push('select');}};
 const projection={reset(){assert.equal(this,projection);events.push('projection');}},preview={setPointer(point){assert.equal(this,preview);events.push('preview');}};
 const tools=sandbox.window.BasicDrawingTools.createSpline({
  currentScope:()=>{assert.equal(state.ready,true);return state.scope;},ids:{peek:kind=>{assert.equal(kind,'point');return state.seq;},restore:value=>{state.seq=value.pointSeq;events.push('restoreIds');}},
  endpointAt:(x,y)=>{const point={id:'P'+state.seq++,x,y};state.scope.points.push(point);return point;},samePosition:(a,b)=>a.x===b.x&&a.y===b.y,isPointUsedByPrimitive:()=>false,
  addSpline:(points,closed)=>{state.created={id:'SP1',points,closed};events.push('create');return state.created;},snapForDrawing:point=>point,scale:()=>2,
  cancelConstraintTargetCommand:message=>{assert.equal(message,'');events.push('constraint');},cancelPendingCommand:message=>{assert.equal(message,'');events.push('pending');},
  canCreateInActiveSketch:()=>state.allowed,rejectRootSketchCreation:()=>events.push('reject'),
  setMode:mode=>{state.mode=mode;events.push('mode:'+mode);},resetEditing:()=>events.push('editing'),resetBlankCandidate:()=>events.push('blank'),updateToolbar:()=>events.push('toolbar'),
  projection,preview,snap:{clear:()=>events.push('snap')},clearSelection:()=>events.push('clear'),selection,
  solveAndRefresh:()=>events.push('solve'),recordHistory:()=>events.push('history'),applicationText:jp=>jp,setHint:()=>events.push('hint'),updateUI:()=>events.push('ui'),draw:()=>events.push('draw'),
 });state.ready=true;return {tools,state,events};
}

test('Spline composition performs no eager scope reads and preserves cancellation before drawing-target refusal',()=>{
 const f=splineFixture();assert.deepEqual(f.events,[]);assert.equal(Object.isFrozen(f.tools),true);f.state.allowed=false;
 f.tools.command.start();assert.deepEqual(f.events,['constraint','pending','reject']);assert.equal(f.state.mode,'select');assert.equal(f.tools.draft.points.length,0);
});

test('Spline command and render/cancel draft share points and completion selects the created spline before mode and effects',()=>{
 const f=splineFixture();f.tools.command.start();assert.equal(f.state.mode,'spline');
 assert.ok(f.events.indexOf('projection')<f.events.indexOf('editing'));assert.ok(f.events.indexOf('editing')<f.events.indexOf('blank'));
 for(const point of [{x:0,y:0},{x:20,y:0},{x:30,y:20}]) assert.equal(f.tools.command.click(point),true);
 const points=f.tools.draft.points;assert.equal(points.length,3);assert.equal(points[0],f.state.scope.points[0]);f.events.length=0;
 assert.equal(f.tools.command.finalize(false),true);assert.equal(f.tools.draft.points.length,0);assert.notEqual(f.state.created.points,points);
 assert.equal(f.state.created.points[0],points[0]);assert.equal(f.state.selected[0],f.state.created);assert.equal(f.state.mode,'select');
 assert.deepEqual(f.events,['create','projection','preview','snap','clear','select','mode:select','solve','history','hint','ui','draw']);
});

test('canceling the exposed Spline draft removes provisional points and restores allocation without completing a command',()=>{
 const f=splineFixture(),prior={id:'existing',x:99,y:99};f.state.scope.points.push(prior);f.tools.command.start();
 f.tools.command.click({x:0,y:0});f.tools.command.click({x:20,y:0});assert.equal(f.state.seq,3);f.events.length=0;
 f.tools.draft.cancel();assert.deepEqual(f.state.scope.points,[prior]);assert.equal(f.state.seq,1);assert.equal(f.tools.draft.points.length,0);assert.deepEqual(f.events,['restoreIds']);assert.equal(f.state.created,null);
});


function centerlineFixture() {
 class Point { constructor(id,x,y){Object.assign(this,{id,x,y,sketchId:'S1'});} }
 class Line { constructor(id,p1,p2){Object.assign(this,{id,p1,p2});} dx(){return this.p2.x-this.p1.x;} dy(){return this.p2.y-this.p1.y;} length(){return Math.hypot(this.dx(),this.dy());} }
 class PairConstraint { constructor(a,b,line){Object.assign(this,{a,b,line});} }
 const events=[],sources=[new Point('P1',-10,0),new Point('P2',10,0)];
 const state={ready:false,allowed:true,commit:true,scope:{points:sources.slice(),lines:[],constraints:[]},pointSeq:3,lineSeq:1,mode:'select',constraint:null};
 const selection={points:sources.slice(),lines:[],set(field,value){assert.equal(this,selection);this[field]=value;events.push(['select',field]);}};
 const snap={active:null,clear:()=>{snap.active=null;events.push('snapClear');}};
 const preview={setPointer(point){assert.equal(this,preview);events.push(['preview',point]);}};
 const sandbox={window:{GeometrySolver:{Point,Line,hypot2:Math.hypot,ParallelLinesCenterlineConstraint:PairConstraint,PointPairCenterlineConstraint:PairConstraint},GeometryKernel:{MIN_ORIENTATION_LENGTH:1e-6,lineHasDirection:line=>line.length()>1e-6}}};vm.createContext(sandbox);
 for(const file of ['src/geometry/centerline_geometry.js','src/editing/centerline_construction.js','src/commands/centerline_command.js','src/application/basic_drawing_tools.js']) vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
 const command=sandbox.window.BasicDrawingTools.createCenterline({
  currentScope:()=>{assert.equal(state.ready,true);return state.scope;},geometry:{addPoint:(x,y)=>{const point=new Point('P'+state.pointSeq++,x,y);state.scope.points.push(point);return point;},addLine:(a,b,construction)=>{assert.equal(construction,true);const line=new Line('L'+state.lineSeq++,a,b);state.scope.lines.push(line);return line;}},
  ids:{peek:kind=>state[kind+'Seq'],restore:values=>Object.assign(state,values)},snapConstraints:{addPointSnapConstraints:(point,value)=>events.push(['attachSnap',point,value])},
  commitNewConstraint:(kind,constraint)=>{assert.equal(kind,'centerline');state.constraint=constraint;state.scope.constraints.push(constraint);return state.commit;},parallelTolerance:1e-5,minLineLength:1,
  cancelConstraintTargetCommand:message=>{assert.equal(message,'');events.push('constraintCancel');},cancelPendingCommand:message=>{assert.equal(message,'');events.push('pendingCancel');},
  canCreateInActiveSketch:()=>state.allowed,rejectRootSketchCreation:()=>events.push('reject'),clearSelection:()=>events.push('clearSelection'),updateToolbar:()=>events.push('toolbar'),
  selection,sameSketchElements:(items,id)=>items.every(item=>item.sketchId===id),activeSketchId:()=> 'S1',isActiveSketchElement:item=>item.sketchId==='S1',applicationText:jp=>jp,
  snapForDrawing:point=>{snap.active={point};return point;},snap,preview,setMode:mode=>{state.mode=mode;events.push('mode:'+mode);},
  invalidateAnalysis:()=>events.push('invalidate'),setHint:()=>events.push('hint'),updateUI:()=>events.push('ui'),draw:()=>events.push('draw'),
 });state.ready=true;return {command,state,sources,selection,events};
}

test('Centerline composition keeps preselected source identities through support projection and construction commit',()=>{
 const f=centerlineFixture();assert.deepEqual(f.events,[]);f.command.start();assert.equal(f.state.mode,'centerline');
 assert.equal(f.command.targets[0],f.sources[0]);assert.equal(f.command.targets[1],f.sources[1]);assert.equal(f.events.includes('clearSelection'),false);
 f.command.click({x:5,y:-10});assert.equal(f.command.firstPoint.x,0);assert.equal(f.command.firstPoint.y,-10);
 f.command.click({x:5,y:10});assert.equal(f.state.scope.lines.length,1);const line=f.state.scope.lines[0];
 assert.equal(f.state.constraint.a,f.sources[0]);assert.equal(f.state.constraint.b,f.sources[1]);assert.equal(f.state.constraint.line,line);
 assert.equal(line.p1.x,0);assert.equal(line.p2.x,0);assert.equal(f.selection.lines[0],line);assert.equal(f.state.mode,'select');assert.equal(f.command.firstPoint,null);
});

test('Centerline construction rejection retains command input while restoring the same scope arrays and sequence values',()=>{
 const f=centerlineFixture();f.command.start();f.command.click({x:0,y:-10});const first=f.command.firstPoint;f.state.commit=false;f.events.length=0;
 f.command.click({x:0,y:10});assert.equal(f.state.scope.points.length,2);assert.equal(f.state.scope.lines.length,0);assert.equal(f.state.scope.constraints.length,0);
 assert.equal(f.state.pointSeq,3);assert.equal(f.state.lineSeq,1);assert.equal(f.command.firstPoint,first);assert.equal(f.state.mode,'centerline');
 assert.deepEqual(f.events.slice(-3),['invalidate','ui','draw']);
});

test('Centerline start refuses a disallowed drawing target after existing command cancellation without changing selection',()=>{
 const f=centerlineFixture();f.state.allowed=false;f.command.start();assert.deepEqual(f.events,['constraintCancel','pendingCancel','reject']);
 assert.equal(f.selection.points[0],f.sources[0]);assert.equal(f.state.mode,'select');assert.equal(f.command.targets.length,0);
});

function authoringFixture(overrides = {}) {
 const created={},events=[],state={scale:2,snapped:{x:3,y:4},snap:{id:'snap'},selected:null,mode:'select'};
 const names=['DrawingSnap','SplineDraft','SplineCommand','SnapConstraints','LineCommand','RectangleCommand','CircularConstruction','CircularCommands','SlotConstruction','SlotCommand','CenterlineGeometry','CenterlineConstruction','CenterlineCommand','OffsetFeature','FilletFeature'];
 const sandbox={window:{}};
 for(const name of names) sandbox.window[name]={create(ports){
  events.push(name);const owner={name,active:null,clear:()=>{}};
  owner.reset=()=>events.push(name+'.reset');owner.cancel=()=>events.push(name+'.cancel');owner.targets=[];owner.points=[];
  for(const method of ['resetCircle','resetArcs','resetCenterArc'])owner[method]=()=>events.push(name+'.'+method);
  if(name==='DrawingSnap')owner.clear=()=>events.push('snap');
  owner.resolve=function(point,tolerance){assert.equal(this,owner);events.push(['resolve',point,tolerance]);owner.active=state.snap;return state.snapped;};
  for(const method of ['click','clickCircle','clickArc','clickThreePointArc'])owner[method]=function(...args){assert.equal(this,owner);events.push([name,method,...args]);};
  if(name==='SnapConstraints')for(const key of ['addPointSnapConstraints','addArcEndpointSnapConstraints','addCircularBoundarySnapConstraints','addLineBoundarySnapConstraints'])owner[key]=()=>{};
  created[name]={ports,owner};return owner;
 }};
 vm.runInNewContext(fs.readFileSync('src/application/basic_drawing_tools.js','utf8'),sandbox);
 vm.runInNewContext(fs.readFileSync('src/editing/draw_operation_lifecycle.js','utf8'),sandbox);
 const noop=()=>{},never=()=>{throw Error('no eager query or operation');};
 const sketchContext=Object.fromEntries(['isActiveSketchElement','elementSketchId','isReferenceSourceSketchId','sketchName','sameSketchElements','activeSketchId'].map(key=>[key,never]));
 const pointUsage=Object.fromEntries(['isSplineOnlyFitPoint','isReferencePoint','isPrimitiveCenterPoint','isEndpointPoint','isPointUsedByPrimitive','isExplicitPoint'].map(key=>[key,never]));
 const selection={set(key,items){assert.equal(this,selection);state.selected={key,items};events.push('selected');}};
 const ports={currentScope:never,ids:{},geometry:Object.fromEntries(['addPoint','addLine','addCircle','addArc','addSpline'].map(key=>[key,noop])),endpointAt:noop,samePosition:noop,
  sketchContext,pointUsage,geometryReads:{},isVisibleSketchElement:never,annotationAnchors:never,scale:()=>state.scale,
  transientAuthoring:{clearTransientPointRollback:()=>events.push('clearPoint'),clearTransientLineCompletionRollback:()=>events.push('clearCompletion'),rollbackTransientLineStart:()=>events.push('rollbackLine')},pushModelConstraint:noop,addConstraintIfMissing:noop,
  minLineLength:4,minArcLength:6,selection,preview:{setPointer:()=>events.push('pointer'),reset:()=>events.push('preview')},checkpoint:{capture:never,restore:never},cancelConstraintTargetCommand:()=>events.push('cancelConstraint'),cancelPendingCommand:()=>events.push('cancelPending'),
  canCreateInActiveSketch:never,rejectRootSketchCreation:noop,setMode:value=>{state.mode=value;events.push('mode');},resetEditing:()=>events.push('editing'),resetBlankCandidate:never,updateToolbar:()=>events.push('toolbar'),
  projection:{reset:()=>events.push('projection')},clearSelection:()=>events.push('clear'),solveAndRefresh:noop,recordHistory:noop,applicationText:(_ja,en)=>en,setHint:()=>events.push('hint'),updateUI:()=>events.push('ui'),draw:()=>events.push('draw'),log:noop};
 Object.assign(ports,overrides);
 const feature=sandbox.window.BasicDrawingTools.createAuthoring(ports);
 return {created,events,state,ports,feature,sandbox,createLifecycleSession:sandbox.window.DrawOperationLifecycle.createSession};
}

function previewFixture() {
 const f=authoringFixture(),calls=[],state={ready:false,pointer:{x:12,y:8},trim:null,mode:'select',sizeFailure:null};
 f.sandbox.window.GeometrySolver={hypot2:Math.hypot};
 for(const file of ['src/geometry/geometry_kernel.js','src/geometry/spline_geometry.js','src/rendering/authoring_preview_renderer.js'])
  vm.runInNewContext(fs.readFileSync(file,'utf8'),f.sandbox);
 const ready=()=>assert.equal(state.ready,true,'preview construction must remain lazy');
 Object.defineProperties(f.ports.preview,{pointer:{get(){ready();return state.pointer;}},trim:{get(){ready();return state.trim;}}});
 const ctx=Object.fromEntries(['beginPath','moveTo','lineTo','arc','stroke','fill','strokeRect','setLineDash']
  .map(name=>[name,(...args)=>{ready();calls.push([name,...args]);}])),viewport={scale:2};
 const centerline={support:null,firstPoint:null,projectPointToCenterlineSupport(point){assert.equal(point,state.pointer);return point;}};
 f.events.length=0;
 const result=f.feature.createPreview({ctx,viewport,withCanvasState:work=>{calls.push(['enter']);try{work();}finally{calls.push(['exit']);}},
  traceSplinePath:spline=>calls.push(['spline',spline.curve()]),readMode:()=>{ready();return state.mode;},centerlineCommand:centerline,
  readCanvasSize:()=>{ready();calls.push(['size']);if(state.sizeFailure)throw state.sizeFailure;return {width:100,height:80};}});
 assert.deepEqual(f.events,[]);assert.deepEqual(calls,[]);assert.ok(Object.isFrozen(result));state.ready=true;
 return {...f,...result,calls,previewState:state,ctx,viewport,centerline};
}

test('authoring presentation reads the same primitive commands, Spline draft and current pointer without a second preview state',()=>{
 const f=previewFixture(),state=f.previewState;
 f.feature.tools.line.startPoint={x:1,y:2};state.mode='line';f.layer.draw();
 assert.ok(f.calls.some(c=>c[0]==='moveTo'&&c[1]===1&&c[2]===2));
 assert.ok(f.calls.some(c=>c[0]==='lineTo'&&c[1]===12&&c[2]===8));
 f.calls.length=0;f.feature.tools.line.startPoint={x:3,y:4};state.pointer={x:20,y:10};f.layer.draw();
 assert.ok(f.calls.some(c=>c[0]==='moveTo'&&c[1]===3&&c[2]===4));assert.ok(f.calls.some(c=>c[0]==='lineTo'&&c[1]===20));
 f.calls.length=0;state.mode='rectangle';f.feature.tools.rectangle.startPoint={x:2,y:3};f.layer.draw();
 assert.ok(f.calls.some(c=>c[0]==='strokeRect'&&c[1]===2&&c[2]===3&&c[3]===18&&c[4]===7));
 f.calls.length=0;state.mode='spline';f.feature.spline.draft.points=[{x:0,y:0},{x:10,y:5}];f.layer.draw();
 assert.equal(f.calls.filter(c=>c[0]==='spline').length,1);
 f.feature.spline.draft.points=[];state.pointer=null;f.calls.length=0;f.layer.draw();assert.deepEqual(f.calls,[]);
});

test('authoring presentation keeps Centerline guards, size failure boundaries and the live Fillet painter scale',()=>{
 const f=previewFixture(),state=f.previewState;state.mode='centerline';f.layer.draw();assert.deepEqual(f.calls,[]);
 f.centerline.support={ok:true,anchor:{x:0,y:0},ux:0,uy:1};state.sizeFailure=new Error('size failed');
 assert.throws(()=>f.layer.draw(),error=>error===state.sizeFailure);assert.deepEqual(f.calls,[['size']]);
 state.sizeFailure=null;f.calls.length=0;f.layer.draw();assert.equal(f.calls[0][0],'size');assert.equal(f.calls.at(-1)[0],'exit');
 f.calls.length=0;f.viewport.scale=4;f.renderer.drawFilletArc({center:{x:3,y:4},radius:5,startAngle:0,endAngle:1});
 assert.equal(f.ctx.lineWidth,0.5);assert.ok(f.calls.some(c=>c[0]==='arc'&&c[1]===3&&c[2]===4&&c[3]===5));
});

test('authoring assembly shares actual snap, draft, geometry and checkpoint ports and defers Centerline construction',()=>{
 const f=authoringFixture();assert.deepEqual(f.events,['DrawingSnap','SplineDraft','SplineCommand','SnapConstraints','LineCommand','RectangleCommand','CircularConstruction','CircularCommands','SlotConstruction','SlotCommand']);
 assert.equal(f.feature.snap,f.created.DrawingSnap.owner);assert.equal(f.feature.spline.draft,f.created.SplineDraft.owner);assert.equal(f.feature.spline.command,f.created.SplineCommand.owner);
 assert.equal(f.feature.snapConstraints,f.created.SnapConstraints.owner);assert.equal(f.feature.tools.line,f.created.LineCommand.owner);
 assert.equal(f.created.DrawingSnap.ports.geometryReads,f.ports.geometryReads);assert.equal(f.created.DrawingSnap.ports.annotationAnchors,f.ports.annotationAnchors);
 assert.equal(f.created.DrawingSnap.ports.isActiveSketchElement,f.ports.sketchContext.isActiveSketchElement);
 for(const key of Object.keys(f.ports.pointUsage))assert.equal(f.created.DrawingSnap.ports[key],f.ports.pointUsage[key]);
 assert.equal(f.created.SplineDraft.ports.currentScope,f.ports.currentScope);assert.equal(f.created.SplineCommand.ports.addSpline,f.ports.geometry.addSpline);
 assert.equal(f.created.SnapConstraints.ports.addPoint,f.ports.geometry.addPoint);assert.equal(f.created.SlotConstruction.ports.snapshotGeometryMutationState,f.ports.checkpoint.capture);
 assert.equal(f.created.SlotConstruction.ports.restoreGeometryMutationState,f.ports.checkpoint.restore);
 const commit=()=>{},invalidate=()=>{};const center=f.feature.createCenterline({commitNewConstraint:commit,parallelTolerance:0.125,invalidateAnalysis:invalidate});
 assert.deepEqual(f.events.slice(-3),['CenterlineGeometry','CenterlineConstruction','CenterlineCommand']);assert.equal(center,f.created.CenterlineCommand.owner);
 assert.equal(f.created.CenterlineConstruction.ports.geometry,f.ports.geometry);assert.equal(f.created.CenterlineConstruction.ports.ids,f.ports.ids);
 assert.equal(f.created.CenterlineConstruction.ports.addPointSnapConstraints,f.feature.snapConstraints.addPointSnapConstraints);assert.equal(f.created.CenterlineConstruction.ports.commitNewConstraint,commit);
 assert.equal(f.created.CenterlineCommand.ports.selection,f.ports.selection);assert.equal(f.created.CenterlineCommand.ports.minLineLength,4);
 assert.equal(f.created.CenterlineCommand.ports.activeSketchId,f.ports.sketchContext.activeSketchId);assert.equal(f.created.CenterlineCommand.ports.invalidateAnalysis,invalidate);
});

test('shared authoring snap reads scale on every input and preserves post-resolution snap and selected Spline identity',()=>{
 const f=authoringFixture(),pointer={x:10,y:20};f.events.length=0;
 f.feature.tools.input.rectangle(pointer);assert.deepEqual(f.events,[['resolve',pointer,5],['RectangleCommand','click',f.state.snapped,f.state.snap]]);
 f.state.scale=5;f.state.snap={id:'new'};f.events.length=0;f.feature.createCenterline({commitNewConstraint:()=>{},parallelTolerance:0.1,invalidateAnalysis:()=>{}});
 f.events.length=0;const value=f.created.CenterlineCommand.ports.snapForDrawing(pointer);
 assert.equal(value.point,f.state.snapped);assert.equal(value.snap,f.state.snap);assert.deepEqual(f.events,[['resolve',pointer,2]]);
 const spline={id:'SP1'};f.events.length=0;f.created.SplineCommand.ports.selectCreatedSpline(spline);
 assert.equal(f.state.selected.key,'splines');assert.equal(f.state.selected.items[0],spline);assert.equal(f.state.mode,'select');assert.deepEqual(f.events,['selected','mode']);
});

function lifecycleFixture(overrides = {}) {
 const f=authoringFixture(overrides),external={};
 for(const name of ['instances','instanceSources','centerline','fillet','offset']){
  const owner={reset(){assert.equal(this,owner);f.events.push(name);},clearSources(){assert.equal(this,owner);f.events.push('sources');}};
  external[name]=owner;
 }
 external.centerline.targets=[];external.offset.entries=[];
 const stage={...external,canStart:()=>true,hatch:{reset:()=>f.state.hatch.reset()},readMode:()=>f.state.mode,clearTrimHover:()=>f.events.push('trimHover')};
 f.events.length=0;const lifecycle=f.feature.createLifecycle(stage);assert.deepEqual(f.events,[]);
 f.state.hatch={reset(){assert.equal(this,f.state.hatch);f.events.push('hatch');}};
 return {...f,lifecycle,external};
}

test('authoring assembly binds its actual commands to an early Lifecycle session without a second mode owner',()=>{
 const f=lifecycleFixture(),session=f.createLifecycleSession();session.setMode('spline');f.events.length=0;
 const result=f.feature.createLifecycle({lifecycle:session,...f.external,canStart:()=>true,hatch:{reset:()=>f.state.hatch.reset()},clearTrimHover:()=>f.events.push('trimHover')});
 assert.equal(result,session);assert.equal(session.mode,'spline');assert.deepEqual(f.events,[]);
 session.cancel();assert.equal(session.mode,'spline');assert.equal(f.events.includes('SplineDraft.cancel'),true);assert.equal(f.events.includes('rollbackLine'),true);
 f.events.length=0;session.exit();assert.equal(session.mode,'select');assert.equal(f.events.includes('mode'),false);
 assert.equal(f.events.includes('SplineDraft.reset'),true);assert.equal(f.events.includes('SplineDraft.cancel'),false);
 assert.equal(session.start('line'),true);assert.equal(session.mode,'line');assert.equal(f.state.mode,'select');
});

function authoringInputFixture() {
 const solved=[],f=authoringFixture({solveAndRefresh:label=>solved.push(label)}),state={mode:'point',reject:false,created:[],constraints:[]};
 for(const file of ['src/commands/point_command.js','src/editing/drawing_command_input.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),f.sandbox);
 const selection=f.ports.selection;
 selection.set=function(key,value){assert.equal(this,selection);selection[key]=value;f.events.push(['selection',key]);};
 const transient=f.ports.transientAuthoring;
 transient.beginTransientPointRollback=function(){assert.equal(this,transient);f.events.push('beginPoint');if(state.failure)throw state.failure;};
 transient.markCreatedPoint=function(point){assert.equal(this,transient);f.events.push(['created',point]);};
 f.ports.geometry.addPoint=function(x,y,fixed){'use strict';assert.equal(this,undefined);const point={x,y,fixed};state.created.push(point);return point;};
 f.created.SnapConstraints.owner.addPointSnapConstraints=function(point,snap){'use strict';assert.equal(this,undefined);state.constraints.push([point,snap]);};
 const routed=[],bare=name=>function(){'use strict';assert.equal(this,undefined);routed.push([name,...arguments]);};
 const offset={click(point,hits){assert.equal(this,offset);routed.push(['offset',point,hits]);}};
 f.events.length=0;
 const input=f.feature.createCanvasInput({readMode:()=>state.mode,centerline:{click:bare('centerline')},circleCenterCross:{click:bare('cross')},
  fillet:{click:bare('fillet')},trim:{execute:bare('trim')},offset});
 assert.deepEqual(f.events,[]);assert.deepEqual(routed,[]);assert.deepEqual(solved,[]);
 return {...f,input,inputState:state,routed,solved,selection};
}

test('authoring Canvas input uses the same snap, transient and Selection for actual Point creation and stops at rollback failure',()=>{
 const f=authoringInputFixture(),pointer={x:10,y:20},event={preventDefault(){throw Error('unexpected rejection');}};
 assert.equal(f.input.click(event,pointer,{}),true);
 assert.equal(f.inputState.created.length,1);assert.equal(f.selection.points[0],f.inputState.created[0]);
 assert.equal(f.inputState.constraints[0][0],f.selection.points[0]);assert.equal(f.inputState.constraints[0][1],f.state.snap);
 assert.equal(f.selection.points[0].x,f.state.snapped.x);assert.equal(f.selection.points[0].fixed,false);
 assert.equal(f.events[0],'clearPoint');assert.equal(f.events[1],'beginPoint');assert.equal(f.events[2][0],'resolve');
 assert.equal(f.events[2][2],5);assert.equal(f.events[3][0],'created');assert.equal(f.events[4],'snap');assert.deepEqual(f.solved,['点追加']);
 f.events.length=0;f.inputState.failure=new Error('rollback failed');
 assert.throws(()=>f.input.click(event,pointer,{}),error=>error===f.inputState.failure);
 assert.deepEqual(f.events,['clearPoint','beginPoint']);assert.equal(f.inputState.created.length,1);assert.deepEqual(f.solved,['点追加']);
});

test('authoring Canvas input preserves specialized argument order, raw callbacks, Offset receiver and unknown-mode refusal',()=>{
 const f=authoringInputFixture(),point={},hitP={},hitL={},hitC={},hitA={},event={shiftKey:true};
 for(const [mode,name,args]of [['centerline','centerline',[point,hitP,hitL]],['circle-center-cross','cross',[hitC]],['fillet','fillet',[hitL,point]],['trim','trim',[point]]]){
  f.inputState.mode=mode;assert.equal(f.input.click(event,point,{hitP,hitL,hitC,hitA}),true);assert.deepEqual(f.routed.at(-1),[name,...args]);
 }
 f.inputState.mode='offset';f.input.click(event,point,{hitP,hitL,hitC,hitA});assert.equal(f.routed.at(-1)[2].hitA,hitA);
 assert.equal(f.routed.at(-1)[2].hitC,hitC);assert.equal(f.routed.at(-1)[2].hitL,hitL);
 f.inputState.mode='select';const count=f.routed.length;assert.equal(f.input.click(event,point,{}),false);assert.equal(f.routed.length,count);
});

function blankGestureFixture() {
 const f=lifecycleFixture(),state={ready:false,pending:null,constraint:null,edit:null,time:0,selected:false,completion:false,failure:null};
 f.sandbox.window.GeometrySolver={hypot2:Math.hypot};
 vm.runInNewContext(fs.readFileSync('src/editing/blank_canvas_gesture.js','utf8'),f.sandbox);
 const session=f.createLifecycleSession();
 f.feature.createLifecycle({lifecycle:session,...f.external,hatch:f.state.hatch,clearTrimHover:()=>{}});
 const check=()=>assert.equal(state.ready,true);
 const bare=name=>function(){'use strict';assert.equal(this,undefined);f.events.push([name,...arguments]);return state.finishResult;};
 const editing={get current(){check();return state.edit;},finish:bare('finish-edit')};
 const annotation={finish(){assert.equal(this,annotation);f.events.push(['annotation']);}};
 f.created.SplineCommand.owner.doubleClick=bare('spline-double');
 f.ports.selection.hasSelection=function(){'use strict';assert.equal(this,undefined);check();return state.selected;};
 Object.assign(f.ports.transientAuthoring,{isLineStartHit:()=>false,isLineCompletionHit:()=>state.completion,isPointHit:()=>false,
  rollbackTransientLineCompletion:bare('rollback-completion'),rollbackTransientPoint:bare('rollback-point')});
 const originalRollback=f.ports.transientAuthoring.rollbackTransientLineCompletion;
 f.ports.transientAuthoring.rollbackTransientLineCompletion=function(){'use strict';assert.equal(this,undefined);if(state.failure)throw state.failure;return originalRollback();};
 f.events.length=0;
 const gesture=f.feature.createBlankGesture({lifecycle:session,pending:{get current(){check();return state.pending;}},
  constraintTargets:{get command(){check();return state.constraint;}},splineEditing:editing,dimensionValues:{submit:bare('dimension')},
  offset:{submit:bare('offset')},annotationInput:annotation,updateGeometrySelectionUI:()=>f.events.push('selection-ui'),
  getTime:()=>{check();return state.time;}});
 assert.deepEqual(f.events,[]);state.ready=true;return {...f,gesture,session,gestureState:state};
}

test('bound blank gesture shares the live Lifecycle and command owners while preserving completion priority and raw results',()=>{
 const f=blankGestureFixture(),s=f.gestureState,pointer={x:4,y:5};s.pending={type:'distance-value'};s.edit={};f.session.setMode('spline');
 assert.equal(f.gesture.handle(pointer),true);assert.deepEqual(f.events,[['spline-double',pointer]]);
 f.events.length=0;f.session.setMode('select');s.finishResult={finished:true};
 assert.equal(f.gesture.handle(pointer),s.finishResult);assert.deepEqual(f.events,[['finish-edit']]);
 for(const [type,expected]of [['distance-value','dimension'],['offset-value','offset'],['annotation-value','annotation']]){
  s.edit=null;s.pending={type};f.events.length=0;assert.equal(f.gesture.handle(pointer),true);assert.deepEqual(f.events,[[expected]]);
 }
 s.pending={type:'other'};s.constraint={};f.session.setMode('point');f.events.length=0;
 assert.equal(f.gesture.handle(pointer),true);assert.equal(f.events[0],'cancelPending');assert.equal(f.session.mode,'select');assert.equal(f.events.includes('cancelConstraint'),false);
 s.pending=null;f.events.length=0;f.gesture.handle(pointer);assert.deepEqual(f.events,['cancelConstraint']);
 s.constraint=null;s.selected=true;f.events.length=0;f.gesture.handle(pointer);assert.deepEqual(f.events,['clear','hint','selection-ui','draw']);
});

test('bound blank gesture rolls back the actual transient and line draft in order and stops at rollback failure',()=>{
 const f=blankGestureFixture(),s=f.gestureState;f.session.setMode('line');s.completion=true;
 const point={id:'P1'};f.feature.tools.line.startPoint=point;
 assert.equal(f.gesture.handle({}, {hitP:point,hitL:{}}),true);
 assert.deepEqual(f.events,[['rollback-completion'],'LineCommand.reset','pointer','snap','clear','hint','ui','draw']);
 f.events.length=0;s.failure=new Error('rollback failed');
 assert.throws(()=>f.gesture.handle({}, {hitP:point,hitL:{}}),error=>error===s.failure);assert.deepEqual(f.events,[]);
 assert.equal(f.feature.tools.line.startPoint,point);assert.equal(f.session.mode,'line');
 s.failure=null;f.events.length=0;f.session.setMode('point');f.gesture.handle({});
 assert.deepEqual(f.events[0],['rollback-point']);assert.equal(f.session.mode,'select');
});

test('authoring Lifecycle reuses the created drafts and preserves distinct Sketch reset, cancel and exit effects',()=>{
 const f=lifecycleFixture();assert.equal(f.lifecycle.active(),false);assert.deepEqual(f.events,[]);
 f.lifecycle.resetInputsForSketchChange();assert.deepEqual(f.events,['LineCommand.reset','RectangleCommand.reset','fillet','CircularCommands.resetCircle','CircularCommands.resetArcs','preview','offset']);
 f.events.length=0;f.state.mode='spline';f.lifecycle.cancel();assert.equal(f.state.mode,'spline');
 assert.deepEqual(f.events,['centerline','rollbackLine','clearPoint','clearCompletion','LineCommand.reset','RectangleCommand.reset','SlotCommand.reset','fillet','CircularCommands.resetCircle','CircularCommands.resetArcs','SplineDraft.cancel','editing','projection','preview','offset','hatch','snap','clear','hint','ui','draw']);
 f.events.length=0;f.lifecycle.exit();assert.equal(f.state.mode,'select');assert.equal(f.events.includes('SplineDraft.reset'),true);
 assert.equal(f.events.includes('SplineDraft.cancel'),false);assert.equal(f.events.includes('rollbackLine'),false);assert.deepEqual(f.events.slice(-5),['mode','toolbar','hint','ui','draw']);
});

test('authoring Lifecycle retains Document discard boundaries and stops at a failed reset after selecting mode',()=>{
 const f=lifecycleFixture();f.lifecycle.resetForDocument();
 assert.deepEqual(f.events,['LineCommand.reset','centerline','clearPoint','clearCompletion','RectangleCommand.reset','SlotCommand.reset','fillet','CircularCommands.resetCircle','CircularCommands.resetArcs','SplineDraft.reset','projection','sources','instanceSources','editing','pointer','offset']);
 f.events.length=0;f.state.mode='slot';const marker=new Error('circle reset failed');f.created.CircularCommands.owner.resetCircle=()=>{throw marker;};
 assert.throws(()=>f.lifecycle.prepareConstraintStart(),error=>error===marker);
 assert.equal(f.state.mode,'select');assert.deepEqual(f.events,['cancelPending','centerline','SlotCommand.reset','mode','LineCommand.reset','RectangleCommand.reset','fillet']);
});

test('authoring Offset shares capabilities while retaining a distinct live scope and delayed Lifecycle preparation',()=>{
 const f=authoringFixture();f.events.length=0;let current={id:'offset-scope'},lifecycle=null;
 const never=()=>{throw Error('no eager operation');};
 const options={currentScope:()=>current,placement:{},sourceSelection:{},pending:{},valueInput:{},viewport:{},ctx:{},withCanvasState:never,drawDimension:never,
  readMode:never,commitNewConstraint:never,offsetChainErrorText:never,prepareStart:()=>lifecycle.prepare('offset'),updateGeometrySelectionUI:never,invalidateAnalysis:never};
 const result=f.feature.createOffset(options),child=f.created.OffsetFeature;
 assert.equal(result,child.owner);assert.deepEqual(f.events,['OffsetFeature']);
 for(const key of Object.keys(options))assert.equal(child.ports[key],options[key],key);
 for(const key of ['geometry','ids','selection','preview','minLineLength','minArcLength','applicationText','cancelConstraintTargetCommand','cancelPendingCommand','clearSelection','setHint','updateUI','draw','updateToolbar'])assert.equal(child.ports[key],f.ports[key],key);
 assert.equal(child.ports.clearSnap,f.feature.snap.clear);assert.notEqual(child.ports.currentScope,f.ports.currentScope);
 current={id:'new-offset-scope'};assert.equal(child.ports.currentScope(),current);
 lifecycle={prepare(mode){assert.equal(this,lifecycle);f.events.push(mode);}};child.ports.prepareStart();assert.deepEqual(f.events,['OffsetFeature','offset']);
});

test('authoring Fillet retains its own checkpoint and raw stabilize, pointer and failure callbacks',()=>{
 const f=authoringFixture();f.events.length=0;const marker=new Error('stabilization failed'),checkpoint={captureGeometry:()=>{},restoreGeometry:()=>{}};let pointer={x:1,y:2},lifecycle=null;
 const options={defaultDimensionForTarget:()=>{},syncLineOrientationHints:()=>{},pending:{},readPointer:()=>pointer,prepareStart:()=>lifecycle.prepare('fillet'),
  guardSketchProjectionShapeEdit:()=>{},valueInput:{},checkpoint,stabilize:()=>{throw marker;},acceptError:0.0125,invalidateAnalysis:()=>{},refreshConstraintAnalysis:()=>{},updateGeometrySelectionUI:()=>{}};
 const result=f.feature.createFillet(options),child=f.created.FilletFeature;assert.equal(result,child.owner);assert.deepEqual(f.events,['FilletFeature']);
 for(const key of Object.keys(options))assert.equal(child.ports[key],options[key],key);
 for(const key of ['geometry','minLineLength','pushModelConstraint','selection','updateToolbar','clearSelection','applicationText','setHint','updateUI','draw','recordHistory','cancelConstraintTargetCommand'])assert.equal(child.ports[key],f.ports[key],key);
 assert.equal(child.ports.clearSnap,f.feature.snap.clear);assert.notEqual(child.ports.checkpoint,f.ports.checkpoint);
 pointer={x:3,y:4};assert.equal(child.ports.readPointer(),pointer);
 lifecycle={prepare(mode){assert.equal(this,lifecycle);f.events.push(mode);}};child.ports.prepareStart();
 assert.throws(()=>child.ports.stabilize(),error=>error===marker);assert.deepEqual(f.events,['FilletFeature','fillet']);
});

function circleCrossAuthoringFixture() {
 const calls=[],state={sketch:'S1',allowed:true,accepted:true,result:{success:true,result:{}},seq:0,mode:'select',histories:[]};
 const model={points:[],lines:[],constraints:[]},selection={circles:[],set(kind,items){assert.equal(this,selection);state.selected={kind,items};calls.push('select');}};
 let types;
 const f=authoringFixture({geometry:{addPoint(x,y,fixed,kind){const p=new types.Point('P'+(++state.seq),x,y,fixed,kind);model.points.push(p);return p;},
  addLine(a,b,construction){const l=new types.Line('L'+(++state.seq),a,b,construction);model.lines.push(l);return l;}},
  pushModelConstraint(c,sketch){c.sketchId=sketch;model.constraints.push(c);},selection,
  sketchContext:{activeSketchId:()=>state.sketch,isActiveSketchElement:item=>item.sketchId===state.sketch},
  canCreateInActiveSketch:()=>state.allowed,rejectRootSketchCreation:()=>calls.push('reject'),
  cancelConstraintTargetCommand:value=>calls.push(['cancelConstraint',value]),cancelPendingCommand:value=>calls.push(['cancelPending',value]),
  setMode:value=>{state.mode=value;calls.push('mode');},clearSelection:()=>{selection.circles=[];calls.push('clear');},
  updateUI:()=>calls.push('ui'),draw:()=>calls.push('draw'),setHint:()=>calls.push('hint'),recordHistory:label=>state.histories.push(label)});
 vm.createContext(f.sandbox);
 for(const file of ['geometry/geometry_kernel.js','geometry/spline_geometry.js','solver/constraint_solver.js','commands/circle_center_cross_command.js'])
  vm.runInContext(fs.readFileSync('src/'+file,'utf8'),f.sandbox);
 types=f.sandbox.window.GeometrySolver;
 const circle=new types.Circle('C1',new types.Point('P0',10,20),5);circle.sketchId='S1';model.points.push(circle.center);
 const checkpoint={captureGeometry(){calls.push('capture');return {seq:state.seq,points:model.points.length,lines:model.lines.length,constraints:model.constraints.length};},
  restoreGeometry(snapshot){calls.push('restore');state.seq=snapshot.seq;for(const key of ['points','lines','constraints'])model[key].length=snapshot[key];}};
 const options={checkpoint,solveSketchAndDependents:sketch=>{calls.push(['solve',sketch]);return state.result;},resultIsAccepted:()=>state.accepted,
  minOrientationLength:0.01,selectedElementCount:()=>selection.circles.length,invalidateAnalysis:()=>calls.push('analysis')};
 calls.length=0;f.events.length=0;
 const command=f.feature.createCircleCenterCross(options);
 return {...f,calls,crossState:state,model,selection,circle,command,types};
}

test('authoring circle cross uses live Sketch, shared selection and the explicit geometry checkpoint without eager operations',()=>{
 const f=circleCrossAuthoringFixture();assert.deepEqual(f.calls,[]);assert.deepEqual(f.events,[]);assert.equal(Object.isFrozen(f.command),true);
 f.crossState.sketch='S2';assert.equal(f.command.click(f.circle),false);assert.equal(f.model.points.length,1);assert.equal(f.crossState.seq,0);
 f.crossState.sketch='S1';f.selection.circles=[f.circle];f.calls.length=0;f.command.start();
 assert.deepEqual(f.calls.slice(0,4),[['cancelConstraint',''],['cancelPending',''],'capture',['solve','S1']]);
 assert.equal(f.model.points[0],f.circle.center);assert.equal(f.model.lines.length,2);assert.equal(f.model.constraints.length,8);
 assert.equal(f.model.lines.every(line=>line.construction),true);assert.equal(f.model.constraints.every(c=>c.sketchId==='S1'),true);
 assert.deepEqual(f.model.lines.map(l=>[l.p1.x,l.p1.y,l.p2.x,l.p2.y]),[[10,15,10,25],[5,20,15,20]]);
 assert.equal(f.crossState.selected.kind,'lines');assert.equal(f.crossState.selected.items[0],f.model.lines[0]);
 assert.equal(f.crossState.mode,'select');assert.deepEqual(f.crossState.histories,['円中心十字線']);assert.deepEqual(f.events,['pointer','snap']);
});

test('authoring circle cross preserves failed solve rollback and creation rejection without touching primitive checkpoints',()=>{
 for(const failure of ['solver','dependent','accept']){
  const f=circleCrossAuthoringFixture(),arrays={...f.model};
  if(failure==='solver')f.crossState.result.success=false;
  if(failure==='dependent')f.crossState.result.dependent={success:false};
  if(failure==='accept')f.crossState.accepted=false;
  f.crossState.mode='circle-center-cross';assert.equal(f.command.click(f.circle),false);
  assert.deepEqual(f.calls.slice(0,4),['capture',['solve','S1'],'restore',['solve','S1']]);
  for(const key of Object.keys(arrays))assert.equal(f.model[key],arrays[key]);
  assert.equal(f.model.points[0],f.circle.center);assert.equal(f.model.points.length,1);assert.equal(f.model.lines.length,0);assert.equal(f.model.constraints.length,0);
  assert.equal(f.crossState.seq,0);assert.equal(f.crossState.mode,'circle-center-cross');assert.deepEqual(f.crossState.histories,[]);
  f.calls.length=0;f.crossState.allowed=false;f.command.start();
  assert.deepEqual(f.calls,[['cancelConstraint',''],['cancelPending',''],'reject']);
 }
});
function geometryFoundationFixture({composed=false,prepared=false,probe=null,configure=null}={}){
 const sandbox={window:{},structuredClone};vm.createContext(sandbox);
 const sources=vm.runInNewContext(fs.readFileSync('index.html','utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
 for(const file of sources.filter(p=>p.startsWith('src/')))vm.runInContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
 const w=sandbox.window,events=[],empty=()=>({points:[],lines:[],circles:[],arcs:[],splines:[],constraints:[]});
 const state={ready:false,scope:empty(),sketch:'S1',construction:false,endpoint:null,explicit:null,failure:null};
 const read=()=>{assert.equal(state.ready,true,'no eager scope or hit read');return state.scope;},ids=w.GeometryIds.create();
 const preparation=prepared?w.BasicDrawingTools.prepare():null;
 const geometryOptions={currentScope:read,ids,assignSketchId:item=>{read();item.sketchId=state.sketch;},
  currentConstruction:()=>{read();return state.construction;},minLineLength:4,minArcLength:6,
  hitEndpointPoint:(...args)=>{read();events.push(['endpoint',...args]);if(state.failure)throw state.failure;return state.endpoint;},
  hitExplicitPoint:(...args)=>{read();events.push(['explicit',...args]);return state.explicit;}};
 const foundation=preparation?preparation.createGeometry(geometryOptions):w.BasicDrawingTools.createGeometry(geometryOptions);
 let checkpoint;
 const noop=()=>{},pointUsage=Object.fromEntries(['isSplineOnlyFitPoint','isReferencePoint','isPrimitiveCenterPoint','isPointUsedByPrimitive'].map(k=>[k,()=>false]));
 Object.assign(pointUsage,{isEndpointPoint:p=>p.kind==='endpoint',isExplicitPoint:p=>p.kind==='explicit'});
 const sketchContext={isActiveSketchElement:p=>{read();return p.sketchId===state.sketch;},elementSketchId:p=>p.sketchId,isReferenceSourceSketchId:()=>false,
  sketchName:id=>id,activeSketchId:()=>{read();return state.sketch;},sameSketchElements:()=>true};
 const selection=w.CanvasSelection.create(),preview={setPointer:noop},lifecycle=w.DrawOperationLifecycle.createSession();
 const pending=w.PendingCommandSession.create({clearPlacement:()=>{read();if(probe)events.push('cancel-pending');}});
 const isVisibleSketchElement=()=>{read();return true;};
 const ports={samePosition:w.GeometryKernel.samePosition,sketchContext,pointUsage,
  geometryReads:Object.fromEntries(['allGeometryPoints','allGeometryLines','allGeometryCircles','allGeometryArcs','allGeometrySplines'].map(k=>[k,()=>{read();return k==='allGeometryPoints'?(state.snapPoints??[]):[];} ])),
  isVisibleSketchElement,annotationAnchors:()=>{read();return [];},scale:()=>state.scale??1,
  transientAuthoring:Object.fromEntries(['beginTransientLineStartRollback','beginTransientLineCompletionRollback','markCompletedLine','clearTransientLineStartRollback'].map(k=>[k,()=>events.push([k])])),
  pushModelConstraint:noop,addConstraintIfMissing:noop,selection,preview,
  checkpoint:{capture:(...args)=>checkpoint.capture(...args),restore:(...args)=>checkpoint.restore(...args)},
  cancelConstraintTargetCommand:noop,cancelPendingCommand:message=>pending.cancel(message),canCreateInActiveSketch:()=>{read();return state.allowed!==false;},rejectRootSketchCreation:()=>{read();events.push('reject');},
  setMode:lifecycle.setMode,resetEditing:()=>{read();if(probe?.editingFailure)throw probe.editingFailure;},resetBlankCandidate:noop,updateToolbar:noop,projection:{reset:noop},clearSelection:noop,
  solveAndRefresh:()=>({success:true}),recordHistory:noop,applicationText:(_ja,en)=>en,setHint:noop,updateUI:noop,draw:noop,log:noop};
 const owners={documentWorkspace:{sketches:sketchContext},readServices:{reads:ports.geometryReads,geometryAppearance:{isVisibleSketchElement}},
  interaction:{pointUsage,selection,lifecycle,access:{canCreateInActiveSketch:ports.canCreateInActiveSketch,rejectRootSketchCreation:ports.rejectRootSketchCreation}},
  sessions:{preview,pending},presentation:{settings:{applicationText:ports.applicationText},setHint:ports.setHint,updateUI:ports.updateUI,draw:ports.draw,log:ports.log},
  viewport:{get scale(){read();return state.scale??1;}}};
 if(configure)configure({w,state,owners,ports,events,ids,foundation});
 const remaining={...ports};
 for(const key of ['samePosition','sketchContext','pointUsage','geometryReads','isVisibleSketchElement','scale','selection','preview','cancelPendingCommand',
  'canCreateInActiveSketch','rejectRootSketchCreation','setMode','applicationText','setHint','updateUI','draw','log'])delete remaining[key];
 const originals=new Map();if(probe){probe.ports={};probe.order=[];
  for(const name of ['DrawingSnap','SplineCommand','LineCommand','SlotConstruction']){const original=w[name];originals.set(name,original);w[name]={...original,create(input){
   probe.order.push(name);probe.ports[name]=input;if(probe.failAt===name)throw probe.error;return original.create(input);}};}}
 let tools;try{tools=composed?foundation.createAuthoringForEditing({...remaining,...owners}):foundation.createAuthoring(ports);}
 finally{for(const[name,original]of originals)w[name]=original;}
 assert.deepEqual(events,[]);assert.equal(Object.isFrozen(foundation),true);state.ready=true;checkpoint=probe?.checkpoint??{capture:noop,restore:noop};
 return {foundation,preparation,geometryOptions,tools,state,ids,events,empty,owners,ports,w};
}

test('geometry foundation shares IDs, scope and construction with real drawing tools and retains endpoint versus explicit Point identity',()=>{
 const f=geometryFoundationFixture(),{foundation:b,tools,state,ids}=f,first=state.scope;
 const endpoint=b.geometry.addPoint(0,0,false,'endpoint'),explicit=b.geometry.addPoint(10,0);state.endpoint=endpoint;
 tools.tools.line.click({x:0,y:0});assert.equal(tools.tools.line.startPoint,endpoint);assert.equal(first.points.length,2);
 state.endpoint=null;state.explicit=explicit;state.construction=true;tools.tools.line.click({x:10,y:0});
 const line=first.lines[0];assert.equal(line.p1,endpoint);assert.notEqual(line.p2,explicit);assert.equal(line.p2.kind,'endpoint');
 assert.equal(line.p2.x,explicit.x);assert.equal(line.p2.y,explicit.y);assert.equal(line.p2.sketchId,'S1');assert.equal(line.construction,true);
 assert.equal(line.id,'L1');assert.equal(line.p2.id,'P3');assert.equal(ids.peek('point'),4);
 tools.tools.line.reset();state.scope=f.empty();state.sketch='S2';state.endpoint=null;state.explicit=null;
 tools.tools.line.click({x:20,y:0});assert.equal(state.scope.points[0].id,'P4');assert.equal(state.scope.points[0].sketchId,'S2');assert.equal(first.points.length,3);
 tools.tools.line.click({x:21,y:0});assert.equal(state.scope.lines[0].length(),4);assert.equal(state.scope.lines[0].construction,true);
});

test('geometry foundation preserves hit failure identity and stops before ID allocation, explicit hits and model insertion',()=>{
 const f=geometryFoundationFixture(),marker=new Error('hit failed');f.state.failure=marker;
 assert.throws(()=>f.tools.tools.line.click({x:2,y:3}),error=>error===marker);
 assert.equal(f.ids.peek('point'),1);assert.equal(f.state.scope.points.length,0);assert.equal(f.tools.tools.line.startPoint,null);
 assert.deepEqual(f.events,[['beginTransientLineStartRollback'],['endpoint',2,3]]);
});

function hatchAuthoringFixture({allocateFailure}={}) {
 const state={ready:false,scope:{hatches:[]},active:'S1',mode:'select',pointer:{x:2,y:3},preview:null,allowed:true,selected:null,history:[],faceReads:[]};
 const read=value=>{assert.equal(state.ready,true,'no eager Hatch query');return value;},preview={get pointer(){return read(state.preview);},setPointer(value){assert.equal(this,preview);read();state.preview=value;if(state.previewFailure)throw state.previewFailure;}};
 const sketches={activeSketchId:()=>read(state.active)};
 const f=authoringFixture({currentScope:()=>read(state.scope),sketchContext:sketches,preview,
  ids:{allocate(){throw Error('Hatch must use document IDs');},peek(){throw Error('Hatch must use document IDs');}},
  canCreateInActiveSketch:()=>read(state.allowed),rejectRootSketchCreation:()=>f.events.push('reject'),
  setMode:value=>{read();state.mode=value;f.events.push('mode');},clearSelection:()=>{state.selected=null;f.events.push('clear');},
  selection:{set(key,items){state.selected={key,items};f.events.push('selection');}},recordHistory:label=>state.history.push(label)});
 f.sandbox.window.Appearance={DEFAULT_HATCH_APPEARANCE:{spacing:5}};
 for(const file of ['src/editing/geometry_ids.js','src/editing/document_ids.js','src/commands/hatch_command.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),f.sandbox);
 const documentIds=f.sandbox.window.DocumentIds.create(),query={hatchFaceAt(pointer,options){read();assert.equal(options.includeConstruction,false);state.faceReads.push(pointer);return {ok:true,boundaryLoops:[{role:'outer',spans:[]}],resolved:{area:12}};},forget(item){state.forgotten=item;}};
 const ids=allocateFailure?{allocate(){throw allocateFailure;},peek:documentIds.peek}:documentIds;
 f.events.length=0;
 const hatch=f.feature.createHatch({hatchGeometryQuery:query,readMode:()=>read(state.mode),lastPointer:()=>read(state.pointer),documentIds:ids,
  updateStatusUI:()=>f.events.push('status'),hatchRegionErrorText:error=>error.code});
 assert.deepEqual(f.events,[]);assert.equal(state.faceReads.length,0);state.ready=true;return {...f,state,hatch,documentIds};
}

test('authoring Hatch shares live scope, Sketch, preview, Selection and real document IDs without eager operations',()=>{
 const f=hatchAuthoringFixture(),{state,hatch,documentIds}=f;assert(Object.isFrozen(hatch));hatch.startHatchCreation();
 assert.equal(state.mode,'hatch');assert.equal(state.preview,state.pointer);assert.equal(state.faceReads[0],state.pointer);
 assert.equal(hatch.commitHatchAt({x:8,y:9}),true);assert.equal(hatch.finish(),true);
 const first=state.scope.hatches[0];assert.equal(first.id,'H1');assert.equal(first.sketchId,'S1');assert.equal(state.scope.nextHatchIndex,documentIds.peek('hatch'));assert.equal(state.selected.items[0],first);
 const original=state.scope;state.scope={hatches:[]};state.active='BLOCK-S2';assert.equal(documentIds.allocate('hatch'),'H2');
 assert.equal(hatch.commitHatchAt({x:10,y:11}),true);assert.equal(hatch.finish(),true);
 assert.equal(state.scope.hatches[0].id,'H3');assert.equal(state.scope.hatches[0].sketchId,'BLOCK-S2');assert.equal(state.scope.nextHatchIndex,4);
 assert.equal(original.hatches.length,1);assert.equal(state.selected.items[0],state.scope.hatches[0]);assert.equal(state.history.length,2);assert.equal(state.mode,'hatch');
});

test('authoring Hatch retains cancellation before rejection and preserves allocation and preview failure boundaries',()=>{
 const f=hatchAuthoringFixture();f.state.allowed=false;f.hatch.startHatchCreation();assert.deepEqual(f.events,['cancelConstraint','cancelPending','reject']);
 assert.equal(f.state.mode,'select');assert.equal(f.state.preview,null);assert.equal(f.documentIds.peek('hatch'),1);assert.equal(f.state.faceReads.length,0);
 const marker=new Error('allocation failed'),failed=hatchAuthoringFixture({allocateFailure:marker});failed.hatch.startHatchCreation();failed.hatch.commitHatchAt({x:1,y:2});
 assert.throws(()=>failed.hatch.finish(),error=>error===marker);assert.equal(failed.state.scope.hatches.length,0);assert.equal(failed.state.history.length,0);assert.equal(failed.hatch.regions.length,1);
 const preview=hatchAuthoringFixture();preview.state.previewFailure=marker;assert.throws(()=>preview.hatch.startHatchCreation(),error=>error===marker);assert.equal(preview.state.mode,'hatch');assert.equal(preview.state.preview,preview.state.pointer);assert.deepEqual(preview.events,['cancelConstraint','cancelPending','mode']);
});

test('authoring Hatch repairs only a local hatch on the active Sketch without allocating a replacement',()=>{
 const f=hatchAuthoringFixture(),item={id:'H9',sketchId:'other',seed:{x:1,y:2},boundaryLoops:[]};f.state.scope.hatches.push(item);
 assert.equal(f.hatch.startHatchBoundaryRepair(item),false);assert.equal(f.state.active,'S1');assert.equal(f.state.mode,'select');
 item.sketchId='S1';item.blockProjection=true;assert.equal(f.hatch.startHatchBoundaryRepair(item),false);item.blockProjection=false;
 assert.equal(f.hatch.startHatchBoundaryRepair(item),true);assert.equal(f.state.mode,'hatch-repair');assert.equal(f.hatch.commitHatchAt({x:5,y:6}),true);assert.equal(f.hatch.finish(),true);
 assert.equal(f.state.scope.hatches[0],item);assert.equal(f.state.forgotten,item);assert.equal(f.state.selected.items[0],item);assert.equal(f.state.mode,'select');assert.equal(f.documentIds.peek('hatch'),1);assert.equal(f.state.history.length,1);
});

function interactionLifecycleFixture(composed){
 const state={ready:false,sketch:'S1',allowed:true,selectionAllowed:true,failure:null},guardEvents=[];
 const step=name=>{assert.equal(state.ready,true);guardEvents.push(name);if(state.failure?.stage===name)throw state.failure.error;};
 const f=lifecycleFixture({sketchContext:{activeSketchId:function(){'use strict';assert.equal(this,undefined);step('active');return state.sketch;}}});
 vm.runInNewContext(fs.readFileSync('src/editing/canvas_hover.js','utf8'),f.sandbox);
 const hover=f.sandbox.window.CanvasHover.create({isEndpointPoint:()=>false}),session=f.createLifecycleSession();session.setMode('circle');
 const access={guardSketchEdit:function(id,operation){'use strict';assert.equal(this,undefined);step('guard');assert.equal(id,state.sketch);assert.equal(operation,'create');return state.allowed;},
  guardSelectionEdit:function(operation){'use strict';assert.equal(this,undefined);step('selection');assert.equal(operation,'structure');return state.selectionAllowed;}};
 const clearTrimHover=()=>hover.update({point:null,endpointPoint:null,line:null,circle:null,arcEndpoint:null,arc:null,dimension:null});
 const {activeSketchId}=f.ports.sketchContext,{guardSketchEdit,guardSelectionEdit}=access;
 const canStart=nextMode=>nextMode==='select'||guardSketchEdit(activeSketchId(),'create')&&(nextMode!=='trim'||guardSelectionEdit('structure'));
 const stage={...f.external,hatch:{reset:()=>f.state.hatch.reset()}};f.state.hatch=null;f.events.length=0;
 assert.equal(f.feature.createLifecycle(composed?{...stage,interaction:{lifecycle:session,access,hover}}:{...stage,lifecycle:session,canStart,clearTrimHover}),session);
 assert.deepEqual(f.events,[]);assert.deepEqual(guardEvents,[]);assert.equal(session.mode,'circle');
 f.state.hatch={reset(){assert.equal(this,f.state.hatch);f.events.push('hatch');}};state.ready=true;
 return{...f,session,hover,access,guardEvents,policyState:state,stage};
}

test('authoring interaction policy preserves select bypass, guard short circuits and live Sketch permissions',()=>{
 const results=[];for(const composed of [false,true]){
  const f=interactionLifecycleFixture(composed),s=f.policyState;
  assert.equal(f.session.start('unknown'),false);assert.deepEqual(f.guardEvents,[]);assert.deepEqual(f.events,[]);
  assert.equal(f.session.start('select'),true);assert.deepEqual(f.guardEvents,[]);assert.equal(f.session.mode,'select');
  s.allowed=false;f.events.length=0;assert.equal(f.session.start('line'),false);assert.deepEqual(f.guardEvents,['active','guard']);assert.deepEqual(f.events,[]);assert.equal(f.session.mode,'select');
  s.allowed=true;s.selectionAllowed=false;f.guardEvents.length=0;assert.equal(f.session.start('trim'),false);assert.deepEqual(f.guardEvents,['active','guard','selection']);assert.deepEqual(f.events,[]);
  s.sketch='S9';f.guardEvents.length=0;assert.equal(f.session.start('line'),true);assert.deepEqual(f.guardEvents,['active','guard']);assert.equal(f.session.mode,'line');
  results.push(JSON.stringify({events:f.events,guards:f.guardEvents,mode:f.session.mode}));
 }assert.equal(results[1],results[0]);
});

test('authoring interaction policy clears only the original Trim hover fields and retains late Hatch reset and explicit overrides',()=>{
 const results=[];for(const composed of [false,true]){
  const f=interactionLifecycleFixture(composed),annotation={},identity={},point={};f.hover.update({point,line:{},dimension:{},annotation,sketchIdentity:identity});f.events.length=0;
  assert.equal(f.session.start('trim'),true);assert.equal(f.hover.current.point,null);assert.equal(f.hover.current.line,null);assert.equal(f.hover.current.dimension,null);assert.equal(f.hover.current.annotation,annotation);assert.equal(f.hover.current.sketchIdentity,identity);
  f.state.hatch={reset(){assert.equal(this,f.state.hatch);f.events.push('latest-hatch');}};f.session.exit();assert.equal(f.events.includes('latest-hatch'),true);results.push(JSON.stringify({events:f.events,hover:f.hover.current}));
 }assert.equal(results[1],results[0]);
 const f=interactionLifecycleFixture(true),point={};f.hover.update({point});let calls=0;
 f.feature.createLifecycle({...f.stage,interaction:{lifecycle:f.session,access:f.access,hover:f.hover},canStart:()=>{calls++;return false;},clearTrimHover:()=>f.events.push('custom-hover')});
 f.guardEvents.length=0;assert.equal(f.session.start('line'),false);assert.equal(calls,1);assert.deepEqual(f.guardEvents,[]);f.session.prepare('trim');assert.equal(f.hover.current.point,point);assert.equal(f.events.includes('custom-hover'),true);
});

test('authoring interaction policy propagates each guard failure before mode, draft, hover or UI changes',()=>{
 for(const stage of ['active','guard','selection']){
  const results=[];for(const composed of [false,true]){
   const f=interactionLifecycleFixture(composed),point={};f.hover.update({point});const snapshot=f.hover.current,marker=new Error(stage);f.policyState.failure={stage,error:marker};f.events.length=0;
   assert.throws(()=>f.session.start('trim'),error=>error===marker);assert.equal(f.session.mode,'circle');assert.equal(f.hover.current,snapshot);assert.deepEqual(f.events,[]);results.push(JSON.stringify(f.guardEvents));
  }assert.equal(results[1],results[0]);
 }
});
function splineEditingOwnersFixture(composed, probe = {}) {
  const model = { window:{}, structuredClone }; vm.createContext(model);
  const sources = vm.runInNewContext(fs.readFileSync('index.html','utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
  for(const file of sources.filter(p=>p.startsWith('src/')))vm.runInContext(fs.readFileSync(file,'utf8'),model,{filename:file});
  const w=model.window,g=w.GeometrySolver,ids=w.GeometryIds.create(),selection=w.CanvasSelection.create(),calls=[];
  const points=Array.from({length:4},(_,i)=>Object.assign(new g.Point('P'+(i+1),i*10,i%2*10,false,'endpoint'),{sketchId:'S1'}));
  const spline=Object.assign(new g.Spline('SP1',points.slice()),{sketchId:'S1'}),bound=Object.assign(w.DocumentState.create(),{points:points.slice(),splines:[spline]});
  ids.reserve(bound);
  const state={ready:false,bound,workspace:w.DocumentState.create(),success:true,editable:true,projectionAllowed:true,symbolAllowed:true,shared:false,stabilizeError:null};
  const ready=()=>assert.equal(state.ready,true),note=name=>(...args)=>{ready();calls.push([name,...args]);};
  const geometry=w.GeometryCreation.create({currentScope:()=>state.workspace,ids,assignSketchId:item=>{item.sketchId='S1';},currentConstruction:()=>false,minLineLength:1e-6,minArcLength:1e-6});
  const valueCheckpoint={
    captureValues:function(){'use strict';assert.equal(this,undefined);ready();calls.push(['values-capture']);return points.map(p=>[p,p.x,p.y]);},
    restoreValues:function(snapshot){'use strict';assert.equal(this,undefined);ready();calls.push(['values-restore']);for(const[p,x,y]of snapshot){p.x=x;p.y=y;}},
  };
  const parameters={stabilize:function(id){'use strict';assert.equal(this,undefined);ready();calls.push(['stabilize',id]);if(state.stabilizeError)throw state.stabilizeError;if(!state.success)points[0].x=999;return{success:state.success,dependent:{success:state.success}};}};
  const access={guardSketchEdit:(id,operation)=>{ready();calls.push(['guard',id,operation]);return state.editable;}};
  const pointUsage=Object.fromEntries(['isSplineOnlyFitPoint','isReferencePoint','isPrimitiveCenterPoint','isEndpointPoint','isPointUsedByPrimitive','isExplicitPoint'].map(name=>[name,()=>assert.fail('no eager point query')]));
  Object.assign(pointUsage,{isPointUsedByLine:()=>state.shared,isPointUsedByCircle:()=>false,isPointUsedByArc:()=>false});
  const sketchContext=Object.fromEntries(['isActiveSketchElement','isReferenceSourceSketchId','sketchName','sameSketchElements','activeSketchId'].map(name=>[name,()=>assert.fail('no eager sketch query')]));
  sketchContext.elementSketchId=item=>{ready();return item.sketchId;};
  const clearSelection=()=>{ready();calls.push(['clear']);selection.clear();},analysis={invalidate(){assert.equal(this,analysis);ready();calls.push(['analysis']);}};
  const parent=authoringFixture({currentScope:()=>{ready();return state.workspace;},ids,geometry,selection,pointUsage,sketchContext,clearSelection,
    recordHistory:note('history'),applicationText:(_ja,en)=>en,setHint:note('hint'),updateUI:note('ui'),draw:note('draw')});
  parent.sandbox.window.GeometryObjects=w.GeometryObjects;parent.sandbox.window.AnnotationAnchorData=w.AnnotationAnchorData;
  parent.sandbox.window.SplineEditCommand={create(options){probe.options=options;parent.events.push('spline-edit');if(probe.error)throw probe.error;return probe.actual=w.SplineEditCommand.create(options);}};
  const constraintReferences={constraintReferencesPoint:(c,p)=>c.point===p},guardSketchProjectionShapeEdit=()=>{ready();calls.push(['projection']);return state.projectionAllowed;};
  const guardDimensionSymbolDeletion=()=>{ready();calls.push(['symbol-guard']);return state.symbolAllowed;};
  const editingScope={get current(){ready();return state.bound;}};
  const input={editingScope,checkpoint:valueCheckpoint,parameters,analysis,access,guardSketchProjectionShapeEdit,constraintReferences,guardDimensionSymbolDeletion};
  const {guardSketchEdit}=access,{elementSketchId}=sketchContext;
  const raw={canEditStructure:item=>guardSketchEdit(elementSketchId(item),'structure'),currentScope:()=>editingScope.current,ids,clearSelection,canvasSelection:selection,
    applicationText:parent.ports.applicationText,setHint:parent.ports.setHint,updateUI:parent.ports.updateUI,draw:parent.ports.draw,
    restoreModelState:valueCheckpoint.restoreValues,snapshotModelState:valueCheckpoint.captureValues,stabilizeActiveParameterNamespace:parameters.stabilize,elementSketchId,
    invalidateAnalysis:()=>analysis.invalidate(),recordHistory:parent.ports.recordHistory,guardSketchProjectionShapeEdit,addPoint:geometry.addPoint,
    isPointUsedByLine:pointUsage.isPointUsedByLine,isPointUsedByCircle:pointUsage.isPointUsedByCircle,isPointUsedByArc:pointUsage.isPointUsedByArc,
    constraintReferencesPoint:constraintReferences.constraintReferencesPoint,guardDimensionSymbolDeletion,geometryElementKey:w.GeometryObjects.geometryKeyForItem,
    annotationReferencesRemovedGeometry:w.AnnotationAnchorData.referencesRemovedGeometry};
  parent.events.length=0;Object.assign(probe,{parent,state,calls,bound,selection,input,raw});
  const command=composed?parent.feature.createSplineEditing(input):parent.sandbox.window.SplineEditCommand.create(raw);
  assert.deepEqual(calls,[]);assert.deepEqual(parent.events,['spline-edit']);state.ready=true;
  return{...parent,w,command,probe,state,calls,bound,points,spline,ids,selection,input};
}

test('Spline editing assembly retains the late real command, bare value checkpoint and separate live editing/Workspace scopes',()=>{
  for(const composed of [false,true]){
    const f=splineEditingOwnersFixture(composed),p=f.probe.options;
    assert.equal(f.command,f.probe.actual);for(const[name,value]of Object.entries(f.probe.raw).filter(([name])=>!['canEditStructure','currentScope','invalidateAnalysis'].includes(name)))assert.equal(p[name],value,name);
    assert.notEqual(p.snapshotModelState,f.ports.checkpoint.capture);assert.notEqual(p.restoreModelState,f.ports.checkpoint.restore);
    assert.equal(p.currentScope(),f.bound);assert.equal(f.ports.currentScope(),f.state.workspace);assert.notEqual(f.bound,f.state.workspace);
    f.command.begin(f.spline);assert.equal(f.command.current.spline,f.spline);assert.equal(f.selection.splines[0],f.spline);
    assert.deepEqual(f.calls[0],['guard','S1','structure']);const next=f.w.DocumentState.create();f.state.bound=next;assert.equal(p.currentScope(),next);
    assert.equal(f.command.addPoint(f.spline,{x:5,y:3}),false);assert.equal(f.bound.points.length,4);
  }
});

test('Spline editing assembly preserves actual fit-point add/delete identities, solver rollback, IDs and history traces',()=>{
  for(const operation of ['addPoint','deletePoint'])for(const success of [false,true]){
    const traces=[];
    for(const composed of [false,true]){
      const f=splineEditingOwnersFixture(composed);f.state.workspace=f.bound;f.state.success=success;f.command.activate(f.spline);const seq=f.ids.peek('point');
      const result=f.command[operation](f.spline,operation==='addPoint'?{x:5,y:3}:f.points[1]);assert.equal(result,success);
      assert.equal(f.points[0].x,0);assert.equal(f.command.current.spline,f.spline);assert.equal(f.calls.filter(c=>c[0]==='history').length,success?1:0);
      assert.equal(f.spline.fitPoints.length,success?(operation==='addPoint'?5:3):4);
      if(!success){assert.equal(f.ids.peek('point'),seq);assert.deepEqual(f.spline.fitPoints,f.points);assert.ok(f.calls.some(c=>c[0]==='values-restore'));}
      traces.push(JSON.stringify({calls:f.calls,ids:f.ids.snapshot(),points:f.bound.points.map(p=>[p.id,p.x,p.y]),fit:f.spline.fitPoints.map(p=>p.id)}));
    }assert.equal(traces[1],traces[0]);
  }
});

test('Spline editing assembly retains permission refusals and constructor/solver exception identity and partial state',()=>{
  for(const composed of [false,true]){
    const probe={error:new Error('construction failed')};assert.throws(()=>splineEditingOwnersFixture(composed,probe),error=>error===probe.error);
    assert.deepEqual(probe.calls,[]);assert.equal(probe.state.ready,false);assert.equal(probe.bound.points.length,4);assert.equal(probe.selection.hasSelection(),false);
    const f=splineEditingOwnersFixture(composed);f.state.workspace=f.bound;f.state.editable=false;assert.equal(f.command.begin(f.spline),false);assert.equal(f.command.current,null);
    f.state.editable=true;f.command.activate(f.spline);f.state.projectionAllowed=false;assert.equal(f.command.addPoint(f.spline,{x:5,y:3}),false);assert.equal(f.bound.points.length,4);
    f.state.projectionAllowed=true;f.state.symbolAllowed=false;assert.equal(f.command.deletePoint(f.spline,f.points[1]),false);assert.equal(f.spline.fitPoints.length,4);
    f.state.symbolAllowed=true;const marker=new Error('solve failed');f.state.stabilizeError=marker;
    assert.throws(()=>f.command.addPoint(f.spline,{x:5,y:3}),error=>error===marker);assert.equal(f.command.current.spline,f.spline);assert.equal(f.spline.fitPoints.length,5);
    assert.equal(f.calls.filter(c=>c[0]==='history').length,0);
  }
});

test('editing authoring shares real Geometry, IDs, Selection and owner callbacks without eager reads and keeps live scale and scope',()=>{
 for(const composed of [false,true]){
  const probe={},f=geometryFoundationFixture({composed,probe}),{owners:o,ports:p,tools:t,state,foundation}=f;
  assert.deepEqual(probe.order,['DrawingSnap','SplineCommand','LineCommand','SlotConstruction']);
  assert.equal(probe.ports.DrawingSnap.geometryReads,o.readServices.reads);assert.equal(probe.ports.DrawingSnap.isVisibleSketchElement,o.readServices.geometryAppearance.isVisibleSketchElement);
  assert.equal(o.documentWorkspace.sketches.isVisibleSketchElement,undefined);
  assert.equal(probe.ports.SplineCommand.setMode,o.interaction.lifecycle.setMode);assert.equal(probe.ports.SplineCommand.canCreateInActiveSketch,o.interaction.access.canCreateInActiveSketch);
  assert.equal(probe.ports.SplineCommand.applicationText,o.presentation.settings.applicationText);assert.equal(probe.ports.SplineCommand.setHint,o.presentation.setHint);
  assert.equal(probe.ports.LineCommand.selection,o.interaction.selection);assert.equal(probe.ports.LineCommand.addPoint,foundation.geometry.addPoint);
  assert.equal(probe.ports.SlotConstruction.snapshotGeometryMutationState,p.checkpoint.capture);assert.equal(Object.isFrozen(t),true);
  const near=foundation.geometry.addPoint(3,0,false,'explicit'),pointer={x:0,y:0};state.snapPoints=[near];state.scale=1;
  const snapped=t.snapForDrawing(pointer);assert.equal(snapped.x,near.x);assert.equal(snapped.y,near.y);assert.equal(t.snap.active.data.point,near);state.scale=10;
  assert.equal(t.snapForDrawing(pointer),pointer);assert.equal(t.snap.active,null);state.snapPoints=[];
  t.tools.line.click({x:10,y:0});const first=state.scope;state.scope=f.empty();state.sketch='S2';state.construction=true;
  t.tools.line.reset();t.tools.line.click({x:20,y:0});t.tools.line.click({x:21,y:0});
  assert.equal(first.points.includes(near),true);assert.equal(state.scope.points[0].sketchId,'S2');assert.equal(state.scope.lines[0].construction,true);
  assert.equal(state.scope.lines[0].length(),4);assert.equal(o.interaction.selection.lines[0],state.scope.lines[0]);
 }
});

test('editing authoring starts Spline through the real lifecycle after pending cancellation and keeps rejection and late editing failures',()=>{
 for(const composed of [false,true]){
  const probe={},f=geometryFoundationFixture({composed,probe}),{tools:t,owners:o,state,events}=f;
  t.spline.command.start();assert.equal(o.interaction.lifecycle.mode,'spline');assert.deepEqual(events,['cancel-pending']);
  o.interaction.lifecycle.setMode('select');state.allowed=false;events.length=0;t.spline.command.start();
  assert.equal(o.interaction.lifecycle.mode,'select');assert.deepEqual(events,['cancel-pending','reject']);
  state.allowed=true;probe.editingFailure=new Error('late editing reset');events.length=0;
  assert.throws(()=>t.spline.command.start(),value=>value===probe.editingFailure);
  assert.equal(o.interaction.lifecycle.mode,'spline');assert.deepEqual(events,['cancel-pending']);
 }
});

test('editing authoring retains constructor stages and late checkpoint failures before Slot model or ID mutation',()=>{
 for(const composed of [false,true]){
  const sequence=['DrawingSnap','SplineCommand','LineCommand','SlotConstruction'];
  for(const failAt of sequence){const error=new Error(failAt),probe={failAt,error};
   assert.throws(()=>geometryFoundationFixture({composed,probe}),value=>value===error);assert.deepEqual(probe.order,sequence.slice(0,sequence.indexOf(failAt)+1));}
  const error=new Error('late checkpoint'),calls=[],probe={checkpoint:{capture(){assert.equal(this,probe.checkpoint);calls.push('capture');throw error;},restore(){calls.push('restore');}}};
  const f=geometryFoundationFixture({composed,probe}),slot=f.tools.tools.input.slot;
  slot({x:0,y:0});slot({x:10,y:0});const pointSeq=f.ids.peek('point'),lineSeq=f.ids.peek('line'),arcSeq=f.ids.peek('arc'),arrays={...f.state.scope};
  assert.throws(()=>slot({x:10,y:8}),value=>value===error);assert.deepEqual(calls,['capture']);
  assert.equal(f.ids.peek('point'),pointSeq);assert.equal(f.ids.peek('line'),lineSeq);assert.equal(f.ids.peek('arc'),arcSeq);
  for(const key of Object.keys(arrays)){assert.equal(f.state.scope[key],arrays[key]);assert.equal(arrays[key].length,0);}
 }
});

(function () {
"use strict";
function editingToolStagesFixture(composed, failAt = null, construction = []) {
 const calls=[],captured={},actual={},state={ready:false,success:true,projectionAllowed:true,editable:true,failure:null,pointer:{x:10,y:10}};
 let common,checkpoint,solving,parameters,analysis,solver,projection,editingScope;
 const parent=geometryFoundationFixture({composed:true,prepared:composed==='prepared',configure(f){
  const {w,owners,ports}=f,ready=()=>assert.equal(state.ready,true,'no eager editor/model/UI read');
  f.state.scope=w.DocumentState.create();state.parent=f.state;
  const note=name=>(...args)=>{ready();calls.push([name,...args]);};
  ports.clearSelection=()=>{ready();owners.interaction.selection.clear();calls.push(['clear']);};
  ports.pushModelConstraint=(constraint,sketchId=f.state.sketch)=>{ready();constraint.sketchId=sketchId;f.state.scope.constraints.push(constraint);};
  ports.recordHistory=note('history');ports.setHint=note('hint');ports.updateUI=note('ui');ports.draw=note('draw');
  ports.cancelConstraintTargetCommand=note('cancel-target');ports.updateToolbar=note('toolbar');
  for(const name of ['setHint','updateUI','draw'])owners.presentation[name]=ports[name];
  const lifecycle={...owners.interaction.lifecycle,prepare(mode){assert.equal(this,lifecycle);ready();calls.push(['prepare',mode]);return state.result;}};
  owners.interaction.lifecycle=lifecycle;
  owners.sessions.pointer={readLastPointer:function(){assert.equal(this,undefined);ready();return state.pointer;}};
  owners.interaction.access.guardSketchEdit=(id,operation)=>{ready();calls.push(['guard',id,operation]);return state.editable;};
  for(const name of ['isPointUsedByLine','isPointUsedByCircle','isPointUsedByArc'])owners.interaction.pointUsage[name]=()=>false;
  analysis={invalidate(){assert.equal(this,analysis);ready();calls.push(['analysis']);return state.result;},
   refresh(...args){assert.equal(this,analysis);assert.equal(args.length,1);ready();calls.push(['refresh',args[0]]);if(state.failure)throw state.failure;return state.result;}};
  const real=w.EditingCheckpoint.create({currentScope:()=>{ready();return f.state.scope;},ids:f.ids,invalidateProjection:note('projection-invalidate'),invalidateAnalysis:()=>analysis.invalidate()});
  checkpoint=Object.fromEntries(['captureGeometry','restoreGeometry','captureValues','restoreValues'].map(name=>[name,function(...args){
   assert.equal(this,undefined);ready();calls.push([name]);return real[name](...args);
  }]));
  const result=()=>{ready();if(state.failure)throw state.failure;return {success:state.success,result:{errorNorm:state.success?0:1,reason:'fixture'}};};
  solving={solveSketchAndDependents:function(id){assert.equal(this,undefined);calls.push(['solve',id]);return result();}};
  parameters={stabilize:function(id){assert.equal(this,undefined);calls.push(['stabilize',id]);return result();}};
  solver={syncLineOrientationHints(){assert.equal(this,solver);ready();calls.push(['orientation']);return state.result;}};
  projection={guardSketchProjectionShapeEdit(items){ready();calls.push(['projection-guard',items.map(item=>item.id)]);return state.projectionAllowed;}};
  editingScope={get current(){ready();return state.bound??f.state.scope;}};
  common={checkpoint,solving,parameters,analysis,editingScope,solver,placement:{defaultDimensionForTarget:()=>({display:{}})},
   valueInput:{hide:note('hide')},projection,acceptError:0.0125,updateGeometrySelectionUI:note('selection-ui')};
  for(const [name,method]of [['FilletFeature','create'],['CircleCenterCrossCommand','create'],['SplineEditCommand','create']]){
   const original=w[name];w[name]={...original,[method](options){
    construction.push(name);if(failAt?.name===name)throw failAt.error;captured[name]=options;return actual[name]=original[method](options);
   }};
  }
 }});
 parent.state.ready=false;
 let fillet,createCircleCenterCross,createSplineEditing,editors;
 if(composed){editors=composed==='prepared'?parent.preparation.createEditing(common):parent.tools.createEditing(common);({fillet,createCircleCenterCross,createSplineEditing}=editors);}
 else {
  const {activeSketchId}=parent.owners.documentWorkspace.sketches,{stabilize}=parameters;
  fillet=parent.tools.createFillet({defaultDimensionForTarget:common.placement.defaultDimensionForTarget,syncLineOrientationHints:()=>solver.syncLineOrientationHints?.(),
   pending:parent.owners.sessions.pending,readPointer:parent.owners.sessions.pointer.readLastPointer,prepareStart:()=>parent.owners.interaction.lifecycle.prepare('fillet'),
   guardSketchProjectionShapeEdit:projection.guardSketchProjectionShapeEdit,valueInput:common.valueInput,checkpoint,
   stabilize:()=>stabilize(activeSketchId()),acceptError:common.acceptError,invalidateAnalysis:()=>{analysis.invalidate();},
   refreshConstraintAnalysis:(options={})=>analysis.refresh(options),updateGeometrySelectionUI:common.updateGeometrySelectionUI});
  createCircleCenterCross=({resultIsAccepted,minOrientationLength})=>parent.tools.createCircleCenterCross({checkpoint,solveSketchAndDependents:solving.solveSketchAndDependents,
   resultIsAccepted,minOrientationLength,selectedElementCount:parent.owners.interaction.selection.selectedElementCount,invalidateAnalysis:()=>analysis.invalidate()});
  createSplineEditing=({constraintReferences,guardDimensionSymbolDeletion})=>parent.tools.createSplineEditing({editingScope,checkpoint,parameters,analysis,
   access:parent.owners.interaction.access,guardSketchProjectionShapeEdit:projection.guardSketchProjectionShapeEdit,constraintReferences,guardDimensionSymbolDeletion});
 }
 assert.deepEqual(construction,['FilletFeature']);assert.deepEqual(calls,[]);
 const cross=createCircleCenterCross({resultIsAccepted:result=>result.errorNorm===0,minOrientationLength:1e-8});
 assert.deepEqual(construction,['FilletFeature','CircleCenterCrossCommand']);assert.deepEqual(calls,[]);
 const spline=createSplineEditing({constraintReferences:{constraintReferencesPoint:()=>false},guardDimensionSymbolDeletion:()=>true});
 assert.deepEqual(calls,[]);state.ready=true;parent.state.ready=true;
 function snapshot(){
  const scope=parent.state.scope;
  return JSON.stringify({calls,ids:parent.ids.snapshot(),points:scope.points.map(p=>[p.id,p.x,p.y]),lines:scope.lines.map(l=>[l.id,l.p1.id,l.p2.id]),
   arcs:scope.arcs.map(a=>[a.id,a.radiusValue]),constraints:scope.constraints.map(c=>c.constructor.name),splines:scope.splines.map(s=>s.fitPoints.map(p=>p.id))});
 }
 return {...parent,state,calls,captured,actual,construction,common,fillet,cross,spline,editors,snapshot};
}

test('authoring editing stages keep real Fillet, cross and Spline construction cold and separate while sharing existing owners',()=>{
 for(const composed of [false,true]){
  const f=editingToolStagesFixture(composed);
  assert.deepEqual(f.construction,['FilletFeature','CircleCenterCrossCommand','SplineEditCommand']);
  assert.equal(f.fillet,f.actual.FilletFeature);assert.equal(f.cross,f.actual.CircleCenterCrossCommand);assert.equal(f.spline,f.actual.SplineEditCommand);
  assert.equal(f.captured.FilletFeature.checkpoint,f.common.checkpoint);
  assert.equal(f.captured.FilletFeature.pending,f.owners.sessions.pending);
  assert.equal(f.captured.FilletFeature.readPointer,f.owners.sessions.pointer.readLastPointer);
  assert.equal(f.captured.SplineEditCommand.snapshotModelState,f.common.checkpoint.captureValues);
  assert.equal(f.captured.CircleCenterCrossCommand.checkpoint.capture,f.common.checkpoint.captureGeometry);
  assert.equal(f.captured.SplineEditCommand.stabilizeActiveParameterNamespace,f.common.parameters.stabilize);
  f.state.result={token:true};
  assert.equal(f.captured.FilletFeature.prepareStart(),f.state.result);
  assert.equal(f.captured.FilletFeature.invalidateAnalysis(),undefined);
  assert.equal(f.captured.CircleCenterCrossCommand.invalidateAnalysis(),f.state.result);
  assert.equal(f.captured.FilletFeature.refreshConstraintAnalysis(),f.state.result);
  const options={force:true};assert.equal(f.captured.FilletFeature.refreshConstraintAnalysis(options,'ignored'),f.state.result);
  assert.equal(f.calls.at(-1)[1],options);
  const bound=f.w.DocumentState.create();f.state.bound=bound;
  assert.equal(f.captured.SplineEditCommand.currentScope(),bound);assert.notEqual(bound,f.state.parent.scope);
  f.state.parent.sketch='S2';f.captured.FilletFeature.stabilize();assert.deepEqual(f.calls.at(-1),['stabilize','S2']);
 }
});

test('authoring editing stages preserve actual fillet geometry, pending, rollback, IDs and history on acceptance and refusal',()=>{
 for(const scenario of ['accepted','solve-refused','projection-refused','solver-threw']){
  const traces=[];
  for(const composed of [false,true]){
   const f=editingToolStagesFixture(composed),g=f.foundation.geometry;
   const corner=g.addPoint(0,0,false,'endpoint'),a=g.addPoint(100,0,false,'endpoint'),b=g.addPoint(0,100,false,'endpoint');
   const l1=g.addLine(corner,a),l2=g.addLine(corner,b);
   f.state.success=scenario!=='solve-refused';f.state.projectionAllowed=scenario!=='projection-refused';
   assert.equal(f.fillet.start(l1,l2,{x:10,y:10}),scenario!=='projection-refused');
   const marker=new Error('solver');f.state.failure=scenario==='solver-threw'?marker:null;
   if(f.state.failure)assert.throws(()=>f.fillet.submit({x:10,y:10}),error=>error===marker);
   else f.fillet.submit({x:10,y:10});
   const kept=scenario==='accepted'||scenario==='solver-threw';
   assert.equal(f.state.parent.scope.arcs.length,kept?1:0);assert.equal(l1.p2,a);assert.equal(l2.p2,b);
   assert.equal(l1.p1===corner,!kept);assert.equal(f.calls.filter(c=>c[0]==='history').length,scenario==='accepted'?1:0);
   assert.equal(f.calls.some(c=>c[0]==='restoreGeometry'),scenario==='solve-refused');
   traces.push(f.snapshot());
  }
  assert.equal(traces[1],traces[0],scenario);
 }
});

test('authoring editing stages preserve circle cross and Spline operations with real geometry checkpoints and failed solve restoration',()=>{
 for(const operation of ['cross','spline'])for(const success of [true,false]){
  const traces=[];
  for(const composed of [false,true]){
   const f=editingToolStagesFixture(composed),g=f.foundation.geometry,scope=f.state.parent.scope;
   f.state.success=success;
   if(operation==='cross'){
    const center=g.addPoint(50,50),circle=g.addCircle(center,20);const result=f.cross.createCrosses([circle]);
    assert.equal(result,success);assert.equal(scope.circles[0],circle);assert.equal(scope.lines.length,success?2:0);
    assert.equal(f.calls.some(c=>c[0]==='restoreGeometry'),!success);
   }else{
    const points=[g.addPoint(0,0),g.addPoint(20,10),g.addPoint(40,-10),g.addPoint(60,0)],spline=g.addSpline(points);
    f.spline.activate(spline);assert.equal(f.spline.current.spline,spline);
    assert.equal(f.spline.addPoint(spline,{x:30,y:5}),success);
    assert.equal(spline.fitPoints.length,success?5:4);assert.equal(spline.fitPoints[0],points[0]);
    assert.equal(f.calls.some(c=>c[0]==='restoreValues'),!success);
   }
   assert.equal(f.calls.filter(c=>c[0]==='history').length,success?1:0);traces.push(f.snapshot());
  }
  assert.equal(traces[1],traces[0],operation+'/'+success);
 }
});

test('authoring editing stages preserve constructor and live callback error identity without starting later stages',()=>{
 const names=['FilletFeature','CircleCenterCrossCommand','SplineEditCommand'];
 for(const composed of [false,true]){
  for(const [index,name]of names.entries()){
   const construction=[],error=new Error(name);
   assert.throws(()=>editingToolStagesFixture(composed,{name,error},construction),value=>value===error);
   assert.deepEqual(construction,names.slice(0,index+1));
  }
  const f=editingToolStagesFixture(composed),error=new Error('refresh');f.state.failure=error;
  assert.throws(()=>f.captured.FilletFeature.refreshConstraintAnalysis(),value=>value===error);
 }
});

function laterAuthoringEditorsFixture(composed, failAt = null, constructors = []) {
 const f=editingToolStagesFixture(composed),{common}=f,ports={},actual={},w=f.w;
 f.state.ready=false;f.state.parent.ready=false;
 f.owners.sessions.preview.setTrim=function(value){assert.equal(this,f.owners.sessions.preview);assert.equal(f.state.ready,true);f.calls.push(['trim-preview',value]);};
 const references=w.ConstraintReferences.create({resolveGeometryRef:()=>null});
 const trimInput={references,hitSketchIdentityElement:(x,y,options)=>{assert.equal(f.state.ready,true);f.calls.push(['hit',x,y,options.allowInactiveGeometry]);return {sketchId:f.state.parent.sketch};}};
 const centerInput={parallelTolerance:1e-4,commitNewConstraint:function(type,constraint){
  assert.equal(this,undefined);assert.equal(f.state.ready,true);f.calls.push(['commit',type,constraint.constructor.name]);
  if(f.state.failure)throw f.state.failure;
  f.ports.pushModelConstraint(constraint);if(f.state.success)f.ports.recordHistory('centerline');return f.state.success;
 }};
 const names=['CenterlineCommand','TrimFeature'],originals=Object.fromEntries(names.map(name=>[name,w[name]]));
 for(const name of names)w[name]={...w[name],create(options){constructors.push(name);ports[name]=options;if(failAt?.name===name)throw failAt.error;return actual[name]=originals[name].create(options);}};
 let centerline,trim;
 try{
  centerline=composed==='prepared'?f.preparation.createCenterline(centerInput):composed?f.editors.createCenterline(centerInput):f.tools.createCenterline({...centerInput,invalidateAnalysis:()=>{common.analysis.invalidate();}});
  assert.deepEqual(constructors,['CenterlineCommand']);assert.deepEqual(f.calls,[]);
  trim=composed==='prepared'?f.preparation.createTrim(trimInput):composed?f.editors.createTrim(trimInput):f.tools.createTrim({...trimInput,checkpoint:common.checkpoint,
   guardSketchEdit:f.owners.interaction.access.guardSketchEdit,guardSketchProjectionShapeEdit:common.projection.guardSketchProjectionShapeEdit,
   stabilizeActiveParameterNamespace:common.parameters.stabilize,acceptError:common.acceptError,
   invalidateAnalysis:()=>common.analysis.invalidate(),refreshConstraintAnalysis:(options={})=>common.analysis.refresh(options)});
 }finally{for(const name of names)w[name]=originals[name];}
 assert.deepEqual(f.calls,[]);f.state.ready=true;f.state.parent.ready=true;
 return {...f,centerline,trim,latePorts:ports,lateActual:actual,trimInput,centerInput,constructors};
}

test('later authoring editors share actual Trim/Centerline and common owners without early reads or collapsing Workspace into bound scope',()=>{
 for(const composed of [false,true]){
  const f=laterAuthoringEditorsFixture(composed);
  assert.deepEqual(f.constructors,['CenterlineCommand','TrimFeature']);
  assert.equal(f.centerline,f.lateActual.CenterlineCommand);assert.equal(f.trim,f.lateActual.TrimFeature);
  const p=f.latePorts.TrimFeature;
  assert.equal(p.checkpoint,f.common.checkpoint);assert.equal(p.references,f.trimInput.references);
  assert.equal(p.guardSketchEdit,f.owners.interaction.access.guardSketchEdit);
  assert.equal(p.guardSketchProjectionShapeEdit,f.common.projection.guardSketchProjectionShapeEdit);
  assert.equal(p.stabilizeActiveParameterNamespace,f.common.parameters.stabilize);assert.equal(p.acceptError,f.common.acceptError);
  f.state.bound=f.w.DocumentState.create();assert.equal(p.currentScope(),f.state.parent.scope);assert.notEqual(p.currentScope(),f.common.editingScope.current);
  f.state.result={token:true};assert.equal(f.latePorts.CenterlineCommand.invalidateAnalysis(),undefined);
  assert.equal(p.invalidateAnalysis(),f.state.result);assert.equal(p.refreshConstraintAnalysis(),f.state.result);
  const options={force:true};assert.equal(p.refreshConstraintAnalysis(options,'ignored'),f.state.result);assert.equal(f.calls.at(-1)[1],options);
 }
});

test('later Trim editor preserves real line trimming, checkpoint/ID rollback, guard rejection and solver exception partial state',()=>{
 for(const scenario of ['accepted','rejected','projection-refused','edit-refused','solver-threw']){
  const results=[];
  for(const composed of [false,true]){
   const f=laterAuthoringEditorsFixture(composed),g=f.foundation.geometry,scope=f.state.parent.scope;
   const line=(x1,y1,x2,y2)=>g.addLine(g.addPoint(x1,y1,false,'endpoint'),g.addPoint(x2,y2,false,'endpoint'));
   const target=line(0,0,30,0);line(10,-10,10,10);line(20,-10,20,10);const originalEnd=target.p2;
   f.state.success=scenario!=='rejected';f.state.projectionAllowed=scenario!=='projection-refused';f.state.editable=scenario!=='edit-refused';
   const error=new Error('solve');f.state.failure=scenario==='solver-threw'?error:null;
   if(f.state.failure)assert.throws(()=>f.trim.execute({x:15,y:0}),value=>value===error);
   else assert.equal(f.trim.execute({x:15,y:0}),scenario==='accepted');
   const kept=scenario==='accepted'||scenario==='solver-threw';assert.equal(scope.lines.length,kept?4:3);
   assert.equal(target.p2===originalEnd,!kept);assert.equal(f.calls.filter(c=>c[0]==='history').length,scenario==='accepted'?1:0);
   assert.equal(f.calls.some(c=>c[0]==='restoreGeometry'),scenario==='rejected');results.push(f.snapshot());
  }
  assert.equal(results[1],results[0],scenario);
 }
});

test('later Centerline editor preserves real constraint construction, commit refusal rollback and exception identities',()=>{
 for(const scenario of ['accepted','refused','commit-threw']){
  const results=[];
  for(const composed of [false,true]){
   const f=laterAuthoringEditorsFixture(composed),g=f.foundation.geometry,scope=f.state.parent.scope;
   const a=g.addPoint(0,0,false,'endpoint'),b=g.addPoint(100,0,false,'endpoint'),ids=f.ids.snapshot();
   assert.equal(f.centerline.prepare([a,b]),true);f.centerline.click({x:50,y:-20});const first=f.centerline.firstPoint;
   f.state.success=scenario!=='refused';const marker=new Error('commit');f.state.failure=scenario==='commit-threw'?marker:null;
   if(f.state.failure)assert.throws(()=>f.centerline.click({x:50,y:20}),error=>error===marker);else f.centerline.click({x:50,y:20});
   assert.equal(scope.lines.length,scenario==='refused'?0:1);
   assert.equal(f.calls.filter(c=>c[0]==='history').length,scenario==='accepted'?1:0);
   if(scenario==='accepted'){assert.ok(scope.constraints[0] instanceof f.w.GeometrySolver.PointPairCenterlineConstraint);assert.equal(scope.lines[0].p1.x,50);assert.equal(f.centerline.firstPoint,null);}
   if(scenario==='refused'){assert.deepEqual(f.ids.snapshot(),ids);assert.equal(f.centerline.firstPoint,first);}
   results.push(f.snapshot());
  }
  assert.equal(results[1],results[0],scenario);
 }
 for(const composed of [false,true])for(const [index,name]of ['CenterlineCommand','TrimFeature'].entries()){
  const constructors=[],error=new Error(name);assert.throws(()=>laterAuthoringEditorsFixture(composed,{name,error},constructors),value=>value===error);
  assert.deepEqual(constructors,['CenterlineCommand','TrimFeature'].slice(0,index+1));
 }
});


function offsetOwnersFixture(composed, probe = {}) {
 const f=geometryFoundationFixture({composed:true,configure({state,owners,events}){
  const lifecycle=owners.interaction.lifecycle;
  owners.interaction.lifecycle={...lifecycle,prepare(mode){assert.equal(this,owners.interaction.lifecycle);assert.equal(arguments.length,1);events.push(['prepare',mode]);if(state.prepareFailure)throw state.error;return state.result;}};
  owners.presentation.updateGeometrySelectionUI=()=>events.push('selection-ui');
  const preview=owners.sessions.preview;preview.setPointer=function(point){assert.equal(this,preview);preview.pointer=point;};
 }}),{state,owners,w,events}=f;
 state.ready=false;state.bound=state.scope;state.result={};state.error=new Error('offset stage');state.accepted=true;
 const editingScope={get current(){assert.equal(state.ready,true);if(state.scopeFailure)throw state.error;events.push('bound-scope');return state.bound;}};
 const sourceSelection=w.OffsetSelection.create({...w.GeometrySolver,getModel:()=>editingScope.current,activeSketchId:()=>state.sketch,
  elementSketchId:item=>item.sketchId,constraintSketchId:item=>item.sketchId,onSelectionChanged:()=>owners.interaction.selection.applyOffsetSelection(sourceSelection)});
 const ctx=Object.fromEntries(['beginPath','moveTo','lineTo','arc','stroke','setLineDash'].map(name=>[name,(...args)=>events.push([name,...args])]));
 const surface={withCanvasState:function(work){'use strict';assert.equal(this,undefined);return work();}},analysis={invalidate(){assert.equal(this,analysis);assert.equal(arguments.length,0);events.push('invalidate');if(state.invalidateFailure)throw state.error;return state.result;}};
 const input={editingScope,placement:{dimensionWithLabelAt:(target,dimension,pointer)=>({...dimension,x:pointer.x,y:pointer.y}),dimensionFromAnchor:()=>({anchor:true})},
  sourceSelection,valueInput:{sync:()=>events.push('sync'),focus:()=>events.push('focus'),hide:()=>events.push('hide')},ctx,surface,
  drawDimension:(...args)=>events.push(['dimension',...args]),commitNewConstraint:(type,constraint)=>{events.push(['commit',type]);if(state.commitFailure)throw state.error;if(state.accepted)state.scope.constraints.push(constraint);return state.accepted;},
  offsetChainErrorText:plan=>plan.code,analysis};
 const original=w.OffsetFeature;let feature;w.OffsetFeature={...original,create(options){probe.ports=options;if(probe.constructorFailure)throw probe.error;return probe.result??original.create(options);}};
 try{feature=composed?f.tools.createOffsetForEditing(input):f.tools.createOffset({currentScope:()=>editingScope.current,placement:input.placement,sourceSelection,pending:owners.sessions.pending,
  valueInput:input.valueInput,viewport:owners.viewport,ctx,withCanvasState:surface.withCanvasState,drawDimension:input.drawDimension,readMode:owners.interaction.lifecycle.readMode,
  commitNewConstraint:input.commitNewConstraint,offsetChainErrorText:input.offsetChainErrorText,prepareStart:()=>owners.interaction.lifecycle.prepare('offset'),
  updateGeometrySelectionUI:owners.presentation.updateGeometrySelectionUI,invalidateAnalysis:()=>{analysis.invalidate();}});}
 finally{w.OffsetFeature=original;}
 assert.deepEqual(events,[]);state.ready=true;return {...f,feature,input,probe,sourceSelection};
}

test('Offset editing assembly shares parent sessions, viewport and notifications while retaining live bound scope and callback contracts',()=>{
 const traces=[];
 for(const composed of [false,true]){
  const result={},f=offsetOwnersFixture(composed,{result}),p=f.probe.ports;
  assert.equal(f.feature,result);assert.equal(p.pending,f.owners.sessions.pending);assert.equal(p.viewport,f.owners.viewport);assert.equal(p.preview,f.owners.sessions.preview);
  assert.equal(p.selection,f.owners.interaction.selection);assert.equal(p.valueInput,f.input.valueInput);assert.equal(p.withCanvasState,f.input.surface.withCanvasState);
  assert.equal(p.updateGeometrySelectionUI,f.owners.presentation.updateGeometrySelectionUI);assert.equal(p.readMode,f.owners.interaction.lifecycle.readMode);
  f.state.bound={id:'bound'};assert.equal(p.currentScope(),f.state.bound);assert.notEqual(p.currentScope(),f.state.scope);
  assert.equal(p.prepareStart('ignored'),f.state.result);assert.equal(p.invalidateAnalysis('ignored'),undefined);
  f.owners.interaction.lifecycle.setMode('offset');assert.equal(p.readMode(),'offset');
  for(const [flag,action]of [['scopeFailure',()=>p.currentScope()],['prepareFailure',()=>p.prepareStart()],['invalidateFailure',()=>p.invalidateAnalysis()]]){f.state[flag]=true;assert.throws(action,error=>error===f.state.error);f.state[flag]=false;}
  traces.push(JSON.stringify(f.events));
 }
 assert.equal(traces[1],traces[0]);
});

test('Offset editing assembly retains actual planning, replacement scope, source identities and commit-refusal allocation rollback',()=>{
 for(const outcome of ['accepted','refused','throw']){
  const traces=[];
  for(const composed of [false,true]){
   const f=offsetOwnersFixture(composed),previous=f.state.scope;f.state.scope=f.empty();f.state.bound=f.state.scope;f.state.sketch='S2';
   const geometry=f.foundation.geometry,source=geometry.addLine(geometry.addPoint(0,0,false,'endpoint'),geometry.addPoint(40,0,false,'endpoint'));
   f.sourceSelection.add(source);const plan=f.feature.chainDraft(f.sourceSelection.entries,5,1);assert.equal(plan.ok,true);assert.equal(plan.geometries[0].p1.y,5);
   const points=f.state.scope.points,lines=f.state.scope.lines,sequences=[f.ids.peek('point'),f.ids.peek('line')];
   f.state.accepted=outcome==='accepted';f.state.commitFailure=outcome==='throw';
   if(outcome==='throw')assert.throws(()=>f.feature.createGeometry(source,5,1,{x:20,y:5}),error=>error===f.state.error);
   else assert.equal(f.feature.createGeometry(source,5,1,{x:20,y:5}),outcome==='accepted');
   assert.equal(f.state.scope.points,points);assert.equal(f.state.scope.lines,lines);assert.equal(lines[0],source);assert.equal(source.sketchId,'S2');assert.equal(previous.lines.length,0);
   if(outcome==='refused'){assert.equal(points.length,2);assert.equal(lines.length,1);assert.deepEqual([f.ids.peek('point'),f.ids.peek('line')],sequences);assert.equal(f.state.scope.constraints.length,0);}
   else{assert.equal(points.length,4);assert.equal(lines.length,2);assert.equal(lines[1].p1.y,5);assert.equal(f.state.scope.constraints.length,outcome==='accepted'?1:0);}
   traces.push(JSON.stringify({scope:f.state.scope,events:f.events,ids:[f.ids.peek('point'),f.ids.peek('line')]}));
  }
  assert.equal(traces[1],traces[0],outcome);
 }
});

test('Offset editing assembly propagates constructor failure before reading the scope or changing parent owners',()=>{
 for(const composed of [false,true]){const probe={constructorFailure:true,error:new Error('offset constructor')};assert.throws(()=>offsetOwnersFixture(composed,probe),error=>error===probe.error);}
});

test('prepared authoring preview keeps real Snap, Line, Centerline and Trim behavior with live scale and scope',()=>{
 const run=owned=>{
  const f=laterAuthoringEditorsFixture(owned?'prepared':true),g=f.foundation.geometry,scope=f.state.parent.scope;
  const {projectPointToCenterlineSupport}=f.centerline;
  const preview=owned?f.preparation.preview:{snapForDrawing:p=>f.tools.snapForDrawing(p),linePreviewPoint:(p,s)=>f.tools.tools.line.previewPoint(p,s),
   readCenterline:()=>f.centerline,projectPointToCenterlineSupport:p=>projectPointToCenterlineSupport(p),computeTrimPreview:p=>f.trim.computePreview(p)};
  const a=g.addPoint(0,0,false,'endpoint'),b=g.addPoint(100,0,false,'endpoint');assert.equal(f.centerline.prepare([a,b]),true);
  const projected=preview.projectPointToCenterlineSupport({x:30,y:10});assert.equal(preview.readCenterline(),f.centerline);
  const snap=preview.snapForDrawing({x:30,y:8});f.state.parent.scale=2;const scaled=preview.snapForDrawing({x:30,y:8});
  f.tools.tools.line.click({x:0,y:0});const linePreview=preview.linePreviewPoint({x:30,y:8},true);
  const line=(x1,y1,x2,y2)=>g.addLine(g.addPoint(x1,y1,false,'endpoint'),g.addPoint(x2,y2,false,'endpoint'));
  line(0,0,30,0);line(10,-10,10,10);line(20,-10,20,10);const trim=preview.computeTrimPreview({x:15,y:0});
  return JSON.parse(JSON.stringify({projected,snap,scaled,linePreview,trim,model:f.snapshot(),ids:f.ids.snapshot(),points:scope.points.length}));
 };
 assert.deepEqual(run(true),run(false));
});

test('prepared drawing ports stay cold and only replace completed authoring, editing, Centerline and Trim components',()=>{
 const w=geometryFoundationFixture().w,p=w.BasicDrawingTools.prepare();assert.ok(Object.isFrozen(p));assert.ok(Object.isFrozen(p.preview));
 for(const [method,binding]of [['snapForDrawing','authoringTools'],['linePreviewPoint','lineCommand'],['readCenterline','centerlineCommand'],
   ['projectPointToCenterlineSupport','projectPointToCenterlineSupport'],['computeTrimPreview','trimFeature']])
  assert.throws(()=>p.preview[method](),e=>e.name==='ReferenceError'&&e.message===`Cannot access '${binding}' before initialization`);
 const f=laterAuthoringEditorsFixture('prepared'),prepared=f.preparation,marker=new Error('constructor failed'),before=f.snapshot(),ids=f.ids.snapshot();
 const builds=[['DrawingSnap',()=>prepared.createGeometry(f.geometryOptions).createAuthoringForEditing({...f.ports,...f.owners})],
  ['FilletFeature',()=>prepared.createEditing(f.common)],['CenterlineCommand',()=>prepared.createCenterline(f.centerInput)],['TrimFeature',()=>prepared.createTrim(f.trimInput)]];
 for(const [name,build]of builds){const original=f.w[name];f.w[name]={...original,create(){throw marker;}};
  try{assert.throws(build,e=>e===marker);}finally{f.w[name]=original;}
  assert.equal(prepared.preview.readCenterline(),f.centerline);assert.equal(f.snapshot(),before);assert.deepEqual(f.ids.snapshot(),ids);
 }
 const next=prepared.createCenterline(f.centerInput);assert.notEqual(next,f.centerline);assert.equal(prepared.preview.readCenterline(),next);
});

test('prepared preview preserves raw member and bare receivers, exact arguments, results and exceptions',()=>{
 const f=laterAuthoringEditorsFixture('prepared'),p=f.preparation,w=f.w,calls=[],result={},marker=new Error('preview failed');let fail=false;
 const snap={resolve(...args){assert.equal(this,snap);calls.push(['snap',...args]);if(fail)throw marker;return result;},clear(){}},
  line={previewPoint(...args){assert.equal(this,line);calls.push(['line',...args]);return result;}};
 const originals={DrawingSnap:w.DrawingSnap,LineCommand:w.LineCommand};w.DrawingSnap={create:()=>snap};w.LineCommand={create:()=>line};
 try{p.createGeometry(f.geometryOptions).createAuthoringForEditing({...f.ports,...f.owners});}finally{Object.assign(w,originals);}
 const point={x:10,y:20},pointer={x:30,y:40};f.state.parent.scale=2;
 assert.equal(p.preview.snapForDrawing(point,'ignored'),result);assert.equal(p.preview.linePreviewPoint(point,true,'ignored'),result);
 const centerline=Object.freeze({projectPointToCenterlineSupport:function(...args){assert.equal(this,undefined);calls.push(['project',...args]);return result;}}),
  trim=Object.freeze({computePreview(...args){assert.equal(this,trim);calls.push(['trim',...args]);if(fail)throw marker;return result;}});
 const c=w.CenterlineCommand,t=w.TrimFeature;w.CenterlineCommand={create:()=>centerline};w.TrimFeature={create:()=>trim};
 try{assert.equal(p.createCenterline(f.centerInput),centerline);assert.equal(p.createTrim(f.trimInput),trim);}finally{w.CenterlineCommand=c;w.TrimFeature=t;}
 assert.equal(p.preview.readCenterline('ignored'),centerline);assert.equal(p.preview.projectPointToCenterlineSupport(point,'ignored'),result);
 assert.equal(p.preview.computeTrimPreview(pointer,'ignored'),result);
 assert.deepEqual(calls,[['snap',point,5],['line',point,true],['project',point],['trim',pointer]]);
 fail=true;assert.throws(()=>p.preview.snapForDrawing(point),e=>e===marker);assert.throws(()=>p.preview.computeTrimPreview(pointer),e=>e===marker);
});

})();

function hatchOwnersFixture(composed, probe = {}) {
 const f=geometryFoundationFixture({composed:true,configure({w,state,owners,ports,events}){
  const ready=()=>assert.equal(state.ready,true);state.pointer={x:7,y:9};state.history=[];
  const rawIds=w.DocumentIds.create();
  const documentIds={allocate(kind){assert.equal(this,documentIds);ready();events.push(['allocate',kind]);if(state.allocateFailure)throw state.error;return rawIds.allocate(kind);},
   peek(kind){assert.equal(this,documentIds);ready();return rawIds.peek(kind);}};
  owners.documentWorkspace.documentIds=documentIds;
  owners.sessions.pointer={readLastPointer:function(){'use strict';assert.equal(this,undefined);ready();events.push('pointer');return state.pointer;}};
  const preview=owners.sessions.preview;preview.setPointer=function(value){assert.equal(this,preview);ready();preview.pointer=value;};
  owners.readServices.hatches={hatchFaceAt(pointer,options){'use strict';assert.equal(this,undefined);ready();events.push(['face',pointer,options.includeConstruction]);
   if(state.queryFailure)throw state.error;return {ok:true,boundaryLoops:[{role:'outer',spans:[]}],resolved:{area:12}};},forget(item){ready();state.forgotten=item;}};
  ports.recordHistory=label=>{ready();state.history.push(label);};
  ports.clearSelection=()=>{ready();owners.interaction.selection.clear();events.push('clear');};
 }}),{state,owners,w,events}=f;
 state.ready=false;state.scope.hatches=[];state.error=new Error('hatch owner boundary');
 const options={updateStatusUI:function(){'use strict';assert.equal(this,undefined);assert.equal(state.ready,true);events.push('status');return state.statusResult;},
  hatchRegionErrorText:error=>error.code};
 const original=w.HatchCommand;let hatch;
 w.HatchCommand={...original,create(input){probe.ports=input;if(probe.failure)throw probe.error;return probe.result??original.create(input);}};
 try{hatch=composed?f.tools.createHatchForEditing(options):f.tools.createHatch({hatchGeometryQuery:owners.readServices.hatches,readMode:owners.interaction.lifecycle.readMode,
  lastPointer:owners.sessions.pointer.readLastPointer,documentIds:owners.documentWorkspace.documentIds,...options});}
 finally{w.HatchCommand=original;}
 assert.deepEqual(events,[]);state.ready=true;return {...f,hatch,options,probe};
}
test('Hatch editing assembly shares actual parent mode, pointer, preview, Selection and Document counters',()=>{
 const results=[];for(const composed of [false,true]){
  const f=hatchOwnersFixture(composed),{state,owners,hatch,probe}=f;
  assert.equal(probe.ports.getMode,owners.interaction.lifecycle.readMode);assert.equal(probe.ports.lastPointer,owners.sessions.pointer.readLastPointer);
  assert.equal(probe.ports.updateStatusUI,f.options.updateStatusUI);assert.equal(probe.ports.hatchRegionErrorText,f.options.hatchRegionErrorText);
  hatch.startHatchCreation();assert.equal(owners.interaction.lifecycle.mode,'hatch');assert.equal(owners.sessions.preview.pointer,state.pointer);
  assert.equal(hatch.commitHatchAt({x:10,y:20}),true);assert.equal(hatch.finish(),true);
  const first=state.scope.hatches[0];assert.equal(first.id,'H1');assert.equal(first.sketchId,'S1');assert.equal(owners.interaction.selection.hatches[0],first);
  state.scope={hatches:[]};state.sketch='LOCAL-S2';state.pointer={x:30,y:40};
  assert.equal(hatch.commitHatchAt(state.pointer),true);assert.equal(hatch.finish(),true);
  assert.equal(state.scope.hatches[0].id,'H2');assert.equal(state.scope.hatches[0].sketchId,'LOCAL-S2');
  assert.equal(state.scope.nextHatchIndex,3);assert.equal(f.ids.peek('point'),1);
  results.push(JSON.stringify({events:f.events,scope:state.scope,history:state.history,first}));
 }assert.equal(results[1],results[0]);
});
test('Hatch editing assembly retains guard, query and allocation failure boundaries without advancing Geometry IDs',()=>{
 for(const stage of ['guard','query','allocate']){
  const results=[];for(const composed of [false,true]){
   const f=hatchOwnersFixture(composed),{state,hatch,owners}=f;
   if(stage==='guard'){state.allowed=false;hatch.startHatchCreation();assert.equal(owners.interaction.lifecycle.mode,'select');}
   else{
    hatch.startHatchCreation();
    if(stage==='query'){state.queryFailure=true;assert.throws(()=>hatch.commitHatchAt(state.pointer),error=>error===state.error);}
    else{assert.equal(hatch.commitHatchAt(state.pointer),true);state.allocateFailure=true;assert.throws(()=>hatch.finish(),error=>error===state.error);}
   }
   assert.equal(state.scope.hatches.length,0);assert.equal(state.history.length,0);assert.equal(f.ids.peek('point'),1);
   results.push(JSON.stringify({events:f.events,scope:state.scope,mode:owners.interaction.lifecycle.mode}));
  }assert.equal(results[1],results[0]);
 }
});
test('Hatch editing assembly returns the existing command directly and leaves constructor failures unchanged',()=>{
 for(const composed of [false,true]){
  const result=Object.freeze({command:true}),probe={result};assert.equal(hatchOwnersFixture(composed,probe).hatch,result);
  const error=new Error('Hatch construction');assert.throws(()=>hatchOwnersFixture(composed,{failure:true,error}),caught=>caught===error);
 }
});

function previewOwnersFixture(composed, probe = {}) {
 const f=geometryFoundationFixture({composed:true}),calls=[],reads=[],state={width:800,height:600},w=f.w;
 const ctx=new Proxy({}, {set(target,key,value){calls.push(['set',key,value]);target[key]=value;return true;}});
 for(const name of ['save','restore','beginPath','moveTo','lineTo','arc','stroke','fill','strokeRect','setLineDash'])ctx[name]=(...args)=>calls.push([name,...args]);
 calls.length=0;
 const ready=()=>assert.equal(f.state.ready,true),surface={withCanvasState:function(fn){'use strict';assert.equal(this,undefined);ready();calls.push(['enter']);try{return fn();}finally{calls.push(['exit']);}}};
 const canvas={get clientWidth(){assert.equal(this,canvas);ready();reads.push('width');if(state.widthError)throw state.widthError;return state.width;},
  get clientHeight(){assert.equal(this,canvas);ready();reads.push('height');if(state.heightError)throw state.heightError;return state.height;}};
 const display={traceSplinePath:function(spline){'use strict';assert.equal(this,undefined);ready();calls.push(['spline',spline.closed]);if(state.traceError)throw state.traceError;}};
 const centerline={support:{ok:true,anchor:{x:10,y:20},ux:1,uy:0},firstPoint:null,
  projectPointToCenterlineSupport:function(point){'use strict';assert.equal(this,undefined);ready();reads.push('project');return point;}};
 const original=w.AuthoringPreviewRenderer;probe.order=[];probe.ports={};probe.actual={};probe.f={...f,state,calls,reads};
 w.AuthoringPreviewRenderer={...original};for(const name of ['create','createLayer'])w.AuthoringPreviewRenderer[name]=options=>{
  probe.order.push(name);probe.ports[name]=options;if(probe.failure===name)throw probe.error;return probe.actual[name]=original[name](options);
 };
 f.state.ready=false;let preview;
 try{preview=composed?f.tools.createPreviewForEditing({ctx,surface,geometry:display,canvas,centerlineCommand:centerline})
  :f.tools.createPreview({ctx,viewport:f.owners.viewport,withCanvasState:surface.withCanvasState,traceSplinePath:display.traceSplinePath,
    readMode:f.owners.interaction.lifecycle.readMode,centerlineCommand:centerline,readCanvasSize:()=>({width:canvas.clientWidth,height:canvas.clientHeight})});}
 finally{w.AuthoringPreviewRenderer=original;}
 assert.deepEqual(calls,[]);assert.deepEqual(reads,[]);f.state.ready=true;
 return {...f,preview,ctx,surface,display,canvas,centerline,drawState:state,calls,reads,probe};
}

test('authoring preview assembly shares the real renderer, layer, viewport and live command owners without reading Canvas state',()=>{
 for(const composed of [false,true]){
  const f=previewOwnersFixture(composed),p=f.probe.ports;
  assert.deepEqual(f.probe.order,['create','createLayer']);assert.equal(f.preview.renderer,f.probe.actual.create);assert.equal(f.preview.layer,f.probe.actual.createLayer);
  assert.ok(Object.isFrozen(f.preview));assert.equal(p.create.viewport,f.owners.viewport);assert.equal(p.create.ctx,f.ctx);
  assert.equal(p.create.withCanvasState,f.surface.withCanvasState);assert.equal(p.create.traceSplinePath,f.display.traceSplinePath);
  assert.equal(p.createLayer.readMode,f.owners.interaction.lifecycle.readMode);assert.equal(p.createLayer.lineCommand,f.tools.tools.line);
  assert.equal(p.createLayer.splineDraft,f.tools.spline.draft);assert.equal(p.createLayer.centerlineCommand,f.centerline);
  assert.equal(f.ids.peek('point'),1);assert.equal(f.state.scope.points.length,0);
 }
});

test('authoring preview keeps real drawing traces, live Canvas dimensions and scale across mode and draft changes',()=>{
 const traces=[];
 for(const composed of [false,true]){
  const f=previewOwnersFixture(composed),lifecycle=f.owners.interaction.lifecycle;
  f.tools.tools.line.click({x:0,y:0});f.owners.sessions.preview.pointer={x:20,y:10};
  f.tools.spline.draft.points.push({x:0,y:0},{x:10,y:10});
  f.owners.sessions.preview.trim={kind:'line',interval:{left:{point:{x:1,y:2}},right:{point:{x:3,y:4}}}};
  for(const mode of ['select','line','centerline','spline','trim']){lifecycle.setMode(mode);f.preview.layer.draw();if(mode==='trim')f.preview.layer.drawTrimPreview();}
  assert.ok(f.calls.some(c=>c[0]==='spline'));const modeTrace=JSON.stringify({calls:f.calls,reads:f.reads});
  lifecycle.setMode('centerline');f.owners.sessions.preview.pointer=null;f.calls.length=0;f.reads.length=0;
  f.drawState.width=1000;f.drawState.height=700;f.state.scale=2;f.preview.layer.drawCenterlinePreview();
  assert.deepEqual(f.calls.find(c=>c[0]==='moveTo'),['moveTo',-365,20]);assert.deepEqual(f.reads,['width','height']);
  f.drawState.width=200;f.drawState.height=400;f.state.scale=4;f.preview.layer.drawCenterlinePreview();
  assert.deepEqual(f.calls.filter(c=>c[0]==='moveTo').at(-1),['moveTo',-65,20]);assert.deepEqual(f.reads,['width','height','width','height']);
  traces.push(JSON.stringify({modeTrace,calls:f.calls,reads:f.reads,points:f.state.scope.points.map(p=>[p.id,p.x,p.y])}));
 }assert.equal(traces[1],traces[0]);
});

test('authoring preview retains constructor and Canvas getter exceptions with the original stop and drawing-state boundaries',()=>{
 for(const composed of [false,true]){
  for(const failure of ['create','createLayer']){const error=new Error(failure),probe={failure,error};
   assert.throws(()=>previewOwnersFixture(composed,probe),value=>value===error);assert.deepEqual(probe.order,failure==='create'?['create']:['create','createLayer']);
   assert.deepEqual(probe.f.reads,[]);assert.deepEqual(probe.f.calls,[]);assert.equal(probe.f.ids.peek('point'),1);
  }
  for(const failure of ['width','height']){const f=previewOwnersFixture(composed),error=new Error(failure);f.drawState[failure+'Error']=error;
   f.owners.interaction.lifecycle.setMode('centerline');assert.throws(()=>f.preview.layer.drawCenterlinePreview(),value=>value===error);
   assert.deepEqual(f.reads,failure==='width'?['width']:['width','height']);assert.deepEqual(f.calls,[]);
  }
  const f=previewOwnersFixture(composed),error=new Error('Spline path');f.drawState.traceError=error;
  f.tools.spline.draft.points.push({x:0,y:0},{x:10,y:10});f.owners.sessions.preview.pointer={x:20,y:10};f.owners.interaction.lifecycle.setMode('spline');
  assert.throws(()=>f.preview.layer.drawSplinePreview(),value=>value===error);assert.deepEqual(f.calls.at(-1),['exit']);assert.deepEqual(f.reads,[]);
 }
});
