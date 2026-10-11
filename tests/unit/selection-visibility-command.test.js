const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/selection_visibility_command.js'), 'utf8'), sandbox);
function fixture() {
  const calls = [], state = { geometry: true, editable: true, hidden: false, targets: [] };
  const command = sandbox.window.SelectionVisibilityCommand.create({
    isGeometryMode: () => state.geometry,
    selectedVisibilityTargets: () => { calls.push('targets'); return state.targets; },
    selectionVisibilityIsHidden: targets => { assert.equal(targets, state.targets); calls.push('hidden'); return state.hidden; },
    toggleSketchVisibility: id => { calls.push(['sketch', id]); return 'sketch-result'; },
    guardSelectionEdit: () => { calls.push('guard'); return state.editable; },
    applyMultipleProperty: (target, key, value, options) => { calls.push(['bulk', target, key, value, options.commit]); },
    applyAppearance: (target, input, options) => { calls.push(['appearance', target, input.category, input.key, input.value, options.commit]); },
    recordHistory: label => calls.push(['history', label]), updateUI: () => calls.push('ui'), draw: () => calls.push('draw'),
  });
  return { calls, state, command };
}
test('visibility stops before query outside geometry mode, and before mutations for empty or denied selection', () => {
  const f = fixture(); f.state.geometry = false; f.command.toggle(); assert.deepEqual(f.calls, []);
  f.state.geometry = true; f.command.toggle(); assert.deepEqual(f.calls, ['targets']);
  f.calls.length = 0; f.state.targets = [{ kind: 'geometry', item: {} }]; f.state.editable = false;
  f.command.toggle(); assert.deepEqual(f.calls, ['targets', 'guard']);
});
test('sketch visibility delegates directly, preserving return value and its own permission/history contract', () => {
  const f = fixture(); f.state.targets = [{ kind: 'sketch', item: { id: 'S2' } }]; f.state.editable = false;
  assert.equal(f.command.toggle(), 'sketch-result'); assert.deepEqual(f.calls, ['targets', ['sketch', 'S2']]);
});
test('mixed targets use bulk then instance overrides, preserving identity and one final history/update', () => {
  for (const hidden of [false, true]) {
    const f = fixture(), a = { kind: 'geometry', item: {} }, b = { kind: 'geometryInstance', item: {} }, c = { kind: 'constraint', item: {} }, d = { kind: 'geometryInstance', item: {} };
    f.state.targets = [b, a, d, c]; f.state.hidden = hidden; f.command.toggle();
    assert.deepEqual(f.calls.slice(0, 3), ['targets', 'guard', 'hidden']);
    const bulk = f.calls[3]; assert.equal(bulk[0], 'bulk'); assert.equal(bulk[1].kind, 'multiple');
    assert.deepEqual(Array.from(bulk[1].items), [a, c]); assert.deepEqual(bulk.slice(2), ['visible', hidden, false]);
    assert.deepEqual(f.calls.slice(4), [
      ['appearance', b, 'appearance', 'visible', String(hidden), false],
      ['appearance', d, 'appearance', 'visible', String(hidden), false],
      ['history', '選択図形の表示切替'], 'ui', 'draw',
    ]);
  }
});
test('instance-only selection skips bulk, ordinary-only selection skips instance writes', () => {
  for (const kind of ['geometryInstance', 'referenceImage']) {
    const f = fixture(); f.state.targets = [{ kind, item: {} }]; f.command.toggle();
    assert.equal(f.calls.filter(call => Array.isArray(call) && call[0] === 'bulk').length, kind === 'referenceImage' ? 1 : 0);
    assert.equal(f.calls.filter(call => Array.isArray(call) && call[0] === 'appearance').length, kind === 'geometryInstance' ? 1 : 0);
    assert.deepEqual(f.calls.slice(-3), [['history', '選択図形の表示切替'], 'ui', 'draw']);
  }
});
