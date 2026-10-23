const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window;
function fixture() {
  const empty = () => ({ ...Object.fromEntries([...w.SketchMove.fields, 'constraints', 'geometryInstances'].map(field => [field, []])),
    activeSketchId: 'S1', sketches: [{ id: 'ROOT', kind: 'root', name: 'Root' },
      { id: 'S1', kind: 'sketch', name: 'Sketch-1', parentSketchId: 'ROOT' }, { id: 'S2', kind: 'sketch', name: 'Destination', parentSketchId: 'ROOT', visible: false }] });
  const state = { ready: false, scope: empty(), sequence: 3, symbols: true, refreshError: null }, calls = [];
  const read = () => { assert.equal(state.ready, true); return state.scope; };
  const notify = name => (...args) => { assert.equal(state.ready, true); calls.push([name, ...args]); };
  const resolve = ref => [...w.SketchMove.fields.flatMap(field => read()[field])].find(item => item.id === w.GeometryRef.id(ref)) || null;
  const constraintReferences = w.ConstraintReferences.create({ resolveGeometryRef: resolve });
  const sketches = w.SketchContext.create({ currentScope: read, constraintGraphNodes: constraintReferences.constraintGraphNodes });
  const selection = w.CanvasSelection.create();
  const ids = { allocate(kind) { assert.equal(this, ids); assert.equal(kind, 'sketch'); return `S${state.sequence++}`; } };
  const projections = { blockAllProjectionBundle: item => item.bundle, invalidateBlockProjectionCache: notify('cache') };
  const feature = w.SketchEditingFeature.create({ currentScope: read, sketches, ids, selection, constraintReferences,
    geometryReads: { resolveGeometryRef: resolve }, projections, clearSelection: () => { calls.push(['selection']); selection.clear(); },
    clearInteractionForSketchChange: () => { calls.push(['interaction']); state.move?.reset(); },
    applicationText: (_ja,en) => { assert.equal(state.ready, true); return en; }, setHint: notify('hint'), updateUI: notify('ui'),
    draw: notify('draw'), recordHistory: notify('history'), promptName: () => null,
    effectiveAppearanceForElement: item => item.appearance || {}, clearTreeHover: notify('hover'), clearSnap: notify('snap'),
    guardEdit: () => true, prepareLockToggle: notify('lock') });
  const move = feature.createMove({ prepare: notify('prepare'), refresh: () => { notify('refresh')(); if(state.refreshError) throw state.refreshError; } });
  const deletion = feature.createDeletion({ rejectReferencedGeometryDeletion: items => items.length > 0, log: notify('log'),
    geometryElementKey: item => item?.id, guardDimensionSymbolDeletion: () => state.symbols,
    annotationReferencesRemovedGeometry: () => false, clearSketchSolveState: notify('clear-solve'),
    invalidateAnalysis: notify('analysis'), solveSketchAndDependents: notify('solve'), refreshConstraintAnalysis: notify('constraint-refresh'),
    confirmDeletion: () => { calls.push(['confirm']); return true; } });
  assert.deepEqual(calls, []); state.ready = true; state.move = move;
  const point = Object.assign(new w.GeometrySolver.Point('P1', 0.123456789, 2.3456789), { sketchId: 'S1' });
  state.scope.points.push(point);
  return { feature, move, deletion, state, calls, point, selection, empty, names: () => calls.map(call => call[0]) };
}

test('shared Sketch editing keeps move identity, selection, history and current scope across later command creation', () => {
  const f = fixture(), position = [f.point.x, f.point.y]; f.selection.set('points', [f.point]);
  assert.equal(f.move.start(), true); assert.equal(f.move.choose('S2'), true); assert.equal(f.move.commit(), true);
  assert.equal(f.state.scope.points[0], f.point); assert.deepEqual([f.point.x, f.point.y], position); assert.equal(f.point.sketchId, 'S2');
  assert.equal(f.selection.points.length, 0); assert.equal(f.calls.filter(call => call[0] === 'history').length, 1);
  assert.ok(f.names().indexOf('refresh') < f.names().indexOf('history'));
  f.feature.command.activate('S2'); assert.equal(f.state.scope.activeSketchId, 'S2');
  assert.equal(f.state.scope.sketches.find(sketch => sketch.id === 'S2').appearance.visible, true);
  f.state.scope = f.empty(); f.calls.length = 0; f.feature.command.createSketch();
  const created = f.state.scope.sketches.at(-1); assert.equal(created.id, 'S3'); assert.equal(f.state.scope.activeSketchId, 'S3');
  assert.equal(f.deletion.remove('S3'), true); assert.equal(f.state.scope.sketches.includes(created), false);
  assert.equal(f.state.scope.activeSketchId, 'ROOT');
  assert.equal(f.calls.filter(call => call[0] === 'history').length, 2);
});

test('shared Sketch editing preserves move cancellation, deletion rejection and exception boundaries', () => {
  const f = fixture(); f.selection.set('points', [f.point]); assert.equal(f.move.start(), true);
  f.feature.command.activate('S2'); assert.equal(f.move.active, false);
  f.state.symbols = false; f.calls.length = 0; const before = JSON.stringify(f.state.scope);
  assert.equal(f.deletion.remove('S1'), false); assert.equal(JSON.stringify(f.state.scope), before);
  assert.deepEqual(f.names(), ['confirm']);
  f.state.scope.sketches.find(sketch => sketch.id === 'S1').locked = true; f.state.symbols = true; f.calls.length = 0;
  assert.equal(f.deletion.remove('S1'), false); assert.deepEqual(f.names(), ['hint']); assert.equal(f.state.scope.points[0], f.point);
  const other = fixture(); other.selection.set('points', [other.point]); other.move.start(); other.move.choose('S2');
  other.calls.length = 0; const error = new Error('refresh failed'); other.state.refreshError = error;
  const beforeMove = JSON.stringify(other.state.scope);
  assert.equal(other.move.commit(), false);
  assert.deepEqual(other.names(), ['refresh','hint','ui','draw']);
  assert.equal(JSON.stringify(other.state.scope), beforeMove);
  assert.equal(other.state.scope.points[0], other.point); assert.equal(other.move.active, true);
});
