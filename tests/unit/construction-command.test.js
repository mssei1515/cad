const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/construction_command.js'), 'utf8'), sandbox);
function fixture() {
  const calls = [], state = { selected: [], allowed: true }; const record = name => () => calls.push(name);
  const deps = { selectedConstructionTogglePrimitives: () => state.selected,
    guardSketchProjectionShapeEdit: (items, options) => { assert.equal(items, state.selected); assert.equal(options.includeSharedNodes, false); return state.allowed; }, applicationText: text => text };
  for (const name of ['cancelConstraintTargetCommand', 'synchronizeSketchProjectionMetadata', 'setHint', 'clearSelection', 'updateUI', 'draw', 'recordHistory', 'setLineMode', 'resetLineInputs', 'clearSnap', 'updateToolbar']) deps[name] = record(name);
  return { command: sandbox.window.ConstructionCommand.create(deps), state, calls };
}
test('unselected toggle owns the future construction preference without document history', () => {
  const f = fixture(); f.command.toggle(); assert.equal(f.command.enabled, true);
  assert.deepEqual(f.calls, ['cancelConstraintTargetCommand', 'setLineMode', 'resetLineInputs', 'clearSnap', 'updateToolbar', 'setHint', 'draw']);
  f.command.toggle(); assert.equal(f.command.enabled, false);
});
test('mixed selection toggles all primitives together and preserves future drawing preference', () => {
  const f = fixture(); const a = { construction: true }, b = { construction: false }; f.state.selected = [a, b];
  assert.equal(f.command.state(true).active, false); f.command.toggle();
  assert.equal(a.construction, true); assert.equal(b.construction, true); assert.equal(f.command.enabled, false);
  assert.deepEqual(f.calls, ['cancelConstraintTargetCommand', 'synchronizeSketchProjectionMetadata', 'setHint', 'clearSelection', 'updateUI', 'draw', 'recordHistory']);
  assert.equal(f.command.state(true).active, true); f.command.toggle(); assert.equal(a.construction, false); assert.equal(b.construction, false);
});
test('projection guard rejects mutation without resetting inputs or recording history', () => {
  const f = fixture(); const item = { construction: false }; f.state.selected = [item]; f.state.allowed = false;
  f.command.toggle(); assert.equal(item.construction, false); assert.deepEqual(f.calls, ['cancelConstraintTargetCommand', 'draw']);
});
test('silent preference restore and nongeometry presentation keep the existing view contract', () => {
  const f = fixture(); f.command.restore(true); assert.deepEqual(f.calls, []);
  assert.equal(f.command.state(true).active, true); assert.equal(f.command.state(false).active, false);
  f.state.selected = [{ construction: false }]; assert.equal(f.command.state(true).active, false);
  assert.equal(f.command.state(true).mixed, false); f.command.restore(false); assert.equal(f.command.enabled, false);
});
