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
function fixture() {
  const document = { ...scope('host'), blockDefinitions: [] }, workspace = w.EditingWorkspace.create(document);
  const state = { ready: false, definitionSeq: 1, hatchSeq: 8, history: 0, viewport: { x: 1, y: 2, scale: 3 }, snapshotError: null };
  const events = [];
  const viewport = { snapshot() { assert.equal(this, viewport); assert.equal(state.ready, true);
    events.push('capture-view'); if (state.snapshotError) throw state.snapshotError; return { ...state.viewport }; },
    update(value) { assert.equal(this, viewport); events.push('restore-view'); state.viewport = { ...value }; } };
  const ids = { peek(kind) { assert.equal(this, ids); assert.equal(state.ready, true); assert.equal(kind, 'hatch'); return state.hatchSeq; },
    allocate(kind) { assert.equal(this, ids); assert.equal(state.ready, true); assert.equal(kind, 'blockDefinition'); return `BD${state.definitionSeq++}`; } };
  const catalog = w.BlockCatalog.create({ definitions: () => { assert.equal(state.ready, true); return document.blockDefinitions; } });
  const feature = w.BlockEditingFeature.create({ workspace, documentModel: document, ids, catalog,
    projections: { createBlockProjectionBundle() { throw Error('no nested Block expected in this fixture'); },
      invalidateBlockProjectionCache: () => events.push('invalidate') },
    instances: { geometryInstanceBundlesForScope: () => [], emptyGeometryInstanceBundle: () => ({}) },
    rebinding: { cloneForBlock: (constraint, points) => {
      events.push('clone-constraint'); const clone = new g.DistanceConstraint(points.get(constraint.p1.id), points.get(constraint.p2.id), constraint.target);
      clone.sketchId = constraint.sketchId; return clone;
    } },
    normalizedSketchCopy: sketch => ({ ...sketch, appearance: w.Appearance.normalizeAppearance(sketch.appearance) }),
    normalizeGeometryInstance: value => value, isDimensionConstraint: () => false, isReadOnlyDimension: () => false,
    numericDimensionExpression: c => String(c.target), ensureParameterNamespace() {},
    activeSketchId: () => workspace.current().activeSketchId, blockProjectionBundles: () => [], geometryElementKey: item => item.id,
    readViewport: () => { assert.equal(state.ready, true); return viewport; },
    activateScope: value => { events.push(['activate', value.id]); return workspace.activate(value); },
    reserveScopeSequences: value => events.push(['reserve', value.id]), createHistory: () => ({ id: ++state.history }),
    rebuildStoredBlockDefinitionConstraints: () => events.push('rebuild-stored'),
    rebuildBlockDefinitionConstraintObjects: value => events.push(['rebuild', value.id]),
  });
  function geometry(definition) {
    const a = Object.assign(new g.Point('P1', 0, 0), { sketchId: 'S1' }), b = Object.assign(new g.Point('P2', 10, 0), { sketchId: 'S1' });
    definition.points.push(a, b); definition.lines.push(Object.assign(new g.Line('L1', a, b), { sketchId: 'S1' }));
    definition.constraints.push(Object.assign(new g.DistanceConstraint(a, b, 10), { sketchId: 'S1' })); return a;
  }
  return { state, events, document, workspace, feature, geometry };
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
  assert.equal(f.feature.queries.blockDefinitionsInCurrentScope()[0], child); assert.equal(f.events.includes('rebuild-stored'), true);
});

test('host capture failure propagates before opening a session, switching scope or creating history', () => {
  const f = fixture(); f.state.ready = true; const failure = new Error('viewport unavailable'); f.state.snapshotError = failure;
  assert.throws(() => f.feature.session.open(scope('draft')), error => error === failure);
  assert.equal(f.feature.session.current, null); assert.equal(f.workspace.current(), f.document); assert.equal(f.state.history, 0);
  assert.deepEqual(f.events, ['capture-view']);
});
