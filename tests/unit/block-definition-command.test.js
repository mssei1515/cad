const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/commands/block_definition_command.js', 'utf8'), sandbox);
function scope(fields = {}) {
  return { id: 'new', name: 'Block-5', lines: [], circles: [], arcs: [], splines: [], annotations: [], hatches: [], referenceImages: [], blockInstances: [], geometryInstances: [], constraints: [], ...fields };
}
function fixture(overrides = {}) {
  const calls = [], hints = [], selectedLine = { id: 'L1' }, internal = {}, external = {};
  const selection = { ...scope({ lines: [selectedLine], constraints: [internal] }), externalConstraints: [external] };
  const canvasSelection = scope(), host = scope(), source = scope({ id: 'stored', name: 'Stored', lines: [selectedLine] });
  const documentModel = { blockDefinitions: [source] }, original = { captured: true }, staged = new Map([['child', { index: 0 }]]);
  let current = host, opened, parent = null;
  const editor = { current: null, scopeId: () => 'parent',
    stageChildren: () => { calls.push('stage'); return staged; },
    open(draft, options) { calls.push('open'); opened = { draft, options }; this.current = { draft, sourceDefinition: options.sourceDefinition, creationSelection: options.creationSelection, parentSession: parent }; current = draft; },
    restoreHost(session) { calls.push('restore'); this.current = session.parentSession; current = host; },
    rollback: () => calls.push('rollback'), forgetDefinitions: ids => calls.push(`forget:${Array.from(ids).join(',')}`) };
  const queries = { selectedBlockDefinitionMoveError: () => null, blockDefinitionScopeError: () => null, blockDefinitionEditError: () => null };
  const command = sandbox.window.BlockDefinitionCommand.create({ blockEditor: editor, documentModel, currentScope: () => current,
    blockDefinitionEditing: { fromSelection: (_selection, origin, name) => { calls.push('fromSelection'); return scope({ lines: [selectedLine], name, origin }); },
      empty: name => { calls.push('empty'); return scope({ name }); }, clone: definition => { calls.push('clone'); return { ...definition, lines: definition.lines.slice() }; } },
    blockCatalog: { blockDefinitionById: id => documentModel.blockDefinitions.find(item => item.id === id), blockDefinitionOwnedSubtreeIds: id => new Set([...id, 'child']) },
    blockEditingQueries: queries, canStartCreation: () => true, canvasSelection, captureHost: () => { calls.push('capture'); return original; }, defaultName: () => 'Block-5',
    blockSelectionGeometry: () => selection, blockSelectionBoundsCenter: () => ({ x: 4, y: 5 }), guardDimensionSymbolDeletion: constraints => { assert.equal(constraints.has(internal), true); assert.equal(constraints.has(external), true); return true; },
    resetBlockEditorHistory: () => calls.push('historyReset'), clearSelection: () => calls.push('clear'), setMode: value => calls.push(`mode:${value}`),
    closeDefinitions: () => calls.push('close'), setEditorActive: value => calls.push(`active:${value}`), fitAllGeometryToViewport: () => calls.push('fit'), resetEmptyViewport: () => calls.push('emptyViewport'),
    promptName: () => ' renamed ', invalidateBlockProjectionCache: () => calls.push('invalidate'), updateBlockUI: () => calls.push('blockUI'), updateUI: () => calls.push('ui'), draw: () => calls.push('draw'), recordHistory: label => calls.push(`history:${label}`), setHint: text => hints.push(text), ...overrides });
  return { command, calls, hints, canvasSelection, host, source, documentModel, editor, queries, original, staged, selection,
    opened: () => opened, setParent: value => { parent = value; } };
}
test('creation captures host before staging and opens a selected draft with its rollback information', () => {
  const f = fixture(); f.canvasSelection.lines.push({ id: 'selected' }); f.command.startCreation();
  const { draft, options } = f.opened();
  assert.equal(options.originalHost, f.original); assert.equal(options.definitionRollbackEntries, f.staged);
  assert.equal(options.creationSelection, f.selection); assert.equal(options.replacementCenter.x, 4); assert.equal(draft.parentDefinitionId, 'parent');
  assert.deepEqual(f.calls.slice(0, 5), ['close', 'capture', 'fromSelection', 'stage', 'open']);
  assert.deepEqual(f.calls.slice(5), ['historyReset', 'clear', 'mode:select', 'active:true', 'fit', 'ui', 'draw']);
  assert.match(f.hints[0], /拘束1件/);
});
test('creation guards leave sessions and history untouched', () => {
  const cases = {
    mode: { canStartCreation: () => false },
    selection: { blockSelectionGeometry: () => ({ error: 'invalid selection' }) },
    move: { blockEditingQueries: { selectedBlockDefinitionMoveError: () => 'cannot move' } },
    symbol: { guardDimensionSymbolDeletion: () => false },
  };
  for (const [kind, overrides] of Object.entries(cases)) {
    const f = fixture(overrides); f.canvasSelection.lines.push({}); f.command.startCreation();
    assert.equal(f.editor.current, null); assert.equal(f.calls.includes('open'), false);
    assert.equal(f.calls.some(call => call.startsWith('history:')), false);
    if (kind === 'mode') assert.equal(f.calls.length, 0);
  }
});
test('empty and image-only editors preserve their distinct viewport rules', () => {
  const f = fixture(); f.command.startCreation();
  assert.equal(f.calls.includes('empty'), true); assert.equal(f.calls.includes('stage'), false); assert.equal(f.calls.includes('emptyViewport'), true);
  assert.equal(f.opened().options.definitionRollbackEntries.size, 0);
  const image = fixture(); image.command.open(scope({ referenceImages: [{}] }));
  assert.equal(image.calls.includes('fit'), true); assert.equal(image.calls.includes('emptyViewport'), false);
});
test('enter clones the source and nested cancellation restores host and editor state without recording history', () => {
  const f = fixture(), parent = { draft: scope() }; f.setParent(parent);
  f.command.enter('stored');
  assert.notEqual(f.opened().draft, f.source); assert.equal(f.opened().options.sourceDefinition, f.source);
  f.calls.length = 0; f.command.cancel();
  assert.equal(f.editor.current, parent);
  assert.deepEqual(f.calls, ['restore', 'active:true', 'rollback', 'clear', 'mode:select', 'ui', 'draw']);
});
test('rename trims accepted input and only records an accepted change', () => {
  for (const value of [null, '   ']) {
    const f = fixture({ promptName: () => value }); f.command.rename('stored');
    assert.equal(f.source.name, 'Stored'); assert.equal(f.calls.length, 0);
  }
  const f = fixture(); f.command.rename('stored');
  assert.equal(f.source.name, 'renamed'); assert.deepEqual(f.calls, ['blockUI', 'history:ブロック名変更']);
});
test('deletion protects used definitions and removes only the owned subtree with session cleanup', () => {
  const f = fixture(); f.documentModel.blockDefinitions.push(scope({ id: 'child' }), scope({ id: 'other' }));
  f.host.blockInstances.push({ definitionId: 'stored' }); f.command.remove('stored');
  assert.equal(f.documentModel.blockDefinitions.length, 3); assert.equal(f.calls.length, 0); assert.match(f.hints[0], /使用中/);
  f.host.blockInstances = []; f.command.remove('stored');
  assert.equal(f.documentModel.blockDefinitions.length, 1); assert.equal(f.documentModel.blockDefinitions[0].id, 'other');
  assert.deepEqual(f.calls, ['forget:stored,child', 'invalidate', 'blockUI', 'draw', 'history:ブロック定義削除']);
});
