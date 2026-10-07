const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.runInNewContext(fs.readFileSync('src/commands/annotation_parameter_command.js', 'utf8'), sandbox);
function fixture() {
  const item = { text: 'Label', parameterEnabled: false }, events = [];
  const state = { allowed: true, solved: { success: true }, hint: null };
  const command = sandbox.window.AnnotationParameterCommand.create({
    capture: () => { events.push('capture'); return structuredClone(item); },
    restore: snapshot => { events.push('restore'); for (const key of Object.keys(item)) delete item[key]; Object.assign(item, snapshot); },
    guardDimensionSymbolDeletion: items => { assert.equal(items[0], item); events.push('guard'); return state.allowed; },
    ensureParameter: target => { assert.equal(target, item); target.parameterName = 'A1'; events.push('ensure'); },
    renameParameter: (target, value) => { target.parameterName = value; events.push('rename'); },
    expressionFromUserInput: value => value.slice(1),
    stabilize: () => { events.push('solve'); return state.solved; },
    recordHistory: label => { assert.equal(label, '注記Parameter変更'); events.push('history'); },
    setHint: (message, kind) => { state.hint = { message, kind }; events.push('hint'); }, parameterErrorText: error => error.message,
  }); return { item, events, state, command };
}
test('enabling and disabling parameter mode transfers label text and commits only after solving', () => {
  const f = fixture(); assert.equal(f.command.commit(f.item, 'annotation-parameter-enabled', true), true);
  assert.equal(f.item.style.prefix, 'Label'); assert.equal(f.item.parameterName, 'A1'); assert.equal(f.item.parameterEnabled, true);
  assert.deepEqual(f.events, ['capture', 'ensure', 'solve', 'history']);
  f.events.length = 0; f.item.style.prefix = 'New label';
  assert.equal(f.command.commit(f.item, 'annotation-parameter-enabled', false), true);
  assert.equal(f.item.text, 'New label'); assert.equal(f.item.parameterEnabled, false);
  assert.deepEqual(f.events, ['capture', 'guard', 'solve', 'history']);
});
test('referenced parameter disable is rejected without editing, solving or recording history', () => {
  const f = fixture(); f.item.parameterEnabled = true; f.state.allowed = false;
  const before = structuredClone(f.item);
  assert.equal(f.command.commit(f.item, 'annotation-parameter-enabled', false), false);
  assert.deepEqual(f.item, before); assert.deepEqual(f.events, ['capture', 'guard']);
});
test('failed local or dependent solve restores annotation changes before showing the error', () => {
  for (const solved of [{ success: false, result: { reason: 'local' } }, { success: true, dependent: { success: false }, result: { reason: 'dependent' } }]) {
    const f = fixture(), before = structuredClone(f.item); f.state.solved = solved;
    assert.equal(f.command.commit(f.item, 'annotation-parameter-enabled', true), false);
    assert.deepEqual(f.item, before); assert.deepEqual(f.events, ['capture', 'ensure', 'solve', 'restore', 'hint']);
    assert.deepEqual(f.state.hint, { message: solved.result.reason, kind: 'error' });
  }
});
test('name and expression edits route through parameter rules and remain separate history commits', () => {
  const f = fixture(); assert.equal(f.command.commit(f.item, 'annotation-parameter-name', 'Length'), true);
  assert.equal(f.item.parameterName, 'Length'); assert.deepEqual(f.events, ['capture', 'rename', 'solve', 'history']);
  f.events.length = 0; assert.equal(f.command.commit(f.item, 'annotation-expression', '=2+3'), true);
  assert.equal(f.item.expression, '2+3'); assert.deepEqual(f.events, ['capture', 'solve', 'history']);
});
