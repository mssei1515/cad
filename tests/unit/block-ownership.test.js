const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/persistence/block_ownership.js'), 'utf8'), sandbox);
const restore = sandbox.window.BlockOwnershipPersistence.restore;
const definition = (id, children = []) => ({ id, name: id, parentDefinitionId: null, blockInstances: children.map(definitionId => ({ definitionId })) });
test('legacy ownership is inferred and repeated placements under one parent are allowed', () => {
  const definitions = [definition('parent', ['child', 'child']), definition('child'), definition('unused')];
  restore(definitions, () => ({}));
  assert.equal(definitions[1].parentDefinitionId, 'parent'); assert.equal(definitions[2].parentDefinitionId, null);
});
test('explicit ownership retains an unplaced child and normalizes parent ids', () => {
  const definitions = [definition('1'), definition('child')];
  restore(definitions, id => id === 'child' ? { parentDefinitionId: 1 } : { parentDefinitionId: null });
  assert.equal(definitions[1].parentDefinitionId, '1');
});
for (const [name, definitions, raw, message] of [
  ['multiple parents', [definition('a', ['c']), definition('b', ['c']), definition('c')], {}, /複数の親/],
  ['missing explicit parent', [definition('c')], { c: { parentDefinitionId: 'missing' } }, /親ブロックが見つかりません/],
  ['self parent', [definition('c')], { c: { parentDefinitionId: 'c' } }, /自身を親/],
  ['foreign placement', [definition('a', ['c']), definition('b'), definition('c')], { c: { parentDefinitionId: 'b' } }, /親ブロック以外/],
  ['explicit null is not inferred', [definition('a', ['c']), definition('c')], { c: { parentDefinitionId: null } }, /親ブロック以外/],
  ['instance cycle', [definition('a', ['b']), definition('b', ['a'])], {}, /循環参照.*a → b → a/],
]) {
  test(`ownership rejects ${name}`, () => assert.throws(() => restore(definitions, id => raw[id] || {}), message));
}
test('raw metadata is not mutated and disconnected nested trees are restored', () => {
  const definitions = [definition('a', ['b']), definition('b', ['c']), definition('c'), definition('x', ['y']), definition('y')];
  const raw = Object.freeze({}); restore(definitions, () => raw);
  assert.deepEqual(definitions.map(item => item.parentDefinitionId), [null, 'a', 'b', null, 'x']);
});
