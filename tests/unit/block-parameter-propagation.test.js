const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/parameters/block_propagation.js'), 'utf8'), sandbox);
function fixture(failure) {
  const child = { id: 'child', parentDefinitionId: 'parent', revision: '2' };
  const parent = { id: 'parent', parentDefinitionId: 'grand', revision: 4 };
  const grand = { id: 'grand', revision: 6 };
  const calls = [], result = where => ({ success: failure !== where, dependent: { success: failure !== `${where}-dependent` }, result: { reason: 'rejected' } });
  const propagation = sandbox.window.BlockParameterPropagation.create({
    catalog: { blockDefinitionById: id => failure === 'missing' ? null : [parent, grand].find(item => item.id === id) },
    invalidateProjection() { calls.push(`invalidate:${child.revision}/${parent.revision}/${grand.revision}`); },
    definitions: { rebuild(item) { calls.push(`rebuild:${item.id}`); }, stabilize(item) { calls.push(`solve:${item.id}`); return result(item.id); } },
    document: { rebuild() { calls.push('rebuild:document'); }, stabilize() { calls.push('solve:document'); return result('document'); } },
    applicationText: (_ja, en) => en,
  });
  return { child, parent, grand, calls, run: () => propagation.propagate(child) };
}
test('block parameter propagation rebuilds outward with cache invalidation before each consumer', () => {
  const f = fixture(); f.run();
  assert.deepEqual(f.calls, ['invalidate:3/4/6', 'rebuild:parent', 'solve:parent', 'invalidate:3/5/6',
    'rebuild:grand', 'solve:grand', 'invalidate:3/5/7', 'rebuild:document', 'solve:document']);
});
for (const failure of ['parent', 'parent-dependent', 'grand', 'document', 'document-dependent']) {
  test(`failed ${failure} propagation stops and leaves rollback to caller`, () => {
    const f = fixture(failure); assert.throws(f.run, /rejected/);
    assert.equal(f.child.revision, 3);
    if (failure.startsWith('parent')) { assert.equal(f.parent.revision, 4); assert.equal(f.calls.includes('rebuild:grand'), false); }
    if (failure === 'grand') { assert.equal(f.grand.revision, 6); assert.equal(f.calls.includes('rebuild:document'), false); }
    assert.equal(f.calls.at(-1), `solve:${failure.replace('-dependent', '')}`);
  });
}
test('missing parent is reported before reconstructing document constraints', () => {
  const f = fixture('missing'); assert.throws(f.run, /Parent block definition was not found/);
  assert.deepEqual(f.calls, ['invalidate:3/4/6']);
});
