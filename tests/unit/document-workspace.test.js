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

function readContextFixture(buildBinding = (context, options) => context.createScopeBinding(options)) {
  const { model } = fixture(), calls = [], state = { failure: null }; let binding;
  const context = model.createReadContext({ currentSketches: () => binding.current.sketches,
    prepareBlocks() {}, showHiddenElements: () => false, viewportScale: () => 1, profileRead: read => read() });
  assert.deepEqual(calls, []); assert.equal(binding, undefined); assert.ok(Object.isFrozen(context));
  const stage = name => {
    calls.push({ name, bound: binding.current, workspace: model.workspace.current(), solver: binding.solver.model });
    if (state.failure === name) throw state.error;
  };
  binding = buildBinding(context, { Solver: w.GeometrySolver.ConstraintSolver,
    closeSketchContext: () => stage('close'), resetSketchMove: () => stage('move') }, model);
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

function persistenceFixture(beforeCreate = () => {}, readOptions = {}, build = (context, options) => context.createPersistence(options)) {
  const { model } = fixture(), state = { ready: false, bound: model.document, block: null }, calls = [];
  const check = () => assert.equal(state.ready, true, 'persistence construction must defer model queries');
  const context = model.createReadContext({ currentSketches: () => { check(); return state.bound.sketches; },
    prepareBlocks: () => { check(); }, showHiddenElements: () => false, viewportScale: () => { check(); return 2; }, profileRead: work => work(), ...readOptions });
  const references = w.ConstraintReferences.create({ resolveGeometryRef: () => null });
  const pointUsage = context.services.createPointUsage({ constraintReferencesPoint: references.constraintReferencesPoint, editedFitPoints: () => [] });
  const before = JSON.stringify(model.document);
  const placement = w.DimensionPlacement.create({ viewport: { scale: 2 } });
  const options = { placement, pointUsage,
    readEditingScope: () => { check(); state.boundReads = (state.boundReads || 0) + 1; return state.bound; }, readBlockEditor: () => { check(); return state.block; }, version: 26,
    constraintReferencesPoint: references.constraintReferencesPoint,
    separateSharedSketchProjectionTargetPoints: () => { check(); calls.push('separate'); },
    normalizeArcSweeps: arcs => { check(); calls.push(['arcs', arcs]); },
  };
  beforeCreate(context, options);
  const persistence = build(context, options);
  assert.equal(JSON.stringify(model.document), before); assert.deepEqual(calls, []); state.ready = true;
  return { model, state, calls, persistence, placement, context, options };
}

test('Workspace persistence selects the current format without changing explicit versions or native writer results', () => {
  const omitted = Symbol('omitted');
  for (const version of [omitted, undefined, null, 27]) {
    const results = [];
    for (const owned of [false, true]) {
      const original = w.DocumentSnapshot, expected = version === omitted ? 26 : version;
      let writer, ports;
      w.DocumentSnapshot = { ...original, createWriter(options) {
        assert.equal(this, w.DocumentSnapshot); assert.equal(arguments.length, 1); ports = options;
        return writer = original.createWriter(options);
      } };
      let f;
      try {
        f = persistenceFixture((_context, options) => {
          if (version === omitted) delete options.version; else options.version = version;
        }, {}, (context, options) => owned ? context.createPersistenceForWorkspace(options)
          : context.createPersistence({ ...options, version: expected }));
      } finally { w.DocumentSnapshot = original; }
      assert.equal(f.persistence.writer, writer); assert.equal(ports.version, expected); assert.equal(f.persistence.version, expected);
      assert.equal(Object.getOwnPropertyDescriptor(f.persistence, 'version').writable, false);
      const source = addPersistedLine(f.model.document, 'FORMAT', 10);
      const saved = f.context.persistence.serializeModel(); assert.equal(saved.version, expected); assert.ok(Object.hasOwn(saved, 'version'));
      assert.equal(f.model.document.lines[0], source.line);
      if (version === omitted) {
        const loaded = f.persistence.loading.decode(saved);
        assert.equal(loaded.lines[0].p1, loaded.points[0]); assert.equal(loaded.constraints[0].p1, loaded.points[0]);
      }
      saved.savedAt = 'TIME'; results.push(JSON.stringify(saved));
    }
    assert.equal(results[1], results[0]);
  }
  const raw = persistenceFixture((_context, options) => { delete options.version; });
  assert.equal(raw.persistence.version, undefined); assert.equal(raw.context.persistence.serializeModel().version, undefined);
});

test('read context connects the same Block preparation before services exist and normalizes only when read', () => {
  const original = w.GeometryReadServices; let connected;
  const unready = error => error.name === 'ReferenceError' && error.message === "Cannot access 'documentPreparation' before initialization";
  w.GeometryReadServices = { ...original, createWithHatches(options) {
    connected = options.prepareBlocks; assert.throws(() => connected(), unready);
    return original.createWithHatches(options);
  } };
  try {
    const f = persistenceFixture(context => {
      assert.equal(context.persistence.ensureBlockState, connected);
      assert.throws(() => context.services.reads.blockProjectionBundles(), unready);
    }, { prepareBlocks: undefined });
    const definition = Object.assign(w.DocumentState.create(), { id: 'BD1' }), line = addPersistedLine(definition, 'L1');
    const instance = { id: 'BI1', definitionId: 'BD1', sketchId: 'missing', x: '20', y: '3' };
    f.model.document.blockDefinitions.push(definition); f.model.document.blockInstances.push(instance);
    assert.equal(instance.x, '20');
    const bundle = f.context.services.reads.blockProjectionBundles()[0];
    assert.equal(instance.x, 20); assert.equal(instance.sketchId, 'S1');
    assert.equal(bundle.instance, instance); assert.equal(bundle.lines[0].p1.x, 20);
    assert.equal(definition.lines[0], line.line); assert.equal(line.constraint.p1, line.p1);
    const local = w.DocumentState.create(), host = f.model.workspace.capture(); f.model.workspace.activate(local);
    // Reads use Workspace.current; preparation continues to use the separately bound scope.
    const untouched = { definitionId: 'BD1', x: '7' }; local.blockInstances.push(untouched);
    f.context.persistence.ensureBlockState(); assert.equal(untouched.x, '7');
    f.state.bound = local; f.context.persistence.ensureBlockState(); assert.equal(untouched.x, 7);
    assert.equal(f.model.document.blockDefinitions[0], definition); f.model.workspace.restore(host);
  } finally { w.GeometryReadServices = original; }
});

test('read context preserves explicit preparation callbacks and null without consulting unpublished persistence', () => {
  const { model } = fixture(); let calls = 0;
  function explicit() { 'use strict'; assert.equal(this, undefined); assert.equal(arguments.length, 0); calls++; }
  function create(prepareBlocks) { return model.createReadContext({ currentSketches: () => model.document.sketches,
    prepareBlocks, showHiddenElements: () => false, viewportScale: () => 1, profileRead: read => read() }); }
  const context = create(explicit); assert.equal(calls, 0);
  assert.equal(context.services.reads.blockProjectionBundles().length, 0); assert.equal(calls, 1);
  assert.throws(() => context.persistence.ensureBlockState(), error => error.name === 'ReferenceError');
  assert.throws(() => create(null).services.reads.blockProjectionBundles(), error => error.name === 'TypeError');
  assert.throws(() => create(undefined).services.reads.blockProjectionBundles(), error => error.name === 'ReferenceError');
  const failure = new Error('explicit preparation failed');
  assert.throws(() => create(() => { throw failure; }).services.reads.blockProjectionBundles(), error => error === failure);
});

test('context rebinding uses actual codecs and projections through publication and keeps cloned geometry references', () => {
  let rebinding;
  const f = persistenceFixture(context => {
    rebinding = context.createRebinding();
    assert.throws(() => rebinding.cloneForBlock({}), error => error.name === 'ReferenceError' && error.message === "Cannot access 'constraintCodecs' before initialization");
  });
  const source = addPersistedLine(f.model.document, 'L1'), api = f.context.persistence;
  const byId = new Map(f.model.document.points.map(point => [point.id, point]));
  const copy = rebinding.cloneForBlock(source.constraint, byId, new Map(), new Map(), { x: 2, y: 3 }, true);
  assert.equal(copy.p1, source.p1); assert.equal(copy.p2, source.p2); assert.equal(copy.parameterName, 'd1');
  assert.equal(copy.dimension.x, source.constraint.dimension.x - 2); assert.equal(copy.dimension.y, source.constraint.dimension.y - 3);
  const direct = w.ConstraintRebinding.create({ catalog: f.context.services.catalog, projections: f.context.services.projections,
    geometryInstanceBundlesForScope: f.context.services.instances.geometryInstanceBundlesForScope, ...api,
    applicationText: (_ja, en) => en });
  assert.equal(JSON.stringify(copy), JSON.stringify(direct.cloneForBlock(source.constraint, byId, new Map(), new Map(), { x: 2, y: 3 }, true)));
  rebinding.rebuildDocument(f.model.document, []);
  assert.equal(f.model.document.constraints[0].p1, source.p1); assert.equal(f.model.document.lines[0], source.line);
  const definition = Object.assign(w.DocumentState.create(), { id: 'BD1' }); addPersistedLine(definition, 'CHILD');
  f.model.document.blockDefinitions.push(definition);
  const local = w.DocumentState.create(), instance = { id: 'BI1', definitionId: 'BD1', sketchId: 'S1', x: 30, y: 0, rotation: 0 };
  local.blockInstances.push(instance);
  const bundle = f.context.services.projections.createBlockProjectionBundle(instance, definition);
  const projected = new w.GeometrySolver.DistanceConstraint(bundle.points[0], bundle.points[1], 10); local.constraints.push(projected);
  assert.equal(rebinding.rebuildDefinition(local), 0);
  assert.equal(local.constraints[0].p1.id, bundle.points[0].id);
  assert.equal(local.constraints[0].p1.x, bundle.points[0].x);
});

test('context rebinding selects the same owners at factory time and propagates the actual API and construction errors', () => {
  const f = persistenceFixture(), original = w.ConstraintRebinding, result = {}, failure = new Error('rebinding construction failed');
  let fail = false, calls = 0;
  const namespace = { ...original, create(options) {
    assert.equal(this, namespace); assert.equal(arguments.length, 1); calls++;
    assert.equal(options.catalog, f.context.services.catalog); assert.equal(options.projections, f.context.services.projections);
    assert.equal(options.geometryInstanceBundlesForScope, f.context.services.instances.geometryInstanceBundlesForScope);
    for (const name of ['serializeConstraint', 'decorateSerializedConstraint', 'deserializeConstraint']) assert.equal(options[name], f.context.persistence[name]);
    assert.equal(options.applicationText('日本語', 'English'), 'English');
    if (fail) throw failure; return result;
  } };
  w.ConstraintRebinding = namespace;
  try {
    assert.equal(f.context.createRebinding('ignored'), result); fail = true;
    assert.throws(() => f.context.createRebinding(), error => error === failure); assert.equal(calls, 2);
  } finally { w.ConstraintRebinding = original; }
});

test('persistence operations are available before construction but reject reads until the complete bundle is published', () => {
  const original = w.DocumentLoading, seen = [], failure = new Error('loading construction failed');
  function assertUnready(api) {
    for (const [method, binding] of [['serializeConstraint', 'constraintCodecs'], ['deserializeConstraint', 'constraintCodecs'],
      ['decorateSerializedConstraint', 'constraintMetadata'], ['serializeModel', 'documentWriter']]) {
      assert.throws(() => api[method](), error => error.name === 'ReferenceError' && error.message === `Cannot access '${binding}' before initialization`);
    }
  }
  let pending;
  w.DocumentLoading = { ...original, createWithCodecs(options) {
    assertUnready(pending); seen.push('loading'); return original.createWithCodecs(options);
  } };
  try {
    const f = persistenceFixture((context, options) => {
      pending = context.persistence; assert.ok(Object.isFrozen(pending)); assertUnready(pending);
      assert.equal(pending.serializeConstraint.length, 1); assert.equal(pending.deserializeConstraint.length, 0);
      assert.equal(pending.decorateSerializedConstraint.length, 2); assert.equal(pending.serializeModel.length, 0);
      const successfulFactory = w.DocumentLoading;
      w.DocumentLoading = { ...original, createWithCodecs() { assertUnready(pending); throw failure; } };
      try { assert.throws(() => context.createPersistence(options), error => error === failure); assertUnready(pending); }
      finally { w.DocumentLoading = successfulFactory; }
    });
    assert.deepEqual(seen, ['loading']); assert.equal(f.context.persistence, pending);
    assert.equal(pending.serializeModel().version, 26);
  } finally { w.DocumentLoading = original; }
});

test('persistence operations use real codecs and keep Workspace snapshots, bound preparation and geometry identities', () => {
  const f = persistenceFixture(), api = f.context.persistence, root = f.model.document;
  const source = addPersistedLine(root, 'ROOT');
  const encoded = api.serializeConstraint(source.constraint);
  assert.equal(JSON.stringify(encoded), JSON.stringify(f.persistence.codecs.serialize(source.constraint)));
  const decorated = api.decorateSerializedConstraint(encoded, source.constraint);
  assert.equal(decorated, encoded); assert.equal(encoded.parameterName, 'd1'); assert.equal(encoded.expression, '10');
  const host = f.model.workspace.capture(), local = w.DocumentState.create(); addPersistedLine(local, 'LOCAL', 20);
  f.model.workspace.activate(local); f.state.bound = local;
  assert.equal(api.serializeModel().lines[0].id, 'LOCAL');
  f.model.workspace.restore(host); f.state.bound = root;
  const snapshot = api.serializeModel(), loaded = f.persistence.loading.decode(snapshot);
  assert.equal(snapshot.version, 26); assert.equal(snapshot.lines[0].id, 'ROOT');
  assert.equal(root.lines[0], source.line); assert.equal(source.constraint.p1, source.p1);
  assert.equal(loaded.constraints[0].p1, loaded.points[0]); assert.equal(loaded.lines[0].p2, loaded.points[1]);
  assert.equal(loaded.constraints[0].dimension.labelOffsetU, 7);
  const byId = new Map(loaded.points.map(point => [point.id, point]));
  const decoded = api.deserializeConstraint(snapshot.constraints[0], byId);
  assert.equal(decoded.p1, loaded.points[0]); assert.equal(decoded.p2, loaded.points[1]);
});

test('persistence operation forwarding retains member receivers, argument counts, results and original errors', () => {
  const originals = { constraint: w.ConstraintPersistence, snapshot: w.DocumentSnapshot }, calls = [], result = {}, failure = new Error('operation failed');
  let fail = false;
  function method(owner, name) { return function() {
    assert.equal(this, owner); calls.push([name, Array.from(arguments)]); if (fail) throw failure; return result;
  }; }
  const codecs = {}, metadata = {}, writer = {};
  codecs.serialize = method(codecs, 'serialize'); codecs.deserialize = method(codecs, 'deserialize');
  metadata.decorate = method(metadata, 'decorate'); writer.serialize = method(writer, 'writer');
  w.ConstraintPersistence = { ...originals.constraint,
    createWithDimensions(options) { return { ...originals.constraint.createWithDimensions(options), codecs }; },
    createMetadata(options) { return Object.assign(metadata, originals.constraint.createMetadata(options), { decorate: method(metadata, 'decorate') }); } };
  w.DocumentSnapshot = { ...originals.snapshot, createWriter() { return writer; } };
  try {
    const api = persistenceFixture().context.persistence, a = {}, b = {}, extra = {};
    for (const [name, args] of [['serializeConstraint', [a, extra]], ['deserializeConstraint', [a, b, extra]],
      ['decorateSerializedConstraint', [a, b, extra]], ['serializeModel', [extra]]]) assert.equal(api[name](...args), result);
    assert.deepEqual(calls, [['serialize', [a]], ['deserialize', [a, b, extra]], ['decorate', [a, b]], ['writer', []]]);
    fail = true;
    for (const name of ['serializeConstraint', 'deserializeConstraint', 'decorateSerializedConstraint', 'serializeModel']) {
      assert.throws(() => api[name](), error => error === failure);
    }
  } finally { w.ConstraintPersistence = originals.constraint; w.DocumentSnapshot = originals.snapshot; }
});

test('persistence publication belongs to each read context and failed reconstruction keeps its last complete bundle', () => {
  const f = persistenceFixture(), g = persistenceFixture(), original = w.DocumentLoading, api = f.context.persistence;
  addPersistedLine(f.model.document, 'FIRST'); addPersistedLine(g.model.document, 'OTHER');
  const failure = new Error('second loading failed');
  w.DocumentLoading = { ...original, createWithCodecs() { throw failure; } };
  try {
    assert.throws(() => f.context.createPersistence({ ...f.options, version: 99 }), error => error === failure);
    assert.equal(api.serializeModel().version, 26); assert.equal(api.serializeModel().lines[0].id, 'FIRST');
    assert.equal(g.context.persistence.serializeModel().lines[0].id, 'OTHER');
  } finally { w.DocumentLoading = original; }
  f.context.createPersistence({ ...f.options, version: 27 });
  assert.equal(f.context.persistence, api); assert.equal(api.serializeModel().version, 27);
  assert.equal(g.context.persistence.serializeModel().version, 26);
  const context = f.model.createReadContext({ currentSketches: () => f.state.bound.sketches, prepareBlocks: () => {},
    showHiddenElements: () => false, viewportScale: () => 2, profileRead: read => read() });
  assert.throws(() => context.persistence.serializeModel(), error => error.name === 'ReferenceError');
  assert.equal(api.serializeModel().version, 27);
});

function addPersistedLine(scope, id, x = 0) {
  const p1 = Object.assign(new w.GeometrySolver.Point(id + 'a', x, 0), { sketchId: 'S1', kind: 'endpoint' });
  const p2 = Object.assign(new w.GeometrySolver.Point(id + 'b', x + 10, 0), { sketchId: 'S1', kind: 'endpoint' });
  const line = Object.assign(new w.GeometrySolver.Line(id, p1, p2), { sketchId: 'S1' });
  const constraint = Object.assign(new w.GeometrySolver.DistanceConstraint(p1, p2, 10), {
    sketchId: 'S1', parameterName: 'd1', expression: '10', dimension: { x: 5, y: 7, labelOffsetU: 7 } });
  scope.points.push(p1, p2); scope.lines.push(line); scope.constraints.push(constraint);
  return { p1, p2, line, constraint };
}

test('editing instance normalization follows the live Workspace without changing the explicit file codec', () => {
  const f = persistenceFixture(), api = f.persistence, host = f.model.workspace.capture();
  assert.equal(api.normalizeGeometryInstance.length, 1);
  for (const sketchId of [undefined, null, '', 0, false, NaN]) {
    assert.equal(api.normalizeGeometryInstance({ sketchId }).sketchId, 'S1');
  }
  const local = w.DocumentState.create(); local.sketches[1].id = 'S9'; local.activeSketchId = 'S9';
  f.model.workspace.activate(local);
  // The bound preparation scope deliberately remains the host Document.
  assert.equal(f.state.bound, f.model.document);
  assert.equal(api.normalizeGeometryInstance({ type: 'pattern' }, undefined, 4).sketchId, 'S9');
  assert.equal(api.normalizeGeometryInstance({ type: 'pattern' }, undefined, 4).id, 'PI5');
  assert.equal(api.normalizeGeometryInstance({ sketchId: 73 }).sketchId, '73');
  assert.equal(api.normalizeGeometryInstance({}, value => 'explicit:' + value).sketchId, 'explicit:undefined');
  assert.equal(api.geometryInstances.normalize({}, () => 'file-sketch').sketchId, 'file-sketch');
  assert.throws(() => api.geometryInstances.normalize({}), /normalizeSketch/);
  f.model.workspace.restore(host);
  assert.equal(api.normalizeGeometryInstance({}).sketchId, 'S1');
});

test('editing normalizer preserves the previous root defaults, return values and failures', () => {
  const { model, persistence: api } = persistenceFixture();
  const { activeSketchId } = model.sketches;
  function previous(raw, normalizeSketch = value => String(value || activeSketchId()), index = 0) {
    return api.geometryInstances.normalize(raw, normalizeSketch, index);
  }
  const inputs = [undefined, null, {}, { type: 'mirror', sketchId: 'S7', axis: 'L1' },
    { type: 'pattern', copies: 3, spacing: 10, sources: [{ kind: 'line', path: ['L1'] }] },
    { type: 'circularPattern', placement: { type: 'circularPattern' }, sketchId: 'S4' }];
  for (const raw of inputs) for (const index of [undefined, 0, 4, '2', null]) {
    assert.equal(JSON.stringify(api.normalizeGeometryInstance(raw, undefined, index)), JSON.stringify(previous(raw, undefined, index)));
  }
  const failure = new Error('resolver failed');
  for (const normalize of [previous, api.normalizeGeometryInstance]) {
    assert.throws(() => normalize({}, () => { throw failure; }), error => error === failure);
    assert.throws(() => normalize({}, null), /normalizeSketch/);
    let calls = 0;
    assert.throws(() => normalize({ type: 'free' }, () => { calls++; }), /同期インスタンス/);
    assert.equal(calls, 0);
  }
});

test('editing normalizer keeps raw codec receiver and three arguments, with a fresh lazy default resolver', () => {
  const original = w.DocumentLoading;
  const calls = [], result = {}, failure = new Error('codec failed');
  let fail = false;
  const codec = { normalize: function(raw, resolver, index) {
    assert.equal(this, codec); assert.equal(arguments.length, 3);
    calls.push({ raw, resolver, index }); if (fail) throw failure; return result;
  } };
  w.DocumentLoading = { ...original, createWithCodecs(options) {
    return { ...original.createWithCodecs(options), geometryInstances: codec };
  } };
  try {
    const { model, persistence: api } = persistenceFixture();
    assert.deepEqual(calls, []);
    const raw = {};
    assert.equal(api.normalizeGeometryInstance(raw), result);
    assert.equal(api.normalizeGeometryInstance(raw, undefined, undefined, 'ignored'), result);
    assert.equal(calls[0].raw, raw); assert.equal(calls[0].index, 0);
    assert.notEqual(calls[0].resolver, calls[1].resolver);
    const local = w.DocumentState.create(); local.sketches[1].id = 'S8'; local.activeSketchId = 'S8';
    model.workspace.activate(local);
    assert.equal(calls[0].resolver(''), 'S8');
    assert.equal(calls[0].resolver('S4'), 'S4');
    const explicit = value => value;
    api.normalizeGeometryInstance(raw, explicit, null);
    assert.equal(calls[2].resolver, explicit); assert.equal(calls[2].index, null);
    fail = true;
    assert.throws(() => api.normalizeGeometryInstance(raw), error => error === failure);
  } finally { w.DocumentLoading = original; }
});

test('Document persistence shares actual codecs and round trips dimensions and geometry without applying a load', () => {
  const f = persistenceFixture(), source = addPersistedLine(f.model.document, 'L1'), api = f.persistence;
  f.model.document.documentName = '  Example  '; f.model.documentIds.restore({ hatchSeq: 12 });
  const data = api.writer.serialize();
  assert.equal(data.documentName, 'Example'); assert.equal(data.version, 26); assert.equal(data.nextHatchIndex, 12);
  assert.equal(data.constraints[0].type, 'distance'); assert.equal(data.constraints[0].expression, '10');
  assert.equal(data.constraints[0].parameterName, 'd1'); assert.equal(data.constraints[0].dimension.labelOffsetU, 7);
  assert.equal(JSON.stringify(api.dimensions.serialize(source.constraint.dimension, w.DimensionQueries.targetFromConstraint(source.constraint))), JSON.stringify(data.constraints[0].dimension));
  const modelBefore = JSON.stringify(f.model.document), inputBefore = JSON.stringify(data), loaded = api.loading.decode(data);
  assert.equal(JSON.stringify(data), inputBefore); assert.equal(JSON.stringify(f.model.document), modelBefore);
  assert.ok(loaded.constraints[0] instanceof w.GeometrySolver.DistanceConstraint);
  assert.equal(loaded.lines[0].p1, loaded.points[0]); assert.equal(loaded.constraints[0].p2, loaded.points[1]);
  assert.equal(loaded.constraints[0].expression, '10'); assert.equal(loaded.constraints[0].dimension.labelOffsetU, 7);
  assert.notEqual(loaded.points[0], source.p1);
  assert.equal(api.metadata.snapshotData(source.constraint, f.model.document, true).sketchId, 'S1');
});

test('Document persistence follows workspace snapshots and bound preparation separately and rejects invalid input before install', () => {
  const f = persistenceFixture(), root = f.model.document, api = f.persistence, host = f.model.workspace.capture();
  addPersistedLine(root, 'ROOT-L'); const local = w.DocumentState.create(); addPersistedLine(local, 'LOCAL-L', 20);
  f.model.workspace.activate(local); f.state.bound = local;
  assert.equal(api.writer.serialize().lines[0].id, 'LOCAL-L');
  f.model.workspace.restore(host); f.state.bound = root;
  const data = api.writer.serialize(); assert.equal(data.lines[0].id, 'ROOT-L');
  const before = JSON.stringify(root), invalid = structuredClone(data); invalid.units.length = 'inch';
  assert.throws(() => api.loading.decode(invalid), /length unit|長さ単位/); assert.equal(JSON.stringify(root), before);
  const destination = w.DocumentState.create(), candidate = api.loading.decode(data);
  api.loading.install(candidate, destination, destination);
  assert.equal(destination.lines[0], candidate.lines[0]); assert.equal(destination.constraints[0].p1, destination.points[0]);
  assert.equal(f.calls.at(-1)[0], 'arcs'); assert.equal(f.calls.at(-1)[1], destination.arcs);
  f.model.workspace.activate(local); f.state.bound = root; local.defaultAppearance = { color: '#123456' };
  const localBefore = JSON.stringify(local); api.preparation.appearance(); assert.equal(JSON.stringify(local), localBefore);
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

function applicationCompositionFixture(composed){
 const f=persistenceFixture(),events=[],state={tree:null},root=f.model.document;
 const ensureDimensions=()=>w.DocumentState.normalizeDimensionState(f.state.bound,w.DimensionQueries.targetFromConstraint,(target,dimension)=>f.placement.normalizeDimension(target,dimension));
 const ports={resetEditingState(){events.push('reset');f.model.workspace.activate(root);f.state.bound=root;w.DocumentState.clearContent(root);f.model.geometryIds.reset();f.model.documentIds.reset();},
  sketchTreeView:{capture:()=>state.tree.capture(),restore:value=>state.tree.restore(value)},
  refreshReferenceConstraintValidity:()=>events.push('references'),enforceMinimumLineLengths:()=>{events.push('lines');return{changed:0,failed:0};},log:message=>events.push(['log',message])};
 const beforeReads=f.state.boundReads||0;
 const application=composed?f.persistence.createApplication(ports):w.DocumentApplication.create({...ports,documentLoading:f.persistence.loading,document:root,model:f.state.bound,
  ensureDimensionDefaults:ensureDimensions,restoreSequences:sequences=>{f.model.reservation.geometry(sequences.geometry);f.model.documentIds.restore(sequences);},
  ensureAppearanceState:()=>f.persistence.preparation.appearance(),ensureBlockState:()=>f.persistence.preparation.blocks()});
 assert.deepEqual(events,[]);assert.equal(state.tree,null);if(composed)assert.equal(f.state.boundReads,beforeReads+1);
 const treeSnapshot={expanded:['S1']};state.tree={capture(){events.push('capture');return treeSnapshot;},restore(value){assert.equal(value,treeSnapshot);events.push('tree');}};
 return{...f,events,application,ensureDimensions:composed?f.persistence.ensureDimensionDefaults:ensureDimensions};
}

test('persistence application matches direct load, defers Tree access and retains its captured target through reset and ID recovery',()=>{
 const results=[];for(const composed of [false,true]){
  const f=applicationCompositionFixture(composed),root=f.model.document,source=addPersistedLine(root,'L42');source.p1.id='P20';source.p2.id='P21';f.model.documentIds.restore({hatchSeq:12});const data=f.persistence.writer.serialize();
  const local=w.DocumentState.create();addPersistedLine(local,'LOCAL');f.model.workspace.activate(local);f.state.bound=local;const localBefore=JSON.stringify(local);
  f.application.load(data,{preserveSketchTreeState:true});assert.equal(JSON.stringify(local),localBefore);assert.equal(f.state.bound,root);assert.equal(root.lines[0].id,'L42');assert.equal(root.lines[0].p1,root.points[0]);assert.equal(root.constraints[0].p2,root.points[1]);
  assert.deepEqual(f.events.slice(0,3),['capture','reset','tree']);assert.equal(f.model.geometryIds.allocate('point'),'P22');assert.equal(f.model.geometryIds.allocate('line'),'L43');assert.equal(f.model.documentIds.peek('hatch'),12);
  const before=JSON.stringify(root);f.state.bound=local;f.ensureDimensions();assert.equal(JSON.stringify(root),before);
  results.push(JSON.stringify({model:root,events:f.events,ids:f.model.geometryIds.snapshot(),documentIds:f.model.documentIds.snapshot()}));
 }assert.equal(results[1],results[0]);
});

test('persistence application decode failures retain Document, counters and history-facing reset boundary',()=>{
 for(const composed of [false,true]){
  const f=applicationCompositionFixture(composed);addPersistedLine(f.model.document,'L5');const data=f.persistence.writer.serialize(),before=JSON.stringify(f.model.document),ids=JSON.stringify(f.model.documentIds.snapshot());data.units.length='inch';
  assert.throws(()=>f.application.load(data,{preserveSketchTreeState:true}),/length unit|長さ単位/);assert.deepEqual(f.events,['capture']);assert.equal(JSON.stringify(f.model.document),before);assert.equal(JSON.stringify(f.model.documentIds.snapshot()),ids);
  f.events.length=0;assert.throws(()=>f.application.load({}),/形式/);assert.deepEqual(f.events,[]);assert.equal(JSON.stringify(f.model.document),before);
 }
});

test('persistence application retains geometry and attachment reservation before a failed Document counter restore',()=>{
 const original=w.DocumentSequences,results=[];
 try{for(const composed of [false,true]){
  const f=applicationCompositionFixture(composed);addPersistedLine(f.model.document,'L5');const data=f.persistence.writer.serialize(),marker=new Error('counter restore failed');
  w.DocumentSequences={recover(){return{geometry:{points:[{id:'P80'}],hatches:[{id:'H7'}],referenceImages:[{id:'IMG6'}]},get sketchSeq(){throw marker;}};}};
  assert.throws(()=>f.application.load(data),error=>error===marker);assert.equal(f.model.geometryIds.peek('point'),81);assert.equal(f.model.documentIds.peek('hatch'),8);assert.equal(f.model.documentIds.peek('referenceImage'),7);assert.equal(f.model.documentIds.peek('sketch'),2);assert.equal(f.model.document.lines[0].id,'L5');
  results.push(JSON.stringify({events:f.events,geometry:f.model.geometryIds.snapshot(),ids:f.model.documentIds.snapshot()}));w.DocumentSequences=original;
 }}finally{w.DocumentSequences=original;}assert.equal(results[1],results[0]);
});

function editingScopeFixture(composed) {
  let editing;
  const f = readContextFixture((context, options, model) => {
    if (composed === 'default') delete options.Solver;
    if (composed) editing = context.createEditingScope(options);
    else {
      const binding = context.createScopeBinding(options), { solver } = binding;
      const { activeSketchId, constraintSketchId, isDrawableSketch, firstDrawableSketchId } = model.sketches;
      const dimensionQueries = w.DimensionQueries.createModelQueries({ currentScope: () => binding.current, activeSketchId, constraintSketchId });
      const insertion = w.ConstraintCommitCommand.createInsertion({ currentScope: () => binding.current, currentParameterNamespace: model.workspace.current,
        activeSketchId, isDrawableSketch, firstDrawableSketchId, ensureDimensionParameter: model.parameters.ensureDimensionParameter });
      editing = { binding, solver, dimensionQueries, insertion };
    }
    return editing.binding;
  });
  return { ...f, editing };
}
function radiusDimension(id) {
  const circle = new w.GeometrySolver.Circle(id, new w.GeometrySolver.Point('P-' + id, 0, 0), 8);
  const constraint = new w.GeometrySolver.RadiusConstraint(circle, 8); constraint.dimension = { offset: 2 }; return { circle, constraint };
}

test('Document editing scope constructs binding, model queries and insertion once in order and preserves their actual owners', () => {
  const original = { binding: w.EditingScopeBinding, dimensions: w.DimensionQueries, insertion: w.ConstraintCommitCommand };
  try { for (const composed of [false, true, 'default']) for (const failure of [null, 'dimensions']) {
    const events = [], ports = {}, marker = new Error('model query construction');
    w.EditingScopeBinding = { ...original.binding, create(input) { events.push('binding'); ports.binding = input; return original.binding.create(input); } };
    w.DimensionQueries = { ...original.dimensions, createModelQueries(input) { events.push('dimensions'); ports.dimensions = input; if (failure) throw marker; return original.dimensions.createModelQueries(input); } };
    w.ConstraintCommitCommand = { ...original.insertion, createInsertion(input) { events.push('insertion'); ports.insertion = input; return original.insertion.createInsertion(input); } };
    if (failure) { assert.throws(() => editingScopeFixture(composed), error => error === marker); assert.deepEqual(events, ['binding', 'dimensions']); continue; }
    const f = editingScopeFixture(composed); assert.deepEqual(events, ['binding', 'dimensions', 'insertion']); assert.deepEqual(f.calls, []);
    assert.equal(f.editing.binding, f.binding); assert.equal(f.editing.solver, f.binding.solver); assert.equal(f.binding.solver.model, f.model.document);
    if (composed) assert.equal(Object.isFrozen(f.editing), true);
    assert.equal(ports.binding.workspace, f.model.workspace); assert.equal(ports.dimensions.activeSketchId, f.model.sketches.activeSketchId);
    assert.equal(ports.dimensions.constraintSketchId, f.model.sketches.constraintSketchId); assert.equal(ports.insertion.ensureDimensionParameter, f.model.parameters.ensureDimensionParameter);
    assert.equal(ports.insertion.currentParameterNamespace, f.model.workspace.current); assert.equal(ports.insertion.firstDrawableSketchId, f.model.sketches.firstDrawableSketchId);
    assert.equal(ports.dimensions.currentScope(), f.binding.current); assert.equal(ports.insertion.currentScope(), f.binding.current);
  } } finally { w.EditingScopeBinding = original.binding; w.DimensionQueries = original.dimensions; w.ConstraintCommitCommand = original.insertion; }
});

test('Document editing queries and insertion follow bound scope while sketch choice and Parameter allocation follow current Workspace', () => {
  for (const composed of [false, true, 'default']) {
    const f = editingScopeFixture(composed), { model, binding, editing } = f, draft = w.DocumentState.create(), solver = editing.solver;
    binding.activate(draft); assert.equal(editing.solver, solver); assert.equal(solver.model, draft);
    const first = radiusDimension('C1'); draft.circles.push(first.circle); assert.equal(editing.insertion.push(first.constraint, 'ROOT'), first.constraint);
    assert.equal(first.constraint.sketchId, 'S1'); assert.equal(first.constraint.parameterName, 'd1'); assert.equal(first.constraint.expression, '8');
    assert.equal(draft.constraints[0], first.constraint); assert.equal(model.document.constraints.length, 0);
    assert.equal(editing.dimensionQueries.sketchHasDimensionConstraint(), true); assert.equal(editing.dimensionQueries.hasDirectRadiusDimension(first.circle), true);
    const other = w.DocumentState.create(); other.sketches[1].id = 'S9'; other.activeSketchId = 'S9'; other.nextDimensionParameterIndex = 7; model.workspace.activate(other);
    const second = radiusDimension('C2'); draft.circles.push(second.circle); editing.insertion.push(second.constraint);
    assert.equal(second.constraint.sketchId, 'S9'); assert.equal(second.constraint.parameterName, 'd7'); assert.equal(other.nextDimensionParameterIndex, 8);
    assert.equal(draft.nextDimensionParameterIndex, 2); assert.equal(draft.constraints[1], second.constraint); assert.equal(other.constraints.length, 0);
    assert.equal(binding.current, draft); assert.equal(solver.model, draft); assert.equal(model.workspace.current(), other);
    assert.equal(editing.dimensionQueries.sketchHasDimensionConstraint(), true); assert.equal(editing.dimensionQueries.hasDirectRadiusDimension(second.circle), true);
    assert.equal(editing.insertion.assignSketch(null, 'ROOT'), null);
    binding.activate(other); assert.equal(editing.dimensionQueries.sketchHasDimensionConstraint(), false); assert.equal(editing.dimensionQueries.hasDirectRadiusDimension(second.circle), false);
  }
});

test('Document editing scope keeps failed activation and insertion partial effects at their original boundaries', () => {
  for (const composed of [false, true, 'default']) {
    const f = editingScopeFixture(composed), { model, binding, editing } = f, draft = w.DocumentState.create(), marker = new Error('boundary');
    binding.activate(draft); model.workspace.activate(model.document); f.state.failure = 'move'; f.state.error = marker;
    assert.throws(() => binding.activate(model.document), error => error === marker); assert.equal(binding.current, draft); assert.equal(editing.solver.model, draft);
    assert.equal(model.workspace.current(), model.document); assert.deepEqual(f.calls.slice(-2).map(call => call.name), ['close', 'move']);
    Object.defineProperty(model.document, 'nextDimensionParameterIndex', { configurable: true, get() { throw marker; } });
    const { circle, constraint } = radiusDimension('C-failure');
    assert.throws(() => editing.insertion.push(constraint), error => error === marker); assert.equal(draft.constraints[0], constraint);
    assert.equal(constraint.sketchId, 'S1'); assert.equal(constraint.parameterName, undefined); assert.equal(model.document.constraints.length, 0);
    assert.equal(editing.dimensionQueries.hasDirectRadiusDimension(circle), true); assert.equal(binding.current, draft); assert.equal(editing.solver.model, draft);
  }
});

test('Document persistence entry points keep initialization guards and normalize against the live Workspace through the actual codec',()=>{
 const f=persistenceFixture(context=>{
  for(const [run,binding]of [[()=>context.persistence.normalizeGeometryInstance({}),'normalizeEditingGeometryInstance'],[()=>context.persistence.loadModelData({}),'documentApplication'],[context.persistence.readRepairMessage,'documentApplication']])assert.throws(run,error=>error.name==='ReferenceError'&&error.message==="Cannot access '"+binding+"' before initialization");
 });
 const api=f.context.persistence;assert.equal(api.normalizeGeometryInstance.length,1);assert.equal(api.loadModelData.length,1);assert.equal(api.readRepairMessage.length,0);
 for(const run of [()=>api.loadModelData({}),api.readRepairMessage])assert.throws(run,error=>error.name==='ReferenceError'&&error.message==="Cannot access 'documentApplication' before initialization");
 assert.equal(api.normalizeGeometryInstance({type:'pattern'},undefined,4).id,'PI5');assert.equal(api.normalizeGeometryInstance({type:'pattern'}).sketchId,'S1');
 const other=w.DocumentState.create();other.sketches[1].id='S9';other.activeSketchId='S9';f.model.workspace.activate(other);
 assert.equal(api.normalizeGeometryInstance({type:'pattern'}).sketchId,'S9');assert.equal(f.state.bound,f.model.document);
 assert.equal(api.normalizeGeometryInstance({type:'pattern'},value=>'explicit:'+value).sketchId,'explicit:undefined');
});

test('owned Document load retains the captured target, Tree sequencing, references and ID restoration across a different current scope',()=>{
 const f=applicationCompositionFixture(true),api=f.context.persistence,root=f.model.document,source=addPersistedLine(root,'L42');source.p1.id='P20';source.p2.id='P21';f.model.documentIds.restore({hatchSeq:12});const data=f.persistence.writer.serialize();
 const local=w.DocumentState.create();addPersistedLine(local,'LOCAL');f.model.workspace.activate(local);f.state.bound=local;const before=JSON.stringify(local);
 api.loadModelData(data,{preserveSketchTreeState:true});assert.equal(JSON.stringify(local),before);assert.equal(f.state.bound,root);assert.equal(root.lines[0].id,'L42');
 assert.equal(root.lines[0].p1,root.points[0]);assert.equal(root.constraints[0].p2,root.points[1]);assert.deepEqual(f.events.slice(0,3),['capture','reset','tree']);
 assert.equal(f.model.geometryIds.allocate('point'),'P22');assert.equal(f.model.geometryIds.allocate('line'),'L43');assert.equal(f.model.documentIds.peek('hatch'),12);
 assert.equal(api.readRepairMessage(),f.application.blockConstraintRepairMessage);
});

test('owned Document load preserves receiver, two arguments, fresh default options, return and original load or repair getter exceptions',()=>{
 const f=persistenceFixture(),api=f.context.persistence,original=w.DocumentApplication,marker=new Error('application failed'),calls=[],result={},message={};let fail=false,gets=0;
 const component=Object.freeze({load(...args){assert.equal(this,component);calls.push(args);if(fail)throw marker;return result;},get blockConstraintRepairMessage(){assert.equal(this,component);gets++;if(fail)throw marker;return message;}});
 const ports={resetEditingState(){},sketchTreeView:{capture(){},restore(){}},refreshReferenceConstraintValidity(){},enforceMinimumLineLengths(){},log(){}};
 w.DocumentApplication={...original,create:()=>component};
 try{assert.equal(f.persistence.createApplication(ports),component);}finally{w.DocumentApplication=original;}
 const data={};assert.equal(api.loadModelData(data),result);assert.equal(api.loadModelData(data,undefined,'ignored'),result);assert.equal(api.loadModelData(data,null,'ignored'),result);
 assert.equal(calls.length,3);assert.ok(calls.every(args=>args.length===2&&args[0]===data));assert.deepEqual(Object.keys(calls[0][1]),[]);assert.notEqual(calls[0][1],calls[1][1]);assert.equal(calls[2][1],null);
 assert.equal(api.readRepairMessage('ignored'),message);assert.equal(gets,1);fail=true;assert.throws(()=>api.loadModelData(data),error=>error===marker);assert.throws(api.readRepairMessage,error=>error===marker);
});

test('each read context publishes only completed Document applications and persistence reconstruction keeps its previous application',()=>{
 const f=persistenceFixture(),g=persistenceFixture(),original=w.DocumentApplication,marker=new Error('application construction failed'),seen=[];
 const make=label=>Object.freeze({load(data){seen.push([label,this]);return data;},get blockConstraintRepairMessage(){return label;}}),first=make('first'),other=make('other'),replacement=make('replacement');
 const ports={resetEditingState(){},sketchTreeView:{capture(){},restore(){}},refreshReferenceConstraintValidity(){},enforceMinimumLineLengths(){},log(){}};let fail=false,next=first;
 w.DocumentApplication={...original,create(options){if(fail)throw marker;return options.document===f.model.document?next:other;}};
 try{
  assert.equal(f.persistence.createApplication(ports),first);assert.equal(g.persistence.createApplication(ports),other);const data={};assert.equal(f.context.persistence.loadModelData(data),data);
  fail=true;assert.throws(()=>f.persistence.createApplication(ports),error=>error===marker);const empty=persistenceFixture();assert.throws(()=>empty.persistence.createApplication(ports),error=>error===marker);assert.throws(empty.context.persistence.readRepairMessage,error=>error.name==='ReferenceError');assert.equal(f.context.persistence.readRepairMessage(),'first');assert.equal(g.context.persistence.readRepairMessage(),'other');
  const fresh=f.context.createPersistence({...f.options,version:27});assert.equal(f.context.persistence.readRepairMessage(),'first');assert.equal(f.context.persistence.serializeModel().version,27);
  fail=false;next=replacement;assert.equal(fresh.createApplication(ports),replacement);f.context.persistence.loadModelData(data);g.context.persistence.loadModelData(data);
  assert.equal(seen[0][1],first);assert.equal(seen[1][1],replacement);assert.equal(seen[2][1],other);assert.equal(g.context.persistence.readRepairMessage(),'other');
 }finally{w.DocumentApplication=original;}
});


test('Document editing scope owns the default Solver construction at the existing bound-scope stage without eager model operations', () => {
  const original=w.GeometrySolver,events=[],marker=new Error('solver ctor');let reads=0,created,fail=false;
  const DefaultSolver=class extends original.ConstraintSolver {constructor(model){assert.equal(arguments.length,1);events.push(['solver',model]);if(fail)throw marker;super(model);created=this;}};
  w.GeometrySolver={...original,get ConstraintSolver(){reads++;return DefaultSolver;}};
  try{
    const f=fixture(),context=f.model.createReadContext({currentSketches:()=>f.model.workspace.current().sketches,prepareBlocks(){},showHiddenElements:()=>false,viewportScale:()=>1,profileRead:read=>read()});
    assert.equal(reads,0);assert.deepEqual(events,[]);
    const editing=context.createEditingScope({closeSketchContext(){events.push(['close']);},resetSketchMove(){events.push(['move']);}});
    assert.equal(reads,1);assert.equal(editing.solver,created);assert.equal(editing.binding.solver,created);assert.equal(created.model,f.model.document);assert.deepEqual(events,[['solver',f.model.document]]);
    const draft=w.DocumentState.create();editing.binding.activate(draft);assert.equal(reads,1);assert.equal(editing.solver,created);assert.equal(created.model,draft);assert.equal(editing.binding.current,draft);
    assert.deepEqual(events.slice(1),[['close'],['move']]);
    const before=JSON.stringify(draft),old=created;fail=true;assert.throws(()=>context.createEditingScope({closeSketchContext(){},resetSketchMove(){}}),error=>error===marker);
    assert.equal(reads,2);assert.equal(created,old);assert.equal(editing.binding.current,draft);assert.equal(JSON.stringify(draft),before);
  }finally{w.GeometrySolver=original;}
});

test('Document editing scope preserves custom Solver identity, explicit invalid classes and the raw binding constructor requirement', () => {
  const original=w.GeometrySolver,marker=new Error('unexpected default');let created;
  const f=fixture(),context=f.model.createReadContext({currentSketches:()=>f.model.workspace.current().sketches,prepareBlocks(){},showHiddenElements:()=>false,viewportScale:()=>1,profileRead:read=>read()});
  class CustomSolver {constructor(model){assert.equal(arguments.length,1);this.model=model;created=this;}}
  w.GeometrySolver={...original,get ConstraintSolver(){throw marker;}};
  try{
    const options={Solver:CustomSolver,closeSketchContext(){},resetSketchMove(){}},editing=context.createEditingScope(options);
    assert.equal(editing.solver,created);assert.equal(editing.solver.constructor,CustomSolver);assert.equal(editing.binding.current,f.model.document);
    for(const Solver of [undefined,null])assert.throws(()=>context.createEditingScope({...options,Solver}),error=>error.name==='TypeError');
    const inherited=context.createEditingScope(Object.assign(Object.create({Solver:CustomSolver}),{closeSketchContext(){},resetSketchMove(){}}));
    assert.equal(inherited.solver,created);assert.equal(inherited.solver.constructor,CustomSolver);
    for(const Solver of [undefined,null])assert.throws(()=>context.createEditingScope(Object.create({...options,Solver})),error=>error.name==='TypeError');
    assert.throws(()=>context.createScopeBinding({closeSketchContext(){},resetSketchMove(){}}),error=>error.name==='TypeError');
    assert.equal(f.model.workspace.current(),f.model.document);assert.equal(editing.solver.constructor,CustomSolver);
  }finally{w.GeometrySolver=original;}
});

function ownedBoundWorkspace() {
  const model = w.DocumentWorkspace.create({ applicationText: (_ja, en) => en, constraintGraphNodes: () => [] });
  const context = model.createReadContext({ prepareBlocks() {}, showHiddenElements: () => false, viewportScale: () => 1, profileRead: read => read() });
  const display = () => context.services.dimensionAppearance.dimensionDisplayState({}).prefix;
  return { model, context, display };
}

test('Document-owned Hatch and Sketch reads follow the native bound scope through direct Workspace changes, raw binding creation and restoration', () => {
  const { model, context, display } = ownedBoundWorkspace();
  const source = { points: [{ id: 'P20' }], hatches: [{ id: 'H8' }], sketches: [{ id: 'S7' }], annotations: [{ id: 'AN4' }] };
  const unready = error => error.name === 'ReferenceError' && error.message === "Cannot access 'editingScopeBinding' before initialization";
  assert.throws(display, unready); assert.throws(() => model.reservation.scope(source), unready);
  assert.equal(model.geometryIds.peek('point'), 21); assert.equal(model.documentIds.peek('hatch'), 9);
  assert.equal(model.documentIds.peek('sketch'), 2); assert.equal(model.documentIds.peek('annotation'), 1);
  model.document.nextHatchIndex = 12; model.document.sketches[1].dimensionAppearance = { prefix: 'document-bound' };
  const { binding } = context.createEditingScope({ closeSketchContext() {}, resetSketchMove() {} });
  assert.equal(display(), 'document-bound'); model.reservation.scope(source); assert.equal(model.documentIds.peek('hatch'), 12);
  const host = model.workspace.capture(), unbound = w.DocumentState.create();
  unbound.nextHatchIndex = 90; unbound.sketches[1].dimensionAppearance = { prefix: 'unbound' }; model.workspace.activate(unbound);
  const raw = context.createScopeBinding({ Solver: w.GeometrySolver.ConstraintSolver, closeSketchContext() {}, resetSketchMove() {} });
  assert.equal(raw.current, unbound); assert.equal(binding.current, model.document);
  assert.equal(display(), 'document-bound'); model.reservation.scope({}); assert.equal(model.documentIds.peek('hatch'), 12);
  const draft = w.DocumentState.create(); draft.nextHatchIndex = 22; draft.sketches[1].dimensionAppearance = { prefix: 'draft-bound' };
  binding.activate(draft); assert.equal(display(), 'draft-bound'); assert.equal(binding.current, draft); assert.equal(binding.solver.model, draft);
  model.reservation.scope({}); assert.equal(model.documentIds.peek('hatch'), 22);
  model.workspace.restore(host); assert.equal(model.workspace.current(), model.document); assert.equal(binding.current, draft);
  assert.equal(display(), 'draft-bound'); model.reservation.scope({}); assert.equal(model.documentIds.peek('hatch'), 22);
  model.document.nextHatchIndex = 30; binding.activate(model.document);
  assert.equal(display(), 'document-bound'); model.reservation.scope({}); assert.equal(model.documentIds.peek('hatch'), 30);
});

test('Document-owned bound readers publish after native binding, queries and insertion and preserve prior completion on every construction failure', () => {
  const originals = { ids: w.DocumentIds, reads: w.GeometryReadServices, binding: w.EditingScopeBinding, dimensions: w.DimensionQueries, insertion: w.ConstraintCommitCommand };
  const ports = {}, stages = [], marker = new Error('bound scope construction'); let expected, failure;
  function observe(name) {
    stages.push(name);
    if (expected) { assert.equal(ports.sketches(), expected.sketches); assert.equal(ports.hatch(), expected.nextHatchIndex); }
    else for (const read of [ports.sketches, ports.hatch]) assert.throws(read, error => error.name === 'ReferenceError');
    if (failure === name) throw marker;
  }
  w.DocumentIds = { ...originals.ids, createReservation(input) { ports.hatch = input.nextHatchIndex; return originals.ids.createReservation(input); } };
  w.GeometryReadServices = { ...originals.reads, createWithHatches(input) { ports.sketches = input.currentSketches; return originals.reads.createWithHatches(input); } };
  w.EditingScopeBinding = { ...originals.binding, create(input) { observe('binding'); return originals.binding.create(input); } };
  w.DimensionQueries = { ...originals.dimensions, createModelQueries(input) { observe('queries'); return originals.dimensions.createModelQueries(input); } };
  w.ConstraintCommitCommand = { ...originals.insertion, createInsertion(input) { observe('insertion'); return originals.insertion.createInsertion(input); } };
  try {
    const { model, context } = ownedBoundWorkspace(), input = { closeSketchContext() {}, resetSketchMove() {} };
    assert.equal(ports.sketches.name, 'currentSketches'); assert.equal(ports.sketches.length, 0);
    assert.equal(ports.hatch.name, 'nextHatchIndex'); assert.equal(ports.hatch.length, 0);
    for (const stage of ['binding', 'queries', 'insertion']) {
      failure = stage; stages.length = 0; assert.throws(() => context.createEditingScope(input), error => error === marker);
      assert.deepEqual(stages, ['binding', 'queries', 'insertion'].slice(0, ['binding', 'queries', 'insertion'].indexOf(stage) + 1));
      assert.throws(ports.sketches, error => error.name === 'ReferenceError'); assert.throws(ports.hatch, error => error.name === 'ReferenceError');
    }
    failure = null; model.document.nextHatchIndex = 13;
    const first = context.createEditingScope(input); expected = first.binding.current;
    assert.equal(ports.sketches('ignored'), expected.sketches); assert.equal(ports.hatch('ignored'), 13);
    const draft = w.DocumentState.create(); draft.nextHatchIndex = 31; model.workspace.activate(draft);
    for (const stage of ['binding', 'queries', 'insertion']) {
      failure = stage; assert.throws(() => context.createEditingScope(input), error => error === marker);
      assert.equal(ports.sketches(), expected.sketches); assert.equal(ports.hatch(), 13);
    }
    failure = null; const second = context.createEditingScope(input); expected = second.binding.current;
    assert.equal(expected, draft); assert.notEqual(second.binding, first.binding); assert.equal(ports.sketches(), draft.sketches); assert.equal(ports.hatch(), 31);
    Object.defineProperty(draft, 'nextHatchIndex', { configurable: true, get() { assert.equal(this, draft); throw marker; } });
    assert.throws(ports.hatch, error => error === marker);
    Object.defineProperty(draft, 'sketches', { configurable: true, get() { assert.equal(this, draft); throw marker; } });
    assert.throws(ports.sketches, error => error === marker);
  } finally {
    w.DocumentIds = originals.ids; w.GeometryReadServices = originals.reads; w.EditingScopeBinding = originals.binding;
    w.DimensionQueries = originals.dimensions; w.ConstraintCommitCommand = originals.insertion;
  }
});

test('Document-owned scope defaults preserve explicit own and inherited readers and leave the raw geometry-read API unchanged', () => {
  const originalIds = w.DocumentIds, originalReads = w.GeometryReadServices; let hatch, sketches;
  w.DocumentIds = { ...originalIds, createReservation(input) { hatch = input.nextHatchIndex; return originalIds.createReservation(input); } };
  w.GeometryReadServices = { ...originalReads, createWithHatches(input) { sketches = input.currentSketches; return originalReads.createWithHatches(input); } };
  try {
    for (const inherited of [false, true]) for (const value of [undefined, null, () => []]) {
      const options = { applicationText: (_ja, en) => en, constraintGraphNodes: () => [] };
      if (inherited) Object.setPrototypeOf(options, { nextHatchIndex: value }); else options.nextHatchIndex = value;
      const model = w.DocumentWorkspace.create(options); assert.equal(hatch, value);
      const input = { prepareBlocks() {}, showHiddenElements: () => false, viewportScale: () => 1, profileRead: read => read() };
      if (inherited) Object.setPrototypeOf(input, { currentSketches: value }); else input.currentSketches = value;
      model.createReadContext(input); assert.equal(sketches, value);
      model.createGeometryReadServices(input); assert.equal(sketches, value);
    }
    const { model } = ownedBoundWorkspace();
    model.createGeometryReadServices({ prepareBlocks() {}, showHiddenElements: () => false, viewportScale: () => 1, profileRead: read => read() });
    assert.equal(sketches, undefined);
  } finally { w.DocumentIds = originalIds; w.GeometryReadServices = originalReads; }
});
