const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(source => source.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window, { Point, Line, DistanceConstraint, LineAngleConstraint } = w.GeometrySolver;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function fixture(extra = {}) {
  const calls = [], viewport = { scale: 2 }, selection = w.CanvasSelection.create();
  const placement = w.DimensionPlacement.create({ viewport });
  const state = { ready: false, scope: { constraints: [] }, editable: true, visible: true, allowed: true, commandActive: false };
  const notify = name => (...args) => { assert.equal(state.ready, true); calls.push([name, ...args]); };
  const feature = w.DimensionDragFeature.create({ placement, viewport, canvasSelection: selection,
    currentScope: () => { assert.equal(state.ready, true); return state.scope; }, constraintSketchId: item => item.sketchId,
    isEditableSketchId: () => state.editable, isVisibleSketchId: () => state.visible,
    effectiveDimensionAppearance: dimension => ({ visible: dimension.display?.visible !== false }), isVisibleValue: value => value !== false,
    guardSketchEdit: id => { assert.equal(id, 'S1'); return state.allowed; }, isDimensionConstraintCommandActive: () => state.commandActive,
    beginPointer: notify('begin'), endPointer: notify('end'), setHint: notify('hint'), clearSnap: notify('snap'), hypot2: Math.hypot,
    continueCommandClick: notify('click'), draw: notify('draw'), updateUI: notify('ui'), updateGeometrySelectionUI: notify('selectionUI'),
    syncDimensionValueInput: notify('input'), recordHistory: notify('history'), ...extra });
  assert.deepEqual(calls, []); state.ready = true;
  function distance(y, offset) {
    const constraint = new DistanceConstraint(new Point(`a${y}`, 0, y), new Point(`b${y}`, 100, y), 100);
    constraint.sketchId = 'S1'; constraint.expression = '100';
    const target = w.DimensionQueries.targetFromConstraint(constraint);
    constraint.dimension = { ...placement.dimensionFromAnchor(target, { x: 50, y: offset }), labelOffsetU: 7, display: { color: '#123456' } };
    return constraint;
  }
  return { feature, state, selection, placement, viewport, calls, distance };
}

test('shared dimension group selection reads live scope, permission and appearance and never rewrites selection', () => {
  const f = fixture(), a = f.distance(0, -20), b = f.distance(40, -5);
  f.state.scope = { constraints: [a, b] }; f.selection.set('dimensionConstraints', [a, b]);
  const selected = f.selection.dimensionConstraints, before = JSON.stringify([a, b]);
  const group = f.feature.selectedLineGroup(a);
  assert.deepEqual(Array.from(group.members, member => member.constraint), [a, b]); assert.equal(f.selection.dimensionConstraints, selected);
  for (const key of ['editable', 'visible']) { f.state[key] = false; assert.equal(f.feature.selectedLineGroup(a), null); f.state[key] = true; }
  b.dimension.display.visible = false; assert.equal(f.feature.selectedLineGroup(a), null); delete b.dimension.display.visible;
  f.state.scope = { constraints: [a] }; assert.equal(f.feature.selectedLineGroup(a), null);
  f.state.scope = { constraints: [a, b] }; assert.ok(f.feature.selectedLineGroup(a));
  assert.equal(JSON.stringify([a, b]), before); assert.deepEqual(f.calls, []);
});

test('group drag and context alignment share real placement snapshots and one drag history', () => {
  const f = fixture(), a = f.distance(0, -20), b = f.distance(40, -5);
  f.state.scope.constraints = [a, b]; f.selection.set('dimensionConstraints', [a, b]);
  const target = w.DimensionQueries.targetFromConstraint(a), selected = f.selection.dimensionConstraints;
  f.feature.command.begin({ pointerId: 3 }, { constraint: a, target, dimension: a.dimension }, { x: 50, y: -20 });
  assert.equal(f.feature.command.active, true); assert.equal(f.selection.dimensionConstraints, selected);
  f.feature.command.update({ x: 57, y: -11 }); f.feature.command.update({ x: 64, y: -2 });
  close(f.placement.dimensionAnchor(target, a.dimension).y, -2);
  close(f.placement.dimensionAnchor(w.DimensionQueries.targetFromConstraint(b), b.dimension).y, 13);
  assert.equal(a.expression, '100'); assert.equal(b.target, 100); assert.equal(b.dimension.labelOffsetU, 7);
  assert.equal(b.dimension.display.color, '#123456');
  f.calls.length = 0; assert.equal(f.feature.command.finish({ pointerId: 3 }), true);
  assert.deepEqual(f.calls.map(call => call[0]), ['end', 'hint', 'selectionUI', 'input', 'draw', 'history']);
  assert.equal(f.feature.command.active, false);
  assert.equal(f.feature.lineGroup.align(f.feature.selectedLineGroup(a)), true);
  close(f.placement.dimensionAnchor(w.DimensionQueries.targetFromConstraint(b), b.dimension).y, -2);
});

test('permission rejection is inert and command clicks preserve original hits, threshold and history boundary', () => {
  const f = fixture(), a = f.distance(0, -20), target = w.DimensionQueries.targetFromConstraint(a);
  f.state.scope.constraints = [a]; const before = JSON.stringify(a.dimension), hit = { constraint: a, target, dimension: a.dimension };
  f.state.allowed = false; f.feature.command.begin({ pointerId: 2 }, hit, { x: 0, y: 0 });
  assert.equal(f.feature.command.active, false); assert.deepEqual(f.calls, []);
  f.state.allowed = true; f.state.commandActive = true; const hits = { hitP: a.p1 };
  f.feature.command.begin({ pointerId: 2 }, hit, { x: 0, y: 0 }, hits);
  f.feature.command.update({ x: 1.5, y: 0 }); assert.equal(JSON.stringify(a.dimension), before);
  f.calls.length = 0; const event = { pointerId: 2 }; f.feature.command.finish(event);
  assert.deepEqual(f.calls.map(call => call[0]), ['end', 'click']); assert.equal(f.calls[1][1], event); assert.equal(f.calls[1][2], hits);
  assert.equal(f.selection.dimensionConstraint, null);
});

test('dimension drag shares the continuation API without rebinding and retains its existing session boundary', () => {
  let active = true; const calls = [];
  const commandInput = { isActive: function() { 'use strict'; assert.equal(this, undefined); calls.push(['active']); return active; },
    continueClick: function(event, hits) { 'use strict'; assert.equal(this, undefined); calls.push(['click', event, hits]); } };
  const f = fixture({ commandInput, isDimensionConstraintCommandActive: () => { throw Error('legacy predicate used'); }, continueCommandClick: () => { throw Error('legacy continuation used'); } });
  assert.deepEqual(calls, []); const a = f.distance(0, -20), target = w.DimensionQueries.targetFromConstraint(a), hits = { hitL: {} }, event = { pointerId: 5 };
  f.state.scope.constraints = [a]; f.feature.command.begin(event, { constraint: a, target, dimension: a.dimension }, { x: 0, y: 0 }, hits);
  assert.equal(f.feature.command.active, true); active = false; f.calls.length = 0; f.feature.command.finish(event);
  assert.equal(calls.at(-1)[0], 'click'); assert.equal(calls.at(-1)[1], event); assert.equal(calls.at(-1)[2], hits);
  assert.deepEqual(f.calls.map(c => c[0]), ['end']); assert.equal(f.feature.command.active, false);
  const before = calls.length; f.feature.command.begin(event, { constraint: a, target, dimension: a.dimension }, { x: 0, y: 0 });
  assert.ok(calls.length > before); assert.equal(calls.at(-1)[0], 'active'); f.feature.command.reset();
});

test('real angle drag shares flip synchronization and respects reference dimensions and reset', () => {
  for (const readOnly of [false, true]) {
    const f = fixture(), origin = new Point('o', 0, 0), a = new Point('a', 100, 0), b = new Point('b', 0, 100);
    const constraint = new LineAngleConstraint(new Line('L1', origin, a), new Line('L2', origin, b), 0.33);
    constraint.sketchId = 'S1'; constraint.readOnlyDimension = readOnly;
    const target = w.DimensionQueries.targetFromConstraint(constraint);
    constraint.dimension = { ...f.placement.dimensionFromAnchor(target, { x: 20, y: 20 }), display: { color: '#123456' } };
    f.feature.command.begin({ pointerId: 4 }, { constraint, target, dimension: constraint.dimension }, { x: 20, y: 20 });
    f.feature.command.update({ x: -30, y: 20 });
    close(constraint.target, readOnly ? 0.33 : Math.abs(w.DimensionQueries.angleDimensionAngles(target, null, constraint.dimension).signed));
    assert.equal(constraint.dimension.display.color, '#123456');
    f.calls.length = 0; f.feature.command.finish({ pointerId: 4 });
    assert.deepEqual(f.calls.map(call => call[0]), ['end', 'hint', 'ui', 'draw', 'history']);
    f.feature.command.begin({ pointerId: 4 }, { constraint, target, dimension: constraint.dimension }, { x: 20, y: 20 });
    f.calls.length = 0; f.feature.command.reset(); assert.equal(f.feature.command.active, false);
    assert.equal(f.feature.command.finish({ pointerId: 4 }), false); assert.deepEqual(f.calls, []);
  }
});
