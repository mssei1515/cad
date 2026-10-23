const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window;
function fixture({ withMenu = false } = {}) {
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
  let interaction, menuFeature, dom;
  if (withMenu) {
    dom = menuSurfaces();
    menuFeature = w.CanvasContextInteraction.createMenu({
      document: dom.document, window: dom.window, canvas: dom.canvas, escapeHtml: String,
      applicationText: options.applicationText, canvasHover: hover, draw: options.draw,
      readInteraction: () => { assert.equal(state.ready, true); return interaction; },
      readPresentation: () => { assert.equal(state.ready, true); return function(target) {
        'use strict'; assert.equal(this, undefined);
        return { icon: '', type: target.kind, id: target.item.id, secondary: '' };
      }; },
    });
    interaction = menuFeature.createInteraction(options);
  } else interaction = w.CanvasContextInteraction.create(options);
  assert.deepEqual(calls, []); state.ready = true;
  const event = { preventDefault: () => calls.push('prevent') };
  const point = id => Object.assign(new w.GeometrySolver.Point(id, 1, 2), { sketchId: 'S1' });
  return { interaction, state, calls, selection, hover, constraintTargetSession, event, point, menuFeature, dom };
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
