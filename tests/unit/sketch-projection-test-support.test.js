const assert = require('node:assert/strict'); const fs = require('node:fs');
const path = require('node:path'); const vm = require('node:vm'); const test = require('node:test');
const sandbox = { window: {}, structuredClone }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/sketch_projection_test_driver.js'), 'utf8'), sandbox);
function fixture() {
  class Point { constructor(id,x,y) { Object.assign(this,{id,x,y}); } } class Line {} class Circle {} class Arc {} class Spline {}
  const events = [], state = { scope: { sketches: [] }, constraints: [], mode: 'select', staged: 0, data: { version: 26, constraints: [] }, history: {}, selected: null, properties: 'initial' };
  const ports = { types: { Point, Line, Circle, Arc, Spline }, currentScope: () => { events.push('scope'); return state.scope; },
    readMode: () => state.mode, readStagedCount: () => state.staged, readConstraints: () => state.constraints,
    constraintGeometryId: item => item.id, constraintSketchId: item => item.sketchId, effectiveAppearanceForElement: () => ({ color: 'black' }), geometryDisplayColor: () => 'black',
    constraintStatusOf: () => 'under', constraintStatusColor: () => 'blue', constraintIsRedundant: () => false,
    serializeModel: () => { events.push('serialize'); return state.data; }, readHistory: () => state.history,
    document: { getElementById: id => ({ textContent: id === 'propertiesPanel' ? state.properties : 'tree' }) },
    CURRENT_JSON_VERSION: 26, loadModelData: data => { events.push(['load',data.version]); state.data = data; }, updateUI: () => events.push('ui'), draw: () => events.push('draw'),
    clearSelection: () => events.push('clear'), canvasSelection: { set(field, values) { state.selected = { field, values }; events.push(['select',field]); } },
    clientPosition: point => ({ x: point.x + 10, y: point.y + 20 }),
    copySelectionToClipboard: () => { events.push('copy'); return true; }, pasteGeometryClipboard: () => { events.push('paste'); return true; }, clipboardSession: { payload: { constraints: [{ type: 'sketchProjection' }] } },
  };
  const support = sandbox.window.SketchProjectionTestDriver.createSupport(ports); assert.deepEqual(events, []);
  return { support, state, ports, events, Point };
}

test('projection support preserves all ordered public entries and performs no eager model reads', () => {
  const f = fixture();
  assert.deepEqual(Object.keys(f.support), [
    'resetForSketchProjectionTest', 'resetForSketchProjectionRectangleTest', 'resetForSketchProjectionSharedKindsTest', 'sketchProjectionEligibilityForTest',
    'resetForSketchProjectionBlockEditorTest', 'completeSketchProjectionBlockEditorForTest', 'resetForBlockProjectionSketchProjectionTest',
    'moveBlockProjectionSketchProjectionSourceForTest', 'deleteBlockProjectionSketchProjectionSourceForTest', 'sketchProjectionStateForTest',
    'moveSketchProjectionSourcesForTest', 'createSketchProjectionChainForTest', 'selectSketchProjectionTargetForTest', 'removeFirstSketchProjectionConstraintForTest',
    'setSketchProjectionAppearanceForTest', 'deleteSketchProjectionSourceGeometryForTest', 'deleteSketchProjectionTargetGeometryForTest', 'deleteSketchProjectionSourceSketchForTest',
    'copySketchProjectionTargetForTest', 'blockizeSketchProjectionTargetForTest', 'reloadSketchProjectionForTest',
  ]);
  assert.equal(Object.isFrozen(f.support), true); for (const value of Object.values(f.support)) assert.equal(typeof value, 'function');
  f.state.mode = 'sketch-project'; f.state.staged = 3; f.state.scope = { sketches: [{ id: 'S3', parentSketchId: 'S2' }] };
  const snapshot = f.support.sketchProjectionStateForTest(); assert.equal(snapshot.mode, 'sketch-project'); assert.equal(snapshot.stagedCount, 3); assert.equal(snapshot.sketches[0].id, 'S3');
  assert.equal(snapshot.history, f.state.history); assert.notEqual(snapshot.serialized, f.state.data);
});

test('projection reload and selection/transfer reuse the shared live observation', () => {
  const f = fixture(); f.state.properties = 'latest';
  const source = new f.Point('P1',0,0), target = new f.Point('P2',4,5);
  f.state.constraints = [{ kind: 'point', source, target, sketchId: 'S3', referenceSketchId: 'S2' }];
  const selected = f.support.selectSketchProjectionTargetForTest('point');
  assert.equal(selected.targetId, 'P2'); assert.equal(selected.propertiesText, 'latest'); assert.equal(selected.client.x, 14);
  assert.equal(f.state.selected.field, 'points'); assert.equal(f.state.selected.values[0], target);
  f.events.length = 0; const copied = f.support.copySketchProjectionTargetForTest('point');
  assert.equal(copied.copied, true); assert.equal(copied.pasted, true); assert.equal(copied.clipboardProjectionCount, 1);
  assert.ok(f.events.indexOf('copy') < f.events.indexOf('paste'));
  f.events.length = 0; const reloaded = f.support.reloadSketchProjectionForTest(25);
  assert.deepEqual(f.events.slice(0,4), ['serialize', ['load',25], 'ui', 'draw']);
  assert.equal(reloaded.serialized.version, 25); assert.equal(reloaded.propertiesText, 'latest');
});
const ownerSandbox={window:{}};vm.createContext(ownerSandbox);
for(const file of ['src/geometry/geometry_kernel.js','src/geometry/spline_geometry.js','src/solver/constraint_solver.js','src/geometry/geometry_ref.js','src/geometry/objects.js','src/document/appearance.js','src/document/sketch_hierarchy.js','src/editing/geometry_ids.js','src/editing/geometry_creation.js','src/editing/selection.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ownerSandbox);
Object.assign(sandbox.window,ownerSandbox.window);
function browserOwnersFixture(composed,failure){
  'use strict';
  const f=fixture(),w=sandbox.window,G=w.GeometrySolver,events=f.events,marker=new Error('browser projection support failure'),extra={block:null,id:0};
  const check=name=>{if(failure===name)throw marker;};
  const effect=name=>(...args)=>{check(name);events.push([name,...args]);};
  const empty=()=>({points:[],lines:[],circles:[],arcs:[],splines:[],constraints:[],annotations:[],hatches:[],geometryInstances:[],blockDefinitions:[],blockInstances:[],activeSketchId:'S1',sketches:[{id:'ROOT',parentSketchId:null},{id:'S1',parentSketchId:'ROOT'}]});
  f.state.scope=empty();const documentModel={blockDefinitions:[]};
  const oldScope=f.ports.currentScope;f.ports.currentScope=()=>{check('scope');return oldScope();};
  const ids=w.GeometryIds.create(),geometry=w.GeometryCreation.create({currentScope:f.ports.currentScope,ids,assignSketchId:item=>{item.sketchId=f.state.scope.activeSketchId;},currentConstruction:()=>false,minLineLength:.01,minArcLength:.01});
  const selection=w.CanvasSelection.create();
  Object.assign(f.ports,{types:{Point:G.Point,Line:G.Line,Circle:G.Circle,Arc:G.Arc,Spline:G.Spline},...geometry,DEFAULT_SKETCH_ID:'S1',ROOT_SKETCH_ID:'ROOT',SketchProjectionConstraint:G.SketchProjectionConstraint,
    constraintGeometryId:w.GeometryObjects.geometryIdForItem,canvasSelection:selection,clearSelection:()=>{selection.clear();events.push('clear');},
    resetModelState:()=>{check('reset');f.state.scope=empty();f.state.constraints=f.state.scope.constraints;ids.reset();events.push('reset');},
    focus:effect('focus'),resetHistory:effect('history'),resetBlockEditorHistory:effect('block history'),splineGeometry:w.SplineGeometry,
    updateUI:effect('ui'),draw:effect('draw'),loadModelData:data=>{check('load');events.push(['load',data.version]);f.state.data=data;},
    copySelectionToClipboard:()=>{check('copy');events.push('copy');return true;},pasteGeometryClipboard:()=>{check('paste');events.push('paste');return true;},
    createEmptyBlockDefinition:name=>({id:'BD1',name,points:[],lines:[],circles:[],arcs:[],splines:[],constraints:[],revision:0}),
    openBlockDefinitionEditor:(draft,options)=>{check('open');extra.block=draft;events.push(['open',options]);},completeBlockDefinitionEdit:()=>{check('complete');extra.block=null;},
    isEditingBlock:()=>Boolean(extra.block),appendDefinition:definition=>documentModel.blockDefinitions.push(definition),
    nextInstanceId:()=>documentIds.allocate('blockInstance'),invalidateBlockProjectionCache:effect('invalidate'),
    blockProjectionBundle:instance=>({lines:documentModel.blockDefinitions.find(d=>d.id===instance.definitionId).lines}),
    elementSketchId:item=>item.sketchId,sketchProjectionSourceKey:item=>w.GeometryObjects.geometryKeyForItem(item),sketchProjectionEntryFromOperand:()=>null,
    solveSketchAndDependents:effect('solve'),markReferenceConstraint:effect('reference'),pushModelConstraint:c=>f.state.constraints.push(c),synchronizeSketchProjectionMetadata:effect('metadata'),
    setAppearanceForSelection:effect('appearance'),deleteElements:effect('delete'),deleteCurrentSelection:effect('delete selection'),deleteSketch:effect('delete sketch'),
    blockSelectionGeometry:()=>({error:null,externalConstraints:[]}),blockSelectionBoundsCenter:()=>({x:0,y:0}),createBlockDefinitionFromSelection:()=>({constraints:f.state.constraints,lines:[],circles:[],arcs:[],splines:[]})});
  const documentIds={allocate(kind){assert.equal(this,documentIds);assert.equal(kind,'blockInstance');return 'BI'+ ++extra.id;}};
  const documentWorkspace={document:documentModel,workspace:{current:f.ports.currentScope},documentIds,sketches:{constraintSketchId:f.ports.constraintSketchId,elementSketchId:f.ports.elementSketchId}};
  const projection={command:{get count(){return f.state.staged;}},queries:{sketchProjectionConstraints:f.ports.readConstraints},sources:{sketchProjectionSourceKey:f.ports.sketchProjectionSourceKey,sketchProjectionEntryFromOperand:f.ports.sketchProjectionEntryFromOperand}};
  const interaction={lifecycle:{readMode:f.ports.readMode},selection};
  const readServices={geometryAppearance:{effectiveAppearanceForElement:f.ports.effectiveAppearanceForElement},projections:{invalidateBlockProjectionCache:f.ports.invalidateBlockProjectionCache,blockProjectionBundle:f.ports.blockProjectionBundle}};
  const history={resetDocument:f.ports.resetHistory,resetBlock:f.ports.resetBlockEditorHistory},presentation={updateUI:f.ports.updateUI,draw:f.ports.draw};
  const blocks={editing:{empty:f.ports.createEmptyBlockDefinition,fromSelection:f.ports.createBlockDefinitionFromSelection},session:{get current(){return extra.block;}}};
  const blockDefinition={open:f.ports.openBlockDefinitionEditor},blockCompletion={complete:f.ports.completeBlockDefinitionEdit},blockSelection={read:f.ports.blockSelectionGeometry,center:f.ports.blockSelectionBoundsCenter};
  const support=composed?w.SketchProjectionTestDriver.createForWorkspace({documentWorkspace,geometry,readServices,interaction,projection,display:{geometryDisplayColor:f.ports.geometryDisplayColor},
    sketchPresentation:{constraintStatusColor:f.ports.constraintStatusColor},analysis:{statusOf:f.ports.constraintStatusOf},redundancy:{constraintIsRedundant:f.ports.constraintIsRedundant},presentation,
    canvasDriver:{focus:f.ports.focus,clientPosition:f.ports.clientPosition},history,solving:{solveSketchAndDependents:f.ports.solveSketchAndDependents},blocks,blockDefinition,blockCompletion,blockSelection,
    document:f.ports.document,readHistory:f.ports.readHistory,resetModelState:f.ports.resetModelState,serializeModel:f.ports.serializeModel,loadModelData:f.ports.loadModelData,markReferenceConstraint:f.ports.markReferenceConstraint,
    pushModelConstraint:f.ports.pushModelConstraint,synchronizeSketchProjectionMetadata:f.ports.synchronizeSketchProjectionMetadata,clearSelection:f.ports.clearSelection,deleteCurrentSelection:f.ports.deleteCurrentSelection,
    deleteElements:f.ports.deleteElements,deleteSketch:f.ports.deleteSketch,setAppearanceForSelection:f.ports.setAppearanceForSelection,version:f.ports.CURRENT_JSON_VERSION,
    copySelectionToClipboard:f.ports.copySelectionToClipboard,pasteGeometryClipboard:f.ports.pasteGeometryClipboard,clipboardSession:f.ports.clipboardSession}):w.SketchProjectionTestDriver.createSupport(f.ports);
  assert.deepEqual(events,[]);
  function seed(){const source=new G.Point('P101',0,0),target=new G.Point('P102',4,5),constraint=Object.assign(new G.SketchProjectionConstraint('point',source,target),{sketchId:'S3',referenceSketchId:'S1'});f.state.constraints=[constraint];return target;}
  return{...f,support,selection,documentModel,projection,marker,extra,seed};
}

test('workspace browser support stays cold, exposes the same ordered API and observes live mode, sources, history and actual Geometry identities',()=>{
  const run=composed=>{const f=browserOwnersFixture(composed);assert.ok(Object.isFrozen(f.support));const keys=Object.keys(f.support),target=f.seed();f.state.mode='sketch-projection';f.state.staged=4;f.state.properties='latest';
    const selected=f.support.selectSketchProjectionTargetForTest('point');assert.equal(f.selection.points[0],target);assert.equal(f.support.sketchProjectionStateForTest().stagedCount,4);assert.equal(selected.propertiesText,'latest');
    const copied=f.support.copySketchProjectionTargetForTest('point');assert.equal(copied.copied,true);assert.equal(copied.clipboardProjectionCount,1);assert.ok(f.events.indexOf('copy')<f.events.indexOf('paste'));
    const block=f.support.blockizeSketchProjectionTargetForTest('point');assert.equal(block.projectionConstraintCount,1);
    const reload=f.support.reloadSketchProjectionForTest(25);assert.equal(reload.serialized.version,25);return JSON.parse(JSON.stringify({keys,selected,copied,block,reload,events:f.events}));
  };assert.deepEqual(run(true),run(false));
});

test('workspace projection fixtures share actual Geometry construction and keep root Document definitions separate from the live scope',()=>{
  const run=composed=>{const f=browserOwnersFixture(composed),geometry=f.support.resetForSketchProjectionTest();assert.ok(f.state.scope.splines[0] instanceof ownerSandbox.window.GeometrySolver.Spline);
    const block=f.support.resetForBlockProjectionSketchProjectionTest();assert.equal(block.instanceId,'BI1');assert.equal(f.documentModel.blockDefinitions.length,1);assert.equal(f.state.scope.blockDefinitions.length,0);
    f.support.resetForSketchProjectionBlockEditorTest();assert.ok(f.extra.block);const complete=f.support.completeSketchProjectionBlockEditorForTest();assert.equal(complete.completed,true);
    return JSON.parse(JSON.stringify({geometry,block,complete,events:f.events,model:f.state.scope,definitions:f.documentModel.blockDefinitions}));};assert.deepEqual(run(true),run(false));
});

test('workspace projection browser support preserves owner callback failures and their existing partial fixture state',()=>{
  for(const failure of ['scope','reset','focus','history','ui','draw','load','copy','paste','open','complete']){
    const run=composed=>{const f=browserOwnersFixture(composed,failure);let operation;
      if(['copy','paste'].includes(failure)){f.seed();operation=()=>f.support.copySketchProjectionTargetForTest('point');}
      else if(failure==='load')operation=()=>f.support.reloadSketchProjectionForTest();
      else if(failure==='open')operation=()=>f.support.resetForSketchProjectionBlockEditorTest();
      else if(failure==='complete')operation=()=>f.support.completeSketchProjectionBlockEditorForTest();
      else operation=()=>f.support.resetForSketchProjectionTest();
      assert.throws(operation,error=>error===f.marker);return JSON.parse(JSON.stringify({events:f.events,model:f.state.scope,data:f.state.data,definitions:f.documentModel.blockDefinitions,block:f.extra.block}));};
    assert.deepEqual(run(true),run(false),failure);
  }
});
