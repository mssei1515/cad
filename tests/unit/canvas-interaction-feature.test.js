const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test');
function fixture(){
 const sandbox={window:{},structuredClone};vm.createContext(sandbox);
 const sources=vm.runInNewContext(fs.readFileSync('index.html','utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
 for(const file of sources.filter(p=>p.startsWith('src/')))vm.runInContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
 const w=sandbox.window,events=[],state={ready:false,scope:{points:[],lines:[],circles:[],arcs:[],splines:[],constraints:[]},active:'S1',snapFailure:null};
 let sessions,presentation,lateOperand,lateSnap,latePreview;
 const read=()=>{assert.equal(state.ready,true,'no eager model read');return state.scope;};
 const sketches={activeSketchId:()=>{read();return state.active;},elementSketchId:item=>item.sketchId,canEditSketch:id=>{read();return id===state.active;},sketchById:id=>{read();return {id};}};
 const readServices={createPointUsage(options){assert.equal(this,readServices);events.push('pointUsage:create');return w.PointUsage.create({...options,currentScope:read,
  allGeometryLines:()=>read().lines,allGeometryCircles:()=>read().circles,allGeometryArcs:()=>read().arcs,allGeometrySplines:()=>read().splines});}};
 const foundation=w.CanvasInteractionFeature.create({sketches,readServices,constraintReferencesPoint:()=>false,editedFitPoints:()=>{read();return [];},isGeometryMode:()=>{read();return true;},
  setHint:()=>events.push('hint'),applicationText:(_ja,en)=>en,clearSnap:()=>lateSnap(),clearPointerPreview:()=>sessions.preview.setPointer(null),
  clearSelection:()=>presentation.clearing.clear(),updateGeometrySelectionUI:()=>events.push('ui'),draw:()=>events.push('draw')});
 assert.deepEqual(events,['pointUsage:create']);assert.equal(foundation.selection,foundation.selectionFeature.selection);assert.equal(foundation.scope,foundation.selectionFeature.scope);assert.equal(foundation.access,foundation.selectionFeature.access);
 sessions=foundation.createOperationSessions({snapForDrawing:p=>latePreview(p),linePreviewPoint:p=>latePreview(p),readCenterline:()=>latePreview(),projectPointToCenterlineSupport:p=>latePreview(p),
  readOffsetSelection:()=>latePreview(),computeTrimPreview:p=>latePreview(p),hits:{hitPoint:()=>latePreview(),hitLine:()=>latePreview(),hitCircle:()=>latePreview(),hitArc:()=>latePreview()},
  clearPlacement:()=>events.push('placement'),cancelAnnotation:()=>events.push('annotation'),cancelPngExport:()=>events.push('png'),resetOffset:()=>events.push('offset'),
  hideInput:()=>events.push('hide'),updateToolbar:()=>events.push('toolbar'),updateConstraintButtons:()=>events.push('buttons'),acceptTarget:(...args)=>lateOperand(...args)});
 presentation=sessions.createSelectionPresentation({projections:{blockProjectionBundle:()=>{read();return {};}},constraintReferences:{constraintGraphNodes:()=>new Set()}});
 assert.deepEqual(events,['pointUsage:create']);assert.equal(Object.isFrozen(foundation),true);assert.equal(Object.isFrozen(sessions),true);
 lateSnap=()=>{events.push('snap');if(state.snapFailure)throw state.snapFailure;};latePreview=p=>p;lateOperand=(_type,operands,candidate)=>({ok:true,operands:[...operands,candidate]});state.ready=true;events.length=0;
 const point=new w.GeometrySolver.Point('P1',0,0,false,'endpoint');point.sketchId='S1';state.scope.points.push(point);
 return {w,foundation,sessions,presentation,state,events,point,readServices};
}

test('Canvas interaction stages retain live owners, deferred ports and independent pending, constraint and pointer state',()=>{
 const f=fixture(),{foundation:b,sessions:s}=f,other=new f.w.GeometrySolver.Point('P2',10,0,false,'endpoint');other.sketchId='S1';
 f.state.scope.points.push(other);f.state.scope.lines.push(new f.w.GeometrySolver.Line('L1',f.point,other));
 b.hover.previewCandidate({kind:'point',item:f.point});assert.equal(b.hover.current.point,f.point);assert.equal(b.hover.current.endpointPoint,f.point);
 b.selection.set('points',[f.point]);assert.equal(b.scope.selectionItems()[0],f.point);assert.equal(b.access.guardSelectionEdit(),true);
 b.lifecycle.setMode('offset');assert.equal(b.lifecycle.readMode(),'offset');assert.equal(b.lifecycle.isToolMode(),true);
 const operand={item:f.point};s.targets.begin('horizontal',[operand]);const command=s.targets.command;assert.equal(s.targets.append('horizontal',{item:other},'invalid').ok,true);assert.equal(s.targets.operands[0],operand);
 s.pointer.setLastPointer(f.point);assert.equal(s.pointer.readLastPointer(),f.point);
 const trim={kind:'trim'};s.preview.setPointer(f.point);s.preview.setTrim(trim);s.pending.replace({type:'offset-value'});f.events.length=0;
 s.pending.cancel('');assert.equal(s.pending.current,null);assert.equal(s.preview.pointer,null);assert.equal(s.preview.trim,trim);
 assert.equal(s.targets.command,command);assert.equal(s.targets.operands.length,2);assert.equal(s.pointer.readLastPointer(),f.point);
 assert.deepEqual(f.events,['placement','offset','hide','toolbar','buttons','draw']);
});

test('Canvas interaction presentation shares original clearing/reset subsets and preserves the snap failure boundary',()=>{
 const f=fixture(),{foundation:b,sessions:s,presentation:p}=f,operand={item:f.point};
 b.selection.set('points',[f.point]);s.targets.begin('distance',[operand]);const command=s.targets.command;s.pointer.setLastPointer(f.point);
 b.hover.update({point:f.point,annotation:{id:'A1'},hatch:{id:'H1'}});p.highlight.setSidebarHover('geometry',f.point,new Set([f.point]),{redraw:false});
 p.clearing.clear();assert.equal(b.selection.points.length,0);assert.equal(b.hover.current.point,f.point);assert.equal(b.hover.current.annotation,null);assert.equal(s.pointer.readLastPointer(),f.point);
 assert.equal(s.targets.command,command);assert.equal(s.targets.operands.length,0);
 s.targets.replaceOperands([operand]);b.selection.set('points',[f.point]);b.selection.set('annotations',[{id:'A2'}]);const marker=new Error('snap failed');f.state.snapFailure=marker;f.events.length=0;
 assert.throws(()=>p.documentReset.reset(),error=>error===marker);assert.equal(b.selection.points[0],f.point);assert.equal(b.selection.annotations.length,1);assert.equal(b.hover.current.point,null);assert.equal(s.pointer.readLastPointer(),null);
 assert.equal(s.targets.command,command);assert.equal(s.targets.operands[0],operand);assert.deepEqual(f.events,['snap']);
 f.state.snapFailure=null;p.documentReset.reset();assert.equal(b.selection.annotations.length,0);assert.equal(b.selection.points[0],f.point);
});
function inputFixture(){
 const f=fixture(),{sessions:s,foundation:b,events}=f;f.state.ready=false;
 const viewport={scale:1,canvasPoint:()=>f.point,canvasScreenPoint:()=>f.point};
 const inputs=s.createInputFeature({document:{activeElement:null},canvas:{setPointerCapture:()=>{}},updateUI:()=>events.push('input-ui'),
  annotationCommand:{commitTextAnnotationAt:p=>events.push(['text',p])},annotationDrag:{},instanceSourceCommand:{finish:()=>{}},geometryInstanceCommand:{cancel:()=>false},
  clearSnap:()=>events.push('input-snap'),selectionRectangle:{},drawingSnap:{},viewport,transientAuthoring:{},
  createDrawingInput:()=>({}),geometryDrag:{},sameArcEndpoint:(a,b)=>a===b});
 assert.deepEqual(events,[]);f.state.ready=true;return {...f,inputs,viewport};
}

test('Canvas input assembly binds the existing pointer and preview with live pending state and the explicit input snap port',()=>{
 const f=inputFixture(),{sessions:s,foundation:b,events,inputs}=f;
 f.state.ready=false;
 assert.equal(s.bindPointer(inputs,{canvasNavigation:{movePan:()=>false},referenceImageInteraction:{},
  updateHatchPreview:p=>events.push(['hatch',p]),press:{closeContextMenu:()=>events.push('close'),activation:{},query:{read:()=>({})}}}),s.pointer);
 assert.deepEqual(events,[]);f.state.ready=true;
 s.pending.replace({type:'annotation-text-place',annotationDraft:true});events.length=0;
 s.pointer.down({button:0,preventDefault:()=>events.push('prevent')});
 assert.equal(s.pointer.readLastPointer(),f.point);assert.deepEqual(events,['close','prevent',['text',f.point]]);
 const next={x:7,y:9};s.pointer.move({},next,false);assert.equal(s.pending.current.pointer,next);assert.equal(s.pointer.readLastPointer(),next);
 s.pending.replace(null);b.lifecycle.setMode('hatch');b.hover.update({point:f.point});events.length=0;
 s.pointer.move({},f.point,false);assert.equal(s.preview.pointer,f.point);assert.equal(b.hover.current.point,null);
 assert.deepEqual(events,['input-snap',['hatch',f.point],'draw']);
});

test('Canvas keyboard assembly retains one listener, pending before constraint cancellation and the latest mode/pointer',()=>{
 const f=inputFixture(),{sessions:s,foundation:b,events,inputs}=f,listeners=new Map();
 const browser={addEventListener:(name,listener)=>{assert.equal(listeners.has(name),false);listeners.set(name,listener);},
  removeEventListener:(name,listener)=>{assert.equal(listeners.get(name),listener);listeners.delete(name);}};
 const marker=new Error('pending failed');let failure=marker;
 f.state.ready=false;
 const keyboard=s.createKeyboard(inputs,{window:browser,menus:{closeSketch:()=>false,canvasVisible:()=>false},sketchMove:{active:false},
  constraintStatusView:{hold:()=>false},dimensionInput:{handleKey:()=>false},shortcuts:{},projection:{},referenceImage:{},splineEditing:{},blockPlacement:{},
  cancelPendingCommand:()=>{events.push('cancel-pending');if(failure)throw failure;s.pending.replace(null);},
  cancelConstraintTargetCommand:()=>{events.push('cancel-target');s.targets.clearCommand();},
  offset:{canConfirmSelection:()=>true,confirmSelection:p=>events.push(['confirm',p])},
  isTextEditingTarget:()=>false,deleteSelection:()=>false,completeLineLength:()=>false});
 assert.deepEqual(events,[]);assert.equal(listeners.size,0);keyboard.start();keyboard.start();assert.equal(listeners.size,1);f.state.ready=true;
 function key(key){listeners.get('keydown')({key,target:{},preventDefault:()=>events.push('prevent')});}
 s.pending.replace({type:'offset-value'});s.targets.begin('distance',[]);const command=s.targets.command;events.length=0;
 assert.throws(()=>key('Escape'),error=>error===marker);assert.equal(s.pending.current.type,'offset-value');assert.equal(s.targets.command,command);
 assert.deepEqual(events,['prevent','cancel-pending']);failure=null;events.length=0;
 key('Escape');assert.equal(s.pending.current,null);assert.equal(s.targets.command,command);assert.deepEqual(events,['prevent','cancel-pending']);
 events.length=0;key('Escape');assert.equal(s.targets.command,null);assert.deepEqual(events,['prevent','cancel-target']);
 const point={x:11,y:12};s.pointer.setLastPointer(point);b.lifecycle.setMode('offset');events.length=0;
 key('Enter');assert.equal(events[1][1],point);assert.deepEqual(events,['prevent',['confirm',point]]);
 keyboard.dispose();keyboard.dispose();assert.equal(listeners.size,0);
}
);

test('editing pointer connection shares the existing identity, preview and pointer without early reads or error recovery',()=>{
 const f=fixture(),s=f.sessions,initial={x:31,y:47};s.pointer.setLastPointer(initial);f.state.ready=false;
 const marker=new Error('binding failed');let failure=false,calls=0;
 const inputs={bindPointerForEditing(pointer,options){
  assert.equal(this,inputs);assert.equal(pointer,s.pointer);assert.equal(options.identity,f.foundation.selectionFeature.identity);assert.equal(options.drawingPreview,s.preview);
  calls++;if(failure)throw marker;return pointer;
 }};
 assert.equal(s.bindEditingPointer(inputs,{}),s.pointer);assert.equal(calls,1);assert.equal(s.pointer.readLastPointer(),initial);assert.deepEqual(f.events,[]);
 failure=true;assert.throws(()=>s.bindEditingPointer(inputs,{}),error=>error===marker);assert.equal(calls,2);assert.equal(s.pointer.readLastPointer(),initial);assert.deepEqual(f.events,[]);
});

function editingInputsFixture(composed,probe={}){
 const f=fixture(),{w,sessions:s,foundation:b,events}=f;f.state.ready=false;probe.order=[];probe.error=new Error(probe.failAt||'input construction failed');
 const record=name=>function(){'use strict';assert.equal(this,undefined);assert.equal(f.state.ready,true);events.push([name,...arguments]);};
 const dimensionDragging={selectedLineGroup:()=>null,command:{begin:record('dimension')}},geometryDragging={command:{},build:record('plan'),beginDerived:record('derived')},
  blockDragging={begin:record('block')},referenceImage={beginDrag:record('image')},annotationFeature={command:{},startAnchorConstraint:()=>false};
 annotationFeature.command.commitTextAnnotationAt=function(point){assert.equal(this,annotationFeature.command);record('text')(point);};
 const drawingCommands=Object.fromEntries(['centerline','circleCenterCross','fillet','trim','offset'].map(name=>[name,{name}]));
 const authoring={snap:{clear:record('input-snap')},snapForDrawing(point){assert.equal(this,authoring);assert.equal(arguments.length,1);return point;},
  createCanvasInput(options){assert.equal(this,authoring);probe.order.push('drawingFactory');probe.drawingOptions=options;if(probe.failAt==='drawingFactory')throw probe.error;
   return probe.drawing=w.BasicDrawingTools.createCanvasInput({point:{},drawing:{getMode:options.readMode,rejectRootSketchCreation:()=>false,handleLineClick:record('line')}});}};
 const constraint=w.ConstraintCommandInput.createFeature({pending:s.pending,targets:s.targets,canvasHover:b.hover,canvasPoint:()=>f.point,
  placement:{retargetDistancePlaceWithOperand:()=>false,startDistanceValueInput:()=>{}},constraints:{operandClick:()=>false}});
 const constraintInputFeature={createInput(options){probe.order.push('ConstraintCommandInput');assert.equal(options.dragging,dimensionDragging);return constraint.createInput(options);}};
 const source={document:{activeElement:null},canvas:{setPointerCapture(id){assert.equal(this,source.canvas);events.push(['capture',id]);}},updateUI:()=>events.push('input-ui'),annotationFeature,annotationDrag:{},constraintInputFeature,dimensionDragging,
  constraintTargetHint:()=>{},instanceSourceCommand:{finish:()=>{}},geometryInstanceCommand:{cancel:()=>false},
  sceneQueries:{operands:{hitReferenceTarget:()=>null,hitDerivedProjectionOperand:()=>null,hitBlockProjectionOperand:()=>null},regions:{hitHatchAt:()=>null}},
  operandElement:value=>value,toggleSketchProjectionSource:()=>{},selectionRectangle:{},viewport:{scale:2,canvasPoint:()=>f.point,canvasScreenPoint:()=>f.point},
  transientAuthoring:{hasLineStart:false},authoring,drawingCommands,sameArcEndpoint:(a,c)=>a===c,
  topmostDrawingOrderOwner:()=>f.state.top,drawingOrderOwner:item=>item,geometryDragging,blockDragging,referenceImage};
 f.readServices.reads={resolveGeometryRef:()=>f.point};
 for(const name of ['AnnotationCommandInput','InstanceCommandInput','PointCommand','DrawingCommandInput','CanvasSelectionInteraction']){
  const owner=w[name];w[name]={...owner,create(...args){probe.order.push(name);if(probe.failAt===name)throw probe.error;return owner.create(...args);}};
 }
 const raw=w.CanvasCommandInputs;w.CanvasCommandInputs={...raw,createFeature(options){probe.ports=options;const actual=raw.createFeature(options);probe.actualInputs=actual;
  if(!probe.stubBindings&&!probe.observeBindings)return actual;
  const owner={...actual,bindPointerForEditing(pointer,options){assert.equal(this,owner);probe.pointer={pointer,options};if(probe.bindError)throw probe.bindError;return probe.observeBindings?actual.bindPointerForEditing(pointer,options):probe.result;},
   createKeyboard(options){assert.equal(this,owner);probe.keyboard=options;if(probe.keyboardError)throw probe.keyboardError;return probe.observeBindings?actual.createKeyboard(options):probe.result;}};
  return probe.boundInputs=owner;}};
 const inputs=composed==='owned'?s.createEditingInput(source):composed?s.createInputForEditing(source):s.createInputFeature({document:source.document,canvas:source.canvas,updateUI:source.updateUI,
  annotationCommand:annotationFeature.command,annotationDrag:source.annotationDrag,startAnnotationAnchorConstraint:annotationFeature.startAnchorConstraint,
  constraintInputFeature,dimensionDragging,beginDimensionDrag:dimensionDragging.command.begin,constraintTargetHint:source.constraintTargetHint,
  instanceSourceCommand:source.instanceSourceCommand,geometryInstanceCommand:source.geometryInstanceCommand,sceneQueries:source.sceneQueries,
  operandElement:source.operandElement,toggleSketchProjectionSource:source.toggleSketchProjectionSource,clearSnap:authoring.snap.clear,
  selectionRectangle:source.selectionRectangle,drawingSnap:authoring.snap,viewport:source.viewport,geometryRefForItem:w.GeometryObjects.geometryRefForItem,
  resolveGeometryRef:f.readServices.reads.resolveGeometryRef,snapForDrawing:point=>authoring.snapForDrawing(point),transientAuthoring:source.transientAuthoring,
  createDrawingInput:()=>authoring.createCanvasInput({readMode:b.lifecycle.readMode,...drawingCommands}),
  sameArcEndpoint:source.sameArcEndpoint,topmostDrawingOrderOwner:source.topmostDrawingOrderOwner,drawingOrderOwner:source.drawingOrderOwner,
  beginDerivedGeometryDrag:geometryDragging.beginDerived,beginBlockDrag:blockDragging.begin,beginReferenceImageDrag:referenceImage.beginDrag,
  buildDragSession:geometryDragging.build,geometryDrag:geometryDragging.command});
 assert.deepEqual(events,[]);f.state.ready=true;return{...f,inputs,source,probe};
}

test('editing input owners preserve real input order, drawing factory stage and shared state without eager model access',()=>{
 for(const composed of [false,true]){
  const f=editingInputsFixture(composed),{probe:p,source:o,foundation:b}=f;
  assert.deepEqual(p.order,['AnnotationCommandInput','ConstraintCommandInput','InstanceCommandInput','drawingFactory','PointCommand','DrawingCommandInput','CanvasSelectionInteraction']);
  assert.equal(f.inputs.inputs.drawing,p.drawing);assert.equal(p.ports.canvasSelection,b.selection);assert.equal(p.ports.canvasHover,b.hover);
  assert.equal(p.ports.transientAuthoring,o.transientAuthoring);assert.equal(p.ports.geometryDrag,o.geometryDragging.command);
  assert.equal(p.ports.beginDimensionDrag,o.dimensionDragging.command.begin);assert.equal(p.ports.beginBlockDrag,o.blockDragging.begin);
  assert.equal(p.ports.geometryRefForItem,f.w.GeometryObjects.geometryRefForItem);assert.equal(p.ports.resolveGeometryRef,f.readServices.reads.resolveGeometryRef);
  assert.equal(p.drawingOptions.readMode,b.lifecycle.readMode);for(const name of Object.keys(o.drawingCommands))assert.equal(p.drawingOptions[name],o.drawingCommands[name]);
  assert.equal(p.ports.snapForDrawing(f.point,'ignored'),f.point);b.lifecycle.setMode('line');f.events.length=0;
  f.inputs.inputs.drawing.click({pointerId:1},f.point,{});assert.equal(f.events.at(-1)[0],'line');assert.equal(f.events.at(-1)[1],f.point);
 }
});

test('editing input owners keep pending annotation pointer routing and dimension, Block and derived Selection drag entry points',()=>{
 for(const composed of [false,true]){
  const f=editingInputsFixture(composed),{sessions:s,inputs,events}=f;
  s.bindPointer(inputs,{canvasNavigation:{movePan:()=>false},referenceImageInteraction:{},press:{closeContextMenu:()=>events.push('close'),activation:{},query:{read:()=>({})}}});
  s.pending.replace({type:'annotation-text-place',annotationDraft:true});events.length=0;
  s.pointer.down({button:0,preventDefault:()=>events.push('prevent')});assert.equal(s.pointer.readLastPointer(),f.point);assert.equal(events.at(-1)[0],'text');assert.equal(events.at(-1)[1],f.point);
  s.pending.replace(null);events.length=0;const event={pointerId:2},dimension={constraint:{id:'C1'}};
  f.foundation.selection.set('points',[f.point]);inputs.inputs.selection.begin(event,f.point,{hitD:dimension});
  assert.equal(events.find(e=>Array.isArray(e)&&e[0]==='dimension')[2],dimension);assert.equal(f.foundation.selection.points.length,0);
  const block={id:'BI1'};f.state.top=block;inputs.inputs.selection.begin(event,f.point,{hitBlock:block});assert.equal(events.find(e=>Array.isArray(e)&&e[0]==='block')[2],block);
  const instance={id:'GI1'},hit={instance};f.state.top=instance;inputs.inputs.selection.begin(event,f.point,{hitDerivedGeometry:hit});assert.equal(events.find(e=>Array.isArray(e)&&e[0]==='derived')[2],hit);
 }
});

test('editing input construction preserves failure identity and short circuits before later components',()=>{
 const order=['AnnotationCommandInput','ConstraintCommandInput','InstanceCommandInput','drawingFactory','PointCommand','DrawingCommandInput','CanvasSelectionInteraction'];
 for(const composed of [false,true,'owned'])for(const failAt of ['AnnotationCommandInput','InstanceCommandInput','drawingFactory','CanvasSelectionInteraction']){
  const probe={failAt};assert.throws(()=>editingInputsFixture(composed,probe),error=>error===probe.error);assert.deepEqual(probe.order,order.slice(0,order.indexOf(failAt)+1));
 }
});
function cancellationFixture(composed, probe = {}) {
 const f=fixture(),{foundation:b,sessions:s,events,state,w}=f;
 state.ready=false;state.failAt=null;state.error=new Error('cancel failed');state.instance=false;
 const stage=name=>{assert.equal(state.ready,true);events.push(name);if(state.failAt===name)throw state.error;};
 const primitive=name=>({targets:[],points:[],entries:[],reset(){stage(name);this.startPoint=this.firstPoint=this.firstCenter=this.secondCenter=this.firstLine=this.source=null;this.points=[];this.entries=[];this.targets=[];},
  cancel(){stage(name+'.cancel');this.points=[];},resetCircle(){stage(name+'.circle');},resetArcs(){stage(name+'.arcs');}});
 const line=primitive('line'),centerline=primitive('centerline'),rectangle=primitive('rectangle'),slot=primitive('slot'),fillet=primitive('fillet'),
  circular=primitive('circular'),spline=primitive('spline'),splineEditing=primitive('spline-edit'),projection=primitive('projection'),offset=primitive('offset'),hatch=primitive('hatch');
 const instances={cancel(){assert.equal(this,instances);stage('instances');state.onInstances?.();return state.instance;},reset:()=>stage('instance-reset')};
 b.lifecycle.bind({instances,instanceSources:primitive('sources'),centerline,line,rectangle,slot,fillet,circular,spline,splineEditing,projection,preview:s.preview,offset,hatch,
  transient:{rollbackLineStart:()=>stage('rollback'),clearPoint:()=>stage('clear-point'),clearLineCompletion:()=>stage('clear-line')},
  clearSnap:()=>stage('snap'),clearSelection:b.selection.clear,updateToolbar:()=>stage('toolbar'),setHint:()=>events.push('hint'),updateUI:()=>stage('ui'),draw:()=>events.push('draw')});
 const constraints={cancel(message){assert.equal(this,constraints);assert.equal(message,'');stage('constraints');s.targets.reset();}};
 const blockPlacementCommand={reset(options){assert.equal(this,blockPlacementCommand);assert.equal(options.preservePanelState,true);stage('block');}};
 const ports={instances,constraints,blockPlacementCommand,restoreBlockPlacementPropertiesPanel:()=>stage('panel'),updateUI:()=>stage('ui')};
 const original=w.CanvasCommandCancellation;
 w.CanvasCommandCancellation={create(options){probe.options=options;if(probe.constructError)throw probe.constructError;return probe.actual=original.create(options);}};
 let command;
 try{command=composed?s.createCommandCancellation(ports):w.CanvasCommandCancellation.create({
  instances,readMode:b.lifecycle.readMode,selectMode:b.lifecycle.selectMode,blockPlacementCommand,drawingPreview:s.preview,restoreBlockPlacementPropertiesPanel:ports.restoreBlockPlacementPropertiesPanel,
  readPending:s.pending.read,cancelPendingCommand:message=>s.pending.cancel(message),readConstraintCommand:()=>s.targets.command,cancelConstraintTargetCommand:message=>constraints.cancel(message),
  drawing:{active:b.lifecycle.active,cancel:b.lifecycle.cancel,isToolMode:b.lifecycle.isToolMode,exit:b.lifecycle.exit},
  applicationText:(_ja,en)=>en,setHint:()=>events.push('hint'),updateUI:ports.updateUI,draw:()=>events.push('draw')});}
 finally{w.CanvasCommandCancellation=original;}
 assert.deepEqual(events,[]);state.ready=true;
 return{...f,command,probe,line,ports};
}

test('Canvas cancellation composition shares cold real sessions and lifecycle without binding or copying pending commands',()=>{
 for(const composed of [false,true]){
  const f=cancellationFixture(composed),{sessions:s,foundation:b,probe:{options:p}}=f;
  assert.equal(f.command,f.probe.actual);assert.equal(Object.isFrozen(f.command),true);
  assert.equal(p.drawingPreview,s.preview);assert.equal(p.readPending,s.pending.read);assert.equal(p.readMode,b.lifecycle.readMode);
  assert.equal(p.drawing.active,b.lifecycle.active);assert.equal(p.drawing.cancel,b.lifecycle.cancel);assert.equal(p.drawing.exit,b.lifecycle.exit);
  const pending={type:'distance-value'},operand={item:f.point};s.pending.replace(pending);s.targets.begin('horizontal',[operand]);
  assert.equal(p.readPending(),pending);assert.equal(p.readConstraintCommand(),s.targets.command);
  b.lifecycle.setMode('block-place');f.line.startPoint=f.point;f.state.instance=true;
  assert.equal(f.command.cancel(),true);assert.equal(s.pending.current,null);assert.equal(s.targets.command,null);assert.equal(b.lifecycle.mode,'select');
  assert.ok(f.events.indexOf('block')<f.events.indexOf('panel'));assert.ok(f.events.indexOf('panel')<f.events.indexOf('constraints'));
  assert.equal(f.events.at(-1),'draw');assert.equal(f.state.scope.points[0],f.point);
 }
});

test('Canvas cancellation composition retains sequential rereads and actual drawing cancellation plus tool exit traces',()=>{
 for(const mutate of [false,true]){
  const traces=[];
  for(const composed of [false,true]){
   const f=cancellationFixture(composed),{sessions:s,foundation:b}=f;
   s.pending.replace({type:'distance-value'});s.targets.begin('horizontal',[]);f.line.startPoint=f.point;b.lifecycle.setMode('line');
   if(mutate)f.state.onInstances=()=>{s.pending.clear();s.targets.reset();f.line.startPoint=null;b.lifecycle.selectMode();};
   assert.equal(f.command.cancel(),!mutate);
   if(mutate)assert.deepEqual(f.events,['instances']);
   else{assert.equal(f.events.filter(e=>e==='line').length,2);assert.equal(f.events.filter(e=>e==='instance-reset').length,1);assert.equal(b.lifecycle.mode,'select');}
   assert.equal(s.pending.current,null);assert.equal(s.targets.command,null);
   traces.push(JSON.stringify({events:f.events,mode:b.lifecycle.mode,point:f.point}));
  }assert.equal(traces[1],traces[0]);
 }
});

test('Canvas cancellation composition preserves constructor and operation failure identity at each original effect boundary',()=>{
 for(const composed of [false,true]){
  const marker=new Error('factory failed');assert.throws(()=>cancellationFixture(composed,{constructError:marker}),error=>error===marker);
  for(const failAt of ['instances','block','panel','constraints','line','ui']){
   const f=cancellationFixture(composed),{sessions:s,foundation:b}=f;
   s.pending.replace({type:'distance-value'});s.targets.begin('horizontal',[]);f.line.startPoint=f.point;b.lifecycle.setMode('block-place');f.state.failAt=failAt;
   assert.throws(()=>f.command.cancel(),error=>error===f.state.error);
   assert.equal(f.events.at(-1),failAt);assert.equal(f.state.scope.points[0],f.point);
   if(['instances','block','panel'].includes(failAt)){assert.ok(s.pending.current);assert.ok(s.targets.command);}
   if(failAt==='constraints')assert.equal(s.pending.current,null);
  }
 }
});

function editingKeyboardFixture(composed, probe = {}) {
 const f=inputFixture(),{sessions:s,foundation:b,events,w,state}=f,listeners=new Map();
 state.ready=false;
 const stage=name=>{assert.equal(state.ready,true);events.push(name);if(state.failAt===name)throw state.error;};
 const browser={addEventListener(name,listener){assert.equal(listeners.has(name),false);listeners.set(name,listener);},
  removeEventListener(name,listener){assert.equal(listeners.get(name),listener);listeners.delete(name);}};
 const constraints={cancel(message){assert.equal(this,constraints);assert.equal(arguments.length,1);assert.equal(message,undefined);stage('constraint-cancel');s.targets.reset();},
  completeLineLength(){assert.equal(this,constraints);assert.equal(arguments.length,0);stage('complete');return Boolean(state.complete);}};
 const spline={finalize(value){assert.equal(this,probe.operations);assert.equal(arguments.length,1);assert.equal(value,false);stage('spline-finish');},
  removeLast(){assert.equal(this,probe.operations);assert.equal(arguments.length,0);stage('spline-remove');}};
 const projection={commit(){assert.equal(this,probe.operations);assert.equal(arguments.length,0);stage('projection');}};
 const hatch={finish(){assert.equal(this,probe.operations);assert.equal(arguments.length,0);stage('hatch');}};
 const options={window:browser,menus:{closeSketch:()=>false,canvasVisible:()=>false},sketchMove:{active:false},constraintStatusView:{hold:()=>false},
  dimensionInput:{handleKey:()=>false},shortcuts:{},referenceImage:{},splineEditing:{},blockPlacement:{},
  offset:{canConfirmSelection:()=>true,confirmSelection:p=>{stage('offset-confirm');events.push(p);}},isTextEditingTarget:()=>false,deleteSelection:()=>false};
 const original=w.KeyboardInput,controller=w.KeyboardInteractionController;
 w.KeyboardInput={create(ports){probe.ports=ports;if(probe.constructError)throw probe.constructError;return probe.actual=original.create(ports);}};
 w.KeyboardInteractionController={...controller,create(ports){probe.operations=ports.operations;return controller.create(ports);}};
 let keyboard;
 try{keyboard=composed?s.createKeyboardForEditing(f.inputs,{...options,constraints,spline,projection,hatch}):s.createKeyboard(f.inputs,{...options,projection,
  cancelPendingCommand:message=>s.pending.cancel(message),cancelConstraintTargetCommand:message=>constraints.cancel(message),
  completeLineLength:()=>constraints.completeLineLength(),finishSpline:spline.finalize,removeSplinePoint:spline.removeLast,finishProjection:projection.commit,finishHatch:hatch.finish});}
 finally{w.KeyboardInput=original;w.KeyboardInteractionController=controller;}
 assert.deepEqual(events,[]);assert.equal(listeners.size,0);state.ready=true;
 function key(key){listeners.get('keydown')({key,target:{},preventDefault:()=>events.push('prevent')});}
 return {...f,keyboard,probe,listeners,key,constraints,spline,projection,hatch};
}

test('editing keyboard keeps original callback receivers, arguments and live mode/pointer without eager listeners or state reads',()=>{
 for(const composed of [false,true]){
  const f=editingKeyboardFixture(composed),{sessions:s,foundation:b,events,keyboard,probe:{ports:p}}=f;
  assert.equal(keyboard,f.probe.actual);assert.equal(p.pendingCommandSession,s.pending);assert.equal(p.constraintTargetSession,s.targets);assert.equal(p.readPointer,s.pointer.readLastPointer);
  assert.equal(p.finishSpline,f.spline.finalize);assert.equal(p.removeSplinePoint,f.spline.removeLast);assert.equal(p.finishProjection,f.projection.commit);assert.equal(p.finishHatch,f.hatch.finish);
  assert.equal(p.cancelPendingCommand.length,1);assert.equal(p.cancelConstraintTargetCommand.length,1);assert.equal(p.completeLineLength.length,0);
  keyboard.start();keyboard.start();assert.equal(f.listeners.size,1);
  for(const [mode,key,stage]of [['spline','Enter','spline-finish'],['spline','Backspace','spline-remove'],['sketch-projection','Enter','projection'],['hatch','Enter','hatch'],['hatch-repair','Enter','hatch']]){
   b.lifecycle.setMode(mode);events.length=0;f.key(key);assert.deepEqual(events,['prevent',stage]);
  }
  const point={x:8,y:12};s.pointer.setLastPointer(point);b.lifecycle.setMode('offset');events.length=0;f.key('Enter');assert.deepEqual(events,['prevent','offset-confirm',point]);
  b.lifecycle.setMode('select');f.state.complete=true;events.length=0;f.key('Enter');assert.deepEqual(events,['complete','prevent']);
  keyboard.dispose();keyboard.dispose();assert.equal(f.listeners.size,0);
 }
});

test('editing keyboard cancels the real pending session before the independent constraint command and retains callback capture timing',()=>{
 for(const composed of [false,true]){
  const f=editingKeyboardFixture(composed),{sessions:s,events}=f;f.keyboard.start();
  s.pending.replace({type:'offset-value'});s.targets.begin('distance',[]);const command=s.targets.command;events.length=0;
  f.key('Escape');assert.equal(s.pending.current,null);assert.equal(s.targets.command,command);
  assert.deepEqual(events,['prevent','placement','offset','hide','hint','toolbar','buttons','draw']);
  events.length=0;f.key('Escape');assert.equal(s.targets.command,null);assert.deepEqual(events,['prevent','constraint-cancel']);
  f.spline.finalize=()=>{throw new Error('must use the originally captured callback');};
  f.foundation.lifecycle.setMode('spline');events.length=0;f.key('Enter');assert.deepEqual(events,['prevent','spline-finish']);f.keyboard.dispose();
 }
});

test('editing keyboard preserves constructor and command failures without swallowing the error or executing later effects',()=>{
 for(const composed of [false,true]){
  const constructError=new Error('keyboard construction');assert.throws(()=>editingKeyboardFixture(composed,{constructError}),value=>value===constructError);
  for(const [mode,key,stage]of [['spline','Enter','spline-finish'],['spline','Backspace','spline-remove'],['sketch-projection','Enter','projection'],['hatch','Enter','hatch'],['select','Enter','complete'],['select','Escape','constraint-cancel']]){
   const f=editingKeyboardFixture(composed),marker=new Error(stage);f.keyboard.start();f.foundation.lifecycle.setMode(mode);f.state.error=marker;f.state.failAt=stage;
   if(stage==='constraint-cancel')f.sessions.targets.begin('distance',[]);const command=f.sessions.targets.command;f.events.length=0;
   assert.throws(()=>f.key(key),value=>value===marker);assert.deepEqual(f.events,stage==='complete'?['complete']:['prevent',stage]);
   assert.equal(f.sessions.targets.command,command);f.keyboard.dispose();
  }
 }
});
function frameFixture(composed, failure) {
  'use strict';
  const f = fixture(), frames = new Map(), trace = [], marker = new Error('frame processing failure');
  let next = 0, input = null, afterMove = null;
  const step = name => { trace.push(name); if (failure === name) throw marker; };
  function requestFrame(callback) { assert.equal(this, undefined); step('request'); const id = next++; frames.set(id, callback); return id; }
  function cancelFrame(id) { assert.equal(this, undefined); step('cancel'); frames.delete(id); }
  function profilePhase(label, work) { assert.equal(this, undefined); assert.equal(label, 'preview'); step('phase'); const result = work(); step('phase end'); return result; }
  function withGeometryReadCache(work) { assert.equal(this, undefined); step('cache'); const result = work(); step('cache end'); return result; }
  function readInput() { assert.equal(this, undefined); step('input read'); assert.ok(input, 'late input binding'); return input; }
  function syncDimensionValueInput() { assert.equal(this, undefined); step('sync'); }
  const scheduler = composed ? f.sessions.createMoveScheduler({ requestFrame, cancelFrame, profilePhase, withGeometryReadCache, readInput, syncDimensionValueInput }) :
    f.w.PointerMoveScheduler.create({ requestFrame, cancelFrame, processMove: pointer => profilePhase('preview', () => {
      withGeometryReadCache(() => readInput().processMove(pointer));
      if (f.sessions.pending.current && ['distance-value', 'offset-value'].includes(f.sessions.pending.current.type)) syncDimensionValueInput();
    }) });
  assert.deepEqual(trace, []); assert.equal(frames.size, 0);
  function bind() {
    const bound = { processMove(pointer) { assert.equal(this, bound); step('move'); trace.push(JSON.parse(JSON.stringify(pointer))); if (afterMove) afterMove(pointer); return marker; } }; input = bound; return bound;
  }
  return { ...f, scheduler, trace, frames, marker, bind, afterMove(fn) { afterMove = fn; },
    tick() { const [id, callback] = frames.entries().next().value; frames.delete(id); callback(); },
    result() { return JSON.parse(JSON.stringify({ trace, stats: scheduler.stats(), pending: f.sessions.pending.current, frames: frames.size })); } };
}

test('Canvas frame assembly creates the actual scheduler cold and coalesces copied input before late binding', () => {
  const run = composed => {
    const f = frameFixture(composed); assert.ok(Object.isFrozen(f.scheduler)); f.scheduler.resetStats();
    const event = { offsetX: 1, offsetY: 2, shiftKey: false }; f.scheduler.schedule(event); event.offsetX = 99;
    f.scheduler.schedule({ offsetX: 3, offsetY: 4, shiftKey: true }); assert.equal(f.frames.size, 1);
    f.bind(); f.afterMove(() => f.sessions.pending.replace({ type: 'distance-value' })); f.tick();
    assert.deepEqual(f.trace, ['request', 'phase', 'cache', 'input read', 'move', { offsetX: 3, offsetY: 4, shiftKey: true }, 'cache end', 'sync', 'phase end']);
    assert.equal(f.scheduler.stats().coalescedMoves, 1); assert.equal(f.scheduler.stats().animationFrames, 1); return f.result();
  };
  assert.deepEqual(run(true), run(false));
});

test('Canvas frame processing reads pending state after input and keeps synchronous flush, discard and reentrant moves', () => {
  const run = composed => {
    const f = frameFixture(composed); f.bind(); f.scheduler.resetStats();
    f.sessions.pending.replace({ type: 'distance-value' }); f.afterMove(() => f.sessions.pending.clear());
    f.scheduler.schedule({ offsetX: 1 }); assert.equal(f.scheduler.flush(), true); assert.ok(!f.trace.includes('sync'));
    f.afterMove(() => f.sessions.pending.replace({ type: 'offset-value' }));
    f.scheduler.schedule({ offsetX: 2 }); f.tick(); assert.equal(f.trace.filter(s => s === 'sync').length, 1);
    f.scheduler.schedule({ offsetX: 3 }); assert.equal(f.scheduler.flush({ discard: true }), false);
    f.afterMove(pointer => { f.sessions.pending.replace({ type: 'other' }); if (pointer.offsetX === 4) f.scheduler.schedule({ offsetX: 5 }); });
    f.scheduler.schedule({ offsetX: 4 }); f.tick(); assert.equal(f.frames.size, 1); f.tick();
    assert.equal(f.scheduler.flush(), false); assert.equal(f.scheduler.stats().processedMoves, 4); return f.result();
  };
  assert.deepEqual(run(true), run(false));
});

test('Canvas frame assembly propagates stage failures without synchronizing or replaying an already consumed move', () => {
  for (const failure of ['phase', 'cache', 'input read', 'move', 'cache end', 'sync', 'phase end']) {
    const run = composed => {
      const f = frameFixture(composed, failure); f.bind(); f.scheduler.resetStats(); f.sessions.pending.replace({ type: 'offset-value' });
      f.scheduler.schedule({ offsetX: 1 }); assert.throws(() => f.tick(), error => error === f.marker);
      assert.equal(f.scheduler.flush(), false); assert.equal(f.scheduler.stats().processedMoves, 1); assert.equal(f.trace.at(-1), failure);
      return f.result();
    };
    assert.deepEqual(run(true), run(false), failure);
  }
});
function constructionFixture(composed, failure) {
  'use strict';
  const f=fixture(),events=f.events,stage={allowed:true,snap:true,drafts:{line:{id:'draft'},rectangle:{id:'rectangle'}},fail:failure},marker=new Error('construction interaction failure');
  const check=name=>{events.push(name);if(stage.fail===name)throw marker;};
  const projection={guardSketchProjectionShapeEdit(items,options){assert.equal(this,undefined);check('guard');assert.equal(items[0],f.lines[0]);assert.equal(options.includeSharedNodes,false);assert.equal(options.action,'Construction toggle');return stage.allowed;}};
  let metadata,snapClear;
  const options={projection,cancelConstraintTargetCommand(message){assert.equal(this,undefined);assert.equal(message,'');check('cancel');f.sessions.targets.reset();},
    synchronizeSketchProjectionMetadata:()=>metadata(),updateUI:()=>check('ui'),recordHistory(label){assert.equal(this,undefined);assert.equal(label,'補助線切替');check('history');},
    clearSnap:()=>snapClear(),updateToolbar:()=>check('toolbar')};
  const original=f.w.ConstructionCommand;let actual,ports;
  f.w.ConstructionCommand={create(input){ports=input;check('create');return actual=original.create(input);}};
  f.state.ready=false;let command;
  try{command=composed?f.sessions.createConstruction(options):f.w.ConstructionCommand.create({
    cancelConstraintTargetCommand:options.cancelConstraintTargetCommand,selectedConstructionTogglePrimitives:f.foundation.selection.selectedConstructionTogglePrimitives,
    guardSketchProjectionShapeEdit:projection.guardSketchProjectionShapeEdit,applicationText:(_ja,en)=>en,
    synchronizeSketchProjectionMetadata:options.synchronizeSketchProjectionMetadata,setHint:()=>events.push('hint'),clearSelection:()=>f.presentation.clearing.clear(),
    updateUI:options.updateUI,draw:()=>events.push('draw'),recordHistory:options.recordHistory,
    setLineMode:()=>{f.foundation.lifecycle.setMode('line');},resetLineInputs:()=>f.foundation.lifecycle.resetInputs('line'),clearSnap:options.clearSnap,updateToolbar:options.updateToolbar});
  }finally{f.w.ConstructionCommand=original;}
  assert.deepEqual(events,['create']);events.length=0;
  const reset=name=>()=>{check(name);stage.drafts[name]=null;};
  f.foundation.lifecycle.bind({line:{reset:reset('line')},rectangle:{reset:reset('rectangle')},fillet:{reset:reset('fillet')},
    circular:{resetCircle:reset('circle'),resetArcs:reset('arcs')},preview:{setPointer(value){assert.equal(value,null);check('preview');}}});
  assert.deepEqual(events,[]);f.state.ready=true;
  metadata=()=>check('metadata');snapClear=()=>{check('snap');stage.snap=false;};
  const other=Object.assign(new f.w.GeometrySolver.Point('P2',10,0),{sketchId:'S1'}),third=Object.assign(new f.w.GeometrySolver.Point('P3',20,0),{sketchId:'S1'});
  const lines=[Object.assign(new f.w.GeometrySolver.Line('L1',f.point,other,true),{sketchId:'S1'}),Object.assign(new f.w.GeometrySolver.Line('L2',other,third,false),{sketchId:'S1'})];
  f.state.scope.points.push(other,third);f.state.scope.lines.push(...lines);f.lines=lines;
  return{...f,lines,command,actual,ports,stage,marker,projection,events,
    snapshot(){return JSON.parse(JSON.stringify({events,mode:f.foundation.lifecycle.mode,enabled:command.enabled,flags:lines.map(l=>l.construction),selected:f.foundation.selection.lines.map(l=>l.id),
      target:f.sessions.targets.command,drafts:stage.drafts,snap:stage.snap}));}};
}

test('Canvas interaction constructs the actual construction command cold and shares the same selection and projection guard',()=>{
  const f=constructionFixture(true);assert.equal(f.command,f.actual);assert.ok(Object.isFrozen(f.command));
  assert.equal(f.ports.selectedConstructionTogglePrimitives,f.foundation.selection.selectedConstructionTogglePrimitives);assert.equal(f.ports.guardSketchProjectionShapeEdit,f.projection.guardSketchProjectionShapeEdit);
  assert.deepEqual(f.events,[]);assert.equal(f.foundation.lifecycle.mode,'select');assert.equal(f.command.enabled,false);
});

test('construction interaction preserves selected and rejected toggles, future preference, line mode and the original input reset sequence',()=>{
  const run=composed=>{const f=constructionFixture(composed);f.foundation.selection.set('lines',f.lines);assert.equal(f.command.state(true).active,false);
    assert.equal(f.command.toggle(),undefined);assert.deepEqual(f.lines.map(l=>l.construction),[true,true]);assert.equal(f.command.enabled,false);assert.equal(f.events.at(-1),'history');
    f.foundation.selection.set('lines',f.lines);f.stage.allowed=false;f.events.length=0;f.command.toggle();assert.deepEqual(f.events,['cancel','guard','draw']);assert.equal(f.foundation.selection.lines[0],f.lines[0]);
    f.foundation.selection.clear();f.events.length=0;f.command.toggle();assert.equal(f.foundation.lifecycle.mode,'line');assert.equal(f.command.enabled,true);assert.equal(f.stage.drafts.line,null);assert.equal(f.stage.drafts.rectangle,null);assert.equal(f.stage.snap,false);assert.ok(!f.events.includes('history'));
    assert.deepEqual(f.events,['cancel','line','rectangle','fillet','circle','arcs','preview','snap','toolbar','hint','draw']);
    f.command.restore(false);assert.equal(f.command.state(false).active,false);return f.snapshot();};assert.deepEqual(run(true),run(false));
});

test('construction owner assembly preserves command creation and callback/reset failures with the same partly changed preference and geometry',()=>{
  for(const composed of [false,true])assert.throws(()=>constructionFixture(composed,'create'),/construction interaction failure/);
  for(const failure of ['cancel','guard','metadata','ui','history','line','rectangle','fillet','circle','arcs','preview','snap','toolbar']){
    const run=composed=>{const f=constructionFixture(composed,failure);if(['guard','metadata','ui','history'].includes(failure))f.foundation.selection.set('lines',f.lines);
      assert.throws(()=>f.command.toggle(),error=>error===f.marker);return f.snapshot();};assert.deepEqual(run(true),run(false),failure);
  }
});


test('Owned Canvas input shares its private feature, pointer identity and command dependencies across separately generated bindings',()=>{
 const f=editingInputsFixture('owned',{stubBindings:true,result:{}}),{inputs:api,probe:p,source:o,sessions:s,foundation:b}=f;
 assert.equal(Object.isFrozen(api),true);assert.deepEqual(Object.keys(api),['bindPointer','createKeyboard','preparePointerForEditing']);assert.equal(api.inputs,undefined);
 assert.equal(p.pointer,undefined);assert.equal(p.keyboard,undefined);
 const pointerOptions={query:{},canvasNavigation:{}};
 assert.equal(api.bindPointer(pointerOptions),p.result);
 assert.equal(p.pointer.pointer,s.pointer);assert.equal(p.pointer.options.identity,b.selectionFeature.identity);assert.equal(p.pointer.options.drawingPreview,s.preview);
 assert.equal(p.pointer.options.query,pointerOptions.query);assert.equal(p.pointer.options.referenceImageInteraction,o.referenceImage);
 assert.equal(p.pointer.options.fillet,o.drawingCommands.fillet);assert.equal(p.pointer.options.offset,o.drawingCommands.offset);
 const constraints={cancel(){}},spline={finalize(){},removeLast(){}},hatch={finish(){}},projection={commit(){}},browser={};
 assert.equal(api.createKeyboard({window:browser,constraints,spline,hatch,projection}),p.result);
 assert.equal(p.keyboard.window,browser);assert.equal(p.keyboard.referenceImage,o.referenceImage);assert.equal(p.keyboard.offset,o.drawingCommands.offset);
 assert.equal(p.keyboard.pendingCommandSession,s.pending);assert.equal(p.keyboard.constraintTargetSession,s.targets);assert.equal(p.keyboard.readPointer,s.pointer.readLastPointer);
 assert.equal(p.keyboard.finishSpline,spline.finalize);assert.equal(p.keyboard.finishProjection,projection.commit);
 p.bindError=new Error('pointer');assert.throws(()=>api.bindPointer(pointerOptions),error=>error===p.bindError);
 p.keyboardError=new Error('keyboard');assert.throws(()=>api.createKeyboard({constraints,spline,hatch,projection}),error=>error===p.keyboardError);
 assert.deepEqual(f.events,[]);
});

test('Owned Canvas input preserves real pointer placement, keyboard pending cancellation and live shared Offset commands',()=>{
 const traces=[];
 for(const owned of [false,true]){
  const f=editingInputsFixture(owned?'owned':true),{sessions:s,foundation:b,source:o,events}=f,listeners=new Map();
  const offset=o.drawingCommands.offset;offset.canConfirmSelection=()=>true;offset.confirmSelection=p=>events.push(['offset-confirm',p]);
  const pointerOptions={canvasNavigation:{movePan:()=>false},hatch:{},spline:{},splineEditing:{},blockPlacement:{},annotationInput:{},dimensionValues:{},dimensions:{},expressions:{pointerReferences:{}},query:{read:()=>({})},closeContextMenu:()=>events.push('close'),blankGesture:{}};
  f.state.ready=false;
  const pointer=owned?f.inputs.bindPointer(pointerOptions):s.bindEditingPointer(f.inputs,{...pointerOptions,referenceImageInteraction:o.referenceImage,fillet:o.drawingCommands.fillet,offset});
  assert.equal(pointer,s.pointer);assert.deepEqual(events,[]);
  const keyboardOptions={window:{addEventListener:(type,listener)=>listeners.set(type,listener),removeEventListener:type=>listeners.delete(type)},menus:{closeSketch:()=>false,canvasVisible:()=>false},sketchMove:{active:false},constraintStatusView:{hold:()=>false},dimensionInput:{handleKey:()=>false},shortcuts:{},projection:{commit(){}},constraints:{cancel(){events.push('constraint-cancel');},completeLineLength:()=>false},spline:{finalize(){},removeLast(){}},hatch:{finish(){}},splineEditing:{},blockPlacement:{},isTextEditingTarget:()=>false,deleteSelection:()=>false};
  const keyboard=owned?f.inputs.createKeyboard(keyboardOptions):s.createKeyboardForEditing(f.inputs,{...keyboardOptions,referenceImage:o.referenceImage,offset});
  assert.equal(listeners.size,0);assert.deepEqual(events,[]);f.state.ready=true;keyboard.start();keyboard.start();assert.equal(listeners.size,1);
  const key=key=>listeners.get('keydown')({key,target:{},preventDefault:()=>events.push('prevent')});
  s.pending.replace({type:'annotation-text-place',annotationDraft:true});s.pointer.down({button:0,preventDefault:()=>events.push('prevent')});
  assert.equal(s.pointer.readLastPointer(),f.point);assert.equal(events.find(e=>Array.isArray(e)&&e[0]==='text')[1],f.point);
  s.pending.replace({type:'offset-value'});events.length=0;key('Escape');assert.equal(s.pending.current,null);assert.equal(events.includes('constraint-cancel'),false);
  b.lifecycle.setMode('offset');const next={x:17,y:19};s.pointer.setLastPointer(next);events.length=0;key('Enter');assert.deepEqual(events,['prevent',['offset-confirm',next]]);
  keyboard.dispose();keyboard.dispose();assert.equal(listeners.size,0);traces.push(JSON.stringify(events));
 }
 assert.equal(traces[1],traces[0]);
});

function pointerAssemblyFixture(composed, failure) {
 const probe={observeBindings:true},f=editingInputsFixture('owned',probe),{w,source:o,sessions:s,foundation:b,state}=f;
 const trace=[],listeners=new Map(),marker=new Error('pointer assembly '+failure),snapshot={};state.ready=false;
 const step=name=>{trace.push(name);if((state.failureStage??failure)===name)throw marker;};
 const splineEditing={current:null},dimensionValues={submit(){}},annotationInput={finish(){},start(){}};
 o.authoring.createBlankGesture=function(ports){assert.equal(this,o.authoring);step('blank');snapshot.blankPorts=ports;
  return snapshot.blank=w.BlankCanvasGesture.create({getMode:ports.lifecycle.readMode,getPending:()=>ports.pending.current,
   getPendingConstraint:()=>ports.constraintTargets.command,getSplineEditSession:()=>ports.splineEditing.current,
   getLineCommand:()=>({}),getTransientAuthoring:()=>({}),getTime:()=>100,hypot2:(x,y)=>Math.hypot(x,y),
   hasActiveDrawOperation:()=>false,hasSelection:b.selection.hasSelection,updateGeometrySelectionUI:ports.updateGeometrySelectionUI});};
 let querySequence=0;
 o.sceneQueries.createInteraction=function(ports){assert.equal(this,o.sceneQueries);step('query');snapshot.scenePorts=ports;
  assert.equal(state.readBlank(),snapshot.blank);state.readBlank().resetCandidate();
  const id=++querySequence;
  return snapshot.scene={press:{read:()=>{f.events.push(['query',id]);return {};}},hover:{updateConstraint:()=>false,updateOrdinary:()=>false},isBlankCommandPanelPoint:()=>true};};
 let registrations=0;
 o.canvas.addEventListener=function(type,listener){assert.equal(this,o.canvas);assert.equal(state.readBinding(),snapshot.native);trace.push('listen:'+type);
  if(failure==='native-bind'&&++registrations===3)throw marker;listeners.set(type,listener);};
 const navigation={movePan:()=>false,doubleClickFit(){},zoom(){}};
 const scheduler={flush(){assert.equal(state.readBinding(),snapshot.native);f.events.push('flush');},schedule(){}};
 const hatch={};Object.defineProperty(hatch,'updateHatchPreview',{get(){step('pointer');return ()=>{};}});
 const readPngExportCommand=()=>state.png;
 function createCanvasInputBinding(ports){'use strict';assert.equal(this,undefined);step('native');snapshot.nativePorts=ports;
  assert.throws(()=>state.readBinding(),error=>error.name==='ReferenceError');assert.equal(state.readBlank(),snapshot.blank);
  const routing=w.CanvasInputBinding.createCommandRouting({pointer:s.pointer,readCommandPanel:()=>state.panel,readPngExportCommand:ports.readPngExportCommand,
   blankCanvasGesture:ports.blankCanvasGesture,canvasScreenPoint:()=>({x:0,y:0}),canvasPoint:()=>f.point,isBlankCommandPanelPoint:ports.isBlankCommandPanelPoint,
   screenToWorld:()=>f.point,navigation});
  return snapshot.native=w.CanvasInputBinding.create({canvas:o.canvas,pointer:routing,scheduler:ports.scheduler,navigation,
   profileCommit:work=>work(),closeContextMenu:()=>f.events.push('close-native'),afterZoom(){},screenToWorld:()=>f.point,formatCoordinate:String,coordinateStatus:()=>null});
 }
 function assemble(){
  state.readBlank=()=>blankCanvasGesture;state.readBinding=()=>canvasInputBinding;
  const prepared=composed?f.inputs.preparePointerForEditing({splineEditing,dimensionValues,annotationInput}):
   {blankGesture:o.authoring.createBlankGesture({lifecycle:b.lifecycle,pending:s.pending,constraintTargets:s.targets,
    splineEditing,dimensionValues,offset:o.drawingCommands.offset,annotationInput,updateGeometrySelectionUI:()=>f.events.push('ui')})};
  const {blankGesture:blankCanvasGesture}=prepared;
  const ports={canvasNavigation:navigation,recordHistory:()=>f.events.push('history'),updatePendingDistanceRetargetHover:()=>{},hitDimension:()=>null,hitSketchIdentityElement:()=>null,
   hatch,spline:{},blockPlacement:{},dimensions:{},expressions:{pointerReferences:{}},discardMoves(){},enterBlock(){},closeContextMenu:()=>f.events.push('close'),
   hitBlockRotationHandle:()=>null,hitAnnotationTarget:()=>null,createCanvasInputBinding,readPngExportCommand,scheduler};
  function legacy(){
   const scene=o.sceneQueries.createInteraction({canvasHover:b.hover,sameArcEndpoint:o.sameArcEndpoint,hitBlockRotationHandle:ports.hitBlockRotationHandle,
    hitAnnotationTarget:ports.hitAnnotationTarget,blankCanvasGesture,instanceSourceCommand:o.instanceSourceCommand,hatchCommand:hatch});
   f.inputs.bindPointer({canvasNavigation:navigation,recordHistory:ports.recordHistory,pointerHover:scene.hover,updatePendingDistanceRetargetHover:ports.updatePendingDistanceRetargetHover,
    hitDimension:ports.hitDimension,hitSketchIdentityElement:ports.hitSketchIdentityElement,hatch,spline:ports.spline,splineEditing,blockPlacement:ports.blockPlacement,
    annotationInput,dimensionValues,dimensions:ports.dimensions,expressions:ports.expressions,discardMoves:ports.discardMoves,enterBlock:ports.enterBlock,
    query:scene.press,closeContextMenu:ports.closeContextMenu,blankGesture:blankCanvasGesture});
   return createCanvasInputBinding({readPngExportCommand,blankCanvasGesture,isBlankCommandPanelPoint:scene.isBlankCommandPanelPoint,scheduler});
  }
  const canvasInputBinding=composed?prepared.createBinding(ports):legacy();
  return {blankCanvasGesture,canvasInputBinding,ports,recreate:composed?()=>prepared.createBinding(ports):legacy};
 }
 function keyboard(){step('dimension-bind');step('keyboard-create');const keys=new Map();
  const input=f.inputs.createKeyboard({window:{addEventListener:(type,listener)=>{trace.push('keyboard-bind');keys.set(type,listener);},removeEventListener:type=>keys.delete(type)},
   menus:{closeSketch:()=>false,canvasVisible:()=>false},sketchMove:{active:false},constraintStatusView:{hold:()=>false},dimensionInput:{handleKey:()=>false},shortcuts:{},
   projection:{commit(){}},constraints:{cancel(){f.events.push('constraint-cancel');},completeLineLength:()=>false},spline:{finalize(){},removeLast(){}},hatch:{finish(){}},
   splineEditing,blockPlacement:{},isTextEditingTarget:()=>false,deleteSelection:()=>false});input.start();return {input,keys};
 }
 assert.deepEqual(trace,[]);assert.deepEqual(f.events,[]);return {...f,trace,listeners,snapshot,marker,assemble,keyboard};
}
test('two-stage pointer assembly publishes blank state before query, keeps shared identities and returns an unbound native component',()=>{
 const traces=[];for(const composed of [false,true]){
  const f=pointerAssemblyFixture(composed),result=f.assemble(),{snapshot:p,sessions:s,foundation:b}=f;
  assert.equal(Object.isFrozen(result.canvasInputBinding),true);assert.equal(result.canvasInputBinding,p.native);assert.equal(f.listeners.size,0);
  assert.deepEqual(f.trace,['blank','query','pointer','native']);assert.deepEqual(f.events,[]);
  assert.equal(p.blankPorts.lifecycle,b.lifecycle);assert.equal(p.blankPorts.pending,s.pending);assert.equal(p.blankPorts.constraintTargets,s.targets);
  assert.equal(p.blankPorts.offset,f.source.drawingCommands.offset);assert.equal(p.scenePorts.canvasHover,b.hover);assert.equal(p.scenePorts.blankCanvasGesture,p.blank);
  assert.equal(p.scenePorts.sameArcEndpoint,f.source.sameArcEndpoint);assert.equal(p.scenePorts.instanceSourceCommand,f.source.instanceSourceCommand);
  assert.equal(f.probe.pointer.pointer,s.pointer);assert.equal(f.probe.pointer.options.query,p.scene.press);assert.equal(f.probe.pointer.options.pointerHover,p.scene.hover);
  assert.equal(f.probe.pointer.options.blankGesture,p.blank);assert.equal(p.nativePorts.blankCanvasGesture,p.blank);
  assert.equal(p.nativePorts.readPngExportCommand,result.ports.readPngExportCommand);assert.equal(p.nativePorts.scheduler,result.ports.scheduler);
  assert.equal(p.nativePorts.isBlankCommandPanelPoint,p.scene.isBlankCommandPanelPoint);
  f.state.ready=true;result.canvasInputBinding.bind();assert.equal(f.listeners.size,8);const key=f.keyboard();key.input.dispose();traces.push(f.trace);
 }assert.deepEqual(traces[1],traces[0]);
});
test('two-stage pointer assembly preserves native pending placement, panel-before-PNG priority, movement and keyboard cancellation',()=>{
 const traces=[];for(const composed of [false,true]){
  const f=pointerAssemblyFixture(composed),{canvasInputBinding:native}=f.assemble();f.state.ready=true;native.bind();
  const event={button:0,offsetX:2,offsetY:3,preventDefault:()=>f.events.push('prevent')};
  f.sessions.pending.replace({type:'annotation-text-place',annotationDraft:true});f.listeners.get('pointerdown')(event);
  assert.equal(f.sessions.pointer.readLastPointer(),f.point);assert.equal(f.events.find(e=>Array.isArray(e)&&e[0]==='text')[1],f.point);
  f.events.length=0;f.state.png={active:true,pick:point=>{assert.equal(point,f.point);f.events.push('png-pick');},move:()=>f.events.push('png-move')};
  f.state.panel={active:true,canvasPress:()=>{f.events.push('panel');return true;},canvasMove:()=>f.events.push('panel-move')};
  f.listeners.get('pointerdown')(event);assert.deepEqual(f.events,['flush','panel','prevent']);f.listeners.get('dblclick')(event);assert.deepEqual(f.events,['flush','panel','prevent','flush','prevent']);
  f.state.panel=null;f.listeners.get('pointerdown')(event);assert.equal(f.events.at(-1),'png-pick');native.processMove({offsetX:2,offsetY:3,shiftKey:false});assert.equal(f.events.at(-1),'png-move');
  f.state.png=null;f.sessions.pending.replace({type:'offset-value'});f.events.length=0;const keyboard=f.keyboard();
  keyboard.keys.get('keydown')({key:'Escape',target:{},preventDefault:()=>f.events.push('prevent')});assert.equal(f.sessions.pending.current,null);
  assert.equal(f.events.includes('constraint-cancel'),false);keyboard.input.dispose();traces.push(JSON.stringify({events:f.events,trace:f.trace}));
 }assert.equal(traces[1],traces[0]);
});
test('two-stage pointer assembly preserves construction failures and publication without rolling back a connected pointer',()=>{
 for(const stage of ['blank','query','pointer','native']){
  const traces=[];for(const composed of [false,true]){
   const f=pointerAssemblyFixture(composed,stage);assert.throws(()=>f.assemble(),error=>error===f.marker);assert.equal(f.listeners.size,0);
   assert.throws(()=>f.state.readBinding(),error=>error.name==='ReferenceError');
   if(stage==='blank')assert.throws(()=>f.state.readBlank(),error=>error.name==='ReferenceError');else assert.equal(f.state.readBlank(),f.snapshot.blank);
   if(stage==='native'){
    f.state.ready=true;f.sessions.pending.replace({type:'annotation-text-place',annotationDraft:true});f.sessions.pointer.down({button:0,preventDefault(){}});
    assert.equal(f.events.some(e=>Array.isArray(e)&&e[0]==='text'),true);
   }
   traces.push(JSON.stringify({trace:f.trace,events:f.events}));
  }assert.equal(traces[1],traces[0]);
 }
});
test('two-stage pointer assembly leaves partial native registrations and the published component intact on bind failure',()=>{
 for(const composed of [false,true]){
  const f=pointerAssemblyFixture(composed,'native-bind'),{canvasInputBinding:native}=f.assemble();f.state.ready=true;
  assert.throws(()=>native.bind(),error=>error===f.marker);assert.equal(f.listeners.size,2);assert.equal(f.state.readBinding(),native);assert.equal(f.state.readBlank(),f.snapshot.blank);
  f.sessions.pending.replace({type:'annotation-text-place',annotationDraft:true});f.sessions.pointer.down({button:0,preventDefault(){}});
  assert.equal(f.events.some(e=>Array.isArray(e)&&e[0]==='text'),true);
 }
});

test('two-stage pointer assembly keeps the prior controller if a later pointer construction fails',()=>{
 for(const composed of [false,true]){
  const f=pointerAssemblyFixture(composed),result=f.assemble();f.state.failureStage='pointer';
  assert.throws(()=>result.recreate(),error=>error===f.marker);assert.equal(f.state.readBinding(),result.canvasInputBinding);
  f.state.ready=true;f.sessions.pending.replace({type:'annotation-text-place',annotationDraft:true});f.events.length=0;
  f.sessions.pointer.down({button:0,preventDefault(){}});
  assert.deepEqual(f.events.find(e=>Array.isArray(e)&&e[0]==='query'),['query',1]);
  assert.equal(f.events.some(e=>Array.isArray(e)&&e[0]==='text'),true);
 }
});

test('authoring operation sessions select the same five preview callbacks cold and keep the remaining ports and real sessions',()=>{
 const f=fixture(),w=f.w,original=w.DrawingPreview,seen=[],calls=[];
 const authoringPreview=Object.freeze(Object.fromEntries(['snapForDrawing','linePreviewPoint','readCenterline','projectPointToCenterlineSupport','computeTrimPreview'].map(name=>[name,()=>{calls.push(name);throw Error('no eager preview');}])));
 const noop=()=>{},hits={},options={authoringPreview,readOffsetSelection:noop,hits,clearPlacement:noop,cancelAnnotation:noop,cancelPngExport:noop,resetOffset:noop,
  hideInput:noop,updateToolbar:noop,updateConstraintButtons:noop,acceptTarget:noop};
 w.DrawingPreview={...original,create(ports){seen.push(ports);return original.create(ports);}};f.state.ready=false;f.events.length=0;
 let sessions;try{sessions=f.foundation.createOperationSessionsForAuthoring(options);}finally{w.DrawingPreview=original;f.state.ready=true;}
 assert.deepEqual(calls,[]);assert.deepEqual(f.events,[]);assert.equal(seen.length,1);
 for(const name of Object.keys(authoringPreview))assert.equal(seen[0][name],authoringPreview[name]);
 assert.equal(seen[0].readOffsetSelection,options.readOffsetSelection);assert.equal(seen[0].hits,hits);
 assert.ok(Object.isFrozen(sessions));assert.notEqual(sessions.pending,f.sessions.pending);assert.notEqual(sessions.targets,f.sessions.targets);assert.notEqual(sessions.pointer,f.sessions.pointer);
 const point={x:2,y:3};sessions.preview.setPointer(point);assert.equal(sessions.preview.pointer,point);assert.equal(sessions.pending.current,null);
});

test('authoring operation session binding retains original errors and never constructs later sessions after preview failure',()=>{
 const f=fixture(),w=f.w,previewOriginal=w.DrawingPreview,pendingOriginal=w.PendingCommandSession,marker=new Error('preview failed');let pendingBuilds=0;
 const noop=()=>{},ports={snapForDrawing:noop,linePreviewPoint:noop,readCenterline:noop,projectPointToCenterlineSupport:noop,computeTrimPreview:noop};
 const options={authoringPreview:ports,readOffsetSelection:noop,hits:{},clearPlacement:noop,cancelAnnotation:noop,cancelPngExport:noop,resetOffset:noop,
  hideInput:noop,updateToolbar:noop,updateConstraintButtons:noop,acceptTarget:noop};
 w.PendingCommandSession={create(){pendingBuilds++;return pendingOriginal.create(...arguments);}};f.events.length=0;
 try{
  w.DrawingPreview={create(){throw marker;}};assert.throws(()=>f.foundation.createOperationSessionsForAuthoring(options),error=>error===marker);
  w.DrawingPreview=previewOriginal;const lateFailure={...ports,get computeTrimPreview(){throw marker;}};
  assert.throws(()=>f.foundation.createOperationSessionsForAuthoring({...options,authoringPreview:lateFailure}),error=>error===marker);
 }finally{w.DrawingPreview=previewOriginal;w.PendingCommandSession=pendingOriginal;}
 assert.equal(pendingBuilds,0);assert.deepEqual(f.events,[]);assert.equal(f.state.scope.points[0],f.point);assert.equal(f.state.scope.points.length,1);
});