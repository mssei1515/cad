'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
const plain = value => JSON.parse(JSON.stringify(value));

function fixture(composed = true) {
  const context = { window: {}, structuredClone }; vm.createContext(context);
  for (const file of sources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  const w = context.window, model = w.DocumentState.create(), ids = w.GeometryIds.create(), selection = w.CanvasSelection.create();
  const state = { ready: false, scope: model, scale: 2, definitionSeq: 1, fail: null }, events = [];
  const stage = name => { assert.equal(state.ready, true, 'test construction must stay cold'); events.push(name); if (state.fail === name) throw state.error; };
  function current() { assert.equal(this, undefined); stage('scope'); return state.scope; }
  const activeSketchId = () => { stage('active'); return state.scope.activeSketchId; };
  const geometry = w.GeometryCreation.create({ currentScope: current, ids, assignSketchId: item => { item.sketchId = activeSketchId(); },
    currentConstruction: () => false, minLineLength: .01, minArcLength: .01 });
  const sketches = { activeSketchId, isRootSketch: item => item.kind === 'root' };
  const readServices = w.GeometryReadServices.createWithHatches({ document: model, currentScope: current,
    currentSketches: () => { stage('sketches'); return state.scope.sketches; }, prepareBlocks() {}, elementSketchId: item => item.sketchId,
    applicationText: (ja, en) => en, sketchById: id => state.scope.sketches.find(s => s.id === id), isRootSketch: sketches.isRootSketch,
    activeSketchId, showHiddenElements: () => false, viewportScale: () => state.scale });
  const viewport = { get scale() { stage('scale'); return state.scale; }, update(value) { assert.equal(this, viewport); stage('viewport'); state.scale = value.scale; },
    worldToCanvasScreen(point) { assert.equal(this, undefined); stage('screen'); return { x: point.x * state.scale, y: point.y * state.scale }; } };
  const canvas = { getBoundingClientRect() { assert.equal(this, canvas); stage('rect'); return { left: 10, top: 20 }; } };
  const document = { querySelectorAll() { stage('rows'); return []; }, getElementById() { stage('panel'); return { textContent: 'Properties' }; } };
  const note = name => function() { assert.equal(this, undefined); stage(name); };
  const resetModelState = () => { stage('reset'); for (const key of ['points','lines','circles','arcs','splines','constraints','hatches','blockInstances','geometryInstances']) state.scope[key].length = 0; ids.restore({ pointSeq: 1, lineSeq: 1, circleSeq: 1 }); };
  const editing = w.BlockDefinitionEditing.create({ nextDefinitionId: () => { stage('definition'); return 'B' + state.definitionSeq++; } });
  const clipboard = { session: { replaceForDiagnostics(value) { assert.equal(this, clipboard.session); stage('replace'); state.payload = value; } },
    copyableSelectionPayload() { assert.equal(this, clipboard); stage('copy'); return selection.lines.length ? { lines: selection.lines, hatches: selection.hatches } : null; },
    command: { paste() { assert.equal(this, clipboard.command); stage('paste'); const hatch = { ...state.scope.hatches[0], id: 'H2' }; state.scope.hatches.push(hatch); return true; } } };
  const blockSelection = { read() { assert.equal(this, undefined); stage('block-selection'); return selection.lines.length ? { lines: selection.lines, circles: state.scope.circles, hatches: selection.hatches } : { error: 'missing boundary' }; },
    center() { assert.equal(this, undefined); stage('center'); return { x: 0, y: 0 }; } };
  const blocks = { editing: { empty: editing.empty, fromSelection(selected, center, name) {
    assert.equal(this, undefined); assert.deepEqual(center, { x: 0, y: 0 }); stage('from-selection');
    return { ...editing.empty(name), lines: selected.lines, circles: selected.circles, hatches: selected.hatches };
  } } };
  const options = { documentWorkspace: { document: model, workspace: { current }, sketches }, geometry, readServices,
    interaction: { selection, lifecycle: { readMode: () => { stage('mode'); return state.mode || 'select'; } } },
    presentation: { updateUI: note('ui'), draw: note('draw') }, viewport, canvas, document,
    fit: { fitSketchToViewport: note('fit-sketch'), fitAllGeometryToViewport: note('fit-all') }, blocks, blockSelection, clipboard,
    resetModelState, resetHistory: note('history'), serializeModel: () => { stage('serialize'); return { version: 26, points: plain(state.scope.points), hatches: plain(state.scope.hatches) }; },
    hitBlockInstance: () => { stage('hit'); return state.scope.blockInstances[0]; }, hatchCommand: {}, hatchRegionErrorText: result => result.reason,
    clearSelection: () => { stage('clear'); selection.clear(); }, normalizeGeometryInstance: raw => raw,
    readHistory: () => { stage('read-history'); return { count: 1 }; }, reorderSelectedDrawingObjects: action => {
      stage('reorder'); return w.DrawingOrder.reorder(state.scope, state.scope.activeSketchId, [...selection.lines, ...selection.hatches], action);
    } };
  const legacy = { resetModelState, viewport, addPoint: geometry.addPoint, addLine: geometry.addLine, addCircle: geometry.addCircle, currentScope: current,
    fitSketchToViewport: options.fit.fitSketchToViewport, activeSketchId, resetHistory: options.resetHistory,
    updateUI: options.presentation.updateUI, draw: options.presentation.draw, canvas, worldToCanvasScreen: viewport.worldToCanvasScreen,
    serializeModel: options.serializeModel, readMode: options.interaction.lifecycle.readMode, allHatches: readServices.reads.allHatches,
    hatchGeometryQuery: readServices.hatches, serializeHatch: w.HatchData.serializeHatch, hatchRegionErrorText: options.hatchRegionErrorText,
    canvasSelection: selection, hatchCommand: options.hatchCommand, document,
    DEFAULT_SKETCH_ID: w.SketchHierarchy.DEFAULT_SKETCH_ID, DEFAULT_HATCH_APPEARANCE: w.Appearance.DEFAULT_HATCH_APPEARANCE,
    HATCH_SCREEN_PX_PER_MM: w.Appearance.CSS_PX_PER_MM, createEmptyBlockDefinition: editing.empty,
    Point: w.GeometrySolver.Point, Line: w.GeometrySolver.Line,
    appendDefinitions: (...definitions) => model.blockDefinitions.push(...definitions), invalidateBlockProjectionCache: readServices.projections.invalidateBlockProjectionCache,
    fitAllGeometryToViewport: options.fit.fitAllGeometryToViewport, blockProjectionBundle: readServices.projections.blockProjectionBundle,
    hitBlockInstance: options.hitBlockInstance, clearSelection: options.clearSelection,
    copyableSelectionPayload: () => clipboard.copyableSelectionPayload(), clipboardSession: clipboard.session, pasteGeometryClipboard: () => clipboard.command.paste(),
    geometryRefId: w.GeometryRef.id, blockSelectionGeometry: blockSelection.read,
    createBlockDefinitionFromSelection: blocks.editing.fromSelection, blockSelectionBoundsCenter: blockSelection.center,
    drawingOrder: w.DrawingOrder, ROOT_SKETCH_ID: w.SketchHierarchy.ROOT_SKETCH_ID,
    appendDefinition: definition => model.blockDefinitions.push(definition), normalizeGeometryInstance: options.normalizeGeometryInstance,
    geometryRefForItem: w.GeometryObjects.geometryRefForItem, isRootSketch: sketches.isRootSketch,
    readHistory: options.readHistory, reorderSelectedDrawingObjects: options.reorderSelectedDrawingObjects };
  const hatch = composed ? w.HatchTestDriver.createForWorkspace(options) : w.HatchTestDriver.createBrowserApi(legacy);
  const order = composed ? w.DrawingOrderTestDriver.createForWorkspace(options) : w.DrawingOrderTestDriver.createBrowserApi(legacy);
  assert.deepEqual(events, []); state.ready = true;
  return { hatch, order, state, events, options, model, selection, w };
}

test('authoring test composition stays cold and preserves real Hatch geometry, scale, visibility observations and ordered APIs', () => {
  const results = [];
  for (const composed of [false, true]) {
    const f = fixture(composed); assert.equal(Object.isFrozen(f.hatch), true); assert.equal(Object.isFrozen(f.order), true);
    const reset = f.hatch.resetForSolidHatchHoleTest();
    assert.equal(f.state.scope.points[0] instanceof f.w.GeometrySolver.Point, true);
    assert.equal(f.state.scope.lines[0] instanceof f.w.GeometrySolver.Line, true);
    const initial = f.hatch.hatchStateForTest(); assert.equal(initial.direct[0].valid, true);
    const spacing = f.hatch.setViewportScaleForHatchTest(3); assert.equal(spacing, f.state.scope.hatches[0].appearance.spacing * f.w.Appearance.CSS_PX_PER_MM / 3);
    assert.equal(f.hatch.breakFirstHatchBoundaryForTest(), true); assert.equal(f.hatch.hatchStateForTest().direct[0].valid, false);
    const replacement = f.hatch.restoreClosedBoundaryForHatchTest();
    assert.equal(replacement.id, f.state.scope.lines.at(-1).id);
    assert.equal(f.hatch.hatchStateForTest().direct[0].valid, false, 'replacing the line still requires explicit Hatch repair');
    results.push(plain({ keys: Object.keys(f.hatch), orderKeys: Object.keys(f.order), reset, initial, replacement, events: f.events }));
  }
  assert.deepEqual(results[1], results[0]);
});

test('projected Hatch setup appends live definitions to fixed Document while using the current Workspace for instances', () => {
  const results = [];
  for (const composed of [false, true]) {
    const f = fixture(composed); f.state.scope = f.w.DocumentState.create(); f.model.blockDefinitions = [];
    const result = f.hatch.resetForProjectedHatchTest(); assert.equal(result.projected.valid, true);
    assert.equal(f.model.blockDefinitions.length, 2); assert.equal(f.state.scope.blockDefinitions.length, 0);
    assert.equal(f.state.scope.blockInstances.length, 1); assert.equal(f.model.blockInstances.length, 0);
    const projected = f.hatch.projectedHatchStateForTest(); assert.equal(projected.ownerId, f.state.scope.blockInstances[0].id);
    f.state.scope = f.w.DocumentState.create(); assert.equal(f.hatch.projectedHatchStateForTest(), null);
    results.push(plain({ result, projected, events: f.events }));
  }
  assert.deepEqual(results[1], results[0]);
});

test('drawing-order setup, selection and reorder keep model identities, current Sketch order and history observation', () => {
  const results = [];
  for (const composed of [false, true]) {
    const f = fixture(composed), reset = f.order.resetForDrawingOrderTest();
    assert.equal(f.model.blockDefinitions.length, 1); const line = f.state.scope.lines.find(l => l.id === reset.crossLineId);
    const selected = f.order.selectDrawingOrderObjectForTest('line', line.id); assert.equal(f.selection.lines[0], line);
    const reordered = f.order.reorderDrawingOrderForTest('front');
    assert.equal(f.selection.lines[0], line); assert.deepEqual(plain(reordered.history), { count: 1 });
    results.push(plain({ reset, selected, reordered, events: f.events }));
  }
  assert.deepEqual(results[1], results[0]);
});

test('Hatch transfer preserves Clipboard method receivers and query failures retain their original identity and stop later work', () => {
  for (const failure of [null, 'paste', 'from-selection']) {
    const results = [];
    for (const composed of [false, true]) {
      const f = fixture(composed); f.hatch.resetForSolidHatchHoleTest(); f.events.length = 0;
      f.state.fail = failure; f.state.error = new Error(failure || 'unused');
      let result;
      if (failure) assert.throws(() => f.hatch.exerciseHatchTransferForTest(), error => error === f.state.error);
      else { result = f.hatch.exerciseHatchTransferForTest(); assert.equal(result.pasteAccepted, true); assert.equal(result.block.valid, true); }
      if (failure === 'paste') assert.equal(f.events.includes('block-selection'), false);
      results.push(plain({ result, events: f.events, hatchIds: f.state.scope.hatches.map(h => h.id) }));
    }
    assert.deepEqual(results[1], results[0]);
  }
});

function clipboardWorkspaceFixture(composed) {
  const context={window:{},structuredClone};vm.createContext(context);
  for(const file of sources.filter(file=>file.startsWith('src/')))vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  const w=context.window,events=[],state={ready:false,fail:null,history:'initial'};
  const stage=name=>{assert.equal(state.ready,true,'Clipboard test construction must stay cold');events.push(name);if(state.fail===name)throw state.error;};
  const base=w.DocumentWorkspace.create({applicationText:(_ja,en)=>en,constraintGraphNodes:()=>[],nextHatchIndex:()=>1});
  const documentIds={allocate(kind){assert.equal(this,documentIds);stage('allocate:'+kind);return base.documentIds.allocate(kind);}};
  const documentWorkspace={...base,documentIds},selection=w.CanvasSelection.create(),session=w.ClipboardSession.create({});
  const current=()=>{stage('scope');return base.workspace.current();};
  documentWorkspace.workspace={current};
  const geometry=w.GeometryCreation.create({currentScope:current,ids:base.geometryIds,assignSketchId:item=>{item.sketchId=base.sketches.activeSketchId();},currentConstruction:()=>false,minLineLength:.01,minArcLength:.01});
  const viewport={scale:2,update(value){assert.equal(this,viewport);stage('viewport');Object.assign(this,value);}};
  const projections={invalidateBlockProjectionCache:()=>stage('invalidate'),blockProjectionBundle:instance=>{
    stage('projection');return{lines:base.document.blockDefinitions.find(d=>d.id===instance.definitionId).lines};}};
  const blocks={editing:{empty:name=>{stage('empty');return{id:base.documentIds.allocate('blockDefinition'),name,points:[],lines:[],constraints:[]};}}};
  const options={documentWorkspace,geometry,readServices:{projections},interaction:{selection},clipboard:{session},blocks,
    presentation:{updateUI:()=>stage('ui'),draw:()=>stage('draw')},viewport,
    dimensionFromAnchor:w.DimensionPlacement.create({viewport}).dimensionFromAnchor,
    readSelected:()=>{stage('selected');return{points:selection.points.map(p=>p.id),lines:selection.lines.map(p=>p.id)};},
    readHistory:()=>{stage('history');return state.history;},
    resetModelState:()=>{stage('reset');const scope=base.workspace.current();Object.assign(scope,w.DocumentState.create());selection.clear();base.geometryIds.reset();},
    serializeModel:()=>{stage('serialize');return{constraints:base.workspace.current().constraints.map(c=>({type:c.constructor.name,sketchId:c.sketchId,dimension:c.dimension}))};},
    pushModelConstraint:c=>{stage('constraint');c.sketchId=base.sketches.activeSketchId();base.workspace.current().constraints.push(c);return c;},
    resetHistory:label=>{stage('reset-history');state.history=label;}};
  const support=composed?w.ClipboardTestDriver.createForWorkspace(options):w.ClipboardTestDriver.createSupport({
    currentScope:current,serializeModel:options.serializeModel,sketchContext:base.sketches,readSelected:options.readSelected,canvasSelection:selection,clipboardSession:session,readHistory:options.readHistory,
    resetModelState:options.resetModelState,viewport,geometry,types:w.GeometrySolver,dimensionFromAnchor:options.dimensionFromAnchor,arcEndpointPoint:w.GeometryKernel.arcEndpointPoint,
    rootSketchId:w.SketchHierarchy.ROOT_SKETCH_ID,defaultSketchId:w.SketchHierarchy.DEFAULT_SKETCH_ID,createEmptyBlockDefinition:blocks.editing.empty,
    appendDefinition:definition=>base.document.blockDefinitions.push(definition),nextInstanceId:()=>documentIds.allocate('blockInstance'),
    ...projections,pushModelConstraint:options.pushModelConstraint,resetHistory:options.resetHistory,...options.presentation});
  assert.deepEqual(events,[]);state.ready=true;
  return{w,base,options,support,selection,session,state,events};
}

test('Clipboard Workspace assembly preserves real geometry, constraints, Selection and observation order',()=>{
 const results=[];
 for(const composed of [false,true]){
  const f=clipboardWorkspaceFixture(composed);assert.equal(Object.isFrozen(f.support),true);
  f.session.replaceForDiagnostics({pasteCount:4});
  const result=f.support.resetForGeometryClipboardTest();
  assert.equal(f.session.payload,null);assert.equal(f.selection.lines[0],f.base.document.lines[0]);
  assert.ok(f.selection.arcs[0] instanceof f.w.GeometrySolver.Arc);assert.equal(f.base.document.constraints.length,7);
  assert.equal(f.options.viewport.scale,1);assert.equal(result.history,'clipboard geometry test');
  results.push(plain({result,events:f.events,keys:Object.keys(f.support)}));
 }
 assert.deepEqual(results[1],results[0]);
});

test('Clipboard Block fixture appends to current Document definitions while inserting into the live editing scope with Document IDs',()=>{
 const results=[];
 for(const composed of [false,true]){
  const f=clipboardWorkspaceFixture(composed),firstDefinitions=f.base.document.blockDefinitions,local=f.w.DocumentState.create();
  f.base.document.blockDefinitions=[];f.base.workspace.activate(local);
  const result=f.support.resetForBlockClipboardTest(),instance=local.blockInstances[0];
  assert.equal(firstDefinitions.length,0);assert.equal(f.base.document.blockDefinitions.length,1);assert.equal(f.base.document.blockInstances.length,0);
  assert.equal(f.selection.blockInstances[0],instance);assert.equal(instance.id,'BI1');assert.equal(f.base.documentIds.peek('blockInstance'),2);
  assert.equal(local.constraints[0].line,f.base.document.blockDefinitions[0].lines[0]);
  assert.equal(result.selectedBlockInstanceIds[0],instance.id);
  results.push(plain({result,events:f.events}));
 }
 assert.deepEqual(results[1],results[0]);
});

test('Clipboard fixture assembly preserves failure boundaries and partial Document ID state',()=>{
 for(const fail of ['empty','allocate:blockInstance','projection','constraint','reset-history','ui','draw','serialize']){
  const results=[];
  for(const composed of [false,true]){
   const f=clipboardWorkspaceFixture(composed);f.state.fail=fail;f.state.error=new Error(fail);
   assert.throws(()=>f.support.resetForBlockClipboardTest(),error=>error===f.state.error);
   results.push(plain({events:f.events,definitions:f.base.document.blockDefinitions.length,instances:f.base.document.blockInstances.length,
    constraints:f.base.document.constraints.length,selected:f.selection.blockInstances.map(i=>i.id),ids:f.base.documentIds.snapshot(),history:f.state.history}));
  }
  assert.deepEqual(results[1],results[0],fail);
 }
});
