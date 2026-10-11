const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const name of ['src/ui/parameter_dialog_controller.js', 'src/parameters/application.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', name), 'utf8'), sandbox);
function fixture() {
  const calls = [], marker = new Error('rejected'), original = { key: 'block:B1' };
  const draft = { current: original };
  const controls = { failed: false, hintError: false };
  const application = { apply(session, committed) { calls.push(['apply', session]); if (controls.failed) return { success: false, error: marker }; committed(); return { success: true }; } };
  const ports = { draft, application, recordHistory: label => calls.push(['history', label]),
    applicationText: (_ja, en) => en, setHint: (message, kind) => { calls.push(['hint', message, kind]); if (controls.hintError && kind !== 'error') throw marker; },
    loadScope: key => { calls.push(['load', key]); draft.current = { key: 'replacement' }; }, setError: text => calls.push(['error', text]),
    parameterErrorText: error => { assert.equal(error, marker); calls.push(['format']); return 'rejected'; }, updateUI: () => calls.push(['ui']), draw: () => calls.push(['draw']),
  };
  return { command: sandbox.window.ParameterDialogController.createApplication(ports), calls, draft, original, controls, ports, marker };
}
test('empty draft performs no application or dialog side effects', () => {
  const f = fixture(); f.draft.current = null; assert.equal(f.command.apply(), false); assert.deepEqual(f.calls, []);
});
test('successful application commits feedback inside callback and reloads the captured session scope', () => {
  const f = fixture(); assert.equal(f.command.apply(), true);
  assert.deepEqual(f.calls, [['apply', f.original], ['history', 'Parameter変更'], ['hint', 'Parameters applied', undefined], ['load', 'block:B1'], ['ui'], ['draw']]);
  assert.notEqual(f.draft.current, f.original);
});
test('failed application reloads scope before separate error formatting and preserves feedback order', () => {
  const f = fixture(); f.controls.failed = true; assert.equal(f.command.apply(), false);
  assert.deepEqual(f.calls, [['apply', f.original], ['load', 'block:B1'], ['format'], ['error', 'rejected'], ['format'], ['hint', 'rejected', 'error'], ['ui'], ['draw']]);
});
test('an exception in successful feedback remains inside ParameterApplication recovery, then reports failure', () => {
  const f = fixture(); const scope = { parameters: [{ name: 'old', expression: '1' }] };
  Object.assign(f.original, { namespace: scope, parameters: [{ name: 'width', expression: '12' }], dimensions: [] });
  f.ports.application = sandbox.window.ParameterApplication.create({
    namespace: { expressionFromUserInput: value => value, ensureParameterNamespace() {} }, currentScope: () => scope, acceptError: 1,
    capture: () => { f.calls.push(['capture']); return scope.parameters; }, restore: parameters => { f.calls.push(['restore']); scope.parameters = parameters; },
    stabilize: () => ({ success: true, result: { errorNorm: 0 } }), propagate: () => assert.fail('no stored scope propagation'), applicationText: (_ja, en) => en,
  });
  f.controls.hintError = true;
  const command = sandbox.window.ParameterDialogController.createApplication(f.ports);
  assert.equal(command.apply(), false); assert.equal(scope.parameters[0].name, 'old');
  assert.deepEqual(f.calls.map(call => call[0]), ['capture', 'history', 'hint', 'restore', 'load', 'format', 'error', 'format', 'hint', 'ui', 'draw']);
});
