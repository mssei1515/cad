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
 return {w,foundation,sessions,presentation,state,events,point};
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
