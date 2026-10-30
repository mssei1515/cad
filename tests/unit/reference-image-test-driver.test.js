const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test');
function fixture(){
 const sandbox={window:{},structuredClone};vm.createContext(sandbox);
 const sources=vm.runInNewContext(fs.readFileSync('index.html','utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
 for(const file of sources.filter(p=>p.startsWith('src/')))vm.runInContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
 const w=sandbox.window,events=[],state={ready:false,scope:{referenceImages:[]},editor:null,live:null,count:0,dragging:false,history:{index:1},viewport:{scale:2},
  failure:null,result:{imported:true},model:{blockDefinitions:[{id:'BD1',referenceImages:[]}]}},selection=w.CanvasSelection.create(),blob={bytes:'image'};
 const ready=()=>assert.equal(state.ready,true,'no eager state, image or DOM operations');
 class File {constructor(parts,name,{type}){ready();events.push('file');if(state.failure==='file')throw marker;assert.equal(parts[0],blob);this.parts=parts;this.name=name;this.type=type;}}
 const marker=new Error('image boundary failed');
 const feature=Object.freeze({interaction:Object.freeze({get calibrationPointCount(){ready();return state.count;},get dragging(){ready();return state.dragging;}}),
  input:Object.freeze({importFile:function(file){'use strict';assert.equal(this,undefined);events.push(['import',file]);if(state.failure==='import')throw marker;return state.result;}})});
 const session=Object.freeze({get current(){ready();return state.editor;},live:()=>{ready();events.push('live');return state.live||state.editor;}});
 const blocks=Object.freeze({session,editing:Object.freeze({empty:function(name){'use strict';ready();assert.equal(this,undefined);events.push('empty');return {name,points:[],lines:[],referenceImages:[]};}})});
 const viewport={snapshot(){ready();assert.equal(this,viewport);return state.viewport;}};
 const api=w.ReferenceImageTestDriver.createBrowserSupport({feature,blocks,canvasSelection:selection,currentScope:()=>{ready();return state.scope;},readHistory:()=>{ready();return state.history;},viewport,
  fetch:async function(url){'use strict';ready();assert.equal(this,undefined);events.push(['fetch',url]);if(state.failure==='fetch')throw marker;return {blob:async()=>{events.push('blob');if(state.failure==='blob')throw marker;return blob;}};},File,
  resetModelState:()=>{ready();events.push('reset');},openBlockDefinitionEditor:(draft,options)=>{ready();events.push(['open',options]);state.editor=draft;},
  completeBlockDefinitionEdit:options=>{ready();events.push(['complete',options]);if(state.failure==='complete')throw marker;},serializeModel:()=>{ready();events.push('serialize');return state.model;}});
 assert.deepEqual(events,[]);assert.equal(Object.isFrozen(api),true);state.ready=true;return {api,state,selection,events,marker,w};
}

test('reference image support observes current selection, scope and live Block images with the same interaction, history and viewport',()=>{
 const f=fixture(),a={id:'IMG1',name:'first'},b={id:'IMG2',name:'second'};f.state.scope.referenceImages=[a];f.selection.set('referenceImages',[a]);
 let result=f.api.observation.state();assert.deepEqual(Array.from(result.selectedIds),['IMG1']);assert.equal(result.images[0].id,'IMG1');assert.equal(result.liveBlockImages.length,0);
 assert.equal(result.history,f.state.history);assert.equal(result.viewport,f.state.viewport);assert.deepEqual(f.events,[]);
 f.state.scope={referenceImages:[b]};f.state.editor={};f.state.live={referenceImages:[a]};f.state.count=2;f.state.dragging=true;
 result=f.api.observation.state();assert.equal(result.images[0].id,'IMG2');assert.equal(result.liveBlockImages[0].id,'IMG1');assert.equal(result.calibrationPointCount,2);assert.equal(result.dragging,true);
 assert.deepEqual(Array.from(result.selectedIds),['IMG1']);assert.deepEqual(f.events,['live']);assert.equal(a.id,'IMG1');
});

test('reference image data import preserves fetch, Blob, File and unbound importer order, names and each error identity',async()=>{
 const f=fixture(),url='data:image/png;base64,AA==';assert.equal(await f.api.dataImport.importData(url),f.state.result);
 assert.deepEqual(f.events.slice(0,3),[['fetch',url],'blob','file']);let file=f.events[3][1];assert.equal(file.name,'image.png');assert.equal(file.type,'image/png');
 f.events.length=0;await f.api.dataImport.importData(url,'custom.webp','image/webp');file=f.events[3][1];assert.equal(file.name,'custom.webp');assert.equal(file.type,'image/webp');
 for(const failure of ['fetch','blob','file','import']){f.state.failure=failure;f.events.length=0;await assert.rejects(f.api.dataImport.importData(url),error=>error===f.marker);
  assert.equal(f.events.length,['fetch','blob','file','import'].indexOf(failure)+1);assert.equal(f.state.scope.referenceImages.length,0);}
});

test('reference image Block fixture preserves reset suppression, actual Geometry identity and clone-after-completion failure boundaries',()=>{
 const f=fixture();assert.equal(f.api.blockFixture.open(),true);assert.deepEqual(f.events.map(e=>Array.isArray(e)?e[0]:e),['reset','empty','open']);
 const draft=f.state.editor;assert.equal(draft.name,'Image Block');assert.equal(draft.points[0] instanceof f.w.GeometrySolver.Point,true);assert.equal(draft.lines[0] instanceof f.w.GeometrySolver.Line,true);
 assert.equal(draft.lines[0].p1,draft.points[0]);assert.equal(draft.lines[0].p2,draft.points[1]);assert.equal(draft.lines[0].length(),40);assert.equal(draft.lines[0].sketchId,'S1');assert.equal(draft.lines[0].construction,false);
 f.events.length=0;f.api.blockFixture.open({preserveDocument:true});assert.deepEqual(f.events.map(e=>Array.isArray(e)?e[0]:e),['empty','open']);
 f.events.length=0;const result=f.api.blockFixture.complete();assert.notEqual(result,f.state.model);assert.notEqual(result.blockDefinitions,f.state.model.blockDefinitions);
 assert.equal(f.events[0][1].rotationLocked,true);assert.deepEqual(f.events.map(e=>Array.isArray(e)?e[0]:e),['complete','serialize']);
 f.state.failure='complete';f.events.length=0;assert.throws(()=>f.api.blockFixture.complete(),error=>error===f.marker);assert.deepEqual(f.events.map(e=>Array.isArray(e)?e[0]:e),['complete']);
});
