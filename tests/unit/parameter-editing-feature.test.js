const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function fixture() {
  const events = [], scope = { parameters: [], sketches: [{ id: 'S1' }] };
  const state = { workspace: scope, editing: scope, language: 'ja', dependents: [], fail: null };
  const draft = { current: null };
  const context = { window: {} }; vm.createContext(context);
  for (const file of ['src/parameters/application.js', 'src/ui/parameter_dialog_controller.js',
    'src/application/parameter_editor.js', 'src/application/parameter_editing_feature.js']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), context);
  }
  const w = context.window;
  w.ParameterDialogDraft = { create: () => draft };
  w.ExpressionInputView = { create: () => ({ sync() {}, install() {}, refresh() {} }), createInsertion: () => ({ insert() {} }) };
  w.ParameterDialogView = { create: () => ({ setError: value => events.push(['error', value]) }) };
  const nativeController = w.ParameterDialogController;
  w.ParameterDialogController = { ...nativeController, create: () => ({ loadScope: key => events.push(['load', key]), start() {}, dispose() {} }) };
  w.HtmlText = { escapeHtml: String }; w.NumberDisplay = { formatDisplayNumber: String };
  w.ParameterEngine = { formatReference: String }; w.SketchHierarchy = { DEFAULT_SKETCH_ID: 'S1' };
  const namespace = Object.freeze({ expressionFromUserInput: String, parameterErrorText: error => error.message,
    ensureParameterNamespace(value) { events.push(['normalize', value]); },
    symbolDeletionDependents(items, value) { 'use strict'; assert.equal(this, undefined); events.push(['dependents', items, value]); return { removedNames: ['d1'], dependents: state.dependents }; } });
  const documentWorkspace = { document: { documentName: 'drawing', blockDefinitions: [] }, parameters: namespace,
    workspace: { current: () => state.workspace }, sketches: { activeSketchId: () => 'S1', isRootSketch: () => false } };
  const presentation = { settings: { applicationText: (ja, en) => state.language === 'en' ? en : ja, get language() { return state.language; } },
    setHint: (...args) => events.push(['hint', ...args]), log: value => events.push(['log', value]),
    updateUI: () => events.push(['ui']), draw: () => events.push(['draw']) };
  const options = { document: {}, window: {}, documentWorkspace, presentation,
    currentNamespace: documentWorkspace.workspace.current, currentScope: () => state.editing, readBlockEditor: () => null,
    recordHistory: label => events.push(['history', label]), pickDimension() {} };
  const feature = w.ParameterEditingFeature.prepareForWorkspace(options);
  const applicationOptions = { editingScope: { get current() { return state.editing; } },
    blocks: { session: { current: null }, createPropagation: () => ({ propagate: value => events.push(['propagate', value]) }) },
    history: { captureDocument: () => JSON.stringify(state.workspace) }, checkpoint: { captureValues() {}, restoreValues() {} },
    parameters: { stabilize() { if (state.fail) throw state.fail; return { success: true, result: { errorNorm: 0 } }; } },
    storedDefinitions: { stabilize() {} }, acceptError: 1,
    loadDocument: value => events.push(['restore', value]), clearSelection() {} };
  return { w, feature, options, applicationOptions, state, events, draft, scope };
}

test('parameter assembly keeps the actual editor draft and applies through the later native application with recovery', () => {
  const f = fixture(); assert.deepEqual(f.events, []); assert.equal(f.feature.editor.draft, f.draft);
  f.draft.current = { key: 'document', namespace: f.scope, parameters: [{ name: ' width ', expression: '12' }], dimensions: [] };
  assert.throws(() => f.feature.editor.apply(), /Cannot access 'parameterApplication' before initialization/);
  assert.deepEqual(f.events, []);
  const result = f.feature.createApplication(f.applicationOptions);
  assert.ok(result.application); assert.deepEqual(f.events, []);
  assert.equal(f.feature.editor.apply(), true);
  assert.equal(f.scope.parameters[0].name, 'width');
  assert.deepEqual(f.events.map(item => item[0]), ['normalize', 'history', 'hint', 'load', 'ui', 'draw']);
  f.events.length = 0; f.state.fail = new Error('solver rejected');
  assert.equal(f.feature.editor.apply(), false);
  assert.deepEqual(f.events.map(item => item[0]), ['normalize', 'restore', 'load', 'error', 'hint', 'ui', 'draw']);
  assert.equal(f.events.find(item => item[0] === 'error')[1], 'solver rejected');
});

test('parameter guard and namespace preparation retain live Workspace, explicit namespaces and language independently of editing scope', () => {
  const f = fixture(), items = [], workspace = { id: 'workspace' }, editing = { id: 'editing' }, explicit = { id: 'explicit' };
  f.state.workspace = workspace; f.state.editing = editing;
  f.feature.prepareNamespace(); assert.deepEqual(f.events.splice(0), [['normalize', workspace]]);
  assert.equal(f.feature.guard(items), true); assert.equal(f.events.shift()[2], workspace);
  f.state.dependents = ['width']; f.state.language = 'en';
  assert.equal(f.feature.guard(items, explicit), false); assert.equal(f.events[0][2], explicit);
  assert.match(f.events[1][1], /Cannot delete d1/); assert.equal(f.events[1][2], 'error');
  assert.equal(f.events[2][1], f.events[1][1]);
  f.state.workspace = editing; f.events.length = 0;
  f.feature.prepareNamespace(); assert.equal(f.events[0][1], editing);
});

test('application publication preserves receiver, all arguments, return and original errors, and a failed factory retains the completed application', () => {
  const f = fixture(), calls = [], value = {}, marker = new Error('original'), first = { apply(...args) { assert.equal(this, first); calls.push(args); return value; } };
  let applyDraft;
  f.w.ParameterEditor = { createForWorkspace(options) { applyDraft = options.applyDraft; return { marker: 'actual editor' }; } };
  const feature = f.w.ParameterEditingFeature.prepareForWorkspace(f.options);
  f.w.ParameterApplication = { ...f.w.ParameterApplication, createForWorkspace: () => ({ application: first }) };
  feature.createApplication(f.applicationOptions);
  const args = [{}, () => {}, { extra: true }]; assert.equal(applyDraft(...args), value); assert.deepEqual(calls[0], args);
  first.apply = function () { assert.equal(this, first); throw marker; };
  assert.throws(() => applyDraft(), error => error === marker);
  f.w.ParameterApplication.createForWorkspace = () => { throw marker; };
  assert.throws(() => feature.createApplication(f.applicationOptions), error => error === marker);
  first.apply = () => value; assert.equal(applyDraft(), value);
  const other = f.w.ParameterEditingFeature.prepareForWorkspace(f.options), otherApply = applyDraft;
  assert.throws(() => otherApply(), /before initialization/); assert.notEqual(other.editor, feature.editor);
});
