const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
  const events=[],created={},state={scope:null,block:null,blockReads:null,editable:true,failure:null,mode:'line',geometryNext:7,documentNext:11};
  const model=()=>Object.fromEntries(['points','lines','circles','arcs','splines','constraints','blockInstances','geometryInstances','annotations','hatches','referenceImages'].map(k=>[k,[]]).concat([['nextHatchIndex',3],['nextDimensionParameterIndex',4]]));
  state.scope=model();const payload={points:[{}],lines:[],circles:[],arcs:[],blockInstances:[],selection:{source:true},pasteCount:0};state.payload=payload;
  const sandbox={window:{}};vm.createContext(sandbox);
  for(const file of ['src/editing/clipboard_session.js','src/editing/clipboard_paste_checkpoint.js','src/commands/clipboard_command.js'])vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
  const owners={ClipboardTransfer:{detachedAnnotation:()=>{},copiedGeometryInstance:()=>{}},
    ClipboardPayload:{build(scope,selection,key){events.push(['build',scope,selection,key]);return{payload:state.payload,error:state.payloadError};},canOfferCopy(scope,selection){events.push(['offer',scope,selection]);return true;}},
    ClipboardGeometry:{},ClipboardGraph:{append(scope,input,target){events.push(['append',scope,input,target]);scope.points.push({pasted:true});state.geometryNext++;state.documentNext++;scope.nextHatchIndex++;scope.nextDimensionParameterIndex++;if(state.failure==='append')throw new Error('append failed');return{maps:{id:'maps'}};}}};
  for(const name of ['ClipboardTransfer','ClipboardPayload','ClipboardSession','ClipboardGeometry','ClipboardPasteCheckpoint','ClipboardGraph','ClipboardCommand']){
    const real=sandbox.window[name];sandbox.window[name]={create(ports){events.push(name);const owner=real?real.create(ports):owners[name];created[name]={ports,owner};return owner;}};
  }
  vm.runInContext(fs.readFileSync('src/application/clipboard_feature.js','utf8'),sandbox);
  const noop=()=>{},geometryIds={snapshot:()=>({point:state.geometryNext}),restore:value=>{events.push('geometryRestore');state.geometryNext=value.point;}},
    documentIds={allocate(type){assert.equal(this,documentIds);events.push(['allocate',type]);return type;},peek(type){assert.equal(this,documentIds);return type;},
      snapshot(keys){assert.equal(this,documentIds);events.push(['snapshot',Array.from(keys)]);return{annotation:state.documentNext};},restore:value=>{events.push('documentRestore');state.documentNext=value.annotation;}};
  const selection={applyClipboard(source,maps){assert.equal(this,selection);assert.equal(source,payload.selection);assert.equal(maps.id,'maps');events.push('selection');}},
    imageClipboard={markCopy(){assert.equal(this,imageClipboard);events.push('imageCopy');}};
  const ports={currentScope:()=>state.scope,canvasSelection:selection,blockScopeId:()=>state.blockReads?state.blockReads.shift():state.block,
    viewport:{scale:2},geometryIds,documentIds,imageClipboard,pasteOffsetScreenPx:24,parameters:{id:'parameters'},
    applicationText:noop,setHint:(...args)=>events.push(['hint',...args]),updateToolbar:()=>events.push('toolbar'),deleteSelection:()=>{events.push('delete');return false;},
    serializeConstraint:value=>{events.push('serialize');return{value};},decorateSerializedConstraint:(value,source)=>{events.push(['decorate',value,source]);return value;},
    invalidateProjection:()=>events.push('invalidate'),isGeometryMode:()=>true,blockDefinitionScopeError:()=>null,canCreateInActiveSketch:()=>state.editable,
    guardSketchEdit:(...args)=>events.push(['guard',...args]),activeSketchId:()=>state.scope.sketchId||'S1',currentParameterNamespace:()=>state.namespace,
    clearSelection:()=>events.push('clear'),selectMode:()=>{state.mode='select';events.push('select');},solveAndRefresh:label=>{events.push(['solve',label]);if(state.failure==='solve')throw new Error('solve failed');},
    updateUI:()=>events.push('ui'),draw:()=>events.push('draw'),sketchName:id=>id};
  const feature=sandbox.window.ClipboardFeature.create(ports);return{feature,state,ports,events,created,payload,model};
}
test('clipboard feature constructs seven owners without queries and shares their actual capabilities',()=>{
  const f=fixture();assert.deepEqual(f.events,['ClipboardTransfer','ClipboardPayload','ClipboardSession','ClipboardGeometry','ClipboardPasteCheckpoint','ClipboardGraph','ClipboardCommand']);
  assert.equal(f.feature.session,f.created.ClipboardSession.owner);assert.equal(f.feature.command,f.created.ClipboardCommand.owner);
  assert.equal(f.created.ClipboardGraph.ports.geometry,f.created.ClipboardGeometry.owner);assert.equal(f.created.ClipboardGraph.ports.transfer,f.created.ClipboardTransfer.owner);
  assert.equal(f.created.ClipboardCommand.ports.checkpoint,f.created.ClipboardPasteCheckpoint.owner);assert.equal(f.created.ClipboardPayload.ports.detachedAnnotation,f.created.ClipboardTransfer.owner.detachedAnnotation);
  f.ports.viewport.scale=5;assert.equal(f.created.ClipboardTransfer.ports.readViewportScale(),5);
  const constraint={id:'C'};f.events.length=0;f.created.ClipboardPayload.ports.serializeConstraint(constraint);
  assert.deepEqual(f.events,['serialize',['decorate',{value:constraint},constraint]]);
  assert.equal(f.created.ClipboardGeometry.ports.allocateGeometryInstanceId('sketchProjection'),'sketchProjection');assert.equal(f.created.ClipboardGeometry.ports.allocateGeometryInstanceId('mirror'),'mirror');assert.equal(f.created.ClipboardGeometry.ports.allocateGeometryInstanceId('other'),'pattern');
});
test('copy uses the live editing scope and namespace, keeps payload error feedback and retains rejected cuts',()=>{
  const f=fixture(),scope=f.model();f.state.scope=scope;f.state.block='B2';f.events.length=0;
  assert.equal(f.feature.canOfferCopy(),true);assert.deepEqual(f.events,[['offer',scope,f.ports.canvasSelection]]);
  f.events.length=0;f.state.payloadError='copy warning';assert.equal(f.feature.copyableSelectionPayload(),f.payload);
  assert.deepEqual(f.events,[['build',scope,f.ports.canvasSelection,'block:B2'],['hint','copy warning','error']]);
  f.state.payloadError=null;f.events.length=0;assert.equal(f.feature.command.copy({cut:true}),false);
  assert.equal(f.feature.session.payload,f.payload);assert.equal(f.payload.cut,true);assert.deepEqual(f.events.slice(1),['imageCopy','toolbar','delete']);
});
test('paste reads current target and parameter scope, keeps repeated block namespace reads and selects before solving',()=>{
  const f=fixture();f.feature.command.copy();const target=f.model();target.sketchId='S2';f.state.scope=target;f.state.blockReads=['first','second'];f.state.namespace={id:'namespace'};f.ports.viewport.scale=4;f.events.length=0;
  assert.equal(f.feature.command.paste(),true);const append=f.events.find(e=>Array.isArray(e)&&e[0]==='append');
  assert.equal(append[1],target);assert.equal(append[2],f.payload);assert.equal(append[3].dx,6);assert.equal(append[3].dy,6);assert.equal(append[3].sketchId,'S2');assert.equal(append[3].namespace,f.state.namespace);assert.equal(append[3].namespaceKey,'block:second');
  assert.deepEqual(f.events[0],['snapshot',['annotation','hatch','referenceImage','sketchProjection','mirror','pattern','free','blockInstance']]);
  assert.deepEqual(f.events.slice(2,6),['clear','selection','select',['solve','貼り付け']]);assert.equal(f.payload.pasteCount,1);assert.equal(f.state.mode,'select');
});
test('paste guards and failures preserve existing checkpoint boundaries, counts and recovery order',()=>{
  for(const failure of ['append','solve']){
    const f=fixture();f.feature.command.copy();f.state.editable=false;f.events.length=0;assert.equal(f.feature.command.paste(),false);assert.deepEqual(f.events,[['guard','S1','create']]);
    f.state.editable=true;f.state.failure=failure;f.events.length=0;assert.equal(f.feature.command.paste(),false);
    assert.equal(f.state.scope.points.length,0);assert.equal(f.state.geometryNext,7);assert.equal(f.state.documentNext,11);assert.equal(f.state.scope.nextHatchIndex,3);assert.equal(f.state.scope.nextDimensionParameterIndex,4);
    assert.equal(f.payload.pasteCount,failure==='solve'?1:0);assert.equal(f.state.mode,failure==='solve'?'select':'line');
    const restore=f.events.indexOf('geometryRestore');assert.deepEqual(f.events.slice(restore,restore+6),['geometryRestore','documentRestore','invalidate','clear','ui','draw']);
  }
});
