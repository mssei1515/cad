const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
  const events=[],created={},state={moving:false,dialog:false,panel:null,derived:null,png:null,pending:null,mode:'select',frame:{id:'frame'},fail:null,domReads:0};
  const document={getElementById(id){state.domReads++;return id==='propertiesPanel'?state.properties:id==='blockDefinitionsDialog'?{open:state.dialog}:null;}};state.properties={inert:false};
  const settings={language:'ja',localizeApplicationUI:()=>events.push('localize'),applicationText:(ja,en)=>settings.language==='en'?en:ja},profiler={active:false,work:(category,work)=>{events.push('profile:'+category);return work();}};
  const feedback={constraints:{id:'formatter'},log(message){assert.equal(this,feedback);events.push(['log',message]);return state.frame;},hint(...args){assert.equal(this,feedback);events.push(['hint',...args]);return state.frame;},solveResult(...args){assert.equal(this,feedback);events.push(['solve',...args]);}};
  const sandbox={window:{ApplicationSettings:{create(ports){events.push('settings');created.settings=ports;return settings;}},InteractionProfiler:{create(){events.push('profiler');return profiler;}},ApplicationFeedback:{create(ports){events.push('feedback');created.feedback=ports;return feedback;}}}};
  vm.createContext(sandbox);for(const file of ['src/application/application_refresh.js','src/ui/canvas_refresh.js','src/application/presentation_feature.js','src/ui/toolbar_view.js','src/editing/edit_history.js','src/editing/history_controller.js','src/editing/draw_operation_lifecycle.js','src/editing/pending_command_session.js','src/editing/constraint_target_session.js'])vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
  const storage=()=>assert.fail('no eager storage read by assembly'),version=()=>events.push('version'),duplicates=()=>assert.fail('no eager duplicate query');
  const feature=sandbox.window.PresentationFeature.create({document,storage,refreshVersion:version,readDuplicateCount:duplicates});
  const step=name=>()=>{events.push(name);if(state.fail===name)throw state.marker;};
  const ui={syncAnnotationResize:step('annotation'),prepareParameterNamespace:step('prepare'),refreshConstraintAnalysis:step('analysis'),updateDocumentName:step('name'),updateToolbar:step('toolbar'),renderSketch:step('sketch'),updateBlockUI:step('blocks'),renderProperties:step('properties'),readSketchMoving:()=>state.moving,updateStatusUI:step('status'),updateConstraintButtons:step('buttons'),syncDimensionInput:step('dimension'),refreshSketchSelection:step('selection')};
  const canvas={readPngCommand:()=>state.png,readPending:()=>state.pending,readMode:()=>state.mode,readCommandPanel:()=>state.panel,
    syncAnnotationInput:step('input'),readDerivedPanel:()=>state.derived,
    withGeometryReadCache(work){assert.equal(work,canvas.drawCanvas);events.push('cache');return work();},drawCanvas(){events.push('frame');return state.frame;}};
  return{feature,state,events,created,settings,profiler,feedback,storage,version,duplicates,ui,canvas,document,w:sandbox.window};
}
test('presentation creates settings, profiler and feedback in order and exposes actual shared owners before view binding',()=>{
  const f=fixture();assert.deepEqual(f.events,['settings','profiler','feedback']);assert.equal(f.state.domReads,0);
  assert.equal(f.feature.settings,f.settings);assert.equal(f.feature.profiler,f.profiler);assert.equal(f.feature.constraintFeedback,f.feedback.constraints);
  assert.equal(f.created.settings.storage,f.storage);assert.equal(f.created.settings.refreshVersion,f.version);
  assert.equal(f.created.feedback.settings,f.settings);assert.equal(f.created.feedback.interactionProfiler,f.profiler);assert.equal(f.created.feedback.readDuplicateCount,f.duplicates);
  f.events.length=0;const log=f.feature.log,hint=f.feature.setHint,solve=f.feature.setSolveResultHint;
  assert.equal(log('entry'),f.state.frame);assert.equal(hint('message'),f.state.frame);solve('label',1,2,3);
  assert.deepEqual(f.events,[['log','entry'],['hint','message','normal'],['solve','label',1,2,3]]);
});
test('full and selection refreshes retain their separate order, live view state and failure boundaries',()=>{
  const f=fixture();f.events.length=0;f.feature.bindUI(f.ui);assert.deepEqual(f.events,[]);assert.equal(f.state.domReads,0);
  const refresh=f.feature.updateUI;refresh({refreshAnalysis:false});
  assert.deepEqual(f.events,['annotation','prepare','name','toolbar','sketch','blocks','properties','status','buttons','localize','dimension']);
  f.events.length=0;f.state.moving=true;f.state.dialog=true;f.feature.updateGeometrySelectionUI();
  assert.deepEqual(f.events,['annotation','toolbar','buttons','blocks','selection','properties']);
  f.events.length=0;refresh();assert.equal(f.state.properties.inert,true);assert.ok(f.events.includes('analysis'));
  f.events.length=0;f.state.fail='properties';f.state.marker=new Error('view failed');
  assert.throws(()=>refresh(),error=>error===f.state.marker);
  assert.deepEqual(f.events,['annotation','prepare','analysis','name','toolbar','sketch','blocks','properties']);
});
test('canvas refresh keeps PNG cancellation, live panels, selection identity and cached draw result',()=>{
  const f=fixture();f.events.length=0;f.feature.bindCanvas(f.canvas);assert.deepEqual(f.events,[]);assert.equal(f.feature.selectedItem,null);
  const item={id:'target'};f.state.panel={update(){assert.equal(this,f.state.panel);f.events.push('panel');}};
  f.state.derived={selectedItem(){assert.equal(this,f.state.derived);f.events.push('derived');return item;}};
  f.state.png={active:true,busy:false,cancel(){assert.equal(this,f.state.png);f.events.push('cancel');this.active=false;}};
  const draw=f.feature.draw;assert.equal(draw(),f.state.frame);assert.equal(f.feature.selectedItem,item);
  assert.deepEqual(f.events,['cancel','panel','input','derived','cache','frame']);
  f.events.length=0;f.state.fail='input';f.state.marker=new Error('input sync failed');assert.throws(()=>draw(),error=>error===f.state.marker);
  assert.deepEqual(f.events,['panel','input']);assert.equal(f.feature.selectedItem,item);
});
test('settings callbacks dispatch into bound views and profiling still uses the supplied owners',()=>{
  const f=fixture();f.feature.bindUI(f.ui);f.feature.bindCanvas(f.canvas);f.events.length=0;f.profiler.active=true;
  f.created.settings.refreshViews({refreshAnalysis:false});assert.equal(f.events.includes('analysis'),false);assert.equal(f.events[0],'profile:ui');
  assert.ok(f.events.includes('profile:tree'));assert.ok(f.events.includes('profile:properties'));
  f.events.length=0;assert.equal(f.created.settings.redrawCanvas(),f.state.frame);assert.deepEqual(f.events,['input','profile:draw','cache','frame']);
  f.events.length=0;f.feature.updatePropertiesUI();f.feature.updateSketchUI();assert.deepEqual(f.events,['profile:properties','properties','profile:tree','sketch']);
  f.created.settings.refreshVersion();assert.equal(f.events.at(-1),'version');
});

function toolbarPresentationFixture() {
  const f=fixture(), w=f.w, nodes=new Map(); f.events.length=0;
  function node() { const classes=new Set(), attributes={}; return { disabled:null, textContent:'', classes, attributes,
    classList:{toggle(name,value){if(value)classes.add(name);else classes.delete(name);}}, setAttribute(name,value){attributes[name]=value;} }; }
  for(const id of ['undoBtn','redoBtn','toolLine','toolSelect','annotationTextBtn','selectionVisibilityBtn','statusCommand'])nodes.set(id,node());
  f.document.getElementById=id=>{f.events.push('dom:'+id);return nodes.get(id)||null;};
  const state={snapshot:0,block:null,spline:false,historyFailure:false,statusFailure:false,cursor:null,geometry:true};
  const marker=new Error('history presentation failure');
  function history(){return w.EditHistory.create({capture:()=>state.snapshot,signature:value=>value,restore:value=>{state.snapshot=value;return true;},limit:10});}
  const documentHistory=history(), blockHistory=history(); let toolbar;
  const controller=w.HistoryController.create({documentHistory,currentBlockHistory:()=>state.block,changed:()=>toolbar.updateHistory(),log:()=>{}});
  const lifecycle=w.DrawOperationLifecycle.createSession(), pending=w.PendingCommandSession.create({}), constraints=w.ConstraintTargetSession.create({});
  const constructionCommand={state(geometryMode){assert.equal(this,constructionCommand);f.events.push(['construction',geometryMode]);return{active:false};}};
  toolbar=f.feature.createToolbar({lifecycle,pending,constraints,constructionCommand,isGeometryMode:()=>state.geometry,
    readSplineEditing:()=>{f.events.push('spline');return state.spline;},
    readHistory:()=>{f.events.push('history');if(state.historyFailure)throw marker;return controller.active();},
    updateDocumentStatus:()=>{f.events.push('name');if(state.statusFailure)throw marker;}});
  assert.deepEqual(f.events,[]);
  const controls=toolbar.createControls({selectedVisibilityTargets:()=>{f.events.push('visibility');return[];},selectionVisibilityIsHidden:()=>false,canEditTarget:()=>true,
    syncFlyouts:()=>{f.events.push('flyouts');if(state.onFlyouts)state.onFlyouts();},updateCursor:value=>{f.events.push('cursor');state.cursor=value;}});
  assert.deepEqual(f.events,[]);
  return{...f,state,nodes,toolbar,controls,controller,documentHistory,blockHistory,lifecycle,pending,constraints,marker,node};
}

test('toolbar composition follows real mode/pending/constraint owners, shared language and fresh state after flyout sync',()=>{
  const f=toolbarPresentationFixture(); f.controller.resetDocument(); f.events.length=0;
  f.lifecycle.setMode('line'); f.pending.replace({type:'annotation-text-place',annotationDraft:{}}); f.constraints.begin('horizontal',[]);
  f.controls.view.update(); f.controls.status.update();
  assert.equal(f.nodes.get('toolLine').classes.has('active'),true); assert.equal(f.nodes.get('annotationTextBtn').attributes['aria-pressed'],'true');
  assert.equal(f.nodes.get('statusCommand').textContent,'注記');
  assert.ok(f.events.indexOf('history')<f.events.indexOf('name')); assert.ok(f.events.indexOf('name')<f.events.indexOf('visibility'));
  f.pending.replace(null); f.settings.language='en'; f.controls.status.update(); assert.equal(f.nodes.get('statusCommand').textContent,'Constraint');
  f.constraints.reset(); f.controls.status.update(); assert.equal(f.nodes.get('statusCommand').textContent,'Line');
  f.state.onFlyouts=()=>{f.lifecycle.setMode('spline');f.pending.replace({type:'distance-value'});f.state.spline=true;};
  f.controls.view.update(); assert.equal(f.nodes.get('toolLine').classes.has('active'),true);
  assert.equal(f.state.cursor.mode,'spline'); assert.equal(f.state.cursor.pendingType,'distance-value'); assert.equal(f.state.cursor.splineEditing,true);
});

test('history presentation uses active Document/Block stacks and replacement DOM, preserving lookup and failure boundaries',()=>{
  const f=toolbarPresentationFixture(); f.controller.resetDocument();
  assert.equal(f.nodes.get('undoBtn').disabled,true); assert.equal(f.nodes.get('redoBtn').disabled,true);
  f.state.snapshot=1; f.controller.record(); assert.equal(f.nodes.get('undoBtn').disabled,false);
  f.documentHistory.undo(); f.toolbar.updateHistory(); assert.equal(f.nodes.get('undoBtn').disabled,true); assert.equal(f.nodes.get('redoBtn').disabled,false);
  f.state.block=f.blockHistory; f.controller.resetBlock(); f.state.snapshot=2; f.controller.record();
  assert.equal(f.nodes.get('undoBtn').disabled,false); assert.equal(f.nodes.get('redoBtn').disabled,true);
  f.nodes.set('undoBtn',f.node()); f.nodes.delete('redoBtn'); f.events.length=0; f.toolbar.updateHistory();
  assert.equal(f.nodes.get('undoBtn').disabled,false); assert.deepEqual(f.events,['dom:undoBtn','dom:redoBtn','history','name']);
  f.nodes.get('undoBtn').disabled='unchanged'; f.state.historyFailure=true; f.events.length=0;
  assert.throws(()=>f.toolbar.updateHistory(),error=>error===f.marker);
  assert.equal(f.nodes.get('undoBtn').disabled,'unchanged'); assert.deepEqual(f.events,['dom:undoBtn','dom:redoBtn','history']);
  f.state.historyFailure=false; f.state.statusFailure=true; f.events.length=0;
  assert.throws(()=>f.controls.view.update(),error=>error===f.marker);
  assert.equal(f.nodes.get('undoBtn').disabled,false); assert.equal(f.events.at(-1),'name'); assert.equal(f.events.includes('visibility'),false); assert.equal(f.events.includes('flyouts'),false);
});
