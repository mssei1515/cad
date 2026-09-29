const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: { GeometrySolver: { hypot2: Math.hypot } } };
vm.runInNewContext(fs.readFileSync('src/commands/geometry_drag.js', 'utf8'), sandbox);
const event = { pointerId: 7, type: 'pointerup' };
function fixture() {
  const events = [], state = { scale: 2, scope: { splines: [], blockInstances: [] },
    preview: { success: true }, final: { success: true, errorNorm: 0 }, dependent: { success: true },
    stabilized: { success: true, dependent: { success: true }, result: { errorNorm: 0 } }, stable: true };
  let command;
  const notify = name => (...args) => events.push({ name, args });
  command = sandbox.window.GeometryDrag.create({
    prepareSession: session => { events.push({ name: 'prepare' }); state.prepare?.(session); },
    dragResultForSession: (session, point) => { events.push({ name: 'preview', args: [point] }); state.onPreview?.(session); return state.preview; },
    solveFinalDragSession: session => { events.push({ name: 'final', args: [session.sketchId] }); return state.final; },
    currentScope: () => state.scope, activeSketchId: () => 'active', viewScale: () => state.scale,
    beginPointer: notify('begin'), endPointer: id => { assert.equal(command.active, false); notify('end')(id); },
    projectionBlockedMessage: () => 'projection blocked', canvasSelection: { set: notify('select') },
    restoreModelState: notify('restoreModel'), restoreSolverState: notify('restoreSolver'),
    solveReferenceDependentSketches: id => { notify('dependent')(id); return state.dependent; },
    normalizeArcSweeps: notify('normalize'), clearSketchSolveState: notify('clearSolve'),
    invalidateBlockProjectionCache: notify('invalidate'),
    stabilizeActiveParameterNamespace: (id, options) => { notify('stabilize')(id, options); return state.stabilized; },
    refreshConstraintAnalysis: () => { notify('analysis')(); return { analysis: { stable: state.stable } }; },
    acceptError: 1e-4, applicationText: text => text, setHint: notify('hint'), updateUI: notify('ui'),
    updateGeometrySelectionUI: notify('selectionUI'), draw: notify('draw'), recordHistory: notify('history'),
  });
  const plan = { kind: 'point', mode: 'points', sketchId: 'S1', startPointer: { x: 0, y: 0 }, points: [{ point: {} }] };
  return { command, events, state, plan, names: () => events.map(e => e.name) };
}

test('begin owns the session and highlights while reset drops it without completion side effects', () => {
  const f = fixture(), point = f.plan.points[0].point;
  assert.equal(f.command.begin(event, null), false); assert.equal(f.events.length, 0);
  assert.equal(f.command.begin(event, f.plan), true);
  assert.deepEqual(f.names(), ['prepare', 'begin']); assert.equal(f.command.isPoint(point), true);
  f.plan.kind = 'circle'; assert.equal(f.command.isPoint(point), true);
  f.command.reset(); f.command.update({ x: 9, y: 9 });
  assert.equal(f.command.active, false); assert.equal(f.command.isPoint(point), false);
  assert.equal(f.command.finish(event), false); assert.deepEqual(f.names(), ['prepare', 'begin']);
  const arc = { center: point };
  f.command.begin(event, { ...f.plan, kind: 'arc-endpoint', item: arc, endpoint: 'start' });
  assert.equal(f.command.isCenter(point), true); assert.equal(f.command.isArcEndpoint(arc, 'start'), true);
  assert.equal(f.command.isArcEndpoint(arc, 'end'), false);
});

test('threshold uses display coordinates before pointer mapping and only gates the first movement', () => {
  const f = fixture();
  f.plan.displayStartPointer = { x: 100, y: 100 };
  f.plan.pointerMap = p => ({ x: p.x - 100, y: p.y - 100 });
  f.command.begin(event, f.plan); f.events.length = 0;
  f.command.update({ x: 101.5, y: 100 }); assert.equal(f.events.length, 0);
  f.command.update({ x: 102, y: 100 });
  assert.deepEqual(f.events[0].args[0], { x: 2, y: 0 });
  assert.deepEqual(f.names(), ['preview', 'dependent', 'hint', 'draw']);
  f.command.update({ x: 100, y: 100 });
  assert.equal(f.events.filter(e => e.name === 'preview').length, 2);
  assert.equal(f.names().includes('history'), false);
});

test('an unmoved click selects instance geometry but pointercancel does not and neither solves nor records history', () => {
  for (const type of ['pointerup', 'pointercancel']) {
    const f = fixture(), selected = { instanceId: 'I1', id: 'L1' };
    f.plan.clickGeometrySelection = selected;
    f.command.begin(event, f.plan); f.events.length = 0;
    assert.equal(f.command.finish({ ...event, type }), true);
    assert.deepEqual(f.names(), type === 'pointerup' ? ['end', 'select', 'selectionUI', 'hint', 'draw'] : ['end', 'hint', 'draw']);
    if (type === 'pointerup') assert.equal(f.events[1].args[1], selected);
    assert.equal(f.command.finish(event), false);
  }
});

test('projection locks reject attempted movement without solving or committing', () => {
  const f = fixture(); f.state.prepare = session => { session.projectionShapeLocked = true; };
  f.command.begin(event, f.plan); f.events.length = 0;
  f.command.update({ x: 3, y: 0 }); f.command.finish(event);
  assert.deepEqual(f.names(), ['hint', 'draw', 'end', 'hint', 'draw']);
  assert.equal(f.events[0].args[0], 'projection blocked');
});

test('blocked preview and dependent failure retain their distinct UI paths without recording history', () => {
  const f = fixture(); f.command.begin(event, f.plan); f.events.length = 0;
  f.state.preview = { blocked: true, reason: 'blocked' };
  f.command.update({ x: 3, y: 0 });
  assert.deepEqual(f.names(), ['preview', 'hint', 'ui', 'draw']);
  assert.equal(f.events[2].args[0].refreshAnalysis, false);
  f.events.length = 0; f.state.preview = { success: true }; f.state.dependent.success = false;
  f.command.update({ x: 4, y: 0 });
  assert.deepEqual(f.names(), ['preview', 'dependent', 'hint', 'ui', 'draw']);
  assert.equal(f.events[3].args.length, 0);
});

test('final failure or invalid spline restores the initial snapshot before UI and never adds history', () => {
  for (const failure of ['solve', 'tolerance', 'spline']) for (const fullSnapshot of [true, false]) {
    const f = fixture(), values = {}, solverValues = [];
    f.plan.parameterDragSnapshot = fullSnapshot ? values : null; f.plan.fullDragState = solverValues;
    f.command.begin(event, f.plan); f.command.update({ x: 3, y: 0 }); f.events.length = 0;
    if (failure === 'solve') f.state.final.success = false;
    if (failure === 'tolerance') f.state.final.errorNorm = 0.01;
    if (failure === 'spline') f.state.scope = { splines: [{ id: 'SP1', curve: () => ({ valid: false }) }], blockInstances: [] };
    f.command.finish(event);
    assert.deepEqual(f.names(), ['end', 'final', 'normalize', fullSnapshot ? 'restoreModel' : 'restoreSolver', 'clearSolve', 'hint', 'ui', 'draw']);
    assert.equal(f.events[3].args[0], fullSnapshot ? values : solverValues);
    assert.equal(f.events[4].args[0], 'S1');
  }
});

test('parameter and dependent failures restore the full snapshot after final solve without committing', () => {
  for (const failure of ['parameter', 'dependent', 'tolerance']) {
    const f = fixture(), snapshot = {}; f.plan.parameterDragSnapshot = snapshot;
    f.command.begin(event, f.plan); f.command.update({ x: 3, y: 0 }); f.events.length = 0;
    if (failure === 'parameter') f.state.stabilized.success = false;
    if (failure === 'dependent') f.state.stabilized.dependent.success = false;
    if (failure === 'tolerance') f.state.stabilized.result.errorNorm = 0.01;
    f.command.finish(event);
    assert.deepEqual(f.names(), ['end', 'final', 'normalize', 'stabilize', 'restoreModel', 'clearSolve', 'hint', 'ui', 'draw']);
    assert.equal(f.events[4].args[0], snapshot);
  }
});

test('successful moved Block completion invalidates projection before parameters and records one history after drawing', () => {
  const f = fixture(), block = { id: 'B1' }, allowed = () => true;
  Object.assign(f.plan, { kind: 'block', mode: 'block', item: block, variableAllowed: allowed });
  f.state.scope.blockInstances.push(block);
  f.command.begin(event, f.plan); f.command.update({ x: 3, y: 0 }); f.events.length = 0;
  // Existing behavior also finalizes an already moved geometry on pointercancel.
  f.command.finish({ ...event, type: 'pointercancel' });
  assert.deepEqual(f.names(), ['end', 'final', 'normalize', 'invalidate', 'stabilize', 'analysis', 'hint', 'ui', 'draw', 'history']);
  assert.equal(f.events[3].args[0], 'B1'); assert.equal(f.events[4].args[1].variableAllowed, allowed);
  assert.equal(f.events[9].args[0], 'ブロック移動ドラッグ');
  assert.equal(f.command.finish(event), false);
});
