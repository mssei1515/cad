const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window;
function fixture(configureMove, buildMove = (feature, options) => feature.createMove(options)) {
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
  const feature = w.SketchEditingFeature.create({ currentScope: read, sketches, ids, selection, constraintReferences,
    geometryReads, projections, clearSelection: () => { calls.push(['selection']); selection.clear(); },
    clearInteractionForSketchChange: () => { calls.push(['interaction']); state.move?.reset(); },
    applicationText: (_ja,en) => { assert.equal(state.ready, true); return en; }, setHint: notify('hint'), updateUI: notify('ui'),
    draw: notify('draw'), recordHistory: notify('history'), promptName: () => null,
    effectiveAppearanceForElement: item => ({ ...state.scope.sketches.find(sketch => sketch.id === item.sketchId)?.appearance, ...item.appearance }), clearTreeHover: notify('hover'), clearSnap: notify('snap'),
    guardEdit: () => true, prepareLockToggle: notify('lock') });
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

function treeFixture() {
  const f = fixture(), domReads = [], label = { textContent: '' }, document = new EventTarget(), browser = new EventTarget();
  document.getElementById = id => { domReads.push(id); return id === 'activeSketchLabel' ? label : null; };
  document.querySelectorAll = () => [];
  const canvasHover = w.CanvasHover.create({ isEndpointPoint: () => false });
  const selectionHighlight = w.SelectionHighlight.create({ canvasSelection: f.selection, types: w.GeometrySolver,
    constraintGraphNodes: () => [], targetFromConstraint: () => null, getHoveredDimension: () => canvasHover.current.dimension,
    setHoveredDimension: value => canvasHover.update({ dimension: value }), draw: () => f.calls.push(['hover-draw']) });
  f.state.dimensionScope = { ...f.state.scope, sketches: [...f.state.scope.sketches, { id: 'dimension-only', name: 'Dimension scope' }] };
  f.state.viewScope = { sketches: [{ id: 'S1', name: 'Bound view' }] }; f.state.ready = false;
  const read = field => { assert.equal(f.state.ready, true); return f.state[field]; };
  const tree = f.feature.createTree({ document, window: browser, readServices: { reads: { scopeGeometryItem: () => f.point } },
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
