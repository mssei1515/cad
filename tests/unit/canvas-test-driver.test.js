const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/canvas_test_driver.js'), 'utf8'), sandbox);
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
