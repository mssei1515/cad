const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window;
function fixture() {
  const state = { ready: false, hatch: 12, reads: 0, failure: null };
  const model = w.DocumentWorkspace.create({ applicationText: (_ja, en) => { assert.equal(state.ready, true); return en; },
    constraintGraphNodes: () => { assert.equal(state.ready, true); return []; },
    nextHatchIndex: () => { assert.equal(state.ready, true); state.reads++; if (state.failure) throw state.failure; return state.hatch; } });
  assert.equal(state.reads, 0); state.ready = true;
  return { model, state };
}

test('Document composition preserves initial data and returns the actual independent state, workspace and ID owners', () => {
  const { model } = fixture(), other = fixture().model;
  assert.ok(Object.isFrozen(model)); assert.equal(Object.isFrozen(model.document), false);
  assert.equal(model.workspace.document, model.document); assert.equal(model.workspace.current(), model.document);
  assert.equal(model.workspace.snapshotSource(), model.document);
  assert.equal(JSON.stringify(model.document), JSON.stringify(w.DocumentState.create()));
  assert.equal(model.geometryIds.allocate('point'), 'P1'); assert.equal(model.documentIds.allocate('sketch'), 'S2');
  assert.equal(other.geometryIds.allocate('point'), 'P1'); assert.equal(other.documentIds.allocate('sketch'), 'S2');
  assert.notEqual(model.document.points, other.document.points); assert.notEqual(model.document.sketches, other.document.sketches);
});

test('Sketch and Parameter queries follow the same workspace through local editing and restoration', () => {
  const { model } = fixture(), root = model.document;
  root.parameters.push({ name: 'width', expression: '10' });
  assert.equal(model.parameters.evaluateDimensionExpressionDraft(null, '"width"'), 10);
  assert.equal(model.sketches.activeSketchId(), 'S1');
  const host = model.workspace.capture(), local = w.DocumentState.create();
  local.sketches[1].id = 'S5'; local.activeSketchId = 'S5'; local.parameters.push({ name: 'width', expression: '20' });
  model.workspace.activate(local);
  assert.equal(model.sketches.activeSketchId(), 'S5'); assert.equal(model.sketches.sketchById('S5'), local.sketches[1]);
  assert.equal(model.parameters.evaluateDimensionExpressionDraft(null, '"width"'), 20);
  const source = model.workspace.snapshotSource(); assert.equal(source.parameters, local.parameters); assert.equal(source.blockDefinitions, root.blockDefinitions);
  model.workspace.restore(host);
  assert.equal(model.workspace.current(), root); assert.equal(model.sketches.activeSketchId(), 'S1');
  assert.equal(model.parameters.evaluateDimensionExpressionDraft(null, '"width"'), 10);
});

test('reservation shares the returned counters and keeps the delayed Hatch read and partial failure order', () => {
  const { model, state } = fixture(), source = { points: [{ id: 'P20' }], hatches: [{ id: 'H8' }],
    referenceImages: [{ id: 'IMG3' }], sketches: [{ id: 'S7' }], annotations: [{ id: 'AN4' }] };
  model.reservation.geometry(source); assert.equal(state.reads, 0);
  assert.equal(model.geometryIds.peek('point'), 21); assert.equal(model.documentIds.peek('hatch'), 9);
  assert.equal(model.documentIds.peek('referenceImage'), 4); assert.equal(model.documentIds.peek('sketch'), 2);
  const failure = new Error('Hatch scope not ready'); state.failure = failure;
  assert.throws(() => model.reservation.scope(source), error => error === failure);
  assert.equal(state.reads, 1); assert.equal(model.geometryIds.peek('point'), 21); assert.equal(model.documentIds.peek('hatch'), 9);
  assert.equal(model.documentIds.peek('sketch'), 2); assert.equal(model.documentIds.peek('annotation'), 1);
  state.failure = null; model.reservation.scope(source);
  assert.equal(state.reads, 2); assert.equal(model.documentIds.peek('hatch'), 12);
  assert.equal(model.documentIds.peek('sketch'), 8); assert.equal(model.documentIds.peek('annotation'), 5);
});

test('Document read assembly shares the fixed Document and live Workspace but keeps bound Sketch appearance reads separate', () => {
  const { model } = fixture(), calls = [];
  let ready = false, bound = w.DocumentState.create();
  bound.sketches[1].dimensionAppearance = { prefix: 'bound' };
  model.document.sketches[1].appearance = { color: '#123456' };
  model.document.sketches[1].dimensionAppearance = { prefix: 'workspace' };
  const point = (id, x) => Object.assign(new w.GeometrySolver.Point(id, x, 0), { sketchId: 'S1' });
  const line = Object.assign(new w.GeometrySolver.Line('L1', point('P1', 0), point('P2', 10)), { sketchId: 'S1' });
  model.document.lines.push(line);
  const check = () => assert.equal(ready, true, 'read assembly must not resolve late dependencies');
  const services = model.createGeometryReadServices({ currentSketches: () => { check(); calls.push('sketches'); return bound.sketches; },
    prepareBlocks: () => { check(); calls.push('prepare'); }, showHiddenElements: () => { check(); return false; },
    viewportScale: () => { check(); return 1; }, profileRead: read => { check(); calls.push('profile'); return read(); } });
  assert.deepEqual(calls, []); assert.ok(Object.isFrozen(services)); ready = true;
  assert.equal(services.reads.allGeometryLines()[0], line);
  assert.equal(services.geometryAppearance.effectiveAppearanceForElement(line).color, '#123456');
  assert.equal(services.dimensionAppearance.dimensionDisplayState({}).prefix, 'bound');
  const definition = { ...w.DocumentState.create(), id: 'BD1' }; model.document.blockDefinitions = [definition];
  const local = w.DocumentState.create(), localLine = Object.assign(new w.GeometrySolver.Line('L2', point('P3', 20), point('P4', 30)), { sketchId: 'S1' });
  local.lines.push(localLine); local.sketches[1].appearance = { color: '#778899' }; local.sketches[1].dimensionAppearance = { prefix: 'local' };
  model.workspace.activate(local);
  assert.equal(services.reads.allGeometryLines()[0], localLine);
  assert.equal(services.geometryAppearance.effectiveAppearanceForElement(localLine).color, '#778899');
  assert.equal(services.catalog.blockDefinitionById('BD1'), definition);
  assert.equal(services.dimensionAppearance.dimensionDisplayState({}).prefix, 'bound');
  bound = w.DocumentState.create(); bound.sketches[1].dimensionAppearance = { prefix: 'rebound' };
  assert.equal(services.dimensionAppearance.dimensionDisplayState({}).prefix, 'rebound');
});

test('Document read assembly retains cache lifetime, explicit invalidation and late preparation failures', () => {
  const { model } = fixture(), failure = new Error('Block preparation failed'); let reject = true;
  const line = Object.assign(new w.GeometrySolver.Line('L1', new w.GeometrySolver.Point('P1', 0, 0), new w.GeometrySolver.Point('P2', 10, 0)), { sketchId: 'S1' });
  model.document.lines.push(line);
  const services = model.createGeometryReadServices({ currentSketches: () => model.document.sketches,
    prepareBlocks: () => { if (reject) throw failure; }, showHiddenElements: () => false, viewportScale: () => 1, profileRead: read => read() });
  const before = JSON.stringify(model.document);
  services.reads.withGeometryReadCache(() => {
    assert.throws(() => services.reads.allGeometryLines(), error => error === failure);
    assert.equal(JSON.stringify(model.document), before); reject = false;
    const cached = services.reads.allGeometryLines(); assert.equal(cached[0], line);
    const local = w.DocumentState.create(); model.workspace.activate(local);
    assert.equal(services.reads.allGeometryLines(), cached);
    services.reads.clearReadCache(); assert.equal(services.reads.allGeometryLines().length, 0);
  });
});

function readContextFixture() {
  const { model } = fixture(), calls = [], state = { failure: null }; let binding;
  const context = model.createReadContext({ currentSketches: () => binding.current.sketches,
    prepareBlocks() {}, showHiddenElements: () => false, viewportScale: () => 1, profileRead: read => read() });
  assert.deepEqual(calls, []); assert.equal(binding, undefined); assert.ok(Object.isFrozen(context));
  const stage = name => {
    calls.push({ name, bound: binding.current, workspace: model.workspace.current(), solver: binding.solver.model });
    if (state.failure === name) throw state.error;
  };
  binding = context.createScopeBinding({ Solver: w.GeometrySolver.ConstraintSolver,
    closeSketchContext: () => stage('close'), resetSketchMove: () => stage('move') });
  assert.deepEqual(calls, []); assert.ok(Object.isFrozen(binding));
  return { model, context, binding, calls, state };
}

test('read context binds the same Workspace and Solver while invalidating its actual geometry and projection caches', () => {
  const f = readContextFixture(), { model, binding } = f, services = f.context.services;
  assert.equal(binding.current, model.document); assert.equal(binding.solver.model, model.document);
  const makeDefinition = x => {
    const definition = { ...w.DocumentState.create(), id: 'BD1', revision: 1, origin: { x: 0, y: 0 } };
    const a = Object.assign(new w.GeometrySolver.Point('P1', x, 0), { sketchId: 'S1' });
    const b = Object.assign(new w.GeometrySolver.Point('P2', x + 10, 0), { sketchId: 'S1' });
    definition.points = [a, b]; definition.lines = [Object.assign(new w.GeometrySolver.Line('L1', a, b), { sketchId: 'S1' })];
    return definition;
  };
  const instance = { id: 'BI1', definitionId: 'BD1', sketchId: 'S1', x: 20, y: 30, rotation: 0 };
  const definition = makeDefinition(1); model.document.blockDefinitions = [definition]; model.document.blockInstances.push(instance);
  const local = w.DocumentState.create(); local.blockInstances.push(instance);
  services.reads.withGeometryReadCache(() => {
    const oldLines = services.reads.allGeometryLines(), oldBundle = services.projections.blockProjectionBundle(instance);
    assert.equal(oldBundle.points[0].x, 21);
    const replacement = makeDefinition(12); definition.points = replacement.points; definition.lines = replacement.lines;
    assert.equal(services.projections.blockProjectionBundle(instance), oldBundle);
    const solver = binding.solver; binding.activate(local);
    assert.equal(binding.solver, solver); assert.equal(solver.model, local); assert.equal(model.workspace.current(), local);
    assert.ok(f.calls.every(call => call.bound === model.document && call.workspace === model.document && call.solver === model.document));
    const nextLines = services.reads.allGeometryLines(), nextBundle = services.projections.blockProjectionBundle(instance);
    assert.notEqual(nextLines, oldLines); assert.notEqual(nextBundle, oldBundle); assert.equal(nextBundle.points[0].x, 32);
  });
  assert.deepEqual(f.calls.map(call => call.name), ['close', 'move']);
});

test('read context preserves restoration before teardown and stops activation at a failed move reset', () => {
  const f = readContextFixture(), { model, binding } = f, host = model.workspace.capture(), draft = w.DocumentState.create();
  binding.activate(draft); model.workspace.restore(host);
  assert.equal(model.workspace.current(), model.document); assert.equal(binding.current, draft); assert.equal(binding.solver.model, draft);
  f.calls.length = 0; f.state.failure = 'move'; f.state.error = new Error('move reset failed');
  assert.throws(() => binding.activate(model.document), error => error === f.state.error);
  assert.deepEqual(f.calls.map(call => call.name), ['close', 'move']);
  assert.ok(f.calls.every(call => call.bound === draft && call.workspace === model.document && call.solver === draft));
  assert.equal(binding.current, draft); assert.equal(binding.solver.model, draft);
  f.state.failure = null; binding.activate(model.document);
  assert.equal(binding.current, model.document); assert.equal(binding.solver.model, model.document);
});
