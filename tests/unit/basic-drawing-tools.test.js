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

function lifecycleFixture() {
 const f=authoringFixture(),external={};
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
function geometryFoundationFixture(){
 const sandbox={window:{},structuredClone};vm.createContext(sandbox);
 const sources=vm.runInNewContext(fs.readFileSync('index.html','utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
 for(const file of sources.filter(p=>p.startsWith('src/')))vm.runInContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
 const w=sandbox.window,events=[],empty=()=>({points:[],lines:[],circles:[],arcs:[],splines:[],constraints:[]});
 const state={ready:false,scope:empty(),sketch:'S1',construction:false,endpoint:null,explicit:null,failure:null};
 const read=()=>{assert.equal(state.ready,true,'no eager scope or hit read');return state.scope;},ids=w.GeometryIds.create();
 const foundation=w.BasicDrawingTools.createGeometry({currentScope:read,ids,assignSketchId:item=>{read();item.sketchId=state.sketch;},
  currentConstruction:()=>{read();return state.construction;},minLineLength:4,minArcLength:6,
  hitEndpointPoint:(...args)=>{read();events.push(['endpoint',...args]);if(state.failure)throw state.failure;return state.endpoint;},
  hitExplicitPoint:(...args)=>{read();events.push(['explicit',...args]);return state.explicit;}});
 let checkpoint;
 const noop=()=>{},pointUsage=Object.fromEntries(['isSplineOnlyFitPoint','isReferencePoint','isPrimitiveCenterPoint','isPointUsedByPrimitive'].map(k=>[k,()=>false]));
 Object.assign(pointUsage,{isEndpointPoint:p=>p.kind==='endpoint',isExplicitPoint:p=>p.kind==='explicit'});
 const sketchContext={isActiveSketchElement:p=>{read();return p.sketchId===state.sketch;},elementSketchId:p=>p.sketchId,isReferenceSourceSketchId:()=>false,
  sketchName:id=>id,activeSketchId:()=>{read();return state.sketch;},sameSketchElements:()=>true};
 const tools=foundation.createAuthoring({samePosition:(a,b)=>a.x===b.x&&a.y===b.y,sketchContext,pointUsage,
  geometryReads:Object.fromEntries(['allGeometryPoints','allGeometryLines','allGeometryCircles','allGeometryArcs','allGeometrySplines'].map(k=>[k,()=>{read();return [];} ])),
  isVisibleSketchElement:()=>true,annotationAnchors:()=>{read();return [];},scale:()=>1,
  transientAuthoring:Object.fromEntries(['beginTransientLineStartRollback','beginTransientLineCompletionRollback','markCompletedLine','clearTransientLineStartRollback'].map(k=>[k,()=>events.push([k])])),
  pushModelConstraint:noop,addConstraintIfMissing:noop,selection:w.CanvasSelection.create(),preview:{setPointer:noop},
  checkpoint:{capture:(...args)=>checkpoint.capture(...args),restore:(...args)=>checkpoint.restore(...args)},
  cancelConstraintTargetCommand:noop,cancelPendingCommand:noop,canCreateInActiveSketch:()=>true,rejectRootSketchCreation:noop,
  setMode:noop,resetEditing:noop,resetBlankCandidate:noop,updateToolbar:noop,projection:{reset:noop},clearSelection:noop,
  solveAndRefresh:()=>({success:true}),recordHistory:noop,applicationText:(_ja,en)=>en,setHint:noop,updateUI:noop,draw:noop,log:noop});
 assert.deepEqual(events,[]);assert.equal(Object.isFrozen(foundation),true);state.ready=true;checkpoint={capture:noop,restore:noop};
 return {foundation,tools,state,ids,events,empty};
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
