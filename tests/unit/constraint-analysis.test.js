const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/constraints/constraint_analysis.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
}
const G = sandbox.window.GeometrySolver;
const analysis = () => ({ stable: true, variableFreedom: new Map(), variableIndex: new Map(), nullspaceBasis: [], variables: [] });
function fixture() {
  const state = { scope: { points: [], lines: [], circles: [], arcs: [], splines: [] }, active: 'S1', descendants: [],
    instances: [], blocks: [], analyses: new Map([['S1', analysis()]]), errors: new Set(), events: [], sample: item => [item.p1, item.p2] };
  const service = sandbox.window.ConstraintAnalysis.create({ currentScope: () => state.scope,
    solver: { analyzeConstraintState: options => { state.events.push(['solve', options]); return state.analyses.get(options.variables[0].sketchId) || analysis(); } },
    scopeQuery: { sketchSolveVariables: id => [{ sketchId: id }], sketchSolveConstraints: () => [], sketchSolveLines: () => [] },
    activeSketchId: () => state.active, descendantSketchIds: () => state.descendants, elementSketchId: item => item.sketchId || 'S1',
    geometryInstanceBundles: () => state.instances, blockProjectionBundles: () => state.blocks,
    geometryInstanceSourcePoints: item => state.sample(item),
    refreshReferenceConstraintValidity: () => state.events.push(['references']),
    refreshConstraintRedundancy: precomputed => state.events.push(['redundancy', precomputed]),
    sketchHasSolveError: id => state.errors.has(id), isEditableSketchElement: item => !item.uneditable,
    isExplicitPoint: point => Boolean(point.explicit), minimumLength: 0.01, acceptError: 0.001,
    profileAnalysis: work => { state.events.push(['profile']); return work(); } });
  return { state, service, a: state.analyses.get('S1') };
}
const point = (id, x = 0, y = 0) => new G.Point(id, x, y);
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
  Object.assign(line, { derivedProjection: true, sourceElement: source, derivedInstance: { type: 'free' } });
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
