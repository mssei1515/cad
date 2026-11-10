'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function fixture(composed = true, failure = null) {
  const context = { window: {}, structuredClone, performance: { now: () => 100 } }; vm.createContext(context);
  for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js',
    'src/editing/geometry_ids.js', 'src/editing/transient_authoring.js', 'src/editing/checkpoint.js', 'src/application/geometry_mutation_feature.js']) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  const w = context.window, events = [], ports = {}, results = {};
  const scope = () => ({ points: [new w.GeometrySolver.Point('P1', 1, 2)], lines: [], circles: [], arcs: [], splines: [],
    blockInstances: [], geometryInstances: [], annotations: [], constraints: [], parameters: [], nextDimensionParameterIndex: 1 });
  const state = { ready: false, scope: scope(), restoring: false, discard: true, fail: null };
  const ids = w.GeometryIds.create(); ids.reserve(state.scope);
  const ready = () => assert.equal(state.ready, true, 'construction must not read editing state');
  const current = function() { assert.equal(this, undefined); ready(); return state.scope; };
  const selection = { points: [], set(key, value) { assert.equal(this, selection); events.push('selection'); this[key] = value; } };
  const analysis = { invalidate() { assert.equal(this, analysis); ready(); events.push('analysis'); if (state.fail === 'analysis') throw state.error; return 'ignored'; } };
  function invalidateProjection() { assert.equal(this, undefined); ready(); events.push('projection'); if (state.fail === 'projection') throw state.error; }
  const controller = { get restoring() { ready(); events.push('restoring'); return state.restoring; } };
  const documentHistory = { discardLatest(snapshot) {
    assert.equal(this, documentHistory); assert.equal(snapshot, state.snapshot); events.push('discard');
    if (state.fail === 'discard') throw state.error; return state.discard;
  } };
  function captureDocument() { assert.equal(this, undefined); ready(); events.push('snapshot'); return state.snapshot = {}; }
  function updateHistoryButtons() { assert.equal(this, undefined); ready(); events.push('buttons'); }
  const original = { transient: w.TransientAuthoring, checkpoint: w.EditingCheckpoint };
  for (const [name, key] of [['transient', 'TransientAuthoring'], ['checkpoint', 'EditingCheckpoint']]) {
    w[key] = { create(options) {
      assert.equal(this, w[key]); events.push(name); ports[name] = options;
      if (failure?.stage === name) throw failure.error;
      return results[name] = original[name].create(options);
    } };
  }
  const owners = { documentWorkspace: { workspace: { current }, geometryIds: ids }, readServices: { projections: { invalidateBlockProjectionCache: invalidateProjection } },
    interaction: { selection }, history: { controller, captureDocument, documentHistory }, analysis, updateHistoryButtons };
  const prepared = composed ? w.GeometryMutationFeature.prepareForWorkspace(owners) : {
    transient: w.TransientAuthoring.create({ currentScope: current, ids, selection, historySnapshot: captureDocument, documentHistory,
      isHistoryRestoring: () => controller.restoring, updateHistoryButtons, invalidateAnalysis: () => { analysis.invalidate(); } }),
    createCheckpoint() { return w.EditingCheckpoint.create({ currentScope: current, ids, invalidateProjection, invalidateAnalysis: () => { analysis.invalidate(); } }); },
  };
  return { prepared, state, scope, events, ports, results, owners, ids, selection, w };
}

test('mutation preparation returns actual transient and later checkpoints without reading scope, history or analysis early', () => {
  const f = fixture(); assert.deepEqual(f.events, ['transient']); assert.equal(Object.isFrozen(f.prepared), true);
  assert.equal(f.prepared.transient, f.results.transient); const checkpoint = f.prepared.createCheckpoint();
  assert.deepEqual(f.events, ['transient', 'checkpoint']); assert.equal(checkpoint, f.results.checkpoint);
  assert.equal(f.ports.transient.currentScope, f.owners.documentWorkspace.workspace.current);
  assert.equal(f.ports.checkpoint.currentScope, f.ports.transient.currentScope);
  assert.equal(f.ports.checkpoint.ids, f.ids); assert.equal(f.ports.transient.ids, f.ids);
  assert.equal(f.ports.transient.selection, f.selection); assert.equal(f.ports.transient.documentHistory, f.owners.history.documentHistory);
  assert.equal(f.ports.transient.historySnapshot, f.owners.history.captureDocument);
  f.state.ready = true; assert.equal(f.ports.transient.invalidateAnalysis(), undefined); assert.equal(f.ports.checkpoint.invalidateAnalysis(), undefined);
});

test('real provisional point rollback keeps live Workspace, Selection and IDs with distinct history-restoring behavior', () => {
  for (const restoring of [false, true]) {
    const traces = [];
    for (const composed of [false, true]) {
      const f = fixture(composed), transient = f.prepared.transient; f.state.ready = true;
      const old = f.state.scope; f.state.scope = f.scope(); const original = f.state.scope.points[0];
      transient.beginTransientPointRollback();
      const added = new f.w.GeometrySolver.Point(f.ids.allocate('point'), 20, 30); f.state.scope.points.push(added);
      transient.markCreatedPoint(added); f.selection.points = [original, added]; f.state.restoring = restoring; f.events.length = 0;
      assert.equal(transient.isPointHit(added), true); assert.equal(transient.rollbackTransientPoint(), true);
      assert.equal(f.state.scope.points.length, 1); assert.equal(f.state.scope.points[0], original); assert.equal(old.points.length, 1);
      assert.equal(f.selection.points.length, 1); assert.equal(f.selection.points[0], original); assert.equal(f.ids.peek('point'), 2);
      assert.deepEqual(f.events, ['snapshot', 'selection', 'analysis', 'restoring', ...(restoring ? [] : ['discard', 'buttons'])]);
      traces.push(f.events); assert.equal(transient.rollbackTransientPoint(), false);
    }
    assert.deepEqual(traces[1], traces[0]);
  }
});

test('real checkpoints preserve geometry identity, restore membership and IDs, and stay independent from transient rollback state', () => {
  for (const composed of [false, true]) {
    const f = fixture(composed), checkpoint = f.prepared.createCheckpoint(); f.state.ready = true;
    const point = f.state.scope.points[0]; f.prepared.transient.beginTransientLineStartRollback();
    const snapshot = checkpoint.captureGeometry(); point.x = 99;
    f.state.scope.points.push(new f.w.GeometrySolver.Point(f.ids.allocate('point'), 9, 9)); f.events.length = 0;
    checkpoint.restoreGeometry(snapshot);
    assert.equal(f.state.scope.points.length, 1); assert.equal(f.state.scope.points[0], point); assert.equal(point.x, 1);
    assert.equal(f.ids.peek('point'), 2); assert.equal(f.prepared.transient.hasLineStart, true);
    assert.deepEqual(f.events, ['projection', 'analysis']);
    f.state.scope = f.scope(); const next = f.state.scope.points[0], values = checkpoint.captureValues(); next.y = 80;
    checkpoint.restoreValues(values); assert.equal(next.y, 2); assert.equal(point.y, 2);
    assert.equal(f.events.includes('snapshot'), false); assert.equal(f.events.includes('discard'), false);
  }
});

test('mutation construction and invalidation failures preserve original errors and partial rollback boundaries', () => {
  const error = new Error('transient constructor'); assert.throws(() => fixture(true, { stage: 'transient', error }), value => value === error);
  for (const composed of [false, true]) {
    const marker = new Error('checkpoint constructor'), f = fixture(composed, { stage: 'checkpoint', error: marker });
    assert.throws(() => f.prepared.createCheckpoint(), value => value === marker); assert.equal(f.prepared.transient, f.results.transient);
  }
  for (const stage of ['projection', 'analysis', 'discard']) {
    const traces = [];
    for (const composed of [false, true]) {
      const f = fixture(composed), checkpoint = f.prepared.createCheckpoint(); f.state.ready = true;
      f.state.error = new Error(stage); f.state.fail = stage;
      const original = f.state.scope.points[0];
      if (stage === 'discard') {
        f.prepared.transient.beginTransientPointRollback(); f.state.scope.points.push(new f.w.GeometrySolver.Point(f.ids.allocate('point'), 9, 9)); f.events.length = 0;
        assert.throws(() => f.prepared.transient.rollbackTransientPoint(), value => value === f.state.error);
        assert.equal(f.state.scope.points.length, 1); assert.equal(f.ids.peek('point'), 2);
        assert.equal(f.events.includes('buttons'), false);
      } else {
        const snapshot = checkpoint.captureValues(); original.x = 90; f.events.length = 0;
        assert.throws(() => checkpoint.restoreValues(snapshot), value => value === f.state.error);
        assert.equal(original.x, 1); assert.equal(f.events.includes('analysis'), stage === 'analysis');
      }
      traces.push(f.events);
    }
    assert.deepEqual(traces[1], traces[0]);
  }
});
