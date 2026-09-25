const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['workspace', 'block_editor_session']) vm.runInContext(fs.readFileSync(`src/editing/${file}.js`, 'utf8'), sandbox);
function definition(id) {
  return { id, name: id, revision: 3, points: [], lines: [], circles: [], arcs: [], splines: [],
    annotations: [], hatches: [], referenceImages: [], blockInstances: [], geometryInstances: [],
    constraints: [], parameters: [], sketches: [{ id: 'S1' }], activeSketchId: 'S1', nextHatchIndex: 1, nextDimensionParameterIndex: 1 };
}
function fixture() {
  const document = { ...definition('document'), blockDefinitions: [] }, calls = [];
  const workspace = sandbox.window.EditingWorkspace.create(document);
  let viewport = { x: 1, y: 2, scale: 3 }, historyId = 0;
  const editor = sandbox.window.BlockEditorSession.create({ currentScope: workspace.current, documentModel: document,
    hatchSequence: () => 8, normalizedSketchCopy: sketch => ({ ...sketch, normalized: true }), activeSketchId: () => workspace.current().activeSketchId,
    blockProjectionBundles: () => [{ points: [{ id: 'BI1/P1' }], lines: [], circles: [], arcs: [] }], geometryElementKey: item => `point:${item.id}`,
    captureHost: () => ({ ...workspace.capture(), viewport: { ...viewport } }),
    restoreHostState: original => { workspace.restore(original); viewport = original.viewport; },
    activateScope: workspace.activate, reserveScopeSequences: scope => calls.push(['reserve', scope.id]),
    cloneBlockDefinition: structuredClone, createHistory: () => ({ id: ++historyId }),
    mergeBlockDefinitionDraft: (target, draft) => { Object.assign(target, structuredClone(draft)); target.revision += 1; },
    rebuildStoredBlockDefinitionConstraints: () => calls.push('rebuild'), invalidateBlockProjectionCache: () => calls.push('invalidate') });
  return { document, editor, workspace, calls, view: () => viewport, setView: value => { viewport = value; } };
}
test('nested Block editing restores exact host scope, viewport and independent history', () => {
  const f = fixture(), outer = definition('outer'), inner = definition('inner');
  const first = f.editor.open(outer);
  f.setView({ x: 20, y: 30, scale: 4 });
  const points = [{ id: 'P1' }]; f.workspace.current().points = points;
  const sketches = outer.sketches;
  const second = f.editor.open(inner);
  assert.equal(second.parentSession, first);
  assert.notEqual(first.history, second.history);
  assert.equal(outer.points, points);
  assert.notEqual(outer.sketches, sketches);
  assert.equal(outer.nextHatchIndex, 8);
  assert.equal(second.originalProjectionIds.has('BI1/P1'), true);
  assert.equal(second.originalProjectionKeys.has('point:BI1/P1'), true);
  f.editor.restoreHost(second);
  assert.equal(f.workspace.current(), outer);
  assert.equal(f.editor.current, first);
  assert.equal(f.workspace.current().points, points);
  assert.deepEqual(f.view(), { x: 20, y: 30, scale: 4 });
  f.editor.restoreHost(first);
  assert.equal(f.workspace.current(), f.document);
  assert.equal(f.editor.current, null);
  assert.deepEqual(f.view(), { x: 1, y: 2, scale: 3 });
});
test('parent cancellation removes completed descendants and restores earliest definition identities in registry order', () => {
  const f = fixture(), a = definition('A'), b = definition('B'), outer = definition('outer'), child = definition('child');
  f.document.blockDefinitions = [a, b];
  const parent = f.editor.open(outer, { definitionRollbackEntries: [['A', { definition: a, index: 0 }]] });
  const intermediateA = definition('A'); intermediateA.name = 'intermediate';
  const nested = f.editor.open(child, { isNew: true, initialTransientDefinitionIds: ['grandchild'],
    definitionRollbackEntries: [['B', { definition: b, index: 1 }], ['A', { definition: intermediateA, index: 0 }]] });
  f.editor.restoreHost(nested);
  f.document.blockDefinitions = [intermediateA, child, definition('grandchild')];
  f.editor.adoptChildChanges(nested, child.id, false);
  assert.equal(f.editor.isTransient(child.id), true);
  f.editor.restoreHost(parent); f.editor.rollback(parent);
  assert.equal(f.document.blockDefinitions.length, 2);
  assert.equal(f.document.blockDefinitions[0], a);
  assert.equal(f.document.blockDefinitions[1], b);
  assert.equal(f.calls.includes('rebuild'), true);
});
test('draft replacement keeps session history, cancellation restores source revision, reset only drops session', () => {
  const f = fixture(), source = definition('existing'); f.document.blockDefinitions.push(source);
  const session = f.editor.open(structuredClone(source), { sourceDefinition: source });
  const restored = definition('existing'); restored.name = 'undo';
  const history = session.history;
  f.editor.replaceDraft(restored);
  assert.equal(f.workspace.current(), restored);
  assert.equal(f.editor.current.history, history);
  f.editor.rename(''); assert.equal(restored.name, 'undo');
  f.editor.rename('renamed'); assert.equal(restored.name, 'renamed');
  const live = f.editor.live(); assert.equal(live.points, restored.points); assert.notEqual(live, restored);
  source.name = 'changed'; source.revision = 99;
  f.editor.restoreHost(session); f.editor.rollback(session);
  assert.equal(f.document.blockDefinitions[0], source);
  assert.equal(source.name, 'existing'); assert.equal(source.revision, 3);
  assert.equal(f.editor.rename('outside'), false);
  f.editor.open(definition('other')); f.editor.reset();
  assert.equal(f.editor.current, null);
  assert.equal(f.workspace.current().id, 'other');
});
test('completed edits to an existing non-transient child survive cancellation of its parent', () => {
  const f = fixture(), source = definition('child'), descendant = definition('new-descendant');
  f.document.blockDefinitions = [source];
  const parent = f.editor.open(definition('parent'));
  const nested = f.editor.open(structuredClone(source), { sourceDefinition: source, initialTransientDefinitionIds: [descendant.id] });
  f.editor.restoreHost(nested);
  source.name = 'completed child'; f.document.blockDefinitions.push(descendant);
  f.editor.adoptChildChanges(nested, source.id, true);
  assert.equal(f.editor.isTransient(descendant.id), false);
  f.editor.restoreHost(parent); f.editor.rollback(parent);
  assert.equal(f.document.blockDefinitions[0], source);
  assert.equal(source.name, 'completed child');
  assert.equal(f.document.blockDefinitions[1], descendant);
});
test('definition deletion forgets transient ids in every active ancestor without removing other rollback records', () => {
  const f = fixture(), original = definition('removed');
  const parent = f.editor.open(definition('parent'), { initialTransientDefinitionIds: ['removed', 'keep'],
    definitionRollbackEntries: [['removed', { definition: original, index: 0 }]] });
  const child = f.editor.open(definition('child'), { initialTransientDefinitionIds: ['removed'] });
  f.editor.forgetDefinitions(new Set(['removed']));
  assert.equal(parent.transientDefinitionIds.has('removed'), false);
  assert.equal(child.transientDefinitionIds.has('removed'), false);
  assert.equal(parent.transientDefinitionIds.has('keep'), true);
  assert.equal(parent.definitionRollbackEntries.get('removed').definition, original);
});
