const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(build=(w,p)=>w.DeletionFeature.create(p)){
  const events=[],created={},state={ready:false,scope:{id:'first'},stable:false,drag:null,failure:null,result:Symbol('removed')},sandbox={window:{}};
  for(const name of ['GeometryDeletion','GeometryDeletionCommand','SelectionDeletionCommand'])sandbox.window[name]={create(ports){
    events.push(name);const owner={remove(...args){assert.equal(this,owner);events.push([name,args]);if(state.failure)throw state.failure;return state.result;}};
    created[name]={ports,owner};return owner;
  }};
  vm.runInNewContext(fs.readFileSync('src/application/deletion_feature.js','utf8'),sandbox);
  const never=()=>assert.fail('no eager query'),pointUsage={isPointUsedByLine:never,isPointUsedByCircle:never,isPointUsedByArc:never,isPointUsedBySpline:never},
    dimensions={remove(value){assert.equal(this,dimensions);events.push(['annotation',value]);}};
  const ports={pointUsage,annotationDimensions:dimensions,currentScope:()=>{assert.equal(state.ready,true);return state.scope;},
    geometryInstanceDependencyRefs:instance=>instance.refs,geometryRefKey:ref=>ref.key,
    applicationText:(_ja,en)=>en,setHint:(...args)=>events.push(['hint',...args]),log:message=>events.push(['log',message]),
    updateToolbar:()=>events.push('toolbar'),updateUI:()=>events.push('ui'),draw:()=>events.push('draw'),
    analysisStable:()=>{assert.equal(state.ready,true);return state.stable;},resetGeometryDrag:()=>state.drag.reset(),resetDimensionDrag:never,resetAnnotationDrag:never,
    canvasSelection:{},splineEditing:{},canvasHover:{},pendingCommandSession:{},constraintTargetSession:{},lineCommand:{},circularCommands:{},drawingPreview:{}};
  const feature=build(sandbox.window,ports);state.ready=true;return{feature,events,created,state,ports};
}
test('deletion feature constructs three owners and shares live queries without running interactions',()=>{
  const f=fixture();assert.deepEqual(f.events,['GeometryDeletion','GeometryDeletionCommand','SelectionDeletionCommand']);
  const geometry=f.created.GeometryDeletion,command=f.created.GeometryDeletionCommand,selection=f.created.SelectionDeletionCommand;
  for(const [key,value]of Object.entries(f.ports.pointUsage))assert.equal(geometry.ports[key],value);
  assert.equal(command.ports.geometryDeletion,geometry.owner);assert.equal(selection.ports.geometryDeletion,geometry.owner);
  assert.equal(command.ports.geometryInstanceUsesRemovedGeometry,selection.ports.geometryInstanceUsesRemovedGeometry);
  assert.equal(command.ports.rejectReferencedGeometryDeletion,f.feature.rejectReferences);assert.equal(selection.ports.rejectReferencedGeometryDeletion,f.feature.rejectReferences);
  f.state.scope={id:'replacement'};assert.equal(command.ports.currentScope(),f.state.scope);assert.equal(selection.ports.currentScope(),f.state.scope);
  const annotation={id:'A'};geometry.ports.removeAnnotationConstraint(annotation);assert.deepEqual(f.events.at(-1),['annotation',annotation]);
});
test('deletion forwarding keeps command receivers, results and original failures',()=>{
  const f=fixture(),options={points:[{}]};f.events.length=0;
  assert.equal(f.feature.remove(options),f.state.result);assert.equal(f.created.SelectionDeletionCommand.ports.deleteElements(options),f.state.result);
  assert.equal(f.feature.removeSelection(),f.state.result);
  assert.deepEqual(f.events,[['GeometryDeletionCommand',[options]],['GeometryDeletionCommand',[options]],['SelectionDeletionCommand',[]]]);
  const marker=new Error('remove failed');f.state.failure=marker;assert.throws(()=>f.feature.remove(options),error=>error===marker);assert.throws(()=>f.feature.removeSelection(),error=>error===marker);
});
test('removed dependency matching preserves reference keys and first path owners',()=>{
  const f=fixture(),uses=f.created.GeometryDeletionCommand.ports.geometryInstanceUsesRemovedGeometry;
  const instance={refs:[{key:'line:L1',path:['B1','L1']},{key:'point:P1',path:['P1']}]};
  assert.equal(uses(instance),false);assert.equal(uses(instance,new Set(['line:L1'])),true);assert.equal(uses(instance,new Set(),new Set(['B1'])),true);
  assert.equal(uses(instance,new Set(),new Set(['L1'])),false);assert.equal(uses({refs:[{key:'none'}]},new Set(['none'])),true);
});
test('rejection feedback, late resets and the two refresh sequences retain distinct ordering',()=>{
  const f=fixture();f.events.length=0;assert.equal(f.feature.rejectReferences([],'item'),false);assert.deepEqual(f.events,[]);
  assert.equal(f.feature.rejectReferences([{id:'I2'},{id:'I1'}],'item'),true);
  const message='Cannot delete item; it is referenced by derived instance(s) I2, I1. Delete the dependent instance(s) first.';
  assert.deepEqual(f.events,[['hint',message,'error'],['log',message]]);
  f.events.length=0;f.created.GeometryDeletionCommand.ports.refreshView();assert.deepEqual(f.events,['toolbar','ui','draw']);
  f.events.length=0;f.created.SelectionDeletionCommand.ports.refreshView();assert.deepEqual(f.events,['ui','draw']);
  f.state.drag={reset(){assert.equal(this,f.state.drag);f.events.push('reset');}};f.created.GeometryDeletionCommand.ports.resetGeometryDrag();assert.equal(f.events.at(-1),'reset');
  f.state.stable=true;assert.equal(f.created.GeometryDeletionCommand.ports.analysisStable(),true);
});

function createFromOwners(w,p,inspect=()=>{}) {
  w.GeometryObjects={geometryKeyForItem:p.geometryElementKey,geometryRefForItem:p.geometryRefForItem};
  w.GeometryRef={key:p.geometryRefKey};w.AnnotationAnchorData={referencesRemovedGeometry:p.annotationReferencesRemovedGeometry};
  const owners={documentWorkspace:{workspace:{current:p.currentScope},sketches:{elementSketchId:p.elementSketchId,activeSketchId:p.activeSketchId}},
    readServices:{reads:{geometryInstanceBundle:p.geometryInstanceBundle},projections:{blockAllProjectionBundle:p.blockAllProjectionBundle,invalidateBlockProjectionCache:p.invalidateBlockProjectionCache}},
    interaction:{selection:p.canvasSelection,hover:p.canvasHover,pointUsage:p.pointUsage,access:{guardSketchEdit:p.guardSketchEdit,guardSelectionEdit:p.guardSelectionEdit},
      scope:{selectionSketchId:p.selectionSketchId},lifecycle:{selectMode:p.selectMode}},
    references:Object.fromEntries(['constraintReferencesPoint','constraintReferencesLine','constraintReferencesPrimitive','constraintGraphNodes','geometryInstanceDependencyRefs'].map(key=>[key,p[key]])),
    geometry:{normalizeArcSweeps:p.normalizeArcSweeps},sessions:{pending:p.pendingCommandSession,targets:p.constraintTargetSession,preview:p.drawingPreview},
    solving:{solveSketchAndDependents:p.solveSketchAndDependents},analysis:{get stable(){return p.analysisStable();}},
    presentation:{settings:{applicationText:p.applicationText},updateUI:p.updateUI,draw:p.draw,setHint:p.setHint,log:p.log}};
  inspect(owners);
  return w.DeletionFeature.createForEditing({...owners,annotationDimensions:p.annotationDimensions,splineEditing:p.splineEditing,
    guardDimensionSymbolDeletion:p.guardDimensionSymbolDeletion,lineCommand:p.lineCommand,circularCommands:p.circularCommands,
    updateToolbar:p.updateToolbar,recordHistory:p.recordHistory,referenceImageInteraction:p.referenceImageInteraction,
    clearSelection:p.clearSelection,solveAndRefresh:p.solveAndRefresh,
    resetGeometryDrag:p.resetGeometryDrag,resetDimensionDrag:p.resetDimensionDrag,resetAnnotationDrag:p.resetAnnotationDrag});
}

test('editing deletion shares capabilities without reading scope, analysis or late drag actors during construction',()=>{
  let owners;const f=fixture((w,p)=>createFromOwners(w,p,o=>{owners=o;}));
  assert.deepEqual(f.events,['GeometryDeletion','GeometryDeletionCommand','SelectionDeletionCommand']);
  const g=f.created.GeometryDeletionCommand.ports,c=f.created.SelectionDeletionCommand.ports;
  for(const key of ['canvasSelection','canvasHover','splineEditing','pendingCommandSession','constraintTargetSession','lineCommand','circularCommands','drawingPreview',
    'resetGeometryDrag','resetDimensionDrag','resetAnnotationDrag'])assert.equal(g[key],f.ports[key],key);
  assert.equal(g.geometryDeletion,f.created.GeometryDeletion.owner);assert.equal(c.geometryDeletion,g.geometryDeletion);
  assert.equal(c.canvasSelection,owners.interaction.selection);assert.equal(g.canvasHover,owners.interaction.hover);
  f.state.scope={id:'next Workspace scope'};assert.equal(g.currentScope(),f.state.scope);assert.equal(c.currentScope(),f.state.scope);
  f.state.stable=true;assert.equal(g.analysisStable(),true);f.state.stable=false;assert.equal(g.analysisStable(),false);
  for(const key of ['resetGeometryDrag','resetDimensionDrag','resetAnnotationDrag'])assert.equal(g[key],f.ports[key]);
});

function operationFixture(composed) {
  const w={GeometrySolver:Object.fromEntries(['Point','Line','Circle','Arc','Spline'].map(key=>[key,class {}]))},sandbox={window:w};vm.createContext(sandbox);
  for(const file of ['src/editing/selection.js','src/editing/canvas_hover.js','src/editing/pending_command_session.js','src/editing/constraint_target_session.js',
    'src/editing/drawing_preview.js','src/editing/draw_operation_lifecycle.js','src/editing/geometry_deletion.js','src/commands/geometry_deletion_command.js',
    'src/commands/selection_deletion_command.js','src/application/deletion_feature.js'])vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
  const events=[],state={editable:true,symbols:true,solved:true,stable:true,fail:null},model=()=>Object.fromEntries(['points','lines','circles','arcs','splines','constraints','annotations','hatches','referenceImages','geometryInstances','blockInstances'].map(key=>[key,[]]));
  state.scope=model();const boundScope=model(),initial=state.scope,point={id:'P1',sketchId:'S1'},constraint={id:'C1',point,sketchId:'S1',annotationOwner:'A1'};
  const selection=w.CanvasSelection.create(),hover=w.CanvasHover.create({isEndpointPoint:()=>false}),pending=w.PendingCommandSession.create({clearPlacement:()=>assert.fail('must clear, not cancel')}),
    targets=w.ConstraintTargetSession.create({acceptTarget:()=>assert.fail('no new targets')}),preview=w.DrawingPreview.create({types:{},hits:{}}),lifecycle=w.DrawOperationLifecycle.createSession();
  const draft={type:'annotation'},operands=[point],pointer={x:1,y:2},trim={id:'trim'};pending.replace(draft);targets.begin('distance',operands);preview.setPointer(pointer);preview.setTrim(trim);lifecycle.setMode('line');
  const marker=new Error('operation failed'),reset=name=>({reset(){assert.equal(this,drags[name]);events.push(name);if(state.fail===name)throw marker;}}),drags={};
  const resetLate=name=>()=>drags[name].reset(),record=name=>()=>events.push(name),noUse=()=>false;
  const p={currentScope:()=>{events.push('scope');return state.scope;},pointUsage:{isPointUsedByLine:noUse,isPointUsedByCircle:noUse,isPointUsedByArc:noUse,isPointUsedBySpline:noUse},
    constraintReferencesPoint:(c,p)=>c.point===p,constraintReferencesLine:noUse,constraintReferencesPrimitive:noUse,
    geometryElementKey:item=>item.id,annotationReferencesRemovedGeometry:(a,ids)=>ids.has(a.anchorId),geometryInstanceBundle:noUse,blockAllProjectionBundle:noUse,
    constraintGraphNodes:c=>[c.point].filter(Boolean),annotationDimensions:{remove(c){assert.equal(this,p.annotationDimensions);events.push('annotationConstraint:'+c.id);}},
    canvasSelection:selection,splineEditing:{forgetDeleted(){assert.equal(this,p.splineEditing);events.push('spline');}},canvasHover:hover,
    guardSketchEdit:id=>{events.push('edit:'+id);return state.editable;},elementSketchId:item=>item.sketchId,
    geometryInstanceDependencyRefs:item=>item.refs||[],geometryRefKey:ref=>ref.id,guardDimensionSymbolDeletion:()=>{events.push('symbols');return state.symbols;},applicationText:(_ja,en)=>en,
    resetGeometryDrag:resetLate('geometry'),resetDimensionDrag:resetLate('dimension'),resetAnnotationDrag:resetLate('annotation'),
    pendingCommandSession:pending,constraintTargetSession:targets,lineCommand:{reset:record('line')},circularCommands:{resetCircle:record('circle'),resetArcs:record('arcs')},drawingPreview:preview,selectMode:lifecycle.selectMode,
    solveSketchAndDependents:id=>{events.push('solve:'+id);if(state.fail==='solve')throw marker;return{success:state.solved,result:{errorNorm:0}};},normalizeArcSweeps:record('normalize'),
    updateToolbar:record('toolbar'),updateUI:record('ui'),draw:record('draw'),analysisStable:()=>state.stable,setHint:(...args)=>events.push(['hint',...args]),log:record('log'),recordHistory:label=>events.push('history:'+label),
    referenceImageInteraction:{forget(items){assert.equal(this,p.referenceImageInteraction);events.push('forget:'+items.length);}},guardSelectionEdit:()=>{events.push('selectionGuard');return state.editable;},
    selectionSketchId:()=>null,activeSketchId:()=>state.scope.sketchId||'S1',geometryRefForItem:item=>item,invalidateBlockProjectionCache:record('cache'),effectiveSelectedConstraint:selection.effectiveSelectedConstraint,
    clearSelection:()=>{selection.clear();events.push('clear');},solveAndRefresh:(...args)=>events.push(['solveRefresh',...args])};
  const feature=composed?createFromOwners(w,p):w.DeletionFeature.create(p);assert.deepEqual(events,[]);
  // The drag actors do not exist until after composition, as in app.js.
  for(const name of ['geometry','dimension','annotation'])drags[name]=reset(name);
  const target=model();target.sketchId='S2';target.points.push(point);target.constraints.push(constraint);state.scope=target;
  selection.set('points',[point]);selection.set('dimensionConstraints',[constraint]);hover.update({dimension:constraint,point,annotation:{id:'hover'}});
  return{feature,state,events,p,selection,hover,pending,targets,preview,lifecycle,point,constraint,draft,operands,pointer,trim,marker,target,boundScope,initial};
}

test('editing deletion preserves real planning, same shared sessions and late resets, including unsuccessful solves',()=>{
  for(const composed of [false,true])for(const solved of [false,true]) {
    const f=operationFixture(composed);f.state.solved=solved;assert.equal(f.feature.remove({points:[f.point]}),true);
    assert.equal(f.target.points.length,0);assert.equal(f.target.constraints.length,0);assert.equal(f.selection.points.length,0);assert.equal(f.selection.dimensionConstraints.length,0);
    assert.equal(f.hover.current.dimension,null);assert.equal(f.hover.current.point,f.point);assert.equal(f.hover.current.annotation.id,'hover');
    assert.equal(f.pending.current,null);assert.equal(f.targets.command,null);assert.equal(f.targets.operands,f.operands);assert.equal(f.preview.pointer,null);assert.equal(f.preview.trim,f.trim);assert.equal(f.lifecycle.mode,'select');
    assert.deepEqual(f.events.slice(0,11),['edit:S1','scope','symbols','geometry','dimension','annotation','line','circle','arcs','annotationConstraint:C1','spline']);
    assert.deepEqual(f.events.slice(11,16),['solve:S1','normalize','toolbar','ui','draw']);assert.equal(f.events.at(-1),'history:削除');
    const hint=f.events.find(e=>Array.isArray(e)&&e[0]==='hint');assert.equal(hint[2],solved?'normal':'error');
    assert.equal(f.initial.points.length,0);assert.equal(f.boundScope.points.length,0);
  }
});

test('editing deletion preserves guard rejection, reset exceptions and partial mutation on solve exceptions',()=>{
  for(const composed of [false,true])for(const reason of ['permission','symbol','dimension','solve']) {
    const f=operationFixture(composed);if(reason==='permission')f.state.editable=false;if(reason==='symbol')f.state.symbols=false;
    if(['dimension','solve'].includes(reason))f.state.fail=reason;
    if(f.state.fail)assert.throws(()=>f.feature.remove({points:[f.point]}),error=>error===f.marker);else assert.equal(f.feature.remove({points:[f.point]}),false);
    assert.equal(f.target.points.includes(f.point),reason!=='solve');assert.equal(f.pending.current,reason==='solve'?null:f.draft);
    assert.equal(f.preview.pointer,reason==='solve'?null:f.pointer);assert.equal(f.preview.trim,f.trim);assert.equal(f.targets.operands,f.operands);
    assert.equal(f.lifecycle.mode,reason==='solve'?'select':'line');assert.equal(f.events.some(e=>typeof e==='string'&&e.startsWith('history:')),false);
    assert.equal(f.events.includes('toolbar'),false);if(reason==='permission')assert.deepEqual(f.events,['edit:S1']);
    if(reason==='dimension')assert.deepEqual(f.events,['edit:S1','scope','symbols','geometry','dimension']);
  }
});

test('editing mixed selection keeps image feedback order and earlier annotation removal when a later Block dependency rejects',()=>{
  for(const composed of [false,true])for(const dependent of [false,true]) {
    const f=operationFixture(composed);f.selection.clear();f.target.points=[];f.target.constraints=[];
    const annotation={id:'A'},image={id:'image'},block={id:'B'};f.target.annotations=[annotation];f.selection.set('annotations',[annotation]);
    if(dependent){f.target.blockInstances=[block];f.selection.set('blockInstances',[block]);f.target.geometryInstances=[{id:'I',refs:[{id:'other',path:['B']}]}];}
    else{f.target.referenceImages=[image];f.selection.set('referenceImages',[image]);}
    assert.equal(f.feature.removeSelection(),!dependent);assert.equal(f.target.annotations.length,0);assert.equal(f.selection.annotations.length,0);
    assert.equal(f.pending.current,f.draft);assert.equal(f.preview.pointer,f.pointer);assert.equal(f.lifecycle.mode,'line');
    if(dependent){assert.equal(f.target.blockInstances[0],block);assert.equal(f.events.includes('clear'),false);assert.equal(f.events.includes('ui'),false);assert.equal(f.events.at(-1),'log');}
    else{assert.equal(f.target.referenceImages.length,0);assert.deepEqual(f.events.slice(3,9),['forget:1','scope','clear','ui','draw','history:画像削除']);assert.equal(f.events.includes('toolbar'),false);}
  }
});
