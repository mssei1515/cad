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
