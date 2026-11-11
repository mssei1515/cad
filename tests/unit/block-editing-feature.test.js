const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(source => source.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window, g = w.GeometrySolver;
const scope = id => ({ id, name: id, revision: 3, origin: { x: 0, y: 0 }, parentDefinitionId: null,
  points: [], lines: [], circles: [], arcs: [], splines: [], constraints: [], parameters: [], annotations: [], hatches: [],
  referenceImages: [], blockInstances: [], geometryInstances: [], sketches: [{ id: 'ROOT', kind: 'root' }, { id: 'S1', kind: 'sketch' }],
  activeSketchId: 'S1', nextHatchIndex: 1, nextDimensionParameterIndex: 1 });
function fixture({ realRebinding = false, sharedScope = false, buildFeature = options => w.BlockEditingFeature.create(options) } = {}) {
  const document = { ...scope('host'), blockDefinitions: [] }, workspace = w.EditingWorkspace.create(document);
  const state = { ready: false, definitionSeq: 1, hatchSeq: 8, history: 0, viewport: { x: 1, y: 2, scale: 3 }, snapshotError: null, bundles: [], serializeFailure: null };
  const events = [];
  const viewport = { snapshot() { assert.equal(this, viewport); assert.equal(state.ready, true);
    events.push('capture-view'); if (state.snapshotError) throw state.snapshotError; return { ...state.viewport }; },
    update(value) { assert.equal(this, viewport); events.push('restore-view'); state.viewport = { ...value }; } };
  const ids = { peek(kind) { assert.equal(this, ids); assert.equal(state.ready, true);
    if (kind === 'blockDefinition') return state.definitionSeq; assert.equal(kind, 'hatch'); return state.hatchSeq; },
    allocate(kind) { assert.equal(this, ids); assert.equal(state.ready, true);
      if (kind === 'blockInstance') return 'BI1'; assert.equal(kind, 'blockDefinition'); return `BD${state.definitionSeq++}`; } };
  const catalog = w.BlockCatalog.create({ definitions: () => { assert.equal(state.ready, true); return document.blockDefinitions; } });
  const projections = { createBlockProjectionBundle() { throw Error('no nested Block expected in this fixture'); },
    invalidateBlockProjectionCache: () => events.push('invalidate') };
  const codecs = realRebinding ? w.ConstraintPersistence.create({ geometryId: item => item.id, dimensionData: constraint => constraint.dimension }) : null;
  const rebinding = realRebinding ? w.ConstraintRebinding.create({ catalog, projections, geometryInstanceBundlesForScope: () => [],
    serializeConstraint: constraint => { events.push(['serialize', constraint]); if (state.serializeFailure) throw state.serializeFailure; return codecs.serialize(constraint); },
    decorateSerializedConstraint: data => data, deserializeConstraint: codecs.deserialize, applicationText: (_ja, en) => en,
  }) : { rebuildDefinition: value => { events.push(['rebuild', value.id]); return 0; }, cloneForBlock: (constraint, points) => {
    events.push('clone-constraint'); const clone = new g.DistanceConstraint(points.get(constraint.p1.id), points.get(constraint.p2.id), constraint.target);
    clone.sketchId = constraint.sketchId; return clone;
  } };
  const options = { workspace, documentModel: document, ids, catalog, projections,
    ...(sharedScope ? { readEditingScope: () => { assert.equal(state.ready,true); events.push('shared-bound'); return state.bound; } } : {}),
    instances: { geometryInstanceBundlesForScope: () => [], emptyGeometryInstanceBundle: () => ({}) }, rebinding,
    normalizedSketchCopy: sketch => ({ ...sketch, appearance: w.Appearance.normalizeAppearance(sketch.appearance) }),
    normalizeGeometryInstance: value => value, isDimensionConstraint: () => false, isReadOnlyDimension: () => false,
    numericDimensionExpression: c => String(c.target), ensureParameterNamespace() {},
    activeSketchId: () => workspace.current().activeSketchId, blockProjectionBundles: () => { assert.equal(state.ready, true); if (realRebinding) events.push('bundles'); return state.bundles; }, geometryElementKey: item => item.id,
    readViewport: () => { assert.equal(state.ready, true); return viewport; },
    activateScope: value => { events.push(['activate', value.id]); return workspace.activate(value); },
    reserveScopeSequences: value => events.push(['reserve', value.id]), createHistory: () => ({ id: ++state.history }),
  };
  const feature = buildFeature(options, { state, events });
  function geometry(definition) {
    const a = Object.assign(new g.Point('P1', 0, 0), { sketchId: 'S1' }), b = Object.assign(new g.Point('P2', 10, 0), { sketchId: 'S1' });
    definition.points.push(a, b); definition.lines.push(Object.assign(new g.Line('L1', a, b), { sketchId: 'S1' }));
    definition.constraints.push(Object.assign(new g.DistanceConstraint(a, b, 10), { sketchId: 'S1' })); return a;
  }
  return { state, events, document, workspace, feature, geometry, options };
}

function commands(f, overrides = {}, build = (feature, options) => feature.createCommands(options)) {
  const selection = w.CanvasSelection.create();
  return { selection, ...build(f.feature, {
    canStartCreation: () => true, canvasSelection: selection,
    selectionQuery: { read: () => ({ ...Object.fromEntries(Object.entries(f.workspace.current())
      .map(([key, value]) => [key, Array.isArray(value) ? [...value] : value])), externalConstraints: [] }), center: () => ({ x: 0, y: 0 }) },
    guardDimensionSymbolDeletion: () => true, resetBlockEditorHistory: () => f.events.push('reset-history'),
    clearSelection: selection.clear, setMode: value => { f.state.mode = value; }, closeDefinitions: () => f.events.push('close-definitions'),
    setEditorActive: value => { f.state.editorActive = value; }, fitAllGeometryToViewport: () => f.events.push('fit'),
    resetEmptyViewport: () => { f.state.viewport = { x: 0, y: 0, scale: 1 }; }, promptName: () => null,
    updateBlockUI: () => f.events.push('blocks'), updateUI: () => f.events.push('ui'), draw: () => f.events.push('draw'),
    recordHistory: () => f.events.push('history'), setHint: (text, kind) => f.events.push(['hint', text, kind]),
    duplicateBlockElementId: () => null, refreshReferenceConstraintValidity() {}, hasInvalidReferenceConstraints: () => false,
    solveSketchById: id => { f.events.push(['solve', id]); return { success: true, errorNorm: 0 }; },
    resultIsAccepted: result => result.success, sketchName: id => id, solveReferenceDependentSketches: () => ({ success: true }),
    requestChoice: () => Promise.resolve(null), applicationText: (_ja, en) => en, blockLocalGeometryBounds: () => ({ center: { x: 0, y: 0 } }),
    constraintGraphNodes: () => [], annotationReferencesRemovedGeometry: () => false, acceptError: 1e-4,
    setSketchSolveOk() {}, setSketchSolveError() {}, log: () => f.events.push('log'), ...overrides,
  }) };
}

function scopeOperationFixture(owned, overrides = {}) {
  const probe = {}; let binding, geometryIds, documentIds, scopeOwner, reservationOwner;
  const f = fixture({ sharedScope: true, buildFeature(options, { state, events }) {
    state.scopeFailure = null; state.scopeError = new Error('scope operation failed'); state.ownerCalls = [];
    const effect = name => { assert.equal(state.ready, true); events.push(name); if (state.scopeFailure === name) throw state.scopeError; };
    binding = w.EditingScopeBinding.create({ workspace: options.workspace, Solver: g.ConstraintSolver,
      closeSketchContext: () => effect('close'), resetSketchMove: () => effect('move'), clearGeometryReads: () => effect('reads'), invalidateProjection: () => effect('projection') });
    geometryIds = w.GeometryIds.create(); documentIds = w.DocumentIds.create();
    const reservation = w.DocumentIds.createReservation({ geometryIds, documentIds, nextHatchIndex: () => { effect('hatch'); return binding.current.nextHatchIndex; } });
    scopeOwner = { get current() { return binding.current; }, activate() {
      assert.equal(this, scopeOwner); state.ownerCalls.push(['activate', Array.from(arguments)]); return binding.activate(...arguments);
    } };
    reservationOwner = { scope() { assert.equal(this, reservationOwner); assert.equal(arguments.length, 1);
      state.ownerCalls.push(['reserve', Array.from(arguments)]); return reservation.scope(...arguments); } };
    const input = { documentWorkspace: { document: options.documentModel, workspace: options.workspace, documentIds,
      reservation: reservationOwner, sketches: { activeSketchId: options.activeSketchId },
      parameters: { numericDimensionExpression: options.numericDimensionExpression, ensureParameterNamespace: options.ensureParameterNamespace } },
      readServices: { catalog: options.catalog, projections: options.projections, instances: options.instances, reads: { blockProjectionBundles: options.blockProjectionBundles } },
      rebinding: options.rebinding, editingScope: scopeOwner, normalizeGeometryInstance: options.normalizeGeometryInstance,
      readViewport: options.readViewport, createHistory: options.createHistory,
      ...(!owned ? { activateScope: (...args) => scopeOwner.activate(...args), reserveScopeSequences: draft => reservationOwner.scope(draft) } : {}), ...overrides };
    const original = w.BlockEditorSession;
    w.BlockEditorSession = { ...original, create(options) { probe.session = options; return original.create(options); } };
    try { return w.BlockEditingFeature.createForWorkspace(input); } finally { w.BlockEditorSession = original; }
  } });
  assert.deepEqual(f.events, []); assert.deepEqual(f.state.ownerCalls, []); f.state.ready = true;
  return { ...f, probe, binding, geometryIds, documentIds, scopeOwner, reservationOwner };
}

test('owned Block scope operations share the real binding, Solver and reservation through open and host restoration', () => {
  const outcomes = [];
  for (const owned of [false, true]) {
    const f = scopeOperationFixture(owned), hostPoint = f.geometry(f.document), draft = scope('BD7'), point = f.geometry(draft);
    point.id = 'P29'; draft.annotations.push({ id: 'AN9' }); draft.hatches.push({ id: 'H11' }); draft.nextHatchIndex = 40;
    const session = f.feature.session.open(draft);
    assert.equal(f.workspace.current(), draft); assert.equal(f.binding.current, draft); assert.equal(f.binding.solver.model, draft);
    assert.equal(draft.lines[0].p1, point); assert.equal(f.document.points[0], hostPoint);
    assert.equal(f.geometryIds.peek('point'), 30); assert.equal(f.documentIds.peek('annotation'), 10); assert.equal(f.documentIds.peek('hatch'), 40);
    f.feature.session.restoreHost(session);
    assert.equal(f.workspace.current(), f.document); assert.equal(f.binding.current, f.document); assert.equal(f.binding.solver.model, f.document);
    assert.equal(f.document.points[0], hostPoint); assert.equal(f.feature.session.current, null);
    outcomes.push(JSON.stringify({ events: f.events, ids: f.documentIds.snapshot() }));
  }
  assert.equal(outcomes[1], outcomes[0]);
});

test('owned Block scope and reservation failures retain the same original error and partial activation and ID state', () => {
  for (const phase of ['close', 'reads', 'hatch']) {
    const outcomes = [];
    for (const owned of [false, true]) {
      const f = scopeOperationFixture(owned), draft = scope('BD1'); f.geometry(draft); draft.annotations.push({ id: 'AN9' }); draft.hatches.push({ id: 'H11' });
      f.state.scopeFailure = phase;
      assert.throws(() => f.feature.session.open(draft), error => error === f.state.scopeError);
      assert.equal(f.feature.session.current.draft, draft);
      assert.equal(f.workspace.current(), phase === 'close' ? f.document : draft); assert.equal(f.binding.current, f.workspace.current());
      assert.equal(f.binding.solver.model, f.workspace.current());
      assert.equal(f.geometryIds.peek('point'), phase === 'hatch' ? 3 : 1); assert.equal(f.documentIds.peek('annotation'), 1);
      assert.equal(f.documentIds.peek('hatch'), phase === 'hatch' ? 12 : 1);
      outcomes.push(JSON.stringify({ events: f.events, ids: f.documentIds.snapshot() }));
    }
    assert.equal(outcomes[1], outcomes[0], phase);
  }
});

test('Block operation defaults keep activation rest arguments, reservation single argument and explicit callbacks including null', () => {
  const f = scopeOperationFixture(true), target = scope('BD2'), extra = {};
  const activate = f.probe.session.activateScope, reserve = f.probe.session.reserveScopeSequences;
  assert.equal(activate.length, 0); assert.equal(reserve.length, 1); assert.equal(activate(target, extra), target); assert.equal(reserve(target, extra), undefined);
  assert.equal(f.state.ownerCalls[0][1].length, 2); assert.equal(f.state.ownerCalls[0][1][1], extra);
  assert.equal(f.state.ownerCalls[1][1].length, 1); assert.equal(f.state.ownerCalls[1][1][0], target);
  const result = {}, calls = [];
  function explicit() { 'use strict'; assert.equal(this, undefined); calls.push(Array.from(arguments)); return result; }
  const overridden = scopeOperationFixture(true, { activateScope: explicit, reserveScopeSequences: explicit });
  const explicitActivate = overridden.probe.session.activateScope, explicitReserve = overridden.probe.session.reserveScopeSequences;
  assert.equal(explicitActivate, explicit); assert.equal(explicitReserve, explicit);
  assert.equal(explicitActivate(target, extra), result); assert.equal(explicitReserve(target), result); assert.equal(calls.length, 2);
  const empty = scopeOperationFixture(true, { activateScope: null, reserveScopeSequences: null });
  assert.equal(empty.probe.session.activateScope, null); assert.equal(empty.probe.session.reserveScopeSequences, null); assert.deepEqual(empty.state.ownerCalls, []);
});

test('Block composition defers registry, viewport, sequences and history until the corresponding operation', () => {
  const f = fixture(); assert.deepEqual(f.events, []); assert.equal(f.state.definitionSeq, 1); assert.equal(f.state.history, 0);
  assert.equal(Object.isFrozen(f.feature), true); f.state.ready = true;
  const draft = f.feature.editing.empty('new'); assert.equal(draft.id, 'BD1'); assert.equal(draft.name, 'new');
  assert.equal(f.state.definitionSeq, 2); assert.equal(f.state.history, 0); assert.deepEqual(f.events, []);
  const replacement = scope('replacement'); f.document.blockDefinitions = [replacement];
  assert.equal(f.feature.queries.blockDefinitionsInCurrentScope()[0], replacement);
});

test('nested sessions capture and restore exact host arrays, viewport and independent history through the shared workspace', () => {
  const f = fixture(); f.state.ready = true; const outer = scope('outer'), inner = scope('inner');
  const hostPoints = f.document.points, parent = f.feature.session.open(outer);
  f.state.viewport = { x: 20, y: 30, scale: 4 }; const points = [Object.assign(new g.Point('P1', 2, 3), { sketchId: 'S1' })];
  f.workspace.current().points = points;
  const child = f.feature.session.open(inner); assert.equal(child.parentSession, parent); assert.notEqual(child.history, parent.history);
  assert.equal(outer.points, points); assert.equal(outer.nextHatchIndex, 8);
  f.feature.session.restoreHost(child); assert.equal(f.workspace.current(), outer); assert.equal(f.workspace.current().points, points);
  assert.deepEqual(f.state.viewport, { x: 20, y: 30, scale: 4 }); assert.equal(f.feature.session.current, parent);
  f.feature.session.restoreHost(parent); assert.equal(f.workspace.current(), f.document); assert.equal(f.document.points, hostPoints);
  assert.deepEqual(f.state.viewport, { x: 1, y: 2, scale: 3 }); assert.equal(f.feature.session.current, null);
  assert.deepEqual(f.events.filter(e => typeof e === 'string'), ['capture-view', 'capture-view', 'restore-view', 'restore-view']);
});

test('real draft clone and rollback reconnect constraints while preserving source Geometry identity and original revision', () => {
  const f = fixture(); f.state.ready = true; const source = scope('existing'), point = f.geometry(source), line = source.lines[0];
  f.document.blockDefinitions.push(source); const draft = f.feature.editing.clone(source);
  assert.notEqual(draft.points[0], point); assert.equal(draft.constraints[0].p1, draft.points[0]);
  const session = f.feature.session.open(draft, { sourceDefinition: source });
  draft.points[0].x = 12; f.feature.editing.apply(source, draft);
  assert.equal(source.points[0], point); assert.equal(source.lines[0], line); assert.equal(point.x, 12); assert.equal(source.revision, 4);
  f.feature.session.restoreHost(session); f.feature.session.rollback(session);
  assert.equal(source.points[0], point); assert.equal(point.x, 0); assert.equal(source.lines[0], line);
  assert.equal(source.constraints[0].p1, point); assert.equal(source.revision, 3); assert.equal(source.nextHatchIndex, 8);
});

test('staged child definitions and live scope queries share the same session and restore registry identities on cancellation', () => {
  const f = fixture(); f.state.ready = true; const child = scope('child'); f.geometry(child); f.document.blockDefinitions.push(child);
  const parent = scope('parent'); parent.blockInstances.push({ id: 'BI1', definitionId: child.id, sketchId: 'S1', x: 0, y: 0, rotation: 0 });
  const entries = f.feature.session.stageChildren(parent), staged = f.document.blockDefinitions[0];
  assert.notEqual(staged, child); assert.equal(staged.parentDefinitionId, parent.id);
  const session = f.feature.session.open(parent, { isNew: true, definitionRollbackEntries: entries });
  assert.equal(f.feature.queries.blockDefinitionsInCurrentScope()[0], staged);
  assert.equal(f.feature.queries.blockDefinitionScopeError(child.id), null);
  f.feature.session.restoreHost(session); f.feature.session.rollback(session);
  assert.equal(f.document.blockDefinitions[0], child); assert.equal(child.parentDefinitionId, null);
  assert.equal(f.feature.queries.blockDefinitionsInCurrentScope()[0], child); assert.equal(f.events.some(event => Array.isArray(event) && event[0] === 'rebuild' && event[1] === child.id), true);
});

test('host capture failure propagates before opening a session, switching scope or creating history', () => {
  const f = fixture(); f.state.ready = true; const failure = new Error('viewport unavailable'); f.state.snapshotError = failure;
  assert.throws(() => f.feature.session.open(scope('draft')), error => error === failure);
  assert.equal(f.feature.session.current, null); assert.equal(f.workspace.current(), f.document); assert.equal(f.state.history, 0);
  assert.deepEqual(f.events, ['capture-view']);
});

test('command composition defers operations and creation/cancel share host capture, IDs and the same session', () => {
  const f = fixture(), c = commands(f); assert.deepEqual(f.events, []); assert.equal(f.state.definitionSeq, 1);
  f.state.ready = true; c.definition.startCreation();
  assert.equal(f.feature.session.current.draft.name, 'Block-1'); assert.equal(f.workspace.current().id, 'BD1');
  assert.equal(f.state.editorActive, true); assert.equal(f.events.filter(e => e === 'capture-view').length, 1);
  assert.equal(f.state.definitionSeq, 2); c.definition.cancel();
  assert.equal(f.feature.session.current, null); assert.equal(f.workspace.current(), f.document); assert.equal(f.state.editorActive, false);
  assert.deepEqual(f.state.viewport, { x: 1, y: 2, scale: 3 }); assert.equal(f.events.includes('history'), false);
});

test('completion confirmation retains one pending request and restores the shared host before one history commit', async () => {
  const f = fixture(); f.state.ready = true; let resolveChoice, requests = 0;
  const c = commands(f, { requestChoice: () => { requests++; return new Promise(resolve => { resolveChoice = resolve; }); } });
  f.geometry(f.document); c.selection.set('lines', f.document.lines);
  c.definition.startCreation(); const draft = f.workspace.current();
  c.completion.complete(); c.completion.complete(); assert.equal(requests, 1); assert.equal(f.workspace.current(), draft);
  resolveChoice(null); await Promise.resolve(); assert.equal(f.workspace.current(), draft); assert.equal(f.events.includes('history'), false);
  c.completion.complete(); assert.equal(requests, 2); resolveChoice(true); await Promise.resolve();
  assert.equal(f.feature.session.current, null); assert.equal(f.workspace.current(), f.document); assert.equal(f.state.editorActive, false);
  assert.equal(f.document.blockDefinitions[0], draft); assert.equal(f.events.filter(e => e === 'history').length, 1);
  assert.equal(f.document.blockInstances[0].id, 'BI1'); assert.equal(f.document.blockInstances[0].rotationLocked, true);
  assert.equal(f.document.lines.length, 0);
  assert.equal(f.events.indexOf('restore-view') < f.events.indexOf('history'), true);
});

test('invalid completion and stale confirmation leave the active session and registry unchanged', async () => {
  const f = fixture(); f.state.ready = true; let resolveChoice;
  const c = commands(f, { requestChoice: () => new Promise(resolve => { resolveChoice = resolve; }) });
  c.definition.startCreation(); const draft = f.workspace.current(); c.completion.complete();
  assert.equal(resolveChoice, undefined); assert.equal(f.workspace.current(), draft); assert.equal(f.document.blockDefinitions.length, 0);
  c.definition.cancel(); f.geometry(f.document); c.selection.set('lines', f.document.lines);
  c.definition.startCreation(); c.completion.complete(); c.definition.cancel(); resolveChoice(true); await Promise.resolve();
  assert.equal(f.workspace.current(), f.document); assert.equal(f.feature.session.current, null);
  assert.equal(f.document.blockDefinitions.length, 0); assert.equal(f.events.includes('history'), false);
});

function viewFixture(overrides = {}) {
  const f = fixture(), c = commands(f, { recordHistory: label => f.events.push(['view-history', label]), ...overrides }), elements = {}, reads = [];
  function element(id) { return { dataset: { id }, events: {}, style: {}, attrs: {}, value: '', hidden: false,
    classList: { toggle(name, value) { this[name] = value; } }, setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(type, handler) { this.events[type] = handler; }, fire(type, event) { return this.events[type]?.call(this, event || { target: this }); },
    close() { this.open = false; f.events.push('dialog-close'); }, showModal() { this.open = true; f.events.push('dialog-show'); } }; }
  for (const id of ['blockList','blockOverlayTitle','blockEditorOverlay','blockEditorNameInput','blockEditorActions','openBlockDefinitionsBtn','completeBlockEditBtn','cancelBlockEditBtn','blockDefinitionsDialog']) elements[id] = element(id);
  const row = element('outer');
  const buttons = Object.fromEntries(['Place','Edit','Rename','Delete'].map(kind => [`.block${kind}Btn`, element('outer')]));
  const dom = { getElementById(id) { reads.push(id); return elements[id] || null; },
    querySelectorAll(selector) { return selector === '.block-item[data-id]' ? [row] : buttons[selector] ? [buttons[selector]] : []; }, body: { classList: { toggle() {} } } };
  const view = c.createView({ document: dom, escapeHtml: value => String(value).replaceAll('<','&lt;'),
    startBlockPlacement: function(id) { 'use strict'; assert.equal(this, undefined); f.events.push(['place', id]); },
    localizeApplicationUI: () => f.events.push('localize') });
  assert.deepEqual(reads, []); assert.deepEqual(f.events, []); f.state.ready = true;
  return { ...f, commands: c, view, elements, buttons, row, dom };
}

test('Block feature View shares definitions, selection and the editor session while preserving name input and cancel behavior', () => {
  const f = viewFixture(), outer = scope('outer'); outer.name = '<Outer>'; f.geometry(outer);
  const child = { ...scope('child'), parentDefinitionId: 'outer' }; f.document.blockDefinitions.push(outer, child);
  const instance = { id: 'BI-existing', definitionId: 'outer' }; f.document.blockInstances.push(instance); f.commands.selection.set('blockInstances', [instance]);
  f.view.render(); assert.match(f.elements.blockList.innerHTML, /&lt;Outer>/); assert.equal(f.elements.blockList.innerHTML.includes('data-id="child"'), false);
  assert.equal(f.row.attrs['aria-selected'], 'true'); assert.match(f.elements.blockList.innerHTML, /block-item-count">1</);
  f.buttons['.blockPlaceBtn'].fire('click'); assert.deepEqual(f.events.slice(-2), ['dialog-close',['place','outer']]);
  f.view.bind(); f.buttons['.blockEditBtn'].fire('click'); const editing = f.feature.session.current;
  assert.ok(editing); assert.notEqual(editing.draft, outer); f.view.render(); assert.equal(f.elements.blockEditorNameInput.value, '<Outer>');
  assert.equal(f.elements.blockEditorOverlay.hidden, false);
  f.dom.activeElement = f.elements.blockEditorNameInput; f.elements.blockEditorNameInput.value = 'typing'; f.view.render(); assert.equal(f.elements.blockEditorNameInput.value, 'typing');
  f.elements.blockEditorNameInput.fire('input', { target: { value: 'Draft name' } }); assert.equal(editing.draft.name, 'Draft name'); assert.equal(outer.name, '<Outer>');
  assert.equal(f.events.some(event => event[0] === 'view-history'), false); f.elements.blockEditorNameInput.fire('change');
  assert.deepEqual(f.events.at(-1), ['view-history','ブロック名変更']);
  f.elements.cancelBlockEditBtn.fire('click'); assert.equal(f.feature.session.current, null); assert.equal(f.workspace.current(), f.document);
  f.view.render(); assert.equal(f.elements.blockEditorOverlay.hidden, true); assert.equal(f.elements.blockEditorNameInput.hidden, true);
  const count = f.events.length; f.elements.blockEditorNameInput.fire('input', { target: { value: 'stale input' } }); f.elements.blockEditorNameInput.fire('change');
  assert.equal(f.events.length, count); assert.equal(outer.name, '<Outer>');
});

test('Block feature View delegates registry rename, guarded deletion and completion to its actual commands', async () => {
  const f = viewFixture({ promptName: () => ' Renamed ' }), outer = scope('outer'); f.document.blockDefinitions.push(outer); f.view.render();
  f.buttons['.blockRenameBtn'].fire('click'); assert.equal(outer.name, 'Renamed'); assert.deepEqual(f.events.at(-1), ['view-history','ブロック名変更']);
  f.document.blockInstances.push({ id: 'BI-existing', definitionId: 'outer' }); f.buttons['.blockDeleteBtn'].fire('click'); assert.equal(f.document.blockDefinitions.includes(outer), true);
  f.document.blockInstances.length = 0; f.buttons['.blockDeleteBtn'].fire('click'); assert.equal(f.document.blockDefinitions.includes(outer), false);
  const completed = viewFixture({ requestChoice: () => Promise.resolve(true) }); completed.geometry(completed.document); completed.commands.selection.set('lines', completed.document.lines);
  completed.commands.definition.startCreation(); assert.ok(completed.feature.session.current); completed.view.bind(); completed.elements.completeBlockEditBtn.fire('click');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(completed.feature.session.current, null); assert.equal(completed.workspace.current(), completed.document);
  assert.equal(completed.document.blockDefinitions.length, 1); assert.equal(completed.document.blockInstances.length, 1);
  assert.equal(completed.events.filter(event => event[0] === 'view-history').length, 1);
});

function propagation(f, bound, selection, overrides = {}) {
  return f.feature.createPropagation({ readEditingScope: () => { assert.equal(f.state.ready, true); f.events.push('bound'); return bound; },
    clearSelection: () => { f.events.push('clear'); selection.clear(); },
    stabilizeDefinition: definition => { f.events.push(['stabilize', definition.id]); return { success: true }; },
    stabilizeDocument: () => { f.events.push('stabilize-document'); return { success: true }; }, applicationText: (_ja, en) => en, ...overrides });
}

test('Block propagation shares real codecs/rebinding and keeps bound document distinct from workspace with projected point identity', () => {
  const f = fixture({ realRebinding: true }), bound = scope('bound'), selection = w.CanvasSelection.create();
  const p = propagation(f, bound, selection); assert.deepEqual(f.events, []); f.state.ready = true;
  const child = scope('child'), parent = scope('parent'), grand = scope('grand'); child.parentDefinitionId = parent.id; parent.parentDefinitionId = grand.id;
  for (const definition of [child, parent, grand]) f.geometry(definition);
  f.document.blockDefinitions = [child, parent, grand]; const sourceParentConstraint = parent.constraints[0];
  f.geometry(bound); const a = bound.points[0], projected = Object.assign(new g.Point('B:P1', 15, 0), { sketchId: 'S1' });
  const original = Object.assign(new g.DistanceConstraint(a, projected, 15), { sketchId: 'S1', reference: true, referenceSketchId: 'S0' });
  bound.constraints = [original]; f.state.bundles = [{ ...scope('projection'), points: [projected] }]; selection.set('points', [a]);
  const decoy = scope('other-editing-scope'); f.workspace.activate(decoy); const decoyConstraints = decoy.constraints;
  p.propagate(child);
  assert.notEqual(parent.constraints[0], sourceParentConstraint); assert.equal(parent.constraints[0].p1, parent.points[0]);
  assert.notEqual(bound.constraints[0], original); assert.equal(bound.constraints[0].p1, a); assert.equal(bound.constraints[0].p2, projected);
  assert.equal(bound.constraints[0].reference, true); assert.equal(bound.constraints[0].referenceSketchId, 'S0');
  assert.equal(decoy.constraints, decoyConstraints); assert.equal(f.workspace.current(), decoy); assert.equal(selection.points.length, 0);
  assert.deepEqual([child.revision, parent.revision, grand.revision], [4, 4, 4]);
  assert.deepEqual(f.events.map(event => Array.isArray(event) ? event[0] === 'stabilize' ? 'stabilize-' + event[1] : event[0] : event),
    ['invalidate', 'serialize', 'stabilize-parent', 'invalidate', 'serialize', 'stabilize-grand', 'invalidate', 'bound', 'bundles', 'serialize', 'clear', 'stabilize-document']);
  const before = parent.constraints[0]; selection.set('points', [a]); f.events.length = 0;
  f.feature.session.rollback({ transientDefinitionIds: new Set(), definitionRollbackEntries: new Map([['child', { definition: child, index: 0 }]]) });
  assert.notEqual(parent.constraints[0], before); assert.equal(parent.constraints[0].p1, parent.points[0]); assert.equal(selection.points[0], a);
  assert.equal(f.events.filter(event => event[0] === 'serialize').length, 3); assert.equal(f.events.at(-1), 'invalidate');
});

test('Block propagation preserves failed rebind/solve boundaries and leaves rollback to the caller', () => {
  for (const failure of ['decode', 'serialize', 'parent-solve']) {
    const f = fixture({ realRebinding: true }), bound = scope('bound'), selection = w.CanvasSelection.create();
    const marker = new Error('codec failed'); f.state.ready = true;
    const child = scope('child'), parent = scope('parent'); f.geometry(parent); f.geometry(bound);
    if (failure === 'parent-solve') child.parentDefinitionId = parent.id;
    f.document.blockDefinitions = [child, parent]; selection.set('points', [bound.points[0]]);
    const original = bound.constraints; if (failure === 'decode') original[0].p2 = new g.Point('missing', 8, 9);
    if (failure === 'serialize') f.state.serializeFailure = marker;
    const p = propagation(f, bound, selection, failure === 'parent-solve' ? { stabilizeDefinition: () => ({ success: false, result: { reason: 'parent rejected' } }) } : {});
    assert.throws(() => p.propagate(child), error => failure === 'serialize' ? error === marker : failure === 'parent-solve' ? error.message === 'parent rejected' : error.message === '点 missing が見つかりません');
    assert.equal(bound.constraints, original); assert.equal(selection.points[0], bound.points[0]); assert.equal(child.revision, 4);
    assert.equal(parent.revision, 3); assert.equal(f.events.includes('clear'), false); assert.equal(f.events.includes('stabilize-document'), false);
    if (failure === 'parent-solve') assert.equal(f.events.includes('bound'), false);
  }
});

test('Block lookup and parameter propagation share the current bound scope while explicit propagation overrides remain independent',()=>{
  const f=fixture({realRebinding:true,sharedScope:true}),first=scope('bound-first'),second=scope('bound-second'),override=scope('bound-override');
  for(const bound of [first,second,override])f.geometry(bound);
  const one={id:'BI1'},two={id:'BI1'},decoy={id:'BI1'};first.blockInstances.push(one);second.blockInstances.push(two);f.document.blockInstances.push(decoy);
  f.state.bound=first;const originalFirst=first.constraints[0],originalSecond=second.constraints[0],originalOverride=override.constraints[0];
  const options={clearSelection:()=>f.events.push('clear'),stabilizeDefinition:()=>({success:true}),stabilizeDocument:()=>({success:true}),applicationText:(_ja,en)=>en};
  const propagation=f.feature.createPropagation(options);assert.deepEqual(f.events,[]);f.state.ready=true;
  assert.equal(f.feature.queries.blockInstanceById('BI1'),one);f.state.bound=second;assert.equal(f.feature.queries.blockInstanceById('BI1'),two);
  propagation.propagate(scope('changed'));assert.notEqual(second.constraints[0],originalSecond);assert.equal(second.constraints[0].p1,second.points[0]);assert.equal(first.constraints[0],originalFirst);
  const rebuiltSecond=second.constraints[0];const explicit=f.feature.createPropagation({...options,readEditingScope:()=>override});explicit.propagate(scope('changed-again'));
  assert.notEqual(override.constraints[0],originalOverride);assert.equal(second.constraints[0],rebuiltSecond);assert.equal(f.feature.queries.blockInstanceById('BI1'),two);
  assert.equal(f.workspace.current(),f.document);assert.equal(f.document.blockInstances[0],decoy);assert.equal(f.document.constraints.length,0);assert.ok(f.events.includes('shared-bound'));
});

function editingCommands(f, composed = true, overrides = {}, buildOwner = null) {
  let lateView;
  const state = { modeAllowed: true, creationAllowed: true, selectionAllowed: true, errors: 0, choiceResult: null };
  const drawing = w.DrawOperationLifecycle.createSession();
  const result = commands(f, overrides, (feature, ports) => {
    const isGeometryMode = () => { f.events.push('mode-guard'); return state.modeAllowed; };
    const access = { canCreateInActiveSketch: () => { f.events.push('creation-guard'); return state.creationAllowed; },
      guardSelectionEdit: operation => { f.events.push(['selection-guard', operation]); return state.selectionAllowed; } };
    const referenceState = { refreshReferenceConstraintValidity: ports.refreshReferenceConstraintValidity,
      get errorCount() { assert.equal(f.state.ready, true); f.events.push('reference-errors'); return state.errors; } };
    const choiceDialog = { show(options) { assert.equal(this, choiceDialog); f.events.push('choice'); state.choiceOptions = options; return state.choiceResult; } };
    const readView = () => { assert.ok(lateView, 'Block view is created after its commands'); return lateView; };
    Object.assign(ports, { canStartCreation: () => isGeometryMode() && access.canCreateInActiveSketch() && access.guardSelectionEdit('structure'),
      setMode: drawing.setMode, closeDefinitions: () => readView().closeDefinitions(), setEditorActive: active => readView().setEditorActive(active),
      promptName: name => w.prompt('ブロック名', name), hasInvalidReferenceConstraints: () => referenceState.errorCount > 0,
      requestChoice: options => choiceDialog.show(options), annotationReferencesRemovedGeometry: w.AnnotationAnchorData.referencesRemovedGeometry });
    const options = { interaction: { selection: ports.canvasSelection, access, lifecycle: drawing }, isGeometryMode,
      selectionQuery: ports.selectionQuery, guardDimensionSymbolDeletion: ports.guardDimensionSymbolDeletion,
      resetBlockEditorHistory: ports.resetBlockEditorHistory, clearSelection: ports.clearSelection, readView,
      drawingFit: { fitAllGeometryToViewport: ports.fitAllGeometryToViewport, resetEmptyViewport: ports.resetEmptyViewport },
      updateBlockUI: ports.updateBlockUI, presentation: { settings: { applicationText: ports.applicationText }, updateUI: ports.updateUI, draw: ports.draw, setHint: ports.setHint, log: ports.log },
      recordHistory: ports.recordHistory, referenceState, solving: { solveSketchById: ports.solveSketchById, solveReferenceDependentSketches: ports.solveReferenceDependentSketches },
      resultIsAccepted: ports.resultIsAccepted, sketches: { sketchName: ports.sketchName }, choiceDialog, blockLocalGeometryBounds: ports.blockLocalGeometryBounds,
      references: { constraintGraphNodes: ports.constraintGraphNodes }, acceptError: ports.acceptError,
      solveState: { setSketchSolveOk: ports.setSketchSolveOk, setSketchSolveError: ports.setSketchSolveError } };
    return buildOwner ? buildOwner(feature, options) : composed ? feature.createCommandsForEditing(options) : feature.createCommands(ports);
  });
  function replaceView() { const view = { closeDefinitions() { assert.equal(this, view); f.events.push('close-definitions'); },
    setEditorActive(active) { assert.equal(this, view); f.events.push(['editor-active', active]); } }; lateView = view; }
  replaceView(); return { ...result, state, drawing, replaceView };
}

test('Block editing composition defers later View and reference reads and preserves creation guard short circuits', () => {
  for (const composed of [false, true]) for (const rejected of ['modeAllowed', 'creationAllowed', 'selectionAllowed']) {
    const f = fixture(), c = editingCommands(f, composed); assert.deepEqual(f.events, []); c.state[rejected] = false;
    c.definition.startCreation(); assert.equal(f.feature.session.current, null); assert.equal(f.workspace.current(), f.document);
    assert.deepEqual(f.events, rejected === 'modeAllowed' ? ['mode-guard'] : rejected === 'creationAllowed' ? ['mode-guard', 'creation-guard'] : ['mode-guard', 'creation-guard', ['selection-guard', 'structure']]);
  }
});

test('Block editing commands share Selection and lifecycle and use the later View for opening, cancellation and rename', () => {
  for (const composed of [false, true]) {
    const f = fixture(), c = editingCommands(f, composed); f.state.ready = true; c.replaceView(); c.drawing.setMode('line');
    c.definition.startCreation(); const draft = f.workspace.current(); assert.notEqual(draft, f.document); assert.equal(c.drawing.readMode(), 'select');
    assert.ok(f.events.includes('reset-history')); assert.deepEqual(f.events.filter(e => Array.isArray(e) && e[0] === 'editor-active'), [['editor-active', true]]);
    assert.deepEqual(f.state.viewport, { x: 0, y: 0, scale: 1 }); c.replaceView(); c.definition.cancel();
    assert.equal(f.workspace.current(), f.document); assert.equal(f.feature.session.current, null); assert.deepEqual(f.state.viewport, { x: 1, y: 2, scale: 3 });
    assert.deepEqual(f.events.filter(e => Array.isArray(e) && e[0] === 'editor-active'), [['editor-active', true], ['editor-active', false]]);
    const stored = scope('stored'); f.document.blockDefinitions.push(stored); const priorPrompt = w.prompt;
    try { w.prompt = function(title, name) { assert.equal(this, w); assert.equal(title, 'ブロック名'); assert.equal(name, stored.name); return ' Renamed '; };
      c.definition.rename(stored.id); assert.equal(stored.name, 'Renamed'); assert.equal(f.events.at(-1), 'history');
    } finally { w.prompt = priorPrompt; }
    assert.equal(c.selection.lines.length, 0);
  }
});

test('Block completion uses current reference validity and keeps validation and solver failures inside the editor', () => {
  for (const composed of [false, true]) {
    const marker = new Error('solve failed'), f = fixture(); let fail = false;
    const c = editingCommands(f, composed, { solveSketchById: function(id) { 'use strict'; assert.equal(this, undefined); f.events.push(['solve', id]); if (fail) throw marker; return { success: true, errorNorm: 0 }; } });
    f.state.ready = true; c.definition.startCreation(); const session = f.feature.session.current; f.geometry(f.workspace.current()); f.events.length = 0;
    c.state.errors = 1; c.completion.complete(); assert.equal(f.feature.session.current, session); assert.equal(f.document.blockDefinitions.length, 0); assert.equal(f.events.some(e => Array.isArray(e) && e[0] === 'solve'), false);
    c.state.errors = 0; fail = true; assert.throws(() => c.completion.complete(), error => error === marker);
    assert.equal(f.feature.session.current, session); assert.equal(f.workspace.current(), session.draft); assert.equal(f.events.includes('history'), false);
    fail = false; c.completion.complete(); assert.equal(f.feature.session.current, null); assert.equal(f.workspace.current(), f.document);
    assert.equal(f.document.blockDefinitions[0], session.draft); assert.equal(f.events.filter(e => e === 'history').length, 1);
    assert.ok(f.events.indexOf('restore-view') < f.events.indexOf('history'));
  }
});

test('Block completion confirmation keeps the dialog receiver, one pending request and stale-session rejection', async () => {
  for (const composed of [false, true]) {
    const f = fixture(), c = editingCommands(f, composed); f.state.ready = true; f.geometry(f.document); c.selection.set('lines', f.document.lines);
    let resolveChoice; c.state.choiceResult = new Promise(resolve => { resolveChoice = resolve; }); c.definition.startCreation();
    c.completion.complete(); c.completion.complete(); assert.equal(f.events.filter(e => e === 'choice').length, 1);
    assert.equal(c.state.choiceOptions.defaultValue, true); assert.deepEqual(Array.from(c.state.choiceOptions.choices, choice => choice.value), [true, false]);
    c.definition.cancel(); resolveChoice(true); await Promise.resolve(); assert.equal(f.feature.session.current, null);
    assert.equal(f.workspace.current(), f.document); assert.equal(f.document.blockDefinitions.length, 0); assert.equal(f.events.includes('history'), false);
    f.events.length = 0; c.selection.set('lines', f.document.lines); c.state.choiceResult = Promise.resolve(false); c.definition.startCreation(); c.completion.complete(); await Promise.resolve();
    assert.equal(f.document.blockDefinitions.length, 1); assert.equal(f.document.blockInstances.length, 1); assert.equal(f.document.blockInstances[0].rotationLocked, false);
    assert.equal(c.selection.blockInstances[0], f.document.blockInstances[0]); assert.equal(f.events.filter(e => e === 'history').length, 1);
  }
});


function workspacePlacementFixture(composed, probe = {}) {
  probe.order = []; probe.ports = {}; probe.results = {}; let owners;
  function constructing(names, action) {
    const originals = new Map();
    for (const [namespace, name] of names) { const original = w[namespace]; originals.set(namespace, original);
      w[namespace] = { ...original, create(input) { probe.order.push(name); probe.ports[name] = input; if (probe.failAt === name) throw probe.error;
        return probe.results[name] = original.create(input); } }; }
    try { return action(); } finally { for (const [namespace, original] of originals) w[namespace] = original; }
  }
  const f = fixture({ sharedScope: true, buildFeature(options, { state, events }) {
    options.normalizedSketchCopy = w.SketchHierarchy.copyWithNormalizedAppearance;
    options.isDimensionConstraint = w.DimensionQueries.isDimensionConstraint; options.isReadOnlyDimension = w.DimensionQueries.isReadOnlyDimension;
    options.geometryElementKey = w.GeometryObjects.geometryKeyForItem;
    const originalReadViewport = options.readViewport; options.readViewport = () => state.nextViewport || originalReadViewport();
    const ready = () => assert.equal(state.ready, true), selection = w.CanvasSelection.create(), lifecycle = w.DrawOperationLifecycle.createSession();
    const preview = w.DrawingPreview.create({ types: g, hits: {}, canvasHover: {}, canCreateInActiveSketch: () => true });
    const pointer = w.PointerInteractionController.createSession();
    state.allowed = true; state.geometryMode = true; state.collapsed = true;
    owners = { documentWorkspace: { workspace: options.workspace, document: options.documentModel, documentIds: options.ids,
        sketches: { activeSketchId: options.activeSketchId }, parameters: { numericDimensionExpression: options.numericDimensionExpression, ensureParameterNamespace: options.ensureParameterNamespace } },
      readServices: { catalog: options.catalog, projections: options.projections, instances: options.instances, reads: { blockProjectionBundles: options.blockProjectionBundles } },
      rebinding: options.rebinding, editingScope: { get current() { ready(); return state.bound; } }, normalizeGeometryInstance: options.normalizeGeometryInstance,
      readViewport: options.readViewport, activateScope: options.activateScope, reserveScopeSequences: options.reserveScopeSequences, createHistory: options.createHistory,
      interaction: { selection, lifecycle, access: { canCreateInActiveSketch: () => { ready(); return state.allowed; } } }, sessions: { preview, pointer },
      presentation: { setHint: (...args) => { ready(); events.push(['hint', ...args]); }, updateUI: () => { ready(); events.push('ui'); }, draw: () => { ready(); events.push('draw'); } } };
    return constructing([['BlockDefinitionEditing', 'definition'], ['BlockEditorSession', 'session'], ['BlockEditingQueries', 'queries']],
      () => composed ? w.BlockEditingFeature.createForWorkspace(owners) : w.BlockEditingFeature.create(options));
  } });
  assert.deepEqual(probe.order, ['definition', 'session', 'queries']); assert.deepEqual(f.events, []);
  const layout = w.BlockLayout.create({ catalog: f.options.catalog, projections: f.options.projections, instanceProjections: f.options.instances,
    annotationBounds: () => null, hatchPrimitivesForScope: () => [] });
  const input = { layout, isGeometryMode: () => { assert.equal(f.state.ready, true); return f.state.geometryMode; },
    clearSelection: () => { f.events.push('clear'); owners.interaction.selection.clear(); },
    isPropertiesCollapsed: () => { assert.equal(f.state.ready, true); return f.state.collapsed; },
    setPropertiesPanelCollapsed: value => { assert.equal(f.state.ready, true); f.state.collapsed = value; f.events.push(['panel', value]); },
    solveAndRefresh: label => { f.events.push(['solve', label]); if (f.state.solveError) throw f.state.solveError; }, recordHistory: label => f.events.push(['placement-history', label]) };
  const { isPropertiesCollapsed, setPropertiesPanelCollapsed, ...placementInput } = input;
  const propertiesPanel = Object.freeze({ isPropertiesCollapsed, setPropertiesPanelCollapsed });
  const placement = constructing([['BlockPlacementCommand', 'placement']], () => composed === 'properties' ? f.feature.createPlacementWithProperties({ ...placementInput, propertiesPanel }) : composed ? f.feature.createPlacement(input)
    : w.BlockPlacementCommand.create({ ...input, ...layout, canCreateInActiveSketch: owners.interaction.access.canCreateInActiveSketch,
      blockDefinitionById: f.options.catalog.blockDefinitionById, blockDefinitionScopeError: f.feature.queries.blockDefinitionScopeError,
      blockDefinitionDrawableSketchIds: f.options.catalog.blockDefinitionDrawableSketchIds, blockDefinitionGeometrySketchIds: f.options.catalog.blockDefinitionGeometrySketchIds,
      activeSketchId: f.options.activeSketchId, currentScope: f.workspace.current, nextInstanceId: () => f.options.ids.allocate('blockInstance'),
      canvasSelection: owners.interaction.selection, invalidateBlockProjectionCache: f.options.projections.invalidateBlockProjectionCache,
      getPointerPreview: () => owners.sessions.preview.pointer, setPointerPreview: value => { owners.sessions.preview.setPointer(value); }, getLastPointerWorld: owners.sessions.pointer.readLastPointer,
      setMode: owners.interaction.lifecycle.setMode, ...owners.presentation }));
  assert.deepEqual(f.events, []); assert.equal(f.state.definitionSeq, 1); assert.equal(f.state.history, 0);
  return { ...f, placement, owners, input, probe, propertiesPanel };
}

test('Block workspace composition preserves actual owners and construction stages and reads the late viewport only during session operations', () => {
  for (const composed of [false, true, 'properties']) {
    const f = workspacePlacementFixture(composed), { ports, results } = f.probe;
    assert.deepEqual(f.probe.order, ['definition', 'session', 'queries', 'placement']);
    assert.equal(f.feature.editing, results.definition); assert.equal(f.feature.session, results.session); assert.equal(f.feature.queries, results.queries); assert.equal(f.placement, results.placement);
    assert.equal(ports.placement.currentScope, ports.session.currentScope); assert.equal(ports.placement.canvasSelection, f.owners.interaction.selection);
    assert.equal(ports.placement.blockDefinitionScopeError, f.feature.queries.blockDefinitionScopeError); assert.equal(ports.definition.ensureParameterNamespace, f.options.ensureParameterNamespace);
    f.state.ready = true; const draft = f.feature.editing.empty('new'); assert.equal(draft.id, 'BD1'); assert.equal(f.state.definitionSeq, 2);
    const late = { snapshot() { assert.equal(this, late); return { x: 30, y: 40, scale: 5 }; }, update(value) { assert.equal(this, late); f.state.lateRestored = value; } };
    f.state.nextViewport = late; const host = f.workspace.current(), opened = f.feature.session.open(scope('nested'));
    f.feature.session.restoreHost(opened); assert.equal(f.workspace.current(), host); assert.deepEqual({ ...f.state.lateRestored }, { x: 30, y: 40, scale: 5 });
    const bound = { blockInstances: [{ id: 'BOUND' }] }; f.state.bound = bound;
    assert.equal(f.feature.queries.blockInstanceById('BOUND'), bound.blockInstances[0]); assert.equal(f.workspace.current().blockInstances.length, 0);
  }
});

test('Block workspace placement shares preview, pointer, selection and IDs while preserving anchor, orthogonal rotation and panel restoration', () => {
  for (const composed of [false, true, 'properties']) {
    const f = workspacePlacementFixture(composed); f.state.ready = true; const definition = scope('D1'); f.geometry(definition); f.document.blockDefinitions.push(definition);
    const source = JSON.stringify(definition), pointer = { x: 20, y: 30 }; f.owners.sessions.pointer.setLastPointer(pointer);
    f.placement.start('D1'); assert.equal(f.owners.interaction.lifecycle.mode, 'block-place'); assert.equal(f.state.collapsed, false); assert.equal(f.owners.sessions.preview.pointer, pointer);
    f.placement.click(pointer); f.placement.click({ x: 20, y: 40 }); const instance = f.document.blockInstances[0];
    assert.equal(instance.id, 'BI1'); assert.ok(Math.abs(instance.rotation - Math.PI / 2) < 1e-12);
    assert.ok(Math.abs(instance.x - 20) < 1e-12); assert.ok(Math.abs(instance.y - 25) < 1e-12);
    assert.equal(f.owners.interaction.selection.blockInstances[0], instance); assert.equal(f.owners.sessions.preview.pointer, null);
    assert.equal(f.owners.interaction.lifecycle.mode, 'select'); assert.equal(f.state.collapsed, true); assert.equal(JSON.stringify(definition), source);
    assert.equal(f.events.filter(event => Array.isArray(event) && event[0] === 'placement-history').length, 1);
  }
});

test('Properties placement shares panel ports and preserves explicit callback overrides including undefined and null', () => {
  const f = workspacePlacementFixture(true), original = w.BlockPlacementCommand, marker = {}; let ports;
  w.BlockPlacementCommand = { ...original, create(options) { ports = options; return marker; } };
  try {
    const { isPropertiesCollapsed, setPropertiesPanelCollapsed, ...options } = f.input;
    assert.equal(f.feature.createPlacementWithProperties({ ...options, propertiesPanel: f.propertiesPanel }), marker);
    assert.equal(ports.isPropertiesCollapsed, isPropertiesCollapsed); assert.equal(ports.setPropertiesPanelCollapsed, setPropertiesPanelCollapsed);
    for (const value of [undefined, null, () => false]) {
      f.feature.createPlacementWithProperties({ ...options, propertiesPanel: f.propertiesPanel, isPropertiesCollapsed: value, setPropertiesPanelCollapsed: value });
      assert.equal(ports.isPropertiesCollapsed, value); assert.equal(ports.setPropertiesPanelCollapsed, value);
    }
  } finally { w.BlockPlacementCommand = original; }
});

test('Block workspace placement preserves scope rejection, cancellation, partial state on solver exceptions and factory failure order', () => {
  for (const composed of [false, true, 'properties']) {
    const f = workspacePlacementFixture(composed); f.state.ready = true; const definition = scope('D1'); f.geometry(definition); f.document.blockDefinitions.push(definition);
    f.state.allowed = false; f.placement.start('D1'); assert.equal(f.owners.interaction.lifecycle.mode, 'select'); assert.equal(f.state.collapsed, true);
    f.state.allowed = true; definition.parentDefinitionId = 'OTHER'; f.placement.start('D1'); assert.equal(f.owners.interaction.lifecycle.mode, 'select');
    definition.parentDefinitionId = null; f.placement.start('D1'); f.placement.finishOrCancel(); assert.equal(f.state.collapsed, true); assert.equal(f.document.blockInstances.length, 0);
    f.placement.start('D1'); f.placement.click({ x: 1, y: 2 }); f.state.solveError = new Error('solve');
    assert.throws(() => f.placement.commit(), error => error === f.state.solveError); assert.equal(f.document.blockInstances.length, 1); assert.equal(f.state.collapsed, true);
    assert.equal(f.events.some(event => Array.isArray(event) && event[0] === 'placement-history'), false);
    for (const [failAt, order] of [['definition', ['definition']], ['session', ['definition', 'session']], ['queries', ['definition', 'session', 'queries']], ['placement', ['definition', 'session', 'queries', 'placement']]]) {
      const probe = { failAt, error: new Error(failAt) }; assert.throws(() => workspacePlacementFixture(composed, probe), error => error === probe.error); assert.deepEqual(probe.order, order);
    }
  }
});

function configurationOwnersFixture(composed, probe = {}) {
  const f = workspacePlacementFixture(true), { owners } = f, effects = [], state = { allowed: true, failAt: null };
  Object.assign(probe, { f, effects });
  const step = (name, ...args) => { assert.equal(f.state.ready, true); effects.push([name, ...args]); if (state.failAt === name) throw probe.error; };
  const makeLine = (id, sketchId, y) => Object.assign(new g.Line("BI1@" + id,
    Object.assign(new g.Point("BI1@" + id + "a", 0, y), { sketchId }), Object.assign(new g.Point("BI1@" + id + "b", 10, y), { sketchId })), { sketchId });
  const a = makeLine("L1", "S1", 0), b = makeLine("L2", "S2", 5), definition = scope("BD1");
  definition.name = "Part"; definition.sketches.push({ id: "S2", kind: "sketch", parentId: "ROOT" }); definition.lines = [a, b];
  definition.points = [a.p1, a.p2, b.p1, b.p2]; f.document.blockDefinitions.push(definition);
  const retained = new g.HorizontalConstraint(a), removed = new g.HorizontalConstraint(b);
  const instance = { id: "BI1", definitionId: "BD1", enabledSketchIds: ["S1", "S2"] }; f.document.constraints = [retained, removed];
  const bundle = lines => ({ points: lines.flatMap(line => [line.p1, line.p2]), lines, circles: [], arcs: [], splines: [] });
  Object.assign(owners.readServices.projections, {
    blockProjectionBundle(item) { "use strict"; assert.equal(this, undefined); step("bundle"); assert.equal(item, instance); return bundle([a, b]); },
    createBlockProjectionBundle(item, value, ids) { "use strict"; assert.equal(this, undefined); step("project"); assert.equal(item, instance); assert.equal(value, definition); return bundle(ids.includes("S2") ? [a, b] : [a]); },
    invalidateBlockProjectionCache(id) { "use strict"; assert.equal(this, undefined); step("invalidate", id); },
  });
  const hover = w.CanvasHover.create({ isEndpointPoint: () => false });
  const hoverPort = { get current() { step("hover-read"); return hover.current; }, update(patch) { assert.equal(this, hoverPort); step("hover-update"); return hover.update(patch); } };
  owners.interaction.hover = hoverPort;
  Object.assign(owners.presentation, { setHint: (...args) => step("hint", ...args), log: text => step("log", text), updateUI: () => step("ui"), draw: () => step("draw") });
  const references = w.ConstraintReferences.create({ resolveGeometryRef: () => null });
  const input = { references, guardDimensionSymbolDeletion: constraints => { step("guard"); assert.equal(constraints.has(removed), true); return state.allowed; },
    updateBlockUI: () => step("block-ui"), recordHistory: label => step("history", label) };
  let captured, result; const original = w.BlockConfigurationCommand;
  w.BlockConfigurationCommand = { ...original, create(ports) { captured = ports; if (probe.constructorError) throw probe.constructorError; return result = original.create(ports); } };
  let configuration;
  try {
    configuration = composed ? f.feature.createConfiguration(input) : w.BlockConfigurationCommand.create({ currentScope: f.workspace.current,
      blockDefinitionById: owners.readServices.catalog.blockDefinitionById, blockProjectionBundle: owners.readServices.projections.blockProjectionBundle,
      createBlockProjectionBundle: owners.readServices.projections.createBlockProjectionBundle,
      blockDefinitionDrawableSketchIds: owners.readServices.catalog.blockDefinitionDrawableSketchIds, blockDefinitionGeometrySketchIds: owners.readServices.catalog.blockDefinitionGeometrySketchIds,
      constraintGraphNodes: references.constraintGraphNodes, geometryRefKey: w.GeometryRef.key, parseGeometryRefId: w.GeometryRef.parseId,
      annotationReferencesRemovedGeometry: w.AnnotationAnchorData.referencesRemovedGeometry, guardDimensionSymbolDeletion: input.guardDimensionSymbolDeletion,
      canvasSelection: owners.interaction.selection, clearRemovedHover: values => { if (values.has(hoverPort.current.dimension)) hoverPort.update({ dimension: null }); },
      invalidateBlockProjectionCache: owners.readServices.projections.invalidateBlockProjectionCache, ...owners.presentation,
      updateBlockUI: input.updateBlockUI, recordHistory: input.recordHistory });
  } finally { w.BlockConfigurationCommand = original; }
  assert.deepEqual(effects, []); assert.deepEqual(f.events, []); f.state.ready = true;
  owners.interaction.selection.set("dimensionConstraint", removed); owners.interaction.selection.set("constraint", removed); hover.update({ dimension: removed });
  return { ...f, configuration, result, captured, input, cfgState: state, effects, hover, instance, retained, removed, definition, a, b };
}

test("Block configuration shares cold feature owners and mutates the live Workspace rather than the last bound editing scope", () => {
  const snapshots = [];
  for (const composed of [false, true]) {
    const f = configurationOwnersFixture(composed), selection = f.owners.interaction.selection;
    assert.equal(f.configuration, f.result); assert.equal(Object.isFrozen(f.configuration), true); assert.equal(f.captured.currentScope, f.workspace.current);
    assert.equal(f.captured.canvasSelection, selection); assert.equal(f.captured.constraintGraphNodes, f.input.references.constraintGraphNodes);
    assert.equal(f.captured.blockDefinitionById, f.owners.readServices.catalog.blockDefinitionById); assert.equal(f.captured.setHint, f.owners.presentation.setHint);
    const replacement = { ...scope("replacement"), constraints: [f.retained, f.removed] }; f.workspace.activate(replacement);
    f.state.bound = { constraints: [f.removed] }; f.definition.name = "Renamed";
    assert.equal(f.configuration.setEnabledSketchIds(f.instance, ["unknown", "S1", "S1"]), true);
    assert.deepEqual(Array.from(f.instance.enabledSketchIds), ["S1"]); assert.equal(replacement.constraints.length, 1); assert.equal(replacement.constraints[0], f.retained);
    assert.equal(f.document.constraints.length, 2); assert.equal(f.state.bound.constraints[0], f.removed);
    assert.equal(selection.dimensionConstraint, null); assert.equal(selection.constraint, null); assert.equal(f.hover.current.dimension, null);
    assert.deepEqual(f.effects.map(entry => entry[0]), ["bundle", "project", "guard", "hover-read", "hover-update", "invalidate", "hint", "log", "ui", "draw", "history"]);
    assert.match(f.effects.find(entry => entry[0] === "hint")[1], /Renamed/); assert.equal(f.effects.at(-1)[1], "ブロック構成変更");
    snapshots.push(JSON.stringify(f.effects));
  }
  assert.equal(snapshots[1], snapshots[0]);
});

test("Block configuration preserves drawable, actual annotation-reference and Parameter rejection before mutation and leaves unrelated hover intact", () => {
  for (const composed of [false, true]) {
    for (const reason of ["empty", "annotation", "parameter"]) {
      const f = configurationOwnersFixture(composed), selection = f.owners.interaction.selection;
      if (reason === "annotation") f.document.annotations.push({ id: "N1", type: "leader", geometryRef: w.GeometryRef.parseId("line", f.b.id) });
      if (reason === "parameter") f.cfgState.allowed = false;
      assert.equal(f.configuration.setEnabledSketchIds(f.instance, reason === "empty" ? ["unknown"] : ["S1"]), false);
      assert.deepEqual(Array.from(f.instance.enabledSketchIds), ["S1", "S2"]); assert.equal(f.document.constraints.length, 2);
      assert.equal(selection.dimensionConstraint, f.removed); assert.equal(selection.constraint, f.removed); assert.equal(f.hover.current.dimension, f.removed);
      assert.equal(f.effects.at(-1)[0], "block-ui"); assert.equal(f.effects.some(entry => ["history", "invalidate", "hover-update"].includes(entry[0])), false);
    }
    const f = configurationOwnersFixture(composed); f.hover.update({ dimension: f.retained });
    assert.equal(f.configuration.setEnabledSketchIds(f.instance, ["S1"]), true); assert.equal(f.hover.current.dimension, f.retained);
    assert.equal(f.effects.some(entry => entry[0] === "hover-update"), false);
  }
});

test("Block configuration retains constructor and operation failure identity and legacy partial mutation without notification or rollback changes", () => {
  for (const composed of [false, true]) {
    const constructorError = new Error("configuration"), probe = { constructorError };
    assert.throws(() => configurationOwnersFixture(composed, probe), value => value === constructorError); assert.deepEqual(probe.effects, []); assert.deepEqual(probe.f.events, []);
  }
  for (const failAt of ["bundle", "project", "guard", "hover-update", "invalidate", "hint", "ui", "draw", "history"]) {
    const snapshots = [];
    for (const composed of [false, true]) {
      const error = new Error(failAt), f = configurationOwnersFixture(composed, { error }); f.cfgState.failAt = failAt;
      assert.throws(() => f.configuration.setEnabledSketchIds(f.instance, ["S1"]), value => value === error);
      assert.equal(f.effects.at(-1)[0], failAt);
      snapshots.push(JSON.stringify({ effects: f.effects, ids: f.instance.enabledSketchIds, constraints: f.document.constraints.map(c => c.name),
        selected: f.owners.interaction.selection.dimensionConstraint?.name, hover: f.hover.current.dimension?.name }));
    }
    assert.equal(snapshots[1], snapshots[0]);
  }
});

function selectionOwnersFixture(composed, probe = {}) {
  const f = workspacePlacementFixture(true), { owners } = f, calls = [], state = { language: "en", unsupported: false, failAt: null, bundles: new Map(), refs: new Map() };
  Object.assign(probe, { f, calls });
  const step = name => { assert.equal(f.state.ready, true); calls.push(name); if (state.failAt === name) throw probe.error; };
  const makePoint = (id, x, y) => Object.assign(new g.Point(id, x, y), { sketchId: "S1" });
  const a = makePoint("P1", 0, 0), b = makePoint("P2", 10, 0), outside = makePoint("P3", 20, 20), loose = makePoint("loose", 1000, 1000);
  const line = Object.assign(new g.Line("L1", a, b), { sketchId: "S1" }); f.document.points = [a, b, outside, loose]; f.document.lines = [line];
  const internal = new g.HorizontalConstraint(line), external = new g.DistanceConstraint(a, outside, 20), reference = Object.assign(new g.DistanceConstraint(a, b, 10), { reference: true });
  f.document.constraints = [internal, external, reference];
  owners.interaction.selection.set("lines", [line]); owners.interaction.selection.set("points", [loose]);
  owners.documentWorkspace.sketches.elementSketchId = item => item.sketchId;
  owners.readServices.projections.blockProjectionBundle = function(instance) { "use strict"; assert.equal(this, undefined); step("projection"); return state.bundles.get(instance); };
  owners.readServices.reads.resolveGeometryRef = function(ref) { "use strict"; assert.equal(this, undefined); step("resolve"); return state.refs.get(w.GeometryRef.key(ref)) || null; };
  owners.presentation.settings = { applicationText: (_ja, en) => { step("translate"); return en; } };
  owners.presentation.constraintFeedback = { localizedConstraintName(name) { "use strict"; assert.equal(this, undefined); step("label"); return state.language + ":" + name; } };
  const actualReferences = w.ConstraintReferences.create({ resolveGeometryRef: owners.readServices.reads.resolveGeometryRef });
  const references = { constraintGraphNodes(constraint) { "use strict"; assert.equal(this, undefined); step("nodes"); return actualReferences.constraintGraphNodes(constraint); } };
  const codec = w.ConstraintPersistence.create({ geometryId: item => item.id, dimensionData: () => ({}) });
  const input = { references, serializeConstraint(constraint) { "use strict"; assert.equal(this, undefined); step("serialize"); return state.unsupported ? null : codec.serialize(constraint); },
    annotationBounds(annotation) { "use strict"; assert.equal(this, undefined); step("annotation-bounds"); return annotation.box; } };
  const original = w.BlockSelectionQuery; let captured, result;
  w.BlockSelectionQuery = { ...original, create(ports) { captured = ports; if (probe.constructorError) throw probe.constructorError; return result = original.create(ports); } };
  let query;
  try {
    const { localizedConstraintName } = owners.presentation.constraintFeedback;
    query = composed ? f.feature.createSelectionQuery(input) : w.BlockSelectionQuery.create({ currentScope: f.workspace.current,
      canvasSelection: owners.interaction.selection, blockProjectionBundle: owners.readServices.projections.blockProjectionBundle,
      elementSketchId: owners.documentWorkspace.sketches.elementSketchId, activeSketchId: owners.documentWorkspace.sketches.activeSketchId,
      constraintGraphNodes: references.constraintGraphNodes, serializeConstraint: input.serializeConstraint, constraintLabelForList: constraint => localizedConstraintName(constraint.name),
      resolveGeometryRef: owners.readServices.reads.resolveGeometryRef, applicationText: owners.presentation.settings.applicationText,
      mergeBounds: w.GeometryBounds.mergeBounds, lineBBox: w.GeometryBounds.lineBBox, primitiveBBox: w.GeometryBounds.primitiveBBox,
      splineBBox: w.GeometryBounds.splineBBox, annotationBounds: input.annotationBounds });
  } finally { w.BlockSelectionQuery = original; }
  assert.deepEqual(calls, []); assert.deepEqual(f.events, []); f.state.ready = true;
  const leader = { id: "AN1", type: "leader", sketchId: "S1", geometryRef: w.GeometryRef.parseId("line", line.id), box: { x1: -4, y1: 0, x2: -2, y2: 2 } };
  state.refs.set(w.GeometryRef.key(leader.geometryRef), line);
  return { ...f, query, queryState: state, calls, input, captured, result, a, b, line, outside, loose, internal, external, reference, leader };
}

test("Block selection feature shares cold Workspace, Selection, projection, reference and codec owners and keeps live scope and candidate identity", () => {
  const snapshots = [];
  for (const composed of [false, true]) {
    const f = selectionOwnersFixture(composed), selected = f.owners.interaction.selection;
    assert.equal(f.query, f.result); assert.equal(Object.isFrozen(f.query), true); assert.equal(f.captured.currentScope, f.workspace.current);
    assert.equal(f.captured.canvasSelection, selected); assert.equal(f.captured.serializeConstraint, f.input.serializeConstraint); assert.equal(f.captured.constraintGraphNodes, f.input.references.constraintGraphNodes);
    assert.equal(f.captured.resolveGeometryRef, f.owners.readServices.reads.resolveGeometryRef); assert.equal(f.captured.annotationBounds, f.input.annotationBounds);
    const before = JSON.stringify([f.document, selected]), result = f.query.read();
    assert.equal(result.points.includes(f.a), true); assert.equal(result.points.includes(f.b), true); assert.equal(result.lines[0], f.line);
    assert.deepEqual(Array.from(result.constraints), [f.internal]); assert.deepEqual(Array.from(result.externalConstraints), [f.external, f.reference]);
    assert.equal(JSON.stringify([f.document, selected]), before);
    f.state.bound = { constraints: [f.internal] }; const replacement = { ...f.document, constraints: [] }; f.workspace.activate(replacement);
    assert.equal(f.query.read().constraints.length, 0); assert.equal(f.document.constraints.length, 3); assert.equal(f.state.bound.constraints[0], f.internal);
    snapshots.push(JSON.stringify({ calls: f.calls, names: result.constraints.map(c => c.name) }));
  }
  assert.equal(snapshots[1], snapshots[0]);
});

test("Block selection feature keeps reference and hatch closure, support and Sketch rejection, live constraint labels and actual bounds", () => {
  for (const composed of [false, true]) {
    for (const reason of ["shared", "sketch", "annotation", "hatch", "unsupported"]) {
      const f = selectionOwnersFixture(composed);
      if (reason === "shared") f.document.lines.push(new g.Line("other", f.a, f.outside));
      if (reason === "sketch") f.line.sketchId = "S2";
      if (reason === "annotation") f.document.annotations.push(f.leader);
      if (reason === "hatch") f.document.hatches.push({ id: "H1", sketchId: "S1", boundaryLoops: [{ spans: [{ source: w.GeometryRef.parseId("line", f.line.id), start: { type: "endpoint", name: "p1" }, end: { type: "endpoint", name: "p2" } }] }] });
      if (reason === "unsupported") f.queryState.unsupported = true;
      const before = JSON.stringify(f.document); const rejected = f.query.read(); assert.equal(typeof rejected.error, "string", reason); assert.equal(JSON.stringify(f.document), before);
      if (reason === "unsupported") { assert.match(rejected.error, /en:/); f.queryState.language = "ja"; assert.match(f.query.read().error, /ja:/); }
    }
    const f = selectionOwnersFixture(composed), selection = f.owners.interaction.selection, instance = { id: "BI1", sketchId: "S1" };
    const projected = Object.assign(new g.Point("BI1@P", 30, 40), { sketchId: "S1", blockProjection: true });
    f.queryState.bundles.set(instance, { points: [projected], lines: [], circles: [], arcs: [], splines: [], annotations: [{ box: { x1: 40, y1: 50, x2: 50, y2: 60 } }] });
    f.document.blockInstances.push(instance); selection.set("blockInstances", [instance]); f.document.annotations.push(f.leader); selection.set("annotations", [f.leader]);
    const result = f.query.read(); assert.equal(result.annotations[0], f.leader); assert.equal(result.projectedGeometry[0], projected);
    const center = f.query.center(result); assert.equal(center.x, 23); assert.equal(center.y, 30); assert.equal(f.query.center({}).x, 0);
    assert.equal(selection.points[0], f.loose); assert.deepEqual(f.events, []);
  }
});

test("Block selection feature preserves constructor, reference, codec, label, projection and bounds exception identity without mutating owners", () => {
  for (const composed of [false, true]) {
    const constructorError = new Error("query"), probe = { constructorError }; assert.throws(() => selectionOwnersFixture(composed, probe), value => value === constructorError);
    assert.deepEqual(probe.calls, []); assert.deepEqual(probe.f.events, []);
    for (const failAt of ["nodes", "serialize", "label", "resolve", "projection", "annotation-bounds"]) {
      const error = new Error(failAt), f = selectionOwnersFixture(composed, { error }); f.queryState.failAt = failAt;
      if (failAt === "label") f.queryState.unsupported = true;
      if (failAt === "resolve") { f.document.annotations.push(f.leader); f.owners.interaction.selection.set("annotations", [f.leader]); }
      if (failAt === "projection") { const instance = { id: "BI1", sketchId: "S1" }; f.document.blockInstances.push(instance); f.owners.interaction.selection.set("blockInstances", [instance]); }
      const before = JSON.stringify(f.document);
      assert.throws(() => failAt === "annotation-bounds" ? f.query.center({ annotations: [f.leader] }) : f.query.read(), value => value === error);
      assert.equal(f.calls.at(-1), failAt); assert.equal(JSON.stringify(f.document), before); assert.deepEqual(f.events, []);
    }
  }
});


function commandViewOwnersFixture(owned) {
 const f=workspacePlacementFixture(true),state={generation:0,constructorFailure:false,prepareFailure:false,renderFailure:false,error:new Error('view owner')};
 const preparation=owned==='prepared'?w.BlockEditingFeature.prepareCommandsWithView():null;
 let view,api;const reads=[],listeners=[],elements={};
 for(const id of ['blockList','blockOverlayTitle','blockEditorOverlay','blockEditorNameInput','blockEditorActions','openBlockDefinitionsBtn','completeBlockEditBtn','cancelBlockEditBtn','blockDefinitionsDialog']){
  const element={value:'',hidden:false,style:{},dataset:{},classList:{toggle(){}},addEventListener(type,handler){listeners.push([id,type,handler]);},
   close(){assert.equal(this,element);f.events.push('dialog-close');},showModal(){assert.equal(this,element);f.events.push('dialog-show');}};elements[id]=element;
 }
 const document={getElementById(id){reads.push(id);return elements[id]||null;},querySelectorAll:()=>[],body:{classList:{toggle(){}}}};
 const localize=()=>f.events.push('localize');
 function prepareBlocks(){'use strict';assert.equal(this,undefined);assert.equal(arguments.length,0);f.events.push('prepare');if(state.prepareFailure)throw state.error;return state;}
 function updateView(){prepareBlocks();view.render();}
 f.state.ready=false;f.state.bound=f.document;
 const bundle=editingCommands(f,true,{},(feature,options)=>{
  Object.assign(f.owners.interaction,options.interaction);Object.assign(f.owners.presentation,options.presentation);
  f.owners.presentation.settings.localizeApplicationUI=localize;Object.assign(f.owners.documentWorkspace.sketches,options.sketches);
  const {interaction,presentation,sketches,readView,updateBlockUI,...input}=options;
  return api=preparation?preparation.createForFeature(feature,{...input,prepareBlocks}):owned?feature.createCommandsWithView({...input,prepareBlocks}):feature.createCommandsForEditing({...options,readView:()=>view,updateBlockUI:updateView});
 });
 assert.deepEqual(f.events,[]);assert.deepEqual(reads,[]);assert.deepEqual(listeners,[]);
 const update=preparation?preparation.update:owned?bundle.updateView:updateView;
 function publish(){
  const original=w.BlockView;w.BlockView={create(input){assert.equal(this,w.BlockView);state.ports=input;if(state.constructorFailure)throw state.error;
   const actual=original.create(input),generation=++state.generation;
   const result={...actual,render(){assert.equal(this,result);f.events.push(['render',generation]);if(state.renderFailure)throw state.error;return actual.render();},
    closeDefinitions(){assert.equal(this,result);f.events.push(['close',generation]);return actual.closeDefinitions();},
    setEditorActive(active){assert.equal(this,result);f.events.push(['active',generation,active]);return actual.setEditorActive(active);}};
   return Object.freeze(result);
  }};
  try{const {createView}=bundle;const result=createView({document,escapeHtml:String,startBlockPlacement:()=>{},...(!owned?{localizeApplicationUI:localize}:{})});view=result;return result;}
  finally{w.BlockView=original;}
 }
 f.state.ready=true;return {...f,bundle,api,update,publish,viewState:state,reads,listeners,elements};
}

test('Block command View owner stays cold, shares preparation and later View, and preserves void rendering and failure order',()=>{
 const traces=[];
 for(const owned of [false,true,'prepared']){
  const f=commandViewOwnersFixture(owned);if(owned)assert.equal(Object.isFrozen(f.api),true);
  f.publish();assert.deepEqual(f.events,[]);assert.deepEqual(f.reads,[]);assert.deepEqual(f.listeners,[]);
  assert.equal(f.viewState.ports.refresh,owned==='prepared'?f.bundle.updateView:f.update);
  assert.equal(f.update(),undefined);assert.deepEqual(f.events.slice(0,2),['prepare',['render',1]]);
  f.events.length=0;f.viewState.prepareFailure=true;assert.throws(()=>f.update(),error=>error===f.viewState.error);assert.deepEqual(f.events,['prepare']);
  f.viewState.prepareFailure=false;f.viewState.renderFailure=true;f.events.length=0;assert.throws(()=>f.update(),error=>error===f.viewState.error);assert.deepEqual(f.events,['prepare',['render',1]]);
  traces.push(JSON.stringify(f.events));
 }
 assert.equal(traces[1],traces[0]);assert.equal(traces[2],traces[0]);
});

test('Block command View owner routes opening, cancellation and refresh to the latest completed View without replacing the editing session',()=>{
 const traces=[];
 for(const owned of [false,true,'prepared']){
  const f=commandViewOwnersFixture(owned),session=f.feature.session,first=f.publish(),second=f.publish();assert.notEqual(first,second);
  const outer=scope('outer');f.geometry(outer);f.document.blockDefinitions.push(outer);f.events.length=0;
  f.bundle.definition.enter('outer');f.update();assert.equal(f.feature.session,session);assert.ok(session.current);assert.notEqual(f.workspace.current(),f.document);
  assert.ok(f.events.some(e=>Array.isArray(e)&&e[0]==='active'&&e[1]===2&&e[2]===true));
  assert.equal(f.elements.blockEditorNameInput.hidden,false);assert.equal(f.elements.blockEditorNameInput.value,'outer');
  f.bundle.definition.cancel();f.update();assert.equal(session.current,null);assert.equal(f.workspace.current(),f.document);assert.equal(f.elements.blockEditorNameInput.hidden,true);
  assert.equal(f.document.blockDefinitions[0],outer);assert.equal(f.events.some(e=>e==='history'),false);
  f.bundle.definition.startCreation();assert.ok(f.events.some(e=>Array.isArray(e)&&e[0]==='close'&&e[1]===2));f.bundle.definition.cancel();
  traces.push(JSON.stringify(f.events));
 }
 assert.equal(traces[1],traces[0]);assert.equal(traces[2],traces[0]);
});

test('Block command View owner retains the previously published View after constructor failure',()=>{
 const traces=[];
 for(const owned of [false,true,'prepared']){
  const f=commandViewOwnersFixture(owned);f.publish();f.viewState.constructorFailure=true;
  assert.throws(()=>f.publish(),error=>error===f.viewState.error);f.events.length=0;assert.equal(f.update(),undefined);
  assert.deepEqual(f.events.slice(0,2),['prepare',['render',1]]);assert.equal(f.feature.session.current,null);assert.equal(f.workspace.current(),f.document);
  traces.push(JSON.stringify(f.events));
 }
 assert.equal(traces[1],traces[0]);assert.equal(traces[2],traces[0]);
});


test('prepared Block updates retain the same pre-View preparation and TypeError phase', () => {
  const traces = [];
  for (const mode of [false, true, 'prepared']) {
    const f = commandViewOwnersFixture(mode);
    assert.throws(f.update, { name: 'TypeError', message: "Cannot read properties of undefined (reading 'render')" });
    assert.deepEqual(f.events, ['prepare']); f.events.length = 0;
    f.publish(); assert.equal(f.update('ignored'), undefined); traces.push(JSON.stringify(f.events));
  }
  assert.equal(traces[1], traces[0]); assert.equal(traces[2], traces[0]);
});

test('prepared Block command View keeps native records, bare void updates and the previous updater after build or field failure', () => {
  const p = w.BlockEditingFeature.prepareCommandsWithView(), marker = new Error('Block update failed'), events = [], input = {}, result = {};
  let next, failBuild = false, failGet = false, failUpdate = false;
  const make = name => {
    const commands = Object.freeze(Object.defineProperty({}, 'updateView', { get() {
      assert.equal(this, commands); events.push('get-' + name); if (failGet) throw marker;
      return function() { 'use strict'; assert.equal(this, undefined); assert.equal(arguments.length, 0); events.push(name); if (failUpdate) throw marker; return result; };
    } })); return commands;
  };
  const a = make('A'), b = make('B'), feature = Object.freeze({ createCommandsWithView(options) {
    assert.equal(this, feature); assert.equal(arguments.length, 1); assert.equal(options, input); events.push('build');
    if (failBuild) throw marker; return next;
  } });
  assert.ok(Object.isFrozen(p)); assert.equal(p.update.name, 'updateBlockUI'); assert.equal(p.update.length, 0); assert.ok(Object.hasOwn(p.update, 'prototype'));
  const guard = { name: 'ReferenceError', message: "Cannot access 'updateBlockView' before initialization" };
  assert.deepEqual(events, []); assert.throws(p.update, guard);
  failBuild = true; assert.throws(() => p.createForFeature(feature, input), error => error === marker); assert.throws(p.update, guard);
  failBuild = false; next = a; assert.equal(p.createForFeature(feature, input), a); assert.deepEqual(events.slice(-2), ['build', 'get-A']);
  assert.equal(p.update('ignored'), undefined); assert.equal(events.at(-1), 'A');
  failBuild = true; next = b; assert.throws(() => p.createForFeature(feature, input), error => error === marker); failBuild = false;
  assert.equal(p.update(), undefined); assert.equal(events.at(-1), 'A');
  failGet = true; assert.throws(() => p.createForFeature(feature, input), error => error === marker); failGet = false;
  assert.equal(p.update(), undefined); assert.equal(events.at(-1), 'A');
  assert.equal(p.createForFeature(feature, input), b); assert.equal(p.update(), undefined); assert.equal(events.at(-1), 'B');
  failUpdate = true; assert.throws(p.update, error => error === marker); failUpdate = false;
  const separate = w.BlockEditingFeature.prepareCommandsWithView(); assert.throws(separate.update, guard);
  for (const value of [undefined, null]) {
    const updater = w.BlockEditingFeature.prepareCommandsWithView(), commands = Object.freeze({ updateView: value });
    updater.createForFeature({ createCommandsWithView: () => commands }, {});
    assert.throws(updater.update, { name: 'TypeError', message: 'updateBlockView is not a function' });
  }
});
