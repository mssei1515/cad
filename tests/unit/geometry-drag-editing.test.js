const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/constraints/dimension_queries.js', 'src/editing/geometry_drag_editing.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}
const G = sandbox.window.GeometrySolver;
const coordinates = point => ['x', 'y'].map(prop => ({ object: point, prop }));
function fixture() {
  const a = new G.Point('P1', 0, 0), b = new G.Point('P2', 10, 0), line = new G.Line('L1', a, b);
  const variables = [...coordinates(a), ...coordinates(b)], events = [];
  const state = { scope: { points: [a, b], lines: [line], blockInstances: [], constraints: [] }, variables,
    context: { component: new Set([a, b, line]), variables, constraints: [], lines: [line] },
    projection: [], repair: { changed: 0, failed: false }, snapshot: {},
    analysis: { stable: true, variableIndex: new Map([[a, { x: 0, y: 1 }], [b, { x: 2, y: 3 }]]), nullspaceBasis: [] },
    guide: () => ({ success: true, errorNorm: 0 }) };
  const solver = {
    getVariables: () => state.variables,
    clone: vars => vars.map(v => ({ ...v, value: v.object[v.prop] })),
    restore: entries => { events.push('restore'); for (const entry of entries) entry.object[entry.prop] = entry.value; },
    analyzeConstraintState: options => { state.analysisOptions = options; return state.analysis; },
    observablePointDragTargets: options => { state.observable = options; return state.parameterTargets; },
  };
  const plan = {};
  for (const name of ['points', 'radius', 'primitiveMove', 'arcEndpoint']) plan[name] = () => { events.push(name); return state[name] || []; };
  plan.pointConstraints = targets => targets;
  plan.parameterConstraints = targets => targets;
  const dragSolver = {
    guided: (session, targets, extra, snapshot) => { events.push('guided'); return state.guide(session, targets, extra, snapshot); },
    finish: session => { events.push('finish'); return session; },
  };
  const editing = sandbox.window.GeometryDragEditing.create({ currentScope: () => state.scope, solver, plan, dragSolver,
    contextFromSeeds: (seeds, sketchId) => { state.seeds = seeds; state.sketchId = sketchId; return state.context; },
    projectionConstraintsForItems: items => { state.projectionItems = items; return state.projection; },
    pointLockedByLineFixed: point => Boolean(point.lineLocked),
    variableDeltaInBasis: (point, prop, basis, analysis) => basis[analysis.variableIndex.get(point)?.[prop]] || 0,
    captureValues: () => { events.push('snapshot'); return state.snapshot; },
    enforceMinimumLineLengths: lines => { state.repairLines = lines; events.push('repair'); return state.repair; },
    normalizeArcSweeps: () => events.push('normalize'), invalidateProjection: id => events.push(['invalidate', id]),
    projectionBlockedMessage: () => 'projection blocked', previewMaxModelError: 0.125 });
  return { a, b, line, state, events, editing, solver };
}

test('preparation retains object identity, restricts local variables and captures full rollback values', () => {
  const f = fixture(), fixed = new G.Point('fixed', 5, 5, true), locked = new G.Point('locked', 6, 6);
  locked.lineLocked = true; f.state.scope.points.push(fixed, locked); f.state.context.component.add(fixed).add(locked);
  f.state.projection.push({});
  const session = { kind: 'point', item: f.a, sketchId: 'S2', points: [{ point: f.a }], variableAllowed: v => v.object === f.a };
  assert.equal(f.editing.prepare(session), session); assert.equal(f.editing.prepare(null), null);
  assert.equal(session.local.variables.length, 2); assert.equal(f.state.variables.length, 4);
  assert.equal(session.local.fixedPointCount, 2); assert.equal(session.local.pointStarts.length, 2);
  assert.equal(session.local.pointStarts[0].point, f.a); assert.equal(f.state.sketchId, 'S2');
  assert.equal(f.state.seeds[0], f.a); assert.equal(session.projectionShapeLocked, true);
  assert.equal(session.fullDragState.length, 4); assert.equal(session.parameterDragSnapshot, f.state.snapshot);
  f.a.x = 99; assert.equal(session.fullDragState[0].value, 0);
});

test('Block preparation supplements placement coordinates without duplication and respects rotation lock', () => {
  for (const rotationLocked of [true, false]) {
    const f = fixture(), item = { id: 'B1', x: 2, y: 3, rotation: 0, rotationLocked };
    f.state.scope.blockInstances.push(item);
    f.state.context.variables = [{ object: item, prop: 'x' }];
    const session = { kind: 'block', item, sketchId: 'S1' }; f.editing.prepare(session);
    assert.deepEqual(Array.from(session.local.variables, v => v.prop), rotationLocked ? ['x', 'y'] : ['x', 'y', 'rotation']);
    assert.equal(f.state.projectionItems.length, 0);
  }
});

test('Line preparation chooses the visible representative freedom despite an unrelated free coordinate', () => {
  const f = fixture(), fixed = new G.Point('fixed', -10, 0, true), other = new G.Point('other', 20, 20);
  f.state.scope.points.push(fixed, other); f.state.context.component.add(fixed).add(other);
  f.state.analysis.variableIndex.set(other, { x: 4, y: 5 });
  f.state.analysis.nullspaceBasis = [[1, 0, 2, 0, 0, 0], [0, 0, 0, 0, 1, 0]];
  const session = { kind: 'line', item: f.line, points: [{ point: f.a }, { point: f.b }] };
  f.editing.prepare(session);
  assert.equal(session.lineDragPoint.point, f.b); assert.equal(session.translationReference, true);
  const free = { kind: 'line', item: f.line, points: [{ point: f.a }, { point: f.b }] };
  f.state.analysis.nullspaceBasis = [[1, 0, 1, 0], [0, 1, 0, 1]];
  f.editing.prepare(free); assert.equal(free.lineDragPoint, undefined); assert.equal(free.translationReference, true);
  const rotating = { kind: 'line', item: f.line, points: [{ point: f.a }, { point: f.b }] };
  f.state.analysis.nullspaceBasis = [[0, 1, 0, 2]];
  f.editing.prepare(rotating); assert.equal(rotating.translationReference, false);
});

test('direct radius query shares enabled Radius and Diameter identity rules with constraint editing', () => {
  const f = fixture(), circle = new G.Circle('C1', f.a, 5), other = new G.Circle('C2', f.a, 5);
  const radius = new G.RadiusConstraint(circle, 5), diameter = new G.DiameterConstraint(circle, 10);
  const query = sandbox.window.DimensionQueries.hasDirectRadiusDimension;
  assert.equal(query([radius], circle), true); assert.equal(query([radius], other), false);
  radius.enabled = false; assert.equal(query([radius], circle), false); assert.equal(query([radius, diameter], circle), true);
  f.state.scope.constraints = [diameter]; f.state.primitiveMove = [{ point: f.a, x: 2, y: 3 }];
  const session = { mode: 'radius', item: circle, local: f.state.context };
  f.editing.preview(session, {}); assert.equal(session.activeMode, 'move'); assert.equal(f.events.includes('radius'), false);
  // A new active scope must not retain the previous scope's dimension classification.
  f.state.scope = { ...f.state.scope, constraints: [] }; f.events.length = 0;
  f.editing.preview(session, {}); assert.equal(session.activeMode, 'radius'); assert.equal(f.events.includes('radius'), true);
});

test('inactive radius target restores its attempt before falling back to center movement', () => {
  const f = fixture(), circle = new G.Circle('C1', f.a, 5);
  f.state.radius = [{ object: circle, prop: 'radiusValue', value: 6 }];
  f.state.primitiveMove = [{ point: f.a, x: 2, y: 3 }];
  let attempts = 0;
  f.state.guide = (_session, targets) => {
    if (++attempts === 1) { f.a.x = 99; return { success: true, guided: true, targetConstraints: [], targetActivity: [0] }; }
    assert.equal(f.a.x, 0); assert.equal(targets, f.state.primitiveMove); f.a.x = 2;
    return { success: true };
  };
  const session = { mode: 'radius', item: circle, local: f.state.context };
  assert.equal(f.editing.preview(session, {}).success, true); assert.equal(session.activeMode, 'move');
  assert.equal(attempts, 2); assert.equal(f.a.x, 2);
  assert.deepEqual(f.events, ['primitiveMove', 'radius', 'guided', 'restore', 'guided', 'repair', 'normalize']);
});

test('preview retries after line repair and restores failed results to the pre-preview geometry', () => {
  for (const repairFailed of [false, true]) {
    const f = fixture(); f.state.points = [{ point: f.a, x: 3, y: 0 }]; f.state.repair = { changed: 1, failed: repairFailed };
    let attempts = 0; f.state.guide = () => { f.a.x = ++attempts; return { success: repairFailed }; };
    const result = f.editing.preview({ mode: 'points', local: f.state.context }, {});
    assert.equal(attempts, 2); assert.equal(result.blocked, true); assert.equal(result.success, false);
    assert.equal(f.a.x, 0); assert.equal(result.lineRepair, f.state.repair);
    assert.equal(f.state.repairLines, f.state.context.lines);
    assert.deepEqual(f.events.slice(-3), ['guided', 'normalize', 'restore']);
  }
});

test('Block rotation preserves the displayed pivot and invalidates projection before normalization', () => {
  const f = fixture(), item = { id: 'B1', x: 0, y: 0, rotation: 0 };
  f.state.guide = (_session, targets) => { for (const t of targets) t.object[t.prop] = t.value; return { success: true }; };
  const session = { mode: 'block-rotation', item, localCenter: { x: 2, y: 3 }, rotationPivot: { x: 10, y: 20 }, local: f.state.context };
  f.editing.preview(session, { x: 10, y: 25 });
  assert.ok(Math.abs(item.rotation - Math.PI / 2) < 1e-10);
  assert.ok(Math.abs(item.x + 2 * Math.cos(item.rotation) - 3 * Math.sin(item.rotation) - 10) < 1e-10);
  assert.ok(Math.abs(item.y + 2 * Math.sin(item.rotation) + 3 * Math.cos(item.rotation) - 20) < 1e-10);
  assert.deepEqual(f.events, ['guided', ['invalidate', 'B1'], 'repair', 'normalize']);
});

test('derived placement targets use the initial anchor and projection-locked sessions skip all editing', () => {
  const f = fixture(), session = { mode: 'derived-placement', anchor: f.a, startAnchor: { x: 5, y: 6 }, startPointer: { x: 2, y: 3 }, local: f.state.context };
  f.state.parameterTargets = [{ object: f.a, prop: 'x', value: 7 }];
  f.editing.preview(session, { x: 4, y: 8 });
  assert.equal(f.state.observable.point, f.a); assert.equal(f.state.observable.x, 7); assert.equal(f.state.observable.y, 11);
  assert.equal(f.state.observable.errorTolerance, 0.125);
  assert.equal(f.editing.finish(session), session);
  f.events.length = 0; session.projectionShapeLocked = true;
  assert.equal(f.editing.preview(session, {}).reason, 'projection blocked');
  assert.equal(f.editing.finish(session).blocked, true); assert.equal(f.events.length, 0);
});
