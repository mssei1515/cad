const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function fixture(configureOptions) {
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
  if (configureOptions) configureOptions(options, { w, state, events });
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

test('Parameter defaults separate the live Workspace namespace from the lazy bound-scope reader and keep native expression highlights on that scope', () => {
  const marker = new Error('bound read failed'); let editorPorts, referenceNames, namespaceReader, namespaceGets = 0, boundGets = 0, ready = false, failure;
  const f = fixture((options, { w, state }) => {
    delete options.currentNamespace; delete options.currentScope;
    const owner = options.documentWorkspace;
    const readNamespace = function() { 'use strict'; assert.equal(this, undefined); assert.equal(arguments.length, 0); return state.workspace; };
    Object.defineProperty(owner.workspace, 'current', { get() { namespaceGets++; return readNamespace; } });
    Object.defineProperty(owner, 'readEditingScope', { get() {
      boundGets++; if (failure === 'getter') throw marker;
      return function() {
        assert.equal(this, owner); assert.equal(arguments.length, 0);
        if (!ready) throw new ReferenceError("Cannot access 'editingScopeBinding' before initialization");
        if (failure === 'method') throw marker; return state.editing;
      };
    } });
    owner.parameters = { ...owner.parameters, symbolElementsInNamespace(scope) { assert.equal(scope, state.editing); return []; } };
    const editor = w.ParameterEditor, guard = w.ParameterApplication, input = w.ExpressionInputView;
    w.ParameterEditor = { ...editor, createForWorkspace(ports) { editorPorts = ports; return editor.createForWorkspace(ports); } };
    w.ParameterApplication = { ...guard, createDeletionGuard(ports) { namespaceReader = ports.currentNamespace; return guard.createDeletionGuard(ports); } };
    w.ExpressionInputView = { ...input, create(ports) { referenceNames = ports.referenceNamesForInput; return input.create(ports); } };
    assert.equal(namespaceGets, 0); assert.equal(boundGets, 0);
    state.readNamespace = readNamespace;
  });
  assert.equal(namespaceGets, 1); assert.equal(namespaceReader, f.state.readNamespace); assert.equal(boundGets, 0); assert.deepEqual(f.events, []);
  assert.equal(editorPorts.currentScope.name, 'currentScope'); assert.equal(editorPorts.currentScope.length, 0);
  assert.throws(editorPorts.currentScope, { name: 'ReferenceError', message: "Cannot access 'editingScopeBinding' before initialization" });
  ready = true;
  const workspace = { parameters: [{ name: 'workspaceName' }] }, bound = { parameters: [{ name: 'boundName' }] };
  f.state.workspace = workspace; f.state.editing = bound;
  assert.equal(editorPorts.currentScope.call({}, 'ignored'), bound);
  f.feature.prepareNamespace(); assert.deepEqual(f.events.splice(0), [['normalize', workspace]]);
  assert.equal(f.feature.guard([]), true); assert.equal(f.events.shift()[2], workspace);
  const input = { closest: () => null };
  assert.deepEqual([...referenceNames(input)], ['boundName']); assert.equal(namespaceGets, 1);
  const replacement = { parameters: [{ name: 'otherBound' }] }; f.state.editing = replacement;
  assert.deepEqual([...referenceNames(input)], ['otherBound']); assert.equal(f.state.workspace, workspace);
  for (const stage of ['getter', 'method']) { failure = stage; assert.throws(editorPorts.currentScope, error => error === marker); }
});

test('Parameter default readers preserve explicit own and inherited overrides including undefined and null without reading fallback owners', () => {
  for (const inherited of [false, true]) for (const value of [undefined, null, () => 17]) {
    let scope, namespace; const marker = new Error('unexpected fallback read');
    const f = fixture((options, { w }) => {
      delete options.currentScope; delete options.currentNamespace;
      if (inherited) Object.setPrototypeOf(options, { currentScope: value, currentNamespace: value });
      else Object.assign(options, { currentScope: value, currentNamespace: value });
      Object.defineProperty(options.documentWorkspace, 'readEditingScope', { get() { throw marker; } });
      Object.defineProperty(options.documentWorkspace.workspace, 'current', { get() { throw marker; } });
      const editor = w.ParameterEditor, guard = w.ParameterApplication;
      w.ParameterEditor = { ...editor, createForWorkspace(ports) { scope = ports.currentScope; return editor.createForWorkspace(ports); } };
      w.ParameterApplication = { ...guard, createDeletionGuard(ports) { namespace = ports.currentNamespace; return guard.createDeletionGuard(ports); } };
    });
    assert.equal(scope, value); assert.equal(namespace, value);
    if (typeof value === 'function') { f.feature.prepareNamespace(); assert.deepEqual(f.events, [['normalize', 17]]); }
    else assert.throws(f.feature.prepareNamespace, error => error.name === 'TypeError');
  }
});
