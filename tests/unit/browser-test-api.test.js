const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('src/testing/browser_test_api.js','utf8');
function fixture({collisions=false}={}) {
  const w={get document(){assert.fail('no DOM access');},get location(){assert.fail('test-mode gating belongs to the caller');}};
  vm.runInNewContext(source,{window:w});assert.equal(Object.hasOwn(w,'__jot2dTest'),false);
  const state={value:{id:'first'},failure:null},events=[],calls=[],nodes=new Map(),marker=new Error('public capability read failed');
  const extra={
    'canvas.interactionProfilingTestApi':['applicationThemeStateForTest','historyState'],
    'constraints.constraintModelTestApi':['historyState'],
    'blocks.blockTestActions':['drawnPointMarkerCountForTest','historyState'],
  };
  function node(path) {
    if(nodes.has(path))return nodes.get(path);
    const capability=function(...args){calls.push({path,receiver:this,args});return state.value;};
    const result=new Proxy(capability,{
      get(target,key){if(typeof key==='symbol')return Reflect.get(target,key);events.push(path+'.'+key);if(state.failure===path+'.'+key)throw marker;
        const own=Reflect.getOwnPropertyDescriptor(target,key);if(own&&!own.configurable&&!own.writable)return Reflect.get(target,key);return node(path+'.'+key);},
      ownKeys(target){events.push('spread:'+path);return [...Reflect.ownKeys(target),'sharedSpread','spread:'+path,...(collisions?extra[path]||[]:[])];},
      getOwnPropertyDescriptor(target,key){return Reflect.getOwnPropertyDescriptor(target,key)||{enumerable:true,configurable:true,get(){return node(path+'.'+key);}};},
    });nodes.set(path,result);return result;
  }
  const groups=Object.fromEntries(['canvas','splines','authoring','constraints','clipboard','documents','derived','sketches','images','dimensions','parameters','properties','annotations','blocks'].map(key=>[key,node(key)]));
  return{w,state,events,calls,nodes,marker,groups,create:()=>w.BrowserTestApi.create(groups)};
}

function propertiesContractFixture(collisions=false) {
  const f=fixture({collisions}),body=source.slice(source.indexOf('function create('),source.indexOf('function createWithProperties'));
  const keys=group=>[...new Set(Array.from(body.matchAll(new RegExp(group+'\\.([A-Za-z_$][A-Za-z0-9_$]*)','g')),match=>match[1]))];
  const shared=['themeObservation','hoverDisplayObservation','strokeStyleCases'];
  const canvas=Object.freeze(Object.fromEntries(keys('canvas').filter(key=>!shared.includes(key)).map(key=>[key,f.groups.canvas[key]])));
  const selectionTestApi=f.groups.properties.selectionTestApi;
  const propertyFields=Object.fromEntries(keys('properties').filter(key=>key!=='selectionTestApi').map(key=>[key,f.groups.properties[key]]));
  const properties=Object.freeze({...propertyFields,...Object.fromEntries(shared.map(key=>[key,f.groups.canvas[key]])),appearanceTestAction:{set(){assert.fail('no test action during API assembly');}}});
  const legacy=Object.freeze({...f.groups,canvas:{...canvas,...Object.fromEntries(shared.map(key=>[key,properties[key]]))},properties:{...propertyFields,selectionTestApi}});
  const owned=Object.freeze({...f.groups,canvas,properties,selectionTestApi});f.events.length=0;
  return{...f,legacy,owned};
}

test('Properties cohort mapping preserves every public key, descriptor, function identity, lookup order and collision precedence',()=>{
  for(const collisions of [false,true]){
    const f=propertiesContractFixture(collisions),before=f.w.BrowserTestApi.create(f.legacy),events=f.events.slice();f.events.length=0;
    const after=f.w.BrowserTestApi.createWithProperties(f.owned);
    assert.deepEqual(Object.keys(after),Object.keys(before));assert.deepEqual(Object.getOwnPropertyDescriptors(after),Object.getOwnPropertyDescriptors(before));
    assert.deepEqual(f.events,events);assert.deepEqual(f.calls,[]);assert.equal(Object.hasOwn(f.w,'__jot2dTest'),false);
    f.state.value={id:'live replacement'};const argument={};assert.equal(after.multiplePropertiesStateForTest(argument),f.state.value);
    assert.equal(f.calls.at(-1).receiver,after);assert.equal(f.calls.at(-1).args[0],argument);
    assert.equal(Object.hasOwn(after,'appearanceTestAction'),false);assert.equal(Object.isFrozen(after),false);
  }
});

test('Properties cohort mapping propagates the original capability error at the same public lookup without publishing',()=>{
  for(const failure of ['canvas.themeObservation.state','properties.propertiesObservation.state','properties.sidebarHighlightObservation.ids']){
    const f=propertiesContractFixture();f.state.failure=failure;
    assert.throws(()=>f.w.BrowserTestApi.create(f.legacy),error=>error===f.marker);const events=f.events.slice();f.events.length=0;
    assert.throws(()=>f.w.BrowserTestApi.createWithProperties(f.owned),error=>error===f.marker);
    assert.deepEqual(f.events,events);assert.deepEqual(f.calls,[]);assert.equal(Object.hasOwn(f.w,'__jot2dTest'),false);
  }
});

test('browser contract creates only the public surface and keeps captured functions, live results and method receivers',()=>{
  const f=fixture();assert.equal(Object.isFrozen(f.w.BrowserTestApi),true);assert.deepEqual(f.events,[]);
  const api=f.create();assert.deepEqual(f.calls,[]);assert.equal(Object.hasOwn(f.w,'__jot2dTest'),false);
  const names={applicationThemeStateForTest:'canvas.themeObservation.state',resetForSplineTest:'splines.splineTestDriver.reset',
    referenceImageStateForTest:'images.referenceImageTestObservation.state',importReferenceImageDataForTest:'images.referenceImageTestImport.importData',
    openReferenceImageBlockEditorForTest:'images.referenceImageBlockFixture.open',parameterStateForTest:'parameters.parameterObservation.state',
    constraintInputStateForTest:'constraints.constraintInputObservation.state',resolveConstraintIntentForTest:'constraints.constraintIntentTestDriver.resolve',
    angleDimensionLabelFollowCase:'dimensions.dimensionFixtureSupport.angleDimensionLabelFollowCase',historyState:'documents.readTestHistory',
    resetForTrimConstraintTransfer:'authoring.trimLineTransferFixture.reset',resetForSketchDeletion:'sketches.sketchDeletionFixture.reset',
    drawnPointMarkerCountForTest:'canvas.canvasRenderProbe.pointMarkerCount',sidebarHighlightIds:'properties.sidebarHighlightObservation.ids',
    currentSidebarHoveredGeometryKeys:'properties.sidebarHoverKeyObservation.keys'};
  for(const [name,path]of Object.entries(names)) {
    assert.equal(api[name],f.nodes.get(path),name);assert.deepEqual(Object.getOwnPropertyDescriptor(api,name),{value:api[name],enumerable:true,writable:true,configurable:true});
  }
  assert.equal(Object.isExtensible(api),true);assert.equal(Object.isFrozen(api),false);
  const current={id:'replacement'};f.state.value=current;const argument={probe:true};assert.equal(api.parameterStateForTest(argument),current);
  assert.equal(f.calls[0].receiver,api);assert.equal(f.calls[0].args[0],argument);
  api.localDiagnostic=1;delete api.localDiagnostic;const again=f.create();assert.notEqual(again,api);assert.equal(again.parameterStateForTest,api.parameterStateForTest);
  assert.equal(Object.keys(api).includes('groups'),false);assert.equal(Object.keys(api).includes('canvas'),false);
});

test('spread getters and overrides keep their legacy relative order, insertion positions and ordinary data descriptors',()=>{
  const f=fixture({collisions:true}),api=f.create();assert.deepEqual(f.calls,[]);
  assert.equal(api.sharedSpread,f.nodes.get('blocks.blockTestActions.sharedSpread'));
  assert.equal(api.applicationThemeStateForTest,f.nodes.get('canvas.interactionProfilingTestApi.applicationThemeStateForTest'));
  assert.equal(api.historyState,f.nodes.get('blocks.blockTestActions.historyState'));
  assert.equal(api.drawnPointMarkerCountForTest,f.nodes.get('blocks.blockTestActions.drawnPointMarkerCountForTest'));
  assert.equal(Object.keys(api)[0],'applicationThemeStateForTest');
  const order=['canvas.themeObservation.state','spread:canvas.interactionProfilingTestApi','canvas.interactionProfilingTestApi.applicationThemeStateForTest',
    'spread:constraints.constraintModelTestApi','documents.readTestHistory','canvas.canvasRenderProbe.pointMarkerCount','spread:blocks.blockTestActions','properties.sidebarHoverKeyObservation.keys'];
  let previous=-1;for(const path of order){const index=f.events.indexOf(path);assert.ok(index>previous,path);previous=index;}
  assert.equal(Object.getOwnPropertyDescriptor(api,'sharedSpread').get,undefined);
  assert.equal(Object.getOwnPropertyDescriptor(api,'sharedSpread').writable,true);
  assert.equal(f.events.filter(path=>path==='documents.readTestHistory').length,1);
});

test('a failed capability read preserves the prior published API and stops at the original read boundary',()=>{
  const baseline=fixture();baseline.create();
  for(const path of ['canvas.themeObservation.state','annotations.fixtures','properties.sidebarHoverKeyObservation.keys']) {
    const f=fixture(),previous={prior:true};f.w.__jot2dTest=previous;f.state.failure=path;
    assert.throws(()=>{f.w.__jot2dTest=f.create();},error=>error===f.marker);
    assert.equal(f.w.__jot2dTest,previous);assert.deepEqual(f.calls,[]);assert.equal(f.events.at(-1),path);
    assert.deepEqual(f.events,baseline.events.slice(0,f.events.length));
    f.state.failure=null;f.w.__jot2dTest=f.create();assert.notEqual(f.w.__jot2dTest,previous);
  }
});
function derivedBrowserFixture(composed, config = {}) {
  const context = { window:{}, structuredClone }; vm.createContext(context);
  const sources = vm.runInNewContext(fs.readFileSync('index.html','utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
  for (const file of sources.filter(p=>p.startsWith('src/'))) vm.runInContext(fs.readFileSync(file,'utf8'), context, { filename:file });
  const w = context.window, calls = [], selection = w.CanvasSelection.create(), geometryIds = w.GeometryIds.create(), documentIds = w.DocumentIds.create();
  const state = { ready:false, scope:w.DocumentState.create(), failure:null };
  const ready = () => assert.equal(state.ready, true), currentScope = () => { ready(); return state.scope; };
  const geometry = w.GeometryCreation.create({ currentScope, ids:geometryIds, assignSketchId:item=>{item.sketchId=state.scope.activeSketchId;},
    currentConstruction:()=>false, minLineLength:1e-6, minArcLength:1e-6 });
  const note = name => (...args) => { ready(); calls.push([name,...args]); };
  const resetModelState = () => { ready(); calls.push(['reset']); state.scope=w.DocumentState.create(); geometryIds.reset(); documentIds.reset(); selection.clear(); };
  const serializeModel = () => { ready(); return JSON.parse(JSON.stringify(state.scope)); };
  const bundle = () => { ready(); if(state.failure)throw state.failure; return {valid:true,reason:'',points:state.scope.points,lines:state.scope.lines,circles:state.scope.circles,arcs:state.scope.arcs}; };
  const document = { querySelectorAll:()=>{ready();return state.scope.geometryInstances;},getElementById:id=>{ready();return{textContent:id};} };
  const canvasTestDriver = { focus:function(){'use strict';assert.equal(this,undefined);ready();calls.push(['focus',...arguments]);},
    clientPosition:function(point){'use strict';assert.equal(this,undefined);ready();return{x:point.x+10,y:point.y+20};} };
  const catalogIds = { allocate(kind) { ready(); assert.equal(this,catalogIds); calls.push(['allocate',kind]); return documentIds.allocate(kind); } };
  const hatchGeometryQuery = { get hatchPrimitivesForScope(){if(config.constructError)throw config.constructError;return()=>[];}, resolvedHatchBoundary:()=>({ok:true}) };
  const presentation = {updateUI:note('ui'),draw:note('draw')}, sketchPresentation={constraintStatusColor:()=> '#123456'};
  const normalizeGeometryInstance=raw=>({...raw}),loadModelData=data=>{ready();state.scope=data;calls.push(['load']);};
  const deleteElements=({lines})=>{ready();state.scope.lines=state.scope.lines.filter(line=>!lines.includes(line));calls.push(['delete-source']);return true;};
  const deleteCurrentSelection=()=>{ready();state.scope.geometryInstances=state.scope.geometryInstances.filter(item=>!selection.geometryInstances.includes(item));calls.push(['delete-instance']);return true;};
  const resetHistory=note('history'),activeSketchId=()=>{ready();return state.scope.activeSketchId;};
  const inputs={documentWorkspace:{workspace:{current:currentScope},sketches:{activeSketchId},documentIds:catalogIds},geometry,
    readServices:{reads:{geometryInstanceBundle:bundle}},interaction:{selection},presentation,canvasTestDriver,document,hatchGeometryQuery,sketchPresentation,
    resetModelState,resetHistory,serializeModel,loadModelData,deleteElements,deleteCurrentSelection,normalizeGeometryInstance};
  const raw={resetModelState,...geometry,focus:canvasTestDriver.focus,clientPosition:canvasTestDriver.clientPosition,resetHistory,...presentation,currentScope,
    serializeModel,geometryInstanceBundle:bundle,constraintStatusColor:sketchPresentation.constraintStatusColor,arcSweep:w.GeometryKernel.arcSweep,
    canvasSelection:selection,resolvedHatchBoundary:hatchGeometryQuery.resolvedHatchBoundary,document,loadModelData,deleteElements,deleteCurrentSelection,
    DEFAULT_SKETCH_ID:w.SketchHierarchy.DEFAULT_SKETCH_ID,DEFAULT_HATCH_APPEARANCE:w.Appearance.DEFAULT_HATCH_APPEARANCE,normalizeGeometryInstance,activeSketchId,
    geometryRefForItem:w.GeometryObjects.geometryRefForItem,parseGeometryRefId:w.GeometryRef.parseId,hatchGeometryQuery,
    nextProjectionId:()=>catalogIds.allocate('sketchProjection'),nextMirrorId:()=>catalogIds.allocate('mirror'),nextPatternId:()=>catalogIds.allocate('pattern')};
  if(config.probe)Object.assign(config.probe,{state,calls,selection,document:state.scope,w});
  const api=composed?w.DerivedInstanceTestDriver.createForWorkspace(inputs):w.DerivedInstanceTestDriver.createBrowserApi(raw);
  assert.deepEqual(calls,[]);assert.equal(Object.hasOwn(w,'__jot2dTest'),false);state.ready=true;
  return{api,w,state,calls,selection,inputs};
}

test('derived browser owner assembly stays cold and keeps the same six public capabilities and bare canvas callbacks',()=>{
  const traces=[];
  for(const composed of [false,true]){
    const f=derivedBrowserFixture(composed);assert.equal(Object.isFrozen(f.api),true);
    assert.deepEqual(Object.keys(f.api),['loadModelForDerivedInstanceTest','resetForDerivedInstanceTest','resetForGeometryInstanceCommandTest','derivedInstanceStateForTest','deleteDerivedSourceForTest','deleteDerivedInstanceForTest']);
    const result=f.api.resetForGeometryInstanceCommandTest();assert.equal(f.state.scope.lines.length,3);assert.equal(result.sourceId,f.state.scope.lines[0].id);
    assert.deepEqual(JSON.parse(JSON.stringify(result.axis)),{x:10,y:20});
    traces.push(JSON.stringify({result,calls:f.calls,scope:f.state.scope}));
  }assert.equal(traces[1],traces[0]);
});

test('derived browser owner assembly shares live Workspace, geometry IDs, instance allocation, Selection and state/deletion traces',()=>{
  const traces=[];
  for(const composed of [false,true]){
    const f=derivedBrowserFixture(composed),result=f.api.resetForDerivedInstanceTest();assert.equal(result.instances.length,3);
    assert.deepEqual(f.calls.filter(c=>c[0]==='allocate').map(c=>c[1]),['sketchProjection','mirror','pattern']);
    assert.equal(f.state.scope.geometryInstances[0].sketchId,'S2');
    const id=f.state.scope.geometryInstances[1].id;assert.equal(f.api.deleteDerivedInstanceForTest(id).deleted,true);assert.equal(f.selection.geometryInstances[0].id,id);
    assert.equal(f.state.scope.geometryInstances.length,2);assert.equal(f.api.deleteDerivedSourceForTest().deleted,true);
    const old=f.state.scope,source=f.w.DocumentState.create(),loaded=f.api.loadModelForDerivedInstanceTest(source);
    assert.notEqual(f.state.scope,source);assert.notEqual(f.state.scope,old);assert.equal(loaded.instances.length,0);
    traces.push(JSON.stringify({result,calls:f.calls,loaded,old}));
  }assert.equal(traces[1],traces[0]);
});

test('derived browser owner assembly preserves constructor and observation error identity without publishing or mutating state',()=>{
  for(const composed of [false,true]){
    const marker=new Error('hatch query failed'),probe={};
    assert.throws(()=>derivedBrowserFixture(composed,{constructError:marker,probe}),error=>error===marker);
    assert.deepEqual(probe.calls,[]);assert.equal(probe.state.ready,false);assert.equal(probe.state.scope,probe.document);assert.equal(probe.selection.hasSelection(),false);assert.equal(Object.hasOwn(probe.w,'__jot2dTest'),false);
    const f=derivedBrowserFixture(composed);f.api.resetForDerivedInstanceTest();f.state.failure=marker;const scope=f.state.scope,before=JSON.stringify(scope);
    assert.throws(()=>f.api.derivedInstanceStateForTest(),error=>error===marker);assert.equal(f.state.scope,scope);assert.equal(JSON.stringify(scope),before);
  }
});

function supportRecordContractFixture(collisions = false) {
  const f = propertiesContractFixture(collisions);
  const data = (parent, keys) => Object.freeze(Object.fromEntries(keys.map(key => [key, parent[key]])));
  const splines = data(f.groups.splines, ['splineTestDriver', 'splineTransferDriver']);
  const authoring = data(f.groups.authoring, ['hatchTestApi', 'drawingOrderTestApi', 'offsetTestSupport', 'trimLineTransferFixture', 'trimConstructionFixture', 'trimDiameterFixture']);
  const images = data(f.groups.images, ['referenceImageTestObservation', 'referenceImageTestImport', 'referenceImageBlockFixture']);
  const parameters = data(f.groups.parameters, ['parameterFixture', 'parameterObservation', 'parameterInteraction']);
  const sketchValues = data(f.groups.sketches, ['referenceLineMove', 'dependencyOrderFixture', 'sketchProjectionTestSupport', 'sketchTreeTestApi', 'sketchDeletionFixture']);
  const references = Object.freeze({ referenceLineMove: sketchValues.referenceLineMove, dependencyOrderFixture: sketchValues.dependencyOrderFixture,
    ...(collisions ? { sketchProjectionTestSupport: f.groups.derived, sketchDeletionFixture: f.groups.clipboard } : {}) });
  const sketches = Object.freeze({ ...references, sketchProjectionTestSupport: sketchValues.sketchProjectionTestSupport,
    sketchTreeTestApi: sketchValues.sketchTreeTestApi, sketchDeletionFixture: sketchValues.sketchDeletionFixture });
  const legacy = Object.freeze({ ...f.owned, splines, authoring, images, parameters, sketches });
  const records = Object.freeze({ ...legacy,
    canvas: Object.freeze({ support: Object.freeze({ interactionProfilingTestApi: legacy.canvas.interactionProfilingTestApi,
      display: legacy.canvas.canvasTestDriver, viewObservation: legacy.canvas.viewObservation, authoringObservation: legacy.canvas.authoringObservation,
      rendering: legacy.canvas.canvasRenderingTestSupport }), responsiveDragFixture: legacy.canvas.responsiveDragFixture,
      dragExecutionSupport: legacy.canvas.dragExecutionSupport, canvasRenderProbe: legacy.canvas.canvasRenderProbe }),
    splines: Object.freeze({ setup: splines.splineTestDriver, transfer: splines.splineTransferDriver }),
    authoring: Object.freeze({ hatchTestApi: authoring.hatchTestApi, drawingOrderTestApi: authoring.drawingOrderTestApi, offsetTestSupport: authoring.offsetTestSupport,
      trim: Object.freeze({ lineTransfer: authoring.trimLineTransferFixture, constructionBoundary: authoring.trimConstructionFixture, diameterTransfer: authoring.trimDiameterFixture }) }),
    constraints: Object.freeze({ readStatuses() { assert.fail('no status read during publication'); }, constraints: legacy.constraints, referenceCases: references }),
    documents: Object.freeze({ documents: legacy.documents, sketchDeletionFixture: sketches.sketchDeletionFixture }),
    sketches: Object.freeze({ sketchProjectionTestSupport: sketches.sketchProjectionTestSupport, sketchTreeTestApi: sketches.sketchTreeTestApi }),
    images: Object.freeze({ observation: images.referenceImageTestObservation, dataImport: images.referenceImageTestImport, blockFixture: images.referenceImageBlockFixture }),
    parameters: Object.freeze({ fixture: parameters.parameterFixture, observation: parameters.parameterObservation, interaction: parameters.parameterInteraction }),
  });
  f.events.length = 0;
  return { ...f, legacy, records };
}

test('support-record publication preserves the whole public contract, lookup order, collision precedence and live callback receivers', () => {
  for (const collisions of [false, true]) {
    const f = supportRecordContractFixture(collisions), receiver = {};
    const before = f.w.BrowserTestApi.createWithProperties.call(receiver, f.legacy), events = f.events.slice(); f.events.length = 0;
    const after = f.w.BrowserTestApi.createFromSupportRecords.call(receiver, f.records);
    assert.deepEqual(Reflect.ownKeys(after), Reflect.ownKeys(before));
    assert.deepEqual(Object.getOwnPropertyDescriptors(after), Object.getOwnPropertyDescriptors(before));
    assert.equal(Object.getPrototypeOf(after), Object.getPrototypeOf(before)); assert.deepEqual(f.events, events); assert.deepEqual(f.calls, []);
    assert.equal(Object.hasOwn(f.w, '__jot2dTest'), false); assert.equal(Object.isFrozen(after), false);
    f.state.value = { id: 'replacement' }; const args = [{}, 'extra'];
    for (const key of ['resetForSplineTest', 'resetForTrimConstraintTransfer', 'parameterStateForTest', 'referenceImageStateForTest', 'constraintInputStateForTest', 'historyState']) {
      assert.equal(after[key](...args), f.state.value); assert.equal(f.calls.at(-1).receiver, after); assert.deepEqual(f.calls.at(-1).args, args);
    }
  }
});

test('support-record publication preserves original capability failures at the same lookup without calling actions or publishing', () => {
  for (const failure of ['canvas.viewObservation.state', 'parameters.parameterObservation.state', 'images.referenceImageTestObservation.state', 'properties.sidebarHighlightObservation.ids']) {
    const f = supportRecordContractFixture(); f.state.failure = failure;
    assert.throws(() => f.w.BrowserTestApi.createWithProperties(f.legacy), error => error === f.marker);
    const events = f.events.slice(); f.events.length = 0;
    assert.throws(() => f.w.BrowserTestApi.createFromSupportRecords(f.records), error => error === f.marker);
    assert.deepEqual(f.events, events); assert.deepEqual(f.calls, []); assert.equal(Object.hasOwn(f.w, '__jot2dTest'), false);
  }
});


test('browser installation reads the current URL only when invoked, skips ordinary startup, and publishes the actual completed API', () => {
  const f=supportRecordContractFixture(),events=[],state={search:'?contest=1',published:{prior:true}},old=state.published;
  const browser={get URLSearchParams(){events.push('parser');return URLSearchParams;},get location(){events.push('location');return{get search(){events.push('search');return state.search;}};},
    get __jot2dTest(){return state.published;},set __jot2dTest(api){events.push('publish');state.published=api;}};
  let created,calls=0;
  function createApi(){'use strict';assert.equal(this,undefined);assert.equal(arguments.length,0);calls++;events.push('create');assert.equal(browser.__jot2dTest,old);return created=f.w.BrowserTestApi.createFromSupportRecords(f.records);}
  assert.deepEqual(events,[]);assert.deepEqual(f.calls,[]);
  assert.equal(f.w.BrowserTestApi.installForBrowser(browser,createApi),undefined);assert.equal(calls,0);assert.equal(state.published,old);assert.deepEqual(events,['parser','location','search']);
  state.search='?test=0';events.length=0;assert.equal(f.w.BrowserTestApi.installForBrowser(browser,createApi),undefined);
  assert.equal(calls,1);assert.equal(state.published,created);assert.equal(Object.isFrozen(created),false);assert.deepEqual(events,['parser','location','search','create','publish']);
  assert.deepEqual(f.calls,[]);f.state.value={replacement:true};const args=[{},'extra'];assert.equal(created.historyState(...args),f.state.value);assert.equal(f.calls.at(-1).receiver,created);assert.deepEqual(f.calls.at(-1).args,args);
});

test('browser installation retains native query presence rules and rechecks the URL without caching or deleting an earlier API', () => {
  const f=fixture(),browser={URLSearchParams,location:{search:''},__jot2dTest:{prior:true}};let count=0,expected=0;
  const create=()=>({generation:++count});
  for(const search of ['', '?contest=1','?TEST=1','?x=test']){browser.location.search=search;const before=browser.__jot2dTest;f.w.BrowserTestApi.installForBrowser(browser,create);assert.equal(browser.__jot2dTest,before);assert.equal(count,0);}
  for(const search of ['?test','?test=','?test=false','?%74est=1','?test=0&test=1']){browser.location.search=search;assert.equal(f.w.BrowserTestApi.installForBrowser(browser,create),undefined);assert.equal(browser.__jot2dTest.generation,++expected);}
  const previous=browser.__jot2dTest;browser.location.search='';f.w.BrowserTestApi.installForBrowser(browser,create);assert.equal(browser.__jot2dTest,previous);assert.equal(count,expected);
});

test('browser installation propagates gate, construction and publication failures while retaining existing partial effects', () => {
  const f=supportRecordContractFixture(),marker=new Error('installation failed'),old={prior:true};let calls=0;
  const build=()=>{calls++;return f.w.BrowserTestApi.createFromSupportRecords(f.records);};
  for(const stage of ['parser','location','search']){
    const browser={get URLSearchParams(){if(stage==='parser')throw marker;return URLSearchParams;},get location(){if(stage==='location')throw marker;return{get search(){throw marker;}};},__jot2dTest:old};
    assert.throws(()=>f.w.BrowserTestApi.installForBrowser(browser,build),error=>error===marker);assert.equal(calls,0);assert.equal(browser.__jot2dTest,old);
  }
  const browser={URLSearchParams,location:{search:'?test=1'},__jot2dTest:old};f.state.failure='parameters.parameterObservation.state';
  assert.throws(()=>f.w.BrowserTestApi.installForBrowser(browser,build),error=>error===f.marker);assert.equal(calls,1);assert.equal(browser.__jot2dTest,old);assert.deepEqual(f.calls,[]);
  f.state.failure=null;Object.defineProperty(browser,'__jot2dTest',{get:()=>old,set(){throw marker;}});
  assert.throws(()=>f.w.BrowserTestApi.installForBrowser(browser,build),error=>error===marker);assert.equal(calls,2);assert.equal(browser.__jot2dTest,old);assert.deepEqual(f.calls,[]);
});
