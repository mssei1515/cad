const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js',
  'src/constraints/dimension_queries.js', 'src/editing/geometry_drag_plan.js', 'src/solver/geometry_drag_solver.js',
  'src/editing/geometry_drag_editing.js', 'src/commands/geometry_drag.js', 'src/application/geometry_drag_feature.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}
const w = sandbox.window, { Point, hypot2 } = w.GeometrySolver;
const ok = () => ({ success: true, errorNorm: 0 });
function fixture() {
  const point = Object.assign(new Point('P1', 0, 0), { sketchId: 'S1' });
  const state = { scope: { points: [point], lines: [], constraints: [], splines: [], blockInstances: [] },
    active: 'S1', scale: 1, ready: false, reads: 0, allowed: true, profile: false, lockedProjection: false, finish: ok };
  const events = [], hints = [], selection = { geometryInstances: [], instanceGeometry: null,
    set(kind, value) { this[kind] = value; } };
  const variables = () => state.scope.points.flatMap(object => ['x', 'y'].map(prop => ({ object, prop })));
  const clone = entries => entries.map(v => ({ ...v, value: v.object[v.prop] }));
  const restore = entries => { for (const v of entries) v.object[v.prop] = v.value; };
  const solver = { getVariables: variables, clone, restore,
    computeErrorVectorForConstraints: () => [], maxIterations: 20 };
  const feature = w.GeometryDragFeature.create({ solver,
    currentScope: () => { assert.equal(state.ready, true); state.reads++; return state.scope; },
    activeSketchId: () => state.active, sketchSolveVariables: variables, sketchSolveConstraints: () => [],
    solveSketchById: id => { events.push(['solve', id]); return state.finish(); },
    viewScale: () => state.scale, arcEndpointPoint() {}, acceptError: 1e-4, previewMaxModelError: 0.125,
    elementSketchId: item => item.sketchId, isEditableSketchId: id => id === state.active,
    blockDefinitionById() {}, blockLocalGeometryBounds() {}, blockInstanceEnabledSketchSet() {}, blockWorldPoint() {},
    pointLockedByLineFixed: () => false, findLineFixedConstraint: () => null, findArcEndpointFixedConstraint: () => null,
    arcEndpointDragValue() {}, hypot2, minimumLength: 1e-6,
    contextFromSeeds: (seeds, id) => { state.seeds = seeds; state.preparedSketch = id;
      return { variables: variables(), constraints: [], lines: [], component: new Set(state.scope.points) }; },
    projectionConstraintsForItems: () => state.lockedProjection ? [{}] : [], captureValues: () => clone(variables()),
    enforceMinimumLineLengths: () => ({ changed: 0, failed: false }), normalizeArcSweeps: () => events.push('normalize'),
    invalidateBlockProjectionCache: () => events.push('invalidate'), projectionBlockedMessage: () => 'projection blocked',
    profileSolve: work => { if (!state.profile) return work(); events.push('profile-start');
      try { return work(); } finally { events.push('profile-end'); } },
    canEdit: () => state.allowed, beginPointer: id => events.push(['begin', id]), endPointer: id => events.push(['end', id]),
    canvasSelection: selection, restoreModelState: snapshot => { events.push('restore'); restore(snapshot); },
    solveReferenceDependentSketches: () => ({ success: true }), clearSketchSolveState: id => events.push(['clear', id]),
    stabilizeActiveParameterNamespace: () => ({ success: true, result: ok(), dependent: { success: true } }),
    refreshConstraintAnalysis: () => ({ analysis: { stable: true } }), applicationText: (_ja, en) => en,
    setHint: (...args) => hints.push(args), updateUI: () => events.push('ui'),
    updateGeometrySelectionUI: () => events.push('selection-ui'), draw: () => events.push('draw'), recordHistory: () => events.push('history'),
    geometryInstanceSourceObjects: () => new Set(), clearSelection: () => { selection.geometryInstances = []; selection.instanceGeometry = null; },
    geometryInstanceSourcePoints: item => [item], resolveDerivedDragSource: () => state.resolved,
  });
  return { feature, point, state, events, hints, selection };
}

test('drag composition defers reads and shares current plans, preparation and target observation without model copies', () => {
  const f = fixture(); assert.equal(f.state.reads, 0); assert.deepEqual(f.events, []); f.state.ready = true;
  const plan = f.feature.build('point', f.point, { x: 0, y: 0 });
  assert.equal(plan.points[0].point, f.point); assert.equal(f.feature.prepare(plan), plan);
  assert.equal(plan.local.variables[0].object, f.point); assert.equal(f.state.preparedSketch, 'S1');
  assert.equal(f.feature.targetConstraintCount(plan), 0);
  const replacement = Object.assign(new Point('P2', 20, 30), { sketchId: 'S2' });
  f.state.scope = { ...f.state.scope, points: [replacement] }; f.state.active = 'S2';
  const next = f.feature.build('point', replacement, { x: 20, y: 30 }); f.feature.prepare(next);
  assert.equal(next.local.variables[0].object, replacement); assert.equal(f.state.preparedSketch, 'S2');
  assert.equal(f.feature.build('point', f.point, { x: 0, y: 0 }), null);
});

test('real plan, editing, numeric solver and lifecycle move one object and commit one history step', () => {
  const f = fixture(); f.state.ready = true;
  const plan = f.feature.build('point', f.point, { x: 0, y: 0 });
  assert.equal(f.feature.command.begin({ pointerId: 7 }, plan), true);
  f.feature.command.update({ x: 2, y: 0 }); assert.equal(f.point.x, 0);
  f.state.scale = 2; f.state.profile = true;
  f.feature.command.update({ x: 4, y: 6 }); assert.equal(f.point.x, 4); assert.equal(f.point.y, 6);
  assert.equal(f.feature.command.finish({ pointerId: 7, type: 'pointerup' }), true);
  assert.equal(f.events.filter(e => e === 'history').length, 1);
  assert.equal(f.events.filter(e => e === 'profile-start').length, 2);
  assert.equal(f.events.filter(e => e === 'profile-end').length, 2);
  assert.equal(f.events.some(e => Array.isArray(e) && e[0] === 'end' && e[1] === 7), true);
  assert.equal(f.feature.command.active, false);
});

test('failed final solve restores the initial snapshot, releases pointer and ends the session without history', () => {
  const f = fixture(); f.state.ready = true;
  const plan = f.feature.build('point', f.point, { x: 0, y: 0 }); plan.onEnd = () => f.events.push('on-end');
  f.feature.command.begin({ pointerId: 2 }, plan); f.feature.command.update({ x: 12, y: 9 });
  f.state.finish = () => ({ success: false, errorNorm: 1 });
  f.feature.command.finish({ pointerId: 2, type: 'pointerup' });
  assert.equal(f.point.x, 0); assert.equal(f.point.y, 0); assert.equal(f.events.includes('restore'), true);
  assert.equal(f.events.includes('history'), false); assert.equal(f.events.at(-1), 'on-end');
  assert.equal(f.feature.command.active, false); assert.equal(f.hints.at(-1)[1], 'error');
});

test('edit permissions and legacy projection lock prevent edits; derived entry uses the same lifecycle and pointer map', () => {
  const f = fixture(); f.state.ready = true;
  const plan = f.feature.build('point', f.point, { x: 0, y: 0 }); f.state.allowed = false;
  assert.equal(f.feature.command.begin({ pointerId: 1 }, plan), false); assert.equal(f.state.reads, 0);
  f.state.allowed = true; f.state.lockedProjection = true; f.feature.command.begin({ pointerId: 1 }, plan);
  f.feature.command.update({ x: 10, y: 0 }); f.feature.command.finish({ pointerId: 1, type: 'pointerup' });
  assert.equal(f.point.x, 0); assert.equal(f.events.includes('history'), false); assert.equal(f.hints.at(-1)[0], 'projection blocked');
  f.state.lockedProjection = false;
  const instance = { id: 'SPI1', type: 'sketchProjection', sketchId: 'S1' };
  f.state.resolved = { item: f.point, pointer: { x: 0, y: 0 }, mapPointer: p => ({ x: p.x - 100, y: p.y }) };
  f.feature.beginDerived({ pointerId: 8 }, { instance, item: f.point, kind: 'point' }, { x: 100, y: 0 });
  assert.equal(f.feature.command.active, true); assert.equal(f.selection.geometryInstances[0], instance);
  f.feature.command.update({ x: 110, y: 5 }); assert.equal(f.point.x, 10); assert.equal(f.point.y, 5);
  f.feature.command.finish({ pointerId: 8, type: 'pointerup' }); assert.equal(f.events.filter(e => e === 'history').length, 1);
});

test('profile wrapper preserves thrown solve errors and lifecycle cleanup', () => {
  const f = fixture(); f.state.ready = true; f.state.profile = true;
  const plan = f.feature.build('point', f.point, { x: 0, y: 0 }); plan.onEnd = () => f.events.push('on-end');
  f.feature.command.begin({ pointerId: 3 }, plan); f.feature.command.update({ x: 10, y: 0 });
  const failure = new Error('solve failed'); f.state.finish = () => { throw failure; };
  assert.throws(() => f.feature.command.finish({ pointerId: 3 }), error => error === failure);
  assert.equal(f.events.at(-2), 'profile-end'); assert.equal(f.events.at(-1), 'on-end');
  assert.equal(f.feature.command.active, false); assert.equal(f.events.includes('history'), false);
});

test('late Block entry shares the actual drag plan and selection while fixed and rotation-locked refusals stay unchanged',()=>{
  const f=fixture(),entry=f.feature.createBlockEntry();assert.equal(f.state.reads,0);assert.deepEqual(f.events,[]);f.state.ready=true;
  const instance={id:'BI1',sketchId:'S1',fixed:true},event={pointerId:5},pointer={x:2,y:3};
  entry.begin(event,instance,pointer);assert.equal(f.selection.blockInstances[0],instance);assert.equal(f.hints.at(-1)[1],'error');assert.deepEqual(f.events,['draw']);
  instance.fixed=false;instance.rotationLocked=true;f.events.length=0;entry.begin(event,instance,pointer,true);
  assert.equal(f.selection.blockInstances[0],instance);assert.equal(f.hints.at(-1)[0],'回転がロックされたブロックインスタンスです');assert.deepEqual(f.events,['draw']);assert.equal(f.state.reads,0);
});
