const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window;
function fixture({ withMenu = false, withEditingOwners = false, buildScene = null } = {}) {
  const calls = [], selection = w.CanvasSelection.create(), hover = w.CanvasHover.create({ isEndpointPoint: point => point.kind === 'endpoint' });
  const state = { ready: false, candidates: [], pointer: { x: 10, y: 20 }, geometryMode: true, cancellable: false, mode: 'select', batch: null, allowed: true, group: null, opened: null };
  const constraintTargetSession = { command: null };
  const notify = name => (...args) => { assert.equal(state.ready, true); if (withMenu && ['operand', 'undo'].includes(name)) assert.equal(dom.menu.hidden, true); calls.push([name, ...args]); };
  const options = {
    canvasSelection: selection, canvasHover: hover, sameArcEndpoint: (a,b) => a?.arc === b?.arc && a?.endpoint === b?.endpoint,
    clearSelection: () => { calls.push('clear'); selection.clear(); }, arcEndpointPoint: w.GeometryKernel.arcEndpointPoint,
    selectedFixedBatchTargets: () => { assert.equal(state.ready, true); return state.batch; }, fixedBatchIsFullyFixed: () => true,
    findLineFixedConstraint: () => null, findArcEndpointFixedConstraint: () => null, selectedGeometryItems: selection.selectedGeometryItems,
    readMode: () => state.mode, sketchProjectionCommand: { count: 1 }, applicationText: (_ja, en) => en,
    document: { getElementById: () => { assert.equal(state.ready, true); return null; } }, canCreateInActiveSketch: () => true, visibleGeometryBounds: () => ({}),
    pendingCommandSession: { current: null }, constraintTargetSession, splineEditing: { current: null }, isReadOnlyDimension: () => false,
    selectedDimensionLineGroup: () => state.group, blockDefinitionScopeError: () => null, blockDefinitionEditError: () => null,
    selectedConstructionTogglePrimitives: () => [], drawingOrderCommandState: () => ({ canForward: true, canBackward: true }),
    hasCopyableCanvasSelection: () => true, hasSelection: () => true, handleConstraintOperandClick: notify('operand'), updateUI: notify('ui'), draw: () => calls.push('draw'),
    canvasContextMenu: {}, isGeometryMode: () => state.geometryMode, closeAppMenus: () => calls.push('close-menus'), canvasPoint: () => { calls.push('point'); return state.pointer; },
    setLastPointer: notify('pointer'), hasCancellableCanvasCommand: () => state.cancellable,
    canvasContextCandidatesAt: pointer => { calls.push(['query', pointer]); return state.candidates; }, canvasContextController: { open: value => { state.opened = value; calls.push(['open', value]); } },
    guardSelectionEdit: () => { calls.push('guard-selection'); return state.allowed; }, guardSketchEdit: (...args) => { calls.push(['guard-sketch', ...args]); return true; },
    elementSketchId: item => item.sketchId, selectionSketchId: () => 'S1', activeSketchId: () => 'S1',
    commitSketchProjectionCommand: notify('projection'), cancelCanvasCommandFromContextMenu: notify('cancel'), undoHistory: notify('undo'), redoHistory: notify('redo'),
    copySelectionToClipboard: notify('copy'), imageClipboard: { pasteFromMenu: notify('paste') }, showSelectedObjectProperties: notify('properties'),
    fixPointBtn: { click: notify('fix') }, dimensionLineGroup: { align: group => { calls.push(['align', group]); return true; } }, updateGeometrySelectionUI: () => calls.push('selection-ui'),
    recordHistory: notify('history'), setHint: notify('hint'), addSplineFitPointFromContext: notify('spline-add'), fitVisibleGeometryToViewport: () => true,
  };
  let interaction, menuFeature, dom, editingOwners, scene;
  if (withMenu) {
    dom = menuSurfaces();
    menuFeature = w.CanvasContextInteraction.createMenu({
      document: dom.document, window: dom.window, canvas: dom.canvas, escapeHtml: String,
      applicationText: options.applicationText, canvasHover: hover, draw: options.draw,
      readInteraction: () => { assert.equal(state.ready, true); return interaction; },
      readPresentation: () => { assert.equal(state.ready, true); return scene ? scene.presentCandidate : function(target) {
        'use strict'; assert.equal(this, undefined);
        return { icon: '', type: target.kind, id: target.item.id, secondary: '' };
      }; },
    });
    if (withEditingOwners) {
      editingOwners = { selection, selectionScope: { selectionSketchId: options.selectionSketchId },
        sketches: { activeSketchId: options.activeSketchId, elementSketchId: options.elementSketchId },
        access: { guardSketchEdit: options.guardSketchEdit, guardSelectionEdit: options.guardSelectionEdit, canCreateInActiveSketch: options.canCreateInActiveSketch },
        constraintSelection: { fixedBatch: options.selectedFixedBatchTargets, fullyFixed: options.fixedBatchIsFullyFixed },
        blockQueries: { blockDefinitionScopeError: options.blockDefinitionScopeError, blockDefinitionEditError: options.blockDefinitionEditError },
        dimensions: { selectedLineGroup: options.selectedDimensionLineGroup, lineGroup: options.dimensionLineGroup },
        cancellation: { hasCancellable: options.hasCancellableCanvasCommand, cancel: options.cancelCanvasCommandFromContextMenu },
        clipboard: { canOfferCopy: options.hasCopyableCanvasSelection }, history: { undo: options.undoHistory, redo: options.redoHistory },
        pointer: { setLastPointer: options.setLastPointer }, viewport: { canvasPoint: options.canvasPoint },
        projection: { ...options.sketchProjectionCommand, commit: options.commitSketchProjectionCommand } };
      const remaining = { ...options };
      for (const key of ['canvasSelection','selectedGeometryItems','hasSelection','selectionSketchId','activeSketchId','elementSketchId',
        'guardSketchEdit','guardSelectionEdit','canCreateInActiveSketch','selectedFixedBatchTargets','fixedBatchIsFullyFixed',
        'blockDefinitionScopeError','blockDefinitionEditError','selectedDimensionLineGroup','dimensionLineGroup',
        'hasCancellableCanvasCommand','cancelCanvasCommandFromContextMenu','hasCopyableCanvasSelection','undoHistory','redoHistory',
        'setLastPointer','canvasPoint','sketchProjectionCommand','commitSketchProjectionCommand']) delete remaining[key];
      if (buildScene) { const built = buildScene({ menuFeature, remaining, editingOwners, options, state, calls }); scene = built.scene; interaction = built.interaction; }
      else interaction = menuFeature.createEditingInteraction({ ...remaining, ...editingOwners });
    } else interaction = menuFeature.createInteraction(options);
  } else interaction = w.CanvasContextInteraction.create(options);
  assert.deepEqual(calls, []); state.ready = true;
  const event = { preventDefault: () => calls.push('prevent') };
  const point = id => Object.assign(new w.GeometrySolver.Point(id, 1, 2), { sketchId: 'S1' });
  return { interaction, state, calls, selection, hover, constraintTargetSession, event, point, menuFeature, dom, editingOwners, scene };
}

test('single-target entry preserves the selected set and computes current Fix items through the same selection', () => {
  const f = fixture(), a = f.point('P1'), b = f.point('P2'); a.fixed = b.fixed = true;
  f.selection.set('points', [a,b]); f.state.candidates = [{ kind: 'point', item: a }]; f.interaction.open(f.event);
  assert.deepEqual(Array.from(f.selection.points), [a,b]); assert.equal(f.state.opened.target, f.state.candidates[0]); assert.equal(f.state.opened.pointer, f.state.pointer);
  assert.equal(f.state.opened.items.find(item => item.action === 'fix-toggle').label, 'Unfix');
  assert.deepEqual(f.calls.map(call => Array.isArray(call) ? call[0] : call), ['prevent', 'close-menus', 'point', 'pointer', 'query', 'ui', 'draw', 'open']);
  b.fixed = false; f.interaction.open(f.event); assert.equal(f.state.opened.items.find(item => item.action === 'fix-toggle').label, 'Fix');
});

test('overlapping candidates preview without selection edits and confirm via ordinary replacement or the latest constraint command', () => {
  const f = fixture(), a = f.point('P1'), b = f.point('P2'); f.selection.set('points', [a,b]);
  const target = { kind: 'point', item: a }; f.state.candidates = [target, { kind: 'point', item: b }]; f.interaction.open(f.event);
  assert.equal(f.state.opened.showCandidates, true); assert.equal(f.state.opened.items.length, 0); assert.equal(f.calls.includes('clear'), false);
  f.hover.update({ line: {} }); f.calls.length = 0; f.interaction.preview(target);
  assert.equal(f.hover.current.point, a); assert.equal(f.hover.current.line, null); assert.deepEqual(Array.from(f.selection.points), [a,b]); assert.deepEqual(f.calls, ['draw']);
  f.calls.length = 0; f.interaction.selectCandidate(target, f.state.pointer); assert.deepEqual(Array.from(f.selection.points), [a]); assert.equal(f.calls[0], 'clear'); assert.equal(f.calls[1][0], 'ui'); assert.equal(f.calls.at(-1), 'draw');
  f.constraintTargetSession.command = { type: 'parallel' }; f.calls.length = 0; f.interaction.selectCandidate({ kind: 'point', item: b }, f.state.pointer);
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0][0], 'operand'); assert.equal(f.calls[0][1], f.state.pointer); assert.equal(f.calls[0][2], 'parallel'); assert.equal(f.calls[0][3].hitP, b); assert.deepEqual(Array.from(f.selection.points), [a]);
});

test('cancellation suppresses candidate queries except for an active constraint command and keeps command items and mode guards', () => {
  const f = fixture(); f.state.cancellable = true; f.state.mode = 'sketch-projection'; f.state.candidates = [{ kind: 'point', item: f.point('P1') }];
  f.interaction.open(f.event); assert.equal(f.calls.some(call => call[0] === 'query'), false); assert.equal(f.state.opened.showCandidates, false);
  assert.deepEqual(Array.from(f.state.opened.items.filter(item => item.action).map(item => item.action)), ['sketch-projection-commit', 'cancel-command', 'undo', 'redo']);
  f.constraintTargetSession.command = { type: 'horizontal' }; f.calls.length = 0; f.interaction.open(f.event);
  assert.equal(f.calls.some(call => call[0] === 'query'), true); assert.equal(f.state.opened.showCandidates, true); assert.equal(f.state.opened.items.length, 0);
  f.state.geometryMode = false; f.calls.length = 0; f.interaction.open(f.event); assert.deepEqual(f.calls, []);
});

test('action execution keeps existing edit guards, pointer identities and dimension history/update sequencing', () => {
  const f = fixture(), item = { id: 'SP1', sketchId: 'S1' }, target = { kind: 'spline', item };
  assert.equal(f.interaction.execute('spline-fit-point-add', target, f.state.pointer), undefined);
  assert.deepEqual(f.calls, ['guard-selection', ['guard-sketch', 'S1'], ['guard-sketch', 'S1', 'structure'], ['spline-add', item, f.state.pointer]]);
  f.state.allowed = false; f.calls.length = 0; f.interaction.execute('spline-fit-point-add', target, f.state.pointer); assert.deepEqual(f.calls, ['guard-selection']);
  f.state.allowed = true; f.state.group = { reference: {} }; f.calls.length = 0; f.interaction.execute('dimension-align', { kind: 'dimension', item }, f.state.pointer);
  assert.deepEqual(f.calls.slice(0, 5), ['guard-selection', ['guard-sketch', 'S1'], ['align', f.state.group], 'selection-ui', 'draw']);
  assert.equal(f.calls[5][0], 'history'); assert.equal(f.calls[6][0], 'hint');
});

function menuSurfaces() {
  function surface() {
    const handlers = new Map();
    return { addEventListener(type, handler) { const set = handlers.get(type) || new Set(); set.add(handler); handlers.set(type, set); },
      removeEventListener(type, handler) { handlers.get(type)?.delete(handler); },
      fire(type, event = {}) { for (const handler of handlers.get(type) || []) handler(event); },
      count() { return [...handlers.values()].reduce((sum, set) => sum + set.size, 0); } };
  }
  const document = surface(), window = surface(), canvas = surface(), menu = surface(), classes = new Set();
  const button = index => ({ dataset: { contextCandidateIndex: String(index) }, contains: () => false,
    closest(selector) { return selector === '[data-context-candidate-index]' ? this : null; },
    focus() { document.activeElement = this; } });
  Object.assign(menu, { hidden: true, innerHTML: '', style: {}, classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
    setAttribute() {}, getBoundingClientRect: () => ({ width: 100, height: 80 }), contains: value => Boolean(value?.dataset),
    querySelector: () => button(0) });
  canvas.closest = () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 200 }) });
  document.getElementById = id => id === 'canvasContextMenu' ? menu : null;
  return { document, window, canvas, menu, button };
}

test('phased menu shares actual selection and hover, restores previews and binds only at explicit start', () => {
  const f = fixture({ withMenu: true }), { controller } = f.menuFeature, { menu, canvas, document, window, button } = f.dom;
  const a = f.point('P1'), b = f.point('P2'), originalLine = { id: 'L1' };
  f.selection.set('points', [a]); f.hover.update({ line: originalLine });
  f.state.candidates = [{ kind: 'point', item: a }, { kind: 'point', item: b }];
  canvas.fire('contextmenu', f.event); assert.equal(menu.hidden, true); assert.deepEqual(f.calls, []);
  controller.start(); const listenerCount = menu.count(); controller.start(); assert.equal(menu.count(), listenerCount);
  canvas.fire('contextmenu', f.event); assert.equal(menu.hidden, false); assert.match(menu.innerHTML, /P2/);
  assert.deepEqual(Array.from(f.selection.points), [a]);
  menu.fire('pointerover', { target: button(1), relatedTarget: null });
  assert.equal(f.hover.current.point, b); assert.equal(f.hover.current.line, null); assert.deepEqual(Array.from(f.selection.points), [a]);
  controller.close(); assert.equal(f.hover.current.line, originalLine); assert.equal(f.hover.current.point, null);
  canvas.fire('contextmenu', f.event); menu.fire('click', { target: button(1) });
  assert.equal(menu.hidden, true); assert.deepEqual(Array.from(f.selection.points), [b]); assert.equal(f.hover.current.line, null);
  controller.dispose(); assert.equal(menu.count() + canvas.count() + document.count() + window.count(), 0);
  f.calls.length = 0; canvas.fire('contextmenu', f.event); assert.deepEqual(f.calls, []);
});

test('menu confirmation reads latest constraint command and forwards original target/pointer; action closes before dispatch', () => {
  const f = fixture({ withMenu: true }), { controller } = f.menuFeature, { menu, canvas, button } = f.dom;
  const a = f.point('P1'), b = f.point('P2'); f.selection.set('points', [a]);
  f.state.candidates = [{ kind: 'point', item: a }, { kind: 'point', item: b }];
  controller.start(); canvas.fire('contextmenu', f.event);
  f.constraintTargetSession.command = { type: 'horizontal' }; f.calls.length = 0;
  menu.fire('click', { target: button(1) });
  const operand = f.calls.find(call => call[0] === 'operand');
  assert.equal(operand[1], f.state.pointer); assert.equal(operand[2], 'horizontal'); assert.equal(operand[3].hitP, b);
  assert.deepEqual(Array.from(f.selection.points), [a]); assert.equal(menu.hidden, true);
  f.constraintTargetSession.command = null; f.state.cancellable = true; canvas.fire('contextmenu', f.event);
  f.calls.length = 0;
  const action = { disabled: false, dataset: { contextAction: 'undo' }, closest(selector) { return selector === '[data-context-action]' ? this : null; } };
  menu.fire('click', { target: action }); assert.equal(menu.hidden, true); assert.equal(f.calls.find(call => call[0] === 'undo').length, 1);
  controller.dispose();
});

test('editing-owner menu preserves shared selection, live command routing and preview restoration across its explicit lifecycle',()=>{
 const f=fixture({withMenu:true,withEditingOwners:true}),{controller}=f.menuFeature,{canvas,menu,button}=f.dom;
 const a=f.point('P1'),b=f.point('P2'),original={id:'L1'};f.selection.set('points',[a]);f.hover.update({line:original});
 f.state.candidates=[{kind:'point',item:a},{kind:'point',item:b}];
 canvas.fire('contextmenu',f.event);assert.equal(menu.hidden,true);assert.deepEqual(f.calls,[]);
 controller.start();canvas.fire('contextmenu',f.event);assert.equal(menu.hidden,false);
 menu.fire('pointerover',{target:button(1),relatedTarget:null});assert.equal(f.hover.current.point,b);assert.equal(f.selection.points[0],a);
 controller.close();assert.equal(f.hover.current.line,original);assert.equal(f.selection.points[0],a);
 canvas.fire('contextmenu',f.event);f.constraintTargetSession.command={type:'horizontal'};f.calls.length=0;
 menu.fire('click',{target:button(1)});assert.equal(menu.hidden,true);assert.equal(f.selection.points[0],a);
 const operand=f.calls.find(c=>c[0]==='operand');assert.equal(operand[1],f.state.pointer);assert.equal(operand[3].hitP,b);
 controller.dispose();assert.equal(menu.count()+canvas.count()+f.dom.document.count()+f.dom.window.count(),0);
});

test('editing-owner menu uses original cancellation, guards, dimension group and history without live method replacement',()=>{
 const f=fixture({withMenu:true,withEditingOwners:true}),target={kind:'dimension',item:{id:'D1',sketchId:'S1'}};
 f.state.cancellable=true;f.state.mode='sketch-projection';f.interaction.open(f.event);
 assert.equal(f.calls.some(c=>c[0]==='query'),false);
 assert.deepEqual(Array.from(f.dom.menu.hidden?[]:f.dom.menu.innerHTML.match(/cancel-command/g)||[]),['cancel-command']);
 f.calls.length=0;f.interaction.execute('cancel-command',null,f.state.pointer);assert.deepEqual(f.calls,[['cancel']]);
 f.calls.length=0;f.state.allowed=false;f.interaction.execute('dimension-align',target,f.state.pointer);assert.deepEqual(f.calls,['guard-selection']);
 f.calls.length=0;f.state.allowed=true;f.state.group={reference:{}};
 f.interaction.execute('dimension-align',target,f.state.pointer);
 assert.deepEqual(f.calls.slice(0,5),['guard-selection',['guard-sketch','S1'],['align',f.state.group],'selection-ui','draw']);assert.equal(f.calls[5][0],'history');
 f.calls.length=0;f.editingOwners.history.undo=()=>{throw Error('replacement must not be read');};f.menuFeature.controller.close();
 f.interaction.execute('undo',null,f.state.pointer);assert.equal(f.calls.at(-1)[0],'undo');
});


function sceneFixture(composed, probe = {}) {
  probe.order = []; probe.ports = {}; probe.results = {};
  const f = fixture({ withMenu: true, withEditingOwners: true, buildScene({ menuFeature, remaining, editingOwners, options, state, calls }) {
    state.sceneScope = Object.fromEntries(['points', 'lines', 'circles', 'arcs', 'splines', 'constraints', 'annotations', 'hatches', 'blockInstances', 'geometryInstances', 'referenceImages'].map(key => [key, []]));
    state.definitions = []; const ready = () => assert.equal(state.ready, true), allow = () => { ready(); return true; };
    const sceneQueries = { createContextQuery(input) { assert.equal(this, sceneQueries); probe.order.push('query'); probe.ports.query = input; if (probe.failAt === 'query') throw probe.error;
      return probe.results.query = w.CanvasContextQuery.create({ ...input, currentScope: () => { ready(); if (state.queryError) throw state.queryError; calls.push('scene-query'); return state.sceneScope; },
        viewportScale: () => 1, canvasContextPointIsSelectable: allow, sketches: { isEditableSketchId: allow, isVisibleSketchId: allow, isEditableSketchElement: allow,
          isVisibleSketchElement: allow, activeSketchId: editingOwners.sketches.activeSketchId, isActiveSketchConstraint: allow, constraintSketchId: item => item.sketchId },
        projections: {}, dimensions: {}, annotations: { canvasContextAnnotationHit: input.canvasContextAnnotationHit }, hatches: {} }); } };
    const catalog = w.BlockCatalog.create({ definitions: () => { ready(); return state.definitions; } });
    const candidates = { toolbarSvgMarkup: selector => { ready(); return selector; }, formatDisplayNumber: value => { ready(); return String(value); },
      constraintToolbarIcon: () => { ready(); return 'icon'; }, localizedConstraintName: value => { ready(); return value; },
      geometryInstanceTypeLabel: () => 'instance', hatchPatternTypeLabel: () => 'hatch', hatchAppearanceForDisplay: () => ({}) };
    const input = { sceneQueries, splineEditing: options.splineEditing, canvasContextAnnotationHit: () => null,
      documentWorkspace: { sketches: editingOwners.sketches }, readServices: { catalog },
      interaction: { selection: editingOwners.selection, scope: editingOwners.selectionScope, access: editingOwners.access, lifecycle: { readMode: options.readMode } },
      sessions: { pointer: editingOwners.pointer, pending: options.pendingCommandSession, targets: options.constraintTargetSession }, candidates };
    probe.input = input; const originals = new Map();
    for (const [namespace, method, name] of [['CanvasContextPresentation', 'create', 'presentation'], ['CanvasContextMenu', 'createEntry', 'entry'], ['CanvasContextActions', 'create', 'actions']]) {
      const original = w[namespace]; originals.set(namespace, original); w[namespace] = { ...original, [method](ports) {
        probe.order.push(name); probe.ports[name] = ports; if (probe.failAt === name) throw probe.error;
        return probe.results[name] = original[method](ports);
      } };
    }
    try {
      let scene;
      if (composed) scene = menuFeature.createSceneForEditing(input);
      else {
        const { candidatesAt } = sceneQueries.createContextQuery({ editedFitPoints: () => options.splineEditing.current?.spline?.fitPoints, canvasContextAnnotationHit: input.canvasContextAnnotationHit });
        const presentCandidate = w.CanvasContextPresentation.create({ ...candidates, applicationText: options.applicationText, blockDefinitionById: catalog.blockDefinitionById });
        scene = { presentCandidate, createInteraction: options => menuFeature.createEditingInteraction({ ...options, ...editingOwners,
          readMode: input.interaction.lifecycle.readMode, pendingCommandSession: input.sessions.pending, constraintTargetSession: input.sessions.targets,
          splineEditing: input.splineEditing, canvasContextCandidatesAt: candidatesAt }) };
      }
      assert.deepEqual(probe.order, ['query', 'presentation']); assert.deepEqual(calls, []); probe.order.push('between');
      const later = { ...remaining, ...editingOwners };
      for (const key of ['selection', 'selectionScope', 'sketches', 'access', 'pointer', 'readMode', 'pendingCommandSession', 'constraintTargetSession', 'splineEditing', 'canvasContextCandidatesAt']) delete later[key];
      return { scene, interaction: scene.createInteraction(later) };
    } finally { for (const [namespace, original] of originals) w[namespace] = original; }
  } });
  return { ...f, probe };
}

test('context scene constructs actual query and candidate formatter before later menu interaction without eager scope or presentation reads', () => {
  for (const composed of [false, true]) {
    const f = sceneFixture(composed), { ports, results, input } = f.probe;
    assert.deepEqual(f.probe.order, ['query', 'presentation', 'between', 'entry', 'actions']); assert.deepEqual(f.calls, []);
    assert.equal(f.scene.presentCandidate, results.presentation); assert.equal(ports.entry.canvasContextCandidatesAt, results.query.candidatesAt);
    assert.equal(ports.query.canvasContextAnnotationHit, input.canvasContextAnnotationHit); assert.equal(ports.actions.activeSketchId, input.documentWorkspace.sketches.activeSketchId);
    assert.equal(f.dom.canvas.count(), 0); const point = f.point('P1'); Object.assign(point, f.state.pointer); f.state.sceneScope.points.push(point);
    assert.equal(results.query.candidatesAt(f.state.pointer)[0].item, point);
    assert.equal(f.scene.presentCandidate({ kind: 'point', item: point }).secondary, 'X 10 / Y 20');
    f.state.definitions.push({ id: 'BD1', name: 'Live part' });
    assert.match(JSON.stringify(f.scene.presentCandidate({ kind: 'block', item: { id: 'B1', definitionId: 'BD1' } })), /Live part/);
    if (composed) assert.equal(Object.isFrozen(f.scene), true);
  }
});

test('context scene keeps current spline ranking, menu hover restoration and late constraint selection with original Geometry and pointer identities', () => {
  for (const composed of [false, true]) {
    const f = sceneFixture(composed), a = f.point('P1'), b = f.point('P2'), line = { id: 'hover-line' };
    Object.assign(a, { x: 10, y: 20 }); Object.assign(b, { x: 10.5, y: 20 }); f.state.sceneScope.points.push(a, b); f.selection.set('points', [a]);
    f.probe.input.splineEditing.current = { spline: { fitPoints: [b] } };
    assert.equal(f.probe.results.query.candidatesAt(f.state.pointer)[0].item, b); f.probe.input.splineEditing.current = null;
    f.hover.update({ line }); f.menuFeature.controller.start(); f.dom.canvas.fire('contextmenu', f.event);
    assert.equal(f.dom.menu.hidden, false); assert.match(f.dom.menu.innerHTML, /P1/); assert.match(f.dom.menu.innerHTML, /P2/);
    const second = f.probe.results.query.candidatesAt(f.state.pointer)[1].item;
    f.dom.menu.fire('pointerover', { target: f.dom.button(1), relatedTarget: null }); assert.equal(f.hover.current.point, second); assert.deepEqual(Array.from(f.selection.points), [a]);
    f.menuFeature.controller.close(); assert.equal(f.hover.current.line, line);
    f.constraintTargetSession.command = { type: 'horizontal' }; f.calls.length = 0; f.dom.canvas.fire('contextmenu', f.event);
    const first = f.probe.results.query.candidatesAt(f.state.pointer)[0].item; f.dom.menu.fire('click', { target: f.dom.button(0) });
    const operand = f.calls.find(call => Array.isArray(call) && call[0] === 'operand'); assert.equal(operand[1], f.state.pointer); assert.equal(operand[2], 'horizontal'); assert.equal(operand[3].hitP, first);
    assert.equal(f.dom.menu.hidden, true); assert.deepEqual(Array.from(f.selection.points), [a]);
  }
});

test('context scene preserves query and formatter failure stages and leaves selection intact when the runtime query throws', () => {
  const sequence = ['query', 'presentation', 'between', 'entry', 'actions'];
  for (const composed of [false, true]) {
    for (const failAt of ['query', 'presentation', 'entry', 'actions']) {
      const probe = { failAt, error: new Error(failAt) }; assert.throws(() => sceneFixture(composed, probe), error => error === probe.error);
      assert.deepEqual(probe.order, sequence.slice(0, sequence.indexOf(failAt) + 1));
    }
    const f = sceneFixture(composed), point = f.point('P1'); f.selection.set('points', [point]); f.state.queryError = new Error('query runtime');
    assert.throws(() => f.interaction.open(f.event), error => error === f.state.queryError); assert.deepEqual(Array.from(f.selection.points), [point]); assert.equal(f.dom.menu.hidden, true);
  }
});
