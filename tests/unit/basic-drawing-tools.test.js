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

function authoringFixture() {
 const created={},events=[],state={scale:2,snapped:{x:3,y:4},snap:{id:'snap'},selected:null,mode:'select'};
 const names=['DrawingSnap','SplineDraft','SplineCommand','SnapConstraints','LineCommand','RectangleCommand','CircularConstruction','CircularCommands','SlotConstruction','SlotCommand','CenterlineGeometry','CenterlineConstruction','CenterlineCommand'];
 const sandbox={window:{}};
 for(const name of names) sandbox.window[name]={create(ports){
  events.push(name);const owner={name,active:null,clear:()=>{}};
  owner.resolve=function(point,tolerance){assert.equal(this,owner);events.push(['resolve',point,tolerance]);owner.active=state.snap;return state.snapped;};
  for(const method of ['click','clickCircle','clickArc','clickThreePointArc'])owner[method]=function(...args){assert.equal(this,owner);events.push([name,method,...args]);};
  if(name==='SnapConstraints')for(const key of ['addPointSnapConstraints','addArcEndpointSnapConstraints','addCircularBoundarySnapConstraints','addLineBoundarySnapConstraints'])owner[key]=()=>{};
  created[name]={ports,owner};return owner;
 }};
 vm.runInNewContext(fs.readFileSync('src/application/basic_drawing_tools.js','utf8'),sandbox);
 const noop=()=>{},never=()=>{throw Error('no eager query or operation');};
 const sketchContext=Object.fromEntries(['isActiveSketchElement','elementSketchId','isReferenceSourceSketchId','sketchName','sameSketchElements','activeSketchId'].map(key=>[key,never]));
 const pointUsage=Object.fromEntries(['isSplineOnlyFitPoint','isReferencePoint','isPrimitiveCenterPoint','isEndpointPoint','isPointUsedByPrimitive','isExplicitPoint'].map(key=>[key,never]));
 const selection={set(key,items){assert.equal(this,selection);state.selected={key,items};events.push('selected');}};
 const ports={currentScope:never,ids:{},geometry:Object.fromEntries(['addPoint','addLine','addCircle','addArc','addSpline'].map(key=>[key,noop])),endpointAt:noop,samePosition:noop,
  sketchContext,pointUsage,geometryReads:{},isVisibleSketchElement:never,annotationAnchors:never,scale:()=>state.scale,transientAuthoring:{},pushModelConstraint:noop,addConstraintIfMissing:noop,
  minLineLength:4,minArcLength:6,selection,preview:{setPointer:noop},checkpoint:{capture:never,restore:never},cancelConstraintTargetCommand:noop,cancelPendingCommand:noop,
  canCreateInActiveSketch:never,rejectRootSketchCreation:noop,setMode:value=>{state.mode=value;events.push('mode');},resetEditing:never,resetBlankCandidate:never,updateToolbar:noop,
  projection:{reset:noop},clearSelection:noop,solveAndRefresh:noop,recordHistory:noop,applicationText:(_ja,en)=>en,setHint:noop,updateUI:noop,draw:noop,log:noop};
 const feature=sandbox.window.BasicDrawingTools.createAuthoring(ports);
 return {created,events,state,ports,feature};
}

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
