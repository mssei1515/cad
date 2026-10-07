const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const vm = require('node:vm'); const path = require('node:path');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['history_controller.js','history_restoration.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/editing', file), 'utf8'), sandbox);
function fixture() {
  const state = { name: 'Current', construction: true, current: {}, calls: [] };
  const controller = sandbox.window.HistoryController.create({ documentHistory: {}, currentBlockHistory: () => null, changed: () => state.calls.push('changed'), log() {} });
  const restoration = sandbox.window.HistoryRestoration.create({ historyController: controller,
    document: { getName: () => state.name, setName: value => { state.name = value; }, load: (data, options) => { assert.equal(controller.restoring, true); state.loaded = data; state.options = options; state.calls.push('load'); if (state.fail) throw new Error('load failed'); state.name = 'Restored'; state.construction = false; } },
    constructionCommand: { get enabled() { return state.construction; }, restore: value => { state.construction = value; } },
    blockEditor: { get current() { return state.current; }, replaceDraft: value => { state.draft = value; state.calls.push('replace'); } },
    cloneBlockDefinition: value => JSON.parse(JSON.stringify(value)), invalidateBlockProjectionCache: () => state.calls.push('invalidate'),
    clearInteractionForSketchChange: () => state.calls.push('clear'), solveAndRefresh: label => { assert.equal(controller.restoring, true); state.calls.push('solve:' + label); }, setHint: label => state.calls.push('hint:' + label),
  }); return { state, controller, restoration };
}
test('document restoration preserves current name and authoring setting and retains tree state', () => {
  const f = fixture(); f.restoration.document('{"points":[]}', 'undo');
  assert.equal(f.state.name, 'Current'); assert.equal(f.state.construction, true);
  assert.equal(f.state.options.documentNameFallback, 'Current'); assert.equal(f.state.options.preserveSketchTreeState, true);
  assert.deepEqual(f.state.calls, ['load', 'clear', 'solve:undo', 'hint:undo', 'changed']); assert.equal(f.controller.restoring, false);
});
test('failed load releases history suppression and does not continue clearing or solving', () => {
  const f = fixture(); f.state.fail = true;
  assert.throws(() => f.restoration.document('{}', 'undo'), /load failed/);
  assert.deepEqual(f.state.calls, ['load', 'changed']); assert.equal(f.controller.restoring, false);
});
test('block restoration clones the definition, invalidates projections and rejects missing sessions', () => {
  const f = fixture(); const snapshot = { definition: { points: [{ x: 1 }] } };
  assert.equal(f.restoration.block(snapshot, 'redo'), true); assert.notEqual(f.state.draft, snapshot.definition);
  f.state.draft.points[0].x = 5; assert.equal(snapshot.definition.points[0].x, 1);
  assert.deepEqual(f.state.calls, ['replace', 'invalidate', 'clear', 'solve:redo', 'hint:redo', 'changed']);
  f.state.calls = []; f.state.current = null; assert.equal(f.restoration.block(snapshot, 'redo'), false);
  f.state.current = {}; assert.equal(f.restoration.block({}, 'redo'), false); assert.deepEqual(f.state.calls, []);
});
