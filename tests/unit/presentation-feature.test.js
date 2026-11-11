const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('presentation toolbar callbacks stay cold until their component is published',()=>{
  const f=fixture(), {updateToolbar,updateStatusUI,updateHistoryButtons}=f.feature;
  const early=(callback,binding)=>assert.throws(callback,error=>error.name==='ReferenceError'&&error.message===`Cannot access '${binding}' before initialization`);
  early(updateToolbar,'toolbarView');early(updateStatusUI,'commandStatusView');early(updateHistoryButtons,'toolbarPresentation');
  const toolbar=f.feature.createToolbar({readHistory:()=>({undoCount:0,redoCount:0}),updateDocumentStatus:()=>{}});
  early(updateToolbar,'toolbarView');early(updateStatusUI,'commandStatusView');
  assert.equal(updateHistoryButtons(),toolbar.updateHistory());
  assert.equal(updateToolbar,f.feature.updateToolbar);assert.equal(updateStatusUI,f.feature.updateStatusUI);
});

test('presentation dispatches to actual toolbar components with original receivers, arguments, returns and errors',()=>{
  const f=fixture(),calls=[],result={},marker=new Error('update failed');let failure=null;
  const history={update(...args){calls.push(['history',this,args]);if(failure==='history')throw marker;return result;}};
  const view={update(...args){calls.push(['view',this,args]);if(failure==='view')throw marker;return result;}};
  const status={update(...args){calls.push(['status',this,args]);if(failure==='status')throw marker;return result;}};
  f.w.ToolbarView={createHistory:()=>history,create:()=>view,createCommandStatus:()=>status};
  const toolbar=f.feature.createToolbar({lifecycle:{readMode:()=> 'select'}}),controls=toolbar.createControls({});
  assert.equal(controls.view,view);assert.equal(controls.status,status);assert.ok(Object.isFrozen(controls));
  const {updateToolbar,updateStatusUI,updateHistoryButtons}=f.feature;
  assert.equal(updateToolbar('ignored'),undefined);assert.equal(updateStatusUI('ignored'),result);assert.equal(updateHistoryButtons('ignored'),result);
  assert.deepEqual(calls,[['view',view,[]],['status',status,[]],['history',toolbar,[]]]);
  for(const [name,callback] of [['view',updateToolbar],['status',updateStatusUI],['history',updateHistoryButtons]]){
    failure=name;assert.throws(callback,error=>error===marker);
  }
});

test('failed toolbar or controls construction preserves the last completed components',()=>{
  const f=fixture(),calls=[],marker=new Error('construction failed');let fail=null,generation=0;
  f.w.ToolbarView={createHistory(){if(fail==='history')throw marker;const id=++generation;return{update(){calls.push(['history',id]);return id;}};},
    create(){const id=generation;return{update(){calls.push(['view',id]);}};},
    createCommandStatus(){if(fail==='status')throw marker;const id=generation;return{update(){calls.push(['status',id]);return id;}};}};
  const options={lifecycle:{readMode:()=> 'select'}},first=f.feature.createToolbar(options),original=first.createControls({});
  fail='status';assert.throws(()=>first.createControls({}),error=>error===marker);
  f.feature.updateToolbar();assert.equal(f.feature.updateStatusUI(),1);
  fail='history';assert.throws(()=>f.feature.createToolbar(options),error=>error===marker);
  assert.equal(f.feature.updateHistoryButtons(),1);f.feature.updateToolbar();
  fail=null;const second=f.feature.createToolbar(options);assert.notEqual(first,second);
  assert.throws(()=>f.feature.updateToolbar(),error=>error.name==='ReferenceError');
  const next=second.createControls({});assert.notEqual(next,original);f.feature.updateToolbar();assert.equal(f.feature.updateStatusUI(),2);
  original.view.update();assert.equal(f.feature.updateHistoryButtons(),2);
  assert.deepEqual(calls,[['view',1],['status',1],['history',1],['view',1],['view',2],['status',2],['view',1],['history',2]]);
});

test('presentation-owned toolbar updates retain real history, pending state and display behavior',()=>{
  function run(owned){
    const f=toolbarPresentationFixture(),toolbar=owned?f.feature.updateToolbar:()=>f.controls.view.update(),
      status=owned?f.feature.updateStatusUI:()=>f.controls.status.update(),history=owned?f.feature.updateHistoryButtons:()=>f.toolbar.updateHistory();
    f.events.length=0;f.state.snapshot=1;f.documentHistory.record();history();toolbar();status();
    f.lifecycle.setMode('line');assert.equal(f.lifecycle.mode,'line');toolbar();status();
    const nodes=[...f.nodes].map(([id,node])=>[id,node.disabled,node.textContent,[...node.classes],node.attributes]);
    f.state.historyFailure=true;assert.throws(history,error=>error===f.marker);
    return{events:f.events,nodes};
  }
  assert.deepEqual(run(true),run(false));
});
function fixture(configureOptions){
  const events=[],created={},state={moving:false,dialog:false,panel:null,derived:null,png:null,pending:null,mode:'select',frame:{id:'frame'},fail:null,domReads:0};
  const document={getElementById(id){state.domReads++;return id==='propertiesPanel'?state.properties:id==='blockDefinitionsDialog'?{open:state.dialog}:null;}};state.properties={inert:false};
  const settings={language:'ja',localizeApplicationUI:()=>events.push('localize'),applicationText:(ja,en)=>settings.language==='en'?en:ja},profiler={active:false,work:(category,work)=>{events.push('profile:'+category);return work();}};
  const feedback={constraints:{id:'formatter'},log(message){assert.equal(this,feedback);events.push(['log',message]);return state.frame;},hint(...args){assert.equal(this,feedback);events.push(['hint',...args]);return state.frame;},solveResult(...args){assert.equal(this,feedback);events.push(['solve',...args]);}};
  const sandbox={window:{ApplicationSettings:{create(ports){events.push('settings');created.settings=ports;return settings;}},InteractionProfiler:{create(){events.push('profiler');return profiler;}},ApplicationFeedback:{create(ports){events.push('feedback');created.feedback=ports;return feedback;}}}};
  vm.createContext(sandbox);for(const file of ['src/application/application_refresh.js','src/ui/canvas_refresh.js','src/application/presentation_feature.js','src/ui/toolbar_view.js','src/ui/command_cursor.js','src/editing/edit_history.js','src/editing/history_controller.js','src/editing/draw_operation_lifecycle.js','src/editing/pending_command_session.js','src/editing/constraint_target_session.js'])vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
  const storage=()=>assert.fail('no eager storage read by assembly'),version=()=>events.push('version'),duplicates=()=>assert.fail('no eager duplicate query');
  const options={document,storage,refreshVersion:version,readDuplicateCount:duplicates};
  if(configureOptions)configureOptions(options);
  const feature=sandbox.window.PresentationFeature.create(options);
  const step=name=>()=>{events.push(name);if(state.fail===name)throw state.marker;};
  const ui={syncAnnotationResize:step('annotation'),prepareParameterNamespace:step('prepare'),refreshConstraintAnalysis:step('analysis'),updateDocumentName:step('name'),updateToolbar:step('toolbar'),renderSketch:step('sketch'),updateBlockUI:step('blocks'),renderProperties:step('properties'),readSketchMoving:()=>state.moving,updateStatusUI:step('status'),updateConstraintButtons:step('buttons'),syncDimensionInput:step('dimension'),refreshSketchSelection:step('selection')};
  const canvas={readPngCommand:()=>state.png,readPending:()=>state.pending,readMode:()=>state.mode,readCommandPanel:()=>state.panel,
    syncAnnotationInput:step('input'),readDerivedPanel:()=>state.derived,
    withGeometryReadCache(work){assert.equal(work,canvas.drawCanvas);events.push('cache');return work();},drawCanvas(){events.push('frame');return state.frame;}};
  return{feature,state,events,created,settings,profiler,feedback,storage,version,duplicates,ui,canvas,document,w:sandbox.window};
}
test('presentation builds authoring feedback on request from the same live settings and returns the actual formatter record',()=>{
  const f=fixture(),calls=[];
  assert.equal(f.w.AuthoringFeedback,undefined);
  const text=f.settings.applicationText;
  f.settings.applicationText=function(ja,en){'use strict';assert.equal(this,undefined);calls.push(Array.from(arguments));return text(ja,en);};
  vm.runInNewContext(fs.readFileSync('src/ui/authoring_feedback.js','utf8'),{window:f.w});
  const native=f.w.AuthoringFeedback;let options,actual;
  f.w.AuthoringFeedback=Object.freeze({create:function(input){assert.equal(this,f.w.AuthoringFeedback);assert.equal(arguments.length,1);
    options=input;actual=native.create(input);return actual;}});
  const api=f.feature.createAuthoringFeedback();assert.equal(api,actual);
  assert.deepEqual(Object.keys(options),['applicationText']);assert.equal(options.applicationText,f.settings.applicationText);
  assert.equal(Object.isFrozen(api),true);assert.ok(Object.values(Object.getOwnPropertyDescriptors(api)).every(d=>Object.hasOwn(d,'value')&&!d.writable&&!d.configurable));
  assert.deepEqual(calls,[]);assert.equal(f.state.domReads,0);assert.deepEqual(f.events,['settings','profiler','feedback']);
  assert.equal(api.geometryInstanceTypeLabel('mirror'),'ミラー');f.settings.language='en';
  assert.equal(api.geometryInstanceTypeLabel('mirror'),'Mirror');assert.equal(api.hatchPatternTypeLabel('solid'),'Solid fill');
  const result=Object.freeze({code:'invalid-distance'});
  assert.equal(api.offsetChainErrorText(result),'The offset distance is invalid');
  assert.equal(api.hatchRegionErrorText({code:'unknown',reason:'Original reason'}),'Original reason');
  assert.ok(calls.every(args=>args.length===2));assert.equal(result.code,'invalid-distance');
});

test('presentation authoring feedback preserves late factory lookup, independent settings and original construction or formatting failures',()=>{
  const f=fixture(),other=fixture(),failure=new Error('authoring feedback failed');
  assert.throws(()=>f.feature.createAuthoringFeedback(),error=>error.name==='TypeError');
  f.w.AuthoringFeedback={create(){throw failure;}};
  assert.throws(()=>f.feature.createAuthoringFeedback(),error=>error===failure);
  for(const current of [f,other])vm.runInNewContext(fs.readFileSync('src/ui/authoring_feedback.js','utf8'),{window:current.w});
  let fail=false;const text=f.settings.applicationText;
  f.settings.applicationText=function(ja,en){'use strict';assert.equal(this,undefined);if(fail)throw failure;return text(ja,en);};
  const first=f.feature.createAuthoringFeedback(),second=f.feature.createAuthoringFeedback(),independent=other.feature.createAuthoringFeedback();
  assert.notEqual(first,second);f.settings.language='en';assert.equal(first.geometryInstanceTypeLabel('mirror'),'Mirror');
  assert.equal(second.geometryInstanceTypeLabel('mirror'),'Mirror');assert.equal(independent.geometryInstanceTypeLabel('mirror'),'ミラー');
  fail=true;assert.doesNotThrow(()=>f.feature.createAuthoringFeedback());
  assert.throws(()=>first.hatchRegionErrorText(null),error=>error===failure);
});

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

function toolbarPresentationFixture(buildControls = (toolbar, options) => toolbar.createControls(options)) {
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
  const controls=buildControls(toolbar, {selectedVisibilityTargets:()=>{f.events.push('visibility');return[];},selectionVisibilityIsHidden:()=>false,canEditTarget:()=>true,
    syncFlyouts:()=>{f.events.push('flyouts');if(state.onFlyouts)state.onFlyouts();},updateCursor:value=>{f.events.push('cursor');state.cursor=value;}}, { f, state, nodes, node });
  assert.deepEqual(f.events,[]);
  return{...f,state,nodes,toolbar,controls,controller,documentHistory,blockHistory,lifecycle,pending,constraints,constructionCommand,marker,node};
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

function navigationFixture(failure = null) {
  const f = fixture(), events = [], browserWindow = { marker: "browser" };
  const marker = new Error("navigation failure"), syncResult = {};
  const menus = { close() { events.push("close"); }, start() { events.push("menu start"); if (failure === "menu") throw marker; } };
  let menuPorts, flyoutPorts, controls, button = null;
  f.document.getElementById = id => { events.push(["lookup", id]); return button; };
  f.w.ApplicationMenus = { create(ports) { events.push("menu create"); menuPorts = ports; return menus; } };
  f.w.ToolFlyouts = { create(ports) {
    events.push("flyout create"); flyoutPorts = ports;
    return { start() { events.push("flyout start"); if (failure === "flyout") throw marker; }, sync() { events.push("sync"); return syncResult; } };
  } };
  f.w.ToolbarView = {
    createHistory: () => ({ update() {} }),
    create: ports => { controls = ports; return {}; },
    createCommandStatus: () => ({}),
  };
  const toolbar = f.feature.createToolbar({ lifecycle: { readMode: () => "select" }, pending: {}, constraints: {} }); toolbar.createControls({});
  return { ...f, events, browserWindow, menus, marker, syncResult,
    get menuPorts() { return menuPorts; }, get flyoutPorts() { return flyoutPorts; },
    get controls() { return controls; }, setButton(value) { button = value; } };
}

test("presentation creates menus before starting flyouts and synchronizes the same owner after late binding", () => {
  const f = navigationFixture();
  assert.equal(f.controls.syncFlyouts(), undefined); assert.deepEqual(f.events, []);
  const navigation = f.feature.createToolNavigation({ window: f.browserWindow });
  assert.deepEqual(f.events.splice(0), ["menu create"]);
  assert.equal(navigation.close, f.menus.close); assert.equal(f.menuPorts.document, f.document); assert.equal(f.menuPorts.window, f.browserWindow);
  navigation.start();
  assert.deepEqual(f.events.splice(0), ["menu start", "flyout create", "flyout start"]);
  assert.equal(f.flyoutPorts.document, f.document); assert.equal(f.flyoutPorts.window, f.browserWindow);
  assert.equal(f.flyoutPorts.onOpen, navigation.close); f.flyoutPorts.onOpen();
  assert.equal(f.controls.syncFlyouts(), f.syncResult); assert.deepEqual(f.events.splice(0), ["close", "sync"]);
  f.menuPorts.activateTool("toolLine");
  const button = { click() { assert.equal(this, button); f.events.push("click"); } }; f.setButton(button);
  f.menuPorts.activateTool("toolLine"); assert.deepEqual(f.events, [["lookup", "toolLine"], ["lookup", "toolLine"], "click"]);
});

for (const failure of ["menu", "flyout"]) {
  test("presentation preserves the navigation start failure boundary at " + failure, () => {
    const f = navigationFixture(failure), navigation = f.feature.createToolNavigation({ window: f.browserWindow });
    f.events.length = 0;
    assert.throws(() => navigation.start(), error => error === f.marker);
    assert.deepEqual(f.events.splice(0), failure === "menu" ? ["menu start"] : ["menu start", "flyout create", "flyout start"]);
    assert.equal(f.controls.syncFlyouts(), failure === "menu" ? undefined : f.syncResult);
  });
}

test("presentation connects the actual late command panels to canvas refresh and input without reading them during binding", () => {
  const f = fixture(), host = {}, selected = {}, bundle = Object.freeze({
    commandPanel: { update() { assert.equal(this, bundle.commandPanel); f.events.push("panel update"); } },
    derivedPanel: { selectedItem() { assert.equal(this, bundle.derivedPanel); f.events.push("panel selection"); return selected; } },
  });
  const canvasPorts = { ...f.canvas }; delete canvasPorts.readCommandPanel; delete canvasPorts.readDerivedPanel;
  f.events.length = 0; f.feature.bindCanvas(canvasPorts);
  assert.equal(f.feature.readCommandPanel(), null); assert.equal(f.state.domReads, 0); assert.deepEqual(f.events, []);
  assert.equal(f.feature.draw(), f.state.frame); assert.equal(f.feature.selectedItem, null);
  assert.deepEqual(f.events.splice(0), ["input", "cache", "frame"]);
  f.w.CommandPanel = { createFeature(ports) {
    assert.equal(ports.document, f.document); assert.equal(ports.host, host); assert.equal(ports.readMode, f.canvas.readMode);
    assert.equal(f.feature.readCommandPanel(), null); f.events.push("panel create"); return bundle;
  } };
  assert.equal(f.feature.createCommandPanels({ host, readMode: f.canvas.readMode }), bundle);
  assert.equal(f.feature.readCommandPanel(), bundle.commandPanel); assert.equal(f.feature.selectedItem, null);
  assert.deepEqual(f.events.splice(0), ["panel create"]);
  assert.equal(f.feature.draw(), f.state.frame); assert.equal(f.feature.selectedItem, selected);
  assert.deepEqual(f.events, ["panel update", "input", "panel selection", "cache", "frame"]);
});

test("presentation only publishes completed panel construction and preserves its previous owner on failure", () => {
  const f = fixture(), marker = new Error("panel creation failed");
  const canvasPorts = { ...f.canvas }; delete canvasPorts.readCommandPanel; delete canvasPorts.readDerivedPanel;
  f.feature.bindCanvas(canvasPorts); f.events.length = 0;
  f.w.CommandPanel = { createFeature() { assert.equal(f.feature.readCommandPanel(), null); f.feature.draw(); throw marker; } };
  assert.throws(() => f.feature.createCommandPanels({}), error => error === marker);
  assert.equal(f.feature.readCommandPanel(), null); assert.equal(f.feature.selectedItem, null);
  assert.deepEqual(f.events.splice(0), ["input", "cache", "frame"]);
  const selected = {}, bundle = { commandPanel: { update() { f.events.push("previous panel"); } }, derivedPanel: { selectedItem: () => selected } };
  f.w.CommandPanel.createFeature = () => bundle;
  f.feature.createCommandPanels({});
  f.w.CommandPanel.createFeature = () => { assert.equal(f.feature.readCommandPanel(), bundle.commandPanel); throw marker; };
  assert.throws(() => f.feature.createCommandPanels({}), error => error === marker);
  assert.equal(f.feature.readCommandPanel(), bundle.commandPanel); f.feature.draw();
  assert.equal(f.feature.selectedItem, selected);
  assert.deepEqual(f.events, ["previous panel", "input", "cache", "frame"]);
});

function toolbarInputFixture() {
  const f = toolbarPresentationFixture();
  for (const id of ['toolPoint', 'toolCircle', 'toolArc', 'toolConstructionLine', 'toolFillet', 'toolHatch', 'deleteSelectionBtn']) f.nodes.set(id, f.node());
  for (const node of f.nodes.values()) {
    node.listeners = new Set();
    node.addEventListener = (type, handler) => { assert.equal(type, 'click'); node.listeners.add(handler); };
    node.removeEventListener = (type, handler) => { assert.equal(type, 'click'); node.listeners.delete(handler); };
    node.click = () => { for (const handler of node.listeners) handler.call(node); };
  }
  f.feature.bindUI(f.ui); f.feature.bindCanvas(f.canvas); f.controller.resetDocument();
  const reset = () => {}, resettable = { reset };
  f.lifecycle.bind({ line: resettable, rectangle: resettable, fillet: resettable,
    circular: { resetCircle: reset, resetArcs: reset }, preview: { setPointer: reset },
    clearSnap: reset, cancelConstraintTargetCommand: reset, updateToolbar: f.controls.view.update, setHint: reset, draw: f.feature.draw });
  f.events.length = 0;
  return f;
}

test('toolbar input assembly shares displayed lifecycle and construction while retaining separate binding phases and native handlers', () => {
  const f = toolbarInputFixture(), calls = [];
  function undo() { assert.equal(this, f.nodes.get('undoBtn')); calls.push('undo'); }
  const annotation = { start() { assert.equal(this, annotation); calls.push('annotation'); } };
  const editing = f.toolbar.createEditingBinding({ undo, redo() {}, toggleVisibility() {}, deleteSelection: () => false, annotation });
  f.constructionCommand.toggle = function () { assert.equal(this, f.nodes.get('toolConstructionLine')); calls.push('construction'); };
  const drawing = f.toolbar.createDrawingBinding({ filletCommand: { begin() { assert.equal(this, f.nodes.get('toolFillet')); calls.push('fillet'); } },
    startHatchCreation: () => calls.push('hatch') });
  assert.deepEqual(f.events, []); assert.equal([...f.nodes.values()].some(node => node.listeners.size), false);
  editing.bind(); editing.bind();
  assert.equal(f.nodes.get('toolLine').listeners.size, 0); assert.equal(f.nodes.get('undoBtn').listeners.size, 1);
  f.nodes.get('undoBtn').click(); f.nodes.get('annotationTextBtn').click();
  assert.deepEqual(calls.splice(0), ['undo', 'annotation']); assert.equal([...f.nodes.get('undoBtn').listeners][0], undo);
  drawing.bind(); drawing.bind(); f.nodes.get('toolLine').click();
  assert.equal(f.lifecycle.mode, 'line'); assert.equal(f.nodes.get('toolLine').attributes['aria-pressed'], 'true');
  assert.ok(f.events.includes('frame'));
  f.nodes.get('toolConstructionLine').click(); f.nodes.get('toolFillet').click(); f.nodes.get('toolHatch').click();
  assert.deepEqual(calls.splice(0), ['construction', 'fillet', 'hatch']);
  editing.dispose(); assert.equal(f.nodes.get('undoBtn').listeners.size, 0); assert.equal(f.nodes.get('toolLine').listeners.size, 1);
  f.nodes.get('toolCircle').click(); assert.equal(f.lifecycle.mode, 'circle');
  drawing.dispose(); drawing.dispose(); assert.equal([...f.nodes.values()].some(node => node.listeners.size), false);
});

test('toolbar deletion uses the shared mode permission and presentation refreshes, propagating command failure without refreshing', () => {
  const f = toolbarInputFixture(), calls = [], marker = new Error('delete failure'); let result = false, fail = false;
  const editing = f.toolbar.createEditingBinding({ deleteSelection() { calls.push('delete'); if (fail) throw marker; return result; } });
  editing.bind(); f.events.length = 0; f.state.geometry = false;
  f.nodes.get('deleteSelectionBtn').click(); assert.deepEqual(calls, []); assert.deepEqual(f.events, []);
  f.state.geometry = true; f.nodes.get('deleteSelectionBtn').click(); assert.deepEqual(calls.splice(0), ['delete']); assert.deepEqual(f.events, []);
  result = true; f.nodes.get('deleteSelectionBtn').click(); assert.deepEqual(calls.splice(0), ['delete']);
  assert.ok(f.events.indexOf('annotation') >= 0); assert.ok(f.events.indexOf('annotation') < f.events.indexOf('frame'));
  f.events.length = 0; fail = true; assert.throws(() => f.nodes.get('deleteSelectionBtn').click(), error => error === marker);
  assert.deepEqual(calls, ['delete']); assert.deepEqual(f.events, []); editing.dispose();
});


function preparedToolbarFixture(composed, probe = {}) {
  probe.steps = []; probe.ports = {}; probe.results = {}; probe.svgReads = [];
  const mark = name => { probe.steps.push(name); if (probe.failAt === name) throw probe.error; };
  const f = toolbarPresentationFixture((toolbar, options, { f, state, nodes, node }) => {
    const writes = [], canvas = { dataset: {}, style: { setProperty(name, value) { writes.push({ name, value }); } }, classList: { add() {} } };
    function button(id, label = id, constraint) {
      const item = node(); Object.assign(item, { id, dataset: { constraint }, svg: label, querySelector(selector) {
        assert.equal(selector, 'svg'); probe.svgReads.push(this); return { innerHTML: this.svg };
      } }); return item;
    }
    for (const id of ['toolLine', 'toolSpline', 'toolFillet', 'annotationTextBtn']) nodes.set(id, button(id));
    const fixed = button('fixPointBtn', 'fixed-captured'), distance = button('', 'distance-captured', 'distance'), menu = button('menuDistance');
    nodes.set('fixPointBtn', fixed); const lists = { constraints: [distance], menu: [menu] };
    f.document.querySelectorAll = selector => { const name = selector === '[data-constraint]' ? 'constraints' : 'menu';
      assert.ok(['[data-constraint]', '[data-menu-constraint]'].includes(selector)); mark('query-' + name); f.events.push('query:' + selector); return lists[name]; };
    const getElement = f.document.getElementById; f.document.getElementById = id => { if (id === 'fixPointBtn') mark('fix'); return getElement(id); };
    const originalCursor = f.w.CommandCursor, originalView = f.w.ToolbarView;
    f.w.CommandCursor = { ...originalCursor, create(input) { mark('cursor'); probe.ports.cursor = input; return probe.results.cursor = originalCursor.create(input); } };
    f.w.ToolbarView = { ...originalView, create(input) { mark('view'); probe.ports.view = input; return probe.results.view = originalView.create(input); },
      createCommandStatus(input) { mark('status'); probe.ports.status = input; return probe.results.status = originalView.createCommandStatus(input); } };
    try {
      let prepared;
      if (composed) prepared = toolbar.prepareControls({ canvas });
      else {
        const constraintButtons = Array.from(f.document.querySelectorAll('[data-constraint]'));
        const constraintMenuButtons = Array.from(f.document.querySelectorAll('[data-menu-constraint]'));
        const fixPointBtn = f.document.getElementById('fixPointBtn');
        const cursor = f.w.CommandCursor.create({ document: f.document, canvas, fixPointBtn, constraintButtons });
        prepared = { constraintButtons, constraintMenuButtons, fixPointBtn, cursor,
          createControls: options => toolbar.createControls({ ...options, updateCursor: cursor.update }) };
      }
      assert.deepEqual(probe.steps, ['query-constraints', 'query-menu', 'fix', 'cursor']); assert.deepEqual(probe.svgReads, []);
      probe.prepared = prepared; probe.canvas = canvas; probe.writes = writes; probe.fixed = fixed; probe.distance = distance; probe.menu = menu;
      probe.preparationReads = [...f.events]; assert.deepEqual(probe.preparationReads, ['query:[data-constraint]', 'query:[data-menu-constraint]', 'dom:fixPointBtn']);
      if (probe.afterPrepare) probe.afterPrepare({ prepared, lists, nodes, button });
      f.events.length = 0; return probe.assemble ? probe.assemble(prepared, options) : prepared.createControls(options);
    } finally { f.w.CommandCursor = originalCursor; f.w.ToolbarView = originalView; }
  });
  return { ...f, probe };
}

test('toolbar preparation retains early DOM identity and actual Cursor, with View and Status constructed only at the later stage', () => {
  for (const composed of [false, true]) {
    const probe = { afterPrepare({ lists, nodes, button }) { lists.constraints = [button('', 'replacement', 'distance')]; nodes.set('fixPointBtn', button('fixPointBtn', 'replacement-fixed')); } };
    const f = preparedToolbarFixture(composed, probe), { prepared, ports, results } = probe;
    assert.deepEqual(probe.steps, ['query-constraints', 'query-menu', 'fix', 'cursor', 'view', 'status']); assert.deepEqual(probe.svgReads, []);
    assert.equal(prepared.cursor, results.cursor); assert.equal(f.controls.view, results.view); assert.equal(f.controls.status, results.status);
    assert.equal(prepared.fixPointBtn, probe.fixed); assert.equal(prepared.constraintButtons[0], probe.distance); assert.equal(prepared.constraintMenuButtons[0], probe.menu);
    assert.equal(ports.cursor.constraintButtons, prepared.constraintButtons); assert.equal(ports.cursor.fixPointBtn, prepared.fixPointBtn); assert.equal(ports.view.updateCursor, prepared.cursor.update);
    assert.equal(ports.cursor.document, f.document); assert.equal(ports.view.document, f.document); assert.deepEqual(probe.writes, []);
    f.controller.resetDocument(); f.constraints.begin('fixed', []); f.controls.view.update();
    assert.equal(probe.canvas.dataset.commandCursorSource, 'fixPointBtn'); assert.match(decodeURIComponent(probe.writes.at(-1).value), /fixed-captured/);
    if (composed) assert.equal(Object.isFrozen(prepared), true);
  }
});

test('prepared toolbar keeps live interaction after flyout sync and the same cursor cache, priority, language and status updates', () => {
  for (const composed of [false, true]) {
    const f = preparedToolbarFixture(composed), { canvas, writes, distance } = f.probe; f.controller.resetDocument(); f.events.length = 0;
    f.lifecycle.setMode('line'); f.state.onFlyouts = () => { f.pending.replace({ type: 'distance-value' }); f.state.spline = true; };
    f.controls.view.update(); assert.equal(f.nodes.get('toolLine').classes.has('active'), true); assert.equal(canvas.dataset.commandCursorSource, 'constraint:distance');
    assert.match(decodeURIComponent(writes.at(-1).value), /distance-captured/); const count = writes.length;
    distance.svg = 'changed-after-cache'; f.controls.view.update(); assert.equal(writes.length, count);
    f.state.onFlyouts = null; f.pending.replace(null); f.constraints.begin('fixed', []); f.settings.language = 'en'; f.controls.status.update();
    assert.equal(f.nodes.get('statusCommand').textContent, 'Constraint'); f.controls.view.update(); assert.equal(canvas.dataset.commandCursorSource, 'fixPointBtn');
    f.constraints.reset(); f.state.spline = false; f.lifecycle.setMode('select'); f.controls.view.update(); assert.equal(canvas.dataset.commandCursorSource, undefined);
  }
});

test('toolbar preparation preserves DOM lookup and constructor failure order without eager state refresh or later construction', () => {
  const sequence = ['query-constraints', 'query-menu', 'fix', 'cursor', 'view', 'status'];
  for (const composed of [false, true]) for (const failAt of sequence) {
    const probe = { failAt, error: new Error(failAt) };
    assert.throws(() => preparedToolbarFixture(composed, probe), error => error === probe.error);
    assert.deepEqual(probe.steps, sequence.slice(0, sequence.indexOf(failAt) + 1)); assert.deepEqual(probe.svgReads, []);
    if (probe.writes) assert.deepEqual(probe.writes, []);
  }
});

function commandPanelFixture(composed, probe = {}) {
  const f = fixture(), w = f.w, context = { window: w, structuredClone };
  const sources = vm.runInNewContext(fs.readFileSync("index.html", "utf8").match(/const sources = (\[[\s\S]*?\]);/)[1]);
  for (const file of sources.filter(p => p.startsWith("src/"))) vm.runInNewContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  const { readCommandPanel, readDerivedPanel, ...canvasRefresh } = f.canvas;
  f.feature.bindUI(f.ui); f.feature.bindCanvas(canvasRefresh); f.events.length = 0;
  const state = { ready: false, mode: "select", sketch: "S1", sources: [], regions: [], draft: null, png: false }, steps = [], ports = {}, results = {};
  Object.assign(probe, { steps, ports, results });
  const ready = () => assert.equal(state.ready, true, "no eager command state read");
  const mark = name => { steps.push(name); if (probe.failAt === name) throw probe.error; };
  function element(tag) {
    const node = { tagName: tag.toUpperCase(), dataset: {}, children: [], attributes: {}, listeners: {}, textContent: "",
      classList: { toggle() {} }, setAttribute(key, value) { this.attributes[key] = value; },
      append(...nodes) { for (const child of nodes) { child.parentElement = this; this.children.push(child); } },
      replaceChildren(...nodes) { this.children = []; this.append(...nodes); },
      addEventListener(name, callback) { mark("listen:" + name); this.listeners[name] = callback; },
      contains(target) { return this === target || this.children.some(child => child.contains(target)); },
      querySelectorAll(selector) { return this.children.flatMap(child => [...(child.tagName === selector.toUpperCase() ? [child] : []), ...child.querySelectorAll(selector)]); },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
      get options() { return this.children; }, focus() { f.document.activeElement = this; } };
    return node;
  }
  f.document.createElement = tag => { mark("dom:" + tag); return element(tag); };
  const host = { children: [], append(node) { assert.equal(this, host); mark("append"); this.children.push(node); } };
  const item = { id: "L1", sketchId: "S1" }, reference = { type: "line", id: "L1" };
  const sketches = { sketchName: id => { ready(); return "Sketch " + id; }, activeSketchId: () => { ready(); return state.sketch; }, elementSketchId: value => value.sketchId };
  function commit() { "use strict"; assert.equal(this, undefined); ready(); f.events.push("projection-finish"); }
  function finish(value) { "use strict"; ready(); f.events.push(["source-finish", value, this === source]); }
  function exit() { "use strict"; assert.equal(this, undefined); ready(); f.events.push("exit"); if (state.failExit) throw probe.error; state.mode = "select"; }
  const projection = Object.freeze({ get sources() { ready(); return state.sources; }, commit, remove: index => f.events.push(["projection-remove", index]) });
  const geometry = { pending: null, sources: [], changeSetting(key, value) { assert.equal(this, geometry); f.events.push(["geometry-setting", key, value]); } };
  const source = Object.freeze({ instance: item, current: { instance: item, sources: [reference] }, finish, remove: () => {} });
  const hatch = { get regions() { ready(); return state.regions; }, includeConstruction: false,
    finish() { assert.equal(this, hatch); f.events.push("hatch-finish"); }, changeSetting: (key, value) => f.events.push(["hatch-setting", key, value]), select() {}, remove() {} };
  const annotation = { get active() { ready(); return Boolean(state.draft); }, get draft() { ready(); return state.draft; }, validContent: () => true, evaluatedValue: () => 12,
    canFinish: () => true, finish() { assert.equal(this, annotation); f.events.push("annotation-finish"); }, cancel() {}, changeSetting: (key, value) => f.events.push(["annotation-setting", key, value]) };
  const png = { get active() { ready(); return state.png; }, readState() { assert.equal(this, png); return { id: "png", title: "PNG", actions: [{ id: "cancel", label: "Cancel" }] }; },
    onAction(action) { assert.equal(this, png); f.events.push(["png-action", action]); }, onSetting() {} };
  function effectiveAnnotationStyle(value) { "use strict"; assert.equal(this, undefined); ready(); f.events.push(["style", value.sketchId]); return { terminatorType: "arrow", fixedDisplaySize: false }; }
  const readServices = { reads: { resolveGeometryRef: ref => { ready(); assert.equal(ref, reference); return item; } }, annotationAppearance: { effectiveAnnotationStyle } };
  const lifecycle = Object.freeze({ readMode: () => { ready(); return state.mode; }, exit });
  for (const [name, label] of [["DerivedCommandPanel", "derived"], ["HatchCommandPanel", "hatch"], ["AnnotationCommandPanel", "annotation"]]) {
    const original = w[name]; w[name] = { ...original, create(input) { mark(label); ports[label] = input; return results[label] = original.create(input); } };
  }
  const original = w.CommandPanel;
  w.CommandPanel = { ...original, createFeature(input) { mark("feature"); ports.feature = input; return results.feature = original.createFeature(input); } };
  const options = { host, documentWorkspace: { sketches }, readServices, lifecycle, projectionCommand: projection, geometryCommand: geometry,
    sourceCommand: source, changeFreeProperty: (key, value) => f.events.push(["free-property", key, value]), hatchCommand: hatch, annotationCommand: annotation, pngExportCommand: png };
  const panels = composed ? f.feature.createCommandPanelsForEditing(options) : f.feature.createCommandPanels({ host, readMode: lifecycle.readMode, sketchContext: sketches,
    projectionCommand: projection, geometryCommand: geometry, sourceCommand: source, resolveGeometryRef: readServices.reads.resolveGeometryRef,
    geometryRefForItem: w.GeometryObjects.geometryRefForItem, applicationText: f.settings.applicationText, formatDisplayNumber: w.NumberDisplay.formatDisplayNumber,
    finishProjection: projection.commit, finishSourceEdit: source.finish, exitDrawMode: lifecycle.exit, changeFreeProperty: options.changeFreeProperty,
    hatchCommand: hatch, annotationCommand: annotation, effectiveAnnotationStyle, pngExportCommand: png,
    updateUI: f.feature.updateUI, updatePropertiesUI: f.feature.updatePropertiesUI, setHint: f.feature.setHint, draw: f.feature.draw });
  assert.deepEqual(f.events, []); state.ready = true;
  const panel = host.children[0];
  function action(id) { panel.listeners.click({ target: { closest: selector => selector === "button[data-action]" ? { dataset: { action: id } } : null } }); }
  return { ...f, presentationState: f.state, state, panels, panel, action, host, steps, ports, results, options, item, reference, projection, source, annotation };
}

test("command panels share presentation and editing owners cold while preserving real factory order and public identity", () => {
  for (const composed of [false, true]) {
    const f = commandPanelFixture(composed);
    assert.deepEqual(f.steps, ["feature", "derived", "hatch", "annotation", "dom:section", "append", "listen:click", "listen:input", "listen:change", "listen:keydown"]);
    assert.equal(f.panels, f.results.feature); assert.equal(f.feature.readCommandPanel(), f.panels.commandPanel);
    assert.equal(f.panels.derivedPanel, f.results.derived); assert.equal(Object.isFrozen(f.panels), true);
    assert.equal(f.ports.feature.finishProjection, f.projection.commit); assert.equal(f.ports.feature.finishSourceEdit, f.source.finish);
    assert.equal(f.ports.feature.exitDrawMode, f.options.lifecycle.exit); assert.equal(f.ports.feature.updateUI, f.feature.updateUI);
    assert.equal(f.ports.feature.draw, f.feature.draw); assert.equal(f.panel.hidden, true); assert.equal(f.panels.commandPanel.active, false);
  }
});

test("command panels preserve live projection, source, Hatch, annotation and PNG routes, language, style and selected identity", () => {
  const snapshots = [];
  for (const composed of [false, true]) {
    const f = commandPanelFixture(composed), { state, panels } = f;
    state.mode = "sketch-projection"; state.sources = [{ key: "L1", item: f.item }];
    panels.commandPanel.update(); assert.equal(f.panel.dataset.command, "sketch-projection");
    f.action("finish"); assert.equal(f.events.at(-1), "projection-finish");
    panels.derivedPanel.onSelect("sources", 0); assert.equal(panels.derivedPanel.selectedItem(), f.item); assert.equal(f.feature.selectedItem, f.item);
    f.settings.language = "en"; state.sketch = "S2"; assert.match(panels.derivedPanel.readState().message, /Destination: Sketch S2/);
    state.mode = "instance-sources"; f.action("cancel"); assert.deepEqual(f.events.at(-1), ["source-finish", false, false]);
    f.action("finish"); assert.deepEqual(f.events.at(-1), ["source-finish", true, true]);
    state.mode = "hatch"; state.regions = [{ id: "R1", area: 1.23456789 }];
    panels.commandPanel.update(); assert.equal(f.panel.dataset.command, "hatch"); assert.match(f.results.hatch.readState().message, /1.234568/);
    f.panel.listeners.change({ target: { dataset: { setting: "includeConstruction" }, type: "checkbox", checked: true } });
    assert.deepEqual(f.events.at(-1), ["hatch-setting", "includeConstruction", true]); f.action("finish"); assert.equal(f.events.at(-1), "hatch-finish");
    state.draft = { style: {}, text: "live text", parameterEnabled: false, withLeader: false };
    panels.commandPanel.update(); assert.equal(f.panel.dataset.command, "annotation"); assert.ok(f.events.some(event => Array.isArray(event) && event[0] === "style" && event[1] === "S2"));
    f.panel.listeners.input({ target: { tagName: "TEXTAREA", dataset: { setting: "text" }, value: "changed" } });
    assert.deepEqual(f.events.at(-1), ["annotation-setting", "text", "changed"]); f.action("finish"); assert.equal(f.events.at(-1), "annotation-finish");
    state.png = true; panels.commandPanel.update(); assert.equal(f.panel.dataset.command, "png"); f.action("cancel"); assert.deepEqual(f.events.at(-1), ["png-action", "cancel"]);
    state.png = false; state.draft = null; state.mode = "sketch-projection"; f.events.length = 0; f.action("cancel");
    assert.equal(f.events[0], "exit"); assert.equal(f.events.includes("analysis"), false); assert.ok(f.events.some(event => event[0] === "hint" && event[1] === "Command canceled."));
    assert.equal(f.events.at(-1), "frame"); snapshots.push(JSON.stringify({ events: f.events, state: panels.derivedPanel.readState() }));
  }
  assert.equal(snapshots[1], snapshots[0]);
});

test("command panel construction and cancellation propagate identical exceptions without later construction or refresh effects", () => {
  const order = ["feature", "derived", "hatch", "annotation", "dom:section", "append", "listen:click"];
  for (const composed of [false, true]) {
    for (const failAt of order) {
      const error = new Error(failAt), probe = { failAt, error };
      assert.throws(() => commandPanelFixture(composed, probe), value => value === error);
      assert.deepEqual(probe.steps, order.slice(0, order.indexOf(failAt) + 1));
    }
    for (const failAt of ["exit", "name", "input"]) {
      const error = new Error(failAt), f = commandPanelFixture(composed, { error }); f.state.mode = "sketch-projection"; f.state.sources = [{ key: "L1", item: f.item }];
      if (failAt === "exit") f.state.failExit = true; else { f.presentationState.fail = failAt; f.presentationState.marker = error; }
      assert.throws(() => f.action("cancel"), value => value === error);
      assert.equal(f.events.includes("frame"), false); assert.equal(f.events.at(-1), failAt);
    }
  }
});
function startupFixture(composed, fail) {
  'use strict';
  const f = fixture(), stages = [], marker = new Error('startup failure'), target = { textContent: '', dataset: {}, removeAttribute() { delete this.title; } };
  const live = { language: 'ja', theme: 'light', version: null, loading: false, resized: false, started: false };
  const step = name => { stages.push(name); if (fail === name) throw marker; };
  vm.runInNewContext(fs.readFileSync('src/ui/runtime_version_view.js', 'utf8'), { window: f.w });
  const rawCreate = f.w.RuntimeVersionView.create;
  let actual, constructorPorts, startup;
  f.w.RuntimeVersionView = { create(ports) { step('create'); constructorPorts = ports; return actual = rawCreate(ports); } };
  Object.defineProperties(f.settings, {
    language: { get() { return live.language; } },
    theme: { get() { step('theme read'); return live.theme; } },
  });
  f.settings.setApplicationLanguage = function(value, options) {
    assert.equal(this, undefined); step('language'); assert.equal(value, 'en'); assert.deepEqual(JSON.parse(JSON.stringify(options)), { persist: false, refresh: false });
    live.language = value; live.theme = 'dark'; f.settings.localizeApplicationUI(); actual.render();
  };
  f.settings.setApplicationTheme = function(value, options) {
    assert.equal(this, undefined); step('theme'); assert.equal(value, 'dark'); assert.deepEqual(JSON.parse(JSON.stringify(options)), { persist: false, redraw: false });
    live.theme = value; live.version = { available: true, branch: 'after-theme', commit: 'a'.repeat(40), shortCommit: 'a'.repeat(12), dirty: true };
  };
  f.document.getElementById = id => {
    if (id !== 'runtimeCommit') return id === 'propertiesPanel' ? f.state.properties : null;
    step(live.loading ? 'load render' : 'language render'); return target;
  };
  const surface = { start() { assert.equal(this, surface); step('surface'); live.started = true; return marker; } };
  function resizeCanvas() { assert.equal(this, undefined); step('resize'); live.resized = true; }
  function readVersion() { assert.equal(this, undefined); step('version read'); live.loading = true; return live.version; }
  if (composed) startup = f.feature.createStartup({ canvasSurface: surface, resizeCanvas, readVersion });
  else {
    actual = f.w.RuntimeVersionView.create({ document: f.document, applicationText: f.settings.applicationText });
    const { setApplicationLanguage, setApplicationTheme } = f.settings;
    startup = { versionView: actual, initialize(message) {
      f.feature.updateUI(); f.feature.draw(); f.feature.log(message);
      setApplicationLanguage(f.settings.language, { persist: false, refresh: false });
      setApplicationTheme(f.settings.theme, { persist: false, redraw: false });
      actual.load(readVersion()); resizeCanvas(); surface.start();
    } };
  }
  const cold = { stages: [...stages], events: [...f.events], domReads: f.state.domReads };
  const oldFrame = f.canvas.drawCanvas;
  f.canvas.drawCanvas = function() { step('frame'); live.language = 'en'; return oldFrame(); };
  const oldLog = f.feedback.log;
  f.feedback.log = function(message) { step('log'); return oldLog.call(this, message); };
  f.ui.syncAnnotationResize = () => step('ui');
  f.feature.bindUI(f.ui); f.feature.bindCanvas(f.canvas);
  f.events.length = 0; stages.length = 0;
  return { ...f, startup, actual, constructorPorts, cold, stages, live, target, marker,
    result() { return JSON.parse(JSON.stringify({ stages, events: f.events, live, target })); } };
}

test('presentation startup creates the actual version view cold and supports later UI and canvas binding', () => {
  const f = startupFixture(true);
  assert.equal(f.startup.versionView, f.actual); assert.ok(Object.isFrozen(f.startup));
  assert.equal(f.constructorPorts.document, f.document); assert.equal(f.constructorPorts.applicationText, f.settings.applicationText);
  assert.deepEqual(f.cold, { stages: ['create'], events: ['settings', 'profiler', 'feedback'], domReads: 0 });
  assert.equal(f.startup.initialize('new document'), undefined);
  assert.equal(f.live.started, true); assert.equal(f.target.dataset.state, 'available');
});

test('presentation startup retains live settings and version reads, exact options and original UI-to-surface sequence', () => {
  const raw = startupFixture(false), composed = startupFixture(true);
  assert.equal(raw.startup.initialize('new document'), undefined); assert.equal(composed.startup.initialize('new document'), undefined);
  assert.deepEqual(composed.result(), raw.result());
  assert.deepEqual(composed.stages, ['ui', 'frame', 'log', 'language', 'language render', 'theme read', 'theme', 'version read', 'load render', 'resize', 'surface']);
  assert.equal(composed.target.textContent, 'after-theme@aaaaaaaaaaaa (dirty)');
});

test('presentation startup propagates failures at the same stage and retains the same partial state', () => {
  for (const failure of ['ui', 'frame', 'log', 'language', 'language render', 'theme read', 'theme', 'version read', 'load render', 'resize', 'surface']) {
    const raw = startupFixture(false, failure), composed = startupFixture(true, failure);
    for (const f of [raw, composed]) assert.throws(() => f.startup.initialize('new document'), error => error === f.marker);
    assert.deepEqual(composed.result(), raw.result(), failure); assert.equal(composed.stages.at(-1), failure);
  }
});

(function () {
"use strict";
function workspaceControlsFixture(composed, failure = null, observe = {}, assemble) {
 const f=fixture(),events=[],counts={},marker=new Error('workspace UI'),listeners=[];
 function stage(name){events.push(name);if(name===failure)throw marker;}
 function surface(name){
  const handlers=new Map();
  return {addEventListener(type,callback){listeners.push([name,type]);if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(callback);},
   removeEventListener(){},dispatch(type,event={}){for(const callback of handlers.get(type)||[])callback.call(this,event);},
   closest:()=>null,focus(){events.push(name+':focus');}};
 }
 Object.assign(f.document,surface('document'));
 const browserWindow={...surface('window'),setTimeout(){return 1;},clearTimeout(){},
  MutationObserver:class{observe(){}disconnect(){}}};
 const menuBar={classList:{toggle(name,value){counts[name]=value;}}},menuContainer=surface('menu-container');
 const menus=[0,1].map(i=>Object.assign(surface('menu'+i),{open:false,
  summary:surface('summary'+i),querySelector(){return this.summary;},
  removeAttribute(name){assert.equal(name,'open');if(observe.closeError)throw observe.closeError;this.open=false;},
  setAttribute(){this.open=true;}}));
 const tool=surface('tool');tool.click=()=>{counts.tool=(counts.tool||0)+1;};
 const menuButton=Object.assign(surface('menu-button'),{dataset:{menuTool:'toolLine'},closest:()=>menus[0]});
 f.document.getElementById=id=>id==='toolLine'?tool:null;
 f.document.querySelectorAll=selector=>selector==='.app-menu'?menus:selector==='[data-menu-tool]'?[menuButton]:[];
 f.document.querySelector=selector=>selector==='.menu-bar'?menuBar:selector==='.app-menus'?menuContainer:null;
 for(const source of ['src/ui/application_menus.js','src/ui/tool_flyouts.js'])vm.runInNewContext(fs.readFileSync(source,'utf8'),{window:f.w});
 let actualMenus;
 for(const [name,label]of [['ApplicationMenus','menu'],['ToolFlyouts','flyout']]){
  const original=f.w[name];f.w[name]={...original,create(options){
   stage(label+' create');const owner=original.create(options);if(name==='ApplicationMenus')actualMenus=owner;
   return {...owner,start(){assert.equal(arguments.length,0);stage(label+' start');return owner.start();}};
  }};
 }
 let close;
 const part=(name,method)=>{const owner={[method](){assert.equal(this,owner);assert.equal(arguments.length,0);stage(name);
  counts[name]=(counts[name]||0)+1;f.document.addEventListener(name,()=>{counts[name+':event']=(counts[name+':event']||0)+1;});
  if(name==='parameters'){assert.equal(typeof close,'function');close();}
  return observe.result;
 }};return owner;};
 const input={window:browserWindow,editingTools:part('editing','bind'),canvasViewControls:part('canvas','bindControls'),
  layout:part('layout','bindControls'),parameters:part('parameters','start'),appearance:part('appearance','start'),blocks:part('blocks','bind')};
 f.settings.start=function(){assert.equal(this,f.settings);assert.equal(arguments.length,0);stage('settings');counts.settings=(counts.settings||0)+1;return observe.result;};
 let controls;
 observe.events=events;observe.counts=counts;observe.listeners=listeners;
 function prepare(){
  if(assemble)controls=assemble(f,input);
  else if(composed)controls=f.feature.prepareWorkspaceControls(input);
  else{
   input.editingTools.bind();input.canvasViewControls.bindControls();
   const navigation=f.feature.createToolNavigation({window:browserWindow});
   controls={close:navigation.close,start(){
    navigation.start();input.layout.bindControls();input.parameters.start();input.appearance.start();f.settings.start();input.blocks.bind();
   }};
  }
  close=controls.close;return controls;
 }
 const snapshot=()=>JSON.stringify({events,counts,listeners,menus:menus.map(m=>m.open)});
 return {...f,prepare,events,counts,listeners,menus,menuButton,browserWindow,marker,snapshot,get actualMenus(){return actualMenus;}};
}

test('workspace controls keep preparation separate from navigation and later startup over the actual menu and flyout owners',()=>{
 for(const composed of [false,true]){
  const f=workspaceControlsFixture(composed),controls=f.prepare();
  assert.deepEqual(f.events,['editing','canvas','menu create']);
  assert.equal(controls.close,f.actualMenus.close);
  assert.equal(f.listeners.some(([owner])=>owner==='window'),false);
  assert.equal(f.counts.layout,undefined);
  f.menus[0].open=true;assert.equal(controls.start(),undefined);
  assert.equal(f.menus[0].open,false);assert.equal(f.counts.parameters,1);assert.equal(f.counts.blocks,1);
  assert.ok(f.listeners.some(([owner,type])=>owner==='window'&&type==='blur'));
  assert.equal(f.events.indexOf('menu start')<f.events.indexOf('flyout create'),true);
 }
});

test('workspace controls preserve real menu tool dispatch, Escape/outside closure and live event receivers after activation',()=>{
 const results=[];
 for(const composed of [false,true]){
  const f=workspaceControlsFixture(composed),controls=f.prepare();controls.start();
  f.menus[0].open=true;f.menuButton.dispatch('click');assert.equal(f.counts.tool,1);assert.equal(f.menus[0].open,false);
  f.menus[1].open=true;let prevented=0,stopped=0;
  f.document.dispatch('keydown',{key:'Escape',preventDefault(){prevented++;},stopPropagation(){stopped++;}});
  assert.equal(prevented,1);assert.equal(stopped,1);assert.equal(f.menus[1].open,false);
  f.menus[0].open=f.menus[1].open=true;f.document.dispatch('pointerdown',{target:{closest:()=>null}});
  assert.equal(f.menus.some(menu=>menu.open),false);
  f.document.dispatch('editing');f.document.dispatch('blocks');
  assert.equal(f.counts['editing:event'],1);assert.equal(f.counts['blocks:event'],1);
  results.push(f.snapshot());
 }
 assert.equal(results[1],results[0]);
});

test('workspace controls preserve every startup failure boundary, installed listeners and menu close exception identity',()=>{
 const phases=['editing','canvas','menu create','menu start','flyout create','flyout start','layout','parameters','appearance','settings','blocks'];
 for(const phase of phases){
  const results=[];
  for(const composed of [false,true]){
   const observe={},f=workspaceControlsFixture(composed,phase,observe);
   assert.throws(()=>{const controls=f.prepare();controls.start();},error=>error===f.marker);
   assert.equal(f.events.at(-1),phase);results.push(f.snapshot());
  }
  assert.equal(results[1],results[0],phase);
 }
 for(const composed of [false,true]){
  const observe={},f=workspaceControlsFixture(composed,null,observe),controls=f.prepare();controls.start();
  const error=new Error('close');observe.closeError=error;
  assert.throws(()=>controls.close(),value=>value===error);
 }
});
function toolbarWorkspaceFixture(composed, failure) {
 const observe={},nodes=new Map(),calls=[],probe={},state={geometry:true,failCommand:null};let drawing,editing,toolbar,f;
 const fail=stage=>{f.events.push(stage);if(failure===stage)throw f.marker;};
 f=workspaceControlsFixture(true,failure,observe,(base,input)=>{
  toolbar=base.feature.createToolbar({lifecycle,pending:{current:null},constraints:{command:null},constructionCommand,
   readSplineEditing:()=>false,readHistory:()=>({}),updateDocumentStatus(){},isGeometryMode:()=>state.geometry});
  const options={window:input.window,canvasViewControls:input.canvasViewControls,layout:input.layout,parameters:input.parameters,appearance:input.appearance,blocks:input.blocks,
   editing,drawing};
  if(composed)return toolbar.prepareWorkspace(options);
  const editingTools=toolbar.createEditingBinding(editing),controls=base.feature.prepareWorkspaceControls({...input,editingTools});
  return Object.freeze({...controls,createDrawingBinding(){return toolbar.createDrawingBinding({
   startCenterlineCommand:drawing.centerline.start,startCircleCenterCrossCommand:drawing.circleCenterCross.start,
   startSketchProjectionCommand:drawing.projection.start,startGeometryInstanceCommand:drawing.instances.start,filletCommand:drawing.fillet,
   startBlockCreation:drawing.blockCreation.startCreation,offsetCommand:drawing.offset,beginSplineCreation:drawing.spline.start,startHatchCreation:drawing.hatch.startHatchCreation});}});
 });
 const lifecycle={start(mode){assert.equal(this,lifecycle);calls.push(['mode',mode]);}},result={value:true};
 const action=(name,kind='event')=>function(value){'use strict';
  if(kind==='event'){assert.equal(this,nodes.get(value.buttonId));assert.equal(arguments.length,1);}else{assert.equal(this,undefined);assert.equal(arguments.length,kind==='type'?1:0);}
  calls.push([name,kind==='event'?value.buttonId:value]);if(state.failCommand===name)throw f.marker;return kind==='delete'?false:result;
 };
 drawing={centerline:Object.freeze({start:action('centerline')}),circleCenterCross:Object.freeze({start:action('cross')}),projection:Object.freeze({start:action('projection')}),
  instances:Object.freeze({start:action('instances','type')}),fillet:Object.freeze({begin:action('fillet')}),blockCreation:Object.freeze({startCreation:action('block')}),
  offset:Object.freeze({begin:action('offset')}),spline:Object.freeze({start:action('spline')}),hatch:Object.freeze({startHatchCreation:action('hatch')})};
 const annotation=Object.freeze({start:function(){'use strict';assert.equal(this,annotation);assert.equal(arguments.length,0);calls.push(['annotation']);return result;}});
 editing={undo:action('undo'),redo:action('redo'),toggleVisibility:action('visibility'),deleteSelection:action('delete','delete'),annotation};
 const constructionCommand={toggle:action('construction')};
 const get=f.document.getElementById;
 f.document.getElementById=id=>{
  if(!id.startsWith('tool')&&!['undoBtn','redoBtn','selectionVisibilityBtn','deleteSelectionBtn','annotationTextBtn'].includes(id))return get(id);
  if(!nodes.has(id)){
   const handlers=new Map(),node={id,addEventListener(type,handler){assert.equal(this,node);if(failure==='drawing-partial'&&id==='toolLine')throw f.marker;
    if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(handler);},removeEventListener(type,handler){const list=handlers.get(type)||[];handlers.set(type,list.filter(h=>h!==handler));},
    dispatch(){const event={buttonId:id};let value;for(const handler of handlers.get('click')||[])value=handler.call(node,event);return value;},
    click(){return node.dispatch();},count:()=>handlers.get('click')?.length||0};nodes.set(id,node);
  }return nodes.get(id);
 };
 const raw=f.w.ToolbarView;
 f.w.ToolbarView={...raw,createEditingBinding(options){fail('editing create');probe.editing=options;const actual=raw.createEditingBinding(options);
  const bound=Object.freeze({...actual,bind(){assert.equal(this,bound);fail('editing bind');return actual.bind();}});return probe.editingBinding=bound;},
  createBinding(options){fail('drawing create');probe.drawing=options;const actual=raw.createBinding(options);
   const bound=Object.freeze({...actual,bind(){assert.equal(this,bound);fail('drawing bind');return actual.bind();}});return probe.drawingBinding=bound;}};
 f.events.length=0;return {...f,nodes,calls,probe,state,editing,drawing,lifecycle,result,get actualMenus(){return f.actualMenus;},get toolbar(){return toolbar;}};
}
test('Toolbar Workspace assembly keeps editing preparation, close publication, startup and late drawing construction distinct',()=>{
 const snapshots=[];for(const composed of [false,true]){
  const f=toolbarWorkspaceFixture(composed),controls=f.prepare();assert.equal(Object.isFrozen(controls),true);
  assert.equal(controls.close,f.actualMenus.close);assert.equal(f.probe.drawing,undefined);
  assert.deepEqual(f.events,['editing create','editing bind','canvas','menu create']);
  assert.equal(f.nodes.get('undoBtn').count(),1);assert.equal(f.nodes.has('toolSelect'),false);
  controls.start();assert.equal(f.probe.drawing,undefined);assert.equal(f.events.at(-1),'blocks');
  const binding=controls.createDrawingBinding();assert.equal(binding,f.probe.drawingBinding);assert.equal(f.nodes.has('toolSelect'),false);
  assert.equal(f.probe.drawing.drawOperationLifecycle,f.lifecycle);
  for(const [field,owner,method]of [['startCenterlineCommand','centerline','start'],['startCircleCenterCrossCommand','circleCenterCross','start'],
   ['startSketchProjectionCommand','projection','start'],['startGeometryInstanceCommand','instances','start'],['startBlockCreation','blockCreation','startCreation'],
   ['beginSplineCreation','spline','start'],['startHatchCreation','hatch','startHatchCreation']])assert.equal(f.probe.drawing[field],f.drawing[owner][method]);
  assert.equal(f.probe.drawing.filletCommand,f.drawing.fillet);assert.equal(f.probe.drawing.offsetCommand,f.drawing.offset);
  assert.equal(f.probe.editing.undo,f.editing.undo);assert.equal(f.probe.editing.annotation,f.editing.annotation);
  binding.bind();assert.equal(f.nodes.get('toolSelect').count(),1);binding.bind();assert.equal(f.nodes.get('toolSelect').count(),1);
  snapshots.push(JSON.stringify({events:f.events,counts:f.counts,listeners:f.listeners}));
 }assert.equal(snapshots[1],snapshots[0]);
});
test('Toolbar Workspace dispatch preserves direct DOM receivers and events, typed instance calls and editing guards',()=>{
 const snapshots=[];for(const composed of [false,true,'startup']){
  const f=toolbarWorkspaceFixture(composed),controls=f.prepare();let binding;
  if(composed==='startup'){assert.equal(controls.startWithDrawingTools(),undefined);binding=f.probe.drawingBinding;}
  else{controls.start();binding=controls.createDrawingBinding();binding.bind();}
  for(const id of ['toolCenterline','toolCircleCenterCross','toolSketchProjection','toolCreateBlock','toolSpline','toolHatch','toolFillet','toolOffset','toolConstructionLine'])assert.equal(f.nodes.get(id).dispatch(),f.result);
  for(const id of ['toolMirror','toolPattern','toolCircularPattern'])assert.equal(f.nodes.get(id).dispatch(),f.result);
  for(const id of ['undoBtn','redoBtn','selectionVisibilityBtn'])assert.equal(f.nodes.get(id).dispatch(),f.result);
  assert.equal(f.nodes.get('annotationTextBtn').dispatch(),f.result);
  f.state.geometry=false;f.nodes.get('deleteSelectionBtn').dispatch();assert.equal(f.calls.some(c=>c[0]==='delete'),false);
  f.state.geometry=true;f.nodes.get('deleteSelectionBtn').dispatch();assert.equal(f.calls.filter(c=>c[0]==='delete').length,1);
  assert.deepEqual(f.calls.filter(c=>c[0]==='instances').map(c=>c[1]),['mirror','pattern','circularPattern']);
  f.state.failCommand='hatch';assert.throws(()=>f.nodes.get('toolHatch').dispatch(),error=>error===f.marker);
  const count=f.calls.length;binding.dispose();f.nodes.get('toolHatch').dispatch();assert.equal(f.calls.length,count);assert.equal(f.nodes.get('toolHatch').count(),0);
  snapshots.push(JSON.stringify(f.calls));
 }assert.equal(snapshots[1],snapshots[0]);assert.equal(snapshots[2],snapshots[0]);
});
test('Toolbar Workspace assembly preserves construction and startup failures without constructing or binding later controls',()=>{
 for(const stage of ['editing create','editing bind','canvas','menu create','menu start','parameters','blocks','drawing create','drawing bind','drawing-partial']){
  const snapshots=[];for(const composed of [false,true,'startup']){
   const f=toolbarWorkspaceFixture(composed,stage);let controls,binding;
   assert.throws(()=>{controls=f.prepare();if(composed==='startup')controls.startWithDrawingTools();else{controls.start();binding=controls.createDrawingBinding();binding.bind();}},error=>error===f.marker);
   if(['editing create','editing bind','canvas','menu create'].includes(stage))assert.equal(controls,undefined);
   if(!['drawing create','drawing bind','drawing-partial'].includes(stage))assert.equal(f.probe.drawing,undefined);
   if(stage==='drawing-partial'){assert.equal(f.nodes.get('toolSelect').count(),1);assert.equal(f.nodes.get('toolPoint').count(),1);assert.equal(f.nodes.get('toolLine').count(),0);}
   snapshots.push(JSON.stringify({events:f.events,counts:f.counts,listeners:f.listeners,nodes:[...f.nodes].map(([id,node])=>[id,node.count()])}));
  }assert.equal(snapshots[1],snapshots[0]);assert.equal(snapshots[2],snapshots[0]);
 }
});
test('combined Toolbar startup preserves repeated native start and fresh drawing binding behavior',()=>{
 const snapshots=[];
 for(const combined of [false,true]){
  const f=toolbarWorkspaceFixture(true),controls=f.prepare();
  assert.equal(f.probe.drawing,undefined);assert.equal(controls.close,f.actualMenus.close);
  for(let i=0;i<2;i++){
   if(combined)assert.equal(controls.startWithDrawingTools(),undefined);
   else{controls.start();const drawingToolBinding=controls.createDrawingBinding();drawingToolBinding.bind();}
  }
  assert.equal(f.counts.settings,2);assert.equal(f.events.filter(e=>e==='drawing create').length,2);
  assert.equal(f.nodes.get('toolHatch').count(),2);assert.equal(f.nodes.get('undoBtn').count(),1);
  snapshots.push(JSON.stringify({events:f.events,counts:f.counts,listeners:f.listeners,nodes:[...f.nodes].map(([id,node])=>[id,node.count()])}));
 }
 assert.equal(snapshots[1],snapshots[0]);
});

test('Toolbar Workspace startup retains the existing repeat behavior and never recreates or binds drawing controls implicitly',()=>{
 for(const composed of [false,true]){
  const f=toolbarWorkspaceFixture(composed),controls=f.prepare();controls.start();controls.start();assert.equal(f.probe.drawing,undefined);assert.equal(f.counts.settings,2);
  const binding=controls.createDrawingBinding();binding.bind();assert.equal(f.events.filter(e=>e==='drawing create').length,1);
  controls.start();assert.equal(f.events.filter(e=>e==='drawing create').length,1);assert.equal(f.nodes.get('toolHatch').count(),1);
  assert.equal(f.events.filter(e=>e==='editing create').length,1);assert.equal(f.nodes.get('undoBtn').count(),1);
 }
});
})();

test('toolbar icon composition stays lazy, returns the actual View API and shares current SVG and constraint classification',()=>{
 const f=fixture(),reads=[],selectors=[],types=Object.fromEntries(['LineFixedConstraint','ArcEndpointFixedConstraint','GeometryFixedConstraint','SketchProjectionConstraint','ParallelLinesCenterlineConstraint','PointPairCenterlineConstraint'].map(name=>[name,class {}]));
 const classifier=function(value){'use strict';assert.equal(this,undefined);reads.push(['classify',value]);return value?.dimension;};
 Object.defineProperty(f.w,'DimensionQueries',{get(){reads.push('dimension-query');return{isDimensionConstraint:classifier};}});
 Object.defineProperty(f.w,'GeometrySolver',{get(){reads.push('types');return types;}});
 let markup='<svg data-version="1"></svg>',failure=null,captured,actual;
 f.document.querySelector=selector=>{selectors.push(selector);if(failure)throw failure;return{querySelector:tag=>{assert.equal(tag,'svg');return markup?{outerHTML:markup}:null;}};};
 const raw=f.w.ToolbarView,view={...raw,createIcons(options){assert.equal(this,view);captured=options;return actual=raw.createIcons(options);}};f.w.ToolbarView=view;
 const toolbar=f.feature.createToolbar({readHistory:()=>({undoCount:1,redoCount:0})});assert.deepEqual(reads,[]);assert.deepEqual(selectors,[]);
 const api=toolbar.createIcons();assert.equal(api,actual);assert.ok(Object.isFrozen(api));assert.equal(captured.document,f.document);assert.equal(captured.types,types);assert.equal(captured.isDimensionConstraint,classifier);
 assert.deepEqual(reads,['dimension-query','types']);assert.deepEqual(selectors,[]);
 const fixed=new types.LineFixedConstraint();assert.equal(api.constraintToolbarIcon(fixed),'<svg class="sketch-object-icon" data-version="1"></svg>');assert.deepEqual(selectors,['#fixPointBtn']);assert.equal(reads.length,2);
 markup='<svg data-version="2"></svg>';const dimension={name:'水平',dimension:true};assert.equal(api.constraintToolbarIcon(dimension),'<svg class="sketch-object-icon" data-version="2"></svg>');assert.equal(reads.at(-1)[1],dimension);assert.equal(selectors.at(-1),'[data-constraint="distance"]');
 markup=null;assert.equal(api.toolbarSvgMarkup('#missing'),'');failure=new Error('SVG query failed');assert.throws(()=>api.toolbarSvgMarkup('#line'),error=>error===failure);
});

test('toolbar icon assembly preserves constructor and namespace failures without caching or changing the existing toolbar',()=>{
 const f=fixture(),toolbar=f.feature.createToolbar({readHistory:()=>({undoCount:1,redoCount:0}),updateDocumentStatus:()=>f.events.push('history-status')}),raw=f.w.ToolbarView,marker=new Error('icons failed');
 f.w.DimensionQueries={isDimensionConstraint:()=>false};f.w.GeometrySolver={};let count=0;
 f.w.ToolbarView={...raw,createIcons(){count++;throw marker;}};
 assert.throws(()=>toolbar.createIcons(),error=>error===marker);assert.equal(count,1);const history=toolbar.updateHistory;toolbar.updateHistory();assert.equal(f.events.at(-1),'history-status');assert.equal(toolbar.updateHistory,history);
 const next={icons:true};f.w.ToolbarView={...raw,createIcons(){count++;return next;}};assert.equal(toolbar.createIcons(),next);assert.equal(count,2);
 Object.defineProperty(f.w,'DimensionQueries',{get(){throw marker;}});assert.throws(()=>toolbar.createIcons(),error=>error===marker);assert.equal(count,2);
});

function selectionToolbarFixture(composed, probe = {}, useDefaultFlyouts = false) {
  const calls = [], marker = new Error('selection query failed'), state = { ready: false, targets: [], hidden: false, denied: new Set(), fail: null };
  const note = (name, value) => { assert.equal(state.ready, true); calls.push([name, value]); if (state.fail === name) throw marker; };
  const selection = Object.freeze({ visibilityTargets() { 'use strict'; assert.equal(this, undefined); note('targets'); return state.targets; },
    visibilityIsHidden(targets) { 'use strict'; assert.equal(this, undefined); assert.equal(targets, state.targets); note('hidden'); return state.hidden; } });
  const sketches = Object.freeze({ constraintSketchId(item) { 'use strict'; assert.equal(this, undefined); note('constraint', item.id); return item.constraintOwner; },
    elementSketchId(item) { 'use strict'; assert.equal(this, undefined); note('element', item.id); return item.elementOwner; },
    canEditSketch(id) { 'use strict'; assert.equal(this, undefined); assert.equal(arguments.length, 1); note('permission', id); return !state.denied.has(id); } });
  probe.selectionCalls = calls; probe.assemble = (prepared, options) => {
    const syncFlyouts = useDefaultFlyouts ? undefined : options.syncFlyouts;
    return composed ? prepared.createForSelection({ selection, sketches, syncFlyouts }) : prepared.createControls({
      selectedVisibilityTargets: selection.visibilityTargets, selectionVisibilityIsHidden: selection.visibilityIsHidden, syncFlyouts,
      canEditTarget: target => sketches.canEditSketch.call(undefined, target.kind === 'constraint'
        ? sketches.constraintSketchId.call(undefined, target.item) : sketches.elementSketchId.call(undefined, target.item)),
    });
  };
  const f = preparedToolbarFixture(true, probe); assert.deepEqual(calls, []); state.ready = true;
  return { ...f, selectionState: state, selection, sketches, selectionCalls: calls, selectionMarker: marker };
}

test('Toolbar selection assembly preserves live visibility, Sketch bypass, permission order and short circuit with actual View and Cursor', () => {
  const traces = [];
  for (const composed of [false, true]) {
    const f = selectionToolbarFixture(composed), s = f.selectionState, button = f.nodes.get('selectionVisibilityBtn');
    assert.equal(f.controls.view, f.probe.results.view); assert.equal(f.controls.status, f.probe.results.status);
    assert.equal(f.probe.ports.view.selectedVisibilityTargets, f.selection.visibilityTargets);
    assert.equal(f.probe.ports.view.selectionVisibilityIsHidden, f.selection.visibilityIsHidden);
    s.targets = [{ kind: 'sketch', item: { id: 'SK' } }, { kind: 'constraint', item: { id: 'C', constraintOwner: 'S1', elementOwner: 'wrong' } },
      { kind: 'line', item: { id: 'L', elementOwner: 'S2', constraintOwner: 'wrong' } }];
    s.denied.add('S1'); s.hidden = true; f.controls.view.update(); assert.equal(button.disabled, true); assert.equal(button.attributes['aria-pressed'], 'true');
    assert.deepEqual(f.selectionCalls, [['targets', undefined], ['hidden', undefined], ['constraint', 'C'], ['permission', 'S1']]);
    f.selectionCalls.length = 0; s.denied.clear(); f.controls.view.update(); assert.equal(button.disabled, false);
    assert.deepEqual(f.selectionCalls.slice(-4), [['constraint', 'C'], ['permission', 'S1'], ['element', 'L'], ['permission', 'S2']]);
    f.selectionCalls.length = 0; f.state.geometry = false; f.controls.view.update(); assert.equal(button.disabled, true); assert.equal(f.selectionCalls.length, 2);
    f.state.geometry = true; s.targets = []; s.hidden = false; f.controls.view.update(); assert.equal(button.disabled, true); assert.equal(button.attributes['aria-pressed'], 'false');
    traces.push(JSON.stringify({ calls: f.selectionCalls, events: f.events, writes: f.probe.writes }));
  }
  assert.equal(traces[1], traces[0]);
});

test('Toolbar selection assembly retains query failure identity and partial DOM updates, and supports the existing flyout default', () => {
  for (const composed of [false, true]) {
    for (const stage of ['targets', 'hidden', 'constraint', 'permission']) {
      const f = selectionToolbarFixture(composed), s = f.selectionState, button = f.nodes.get('selectionVisibilityBtn');
      s.targets = [{ kind: 'constraint', item: { id: 'C', constraintOwner: 'S1' } }]; s.fail = stage; button.disabled = 'prior';
      assert.throws(() => f.controls.view.update(), error => error === f.selectionMarker); assert.equal(button.disabled, 'prior');
      assert.equal(f.selectionCalls.at(-1)[0], stage); assert.equal(f.events.includes('flyouts'), false);
    }
    const defaults = selectionToolbarFixture(composed, {}, true); defaults.controls.view.update();
    assert.equal(defaults.nodes.get('selectionVisibilityBtn').disabled, true);
  }
});

test('Toolbar selection assembly constructs View then Status without reading queries and preserves constructor errors', () => {
  for (const composed of [false, true]) for (const stage of ['view', 'status']) {
    const marker = new Error('construction failed'), probe = { failAt: stage, error: marker };
    assert.throws(() => selectionToolbarFixture(composed, probe), error => error === marker);
    assert.deepEqual(probe.selectionCalls, []);
    assert.deepEqual(probe.steps, ['query-constraints', 'query-menu', 'fix', 'cursor', 'view', ...(stage === 'status' ? ['status'] : [])]);
  }
});


function choicePresentationFixture(){
  const f=fixture(),events=[],elements={};
  function element(){const handlers={};return{handlers,dataset:{},classList:{add(){}},addEventListener(type,handler){handlers[type]=handler;},setAttribute(name,value){this[name]=value;},focus(){events.push('focus');}};}
  for(const key of ['title','message','actions','close'])elements[key]=element();elements.actions.children=[];elements.actions.replaceChildren=function(){this.children=[];};elements.actions.append=function(button){this.children.push(button);};Object.defineProperty(elements.actions,'firstElementChild',{get(){return this.children[0];}});
  const dialog={...element(),open:false,querySelector(selector){return elements[selector.match(/data-choice-([^\]]+)/)[1]];},showModal(){this.open=true;events.push('show');},close(){this.open=false;events.push('close');this.handlers.close?.();}};
  f.document.getElementById=function(id){assert.equal(this,f.document);assert.equal(id,'choiceDialog');events.push('element');return dialog;};f.document.createElement=()=>element();
  vm.runInNewContext(fs.readFileSync('src/ui/choice_dialog.js','utf8'),{window:f.w,document:f.document});
  const raw=f.w.ChoiceDialog;let actual;
  f.w.ChoiceDialog={create(value){assert.equal(this,f.w.ChoiceDialog);assert.equal(arguments.length,1);assert.equal(value,dialog);events.push('create');assert.throws(()=>f.feature.requestChoice({}),error=>error.name==='ReferenceError'&&error.message==="Cannot access 'choiceDialog' before initialization");return actual=raw.create(value);}};
  return{...f,events,elements,dialog,get actual(){return actual;}};
}

test('presentation owns the actual shared Choice dialog and keeps modal values, pending exclusion, cancel and event propagation',async()=>{
  const f=choicePresentationFixture();assert.deepEqual(f.events,[]);assert.equal(f.feature.requestChoice.name,'requestChoice');assert.equal(f.feature.requestChoice.length,1);
  const request=f.feature.requestChoice;assert.throws(()=>request({}),error=>error.name==='ReferenceError');const actual=f.feature.createChoiceDialog();assert.equal(actual,f.actual);assert.deepEqual(f.events,['element','create']);
  const options={title:'Title',message:'Message',choices:[{value:true,label:'Yes'},{value:false,label:'No'}],defaultValue:true,cancelLabel:'Cancel'},promise=request(options);
  assert.equal(f.dialog.open,true);assert.equal(f.elements.title.textContent,'Title');assert.equal(f.elements.message.textContent,'Message');assert.equal(f.elements.actions.children.length,3);
  await assert.rejects(request(options),/already open/);let stopped=0;f.dialog.handlers.keydown({stopPropagation(){stopped++;}});f.dialog.handlers.keyup({stopPropagation(){stopped++;}});assert.equal(stopped,2);
  f.elements.actions.children[1].handlers.click();assert.equal(await promise,false);assert.equal(f.dialog.open,false);assert.equal(f.elements.actions.children.length,0);
  const cancelled=request(options);let prevented=false;f.dialog.handlers.cancel({preventDefault(){prevented=true;}});assert.equal(await cancelled,null);assert.equal(prevented,true);
});

test('presentation choice dispatch preserves the actual receiver, one argument, promise identity and previous completed dialog on failures',()=>{
  const f=fixture(),a={},b={},marker=new Error('choice failed'),promise=Promise.resolve(true);let fail=false,created,showFailure=false,received;
  const make=id=>{const dialog={show(...args){assert.equal(this,dialog);assert.equal(args.length,1);received=args[0];if(showFailure)throw marker;return promise;},id};return dialog;};
  const first=make(a),next=make(b);f.document.getElementById=()=>({});f.w.ChoiceDialog={create(){if(fail)throw marker;return created;}};
  created=first;assert.equal(f.feature.createChoiceDialog(),first);const options={choices:[]};assert.equal(f.feature.requestChoice(options,'ignored'),promise);assert.equal(received,options);
  fail=true;assert.throws(f.feature.createChoiceDialog,error=>error===marker);assert.equal(f.feature.requestChoice(options),promise);fail=false;created=next;assert.equal(f.feature.createChoiceDialog(),next);
  showFailure=true;assert.throws(()=>f.feature.requestChoice(options),error=>error===marker);
  for(const invalid of [undefined,null]){created=invalid;assert.equal(f.feature.createChoiceDialog(),invalid);assert.throws(()=>f.feature.requestChoice(options),error=>error.name==='TypeError');}
});

test('Presentation owns the native runtime version view and language refresh uses its actual stored build state', () => {
  const f = fixture(), target = { textContent: '', dataset: {}, removeAttribute(name) { delete this[name]; } };
  Object.assign(f.document, {
    defaultView: { Node: { ELEMENT_NODE: 1 }, NodeFilter: { SHOW_TEXT: 4 } },
    documentElement: { nodeType: 1, dataset: { theme: 'light' }, querySelectorAll: () => [], matches: () => false, closest: () => null, hasAttribute: () => false },
    getElementById: id => id === 'runtimeCommit' ? target : null,
    createTreeWalker: () => ({ nextNode: () => false }),
  });
  for (const file of ['src/ui/application_settings.js', 'src/ui/runtime_version_view.js']) vm.runInNewContext(fs.readFileSync(file, 'utf8'), { window: f.w });
  const feature = f.w.PresentationFeature.create({ document: f.document, storage: () => ({ getItem: () => null }), readDuplicateCount: () => 0 });
  assert.equal(target.textContent, '');
  assert.throws(() => feature.settings.setApplicationLanguage('en', { persist: false, refresh: false }),
    error => error.name === 'ReferenceError' && error.message === "Cannot access 'runtimeVersionView' before initialization");
  const startup = feature.createStartup({});
  assert.ok(Object.isFrozen(startup)); assert.equal(target.textContent, '');
  startup.versionView.load({ available: true, branch: 'develop', commit: 'a'.repeat(40), shortCommit: 'a'.repeat(12), dirty: true });
  assert.equal(target.textContent, 'develop@aaaaaaaaaaaa (dirty)');
  feature.settings.setApplicationLanguage('ja', { persist: false, refresh: false });
  assert.equal(target.textContent, 'develop@aaaaaaaaaaaa（変更あり）');
  assert.equal(target.title, 'develop@' + 'a'.repeat(40)); assert.equal(target.dataset.state, 'available');
  feature.settings.setApplicationLanguage('en', { persist: false, refresh: false });
  assert.equal(target.textContent, 'develop@aaaaaaaaaaaa (dirty)');
  startup.versionView.load(null); assert.equal(target.textContent, 'Unavailable');
  feature.settings.setApplicationLanguage('ja', { persist: false, refresh: false });
  assert.equal(target.textContent, '取得できません'); assert.equal(target.dataset.state, 'unavailable');
});

test('Presentation version refresh preserves initialization publication, native receiver, no arguments and original returns and errors', () => {
  const f = fixture(options => { delete options.refreshVersion; });
  const refresh = f.created.settings.refreshVersion, marker = new Error('runtime view failed'), result = {};
  assert.equal(refresh.name, 'refreshVersion'); assert.equal(refresh.length, 0);
  let fail = false, created, renderError = false, reads = 0;
  const first = { render() { assert.equal(this, first); assert.equal(arguments.length, 0); reads++; if (renderError) throw marker; return result; } };
  f.w.RuntimeVersionView = { create() {
    if (fail) throw marker;
    if (created === first) assert.throws(refresh, error => error.name === 'ReferenceError');
    return created;
  } };
  assert.throws(refresh, error => error.name === 'ReferenceError');
  created = first; assert.equal(f.feature.createStartup({}).versionView, first);
  assert.equal(refresh('ignored'), result); assert.equal(reads, 1);
  fail = true; assert.throws(() => f.feature.createStartup({}), error => error === marker);
  assert.equal(refresh(), result); fail = false;
  // A settings getter can run callbacks during Startup construction; publication follows that getter.
  Object.defineProperty(f.settings, 'setApplicationLanguage', { configurable: true, get() { assert.equal(refresh(), result); throw marker; } });
  created = { render() { assert.fail('incomplete view must not be published'); } };
  assert.throws(() => f.feature.createStartup({}), error => error === marker); assert.equal(refresh(), result);
  delete f.settings.setApplicationLanguage;
  renderError = true; assert.throws(refresh, error => error === marker); renderError = false;
  for (const invalid of [undefined, null]) {
    created = invalid; assert.equal(f.feature.createStartup({}).versionView, invalid);
    assert.throws(refresh, error => error.name === 'TypeError');
  }
});

test('Presentation preserves explicit own and inherited version refresh overrides, including undefined and null', () => {
  for (const inherited of [false, true]) for (const value of [undefined, null, () => 17]) {
    const f = fixture(options => {
      delete options.refreshVersion;
      if (inherited) Object.setPrototypeOf(options, { refreshVersion: value }); else options.refreshVersion = value;
    });
    assert.equal(f.created.settings.refreshVersion, value);
    if (typeof value === 'function') assert.equal(f.created.settings.refreshVersion(), 17);
    else assert.throws(() => f.created.settings.refreshVersion(), error => error.name === 'TypeError');
  }
});
