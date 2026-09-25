const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
class SketchProjectionConstraint {}
const sandbox = { window: { GeometrySolver: { SketchProjectionConstraint }, SketchHierarchy: { ROOT_SKETCH_ID: 'ROOT', isRootSketch: s => s.id === 'ROOT' } } };
vm.runInNewContext(fs.readFileSync('src/commands/sketch_deletion_command.js', 'utf8'), sandbox);
function fixture() {
  const p = { id: 'P1', sketchId: 'S1' }, childPoint = { id: 'P2', sketchId: 'S2' }, external = { id: 'P3', sketchId: 'S3' };
  const state = { model: { sketches: [{ id: 'ROOT' }, { id: 'S1', name: 'Parent', parentSketchId: 'ROOT' }, { id: 'S2', name: 'Child', parentSketchId: 'S1' }, { id: 'S3', name: 'Other', parentSketchId: 'ROOT' }],
    activeSketchId: 'S1', points: [p, childPoint, external], lines: [{ id: 'L1', sketchId: 'S1', p1: p, p2: childPoint }], circles: [], arcs: [], splines: [],
    constraints: [], geometryInstances: [], blockInstances: [], annotations: [], hatches: [], referenceImages: [] }, confirm: true, symbols: true };
  const events = [], byId = id => state.model.sketches.find(s => s.id === id);
  const cmd = sandbox.window.SketchDeletionCommand.create({ currentScope: () => state.model, ensureSketchState: () => {}, sketchById: byId,
    descendantSketchIds: id => id === 'S1' ? ['S2'] : [], constraintSketchId: c => c.sketchId,
    geometryInstanceDependencyRefs: i => i.sources || [], resolveGeometryRef: ref => ref, elementSketchId: item => item.sketchId,
    rejectReferencedGeometryDeletion: items => items.length > 0, sketchName: id => byId(id).name,
    setHint: text => events.push(['hint', text]), log: text => events.push(['log', text]),
    blockAllProjectionBundle: i => i.bundle, geometryElementKey: item => item?.id,
    constraintGraphNodes: c => c.nodes || [], guardDimensionSymbolDeletion: () => state.symbols,
    invalidateBlockProjectionCache: () => events.push('cache'), annotationReferencesRemovedGeometry: (a, ids) => ids.has(a.target),
    clearSketchSolveState: id => events.push(['clearSolve', id]), clearInteractionForSketchChange: () => events.push('clear'),
    invalidateAnalysis: () => events.push('analysis'), solveSketchAndDependents: id => events.push(['solve', id]),
    activeSketchId: () => state.model.activeSketchId, refreshConstraintAnalysis: () => events.push('refresh'),
    updateUI: () => events.push('ui'), draw: () => events.push('draw'), recordHistory: label => events.push(['history', label]),
    confirmDeletion: text => { events.push(['confirm', text]); return state.confirm; } });
  return { state, events, cmd, p, childPoint, external };
}
test('Sketch deletion rejects dependent instances and external constraints without mutation or confirmation', () => {
  for (const kind of ['instance', 'constraint']) {
    const f = fixture();
    if (kind === 'instance') f.state.model.geometryInstances.push({ sketchId: 'S3', sources: [f.p] });
    else f.state.model.constraints.push({ sketchId: 'S3', reference: true, referenceSketchId: 'S2' });
    const before = JSON.stringify(f.state.model); assert.equal(f.cmd.remove('S1'), false);
    assert.equal(JSON.stringify(f.state.model), before); assert.equal(f.events.some(e => e[0] === 'confirm'), false);
  }
});
test('Sketch deletion cancellation and dimension guard leave the model unchanged', () => {
  for (const guard of ['confirm', 'symbols']) {
    const f = fixture(); f.state[guard] = false; const before = JSON.stringify(f.state.model);
    assert.equal(f.cmd.remove('S1'), false); assert.equal(JSON.stringify(f.state.model), before);
    assert.equal(f.events.some(e => e === 'cache' || e[0] === 'history'), false);
  }
});
test('Sketch subtree deletion removes related geometry and annotations and records one history after refresh', () => {
  const f = fixture(); f.state.model.annotations = [{ id: 'own', sketchId: 'S2' }, { id: 'leader', sketchId: 'S3', target: 'P1' }, { id: 'keep', sketchId: 'S3' }];
  f.state.model.hatches = [{ sketchId: 'S2' }]; f.state.model.referenceImages = [{ sketchId: 'S1' }];
  f.state.model.constraints = [{ sketchId: 'S3', nodes: [f.p] }];
  assert.equal(f.cmd.remove('S1', false), true);
  assert.deepEqual(Array.from(f.state.model.points, p => p.id), ['P3']); assert.equal(f.state.model.lines.length, 0);
  assert.equal(f.state.model.constraints.length, 0); assert.equal(f.state.model.hatches.length, 0); assert.equal(f.state.model.referenceImages.length, 0);
  assert.deepEqual(Array.from(f.state.model.annotations, a => a.id), ['keep']); assert.equal(f.state.model.activeSketchId, 'ROOT');
  assert.deepEqual(f.events.map(e => Array.isArray(e) ? e[0] : e), ['cache', 'clearSolve', 'clearSolve', 'clear', 'analysis', 'solve', 'refresh', 'ui', 'draw', 'hint', 'history']);
});
test('Sketch projection descendants survive source removal and are reparented', () => {
  const f = fixture(); f.state.model.constraints.push(Object.assign(new SketchProjectionConstraint(), { sketchId: 'S2', referenceSketchId: 'S1' }));
  f.state.model.activeSketchId = 'S2'; assert.equal(f.cmd.remove('S1', false), true);
  assert.equal(f.state.model.sketches.find(s => s.id === 'S2').parentSketchId, 'ROOT');
  assert.equal(f.state.model.activeSketchId, 'S2'); assert.equal(f.state.model.points.includes(f.childPoint), true); assert.equal(f.state.model.constraints.length, 0);
  f.state.model = { ...f.state.model, sketches: [{ id: 'ROOT' }] }; assert.equal(f.cmd.remove('S2'), false); assert.equal(f.cmd.remove('ROOT'), false);
});
