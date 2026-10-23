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
function fixture({ realRebinding = false } = {}) {
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
  const feature = w.BlockEditingFeature.create({ workspace, documentModel: document, ids, catalog, projections,
    instances: { geometryInstanceBundlesForScope: () => [], emptyGeometryInstanceBundle: () => ({}) }, rebinding,
    normalizedSketchCopy: sketch => ({ ...sketch, appearance: w.Appearance.normalizeAppearance(sketch.appearance) }),
    normalizeGeometryInstance: value => value, isDimensionConstraint: () => false, isReadOnlyDimension: () => false,
    numericDimensionExpression: c => String(c.target), ensureParameterNamespace() {},
    activeSketchId: () => workspace.current().activeSketchId, blockProjectionBundles: () => { assert.equal(state.ready, true); if (realRebinding) events.push('bundles'); return state.bundles; }, geometryElementKey: item => item.id,
    readViewport: () => { assert.equal(state.ready, true); return viewport; },
    activateScope: value => { events.push(['activate', value.id]); return workspace.activate(value); },
    reserveScopeSequences: value => events.push(['reserve', value.id]), createHistory: () => ({ id: ++state.history }),
  });
  function geometry(definition) {
    const a = Object.assign(new g.Point('P1', 0, 0), { sketchId: 'S1' }), b = Object.assign(new g.Point('P2', 10, 0), { sketchId: 'S1' });
    definition.points.push(a, b); definition.lines.push(Object.assign(new g.Line('L1', a, b), { sketchId: 'S1' }));
    definition.constraints.push(Object.assign(new g.DistanceConstraint(a, b, 10), { sketchId: 'S1' })); return a;
  }
  return { state, events, document, workspace, feature, geometry };
}

function commands(f, overrides = {}) {
  const selection = w.CanvasSelection.create();
  return { selection, ...f.feature.createCommands({
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
