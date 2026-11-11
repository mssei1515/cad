const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} };
vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(source => source.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window;
function fixture(extraSketches = {}) {
  const calls = [], state = { sketches: new Map(), snapFailure: null };
  let presentation;
  const feature = w.CanvasSelectionFeature.create({
    sketches: { sketchById: id => { calls.push('lookup:' + id); return state.sketches.get(id); }, ...extraSketches },
    guardSketchEdit: id => { calls.push('guard:' + id); return false; },
    clearSelection: () => { calls.push('clear'); return presentation.clearing.clear(); },
    updateGeometrySelectionUI: () => calls.push('ui'), draw: () => calls.push('draw'),
  });
  const hover = w.CanvasHover.create({ isEndpointPoint: () => false });
  const targets = w.ConstraintTargetSession.create({ acceptTarget: () => { throw new Error('unexpected target edit'); } });
  const pointer = w.PointerInteractionController.createSession();
  presentation = feature.createPresentation({ hover, constraintTargets: targets, pointer,
    projections: { blockProjectionBundle: () => { throw new Error('unexpected projection read'); } },
    constraintReferences: w.ConstraintReferences.create({ resolveGeometryRef: () => null }),
    clearSnap: () => { calls.push('snap'); if (state.snapFailure) throw state.snapFailure; },
  });
  return { feature, presentation, hover, targets, pointer, state, calls };
}
const point = (id, sketchId = 'S1') => Object.assign(new w.GeometrySolver.Point(id, 0, 0), { sketchId });

test('both construction phases defer work and share current selection, scope and dimension hover', () => {
  const f = fixture(), first = point('P1'), second = point('P2', 'S2'); assert.deepEqual(f.calls, []);
  f.feature.selection.set('points', [first]); assert.equal(f.feature.scope.selectionSketchId(), 'S1');
  f.feature.selection.set('points', [second]); assert.equal(f.feature.scope.selectionSketchId(), 'S2');
  const dimension = new w.GeometrySolver.DistanceConstraint(first, second, 10);
  f.feature.selection.clear(); f.feature.selection.set('constraint', dimension);
  assert.equal(f.presentation.highlight.isSelectedConstraintRelatedElement(first), true);
  f.presentation.highlight.setSidebarHover('constraint', dimension, new Set(), { redraw: false });
  assert.equal(f.hover.current.dimension, dimension); assert.equal(f.presentation.highlight.current.item, dimension);
  assert.equal(f.presentation.highlight.clearSidebarHover('constraint', dimension, { redraw: false }), true);
  assert.equal(f.hover.current.dimension, null); assert.deepEqual(f.calls, []);
});

test('identity selection uses the same clearing and keeps a locked identity selected before the guard', () => {
  const f = fixture(), first = point('P1'), second = point('P2', 'S2');
  f.state.sketches.set('S2', { locked: true }); f.feature.selection.set('points', [first]);
  f.targets.begin('distance', [{ kind: 'point', point: first }]); const command = f.targets.command;
  f.pointer.setLastPointer(first); f.hover.update({ point: first, annotation: first });
  f.presentation.highlight.setSidebarHover('geometry', first, new Set([first]), { redraw: false });
  assert.equal(f.feature.identity.selectInactive({}, { kind: 'point', item: second, sketchId: 'S2' }), undefined);
  assert.equal(f.feature.selection.points[0], second); assert.equal(f.feature.scope.selectionSketchId(), 'S2');
  assert.equal(f.targets.operands.length, 0); assert.equal(f.targets.command, command);
  assert.equal(f.pointer.readLastPointer(), first); assert.equal(f.hover.current.point, first);
  assert.equal(f.hover.current.annotation, null); assert.equal(f.presentation.highlight.current, null);
  assert.deepEqual(f.calls, ['clear', 'ui', 'draw', 'lookup:S2', 'guard:S2']);
});

test('document reset retains its distinct selection, target-command and annotation-hover boundaries', () => {
  const f = fixture(), item = point('P1'), operands = [{ item }];
  f.feature.selection.set('points', [item]); f.feature.selection.set('annotations', [item]);
  f.targets.begin('tangent', operands); const command = f.targets.command;
  f.pointer.setLastPointer(item); f.hover.update({ point: item, annotation: item, hatch: item, dimension: item });
  f.presentation.highlight.setSidebarHover('geometry', item, new Set([item]), { redraw: false });
  f.presentation.documentReset.reset();
  assert.equal(f.pointer.readLastPointer(), null); assert.equal(f.presentation.highlight.current, null);
  assert.equal(f.hover.current.point, null); assert.equal(f.hover.current.hatch, null); assert.equal(f.hover.current.dimension, null);
  assert.equal(f.hover.current.annotation, item); assert.equal(f.feature.selection.points[0], item);
  assert.equal(f.feature.selection.annotations.length, 0); assert.equal(f.targets.command, command); assert.equal(f.targets.operands, operands);
  assert.deepEqual(f.calls, ['snap']);
});

test('reset propagates a snap failure after pointer cleanup and before clearing later selection fields', () => {
  const f = fixture(), item = point('P1'), failure = new Error('snap failed');
  f.feature.selection.set('annotations', [item]); f.pointer.setLastPointer(item); f.hover.update({ point: item });
  f.state.snapFailure = failure;
  assert.throws(() => f.presentation.documentReset.reset(), error => error === failure);
  assert.equal(f.pointer.readLastPointer(), null); assert.equal(f.hover.current.point, null);
  assert.equal(f.feature.selection.annotations[0], item); assert.deepEqual(f.calls, ['snap']);
});

test('constraint operand assembly keeps the actual Selection, target session, live Sketch relation and latest spline pointer', () => {
  const relations = new Map([['S1', 'active'], ['S2', 'reference']]); let ready = false;
  const f = fixture({ elementSketchId: item => { assert.equal(ready, true); return item.sketchId; },
    operandRelationForSketch: id => { assert.equal(ready, true); return relations.get(id); },
    sameSketchElements: () => { assert.equal(ready, true); return true; } });
  const bridge = f.feature.createConstraintOperands({ targets: f.targets, pointer: f.pointer,
    solver: { get syncLineOrientationHints() { assert.fail('no eager solver access'); } }, acceptError: 1e-4 });
  assert.ok(Object.isFrozen(bridge)); assert.deepEqual(f.calls, []); ready = true;
  const first = point('P1'), second = point('P2', 'S2'), arc = { id: 'A1', sketchId: 'S1' };
  f.feature.selection.set('points', [first]); f.feature.selection.set('arcs', [arc]);
  f.feature.selection.set('arcEndpoint', { arc, endpoint: 'end' });
  const operands = bridge.fromSelection(); assert.deepEqual(Array.from(operands, value => value.kind), ['point', 'arc-endpoint']);
  assert.equal(operands[0].point, first); assert.equal(operands[1].arc, arc);
  f.targets.begin('distance', [bridge.operands.makeConstraintOperand('point', { point: second })]);
  assert.equal(bridge.syncSelection(), undefined); assert.equal(f.feature.selection.points[0], second);
  assert.equal(f.feature.selection.arcEndpoint, null); assert.equal(f.feature.selection.arcs.length, 0);
  relations.set('S2', 'active'); assert.equal(bridge.fromSelection()[0].relation, 'active');
  f.feature.selection.clear();
  const curve = w.SplineGeometry.build([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }]);
  const spline = { id: 'SP', sketchId: 'S1', curve: () => curve, startPoint: () => ({ x: 0, y: 0 }) };
  f.feature.selection.set('splines', [spline]); f.pointer.setLastPointer({ x: 5, y: 0 });
  const left = bridge.fromSelection()[0]; f.pointer.setLastPointer({ x: 95, y: 0 }); const right = bridge.fromSelection()[0];
  assert.equal(left.spline, spline); assert.equal(right.spline, spline); assert.equal(left.endpoint, 'start'); assert.equal(right.endpoint, 'end');
  assert.ok(left.parameter < 0.1); assert.ok(right.parameter > 0.9); assert.deepEqual(f.calls, []);
});

test('constraint operand conversion errors leave the existing Selection and target operands untouched', () => {
  const marker = new Error('operand read'); let fail = false;
  const f = fixture({ elementSketchId: item => { if (fail) throw marker; return item.sketchId; }, operandRelationForSketch: () => 'active' });
  const bridge = f.feature.createConstraintOperands({ targets: f.targets, pointer: f.pointer, solver: {}, acceptError: 1e-4 });
  const item = point('P1'); f.feature.selection.set('points', [item]); fail = true;
  assert.throws(() => bridge.fromSelection(), error => error === marker); assert.equal(f.feature.selection.points[0], item);
  fail = false; const invalid = { get kind() { throw marker; } }, operands = [invalid]; f.targets.begin('distance', operands);
  assert.throws(() => bridge.syncSelection(), error => error === marker);
  assert.equal(f.feature.selection.points[0], item); assert.equal(f.targets.operands, operands); assert.deepEqual(f.calls, []);
});

function editingSelectionFixture(ownsClearing = false) {
 const calls=[],state={ready:false,active:'S1',locked:new Set(),geometryMode:true,snapFailure:null};let snap,preview;
 const check=()=>assert.equal(state.ready,true,'no eager Sketch or Selection policy read');
 const sketches={activeSketchId:()=>{check();return state.active;},canEditSketch:(id,operation)=>{check();calls.push(['permission',id,operation]);return id===state.active&&!state.locked.has(id);},
  sketchById:id=>{check();calls.push(['lookup',id]);return {id,locked:state.locked.has(id)};},elementSketchId:item=>item.sketchId};
 const feature=w.CanvasSelectionFeature[ownsClearing?'createEditingWithOwnedClearing':'createEditing']({sketches,isGeometryMode:()=>{check();return state.geometryMode;},setHint:(message,kind)=>calls.push(['hint',message,kind]),applicationText:(_ja,en)=>en,
  clearSnap:()=>snap.clear(),clearPointerPreview:()=>preview.setPointer(null),clearSelection:()=>{calls.push('clear');feature.selection.clear();},
  updateGeometrySelectionUI:()=>calls.push('ui'),draw:()=>calls.push('draw')});
 assert.deepEqual(calls,[]);state.ready=true;
 snap={clear(){assert.equal(this,snap);calls.push('snap');if(state.snapFailure)throw state.snapFailure;}};
 preview={setPointer(value){assert.equal(this,preview);calls.push(['pointer',value]);}};
 return {feature,state,calls};
}

test('owned Selection clearing publishes only complete presentation and retains native call and failure boundaries',()=>{
 const f=editingSelectionFixture(true),original=w.CanvasSelectionInteraction,clear=f.feature.clearSelection,marker={},failure=new Error('clearing');
 const hover=w.CanvasHover.create({isEndpointPoint:()=>false}),targets=w.ConstraintTargetSession.create({acceptTarget:()=>({ok:false})}),pointer=w.PointerInteractionController.createSession();
 const options={hover,constraintTargets:targets,pointer,projections:{blockProjectionBundle:()=>null},constraintReferences:w.ConstraintReferences.create({resolveGeometryRef:()=>null}),clearSnap(){}};
 let failAt=null,methodFailure=false,reads=0,calls=0,malformed=false,value;
 const unready=()=>assert.throws(()=>clear(),{name:'ReferenceError',message:"Cannot access 'selectionClearing' before initialization"});unready();
 w.CanvasSelectionInteraction={...original,createClearing(input){if(failAt==='clearing')throw failure;const native=original.createClearing(input);
  if(malformed)return value;
  const result={get clear(){reads++;return function(){'use strict';assert.equal(this,result);assert.equal(arguments.length,0);calls++;if(methodFailure)throw failure;native.clear();return marker;};}};return Object.freeze(result);},
  createDocumentReset(input){if(calls===0)unready();if(failAt==='document-reset')throw failure;return original.createDocumentReset(input);}};
 try{
  failAt='document-reset';assert.throws(()=>f.feature.createPresentation(options),error=>error===failure);unready();
  failAt=null;const first=f.feature.createPresentation(options);assert.ok(Object.isFrozen(first));assert.equal(reads,0);
  assert.equal(clear('ignored'),marker);assert.equal(reads,1);assert.equal(calls,1);
  for(const stage of ['clearing','document-reset']){failAt=stage;assert.throws(()=>f.feature.createPresentation(options),error=>error===failure);assert.equal(clear(),marker);}
  failAt=null;methodFailure=true;assert.throws(()=>clear(),error=>error===failure);methodFailure=false;
  const independent=editingSelectionFixture(true);assert.throws(()=>independent.feature.clearSelection(),error=>error.name==='ReferenceError');
  for(value of [undefined,null]){malformed=true;f.feature.createPresentation(options);assert.throws(()=>clear(),error=>error.name==='TypeError');}
 }finally{w.CanvasSelectionInteraction=original;}
});

test('editing Selection composition uses the same live scope for access and identity selection without an early app callback',()=>{
 const f=editingSelectionFixture(),a=point('P1'),b=point('P2','S2');
 assert.equal(Object.isFrozen(f.feature),true);assert.equal(Object.isFrozen(f.feature.access),true);
 assert.deepEqual(Object.keys(f.feature),['selection','scope','identity','createConstraintOperands','createPresentation','access','createDrawingOrder']);
 f.feature.selection.set('points',[a]);assert.equal(f.feature.scope.selectionItems()[0],a);assert.equal(f.feature.access.guardSelectionEdit(),true);
 f.calls.length=0;f.state.locked.add('S2');f.feature.identity.selectInactive({}, {kind:'point',item:b,sketchId:'S2'});
 assert.equal(f.feature.selection.points[0],b);assert.equal(f.feature.scope.selectionSketchId(),'S2');assert.deepEqual(f.calls.slice(0,3),['clear','ui','draw']);
 assert.equal(f.calls.at(-1)[0],'hint');assert.match(f.calls.at(-1)[1],/locked/);assert.equal(f.feature.access.guardSelectionEdit(),false);
 f.state.active='S2';f.state.locked.delete('S2');assert.equal(f.feature.access.guardSelectionEdit(),true);
 f.calls.length=0;assert.equal(f.feature.access.guardSketchEdit(undefined,'create'),true);assert.deepEqual(f.calls,[['permission','S2','create']]);
 f.calls.length=0;f.state.geometryMode=false;assert.equal(f.feature.access.canCreateInActiveSketch(),false);assert.deepEqual(f.calls,[]);
});

test('editing Selection refusal keeps late snap/preview owners, cleanup order and the original partial state on failure',()=>{
 const f=editingSelectionFixture(),item=point('P1');f.feature.selection.set('points',[item]);
 assert.equal(f.feature.access.rejectRootSketchCreation(),false);f.calls.length=0;f.state.locked.add('S1');
 assert.equal(f.feature.access.rejectRootSketchCreation(),true);assert.deepEqual(f.calls.slice(-3),['snap',['pointer',null],'draw']);assert.equal(f.feature.selection.points[0],item);
 const marker=new Error('snap clear failed');f.state.snapFailure=marker;f.calls.length=0;
 assert.throws(()=>f.feature.access.rejectRootSketchCreation(),error=>error===marker);assert.equal(f.calls.at(-1),'snap');assert.equal(f.calls.includes('draw'),false);
 assert.equal(f.calls.some(call=>Array.isArray(call)&&call[0]==='pointer'),false);assert.equal(f.feature.selection.points[0],item);
});

(function () {
"use strict";
function drawingOrderOwnersFixture(composed, constructorError = null) {
 const calls=[],state={ready:false,active:'S1',ordinary:true,locked:new Set(),failure:null};
 const ready=()=>assert.equal(state.ready,true,'no eager scope, Selection, Sketch or UI read');
 const note=name=>function(...args){assert.equal(this,undefined);ready();calls.push([name,...args]);if(state.failure===name)throw state.marker;};
 const sketches={activeSketchId:()=>{ready();return state.active;},elementSketchId:item=>{ready();return item.sketchId;},
  canEditSketch:(id,operation)=>{ready();calls.push(['permission',id,operation]);return !state.locked.has(id);},
  sketchById:id=>{ready();return {id,locked:state.locked.has(id)};}};
 const base={sketches,isGeometryMode:()=>{ready();return true;},setHint:note('hint'),applicationText:(_ja,en)=>en,
  clearSnap:note('snap'),clearPointerPreview:note('pointer'),clearSelection:()=>feature.selection.clear(),
  updateGeometrySelectionUI:note('selection-ui'),draw:note('draw')};
 const feature=w.CanvasSelectionFeature.createEditing(base);
 const item=(id,sketchId,order)=>({id,sketchId,drawingOrder:order});
 const first=item('L1','S1',0),second=item('L2','S1',1),other=item('L3','S2',0),third=item('L4','S3',0);
 const host={sketches:[{id:'S1'},{id:'S2'},{id:'S3'}],lines:[first,second,other,third]};
 state.bound=host;state.workspace={sketches:[],lines:[]};
 const editingScope={get current(){ready();calls.push(['scope']);if(state.failure==='scope')throw state.marker;return state.bound;}};
 const input={editingScope,ordinarySelectionMode:()=>{ready();calls.push(['ordinary']);if(state.failure==='ordinary')throw state.marker;return state.ordinary;},
  updateUI:note('ui'),recordHistory:note('history')};
 const raw={currentScope:()=>editingScope.current,canvasSelection:feature.selection,activeSketchId:sketches.activeSketchId,
  selectionSketchId:feature.scope.selectionSketchId,ordinarySelectionMode:input.ordinarySelectionMode,guardSelectionEdit:feature.access.guardSelectionEdit,
  updateUI:input.updateUI,draw:base.draw,recordHistory:input.recordHistory,applicationText:base.applicationText,setHint:base.setHint};
 const original=w.DrawingOrderCommand;let ports,actual;
 w.DrawingOrderCommand={...original,create(options){ports=options;if(constructorError)throw constructorError;return actual=original.create(options);}};
 let command;
 try{command=composed?feature.createDrawingOrder(input):w.DrawingOrderCommand.create(raw);}
 finally{w.DrawingOrderCommand=original;}
 assert.deepEqual(calls,[]);state.ready=true;
 const snapshot=()=>JSON.stringify({calls,host:host.lines.map(l=>[l.id,l.drawingOrder]),bound:state.bound.lines.map(l=>[l.id,l.drawingOrder]),selection:feature.selection.lines.map(l=>l.id)});
 return {feature,state,calls,sketches,input,raw,ports,actual,command,host,first,second,other,third,snapshot};
}

test('Selection-owned drawing order retains cold actual command, shared owners and live bound scope distinct from Workspace',()=>{
 for(const composed of [false,true]){
  const f=drawingOrderOwnersFixture(composed);
  assert.equal(f.command,f.actual);
  for(const key of Object.keys(f.raw).filter(k=>k!=='currentScope'))assert.equal(f.ports[key],f.raw[key],key);
  assert.equal(f.ports.currentScope(),f.host);assert.notEqual(f.ports.currentScope(),f.state.workspace);
  const lines=f.host.lines,sketches=f.host.sketches;
  assert.equal(f.command.topmostOwner([f.first,f.other,f.third]),f.first);
  assert.equal(f.command.topmostOwner([f.other,f.third]),f.third);
  f.state.ordinary=false;assert.equal(f.command.topmostOwner([f.other,f.third]),null);
  assert.equal(f.host.lines,lines);assert.equal(f.host.sketches,sketches);
  const a={id:'B1',sketchId:'S1',drawingOrder:0},b={id:'B2',sketchId:'S1',drawingOrder:1};
  f.state.bound={sketches:[{id:'S1'}],lines:[a,b]};f.feature.selection.set('lines',[a]);
  assert.equal(f.command.state().canForward,true);assert.equal(f.command.reorder('drawing-front'),true);
  assert.equal(a.drawingOrder,1);assert.equal(f.first.drawingOrder,0);assert.equal(f.host.lines[0],f.first);
 }
});

test('Selection-owned drawing order preserves selected inactive Sketch, mutations, per-Sketch ordering, identities and completion notifications',()=>{
 for(const scenario of ['drawing-front','drawing-back','drawing-forward','drawing-backward','unknown','locked','empty','inactive']){
  const results=[];
  for(const composed of [false,true]){
   const f=drawingOrderOwnersFixture(composed),lines=f.host.lines;
   if(scenario==='inactive')f.host.lines.push({id:'L5',sketchId:'S2',drawingOrder:1});
   f.feature.selection.set('lines',scenario==='empty'?[]:[scenario==='inactive'?f.other:f.first]);
   if(scenario==='locked')f.state.locked.add('S1');
   const action=scenario.startsWith('drawing-')||scenario==='unknown'?scenario:'drawing-front';
   const accepted=!['unknown','locked','empty'].includes(scenario);
   assert.equal(f.command.reorder(action),accepted);
   assert.equal(f.host.lines,lines);assert.equal(f.host.lines[0],f.first);
   assert.equal(f.calls.filter(call=>call[0]==='history').length,accepted?1:0);
   if(accepted){
    const ui=f.calls.find(call=>call[0]==='ui');assert.equal(ui.length,2);assert.equal(ui[1].refreshAnalysis,false);assert.deepEqual(Object.keys(ui[1]),['refreshAnalysis']);
    assert.deepEqual(f.calls.slice(-3).map(call=>call[0]),['draw','history','hint']);
    assert.equal(f.calls.find(call=>call[0]==='permission')[2],'edit');
   }
   if(scenario==='inactive'){assert.equal(f.other.drawingOrder,1);assert.equal(f.first.drawingOrder,0);}
   results.push(f.snapshot());
  }
  assert.equal(results[1],results[0],scenario);
 }
});

test('Selection-owned drawing order preserves constructor/query exceptions and partial mutations on UI, draw or history failure',()=>{
 const constructorError=new Error('construct');
 for(const composed of [false,true])assert.throws(()=>drawingOrderOwnersFixture(composed,constructorError),error=>error===constructorError);
 for(const failure of ['scope','ordinary','ui','draw','history','hint']){
  const results=[];
  for(const composed of [false,true]){
   const f=drawingOrderOwnersFixture(composed);f.state.failure=failure;f.state.marker=new Error(failure);
   f.feature.selection.set('lines',[f.first]);
   assert.throws(()=>failure==='scope'?f.command.state():failure==='ordinary'?f.command.topmostOwner([f.other,f.third]):f.command.reorder('drawing-front'),error=>error===f.state.marker);
   assert.equal(f.first.drawingOrder,['scope','ordinary'].includes(failure)?0:1);
   if(failure==='ui')assert.equal(f.calls.some(call=>call[0]==='draw'),false);
   if(failure==='draw')assert.equal(f.calls.some(call=>call[0]==='history'),false);
   results.push(f.snapshot());
  }
  assert.equal(results[1],results[0],failure);
 }
});
})();
