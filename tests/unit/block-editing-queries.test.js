const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/document/appearance.js', 'src/document/sketch_hierarchy.js', 'src/document/block_catalog.js', 'src/editing/block_editing_queries.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
const definition = (id, instances = [], parentDefinitionId = null) => ({ id, name: id, parentDefinitionId, blockInstances: instances });
const instance = (id, definitionId) => ({ id, definitionId });
function fixture(definitions) {
  const state = { definitions, scope: { blockInstances: [] }, sessions: [] };
  const catalog = sandbox.window.BlockCatalog.create({ definitions: () => state.definitions });
  const queries = sandbox.window.BlockEditingQueries.create({ definitions: () => state.definitions, currentScope: () => state.scope, catalog,
    editor: { chain: () => state.sessions, scopeId: () => state.sessions[0]?.draft.id || null } });
  return { state, catalog, queries };
}
test('dependency queries prefer current drafts, detect cycles and tolerate missing definitions', () => {
  const storedA = definition('A', [instance('AB', 'B')]), storedB = definition('B');
  const f = fixture([storedA, storedB]);
  assert.equal(f.queries.blockDefinitionDependsOn('A', 'B'), true);
  const draft = definition('A'); f.state.sessions = [{ draft }];
  assert.equal(f.queries.blockDefinitionDependsOn('A', 'B'), false);
  draft.blockInstances.push(instance('AB', 'B'));
  f.state.sessions.unshift({ draft: definition('B', [instance('BA', 'A')]) });
  assert.deepEqual(Array.from(f.queries.blockDefinitionCyclePath('A')), ['A', 'B', 'A']);
  assert.equal(f.queries.blockDefinitionDependsOn('A', 'unrelated'), false);
  assert.equal(f.queries.blockDefinitionCyclePath('missing'), null);
  assert.equal(storedB.blockInstances.length, 0);
  f.state.sessions = [];
  assert.equal(f.queries.blockDefinitionCyclePath('A'), null);
});
test('scope availability follows stored parent ownership while edit guards use session names', () => {
  const root = definition('A'), child = definition('B', [], 'A'), sibling = definition('C');
  const f = fixture([root, child, sibling]);
  assert.deepEqual(Array.from(f.queries.blockDefinitionsInCurrentScope(), item => item.id), ['A', 'C']);
  f.state.sessions = [{ draft: { ...root, name: 'draft name' } }];
  assert.deepEqual(Array.from(f.queries.blockDefinitionsInCurrentScope(), item => item.id), ['B']);
  assert.equal(f.queries.blockDefinitionScopeError('B'), null);
  assert.match(f.queries.blockDefinitionScopeError('C'), /現在の階層/);
  assert.match(f.queries.blockDefinitionScopeError('missing'), /見つかりません/);
  assert.match(f.queries.blockDefinitionEditError('A'), /draft name/);
  assert.equal(f.queries.blockDefinitionEditError('B'), null);
  f.state.definitions = [definition('D', [], 'A')];
  assert.equal(f.queries.blockDefinitionsInCurrentScope()[0].id, 'D');
});
test('instance lookup deduplicates identities across scopes, and explicit host lists exclude editor scopes', () => {
  const shared = instance('I1', 'A'), sameId = instance('I1', 'A'), saved = instance('saved', 'A'), ancestor = instance('ancestor', 'A');
  const f = fixture([definition('container', [shared, saved])]);
  f.state.scope.blockInstances = [shared, sameId];
  f.state.sessions = [{ draft: definition('editing', [shared]), original: { values: { blockInstances: [ancestor] } } }];
  const all = f.queries.storedBlockInstancesReferencing('A');
  assert.equal(all.length, 4); assert.equal(all[0], shared); assert.equal(all[1], sameId);
  assert.equal(f.queries.blockDefinitionUsageCount('A'), 2);
  assert.deepEqual(Array.from(f.queries.storedBlockInstancesReferencing('A', [])), [shared, saved]);
  f.state.scope = { blockInstances: [ancestor] };
  assert.equal(f.queries.blockDefinitionUsageCount('A'), 1);
});
test('moving definitions requires every local instance by identity, not merely matching ids', () => {
  const first = instance('I1', 'A'), second = instance('I2', 'A'), f = fixture([definition('A')]);
  f.state.scope.blockInstances = [first, second];
  assert.match(f.queries.selectedBlockDefinitionMoveError({ blockInstances: [first] }), /I2/);
  assert.match(f.queries.selectedBlockDefinitionMoveError({ blockInstances: [{ ...first }, second] }), /I1/);
  assert.equal(f.queries.selectedBlockDefinitionMoveError({ blockInstances: [first, second] }), null);
  assert.match(f.queries.selectedBlockDefinitionMoveError({ blockInstances: [instance('IX', 'missing')] }), /見つかりません/);
});
test('owned subtrees use parent links independently of registry order and terminate on cyclic ownership', () => {
  const f = fixture([definition('grand', [], 'child'), definition('child', [], 'root'), definition('root'), definition('other')]);
  const result = f.catalog.blockDefinitionOwnedSubtreeIds(['root']);
  assert.deepEqual(Array.from(result).sort(), ['child', 'grand', 'root']);
  f.state.definitions = [definition('A', [], 'B'), definition('B', [], 'A')];
  assert.deepEqual(Array.from(f.catalog.blockDefinitionOwnedSubtreeIds(['A'])), ['A', 'B']);
  assert.equal(f.catalog.blockDefinitionOwnedSubtreeIds(['unknown']).has('unknown'), true);
});
test('Sketch rows retain hierarchy and count drawable objects rather than support points', () => {
  const f = fixture([]), child = { id: 'S2', parentSketchId: 'S1', kind: 'sketch' }, parent = { id: 'S1', parentSketchId: 'ROOT', kind: 'sketch' };
  const data = { sketches: [child, { id: 'ROOT', kind: 'root' }, parent], points: [{ sketchId: 'S1' }], lines: [{ sketchId: 'S1' }], circles: [], arcs: [],
    splines: [{ sketchId: 'S2' }], annotations: [{ sketchId: 'S2' }], hatches: [{ sketchId: 'S2' }], blockInstances: [{ sketchId: 'S1' }], geometryInstances: [{ sketchId: 'S2' }] };
  const before = JSON.stringify(data), rows = f.catalog.blockDefinitionSketchRows(data);
  assert.equal(rows[0].sketch, parent); assert.equal(rows[0].depth, 0); assert.equal(rows[0].count, 2);
  assert.equal(rows[1].sketch, child); assert.equal(rows[1].depth, 1); assert.equal(rows[1].count, 4);
  assert.equal(JSON.stringify(data), before); assert.equal(f.catalog.blockDefinitionSketchRows(null).length, 0);
});
