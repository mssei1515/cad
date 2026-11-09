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
 const raw=w.CanvasCommandInputs;w.CanvasCommandInputs={...raw,createFeature(options){probe.ports=options;return raw.createFeature(options);}};
 const inputs=composed?s.createInputForEditing(source):s.createInputFeature({document:source.document,canvas:source.canvas,updateUI:source.updateUI,
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
 for(const composed of [false,true])for(const failAt of ['AnnotationCommandInput','InstanceCommandInput','drawingFactory','CanvasSelectionInteraction']){
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
