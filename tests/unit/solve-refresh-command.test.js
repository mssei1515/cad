const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/solve_refresh_command.js'), 'utf8'), sandbox);
function fixture() {
  const calls = [], result = {}, dependent = {}, analysis = {}, history = { restoring: false }, state = { active: 'A', solved: { success: true, result, dependent }, failure: null, restoreDuringDraw: false };
  const step = (name, value) => (...args) => { calls.push([name, ...args]); if (state.failure === name) throw Error(name); return value; };
  const command = sandbox.window.SolveRefreshCommand.create({ activeSketchId: () => { calls.push(['active']); return state.active; },
    stabilizeActiveParameterNamespace: (...args) => { calls.push(['solve', ...args]); if (state.failure === 'solve') throw Error('solve'); return state.solved; },
    refreshConstraintAnalysis: step('analysis', analysis), setSolveResultHint: step('hint'), updateUI: step('ui'),
    draw: () => { calls.push(['draw']); if (state.failure === 'draw') throw Error('draw'); if (state.restoreDuringDraw) history.restoring = true; },
    historyController: history, recordHistory: step('history'),
  });
  return { command, calls, state, result, dependent, analysis, history };
}
test('solve refresh retains active Sketch default, result refs and solve/analysis/hint/UI/draw/history order', () => {
  const h = fixture(); assert.equal(h.command.run(), h.result); assert.deepEqual(h.calls.map(c => c[0]), ['active', 'solve', 'analysis', 'hint', 'ui', 'draw', 'history']);
  assert.equal(h.calls[1][1], 'A'); const hint = h.calls[3]; assert.equal(hint[1], '自動solve'); assert.equal(hint[2], h.state.solved); assert.equal(hint[3], h.analysis); assert.equal(hint[4], h.dependent);
  assert.equal(JSON.stringify(h.calls[4][1]), '{"refreshAnalysis":false}'); assert.equal(h.calls.at(-1)[1], '自動solve');
  h.calls.length = 0; h.state.active = 'B'; h.command.run('edit'); assert.equal(h.calls[1][1], 'B'); assert.equal(h.calls.at(-1)[1], 'edit');
  h.calls.length = 0; h.command.run('explicit', null); assert.equal(h.calls[0][0], 'solve'); assert.equal(h.calls[0][1], null);
});
test('failed solve still updates presentation while restoration skips history based on current post-draw state', () => {
  const h = fixture(); h.state.solved.success = false; assert.equal(h.command.run('failure', 'target'), h.result);
  assert.deepEqual(h.calls.map(c => c[0]), ['solve', 'analysis', 'hint', 'ui', 'draw']);
  h.calls.length = 0; h.state.solved.success = true; h.history.restoring = true; h.command.run('restore'); assert.equal(h.calls.some(c => c[0] === 'history'), false);
  h.calls.length = 0; h.history.restoring = false; h.state.restoreDuringDraw = true; h.command.run('restore during draw'); assert.equal(h.calls.some(c => c[0] === 'history'), false);
});
test('solve refresh propagates each stage exception without later side effects or introducing rollback', () => {
  for (const failure of ['solve', 'analysis', 'hint', 'ui', 'draw', 'history']) {
    const h = fixture(); h.state.failure = failure; assert.throws(() => h.command.run('failure', 'target'), new RegExp(failure));
    const order = ['solve', 'analysis', 'hint', 'ui', 'draw', 'history']; assert.deepEqual(h.calls.map(c => c[0]), order.slice(0, order.indexOf(failure) + 1));
  }
});
