const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} };
vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/geometry/pattern_instance_model.js', 'src/constraints/constraint_redundancy.js', 'src/constraints/constraint_analysis.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
}
const G = sandbox.window.GeometrySolver;
const analysis = () => ({ stable: true, variableFreedom: new Map(), variableIndex: new Map(), nullspaceBasis: [], variables: [] });
function fixture(assembly = 'analysis', overrides = {}) {
  const state = { scope: { points: [], lines: [], circles: [], arcs: [], splines: [], constraints: [], sketches: [{ id: 'ROOT', kind: 'root' }, { id: 'S1' }] }, active: 'S1', descendants: [],
    instances: [], blocks: [], analyses: new Map([['S1', analysis()]]), errors: new Set(), events: [], sample: item => [item.p1, item.p2] };
  state.redundancies = new Map(); state.failure = null;
  const solver = { analyzeConstraintState(options) { assert.equal(this, solver); state.events.push(['solve', options]);
    if (state.failAt === 'solve') throw state.failure; return state.analyses.get(options.variables[0].sketchId) || analysis(); },
    constraintRedundancyState(options) { assert.equal(this, solver); state.events.push(['redundancy-solve', options]);
      if (state.failAt === 'redundancy') throw state.failure; return state.redundancies.get(options.variables[0].sketchId) || { stable: true, byConstraint: new Map() }; } };
  const ports = { currentScope: () => state.scope, solver,
    scopeQuery: { sketchSolveVariables: id => [{ sketchId: id }], sketchSolveConstraints: () => [], sketchSolveLines: () => [] },
    readMembership: () => { state.events.push(['membership']); return { activeSketchId: state.active, elementSketchId: item => item.sketchId || state.active }; },
    descendantSketchIds: () => state.descendants, elementSketchId: item => item.sketchId || 'S1',
    geometryInstanceBundles: () => state.instances, blockProjectionBundles: () => state.blocks,
    geometryInstanceSourcePoints: item => state.sample(item),
    refreshReferenceConstraintValidity: () => { state.events.push(['references']); if (state.failAt === 'references') throw state.failure; },
    refreshConstraintRedundancy: precomputed => state.events.push(['redundancy', precomputed]),
    sketchHasSolveError: id => state.errors.has(id), isEditableSketchElement: item => !item.uneditable,
    isExplicitPoint: point => Boolean(point.explicit), minimumLength: 0.01, acceptError: 0.001,
    profileAnalysis: work => { state.events.push(['profile']); return work(); } };
  let service, redundancy;
  if (assembly === 'analysis') service = sandbox.window.ConstraintAnalysis.create(ports);
  else {
    const shared = { ...ports, constraintSketchId: c => c.sketchId, constraintIsOperational: c => c.enabled !== false,
      isRootSketch: sketch => sketch.kind === 'root' };
    delete shared.refreshConstraintRedundancy;
    if (assembly === 'shared') {
      shared.sketchContext = { constraintSketchId: shared.constraintSketchId, isRootSketch: shared.isRootSketch,
        membershipQuery: shared.readMembership, descendantSketchIds: shared.descendantSketchIds, elementSketchId: shared.elementSketchId,
        isEditableSketchElement: shared.isEditableSketchElement };
      shared.readServices = { reads: { geometryInstanceBundles: shared.geometryInstanceBundles, blockProjectionBundles: shared.blockProjectionBundles },
        instances: { geometryInstanceSourcePoints: shared.geometryInstanceSourcePoints } };
      for (const key of ['constraintSketchId','isRootSketch','readMembership','descendantSketchIds','elementSketchId','isEditableSketchElement',
        'geometryInstanceBundles','blockProjectionBundles','geometryInstanceSourcePoints']) delete shared[key];
    }
    Object.assign(shared, overrides);
    if (assembly === 'composed' || assembly === 'shared') ({ analysis: service, redundancy } = sandbox.window.ConstraintAnalysis.createWithRedundancy(shared));
    else {
      redundancy = sandbox.window.ConstraintRedundancy.create({ ...shared, sketchSolveVariables: shared.scopeQuery.sketchSolveVariables });
      service = sandbox.window.ConstraintAnalysis.create({ ...ports, refreshConstraintRedundancy: redundancy.refreshConstraintRedundancy });
    }
  }
  return { state, service, redundancy, a: state.analyses.get('S1') };
}
const point = (id, x = 0, y = 0) => new G.Point(id, x, y);
test('composed classification and redundancy preserve lazy caches, live scope, precomputed diagnostics and refresh order', () => {
  const results = [];
  for (const assembly of ['legacy', 'composed', 'shared']) {
    const { state, service, redundancy } = fixture(assembly), p = point('P1'), constraint = { id: 'K1', sketchId: 'S1' };
    p.explicit = true; state.scope.points.push(p); state.scope.constraints.push(constraint);
    state.redundancies.set('S1', { stable: true, byConstraint: new Map([[constraint, { redundant: true, rankBefore: 1, rankAfter: 1 }]]) });
    assert.deepEqual(state.events, []); assert.equal(redundancy.count, 0); assert.equal(service.stable, undefined);
    assert.equal(service.statusOf(p), 'full'); assert.equal(redundancy.count, 1); assert.equal(redundancy.constraintIsRedundant(constraint), true);
    assert.deepEqual(state.events.map(event => event[0]), ['profile','references','membership','solve','redundancy-solve']);
    assert.ok(state.events.filter(event => event[1]?.errorTolerance !== undefined).every(event => event[1].errorTolerance === 0.001));
    redundancy.forgetConstraint(constraint); assert.equal(redundancy.constraintIsRedundant(constraint), false); assert.equal(redundancy.count, 1);
    const cachedEvents = state.events.length; service.statusOf(p); assert.equal(state.events.length, cachedEvents);
    service.invalidate(); assert.equal(redundancy.count, 1);
    const precomputed = new Map([['S1', { stable: true, byConstraint: new Map() }]]);
    state.events.length = 0; const refreshed = service.refresh({ redundancyBySketch: precomputed });
    assert.equal(redundancy.count, 0); assert.deepEqual(state.events.map(event => event[0]), ['profile','references','membership','solve']);
    const p2 = point('P2'); p2.sketchId = 'S2'; p2.explicit = true; state.active = 'S2';
    state.scope = { ...state.scope, points: [p2], constraints: [], sketches: [{ id: 'S2' }] };
    service.invalidate(); service.ensure(); assert.equal(service.statusOf(p2), 'full'); assert.equal(redundancy.constraintDuplicateCountForSketch('S1'), 0);
    results.push({ summary: service.summary(), previousSummary: refreshed.summary, count: redundancy.count, events: state.events.map(event => event[0]) });
  }
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[0], results[2]);
});

test('composed refresh keeps the existing partial cache and diagnostic state when reference, solver or redundancy work fails', () => {
  const results = [];
  for (const assembly of ['legacy', 'composed', 'shared']) for (const failAt of ['references','solve','redundancy']) {
    const { state, service, redundancy } = fixture(assembly), marker = new Error('refresh failed'), constraint = { sketchId: 'S1' };
    state.scope.points = [Object.assign(point('before'), { explicit: true })]; state.scope.constraints = [constraint];
    state.redundancies.set('S1', { stable: true, byConstraint: new Map([[constraint, { redundant: true, rankBefore: 1, rankAfter: 1 }]]) });
    service.refresh(); state.failure = marker; state.failAt = failAt; state.events.length = 0;
    state.scope.points = [Object.assign(point('after1'), { explicit: true }), Object.assign(point('after2'), { explicit: true })]; state.scope.constraints = [];
    assert.throws(() => service.refresh(), error => error === marker);
    assert.equal(service.stable, true); assert.equal(redundancy.count, 1); assert.equal(redundancy.constraintIsRedundant(constraint), true);
    assert.equal(service.summary().total, failAt === 'redundancy' ? 2 : 1);
    const before = state.events.length; service.ensure(); assert.equal(state.events.length, before);
    results.push({ failAt, events: state.events.map(event => event[0]), stable: service.stable, count: redundancy.count, summary: service.summary() });
  }
  assert.deepEqual(results.slice(0, 3), results.slice(3, 6));
  assert.deepEqual(results.slice(0, 3), results.slice(6));
});

test('shared query defaults retain explicit membership overrides, raw receiver and null failures', () => {
  let calls = 0;
  const { state, service } = fixture('shared', { readMembership: function() {
    'use strict'; assert.equal(this, undefined); calls++;
    return { activeSketchId: 'S2', elementSketchId: item => item.sketchId };
  } });
  const p1 = point('P1'), p2 = point('P2'); p1.sketchId = 'S1'; p2.sketchId = 'S2'; state.scope.points.push(p1, p2);
  assert.equal(calls, 0);
  const first = service.refresh(); assert.equal(calls, 1); assert.equal(first.statuses.has(p2), true); assert.equal(first.statuses.has(p1), false);
  service.ensure(); assert.equal(calls, 1); service.invalidate(); service.ensure(); assert.equal(calls, 2);
  const explicitNull = fixture('shared', { geometryInstanceBundles: null });
  assert.throws(() => explicitNull.service.refresh(), error => error.name === 'TypeError');
  assert.equal(explicitNull.redundancy.count, 0); assert.equal(explicitNull.service.stable, undefined);
});

test('shared basis lookup handles missing objects, properties and zero-valued entries', () => {
  const item = {}, a = { variableIndex: new Map([[item, { x: 0, y: 2 }]]) };
  assert.equal(G.variableDeltaInBasis(item, 'x', [3, 4], a), 3);
  assert.equal(G.variableDeltaInBasis(item, 'y', [3, 4], a), 0);
  assert.equal(G.variableDeltaInBasis({}, 'x', [3], a), 0);
  assert.equal(G.variableDeltaInBasis(item, 'z', [3], a), 0);
});
test('normal geometry classification retains fixed, support, endpoint and radial freedom distinctions', () => {
  const { state, service, a } = fixture(), p1 = point('p1'), p2 = point('p2', 10), center = point('c');
  const line = new G.Line('L', p1, p2), circle = new G.Circle('C', center, 5), arc = new G.Arc('A', center, 5, 0, 1);
  const spline = { fitPoints: [p1] };
  Object.assign(state.scope, { points: [p1, p2, center], lines: [line], circles: [circle], arcs: [arc], splines: [spline] });
  a.variableFreedom.set(p1, { x: true }); a.variableIndex.set(p1, { x: 0, y: 1 }); a.nullspaceBasis = [[1, 0]];
  a.variableFreedom.set(arc, { startAngle: true });
  assert.equal(service.statusOf(line), 'support'); assert.equal(service.statusOf(arc), 'support');
  assert.equal(service.statusOf(circle), 'full'); assert.equal(service.statusOf(spline), 'under');
  a.nullspaceBasis = [[0, 1]]; a.variableFreedom.set(circle, { radiusValue: true });
  service.invalidate(); assert.equal(service.statusOf(line), 'under'); assert.equal(service.statusOf(circle), 'under');
  p1.fixed = true; service.invalidate(); assert.equal(service.statusOf(p1), 'full');
  a.stable = false; service.invalidate(); assert.equal(service.statusOf(arc), 'conflict');
});
test('cache is lazy, invalidation refreshes current scope, and snapshots do not share status maps or summary', () => {
  const { state, service } = fixture(), p = point('p'); p.explicit = true; state.scope.points = [p];
  assert.equal(service.stable, undefined);
  const precomputed = new Map(), result = service.refresh({ redundancyBySketch: precomputed });
  assert.equal(result.statuses.get(p), 'full'); assert.equal(state.events.at(-1)[1], precomputed);
  result.statuses.clear(); result.summary.full = 99; result.analyses.clear();
  assert.equal(service.statusOf(p), 'full'); assert.equal(service.summary().full, 1);
  service.ensure(); assert.equal(state.events.filter(e => e[0] === 'solve').length, 1);
  state.scope = { ...state.scope, points: [] }; service.invalidate(); assert.equal(service.stable, undefined);
  assert.equal(service.summary().total, 0); assert.equal(state.events.filter(e => e[0] === 'solve').length, 2);
});
test('analysis follows transitive derived sources and counts only editable explicit points and geometry', () => {
  const { state, service } = fixture(), p = point('p'), child = point('child'), source = point('source');
  p.explicit = true; child.sketchId = 'S2'; source.sketchId = 'S3'; source.explicit = true; source.uneditable = true;
  state.scope.points = [p, child, source]; state.descendants = ['S2'];
  const bundle = (target, item) => ({ valid: true, instance: { sketchId: target }, points: [{ sourceElement: item }], lines: [], circles: [], arcs: [], splines: [] });
  state.instances = [bundle('S3', { sketchId: 'S4' }), bundle('S2', source), { valid: false }];
  state.errors.add('S1'); const result = service.refresh();
  assert.deepEqual(Array.from(result.analyses.keys()), ['S1', 'S2', 'S3', 'S4']);
  assert.equal(service.statusOf(p), 'conflict'); assert.equal(service.summary().total, 1);
  assert.equal(service.summary().conflict, 1);
  assert.equal(state.events[1][0], 'references'); assert.equal(state.events.at(-1)[0], 'redundancy');
});
test('Block projection distinguishes translation along a line from rotation and normal motion', () => {
  const { state, service, a } = fixture(), instance = { sketchId: 'S1' }, p1 = point('p1'), p2 = point('p2', 10);
  const line = new G.Line('L', p1, p2), arc = new G.Arc('A', p1, 5, 0, 1), circle = new G.Circle('C', p1, 5);
  for (const item of [line, arc, circle, p1]) item.blockInstance = instance;
  state.blocks = [{ instance, points: [p1], lines: [line], circles: [circle], arcs: [arc] }];
  a.variableFreedom.set(instance, { x: true }); a.variableIndex.set(instance, { x: 0, y: 1, rotation: 2 }); a.nullspaceBasis = [[1, 0, 0]];
  assert.equal(service.statusOf(line), 'support'); assert.equal(service.statusOf(circle), 'under');
  assert.equal(service.summary().total, 3); // Projected points are not included in the visible summary.
  a.variableFreedom.set(instance, { rotation: true }); a.nullspaceBasis = [[0, 0, 1]]; service.invalidate();
  assert.equal(service.statusOf(line), 'under'); assert.equal(service.statusOf(arc), 'support'); assert.equal(service.statusOf(circle), 'full');
  instance.fixed = true; service.invalidate(); assert.equal(service.statusOf(line), 'full');
});
test('derived projection follows source status while sketchProjection bypasses analysis', () => {
  const { state, service, a } = fixture(), source = point('p');
  a.variableFreedom.set(source, { x: true }); state.scope.points = [source];
  assert.equal(service.statusOf({ derivedInstance: { type: 'sketchProjection' } }), 'full');
  assert.equal(state.events.length, 0);
  const projected = { derivedProjection: true, sourceElement: source, derivedInstance: { type: 'mirror' } };
  assert.equal(service.statusOf(projected), 'under');
  const cycle = { derivedProjection: true }; cycle.sourceElement = cycle;
  assert.equal(service.statusOf(cycle), 'full');
});
test('Free Instance classification restores perturbed variables, caches status and restores on sampling exceptions', () => {
  const { state, service, a } = fixture(), instance = { x: 0, y: 0 }, source = point('source');
  const line = new G.Line('L', point('p1'), point('p2', 10));
  Object.assign(line, { derivedProjection: true, sourceElement: source, derivedInstance: { type: 'free', placement: { kind: 'linear' } } });
  a.variables = [{ object: instance, prop: 'x' }, { object: instance, prop: 'y' }]; a.nullspaceBasis = [[1, 0]];
  let samples = 0;
  state.sample = () => { samples++; return [{ x: instance.x, y: instance.y }, { x: 10 + instance.x, y: instance.y }]; };
  assert.equal(service.statusOf(line), 'support'); assert.equal(instance.x, 0); assert.equal(instance.y, 0);
  const count = samples; service.statusOf(line); assert.equal(samples, count);
  a.nullspaceBasis = [[0, 1]]; service.invalidate(); assert.equal(service.statusOf(line), 'under');
  service.invalidate();
  state.sample = () => { if (instance.x !== 0) throw Error('sampling failure'); return [line.p1, line.p2]; };
  assert.throws(() => service.statusOf(line), /sampling failure/); assert.equal(instance.x, 0);
});


test('analysis captures fresh Sketch membership once per refresh and follows an active Sketch change', () => {
  const { state, service } = fixture(), p1 = point('P1'), p2 = point('P2');
  p1.sketchId = 'S1'; p2.sketchId = 'S2'; state.scope.points = [p1, p2];
  state.analyses.set('S2', analysis());
  assert.equal(state.events.length, 0);
  const first = service.refresh();
  assert.equal(first.statuses.has(p1), true); assert.equal(first.statuses.has(p2), false);
  assert.equal(state.events.filter(event => event[0] === 'membership').length, 1);
  assert.ok(state.events.findIndex(event => event[0] === 'references') < state.events.findIndex(event => event[0] === 'membership'));
  state.active = 'S2';
  const second = service.refresh();
  assert.equal(second.statuses.has(p1), false); assert.equal(second.statuses.has(p2), true);
  assert.equal(first.statuses.has(p1), true);
  assert.equal(state.events.filter(event => event[0] === 'membership').length, 2);
});
