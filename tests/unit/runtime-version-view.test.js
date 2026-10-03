const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/runtime_version_view.js'), 'utf8'), sandbox);
function fixture() {
  const state = { english: false, target: { dataset: {}, removeAttribute(key) { delete this[key]; } } };
  const view = sandbox.window.RuntimeVersionView.create({ document: { getElementById: () => state.target }, applicationText: (ja, en) => state.english ? en : ja });
  return { state, view };
}
const version = { available: true, branch: 'develop', commit: 'a'.repeat(40), shortCommit: 'a'.repeat(12), dirty: true };
test('validated build information survives language changes without reloading', () => {
  const { state, view } = fixture(); view.load(version);
  assert.equal(state.target.dataset.state, 'available');
  assert.equal(state.target.title, 'develop@' + version.commit);
  assert.equal(state.target.textContent, 'develop@' + version.shortCommit + '（変更あり）');
  state.english = true; view.render();
  assert.equal(state.target.textContent, 'develop@' + version.shortCommit + ' (dirty)');
  view.load({ ...version, branch: '', dirty: false });
  assert.equal(state.target.textContent, 'HEAD@' + version.shortCommit);
});
test('invalid or unavailable information clears stale commit details', () => {
  const { state, view } = fixture();
  for (const value of [undefined, { ...version, available: false }, { ...version, commit: 'bad' }, { ...version, shortCommit: 'xyzxyzxyz' }]) {
    view.load(version); view.load(value);
    assert.equal(state.target.dataset.state, 'unavailable');
    assert.equal(state.target.textContent, '取得できません');
    assert.equal(state.target.title, undefined);
  }
});
test('missing display element does not prevent loading and later rendering', () => {
  const { state, view } = fixture(); const target = state.target; state.target = null;
  view.load(version); state.target = target; view.render();
  assert.equal(target.dataset.state, 'available');
});
