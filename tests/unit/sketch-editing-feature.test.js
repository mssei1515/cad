const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window;
function fixture(configureMove, buildMove = (feature, options) => feature.createMove(options), buildFeature = options => w.SketchEditingFeature.create(options)) {
  const empty = () => ({ ...Object.fromEntries([...w.SketchMove.fields, 'constraints', 'geometryInstances'].map(field => [field, []])),
    activeSketchId: 'S1', sketches: [{ id: 'ROOT', kind: 'root', name: 'Root' },
      { id: 'S1', kind: 'sketch', name: 'Sketch-1', parentSketchId: 'ROOT' }, { id: 'S2', kind: 'sketch', name: 'Destination', parentSketchId: 'ROOT', visible: false }] });
  const state = { ready: false, scope: empty(), sequence: 3, symbols: true, refreshError: null }, calls = [];
  const read = () => { assert.equal(state.ready, true); return state.scope; };
  const notify = name => (...args) => { assert.equal(state.ready, true); calls.push([name, ...args]); };
  const resolve = ref => [...w.SketchMove.fields.flatMap(field => read()[field])].find(item => item.id === w.GeometryRef.id(ref)) || null;
  const constraintReferences = w.ConstraintReferences.create({ resolveGeometryRef: resolve });
  const sketches = w.SketchContext.create({ currentScope: read, constraintGraphNodes: constraintReferences.constraintGraphNodes });
  const selection = w.CanvasSelection.create();
  const ids = { allocate(kind) { assert.equal(this, ids); assert.equal(kind, 'sketch'); return `S${state.sequence++}`; } };
  const projections = { blockAllProjectionBundle: item => item.bundle, invalidateBlockProjectionCache: notify('cache') };
  const geometryReads = { resolveGeometryRef: resolve };
  const featureOptions = { currentScope: read, sketches, ids, selection, constraintReferences,
    geometryReads, projections, clearSelection: () => { calls.push(['selection']); selection.clear(); },
    clearInteractionForSketchChange: () => { calls.push(['interaction']); state.move?.reset(); },
    applicationText: (_ja,en) => { assert.equal(state.ready, true); return en; }, setHint: notify('hint'), updateUI: notify('ui'),
    draw: notify('draw'), recordHistory: notify('history'), promptName: () => null,
    effectiveAppearanceForElement: item => ({ ...state.scope.sketches.find(sketch => sketch.id === item.sketchId)?.appearance, ...item.appearance }), clearTreeHover: notify('hover'), clearSnap: notify('snap'),
    guardEdit: () => true, prepareLockToggle: notify('lock') };
  const feature = buildFeature(featureOptions, {state,calls});
  const moveOptions = configureMove ? configureMove({ state, calls, geometryReads, projections }) : { refresh: () => { notify('refresh')(); if(state.refreshError) throw state.refreshError; } };
  const move = buildMove(feature, { prepare: notify('prepare'), ...moveOptions });
  const deletion = feature.createDeletion({ rejectReferencedGeometryDeletion: items => items.length > 0, log: notify('log'),
    geometryElementKey: item => item?.id, guardDimensionSymbolDeletion: () => state.symbols,
    annotationReferencesRemovedGeometry: () => false, clearSketchSolveState: notify('clear-solve'),
    invalidateAnalysis: notify('analysis'), solveSketchAndDependents: notify('solve'), refreshConstraintAnalysis: notify('constraint-refresh'),
    confirmDeletion: () => { calls.push(['confirm']); return true; } });
  assert.deepEqual(calls, []); state.ready = true; state.move = move;
  const point = Object.assign(new w.GeometrySolver.Point('P1', 0.123456789, 2.3456789), { sketchId: 'S1' });
  state.scope.points.push(point);
  return { feature, move, deletion, state, calls, point, selection, empty, names: () => calls.map(call => call[0]) };
}

test('shared Sketch editing keeps move identity, selection, history and current scope across later command creation', () => {
  const f = fixture(), position = [f.point.x, f.point.y]; f.selection.set('points', [f.point]);
  assert.equal(f.move.start(), true); assert.equal(f.move.choose('S2'), true); assert.equal(f.move.commit(), true);
  assert.equal(f.state.scope.points[0], f.point); assert.deepEqual([f.point.x, f.point.y], position); assert.equal(f.point.sketchId, 'S2');
  assert.equal(f.selection.points.length, 0); assert.equal(f.calls.filter(call => call[0] === 'history').length, 1);
  assert.ok(f.names().indexOf('refresh') < f.names().indexOf('history'));
  f.feature.command.activate('S2'); assert.equal(f.state.scope.activeSketchId, 'S2');
  assert.equal(f.state.scope.sketches.find(sketch => sketch.id === 'S2').appearance.visible, true);
  f.state.scope = f.empty(); f.calls.length = 0; f.feature.command.createSketch();
  const created = f.state.scope.sketches.at(-1); assert.equal(created.id, 'S3'); assert.equal(f.state.scope.activeSketchId, 'S3');
  assert.equal(f.deletion.remove('S3'), true); assert.equal(f.state.scope.sketches.includes(created), false);
  assert.equal(f.state.scope.activeSketchId, 'ROOT');
  assert.equal(f.calls.filter(call => call[0] === 'history').length, 2);
});

test('shared Sketch editing preserves move cancellation, deletion rejection and exception boundaries', () => {
  const f = fixture(); f.selection.set('points', [f.point]); assert.equal(f.move.start(), true);
  f.feature.command.activate('S2'); assert.equal(f.move.active, false);
  f.state.symbols = false; f.calls.length = 0; const before = JSON.stringify(f.state.scope);
  assert.equal(f.deletion.remove('S1'), false); assert.equal(JSON.stringify(f.state.scope), before);
  assert.deepEqual(f.names(), ['confirm']);
  f.state.scope.sketches.find(sketch => sketch.id === 'S1').locked = true; f.state.symbols = true; f.calls.length = 0;
  assert.equal(f.deletion.remove('S1'), false); assert.deepEqual(f.names(), ['hint']); assert.equal(f.state.scope.points[0], f.point);
  const other = fixture(); other.selection.set('points', [other.point]); other.move.start(); other.move.choose('S2');
  other.calls.length = 0; const error = new Error('refresh failed'); other.state.refreshError = error;
  const beforeMove = JSON.stringify(other.state.scope);
  assert.equal(other.move.commit(), false);
  assert.deepEqual(other.names(), ['refresh','hint','ui','draw']);
  assert.equal(JSON.stringify(other.state.scope), beforeMove);
  assert.equal(other.state.scope.points[0], other.point); assert.equal(other.move.active, true);
});

const refreshOrder = ['block-cache','geometry-cache','hatch-cache','bound-scope','blocks','instances','rebind','analysis','references'];
function refreshingFixture() {
  const f = fixture(({ state, geometryReads, projections }) => {
    state.stages = []; state.boundScope = {}; state.blockBundles = [{}]; state.instanceBundles = [{}];
    const step = name => {
      assert.equal(state.ready, true); assert.equal(state.scope.points[0].sketchId, 'S2');
      state.stages.push(name); if (state.failStage === name) throw new Error(`failed ${name}`);
    };
    projections.invalidateBlockProjectionCache = function() { 'use strict'; assert.equal(this, undefined); step('block-cache'); };
    geometryReads.clearReadCache = function() { assert.equal(this, geometryReads); step('geometry-cache'); };
    geometryReads.blockProjectionBundles = function() { 'use strict'; assert.equal(this, undefined); step('blocks'); return state.blockBundles; };
    geometryReads.geometryInstanceBundles = function() { 'use strict'; assert.equal(this, undefined); step('instances'); return state.instanceBundles; };
    const hatches = { clear() { assert.equal(this, hatches); step('hatch-cache'); } };
    const rebinding = { rebuildDocument(scope, bundles) {
      assert.equal(this, rebinding); assert.equal(scope, state.boundScope); assert.notEqual(scope, state.scope);
      assert.deepEqual(Array.from(bundles), [...state.blockBundles, ...state.instanceBundles]); step('rebind');
    } };
    const analysis = { invalidate() { assert.equal(this, analysis); step('analysis'); } };
    return { readEditingScope: () => { step('bound-scope'); return state.boundScope; }, hatches, rebinding, analysis,
      refreshReferenceConstraintValidity: function() { 'use strict'; assert.equal(this, undefined); step('references'); } };
  });
  assert.deepEqual(f.state.stages, []); f.selection.set('points', [f.point]); f.move.start(); f.move.choose('S2'); f.calls.length = 0;
  return f;
}

test('Sketch move refresh reads current bound scope and bundles after cache invalidation, then records one history', () => {
  const f = refreshingFixture(); f.state.boundScope = { id: 'latest bound scope' }; f.state.blockBundles = [{ id: 'latest block bundle' }];
  assert.equal(f.move.commit(), true); assert.deepEqual(f.state.stages, refreshOrder);
  assert.equal(f.point.sketchId, 'S2'); assert.equal(f.state.scope.points[0], f.point); assert.equal(f.move.active, false);
  assert.equal(f.calls.filter(call => call[0] === 'history').length, 1); assert.equal(f.selection.points.length, 0);
});

test('each Sketch move refresh failure stops later stages and restores ownership while retaining selection and retry state', () => {
  for (const [index, stage] of refreshOrder.entries()) {
    const f = refreshingFixture(), before = JSON.stringify(f.state.scope), constraints = f.state.scope.constraints;
    f.state.failStage = stage;
    assert.equal(f.move.commit(), false, stage); assert.deepEqual(f.state.stages, refreshOrder.slice(0, index + 1), stage);
    assert.equal(JSON.stringify(f.state.scope), before, stage); assert.equal(f.state.scope.constraints, constraints);
    assert.equal(f.state.scope.points[0], f.point); assert.equal(f.selection.points[0], f.point); assert.equal(f.move.active, true);
    assert.deepEqual(f.names(), ['hint','ui','draw']); assert.equal(f.calls[0][1].includes(`failed ${stage}`), true);
    f.state.failStage = null; f.state.stages.length = 0; f.calls.length = 0;
    assert.equal(f.move.commit(), true, stage); assert.deepEqual(f.state.stages, refreshOrder);
    assert.equal(f.calls.filter(call => call[0] === 'history').length, 1);
  }
});

function treeFixture(buildTree = (f, options) => f.feature.createTree(options), makeFixture = fixture) {
  const f = makeFixture(), domReads = [], label = { textContent: '' }, document = new EventTarget(), browser = new EventTarget();
  document.getElementById = id => { domReads.push(id); return id === 'activeSketchLabel' ? label : null; };
  document.querySelectorAll = () => [];
  const canvasHover = f.owners?.interaction.hover || w.CanvasHover.create({ isEndpointPoint: () => false });
  const selectionHighlight = w.SelectionHighlight.create({ canvasSelection: f.selection, types: w.GeometrySolver,
    constraintGraphNodes: () => [], targetFromConstraint: () => null, getHoveredDimension: () => canvasHover.current.dimension,
    setHoveredDimension: value => canvasHover.update({ dimension: value }), draw: () => f.calls.push(['hover-draw']) });
  f.state.dimensionScope = { ...f.state.scope, sketches: [...f.state.scope.sketches, { id: 'dimension-only', name: 'Dimension scope' }] };
  f.state.viewScope = { sketches: [{ id: 'S1', name: 'Bound view' }] }; f.state.ready = false;
  const read = field => { assert.equal(f.state.ready, true); return f.state[field]; };
  const tree = buildTree(f, { document, window: browser, readServices: { reads: { scopeGeometryItem: () => f.point } },
    canvasHover, selectionHighlight, objectOptions: { types: w.GeometrySolver },
    applicationSettings: { applicationText: (_ja,en) => en }, escapeHtml: String, closeCanvasContextMenu: () => f.calls.push(['close-canvas']),
    moveCommand: f.move, deletion: f.deletion, getScopeKey: () => 'document', viewScope: () => read('viewScope'),
    sketchHasSolveError: () => false, referenceConstraintErrorCountForSketch: () => 0, constraintDuplicateCountForSketch: () => 0,
    dimensionScope: () => read('dimensionScope'), toggleBlockInstanceSelection: () => {}, targetFromConstraint: () => null,
    updateSketchUI: () => f.calls.push(['sketch-ui']), selectionSketchId: () => 'S1', deleteElements: () => {},
    deleteCurrentSelection: () => {}, toggleSelectedVisibility: () => {}, updateSelectionUI: () => f.calls.push(['selection-ui']), unfixPoint: () => {} });
  assert.deepEqual(f.calls, []); assert.deepEqual(domReads, ['sketchOverlay','sketchOverlayResizeHandle','sketchList','sketchContextMenu']); f.state.ready = true;
  const event = (id, className, moveAction) => {
    const action = className || moveAction ? { dataset: { id, sketchMoveAction: moveAction }, classList: { contains: name => name === className }, closest: () => null } : null;
    const row = { dataset: { id } };
    return { key: 'Enter', preventDefault() {}, stopPropagation() {}, target: { closest: selector => selector === 'button' ? action
      : selector === '.sketch-item' ? row : selector === '.sketchActivateBtn' && className === 'sketchActivateBtn' ? action : null } };
  };
  return { ...f, tree, label, domReads, event };
}

test('Sketch feature Tree keeps bound view and dimension selection scopes separate from the command scope and shares Selection', () => {
  const f = treeFixture(); f.tree.view.render(); assert.equal(f.label.textContent, 'Drawing sketch: Bound view');
  f.tree.controller.keyDown(f.event('dimension-only','sketchActivateBtn'));
  assert.equal(f.selection.sketchId, 'dimension-only'); assert.equal(f.state.scope.activeSketchId, 'S1');
  assert.equal(f.state.scope.sketches.some(sketch => sketch.id === 'dimension-only'), false);
  assert.deepEqual(f.names().slice(-3), ['selection','selection-ui','draw']);
  f.tree.controller.doubleClick(f.event('S2')); assert.equal(f.state.scope.activeSketchId, 'S2');
  assert.equal(f.state.scope.sketches.find(sketch => sketch.id === 'S2').appearance.visible, true);
  f.tree.menu.start(); f.tree.menu.start(); f.tree.menu.dispose();
});

test('Sketch feature Tree delegates visibility, lock, deletion and destination mode to the same real commands', () => {
  const f = treeFixture(), destination = f.state.scope.sketches.find(sketch => sketch.id === 'S2'); destination.appearance = { visible: false };
  f.tree.controller.click(f.event('S2','sketchVisibilityBtn')); assert.equal(destination.appearance.visible, true);
  f.tree.controller.click(f.event('S2','sketchLockBtn')); assert.equal(destination.locked, true);
  f.tree.controller.click(f.event('S2','sketchDeleteBtn')); assert.equal(f.state.scope.sketches.includes(destination), true);
  f.tree.controller.click(f.event('S2','sketchLockBtn')); assert.equal(destination.locked, false);
  f.selection.set('points', [f.point]); assert.equal(f.move.start(), true);
  f.tree.controller.keyDown(f.event('S2','sketchActivateBtn')); assert.equal(f.move.state().targetId, 'S2');
  f.tree.controller.click(f.event('S2',null,'commit')); assert.equal(f.move.active, false); assert.equal(f.point.sketchId, 'S2');
  f.tree.controller.click(f.event('S2','sketchDeleteBtn')); assert.equal(f.state.scope.sketches.includes(destination), false);
  assert.equal(f.state.scope.points.includes(f.point), false); assert.equal(f.state.scope.activeSketchId, 'S1');
  assert.equal(f.calls.filter(call => call[0] === 'history' && call[1] === 'スケッチ間の図形移動').length, 1);
});

test("Sketch move input follows the actual command through commit and scope replacement without binding during construction", () => {
  const listeners = [], removed = [], blocked = []; let controls;
  const document = {
    addEventListener(type, handler, capture) { assert.equal(capture, true); listeners.push({ type, handler }); },
    removeEventListener(type, handler, capture) { assert.equal(capture, true); assert.equal(listeners.some(item => item.type === type && item.handler === handler), true); removed.push(type); },
  };
  const f = fixture(undefined, (feature, options) => { controls = feature.createMoveWithInput({ document, ...options }); return controls.command; });
  assert.equal(controls.command, f.move); assert.deepEqual(listeners, []);
  controls.input.bind(); controls.input.bind();
  assert.deepEqual(listeners.map(item => item.type), ["pointerdown", "click", "dblclick", "contextmenu", "input", "change"]);
  const event = inside => ({ target: { closest(selector) { assert.equal(selector, "#sketchList, #sketchOverlayResizeHandle"); return inside ? {} : null; } },
    preventDefault() { blocked.push("prevent"); }, stopImmediatePropagation() { blocked.push("stop"); } });
  listeners[0].handler(event(false)); assert.deepEqual(blocked, []);
  f.selection.set("points", [f.point]); assert.equal(f.move.start(), true);
  for (const item of listeners) item.handler(event(false));
  assert.deepEqual(blocked.splice(0), Array.from({ length: 6 }, () => ["prevent", "stop"]).flat());
  listeners[0].handler(event(true)); assert.deepEqual(blocked, []);
  assert.equal(f.move.choose("S2"), true); assert.equal(f.move.commit(), true);
  assert.equal(f.point.sketchId, "S2"); assert.equal(f.state.scope.points[0], f.point);
  listeners[0].handler(event(false)); assert.deepEqual(blocked, []);
  f.feature.command.activate("S2"); f.selection.set("points", [f.point]); assert.equal(f.move.start(), true);
  f.state.scope = f.empty(); listeners[0].handler(event(false));
  assert.equal(f.move.active, false); assert.deepEqual(blocked, []);
  controls.input.dispose(); controls.input.dispose(); assert.deepEqual(removed, listeners.map(item => item.type));
});

test("Sketch move command remains usable when the separately enabled input binding fails", () => {
  const marker = new Error("listener registration"), document = { addEventListener() { throw marker; } }; let controls;
  const f = fixture(undefined, (feature, options) => { controls = feature.createMoveWithInput({ document, ...options }); return controls.command; });
  assert.equal(controls.command, f.move);
  assert.throws(() => controls.input.bind(), error => error === marker);
  f.selection.set("points", [f.point]); assert.equal(f.move.start(), true);
  assert.equal(f.move.cancel(), true); assert.equal(f.move.active, false);
  assert.equal(f.point.sketchId, "S1"); assert.equal(f.calls.some(call => call[0] === "history"), false);
});

function interactionFixture(composed, navigation, useNavigationDefaults = false){
 let assembled,owners,controls;const listeners=[];
 const document={addEventListener:(...args)=>listeners.push(args),removeEventListener(){}};
 const f=fixture(undefined,(feature,options)=>{
  if(composed)delete options.prepare;else options.prepare=()=>{owners.constraintTargets.cancel('');owners.sessions.pending.cancel('');owners.interaction.lifecycle.exit();owners.interaction.hover.clear();};
  controls=feature.createMoveWithInput({document,...options});return controls.command;
 },(options,{state,calls})=>{
  const step=name=>(...args)=>{assert.equal(state.ready,true);calls.push([name,...args]);if(state.failStage===name)throw state.error;};
  const pending={cancel(message){step('pending-cancel')(message);state.pending=null;},clear(){step('pending-clear')();state.pending=null;}};
  const targets={clearCommand(){step('targets-clear')();state.target=null;}},constraintTargets={cancel(message){step('targets-cancel')(message);state.target=null;}};
  const rawHover=w.CanvasHover.create({isEndpointPoint:()=>false}),hover={update(values){assert.equal(this,hover);step('hover-update')(values);rawHover.update(values);},clear(){assert.equal(this,hover);step('hover-clear')();rawHover.clear();},get current(){return rawHover.current;}};
  const rawPointer=w.PointerInteractionController.createSession(),pointer={clearLastPointer:()=>{step('pointer')();rawPointer.clearLastPointer();}};
  const lifecycle={exit:step('exit'),resetInputsForSketchChange:step('drawing'),selectMode:step('select')};
  const resetSketchMove=()=>{step('move')();state.move?.reset();};
  owners={documentWorkspace:{workspace:{current:options.currentScope},sketches:options.sketches,documentIds:options.ids},
   readServices:{reads:options.geometryReads,projections:options.projections,geometryAppearance:{effectiveAppearanceForElement:options.effectiveAppearanceForElement}},
   interaction:{lifecycle,selection:options.selection,hover,access:{guardSketchEdit:options.guardEdit}},sessions:{pending,targets,pointer},constraintTargets,
   valueInput:{hide:step('value')},presentation:{settings:{applicationText:options.applicationText},setHint:options.setHint,updateUI:options.updateUI,draw:options.draw},
   constraintReferences:options.constraintReferences,recordHistory:options.recordHistory,clearSelection:options.clearSelection,clearSnap:options.clearSnap,updateToolbar:step('toolbar'),
   resetSketchMove,resetGeometryDrag:step('geometry'),resetDimensionDrag:step('dimension'),referenceImage:{reset:step('image')},selectionRectangle:{reset:step('rectangle')},
   projection:{reset:step('projection')},instances:{clearSources:step('instances')},instanceSources:{reset:step('sources')},
   clearInteractionForSketchChange:()=>assembled.reset.clear(),promptName:options.promptName,clearTreeHover:options.clearTreeHover};
  owners.rawPointer=rawPointer;
  if(useNavigationDefaults){delete owners.clearInteractionForSketchChange;delete owners.clearTreeHover;}
  if(composed)assembled=(navigation || w.SketchEditingFeature).createForInteraction(owners);
  else{
   const reset=w.SketchCommand.createInteractionReset({resetSketchMove,clearSelection:options.clearSelection,resetGeometryDrag:owners.resetGeometryDrag,resetDimensionDrag:owners.resetDimensionDrag,
    referenceImage:owners.referenceImage,selectionRectangle:owners.selectionRectangle,drawing:lifecycle,pending,constraint:targets,projection:owners.projection,instances:owners.instances,instanceSources:owners.instanceSources,hover,
    clearPointer:pointer.clearLastPointer,hideValueInput:owners.valueInput.hide,clearSnap:options.clearSnap,selectMode:lifecycle.selectMode,updateToolbar:owners.updateToolbar});
   const editing=w.SketchEditingFeature.create({...options,clearInteractionForSketchChange:owners.clearInteractionForSketchChange,
    prepareLockToggle:()=>{pending.cancel('');constraintTargets.cancel('');lifecycle.exit();}});assembled={reset,editing};
  }
  return assembled.editing;
 });
 return{...f,...assembled,owners,controls,listeners};
}

test('Sketch interaction composition preserves reset order, the shared selection and pointer, and its distinct hover subset',()=>{
 const results=[];for(const composed of [false,true]){
  const f=interactionFixture(composed),point=f.point;assert.deepEqual(f.calls,[]);assert.deepEqual(f.listeners,[]);f.selection.set('points',[point]);f.owners.rawPointer.setLastPointer(point);f.owners.interaction.hover.update({point,sketchIdentity:{id:'S1'}});f.state.pending={type:'distance-value'};f.state.target={type:'distance'};f.calls.length=0;
  f.reset.clear();assert.deepEqual(f.names(),['move','selection','geometry','dimension','image','rectangle','drawing','pending-clear','targets-clear','projection','instances','sources','hover-update','pointer','value','snap','select','toolbar']);
  assert.equal(f.selection.points.length,0);assert.equal(f.owners.rawPointer.readLastPointer(),null);assert.equal(f.owners.interaction.hover.current.point,point);assert.equal(f.owners.interaction.hover.current.sketchIdentity,null);assert.equal(f.state.pending,null);assert.equal(f.state.target,null);
  results.push(JSON.stringify(f.calls));
 }assert.equal(results[1],results[0]);
});

test('Sketch interaction composition keeps lock and move cancellation priorities distinct and leaves input activation explicit',()=>{
 const results=[];for(const composed of [false,true]){
  const f=interactionFixture(composed);assert.equal(f.controls.command,f.move);assert.deepEqual(f.listeners,[]);
  f.feature.command.toggleLock('S2');assert.deepEqual(f.names().slice(0,3),['pending-cancel','targets-cancel','exit']);f.state.scope.sketches.find(s=>s.id==='S2').locked=false;
  f.selection.set('points',[f.point]);f.owners.interaction.hover.update({point:f.point});f.calls.length=0;assert.equal(f.move.start(),true);assert.deepEqual(f.names().slice(0,4),['targets-cancel','pending-cancel','exit','hover-clear']);assert.equal(f.owners.interaction.hover.current.point,null);
  assert.equal(f.move.choose('S2'),true);assert.equal(f.move.commit(),true);assert.equal(f.point.sketchId,'S2');assert.equal(f.state.scope.points[0],f.point);assert.equal(f.calls.filter(c=>c[0]==='history').length,1);
  f.controls.input.bind();assert.equal(f.listeners.length,6);results.push(JSON.stringify({calls:f.calls,point:f.point}));
 }assert.equal(results[1],results[0]);
});

test('Sketch interaction composition propagates cancellation failures before lock or move state changes and later side effects',()=>{
 for(const stage of ['pending-cancel','targets-cancel','exit'])for(const operation of ['lock','move']){
  const results=[];for(const composed of [false,true]){
   const f=interactionFixture(composed);f.selection.set('points',[f.point]);f.state.pending={type:'distance-value'};f.state.target={type:'distance'};f.state.failStage=stage;const marker=new Error(stage);f.state.error=marker;
   assert.throws(()=>operation==='lock'?f.feature.command.toggleLock('S2'):f.move.start(),error=>error===marker);assert.equal(Boolean(f.state.scope.sketches.find(s=>s.id==='S2').locked),false);assert.equal(f.move.active,false);assert.equal(f.names().some(n=>['history','ui','draw','hover-clear'].includes(n)),false);
   results.push(JSON.stringify({calls:f.calls,pending:f.state.pending,target:f.state.target}));
  }assert.equal(results[1],results[0]);
 }
});

function treePresentationOptions(config) {
  const { objectOptions, ...options } = config;
  return { ...options, selection: Object.freeze({ visibilityIsHidden: objectOptions.isHidden }), analysis: objectOptions.analysis,
    redundancy: objectOptions.redundancy, referenceState: objectOptions.referenceState, projection: Object.freeze({ queries: objectOptions.projectionQueries }),
    icons: Object.freeze({ toolbarSvgMarkup: objectOptions.toolbarSvgMarkup, constraintToolbarIcon: objectOptions.constraintToolbarIcon }),
    feedback: Object.freeze({ geometryInstanceTypeLabel: objectOptions.geometryInstanceTypeLabel, hatchPatternTypeLabel: objectOptions.hatchPatternTypeLabel }),
    fixedState: Object.freeze({ findLineFixedConstraint: objectOptions.findLineFixedConstraint }) };
}

function editingTreeFixture(composed, navigation, useNavigationDefaults = false) {
  let ports, config;
  const original = w.SketchTreeController;
  w.SketchTreeController = { ...original, createWithDocumentObjects(input) { ports = input; return original.createWithDocumentObjects(input); } };
  try {
    const f = treeFixture((f, p) => {
      const o = f.owners, referenceState = { referenceConstraintErrorCountForSketch: p.referenceConstraintErrorCountForSketch },
        redundancy = { constraintDuplicateCountForSketch: p.constraintDuplicateCountForSketch };
      o.interaction.scope = w.CanvasSelection.createScopeQuery({ canvasSelection: f.selection, selectedGeometryItems: f.selection.selectedGeometryItems });
      o.interaction.pointUsage = { isExplicitPoint: () => true, isPointUsedByLine: () => false };
      o.readServices.reads.scopeGeometryItem = p.readServices.reads.scopeGeometryItem;
      Object.assign(o.presentation, { constraintFeedback: {}, updateSketchUI: p.updateSketchUI, updateGeometrySelectionUI: p.updateSelectionUI });
      f.state.keyReads = 0;
      const blockEditor = { get current() { assert.equal(f.state.ready, true); f.state.keyReads++; if (f.state.keyFailure) throw f.state.keyFailure; return f.state.treeSession; } };
      Object.assign(p, { readServices: o.readServices, canvasHover: o.interaction.hover, applicationSettings: o.presentation.settings,
        objectOptions: { ...p.objectOptions, referenceState, redundancy, constraintFeedback: o.presentation.constraintFeedback, pointUsage: o.interaction.pointUsage },
        getScopeKey: () => blockEditor.current?.draft?.id ? `block:${blockEditor.current.draft.id}` : 'document',
        toggleBlockInstanceSelection: f.selection.toggleBlockInstanceSelection, targetFromConstraint: w.DimensionQueries.targetFromConstraint,
        selectionSketchId: o.interaction.scope.selectionSketchId });
      config = { document: p.document, window: p.window, selectionHighlight: p.selectionHighlight, objectOptions: { ...p.objectOptions },
        escapeHtml: p.escapeHtml, closeCanvasContextMenu: p.closeCanvasContextMenu, moveCommand: p.moveCommand, deletion: p.deletion,
        blockEditor, editingScope: { get current() { return p.viewScope(); } }, solveState: { hasError: p.sketchHasSolveError }, dimensionScope: p.dimensionScope,
        deleteElements: p.deleteElements, deleteCurrentSelection: p.deleteCurrentSelection, toggleSelectedVisibility: p.toggleSelectedVisibility,
        fixedOperands: { unfixPoint: p.unfixPoint } };
      delete config.objectOptions.constraintFeedback; delete config.objectOptions.pointUsage;
      return composed === 'presentation' ? f.feature.createTreeForPresentation(treePresentationOptions(config))
        : composed ? f.feature.createTreeForEditing(config) : f.feature.createTree(p);
    }, () => interactionFixture(true, navigation, useNavigationDefaults));
    return { ...f, ports, config };
  } finally { w.SketchTreeController = original; }
}

test('editing Tree stage reuses captured interaction, presentation and command identities without early scope reads or menu start', () => {
  for (const composed of [false, true, 'presentation']) {
    const f = editingTreeFixture(composed), p = f.ports;
    assert.equal(Object.isFrozen(f.feature), true); assert.equal(f.feature, f.editing); assert.deepEqual(f.calls, []); assert.equal(f.state.keyReads, 0);
    assert.equal(p.canvasSelection, f.selection); assert.equal(p.canvasHover, f.owners.interaction.hover); assert.equal(p.readServices, f.owners.readServices);
    assert.equal(p.selectionHighlight, f.config.selectionHighlight); assert.equal(p.applicationSettings, f.owners.presentation.settings);
    assert.equal(p.objectOptions.pointUsage, f.owners.interaction.pointUsage); assert.equal(p.objectOptions.constraintFeedback, f.owners.presentation.constraintFeedback);
    assert.equal(p.moveCommand, f.move); assert.equal(p.setActiveSketch, f.feature.command.activate); assert.equal(p.deleteSketch, f.deletion.remove);
    assert.equal(p.updateSketchUI, f.owners.presentation.updateSketchUI); assert.equal(p.updateSelectionUI, f.owners.presentation.updateGeometrySelectionUI);
    assert.equal(p.targetFromConstraint, w.DimensionQueries.targetFromConstraint); assert.equal(p.unfixPoint, f.config.fixedOperands.unfixPoint);
    assert.equal(p.viewScope(), f.state.viewScope); assert.equal(p.currentScope(), f.state.dimensionScope); assert.notEqual(p.currentScope(), f.state.scope);
    f.state.viewScope = { sketches: [{ id: 'S1', name: 'Replacement' }] }; f.tree.view.render(); assert.equal(f.label.textContent, 'Drawing sketch: Replacement');
    for (const [session, expected, reads] of [[null, 'document', 1], [{ draft: { id: '' } }, 'document', 1], [{ draft: { id: 'BD1' } }, 'block:BD1', 2]]) {
      f.state.treeSession = session; f.state.keyReads = 0; assert.equal(p.getScopeKey(), expected); assert.equal(f.state.keyReads, reads);
    }
    const marker = new Error('scope key'); f.state.keyFailure = marker; assert.throws(() => p.getScopeKey(), error => error === marker);
    assert.equal(f.state.scope.activeSketchId, 'S1'); f.tree.menu.start(); f.tree.menu.dispose();
  }
});

test('editing Tree keeps live dimension objects and Hover separate from the command model and shares Block selection', () => {
  for (const composed of [false, true, 'presentation']) {
    const f = editingTreeFixture(composed), replacement = { ...f.point, id: 'P-new' };
    f.state.dimensionScope = { ...f.empty(), points: [replacement] };
    assert.equal(f.tree.objects.index().get('S1').point[0], replacement); assert.equal(f.state.scope.points[0], f.point);
    const annotation = { id: 'AN1' }; f.owners.interaction.hover.update({ annotation }); assert.equal(f.tree.objects.hovered('annotation', annotation), true);
    f.owners.interaction.hover.update({ annotation: null }); assert.equal(f.tree.objects.hovered('annotation', annotation), false);
    const block = { id: 'BI1', sketchId: 'S1' }; f.ports.toggleBlockInstanceSelection(block, false); assert.equal(f.selection.blockInstances[0], block);
    f.tree.controller.keyDown(f.event('S2', 'sketchActivateBtn')); assert.equal(f.selection.sketchId, 'S2'); assert.equal(f.state.scope.activeSketchId, 'S1');
    assert.deepEqual(f.names().slice(-3), ['selection', 'selection-ui', 'draw']);
  }
});

test('editing Tree visibility, locking and move completion use the same real commands and retain one history commit', () => {
  for (const composed of [false, true, 'presentation']) {
    const f = editingTreeFixture(composed), destination = f.state.scope.sketches.find(sketch => sketch.id === 'S2'); destination.appearance = { visible: false };
    f.tree.controller.click(f.event('S2', 'sketchVisibilityBtn')); assert.equal(destination.appearance.visible, true);
    f.tree.controller.click(f.event('S2', 'sketchLockBtn')); assert.equal(destination.locked, true);
    f.tree.controller.click(f.event('S2', 'sketchDeleteBtn')); assert.equal(f.state.scope.sketches.includes(destination), true);
    f.tree.controller.click(f.event('S2', 'sketchLockBtn')); assert.equal(destination.locked, false);
    f.selection.set('points', [f.point]); assert.equal(f.move.start(), true); f.tree.controller.keyDown(f.event('S2', 'sketchActivateBtn'));
    assert.equal(f.move.state().targetId, 'S2'); f.tree.controller.click(f.event('S2', null, 'commit'));
    assert.equal(f.move.active, false); assert.equal(f.point.sketchId, 'S2'); assert.equal(f.state.scope.points[0], f.point);
    assert.equal(f.calls.filter(call => call[0] === 'history' && call[1] === 'スケッチ間の図形移動').length, 1);
  }
});


function deletionOwnersFixture(composed, failConstruction = false, navigation) {
 const f=interactionFixture(true,navigation),{state,calls,owners}=f;
 state.ready=false;state.references=false;state.confirm=true;state.result={};state.error=new Error('deletion owner');
 const record=name=>function(){'use strict';assert.equal(this,undefined);assert.equal(state.ready,true);calls.push([name,...arguments]);if(state.failStage===name)throw state.error;return state.result;};
 owners.presentation.log=record('log');
 const deletion={rejectReferences(instances,label){assert.equal(this,deletion);assert.equal(arguments.length,2);record('references')(instances,label);return state.references;}},
  solveState={clearSketchSolveState:record('clear-solve')},solving={solveSketchAndDependents:record('solve')},
  analysis={invalidate(){assert.equal(this,analysis);return record('invalidate')(...arguments);},refresh(){assert.equal(this,analysis);return record('refresh')(...arguments);}};
 const config={deletion,solveState,solving,analysis,guardDimensionSymbolDeletion:()=>state.symbols,
  confirmDeletion:message=>{record('confirm')(message);return state.confirm;}};
 const raw={rejectReferencedGeometryDeletion:(instances,label)=>deletion.rejectReferences(instances,label),log:owners.presentation.log,
  geometryElementKey:w.GeometryObjects.geometryKeyForItem,guardDimensionSymbolDeletion:config.guardDimensionSymbolDeletion,
  annotationReferencesRemovedGeometry:w.AnnotationAnchorData.referencesRemovedGeometry,clearSketchSolveState:solveState.clearSketchSolveState,
  invalidateAnalysis:()=>{analysis.invalidate();},solveSketchAndDependents:solving.solveSketchAndDependents,
  refreshConstraintAnalysis:(options={})=>analysis.refresh(options),confirmDeletion:config.confirmDeletion};
 if(composed==='browser')delete config.confirmDeletion;
 const original=w.SketchDeletionCommand;let ports,command;
 w.SketchDeletionCommand={...original,create(input){ports=input;if(failConstruction)throw state.error;return original.create(input);}};
 try{
  if(failConstruction)assert.throws(()=>composed?f.feature.createDeletionForEditing(config):f.feature.createDeletion(raw),error=>error===state.error);
  else command=composed?f.feature.createDeletionForEditing(config):f.feature.createDeletion(raw);
 }finally{w.SketchDeletionCommand=original;}
 assert.deepEqual(calls,[]);state.ready=true;
 return {...f,command,ports,config,raw};
}

test('Sketch deletion owner assembly stays cold and preserves receiver, default refresh, void invalidation and exception contracts',()=>{
 const traces=[];
 for(const composed of [false,true]){
  const f=deletionOwnersFixture(composed),p=f.ports,items=[],options={refreshAnalysis:false};
  assert.equal(p.currentScope,f.owners.documentWorkspace.workspace.current);assert.equal(p.log,f.owners.presentation.log);
  assert.equal(p.clearSketchSolveState,f.config.solveState.clearSketchSolveState);assert.equal(p.solveSketchAndDependents,f.config.solving.solveSketchAndDependents);
  assert.equal(p.geometryElementKey,w.GeometryObjects.geometryKeyForItem);assert.equal(p.annotationReferencesRemovedGeometry,w.AnnotationAnchorData.referencesRemovedGeometry);
  assert.equal(p.rejectReferencedGeometryDeletion(items,'Sketch','ignored'),false);assert.equal(p.invalidateAnalysis('ignored'),undefined);
  assert.equal(p.refreshConstraintAnalysis(undefined,'ignored'),f.state.result);const defaults=f.calls.at(-1)[1];assert.deepEqual(Object.keys(defaults),[]);assert.equal(f.calls.at(-1).length,2);
  p.refreshConstraintAnalysis();assert.notEqual(f.calls.at(-1)[1],defaults);p.refreshConstraintAnalysis(options,'ignored');assert.equal(f.calls.at(-1)[1],options);
  p.refreshConstraintAnalysis(null);assert.equal(f.calls.at(-1)[1],null);
  for(const [stage,action]of [['references',()=>p.rejectReferencedGeometryDeletion(items,'S')],['invalidate',()=>p.invalidateAnalysis()],['refresh',()=>p.refreshConstraintAnalysis()]]){
   f.state.failStage=stage;assert.throws(action,error=>error===f.state.error);
  }
  traces.push(JSON.stringify(f.calls));
 }
 assert.equal(traces[1],traces[0]);
});

test('Sketch deletion owners preserve live Workspace deletion, guards, identity and one history update',()=>{
 for(const rejection of [null,'locked','references','symbols','confirm']){
  const results=[];
  for(const composed of [false,true]){
   const f=deletionOwnersFixture(composed),original=f.point,replacement=f.empty();
   const point=Object.assign(new w.GeometrySolver.Point('new',3,4),{sketchId:'S1'});replacement.points.push(point);f.state.scope=replacement;
   f.selection.set('points',[point]);
   if(rejection==='locked')replacement.sketches.find(s=>s.id==='S1').locked=true;
   if(rejection==='references')f.state.references=true;
   if(rejection==='symbols')f.state.symbols=false;
   if(rejection==='confirm')f.state.confirm=false;
   f.owners.documentWorkspace.sketches.ensureSketchState();
   const before=JSON.stringify(replacement),result=f.command.remove('S1');assert.equal(result,rejection===null);
   if(rejection){assert.equal(JSON.stringify(f.state.scope),before);assert.equal(f.state.scope.points[0],point);assert.equal(f.calls.filter(c=>c[0]==='history').length,0);}
   else{assert.equal(f.state.scope.points.length,0);assert.equal(f.state.scope.activeSketchId,'ROOT');assert.equal(f.selection.points.length,0);assert.equal(f.calls.filter(c=>c[0]==='history').length,1);
    const names=f.names();assert.ok(names.indexOf('invalidate')<names.indexOf('solve'));assert.ok(names.indexOf('solve')<names.indexOf('refresh'));assert.ok(names.indexOf('refresh')<names.indexOf('history'));}
   assert.equal(original.sketchId,'S1');results.push(JSON.stringify({scope:f.state.scope,calls:f.calls}));
  }
  assert.equal(results[1],results[0],String(rejection));
 }
});

test('Sketch deletion owners retain constructor and post-mutation failure boundaries',()=>{
 for(const composed of [false,true])deletionOwnersFixture(composed,true);
 for(const failure of ['clear-solve','invalidate','solve','refresh']){
  const results=[];
  for(const composed of [false,true]){
   const f=deletionOwnersFixture(composed);f.state.failStage=failure;
   assert.throws(()=>f.command.remove('S1',false),error=>error===f.state.error);
   assert.equal(f.state.scope.points.length,0);assert.equal(f.state.scope.sketches.some(s=>s.id==='S1'),false);
   assert.equal(f.calls.filter(c=>c[0]==='history').length,0);assert.equal(f.calls.at(-1)[0],failure);
   results.push(JSON.stringify({scope:f.state.scope,calls:f.calls}));
  }
  assert.equal(results[1],results[0],failure);
 }
});

test('Sketch navigation stays cold and publishes the actual move before separately enabled input', () => {
  const navigation = w.SketchEditingFeature.prepareNavigation();
  assert.ok(Object.isFrozen(navigation));
  assert.equal(navigation.closeContext(), undefined); assert.equal(navigation.resetMove(), undefined);
  assert.throws(() => navigation.readMoving(), error => error.name === 'TypeError');
  const original = w.SketchTreeController; let construction = 0;
  w.SketchTreeController = { ...original, createMoveInputBinding(options) {
    construction++;
    assert.throws(() => navigation.readMoving(), error => error.name === 'TypeError');
    return original.createMoveInputBinding(options);
  } };
  let f;
  try { f = interactionFixture(true, navigation); } finally { w.SketchTreeController = original; }
  assert.equal(construction, 1); assert.equal(f.controls.command, f.move); assert.equal(f.listeners.length, 0);
  assert.equal(navigation.readMoving(), false);
  f.selection.set('points', [f.point]); assert.equal(f.move.start(), true); assert.equal(navigation.readMoving(), true);
  navigation.resetMove(); assert.equal(f.move.active, false); assert.equal(navigation.readMoving(), false);
  f.controls.input.bind(); assert.equal(f.listeners.length, 6);
});

test('Sketch navigation keeps the prior move on constructor failure and keeps the new move on input bind failure', () => {
  for (const stage of ['command', 'input']) {
    const navigation = w.SketchEditingFeature.prepareNavigation(), f = interactionFixture(true, navigation);
    f.selection.set('points', [f.point]); assert.equal(f.move.start(), true);
    const marker = new Error(stage), originalCommand = w.SketchMoveCommand, originalTree = w.SketchTreeController;
    if (stage === 'command') w.SketchMoveCommand = { ...originalCommand, create() { throw marker; } };
    else w.SketchTreeController = { ...originalTree, createMoveInputBinding() { throw marker; } };
    try { assert.throws(() => f.feature.createMoveWithInput({ document: {} }), error => error === marker); }
    finally { w.SketchMoveCommand = originalCommand; w.SketchTreeController = originalTree; }
    assert.equal(navigation.readMoving(), true); navigation.resetMove(); assert.equal(f.move.active, false);
    const next = f.feature.createMoveWithInput({ document: { addEventListener() {
      assert.equal(navigation.readMoving(), next.command.active); throw marker;
    } } });
    assert.notEqual(next.command, f.move); assert.equal(navigation.readMoving(), false);
    assert.throws(() => next.input.bind(), error => error === marker);
    f.selection.set('points', [f.point]); assert.equal(next.command.start(), true);
    navigation.resetMove(); assert.equal(next.command.active, false);
  }
});

test('Sketch navigation publishes the actual menu only after successful Tree construction and before explicit start', () => {
  const navigation = w.SketchEditingFeature.prepareNavigation(), originalMenu = w.CanvasContextMenu;
  const events = [], result = {}, marker = new Error('menu boundary'); let failClose = false, failStart = true;
  w.CanvasContextMenu = { ...originalMenu, create(options) {
    const raw = originalMenu.create(options);
    const menu = Object.freeze({ ...raw, close: function() {
      'use strict'; assert.equal(this, menu); events.push('close'); if (failClose) throw marker; return result;
    }, start: function() {
      'use strict'; assert.equal(this, menu); events.push('start'); if (failStart) throw marker; return raw.start();
    } });
    return menu;
  } };
  let f;
  try { f = editingTreeFixture(true, navigation); } finally { w.CanvasContextMenu = originalMenu; }
  assert.deepEqual(events, []); assert.equal(navigation.closeContext(), result);
  assert.throws(() => f.tree.menu.start(), error => error === marker);
  assert.equal(navigation.closeContext(), result); failClose = true;
  assert.throws(() => navigation.closeContext(), error => error === marker); failClose = false;
  const originalTree = w.SketchTreeController;
  w.SketchTreeController = { ...originalTree, createWithDocumentObjects() { throw marker; } };
  try { assert.throws(() => f.feature.createTreeForEditing(f.config), error => error === marker); }
  finally { w.SketchTreeController = originalTree; }
  assert.equal(navigation.closeContext(), result);
  failStart = false; f.tree.menu.start(); f.tree.menu.dispose();
  const next = f.feature.createTreeForEditing(f.config);
  assert.notEqual(next.menu, f.tree.menu); assert.equal(navigation.closeContext(), false);
});

test('Sketch navigation references are independent between workspaces', () => {
  const a = w.SketchEditingFeature.prepareNavigation(), b = w.SketchEditingFeature.prepareNavigation();
  const fa = interactionFixture(true, a), fb = interactionFixture(true, b);
  fa.selection.set('points', [fa.point]); assert.equal(fa.move.start(), true);
  assert.equal(a.readMoving(), true); assert.equal(b.readMoving(), false);
  b.resetMove(); assert.equal(fa.move.active, true); assert.equal(fb.move.active, false);
  a.resetMove(); assert.equal(fa.move.active, false);
});

test('owned Sketch navigation keeps initialization guards and preserves supplied callbacks including explicit undefined', () => {
  const navigation = w.SketchEditingFeature.prepareNavigation();
  for (const [run, binding] of [[navigation.clearInteractionForSketchChange, 'sketchInteractionReset'],
    [navigation.toggleSketchVisibility, 'toggleSketchVisibilityCommand'], [navigation.isSidebarHighlightedElement, 'sketchTreeController'],
    [navigation.startContext, 'sketchContextController']]) {
    assert.throws(run, error => error.name === 'ReferenceError' && error.message === `Cannot access '${binding}' before initialization`);
  }
  assert.equal(navigation.closeContext(), undefined);
  const supplied = interactionFixture(true, navigation); assert.equal(navigation.toggleSketchVisibility('S2'), true);
  assert.ok(supplied.names().includes('hover'));
  const own = w.SketchEditingFeature.prepareNavigation(), f = interactionFixture(true, own, true);
  assert.throws(() => own.toggleSketchVisibility('S2'), error => error.name === 'ReferenceError' && error.message === "Cannot access 'sketchTreeController' before initialization");
  assert.equal(f.state.scope.sketches.find(sketch => sketch.id === 'S2').visible, true);
  const explicit = own.createForInteraction({ ...f.owners, clearInteractionForSketchChange: undefined, clearTreeHover: undefined });
  assert.throws(() => explicit.editing.command.activate('S2'), error => error.name === 'TypeError');
});

test('owned Sketch reset defaults preserve real activation, shared Selection and pointer, ordered reset and partial failure', () => {
  const results = [];
  for (const owned of [false, true]) {
    const navigation = w.SketchEditingFeature.prepareNavigation(), f = interactionFixture(true, navigation, owned);
    f.selection.set('points', [f.point]); f.owners.rawPointer.setLastPointer(f.point); f.state.pending = { type: 'distance-value' }; f.state.target = { type: 'distance' };
    f.feature.command.activate('S2'); assert.equal(f.state.scope.activeSketchId, 'S2'); assert.equal(f.selection.points.length, 0);
    f.state.failStage = 'geometry'; const marker = f.state.error = new Error('reset failed');
    assert.throws(() => owned ? navigation.clearInteractionForSketchChange('ignored') : f.reset.clear(), error => error === marker);
    results.push(JSON.stringify({ calls: f.calls, pending: f.state.pending, target: f.state.target, scope: f.state.scope }));
  }
  assert.equal(results[1], results[0]);
});

test('owned Sketch Tree navigation keeps actual Controller and Menu receivers, bare visibility calls and prior Tree after failure', () => {
  const navigation = w.SketchEditingFeature.prepareNavigation(), originals = { command: w.SketchCommand, tree: w.SketchTreeController, menu: w.CanvasContextMenu };
  const calls = [], value = {}, marker = new Error('Tree failed'); let fail = false;
  w.SketchCommand = { ...originals.command, create(options) { const raw = originals.command.create(options), toggle = raw.toggleVisibility;
    return Object.freeze({ ...raw, toggleVisibility: function(id) { 'use strict'; assert.equal(this, undefined); assert.equal(arguments.length, 1); calls.push(['toggle', id]); return toggle(id); } }); } };
  w.SketchTreeController = { ...originals.tree, createWithDocumentObjects(options) { const tree = originals.tree.createWithDocumentObjects(options), raw = tree.controller;
    const controller = Object.freeze({ ...raw, isHighlightedElement: function(item) { 'use strict'; assert.equal(this, controller); assert.equal(arguments.length, 1); calls.push(['highlight', item]); if (fail) throw marker; return value; },
      clearHoverSketch: function() { 'use strict'; assert.equal(this, controller); assert.equal(arguments.length, 0); calls.push(['hover']); if (fail) throw marker; return value; } }); return Object.freeze({ ...tree, controller }); } };
  w.CanvasContextMenu = { ...originals.menu, create(options) { const raw = originals.menu.create(options);
    const menu = Object.freeze({ ...raw, start: function() { 'use strict'; assert.equal(this, menu); assert.equal(arguments.length, 0); calls.push(['start']); if (fail) throw marker; return value; },
      close: function() { 'use strict'; assert.equal(this, menu); assert.equal(arguments.length, 0); calls.push(['close']); if (fail) throw marker; return value; } }); return menu; } };
  let f;
  try {
    f = editingTreeFixture(true, navigation, true); assert.deepEqual(calls, []);
    assert.equal(navigation.toggleSketchVisibility('S2', 'ignored'), true); assert.deepEqual(calls, [['toggle', 'S2'], ['hover']]);
    assert.equal(navigation.isSidebarHighlightedElement(f.point, 'ignored'), value); assert.equal(navigation.startContext('ignored'), value); assert.equal(navigation.closeContext('ignored'), value);
    fail = true; assert.throws(() => navigation.isSidebarHighlightedElement(f.point), error => error === marker); assert.throws(navigation.startContext, error => error === marker); fail = false;
    w.SketchTreeController = { ...originals.tree, createWithDocumentObjects() { throw marker; } };
    assert.throws(() => f.feature.createTreeForEditing(f.config), error => error === marker);
    assert.equal(navigation.isSidebarHighlightedElement(f.point), value); assert.equal(navigation.closeContext(), value);
    const separate = w.SketchEditingFeature.prepareNavigation(); assert.throws(() => separate.isSidebarHighlightedElement(f.point), error => error.name === 'ReferenceError');
  } finally { w.SketchCommand = originals.command; w.SketchTreeController = originals.tree; w.CanvasContextMenu = originals.menu; }
});

test('owned Sketch navigation publishes reset only after complete editing construction and retains the actual reset receiver', () => {
  const navigation = w.SketchEditingFeature.prepareNavigation(), original = w.SketchCommand, marker = new Error('editing failed'); let generation = 0, fail = false;
  w.SketchCommand = { ...original, create(options) { if (fail) throw marker; return original.create(options); },
    createInteractionReset(options) { const raw = original.createInteractionReset(options), value = { generation: ++generation };
      const reset = Object.freeze({ ...raw, clear: function() { 'use strict'; assert.equal(this, reset); assert.equal(arguments.length, 0); raw.clear(); return value; } }); return reset; } };
  try {
    const f = interactionFixture(true, navigation, true), first = navigation.clearInteractionForSketchChange('ignored'); assert.equal(first.generation, 1);
    fail = true; assert.throws(() => navigation.createForInteraction(f.owners), error => error === marker);
    assert.equal(navigation.clearInteractionForSketchChange(), first); assert.equal(generation, 2);
    const fresh = w.SketchEditingFeature.prepareNavigation(); assert.throws(() => fresh.createForInteraction(f.owners), error => error === marker);
    assert.throws(fresh.clearInteractionForSketchChange, error => error.name === 'ReferenceError');
  } finally { w.SketchCommand = original; }
});


test('presentation-owned Tree retains the published native Controller after field and Tree construction failure', () => {
  const navigation = w.SketchEditingFeature.prepareNavigation(), original = w.SketchTreeController;
  const marker = new Error('Tree presentation failed'); let fail = false, generation = 0;
  w.SketchTreeController = { ...original, createWithDocumentObjects(options) {
    if (fail) throw marker;
    const tree = original.createWithDocumentObjects(options), result = { generation: ++generation };
    const controller = Object.freeze({ ...tree.controller, isHighlightedElement(item) {
      assert.equal(this, controller); assert.equal(arguments.length, 1); assert.ok(item); return result;
    } });
    return Object.freeze({ ...tree, controller });
  } };
  try {
    const f = editingTreeFixture('presentation', navigation, true), first = navigation.isSidebarHighlightedElement(f.point);
    assert.equal(first.generation, 1); const options = treePresentationOptions(f.config);
    const badIcons = Object.freeze(Object.defineProperty({ ...options.icons }, 'toolbarSvgMarkup', { get() { throw marker; } }));
    assert.throws(() => f.feature.createTreeForPresentation({ ...options, icons: badIcons }), error => error === marker);
    assert.equal(generation, 1); assert.equal(navigation.isSidebarHighlightedElement(f.point), first);
    fail = true; assert.throws(() => f.feature.createTreeForPresentation(options), error => error === marker);
    assert.equal(navigation.isSidebarHighlightedElement(f.point), first);
    fail = false; const tree = f.feature.createTreeForPresentation(options);
    assert.equal(Object.isFrozen(tree), true); const next = navigation.isSidebarHighlightedElement(f.point);
    assert.equal(next.generation, 2); assert.notEqual(next, first);
    assert.equal(f.state.scope.points[0], f.point); assert.equal(f.state.keyReads, 0);
  } finally { w.SketchTreeController = original; }
});

function browserSketchNavigation(browserWindow, overrides) {
  const navigation = w.SketchEditingFeature.prepareNavigation();
  return { navigation, createForInteraction({ promptName, ...options }) { return navigation.createForBrowser({ window: browserWindow, ...options, ...overrides }); } };
}

test('Sketch browser name input stays cold, reads the live prompt method and retains rename cancellation, trimming and history', () => {
  let f, reads = 0, answer = null; const marker = new Error('prompt'), browser = {};
  Object.defineProperty(browser, 'prompt', { configurable: true, get() { reads++; return function(title, name) {
    assert.equal(this, browser); assert.equal(arguments.length, 2); assert.equal(title, 'スケッチ名'); assert.equal(name, f.state.scope.sketches.find(s => s.id === 'S1').name); return answer;
  }; } });
  const adapter = browserSketchNavigation(browser); f = interactionFixture(true, adapter);
  assert.equal(reads, 0); assert.deepEqual(f.calls, []);
  const original = f.state.scope.sketches.find(s => s.id === 'S1');
  for (const value of [null, '', '   ', '  Renamed  ']) { answer = value; const histories = f.calls.filter(c => c[0] === 'history').length; f.feature.command.rename('S1');
    assert.equal(f.state.scope.sketches.find(s => s.id === 'S1'), original); assert.equal(f.calls.filter(c => c[0] === 'history').length, histories + (value ? 1 : 0)); }
  assert.equal(original.name, 'Renamed'); assert.equal(reads, 4);
  Object.defineProperty(browser, 'prompt', { get() { throw marker; } }); const before = JSON.stringify(f.state.scope), history = f.calls.filter(c => c[0] === 'history').length;
  assert.throws(() => f.feature.command.rename('S1'), error => error === marker); assert.equal(JSON.stringify(f.state.scope), before); assert.equal(f.calls.filter(c => c[0] === 'history').length, history);
});

test('Sketch browser confirmation shares native deletion, preserves cancellation and uses live receiver, one argument and original exceptions', () => {
  for (const response of [false, true, 'throw']) {
    let f, reads = 0; const marker = new Error('confirm'), browser = { get confirm() { reads++; return function(message) {
      assert.equal(this, browser); assert.equal(arguments.length, 1); assert.equal(typeof message, 'string'); if (response === 'throw') throw marker; return response;
    }; } };
    f = deletionOwnersFixture('browser', false, browserSketchNavigation(browser)); assert.equal(reads, 0); assert.equal(f.ports.confirmDeletion.name, 'confirmDeletion'); assert.equal(f.ports.confirmDeletion.length, 1);
    f.owners.documentWorkspace.sketches.ensureSketchState(); const before = JSON.stringify(f.state.scope), point = f.point;
    if (response === 'throw') assert.throws(() => f.command.remove('S1'), error => error === marker); else assert.equal(f.command.remove('S1'), response);
    assert.equal(reads, 1); if (response !== true) { assert.equal(JSON.stringify(f.state.scope), before); assert.equal(f.state.scope.points[0], point); assert.equal(f.calls.some(c => c[0] === 'history'), false); }
    else { assert.equal(f.state.scope.points.length, 0); assert.equal(f.calls.filter(c => c[0] === 'history').length, 1); }
  }
});

test('Sketch browser adapters preserve explicit null or undefined dialog overrides without reading browser methods', () => {
  const marker = new Error('browser must stay unread'), browser = new Proxy({}, { get() { throw marker; } });
  for (const value of [undefined, null]) {
    const f = interactionFixture(true, browserSketchNavigation(browser, { promptName: value })); assert.throws(() => f.feature.command.rename('S1'), error => error.name === 'TypeError');
    const d = deletionOwnersFixture('browser', false, browserSketchNavigation(browser)); const command = d.feature.createDeletionForEditing({ ...d.config, confirmDeletion: value });
    d.owners.documentWorkspace.sketches.ensureSketchState(); const before = JSON.stringify(d.state.scope); assert.throws(() => command.remove('S1'), error => error.name === 'TypeError'); assert.equal(JSON.stringify(d.state.scope), before);
  }
});
