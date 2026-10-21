const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
  const events=[],created={},state={scope:{id:'first'},stable:false,drag:null,failure:null,result:Symbol('removed')},sandbox={window:{}};
  for(const name of ['GeometryDeletion','GeometryDeletionCommand','SelectionDeletionCommand'])sandbox.window[name]={create(ports){
    events.push(name);const owner={remove(...args){assert.equal(this,owner);events.push([name,args]);if(state.failure)throw state.failure;return state.result;}};
    created[name]={ports,owner};return owner;
  }};
  vm.runInNewContext(fs.readFileSync('src/application/deletion_feature.js','utf8'),sandbox);
  const never=()=>assert.fail('no eager query'),pointUsage={isPointUsedByLine:never,isPointUsedByCircle:never,isPointUsedByArc:never,isPointUsedBySpline:never},
    dimensions={remove(value){assert.equal(this,dimensions);events.push(['annotation',value]);}};
  const ports={pointUsage,annotationDimensions:dimensions,currentScope:()=>state.scope,
    geometryInstanceDependencyRefs:instance=>instance.refs,geometryRefKey:ref=>ref.key,
    applicationText:(_ja,en)=>en,setHint:(...args)=>events.push(['hint',...args]),log:message=>events.push(['log',message]),
    updateToolbar:()=>events.push('toolbar'),updateUI:()=>events.push('ui'),draw:()=>events.push('draw'),
    analysisStable:()=>state.stable,resetGeometryDrag:()=>state.drag.reset(),resetDimensionDrag:never,resetAnnotationDrag:never,
    canvasSelection:{},splineEditing:{},canvasHover:{},pendingCommandSession:{},constraintTargetSession:{},lineCommand:{},circularCommands:{},drawingPreview:{}};
  const feature=sandbox.window.DeletionFeature.create(ports);return{feature,events,created,state,ports};
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
