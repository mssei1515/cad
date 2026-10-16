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
