const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const test = require('node:test');
function fixture() {
  const events = [], applyButton = new EventTarget(), openButton = new EventTarget();
  const state = { model: { parameters: [{ name: 'width' }], symbols: [{ parameterName: 'd1' }] }, definitions: [], editing: null, language: 'ja', ready: false, outcome: { success: true } };
  let namesForInput, rendered;
  const draft = { current: null, open(scope) { this.current = { ...scope, parameters: scope.namespace.parameters || [], dimensions: [] }; },
    evaluate: () => ({}), isDirty: () => false, close() { this.current = null; } };
  const document = { getElementById: id => ({ parametersBtn: openButton, applyParametersBtn: applyButton })[id] || null };
  const sandbox = { window: {
    ParameterDialogDraft: { create: () => draft },
    ExpressionInputView: { create: options => { namesForInput = options.referenceNamesForInput; return { sync() {}, install() {}, refresh() {} }; }, createInsertion: () => ({ insert() {} }) },
    ParameterDialogView: { create: () => ({ render(value) { rendered = value; events.push('render'); }, setError: error => events.push(['error', error]) }) },
  } }; vm.createContext(sandbox);
  for (const file of ['src/ui/parameter_dialog_controller.js', 'src/application/parameter_editor.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox);
  function read(value) { assert.equal(state.ready, true, 'no eager scope lookup'); return value; }
  const namespace = { symbolElementsInNamespace: model => model.symbols || [] };
  const editor = sandbox.window.ParameterEditor.create({ document, window: { confirm: () => true }, InputElement: class {}, Event,
    namespace, currentScope: () => read(state.model), readDefinitions: () => read(state.definitions), readBlockEditor: () => read(state.editing),
    applicationText: (ja, en) => state.language === 'en' ? en : ja, language: () => state.language,
    formatting: { escapeHtml: String, formatDisplayNumber: String, formatParameterReference: String, parameterErrorText: error => error.message, defaultSketchId: 'S1' },
    localizeApplicationUI() {}, applyDraft(session, committed) { events.push('apply'); assert.equal(session, draft.current); if (state.outcome.success) committed(); return state.outcome; },
    recordHistory: label => events.push(['history', label]), setHint: (...args) => events.push(['hint', ...args]), updateUI: () => events.push('ui'), draw: () => events.push('draw'), pickDimension() {},
  });
  assert.deepEqual(events, []); state.ready = true;
  return { editor, state, draft, events, openButton, applyButton, names: input => Array.from(namesForInput(input)), rendered: () => rendered };
}

test('parameter editor binds once, reads live scopes and language, and disposes its dialog listeners', () => {
  const f = fixture(), definition = { id: 'B2', name: 'Part', parameters: [] };
  f.state.definitions = [definition]; f.editor.start(); f.editor.start();
  f.openButton.dispatchEvent(new Event('click'));
  assert.deepEqual(f.events, ['render']); assert.equal(f.rendered().scopes[1].namespace, definition);
  assert.equal(f.rendered().scopes[1].label, 'ブロック: Part');
  f.state.language = 'en'; f.state.editing = { draft: { id: 'B9', name: 'Draft' } }; f.state.model = { parameters: [], symbols: [] };
  f.openButton.dispatchEvent(new Event('click'));
  assert.equal(f.rendered().scopeLocked, true); assert.equal(f.rendered().scopes.length, 1);
  assert.equal(f.rendered().scopes[0].key, 'block:B9'); assert.equal(f.rendered().scopes[0].label, 'Block: Draft');
  assert.equal(f.rendered().scopes[0].namespace, f.state.model);
  f.editor.dispose(); f.events.length = 0; f.openButton.dispatchEvent(new Event('click')); assert.deepEqual(f.events, []);
  f.editor.start(); f.openButton.dispatchEvent(new Event('click')); assert.deepEqual(f.events, ['render']);
});

test('expression names come from the live Canvas scope or dialog draft without leaking one into the other', () => {
  const f = fixture(), outside = { closest: () => null }, inside = { closest: () => ({}) };
  assert.deepEqual(f.names(outside), ['width', 'd1']);
  f.draft.current = { parameters: [{ name: 'draft' }, { name: 'draft' }], dimensions: [{ name: 'draftD' }] };
  assert.deepEqual(f.names(inside), ['draft', 'draftD']);
  f.state.model = { parameters: [{ name: 'other' }], symbols: [{ parameterName: 'otherD' }] };
  assert.deepEqual(f.names(outside), ['other', 'otherD']);
  f.draft.current = null; assert.deepEqual(f.names(inside), ['other', 'otherD']);
});

test('dialog application retains success and failure feedback order through the composed controller', () => {
  const f = fixture(); assert.equal(f.editor.apply(), false); assert.deepEqual(f.events, []);
  f.editor.start(); f.openButton.dispatchEvent(new Event('click')); f.events.length = 0;
  f.applyButton.dispatchEvent(new Event('click'));
  assert.deepEqual(f.events, ['apply', ['history', 'Parameter変更'], ['hint', 'Parameterを適用しました'], 'render', 'ui', 'draw']);
  f.state.outcome = { success: false, error: new Error('rejected') }; f.events.length = 0;
  assert.equal(f.editor.apply(), false);
  assert.deepEqual(f.events, ['apply', 'render', ['error', 'rejected'], ['hint', 'rejected', 'error'], 'ui', 'draw']);
});
