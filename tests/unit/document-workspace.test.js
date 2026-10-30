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

function persistenceFixture() {
  const { model } = fixture(), state = { ready: false, bound: model.document, block: null }, calls = [];
  const check = () => assert.equal(state.ready, true, 'persistence construction must defer model queries');
  const context = model.createReadContext({ currentSketches: () => { check(); return state.bound.sketches; },
    prepareBlocks: () => { check(); }, showHiddenElements: () => false, viewportScale: () => { check(); return 2; }, profileRead: work => work() });
  const references = w.ConstraintReferences.create({ resolveGeometryRef: () => null });
  const pointUsage = context.services.createPointUsage({ constraintReferencesPoint: references.constraintReferencesPoint, editedFitPoints: () => [] });
  const before = JSON.stringify(model.document);
  const placement = w.DimensionPlacement.create({ viewport: { scale: 2 } });
  const persistence = context.createPersistence({ placement, pointUsage,
    readEditingScope: () => { check(); state.boundReads = (state.boundReads || 0) + 1; return state.bound; }, readBlockEditor: () => { check(); return state.block; }, version: 26,
    constraintReferencesPoint: references.constraintReferencesPoint,
    separateSharedSketchProjectionTargetPoints: () => { check(); calls.push('separate'); },
    normalizeArcSweeps: arcs => { check(); calls.push(['arcs', arcs]); },
  });
  assert.equal(JSON.stringify(model.document), before); assert.deepEqual(calls, []); state.ready = true;
  return { model, state, calls, persistence, placement };
}

function addPersistedLine(scope, id, x = 0) {
  const p1 = Object.assign(new w.GeometrySolver.Point(id + 'a', x, 0), { sketchId: 'S1', kind: 'endpoint' });
  const p2 = Object.assign(new w.GeometrySolver.Point(id + 'b', x + 10, 0), { sketchId: 'S1', kind: 'endpoint' });
  const line = Object.assign(new w.GeometrySolver.Line(id, p1, p2), { sketchId: 'S1' });
  const constraint = Object.assign(new w.GeometrySolver.DistanceConstraint(p1, p2, 10), {
    sketchId: 'S1', parameterName: 'd1', expression: '10', dimension: { x: 5, y: 7, labelOffsetU: 7 } });
  scope.points.push(p1, p2); scope.lines.push(line); scope.constraints.push(constraint);
  return { p1, p2, line, constraint };
}

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
  try { for (const composed of [false, true]) for (const failure of [null, 'dimensions']) {
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
  for (const composed of [false, true]) {
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
  for (const composed of [false, true]) {
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
