const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/block_configuration_command.js'), 'utf8'), sandbox);
function fixture({ annotation = false, allowDeletion = true } = {}) {
  const removed = { id: 'C2', node: { id: 'B' } }, retained = { id: 'C1', node: { id: 'A' } };
  const model = { constraints: [retained, removed], annotations: annotation ? [{ id: 'N1', source: 'B' }] : [] };
  const instance = { id: 'BI1', definitionId: 'D1', enabledSketchIds: ['S1', 'S2'] }, calls = [];
  const selection = { dimensionConstraint: removed, constraint: removed, set(key, value) { this[key] = value; } };
  const bundle = ids => ({ points: [], lines: ids.map(id => ({ id })), circles: [], arcs: [], splines: [] });
  const command = sandbox.window.BlockConfigurationCommand.create({ currentScope: () => model,
    blockDefinitionById: () => ({ name: 'Part' }), blockProjectionBundle: () => bundle(['A', 'B']),
    createBlockProjectionBundle: (_item, _definition, ids) => bundle(ids.includes('S2') ? ['A', 'B'] : ['A']),
    blockDefinitionDrawableSketchIds: () => ['S1', 'S2'], blockDefinitionGeometrySketchIds: () => ['S1', 'S2'],
    constraintGraphNodes: constraint => [constraint.node], geometryRefKey: ref => ref, parseGeometryRefId: (kind, id) => `${kind}:${id}`,
    annotationReferencesRemovedGeometry: (item, ids) => ids.has(item.source), guardDimensionSymbolDeletion: () => allowDeletion,
    canvasSelection: selection, clearRemovedHover: constraints => { assert.equal(constraints.has(removed), true); calls.push('hover'); },
    invalidateBlockProjectionCache: () => calls.push('invalidate'), setHint: () => calls.push('hint'), updateBlockUI: () => calls.push('blockUI'),
    log: () => calls.push('log'), updateUI: () => calls.push('ui'), draw: () => calls.push('draw'), recordHistory: () => calls.push('history'),
  });
  return { command, instance, model, selection, calls, retained, removed };
}

test('disabling a sketch removes only affected constraints and clears their selection before one commit', () => {
  const f = fixture(); assert.equal(f.command.setEnabledSketchIds(f.instance, ['unknown', 'S1', 'S1']), true);
  assert.deepEqual(Array.from(f.instance.enabledSketchIds), ['S1']); assert.deepEqual(f.model.constraints, [f.retained]);
  assert.equal(f.selection.dimensionConstraint, null); assert.equal(f.selection.constraint, null);
  assert.deepEqual(f.calls, ['hover', 'invalidate', 'hint', 'log', 'ui', 'draw', 'history']);
});

test('annotation or parameter references reject configuration edits before any model or selection mutation', () => {
  for (const options of [{ annotation: true }, { allowDeletion: false }]) {
    const f = fixture(options); assert.equal(f.command.setEnabledSketchIds(f.instance, ['S1']), false);
    assert.deepEqual(f.instance.enabledSketchIds, ['S1', 'S2']); assert.equal(f.model.constraints.length, 2);
    assert.equal(f.selection.constraint, f.removed); assert.equal(f.calls.includes('history'), false); assert.equal(f.calls.includes('invalidate'), false);
    assert.equal(f.calls.at(-1), 'blockUI');
  }
});

test('a configuration without a drawable sketch is rejected without removing constraints', () => {
  const f = fixture(); assert.equal(f.command.setEnabledSketchIds(f.instance, ['unknown']), false);
  assert.deepEqual(f.instance.enabledSketchIds, ['S1', 'S2']); assert.equal(f.model.constraints.length, 2);
  assert.deepEqual(f.calls, ['hint', 'blockUI']);
});
