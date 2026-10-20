const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(source => source.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window;
function fixture() {
  const document = w.DocumentState.create(), workspace = w.EditingWorkspace.create(document), selection = w.CanvasSelection.create();
  const geometryIds = w.GeometryIds.create(), documentIds = w.DocumentIds.create(), calls = [];
  const point = new w.GeometrySolver.Point('P9', 1, 2);
  document.points.push(point); document.annotations.push({ id: 'AN9', text: 'keep until defaults' });
  document.hatches.push({ id: 'H9' }); document.referenceImages.push({ id: 'IMG9' });
  document.defaultAppearance = { color: '#123456' }; document.activeSketchId = 'S9';
  document.sketches.push({ id: 'S9' }); document.parameters.push({ name: 'n' });
  const blockScope = { points: [point] }; workspace.activate(blockScope); selection.set('points', [point]);
  geometryIds.reserve(document); documentIds.reserveAttachments(document); documentIds.allocate('annotation');
  const state = { ready: false, mode: 'line', performance: {}, pending: {}, constraint: {}, pointerQueued: true,
    observations: new Map(), failAt: null, failure: new Error('reset failed'), imageStages: [] };
  function effect(name) {
    assert.equal(state.ready, true); calls.push(name);
    if (state.failAt === name) throw state.failure;
    state.observations.get(name)?.();
  }
  const deps = { documentModel: document, geometryIds, documentIds,
    sketchMoveCommand: { reset: () => effect('sketchMove') },
    activateEditingScope: scope => { assert.equal(scope, document); effect('activate'); workspace.activate(scope); },
    flushPointerMoves: options => { assert.equal(options.discard, true); effect('flush'); state.pointerQueued = false; },
    selectMode: () => { effect('select'); state.mode = 'select'; }, clearAuthoringPerformance: () => { effect('performance'); state.performance = null; },
    invalidateBlockProjectionCache: () => effect('projection'),
    clearSelection: () => { effect('selection'); selection.clear(); },
    pendingCommandSession: { clear: () => { effect('pending'); state.pending = null; } },
    constraintTargetSession: { reset: () => { effect('constraint'); state.constraint = null; } },
    constructionCommand: { restore: value => { assert.equal(value, false); effect('construction'); } },
    referenceImageInteraction: { reset: () => { effect('imageInteraction'); state.imageStages.push(document.annotations); } },
  };
  for (const name of ['geometryDrag', 'dimensionDrag', 'canvasNavigation', 'documentCanvasReset', 'blockPlacementCommand', 'blockEditor', 'hatchCommand', 'sketchTreeView', 'annotationDrag']) deps[name] = { reset: () => effect(name) };
  deps.referenceImageRenderer = { clear: () => effect('imageCache') };
  deps.sketchSolving = { clearAll: () => effect('solveCache') };
  deps.referenceConstraintState = { clear: () => effect('referenceStatus') };
  deps.constraintAnalysis = { invalidate: () => effect('analysis') };
  deps.blankCanvasGesture = { clearSuppression: () => effect('gesture') };
  deps.drawOperationLifecycle = { resetForDocument: () => effect('drawing') };
  deps.hatchGeometryQuery = { clear: () => effect('hatchCache') };
  const controller = w.DocumentEditingReset.create(deps); assert.deepEqual(calls, []); state.ready = true;
  return { document, workspace, blockScope, selection, geometryIds, documentIds, state, calls, controller, point };
}

test('reset returns to document ownership, discards queued input and preserves the two document reset phases', () => {
  const f = fixture(), points = f.document.points, sketches = f.document.sketches, annotations = f.document.annotations;
  const hatches = f.document.hatches, images = f.document.referenceImages;
  f.state.observations.set('sketchMove', () => assert.equal(f.workspace.current(), f.blockScope));
  f.state.observations.set('flush', () => { assert.equal(f.workspace.current(), f.document); assert.equal(points.length, 1); });
  f.state.observations.set('select', () => assert.equal(f.state.pointerQueued, false));
  f.state.observations.set('imageCache', () => {
    assert.equal(f.state.mode, 'select'); assert.equal(f.state.performance, null);
    assert.equal(f.document.points, points); assert.equal(points.length, 0); assert.equal(hatches.length, 0); assert.equal(images.length, 0);
    assert.equal(f.document.annotations, annotations); assert.equal(annotations.length, 1);
  });
  f.state.observations.set('blockEditor', () => {
    assert.equal(f.document.defaultAppearance.color, '#123456'); assert.equal(f.document.sketches, sketches); assert.equal(sketches.length, 3);
    assert.equal(f.state.pending, null); assert.equal(f.state.constraint, null); assert.equal(f.geometryIds.peek('point'), 1); assert.equal(f.documentIds.peek('annotation'), 1);
  });
  f.state.observations.set('hatchCommand', () => {
    assert.equal(f.document.sketches, sketches); assert.equal(sketches.length, 2);
    assert.notEqual(f.document.annotations, annotations); assert.notEqual(f.document.hatches, hatches); assert.notEqual(f.document.referenceImages, images);
    assert.equal(f.document.activeSketchId, w.SketchHierarchy.DEFAULT_SKETCH_ID);
    assert.equal(f.document.defaultAppearance.color, w.Appearance.DEFAULT_APPEARANCE.color);
  });
  f.controller.reset();
  assert.equal(f.selection.selectedElementCount(), 0); assert.equal(f.blockScope.points[0], f.point);
  assert.equal(f.state.imageStages.length, 2); assert.equal(f.state.imageStages[0], annotations); assert.equal(f.state.imageStages[1], f.document.annotations);
  assert.equal(f.calls.at(-1), 'imageInteraction'); assert.equal(f.document.parameters.length, 0);
});

test('reset stops at the original failure boundary without swallowing errors or clearing later state', () => {
  for (const failAt of ['flush', 'imageCache', 'blockEditor']) {
    const f = fixture(); f.state.failAt = failAt;
    assert.throws(() => f.controller.reset(), error => error === f.state.failure);
    assert.equal(f.workspace.current(), f.document); assert.equal(f.calls.at(-1), failAt);
    assert.equal(f.document.defaultAppearance.color, '#123456'); assert.equal(f.document.annotations.length, 1);
    assert.equal(f.calls.includes('hatchCommand'), false);
    if (failAt === 'flush') { assert.equal(f.document.points.length, 1); assert.equal(f.state.mode, 'line'); assert.equal(f.state.pointerQueued, true); }
    else assert.equal(f.document.points.length, 0);
    if (failAt !== 'blockEditor') assert.equal(f.selection.selectedElementCount(), 1);
  }
});

test('repeated resets keep model collections stable while IDs and sessions return to initial state each time', () => {
  const f = fixture(), points = f.document.points, sketches = f.document.sketches;
  f.controller.reset(); f.document.points.push(f.point); f.selection.set('points', [f.point]);
  f.geometryIds.allocate('point'); f.documentIds.allocate('annotation'); f.state.mode = 'offset'; f.state.pending = {};
  f.calls.length = 0; f.controller.reset();
  assert.equal(f.document.points, points); assert.equal(points.length, 0); assert.equal(f.document.sketches, sketches); assert.equal(sketches.length, 2);
  assert.equal(f.geometryIds.allocate('point'), 'P1'); assert.equal(f.documentIds.allocate('annotation'), 'AN1');
  assert.equal(f.state.mode, 'select'); assert.equal(f.state.pending, null); assert.equal(f.selection.selectedElementCount(), 0);
  assert.equal(f.calls.filter(call => call === 'imageInteraction').length, 2);
});
