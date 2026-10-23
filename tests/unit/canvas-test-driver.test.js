const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/canvas_test_driver.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/rendering/viewport.js'), 'utf8'), sandbox);
function displayFixture() {
  const calls = [], state = { ready: false, rect: { left: 5, top: 7, width: 200, height: 100 }, units: { length: 'mm' }, failure: null };
  const marker = new Error('display failed'), empty = () => ({ points: [], lines: [], sketches: [{ id: 'S1' }], activeSketchId: 'S1' });
  state.scope = empty(); const record = (name, ...args) => { assert.equal(state.ready, true); calls.push([name, ...args]); if (state.failure === name) throw marker; };
  const canvas = { getBoundingClientRect() { record('rect'); return state.rect; } };
  const viewport = sandbox.window.CanvasViewport.create({ canvasRect: () => canvas.getBoundingClientRect(), initialScale: 1, minZoom: 0.1, maxZoom: 10, minLength: 0.001 });
  const geometry = { addPoint: function(x, y, fixed, kind) { 'use strict'; assert.equal(this, undefined); record('point', x, y, fixed, kind); const point = { id: `P${state.scope.points.length}`, x, y, fixed, kind }; state.scope.points.push(point); return point; },
    addLine: function(p1, p2) { 'use strict'; assert.equal(this, undefined); record('line', p1, p2); const line = { id: `L${state.scope.lines.length}`, p1, p2 }; state.scope.lines.push(line); return line; } };
  const hits = Object.fromEntries(['hitPoint','hitLine','hitCircle','hitArc','hitSpline','hitArcEndpoint','hitDimension'].map(name => [name, () => { record(name); return null; }]));
  const support = sandbox.window.CanvasTestDriver.createDisplaySupport({ viewport, canvas, geometry, hits,
    currentScope: () => { record('scope'); return state.scope; }, rootSketchId: 'ROOT', resetModelState: () => { record('reset'); state.scope = empty(); },
    resizeCanvas: options => record('resize', options), draw: () => record('draw'), updateUI: () => record('ui'),
    fitAllGeometryToViewport: padding => { record('fit', padding); return true; },
    allGeometryBounds: () => ({ x1: -5, y1: -5, x2: 5, y2: 5 }), visibleGeometryBounds: () => null, isVisibleSketchId: id => { record('visible', id); return false; },
    readUnits: () => { record('units'); return state.units; }, cssPxPerMm: 1, snapCandidates: () => [], evaluateSpline: () => null, elementFromPoint: () => canvas,
  });
  assert.deepEqual(calls, []); state.ready = true;
  return { state, calls, marker, viewport, support, api: support.publicAPI, geometry, names: () => calls.map(call => call[0]) };
}

test('display support shares the existing viewport and coordinate functions without construction reads or rebinding', () => {
  const f = displayFixture(); assert.ok(Object.isFrozen(f.support)); assert.ok(Object.isFrozen(f.api));
  assert.equal(f.api.focusWorldForTest, f.support.focus); assert.equal(f.api.worldClientPositionForTest, f.support.clientPosition);
  const point = { id: 'P', x: 3, y: 4 }; f.state.scope.points.push(point);
  const zoom = f.api.displayZoomStateForTest(2); assert.equal(f.viewport.scale, 2); assert.notEqual(zoom.units, f.state.units);
  assert.deepEqual({ ...f.api.geometryClientPositionForTest('point', 'P') }, { ...f.support.clientPosition(point) });
  f.state.scope = { points: [{ id: 'P', x: 8, y: 9 }] }; assert.deepEqual({ ...f.api.geometryClientPositionForTest('point', 'P') }, { ...f.support.clientPosition(f.state.scope.points[0]) });
  f.calls.length = 0; f.support.focus({ x: 4, y: 5 }, 20); assert.equal(f.viewport.scale, 10);
  assert.deepEqual(f.names().slice(0, 3), ['resize', 'draw', 'rect']);
  f.state.failure = 'draw'; assert.throws(() => f.support.focus({}, 0.5), error => error === f.marker); assert.equal(f.viewport.scale, 0.5);
});

test('display support preserves fit defaults, live fixture scope and fixed-point client conversion', () => {
  const f = displayFixture(), old = f.state.scope;
  f.api.resetForAllGeometryFit(); assert.notEqual(f.state.scope, old); assert.equal(f.state.scope.points.length, 4); assert.equal(old.points.length, 0);
  assert.equal(f.state.scope.sketches[1].parentSketchId, 'ROOT'); assert.equal(f.state.scope.activeSketchId, 'S2');
  f.calls.length = 0; assert.equal(f.api.fitAllGeometryForTest(0), true); assert.deepEqual(f.calls, [['fit', 120], ['draw']]);
  f.calls.length = 0; f.api.resetForMiddleButtonFit(); assert.equal(f.state.scope.activeSketchId, 'S1'); assert.equal(f.state.scope.sketches[1].visible, false);
  const observed = f.api.middleButtonFitState(); assert.equal(observed.hiddenVisible, false); assert.equal(observed.scale, 0.02);
  f.calls.length = 0; const fixed = f.api.resetForFixedPointDisplayTest(); assert.equal(f.state.scope.points[0].fixed, true);
  assert.deepEqual({ ...fixed.point }, { ...f.support.clientPosition(f.state.scope.points[0]) });
  assert.ok(f.names().indexOf('ui') < f.names().indexOf('fit')); assert.ok(f.names().indexOf('fit') < f.names().indexOf('draw'));
});
function fixture() {
  const calls = [], state = { rect: { left: 5, top: 7, width: 200, height: 100 }, center: { x: 3, y: 4 } };
  const viewport = { scale: 1, update: values => { calls.push(['viewport', { ...values }]); Object.assign(viewport, values); } };
  const command = sandbox.window.CanvasTestDriver.create({ viewport,
    clampZoom: scale => { calls.push(['clamp', scale]); return Math.min(10, Math.max(0.1, scale)); },
    resizeCanvas: options => { calls.push(['resize', JSON.parse(JSON.stringify(options))]); state.center = options.centerWorld; },
    draw: () => { calls.push(['draw']); state.rect = { left: 11, top: 13, width: 300, height: 150 }; },
    canvas: { getBoundingClientRect: () => { calls.push(['rect']); return state.rect; } },
    currentCanvasCenterWorld: () => { calls.push(['center']); return state.center; },
    worldToCanvasScreen: point => { calls.push(['screen', { ...point }]); return { x: point.x * viewport.scale, y: point.y * viewport.scale }; },
  });
  return { command, calls, state, viewport };
}
test('focus clamps scale, preserves resize/draw order and reads display metadata after drawing', () => {
  const f = fixture(); const result = f.command.focus({ x: '4', y: 'bad' }, '20');
  assert.deepEqual(f.calls, [['clamp', 20], ['viewport', { scale: 10 }], ['resize', { centerWorld: { x: 4, y: 0 } }], ['draw'], ['rect'], ['center']]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { scale: 10, center: { x: 4, y: 0 }, canvas: { left: 11, top: 13, width: 300, height: 150 } });
});
test('focus retains existing zero and invalid numeric fallbacks without mutating supplied center', () => {
  const f = fixture(), center = { x: 0, y: '8' }; f.command.focus(center, 0);
  assert.equal(f.viewport.scale, 1); assert.deepEqual(center, { x: 0, y: '8' });
  assert.deepEqual(f.calls[2], ['resize', { centerWorld: { x: 0, y: 8 } }]);
});
test('client position reads the current rectangle and scale, normalizes inputs and produces no repaint', () => {
  const f = fixture(); f.viewport.scale = 2;
  assert.deepEqual({ ...f.command.clientPosition({ x: '3', y: 'bad' }) }, { x: 11, y: 7 });
  assert.deepEqual(f.calls, [['rect'], ['screen', { x: 3, y: 0 }]]);
  f.state.rect.left = 20; assert.equal(f.command.clientPosition(null).x, 20);
});

test('authoring observation follows current owners and preserves preview identity and copied points', () => {
  let scope = { points: [], lines: [], circles: [], arcs: [], splines: [], constraints: [] };
  let mode = 'line', performance = null;
  const pending = { current: null }, constraint = { command: null }, snap = { active: null };
  const centerline = { targets: [], firstPoint: null }, selected = { points: ['P2'] }, calls = [];
  const observation = sandbox.window.CanvasTestDriver.createAuthoringObservation({
    readMode: () => mode, currentScope: () => scope, pendingCommandSession: pending,
    constraintTargetSession: constraint, drawingSnap: snap, centerlineCommand: centerline,
    readPerformance: () => performance, readSelectedGeometry: () => selected,
    serializeConstraint: value => { calls.push(['serialize', value]); return { type: value.type }; },
    decorateSerializedConstraint: (value, original) => { calls.push(['decorate', original]); return { ...value, name: original.name }; },
  });
  assert.equal(observation.state().pointCount, 0);
  assert.equal(observation.state().pendingCommandPreview, null);
  scope = { ...scope, points: [{ id: 'P2', fixed: true }], lines: [{ id: 'L2', construction: 1 }], constraints: [{ type: 'distance', name: 'd2' }] };
  mode = 'centerline'; performance = { elapsedMs: 3 };
  pending.current = { type: 'distance-place', pointer: { x: 4, y: 5 } };
  constraint.command = { type: 'parallel' }; snap.active = { label: 'endpoint' };
  centerline.targets = [scope.lines[0]]; centerline.firstPoint = { x: 1, y: 2 };
  const result = observation.state();
  assert.equal(result.mode, mode); assert.equal(result.pointCount, 1);
  assert.equal(result.pendingConstraintType, 'parallel'); assert.equal(result.activeSnapLabel, 'endpoint');
  assert.deepEqual({ ...result.lastConstraint }, { type: 'distance', name: 'd2' });
  assert.deepEqual(calls, [['serialize', scope.constraints[0]], ['decorate', scope.constraints[0]]]);
  assert.equal(result.selected, selected);
  result.pendingPlacementPoint.x = 100; result.centerlineFirstPoint.x = 100; result.lastPerformance.elapsedMs = 100;
  assert.equal(pending.current.pointer.x, 4); assert.equal(centerline.firstPoint.x, 1); assert.equal(performance.elapsedMs, 3);
  const preview = { radius: 4 }; pending.current = { type: 'fillet-radius-place', preview };
  assert.equal(observation.state().pendingCommandPreview, preview);
  assert.equal(observation.state().pendingPlacementPoint, null);
});

test('snap observation uses current zoom, inclusive distance and existing candidate order', () => {
  const viewport = { scale: 2 }, calls = [], point = { x: '3', y: 'invalid' };
  const observation = sandbox.window.CanvasTestDriver.createSnapObservation({ viewport,
    snapCandidates: source => { calls.push({ ...source }); return [
      { distance: 5, label: 'edge' }, { distance: 1, label: 'near' }, { distance: 5.01, label: 'outside' },
    ]; },
  });
  assert.deepEqual(Array.from(observation.labels(point)), ['edge', 'near']);
  viewport.scale = 10;
  assert.deepEqual(Array.from(observation.labels(null)), ['near']);
  assert.deepEqual(calls, [{ x: 3, y: 0 }, { x: 0, y: 0 }]);
  assert.deepEqual(point, { x: '3', y: 'invalid' });
});

test('selectable line position follows current scope and skips competing hits, bounds and overlays', () => {
  let lines = [], rect = { left: 5, top: 10, right: 305, bottom: 110 };
  const first = { id: 'L1', p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 } };
  const second = { id: 'L2', p1: { x: 200, y: 0 }, p2: { x: 300, y: 0 } };
  const calls = [], canvas = { getBoundingClientRect: () => rect };
  const observation = sandbox.window.CanvasTestDriver.createSelectableLinePosition({
    currentScope: () => ({ lines }), canvas,
    hitPoint: x => { calls.push(['point', x]); return x === 37; },
    hitLine: x => { calls.push(['line', x]); return x === 63 ? { ...first } : x < 100 ? first : second; },
    hitDimension: x => { calls.push(['dimension', x]); return x === 50; },
    worldToCanvasScreen: p => ({ x: p.x === 237 ? 301 : p.x, y: p.y }),
    elementFromPoint: x => { calls.push(['element', x]); return x === 268 ? {} : canvas; },
  });
  assert.equal(observation.position(), null);
  lines = [first, second];
  assert.deepEqual({ ...observation.position() }, { id: 'L2', x: 255, y: 10 });
  assert.deepEqual(calls.filter(c => c[0] === 'point').map(c => c[1]), [37, 63, 50, 237, 263, 250]);
  assert.equal(calls.some(c => c[0] === 'line' && c[1] === 37), false);
  assert.equal(calls.some(c => c[0] === 'dimension' && c[1] === 63), false);
  assert.deepEqual(calls.filter(c => c[0] === 'element'), [['element', 268], ['element', 255]]);
  lines = [second]; rect = { left: 5, top: 10, right: 255, bottom: 10 };
  assert.deepEqual({ ...observation.position() }, { id: 'L2', x: 255, y: 10 });
  lines = [];
  assert.equal(observation.position(), null);
});

// The selection browser API shares the real Selection, Geometry creation and Hover owners.
const selectionSandbox = { structuredClone, window: {} }; vm.createContext(selectionSandbox);
const selectionSources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of selectionSources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), selectionSandbox, { filename: file });
function selectionSupportFixture() {
  const w = selectionSandbox.window, selection = w.CanvasSelection.create(), hover = w.CanvasHover.create({ isEndpointPoint: () => false });
  const ids = w.GeometryIds.create(), calls = [], fields = ['points', 'lines', 'circles', 'arcs', 'splines', 'blockInstances', 'hatches', 'annotations', 'referenceImages'];
  const empty = () => ({ ...Object.fromEntries(fields.map(field => [field, []])), constraints: [], sketches: [], activeSketchId: 'S1' });
  const state = { ready: false, scope: empty(), definitions: [], candidates: [], moving: null, editingBlock: false, failUI: false };
  const record = (name, ...args) => { assert.equal(state.ready, true); calls.push([name, ...args]); };
  const currentScope = () => { record('scope'); return state.scope; };
  const geometry = w.GeometryCreation.create({ currentScope, ids, assignSketchId: item => { item.sketchId = state.scope.activeSketchId; },
    currentConstruction: () => false, minLineLength: 0.01, minArcLength: 0.01 });
  let nextDefinition = 0;
  const definitions = w.BlockDefinitionEditing.create({ nextDefinitionId: () => 'D' + ++nextDefinition });
  const viewport = { x: 10, y: 20, scale: 2 }, rect = { left: 5, top: 7 };
  const clientPosition = point => ({ x: rect.left + viewport.x + point.x * viewport.scale, y: rect.top + viewport.y + point.y * viewport.scale });
  const marker = new Error('UI failure');
  const support = w.CanvasSelectionTestDriver.createSupport({ canvasSelection: selection, currentScope,
    clearSelection: () => { record('clear'); selection.clear(); }, updateUI: () => { record('ui'); if (state.failUI) throw marker; }, draw: () => record('draw') });
  const api = support.createApi({ sketchMoveCommand: { state: () => { record('move'); return state.moving; } }, activeSketchId: () => state.scope.activeSketchId, fields,
    decorateSerializedConstraint: (value, original) => ({ ...value, sourceId: original.id }), serializeConstraint: item => ({ id: item.id }),
    serializeModel: () => ({ scope: state.scope }), isEditingBlock: () => state.editingBlock,
    blockSelectionGeometry: () => { record('block-selection'); return { constraints: [{}], externalConstraints: [{}, {}], error: 'external' }; },
    resetModelState: () => { record('reset'); state.scope = empty(); state.definitions = []; selection.clear(); ids.reset(); },
    ...geometry, ROOT_SKETCH_ID: 'ROOT', DEFAULT_SKETCH_ID: 'S1', createEmptyBlockDefinition: definitions.empty,
    Point: w.GeometrySolver.Point, Line: w.GeometrySolver.Line, appendDefinition: definition => state.definitions.push(definition), nextInstanceId: () => 'I1',
    invalidateBlockProjectionCache: () => record('cache'), fitSketchToViewport: (...args) => record('fit', ...args), resetHistory: label => record('history', label),
    clientPosition, arcEndpointPoint: w.GeometryKernel.arcEndpointPoint, canvasHover: hover, canvasContextMenu: { hidden: false },
    canvasContextController: { candidates: () => state.candidates }, canvasContextCandidatePresentation: target => ({ id: target.item.id, type: target.kind, secondary: 'candidate' }),
    canvas: { getBoundingClientRect: () => rect }, viewport });
  assert.deepEqual(calls, []); state.ready = true;
  return { w, support, api, state, calls, selection, hover, geometry, viewport, rect, clientPosition, marker, empty };
}

test('selection browser API shares live scope/Selection across id selection, context and Sketch move observations', () => {
  const f = selectionSupportFixture(), { api, state, selection, calls } = f;
  const p = f.geometry.addPoint(1, 2), q = f.geometry.addPoint(4, 2), line = f.geometry.addLine(p, q);
  calls.length = 0; const result = api.selectGeometryIdsForTest({ points: [p.id, p.id], lines: [line.id] });
  assert.equal(selection.points[0], p); assert.equal(selection.lines[0], line); assert.equal(selection.points.length, 1);
  assert.equal(result.blockError, 'external'); assert.equal(result.internalConstraintCount, 1); assert.equal(result.externalConstraintCount, 2);
  assert.deepEqual(calls.slice(-3).map(call => call[0]), ['ui', 'draw', 'block-selection']);
  assert.equal(api.selectedGeometryIdsForTest, f.support.readSelectedGeometry);
  f.hover.update({ point: p }); state.candidates = [{ kind: 'line', item: line }];
  const context = api.canvasContextSelectionStateForTest(); assert.equal(context.hovered, p.id); assert.equal(context.candidates[0].id, line.id);
  state.moving = { targetId: 'S2' }; state.editingBlock = true; state.scope.constraints.push({ id: 'C1' });
  const move = api.sketchMoveStateForTest(); assert.equal(move.active, true); assert.equal(move.targetId, 'S2');
  assert.equal(move.serialized.scope, state.scope); assert.equal(move.ownership.points[0].id, p.id); assert.equal(move.constraints[0].sourceId, 'C1'); assert.equal(move.editingBlock, true);
  state.scope = f.empty(); const replacement = f.geometry.addPoint(8, 9); replacement.id = p.id;
  api.selectGeometryIdsForTest({ points: [p.id] }); assert.equal(selection.points[0], replacement); assert.notEqual(selection.points[0], p);
  const observation = api.selectedGeometryIdsForTest(); observation.points.push('external'); assert.equal(selection.points.length, 1);
});

test('selection browser fixtures share geometry and notifications, and point insertion reads current viewport without hiding failures', () => {
  const f = selectionSupportFixture(), { api, state, calls } = f;
  const overlap = api.resetForOverlappingContextSelectionTest();
  assert.deepEqual(Array.from(f.selection.lines, item => item.id), Array.from(overlap.lineIds));
  assert.equal(state.definitions.length, 1); assert.equal(state.definitions[0].lines.length, 2);
  assert.equal(state.scope.blockInstances[0].id, overlap.blockId); assert.equal(state.scope.lines.find(item => item.id === overlap.excludedIds[0]).appearance.visible, false);
  assert.deepEqual(calls.slice(-5).map(call => call[0]), ['cache', 'fit', 'history', 'ui', 'draw']);
  calls.length = 0; const endpoint = api.resetForArcEndpointConstraintSelectionTest();
  assert.equal(state.scope.lines.length, 1); assert.equal(state.scope.arcs.length, 2); assert.equal(state.scope.arcs[0].id, endpoint.firstArcId);
  assert.deepEqual(endpoint.first, f.clientPosition(f.w.GeometryKernel.arcEndpointPoint(state.scope.arcs[0], 'start')));
  f.viewport.scale = 4; const inserted = api.addIsolatedFixedPointForContextTest({ x: 55, y: 67 }); const point = state.scope.points.at(-1);
  assert.equal(point.x, 10); assert.equal(point.y, 10); assert.equal(point.fixed, true); assert.equal(point.kind, 'explicit');
  assert.equal(inserted.id, point.id); assert.deepEqual(inserted.client, { x: 55, y: 67 }); assert.deepEqual(calls.slice(-2).map(call => call[0]), ['ui', 'draw']);
  calls.length = 0; state.failUI = true;
  assert.throws(() => api.addIsolatedFixedPointForContextTest({ x: 15, y: 27 }), error => error === f.marker);
  assert.equal(calls.at(-1)[0], 'ui'); assert.equal(calls.some(call => call[0] === 'draw'), false);
});
