const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_ref.js', 'src/commands/block_completion_command.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
function scope() {
  return { points: [{ id: 'P1' }], lines: [{ id: 'L1' }], circles: [], arcs: [], splines: [], annotations: [], hatches: [], blockInstances: [], geometryInstances: [], constraints: [], activeSketchId: 'S1' };
}
function fixture({ selection = false, existing = false, overrides = {} } = {}) {
  const draft = { ...scope(), id: 'B1', name: 'Part', revision: 2 }, host = scope(), documentModel = { blockDefinitions: [] }, calls = [], hints = [];
  host.activeSketchId = 'HOST';
  const source = existing ? { ...draft, points: draft.points.slice(), lines: draft.lines.slice() } : null;
  if (source) documentModel.blockDefinitions.push(source);
  const internal = { id: 'internal' }, external = { id: 'external' }, unrelated = { id: 'unrelated' };
  host.constraints = [internal, external, unrelated];
  const creationSelection = selection ? { ...scope(), points: host.points.slice(), lines: host.lines.slice(), constraints: [internal], externalConstraints: [external] } : null;
  const session = { draft, sourceDefinition: source, originalElementIds: new Set(['P1', 'L1']), creationSelection,
    isNew: !existing, replacementCenter: { x: 30, y: 40 }, original: { values: { blockInstances: host.blockInstances } }, originalProjectionIds: new Set(), originalProjectionKeys: new Set() };
  const editor = { current: session, sync: () => calls.push('sync'), adoptChildChanges: () => calls.push('adopt') };
  let current = draft, allocated = 0, choiceCount = 0, resolveChoice, rejectChoice;
  const command = sandbox.window.BlockCompletionCommand.create({ blockEditor: editor, documentModel, currentScope: () => current,
    blockDefinitionEditing: { translate: (_draft, x, y) => calls.push(`translate:${x},${y}`), apply: (target, value) => { calls.push('apply'); return Object.assign(target, value); } },
    blockCatalog: { blockDefinitionById: () => ({ parentDefinitionId: 'B1' }), blockDefinitionDrawableSketchIds: () => ['S1'], blockDefinitionGeometrySketchIds: () => ['S1'] },
    blockDefinitionCyclePath: () => null, duplicateBlockElementId: () => null, refreshReferenceConstraintValidity: () => calls.push('references'), hasInvalidReferenceConstraints: () => false,
    solveSketchById: id => { calls.push(`solve:${id}`); return { success: true, errorNorm: 0 }; }, resultIsAccepted: result => result.errorNorm < 0.001, sketchName: id => id,
    solveReferenceDependentSketches: id => { calls.push(`dependent:${id}`); return { success: true }; },
    requestChoice: () => { choiceCount++; return new Promise((resolve, reject) => { resolveChoice = resolve; rejectChoice = reject; }); }, applicationText: (_ja, en) => en,
    blockLocalGeometryBounds: () => ({ center: { x: 7, y: 8 } }), storedBlockInstancesReferencing: () => host.blockInstances,
    restoreBlockEditorHost: () => { calls.push('restore'); current = host; editor.current = null; }, rebuildStoredBlockDefinitionConstraints: () => 0,
    nextInstanceId: () => `BI${++allocated}`, constraintGraphNodes: constraint => constraint.nodes || [],
    annotationReferencesRemovedGeometry: (annotation, ids) => ids.has(annotation.source), invalidateBlockProjectionCache: () => calls.push('invalidate'),
    blockProjectionBundles: () => [], geometryElementKey: item => item.id, blockDefinitionDependsOn: () => true, acceptError: 0.001,
    setSketchSolveOk: id => calls.push(`ok:${id}`), setSketchSolveError: id => calls.push(`error:${id}`), clearSelection: () => calls.push('clear'),
    canvasSelection: { set: (key, items) => { calls.push('select'); host.selected = items; } }, setMode: value => calls.push(`mode:${value}`),
    setHint: (text, level) => hints.push({ text, level }), log: text => calls.push(`log:${text}`), updateUI: () => calls.push('ui'), draw: () => calls.push('draw'), recordHistory: label => calls.push(`history:${label}`), ...overrides });
  return { command, draft, host, source, session, editor, documentModel, calls, hints, allocated: () => allocated, choices: () => choiceCount,
    resolve: value => resolveChoice(value), reject: () => rejectChoice(new Error('busy')) };
}
function assertNotCommitted(f) {
  assert.equal(f.editor.current, f.session);
  assert.equal(f.calls.includes('restore'), false);
  assert.equal(f.calls.some(call => call.startsWith('history:')), false);
  assert.equal(f.allocated(), 0);
}
test('Block completion rejects invalid structure, references and internal solves before restoring the host', () => {
  const cases = [
    { prepare: f => { f.draft.lines = []; }, message: /must contain/ },
    { overrides: { blockDefinitionCyclePath: () => ['B1', 'B1'] }, message: /循環/ },
    { overrides: { duplicateBlockElementId: () => 'P1' }, message: /重複/ },
    { overrides: { hasInvalidReferenceConstraints: () => true }, message: /無効/ },
    { overrides: { solveSketchById: () => ({ success: false, errorNorm: 2 }) }, message: /成立しません/ },
    { overrides: { solveReferenceDependentSketches: () => ({ success: false, sketchId: 'S2' }) }, message: /S2/ },
  ];
  for (const item of cases) {
    const f = fixture(item); item.prepare?.(f); f.command.complete();
    assertNotCommitted(f); assert.equal(f.documentModel.blockDefinitions.length, 0); assert.match(f.hints[0].text, item.message);
  }
});
test('Block completion refuses to remove every enabled Sketch of a stored instance', () => {
  const f = fixture({ existing: true }); f.host.blockInstances.push({ id: 'BI2', enabledSketchIds: ['removed'] });
  f.command.complete(); assertNotCommitted(f); assert.equal(f.calls.includes('apply'), false); assert.match(f.hints[0].text, /有効スケッチが空/);
});
test('rotation confirmation is exclusive and creation updates the restored host with one history entry', async () => {
  const f = fixture({ selection: true }); f.command.complete(); f.command.complete({ rotationLocked: true });
  assertNotCommitted(f); assert.equal(f.choices(), 1);
  f.resolve(false); await Promise.resolve();
  assert.equal(f.editor.current, null); assert.equal(f.allocated(), 1);
  assert.equal(f.documentModel.blockDefinitions[0], f.draft);
  assert.equal(f.host.lines.length, 0); assert.equal(f.draft.lines.length, 1);
  assert.equal(f.host.constraints.length, 1); assert.equal(f.host.constraints[0].id, 'unrelated');
  const instance = f.host.blockInstances[0];
  assert.equal(instance.rotationLocked, false); assert.equal(instance.sketchId, 'HOST');
  assert.equal(instance.x, 30); assert.equal(instance.y, 40); assert.equal(f.host.selected[0], instance);
  assert.equal(f.calls.filter(call => call.startsWith('history:')).length, 1);
  assert.deepEqual(f.calls.slice(-3), ['ui', 'draw', 'history:ブロック作成']);
  assert.equal(f.calls.includes('solve:HOST'), true);
});
test('confirmation cancellation, rejection and an obsolete session never commit', async () => {
  for (const outcome of ['cancel', 'reject', 'obsolete']) {
    const f = fixture({ selection: true }); f.command.complete();
    if (outcome === 'obsolete') f.editor.current = { ...f.session };
    if (outcome === 'reject') f.reject(); else f.resolve(outcome === 'cancel' ? null : true);
    await Promise.resolve();
    assert.equal(f.allocated(), 0); assert.equal(f.calls.includes('restore'), false);
    assert.equal(f.calls.some(call => call.startsWith('history:')), false);
    if (outcome === 'reject') assert.match(f.hints[0].text, /other confirmation dialog/);
    f.editor.current = f.session; f.command.complete({ rotationLocked: true });
    assert.equal(f.allocated(), 1);
  }
});
test('completion centers a new empty-editor definition without placing an instance', () => {
  const f = fixture(); f.command.complete();
  assert.equal(f.calls.includes('translate:-7,-8'), true);
  assert.equal(f.draft.origin.x, 0); assert.equal(f.draft.origin.y, 0);
  assert.equal(f.documentModel.blockDefinitions[0], f.draft);
  assert.equal(f.host.blockInstances.length, 0); assert.equal(f.allocated(), 0);
});
test('existing definition completion removes stale local and projected references and retains host solve errors', () => {
  const f = fixture({ existing: true, overrides: { solveSketchById: id => ({ success: id === 'S1', errorNorm: id === 'S1' ? 0 : 1 }) } });
  f.host.blockInstances.push({ id: 'BI1', definitionId: 'B1', sketchId: 'HOST', enabledSketchIds: ['S1', 'S2'] });
  f.session.originalElementIds.add('removedLocal');
  f.session.originalProjectionIds.add('oldProjection');
  f.host.constraints = [{ id: 'keep' }, { id: 'local', nodes: [{ blockDefinition: f.source, localElement: { id: 'removedLocal' } }] }, { id: 'projection', nodes: [{ id: 'oldProjection' }] }];
  f.host.annotations = [{ source: 'BI1@removedLocal' }, { source: 'oldProjection' }, { source: 'keep' }];
  f.command.complete();
  assert.equal(f.host.constraints.length, 1); assert.equal(f.host.constraints[0].id, 'keep');
  assert.equal(f.host.annotations.length, 1); assert.equal(f.host.annotations[0].source, 'keep');
  assert.equal(f.host.blockInstances[0].enabledSketchIds.length, 1);
  assert.equal(f.calls.includes('error:HOST'), true);
  assert.equal(f.calls.includes('history:ブロック定義編集'), true);
  assert.equal(f.editor.current, null); assert.equal(f.documentModel.blockDefinitions[0], f.source);
});
